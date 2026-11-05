// The camera over the campus.
//
// A map view is { tx, tz, s, pitch, yaw, fov, auth }: the ground point it looks
// at, the half-height of ground it frames there (metres, the zoom), how steeply
// it looks down (degrees below the horizon), its heading, its lens and V4's
// "authored for this screen" flag. The distance follows from the lens:
// d = s / tan(fov / 2), so changing the lens at constant s is a dolly zoom: the
// ground at the target keeps its size on screen while perspective flattens
// (after flat-to-3d 03 "Open Section", MIT; HAIZ's own implementation).
//
// Oblique is chapter 04 exactly as V4 frames it. Top is the user's choice: the
// camera turns to look straight down, north (towards the North Gate) up, and
// the lens narrows towards a plan.
import { GROUND_Y } from './geo.js';

const D2R = Math.PI / 180;
export const TOP = { pitch: 90, yaw: 180, fov: 20 };
export const LIMITS = { sMax: 330, eyeMin: 21, sMinAbs: 6 };

/** V4 rail frame {ex,ey,ez,lx,ly,lz,fov,auth} → map view (the ground point it looks at, same picture) */
export function viewFromPose(f) {
  let dx = f.lx - f.ex, dy = f.ly - f.ey, dz = f.lz - f.ez;
  const len = Math.hypot(dx, dy, dz);
  dx /= len; dy /= len; dz /= len;
  const t = (GROUND_Y - f.ey) / dy;   // along the view ray to the ground
  const pitch = Math.asin(-dy) / D2R;
  return { tx: f.ex + dx * t, tz: f.ez + dz * t, s: t * Math.tan((f.fov * D2R) / 2), pitch, yaw: Math.atan2(dx, dz) / D2R, fov: f.fov, auth: f.auth || 0 };
}
export function distanceOf(v) { return v.s / Math.tan((v.fov * D2R) / 2); }
export function dirOf(v) {
  const p = v.pitch * D2R, y = v.yaw * D2R;
  return { x: Math.sin(y) * Math.cos(p), y: -Math.sin(p), z: Math.cos(y) * Math.cos(p) };
}
export function eyeOf(v) {
  const d = distanceOf(v), r = dirOf(v);
  return { x: v.tx - r.x * d, y: GROUND_Y - r.y * d, z: v.tz - r.z * d };
}
/** back to a V4 rail frame (for handing the camera back to the DwellCamera) */
export function poseFromView(v) {
  const e = eyeOf(v), d = distanceOf(v);
  return { ex: e.x, ey: e.y, ez: e.z, lx: v.tx, ly: GROUND_Y, lz: v.tz, fov: v.fov, auth: v.auth, dist: d };
}
/** the closest a view may come: the eye stays well above the crown */
export function minScale(v) {
  return Math.max(LIMITS.sMinAbs, (LIMITS.eyeMin * Math.tan((v.fov * D2R) / 2)) / Math.max(0.2, Math.sin(v.pitch * D2R)));
}
export function clampScale(v) { v.s = Math.min(LIMITS.sMax, Math.max(minScale(v), v.s)); return v; }
/** keep the target on the campus sheet (open mode) */
export function clampToSheet(v, sheet, margin = 0) {
  v.tx = Math.min(sheet.x1 - margin, Math.max(sheet.x0 + margin, v.tx));
  v.tz = Math.min(sheet.z1 - margin, Math.max(sheet.z0 + margin, v.tz));
  return v;
}
/** zoom by factor f about ground point g: g stays under the same pixel (exact for any pitch) */
export function zoomAbout(v, g, f) {
  return { ...v, s: v.s * f, tx: g.x + (v.tx - g.x) * f, tz: g.z + (v.tz - g.z) * f };
}
/** same view, other look: oblique ↔ top keeps the target and the ground scale */
export function withLook(v, look) { return { ...v, pitch: look.pitch, yaw: look.yaw, fov: look.fov }; }

const lerp = (a, b, t) => a + (b - a) * t;
const lerpAngle = (a, b, t) => { let d = b - a; while (d > 180) d -= 360; while (d < -180) d += 360; return a + d * t; };
/** blend two views: scale in log space (zoom feels even), angles the short way */
export function mixView(a, b, t) {
  return { tx: lerp(a.tx, b.tx, t), tz: lerp(a.tz, b.tz, t), s: Math.exp(lerp(Math.log(a.s), Math.log(b.s), t)),
    pitch: lerp(a.pitch, b.pitch, t), yaw: lerpAngle(a.yaw, b.yaw, t), fov: lerp(a.fov, b.fov, t), auth: lerp(a.auth, b.auth, t) };
}
/** a move between two distant targets rises a little in the middle so the eye keeps its bearings */
export function flightView(a, b, t) {
  const v = mixView(a, b, t);
  const gap = Math.hypot(b.tx - a.tx, b.tz - a.tz);
  const lift = Math.min(1.8, 1 + gap / Math.max(a.s, b.s) / 6);
  v.s *= 1 + (lift - 1) * Math.sin(Math.PI * t);
  return v;
}
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/** Put a three.js camera at a view (uses V4's lens rules for narrow screens). */
export function applyView(camera, v, DwellCamera) {
  const e = eyeOf(v);
  camera.position.set(e.x, e.y, e.z);
  camera.rotation.set(-v.pitch * D2R, (v.yaw + 180) * D2R, 0, 'YXZ');
  const screen = DwellCamera.screen(camera);
  camera.fov = DwellCamera.fovFor(v.fov, screen, v.auth || 0);
  const d = distanceOf(v);
  camera.near = Math.min(20, Math.max(0.08, d * 0.02));
  camera.far = Math.max(1200, d * 3 + 400);
  DwellCamera.applyShift(camera);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

/** world point on the ground plane under normalised device coords, for a camera */
export function groundAt(camera, ndcX, ndcY, V3) {
  const o = camera.position.clone();
  const p = new V3(ndcX, ndcY, 0.5).unproject(camera).sub(o).normalize();
  if (p.y > -1e-4) return null;
  const t = (GROUND_Y - o.y) / p.y;
  return { x: o.x + p.x * t, z: o.z + p.z * t, dir: p, origin: o };
}
