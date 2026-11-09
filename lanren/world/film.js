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

// The film's own clock: how long each part takes when it is simply watched (seconds). The scroll's
// progress is proportional to it, so scrolling at an even pace plays the film at a person's pace, and
// home.js plays the film on at this pace between its resting beats (never the scroll snap's second and a half).
export const DURATION = [['hold', 0.8], ['find', 4.5], ['enter', 1.6], ['self', 2.4], ['limb', 3.4], ['gather', 1.0], ['leap', 1.4],
  ['land', 4.2], ['walk', 15.5], ['settle', 1.6], ['notice', 2.6], ['turn', 3.0], ['rise', 3.4]];
export const FILM_SECONDS = DURATION.reduce((s, [, d]) => s + d, 0);
export const PHASE = (() => { const o = {}; let t = 0; for (const [k, d] of DURATION) { o[k] = [t / FILM_SECONDS, (t + d) / FILM_SECONDS]; t += d; } return o; })();
const at = (k, f) => PHASE[k][0] + (PHASE[k][1] - PHASE[k][0]) * f;   // a moment inside a part
// resting beats: over the shoulder; one's own feet; landed and looked round; the head turned to the shadow; 06
export const BEATS = [0, PHASE.find[1], at('self', 0.535), PHASE.land[1], at('notice', 0.8), 1];
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
/*   sights what the walker looks at on the way (world points, chosen by world.js from the campus itself):
 *          [{ p: [x, y, z], at: [τ0, τ1] }] over the walk's own time τ; the head turns to each and holds it while
 *          passing (the world slides through the frame as it would past a turning head), within a person's reach
 */
export function makeFilm({ e5, e6, limb, land, ground = () => GROUND_Y, sunAz = 300, sights = null }) {
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
  const idle = (q) => ({ x: S[0], y: S[1], z: S[2], yaw: yLimb, weight: 0.7 * (1 - smooth(segP(q, PHASE.enter))),
    nod: 10 * (1 - smooth(seg(q, PHASE.enter[0], at('enter', 0.75)))), look: -24 * bump(seg(q, at('find', 0.375), at('find', 0.875))) });
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

  // ---- the walk away: a gently bending path (a person drifts), a pace that gets going, slows while
  // something is looked at, picks up again and comes to rest over the last steps
  const WC = (() => {
    const mx = (L2[0] + W0[0]) / 2, mz = (L2[2] + W0[1]) / 2, dx = W0[0] - L2[0], dz = W0[1] - L2[2], len = Math.hypot(dx, dz) || 1;
    const bend = 0.1 * len * (glance > 0 ? 1 : -1);            // drift a little towards what will be looked at
    return [mx - (dz / len) * bend, mz + (dx / len) * bend];
  })();
  const pathAt = (t) => { const u = 1 - t; return [u * u * L2[0] + 2 * u * t * WC[0] + t * t * W0[0], u * u * L2[2] + 2 * u * t * WC[1] + t * t * W0[1]]; };
  const tanAt = (t) => { const d = [2 * (1 - t) * (WC[0] - L2[0]) + 2 * t * (W0[0] - WC[0]), 2 * (1 - t) * (WC[1] - L2[2]) + 2 * t * (W0[1] - WC[1])]; return yawOf(d[0], d[1]); };
  const NS = 240, arc = [0];
  for (let i = 1; i <= NS; i++) { const a = pathAt((i - 1) / NS), c = pathAt(i / NS); arc.push(arc[i - 1] + Math.hypot(c[0] - a[0], c[1] - a[1])); }
  const pathLen = arc[NS];
  const tOfS = (sm) => { let lo = 0, hi = NS; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arc[m] < sm) lo = m; else hi = m; } return (lo + (sm - arc[lo]) / Math.max(1e-9, arc[hi] - arc[lo])) / NS; };
  // the pace over the walk's own time τ (1 = cruising): up, steady, slower (a look), up again, down to rest
  const PACE = [[0, 0], [0.13, 1], [0.4, 1], [0.5, 0.32], [0.58, 0.32], [0.68, 0.9], [0.84, 0.9], [1, 0]];
  const paceAt = (tau) => { for (let i = 1; i < PACE.length; i++) if (tau <= PACE[i][0]) { const [a, va] = PACE[i - 1], [c, vc] = PACE[i]; return va + (vc - va) * smooth((tau - a) / (c - a)); } return 0; };
  const DN = 400, dist = [0];
  for (let i = 1; i <= DN; i++) dist.push(dist[i - 1] + (paceAt((i - 0.5) / DN)) / DN);
  const sOfTau = (tau) => { const x = clamp01(tau) * DN, i = Math.min(DN - 1, Math.floor(x)); return (dist[i] + (dist[i + 1] - dist[i]) * (x - i)) / dist[DN]; };
  const steps = Math.max(4, Math.round(pathLen / STRIDE)), strideW = pathLen / steps;     // whole steps: the feet meet at the end
  const walkSpeed = pathLen / (DURATION.find(([k]) => k === 'walk')[1] * dist[DN]);          // cruising speed (m/s)
  const yStart = tanAt(0), yEnd = tanAt(1);
  const turnE = wrap(y6 - yEnd);
  const lookN = Math.sign(turnE) * Math.min(110, Math.abs(turnE) * 0.8);                     // the glance over the shoulder

  /** the walker at q: { body, cam, beat } */
  function pose(qIn) {
    const q = clamp01(qIn);
    const b = { show: q > 0.004, x: S[0], y: S[1], z: S[2], yaw: yLimb, phase: 0, amp: 0, crouch: 0, tuck: 0, balance: 0, reach: 0, lean: 0, look: 0, roll: 0, nod: 0, weight: 0, tilt: 0 };
    let yaw, pitch, fov = FOV_WALK, auth = 0, eye, dist = 9, third = false, roll = 0;

    if (q < PHASE.enter[1]) {
      // ---- third person: someone out on the limb; the eye comes round behind them and in
      Object.assign(b, idle(q));
      const u = smoother(segP(q, PHASE.find));
      const H0 = PHASE.find[0];
      let target;
      if (q < PHASE.enter[0]) {
        eye = bez(E5, lerp3(E5, M, 0.55), M, O, u);
        // the gaze leaves 05's far view for the person, then looks past them, where they look
        const toHead = smoother(seg(q, H0, at('find', 0.583))), past = smooth(seg(q, at('find', 0.625), PHASE.find[1]));
        target = lerp3(lerp3(L5, HEAD, toHead), OUT, past * 0.85);
        fov = lerp(e5.fov, 48, smooth(seg(q, H0, at('find', 0.917))));
        auth = lerp(e5.auth || 0, 0, smooth(seg(q, H0, at('find', 0.417))));
        dist = lerp(dist5, Math.hypot(eye[0] - HEAD[0], eye[1] - HEAD[1], eye[2] - HEAD[2]), smooth(seg(q, H0, at('find', 0.417))));
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
      yaw = q < H0 ? e5.yaw : yawOf(d[0], d[2]);
      pitch = q < H0 ? e5.pitch : pitchOf(d);
      if (q < H0) { eye = E5.slice(); fov = e5.fov; auth = e5.auth || 0; dist = dist5; }
    } else if (q < PHASE.limb[0]) {
      // ---- first person, still on the spot: a look down at oneself, the drop, the arms come out
      const t = segP(q, PHASE.self);
      b.balance = 0.75 * smooth(seg(t, 0.04, 0.84));
      b.tilt = 0.08 * Math.sin(t * Math.PI * 2) * bump(t);
      b.reach = 0.3 * smooth(seg(t, 0.04, 0.7)) - 0.08 * smooth(seg(t, 0.7, 1));   // the hands come forward into view
      yaw = yLimb;
      // far enough down to see one's own chest, hands and shoes on the bark (the eye is ahead of the feet)
      pitch = t < 0.535 ? lerp(-12, -76, smoother(seg(t, 0, 0.51))) : lerp(-76, -27, smoother(seg(t, 0.56, 1)));
      fov = lerp(56, FOV_WALK, smooth(t));
      eye = eyeAt(b);
    } else if (q < PHASE.gather[0]) {
      // ---- out along the limb: three careful steps, the body wavering, arms out
      const t = segP(q, PHASE.limb), d = smooth(t);
      b.x = lerp(S[0], J[0], d); b.y = lerp(S[1], J[1], d); b.z = lerp(S[2], J[2], d);
      b.phase = ((d * limbLen) / STRIDE) * Math.PI;
      b.amp = 0.42 * bump(t);
      b.balance = 0.75 - 0.15 * t;
      b.reach = 0.22;
      b.roll = 0.075 * Math.sin(t * Math.PI * 3.2) * bump(t);       // the wobble over the bark
      b.tilt = -b.roll * 3.2;                                          // the arms answer it
      b.nod = -14;
      yaw = yLimb + 4 * Math.sin(t * Math.PI * 3.2) * bump(t);
      pitch = lerp(-27, -31, t);
      eye = eyeAt(b);
      roll = (b.roll * 180) / Math.PI * 0.8;                     // the horizon tilts with the body's wavering
    } else if (q < PHASE.leap[0]) {
      // ---- gathering for the leap
      const t = segP(q, PHASE.gather), k = smooth(t);
      b.x = J[0]; b.y = J[1]; b.z = J[2];
      b.balance = 0.6 * (1 - k);
      b.crouch = 0.92 * k;
      b.reach = lerp(0.22, -0.9, smoother(t));
      b.lean = 0.28 * k;
      b.yaw = lerpYaw(yLimb, yLeap, smoother(seg(t, 0, 0.857)));
      yaw = b.yaw;
      pitch = lerp(-31, -44, k);
      eye = eyeAt(b);
    } else if (q < PHASE.land[0]) {
      // ---- the leap: push off (feet still on the bark), then a thrown arc; at its top the eyes lift
      // to the open campus and the evening (home.js clears the leaves right at the lens in first person)
      const t0 = segP(q, PHASE.leap), PUSH = 0.16;
      b.yaw = yLeap; yaw = yLeap;
      if (t0 < PUSH) {
        const k = smoother(t0 / PUSH);
        b.x = J[0]; b.y = J[1]; b.z = J[2];
        b.crouch = 0.92 * (1 - k);
        b.reach = lerp(-0.9, 0.75, k);
        b.lean = lerp(0.28, 0.16, k);
        pitch = lerp(-44, -30, k);
      } else {
        const t = (t0 - PUSH) / (1 - PUSH);
        b.x = lerp(J[0], L[0], t); b.z = lerp(J[2], L[2], t);
        b.y = J[1] + 2.1 * t * (1 - t) + (L[1] - J[1]) * t * t;
        b.tuck = smooth(seg(t, 0.1, 0.4)) * (1 - smooth(seg(t, 0.62, 0.95)));
        b.crouch = 0.4 * smooth(seg(t, 0.78, 1));
        b.reach = lerp(0.75, 0.3, smooth(seg(t, 0.1, 0.6)));
        b.balance = 0.55 * smooth(seg(t, 0.45, 0.85));               // arms open for the landing
        b.lean = 0.16 * (1 - t) + 0.12 * smooth(seg(t, 0.7, 1));
        pitch = t < 0.42 ? lerp(-30, 4, smooth(t / 0.42)) : lerp(4, -38, smooth((t - 0.42) / 0.58));
      }
      eye = eyeAt(b);
    } else if (q < PHASE.walk[0]) {
      // ---- the landing, and the moment after it: the knees take it, a breath down there, up with a
      // step that catches the weight, then a look round at where one has landed
      const t = segP(q, PHASE.land);
      const crouch = t < 0.1 ? lerp(0.4, 1, smooth(t / 0.1)) : t < 0.32 ? 1 - 0.08 * smooth((t - 0.1) / 0.22) : 0.92 * (1 - smoother((t - 0.32) / 0.3));
      const stepK = smoother(seg(t, 0.36, 0.62));
      b.x = lerp(L[0], L2[0], stepK); b.z = lerp(L[2], L2[2], stepK); b.y = ground(b.x, b.z);
      b.phase = ((stepK * CATCH) / STRIDE) * Math.PI + (Math.abs(wrap(yStart - yLeap)) / 45) * Math.PI * smooth(seg(t, 0.5, 1));
      b.amp = 0.5 * bump(seg(t, 0.36, 0.62)) + 0.24 * bump(seg(t, 0.5, 1));
      b.crouch = Math.max(0, crouch);
      b.reach = 0.3 * (1 - smooth(seg(t, 0.1, 0.55)));
      b.balance = 0.55 * (1 - smooth(seg(t, 0.05, 0.5)));
      b.lean = t < 0.1 ? lerp(0.28, 0.38, smooth(t / 0.1)) : 0.38 * (1 - smoother(seg(t, 0.3, 0.62)));
      b.roll = 0.04 * bump(seg(t, 0.12, 0.5));
      b.yaw = lerpYaw(yLeap, yStart, smooth(seg(t, 0.5, 1)));
      // the look round: one way, a little up across the campus, the other way, back to the way on
      const lr = Math.sign(wrap(yStart - yLeap)) || 1;
      b.look = -18 * lr * bump(seg(t, 0.56, 0.84)) + 12 * lr * bump(seg(t, 0.8, 1));
      yaw = b.yaw + b.look;
      pitch = t < 0.3 ? lerp(-38, -52, smooth(t / 0.1)) : t < 0.75 ? lerp(-52, 3, smoother((t - 0.3) / 0.45)) : lerp(3, -2, smooth((t - 0.75) / 0.25));
      // the jolt of the ground arriving: the head is thrown down and a little sideways, and recovers
      const jolt = Math.exp(-Math.pow((t - 0.07) / 0.06, 2));
      pitch -= 3.5 * jolt;
      roll = 2.2 * jolt * (Math.sign(wrap(yStart - yLeap)) || 1) + 0.6 * Math.sin(b.phase) * b.amp;
      eye = eyeAt(b);
    } else if (q < PHASE.settle[0]) {
      // ---- the walk away, towards the low sun, on the walk's own pace
      const tau = segP(q, PHASE.walk), sm = sOfTau(tau) * pathLen, t = tOfS(sm), pos = pathAt(t);
      b.x = pos[0]; b.z = pos[1]; b.y = ground(b.x, b.z);
      b.yaw = tanAt(t);
      b.phase = (sm / strideW) * Math.PI;
      b.amp = Math.min(1, paceAt(tau) * 1.05);
      // what is looked at on the way: real things passed (sights), else a glance round and a longer look while the pace slows
      if (sights && sights.length) {
        let lk = 0, pt = -2;
        const e0 = eyeAt({ ...b, look: 0 });
        for (const sg of sights) {
          const w = smoother(seg(tau, sg.at[0], sg.at[0] + 0.07)) * (1 - smoother(seg(tau, sg.at[1] - 0.07, sg.at[1])));
          if (w <= 0) continue;
          if (sg.feet) { pt += (-80 + 2) * w; b.lean = 0.04 * w; continue; }   // one's own feet, stepping: head down, a little forward
          const dx = sg.p[0] - e0[0], dz = sg.p[2] - e0[2];
          const rel = wrap(yawOf(dx, dz) - b.yaw);
          const reach = 1 - smooth((Math.abs(rel) - 80) / 25);   // past a person's turn of the head: let it go
          const ww = w * reach;
          lk += Math.max(-85, Math.min(85, rel)) * ww;
          pt += (Math.max(-30, Math.min(28, Math.atan2(sg.p[1] - e0[1], Math.hypot(dx, dz)) / D2R)) + 2) * ww;
        }
        b.look = lk;
        pitch = pt;
      } else {
        b.look = -10 * bump(seg(tau, 0.16, 0.3)) + glance * smoother(seg(tau, 0.4, 0.5)) * (1 - smoother(seg(tau, 0.58, 0.7)));
        pitch = -2 + 6 * smoother(seg(tau, 0.4, 0.5)) * (1 - smoother(seg(tau, 0.58, 0.7)));
      }
      yaw = b.yaw + b.look;
      eye = eyeAt(b);
      // a person's own walk in the image: the eye rolls a little with each step
      roll = 0.7 * Math.sin(b.phase) * b.amp;
    } else {
      // ---- standing still: the feet have stopped, the rest of the body comes to rest after them; the eyes
      // drop from the sun to the ground, the head turns to look back at the shadow lying behind; then
      // the shoulders and feet follow; then the gaze goes along the shadow to the tree
      b.x = G6[0]; b.y = G6[1]; b.z = G6[2];
      const ts = segP(q, PHASE.settle), tn = segP(q, PHASE.notice), tt = segP(q, PHASE.turn);
      const feet = smoother(seg(tt, 0.12, 0.95));
      b.yaw = yEnd + turnE * feet;
      // the head: the glance over the shoulder (notice), then it leads the body round (turn)
      const head = q < PHASE.turn[0] ? yEnd + lookN * smooth(seg(tn, 0.15, 0.75)) : lerpYaw(yEnd + lookN, y6, smoother(seg(tt, 0, 0.8)));
      b.look = wrap(head - b.yaw);
      b.phase = ((Math.abs(turnE * feet) / 45) * Math.PI);
      b.amp = 0.28 * bump(seg(tt, 0.12, 0.95));
      // the body's own after-motion: a lean carried forward, the arms still swinging a little, the weight settling
      b.lean = 0.07 * bump(seg(ts, 0, 0.6));
      b.reach = 0.14 * Math.sin(ts * Math.PI * 3) * Math.exp(-3.2 * ts) * (q < PHASE.notice[0] ? 1 : 0);
      b.weight = 0.5 * smooth(seg(ts, 0.3, 0.9)) * (1 - smooth(seg(tt, 0.05, 0.4))) + 0.35 * smooth(segP(q, PHASE.rise));
      b.roll = -Math.sign(turnE) * (0.03 * smooth(seg(tn, 0.3, 0.7)) * (1 - smooth(seg(tt, 0, 0.3))) + 0.035 * bump(seg(tt, 0.1, 0.95)));
      b.nod = -20 * smooth(seg(tn, 0, 0.3));
      yaw = head;
      pitch = q < PHASE.notice[0] ? lerp(-2, -8, smooth(ts))
        : q < PHASE.turn[0] ? lerp(-8, -40, smooth(seg(tn, 0, 0.7)))
          : q < PHASE.rise[0] ? lerp(-40, -22, smooth(tt))
            : lerp(-22, p6, smoother(segP(q, PHASE.rise)));
      eye = eyeAt(b);
      roll = 0.6 * Math.sin(b.phase) * b.amp + (b.roll * 180) / Math.PI * 0.5;
      if (q >= PHASE.rise[0]) eye = lerp3(eye, eye6, smooth(seg(q, PHASE.rise[0], at('rise', 0.3))));
      fov = lerp(FOV_WALK, e6.fov, smoother(seg(q, at('turn', 0.85), 1)));
      auth = lerp(0, e6.auth || 0, smooth(seg(q, at('turn', 0.8), 1)));
      dist = lerp(9, e6.dist || 12, smooth(seg(q, at('turn', 0.8), 1)));
    }
    const pr = pitch * D2R, yr = yaw * D2R;
    const cam = {
      ex: eye[0], ey: eye[1], ez: eye[2], fov, auth, dist, yaw, pitch, roll,
      lx: eye[0] + Math.sin(yr) * Math.cos(pr) * dist, ly: eye[1] + Math.sin(pr) * dist, lz: eye[2] + Math.cos(yr) * Math.cos(pr) * dist
    };
    let beat = -1;
    for (let i = 0; i < BEATS.length; i++) if (Math.abs(q - BEATS[i]) < 1e-3) beat = i;
    // first person once the eye is (nearly) in the head: the head itself is then not drawn
    const ein = eyeAt(b);
    b.firstPerson = !third && Math.hypot(eye[0] - ein[0], eye[1] - ein[1], eye[2] - ein[2]) < 0.45;
    return { q, body: b, cam, beat, third };
  }
  return { pose, eyeAt, facts: { S, J, L, L2, G6, eye6, y6, p6, yAway, yLimb, yLeap, walkLen, pathLen, walkSpeed, steps, turn: turnE, lookN, glance } };
}

/** the walker's eye as V4's DwellCamera reads a frame (its 'rail') */
export function railOf(cam) {
  return { ex: cam.ex, ey: cam.ey, ez: cam.ez, lx: cam.lx, ly: cam.ly, lz: cam.lz, fov: cam.fov, auth: cam.auth, dist: cam.dist };
}
