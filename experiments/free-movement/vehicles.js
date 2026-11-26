// HAIZ · 自由移动 — Articulated Painterly Vehicles
//
// Four handcrafted, high-craft campus vehicles sharing HAIZ's cel lighting, gouache brush feel,
// inverted-hull ink outlines, and world-space ink-brush dissolve summon/dismiss:
//   1. Campus Bicycle      deep-green vintage frame, live telescopic fork compression, swept bars,
//                          working animated brass bell striker, woven rattan basket carrying a HAIZ
//                          green sketchbook + swinging brass charm pendulum, mudguards, spoked wheels,
//                          and warm dusk/night headlamp halo + paper-textured ground pool
//   2. Street Skateboard   contoured concave maple deck with kicktails, gritty grip tape, bespoke
//                          autumn-red 榄仁 leaf + 「海中」 seal bottom art, tilting kingpin trucks,
//                          and urethane wheels with metallic bearing caps
//   3. Bamboo Broom        Wu Bo's segmented golden bamboo sweeping broom, fanned natural twigs,
//                          crimson binding twine, 14-segment Verlet flowing silk ribbon, AND a
//                          Petalwake-inspired hanging warm brass-and-paper lantern on a 2-axis
//                          inertial pendulum that reacts to acceleration, banking, and wind drag
//   4. Terminalia Glider   (NEW 5th mode: 榄仁纸鸢) twin arched giant Terminalia catappa leaf wings
//                          over lashed golden bamboo spars & triangular trapeze control bar, custom
//                          backlit subsurface-vein GLSL shader, aeroelastic G-load flex, and twin
//                          Verlet white-gold silk wingtip wind-streamers
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cel } from '../../lanren/ruhua-stroll/atmos.js';
import { outlineMaterial } from '../../lanren/ruhua-stroll/student.js';

const UP = new THREE.Vector3(0, 1, 0);

function tube(a, b, r, seg = 10, rTop = r) {
  a = Array.isArray(a) ? new THREE.Vector3(...a) : a;
  b = Array.isArray(b) ? new THREE.Vector3(...b) : b;
  const d = new THREE.Vector3().subVectors(b, a);
  const L = Math.max(d.length(), 1e-4);
  const g = new THREE.CylinderGeometry(rTop, r, L, seg, 1);
  g.translate(0, L / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const clean = (g) => {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal'].includes(k)) n.deleteAttribute(k);
  return n;
};
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
  return (hex, soft = 0.14, extra = '', afterExtra = '') => {
    const key = hex + '|' + soft + '|' + extra + '|' + afterExtra;
    if (!cache.has(key)) {
      cache.set(key, cel({
        name: 'fm-veh-' + hex,
        key: 'fm-v-' + key.length + '-' + hex.slice(1),
        color: new THREE.Color(hex),
        soft,
        uniforms: { uFade },
        fragment: {
          head: 'uniform float uFade;\n',
          pre: fade,
          albedo: extra,
          after: afterExtra + edge,
        },
      }));
    }
    return cache.get(key);
  };
}

function finish(group, outlineWidth, uFade) {
  const ol = [];
  group.traverse((o) => {
    if (!o.isMesh || o.userData.noOutline) return;
    o.castShadow = true;
    o.receiveShadow = true;
    if (outlineWidth > 0) {
      const m = outlineMaterial();
      m.uniforms.uWidth.value = outlineWidth;
      m.uniforms.uFade = uFade;
      m.fragmentShader = m.fragmentShader.replace(
        'void main() {',
        'uniform float uFade;\nvoid main() {\n  if (uFade < 0.98) discard;'
      );
      const e = new THREE.Mesh(o.geometry, m);
      e.userData.noOutline = true;
      e.castShadow = false;
      ol.push([o, e]);
    }
  });
  for (const [o, e] of ol) o.add(e);
}

// Reusable Verlet silk ribbon (for broom tail & glider wingtip streamers)
function createRibbonMesh(M, hex, segments = 14, segLen = 0.068, baseWidth = 0.018, uFade) {
  const N = segments;
  const rg = new THREE.BufferGeometry();
  const rp = new Float32Array((N + 1) * 2 * 3);
  const idx = [];
  for (let i = 0; i < N; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  rg.setIndex(idx);
  rg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(rp.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  const mat = M(hex, 0.35);
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(rg, mat);
  mesh.frustumCulled = false;
  mesh.userData.noOutline = true;
  mesh.castShadow = false;

  const chain = Array.from({ length: N + 1 }, () => ({ p: new THREE.Vector3(), o: new THREE.Vector3() }));
  let ready = false;
  const tmp = new THREE.Vector3(), side = new THREE.Vector3(), inv = new THREE.Matrix4();

  return {
    mesh,
    reset() { ready = false; },
    step(dt, anchorWorld, windWorld, sideWorld, phaseOffset = 0) {
      if (!ready) {
        chain.forEach((c, i) => {
          c.p.copy(anchorWorld);
          c.p.y -= i * segLen;
          c.o.copy(c.p);
        });
        ready = true;
      }
      const sub = 3;
      const h = Math.min(dt, 1 / 30) / sub;
      const tNow = performance.now() * 0.013 + phaseOffset;
      for (let k = 0; k < sub; k++) {
        chain[0].p.copy(anchorWorld);
        chain[0].o.copy(anchorWorld);
        for (let i = 1; i <= N; i++) {
          const c = chain[i];
          const vx = (c.p.x - c.o.x) * 0.985;
          const vy = (c.p.y - c.o.y) * 0.985;
          const vz = (c.p.z - c.o.z) * 0.985;
          c.o.copy(c.p);
          const flutter = Math.sin(tNow + i * 0.85) * 0.65;
          c.p.x += vx + (windWorld.x * h - vx) * 0.14 + flutter * h * h * 28 * sideWorld.x;
          c.p.y += vy + (windWorld.y * h - vy) * 0.14 - 3.6 * h * h + Math.cos(tNow * 1.1 + i) * h * h * 12;
          c.p.z += vz + (windWorld.z * h - vz) * 0.14 + flutter * h * h * 28 * sideWorld.z;
        }
        for (let it = 0; it < 3; it++) {
          for (let i = 1; i <= N; i++) {
            const a = chain[i - 1].p, b = chain[i].p;
            const d = tmp.subVectors(b, a);
            const L = d.length() || 1e-6;
            const corr = (L - segLen) / L;
            if (i === 1) b.addScaledVector(d, -corr);
            else { a.addScaledVector(d, corr * 0.5); b.addScaledVector(d, -corr * 0.5); }
          }
        }
      }
      if (!mesh.parent) return;
      mesh.parent.updateMatrixWorld(true);
      inv.copy(mesh.parent.matrixWorld).invert();
      side.copy(sideWorld).normalize();
      for (let i = 0; i <= N; i++) {
        const w = baseWidth * (1 - i / (N + 2.5));
        const a = chain[i].p;
        const p0 = tmp.copy(side).multiplyScalar(w).add(a).applyMatrix4(inv);
        const x0 = p0.x, y0 = p0.y, z0 = p0.z;
        const p1 = tmp.copy(side).multiplyScalar(-w).add(a).applyMatrix4(inv);
        rp.set([x0, y0, z0, p1.x, p1.y, p1.z], i * 6);
      }
      rg.getAttribute('position').needsUpdate = true;
    },
  };
}

// ======================================================================== 1. THE CAMPUS BICYCLE
export function createBike({ saddleH = 0.98 } = {}) {
  const uFade = { value: 0 };
  const M = makeMaterials(uFade);
  const PAINT = '#255447', CHROME = '#c4c9c7', RUBBER = '#1f2022', LEATHER = '#6b442d', CANE = '#c89e5e', BRASS = '#d2a84e';
  const R = 0.33, BB = [0, 0.285, 0], RA = [0, R, -0.43], FA = [0, R, 0.645];
  const seatTop = [0, 0.80, -0.165], headTop = [0, 0.86, 0.505], headBot = [0, 0.71, 0.56];

  const group = new THREE.Group(); group.name = 'fm-bike';
  const body = new THREE.Group(); group.add(body);

  // Vintage Hainan steel diamond frame
  const frame = [
    tube(BB, seatTop, 0.0175), tube(BB, headBot, 0.0195), tube(seatTop, headTop, 0.016),
    tube(BB, [0.06, R, -0.43], 0.0095), tube(BB, [-0.06, R, -0.43], 0.0095),
    tube(seatTop, [0.06, R, -0.43], 0.0085), tube(seatTop, [-0.06, R, -0.43], 0.0085),
    tube(headBot, headTop, 0.023),
  ];
  body.add(new THREE.Mesh(merge(frame), M(PAINT, 0.16, 'albedo *= 0.95 + 0.08 * aNoise(vWP.xy * 18.0);\n')));

  // Saddle & springs
  const saddleY = saddleH;
  const seatDir = new THREE.Vector3(0, 0.515, -0.165 * 0.33).normalize();
  const postTop = new THREE.Vector3(...seatTop).addScaledVector(seatDir, (saddleY - seatTop[1]) / seatDir.y);
  const saddleGroup = new THREE.Group();
  body.add(saddleGroup);
  saddleGroup.add(new THREE.Mesh(merge([tube(seatTop, postTop, 0.012)]), M(CHROME, 0.05)));
  const saddleG = new THREE.SphereGeometry(1, 14, 8);
  saddleG.scale(0.088, 0.034, 0.142); saddleG.translate(postTop.x, postTop.y + 0.032, postTop.z - 0.01);
  const nose = new THREE.SphereGeometry(1, 10, 6);
  nose.scale(0.036, 0.026, 0.095); nose.translate(postTop.x, postTop.y + 0.03, postTop.z + 0.105);
  saddleGroup.add(new THREE.Mesh(merge([saddleG, nose]), M(LEATHER, 0.28)));

  // Rear luggage rack + mudguard + red reflector
  const rack = [
    tube([0.072, 0.62, -0.64], [0.072, 0.62, -0.18], 0.006), tube([-0.072, 0.62, -0.64], [-0.072, 0.62, -0.18], 0.006),
    tube([0.072, 0.62, -0.64], [0.06, R, -0.43], 0.006), tube([-0.072, 0.62, -0.64], [-0.06, R, -0.43], 0.006),
    tube([0.072, 0.62, -0.2], [0, 0.70, -0.17], 0.0055), tube([-0.072, 0.62, -0.2], [0, 0.70, -0.17], 0.0055),
  ];
  for (let i = 0; i < 4; i++) rack.push(tube([-0.072, 0.62, -0.25 - i * 0.12], [0.072, 0.62, -0.25 - i * 0.12], 0.005));
  body.add(new THREE.Mesh(merge(rack), M(CHROME, 0.05)));
  const guard = (cz, cy, a0, a1) => {
    const g = new THREE.TorusGeometry(R + 0.035, 0.022, 5, 22, a1 - a0);
    g.scale(1, 1, 1.9); g.rotateY(Math.PI / 2); g.rotateX(-a0); g.translate(0, cy, cz);
    return g;
  };
  body.add(new THREE.Mesh(merge([guard(-0.43, R, -0.1, 2.3)]), M(PAINT, 0.16)));
  // Rear ruby reflector
  const tailRef = new THREE.Mesh(box(0.032, 0.022, 0.012, 0, 0.615, -0.65), M('#c42a22', 0.1));
  body.add(tailRef);

  // Chain guard & kickstand
  body.add(new THREE.Mesh(merge([box(0.014, 0.074, 0.50, -0.085, 0.30, -0.2)]), M(PAINT, 0.16)));
  const stand = new THREE.Group(); stand.position.set(0.05, 0.3, -0.18); body.add(stand);
  stand.add(new THREE.Mesh(merge([tube([0, 0, 0], [0, -0.3, -0.02], 0.0075)]), M(CHROME, 0.05)));

  // Spoked wheels
  const wheel = () => {
    const w = new THREE.Group();
    const tyre = new THREE.TorusGeometry(R - 0.018, 0.020, 8, 36); tyre.rotateY(Math.PI / 2);
    w.add(new THREE.Mesh(tyre, M(RUBBER, 0.32)));
    const rim = new THREE.TorusGeometry(R - 0.04, 0.0075, 5, 36); rim.rotateY(Math.PI / 2);
    const sp = [rim, tube([-0.046, 0, 0], [0.046, 0, 0], 0.017)];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2, s = i % 2 ? 1 : -1;
      sp.push(tube([s * 0.036, Math.sin(a + s * 0.25) * 0.016, Math.cos(a + s * 0.25) * 0.016], [0.004 * s, Math.sin(a) * (R - 0.045), Math.cos(a) * (R - 0.045)], 0.0018, 3));
    }
    const m = new THREE.Mesh(merge(sp), M(CHROME, 0.05)); m.userData.noOutline = true;
    w.add(m);
    return w;
  };
  const rear = wheel(); rear.position.set(...RA); body.add(rear);

  // Crankset + pedals
  const crank = new THREE.Group(); crank.position.set(...BB); body.add(crank);
  const ring = new THREE.TorusGeometry(0.096, 0.0085, 5, 28); ring.rotateY(Math.PI / 2); ring.translate(-0.065, 0, 0);
  crank.add(new THREE.Mesh(merge([
    ring,
    tube([-0.07, 0, 0], [-0.07, -0.17, 0], 0.0115),
    tube([0.07, 0, 0], [0.07, 0.17, 0], 0.0115),
    tube([-0.076, 0, 0], [0.076, 0, 0], 0.0125),
  ]), M(CHROME, 0.05)));
  const pedal = (x, y) => {
    const p = new THREE.Group(); p.position.set(x, y, 0);
    p.add(new THREE.Mesh(box(0.088, 0.022, 0.064, Math.sign(x) * 0.01, 0, 0), M(RUBBER, 0.3)));
    crank.add(p); return p;
  };
  const pedals = { R: pedal(-0.11, -0.17), L: pedal(0.11, 0.17) };

  // Steering assembly (head tube pivot + telescopic front fork compression!)
  const axisBot = new THREE.Vector3(...headBot), axisTop = new THREE.Vector3(...headTop);
  const axisDir = new THREE.Vector3().subVectors(axisTop, axisBot).normalize();
  const tilt = new THREE.Quaternion().setFromUnitVectors(UP, axisDir);
  const pivot = new THREE.Group(); pivot.position.copy(axisBot); pivot.quaternion.copy(tilt); body.add(pivot);
  const steer = new THREE.Group(); pivot.add(steer);
  const inner = new THREE.Group();
  inner.quaternion.copy(tilt).invert();
  inner.position.copy(axisBot).applyQuaternion(inner.quaternion).negate();
  steer.add(inner);

  const grips = { L: new THREE.Vector3(0.28, 1.005, 0.355), R: new THREE.Vector3(-0.28, 1.005, 0.355) };
  const stemTop = new THREE.Vector3(0, 1.0, 0.475);

  // Upper handlebars + stem + brake levers
  inner.add(new THREE.Mesh(merge([
    tube(headTop, stemTop, 0.0125),
    tube([0.125, 1.0, 0.47], [-0.125, 1.0, 0.47], 0.0115),
    tube([0.125, 1.0, 0.47], [0.26, 1.005, 0.38], 0.0115),
    tube([-0.125, 1.0, 0.47], [-0.26, 1.005, 0.38], 0.0115),
    // Brake levers visible in 1st-person cockpit!
    tube([0.21, 0.99, 0.42], [0.27, 0.96, 0.45], 0.005),
    tube([-0.21, 0.99, 0.42], [-0.27, 0.96, 0.45], 0.005),
  ]), M(CHROME, 0.05)));
  inner.add(new THREE.Mesh(merge([
    tube([0.24, 1.005, 0.39], [0.335, 1.005, 0.33], 0.017),
    tube([-0.24, 1.005, 0.39], [-0.335, 1.005, 0.33], 0.017),
  ]), M(LEATHER, 0.28)));

  // Working Brass Bell mounted on right bar (visibly animated in 1st-person cockpit!)
  const bellGroup = new THREE.Group();
  bellGroup.position.set(-0.175, 1.018, 0.44);
  const bellDome = new THREE.Mesh(new THREE.SphereGeometry(0.025, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), M(BRASS, 0.08));
  const bellStriker = new THREE.Mesh(box(0.006, 0.006, 0.028, 0.014, 0.008, -0.016), M(CHROME, 0.06));
  bellGroup.add(bellDome, bellStriker);
  inner.add(bellGroup);

  // Lower fork + front wheel (moves vertically on suspension bounce!)
  const forkLower = new THREE.Group();
  inner.add(forkLower);
  forkLower.add(new THREE.Mesh(merge([
    tube([0.045, R, FA[2]], [0.035, headBot[1] - 0.01, headBot[2]], 0.0115),
    tube([-0.045, R, FA[2]], [-0.035, headBot[1] - 0.01, headBot[2]], 0.0115),
    tube([0.035, headBot[1] - 0.01, headBot[2]], [-0.035, headBot[1] - 0.01, headBot[2]], 0.0125),
  ]), M(CHROME, 0.05)));
  forkLower.add(new THREE.Mesh(merge([guard(FA[2], R, -1.6, 0.9)]), M(PAINT, 0.16)));
  const front = wheel(); front.position.set(...FA); forkLower.add(front);

  // Woven rattan front basket + HAIZ green sketchbook inside + swinging brass leaf charm!
  {
    const bx = 0.175, by0 = 0.66, by1 = 0.935, bz0 = 0.635, bz1 = 0.915, sl = [];
    for (let i = 0; i <= 8; i++) {
      const x = -bx + (2 * bx * i) / 8;
      sl.push(box(0.008, by1 - by0, 0.008, x, (by0 + by1) / 2, bz0), box(0.008, by1 - by0, 0.008, x, (by0 + by1) / 2, bz1));
    }
    for (let i = 0; i <= 6; i++) {
      const z = bz0 + ((bz1 - bz0) * i) / 6;
      sl.push(box(0.008, by1 - by0, 0.008, -bx, (by0 + by1) / 2, z), box(0.008, by1 - by0, 0.008, bx, (by0 + by1) / 2, z));
    }
    for (let k = 0; k < 5; k++) {
      const y = by0 + 0.02 + k * 0.065, t = 0.012;
      sl.push(box(2 * bx + 0.01, t, 0.012, 0, y, bz0), box(2 * bx + 0.01, t, 0.012, 0, y, bz1), box(0.012, t, bz1 - bz0, -bx, y, (bz0 + bz1) / 2), box(0.012, t, bz1 - bz0, bx, y, (bz0 + bz1) / 2));
    }
    sl.push(box(2 * bx, 0.012, bz1 - bz0, 0, by0, (bz0 + bz1) / 2));
    const bm = new THREE.Mesh(merge(sl), M(CANE, 0.3)); bm.userData.noOutline = true;
    inner.add(bm);
    inner.add(new THREE.Mesh(merge([
      tube([0, 0.97, 0.47], [0, 0.94, 0.64], 0.007),
      tube([0.03, R + 0.04, FA[2] + 0.02], [0.03, by0, 0.70], 0.006),
    ]), M(CHROME, 0.05)));

    // HAIZ green sketchbook & rolled drawing paper nestled inside the basket (visible in 1st-person!)
    const book = new THREE.Mesh(box(0.21, 0.026, 0.16, -0.02, by0 + 0.04, (bz0 + bz1) * 0.5), M('#2e5242', 0.25));
    book.rotation.set(0.18, 0.22, -0.08);
    const pages = new THREE.Mesh(box(0.20, 0.020, 0.15, -0.02, by0 + 0.04, (bz0 + bz1) * 0.5 + 0.005), M('#efe5cf', 0.2));
    pages.rotation.copy(book.rotation);
    const scroll = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.26, 10), M('#f2e7d0', 0.22));
    scroll.position.set(0.08, by0 + 0.14, bz0 + 0.08);
    scroll.rotation.set(-0.22, 0.1, -0.35);
    inner.add(book, pages, scroll);
  }

  // Swinging brass compass-tassel charm hanging under the stem (diegetic turn/accel indicator in cockpit!)
  const charmPivot = new THREE.Group();
  charmPivot.position.set(0.06, 0.99, 0.46);
  const charmCord = new THREE.Mesh(tube([0, 0, 0], [0, -0.075, 0], 0.0025, 6), M('#b0201c', 0.3));
  const charmMedal = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.004, 12).rotateX(Math.PI / 2), M(BRASS, 0.08));
  charmMedal.position.set(0, -0.085, 0);
  charmPivot.add(charmCord, charmMedal);
  inner.add(charmPivot);

  // Warm dusk/night headlamp + painted road wash
  const lamp = createLamp(M, CHROME);
  lamp.head.position.set(0, 0.80, 0.935);
  inner.add(lamp.head);
  group.add(lamp.pool);

  finish(group, 0.0032, uFade);
  group.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });

  const wheelBase = FA[2] - RA[2];
  let bellAnim = 0;
  const charm = { ax: 0, az: 0, vx: 0, vz: 0 };

  return {
    kind: 'bike', group, body, steer, rear, front, crank, pedals, stand, grips, uFade,
    forkLower, saddleGroup, bellDome, bellStriker,
    R, wheelBase, BB: new THREE.Vector3(...BB),
    saddle: new THREE.Vector3(postTop.x, postTop.y + 0.055, postTop.z - 0.02),
    axisDir,
    grip(side, angle, out = new THREE.Vector3()) {
      out.copy(grips[side]).sub(axisBot).applyAxisAngle(axisDir, angle).add(axisBot);
      return out;
    },
    setSteer(a) { steer.rotation.y = a; lamp.pool.rotation.y = a * 0.85; },
    setLamp(k, lean = 0) { lamp.set(k, lean); },
    get lamp() { return lamp.k; },
    ringBell() { bellAnim = 1; },
    updateDetails(dt, { forkY = 0, saddleY = 0, accel = 0, latG = 0, speed = 0 }) {
      forkLower.position.y = forkY;
      saddleGroup.position.y = saddleY;
      if (bellAnim > 0) {
        bellAnim = Math.max(0, bellAnim - dt * 3.8);
        bellStriker.rotation.y = Math.sin(bellAnim * Math.PI * 5) * 0.55 * bellAnim;
        bellDome.scale.setScalar(1 + Math.sin(bellAnim * Math.PI * 8) * 0.03 * bellAnim);
      } else {
        bellStriker.rotation.y = 0;
        bellDome.scale.setScalar(1);
      }
      // Inertial charm pendulum
      const tx = THREE.MathUtils.clamp(-accel * 0.08 - speed * 0.04, -0.75, 0.65);
      const tz = THREE.MathUtils.clamp(latG * 0.14, -0.75, 0.75);
      charm.vx += ((tx - charm.ax) * 32 - charm.vx * 4.5) * dt;
      charm.vz += ((tz - charm.az) * 32 - charm.vz * 4.5) * dt;
      charm.ax = THREE.MathUtils.clamp(charm.ax + charm.vx * dt, -0.9, 0.9);
      charm.az = THREE.MathUtils.clamp(charm.az + charm.vz * dt, -0.9, 0.9);
      charmPivot.rotation.set(charm.ax, 0, charm.az);
    },
  };
}

function createLamp(M, CHROME) {
  const head = new THREE.Group();
  const housing = new THREE.CylinderGeometry(0.036, 0.03, 0.06, 14); housing.rotateX(Math.PI / 2);
  head.add(new THREE.Mesh(housing, M(CHROME, 0.05)));
  const glassMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.42, 0.38, 0.3), toneMapped: false });
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.031, 16), glassMat);
  glass.position.z = 0.031; glass.userData.noOutline = true; head.add(glass);

  const haloMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uK: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(0.0,0.0,0.0,1.0); mv.xy += position.xy; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uK; varying vec2 vUv; void main(){ float r = length(vUv * 2.0 - 1.0); float a = exp(-r*r*9.0) + 0.25 * exp(-r*r*2.5); gl_FragColor = vec4(vec3(1.0, 0.84, 0.56) * a * uK * 0.95, 1.0); }`,
  });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), haloMat);
  halo.position.z = 0.05; halo.userData.noOutline = true; halo.renderOrder = 5; halo.frustumCulled = false;
  head.add(halo);

  const poolMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: { uK: { value: 0 }, uLean: { value: 0 } },
    vertexShader: `varying vec2 vP; varying vec3 vW; void main(){ vP = position.xz; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
uniform float uK; uniform float uLean; varying vec2 vP; varying vec3 vW;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
void main(){
  float z = vP.y - 0.75;
  float x = vP.x + uLean * z * 0.35;
  float spread = 0.35 + z * 0.32;
  float across = 1.0 - smoothstep(0.35, 1.0, abs(x) / spread);
  float along = smoothstep(0.0, 1.3, z) * (1.0 - smoothstep(3.2, 9.5, z));
  float paper = n(vW.xz * 2.3) * 0.6 + n(vW.xz * 7.1) * 0.4;
  float a = across * along * smoothstep(0.08, 0.5, paper * 0.7 + across * 0.5);
  float fall = 1.0 / (1.0 + z * z * 0.055);
  gl_FragColor = vec4(vec3(1.0, 0.80, 0.48) * a * fall * uK * 0.46, 1.0);
}`,
  });
  const poolG = new THREE.PlaneGeometry(7.2, 10, 1, 1).rotateX(-Math.PI / 2).translate(0, 0.038, 0.75 + 5.0);
  const pool = new THREE.Mesh(poolG, poolMat);
  pool.userData.noOutline = true; pool.renderOrder = 2; pool.frustumCulled = false; pool.visible = false;
  const L = { head, pool, k: 0 };
  L.set = (k, lean) => {
    L.k = k;
    haloMat.uniforms.uK.value = k; poolMat.uniforms.uK.value = k; poolMat.uniforms.uLean.value = lean;
    halo.visible = pool.visible = k > 0.01;
    glassMat.color.setRGB(0.42 + 2.3 * k, 0.38 + 1.7 * k, 0.3 + 0.9 * k);
  };
  return L;
}

// ======================================================================== 2. THE SKATEBOARD
function deckTexture() {
  const c = document.createElement('canvas'); c.width = 160; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#eadec4'; g.fillRect(0, 0, 160, 512);
  const grd = g.createLinearGradient(0, 70, 0, 440);
  grd.addColorStop(0, '#367442'); grd.addColorStop(0.62, '#6c9c3a'); grd.addColorStop(1, '#b53a20');
  g.fillStyle = grd;
  g.beginPath(); g.moveTo(80, 68);
  g.bezierCurveTo(152, 152, 144, 336, 80, 444);
  g.bezierCurveTo(16, 336, 8, 152, 80, 68);
  g.fill();
  g.strokeStyle = 'rgba(24,32,22,.55)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(80, 76); g.lineTo(80, 440); g.stroke();
  g.lineWidth = 1.6;
  for (let i = 0; i < 7; i++) {
    const y = 128 + i * 42;
    g.beginPath();
    g.moveTo(80, y); g.quadraticCurveTo(104, y - 18, 128, y - 34 + i * 3);
    g.moveTo(80, y); g.quadraticCurveTo(56, y - 18, 32, y - 34 + i * 3);
    g.stroke();
  }
  g.fillStyle = '#b0201c'; g.fillRect(62, 460, 36, 36);
  g.fillStyle = '#f6ecd8'; g.font = 'bold 16px serif'; g.textAlign = 'center';
  g.fillText('海', 80, 476); g.fillText('中', 80, 492);
  g.fillStyle = '#2a2620'; g.font = '700 20px sans-serif'; g.fillText('HAIZ', 80, 46);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function createBoard() {
  const uFade = { value: 0 };
  const M = makeMaterials(uFade);
  const group = new THREE.Group(); group.name = 'fm-board';
  const deck = new THREE.Group(); group.add(deck);
  const L = 0.81, W = 0.21, H = 0.112;

  const shape = new THREE.Shape();
  const hl = L / 2 - W / 2;
  shape.moveTo(-W / 2, -hl); shape.lineTo(-W / 2, hl);
  shape.absarc(0, hl, W / 2, Math.PI, 0, true);
  shape.lineTo(W / 2, -hl);
  shape.absarc(0, -hl, W / 2, 0, Math.PI, true);
  const ex = new THREE.ExtrudeGeometry(shape, { depth: 0.013, bevelEnabled: false, curveSegments: 12 });
  ex.rotateX(-Math.PI / 2);
  const pos = ex.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = -pos.getZ(i);
    const kt = Math.max(0, Math.abs(z) - 0.25) / 0.155;
    const lift = Math.pow(Math.min(kt, 1.2), 1.6) * 0.056;
    const concave = (x / (W / 2)) ** 2 * 0.007;
    pos.setXYZ(i, x, y + H + lift + concave, z);
  }
  ex.computeVertexNormals();
  deck.add(new THREE.Mesh(ex, M('#c79658', 0.25)));

  const skin = (top) => {
    const g = new THREE.PlaneGeometry(W * 0.985, L * 0.985, 6, 40);
    g.rotateX(top ? -Math.PI / 2 : Math.PI / 2);
    const p = g.getAttribute('position'), uv = g.getAttribute('uv');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const r = Math.max(0, Math.abs(z) - hl);
      const xm = W / 2 * Math.sqrt(Math.max(0, 1 - (r / (W / 2)) ** 2)) * 0.985;
      const xx = Math.sign(x) * Math.min(Math.abs(x), xm);
      const kt = Math.max(0, Math.abs(z) - 0.25) / 0.155;
      const lift = Math.pow(Math.min(kt, 1.2), 1.6) * 0.056;
      const concave = (xx / (W / 2)) ** 2 * 0.007;
      p.setXYZ(i, xx, H + lift + concave + (top ? 0.0132 : -0.0008), z);
      if (!top) uv.setXY(i, uv.getX(i), 1 - uv.getY(i));
    }
    g.computeVertexNormals();
    return g;
  };
  const gripM = M('#222325', 0.4, 'albedo *= 0.84 + 0.32 * aNoise(vWP.xz * 420.0);\n');
  const top = new THREE.Mesh(skin(true), gripM); top.userData.noOutline = true; deck.add(top);
  const botM = M('#ffffff', 0.24); botM.map = deckTexture();
  const bot = new THREE.Mesh(skin(false), botM); bot.userData.noOutline = true; deck.add(bot);

  // Trucks, bushings & urethane wheels with metallic bearing hubs
  const trucks = [], wheels = [];
  for (const zt of [0.238, -0.238]) {
    const t = new THREE.Group(); t.position.set(0, 0.03, zt); deck.add(t);
    deck.add(new THREE.Mesh(box(0.062, 0.012, 0.082, 0, H - 0.006, zt), M('#9ea4a8', 0.05)));
    t.add(new THREE.Mesh(merge([
      box(0.022, 0.052, 0.032, 0, 0.04, 0),
      tube([-0.105, 0, 0], [0.105, 0, 0], 0.0085),
    ]), M('#a4aaae', 0.05)));
    t.add(new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.022, 8).translate(0, 0.048, 0), M('#c9482e', 0.2)));
    for (const s of [-1, 1]) {
      const wg = new THREE.Group();
      wg.position.set(s * 0.088, 0, 0);
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.034, 16).rotateZ(Math.PI / 2), M('#efe5ce', 0.28));
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.036, 10).rotateZ(Math.PI / 2), M('#b0201c', 0.15));
      hub.userData.noOutline = true;
      wg.add(tyre, hub);
      t.add(wg);
      wheels.push(wg);
    }
    trucks.push(t);
  }
  finish(group, 0.0025, uFade);
  group.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  return { kind: 'board', group, deck, trucks, wheels, uFade, L, W, H, topY: H + 0.0132 };
}

// ======================================================================== 3. WU BO'S BAMBOO BROOM
export function createBroom() {
  const uFade = { value: 0 };
  const M = makeMaterials(uFade);
  const group = new THREE.Group(); group.name = 'fm-broom';
  const body = new THREE.Group(); group.add(body);
  const BAMBOO = '#bda468', NODE = '#997e48', TWIG = '#a98a50', CORD = '#8f291d', BRASS = '#d4a64a';

  const back = -0.62, tip = 1.02;
  const pole = [tube([0, 0, back], [0, 0, tip], 0.018, 10, 0.015)];
  const nodes = [];
  for (let z = back + 0.18; z < tip; z += 0.30) nodes.push(tube([0, 0, z - 0.008], [0, 0, z + 0.008], 0.021, 10));
  body.add(new THREE.Mesh(merge(pole), M(BAMBOO, 0.2, 'albedo *= 0.92 + 0.12 * aNoise(vec2(vWP.x * 3.0 + vWP.z * 3.0, vWP.y * 90.0));\n')));
  body.add(new THREE.Mesh(merge(nodes), M(NODE, 0.2)));

  // Layered fanned natural bamboo twigs
  const twigs = [];
  let s = 11;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 128; i++) {
    const a = rnd() * Math.PI * 2, r0 = Math.sqrt(rnd()) * 0.036;
    const spread = 0.13 + rnd() * 0.13, L = 0.56 + rnd() * 0.24;
    const ax = Math.cos(a), ay = Math.sin(a);
    const start = new THREE.Vector3(ax * r0, ay * r0 * 0.8, back + 0.08);
    const end = new THREE.Vector3(ax * spread * 1.28 + (rnd() - 0.5) * 0.05, ay * spread * 0.55 + (rnd() - 0.5) * 0.04 - 0.02, back - L);
    twigs.push(tube(start, end, 0.0022 + rnd() * 0.0016, 3));
  }
  const twigMesh = new THREE.Mesh(merge(twigs), M(TWIG, 0.35, 'albedo *= 0.8 + 0.35 * aNoise(vWP.xz * 60.0 + vWP.y * 40.0);\n'));
  twigMesh.userData.noOutline = true;
  body.add(twigMesh);

  // Crimson binding cord
  body.add(new THREE.Mesh(merge([
    tube([0, 0, back + 0.04], [0, 0, back + 0.078], 0.043, 12),
    tube([0, 0, back - 0.035], [0, 0, back - 0.005], 0.052, 12),
  ]), M(CORD, 0.28)));

  // Petalwake-inspired hanging inertial brass & paper campus lantern at the broom tip!
  const lanternHook = new THREE.Group();
  lanternHook.position.set(0, -0.015, tip - 0.06);
  body.add(lanternHook);
  const lanternSwing = new THREE.Group();
  lanternHook.add(lanternSwing);
  lanternSwing.add(new THREE.Mesh(tube([0, 0, 0], [0, -0.09, 0], 0.003, 6), M(BRASS, 0.1)));
  lanternSwing.add(new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.046, 0.018, 10).translate(0, -0.095, 0), M(BRASS, 0.1)));
  lanternSwing.add(new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.032, 0.016, 10).translate(0, -0.205, 0), M(BRASS, 0.1)));
  const lanternGlassMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd480'), toneMapped: false });
  const lanternGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.036, 0.098, 10).translate(0, -0.15, 0), lanternGlassMat);
  lanternGlass.userData.noOutline = true;
  lanternSwing.add(lanternGlass);
  const lanternHaloMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uGlow: { value: 0.08 }, uFade },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; vec4 mv = modelViewMatrix * vec4(0.0,-0.15,0.0,1.0); mv.xy += position.xy; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uGlow; uniform float uFade; varying vec2 vUv; void main(){ float r = length(vUv*2.0-1.0); float a = exp(-r*r*7.5) + 0.25 * exp(-r*r*2.2); gl_FragColor = vec4(vec3(1.0, 0.76, 0.36) * a * uGlow * uFade, 1.0); }`,
  });
  const lanternHalo = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), lanternHaloMat);
  lanternHalo.userData.noOutline = true; lanternHalo.renderOrder = 5; lanternHalo.frustumCulled = false;
  lanternSwing.add(lanternHalo);

  // Flowing 14-segment Verlet crimson silk ribbon
  const ribbonObj = createRibbonMesh(M, '#c92a1e', 14, 0.068, 0.018, uFade);
  group.add(ribbonObj.mesh);
  const anchorLocal = new THREE.Vector3(0.036, 0.02, back + 0.06);

  finish(group, 0.003, uFade);
  group.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });

  const pend = { ax: 0, az: 0, vx: 0, vz: 0 };
  const tmpA = new THREE.Vector3(), tmpSide = new THREE.Vector3();

  return {
    kind: 'broom', group, body, uFade, ribbon: ribbonObj.mesh, back, tip, lanternSwing,
    resetRibbon() { ribbonObj.reset(); },
    updateDetails(dt, windWorld, { fwdA = 0, latA = 0, speed = 0, pitch = 0, roll = 0, night = 0, gust = 0 }) {
      body.updateMatrixWorld(true);
      tmpA.copy(anchorLocal).applyMatrix4(body.matrixWorld);
      tmpSide.set(1, 0, 0).transformDirection(body.matrixWorld);
      ribbonObj.step(dt, tmpA, windWorld, tmpSide, 0);

      // Inertial 2-axis lantern pendulum (modeled directly after Petalwake's rider.js!)
      const drag = speed * 0.032;
      const gx = 9.8 * Math.sin(pitch) + fwdA * 0.28 - drag * 9.8;
      const gz = 9.8 * Math.sin(roll) * 0.65 - latA * 0.14;
      const len = 0.22;
      pend.vx += (-(9.8 / len) * Math.sin(pend.ax) * 0.35 + gx * 1.3 - pend.vx * 2.8) * dt;
      pend.vz += (-(9.8 / len) * Math.sin(pend.az) * 0.35 + gz * 1.3 - pend.vz * 2.8) * dt;
      pend.ax = THREE.MathUtils.clamp(pend.ax + pend.vx * dt, -1.15, 1.05);
      pend.az = THREE.MathUtils.clamp(pend.az + pend.vz * dt, -0.85, 0.85);
      lanternSwing.rotation.set(pend.ax, 0, pend.az);

      // Lantern stays warm honey-paper by day (no HDR blowout!), glowing warmly at dusk/night!
      const haloGlow = night * (0.58 + gust * 0.28) + (1 - night) * gust * 0.06;
      lanternHaloMat.uniforms.uGlow.value = haloGlow;
      const glassBoost = night * 0.55 + gust * 0.08;
      lanternGlassMat.color.setRGB(0.92 + glassBoost * 0.45, 0.70 + glassBoost * 0.32, 0.34 + glassBoost * 0.16);
    },
  };
}

// ======================================================================== 4. TERMINALIA MONSOON GLIDER (榄仁纸鸢)
// Brand-new HAIZ-native 5th mode: giant translucent backlit Terminalia leaf + lashed bamboo hang-glider
export function createGlider() {
  const uFade = { value: 0 };
  const uFlex = { value: 0 };
  const M = makeMaterials(uFade);
  const group = new THREE.Group(); group.name = 'fm-glider';
  const body = new THREE.Group(); group.add(body);
  const BAMBOO = '#bfa262', CORD = '#982c1e';

  // Custom backlit tropical Terminalia leaf canopy geometry (swept arched twin-lobe wing, span ~3.7m)
  function buildLeafWingGeo() {
    const segX = 28, segZ = 14;
    const pos = [], uvs = [], idx = [];
    for (let iz = 0; iz <= segZ; iz++) {
      const v = iz / segZ; // 0 trailing edge -> 1 leading edge
      for (let ix = 0; ix <= segX; ix++) {
        const u = (ix / segX) * 2 - 1; // -1 left wingtip -> +1 right wingtip
        const au = Math.abs(u);
        // Organic swept Terminalia twin-leaf silhouette
        const span = 1.92;
        const x = u * span;
        const leadZ = 0.92 - au * 0.98 - au * au * 0.14;
        const trailZ = -0.68 + au * 0.22 - Math.sin(au * Math.PI) * 0.28;
        const z = THREE.MathUtils.lerp(trailZ, leadZ, v);
        // Gentle cathedral arch + camber airfoil profile + subtle twin-lobe ripple
        const arch = (1 - au * au * 0.65) * 0.24 - au * 0.14;
        const camber = Math.sin(v * Math.PI) * 0.11 * (1 - au * 0.55);
        const y = 0.72 + arch + camber;
        pos.push(x, y, z);
        uvs.push(u * 0.5 + 0.5, v);
      }
    }
    const row = segX + 1;
    for (let iz = 0; iz < segZ; iz++) {
      for (let ix = 0; ix < segX; ix++) {
        const a = iz * row + ix, b = a + 1, c = a + row, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  // Painted translucent Terminalia leaf material with golden backlit subsurface veins!
  const leafMat = cel({
    name: 'fm-glider-leaf',
    key: 'fm-glider-leaf',
    color: new THREE.Color('#6f9b42'),
    side: THREE.DoubleSide,
    soft: 0.25,
    flipBack: true,
    uniforms: { uFade, uFlex },
    vertex: {
      head: 'uniform float uFlex; varying vec2 vLeafUv;\n',
      begin: /* glsl */`
vLeafUv = uv;
float au = abs(uv.x * 2.0 - 1.0);
transformed.y += au * au * (0.12 * uFlex + 0.035 * sin(uTime * 5.2 + au * 3.0));
`,
    },
    fragment: {
      head: 'uniform float uFade; varying vec2 vLeafUv;\n',
      pre: /* glsl */`
float fn = aNoise(vWP.xy * 11.0 + vWP.zy * 8.0) * 0.75 + aNoise(vWP.xz * 29.0) * 0.25;
if (uFade < 0.999 && fn > uFade * 1.1 - 0.05) discard;
`,
      albedo: /* glsl */`
float u = abs(vLeafUv.x * 2.0 - 1.0);
float v = vLeafUv.y;
// Autumn-tipped Terminalia leaf palette: emerald heart -> sunlit chartreuse -> warm terracotta tips
vec3 greenCore = vec3(0.24, 0.46, 0.22);
vec3 goldMid = vec3(0.58, 0.64, 0.22);
vec3 redTip = vec3(0.68, 0.24, 0.14);
albedo = mix(greenCore, goldMid, smoothstep(0.18, 0.72, u));
albedo = mix(albedo, redTip, smoothstep(0.65, 0.98, u) * (0.65 + 0.35 * (1.0 - v)));
// Organic branching leaf veins
float veinPhase = fract((u * 7.5 - v * 2.4) * 1.3);
float vein = 1.0 - smoothstep(0.0, 0.075, abs(veinPhase - 0.5));
float midrib = 1.0 - smoothstep(0.0, 0.025, u);
albedo = mix(albedo, vec3(0.76, 0.72, 0.34), max(vein * 0.45, midrib * 0.65));
albedo *= 0.92 + 0.16 * aNoise(vLeafUv * 24.0);
`,
      after: /* glsl */`
// Backlit tropical sunlight glowing through the translucent leaf membrane!
vec3 Vdir = normalize(cameraPosition - vWP);
float trans = pow(max(0.0, dot(-Vdir, uSunDir)), 2.5) * 0.55 + 0.22 * max(0.0, uSunDir.y);
outCol += vec3(0.78, 0.82, 0.26) * uSunColor * trans * (0.45 + 0.55 * (1.0 - abs(vLeafUv.x * 2.0 - 1.0))) * 0.55;
{ float fe = smoothstep(uFade * 1.1 - 0.13, uFade * 1.1 - 0.05, fn) * step(uFade, 0.999); outCol = mix(outCol, vec3(0.07, 0.06, 0.06), fe * 0.85); }
`,
    },
  });

  const canopy = new THREE.Mesh(buildLeafWingGeo(), leafMat);
  canopy.userData.noOutline = true;
  canopy.castShadow = true;
  canopy.receiveShadow = true;
  body.add(canopy);

  // Lashed golden bamboo airframe: leading edge spars, keel, cross-spar, kingpost, and triangular trapeze bar!
  const keelTop = [0, 0.96, 0.92], keelBack = [0, 0.90, -0.68];
  const tipL = [1.90, 0.66, -0.30], tipR = [-1.90, 0.66, -0.30];
  const midL = [0.95, 0.88, 0.20], midR = [-0.95, 0.88, 0.20];
  const barL = [0.42, 0.16, 0.38], barR = [-0.42, 0.16, 0.38];
  const apex = [0, 0.94, 0.32];
  const spars = [
    tube(keelBack, keelTop, 0.017),
    tube(keelTop, midL, 0.016), tube(midL, tipL, 0.013),
    tube(keelTop, midR, 0.016), tube(midR, tipR, 0.013),
    tube(midL, midR, 0.014),
    // Triangular control trapeze (rider hangs beneath and reaches forward to grip base bar!)
    tube(apex, barL, 0.013), tube(apex, barR, 0.013), tube(barL, barR, 0.014),
    // Subtle rigging wires
    tube(barL, tipL, 0.003, 5), tube(barR, tipR, 0.003, 5),
    tube(barL, keelBack, 0.003, 5), tube(barR, keelBack, 0.003, 5),
  ];
  body.add(new THREE.Mesh(merge(spars), M(BAMBOO, 0.2)));

  // Crimson lashings at joints
  const lashings = [
    tube([0, 0.94, 0.28], [0, 0.94, 0.36], 0.025, 10),
    tube([0, 0.955, 0.68], [0, 0.955, 0.74], 0.025, 10),
    tube([0.40, 0.16, 0.38], [0.44, 0.16, 0.38], 0.020, 8),
    tube([-0.40, 0.16, 0.38], [-0.44, 0.16, 0.38], 0.020, 8),
  ];
  body.add(new THREE.Mesh(merge(lashings), M(CORD, 0.3)));

  // Twin Verlet silk streamers at left and right wingtips (vivid visual airflow & turn indicator!)
  const ribL = createRibbonMesh(M, '#f5e7c2', 12, 0.085, 0.016, uFade);
  const ribR = createRibbonMesh(M, '#f5e7c2', 12, 0.085, 0.016, uFade);
  group.add(ribL.mesh, ribR.mesh);
  const tipLocalL = new THREE.Vector3(...tipL);
  const tipLocalR = new THREE.Vector3(...tipR);

  finish(group, 0.0028, uFade);
  group.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });

  const tmpL = new THREE.Vector3(), tmpR = new THREE.Vector3(), tmpSide = new THREE.Vector3();

  return {
    kind: 'glider', group, body, uFade, uFlex,
    barL: new THREE.Vector3(0.28, 0.16, 0.38),
    barR: new THREE.Vector3(-0.28, 0.16, 0.38),
    resetRibbons() { ribL.reset(); ribR.reset(); },
    updateDetails(dt, windWorld, flex = 0) {
      uFlex.value += (flex - uFlex.value) * (1 - Math.exp(-dt * 6));
      body.updateMatrixWorld(true);
      tmpL.copy(tipLocalL).applyMatrix4(body.matrixWorld);
      tmpR.copy(tipLocalR).applyMatrix4(body.matrixWorld);
      tmpSide.set(0, 1, 0).transformDirection(body.matrixWorld);
      ribL.step(dt, tmpL, windWorld, tmpSide, 0);
      ribR.step(dt, tmpR, windWorld, tmpSide, 2.3);
    },
  };
}
