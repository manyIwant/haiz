// Plane geometry for campus footprints. Pure functions, no dependencies.
//
// A footprint is an oriented rectangle in campus metres:
//   { cx, cz, hw, hd, rot }   centre, half-width (along local x), half-depth (local z), yaw (radians)
// The yaw follows three.js rotation.y as the walk and the map apply it
// (lanren/map/geo.js, lanren/map/campus-v3.js): local (lx, lz) → (cx + lx·cos + lz·sin, cz − lx·sin + lz·cos).

/** A plan rect [x0, y0, x1, y1] in plan pixels → campus-metre footprint (identical to geo.js rectCampus). */
export function rectToFootprint(rect, tf, rot = 0) {
  const [ox, oy] = tf.originPx, s = tf.scale;
  const x0 = (Math.min(rect[0], rect[2]) - ox) * s, x1 = (Math.max(rect[0], rect[2]) - ox) * s;
  const z0 = -(Math.max(rect[1], rect[3]) - oy) * s, z1 = -(Math.min(rect[1], rect[3]) - oy) * s;
  return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, hw: (x1 - x0) / 2, hd: (z1 - z0) / 2, rot };
}

/** The four corners of a footprint, counter-clockwise in (x, z). */
export function corners(f) {
  const c = Math.cos(f.rot || 0), s = Math.sin(f.rot || 0);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => {
    const lx = i * f.hw, lz = j * f.hd;
    return [f.cx + lx * c + lz * s, f.cz - lx * s + lz * c];
  });
}

export const area = (f) => 4 * f.hw * f.hd;

/** Signed area of a polygon [[x, z], ...]. */
export function polyArea(p) {
  let a = 0;
  for (let i = 0; i < p.length; i++) { const [x1, z1] = p[i], [x2, z2] = p[(i + 1) % p.length]; a += x1 * z2 - x2 * z1; }
  return a / 2;
}

/** Clip convex polygon `subject` by convex polygon `clip` (Sutherland–Hodgman). Both CCW or both CW. */
export function clipConvex(subject, clip) {
  const orient = Math.sign(polyArea(clip)) || 1;
  let out = subject.slice();
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length];
    const inside = (p) => orient * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) >= -1e-12;
    const cross = (p, q) => {
      const dx1 = q[0] - p[0], dz1 = q[1] - p[1], dx2 = b[0] - a[0], dz2 = b[1] - a[1];
      const den = dx1 * dz2 - dz1 * dx2;
      const t = ((a[0] - p[0]) * dz2 - (a[1] - p[1]) * dx2) / den;
      return [p[0] + t * dx1, p[1] + t * dz1];
    };
    const inp = out; out = [];
    for (let k = 0; k < inp.length; k++) {
      const p = inp[k], q = inp[(k + 1) % inp.length];
      const ip = inside(p), iq = inside(q);
      if (ip) out.push(p);
      if (ip !== iq) out.push(cross(p, q));
    }
  }
  return out;
}

/** Overlap area (m²) of two oriented rectangles. */
export function overlapArea(a, b) {
  const p = clipConvex(corners(a), corners(b));
  return p.length >= 3 ? Math.abs(polyArea(p)) : 0;
}

/** Is point (x, z) inside footprint f, grown by `pad` metres on every side? */
export function contains(f, x, z, pad = 0) {
  const c = Math.cos(f.rot || 0), s = Math.sin(f.rot || 0);
  const dx = x - f.cx, dz = z - f.cz;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  return Math.abs(lx) <= f.hw + pad && Math.abs(lz) <= f.hd + pad;
}

/** Distance from point (x, z) to footprint f (0 inside). */
export function distanceTo(f, x, z) {
  const c = Math.cos(f.rot || 0), s = Math.sin(f.rot || 0);
  const dx = x - f.cx, dz = z - f.cz;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  const ex = Math.max(0, Math.abs(lx) - f.hw), ez = Math.max(0, Math.abs(lz) - f.hd);
  return Math.hypot(ex, ez);
}

/** Smallest gap between two footprints (0 if they touch or overlap); sampled on edges, exact for axis-aligned. */
export function gap(a, b) {
  if (overlapArea(a, b) > 1e-9) return 0;
  const ca = corners(a), cb = corners(b);
  let best = Infinity;
  const seg = (p, q, r) => {
    const dx = q[0] - p[0], dz = q[1] - p[1];
    const t = Math.max(0, Math.min(1, ((r[0] - p[0]) * dx + (r[1] - p[1]) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(p[0] + t * dx - r[0], p[1] + t * dz - r[1]);
  };
  for (let i = 0; i < 4; i++) for (const r of cb) best = Math.min(best, seg(ca[i], ca[(i + 1) % 4], r));
  for (let i = 0; i < 4; i++) for (const r of ca) best = Math.min(best, seg(cb[i], cb[(i + 1) % 4], r));
  return best;
}

/** Union-find over n items. */
export function components(n, linked) {
  const parent = [...Array(n).keys()];
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (linked(i, j)) parent[find(i)] = find(j);
  const groups = new Map();
  for (let i = 0; i < n; i++) { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); }
  return [...groups.values()].sort((x, y) => y.length - x.length);
}

/**
 * Least-squares 2D similarity transform (Umeyama, no reflection) mapping src → dst.
 * Returns { scale, rot (radians, dst = s·R(rot)·src + t, counter-clockwise in a right-handed x/y frame), tx, ty, residuals, rms }.
 */
export function fitSimilarity(src, dst) {
  const n = src.length;
  if (n < 2) throw new Error('need at least two control points');
  const mean = (a, k) => a.reduce((s, p) => s + p[k], 0) / n;
  const sx = mean(src, 0), sy = mean(src, 1), dx = mean(dst, 0), dy = mean(dst, 1);
  let a = 0, b = 0, ss = 0;
  for (let i = 0; i < n; i++) {
    const px = src[i][0] - sx, py = src[i][1] - sy, qx = dst[i][0] - dx, qy = dst[i][1] - dy;
    a += px * qx + py * qy; b += px * qy - py * qx; ss += px * px + py * py;
  }
  const rot = Math.atan2(b, a), scale = Math.hypot(a, b) / ss;
  const c = Math.cos(rot) * scale, s = Math.sin(rot) * scale;
  const tx = dx - (c * sx - s * sy), ty = dy - (s * sx + c * sy);
  const apply = ([x, y]) => [c * x - s * y + tx, s * x + c * y + ty];
  const residuals = src.map((p, i) => { const q = apply(p); return Math.hypot(q[0] - dst[i][0], q[1] - dst[i][1]); });
  const rms = Math.sqrt(residuals.reduce((t, r) => t + r * r, 0) / n);
  return { scale, rot, tx, ty, residuals, rms, apply };
}
