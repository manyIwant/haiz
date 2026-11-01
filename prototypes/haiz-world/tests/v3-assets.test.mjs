import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const assets = new URL('public/haiz/world/v3/assets/', root);
const manifest = () => JSON.parse(readFileSync(new URL('docs/v3/blender-assets.json', root)));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sites = ['SITE_yihao', 'SITE_lanshu', 'SITE_yanchi'];
const separate = [
  ...Array.from({ length: 3 }, (_, i) => `Limestone_${i}_high`),
  ...Array.from({ length: 7 }, (_, i) => `Pond layered stone ${i}`),
  'PondStele', 'Taihu rock interpretation', 'V3 Terminalia low stone seats',
  'V3 Terminalia root garden broad leaves', 'V3 Terminalia terrace stone risers',
  'V3 Terminalia terrace with soil opening', 'V3 Terminalia three shallow approach steps',
  'V3 yihao continuous entrance forecourt', 'V3 yihao forecourt edge drainage',
  'V3 low tropical groundcover',
];
const near = (a, b, label) => assert.ok(Math.abs(a - b) < 2e-5, `${label}: ${a} != ${b}`);

function readGLB(name) {
  const bytes = readFileSync(new URL(name, assets));
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const jsonLength = bytes.readUInt32LE(12);
  assert.equal(bytes.toString('ascii', 16, 20), 'JSON');
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
  const binOffset = 20 + jsonLength;
  assert.equal(bytes.toString('ascii', binOffset + 4, binOffset + 8), 'BIN\0');
  assert.equal(binOffset + 8 + bytes.readUInt32LE(binOffset), bytes.length);
  return { bytes, gltf, bin: bytes.subarray(binOffset + 8) };
}

function counts(gltf) {
  const primitives = gltf.meshes.flatMap(mesh => mesh.primitives);
  return {
    nodes: gltf.nodes.length, meshes: gltf.meshes.length, primitives: primitives.length,
    materials: gltf.materials.length, images: gltf.images.length,
    vertices: primitives.reduce((sum, p) => sum + gltf.accessors[p.attributes.POSITION].count, 0),
    triangles: primitives.reduce((sum, p) => sum + gltf.accessors[p.indices].count / 3, 0),
  };
}

function nodeWorldPosition(gltf, name) {
  const target = gltf.nodes.findIndex(node => node.name === name);
  assert.ok(target >= 0, name);
  const parents = new Map(gltf.nodes.flatMap((node, i) => (node.children || []).map(child => [child, i])));
  let position = [0, 0, 0];
  for (let i = target; i !== undefined; i = parents.get(i)) {
    const node = gltf.nodes[i];
    assert.ok(!node.matrix, `${name} uses readable TRS transforms`);
    const [x, y, z, w] = node.rotation || [0, 0, 0, 1];
    const v = position.map((value, axis) => value * (node.scale || [1, 1, 1])[axis]);
    const cross = [y * v[2] - z * v[1], z * v[0] - x * v[2], x * v[1] - y * v[0]];
    const twice = cross.map(value => value * 2);
    const again = [y * twice[2] - z * twice[1], z * twice[0] - x * twice[2], x * twice[1] - y * twice[0]];
    position = v.map((value, axis) => value + w * twice[axis] + again[axis] + (node.translation || [0, 0, 0])[axis]);
  }
  return position;
}

test('manifest records current source fingerprints, UTC dates and actual R3 roofs', () => {
  const data = manifest();
  assert.equal(data.schemaVersion, 1);
  assert.match(data.source.sha256, /^[a-f0-9]{64}$/);
  for (const value of [data.source.modifiedUtc, data.exportedUtc]) {
    assert.match(value, /Z$/);
    assert.ok(Number.isFinite(Date.parse(value)));
  }
  assert.equal(data.source.preserved, true);
  if (existsSync(data.source.path)) {
    assert.equal(sha256(readFileSync(data.source.path)), data.source.sha256);
    assert.equal(statSync(data.source.path).mtime.toISOString(), data.source.modifiedUtc);
  }
  assert.equal(data.modelPhase.actual, 'R3');
  assert.ok(data.modelPhase.roofNodeNames.includes('V3 yihao roof central'));
  assert.ok(data.modelPhase.roofNodeNames.includes('V3 yihao roof entrance upper'));
  assert.ok(data.modelPhase.roofNodeNames.some(name => name.startsWith('V3 yihao white roof arris')));
  assert.equal(data.materials.colorSpace, 'linear');
});

test('all 34 source anchors retain legacy coordinates with the direct Y-up mapping', () => {
  const data = manifest();
  const campus = JSON.parse(readFileSync(new URL('public/haiz/assets/walk/campus.json', root)));
  assert.equal(data.anchors.length, 34);
  assert.equal(new Set(data.anchors.map(anchor => anchor.name)).size, 34);
  assert.deepEqual(data.anchors.map(anchor => anchor.name).sort(), campus.buildings.map(b => `SITE_${b.id}`).sort());
  for (const anchor of data.anchors) {
    const building = campus.buildings.find(b => `SITE_${b.id}` === anchor.name);
    const [x0, y0, x1, y1] = building.rect;
    near(anchor.gltf[0], ((x0 + x1) / 2 - 900) * .167, `${anchor.name}.x`);
    near(anchor.gltf[2], -((y0 + y1) / 2 - 784) * .167, `${anchor.name}.z`);
    assert.deepEqual(anchor.gltf, [anchor.blender[0], anchor.blender[2], -anchor.blender[1]]);
  }
});

for (const [tier, filename, textureLimit] of [['full', 'hero.glb', 512], ['mobile', 'hero-mobile.glb', 256]]) {
  test(`${tier} is a self-contained selected-only GLB with recorded size and geometry`, () => {
    const data = manifest();
    const { bytes, gltf, bin } = readGLB(filename);
    const record = data.assets[tier];
    assert.equal(record.file, filename);
    assert.equal(record.sha256, sha256(bytes));
    assert.equal(record.bytes, bytes.length);
    assert.ok(bytes.length > 1024);
    assert.deepEqual(record.counts, counts(gltf));
    assert.equal(record.textureMaxDimension, textureLimit);
    assert.equal(gltf.cameras?.length || 0, 0);
    assert.equal(gltf.animations?.length || 0, 0);
    assert.ok(!gltf.extensionsUsed?.includes('KHR_lights_punctual'));
    assert.equal(gltf.buffers.length, 1);
    assert.ok(!gltf.buffers[0].uri);
    assert.ok(gltf.buffers[0].byteLength <= bin.length);
    const names = gltf.nodes.map(node => node.name);
    assert.deepEqual(names.toSorted(), data.selection.nodeNames.toSorted());
    assert.deepEqual(names.filter(name => name.startsWith('SITE_')).sort(), sites.toSorted());
    const rootNames = gltf.scenes[gltf.scene || 0].nodes.map(index => gltf.nodes[index].name);
    assert.deepEqual(rootNames.toSorted(), [...sites, ...separate].toSorted());
    assert.ok(names.every(name => !/^(?:Ground|Road|V3 shared tropical vegetation|V3 (?:mixed|palm|banyan|terminalia) \d)/i.test(name)));
    for (const name of sites) {
      const expected = data.anchors.find(anchor => anchor.name === name).gltf;
      nodeWorldPosition(gltf, name).forEach((value, axis) => near(value, expected[axis], name));
    }
    for (const mesh of gltf.meshes) for (const p of mesh.primitives) {
      for (const name of ['POSITION', 'NORMAL', 'TEXCOORD_0']) assert.ok(Number.isInteger(p.attributes[name]), `${mesh.name}.${name}`);
      assert.equal(p.mode ?? 4, 4);
    }
    for (const image of gltf.images) {
      assert.ok(!image.uri);
      assert.equal(image.mimeType, 'image/png');
      const view = gltf.bufferViews[image.bufferView];
      const imageBytes = bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
      assert.equal(imageBytes.toString('ascii', 1, 4), 'PNG');
      assert.ok(imageBytes.readUInt32BE(16) <= textureLimit);
      assert.ok(imageBytes.readUInt32BE(20) <= textureLimit);
    }
    assert.ok(gltf.nodes.filter(node => !node.name.startsWith('SITE_')).some(node => node.extras));
  });
}

test('remaining campus, terrain and GPU planting come from the same current V3 source',()=>{
  const report=JSON.parse(readFileSync(new URL('docs/v3/campus-assets.json',root)));
  assert.equal(report.source.sha256,manifest().source.sha256);
  assert.equal(report.anchors.length,34);assert.equal(report.buildingIds.length,29);
  for(const record of Object.values(report.assets)){
    const {bytes,gltf}=readGLB(record.file);
    assert.equal(bytes.length,record.bytes);assert.equal(sha256(bytes),record.sha256);
    assert.ok(gltf.images.every(image=>!image.uri));
    assert.equal(gltf.animations?.length||0,0);
  }
  const planting=readGLB('planting.glb').gltf;
  assert.ok(planting.extensionsUsed.includes('EXT_mesh_gpu_instancing'));
  const instances=planting.nodes.filter(n=>n.extensions?.EXT_mesh_gpu_instancing).reduce((sum,n)=>sum+planting.accessors[Object.values(n.extensions.EXT_mesh_gpu_instancing.attributes)[0]].count,0);
  assert.equal(instances,642);
});

test('mobile simplifies only declared dense leaf meshes and retains architecture bytes', () => {
  const data = manifest();
  const full = readGLB('hero.glb'), mobile = readGLB('hero-mobile.glb');
  const changed = data.mobileReduction.nodeNames;
  assert.deepEqual(changed, ['V3 Terminalia layered crown']);
  assert.ok(data.assets.mobile.counts.triangles < data.assets.full.counts.triangles);
  assert.ok(data.assets.mobile.bytes < data.assets.full.bytes);
  const primitiveBytes = (asset, name) => {
    const mesh = asset.gltf.meshes[asset.gltf.nodes.find(node => node.name === name).mesh];
    return mesh.primitives.map(p => [p.indices, ...Object.values(p.attributes)].map(index => {
      const view = asset.gltf.bufferViews[asset.gltf.accessors[index].bufferView];
      return sha256(asset.bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength));
    }));
  };
  for (const node of full.gltf.nodes.filter(node => node.mesh !== undefined && !changed.includes(node.name))) {
    assert.deepEqual(primitiveBytes(full, node.name), primitiveBytes(mobile, node.name), node.name);
  }
});
