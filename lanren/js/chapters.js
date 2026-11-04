// The homepage as one walk around one tree. Each viewpoint opens a real part
// of HAIZ; as you go round, the tree wakes from the end of winter into full
// leaf and the day passes from dawn to evening.
// Pure data + interpolation (testable in Node).

export const AXIS = { x: 2.5, z: 0.4 };          // trunk-crown axis the camera circles
export const WATER = -0.85;

export const CHAPTERS = [
  {
    id: 'tree', index: '00', en: 'A Tree Connects Everything', zh: '一棵树，连接一座校园',
    lede: '海南中学府城校区一号教学楼前，有一棵百年榄仁树。这是它的数字化身：向下滚动，绕着它走一圈，看它从冬末的空枝醒来，也走进 HAIZ 的每一个角落。',
    note: '物种概念模型：依大叶榄仁的分层树形创作，并非这棵树的测绘',
    grow: 0.0,
    cam: { th: 0.12, rho: 33, h: 0.9, look: [2.5, 5.6, 0.4] },
    light: { rel: 0.32, elev: 3.5, sun: [1.0, 0.72, 0.5], I: 1.7, zenith: [0.10, 0.16, 0.27], horizon: [0.62, 0.55, 0.50], glow: [0.9, 0.55, 0.32],
      fog: [0.42, 0.42, 0.45], density: 0.0112, mist: 0.41, rays: 0.6, exposure: 1.0, warm: 0.55, cloud: 0.4, aperture: 0, focus: 0 },
    entries: []
  },
  {
    id: 'campus', index: '01', en: 'Explore the Campus', zh: '校园 · 探索',
    lede: '残留的红叶落进水里，枝梢开始抽长、冒出新芽。从这里走进校园：第一人称漫游、手绘平面、编排自己的路线，或者从一颗星球降落到这棵树下。',
    note: '三维校园与平面图沿用项目既有空间数据，为近似表达',
    grow: 0.3,
    cam: { th: 0.95, rho: 25, h: 12.5, look: [2.5, 4.6, 0.4] },
    light: { rel: 2.3, elev: 26, sun: [1.0, 0.88, 0.72], I: 2.6, zenith: [0.12, 0.24, 0.46], horizon: [0.62, 0.66, 0.70], glow: [0.8, 0.6, 0.4],
      fog: [0.50, 0.56, 0.62], density: 0.0064, mist: 0.20, rays: 0.25, exposure: 0.95, warm: 0.35, cloud: 0.5, aperture: 0, focus: 0 },
    entries: [
      { href: 'campus-3d.html?focus=lanshu', title: '第一人称校园', note: '从榄仁树出发，16 间可步入的想象教室', dark: true, primary: true },
      { href: 'about.html', title: '学校与校园手图', note: '历史、地标与手绘平面' },
      { href: 'director.html', title: '探索导演台', note: '编排你自己的步行路线' },
      { href: 'descent.html', title: '从星球到树荫', note: '一段保持地理焦点的下降镜头', dark: true }
    ]
  },
  {
    id: 'archive', index: '02', en: 'Roots & Records', zh: '来处 · 档案',
    lede: '海南中学前身是 1923 年创办的私立琼海中学。百年校庆时，《海南日报》的报道以校园里的百年榄仁树开篇。根在这里：报道、校友、建筑，和一条可以慢慢读的路线。',
    note: '学校简介（本站「学校」页）；海南日报 2023-10-30。树龄没有年轮测定',
    grow: 0.5,
    cam: { th: 2.15, rho: 9.5, h: 0.75, look: [0.3, 3.4, 0.2] },
    light: { rel: 0.25, elev: 22, sun: [1.0, 0.93, 0.82], I: 3.0, zenith: [0.10, 0.24, 0.50], horizon: [0.58, 0.66, 0.72], glow: [0.7, 0.6, 0.45],
      fog: [0.48, 0.56, 0.62], density: 0.0056, mist: 0.18, rays: 0.75, exposure: 0.95, warm: 0.3, cloud: 0.5, aperture: 0, focus: 0 },
    entries: [
      { href: 'news.html', title: '新闻档案', note: '原仓库报道，分类与检索', primary: true },
      { href: 'alumni.html', title: '校友', note: '公开资料中的海中人' },
      { href: 'architecture.html', title: '建筑观察手册', note: '实拍、材质与光影' },
      { href: 'memory-walk.html', title: '树荫下的三次停留', note: '北门 · 榄仁树 · 砚池，无需三维' }
    ]
  },
  {
    id: 'study', index: '03', en: 'Between Classes', zh: '课间 · 工具',
    lede: '新叶在枝顶展开：先是古铜色，对折着竖起，再摊平、转为嫩绿。课间也可以有自己的小空间——便签与专注、物理实验，和随身的 HAIZ Pocket。',
    note: '叶簇生枝顶（属名 Terminalia 意为“末端”）、新叶带红铜色，见植物学资料',
    grow: 0.66,
    cam: { eye: [1.0, 4.6, -8.5], look: [0.7, 5.0, -6.2] },
    light: { rel: 0.12, elev: 30, sun: [1.0, 0.96, 0.88], I: 3.3, zenith: [0.08, 0.22, 0.52], horizon: [0.55, 0.65, 0.72], glow: [0.7, 0.62, 0.5],
      fog: [0.50, 0.58, 0.64], density: 0.0048, mist: 0.11, rays: 0.55, exposure: 0.92, warm: 0.3, cloud: 0.45, aperture: 1.0, focus: 0 },
    entries: [
      { href: 'windowsill/index.html', title: '课间窗台', note: '便签、专注、书信与本机留声', dark: true, primary: true },
      { href: 'physics-lab.html', title: '物理实验室', note: 'Every Joule 原版与自制练习', dark: true },
      { href: 'pocket/index.html', title: 'HAIZ Pocket', note: '移动端应用，可安装的 PWA', dark: true },
      { href: 'login/index.html', title: '登录', note: 'Pocket 账户 · 登录与注册', dark: true }
    ]
  },
  {
    id: 'days', index: '04', en: 'Days & Making', zh: '日子 · 创作',
    lede: '顺着那根伸向远处的横枝望出去，水面上是傍晚的光。杂志、社团、课间电台与暗房，还有写给来访者的指引。',
    note: '长横枝取自校园那棵树「枝叶如龙腾伸展」的意象（学校景观简介）；此处为艺术表达',
    grow: 0.84,
    cam: { eye: [-1.4, 3.2, 1.6], look: [34, 2.4, -2.5] },
    light: { rel: 0.06, elev: 8, sun: [1.0, 0.75, 0.45], I: 2.6, zenith: [0.10, 0.18, 0.38], horizon: [0.85, 0.62, 0.42], glow: [1.2, 0.62, 0.28],
      fog: [0.62, 0.52, 0.42], density: 0.0080, mist: 0.20, rays: 0.85, exposure: 1.0, warm: 0.8, cloud: 0.55, aperture: 0.45, focus: 4.5 },
    entries: [
      { href: 'journal.html', title: '校园杂志', note: '影像、手记与校园正在发生的事', primary: true },
      { href: 'clubs.html', title: '社团提案', note: '六个清楚标注的创作提案' },
      { href: 'life.html', title: '课间电台', note: '虚构小报、个人选择、本机便笺' },
      { href: 'darkroom.html', title: '共感暗房', note: '显影、编曲，寄出一个课间' },
      { href: 'admissions.html', title: '来访与招生', note: '来访指引与官方招生入口' }
    ]
  },
  {
    id: 'whole', index: '05', en: 'Growing Together', zh: '繁茂 · 全部',
    lede: '此刻它枝繁叶茂，整座数字校园都长在这棵树上。在树下多停一会儿，也许会有一片叶子落下——接住它，夹进你的书页。',
    note: '落叶前转红、一年一至两次换叶，见植物学资料；书页只保存在这台设备上',
    grow: 1.0,
    cam: { th: 5.6, rho: 34, h: 1.6, look: [2.5, 6.2, 0.4] },
    light: { rel: 0.55, elev: 6, sun: [1.0, 0.62, 0.35], I: 2.3, zenith: [0.12, 0.14, 0.30], horizon: [0.95, 0.58, 0.40], glow: [1.4, 0.6, 0.25],
      fog: [0.62, 0.48, 0.42], density: 0.0088, mist: 0.25, rays: 0.75, exposure: 1.05, warm: 0.9, cloud: 0.5, aperture: 0, focus: 0 },
    entries: [
      { action: 'book', title: '我的书页', note: '接住的叶子，只存在这台设备上', primary: true },
      { action: 'search', title: '全部入口', note: '搜索全站页面与校园地点' },
      { href: 'contact.html', title: '关于本站', note: '创作者、来源、隐私与站点地图' }
    ]
  }
];

// ------------------------------------------------------------------ camera frames
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/** a key (orbit {th, rho, h} or explicit {eye}) → eye / look / azimuth */
export function frameOf(cam) {
  let ex, ey, ez;
  if (cam.eye) [ex, ey, ez] = cam.eye;
  else { ex = AXIS.x + Math.sin(cam.th) * cam.rho; ez = AXIS.z + Math.cos(cam.th) * cam.rho; ey = cam.h; }
  const th = Math.atan2(ex - AXIS.x, ez - AXIS.z);
  const rho = Math.hypot(ex - AXIS.x, ez - AXIS.z);
  return { th, rho, h: ey, lx: cam.look[0], ly: cam.look[1], lz: cam.look[2] };
}

export const FRAMES = [];
export function rebuildFrames() {
  const f = CHAPTERS.map((c) => frameOf(c.cam));
  // unwrap azimuth so each step walks the short way round, always forward
  for (let i = 1; i < f.length; i++) {
    while (f[i].th - f[i - 1].th > Math.PI) f[i].th -= Math.PI * 2;
    while (f[i].th - f[i - 1].th < -Math.PI) f[i].th += Math.PI * 2;
  }
  FRAMES.length = 0;
  FRAMES.push(...f);
  return FRAMES;
}
rebuildFrames();
/** Re-aim one viewpoint (e.g. at a real leaf cluster found at load time). */
export function retarget(i, cam) { CHAPTERS[i].cam = cam; rebuildFrames(); }

// rough envelope of the crown: radius by height (keeps passing shots outside it)
export function crownRadius(h) {
  const s = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  return (10.5 * s(1.2, 3.2, h) - 6.5 * s(4.0, 12.0, h)) * (1 - s(12.5, 16.0, h));
}

function cr(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/** Camera at continuous progress p ∈ [0, n-1]: eye circles the tree (cylindrical), look point glides. */
export function poseAt(p, frames = FRAMES) {
  const n = frames.length;
  const q = clamp(p, 0, n - 1);
  const i = Math.min(n - 2, Math.floor(q));
  const t = q - i;
  const F = (k) => frames[clamp(k, 0, n - 1)];
  const a = F(i - 1), b = F(i), c = F(i + 1), d = F(i + 2);
  const th = cr(a.th, b.th, c.th, d.th, t);
  let rho = Math.exp(cr(Math.log(a.rho), Math.log(b.rho), Math.log(c.rho), Math.log(d.rho), t));
  const h = Math.max(WATER + 0.35, cr(a.h, b.h, c.h, d.h, t));
  // between viewpoints, step back outside the crown instead of through it
  const w = Math.sin(Math.PI * t);
  const need = crownRadius(h) + 1.5;
  if (rho < need) rho += (need - rho) * w;
  return {
    ex: AXIS.x + Math.sin(th) * rho, ey: h, ez: AXIS.z + Math.cos(th) * rho,
    lx: cr(a.lx, b.lx, c.lx, d.lx, t), ly: cr(a.ly, b.ly, c.ly, d.ly, t), lz: cr(a.lz, b.lz, c.lz, d.lz, t), th
  };
}

// ------------------------------------------------------------------ growth & light
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

export function growAt(p) {
  const q = clamp(p, 0, CHAPTERS.length - 1);
  const i = Math.min(CHAPTERS.length - 2, Math.floor(q));
  return lerp(CHAPTERS[i].grow, CHAPTERS[i + 1].grow, q - i);
}

/** Light keyframes blended between viewpoints (eased so each view holds its look). */
export function lightAt(p) {
  const q = clamp(p, 0, CHAPTERS.length - 1);
  const i = Math.min(CHAPTERS.length - 2, Math.floor(q));
  const t = ease(q - i);
  const A = CHAPTERS[i].light, B = CHAPTERS[i + 1].light;
  const out = {};
  for (const k of Object.keys(A)) {
    out[k] = Array.isArray(A[k]) ? A[k].map((v, j) => lerp(v, B[k][j], t)) : lerp(A[k], B[k], t);
  }
  return out;
}

export function allLinks() {
  return CHAPTERS.flatMap((c) => c.entries.filter((e) => e.href).map((e) => ({ chapter: c.id, ...e })));
}
export function nearestChapter(p) { return Math.round(clamp(p, 0, CHAPTERS.length - 1)); }
