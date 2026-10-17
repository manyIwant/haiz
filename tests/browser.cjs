// Actual Chromium layout/events and WebGL shader validation. SwiftShader is
// useful in cloud CI; it is not a real-device frame-rate or touch test.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=process.cwd(),artifacts=path.join(root,'tests/artifacts');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon','.hdr':'application/octet-stream'};
const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep)||!/^\/(assets\/|data\/|[^/]+\.(html|ico)$)/.test(name)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,bytes)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(bytes);});
});
let browser;
(async()=>{
  fs.mkdirSync(artifacts,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const executablePath=process.env.CHROMIUM_PATH||(['/usr/bin/chromium','/usr/bin/chromium-browser'].find(p=>fs.existsSync(p)));
  browser=await chromium.launch({...(executablePath?{executablePath}:{}),headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const results=[],errors=[],failedRequests=[];
  function observe(page){page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)failedRequests.push(r.status()+' '+r.url());});}
  for(const mobile of [false,true]){
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:960},hasTouch:mobile,isMobile:mobile,reducedMotion:'reduce'}),page=await context.newPage();observe(page);
    await page.goto(base+'/architecture.html');await page.waitForFunction(()=>window.HaizArchitecture);
    assert.equal(await page.locator('#placeTabs button').count(),4);
    await page.click('[data-category="heritage"]');assert.equal(await page.locator('#placeTabs button').count(),1);assert.equal(await page.locator('#placeTitle').textContent(),'凤栖堂');
    await page.locator('.photo-hotspot').nth(1).click();assert.match(await page.locator('#hotspotNote').textContent(),/红与金/);
    await page.click('#collectButton');assert.equal(await page.locator('#collectButton').getAttribute('aria-pressed'),'true');
    await page.reload();await page.waitForFunction(()=>window.HaizArchitecture);assert.deepEqual(await page.evaluate(()=>HaizArchitecture.saved),['fengqitang']);
    await page.click('[data-material="stone"]');const color=await page.locator('#materialCanvas').evaluate(c=>c.toDataURL());
    await page.check('#reliefToggle');const height=await page.locator('#materialCanvas').evaluate(c=>c.toDataURL());assert.notEqual(color,height);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'field guide must fit viewport');
    await page.screenshot({path:path.join(artifacts,mobile?'guide-mobile.png':'guide-desktop.png'),fullPage:true});
    await page.click('#clearCollection');assert.deepEqual(await page.evaluate(()=>HaizArchitecture.saved),[]);
    results.push({target:mobile?'390×844 mobile emulation':'1440×960 desktop',checks:['category filter','photo hotspots','persistent local collection','material and relief maps','clear collection','no horizontal overflow'],passed:true});
    await context.close();
  }
  const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'}),page=await context.newPage();observe(page);
  page.setDefaultTimeout(60000);
  await page.goto(base+'/campus-3d.html?focus=yihao&climate=afterrain&observe=1');
  await page.waitForFunction(()=>!!window.haizWalk,null,{timeout:90000});
  await page.click('#enterButton');await page.waitForFunction(()=>window.haizWalk.state.started);
  const evidence=await page.evaluate(()=>{
    const api=window.haizWalk,gl=api.renderer.getContext();
    return {diagnostics:api.diagnostics(),observation:document.body.classList.contains('observation'),webgl:gl.getParameter(gl.VERSION),surfaces:[...new Set((()=>{const a=[];api.scene.traverse(o=>{if(o.material?.userData.surfaceStudy)a.push(o.material.userData.surfaceStudy);});return a;})())]};
  });
  assert.equal(evidence.diagnostics.climate,'afterrain');assert(evidence.observation);assert.equal(evidence.diagnostics.nodes,34);assert.equal(evidence.diagnostics.classrooms,16);assert.equal(evidence.surfaces.length,4);
  for(const [place,climate]of [['yihao','afterrain'],['fengqitang','morning'],['erhao','dusk']]){
    await page.evaluate(({place,climate})=>{
      const a=window.haizWalk;a.goTo(place,false);a.resume(false);
      const control=document.getElementById('climate');control.value=climate;control.dispatchEvent(new Event('change'));
      a.climate.tick(5,false);a.renderer.toneMappingExposure=a.climate.tick(5,false);a.renderer.render(a.scene,a.camera);
    },{place,climate});
    await page.screenshot({path:path.join(artifacts,'campus-'+place+'.png')});
  }
  assert.deepEqual(errors,[],'browser errors/shader failures');assert.deepEqual(failedRequests,[],'missing page assets');
  results.push({target:'Chromium WebGL / software renderer',checks:['real WebGL shader compilation','34 nodes and 16 classrooms','four facade material families','deep-linked climate and observation settings','three rendered architectural viewpoints','no browser errors or missing assets'],passed:true,evidence});
  fs.writeFileSync('tests/browser-results.json',JSON.stringify({date:new Date().toISOString(),browser:await browser.version(),results,errors,failedRequests,limitations:'SwiftShader software WebGL and mobile viewport emulation; no hardware FPS, physical touch or on-site measurements.'},null,2)+'\n');
  console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
