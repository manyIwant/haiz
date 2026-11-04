// The homepage as one continuous film around one tree. Six art-directed shots
// (after the reference grid: first encounter, awakening, details, map,
// looking forward, full bloom), each opening a real part of HAIZ. Scrolling
// moves one camera through them while the tree wakes from the end of winter
// into full leaf and the light moves through the day.
// Pure data + interpolation (testable in Node).

export const AXIS = { x: 0.6, z: -0.2 };         // trunk–crown axis (three.js frame)
export const WATER = -0.85;

// ---------------------------------------------------------------- sections
export const CHAPTERS = [
  {
    id: 'tree', index: '01', label: '开场 · 初遇', en: ['A Tree', 'Connects Everything'], zh: '一棵树，连接所有可能',
    lede: '海南中学府城校区一号教学楼前，有一棵百年榄仁树。这是它的数字化身：冬末，去年的红叶还挂在枝头。向下滚动，绕着它走，看它抽枝、发芽、展叶，也走进 HAIZ 的每一个角落。',
    note: '物种概念模型：依大叶榄仁的形态特征创作，并非校园那棵树的测绘',
    ui: { slab: 'none' },
    entries: []
  },
  {
    id: 'campus', index: '02', label: '缓慢靠近 · 苏醒', en: ['Explore', 'the Campus'], zh: '校园 · 探索',
    lede: '走近树干，沿着主枝向上看：芽从枝梢醒来，光从枝杈间落下。从这里走进校园——第一人称漫游、从一颗星球降落到树下，或者编排你自己的路线。',
    note: '三维校园沿用项目既有空间数据，建筑为近似模型',
    ui: { slab: 'right', anchor: [0.15, 2.6, 0.2] },
    entries: [
      { href: 'campus-3d.html?focus=lanshu', title: '第一人称校园', en: 'Walk the campus', note: '从榄仁树出发，16 间可步入的想象教室', dark: true, primary: true },
      { href: 'descent.html', title: '从星球到树荫', en: 'The descent', note: '一段保持地理焦点的下降镜头', dark: true },
      { href: 'director.html', title: '探索导演台', en: 'Director', note: '编排你自己的步行路线' }
    ]
  },
  {
    id: 'archive', index: '03', label: '叶片特写 · 细节', en: ['Details', 'Matter'], zh: '档案 · 来处',
    lede: '新叶对折着展开，逆光里能看见每一条叶脉。来处也是这样一点点展开的：1923 年创办的私立琼海中学、百年校庆时以这棵树开篇的报道、从这里走出去的人。',
    note: '学校简介（本站「学校」页）；《海南日报》2023-10-30。树龄未经年轮测定',
    ui: { slab: 'right', anchor: 'study' },
    entries: [
      { href: 'news.html', title: '新闻档案', en: 'News archive', note: '原仓库报道，分类与检索', primary: true },
      { href: 'alumni.html', title: '校友', en: 'Alumni', note: '公开资料中的海中人' },
      { href: 'architecture.html', title: '建筑观察手册', en: 'Architecture', note: '实拍、材质与光影' }
    ]
  },
  {
    id: 'map', index: '04', label: '俯瞰树冠 · 地图', en: ['Campus', 'Map'], zh: '地图 · 空间',
    lede: '升到树冠上方，一层层枝叶铺开，像一张地图。校园也有它的平面：手绘的校园图、三处可以慢慢走的地点，和写给来访者的指引。',
    note: '校园手图沿用项目既有平面数据，为近似表达',
    ui: { slab: 'right', anchor: [5.5, 13.2, 1.5] },
    entries: [
      { href: 'about.html#campusAtlas', title: '学校与校园手图', en: 'Campus atlas', note: '历史、地标与手绘平面', primary: true },
      { href: 'memory-walk.html', title: '树荫下的三次停留', en: 'Three stops', note: '北门 · 榄仁树 · 砚池，无需三维' },
      { href: 'admissions.html', title: '来访与招生', en: 'Visit', note: '来访指引与官方招生入口' }
    ]
  },
  {
    id: 'days', index: '05', label: '透过树冠 · 远眺', en: ['Looking', 'Forward'], zh: '日子 · 创作',
    lede: '从叶丛里向外望，远处是水面与正在落下的光。那些正在发生、将要发生的事：校园杂志、社团提案、课间电台，和一间可以寄出课间的暗房。',
    note: '远景为艺术表达，不是校园实景',
    ui: { slab: 'right', anchor: [-460, 12, 170] },
    entries: [
      { href: 'journal.html', title: '校园杂志', en: 'Journal', note: '影像、手记与校园正在发生的事', primary: true },
      { href: 'clubs.html', title: '社团提案', en: 'Clubs', note: '六个清楚标注的创作提案' },
      { href: 'life.html', title: '课间电台', en: 'Radio', note: '虚构小报、个人选择、本机便笺' },
      { href: 'darkroom.html', title: '共感暗房', en: 'Darkroom', note: '显影、编曲，寄出一个课间', dark: true }
    ]
  },
  {
    id: 'whole', index: '06', label: '全盛 · 共同生长', en: ['Growing', 'Together'], zh: '工具 · 全部',
    lede: '它终于枝繁叶茂，整个 HAIZ 都长在这棵树上：课间的小工具、随身的 Pocket、你在树下接住的叶子，和全站的每一个入口。',
    note: '落叶前转红、春季抽新叶，见植物学资料；书页只保存在这台设备上',
    ui: { slab: 'grid', anchor: [-2.2, 9.8, 1.2] },
    entries: [
      { href: 'windowsill/index.html', title: '课间窗台', en: 'Windowsill', note: '便签、专注、书信与本机留声', dark: true, primary: true },
      { href: 'physics-lab.html', title: '物理实验室', en: 'Physics lab', note: 'Every Joule 原版与自制练习', dark: true },
      { href: 'pocket/index.html', title: 'HAIZ Pocket', en: 'Pocket', note: '移动端应用，可安装的 PWA', dark: true },
      { href: 'login/index.html', title: '登录', en: 'Sign in', note: 'Pocket 账户 · 登录与注册', dark: true },
      { action: 'book', title: '我的书页', en: 'Pressed leaves', note: '接住的叶子，只存在这台设备上' },
      { action: 'search', title: '全部入口', en: 'Everything', note: '搜索全站页面与校园地点' },
      { href: 'contact.html', title: '关于本站', en: 'About', note: '创作者、来源、隐私与站点地图' }
    ]
  }
];

// ---------------------------------------------------------------- art direction
// Growth state of the tree at each shot (0 end of winter … 1 full leaf).
export const GROW = [0.0, 0.31, 0.5, 0.7, 0.86, 1.0];
/** Timing of one leaf in growth units: bud visible before it breaks, unfolding, maturing to deep green. */
export const LEAF_TIMING = { bud: 0.035, unfold: 0.2, mature: 0.3 };
/** The four stages of the flush shown on the growth line (reference 07). */
export const STAGES = [
  { at: 0.0, label: '枯枝', en: 'Bare' }, { at: 0.3, label: '新芽', en: 'Bud' },
  { at: 0.55, label: '舒展', en: 'Unfold' }, { at: 0.9, label: '繁茂', en: 'Full' }
];

/**
 * Shots and the moves between them. Each key: t (shot i at t = i; waypoints
 * between), eye, look (or yaw/pitch in degrees), fov (vertical, degrees).
 * Orientation is interpolated as yaw/pitch, so turning round is a smooth pan.
 * `study` is re-aimed at load time on a real cluster of new leaves.
 */
export const KEYS = [
  { t: 0, eye: [8.5, 0.95, 38], look: [-3.4, 6.3, 0], fov: 33 },                    // 01 first encounter
  { t: 0.55, eye: [5.6, 1.4, 19], look: [0.6, 6.0, -1], fov: 42 },
  { t: 1, eye: [3.1, 0.75, 5.0], look: [-0.9, 8.6, -2.2], fov: 64 },                // 02 awakening: up the trunk
  { t: 1.5, eye: [6.0, 2.4, 8.0], look: [3.0, 6.8, 1.0], fov: 50 },
  { t: 2, eye: [9.0, 5.1, 5.6], look: [9.6, 5.5, 4.6], fov: 26, study: true },      // 03 details: new leaves
  { t: 2.45, eye: [19, 15, 17], look: [2, 8, 0], fov: 40 },
  { t: 3, eye: [14, 26, 18], look: [1.5, 5.5, -0.5], fov: 52 },                   // 04 map: above the crown
  { t: 3.5, eye: [-14, 17, 16], look: [-4, 7, 3], fov: 44 },
  { t: 4, eye: [-6.3, 5.5, 7.4], look: [-42, 4.5, 20], fov: 54 },                   // 05 looking forward
  { t: 4.5, eye: [-13, 3.4, 17.5], yaw: 172, pitch: 6, fov: 48 },
  { t: 5, eye: [-18.6, 1.05, 25.6], look: [4.4, 6.9, 2.6], fov: 38 }                   // 06 full bloom
];

/** Light and atmosphere per shot. sun: world azimuth (deg, atan2(x, z)) and elevation. */
export const LIGHT = [
  // 01 dawn, backlit: warm haze behind a dark, rim-lit tree
  { sun: [166, 8], sunCol: [1.0, 0.70, 0.42], I: 2.9, zenith: [0.13, 0.17, 0.30], horizon: [0.92, 0.60, 0.36], glow: [1.5, 0.78, 0.36],
    fog: [0.78, 0.56, 0.40], density: 0.0013, mist: 0.07, rays: 0.6, exposure: 0.92, warm: 0.8, cloud: 0.42, aperture: 0, focus: 0, sat: 1.08, contrast: 1.06 },
  // 02 morning: light breaking through the limbs above
  { sun: [205, 34], sunCol: [1.0, 0.78, 0.52], I: 4.6, zenith: [0.10, 0.18, 0.40], horizon: [0.78, 0.66, 0.54], glow: [1.4, 0.85, 0.45],
    fog: [0.62, 0.56, 0.50], density: 0.0011, mist: 0.03, rays: 1.0, exposure: 0.9, warm: 0.75, cloud: 0.5, aperture: 0.1, focus: 6.5, sat: 1.1, contrast: 1.1 },
  // 03 late morning, the sun behind the new leaves
  { sun: [62, 26], sunCol: [1.0, 0.9, 0.72], I: 4.0, zenith: [0.07, 0.20, 0.52], horizon: [0.52, 0.64, 0.76], glow: [1.0, 0.82, 0.55],
    fog: [0.52, 0.62, 0.70], density: 0.0010, mist: 0.02, rays: 0.4, exposure: 1.0, warm: 0.5, cloud: 0.45, aperture: 1.0, focus: 0, sat: 1.1, contrast: 1.06 },
  // 04 midday from above: side light for the relief of the tiers
  { sun: [215, 17], sunCol: [1.0, 0.86, 0.66], I: 4.6, zenith: [0.05, 0.17, 0.50], horizon: [0.44, 0.58, 0.74], glow: [0.8, 0.72, 0.56],
    fog: [0.30, 0.38, 0.36], density: 0.0065, mist: 0.6, rays: 0.0, exposure: 0.8, warm: 0.45, cloud: 0.45, aperture: 0, focus: 0, sat: 0.98, contrast: 1.12 },
  // 05 golden hour seen from inside the crown
  { sun: [302, 12], sunCol: [1.0, 0.68, 0.40], I: 3.4, zenith: [0.14, 0.18, 0.32], horizon: [0.95, 0.62, 0.40], glow: [1.5, 0.74, 0.34],
    fog: [0.80, 0.58, 0.42], density: 0.0014, mist: 0.05, rays: 0.6, exposure: 0.95, warm: 0.85, cloud: 0.4, aperture: 0.16, focus: 0, sat: 1.06, contrast: 1.05 },
  // 06 full day: deep blue sky, white clouds, warm sun across the crown from the right
  { sun: [58, 40], sunCol: [1.0, 0.9, 0.72], I: 5.6, zenith: [0.025, 0.11, 0.46], horizon: [0.36, 0.54, 0.80], glow: [0.95, 0.8, 0.6],
    fog: [0.42, 0.56, 0.74], density: 0.0010, mist: 0.03, rays: 0.0, exposure: 1.08, warm: 0.55, cloud: 0.66, aperture: 0, focus: 0, sat: 1.16, contrast: 1.12 }
];

// ---------------------------------------------------------------- interpolation
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const D2R = Math.PI / 180;

/** Each shot holds briefly: the camera eases in and out but never fully stops. */
export function ease(f) { return f - Math.sin(2 * Math.PI * f) / (2 * Math.PI) * 0.82; }

function orient(k) {
  if (k.look) {
    const dx = k.look[0] - k.eye[0], dy = k.look[1] - k.eye[1], dz = k.look[2] - k.eye[2];
    const h = Math.hypot(dx, dz);
    return { yaw: Math.atan2(dx, dz) / D2R, pitch: Math.atan2(dy, h) / D2R, dist: Math.hypot(dx, dy, dz) };
  }
  return { yaw: k.yaw, pitch: k.pitch, dist: 20 };
}

export const FRAMES = [];      // resolved keys
export function rebuildFrames() {
  const f = KEYS.map((k) => ({ t: k.t, ex: k.eye[0], ey: k.eye[1], ez: k.eye[2], fov: k.fov, ...orient(k) }));
  // unwrap yaw so each move turns the short way (waypoints steer longer turns)
  for (let i = 1; i < f.length; i++) {
    while (f[i].yaw - f[i - 1].yaw > 180) f[i].yaw -= 360;
    while (f[i].yaw - f[i - 1].yaw < -180) f[i].yaw += 360;
  }
  for (const k of f) k.th = Math.atan2(k.ex - AXIS.x, k.ez - AXIS.z);
  FRAMES.length = 0;
  FRAMES.push(...f);
  return FRAMES;
}
rebuildFrames();
/** the resolved key of shot i */
export function shot(i) { return FRAMES.find((k) => k.t === i); }
/** Re-aim one shot (e.g. at a real leaf cluster found at load time). */
export function retarget(i, eye, look, fov) {
  const k = KEYS.find((x) => x.t === i);
  k.eye = eye; k.look = look; delete k.yaw; delete k.pitch;
  if (fov) k.fov = fov;
  rebuildFrames();
}

// non-uniform Catmull–Rom through keys at their t
function crNU(t0, t1, t2, t3, p0, p1, p2, p3, t) {
  const m1 = (p2 - p0) / Math.max(1e-6, t2 - t0) * (t2 - t1);
  const m2 = (p3 - p1) / Math.max(1e-6, t3 - t1) * (t2 - t1);
  const u = (t - t1) / (t2 - t1), u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * m2;
}
const CH = ['ex', 'ey', 'ez', 'yaw', 'pitch', 'fov', 'dist'];

/** Camera at continuous progress p ∈ [0, 5]. */
export function poseAt(p, frames = FRAMES) {
  const n = CHAPTERS.length;
  const q = clamp(p, 0, n - 1);
  const i = Math.min(n - 2, Math.floor(q));
  const t = i + ease(q - i);
  let k = 0;
  while (k < frames.length - 2 && frames[k + 1].t <= t) k++;
  const a = frames[Math.max(0, k - 1)], b = frames[k], c = frames[k + 1], d = frames[Math.min(frames.length - 1, k + 2)];
  const ta = k > 0 ? a.t : b.t - (c.t - b.t), td = k + 2 < frames.length ? d.t : c.t + (c.t - b.t);
  const o = {};
  for (const ch of CH) {
    const pa = k > 0 ? a[ch] : b[ch] - (c[ch] - b[ch]);
    const pd = k + 2 < frames.length ? d[ch] : c[ch] + (c[ch] - b[ch]);
    o[ch] = crNU(ta, b.t, c.t, td, pa, b[ch], c[ch], pd, clamp(t, b.t, c.t));
  }
  o.ey = Math.max(WATER + 0.4, o.ey);
  const yaw = o.yaw * D2R, pitch = clamp(o.pitch, -89, 89) * D2R;
  const dist = Math.max(0.3, o.dist);
  return {
    ex: o.ex, ey: o.ey, ez: o.ez, fov: o.fov, dist,
    lx: o.ex + Math.sin(yaw) * Math.cos(pitch) * dist, ly: o.ey + Math.sin(pitch) * dist, lz: o.ez + Math.cos(yaw) * Math.cos(pitch) * dist,
    th: Math.atan2(o.ex - AXIS.x, o.ez - AXIS.z)
  };
}

// ---------------------------------------------------------------- growth & light
export function growAt(p) {
  const q = clamp(p, 0, CHAPTERS.length - 1);
  const i = Math.min(CHAPTERS.length - 2, Math.floor(q));
  const f = q - i;
  return lerp(GROW[i], GROW[i + 1], f * f * (3 - 2 * f) * 0.5 + f * 0.5);
}

/** Light keys blended between shots (each shot holds its own look). */
export function lightAt(p) {
  const q = clamp(p, 0, CHAPTERS.length - 1);
  const i = Math.min(CHAPTERS.length - 2, Math.floor(q));
  const f = q - i;
  const t = f * f * f * (f * (f * 6 - 15) + 10);
  const A = LIGHT[i], B = LIGHT[i + 1];
  const out = {};
  for (const key of Object.keys(A)) {
    if (key === 'sun') {
      let az = B.sun[0];
      while (az - A.sun[0] > 180) az -= 360;
      while (az - A.sun[0] < -180) az += 360;
      out.sunAz = lerp(A.sun[0], az, t);
      // the sun dips a little between shots rather than sweeping through the zenith
      out.sunEl = lerp(A.sun[1], B.sun[1], t) - Math.sin(Math.PI * t) * Math.abs(az - A.sun[0]) * 0.03;
      continue;
    }
    out[key] = Array.isArray(A[key]) ? A[key].map((v, j) => lerp(v, B[key][j], t)) : lerp(A[key], B[key], t);
  }
  out.sunEl = Math.max(3, out.sunEl);
  return out;
}

export function allLinks() {
  return CHAPTERS.flatMap((c) => c.entries.filter((e) => e.href).map((e) => ({ chapter: c.id, ...e })));
}
export function nearestChapter(p) { return Math.round(clamp(p, 0, CHAPTERS.length - 1)); }
