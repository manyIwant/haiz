// The seventh view: the sun's seat (pure; Node-testable).
//
// Six shots look at the tree, or out of it. Each of them is lit by the same thing, and that thing has
// a view of its own, which no shot has taken: the view along the light. It has one property no other
// view has. Seen from the light's own seat every shadow lies exactly behind the thing that casts it, so
// there are none: a shadow is what a viewer sees of the difference between their place and the sun's.
//
// The world's clock (lanren/world/clock.js) gave the campus one real sun. This module puts a camera
// in it:
//
//   seat      the camera on the sun's ray through a centre, so far off that its rays are all but
//             parallel (a dolly zoom out along the ray: what is framed keeps its size, the perspective
//             closes up; person, tree and school come to their true proportions)
//   pull      0 the walker's own eye at 06 … 1 the seat. Continuous: the way there is part of the view
//   lean      a few degrees out of the light. Shadows come out from behind things; let go and they return
//   instant   any day of the film's spring and any hour of its daylight; the seat stays in the sun
//
// What follows from the campus as it is modelled and the ephemeris (tests/seventh.cjs checks each):
//   - 01's viewer stands where 06's walker stands. At 01's instant the sun is behind 一号教学楼: the
//     tree is in the school's shadow and the viewer in both. The sun cannot see the first frame.
//   - through the morning the school's shadow draws down off the tree: from the seat the crown rises
//     over the roof (the trunk's foot only when the sun is about 50° up)
//   - on the film's last day (15 May) the noon sun stands 88.8° up: the seat looks straight down and
//     nothing has a shadow. That picture is chapter 04's plan
//   - at the last light the walker, the trunk and the school stand in one line of sight
import { sunPosition, haikouToMs, haikouParts, dayOfYearFor, formatClock, monthDayOf } from '../js/sun.js';
import { solarAt, TIMELINE, YEAR } from '../world/clock.js';

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** how far off the seat is (m). At this distance a thing 20 m off the axis shows 0.2 m of a 200 m shadow. */
export const FAR = 20000;
/** the pull at which the camera has turned from the walker's gaze onto the ray (the rest is distance only) */
export const TURNED = 0.2;
/** the film's spring: its first and last day (clock.js TIMELINE) */
export const SPRING = [dayOfYearFor(TIMELINE[0].month, TIMELINE[0].day), dayOfYearFor(TIMELINE[TIMELINE.length - 1].month, TIMELINE[TIMELINE.length - 1].day)];
/** the seat does not follow the sun below this height (degrees): the ground's own light is too weak under it */
export const LOWEST = 3.2;
/** the plan's "up" on the screen when the seat looks straight down: chapter 04's own (chapters.js KEYS t = 3 looks towards -Z) */
export const PLAN_UP = [0, 0, -1];

/** unit vector towards the sun for a world heading and height (degrees; chapters.js convention: heading = atan2(x, z)) */
export function sunVector(az, el) {
  const a = az * D2R, e = el * D2R;
  return [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
}
const slerp = (a, b, t) => {
  const d = clamp(dot(a, b), -1, 1), w = Math.acos(d);
  if (w < 1e-5) return norm(mix3(a, b, t));
  const s = Math.sin(w);
  return norm(add([a[0] * Math.sin((1 - t) * w) / s, a[1] * Math.sin((1 - t) * w) / s, a[2] * Math.sin((1 - t) * w) / s], b, Math.sin(t * w) / s));
};

// ---------------------------------------------------------------- instants
/** an instant of the spring: { doy, minutes } → epoch ms, the sun over the campus, a label */
export function instantAt(doy, minutes, rotation = 0) {
  const whole = Math.floor(doy + 1e-9), frac = clamp(doy - whole, 0, 1);
  const ms = haikouToMs(YEAR, whole, minutes);
  const s = solarAt({ ms, dayFrac: frac }, rotation);
  const md = monthDayOf(Math.round(doy));
  return { doy, minutes, ms, sunAz: s.sunAz, sunEl: s.sunEl, bearing: s.bearing, dir: sunVector(s.sunAz, s.sunEl), month: md.month, day: md.day, clock: formatClock(minutes), label: `${md.month}月${md.day}日 ${formatClock(minutes)}` };
}
/** the instant an epoch ms is, as { doy, minutes } */
export function instantOfMs(ms) { const h = haikouParts(ms); return { doy: h.dayOfYear, minutes: h.minutes }; }
const dayCache = new Map();
/** the daylight the seat keeps to on a day: [first, last] minute with the sun at least LOWEST up, and the noon (highest) */
export function daylight(doy) {
  const key = Math.round(doy);
  if (dayCache.has(key)) return dayCache.get(key);
  const el = (m) => sunPosition(haikouToMs(YEAR, key, m)).altitude * R2D;
  let noon = 720, top = -90;
  for (let m = 660; m <= 840; m += 0.5) { const e = el(m); if (e > top) { top = e; noon = m; } }
  const cross = (lo, hi) => { for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if ((el(mid) > LOWEST) === (el(hi) > LOWEST)) hi = mid; else lo = mid; } return (lo + hi) / 2; };
  const out = { first: cross(240, noon), last: cross(1260, noon), noon, top };
  dayCache.set(key, out);
  return out;
}
/** keep an instant inside the spring and its day's light */
export function clampInstant(doy, minutes) {
  const d = clamp(doy, SPRING[0], SPRING[1]), day = daylight(d);
  return { doy: d, minutes: clamp(minutes, day.first, day.last) };
}
/** the tree's growth on a day of the spring: the film's own knots (dates: clock.js TIMELINE; growth: chapters.js GROW) */
export function growOn(doy, GROW = [0.0, 0.31, 0.5, 0.7, 0.86, 1.0]) {
  const K = TIMELINE.map((k) => [dayOfYearFor(k.month, k.day), GROW[k.p]]);
  if (doy <= K[0][0]) return K[0][1];
  for (let i = 0; i < K.length - 1; i++) if (doy <= K[i + 1][0]) return K[i][1] + (K[i + 1][1] - K[i][1]) * ((doy - K[i][0]) / (K[i + 1][0] - K[i][0]));
  return K[K.length - 1][1];
}
/**
 * Which of the film's light keys (chapters.js LIGHT, as lightAt(p) blends them) an instant is lit by: the
 * sun's height on its side of noon picks the place between the shots. At each shot's own instant this is
 * that shot (so entering the seat at 06 and leaving it into 01 change nothing in the picture's grade).
 *   els   the sun's height at the six shots (degrees), from the clock
 */
export function gradeP(sunEl, minutes, noon, els) {
  if (minutes < noon) {
    if (sunEl <= els[0]) return 0;
    if (sunEl <= els[1]) return (sunEl - els[0]) / (els[1] - els[0]);
    if (sunEl <= els[2]) return 1 + (sunEl - els[1]) / (els[2] - els[1]);
    return 2 + smooth((sunEl - els[2]) / Math.max(1, 62 - els[2]));
  }
  if (sunEl >= els[3]) return 3;
  return 3 + 2 * smooth((els[3] - sunEl) / (els[3] - els[5]));
}

// ---------------------------------------------------------------- the camera
/**
 * The camera at `pull` along the way from an eye to the sun's seat.
 *   from     { eye, dir, fov }   the camera as it is when the way begins (dir: unit gaze; fov: vertical degrees)
 *   sun      unit vector towards the sun
 *   centre   what the seat looks at
 *   half     half the height (m) of what the seat frames at the centre
 *   subject  a point the first eye was looking at (sets the plane whose size is kept: the trunk)
 *   lean     [yaw, pitch] radians out of the light (about the centre)
 *   keep     points the picture must not begin in front of (the near plane stands 7 m behind the nearest to the eye)
 * Returns { eye, target, up, fov, near, far, dist, turn, half } (fov vertical, degrees).
 */
export function seatCamera({ from, sun, centre, half, subject, pull = 1, lean = [0, 0], far = FAR, keep = null, aspect = 16 / 9 }) {
  const u = clamp(pull, 0, 1);
  const d0 = Math.max(6, dot(sub(subject, from.eye), from.dir));
  const T0 = add(from.eye, from.dir, d0), c0 = [-from.dir[0], -from.dir[1], -from.dir[2]];
  const half0 = d0 * Math.tan((from.fov * D2R) / 2);
  const turn = smooth(u / TURNED);
  let c = slerp(c0, sun, turn);
  const target = mix3(T0, centre, turn);
  const h = half0 + (half - half0) * turn;
  const dist = d0 * Math.pow(far / d0, u);
  // leaning out of the light: about the vertical, then up or down (never under the ground's own plane)
  if (lean[0] || lean[1]) {
    const k = turn;
    const az = Math.atan2(c[0], c[2]) + lean[0] * k, el = clamp(Math.asin(clamp(c[1], -1, 1)) + lean[1] * k, 0.6 * D2R, 89.9 * D2R);
    c = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
  }
  const eye = add(target, c, dist);
  // looking straight down has no "up": towards the zenith the picture keeps the plan's own north
  const steep = smooth((Math.asin(clamp(c[1], -1, 1)) * R2D - 52) / 30);
  const up = norm(mix3([0, 1, 0], PLAN_UP, steep));
  const fov = 2 * Math.atan(h / dist) * R2D;
  // the depth the picture needs: the walker's own lens near the eye; a slab round the campus from the seat
  // the picture begins a little behind the nearest thing it is about (`keep`: the walker, the school): on a ray this
  // low, whatever stands further towards the sun would otherwise stand in front of everything
  let margin = 320;
  if (keep && keep.length) {
    // (only what the frame holds counts: a wall that runs on out of the picture towards the sun does not)
    const hz = Math.hypot(c[0], c[2]) || 1e-6, r = hz > 1e-4 ? [c[2] / hz, 0, -c[0] / hz] : [1, 0, 0];
    const vUp = [r[1] * c[2] - r[2] * c[1], r[2] * c[0] - r[0] * c[2], r[0] * c[1] - r[1] * c[0]].map((v) => -v);
    margin = 30;
    for (const p of keep) {
      const q = sub(p, target);
      if (Math.abs(dot(q, r)) > h * aspect + 2 || Math.abs(dot(q, vUp)) > h + 2) continue;
      margin = Math.max(margin, dot(q, c) + 7);
    }
  }
  const near = Math.max(0.08, dist - margin), farPlane = Math.max(1200, dist + 1100);
  return { eye, target, up, fov, near, far: farPlane, dist, turn, half: h, d0, margin };
}

/** how far (m, across the view) a shadow `length` m long shows beside its caster, seen `angle` radians off the light */
export function shadowShown(length, angle) { return length * Math.sin(Math.abs(angle)); }
/** the angle (radians) between a view direction (from the thing towards the eye) and the sun's */
export function offLight(toEye, sun) { return Math.acos(clamp(dot(norm(toEye), sun), -1, 1)); }

// ---------------------------------------------------------------- what the sun can see
/**
 * A campus building as the sun meets it: its footprint (campus3d.js buildCampus: cx, cz, w, d, rot) up to `top`
 * (world y). The roofs' own shapes are left out: a box to the eaves.
 */
export function boxOf(b, ground = -0.85, inset = 0) {
  return { id: b.id, cx: b.cx, cz: b.cz, hw: b.w / 2 - inset, hd: b.d / 2 - inset, rot: b.rot, y0: ground - 2, y1: ground + (b.height || 0) - inset };
}
/** does the ray from p towards `dir` meet the box? Returns the distance, or -1. */
export function rayBox(p, dir, box) {
  const c = Math.cos(box.rot), s = Math.sin(box.rot);
  const ox = p[0] - box.cx, oz = p[2] - box.cz;
  const o = [ox * c - oz * s, p[1], ox * s + oz * c], d = [dir[0] * c - dir[2] * s, dir[1], dir[0] * s + dir[2] * c];
  let t0 = 0, t1 = Infinity;
  for (const [oo, dd, lo, hi] of [[o[0], d[0], -box.hw, box.hw], [o[1], d[1], box.y0, box.y1], [o[2], d[2], -box.hd, box.hd]]) {
    if (Math.abs(dd) < 1e-9) { if (oo < lo || oo > hi) return -1; continue; }
    let a = (lo - oo) / dd, b = (hi - oo) / dd;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 > t1) return -1;
  }
  return t0;
}
/** the first building between a point and the sun (its id and distance), or null: the point is in the open */
export function shadedBy(p, sun, boxes) {
  let best = null;
  for (const b of boxes) { const t = rayBox(p, sun, b); if (t >= 0 && (!best || t < best.t)) best = { id: b.id, t }; }
  return best;
}
/**
 * How many leaf rosettes stand within `radius` m of the ray from p towards the sun (a measure of the crown's
 * own shade on p). ros: rosettes.bin as Float32Array; visible(i) says whether rosette i carries a leaf.
 */
export function leavesBetween(p, sun, ros, stride, visible = null, radius = 0.45) {
  let n = 0;
  for (let i = 0; i < ros.length; i += stride) {
    if (visible && !visible(i)) continue;
    const v = [ros[i] - p[0], ros[i + 1] - p[1], ros[i + 2] - p[2]];
    const t = dot(v, sun);
    if (t <= 0.3) continue;
    const dx = v[0] - sun[0] * t, dy = v[1] - sun[1] * t, dz = v[2] - sun[2] * t;
    if (dx * dx + dy * dy + dz * dz < radius * radius) n++;
  }
  return n;
}
/** the lowest height (world y) above the ground point (x, z) that the sun reaches past the boxes: where a shadow's edge stands */
export function shadowEdgeAbove(x, z, sun, boxes, ground = -0.85, top = 40) {
  if (!shadedBy([x, top, z], sun, boxes)) {
    let lo = ground, hi = top;
    if (!shadedBy([x, lo + 0.01, z], sun, boxes)) return ground;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (shadedBy([x, m, z], sun, boxes)) lo = m; else hi = m; }
    return hi;
  }
  return Infinity;
}

// ---------------------------------------------------------------- the six shots, as the sun saw them
/**
 * For each of the film's six shots: its instant, where its viewer stood, and whether the sun could see
 * that place (a building between; the crown's own leaves between).
 *   clock     clock.js createClock() for the composition
 *   stations  six eyes [x, y, z] (chapters.js poseAt(i), with 06 the walker's)
 *   boxes     the campus as boxes (boxOf)
 */
export function sixShots({ clock, stations, boxes, ros = null, stride = 16, leafOn = null, rotation = 0 }) {
  const out = [];
  for (let i = 0; i < 6; i++) {
    const w = i === 5 ? null : clock.when(i);
    const inst = i === 5 ? lastLight(clock, rotation) : instantAt(instantOfMs(w.ms).doy + (w.dayFrac || 0), instantOfMs(w.ms).minutes, rotation);
    const by = shadedBy(stations[i], inst.dir, boxes);
    const leaves = ros ? leavesBetween(stations[i], inst.dir, ros, stride, leafOn ? (k) => leafOn(k, inst.doy) : null) : 0;
    out.push({ index: i, ...inst, station: stations[i], shadedBy: by ? by.id : null, leaves, seen: !by && leaves < 3 });
  }
  return out;
}
/** the instant of the evening's last light (where 06 held ends), as an instant of the spring */
export function lastLight(clock, rotation = 0) {
  const end = haikouToMs(YEAR, SPRING[1], TIMELINE[TIMELINE.length - 1].minutes);
  const target = clock.lastLight().sunEl;
  let lo = 0, hi = 3600e3;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (sunPosition(end + m).altitude * R2D > target) lo = m; else hi = m; }
  const k = instantOfMs(end + lo);
  return instantAt(k.doy, k.minutes, rotation);
}
/** the noon of a day, as an instant */
export function noonOf(doy, rotation = 0) { return instantAt(doy, daylight(doy).noon, rotation); }
