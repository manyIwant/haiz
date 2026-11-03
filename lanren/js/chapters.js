// The homepage as a walk around one tree. Each stop frames a part of the
// tree and opens one part of HAIZ. Pure data + interpolation (testable in Node).
//
// Source labels follow the project's convention: what is recorded, what is
// observed in photographs, what is botanical reference, what is our model.

export const CHAPTERS = [
  {
    id: 'now', index: '00', name: '此刻', part: '树下',
    title: '一棵榄仁树',
    kicker: '海南中学 · 府城校区 · 一号教学楼前',
    lede: '学校的景观介绍说，它的枝叶如龙腾伸展，被视为庇护海中的宝树。这里按海口此刻的太阳与季节照亮它。',
    source: '海南中学官网《海南中学校园景观简介》，经本项目资料转引；光照与季节为模型推演',
    pose: { cx: 3.5, cz: 0, az: -0.10, dist: 9.4, pitch: 0.05, eye: 1.25, lookH: 3.6, yawOff: 0.05 },
    entries: []
  },
  {
    id: 'roots', index: '01', name: '根', part: '来处',
    title: '从 1923 年长出来',
    lede: '海南中学前身是 1923 年创办的私立琼海中学。2023 年百年校庆，《海南日报》的报道以校园里的百年榄仁树开篇。这棵树的确切树龄没有年轮测定。',
    source: '学校简介（本站「学校」页）；海南日报 2023-10-30',
    pose: { cx: -0.3, cz: 0.0, az: 0.42, dist: 5.6, pitch: -0.04, eye: 1.0, lookH: 1.3, yawOff: -0.16 },
    entries: [
      { href: 'about.html', title: '学校与校园手图', note: '历史、地标、手绘平面' },
      { href: 'news.html', title: '新闻档案', note: '原仓库报道，分类与检索' },
      { href: 'alumni.html', title: '校友', note: '公开资料中的海中人' },
      { href: 'memory-walk.html', title: '树荫下的三次停留', note: '北门 · 榄仁树 · 砚池，无需三维' }
    ]
  },
  {
    id: 'trunk', index: '02', name: '干', part: '走进校园',
    title: '从树下，走进校园',
    lede: '一号教学楼是全校体量最大的教学主楼，一层设校史馆与国粹馆。楼前这棵树与中轴线上题有「虎踞龙盘」的太湖石相互呼应。',
    source: '海南中学官网《学校简介》《海南中学校园景观简介》，经本项目资料转引',
    pose: { cx: -18, cz: 5.2, az: -1.5708, dist: 22.5, pitch: 0.06, eye: 1.62, lookH: 4.6, yawOff: 0.16 },
    entries: [
      { href: 'campus-3d.html?focus=lanshu', title: '第一人称校园', note: '从这棵树出发，16 间可步入的想象教室' },
      { href: 'descent.html', title: '从星球到树荫', note: '原首页：一段保持地理焦点的下降镜头' },
      { href: 'architecture.html', title: '建筑观察手册', note: '实拍、材质与光影' },
      { href: 'director.html', title: '探索导演台', note: '编排你自己的步行路线' }
    ]
  },
  {
    id: 'limb', index: '03', name: '枝', part: '日子',
    title: '一根伸向远处的横枝',
    lede: '主干在两米多处分叉，一根横枝几乎水平地向东伸出十余米，在巨石旁压到离地不足两米，又重新昂起。北门入口处另有一株大叶榄仁，一前一后为海中学子送来绿荫。',
    source: '枝形依实拍（区大伟 摄）重建，长度为推算；「一前一后」见学校景观简介',
    pose: { cx: 6.2, cz: -1.0, az: 3.3, dist: 5.6, pitch: 0.04, eye: 1.6, lookH: 2.5, yawOff: 0 },
    entries: [
      { href: 'journal.html', title: '校园杂志', note: '影像、手记与校园正在发生的事' },
      { href: 'clubs.html', title: '社团提案', note: '六个清楚标注的创作提案' },
      { href: 'life.html', title: '课间电台', note: '虚构小报、个人选择、本机便笺' },
      { href: 'admissions.html', title: '来访与招生', note: '来访指引与官方招生入口' }
    ]
  },
  {
    id: 'crown', index: '04', name: '冠', part: '课间',
    title: '抬头，是光',
    lede: '属名 Terminalia 指“末端”：叶子簇生在枝顶，一层层平展开来。地上那些圆形的亮斑并不是叶缝的形状，而是太阳本身的像——每道叶隙都是一枚小孔。',
    source: '植物学资料（NParks、香港绿化资料等）；小孔成像为光学常识，场景按太阳视直径 0.53° 计算光斑',
    pose: { cx: 3.0, cz: 0.6, az: 0.22, dist: 6.2, pitch: 0.5, eye: 1.6, lookH: 5.0, yawOff: 0 },
    entries: [
      { href: 'windowsill/index.html', title: '课间窗台', note: '便签、专注、书信与本机留声' },
      { href: 'darkroom.html', title: '共感暗房', note: '显影、编曲，寄出一个课间' },
      { href: 'physics-lab.html', title: '物理实验室', note: 'Every Joule 原版与自制练习' },
      { href: 'pocket/index.html', title: 'HAIZ Pocket', note: '移动端应用，可安装的 PWA' },
      { href: 'login/index.html', title: '登录', note: 'Pocket 账户 · 登录与注册' }
    ]
  },
  {
    id: 'leaves', index: '05', name: '叶', part: '留下',
    title: '等一片叶子落下',
    lede: '落叶之前，叶子会转黄、转红，再到赭褐。按海口的季节推演，它在冬季最红。在树下多停一会儿，总会有一片叶子落下——接住它，夹进你的书页。',
    source: '落叶变色见植物学资料；海口的季节时间为本站依资料作出的近似模型，不是对这棵树的观测',
    pose: { cx: 3.5, cz: 0, az: 0.10, dist: 21, pitch: 0.0, eye: 1.7, lookH: 6.2, yawOff: 0 },
    entries: [
      { action: 'book', title: '我的书页', note: '接住的叶子，只存在这台设备上' },
      { href: 'contact.html', title: '关于本站', note: '创作者、来源、隐私与站点地图' }
    ]
  }
];

const ease = (t) => t * t * (3 - 2 * t);

/**
 * Where each entry pins into the picture, as a screen position (NDC) seen
 * from its stop. At load the homepage casts a ray through that point and
 * anchors the entry on whatever is there: bark, stone, leaves, the building.
 * Entries are listed top to bottom, so their pins descend too and the
 * leader lines never cross.
 */
export function aimFor(k, n) {
  const t = n > 1 ? k / (n - 1) : 0.5;
  return [0.14 + 0.30 * Math.sin(1.3 + k * 1.9) ** 2, 0.38 - 0.66 * t];
}

// ------------------------------------------------------------------ walking geometry
// Obstacles on the terrace (scene frame): trunk + bed, boulders
export const OBSTACLES = [
  { x: -0.3, z: 0.05, r: 2.75 },
  { x: 8.9, z: -2.25, r: 1.45 },
  { x: 7.75, z: -2.95, r: 1.05 },
  { x: 5.2, z: -2.15, r: 1.15 }
];
export const BOUNDS = { x0: -22, x1: 30, z0: -26, z1: 8.6 };
// the forecourt is four steps (0.6 m) lower beyond z = -10.3
export function groundAt(z) { return z > -10.3 ? 0 : z < -11.7 ? -0.6 : -0.6 * (-10.3 - z) / 1.4; }
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export function keepClear(x, z) {
  x = clamp(x, BOUNDS.x0, BOUNDS.x1);
  z = clamp(z, BOUNDS.z0, BOUNDS.z1);
  for (const o of OBSTACLES) {
    const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz);
    if (d < o.r) { x = o.x + dx / (d || 1) * o.r; z = o.z + dz / (d || 1) * o.r; }
  }
  return [x, z];
}

/** A stop's pose (orbit-style, easy to author) → eye position and look point. */
export function frameOf(p, lookDist = 10) {
  const [x, z] = keepClear(p.cx - Math.sin(p.az) * p.dist * 1.15, p.cz - Math.cos(p.az) * p.dist);
  const g = groundAt(z);
  const ey = p.eye + g;
  const yaw = Math.atan2(p.cx - x, p.cz - z) + p.yawOff;
  const horiz = Math.max(0.5, Math.hypot(p.cx - x, p.cz - z));
  const pitch = clamp(Math.atan2(p.lookH - p.eye - g, horiz) + p.pitch, -0.9, 1.45);
  return {
    ex: x, ey, ez: z,
    lx: x + Math.sin(yaw) * Math.cos(pitch) * lookDist,
    ly: ey + Math.sin(pitch) * lookDist,
    lz: z + Math.cos(yaw) * Math.cos(pitch) * lookDist
  };
}

const FRAMES = CHAPTERS.map((c) => frameOf(c.pose));

/**
 * Camera frame for a continuous position p ∈ [0, n-1]: eye and look point
 * follow Catmull-Rom curves through the stops, so walking between stops is a
 * path, not a swing; the eye is kept out of the trunk, bed and boulders.
 */
export function poseAt(p, frames = FRAMES) {
  const n = frames.length;
  const q = Math.min(n - 1, Math.max(0, p));
  const i = Math.min(n - 2, Math.floor(q));
  const t = q - i;
  const F = (k) => frames[Math.max(0, Math.min(n - 1, k))];
  const a = F(i - 1), b = F(i), c = F(i + 1), d = F(i + 2);
  const out = {};
  for (const k of Object.keys(b)) out[k] = cr(a[k], b[k], c[k], d[k], t);
  [out.ex, out.ez] = keepClear(out.ex, out.ez);
  // the head drops back to level while walking between stops
  const level = 0.5 + 0.5 * Math.abs(Math.cos(Math.PI * t));
  out.ly = out.ey + (out.ly - out.ey) * level;
  return out;
}

// Catmull-Rom with tension 0.5, clamped at the ends
function cr(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

export function nearestChapter(p) { return Math.round(Math.min(CHAPTERS.length - 1, Math.max(0, p))); }
export { ease };

/** Every destination reachable from the homepage (used by tests and the sitemap). */
export function allLinks() {
  return CHAPTERS.flatMap((c) => c.entries.filter((e) => e.href).map((e) => ({ chapter: c.id, ...e })));
}
