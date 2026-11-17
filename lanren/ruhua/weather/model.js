// HAIZ · 入画 — what the sky over the campus is doing, and how the painting shows it.
//
// Pure module (no DOM, no three.js): Node tests read it directly (tests/ruhua-weather.cjs).
//
//   data      Open-Meteo forecast for the campus anchor: a 15-minute "current" block and hourly
//             rows (past 12 h, next 12 h). Model output on a ~10 km grid, not a station in the school.
//   raw       the meteorological state at one moment: interpolated between hours, the latest
//             15-minute reading folded in and fading out over the following hour, so a refresh
//             never makes the picture jump
//   surface   what the weather leaves behind: how wet the paving is and how much water stands in
//             it. Integrated from the past 12 hours of rain, sun, wind and humidity, so the ground
//             after a morning shower is still damp at noon and dries in the afternoon sun
//   targets   the painting's own variables (cumulus, overcast deck, cirrus, rain, wind, haze, …).
//             The renderer eases towards them; nothing is ever switched
//   palette   the light: keyframed by the real sun's altitude (morning and evening differ), then
//             greyed, softened and cooled by cloud and rain. At night the moon is the lamp
//
// Not every variable becomes an effect: temperature only steers behaviour (the cat, butterflies)
// and the caption; pressure is not read at all.

export const SITE = Object.freeze({ lat: 19.996067, lon: 110.347227, tz: 8 });
// Campus north (towards 北门) as a true bearing. From assets/walk/campus.json: the "center" anchor
// is the campus origin and the "southGate" anchor is 南门 at campus (−56.2, −203.4) m; the bearing
// between them (157.0°) against the same vector in campus metres (195.4°) gives 321.6°. The plan's
// absolute orientation is still unverified (campus.json meta.verification); ±5° does not change
// the light noticeably.
export const CAMPUS_NORTH = 321.6;

const RAD = Math.PI / 180;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const grey = (c, k = 1, tint = [0.95, 0.99, 1.06]) => { const l = lum(c) * k; return [l * tint[0], l * tint[1], l * tint[2]]; };

// ---------------------------------------------------------------- sun and moon (low-precision ephemerides, as lanren/js/sun.js)
const DAY = 86400000, J1970 = 2440588, J2000 = 2451545, E = RAD * 23.4397;
const toDays = (ms) => ms / DAY - 0.5 + J1970 - J2000;
const ra = (l, b) => Math.atan2(Math.sin(l) * Math.cos(E) - Math.tan(b) * Math.sin(E), Math.cos(l));
const dec = (l, b) => Math.asin(Math.sin(b) * Math.cos(E) + Math.cos(b) * Math.sin(E) * Math.sin(l));
function horizontal(d, raV, decV, lat, lon) {
  const phi = RAD * lat, H = RAD * (280.16 + 360.9856235 * d) + RAD * lon - raV;
  const alt = Math.asin(Math.sin(phi) * Math.sin(decV) + Math.cos(phi) * Math.cos(decV) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(decV) * Math.cos(phi));
  let bearing = (az / RAD + 180) % 360; if (bearing < 0) bearing += 360;
  return { alt, bearing };
}
export function sunAt(ms, lat = SITE.lat, lon = SITE.lon) {
  const d = toDays(ms);
  const M = RAD * (357.5291 + 0.98560028 * d);
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + RAD * 102.9372 + Math.PI;
  const h = horizontal(d, ra(L, 0), dec(L, 0), lat, lon);
  return { alt: h.alt / RAD, bearing: h.bearing, dir: toWorld(h.alt, h.bearing) };
}
export function moonAt(ms, lat = SITE.lat, lon = SITE.lon) {
  const d = toDays(ms);
  const Lm = RAD * (218.316 + 13.176396 * d), Mm = RAD * (134.963 + 13.064993 * d), F = RAD * (93.272 + 13.229350 * d);
  const l = Lm + RAD * 6.289 * Math.sin(Mm), b = RAD * 5.128 * Math.sin(F), dist = 385001 - 20905 * Math.cos(Mm);
  const h = horizontal(d, ra(l, b), dec(l, b), lat, lon);
  const alt = h.alt - Math.asin(6378.14 / dist) * Math.cos(h.alt);
  // illuminated fraction from the elongation
  const Ms = RAD * (357.5291 + 0.98560028 * d);
  const Ls = Ms + RAD * (1.9148 * Math.sin(Ms)) + RAD * 102.9372 + Math.PI;
  const sRa = ra(Ls, 0), sDec = dec(Ls, 0), mRa = ra(l, b), mDec = dec(l, b);
  const elong = Math.acos(Math.sin(sDec) * Math.sin(mDec) + Math.cos(sDec) * Math.cos(mDec) * Math.cos(sRa - mRa));
  const inc = Math.atan2(149598000 * Math.sin(elong), dist - 149598000 * Math.cos(elong));
  return { alt: alt / RAD, bearing: h.bearing, dir: toWorld(alt, h.bearing), fraction: (1 + Math.cos(inc)) / 2 };
}
/** a true altitude (rad) and bearing (deg) → the walk's world frame (+X campus east, −Z campus north) */
export function toWorld(altRad, bearing, north = CAMPUS_NORTH) {
  const rel = (bearing - north) * RAD, c = Math.cos(altRad);
  return [Math.sin(rel) * c, Math.sin(altRad), -Math.cos(rel) * c];
}
/** Haikou wall clock for an epoch time */
export function haikouClock(ms) {
  const t = new Date(ms + SITE.tz * 3600000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), min: t.getUTCMinutes(), hours: t.getUTCHours() + t.getUTCMinutes() / 60 + t.getUTCSeconds() / 3600 };
}
/** epoch ms of a Haikou wall-clock time on the Haikou date of `ms` */
export function atHaikouHour(ms, hours) {
  const c = haikouClock(ms);
  return Date.UTC(c.y, c.m - 1, c.d) + hours * 3600000 - SITE.tz * 3600000;
}

// ---------------------------------------------------------------- the forecast, read
export const HOURLY = ['temperature_2m', 'relative_humidity_2m', 'precipitation', 'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high',
  'visibility', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'weather_code', 'shortwave_radiation'];
export const CURRENT = ['temperature_2m', 'relative_humidity_2m', 'precipitation', 'weather_code', 'cloud_cover', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m'];
const KEY = { temperature_2m: 'temp', relative_humidity_2m: 'rh', precipitation: 'precip', cloud_cover: 'cloud', cloud_cover_low: 'low', cloud_cover_mid: 'mid',
  cloud_cover_high: 'high', visibility: 'vis', wind_speed_10m: 'wind', wind_direction_10m: 'dir', wind_gusts_10m: 'gust', weather_code: 'code', shortwave_radiation: 'rad' };

/** Open-Meteo local ISO time ("2026-11-17T13:00", tz +8) → epoch ms */
export function localIsoToMs(s, tzHours = SITE.tz) {
  const [date, time = '00:00'] = s.split('T');
  const [y, m, d] = date.split('-').map(Number), [hh, mm] = time.split(':').map(Number);
  return Date.UTC(y, m - 1, d, hh, mm) - tzHours * 3600000;
}

/** the API's JSON → { hours: [{t, temp, rh, …}], current: {t, …} | null }. Throws on a malformed body. */
export function parseForecast(json) {
  if (!json || !json.hourly || !Array.isArray(json.hourly.time)) throw new Error('forecast has no hourly block');
  const tz = (json.utc_offset_seconds ?? SITE.tz * 3600) / 3600;
  const h = json.hourly, hours = [];
  for (let i = 0; i < h.time.length; i++) {
    const row = { t: localIsoToMs(h.time[i], tz) };
    for (const k of HOURLY) row[KEY[k]] = h[k] ? h[k][i] : null;
    if (row.temp == null || row.cloud == null || row.wind == null) continue;   // a gap: skip the hour
    hours.push(row);
  }
  if (hours.length < 2) throw new Error('forecast has fewer than two usable hours');
  let current = null;
  if (json.current && json.current.time) {
    current = { t: localIsoToMs(json.current.time, tz) };
    for (const k of CURRENT) current[KEY[k]] = json.current[k] ?? null;
  }
  return { hours, current };
}

const pct = (v) => clamp((v ?? 0) / 100);
function interpRow(a, b, k) {
  const r = { t: lerp(a.t, b.t, k) };
  for (const key of ['temp', 'rh', 'cloud', 'low', 'mid', 'high', 'vis', 'wind', 'gust', 'rad']) {
    const va = a[key], vb = b[key];
    r[key] = va == null ? vb : vb == null ? va : lerp(va, vb, k);
  }
  // direction: through the vector, never the long way round
  const ax = Math.sin(a.dir * RAD), az = Math.cos(a.dir * RAD), bx = Math.sin(b.dir * RAD), bz = Math.cos(b.dir * RAD);
  r.dir = (Math.atan2(lerp(ax, bx, k), lerp(az, bz, k)) / RAD + 360) % 360;
  // precipitation is the total of the hour ending at the row's time: a rate, held across that hour
  r.precip = b.precip ?? 0;
  r.code = k < 0.5 ? a.code : b.code;
  return r;
}

/**
 * The raw state at `ms`. With a current reading, its difference from the hourly curve is kept at
 * the moment of reading and fades out over the next hour.
 */
export function sampleAt(fc, ms) {
  const H = fc.hours;
  let r;
  if (ms <= H[0].t) r = { ...H[0] };
  else if (ms >= H[H.length - 1].t) r = { ...H[H.length - 1] };
  else {
    let i = 0;
    while (H[i + 1].t < ms) i++;
    r = interpRow(H[i], H[i + 1], (ms - H[i].t) / (H[i + 1].t - H[i].t));
  }
  const c = fc.current;
  if (c && Math.abs(ms - c.t) < 3 * 3600000) {
    const base = sampleAt({ hours: H, current: null }, c.t);
    const w = Math.exp(-Math.max(0, ms - c.t) / (55 * 60000));
    for (const key of ['temp', 'rh', 'cloud', 'wind', 'gust']) if (c[key] != null && base[key] != null) r[key] += (c[key] - base[key]) * w;
    if (c.precip != null && w > 0.5) r.precip = Math.max(r.precip * (1 - w), c.precip * 4 * w);   // the 15-minute total, as an hourly rate
    if (c.code != null && w > 0.5) r.code = c.code;
  }
  r.cloud = clamp(r.cloud, 0, 100); r.rh = clamp(r.rh, 0, 100);
  r.wind = Math.max(0, r.wind); r.gust = Math.max(r.wind, r.gust ?? r.wind * 1.6);
  return r;
}

// ---------------------------------------------------------------- when there is no forecast
// Haikou monthly normals (rounded; China Meteorological Administration 1991–2020 station normals
// and ERA5 for cloud). Used only when the forecast cannot be read; the interface says so.
const NORMALS = [
  // temp mean, diurnal range, rh, cloud %, wind m/s, wind from (deg)
  [18.6, 6, 85, 76, 3.0, 45], [19.8, 6, 86, 78, 3.0, 60], [22.4, 7, 86, 72, 3.0, 110], [25.8, 7, 84, 64, 3.1, 130],
  [28.0, 7, 81, 60, 2.9, 145], [28.9, 6, 81, 64, 2.8, 165], [29.0, 6, 79, 60, 2.7, 180], [28.6, 6, 82, 64, 2.5, 165],
  [27.6, 6, 84, 64, 2.6, 75], [25.9, 6, 82, 58, 3.0, 40], [23.2, 6, 81, 60, 3.2, 35], [20.2, 6, 81, 66, 3.1, 40],
];
export function climatology(ms) {
  const c = haikouClock(ms);
  const [t, range, rh, cloud, wind, dir] = NORMALS[c.m - 1];
  const day = Math.cos(((c.hours - 14.5) / 24) * Math.PI * 2);     // warmest mid-afternoon
  return { t: ms, temp: t + range * 0.5 * day, rh: rh - 12 * day, cloud, low: cloud * 0.6, mid: cloud * 0.4, high: cloud * 0.3, vis: 18000,
    wind: wind * (1 + 0.25 * day), gust: wind * 2, dir, precip: 0, code: cloud > 70 ? 3 : 2, rad: null, fallback: true };
}

// ---------------------------------------------------------------- free weather (the explore panel)
export const PRESETS = {
  clear: { label: '晴', cloud: 8, low: 4, mid: 3, high: 10, precip: 0, wind: 2.4, gust: 5, rh: 66, code: 0, vis: 30000 },
  cloudy: { label: '多云', cloud: 55, low: 40, mid: 25, high: 30, precip: 0, wind: 3.2, gust: 7, rh: 72, code: 2, vis: 24000 },
  overcast: { label: '阴', cloud: 97, low: 90, mid: 70, high: 40, precip: 0, wind: 3.0, gust: 6, rh: 84, code: 3, vis: 14000 },
  drizzle: { label: '小雨', cloud: 100, low: 95, mid: 80, high: 50, precip: 1.4, wind: 3.4, gust: 7, rh: 93, code: 61, vis: 9000 },
  storm: { label: '雷阵雨', cloud: 100, low: 100, mid: 95, high: 80, precip: 16, wind: 6.5, gust: 15, rh: 96, code: 95, vis: 3000 },
  windy: { label: '大风', cloud: 40, low: 30, mid: 20, high: 35, precip: 0, wind: 9.5, gust: 17, rh: 70, code: 2, vis: 26000 },
  after: { label: '雨后', cloud: 35, low: 25, mid: 20, high: 20, precip: 0, wind: 2.2, gust: 5, rh: 88, code: 1, vis: 20000, surface: { wet: 0.95, puddle: 0.8 } },
};
export function presetRaw(name, ms, temp = 27) {
  const p = PRESETS[name];
  return { t: ms, temp, dir: 135, rad: null, ...p };
}

// ---------------------------------------------------------------- what the weather leaves behind
/** rain intensity 0..1 from mm/h (drizzle ~0.15, steady rain ~0.5, cloudburst 1) */
export const rainLevel = (mm) => (mm < 0.05 ? 0 : clamp(Math.log1p(mm * 1.6) / Math.log1p(40)));

/**
 * One step of the paving's water budget. surf: {wet 0..1, puddle 0..1}; sunUp: 0..1 direct sun on
 * the ground. Wetting is fast; drying follows evaporation: faster in sun, wind, warmth and dry air.
 * Puddles fill only in real rain (above what the joints drain) and outlast the damp.
 */
export function stepSurface(surf, raw, dtSec, sunUp = 0) {
  const mm = raw.precip || 0;
  const h = dtSec / 3600;
  const dryAir = clamp(1 - (raw.rh ?? 80) / 100, 0.02, 1);
  const evap = (0.06 + 0.9 * sunUp * (1 - pct(raw.cloud) * 0.7) + 0.05 * Math.min(raw.wind || 0, 10)) * (0.4 + 1.6 * dryAir) * (0.6 + 0.03 * Math.max(0, (raw.temp ?? 25) - 10));
  let wet = surf.wet, puddle = surf.puddle;
  // a drizzle keeps the paving damp, real rain soaks it; above that level it dries towards it
  const level = mm > 0.05 ? 0.3 + 0.7 * smooth(0, 1.5, mm) : 0;
  if (wet < level) wet += (level - wet) * (1 - Math.exp(-h * (2 + mm * 6)));
  else wet -= (wet - level) * (1 - Math.exp(-evap * h * (mm > 0.05 ? 0.3 : 1)));
  const fill = Math.max(0, mm - 0.6) * 0.14;
  puddle += fill * h * (1 - puddle) - puddle * evap * 0.32 * h * (mm > 0.3 ? 0.2 : 1);
  return { wet: clamp(wet), puddle: clamp(puddle) };
}
/** the surface now, from the hours before it (the forecast's past rows), stepped every 5 minutes */
export function spinUp(fc, ms, hours = 12) {
  let surf = { wet: 0, puddle: 0 };
  const start = Math.max(fc.hours[0].t, ms - hours * 3600000);
  for (let t = start; t < ms; t += 300000) {
    const raw = sampleAt(fc, t);
    const sun = sunAt(t);
    surf = stepSurface(surf, raw, 300, smooth(0, 25, sun.alt));
  }
  return surf;
}

// ---------------------------------------------------------------- rain and wind have their own rhythm
function vnoise(x, seed) {
  const h = (n) => { const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return s - Math.floor(s); };
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u);
}
/**
 * How hard it is raining at this second, as a multiple of the hour's mean: showers come in bursts
 * with dry gaps; steady rain swells and eases; drizzle barely changes. Mean ≈ 1.
 */
export function rainPulse(sec, code) {
  const shower = (code >= 80 && code <= 82) || code >= 95;
  const drizzle = code >= 51 && code <= 57;
  const slow = vnoise(sec / 240, 3.1), mid = vnoise(sec / 47, 7.7), fast = vnoise(sec / 9, 1.3);
  if (shower) return clamp((smooth(0.32, 0.7, slow) * 1.7 + mid * 0.5) * (0.8 + fast * 0.4), 0, 2.4);
  if (drizzle) return 0.85 + 0.3 * mid;
  return 0.55 + 0.6 * slow + 0.25 * mid + 0.1 * fast;
}

// ---------------------------------------------------------------- the painting's variables
/** raw state (+ surface) → what the renderer eases towards */
export function targets(raw, surf = { wet: 0, puddle: 0 }) {
  const cloud = pct(raw.cloud), low = pct(raw.low ?? raw.cloud), mid = pct(raw.mid ?? raw.cloud * 0.6), high = pct(raw.high ?? raw.cloud * 0.4);
  const code = raw.code ?? 0;
  const rain = rainLevel(raw.precip || 0);
  const storm = code >= 95 ? 1 : 0;
  const fog = code === 45 || code === 48 ? 1 : 0;
  // a deck of low or middle cloud closing over: the cumulus cards give way to it
  const deck = Math.max(low * 0.8 + mid * 0.45, cloud);
  const overcast = clamp(smooth(0.55, 0.97, deck) + rain * 0.5 + storm * 0.3);
  const cover = clamp((0.15 + cloud * 0.95) * (1 - overcast * 0.55));
  const cirrus = clamp(high * (1 - overcast) * 1.1);
  const vis = raw.vis ?? 24000;
  const haze = clamp(smooth(24000, 3000, vis) * 0.8 + smooth(82, 98, raw.rh ?? 75) * 0.3 + rain * 0.3 + fog);
  const w = raw.wind || 0, g = Math.max(w, raw.gust || w);
  const toward = ((raw.dir ?? 135) + 180) % 360;              // meteorological "from" → where it blows
  return {
    cover, overcast, cirrus, rain, storm, haze, fog,
    wet: surf.wet, puddle: surf.puddle,
    // the gust fronts travel at about the mean wind; their strength is the gust's excess over it
    windSpeed: clamp(0.6 + w * 0.9, 0.6, 16),
    gust: clamp(0.18 + w / 9 + (g - w) / 12, 0.12, 1.7),
    sway: clamp(0.2 + w / 4.2, 0.2, 2.6),
    windBearing: toward,
    windDir: [Math.sin((toward - CAMPUS_NORTH) * RAD), -Math.cos((toward - CAMPUS_NORTH) * RAD)],
    temp: raw.temp ?? 26, rh: raw.rh ?? 75, mm: raw.precip || 0, wind: w, windGust: g,
  };
}

const EASE = { cover: 90, overcast: 90, cirrus: 120, rain: 14, storm: 20, haze: 120, fog: 120, windSpeed: 10, gust: 6, sway: 8, temp: 300, rh: 300 };
/** ease `cur` towards `tgt` (both objects from targets()); `fast` shortens every time constant (free mode) */
export function ease(cur, tgt, dt, fast = 1) {
  for (const k of Object.keys(EASE)) cur[k] = lerp(cur[k], tgt[k], 1 - Math.exp(-dt * fast / EASE[k]));
  // the wind's direction turns through the shortest arc
  const a = Math.atan2(cur.windDir[0], cur.windDir[1]), b = Math.atan2(tgt.windDir[0], tgt.windDir[1]);
  let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  const n = a + d * (1 - Math.exp(-dt * fast / 25));
  cur.windDir = [Math.sin(n), Math.cos(n)];
  for (const k of ['wet', 'puddle', 'windBearing', 'mm', 'wind', 'windGust']) cur[k] = tgt[k];
  return cur;
}

// ---------------------------------------------------------------- the light
// The V2 walk's three moods (lanren/stroll/daylight.js) are the day's anchors; night, the blue hour
// and the low sun are added around them. Keyed by the sun's altitude, morning and evening apart.
const K = (o) => o;
const NIGHT = K({ sun: [0, 0, 0], skyAmb: [0.13, 0.17, 0.34], groundAmb: [0.07, 0.07, 0.11], rim: [0.18, 0.2, 0.34],
  zenith: [0.012, 0.022, 0.062], horizon: [0.07, 0.09, 0.17], sunGlow: [0.1, 0.13, 0.22], depthCol: [0.82, 0.9, 1.12], depthTint: 0.5,
  air: 1 / 520, falloff: 0.03, mist: 0.08, cloudLit: [0.2, 0.23, 0.33], cloudMid: [0.11, 0.13, 0.2], cloudShade: [0.05, 0.06, 0.11], cloudRim: [0.2, 0.24, 0.38],
  shadeHue: [0.52, 0.62, 1.0], shadeMix: 0.38, cloudShadow: 0.0, exposure: 1.85, sat: 0.92, shadowRadius: 3, bloom: 0.38 });
const BLUE = K({ sun: [0, 0, 0], skyAmb: [0.3, 0.32, 0.58], groundAmb: [0.2, 0.18, 0.26], rim: [0.6, 0.42, 0.5],
  zenith: [0.07, 0.11, 0.3], horizon: [0.62, 0.46, 0.55], sunGlow: [0.95, 0.52, 0.42], depthCol: [0.92, 0.88, 1.08], depthTint: 0.45,
  air: 1 / 480, falloff: 0.03, mist: 0.14, cloudLit: [0.72, 0.5, 0.56], cloudMid: [0.4, 0.36, 0.52], cloudShade: [0.22, 0.22, 0.38], cloudRim: [1.1, 0.6, 0.5],
  shadeHue: [0.66, 0.6, 1.0], shadeMix: 0.34, cloudShadow: 0.05, exposure: 1.28, sat: 1.0, shadowRadius: 4, bloom: 0.32 });
const DAWN = K({ sun: [2.1, 1.25, 0.72], skyAmb: [0.52, 0.52, 0.92], groundAmb: [0.42, 0.38, 0.46], rim: [1.3, 0.85, 0.55],
  zenith: [0.16, 0.3, 0.62], horizon: [0.95, 0.74, 0.62], sunGlow: [1.6, 0.95, 0.55], depthCol: [0.94, 0.92, 1.06], depthTint: 0.42,
  air: 1 / 500, falloff: 0.04, mist: 0.22, cloudLit: [1.3, 0.95, 0.75], cloudMid: [0.78, 0.68, 0.78], cloudShade: [0.48, 0.48, 0.66], cloudRim: [1.7, 1.15, 0.75],
  shadeHue: [0.68, 0.64, 1.0], shadeMix: 0.28, cloudShadow: 0.2, exposure: 1.04, sat: 1.05, shadowRadius: 3.5, bloom: 0.26 });
const MORNING = K({ sun: [1.95, 1.58, 1.16], skyAmb: [0.56, 0.64, 1.1], groundAmb: [0.44, 0.44, 0.56], rim: [1.2, 0.88, 0.6],
  zenith: [0.14, 0.36, 0.74], horizon: [0.86, 0.84, 0.82], sunGlow: [1.45, 1.02, 0.64], depthCol: [0.9, 0.95, 1.08], depthTint: 0.4,
  air: 1 / 560, falloff: 0.045, mist: 0.2, cloudLit: [1.15, 1.0, 0.86], cloudMid: [0.82, 0.82, 0.9], cloudShade: [0.56, 0.6, 0.76], cloudRim: [1.4, 1.1, 0.8],
  shadeHue: [0.66, 0.68, 1.0], shadeMix: 0.26, cloudShadow: 0.25, exposure: 1.02, sat: 1.04, shadowRadius: 4, bloom: 0.22 });
const NOON = K({ sun: [1.8, 1.73, 1.6], skyAmb: [0.6, 0.69, 1.2], groundAmb: [0.46, 0.48, 0.6], rim: [1.0, 0.95, 0.85],
  zenith: [0.05, 0.25, 0.65], horizon: [0.6, 0.78, 0.94], sunGlow: [1.05, 1.02, 0.95], depthCol: [0.9, 0.96, 1.07], depthTint: 0.35,
  air: 1 / 750, falloff: 0.02, mist: 0, cloudLit: [1.14, 1.13, 1.1], cloudMid: [0.74, 0.81, 0.93], cloudShade: [0.42, 0.51, 0.72], cloudRim: [1.2, 1.2, 1.15],
  shadeHue: [0.6, 0.67, 1.0], shadeMix: 0.3, cloudShadow: 0.38, exposure: 0.95, sat: 1.03, shadowRadius: 1.5, bloom: 0.16 });
const AFTERNOON = K({ sun: [1.95, 1.62, 1.28], skyAmb: [0.58, 0.64, 1.1], groundAmb: [0.46, 0.44, 0.54], rim: [1.15, 0.9, 0.7],
  zenith: [0.08, 0.26, 0.62], horizon: [0.7, 0.76, 0.86], sunGlow: [1.25, 1.0, 0.75], depthCol: [0.92, 0.95, 1.06], depthTint: 0.38,
  air: 1 / 650, falloff: 0.025, mist: 0.04, cloudLit: [1.22, 1.08, 0.95], cloudMid: [0.74, 0.74, 0.86], cloudShade: [0.42, 0.46, 0.66], cloudRim: [1.45, 1.2, 0.95],
  shadeHue: [0.64, 0.64, 1.0], shadeMix: 0.3, cloudShadow: 0.32, exposure: 0.98, sat: 1.04, shadowRadius: 2, bloom: 0.2 });
const GOLDEN = K({ sun: [2.4, 1.4, 0.7], skyAmb: [0.56, 0.48, 0.86], groundAmb: [0.42, 0.34, 0.36], rim: [1.4, 0.8, 0.45],
  zenith: [0.22, 0.24, 0.5], horizon: [0.86, 0.62, 0.58], sunGlow: [1.55, 0.92, 0.5], depthCol: [0.96, 0.9, 1.06], depthTint: 0.45,
  air: 1 / 480, falloff: 0.03, mist: 0.12, cloudLit: [1.4, 0.95, 0.7], cloudMid: [0.68, 0.54, 0.7], cloudShade: [0.38, 0.32, 0.54], cloudRim: [1.9, 1.2, 0.7],
  shadeHue: [0.74, 0.6, 0.96], shadeMix: 0.3, cloudShadow: 0.25, exposure: 1.05, sat: 1.05, shadowRadius: 2.5, bloom: 0.3 });
const AM = [[-12, NIGHT], [-5, BLUE], [3, DAWN], [13, MORNING], [42, NOON]];
const PM = [[-12, NIGHT], [-5, BLUE], [4, GOLDEN], [20, AFTERNOON], [42, NOON]];
const COLOR_KEYS = ['sun', 'skyAmb', 'groundAmb', 'rim', 'zenith', 'horizon', 'sunGlow', 'depthCol', 'cloudLit', 'cloudMid', 'cloudShade', 'cloudRim', 'shadeHue'];
const NUM_KEYS = ['depthTint', 'air', 'falloff', 'mist', 'shadeMix', 'cloudShadow', 'exposure', 'sat', 'shadowRadius', 'bloom'];
function blendKeys(a, b, t) {
  const o = {};
  for (const k of COLOR_KEYS) o[k] = mix3(a[k], b[k], t);
  for (const k of NUM_KEYS) o[k] = lerp(a[k], b[k], t);
  return o;
}
function keyed(list, alt) {
  if (alt <= list[0][0]) return blendKeys(list[0][1], list[0][1], 0);
  for (let i = 0; i < list.length - 1; i++) {
    const [a0, A] = list[i], [a1, B] = list[i + 1];
    if (alt <= a1) { const t = (alt - a0) / (a1 - a0); return blendKeys(A, B, t * t * (3 - 2 * t)); }
  }
  return blendKeys(list[list.length - 1][1], list[list.length - 1][1], 0);
}

/**
 * The light for one moment. sun/moon from sunAt/moonAt; w the eased targets.
 * Returns plain numbers and [r, g, b] arrays in the V2 walk's parameter names, plus:
 *   dir        the direction the shadow-casting lamp shines from (sun by day, moon at night)
 *   direct     0..1 how much of that lamp reaches the ground (for shadows and the cat's sunbathing)
 *   night      0..1;  lamps  0..1 (lit windows)
 */
export function palette(sun, moon, w) {
  const morning = sun.bearing < 180;
  const P = keyed(morning ? AM : PM, sun.alt);
  const night = 1 - smooth(-9, -2, sun.alt);
  const o = w.overcast, r = w.rain;
  // ---- the lamp: the sun, or by night the moon, through the cloud
  let dir = sun.dir.slice();
  let direct = smooth(-1.5, 3, sun.alt) * (1 - 0.9 * Math.pow(o, 1.25)) * (1 - 0.35 * w.cover * (1 - o));
  if (night > 0.5) {
    const up = smooth(-2, 8, moon.alt);
    const moonLight = up * (0.25 + 0.75 * moon.fraction) * (1 - 0.92 * o);
    dir = moon.alt > 2 ? moon.dir.slice() : [0.25, 0.94, 0.22];
    direct = moonLight * 0.9;
    P.sun = [0.34 * moonLight, 0.42 * moonLight, 0.66 * moonLight];
  }
  // never let a grazing lamp throw shadows the length of the campus
  const len = Math.hypot(dir[0], dir[2]);
  if (dir[1] < 0.17) { const k = Math.sqrt(1 - 0.17 * 0.17) / (len || 1); dir = [dir[0] * k, 0.17, dir[2] * k]; }
  // ---- cloud and rain: grey the sky, take the edge off the light, cool and darken
  const g = (c, k) => grey(c, k);
  P.sun = P.sun.map((v) => v * (1 - 0.88 * Math.pow(o, 1.3)));
  P.sun = mix3(P.sun, g(P.sun, 1), o * 0.5);
  const diffuse = 1 + 0.25 * o - 0.25 * r;
  P.skyAmb = mix3(P.skyAmb, g(P.skyAmb, 1.15), o * 0.75).map((v) => v * diffuse);
  P.groundAmb = mix3(P.groundAmb, g(P.groundAmb, 1.0), o * 0.6).map((v) => v * (1 - 0.15 * r));
  P.zenith = mix3(P.zenith, g(P.horizon, 0.72 - 0.25 * r), o * 0.92);
  P.horizon = mix3(P.horizon, g(P.horizon, 0.95 - 0.25 * r), o * 0.85);
  P.sunGlow = P.sunGlow.map((v) => v * (1 - 0.8 * o));
  for (const k of ['cloudLit', 'cloudMid', 'cloudShade']) P[k] = mix3(P[k], g(P[k], 0.85 - 0.3 * r), o * 0.8);
  P.cloudRim = P.cloudRim.map((v) => v * (1 - 0.75 * o));
  P.rim = P.rim.map((v) => v * (1 - 0.7 * o));
  P.shadeMix *= 1 - 0.5 * o;
  P.sat *= 1 - 0.14 * o - 0.08 * r;
  P.exposure *= 1 + 0.16 * o - 0.08 * r;
  P.shadowRadius += 6 * o;
  P.cloudShadow *= (1 - smooth(0.6, 0.95, o)) * (0.4 + 0.8 * w.cover);
  P.bloom *= 1 - 0.4 * o;
  // ---- the air: humidity, rain and fog thicken it
  P.air *= 1 + 2.4 * w.haze + 1.5 * r;
  P.mist = clamp(P.mist + 0.25 * w.haze + 0.2 * r + 0.6 * w.fog, 0, 0.9);
  P.depthTint = clamp(P.depthTint + 0.15 * w.haze, 0, 0.8);
  return { ...P, dir, direct, night, lamps: clamp(night * 1.1 + o * 0.15 * smooth(-2, 10, -sun.alt + 8)), sunAlt: sun.alt, moonAlt: moon.alt };
}

// ---------------------------------------------------------------- words
export function weatherName(raw) {
  const c = raw.code ?? 0, mm = raw.precip || 0;
  if (c >= 95) return '雷阵雨';
  if (c === 45 || c === 48) return '雾';
  if (mm >= 8) return '大雨';
  if (mm >= 2.5) return c >= 80 ? '阵雨' : '中雨';
  if (mm >= 0.1 || (c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return c >= 51 && c <= 57 ? '毛毛雨' : c >= 80 ? '阵雨' : '小雨';
  const cl = raw.cloud ?? 0;
  if (cl >= 88) return '阴';
  if (cl >= 45) return '多云';
  if (cl >= 18) return '晴间多云';
  return '晴';
}
const BEAUFORT = [0.3, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7];
const WIND_WORDS = ['无风', '软风', '轻风', '微风', '和风', '清风', '强风', '疾风', '大风', '烈风', '狂风', '暴风', '飓风'];
export function windName(ms) { let b = 0; while (b < BEAUFORT.length && ms >= BEAUFORT[b]) b++; return { force: b, word: WIND_WORDS[b] }; }
const DIRS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
export function fromName(deg) { return DIRS[Math.round(((deg % 360) + 360) % 360 / 45) % 8]; }
