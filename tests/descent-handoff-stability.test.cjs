// node tests/descent-handoff-stability.test.cjs
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {frame}=require('../assets/cinematic/descent-core.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const epsilon=1e-9;
for(let i=0;i<=1000;i++){
 const p=i/1000,f=frame(p);
 assert.ok(f.model>=0&&f.model<=1&&f.arrival>=0&&f.arrival<=1);
 assert.ok(f.arrival<epsilon||f.model>1-epsilon,
   'Satellite/model crossfade must finish before the 3D camera moves: '+p);
 if(i){const last=frame((i-1)/1000);
  assert.ok(f.model>=last.model&&f.arrival>=last.arrival);
  assert.ok(f.altitude<=last.altitude);
 }
}
assert.ok(frame(.78).model<epsilon&&frame(.78).arrival<epsilon);
assert.ok(frame(.82).model>0&&frame(.82).model<1&&frame(.82).arrival<epsilon);
assert.ok(frame(.85).model>1-epsilon&&frame(.85).arrival<epsilon);
assert.ok(frame(1).model>1-epsilon&&frame(1).arrival>1-epsilon);
const world=read('assets/walk/world.js');
assert.match(world,/\(data\.roads \|\| \[\]\)\.forEach\(function \(R, roadIndex\)/);
assert.match(world,/mat\.polygonOffset=true/);
assert.match(world,/mat\.polygonOffsetUnits=-\(roadIndex\+1\)\*2/);
const cinematic=read('assets/cinematic/descent.js');
assert.match(cinematic,/get\('preview'\)==='arrival'/);
assert.match(read('descent.html'),/descent-core\.js\?v=10/);
assert.match(read('campus-3d.html'),/world\.js\?v=26/);
assert.match(read('campus-3d.html'),/app\.js\?v=28/);
const app=read('assets/walk/app.js');
assert.match(app,/renderer\.shadowMap\.autoUpdate=false/);
assert.match(app,/renderer\.shadowMap\.autoUpdate=true/);
console.log('OK: stable crossfade before camera motion and ordered coplanar roads');
