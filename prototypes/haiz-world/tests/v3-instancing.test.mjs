import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const base = new URL('../public/haiz/', import.meta.url);
function harness() {
  const context = { console }; context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('assets/vendor/three.min.js', base), 'utf8'), context);
  vm.runInContext(fs.readFileSync(new URL('world/v3/gltf-instancing.js', base), 'utf8'), context);
  return context;
}
test('Blender GPU instances retain independent translations and scales', async () => {
  const c = harness(), T = c.THREE;
  const source = new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial());
  const accessors = [new T.Float32BufferAttribute([2,0,3,-5,0,8],3),new T.Float32BufferAttribute([1,1,1,2,3,2],3)];
  const parser = { json:{ nodes:[{mesh:0,extensions:{EXT_mesh_gpu_instancing:{attributes:{TRANSLATION:0,SCALE:1}}}}]},getDependency(type,index){return Promise.resolve(type==='mesh'?source:accessors[index]);} };
  const mesh = await c.HaizV3GLTF.extension(parser).createNodeMesh(0);
  assert.equal(mesh.isInstancedMesh,true); assert.equal(mesh.count,2);
  const m=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();
  mesh.getMatrixAt(1,m);m.decompose(p,q,s);
  assert.deepEqual([...p.toArray()],[-5,0,8]); assert.deepEqual([...s.toArray()],[2,3,2]);
  assert.equal(mesh.geometry,source.geometry); assert.equal(mesh.frustumCulled,false);
});
test('extension ignores regular nodes and rejects mismatched instance counts', async () => {
  const c=harness(),T=c.THREE,source=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial());
  assert.equal(c.HaizV3GLTF.extension({json:{nodes:[{mesh:0}]}}).createNodeMesh(0),null);
  const parser={json:{nodes:[{mesh:0,extensions:{EXT_mesh_gpu_instancing:{attributes:{TRANSLATION:0,SCALE:1}}}}]},getDependency(type,index){return Promise.resolve(type==='mesh'?source:new T.Float32BufferAttribute(index?[1,1,1]:[0,0,0,1,1,1],3));}};
  await assert.rejects(c.HaizV3GLTF.extension(parser).createNodeMesh(0),/Invalid Blender/);
});
