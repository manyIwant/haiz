// 年轮 · the archive, asked by date.
// Wraps the unpacked columns (codec.js) with a calendar and the statistics the ring
// is drawn from. Pure given the bytes: the page fetches, Node reads the file.
import { unpack, dayIndex, isoOfIndex } from './codec.js';
import { isLeap } from '../js/sun.js';

const DAY = 86400000;
const T0 = Date.UTC(1940, 0, 1);
export const FIRST_YEAR = 1940;
export const SCHOOL_YEAR = 1923;   // the school opens; the archive has no days before 1940

export const parts = (i) => {
  const t = new Date(T0 + i * DAY);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), weekday: t.getUTCDay() };
};
export const indexOfDate = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - T0) / DAY);
export const yearStart = (y) => indexOfDate(y, 1, 1);
export const yearLength = (y) => (isLeap(y) ? 366 : 365);
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
export const dateLabel = (i) => { const p = parts(i); return `${p.y} 年 ${p.m} 月 ${p.d} 日`; };
export const weekdayLabel = (i) => '星期' + WEEK[parts(i).weekday];
export { dayIndex, isoOfIndex };

export function createClimate(meta, bytes) {
  const data = unpack(bytes, meta.days);
  const { cols, value, row } = data;
  const days = meta.days;
  const last = parts(days - 1);
  const lastYear = last.y;

  // ---- one line per year: what the ring's width and the captions are drawn from
  const years = [];
  for (let y = FIRST_YEAR; y <= lastYear; y++) {
    const a = yearStart(y), b = Math.min(days, a + yearLength(y));
    let rain = 0, wet = 0, tsum = 0, n = 0, gust = 0, gustDay = a, hot = -99, hotDay = a;
    for (let i = a; i < b; i++) {
      const r = value('rain', i), tx = value('tmax', i), tn = value('tmin', i), g = value('gust', i);
      if (r != null) { rain += r; if (r >= 1) wet++; }
      if (tx != null && tn != null) { tsum += (tx + tn) / 2; n++; if (tx > hot) { hot = tx; hotDay = i; } }
      if (g != null && g > gust) { gust = g; gustDay = i; }
    }
    years.push({ y, start: a, days: b - a, full: b - a === yearLength(y), rain, wet, tmean: n ? tsum / n : null, gust, gustDay, hot, hotDay });
  }
  const full = years.filter((r) => r.full);
  const meanRain = full.reduce((s, r) => s + r.rain, 0) / full.length;

  // ---- what a day of the year is usually like (1961–1990, smoothed over ±7 days):
  // the baseline the temperature lens is read against
  const normal = new Float32Array(366);
  {
    const sum = new Float64Array(366), cnt = new Uint32Array(366);
    for (let y = 1961; y <= 1990; y++) {
      const a = yearStart(y), len = yearLength(y);
      for (let k = 0; k < len; k++) {
        const tx = value('tmax', a + k), tn = value('tmin', a + k);
        if (tx == null || tn == null) continue;
        // leap years: keep 1 March on the same slot as other years
        const slot = len === 366 && k >= 59 ? (k === 59 ? 59 : k - 1) : k;
        sum[slot] += (tx + tn) / 2; cnt[slot]++;
      }
    }
    const raw = Array.from({ length: 365 }, (_, k) => (cnt[k] ? sum[k] / cnt[k] : 0));
    for (let k = 0; k < 365; k++) {
      let s = 0;
      for (let j = -7; j <= 7; j++) s += raw[(k + j + 365) % 365];
      normal[k] = s / 15;
    }
    normal[365] = normal[364];
  }
  const slotOf = (i) => { const p = parts(i); const k = i - yearStart(p.y); return isLeap(p.y) && k >= 59 ? Math.max(59, k - 1) : k; };
  /** mean temperature of day i minus what that day of the year usually was in 1961–1990 */
  const anomaly = (i) => {
    const tx = value('tmax', i), tn = value('tmin', i);
    return tx == null || tn == null ? null : (tx + tn) / 2 - normal[slotOf(i)];
  };

  /** the facts of a span of days [a, b] (inclusive, clamped to the archive) */
  function span(a, b) {
    a = Math.max(0, a); b = Math.min(days - 1, b);
    if (b < a) return null;
    const s = { from: a, to: b, days: b - a + 1, wet: 0, rain: 0, gale: 0,
      hot: { v: -99, i: a }, cold: { v: 99, i: a }, wettest: { v: -1, i: a }, windiest: { v: -1, i: a } };
    for (let i = a; i <= b; i++) {
      const r = value('rain', i), tx = value('tmax', i), tn = value('tmin', i), g = value('gust', i);
      if (r != null) { s.rain += r; if (r >= 1) s.wet++; if (r > s.wettest.v) s.wettest = { v: r, i }; }
      if (tx != null && tx > s.hot.v) s.hot = { v: tx, i };
      if (tn != null && tn < s.cold.v) s.cold = { v: tn, i };
      if (g != null) { if (g >= 62) s.gale++; if (g > s.windiest.v) s.windiest = { v: g, i }; }
    }
    return s;
  }

  return {
    meta, days, cols, value, row, years, meanRain, lastYear, last, anomaly, span,
    has: (i) => i >= 0 && i < days,
    clampIndex: (i) => Math.max(0, Math.min(days - 1, i))
  };
}

/** fetch and unpack in the page */
export async function loadClimate(base = new URL('./data/', import.meta.url)) {
  // The archive revises recent days even when the final date stays unchanged.
  // Always revalidate its tiny manifest and key the binary by content digest.
  const manifest = await fetch(new URL('climate.json', base), { cache: 'no-store' });
  if (!manifest.ok) throw new Error('climate.json ' + manifest.status);
  const meta = await manifest.json();
  const version = meta.sha256 || meta.built || meta.last; // old archives lack a digest
  const res = await fetch(new URL(`climate.bin?v=${encodeURIComponent(version)}`, base));
  if (!res.ok) throw new Error('climate.bin ' + res.status);
  return createClimate(meta, await res.arrayBuffer());
}
