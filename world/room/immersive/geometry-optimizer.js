/* HAIZ INNER WORLD - original static-geometry batching and grounded contact shading. */
(function(root){
  'use strict';
  function batchBoxes(scene, THREE, threshold=2){
    scene.updateMatrixWorld(true);
    const buckets=new Map();
    scene.traverse(mesh=>{
      if(!mesh.isMesh||mesh.isInstancedMesh||!mesh.geometry?.isBoxGeometry)return;
      if(!mesh.visible||!mesh.material||Array.isArray(mesh.material)||mesh.material.transparent||mesh.material.opacity<1)return;
      if(mesh.userData?.lamp||mesh.userData?.dynamic||mesh.onBeforeRender!==THREE.Mesh.prototype.onBeforeRender)return;
      const p=mesh.geometry.parameters;
      if(!p||![p.width,p.height,p.depth].every(n=>Number.isFinite(n)&&n>0))return;
      const key=[mesh.material.uuid,mesh.castShadow?1:0,mesh.receiveShadow?1:0,mesh.renderOrder].join(':');
      if(!buckets.has(key))buckets.set(key,[]);
      buckets.get(key).push(mesh);
    });
    let instances=0,drawCallsSaved=0,batches=0;
    const unit=new THREE.BoxGeometry(1,1,1);
    const scale=new THREE.Matrix4();
    for(const meshes of buckets.values()){
      if(meshes.length<threshold)continue;
      const exemplar=meshes[0];
      const cluster=new THREE.InstancedMesh(unit,exemplar.material,meshes.length);
      cluster.name='HAIZ static architectural instances';
      cluster.castShadow=exemplar.castShadow;
      cluster.receiveShadow=exemplar.receiveShadow;
      cluster.renderOrder=exemplar.renderOrder;
      cluster.frustumCulled=false;
      cluster.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      meshes.forEach((mesh,i)=>{
        const p=mesh.geometry.parameters;
        scale.makeScale(p.width,p.height,p.depth);
        cluster.setMatrixAt(i,mesh.matrixWorld.clone().multiply(scale));
        mesh.parent.remove(mesh);
        mesh.geometry.dispose();
      });
      cluster.instanceMatrix.needsUpdate=true;
      scene.add(cluster);
      batches++;instances+=meshes.length;drawCallsSaved+=meshes.length-1;
    }
    if(!batches)unit.dispose();
    return {batches,instances,drawCallsSaved};
  }
  function addContactShadows(scene,THREE,deskCenters){
    if(!deskCenters.length)return null;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    const context=canvas.getContext('2d');
    const gradient=context.createRadialGradient(64,64,5,64,64,61);
    gradient.addColorStop(0,'rgba(0,0,0,.56)');
    gradient.addColorStop(.46,'rgba(0,0,0,.28)');
    gradient.addColorStop(1,'rgba(0,0,0,0)');
    context.fillStyle=gradient;context.fillRect(0,0,128,128);
    const tex=new THREE.CanvasTexture(canvas);
    const mat=new THREE.MeshBasicMaterial({
      map:tex,transparent:true,depthWrite:false,opacity:.53,
      color:'#1b2520',side:THREE.DoubleSide,toneMapped:false
    });
    const cluster=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),mat,deskCenters.length);
    const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
    const position=new THREE.Vector3(),size=new THREE.Vector3(2.2,1.65,1);
    const matrix=new THREE.Matrix4();
    deskCenters.forEach((d,i)=>{
      position.set(d.x,.004,d.z+.3);
      matrix.compose(position,rotation,size);
      cluster.setMatrixAt(i,matrix);
    });
    cluster.frustumCulled=false;
    cluster.renderOrder=4;
    cluster.instanceMatrix.needsUpdate=true;
    scene.add(cluster);
    return cluster;
  }
  root.HAIZRoomGeometry=Object.freeze({batchBoxes,addContactShadows});
})(typeof window!=='undefined'?window:globalThis);
