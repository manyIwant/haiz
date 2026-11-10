// The site plan becomes the campus: one progress value u ∈ [0, 1] (pure, testable).
//
//   u = 0   the site plan: footprints, paths, lawns, the field; the buildings wait
//           whole beneath it
//   u = 1   the campus: every building standing, in material and in the sun
//
// Everything is a function of u, so folding back is the same film run backwards,
// and a fold started half-way through an unfold retraces exactly what was seen.
// Three things happen, overlapping:
//   1. the camera takes in the whole site plan (the lens narrows towards a plan),
//      then opens and lowers into a three-quarter view (flat-to-3d 03: the lens
//      widens while the frame on the ground is kept). Under the long lens the
//      risen roofs are still a plan: the drawing was the model all along
//   2. building by building, in the order the water reached them, each rises out
//      of its own footprint as a whole volume (walls and roof) in white card
//   3. a front from the tree's roots turns card into material, ground into
//      ground, and the campus's trees grow behind it
// (Casa Serra cuts one house at 1.2 m to show its rooms; a campus is read as a site
// plan. Here the 1.2 m cut is an optional look into one building, not the plan.)
import { mixView, easeInOut } from './view.js';

export const DURATION = { unfold: 6.4, fold: 3.6, reduced: 0.7 };
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };

/** how far a building whose (normalised) arrival order is `order` has risen out of its footprint */
export function riseAt(u, order) { return smooth((u - (0.17 + 0.3 * order)) / 0.3); }
/** the material front: fraction of its full radius, and how brightly its seam burns */
export function sweepAt(u) {
  const f = easeInOut(clamp01((u - 0.46) / 0.5));
  return { f, glow: f > 0 && f < 1 ? smooth(f / 0.06) * (1 - smooth((f - 0.82) / 0.18)) : 0 };
}
/** labels rest during the change and come back where they now belong */
export function labelsAt(u) { return clamp01(u <= 0.04 ? 1 - u / 0.04 : u >= 0.96 ? (u - 0.96) / 0.04 : 0); }
/** camera blend weights: towards the whole drawing first, then into the campus */
export function cameraWeights(u) { return { e1: easeInOut(clamp01(u / 0.34)), e2: easeInOut(clamp01((u - 0.16) / 0.76)) }; }
/** the camera at u along A (where the plan was) → M (the whole drawing) → B (the campus) */
export function cameraAt(path, u) {
  const { e1, e2 } = cameraWeights(u);
  return mixView(mixView(path.A, path.M, e1), path.B, e2);
}

/**
 * Key views for the change, from where the visitor is.
 * extent: the campus's built extent in world x/z; aspect: screen width / height.
 */
export function unfoldPath(A, extent, aspect, northYaw = 180) {
  const cx = (extent.x0 + extent.x1) / 2, cz = (extent.z0 + extent.z1) / 2;
  const hw = (extent.x1 - extent.x0) / 2, hd = (extent.z1 - extent.z0) / 2;
  // the campus's own axes (a composition may turn the campus about the tree; see geo.js)
  const R = ((northYaw - 180) * Math.PI) / 180, c = Math.cos(R), sn = Math.sin(R);
  const hwC = hw * Math.abs(c) + hd * Math.abs(sn), hdC = hd * Math.abs(c) + hw * Math.abs(sn);
  const ox = hwC * 0.3, oz = hdC * 0.02;
  // the whole drawing: nearly straight down, a long lens, the campus filling the frame
  const M = { tx: cx, tz: cz, s: Math.max(hd * 1.08, (hw * 1.08) / aspect), pitch: 86, yaw: A.yaw, fov: 26, auth: A.auth };
  // the campus: from the north-west, over the tree towards the teaching blocks; the low sun of
  // chapter 04 comes from the left, north fronts lit and west fronts in shade
  // (framed on the buildings: the sports field stays at the edge of the picture)
  // (a portrait screen crops the campus's sides rather than shrinking it to a strip)
  const B = { tx: cx + ox * c + oz * sn, tz: cz - ox * sn + oz * c, s: Math.max(hdC * 0.6, (hwC * 0.66) / Math.max(aspect, 0.8)), pitch: 37, yaw: 34 + (northYaw - 180), fov: 36, auth: A.auth };
  return { A: { ...A }, M, B };
}
/** folding back from wherever the visitor stands in 3D: to the plan straight below that view */
export function foldPath(B, look) {
  const A = { ...B, pitch: look.pitch, yaw: look.yaw, fov: look.fov };
  // same ground at the target, seen as a plan (the scale grows a little: the lens narrows)
  A.s = B.s * 0.9;
  return { A, M: { ...A }, B: { ...B } };
}
