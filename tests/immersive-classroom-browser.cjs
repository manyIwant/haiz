/* WebGL screenshot and interaction smoke. Requires npm ci and Playwright Chromium. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=process.cwd();
const out=path.join(root,'tests','artifacts','immersive');
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  let decoded;
  try{decoded=decodeURIComponent(new URL(req.url,'http://local').pathname)}catch{res.writeHead(400).end();return;}
  const full=path.resolve(root,'.'+decoded);
  if(!(full===root||full.startsWith(root+path.sep))){res.writeHead(403).end();return;}
  const filename=decoded.endsWith('/')?path.join(full,'index.html'):full;
  fs.readFile(filename,(error,bytes)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);});
});
const results=[];
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  try{
    for(const size of [{width:1440,height:900},{width:390,height:844}]){
      const context=await browser.newContext({viewport:size,deviceScaleFactor:1,isMobile:size.width<600,hasTouch:size.width<600});
      const page=await context.newPage();
      page.setDefaultTimeout(45000);
      const errors=[],requests=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('response',r=>{if(r.status()>=400)requests.push({status:r.status(),url:r.url()});});
      page.on('request',r=>{if(!r.url().startsWith(base))requests.push({external:r.url()});});
      await page.goto(base+'/world/room/immersive/',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.HAIZ_IMMERSIVE?.ready===true,{timeout:90000});
      await page.waitForFunction(()=>window.HAIZ_IMMERSIVE?.getDiagnostics().rendered>=2,{timeout:90000});
      const init=await page.evaluate(()=>window.HAIZ_IMMERSIVE.getDiagnostics());
      assert(init.webgl&&init.drawCalls>5&&init.triangles>100,'Must render real room geometry rather than a CSS image');
      assert.equal(init.units,'meters');
      assert(init.instancedBoxes>=60 && init.geometryBatches>=4,'Repeatable classroom furniture must use GPU instancing');
      assert(init.drawCallsSaved>=55,'Instancing must remove substantial redundant draw calls');
      assert(init.groundedContactShadows,'Desks require a single cheap grounding pass');
      if(size.width===1440)assert(init.drawCalls<230,'Desktop reference draw calls must decrease from prior 352');
      const names=['sunbreak','monsoon','morning'];
      for(const mode of names){
        await page.locator('[data-weather="'+mode+'"]').click();
        assert.equal(await page.evaluate(()=>window.HAIZ_IMMERSIVE.getDiagnostics().climate),mode);
        await page.waitForTimeout(900);
        await page.screenshot({path:path.join(out,size.width+'-'+mode+'.png')});
      }
      await page.locator('#explore').click();
      assert.equal(await page.locator('#exploreUI').evaluate(el=>el.hidden),false,'The world HUD is enabled after entering');
      assert.equal(await page.evaluate(()=>window.HAIZ_IMMERSIVE.getDiagnostics().entered),true);
      await page.keyboard.down('w');
      await page.waitForTimeout(120);
      await page.keyboard.up('w');
      await page.locator('#deskAction').click();
      assert.equal(await page.evaluate(()=>window.HAIZ_IMMERSIVE.getDiagnostics().focused),true);
      await page.locator('#qualityToggle').click();
      const latest=await page.evaluate(()=>window.HAIZ_IMMERSIVE.getDiagnostics());
      assert(['low','balanced','high'].includes(latest.quality));
      assert.deepEqual(errors,[],'No uncaught runtime errors');
      assert.deepEqual(requests,[],'No failed assets or unapproved external requests');
      results.push({viewport:size,initial:init,after:latest,checks:['measurable GPU instancing draw-call savings','single-pass furniture grounding','real WebGL draw calls','PBR room render','three weather grades','first-person entry','study-desk handoff','quality switch','local assets only'],errors,requests});
      await page.close();await context.close();
    }
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
    console.log('PASS immersed study room on desktop and mobile viewport, no external requests');
  }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1}).finally(()=>server.close());
