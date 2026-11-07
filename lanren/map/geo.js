// The campus under the tree.
//
// One coordinate frame shared by everything in chapter 04: the water-to-map
// shader, the labels, picking, the camera's focus moves and the hand-off to the
// first-person walk. Pure data + functions (no three.js), so Node can test it.
//
// Frames
//   plan     pixels of the original campus plan (campus.json rect/p values)
//   campus   campus-local metres, as the walk uses them (assets/walk/world.js
//            rectWorld): x = (px - 900) * 0.167, z = -(py - 784) * 0.167.
//            -Z points to the North Gate; this is the model's own axis, NOT
//            verified true north (campus.json meta.orientation).
//   world    the V4 homepage scene (three.js, Y up, metres). The tree's base is
//            the origin (lanren/assets/tree.json), the water plane is y = -0.85.
//
// The tree is the map's origin: campus point (49.098, -78.098), the centre of
// the 百年榄仁树 footprint, is placed under the V4 tree's root at world (0, 0).
// The V4 scene had no geographic orientation of its own, so the campus axes are
// taken as they are (no rotation): from the chapter-04 camera, campus "north"
// (towards the North Gate) is up the screen. The tree is not moved or scaled;
// the campus is laid under it, 1 m = 1 m.

export const GROUND_Y = -0.85;            // V4 water level: the map is drawn on this plane
export const TREE_ID = 'lanshu';
export const ROTATION = 0;                // default campus → world rotation about Y (radians); see above
// A composition (lanren/world/compose.js) may turn the whole campus about the tree's root:
// every reading (plan, model, labels, picking, collision) goes through the same frame, so the
// tree keeps its place on the campus; only the campus's bearing in V4's world changes.
// The angle is three.js rotation.y: campus +Z (the teaching blocks' porches) faces world
// (sin R, cos R), campus north (-Z) faces world (-sin R, -cos R), i.e. heading 180° + R.

// ---------------------------------------------------------------- plan ↔ campus
export function planToCampus(px, py, tf) {
  return { x: (px - tf.originPx[0]) * tf.scale, z: -(py - tf.originPx[1]) * tf.scale };
}
/** A plan rect → campus-metre centre and size (identical to world.js rectWorld). */
export function rectCampus(r, tf) {
  const x0 = (Math.min(r[0], r[2]) - tf.originPx[0]) * tf.scale, x1 = (Math.max(r[0], r[2]) - tf.originPx[0]) * tf.scale;
  const z0 = -(Math.max(r[1], r[3]) - tf.originPx[1]) * tf.scale, z1 = -(Math.min(r[1], r[3]) - tf.originPx[1]) * tf.scale;
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 };
}

// ---------------------------------------------------------------- campus ↔ world
/** The frame: campus metres ↔ V4 world, pivoting on the tree. */
export function makeFrame(campus, { rotation = ROTATION } = {}) {
  const tf = campus.meta.transform;
  const tree = campus.buildings.find((b) => b.id === TREE_ID);
  if (!tree) throw new Error('campus data has no ' + TREE_ID);
  const pivot = rectCampus(tree.rect, tf);
  const c = Math.cos(rotation), s = Math.sin(rotation);
  const frame = {
    transform: tf,
    pivot: { x: pivot.x, z: pivot.z },
    ground: GROUND_Y,
    /** campus → world rotation about Y (radians, three.js rotation.y) */
    rotation,
    /** the view heading (degrees) that looks towards campus north (the North Gate) */
    northYaw: 180 + (rotation * 180) / Math.PI,
    /** campus metres → world x/z */
    toWorld(x, z) { const dx = x - pivot.x, dz = z - pivot.z; return { x: dx * c + dz * s, z: -dx * s + dz * c }; },
    /** world x/z → campus metres */
    toCampus(x, z) { return { x: pivot.x + x * c - z * s, z: pivot.z + x * s + z * c }; },
    planToWorld(px, py) { const p = planToCampus(px, py, tf); return frame.toWorld(p.x, p.z); },
    /** the campus ground sheet (meta.ground, centred on the campus origin) in world coordinates */
    sheet: null
  };
  const g = campus.meta.ground;
  const cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => frame.toWorld((i * g.width) / 2, (j * g.depth) / 2));
  frame.sheet = { x0: Math.min(...cs.map((p) => p.x)), x1: Math.max(...cs.map((p) => p.x)), z0: Math.min(...cs.map((p) => p.z)), z1: Math.max(...cs.map((p) => p.z)) };
  return frame;
}

// ---------------------------------------------------------------- features (what the shader draws)
export const KIND = { botanic: 0, garden: 1, field: 2, court: 3, road: 4, water: 5, tree: 6, building: 7, gate: 8, corridor: 9, pavilion: 10, rock: 11 };
const LAYER = { botanic: 0, garden: 0, field: 1, court: 1, road: 2, water: 3, tree: 3, building: 4, gate: 4, corridor: 5, pavilion: 6, rock: 6 };
const FORM_KIND = { gate: 'gate', academic: 'building', lab: 'building', library: 'building', canteen: 'building', living: 'building', art: 'building',
  office: 'building', pond: 'water', garden: 'garden', botanic: 'botanic', pavilion: 'pavilion', oldtree: 'tree', rock: 'rock', corr: 'corridor', field: 'field' };
/** wings drawn separately but selected as one place */
const GROUPS = { dorm_m_n: 'dorm_m', dorm_m_m: 'dorm_m', dorm_m_s: 'dorm_m' };

export function buildFeatures(campus, frame) {
  const tf = campus.meta.transform;
  const out = [];
  const push = (src, kind, extra = {}) => {
    const r = rectCampus(src.rect, tf);
    const w = frame.toWorld(r.x, r.z);
    out.push({ id: src.id, group: GROUPS[src.id] || src.id, name: src.name || '', kind, code: KIND[kind], layer: LAYER[kind],
      cx: w.x, cz: w.z, hw: r.w / 2, hd: r.d / 2, rot: (src.rot || 0) + frame.rotation, h: src.size ? src.size[1] : 0, ...extra });
  };
  for (const b of campus.buildings) {
    const kind = FORM_KIND[b.form];
    if (kind) push(b, kind);
  }
  for (const r of campus.roads || []) push(r, 'road');
  for (const a of campus.sports || []) push(a, 'court', { colour: a.color, grid: a.grid, sport: a.kind, name: a.name });
  // a stable draw order: layer, then larger first so small things sit on top
  out.sort((a, b) => a.layer - b.layer || b.hw * b.hd - a.hw * a.hd);
  out.forEach((f, i) => { f.index = i; });
  return out;
}

/** Is world point (x, z) inside feature f (its rotated rect)? Returns the signed distance (m, < 0 inside). */
export function featureSDF(f, x, z) {
  const dx = x - f.cx, dz = z - f.cz, c = Math.cos(f.rot), s = Math.sin(f.rot);
  const lx = Math.abs(dx * c - dz * s) - f.hw, lz = Math.abs(dx * s + dz * c) - f.hd;
  const ox = Math.max(lx, 0), oz = Math.max(lz, 0);
  return Math.hypot(ox, oz) + Math.min(Math.max(lx, lz), 0);
}

// ---------------------------------------------------------------- places (what a visitor can choose)
const PRIORITY = {
  lanshu: 0,
  yihao: 1, library: 1, yundong: 1, beimen: 1, nanmen: 1, yanchi: 1, fengqitang: 1, hujulongpan: 1,
  erhao: 2, kexue: 2, keji: 2, yishu: 2, canteen1: 2, canteen3: 2, dorm_m: 2, dorm_f: 2, yanlintang: 2, zhiwuyuan: 2, xiaoyouhui: 2, sanhao: 2, sihao: 2,
  chem: 3, fengqitang_ting: 3, yanlintang_ting: 3, zhiwuyuan_pond: 3
};
/** Ids the first-person walk can start from (campus-3d.html?focus=, see assets/walk/app.js goTo). */
export function walkFocus(id) { return 'campus-3d.html?focus=' + encodeURIComponent(id); }

/**
 * @param campus   assets/walk/campus.json (geometry and words, authoritative for the walk)
 * @param extras   data/buildings.json (same buildings + project photos); optional
 */
export function buildPlaces(campus, frame, features, extras = null) {
  const photo = new Map((extras?.buildings || []).map((b) => [b.id, { image: b.image || null, review: b.imageReview || null }]));
  const places = [];
  for (const b of campus.buildings) {
    if (!(b.id in PRIORITY)) continue;
    const parts = features.filter((f) => f.group === b.id);
    if (!parts.length) continue;
    // the place's extent covers all of its parts (the boys' dormitory is four wings)
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    // (a turned campus turns each footprint's extents with it; with no turn this is the footprint itself)
    const cR = Math.abs(Math.cos(frame.rotation || 0)), sR = Math.abs(Math.sin(frame.rotation || 0));
    for (const f of parts) {
      const ex = f.hw * cR + f.hd * sR, ez = f.hw * sR + f.hd * cR;
      x0 = Math.min(x0, f.cx - ex); x1 = Math.max(x1, f.cx + ex); z0 = Math.min(z0, f.cz - ez); z1 = Math.max(z1, f.cz + ez);
    }
    const main = parts.find((f) => f.id === b.id) || parts[0];
    const p = photo.get(b.id) || {};
    const dist = Math.hypot(main.cx, main.cz);
    const local = frame.toCampus(main.cx, main.cz);
    places.push({
      id: b.id, name: b.name, en: b.en || '', category: b.category || '', form: b.form, kind: main.kind,
      desc: b.desc || '', note: b.note || '', inscription: b.inscription || null,
      image: p.image || null, imageWithheld: p.review ? (p.review.status || 'withheld') : null,
      size: b.size || null, floors: b.floors || null,
      x: main.cx, z: main.cz, w: x1 - x0, d: z1 - z0, box: { x0, x1, z0, z1 },
      priority: PRIORITY[b.id], features: parts.map((f) => f.index),
      fromTree: { distance: dist, bearing: bearingName(local.x - frame.pivot.x, local.z - frame.pivot.z) },
      walk: walkFocus(b.id)
    });
  }
  places.sort((a, b) => a.priority - b.priority || b.w * b.d - a.w * a.d);
  return places;
}

/** 8-way bearing in the campus-local frame (-Z = towards the North Gate). */
export function bearingName(x, z) {
  if (Math.hypot(x, z) < 1) return '原点';
  const a = (Math.atan2(x, -z) * 180) / Math.PI;   // 0 = campus north, 90 = east
  const names = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  return names[((Math.round(a / 45) % 8) + 8) % 8];
}

/** The place under a world point: the smallest selectable footprint containing it. */
export function placeAt(places, features, x, z) {
  let best = null, area = Infinity;
  for (const p of places) {
    for (const i of p.features) {
      const f = features[i];
      if (featureSDF(f, x, z) <= 0) {
        const a = f.hw * f.hd;
        if (a < area) { area = a; best = p; }
      }
    }
  }
  return best;
}
/** Any feature under a point (for the hover outline: roads have no names but still answer). */
export function featureAt(features, x, z) {
  let best = null;
  for (const f of features) if (featureSDF(f, x, z) <= 0 && (!best || f.layer > best.layer || (f.layer === best.layer && f.hw * f.hd < best.hw * best.hd))) best = f;
  return best;
}

// ---------------------------------------------------------------- the reveal's arrival field
// The water does not clear in a circle. The campus surfaces from the tree's
// roots outwards through its own structure: fastest along the paved paths,
// slower across lawns and slowest through buildings, as if the clear water
// found the campus's channels first. A Dijkstra pass over a 2.5 m grid gives
// every point its arrival "distance" (metres of path-equivalent travel).
const COST = { road: 1.0, corridor: 1.15, court: 1.3, field: 1.3, water: 1.25, garden: 1.45, botanic: 1.5, tree: 1.0, rock: 1.4, pavilion: 1.4, gate: 1.3, building: 1.85 };
const OPEN = 1.7;
export function computeArrival(features, frame, cell = 2.5) {
  const { x0, x1, z0, z1 } = frame.sheet;
  const nx = Math.ceil((x1 - x0) / cell) + 1, nz = Math.ceil((z1 - z0) / cell) + 1;
  const cost = new Float32Array(nx * nz).fill(OPEN);
  const layer = new Int8Array(nx * nz).fill(-1);
  const start = [];
  for (const f of features) {
    const k = COST[f.kind] ?? OPEN;
    const r = Math.hypot(f.hw, f.hd) + cell;
    const i0 = Math.max(0, Math.floor((f.cx - r - x0) / cell)), i1 = Math.min(nx - 1, Math.ceil((f.cx + r - x0) / cell));
    const j0 = Math.max(0, Math.floor((f.cz - r - z0) / cell)), j1 = Math.min(nz - 1, Math.ceil((f.cz + r - z0) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = x0 + i * cell, z = z0 + j * cell;
      if (featureSDF(f, x, z) > 0) continue;
      const n = j * nx + i;
      if (f.layer >= layer[n]) { layer[n] = f.layer; cost[n] = k; }
      if (f.kind === 'tree') start.push(n);
    }
  }
  if (!start.length) start.push(Math.round((0 - z0) / cell) * nx + Math.round((0 - x0) / cell));
  const dist = new Float64Array(nx * nz).fill(Infinity);   // float64: a float32 store would round below the popped distance and skip it
  // binary heap of [dist, node]
  const heap = [];
  const push = (d, n) => { heap.push([d, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  for (const n of start) { dist[n] = 0; push(0, n); }
  const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  while (heap.length) {
    const [d, n] = pop();
    if (d > dist[n]) continue;
    const i = n % nx, j = (n - i) / nx;
    for (const [di, dj, len] of NB) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
      const m = b * nx + a;
      const nd = d + ((cost[n] + cost[m]) / 2) * len * cell;
      if (nd < dist[m]) { dist[m] = nd; push(nd, m); }
    }
  }
  let max = 0;
  for (const v of dist) if (v > max && Number.isFinite(v)) max = v;
  const norm = new Float32Array(nx * nz);
  for (let n = 0; n < norm.length; n++) norm[n] = Math.min(1, dist[n] / max);
  return { nx, nz, x0, z0, cell, max, data: norm };
}
/** bilinear lookup of the normalised arrival at a world point (for tests and the camera) */
export function arrivalAt(field, x, z) {
  const fx = (x - field.x0) / field.cell, fz = (z - field.z0) / field.cell;
  const i = Math.max(0, Math.min(field.nx - 2, Math.floor(fx))), j = Math.max(0, Math.min(field.nz - 2, Math.floor(fz)));
  const tx = Math.min(1, Math.max(0, fx - i)), tz = Math.min(1, Math.max(0, fz - j));
  const d = field.data, n = field.nx;
  return (d[j * n + i] * (1 - tx) + d[j * n + i + 1] * tx) * (1 - tz) + (d[(j + 1) * n + i] * (1 - tx) + d[(j + 1) * n + i + 1] * tx) * tz;
}

// ---------------------------------------------------------------- campus trees (soft canopies on the map)
export function buildTrees(campus, frame, features) {
  const tf = campus.meta.transform;
  const blockers = features.filter((f) => f.kind === 'building' || f.kind === 'water' || f.kind === 'gate');
  const out = [];
  for (const t of campus.trees || []) {
    const c = planToCampus(t.p[0], t.p[1], tf);
    const w = frame.toWorld(c.x, c.z);
    if (Math.hypot(w.x, w.z) < 12) continue;                // the real tree stands here in 3D
    if (blockers.some((f) => featureSDF(f, w.x, w.z) < 0.9)) continue;   // same rule as the walk
    out.push({ x: w.x, z: w.z, r: t.t === 'palm' ? 2.4 * (t.s || 1) : 3.6 * (t.s || 1), kind: t.t, h: t.h || 1 });
  }
  return out;
}

/** Everything the map needs, from the project's own data. */
export function buildGeo(campus, extras = null, opts = {}) {
  const frame = makeFrame(campus, opts);
  const features = buildFeatures(campus, frame);
  const places = buildPlaces(campus, frame, features, extras);
  const trees = buildTrees(campus, frame, features);
  return {
    frame, features, places, trees, campus,
    notice: campus.meta.notice,
    orientation: campus.meta.orientation?.rule || '',
    verification: campus.meta.verification?.status || 'unverified'
  };
}
