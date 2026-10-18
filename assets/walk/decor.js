/* Licensed Poly Haven / DGG plant adaptation. Creative set dressing, not a
   documented campus planting plan. Optional, local, distance-cullable asset. */
(()=>{'use strict';
let api,slots=[],status='pending',models=[];
function attach(value){if(api)return;api=value;api.scene.traverse(o=>{if(o.userData.openPlantSlot)slots.push({group:o,point:o.getWorldPosition(new THREE.Vector3()),proxy:o.children[0]});});}
function load(){
  if(status!=='pending'||!THREE.GLTFLoader||location.protocol==='file:')return;status='loading';
  new THREE.GLTFLoader().load('assets/walk/models/potted-plant.glb',gltf=>{
    const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    if(!Number.isFinite(size.y)||size.y<.01){status='failed';return;}
    const scale=2.35/size.y;
    gltf.scene.traverse(o=>{if(!o.isMesh)return;o.castShadow=o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.envMapIntensity=.4;for(const key of ['map','normalMap','roughnessMap','aoMap'])if(m[key])m[key].anisotropy=Math.min(8,api.renderer.capabilities.getMaxAnisotropy());}});
    for(const slot of slots){const plant=gltf.scene.clone(true);plant.scale.setScalar(scale);plant.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);plant.userData.openLicensedPlant=true;slot.group.add(plant);slot.proxy.visible=false;slot.plant=plant;models.push(plant);
      const soil=new THREE.Mesh(new THREE.CircleGeometry(.36,24),new THREE.MeshStandardMaterial({color:new THREE.Color('#343c2d').convertSRGBToLinear(),roughness:1}));soil.rotation.x=-Math.PI/2;soil.position.y=.62;slot.group.add(soil);}
    status='ready';tick();
  },undefined,()=>{status='failed';});
}
function tick(){if(!api?.state.started)return;const p=api.state.pos,quality=api.state.effectiveQuality;
  if(status==='pending'&&quality!=='low'&&slots.some(s=>Math.hypot(s.point.x-p.x,s.point.z-p.z)<75))load();
  if(status!=='ready')return;
  for(const s of slots){const visible=quality!=='low'&&Math.hypot(s.point.x-p.x,s.point.z-p.z)<75;s.plant.visible=visible;s.proxy.visible=!visible;}
}
window.CampusDecor={attach,tick,get status(){return status;},get count(){return models.length;}};
})();
