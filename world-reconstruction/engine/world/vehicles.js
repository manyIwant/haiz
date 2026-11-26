/**
 * HAIZ · World Reconstruction — Multi-Scale Player Locomotion, Campus Bike, Thermal Glider & Camera Director.
 *
 * Four distinct ways to experience the reconstructed Hainan Middle School world:
 *   1. 漫步 (Walk): Third-person student with natural walk/run/jump & automatic rain umbrella.
 *   2. 单车 (Campus Bike): Curvature steering, banking lean, spinning wheels, brass bell [Space], warm night headlight!
 *   3. 滑翔 (Campus Glide): Effortless aerial soaring over the entire 500m x 400m campus riding 6 microclimate thermals!
 *   4. 考察视角 (Curated Vistas): Smooth cinematic camera flights between 8 iconic architectural viewpoints.
 */
import * as THREE from 'three';

function createBikeMesh() {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: '#2b6a58', roughness: 0.38, metalness: 0.45 });
  const tireMat = new THREE.MeshStandardMaterial({ color: '#232628', roughness: 0.85 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#d4d8dc', roughness: 0.22, metalness: 0.85 });
  const basketMat = new THREE.MeshStandardMaterial({ color: '#b8864b', roughness: 0.75 });
  const lampMat = new THREE.MeshStandardMaterial({ color: '#fff3d4', emissive: '#ffcf78', emissiveIntensity: 0.0 });

  const mkWheel = (zPos) => {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.032, 8, 18), tireMat);
    tire.rotation.y = Math.PI * 0.5;
    tire.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 8), chromeMat);
    hub.rotation.z = Math.PI * 0.5;
    const spokeA = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.60, 0.012), chromeMat);
    const spokeB = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.012, 0.60), chromeMat);
    w.add(tire, hub, spokeA, spokeB);
    w.position.set(0, 0.34, zPos);
    return w;
  };
  const wheelF = mkWheel(0.58);
  const wheelR = mkWheel(-0.56);

  // Diamond frame
  const barTop = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.64, 6), frameMat);
  barTop.rotation.x = Math.PI * 0.5; barTop.position.set(0, 0.78, 0.04);
  const barSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.58, 6), frameMat);
  barSeat.position.set(0, 0.62, -0.22); barSeat.rotation.x = -0.22;
  const barFork = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.66, 6), frameMat);
  barFork.position.set(0, 0.64, 0.46); barFork.rotation.x = 0.25;
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.24), tireMat);
  saddle.position.set(0, 0.93, -0.28);
  const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.52, 6), chromeMat);
  handlebar.rotation.z = Math.PI * 0.5; handlebar.position.set(0, 0.99, 0.38);
  const basket = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.22), basketMat);
  basket.position.set(0, 0.86, 0.52);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), lampMat);
  lamp.position.set(0, 0.80, 0.64);
  const headlight = new THREE.SpotLight('#ffd48c', 0, 26, Math.PI * 0.28, 0.55);
  headlight.position.set(0, 0.80, 0.64);
  headlight.target.position.set(0, 0.0, 9.0);

  g.add(wheelF, wheelR, barTop, barSeat, barFork, saddle, handlebar, basket, lamp, headlight, headlight.target);
  g.visible = false;
  return { group: g, wheelF, wheelR, headlight, lampMat };
}

function createGliderWing() {
  // Translucent sculptural Terminalia-leaf hang-glider kite wing!
  const g = new THREE.Group();
  const wingMat = new THREE.MeshStandardMaterial({
    color: '#4c8e39', emissive: '#6ca83b', emissiveIntensity: 0.18,
    roughness: 0.42, side: THREE.DoubleSide, transparent: true, opacity: 0.92,
  });
  const bambooMat = new THREE.MeshStandardMaterial({ color: '#b59252', roughness: 0.62 });

  const shape = new THREE.Shape();
  shape.moveTo(0, 0.85);
  shape.quadraticCurveTo(1.7, 0.65, 2.35, -0.35);
  shape.quadraticCurveTo(1.2, -0.65, 0, -0.30);
  shape.quadraticCurveTo(-1.2, -0.65, -2.35, -0.35);
  shape.quadraticCurveTo(-1.7, 0.65, 0, 0.85);
  const wing = new THREE.Mesh(new THREE.ShapeGeometry(shape, 10), wingMat);
  wing.rotation.x = -Math.PI * 0.5;
  wing.position.set(0, 1.95, 0.10);
  wing.castShadow = true;

  const spar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 4.3, 6), bambooMat);
  spar.rotation.z = Math.PI * 0.5; spar.position.set(0, 1.93, -0.10);
  const keel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.35, 6), bambooMat);
  keel.rotation.x = Math.PI * 0.5; keel.position.set(0, 1.93, 0.15);

  g.add(wing, spar, keel);
  g.visible = false;
  return g;
}

function createPlayerAvatar() {
  const g = new THREE.Group();
  // Iconic Hainan Middle School summer uniform: crisp white polo with emerald-teal collar/stripe, navy trousers, white sneakers
  const shirt = new THREE.MeshStandardMaterial({ color: '#f5f7f6', roughness: 0.65 });
  const trim = new THREE.MeshStandardMaterial({ color: '#1b6d5a', roughness: 0.58 });
  const pants = new THREE.MeshStandardMaterial({ color: '#26466d', roughness: 0.76 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#eceae4', roughness: 0.62 });
  const skin = new THREE.MeshStandardMaterial({ color: '#efc9a8', roughness: 0.62 });
  const hair = new THREE.MeshStandardMaterial({ color: '#201c1b', roughness: 0.68 });
  const packMat = new THREE.MeshStandardMaterial({ color: '#c4683b', roughness: 0.68 });
  const strapMat = new THREE.MeshStandardMaterial({ color: '#5d3b27', roughness: 0.72 });

  // Pivoted legs at hip height (y=0.78) so walking & pedaling swing cleanly from the hips!
  const mkLeg = (sx) => {
    const hip = new THREE.Group();
    hip.position.set(sx, 0.78, 0);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.058, 0.36, 10), pants);
    thigh.position.y = -0.18; thigh.castShadow = true;
    const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.048, 0.34, 10), pants);
    calf.position.y = -0.51; calf.castShadow = true;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.075, 0.21), shoeMat);
    shoe.position.set(0, -0.74, 0.035); shoe.castShadow = true;
    hip.add(thigh, calf, shoe);
    return hip;
  };
  const legL = mkLeg(-0.095);
  const legR = mkLeg(0.095);

  // Sculpted torso with Hainan Middle School teal shoulder band & crisp collar
  const torso = new THREE.Group();
  torso.position.set(0, 0.78, 0);
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.14, 0.52, 12), shirt);
  chest.scale.set(1.08, 1.0, 0.74);
  chest.position.y = 0.28; chest.castShadow = true;
  const tealBand = new THREE.Mesh(new THREE.CylinderGeometry(0.172, 0.166, 0.075, 12), trim);
  tealBand.scale.set(1.08, 1.0, 0.76);
  tealBand.position.y = 0.44;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.105, 0.055, 10), trim);
  collar.position.y = 0.55;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.09, 10), skin);
  neck.position.y = 0.59;
  // Detailed canvas school backpack with straps & top flap
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.34, 0.13), packMat);
  pack.position.set(0, 0.29, -0.16); pack.castShadow = true;
  const packFlap = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.09, 0.14), strapMat);
  packFlap.position.set(0, 0.43, -0.16);
  for (const sx of [-0.11, 0.11]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.34, 0.03), strapMat);
    strap.position.set(sx, 0.33, 0.11);
    torso.add(strap);
  }
  torso.add(chest, tealBand, collar, neck, pack, packFlap);

  // Pivoted arms at shoulder height (y=1.28)
  const mkArm = (sx) => {
    const sh = new THREE.Group();
    sh.position.set(sx, 1.28, 0);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.052, 0.20, 8), shirt);
    sleeve.position.y = -0.09; sleeve.castShadow = true;
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.038, 0.26, 8), skin);
    forearm.position.y = -0.30; forearm.castShadow = true;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), skin);
    hand.position.y = -0.44;
    sh.add(sleeve, forearm, hand);
    return sh;
  };
  const armL = mkArm(-0.215);
  const armR = mkArm(0.215);

  const head = new THREE.Group();
  head.position.set(0, 1.50, 0);
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 14), skin);
  cranium.scale.set(0.96, 1.06, 0.98); cranium.castShadow = true;
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.132, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), hair);
  hairCap.position.set(0, 0.02, -0.015);
  const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), hair);
  hairBack.scale.set(1.0, 0.9, 0.72);
  hairBack.position.set(0, -0.01, -0.055);
  head.add(cranium, hairCap, hairBack);

  const umbrella = new THREE.Group();
  const uPole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.95, 6), new THREE.MeshStandardMaterial({ color: '#333' }));
  uPole.position.y = 0.47;
  const uDome = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.24, 12, 1, true), new THREE.MeshStandardMaterial({ color: '#1b6d55', roughness: 0.45, side: THREE.DoubleSide }));
  uDome.position.y = 0.90;
  umbrella.add(uPole, uDome);
  umbrella.position.set(0.24, 1.08, 0.10);
  umbrella.visible = false;

  g.add(legL, legR, torso, armL, armR, head, umbrella);
  return { root: g, legL, legR, armL, armR, torso, head, umbrella };
}

export class PlayerController {
  constructor(scene, camera, spatial, atmosphere, spec, { onBell = () => {} }) {
    this.scene = scene;
    this.camera = camera;
    this.spatial = spatial;
    this.atmosphere = atmosphere;
    this.spec = spec;
    this.onBell = onBell;

    // Spawn on central axis forecourt facing Teaching Block 1 '1923', Taihu Stone & Centenary Terminalia!
    this.pos = new THREE.Vector3(-4.5, spatial.heightAtThree(-4.5, -45.5), -45.5);
    this.vel = new THREE.Vector3();
    this.yaw = 0.12;        // facing south (+Z) toward Teaching Block 1!
    this.camYaw = 0.12;
    this.camPitch = 0.18;
    this.camDist = 7.2;
    this.speed = 0;
    this.bank = 0;
    this.gaitPhase = 0;
    this.grounded = true;
    this.inThermal = null;
    this.mode = 'walk';     // 'walk' | 'bike' | 'glide'

    this.group = new THREE.Group();
    this.group.name = 'haiz_player';
    this.avatar = createPlayerAvatar();
    this.bike = createBikeMesh();
    this.glider = createGliderWing();
    this.group.add(this.avatar.root, this.bike.group, this.glider);
    this.group.position.copy(this.pos);
    scene.add(this.group);

    // Thermal updraft shimmering wind rings (visible in Glide mode!)
    this.thermalGroup = this._createThermalVisuals(spec.thermals);
    scene.add(this.thermalGroup);

    // Camera transition state for curated vistas
    this._vistaAnim = null;
    this._planAerial = false;

    // Input state (keyboard + touch virtual joystick + mouse drag orbit)
    this.keys = new Set();
    this.joy = { x: 0, y: 0 }; // x: -1..1 right, y: -1..1 forward
    this.dragging = false;
    this._lastPtr = { x: 0, y: 0 };

    // Audio bell synthesis (lazy Web Audio)
    this._audioCtx = null;
  }

  _createThermalVisuals(thermals) {
    const grp = new THREE.Group();
    grp.name = 'haiz_thermals';
    const mat = new THREE.MeshBasicMaterial({ color: '#ffe39a', transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
    this._thermalMeshes = [];
    for (const th of thermals) {
      const col = new THREE.Group();
      col.position.set(th.xy[0], 0, -th.xy[1]);
      for (let k = 0; k < 4; k++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(th.radius * 0.42, 0.18, 6, 24), mat);
        ring.rotation.x = Math.PI * 0.5;
        ring.position.y = 4 + k * 10;
        col.add(ring);
      }
      grp.add(col);
      this._thermalMeshes.push({ col, th });
    }
    grp.visible = false;
    return grp;
  }

  ringBell() {
    this.onBell(this.pos);
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!this._audioCtx) this._audioCtx = new AC();
      const ctx = this._audioCtx;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      for (const freq of [1680, 3380]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.11, now);
        gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.55);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.58);
      }
    } catch {}
  }

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this._vistaAnim = null;
    this.bike.group.visible = mode === 'bike';
    this.glider.visible = mode === 'glide';
    this.thermalGroup.visible = mode === 'glide';
    if (mode === 'glide') {
      const gy = this.spatial.heightAtThree(this.pos.x, this.pos.z);
      if (this.pos.y < gy + 10) this.pos.y = gy + 18;
      this.speed = Math.max(this.speed, 13.0);
      this.camDist = 11.5;
      this.camPitch = 0.24;
    } else if (mode === 'bike') {
      this.pos.y = this.spatial.heightAtThree(this.pos.x, this.pos.z);
      this.vel.y = 0;
      this.camDist = 6.8;
      this.camPitch = 0.18;
    } else {
      this.pos.y = this.spatial.heightAtThree(this.pos.x, this.pos.z);
      this.vel.y = 0;
      this.bank = 0;
      this.camDist = 6.2;
      this.camPitch = 0.16;
    }
  }

  teleport(threeX, threeZ, yaw = 0) {
    this._vistaAnim = null;
    const safe = this.spatial.resolveMoveThree(threeX, threeZ, 0.5);
    this.pos.set(safe.x, this.spatial.heightAtThree(safe.x, safe.z), safe.z);
    if (this.mode === 'glide') this.pos.y += 22;
    this.yaw = yaw;
    this.camYaw = yaw;
    this.speed = 0;
    this.vel.set(0, 0, 0);
  }

  flyToVista(vista) {
    // Spec pos/target -> Three.js (sx, sz, -sy)
    const p = new THREE.Vector3(vista.pos[0], vista.pos[2], -vista.pos[1]);
    const t = new THREE.Vector3(vista.target[0], vista.target[2], -vista.target[1]);
    this._vistaAnim = {
      fromPos: this.camera.position.clone(),
      toPos: p,
      fromTgt: this._currentLookTarget ? this._currentLookTarget.clone() : this.pos.clone(),
      toTgt: t,
      t: 0,
      dur: 1.15,
      hold: true,
    };
  }

  cancelVista() {
    if (this._vistaAnim) this._vistaAnim = null;
  }

  setPlanAerial(enabled) {
    this._planAerial = enabled;
    if (enabled) this._vistaAnim = null;
  }

  update(dt, runtime) {
    // Read directional input
    let fwd = this.joy.y;
    let right = this.joy.x;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) fwd += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) fwd -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) right += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) right -= 1;
    const boost = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const upKey = this.keys.has('Space');
    const downKey = this.keys.has('KeyC');

    if ((Math.abs(fwd) > 0.08 || Math.abs(right) > 0.08) && this._vistaAnim) {
      this._vistaAnim = null;
    }

    const isRain = this.atmosphere.uniforms.uRain.value > 0.35;
    const sheltered = this.spatial.isShelteredThree(this.pos.x, this.pos.z);

    if (this.mode === 'walk') {
      const mag = Math.min(1, Math.hypot(fwd, right));
      const maxSpd = boost ? 6.8 : 3.6;
      const targetSpd = mag * maxSpd;
      this.speed += (targetSpd - this.speed) * Math.min(1, dt * 10);

      if (mag > 0.05) {
        // Move relative to camera yaw
        const camForwardX = Math.sin(this.camYaw);
        const camForwardZ = Math.cos(this.camYaw);
        const camRightX = -camForwardZ;
        const camRightZ = camForwardX;
        const mx = camForwardX * fwd + camRightX * right;
        const mz = camForwardZ * fwd + camRightZ * right;
        const ml = Math.hypot(mx, mz) || 1;
        const moveYaw = Math.atan2(mx, mz);
        let diff = moveYaw - this.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.yaw += diff * Math.min(1, dt * 11);

        const nextX = this.pos.x + (mx / ml) * this.speed * dt;
        const nextZ = this.pos.z + (mz / ml) * this.speed * dt;
        const safe = this.spatial.resolveMoveThree(nextX, nextZ, 0.45);
        this.pos.x = safe.x;
        this.pos.z = safe.z;
      }

      // Gravity & jumping
      const gy = this.spatial.heightAtThree(this.pos.x, this.pos.z);
      if (upKey && this.grounded) {
        this.vel.y = 5.4;
        this.grounded = false;
      }
      this.vel.y -= 16.5 * dt;
      this.pos.y += this.vel.y * dt;
      if (this.pos.y <= gy) {
        this.pos.y = gy;
        this.vel.y = 0;
        this.grounded = true;
      }

      // Walk gait animation
      if (this.speed > 0.15) this.gaitPhase += dt * (4.8 + this.speed * 1.45);
      const sw = this.speed > 0.15 ? Math.sin(this.gaitPhase) * Math.min(0.65, this.speed * 0.16) : 0;
      this.avatar.legL.rotation.x = sw;
      this.avatar.legR.rotation.x = -sw;
      this.avatar.armL.rotation.x = -sw * 0.75;
      this.avatar.armR.rotation.x = (isRain && !sheltered) ? -0.85 : sw * 0.75;
      this.avatar.root.position.y = 0;
      this.avatar.root.rotation.x = 0;
      this.avatar.umbrella.visible = isRain && !sheltered;
      this.bank *= Math.exp(-dt * 8);
    } else if (this.mode === 'bike') {
      const accel = fwd > 0 ? (boost ? 9.5 : 6.2) : fwd < 0 ? -11.0 : -2.4;
      const maxSpd = boost ? 13.5 : 9.2;
      if (fwd !== 0) this.speed = Math.max(-2.0, Math.min(maxSpd, this.speed + accel * dt));
      else this.speed *= Math.exp(-dt * 1.8);

      const steerRate = (1.9 - Math.min(0.9, Math.abs(this.speed) * 0.06)) * (this.speed >= 0 ? 1 : -1);
      const turn = -right * steerRate * Math.min(1, Math.abs(this.speed) * 0.4 + 0.15);
      this.yaw += turn * dt;
      // Smooth camera follow behind bike when steering
      if (!this.dragging) {
        let cd = this.yaw - this.camYaw;
        while (cd > Math.PI) cd -= Math.PI * 2;
        while (cd < -Math.PI) cd += Math.PI * 2;
        this.camYaw += cd * Math.min(1, dt * 3.5);
      }
      const targetBank = right * Math.min(0.28, Math.abs(this.speed) * 0.025);
      this.bank += (targetBank - this.bank) * Math.min(1, dt * 8);

      const nx = this.pos.x + Math.sin(this.yaw) * this.speed * dt;
      const nz = this.pos.z + Math.cos(this.yaw) * this.speed * dt;
      const safe = this.spatial.resolveMoveThree(nx, nz, 0.62);
      this.pos.x = safe.x;
      this.pos.z = safe.z;
      this.pos.y = this.spatial.heightAtThree(this.pos.x, this.pos.z);

      this.bike.wheelF.rotation.x += (this.speed * dt) / 0.32;
      this.bike.wheelR.rotation.x += (this.speed * dt) / 0.32;
      // Warm night headlight automatic glow
      const nightOn = this.atmosphere.uniforms.uLamps.value;
      this.bike.headlight.intensity = nightOn * 18.0;
      this.bike.lampMat.emissiveIntensity = nightOn * 3.2;

      // Rider seated pedaling pose
      this.gaitPhase += this.speed * dt * 1.65;
      this.avatar.root.position.set(0, 0.28, -0.18);
      this.avatar.root.rotation.x = 0.22;
      this.avatar.legL.rotation.x = -0.4 + Math.sin(this.gaitPhase) * 0.42;
      this.avatar.legR.rotation.x = -0.4 - Math.sin(this.gaitPhase) * 0.42;
      this.avatar.armL.rotation.x = -0.95;
      this.avatar.armR.rotation.x = -0.95;
      this.avatar.umbrella.visible = false;
    } else if (this.mode === 'glide') {
      // Unpowered thermal-soaring glider over the full 500m x 400m campus!
      const turn = -right * 1.35;
      this.yaw += turn * dt;
      if (!this.dragging) {
        let cd = this.yaw - this.camYaw;
        while (cd > Math.PI) cd -= Math.PI * 2;
        while (cd < -Math.PI) cd += Math.PI * 2;
        this.camYaw += cd * Math.min(1, dt * 3.2);
      }
      const targetBank = right * 0.42;
      this.bank += (targetBank - this.bank) * Math.min(1, dt * 5.5);

      const cruise = boost ? 22.0 : 14.5;
      const targetSpd = fwd > 0 ? cruise + 5.0 : fwd < 0 ? 9.5 : cruise;
      this.speed += (targetSpd - this.speed) * Math.min(1, dt * 2.5);

      // Check 6 campus microclimate thermal updrafts!
      let lift = -0.85; // gentle natural glide sink
      this.inThermal = null;
      for (const { col, th } of this._thermalMeshes) {
        const d = Math.hypot(this.pos.x - th.xy[0], this.pos.z - (-th.xy[1]));
        if (d < th.radius) {
          const factor = 1.0 - d / th.radius;
          lift += th.lift * (0.5 + 0.5 * factor);
          this.inThermal = th.name;
        }
        // Animate shimmering updraft rings rising smoothly
        col.children.forEach((ring, ri) => {
          ring.position.y = ((runtime.simTime * 3.8 + ri * 10) % 42) + 2;
          ring.rotation.z = runtime.simTime * 0.6 + ri;
        });
      }
      if (upKey) lift += 6.2;
      if (downKey) lift -= 5.8;

      const nx = this.pos.x + Math.sin(this.yaw) * this.speed * dt;
      const nz = this.pos.z + Math.cos(this.yaw) * this.speed * dt;
      this.pos.x = Math.max(-245, Math.min(228, nx));
      this.pos.z = Math.max(-136, Math.min(264, nz));
      const floorY = this.spatial.heightAtThree(this.pos.x, this.pos.z) + 3.2;
      this.pos.y = Math.max(floorY, Math.min(115, this.pos.y + lift * dt));

      this.avatar.root.position.set(0, 0.42, 0);
      this.avatar.root.rotation.x = 0.55;
      this.avatar.armL.rotation.x = -1.75;
      this.avatar.armR.rotation.x = -1.75;
      this.avatar.legL.rotation.x = 0.25;
      this.avatar.legR.rotation.x = 0.25;
      this.avatar.umbrella.visible = false;
    }

    this.group.position.copy(this.pos);
    this.group.rotation.set(0, this.yaw, -this.bank);

    // Camera choreography
    if (this._planAerial) {
      // High orthographic-feeling architectural plan view centered on campus
      const tgt = new THREE.Vector3(this.pos.x, 0, this.pos.z);
      const desired = new THREE.Vector3(this.pos.x, 165, this.pos.z - 62);
      this.camera.position.lerp(desired, Math.min(1, dt * 4.5));
      this.camera.lookAt(tgt);
      this._currentLookTarget = tgt;
    } else if (this._vistaAnim) {
      const a = this._vistaAnim;
      a.t = Math.min(1, a.t + dt / a.dur);
      const e = 1 - Math.pow(1 - a.t, 3);
      this.camera.position.lerpVectors(a.fromPos, a.toPos, e);
      const look = new THREE.Vector3().lerpVectors(a.fromTgt, a.toTgt, e);
      this.camera.lookAt(look);
      this._currentLookTarget = look;
    } else {
      const lookH = this.mode === 'glide' ? 1.5 : 1.55;
      const target = new THREE.Vector3(this.pos.x, this.pos.y + lookH, this.pos.z);
      const cp = Math.cos(this.camPitch);
      const sp = Math.sin(this.camPitch);
      const cx = target.x - Math.sin(this.camYaw) * this.camDist * cp;
      const cz = target.z - Math.cos(this.camYaw) * this.camDist * cp;
      const cy = Math.max(this.spatial.heightAtThree(cx, cz) + 0.8, target.y + this.camDist * sp);
      this.camera.position.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, dt * 9.5));
      this.camera.lookAt(target);
      this._currentLookTarget = target;
    }
  }
}
