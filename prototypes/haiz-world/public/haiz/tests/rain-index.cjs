const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),THREE=require('../assets/vendor/three.min.js'),{createCanvas}=require('@napi-rs/canvas');
const window={};vm.runInNewContext(fs.readFileSync('assets/walk/climate.js','utf8'),{window,THREE,document:{createElement:()=>createCanvas(128,128)}});
const C=window.CampusClimate;let seed=1923;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const shelters=Array.from({length:500},()=>{const a=random()*Math.PI*2;return {x:random()*600-300,z:random()*600-300,w:2+random()*20,d:2+random()*20,cos:Math.cos(a),sin:Math.sin(a),top:3+random()*30};});
const oldUnderRoof=(list,x,y,z)=>list.some(s=>{const dx=x-s.x,dz=z-s.z;return y<s.top&&Math.abs(dx*s.cos-dz*s.sin)<s.w&&Math.abs(dx*s.sin+dz*s.cos)<s.d;});
const index=C.shelterIndex(shelters);let comparisons=0;
for(let i=0;i<12000;i++){const x=random()*720-360,z=random()*720-360,y=random()*40;assert.equal(y<index.height(x,z),oldUnderRoof(shelters,x,y,z));comparisons++;}
for(const s of shelters)for(const e of [-1e-8,0,1e-8])for(const side of [-1,1]){
  const x=s.x+(s.w+e)*side*s.cos,z=s.z-(s.w+e)*side*s.sin;
  for(const y of [s.top-1e-8,s.top,s.top+1e-8]){assert.equal(y<index.height(x,z),oldUnderRoof(shelters,x,y,z));comparisons++;}
}
assert(index.diagnostics.tests<comparisons*shelters.length/8,'broad phase must substantially reduce candidates');
const scene=new THREE.Scene();scene.fog=new THREE.Fog('#cccccc',100,500);scene.background=new THREE.Color();
const buildings=shelters.slice(0,60).map((s,i)=>{const group=new THREE.Group();group.add(new THREE.Mesh(new THREE.BoxGeometry(s.w*2-1,s.top,s.d*2-1),new THREE.MeshBasicMaterial()));group.position.set(s.x,s.top/2,s.z);group.rotation.y=Math.atan2(s.sin,s.cos);return {group,center:{x:s.x,z:s.z},data:{id:'roof'+i,form:'academic',rot:Math.atan2(s.sin,s.cos),size:[s.w*2-1,s.top,s.d*2-1]}};});
const camera=new THREE.PerspectiveCamera();camera.position.set(0,1.85,0);let quality='high';
const api=C.create(scene,{material:{uniforms:{top:{value:new THREE.Color()},bottom:{value:new THREE.Color()}}}},new THREE.DirectionalLight(),new THREE.HemisphereLight(),new THREE.AmbientLight(),{buildings,roadMaterials:[]},false,{camera,quality:()=>quality});
const rainField=scene.getObjectByName('Local tropical rain');
function checkRain(){
  const d=api.diagnostics,p=[],px=camera.position.x,pz=camera.position.z,py=camera.position.y-4;
  if(rainField.visible)for(let i=0;i<d.rainBudget;i++){
    const a=i*2.399963,r=3+Math.sqrt((i*.6180339887)%1)*17,fall=(((i*3.713-d.time*(10+d.rain*8))%20)+20)%20,x=px+Math.cos(a)*r,z=pz+Math.sin(a)*r,y=py+fall;
    if(y<0||oldUnderRoof(shelters.slice(0,60),x,y,z))continue;p.push(x,y,z,x-.1-d.rain*.1,y+.5+d.rain*.6,z+.08);
  }
  assert.equal(d.rainCount,p.length/6);const actual=rainField.geometry.attributes.position.array,expected=new Float32Array(p);assert(Buffer.from(actual.buffer,actual.byteOffset,p.length*4).equals(Buffer.from(expected.buffer)),'active rain vertex bytes must match the original algorithm');
}
api.setWeather({rain:1,wet:1,cloud:1});api.tick(5,false);checkRain();
const before=api.diagnostics.roofLookup.queries,time=api.diagnostics.time;
for(let i=0;i<240;i++){camera.rotation.y+=.03;camera.position.y=1.85+Math.sin(i)*.02;api.tick(1/60,false);checkRain();}
assert.equal(api.diagnostics.roofLookup.queries,before,'stationary XZ should reuse exact roof heights while rain and camera heading animate');assert(api.diagnostics.time>time+3.9);
for(let i=0;i<180;i++){camera.position.set(Math.sin(i*.1)*200,1.85,Math.cos(i*.1)*200);api.tick(1/60,false);checkRain();}
quality='low';api.tick(0,false);checkRain();assert.equal(api.diagnostics.rainBudget,48);quality='high';api.tick(0,false);checkRain();
api.setWeather({rain:.2});api.tick(5,false);checkRain();api.setWeather({rain:1});api.tick(5,false);checkRain();
api.tick(1,true);checkRain();assert.equal(api.diagnostics.rainCount,0);api.tick(0,false);checkRain();
const report={date:new Date().toISOString(),passed:true,roofComparisons:comparisons,spatialIndex:index.diagnostics,stationaryFrames:240,additionalStationaryQueries:0,movingFrames:180,exactRainBuffers:true,limits:'Exact rotated-footprint algorithm parity, not physical roof accuracy or hardware FPS.'};fs.writeFileSync('tests/rain-index-results.json',JSON.stringify(report,null,2)+'\n');console.log(report);
