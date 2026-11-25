// HAIZ 验证器 · 抓娃娃机三维场景
// 正面视角的小型玩偶柜：顶部横轨、弹簧吊臂、三爪机械爪、左侧投放口、六位 HAIZ 原创玩偶。
// 只负责画面与动画；“抓到了谁”交给 verifier.js，“算不算通过”交给服务端。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL_BASE = new URL('../../../haiz-campus-toybox-original/assets/models/', import.meta.url);

// 场景坐标（单位：玩偶约 0.9 高）
export const GEOM = Object.freeze({
  railY: 2.92,
  restHubY: 2.28,
  chuteX: -1.56,
  chuteHalf: 0.3,
  minX: -1.6,
  maxX: 1.66,
  toyHeight: 1.08,
  slotStart: -0.86,
  slotStep: 0.5,
  grabRadius: 0.22,
});

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function tween(ms, step, reduced) {
  const dur = reduced ? Math.min(ms, 160) : ms;
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = (now) => {
      const t = clamp((now - t0) / dur, 0, 1);
      step(ease(t), t);
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

function makeSpringGeometry() {
  // 单位长度的螺旋，沿 -Y 方向；伸缩时只缩放 y。
  const turns = 14;
  const pts = [];
  for (let i = 0; i <= turns * 24; i++) {
    const t = i / (turns * 24);
    const a = t * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * 0.055, -t, Math.sin(a) * 0.055));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 24, 0.011, 6, false);
}

function buildClaw() {
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9ccc8, metalness: 0.85, roughness: 0.32 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3b403c, metalness: 0.4, roughness: 0.5 });
  const clay = new THREE.MeshStandardMaterial({ color: 0xc8553d, metalness: 0.1, roughness: 0.45 });

  const root = new THREE.Group();

  const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.11, 0.16), steel);
  carriage.position.y = GEOM.railY - 0.02;
  root.add(carriage);
  for (const sx of [-0.07, 0.07]) {
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 16), dark);
    eye.rotation.x = Math.PI / 2;
    eye.position.set(sx, GEOM.railY - 0.02, 0.085);
    root.add(eye);
  }

  const spring = new THREE.Mesh(makeSpringGeometry(), steel);
  spring.position.y = GEOM.railY - 0.08;
  root.add(spring);

  const hub = new THREE.Group();
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 24), clay);
  collar.position.y = 0.06;
  hub.add(collar);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.07, 24), steel);
  hub.add(body);

  const fingers = [];
  const fingerShape = new THREE.Shape();
  fingerShape.moveTo(0, 0);
  fingerShape.quadraticCurveTo(0.09, -0.12, 0.05, -0.27);
  fingerShape.lineTo(0.015, -0.3);
  fingerShape.lineTo(0.03, -0.26);
  fingerShape.quadraticCurveTo(0.06, -0.13, -0.02, -0.02);
  fingerShape.closePath();
  const fingerGeo = new THREE.ExtrudeGeometry(fingerShape, { depth: 0.022, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2 });
  fingerGeo.translate(0, 0, -0.011);
  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / 3) * Math.PI * 2 + Math.PI / 2;
    const f = new THREE.Group();
    f.position.set(0.055, -0.03, 0);
    f.add(new THREE.Mesh(fingerGeo, steel));
    pivot.add(f);
    hub.add(pivot);
    fingers.push(f);
  }
  root.add(hub);

  const rope = new THREE.Group(); // 用于挂玩偶
  rope.position.y = -0.24;
  hub.add(rope);

  return { root, carriage, spring, hub, fingers, rope };
}

export class ClawScene {
  constructor(canvas, { reducedMotion = false } = {}) {
    this.canvas = canvas;
    this.reduced = reducedMotion;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 40);
    this.camera.position.set(0, 1.55, 7.2);
    this.camera.lookAt(0, 1.42, 0);

    this.scene.add(new THREE.HemisphereLight(0xfffaf0, 0xd9d2c4, 1.5));
    const sun = new THREE.DirectionalLight(0xfff3e0, 2.1);
    sun.position.set(2.2, 5, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -1, near: 1, far: 14 });
    sun.shadow.radius = 6;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xe6f0ea, 0.6);
    fill.position.set(-3, 2, 3);
    this.scene.add(fill);

    // 地面：只接受阴影，颜色由 CSS 背景提供
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), new THREE.ShadowMaterial({ opacity: 0.16 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // 横轨
    const railMat = new THREE.MeshStandardMaterial({ color: 0xd4d6d1, metalness: 0.8, roughness: 0.3 });
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 4.2, 12), railMat);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, GEOM.railY + 0.05, 0);
    this.scene.add(rail);

    // 投放口：一圈深色开口 + 可点亮的边
    const chute = new THREE.Group();
    chute.position.set(GEOM.chuteX, 0.004, 0.2);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.27, 40), new THREE.MeshBasicMaterial({ color: 0x2c312d }));
    hole.rotation.x = -Math.PI / 2;
    chute.add(hole);
    this.chuteRingMat = new THREE.MeshStandardMaterial({ color: 0xb9b2a3, metalness: 0.6, roughness: 0.35, emissive: 0x000000 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.025, 10, 48), this.chuteRingMat);
    ring.rotation.x = -Math.PI / 2;
    chute.add(ring);
    this.scene.add(chute);

    this.claw = buildClaw();
    this.scene.add(this.claw.root);
    this.clawX = 0.4;
    this.hubY = GEOM.restHubY;
    this.open = 0.55;
    this.held = null;
    this.toys = [];
    this.mixers = [];
    this.clock = new THREE.Clock();
    this._running = false;
    this._raf = 0;
    this._applyClaw();

    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(canvas);
    this.resize();

    this._onVis = () => (document.hidden ? this.stop() : this.start());
    document.addEventListener('visibilitychange', this._onVis);
  }

  resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // 窄屏时拉远一点，保证投放口和最右侧玩偶都在画面内
    const needHalfWidth = 2.12;
    const halfH = needHalfWidth / this.camera.aspect;
    const dist = Math.max(7.2, halfH / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
    this.camera.position.set(0, 1.55, dist);
    this.camera.lookAt(0, 1.42, 0);
    this.camera.updateProjectionMatrix();
    this.render();
  }

  /** 按服务端下发的布局摆放玩偶。layout: [{slot, characterId, x, z, yaw}] */
  async loadLayout(layout) {
    for (const t of this.toys) this.scene.remove(t.root);
    this.toys = [];
    this.mixers = [];
    const loader = new GLTFLoader();
    const ordered = [...layout].sort((a, b) => a.x - b.x);
    const loaded = await Promise.all(
      ordered.map((item) => loader.loadAsync(new URL(`${item.characterId}.glb`, MODEL_BASE).href).then((g) => ({ item, g })))
    );
    loaded.forEach(({ item, g }, i) => {
      const model = g.scene;
      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const s = GEOM.toyHeight / Math.max(size.y, 1e-3);
      model.scale.setScalar(s);
      model.position.y = -box.min.y * s;
      const root = new THREE.Group();
      root.add(model);
      const x = GEOM.slotStart + i * GEOM.slotStep;
      const z = clamp(item.z, -1, 1) * 0.28 - 0.05 + (i % 2) * 0.14;
      root.position.set(x, 0, z);
      root.rotation.y = clamp(item.yaw, -0.6, 0.6) * 0.5;
      this.scene.add(root);
      const mixer = new THREE.AnimationMixer(model);
      const clips = Object.fromEntries(g.animations.map((c) => [c.name, c]));
      const toy = { slot: item.slot, characterId: item.characterId, root, model, mixer, clips, home: root.position.clone(), homeYaw: root.rotation.y, action: null };
      this._play(toy, 'idle', true);
      mixer.setTime(Math.random() * 2);
      this.toys.push(toy);
      this.mixers.push(mixer);
    });
    this.render();
  }

  _play(toy, name, loop = false) {
    const clip = toy.clips[name] || toy.clips.idle;
    if (!clip) return;
    const next = toy.mixer.clipAction(clip);
    next.reset();
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = !loop;
    if (toy.action && toy.action !== next) next.crossFadeFrom(toy.action, 0.25, false);
    next.play();
    toy.action = next;
    if (!loop) {
      const back = (e) => {
        if (e.action !== next) return;
        toy.mixer.removeEventListener('finished', back);
        if (toy.action === next) this._play(toy, 'idle', true);
      };
      toy.mixer.addEventListener('finished', back);
    }
  }

  setClawX(x) {
    this.clawX = clamp(x, GEOM.minX, GEOM.maxX);
    this._applyClaw();
  }

  overChute() {
    return Math.abs(this.clawX - GEOM.chuteX) < GEOM.chuteHalf;
  }

  setChuteGlow(on) {
    this.chuteRingMat.emissive.setHex(on ? 0x4f8a5b : 0x000000);
    this.chuteRingMat.emissiveIntensity = on ? 0.9 : 0;
  }

  toyUnderClaw() {
    let best = null;
    let bestD = Infinity;
    for (const t of this.toys) {
      if (t === this.held || !t.root.visible) continue;
      const d = Math.abs(t.root.position.x - this.clawX);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return bestD <= GEOM.grabRadius ? best : null;
  }

  /** 屏幕坐标（相对 canvas）→ 场景 x（与玩偶所在竖直面 z=0 求交），用于直接拖动画面 */
  screenToX(px, py) {
    const ndc = new THREE.Vector2((px / (this.canvas.clientWidth || 1)) * 2 - 1, -(py / (this.canvas.clientHeight || 1)) * 2 + 1);
    this._ray ??= new THREE.Raycaster();
    this._ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    return this._ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit) ? hit.x : this.clawX;
  }

  _applyClaw() {
    const c = this.claw;
    c.root.position.x = this.clawX;
    const len = GEOM.railY - 0.08 - (this.hubY + 0.085);
    c.spring.scale.y = Math.max(0.05, len);
    c.hub.position.y = this.hubY;
    for (const f of c.fingers) f.rotation.z = 0.1 + this.open * 0.55;
  }

  /** 放下爪子 → 合拢 → 升起。返回抓住的玩偶（或 null）。 */
  async dropAndGrab() {
    const target = this.toyUnderClaw();
    const bottomY = target ? GEOM.toyHeight * 0.82 + 0.24 : 0.42;
    const from = this.hubY;
    await tween(900, (k) => {
      this.hubY = from + (bottomY - from) * k;
      this._applyClaw();
    }, this.reduced);
    if (target) this._play(target, 'touch');
    await tween(380, (k) => {
      this.open = 0.55 - 0.5 * k;
      this._applyClaw();
    }, this.reduced);
    if (target) {
      this.held = target;
      target.root.position.x = 0;
      target.root.position.z = 0;
      target.root.position.y = -GEOM.toyHeight * 0.82 + 0.02;
      target.root.rotation.y = 0;
      this.claw.rope.add(target.root);
      this._play(target, 'lifted', true);
    }
    await tween(820, (k) => {
      this.hubY = bottomY + (GEOM.restHubY - bottomY) * k;
      this._applyClaw();
    }, this.reduced);
    if (!target) {
      await tween(260, (k) => {
        this.open = 0.05 + 0.5 * k;
        this._applyClaw();
      }, this.reduced);
    }
    return target;
  }

  /** 在投放口松爪，玩偶落入。 */
  async release() {
    const toy = this.held;
    await tween(260, (k) => {
      this.open = 0.05 + 0.5 * k;
      this._applyClaw();
    }, this.reduced);
    if (!toy) return;
    const world = new THREE.Vector3();
    toy.root.getWorldPosition(world);
    this.claw.rope.remove(toy.root);
    this.scene.add(toy.root);
    toy.root.position.copy(world);
    const y0 = world.y;
    await tween(620, (k, t) => {
      toy.root.position.y = y0 - (y0 + 0.9) * (t * t);
      const s = 1 - Math.max(0, t - 0.55) * 1.6;
      toy.root.scale.setScalar(Math.max(0.05, s));
    }, this.reduced);
    toy.root.visible = false;
    this.held = null;
  }

  /** 抓错时让玩偶回到原位。 */
  async returnToy(toy) {
    if (!toy) return;
    if (toy.root.parent !== this.scene) {
      this.claw.rope.remove(toy.root);
      this.scene.add(toy.root);
    }
    toy.root.visible = true;
    toy.root.scale.setScalar(1);
    toy.root.position.set(toy.home.x, 2.2, toy.home.z);
    toy.root.rotation.y = toy.homeYaw;
    await tween(520, (k, t) => {
      toy.root.position.y = 2.2 * (1 - t * t);
    }, this.reduced);
    toy.root.position.y = 0;
    this._play(toy, 'land');
    if (this.held === toy) this.held = null;
  }

  async home() {
    const from = this.clawX;
    await tween(500, (k) => this.setClawX(from + (0.4 - from) * k), this.reduced);
  }

  celebrate() {
    for (const t of this.toys) if (t.root.visible) this._play(t, 'celebrate');
  }

  start() {
    if (this._running || document.hidden) return;
    this._running = true;
    this.clock.getDelta();
    const loop = () => {
      if (!this._running) return;
      const dt = Math.min(0.05, this.clock.getDelta());
      for (const m of this.mixers) m.update(dt);
      this.render();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    this._running = false;
    cancelAnimationFrame(this._raf);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.stop();
    this._ro.disconnect();
    document.removeEventListener('visibilitychange', this._onVis);
    this.scene.traverse((o) => {
      o.geometry?.dispose?.();
      const m = o.material;
      if (m) (Array.isArray(m) ? m : [m]).forEach((x) => {
        for (const k in x) if (x[k]?.isTexture) x[k].dispose();
        x.dispose();
      });
    });
    this.renderer.dispose();
  }
}
