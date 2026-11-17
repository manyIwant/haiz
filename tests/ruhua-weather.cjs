// 入画 · the weather model (Node): parsing, interpolation, surface water memory, targets, light.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const fx = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8'));

(async () => {
  const M = await import('../lanren/ruhua/weather/model.js');
  const { createSource } = await import('../lanren/ruhua/weather/source.js');
  const { createWeather } = await import('../lanren/ruhua/weather/weather.js');
  const results = [];
  const check = (name, fn) => { try { fn(); results.push(['ok', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };
  const at = (iso) => M.localIsoToMs(iso);

  const fc = M.parseForecast(fx('ruhua-archive-20261103.json'));
  check('parses 48 hourly rows in Haikou time', () => {
    assert.strictEqual(fc.hours.length, 48);
    assert.strictEqual(fc.hours[0].t, Date.UTC(2026, 10, 2, 16));    // 2026-11-03 00:00 +08
  });
  check('interpolates between hours; precipitation is the rate of the hour that ends', () => {
    const r = M.sampleAt(fc, at('2026-11-03T12:30'));
    assert.ok(Math.abs(r.precip - 2.9) < 1e-9, 'precip ' + r.precip);
    assert.ok(r.cloud > 93 && r.cloud <= 100);
    const d = M.sampleAt(fc, at('2026-11-03T00:30')).dir;
    assert.ok(d >= 0 && d < 360);
  });
  check('wind direction interpolates through the short arc', () => {
    const f = { hours: [{ t: 0, temp: 20, rh: 80, cloud: 0, wind: 2, gust: 3, dir: 350, precip: 0, code: 0 }, { t: 3600000, temp: 20, rh: 80, cloud: 0, wind: 2, gust: 3, dir: 10, precip: 0, code: 0 }], current: null };
    const d = M.sampleAt(f, 1800000).dir;
    assert.ok(d > 355 || d < 5, 'got ' + d);
  });
  check('the paving remembers the rain: soaked in the evening, damp at dawn, drying in the morning sun, soaked again by the shower', () => {
    const s = (iso) => M.spinUp(fc, at(iso), 30);
    const drizzle = s('2026-11-03T11:00'), eve = s('2026-11-03T20:00'), dawn = s('2026-11-04T06:00'), morning = s('2026-11-04T10:00'), after = s('2026-11-04T16:00');
    assert.ok(drizzle.wet > 0.2 && drizzle.wet < 0.6, 'a 0.1-0.2 mm drizzle only dampens ' + drizzle.wet.toFixed(2));
    assert.ok(eve.wet > 0.85 && eve.puddle > 0.3, 'evening ' + JSON.stringify(eve));
    assert.ok(dawn.wet > 0.5, 'dawn after a saturated night ' + dawn.wet.toFixed(2));
    assert.ok(morning.wet < dawn.wet * 0.6, 'drying under 45-60 % cloud ' + morning.wet.toFixed(2));
    assert.ok(after.wet > 0.85, 'the 3.1 mm shower at 15:00 ' + after.wet.toFixed(2));
  });
  check('targets: rain closes the sky, calm air does not sway the trees', () => {
    const wet = M.targets(M.sampleAt(fc, at('2026-11-03T13:00')));
    assert.ok(wet.rain > 0.3 && wet.overcast > 0.8, JSON.stringify({ r: wet.rain, o: wet.overcast }));
    const clear = M.targets(M.presetRaw('clear', 0));
    assert.ok(clear.overcast < 0.1 && clear.rain === 0 && clear.cover < 0.3);
    const windy = M.targets(M.presetRaw('windy', 0));
    assert.ok(windy.sway > clear.sway * 2 && windy.gust > clear.gust);
    // "from 135°" blows towards 315°
    assert.strictEqual(M.targets({ ...M.presetRaw('clear', 0), dir: 135 }).windBearing, 315);
  });
  check('rain pulses: showers burst and pause, steady rain swells, the mean stays near the hour', () => {
    let sum = 0, min = 9, max = 0;
    for (let t = 0; t < 7200; t += 2) { const v = M.rainPulse(t, 81); sum += v; min = Math.min(min, v); max = Math.max(max, v); }
    assert.ok(min < 0.25 && max > 1.4, `shower range ${min.toFixed(2)}..${max.toFixed(2)}`);
    let s2 = 0; for (let t = 0; t < 7200; t += 2) s2 += M.rainPulse(t, 63);
    assert.ok(Math.abs(s2 / 3600 - 1) < 0.25, 'steady mean ' + (s2 / 3600).toFixed(2));
  });
  check('sun and moon: Haikou noon in mid-November ~51°, night below the horizon', () => {
    const noon = M.sunAt(Date.UTC(2026, 10, 17, 4, 20));   // 12:20 +08
    assert.ok(Math.abs(noon.alt - 51) < 2.5, 'noon alt ' + noon.alt.toFixed(1));
    assert.ok(noon.bearing > 165 && noon.bearing < 195);
    assert.ok(M.sunAt(Date.UTC(2026, 10, 17, 14)).alt < -30);     // 22:00
    const m = M.moonAt(Date.UTC(2026, 10, 17, 14));
    assert.ok(m.fraction >= 0 && m.fraction <= 1);
  });
  check('light: continuous through the day, cloud takes the shadows away, night is moonlit or dark', () => {
    const w = M.targets(M.presetRaw('clear', 0));
    let prev = null, maxJump = 0;
    for (let h = 0; h < 24; h += 1 / 60) {
      const ms = M.atHaikouHour(Date.UTC(2026, 10, 17, 4), h);
      const p = M.palette(M.sunAt(ms), M.moonAt(ms), w);
      if (prev) maxJump = Math.max(maxJump, Math.abs(p.exposure - prev.exposure), Math.abs(p.skyAmb[2] - prev.skyAmb[2]));
      prev = p;
    }
    assert.ok(maxJump < 0.04, 'largest one-minute change ' + maxJump.toFixed(3));
    const noon = M.atHaikouHour(Date.UTC(2026, 10, 17, 4), 12.3);
    const sunny = M.palette(M.sunAt(noon), M.moonAt(noon), w);
    const grey = M.palette(M.sunAt(noon), M.moonAt(noon), M.targets(M.presetRaw('overcast', 0)));
    assert.ok(grey.direct < sunny.direct * 0.3 && grey.shadowRadius > sunny.shadowRadius);
    const night = M.atHaikouHour(Date.UTC(2026, 10, 17, 4), 23);
    const pn = M.palette(M.sunAt(night), M.moonAt(night), w);
    assert.ok(pn.night > 0.99 && pn.lamps > 0.9 && pn.sun[0] < 0.4);
  });
  check('fallback: monthly normals when there is no forecast', () => {
    const c = M.climatology(Date.UTC(2026, 10, 17, 6));
    assert.ok(c.fallback && c.temp > 18 && c.temp < 30 && c.precip === 0);
  });
  check('words: 小雨 / 阴 / 晴 and Beaufort', () => {
    assert.strictEqual(M.weatherName({ code: 61, precip: 0.6, cloud: 100 }), '小雨');
    assert.strictEqual(M.weatherName({ code: 3, precip: 0, cloud: 95 }), '阴');
    assert.strictEqual(M.weatherName({ code: 0, precip: 0, cloud: 5 }), '晴');
    assert.strictEqual(M.windName(2.6).force, 2);
    assert.strictEqual(M.fromName(149), '东南');
  });

  // ---- the source: cache, failure, fallback (no network: injected fetch)
  const store = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };
  const okFetch = async () => ({ ok: true, json: async () => fx('ruhua-archive-20261103.json') });
  const limitFetch = async () => ({ ok: false, status: 429, json: async () => fx('ruhua-forecast-limit.json') });
  const st = store();
  let s = createSource({ fetchImpl: okFetch, storage: st, now: () => 1e12 });
  await s.refresh(); s.stop();
  check('source: a good answer is live and cached', () => { assert.strictEqual(s.status.state, 'live'); assert.ok(st.m.has('haiz.weather.v1')); });
  s = createSource({ fetchImpl: limitFetch, storage: st, now: () => 1e12 + 3600000 });
  await s.refresh(); s.stop();
  check('source: a refused request falls back to the cache, labelled as such', () => { assert.strictEqual(s.status.state, 'cached'); assert.ok(s.status.forecast); assert.match(s.status.error, /429/); });
  s = createSource({ fetchImpl: limitFetch, storage: store(), now: () => 1e12 });
  await s.refresh(); s.stop();
  check('source: nothing cached and refused → offline (normals)', () => { assert.strictEqual(s.status.state, 'offline'); assert.strictEqual(s.status.forecast, null); });

  // ---- the controller: free mode eases, the state never jumps
  let t = M.localIsoToMs('2026-11-03T13:10');
  const live = createSource({ fetchImpl: okFetch, storage: store(), now: () => t });
  await live.refresh(); live.stop();
  const W = createWeather({ source: live, now: () => t });
  W.onForecast();
  check('controller: opens in the rain it finds (no easing at the start)', () => assert.ok(W.state.cur.rain > 0.3 && W.state.cur.overcast > 0.8));
  W.setFree('clear');
  let worst = 0, last = W.state.cur.overcast;
  for (let i = 0; i < 600; i++) { t += 100; W.update(0.1); worst = Math.max(worst, Math.abs(W.state.cur.overcast - last)); last = W.state.cur.overcast; }
  check('controller: free mode reaches the chosen sky smoothly', () => { assert.ok(W.state.cur.overcast < 0.2, 'overcast ' + W.state.cur.overcast); assert.ok(worst < 0.05, 'step ' + worst); });
  check('controller: the paving stays wet a while after the sky clears', () => assert.ok(W.state.cur.wet > 0.3, 'wet ' + W.state.cur.wet));
  W.setLive();
  check('controller: back to 海口此刻', () => assert.strictEqual(W.state.mode, 'live'));

  let failed = 0;
  for (const r of results) { console.log(r[0] === 'ok' ? '  ✓' : '  ✗', r[1], r[2] || ''); if (r[0] !== 'ok') failed++; }
  console.log(`ruhua weather: ${results.length - failed}/${results.length}`);
  process.exit(failed ? 1 : 0);
})();
