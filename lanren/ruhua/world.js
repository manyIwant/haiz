// The painted world: the V2 walk (lanren/stroll) on the same campus data, frame, buildings and
// colliders, with the six chapters' tree painted in place of V2's concept 榄仁 and its islet as
// walkable ground. Built once; the transition and the walk both draw it.
import * as THREE from 'three';
import { buildGeo } from '../map/geo.js';
import { buildColliders } from '../world/collide.js';
import { buildCampus } from '../map/campus3d.js';
import { loadCampusV3 } from '../map/campus-v3.js';
import { U } from '../ruhua-stroll/atmos.js';
import { createSky } from '../ruhua-stroll/sky.js';
import { createDaylight } from '../ruhua-stroll/daylight.js';
import { createGround, createWater } from '../ruhua-stroll/ground.js';
import { createGrass } from '../ruhua-stroll/grass.js';
import { createFlora, plantings, beds } from '../ruhua-stroll/flora.js';
import { createHorizon } from '../ruhua-stroll/horizon.js';
import { createPaintedTree } from './paintedtree.js';
import { V4_ROT } from './v4.js';

export async function createWorld({ campus, v4, tier, asset, say = () => {} }) {
  const geo = buildGeo(campus, null, { rotation: 0 });
  const model = buildCampus(campus, geo.frame);
  const trees = plantings(geo);
  const bedList = beds(geo, trees);
  // the islet's ground-shade pool replaces V2's tree pool: radius by the V4 crown (12 m)
  const allTrees = [...trees, ...bedList.map((b) => ({ ...b, kind: 'shrub' })), { x: 0, z: 0, kind: 'lanshu', s: 1.25 }];

  const group = new THREE.Group();
  group.name = 'painted-world';
  const sky = createSky(asset('assets/stroll/clouds.png'));
  group.add(sky.group);
  const day = createDaylight(group, { shadowSize: tier.shadow, shadowBox: 55 });
  const ground = createGround(geo, allTrees, tier.paint);
  const water = createWater(geo);
  group.add(ground.mesh, water);
  const grass = createGrass({ ground });
  group.add(grass.group);
  const horizon = createHorizon(geo);
  group.add(horizon);
  say('载入树木…');
  const flora = await createFlora(geo, { url: asset('assets/toon/flora.glb'), atlasUrl: asset('assets/stroll/leaf-atlas-v2.png'), skipLanshu: true, skipRock: true });
  group.add(flora.group);
  // the painted tree uses the walk's leaf atlas
  const atlas = await new THREE.TextureLoader().loadAsync(asset('assets/stroll/leaf-atlas-v2.png'));
  atlas.colorSpace = THREE.NoColorSpace; atlas.anisotropy = 4;
  v4.paintAtlas = atlas;
  const tree = createPaintedTree(v4);
  group.add(tree.group);

  // ---------------------------------------------------------------- walking: colliders and the ground under the feet
  const sheet = geo.frame.sheet;
  const waterRects = geo.features.filter((f) => f.kind === 'water').map((f) => ({ id: f.id, cx: f.cx, cz: f.cz, hw: f.hw, hd: f.hd, rot: f.rot, tall: false }));
  // the plinth of 「虎踞龙盘」 on the islet (tree.json anchors, turned into this frame)
  const pl = v4.meta.anchors.plinth;
  const rects = [...waterRects];
  if (pl) {
    const c = Math.cos(V4_ROT), s = Math.sin(V4_ROT);
    rects.push({ id: 'plinth', cx: pl.centre[0] * c + pl.centre[2] * s, cz: -pl.centre[0] * s + pl.centre[2] * c, hw: pl.size[0] / 2 + 0.35, hd: pl.size[1] / 2 + 0.45, rot: pl.yaw + V4_ROT, tall: false });
  }
  const circles = [{ id: 'lanshu', x: 0.1, z: 0, r: 1.15 },
    ...trees.map((t, i) => ({ id: 'tree' + i, x: t.x, z: t.z, r: t.kind === 'shrub' ? 0.55 * t.s : t.kind === 'palm' ? 0.24 : 0.3 * t.s })),
    ...bedList.map((b, i) => ({ id: 'bed' + i, x: b.x, z: b.z, r: 0.5 * b.s }))];
  const W = {
    geo, model, trees, beds: bedList, group, sky, day, ground, water, grass, horizon, flora, tree,
    colliders: buildColliders(model.buildings, { rects, circles }, sheet),
    decksAt: () => geo.frame.ground + 0.02,
    campus: null, campusV3: null, extraCircles: [], hulls: [],
  };
  W.rebuild = () => { W.colliders = buildColliders(W.hulls.length ? [] : model.buildings, { rects: [...W.hulls, ...rects], circles: [...circles, ...W.extraCircles] }, sheet); };
  // the islet is ground you can climb onto; beyond it, the campus (and its decks)
  W.heightAt = (x, z) => Math.max(W.decksAt(x, z), !v4.atelier && Math.abs(x) < 9 && Math.abs(z) < 9 ? v4.isletAt(x, z) + 0.01 : -99);
  // tree crowns for the shade test (and the cat and the butterflies)
  W.crowns = [...trees.filter((t) => t.kind !== 'shrub').map((t) => ({ x: t.x, z: t.z, y: geo.frame.ground + (t.kind === 'palm' ? 8.6 : t.kind === 'kapok' ? 9 : 5.3) * t.h, r: (t.kind === 'palm' ? 3.4 : t.kind === 'banyan' ? 5.6 : 3.4) * t.s, ry: (t.kind === 'palm' ? 1.0 : 2.4) * t.h })),
    { x: 0, z: 0, y: 8.6, r: 12, ry: 5.5 }];

  /** the buildings (Blender V3): loaded once, restyled for the painted world; the raw copy is kept for the remembered one */
  W.loadCampus = async () => {
    const { createCampus } = await import('../ruhua-stroll/campus.js');
    const v3 = await loadCampusV3(geo, model.buildings);
    const raw = v3.scene.clone(true);                         // shares geometry, keeps the Blender materials
    const c = await createCampus(geo, model, v3);
    W.campus = c; W.campusV3 = raw;
    if(c.twin.applied.some(x=>x.part==='yanchi'))water.traverse(o=>{if(o.userData.haizWaterId==='yanchi')o.visible=false;});
    W.hulls = c.hulls;
    W.rebuild();
    W.decksAt = c.heightAt;
    group.add(c.scene);
    return c;
  };
  return W;
}

/** is the point under a building, a canopy or open sky? (sun direction from U) — 0 sun, 0.85 dappled, 1 shade */
export function shadeAt(W, p, sunDir = U.uSunDir.value) {
  const d = sunDir;
  for (let s = 0.5; s < 60; s += 1.2) {
    const x = p.x + d.x * s, y = p.y + 1.0 + d.y * s, z = p.z + d.z * s;
    for (const b of W.model.buildings) {
      if (b.form === 'corr' || b.form === 'gate') continue;
      const dx = x - b.cx, dz = z - b.cz, c = Math.cos(b.rot), sn = Math.sin(b.rot);
      if (Math.abs(dx * c - dz * sn) < b.w / 2 && Math.abs(dx * sn + dz * c) < b.d / 2 && y < W.geo.frame.ground + b.height) return 1;
    }
    for (const t of W.crowns) {
      const dx = (x - t.x) / t.r, dy = (y - t.y) / t.ry, dz = (z - t.z) / t.r;
      if (dx * dx + dy * dy + dz * dz < 0.7) return 0.85;
    }
    if (y > W.geo.frame.ground + 30) break;
  }
  return 0;
}
