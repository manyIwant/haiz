// HAIZ 实验册 · 舞台
// 桌面、摊开的书、光影，以及把白模画成墨线图的后期：
//   1) 正常上色（带阴影）  2) 实体的法线+深度  3) 玻璃的法线+深度  4) 合成：描边 + 排线
import * as THREE from 'three';
import { L, C, disposeTree } from './ink.js';

THREE.ColorManagement.enabled = false;

export const PW = 10, PH = 13.4, PXU = 54; // 页宽、页高（书本单位）；书页 DOM 每单位像素数
const LIGHT = new THREE.Vector3(-0.55, 0.78, -0.3).normalize();
const DESK = '#d9d3c2';

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
const FRAG = `
precision highp float;
uniform sampler2D tColor, tNA, tDA, tNB, tDB;
uniform vec2 px; uniform float near, far, thick, dpr;
uniform vec3 lightV, ink;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
float vz(float d){ return near * far / (far - d * (far - near)); }
float edges(sampler2D tn, sampler2D td, vec2 uv, vec2 o, out vec4 c){
  c = texture2D(tn, uv);
  vec4 a = texture2D(tn, uv + vec2(o.x, 0.)), b = texture2D(tn, uv - vec2(o.x, 0.));
  vec4 e = texture2D(tn, uv + vec2(0., o.y)), f = texture2D(tn, uv - vec2(0., o.y));
  float dc = texture2D(td, uv).x;
  float d1 = texture2D(td, uv + vec2(o.x, 0.)).x, d2 = texture2D(td, uv - vec2(o.x, 0.)).x;
  float d3 = texture2D(td, uv + vec2(0., o.y)).x, d4 = texture2D(td, uv - vec2(0., o.y)).x;
  float z = vz(min(dc, min(min(d1, d2), min(d3, d4))));
  float k = (far - near) * z * z / (near * far);
  float lap = (abs(d1 + d2 - 2. * dc) + abs(d3 + d4 - 2. * dc)) * k;
  float de = smoothstep(.05, .15, lap);
  vec3 n = c.xyz * 2. - 1.;
  float nd = max(max(1. - dot(n, a.xyz * 2. - 1.), 1. - dot(n, b.xyz * 2. - 1.)),
                 max(1. - dot(n, e.xyz * 2. - 1.), 1. - dot(n, f.xyz * 2. - 1.)));
  float ne = smoothstep(.16, .46, nd);
  float amax = max(c.a, max(max(a.a, b.a), max(e.a, f.a)));
  float amin = min(c.a, min(min(a.a, b.a), min(e.a, f.a)));
  float ae = smoothstep(.12, .6, amax - amin);
  return max(max(de, ne) * step(.5, amax), ae);
}
void main(){
  vec2 fc = gl_FragCoord.xy / dpr;
  vec2 wob = (vec2(vn(fc * .09), vn(fc * .09 + 31.7)) - .5) * px * dpr * 1.7;
  vec2 o = px * thick;
  vec4 ca, cb;
  float eA = edges(tNA, tDA, vUv + wob, o, ca);
  float eB = edges(tNB, tDB, vUv + wob, o, cb);
  vec3 col = texture2D(tColor, vUv).rgb;
  // 排线：背光面画斜线，更暗处交叉
  vec3 n = normalize(ca.xyz * 2. - 1.);
  float ndl = dot(n, lightV);
  float jit = vn(fc * .3) * 1.4;
  float h1 = smoothstep(.66, .92, abs(fract((fc.x + fc.y + jit) / 5.2) - .5) * 2.);
  float h2 = smoothstep(.66, .92, abs(fract((fc.x - fc.y + jit) / 5.2) - .5) * 2.);
  float s1 = smoothstep(-.14, -.5, ndl), s2 = smoothstep(-.5, -.7, ndl);
  float brk = smoothstep(.22, .5, vn(fc * .05 + 7.));
  float hatch = ca.a > .8 ? max(h1 * s1, h2 * s2) * mix(.45, 1., brk) : 0.;
  col = mix(col, ink, hatch * .34);
  float e = max(eA, eB * .82);
  col = mix(col, ink, e * .9);
  vec2 q = vUv - .5;
  col *= 1. - dot(q, q) * .22;
  gl_FragColor = vec4(col, 1.);
}`;

function tex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8;
  return t;
}
function speckle(x, w, h, n, a) {
  for (let i = 0; i < n; i++) {
    x.fillStyle = `rgba(${Math.random() < 0.5 ? '60,48,30' : '255,255,255'},${Math.random() * a})`;
    x.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}
const ease = (t) => t * t * (3 - 2 * t);
const backOut = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
const tween = (ms, fn) => new Promise((res) => {
  const t0 = performance.now();
  const step = (now) => { const t = Math.min(1, (now - t0) / ms); fn(t); t < 1 ? requestAnimationFrame(step) : res(); };
  requestAnimationFrame(step);
});

export class Stage {
  constructor(canvas, view) {
    this.canvas = canvas; this.view = view; this.camEl = view.querySelector('.cam');
    const r = this.r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    if (!r.capabilities.isWebGL2) throw new Error('webgl2');
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.shadowMap.autoUpdate = false;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(24, 1, 8, 160);
    this.yaw = 0; this.elev = 0.8; this.dist = 40; this.target = new THREE.Vector3();
    this.home = { yaw: 0, elev: 0.8 };
    this.stacked = false; this.leaves = []; this.drags = [];
    this.#lights(); this.#book(); this.#post(); this.#pointer();
    this.root = new THREE.Group();
    this.root.position.set(PW / 2 + 0.15, 0.012, -1.55);
    this.scene.add(this.root);
    this.resize();
  }

  #lights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, Math.PI * 0.83));
    const sun = this.sun = new THREE.DirectionalLight(0xfff6e6, Math.PI * 0.36);
    sun.position.copy(LIGHT).multiplyScalar(60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 14; sc.bottom = -14; sc.near = 20; sc.far = 110;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 5;
    this.scene.add(sun, sun.target);
  }

  #book() {
    const add = (m, shadow = true) => { m.layers.set(L.COLOR); m.receiveShadow = true; m.castShadow = shadow; this.scene.add(m); return m; };
    const lam = (o) => new THREE.MeshLambertMaterial(o);
    // 桌面：浅木 + 一块亚麻垫
    const wood = tex(1024, 1024, (x, w, h) => {
      x.fillStyle = '#efe7d6'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 22; i++) {
        const y = (i / 22) * h;
        x.fillStyle = `rgba(150,120,80,${0.03 + Math.random() * 0.05})`; x.fillRect(0, y, w, h / 22);
        x.fillStyle = 'rgba(120,95,60,.22)'; x.fillRect(0, y, w, 1.5);
      }
      for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(130,100,60,${Math.random() * 0.06})`; x.fillRect(Math.random() * w, Math.random() * h, 30 + Math.random() * 160, 1); }
    });
    wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(3, 3);
    const table = add(new THREE.Mesh(new THREE.PlaneGeometry(260, 260).rotateX(-Math.PI / 2), lam({ map: wood })), false);
    table.position.y = -0.62;
    const linen = tex(1024, 640, (x, w, h) => {
      x.fillStyle = DESK; x.fillRect(0, 0, w, h);
      for (let i = 0; i < w; i += 3) { x.fillStyle = `rgba(90,80,55,${Math.random() * 0.05})`; x.fillRect(i, 0, 1, h); }
      for (let i = 0; i < h; i += 3) { x.fillStyle = `rgba(255,255,245,${Math.random() * 0.07})`; x.fillRect(0, i, w, 1); }
      speckle(x, w, h, 5000, 0.07);
    });
    const mat = add(new THREE.Mesh(new THREE.BoxGeometry(52, 0.05, 31).translate(0, -0.6, 1.2), lam({ map: linen })), true);
    mat.material.color.set('#fbfaf6');
    // 封面、书页
    add(new THREE.Mesh(new THREE.BoxGeometry(PW * 2 + 1.0, 0.16, PH + 0.76).translate(0, -0.5, 0), lam({ color: C.green })));
    const paper = (side) => tex(768, 1024, (x, w, h) => {
      x.fillStyle = '#fdfaf2'; x.fillRect(0, 0, w, h);
      speckle(x, w, h, 2600, 0.035);
      const g = x.createLinearGradient(side > 0 ? 0 : w, 0, side > 0 ? w * 0.16 : w * 0.84, 0);
      g.addColorStop(0, 'rgba(120,104,72,.34)'); g.addColorStop(0.35, 'rgba(120,104,72,.08)'); g.addColorStop(1, 'rgba(120,104,72,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      const g2 = x.createLinearGradient(side > 0 ? w : 0, 0, side > 0 ? w * 0.97 : w * 0.03, 0);
      g2.addColorStop(0, 'rgba(120,104,72,.12)'); g2.addColorStop(1, 'rgba(120,104,72,0)');
      x.fillStyle = g2; x.fillRect(0, 0, w, h);
    });
    const edge = tex(8, 64, (x, w, h) => { for (let i = 0; i < h; i++) { x.fillStyle = i % 4 < 2 ? '#f3eee1' : '#ddd5c2'; x.fillRect(0, i, w, 1); } });
    for (const side of [-1, 1]) {
      const e = lam({ map: edge });
      const page = new THREE.Mesh(new THREE.BoxGeometry(PW, 0.42, PH).translate(side * PW / 2, -0.21, 0), [e, e, lam({ map: paper(side) }), e, e, e]);
      add(page);
    }
    // 书签丝带
    add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 2.6).translate(-0.6, -0.4, PH / 2 + 1.2), lam({ color: C.copper })), false);
    // 翻动的那一页
    this.flip = new THREE.Group();
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH, 12, 1).rotateX(-Math.PI / 2).translate(PW / 2, 0, 0), lam({ color: '#fbf8ef', side: THREE.DoubleSide }));
    leaf.layers.set(L.COLOR); leaf.castShadow = true;
    this.flipGeo = leaf.geometry; this.flipBase = leaf.geometry.attributes.position.array.slice();
    this.flip.add(leaf); this.flip.position.y = 0.03; this.flip.visible = false;
    this.scene.add(this.flip);
  }

  #post() {
    const depthRT = () => {
      const rt = new THREE.WebGLRenderTarget(4, 4, { depthTexture: new THREE.DepthTexture(4, 4) });
      rt.depthTexture.minFilter = rt.depthTexture.magFilter = THREE.NearestFilter;
      return rt;
    };
    this.rtC = new THREE.WebGLRenderTarget(4, 4, { samples: 4 });
    this.rtA = depthRT(); this.rtB = depthRT();
    this.nMat = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
    // “只描边不排线”的实体：法线照写，alpha 写 0.6 作标记
    this.nMatClean = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.6, blending: THREE.NoBlending });
    this.dMat = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
    this.comp = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        tColor: { value: this.rtC.texture }, tNA: { value: this.rtA.texture }, tDA: { value: this.rtA.depthTexture },
        tNB: { value: this.rtB.texture }, tDB: { value: this.rtB.depthTexture },
        px: { value: new THREE.Vector2() }, near: { value: this.cam.near }, far: { value: this.cam.far },
        thick: { value: 1.2 }, dpr: { value: 1 }, lightV: { value: new THREE.Vector3() }, ink: { value: new THREE.Color(C.ink) },
      },
    });
    this.qScene = new THREE.Scene();
    this.qScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.comp));
    this.qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /** 把一个 DOM 书页贴到纸面上。cx, cz 为书页中心；w, h 为 DOM 像素尺寸 */
  addLeaf(el, cx, cz) {
    const anchor = new THREE.Object3D();
    anchor.position.set(cx, 0.02, cz); anchor.rotation.x = -Math.PI / 2; anchor.scale.setScalar(1 / PXU);
    anchor.updateMatrixWorld(true);
    this.leaves.push({ el, anchor });
    this.#place();
  }
  #place() {
    for (const { el, anchor } of this.leaves) {
      if (this.stacked) { el.style.transform = ''; continue; }
      const m = anchor.matrixWorld.elements;
      el.style.transform = `translate(-50%,-50%) matrix3d(${m[0]},${m[1]},${m[2]},${m[3]},${-m[4]},${-m[5]},${-m[6]},${-m[7]},${m[8]},${m[9]},${m[10]},${m[11]},${m[12]},${m[13]},${m[14]},${m[15]})`;
    }
  }

  resize() {
    const w = this.canvas.clientWidth || 2, h = this.canvas.clientHeight || 2;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = w; this.h = h; this.dpr = dpr;
    this.r.setPixelRatio(dpr); this.r.setSize(w, h, false);
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    this.rtC.setSize(W, H); this.rtA.setSize(W, H); this.rtB.setSize(W, H);
    const u = this.comp.uniforms;
    u.px.value.set(1 / W, 1 / H); u.dpr.value = dpr; u.thick.value = 1.15 * dpr;
    this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
    this.#fit(); this.#place();
  }
  setStacked(on) { this.stacked = on; this.#place(); }

  #aim() {
    const ce = Math.cos(this.elev);
    this.cam.position.set(this.target.x + this.dist * Math.sin(this.yaw) * ce, this.target.y + this.dist * Math.sin(this.elev), this.target.z + this.dist * Math.cos(this.yaw) * ce);
    this.cam.lookAt(this.target);
    this.cam.updateMatrixWorld(true);
  }
  #fit() {
    const s = this.stacked;
    const pts = [];
    if (s) {
      this.target.set(PW / 2 + 0.15, 1.7, -1.0);
      for (const x of [0.3, PW]) { pts.push([x, 0, -PH / 2], [x, 0, 3.4], [x, 5.6, -5]); }
    } else {
      this.target.set(0, 1.1, 0.5);
      for (const x of [-PW - 0.5, PW + 0.5]) pts.push([x, 0, -PH / 2 - 0.4], [x, 0, PH / 2 + 0.4]);
      pts.push([0.6, 6.0, -5.2], [PW, 6.0, -5.2]);
    }
    const yaw = this.yaw, elev = this.elev;
    this.yaw = this.home.yaw; this.elev = this.home.elev;
    const v = new THREE.Vector3();
    const xm = s ? 0.97 : 0.95, y0 = s ? -0.96 : -0.83, y1 = s ? 0.94 : 0.95;
    for (this.dist = 18; this.dist < 150; this.dist += 0.5) {
      this.#aim(); this.cam.updateMatrixWorld(true); this.cam.matrixWorldInverse.copy(this.cam.matrixWorld).invert();
      if (pts.every((p) => { v.set(p[0], p[1], p[2]).project(this.cam); return Math.abs(v.x) < xm && v.y > y0 && v.y < y1; })) break;
    }
    this.yaw = yaw; this.elev = elev;
  }
  resetView() { this.yaw = this.home.yaw; this.elev = this.home.elev; }

  #syncCSS() {
    if (this.stacked) return;
    const fov = this.cam.projectionMatrix.elements[5] * this.h / 2;
    const e = this.cam.matrixWorldInverse.elements;
    const key = `${fov}|${e[0]}|${e[5]}|${e[12]}|${e[13]}|${e[14]}|${this.w}`;
    if (key === this._cssKey) return;
    this._cssKey = key;
    this.view.style.perspective = `${fov}px`;
    this.camEl.style.transform = `translateZ(${fov}px) matrix3d(${e[0]},${-e[1]},${e[2]},${e[3]},${e[4]},${-e[5]},${e[6]},${e[7]},${e[8]},${-e[9]},${e[10]},${e[11]},${e[12]},${-e[13]},${e[14]},${e[15]}) translate(${this.w / 2}px,${this.h / 2}px)`;
  }

  render() {
    const r = this.r, cam = this.cam, sc = this.scene;
    this.#aim();
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    this.#syncCSS();
    this.comp.uniforms.lightV.value.copy(LIGHT).transformDirection(cam.matrixWorldInverse);
    r.shadowMap.needsUpdate = true;
    cam.layers.enableAll();
    r.setRenderTarget(this.rtC); r.setClearColor(DESK, 1); r.clear(); r.render(sc, cam);
    sc.overrideMaterial = this.nMat; cam.layers.set(L.INK);
    r.setRenderTarget(this.rtA); r.setClearColor(0x8080ff, 0); r.clear(); r.render(sc, cam);
    sc.overrideMaterial = this.nMatClean; cam.layers.set(L.CLEAN);
    r.autoClear = false; r.render(sc, cam); r.autoClear = true;
    sc.overrideMaterial = this.dMat; cam.layers.set(L.INK); cam.layers.enable(L.CLEAN);
    r.setRenderTarget(this.rtB); r.clear(); r.render(sc, cam);
    sc.overrideMaterial = this.nMat; cam.layers.set(L.GLASS);
    r.autoClear = false; r.render(sc, cam); r.autoClear = true;
    sc.overrideMaterial = null; cam.layers.enableAll();
    r.setRenderTarget(null); r.render(this.qScene, this.qCam);
  }

  // ---------- 换页：合上立体 → 翻页 → 重新立起 ----------
  clear() {
    disposeTree(this.root);
    this.root.clear();
    this.drags.length = 0;
  }
  async turn(dir, swap, quick) {
    const els = this.leaves.map((l) => l.el);
    if (this.turning) return;
    this.turning = true;
    try {
      if (quick) { await swap(); this.root.scale.y = 1; els.forEach((e) => (e.style.opacity = 1)); return; }
      els.forEach((e) => (e.style.opacity = 0));
      await tween(200, (t) => { this.root.scale.y = Math.max(0.001, 1 - ease(t)); });
      this.root.visible = false;
      this.flip.visible = true;
      const flipping = tween(620, (t) => { this.#bend(dir > 0 ? ease(t) : 1 - ease(t)); });
      await swap();
      await flipping;
      this.flip.visible = false;
      this.root.visible = true;
      els.forEach((e) => (e.style.opacity = 1));
      await tween(560, (t) => { this.root.scale.y = Math.max(0.001, backOut(t)); });
      this.root.scale.y = 1;
    } finally { this.turning = false; this.root.visible = true; }
  }
  #bend(t) {
    // 页面绕书脊翻过去，中段略微鼓起
    const a = t * Math.PI, p = this.flipGeo.attributes.position, b = this.flipBase, k = Math.sin(a) * 0.5;
    for (let i = 0; i < p.count; i++) {
      const x = b[i * 3], u = x / PW, ang = a + k * u * (1 - u) * 2.2 - k * 0.25 * u;
      p.setXYZ(i, Math.cos(ang) * x, Math.sin(ang) * x + Math.sin(u * Math.PI) * k * 0.9, b[i * 3 + 2]);
    }
    p.needsUpdate = true; this.flipGeo.computeVertexNormals();
  }

  // ---------- 指针：拖实验里的东西，或拖空白处转视角 ----------
  /** 让 mesh 可拖动。opt: { normal:'x'|'y'|'z'（拖动平面法向，实验坐标）, start(), move(p), end() } */
  drag(mesh, opt) { this.drags.push({ mesh, ...opt }); return mesh; }
  #pointer() {
    const el = this.canvas, ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hit = new THREE.Vector3();
    ray.layers.enableAll();
    const aim = (ev) => {
      const b = el.getBoundingClientRect();
      ndc.set(((ev.clientX - b.left) / b.width) * 2 - 1, -((ev.clientY - b.top) / b.height) * 2 + 1);
      ray.setFromCamera(ndc, this.cam);
    };
    const pick = () => {
      let best = null, bd = Infinity;
      for (const d of this.drags) {
        if (!d.mesh.parent) continue;
        const h = ray.intersectObject(d.mesh, true)[0];
        if (h && h.distance < bd) { bd = h.distance; best = d; }
      }
      return best;
    };
    let cur = null, orbit = null;
    el.addEventListener('pointerdown', (ev) => {
      aim(ev);
      cur = pick();
      if (cur) {
        const n = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[cur.normal || 'z'];
        plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(...n), cur.mesh.getWorldPosition(new THREE.Vector3()));
        cur.start?.();
        el.style.cursor = 'grabbing';
      } else orbit = { x: ev.clientX, y: ev.clientY, yaw: this.yaw, elev: this.elev };
      el.setPointerCapture(ev.pointerId);
    });
    el.addEventListener('pointermove', (ev) => {
      if (cur) {
        aim(ev);
        if (ray.ray.intersectPlane(plane, hit)) cur.move?.(this.root.worldToLocal(hit.clone()));
      } else if (orbit) {
        if (this.stacked && Math.abs(ev.clientY - orbit.y) > Math.abs(ev.clientX - orbit.x) * 1.5 && !orbit.locked) { orbit = null; return; }
        orbit.locked = true;
        this.yaw = Math.max(-0.7, Math.min(0.7, orbit.yaw - (ev.clientX - orbit.x) * 0.004));
        this.elev = Math.max(0.3, Math.min(1.3, orbit.elev + (ev.clientY - orbit.y) * 0.003));
      } else if (ev.pointerType === 'mouse') { aim(ev); el.style.cursor = pick() ? 'grab' : 'default'; }
    });
    const up = () => { cur?.end?.(); cur = null; orbit = null; el.style.cursor = 'default'; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('dblclick', () => this.resetView());
  }
}
