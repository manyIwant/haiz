// 年轮 (lanren/rings): the archive, the calendar, the sky and the ring's geometry.
// node tests/rings.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const load = (p) => import(pathToFileURL(path.join(root, p)).href);

(async () => {
  const codec = await load('lanren/rings/codec.js');
  const C = await load('lanren/rings/climate.js');
  const A = await load('lanren/rings/almanac.js');
  const D = await load('lanren/rings/disc.js');
  const season = await load('lanren/js/season.js');
  const results = [];
  const ok = (name, fn) => { fn(); results.push(name); };

  // ---------------------------------------------------------------- codec
  ok('codec round-trips values and gaps', () => {
    const rows = [
      { tmax: 31.4, tmin: 24.9, rain: 211.2, wind: 71, gust: 120, dir: 320, cloud: 100, code: 65 },
      { tmax: -1.5, tmin: -3.2, rain: 0, wind: 0, gust: 0, dir: 0, cloud: 0, code: 0 },
      { tmax: 29.5, tmin: 14.2, rain: null, wind: 20, gust: 31, dir: null, cloud: null, code: 0 }
    ];
    const back = codec.unpack(codec.pack(rows), rows.length);
    assert.deepEqual(back.row(0), rows[0]);
    assert.deepEqual(back.row(1), { ...rows[1], tmax: -1.5, tmin: -3.2 });
    assert.equal(back.row(2).rain, null);
    assert.equal(back.row(2).dir, null);
    assert.equal(codec.isoOfIndex(codec.dayIndex('2014-07-18')), '2014-07-18');
    assert.equal(codec.dayIndex('1940-01-01'), 0);
    assert.throws(() => codec.unpack(new Uint8Array(5), 3));
  });

  // ---------------------------------------------------------------- the shipped archive
  const meta = JSON.parse(fs.readFileSync(path.join(root, 'lanren/rings/data/climate.json'), 'utf8'));
  const climate = C.createClimate(meta, fs.readFileSync(path.join(root, 'lanren/rings/data/climate.bin')));
  ok('archive is whole: one row per calendar day from 1940', () => {
    assert.equal(meta.start, '1940-01-01');
    assert.equal(codec.isoOfIndex(meta.days - 1), meta.last);
    assert.ok(meta.days > 31000);
    assert.match(meta.source, /ERA5/);
    let holes = 0;
    for (let i = 1; i < climate.days; i++) if (climate.value('tmax', i) == null || climate.value('rain', i) == null) holes++;
    assert.equal(holes, 0, 'no day after the first lacks temperature or rain');
    for (let i = 0; i < climate.days; i += 97) {
      const r = climate.row(i);
      assert.ok(r.tmax >= r.tmin && r.tmax < 45 && r.tmin > -5, `plausible temperatures on ${codec.isoOfIndex(i)}`);
    }
  });
  ok('archive carries the storms the island remembers', () => {
    // Rammasun 2014-07-18, Damrey 2005-09-26, Yagi 2024-09-06: gales and heavy rain at Haikou
    for (const d of ['2014-07-18', '2005-09-26', '2024-09-06']) {
      const r = climate.row(codec.dayIndex(d));
      assert.ok(r.gust >= 100, `${d} gust ${r.gust}`);
      assert.ok(r.rain >= 50, `${d} rain ${r.rain}`);
    }
    assert.match(A.describeDay(climate.row(codec.dayIndex('2014-07-18'))), /大暴雨 211\.2 mm.*阵风 12 级/);
  });
  ok('calendar: dates, leap years, year lines', () => {
    assert.deepEqual(C.parts(C.indexOfDate(2000, 2, 29)), { y: 2000, m: 2, d: 29, weekday: 2 });
    assert.equal(C.dateLabel(C.indexOfDate(1988, 4, 26)), '1988 年 4 月 26 日');
    assert.equal(C.yearLength(1900), 365); assert.equal(C.yearLength(2024), 366);
    assert.equal(climate.years[0].y, 1940);
    assert.equal(climate.years.at(-1).y, climate.lastYear);
    assert.ok(climate.meanRain > 900 && climate.meanRain < 2500);
    const s = climate.span(C.indexOfDate(2021, 9, 1), C.indexOfDate(2024, 6, 30));
    assert.equal(s.days, 1034);
    assert.ok(s.wet > 300 && s.wet < 700 && s.hot.v > 33 && s.cold.v < 15);
  });
  ok('the baseline is a real seasonal cycle and recent decades run warmer', () => {
    const mean = (y0, y1) => { let s = 0, n = 0; for (let i = C.yearStart(y0); i < C.yearStart(y1 + 1); i++) { const a = climate.anomaly(i); if (a != null) { s += a; n++; } } return s / n; };
    assert.ok(Math.abs(mean(1961, 1990)) < 0.05, 'the baseline period averages to its own normal');
    assert.ok(mean(2011, 2020) > 0.3, 'the 2010s are warmer than 1961–1990 in this reanalysis');
  });

  // ---------------------------------------------------------------- sun, moon, sky
  ok('moon: known phases and a sane sky', () => {
    // full moon 2000-01-21 04:40 UTC (total lunar eclipse); new moon 2024-04-08 18:21 UTC (total solar eclipse)
    assert.ok(A.moonAt(Date.UTC(2000, 0, 21, 4, 40)).fraction > 0.995);
    assert.ok(A.moonAt(Date.UTC(2024, 3, 8, 18, 21)).fraction < 0.005);
    assert.equal(A.moonAt(Date.UTC(2000, 0, 21, 4, 40)).name, '满月');
    // waxing then waning across a lunation
    const a = A.moonAt(Date.UTC(2024, 3, 12)).fraction, b = A.moonAt(Date.UTC(2024, 3, 16)).fraction;
    assert.ok(b > a);
    for (let h = 0; h < 48; h++) { const m = A.moonAt(Date.UTC(2020, 5, 1, h)); assert.ok(m.altitude > -Math.PI / 2 && m.altitude < Math.PI / 2 && m.bearing >= 0 && m.bearing < 360); }
  });
  ok('sunrise and sunset at Haikou', () => {
    const jun = A.sunTimes(2024, 6, 21), dec = A.sunTimes(2024, 12, 21);
    // published times: about 06:00 / 19:22 at the June solstice, 07:08 / 18:06 in December
    assert.ok(Math.abs(jun.rise - 360) < 12 && Math.abs(jun.set - 1162) < 12, JSON.stringify(jun));
    assert.ok(Math.abs(dec.rise - 428) < 12 && Math.abs(dec.set - 1086) < 12, JSON.stringify(dec));
    assert.ok(jun.set - jun.rise > dec.set - dec.rise + 120, 'summer days are two hours longer');
  });
  ok('a day stages the tree: noon, night, storm', () => {
    const idx = codec.dayIndex('2014-07-18');
    const storm = A.stageFor({ y: 2014, m: 7, d: 18, minutes: 900 }, climate.row(idx));
    assert.ok(storm.weather.rain > 0.9 && storm.weather.wind > 1.4 && storm.weather.storm > 0.9);
    assert.ok(storm.L.I < 1.5 && storm.L.sat < 1 && storm.stars === 0);
    const clear = A.stageFor({ y: 2019, m: 4, d: 20, minutes: 720 }, climate.row(codec.dayIndex('2019-04-20')));
    assert.ok(clear.sun.altitude > 70 && clear.L.I > 3 && clear.weather.rain === 0);
    const night = A.stageFor({ y: 1999, m: 12, d: 31, minutes: 1425 }, climate.row(codec.dayIndex('1999-12-31')));
    assert.ok(night.sun.altitude < -40 && night.night === 1 && night.stars > 0.3 && night.L.zenith[2] < 0.08);
    // the wind vector is horizontal and of unit length; the lamp is always above the horizon
    for (const s of [storm, clear, night]) {
      assert.ok(Math.abs(Math.hypot(...s.weather.windDir) - 1) < 1e-9 && s.weather.windDir[1] === 0);
      assert.ok(s.L.sunEl >= 2);
      for (const k of ['zenith', 'horizon', 'fog', 'sunCol', 'glow']) assert.ok(s.L[k].every((v) => Number.isFinite(v) && v >= 0), k);
    }
    // a day without data is staged calm and says so
    assert.equal(A.stageFor({ y: 2030, m: 1, d: 1, minutes: 600 }, null).has, false);
  });
  ok('the year of leaves closes on itself', () => {
    // the two resets of season.js must be invisible: before and after, every leaf is in the same state
    const leafState = (turn, flushG) => {   // mirrors GROW_GLSL (lanren/js/foliage.js) for the year channel
      const out = [];
      for (let k = 0; k < 400; k++) {
        const tE = 0.2 + 0.21 * ((k * 0.61803) % 1);
        const r1 = (tE * 917.31 + 0.37) % 1, oldAge = (turn - r1 * 0.85) * 2.2;
        if (turn > 0 && oldAge < 1) out.push('old:' + Math.max(0, oldAge).toFixed(3));
        else out.push(flushG < tE - 0.035 ? 'none' : 'new:' + Math.min(1, Math.max(0, (flushG - tE) / 0.2)).toFixed(3) + ':' + Math.min(1, Math.max(0, (flushG - tE - 0.12) / 0.3)).toFixed(3));
      }
      return out;
    };
    const at = (m, d, minutes) => A.stageFor({ y: 2023, m, d, minutes }, null).leaf;
    const mayA = at(4, 30, 1439), mayB = at(5, 1, 1);
    assert.ok(mayA.turn > 1.3 && mayB.turn < 0.01, 'the old cohort resets on 1 May');
    assert.deepEqual(leafState(mayA.turn, mayA.flushG).map((s) => s.replace(/\d\.\d+/g, (v) => (+v).toFixed(1))), leafState(mayB.turn, mayB.flushG).map((s) => s.replace(/\d\.\d+/g, (v) => (+v).toFixed(1))));
    const novA = at(11, 1, 1439), novB = at(11, 2, 1);
    assert.ok(novA.flushG > 0.99 && novB.flushG < 0.2, 'the new cohort becomes the old one on 2 November');
    assert.ok(novA.turn > 0 && novB.turn > 0);
    const coarse = (list) => list.map((s) => s.replace(/\d\.\d+/g, (v) => (+v).toFixed(1)));
    assert.deepEqual(coarse(leafState(novA.turn, novA.flushG)), coarse(leafState(novB.turn, novB.flushG)));
    assert.ok(leafState(novB.turn, novB.flushG).every((s) => s.startsWith('old')), 'in November every leaf on the tree is last season\'s');
    // 31 December and 1 January meet
    const d31 = at(12, 31, 1439), j1 = at(1, 1, 0);
    assert.ok(Math.abs(d31.turn - j1.turn) < 0.02 && Math.abs(d31.lush - j1.lush) < 0.02);
    // bare in late February, whole again by May, red in January
    assert.ok(leafState(at(2, 26, 720).turn, at(2, 26, 720).flushG).filter((s) => s.startsWith('old')).length < 8);
    assert.equal(season.seasonAt(120).label, '新绿满枝');
    assert.equal(season.seasonAt(200).label.startsWith('浓荫') || season.seasonAt(200).label === '夏季换叶', true);
  });

  // ---------------------------------------------------------------- the ring
  const lay = D.layout(climate);
  ok('ring geometry: every day has one cell and the cell finds its day', () => {
    assert.equal(lay.rings[0].y, 1923);
    assert.equal(lay.rings.at(-1).y, climate.lastYear);
    assert.ok(Math.abs(lay.edges.at(-1) - 1) < 1e-9);
    for (let k = 1; k < lay.edges.length; k++) assert.ok(lay.edges[k] > lay.edges[k - 1]);
    for (let i = 0; i < climate.days; i += 53) {
      const q = D.place(lay, i, C.parts);
      assert.equal(D.pick(lay, q.x, q.y).index, i, codec.isoOfIndex(i));
    }
    const last = D.place(lay, climate.days - 1, C.parts);
    assert.equal(D.pick(lay, last.x, last.y).index, climate.days - 1);
    assert.deepEqual(D.pick(lay, 0, 0), { pith: true });
    assert.equal(D.pick(lay, 0, -1.2), null);
    const blank = D.pick(lay, 0, -(lay.edges[3] + lay.edges[4]) / 2 * D.wobble(0));
    assert.deepEqual(blank, { y: 1926, blank: true });
    // 1 January is at the top, the year runs clockwise: 1 April is to the right
    const apr = D.place(lay, C.indexOfDate(2000, 4, 1), C.parts);
    assert.ok(apr.x > 0 && Math.abs(apr.y) < apr.x * 0.1);
  });
  ok('ring widths follow rainfall; lenses colour every day', () => {
    const wet = climate.years.filter((y) => y.full).sort((a, b) => b.rain - a.rain)[0], dry = climate.years.filter((y) => y.full).sort((a, b) => a.rain - b.rain)[0];
    const w = (y) => lay.edges[lay.ringOfYear(y) + 1] - lay.edges[lay.ringOfYear(y)];
    assert.ok(w(wet.y) > w(dry.y) * 1.5, `${wet.y} is drawn wider than ${dry.y}`);
    for (const lens of D.LENSES.map((l) => l.id)) {
      for (let i = 0; i < climate.days; i += 211) {
        const c = D.colourOf(climate, i, lens);
        assert.ok(c.length === 3 && c.every((v) => v >= 0 && v <= 255), lens);
      }
    }
    const storm = D.colourOf(climate, codec.dayIndex('2014-07-18'), 'wood'), fair = D.colourOf(climate, codec.dayIndex('2019-04-20'), 'wood');
    assert.ok(storm[0] + storm[1] + storm[2] < (fair[0] + fair[1] + fair[2]) * 0.4, 'a typhoon leaves a dark scar in the wood');
  });

  fs.writeFileSync(path.join(__dirname, 'rings-results.json'), JSON.stringify({ passed: results.length, tests: results, days: climate.days, last: meta.last }, null, 2) + '\n');
  console.log(`rings: ${results.length} checks passed (${climate.days} days, to ${meta.last})`);
})().catch((err) => { console.error(err); process.exit(1); });
