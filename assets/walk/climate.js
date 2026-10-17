/* Deterministic climate studies, not a live weather service. No external requests. */
(function(root){'use strict';
const presets={
 morning:{name:'晨光',top:'#83b6c4',bottom:'#eee3c8',fog:'#d6ddd0',near:170,far:520,sun:'#ffe3ad',power:1.7,hemi:.82,ambient:.24,exposure:1.08,offset:[-100,65,-55],wet:0,water:'#537d75'},
 afterrain:{name:'雨后',top:'#839da8',bottom:'#ccd7d2',fog:'#b6c9c5',near:105,far:400,sun:'#e6f2ed',power:.85,hemi:.92,ambient:.30,exposure:1.03,offset:[-85,100,-65],wet:1,water:'#456d70'},
 dusk:{name:'薄暮',top:'#7c8fa9',bottom:'#e4bca1',fog:'#aeb3bc',near:170,far:490,sun:'#ffc894',power:.95,hemi:.58,ambient:.24,exposure:1.12,offset:[105,28,25],wet:0,water:'#667786'}
};
function create(scene,sky,sun,hemi,ambient,world,reduced){
 const roads=[...new Set(world.roadMaterials||[])].map(m=>({m,color:m.color.clone(),rough:m.roughness}));
 let current='morning',time=0,target=presets[current],wet=0,exposure=target.exposure,offset=target.offset.slice();
 // A small repeating normal map: surface ripples, not floating particles.
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d'),img=c.createImageData(128,128);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){let i=(y*128+x)*4;img.data[i]=128+Math.sin(x*Math.PI/16+y*Math.PI/32)*20;img.data[i+1]=128+Math.cos(y*Math.PI/16-x*Math.PI/32)*20;img.data[i+2]=251;img.data[i+3]=255;}c.putImageData(img,0,0);
 const normal=new THREE.CanvasTexture(canvas);normal.wrapS=normal.wrapT=THREE.RepeatWrapping;normal.repeat.set(7,9);
 if(world.water){world.water.normalMap=normal;world.water.normalScale.set(.19,.19);world.water.needsUpdate=true;}
 const colors={};for(const [id,p] of Object.entries(presets)){colors[id]={};for(const key of ['top','bottom','fog','sun','water'])colors[id][key]=new THREE.Color(p[key]);}
 function tick(dt,indoors,paused=false){
  time+=paused?0:dt;const t=reduced?1:Math.min(1,dt*1.1),col=colors[current];
  const su=sky.material.uniforms;
  if(su.top){su.top.value.lerp(col.top,t);su.bottom.value.lerp(col.bottom,t);}
  scene.fog.color.lerp(col.fog,t);scene.background.copy(scene.fog.color);scene.fog.near+=(target.near-scene.fog.near)*t;scene.fog.far+=(target.far-scene.fog.far)*t;
  sun.color.lerp(col.sun,t);sun.intensity+=(target.power-sun.intensity)*t;hemi.intensity+=(target.hemi-hemi.intensity)*t;ambient.intensity+=(target.ambient-ambient.intensity)*t;
  wet+=(target.wet-wet)*t;exposure+=((indoors?1.28:target.exposure)-exposure)*t;
  for(let i=0;i<3;i++)offset[i]+=(target.offset[i]-offset[i])*t;
  sun.position.set(sun.target.position.x+offset[0],offset[1],sun.target.position.z+offset[2]);
  if(su.sunPosition){su.sunPosition.value.set(offset[0],offset[1],offset[2]);su.turbidity.value=3+wet*5;su.rayleigh.value=1.8;su.mieCoefficient.value=.005+wet*.01;su.mieDirectionalG.value=.8;}
  roads.forEach(({m,color,rough})=>{m.color.copy(color).multiplyScalar(1-wet*.22);m.roughness=rough*(1-wet)+.28*wet;});
  if(world.water){world.water.color.lerp(col.water,t);if(!reduced){normal.offset.set(time*.007,time*.003);}world.water.normalScale.set(.15+wet*.07,.15+wet*.07);}
  return exposure;
 }
 return {select(id){if(!presets[id])return false;current=id;target=presets[id];return true;},tick,get current(){return current;},presets};
}
root.CampusClimate={create,presets};
})(window);
