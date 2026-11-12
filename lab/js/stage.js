// HAIZ 实验册 · 舞台
// 一台对着书桌的摄影机：线性光照 + 环境反射 + 柔和日光阴影；
// 白模经后期画成墨线图（描边 + 排线），再叠加接触处的环境遮蔽。
//   1) 上色（带阴影，写深度）  2) 实体的法线+深度  3) 玻璃的法线+深度  4) 合成
// 另外负责：立体装置的“纸雕折叠”、把装置正立面拓印成一幅版画、指针的分工（拖装置 / 翻书 / 转视角）。
import * as THREE from 'three';
import { L, C, disposeTree } from './ink.js';
import { Book, PW, PH, PXU, ZH, PLATE_H } from './book.js';

export { PW, PH, PXU };
const LIGHT = new THREE.Vector3(-0.52, 0.8, -0.3).normalize();
const DESK = '#b9a78d';
const ROOT_Z = -1.55, ROOT_X = PW / 2 + 0.15;

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
const COMMON = `
precision highp float;
uniform sampler2D tColor, tNA, tDA, tNB, tDB;
uniform vec2 px; uniform float near, far, thick, dpr;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
#ifdef ORTHO
float vz(float d){ return near + d * (far - near); }
float lapK(float z){ return (far - near); }
#else
float vz(float d){ return near * far / (far - d * (far - near)); }
float lapK(float z){ return (far - near) * z * z / (near * far); }
#endif
float edges(sampler2D tn, sampler2D td, vec2 uv, vec2 o, out vec4 c, out float dmin){
  c = texture2D(tn, uv);
  vec4 a = texture2D(tn, uv + vec2(o.x, 0.)), b = texture2D(tn, uv - vec2(o.x, 0.));
  vec4 e = texture2D(tn, uv + vec2(0., o.y)), f = texture2D(tn, uv - vec2(0., o.y));
  float dc = texture2D(td, uv).x;
  float d1 = texture2D(td, uv + vec2(o.x, 0.)).x, d2 = texture2D(td, uv - vec2(o.x, 0.)).x;
  float d3 = texture2D(td, uv + vec2(0., o.y)).x, d4 = texture2D(td, uv - vec2(0., o.y)).x;
  dmin = min(dc, min(min(d1, d2), min(d3, d4)));
  float z = vz(dmin);
  float lap = (abs(d1 + d2 - 2. * dc) + abs(d3 + d4 - 2. * dc)) * lapK(z);
  float de = smoothstep(.05, .15, lap);
  vec3 n = c.xyz * 2. - 1.;
  float nd = max(max(1. - dot(n, a.xyz * 2. - 1.), 1. - dot(n, b.xyz * 2. - 1.)),
                 max(1. - dot(n, e.xyz * 2. - 1.), 1. - dot(n, f.xyz * 2. - 1.)));
  float ne = smoothstep(.16, .46, nd);
  float amax = max(c.a, max(max(a.a, b.a), max(e.a, f.a)));
  float amin = min(c.a, min(min(a.a, b.a), min(e.a, f.a)));
  float ae = smoothstep(.12, .6, amax - amin);
  return max(max(de, ne) * step(.5, amax), ae);
}`;
const FRAG = COMMON + `
uniform sampler2D tDepth;
uniform vec3 lightV, ink;
uniform vec2 proj; uniform float aoR, aoK, time;
vec3 vpos(vec2 uv){ float z = vz(texture2D(tDepth, uv).x); return vec3((uv * 2. - 1.) * proj * z, -z); }
vec3 srgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
void main(){
  vec2 fc = gl_FragCoord.xy / dpr;
  vec2 wob = (vec2(vn(fc * .09), vn(fc * .09 + 31.7)) - .5) * px * dpr * 1.6;
  vec2 o = px * thick;
  vec4 ca, cb; float da, db;
  float eA = edges(tNA, tDA, vUv + wob, o, ca, da);
  float eB = edges(tNB, tDB, vUv + wob, o, cb, db);
  vec3 col = texture2D(tColor, vUv).rgb;
  float sd = texture2D(tDepth, vUv + wob).x;
  // 被书页（或别的不描边的东西）挡住的墨线不画
  float occA = 1. - smoothstep(.00002, .00012, da - sd);
  float occB = 1. - smoothstep(.00002, .00012, db - sd);
#if AO > 0
  // 接触处的环境遮蔽：在屏幕空间里看四周有没有东西“罩”在上面
  vec3 P = vpos(vUv);
  vec3 N = normalize(cross(dFdx(P), dFdy(P)));
  float rpx = aoR / (-P.z * proj.y * 2.);        // 世界半径 → 屏幕 uv
  float ang = hash(gl_FragCoord.xy) * 6.2832, occ = 0.;
  for (int i = 0; i < AO; i++) {
    float t = (float(i) + .5) / float(AO), r = sqrt(t) * rpx;
    float a2 = ang + float(i) * 2.39996;
    vec2 uv2 = vUv + vec2(cos(a2), sin(a2) * (px.y / px.x)) * r;
    vec3 v = vpos(uv2) - P;
    float d2 = dot(v, v);
    occ += max(0., dot(N, v) - .015 * -P.z * .02) / (d2 + .02) * step(d2, aoR * aoR * 4.);
  }
  float ao = clamp(1. - occ / float(AO) * aoK, 0., 1.);
  col *= mix(1., ao, .9);
#endif
  // 排线：背光面画斜线，更暗处交叉
  vec3 n = normalize(ca.xyz * 2. - 1.);
  float ndl = dot(n, lightV);
  float jit = vn(fc * .3) * 1.4;
  float h1 = smoothstep(.66, .92, abs(fract((fc.x + fc.y + jit) / 5.2) - .5) * 2.);
  float h2 = smoothstep(.66, .92, abs(fract((fc.x - fc.y + jit) / 5.2) - .5) * 2.);
  float s1 = smoothstep(-.1, -.48, ndl), s2 = smoothstep(-.5, -.72, ndl);
  float brk = smoothstep(.22, .5, vn(fc * .05 + 7.));
  float hatch = ca.a > .8 ? max(h1 * s1, h2 * s2) * mix(.45, 1., brk) * occA : 0.;
  col = mix(col, ink, hatch * .4);
  // 墨线：轮廓略重，笔压有轻微变化
  float press = mix(.82, 1., vn(fc * .035 + 3.));
  float e = max(eA * occA, eB * .82 * occB) * press;
  col = mix(col, ink, e * .93);
  // 镜头：高光柔和压缩、轻微暗角、极细的颗粒（顺便消除色带）
  col = mix(col, .8 + .2 * (1. - exp(-(col - .8) / .2)), step(.8, col));
  vec2 q = vUv - .5;
  col *= 1. - dot(q, q) * .3;
  col = srgb(clamp(col, 0., 1.));
  col += (hash(gl_FragCoord.xy + time) - .5) * .012;
  gl_FragColor = vec4(col, 1.);
}`;
// 版画：把装置的正立面拓成“铅笔线 + 淡彩”的一幅图，印在纸上
const FRAG_PLATE = '#define ORTHO\n' + COMMON + `
uniform vec3 ink;
void main(){
  vec2 o = px * thick;
  vec4 ca, cb; float da, db;
  float eA = edges(tNA, tDA, vUv, o, ca, da);
  float eB = edges(tNB, tDB, vUv, o, cb, db);
  vec4 c = texture2D(tColor, vUv);
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
  float lum = dot(c.rgb, vec3(.3, .6, .1));
  float wash = c.a * max(smoothstep(.04, .3, mx - mn) * .5, smoothstep(.5, .12, lum) * .85);
  float e = max(eA, eB * .8);
  vec3 col = mix(c.rgb, ink, e);
  gl_FragColor = vec4(col, max(e * .78, wash));
}`;

const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);

export class Stage {
  constructor(canvas, view, opt = {}) {
    this.canvas = canvas; this.view = view; this.camEl = view.querySelector('.cam');
    const r = this.r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    if (!r.capabilities.isWebGL2) throw new Error('webgl2');
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.shadowMap.autoUpdate = false;
    // 画质分级：2 桌面 / 1 手机与集显 / 0 极简
    this.quality = opt.quality ?? 2;
    this.scale = 1;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(24, 1, 8, 170);
    this.view3 = { yaw: 0, elev: 0.82, dist: 40, target: new THREE.Vector3() };   // 当前
    this.goal = { yaw: 0, elev: 0.82, dist: 40, target: new THREE.Vector3() };    // 目标
    this.shot = 'spread';
    this.stacked = false; this.leaves = []; this.drags = [];
    this.handlers = {};
    this.book = new Book();
    this.scene.add(this.book.group);
    this.#lights(); this.#post(); this.#pointer();
    this.time = 0; this.dirty = true;
    this.resize();
  }

  // ---------- 光 ----------
  #lights() {
    const sc = this.scene;
    const hemi = this.hemi = new THREE.HemisphereLight(0xf3f5ff, 0xe9dcc6, Math.PI * 0.26);
    const sun = this.sun = new THREE.DirectionalLight(0xfff1de, Math.PI * 0.5);
    sun.position.copy(LIGHT).multiplyScalar(60);
    sun.castShadow = true;
    const ms = this.quality >= 2 ? 2048 : 1024;
    sun.shadow.mapSize.set(ms, ms);
    const c = sun.shadow.camera; c.left = -17; c.right = 17; c.top = 15; c.bottom = -15; c.near = 20; c.far = 110;
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.035; sun.shadow.radius = this.quality >= 2 ? 7 : 4;
    sc.add(hemi, sun, sun.target);
    // 环境：一间有窗的房间（只用来给金属、玻璃、清漆桌面一点真实的反射，并补一层柔和的漫射光）
    const env = new THREE.Scene();
    const room = new THREE.Mesh(new THREE.BoxGeometry(40, 24, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.19, 0.175), side: THREE.BackSide }));
    room.position.y = 8;
    const panel = (w, h, col, pos, look) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(...look); env.add(m); };
    env.add(room);
    panel(16, 11, new THREE.Color(9, 9.4, 10), [-17, 11, -9], [0, 2, 0]);      // 左后方的窗
    panel(7, 9, new THREE.Color(4.5, 4.7, 5), [-6, 13, -19], [0, 2, 0]);       // 后墙上的小窗
    panel(18, 12, new THREE.Color(1.5, 1.38, 1.2), [19, 9, 6], [0, 2, 0]);     // 右侧暖色反光
    panel(30, 30, new THREE.Color(0.5, 0.49, 0.46), [0, 19.5, 0], [0, 0, 0]); // 天花板
    const pm = new THREE.PMREMGenerator(this.r);
    sc.environment = pm.fromScene(env, 0.035).texture;
    sc.environmentIntensity = 0.5;
    pm.dispose(); env.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  }

  #post() {
    const r = this.r;
    const hf = r.extensions.has('EXT_color_buffer_float') || r.extensions.has('EXT_color_buffer_half_float');
    const depthRT = (w = 4, h = 4) => {
      const rt = new THREE.WebGLRenderTarget(w, h, { depthTexture: new THREE.DepthTexture(w, h) });
      rt.depthTexture.minFilter = rt.depthTexture.magFilter = THREE.NearestFilter;
      return rt;
    };
    this.rtC = new THREE.WebGLRenderTarget(4, 4, { samples: this.quality >= 1 ? 4 : 0, type: hf ? THREE.HalfFloatType : THREE.UnsignedByteType, depthTexture: new THREE.DepthTexture(4, 4) });
    this.rtC.depthTexture.minFilter = this.rtC.depthTexture.magFilter = THREE.NearestFilter;
    this.rtA = depthRT(); this.rtB = depthRT();
    this.nMat = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
    // “只描边不排线”的实体：法线照写，alpha 写 0.6 作标记
    this.nMatClean = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.6, blending: THREE.NoBlending });
    this.dMat = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
    const inkCol = new THREE.Color(C.ink);
    const base = (rtC, rtA, rtB) => ({
      tColor: { value: rtC.texture }, tNA: { value: rtA.texture }, tDA: { value: rtA.depthTexture },
      tNB: { value: rtB.texture }, tDB: { value: rtB.depthTexture },
      px: { value: new THREE.Vector2() }, near: { value: this.cam.near }, far: { value: this.cam.far },
      thick: { value: 1.2 }, dpr: { value: 1 }, ink: { value: inkCol },
    });
    this.comp = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
      defines: { AO: [0, 8, 12][this.quality] },
      uniforms: { ...base(this.rtC, this.rtA, this.rtB), tDepth: { value: this.rtC.depthTexture }, lightV: { value: new THREE.Vector3() }, proj: { value: new THREE.Vector2() }, aoR: { value: 0.75 }, aoK: { value: 1.05 }, time: { value: 0 } },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.comp);
    this.qScene = new THREE.Scene(); this.qScene.add(this.quad);
    this.qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    // 版画：正交相机从正前方看装置，输出带透明度的线稿
    const PWp = 1024, PHp = Math.round(1024 * PLATE_H / PW);
    this.pC = new THREE.WebGLRenderTarget(PWp, PHp, { samples: 4 });
    this.pA = depthRT(PWp, PHp); this.pB = depthRT(PWp, PHp);
    this.pCam = new THREE.OrthographicCamera(-PW / 2, PW / 2, PLATE_H, 0, 1, 60);
    this.pComp = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG_PLATE, depthTest: false, depthWrite: false, transparent: false, blending: THREE.NoBlending,
      uniforms: base(this.pC, this.pA, this.pB),
    });
    this.pComp.uniforms.px.value.set(1 / PWp, 1 / PHp); this.pComp.uniforms.thick.value = 1.25; this.pComp.uniforms.near.value = 1; this.pComp.uniforms.far.value = 60;
    this.plateSize = [PWp, PHp];
  }
  /** 新建一幅空白版画（每个摊开的实验各有一幅） */
  newPlate() {
    const rt = new THREE.WebGLRenderTarget(this.plateSize[0], this.plateSize[1], { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    rt.texture.anisotropy = 4;
    return rt;
  }

  // ---------- 装置的根：每个实验一个，会像立体书的纸雕那样朝书顶放倒 ----------
  newRoot() {
    const g = new THREE.Group();
    g.matrixAutoUpdate = false; g.userData.pop = 0;
    this.scene.add(g);
    this.setPop(g, 0);
    return g;
  }
  /** t：0 立着，1 完全放平成纸上的图。放倒时沿进深压扁，像一张张硬纸片。 */
  setPop(g, t) {
    g.userData.pop = t;
    const phi = t * Math.PI / 2, sz = Math.max(0.02, 1 - t * 0.98), zh = ZH - ROOT_Z;
    const c = Math.cos(phi), s = Math.sin(phi);
    // M = T(root) · T(0,0,zh) · Rx(−phi) · S(1,1,sz) · T(0,0,−zh)
    g.matrix.set(
      1, 0, 0, ROOT_X,
      0, c, s * sz, this.book.hR + 0.012 - s * sz * zh,
      0, -s, c * sz, ROOT_Z + zh - c * sz * zh,
      0, 0, 0, 1);
    g.matrixWorldNeedsUpdate = true;
    g.visible = t < 0.985;
    this.dirty = true;
  }
  /** 把装置此刻的正立面拓印到 plate 上 */
  bakePlate(root, plate) {
    const r = this.r, sc = this.scene, cam = this.pCam;
    const pop = root.userData.pop, vis = [];
    sc.children.forEach((o) => { if (o !== root && !o.isLight) { vis.push([o, o.visible]); o.visible = false; } });
    this.setPop(root, 0); root.visible = true; root.updateMatrixWorld(true);
    cam.position.set(PW / 2, this.book.hR + 0.012, 30); cam.lookAt(PW / 2, this.book.hR + 0.012, 0);
    // 相机抬到装置高度的一半：lookAt 之后手动平移，保持正视
    cam.position.y += 0; cam.updateMatrixWorld(true);
    const bg = sc.background; sc.background = null;
    const env = sc.environmentIntensity;
    cam.layers.enableAll();
    r.setRenderTarget(this.pC); r.setClearColor(0xffffff, 0); r.clear(); r.render(sc, cam);
    sc.overrideMaterial = this.nMat; cam.layers.set(L.INK);
    r.setRenderTarget(this.pA); r.setClearColor(0x8080ff, 0); r.clear(); r.render(sc, cam);
    sc.overrideMaterial = this.nMatClean; cam.layers.set(L.CLEAN);
    r.autoClear = false; r.render(sc, cam); r.autoClear = true;
    sc.overrideMaterial = this.dMat; cam.layers.set(L.INK); cam.layers.enable(L.CLEAN);
    r.setRenderTarget(this.pB); r.clear(); r.render(sc, cam);
    sc.overrideMaterial = this.nMat; cam.layers.set(L.GLASS);
    r.autoClear = false; r.render(sc, cam); r.autoClear = true;
    sc.overrideMaterial = null;
    this.quad.material = this.pComp;
    r.setRenderTarget(plate); r.setClearColor(0xffffff, 0); r.clear(); r.render(this.qScene, this.qCam);
    this.quad.material = this.comp;
    r.setRenderTarget(null);
    sc.background = bg; sc.environmentIntensity = env;
    vis.forEach(([o, v]) => (o.visible = v));
    this.setPop(root, pop);
  }
  disposeRoot(g) { if (!g) return; disposeTree(g); g.clear(); this.scene.remove(g); this.dirty = true; }

  /** 把一个 DOM 书页贴到纸面上。side: −1 左页 / +1 右页；cx, cz 为书页中心 */
  addLeaf(el, side, cx, cz) {
    const anchor = new THREE.Object3D();
    anchor.rotation.x = -Math.PI / 2; anchor.scale.setScalar(1 / PXU);
    const leaf = { el, anchor, side, cx, cz };
    this.leaves.push(leaf);
    this.#place();
    return leaf;
  }
  removeLeaf(el) { this.leaves = this.leaves.filter((l) => l.el !== el); }
  #place() {
    for (const { el, anchor, side, cx, cz } of this.leaves) {
      if (this.stacked) { el.style.transform = ''; continue; }
      anchor.position.set(cx, (side > 0 ? this.book.hR : this.book.hL) + 0.02, cz);
      anchor.updateMatrixWorld(true);
      const m = anchor.matrixWorld.elements;
      el.style.transform = `translate(-50%,-50%) matrix3d(${m[0]},${m[1]},${m[2]},${m[3]},${-m[4]},${-m[5]},${-m[6]},${-m[7]},${m[8]},${m[9]},${m[10]},${m[11]},${m[12]},${m[13]},${m[14]},${m[15]})`;
    }
  }
  /** 全书读到哪里了：改变两叠纸的厚度，并让书页 DOM、装置跟着纸面走 */
  setBookProgress(f) { this.book.setProgress(f); this.#place(); this.dirty = true; }

  resize() {
    const w = this.canvas.clientWidth || 2, h = this.canvas.clientHeight || 2;
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality >= 2 ? 2 : 1.5) * this.scale;
    this.w = w; this.h = h; this.dpr = dpr;
    this.r.setPixelRatio(dpr); this.r.setSize(w, h, false);
    const W = Math.max(2, Math.round(w * dpr)), H = Math.max(2, Math.round(h * dpr));
    this.rtC.setSize(W, H); this.rtA.setSize(W, H); this.rtB.setSize(W, H);
    const u = this.comp.uniforms;
    u.px.value.set(1 / W, 1 / H); u.dpr.value = dpr; u.thick.value = 1.15 * Math.max(1, dpr);
    this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
    u.proj.value.set(Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2)) * this.cam.aspect, Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2)));
    this.frame(true); this.#place(); this.dirty = true;
  }
  setStacked(on) { this.stacked = on; this.shot = on ? 'page' : 'spread'; this.#place(); }
  /** 自适应分辨率：帧时间持续过长就降一点渲染尺度，宽裕时再升回去 */
  adapt(ms) {
    this.avg = this.avg === undefined ? ms : this.avg * 0.92 + ms * 0.08;
    this.adaptT = (this.adaptT || 0) + ms;
    if (this.adaptT < 1500) return;
    this.adaptT = 0;
    const s = this.avg > 26 ? Math.max(0.6, this.scale - 0.1) : this.avg < 14 ? Math.min(1, this.scale + 0.05) : this.scale;
    if (s !== this.scale) { this.scale = s; this.resize(); }
  }

  // ---------- 镜头 ----------
  #aimFrom(v) {
    const ce = Math.cos(v.elev);
    this.cam.position.set(v.target.x + v.dist * Math.sin(v.yaw) * ce, v.target.y + v.dist * Math.sin(v.elev), v.target.z + v.dist * Math.cos(v.yaw) * ce);
    this.cam.lookAt(v.target);
    this.cam.updateMatrixWorld(true);
    this.cam.matrixWorldInverse.copy(this.cam.matrixWorld).invert();
  }
  /** 取景：'spread' 摊开的两页 | 'page' 只看右页（手机）| 'left' / 'right' 凑近读一页 */
  frame(snap, shot = this.shot) {
    this.shot = shot;
    const g = this.goal, pts = [], hb = Math.max(this.book.hL, this.book.hR);
    let xm = 0.95, y0 = -0.84, y1 = 0.95;
    if (shot === 'spread') {
      g.target.set(0, 1.1, 0.45);
      for (const x of [-PW - 0.9, PW + 0.9]) pts.push([x, 0, -PH / 2 - 0.5], [x, 0, PH / 2 + 0.5]);
      pts.push([0.6, 6.2, -5.2], [PW, 6.2, -5.2]);
    } else if (shot === 'page') {
      g.target.set(PW / 2 + 0.1, 1.7, -1.0); xm = 0.98; y0 = -0.97; y1 = 0.94;
      for (const x of [0.2, PW + 0.2]) pts.push([x, hb, -PH / 2], [x, hb, 3.3], [x, 5.8, -5]);
    } else {
      const sx = shot === 'left' ? -1 : 1;
      g.target.set(sx * (PW / 2), hb, 0.2); xm = 0.96; y0 = -0.8; y1 = 0.96;
      for (const x of [sx * 0.1, sx * (PW + 0.2)]) pts.push([x, hb, -PH / 2 - 0.2], [x, hb, PH / 2 + 0.2]);
    }
    g.yaw = 0; g.elev = shot === 'left' || shot === 'right' ? 1.02 : 0.82;
    const v = new THREE.Vector3(), probe = { yaw: 0, elev: g.elev, dist: 18, target: g.target };
    for (probe.dist = 14; probe.dist < 160; probe.dist += 0.5) {
      this.#aimFrom(probe);
      if (pts.every((p) => { v.set(p[0], p[1], p[2]).project(this.cam); return Math.abs(v.x) < xm && v.y > y0 && v.y < y1; })) break;
    }
    g.dist = probe.dist;
    if (snap) { const c = this.view3; c.yaw = g.yaw; c.elev = g.elev; c.dist = g.dist; c.target.copy(g.target); }
    this.dirty = true;
  }
  resetView() { this.frame(false, this.stacked ? 'page' : 'spread'); }

  #syncCSS() {
    if (this.stacked) return;
    const fov = this.cam.projectionMatrix.elements[5] * this.h / 2;
    const e = this.cam.matrixWorldInverse.elements;
    const key = `${fov}|${e[0]}|${e[5]}|${e[9]}|${e[12]}|${e[13]}|${e[14]}|${this.w}`;
    if (key === this._cssKey) return;
    this._cssKey = key;
    this.view.style.perspective = `${fov}px`;
    this.camEl.style.transform = `translateZ(${fov}px) matrix3d(${e[0]},${-e[1]},${e[2]},${e[3]},${e[4]},${-e[5]},${e[6]},${e[7]},${e[8]},${-e[9]},${e[10]},${e[11]},${e[12]},${-e[13]},${e[14]},${e[15]}) translate(${this.w / 2}px,${this.h / 2}px)`;
  }

  /** 推进镜头的阻尼运动。返回镜头是否还在动。 */
  tick(dt) {
    const c = this.view3, g = this.goal, k = 7;
    const before = c.yaw + c.elev + c.dist + c.target.x + c.target.y + c.target.z;
    c.yaw = damp(c.yaw, g.yaw, k, dt); c.elev = damp(c.elev, g.elev, k, dt); c.dist = damp(c.dist, g.dist, k, dt);
    c.target.set(damp(c.target.x, g.target.x, k, dt), damp(c.target.y, g.target.y, k, dt), damp(c.target.z, g.target.z, k, dt));
    const moving = Math.abs(c.yaw + c.elev + c.dist + c.target.x + c.target.y + c.target.z - before) > 1e-5;
    if (moving) this.dirty = true;
    this.time += dt;
    return moving;
  }

  render() {
    const r = this.r, cam = this.cam, sc = this.scene;
    this.#aimFrom(this.view3);
    this.#syncCSS();
    const u = this.comp.uniforms;
    u.lightV.value.copy(LIGHT).transformDirection(cam.matrixWorldInverse);
    u.time.value = (this.time * 60) % 1000;
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
    this.dirty = false;
  }

  // ---------- 指针：拖装置 > 翻书 > 转视角 ----------
  /** 让 mesh 可拖动。opt: { normal:'x'|'y'|'z'（拖动平面法向，实验坐标）, start(), move(p), end() } */
  drag(mesh, opt, list = this.drags) { list.push({ mesh, ...opt }); return mesh; }
  on(name, fn) { this.handlers[name] = fn; }
  ray(ev) {
    const b = this.canvas.getBoundingClientRect();
    this._ndc.set(((ev.clientX - b.left) / b.width) * 2 - 1, -((ev.clientY - b.top) / b.height) * 2 + 1);
    this._ray.setFromCamera(this._ndc, this.cam);
    return this._ray;
  }
  /** 指针在书页的翻页区吗？返回 { dir, s, z } 或 null */
  turnZone(ev) {
    const hit = this.book.pageHit(this.ray(ev).ray, this._hit);
    if (!hit) return null;
    const edge = hit.s > PW * 0.87, corner = hit.s > PW * 0.76 && Math.abs(hit.z) > PH * 0.37;
    if (this.stacked) return hit.side > 0 && hit.s > PW * 0.6 ? { dir: 1, ...hit } : hit.s < PW * 0.22 && hit.side > 0 ? { dir: -1, side: -1, s: PW * 0.9, z: hit.z, far: true } : hit.side < 0 ? { dir: -1, ...hit } : null;
    return edge || corner ? { dir: hit.side, ...hit } : null;
  }
  #pointer() {
    const el = this.canvas, plane = new THREE.Plane(), hit = new THREE.Vector3();
    this._ray = new THREE.Raycaster(); this._ndc = new THREE.Vector2(); this._hit = new THREE.Vector3();
    this._ray.layers.enableAll();
    const pick = () => {
      let best = null, bd = Infinity;
      for (const d of this.drags) {
        if (!d.mesh.parent) continue;
        const h = this._ray.intersectObject(d.mesh, true)[0];
        if (h && h.distance < bd) { bd = h.distance; best = d; }
      }
      return best;
    };
    let cur = null, orbit = null, turn = null, hover = 0;
    el.addEventListener('pointerdown', (ev) => {
      if (ev.button > 0) return;
      this.ray(ev);
      cur = this.handlers.busy?.() ? null : pick();
      if (cur) {
        const n = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[cur.normal || 'z'];
        plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(...n), cur.mesh.getWorldPosition(new THREE.Vector3()));
        cur.start?.();
        el.style.cursor = 'grabbing';
      } else {
        const z = this.turnZone(ev);
        if (z && this.handlers.turnStart?.(z, ev)) turn = { z, x: ev.clientX, y: ev.clientY, t: performance.now(), moved: false };
        else orbit = { x: ev.clientX, y: ev.clientY, yaw: this.goal.yaw, elev: this.goal.elev };
      }
      try { el.setPointerCapture(ev.pointerId); } catch {}
    });
    el.addEventListener('pointermove', (ev) => {
      if (cur) {
        this.ray(ev);
        if (this._ray.ray.intersectPlane(plane, hit)) cur.move?.(cur.mesh.parent ? this.#rootOf(cur.mesh).worldToLocal(hit.clone()) : hit.clone());
        this.dirty = true;
      } else if (turn) {
        if (Math.hypot(ev.clientX - turn.x, ev.clientY - turn.y) > 5) turn.moved = true;
        this.handlers.turnMove?.(ev, turn);
      } else if (orbit) {
        if (this.stacked && Math.abs(ev.clientY - orbit.y) > Math.abs(ev.clientX - orbit.x) * 1.5 && !orbit.locked) { orbit = null; return; }
        orbit.locked = true;
        this.goal.yaw = Math.max(-0.75, Math.min(0.75, orbit.yaw - (ev.clientX - orbit.x) * 0.004));
        this.goal.elev = Math.max(0.3, Math.min(1.32, orbit.elev + (ev.clientY - orbit.y) * 0.003));
        this.dirty = true;
      } else if (ev.pointerType === 'mouse') {
        this.ray(ev);
        if (!this.handlers.busy?.() && pick()) { el.style.cursor = 'grab'; if (hover) { hover = 0; this.handlers.turnHover?.(null); } return; }
        const z = this.turnZone(ev), dir = z && this.handlers.canTurn?.(z.dir) ? z.dir : 0;
        el.style.cursor = dir ? 'pointer' : 'default';
        if (dir !== hover || dir) { hover = dir; this.handlers.turnHover?.(dir ? z : null); }
      }
    });
    const up = (ev) => {
      cur?.end?.();
      if (turn) this.handlers.turnEnd?.(ev, turn, ev.type === 'pointercancel');
      cur = null; orbit = null; turn = null; el.style.cursor = 'default';
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', () => { if (hover) { hover = 0; this.handlers.turnHover?.(null); } });
    el.addEventListener('dblclick', (ev) => {
      const h = this.book.pageHit(this.ray(ev).ray, this._hit);
      if (this.stacked || !h) { this.resetView(); return; }
      const want = h.side < 0 ? 'left' : 'right';
      this.frame(false, this.shot === want ? 'spread' : want);
    });
  }
  #rootOf(o) { while (o.parent && o.parent !== this.scene) o = o.parent; return o; }
}
