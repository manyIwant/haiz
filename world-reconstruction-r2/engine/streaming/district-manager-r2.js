/**
 * HAIZ · World Reconstruction Round 2 — Progressive Hybrid Streaming Manager.
 *
 * Streams BOTH:
 *   - All 9 inherited Atelier Master runtime GLBs (`twin/assets/runtime/*.glb`, MeshOpt compressed)
 *     preserving COLOR_0 vertex colors (`landmark`, `terminalia`), alpha-cutout leaves (`terminalia`),
 *     forecourt cleanup (stripping conflicting `site.ground.context` & `Cube`), and Yanchi water ripples;
 *   - All newly assembled Round 2 high-craft Hero Landmarks, Outer Campus, Terrain & Context GLBs
 *     (`world-reconstruction-r2/assets/districts/*.glb`, Draco+WebP LOD0/LOD1) + GPU Instanced Flora & Props.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const ATELIER_META = {
  yihao: {
    haiz_building_id: 'yihao',
    haiz_name: '一号教学楼（1923）· Atelier 原真继承',
    haiz_tag: 'inherited/atelier/photo-derived',
    haiz_basis: 'Direct inheritance of HAIZ twin/assets/runtime/yihao.glb (6-storey red-tile colonnade, twin stair towers, 1923 relief portal)',
  },
  landmark: {
    haiz_building_id: 'taihu',
    haiz_name: '「虎踞龍盤」太湖石 · Atelier 原真继承',
    haiz_tag: 'inherited/atelier/photo-derived',
    haiz_basis: 'Direct inheritance of twin/assets/runtime/landmark.glb with original COLOR_0 vertex shading & inscribed plinth',
  },
  terminalia: {
    haiz_building_id: 'terminalia',
    haiz_name: '百年古榄仁树 · Atelier 原真继承',
    haiz_tag: 'inherited/atelier/photo-derived',
    haiz_basis: 'Direct inheritance of twin/assets/runtime/terminalia.glb (alpha-cutout crown leaves & COLOR_0 bark)',
  },
  forecourt: {
    haiz_building_id: 'forecourt',
    haiz_name: '中轴前庭与状元路 · Atelier 原真继承',
    haiz_tag: 'inherited/atelier/photo-derived',
    haiz_basis: 'Direct inheritance of twin/assets/runtime/forecourt.glb (cleaned of site.ground.context)',
  },
  erhao: {
    haiz_building_id: 'erhao',
    haiz_name: '二号教学楼与架空内院 · Atelier 原真继承',
    haiz_tag: 'inherited/atelier/photo-derived',
    haiz_basis: 'Direct inheritance of twin/assets/runtime/erhao.glb',
  },
  science: {
    haiz_building_id: 'science',
    haiz_name: '科学馆 · Atelier 原真继承',
    haiz_tag: 'inherited/atelier/photo-derived',
    haiz_basis: 'Direct inheritance of twin/assets/runtime/science.glb',
  },
  south_classrooms: {
    haiz_building_id: 'south_classrooms',
    haiz_name: '南侧教学楼群 · Atelier 原真继承',
    haiz_tag: 'inherited/atelier/photo-derived',
    haiz_basis: 'Direct inheritance of twin/assets/runtime/south_classrooms.glb',
  },
  yanchi: {
    haiz_building_id: 'yanchi',
    haiz_name: '砚池 · Atelier 原真继承（动态水面）',
    haiz_tag: 'inherited/atelier/photo-derived',
    haiz_basis: 'Direct inheritance of twin/assets/runtime/yanchi.glb with animated Pond ripples',
  },
  arts: {
    haiz_building_id: 'arts',
    haiz_name: '艺术中心 · Atelier 原真继承',
    haiz_tag: 'inherited/atelier/photo-derived',
    haiz_basis: 'Direct inheritance of twin/assets/runtime/arts.glb',
  },
};

export class DistrictManagerR2 {
  constructor(
    scene,
    atmosphere,
    spec,
    { districtsBaseUrl, atelierBaseUrl, dracoUrl, quality = 'high', onProgress = () => {} }
  ) {
    this.scene = scene;
    this.atmosphere = atmosphere;
    this.spec = spec;
    this.districtsBaseUrl = districtsBaseUrl;
    this.atelierBaseUrl = atelierBaseUrl;
    this.quality = quality;
    this.onProgress = onProgress;

    this.root = new THREE.Group();
    this.root.name = 'haiz_r2_world_root';
    scene.add(this.root);

    this.draco = new DRACOLoader();
    this.draco.setDecoderPath(dracoUrl);
    this.loader = new GLTFLoader();
    this.loader.setDRACOLoader(this.draco);
    if (MeshoptDecoder) {
      this.loader.setMeshoptDecoder(MeshoptDecoder);
    }

    this.districts = new Map();
    this.atelierParts = new Map();
    this.pickables = [];
    this.yanchiWaters = [];
    this.instancedGroup = new THREE.Group();
    this.instancedGroup.name = 'haiz_r2_instanced_flora_props';
    this.root.add(this.instancedGroup);

    this.lodSwitchDist = quality === 'mobile' ? 115 : quality === 'balanced' ? 160 : 240;
    this._loadedCount = 0;
    // 9 Atelier runtime GLBs + 6 R2 districts (terrain, heroes_north, heroes_heritage, outer_campus, context, flora+props)
    this._totalCount = 15;
  }

  _prepGroup(group, { castShadow = true, receiveShadow = true, isContext = false, atelierKey = null } = {}) {
    const toRemove = [];
    const meta = atelierKey ? ATELIER_META[atelierKey] : null;
    group.traverse((obj) => {
      if (!obj.isMesh) return;
      const lname = (obj.name || '').toLowerCase();
      if (atelierKey === 'forecourt' && (lname.includes('site.ground.context') || obj.name === 'Cube' || obj.name.startsWith('Cube.'))) {
        toRemove.push(obj);
        return;
      }

      const isGround = lname.startsWith('site.ground') || lname.startsWith('siteground') || lname.includes('terrain');
      obj.castShadow = castShadow && !isContext && !isGround;
      obj.receiveShadow = receiveShadow;

      const hasColor0 = Boolean(obj.geometry?.attributes?.color);
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (!m) continue;
        if (hasColor0) {
          m.vertexColors = true;
        }
        if (lname.includes('leaves') || lname.includes('foliage') || (m.name || '').toLowerCase().includes('leaf')) {
          m.side = THREE.DoubleSide;
          if (m.map && !m.transparent) m.alphaTest = Math.max(m.alphaTest || 0, 0.42);
        }
        if (atelierKey === 'yanchi' && (lname.includes('water') || lname.includes('pond') || (m.name || '').toLowerCase().includes('water'))) {
          m.roughness = 0.08;
          m.metalness = 0.15;
          m.envMapIntensity = 1.35;
          this.yanchiWaters.push({ mesh: obj, mat: m });
        }
        this.atmosphere.enhanceMaterial(m);
        m.needsUpdate = true;
      }

      if (meta && !obj.userData?.haiz_building_id) {
        Object.assign(obj.userData, meta);
      }
      if (obj.userData && (obj.userData.haiz_building_id || obj.userData.haiz_name) && !isGround) {
        this.pickables.push(obj);
      }
    });
    for (const r of toRemove) {
      r.parent?.remove(r);
    }
    return group;
  }

  async _loadGlb(baseUrl, fileName) {
    const url = new URL(fileName, baseUrl).href;
    const gltf = await this.loader.loadAsync(url);
    return gltf.scene;
  }

  async _loadAtelier(key, onLoaded) {
    const grp = await this._loadGlb(this.atelierBaseUrl, `${key}.glb`);
    grp.name = `atelier_${key}`;
    this._prepGroup(grp, { castShadow: true, receiveShadow: true, atelierKey: key });
    this.root.add(grp);
    this.atelierParts.set(key, grp);
    this._loadedCount++;
    onLoaded?.(key, this.getStatus());
    return grp;
  }

  async _loadR2Group(id, fileBase, center, radius, hasLod1, isContext = false, onLoaded) {
    const preferLod1 = this.quality === 'mobile' && hasLod1;
    const primary = hasLod1 ? `${fileBase}_lod${preferLod1 ? 1 : 0}.glb` : `${fileBase}.glb`;
    const grp = await this._loadGlb(this.districtsBaseUrl, primary);
    this._prepGroup(grp, { castShadow: !isContext, receiveShadow: true, isContext });
    this.root.add(grp);
    const rec = {
      id,
      center,
      radius,
      hasLod1,
      lod0: !preferLod1 ? grp : null,
      lod1: preferLod1 ? grp : null,
      currentLod: preferLod1 ? 1 : 0,
      loaded: true,
    };
    this.districts.set(id, rec);
    this._loadedCount++;
    onLoaded?.(id, this.getStatus());

    if (hasLod1 && !preferLod1) {
      this._loadGlb(this.districtsBaseUrl, `${fileBase}_lod1.glb`).then((l1) => {
        this._prepGroup(l1, { castShadow: false, receiveShadow: true });
        l1.visible = false;
        this.root.add(l1);
        rec.lod1 = l1;
      }).catch(() => {});
    }
    return rec;
  }

  async loadPriority0(instances, onProgressCb = () => {}) {
    this.onProgress(0.15, '载入 Round 2 地基与 Atelier 百年中轴核心…');
    const [terrain, heroesN, floraKit, propsKit] = await Promise.all([
      this._loadR2Group('terrain', 'r2_terrain_surround', [0, 0], 180, false, false, onProgressCb),
      this._loadR2Group('heroes_north', 'r2_heroes_north', [15, 92], 65, true, false, onProgressCb),
      this._loadGlb(this.districtsBaseUrl, 'r2_flora_kit.glb'),
      this._loadGlb(this.districtsBaseUrl, 'r2_props_kit.glb'),
      this._loadAtelier('forecourt', onProgressCb),
      this._loadAtelier('yihao', onProgressCb),
      this._loadAtelier('landmark', onProgressCb),
      this._loadAtelier('terminalia', onProgressCb),
    ]);

    this._buildInstances(floraKit, instances.flora, 'haiz_archetype', { castShadow: this.quality !== 'mobile' });
    this._buildInstances(propsKit, instances.props, 'haiz_prop', { castShadow: this.quality !== 'mobile' });
    this._loadedCount += 1; // count flora+props bundle
    this.onProgress(0.68, '中轴前庭与北门科技楼已就绪，正在流式载入全校分区…');
  }

  async streamRemainingDistricts(onLoaded = () => {}) {
    // Priority 1: Library, Heritage Complex + Erhao, Science, Yanchi, Arts
    await Promise.all([
      this._loadR2Group('heroes_heritage', 'r2_heroes_heritage', [40, 28], 95, true, false, onLoaded),
      this._loadAtelier('erhao', onLoaded),
      this._loadAtelier('science', onLoaded),
      this._loadAtelier('yanchi', onLoaded),
      this._loadAtelier('arts', onLoaded),
    ]).catch((e) => console.warn('Priority 1 load warning:', e));

    // Priority 2: Outer Campus + South Classrooms
    await Promise.all([
      this._loadR2Group('outer_campus', 'r2_outer_campus', [-20, -90], 190, true, false, onLoaded),
      this._loadAtelier('south_classrooms', onLoaded),
    ]).catch((e) => console.warn('Priority 2 load warning:', e));

    // Priority 3: Fucheng Urban Skyline
    await this._loadR2Group('fucheng_context', 'r2_fucheng_context', [0, -50], 450, false, true, onLoaded)
      .catch((e) => console.warn('Priority 3 load warning:', e));
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
        inst.name = `inst_r2_${kind}_${srcMesh.name}`;
        inst.castShadow = castShadow;
        inst.receiveShadow = true;

        for (let i = 0; i < list.length; i++) {
          const [sx, sy, sz, sc, rot] = list[i];
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

  update(dt, runtime) {
    if (this.yanchiWaters.length) {
      const t = runtime.simTime || 0;
      for (const { mat } of this.yanchiWaters) {
        if (mat.normalMap) {
          mat.normalMap.offset.x = (t * 0.015) % 1;
          mat.normalMap.offset.y = (t * 0.011) % 1;
        }
      }
    }
  }

  setQuality(quality) {
    this.quality = quality;
    this.lodSwitchDist = quality === 'mobile' ? 115 : quality === 'balanced' ? 160 : 240;
  }

  updateLod(cameraPos) {
    for (const [, rec] of this.districts) {
      if (!rec.hasLod1 || !rec.lod0 || !rec.lod1) continue;
      const cx = rec.center[0];
      const cz = -rec.center[1];
      const dist = Math.hypot(cameraPos.x - cx, cameraPos.z - cz);
      const wantLod = dist > this.lodSwitchDist + rec.radius * 0.45 ? 1 : 0;
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
      atelierLoaded: Array.from(this.atelierParts.keys()),
      r2DistrictsLoaded: Array.from(this.districts.keys()),
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
