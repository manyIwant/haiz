// Real GLB decoding, LOD/material behavior and accessible photo comparison.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=process.cwd(),dir='tests/artifacts',errors=[],evidence=[];
const manifest=JSON.parse(fs.readFileSync('assets/walk/models/campus-limestone.json'));
const bytes=fs.readFileSync('assets/walk/models/campus-limestone.glb');
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),manifest.sha256);
assert.equal(bytes.readUInt32LE(8),bytes.length);
const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
assert(!gltf.extensionsRequired?.length,'model must decode without external compression libraries');
assert(gltf.materials.some(m=>m.normalTexture&&m.occlusionTexture&&m.pbrMetallicRoughness.metallicRoughnessTexture));
assert(gltf.nodes.some(n=>n.name==='PondStele'));
assert(manifest.variants.filter(v=>v.name.endsWith('_low')).every(v=>v.triangles<350));
for(const accessor of gltf.accessors){assert(accessor.count>0);for(const value of [...accessor.min||[],...accessor.max||[]])assert(Number.isFinite(value));}
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(b);});});
let browser;
async function render(page,climate='morning',quality='high'){
  return page.evaluate(({climate,quality})=>{
    const a=haizWalk;a.state.effectiveQuality=quality;a.climate.select(climate);
    a.renderer.toneMappingExposure=a.climate.tick(5,false,true);
    CampusLandscape.tick(a.camera,quality,a.climate.diagnostics.wet);
    a.reflections.tick(0,quality,false,true);a.renderer.render(a.scene,a.camera);
    let visibleStoneTriangles=0,engraved=0,palms=0,glazing=0;
    a.scene.traverse(o=>{if(o.userData.pondInscription)engraved++;if(o.userData.botanicalPalm)palms++;
      if(o.material?.userData.facadeGlazing)glazing++;
      if(o.userData.limestoneLOD&&o.parent.visible&&o.parent.parent.userData.id==='yanchi'){visibleStoneTriangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*o.count;
        if(!o.material.normalMap||!o.material.roughnessMap||!o.material.aoMap)throw Error('Missing baked PBR channel');
        for(const key of ['position','normal','uv'])if(!Array.from(o.geometry.attributes[key].array).every(Number.isFinite))throw Error('Non-finite landscape geometry');}
    });
    return {climate,quality,...CampusLandscape.diagnostics,visibleStoneTriangles,engraved,palms,glazing,position:{...a.state.pos},drawCalls:a.renderer.info.render.calls,triangles:a.renderer.info.render.triangles};
  },{climate,quality});
}
(async()=>{
  fs.mkdirSync(dir,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(120000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await page.goto(base+'/campus-3d.html?focus=yanchi&observe=1');await page.waitForFunction(()=>window.haizWalk);
  await page.click('#enterButton');await page.waitForFunction(()=>getComputedStyle(document.getElementById('intro')).opacity==='0');
  // A paused visual inspection advances frames explicitly; actual shaders still run.
  await page.evaluate(()=>{haizWalk.pause(null);window.requestAnimationFrame=()=>0;haizWalk.goTo('yanchi',false);});
  const high=await render(page);assert.equal(high.assetStatus,'ready');assert.equal(high.variants,6);assert.equal(high.engraved,1);assert(high.palms>3&&high.glazing>0&&high.highDetail);
  evidence.push(high);await page.screenshot({path:dir+'/landscape-pond-morning.png'});console.log('PASS Blender GLB, engraved stone, feathered palms and actual PBR render');
  const low=await render(page,'morning','low');assert(low.visibleStoneTriangles<high.visibleStoneTriangles*.2);assert.equal(low.highDetail,false);evidence.push(low);
  await page.screenshot({path:dir+'/landscape-pond-low.png'});console.log('PASS live low-detail stone geometry and reflection fallback');
  evidence.push(await render(page,'afterrain'));await page.screenshot({path:dir+'/landscape-pond-rain.png'});
  await page.evaluate(()=>{haizWalk.goTo('fengqitang',false);haizWalk.pause(null);});await render(page);await page.screenshot({path:dir+'/landscape-hall.png'});
  await page.evaluate(()=>{haizWalk.goTo('yihao',false);haizWalk.pause(null);});await render(page);await page.screenshot({path:dir+'/landscape-teaching.png'});
  await page.evaluate(()=>{haizWalk.goTo('kexue',false);haizWalk.pause(null);});await render(page);await page.screenshot({path:dir+'/landscape-science.png'});
  await page.evaluate(()=>{haizWalk.goTo('yanchi',false);haizWalk.resume(false);CampusReview.open();});
  await page.getByRole('button',{name:'砚池',exact:true}).click();await page.click('#referenceCompare');
  assert(await page.locator('#referenceRender').isVisible());assert(await page.locator('#referenceRender').evaluate(i=>i.complete&&i.naturalWidth>0));
  await page.screenshot({path:dir+'/landscape-comparison-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert(await page.locator('#referenceDialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1));
  await page.screenshot({path:dir+'/landscape-comparison-mobile.png'});
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>haizWalk.state.paused),false);
  console.log('PASS reference/model comparison, 390px layout and modal state restoration');
  assert.deepEqual(errors,[]);
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:'reduce'});
  const fallback=await mobile.newPage();fallback.setDefaultTimeout(120000);const fallbackErrors=[];
  fallback.on('pageerror',e=>fallbackErrors.push(e.message));
  await fallback.route('**/campus-limestone.glb',route=>route.abort());
  await fallback.goto(base+'/campus-3d.html?focus=yanchi&observe=1');await fallback.waitForFunction(()=>window.haizWalk);
  await fallback.locator('#enterButton').tap();await fallback.evaluate(()=>{haizWalk.pause(null);window.requestAnimationFrame=()=>0;});
  assert.equal(await fallback.evaluate(()=>CampusLandscape.diagnostics.assetStatus),'fallback');
  assert.equal(await fallback.evaluate(()=>haizWalk.state.started),true);
  await fallback.evaluate(()=>{haizWalk.resume(false);CampusReview.open();});await fallback.getByRole('button',{name:'砚池',exact:true}).tap();await fallback.locator('#referenceCompare').tap();
  assert(await fallback.locator('#referenceRender').isVisible());assert.deepEqual(fallbackErrors,[]);
  await fallback.screenshot({path:dir+'/landscape-touch-fallback.png'});
  console.log('PASS touch/reduced-motion startup and comparison with the GLB unavailable');
  const report={date:new Date().toISOString(),passed:true,asset:manifest.sha256,bytes:bytes.length,evidence,errors,fallbackErrors,checks:['GLB integrity and portable PBR','engraved geometry, palms and real WebGL shaders','runtime LOD reduces pond stone triangles by over 80%','morning/afterrain and architecture screenshots','desktop/mobile photo comparison and modal state','real touch-emulated fallback with model request blocked'],limits:'Software WebGL and emulated touch. Geometry and lighting remain photo-informed approximations, not camera-calibrated photogrammetry or real-device FPS validation.'};
  fs.writeFileSync('tests/landscape-browser-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
