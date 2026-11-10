// Run: node tests/descent-arrival-precision.test.cjs
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const app=read('assets/walk/app.js');
const from=app.indexOf('  function setArrivalProgress(value){');
const to=app.indexOf('  function takeArrivalControl(){',from);
assert.ok(from>=0&&to>from,'Arrival camera function must be present');
const src=app.slice(from,to);
const recorded={};
const pos=(name)=>({set:(...v)=>{recorded[name]=v;},updateMatrixWorld:()=>{}});
const camera={near:.08,fov:68,position:pos('camera'),lookAt:(...v)=>{recorded.lookAt=v;},updateProjectionMatrix:()=>{}};
const sun={position:pos('sun'),target:{position:pos('sunTarget'),updateMatrixWorld:()=>{}},updateMatrixWorld:()=>{}};
const world={buildings:[{data:{id:'beimen'},center:{x:10,z:-50}}],colliders:[],bounds:{}};
const init=new Function('camera','sun','world',
  'let arrivalMode=true,arrivalTaken=false,arrivalProgress=0,arrivalPoint=null,shadowCenter={},state={paused:false};'+
  'const M={safePoint:()=>({x:10,z:-63})};'+src+
  'return {setArrivalProgress,getProgress:()=>arrivalProgress}');
const {setArrivalProgress,getProgress}=init(camera,sun,world);
for(const t of [0,.25,.5,.75,.9,1]){
 setArrivalProgress(t);
 assert.ok(Math.abs(camera.near-(.08+2.5*(1-t)))<.001,'Depth range must depend on aerial height');
 assert.equal(getProgress(),t);
 assert.deepEqual(recorded.sunTarget,[10,0,-63],'Shadow target should not jump during descent');
 assert.deepEqual(recorded.sun,[-75,110,-128],'Sun should track the camera-space shadow target');
}
assert.ok(camera.near===.08,'First-person depth precision must be restored on arrival');
assert.ok(read('assets/cinematic/descent.css').includes('#campusFrame{border:0;opacity:0;pointer-events:none;transition:none'),
  'CSS animation must not fight with frame-by-frame JavaScript opacity');
assert.ok(app.includes('arrivalMode&&!arrivalTaken?true:'),'Model must not skip alternating arrival frames');
assert.ok(read('assets/cinematic/descent.js').includes('globeBucket!==lastGlobeBucket'),
  'Prefer smoother 3D model when both renders overlap');
console.log('Arrival depth range, fixed shadows, pre-render and synchronized fade verified.');
