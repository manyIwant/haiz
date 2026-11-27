import * as THREE from 'three';
import { createStudent } from '../../lanren/ruhua-stroll/student.js';
import { createWalker } from '../../lanren/ruhua/walker.js';

function wrapAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

function findFootBones(root) {
  let leftFoot = null;
  let rightFoot = null;
  root.traverse((o) => {
    if (!o.isBone) return;
    const nm = o.name.toLowerCase();
    if (!leftFoot && (nm === 'foot.l' || nm === 'footl' || nm === 'foot_l' || nm === 'mixamorigleftfoot')) leftFoot = o;
    if (!rightFoot && (nm === 'foot.r' || nm === 'footr' || nm === 'foot_r' || nm === 'mixamorigrightfoot')) rightFoot = o;
    if (!leftFoot && nm.includes('foot') && (nm.endsWith('l') || nm.includes('left'))) leftFoot = o;
    if (!rightFoot && nm.includes('foot') && (nm.endsWith('r') || nm.includes('right'))) rightFoot = o;
  });
  return { leftFoot, rightFoot };
}

class LegacyFootTracker {
  constructor(leftFoot, rightFoot, heightAt) {
    this.leftFoot = leftFoot;
    this.rightFoot = rightFoot;
    this.heightAt = heightAt;
    this.prevL = new THREE.Vector3();
    this.prevR = new THREE.Vector3();
    this.curL = new THREE.Vector3();
    this.curR = new THREE.Vector3();
    this.hasPrev = false;
    this.restClearanceL = null;
    this.restClearanceR = null;
    this.slideSamples = [];
    this.penetrationSamples = [];
    this.lastSlideL = 0;
    this.lastSlideR = 0;
    this.maxPenetrationMm = 0;
  }

  reset() {
    this.hasPrev = false;
    this.restClearanceL = null;
    this.restClearanceR = null;
    this.slideSamples.length = 0;
    this.penetrationSamples.length = 0;
    this.maxPenetrationMm = 0;
  }

  sample(dt, walkerState = null) {
    if (!this.leftFoot || !this.rightFoot || dt <= 1e-4) return;
    this.leftFoot.getWorldPosition(this.curL);
    this.rightFoot.getWorldPosition(this.curR);

    const gyL = this.heightAt(this.curL.x, this.curL.z);
    const gyR = this.heightAt(this.curR.x, this.curR.z);

    if (this.restClearanceL === null) {
      this.restClearanceL = Math.max(0.03, this.curL.y - gyL);
      this.restClearanceR = Math.max(0.03, this.curR.y - gyR);
    }

    // Stance vs swing detection (uses walker G.feet if present, otherwise calibrated ankle clearance)
    const lSwing = walkerState?.feet?.L ? walkerState.feet.L.swing : (this.curL.y - gyL > this.restClearanceL + 0.030);
    const rSwing = walkerState?.feet?.R ? walkerState.feet.R.swing : (this.curR.y - gyR > this.restClearanceR + 0.030);

    if (this.hasPrev) {
      if (!lSwing) {
        const sL = (Math.hypot(this.curL.x - this.prevL.x, this.curL.z - this.prevL.z) / dt) * 1000;
        this.lastSlideL = sL;
        this.slideSamples.push(sL);
      } else {
        this.lastSlideL = 0;
      }
      if (!rSwing) {
        const sR = (Math.hypot(this.curR.x - this.prevR.x, this.curR.z - this.prevR.z) / dt) * 1000;
        this.lastSlideR = sR;
        this.slideSamples.push(sR);
      } else {
        this.lastSlideR = 0;
      }
    }

    // Approximate sole bottom from ankle height ~ 0.046m
    for (const [p, gy, sw] of [[this.curL, gyL, lSwing], [this.curR, gyR, rSwing]]) {
      if (sw) continue;
      const pen = Math.max(0, (gy - (p.y - 0.046)) * 1000);
      this.penetrationSamples.push(pen);
      if (pen > this.maxPenetrationMm) this.maxPenetrationMm = pen;
    }

    this.prevL.copy(this.curL);
    this.prevR.copy(this.curR);
    this.hasPrev = true;
  }

  summary() {
    const p95 = (arr) => {
      if (!arr.length) return 0;
      const s = [...arr].sort((a, b) => a - b);
      return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))];
    };
    const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    return {
      samples: this.slideSamples.length,
      slideMeanMmS: mean(this.slideSamples),
      slideP95MmS: p95(this.slideSamples),
      penetrationMaxMm: this.maxPenetrationMm,
      penetrationP95Mm: p95(this.penetrationSamples),
    };
  }
}

/**
 * Create a synchronized comparator wrapper for Track A (Claude Original) or Track B (Round 2 Baseline).
 */
export async function createLegacyTrack(kind, { scene, heightAt, xOffset = -2.2 }) {
  const heightFn = (p) => heightAt(p.x ?? p, p.z ?? 0);
  let entity;
  let root;

  if (kind === 'claude') {
    entity = await createStudent('./lanren/assets/toon/student.glb');
    root = entity.root;
  } else {
    entity = await createWalker('./character-lab/hunyuan/models/student-mid.glb', {
      pbr: true,
      heightAt: heightFn,
    });
    root = entity.root;
  }

  root.visible = false;
  scene.add(root);

  const { leftFoot, rightFoot } = findFootBones(root);
  const tracker = new LegacyFootTracker(leftFoot, rightFoot, (x, z) => heightAt(x, z));

  const state = {
    x: xOffset,
    z: 0,
    heading: 0,
    speed: 0,
    xOffset,
  };

  return {
    kind,
    root,
    entity,
    reset(x = xOffset, z = 0, heading = 0) {
      state.x = x;
      state.z = z;
      state.heading = heading;
      state.speed = 0;
      root.position.set(x, heightAt(x, z), z);
      root.rotation.set(0, heading, 0);
      tracker.reset();
    },
    setVisible(v) {
      root.visible = Boolean(v);
      if (entity.setVisible) entity.setVisible(Boolean(v));
    },
    step(dt, desiredSpeed, desiredHeading) {
      if (!root.visible || dt <= 0) return;
      // Legacy locomotion physics: immediate velocity & turret rotation lerp
      const accelRate = desiredSpeed > state.speed ? 4.5 : 6.0;
      state.speed += (desiredSpeed - state.speed) * (1 - Math.exp(-accelRate * dt));
      const dH = wrapAngle(desiredHeading - state.heading);
      state.heading = wrapAngle(state.heading + dH * (1 - Math.exp(-8.5 * dt)));

      state.x += Math.sin(state.heading) * state.speed * dt;
      state.z += Math.cos(state.heading) * state.speed * dt;
      const y = heightAt(state.x, state.z);
      root.position.set(state.x, y, state.z);
      root.rotation.y = state.heading;

      entity.update(state.speed, false, dt);
      if (kind === 'claude' && entity.lookAt) {
        entity.lookAt(Math.max(-0.5, Math.min(0.5, dH)), 0, 0.7);
      }
      root.updateMatrixWorld(true);
      tracker.sample(dt, entity.G || null);
    },
    getSummary() {
      return {
        speed: state.speed,
        headingDeg: state.heading * (180 / Math.PI),
        ...tracker.summary(),
      };
    },
  };
}
