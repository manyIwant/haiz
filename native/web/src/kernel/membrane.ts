/**
 * 同源 · One contour.
 *
 * Every surface that grows out of another — the dock's stage, a popover from its button, the
 * lens from the search field — is drawn as ONE closed outline: a rounded base with a bump that
 * rises from one of its edges, joined by concave fillets that stay tangent all the way round.
 * (Experiment 004's System B drew one such contour for the dock; this generalises it.)
 *
 * All subpaths are wound clockwise in screen space, so several can be unioned by a nonzero fill
 * (clip-path: path()) — the dock's satellite lens and its liquid neck use that.
 */
import { clamp } from "./motion";

const K = 0.5523; // cubic handle for a quarter circle
const f2 = (n: number) => (Math.round(n * 100) / 100).toString();
const P = (x: number, y: number) => `${f2(x)} ${f2(y)}`;

export type Bump = {
  /** centre x of the bump */
  cx: number;
  /** wanted width of the bump */
  w: number;
  /** height above (or below) the base edge */
  h: number;
  /** roof corner radius */
  r: number;
  /** concave fillet radius where the bump meets the base */
  f: number;
};

/**
 * A rounded rectangle [x0, x1] × [y0, y1] with corner radius R and an optional bump on its
 * top (side = -1) or bottom (side = 1) edge. Returns the path and where the bump really sits
 * after clamping (so content can be placed inside it).
 */
export function bumped(
  x0: number, y0: number, x1: number, y1: number, R: number,
  bump: Bump | null, side: -1 | 1 = -1,
): { d: string; bx0: number; bx1: number; by: number } {
  R = Math.max(0, Math.min(R, (x1 - x0) / 2, (y1 - y0) / 2));
  const H = bump ? Math.max(0, bump.h) : 0;
  if (!bump || H < 0.25) {
    return { d: rrectPath(x0, y0, x1, y1, R), bx0: 0, bx1: 0, by: side < 0 ? y0 : y1 };
  }
  // fillets and roof radii shrink with the bump so growth starts from nothing, smoothly
  const f = Math.min(bump.f, H * 0.55);
  const maxW = Math.max(0, x1 - x0 - 2 * R * 0.55 - 2 * f);
  const w = Math.min(bump.w, maxW);
  const half = w / 2;
  const lo = x0 + R * 0.55 + f + half, hi = x1 - R * 0.55 - f - half;
  const cx = lo <= hi ? clamp(bump.cx, lo, hi) : (x0 + x1) / 2;
  const wl = cx - half, wr = cx + half;
  const cr = Math.max(0, Math.min(bump.r, half, H - f));

  if (side < 0) {
    const e = y0, roof = y0 - H;
    const d = [
      `M${P(x0 + R, e)}`,
      `L${P(wl - f, e)}`,
      `C${P(wl - f + f * K, e)} ${P(wl, e - f + f * K)} ${P(wl, e - f)}`,
      `L${P(wl, roof + cr)}`,
      `C${P(wl, roof + cr - cr * K)} ${P(wl + cr - cr * K, roof)} ${P(wl + cr, roof)}`,
      `L${P(wr - cr, roof)}`,
      `C${P(wr - cr + cr * K, roof)} ${P(wr, roof + cr - cr * K)} ${P(wr, roof + cr)}`,
      `L${P(wr, e - f)}`,
      `C${P(wr, e - f + f * K)} ${P(wr + f - f * K, e)} ${P(wr + f, e)}`,
      `L${P(x1 - R, e)}`,
      corner(x1, y0, R, "tr"),
      `L${P(x1, y1 - R)}`,
      corner(x1, y1, R, "br"),
      `L${P(x0 + R, y1)}`,
      corner(x0, y1, R, "bl"),
      `L${P(x0, y0 + R)}`,
      corner(x0, y0, R, "tl"),
      "Z",
    ].join("");
    return { d, bx0: wl, bx1: wr, by: roof };
  }
  const e = y1, floor = y1 + H;
  const d = [
    `M${P(x0 + R, y0)}`,
    `L${P(x1 - R, y0)}`,
    corner(x1, y0, R, "tr"),
    `L${P(x1, y1 - R)}`,
    corner(x1, y1, R, "br"),
    `L${P(wr + f, e)}`,
    `C${P(wr + f - f * K, e)} ${P(wr, e + f - f * K)} ${P(wr, e + f)}`,
    `L${P(wr, floor - cr)}`,
    `C${P(wr, floor - cr + cr * K)} ${P(wr - cr + cr * K, floor)} ${P(wr - cr, floor)}`,
    `L${P(wl + cr, floor)}`,
    `C${P(wl + cr - cr * K, floor)} ${P(wl, floor - cr + cr * K)} ${P(wl, floor - cr)}`,
    `L${P(wl, e + f)}`,
    `C${P(wl, e + f - f * K)} ${P(wl - f + f * K, e)} ${P(wl - f, e)}`,
    `L${P(x0 + R, y1)}`,
    corner(x0, y1, R, "bl"),
    `L${P(x0, y0 + R)}`,
    corner(x0, y0, R, "tl"),
    "Z",
  ].join("");
  return { d, bx0: wl, bx1: wr, by: floor };
}

/** The corner arc *arriving at* the edge after the named corner, clockwise. */
function corner(x: number, y: number, R: number, which: "tl" | "tr" | "br" | "bl") {
  if (R <= 0) return "";
  const k = R * K;
  switch (which) {
    case "tr": return `C${P(x - R + k, y)} ${P(x, y + R - k)} ${P(x, y + R)}`;
    case "br": return `C${P(x, y - R + k)} ${P(x - R + k, y)} ${P(x - R, y)}`;
    case "bl": return `C${P(x + R - k, y)} ${P(x, y - R + k)} ${P(x, y - R)}`;
    case "tl": return `C${P(x, y + R - k)} ${P(x + R - k, y)} ${P(x + R, y)}`;
  }
}

export function rrectPath(x0: number, y0: number, x1: number, y1: number, R: number) {
  R = Math.max(0, Math.min(R, (x1 - x0) / 2, (y1 - y0) / 2));
  return [
    `M${P(x0 + R, y0)}`, `L${P(x1 - R, y0)}`, corner(x1, y0, R, "tr"),
    `L${P(x1, y1 - R)}`, corner(x1, y1, R, "br"),
    `L${P(x0 + R, y1)}`, corner(x0, y1, R, "bl"),
    `L${P(x0, y0 + R)}`, corner(x0, y0, R, "tl"), "Z",
  ].join("");
}

/** A circle, clockwise, as four cubics. */
export function circlePath(cx: number, cy: number, r: number) {
  const k = r * K;
  return [
    `M${P(cx, cy - r)}`,
    `C${P(cx + k, cy - r)} ${P(cx + r, cy - k)} ${P(cx + r, cy)}`,
    `C${P(cx + r, cy + k)} ${P(cx + k, cy + r)} ${P(cx, cy + r)}`,
    `C${P(cx - k, cy + r)} ${P(cx - r, cy + k)} ${P(cx - r, cy)}`,
    `C${P(cx - r, cy - k)} ${P(cx - k, cy - r)} ${P(cx, cy - r)}Z`,
  ].join("");
}

/**
 * A liquid neck between a circle on the left (centre ax, radius ar) and one on the right
 * (bx, br), both on the line y = cy. b ∈ [0, 1] is how far the bridge has formed: at 0 there
 * is none, at 1 it is nearly as tall as the smaller circle. Its inner chords lie inside both
 * circles, so a nonzero union shows only its two concave curves.
 */
export function neckPath(ax: number, ar: number, bx: number, br: number, cy: number, b: number) {
  if (b < 0.02) return "";
  const a = (b * 64 * Math.PI) / 180;
  const sa = Math.sin(a), ca = Math.cos(a);
  const p1 = [ax + ar * ca, cy - ar * sa], p2 = [bx - br * ca, cy - br * sa];
  const q1 = [ax + ar * ca, cy + ar * sa], q2 = [bx - br * ca, cy + br * sa];
  const gap = Math.max(1, p2[0] - p1[0]);
  const d = gap * (0.55 - 0.15 * b);
  // the sag toward the centre line: thin when just forming, full when formed
  const sag = (1 - b) * Math.min(ar, br) * 0.55;
  return [
    `M${P(p1[0], p1[1])}`,
    `C${P(p1[0] + d * sa, p1[1] + d * ca * 0.6 + sag)} ${P(p2[0] - d * sa, p2[1] + d * ca * 0.6 + sag)} ${P(p2[0], p2[1])}`,
    `L${P(q2[0], q2[1])}`,
    `C${P(q2[0] - d * sa, q2[1] - d * ca * 0.6 - sag)} ${P(q1[0] + d * sa, q1[1] - d * ca * 0.6 - sag)} ${P(q1[0], q1[1])}`,
    "Z",
  ].join("");
}

/* ------------------------------------------------------------------------------------------ */

export type Box = { x0: number; y0: number; x1: number; y1: number; R: number };
export type Dir = "up" | "down" | "left" | "right";

const toC: Record<Dir, (x: number, y: number) => [number, number]> = {
  up: (x, y) => [x, y],
  down: (x, y) => [-x, -y],
  right: (x, y) => [y, -x],
  left: (x, y) => [-y, x],
};
const fromC: Record<Dir, (x: number, y: number) => [number, number]> = {
  up: (x, y) => [x, y],
  down: (x, y) => [-x, -y],
  right: (x, y) => [-y, x],
  left: (x, y) => [y, -x],
};

/**
 * 同源 · the general one contour: a STAGE grown out of one edge of a BASE, both rounded boxes,
 * joined by concave fillets. `dir` says on which side of the base the stage sits.
 *
 * The stage may be narrower than the base (a bump, a swell) or wider (a T, a canopy); each side
 * of the junction blends continuously through "exactly as wide", where it becomes one straight
 * edge. Every arc is a quarter ellipse whose depth is capped by the box it lives in, so a stage
 * of height 0 is a flat line and grows out of the base with no seam, no pop.
 * Winding is clockwise in screen space for every dir (only rotations are used).
 */
export function stack(stage: Box, base: Box, f: number, dir: Dir = "up"): string {
  const c = toC[dir], o = fromC[dir];
  const box = (b: Box) => {
    const [ax, ay] = c(b.x0, b.y0), [bx, by] = c(b.x1, b.y1);
    return { x0: Math.min(ax, bx), x1: Math.max(ax, bx), y0: Math.min(ay, by), y1: Math.max(ay, by), R: b.R };
  };
  const B = box(base), T0 = box(stage);
  const hB = B.y1 - B.y0, wB = B.x1 - B.x0;
  const J = B.y0;
  const T = { x0: T0.x0, x1: T0.x1, y0: Math.min(T0.y0, J), y1: J, R: T0.R };
  const hT = T.y1 - T.y0, wT = T.x1 - T.x0;
  const out = (x: number, y: number) => { const [sx, sy] = o(x, y); return P(sx, sy); };
  if (hT < 0.3 || wT < 1) {
    const [ax, ay] = o(B.x0, B.y0), [bx, by] = o(B.x1, B.y1);
    return rrectPath(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by), B.R);
  }
  const cmd: string[] = [];
  const M = (x: number, y: number) => cmd.push(`M${out(x, y)}`);
  const L = (x: number, y: number) => cmd.push(`L${out(x, y)}`);
  let px = 0, py = 0;
  const at = (x: number, y: number) => { px = x; py = y; };
  /** quarter ellipse from the current point to (x, y); vStart = the tangent at the start is vertical */
  const A = (x: number, y: number, vStart: boolean) => {
    const dx = x - px, dy = y - py;
    const c1 = vStart ? [px, py + K * dy] : [px + K * dx, py];
    const c2 = vStart ? [x - K * dx, y] : [x, y - K * dy];
    cmd.push(`C${out(c1[0], c1[1])} ${out(c2[0], c2[1])} ${out(x, y)}`);
    at(x, y);
  };
  const Lt = (x: number, y: number) => { L(x, y); at(x, y); };

  const rT = Math.max(0, Math.min(T.R, wT / 2)), rTy = Math.min(rT, hT / 2);
  const rB = Math.max(0, Math.min(B.R, wB / 2, hB / 2));
  f = Math.max(0, f);

  M(T.x0 + rT, T.y0); at(T.x0 + rT, T.y0);
  Lt(T.x1 - rT, T.y0);
  A(T.x1, T.y0 + rTy, false);
  // right junction
  {
    const d = T.x1 - B.x1;
    if (d >= 0) {
      const fx = Math.min(f, d * 0.5), rax = Math.min(T.R, d - fx), ray = Math.min(rax, hT / 2), fy = Math.min(fx, hB / 2);
      Lt(T.x1, J - ray);
      A(T.x1 - rax, J, true);
      Lt(B.x1 + fx, J);
      A(B.x1, J + fy, false);
    } else {
      const e = -d, fx = Math.min(f, e * 0.5), rbx = Math.min(B.R, e - fx), rby = Math.min(rbx, hB / 2), fy = Math.min(fx, hT / 2);
      Lt(T.x1, J - fy);
      A(T.x1 + fx, J, true);
      Lt(B.x1 - rbx, J);
      A(B.x1, J + rby, false);
    }
  }
  Lt(B.x1, B.y1 - rB);
  A(B.x1 - rB, B.y1, true);
  Lt(B.x0 + rB, B.y1);
  A(B.x0, B.y1 - rB, false);
  // left junction
  {
    const d = B.x0 - T.x0;
    if (d >= 0) {
      const fx = Math.min(f, d * 0.5), rax = Math.min(T.R, d - fx), ray = Math.min(rax, hT / 2), fy = Math.min(fx, hB / 2);
      Lt(B.x0, J + fy);
      A(B.x0 - fx, J, true);
      Lt(T.x0 + rax, J);
      A(T.x0, J - ray, false);
    } else {
      const e = -d, fx = Math.min(f, e * 0.5), rbx = Math.min(B.R, e - fx), rby = Math.min(rbx, hB / 2), fy = Math.min(fx, hT / 2);
      Lt(B.x0, J + rby);
      A(B.x0 + rbx, J, true);
      Lt(T.x0 - fx, J);
      A(T.x0, J - fy, false);
    }
  }
  Lt(T.x0, T.y0 + rTy);
  A(T.x0 + rT, T.y0, true);
  cmd.push("Z");
  return cmd.join("");
}

/** A rounded box path for a Box. */
export const boxPath = (b: Box) => rrectPath(b.x0, b.y0, b.x1, b.y1, b.R);
