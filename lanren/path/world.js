// 晨径 · The morning path — the world.
//
// One renderer, one frame: the campus data's own metres (lanren/map/geo.js, rotation 0: +X campus
// east along 一号教学楼, −Z campus north towards 北门, the century tree's footprint at the origin).
// Nothing here is turned for composition: what stands west of the tree in assets/walk/campus.json
// stands west of it here, and the sun comes from where the real sun is, using the campus-north
// bearing derived from the data's two anchors (321.6°, see lanren/ruhua/weather/model.js).
//
//   buildings   Blender V3 (lanren/assets/campus-v3), its own materials, lit by the sky
//   the tree    V4's bark and leaves (the six chapters' tree, a species concept model) on a raised,
//               stone-edged bed like the one in the photographs — not V4's islet, and without the
//               plinth V4 put beside it: the inscribed 太湖石 stands on the axis plaza, 38 m west
//   太湖石       a porous grey limestone on a long granite plinth, where the data puts it
//   ground      the plan's own rectangles (roads, gardens, water) rasterised once, paving drawn in
//               the shader at its real size; nothing is painted from a photograph
//   other trees from the data's tree list near the route, built from the same leaf as the hero tree
import * as THREE from 'three';
import { buildGeo, featureSDF } from '../map/geo.js';
import { buildCampus } from '../map/campus3d.js';
import { loadCampusV3 } from '../map/campus-v3.js';
import { buildColliders } from '../world/collide.js';
import { createSky, makeBarkMaterial, createGrass } from '../js/environment.js';
import { createCanopy, UNIFORMS, mulberry } from '../js/foliage.js';
import { loadV4 } from '../ruhua/v4.js';
import { sunPosition, haikouParts } from '../js/sun.js';
import { patchMemory } from './memory-shader.js';

export const CAMPUS_NORTH = 321.6;      // true bearing of campus north (towards 北门); derivation in lanren/ruhua/weather/model.js
const RAD = Math.PI / 180;
/** the hero tree's yaw in this frame (its long low limb reaches east, as in 区大伟's photograph) */
export const TREE_YAW = Math.PI;
/** the raised bed under the tree: top of the bed, world y (the paving is at frame.ground) */
const BED_TOP = -0.08;

export function sunVectorCampus(ms) {
  const { altitude, bearing } = sunPosition(ms);
  const rel = (bearing - CAMPUS_NORTH) * RAD, c = Math.cos(altitude);
  return { dir: new THREE.Vector3(Math.sin(rel) * c, Math.sin(altitude), -Math.cos(rel) * c), altitude, bearing };
}

// ------------------------------------------------------------------------------------------------ noise
function hash3(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), u), L(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), u), v),
    L(L(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), u), L(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), u), v), w);
}
function fbm(x, y, z, o = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f, z * f); f *= 2.03; a *= 0.5; } return s; }

// ------------------------------------------------------------------------------------------------ ground
/** The plan rasterised: albedo and a material mask (r paving, g planting, b water), 0.3 m a pixel. */
function groundTextures(geo, size) {
  const S = geo.frame.sheet, W = S.x1 - S.x0, D = S.z1 - S.z0;
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = size; return c; };
  const ca = mk(), cm = mk(), a = ca.getContext('2d'), m = cm.getContext('2d');
  a.fillStyle = '#a39a8a'; a.fillRect(0, 0, size, size);          // the campus's ordinary paving
  m.fillStyle = 'rgb(255,0,0)'; m.fillRect(0, 0, size, size);
  const px = (x) => (x - S.x0) / W * size, pz = (z) => (z - S.z0) / D * size;
  const rect = (g, f, fill, grow = 0) => {
    g.save(); g.translate(px(f.cx), pz(f.cz)); g.rotate(-(f.rot || 0));
    g.fillStyle = fill; const w = (f.hw + grow) * 2 / W * size, d = (f.hd + grow) * 2 / D * size;
    g.fillRect(-w / 2, -d / 2, w, d); g.restore();
  };
  for (const f of geo.features) {
    if (f.kind === 'botanic' || f.kind === 'garden') { rect(a, f, '#4f5a33'); rect(m, f, 'rgb(0,255,0)'); }
  }
  for (const f of geo.features) {
    if (f.kind === 'road') { rect(a, f, '#968f84'); rect(m, f, 'rgb(255,40,0)'); }
    if (f.kind === 'court') { rect(a, f, f.colour || '#6c7f8c'); rect(m, f, 'rgb(90,0,0)'); }
    if (f.kind === 'field') { rect(a, f, '#5d6b3a'); rect(m, f, 'rgb(0,200,0)'); }
  }
  // the gardens keep a paved walk round their edge (as the photographs of 思园 show)
  for (const f of geo.features) {
    if (f.kind !== 'garden') continue;
    a.save(); a.translate(px(f.cx), pz(f.cz)); a.rotate(-(f.rot || 0));
    const w = (f.hw * 2 - 3.2) / W * size, d = (f.hd * 2 - 3.2) / D * size;
    a.fillStyle = '#4c5a31'; a.fillRect(-w / 2, -d / 2, w, d); a.restore();
  }
  for (const f of geo.features) if (f.kind === 'water') { rect(a, f, '#3d4a43', 1.2); rect(m, f, 'rgb(0,0,255)'); }
  const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
  return { albedo: tex(ca, true), mask: tex(cm, false), sheet: S };
}

function createGround(geo, size) {
  const { albedo, mask, sheet } = groundTextures(geo, size);
  const W = sheet.x1 - sheet.x0, D = sheet.z1 - sheet.z0;
  const g = new THREE.PlaneGeometry(W, D, 1, 1);
  g.rotateX(-Math.PI / 2);
  g.translate((sheet.x0 + sheet.x1) / 2, geo.frame.ground, (sheet.z0 + sheet.z1) / 2);
  const mat = new THREE.MeshStandardMaterial({ map: albedo, roughness: 0.92, metalness: 0, envMapIntensity: 0.5 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uMask = { value: mask };
    sh.uniforms.uSheet = { value: new THREE.Vector4(sheet.x0, sheet.z0, W, D) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D uMask; uniform vec4 uSheet; varying vec3 vGW;
float gh(vec2 p){ p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
float gn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gh(i), gh(i + vec2(1, 0)), f.x), mix(gh(i + vec2(0, 1)), gh(i + vec2(1, 1)), f.x), f.y); }
float gf(vec2 p){ return gn(p) * 0.55 + gn(p * 2.1 + 5.0) * 0.3 + gn(p * 4.3 + 11.0) * 0.15; }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
  vec2 suv = (vGW.xz - uSheet.xy) / uSheet.zw;
  vec3 mk = texture2D(uMask, suv).rgb;
  vec2 q = vGW.xz;
  // paving: 0.6 × 0.3 m pavers in running bond, each a slightly different stone; joints darker
  vec2 tp = q / vec2(0.6, 0.3); tp.x += step(1.0, mod(floor(tp.y), 2.0)) * 0.5;
  vec2 cell = floor(tp), fr = fract(tp);
  float joint = smoothstep(0.0, 0.035, min(min(fr.x, 1.0 - fr.x) * 0.6, min(fr.y, 1.0 - fr.y) * 0.3) * 6.0);
  float stone = gh(cell) * 0.16 - 0.08 + (gf(q * 0.35) - 0.5) * 0.14;
  float distF = smoothstep(18.0, 70.0, length(vGW.xz - cameraPosition.xz));   // joints melt into tone far away
  vec3 pave = diffuseColor.rgb * (1.0 + stone) * mix(mix(0.72, 1.0, joint), 0.93, distF);
  // planting: grass and ground cover, patchy, with darker soil and leaf litter
  float gr = gf(q * 1.7), patchy = gf(q * 0.22);
  vec3 lawn = diffuseColor.rgb * mix(vec3(0.78, 0.74, 0.62), vec3(1.12, 1.1, 0.96), gr) * mix(0.85, 1.08, patchy);
  diffuseColor.rgb = mix(pave, lawn, mk.g);
  diffuseColor.rgb *= mix(1.0, 0.86, smoothstep(0.55, 0.8, gf(q * 0.06 + 3.0)) * mk.r);   // weathering
`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(0.86, 0.98, mk.g);`);
  };
  mat.customProgramCacheKey = () => 'path-ground';
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return mesh;
}

/** the gardens' raised beds with granite kerbs (思园 and 衍林堂 / 凤栖堂 gardens) */
function createKerbs(geo) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x8d8a82, roughness: 0.8 });
  const parts = [];
  for (const f of geo.features) {
    if (f.kind !== 'garden') continue;
    const w = f.hw * 2 - 3.0, d = f.hd * 2 - 3.0, h = 0.32, t = 0.22;
    for (const [sx, sz, lx, lz] of [[0, -1, w, t], [0, 1, w, t], [-1, 0, t, d], [1, 0, t, d]]) {
      const b = new THREE.BoxGeometry(lx, h, lz);
      b.translate(sx * (w / 2), geo.frame.ground + h / 2, sz * (d / 2));
      b.rotateY(f.rot || 0);
      b.translate(f.cx, 0, f.cz);
      parts.push(b);
    }
  }
  const merged = mergeGeometries(parts);
  const mesh = new THREE.Mesh(merged, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.name = 'kerbs';
  return mesh;
}

function mergeGeometries(list) {
  let n = 0, ni = 0;
  for (const g of list) { n += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = new Uint32Array(ni);
  let o = 0, oi = 0;
  for (const g of list) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    if (g.index) { for (let i = 0; i < g.index.count; i++) idx[oi + i] = g.index.array[i] + o; oi += g.index.count; }
    else { for (let i = 0; i < c; i++) idx[oi + i] = o + i; oi += c; }
    o += c;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  m.setIndex(new THREE.BufferAttribute(idx, 1));
  return m;
}

// ------------------------------------------------------------------------------------------------ stones
/** a boulder: a noise-displaced sphere; `porous` cuts through-holes (太湖石) in the shader */
function rockGeometry(seed, sx, sy, sz, { detail = 5, ridge = 0.35, flatBase = true } = {}) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm(v.x * 1.3 + seed, v.y * 1.3 - seed, v.z * 1.3 + seed * 0.5, 5);
    const r = 1 + (n - 0.5) * 0.9 + (Math.abs(fbm(v.x * 3.1 - seed, v.y * 3.1, v.z * 3.1, 3) - 0.5) - 0.18) * ridge;
    v.multiplyScalar(r);
    v.set(v.x * sx, v.y * sy, v.z * sz);
    if (flatBase && v.y < -sy * 0.55) v.y = -sy * 0.55 + (v.y + sy * 0.55) * 0.15;
    p.setXYZ(i, v.x, v.y + sy * 0.55, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function stoneMaterial({ color, rough = 0.9, porous = false, seed = 0 }) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, side: porous ? THREE.DoubleSide : THREE.FrontSide, envMapIntensity: 0.6 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vSP;
float sh3(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
float sn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(sh3(i), sh3(i + vec3(1,0,0)), f.x), mix(sh3(i + vec3(0,1,0)), sh3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(sh3(i + vec3(0,0,1)), sh3(i + vec3(1,0,1)), f.x), mix(sh3(i + vec3(0,1,1)), sh3(i + vec3(1,1,1)), f.x), f.y), f.z); }
float sf3(vec3 p){ return sn3(p) * 0.5 + sn3(p * 2.03 + 3.1) * 0.27 + sn3(p * 4.1 + 7.7) * 0.15 + sn3(p * 8.3) * 0.08; }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
  vec3 sp = vSP + ${seed.toFixed(2)};
  float grain = sf3(sp * 3.5);
  ${porous ? `
  // 太湖石: water-worn through-holes; inside the hole the stone is dark and damp
  float hole = sf3(sp * 1.15 + 2.0);
  if (hole > 0.665) discard;
  float rim = smoothstep(0.58, 0.665, hole);
  diffuseColor.rgb *= mix(1.0, 0.35, rim);
  if (!gl_FrontFacing) diffuseColor.rgb *= 0.32;
  ` : ''}
  diffuseColor.rgb *= 0.78 + grain * 0.45;
  // lichen and grime collect where the rain runs and on the upper faces
  float lich = smoothstep(0.55, 0.75, sf3(sp * 1.7 + 9.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.78, 0.86, 0.7), lich * 0.6);`);
  };
  mat.customProgramCacheKey = () => 'path-stone-' + porous + seed;
  return mat;
}

/** 「虎踞龙盘」: the inscribed 太湖石 on its long granite plinth, on the plaza in front of the main entrance */
function createTaihu(geo) {
  const f = geo.features.find((x) => x.id === 'hujulongpan');
  const group = new THREE.Group();
  group.name = 'taihu';
  group.position.set(f.cx, geo.frame.ground, f.cz);
  // the photograph (campus_taihushi.jpg): a dark polished plinth, about knee high, longer than the rock
  const granite = new THREE.MeshStandardMaterial({ color: 0x4d4f4b, roughness: 0.42, metalness: 0.0, envMapIntensity: 0.9 });
  // plinth: about 0.85 m of polished dark granite, longer than the rock, a strip of turf on top
  const PH = 0.85;
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(6.6, PH, 2.4), granite);
  plinth.position.y = PH / 2;
  const lawn = new THREE.Mesh(new THREE.BoxGeometry(6.3, 0.06, 2.1), new THREE.MeshStandardMaterial({ color: 0x3e4a2a, roughness: 1 }));
  lawn.position.y = PH + 0.02;
  // the rock: long and low (≈ 4.6 × 2 m in the photograph), its body to the east, a raised arm reaching west
  const stoneM = stoneMaterial({ color: 0x7a7e7c, rough: 0.78, porous: true, seed: 3 });
  const rock = new THREE.Mesh(rockGeometry(7.3, 1.6, 1.12, 0.85, { detail: 6, ridge: 0.75 }), stoneM);
  rock.position.set(0.55, PH, 0);
  rock.rotation.y = 0.1;
  const small = new THREE.Mesh(rockGeometry(2.1, 1.05, 0.5, 0.45, { detail: 5, ridge: 0.7 }), stoneM);
  small.position.set(-1.5, PH + 0.6, 0.15);
  small.rotation.z = -0.12;
  for (const o of [plinth, lawn, rock, small]) { o.castShadow = o.receiveShadow = true; group.add(o); }
  return { group, collider: { id: 'taihu', cx: f.cx, cz: f.cz, hw: 3.45, hd: 1.35, rot: 0 } };
}

// ------------------------------------------------------------------------------------------------ the tree bed
/** an irregular raised terrace (rubble-faced, granite-capped) with steps down to the plaza on the north */
function createTreeBed() {
  const group = new THREE.Group();
  group.name = 'tree-bed';
  const N = 64, pts = [];
  const radiusAt = (a) => 6.2 + Math.sin(a * 2 + 0.6) * 0.7 + Math.sin(a * 3 + 2.1) * 0.35;
  for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; const r = radiusAt(a); pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
  const shape = new THREE.Shape(pts);
  const h = BED_TOP - (-0.83);
  const wallG = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.08, bevelSegments: 2, curveSegments: 4 });
  wallG.rotateX(-Math.PI / 2);
  wallG.translate(0, -0.83, 0);
  const wall = new THREE.Mesh(wallG, stoneMaterial({ color: 0x7c776d, rough: 0.9, seed: 1.5 }));
  wall.receiveShadow = wall.castShadow = true;
  group.add(wall);
  // soil and leaf litter on top (the grass shader covers most of it)
  const topG = new THREE.ShapeGeometry(shape, 8);
  topG.rotateX(-Math.PI / 2);
  topG.translate(0, BED_TOP + 0.06, 0);
  const soil = new THREE.Mesh(topG, new THREE.MeshStandardMaterial({ color: 0x3b3326, roughness: 1 }));
  soil.receiveShadow = true;
  group.add(soil);
  // steps: four granite treads on the north side, towards the road and the gate
  const stepMat = new THREE.MeshStandardMaterial({ color: 0x9a978f, roughness: 0.75 });
  const nStep = 4, rise = h / nStep;
  for (let k = 0; k < nStep; k++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(4.4 - k * 0.2, rise * (k + 1), 0.42), stepMat);
    const r = radiusAt(-Math.PI / 2) + 0.42 * (nStep - k) - 0.2;
    b.position.set(-1.2, -0.83 + rise * (k + 1) / 2, -r);
    b.castShadow = b.receiveShadow = true;
    group.add(b);
  }
  // brown sandstone boulders, as in the photographs: a tall upright one under the long limb, others low
  // tall upright one at the plaza edge beside the long limb's tip (where 区大伟's photograph shows it), others low in the bed
  const boulders = [
    { x: 9.4, z: -4.7, y: -0.83, s: [0.72, 1.25, 0.58], seed: 11, ry: 0.5 },
    { x: 8.6, z: -3.4, y: -0.83, s: [0.62, 0.55, 0.5], seed: 12, ry: 1.1 },
    { x: 10.3, z: -5.6, y: -0.83, s: [0.5, 0.32, 0.42], seed: 13, ry: 0.2 },
    { x: 4.9, z: -2.0, s: [0.7, 0.42, 0.55], seed: 17, ry: 2.6 },
    { x: -2.3, z: 4.6, s: [0.9, 0.4, 0.6], seed: 14, ry: 2.2 },
    { x: 1.8, z: 5.2, s: [0.6, 0.35, 0.5], seed: 15, ry: 0.9 },
    { x: -4.8, z: -2.0, s: [0.7, 0.38, 0.5], seed: 16, ry: 1.7 },
  ];
  const bm = stoneMaterial({ color: 0x8a7458, rough: 0.88, seed: 4.2 });
  for (const b of boulders) {
    const m = new THREE.Mesh(rockGeometry(b.seed, ...b.s, { detail: 5, ridge: 0.25 }), bm);
    m.position.set(b.x, (b.y ?? BED_TOP) - 0.05, b.z);
    m.rotation.y = b.ry;
    m.castShadow = m.receiveShadow = true;
    group.add(m);
  }
  const inside = (x, z) => { const a = Math.atan2(z, x); return Math.hypot(x, z) < radiusAt(a) - 0.25; };
  return { group, radiusAt, inside, top: BED_TOP, boulders };
}

// ------------------------------------------------------------------------------------------------ other trees
/** Rosettes (tree.json layout, stride 16) for a generic broadleaf crown, so other trees wear the hero tree's leaf */
function synthRosettes(trees, rand) {
  const out = [];
  for (const t of trees) {
    const R = t.crownR, H = t.crownH, cy = t.trunkH + H * 0.5;
    const count = Math.round(R * R * H * t.density);
    const nClumps = Math.max(4, Math.round(R * 1.6));
    const clumps = [];
    for (let k = 0; k < nClumps; k++) {
      const a = rand() * Math.PI * 2, rr = Math.sqrt(rand()) * R * 0.65, y = cy + (rand() - 0.35) * H * 0.55;
      clumps.push([t.x + Math.cos(a) * rr, y, t.z + Math.sin(a) * rr]);
    }
    for (let i = 0; i < count; i++) {
      // points on a lumpy shell (leaves live at the outside of a crown)
      const c = clumps[Math.floor(rand() * clumps.length)];
      const u = rand() * 2 - 1, phi = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const dx = s * Math.cos(phi), dy = u, dz = s * Math.sin(phi);
      const cr = R * (0.42 + rand() * 0.18);
      const shell = 0.75 + rand() * 0.25;
      let px = c[0] + dx * cr * shell, py = c[1] + dy * cr * 0.7 * shell, pz = c[2] + dz * cr * shell;
      py = Math.max(py, t.trunkH + 0.4);
      const ox = px - t.x, oz = pz - t.z, ol = Math.hypot(ox, oz) || 1;
      out.push(px, py, pz, ox / ol * 0.7 + dx * 0.3, 0.35 + dy * 0.4, oz / ol * 0.7 + dz * 0.3,
        0.8 + rand() * 0.5, 0.6 + rand() * 0.4, Math.max(0, 0.6 - shell * 0.5 + (1 - (dy + 1) / 2) * 0.35),
        0.22 + rand() * 0.05, 0, rand(), c[0], c[1], c[2], shell);
    }
  }
  return new Float32Array(out);
}

function createGroveTrees(geo, v4, near, density) {
  const rand = mulberry(7311);
  const list = [];
  for (const t of geo.trees) {
    if (!near(t.x, t.z)) continue;
    if (t.kind === 'palm') continue;                 // palms are not drawn by this leaf; left as open sky (stated in the notes)
    const s = Math.min(1.3, Math.max(0.7, t.r / 3.6));
    list.push({ x: t.x, z: t.z, crownR: 3.2 * s, crownH: 3.6 * s * (0.9 + 0.2 * rand()), trunkH: 2.3 * s * (t.h || 1), density: 7.0 * density, kind: t.kind });
  }
  // the second 大叶榄仁 at the North Gate entrance (campus.json 北门 text: "北门入口处…各立一株"); its exact spot is not
  // in the data — placed inside the gate on the east side of the gate road, a stated approximation
  list.push({ x: -27.5, z: -70.5, crownR: 7.5, crownH: 6.0, trunkH: 3.4, density: 4.5 * density, kind: 'terminalia-gate', approx: true });
  // leaves in 40 m chunks: each chunk is culled on its own (camera and shadow frusta)
  const chunks = new Map();
  for (const t of list) { const k = Math.floor(t.x / 40) + ',' + Math.floor(t.z / 40); if (!chunks.has(k)) chunks.set(k, []); chunks.get(k).push(t); }
  const leaves = new THREE.Group();
  leaves.name = 'grove-leaves';
  let leafCount = 0;
  for (const part of chunks.values()) {
    const c = createCanopy(synthRosettes(part, rand), 16, v4.atlas, v4.leafN, 1.0, [2, 2], 1.55);
    c.mesh.computeBoundingSphere();
    c.mesh.boundingSphere.radius += 1.5;          // wind sway
    c.mesh.frustumCulled = true;
    leafCount += c.mesh.count;
    leaves.add(c.mesh);
  }
  const canopy = { mesh: leaves, count: leafCount, chunks: chunks.size };
  // trunks: tapered, a little leaning, two or three limbs into the crown
  const barkMat = makeBarkLite(v4);
  const parts = [];
  for (const t of list) {
    const lean = (rand() - 0.5) * 0.12;
    const r0 = t.kind === 'terminalia-gate' ? 0.42 : 0.16 + t.crownR * 0.03;
    const trunk = new THREE.CylinderGeometry(r0 * 0.6, r0, t.trunkH + t.crownH * 0.35, 7, 1);
    trunk.translate(0, (t.trunkH + t.crownH * 0.35) / 2, 0);
    trunk.rotateZ(lean);
    trunk.translate(t.x, geo.frame.ground, t.z);
    parts.push(trunk);
    for (let k = 0; k < 3; k++) {
      const a = rand() * Math.PI * 2, L = t.crownR * 0.75;
      const limb = new THREE.CylinderGeometry(r0 * 0.22, r0 * 0.45, L, 5, 1);
      limb.translate(0, L / 2, 0);
      limb.rotateZ(0.9 + rand() * 0.3);
      limb.rotateY(a);
      limb.translate(t.x, geo.frame.ground + t.trunkH * (0.75 + rand() * 0.3), t.z);
      parts.push(limb);
    }
  }
  const trunks = new THREE.Mesh(mergeGeometries(parts), barkMat);
  trunks.castShadow = trunks.receiveShadow = true;
  trunks.name = 'grove-trunks';
  return { canopy, trunks, list };
}

function makeBarkLite(v4) {
  const m = new THREE.MeshStandardMaterial({ map: v4.barkColor, normalMap: v4.barkNormal, roughness: 0.95, color: 0xb8ada0 });
  return m;
}

// ------------------------------------------------------------------------------------------------ the world
export async function createWorld({ campus, tier, base, onProgress = () => {}, say = () => {} }) {
  const geo = buildGeo(campus, null, { rotation: 0 });
  const model = buildCampus(campus, geo.frame);
  const group = new THREE.Group();
  group.name = 'path-world';

  // ---- sky and light
  const sky = createSky();
  sky.scale.setScalar(1.4);
  group.add(sky);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(tier.shadow, tier.shadow);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 400 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.00035; sun.shadow.normalBias = 0.05; sun.shadow.radius = 3;
  const target = new THREE.Object3D();
  sun.target = target;
  const hemi = new THREE.HemisphereLight(0xc6d0d8, 0xa08e70, 0.55);   // ground bounce: sunlit paving is warm
  group.add(sun, target, hemi);

  // ---- ground
  group.add(createGround(geo, tier.ground));
  group.add(createKerbs(geo));

  // ---- the tree: V4's bark and leaves, without its islet
  say('载入榄仁树…');
  const v4 = await loadV4(new URL('../assets/', import.meta.url).href, { mobile: tier.mobileLeaves, onProgress: (f) => onProgress('tree', f) });
  const treeG = new THREE.Group();
  treeG.name = 'century-tree';
  treeG.rotation.y = TREE_YAW;
  treeG.position.y = BED_TOP + 0.05;
  const bark = new THREE.Mesh(v4.bark.geometry, makeBarkMaterial({ barkColor: v4.barkColor, barkNormal: v4.barkNormal }));
  bark.customDepthMaterial = makeBarkMaterial({}, true);
  bark.castShadow = bark.receiveShadow = true;
  bark.frustumCulled = false;
  const canopy = createCanopy(v4.rosettes, v4.stride, v4.atlas, v4.leafN, tier.leafDensity, [2, 2]);
  treeG.add(bark, canopy.mesh);
  group.add(treeG);
  UNIFORMS.uGrow.value = 1;
  UNIFORMS.uWind.value = 0.22;

  const bed = createTreeBed();
  group.add(bed.group);
  // ground cover on the bed: V4's grass, in the bed's shape
  const grass = createGrass((x, z) => BED_TOP + 0.04, tier.bedGrass, (x, z) => bed.inside(x, z) && Math.hypot(x, z) > 1.3);
  group.add(grass);

  const taihu = createTaihu(geo);
  group.add(taihu.group);

  // ---- other trees near the route
  const route = [[-36, -88], [-36, -12], [-20, -6], [0, 0], [20, 10], [31, 60], [31, 140], [10, 140]];
  const near = (x, z) => route.some(([rx, rz], i) => {
    const [ax, az] = route[Math.max(0, i - 1)];
    const vx = rx - ax, vz = rz - az, L2 = vx * vx + vz * vz || 1;
    const t = Math.min(1, Math.max(0, ((x - ax) * vx + (z - az) * vz) / L2));
    return Math.hypot(x - (ax + vx * t), z - (az + vz * t)) < 70;
  });
  const grove = createGroveTrees(geo, v4, near, tier.leafDensity);
  group.add(grove.canopy.mesh, grove.trunks);

  // ---- colliders (building footprints until V3's hulls arrive)
  const circles = [{ id: 'lanshu', x: 0.2, z: 0, r: 1.3 }, ...bed.boulders.filter((b) => b.y != null).map((b, i) => ({ id: 'boulder' + i, x: b.x, z: b.z, r: Math.max(b.s[0], b.s[2]) * 1.1 })), ...grove.list.map((t, i) => ({ id: 'tree' + i, x: t.x, z: t.z, r: 0.45 }))];
  const waterRects = geo.features.filter((f) => f.kind === 'water').map((f) => ({ id: f.id, cx: f.cx, cz: f.cz, hw: f.hw, hd: f.hd, rot: f.rot }));
  const extra = { rects: [...waterRects, taihu.collider], circles };
  const W = {
    geo, model, group, sky, sun, target, hemi, v4, bark, canopy, bed, grass, taihu, grove, campusV3: null,
    colliders: buildColliders(model.buildings, extra, geo.frame.sheet),
    /** ground height under (x, z): the bed is a terrace; the steps ramp up to it */
    heightAt(x, z) {
      const g = geo.frame.ground;
      const a = Math.atan2(z, x), r = Math.hypot(x, z), R = bed.radiusAt(a);
      if (r < R) return BED_TOP;
      // the steps on the north side (x around −1.2, z below the bed)
      if (Math.abs(x + 1.2) < 2.2 && z < 0 && r < R + 1.8) return g + (BED_TOP - g) * Math.min(1, Math.max(0, 1 - (r - R) / 1.7));
      return g;
    },
    /** the bed's rim is a wall except at the steps */
    bedBlocks(x, z) {
      const a = Math.atan2(z, x), r = Math.hypot(x, z), R = bed.radiusAt(a);
      const onSteps = Math.abs(x + 1.2) < 2.0 && z < 0;
      return !onSteps && r > R - 0.25 && r < R + 0.35;
    },
  };

  W.setTime = (ms) => {
    const s = sunVectorCampus(ms);
    W.sunDir = s.dir;
    W.sunAlt = s.altitude;
    W.when = haikouParts(ms);
    lightFor(W, s.altitude);
  };

  W.loadBuildings = async () => {
    say('载入校园建筑…');
    const v3 = await loadCampusV3(geo, model.buildings);
    v3.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) {
        m.envMapIntensity = /Glass/i.test(m.name) ? 1.4 : 0.8;
        if (/Glass/i.test(m.name)) { m.roughness = 0.08; m.metalness = 0.6; }
        if (/Wall|Facade|Concrete|Granite|Terracotta|Jade/i.test(m.name)) weather(m);
      }
    });
    W.campusV3 = v3;
    W.colliders = buildColliders([], { rects: [...v3.hulls, ...extra.rects], circles }, geo.frame.sheet);
    group.add(v3.scene);
    patchMemory(group);
    return v3;
  };

  /** keep the sun's shadow box round what the camera is looking at */
  W.update = (t, focus) => {
    UNIFORMS.uTime.value = t;
    sky.material.uniforms.uTimeS.value = t;
    target.position.copy(focus);
    sun.position.copy(focus).addScaledVector(W.sunDir, 150);
    target.updateMatrixWorld();
  };

  patchMemory(group);
  return W;
}

/** Thirty humid summers on a facade: darker at the foot (splash and soil), streaks under every ledge
 *  where the rain runs, a large slow variation of tone. World-space, so it does not swim. */
function weather(m) {
  if (m.userData.weathered) return;
  m.userData.weathered = true;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWW; varying vec3 vWN;')
      .replace('#include <project_vertex>', `#include <project_vertex>
  vWW = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWW; varying vec3 vWN;
float wh(vec2 p){ p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 19.19); return fract(p.x * p.y); }
float wn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wh(i), wh(i + vec2(1, 0)), f.x), mix(wh(i + vec2(0, 1)), wh(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
  {
    float h = vWW.y + 0.83;
    vec2 wall = vec2(dot(vWW.xz, normalize(vec2(-vWN.z, vWN.x) + 1e-4)), h);
    float vertical = 1.0 - abs(vWN.y);
    // streaks: long in y, narrow in x, broken by noise; strongest under the floor lines (every 3.8 m)
    float streak = wn(vec2(wall.x * 2.3, wall.y * 0.12)) * wn(vec2(wall.x * 7.1, wall.y * 0.5));
    float underLedge = smoothstep(1.4, 0.0, mod(h, 3.8));
    float dirt = smoothstep(0.25, 0.65, streak) * (0.35 + 0.65 * underLedge) * vertical;
    float foot = (1.0 - smoothstep(0.0, 1.1, h)) * vertical;
    float tone = (wn(wall * 0.07 + vWW.y * 0.0) - 0.5) * 0.12;
    diffuseColor.rgb *= (1.0 + tone) * (1.0 - dirt * 0.22) * (1.0 - foot * 0.28);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.92, 0.95, 0.86), dirt * 0.5);
  }`);
  };
  const key = m.customProgramCacheKey;
  m.customProgramCacheKey = () => (key ? key.call(m) : '') + '|weather';
  m.needsUpdate = true;
}

/** morning light keyed by the real sun's altitude (warm and low early, whiter by mid-morning) */
function lightFor(W, alt) {
  const a = alt / RAD;
  const k = Math.min(1, Math.max(0, (a - 2) / 40));
  const warm = new THREE.Color(1.0, 0.72, 0.48), white = new THREE.Color(1.0, 0.95, 0.88);
  W.sun.color.copy(warm).lerp(white, Math.sqrt(k));
  W.sun.intensity = 1.6 + 3.4 * Math.sqrt(k);
  W.hemi.intensity = 0.34 + 0.2 * k;
  const u = W.sky.material.uniforms;
  u.uSun.value.copy(W.sunDir);
  u.uZenith.value.setRGB(0.17 + 0.05 * (1 - k), 0.29 + 0.05 * k, 0.50 + 0.06 * k);
  u.uHorizon.value.setRGB(0.78 - 0.18 * k, 0.74 - 0.08 * k, 0.70 + 0.08 * k);
  u.uGlow.value.setRGB(1.0, 0.72 + 0.12 * k, 0.5 + 0.25 * k);
  u.uSunCol.value.copy(W.sun.color);
  u.uCloud.value = 0.45;
}

export { featureSDF };
