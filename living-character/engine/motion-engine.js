import { Vector3 } from 'three';
import { createProceduralHuman } from '../vendor/procedural-locomotion-v0.11.0.min.js';
import { createCharacterInstance, loadMotionPack } from './character-factory.js';
import { FootTelemetryTracker, MultiSurfaceGroundDetector } from './foot-ik-terrain.js';
import { TurnCascadeController } from './turn-cascade.js';
import { MocapExpressionLayer } from './mocap-layer.js';
import { SecondaryMotionSystem } from './secondary-motion.js';
import { createCharacterShaderUniforms } from './painterly-shader.js';

export const HAIZ_HUMAN_CONFIG = {
  walkSpeed: 1.42,
  jogSpeed: 3.05,
  runSpeed: 4.85,
  runStartSpeed: 1.85,
  runTransition: 0.65,
  acceleration: 2.1,
  deceleration: 3.1,
  speedEasing: 0.30,
  stepFrequency: 1.88,
  minStepFrequency: 1.38,
  stepLength: 0.74,
  stepHeight: 0.052,
  dutyFactor: 0.61,
  heelLiftAngle: 52,
  heelStrikeAngle: 20,
  standKneeBend: 5.5,
  stanceKneeBend: 10.5,
  loadingKneeBend: 12.5,
  idleTurnThreshold: 32,
  turnSpeed: 145,
  turnAcceleration: 360,
  maxLateralAcceleration: 3.4,
  maxTurnPerStep: 68,
  turnSlowdown: 0.42,
  lateralShift: 0.30,
  lateralShiftResponse: 18,
  pelvisRotation: 5.5,
  pelvisObliquity: 4.2,
  pelvisTilt: 3.0,
  spineCounterRotation: 0.62,
  chestCounterRotation: 0.65,
  chestRollShare: 0.35,
  walkLean: 1.0,
  jogLean: 5.5,
  runLean: 9.0,
  leanPerAcceleration: 2.8,
  maxLean: 4.5,
  headStabilization: 0.88,
  headTurnLead: 0.68,
  maxHeadTurn: 50,
  chestTurnLead: 0.32,
  maxChestTurn: 24,
  armAbduction: 6.5,
  elbowBend: 20,
  armSwing: 17,
  armInertia: 2.0,
  shoulderSwing: 0.26,
  maxStepUp: 0.34,
  maxStepDown: 0.36,
  maxSlope: 38,
  groundProbeHeight: 1.4,
  groundProbeDepth: 2.5,
  footProbeHeight: 0.52,
  footProbeDepth: 0.62,
  variation: 0.85,
};

/**
 * LivingCharacterAgent — Complete Round 3 HAIZ character locomotion & life controller.
 * Combines:
 *  - Procedural Foot Placement & 2-Bone IK + Pelvic 6-DOF COM Shift + Twist Bones (TPL v0.11.0)
 *  - Multi-surface Terrain / Quantized Staircase Detector
 *  - 5-Stage Gaze->Head->Neck->Chest->Pelvis->Footsteps Turn Cascade
 *  - Phase-locked UAL1 + CMU Mocap Upper-Body Expression
 *  - Secondary Spring Physics (Backpack, Crossbody Satchel w/ thigh clearance, Hair, Shirt Hem)
 *  - Real-time Foot Contact Telemetry & Animation LOD (60 / 30 / 15 Hz)
 */
export class LivingCharacterAgent {
  constructor({
    model,
    bones,
    mapping,
    setAccessories,
    groundDetector,
    motionPack = null,
    config = {},
    shaderUniforms = null,
    lodMeshes = null,
  }) {
    this.model = model;
    this.bones = bones;
    this.mapping = mapping;
    this.setAccessories = setAccessories;
    this.groundDetector = groundDetector;
    this.shaderUniforms = shaderUniforms || createCharacterShaderUniforms();
    this.lodMeshes = lodMeshes; // optional { lod0, lod1, lod2 } or null
    this.activeLod = 'lod0';

    this.human = createProceduralHuman({
      model,
      mapping,
      ground: groundDetector,
      forward: new Vector3(0, 0, 1),
      config: { ...HAIZ_HUMAN_CONFIG, ...config },
      maxTimeStep: 1 / 60,
      maxFrameTime: 0.06,
    });
    this.rigWarnings = [...(this.human.warnings ?? [])];
    if (this.rigWarnings.length > 0) {
      console.warn('[LivingCharacterAgent] rig warnings:', this.rigWarnings);
    }

    this.turnCascade = new TurnCascadeController(bones);
    this.mocapLayer = new MocapExpressionLayer(bones, motionPack);
    this.secondary = new SecondaryMotionSystem(bones);
    this.telemetry = new FootTelemetryTracker({ soleOffset: 0.044 });

    this.desiredSpeed = 0;
    this.desiredHeading = 0;
    this.paused = false;
    this.strafeMode = false;
    this.aimHeading = 0;
    this.crouch = 0;
    this.slopePitch = 0;
    this.stairMode = 0;
    this.footstepCount = 0;
    this.animLodHz = 60;
    this.lodAccum = 0;
    this.tmpL = new Vector3();
    this.tmpTL = new Vector3();
    this.tmpR = new Vector3();
    this.tmpTR = new Vector3();
    this.tmpThigh = new Vector3();

    this.human.on('footstep', (ev) => {
      this.footstepCount += 1;
      this.mocapLayer.syncFootstep(ev?.side ?? 'left');
    });
  }

  static async create({
    archetype = 'student_hero',
    lod = 'lod0',
    baseDir = './living-character/assets/characters',
    motionPackUrl = './living-character/assets/motion/haiz-motion-pack.json',
    groundDetector = new MultiSurfaceGroundDetector(),
    shaderUniforms = null,
    showBackpack = true,
    showCrossbody = true,
    config = {},
  } = {}) {
    const [charInst, motionPack] = await Promise.all([
      createCharacterInstance({ archetype, lod, baseDir, shaderUniforms, showBackpack, showCrossbody }),
      loadMotionPack(motionPackUrl),
    ]);
    return new LivingCharacterAgent({
      ...charInst,
      groundDetector,
      motionPack,
      shaderUniforms,
      config,
    });
  }

  setMoveTarget(speed, heading) {
    this.desiredSpeed = speed;
    this.desiredHeading = heading;
  }

  setPosition(x, y, z, heading = this.desiredHeading) {
    this.model.position.set(x, y, z);
    this.model.updateWorldMatrix(true, true);
    this.desiredHeading = heading;
    this.desiredSpeed = 0;
    this.human.targetHeading = heading;
    this.human.targetSpeed = 0;
    this.human.reset();
    this.turnCascade.reset();
    this.secondary.reset();
    this.telemetry.reset();
  }

  jump() {
    this.human.jump();
  }

  setStrafe(enabled, aimHeading = this.aimHeading) {
    this.strafeMode = Boolean(enabled);
    this.aimHeading = aimHeading;
    this.turnCascade.strafeMode = this.strafeMode;
    this.turnCascade.aimHeading = aimHeading;
  }

  setWind(dirVec, strength) {
    this.secondary.windDir.copy(dirVec).normalize();
    this.secondary.windStrength = strength;
  }

  /**
   * Distance-driven Animation LOD (for background NPC efficiency at scale).
   */
  setCameraDistance(dist) {
    if (dist < 14) this.animLodHz = 60;
    else if (dist < 34) this.animLodHz = 30;
    else this.animLodHz = 15;
  }

  step(dt, { measureTelemetry = true } = {}) {
    if (this.paused || dt <= 0) return;

    this.lodAccum += dt;
    const minInterval = this.animLodHz >= 60 ? 0 : 1 / this.animLodHz;
    if (minInterval > 0 && this.lodAccum < minInterval) return;
    const stepDt = Math.min(this.lodAccum, 0.06);
    this.lodAccum = 0;

    // 1. Pre-update turn cascade shaping
    const shaped = this.turnCascade.preUpdate(this.human, this.desiredHeading, this.desiredSpeed, stepDt);
    this.human.targetHeading = shaped.targetHeading;
    this.human.targetSpeed = shaped.targetSpeed;
    this.human.targetCrouch = this.crouch;

    // 2. Procedural IK locomotion step
    this.human.update(stepDt);

    // 3. Detect stair/slope context from foot vertical separation for upper-body poise
    const feet = this.human.locomotion.feet;
    const dyFeet = feet.left.position.y - feet.right.position.y;
    const velY = this.human.velocity.y;
    this.stairMode = velY > 0.14 ? 0.65 : velY < -0.14 ? -0.65 : 0.0;

    // 4. Phase-locked Mocap expression layer on torso & arms
    this.mocapLayer.update(stepDt, {
      speed: this.human.speed,
      locomotion: this.human.locomotion,
      slopePitch: this.slopePitch,
      stairMode: this.stairMode,
    });

    // 5. Post-update 5-stage Turn Cascade (gaze -> head -> neck -> chest -> pelvis bank)
    this.turnCascade.postUpdate(this.human, stepDt);

    // 6. Compute approximate right thigh swing & stride amplitude for satchel clearance & hem flutter
    let rightThighFwd = 0;
    if (this.bones.thighR && this.bones.footR) {
      this.bones.thighR.getWorldPosition(this.tmpThigh);
      this.bones.footR.getWorldPosition(this.tmpR);
      const fwdX = Math.sin(this.human.heading);
      const fwdZ = Math.cos(this.human.heading);
      rightThighFwd = (this.tmpR.x - this.tmpThigh.x) * fwdX + (this.tmpR.z - this.tmpThigh.z) * fwdZ;
    }

    // 7. Secondary physics (bags, hair, shirt hem)
    this.secondary.update(stepDt, {
      velocity: this.human.velocity,
      heading: this.human.heading,
      speed: this.human.speed,
      rightThighForward: rightThighFwd,
      strideAmplitude: Math.min(1, this.human.speed / 2.2) * Math.abs(dyFeet) * 4.5,
    });

    this.model.updateWorldMatrix(true, true);

    // 8. Live Foot Contact & Penetration Telemetry
    if (measureTelemetry && this.bones.footL && this.bones.footR) {
      this.bones.footL.getWorldPosition(this.tmpL);
      this.bones.footR.getWorldPosition(this.tmpR);
      if (this.bones.toeL) this.bones.toeL.getWorldPosition(this.tmpTL);
      if (this.bones.toeR) this.bones.toeR.getWorldPosition(this.tmpTR);

      this.telemetry.sample(stepDt, {
        leftFootWorld: this.tmpL,
        leftToeWorld: this.bones.toeL ? this.tmpTL : null,
        rightFootWorld: this.tmpR,
        rightToeWorld: this.bones.toeR ? this.tmpTR : null,
        feetState: feet,
        detector: this.groundDetector,
      });
    }
  }

  getDiagnosticState() {
    const t = this.telemetry.lastMetrics;
    const sum = this.telemetry.summary();
    return {
      speed: this.human.speed,
      targetSpeed: this.desiredSpeed,
      headingDeg: this.human.heading * (180 / Math.PI),
      targetHeadingDeg: this.desiredHeading * (180 / Math.PI),
      footsteps: this.footstepCount,
      leftPhase: t.leftPhase,
      rightPhase: t.rightPhase,
      leftSlideMmS: t.leftSlideMmS,
      rightSlideMmS: t.rightSlideMmS,
      penetrationMaxMm: sum.penetrationMaxMm,
      slideMeanMmS: sum.slideMeanMmS,
      slideP95MmS: sum.slideP95MmS,
      turnCascade: { ...this.turnCascade.debug },
    };
  }
}
