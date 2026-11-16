// Trees, beds and leaves, V2.
//
// The tree kit is V1's (scripts/toon/build_trees.py), placed from assets/walk/campus.json. What
// changes is how the planting belongs to the place:
//   wind      every crown sways with the shared gust field at its own position, so a gust that has
//             just crossed the lawn arrives in the trees a moment later
//   colour    calmer greens with value grouping; backlit crowns glow; a few 榄仁 clumps turn red
//   beds      planted beds along the building edges — clipped greens and, here and there, magenta
//             bougainvillea (三角梅), the colour of Hainan's courtyards — soften the hard line where a
//             wall meets the paving. Positions are generated (interpretive), never on roads or doors
//             we know of (corridors, gates)
//   leaves    a few 榄仁 leaves drift down from the old tree and travel with the wind
//   near cam  foliage dissolves (screen-door) inside ~2.5 m of the camera instead of filling the view
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { cel, celDepth } from './atmos.js';
import { planToCampus, featureSDF } from '../map/geo.js';

const KIT = {
  terminalia: ['terminalia', 'terminalia_b'], palm: ['palm', 'palm_b'],
  chongyang: ['round', 'round_b'], hongdou: ['round_b', 'round'], mixed: ['round', 'round_b'], botanic: ['round_b', 'round'],
  banyan: ['banyan'], kapok: ['kapok'], huoyan: ['umbrella'], fengling: ['umbrella'], shrub: ['shrub'],
};
const LEAF = {
  terminalia: '#5a9638', palm: '#78a03e', chongyang: '#47843a', hongdou: '#3e7a39', mixed: '#528c40', botanic: '#4c873e',
  banyan: '#3b7535', kapok: '#64953f', huoyan: '#73a443', fengling: '#6a9c40', shrub: '#4a8439', lanshu: '#5b9a39',
  hedge: '#467f37', bougainvillea: '#4f8a3a',
};
const BARK = { terminalia: '#6d5f53', terminalia_b: '#6d5f53', palm: '#8a8073', palm_b: '#8a8073', banyan: '#746a5e', kapok: '#7c7468', lanshu: '#675749' };

const WIND_HEAD = /* glsl */`
attribute vec4 aData;
uniform float uSwayAmp;
varying vec4 vData;
`;
const WIND_BEGIN = /* glsl */`
{
  vec3 ip = vec3(0.0);
  #ifdef USE_INSTANCING
    ip = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #endif
  float ph = dot(ip.xz, vec2(0.13, 0.071));
  float gust = windField(ip.xz);
  float s = aData.g * uSwayAmp * (0.3 + 0.95 * gust);
  float hgt = max(position.y, 0.0);
  vec2 wd = uWindDir;
  float sway = sin(uTime * 1.15 + ph) * 0.45 + sin(uTime * 2.7 + ph * 1.7 + position.y * 0.6) * 0.2 + gust * 0.6;
  transformed.x += (wd.x * sway + cos(uTime * 1.9 + ph + position.z) * 0.12) * s * (0.22 + 0.05 * hgt);
  transformed.z += (wd.y * sway + sin(uTime * 2.3 + ph + position.x) * 0.12) * s * (0.22 + 0.05 * hgt);
  transformed.y += sin(uTime * 2.1 + ph + position.x * 1.3) * s * 0.03;
}
`;
// screen-door dissolve near the camera (no sorting, no transparency cost)
const NEAR_FADE = /* glsl */`
{
  float dc = length(vWP - cameraPosition);
  if (dc < 2.6) {
    vec2 sp = floor(gl_FragCoord.xy);
    float b = fract(dot(sp, vec2(0.7548776662, 0.56984029)));
    if (b > smoothstep(0.9, 2.6, dc)) discard;
  }
}
`;

function leafMaterial(atlas, key, mode) {
  const uniforms = { uSwayAmp: { value: 1.0 }, uMode: { value: mode } };
  const mat = cel({
    name: 'leaf-' + key, key: 'leaf-v2', map: atlas, alphaTest: 0.42, side: THREE.DoubleSide, uniforms, soft: 0.16, alphaToCoverage: true,
    vertex: { head: WIND_HEAD, begin: WIND_BEGIN, world: 'vData = aData;' },
    fragment: {
      head: 'varying vec4 vData; uniform float uMode;\n',
      albedo: NEAR_FADE + /* glsl */`
float card = vData.a > 0.5 ? (vData.a - 0.5) * 2.0 : 0.5;     // per-card random (0..1); the blob core reads 0.5
albedo *= mix(0.88, 1.1, vData.b) * mix(0.93, 1.07, card);
albedo = mix(albedo, albedo * vec3(1.08, 1.04, 0.8), step(0.8, card) * 0.5);       // a few yellower cards
// mode 1: a few terminalia leaves turning red; mode 2: bougainvillea bracts in magenta
albedo = mix(albedo, vec3(0.34, 0.075, 0.03), step(0.5, uMode) * step(uMode, 1.5) * step(0.972, card) * 0.7);
albedo = mix(albedo, vec3(0.64, 0.05, 0.23), step(1.5, uMode) * smoothstep(0.34, 0.4, vData.b) * step(0.25, card) * 0.92);
ao = mix(0.45, 1.0, vData.r);
`,
      after: /* glsl */`
{
  vec3 vd = normalize(vWP - cameraPosition);
  float back = pow(max(dot(vd, uSunDir), 0.0), 3.0);
  outCol += uSunColor * albedo * back * 0.55 * vData.r * (0.4 + 0.6 * shadow);
}
`,
    },
  });
  const depth = celDepth({ key: 'leaf-v2', map: atlas, alphaTest: 0.42, side: THREE.DoubleSide, uniforms, vertex: { head: WIND_HEAD.replace('varying vec4 vData;', ''), begin: WIND_BEGIN } });
  return { mat, depth };
}

function barkMaterial(color) {
  const uniforms = { uSwayAmp: { value: 0.35 } };
  const mat = cel({
    name: 'bark', key: 'bark-v2', color, uniforms,
    vertex: { head: WIND_HEAD, begin: WIND_BEGIN, world: 'vData = aData;' },
    fragment: { head: 'varying vec4 vData;\n', albedo: 'ao = mix(0.55, 1.0, vData.r); albedo *= mix(0.72, 1.0, vData.r);\n' },
  });
  const depth = celDepth({ key: 'bark-v2', uniforms, vertex: { head: WIND_HEAD.replace('varying vec4 vData;', ''), begin: WIND_BEGIN } });
  return { mat, depth };
}

function baked(src) {
  const g = src.geometry.clone();
  for (const name of Object.keys(g.attributes)) {
    const a = g.getAttribute(name);
    if (a.array instanceof Float32Array && !a.isInterleavedBufferAttribute) continue;
    const f = new Float32Array(a.count * a.itemSize);
    const get = [a.getX, a.getY, a.getZ, a.getW];
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) f[i * a.itemSize + k] = get[k].call(a, i);
    g.setAttribute(name, new THREE.BufferAttribute(f, a.itemSize));
  }
  src.updateWorldMatrix(true, false);
  g.applyMatrix4(src.matrixWorld);
  const c = g.getAttribute('color');
  if (c) { g.setAttribute('aData', c); g.deleteAttribute('color'); } else g.setAttribute('aData', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 4).fill(1), 4));
  return g;
}

export function plantings(geo) {
  const tf = geo.campus.meta.transform;
  const blockers = geo.features.filter((f) => ['building', 'water', 'gate', 'road', 'court'].includes(f.kind));
  const out = [];
  for (const t of geo.campus.trees || []) {
    const c = planToCampus(t.p[0], t.p[1], tf);
    const w = geo.frame.toWorld(c.x, c.z);
    if (Math.hypot(w.x, w.z) < 14) continue;
    const pad = t.t === 'shrub' ? 0.6 : 1.2;
    if (blockers.some((f) => featureSDF(f, w.x, w.z) < pad)) continue;
    const r = t.r ?? 0;
    out.push({ x: w.x, z: w.z, kind: t.t, h: t.h || 1, s: t.s || 1, rot: (r < 1 ? r * Math.PI * 2 : r), v: t.v || 0 });
  }
  return out;
}

/** beds along building edges: generated, interpretive; never on roads, courts, water or in corridors */
export function beds(geo, trees) {
  const out = [];
  let s = 777;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const blockers = geo.features.filter((f) => ['road', 'court', 'water', 'corridor', 'gate', 'pavilion', 'field'].includes(f.kind));
  const buildings = geo.features.filter((f) => f.kind === 'building');
  for (const b of buildings) {
    const off = 2.1, step = 2.9;
    const hw = b.hw + off, hd = b.hd + off;
    const c = Math.cos(b.rot), sn = Math.sin(b.rot);
    const sides = [[-hw, -hd, hw, -hd], [hw, -hd, hw, hd], [hw, hd, -hw, hd], [-hw, hd, -hw, -hd]];
    for (const [x0, z0, x1, z1] of sides) {
      const L = Math.hypot(x1 - x0, z1 - z0);
      let run = rnd() < 0.5;                         // beds come in runs with gaps (doors, paths)
      for (let d = 1.5; d < L - 1.5; d += step) {
        if (rnd() < 0.18) run = !run;
        if (!run) continue;
        const t = Math.min(1, Math.max(0, (d + (rnd() - 0.5) * 1.4) / L));
        const nxo = -(z1 - z0) / L, nzo = (x1 - x0) / L, push = (rnd() - 0.5) * 1.0;
        const lx = x0 + (x1 - x0) * t - nxo * push, lz = z0 + (z1 - z0) * t - nzo * push;
        const x = b.cx + lx * c + lz * sn, z = b.cz - lx * sn + lz * c;
        if (blockers.some((f) => featureSDF(f, x, z) < 0.8)) continue;
        if (buildings.some((o) => featureSDF(o, x, z) < 0.6)) continue;
        if (trees.some((tr) => Math.hypot(tr.x - x, tr.z - z) < 1.6)) continue;
        out.push({ x, z, kind: rnd() < 0.28 ? 'bougainvillea' : 'hedge', s: 0.7 + rnd() * 0.7, h: 0.6 + rnd() * 0.55, rot: rnd() * Math.PI * 2 });
      }
    }
  }
  return out;
}

function fallingLeaves(count = 70) {
  const g = new THREE.InstancedBufferGeometry();
  const q = new THREE.PlaneGeometry(0.16, 0.1);
  g.index = q.index; g.setAttribute('position', q.getAttribute('position')); g.setAttribute('normal', q.getAttribute('normal')); g.setAttribute('uv', q.getAttribute('uv'));
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) { seeds[i * 4] = Math.random(); seeds[i * 4 + 1] = Math.random(); seeds[i * 4 + 2] = Math.random(); seeds[i * 4 + 3] = Math.random(); }
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
  g.instanceCount = count;
  const mat = cel({
    name: 'falling-leaf', key: 'falling-leaf', side: THREE.DoubleSide, soft: 0.3,
    vertex: {
      head: 'attribute vec4 aSeed; varying float vHue;\n',
      begin: /* glsl */`
{
  float life = fract(uTime * (0.045 + aSeed.y * 0.03) + aSeed.x);
  float a = aSeed.z * 6.2832, r = 2.0 + aSeed.w * 10.0;
  vec3 c = vec3(cos(a) * r, uGroundY + 14.0 - life * 14.6, sin(a) * r);
  c.xz += uWindDir * life * (4.0 + 6.0 * aSeed.y);
  c.x += sin(uTime * 1.3 + aSeed.x * 20.0) * 0.6; c.z += cos(uTime * 1.1 + aSeed.w * 20.0) * 0.6;
  float sp = uTime * (2.0 + aSeed.y * 3.0) + aSeed.z * 10.0;
  vec3 v = position;
  v.xy = mat2(cos(sp), -sin(sp), sin(sp), cos(sp)) * v.xy;
  v.yz = mat2(cos(sp * 0.7), -sin(sp * 0.7), sin(sp * 0.7), cos(sp * 0.7)) * v.yz;
  transformed = c + v * step(0.004, life) * (1.0 - step(0.985, life));
  vHue = aSeed.w;
}
`,
    },
    fragment: { head: 'varying float vHue;\n', albedo: 'albedo = mix(vec3(0.5, 0.11, 0.04), vec3(0.62, 0.36, 0.06), vHue);\n' },
  });
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  m.name = 'falling-leaves';
  return m;
}

export async function createFlora(geo, { url, atlasUrl }) {
  const [gltf, atlas] = await Promise.all([
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url),
    new THREE.TextureLoader().loadAsync(atlasUrl),
  ]);
  atlas.colorSpace = THREE.NoColorSpace;
  atlas.anisotropy = 4;
  const node = (n) => { const o = gltf.scene.getObjectByName(n); return o?.isMesh ? o : o?.children?.find((c) => c.isMesh); };
  const group = new THREE.Group();
  group.name = 'flora';
  const trees = plantings(geo);
  const bedList = beds(geo, trees);
  const buckets = new Map();
  const put = (part, t) => { if (!buckets.has(part)) buckets.set(part, []); buckets.get(part).push(t); };
  for (const t of trees) { const o = KIT[t.kind] || KIT.mixed; put(o[t.v % o.length], t); }
  for (const b of bedList) put('shrub', b);
  const leafMats = new Map();
  const leafFor = (kind) => {
    if (!leafMats.has(kind)) leafMats.set(kind, leafMaterial(atlas, kind, kind === 'terminalia' || kind === 'lanshu' ? 1 : kind === 'bougainvillea' ? 2 : 0));
    return leafMats.get(kind);
  };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), color = new THREE.Color();
  let draws = 0, instances = 0;
  const place = (part, list) => {
    for (const which of ['trunk', 'leaf']) {
      const src = node(part + '_' + which);
      if (!src) continue;
      const geom = baked(src);
      // split by species (leaf colour) and by 128 m cell, so the camera and the shadow map cull them
      const groups = new Map();
      for (const t of list) {
        const k = (which === 'leaf' ? t.kind : 'all') + '|' + Math.floor(t.x / 128) + ',' + Math.floor(t.z / 128);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(t);
      }
      for (const [key, items] of groups) {
        const kind = key.split('|')[0];
        const m = which === 'leaf' ? leafFor(kind) : barkMaterial(new THREE.Color(BARK[part] || '#6a5a4b'));
        const mesh = new THREE.InstancedMesh(geom, m.mat, items.length);
        mesh.customDepthMaterial = m.depth;
        mesh.castShadow = true; mesh.receiveShadow = true;
        items.forEach((t, i) => {
          q.setFromAxisAngle(up, t.rot); sc.set(t.s, t.h, t.s); ps.set(t.x, geo.frame.ground, t.z);
          mesh.setMatrixAt(i, m4.compose(ps, q, sc));
          if (which === 'leaf') {
            color.set(LEAF[kind] || LEAF.mixed).multiplyScalar(0.92 + 0.16 * fract(Math.sin(t.x * 12.9 + t.z * 78.2) * 43758.5));
            mesh.setColorAt(i, color);
          }
        });
        mesh.computeBoundingSphere();
        mesh.name = part + '_' + which + '_' + kind;
        group.add(mesh);
        draws++; instances += items.length;
      }
    }
  };
  for (const [part, list] of buckets) place(part, list);
  place('lanshu', [{ x: 0, z: 0, kind: 'lanshu', h: 1, s: 1, rot: 0.4 }]);
  const rockF = geo.features.find((f) => f.id === 'hujulongpan');
  const rockSrc = node('taihu');
  if (rockF && rockSrc) {
    const mat = cel({ name: 'stone', key: 'stone-v2', color: new THREE.Color('#a7ada4'),
      vertex: { head: 'attribute vec4 aData; varying vec4 vData;\n', world: 'vData = aData;' },
      fragment: { head: 'varying vec4 vData;\n', albedo: 'ao = mix(0.5, 1.0, vData.r); albedo *= mix(0.74, 1.04, vData.r);\n' } });
    const rock = new THREE.Mesh(baked(rockSrc), mat);
    rock.position.set(rockF.cx, geo.frame.ground, rockF.cz);
    rock.rotation.y = rockF.rot; rock.scale.setScalar(1.45);
    rock.castShadow = rock.receiveShadow = true;
    rock.name = 'taihu';
    group.add(rock);
  }
  group.add(fallingLeaves());
  return { group, trees, beds: bedList, draws, instances };
}

function fract(x) { return x - Math.floor(x); }
