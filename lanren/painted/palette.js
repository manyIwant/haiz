// Layer 3 · Haikou's sky and the colour of the hour, as a painter keys it.
//
// Three different things decide the light of the painted campus, and they stay apart:
//
//   1  real weather   cloud cover, rain, wind, humidity (Open-Meteo for the campus's coordinates, or the
//                     free-weather presets): lanren/ruhua/weather — unchanged
//   2  simulated light the sun's real position over Haikou and a physically keyed palette (dawn, morning,
//                     noon, afternoon, golden, blue hour, night) greyed by cloud: lanren/ruhua/weather/model.js
//   3  art direction  (here) four painted keys over that light — 正午, 午后, 黄金时刻, 日落 — keyed by the
//                     same sun altitude, so they follow the real hour and blend continuously. A painter does
//                     not copy the light: shade gets a chosen, cooler and richer hue; the sky a cleaner,
//                     deeper gradient and Haikou's bright, humid horizon; the clouds white tops and warm
//                     undersides at the low sun; the sun a warmer or cooler cast. Grey days keep most of the
//                     model's grey (the keys weaken with overcast and rain), and night is the model's alone
//
// Painted Valley keys its sky the same way (one set of colours per sun height, noon to sunset); its
// valley's values are its own, these are chosen for a tropical campus under cumulus.
const KEYS = [
  { label: '日落', e: 2, sun: [1.08, 0.84, 0.66], zenith: [0.13, 0.16, 0.42], horizon: [1.02, 0.6, 0.42], shadeHue: [0.6, 0.52, 1.0], shadeMix: 0.12,
    cloudLit: [1.75, 0.88, 0.56], cloudMid: [0.82, 0.48, 0.52], cloudShade: [0.34, 0.28, 0.52], rim: [1.12, 0.9, 0.78], sat: 1.08, exposure: 1.06, w: 0.75 },
  { label: '黄金时刻', e: 11, sun: [1.06, 0.95, 0.8], zenith: [0.1, 0.21, 0.52], horizon: [0.98, 0.78, 0.56], shadeHue: [0.5, 0.56, 1.0], shadeMix: 0.1,
    cloudLit: [1.55, 1.1, 0.74], cloudMid: [0.8, 0.62, 0.62], cloudShade: [0.38, 0.37, 0.6], rim: [1.1, 0.95, 0.82], sat: 1.07, exposure: 1.02, w: 0.7 },
  { label: '午后', e: 27, sun: [1.02, 0.985, 0.92], zenith: [0.045, 0.23, 0.6], horizon: [0.7, 0.8, 0.9], shadeHue: [0.55, 0.62, 1.0], shadeMix: 0.07,
    cloudLit: [1.3, 1.2, 1.04], cloudMid: [0.74, 0.76, 0.88], cloudShade: [0.42, 0.47, 0.7], rim: [1.04, 1.0, 0.94], sat: 1.05, exposure: 1.0, w: 0.6 },
  { label: '正午', e: 50, sun: [1.0, 0.995, 0.97], zenith: [0.035, 0.22, 0.62], horizon: [0.56, 0.77, 0.95], shadeHue: [0.5, 0.61, 1.0], shadeMix: 0.06,
    cloudLit: [1.22, 1.2, 1.16], cloudMid: [0.72, 0.8, 0.94], cloudShade: [0.4, 0.5, 0.74], rim: [1.0, 1.0, 1.0], sat: 1.04, exposure: 1.0, w: 0.55 },
];
const lerp = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** the art key for a sun altitude (degrees): blended between the two nearest keys */
export function artKey(alt) {
  if (alt <= KEYS[0].e) return { ...KEYS[0], t: 0, a: 0, b: 0 };
  for (let i = 0; i < KEYS.length - 1; i++) {
    const A = KEYS[i], B = KEYS[i + 1];
    if (alt <= B.e) {
      let t = (alt - A.e) / (B.e - A.e); t = t * t * (3 - 2 * t);
      const o = { t, a: i, b: i + 1, label: t < 0.5 ? A.label : B.label };
      for (const k of ['sun', 'zenith', 'horizon', 'shadeHue', 'cloudLit', 'cloudMid', 'cloudShade', 'rim']) o[k] = mix3(A[k], B[k], t);
      for (const k of ['shadeMix', 'sat', 'exposure', 'w']) o[k] = lerp(A[k], B[k], t);
      return o;
    }
  }
  return { ...KEYS[KEYS.length - 1], t: 1, a: KEYS.length - 1, b: KEYS.length - 1 };
}

const asArr = (v) => (Array.isArray(v) ? v : [v.r, v.g, v.b]);

/**
 * P: the weather model's palette for this moment (arrays or THREE.Color); S: the weather state
 * (S.cur.overcast, S.cur.rain). Returns a new palette with the art key laid over it, and how strongly.
 * strength: 0 leaves the model's light alone (the A/B switch and the transition use it).
 */
export function artPalette(P, S, strength = 1) {
  const alt = P.sunAlt ?? 45;
  const K = artKey(alt);
  const o = S?.cur?.overcast ?? 0, r = Math.min(1, Math.max(S?.rainNow ?? 0, S?.cur?.rain ?? 0));
  const day = smooth(-4, 3, alt);
  const w = K.w * day * (1 - 0.75 * o) * (1 - 0.5 * r) * strength;
  const out = { ...P };
  if (w <= 0.001) return { P: out, key: K, weight: 0 };
  const tint = (c, t) => { const a = asArr(c); return [a[0] * lerp(1, t[0], w), a[1] * lerp(1, t[1], w), a[2] * lerp(1, t[2], w)]; };
  out.sun = tint(P.sun, K.sun);
  out.rim = tint(P.rim, K.rim);
  out.zenith = mix3(asArr(P.zenith), K.zenith, w * 0.7);
  out.horizon = mix3(asArr(P.horizon), K.horizon, w * 0.6);
  out.shadeHue = mix3(asArr(P.shadeHue), K.shadeHue, w);
  out.shadeMix = P.shadeMix + K.shadeMix * w;
  for (const k of ['cloudLit', 'cloudMid', 'cloudShade']) out[k] = mix3(asArr(P[k]), K[k], w * 0.65);
  out.sat = P.sat * lerp(1, K.sat, w);
  out.exposure = P.exposure * lerp(1, K.exposure, w);
  // painted shadows are crisper than the model's soft ones
  out.shadowRadius = Math.max(1, P.shadowRadius * lerp(1, 0.7, w));
  return { P: out, key: K, weight: w };
}

export const ART_HOURS = KEYS.map((k) => ({ label: k.label, e: k.e }));
