/**
 * NIANLUN · Chronoscope — Astronomical & Calendar Engine
 * Pure ES Module. Zero dependencies.
 *
 * Provenance:
 * - Gregorian calendar & leap-year rules: exact arithmetic.
 * - Solar position, sunrise/sunset, civil twilight: NOAA Solar Calculation equations (accuracy ~1 min).
 * - Lunar phase & age: Synodic month ephemeris from J2000.0 New Moon epoch (2000-01-06 18:14 UTC).
 * - 24 Solar Terms (二十四节气): Solar ecliptic longitude approximation (accuracy < 1 hour).
 */

export const OBSERVERS = [
  { id: 'haikou', name: '海口 · Haikou', lat: 20.044, lon: 110.199, tz: 8, note: 'HAIZ 原点 · 20.0°N' },
  { id: 'beijing', name: '北京 · Beijing', lat: 39.904, lon: 116.407, tz: 8, note: '39.9°N' },
  { id: 'tokyo', name: '东京 · Tokyo', lat: 35.676, lon: 139.650, tz: 9, note: '35.7°N' },
  { id: 'london', name: '伦敦 · London', lat: 51.507, lon: -0.128, tz: 0, note: '51.5°N' },
  { id: 'newyork', name: '纽约 · New York', lat: 40.713, lon: -74.006, tz: -5, note: '40.7°N' },
  { id: 'reykjavik', name: '雷克雅未克 · Reykjavík', lat: 64.147, lon: -21.943, tz: 0, note: '64.1°N · 高纬极昼夜' },
];

export const WEEKDAYS_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
export const WEEKDAYS_SHORT = ['日', '一', '二', '三', '四', '五', '六'];
export const MONTHS_ZH = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

// 24 Solar Terms ordered from 0° ecliptic longitude (春分 Vernal Equinox)
export const SOLAR_TERMS = [
  { lon: 0, name: '春分', en: 'Vernal Equinox' },
  { lon: 15, name: '清明', en: 'Pure Brightness' },
  { lon: 30, name: '谷雨', en: 'Grain Rain' },
  { lon: 45, name: '立夏', en: 'Start of Summer' },
  { lon: 60, name: '小满', en: 'Grain Buds' },
  { lon: 75, name: '芒种', en: 'Grain in Ear' },
  { lon: 90, name: '夏至', en: 'Summer Solstice' },
  { lon: 105, name: '小暑', en: 'Minor Heat' },
  { lon: 120, name: '大暑', en: 'Major Heat' },
  { lon: 135, name: '立秋', en: 'Start of Autumn' },
  { lon: 150, name: '处暑', en: 'End of Heat' },
  { lon: 165, name: '白露', en: 'White Dew' },
  { lon: 180, name: '秋分', en: 'Autumn Equinox' },
  { lon: 195, name: '寒露', en: 'Cold Dew' },
  { lon: 210, name: '霜降', en: 'Frost Descent' },
  { lon: 225, name: '立冬', en: 'Start of Winter' },
  { lon: 240, name: '小雪', en: 'Minor Snow' },
  { lon: 255, name: '大雪', en: 'Major Snow' },
  { lon: 270, name: '冬至', en: 'Winter Solstice' },
  { lon: 285, name: '小寒', en: 'Minor Cold' },
  { lon: 300, name: '大寒', en: 'Major Cold' },
  { lon: 315, name: '立春', en: 'Start of Spring' },
  { lon: 330, name: '雨水', en: 'Rain Water' },
  { lon: 345, name: '惊蛰', en: 'Awakening of Insects' },
];

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInYear(year) {
  return isLeapYear(year) ? 366 : 365;
}

export function daysInMonth(year, month1to12) {
  const m = ((month1to12 - 1) % 12 + 12) % 12 + 1;
  if (m === 2) return isLeapYear(year) ? 29 : 28;
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

/**
 * Create a UTC-backed civil time object for an observer's timezone offset (hours).
 * Using UTC timestamps internally avoids browser DST quirks when inspecting arbitrary dates/timezones.
 */
export function makeUtcFromObserverLocal(year, month, day, hour = 0, minute = 0, second = 0, tzHours = 8) {
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second) - tzHours * 3600_000;
  return utcMs;
}

export function getObserverLocalParts(utcMs, tzHours = 8) {
  const d = new Date(utcMs + tzHours * 3600_000);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const hour = d.getUTCHours();
  const minute = d.getUTCMinutes();
  const second = d.getUTCSeconds();
  const weekday = d.getUTCDay(); // 0 = Sun ... 6 = Sat
  const startOfYear = Date.UTC(year, 0, 1);
  const currentDayStart = Date.UTC(year, month - 1, day);
  const dayOfYear = Math.floor((currentDayStart - startOfYear) / 86400_000) + 1;
  const minuteOfDay = hour * 60 + minute + second / 60;

  return {
    year, month, day, hour, minute, second,
    weekday,
    dayOfYear,
    daysInThisYear: daysInYear(year),
    daysInThisMonth: daysInMonth(year, month),
    minuteOfDay,
    isoDate: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    hm: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    hms: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`,
  };
}

export function addDaysUtc(utcMs, deltaDays) {
  return utcMs + deltaDays * 86400_000;
}

export function addMinutesUtc(utcMs, deltaMinutes) {
  return utcMs + deltaMinutes * 60_000;
}

export function addMonthsObserver(utcMs, deltaMonths, tzHours = 8) {
  const p = getObserverLocalParts(utcMs, tzHours);
  let totalMonths = (p.year * 12 + (p.month - 1)) + deltaMonths;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = ((totalMonths % 12) + 12) % 12 + 1;
  const maxD = daysInMonth(newYear, newMonth);
  const newDay = Math.min(p.day, maxD);
  return makeUtcFromObserverLocal(newYear, newMonth, newDay, p.hour, p.minute, p.second, tzHours);
}

export function addYearsObserver(utcMs, deltaYears, tzHours = 8) {
  const p = getObserverLocalParts(utcMs, tzHours);
  const newYear = p.year + deltaYears;
  const maxD = daysInMonth(newYear, p.month);
  const newDay = Math.min(p.day, maxD);
  return makeUtcFromObserverLocal(newYear, p.month, newDay, p.hour, p.minute, p.second, tzHours);
}

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export function toJulianDay(utcMs) {
  return utcMs / 86400_000 + 2440587.5;
}

/**
 * Solar ecliptic longitude (degrees 0..360) and declination (degrees)
 */
export function getSolarEphemeris(utcMs) {
  const jd = toJulianDay(utcMs);
  const n = jd - 2451545.0; // days since J2000.0
  const L = ((280.460 + 0.9856474 * n) % 360 + 360) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360 + 360) % 360;
  const gRad = g * RAD;
  const lambda = ((L + 1.915 * Math.sin(gRad) + 0.020 * Math.sin(2 * gRad)) % 360 + 360) % 360;
  const lambdaRad = lambda * RAD;
  const epsilon = (23.439 - 0.0000004 * n) * RAD;

  const sinDec = Math.sin(epsilon) * Math.sin(lambdaRad);
  const decl = Math.asin(sinDec) * DEG;

  const y = Math.tan(epsilon / 2) ** 2;
  const Lrad = L * RAD;
  const eotMin = 4 * DEG * (
    y * Math.sin(2 * Lrad)
    - 2 * 0.01671 * Math.sin(gRad)
    + 4 * 0.01671 * y * Math.sin(gRad) * Math.cos(2 * Lrad)
    - 0.5 * y * y * Math.sin(4 * Lrad)
    - 1.25 * 0.01671 * 0.01671 * Math.sin(2 * gRad)
  );

  return { eclipticLon: lambda, declination: decl, eotMinutes: eotMin };
}

/**
 * Get solar altitude, azimuth, sunrise, sunset, dawn, dusk for an observer on a given UTC timestamp.
 */
export function getSunTimesAndPosition(utcMs, lat, lon, tzHours) {
  const p = getObserverLocalParts(utcMs, tzHours);
  const noonUtc = makeUtcFromObserverLocal(p.year, p.month, p.day, 12, 0, 0, tzHours);
  const ephNoon = getSolarEphemeris(noonUtc);
  const ephNow = getSolarEphemeris(utcMs);

  // Solar noon in minutes from local midnight
  const solarNoonMin = 720 - 4 * lon - ephNoon.eotMinutes + tzHours * 60;

  const calcHourAngleMin = (zenithDeg) => {
    const latRad = lat * RAD;
    const decRad = ephNoon.declination * RAD;
    const cosH = (Math.cos(zenithDeg * RAD) - Math.sin(latRad) * Math.sin(decRad)) /
                 (Math.cos(latRad) * Math.cos(decRad));
    if (cosH > 1) return { polarNight: true, polarDay: false, haMin: 0 };
    if (cosH < -1) return { polarNight: false, polarDay: true, haMin: 720 };
    const haDeg = Math.acos(cosH) * DEG;
    return { polarNight: false, polarDay: false, haMin: haDeg * 4 };
  };

  const riseSet = calcHourAngleMin(90.833);
  const civil = calcHourAngleMin(96.0);

  const sunriseMin = riseSet.polarNight ? null : riseSet.polarDay ? 0 : solarNoonMin - riseSet.haMin;
  const sunsetMin = riseSet.polarNight ? null : riseSet.polarDay ? 1440 : solarNoonMin + riseSet.haMin;
  const dawnMin = civil.polarNight ? null : civil.polarDay ? 0 : solarNoonMin - civil.haMin;
  const duskMin = civil.polarNight ? null : civil.polarDay ? 1440 : solarNoonMin + civil.haMin;

  // Current sun altitude & azimuth
  const trueSolarTimeMin = ((p.minuteOfDay + ephNow.eotMinutes + 4 * lon - 60 * tzHours) % 1440 + 1440) % 1440;
  const hourAngleDeg = trueSolarTimeMin / 4 - 180;
  const haRad = hourAngleDeg * RAD;
  const latRad = lat * RAD;
  const decRad = ephNow.declination * RAD;
  const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * DEG;

  const cosAz = (Math.sin(decRad) - Math.sin(latRad) * sinAlt) / (Math.cos(latRad) * Math.cos(altitude * RAD) || 1e-6);
  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * DEG;
  if (hourAngleDeg > 0) azimuth = 360 - azimuth;

  const dayLengthMin = (sunriseMin !== null && sunsetMin !== null)
    ? Math.max(0, Math.min(1440, sunsetMin - sunriseMin))
    : (riseSet.polarDay ? 1440 : 0);

  return {
    solarNoonMin,
    sunriseMin,
    sunsetMin,
    dawnMin,
    duskMin,
    dayLengthMin,
    polarDay: riseSet.polarDay,
    polarNight: riseSet.polarNight,
    altitude,
    azimuth,
    eclipticLon: ephNow.eclipticLon,
  };
}

export function formatMinutesAsHm(min) {
  if (min === null || min === undefined || Number.isNaN(min)) return '--:--';
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Lunar phase & illumination
 * Epoch: 2000-01-06 18:14 UTC (New Moon)
 */
const SYNODIC_MONTH = 29.530588853;
const NEW_MOON_EPOCH_MS = Date.UTC(2000, 0, 6, 18, 14, 0);

export function getLunarPhase(utcMs) {
  const daysSince = (utcMs - NEW_MOON_EPOCH_MS) / 86400_000;
  const age = ((daysSince % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
  const phase = age / SYNODIC_MONTH; // 0 = New, 0.5 = Full
  const illumination = 0.5 * (1 - Math.cos(2 * Math.PI * phase));

  let name = '新月';
  if (age < 1.845) name = '新月';
  else if (age < 5.536) name = '蛾眉月';
  else if (age < 9.228) name = '上弦月';
  else if (age < 12.919) name = '盈凸月';
  else if (age < 16.611) name = '满月';
  else if (age < 20.302) name = '亏凸月';
  else if (age < 23.993) name = '下弦月';
  else if (age < 27.685) name = '残月';
  else name = '新月';

  // Approximate transit hour (New Moon ~12:00, Full Moon ~00:00)
  const transitMin = ((720 + phase * 1440) % 1440);

  return { age, phase, illumination, name, transitMin };
}

/**
 * Nearest or active Solar Term for a given UTC timestamp
 */
export function getSolarTermInfo(utcMs) {
  const { eclipticLon } = getSolarEphemeris(utcMs);
  let best = SOLAR_TERMS[0];
  let bestDist = 360;
  let current = SOLAR_TERMS[0];

  for (const st of SOLAR_TERMS) {
    const diff = ((eclipticLon - st.lon) + 360) % 360;
    if (diff < 15) current = st;
    const absDiff = Math.min(diff, 360 - diff);
    if (absDiff < bestDist) {
      bestDist = absDiff;
      best = st;
    }
  }
  return {
    current,
    nearest: best,
    isExactDay: bestDist < 0.6,
    eclipticLon,
  };
}

/**
 * Season name from meteorological/astronomical solar longitude
 */
export function getSeasonInfo(utcMs) {
  const { eclipticLon } = getSolarEphemeris(utcMs);
  if (eclipticLon >= 315 || eclipticLon < 45) return { id: 'spring', name: '春 · 生长', color: '#8BB36E' };
  if (eclipticLon >= 45 && eclipticLon < 135) return { id: 'summer', name: '夏 · 繁茂', color: '#D4A359' };
  if (eclipticLon >= 135 && eclipticLon < 225) return { id: 'autumn', name: '秋 · 收敛', color: '#C87944' };
  return { id: 'winter', name: '冬 · 潜藏', color: '#6E8BA8' };
}
