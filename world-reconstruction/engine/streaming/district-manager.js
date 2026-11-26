/**
 * HAIZ · World Reconstruction — Progressive District Streaming, LOD Switcher & GPU Instancer.
 *
 * Streams all 6 Fucheng Campus districts by spatial priority:
 *   Priority 0 (immediate boot < 1.2s): terrain_campus + d01_axis_forecourt + flora_kit + props_kit
 *   Priority 1 (near core):             d02_academic_core + d03_yanchi_arts
 *   Priority 2 (outer campus):          d04_heritage_gardens + d05_sports_living
 *   Priority 3 (horizon skyline):       d06_fucheng_context
 *
 * Automatically swaps between LOD0 (hero recessed details) and LOD1 (simplified distant proxy)
 * based on camera distance and device quality tier, and populates 240+ tropical trees & street
 * furniture props via `THREE.InstancedMesh` (~12 draw calls total!).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export class DistrictManager {
  constructor(scene, atmosphere, spec, { districtsBaseUrl, dracoUrl, quality = 'high', onProgress = () => {} }) {
    this.scene = scene;
    this.atmosphere = atmosphere;
    this.spec = spec;
    this.districtsBaseUrl = districtsBaseUrl;
    this.quality = quality;
    this.onProgress = onProgress;

    this.root = new THREE.Group();
    this.root.name = 'haiz_campus_world_root';
    scene.add(this.root);

    this.draco = new DRACOLoader();
    this.draco.setDecoderPath(dracoUrl);
    this.loader = new GLTFLoader();
    this.loader.setDRACOLoader(this.draco);

    this.districts = new Map(); // id -> { meta, lod0, lod1, currentLod, loaded }
    this.pickables = [];        // meshes with userData.haiz_building_id
    this.instancedGroup = new THREE.Group();
    this.instancedGroup.name = 'haiz_instanced_flora_and_props';
    this.root.add(this.instancedGroup);

    // Distance threshold for switching LOD0 -> LOD1
    this.lodSwitchDist = quality === 'mobile' ? 105 : quality === 'balanced' ? 145 : 220;
    this._loadedCount = 0;
    this._totalCount = 1 + spec.districts.length + 2; // terrain + 6 districts + flora + props
  }

  _prepGroup(group, { castShadow = true, receiveShadow = true, isContext = false } = {}) {
    group.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.castShadow = castShadow && !isContext;
      obj.receiveShadow = receiveShadow;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (m) this.atmosphere.enhanceMaterial(m);
      }
      if (obj.userData && (obj.userData.haiz_building_id || obj.userData.haiz_name)) {
        this.pickables.push(obj);
      }
    });
    return group;
  }

  async _loadGlb(fileName) {
    const url = new URL(fileName, this.districtsBaseUrl).href;
    const gltf = await this.loader.loadAsync(url);
    return gltf.scene;
  }

  async loadPriority0(instances) {
    this.onProgress(0.15, '载入统一校园地形与中轴礼仪前庭…');
    const [terrain, d01, floraKit, propsKit] = await Promise.all([
      this._loadGlb('terrain_campus.glb'),
      this._loadGlb('d01_axis_forecourt_lod0.glb'),
      this._loadGlb('flora_kit.glb'),
      this._loadGlb('props_kit.glb'),
    ]);

    this._prepGroup(terrain, { castShadow: false, receiveShadow: true });
    this.root.add(terrain);
    this._loadedCount++;

    const d01Meta = this.spec.districts.find((d) => d.id === 'd01_axis_forecourt');
    this._prepGroup(d01);
    this.root.add(d01);
    this.districts.set('d01_axis_forecourt', { meta: d01Meta, lod0: d01, lod1: null, currentLod: 0, loaded: true });
    this._loadedCount++;

    // Build GPU-instanced tropical trees & campus furniture
    this._buildInstances(floraKit, instances.flora, 'haiz_archetype', { castShadow: this.quality !== 'mobile' });
    this._buildInstances(propsKit, instances.props, 'haiz_prop', { castShadow: this.quality !== 'mobile' });
    this._loadedCount += 2;
    this.onProgress(0.65, '中轴前庭与热带植被已就绪，正在后台流式载入全校分区…');
  }

  async streamRemainingDistricts(onDistrictLoaded = () => {}) {
    const ordered = this.spec.districts
      .filter((d) => d.id !== 'd01_axis_forecourt')
      .sort((a, b) => a.priority - b.priority);

    const preferLod1Initially = this.quality === 'mobile';
    for (const meta of ordered) {
      const id = meta.id;
      const isCtx = id === 'd06_fucheng_context';
      const primaryFile = !meta.has_lod1 ? `${id}.glb` : (preferLod1Initially ? `${id}_lod1.glb` : `${id}_lod0.glb`);
      try {
        const grp = await this._loadGlb(primaryFile);
        this._prepGroup(grp, { castShadow: !isCtx, receiveShadow: true, isContext: isCtx });
        this.root.add(grp);
        const rec = {
          meta,
          lod0: (!meta.has_lod1 || !preferLod1Initially) ? grp : null,
          lod1: (meta.has_lod1 && preferLod1Initially) ? grp : null,
          currentLod: preferLod1Initially && meta.has_lod1 ? 1 : 0,
          loaded: true,
        };
        this.districts.set(id, rec);
        this._loadedCount++;
        onDistrictLoaded(id, this.getStatus());

        // Preload alternate LOD asynchronously on desktop/balanced for seamless distance switching
        if (meta.has_lod1 && !preferLod1Initially) {
          this._loadGlb(`${id}_lod1.glb`).then((l1) => {
            this._prepGroup(l1, { castShadow: false, receiveShadow: true });
            l1.visible = false;
            this.root.add(l1);
            rec.lod1 = l1;
          }).catch(() => {});
        }
      } catch (err) {
        console.warn(`District ${id} failed to stream:`, err);
      }
    }
  }

  _buildInstances(kitScene, placementsByType, keyField, { castShadow = true } = {}) {
    const archetypes = new Map();
    kitScene.traverse((obj) => {
      if (!obj.isMesh) return;
      const key = obj.userData?.[keyField] || obj.parent?.userData?.[keyField];
      if (!key) return;
      if (!archetypes.has(key)) archetypes.set(key, []);
      archetypes.get(key).push(obj);
    });

    const dummy = new THREE.Object3D();
    for (const [kind, list] of Object.entries(placementsByType)) {
      const meshes = archetypes.get(kind);
      if (!meshes || !list.length) continue;
      for (const srcMesh of meshes) {
        const mat = Array.isArray(srcMesh.material)
          ? srcMesh.material.map((m) => { const c = m.clone(); this.atmosphere.enhanceMaterial(c); return c; })
          : (() => { const c = srcMesh.material.clone(); this.atmosphere.enhanceMaterial(c); return c; })();

        const inst = new THREE.InstancedMesh(srcMesh.geometry, mat, list.length);
        inst.name = `inst_${kind}_${srcMesh.name}`;
        inst.castShadow = castShadow;
        inst.receiveShadow = true;

        for (let i = 0; i < list.length; i++) {
          const [sx, sy, sz, sc, rot] = list[i];
          // Spec (sx east, sy north, sz up) -> Three.js (sx, sz, -sy)
          dummy.position.set(sx, sz, -sy);
          dummy.rotation.set(0, rot, 0);
          dummy.scale.set(sc, sc, sc);
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
        }
        inst.instanceMatrix.needsUpdate = true;
        inst.computeBoundingSphere();
        this.instancedGroup.add(inst);
      }
    }
  }

  setQuality(quality) {
    this.quality = quality;
    this.lodSwitchDist = quality === 'mobile' ? 105 : quality === 'balanced' ? 145 : 220;
  }

  updateLod(cameraPos) {
    for (const [, rec] of this.districts) {
      if (!rec.meta?.has_lod1 || !rec.lod0 || !rec.lod1) continue;
      // Spec center -> Three.js (cx, 0, -cy)
      const cx = rec.meta.center[0];
      const cz = -rec.meta.center[1];
      const dist = Math.hypot(cameraPos.x - cx, cameraPos.z - cz);
      const wantLod = dist > this.lodSwitchDist + rec.meta.radius * 0.45 ? 1 : 0;
      if (wantLod !== rec.currentLod) {
        rec.currentLod = wantLod;
        rec.lod0.visible = wantLod === 0;
        rec.lod1.visible = wantLod === 1;
      }
    }
  }

  getStatus() {
    return {
      loaded: this._loadedCount,
      total: this._totalCount,
      districtsLoaded: Array.from(this.districts.keys()),
    };
  }

  dispose() {
    this.draco.dispose();
    this.root.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m?.dispose();
      }
    });
  }
}
