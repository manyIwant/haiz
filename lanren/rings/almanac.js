// 年轮 · what one day does to the tree.
//
// (date, hour, that day's weather row) → everything the scene needs: the leaves'
// place in the year, where the sun and the moon stand over the campus, the colour
// of the sky, wind and rain. Pure (no DOM, no three.js): tested in Node.
//
// What is computed and what is read:
//   sun, moon      low-precision ephemerides (Astronomical Algorithms / SunCalc),
//                  good to a fraction of a degree: computed for any date
//   weather        ERA5 reanalysis, one row per day (see climate.js): read
//   leaves         lanren/js/season.js, a phenology model for the species: 推演
//   sky colours    art direction keyed to the sun's height (the six shots' own
//                  palette, extended into dusk and night): not a measurement
import { sunPosition, sunVector, SITE, haikouToMs, isLeap, dayOfYearFor } from '../js/sun.js';
import { seasonAt, evalCurve } from '../js/season.js';

const RAD = Math.PI / 180;
const DAY_MS = 86400000;
const J1970 = 2440588, J2000 = 2451545;
const E = RAD * 23.4397;
const toDays = (ms) => ms / DAY_MS - 0.5 + J1970 - J2000;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- moon
const rightAscension = (l, b) => Math.atan2(Math.sin(l) * Math.cos(E) - Math.tan(b) * Math.sin(E), Math.cos(l));
const declination = (l, b) => Math.asin(Math.sin(b) * Math.cos(E) + Math.cos(b) * Math.sin(E) * Math.sin(l));
function sunCoords(d) {
  const M = RAD * (357.5291 + 0.98560028 * d);
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + RAD * 102.9372 + Math.PI;
  return { dec: declination(L, 0), ra: rightAscension(L, 0) };
}
function moonCoords(d) {
  const L = RAD * (218.316 + 13.176396 * d), M = RAD * (134.963 + 13.064993 * d), F = RAD * (93.272 + 13.229350 * d);
  const l = L + RAD * 6.289 * Math.sin(M), b = RAD * 5.128 * Math.sin(F);
  return { ra: rightAscension(l, b), dec: declination(l, b), dist: 385001 - 20905 * Math.cos(M) };
}

/** { altitude (rad), bearing (deg from north), fraction lit 0..1, phase 0..1 (0 new, 0.5 full), name } */
export function moonAt(ms, lat = SITE.lat, lon = SITE.lon) {
  const d = toDays(ms), c = moonCoords(d), s = sunCoords(d);
  const phi = RAD * lat, H = RAD * (280.16 + 360.9856235 * d) + RAD * lon - c.ra;
  let altitude = Math.asin(Math.sin(phi) * Math.sin(c.dec) + Math.cos(phi) * Math.cos(c.dec) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(c.dec) * Math.cos(phi));
  // parallax: the moon is close enough that the observer's place on the globe lowers it
  altitude -= Math.asin(6378.14 / c.dist) * Math.cos(altitude);
  let bearing = (az / RAD + 180) % 360;
  if (bearing < 0) bearing += 360;
  const SD = 149598000;
  const elong = Math.acos(Math.sin(s.dec) * Math.sin(c.dec) + Math.cos(s.dec) * Math.cos(c.dec) * Math.cos(s.ra - c.ra));
  const inc = Math.atan2(SD * Math.sin(elong), c.dist - SD * Math.cos(elong));
  const angle = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - c.ra), Math.sin(s.dec) * Math.cos(c.dec) - Math.cos(s.dec) * Math.sin(c.dec) * Math.cos(s.ra - c.ra));
  const fraction = (1 + Math.cos(inc)) / 2;
  const phase = 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / Math.PI;
  return { altitude, bearing, fraction, phase, name: phaseName(phase) };
}

export function phaseName(phase) {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.03 || p > 0.97) return '新月';
  if (p < 0.22) return '蛾眉月';
  if (p < 0.28) return '上弦月';
  if (p < 0.47) return '盈凸月';
  if (p < 0.53) return '满月';
  if (p < 0.72) return '亏凸月';
  if (p < 0.78) return '下弦月';
  return '残月';
}

// ---------------------------------------------------------------- the calendar day
export const msOf = (y, m, d, minutes = 720) => haikouToMs(y, dayOfYearFor(m, d) + (m > 2 && isLeap(y) ? 1 : 0), minutes);

/** sunrise and sunset in minutes after Haikou midnight (the sun's upper limb on the horizon) */
export function sunTimes(y, m, d) {
  const h0 = -0.833 * RAD, t0 = msOf(y, m, d, 0);
  const alt = (min) => sunPosition(t0 + min * 60000).altitude - h0;
  let rise = null, set = null, prev = alt(0);
  for (let min = 4; min <= 1440; min += 4) {
    const cur = alt(min);
    if (prev < 0 && cur >= 0) rise = min - 4 + (4 * -prev) / (cur - prev);
    if (prev >= 0 && cur < 0) set = min - 4 + (4 * prev) / (prev - cur);
    prev = cur;
  }
  return { rise, set };
}

// ---------------------------------------------------------------- words for the weather
const BEAUFORT = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118, 134, 150, 167, 184, 202];
export const beaufort = (kmh) => { let b = 0; while (b < BEAUFORT.length && kmh >= BEAUFORT[b]) b++; return b; };
const DIRS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
export const windName = (deg) => (deg == null ? '' : DIRS[Math.round((((deg % 360) + 360) % 360) / 45) % 8] + '风');
/** 24-hour rainfall grade (China Meteorological Administration classes) */
export function rainName(mm) {
  if (mm == null) return '';
  if (mm < 0.1) return '';
  if (mm < 10) return '小雨';
  if (mm < 25) return '中雨';
  if (mm < 50) return '大雨';
  if (mm < 100) return '暴雨';
  if (mm < 250) return '大暴雨';
  return '特大暴雨';
}
export function skyName(row) {
  const rain = rainName(row.rain);
  if (rain) return rain;
  if (row.cloud == null) return '';
  return row.cloud < 20 ? '晴' : row.cloud < 50 ? '少云' : row.cloud < 85 ? '多云' : '阴';
}
/** one line for a day: 「大暴雨 187.4 mm · 25–29°C · 东北风 9 级，阵风 12 级」 */
export function describeDay(row) {
  if (!row || row.tmax == null) return '这一天没有数据';
  const parts = [];
  const rain = rainName(row.rain);
  parts.push(rain ? `${rain} ${row.rain.toFixed(1)} mm` : skyName(row));
  parts.push(`${Math.round(row.tmin)}–${Math.round(row.tmax)}°C`);
  if (row.wind != null) {
    const b = beaufort(row.wind), g = row.gust == null ? 0 : beaufort(row.gust);
    parts.push(`${windName(row.dir)} ${b} 级${g >= 7 && g > b ? `，阵风 ${g} 级` : ''}`.trim());
  }
  return parts.filter(Boolean).join(' · ');
}

// ---------------------------------------------------------------- sky, keyed to the sun's height
// 5°, 16° and 35° are V4's own dawn, morning and full-day palettes (lanren/js/chapters.js LIGHT).
const SKY = [
  { a: -18, sunCol: [0.55, 0.66, 1.0], I: 0, zenith: [0.004, 0.008, 0.024], horizon: [0.014, 0.024, 0.052], glow: [0.03, 0.045, 0.09],
    fog: [0.012, 0.02, 0.042], density: 0.0014, mist: 0.05, rays: 0, exposure: 1.7, warm: 0.15, sat: 0.92, contrast: 1.04 },
  { a: -8, sunCol: [0.7, 0.6, 0.8], I: 0.05, zenith: [0.012, 0.026, 0.08], horizon: [0.07, 0.075, 0.16], glow: [0.22, 0.14, 0.18],
    fog: [0.05, 0.055, 0.11], density: 0.0014, mist: 0.06, rays: 0, exposure: 1.45, warm: 0.2, sat: 0.95, contrast: 1.04 },
  { a: -2.5, sunCol: [1.0, 0.5, 0.3], I: 0.5, zenith: [0.06, 0.10, 0.25], horizon: [0.70, 0.38, 0.28], glow: [1.25, 0.52, 0.26],
    fog: [0.46, 0.32, 0.30], density: 0.0014, mist: 0.07, rays: 0.2, exposure: 1.04, warm: 0.7, sat: 1.04, contrast: 1.05 },
  { a: 5, sunCol: [1.0, 0.70, 0.42], I: 2.9, zenith: [0.13, 0.17, 0.30], horizon: [0.92, 0.60, 0.36], glow: [1.5, 0.78, 0.36],
    fog: [0.78, 0.56, 0.40], density: 0.0013, mist: 0.07, rays: 0.6, exposure: 0.92, warm: 0.8, sat: 1.08, contrast: 1.06 },
  { a: 16, sunCol: [1.0, 0.80, 0.55], I: 4.3, zenith: [0.09, 0.18, 0.42], horizon: [0.72, 0.66, 0.58], glow: [1.3, 0.85, 0.47],
    fog: [0.60, 0.57, 0.52], density: 0.0011, mist: 0.03, rays: 0.5, exposure: 0.9, warm: 0.7, sat: 1.1, contrast: 1.08 },
  { a: 35, sunCol: [1.0, 0.9, 0.72], I: 5.6, zenith: [0.025, 0.11, 0.46], horizon: [0.36, 0.54, 0.80], glow: [0.95, 0.8, 0.6],
    fog: [0.42, 0.56, 0.74], density: 0.0010, mist: 0.03, rays: 0, exposure: 1.08, warm: 0.55, sat: 1.16, contrast: 1.12 },
  { a: 90, sunCol: [1.0, 0.94, 0.82], I: 6.0, zenith: [0.02, 0.10, 0.46], horizon: [0.34, 0.53, 0.82], glow: [0.9, 0.82, 0.66],
    fog: [0.42, 0.56, 0.76], density: 0.0010, mist: 0.02, rays: 0, exposure: 1.02, warm: 0.5, sat: 1.16, contrast: 1.12 }
];
function skyAt(altDeg) {
  const a = clamp(altDeg, SKY[0].a, SKY[SKY.length - 1].a);
  let i = 0;
  while (i < SKY.length - 2 && a > SKY[i + 1].a) i++;
  const A = SKY[i], B = SKY[i + 1], t = smooth(A.a, B.a, a);
  const out = {};
  for (const k of Object.keys(A)) if (k !== 'a') out[k] = Array.isArray(A[k]) ? mix3(A[k], B[k], t) : lerp(A[k], B[k], t);
  return out;
}

// a year of ground cover for the island (grass, moss, young shoots): low in the dry winter, full in the rains
const K = (m, d) => dayOfYearFor(m, d);
const LUSH = [[K(1, 1), 0.42], [K(2, 20), 0.3], [K(5, 1), 1], [K(10, 20), 1], [K(12, 31), 0.42]];

const azOf = (v) => Math.atan2(v[0], v[2]) / RAD;   // scene azimuth as chapters.js LIGHT uses it

/**
 * The stage for one moment of one day.
 * @param {{y:number,m:number,d:number,minutes:number}} when Haikou calendar date and wall clock
 * @param {object|null} row climate row for the date (null: no data, a clear calm day is assumed and flagged)
 */
export function stageFor(when, row) {
  const { y, m, d, minutes } = when;
  const ms = msOf(y, m, d, minutes);
  const yearDays = isLeap(y) ? 366 : 365;
  const doy = dayOfYearFor(m, d) + (m > 2 && isLeap(y) ? 1 : 0) + minutes / 1440;
  const season = seasonAt(doy, yearDays);
  const sun = sunPosition(ms);
  const moon = moonAt(ms);
  const sunAlt = sun.altitude / RAD, moonAlt = moon.altitude / RAD;

  // ---- weather of the day (daily values: the same all day long)
  const has = !!row && row.tmax != null;
  const cloud = has && row.cloud != null ? row.cloud / 100 : 0.3;
  const mm = has && row.rain != null ? row.rain : 0;
  const rain = mm < 1 ? 0 : clamp(Math.log1p(mm) / Math.log1p(120), 0.12, 1);
  const windK = has && row.wind != null ? row.wind : 12;
  const gustK = has && row.gust != null ? row.gust : windK * 1.5;
  const overcast = clamp(Math.pow(cloud, 1.4) * 0.85 + rain * 0.6);
  const storm = clamp((gustK - 60) / 60);

  // ---- light: the sun by day, the moon by night
  const L = skyAt(sunAlt);
  const night = 1 - smooth(-9, -2, sunAlt);
  const moonUp = smooth(-1, 6, moonAlt);
  const moonLight = night * moonUp * (0.25 + 0.75 * moon.fraction);
  let dir, sunEl;
  if (sunAlt > -4) {
    dir = sunVector(Math.max(sun.altitude, 2 * RAD), sun.bearing);
    sunEl = Math.max(2, sunAlt);
    L.disc = sunAlt > -1 ? 1 : 0;
  } else if (moonLight * (1 - overcast) > 0.12) {
    // a moonlit night: the moon is the lamp, and its disc is in the sky where it stood
    dir = sunVector(Math.max(moon.altitude, 3 * RAD), moon.bearing);
    sunEl = Math.max(3, moonAlt);
    L.sunCol = [0.56, 0.68, 1.0];
    L.I = 0.5 + 1.5 * moonLight;
    L.glow = mix3(L.glow, [0.10, 0.14, 0.24], moonLight);
    L.zenith = mix3(L.zenith, [0.010, 0.019, 0.05], moonLight * 0.8);
    L.horizon = mix3(L.horizon, [0.034, 0.055, 0.11], moonLight * 0.8);
    L.disc = 0.25 + 0.75 * moon.fraction;
  } else {
    // no moon to see: what is left is the glow of a city night, from overhead (more of it under cloud)
    const el = 66 * RAD, az = 205 * RAD;
    dir = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
    sunEl = 66;
    L.sunCol = [0.50, 0.58, 0.86];
    L.I = 0.55 + 0.5 * overcast;
    L.nightGlow = true;
    L.disc = 0;
  }
  // a true vector to the lamp for anything that draws it (below the horizon included)
  L.sunAz = azOf(dir);
  L.sunEl = sunEl;

  // ---- cloud and rain take the colour out of the sky and the edge off the light
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const grey = (c, k) => { const l = lum(c) * k; return [l * 0.94, l * 0.98, l * 1.04]; };
  L.zenith = mix3(L.zenith, grey(L.horizon, 0.62 - 0.22 * rain), overcast * 0.9);
  L.horizon = mix3(L.horizon, grey(L.horizon, 0.86 - 0.28 * rain), overcast * 0.85);
  L.glow = L.glow.map((v) => v * (1 - 0.82 * overcast));
  L.fog = mix3(L.fog, grey(L.horizon, 1.0), overcast * 0.8);
  L.sunCol = mix3(L.sunCol, grey(L.sunCol, 1), overcast * 0.6);
  L.disc *= 1 - smooth(0.55, 0.9, overcast);
  if (!L.nightGlow) L.I *= 1 - 0.86 * Math.pow(overcast, 1.5);
  delete L.nightGlow;
  L.rays *= 1 - overcast;
  L.density += rain * 0.0042 + storm * 0.003;
  L.mist += rain * 0.16 + overcast * 0.03;
  L.exposure *= 1 - 0.10 * overcast;
  L.sat *= 1 - 0.3 * overcast;
  L.contrast *= 1 - 0.07 * overcast;
  L.warm *= 1 - 0.6 * overcast;
  L.cloud = 0.12 + cloud * 1.3 + rain * 0.3;
  // how brightly the cloud tops are lit: full by day, a little under a moon, heavy and dark in a storm
  L.cloudLit = (0.035 + 0.965 * smooth(-7, 8, sunAlt) + moonLight * 0.07) * (1 - 0.5 * rain) * (1 - 0.25 * storm);
  L.aperture = 0; L.focus = 0;

  // ---- wind: where it blows to, in the scene's frame (-Z is campus north)
  const from = has && row.dir != null ? row.dir : 60;
  const rel = (from + 180 - SITE.campusNorthBearing) * RAD;
  const windDir = [Math.sin(rel), 0, -Math.cos(rel)];
  const wind = clamp(0.06 + windK / 46 + storm * 0.35, 0.06, 1.75);

  return {
    ms, doy, season, has,
    leaf: { turn: season.turn, flushG: 0.15 + 0.85 * season.flush, lush: evalCurve(LUSH, doy, yearDays) },
    L, night, stars: night * (1 - overcast) * (1 - 0.6 * moonLight),
    sun: { altitude: sunAlt, bearing: sun.bearing }, moon: { altitude: moonAlt, bearing: moon.bearing, fraction: moon.fraction, phase: moon.phase, name: moon.name },
    weather: { rain, mm, cloud, overcast, storm, wind, gust: gustK, windDir, tmax: has ? row.tmax : null, tmin: has ? row.tmin : null }
  };
}
