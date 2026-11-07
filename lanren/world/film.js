// 05 → 06: the camera becomes a person (pure; Node-testable).
//
// One progress q = p − 4 ∈ [0, 1] (p is the homepage's scroll progress, already scrubbed and
// snapped by GSAP) gives the whole picture: where the walker's feet are, how the body moves,
// where the eye is and where it looks. No physics is integrated, nothing depends on the frames
// before, so scrolling back plays exactly the same film backwards, and a jump to any q (a
// chapter link, a reload) lands on the same pose (DESIGN.md: 05 → 06 方案 A, reversible).
//
//   0.00        V4's 05: from inside the crown, out towards the light
//   0.04–0.20   the eye settles onto the long limb and looks well down: arms out for balance,
//               chest, legs and feet on the bark come into the picture          (beat 0.20)
//   0.20–0.355  three careful steps out along the limb, a crouch
//   0.355–0.47  the leap: a stylised arc down to the ground beyond the islet's rocks
//   0.47–0.55   the landing: knees take it, arms forward, the eye dips and recovers (beat 0.55)
//   0.55–0.82   walking away from the tree to where 06 stands                    (beat 0.82)
//   0.82–1.00   the turn: head first, then shoulders, then feet; the gaze rises to the
//               whole tree and the lens narrows into V4's 06                         (q = 1)
//
// The eye is always where the drawn figure's head is (skeleton.js eyeOffset), so the feet
// stand on the bark or the ground and the camera never leaves the body. Proportions are a
// person's (eye 1.62 m above the feet): the campus and the tree keep their true scale.
import { GROUND_Y } from './compose.js';
import { eyeOffset } from './skeleton.js';

export const BEATS = [0, 0.2, 0.55, 0.82, 1];
export const STRIDE = 0.68;               // one step (m)
export const FOV_WALK = 66;
const D2R = Math.PI / 180;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const smoother = (x) => { x = clamp01(x); return x * x * x * (x * (x * 6 - 15) + 10); };
const seg = (q, a, b) => clamp01((q - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const wrap = (a) => { while (a > 180) a -= 360; while (a < -180) a += 360; return a; };
const lerpYaw = (a, b, t) => a + wrap(b - a) * t;
const bump = (x) => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x));
export const yawOf = (dx, dz) => Math.atan2(dx, dz) / D2R;
const STAND = eyeOffset({});

/**
 * Build the film from the facts of this scene.
 *   e5     V4's 05 frame: {ex, ey, ez, yaw, pitch, fov, auth}  (degrees)
 *   e6     the 06 frame: {ex, ez (the eye's ground position), lx, ly, lz (what it looks at), fov, auth}
 *   limb   {a, b}: two points on top of the long limb ([x, y, z]); the walker stands at a, leaps from b
 *   land   [x, z] where the leap comes down
 *   ground (x, z) → height of the ground the feet stand on
 */
export function makeFilm({ e5, e6, limb, land, ground = () => GROUND_Y }) {
  const S = limb.a, J = limb.b;
  const L = [land[0], ground(land[0], land[1]), land[1]];
  const yLimb = yawOf(J[0] - S[0], J[2] - S[2]);
  const yLeap = yawOf(L[0] - J[0], L[2] - J[2]);
  // 06: the eye stands exactly where V4's (or the composition's) 06 eye is, a person's height up
  const g6y = ground(e6.ex, e6.ez);
  const eye6 = [e6.ex, g6y + STAND.up, e6.ez];
  const d6 = [e6.lx - eye6[0], e6.ly - eye6[1], e6.lz - eye6[2]];
  const y6 = yawOf(d6[0], d6[2]);
  const p6 = Math.atan2(d6[1], Math.hypot(d6[0], d6[2])) / D2R;
  const G6 = [eye6[0] - Math.sin(y6 * D2R) * STAND.fwd, g6y, eye6[2] - Math.cos(y6 * D2R) * STAND.fwd];
  const yAway = yawOf(G6[0] - L[0], G6[2] - L[2]);
  // walking away, the feet end where they must stand for the turned eye to be at eye6
  const W0 = [G6[0], G6[2]];
  const walkLen = Math.hypot(W0[0] - L[0], W0[1] - L[2]);
  const limbLen = Math.hypot(J[0] - S[0], J[2] - S[2]);
  const turn = wrap(y6 - yAway);
  const eyeAt = (b) => { const o = eyeOffset(b); const r = b.yaw * D2R; return [b.x + Math.sin(r) * o.fwd, b.y + o.up, b.z + Math.cos(r) * o.fwd]; };

  /** the walker at q: { body, cam, beat } */
  function pose(qIn) {
    const q = clamp01(qIn);
    const b = { show: q > 0.06, x: S[0], y: S[1], z: S[2], yaw: yLimb, phase: 0, amp: 0, crouch: 0, tuck: 0, balance: 0, reach: 0, lean: 0, look: 0 };
    let yaw, pitch, fov = FOV_WALK, auth = 0, eye;

    if (q < 0.20) {
      // become a person: settle onto the limb, look down at oneself
      b.balance = 0.75 * smooth(seg(q, 0.08, 0.18));
      const m = smooth(seg(q, 0.04, 0.16)), e = eyeAt(b);
      eye = [lerp(e5.ex, e[0], m), lerp(e5.ey, e[1], m), lerp(e5.ez, e[2], m)];
      yaw = lerpYaw(e5.yaw, yLimb, smooth(seg(q, 0.04, 0.17)));
      pitch = lerp(e5.pitch, -74, smoother(seg(q, 0.09, 0.20)));   // far enough down to see one's own chest and feet
      fov = lerp(e5.fov, FOV_WALK, smooth(seg(q, 0.04, 0.18)));
      auth = lerp(e5.auth || 0, 0, smooth(seg(q, 0.04, 0.12)));
    } else if (q < 0.355) {
      // out along the limb (three careful steps), then a crouch
      const t = smooth(seg(q, 0.20, 0.30));
      b.x = lerp(S[0], J[0], t); b.y = lerp(S[1], J[1], t); b.z = lerp(S[2], J[2], t);
      b.phase = ((t * limbLen) / STRIDE) * Math.PI;
      b.amp = 0.45 * bump(seg(q, 0.20, 0.30));
      b.balance = lerp(0.75, 0.35, seg(q, 0.20, 0.30)) * (1 - smooth(seg(q, 0.30, 0.34)));
      b.crouch = 0.85 * smooth(seg(q, 0.30, 0.35));
      b.reach = -0.7 * smooth(seg(q, 0.31, 0.355));
      b.lean = 0.2 * smooth(seg(q, 0.31, 0.355));
      b.yaw = lerpYaw(yLimb, yLeap, smooth(seg(q, 0.26, 0.34)));
      yaw = b.yaw;
      pitch = lerp(-74, -40, smooth(seg(q, 0.20, 0.33)));
      eye = eyeAt(b);
    } else if (q < 0.47) {
      // the leap: a thrown arc, up a little off the limb, then falling faster
      const t = seg(q, 0.355, 0.47);
      b.x = lerp(J[0], L[0], t); b.z = lerp(J[2], L[2], t);
      b.y = J[1] + 2.2 * t * (1 - t) + (L[1] - J[1]) * t * t;
      b.crouch = 0.85 * (1 - smooth(seg(t, 0, 0.18))) + 0.45 * smooth(seg(t, 0.75, 1));
      b.tuck = smooth(seg(t, 0.08, 0.35)) * (1 - smooth(seg(t, 0.6, 0.92)));
      b.reach = lerp(-0.7, 0.55, smooth(seg(t, 0.05, 0.5)));
      b.lean = 0.2 * (1 - t);
      b.yaw = yLeap;
      yaw = yLeap;
      pitch = lerp(-40, -58, smooth(seg(t, 0.1, 0.8)));
      eye = eyeAt(b);
    } else if (q < 0.55) {
      // the landing: the knees take it, the eye dips and comes back up; the gaze finds the way on
      const t = seg(q, 0.47, 0.55);
      b.x = L[0]; b.y = L[1]; b.z = L[2];
      const absorb = t < 0.22 ? lerp(0.45, 1, smooth(t / 0.22)) : 1 - smooth((t - 0.22) / 0.78);
      b.crouch = absorb;
      b.reach = 0.55 * (1 - smooth(seg(t, 0.2, 0.9)));
      b.lean = (0.12 * Math.max(0, absorb - 0.45)) / 0.55;
      b.yaw = lerpYaw(yLeap, yAway, smooth(seg(t, 0.35, 1)));
      yaw = b.yaw;
      pitch = lerp(-58, -4, smoother(seg(t, 0.2, 1)));
      eye = eyeAt(b);
    } else if (q < 0.82) {
      // away from the tree, to where 06 stands (eased start and stop: the feet never slide)
      const t = seg(q, 0.55, 0.82), d = smooth(t);
      b.x = lerp(L[0], W0[0], d); b.z = lerp(L[2], W0[1], d);
      b.y = ground(b.x, b.z);
      b.phase = ((d * walkLen) / STRIDE) * Math.PI;
      b.amp = Math.min(1, 7.5 * t * (1 - t));
      b.yaw = yAway;
      yaw = yAway;
      pitch = -4;
      eye = eyeAt(b);
      eye[1] -= 0.012 * b.amp * Math.abs(Math.sin(b.phase));   // the eye rides the steps (a centimetre, never a sway)
    } else {
      // the turn: head first, then the shoulders, then the feet; the gaze rises to the whole tree
      const head = smoother(seg(q, 0.82, 0.95));
      const feet = smoother(seg(q, 0.86, 0.985));
      b.x = G6[0]; b.y = G6[1]; b.z = G6[2];
      b.yaw = yAway + turn * feet;
      b.look = turn * (head - feet);                         // how far the head leads the body
      b.phase = ((Math.abs(turn * feet) / 45) * Math.PI);    // small steps round on the spot
      b.amp = 0.28 * bump(seg(q, 0.86, 0.985));
      yaw = yAway + turn * head;
      // the eye turns with the head about the neck: it ends exactly at 06's eye
      const e0 = eyeAt({ ...b, amp: 0, phase: 0, yaw: yaw, look: 0 });
      eye = q >= 0.985 ? eye6.slice() : e0;
      pitch = lerp(-4, p6, smoother(seg(q, 0.88, 1)));
      fov = lerp(FOV_WALK, e6.fov, smoother(seg(q, 0.87, 1)));
      auth = lerp(0, e6.auth || 0, smooth(seg(q, 0.9, 1)));
    }
    // the focus distance (V4's depth of field reads it): 05's own, then a walker's few metres, then 06's
    const dist = q < 0.2 ? lerp(e5.dist || 12, 9, smooth(seg(q, 0.04, 0.18))) : q > 0.86 ? lerp(9, e6.dist || 12, smooth(seg(q, 0.86, 1))) : 9;
    const pr = pitch * D2R, yr = yaw * D2R;
    const cam = {
      ex: eye[0], ey: eye[1], ez: eye[2], fov, auth, dist, yaw, pitch,
      lx: eye[0] + Math.sin(yr) * Math.cos(pr) * dist, ly: eye[1] + Math.sin(pr) * dist, lz: eye[2] + Math.cos(yr) * Math.cos(pr) * dist
    };
    let beat = -1;
    for (let i = 0; i < BEATS.length; i++) if (Math.abs(q - BEATS[i]) < 1e-3) beat = i;
    return { q, body: b, cam, beat };
  }
  return { pose, facts: { S, J, L, G6, eye6, y6, p6, yAway, yLimb, yLeap, walkLen, turn } };
}

/** the walker's eye as V4's DwellCamera reads a frame (its 'rail') */
export function railOf(cam) {
  return { ex: cam.ex, ey: cam.ey, ez: cam.ez, lx: cam.lx, ly: cam.ly, lz: cam.lz, fov: cam.fov, auth: cam.auth, dist: cam.dist };
}
