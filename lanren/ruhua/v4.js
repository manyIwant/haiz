// The six chapters' tree (V4), brought into the walk's frame.
//
// The homepage turns the campus 90° about the tree's root (lanren/world/compose.js, composition b)
// and keeps V4's tree and cameras as they are. The walk keeps the campus as the data lays it. So
// here the tree, its islet and 06's eye are turned by −90° about the root instead: the tree stands
// on the same spot of the campus, facing the same buildings, as it does in chapter 06.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export const V4_ROT = -Math.PI / 2;               // V4 world → walk world, about the root (y)
const C = Math.cos(V4_ROT), S = Math.sin(V4_ROT);
/** a V4-world point → the walk's world (three.js rotation.y convention) */
export const fromV4 = (p) => [p[0] * C + p[2] * S, p[1], -p[0] * S + p[2] * C];
/** the walk's world → V4 world */
export const toV4 = (x, z) => [x * C - z * S, x * S + z * C];
/** the 06 frame (chapters.js KEYS t = 5, film.js eye height), in the walk's world */
export const SHOT6 = { eye: fromV4([-21.5, 0.77, 29.5]), look: fromV4([5.0, 6.6, 3.3]), fov: 38,
  portrait: { eye: fromV4([-25.5, 0.77, 33.3]), look: fromV4([-0.8, 9.0, -0.6]), fov: 70 } };
/** chapter 06's light (chapters.js LIGHT[5]), its sun turned with the tree */
export const LIGHT6 = { sun: [58, 40], sunCol: [1.0, 0.9, 0.72], I: 5.6, zenith: [0.025, 0.11, 0.46], horizon: [0.36, 0.54, 0.80], glow: [0.95, 0.8, 0.6],
  fog: [0.42, 0.56, 0.74], exposure: 1.08, warm: 0.55, cloud: 0.66, sat: 1.16, contrast: 1.12 };
export function sun6Dir() {
  const az = LIGHT6.sun[0] * Math.PI / 180, el = LIGHT6.sun[1] * Math.PI / 180;
  const v = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
  return new THREE.Vector3(...fromV4(v)).normalize();
}

export async function loadV4(base, { mobile = false, onProgress = () => {} } = {}) {
  const url = (n) => new URL(n, base).href;
  const tl = new THREE.TextureLoader();
  let done = 0;
  const tick = (x) => { onProgress(++done / 8); return x; };
  const tex = (n, srgb) => tl.loadAsync(url(n)).then((t) => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return tick(t); });
  const gl = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const size = mobile ? 'lo' : 'web';
  const [treeG, islandG, rosBuf, meta, atlas, leafN, barkColor, barkNormal] = await Promise.all([
    gl.loadAsync(url('tree.glb')).then(tick), gl.loadAsync(url('island.glb')).then(tick),
    fetch(url('rosettes.bin')).then((r) => { if (!r.ok) throw new Error('rosettes.bin'); return r.arrayBuffer(); }).then(tick),
    fetch(url('tree.json')).then((r) => r.json()).then(tick),
    tex(`leaf-atlas-${size}.png`), tex(`leaf-normal-${size}.png`), tex('bark-color.jpg', true), tex('bark-normal.jpg'),
  ]);
  for (const t of [barkColor, barkNormal]) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  let bark = null, island = null;
  treeG.scene.traverse((o) => { if (o.isMesh) bark = o; });
  islandG.scene.traverse((o) => { if (o.isMesh) island = o; });
  // the islet's heightfield (V4 object space), as lanren/js/scene.js rasterises it
  const HF = 96, HR = 8.6, WATER = meta.water;
  const hf = new Float32Array(HF * HF).fill(WATER - 1), rockF = new Float32Array(HF * HF);
  {
    const p = island.geometry.attributes.position, idx = island.geometry.index, col = island.geometry.attributes.color;
    const n = idx ? idx.count : p.count;
    for (let t = 0; t < n; t++) {
      const v = idx ? idx.getX(t) : t;
      const x = p.getX(v), y = p.getY(v), z = p.getZ(v);
      const gx = Math.round((x + HR) / (2 * HR) * (HF - 1)), gz = Math.round((z + HR) / (2 * HR) * (HF - 1));
      if (gx >= 0 && gz >= 0 && gx < HF && gz < HF) {
        hf[gz * HF + gx] = Math.max(hf[gz * HF + gx], y);
        if (col) rockF[gz * HF + gx] = Math.max(rockF[gz * HF + gx], col.getY(v));
      }
    }
  }
  const hV4 = (x, z) => {
    const fx = (x + HR) / (2 * HR) * (HF - 1), fz = (z + HR) / (2 * HR) * (HF - 1);
    if (fx < 0 || fz < 0 || fx > HF - 1 || fz > HF - 1) return WATER;
    const ix = Math.min(HF - 2, Math.floor(fx)), iz = Math.min(HF - 2, Math.floor(fz)), tx = fx - ix, tz = fz - iz;
    const a = hf[iz * HF + ix], b = hf[iz * HF + ix + 1], c = hf[(iz + 1) * HF + ix], d = hf[(iz + 1) * HF + ix + 1];
    return Math.max(WATER, (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz);
  };
  const rockV4 = (x, z) => {
    const ix = Math.round((x + HR) / (2 * HR) * (HF - 1)), iz = Math.round((z + HR) / (2 * HR) * (HF - 1));
    return ix < 0 || iz < 0 || ix >= HF || iz >= HF ? 1 : rockF[iz * HF + ix];
  };
  /** the islet's surface under a walk-world point (the campus ground where there is no islet) */
  const isletAt = (x, z) => { const [a, b] = toV4(x, z); return hV4(a, b); };
  return {
    meta, bark, island, rosettes: new Float32Array(rosBuf), stride: meta.rosetteStride, atlas, leafN, barkColor, barkNormal,
    heightV4: hV4, rockV4, isletAt, water: WATER,
  };
}

/** an object that holds V4 things in the walk's frame */
export function v4Group(name) {
  const g = new THREE.Group();
  g.name = name;
  g.rotation.y = V4_ROT;
  return g;
}
