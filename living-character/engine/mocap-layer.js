import { Quaternion } from 'three';

const Q_ID = new Quaternion();

function sanitizeBoneKey(name) {
  return name.replace(/\.(L|R)$/i, (_, s) => s.toUpperCase());
}

/**
 * Phase-locked Mocap Expression Layer.
 * Samples retargeted UAL1 (CC0) and CMU Graphics Lab upper-body tracks
 * (`haiz-motion-pack.json`) synchronized to real-time locomotion footstep phase.
 *
 * Design discipline (refined after v1 visual audit):
 *  - Procedural TorsoController / ArmController / StairPlanner already own primary
 *    torso pitch, pelvic-thoracic counter-rotation, and arm pendulum mechanics.
 *  - Stacking full mocap spine/upperarm pitch on top of TPL caused double-leaning
 *    during jogging/stairs/slopes in v1.
 *  - Therefore, during locomotion (speed >= 0.14) this layer applies ONLY physiological
 *    micro-phrasing (gentle clavicle/hand nuance + soft chest breathing + subtle
 *    walk look-ahead), while reserving full expressive idle clips (idle_relaxed,
 *    idle_look_around, idle_talk) for stationary stances where TPL is at rest.
 */
export class MocapExpressionLayer {
  constructor(bones, motionPack = null) {
    this.bones = bones;
    this.pack = motionPack;
    this.clips = motionPack?.clips ?? motionPack ?? {};
    this.restQuats = new Map();
    for (const [k, b] of Object.entries(bones)) {
      if (b) this.restQuats.set(k, b.quaternion.clone());
    }

    this.gaitPhase = 0;
    this.idleTimer = 0;
    this.lookAroundWeight = 0;
    this.talkWeight = 0;

    // Micro-nuance weights per bone when IDLE vs MOVING
    this.idleWeights = {
      chest: 0.24,
      neck: 0.30,
      head: 0.36,
      shoulderL: 0.35,
      shoulderR: 0.35,
      forearmL: 0.22,
      forearmR: 0.22,
      handL: 0.35,
      handR: 0.35,
    };
    this.moveNuanceWeights = {
      shoulderL: 0.14,
      shoulderR: 0.14,
      handL: 0.22,
      handR: 0.22,
    };

    this.qA = new Quaternion();
    this.qB = new Quaternion();
    this.qSample = new Quaternion();
    this.qBlend = new Quaternion();
    this.enabled = true;
  }

  setPack(pack) {
    this.pack = pack;
    this.clips = pack?.clips ?? pack ?? {};
  }

  syncFootstep(side = 'left') {
    const target = side === 'left' ? 0.0 : 0.5;
    let err = target - this.gaitPhase;
    if (err > 0.5) err -= 1.0;
    if (err < -0.5) err += 1.0;
    this.gaitPhase = (this.gaitPhase + err * 0.45 + 1.0) % 1.0;
  }

  setTalkWeight(w) {
    this.talkWeight = Math.max(0, Math.min(1, w));
  }

  update(dt, { speed = 0 } = {}) {
    if (!this.enabled || !this.clips) return;

    this.idleTimer += dt;
    const freq = speed < 0.25 ? 0.0 : (1.35 + Math.min(speed, 5.0) * 0.42);
    this.gaitPhase = (this.gaitPhase + freq * dt) % 1.0;

    // Subtle organic breathing oscillation (gentle pitch +-0.6 deg)
    const breathRad = Math.sin(this.idleTimer * 1.45) * 0.010;
    if (this.bones.chest) {
      this.qBlend.set(Math.sin(breathRad * 0.5), 0, 0, Math.cos(breathRad * 0.5));
      this.bones.chest.quaternion.multiply(this.qBlend);
    }

    const isIdle = speed < 0.14;
    const lookCycle = Math.max(0, Math.sin(this.idleTimer * 0.52) - 0.35) / 0.65;
    this.lookAroundWeight += ((isIdle ? lookCycle * 0.65 : 0) - this.lookAroundWeight) * (1 - Math.exp(-3.5 * dt));

    let clipName = 'walk_normal';
    let normTime = this.gaitPhase;
    let weightTable = this.moveNuanceWeights;

    if (isIdle) {
      weightTable = this.idleWeights;
      if (this.talkWeight > 0.2 && this.clips.idle_talk) {
        clipName = 'idle_talk';
      } else if (this.lookAroundWeight > 0.15 && this.clips.idle_look_around) {
        clipName = 'idle_look_around';
      } else if (this.clips.idle_relaxed) {
        clipName = 'idle_relaxed';
      }
      const clip = this.clips[clipName];
      if (clip?.duration > 0) normTime = (this.idleTimer % clip.duration) / clip.duration;
    } else if (speed < 1.15 && this.clips.walk_slow) {
      clipName = 'walk_slow';
    } else if (speed < 2.35 && this.clips.walk_normal) {
      clipName = 'walk_normal';
    } else if (speed < 3.85 && this.clips.jog_normal) {
      clipName = 'jog_normal';
    } else if (this.clips.run_fast) {
      clipName = 'run_fast';
    }

    const clip = this.clips[clipName];
    if (!clip || !clip.tracks) return;

    for (const rawName of Object.keys(clip.tracks)) {
      const bKey = sanitizeBoneKey(rawName);
      const localW = weightTable[bKey];
      if (!localW || localW <= 1e-3) continue;
      const bone = this.bones[bKey];
      if (!bone) continue;

      this._sampleTrack(clip.tracks[rawName], normTime, this.qSample);
      // Cap maximum angular perturbation per bone (~8 deg) so rest-pose diffs cannot kink joints
      const clampedW = Math.min(localW, 0.16 / Math.max(0.16, 2 * Math.acos(Math.min(1, Math.abs(this.qSample.w)))));
      this.qBlend.slerpQuaternions(Q_ID, this.qSample, clampedW);
      bone.quaternion.multiply(this.qBlend);
    }
  }

  _sampleTrack(frames, u, out) {
    const n = frames.length;
    if (n === 0) return out.identity();
    if (n === 1) {
      const f = frames[0];
      return out.set(f[0], f[1], f[2], f[3]).normalize();
    }
    const fPos = Math.max(0, Math.min(n - 1, u * (n - 1)));
    const i0 = Math.floor(fPos);
    const i1 = Math.min(n - 1, i0 + 1);
    const alpha = fPos - i0;
    const f0 = frames[i0];
    const f1 = frames[i1];
    this.qA.set(f0[0], f0[1], f0[2], f0[3]);
    this.qB.set(f1[0], f1[1], f1[2], f1[3]);
    if (this.qA.dot(this.qB) < 0) this.qB.set(-f1[0], -f1[1], -f1[2], -f1[3]);
    return out.slerpQuaternions(this.qA, this.qB, alpha).normalize();
  }
}
