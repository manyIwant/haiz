/**
 * HAIZ Toybox V2 — Spring-Damper Claw Kinematics
 */

import { SHOWCASE_BOUNDS } from '../verification/constants.js';

export class ClawKinematics {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = 0.0;
    this.vx = 0.0;
    this.clawY = SHOWCASE_BOUNDS.restClawY;
    this.targetClawY = SHOWCASE_BOUNDS.restClawY;
    this.swingAngle = 0.0;
    this.swingVel = 0.0;
    this.prongOpen = 0.30;
    this.targetProngOpen = 0.30;
    this.weightStretch = 0.0;
  }

  step(dt, inputX, allowMove, hasPayload) {
    const cdt = Math.min(0.05, Math.max(0.001, dt));
    const maxSpeed = hasPayload ? 2.15 : 2.70;
    const accel = allowMove ? 14.5 : 0.0;
    const damp = 8.0;

    const prevVx = this.vx;
    if (allowMove && Math.abs(inputX) > 0.02) {
      this.vx += inputX * accel * cdt;
      this.vx = Math.max(-maxSpeed, Math.min(maxSpeed, this.vx));
    } else {
      this.vx *= Math.exp(-damp * cdt);
      if (Math.abs(this.vx) < 0.004) this.vx = 0;
    }

    const nextX = this.x + this.vx * cdt;
    if (nextX < SHOWCASE_BOUNDS.minX) {
      this.x = SHOWCASE_BOUNDS.minX;
      this.vx = Math.max(0, -this.vx * 0.18);
    } else if (nextX > SHOWCASE_BOUNDS.maxX) {
      this.x = SHOWCASE_BOUNDS.maxX;
      this.vx = Math.min(0, -this.vx * 0.18);
    } else {
      this.x = nextX;
    }

    const ax = (this.vx - prevVx) / cdt;
    const k = hasPayload ? 24.0 : 34.0;
    const c = hasPayload ? 3.6 : 4.8;
    const torque = -ax * (hasPayload ? 0.025 : 0.017) - k * this.swingAngle - c * this.swingVel;
    this.swingVel += torque * cdt;
    this.swingAngle = Math.max(-0.28, Math.min(0.28, this.swingAngle + this.swingVel * cdt));

    this.clawY += (this.targetClawY - this.clawY) * (1 - Math.exp(-10.5 * cdt));
    this.prongOpen += (this.targetProngOpen - this.prongOpen) * (1 - Math.exp(-13.0 * cdt));

    const targetW = hasPayload ? 0.068 : 0.0;
    this.weightStretch += (targetW - this.weightStretch) * (1 - Math.exp(-8.5 * cdt));

    return { speedRatio: Math.min(1, Math.abs(this.vx) / maxSpeed) };
  }

  impulseSwing(v) {
    this.swingVel += v;
  }

  isOverPrizeChute() {
    return Math.abs(this.x - SHOWCASE_BOUNDS.chuteX) <= SHOWCASE_BOUNDS.chuteRadius;
  }
}
