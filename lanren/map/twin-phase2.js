// HAIZ · Phase-2 twin bridge for the existing six-act map and 入画 worlds.
//
// The legacy 3D world is centred on the six-act 榄仁树, while the twin exports
// absolute metres from the 一号教学楼 portal. Reuse the twin as LOCAL geometry
// of its existing V3 landmark root; the root continues to own visibility,
// height cuts, camera relations, shading, collisions and the walking frame.
// This avoids dropping a second, displaced campus on top of the first one.
//
// The primary tree and Taihu rock stay with V4 until their geometry can be
// replaced together with the growth/wind, foliage, stone and film shaders.
// Do not present this adapter as surveyed coordinates or a full campus swap.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const ASSETS = new URL('../../twin/assets/phase1/', import.meta.url);
const DECODER = new URL('../vendor/three/addons/libs/draco/', import.meta.url).href;
const PARTS = Object.freeze({ yihao: 'yihao', beimen: 'gate' });
let dracoLoader = null;
const assets = new Map();

async function load(part) {
  if (!assets.has(part)) assets.set(part, (async () => {
    // Load Draco locally so partial CDN failures cannot silently remove the
    // Phase-2 models; other errors still fall back to V3. GLBs require Draco.
    const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');
    dracoLoader ??= new DRACOLoader().setDecoderPath(DECODER);
    const loader = new GLTFLoader().setDRACOLoader(dracoLoader);
    return (await loader.loadAsync(new URL(part + '.glb', ASSETS).href)).scene;
  })());
  let timer;
  try {
    return await Promise.race([
      assets.get(part),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Twin load deadline for ' + part)), 20000); })
    ]);
  } finally { clearTimeout(timer); }
}

/** Replaces V3 geometry, never its positioned anchor, collider or state. */
function replaceInside(root, source, part) {
  const model = source.clone(true);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) throw new Error('Twin ' + part + ' contains no geometry');
  const centre = box.getCenter(new THREE.Vector3());
  // The V3 root is already positioned and yawed by campus-v3.js. Match the
  // twin landmark's *geometric centre* to that root and set its road datum at
  // the same site ground. The old KML and photo-derived twin frames differ;
  // a single world-space matrix cannot make all their anchors agree.
  model.position.set(-centre.x, -box.min.y, -centre.z);
  model.userData.haizTwinPart = part;
  model.userData.haizTwinPlacement = 'fitted-to-existing-campus-root';
  model.name = 'TWIN_PHASE2_' + part;
  for (const child of [...root.children]) root.remove(child);
  root.add(model);
  root.userData.haizTwinPart = part;
  return { part, originalCenter: [centre.x, centre.z], height: box.max.y - box.min.y };
}

/** Integrate only confirmed matching landmarks; partial and network-safe. */
export async function upgradeCampusLandmarks(entries) {
  if (new URLSearchParams(location.search).get('twin') === 'off') return { applied: [], skipped: ['disabled'] };
  const wanted = entries.filter((e) => PARTS[e.building.id]);
  const result = { applied: [], skipped: [] };
  const loaded = await Promise.all(wanted.map(async (e) => {
    const part = PARTS[e.building.id];
    try {
      const model = await load(part);
      return { e, part, model };
    } catch (err) {
      console.warn('HAIZ: keeping V3 geometry for ' + part, err);
      result.skipped.push(part);
      return null;
    }
  }));
  for (const p of loaded.filter(Boolean)) {
    try { result.applied.push(replaceInside(p.e.root, p.model, p.part)); }
    catch (err) { console.warn('HAIZ: twin geometry rejected, keeping V3', p.part, err); result.skipped.push(p.part); }
  }
  return result;
}
