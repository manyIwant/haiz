// 《春天没有收件人》 — part two: the world. renderAt(t) for film time t (seconds).
import * as THREE from 'three';
import { loadWorld, setLighting, setEnv, captureEnv, B, U } from './world.js';
import { Pipeline } from './pipeline.js';
import { addNature, makePetals, makeDust } from './nature.js';

const W_ = 1920, H_ = 1080;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const eio = (k) => (k = clamp(k), k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const sm = (k) => (k = clamp(k), k * k * (3 - 2 * k));
const ramp = (t, a, b, f = sm) => f((t - a) / (b - a));
const fade = (t, a, b, c, d) => (t <= a || t >= d) ? 0 : t < b ? sm((t - a) / (b - a)) : t <= c ? 1 : 1 - sm((t - c) / (d - c));
function noise1(x) { const i = Math.floor(x), f = x - i; const h = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }; const u = f * f * (3 - 2 * f); return lerp(h(i), h(i + 1), u) * 2 - 1; }

// ------------------------------------------------------------------ grades
const GRADE = {
  dusk:    { exposure: 0.85, lift: [0.012, 0.010, 0.024], gamma: [1, 1, 1], gain: [1.07, 0.99, 0.88], sat: 1.06, contrast: 1.08, bloom: 0.06, vign: 0.32, grain: 0.032 },
  night:   { exposure: 5.0, lift: [0.006, 0.010, 0.022], gamma: [1, 1, 1.02], gain: [0.94, 0.98, 1.06], sat: 0.85, contrast: 1.08, bloom: 0.09, vign: 0.38, grain: 0.04 },
  morning: { exposure: 1.05, lift: [0.024, 0.028, 0.034], gamma: [1, 1, 1], gain: [0.99, 1.0, 1.02], sat: 0.9, contrast: 0.94, bloom: 0.04, vign: 0.22, grain: 0.028 },
  dawn:    { exposure: 26.0, lift: [0.012, 0.016, 0.03], gamma: [1, 1, 1.03], gain: [0.93, 0.97, 1.06], sat: 0.8, contrast: 0.98, bloom: 0.05, vign: 0.3, grain: 0.036 },
  room:    { exposure: 1.6 },
};
function mixGrade(a, b, k) {
  const out = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[key] ?? b[key], y = b[key] ?? a[key];
    out[key] = Array.isArray(x) ? x.map((v, i) => lerp(v, y[i], k)) : lerp(x, y, k);
  }
  return out;
}
const FOG = {
  dusk:    { col: [0.80, 0.64, 0.55], sun: [1.0, 0.62, 0.34], d: 0.0011 },
  night:   { col: [0.0035, 0.0048, 0.0095], sun: [0.004, 0.005, 0.009], d: 0.0016 },
  morning: { col: [0.70, 0.78, 0.88], sun: [0.95, 0.93, 0.86], d: 0.0006 },
  dawn:    { col: [0.0125, 0.0140, 0.0240], sun: [0.020, 0.016, 0.018], d: 0.0013 },
};

// ------------------------------------------------------------------ text
const L = (t0, t1, text, pos = {}) => ({ t0, t1, text, ...pos });
const POS = {
  low: { x: 168, y: 868 }, lowR: { x: 1752, y: 868, align: 'right' }, high: { x: 168, y: 170 }, highR: { x: 1752, y: 170, align: 'right' },
  mid: { x: 960, y: 880, align: 'center' }, vR: { x: 1700, y: 150, v: true }, vL: { x: 160, y: 150, v: true },
};
const TEXT = [
  // 《失物招领》
  { t0: 46.0, t1: 50.6, text: '失物招领', cls: 'title', x: 1690, y: 150, v: true },
  { t0: 46.6, t1: 50.6, note: '诗稿 · 此前人机共创，经人工修改 · 不是这次程序的输出', x: 1600, y: 980, align: 'right' },
  L(50.0, 54.4, '后来天空学会了失物招领', POS.high),
  L(54.6, 59.0, '有人在教室捡到旧时间', POS.low),
  L(59.2, 63.6, '信里写着：一场雨留给黄昏', POS.lowR),
  L(64.6, 68.8, '河流认出了窗户', POS.high),
  L(69.0, 73.2, '夜晚把名字弄丢了', POS.low),
  L(73.6, 78.0, '后来车站把名字交给了风', POS.high),
  L(79.4, 83.8, '请把钥匙放在靠窗的位置', POS.low),
  L(84.4, 88.6, '时钟没有归还那把钥匙', POS.lowR),
  L(88.8, 93.0, '那年我们把自己的名字弄丢了', POS.low),
  L(93.2, 98.2, '我在黑夜里排队，等春天来领走明天', POS.mid),
  L(99.2, 104.6, '直到影子认出了另一个早晨。', POS.low),
  // 《春天没有收件人》
  { t0: 106.0, t1: 110.8, text: '春天没有收件人', cls: 'title', x: 210, y: 150, v: true },
  { t0: 106.6, t1: 110.8, note: '诗稿 · 此前人机共创，经人工修改 · 不是这次程序的输出', x: 330, y: 980 },
  L(111.4, 116.0, '凌晨有人问时间会不会认错回家的路', POS.mid),
  L(116.4, 120.8, '月亮走过操场，捡到没有寄出的路', POS.high),
  L(121.4, 125.8, '风把远方塞进了半开的回信', POS.lowR),
  L(126.4, 131.0, '雨停以后河流替山记住了全部花期', POS.low),
  L(132.6, 137.6, '河流还不知道自己的名字', { x: 960, y: 760, align: 'center' }),
  L(140.0, 144.4, '春天带走了每一个没有地址的夏天', POS.lowR),
  L(145.0, 149.4, '黄昏把远方塞进了空椅子', POS.low),
  L(150.0, 154.6, '钟表背着所有来不及说的话，还给树', POS.mid),
  L(155.0, 159.4, '回声在黎明之前又叫了一个秋天', POS.high),
  L(160.6, 166.8, '我把一段沉默交给了凌晨的河。', { x: 960, y: 880, align: 'center' }),
];
const END = { a: 171.6, b: 178.6 };

// ------------------------------------------------------------------ shots
// Camera keys use Blender coordinates: p = position, l = look-at, f = vertical fov.
// Shots marked cont:true continue the previous shot's camera without a cut.
const K = (t, p, l, f = 50) => ({ t, p, l, f });
const SHOTS = [
  { name: 'mirror', t0: 42.0, t1: 49.0, light: 'dusk', env: [-12, 0, 3],
    cam: [K(42.0, [-11.5, 1.0, 3.4], [-11.5, 1.03, 0], 46), K(44.4, [-12.2, 0.2, 3.3], [-11.0, 3.0, 0], 46), K(46.6, [-17.5, -6.5, 2.6], [-8.0, 2.0, 2.8], 46), K(49.0, [-24.5, -13.0, 2.1], [-6.0, 1.5, 5.2], 46)],
    water: (t) => ({ termMix: 1 - ramp(t, 42.4, 45.8), chop: 0.22 * ramp(t, 42.6, 45.0), rippleAmt: 0.55 * (1 - ramp(t, 45.5, 48.5)), rippleT: Math.max(0, t - 42.15), rippleC: [-11.5, 1.0] }) },
  { name: 'glide', t0: 49.0, t1: 58.0, light: 'dusk', env: [-10, 0, 2.5], cont: true,
    cam: [K(49.0, [-24.5, -13.0, 2.1], [-6.0, 1.5, 5.2], 46), K(52.8, [-15.5, -4.0, 2.2], [-6.0, 0.0, 3.2], 50), K(55.8, [-8.6, -0.15, 2.62], [-5.0, 0.0, 2.65], 52), K(58.0, [-5.25, 0.05, 2.62], [-2.0, 0.7, 2.35], 56)] },
  { name: 'letter', t0: 58.0, t1: 63.6, light: 'dusk', env: [-3, 0, 2.5], cont: true, interior: true, shafts: 1.0, dust: 1.0,
    cam: [K(58.0, [-5.25, 0.05, 2.62], [-2.0, 0.7, 2.35], 56), K(60.4, [-3.55, 0.05, 2.18], [-5.1, 1.55, 1.78], 48), K(63.6, [-3.75, 0.32, 2.08], [-5.35, 1.85, 1.86], 42)] },
  { name: 'out', t0: 63.6, t1: 72.0, light: (t) => ['dusk', 'night', ramp(t, 68.4, 73.0)], env: [-10, 0, 2], cont: true,
    cam: [K(63.6, [-3.75, 0.32, 2.08], [-5.35, 1.85, 1.86], 42), K(65.2, [-4.7, 0.0, 2.62], [-7.2, -0.1, 2.5], 50), K(66.6, [-6.7, 0.0, 2.66], [-10, 0.0, 2.1], 52), K(68.8, [-14.2, -2.2, 0.95], [-6.0, 1.0, 3.2], 44), K(72.0, [-16.4, 3.0, 1.05], [-12.5, 30.0, 1.6], 46)],
    interiorUntil: 65.9, shaftsUntil: 65.4,
    altRefl: { lit: 1, mix: (t) => fade(t, 66.4, 67.6, 71.0, 72.0) } },
  { name: 'north', t0: 72.0, t1: 79.0, light: 'night', env: [-12, 50, 2], cont: true, wind: (t) => 0.4 + 0.9 * fade(t, 73.2, 74.6, 77.4, 79.0),
    cam: [K(72.0, [-16.4, 3.0, 1.05], [-12.5, 30.0, 1.6], 46), K(75.6, [-15.0, 44.0, 1.3], [-6.0, 70.0, 2.2], 45), K(79.0, [-10.6, 66.4, 1.62], [-3.2, 75.8, 2.6], 40)] },
  { name: 'key', t0: 79.0, t1: 84.0, light: 'night', env: [-2, 72, 2.2],
    cam: [K(79.0, [-1.55, 72.6, 2.24], [0.645, 74.2, 2.09], 36), K(84.0, [-0.75, 73.45, 2.2], [0.655, 74.25, 2.09], 32)] },
  { name: 'clock', t0: 84.0, t1: 92.6, light: 'night', env: [-3, 72, 2.2], wind: 0.5,
    cam: [K(84.0, [-4.6, 69.0, 2.3], [-2.0, 72.0, 3.95], 30), K(87.6, [-4.9, 70.0, 2.25], [-2.05, 72.2, 3.9], 30), K(92.6, [-5.6, 72.4, 2.05], [-3.25, 75.8, 2.6], 34)] },
  { name: 'queue', t0: 92.6, t1: 98.4, light: 'night', env: [-1, 68, 2.2],
    cam: [K(92.6, [-2.8, 63.2, 1.75], [0.0, 69.0, 1.9], 44), K(98.4, [-2.4, 64.6, 1.72], [0.2, 70.2, 1.9], 42)] },
  { name: 'sweep', t0: 98.4, t1: 105.4, light: 'sweep', env: [-2, 0, 2.6], interior: true, shafts: 1.2, dust: 1.0,
    cam: [K(98.4, [0.95, -4.65, 2.65], [-4.2, 2.4, 1.55], 62), K(105.4, [0.85, -4.35, 2.6], [-4.3, 2.6, 1.55], 60)] },
  { name: 'morning', t0: 105.4, t1: 111.0, light: 'morning', env: [-20, -20, 2],
    cam: [K(105.4, [-26.5, -31.0, 1.8], [-6.0, 12.0, 3.6], 52), K(111.0, [-25.6, -27.6, 1.85], [-6.0, 14.0, 3.6], 52)] },
  { name: 'roomclock', t0: 111.0, t1: 116.0, light: 'morning', env: [-2, 1, 2.6], interior: true, clockBack: true,
    cam: [K(111.0, [-2.05, 1.5, 2.62], [-2.13, 4.94, 3.68], 32), K(116.0, [-2.08, 1.9, 2.75], [-2.13, 4.94, 3.7], 26)] },
  { name: 'track', t0: 116.0, t1: 121.0, light: 'morning', env: [-14, 0, 2], moon: 1,
    cam: [K(116.0, [-11.0, -9.0, 3.4], [-18.5, -2.0, -1.7], 50), K(121.0, [-11.4, -3.0, 3.3], [-19.0, 3.8, -1.7], 50)],
    water: () => ({ clarity: 1, chop: 0.12, flow: 0.4 }) },
  { name: 'sash', t0: 121.0, t1: 126.0, light: 'morning', env: [-3, 0, 2.5], interior: true, wind: 1.0, sash: 38,
    cam: [K(121.0, [-4.35, -1.75, 2.3], [-5.85, 0.25, 2.55], 44), K(126.0, [-4.45, -1.5, 2.25], [-5.85, 0.3, 2.45], 40)] },
  { name: 'blossom', t0: 126.0, t1: 131.6, light: 'morning', env: [-20, 10, 1.5], petals: true,
    cam: [K(126.0, [-19.0, 6.0, 0.75], [-40.0, 20.0, 2.6], 48), K(131.6, [-20.5, 9.0, 0.72], [-40.0, 24.0, 2.6], 48)],
    altRefl: { blossom: 1, mix: () => 1 } },
  { name: 'forget', t0: 131.6, t1: 139.6, light: 'morning', env: [-20, -20, 2],
    cam: [K(131.6, [-21.0, -36.0, 1.55], [-21.0, 40.0, 2.0], 54), K(139.6, [-21.0, -35.4, 1.55], [-21.0, 40.0, 2.0], 54)],
    water: (t) => ({ chop: 0.22 * (1 - ramp(t, 132.4, 134.2)), flow: 1 - ramp(t, 132.4, 134.6), blank: ramp(t, 134.6, 137.4) }) },
  { name: 'bridge', t0: 139.6, t1: 144.6, light: 'morning', env: [-22, -60, 2],
    cam: [K(139.6, [-27.5, -52.0, 1.2], [-21.0, -70.0, 2.4], 50), K(144.6, [-26.8, -55.0, 1.25], [-21.0, -70.0, 2.4], 50)] },
  { name: 'bench', t0: 144.6, t1: 149.6, light: 'morning', env: [-1, 86, 2],
    cam: [K(144.6, [0.55, 85.4, 1.72], [-12.0, 89.0, 1.55], 46), K(149.6, [0.35, 86.2, 1.7], [-12.0, 89.6, 1.55], 46)] },
  { name: 'stclock', t0: 149.6, t1: 154.6, light: 'morning', env: [-3, 70, 2.5], wind: 0.6,
    cam: [K(149.6, [-5.4, 64.6, 1.95], [-2.0, 72.0, 3.95], 36), K(154.6, [-5.2, 65.6, 2.0], [-2.0, 72.0, 3.95], 34)] },
  { name: 'dawnfall', t0: 154.6, t1: 159.6, light: (t) => ['morning', 'dawn', ramp(t, 155.0, 158.6)], env: [-14, 50, 2], mist: (t) => ramp(t, 155.5, 159.6) * 0.5,
    cam: [K(154.6, [-14.0, 62.0, 1.6], [-10.0, 10.0, 2.6], 50), K(159.6, [-14.2, 59.5, 1.6], [-10.0, 8.0, 2.6], 50)] },
  { name: 'silence', t0: 159.6, t1: 171.6, light: 'dawn', env: [-4, 0, 2.5], interior: true, mist: 0.55, sash: 30,
    cam: [K(159.6, [-4.55, -0.65, 2.78], [-9.5, 0.5, 0.5], 46), K(171.6, [-4.95, -0.42, 2.72], [-9.5, 0.6, 0.4], 44)] },
];

// ------------------------------------------------------------------ camera
function camKeysAt(t) {
  // continuous groups: shots chained with cont:true share one spline
  let i = SHOTS.findIndex(s => t >= s.t0 && t < s.t1); if (i < 0) i = t < SHOTS[0].t0 ? 0 : SHOTS.length - 1;
  let a = i, b = i;
  while (a > 0 && SHOTS[a].cont) a--;
  while (b < SHOTS.length - 1 && SHOTS[b + 1].cont) b++;
  const keys = [];
  for (let j = a; j <= b; j++) for (const k of SHOTS[j].cam) if (!keys.length || k.t > keys[keys.length - 1].t + 1e-6) keys.push(k);
  return { shot: SHOTS[i], keys };
}
function hermite(p0, p1, m0, m1, u) { const u2 = u * u, u3 = u2 * u; return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1; }
function splineAt(keys, t, field) {
  const n = keys.length;
  if (t <= keys[0].t) return keys[0][field];
  if (t >= keys[n - 1].t) return keys[n - 1][field];
  let i = 0; while (i < n - 2 && t >= keys[i + 1].t) i++;
  const k1 = keys[i], k2 = keys[i + 1], dt = k2.t - k1.t, u = (t - k1.t) / dt;
  const val = (k) => Array.isArray(k[field]) ? k[field] : [k[field]];
  const tan = (j) => { if (j === 0 || j === n - 1) return val(keys[j]).map(() => 0); const a = keys[j - 1], c = keys[j + 1]; return val(c).map((v, d) => (v - val(a)[d]) / (c.t - a.t)); };
  const m1 = tan(i), m2 = tan(i + 1);
  const out = val(k1).map((v, d) => hermite(v, val(k2)[d], m1[d] * dt, m2[d] * dt, u));
  return Array.isArray(k1[field]) ? out : out[0];
}

// ------------------------------------------------------------------ setup
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W_, H_, false);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = true;
const W = await loadWorld(renderer);
const NAT = addNature(W);
const petals = makePetals(W);
const dust = makeDust(W);
const pipe = new Pipeline(renderer, W, W_, H_);
const cam = new THREE.PerspectiveCamera(50, W_ / H_, 0.05, 6000);
// the terminal frame the river first reflects
const handoff = await new THREE.TextureLoader().loadAsync('data/handoff.png').catch(() => null);
if (handoff) { handoff.colorSpace = THREE.SRGBColorSpace; W.water.material.uniforms.tTerm.value = handoff; }
// a second key on the station window sill
const key2 = W.dyn.key.clone(); key2.position.copy(B(0.645, 74.2, 2.0805)); key2.rotation.y = 2.1; W.scene.add(key2);
// shadows only used by the shadow sweep
W.sun.shadow.mapSize.set(2048, 2048); W.sun.shadow.bias = -0.0012; W.sun.shadow.normalBias = 0.06;
Object.assign(W.sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 160 });
W.sun.target.position.copy(B(-2.1, 0, 2.2));
W.scene.traverse(o => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
const textEl = document.getElementById('text');
const textDivs = TEXT.map(tx => {
  const d = document.createElement('div');
  d.className = tx.note ? 'note' : 'ln' + (tx.v ? ' v' : '') + (tx.cls ? ' ' + tx.cls : '');
  d.textContent = tx.note || tx.text;
  d.style.opacity = 0; textEl.appendChild(d); return d;
});
const endcard = document.getElementById('endcard');

const SWEEP = { a: 99.0, b: 104.4 };
function sunDirFromAzEl(az, el) { az *= Math.PI / 180; el *= Math.PI / 180; const d = [Math.cos(el) * Math.sin(az), Math.cos(el) * Math.cos(az), Math.sin(el)]; return new THREE.Vector3(d[0], d[2], -d[1]); }
let envKey = null;
let curtainRest = null;

function applyLight(sh, t) {
  let st = sh.light;
  if (typeof st === 'function') st = st(t);
  let a, b, k;
  if (st === 'sweep') {
    // the room at night, then the sun comes back the wrong way round: west, over the top, to the east
    const u = ramp(t, SWEEP.a, SWEEP.b, eio);
    setLighting(W, 'dusk_nosun', 'morning_nosun', u);
    const az = lerp(258, 104 - 360, u), el = Math.sin(u * Math.PI) * 58 + lerp(7, 22, u);
    U.uSunDir.value.copy(sunDirFromAzEl((az + 720) % 360, el));
    const sc = new THREE.Color(1.0, 0.62, 0.34).lerp(new THREE.Color(1.0, 0.95, 0.88), u).multiplyScalar(lerp(3.2, 4.6, u) * ramp(t, SWEEP.a - 0.6, SWEEP.a + 0.6));
    U.uSunCol.value.copy(sc);
    W.sun.position.copy(B(-2.1, 0, 2.2)).addScaledVector(U.uSunDir.value, 60);
    W.sun.color.setRGB(1, 1, 1).copy(sc).multiplyScalar(1 / Math.max(sc.r, 0.001));
    W.sun.intensity = sc.r;
    W.sun.castShadow = true; U.uDirect.value = 1;
    for (const m of W.baked) m.userData.lmLocalGain.value = 1;
    // before the sun returns the room is dark (night); fade from a dim dawn bake
    U.uLmGain.value = lerp(0.35, 1.0, ramp(t, SWEEP.a - 0.4, SWEEP.a + 1.6));
    a = 'dusk'; b = 'morning'; k = u;
    return { a: 'night', b: 'morning', k: ramp(t, SWEEP.a - 0.5, SWEEP.a + 2.5) };
  }
  W.sun.castShadow = false; U.uDirect.value = 0; U.uLmGain.value = 1;
  if (Array.isArray(st)) [a, b, k] = st; else { a = b = st; k = 0; }
  setLighting(W, a, b, k);
  // groups without a bake for the target state fall back to dusk and simply darken (nightfall)
  for (const m of W.baked) {
    const g = m.userData.group, has = (s) => W.bakeIndex[g] && W.bakeIndex[g][s];
    let gain = 1;
    // groups without a night bake: dusk light scaled down to roughly moonlight
    const NG = 0.004;
    if (!has(b) && b === 'night') gain = lerp(1, NG, k);
    if (!has(a) && a === 'night') gain = lerp(NG, 1, k);
    if (a === 'night' && b === 'night' && !has('night')) gain = NG;
    m.userData.lmLocalGain.value = gain;
  }
  return { a, b, k };
}

function applyGradeFog(L0, sh, t) {
  const ga = GRADE[L0.a.replace('_nosun', '')] || GRADE.dusk, gb = GRADE[L0.b.replace('_nosun', '')] || GRADE.dusk;
  let g = mixGrade(ga, gb, L0.k);
  // exposure: interpolate the *look* in log space and divide by the linearly blended scene level
  const LV = { dusk: 1.0, morning: 1.2, dawn: 0.014, night: 0.004 };
  const la = LV[L0.a.replace('_nosun', '')] ?? 1, lb = LV[L0.b.replace('_nosun', '')] ?? 1;
  if (la !== lb) g.exposure = Math.exp(lerp(Math.log(ga.exposure * la), Math.log(gb.exposure * lb), L0.k)) / lerp(la, lb, L0.k);
  if (sh.interior && (sh.interiorUntil == null || t < sh.interiorUntil)) g = { ...g, exposure: g.exposure * (L0.a === 'dawn' ? 1.15 : 1.45) };
  const fa = FOG[L0.a.replace('_nosun', '')] || FOG.dusk, fb = FOG[L0.b.replace('_nosun', '')] || FOG.dusk;
  U.uFogCol.value.setRGB(...fa.col.map((v, i) => lerp(v, fb.col[i], L0.k)));
  U.uFogSun.value.setRGB(...fa.sun.map((v, i) => lerp(v, fb.sun[i], L0.k)));
  U.uFogDensity.value = lerp(fa.d, fb.d, L0.k);
  return g;
}

function applyWorld(sh, t) {
  U.uTime.value = t;
  const wind = typeof sh.wind === 'function' ? sh.wind(t) : (sh.wind ?? 0.3);
  U.uWind.value = wind;
  U.uMist.value = typeof sh.mist === 'function' ? sh.mist(t) : (sh.mist ?? 0);
  U.uMistCol.value.copy(U.uFogCol.value).multiplyScalar(1.25);
  // the window sash: wide open for the passage in poem one, half open in poem two
  const sashDeg = sh.sash ?? (t < 100 ? 88 : 30);
  W.sashPivot.rotation.y = -sashDeg * Math.PI / 180;
  // clocks: real-time hands; in "时间会不会认错回家的路" the second hand runs backwards
  const clockT = 17 * 3600 + 42 * 60 + (t - 42) * (sh.clockBack ? -1 : 1);
  for (const k in W.clockPivots) {
    const p = W.clockPivots[k]; const [h, m, s] = p.children;
    const ang = (v) => -v * Math.PI * 2;
    if (s) s.rotation.z = ang(Math.floor(clockT) % 60 / 60) * (k === 'hero' ? 1 : 1);
    if (m) m.rotation.z = ang((clockT / 60) % 60 / 60);
    if (h) h.rotation.z = ang((clockT / 3600) % 12 / 12);
  }
  // curtains breathe with the wind
  for (let i = 0; i < 6; i++) {
    const c = W.dyn['curtain_' + i]; if (!c) continue;
    const g = c.geometry, pa = g.attributes.position, rest = g.userData.rest;
    const amp = (i === 2 || i === 3 ? 1.0 : 0.25) * wind * (sh.sash != null || t > 100 ? 1 : 0.4);
    for (let v = 0; v < pa.count; v++) {
      const x = rest[v * 3], y = rest[v * 3 + 1], z = rest[v * 3 + 2];
      const hang = clamp(-z / 2.2);                  // 0 at the rod, 1 at the hem (three: y up; local z is blender y)
      const billow = amp * hang * hang * (0.35 + 0.25 * Math.sin(t * 1.1 + i) + 0.12 * Math.sin(t * 2.7 + y * 3.0));
      pa.setXYZ(v, x + billow, y + amp * hang * 0.05 * Math.sin(t * 1.9 + i * 2), z);
    }
    pa.needsUpdate = true; g.computeVertexNormals();
  }
  // the letter sheet lifts in the wind (poem two)
  const ls = W.dyn.letter_sheet;
  if (ls) {
    const g = ls.geometry, pa = g.attributes.position; if (!g.userData.rest) g.userData.rest = pa.array.slice(); const rest = g.userData.rest;
    const lift = (sh.name === 'sash') ? wind : 0;
    for (let v = 0; v < pa.count; v++) {
      const x = rest[v * 3], y = rest[v * 3 + 1], z = rest[v * 3 + 2];
      const u = clamp((x + 0.105) / 0.21);
      const curl = lift * u * u * (0.06 + 0.03 * Math.sin(t * 3.1 + u * 4));
      pa.setXYZ(v, x - curl * 0.3, y + curl, z);
    }
    pa.needsUpdate = true; g.computeVertexNormals();
  }
  // lamps at night
  const night = (L0last.a === 'night' ? 1 - L0last.k : 0) + (L0last.b === 'night' ? L0last.k : 0);
  for (const m of W.baked) if (m.userData.emit) m.userData.emit.value = 6.0 * night;
  // moon (daylight moon low in the west)
  const sky = W.sky.material.uniforms;
  const level = (st) => ({ dusk: 1.0, morning: 1.2, dawn: 0.014, night: 0.004 })[st.replace('_nosun', '')] ?? 1;
  const skyLevel = lerp(level(L0last.a), level(L0last.b), L0last.k);
  sky.moonAmt.value = sh.moon ? 1.0 : (night > 0.5 ? 0.012 : 0);
  sky.moonDir.value.copy(sunDirFromAzEl(sh.moon ? 252 : 200, sh.moon ? 24 : 35));
  sky.stars.value = night * 0.012;
  sky.cloudAmt.value = { dusk: 0.62, night: 0.35, morning: 0.0, dawn: 0.25 }[L0last.b] ?? 0.3;
  sky.cloudCol.value.set(L0last.b === 'dusk' ? 0xffb38a : L0last.b === 'dawn' ? 0xb7a9c2 : 0xf2f2f2);
  sky.cloudShade.value.set(L0last.b === 'dusk' ? 0x5a4a5e : 0x3a4458);
  sky.cloudCol.value.multiplyScalar(skyLevel); sky.cloudShade.value.multiplyScalar(skyLevel);
  // rain on a single pane while the sun shines (letter shot)
  W.glassMat.uniforms.rain.value = (sh.name === 'letter' || (sh.name === 'glide' && t > 56.5)) ? 1 : 0;
  // petals and dust
  petals.visible = !!sh.petals;
  if (sh.petals) petals.update(t, -20, 12, 30, 0.35);
  dust.visible = !!(sh.dust && (sh.shaftsUntil == null || t < sh.shaftsUntil));
}

let L0last = { a: 'dusk', b: 'dusk', k: 0 };
// the river's own clock: integral of its flow speed over film time (so stopping never runs backwards)
function flowAt(t) { const s = SHOTS.find(x => t >= x.t0 && t < x.t1); const w = s && s.water ? s.water(t) : {}; return w.flow ?? 1; }
const FLOW_DT = 0.05; const flowTable = [0];
for (let t = 42 + FLOW_DT; t <= 180; t += FLOW_DT) flowTable.push(flowTable[flowTable.length - 1] + flowAt(t - FLOW_DT / 2) * FLOW_DT);
function flowPhase(t) { const x = (t - 42) / FLOW_DT; if (x <= 0) return t; const i = Math.min(flowTable.length - 2, Math.floor(x)); return 42 + flowTable[i] + (flowTable[i + 1] - flowTable[i]) * (x - i); }
function waterParams(sh, t) {
  const wu = W.water.material.uniforms;
  const def = { termMix: 0, chop: 0.22, flow: 1, clarity: 0, reflectivity: 1, blank: 0, rippleAmt: 0, rippleT: 0, rippleC: [0, 0] };
  const p = Object.assign(def, sh.water ? sh.water(t) : {});
  wu.termMix.value = p.termMix; wu.chop.value = p.chop; wu.flow.value = p.flow; wu.clarity.value = p.clarity;
  wu.flowT.value = flowPhase(t);
  wu.reflectivity.value = p.reflectivity; wu.blank.value = p.blank; wu.rippleAmt.value = p.rippleAmt; wu.rippleT.value = p.rippleT;
  wu.rippleC.value.set(p.rippleC[0], -p.rippleC[1]);
  wu.blankCol.value.copy(U.uFogCol.value).multiplyScalar(1.05);
  // the frozen river keeps flowing in its own clock: integrate flow so stopping doesn't jump
  return p;
}

async function renderAt(t) {
  const frame = Math.round(t * 30);
  // end card
  const ec = fade(t, END.a, END.a + 0.8, END.b - 0.8, END.b);
  endcard.style.opacity = t >= END.a ? ec : 0;
  if (t >= END.a + 0.8 && t < END.b - 0.8) { textDivs.forEach(d => d.style.opacity = 0); return; }
  const { shot: sh, keys } = camKeysAt(t);
  const L0 = applyLight(sh, t); L0last = L0;
  const grade = applyGradeFog(L0, sh, t);
  applyWorld(sh, t);
  // camera with a breath of handheld drift
  const p = splineAt(keys, t, 'p'), l = splineAt(keys, t, 'l'), f = splineAt(keys, t, 'f');
  const hh = sh.interior ? 0.006 : 0.012;
  cam.position.copy(B(p[0] + noise1(t * 0.35) * hh, p[1] + noise1(t * 0.31 + 7) * hh, p[2] + noise1(t * 0.29 + 3) * hh));
  cam.lookAt(B(l[0] + noise1(t * 0.23 + 11) * hh * 2, l[1] + noise1(t * 0.21 + 5) * hh * 2, l[2] + noise1(t * 0.27 + 9) * hh * 2));
  cam.fov = f; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  // environment capture per shot
  const ek = sh.name + '|' + L0.a + L0.b + (L0.k > 0.5 ? 1 : 0);
  if (ek !== envKey) { setEnv(W, captureEnv(W, renderer, B(...sh.env), 192)); envKey = ek; }
  waterParams(sh, t);
  // impossible reflections
  const P = { frame, grade, shafts: null };
  if (sh.altRefl) {
    const mix = sh.altRefl.mix(t);
    W.water.material.uniforms.reflAltMix.value = mix;
    if (mix > 0) {
      P.altRefl = (on) => {
        if (sh.altRefl.lit) W.glassMat.uniforms.lit.value = on ? 1 : 0;
        if (sh.altRefl.blossom) {
          NAT.leafMat.userData.tint.value.setRGB(...(on ? [2.2, 1.05, 1.25] : [1, 1, 1]));
          NAT.blobMat.userData.tint.value.setRGB(...(on ? [2.6, 1.3, 1.6] : [1, 1, 1]));
          NAT.hillMat.userData.tint.value.setRGB(...(on ? [1.8, 1.1, 1.3] : [1, 1, 1]));
        }
      };
    }
  } else W.water.material.uniforms.reflAltMix.value = 0;
  if (sh.shafts && (sh.shaftsUntil == null || t < sh.shaftsUntil)) {
    P.shafts = { strength: sh.shafts * (U.uSunCol.value.r > 0.01 ? 1 : 0), center: B(-2.1, 0, 2.7).toArray(), boxMin: [-5.76, 1.0, -5.0], boxMax: [1.5, 4.4, 5.0], frame };
  }
  P.beforeOpaque = (pp) => { if (dust.visible) { dust.material.uniforms.tSunDepth.value = pp.sunDepth.depthTexture; dust.material.uniforms.sunMat.value.copy(pp.shafts.mat.uniforms.sunMat.value); dust.material.uniforms.amount.value = (sh.dust || 0) * (P.shafts ? 1 : 0); } };
  pipe.render(cam, P);
  // text
  TEXT.forEach((tx, i) => {
    const d = textDivs[i];
    const o = fade(t, tx.t0, tx.t0 + 0.9, tx.t1 - 0.9, tx.t1);
    d.style.opacity = o;
    if (o <= 0) return;
    const rise = (1 - sm((t - tx.t0) / 1.4)) * 6;
    if (tx.v) { d.style.left = tx.x + 'px'; d.style.top = (tx.y + rise) + 'px'; d.style.transform = ''; }
    else {
      d.style.top = (tx.y + rise) + 'px';
      if (tx.align === 'center') { d.style.left = tx.x + 'px'; d.style.transform = 'translateX(-50%)'; }
      else if (tx.align === 'right') { d.style.left = tx.x + 'px'; d.style.transform = 'translateX(-100%)'; }
      else { d.style.left = tx.x + 'px'; d.style.transform = ''; }
    }
  });
}

window.renderAt = renderAt; window.__pipe = pipe; window.__nat = NAT; window.__W = W;
window.FILM = { SHOTS, TEXT, END };
await document.fonts.ready;
// warm up: compile every material once
renderAt(42.0); renderAt(100.0); renderAt(120.0);
window.ready = true;
