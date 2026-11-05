// Solar position for the Fucheng campus of Hainan Middle School, Haikou.
// Formulae: the widely used low-precision ephemeris (as in Astronomical
// Algorithms / SunCalc), accurate to well under a degree — enough for light.
// Pure module: no DOM, testable in Node.

export const SITE = Object.freeze({
  lat: 19.996067,     // campus anchor from assets/walk/campus.json
  lon: 110.347227,
  tzOffsetHours: 8,   // Asia/Shanghai, no daylight saving
  // Bearing of the campus "north" axis (towards the North Gate), estimated from
  // the two geographic anchors in assets/walk/campus.json (centre → south gate
  // bearing ≈ 157°). Treated as approximate; the project notes that absolute
  // orientation still awaits the original KML.
  campusNorthBearing: 337
});

const RAD = Math.PI / 180;
const DAY_MS = 86400000;
const J1970 = 2440588;
const J2000 = 2451545;
const OBLIQUITY = RAD * 23.4397;

function toDays(ms) { return ms / DAY_MS - 0.5 + J1970 - J2000; }

export function sunPosition(ms, lat = SITE.lat, lon = SITE.lon) {
  const d = toDays(ms);
  const M = RAD * (357.5291 + 0.98560028 * d);
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + RAD * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(OBLIQUITY) * Math.sin(L));
  const ra = Math.atan2(Math.sin(L) * Math.cos(OBLIQUITY), Math.cos(L));
  const lw = RAD * -lon;
  const phi = RAD * lat;
  const th = RAD * (280.16 + 360.9856235 * d) - lw;
  const H = th - ra;
  const altitude = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const azSouth = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  let bearing = (azSouth / RAD + 180) % 360;
  if (bearing < 0) bearing += 360;
  return { altitude, bearing, declination: dec };
}

// Unit vector towards the sun in the scene frame:
// +X campus east (along the No.1 building), +Y up, -Z campus north.
export function sunVector(altitude, bearing, northBearing = SITE.campusNorthBearing) {
  const rel = (bearing - northBearing) * RAD;
  const c = Math.cos(altitude);
  return [Math.sin(rel) * c, Math.sin(altitude), -Math.cos(rel) * c];
}

// ---- Haikou wall-clock helpers (independent of the viewer's own time zone)
export function haikouParts(ms) {
  const t = new Date(ms + SITE.tzOffsetHours * 3600000);
  const year = t.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const dayOfYear = Math.floor((t.getTime() - start) / DAY_MS) + 1;
  const minutes = t.getUTCHours() * 60 + t.getUTCMinutes() + t.getUTCSeconds() / 60;
  return {
    year, month: t.getUTCMonth() + 1, day: t.getUTCDate(), weekday: t.getUTCDay(),
    hour: t.getUTCHours(), minute: t.getUTCMinutes(), dayOfYear, minutes,
    yearDays: isLeap(year) ? 366 : 365
  };
}

export function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }

// Inverse: a Haikou day-of-year + minutes since midnight → epoch ms
export function haikouToMs(year, dayOfYear, minutes) {
  return Date.UTC(year, 0, 1) + (dayOfYear - 1) * DAY_MS + minutes * 60000 - SITE.tzOffsetHours * 3600000;
}

const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
export function dayOfYearFor(month, day) { return MONTH_START[month - 1] + day; }
export function monthDayOf(doy) {
  let m = 11;
  while (m > 0 && MONTH_START[m] >= doy) m--;
  return { month: m + 1, day: Math.round(doy - MONTH_START[m]) };
}

export function formatClock(minutes) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  return `${h}:${mm}`;
}

export function partOfDay(minutes, altitudeDeg) {
  const h = minutes / 60;
  if (altitudeDeg < -6) return h < 12 ? '凌晨' : '夜里';
  if (altitudeDeg < 0) return h < 12 ? '破晓' : '薄暮';
  if (h < 9) return '清晨';
  if (h < 11.5) return '上午';
  if (h < 13.5) return '正午';
  if (h < 17) return '下午';
  return '傍晚';
}
