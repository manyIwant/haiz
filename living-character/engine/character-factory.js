import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { enhanceCharacterMaterials } from './painterly-shader.js';

export const BONE_NAMES = {
  hips: 'hips',
  spine: 'spine',
  spine1: 'spine1',
  chest: 'chest',
  neck: 'neck',
  head: 'head',
  shoulderL: 'shoulderL',
  upperarmL: 'upperarmL',
  upperarmTwistL: 'upperarm_twistL',
  forearmL: 'forearmL',
  forearmTwistL: 'forearm_twistL',
  handL: 'handL',
  shoulderR: 'shoulderR',
  upperarmR: 'upperarmR',
  upperarmTwistR: 'upperarm_twistR',
  forearmR: 'forearmR',
  forearmTwistR: 'forearm_twistR',
  handR: 'handR',
  thighL: 'thighL',
  thighTwistL: 'thigh_twistL',
  shinL: 'shinL',
  shinTwistL: 'shin_twistL',
  footL: 'footL',
  toeL: 'toeL',
  thighR: 'thighR',
  thighTwistR: 'thigh_twistR',
  shinR: 'shinR',
  shinTwistR: 'shin_twistR',
  footR: 'footR',
  toeR: 'toeR',
  bagBody: 'bag_body',
  crossbodyBag: 'crossbody_bag',
  hairFringe: 'hair_fringe',
  hairBack: 'hair_back',
  shirtHemF: 'shirt_hem_f',
  shirtHemB: 'shirt_hem_b',
  ponytail01: 'ponytail_01',
  ponytail02: 'ponytail_02',
};

const _gltfCache = new Map();
let _motionPackPromise = null;

function createLoader() {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

/**
 * Load quantized 30Hz mocap expression pack once and cache across all agents.
 */
export async function loadMotionPack(url = './living-character/assets/motion/haiz-motion-pack.json') {
  if (!_motionPackPromise) {
    _motionPackPromise = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`Failed loading motion pack ${url}: ${res.status}`);
      return res.json();
    }).catch(() => null);
  }
  return _motionPackPromise;
}

/**
 * Resolve sanitized HumanRigMapping matching three-procedural-locomotion v0.11.0.
 */
export function buildHumanRigMapping(root) {
  const bones = {};
  root.traverse((obj) => {
    if (obj.isBone) {
      bones[obj.name] = obj;
    }
  });
  const opt = (name) => (bones[name] ? name : undefined);
  const mapping = {
    hips: 'hips',
    spine: opt('spine'),
    chest: opt('chest') ?? opt('spine1'),
    neck: opt('neck'),
    head: opt('head'),
    left: {
      thigh: 'thighL',
      shin: 'shinL',
      foot: 'footL',
      toe: opt('toeL'),
      thighTwist: opt('thigh_twistL'),
      shinTwist: opt('shin_twistL'),
    },
    right: {
      thigh: 'thighR',
      shin: 'shinR',
      foot: 'footR',
      toe: opt('toeR'),
      thighTwist: opt('thigh_twistR'),
      shinTwist: opt('shin_twistR'),
    },
  };
  if (bones.upperarmL && bones.forearmL && bones.handL) {
    mapping.leftArm = {
      shoulder: opt('shoulderL'),
      upperArm: 'upperarmL',
      forearm: 'forearmL',
      hand: 'handL',
      upperArmTwist: opt('upperarm_twistL'),
      forearmTwist: opt('forearm_twistL'),
    };
  }
  if (bones.upperarmR && bones.forearmR && bones.handR) {
    mapping.rightArm = {
      shoulder: opt('shoulderR'),
      upperArm: 'upperarmR',
      forearm: 'forearmR',
      hand: 'handR',
      upperArmTwist: opt('upperarm_twistR'),
      forearmTwist: opt('forearm_twistR'),
    };
  }
  return { bones, mapping };
}

/**
 * Load & cache a character archetype GLB (`student_hero`, `student_f`, `teacher_f`, `worker_m`)
 * at requested LOD (`lod0` | `lod1` | `lod2`).
 */
export async function loadCharacterArchetype(archetype = 'student_hero', lod = 'lod0', baseDir = './living-character/assets/characters') {
  const url = `${baseDir}/${archetype}/${archetype}_${lod}.glb`;
  if (!_gltfCache.has(url)) {
    const loader = createLoader();
    _gltfCache.set(url, loader.loadAsync(url));
  }
  const gltf = await _gltfCache.get(url);
  const clone = SkeletonUtils.clone(gltf.scene);

  // Clone materials per instance so shadows, lens tints & bag visibility stay isolated
  clone.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
      if (o.material) {
        o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
      }
    }
  });
  return clone;
}

/**
 * Assemble a complete multi-LOD character node (`lod0`, optional `lod1`, `lod2`)
 * or single-LOD clone with accessory handles (`backpack`, `crossbody`) and shader enhancement.
 */
export async function createCharacterInstance({
  archetype = 'student_hero',
  lod = 'lod0',
  baseDir = './living-character/assets/characters',
  shaderUniforms = null,
  showBackpack = true,
  showCrossbody = true,
} = {}) {
  const model = await loadCharacterArchetype(archetype, lod, baseDir);
  if (shaderUniforms) enhanceCharacterMaterials(model, shaderUniforms);

  const { bones, mapping } = buildHumanRigMapping(model);

  const bags = { backpack: [], crossbody: [] };
  model.traverse((obj) => {
    if (!obj.isMesh) return;
    const nm = obj.name.toLowerCase();
    if (nm.includes('backpack')) bags.backpack.push(obj);
    if (nm.includes('crossbody')) bags.crossbody.push(obj);
  });

  const setAccessories = ({ backpack, crossbody } = {}) => {
    if (backpack !== undefined) {
      for (const m of bags.backpack) m.visible = Boolean(backpack);
    }
    if (crossbody !== undefined) {
      for (const m of bags.crossbody) m.visible = Boolean(crossbody);
    }
  };
  setAccessories({ backpack: showBackpack, crossbody: showCrossbody });

  return { model, bones, mapping, bags, setAccessories };
}
