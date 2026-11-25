// HAIZ 动物验证码 · 标准 glTF 2.0 Binary (.glb) 导出器
// 支持：完整节点层级、PBR + KHR_materials_sheen + KHR_materials_clearcoat + KHR_materials_unlit、
// 顶点色 COLOR_0、UV + normalTexture + KHR_texture_transform、以及烘焙动画（位置/旋转/缩放）。
import * as THREE from 'three';

function pad4(n) {
  return (n + 3) & ~3;
}

function canvasToPngBytes(canvas) {
  const dataUrl = canvas.toDataURL('image/png');
  const b64 = dataUrl.split(',')[1];
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * 将 Three.js 场景根节点与 AnimationClip 数组导出为紧凑的 glTF 2.0 二进制 (.glb) Uint8Array。
 * @param {THREE.Object3D} root
 * @param {THREE.AnimationClip[]} animations
 */
export function exportToGLB(root, animations = []) {
  root.updateMatrixWorld(true);

  const extensionsUsed = new Set();
  const bufferChunks = [];
  let byteOffset = 0;
  const bufferViews = [];
  const accessors = [];
  const images = [];
  const samplers = [];
  const textures = [];
  const materials = [];
  const meshes = [];
  const nodes = [];
  const nodeIndexByName = new Map();

  const imageCache = new Map();
  const textureCache = new Map();
  const materialCache = new Map();

  function appendBuffer(bytes, target) {
    const u8 = bytes instanceof Uint8Array
      ? bytes
      : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const padded = pad4(u8.byteLength);
    const chunk = new Uint8Array(padded);
    chunk.set(u8);
    const bvIndex = bufferViews.length;
    const bv = { buffer: 0, byteOffset, byteLength: u8.byteLength };
    if (target) bv.target = target;
    bufferViews.push(bv);
    bufferChunks.push(chunk);
    byteOffset += padded;
    return bvIndex;
  }

  function addAccessor(typedArray, componentType, type, target, computeBounds = false) {
    const bv = appendBuffer(typedArray, target);
    const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[type];
    const count = typedArray.length / comps;
    const acc = { bufferView: bv, componentType, count, type };
    if (computeBounds) {
      const min = new Array(comps).fill(Infinity);
      const max = new Array(comps).fill(-Infinity);
      for (let i = 0; i < count; i++) {
        for (let k = 0; k < comps; k++) {
          const val = typedArray[i * comps + k];
          if (val < min[k]) min[k] = val;
          if (val > max[k]) max[k] = val;
        }
      }
      acc.min = min;
      acc.max = max;
    }
    const idx = accessors.length;
    accessors.push(acc);
    return idx;
  }

  function ensureTexture(tex) {
    if (!tex) return null;
    if (textureCache.has(tex)) return textureCache.get(tex);
    const canvas = tex.userData?.canvas || tex.image;
    if (!canvas || typeof canvas.toDataURL !== 'function') return null;

    let imgIdx = imageCache.get(canvas);
    if (imgIdx === undefined) {
      const pngBytes = canvasToPngBytes(canvas);
      const bv = appendBuffer(pngBytes);
      imgIdx = images.length;
      images.push({ bufferView: bv, mimeType: 'image/png', name: tex.name || `img_${imgIdx}` });
      imageCache.set(canvas, imgIdx);
    }

    if (samplers.length === 0) {
      samplers.push({ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 });
    }

    const texIdx = textures.length;
    textures.push({ sampler: 0, source: imgIdx, name: tex.name || `tex_${texIdx}` });
    textureCache.set(tex, texIdx);
    return texIdx;
  }

  function matKey(m) {
    const c = m.color ? m.color.getHexString() : 'ffffff';
    const sc = m.sheenColor ? m.sheenColor.getHexString() : '';
    const n = m.normalMap ? (m.normalMap.name || '1') : '0';
    const ns = m.normalScale ? `${m.normalScale.x.toFixed(2)}` : '0';
    return [
      m.type, c, m.roughness ?? 1, m.metalness ?? 0, m.sheen ?? 0, m.sheenRoughness ?? 0,
      sc, m.clearcoat ?? 0, m.clearcoatRoughness ?? 0, n, ns,
      m.side, m.vertexColors ? 1 : 0, m.transparent ? 1 : 0, m.opacity ?? 1,
    ].join('|');
  }

  function ensureMaterial(m) {
    const key = matKey(m);
    if (materialCache.has(key)) return materialCache.get(key);

    const c = m.color || new THREE.Color(1, 1, 1);
    const matDef = {
      name: m.name || `mat_${materials.length}`,
      pbrMetallicRoughness: {
        baseColorFactor: [c.r, c.g, c.b, m.opacity ?? 1],
        metallicFactor: m.metalness ?? 0,
        roughnessFactor: m.roughness ?? 0.9,
      },
    };
    if (m.side === THREE.DoubleSide) matDef.doubleSided = true;
    if (m.transparent) matDef.alphaMode = 'BLEND';

    const exts = {};
    if (m.isMeshBasicMaterial) {
      exts.KHR_materials_unlit = {};
      extensionsUsed.add('KHR_materials_unlit');
    } else {
      if (m.sheen > 0) {
        const sc = m.sheenColor || new THREE.Color(1, 1, 1);
        exts.KHR_materials_sheen = {
          sheenColorFactor: [sc.r * m.sheen, sc.g * m.sheen, sc.b * m.sheen],
          sheenRoughnessFactor: m.sheenRoughness ?? 0.5,
        };
        extensionsUsed.add('KHR_materials_sheen');
      }
      if (m.clearcoat > 0) {
        exts.KHR_materials_clearcoat = {
          clearcoatFactor: m.clearcoat,
          clearcoatRoughnessFactor: m.clearcoatRoughness ?? 0.05,
        };
        extensionsUsed.add('KHR_materials_clearcoat');
      }
      if (m.normalMap) {
        const tIdx = ensureTexture(m.normalMap);
        if (tIdx !== null) {
          const nInfo = { index: tIdx, scale: m.normalScale ? m.normalScale.x : 0.5 };
          if (m.normalMap.repeat && (m.normalMap.repeat.x !== 1 || m.normalMap.repeat.y !== 1)) {
            nInfo.extensions = {
              KHR_texture_transform: { scale: [m.normalMap.repeat.x, m.normalMap.repeat.y] },
            };
            extensionsUsed.add('KHR_texture_transform');
          }
          matDef.normalTexture = nInfo;
        }
      }
    }

    if (Object.keys(exts).length > 0) matDef.extensions = exts;

    const idx = materials.length;
    materials.push(matDef);
    materialCache.set(key, idx);
    return idx;
  }

  function addMesh(threeMesh) {
    const geo = threeMesh.geometry;
    const attributes = {};

    const posAttr = geo.attributes.position;
    attributes.POSITION = addAccessor(new Float32Array(posAttr.array), 5126, 'VEC3', 34962, true);

    if (geo.attributes.normal) {
      attributes.NORMAL = addAccessor(new Float32Array(geo.attributes.normal.array), 5126, 'VEC3', 34962, false);
    }
    if (geo.attributes.uv && threeMesh.material?.normalMap) {
      attributes.TEXCOORD_0 = addAccessor(new Float32Array(geo.attributes.uv.array), 5126, 'VEC2', 34962, false);
    }
    if (geo.attributes.color && threeMesh.material?.vertexColors) {
      attributes.COLOR_0 = addAccessor(new Float32Array(geo.attributes.color.array), 5126, 'VEC3', 34962, false);
    }

    const prim = { attributes, material: ensureMaterial(threeMesh.material) };
    if (geo.index) {
      const idxArr = geo.index.array;
      const maxIdx = posAttr.count - 1;
      if (maxIdx <= 65535) {
        prim.indices = addAccessor(new Uint16Array(idxArr), 5123, 'SCALAR', 34963, false);
      } else {
        prim.indices = addAccessor(new Uint32Array(idxArr), 5125, 'SCALAR', 34963, false);
      }
    }

    const meshIdx = meshes.length;
    meshes.push({ name: threeMesh.name || `mesh_${meshIdx}`, primitives: [prim] });
    return meshIdx;
  }

  function visitNode(obj) {
    const idx = nodes.length;
    const def = {};
    if (obj.name) {
      def.name = obj.name;
      nodeIndexByName.set(obj.name, idx);
    }
    const p = obj.position;
    const q = obj.quaternion;
    const s = obj.scale;
    if (Math.abs(p.x) > 1e-6 || Math.abs(p.y) > 1e-6 || Math.abs(p.z) > 1e-6) {
      def.translation = [p.x, p.y, p.z];
    }
    if (Math.abs(q.x) > 1e-6 || Math.abs(q.y) > 1e-6 || Math.abs(q.z) > 1e-6 || Math.abs(q.w - 1) > 1e-6) {
      def.rotation = [q.x, q.y, q.z, q.w];
    }
    if (Math.abs(s.x - 1) > 1e-6 || Math.abs(s.y - 1) > 1e-6 || Math.abs(s.z - 1) > 1e-6) {
      def.scale = [s.x, s.y, s.z];
    }
    if (obj.isMesh && obj.geometry) {
      def.mesh = addMesh(obj);
    }
    nodes.push(def);

    if (obj.children && obj.children.length > 0) {
      const childIndices = [];
      for (const ch of obj.children) {
        if (!ch.visible) continue;
        childIndices.push(visitNode(ch));
      }
      if (childIndices.length > 0) def.children = childIndices;
    }
    return idx;
  }

  const rootIdx = visitNode(root);

  // 导出动画轨道
  const gltfAnims = [];
  const pathMap = { position: 'translation', quaternion: 'rotation', scale: 'scale' };
  const typeMap = { position: 'VEC3', quaternion: 'VEC4', scale: 'VEC3' };

  for (const clip of animations) {
    const channels = [];
    const animSamplers = [];
    const inputCache = new Map();

    for (const track of clip.tracks) {
      const dot = track.name.lastIndexOf('.');
      const targetName = track.name.slice(0, dot);
      const prop = track.name.slice(dot + 1);
      const nodeIdx = nodeIndexByName.get(targetName);
      if (nodeIdx === undefined || !pathMap[prop]) continue;

      const tKey = `${track.times.length}_${track.times[0]}_${track.times[track.times.length - 1]}`;
      let inputAcc = inputCache.get(tKey);
      if (inputAcc === undefined) {
        inputAcc = addAccessor(new Float32Array(track.times), 5126, 'SCALAR', undefined, true);
        inputCache.set(tKey, inputAcc);
      }
      const outputAcc = addAccessor(new Float32Array(track.values), 5126, typeMap[prop], undefined, false);
      const samplerIdx = animSamplers.length;
      animSamplers.push({ input: inputAcc, interpolation: 'LINEAR', output: outputAcc });
      channels.push({ sampler: samplerIdx, target: { node: nodeIdx, path: pathMap[prop] } });
    }

    if (channels.length > 0) {
      gltfAnims.push({ name: clip.name, channels, samplers: animSamplers });
    }
  }

  const gltf = {
    asset: { version: '2.0', generator: 'HAIZ Animal Verifier Plush Exporter 1.0' },
    scene: 0,
    scenes: [{ name: root.name || 'plush', nodes: [rootIdx] }],
    nodes,
    meshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: byteOffset }],
  };
  if (images.length) gltf.images = images;
  if (samplers.length) gltf.samplers = samplers;
  if (textures.length) gltf.textures = textures;
  if (gltfAnims.length) gltf.animations = gltfAnims;
  if (extensionsUsed.size) gltf.extensionsUsed = [...extensionsUsed];

  const jsonBytes = new TextEncoder().encode(JSON.stringify(gltf));
  const jsonPadded = pad4(jsonBytes.byteLength);
  const jsonChunk = new Uint8Array(jsonPadded);
  jsonChunk.fill(0x20);
  jsonChunk.set(jsonBytes);

  const totalLen = 12 + 8 + jsonPadded + 8 + byteOffset;
  const glb = new Uint8Array(totalLen);
  const dv = new DataView(glb.buffer);

  dv.setUint32(0, 0x46546c67, true); // 'glTF'
  dv.setUint32(4, 2, true);
  dv.setUint32(8, totalLen, true);

  dv.setUint32(12, jsonPadded, true);
  dv.setUint32(16, 0x4e4f534a, true); // 'JSON'
  glb.set(jsonChunk, 20);

  const binOffset = 20 + jsonPadded;
  dv.setUint32(binOffset, byteOffset, true);
  dv.setUint32(binOffset + 4, 0x004e4942, true); // 'BIN\0'
  let cursor = binOffset + 8;
  for (const ch of bufferChunks) {
    glb.set(ch, cursor);
    cursor += ch.byteLength;
  }

  return glb;
}
