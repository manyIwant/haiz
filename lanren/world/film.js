// 05 → 06: someone in the crown becomes you, and you turn round to see the tree (pure; Node-testable).
//
// One progress q = p − 4 ∈ [0, 1] (p is the homepage's scroll progress, already scrubbed and
// snapped by GSAP) gives the whole picture: where the walker's feet are, how the body moves,
// where the eye is and where it looks. No physics is integrated, nothing depends on the frames
// before, so scrolling back plays exactly the same film backwards, and a jump to any q (a
// chapter link, a reload) lands on the same pose (DESIGN.md: 05 → 06 方案 A, reversible).
//
// The film in shots (third person first, then the body is yours):
//   0.00         V4's 05: from inside the crown, out towards the low sun
//   0.03–0.15    the eye leaves the far view and finds someone standing out on the long limb,
//                a silhouette against the evening; it comes round behind them, over the
//                shoulder, looking where they look                                (beat 0.15)
//   0.15–0.19    the camera slips into their head: the person is now the viewer
//   0.19–0.24    first person: a look down at one's own hands and feet, the drop below,
//                the arms come out for balance                                    (beat 0.215)
//   0.24–0.345   three careful steps out along the limb, the body wavering over the bark
//   0.345–0.38   the gathering: knees, arms swung back, the eyes on the landing
//   0.38–0.475   the leap: arms thrown forward, up off the limb, the campus and the evening
//                open out at the top of the arc, then the ground comes up
//   0.475–0.56   the landing: the knees take it, a step to catch the weight, up  (beat 0.56)
//   0.56–0.80    walking away from the tree towards the sun, a glance at the campus
//   0.80–0.84    the walk runs out; the weight settles; a moment of stillness     (beat 0.84)
//   0.84–0.93    the turn: head first, then shoulders, then feet; the gaze comes round low,
//                on one's own long shadow lying across the paving towards the tree
//   0.93–1.00    the gaze follows that shadow to the roots, up the trunk into the whole
//                crown, and the lens lengthens into the 06 frame                     (q = 1)
//
// From 0.19 the eye is always where the drawn figure's head is (skeleton.js eyeOffset), so the
// feet stand on the bark or the ground and the camera never leaves the body. Proportions are a
// person's (eye 1.62 m above the feet): the campus and the tree keep their true scale.
import { GROUND_Y } from './compose.js';
import { eyeOffset } from './skeleton.js';

export const PHASE = {
  find: [0.03, 0.15], enter: [0.15, 0.19], self: [0.19, 0.24], limb: [0.24, 0.345], gather: [0.345, 0.38],
  leap: [0.38, 0.475], land: [0.475, 0.56], walk: [0.56, 0.8], settle: [0.8, 0.84], turn: [0.84, 0.93], rise: [0.93, 1]
};
export const BEATS = [0, 0.15, 0.215, 0.56, 0.84, 1];
export const STRIDE = 0.68;               // one step (m)
export const FOV_WALK = 66;
const D2R = Math.PI / 180;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const smoother = (x) => { x = clamp01(x); return x * x * x * (x * (x * 6 - 15) + 10); };
const seg = (q, a, b) => clamp01((q - a) / (b - a));
const segP = (q, ph) => seg(q, ph[0], ph[1]);
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const wrap = (a) => { while (a > 180) a -= 360; while (a < -180) a += 360; return a; };
const lerpYaw = (a, b, t) => a + wrap(b - a) * t;
const bump = (x) => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x));
export const yawOf = (dx, dz) => Math.atan2(dx, dz) / D2R;
const pitchOf = (d) => Math.atan2(d[1], Math.hypot(d[0], d[2])) / D2R;
const STAND = eyeOffset({});
// a walk that gets going, keeps going and comes to rest: distance over time with a steady middle
function cruise(t, a = 0.2) {
  t = clamp01(t);
  const v = 1 / (1 - a);                   // the cruising speed that covers 1 in time
  if (t < a) return (v * t * t) / (2 * a);
  if (t > 1 - a) { const u = 1 - t; return 1 - (v * u * u) / (2 * a); }
  return v * a / 2 + v * (t - a);
}
// cubic Bézier through four points
const bez = (p0, p1, p2, p3, t) => { const u = 1 - t; return [0, 1, 2].map((i) => u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i]); };

/**
 * Build the film from the facts of this scene.
 *   e5     V4's 05 frame: {ex, ey, ez, yaw, pitch, fov, auth, dist}  (degrees)
 *   e6     the 06 frame: {ex, ez (the eye's ground position), lx, ly, lz (what it looks at), fov, auth, dist}
 *   limb   {a, b}: two points on top of the long limb ([x, y, z]); the walker stands at a, leaps from b
 *   land   [x, z] where the leap comes down
 *   ground (x, z) → height of the ground the feet stand on
 *   sunAz  the evening sun's heading (the walk glances away from it, at the lit side of the campus)
 */
export function makeFilm({ e5, e6, limb, land, ground = () => GROUND_Y, sunAz = 300 }) {
  const S = limb.a, J = limb.b;
  const L = [land[0], ground(land[0], land[1]), land[1]];
  const yLimb = yawOf(J[0] - S[0], J[2] - S[2]);
  const yLeap = yawOf(L[0] - J[0], L[2] - J[2]);
  // the step that catches the weight after the landing
  const CATCH = 0.42;
  const L2x = L[0] + Math.sin(yLeap * D2R) * CATCH, L2z = L[2] + Math.cos(yLeap * D2R) * CATCH;
  const L2 = [L2x, ground(L2x, L2z), L2z];
  // 06: the eye stands exactly where V4's (or the composition's) 06 eye is, a person's height up
  const g6y = ground(e6.ex, e6.ez);
  const eye6 = [e6.ex, g6y + STAND.up, e6.ez];
  const d6 = [e6.lx - eye6[0], e6.ly - eye6[1], e6.lz - eye6[2]];
  const y6 = yawOf(d6[0], d6[2]);
  const p6 = pitchOf(d6);
  const G6 = [eye6[0] - Math.sin(y6 * D2R) * STAND.fwd, g6y, eye6[2] - Math.cos(y6 * D2R) * STAND.fwd];
  const yAway = yawOf(G6[0] - L2[0], G6[2] - L2[2]);
  const W0 = [G6[0], G6[2]];
  const walkLen = Math.hypot(W0[0] - L2[0], W0[1] - L2[2]);
  const limbLen = Math.hypot(J[0] - S[0], J[2] - S[2]);
  const turn = wrap(y6 - yAway);
  // the walk glances to the side away from the sun: the lit faces of the campus
  const glance = wrap(sunAz - yAway) > 0 ? -26 : 26;
  /** where the eye is for a body pose (the head turned by look about the neck) */
  const eyeAt = (b) => {
    const o = eyeOffset(b), r = b.yaw * D2R, h = (b.yaw + (b.look || 0)) * D2R;
    const rx = -Math.cos(r), rz = Math.sin(r);                     // the body's right
    return [b.x + Math.sin(r) * o.base + Math.sin(h) * o.head + rx * o.side, b.y + o.up, b.z + Math.cos(r) * o.base + Math.cos(h) * o.head + rz * o.side];
  };

  // ---- the person on the limb, as first seen (standing at ease, looking out at the evening)
  const idle = (q) => ({ x: S[0], y: S[1], z: S[2], yaw: yLimb, weight: 0.7 * (1 - smooth(seg(q, 0.15, 0.19))),
    nod: 10 * (1 - smooth(seg(q, 0.15, 0.18))), look: -24 * bump(seg(q, 0.075, 0.135)) });
  const eye0 = eyeAt({ x: S[0], y: S[1], z: S[2], yaw: yLimb });
  const fwdL = [Math.sin(yLimb * D2R), 0, Math.cos(yLimb * D2R)], leftL = [Math.cos(yLimb * D2R), 0, -Math.sin(yLimb * D2R)];
  // which shoulder: the side 05's camera already is on
  const side = (e5.ex - eye0[0]) * leftL[0] + (e5.ez - eye0[2]) * leftL[2] >= 0 ? 1 : -1;
  const off = (b, s, u) => [eye0[0] - fwdL[0] * b + leftL[0] * s * side, eye0[1] + u, eye0[2] - fwdL[2] * b + leftL[2] * s * side];
  const M = off(4.4, 2.9, 1.05);            // three-quarters behind, a little above: the discovery
  const O = off(2.75, 1.0, 0.42);           // over the shoulder: the person in one third, where they look in the rest
  const E5 = [e5.ex, e5.ey, e5.ez];
  const dir5 = [Math.sin(e5.yaw * D2R) * Math.cos(e5.pitch * D2R), Math.sin(e5.pitch * D2R), Math.cos(e5.yaw * D2R) * Math.cos(e5.pitch * D2R)];
  const dist5 = e5.dist || 12;
  const L5 = [E5[0] + dir5[0] * dist5, E5[1] + dir5[1] * dist5, E5[2] + dir5[2] * dist5];
  const HEAD = [eye0[0] - fwdL[0] * 0.15, eye0[1] - 0.12, eye0[2] - fwdL[2] * 0.15];
  const OUT = [eye0[0] + fwdL[0] * 14, eye0[1] - 2.2, eye0[2] + fwdL[2] * 14];   // where they look: out along the limb

  /** the walker at q: { body, cam, beat } */
  function pose(qIn) {
    const q = clamp01(qIn);
    const b = { show: q > 0.004, x: S[0], y: S[1], z: S[2], yaw: yLimb, phase: 0, amp: 0, crouch: 0, tuck: 0, balance: 0, reach: 0, lean: 0, look: 0, roll: 0, nod: 0, weight: 0, tilt: 0 };
    let yaw, pitch, fov = FOV_WALK, auth = 0, eye, dist = 9, third = false;

    if (q < PHASE.enter[1]) {
      // ---- third person: someone out on the limb; the eye comes round behind them and in
      Object.assign(b, idle(q));
      const u = smoother(segP(q, PHASE.find));
      let target;
      if (q < PHASE.enter[0]) {
        eye = bez(E5, lerp3(E5, M, 0.55), M, O, u);
        // the gaze leaves 05's far view for the person, then looks past them, where they look
        const toHead = smoother(seg(q, 0.03, 0.1)), past = smooth(seg(q, 0.105, 0.15));
        target = lerp3(lerp3(L5, HEAD, toHead), OUT, past * 0.85);
        fov = lerp(e5.fov, 48, smooth(seg(q, 0.03, 0.14)));
        auth = lerp(e5.auth || 0, 0, smooth(seg(q, 0.03, 0.08)));
        dist = lerp(dist5, Math.hypot(eye[0] - HEAD[0], eye[1] - HEAD[1], eye[2] - HEAD[2]), smooth(seg(q, 0.03, 0.08)));
        third = true;
      } else {
        // into the head: the camera reaches the eye as the person draws themselves up
        const k = smoother(segP(q, PHASE.enter));
        const e = eyeAt(b);
        eye = lerp3(O, e, k);
        const look0 = lerp3(HEAD, OUT, 0.85);
        const look1 = [e[0] + fwdL[0] * 10, e[1] - 10 * Math.tan(12 * D2R), e[2] + fwdL[2] * 10];
        target = lerp3(look0, look1, k);
        fov = lerp(48, 56, k);
        dist = lerp(Math.hypot(O[0] - HEAD[0], O[1] - HEAD[1], O[2] - HEAD[2]), 9, k);
        third = k < 0.9;
      }
      const d = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
      yaw = q < 0.03 ? e5.yaw : yawOf(d[0], d[2]);
      pitch = q < 0.03 ? e5.pitch : pitchOf(d);
      if (q < 0.03) { eye = E5.slice(); fov = e5.fov; auth = e5.auth || 0; dist = dist5; }
    } else if (q < PHASE.limb[0]) {
      // ---- first person, still on the spot: a look down at oneself, the drop, the arms come out
      const t = segP(q, PHASE.self);
      b.balance = 0.75 * smooth(seg(q, 0.192, 0.232));
      b.tilt = 0.08 * Math.sin(t * Math.PI * 2) * bump(t);
      yaw = yLimb;
      pitch = q < 0.215 ? lerp(-12, -50, smoother(seg(q, 0.19, 0.212))) : lerp(-50, -27, smoother(seg(q, 0.218, 0.24)));
      fov = lerp(56, FOV_WALK, smooth(t));
      eye = eyeAt(b);
    } else if (q < PHASE.gather[0]) {
      // ---- out along the limb: three careful steps, the body wavering, arms out
      const t = segP(q, PHASE.limb), d = smooth(t);
      b.x = lerp(S[0], J[0], d); b.y = lerp(S[1], J[1], d); b.z = lerp(S[2], J[2], d);
      b.phase = ((d * limbLen) / STRIDE) * Math.PI;
      b.amp = 0.42 * bump(t);
      b.balance = 0.75 - 0.15 * t;
      b.roll = 0.075 * Math.sin(t * Math.PI * 3.2) * bump(t);       // the wobble over the bark
      b.tilt = -b.roll * 3.2;                                          // the arms answer it
      b.nod = -14;
      yaw = yLimb + 4 * Math.sin(t * Math.PI * 3.2) * bump(t);
      pitch = lerp(-27, -31, t);
      eye = eyeAt(b);
    } else if (q < PHASE.leap[0]) {
      // ---- gathering for the leap
      const t = segP(q, PHASE.gather), k = smooth(t);
      b.x = J[0]; b.y = J[1]; b.z = J[2];
      b.balance = 0.6 * (1 - k);
      b.crouch = 0.92 * k;
      b.reach = -0.9 * smoother(t);
      b.lean = 0.28 * k;
      b.yaw = lerpYaw(yLimb, yLeap, smoother(seg(q, 0.345, 0.375)));
      yaw = b.yaw;
      pitch = lerp(-31, -44, k);
      eye = eyeAt(b);
    } else if (q < PHASE.land[0]) {
      // ---- the leap: push off (feet still on the bark), then a thrown arc
      const PUSH = 0.395;
      b.yaw = yLeap; yaw = yLeap;
      if (q < PUSH) {
        const k = smoother(seg(q, PHASE.leap[0], PUSH));
        b.x = J[0]; b.y = J[1]; b.z = J[2];
        b.crouch = 0.92 * (1 - k);
        b.reach = lerp(-0.9, 0.75, k);
        b.lean = lerp(0.28, 0.16, k);
        pitch = lerp(-44, -34, k);
      } else {
        const t = seg(q, PUSH, PHASE.leap[1]);
        b.x = lerp(J[0], L[0], t); b.z = lerp(J[2], L[2], t);
        b.y = J[1] + 2.1 * t * (1 - t) + (L[1] - J[1]) * t * t;
        b.tuck = smooth(seg(t, 0.1, 0.4)) * (1 - smooth(seg(t, 0.62, 0.95)));
        b.crouch = 0.4 * smooth(seg(t, 0.78, 1));
        b.reach = lerp(0.75, 0.3, smooth(seg(t, 0.1, 0.6)));
        b.balance = 0.55 * smooth(seg(t, 0.45, 0.85));               // arms open for the landing
        b.lean = 0.16 * (1 - t) + 0.12 * smooth(seg(t, 0.7, 1));
        // the eyes lift at the top of the arc (the campus, the evening), then find the ground
        pitch = t < 0.42 ? lerp(-34, -10, smoother(t / 0.42)) : lerp(-10, -42, smoother((t - 0.42) / 0.58));
      }
      eye = eyeAt(b);
    } else if (q < PHASE.walk[0]) {
      // ---- the landing: the knees take it, the weight carries on into one step, then up
      const t = segP(q, PHASE.land);
      const absorb = t < 0.16 ? lerp(0.4, 1, smooth(t / 0.16)) : 1 - smoother((t - 0.16) / 0.66);
      const stepK = smoother(seg(t, 0.3, 0.72));
      b.x = lerp(L[0], L2[0], stepK); b.z = lerp(L[2], L2[2], stepK); b.y = ground(b.x, b.z);
      b.phase = ((stepK * CATCH) / STRIDE) * Math.PI;
      b.amp = 0.5 * bump(seg(t, 0.3, 0.72));
      b.crouch = Math.max(0, absorb);
      b.reach = 0.3 * (1 - smooth(seg(t, 0.15, 0.8)));
      b.balance = 0.55 * (1 - smooth(seg(t, 0.05, 0.6)));
      b.lean = t < 0.16 ? lerp(0.28, 0.34, smooth(t / 0.16)) : 0.34 * (1 - smoother((t - 0.16) / 0.66));
      b.roll = 0.04 * bump(seg(t, 0.12, 0.6));
      b.yaw = lerpYaw(yLeap, yAway, smoother(seg(t, 0.45, 1)));
      yaw = b.yaw;
      pitch = t < 0.16 ? lerp(-42, -52, smooth(t / 0.16)) : lerp(-52, -4, smoother((t - 0.16) / 0.84));
      eye = eyeAt(b);
    } else if (q < PHASE.settle[0]) {
      // ---- away from the tree, towards the low sun (a steady walk between a start and a stop)
      const t = segP(q, PHASE.walk), d = cruise(t);
      b.x = lerp(L2[0], W0[0], d); b.z = lerp(L2[2], W0[1], d);
      b.y = ground(b.x, b.z);
      b.phase = ((d * walkLen) / STRIDE) * Math.PI;
      b.amp = Math.min(1, 7 * t * (1 - t));
      b.yaw = yAway;
      // a glance at the campus on the way: the head turns, the body keeps going
      b.look = glance * smoother(seg(t, 0.32, 0.46)) * (1 - smoother(seg(t, 0.6, 0.76)));
      yaw = yAway + b.look;
      pitch = -4 + 4 * smoother(seg(t, 0.32, 0.46)) * (1 - smoother(seg(t, 0.6, 0.76)));
      eye = eyeAt(b);
    } else {
      // ---- the stop, the stillness, the turn, and the tree
      b.x = G6[0]; b.y = G6[1]; b.z = G6[2];
      const head = smoother(seg(q, 0.84, 0.912));
      const feet = smoother(seg(q, 0.862, 0.93));
      b.crouch = 0.1 * bump(segP(q, PHASE.settle));
      b.weight = 0.5 * smooth(seg(q, 0.81, 0.84)) * (1 - smooth(seg(q, 0.86, 0.9))) + 0.35 * smooth(seg(q, 0.94, 1));
      b.yaw = yAway + turn * feet;
      b.look = turn * (head - feet);                         // how far the head leads the body
      b.phase = ((Math.abs(turn * feet) / 45) * Math.PI);    // small steps round on the spot
      b.amp = 0.28 * bump(seg(q, 0.862, 0.93));
      b.roll = -Math.sign(turn) * 0.035 * bump(seg(q, 0.85, 0.93));
      yaw = yAway + turn * head;
      // the gaze: down a little as the walk ends, low through the turn (one's own shadow on the
      // paving), then along it to the roots and up into the crown
      pitch = q < 0.84 ? lerp(-4, -9, smooth(segP(q, PHASE.settle)))
        : q < 0.93 ? lerp(-9, -15, smooth(seg(q, 0.84, 0.9)))
          : lerp(-15, p6, smoother(segP(q, PHASE.rise)));
      eye = eyeAt(b);
      if (q >= 0.93) eye = lerp3(eye, eye6, smooth(seg(q, 0.93, 0.95)));
      fov = lerp(FOV_WALK, e6.fov, smoother(seg(q, 0.905, 1)));
      auth = lerp(0, e6.auth || 0, smooth(seg(q, 0.9, 1)));
      dist = lerp(9, e6.dist || 12, smooth(seg(q, 0.9, 1)));
    }
    const pr = pitch * D2R, yr = yaw * D2R;
    const cam = {
      ex: eye[0], ey: eye[1], ez: eye[2], fov, auth, dist, yaw, pitch,
      lx: eye[0] + Math.sin(yr) * Math.cos(pr) * dist, ly: eye[1] + Math.sin(pr) * dist, lz: eye[2] + Math.cos(yr) * Math.cos(pr) * dist
    };
    let beat = -1;
    for (let i = 0; i < BEATS.length; i++) if (Math.abs(q - BEATS[i]) < 1e-3) beat = i;
    // first person once the eye is (nearly) in the head: the head itself is then not drawn
    const ein = eyeAt(b);
    b.firstPerson = !third && Math.hypot(eye[0] - ein[0], eye[1] - ein[1], eye[2] - ein[2]) < 0.45;
    return { q, body: b, cam, beat, third };
  }
  return { pose, eyeAt, facts: { S, J, L, L2, G6, eye6, y6, p6, yAway, yLimb, yLeap, walkLen, turn, glance } };
}

/** the walker's eye as V4's DwellCamera reads a frame (its 'rail') */
export function railOf(cam) {
  return { ex: cam.ex, ey: cam.ey, ez: cam.ez, lx: cam.lx, ly: cam.ly, lz: cam.lz, fov: cam.fov, auth: cam.auth, dist: cam.dist };
}
