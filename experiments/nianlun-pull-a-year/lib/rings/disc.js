// 年轮 · the ring itself.
//
// A cross-section drawn from days, not from wood:
//   one ring per year, 1923 (the school opens) at the pith, this year under the bark
//   each ring's width follows that year's rainfall (wet years grow wide rings)
//   around a ring runs its year: 1 January at the top, clockwise, one cell per day
//   1923–1939 have no reanalysis: those rings are drawn empty
// The geometry (layout, pick, place) is pure and tested in Node; paint() needs a
// 2D canvas. It is a drawing of weather data — not this tree's real growth rings.
import { FIRST_YEAR, SCHOOL_YEAR, yearStart, yearLength } from './climate.js';

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

export const PITH = 0.035;          // radius of the pith, in disc radii
export const BARK = 0.05;           // bark thickness outside the last ring
export const FRAME = 1.21;          // half-size of the square the disc is drawn in (room for bark and month names)
/** the outline is not a compass circle: every ring shares the same slow wobble */
export const wobble = (th) => 1 + 0.030 * Math.sin(2 * th + 0.6) + 0.017 * Math.sin(5 * th + 2.1) + 0.009 * Math.sin(9 * th + 4.0);

export function layout(climate) {
  const rings = [];
  for (let y = SCHOOL_YEAR; y < FIRST_YEAR; y++) rings.push({ y, blank: true, w: 0.62 });
  for (const r of climate.years) {
    // a year still growing gets an ordinary width until it is whole
    const ratio = r.full ? r.rain / climate.meanRain : 1;
    rings.push({ y: r.y, blank: false, w: clamp(0.3 + 0.9 * ratio, 0.72, 2.0), rain: r.rain, full: r.full });
  }
  const total = rings.reduce((s, r) => s + r.w, 0);
  const edges = new Float64Array(rings.length + 1);
  edges[0] = PITH;
  rings.forEach((r, k) => { edges[k + 1] = edges[k] + (r.w / total) * (1 - PITH); });
  const ringOfYear = (y) => y - SCHOOL_YEAR;
  return { rings, edges, ringOfYear, lastYear: climate.lastYear, days: climate.days };
}

/** which ring holds normalised radius rn (already divided by the wobble); -1 outside */
export function ringAt(lay, rn) {
  const e = lay.edges;
  if (rn < e[0] || rn >= e[e.length - 1]) return -1;
  let lo = 0, hi = e.length - 2;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (e[mid] <= rn) lo = mid; else hi = mid - 1; }
  return lo;
}

/** a point in disc units (x right, y down, centre 0,0) → what lies there */
export function pick(lay, x, y) {
  const th = (Math.atan2(x, -y) + TAU) % TAU;
  const rn = Math.hypot(x, y) / wobble(th);
  const k = ringAt(lay, rn);
  if (k < 0) return rn < lay.edges[0] ? { pith: true } : null;
  const ring = lay.rings[k];
  if (ring.blank) return { y: ring.y, blank: true };
  const len = yearLength(ring.y);
  const day = Math.min(len - 1, Math.floor((th / TAU) * len));
  const index = yearStart(ring.y) + day;
  return index < lay.days ? { y: ring.y, index, day } : { y: ring.y, future: true };
}

/** day index → { x, y, th, k, r0, r1 } in disc units (the middle of its cell) */
export function place(lay, index, climateParts) {
  const p = climateParts(index);
  const k = lay.ringOfYear(p.y);
  const len = yearLength(p.y);
  const th = ((index - yearStart(p.y) + 0.5) / len) * TAU;
  const w = wobble(th), r0 = lay.edges[k] * w, r1 = lay.edges[k + 1] * w, r = (r0 + r1) / 2;
  return { x: Math.sin(th) * r, y: -Math.cos(th) * r, th, k, r0, r1, r };
}
export const angleOfDay = (dayInYear, len) => ((dayInYear + 0.5) / len) * TAU;

// ---------------------------------------------------------------- colour
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const ramp = (stops, t) => {
  t = clamp(t) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(t));
  return mix(stops[i], stops[i + 1], t - i);
};
const PAPER = hex('#efe4cc');
const WOOD = [hex('#f4e8cc'), hex('#ecd3a2'), hex('#d9ad6c'), hex('#c08a4c')];
const WET = hex('#4b2e1d');
const SCAR = hex('#170c0a');
const RAIN = [hex('#efe6d2'), hex('#a9cdcc'), hex('#3f8aa3'), hex('#1b4f78'), hex('#0e2a4d')];
const COOL = [hex('#efe6d2'), hex('#9dbcd3'), hex('#3f6f9f'), hex('#1e3f6e')];
const WARM = [hex('#efe6d2'), hex('#e9b48a'), hex('#cf5a3a'), hex('#8e1f1c')];
const WIND = [hex('#efe6d2'), hex('#c9b6d6'), hex('#8758a8'), hex('#47206f'), hex('#1d0b33')];

export const LENSES = [
  { id: 'wood', label: '木纹', note: '底色是气温，越热越深；下雨的日子着墨，大风留下深色的疤' },
  { id: 'rain', label: '雨', note: '每一格是当天的雨量：从没下雨的纸色，到暴雨的深蓝' },
  { id: 'temp', label: '冷暖', note: '当天比 1961–1990 年的同一天冷（蓝）还是暖（红）' },
  { id: 'wind', label: '风', note: '当天最大阵风：越紫越猛，最深的几格是台风' }
];

/** colour of day i under a lens: [r, g, b] 0–255 */
export function colourOf(climate, i, lens) {
  const v = climate.value;
  const rain = v('rain', i) ?? 0, gust = v('gust', i) ?? 0;
  if (lens === 'rain') return ramp(RAIN, rain < 0.1 ? 0 : 0.1 + 0.9 * Math.log1p(rain) / Math.log1p(200));
  if (lens === 'wind') return ramp(WIND, (gust - 18) / 95);
  if (lens === 'temp') {
    const a = climate.anomaly(i);
    if (a == null) return PAPER;
    return a < 0 ? ramp(COOL, -a / 7) : ramp(WARM, a / 5);
  }
  const tx = v('tmax', i), tn = v('tmin', i);
  let c = tx == null ? PAPER : ramp(WOOD, ((tx + tn) / 2 - 14) / 17);
  if (rain >= 0.5) c = mix(c, WET, 0.14 + 0.72 * clamp(Math.log1p(rain) / Math.log1p(160)));
  if (gust >= 62) c = mix(c, SCAR, 0.45 + 0.5 * clamp((gust - 62) / 50));
  return c;
}

const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

/**
 * Paint the whole section into a square canvas of `size` device pixels.
 * Per pixel: polar position → ring → day → colour. About a quarter of a second at 1400 px.
 */
export function paint(ctx, size, climate, lay, lens = 'wood') {
  const img = ctx.createImageData(size, size);
  const px = img.data;
  const c = size / 2, R = c / FRAME;
  const e = lay.edges, nR = lay.rings.length;
  // colours of all days once, then pixels only look them up
  const table = new Uint8ClampedArray(lay.days * 3);
  for (let i = 0; i < lay.days; i++) { const col = colourOf(climate, i, lens); table[i * 3] = col[0]; table[i * 3 + 1] = col[1]; table[i * 3 + 2] = col[2]; }
  const starts = lay.rings.map((r) => (r.blank ? -1 : yearStart(r.y)));
  const lens365 = lay.rings.map((r) => yearLength(r.y));
  const outer = e[nR];
  for (let py = 0; py < size; py++) {
    const dy = (py + 0.5 - c) / R;
    for (let pxl = 0; pxl < size; pxl++) {
      const dx = (pxl + 0.5 - c) / R;
      const rr = Math.hypot(dx, dy);
      if (rr > 1.14) continue;
      const th = (Math.atan2(dx, -dy) + TAU) % TAU;
      const w = wobble(th), rn = rr / w;
      const o = (py * size + pxl) * 4;
      if (rn >= outer) {
        // bark: rough, darker outwards, with a ragged outer edge
        const depth = (rn - outer) / BARK;
        const rag = 0.78 + 0.22 * hash(Math.floor(th * 220), 3) + 0.1 * Math.sin(th * 37);
        if (depth > rag) continue;
        const n = hash(Math.floor(th * 520), Math.floor(depth * 9));
        const l = 0.55 + 0.45 * n - depth * 0.25;
        px[o] = 58 * l + 16; px[o + 1] = 40 * l + 11; px[o + 2] = 29 * l + 9;
        px[o + 3] = 255 * clamp((rag - depth) * 12);
        continue;
      }
      if (rn < e[0]) { px[o] = 96; px[o + 1] = 66; px[o + 2] = 44; px[o + 3] = 255; continue; }   // pith
      // which ring
      let lo = 0, hi = nR - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (e[mid] <= rn) lo = mid; else hi = mid - 1; }
      const start = starts[lo];
      let r, g, b, a = 255;
      if (start < 0) { r = 226; g = 213; b = 188; a = 150; }   // before the archive: an empty ring
      else {
        const len = lens365[lo];
        const i = start + Math.min(len - 1, Math.floor((th / TAU) * len));
        if (i >= lay.days) { r = 221; g = 226; b = 190; a = 90; }   // this year's days still to come
        else { r = table[i * 3]; g = table[i * 3 + 1]; b = table[i * 3 + 2]; }
      }
      // the line where one year stops and the next begins; a little stronger each decade
      const dIn = (rn - e[lo]) * R * w, dOut = (e[lo + 1] - rn) * R * w;
      const thick = (e[lo + 1] - e[lo]) * R;
      if (thick > 2.2) {
        const year = lay.rings[lo].y;
        if (dIn < 0.8) { const k = year % 10 === 0 ? 0.62 : 0.84; r *= k; g *= k; b *= k; }
        else if (dOut < 0.35) { r *= 0.93; g *= 0.93; b *= 0.93; }
      }
      // grain: a faint fibre along the radius, so flat colour reads as a surface
      const grain = 0.965 + 0.07 * hash(Math.floor(th * 900), 7);
      px[o] = r * grain; px[o + 1] = g * grain; px[o + 2] = b * grain; px[o + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** trace the part of ring k between two angles (for outlines and for cutting a span out of a veil) */
export function sectorPath(ctx, lay, k, th0, th1, R, cx, cy) {
  const steps = Math.max(2, Math.ceil(((th1 - th0) / TAU) * 180));
  for (let s = 0; s <= steps; s++) {
    const th = th0 + ((th1 - th0) * s) / steps, r = lay.edges[k + 1] * wobble(th) * R;
    const x = cx + Math.sin(th) * r, y = cy - Math.cos(th) * r;
    if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  for (let s = steps; s >= 0; s--) {
    const th = th0 + ((th1 - th0) * s) / steps, r = lay.edges[k] * wobble(th) * R;
    ctx.lineTo(cx + Math.sin(th) * r, cy - Math.cos(th) * r);
  }
  ctx.closePath();
}

/** every ring sector covered by days a…b (inclusive), as one path */
export function spanPath(ctx, lay, climateParts, a, b, R, cx, cy) {
  const pa = climateParts(a), pb = climateParts(b);
  for (let y = pa.y; y <= pb.y; y++) {
    const len = yearLength(y), s = yearStart(y);
    const d0 = y === pa.y ? a - s : 0, d1 = y === pb.y ? b - s + 1 : len;
    sectorPath(ctx, lay, lay.ringOfYear(y), (d0 / len) * TAU, (d1 / len) * TAU, R, cx, cy);
  }
}
