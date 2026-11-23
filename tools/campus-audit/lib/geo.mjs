// Geodesy for a campus-sized area. Pure functions.
//
// GCJ-02 is the obfuscated datum used by Amap / Tencent maps in mainland China.
// The forward WGS84 → GCJ-02 formula below is the widely published one
// (e.g. the open-source "eviltransform" / coordtransform implementations);
// the inverse is solved iteratively and is accurate to well under a metre.

const A = 6378245.0, EE = 0.00669342162296594323;
const R_EARTH = 6378137;

function tLat(x, y) {
  let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
  r += (20 * Math.sin(y * Math.PI) + 40 * Math.sin(y / 3 * Math.PI)) * 2 / 3;
  r += (160 * Math.sin(y / 12 * Math.PI) + 320 * Math.sin(y * Math.PI / 30)) * 2 / 3;
  return r;
}
function tLon(x, y) {
  let r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
  r += (20 * Math.sin(x * Math.PI) + 40 * Math.sin(x / 3 * Math.PI)) * 2 / 3;
  r += (150 * Math.sin(x / 12 * Math.PI) + 300 * Math.sin(x / 30 * Math.PI)) * 2 / 3;
  return r;
}

/** WGS84 → GCJ-02 ([lat, lon] in degrees). */
export function wgsToGcj([lat, lon]) {
  const x = lon - 105, y = lat - 35;
  let dLat = tLat(x, y), dLon = tLon(x, y);
  const rad = lat / 180 * Math.PI;
  let magic = Math.sin(rad); magic = 1 - EE * magic * magic;
  const sq = Math.sqrt(magic);
  dLat = (dLat * 180) / ((A * (1 - EE)) / (magic * sq) * Math.PI);
  dLon = (dLon * 180) / (A / sq * Math.cos(rad) * Math.PI);
  return [lat + dLat, lon + dLon];
}

/** GCJ-02 → WGS84 by fixed-point iteration. */
export function gcjToWgs([lat, lon]) {
  let w = [lat, lon];
  for (let i = 0; i < 30; i++) {
    const g = wgsToGcj(w);
    const d = [lat - g[0], lon - g[1]];
    w = [w[0] + d[0], w[1] + d[1]];
    if (Math.abs(d[0]) < 1e-10 && Math.abs(d[1]) < 1e-10) break;
  }
  return w;
}

/** Local east/north metres of `p` relative to `origin` (equirectangular, fine for < 2 km). */
export function enu(origin, p) {
  const k = Math.PI / 180;
  return { e: (p[1] - origin[1]) * k * R_EARTH * Math.cos(origin[0] * k), n: (p[0] - origin[0]) * k * R_EARTH };
}

/** Great-circle distance in metres (haversine). */
export function distance(a, b) {
  const k = Math.PI / 180, dLat = (b[0] - a[0]) * k, dLon = (b[1] - a[1]) * k;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * k) * Math.cos(b[0] * k) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(h));
}

/** Bearing in degrees clockwise from true north, for a local east/north vector. */
export const bearingOf = (e, n) => ((Math.atan2(e, n) * 180) / Math.PI + 360) % 360;

/** Web Mercator (EPSG:3857) metres → [lat, lon]. */
export function mercToLatLon(x, y) {
  return [(Math.atan(Math.exp(y / R_EARTH)) * 2 - Math.PI / 2) * 180 / Math.PI, (x / R_EARTH) * 180 / Math.PI];
}
/** [lat, lon] → Web Mercator metres. */
export function latLonToMerc([lat, lon]) {
  const k = Math.PI / 180;
  return [R_EARTH * lon * k, R_EARTH * Math.log(Math.tan(Math.PI / 4 + (lat * k) / 2))];
}

/**
 * Pixel (u, v) of a north-up Web Mercator image with bounds [x0, y0, x1, y1] and size px×px
 * → ground east/north metres from the image centre. Mercator metres are divided by sec(lat)
 * to give true ground metres (≈ ×0.94 at Haikou).
 */
export function imagePixelToGround(u, v, bounds, px) {
  const [x0, y0, x1, y1] = bounds;
  const mx = x0 + (u / px) * (x1 - x0), my = y1 - (v / px) * (y1 - y0);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const lat = mercToLatLon(cx, cy)[0];
  const k = Math.cos((lat * Math.PI) / 180);
  return { e: (mx - cx) * k, n: (my - cy) * k, lat, metresPerPixel: ((x1 - x0) / px) * k };
}
