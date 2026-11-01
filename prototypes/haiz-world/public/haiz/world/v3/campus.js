/* Latest Blender V3 campus shells, terrain and spatially tiled GPU planting. */
(function (global) {
  'use strict';
  const T = global.THREE;
  const raw = object => object.userData.name || object.name;
  const ACADEMIC = ['erhao', 'sanhao', 'sihao'];
  const RETAIN = ['fengqitang', 'yanlintang', 'zhiwuyuan'];
  function load(file) {
    return new Promise((resolve, reject) => global.HaizV3GLTF.createLoader().load('world/v3/assets/' + file, gltf => resolve(gltf.scene), undefined, reject));
  }
  function removeInstanceRegion(mesh, building) {
    const matrix = new T.Matrix4(), p = new T.Vector3(), kept = [];
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix); p.setFromMatrixPosition(matrix).applyMatrix4(mesh.matrixWorld);
      if (Math.abs(p.x - building.center.x) < building.data.size[0] / 2 + 1 && Math.abs(p.z - building.center.z) < building.data.size[2] / 2 + 2 && p.y < building.data.size[1] + 3) continue;
      kept.push(matrix.clone());
    }
    kept.forEach((m, i) => mesh.setMatrixAt(i, m)); mesh.count = kept.length; mesh.instanceMatrix.needsUpdate = true;
  }
  function plantingTiles(root) {
    const buckets = new Map(), matrix = new T.Matrix4(), p = new T.Vector3();
    root.updateMatrixWorld(true);
    root.traverse(mesh => {
      if (!mesh.isInstancedMesh) return;
      const groups = new Map();
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix); matrix.premultiply(mesh.matrixWorld); p.setFromMatrixPosition(matrix);
        const key = Math.floor(p.x / 90) + ':' + Math.floor(p.z / 90);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(matrix.clone());
      }
      for (const [key, transforms] of groups) {
        if (!buckets.has(key)) {
          const [x, z] = key.split(':').map(Number), group = new T.Group(); group.name = 'V3 planting ' + key;
          buckets.set(key, { group, x: x * 90 + 45, z: z * 90 + 45 });
        }
        const instance = new T.InstancedMesh(mesh.geometry, mesh.material, transforms.length);
        transforms.forEach((m, i) => instance.setMatrixAt(i, m));
        instance.castShadow = true; instance.receiveShadow = true; instance.frustumCulled = false;
        instance.userData.fullCount = transforms.length; instance.userData.noMerge = true;
        buckets.get(key).group.add(instance);
      }
    });
    return [...buckets.values()];
  }
  async function install(scene, world, quality, tools, progress) {
    progress?.(.92, '整合最新 V3 全校建筑与热带植被…');
    const [campus, terrain, planting] = await Promise.all([load('campus.glb'), load('terrain.glb'), load(quality === 'high' ? 'planting.glb' : 'planting-mobile.glb')]);
    const materials = new Set([...tools.materials(campus), ...tools.materials(terrain), ...tools.materials(planting)]);
    campus.updateMatrixWorld(true); const installed = [];
    const oldWindowBatches = scene.children.filter(o => o.isInstancedMesh && !o.userData.contactShadeCount);
    for (const anchor of [...campus.children]) {
      const id = raw(anchor).replace(/^SITE_/, ''), b = world.buildings.find(b => b.data.id === id);
      if (!b || RETAIN.includes(id)) continue;
      if (anchor.position.distanceTo(new T.Vector3(b.center.x, 0, b.center.z)) > .02) throw Error('V3 campus anchor mismatch: ' + id);
      for (const mesh of oldWindowBatches) removeInstanceRegion(mesh, b);
      if (ACADEMIC.includes(id)) {
        tools.retainInterior(b);
        anchor.traverse(mesh => { if (mesh.isMesh) tools.filterTriangles(mesh, p => p.y > 3.46 || Math.abs(p.x - b.center.x) > 14.72); });
      } else b.group.children.forEach(child => { child.visible = false; });
      tools.batch(anchor);
      b.group.attach(anchor); anchor.updateMatrix();
      b.group.userData.blenderV3 = true; installed.push(id);
    }
    const roadMaterials = new Set(world.roadMaterials);
    for (const object of scene.children) {
      if (!object.isMesh || object.material?.isShaderMaterial || object.isInstancedMesh) continue;
      const box = new T.Box3().setFromObject(object), size = box.getSize(new T.Vector3());
      if (roadMaterials.has(object.material) || (size.x > 600 && size.z > 570 && size.y < .1)) object.visible = false;
    }
    scene.add(terrain); tools.batch(terrain);
    for (const tile of world.vegetationTiles) tile.group.visible = false;
    const tiles = plantingTiles(planting);
    for (const tile of tiles) scene.add(tile.group);
    let config = global.HaizV3Core.qualityConfig(quality);
    return {
      materials, tiles, installed,
      setQuality(tier) {
        config = global.HaizV3Core.qualityConfig(tier);
        for (const tile of tiles) tile.group.traverse(mesh => {
          if (!mesh.isInstancedMesh) return;
          mesh.count = Math.max(1, Math.ceil(mesh.userData.fullCount * (tier === 'low' ? .6 : 1)));
          mesh.castShadow = tier !== 'low';
        });
      },
      tick(camera, mode) {
        for (const tile of world.vegetationTiles) tile.group.visible = false;
        for (const tile of tiles) tile.group.visible = mode !== 'walk' || Math.hypot(tile.x - camera.position.x, tile.z - camera.position.z) < config.vegetationDistance;
      },
      diagnostics() { return { v3Buildings: installed.length + 3, v3PlantingTiles: tiles.length, v3PlantingSource: quality === 'high' ? 'full' : 'mobile', retainedBuildingIds: RETAIN }; }
    };
  }
  global.HaizV3Campus = Object.freeze({ install });
})(window);
