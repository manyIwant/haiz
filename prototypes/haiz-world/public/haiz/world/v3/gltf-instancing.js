/* EXT_mesh_gpu_instancing adapter for the retained Three.js r128 GLTFLoader.
   Algorithm follows Three.js GLTFLoader (MIT, mrdoob/three.js contributors).
   Keep instancing on the GPU; never expand a grove into hundreds of Meshes. */
(function (global) {
  'use strict';
  function extension(parser) {
    const T = global.THREE;
    return {
      name: 'EXT_mesh_gpu_instancing',
      createNodeMesh(index) {
        const node = parser.json.nodes[index];
        const definition = node.extensions?.EXT_mesh_gpu_instancing;
        if (!definition || node.mesh === undefined) return null;
        const entries = Object.entries(definition.attributes);
        return Promise.all([
          parser.getDependency('mesh', node.mesh),
          Promise.all(entries.map(([key, accessor]) => parser.getDependency('accessor', accessor).then(value => [key, value])))
        ]).then(([source, resolved]) => {
          const attributes = Object.fromEntries(resolved);
          const count = resolved[0]?.[1].count || 0;
          if (!count || resolved.some(([, value]) => value.count !== count)) throw new Error('Invalid Blender instance attributes');
          const group = new T.Group();
          const parts = source.isGroup ? source.children : [source];
          for (const part of parts) {
            if (!part.isMesh) continue;
            const mesh = new T.InstancedMesh(part.geometry, part.material, count);
            const matrix = new T.Matrix4(), position = new T.Vector3(), rotation = new T.Quaternion(), scale = new T.Vector3();
            for (let i = 0; i < count; i++) {
              position.set(0, 0, 0); rotation.set(0, 0, 0, 1); scale.set(1, 1, 1);
              if (attributes.TRANSLATION) position.fromBufferAttribute(attributes.TRANSLATION, i);
              if (attributes.ROTATION) rotation.fromBufferAttribute(attributes.ROTATION, i);
              if (attributes.SCALE) scale.fromBufferAttribute(attributes.SCALE, i);
              mesh.setMatrixAt(i, matrix.compose(position, rotation, scale));
            }
            mesh.position.copy(part.position); mesh.quaternion.copy(part.quaternion); mesh.scale.copy(part.scale);
            mesh.name = part.name;
            mesh.frustumCulled = false; // r128 bounds omit instance transforms.
            mesh.userData.noMerge = true;
            mesh.userData.blenderInstanceCount = count;
            group.add(mesh);
          }
          return group.children.length === 1 ? group.children[0] : group;
        });
      }
    };
  }
  global.HaizV3GLTF = { extension, createLoader() { return new global.THREE.GLTFLoader().register(extension); } };
})(window);
