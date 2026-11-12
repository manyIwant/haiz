// HAIZ 实验册 · 墨线工具箱
// 白模 + 墨线的小零件：所有实验都用这里的积木搭出来。
// 图层约定：0 = 会被描边/排线的实体；1 = 只上色（液体、光、轨迹）；2 = 玻璃（只描边，几乎透明）；
//           3 = 只描边、不排线的实体（写字的底板等）。
import * as THREE from 'three';

export { THREE };
export const L = { INK: 0, COLOR: 1, GLASS: 2, CLEAN: 3 };
export const C = {
  ink: '#1e2b36', paper: '#fcf9f1', shade: '#e9e4d6', copper: '#b4653a', green: '#1f4a3e',
  violet: '#7a5cff', leaf: '#2fb46a', amber: '#ffb52e', flame: '#ff6a3d', sky: '#3a9cff',
  rose: '#ff5d8f', teal: '#19c2b0', red: '#e5483f', blue: '#3b6fe0', metal: '#dfe3e6', wood: '#ead9b8',
};
export const FONT = {
  hand: '"Kaiti SC","STKaiti","KaiTi","楷体","AR PL UKai CN","LXGW WenKai",cursive',
  serif: 'Georgia,"Songti SC","Noto Serif CJK SC","Source Han Serif SC","SimSun",serif',
};
export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const toV = (p) => (p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2] || 0));
const Y = new THREE.Vector3(0, 1, 0);

function mk(geo, mat, layer) {
  const m = new THREE.Mesh(geo, mat);
  m.layers.set(layer);
  m.castShadow = layer === L.INK;
  m.receiveShadow = layer === L.INK;
  return m;
}
/** 会被描边的白模实体 */
export function solid(geo, color = C.paper) {
  return mk(geo, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }), L.INK);
}
/** 只上色、不描边（液体、发光体、色块） */
export function flat(geo, color, o = {}) {
  const transparent = o.opacity !== undefined && o.opacity < 1;
  return mk(geo, new THREE.MeshBasicMaterial({
    color, transparent, opacity: o.opacity ?? 1, depthWrite: !transparent, side: o.side ?? THREE.DoubleSide,
  }), L.COLOR);
}
/** 玻璃：只有墨线轮廓 */
export function glass(geo) {
  return mk(geo, new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide,
  }), L.GLASS);
}
/** 让一个实体只描边、不排线、不受光（适合当写字的白底板） */
export const clean = (m) => { m.layers.set(L.CLEAN); const c = m.material.color; m.material.dispose(); m.material = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }); m.receiveShadow = false; return m; };
export const at = (o, x = 0, y = 0, z = 0) => { o.position.set(x, y, z); return o; };
export const rot = (o, x = 0, y = 0, z = 0) => { o.rotation.set(x, y, z); return o; };
export function group(...kids) { const g = new THREE.Group(); kids.forEach((k) => k && g.add(k)); return g; }

// ---------- 基本形体（底面在 y = 0） ----------
export function box(w, h, d, color) { return solid(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), color); }
export function cyl(r, h, color, o = {}) {
  return solid(new THREE.CylinderGeometry(o.top ?? r, r, h, o.seg ?? 36, 1, !!o.open).translate(0, h / 2, 0), color);
}
export function ball(r, color) { return solid(new THREE.SphereGeometry(r, 32, 20), color); }
export function cone(r, h, color, o = {}) {
  return solid(new THREE.ConeGeometry(r, h, o.seg ?? 32, 1, !!o.open).translate(0, h / 2, 0), color);
}
export function torus(R, r, color, arc = TAU) {
  return solid(new THREE.TorusGeometry(R, r, 12, 56, arc).rotateX(Math.PI / 2), color);
}
export function plate(w, d, color, h = 0.08) { return box(w, h, d, color); }
/** 两点之间的杆。r 很小时自然变成一条墨线。 */
export function rod(a, b, r = 0.05, color = C.paper) {
  const m = solid(new THREE.CylinderGeometry(r, r, 1, 10).translate(0, 0.5, 0), color);
  const d = new THREE.Vector3();
  m.span = (p, q) => {
    p = toV(p); q = toV(q);
    d.subVectors(q, p);
    const len = Math.max(d.length(), 1e-4);
    m.position.copy(p); m.scale.set(1, len, 1);
    m.quaternion.setFromUnitVectors(Y, d.divideScalar(len));
    return m;
  };
  return m.span(a, b);
}
/** 墨线：细到只剩笔画的杆 */
export function wire(a, b, r = 0.022) { const m = rod(a, b, r, C.ink); m.castShadow = false; return m; }
/** 沿折线/曲线的管 */
export function tube(pts, r = 0.06, color = C.paper, o = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map(toV), !!o.closed, 'catmullrom', o.tension ?? 0.5);
  const m = solid(new THREE.TubeGeometry(curve, o.seg ?? Math.max(24, pts.length * 8), r, 8, !!o.closed), color);
  if (r < 0.04) m.castShadow = false;
  return m;
}
/** 弹簧：单位长度的螺旋，用 span 拉伸 */
export function spring(turns = 10, r = 0.25, wireR = 0.035, color = C.metal) {
  const pts = [];
  const n = turns * 14;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = t * turns * TAU;
    const k = Math.min(1, t * 12, (1 - t) * 12);
    pts.push(new THREE.Vector3(Math.cos(a) * r * k, t, Math.sin(a) * r * k));
  }
  const m = solid(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, wireR, 6, false), color);
  const d = new THREE.Vector3();
  m.span = (p, q) => {
    p = toV(p); q = toV(q); d.subVectors(q, p);
    const len = Math.max(d.length(), 1e-4);
    m.position.copy(p); m.scale.set(1, len, 1);
    m.quaternion.setFromUnitVectors(Y, d.divideScalar(len));
    return m;
  };
  return m;
}
/** 箭头（力、速度、电流方向）。set(from, to) */
export function arrow(color = C.copper, r = 0.045) {
  const shaft = flat(new THREE.CylinderGeometry(r, r, 1, 8).translate(0, 0.5, 0), color);
  const head = flat(new THREE.ConeGeometry(r * 3.2, r * 8, 12).translate(0, r * 4, 0), color);
  const g = group(shaft, head);
  const d = new THREE.Vector3();
  g.set = (p, q) => {
    p = toV(p); q = toV(q); d.subVectors(q, p);
    const len = d.length();
    g.visible = len > r * 4;
    if (!g.visible) return g;
    const hl = Math.min(r * 8, len * 0.6);
    g.position.copy(p);
    g.quaternion.setFromUnitVectors(Y, d.divideScalar(len));
    shaft.scale.y = len - hl; head.position.y = len - hl; head.scale.setScalar(hl / (r * 8));
    return g;
  };
  return g;
}

// ---------- 可更新的色带（轨迹、光线、波形） ----------
/** 在给定法向的平面内画一条有宽度的线。set(points) */
export function strip(max = 200, o = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 2 * 3);
  const idx = [];
  for (let i = 0; i < max - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const m = flat(geo, o.color ?? C.ink, { opacity: o.opacity });
  m.frustumCulled = false;
  m.nrm = toV(o.normal ?? [0, 0, 1]).clone().normalize(); // 可在运行中改写
  const nrm = m.nrm;
  const w = (o.w ?? 0.05) / 2;
  const t = new THREE.Vector3(), s = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  m.set = (pts) => {
    const n = Math.min(pts.length, max);
    for (let i = 0; i < n; i++) {
      a.copy(toV(pts[Math.max(0, i - 1)])); b.copy(toV(pts[Math.min(n - 1, i + 1)]));
      t.subVectors(b, a); s.crossVectors(t, nrm);
      if (s.lengthSq() < 1e-10) s.set(1, 0, 0);
      s.normalize().multiplyScalar(w);
      const p = toV(pts[i]);
      pos.set([p.x + s.x, p.y + s.y, p.z + s.z, p.x - s.x, p.y - s.y, p.z - s.z], i * 6);
    }
    geo.setDrawRange(0, Math.max(0, n - 1) * 6);
    geo.attributes.position.needsUpdate = true;
    return m;
  };
  if (o.pts) m.set(o.pts);
  return m;
}
/** 虚线（画在纸面或空间里的辅助线） */
export function dash(a, b, o = {}) {
  a = toV(a); b = toV(b);
  const len = a.distanceTo(b), unit = (o.len ?? 0.22) + (o.gap ?? 0.16);
  const n = Math.max(1, Math.floor(len / unit));
  const g = new THREE.BoxGeometry(o.w ?? 0.04, o.len ?? 0.22, o.w ?? 0.04).translate(0, (o.len ?? 0.22) / 2, 0);
  const im = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: o.color ?? C.ink }), n);
  im.layers.set(L.COLOR);
  const dir = b.clone().sub(a).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(Y, dir);
  const mtx = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < n; i++) {
    mtx.compose(a.clone().addScaledVector(dir, i * unit), q, one);
    im.setMatrixAt(i, mtx);
  }
  return im;
}

// ---------- 发光 ----------
let _glowTex;
function glowTex() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.55)');
  g.addColorStop(0.7, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  _glowTex = new THREE.CanvasTexture(c); _glowTex.userData.shared = true;
  return _glowTex;
}
/** 一团彩色光晕 */
export function glow(color, size = 1, opacity = 0.45) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, depthWrite: false }));
  s.scale.setScalar(size); s.layers.set(L.COLOR);
  return s;
}
const lighten = (c, k = 0.35) => new THREE.Color(c).lerp(new THREE.Color('#ffffff'), k);
/** 玻璃筒 + 发光液体。fill(0..1) / tint(color) */
export function jar(r = 0.6, h = 1.8, color = C.violet, o = {}) {
  const wall = glass(new THREE.CylinderGeometry(r, r, h, 44, 1, true).translate(0, h / 2, 0));
  const base = glass(new THREE.CircleGeometry(r, 44).rotateX(-Math.PI / 2).translate(0, 0.03, 0));
  const liq = flat(new THREE.CylinderGeometry(r * 0.92, r * 0.92, 1, 44, 1, true).translate(0, 0.5, 0), color, { opacity: o.opacity ?? 0.78 });
  const top = flat(new THREE.CircleGeometry(r * 0.92, 44).rotateX(-Math.PI / 2), lighten(color), { opacity: 0.92 });
  const halo = glow(color, r * 4, 0.4);
  const g = group(liq, top, halo, wall, base);
  g.level = 0;
  g.fill = (f) => {
    f = clamp(f); g.level = f;
    const hh = Math.max(f * h * 0.95, 0.001);
    liq.scale.y = hh; liq.position.y = 0.04; top.position.y = 0.04 + hh;
    liq.visible = top.visible = halo.visible = f > 0.004;
    halo.position.y = hh * 0.5; halo.scale.set(r * 3.4 + hh * 0.6, r * 2 + hh * 1.5, 1);
    halo.material.opacity = (o.glow ?? 0.4) * Math.min(1, f * 5);
    return g;
  };
  g.tint = (c) => { liq.material.color.set(c); top.material.color.copy(lighten(c)); halo.material.color.set(c); return g; };
  return g.fill(o.fill ?? 0.5);
}

// ---------- 文字 ----------
const PPU = 120;
function fitCanvas(wWorld, hWorld) {
  const c = document.createElement('canvas');
  c.width = Math.min(2048, Math.ceil(wWorld * PPU)); c.height = Math.min(2048, Math.ceil(hWorld * PPU));
  return c;
}
/**
 * 文字牌。o.size 字高（书本单位）；o.card 带纸卡片底和墨线边；o.hand 手写体；
 * o.lay: 'up' 立着 | 'tilt' 斜靠朝向读者 | 'flat' 印在纸面上。set(text) 更新。
 */
export function label(text, o = {}) {
  const size = o.size ?? 0.34, pad = o.card ? size * 0.5 : size * 0.15;
  const font = `${o.bold ? 600 : 400} ${o.italic ? 'italic ' : ''}${Math.round(size * PPU)}px ${o.hand ? FONT.hand : FONT.serif}`;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font;
  const lines0 = String(text).split('\n');
  const wText = Math.max(...lines0.map((s) => probe.measureText(s).width)) / PPU;
  const w = o.w ?? wText + pad * 2, h = o.h ?? lines0.length * size * 1.32 + pad * 2;
  const c = fitCanvas(w, h), x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: !o.card, depthWrite: !!o.card, side: THREE.DoubleSide });
  const m = mk(new THREE.PlaneGeometry(w, h), mat, o.card ? L.INK : L.COLOR);
  m.receiveShadow = false; m.castShadow = !!o.card && o.lay !== 'flat';
  let last = null;
  m.set = (t) => {
    t = String(t);
    if (t === last) return m;
    last = t;
    const S = c.width / w, W = c.width, H = c.height;
    x.clearRect(0, 0, W, H);
    if (o.card) { x.fillStyle = o.bg ?? C.paper; x.fillRect(0, 0, W, H); }
    x.font = font.replace(/(\d+)px/, `${Math.round(size * S)}px`);
    x.fillStyle = o.color ?? C.ink; x.textBaseline = 'middle';
    x.textAlign = o.align ?? 'center';
    const ls = t.split('\n');
    const tx = x.textAlign === 'center' ? W / 2 : x.textAlign === 'right' ? W - pad * S : pad * S;
    ls.forEach((s, i) => x.fillText(s, tx, H / 2 + ((i - (ls.length - 1) / 2) * size * 1.32 + size * 0.04) * S));
    tex.needsUpdate = true;
    return m;
  };
  m.set(text);
  if (o.lay === 'flat') m.rotation.x = -Math.PI / 2;
  else if (o.lay === 'tilt') m.rotation.x = -0.8;
  m.w = w; m.h = h;
  return m;
}
/** 手写批注（无底） */
export const note = (text, o = {}) => label(text, { hand: true, size: 0.36, color: C.ink, ...o });
/** 数据卡片：立在纸面上的小纸牌 */
export function card(text, o = {}) {
  const m = label(text, { card: true, size: 0.36, lay: 'tilt', ...o });
  m.geometry.translate(0, m.h / 2, 0); // 以下边为轴立在纸面上
  return m;
}

/**
 * 手绘坐标图卡片。o: w,h（书本单位）xr,yr 范围，xl,yl 轴名。
 * 用法：g.clear(); g.curve(pts,color); g.dot(x,y,color); g.done();
 */
export function plot(o = {}) {
  const w = o.w ?? 3.6, h = o.h ?? 2.6;
  const c = fitCanvas(w, h), x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 8;
  const m = mk(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }), L.INK);
  m.receiveShadow = false;
  const S = c.width / w;
  const ml = 0.5, mr = 0.22, mt = 0.3, mb = 0.46;
  let xr = o.xr ?? [0, 1], yr = o.yr ?? [0, 1];
  const X = (v) => (ml + ((v - xr[0]) / (xr[1] - xr[0])) * (w - ml - mr)) * S;
  const Yp = (v) => (h - mb - ((v - yr[0]) / (yr[1] - yr[0])) * (h - mt - mb)) * S;
  m.range = (a, b) => { xr = a; yr = b; return m; };
  m.clear = () => {
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = C.paper; x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = 'rgba(30,43,54,.12)'; x.lineWidth = S * 0.012;
    for (let i = 1; i <= 4; i++) {
      const gx = X(xr[0] + ((xr[1] - xr[0]) * i) / 4), gy = Yp(yr[0] + ((yr[1] - yr[0]) * i) / 4);
      x.beginPath(); x.moveTo(gx, Yp(yr[0])); x.lineTo(gx, Yp(yr[1])); x.moveTo(X(xr[0]), gy); x.lineTo(X(xr[1]), gy); x.stroke();
    }
    x.strokeStyle = C.ink; x.lineWidth = S * 0.028; x.lineCap = 'round';
    x.beginPath(); x.moveTo(X(xr[0]), Yp(yr[1]) - S * 0.1); x.lineTo(X(xr[0]), Yp(yr[0])); x.lineTo(X(xr[1]) + S * 0.1, Yp(yr[0])); x.stroke();
    x.fillStyle = C.ink; x.textBaseline = 'middle';
    x.font = `${S * 0.2}px ${FONT.serif}`;
    x.textAlign = 'center';
    x.fillText(fmtTick(xr[0]), X(xr[0]), (h - mb + 0.17) * S); x.fillText(fmtTick(xr[1]), X(xr[1]), (h - mb + 0.17) * S);
    x.textAlign = 'right';
    x.fillText(fmtTick(yr[0]), (ml - 0.08) * S, Yp(yr[0])); x.fillText(fmtTick(yr[1]), (ml - 0.08) * S, Yp(yr[1]));
    x.font = `italic ${S * 0.24}px ${FONT.serif}`;
    x.textAlign = 'center';
    if (o.xl) x.fillText(o.xl, (ml + (w - ml - mr) / 2) * S, (h - 0.14) * S);
    if (o.yl) { x.textAlign = 'left'; x.fillText(o.yl, (ml + 0.1) * S, 0.17 * S); }
    if (o.title) { x.font = `${S * 0.2}px ${FONT.serif}`; x.textAlign = 'right'; x.fillStyle = C.copper; x.fillText(o.title, (w - 0.12) * S, 0.16 * S); }
    return m;
  };
  m.curve = (pts, color = C.ink, lw = 0.04, dashed) => {
    x.save(); x.beginPath(); x.rect(ml * S - 2, mt * S - S * 0.12, (w - ml - mr) * S + 4, (h - mt - mb) * S + S * 0.12 + 2); x.clip();
    x.strokeStyle = color; x.lineWidth = S * lw; x.lineJoin = 'round'; x.setLineDash(dashed ? [S * 0.08, S * 0.08] : []);
    x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(X(p[0]), Yp(p[1])) : x.moveTo(X(p[0]), Yp(p[1])))); x.stroke();
    x.restore(); return m;
  };
  m.fn = (f, color, lw, dashed, n = 80) => {
    const pts = []; for (let i = 0; i <= n; i++) { const v = xr[0] + ((xr[1] - xr[0]) * i) / n; pts.push([v, f(v)]); }
    return m.curve(pts, color, lw, dashed);
  };
  m.dot = (px, py, color = C.copper, r = 0.07) => {
    x.fillStyle = color; x.beginPath(); x.arc(X(px), Yp(py), S * r, 0, TAU); x.fill();
    x.strokeStyle = C.ink; x.lineWidth = S * 0.016; x.setLineDash([]); x.stroke(); return m;
  };
  m.text = (px, py, s, color = C.ink, size = 0.2) => {
    x.fillStyle = color; x.font = `${S * size}px ${FONT.hand}`; x.textAlign = 'left'; x.textBaseline = 'middle';
    x.fillText(s, X(px), Yp(py)); return m;
  };
  m.done = () => { tex.needsUpdate = true; return m; };
  m.w = w; m.h = h;
  m.geometry.translate(0, h / 2, 0); // 以下边为轴立在纸面上
  m.rotation.x = o.lay === 'up' ? 0 : -0.8;
  return m.clear().done();
}
function fmtTick(v) { return Math.abs(v) >= 100 || Number.isInteger(v) ? String(Math.round(v)) : String(+v.toFixed(2)); }

/** 一群小球（分子、珠子、粒子）。put(i,x,y,z,scale) → done() */
export function dots(n, r = 0.08, color = C.paper, o = {}) {
  const geo = new THREE.SphereGeometry(r, o.seg ?? 14, 10);
  const mat = o.flat ? new THREE.MeshBasicMaterial({ color, transparent: o.opacity < 1, opacity: o.opacity ?? 1 })
    : new THREE.MeshLambertMaterial({ color });
  const im = new THREE.InstancedMesh(geo, mat, n);
  im.layers.set(o.flat ? L.COLOR : L.INK);
  im.castShadow = !o.flat && !!o.shadow; im.frustumCulled = false;
  const mtx = new THREE.Matrix4();
  im.put = (i, x, y, z, s = 1) => { mtx.makeScale(s, s, s).setPosition(x, y, z); im.setMatrixAt(i, mtx); return im; };
  im.paint = (i, c) => { im.setColorAt(i, _col.set(c)); return im; };
  im.done = () => { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; return im; };
  for (let i = 0; i < n; i++) im.put(i, 0, -50, 0, 0.001);
  return im;
}
const _col = new THREE.Color();

/** 烧杯/容器里的一段彩色液体柱（不带玻璃） */
export function liquid(r, h, color, opacity = 0.75) {
  const body = flat(new THREE.CylinderGeometry(r, r, 1, 40, 1, true).translate(0, 0.5, 0), color, { opacity });
  const top = flat(new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2), lighten(color), { opacity: 0.9 });
  const g = group(body, top);
  g.set = (hh, c) => {
    hh = Math.max(hh, 0.001); body.scale.y = hh; top.position.y = hh; g.visible = hh > 0.01;
    if (c) { body.material.color.set(c); top.material.color.copy(lighten(c)); }
    return g;
  };
  g.fade = (op) => { body.material.opacity = op; top.material.opacity = Math.min(1, op + 0.15); return g; };
  return g.set(h);
}

/**
 * 一张可以自己画的纸（光屏、量角器、地图…）。draw(ctx, S, w, h)：S 为每书本单位的像素数。
 * o.lay:'flat' 平铺在纸面；o.ink 参与描边；o.opaque 不透明。redraw(draw) 重画。
 */
export function sheet(w, h, draw, o = {}) {
  const c = fitCanvas(w, h), x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 8;
  const m = mk(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: !o.opaque, depthWrite: !!o.opaque, side: THREE.DoubleSide }), o.ink ? L.INK : L.COLOR);
  m.castShadow = false; m.receiveShadow = false;
  m.redraw = (fn) => { x.clearRect(0, 0, c.width, c.height); fn(x, c.width / w, w, h); tex.needsUpdate = true; return m; };
  if (o.lay === 'flat') m.rotation.x = -Math.PI / 2;
  else if (o.lay === 'tilt') { m.geometry.translate(0, h / 2, 0); m.rotation.x = -0.8; }
  m.w = w; m.h = h;
  return m.redraw(draw);
}

/** 表头（电流表 A、电压表 V、灵敏电流计 G）。set(f, text)：f 为指针位置 0..1（o.center 时 −1..1） */
export function meter(sym, o = {}) {
  const w = o.w ?? 1.7, h = o.h ?? 1.2;
  const body = solid(new THREE.BoxGeometry(w, h, 0.3).translate(0, h / 2, -0.16));
  const c = fitCanvas(w * 0.9, h * 0.86), x = c.getContext('2d'), S = c.width / (w * 0.9);
  x.fillStyle = '#fffdf8'; x.fillRect(0, 0, c.width, c.height);
  const cx = c.width / 2, cy = c.height * 0.92, R = c.height * 0.72;
  x.strokeStyle = C.ink; x.lineWidth = S * 0.02; x.lineCap = 'round';
  x.beginPath(); x.arc(cx, cy, R, Math.PI * 1.22, Math.PI * 1.78); x.stroke();
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * (1.22 + 0.056 * i), l = i % 5 === 0 ? 0.14 : 0.07;
    x.beginPath(); x.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); x.lineTo(cx + Math.cos(a) * R * (1 - l), cy + Math.sin(a) * R * (1 - l)); x.stroke();
  }
  x.fillStyle = C.copper; x.font = `italic 600 ${S * 0.3}px ${FONT.serif}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(sym, cx, c.height * 0.66);
  const face = mk(new THREE.PlaneGeometry(w * 0.9, h * 0.86), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }), L.COLOR);
  face.position.set(0, h / 2, 0.005); face.castShadow = false;
  const needle = rod([0, 0, 0], [0, h * 0.62, 0], 0.018, C.red); needle.castShadow = false;
  const pivot = group(needle); pivot.position.set(0, h * 0.11, 0.05);
  const read = label(o.text ?? '0', { size: 0.3, w: w * 1.15, bold: true });
  read.position.set(0, h + 0.3, 0);
  const g = group(body, face, pivot, read);
  g.rotation.x = -0.8;
  g.set = (f, text) => {
    pivot.rotation.z = o.center ? -clamp(f, -1, 1) * 0.86 : (0.5 - clamp(f)) * 1.72;
    if (text !== undefined) read.set(text);
    return g;
  };
  return g.set(o.center ? 0 : 0);
}

/** 上升的气泡。step(dt, 每秒个数, 液面高度) */
export function bubbler(n, o = {}) {
  const d = dots(n, o.r ?? 0.06, '#ffffff');
  const st = Array.from({ length: n }, () => ({ y: -1, x: 0, z: 0, ph: 0, s: 1 }));
  let acc = 0;
  d.step = (dt, rate, y1 = o.y1) => {
    acc = Math.min(acc + rate * dt, 3);
    st.forEach((b, i) => {
      if (b.y < 0) {
        if (acc >= 1) {
          acc -= 1; b.y = o.y0 ?? 0.1;
          const a = Math.random() * TAU, rr = Math.sqrt(Math.random()) * (o.rad ?? 0.3);
          b.x = Math.cos(a) * rr; b.z = Math.sin(a) * rr; b.ph = Math.random() * 6; b.s = 0.6 + Math.random() * 0.8;
        }
      } else { b.y += dt * (o.speed ?? 1.6) * (0.7 + b.s * 0.4); if (b.y > y1) b.y = -1; }
      if (b.y < 0) d.put(i, 0, -50, 0, 0.001);
      else d.put(i, (o.x ?? 0) + b.x + Math.sin(b.ph + b.y * 4) * 0.04, b.y, (o.z ?? 0) + b.z, b.s);
    });
    d.done();
  };
  return d;
}

/** 沿一条路径流动的小光点（电流、气流、水流）。step(dt, 速度) 速度可为负 */
export function flow(pts, n, color, o = {}) {
  const P = pts.map(toV); if (o.closed) P.push(P[0].clone());
  const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + P[i].distanceTo(P[i - 1]));
  const total = cum[cum.length - 1];
  const d = dots(n, o.r ?? 0.075, color, { flat: true });
  const v = new THREE.Vector3(); let ph = 0;
  d.step = (dt, speed) => {
    ph = (ph + (dt * speed) / total) % 1; if (ph < 0) ph += 1;
    for (let i = 0; i < n; i++) {
      const u = ((i / n + ph) % 1) * total;
      let j = 1; while (j < cum.length - 1 && cum[j] < u) j++;
      v.lerpVectors(P[j - 1], P[j], (u - cum[j - 1]) / Math.max(1e-6, cum[j] - cum[j - 1]));
      d.put(i, v.x, v.y, v.z);
    }
    d.done();
  };
  d.step(0, 0);
  return d;
}

/** 铁架台：底座 + 立柱（+ 横臂）。返回 group */
export function stand(h = 6, arm = 0) {
  const g = group(plate(2.6, 1.9), at(cyl(0.1, h), -0.9, 0.08, 0));
  if (arm) g.add(rod([-0.9, h - 0.2, 0], [-0.9 + arm, h - 0.2, 0], 0.08), at(box(0.42, 0.3, 0.42), -0.9, h - 0.35, 0));
  return g;
}

/** 可见光波长（nm）→ 颜色 */
export function wavelength(nm) {
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = (440 - nm) / 60; b = 1; } else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = (510 - nm) / 20; } else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = (645 - nm) / 65; } else { r = 1; }
  const f = nm < 420 ? 0.35 + 0.65 * (nm - 380) / 40 : nm > 700 ? 0.35 + 0.65 * (780 - nm) / 80 : 1;
  return new THREE.Color(clamp(r) * f, clamp(g) * f, clamp(b) * f);
}

/** 数字格式：有效数字 */
export function sig(v, n = 3) {
  if (!isFinite(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e5 || a < 1e-3) {
    const e = Math.floor(Math.log10(a));
    return `${(v / 10 ** e).toFixed(Math.max(0, n - 1))}×10${String(e).replace(/-/g, '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d])}`;
  }
  const d = Math.max(0, n - 1 - Math.floor(Math.log10(a)));
  return v.toFixed(Math.min(d, 6));
}

/** 释放一棵子树里的显存 */
export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    ms.forEach((m) => { if (m.map && !m.map.userData.shared) m.map.dispose(); m.dispose(); });
  });
}
