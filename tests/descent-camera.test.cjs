// Run: node tests/descent-camera.test.cjs
'use strict';
const assert=require('node:assert/strict');
const {frame,composition}=require('../assets/cinematic/descent-core.js');
const EARTH=6371000,OPENING=48000000;
assert.ok(Math.abs(frame(0).altitude-OPENING)<1,'Opening must be a distant globe shot');
assert.ok(Math.abs(frame(1).altitude-350)<1,'Arrival must keep the gate camera transition');
for(const aspect of [.45,.56,1,1.6,1.78,2.2]){
  const diskRadiusY=Math.tan(Math.asin(EARTH/(EARTH+frame(0).altitude)))/.364;
  const diskRadiusX=diskRadiusY/aspect;
  const shift=composition(0,aspect).shiftX;
  assert.ok(shift>=0&&diskRadiusX+shift<.91,'Entire globe must fit on screen width: '+aspect);
  assert.ok(diskRadiusY<.91,'Entire globe must fit vertically: '+aspect);
  assert.equal(composition(.30,aspect).shiftX,0,'Camera must be centered before regional imagery');
}
for(let i=1;i<=1000;i++)assert.ok(frame(i/1000).altitude<=frame((i-1)/1000).altitude,'Altitude must descend continuously');
console.log('Descent framing verified for landscape and portrait screens');
