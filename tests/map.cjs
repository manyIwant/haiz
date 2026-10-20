const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{createCanvas}=require('@napi-rs/canvas');
const data=JSON.parse(fs.readFileSync('assets/walk/campus.json')),t=data.meta.transform;
const rectWorld=r=>({x:((r[0]+r[2])/2-t.originPx[0])*t.scale,z:-((r[1]+r[3])/2-t.originPx[1])*t.scale,w:(r[2]-r[0])*t.scale,d:(r[3]-r[1])*t.scale});
const context={window:{},document:{createElement:()=>createCanvas(1,1)}};vm.createContext(context);for(const file of ['atlas-details.js','map.js'])vm.runInContext(fs.readFileSync('assets/walk/'+file,'utf8'),context);
const world={rectWorld,buildings:data.buildings.map(b=>({data:b,center:rectWorld(b.rect)}))};
const evidence=[];
for(const [size,large]of [[360,false],[1000,true]]){
  const cached=createCanvas(size,size),fresh=createCanvas(size,size),map=context.window.CampusMap.create(data,world,[{id:'beimen',tag:'01'}]);
  const read=c=>Buffer.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data);let previous;
  for(const [x,z,yaw]of [[0,0,0],[-90,-24,1.4],[13,-172,Math.PI],[74,65,-.7]]){
    map.draw(cached,large,{x,z},yaw);map.draw(fresh,large,{x,z},yaw,{fresh:true});assert(read(cached).equals(read(fresh)),'cached and fresh map must match exactly');
    const current=read(cached);if(previous)assert(!previous.equals(current),'position arrow must update');previous=current;
  }
  assert.equal(map.diagnostics.staticBuilds,1);
  const before=map.diagnostics.blits;for(let i=0;i<100;i++)map.draw(cached,large,{x:74,z:65},-.7);
  assert.equal(map.diagnostics.blits,before);assert.equal(map.diagnostics.skipped,100);
  const start=performance.now();for(let i=0;i<60;i++)map.draw(cached,large,{x:i,z:0},i*.1);const cachedMs=performance.now()-start;
  const directStart=performance.now();for(let i=0;i<60;i++)map.draw(fresh,large,{x:i,z:0},i*.1,{fresh:true});const uncachedMs=performance.now()-directStart;
  cached.width=cached.height=size+20;map.draw(cached,large,{x:0,z:0},0);assert.equal(map.diagnostics.staticBuilds,2,'resize invalidates cache');map.invalidate();map.draw(cached,large,{x:0,z:0},0);assert.equal(map.diagnostics.staticBuilds,3);
  evidence.push({size,large,exactPixelMatch:true,unchangedFramesSkipped:100,cachedMs,uncachedMs});
}
assert.equal(data.sports.length,2);assert.equal(data.sports[0].grid[0]*data.sports[0].grid[1],6);
for(const area of data.sports)assert.deepEqual(area.rect,data.lawns.find(l=>l.id===area.sourceLawn).rect);
const report={date:new Date().toISOString(),passed:true,evidence,limits:'Native Canvas2D CPU timing, not browser or mobile FPS. Footprints are retained legacy data; volleyball count is explicitly inferred.'};fs.writeFileSync('tests/map-results.json',JSON.stringify(report,null,2)+'\n');console.log(report);
