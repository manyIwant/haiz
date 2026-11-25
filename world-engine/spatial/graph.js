// HAIZ World Engine — Semantic Spatial Graph & Unified Navigation Bridge
//
// Turns passive 3D models into a machine-understandable campus world:
//   - Buildings carry floors, entrances, functions, historical memory, evidence provenance,
//     and linked in-world Science Field Stations.
//   - Landmark trees and water bodies (百年榄仁树, 砚池, 太湖石) act as living story witnesses.
//   - Unified navigation bridges `walk`, `wet`, `wheel` (bike/board), and `air` (broom)
//     from ONE shared grid without duplicating A* implementations.

import { CANONICAL_DATUM, EVIDENCE_LEVELS, runtimeToTwin, runtimeToWgs84, separation3D } from './coord.js';

export const SEMANTIC_PLACES = Object.freeze([
  {
    id: 'lanshu',
    name: '百年榄仁树',
    short: '榄仁树',
    kind: 'tree',
    evidence: 'photo-derived',
    position: [0, -0.85, 0],
    approach: [2.5, -0.85, 11.5],
    radius: 16,
    floors: 0,
    eraYear: 1923,
    eraPreset: '1985-11-18',
    purpose: '校园核心地标与历史见证者（坐标原点 0, 0）',
    story: '一号教学楼前庭的老榄仁树，是 HAIZ 六幕叙事与「入画」的起点。每年十一月叶色由翠绿转铜红，在南国校园里记录着四季流转与一代代学生的驻足。',
    evidenceNote: '树冠形态由 V4 程序化叶簇（10,947 枚叶簇）与影像校准树干构成；年代与年轮档案为艺术推演。',
    scienceStation: 'microclimate',
    tags: ['原点', '物候', '入画起点', '微气候站'],
  },
  {
    id: 'yihao',
    name: '一号教学楼',
    short: '一号楼',
    kind: 'building',
    evidence: 'photo-derived',
    position: [-34.9, -0.85, 22.0],
    approach: [-34.9, -0.85, 3.2],
    doors: [[-34.9, 3.2], [-34.9, 39.9], [-93.6, 24.5], [23.8, 24.5]],
    radius: 36,
    floors: 6,
    eraYear: 1952,
    eraPreset: '1952-09-01',
    purpose: '高中部核心教学楼（门廊主轴）',
    story: '坐落于校园中轴线北端，与百年榄仁树隔广场相望。清晨早读声与夜晚晚自习的窗口灯光，构成了府城校区最熟悉的节律。',
    evidenceNote: '外立面由 twin/atelier 实景照片反算校准（中央/翼楼 6–7 层，高约 24.3 m）；室内教室布局未做实测建模。',
    scienceStation: null,
    tags: ['教学', '中轴', '晚自习灯光', '影像校准'],
  },
  {
    id: 'taihu',
    name: '太湖石 · 虎踞龙盘',
    short: '太湖石',
    kind: 'landmark',
    evidence: 'photo-derived',
    position: [-3.6, -0.85, 2.55],
    approach: [-6.5, -0.85, 6.2],
    radius: 10,
    floors: 0,
    eraYear: 1993,
    eraPreset: '1985-11-18',
    purpose: '前庭纪念景石与铭文地标',
    story: '立于一号楼前庭树影旁的太湖石。twin 实景校准记录八字铭文「虎踞龍盤捷報頻傳」，而早期树岛版本刻四字「虎踞龙盘」——引擎诚实保留两份来源的核对记录。',
    evidenceNote: '主轴前庭位置与八字铭文由 twin/data/site.json 照片核对，早期 campus.json 位置存在数米差异。',
    scienceStation: null,
    tags: ['地标', '铭文', '来源核对'],
  },
  {
    id: 'erhao',
    name: '二号教学楼',
    short: '二号楼',
    kind: 'building',
    evidence: 'photo-derived',
    position: [-35.7, -0.85, 71.0],
    approach: [-35.7, -0.85, 58.7],
    doors: [[-35.7, 58.7], [-35.7, 83.3]],
    radius: 32,
    floors: 5,
    eraYear: 1988,
    eraPreset: '2023-06-07',
    purpose: '教学楼（经东西连廊与一号楼相连）',
    story: '与一号教学楼以空中连廊相连。海口突降午后阵雨时，连廊与檐下便成为同学们躲雨、看雨声敲打地面水洼的天然庇护所。',
    evidenceNote: 'twin/atelier 影像校准外立面；连廊可从下方通行与避雨。',
    scienceStation: null,
    tags: ['教学', '连廊避雨', '影像校准'],
  },
  {
    id: 'kexue',
    name: '科学馆实验大楼',
    short: '科学馆',
    kind: 'building',
    evidence: 'photo-derived',
    position: [-32.6, -0.85, 108.0],
    approach: [-32.6, -0.85, 94.9],
    doors: [[-32.6, 94.9]],
    radius: 26,
    floors: 5,
    eraYear: 1998,
    eraPreset: '2023-06-07',
    purpose: '理化生实验室与物理学科教学空间',
    story: '符老师的物理办公室就在科学馆。在这里，我们不再用预排动画冒充物理，而是用海口真实纬度重力（g ≈ 9.7864 m/s²）与四阶龙格-库塔数值积分做非线性单摆实验。',
    evidenceNote: '外立面来自 twin/atelier 校准模型；实验台物理模型由 World Engine 科学内核实时求解。',
    scienceStation: 'pendulum',
    tags: ['科学实验', 'RK4 物理', '符老师'],
  },
  {
    id: 'yanchi',
    name: '砚池',
    short: '砚池',
    kind: 'water',
    evidence: 'photo-derived',
    position: [9.5, -0.85, 140.0],
    approach: [9.5, -0.85, 131.4],
    radius: 22,
    floors: 0,
    eraYear: 1960,
    eraPreset: '1985-11-18',
    purpose: '校园人文水景与光学观测点',
    story: '傍晚的砚池倒映天光与树影。当太阳高度角随统一世界时钟变化，水面反射率按菲涅耳方程急剧抬升——技术与诗意在这里是同一件事。',
    evidenceNote: '池岸由 twin/assets/runtime/yanchi.glb 校准建模；光学实验实时读取世界太阳高度角。',
    scienceStation: 'optics',
    tags: ['水景', '菲涅耳光学', '傍晚倒影'],
  },
  {
    id: 'yishu',
    name: '艺术教育活动中心',
    short: '艺术中心',
    kind: 'building',
    evidence: 'photo-derived',
    position: [-57.4, -0.85, 195.0],
    approach: [-57.4, -0.85, 181.2],
    doors: [[-57.4, 181.2]],
    radius: 28,
    floors: 4,
    eraYear: 2008,
    eraPreset: '2023-06-07',
    purpose: '美术写生、音乐排练与校园艺术展演',
    story: '艺术中心见证了无数节美术课与画架前的写生。在 World Engine 中，你可以随时切换六种艺术观看方式，把整座校园读成水粉、水墨或旧日胶片。',
    evidenceNote: 'twin/assets/runtime/arts.glb 影像校准外立面。',
    scienceStation: null,
    tags: ['艺术', '写生', '画境'],
  },
  {
    id: 'library',
    name: '图书馆',
    short: '图书馆',
    kind: 'building',
    evidence: 'legacy-estimated',
    position: [60.0, -0.85, -14.0],
    approach: [60.0, -0.85, -29.5],
    doors: [[60.0, -25.4]],
    radius: 26,
    floors: 4,
    eraYear: 2003,
    eraPreset: '2023-06-07',
    purpose: '阅览、自习与校园知识档案',
    story: '高三（1）班的王一苇几乎每天午休与周末都会来这里。图书馆南侧小径通向第一食堂，也是校园橘猫最常出没的地带。',
    evidenceNote: '体量来自 campus.json 与 Blender V3 近似模型（尚未完成 twin 级实景摄影校准）。',
    scienceStation: null,
    tags: ['阅览', '知识库', '王一苇'],
  },
  {
    id: 'canteen1',
    name: '第一食堂 · 猫径',
    short: '一食堂',
    kind: 'building',
    evidence: 'legacy-estimated',
    position: [125.7, -0.85, 80.5],
    approach: [95.0, -0.85, 82.0],
    doors: [[125.7, 80.5], [152.9, 88.7]],
    radius: 30,
    floors: 3,
    eraYear: 1995,
    eraPreset: 'live',
    purpose: '师生餐饮与校园橘猫日常领地',
    story: '图书馆以南、第一食堂西侧的开阔小路，是校园橘猫的家。晴天晒太阳，闷热找树荫，午饭点守在食堂门口，下雨便躲到檐下看雨。',
    evidenceNote: '建筑体量为近似模型；橘猫位置与作息为基于海口真实时钟的生态创作。',
    scienceStation: null,
    tags: ['生活', '校园橘猫', '生态'],
  },
  {
    id: 'beimen',
    name: '北门（主校门）',
    short: '北门',
    kind: 'gate',
    evidence: 'photo-derived',
    position: [-35.6, -0.85, -80.0],
    approach: [-35.6, -0.85, -70.5],
    radius: 18,
    floors: 1,
    eraYear: 1923,
    eraPreset: '1952-09-01',
    purpose: '府城校区主入口与迎宾轴线起点',
    story: '从北门步入校园，向南望去便是凤栖堂、衍林堂、百年榄仁树与一号教学楼。校门方向指向校园坐标北向（真北偏西 41°，方位角 319°）。',
    evidenceNote: 'gate.glb 来自 twin/phase1 校准建模；北门外街景为近似背景。',
    scienceStation: null,
    tags: ['校门', '北向基准', '清晨晨光'],
  },
  {
    id: 'track',
    name: '田径场与篮球场',
    short: '操场',
    kind: 'sports',
    evidence: 'public-map',
    position: [-155.0, -0.85, -20.0],
    approach: [-112.5, -0.85, 54.0],
    radius: 48,
    floors: 0,
    eraYear: 1980,
    eraPreset: '2023-06-07',
    purpose: '课间操、田径跑道与校园篮球场',
    story: '陈屿下课常踩着铃声冲向篮球场。宽阔平整的塑胶跑道与球场也是骑单车、蹬滑板、感受微风尾迹最痛快的路段。',
    evidenceNote: '场地位置基于公开地图轮廓与 campus.json 运动区数据。',
    scienceStation: null,
    tags: ['运动', '课间操', '单车与滑板'],
  },
  {
    id: 'botanic',
    name: '校园植物园',
    short: '植物园',
    kind: 'garden',
    evidence: 'creative-inference',
    position: [-155.0, -0.85, 182.0],
    approach: [-148.0, -0.85, 176.0],
    radius: 28,
    floors: 0,
    eraYear: 1978,
    eraPreset: '1985-11-18',
    purpose: '热带植物标本区与写生小径',
    story: '林知夏午饭后常带着速写本走进植物园，吴伯上午也在这里侍弄花木。三角梅与龙船花丛吸引着迁粉蝶、金斑蝶与青凤蝶。',
    evidenceNote: '小径与花丛分布为结合海南校园植物群落的生态艺术推演。',
    scienceStation: null,
    tags: ['植物', '蝴蝶栖息地', '林知夏'],
  },
]);

export function createSpatialGraph({ campus = null, buildingsMeta = null, nav = null, wheelPath = null } = {}) {
  const byId = new Map();
  const buildingLookup = new Map();

  if (Array.isArray(buildingsMeta?.buildings)) {
    for (const b of buildingsMeta.buildings) {
      if (b.id) buildingLookup.set(b.id, b);
    }
  } else if (Array.isArray(buildingsMeta)) {
    for (const b of buildingsMeta) {
      if (b.id) buildingLookup.set(b.id, b);
    }
  }

  const nodes = SEMANTIC_PLACES.map((p) => {
    const ext = buildingLookup.get(p.id);
    const twin = runtimeToTwin(p.position[0], p.position[2]);
    const wgs84 = runtimeToWgs84(p.position[0], p.position[2]);
    const evidenceInfo = EVIDENCE_LEVELS[p.evidence] || EVIDENCE_LEVELS['legacy-estimated'];
    const node = {
      ...p,
      twin: [+twin.x.toFixed(2), +twin.z.toFixed(2)],
      wgs84,
      evidenceLabel: evidenceInfo.label,
      evidenceTone: evidenceInfo.tone,
      subtitle: ext?.subtitle || ext?.summary || p.purpose,
      image: ext?.image || null,
    };
    byId.set(node.id, node);
    return node;
  });

  /** Query nearest semantic place using true 3D awareness + horizontal proximity */
  function queryContext(pos) {
    let best = null;
    let bestScore = Infinity;
    for (const node of nodes) {
      const sep = separation3D(
        { x: pos.x, y: pos.y ?? CANONICAL_DATUM.groundY, z: pos.z },
        { x: node.position[0], y: node.position[1], z: node.position[2] },
      );
      const inside = sep.horiz <= node.radius;
      const score = inside ? sep.horiz * 0.45 : sep.horiz;
      if (score < bestScore) {
        bestScore = score;
        best = { node, ...sep, inside };
      }
    }
    return best;
  }

  /** Unified pathfinder across walk / wet / wheel / air (eliminates nav vs wheelpath duplication) */
  function findPath(fromX, fromZ, toX, toZ, { mode = 'walk', wet = false } = {}) {
    if (mode === 'air' || mode === 'broom') {
      return {
        mode: 'air',
        points: [[fromX, fromZ], [toX, toZ]],
        distance: Math.hypot(toX - fromX, toZ - fromZ),
      };
    }
    if ((mode === 'bike' || mode === 'board' || mode === 'wheel') && wheelPath?.path) {
      const pts = wheelPath.path(fromX, fromZ, toX, toZ);
      return { mode: 'wheel', points: pts || [[fromX, fromZ], [toX, toZ]], distance: pathLen(pts) };
    }
    if (nav?.path) {
      const pts = nav.path(fromX, fromZ, toX, toZ, { wet });
      return { mode: wet ? 'wet' : 'walk', points: pts || [[fromX, fromZ], [toX, toZ]], distance: pathLen(pts) };
    }
    return {
      mode,
      points: [[fromX, fromZ], [toX, toZ]],
      distance: Math.hypot(toX - fromX, toZ - fromZ),
    };
  }

  function pathLen(pts) {
    if (!pts || pts.length < 2) return 0;
    let s = 0;
    for (let i = 1; i < pts.length; i++) {
      s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    return s;
  }

  function exportSummary() {
    return {
      schema: 'haiz-spatial-graph/1',
      datum: CANONICAL_DATUM,
      nodeCount: nodes.length,
      scienceStations: nodes.filter((n) => n.scienceStation).map((n) => ({ id: n.id, station: n.scienceStation, name: n.name })),
      evidenceBreakdown: nodes.reduce((acc, n) => {
        acc[n.evidence] = (acc[n.evidence] || 0) + 1;
        return acc;
      }, {}),
      campusBuildingsRaw: campus?.buildings?.length || 0,
    };
  }

  return {
    nodes,
    get: (id) => byId.get(id) || null,
    queryContext,
    findPath,
    exportSummary,
  };
}
