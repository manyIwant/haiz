// HAIZ 动物验证码 · 抓娃娃机三维场景
// 继承 PR #113 的正面玩偶柜构图、顶部横轨、弹簧吊臂、三爪机械爪与左侧投放口，
// 替换为六款原创毛绒动物玩偶（黄鸭子 / 黑白熊猫 / 橙色狐狸 / 绿色青蛙 / 粉色小猪 / 浅蓝色大象），
// 完成逐玩偶尺寸、抓取高度、碰撞范围、摇摆物理、投放与模型缓存优化。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { resolveAnimal } from './animals/catalog.js';

const MODEL_BASE = new URL('../assets/models/', import.meta.url);

// 跨回合缓存原始 GLB 二进制，重开/换局时毫秒级复用，避免重复网络加载
const GLB_BUFFER_CACHE = new Map();

async function fetchModelBuffer(modelFile) {
  let pending = GLB_BUFFER_CACHE.get(modelFile);
  if (!pending) {
    const url = new URL(modelFile, MODEL_BASE).href;
    pending = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`Failed to load model ${modelFile}: HTTP ${r.status}`);
      return r.arrayBuffer();
    });
    GLB_BUFFER_CACHE.set(modelFile, pending);
  }
  return pending;
}

// 场景坐标（单位：玩偶约 1.0 高）
export const GEOM = Object.freeze({
  railY: 2.94,
  restHubY: 2.30,
  chuteX: -1.68,
  chuteHalf: 0.35,
  minX: -1.72,
  maxX: 1.78,
  slotStart: -0.94,
  slotStep: 0.54,
  grabRadius: 0.28,
});

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function tween(ms, step, reduced) {
  const dur = reduced ? Math.min(ms, 150) : ms;
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
  fingerShape.quadraticCurveTo(0.095, -0.12, 0.055, -0.28);
  fingerShape.lineTo(0.015, -0.31);
  fingerShape.lineTo(0.032, -0.265);
  fingerShape.quadraticCurveTo(0.065, -0.13, -0.02, -0.02);
  fingerShape.closePath();
  const fingerGeo = new THREE.ExtrudeGeometry(fingerShape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelSize: 0.006,
    bevelThickness: 0.006,
    bevelSegments: 2,
  });
  fingerGeo.translate(0, 0, -0.011);
  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / 3) * Math.PI * 2 + Math.PI / 2;
    const f = new THREE.Group();
    f.position.set(0.058, -0.03, 0);
    f.add(new THREE.Mesh(fingerGeo, steel));
    pivot.add(f);
    hub.add(pivot);
    fingers.push(f);
  }
  root.add(hub);

  const rope = new THREE.Group(); // 用于挂玩偶与微幅惯性摆动
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
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 40);
    this.camera.position.set(0, 1.56, 7.5);
    this.camera.lookAt(0, 1.42, 0);

    this.scene.add(new THREE.HemisphereLight(0xfffaf2, 0xd9d2c4, 1.55));
    const sun = new THREE.DirectionalLight(0xfff4e2, 2.05);
    sun.position.set(2.2, 5.2, 4.2);
    sun.castShadow = true;
    const shadowSize = (window.innerWidth || 800) < 520 ? 512 : 1024;
    sun.shadow.mapSize.set(shadowSize, shadowSize);
    Object.assign(sun.shadow.camera, { left: -3.2, right: 3.2, top: 3.2, bottom: -1, near: 1, far: 14 });
    sun.shadow.radius = 5;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xe6f0ea, 0.65);
    fill.position.set(-3, 2.2, 3);
    this.scene.add(fill);

    // 地面：只接受阴影，颜色由 CSS 背景提供
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), new THREE.ShadowMaterial({ opacity: 0.16 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // 爪子正下方的柔和落点指示光晕（移动端帮助快速对齐，极淡不抢戏）
    this.aimMat = new THREE.MeshBasicMaterial({ color: 0x3f7a52, transparent: true, opacity: 0.1, depthWrite: false });
    this.aimDot = new THREE.Mesh(new THREE.RingGeometry(0.09, 0.145, 28), this.aimMat);
    this.aimDot.rotation.x = -Math.PI / 2;
    this.aimDot.position.set(0.4, 0.003, 0.05);
    this.scene.add(this.aimDot);

    // 横轨
    const railMat = new THREE.MeshStandardMaterial({ color: 0xd4d6d1, metalness: 0.8, roughness: 0.3 });
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 4.4, 12), railMat);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, GEOM.railY + 0.05, 0);
    this.scene.add(rail);

    // 投放口：一圈深色开口 + 可点亮的边
    const chute = new THREE.Group();
    chute.position.set(GEOM.chuteX, 0.004, 0.2);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.28, 40), new THREE.MeshBasicMaterial({ color: 0x2c312d }));
    hole.rotation.x = -Math.PI / 2;
    chute.add(hole);
    this.chuteRingMat = new THREE.MeshStandardMaterial({
      color: 0xb9b2a3,
      metalness: 0.6,
      roughness: 0.35,
      emissive: 0x000000,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.295, 0.026, 10, 48), this.chuteRingMat);
    ring.rotation.x = -Math.PI / 2;
    chute.add(ring);
    this.scene.add(chute);

    this.claw = buildClaw();
    this.scene.add(this.claw.root);
    this.clawX = 0.4;
    this._prevClawX = 0.4;
    this._swayAngle = 0;
    this._swayVel = 0;
    this.hubY = GEOM.restHubY;
    this.open = 0.56;
    this.held = null;
    this.toys = [];
    this.mixers = [];
    this.clock = new THREE.Clock();
    this._running = false;
    this._raf = 0;
    this._loader = new GLTFLoader();
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
    // 窄屏时拉远一点，保证左侧投放口与六只动物玩偶都在画面内且左右留白舒适
    const needHalfWidth = 2.34;
    const halfH = needHalfWidth / this.camera.aspect;
    const dist = Math.max(7.6, halfH / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
    this.camera.position.set(0, 1.56, dist);
    this.camera.lookAt(0, 1.42, 0);
    this.camera.updateProjectionMatrix();
    this.render();
  }

  /** 按服务端下发的布局摆放六只动物玩偶。layout: [{slot, characterId, x, z, yaw}] */
  async loadLayout(layout) {
    this._clearToys();
    const ordered = [...layout].sort((a, b) => a.x - b.x);
    const loaded = await Promise.all(
      ordered.map(async (item) => {
        const animal = resolveAnimal(item.characterId);
        const buf = await fetchModelBuffer(animal.modelFile);
        const g = await this._loader.parseAsync(buf.slice(0), '');
        return { item, animal, g };
      })
    );

    loaded.forEach(({ item, animal, g }, i) => {
      const model = g.scene;
      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const targetH = animal.visualHeight;
      const s = targetH / Math.max(size.y, 1e-3);
      model.scale.setScalar(s);
      model.position.y = -box.min.y * s;

      const root = new THREE.Group();
      root.add(model);

      const x = GEOM.slotStart + i * GEOM.slotStep;
      // 前后轻微错落，既显饱满又避免大象耳朵、狐狸尾巴与邻近玩偶穿模
      const staggerZ = i % 2 === 0 ? -0.10 : 0.12;
      const z = staggerZ + clamp(item.z || 0, -1, 1) * 0.08;
      root.position.set(x, 0, z);
      root.rotation.y = clamp(item.yaw || 0, -0.5, 0.5) * 0.36;
      this.scene.add(root);

      const mixer = new THREE.AnimationMixer(model);
      const clips = Object.fromEntries(g.animations.map((c) => [c.name, c]));
      const toy = {
        slot: item.slot,
        characterId: item.characterId,
        animalId: animal.id,
        animal,
        height: targetH,
        grabY: targetH * animal.grabHeightRatio,
        grabRadius: animal.grabRadius || GEOM.grabRadius,
        root,
        model,
        mixer,
        clips,
        home: root.position.clone(),
        homeYaw: root.rotation.y,
        action: null,
      };
      this._play(toy, 'idle', true);
      mixer.setTime((i * 0.37) % 2.4);
      this.toys.push(toy);
      this.mixers.push(mixer);
    });
    this._updateAimDot();
    this.render();
  }

  _clearToys() {
    for (const t of this.toys) {
      if (t.root.parent) t.root.parent.remove(t.root);
      t.root.traverse((o) => {
        if (o.isMesh) {
          o.geometry?.dispose?.();
          const m = o.material;
          if (m) (Array.isArray(m) ? m : [m]).forEach((x) => {
            for (const k in x) if (x[k]?.isTexture) x[k].dispose();
            x.dispose();
          });
        }
      });
    }
    this.toys = [];
    this.mixers = [];
    this.held = null;
  }

  _play(toy, name, loop = false) {
    const clip = toy.clips[name] || toy.clips.idle;
    if (!clip) return;
    const next = toy.mixer.clipAction(clip);
    next.reset();
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = !loop;
    if (toy.action && toy.action !== next) next.crossFadeFrom(toy.action, 0.22, false);
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
    this._updateAimDot();
  }

  overChute() {
    return Math.abs(this.clawX - GEOM.chuteX) < GEOM.chuteHalf;
  }

  setChuteGlow(on) {
    this.chuteRingMat.emissive.setHex(on ? 0x4f8a5b : 0x000000);
    this.chuteRingMat.emissiveIntensity = on ? 0.95 : 0;
  }

  toyUnderClaw() {
    let best = null;
    let bestD = Infinity;
    for (const t of this.toys) {
      if (t === this.held || !t.root.visible) continue;
      const d = Math.abs(t.root.position.x - this.clawX);
      if (d <= t.grabRadius && d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  /** 屏幕坐标（相对 canvas）→ 场景 x（与玩偶所在竖直面 z=0 求交），用于直接拖动或点击画面 */
  screenToX(px, py) {
    const ndc = new THREE.Vector2(
      (px / (this.canvas.clientWidth || 1)) * 2 - 1,
      -(py / (this.canvas.clientHeight || 1)) * 2 + 1
    );
    this._ray ??= new THREE.Raycaster();
    this._ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    return this._ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit) ? hit.x : this.clawX;
  }

  _updateAimDot() {
    if (!this.aimDot) return;
    if (this.held) {
      this.aimDot.visible = false;
      return;
    }
    const over = this.toyUnderClaw();
    this.aimDot.visible = true;
    this.aimDot.position.x = over ? over.root.position.x : this.clawX;
    this.aimDot.position.z = over ? over.root.position.z : 0.04;
    this.aimMat.color.setHex(over ? 0x3f7a52 : 0x8a8578);
    this.aimMat.opacity = over ? 0.22 : 0.09;
  }

  _applyClaw() {
    const c = this.claw;
    c.root.position.x = this.clawX;
    const len = GEOM.railY - 0.08 - (this.hubY + 0.085);
    c.spring.scale.y = Math.max(0.05, len);
    c.hub.position.y = this.hubY;
    for (const f of c.fingers) f.rotation.z = 0.08 + this.open * 0.56;
  }

  /** 放下爪子 → 合拢并平滑抱紧目标动物 → 升起。返回抓住的玩偶（或 null）。 */
  async dropAndGrab() {
    const target = this.toyUnderClaw();
    const bottomY = target ? target.grabY + 0.24 : 0.44;
    const fromY = this.hubY;
    this.aimDot.visible = false;

    await tween(840, (k) => {
      this.hubY = fromY + (bottomY - fromY) * k;
      this._applyClaw();
    }, this.reduced);

    if (target) this._play(target, 'touch');

    const startX = target ? target.root.position.x : 0;
    const startZ = target ? target.root.position.z : 0;
    const startYaw = target ? target.root.rotation.y : 0;

    await tween(360, (k) => {
      this.open = 0.56 - 0.50 * k;
      this._applyClaw();
      // 合拢时平滑将玩偶向爪心靠拢，避免瞬间跳变
      if (target) {
        target.root.position.x = startX + (this.clawX - startX) * k;
        target.root.position.z = startZ * (1 - k);
        target.root.rotation.y = startYaw * (1 - k);
      }
    }, this.reduced);

    if (target) {
      this.held = target;
      target.root.position.set(0, -target.grabY + 0.02, 0);
      target.root.rotation.set(0, 0, 0);
      this.claw.rope.rotation.z = 0;
      this.claw.rope.add(target.root);
      this._play(target, 'lifted', true);
    }

    await tween(780, (k) => {
      this.hubY = bottomY + (GEOM.restHubY - bottomY) * k;
      this._applyClaw();
    }, this.reduced);

    if (!target) {
      await tween(240, (k) => {
        this.open = 0.06 + 0.50 * k;
        this._applyClaw();
      }, this.reduced);
      this._updateAimDot();
    }
    return target;
  }

  /** 在投放口松爪，玩偶落入投放口。 */
  async release() {
    const toy = this.held;
    await tween(240, (k) => {
      this.open = 0.06 + 0.50 * k;
      this._applyClaw();
    }, this.reduced);
    if (!toy) return;
    const world = new THREE.Vector3();
    toy.root.getWorldPosition(world);
    this.claw.rope.remove(toy.root);
    this.claw.rope.rotation.z = 0;
    this.scene.add(toy.root);
    toy.root.position.copy(world);
    toy.root.rotation.set(0, 0, 0);
    const x0 = world.x;
    const y0 = world.y;
    const z0 = world.z;
    await tween(580, (k, t) => {
      toy.root.position.x = x0 + (GEOM.chuteX - x0) * Math.min(1, t * 1.4);
      toy.root.position.z = z0 + (0.2 - z0) * Math.min(1, t * 1.4);
      toy.root.position.y = y0 - (y0 + 0.85) * (t * t);
      const s = 1 - Math.max(0, t - 0.52) * 1.7;
      toy.root.scale.setScalar(Math.max(0.05, s));
    }, this.reduced);
    toy.root.visible = false;
    this.held = null;
    this._updateAimDot();
  }

  /** 抓错时让玩偶带着缓冲动画回到原位。 */
  async returnToy(toy) {
    if (!toy) return;
    if (toy.root.parent !== this.scene) {
      this.claw.rope.remove(toy.root);
      this.scene.add(toy.root);
    }
    toy.root.visible = true;
    toy.root.scale.setScalar(1);
    toy.root.position.set(toy.home.x, 2.15, toy.home.z);
    toy.root.rotation.set(0, toy.homeYaw, 0);
    await tween(500, (k, t) => {
      toy.root.position.y = 2.15 * (1 - t * t);
    }, this.reduced);
    toy.root.position.y = 0;
    this._play(toy, 'land');
    if (this.held === toy) this.held = null;
    this._updateAimDot();
  }

  async home() {
    const from = this.clawX;
    await tween(460, (k) => this.setClawX(from + (0.4 - from) * k), this.reduced);
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
      // 吊起动物移动时的柔和钟摆惯性
      if (this.held && !this.reduced) {
        const dx = this.clawX - this._prevClawX;
        const targetSway = clamp(-dx * 3.8, -0.22, 0.22);
        const acc = (targetSway - this._swayAngle) * 34 - this._swayVel * 7.5;
        this._swayVel += acc * dt;
        this._swayAngle += this._swayVel * dt;
        this.claw.rope.rotation.z = this._swayAngle;
      } else {
        this._swayAngle = 0;
        this._swayVel = 0;
        this.claw.rope.rotation.z = 0;
      }
      this._prevClawX = this.clawX;
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
    this._clearToys();
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
