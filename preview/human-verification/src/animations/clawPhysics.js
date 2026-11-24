/**
 * HAIZ Human Verification — Spring-Damper Claw Kinematics & Plushie Pile Physics
 */

import { CABINET_BOUNDS } from '../verification/constants.js';

export class ClawKinematics {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = 0.0;
    this.vx = 0.0;
    this.clawY = CABINET_BOUNDS.restClawY;
    this.targetClawY = CABINET_BOUNDS.restClawY;

    // Pendulum swing of claw head (radians around Z)
    this.swingAngle = 0.0;
    this.swingVel = 0.0;

    // Prong aperture: 0 = closed, 1 = wide open
    this.prongOpen = 0.28;
    this.targetProngOpen = 0.28;

    // Subtle plushie squeeze & dangle
    this.plushSqueeze = 1.0;
    this.plushWeightOffset = 0.0;
  }

  /**
   * Step horizontal gantry & pendulum dynamics.
   * @param {number} dt - delta time in seconds (clamped)
   * @param {number} inputX - normalized horizontal command [-1, 1]
   * @param {boolean} allowMove - whether horizontal motion is currently permitted
   * @param {boolean} hasPayload - whether a plushie is currently held
   */
  step(dt, inputX, allowMove, hasPayload) {
    const clampedDt = Math.min(0.05, Math.max(0.001, dt));
    const maxSpeed = hasPayload ? 2.25 : 2.85;
    const accel = allowMove ? 13.5 : 0.0;
    const damping = 7.4;

    const prevVx = this.vx;
    if (allowMove && Math.abs(inputX) > 0.02) {
      this.vx += inputX * accel * clampedDt;
      this.vx = Math.max(-maxSpeed, Math.min(maxSpeed, this.vx));
    } else {
      this.vx *= Math.exp(-damping * clampedDt);
      if (Math.abs(this.vx) < 0.004) this.vx = 0;
    }

    const nextX = this.x + this.vx * clampedDt;
    if (nextX < CABINET_BOUNDS.minX) {
      this.x = CABINET_BOUNDS.minX;
      this.vx = Math.max(0, -this.vx * 0.22);
    } else if (nextX > CABINET_BOUNDS.maxX) {
      this.x = CABINET_BOUNDS.maxX;
      this.vx = Math.min(0, -this.vx * 0.22);
    } else {
      this.x = nextX;
    }

    // Horizontal acceleration excites pendulum swing
    const ax = (this.vx - prevVx) / clampedDt;
    const springK = hasPayload ? 26.0 : 34.0;
    const swingDamp = hasPayload ? 3.8 : 4.6;
    const torque = -ax * (hasPayload ? 0.026 : 0.019) - springK * this.swingAngle - swingDamp * this.swingVel;
    this.swingVel += torque * clampedDt;
    this.swingAngle += this.swingVel * clampedDt;
    this.swingAngle = Math.max(-0.32, Math.min(0.32, this.swingAngle));

    // Smooth vertical spring-cord interpolation
    const yLerp = 1 - Math.exp(-9.5 * clampedDt);
    this.clawY += (this.targetClawY - this.clawY) * yLerp;

    // Smooth prong aperture interpolation
    const pLerp = 1 - Math.exp(-12.0 * clampedDt);
    this.prongOpen += (this.targetProngOpen - this.prongOpen) * pLerp;

    // Subtle payload weight stretch
    const targetWeight = hasPayload ? 0.065 : 0.0;
    this.plushWeightOffset += (targetWeight - this.plushWeightOffset) * (1 - Math.exp(-8 * clampedDt));

    return {
      speedRatio: Math.min(1, Math.abs(this.vx) / maxSpeed)
    };
  }

  impulseSwing(amount) {
    this.swingVel += amount;
  }

  isOverPrizeChute() {
    return Math.abs(this.x - CABINET_BOUNDS.chuteX) <= CABINET_BOUNDS.chuteRadius;
  }
}
