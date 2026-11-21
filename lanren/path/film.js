// The director's walk: one continuous take, a pure function of time (any frame can be drawn alone).
//
// Treatment (why each move):
//   1 street      Open on the street outside 北门, off-axis and close to the wall: the gate is seen
//                 obliquely, its four columns overlapping. A slow truck left to the axis lets them
//                 separate (parallax shows the gate's depth before anything is said).
//   2 the gate    The truck ends exactly where the school's own photograph of the gate was taken and
//                 holds: the photograph develops over the place. (signature: the archive returns)
//   3 the axis    Through the central opening and down the axis at a gliding walk. Frame within a
//                 frame, then the gardens open on both sides; 一号楼's entrance and the stone grow
//                 ahead because they are on the line the gate was built to face.
//   4 the stone   Slow into the stone photographer's spot; hold; the second photograph develops.
//   5 the turn    The one head-turn in the film: east, towards the morning light and the sound of
//                 leaves, the century tree 38 m away. Walk to it along the north side of its bed.
//   6 the tree    Arrive where 区大伟 stood; hold; the third photograph — the real tree over the
//                 concept tree, their disagreement visible.
//   7 under       Walk in under the long limb and tilt up into the crown; settle; hand over.
// Speeds: a walking person's 1.2–1.6 m/s is too slow for a film; it glides at about 3.5 m/s (a steady
// cruise between smooth ramps, never the 2× peak of an ease curve), decelerating into every stop. Holds are long enough for the print to develop (≈4 s) plus a
// breath. The camera never cuts and never leaves eye height except for the final tilt.
import * as THREE from 'three';
import { STATIONS } from './memory.js';

const deg = Math.PI / 180;
const st = Object.fromEntries(STATIONS.map((s) => [s.id, s.pose]));
const P = (p) => ({ x: p.eye.x, y: p.eye.y, z: p.eye.z, yaw: p.yaw, pitch: p.pitch, fov: p.vfov, aspect: p.aspect, photo: true });

// keys: where the camera is at each time (holds repeat a key); `via` are extra spline points
const KEYS = [
  { t: 0, x: -23.5, y: 0.37, z: -97.0, yaw: -32, pitch: 9, fov: 50 },
  { t: 7.5, ...P(st.gate), via: [[-30.5, 0.3, -94.5]] },
  { t: 13.5, ...P(st.gate) },                                   // hold: the gate photograph develops
  { t: 42.0, ...P(st.taihu), via: [[-36.1, 0.4, -78.0], [-36.3, 0.55, -50.0], [-37.4, 0.62, -22.0]] },
  { t: 48.0, ...P(st.taihu) },                                  // hold: the stone
  { t: 50.5, x: -38.7, y: 0.67, z: -4.9, yaw: 72, pitch: 7, fov: 52 },   // the turn, on the spot
  { t: 68.5, ...P(st.tree), via: [[-24.0, 0.45, -10.8], [-8.0, 0.25, -12.4]] },
  { t: 75.0, ...P(st.tree) },                                   // hold: the tree
  { t: 84.5, x: 5.2, y: 0.25, z: -6.1, yaw: -46, pitch: 42, fov: 62, via: [[7.6, 0.2, -8.3]] },
  { t: 90.5, x: 5.0, y: 0.25, z: -5.9, yaw: -52, pitch: 30, fov: 60 },   // settle; hand over
];
export const CUES = [
  { t0: 1.0, t1: 7.0, kind: 'place', text: '北门', sub: '海南中学府城校区 · 非官方近似模型' },
  { t0: 8.5, t1: 13.2, kind: 'photo', id: 'gate' },
  { t0: 42.5, t1: 47.8, kind: 'photo', id: 'taihu' },
  { t0: 51.0, t1: 57.0, kind: 'place', text: '百年榄仁树', sub: '一号教学楼前 · 太湖石以东 38 米' },
  { t0: 69.0, t1: 74.8, kind: 'photo', id: 'tree' },
  { t0: 85.5, t1: 90.5, kind: 'handover', text: '现在由你走', sub: '拖动环顾 · WASD / 摇杆行走 · 站到照片拍摄者的位置' },
];

const smoother = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * x * (x * (x * 6 - 15) + 10); };
const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;
/** distance fraction for a long move: smooth ramp up (≤ 4 s), cruise, smooth ramp down — a walker's
 *  speed, not an ease curve whose middle is twice the average speed */
function cruise(x, T) {
  const a = Math.min(4, T / 3) / T, v = 1 / (1 - a);
  const ramp = (s) => v * a * (s * s * s - s * s * s * s / 2);
  if (x < a) return ramp(x / a);
  if (x > 1 - a) return 1 - ramp((1 - x) / a);
  return v * (a / 2 + (x - a));
}
const angLerp = (a, b, t) => { let d = ((b - a + 540) % 360) - 180; return a + d * t; };

/** an arc-length-parameterised Catmull-Rom curve through points */
function makeCurve(pts) {
  if (pts.length === 2) {
    const a = new THREE.Vector3(...pts[0]), b = new THREE.Vector3(...pts[1]);
    return { at: (u, out) => out.lerpVectors(a, b, u), length: a.distanceTo(b) };
  }
  const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  c.arcLengthDivisions = 400;
  return { at: (u, out) => c.getPointAt(Math.min(0.99999, Math.max(0, u)), out), length: c.getLength() };   // getPointAt can overrun at u ≈ 1
}

export function createFilm({ world, reduce }) {
  // segments between consecutive keys
  const segs = [];
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i], b = KEYS[i + 1];
    const hold = a.x === b.x && a.y === b.y && a.z === b.z;
    const pts = [[a.x, a.y, a.z], ...(b.via || []), [b.x, b.y, b.z]];
    segs.push({ a, b, hold, curve: hold ? null : makeCurve(pts) });
  }
  const duration = KEYS[KEYS.length - 1].t;
  const out = { eye: new THREE.Vector3(), look: new THREE.Vector3(), fov: 50, cue: null, photo: null };
  const blend = { on: false, t0: 0, eye: new THREE.Vector3(), q: new THREE.Quaternion(), fov: 50 };
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), lookV = new THREE.Vector3();

  /** the vertical fov for this screen so a photograph of `aspect` fits its frame (capped on narrow screens) */
  const fitFov = (vfov, aspect) => {
    const screen = innerWidth / innerHeight;
    if (!aspect) return screen < 0.9 ? Math.min(78, 2 * Math.atan(Math.tan(vfov * deg / 2) * 1.35) / deg) : vfov;
    const need = 2 * Math.atan(Math.tan(vfov * deg / 2) * Math.max(1, aspect / screen)) / deg;
    return Math.min(78, need);
  };

  function raw(t) {
    t = Math.min(duration, Math.max(0, t));
    let s = segs[segs.length - 1];
    for (const g of segs) if (t <= g.b.t) { s = g; break; }
    const u = (t - s.a.t) / (s.b.t - s.a.t || 1);
    const a = s.a, b = s.b;
    let yaw, pitch, fov;
    if (s.hold) {
      out.eye.set(a.x, a.y, a.z);
      yaw = a.yaw; pitch = a.pitch; fov = fitFov(a.fov, a.aspect);
    } else {
      // speed: ease in and out of every key (smootherstep); glides are long, so they read as walking
      const k = s.curve.length > 12 ? cruise(u, s.b.t - s.a.t) : smoother(u);
      s.curve.at(k, out.eye);
      // look where you are going in the middle of a long move, at the key's heading near its ends
      const ahead = s.curve.at(Math.min(1, k + 0.04), new THREE.Vector3()).sub(out.eye);
      const pathYaw = Math.atan2(ahead.x, ahead.z) / deg;
      const travel = s.curve.length > 12 ? Math.sin(Math.PI * k) ** 1.5 : 0;
      yaw = angLerp(angLerp(a.yaw, b.yaw, smooth(u)), pathYaw, travel * 0.75);
      pitch = lerp(lerp(a.pitch, b.pitch, smooth(u)), 4, travel * 0.6);
      fov = lerp(fitFov(a.fov, a.aspect), fitFov(b.fov, b.aspect), smoother(u));
    }
    // a person's breath: a few millimetres and a tenth of a degree, slower than a walk
    const br = reduce ? 0 : 1;
    out.eye.y += Math.sin(t * 1.3) * 0.004 * br;
    yaw += Math.sin(t * 0.37 + 1.0) * 0.12 * br;
    pitch += Math.sin(t * 0.51) * 0.08 * br;
    lookV.set(Math.sin(yaw * deg) * Math.cos(pitch * deg), Math.sin(pitch * deg), Math.cos(yaw * deg) * Math.cos(pitch * deg));
    out.look.copy(out.eye).add(lookV);
    out.fov = fov;
    out.yaw = yaw; out.pitch = pitch;
    out.cue = CUES.find((c) => t >= c.t0 && t <= c.t1) || null;
    out.photo = s.hold && a.photo ? STATIONS.find((x) => x.pose.eye.x === a.x && x.pose.eye.z === a.z) : null;
    return out;
  }

  function shot(t, clock = 0) {
    raw(t);
    if (blend.on) {
      const k = smoother((clock - blend.t0) / 1.4);
      if (k >= 1) blend.on = false;
      else {
        tmpM.lookAt(out.eye, out.look, up); tmpQ.setFromRotationMatrix(tmpM);
        const q = blend.q.clone().slerp(tmpQ, k);
        out.eye.lerpVectors(blend.eye, out.eye, k);
        out.look.set(0, 0, -1).applyQuaternion(q).add(out.eye);
        out.fov = lerp(blend.fov, out.fov, k);
      }
    }
    return out;
  }

  return {
    duration, keys: KEYS, cues: CUES, shot,
    /** the film time whose place is nearest to p (for resuming the film from where you walked) */
    nearestT(p) {
      let best = 0, bd = Infinity;
      for (let t = 0; t <= duration; t += 0.25) {
        raw(t);
        const d = (out.eye.x - p.x) ** 2 + (out.eye.z - p.z) ** 2;
        if (d < bd) { bd = d; best = t; }
      }
      return best;
    },
    blendFrom(camera, clock) {
      blend.on = true; blend.t0 = clock;
      blend.eye.copy(camera.position); blend.q.copy(camera.quaternion); blend.fov = camera.fov;
    },
  };
}
