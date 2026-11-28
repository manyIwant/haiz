/**
 * HAIZ 006 · 液面 (liquid surface kernel)
 *
 * One way to make every glass surface in 006: describe it as a signed distance field — a wall,
 * a few capsules — join them with a smooth minimum (surface tension: two drops that come close
 * reach for each other and fuse with a meniscus), and trace the zero line with marching squares
 * (d3-contour, the mature implementation, rather than our own). The traced ring is smoothed into
 * quadratic Béziers and used three ways at once: as the glass's clip-path, as its lit rim, and as
 * the hairline datum that the surface grows out of.
 *
 * Nothing here knows about the DOM; callers turn the result into CSS/SVG.
 */
import { contours } from "d3-contour";

export type Capsule = { x: number; y: number; rx: number; ry: number };
export type Sdf = (x: number, y: number) => number;

/** signed distance to an axis-aligned capsule / stadium (rounded box with full radius on the short side) */
export function sdCapsule(px: number, py: number, c: Capsule): number {
  const r = Math.min(c.rx, c.ry);
  const qx = Math.abs(px - c.x) - (c.rx - r);
  const qy = Math.abs(py - c.y) - (c.ry - r);
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}

/** signed distance to an ellipse (cheap approximation, good enough for drops) */
export function sdEllipse(px: number, py: number, c: Capsule): number {
  const dx = (px - c.x) / c.rx, dy = (py - c.y) / c.ry;
  const k = Math.hypot(dx, dy);
  return (k - 1) * Math.min(c.rx, c.ry);
}

/** polynomial smooth minimum: k is the meniscus width in px */
export function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

export type Ring = [number, number][];
export type Traced = { rings: Ring[]; d: string };

/**
 * Trace the zero line of `sdf` (negative = inside) over a box, at `cell` px resolution.
 * Returns smoothed rings (in the caller's coordinates) and one SVG path for all of them.
 */
export function trace(sdf: Sdf, x0: number, y0: number, w: number, h: number, cell = 2.5): Traced {
  const n = Math.max(2, Math.ceil(w / cell) + 1), m = Math.max(2, Math.ceil(h / cell) + 1);
  const vals = new Float64Array(n * m);
  for (let j = 0; j < m; j++) {
    const y = y0 + j * cell;
    for (let i = 0; i < n; i++) vals[i + j * n] = -sdf(x0 + i * cell, y);
  }
  // pad with "outside" so every ring closes inside the box instead of along its border
  for (let i = 0; i < n; i++) { vals[i] = Math.min(vals[i], -1); vals[i + (m - 1) * n] = Math.min(vals[i + (m - 1) * n], -1); }
  for (let j = 0; j < m; j++) { vals[j * n] = Math.min(vals[j * n], -1); vals[n - 1 + j * n] = Math.min(vals[n - 1 + j * n], -1); }
  const [mp] = contours().size([n, m]).thresholds([0])(Array.from(vals));
  const rings: Ring[] = [];
  for (const poly of mp.coordinates) {
    const outer = poly[0];
    if (!outer || outer.length < 4) continue;
    // d3-contour places grid samples at half-integer positions
    rings.push(outer.map(([gx, gy]) => [x0 + (gx - 0.5) * cell, y0 + (gy - 0.5) * cell] as [number, number]));
  }
  return { rings, d: rings.map(smoothRing).join("") };
}

const f = (v: number) => (Math.round(v * 100) / 100).toString();

/** closed ring → smooth path through edge midpoints (quadratic B-spline) */
export function smoothRing(r: Ring): string {
  const pts = r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r.slice(0, -1) : r;
  const N = pts.length;
  if (N < 3) return "";
  const mid = (a: [number, number], b: [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[N - 1], pts[0]);
  let d = `M${f(m0[0])} ${f(m0[1])}`;
  for (let i = 0; i < N; i++) {
    const p = pts[i], q = pts[(i + 1) % N];
    const mm = mid(p, q);
    d += `Q${f(p[0])} ${f(p[1])} ${f(mm[0])} ${f(mm[1])}`;
  }
  return d + "Z";
}

/** where each ring touches the wall x ≈ wx: [yTop, yBottom] spans (used to break the datum) */
export function wallSpans(rings: Ring[], wx: number, tol = 1.6): [number, number][] {
  const out: [number, number][] = [];
  for (const r of rings) {
    let a = Infinity, b = -Infinity;
    for (const [x, y] of r) if (x <= wx + tol) { a = Math.min(a, y); b = Math.max(b, y); }
    if (a < b) out.push([a, b]);
  }
  return out.sort((p, q) => p[0] - q[0]);
}
