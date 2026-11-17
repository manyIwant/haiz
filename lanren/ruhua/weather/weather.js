// HAIZ · 入画 — the one weather every part of the painting reads.
//
// 海口此刻 (live): the forecast (source.js) sampled at this second, the surface water integrated
// from the past hours, the light from the real sun and moon over the campus.
// 自由天气 (free): a chosen sky and hour, reached by the same easing (only faster), the clock
// running on from the chosen hour; one tap returns to 海口此刻.
//
// The state object (`state`) is shared by reference: the renderer, the rain, the trees, the
// butterflies and the cat all read the same numbers in the same frame.
import { sampleAt, climatology, presetRaw, PRESETS, spinUp, stepSurface, targets, ease, palette, sunAt, moonAt, rainPulse,
  weatherName, windName, fromName, haikouClock, atHaikouHour } from './model.js';

export function createWeather({ source = null, now = () => Date.now(), initial = null } = {}) {
  const S = {
    mode: 'live',              // 'live' | 'free'
    preset: null, hour: null,  // free mode
    clock: now(),              // the moment the sky shows (epoch ms)
    raw: null, model: { wet: 0, puddle: 0 }, surf: { wet: 0, puddle: 0 },
    cur: null, tgt: null, pal: null, sun: null, moon: null,
    rainNow: 0, origin: 'loading', fetchedAt: 0,
    time: 0,                   // seconds since start (rhythms)
  };
  let freeOffset = 0, sampleT = 0, spun = false;

  function rawNow() {
    if (S.mode === 'free') return presetRaw(S.preset, S.clock, S.raw?.temp ?? 27);
    const fc = source?.status.forecast;
    if (fc) { S.origin = source.status.state; S.fetchedAt = source.status.fetchedAt; return sampleAt(fc, S.clock); }
    S.origin = source ? (source.status.state === 'loading' ? 'loading' : 'offline') : 'offline';
    return climatology(S.clock);
  }
  function resample(force = false) {
    S.raw = rawNow();
    if (S.mode === 'live' && !spun && source?.status.forecast) { S.model = spinUp(source.status.forecast, S.clock); spun = true; if (force) S.surf = { ...S.model }; }
    S.tgt = targets(S.raw, S.model);
  }
  function sky() {
    S.sun = sunAt(S.clock);
    S.moon = moonAt(S.clock);
    S.pal = palette(S.sun, S.moon, S.cur);
  }
  // first state: no easing (a page that opens on rain starts in rain)
  resample(true);
  S.cur = { ...S.tgt, windDir: S.tgt.windDir.slice() };
  if (initial) Object.assign(S.cur, initial);
  sky();

  const api = {
    state: S,
    /** the forecast arrived or changed: take it in (the surface is spun up once from the past hours) */
    onForecast() { const first = !spun; resample(first); if (first) { S.cur = { ...S.tgt, windDir: S.tgt.windDir.slice() }; S.surf = { ...S.model }; } },
    update(dt) {
      S.time += dt;
      S.clock = S.mode === 'free' ? now() + freeOffset : now();
      sampleT -= dt;
      if (sampleT <= 0) { sampleT = 2; resample(); }
      // the surface water: real time in 海口此刻; a minute a second in free mode, so a shower visibly wets the paving
      const k = S.mode === 'free' ? 60 : 1;
      const sunUp = S.pal ? S.pal.direct * Math.max(0, S.sun.dir[1]) * 1.6 : 0;
      S.model = stepSurface(S.model, S.raw, dt * k, Math.min(1, sunUp));
      S.tgt.wet = S.model.wet; S.tgt.puddle = S.model.puddle;
      const e = 1 - Math.exp(-dt / 3);
      S.surf.wet += (S.model.wet - S.surf.wet) * e; S.surf.puddle += (S.model.puddle - S.surf.puddle) * e;
      ease(S.cur, S.tgt, dt, S.mode === 'free' ? 9 : 1);
      S.cur.wet = S.surf.wet; S.cur.puddle = S.surf.puddle;
      S.rainNow = S.cur.rain * rainPulse(S.time, S.raw.code ?? 0);
      sky();
      return S;
    },
    /** free weather: a preset sky (null keeps the current one) and/or a Haikou hour (null keeps the clock) */
    setFree(preset = null, hour = null) {
      if (S.mode !== 'free') { S.preset = 'cloudy'; freeOffset = 0; }
      S.mode = 'free';
      if (preset && PRESETS[preset]) {
        S.preset = preset;
        const s = PRESETS[preset].surface;
        if (s) S.model = { ...s };
      }
      if (hour != null) { S.hour = hour; freeOffset = atHaikouHour(now(), hour) - now(); }
      sampleT = 0; resample();
    },
    setLive() { S.mode = 'live'; S.preset = null; S.hour = null; freeOffset = 0; spun = false; sampleT = 0; resample(); },
    /** captions for the interface */
    caption() {
      const r = S.raw, c = haikouClock(S.clock);
      const w = windName(r.wind || 0);
      const hh = String(c.h).padStart(2, '0'), mm = String(c.min).padStart(2, '0');
      return {
        name: S.mode === 'free' ? PRESETS[S.preset]?.label || weatherName(r) : weatherName(r),
        temp: Math.round(r.temp ?? 0), rh: Math.round(r.rh ?? 0),
        wind: `${fromName(r.dir ?? 0)}风 ${w.force} 级`, windWord: w.word, windMs: (r.wind || 0).toFixed(1),
        clock: `${hh}:${mm}`, date: `${c.m} 月 ${c.d} 日`,
        origin: S.mode === 'free' ? 'free' : S.origin,
        age: S.fetchedAt ? Math.round((now() - S.fetchedAt) / 60000) : null,
        fallback: !!r.fallback,
      };
    },
  };
  return api;
}
