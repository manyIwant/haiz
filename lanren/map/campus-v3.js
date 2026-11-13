import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { rectCampus } from './geo.js';

// Hulls in the Blender building's local metres. Large solids stay exterior-only.
// Gates and covered walks retain their actual openings.
function localHulls(id, form, w, d) {
  if (form === 'gate') return [
    ...[-6.2, -3.3, 3.3, 6.2].map(x => [x - 0.55, -0.775, x + 0.55, 0.775]),
    [-13.25, -0.4, -6.75, 0.4], [6.75, -0.4, 13.25, 0.4]
  ];
  if (form === 'corr') return [
    [-w / 2 - 0.08, -d / 2, -w / 2 + 0.36, d / 2],
    [w / 2 - 0.36, -d / 2, w / 2 + 0.08, d / 2]
  ];
  if (form === 'pavilion') return [-4, 0, 4].flatMap(x => [-4, 4].map(z => [x - 0.2, z - 0.2, x + 0.2, z + 0.2]));
  if (id === 'yihao') return [[-58.18, -15.75, 58.18, 14.85], [-12.5, -19.73, 12.5, -15.75]];
  if (id === 'library') return [[-20.63, -24.7, 20.63, 26.34], [-5.8, -38, 5.8, -24.7]];
  return [[-w / 2 - 0.08, -d / 2 - 0.57, w / 2 + 0.08, d / 2 + 0.57]];
}

function placeRect(id, root, [x0, z0, x1, z1]) {
  const { x, z } = root.position, rot = root.rotation.y, c = Math.cos(rot), s = Math.sin(rot);
  const dx = (x0 + x1) / 2, dz = (z0 + z1) / 2;
  return { id, cx: x + dx * c + dz * s, cz: z - dx * s + dz * c, hw: (x1 - x0) / 2, hd: (z1 - z0) / 2, rot };
}

export async function loadCampusV3(geo, buildings) {
  const url = new URL('../assets/campus-v3/architecture.glb', import.meta.url);
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 60000);
  let data;
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error('Blender V3 campus request failed: ' + response.status);
    data = await response.arrayBuffer();
  } finally {
    clearTimeout(deadline);
  }
  const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(data, new URL('.', url).href);
  scene.name = 'campus-blender-v3';
  const sources = new Map(geo.campus.buildings.map(b => [b.id, b]));
  const entries = [], hulls = [], decks = [];
  for (const building of buildings) {
    const root = scene.getObjectByName('SITE_' + building.id);
    if (!root) continue;
    const src = sources.get(building.id);
    const { x, z, w, d } = rectCampus(src.rect, geo.frame.transform);
    if (Math.hypot(root.position.x - x, root.position.z - z) > 0.02) {
      throw new Error('Blender V3 anchor does not match campus data: ' + building.id);
    }
    const p = geo.frame.toWorld(x, z);
    root.position.set(p.x, geo.frame.ground + 0.02, p.z);
    // Apply the same yaw as the map and the collider. The V3 Keji anchor used
    // the opposite sign from the live campus data.
    root.rotation.y = building.rot;
    const top = new THREE.Box3().setFromObject(root).max.y - geo.frame.ground;
    if (!Number.isFinite(top)) throw new Error('Blender V3 mesh missing: ' + building.id);
    root.traverse(object => {
      if (!object.isMesh) return;
      object.receiveShadow = true;
    });
    entries.push({ building, root, top });
    hulls.push(...localHulls(building.id, building.form, w, d).map(rect => placeRect(building.id, root, rect)));
    const corridor = building.form === 'corr';
    if (corridor || building.form === 'pavilion') {
      const hw = corridor ? w / 2 : 5.15, hd = corridor ? d / 2 : 5.15;
      const deck = placeRect(building.id, root, [-hw, -hd, hw, hd]);
      decks.push({ ...deck, c: Math.cos(deck.rot), s: Math.sin(deck.rot), y: root.position.y + (corridor ? 0.245 : 0.4) });
    }
  }
  if (entries.length !== buildings.length) throw new Error('Blender V3 campus is incomplete');
  return { scene, entries, hulls, decks };
}
