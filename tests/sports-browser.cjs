// Real WebGL/canvas and responsive-map checks. SwiftShader is not device FPS.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=process.cwd(),errors=[],failedRequests=[];let browser;
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(b);});
});
function observe(page){page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)failedRequests.push(r.status()+' '+r.url());});}
(async()=>{
  fs.mkdirSync('tests/artifacts',{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(120000);observe(page);
  await page.goto(base+'/campus-3d.html?focus=yundong&observe=1');await page.waitForFunction(()=>window.haizWalk);await page.click('#enterButton');await page.waitForFunction(()=>getComputedStyle(document.getElementById('intro')).visibility==='hidden');
  await page.evaluate(()=>{haizWalk.pause(null);window.requestAnimationFrame=()=>0;});
  const evidence=await page.evaluate(()=>{
    const a=haizWalk;a.climate.select('morning');a.renderer.toneMappingExposure=a.climate.tick(5,false,true);
    const areas=a.world.sports.map(area=>{
      let meshes=0,netBatches=0;area.group.traverse(o=>{if(o.isMesh)meshes++;if(o.material?.alphaTest>0&&o.material?.map)netBatches++;});
      const box=new THREE.Box3().setFromObject(area.group),c=area.center;
      return {id:area.data.id,courts:area.courts.length,hoops:area.group.userData.hoops||0,meshes,netBatches,insideFootprint:box.min.x>=c.x-c.w/2-.01&&box.max.x<=c.x+c.w/2+.01&&box.min.z>=c.z-c.d/2-.01&&box.max.z<=c.z+c.d/2+.01,clearCourts:area.courts.every(p=>!CampusMotion.blocked(p.x,p.z+3,a.world.colliders,a.world.bounds))};
    });
    const mapChecks=[];
    for(const [size,large]of [[360,false],[1000,true]]){
      const cached=document.createElement('canvas'),fresh=document.createElement('canvas');cached.width=cached.height=fresh.width=fresh.height=size;
      const read=c=>c.getContext('2d').getImageData(0,0,size,size).data;let differences=0,arrowUpdates=0,previous;
      for(const [x,z,yaw]of [[0,0,0],[-90,-24,1.4],[13,-172,Math.PI],[74,65,-.7]]){
        a.map.draw(cached,large,{x,z},yaw);a.map.draw(fresh,large,{x,z},yaw,{fresh:true});const one=read(cached),two=read(fresh);
        for(let i=0;i<one.length;i++)if(one[i]!==two[i])differences++;
        if(previous&&one.some((v,i)=>v!==previous[i]))arrowUpdates++;previous=one;
      }
      const before=a.map.diagnostics;for(let i=0;i<100;i++)a.map.draw(cached,large,{x:74,z:65},-.7);
      mapChecks.push({size,large,differences,arrowUpdates,skipped:a.map.diagnostics.skipped-before.skipped,additionalBlits:a.map.diagnostics.blits-before.blits});
    }
    return {areas,mapChecks,pixelRatio:a.renderer.getPixelRatio(),shadowSize:a.scene.children.find(o=>o.isDirectionalLight).shadow.mapSize.x};
  });
  assert.equal(evidence.areas.length,2);assert.equal(evidence.areas[0].courts,6);assert.equal(evidence.areas[0].hoops,12);assert.equal(evidence.areas[1].courts,3);
  for(const area of evidence.areas){assert(area.insideFootprint);assert(area.clearCourts);assert(area.meshes<12);assert.equal(area.netBatches,1);}
  for(const map of evidence.mapChecks){assert.equal(map.differences,0);assert.equal(map.arrowUpdates,3);assert.equal(map.skipped,100);assert.equal(map.additionalBlits,0);}
  await page.evaluate(()=>{
    const a=haizWalk,b=a.world.sports[0].center,c=a.camera.clone();c.position.set(b.x+66,95,b.z+85);c.lookAt(b.x,0,b.z-15);c.fov=52;c.updateProjectionMatrix();a.renderer.render(a.scene,c);
  });await page.screenshot({path:'tests/artifacts/sports-overview.png'});
  await page.evaluate(()=>{
    const a=haizWalk,b=a.world.sports[0].center,c=a.camera.clone();c.position.set(b.x+b.w/2-2,1.7,b.z+b.d/2-2);c.lookAt(b.x-8,2.4,b.z-15);c.fov=64;c.updateProjectionMatrix();a.renderer.render(a.scene,c);
  });await page.screenshot({path:'tests/artifacts/sports-ground.png'});
  await page.evaluate(()=>{const a=haizWalk;a.climate.select('afterrain');a.renderer.toneMappingExposure=a.climate.tick(5,false,true);a.reflections.tick(0,a.state.effectiveQuality,false,true);a.renderer.render(a.scene,a.camera);});
  await page.setViewportSize({width:390,height:844});await page.click('#mapButton');assert(await page.locator('#mapDialog').isVisible());assert(await page.locator('#mapDialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1));
  await page.screenshot({path:'tests/artifacts/sports-map-mobile.png'});
  await page.locator('#mapDialog [data-close]').click();assert.equal(await page.locator('#mapDialog').evaluate(d=>d.open),false);
  // Use a real touch-enabled context for the two static maps and their controls.
  const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'}),mapPage=await mobile.newPage();observe(mapPage);
  for(const [file,selector]of [['director.html','#directorMap'],['about.html','#campusAtlas']]){
    await mapPage.goto(base+'/'+file);await mapPage.waitForSelector(selector+' [data-sports-area]');assert.equal(await mapPage.locator(selector+' [data-sports-area]').count(),2);
    assert.match(await mapPage.locator(selector+' [data-sports-area="court_volley"] title').textContent(),/推演/);
    assert.equal(await mapPage.locator(selector+' [data-atlas-detail="court_basket-shade"] circle').count(),6);
    assert.equal(await mapPage.locator(selector+' [data-atlas-detail="yundong"]').count(),1);
    assert(await mapPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    if(file==='director.html'){await mapPage.tap('[data-preset="afterclass"]');assert.deepEqual(await mapPage.evaluate(()=>HaizDirector.stops),['yihao','library','yundong','yanchi']);}
    else{await mapPage.tap('#campusAtlas [data-atlas="yundong"]');assert(await mapPage.locator('[data-map-building="yundong"]').evaluate(n=>n.classList.contains('active')));await mapPage.tap('#campusAtlas [data-atlas="yihao"]');assert.match(await mapPage.locator('#atlasDetail').textContent(),/一号教学楼/);assert.equal(await mapPage.locator('[data-map-building="yundong"]').evaluate(n=>n.classList.contains('active')),false);}
  }
  await mobile.close();assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);
  const report={date:new Date().toISOString(),passed:true,evidence,mobileMaps:'390px; modal open/close and touch-enabled director/atlas controls',errors,failedRequests,limits:'Original coordinates retained, volleyball subdivision inferred, no photogrammetry claim. Chromium SwiftShader; no real-phone FPS measurement.'};
  fs.writeFileSync('tests/sports-browser-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
