/**
 * HAIZ · World Reconstruction — Canonical Coordinate System & Georeference Bridge
 *
 * Frame ID: HAIZ-ENU-2026
 *   - Spec / Blender space: right-handed metric (X = campus east, Y = campus north toward North Gate, Z = up)
 *   - Three.js / glTF space: right-handed metric (x = spec_x, y = spec_z, z = -spec_y)
 *     -> +X = campus east, +Y = up, -Z = campus north (toward North Gate), +Z = campus south
 *   - WGS84 Origin: 19.99847892 N, 110.34254843 E (Teaching Block 1 portal front axis, provisional)
 *   - Campus North Bearing: 319.0 deg true (41.0 deg CCW from true north)
 */

export const FRAME = Object.freeze({
  id: 'HAIZ-ENU-2026',
  originLat: 19.99847892,
  originLon: 110.34254843,
  northBearingDeg: 319.0,
  ccwFromTrueNorthDeg: 41.0,
  legacyTreePivotSpec: Object.freeze([38.91, 17.67]),
  legacyGroundY: -0.85,
  datumRoadZ: 0.0,
  datumLawnZ: 0.15,
  datumPlazaZ: 0.60,
  datumYihaoFloorZ: 1.05,
});

const DEG = Math.PI / 180;
const METERS_PER_DEG_LAT = 110704.0; // WGS84 at 20.0 deg N
const METERS_PER_DEG_LON = 104647.0; // WGS84 at 20.0 deg N

/** Spec/Blender [x, y, z] -> Three.js [x, y, z] */
export function specToThree(sx, sy, sz = 0) {
  return [sx, sz, -sy];
}

/** Three.js [x, y, z] -> Spec/Blender [x, y, z] */
export function threeToSpec(tx, ty, tz) {
  return [tx, -tz, ty];
}

/** Spec/Blender (sx, sy) -> True ENU (east_m, north_m) */
export function specToTrueENU(sx, sy) {
  const th = FRAME.ccwFromTrueNorthDeg * DEG;
  const c = Math.cos(th);
  const s = Math.sin(th);
  // Campus north is rotated +41 deg CCW from true north => campus axes rotated +41 deg CCW relative to ENU
  return {
    east: sx * c - sy * s,
    north: sx * s + sy * c,
  };
}

/** True ENU (east_m, north_m) -> Spec/Blender (sx, sy) */
export function trueENUToSpec(east, north) {
  const th = -FRAME.ccwFromTrueNorthDeg * DEG;
  const c = Math.cos(th);
  const s = Math.sin(th);
  return {
    x: east * c - north * s,
    y: east * s + north * c,
  };
}

/** Spec/Blender (sx, sy) -> approximate WGS84 { lat, lon } */
export function specToWGS84(sx, sy) {
  const enu = specToTrueENU(sx, sy);
  return {
    lat: FRAME.originLat + enu.north / METERS_PER_DEG_LAT,
    lon: FRAME.originLon + enu.east / METERS_PER_DEG_LON,
  };
}

/** WGS84 (lat, lon) -> Spec/Blender { x, y } */
export function wgs84ToSpec(lat, lon) {
  const north = (lat - FRAME.originLat) * METERS_PER_DEG_LAT;
  const east = (lon - FRAME.originLon) * METERS_PER_DEG_LON;
  return trueENUToSpec(east, north);
}

/** Convert legacy lanren/V4 world coordinates (tree-pivoted, y=-0.85) -> Three.js HAIZ-ENU-2026 */
export function legacyWorldToThree(lx, ly, lz) {
  const [px, py] = FRAME.legacyTreePivotSpec;
  const sx = lx + px;
  const sy = py - lz;
  const sz = ly - FRAME.legacyGroundY;
  return specToThree(sx, sy, sz);
}

/** Convert Three.js HAIZ-ENU-2026 -> legacy lanren/V4 world coordinates */
export function threeToLegacyWorld(tx, ty, tz) {
  const [sx, sy, sz] = threeToSpec(tx, ty, tz);
  const [px, py] = FRAME.legacyTreePivotSpec;
  return [sx - px, sz + FRAME.legacyGroundY, py - sy];
}

/** Convert true solar altitude (rad) & azimuth bearing (deg clockwise from true north) to Three.js unit vector */
export function skyBearingToThreeDir(altRad, bearingDeg) {
  const rel = (bearingDeg - FRAME.northBearingDeg) * DEG;
  const ca = Math.cos(altRad);
  return [Math.sin(rel) * ca, Math.sin(altRad), -Math.cos(rel) * ca];
}
