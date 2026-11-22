// HAIZ · 自由共游 — what the student rides (procedural, in the walk's cel light and drawn edge).
//
//   bicycle     a campus city bike: deep green diamond frame, upright bars swept back, a wicker basket
//               on the front, a rack and mudguards, a kickstand. The steering assembly (fork, wheel,
//               bars, basket) turns about the real head-tube axis; wheels and cranks turn with the ride
//   board       a popsicle skateboard: kicktails, grip tape on top, a painted bottom (the 榄仁 leaf of
//               HAIZ), trucks that steer when the deck rolls, four wheels
//   broom       a 竹扫帚 — the campus's own bamboo broom, the one 吴伯 sweeps the tree's leaves with —
//               a bamboo pole with its nodes, a bundle of twigs bound with cord, and a red ribbon tied
//               at the binding that streams behind it (a short verlet chain: it reads the speed and the wind)
//
// Every part dissolves in and out the way the painting's people do (world-space breakup, an ink edge),
// so a bike is painted into the picture beside you rather than popping in.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cel } from '../ruhua-stroll/atmos.js';
import { outlineMaterial } from '../ruhua-stroll/student.js';

const UP = new THREE.Vector3(0, 1, 0);

/** a cylinder from a to b (Vector3 or arrays) of radius r */
function tube(a, b, r, seg = 8) {
  a = Array.isArray(a) ? new THREE.Vector3(...a) : a; b = Array.isArray(b) ? new THREE.Vector3(...b) : b;
  const d = new THREE.Vector3().subVectors(b, a), L = d.length();
  const g = new THREE.CylinderGeometry(r, r, L, seg, 1);
  g.translate(0, L / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const clean = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal'].includes(k)) n.deleteAttribute(k); return n; };
const merge = (list) => mergeGeometries(list.map(clean), false);

function makeMaterials(uFade) {
  const cache = new Map();
  const fade = /* glsl */`
float fn = aNoise(vWP.xy * 13.0 + vWP.zy * 9.0) * 0.75 + aNoise(vWP.xz * 37.0) * 0.25;
if (uFade < 0.999 && fn > uFade * 1.1 - 0.05) discard;
`;
  const edge = /* glsl */`
{ float fe = smoothstep(uFade * 1.1 - 0.13, uFade * 1.1 - 0.05, fn) * step(uFade, 0.999); outCol = mix(outCol, vec3(0.07, 0.06, 0.06), fe * 0.85); }
`;
  return (hex, soft = 0.12, extra = '') => {
    const key = hex + soft + extra;
    if (!cache.has(key)) {
      cache.set(key, cel({ name: 'ride-' + hex, key: 'ride-' + (extra ? 'x' + extra.length : 'p'), color: new THREE.Color(hex), soft, uniforms: { uFade },
        fragment: { head: 'uniform float uFade;\n', pre: fade, albedo: extra, after: edge } }));
    }
    return cache.get(key);
  };
}

function finish(group, outlineWidth, uFade) {
  const ol = [];
  group.traverse((o) => {
    if (!o.isMesh || o.userData.noOutline) return;
    o.castShadow = true; o.receiveShadow = true;
    if (outlineWidth > 0) {
      const m = outlineMaterial();
      m.uniforms.uWidth.value = outlineWidth;
      m.uniforms.uFade = uFade;
      m.fragmentShader = m.fragmentShader.replace('void main() {', 'uniform float uFade;\nvoid main() {\n  if (uFade < 0.98) discard;');
      const e = new THREE.Mesh(o.geometry, m);
      e.userData.noOutline = true; e.castShadow = false;
      ol.push([o, e]);
    }
  });
  for (const [o, e] of ol) o.add(e);
}

// ======================================================================== the bicycle
// bike frame: origin on the ground under the bottom bracket, +z forward, +y up (metres)
export function createBike({ saddleH = 0.98 } = {}) {
  const uFade = { value: 0 };
  const M = makeMaterials(uFade);
  const PAINT = '#2c5b4f', CHROME = '#b9bdbd', RUBBER = '#202022', LEATHER = '#6a4632', CANE = '#c39a5b';
  const R = 0.33, BB = [0, 0.285, 0], RA = [0, R, -0.43], FA = [0, R, 0.645];
  const seatTop = [0, 0.80, -0.165], headTop = [0, 0.86, 0.505], headBot = [0, 0.71, 0.56];
  const group = new THREE.Group(); group.name = 'bike';
  const body = new THREE.Group(); group.add(body);           // everything that leans
  // ---- frame
  const frame = [
    tube(BB, seatTop, 0.017), tube(BB, headBot, 0.019), tube(seatTop, headTop, 0.016),
    tube(BB, [0.06, R, -0.43], 0.009), tube(BB, [-0.06, R, -0.43], 0.009),
    tube(seatTop, [0.06, R, -0.43], 0.008), tube(seatTop, [-0.06, R, -0.43], 0.008),
    tube(headBot, headTop, 0.022),
  ];
  body.add(new THREE.Mesh(merge(frame), M(PAINT, 0.18)));
  // saddle post and saddle (height set by the rider)
  const saddleY = saddleH;
  const seatDir = new THREE.Vector3(0, 0.515, -0.165 * 0.33).normalize();
  const postTop = new THREE.Vector3(...seatTop).addScaledVector(seatDir, (saddleY - seatTop[1]) / seatDir.y);
  body.add(new THREE.Mesh(merge([tube(seatTop, postTop, 0.012)]), M(CHROME, 0.05)));
  const saddleG = new THREE.SphereGeometry(1, 14, 8);
  saddleG.scale(0.085, 0.032, 0.14); saddleG.translate(postTop.x, postTop.y + 0.03, postTop.z - 0.01);
  const nose = new THREE.SphereGeometry(1, 10, 6); nose.scale(0.035, 0.026, 0.09); nose.translate(postTop.x, postTop.y + 0.028, postTop.z + 0.1);
  body.add(new THREE.Mesh(merge([saddleG, nose]), M(LEATHER, 0.3)));
  // rack over the rear wheel and mudguard
  const rack = [tube([0.07, 0.62, -0.62], [0.07, 0.62, -0.18], 0.006), tube([-0.07, 0.62, -0.62], [-0.07, 0.62, -0.18], 0.006),
    tube([0.07, 0.62, -0.62], [0.06, R, -0.43], 0.006), tube([-0.07, 0.62, -0.62], [-0.06, R, -0.43], 0.006),
    tube([0.07, 0.62, -0.2], [0, 0.70, -0.17], 0.005), tube([-0.07, 0.62, -0.2], [0, 0.70, -0.17], 0.005)];
  for (let i = 0; i < 4; i++) rack.push(tube([-0.07, 0.62, -0.25 - i * 0.12], [0.07, 0.62, -0.25 - i * 0.12], 0.005));
  body.add(new THREE.Mesh(merge(rack), M(CHROME, 0.05)));
  const guard = (cz, cy, a0, a1) => { const g = new THREE.TorusGeometry(R + 0.035, 0.022, 4, 18, a1 - a0); g.scale(1, 1, 1.9); g.rotateY(Math.PI / 2); g.rotateX(-a0); g.translate(0, cy, cz); return g; };
  body.add(new THREE.Mesh(merge([guard(-0.43, R, -0.1, 2.3)]), M(PAINT, 0.18)));
  // chain guard, chainring and kickstand
  const cg = new THREE.BoxGeometry(0.012, 0.07, 0.5); cg.translate(-0.085, 0.30, -0.2);
  body.add(new THREE.Mesh(merge([cg]), M(PAINT, 0.18)));
  const stand = new THREE.Group(); stand.position.set(0.05, 0.3, -0.18); body.add(stand);
  stand.add(new THREE.Mesh(merge([tube([0, 0, 0], [0, -0.3, -0.02], 0.007)]), M(CHROME, 0.05)));
  // ---- wheels (each: tyre, rim, hub, spokes), turned by the ride
  const wheel = () => {
    const w = new THREE.Group();
    const tyre = new THREE.TorusGeometry(R - 0.018, 0.019, 6, 36); tyre.rotateY(Math.PI / 2);
    w.add(new THREE.Mesh(tyre, M(RUBBER, 0.3)));
    const rim = new THREE.TorusGeometry(R - 0.04, 0.007, 4, 36); rim.rotateY(Math.PI / 2);
    const sp = [rim, tube([-0.045, 0, 0], [0.045, 0, 0], 0.016)];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, s = i % 2 ? 1 : -1;
      sp.push(tube([s * 0.035, Math.sin(a + s * 0.25) * 0.016, Math.cos(a + s * 0.25) * 0.016], [0.004 * s, Math.sin(a) * (R - 0.045), Math.cos(a) * (R - 0.045)], 0.0017, 3));
    }
    const m = new THREE.Mesh(merge(sp), M(CHROME, 0.05)); m.userData.noOutline = true;
    w.add(m);
    return w;
  };
  const rear = wheel(); rear.position.set(...RA); body.add(rear);
  // ---- cranks and pedals (rotate about the bottom bracket's x axis)
  const crank = new THREE.Group(); crank.position.set(...BB); body.add(crank);
  // (the bike's own left is +x: the chainring and the right crank are on -x)
  const ring = new THREE.TorusGeometry(0.095, 0.008, 4, 28); ring.rotateY(Math.PI / 2); ring.translate(-0.065, 0, 0);
  crank.add(new THREE.Mesh(merge([ring, tube([-0.07, 0, 0], [-0.07, -0.17, 0], 0.011), tube([0.07, 0, 0], [0.07, 0.17, 0], 0.011), tube([-0.075, 0, 0], [0.075, 0, 0], 0.012)]), M(CHROME, 0.05)));
  // right pedal starts at the bottom, left at the top; the platforms stay level (counter-turned each frame)
  const pedal = (x, y) => { const p = new THREE.Group(); p.position.set(x, y, 0); p.add(new THREE.Mesh(box(0.085, 0.02, 0.06, Math.sign(x) * 0.01, 0, 0), M(RUBBER, 0.3))); crank.add(p); return p; };
  const pedals = { R: pedal(-0.11, -0.17), L: pedal(0.11, 0.17) };
  // ---- the steering assembly: turns about the head tube
  const axisBot = new THREE.Vector3(...headBot), axisTop = new THREE.Vector3(...headTop);
  const axisDir = new THREE.Vector3().subVectors(axisTop, axisBot).normalize();
  const tilt = new THREE.Quaternion().setFromUnitVectors(UP, axisDir);
  const pivot = new THREE.Group(); pivot.position.copy(axisBot); pivot.quaternion.copy(tilt); body.add(pivot);
  const steer = new THREE.Group(); pivot.add(steer);
  const inner = new THREE.Group(); inner.quaternion.copy(tilt).invert(); inner.position.copy(axisBot).applyQuaternion(inner.quaternion).negate(); steer.add(inner);
  const grips = { L: new THREE.Vector3(0.28, 1.005, 0.355), R: new THREE.Vector3(-0.28, 1.005, 0.355) };
  const stemTop = new THREE.Vector3(0, 1.0, 0.475);
  inner.add(new THREE.Mesh(merge([
    tube([0.045, R, FA[2]], [0.035, headBot[1] - 0.02, headBot[2]], 0.011), tube([-0.045, R, FA[2]], [-0.035, headBot[1] - 0.02, headBot[2]], 0.011),
    tube([0.035, headBot[1] - 0.02, headBot[2]], [-0.035, headBot[1] - 0.02, headBot[2]], 0.012),
    tube(headTop, stemTop, 0.012),
    tube([0.12, 1.0, 0.47], [-0.12, 1.0, 0.47], 0.011), tube([0.12, 1.0, 0.47], [0.26, 1.005, 0.38], 0.011), tube([-0.12, 1.0, 0.47], [-0.26, 1.005, 0.38], 0.011),
  ]), M(CHROME, 0.05)));
  inner.add(new THREE.Mesh(merge([tube([0.24, 1.005, 0.39], [0.33, 1.005, 0.33], 0.016), tube([-0.24, 1.005, 0.39], [-0.33, 1.005, 0.33], 0.016)]), M(RUBBER, 0.3)));
  inner.add(new THREE.Mesh(merge([guard(FA[2], R, -1.6, 0.9)]), M(PAINT, 0.18)));
  // the basket: woven cane slats over a light frame, carried on the bars and the fork
  {
    const bx = 0.17, by0 = 0.66, by1 = 0.94, bz0 = 0.64, bz1 = 0.92, sl = [];
    for (let i = 0; i <= 8; i++) { const x = -bx + (2 * bx * i) / 8; sl.push(box(0.008, by1 - by0, 0.008, x, (by0 + by1) / 2, bz0), box(0.008, by1 - by0, 0.008, x, (by0 + by1) / 2, bz1)); }
    for (let i = 0; i <= 6; i++) { const z = bz0 + ((bz1 - bz0) * i) / 6; sl.push(box(0.008, by1 - by0, 0.008, -bx, (by0 + by1) / 2, z), box(0.008, by1 - by0, 0.008, bx, (by0 + by1) / 2, z)); }
    for (let k = 0; k < 5; k++) {
      const y = by0 + 0.02 + k * 0.065, t = 0.012;
      sl.push(box(2 * bx + 0.01, t, 0.012, 0, y, bz0), box(2 * bx + 0.01, t, 0.012, 0, y, bz1), box(0.012, t, bz1 - bz0, -bx, y, (bz0 + bz1) / 2), box(0.012, t, bz1 - bz0, bx, y, (bz0 + bz1) / 2));
    }
    sl.push(box(2 * bx, 0.012, bz1 - bz0, 0, by0, (bz0 + bz1) / 2));
    const bm = new THREE.Mesh(merge(sl), M(CANE, 0.3)); bm.userData.noOutline = true;
    inner.add(bm);
    inner.add(new THREE.Mesh(merge([tube([0, 0.97, 0.47], [0, 0.94, 0.64], 0.007), tube([0.03, R + 0.04, FA[2] + 0.02], [0.03, by0, 0.70], 0.006)]), M(CHROME, 0.05)));
  }
  const front = wheel(); front.position.set(...FA); inner.add(front);
  // ---- the lamp: a small round headlamp on the basket's front, and at night a pool of warm light on the
  // paving ahead (a painted wash, not a shadow-casting light: it costs one transparent quad and a halo)
  const lamp = createLamp(M, CHROME);
  lamp.head.position.set(0, 0.80, 0.935); inner.add(lamp.head);
  group.add(lamp.pool);
  // the steering axis seen from the bike's frame: wheels touch the ground where?
  finish(group, 0.0035, uFade);
  group.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  const wheelBase = FA[2] - RA[2];
  return {
    kind: 'bike', group, body, steer, rear, front, crank, pedals, stand, grips, uFade,
    R, wheelBase, BB: new THREE.Vector3(...BB), saddle: new THREE.Vector3(postTop.x, postTop.y + 0.055, postTop.z - 0.02), axisDir,
    /** grip position (bike space) for a steer angle */
    grip(side, angle, out = new THREE.Vector3()) {
      out.copy(grips[side]).sub(axisBot).applyAxisAngle(axisDir, angle).add(axisBot);
      return out;
    },
    setSteer(a) { steer.rotation.y = a; lamp.pool.rotation.y = a * 0.85; },
    /** k: 0 (off) … 1 (lit), the pool fades in with it; lean tilts the pool a little toward the turn */
    setLamp(k, lean = 0) { lamp.set(k, lean); },
    get lamp() { return lamp.k; },
  };
}

// the headlamp (housing, glass, halo) and the light it throws on the ground, in bike space
function createLamp(M, CHROME) {
  const head = new THREE.Group();
  const housing = new THREE.CylinderGeometry(0.036, 0.03, 0.06, 14); housing.rotateX(Math.PI / 2);
  head.add(new THREE.Mesh(housing, M(CHROME, 0.05)));
  const glassMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.42, 0.38, 0.3), toneMapped: false });
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.031, 16), glassMat);
  glass.position.z = 0.031; glass.userData.noOutline = true; head.add(glass);
  // a soft halo facing the camera (sprite-like; additive, so it only ever brightens)
  const haloMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uK: { value: 0 } },
    vertexShader: /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */`
uniform float uK; varying vec2 vUv;
void main() {
  float r = length(vUv * 2.0 - 1.0);
  float a = exp(-r * r * 9.0) + 0.25 * exp(-r * r * 2.5);
  gl_FragColor = vec4(vec3(1.0, 0.82, 0.55) * a * uK * 0.9, 1.0);
}`,
  });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), haloMat);
  halo.position.z = 0.05; halo.userData.noOutline = true; halo.renderOrder = 5; halo.frustumCulled = false;
  head.add(halo);
  // the pool: a fan of light 1 … 9 m ahead, brightest a couple of metres out, breaking up at its edges the
  // way a wash does on rough paper; additive and depth-tested so it lies on the paving, not over walls
  const poolMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: { uK: { value: 0 }, uLean: { value: 0 } },
    vertexShader: /* glsl */`
varying vec2 vP; varying vec3 vW;
void main() { vP = position.xz; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
uniform float uK; uniform float uLean; varying vec2 vP; varying vec3 vW;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main() {
  float z = vP.y - 0.75;                              // distance ahead of the lamp
  float x = vP.x + uLean * z * 0.35;
  float spread = 0.32 + z * 0.3;                       // the beam widens with distance
  float across = 1.0 - smoothstep(0.35, 1.0, abs(x) / spread);
  float along = smoothstep(0.0, 1.4, z) * (1.0 - smoothstep(3.0, 9.0, z));
  float paper = n(vW.xz * 2.3) * 0.6 + n(vW.xz * 7.1) * 0.4;
  float a = across * along * smoothstep(0.08, 0.5, paper * 0.7 + across * 0.5);
  float fall = 1.0 / (1.0 + z * z * 0.06);
  gl_FragColor = vec4(vec3(1.0, 0.78, 0.48) * a * fall * uK * 0.42, 1.0);
}`,
  });
  const poolG = new THREE.PlaneGeometry(7, 9.5, 1, 1).rotateX(-Math.PI / 2).translate(0, 0.035, 0.75 + 4.75);
  const pool = new THREE.Mesh(poolG, poolMat);
  pool.userData.noOutline = true; pool.renderOrder = 2; pool.frustumCulled = false; pool.visible = false;
  pool.castShadow = pool.receiveShadow = false;
  const L = { head, pool, k: 0 };
  L.set = (k, lean) => {
    L.k = k;
    haloMat.uniforms.uK.value = k; poolMat.uniforms.uK.value = k; poolMat.uniforms.uLean.value = lean;
    halo.visible = pool.visible = k > 0.01;
    glassMat.color.setRGB(0.42 + 2.2 * k, 0.38 + 1.6 * k, 0.3 + 0.9 * k);
  };
  return L;
}

// ======================================================================== the skateboard
// board frame: origin on the ground under the deck's centre, +z along the board (nose), +y up
function deckTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 512;
  const g = c.getContext('2d');
  // the bottom: a warm cream ground, a big 榄仁 leaf in green turning red at its tip, HAIZ in ink
  g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, 128, 512);
  const grd = g.createLinearGradient(0, 80, 0, 430); grd.addColorStop(0, '#3f7a45'); grd.addColorStop(0.7, '#5a9638'); grd.addColorStop(1, '#a3361e');
  g.fillStyle = grd;
  g.beginPath(); g.moveTo(64, 70);
  g.bezierCurveTo(128, 150, 120, 330, 64, 440); g.bezierCurveTo(8, 330, 0, 150, 64, 70); g.fill();
  g.strokeStyle = 'rgba(20,30,20,.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(64, 80); g.lineTo(64, 436); g.stroke();
  g.lineWidth = 1.6;
  for (let i = 0; i < 7; i++) { const y = 130 + i * 42; g.beginPath(); g.moveTo(64, y); g.quadraticCurveTo(84, y - 18, 104, y - 34 + i * 3); g.moveTo(64, y); g.quadraticCurveTo(44, y - 18, 24, y - 34 + i * 3); g.stroke(); }
  g.fillStyle = '#b0201c'; g.fillRect(48, 462, 32, 32);
  g.fillStyle = '#f2e8d2'; g.font = 'bold 15px serif'; g.textAlign = 'center'; g.fillText('海', 64, 477); g.fillText('中', 64, 491);
  g.fillStyle = '#2a2620'; g.font = '600 18px sans-serif'; g.save(); g.translate(64, 40); g.fillText('HAIZ', 0, 6); g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
export function createBoard() {
  const uFade = { value: 0 };
  const M = makeMaterials(uFade);
  const group = new THREE.Group(); group.name = 'board';
  const deck = new THREE.Group(); group.add(deck);          // rolls with the lean, pitches on an ollie
  const L = 0.80, W = 0.205, H = 0.11;                         // deck length, width, height of its top over the ground
  // the deck: a rounded plank, kicktails bent up over the last 15 cm
  const shape = new THREE.Shape();
  const hl = L / 2 - W / 2;
  shape.moveTo(-W / 2, -hl); shape.lineTo(-W / 2, hl); shape.absarc(0, hl, W / 2, Math.PI, 0, true); shape.lineTo(W / 2, -hl); shape.absarc(0, -hl, W / 2, 0, Math.PI, true);
  const ex = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false, curveSegments: 10 });
  ex.rotateX(-Math.PI / 2);   // shape y → -z… make z the length
  const pos = ex.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = -pos.getZ(i);
    const kt = Math.max(0, Math.abs(z) - 0.25) / 0.15;
    const lift = Math.pow(Math.min(kt, 1.2), 1.6) * 0.055;
    const concave = (x / (W / 2)) ** 2 * 0.006;
    pos.setXYZ(i, x, y + H + lift + concave, z);
  }
  ex.computeVertexNormals();
  deck.add(new THREE.Mesh(ex, M('#c79a62', 0.25)));
  // grip on top and the painted bottom (thin skins following the deck)
  const skin = (top) => {
    const g = new THREE.PlaneGeometry(W * 0.985, L * 0.985, 6, 40); g.rotateX(top ? -Math.PI / 2 : Math.PI / 2);
    const p = g.getAttribute('position'), uv = g.getAttribute('uv');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const r = Math.max(0, Math.abs(z) - hl);
      const xm = W / 2 * Math.sqrt(Math.max(0, 1 - (r / (W / 2)) ** 2)) * 0.985;
      const xx = Math.sign(x) * Math.min(Math.abs(x), xm);
      const kt = Math.max(0, Math.abs(z) - 0.25) / 0.15;
      const lift = Math.pow(Math.min(kt, 1.2), 1.6) * 0.055;
      const concave = (xx / (W / 2)) ** 2 * 0.006;
      p.setXYZ(i, xx, H + lift + concave + (top ? 0.0125 : -0.0008), z);
      if (!top) uv.setXY(i, uv.getX(i), 1 - uv.getY(i));
    }
    g.computeVertexNormals();
    return g;
  };
  const gripM = M('#232324', 0.4, 'albedo *= 0.85 + 0.3 * aNoise(vWP.xz * 400.0);\n');
  const top = new THREE.Mesh(skin(true), gripM); top.userData.noOutline = true; deck.add(top);
  const botM = M('#ffffff', 0.25); botM.map = deckTexture();
  const bot = new THREE.Mesh(skin(false), botM); bot.userData.noOutline = true; deck.add(bot);
  // trucks and wheels
  const trucks = [], wheels = [];
  for (const zt of [0.235, -0.235]) {
    const t = new THREE.Group(); t.position.set(0, 0.03, zt); deck.add(t);
    deck.add(new THREE.Mesh(box(0.06, 0.012, 0.08, 0, H - 0.006, zt), M('#9ea3a6', 0.05)));
    t.add(new THREE.Mesh(merge([box(0.02, 0.05, 0.03, 0, 0.04, 0), tube([-0.1, 0, 0], [0.1, 0, 0], 0.008)]), M('#9ea3a6', 0.05)));
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.032, 14).rotateZ(Math.PI / 2), M('#e9e1cf', 0.3));
      w.position.set(s * 0.085, 0, 0); t.add(w); wheels.push(w);
    }
    trucks.push(t);
  }
  finish(group, 0.0025, uFade);
  group.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  return { kind: 'board', group, deck, trucks, wheels, uFade, L, W, H, topY: H + 0.0125 };
}

// ======================================================================== the broom
// broom frame: origin at the seat on the handle, +z toward the tip of the handle (forward), +y up
export function createBroom() {
  const uFade = { value: 0 };
  const M = makeMaterials(uFade);
  const group = new THREE.Group(); group.name = 'broom';
  const body = new THREE.Group(); group.add(body);
  const BAMBOO = '#b9a066', TWIG = '#a88a52', CORD = '#8a2a1e';
  // the pole, from the binding (behind the rider) to its tip ahead; nodes every 32 cm
  const back = -0.62, tip = 0.98;
  const pole = [tube([0, 0, back], [0, 0, tip], 0.017, 10)];
  const nodes = [];
  for (let z = back + 0.18; z < tip; z += 0.32) nodes.push(tube([0, 0, z - 0.008], [0, 0, z + 0.008], 0.0205, 10));
  body.add(new THREE.Mesh(merge(pole), M(BAMBOO, 0.2, 'albedo *= 0.92 + 0.12 * aNoise(vec2(vWP.x * 3.0 + vWP.z * 3.0, vWP.y * 90.0));\n')));
  body.add(new THREE.Mesh(merge(nodes), M('#9c8350', 0.2)));
  // the twig bundle: long thin cards fanning out behind the binding, a little flattened (a sweeping broom)
  const twigs = [];
  let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 110; i++) {
    const a = rnd() * Math.PI * 2, r0 = Math.sqrt(rnd()) * 0.035;
    const spread = 0.13 + rnd() * 0.12, L = 0.55 + rnd() * 0.22;
    const ax = Math.cos(a), ay = Math.sin(a);
    const start = new THREE.Vector3(ax * r0, ay * r0 * 0.8, back + 0.08);
    const end = new THREE.Vector3(ax * spread * 1.25 + (rnd() - 0.5) * 0.05, ay * spread * 0.55 + (rnd() - 0.5) * 0.04 - 0.02, back - L);
    twigs.push(tube(start, end, 0.0022 + rnd() * 0.0016, 3));
  }
  const twigMesh = new THREE.Mesh(merge(twigs), M(TWIG, 0.35, 'albedo *= 0.8 + 0.35 * aNoise(vWP.xz * 60.0 + vWP.y * 40.0);\n'));
  twigMesh.userData.noOutline = true;
  body.add(twigMesh);
  // the binding: two turns of dark cord
  body.add(new THREE.Mesh(merge([tube([0, 0, back + 0.04], [0, 0, back + 0.075], 0.042, 12), tube([0, 0, back - 0.03], [0, 0, back - 0.005], 0.05, 12)]), M(CORD, 0.3)));
  // the ribbon: a strip of N segments simulated as a chain, drawn as a twisted strip
  const N = 12, SEG = 0.07;
  const rg = new THREE.BufferGeometry();
  const rp = new Float32Array((N + 1) * 2 * 3), idx = [];
  for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  rg.setAttribute('position', new THREE.BufferAttribute(rp, 3)); rg.setIndex(idx);
  rg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(rp.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  const ribbonMat = M('#c8281e', 0.35); ribbonMat.side = THREE.DoubleSide;
  const ribbon = new THREE.Mesh(rg, ribbonMat); ribbon.frustumCulled = false; ribbon.userData.noOutline = true; ribbon.castShadow = false;
  group.add(ribbon);
  const chain = Array.from({ length: N + 1 }, () => ({ p: new THREE.Vector3(), o: new THREE.Vector3() }));
  const anchorLocal = new THREE.Vector3(0.035, 0.02, back + 0.06);
  finish(group, 0.003, uFade);
  group.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  let ribbonReady = false;
  const tmp = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3();
  return {
    kind: 'broom', group, body, uFade, ribbon, back, tip,
    /** step the ribbon (world space): wind (Vector3, m/s of air) */
    updateRibbon(dt, wind) {
      body.updateMatrixWorld(true);
      const anchor = tmp.copy(anchorLocal).applyMatrix4(body.matrixWorld);
      if (!ribbonReady) { chain.forEach((c, i) => { c.p.copy(anchor).y -= i * SEG; c.o.copy(c.p); }); ribbonReady = true; }
      const sub = 3, h = Math.min(dt, 1 / 30) / sub;
      for (let k = 0; k < sub; k++) {
        chain[0].p.copy(anchor); chain[0].o.copy(anchor);
        for (let i = 1; i <= N; i++) {
          const c = chain[i];
          const vx = (c.p.x - c.o.x) * 0.985, vy = (c.p.y - c.o.y) * 0.985, vz = (c.p.z - c.o.z) * 0.985;
          c.o.copy(c.p);
          // drag toward the air's own motion: the ribbon streams downwind of the broom's motion
          const flutter = Math.sin(performance.now() * 0.013 + i * 0.9) * 0.6;
          c.p.x += vx + (wind.x * h - vx) * 0.12 + flutter * h * h * 30 * side.x;
          c.p.y += vy + (wind.y * h - vy) * 0.12 - 4.2 * h * h;
          c.p.z += vz + (wind.z * h - vz) * 0.12 + flutter * h * h * 30 * side.z;
        }
        for (let it = 0; it < 3; it++) for (let i = 1; i <= N; i++) {
          const a = chain[i - 1].p, b = chain[i].p;
          const d = tmp.subVectors(b, a), L = d.length() || 1e-6;
          const corr = (L - SEG) / L;
          if (i === 1) b.addScaledVector(d, -corr); else { a.addScaledVector(d, corr * 0.5); b.addScaledVector(d, -corr * 0.5); }
        }
      }
      side.set(1, 0, 0).transformDirection(body.matrixWorld);
      // write the strip into the ribbon's local space (it hangs off the group)
      ribbon.parent.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(ribbon.parent.matrixWorld).invert();
      for (let i = 0; i <= N; i++) {
        const w = 0.016 * (1 - i / (N + 2));
        const a = chain[i].p;
        const dir = i < N ? tmp.subVectors(chain[i + 1].p, a) : tmp.subVectors(a, chain[i - 1].p);
        up.crossVectors(dir, side).normalize().multiplyScalar(w);
        const p0 = side.clone().multiplyScalar(w).add(a).applyMatrix4(inv), p1 = side.clone().multiplyScalar(-w).add(a).applyMatrix4(inv);
        rp.set([p0.x, p0.y, p0.z, p1.x, p1.y, p1.z], i * 6);
      }
      rg.getAttribute('position').needsUpdate = true;
    },
    resetRibbon() { ribbonReady = false; },
  };
}
