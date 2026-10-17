const assert=require('node:assert'),fs=require('node:fs'),C=require('../assets/cinematic/descent-core.js');
const manifest=require('../assets/cinematic/aligned/manifest.json');
let last=C.frame(0);for(let i=1;i<=10000;i++){const f=C.frame(i/10000);assert(f.altitude<=last.altitude+.00001);assert(Number.isFinite(f.altitude)&&f.altitude>0);assert(f.model>=last.model&&f.arrival>=last.arrival);assert(Math.abs(f.arrival-last.arrival)<.002);last=f;}
assert(C.frame(0).model===0&&C.frame(1).model===1&&C.frame(1).arrival===1);assert.equal(manifest.targetCRS,'WGS84');assert.equal(manifest.sourceTarget.crs,'GCJ-02');
const R=6378137,x=R*manifest.target.lon*Math.PI/180,y=R*Math.log(Math.tan(Math.PI/4+manifest.target.lat*Math.PI/360));
for(const layer of manifest.layers){const [x0,y0,x1,y1]=layer.bounds;assert(Math.abs((x0+x1)/2-x)<.001);assert(Math.abs((y0+y1)/2-y)<.001);assert(fs.existsSync(layer.path));assert(fs.statSync(layer.path).size>10000);}
assert(Math.abs(manifest.target.lon-110.34261)<.001);assert(Math.abs(manifest.target.lat-19.99783)<.001);
console.log('PASS descent: monotone altitude, continuous blend/arrival, shared Mercator centre, coordinate-system correction and local imagery');
