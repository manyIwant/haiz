import { Quaternion, Vector3 } from 'three';
import { createRig } from '../../lanren/free/rig.js';

function resolveBone(bones, name) {
  if (!name) return undefined;
  return bones[name] || bones[name.replace(/\.(L|R)$/i, (_, s) => s.toUpperCase())];
}

/**
 * Adapter that reuses Claude's inherited world-space 2-bone IK solver (`lanren/free/rig.js`)
 * for Campus Bike Riding & Gliding postures with smooth 0.35s quaternion slerp
 * transitions into and out of procedural walking (`LivingCharacterAgent`).
 */
export class VehicleIKAdapter {
  constructor(agent) {
    this.agent = agent;
    this.ikRig = null;
    this.activeVehicle = null; // null | 'bike' | 'glide'
    this.blendT = 0;
    this.fadeOutTimer = 0;
    this.blendDuration = 0.35;
    this.entering = false;

    this._initClaudeRig();
  }

  _initClaudeRig() {
    const a = this.agent;
    if (!a?.model || !a?.human || !a?.bones) return;
    const bones = a.bones;
    const studentAdapter = {
      model: a.model,
      human: a.human,
      bone: (name) => resolveBone(bones, name),
    };
    this.ikRig = createRig(studentAdapter);
    // Reset back cleanly from createRig's restPose() measurement
    a.human.reset();
  }

  enterVehicle(mode) {
    if (this.activeVehicle === mode) return;
    this.activeVehicle = mode;
    this.blendT = 0;
    this.fadeOutTimer = 0;
    this.entering = true;
    if (this.ikRig) this.ikRig.capture();
  }

  exitVehicle() {
    if (!this.activeVehicle) return;
    this.activeVehicle = null;
    this.entering = false;
    this.fadeOutTimer = this.blendDuration;
    if (this.ikRig) this.ikRig.capture();
  }

  /**
   * Apply inherited world-space 2-bone IK spec when riding Bike/Glider,
   * or blend smoothly over 0.35s when dismounting back into procedural walk.
   */
  apply(dt, poseSpec = null) {
    if (!this.ikRig) return false;

    if (this.activeVehicle && poseSpec) {
      this.blendT = Math.min(1, this.blendT + dt / this.blendDuration);
      if (this.entering && this.blendT < 1) {
        // Re-pose first from live spec, then blend from pre-mount snapshot
        this.ikRig.pose(poseSpec);
        this.ikRig.blendFromSnap(this.blendT);
      } else {
        this.entering = false;
        this.ikRig.pose(poseSpec);
      }
      return true;
    }

    if (this.fadeOutTimer > 0) {
      this.fadeOutTimer = Math.max(0, this.fadeOutTimer - dt);
      const u = 1 - this.fadeOutTimer / this.blendDuration;
      this.ikRig.blendFromSnap(u);
      return true;
    }

    return false;
  }
}
