/**
 * HAIZ Campus Toybox — Spec-Compliant glTF 2.0 Binary (.glb) Exporter
 */

import { m4NormalMat3, m4TransformPoint } from '../engine/math3d.js';

function pad4(n) {
  return (n + 3) & ~3;
}

export function exportNodeToGLB(rootNode, assetName = 'haiz-toybox-character') {
  rootNode.updateWorldMatrix(null);

  const meshes = [];
  const collect = (n) => {
    if (!n.visible) return;
    if (n.isMesh && n.geometry) meshes.push(n);
    for (const c of n.children) collect(c);
  };
  collect(rootNode);

  const binChunks = [];
  let byteOffset = 0;
  const bufferViews = [];
  const accessors = [];
  const materials = [];
  const primitives = [];

  const pushChunk = (typedArray, target) => {
    const u8 = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
    const paddedLen = pad4(u8.byteLength);
    const chunk = new Uint8Array(paddedLen);
    chunk.set(u8);
    const bvIdx = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: u8.byteLength,
      ...(target ? { target } : {})
    });
    binChunks.push(chunk);
    byteOffset += paddedLen;
    return bvIdx;
  };

  for (let i = 0; i < meshes.length; i++) {
    const m = meshes[i];
    const geo = m.geometry;
    const mat = m.material;
    const vCount = geo.positions.length / 3;

    const posBaked = new Float32Array(geo.positions.length);
    const normBaked = new Float32Array(geo.normals.length);
    const nm = m4NormalMat3(m.worldMatrix);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];

    for (let v = 0; v < vCount; v++) {
      const idx = v * 3;
      const wp = m4TransformPoint(m.worldMatrix, [
        geo.positions[idx],
        geo.positions[idx + 1],
        geo.positions[idx + 2]
      ]);
      posBaked[idx] = wp[0];
      posBaked[idx + 1] = wp[1];
      posBaked[idx + 2] = wp[2];
      for (let k = 0; k < 3; k++) {
        if (wp[k] < min[k]) min[k] = wp[k];
        if (wp[k] > max[k]) max[k] = wp[k];
      }

      const nx = geo.normals[idx], ny = geo.normals[idx + 1], nz = geo.normals[idx + 2];
      let wnx = nm[0] * nx + nm[3] * ny + nm[6] * nz;
      let wny = nm[1] * nx + nm[4] * ny + nm[7] * nz;
      let wnz = nm[2] * nx + nm[5] * ny + nm[8] * nz;
      const len = Math.hypot(wnx, wny, wnz) || 1;
      normBaked[idx] = wnx / len;
      normBaked[idx + 1] = wny / len;
      normBaked[idx + 2] = wnz / len;
    }

    const posBv = pushChunk(posBaked, 34962);
    const normBv = pushChunk(normBaked, 34962);
    const idxBv = pushChunk(geo.indices, 34963);

    const posAcc = accessors.length;
    accessors.push({ bufferView: posBv, componentType: 5126, count: vCount, type: 'VEC3', min, max });

    const normAcc = accessors.length;
    accessors.push({ bufferView: normBv, componentType: 5126, count: vCount, type: 'VEC3' });

    const idxAcc = accessors.length;
    accessors.push({ bufferView: idxBv, componentType: 5123, count: geo.indices.length, type: 'SCALAR' });

    const matIdx = materials.length;
    materials.push({
      name: `${assetName}_mat_${i}`,
      pbrMetallicRoughness: {
        baseColorFactor: [mat.color[0], mat.color[1], mat.color[2], mat.opacity ?? 1.0],
        metallicFactor: mat.metalness ?? 0.0,
        roughnessFactor: mat.roughness ?? 0.85
      }
    });

    primitives.push({
      attributes: { POSITION: posAcc, NORMAL: normAcc },
      indices: idxAcc,
      material: matIdx
    });
  }

  const gltf = {
    asset: { version: '2.0', generator: 'HAIZ Campus Toybox V2 Exporter' },
    scene: 0,
    scenes: [{ name: assetName, nodes: [0] }],
    nodes: [{ name: assetName, mesh: 0 }],
    meshes: [{ name: assetName, primitives }],
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: byteOffset }]
  };

  const jsonBytes = new TextEncoder().encode(JSON.stringify(gltf));
  const jsonPaddedLen = pad4(jsonBytes.byteLength);
  const jsonChunk = new Uint8Array(jsonPaddedLen);
  jsonChunk.fill(0x20);
  jsonChunk.set(jsonBytes);

  const totalLen = 12 + 8 + jsonPaddedLen + 8 + byteOffset;
  const glb = new Uint8Array(totalLen);
  const dv = new DataView(glb.buffer);

  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, totalLen, true);

  dv.setUint32(12, jsonPaddedLen, true);
  dv.setUint32(16, 0x4e4f534a, true);
  glb.set(jsonChunk, 20);

  const binHeaderOffset = 20 + jsonPaddedLen;
  dv.setUint32(binHeaderOffset, byteOffset, true);
  dv.setUint32(binHeaderOffset + 4, 0x004e4942, true);
  let cursor = binHeaderOffset + 8;
  for (const c of binChunks) {
    glb.set(c, cursor);
    cursor += c.byteLength;
  }

  return glb;
}
