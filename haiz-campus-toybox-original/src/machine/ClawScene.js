// HAIZ Campus Toybox — 3D Claw Machine Scene & Interactive State Machine.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildCabinet, PLAYFIELD, normToWorld } from './cabinet.js';
import { createToy, TOY_BY_ID } from '../toys/registry.js';
import { contactShadow } from '../toys/kit/textures.js';
import { ToyboxAudio } from '../audio/sfx.js';

const CLAW_HOME_DROP = 0.068;
const CLAW_SPEED = 0.44; // m/s
const X_LIMIT = PLAYFIELD.halfX - 0.055;
const Z_LIMIT = PLAYFIELD.halfZ - 0.055;
const PICK_RADIUS = 0.095; // generous, frustration-free grab radius

export class ClawScene {
  /**
   * @param {HTMLElement} container
   * @param {{ reducedMotion?: boolean, onDropComplete?: (pick: { slot: number, characterId: string } | null) => Promise<object>, onStateChange?: (state: string, info?: object) => void }} [opts]
   */
  constructor(container, opts = {}) {
    this.container = container;
    this.reducedMotion = !!opts.reducedMotion;
    this.onDropComplete = opts.onDropComplete || (async () => ({ status: 'wrong' }));
    this.onStateChange = opts.onStateChange || (() => {});
    this.onFirstAction = opts.onFirstAction || (() => {});
    this.audio = new ToyboxAudio();
    this.showcaseToy = null;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.94;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    this.container.appendChild(this.renderer.domElement);

    // Scene & subtle warm studio environment
    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this._envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this._envRT.texture;
    this.scene.environmentIntensity = 0.42;
    pmrem.dispose();

    // Camera
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.05, 15);
    this.camTarget = new THREE.Vector3(0, 0.21, 0.02);

    // Lighting — Hainan afternoon sun + warm interior showcase lamp + cool sea-breeze rim
    const hemi = new THREE.HemisphereLight('#fff3dc', '#a8896c', 0.56);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight('#ffeed0', 1.55);
    sun.position.set(1.4, 2.2, 1.8);
    sun.castShadow = true;
    const smSize = (navigator.hardwareConcurrency || 4) <= 2 ? 512 : 1024;
    sun.shadow.mapSize.set(smSize, smSize);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 6;
    sun.shadow.camera.left = -0.85;
    sun.shadow.camera.right = 0.85;
    sun.shadow.camera.top = 0.95;
    sun.shadow.camera.bottom = -0.6;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.012;
    this.scene.add(sun);

    const interiorLamp = new THREE.PointLight('#ffdfa8', 0.65, 1.4, 1.8);
    interiorLamp.position.set(0, PLAYFIELD.ceilingY - 0.06, 0.08);
    this.scene.add(interiorLamp);

    const rim = new THREE.DirectionalLight('#9ad8d4', 0.45);
    rim.position.set(-1.3, 0.9, -1.2);
    this.scene.add(rim);

    // Subtle tabletop shadow catcher under the whole cabinet
    const deskShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.25),
      new THREE.MeshBasicMaterial({ map: contactShadow(), transparent: true, opacity: 0.42, depthWrite: false })
    );
    deskShadow.rotation.x = -Math.PI / 2;
    deskShadow.position.set(0, -0.292, 0);
    this.scene.add(deskShadow);

    // Cabinet
    this.cabinet = buildCabinet();
    this.scene.add(this.cabinet.root);

    // Toys state
    this.toys = []; // [{ slot, id, toy, homePos, homeYaw, shadow }]
    this.targetId = null;

    // Claw & input state
    this.state = 'idle'; // waking | aiming | dropping | grabbing | lifting | carrying | releasing | verifying | welcome | locked
    this.stateT = 0;
    this.clawX = 0.05;
    this.clawZ = 0.0;
    this.clawDrop = CLAW_HOME_DROP;
    this.clawOpen = 0.92;
    this.inputVec = { x: 0, z: 0 };
    this.glideTarget = null;
    this.caughtItem = null;
    this.btnPress = 0;
    this.flapAngle = 0;
    this.wakeT = 0;
    this._welcomeToy = null;
    this._camZoom = 0;

    // Pointer drag / tap-to-aim on canvas
    this._raycaster = new THREE.Raycaster();
    this._floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.05);
    this._bindEvents();
    this.resize();

    // Animation loop
    this._raf = 0;
    this._paused = false;
    this._lastTime = performance.now();
    this._tick = this._tick.bind(this);
    this._raf = requestAnimationFrame(this._tick);
  }

  _bindEvents() {
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);

    this._onVis = () => {
      if (document.hidden) this.pause();
      else this.resume();
    };
    document.addEventListener('visibilitychange', this._onVis);

    const dom = this.renderer.domElement;
    let dragging = false;
    let downX = 0, downY = 0, moved = false;

    this._onPointerDown = (e) => {
      if (this.state !== 'aiming') return;
      this.audio.unlock();
      dragging = true;
      moved = false;
      downX = e.clientX; downY = e.clientY;
      dom.setPointerCapture?.(e.pointerId);
    };
    this._onPointerMove = (e) => {
      if (!dragging || this.state !== 'aiming') return;
      const dx = e.clientX - downX;
      const dy = e.clientY - downY;
      if (Math.hypot(dx, dy) > 8) {
        moved = true;
        this.onFirstAction();
        this.glideTarget = null;
        this.inputVec.x = Math.max(-1, Math.min(1, dx / 44));
        this.inputVec.z = Math.max(-1, Math.min(1, dy / 44));
      }
    };
    this._onPointerUp = (e) => {
      if (!dragging) return;
      dragging = false;
      this.inputVec.x = 0;
      this.inputVec.z = 0;
      if (!moved && this.state === 'aiming') {
        // Tap / click directly on playfield to glide claw above that toy/spot
        const rect = dom.getBoundingClientRect();
        const ndc = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        this._raycaster.setFromCamera(ndc, this.camera);
        // Check if user tapped the physical grab button
        const btnHits = this._raycaster.intersectObject(this.cabinet.grabBtn, true);
        if (btnHits.length > 0) {
          this.onFirstAction();
          this.triggerGrab();
          return;
        }
        const hitPt = new THREE.Vector3();
        if (this._raycaster.ray.intersectPlane(this._floorPlane, hitPt)) {
          if (Math.abs(hitPt.x) <= PLAYFIELD.halfX && Math.abs(hitPt.z) <= PLAYFIELD.halfZ) {
            this.onFirstAction();
            this.glideTarget = {
              x: Math.max(-X_LIMIT, Math.min(X_LIMIT, hitPt.x)),
              z: Math.max(-Z_LIMIT, Math.min(Z_LIMIT, hitPt.z)),
            };
            this.audio.tick();
          }
        }
      }
    };
    dom.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointercancel', this._onPointerUp);
  }

  resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // Frame the full Qilou cabinet (including the roof 3D showcase vitrine & bottom prize window)
    if (aspect < 0.78) {
      this.camera.fov = 38;
      this._baseCamPos = new THREE.Vector3(0, 0.56, 2.48 / Math.max(0.62, aspect * 1.15));
      this.camTarget.set(0, 0.30, 0.02);
    } else if (aspect < 1.1) {
      this.camera.fov = 36;
      this._baseCamPos = new THREE.Vector3(0, 0.56, 2.48);
      this.camTarget.set(0, 0.31, 0.02);
    } else {
      this.camera.fov = 34;
      this._baseCamPos = new THREE.Vector3(0, 0.58, 2.38);
      this.camTarget.set(0, 0.31, 0.02);
    }
    this.camera.updateProjectionMatrix();
  }

  /** Load a fresh server/mock challenge into the 3D cabinet. */
  loadChallenge(challenge) {
    this._clearToys();
    this.targetId = challenge.target;
    const entry = TOY_BY_ID[challenge.target];
    this.cabinet.setMarquee(entry, '请抓住这位伙伴 →', '← 橱窗里的伙伴');
    this.cabinet.setAttempts(challenge.attemptsLeft ?? challenge.maxAttempts ?? 5);

    // Mount live 3D target model inside the illuminated Qilou roof showcase vitrine
    this.showcaseToy = createToy(challenge.target, { reducedMotion: this.reducedMotion, seed: 999 });
    this.showcaseToy.root.scale.setScalar(1.06);
    this.showcaseToy.root.position.set(0, 0, 0);
    this.cabinet.targetTurntable.rotation.y = 0.25;
    this.cabinet.targetTurntable.add(this.showcaseToy.root);

    const shadowTex = contactShadow();
    for (const item of challenge.layout) {
      const toy = createToy(item.characterId, { reducedMotion: this.reducedMotion, seed: item.slot * 77 + 13 });
      const pos = normToWorld(item.x, item.z);
      toy.root.position.set(pos.x, PLAYFIELD.floorY, pos.z);
      toy.root.rotation.y = item.yaw;
      this.scene.add(toy.root);

      const sh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.145, 0.145),
        new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.48, depthWrite: false })
      );
      sh.rotation.x = -Math.PI / 2;
      sh.position.set(pos.x, 0.002, pos.z);
      this.scene.add(sh);

      this.toys.push({
        slot: item.slot,
        id: item.characterId,
        toy,
        homePos: new THREE.Vector3(pos.x, PLAYFIELD.floorY, pos.z),
        homeYaw: item.yaw,
        shadow: sh,
      });
    }

    this.clawX = 0.06;
    this.clawZ = -0.02;
    this.clawDrop = CLAW_HOME_DROP;
    this.clawOpen = 0.92;
    this.caughtItem = null;
    this._welcomeToy = null;
    this.flapAngle = 0;
    this._camZoom = 0;
    this.cabinet.prizeLight.intensity = 0;
    this.wakeT = 0;
    this._setState('waking');
  }

  _clearToys() {
    if (this.showcaseToy) {
      this.cabinet.targetTurntable.remove(this.showcaseToy.root);
      this.showcaseToy.dispose();
      this.showcaseToy = null;
    }
    for (const item of this.toys) {
      this.scene.remove(item.toy.root);
      this.scene.remove(item.shadow);
      item.shadow.geometry.dispose();
      item.shadow.material.dispose();
      item.toy.dispose();
    }
    this.toys = [];
  }

  setInput(x, z) {
    if (this.state !== 'aiming') return;
    if ((x || z) && !(this.inputVec.x || this.inputVec.z)) this.audio.tick();
    this.glideTarget = null;
    this.inputVec.x = x;
    this.inputVec.z = z;
  }

  setAttemptsLeft(n) {
    this.cabinet.setAttempts(n);
  }

  setReducedMotion(rm) {
    this.reducedMotion = !!rm;
    if (this.showcaseToy) this.showcaseToy.behavior.reducedMotion = this.reducedMotion;
    for (const item of this.toys) item.toy.behavior.reducedMotion = this.reducedMotion;
  }

  /** Press the brass GRAB button to drop the claw! */
  triggerGrab() {
    if (this.state !== 'aiming') return;
    this.audio.pressButton();
    this.btnPress = 1.0;
    this.inputVec.x = 0;
    this.inputVec.z = 0;
    this.glideTarget = null;
    this.caughtItem = null;
    this._setState('dropping');
  }

  _setState(next, info) {
    this.state = next;
    this.stateT = 0;
    this.onStateChange(next, info);
  }

  /** Find closest toy under the claw within PICK_RADIUS. */
  _findToyUnderClaw() {
    let best = null, bestDist = PICK_RADIUS;
    for (const item of this.toys) {
      const d = Math.hypot(item.toy.root.position.x - this.clawX, item.toy.root.position.z - this.clawZ);
      if (d < bestDist) { bestDist = d; best = item; }
    }
    return best;
  }

  _tick(now) {
    if (this._paused) return;
    this._raf = requestAnimationFrame(this._tick);
    const dt = Math.min((now - this._lastTime) / 1000, 0.1);
    this._lastTime = now;

    this._updateStateMachine(dt);
    this._updateToys(dt);
    this._updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  _updateStateMachine(dt) {
    this.stateT += dt;
    this.btnPress = Math.max(0, this.btnPress - dt * 5);
    this.cabinet.grabBtn.position.y = 0.034 - this.btnPress * 0.009;

    // Wake-up entrance (brief, crisp 0.65s cabinet settle + toys look up)
    if (this.state === 'waking') {
      this.wakeT = Math.min(1, this.stateT / (this.reducedMotion ? 0.2 : 0.65));
      const e = 1 - Math.pow(1 - this.wakeT, 3);
      this.cabinet.root.position.y = (1 - e) * -0.05;
      this.cabinet.root.rotation.y = (1 - e) * -0.08;
      if (this.wakeT >= 1) {
        this.cabinet.root.position.y = 0;
        this.cabinet.root.rotation.y = 0;
        this._setState('aiming');
      }
    }

    // Aiming: move gantry via keyboard, drag, virtual pad, or tap-to-glide
    let moving = false;
    if (this.state === 'aiming') {
      let vx = this.inputVec.x;
      let vz = this.inputVec.z;
      if (this.glideTarget) {
        const dx = this.glideTarget.x - this.clawX;
        const dz = this.glideTarget.z - this.clawZ;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.008) {
          this.clawX = this.glideTarget.x;
          this.clawZ = this.glideTarget.z;
          this.glideTarget = null;
        } else {
          vx = dx / dist;
          vz = dz / dist;
        }
      }
      if (Math.hypot(vx, vz) > 0.05) {
        moving = true;
        this.clawX = Math.max(-X_LIMIT, Math.min(X_LIMIT, this.clawX + vx * CLAW_SPEED * dt));
        this.clawZ = Math.max(-Z_LIMIT, Math.min(Z_LIMIT, this.clawZ + vz * CLAW_SPEED * dt));
      }
      // Tilt physical 3D joystick to match input
      this.cabinet.joyStick.rotation.z = THREE.MathUtils.lerp(this.cabinet.joyStick.rotation.z, -vx * 0.42, dt * 14);
      this.cabinet.joyStick.rotation.x = THREE.MathUtils.lerp(this.cabinet.joyStick.rotation.x, vz * 0.42, dt * 14);
    } else {
      this.cabinet.joyStick.rotation.z = THREE.MathUtils.lerp(this.cabinet.joyStick.rotation.z, 0, dt * 10);
      this.cabinet.joyStick.rotation.x = THREE.MathUtils.lerp(this.cabinet.joyStick.rotation.x, 0, dt * 10);
    }
    this.audio.setServo(moving);

    // Dropping the claw
    if (this.state === 'dropping') {
      const targetToy = this._findToyUnderClaw();
      const targetDrop = targetToy
        ? PLAYFIELD.ceilingY - 0.028 - targetToy.toy.rig.grabHeight - 0.065
        : PLAYFIELD.ceilingY - 0.14;
      this.clawDrop = Math.min(targetDrop, this.clawDrop + 0.58 * dt);
      this.clawOpen = THREE.MathUtils.lerp(this.clawOpen, 1.0, dt * 8);
      if (this.clawDrop >= targetDrop - 0.002) {
        this.caughtItem = targetToy;
        if (this.caughtItem) this.caughtItem.toy.behavior.play('touch');
        this.audio.clawClack(true);
        this._setState('grabbing');
      }
    }

    // Closing prongs
    if (this.state === 'grabbing') {
      this.clawOpen = Math.max(0.08, this.clawOpen - dt * 2.8);
      if (this.stateT > 0.36) {
        if (this.caughtItem) {
          this.caughtItem.toy.behavior.play('lifted');
          this.caughtItem.toy.behavior.hang.active = true;
        }
        this._setState('lifting');
      }
    }

    // Lifting back to gantry
    if (this.state === 'lifting') {
      this.clawDrop = Math.max(CLAW_HOME_DROP, this.clawDrop - 0.46 * dt);
      if (this.caughtItem) this._attachToyToClaw(this.caughtItem);
      if (this.clawDrop <= CLAW_HOME_DROP + 0.002) {
        if (this.caughtItem) {
          this._setState('carrying');
        } else {
          // Empty grab — fast, friendly return to aiming without consuming an attempt
          this.audio.gentleMiss();
          this.clawOpen = 0.92;
          this._setState('aiming', { emptyGrab: true });
        }
      }
    }

    // Carrying caught toy smoothly over to the front-left prize chute
    if (this.state === 'carrying') {
      const dx = PLAYFIELD.chuteX - this.clawX;
      const dz = PLAYFIELD.chuteZ - this.clawZ;
      const dist = Math.hypot(dx, dz);
      const step = 0.48 * dt;
      if (dist <= step) {
        this.clawX = PLAYFIELD.chuteX;
        this.clawZ = PLAYFIELD.chuteZ;
        this.audio.clawClack(false);
        this._setState('releasing');
      } else {
        this.clawX += (dx / dist) * step;
        this.clawZ += (dz / dist) * step;
      }
      if (this.caughtItem) {
        this._attachToyToClaw(this.caughtItem);
        this.caughtItem.toy.behavior.hang.swingX = Math.sin(this.stateT * 7) * 0.18;
      }
    }

    // Releasing toy into the chute & asking adapter to judge the attempt
    if (this.state === 'releasing') {
      this.clawOpen = Math.min(0.95, this.clawOpen + dt * 3.5);
      if (this.caughtItem) {
        this.caughtItem.toy.root.position.y -= 0.72 * dt;
        this.caughtItem.shadow.visible = false;
      }
      if (this.stateT > 0.42) {
        this.audio.plushThump();
        const picked = this.caughtItem;
        if (picked) {
          picked.toy.behavior.hang.active = false;
          picked.toy.root.visible = false;
        }
        this._setState('verifying', { pick: picked ? { slot: picked.slot, characterId: picked.id } : null });
        this._submitPick(picked);
      }
    }

    // Welcome story: prize window swings open, winning toy hops onto the brass ledge & waves!
    if (this.state === 'welcome') {
      const openTarget = -1.32;
      this.flapAngle = THREE.MathUtils.lerp(this.flapAngle, openTarget, dt * 6);
      this.cabinet.flapPivot.rotation.x = this.flapAngle;
      this.cabinet.prizeLight.intensity = THREE.MathUtils.lerp(this.cabinet.prizeLight.intensity, 1.4, dt * 4);
      this._camZoom = THREE.MathUtils.lerp(this._camZoom, 1, dt * 2.5);

      if (this._welcomeToy) {
        const t = Math.min(1, this.stateT / 0.65);
        const e = 1 - Math.pow(1 - t, 3);
        // emerge from inside chute cavity onto the front brass showcase ledge
        const startZ = 0.25, endZ = 0.405;
        const hopY = Math.sin(t * Math.PI) * 0.035;
        this._welcomeToy.toy.root.position.set(-0.22, -0.218 + hopY, THREE.MathUtils.lerp(startZ, endZ, e));
        this._welcomeToy.toy.root.rotation.y = THREE.MathUtils.lerp(0.4, 0.14, e);
      }
    } else {
      this.flapAngle = THREE.MathUtils.lerp(this.flapAngle, 0, dt * 6);
      this.cabinet.flapPivot.rotation.x = this.flapAngle;
      this._camZoom = THREE.MathUtils.lerp(this._camZoom, 0, dt * 4);
    }

    // Sync cabinet 3D gantry transforms
    this.cabinet.gantryZ.position.z = this.clawZ;
    this.cabinet.trolley.position.x = this.clawX;
    this.cabinet.setClawDrop(this.clawDrop);
    this.cabinet.setClawOpen(this.clawOpen);
    this.cabinet.targetRing.position.set(this.clawX, 0.004, this.clawZ);
    this.cabinet.targetRing.visible = this.state === 'aiming';
    if (this.cabinet.targetRing.visible) {
      const overToy = !!this._findToyUnderClaw();
      this.cabinet.targetRing.material.color.set(overToy ? '#9be090' : '#ffdf8c');
      const pulse = 1 + Math.sin(performance.now() * 0.006) * 0.06;
      this.cabinet.targetRing.scale.setScalar(overToy ? pulse * 1.12 : pulse);
    }
  }

  _attachToyToClaw(item) {
    const clawTipY = PLAYFIELD.ceilingY - 0.028 - this.clawDrop - 0.068;
    item.toy.root.position.set(this.clawX, Math.max(PLAYFIELD.floorY, clawTipY - item.toy.rig.grabHeight + 0.03), this.clawZ);
    item.shadow.position.set(this.clawX, 0.002, this.clawZ);
    const heightNorm = Math.min(1, item.toy.root.position.y / 0.35);
    item.shadow.scale.setScalar(1 - heightNorm * 0.35);
    item.shadow.material.opacity = 0.48 * (1 - heightNorm * 0.6);
  }

  async _submitPick(picked) {
    if (!picked) {
      this._setState('aiming');
      return;
    }
    try {
      const result = await this.onDropComplete({ slot: picked.slot, characterId: picked.id });
      if (result?.status === 'passed') {
        // Trigger the miniature world welcome story!
        this.audio.welcomeChime();
        this._welcomeToy = picked;
        picked.toy.root.visible = true;
        picked.toy.behavior.holdCelebrate = true;
        picked.toy.behavior.play('celebrate');
        const entry = TOY_BY_ID[picked.id];
        this.cabinet.setMarquee(entry, '欢迎来到海南中学', '← 今日迎新伙伴');
        if (this.showcaseToy) this.showcaseToy.behavior.play('celebrate');
        // All remaining toys inside the cabinet cheer too!
        for (const other of this.toys) {
          if (other !== picked) {
            other.toy.behavior.play('celebrate');
          }
        }
        this._setState('welcome', { result, character: entry });
      } else {
        // Return the wrong toy gently to its spot with a soft bounce so retry is instant
        this.audio.gentleMiss();
        picked.toy.root.visible = true;
        picked.toy.root.position.copy(picked.homePos);
        picked.toy.root.rotation.y = picked.homeYaw;
        picked.shadow.visible = true;
        picked.shadow.position.set(picked.homePos.x, 0.002, picked.homePos.z);
        picked.shadow.scale.setScalar(1);
        picked.shadow.material.opacity = 0.48;
        picked.toy.behavior.play('land');
        this.caughtItem = null;
        if (typeof result?.attemptsLeft === 'number') this.setAttemptsLeft(result.attemptsLeft);
        if (result?.status === 'exhausted' || result?.status === 'expired') {
          this._setState('locked', { result });
        } else {
          this._setState('aiming', { result });
        }
      }
    } catch {
      picked.toy.root.visible = true;
      picked.toy.root.position.copy(picked.homePos);
      picked.shadow.visible = true;
      this.caughtItem = null;
      this._setState('aiming');
    }
  }

  _updateToys(dt) {
    // Slowly rotate the live 3D target character inside the Qilou roof showcase vitrine
    if (this.showcaseToy) {
      const spinSpeed = this.reducedMotion ? 0.14 : 0.55;
      this.cabinet.targetTurntable.rotation.y += spinSpeed * dt;
      this.showcaseToy.behavior.update(dt);
    }

    const clawWorld = new THREE.Vector3(this.clawX, PLAYFIELD.ceilingY - 0.028 - this.clawDrop - 0.06, this.clawZ);
    const localLook = new THREE.Vector3();
    for (const item of this.toys) {
      if (!item.toy.root.visible) continue;
      if (this.state === 'aiming' && item !== this.caughtItem) {
        const d = Math.hypot(item.toy.root.position.x - this.clawX, item.toy.root.position.z - this.clawZ);
        if (d < 0.28) {
          localLook.copy(clawWorld).sub(item.toy.root.position);
          localLook.applyAxisAngle(new THREE.Vector3(0, 1, 0), -item.toy.root.rotation.y);
          item.toy.behavior.setLookLocal(localLook);
        } else {
          item.toy.behavior.setLookLocal(null);
        }
      } else if (this.state === 'welcome' && item !== this._welcomeToy) {
        // Remaining toys look toward the prize chute window to wave goodbye/welcome
        localLook.set(PLAYFIELD.chuteX, 0.12, PLAYFIELD.chuteZ + 0.2).sub(item.toy.root.position);
        localLook.applyAxisAngle(new THREE.Vector3(0, 1, 0), -item.toy.root.rotation.y);
        item.toy.behavior.setLookLocal(localLook);
      } else {
        item.toy.behavior.setLookLocal(null);
      }
      item.toy.behavior.update(dt);
    }
  }

  _updateCamera(dt) {
    if (!this._baseCamPos) return;
    // Gently dolly in toward the prize showcase window during the welcome story
    const desiredPos = this._baseCamPos.clone();
    const desiredTarget = this.camTarget.clone();
    if (this._camZoom > 0.001) {
      const z = this._camZoom;
      desiredPos.lerp(new THREE.Vector3(-0.22, -0.02, 1.05), z * 0.72);
      desiredTarget.lerp(new THREE.Vector3(-0.2, -0.11, 0.34), z * 0.8);
    }
    this.camera.position.lerp(desiredPos, Math.min(1, dt * 6));
    this.camera.lookAt(desiredTarget);
  }

  pause() {
    this._paused = true;
    cancelAnimationFrame(this._raf);
    this.audio.setServo(false);
  }

  resume() {
    if (!this._paused) return;
    this._paused = false;
    this._lastTime = performance.now();
    this._raf = requestAnimationFrame(this._tick);
  }

  dispose() {
    this.pause();
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVis);
    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('pointercancel', this._onPointerUp);
    this._clearToys();
    this.cabinet.dispose();
    this._envRT?.dispose();
    this.audio.dispose();
    this.renderer.dispose();
    dom.remove();
  }
}
