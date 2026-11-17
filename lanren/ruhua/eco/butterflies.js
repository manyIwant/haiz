// 入画 · butterflies.
//
// Three species common in Haikou's gardens, each with its own flight:
//   迁粉蝶 Catopsilia pomona      lemon-white; quick and direct, bounding between flowers
//   金斑蝶 Danaus chrysippus      orange with a black, white-spotted tip; floats and glides, slow
//   青凤蝶 Graphium sarpedon      black with a blue-green band; fast and restless; after rain it
//                                 comes down to drink from damp paving (puddling)
//
// Each butterfly has a purpose and a little uncertainty, never a fixed route:
//   forage   choose a flower (attractive, near, not visited lately — it remembers its last few),
//            fly there with the species' weave and the bob of each wing beat, hover, settle, feed
//   rest     settled with wings closed upright, opening now and then to bask
//   flee     a walker closing in fast (or near and running): up and away, then another flower
//   puddle   (青凤蝶) on wet, sunny paving after rain
//   hide     rain, strong wind, cold or night: they are among the leaves and cannot be seen
// The wind carries them; activity follows sun, warmth, rain and the hour. Only those within a
// short walk of the walker are simulated; the rest wait at their flowers.
import * as THREE from 'three';
import { U, GLSL } from '../../stroll/atmos.js';

const SPECIES = [
  { name: '迁粉蝶', speed: 2.1, weave: 0.9, glide: 0.1, flapHz: 11, span: 0.11, cell: 0 },
  { name: '金斑蝶', speed: 1.3, weave: 0.5, glide: 0.55, flapHz: 6, span: 0.13, cell: 1 },
  { name: '青凤蝶', speed: 3.0, weave: 1.2, glide: 0.2, flapHz: 13, span: 0.12, cell: 2, puddles: true },
];

function wingAtlas() {
  const W = 256, H = 128, c = document.createElement('canvas');
  c.width = W; c.height = H * 3;
  const g = c.getContext('2d');
  // one right wing per row (fore + hind), body at x = 0
  const wing = (row, fore, hind, draw) => {
    g.save(); g.translate(0, row * H);
    g.beginPath();
    g.moveTo(4, 58); g.bezierCurveTo(60, 2, 200, -6, 238, 22); g.bezierCurveTo(226, 48, 140, 66, 70, 64);  // forewing
    g.fillStyle = fore; g.fill();
    g.beginPath();
    g.moveTo(6, 66); g.bezierCurveTo(70, 62, 170, 76, 176, 104); g.bezierCurveTo(150, 128, 50, 124, 8, 76); // hindwing
    g.fillStyle = hind; g.fill();
    draw?.(g);
    g.restore();
  };
  wing(0, '#f4e27a', '#f6eaa4', (q) => { q.fillStyle = 'rgba(120,90,20,.55)'; q.beginPath(); q.arc(232, 22, 6, 0, 7); q.fill(); q.fillStyle = 'rgba(200,150,40,.45)'; q.beginPath(); q.arc(120, 40, 5, 0, 7); q.fill(); });
  wing(1, '#e28b2a', '#e9973a', (q) => {
    q.fillStyle = '#1e1a18'; q.beginPath(); q.moveTo(150, 8); q.bezierCurveTo(200, 0, 240, 10, 238, 22); q.bezierCurveTo(226, 44, 186, 52, 150, 50); q.fill();
    q.fillStyle = '#f4efe6'; for (const [x, y, rr] of [[196, 24, 6], [214, 30, 5], [178, 34, 5], [222, 18, 3]]) { q.beginPath(); q.arc(x, y, rr, 0, 7); q.fill(); }
    q.strokeStyle = '#1e1a18'; q.lineWidth = 4; q.beginPath(); q.moveTo(176, 104); q.bezierCurveTo(150, 128, 50, 124, 8, 76); q.stroke();
  });
  wing(2, '#1b1c1f', '#1d1e21', (q) => {
    q.fillStyle = '#5fc8bd';
    q.beginPath(); q.moveTo(40, 56); q.bezierCurveTo(90, 40, 140, 26, 190, 22); q.lineTo(192, 34); q.bezierCurveTo(140, 40, 92, 56, 44, 66); q.fill();
    q.beginPath(); q.moveTo(30, 74); q.bezierCurveTo(70, 72, 110, 84, 130, 100); q.lineTo(118, 106); q.bezierCurveTo(96, 92, 66, 84, 26, 82); q.fill();
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const VERT = /* glsl */`
${GLSL}
attribute vec4 aPos;    // xyz, flap angle
attribute vec4 aRot;    // yaw, pitch, roll, species cell
attribute float aSpan;
attribute float aSide;  // -1 left wing, +1 right wing
varying vec2 vUv; varying vec3 vWP; varying vec3 vN;
void main() {
  vec3 p = position;                         // a right wing in its own plane: x out from the body, z along it
  float side = aSide;
  float flap = aPos.w;
  // the wing turns about the body axis (z): up when flap > 0
  float c = cos(flap), s = sin(flap);
  vec3 w = vec3(p.x * c, p.x * s, p.z);
  w.x *= side;
  vec3 n = normalize(vec3(-s * side, c, 0.0));
  w *= aSpan;
  float cy = cos(aRot.x), sy = sin(aRot.x), cp = cos(aRot.y), sp = sin(aRot.y), cr = cos(aRot.z), sr = sin(aRot.z);
  mat3 Ry = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
  mat3 Rx = mat3(1.0, 0.0, 0.0, 0.0, cp, sp, 0.0, -sp, cp);
  mat3 Rz = mat3(cr, sr, 0.0, -sr, cr, 0.0, 0.0, 0.0, 1.0);
  mat3 R = Ry * Rx * Rz;
  vec3 wp = aPos.xyz + R * w;
  vN = R * n;
  vWP = wp;
  vUv = vec2(uv.x, (uv.y + aRot.w) / 3.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const FRAG = /* glsl */`
${GLSL}
uniform sampler2D uWing;
varying vec2 vUv; varying vec3 vWP; varying vec3 vN;
void main() {
  vec4 t = texture2D(uWing, vUv);
  if (t.a < 0.5) discard;
  vec3 N = normalize(gl_FrontFacing ? vN : -vN);
  vec3 col = toonLight(pow(t.rgb, vec3(2.2)) * 0.9, N, vWP, 1.0, 1.0, 0.35);
  // light through the thin wing
  vec3 V = normalize(cameraPosition - vWP);
  col += pow(t.rgb, vec3(2.2)) * uSunColor * 0.35 * pow(max(dot(-V, uSunDir), 0.0), 2.0);
  gl_FragColor = vec4(aerial(col, vWP), 1.0);
}`;

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export function createButterflies(habitat, { max = 24, layer = 2 } = {}) {
  const H = habitat;
  // patches: clusters of flowers; each is home to one to three butterflies
  const patches = [];
  for (const f of H.flowers) {
    let p = patches.find((q) => Math.hypot(q.x - f.x, q.z - f.z) < 9);
    if (!p) { p = { x: f.x, z: f.z, flowers: [] }; patches.push(p); }
    p.flowers.push(f);
  }
  const r0 = rng(1117);
  const all = [];
  patches.forEach((p, pi) => {
    const n = p.flowers.length > 12 ? 3 : p.flowers.length > 4 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const sp = SPECIES[Math.floor(r0() * 3)];
      const f = p.flowers[Math.floor(r0() * p.flowers.length)];
      all.push({ sp, home: p, r: rng(9000 + pi * 7 + k), state: 'rest', pos: new THREE.Vector3(f.x, f.y, f.z), vel: new THREE.Vector3(), yaw: r0() * 6.28, pitch: 0, roll: 0,
        flap: 1.3, phase: r0() * 10, timer: r0() * 8, target: f, perch: f, memory: [], active: false, hidden: false, weave: r0() * 100 });
    }
  });
  // drawing: two wing quads per butterfly
  const quad = new THREE.PlaneGeometry(1, 1, 1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0);   // x 0..1 out from the body, z along it
  const pos = [], uv = [], side = [], idx = [];
  for (const sgn of [-1, 1]) {
    const o = pos.length / 3;
    const P = quad.getAttribute('position'), T = quad.getAttribute('uv');
    for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), -P.getZ(i)); uv.push(T.getX(i), T.getY(i)); side.push(sgn); }
    const I = quad.index.array; for (let i = 0; i < I.length; i++) idx.push(o + I[i]);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  g.setIndex(idx);
  const aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4), aRot = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4), aSpan = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
  for (const a of [aPos, aRot, aSpan]) a.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aPos', aPos); g.setAttribute('aRot', aRot); g.setAttribute('aSpan', aSpan);
  g.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, uniforms: { ...U, uWing: { value: wingAtlas() } } });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false; mesh.layers.set(layer); mesh.name = 'butterflies';

  // ---- how inviting the air is to a butterfly right now (0..1)
  function activity() {
    const S = H.W, c = S.cur, p = S.pal;
    const day = 1 - p.night;
    const warm = Math.min(1, Math.max(0, (c.temp - 16) / 6)) * (1 - Math.max(0, (c.temp - 36) / 4));
    const dry = 1 - Math.min(1, S.rainNow * 3);
    const calm = 1 - Math.min(1, Math.max(0, (c.wind - 5) / 4));
    const light = 0.35 + 0.65 * p.direct;
    return day * warm * dry * calm * light;
  }
  function chooseFlower(b) {
    const near = b.home.flowers.concat(H.flowersNear(b.pos.x, b.pos.z, 14));
    let best = null, bs = -1;
    for (const f of near) {
      if (f === b.perch || b.memory.includes(f)) continue;
      const d = Math.hypot(f.x - b.pos.x, f.z - b.pos.z);
      const fresh = Math.min(1, (H.W.time - f.last) / 40);           // a flower just drunk from has less to give
      const s = f.a * fresh / (1 + d / 7) * (0.6 + 0.8 * b.r());
      if (s > bs) { bs = s; best = f; }
    }
    return best || b.home.flowers[Math.floor(b.r() * b.home.flowers.length)];
  }
  function puddleSpot(b) {
    for (let k = 0; k < 6; k++) {
      const x = b.pos.x + (b.r() - 0.5) * 14, z = b.pos.z + (b.r() - 0.5) * 14;
      if (H.sun(x, z) > 0.4) return { x, y: H.heightAt(x, z) + 0.01, z, kind: 'puddle', a: 1, last: -1e9 };
    }
    return null;
  }
  const tmp = new THREE.Vector3(), des = new THREE.Vector3();
  function think(b, act) {
    const pl = H.player;
    const dp = Math.hypot(pl.pos.x - b.pos.x, pl.pos.z - b.pos.z);
    // a walker bearing down, or running close by: flee
    if (b.state !== 'flee' && b.state !== 'hide' && dp < (pl.speed > 3 ? 4 : 2.2)) {
      const closing = ((b.pos.x - pl.pos.x) * pl.vel.x + (b.pos.z - pl.pos.z) * pl.vel.z) / Math.max(dp, 0.1);
      if (closing > 0.35 || pl.speed > 3) { b.state = 'flee'; b.timer = 1.6 + b.r(); b.flee = new THREE.Vector3(b.pos.x - pl.pos.x, 0, b.pos.z - pl.pos.z).normalize(); return; }
    }
    if (act < 0.18 && b.state !== 'hide') { b.state = 'hide'; b.timer = 20; return; }
    if (b.state === 'hide' && act > 0.25 && b.r() < 0.3) { b.state = 'rest'; b.timer = 1 + b.r() * 3; }
    if (b.timer > 0) return;
    if (b.state === 'rest' || b.state === 'feed') {
      // puddling: a 青凤蝶 after rain, when the paving is wet and the sun is out
      if (b.sp.puddles && H.W.cur.wet > 0.35 && H.W.pal.direct > 0.4 && b.r() < 0.5) { const p = puddleSpot(b); if (p) { b.target = p; b.state = 'fly'; b.timer = 25; return; } }
      if (b.r() < act * 0.9 + 0.05) { b.target = chooseFlower(b); b.state = 'fly'; b.timer = 20; }
      else b.timer = 2 + b.r() * 6;
    }
  }

  function step(b, dt, act) {
    b.timer -= dt; b.phase += dt;
    const sp = b.sp, c = H.W.cur;
    const wind = tmp.set(c.windDir[0], 0, c.windDir[1]).multiplyScalar(c.windSpeed * 0.12 * (0.6 + 0.4 * Math.sin(b.phase * 0.7)));
    if (b.state === 'fly' || b.state === 'flee') {
      const t = b.target;
      if (b.state === 'flee') {
        des.copy(b.flee).multiplyScalar(sp.speed * 1.4); des.y = 0.9;
        if (b.timer <= 0) { b.target = chooseFlower(b); b.state = 'fly'; b.timer = 20; }
      } else {
        des.set(t.x - b.pos.x, t.y + 0.04 - b.pos.y, t.z - b.pos.z);
        const d = des.length();
        // the approach: slower, a short hover, then down onto the flower
        const want = d < 0.6 ? Math.max(0.25, d * 1.6) : sp.speed;
        des.multiplyScalar(want / Math.max(d, 1e-3));
        if (d > 1.5) des.y += 0.35 + Math.sin(b.phase * 1.3) * 0.4;   // cruise above the flowers, never skimming the ground
        if (d < 0.05 || b.timer <= 0) {
          b.perch = t; b.pos.set(t.x, t.y, t.z); b.vel.set(0, 0, 0);
          b.state = t.kind === 'puddle' ? 'puddle' : 'feed';
          b.timer = t.kind === 'puddle' ? 8 + b.r() * 20 : 3 + b.r() * 12;
          t.last = H.W.time;
          b.memory.push(t); if (b.memory.length > 4) b.memory.shift();
          return;
        }
      }
      // the weave: low-frequency wandering of the heading, unique to each individual
      const wv = sp.weave * (Math.sin(b.phase * 2.3 + b.weave) * 0.6 + Math.sin(b.phase * 5.1 + b.weave * 2) * 0.4);
      const yawD = Math.atan2(des.x, des.z) + wv * 0.9;
      const hs = Math.hypot(des.x, des.z);
      des.x = Math.sin(yawD) * hs; des.z = Math.cos(yawD) * hs;
      // each beat lifts it a little; gliders sink between bursts of beats
      const beating = sp.glide > 0.3 ? (Math.sin(b.phase * 0.9 + b.weave) > -0.2 ? 1 : 0) : 1;
      des.y += (beating ? Math.sin(b.phase * sp.flapHz * 6.283) * 0.55 : -0.25);
      b.vel.lerp(des, 1 - Math.exp(-dt * 4)).add(wind.multiplyScalar(dt * 4));
      b.pos.addScaledVector(b.vel, dt);
      const gy = H.heightAt(b.pos.x, b.pos.z) + 0.15;
      if (b.pos.y < gy) { b.pos.y = gy; b.vel.y = Math.abs(b.vel.y); }
      b.flap = beating ? Math.sin(b.phase * sp.flapHz * 6.283) * 1.05 + 0.35 : 0.35 + Math.sin(b.phase * 2) * 0.05;
      b.yaw += wrap(Math.atan2(b.vel.x, b.vel.z) - b.yaw) * (1 - Math.exp(-dt * 8));
      b.pitch = -Math.atan2(b.vel.y, Math.hypot(b.vel.x, b.vel.z)) * 0.5;
      b.roll = wrap(Math.atan2(b.vel.x, b.vel.z) - b.yaw) * 0.6;
    } else {
      // settled: wings closed upright, opening slowly now and then (basking); a breeze rocks it
      const bask = b.state === 'puddle' ? 0.5 : 0.25 + 0.35 * H.W.pal.direct;
      const open = Math.max(0, Math.sin(b.phase * 0.6 + b.weave)) ** 3 * bask;
      b.flap = 1.45 - open * 1.4;
      b.roll = Math.sin(b.phase * 2.1) * 0.05 * c.sway;
      b.pitch = -0.1;
      if (b.state === 'feed' && b.r() < dt * 0.4) b.yaw += (b.r() - 0.5) * 0.8;   // turns on the flower
    }
  }

  return {
    name: 'butterflies', mesh, all, patches,
    update(dt, ctx) {
      const act = activity();
      const pl = H.player.pos;
      let n = 0;
      for (const b of all) {
        const d = Math.hypot(b.pos.x - pl.x, b.pos.z - pl.z);
        b.active = d < 70;
        if (!b.active) continue;
        b.thinkT = (b.thinkT || 0) - dt;
        if (b.thinkT <= 0) { b.thinkT = 0.25; think(b, act); }
        step(b, dt, act);
        if (b.state === 'hide' || n >= aSpan.count) continue;
        aPos.setXYZW(n, b.pos.x, b.pos.y, b.pos.z, b.flap);
        aRot.setXYZW(n, b.yaw, b.pitch, b.roll, b.sp.cell);
        aSpan.setX(n, b.sp.span * 0.5 * 1.6);                         // drawn a little larger than life, to be seen
        n++;
      }
      g.instanceCount = n;
      for (const a of [aPos, aRot, aSpan]) { a.needsUpdate = true; a.clearUpdateRanges(); a.addUpdateRange(0, n * a.itemSize); }
    },
    /** for the cat: the nearest flying butterfly */
    nearestFlying(x, z, r = 5) { let best = null, bd = r; for (const b of all) if (b.active && (b.state === 'fly' || b.state === 'flee')) { const d = Math.hypot(b.pos.x - x, b.pos.z - z); if (d < bd) { bd = d; best = b; } } return best; },
    stats() { const s = {}; for (const b of all) if (b.active) s[b.state] = (s[b.state] || 0) + 1; return { total: all.length, patches: patches.length, active: s, activity: +activity().toFixed(2) }; },
  };
}
