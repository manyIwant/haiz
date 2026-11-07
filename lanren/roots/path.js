// Chapter 02's own camera rail: from V4's shot 02 at the foot of the trunk,
// up the trunk, over the fork and out along the limb to the new leaves that
// V4's shot 03 looks at. Pure maths (testable in Node), like chapters.js.
//
// The walk between shot 02 (p = 1) and shot 03 (p = 2) is divided into equal
// stretches of scroll, one per station: s = p - 1 ∈ [0, 1]. The camera eases
// into every station (it rests a moment, never fully stops) and travels on a
// Catmull–Rom curve through them, turning by yaw/pitch so every turn is a pan.

const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/** V4's hold: eases into a station but never fully stops (chapters.js ease). */
export function ease(f) { return f - Math.sin(2 * Math.PI * f) / (2 * Math.PI) * 0.82; }

/** s of every station: 0 = shot 02, then one per node, 1 = shot 03. */
export function stationS(nodeCount) {
  const m = nodeCount + 1;
  return Array.from({ length: nodeCount + 2 }, (_, j) => j / m);
}

function orient(eye, look) {
  const dx = look[0] - eye[0], dy = look[1] - eye[1], dz = look[2] - eye[2];
  return { yaw: Math.atan2(dx, dz) / D2R, pitch: Math.atan2(dy, Math.hypot(dx, dz)) / D2R, dist: Math.hypot(dx, dy, dz) };
}

/** Where a node's camera looks: just above the bark it lights, or its own `look`. */
export function lookOf(at) {
  if (at.look) return at.look;
  return [at.target[0], at.target[1] + 0.18, at.target[2]];
}

/**
 * frames for the rail. shot1/shot2 are resolved V4 keys (chapters.js shot()).
 * nodes: history NODES (at.eye/at.target may have been re-found on the bark).
 */
export function buildFrames(nodes, shot1, shot2) {
  const s = stationS(nodes.length);
  const fromShot = (k, t) => ({ t, ex: k.ex, ey: k.ey, ez: k.ez, yaw: k.yaw, pitch: k.pitch, fov: k.fov, dist: k.dist, auth: k.auth || 0, focus: k.dist });
  const frames = [fromShot(shot1, 0)];
  nodes.forEach((n, i) => {
    const look = lookOf(n.at);
    const o = orient(n.at.eye, look);
    const tgt = n.at.target || look;
    const focus = Math.hypot(tgt[0] - n.at.eye[0], tgt[1] - n.at.eye[1], tgt[2] - n.at.eye[2]);
    frames.push({ t: s[i + 1], ex: n.at.eye[0], ey: n.at.eye[1], ez: n.at.eye[2], ...o, fov: n.at.fov || 44, auth: 0, focus });
  });
  frames.push(fromShot(shot2, 1));
  // each turn the short way
  for (let i = 1; i < frames.length; i++) {
    while (frames[i].yaw - frames[i - 1].yaw > 180) frames[i].yaw -= 360;
    while (frames[i].yaw - frames[i - 1].yaw < -180) frames[i].yaw += 360;
  }
  return frames;
}

function crNU(t0, t1, t2, t3, p0, p1, p2, p3, t) {
  const m1 = (p2 - p0) / Math.max(1e-6, t2 - t0) * (t2 - t1);
  const m2 = (p3 - p1) / Math.max(1e-6, t3 - t1) * (t2 - t1);
  const u = (t - t1) / (t2 - t1), u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * m2;
}
const CH = ['ex', 'ey', 'ez', 'yaw', 'pitch', 'fov', 'dist', 'auth', 'focus'];

/** Camera at s ∈ [0, 1] (same shape as chapters.poseAt, plus `focus`). */
export function poseOn(frames, s) {
  const n = frames.length;
  const q = clamp(s, 0, 1) * (n - 1);
  const k = Math.min(n - 2, Math.floor(q));
  const u = ease(q - k);                  // hold at every station
  const a = frames[Math.max(0, k - 1)], b = frames[k], c = frames[k + 1], d = frames[Math.min(n - 1, k + 2)];
  const o = {};
  for (const ch of CH) {
    const pa = k > 0 ? a[ch] : b[ch] - (c[ch] - b[ch]);
    const pd = k + 2 < n ? d[ch] : c[ch] + (c[ch] - b[ch]);
    // uniform knots in station index space
    o[ch] = crNU(k - 1, k, k + 1, k + 2, pa, b[ch], c[ch], pd, k + u);
  }
  const yaw = o.yaw * D2R, pitch = clamp(o.pitch, -89, 89) * D2R, dist = Math.max(0.3, o.dist);
  return {
    ex: o.ex, ey: o.ey, ez: o.ez, fov: o.fov, dist, auth: clamp(o.auth, 0, 1), focus: Math.max(0.4, o.focus),
    lx: o.ex + Math.sin(yaw) * Math.cos(pitch) * dist, ly: o.ey + Math.sin(pitch) * dist, lz: o.ez + Math.cos(yaw) * Math.cos(pitch) * dist
  };
}

/** Station index nearest to s, and how settled the camera is there (1 = resting). */
export function stationAt(s, nodeCount) {
  const m = nodeCount + 1;
  const q = clamp(s, 0, 1) * m;
  const j = Math.round(q);
  return { j, settle: 1 - Math.min(1, Math.abs(q - j) * 3) };
}

/**
 * The limb chapter 02 climbs, from the fork to the leaves V4's shot 03 looks at.
 * Found on the locked tree (seed 2611) by a shortest path through the bark's
 * densest voxels; tests/roots-browser.cjs checks it still lies on the bark.
 */
export const LIMB = [
  [0.12, 3.07, -0.16], [0.7, 3.53, 0.41], [1.34, 4.03, 1.09], [1.89, 4.08, 1.67], [2.51, 4.62, 2.29], [3.16, 4.98, 2.28],
  [3.75, 5.6, 2.85], [4.28, 5.51, 2.89], [4.95, 6.17, 2.54], [5.6, 6.46, 2.26], [6.15, 6.46, 2.2], [6.73, 6.71, 1.65],
  [7.32, 6.49, 1.7], [7.96, 6.12, 1.7], [8.53, 6.11, 2.05], [9.22, 6.03, 2.53], [9.72, 6.05, 2.61], [10.35, 6.24, 3.14], [10.98, 6.41, 3.71]
];

/**
 * The grain of the wood at a point: the limb's direction if the point lies on
 * it (smoothed over neighbouring samples), otherwise straight up (the trunk).
 */
export function axisAt(p, limb = LIMB, reach = 0.9) {
  let best = -1, bd = 1e9;
  for (let i = 0; i < limb.length - 1; i++) {
    const a = limb[i], b = limb[i + 1];
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
    const L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
    const t = clamp((ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / L2, 0, 1);
    const d = Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t);
    if (d < bd) { bd = d; best = i; }
  }
  if (bd > reach || best < 0) return [0, 1, 0];
  const i0 = Math.max(0, best - 1), i1 = Math.min(limb.length - 1, best + 2);
  const v = [limb[i1][0] - limb[i0][0], limb[i1][1] - limb[i0][1], limb[i1][2] - limb[i0][2]];
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}

/** Lean in towards what the station looks at (reading a node). k ∈ [0, 1]. */
export function lean(pose, target, k) {
  if (!target || k <= 0) return pose;
  const e = [pose.ex, pose.ey, pose.ez];
  const t = target;
  const m = 0.32 * k;
  const ex = e[0] + (t[0] - e[0]) * m, ey = e[1] + (t[1] - e[1]) * m, ez = e[2] + (t[2] - e[2]) * m;
  const lx = pose.lx + (t[0] - pose.lx) * k * 0.6, ly = pose.ly + (t[1] - pose.ly) * k * 0.6, lz = pose.lz + (t[2] - pose.lz) * k * 0.6;
  return { ...pose, ex, ey, ez, lx, ly, lz, dist: Math.hypot(lx - ex, ly - ey, lz - ez), fov: pose.fov * (1 - 0.08 * k), focus: Math.hypot(t[0] - ex, t[1] - ey, t[2] - ez) };
}
