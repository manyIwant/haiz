import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createWalker } from '../../lanren/ruhua/walker.js';

export const modelURL = tier => new URL(`./models/student-${tier}.glb`, import.meta.url).href;
export const sourceURL = new URL('./source/20261121124835_b26256ec.glb', import.meta.url).href;

export async function createHunyuan({ mobile, heightAt, onError = console.warn, initial = 'mid' }) {
  const walker = await createWalker(modelURL(initial), { pbr: true, heightAt });
  const { skinned } = walker;
  const skeleton = skinned.skeleton.bones.map(bone => bone.name);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const resources = new Map([[initial, Promise.resolve({ geometry: skinned.geometry, material: skinned.material })]]);
  let active = initial;
  let requested = initial;
  let nextRetry = 0;
  let distanceTier = initial;
  let changedAt = performance.now();
  walker.root.userData.asset = 'hunyuan';
  walker.root.userData.detail = initial;
  const load = key => loader.loadAsync(modelURL(key)).then(({ scene }) => {
    let mesh;
    scene.traverse(node => { if (node.isSkinnedMesh) mesh = node; });
    if (!mesh || mesh.skeleton.bones.some((bone, i) => bone.name !== skeleton[i]) ||
        mesh.skeleton.bones.length !== skeleton.length) {
      throw new Error(`Incompatible ${key} skin`);
    }
    return { geometry: mesh.geometry, material: mesh.material };
  });
  async function switchLOD(key) {
    if (key === requested || performance.now() < nextRetry) return;
    requested = key;
    if (!resources.has(key)) resources.set(key, load(key));
    try {
      const resource = await resources.get(key);
      if (requested !== key) return;
      skinned.geometry = resource.geometry;
      skinned.material = resource.material;
      active = key;
      walker.root.userData.detail = active;
    } catch (error) {
      resources.delete(key);
      if (requested === key) requested = active;
      nextRetry = performance.now() + 5000;
      onError(error);
    }
  }
  return Object.assign(walker, {
    cameraAimLift: run => .08 - .26 * run,
    observeDistance(distance) {
      const target = distance > (distanceTier === 'far' ? 9.8 : 11.5) ? 'far'
        : !mobile && distance < (distanceTier === 'near' ? 7.4 : 5.9) ? 'near' : 'mid';
      if (target !== distanceTier) {
        distanceTier = target;
        changedAt = performance.now();
      }
      if (performance.now() - changedAt >= 400) switchLOD(target);
    },
  });
}
