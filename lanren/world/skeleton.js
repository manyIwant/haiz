// The walker's skeleton: proportions and joint angles from a few pose values (pure).
//
// Shared by the film (film.js: where the eye must be for the feet to be on the ground),
// the walk (walk.js) and the building-block body that is drawn (body.js), so the camera is
// always exactly in the head and the feet exactly on the ground.
//
// Pose values (all in [0, 1] unless noted):
//   phase   walking phase (radians; one step is π), amp  how much of a stride (0 standing)
//   crouch  knees bending (landing, preparing a leap), tuck  legs drawn up in the air
//   balance arms out to the sides, reach  arms forward (negative: swung back)
//   lean    the torso leaning forward (radians), look  the head turned from the body (degrees)
//   roll    the upper body leaning sideways (radians: balance), tilt  the arms answering it
//   nod     the head raised (+) or lowered (degrees; only the drawn head, never the eye)
//   weight  standing at ease on one leg (−1 … 1): hips drop to the free side, that knee softens
export const DIM = {
  // the eye sits at the front of the head (a person's eyes are ~10 cm ahead of the chest): looking
  // down shows the chest receding and the legs and feet, not the top of the shoulders
  foot: 0.07, shin: 0.37, thigh: 0.38, torso: 0.6, head: 0.42, headEye: 0.2, eyeFwd: 0.26,
  hipW: 0.105, shoulderX: 0.3, shoulderY: 0.56, upper: 0.32, fore: 0.27, hand: 0.09,
  torsoW: 0.44, torsoD: 0.24, limb: 0.17, leg: 0.19, legD: 0.21
};
export const HIP = DIM.foot + DIM.shin + DIM.thigh;              // 0.82
export const EYE = HIP + DIM.torso + DIM.headEye;                // 1.62 (compose.js EYE_H)

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/** joint angles (radians, forward-positive) for a pose */
export function angles(p) {
  const amp = clamp(p.amp || 0, 0, 1.4), crouch = clamp(p.crouch || 0, 0, 1), tuck = clamp(p.tuck || 0, 0, 1);
  const s = Math.sin(p.phase || 0), c = Math.cos(p.phase || 0);
  const swing = 0.5 * amp;
  const a = {
    legL: swing * s + crouch * 0.95 + tuck * 1.15,
    legR: -swing * s + crouch * 0.95 + tuck * 1.0,
    kneeL: amp * 0.85 * Math.max(0, c) + amp * 0.12 + crouch * 1.85 + tuck * 1.7,
    kneeR: amp * 0.85 * Math.max(0, -c) + amp * 0.12 + crouch * 1.85 + tuck * 1.55,
    lean: (p.lean || 0) + crouch * 0.38 + amp * 0.06,
    look: ((p.look || 0) * Math.PI) / 180
  };
  // the walk carries the hips round and the shoulders against them (the head stays steady)
  a.twistHip = 0.09 * amp * s;
  a.twistTorso = -0.17 * amp * s;
  const w = clamp(p.weight || 0, -1, 1);
  a.hipRoll = 0.06 * w + 0.035 * amp * c;                 // the pelvis drops towards the free leg
  a.roll = (p.roll || 0);                                  // the upper body's lean, in the world
  a.nod = ((p.nod || 0) * Math.PI) / 180;
  if (w > 0) a.kneeR += 0.2 * w; else a.kneeL += -0.2 * w;
  const bal = clamp(p.balance || 0, 0, 1), reach = clamp(p.reach || 0, -1, 1);
  // arms swing against the legs; balance lifts them out to the sides; reach brings them forward (or back)
  const armSwing = -0.75 * swing * s;
  // (balancing, the arms go out and a little forward: low enough to be seen when looking down)
  a.armL = armSwing * (1 - bal) + reach * 1.25 + tuck * 0.5 + crouch * 0.25 + bal * 0.5;
  a.armR = -armSwing * (1 - bal) + reach * 1.25 + tuck * 0.45 + crouch * 0.25 + bal * 0.5;
  a.armOut = bal * 0.95 + tuck * 0.35 + 0.06 + 0.05 * Math.abs(w);
  const tilt = clamp(p.tilt || 0, -0.6, 0.6);
  a.armOutL = a.armOut + tilt; a.armOutR = a.armOut - tilt;
  a.elbowL = 0.18 + amp * 0.25 * Math.max(0, s) + bal * 0.35 + Math.max(0, reach) * 0.35 + crouch * 0.3;
  a.elbowR = 0.18 + amp * 0.25 * Math.max(0, -s) + bal * 0.35 + Math.max(0, reach) * 0.35 + crouch * 0.3;
  // the hips sit as high as the longer (standing) leg reaches: the foot stays on the ground
  const legV = (t, k) => DIM.thigh * Math.cos(t) + DIM.shin * Math.cos(k - t);
  a.hip = DIM.foot + Math.max(legV(a.legL, a.kneeL), legV(a.legR, a.kneeR));
  return a;
}

/**
 * where the eye is above, in front of and beside the feet (m), for a pose:
 *   base  forward of the feet by the torso's lean     head  forward of the neck (turns with look)
 *   side  to the body's right by the upper body's roll   fwd = base + head (looking straight on)
 */
export function eyeOffset(p, a = angles(p)) {
  const reach = DIM.torso + DIM.headEye;
  const base = Math.sin(a.lean) * reach;
  return { up: a.hip + Math.cos(a.lean) * Math.cos(a.roll) * reach, base, head: DIM.eyeFwd, side: Math.sin(a.roll) * Math.cos(a.lean) * reach, fwd: base + DIM.eyeFwd };
}
