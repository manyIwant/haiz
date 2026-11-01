import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const threeScript = readFileSync(resolve(root, 'public/haiz/assets/vendor/three.min.js'), 'utf8');
const installer = readFileSync(resolve(root, 'public/haiz/world/v3/install.js'), 'utf8');

function fixture({ failCampus = false } = {}) {
  const browser = { console, setTimeout, clearTimeout };
  browser.window = browser;
  browser.self = browser;
  vm.runInNewContext(threeScript, browser, { filename: 'three.min.js' });
  const T = browser.THREE;
  assert.ok(T?.Scene && T.InstancedMesh);

  const scene = new T.Scene();
  const centers = {
    yihao: new T.Vector3(10, 0, -10),
    lanshu: new T.Vector3(30, 0, -20),
    yanchi: new T.Vector3(50, 0, -30),
  };
  const buildings = Object.entries(centers).map(([id, center]) => {
    const group = new T.Group();
    const mesh = new T.Mesh(new T.BoxGeometry(4, 3, 4), new T.MeshBasicMaterial());
    group.add(mesh);
    scene.add(group);
    return { group, center, data: { id, size: [30, 12, 20] }, mesh };
  });

  const windows = new T.InstancedMesh(new T.BoxGeometry(.2, .2, .2), new T.MeshBasicMaterial(), 2);
  windows.setMatrixAt(0, new T.Matrix4().makeTranslation(10, 4, -10));
  windows.setMatrixAt(1, new T.Matrix4().makeTranslation(140, 4, -10));
  scene.add(windows);
  const originalMatrices = windows.instanceMatrix.array.slice();
  const originalMeshGeometry = buildings[0].mesh.geometry;
  const water = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial());
  scene.add(water);
  const tiles = [{ group: new T.Group() }];
  scene.add(tiles[0].group);
  const originalChildren = scene.children.slice();
  const world = {
    buildings, colliders: [], bounds: { minX: -200, maxX: 200, minZ: -200, maxZ: 200 },
    roadMaterials: [], waterSurface: water, vegetationTiles: tiles,
  };

  const hero = new T.Group();
  for (const [id, center] of Object.entries(centers)) {
    const anchor = new T.Group();
    anchor.name = 'SITE_' + id;
    anchor.position.copy(center);
    anchor.add(new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial()));
    hero.add(anchor);
  }

  browser.CampusWorld = { async build() { return world; } };
  browser.HaizV3GLTF = { createLoader() {
    return { load(_url, onLoad) { onLoad({ scene: hero }); } };
  } };
  let campusCalls = 0;
  browser.HaizV3Campus = { async install(s) {
    campusCalls++;
    if (!failCampus) return { materials: new Set(), tiles: [], setQuality() {}, tick() {}, diagnostics() { return {}; } };
    // Simulate a failure after mutating the real legacy scene.
    buildings[1].mesh.visible = false;
    s.add(new T.Group());
    throw Error('injected campus load failure');
  } };
  browser.HaizV3Teaching = { build() {
    buildings[0].group.add(new T.Group());
    return { surfaces: [], colliders: [], rooms: [] };
  } };
  browser.CampusMotion = { spatialIndex() { return {}; } };
  vm.runInNewContext(installer, browser, { filename: 'install.js' });
  return { browser, scene, world, buildings, water, windows,
    originalMatrices, originalMeshGeometry, originalChildren, campusCalls: () => campusCalls };
}

test('failed secondary V3 install restores original geometry, windows and children', async () => {
  const f = fixture({ failCampus: true });
  const result = await f.browser.CampusWorld.build(f.scene, {}, 'balanced');
  assert.equal(result.v3.state.status, 'fallback');
  assert.match(result.v3.state.error, /injected campus/);
  assert.deepEqual(f.scene.children, f.originalChildren);
  assert.equal(f.world.waterSurface, f.water);
  assert.equal(f.buildings[0].mesh.geometry, f.originalMeshGeometry);
  assert.equal(f.buildings[1].mesh.visible, true);
  assert.equal(f.buildings[0].group.children.length, 1);
  assert.equal(f.windows.count, 2);
  assert.deepEqual(Array.from(f.windows.instanceMatrix.array), Array.from(f.originalMatrices));
});

test('low tier avoids full-campus V3 downloads and keeps regional scene', async () => {
  const f = fixture();
  const result = await f.browser.CampusWorld.build(f.scene, {}, 'low');
  assert.equal(result.v3.state.status, 'ready');
  assert.equal(f.campusCalls(), 0);
  assert.equal(result.v3.state.campusSkipped, 'low-tier bandwidth budget');
});
