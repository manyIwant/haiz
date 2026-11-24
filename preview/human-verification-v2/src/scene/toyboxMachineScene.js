/**
 * HAIZ Toybox V2 — Redesigned Miniature Claw Machine 3D Stage (WebGL2 Velvet-PBR)
 */

import { ToyboxRenderer, Node3D, Mesh3D, FABRIC } from '../engine/toybox3d.js';
import {
  createBox,
  createCylinder,
  createSphere,
  createTorus,
  createHelixTube
} from '../engine/geometry.js';
import { m4TransformPoint } from '../engine/math3d.js';
import { TOYBOX_THEMES, SHOWCASE_BOUNDS, SHOWCASE_SLOTS } from '../verification/constants.js';
import { CHARACTER_REGISTRY } from '../toybox/characterRegistry.js';
import { createToyboxCharacter } from '../toybox/characters.js';
import { ClawKinematics } from '../animations/clawPhysics.js';

export class ToyboxMachineScene {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.themeId = options.theme || 'porcelain';
    this.reducedMotion = Boolean(options.reducedMotion);
    this.onFrame = options.onFrame || null;

    this.renderer = new ToyboxRenderer(canvas, { preserveDrawingBuffer: Boolean(options.preserveDrawingBuffer) });
    this.root = new Node3D('sceneRoot');
    this.kinematics = new ClawKinematics();

    this.entries = new Map();
    this.carriedEntry = null;
    this.droppingEntry = null;
    this.returningEntry = null;
    this.celebratingEntry = null;

    this._rafId = null;
    this._lastTime = 0;
    this._elapsed = 0;
    this._paused = false;
    this._destroyed = false;
    this._chuteHighlight = false;
    this._chuteGlow = 0;
    this._wakeActive = false;
    this._wakeT = 0;

    this.camera = {
      fov: 28,
      eye: [0.0, 0.22, 5.55],
      target: [0.0, -0.14, 0.0],
      shadowTarget: [0.0, -0.30, 0.0],
      shadowExtent: 3.1
    };
    this._cameraOverride = null;

    this._buildCabinet();
    this._buildChunkyGantryAndClaw();
    this._populateCharacters(CHARACTER_REGISTRY.map((c) => c.id));
    this.applyTheme(this.themeId);
    this.resize();
  }

  _buildCabinet() {
    this.cabinetGroup = new Node3D('cabinet');
    this.wallMeshes = [];
    this.floorMeshes = [];
    this.wallMat = { color: [0.89, 0.85, 0.78], roughness: 0.94, fuzz: 0.12, fabric: FABRIC.PLUSH, castShadow: false };
    this.floorMat = { color: [0.80, 0.74, 0.65], roughness: 0.96, fuzz: 0.35, fabric: FABRIC.PLUSH, castShadow: false };
    this.trimMat = { color: [0.76, 0.72, 0.65], roughness: 0.38, metalness: 0.55, fuzz: 0.0, fabric: FABRIC.METAL, castShadow: false };

    const backWall = new Mesh3D(createBox(6.4, 3.6, 0.16), this.wallMat, 'backWall');
    backWall.position = [0, 0.18, -1.05];
    this.wallMeshes.push(backWall);
    this.cabinetGroup.add(backWall);

    const molding = new Mesh3D(createBox(6.2, 0.07, 0.08), this.trimMat, 'molding');
    molding.position = [0, 0.58, -0.94];
    this.cabinetGroup.add(molding);

    [-2.58, 2.58].forEach((x) => {
      const side = new Mesh3D(createBox(0.16, 3.6, 2.8), this.wallMat);
      side.position = [x, 0.18, 0.15];
      this.wallMeshes.push(side);
      this.cabinetGroup.add(side);
    });

    const floor = new Mesh3D(createBox(5.4, 0.24, 2.6), this.floorMat, 'floor');
    floor.position = [0, SHOWCASE_BOUNDS.floorY - 0.12, 0.1];
    this.floorMeshes.push(floor);
    this.cabinetGroup.add(floor);

    const backStep = new Mesh3D(createBox(3.85, 0.50, 0.94), this.floorMat, 'backStep');
    backStep.position = [0.35, SHOWCASE_BOUNDS.floorY + 0.25, -0.32];
    this.floorMeshes.push(backStep);
    this.cabinetGroup.add(backStep);

    const chuteGroup = new Node3D('prizeChute');
    chuteGroup.position = [SHOWCASE_BOUNDS.chuteX, SHOWCASE_BOUNDS.floorY, 0.20];

    const well = new Mesh3D(createBox(0.96, 0.05, 0.96), {
      color: [0.14, 0.15, 0.18],
      roughness: 0.85,
      fuzz: 0.0,
      fabric: FABRIC.SATIN,
      castShadow: false
    });
    well.position = [0, 0.015, 0];
    chuteGroup.add(well);

    const acrylicMat = {
      color: [0.95, 0.97, 0.99],
      roughness: 0.08,
      metalness: 0.05,
      fuzz: 0.0,
      fabric: FABRIC.ACRYLIC,
      opacity: 0.24,
      castShadow: false,
      receiveShadow: false
    };

    const divider = new Mesh3D(createBox(0.055, 0.68, 1.08), acrylicMat, 'chuteDivider');
    divider.position = [0.51, 0.34, 0];
    chuteGroup.add(divider);

    const frontGlass = new Mesh3D(createBox(1.02, 0.42, 0.055), acrylicMat, 'chuteFront');
    frontGlass.position = [0, 0.21, 0.52];
    chuteGroup.add(frontGlass);

    this.chuteRimMat = {
      color: [0.78, 0.74, 0.65],
      roughness: 0.28,
      metalness: 0.45,
      fuzz: 0.0,
      fabric: FABRIC.METAL,
      emissive: [0.18, 0.62, 0.44],
      emissiveIntensity: 0.08,
      castShadow: false
    };
    const rimRight = new Mesh3D(createBox(0.068, 0.045, 1.12), this.chuteRimMat);
    rimRight.position = [0.51, 0.69, 0];
    const rimFront = new Mesh3D(createBox(1.06, 0.045, 0.068), this.chuteRimMat);
    rimFront.position = [0, 0.43, 0.52];
    chuteGroup.add(rimRight, rimFront);

    this.cabinetGroup.add(chuteGroup);
    this.root.add(this.cabinetGroup);
  }

  _buildChunkyGantryAndClaw() {
    const steel = { color: [0.82, 0.84, 0.87], roughness: 0.24, metalness: 0.86, fuzz: 0.0, fabric: FABRIC.METAL };
    const darkAnodized = { color: [0.24, 0.26, 0.30], roughness: 0.36, metalness: 0.72, fuzz: 0.0, fabric: FABRIC.METAL };
    const brass = { color: [0.85, 0.71, 0.42], roughness: 0.24, metalness: 0.84, fuzz: 0.0, fabric: FABRIC.METAL };
    const rubber = { color: [0.18, 0.19, 0.22], roughness: 0.72, metalness: 0.04, fuzz: 0.15, fabric: FABRIC.SATIN };

    [-0.17, 0.17].forEach((zOff) => {
      const rail = new Mesh3D(createCylinder(0.052, 0.052, 5.2, 22), steel, 'rail');
      rail.rotation = [0, 0, Math.PI / 2];
      rail.position = [0, SHOWCASE_BOUNDS.railY, zOff];
      this.root.add(rail);
    });

    this.carriageGroup = new Node3D('carriage');
    this.carriageGroup.position = [0, SHOWCASE_BOUNDS.railY, 0];

    const trolley = new Mesh3D(createBox(0.56, 0.21, 0.48), darkAnodized, 'trolleyBody');
    const brassCollar = new Mesh3D(createCylinder(0.14, 0.16, 0.11, 24), brass, 'trolleyCollar');
    brassCollar.position = [0, -0.14, 0];
    this.carriageLedMat = {
      color: [0.95, 0.55, 0.35],
      emissive: [0.95, 0.45, 0.25],
      emissiveIntensity: 0.85,
      roughness: 0.2,
      fuzz: 0.0,
      fabric: FABRIC.SATIN,
      castShadow: false
    };
    const led = new Mesh3D(createSphere(0.036, 12, 10), this.carriageLedMat, 'trolleyLed');
    led.position = [0, 0.0, 0.25];
    this.carriageGroup.add(trolley, brassCollar, led);

    this.springMesh = new Mesh3D(createHelixTube(0.082, 0.022, 7.5, 110, 10), darkAnodized, 'spring');
    this.springMesh.position = [0, -0.19, 0];
    this.carriageGroup.add(this.springMesh);

    const rodGeo = createCylinder(0.016, 0.016, 1.0, 12);
    for (let i = 1; i < rodGeo.positions.length; i += 3) rodGeo.positions[i] -= 0.5;
    this.rodMesh = new Mesh3D(rodGeo, steel, 'tensionRod');
    this.rodMesh.position = [0, -0.19, 0];
    this.carriageGroup.add(this.rodMesh);

    this.clawPivot = new Node3D('clawPivot');
    this.clawPivot.position = [0, -0.50, 0];

    const hub = new Mesh3D(createCylinder(0.10, 0.145, 0.20, 24), steel, 'clawHub');
    hub.position = [0, -0.06, 0];
    const hubRing = new Mesh3D(createTorus(0.145, 0.028, 12, 26), brass, 'clawBrassRing');
    hubRing.rotation = [Math.PI / 2, 0, 0];
    hubRing.position = [0, -0.14, 0];
    const hubCap = new Mesh3D(createSphere(0.088, 16, 12), darkAnodized, 'clawCap');
    hubCap.position = [0, -0.16, 0];
    this.clawPivot.add(hub, hubRing, hubCap);

    this.prongs = [];
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3 + Math.PI / 6;
      const mount = new Node3D(`prongMount_${i}`);
      mount.rotation = [0, angle, 0];
      mount.position = [0, -0.15, 0];

      const hinge = new Node3D(`prongHinge_${i}`);
      hinge.position = [0.115, 0, 0];

      const upper = new Mesh3D(createCylinder(0.028, 0.032, 0.30, 14), steel);
      upper.position = [0.095, -0.12, 0];
      upper.rotation = [0, 0, 0.62];
      hinge.add(upper);

      const knuckle = new Mesh3D(createSphere(0.040, 14, 12), brass);
      knuckle.position = [0.19, -0.24, 0];
      hinge.add(knuckle);

      const lower = new Mesh3D(createCylinder(0.027, 0.022, 0.31, 14), steel);
      lower.position = [0.13, -0.37, 0];
      lower.rotation = [0, 0, -0.38];
      hinge.add(lower);

      const pad = new Mesh3D(createSphere(0.036, 14, 12), rubber);
      pad.scale = [1.15, 0.88, 1.0];
      pad.position = [0.072, -0.51, 0];
      hinge.add(pad);

      mount.add(hinge);
      this.clawPivot.add(mount);
      this.prongs.push(hinge);
    }

    this.grabAnchor = new Node3D('grabAnchor');
    this.grabAnchor.position = [0, -0.50, 0];
    this.clawPivot.add(this.grabAnchor);

    this.carriageGroup.add(this.clawPivot);
    this.root.add(this.carriageGroup);
  }

  _populateCharacters(layoutOrder) {
    if (this.plushGroup) {
      this.root.remove(this.plushGroup);
    }
    this.plushGroup = new Node3D('plushGroup');
    this.entries.clear();

    const ids = Array.isArray(layoutOrder) && layoutOrder.length === 6
      ? layoutOrder
      : CHARACTER_REGISTRY.map((c) => c.id);

    ids.forEach((id, idx) => {
      const slot = SHOWCASE_SLOTS[idx % SHOWCASE_SLOTS.length];
      const char = createToyboxCharacter(id, { phaseOffset: idx * 1.15 });
      char.root.position = [slot.x, slot.y, slot.z];
      char.root.rotation = [0, slot.rotY, slot.tiltZ];
      char.root.scale = [slot.scale, slot.scale, slot.scale];
      this.plushGroup.add(char.root);

      this.entries.set(id, {
        id,
        char,
        meta: char.meta,
        homePos: [slot.x, slot.y, slot.z],
        homeRot: [0, slot.rotY, slot.tiltZ],
        baseScale: slot.scale,
        collected: false,
        settleAmp: 0,
        settlePhase: 0
      });
    });

    this.root.add(this.plushGroup);
  }

  applyLayout(layoutOrder) {
    this.carriedEntry = null;
    this.droppingEntry = null;
    this.returningEntry = null;
    this.celebratingEntry = null;
    this._populateCharacters(layoutOrder);
  }

  applyTheme(themeId) {
    const t = TOYBOX_THEMES[themeId] || TOYBOX_THEMES.porcelain;
    this.themeId = t.id;
    this.renderer.clearColor = [...t.stageClear];
    this.wallMat.color = [...t.wallColor];
    this.floorMat.color = [...t.floorColor];
    this.wallMeshes.forEach((m) => { m.material.color = [...t.wallColor]; });
    this.floorMeshes.forEach((m) => { m.material.color = [...t.floorColor]; });
    this.renderer.lights.keyColor = [...t.keyColor];
    this.renderer.lights.fillColor = [...t.fillColor];
    this.renderer.lights.rimColor = [...t.rimColor];
    this.renderer.lights.skyColor = [...t.skyColor];
    this.renderer.lights.groundColor = [...t.groundColor];
    this.renderer.lights.exposure = t.exposure;
  }

  setReducedMotion(flag) { this.reducedMotion = Boolean(flag); }
  setCameraOverride(cam) { this._cameraOverride = cam; }

  triggerWakeAnimation() {
    this.kinematics.reset();
    this.carriedEntry = null;
    this.droppingEntry = null;
    this.returningEntry = null;
    this.celebratingEntry = null;
    this._wakeActive = !this.reducedMotion;
    this._wakeT = 0;
  }

  findCatchableCharacter() {
    const cx = this.kinematics.x;
    let best = null;
    let bestDist = 0.56;
    this.entries.forEach((e) => {
      if (e.collected) return;
      const d = Math.abs(e.char.root.position[0] - cx);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    });
    return best;
  }

  attachToClaw(entry) {
    if (!entry) return;
    this.carriedEntry = entry;
    this.grabAnchor.add(entry.char.root);
    const gh = entry.char.root.userData.grabHeight || 0.76;
    entry.char.root.position = [0, -gh * 0.92, 0];
    entry.char.root.rotation = [0, entry.homeRot[1] * 0.35, 0];
    this.kinematics.impulseSwing((Math.random() - 0.5) * 0.55);

    this.entries.forEach((other) => {
      if (other === entry || other.collected) return;
      const dist = Math.abs(other.homePos[0] - entry.homePos[0]);
      if (dist < 1.1) {
        other.settleAmp = (1.1 - dist) * 0.08;
        other.settlePhase = 0;
      }
    });
  }

  releaseCarried(intoChute) {
    const entry = this.carriedEntry;
    if (!entry) return null;
    this.carriedEntry = null;

    this.root.updateWorldMatrix(null);
    const wp = m4TransformPoint(entry.char.root.worldMatrix, [0, 0, 0]);
    this.plushGroup.add(entry.char.root);
    entry.char.root.position = wp;
    entry.char.root.scale = [entry.baseScale, entry.baseScale, entry.baseScale];

    if (intoChute) {
      this.droppingEntry = { entry, vy: -0.7, targetX: SHOWCASE_BOUNDS.chuteX, done: false };
    } else {
      this.returningEntry = { entry, progress: 0, startPos: [...wp] };
    }
    return entry;
  }

  returnToPile(entry) {
    if (!entry) return;
    if (this.carriedEntry === entry) this.carriedEntry = null;
    if (this.droppingEntry && this.droppingEntry.entry === entry) this.droppingEntry = null;
    this.root.updateWorldMatrix(null);
    const wp = m4TransformPoint(entry.char.root.worldMatrix, [0, 0, 0]);
    this.plushGroup.add(entry.char.root);
    entry.char.root.position = wp;
    entry.char.root.visible = true;
    entry.collected = false;
    this.returningEntry = { entry, progress: 0, startPos: [...wp] };
  }

  startPopUpCelebration(characterId) {
    const entry = this.entries.get(characterId);
    if (!entry) return;
    this.droppingEntry = null;
    this.carriedEntry = null;
    this.plushGroup.add(entry.char.root);
    entry.char.root.visible = true;
    entry.collected = true;
    entry.char.root.position = [SHOWCASE_BOUNDS.chuteX + 0.06, SHOWCASE_BOUNDS.floorY - 0.65, 0.56];
    entry.char.root.rotation = [0, 0.22, 0];
    const s = entry.baseScale * 1.12;
    entry.char.root.scale = [s, s, s];
    this.celebratingEntry = { entry, progress: 0 };
  }

  setChuteHighlighted(active) { this._chuteHighlight = Boolean(active); }

  resize() {
    if (this._destroyed || !this.canvas) return;
    const parent = this.canvas.parentElement;
    const w = Math.max(240, parent ? parent.clientWidth : this.canvas.clientWidth || 440);
    const h = Math.max(200, parent ? parent.clientHeight : this.canvas.clientHeight || 310);
    const isLowPower = typeof navigator !== 'undefined' && navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
    this.renderer.setSize(w, h, isLowPower ? 1.5 : 2.0);
    const aspect = w / h;
    this.camera.eye[2] = aspect < 1.25 ? 6.25 : 5.55;
  }

  start() {
    if (this._destroyed || this._rafId !== null) return;
    this._paused = false;
    this._lastTime = performance.now();
    const tick = (now) => {
      if (this._destroyed || this._paused) {
        this._rafId = null;
        return;
      }
      const dt = Math.min(0.05, Math.max(0.001, (now - this._lastTime) / 1000));
      this._lastTime = now;
      this.stepAndRender(dt);
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  stepAndRender(dt = 0.016) {
    this._elapsed += dt;
    if (this.onFrame) this.onFrame(dt);

    if (this._wakeActive) {
      this._wakeT += dt * 1.6;
      if (this._wakeT >= 1) {
        this._wakeActive = false;
        this.kinematics.targetProngOpen = 0.30;
      } else {
        this.kinematics.targetProngOpen = 0.30 + Math.sin(this._wakeT * Math.PI) * 0.55;
      }
    }

    this.carriageGroup.position[0] = this.kinematics.x;
    const clawRelY = this.kinematics.clawY - SHOWCASE_BOUNDS.railY - this.kinematics.weightStretch;
    const springLen = Math.max(0.24, -clawRelY - 0.19);
    this.springMesh.scale = [1, springLen, 1];
    this.rodMesh.scale = [1, springLen, 1];
    this.clawPivot.position[1] = clawRelY;
    this.clawPivot.rotation[2] = this.reducedMotion ? 0 : this.kinematics.swingAngle;

    const openRad = 0.06 + this.kinematics.prongOpen * 0.58;
    for (let i = 0; i < this.prongs.length; i++) {
      this.prongs[i].rotation[2] = openRad;
    }

    if (this.droppingEntry && !this.droppingEntry.done) {
      const d = this.droppingEntry;
      d.vy -= 11.8 * dt;
      d.entry.char.root.position[1] += d.vy * dt;
      d.entry.char.root.position[0] += (d.targetX - d.entry.char.root.position[0]) * Math.min(1, dt * 8);
      d.entry.char.root.rotation[2] += dt * 1.3;
      if (d.entry.char.root.position[1] <= SHOWCASE_BOUNDS.floorY - 0.58) {
        d.entry.collected = true;
        d.entry.char.root.visible = false;
        d.done = true;
      }
    }

    if (this.returningEntry) {
      const r = this.returningEntry;
      r.progress = Math.min(1, r.progress + dt * 2.5);
      const ease = 1 - Math.pow(1 - r.progress, 3);
      for (let k = 0; k < 3; k++) {
        r.entry.char.root.position[k] = r.startPos[k] + (r.entry.homePos[k] - r.startPos[k]) * ease;
      }
      r.entry.char.root.position[1] += Math.sin(r.progress * Math.PI) * 0.24;
      r.entry.char.root.rotation[2] = r.entry.homeRot[2] * ease;
      if (r.progress >= 1) {
        r.entry.char.root.position = [...r.entry.homePos];
        r.entry.char.root.rotation = [...r.entry.homeRot];
        r.entry.char.triggerBounce();
        this.returningEntry = null;
      }
    }

    if (this.celebratingEntry) {
      const c = this.celebratingEntry;
      c.progress = Math.min(1, c.progress + dt * 2.6);
      const t = c.progress;
      const overshoot = t < 1 ? 1 - Math.pow(1 - t, 3) + Math.sin(t * Math.PI) * 0.12 : 1;
      const startY = SHOWCASE_BOUNDS.floorY - 0.52;
      const endY = SHOWCASE_BOUNDS.floorY + 0.16;
      c.entry.char.root.position[1] = startY + (endY - startY) * overshoot;
    }

    this.entries.forEach((entry) => {
      if (entry === this.carriedEntry) {
        entry.char.animate(this._elapsed, dt, 'grabbed', this.reducedMotion);
      } else if (this.celebratingEntry && this.celebratingEntry.entry === entry) {
        entry.char.animate(this._elapsed, dt, 'celebrate', this.reducedMotion);
      } else if (!entry.collected) {
        entry.char.animate(this._elapsed, dt, 'idle', this.reducedMotion);
        if (entry.settleAmp > 0.001) {
          entry.settlePhase += dt * 12.5;
          entry.settleAmp *= Math.exp(-4.5 * dt);
          entry.char.root.rotation[2] = entry.homeRot[2] + Math.sin(entry.settlePhase) * entry.settleAmp;
        }
      }
    });

    const targetGlow = this._chuteHighlight ? 1.0 : 0.0;
    this._chuteGlow += (targetGlow - this._chuteGlow) * Math.min(1, dt * 8);
    this.chuteRimMat.emissiveIntensity = 0.08 + this._chuteGlow * 1.15;

    this.renderer.render(this.root, this._cameraOverride || this.camera);
  }

  pause() {
    this._paused = true;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  resume() {
    if (this._destroyed) return;
    this._paused = false;
    this.start();
  }

  destroy() {
    this._destroyed = true;
    this.pause();
    this.renderer.destroy();
  }
}
