import { Quaternion, Vector3 } from 'three';

const UP = new Vector3(0, 1, 0);
const RIGHT = new Vector3(1, 0, 0);
const FWD = new Vector3(0, 0, 1);

export function wrapAngle(rad) {
  return rad - 2 * Math.PI * Math.floor((rad + Math.PI) / (2 * Math.PI));
}

function damp(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * Math.max(dt, 0)));
}

/**
 * 5-stage physiological turn cascade:
 *   Gaze -> Head -> Neck -> Chest -> Pelvis -> Footsteps
 *
 * Eliminates the "turret rotation" problem:
 *  - When stationary and target heading shifts < 32 deg, only gaze/head/neck/subtle chest rotate.
 *  - When stationary and |delta| >= 32 deg, gaze & head lead 90-140ms before torso & pivot step.
 *  - When moving and cutting sharply (|delta| > 115 deg), automatically executes Brake -> Plant -> Pivot
 *    while banking naturally into curved turns.
 *  - In diagonal strafe mode, keeps chest/head oriented toward aimHeading while pelvis follows travel.
 */
export class TurnCascadeController {
  constructor(bones, options = {}) {
    this.bones = bones; // { hips, spine, spine1, chest, neck, head }
    this.strafeMode = options.strafeMode ?? false;
    this.aimHeading = options.aimHeading ?? 0;
    this.gazeTargetHeading = 0;

    // State scalars (radians)
    this.gazeLead = 0;
    this.headYaw = 0;
    this.neckYaw = 0;
    this.chestYaw = 0;
    this.chestBank = 0;
    this.hipsBank = 0;
    this.cascadePhase = 'aligned';

    // Pivot latch for sharp reversals (> 115 deg) while moving
    this.pivotCooldown = 0;
    this.qTmp = new Quaternion();
    this.qLocal = new Quaternion();
    this.debug = {
      deltaDeg: 0,
      gazeLeadDeg: 0,
      headYawDeg: 0,
      neckYawDeg: 0,
      chestYawDeg: 0,
      pelvisYawDeg: 0,
      bankDeg: 0,
      mode: 'aligned',
    };
  }

  reset() {
    this.gazeLead = 0;
    this.headYaw = 0;
    this.neckYaw = 0;
    this.chestYaw = 0;
    this.chestBank = 0;
    this.hipsBank = 0;
    this.pivotCooldown = 0;
    this.cascadePhase = 'aligned';
  }

  /**
   * Shape desired locomotion target speed & heading BEFORE human.update(dt)
   * so moving sharp cuts decelerate into a planted pivot rather than ice-skating.
   */
  preUpdate(human, desiredHeading, desiredSpeed, dt) {
    const currentHeading = human.heading;
    const speed = human.speed;
    const delta = wrapAngle(desiredHeading - currentHeading);
    const absDeg = Math.abs(delta) * (180 / Math.PI);

    this.gazeTargetHeading = this.strafeMode ? this.aimHeading : desiredHeading;
    let effectiveSpeed = desiredSpeed;

    if (this.pivotCooldown > 0) {
      this.pivotCooldown = Math.max(0, this.pivotCooldown - dt);
    }

    // Brake-Plant-Pivot on sharp reversal while moving briskly
    if (speed > 0.75 && absDeg > 115) {
      this.cascadePhase = 'brake_plant_pivot';
      effectiveSpeed = Math.min(desiredSpeed, 0.25);
    } else if (speed < 0.22 && absDeg >= 32) {
      this.cascadePhase = 'idle_pivot_cascade';
    } else if (speed < 0.22 && absDeg > 3) {
      this.cascadePhase = 'idle_gaze_orient';
    } else if (speed >= 0.22 && absDeg > 10) {
      this.cascadePhase = 'curved_bank_turn';
      const curveSlow = 1 - Math.min(0.42, (absDeg / 135) * 0.42);
      effectiveSpeed = desiredSpeed * curveSlow;
    } else {
      this.cascadePhase = this.strafeMode ? 'diagonal_strafe' : 'aligned';
    }

    return {
      targetHeading: desiredHeading,
      targetSpeed: effectiveSpeed,
      deltaRad: delta,
    };
  }

  /**
   * Apply cascade neck/head/chest offsets & turn bank AFTER human.update(dt)
   * so TPL's lower-body footsteps remain planted cleanly while the upper body leads realistically.
   */
  postUpdate(human, dt) {
    const bodyState = human.locomotion?.body?.state;
    const pelvisHeading = human.heading;
    const angVel = bodyState?.angularVelocity ?? 0;
    const speed = human.speed ?? 0;
    const turnDelta = wrapAngle(this.gazeTargetHeading - pelvisHeading);
    const absDeg = Math.abs(turnDelta) * (180 / Math.PI);

    // Stage 1: Gaze & Head anticipatory lead (fast response ~ 13 rad/s)
    const maxHeadRad = 52 * (Math.PI / 180);
    const targetHead = Math.max(-maxHeadRad, Math.min(maxHeadRad, turnDelta * 0.68));
    // Stage 2: Neck share follows gaze slightly softer
    const targetNeck = Math.max(-0.38, Math.min(0.38, turnDelta * 0.24));
    // Stage 3: Chest leads toward target when walking or strafing, without twisting beyond anatomy
    let targetChest = 0;
    if (this.strafeMode) {
      targetChest = Math.max(-0.42, Math.min(0.42, turnDelta * 0.45));
    } else if (absDeg > 14) {
      targetChest = Math.max(-0.34, Math.min(0.34, turnDelta * 0.28));
    }

    // Smooth cascading springs (head fastest, chest slowest -> temporal order gaze->head->neck->chest->pelvis)
    this.gazeLead = damp(this.gazeLead, turnDelta, 15, dt);
    this.headYaw = damp(this.headYaw, targetHead, 12.5, dt);
    this.neckYaw = damp(this.neckYaw, targetNeck, 9.5, dt);
    this.chestYaw = damp(this.chestYaw, targetChest, 6.8, dt);

    // Lean/bank subtly into turn curvature (centripetal compensation on upper spine/chest only — NEVER mutate hips!)
    const centripetal = Math.max(-0.14, Math.min(0.14, -angVel * Math.min(speed, 4.0) * 0.045));
    this.hipsBank = damp(this.hipsBank, centripetal * 0.35, 7.5, dt);
    this.chestBank = damp(this.chestBank, centripetal * 0.65, 6.2, dt);

    const fwdX = Math.sin(pelvisHeading);
    const fwdZ = Math.cos(pelvisHeading);
    this._applyWorldAxisAngles(this.bones.spine, 0, this.hipsBank, fwdX, fwdZ);
    this._applyWorldAxisAngles(this.bones.chest, this.chestYaw, this.chestBank, fwdX, fwdZ);
    this._applyWorldAxisAngles(this.bones.neck, this.neckYaw, 0, fwdX, fwdZ);
    this._applyWorldAxisAngles(this.bones.head, this.headYaw * 0.62, 0, fwdX, fwdZ);

    this.debug.deltaDeg = absDeg;
    this.debug.gazeLeadDeg = this.gazeLead * (180 / Math.PI);
    this.debug.headYawDeg = this.headYaw * (180 / Math.PI);
    this.debug.neckYawDeg = this.neckYaw * (180 / Math.PI);
    this.debug.chestYawDeg = this.chestYaw * (180 / Math.PI);
    this.debug.pelvisYawDeg = pelvisHeading * (180 / Math.PI);
    this.debug.bankDeg = (this.hipsBank + this.chestBank) * (180 / Math.PI);
    this.debug.mode = this.cascadePhase;
  }

  _applyWorldAxisAngles(bone, yawRad, rollRad, fwdX, fwdZ) {
    if (!bone || (Math.abs(yawRad) < 1e-4 && Math.abs(rollRad) < 1e-4)) return;
    if (bone.parent) bone.parent.updateWorldMatrix(true, false);
    const parentQInv = this.qLocal.identity();
    if (bone.parent) bone.parent.getWorldQuaternion(parentQInv).invert();

    if (Math.abs(yawRad) >= 1e-4) {
      const worldY = this.vTmp1 ? this.vTmp1.copy(UP) : (this.vTmp1 = UP.clone());
      worldY.applyQuaternion(parentQInv).normalize();
      this.qTmp.setFromAxisAngle(worldY, yawRad);
      bone.quaternion.premultiply(this.qTmp);
    }
    if (Math.abs(rollRad) >= 1e-4) {
      const worldFwd = this.vTmp2 ? this.vTmp2.set(fwdX, 0, fwdZ) : (this.vTmp2 = new Vector3(fwdX, 0, fwdZ));
      worldFwd.applyQuaternion(parentQInv).normalize();
      this.qTmp.setFromAxisAngle(worldFwd, rollRad);
      bone.quaternion.premultiply(this.qTmp);
    }
    bone.updateWorldMatrix(false, true);
  }
}
