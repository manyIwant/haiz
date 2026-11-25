// HAIZ World Engine — Canonical Spatial Coordinate & Provenance Bridge
//
// Solves HAIZ's historical coordinate fragmentation by making every frame conversion
// explicit, lossless, and evidence-tagged:
//   1. `wgs84`   — Real geographic coordinates (EPSG:4326) anchored at Teaching Block 1 portal
//                  (twin/data/frame.json: 19.99847892°N, 110.34254843°E)
//   2. `twin`    — Photo-calibrated campus metric frame (metres; origin = yihao front portal,
//                  campus north bearing = 319.0° true, +Y up in glTF / +Z up in Blender)
//   3. `runtime` — Current 3D campus runtime frame (metres; origin = 百年榄仁树 lanshu root,
//                  ground = -0.85 m, -Z = campus north, Y up)
//
// Discrepancies between legacy `campus.json` / `sun.js` and photo-calibrated `twin/data/*`
// are documented honestly here rather than silently papered over.

export const CANONICAL_DATUM = Object.freeze({
  schema: 'haiz-spatial-datum/1',
  name: '海南中学府城校区（主轴校准基准）',
  originName: '一号教学楼正门门廊中心（地面）',
  wgs84: Object.freeze({ lat: 19.99847892, lon: 110.34254843 }),
  campusNorthBearingDeg: 319.0,       // twin/data/frame.json (anticlockwise 41.0° from true north)
  legacyNorthBearingDeg: 337.0,       // lanren/js/sun.js (18.0° discrepancy documented)
  weatherNorthBearingDeg: 321.6,      // lanren/ruhua/weather/model.js (2.6° discrepancy)
  groundY: -0.85,                     // shared runtime water/ground datum
  atelierOriginInRuntime: Object.freeze([38.91, -17.67]), // twin origin (yihao portal) in runtime (lanshu=0,0)
  provenance: 'photo-derived-provisional',
});

export const EVIDENCE_LEVELS = Object.freeze({
  surveyed: { label: '实测数据', tone: 'verified', note: '经实地测绘或权威测绘成果核验' },
  'photo-derived': { label: '影像校准', tone: 'calibrated', note: '由多视角校园实景照片与轮廓反算校准（twin/atelier）' },
  'public-map': { label: '公开图源', tone: 'public', note: '来自 OpenStreetMap / Overture Maps 公开建筑轮廓' },
  'legacy-estimated': { label: '历史近似', tone: 'approx', note: '来自早期手图与 campus.json 近似尺度，非工程测绘' },
  'creative-inference': { label: '艺术推演', tone: 'creative', note: '在缺乏实测资料时做的审美与空间推测，明确区分于真实测绘' },
});

const EARTH_R = 6378137.0;
const DEG2RAD = Math.PI / 180;

/** Convert runtime campus (x, z) metres (origin = lanshu, -Z = campus north) → twin (x, z) metres (origin = yihao portal) */
export function runtimeToTwin(rx, rz) {
  const [ox, oz] = CANONICAL_DATUM.atelierOriginInRuntime;
  return { x: rx - ox, z: rz - oz };
}

/** Convert twin (x, z) metres → runtime campus (x, z) metres */
export function twinToRuntime(tx, tz) {
  const [ox, oz] = CANONICAL_DATUM.atelierOriginInRuntime;
  return { x: tx + ox, z: tz + oz };
}

/** Approximate local tangent-plane conversion: runtime (x, z) → WGS84 { lat, lon } */
export function runtimeToWgs84(rx, rz) {
  const { x: tx, z: tz } = runtimeToTwin(rx, rz);
  // Campus north = -tz; Campus east = +tx
  const cNorth = -tz;
  const cEast = tx;
  const theta = (360 - CANONICAL_DATUM.campusNorthBearingDeg) * DEG2RAD; // 41.0° anticlockwise from true north
  // True north & east offsets in metres
  const tNorth = cNorth * Math.cos(theta) + cEast * Math.sin(theta);
  const tEast = -cNorth * Math.sin(theta) + cEast * Math.cos(theta);
  const lat0 = CANONICAL_DATUM.wgs84.lat;
  const lon0 = CANONICAL_DATUM.wgs84.lon;
  const dLat = (tNorth / EARTH_R) / DEG2RAD;
  const dLon = (tEast / (EARTH_R * Math.cos(lat0 * DEG2RAD))) / DEG2RAD;
  return { lat: +(lat0 + dLat).toFixed(7), lon: +(lon0 + dLon).toFixed(7) };
}

/** True 3D distance + vertical AGL separation between two world points (fixes 2D broom altitude blindness) */
export function separation3D(a, b) {
  const dx = (a.x ?? 0) - (b.x ?? 0);
  const dy = (a.y ?? 0) - (b.y ?? 0);
  const dz = (a.z ?? 0) - (b.z ?? 0);
  const horiz = Math.hypot(dx, dz);
  const dist3d = Math.hypot(horiz, dy);
  return { dx, dy, dz, horiz, dist3d, verticalGap: Math.abs(dy) };
}

/** Honest structured discrepancy report between legacy HAIZ datasets and photo-calibrated Twin */
export function getSpatialDiscrepancyReport() {
  return [
    {
      id: 'north-bearing',
      severity: 'high',
      title: '校园北向方位角分歧（最大 18.0°）',
      legacy: 'lanren/js/sun.js = 337.0°；weather/model.js = 321.6°',
      canonical: 'twin/data/frame.json = 319.0°（Overture/Esri 校准）',
      resolution: 'World Engine 统一时钟采用 319.0° 校准北向，同时在验收台保留对比读数',
    },
    {
      id: 'datum-offset',
      severity: 'high',
      title: '经纬度坐标系混用（GCJ-02 vs WGS84，偏移约 540 m）',
      legacy: 'campus.json / sun.js 使用 19.996067°N, 110.347227°E（火星坐标）',
      canonical: 'twin/data/frame.json 使用 19.99847892°N, 110.34254843°E（WGS84）',
      resolution: '天文与物理重力公式统一锚定 WGS84 基准',
    },
    {
      id: 'lanshu-yihao-vector',
      severity: 'medium',
      title: '一号楼至百年榄仁树偏移（约 7.9 m）',
      legacy: 'campus.json 相对矢量 (+34.90, -24.50) m',
      canonical: 'twin/atelier 相对矢量 (+38.91, -17.67) m',
      resolution: '运行时通过 ATELIER_ORIGIN 显式配准，后续需整体迁入 twin 基准',
    },
    {
      id: 'taihu-rock',
      severity: 'medium',
      title: '太湖石位置与铭文三版本并存',
      legacy: 'campus.json (-3.7, -25.0) vs tree.json 四字「虎踞龙盘」',
      canonical: 'twin/data/site.json (-0.25, -28.80)，八字铭文「虎踞龍盤捷報頻傳」',
      resolution: '语义图谱明确标注影像校准版本与早期树岛版本差异',
    },
    {
      id: 'yihao-height',
      severity: 'medium',
      title: '一号教学楼层高与体量差异',
      legacy: 'campus.json 近似 5 层 / 19 m',
      canonical: 'twin/data/buildings/yihao.json 影像反算 6–7 层 / ~24.3 m + 坡屋顶',
      resolution: '语义属性卡片标注「影像校准」与「近似体量」双来源说明',
    },
  ];
}
