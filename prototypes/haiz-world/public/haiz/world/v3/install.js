/* HAIZ V3: integrate user-authored Blender regions into the retained campus. */
(function (global) {
  'use strict';
  const T = global.THREE;
  const rawName = object => object.userData.name || object.name;
  const HERO_IDS = ['yihao', 'lanshu', 'yanchi'];
  const originalBuild = global.CampusWorld.build;

  function removeTriangles(mesh, keep) {
    if (!mesh.geometry?.attributes.position || mesh.isInstancedMesh) return;
    const geometry = mesh.geometry, positions = geometry.attributes.position;
    const index = geometry.index, length = index ? index.count : positions.count;
    const remaining = [], center = new T.Vector3(), point = new T.Vector3();
    mesh.updateWorldMatrix(true, false);
    for (let i = 0; i < length; i += 3) {
      const ids = [0, 1, 2].map(offset => index ? index.getX(i + offset) : i + offset);
      center.set(0, 0, 0);
      for (const id of ids) center.add(point.fromBufferAttribute(positions, id).applyMatrix4(mesh.matrixWorld));
      center.multiplyScalar(1 / 3);
      if (keep(center)) remaining.push(...ids);
    }
    if (remaining.length === length) return;
    const copy = geometry.clone(); copy.setIndex(remaining);
    mesh.geometry = copy; mesh.visible = remaining.length > 0;
  }

  function retainTeachingInterior(building) {
    const c = building.center;
    building.group.traverse(object => {
      if (!object.isMesh) return;
      removeTriangles(object, p => p.y < 3.47 && Math.abs(p.x - c.x) < 14.72 && Math.abs(p.z - c.z) < building.data.size[2] / 2 + .25);
    });
  }

  function removeLegacyWindows(scene, building) {
    const c = building.center, matrix = new T.Matrix4(), position = new T.Vector3();
    for (const object of scene.children) {
      if (!object.isInstancedMesh) continue;
      const remaining = [];
      for (let i = 0; i < object.count; i++) {
        object.getMatrixAt(i, matrix); position.setFromMatrixPosition(matrix).applyMatrix4(object.matrixWorld);
        if (Math.abs(position.x - c.x) < 59 && Math.abs(position.z - c.z) < 15 && position.y > .4 && position.y < 23) continue;
        remaining.push(matrix.clone());
      }
      if (remaining.length === object.count) continue;
      remaining.forEach((m, i) => object.setMatrixAt(i, m));
      object.count = remaining.length; object.instanceMatrix.needsUpdate = true;
    }
  }

  function prepareMaterials(root) {
    const materials = new Set();
    root.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = !/water|glaz|glass/i.test(rawName(object)); object.receiveShadow = true;
      object.userData.noMerge = true;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (materials.has(material)) continue;
        materials.add(material); material.userData.linearColor = true;
        material.userData.blenderV3 = true;
        material.envMapIntensity = /glass/i.test(material.name) ? .65 : .3;
        if (material.transmission > 0) { material.transmission = 0; material.transparent = false; material.opacity = 1; }
        if (/glass/i.test(material.name)) {
          material.roughness = Math.max(.24, material.roughness);
          material.userData.v3WindowGlow = true;
        }
        material.needsUpdate = true;
      }
    });
    return materials;
  }

  function openImportedEntrance(root, center) {
    root.traverse(object => {
      const name = rawName(object);
      if (/entrance (interior darkness|shaded entrance recess)|shaded entrance recess/.test(name)) object.visible = false;
      if (/entrance door 0$/.test(name)) object.visible = false;
      if (!object.isMesh) return;
      removeTriangles(object, p => !(Math.abs(p.x - center.x) < 1.68 && p.y > .38 && p.y < 2.78 && Math.abs(p.z - center.z) > 12));
    });
  }

  function batchRegion(root) {
    root.updateWorldMatrix(true, true);
    const inverse = root.matrixWorld.clone().invert(), batches = new Map();
    root.traverse(object => {
      if (!object.isMesh || object.isInstancedMesh || !object.visible || Array.isArray(object.material)) return;
      let ancestor = object.parent;
      while (ancestor && ancestor !== root) { if (!ancestor.visible) return; ancestor = ancestor.parent; }
      const fields = Object.keys(object.geometry.attributes).sort();
      const key = object.material.uuid + ':' + fields.join(',');
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push(object);
    });
    for (const list of batches.values()) {
      if (list.length < 2) continue;
      const geometries = list.map(mesh => mesh.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)));
      const vertices = geometries.reduce((sum, g) => sum + g.attributes.position.count, 0);
      const count = geometries.reduce((sum, g) => sum + (g.index?.count || g.attributes.position.count), 0);
      const merged = new T.BufferGeometry(), indices = new Uint32Array(count);
      for (const name of Object.keys(geometries[0].attributes)) {
        const first = geometries[0].attributes[name], values = new first.array.constructor(vertices * first.itemSize);
        let offset = 0;
        for (const geometry of geometries) { values.set(geometry.attributes[name].array, offset); offset += geometry.attributes[name].array.length; }
        merged.setAttribute(name, new T.BufferAttribute(values, first.itemSize, first.normalized));
      }
      let vertexOffset = 0, indexOffset = 0;
      for (const geometry of geometries) {
        const n = geometry.index?.count || geometry.attributes.position.count;
        for (let i = 0; i < n; i++) indices[indexOffset++] = vertexOffset + (geometry.index ? geometry.index.getX(i) : i);
        vertexOffset += geometry.attributes.position.count; geometry.dispose();
      }
      merged.setIndex(new T.BufferAttribute(indices, 1)); merged.computeBoundingSphere();
      const mesh = new T.Mesh(merged, list[0].material);
      mesh.name = 'V3 batch ' + list[0].material.name; mesh.castShadow = list.some(o => o.castShadow); mesh.receiveShadow = true;
      mesh.userData.noMerge = true; root.add(mesh);
      for (const object of list) object.removeFromParent ? object.removeFromParent() : object.parent.remove(object);
    }
  }

  function setRoadDepthOrder(world) {
    world.roadMaterials.forEach((material, index) => {
      material.polygonOffset = true; material.polygonOffsetFactor = -(index + 1) * 1.5;
      material.polygonOffsetUnits = -(index + 1) * 2; material.needsUpdate = true;
    });
  }

  async function loadRegion(quality, progress) {
    const file = quality === 'low' ? 'hero-mobile.glb' : 'hero.glb';
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Blender V3 模型读取超时，已保留原校园。')), 45000);
      global.HaizV3GLTF.createLoader().load('world/v3/assets/' + file, gltf => {
        clearTimeout(timer); resolve({ root: gltf.scene, file });
      }, event => {
        if (event.total) progress?.(.84 + .08 * event.loaded / event.total, '载入 Blender V3 建筑与树冠…');
      }, error => { clearTimeout(timer); reject(error); });
    });
  }

  global.CampusWorld.build = async function (scene, data, quality, progress, pbr) {
    const world = await originalBuild.call(this, scene, data, quality, progress, pbr);
    setRoadDepthOrder(world);
    const state = { status: 'loading', file: null, error: null, mode: 'overview' };
    let environment = null, materials = new Set(), hero = null, teaching = null, campus = null, cameraContext = null, rockBounds = null;
    const source = world.buildings.find(b => b.data.id === 'yihao');
    try {
      const loaded = await loadRegion(quality, progress); hero = loaded.root;
      hero.name = 'HAIZ Blender V3 regions'; hero.updateMatrixWorld(true);
      for (const id of HERO_IDS) {
        const anchor = hero.getObjectByName('SITE_' + id);
        const b = world.buildings.find(item => item.data.id === id);
        if (!anchor || anchor.position.distanceTo(new T.Vector3(b.center.x, 0, b.center.z)) > .02) throw new Error('Blender V3 锚点不匹配：' + id);
      }
      materials = prepareMaterials(hero);
      const rock = hero.getObjectByName('Taihu_rock_interpretation');
      rockBounds = rock ? new T.Box3().setFromObject(rock) : null;
      retainTeachingInterior(source); removeLegacyWindows(scene, source);
      const teachingRoot = hero.getObjectByName('SITE_yihao'); openImportedEntrance(teachingRoot, source.center);
      for (const id of HERO_IDS) {
        const anchor = hero.getObjectByName('SITE_' + id), b = world.buildings.find(item => item.data.id === id);
        if (id !== 'yihao') b.group.children.forEach(child => { child.visible = false; });
        batchRegion(anchor);
        b.group.attach(anchor); anchor.updateMatrix();
      }
      // Offset only the thin forecourt above the retained road skin, never anchors.
      hero.traverse(object => { if (/continuous entrance forecourt|forecourt edge drainage/.test(rawName(object))) { object.position.y += .065; object.updateMatrix(); } });
      world.buildings.find(b => b.data.id === 'hujulongpan')?.group.children.forEach(child => { child.visible = false; });
      batchRegion(hero); scene.add(hero);
      if (world.waterSurface) world.waterSurface.visible = false;
      world.waterSurface = null;
      teaching = global.HaizV3Teaching?.build(world) || null;
      state.status = 'ready'; state.file = loaded.file;
    } catch (error) {
      state.status = 'fallback'; state.error = error.message;
      console.warn('HAIZ V3 regional model:', error);
    }
    if(state.status === 'ready') {
      try {
        campus = await global.HaizV3Campus.install(scene, world, quality, {materials:prepareMaterials,retainInterior:retainTeachingInterior,filterTriangles:removeTriangles,batch:batchRegion}, progress);
        materials = new Set([...materials, ...campus.materials]);
      } catch(error) { state.campusError = error.message; console.warn('HAIZ V3 campus:', error); }
    }
    const bounds = rockBounds;
    const colliders = state.status === 'ready' && bounds ? [
      ...world.colliders.filter(c => c.id !== 'hujulongpan'),
      { id: 'hujulongpan', minX: bounds.min.x, maxX: bounds.max.x, minZ: bounds.min.z, maxZ: bounds.max.z }
    ] : world.colliders;
    const navigationWorld = { ...world, vegetationTiles:campus?.tiles||world.vegetationTiles,colliders, collisionIndex: global.CampusMotion.spatialIndex(colliders) };
    const walker = global.HaizV3Walker?.create(navigationWorld, teaching);
    const controller = {
      state, teaching, walker,
      attach(context) {
        cameraContext = context.camera;
        environment = global.HaizV3Environment.create({ ...context, world });
        environment.setTime(new URLSearchParams(location.search).get('time') || 'morning', true);
        this.setQuality(quality);
      },
      setTime(name, instant = false) { return environment?.setTime(name, instant); },
      setMode(mode) { state.mode = mode; },
      setQuality(tier) {
        const config = global.HaizV3Core.qualityConfig(tier, global.devicePixelRatio || 1);
        environment?.setQuality(tier);campus?.setQuality(tier);
        for (const material of materials) for (const value of Object.values(material)) if (value?.isTexture) value.anisotropy = config.anisotropy;
        return config;
      },
      tick(dt, indoors) { if(cameraContext)campus?.tick(cameraContext,state.mode);return environment?.tick(dt, indoors, state.mode); },
      get time() { return environment?.time || 'morning'; },
      diagnostics() { return { ...state, time: this.time, upstairsRooms: teaching?.rooms.length || 0, ...environment?.diagnostics(), ...campus?.diagnostics() }; }
    };
    return { ...navigationWorld, v3: controller };
  };
})(window);
