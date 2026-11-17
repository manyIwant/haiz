// Campus trees from the stylized kit (scripts/toon/build_trees.py → lanren/assets/toon/flora.glb),
// placed where assets/walk/campus.json plants them, plus the hundred-year 榄仁树 at the origin and
// the 太湖石 on its plinth. One InstancedMesh per kit part, so 300 trees cost ~22 draw calls.
// Foliage sways (crown outside more than inside, from COLOR_0.g), glows when backlit and carries a
// little per-clump hue drift; a few 榄仁 clumps are turning red, as the campus's terminalias do in
// late autumn and winter (HAIZ's red-leaf colour, docs/haiz-art-direction-20261105.md).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { toonMaterial, toonDepthMaterial } from './toon.js';
import { planToCampus, featureSDF } from '../map/geo.js';

const KIT = {
  terminalia: ['terminalia', 'terminalia_b'], palm: ['palm', 'palm_b'],
  chongyang: ['round', 'round_b'], hongdou: ['round_b', 'round'], mixed: ['round', 'round_b'], botanic: ['round_b', 'round'],
  banyan: ['banyan'], kapok: ['kapok'], huoyan: ['umbrella'], fengling: ['umbrella'], shrub: ['shrub'],
};
// leaf tints (sRGB) per species, bark per kit part
const LEAF = {
  terminalia: '#5c9c38', palm: '#79a53c', chongyang: '#4a8a36', hongdou: '#3f7f38', mixed: '#559140', botanic: '#4f8c3e',
  banyan: '#3d7a33', kapok: '#679b42', huoyan: '#7aad44', fengling: '#6ea43f', shrub: '#4d8a3a', lanshu: '#5fa13a',
};
const BARK = { terminalia: '#6f6154', terminalia_b: '#6f6154', palm: '#8c8274', palm_b: '#8c8274', banyan: '#776b5f', kapok: '#7f766a', lanshu: '#6a5a4c' };

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
  float gust = 0.55 + 0.45 * sin(uTime * 0.45 + ip.x * 0.02 + ip.z * 0.013);
  float s = aData.g * uSwayAmp * gust;
  float hgt = max(position.y, 0.0);
  transformed.x += (sin(uTime * 1.25 + ph) * 0.6 + sin(uTime * 2.9 + ph * 1.7 + position.y * 0.7) * 0.22) * s * (0.25 + 0.05 * hgt);
  transformed.z += (cos(uTime * 1.07 + ph * 1.3) * 0.5 + sin(uTime * 3.3 + ph * 0.9 + position.x) * 0.2) * s * (0.25 + 0.05 * hgt);
  transformed.y += sin(uTime * 2.1 + ph + position.x * 1.3) * s * 0.03;
}
`;

function leafMaterial(atlas, key, red) {
  const uniforms = { uSwayAmp: { value: 1.0 }, uRed: { value: red } };
  const mat = toonMaterial({
    name: 'leaf-' + key, key: 'leaf', map: atlas, alphaTest: 0.42, side: THREE.DoubleSide, uniforms,
    vertex: { head: WIND_HEAD, begin: WIND_BEGIN, world: 'vData = aData;' },
    fragment: {
      head: 'varying vec4 vData; uniform float uRed;\n',
      albedo: /* glsl */`
toonAlbedo *= mix(0.84, 1.16, vData.b);
toonAlbedo = mix(toonAlbedo, vec3(0.42, 0.1, 0.04), uRed * 0.75 * smoothstep(0.93, 0.96, vData.b));
toonAO = mix(0.42, 1.0, vData.r);
toonSoft = 0.14;
`,
      after: /* glsl */`
{
  vec3 vd = normalize(vToonWP - cameraPosition);
  float back = pow(max(dot(vd, uSunDir), 0.0), 3.0);
  toonOut += uSunColor * toonAlbedo * back * 0.5 * vData.r * (0.4 + 0.6 * toonShadow);
}
`,
    },
  });
  const depth = toonDepthMaterial({ key: 'leaf', map: atlas, alphaTest: 0.42, side: THREE.DoubleSide, uniforms, vertex: { head: WIND_HEAD.replace('varying vec4 vData;', ''), begin: WIND_BEGIN } });
  return { mat, depth };
}

function barkMaterial(color) {
  const uniforms = { uSwayAmp: { value: 0.35 } };
  const mat = toonMaterial({
    name: 'bark', key: 'bark', color, uniforms,
    vertex: { head: WIND_HEAD, begin: WIND_BEGIN, world: 'vData = aData;' },
    fragment: { head: 'varying vec4 vData;\n', albedo: 'toonAO = mix(0.55, 1.0, vData.r); toonAlbedo *= mix(0.7, 1.0, vData.r);\n' },
  });
  const depth = toonDepthMaterial({ key: 'bark', uniforms, vertex: { head: WIND_HEAD.replace('varying vec4 vData;', ''), begin: WIND_BEGIN } });
  return { mat, depth };
}

/** gltfpack quantizes positions and puts the dequantizing transform on the mesh node: bake it in */
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
  return g;
}

function asData(geometry) {
  const c = geometry.getAttribute('color');
  if (c) {
    geometry.setAttribute('aData', c);
    geometry.deleteAttribute('color');
  } else {
    const n = geometry.getAttribute('position').count;
    geometry.setAttribute('aData', new THREE.BufferAttribute(new Float32Array(n * 4).fill(1), 4));
  }
  return geometry;
}

/** campus trees in world coordinates, with the same exclusions as the map and the walk */
export function plantings(geo) {
  const tf = geo.campus.meta.transform;
  const blockers = geo.features.filter((f) => f.kind === 'building' || f.kind === 'water' || f.kind === 'gate' || f.kind === 'road' || f.kind === 'court');
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

export async function createFlora(geo, { url, atlasUrl, onTrunk } = {}) {
  const [gltf, atlas] = await Promise.all([
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url),
    new THREE.TextureLoader().loadAsync(atlasUrl),
  ]);
  atlas.colorSpace = THREE.NoColorSpace;
  atlas.anisotropy = 4;
  const parts = new Map();
  gltf.scene.traverse((o) => { if (o.isMesh) parts.set(o.name.replace(/_\d+$/, ''), o); });
  const node = (n) => parts.get(n) || gltf.scene.getObjectByName(n)?.children?.find((c) => c.isMesh) || gltf.scene.getObjectByName(n);
  const group = new THREE.Group();
  group.name = 'toon-flora';
  const trees = plantings(geo);
  // bucket by kit part
  const buckets = new Map();
  for (const t of trees) {
    const opts = KIT[t.kind] || KIT.mixed;
    const part = opts[t.v % opts.length];
    if (!buckets.has(part)) buckets.set(part, []);
    buckets.get(part).push(t);
  }
  const color = new THREE.Color();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const atlasLeaf = new Map();
  const leafFor = (kind) => {
    if (!atlasLeaf.has(kind)) atlasLeaf.set(kind, leafMaterial(atlas, kind, kind === 'terminalia' || kind === 'lanshu' ? 1 : 0));
    return atlasLeaf.get(kind);
  };
  const trunks = [];
  const place = (part, list, kindOf) => {
    for (const which of ['trunk', 'leaf']) {
      const src = node(part + '_' + which);
      if (!src || !src.geometry) continue;
      const geom = asData(baked(src));
      // the leaf colour is per species, so the leaves are split per species within a kit part
      const groups = which === 'leaf' ? groupBy(list, kindOf) : new Map([['all', list]]);
      for (const [kind, items] of groups) {
        const m = which === 'leaf' ? leafFor(kind) : barkMaterial(new THREE.Color(BARK[part] || '#6b5a4a'));
        const mesh = new THREE.InstancedMesh(geom, m.mat, items.length);
        mesh.customDepthMaterial = m.depth;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        items.forEach((t, i) => {
          q.setFromAxisAngle(up, t.rot);
          sc.set(t.s, t.h, t.s);
          ps.set(t.x, geo.frame.ground, t.z);
          m4.compose(ps, q, sc);
          mesh.setMatrixAt(i, m4);
          if (which === 'leaf') {
            color.set(LEAF[kind] || LEAF.mixed);
            const j = 0.9 + 0.2 * fract(Math.sin(t.x * 12.9 + t.z * 78.2) * 43758.5);
            color.multiplyScalar(j);
            mesh.setColorAt(i, color);
          }
        });
        mesh.computeBoundingSphere();
        mesh.name = part + '_' + which + '_' + kind;
        group.add(mesh);
        if (which === 'trunk') trunks.push({ mesh, items });
      }
    }
  };
  for (const [part, list] of buckets) place(part, list, (t) => t.kind);
  // the hundred-year tree at the origin
  place('lanshu', [{ x: 0, z: 0, kind: 'lanshu', h: 1, s: 1, rot: 0.4 }], () => 'lanshu');
  // the scholar's rock on its plinth
  const rockF = geo.features.find((f) => f.id === 'hujulongpan');
  const rockSrc = node('taihu');
  if (rockF && rockSrc) {
    const geom = asData(baked(rockSrc));
    const mat = toonMaterial({ name: 'stone', key: 'stone', color: new THREE.Color('#a9b1ab'),
      vertex: { head: 'attribute vec4 aData; varying vec4 vData;\n', world: 'vData = aData;' },
      fragment: { head: 'varying vec4 vData;\n', albedo: 'toonAO = mix(0.5, 1.0, vData.r); toonAlbedo *= mix(0.75, 1.05, vData.r);\n' } });
    const rock = new THREE.Mesh(geom, mat);
    rock.position.set(rockF.cx, geo.frame.ground, rockF.cz);
    rock.rotation.y = rockF.rot;
    rock.scale.setScalar(1.45);
    rock.castShadow = rock.receiveShadow = true;
    rock.name = 'taihu';
    group.add(rock);
  }
  onTrunk?.(trees);
  return { group, trees, setSway(v) { for (const m of atlasLeaf.values()) m.mat.userData.toon.uniforms.uSwayAmp.value = v; } };
}

function groupBy(list, fn) {
  const m = new Map();
  for (const t of list) { const k = fn(t); if (!m.has(k)) m.set(k, []); m.get(k).push(t); }
  return m;
}
function fract(x) { return x - Math.floor(x); }
