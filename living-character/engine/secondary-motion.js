import { Quaternion, Vector3 } from 'three';

const AXIS_X = new Vector3(1, 0, 0);
const AXIS_Y = new Vector3(0, 1, 0);
const AXIS_Z = new Vector3(0, 0, 1);

function createSpring2() {
  return { x: 0, vx: 0, z: 0, vz: 0 };
}

function stepSpring(s, tx, tz, omega, zeta, dt) {
  const steps = Math.max(1, Math.min(4, Math.ceil(dt * 120)));
  const h = dt / steps;
  const k = omega * omega;
  const c = 2 * zeta * omega;
  for (let i = 0; i < steps; i++) {
    const ax = k * (tx - s.x) - c * s.vx;
    const az = k * (tz - s.z) - c * s.vz;
    s.vx += ax * h;
    s.vz += az * h;
    s.x += s.vx * h;
    s.z += s.vz * h;
  }
}

/**
 * 2nd-order damped secondary motion solver for HAIZ character props:
 *  - bag_body (shoulder backpack bounce & lag)
 *  - crossbody_bag (diagonal satchel swing + hip/thigh anti-clip clearance)
 *  - hair_fringe, hair_back, ponytail_01, ponytail_02
 *  - shirt_hem_f, shirt_hem_b (stride & sea-breeze cloth impulse)
 */
export class SecondaryMotionSystem {
  constructor(bones, opts = {}) {
    this.bones = bones;
    this.restQuats = new Map();
    for (const [k, b] of Object.entries(bones)) {
      if (b) this.restQuats.set(k, b.quaternion.clone());
    }

    this.springs = {
      bag_body: createSpring2(),
      crossbody_bag: createSpring2(),
      hair_fringe: createSpring2(),
      hair_back: createSpring2(),
      ponytail_01: createSpring2(),
      ponytail_02: createSpring2(),
      shirt_hem_f: createSpring2(),
      shirt_hem_b: createSpring2(),
    };

    this.prevVel = new Vector3();
    this.prevHeading = 0;
    this.hasPrev = false;
    this.windDir = new Vector3(0.75, 0, 0.65).normalize();
    this.windStrength = opts.windStrength ?? 0.35;
    this.qTmp = new Quaternion();
    this.localAccel = new Vector3();
    this.time = 0;
  }

  reset() {
    for (const s of Object.values(this.springs)) {
      s.x = s.vx = s.z = s.vz = 0;
    }
    for (const [k, q] of this.restQuats) {
      if (this.bones[k]) this.bones[k].quaternion.copy(q);
    }
    this.hasPrev = false;
  }

  update(dt, state) {
    if (dt <= 0) return;
    this.time += dt;

    const vel = state.velocity || new Vector3();
    const heading = state.heading ?? 0;
    const speed = state.speed ?? vel.length();

    if (!this.hasPrev) {
      this.prevVel.copy(vel);
      this.prevHeading = heading;
      this.hasPrev = true;
    }

    // World acceleration + centrifugal term rotated into character local frame
    const dvx = (vel.x - this.prevVel.x) / Math.max(dt, 1e-3);
    const dvy = (vel.y - this.prevVel.y) / Math.max(dt, 1e-3);
    const dvz = (vel.z - this.prevVel.z) / Math.max(dt, 1e-3);
    this.prevVel.copy(vel);

    let dHeading = heading - this.prevHeading;
    while (dHeading > Math.PI) dHeading -= 2 * Math.PI;
    while (dHeading < -Math.PI) dHeading += 2 * Math.PI;
    const yawRate = dHeading / Math.max(dt, 1e-3);
    this.prevHeading = heading;

    const ch = Math.cos(-heading);
    const sh = Math.sin(-heading);
    const axLocal = dvx * ch - dvz * sh;
    const azLocal = dvx * sh + dvz * ch;

    // Forward speed creates rearward aerodynamic drag & bounce
    const fwdLocal = vel.x * sh + vel.z * ch; // approx forward magnitude
    const windLocalX = (this.windDir.x * ch - this.windDir.z * sh) * this.windStrength;
    const windLocalZ = (this.windDir.x * sh + this.windDir.z * ch) * this.windStrength;
    const gust = 0.65 + 0.35 * Math.sin(this.time * 2.1) + 0.15 * Math.sin(this.time * 5.3);

    // 1. Backpack (hugs upper thoracic back tightly; negative pitch bends pack away only slightly, never into torso)
    {
      const tx = Math.max(-0.07, Math.min(0.03, dvy * 0.008 - speed * 0.008));
      const tz = Math.max(-0.06, Math.min(0.06, axLocal * 0.008 - yawRate * 0.015));
      stepSpring(this.springs.bag_body, tx, tz, 18.0, 0.72, dt);
      this._applyBoneSpring('bag_body', this.springs.bag_body);
    }

    // 2. Crossbody satchel (rests outside right hip, clears right thigh swing!)
    {
      const thighFwdR = state.rightThighForward ?? 0; // positive when right thigh swings forward
      const thighClear = Math.max(0, thighFwdR) * 0.16;
      const tx = Math.max(-0.14, Math.min(0.16, -azLocal * 0.016 - speed * 0.018 + windLocalZ * 0.03));
      const tz = Math.max(-0.04, Math.min(0.24, thighClear + Math.abs(yawRate) * 0.018 + axLocal * 0.012 + 0.015));
      stepSpring(this.springs.crossbody_bag, tx, tz, 11.0, 0.52, dt);
      this._applyBoneSpring('crossbody_bag', this.springs.crossbody_bag);
    }

    // 3. Hair (fringe & back & optional ponytail)
    {
      const breezeF = (windLocalZ * gust * 0.09) - speed * 0.032 - azLocal * 0.015;
      const breezeS = (windLocalX * gust * 0.08) + yawRate * 0.035 + axLocal * 0.012;
      stepSpring(this.springs.hair_fringe, Math.max(-0.22, Math.min(0.18, breezeF * 0.7)), Math.max(-0.18, Math.min(0.18, breezeS * 0.6)), 15.0, 0.48, dt);
      stepSpring(this.springs.hair_back, Math.max(-0.34, Math.min(0.22, breezeF - dvy * 0.018)), Math.max(-0.24, Math.min(0.24, breezeS)), 12.5, 0.42, dt);
      this._applyBoneSpring('hair_fringe', this.springs.hair_fringe);
      this._applyBoneSpring('hair_back', this.springs.hair_back);

      if (this.bones.ponytail_01) {
        stepSpring(this.springs.ponytail_01, Math.max(-0.42, Math.min(0.30, breezeF * 1.15 - dvy * 0.025)), Math.max(-0.32, Math.min(0.32, breezeS * 1.2)), 11.2, 0.38, dt);
        this._applyBoneSpring('ponytail_01', this.springs.ponytail_01);
      }
      if (this.bones.ponytail_02) {
        // Follow-through lag from upper segment
        stepSpring(this.springs.ponytail_02, this.springs.ponytail_01.x * 0.85, this.springs.ponytail_01.z * 0.85, 9.4, 0.34, dt);
        this._applyBoneSpring('ponytail_02', this.springs.ponytail_02);
      }
    }

    // 4. Shirt hem flutter (tight angular clamp so pants/hem never poke through rear backpack)
    {
      const stridePush = Math.max(0, state.strideAmplitude ?? 0) * 0.045;
      const hfTx = Math.max(-0.045, Math.min(0.055, stridePush + windLocalZ * gust * 0.035 - speed * 0.008));
      const hbTx = Math.max(-0.045, Math.min(0.045, -stridePush * 0.6 + windLocalZ * gust * 0.030));
      const hTz = Math.max(-0.04, Math.min(0.04, windLocalX * gust * 0.03 + yawRate * 0.01));
      stepSpring(this.springs.shirt_hem_f, hfTx, hTz, 16.0, 0.56, dt);
      stepSpring(this.springs.shirt_hem_b, hbTx, hTz, 16.0, 0.56, dt);
      this._applyBoneSpring('shirt_hem_f', this.springs.shirt_hem_f);
      this._applyBoneSpring('shirt_hem_b', this.springs.shirt_hem_b);
    }
  }

  _applyBoneSpring(name, spring) {
    const bone = this.bones[name];
    const rest = this.restQuats.get(name);
    if (!bone || !rest) return;
    bone.quaternion.copy(rest);
    this.qTmp.setFromAxisAngle(AXIS_X, spring.x);
    bone.quaternion.multiply(this.qTmp);
    this.qTmp.setFromAxisAngle(AXIS_Z, spring.z);
    bone.quaternion.multiply(this.qTmp);
    bone.updateWorldMatrix(false, true);
  }
}
