/**
 * HAIZ Human Verification — Miniature 3D Claw Machine Stage (Three.js)
 * Works seamlessly with Three.js r128 (UMD/CDN) and modern ES Module builds.
 */

import { CABINET_BOUNDS, THEMES } from '../verification/constants.js';
import { createMaterialLibrary } from '../models/materials.js';
import { PLUSH_CATALOG } from '../models/plushCatalog.js';
import { buildPlushMesh } from '../models/plushBuilders.js';
import { ClawKinematics } from '../animations/clawPhysics.js';

export class ClawMachineScene {
  constructor(THREE, canvas, options = {}) {
    this.THREE = THREE;
    this.canvas = canvas;
    this.themeId = options.theme || 'porcelain';
    this.reducedMotion = Boolean(options.reducedMotion);
    this.onFrameCallback = options.onFrame || null;

    this.kinematics = new ClawKinematics();
    this.plushEntries = new Map();
    this.carriedEntry = null;
    this.droppingEntry = null;
    this.returningEntry = null;

    this._rafId = null;
    this._lastTime = 0;
    this._paused = false;
    this._destroyed = false;
    this._wakeProgress = 0;
    this._wakeActive = false;
    this._chuteActive = false;
    this._chuteGlowStrength = 0;

    this._initRenderer();
    this._initScene();
    this._buildCabinet();
    this._buildGantryAndClaw();
    this._populatePlushies();
    this.applyTheme(this.themeId);
    this.resize();
  }

  _initRenderer() {
    const THREE = this.THREE;
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    const isLowPower = typeof navigator !== 'undefined' && navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
    const maxDpr = isLowPower ? 1.5 : 2.0;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    if ('outputColorSpace' in this.renderer && THREE.SRGBColorSpace) {
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if (THREE.sRGBEncoding) {
      this.renderer.outputEncoding = THREE.sRGBEncoding;
    }
    this.matLib = createMaterialLibrary(THREE, this.renderer);
  }

  _initScene() {
    const THREE = this.THREE;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 16 / 10, 0.1, 30);
    this.camera.position.set(0, 0.42, 7.6);
    this.camera.lookAt(0, -0.05, 0);

    // Studio softbox lighting rig
    this.hemiLight = new THREE.HemisphereLight(0xfffcf8, 0xd8dce4, 0.92);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff7ec, 1.08);
    this.keyLight.position.set(2.4, 5.2, 4.6);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 1024;
    this.keyLight.shadow.mapSize.height = 1024;
    this.keyLight.shadow.camera.near = 1.0;
    this.keyLight.shadow.camera.far = 14.0;
    this.keyLight.shadow.camera.left = -3.8;
    this.keyLight.shadow.camera.right = 3.8;
    this.keyLight.shadow.camera.top = 3.2;
    this.keyLight.shadow.camera.bottom = -2.4;
    this.keyLight.shadow.bias = -0.0008;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0xdceeff, 0.56);
    this.rimLight.position.set(-3.4, 2.8, -2.2);
    this.scene.add(this.rimLight);

    this.fillLight = new THREE.PointLight(0xffffff, 0.25, 10);
    this.fillLight.position.set(0, 1.4, 3.2);
    this.scene.add(this.fillLight);

    // Prize chute accent light
    this.chuteLight = new THREE.PointLight(0x1f9d68, 0.0, 2.6);
    this.chuteLight.position.set(CABINET_BOUNDS.chuteX, -0.65, 0.35);
    this.scene.add(this.chuteLight);
  }

  _buildCabinet() {
    const THREE = this.THREE;
    this.cabinetGroup = new THREE.Group();

    this.wallMat = this.matLib.track(
      new THREE.MeshStandardMaterial({
        color: 0xf3f2ee,
        roughness: 0.92,
        metalness: 0.02
      })
    );
    this.floorMat = this.matLib.track(
      new THREE.MeshStandardMaterial({
        color: 0xeae8e2,
        roughness: 0.95,
        metalness: 0.01,
        bumpMap: this.matLib.plushBump,
        bumpScale: 0.008
      })
    );
    this.frameMat = this.matLib.makeBrushedMetal(0xd8dde3, 0.32, 0.65);

    // Back wall
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 4.4), this.wallMat);
    backWall.position.set(0, 0.4, -1.25);
    backWall.receiveShadow = true;
    this.cabinetGroup.add(backWall);

    // Left & right interior side walls
    [-3.15, 3.15].forEach((x) => {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.4), this.wallMat);
      side.position.set(x, 0.4, 0.1);
      side.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      side.receiveShadow = true;
      this.cabinetGroup.add(side);
    });

    // Soft toy bed floor
    const floor = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.24, 2.9), this.floorMat);
    floor.position.set(0, CABINET_BOUNDS.floorY - 0.12, 0.05);
    floor.receiveShadow = true;
    this.cabinetGroup.add(floor);

    // Subtle ceiling panel
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.16, 2.9), this.wallMat);
    ceiling.position.set(0, 1.98, 0.05);
    this.cabinetGroup.add(ceiling);

    // Acrylic Prize Chute partition on the left side (x = -1.88)
    const chuteGroup = new THREE.Group();
    chuteGroup.position.set(CABINET_BOUNDS.chuteX, CABINET_BOUNDS.floorY + 0.01, 0.18);

    const acrylicMat = this.matLib.track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.12,
        metalness: 0.08,
        transparent: true,
        opacity: 0.26,
        envMap: this.matLib.envMap,
        envMapIntensity: 1.2
      })
    );

    // Right divider glass wall of the chute
    const divider = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.72, 1.15), acrylicMat);
    divider.position.set(0.56, 0.36, 0);
    chuteGroup.add(divider);

    // Front lip of the chute
    const frontLip = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.42, 0.04), acrylicMat);
    frontLip.position.set(0.0, 0.21, 0.56);
    chuteGroup.add(frontLip);

    // Recessed chute well
    const wellMat = this.matLib.track(
      new THREE.MeshStandardMaterial({
        color: 0x222730,
        roughness: 0.85,
        metalness: 0.1
      })
    );
    const well = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.03, 0.98), wellMat);
    well.position.set(0, 0.01, 0);
    chuteGroup.add(well);

    // Illuminated chute status ring
    this.chuteRimMat = this.matLib.track(
      new THREE.MeshStandardMaterial({
        color: 0xbac4cf,
        emissive: 0x1f9d68,
        emissiveIntensity: 0.05,
        roughness: 0.3,
        metalness: 0.2
      })
    );
    const rimFront = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.035, 0.04), this.chuteRimMat);
    rimFront.position.set(0, 0.43, 0.56);
    chuteGroup.add(rimFront);

    const rimRight = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.035, 1.15), this.chuteRimMat);
    rimRight.position.set(0.56, 0.73, 0);
    chuteGroup.add(rimRight);

    this.cabinetGroup.add(chuteGroup);

    // Subtle front glass sheen reflection plane
    const glassCanvas = document.createElement('canvas');
    glassCanvas.width = 512;
    glassCanvas.height = 256;
    const gctx = glassCanvas.getContext('2d');
    const ggrad = gctx.createLinearGradient(0, 0, 512, 256);
    ggrad.addColorStop(0.0, 'rgba(255,255,255,0.0)');
    ggrad.addColorStop(0.18, 'rgba(255,255,255,0.14)');
    ggrad.addColorStop(0.24, 'rgba(255,255,255,0.03)');
    ggrad.addColorStop(0.68, 'rgba(255,255,255,0.0)');
    ggrad.addColorStop(0.74, 'rgba(255,255,255,0.08)');
    ggrad.addColorStop(0.80, 'rgba(255,255,255,0.0)');
    gctx.fillStyle = ggrad;
    gctx.fillRect(0, 0, 512, 256);
    const glassTex = this.matLib.track(new THREE.CanvasTexture(glassCanvas));
    const glassMat = this.matLib.track(
      new THREE.MeshBasicMaterial({
        map: glassTex,
        transparent: true,
        opacity: 0.55,
        depthWrite: false
      })
    );
    const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 3.6), glassMat);
    glassPane.position.set(0, 0.25, 2.35);
    this.cabinetGroup.add(glassPane);

    this.scene.add(this.cabinetGroup);
  }

  _buildGantryAndClaw() {
    const THREE = this.THREE;
    const chromeMat = this.matLib.makeBrushedMetal(0xdde2e8, 0.20, 0.90);
    const darkMetalMat = this.matLib.makeBrushedMetal(0x4a525e, 0.34, 0.80);
    const tipMat = this.matLib.makeSatinPlastic(0x2d323b, 0.62);

    // Overhead twin brushed-aluminum horizontal guide rails
    [-0.14, 0.14].forEach((zOff) => {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 6.2, 18), chromeMat);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, CABINET_BOUNDS.railY, zOff);
      this.scene.add(rail);
    });

    // Sliding gantry trolley carriage
    this.carriageGroup = new THREE.Group();
    this.carriageGroup.position.set(0, CABINET_BOUNDS.railY, 0);

    const trolleyBody = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.15, 0.42), darkMetalMat);
    trolleyBody.castShadow = true;
    this.carriageGroup.add(trolleyBody);

    const trolleyCap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.09, 20), chromeMat);
    trolleyCap.position.y = -0.10;
    this.carriageGroup.add(trolleyCap);

    // Helical coiled metal spring (TubeGeometry along a 9-turn helix)
    const helixPts = [];
    const turns = 8.5;
    const steps = 96;
    const radius = 0.056;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * turns * Math.PI * 2;
      helixPts.push(new THREE.Vector3(Math.cos(angle) * radius, -t, Math.sin(angle) * radius));
    }
    const helixCurve = new THREE.CatmullRomCurve3(helixPts);
    const springGeo = new THREE.TubeGeometry(helixCurve, 96, 0.011, 8, false);
    this.springMesh = new THREE.Mesh(springGeo, darkMetalMat);
    this.springMesh.position.y = -0.14;
    this.carriageGroup.add(this.springMesh);

    // Central braided tension cable inside the spring
    const cordGeo = new THREE.CylinderGeometry(0.008, 0.008, 1.0, 8);
    cordGeo.translate(0, -0.5, 0);
    this.cordMesh = new THREE.Mesh(cordGeo, chromeMat);
    this.cordMesh.position.y = -0.14;
    this.carriageGroup.add(this.cordMesh);

    // Pendulum pivot for the claw head
    this.clawPivot = new THREE.Group();
    this.clawPivot.position.set(0, -0.56, 0);

    // Cylindrical brushed-steel claw housing
    const hubTop = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.115, 0.16, 22), chromeMat);
    hubTop.position.y = -0.04;
    hubTop.castShadow = true;
    this.clawPivot.add(hubTop);

    const hubRing = new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.018, 10, 24), darkMetalMat);
    hubRing.rotation.x = Math.PI / 2;
    hubRing.position.y = -0.11;
    this.clawPivot.add(hubRing);

    // 3 articulated curved prongs spaced 120° apart
    this.prongs = [];
    for (let i = 0; i < 3; i++) {
      const radialAngle = (i * Math.PI * 2) / 3 + Math.PI / 6;
      const mount = new THREE.Group();
      mount.rotation.y = radialAngle;
      mount.position.y = -0.12;

      const hinge = new THREE.Group();
      hinge.position.set(0.09, 0, 0);

      // Upper arm segment angling outward
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.27, 12), chromeMat);
      upper.position.set(0.085, -0.11, 0);
      upper.rotation.z = 0.62;
      upper.castShadow = true;
      hinge.add(upper);

      // Knuckle pin
      const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 10), darkMetalMat);
      knuckle.position.set(0.165, -0.22, 0);
      hinge.add(knuckle);

      // Lower curved finger angling back inward
      const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.012, 0.27, 12), chromeMat);
      lower.position.set(0.115, -0.34, 0);
      lower.rotation.z = -0.36;
      lower.castShadow = true;
      hinge.add(lower);

      // Soft dark rubber grip tip
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), tipMat);
      tip.position.set(0.068, -0.46, 0);
      hinge.add(tip);

      mount.add(hinge);
      this.clawPivot.add(mount);
      this.prongs.push(hinge);
    }

    // Anchor node where grabbed plushie attaches
    this.grabAnchor = new THREE.Group();
    this.grabAnchor.position.set(0, -0.48, 0);
    this.clawPivot.add(this.grabAnchor);

    this.carriageGroup.add(this.clawPivot);
    this.scene.add(this.carriageGroup);
  }

  _populatePlushies() {
    this.plushGroup = new THREE.Group();
    PLUSH_CATALOG.forEach((meta) => {
      const mesh = buildPlushMesh(this.THREE, this.matLib, meta.id);
      const slot = meta.defaultSlot;
      mesh.position.set(slot.x, CABINET_BOUNDS.floorY + 0.02, slot.z);
      mesh.rotation.set(0, slot.rotY, slot.tiltZ);
      mesh.scale.setScalar(slot.scale);
      this.plushGroup.add(mesh);

      this.plushEntries.set(meta.id, {
        id: meta.id,
        meta,
        mesh,
        homePos: mesh.position.clone(),
        homeRot: mesh.rotation.clone(),
        baseScale: slot.scale,
        collected: false,
        settlePhase: 0,
        settleAmp: 0
      });
    });
    this.scene.add(this.plushGroup);
  }

  applyTheme(themeId) {
    const theme = THEMES[themeId] || THEMES.porcelain;
    this.themeId = theme.id;
    this.scene.background = new this.THREE.Color(theme.stageBg);
    this.wallMat.color.setHex(theme.stageBg);
    this.floorMat.color.setHex(theme.stageFloor);
    this.hemiLight.color.setHex(theme.ambientHex);
    this.keyLight.color.setHex(theme.keyLightHex);
    this.rimLight.color.setHex(theme.rimLightHex);
    this.chuteLight.color.setHex(theme.chuteGlow);
    this.chuteRimMat.emissive.setHex(theme.chuteGlow);
  }

  setReducedMotion(flag) {
    this.reducedMotion = Boolean(flag);
  }

  triggerWakeAnimation() {
    this.resetAllPlushies();
    this.kinematics.reset();
    if (this.reducedMotion) {
      this._wakeActive = false;
      return;
    }
    this._wakeActive = true;
    this._wakeProgress = 0;
  }

  resetAllPlushies() {
    this.carriedEntry = null;
    this.droppingEntry = null;
    this.returningEntry = null;
    this.plushEntries.forEach((entry) => {
      entry.collected = false;
      if (entry.mesh.parent !== this.plushGroup) {
        this.plushGroup.add(entry.mesh);
      }
      entry.mesh.visible = true;
      entry.mesh.position.copy(entry.homePos);
      entry.mesh.rotation.copy(entry.homeRot);
      entry.mesh.scale.setScalar(entry.baseScale);
      entry.settleAmp = 0;
    });
  }

  /**
   * Find closest uncollected plushie under current claw X position.
   */
  findCatchablePlush() {
    const clawX = this.kinematics.x;
    let best = null;
    let bestDist = 0.54; // generous but fair horizontal grab window
    this.plushEntries.forEach((entry) => {
      if (entry.collected) return;
      const dist = Math.abs(entry.mesh.position.x - clawX);
      if (dist < bestDist) {
        bestDist = dist;
        best = entry;
      }
    });
    return best;
  }

  attachPlushToClaw(entry) {
    if (!entry) return;
    this.carriedEntry = entry;
    this.grabAnchor.add(entry.mesh);
    const grabH = entry.mesh.userData.grabHeight || 0.72;
    entry.mesh.position.set(0, -grabH * 0.74, 0);
    entry.mesh.rotation.set(0, entry.homeRot.y * 0.4, 0);
    this.kinematics.impulseSwing((Math.random() - 0.5) * 0.6);

    // Subtle settling ripple on neighboring plushies left behind in the pile
    this.plushEntries.forEach((other) => {
      if (other === entry || other.collected) return;
      const d = Math.abs(other.homePos.x - entry.homePos.x);
      if (d < 1.15) {
        other.settleAmp = (1.15 - d) * 0.085;
        other.settlePhase = 0;
      }
    });
  }

  releaseCarriedPlush(intoChute) {
    const entry = this.carriedEntry;
    if (!entry) return null;
    this.carriedEntry = null;

    // Preserve world position when detaching from claw
    const worldPos = new this.THREE.Vector3();
    entry.mesh.getWorldPosition(worldPos);
    this.plushGroup.add(entry.mesh);
    entry.mesh.position.copy(worldPos);
    entry.mesh.scale.setScalar(entry.baseScale);

    if (intoChute) {
      this.droppingEntry = {
        entry,
        vy: -0.6,
        targetX: CABINET_BOUNDS.chuteX,
        done: false
      };
    } else {
      this.returningEntry = {
        entry,
        progress: 0,
        startPos: worldPos.clone()
      };
    }
    return entry;
  }

  returnPlushToPile(entry) {
    if (!entry) return;
    if (this.carriedEntry === entry) this.carriedEntry = null;
    if (this.droppingEntry && this.droppingEntry.entry === entry) this.droppingEntry = null;
    const worldPos = new this.THREE.Vector3();
    entry.mesh.getWorldPosition(worldPos);
    this.plushGroup.add(entry.mesh);
    entry.mesh.position.copy(worldPos);
    entry.mesh.visible = true;
    entry.collected = false;
    this.returningEntry = {
      entry,
      progress: 0,
      startPos: worldPos.clone()
    };
  }

  setChuteHighlighted(active) {
    this._chuteActive = Boolean(active);
  }

  start() {
    if (this._destroyed || this._rafId !== null) return;
    this._paused = false;
    this._lastTime = performance.now();
    const loop = (now) => {
      if (this._destroyed || this._paused) {
        this._rafId = null;
        return;
      }
      const dt = Math.min(0.05, Math.max(0.001, (now - this._lastTime) / 1000));
      this._lastTime = now;
      this._update(dt);
      this.renderer.render(this.scene, this.camera);
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
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

  resize() {
    if (!this.canvas || !this.renderer || this._destroyed) return;
    const parent = this.canvas.parentElement;
    const width = Math.max(240, parent ? parent.clientWidth : this.canvas.clientWidth || 440);
    const height = Math.max(180, parent ? parent.clientHeight : this.canvas.clientHeight || 280);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    // Dynamically adjust camera distance on narrow mobile viewports so all plushies stay framed
    this.camera.position.z = this.camera.aspect < 1.35 ? 8.55 : 7.55;
    this.camera.updateProjectionMatrix();
  }

  _update(dt) {
    if (this.onFrameCallback) {
      this.onFrameCallback(dt);
    }

    // Wake initialization sweep
    if (this._wakeActive) {
      this._wakeProgress += dt * 1.45;
      if (this._wakeProgress >= 1) {
        this._wakeActive = false;
        this.kinematics.targetProngOpen = 0.28;
      } else {
        const s = Math.sin(this._wakeProgress * Math.PI);
        this.kinematics.targetProngOpen = 0.28 + s * 0.55;
      }
    }

    // Update gantry carriage & spring extension
    this.carriageGroup.position.x = this.kinematics.x;
    const clawRelY = this.kinematics.clawY - CABINET_BOUNDS.railY - this.kinematics.plushWeightOffset;
    const springLen = Math.max(0.28, -clawRelY - 0.14);
    this.springMesh.scale.y = springLen;
    this.cordMesh.scale.y = springLen;
    this.clawPivot.position.y = clawRelY;
    this.clawPivot.rotation.z = this.reducedMotion ? 0 : this.kinematics.swingAngle;

    // Articulated 3 prongs
    const openAngle = 0.08 + this.kinematics.prongOpen * 0.58;
    for (let i = 0; i < this.prongs.length; i++) {
      this.prongs[i].rotation.z = openAngle;
    }

    // Subtle squeeze while plushie is held by prongs
    if (this.carriedEntry) {
      const s = this.carriedEntry.baseScale;
      this.carriedEntry.mesh.scale.set(s * 0.94, s * 1.04, s * 0.94);
    }

    // Dropping plushie into prize chute
    if (this.droppingEntry && !this.droppingEntry.done) {
      const d = this.droppingEntry;
      d.vy -= 11.5 * dt;
      d.entry.mesh.position.y += d.vy * dt;
      d.entry.mesh.position.x += (d.targetX - d.entry.mesh.position.x) * Math.min(1, dt * 8);
      d.entry.mesh.rotation.z += dt * 1.4;
      if (d.entry.mesh.position.y <= CABINET_BOUNDS.floorY - 0.62) {
        d.entry.collected = true;
        d.entry.mesh.visible = false;
        d.done = true;
      }
    }

    // Returning wrong-catch plushie smoothly to its spot in the pile
    if (this.returningEntry) {
      const r = this.returningEntry;
      r.progress = Math.min(1, r.progress + dt * 2.4);
      const ease = 1 - Math.pow(1 - r.progress, 3);
      r.entry.mesh.position.lerpVectors(r.startPos, r.entry.homePos, ease);
      r.entry.mesh.position.y += Math.sin(r.progress * Math.PI) * 0.25;
      r.entry.mesh.rotation.z = r.entry.homeRot.z * ease;
      if (r.progress >= 1) {
        r.entry.mesh.position.copy(r.entry.homePos);
        r.entry.mesh.rotation.copy(r.entry.homeRot);
        r.entry.settleAmp = 0.06;
        r.entry.settlePhase = 0;
        this.returningEntry = null;
      }
    }

    // Pile-settling micro-rocking
    this.plushEntries.forEach((entry) => {
      if (entry.settleAmp > 0.001 && entry !== this.carriedEntry && !entry.collected) {
        entry.settlePhase += dt * 13.0;
        entry.settleAmp *= Math.exp(-4.5 * dt);
        entry.mesh.rotation.z = entry.homeRot.z + Math.sin(entry.settlePhase) * entry.settleAmp;
      }
    });

    // Prize chute glow interpolation
    const targetGlow = this._chuteActive ? 1.0 : 0.0;
    this._chuteGlowStrength += (targetGlow - this._chuteGlowStrength) * Math.min(1, dt * 8);
    this.chuteLight.intensity = this._chuteGlowStrength * 1.35;
    this.chuteRimMat.emissiveIntensity = 0.06 + this._chuteGlowStrength * 1.15;
  }

  destroy() {
    this._destroyed = true;
    this.pause();
    if (this.scene) {
      this.scene.traverse((obj) => {
        if (obj.geometry && typeof obj.geometry.dispose === 'function') {
          obj.geometry.dispose();
        }
      });
    }
    if (this.matLib) {
      this.matLib.dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
