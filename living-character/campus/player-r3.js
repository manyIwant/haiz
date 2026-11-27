import * as THREE from 'three';
import { LivingCharacterAgent } from '../engine/motion-engine.js';
import { VehicleIKAdapter } from '../engine/vehicle-rig.js';

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

  const barTop = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.64, 6), frameMat);
  barTop.rotation.x = Math.PI * 0.5;
  barTop.position.set(0, 0.78, 0.04);
  const barSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.58, 6), frameMat);
  barSeat.position.set(0, 0.62, -0.22);
  barSeat.rotation.x = -0.22;
  const barFork = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.66, 6), frameMat);
  barFork.position.set(0, 0.64, 0.46);
  barFork.rotation.x = 0.25;
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.24), tireMat);
  saddle.position.set(0, 0.93, -0.28);
  const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.52, 6), chromeMat);
  handlebar.rotation.z = Math.PI * 0.5;
  handlebar.position.set(0, 0.99, 0.38);
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
  wing.castShadow = true;

  const spar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 4.7, 6), bambooMat);
  spar.rotation.z = Math.PI * 0.5;
  spar.position.set(0, 0.02, -0.15);
  const keel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 1.5, 6), bambooMat);
  keel.rotation.x = Math.PI * 0.5;
  keel.position.set(0, 0.02, 0.22);

  g.add(wing, spar, keel);
  g.position.set(0, 1.85, 0);
  g.visible = false;
  return g;
}

function createUmbrella() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.011, 0.88, 6),
    new THREE.MeshStandardMaterial({ color: '#2b2d30', roughness: 0.5 })
  );
  pole.position.y = 0.44;
  const dome = new THREE.Mesh(
    new THREE.ConeGeometry(0.58, 0.22, 12, 1, true),
    new THREE.MeshStandardMaterial({ color: '#1b6d55', roughness: 0.48, side: THREE.DoubleSide })
  );
  dome.position.y = 0.86;
  g.add(pole, dome);
  g.visible = false;
  return g;
}

export class PlayerControllerR3 {
  constructor(scene, camera, spatial, atmosphere, spec, groundDetector, agent, { onBell = () => {} } = {}) {
    this.scene = scene;
    this.camera = camera;
    this.spatial = spatial;
    this.atmosphere = atmosphere;
    this.spec = spec;
    this.groundDetector = groundDetector;
    this.agent = agent;
    this.vehicleIK = new VehicleIKAdapter(agent);
    this.onBell = onBell;

    // Spawn on central axis forecourt facing Teaching Block 1 '1923', Taihu Stone & Centenary Terminalia!
    this.pos = new THREE.Vector3(-4.5, spatial.heightAtThree(-4.5, -45.5), -45.5);
    this.vel = new THREE.Vector3();
    this.yaw = 0.12;
    this.camYaw = 0.12;
    this.camPitch = 0.16;
    this.camDist = 5.4;
    this.speed = 0;
    this.bank = 0;
    this.gaitPhase = 0;
    this.inThermal = null;
    this.mode = 'walk'; // 'walk' | 'bike' | 'glide'

    this.vehicleGroup = new THREE.Group();
    this.vehicleGroup.name = 'haiz_player_r3_vehicle';
    this.bike = createBikeMesh();
    this.glider = createGliderWing();
    this.vehicleGroup.add(this.bike.group, this.glider);
    this.vehicleGroup.position.copy(this.pos);
    scene.add(this.vehicleGroup);

    // Ensure Hero model sits cleanly in scene root during Walk and rides smoothly in Bike/Glide
    scene.add(this.agent.model);
    this.agent.setPosition(this.pos.x, this.pos.y, this.pos.z, this.yaw);

    this.umbrella = createUmbrella();
    scene.add(this.umbrella);

    this.thermalGroup = this._createThermalVisuals(spec.thermals || []);
    scene.add(this.thermalGroup);

    this._vistaAnim = null;
    this._planAerial = false;
    this.keys = new Set();
    this.joy = { x: 0, y: 0 };
    this.dragging = false;
    this._lastPtr = { x: 0, y: 0 };
    this._audioCtx = null;

    this._tmpA = new THREE.Vector3();
    this._tmpB = new THREE.Vector3();
    this._tmpHand = new THREE.Vector3();
  }

  static async create(scene, camera, spatial, atmosphere, spec, groundDetector, { onBell = () => {} } = {}) {
    const agent = await LivingCharacterAgent.create({
      archetype: 'student_hero',
      lod: 'lod0',
      groundDetector,
      shaderUniforms: atmosphere.uniforms,
      showBackpack: true,
      showCrossbody: true,
    });
    return new PlayerControllerR3(scene, camera, spatial, atmosphere, spec, groundDetector, agent, { onBell });
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

  setBags(mode) {
    const bags = {
      backpack: mode === 'both' || mode === 'backpack',
      crossbody: mode === 'both' || mode === 'crossbody',
    };
    this.agent.setAccessories(bags);
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
    const prev = this.mode;
    this.mode = mode;
    this._vistaAnim = null;
    this.bike.group.visible = mode === 'bike';
    this.glider.visible = mode === 'glide';
    this.thermalGroup.visible = mode === 'glide';

    if (mode === 'walk') {
      this.vehicleIK.exitVehicle();
      this.agent.model.rotation.set(0, this.yaw, 0);
      this.pos.y = this.spatial.heightAtThree(this.pos.x, this.pos.z);
      this.agent.setPosition(this.pos.x, this.pos.y, this.pos.z, this.yaw);
      this.bank = 0;
      this.camDist = 5.4;
      this.camPitch = 0.16;
    } else {
      if (prev === 'walk') this.vehicleIK.enterVehicle(mode);
      else this.vehicleIK.activeVehicle = mode;
      if (mode === 'glide') {
        const gy = this.spatial.heightAtThree(this.pos.x, this.pos.z);
        if (this.pos.y < gy + 10) this.pos.y = gy + 18;
        this.speed = Math.max(this.speed, 13.0);
        this.camDist = 11.5;
        this.camPitch = 0.24;
      } else {
        this.pos.y = this.spatial.heightAtThree(this.pos.x, this.pos.z);
        this.camDist = 6.2;
        this.camPitch = 0.18;
      }
    }
  }

  teleport(threeX, threeZ, yaw = 0) {
    this._vistaAnim = null;
    const safe = this.spatial.resolveMoveThree(threeX, threeZ, 0.5);
    this.pos.set(safe.x, this.spatial.heightAtThree(safe.x, safe.z), safe.z);
    if (this.mode === 'glide') this.pos.y += 22;
    this.yaw = yaw;
    this.camYaw = yaw;
    this.agent.setPosition(this.pos.x, this.pos.y, this.pos.z, yaw);
    this.vehicleGroup.position.copy(this.pos);
  }

  flyToVista(vista) {
    const tPos = new THREE.Vector3(vista.cam[0], vista.cam[2], -vista.cam[1]);
    const tTgt = new THREE.Vector3(vista.target[0], vista.target[2], -vista.target[1]);
    this._vistaAnim = {
      fromPos: this.camera.position.clone(),
      fromTgt: this._currentLookTarget?.clone() || this.pos.clone(),
      toPos: tPos,
      toTgt: tTgt,
      t: 0,
      dur: 1.55,
    };
  }

  cancelVista() { this._vistaAnim = null; }
  setPlanAerial(enabled) { this._planAerial = enabled; }

  update(dt, runtime) {
    let fwd = 0;
    let right = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) fwd += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) fwd -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) right += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) right -= 1;
    if (Math.abs(this.joy.x) > 0.08 || Math.abs(this.joy.y) > 0.08) {
      right += this.joy.x;
      fwd += this.joy.y;
    }
    const boost = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const upKey = this.keys.has('KeyE');
    const downKey = this.keys.has('KeyQ');
    const strafeKey = this.keys.has('AltLeft') || this.keys.has('AltRight');

    if (fwd !== 0 || right !== 0) this._vistaAnim = null;

    if (this.mode === 'walk') {
      const mag = Math.hypot(fwd, right);
      let desiredSpeed = 0;
      let desiredHeading = this.yaw;
      if (mag > 0.08) {
        const moveAng = Math.atan2(-right, fwd); // relative to camYaw
        desiredHeading = this.camYaw + moveAng;
        desiredSpeed = boost ? 3.45 : 1.45;
      }

      if (this.keys.has('Space')) {
        this.agent.jump();
      }

      this.agent.setStrafe(strafeKey, this.camYaw);
      this.agent.setMoveTarget(desiredSpeed, desiredHeading);
      this.agent.setWind(this.atmosphere.uniforms.uWindDir.value, this.atmosphere.uniforms.uWindStrength.value);
      this.agent.step(dt, { measureTelemetry: false });

      // Soft campus wall collision guard
      const hp = this.agent.human.position;
      const safe = this.spatial.resolveMoveThree(hp.x, hp.z, 0.36);
      if (Math.hypot(safe.x - hp.x, safe.z - hp.z) > 0.02) {
        this.agent.human.shiftOrigin(this._tmpA.set(safe.x - hp.x, 0, safe.z - hp.z));
      }

      this.pos.copy(this.agent.human.position);
      this.yaw = this.agent.human.heading;
      this.speed = this.agent.human.speed;

      // Apply exit blend from bike/glide smoothly if transitioning back to walk
      this.vehicleIK.apply(dt, null);

      // Rain umbrella held naturally upright in right hand when exposed to rain
      const isRain = this.atmosphere.uniforms.uRain.value > 0.35;
      const sheltered = this.spatial.isShelteredThree(this.pos.x, this.pos.z);
      this.umbrella.visible = isRain && !sheltered;
      if (this.umbrella.visible && this.agent.bones.handR) {
        this.agent.bones.handR.getWorldPosition(this._tmpHand);
        this.umbrella.position.copy(this._tmpHand);
      }

      this.vehicleGroup.position.copy(this.pos);
    } else if (this.mode === 'bike') {
      this.umbrella.visible = false;
      const targetSpd = fwd > 0 ? (boost ? 12.2 : 8.2) : fwd < 0 ? -2.2 : 0;
      const rate = Math.abs(targetSpd) > 0.1 ? 3.5 : 4.2;
      this.speed += (targetSpd - this.speed) * Math.min(1, dt * rate);
      const steerFactor = Math.min(1.15, 0.4 + Math.abs(this.speed) * 0.12);
      const turnDir = this.speed < -0.2 ? 1 : -1;
      this.yaw += right * turnDir * steerFactor * 1.4 * dt;

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
      const nightOn = this.atmosphere.uniforms.uLamps.value;
      this.bike.headlight.intensity = nightOn * 18.0;
      this.bike.lampMat.emissiveIntensity = nightOn * 3.2;

      this.vehicleGroup.position.copy(this.pos);
      this.vehicleGroup.rotation.set(0, this.yaw, -this.bank);

      // Position articulated hero on bike saddle & solve inherited 2-bone IK to grips/pedals
      this.gaitPhase += this.speed * dt * 1.65;
      const frameQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.yaw, -this.bank));
      const fwdV = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      const rightV = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const upV = new THREE.Vector3(0, 1, 0).applyQuaternion(frameQ);
      const hipsTarget = this.pos.clone().addScaledVector(fwdV, -0.22).addScaledVector(upV, 0.99);

      const gripL = this.pos.clone().addScaledVector(rightV, -0.24).addScaledVector(fwdV, 0.36).addScaledVector(upV, 0.99);
      const gripR = this.pos.clone().addScaledVector(rightV, 0.24).addScaledVector(fwdV, 0.36).addScaledVector(upV, 0.99);
      const pZ = Math.sin(this.gaitPhase) * 0.14;
      const pY = Math.cos(this.gaitPhase) * 0.14;
      const pedalL = this.pos.clone().addScaledVector(rightV, -0.14).addScaledVector(fwdV, pZ).addScaledVector(upV, 0.34 + pY);
      const pedalR = this.pos.clone().addScaledVector(rightV, 0.14).addScaledVector(fwdV, -pZ).addScaledVector(upV, 0.34 - pY);
      const legPole = fwdV.clone().multiplyScalar(0.9).addScaledVector(upV, 0.35);
      const armPole = fwdV.clone().multiplyScalar(-0.7).addScaledVector(upV, -0.35);

      this.vehicleIK.apply(dt, {
        frame: frameQ,
        hips: hipsTarget,
        pitch: [0.12, 0.18, 0.16],
        look: 0.18,
        feet: { L: { at: pedalL, pole: legPole }, R: { at: pedalR, pole: legPole } },
        hands: { L: { at: gripL, pole: armPole }, R: { at: gripR, pole: armPole } },
        curl: 0.6,
      });
    } else if (this.mode === 'glide') {
      this.umbrella.visible = false;
      this.yaw -= right * 1.35 * dt;
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

      let lift = -0.85;
      this.inThermal = null;
      for (const { col, th } of this._thermalMeshes) {
        const d = Math.hypot(this.pos.x - th.xy[0], this.pos.z - (-th.xy[1]));
        if (d < th.radius) {
          lift += th.lift * (0.5 + 0.5 * (1.0 - d / th.radius));
          this.inThermal = th.name;
        }
        col.children.forEach((ring, ri) => {
          ring.position.y = ((runtime.simTime * 3.8 + ri * 10) % 42) + 2;
          ring.rotation.z = runtime.simTime * 0.6 + ri;
        });
      }
      if (upKey) lift += 6.2;
      if (downKey) lift -= 5.8;

      this.pos.x = Math.max(-245, Math.min(228, this.pos.x + Math.sin(this.yaw) * this.speed * dt));
      this.pos.z = Math.max(-136, Math.min(264, this.pos.z + Math.cos(this.yaw) * this.speed * dt));
      const floorY = this.spatial.heightAtThree(this.pos.x, this.pos.z) + 3.2;
      this.pos.y = Math.max(floorY, Math.min(115, this.pos.y + lift * dt));

      this.vehicleGroup.position.copy(this.pos);
      this.vehicleGroup.rotation.set(0, this.yaw, -this.bank);

      const frameQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.yaw, -this.bank));
      const fwdV = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      const rightV = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const upV = new THREE.Vector3(0, 1, 0).applyQuaternion(frameQ);
      const gripL = this.pos.clone().addScaledVector(rightV, -0.45).addScaledVector(fwdV, 0.30).addScaledVector(upV, 1.66);
      const gripR = this.pos.clone().addScaledVector(rightV, 0.45).addScaledVector(fwdV, 0.30).addScaledVector(upV, 1.66);
      this.vehicleIK.apply(dt, {
        frame: frameQ,
        hips: this.pos.clone().addScaledVector(upV, 1.25),
        pitch: [0.35, 0.28, 0.22],
        look: 0.25,
        hands: { L: { at: gripL, pole: new THREE.Vector3(0, -1, 0) }, R: { at: gripR, pole: new THREE.Vector3(0, -1, 0) } },
        curl: 0.5,
      });
    }

    // Camera choreography (identical to R2)
    if (this._planAerial) {
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
      const lookH = this.mode === 'glide' ? 1.5 : 1.42;
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
