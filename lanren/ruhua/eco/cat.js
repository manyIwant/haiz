// 入画 · the cat of the lane between 第一食堂 and the teaching blocks.
//
// Where: campus.json has no building called 一堂; it has 第一食堂 (canteen1) and 第三食堂. Read as
// 第一食堂, the open ground "between it and the teaching blocks" in the data is the paved and planted
// block south of 图书馆, from the east end of 二号教学楼 (x ≈ 10) to the canteen's west wall
// (x ≈ 127), between the two east–west roads (z ≈ 44 … 92), with the boys' dormitory's north wing on
// its east side. That is the cat's home range (RANGE below). It is a reading to be confirmed.
//
// A day, not a loop. The cat's day follows the real clock in Haikou and is drawn anew each date
// (seeded by the date), so it is somewhere else tomorrow, and where it is when the page opens is
// where its day has taken it, page open or not:
//   dawn patrol · morning sun (or shade, if it is hot) · grooming · the canteen at lunch · a long
//   nap · afternoon wandering · the canteen at dinner · evening watching by the lit windows · night
// Weather overrules: in rain it shelters under an eave or the covered walk and watches the rain; in
// a strong wind it keeps low by a wall; cold sends it into the sun, heat into the deepest shade.
//
// Moment to moment it walks along the foot of walls (cats keep to edges), sits, loafs, lies out in
// the sun, curls up, grooms, stretches when it wakes, and watches what moves: a butterfly, the
// walker. The walker matters: walking slowly near it, the cat may come and sit close (more often if
// you have been calm with it before: it remembers, a little, on this device); running at it, it
// flattens and bolts, then watches from a distance.
import * as THREE from 'three';
import { cel } from '../../stroll/atmos.js';
import { haikouClock } from '../weather/model.js';

export const RANGE = { x0: 12, x1: 126, z0: 46, z1: 90, label: '第一食堂与二号教学楼之间（图书馆南侧）' };
const TRUST_KEY = 'haiz.cat.v1';

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

// ---------------------------------------------------------------- the body: an orange tabby (橘猫), in parts
function bodyGeometry(len, rad, taper = 0.85, seg = 12, stripe = true) {
  // a lathe along +z: round at both ends, a little narrower at the front
  const g = new THREE.CapsuleGeometry(rad, len - rad * 2, 6, seg).rotateX(Math.PI / 2);
  const p = g.getAttribute('position'), col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i), y = p.getY(i), x = p.getX(i);
    const k = 1 - (1 - taper) * smooth((z + len / 2) / len);
    p.setXYZ(i, x * k, y * (y < 0 ? 0.9 : 1) * k, z);
    let c = [0.9, 0.52, 0.22];                                    // ginger
    if (stripe) {
      const s = Math.sin(z * 70 + Math.sin(x * 30) * 1.2);
      if (s > 0.55 && y > -rad * 0.2) c = [0.68, 0.32, 0.12];     // darker tabby bands over the back
    }
    if (y < -rad * 0.45) c = [0.96, 0.92, 0.86];                  // white belly
    col.set(c, i * 3);
  }
  g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
function tint(g, fn) {
  const p = g.getAttribute('position'), col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) col.set(fn(p.getX(i), p.getY(i), p.getZ(i)), i * 3);
  g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  return g;
}
const MAT = () => cel({ name: 'cat', key: 'cat', soft: 0.12,
  vertex: { head: 'attribute vec3 aCol; varying vec3 vCol;\n', world: 'vCol = aCol;' },
  fragment: { head: 'varying vec3 vCol;\n', albedo: 'albedo = vCol * 0.92;\n', after: /* glsl */`
{ vec3 V = normalize(cameraPosition - vWP); outCol += albedo * uSunColor * 0.12 * pow(1.0 - max(dot(N, V), 0.0), 3.0) * shadow; }   // fur catches the light at the rim
` } });
const OUTLINE = () => new THREE.ShaderMaterial({ side: THREE.BackSide,
  uniforms: { uW: { value: 0.0045 } },
  vertexShader: 'uniform float uW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vec3 n = normalize(mat3(modelMatrix) * normal); float d = length(cameraPosition - w.xyz); w.xyz += n * uW * clamp(d * 0.3, 0.6, 3.0); gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: 'void main(){ gl_FragColor = vec4(0.12, 0.08, 0.06, 1.0); }' });

function buildCat() {
  const mat = MAT(), line = OUTLINE();
  const part = (geo, name, outline = true) => {
    const m = new THREE.Mesh(geo, mat); m.name = name; m.castShadow = true; m.receiveShadow = true;
    if (outline) { const o = new THREE.Mesh(geo, line); m.add(o); }
    return m;
  };
  const root = new THREE.Group(); root.name = 'cat';
  const hips = new THREE.Group(); hips.position.set(0, 0.19, -0.12); root.add(hips);
  const spine = new THREE.Group(); hips.add(spine);
  const torso = part(bodyGeometry(0.36, 0.075, 0.82), 'torso'); torso.position.z = 0.13; spine.add(torso);
  const chest = new THREE.Group(); chest.position.set(0, 0.012, 0.26); spine.add(chest);
  const neck = new THREE.Group(); neck.position.set(0, 0.03, 0.03); chest.add(neck);
  const head = new THREE.Group(); head.position.set(0, 0.065, 0.045); neck.add(head);
  const skull = part(tint(new THREE.SphereGeometry(0.058, 16, 12).scale(1.05, 0.92, 1.0), (x, y, z) => (y < -0.022 && z > 0.01 ? [0.96, 0.92, 0.86] : Math.sin(x * 140) > 0.75 && y > 0.02 ? [0.68, 0.32, 0.12] : [0.9, 0.52, 0.22])), 'skull');
  head.add(skull);
  const muzzle = part(tint(new THREE.SphereGeometry(0.028, 12, 8).scale(1.25, 0.8, 1), () => [0.97, 0.93, 0.87]), 'muzzle');
  muzzle.position.set(0, -0.018, 0.045); head.add(muzzle);
  const nose = part(tint(new THREE.SphereGeometry(0.007, 8, 6), () => [0.86, 0.45, 0.45]), 'nose', false); nose.position.set(0, -0.006, 0.072); head.add(nose);
  const ears = [-1, 1].map((s) => {
    const e = new THREE.Group(); e.position.set(0.032 * s, 0.045, -0.005); e.rotation.z = -0.25 * s; head.add(e);
    const g = tint(new THREE.ConeGeometry(0.024, 0.045, 4).translate(0, 0.02, 0).scale(1, 1, 0.45), (x, y, z) => (z > 0.003 ? [0.9, 0.62, 0.55] : [0.86, 0.48, 0.2]));
    e.add(part(g, 'ear')); return e;
  });
  const eyes = [-1, 1].map((s) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.0095, 8, 6), new THREE.MeshBasicMaterial({ color: 0x2a2218 }));
    m.position.set(0.024 * s, 0.006, 0.05); m.scale.set(1, 1.15, 0.5); head.add(m); return m;
  });
  const legs = [];
  const mkLeg = (x, z, front, parent) => {
    const hip = new THREE.Group(); hip.position.set(x, front ? -0.02 : -0.01, z); parent.add(hip);
    const L1 = front ? 0.105 : 0.115, L2 = front ? 0.1 : 0.105;
    const up = part(tint(new THREE.CapsuleGeometry(0.022, L1 - 0.03, 3, 8).translate(0, -L1 / 2, 0), (px, py) => (py < -L1 * 0.7 ? [0.92, 0.6, 0.3] : [0.9, 0.52, 0.22])), 'leg-up');
    hip.add(up);
    const knee = new THREE.Group(); knee.position.y = -L1; hip.add(knee);
    const low = part(tint(new THREE.CapsuleGeometry(0.016, L2 - 0.025, 3, 8).translate(0, -L2 / 2, 0), () => [0.95, 0.9, 0.84]), 'leg-low');
    knee.add(low);
    const paw = part(tint(new THREE.SphereGeometry(0.019, 8, 6).scale(1, 0.6, 1.3), () => [0.96, 0.93, 0.88]), 'paw'); paw.position.set(0, -L2, 0.008); knee.add(paw);
    const leg = { hip, knee, L1, L2, front, x, side: Math.sign(x) };
    legs.push(leg); return leg;
  };
  mkLeg(0.042, 0.0, true, chest); mkLeg(-0.042, 0.0, true, chest);
  mkLeg(0.045, 0.0, false, hips); mkLeg(-0.045, 0.0, false, hips);
  const tail = [];
  let parent = new THREE.Group(); parent.position.set(0, 0.03, -0.03); hips.add(parent);
  for (let i = 0; i < 9; i++) {
    const seg = new THREE.Group(); seg.position.z = i === 0 ? 0 : -0.036; parent.add(seg);
    const r = 0.016 - i * 0.0009;
    const m = part(tint(new THREE.CapsuleGeometry(r, 0.03, 3, 6).rotateX(Math.PI / 2).translate(0, 0, -0.018), () => (i === 8 ? [0.68, 0.32, 0.12] : i % 2 ? [0.68, 0.32, 0.12] : [0.9, 0.52, 0.22])), 'tail');
    seg.add(m); tail.push(seg); parent = seg;
  }
  root.traverse((o) => { o.frustumCulled = false; });
  return { root, hips, spine, chest, neck, head, ears, eyes, legs, tail };
}

// analytic two-bone IK in the leg's sagittal plane (y down, z forward): hip → foot
function legIK(leg, fy, fz) {
  const d = clamp(Math.hypot(fy, fz), 0.02, leg.L1 + leg.L2 - 1e-3);
  const a = Math.acos(clamp((leg.L1 * leg.L1 + d * d - leg.L2 * leg.L2) / (2 * leg.L1 * d), -1, 1));
  const k = Math.acos(clamp((leg.L1 * leg.L1 + leg.L2 * leg.L2 - d * d) / (2 * leg.L1 * leg.L2), -1, 1));
  const base = Math.atan2(fz, -fy);
  // front legs bend backwards at the elbow, hind legs forwards at the hock (as a cat's do)
  const s = leg.front ? 1 : -1;
  leg.hip.rotation.x = -(base + s * a);
  leg.knee.rotation.x = s * (Math.PI - k);
}

// ---------------------------------------------------------------- poses
// each: hips height, spine pitch, chest/neck/head pitch, root roll, leg foot targets (relative), tail curl
const POSES = {
  stand: { h: 0.19, pitch: 0, roll: 0, neck: -0.25, head: 0.25, tailUp: 0.6, fold: 0 },
  sit: { h: 0.11, pitch: -0.75, roll: 0, neck: 0.25, head: 0.45, tailUp: -0.2, fold: 1, wrap: 1 },
  loaf: { h: 0.075, pitch: 0, roll: 0, neck: 0.15, head: 0.05, tailUp: -0.25, fold: 2, wrap: 1 },
  lie: { h: 0.06, pitch: 0, roll: 1.3, neck: 0.4, head: -0.1, tailUp: -0.3, fold: 3 },
  curl: { h: 0.065, pitch: 0, roll: 0.25, neck: 0.75, head: 0.55, tailUp: -0.3, fold: 2, wrap: 1.4 },
  crouch: { h: 0.11, pitch: 0.05, roll: 0, neck: 0, head: 0.1, tailUp: -0.2, fold: 0 },
  stretch: { h: 0.15, pitch: 0.38, roll: 0, neck: -0.3, head: 0.35, tailUp: 0.9, fold: 4 },
};
const KEYS = ['h', 'pitch', 'roll', 'neck', 'head', 'tailUp'];

export function createCat(habitat, { layer = 2, butterflies = null } = {}) {
  const H = habitat, G = H.G;
  const C = buildCat();
  C.root.traverse((o) => o.layers.set(layer));
  // ---- spots in the range, from the data: wall feet, tree shade, open ground, shelter, the canteen door
  const r0 = rng(2711);
  const inRange = (x, z) => x > RANGE.x0 && x < RANGE.x1 && z > RANGE.z0 && z < RANGE.z1;
  const spots = { edge: [], open: [], tree: [], shelter: [], canteen: [] };
  for (const e of H.edges) {
    const L = Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]);
    for (let t = 0.5; t < L; t += 2.5) {
      const x = e.a[0] + (e.b[0] - e.a[0]) * t / L, z = e.a[1] + (e.b[1] - e.a[1]) * t / L;
      if (!inRange(x, z) && !(e.id === 'canteen1' && x > 120 && x < 132 && z > 40 && z < 92)) continue;
      const s = { x, z, e, kind: 'edge' };
      spots.edge.push(s);
      if (e.id === 'canteen1' || e.id === 'dorm_m_n' || e.id === 'erhao') spots.shelter.push({ ...s, kind: 'eave' });
      if (e.id === 'canteen1') spots.canteen.push({ ...s, kind: 'canteen' });
    }
  }
  for (const t of H.world.trees) if (inRange(t.x, t.z) && t.kind !== 'shrub') spots.tree.push({ x: t.x + (r0() - 0.5) * 1.5, z: t.z + (r0() - 0.5) * 1.5, kind: 'tree' });
  for (let k = 0; k < 120 && spots.open.length < 30; k++) {
    const x = RANGE.x0 + r0() * (RANGE.x1 - RANGE.x0), z = RANGE.z0 + r0() * (RANGE.z1 - RANGE.z0);
    const f = H.free(x, z, 0.4);
    if (f.moved < 0.05) spots.open.push({ x, z, kind: 'open' });
  }
  for (const s of H.shelters) if (s.kind === 'corr' && s.cx > -20 && s.cx < 20 && s.cz > 25 && s.cz < 70) spots.shelter.push({ x: s.cx, z: s.cz, kind: 'corridor' });
  if (!spots.canteen.length) spots.canteen.push({ x: 125.5, z: 70, kind: 'canteen' });

  // ---- its memory of you (this device only)
  let trust = 0;
  try { const s = JSON.parse(localStorage.getItem(TRUST_KEY) || 'null'); if (s) trust = clamp(s.trust - (Date.now() - s.t) / (14 * 86400000), 0, 1); } catch { /* storage blocked */ }
  const saveTrust = () => { try { localStorage.setItem(TRUST_KEY, JSON.stringify({ trust, t: Date.now() })); } catch { /* storage blocked */ } };

  // ---- what the day asks for, at this hour, in this weather (deterministic for the date)
  function plan(ms) {
    const c = haikouClock(ms), h = c.hours;
    const day = rng(c.y * 400 + c.m * 31 + c.d);
    const shift = (day() - 0.5) * 0.8;                       // each day a little early or late
    const W = H.W, temp = W.cur.temp, rain = W.rainNow > 0.05 || W.cur.rain > 0.08, windy = W.cur.wind > 8;
    let act;
    if (h < 5.5 + shift || h >= 22.5) act = 'sleep';
    else if (h < 7 + shift) act = 'patrol';
    else if (h < 10.5 + shift) act = 'bask';
    else if (h < 11.4) act = 'groom';
    else if (h < 13 + shift * 0.5) act = 'canteen';
    else if (h < 16 + shift) act = 'nap';
    else if (h < 17) act = 'patrol';
    else if (h < 18.5) act = 'canteen';
    else act = 'watch';
    if (rain) act = act === 'sleep' ? 'sleep' : 'shelter';
    else if (windy && act !== 'sleep') act = 'shelter';
    // episodes of ~12 minutes inside an activity: a different spot each, drawn from the day's seed
    const episode = Math.floor((h * 60) / 12);
    const pick = rng(c.y * 9973 + c.m * 389 + c.d * 37 + episode * 7);
    const choose = (list) => list[Math.floor(pick() * list.length)] || spots.open[0];
    let spot, pose;
    if (act === 'sleep' || act === 'shelter') { spot = choose(spots.shelter); pose = act === 'sleep' ? 'curl' : 'loaf'; }
    else if (act === 'canteen') { spot = choose(spots.canteen); pose = 'sit'; }
    else if (act === 'bask' || act === 'nap') {
      // warmth decides: below ~27° the sun, above it the shade; in between, either
      const wantSun = temp < 27 || (temp < 30 && pick() < 0.4);
      const pool = (wantSun ? spots.open.concat(spots.edge) : spots.tree.concat(spots.edge)).slice();
      let best = choose(pool), bs = -1;
      for (let k = 0; k < 8; k++) { const s = choose(pool); const sun = H.sun(s.x, s.z); const v = (wantSun ? sun : 1 - sun) + pick() * 0.3; if (v > bs) { bs = v; best = s; } }
      spot = best; pose = act === 'bask' ? (wantSun && H.W.pal.direct > 0.4 ? 'lie' : 'loaf') : (pick() < 0.6 ? 'curl' : 'loaf');
    } else if (act === 'groom') { spot = choose(spots.edge.concat(spots.tree)); pose = 'sit'; }
    else if (act === 'watch') { spot = choose(spots.edge); pose = pick() < 0.6 ? 'sit' : 'loaf'; }
    else { spot = choose(spots.edge); pose = 'stand'; }
    return { act, spot, pose, episode };
  }

  // ---- state
  const S = { pos: new THREE.Vector3(), yaw: 0, speed: 0, mode: 'settle', pose: 'loaf', w: { ...POSES.loaf }, phase: 0, plan: null, path: [],
    look: { y: 0, p: 0, ty: 0, tp: 0 }, alert: 0, fear: 0, near: 0, thinkT: 0, microT: 0, blinkT: 2, groom: 0, stretchT: 0, tail: 0, ear: [0, 0], since: 0, lastSeenCalm: 0 };
  function placeAt(spot, pose) {
    const f = H.free(spot.x, spot.z, 0.25);
    S.pos.set(f.x, H.heightAt(f.x, f.z), f.z);
    // backs to the wall when there is one: facing out
    if (spot.e) { const ex = spot.e.b[0] - spot.e.a[0], ez = spot.e.b[1] - spot.e.a[1]; S.yaw = Math.atan2(ez, -ex) + (r0() - 0.5) * 0.8; } else S.yaw = r0() * 6.28;
    S.pose = pose; Object.assign(S.w, POSES[pose]); S.mode = 'settle';
  }
  S.plan = plan(Date.now());
  placeAt(S.plan.spot, S.plan.pose);

  // ---- walking: along the foot of walls where it can, the colliders keep it out of buildings
  function routeTo(spot) {
    const path = [];
    const a = H.nearestEdge(S.pos.x, S.pos.z, 6), b = H.nearestEdge(spot.x, spot.z, 6);
    if (a && a.d > 0.8) path.push({ x: a.x, z: a.z });
    if (a && b && a.e === b.e) { /* along the same wall */ } else if (b) path.push({ x: b.x, z: b.z });
    path.push({ x: spot.x, z: spot.z });
    S.path = path; S.mode = 'walk'; S.target = spot;
  }

  function think(ms) {
    const pl = H.player, dp = Math.hypot(pl.pos.x - S.pos.x, pl.pos.z - S.pos.z);
    S.near = dp;
    const asleep = S.mode === 'settle' && S.pose === 'curl';
    const aware = asleep ? dp < 1.6 : dp < 9;
    // fear: a walker running close, or rushing straight at it
    const closing = ((S.pos.x - pl.pos.x) * pl.vel.x + (S.pos.z - pl.pos.z) * pl.vel.z) / Math.max(dp, 0.1);
    const threat = (dp < 5 && pl.speed > 3) || (dp < 2.5 && closing > 1.4) || (dp < 1.1 && pl.speed > 1.2 && trust < 0.5);
    if (threat && S.mode !== 'flee') {
      S.fear = 1; trust = Math.max(0, trust - 0.05); saveTrust();
      const away = Math.atan2(S.pos.x - pl.pos.x, S.pos.z - pl.pos.z);
      let best = null, bs = -1;
      for (const s of spots.shelter.concat(spots.edge)) { const d = Math.hypot(s.x - S.pos.x, s.z - S.pos.z); if (d < 4 || d > 22) continue; const dir = Math.cos(wrap(Math.atan2(s.x - S.pos.x, s.z - S.pos.z) - away)); if (dir + d * 0.01 > bs) { bs = dir; best = s; } }
      if (best) { routeTo(best); S.mode = 'flee'; S.fleeT = 0; }
      return;
    }
    S.alert = aware ? 1 : 0;
    // calm company: walking slowly or standing near, the cat warms to you
    if (aware && dp < 3.5 && pl.speed < 1.6 && S.mode !== 'flee') {
      S.lastSeenCalm += 0.5;
      if (S.lastSeenCalm > 6) { trust = Math.min(1, trust + 0.02); S.lastSeenCalm = 0; saveTrust(); }
      if ((S.mode === 'settle' && !asleep) && S.lastSeenCalm > 2 && Math.random() < 0.04 + trust * 0.12 && dp > 1.3) {
        // come over and sit near, a little to the side
        const a = Math.atan2(S.pos.x - pl.pos.x, S.pos.z - pl.pos.z) + (Math.random() - 0.5) * 1.2;
        routeTo({ x: pl.pos.x + Math.sin(a) * (0.7 + (1 - trust) * 0.8), z: pl.pos.z + Math.cos(a) * (0.7 + (1 - trust) * 0.8), kind: 'visit' });
        S.visit = true;
      }
    } else S.lastSeenCalm = Math.max(0, S.lastSeenCalm - 0.25);
    // the day: a new episode or a new activity → somewhere else
    const p = plan(ms);
    if (S.mode === 'settle' && (p.episode !== S.plan.episode || p.act !== S.plan.act)) {
      S.plan = p;
      if (Math.hypot(p.spot.x - S.pos.x, p.spot.z - S.pos.z) > 0.8) { S.stretchT = S.pose === 'curl' || S.pose === 'loaf' || S.pose === 'lie' ? 2.2 : 0; routeTo(p.spot); } else { S.pose = p.pose; }
    }
  }

  // ---- per frame
  const tmpV = new THREE.Vector3();
  function steer(dt) {
    if (S.stretchT > 0) { S.stretchT -= dt; S.pose = 'stretch'; S.speed = 0; return; }
    const wp = S.path[0];
    if (!wp) {
      S.mode = 'settle'; S.speed = 0; S.visit = false; S.fear = Math.max(0, S.fear - 0.5);
      S.pose = S.target?.kind === 'visit' ? 'sit' : S.plan.pose;
      return;
    }
    const dx = wp.x - S.pos.x, dz = wp.z - S.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.25) { S.path.shift(); return; }
    const want = S.mode === 'flee' ? 3.4 : S.visit ? 0.55 : 0.62;
    S.speed += (want - S.speed) * (1 - Math.exp(-dt * (S.mode === 'flee' ? 8 : 3)));
    const ty = Math.atan2(dx, dz);
    S.yaw += wrap(ty - S.yaw) * (1 - Math.exp(-dt * (S.mode === 'flee' ? 10 : 4)));
    const m = H.move(S.pos.x, S.pos.z, Math.sin(S.yaw) * S.speed * dt, Math.cos(S.yaw) * S.speed * dt, 0.16);
    if (Math.hypot(m.x - S.pos.x, m.z - S.pos.z) < S.speed * dt * 0.2) S.path.shift();   // stuck on a corner: next waypoint
    S.pos.x = m.x; S.pos.z = m.z; S.pos.y = H.heightAt(m.x, m.z);
    S.pose = S.mode === 'flee' ? 'crouch' : 'stand';
  }
  function animate(dt, time) {
    // blend toward the pose's numbers
    const P = POSES[S.pose];
    const k = 1 - Math.exp(-dt * (S.mode === 'flee' ? 10 : 3.5));
    for (const key of KEYS) S.w[key] += (P[key] - S.w[key]) * k;
    S.w.fold = P.fold; S.w.wrap = P.wrap || 0;
    const moving = S.speed > 0.05;
    const trot = clamp((S.speed - 1.2) / 1.2, 0, 1);
    // gait: walk (lateral sequence), trot (diagonal pairs); stride matches speed, so paws do not slide
    const cycle = moving ? (0.62 - 0.22 * trot) : 1;
    S.phase += moving ? dt / cycle : 0;
    const stride = moving ? S.speed * cycle * (0.62 - 0.12 * trot) : 0;
    const offs = trot > 0.5 ? [0, 0.5, 0.5, 0] : [0.25, 0.75, 0, 0.5];      // LF, RF, LH, RH
    const breathe = Math.sin(time * 1.6) * 0.004;
    C.root.position.copy(S.pos);
    C.root.rotation.set(0, S.yaw, 0);
    C.root.rotation.z = S.w.roll;
    const bob = moving ? Math.abs(Math.sin(S.phase * Math.PI * 2)) * 0.008 * (1 + trot) : 0;
    C.hips.position.y = S.w.h + bob + breathe * 0.5 + (S.w.roll > 0.5 ? 0.02 : 0);
    C.spine.rotation.x = S.w.pitch;
    C.neck.rotation.x = S.w.neck * 0.6;
    // the head: looks at what it watches (walker, butterfly), stabilised against the gait
    const lk = S.look;
    lk.y += (lk.ty - lk.y) * (1 - Math.exp(-dt * 6)); lk.p += (lk.tp - lk.p) * (1 - Math.exp(-dt * 6));
    C.head.rotation.set(S.w.head + lk.p - S.w.pitch * 0.8 - (S.groom > 0 ? 0.6 : 0), lk.y, S.groom > 0 ? Math.sin(time * 9) * 0.15 : 0);
    // legs: paw targets on the ground in the cat's own (root) frame, then into each leg's frame
    C.root.updateMatrixWorld(true);
    const fold = S.w.fold;
    C.legs.forEach((L, i) => {
      let fz = L.front ? 0.14 : -0.12, fy = 0.012;
      if (moving) {
        const ph = (S.phase + offs[i]) % 1, duty = 0.62 - 0.12 * trot;
        if (ph < duty) fz += stride * (0.5 - ph / duty);
        else { const t = (ph - duty) / (1 - duty); fz += stride * (-0.5 + t); fy += Math.sin(t * Math.PI) * (0.035 + 0.02 * trot); }
      }
      if (fold === 1) fz = L.front ? 0.1 : -0.03;                       // sitting: front paws together, hind folded under
      else if (fold === 2) { fz = L.front ? 0.12 : -0.06; fy = 0.02; }   // loaf: everything tucked in
      else if (fold === 4) fz = L.front ? 0.34 : -0.13;                  // the stretch
      let ly, lz;
      if (fold === 3) { ly = -0.12; lz = L.front ? 0.06 : -0.04; }       // lying on its side: legs out, relaxed
      else if (S.groom > 0 && L.front && L.side > 0) { ly = -0.03; lz = 0.09; }   // a paw raised to the mouth
      else {
        tmpV.set(L.x, fy, fz).applyMatrix4(C.root.matrixWorld);
        L.hip.parent.worldToLocal(tmpV);
        ly = tmpV.y - L.hip.position.y; lz = tmpV.z - L.hip.position.z;
      }
      legIK(L, ly, lz);
    });
    // the tail: carried up while walking (friendly), low when wary, wrapped round when sitting
    const up = S.w.tailUp + (moving ? 0.4 : 0) - S.fear * 0.8 + S.alert * 0.1;
    const sway = (moving ? 0.25 : 0.12) + S.alert * 0.1;
    C.tail.forEach((seg, i) => {
      const t = i / C.tail.length;
      seg.rotation.x = i === 0 ? -up : -up * 0.12 + t * 0.05 + (S.w.wrap ? 0.04 : 0);
      seg.rotation.y = Math.sin(time * (moving ? 3 : 1.3) - i * 0.6) * sway * (0.3 + t) + S.w.wrap * 0.18 * (i > 2 ? 1 : 0);
    });
    // ears flick now and then; eyes blink slowly (and close when it sleeps)
    S.blinkT -= dt;
    const asleep = S.pose === 'curl' || (S.pose === 'lie' && S.alert < 0.5);
    let eye = asleep ? 0.1 : 1;
    if (S.blinkT < 0.15 && S.blinkT > 0) eye = 0.1;
    if (S.blinkT <= 0) S.blinkT = 2 + Math.random() * 5 * (S.near < 3 ? 0.6 : 1);      // near you, slow blinks come more often
    C.eyes.forEach((e) => { e.scale.y += (eye * 1.15 - e.scale.y) * (1 - Math.exp(-dt * 25)); });
    C.ears.forEach((e, i) => { S.ear[i] = Math.max(0, S.ear[i] - dt * 4); if (Math.random() < dt * 0.25) S.ear[i] = 1; e.rotation.x = -S.ear[i] * 0.5 - S.fear * 0.6; });
  }

  return {
    name: 'cat', root: C.root, state: S, spots, RANGE,
    get trust() { return trust; },
    update(dt, ctx) {
      S.thinkT -= dt;
      if (S.thinkT <= 0) { S.thinkT = 0.5; think(ctx.clock); }
      if (S.mode === 'walk' || S.mode === 'flee') steer(dt); else if (S.stretchT > 0) { S.stretchT -= dt; S.pose = S.stretchT > 0 ? 'stretch' : S.plan.pose; }
      // grooming in bouts while sitting
      if (S.mode === 'settle' && S.pose === 'sit' && (S.plan.act === 'groom' || Math.random() < dt * 0.01)) S.groom = Math.max(S.groom, Math.random() < dt * 0.2 ? 3 + Math.random() * 4 : 0);
      S.groom = Math.max(0, S.groom - dt);
      // what it watches: a butterfly passing, else the walker if near, else a glance round now and then
      const pl = H.player.pos;
      const bf = butterflies?.nearestFlying(S.pos.x, S.pos.z, 5);
      let tx = null, ty = 0, tz = 0;
      if (bf && S.pose !== 'curl') { tx = bf.pos.x; ty = bf.pos.y; tz = bf.pos.z; }
      else if (S.alert && S.near < 8) { tx = pl.x; ty = pl.y + 1.2; tz = pl.z; }
      if (tx !== null && S.groom <= 0) {
        const yaw = wrap(Math.atan2(tx - S.pos.x, tz - S.pos.z) - S.yaw);
        S.look.ty = clamp(yaw, -1.3, 1.3); S.look.tp = clamp(-Math.atan2(ty - S.pos.y - 0.25, Math.hypot(tx - S.pos.x, tz - S.pos.z)), -0.7, 0.4);
        // a long look over the shoulder turns the whole cat when it is sitting
        if (Math.abs(yaw) > 1.2 && S.mode === 'settle' && S.pose === 'sit') S.yaw += yaw * dt * 0.8;
      } else { S.microT -= dt; if (S.microT <= 0) { S.microT = 2 + Math.random() * 6; S.look.ty = (Math.random() - 0.5) * 1.2; S.look.tp = (Math.random() - 0.5) * 0.3; } }
      animate(dt, ctx.time);
    },
    describe() { return { act: S.plan.act, pose: S.pose, mode: S.mode, at: [+S.pos.x.toFixed(1), +S.pos.z.toFixed(1)], spot: S.plan.spot.kind, trust: +trust.toFixed(2) }; },
    placeAt,
  };
}
