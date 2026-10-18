/* Uses the official Three.js r128 Water addon, MIT; see assets/vendor/THREE-LICENSE.txt. */
(function(root){'use strict';
function create(scene,camera,sun,world,reduced){
 const surface=world.waterSurface;
 if(!surface||!THREE.Water)return {tick(){},get active(){return false;}};
 const water=new THREE.Water(surface.geometry.clone(),{textureWidth:256,textureHeight:256,
  waterNormals:world.water.normalMap,sunDirection:sun.position.clone().normalize(),
  sunColor:0xffefcf,waterColor:0x45665d,distortionScale:.45,alpha:1,fog:true});
 water.position.copy(surface.position);water.rotation.copy(surface.rotation);water.visible=false;
 surface.parent.add(water);let active=false,time=0;
 return {tick(dt,quality,indoors,paused){
  const pos=new THREE.Vector3();surface.getWorldPosition(pos);
  active=quality!=='low'&&!indoors&&Math.hypot(pos.x-camera.position.x,pos.z-camera.position.z)<55;
  water.visible=active;surface.visible=!active;
  if(!reduced&&!paused)time+=dt*.23;
  const u=water.material.uniforms;u.time.value=time;
  u.sunDirection.value.copy(sun.position).sub(sun.target.position).normalize();u.sunColor.value.copy(sun.color);
  u.waterColor.value.copy(world.water.color);u.distortionScale.value=reduced?.2:.35+(world.water.userData.climateRain||0)*.55;
 },get active(){return active;}};
}
root.CampusReflections={create};
})(window);
