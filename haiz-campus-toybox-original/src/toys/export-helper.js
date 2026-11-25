// Helper module served by Vite during `npm run export:assets` so Three.js & GLTFExporter
// resolve through Vite's module graph without bare-specifier issues.
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { TOY_REGISTRY, createToy, ASSET_SPEC } from './registry.js';
import { CLIP_LIBRARY } from './kit/behavior.js';
import { ALL_TEXTURES } from './kit/textures.js';

function bakeClip(toy, clipName, duration) {
  const fps = 15;
  const steps = Math.max(2, Math.round(duration * fps));
  const dt = duration / steps;
  const times = [];
  const tracksMap = new Map();
  const nodeEntries = Object.entries(toy.rig.nodes);
  for (const [, obj] of nodeEntries) {
    tracksMap.set(obj.name, { pos: [], quat: [], scl: [] });
  }
  toy.behavior.reset();
  toy.behavior.play(clipName);
  for (let i = 0; i <= steps; i++) {
    times.push(i * dt);
    if (i > 0) toy.behavior.update(dt);
    for (const [, obj] of nodeEntries) {
      const rec = tracksMap.get(obj.name);
      rec.pos.push(obj.position.x, obj.position.y, obj.position.z);
      rec.quat.push(obj.quaternion.x, obj.quaternion.y, obj.quaternion.z, obj.quaternion.w);
      rec.scl.push(obj.scale.x, obj.scale.y, obj.scale.z);
    }
  }
  toy.behavior.reset();
  const tracks = [];
  for (const [name, rec] of tracksMap.entries()) {
    tracks.push(new THREE.VectorKeyframeTrack(`${name}.position`, times, rec.pos));
    tracks.push(new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, rec.quat));
    tracks.push(new THREE.VectorKeyframeTrack(`${name}.scale`, times, rec.scl));
  }
  return new THREE.AnimationClip(clipName, duration, tracks);
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export async function exportAllAssets() {
  const exporter = new GLTFExporter();
  const models = [];
  for (const entry of TOY_REGISTRY) {
    const toy = createToy(entry.id);
    let vertices = 0, triangles = 0, meshes = 0;
    toy.root.traverse((o) => {
      if (o.isMesh && o.geometry) {
        meshes += 1;
        vertices += o.geometry.attributes.position.count;
        triangles += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3;
      }
    });
    const animations = Object.entries(CLIP_LIBRARY).map(([k, def]) =>
      bakeClip(toy, k, Math.min(def.duration, 2.4))
    );
    const glbBuf = await new Promise((resolve, reject) => {
      exporter.parse(toy.root, resolve, reject, { binary: true, animations, onlyVisible: true });
    });
    models.push({
      id: entry.id,
      qualifiedId: entry.qualifiedId,
      version: entry.version,
      name: entry.name,
      enName: entry.enName,
      title: entry.title,
      motif: entry.motif,
      materialSummary: entry.materialSummary,
      modelPath: entry.modelPath,
      meta: entry.meta,
      stats: { meshes, vertices, triangles: Math.round(triangles), clips: animations.map((a) => a.name) },
      glbBase64: arrayBufferToBase64(glbBuf),
    });
    toy.dispose();
  }

  const textures = [];
  for (const [name, fn] of Object.entries(ALL_TEXTURES)) {
    const tex = fn();
    const canvas = tex.userData?.canvas || tex.image;
    if (canvas?.toDataURL) {
      textures.push({ name, width: canvas.width, height: canvas.height, dataUrl: canvas.toDataURL('image/png') });
    }
  }

  return { spec: ASSET_SPEC, models, textures };
}
