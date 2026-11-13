// Focused homepage camera and phone-loading browser check. The older
// home-browser.cjs also picks a moving leaf, an unrelated SwiftShader flaky test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname,'..');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css',
  '.json':'application/json','.png':'image/png','.webp':'image/webp',
  '.jpg':'image/jpeg','.glb':'model/gltf-binary','.bin':'application/octet-stream',
  '.woff2':'font/woff2','.svg':'image/svg+xml'};
const server = http.createServer((req,res)=>{
  let p = decodeURIComponent(new URL(req.url,'http://local').pathname);
  if (p.endsWith('/')) p+='index.html';
  const file = path.join(root,p);
  if (!file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
  fs.readFile(file,(e,b)=>{
    if(e){res.writeHead(404).end();return;}
    res.writeHead(200,{'content-type':mime[path.extname(p)]||'application/octet-stream'});
    res.end(b);
  });
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const errors=[];
  const wait=p=>p.waitForFunction(()=>document.body.classList.contains('ready'),null,{timeout:240000});
  const base='http://127.0.0.1:'+server.address().port;
  try {
    const desktop=await browser.newPage({viewport:{width:1280,height:720}});
    desktop.on('pageerror',e=>errors.push('desktop '+e.message));
    await desktop.goto(base+'/index.html?quality=low&test=1');
    await wait(desktop);
    const initial=await desktop.evaluate(()=>window.__haizHome.info());
    assert.equal(initial.mobileTouch,false);
    assert.equal(initial.active,0);
    await desktop.evaluate(()=>{window.__haizHome.go(2);window.__haizHome.still(.1,20);});
    assert.equal(await desktop.evaluate(()=>window.__haizHome.info().active),2);
    await desktop.close();

    const ctx=await browser.newContext({
      viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true
    });
    const phone=await ctx.newPage();
    phone.on('pageerror',e=>errors.push('phone '+e.message));
    const requested=[];
    phone.on('request',req=>{if(/leaf-(atlas|normal)-/.test(req.url()))requested.push(req.url());});
    await phone.goto(base+'/index.html?quality=low&mobile-ci=1');
    await wait(phone);
    const data=await phone.evaluate(()=>window.__haizHome.info());
    assert.equal(data.mobileTouch,true);
    assert.equal(data.active,0);
    assert.equal(data.tier,'low');
    assert(requested.some(u=>u.endsWith('leaf-atlas-lo.webp')),
      'phone did not request lossless atlas: '+requested.join(','));
    assert(requested.some(u=>u.endsWith('leaf-normal-lo.webp')),
      'phone did not request lossless leaf normal: '+requested.join(','));

    const canvas=await phone.evaluate(()=>({
      height:document.querySelector('#world').clientHeight,
      width:document.querySelector('#world').clientWidth
    }));
    assert(canvas.height>=844,'mobile stage is full height: '+JSON.stringify(canvas));
    await phone.evaluate(()=>scrollTo(0,document.getElementById('roots').offsetTop));
    await phone.waitForFunction(()=>window.__haizHome.info().p > .75,null,{timeout:120000});
    await phone.waitForTimeout(1600);
    const p=await phone.evaluate(()=>window.__haizHome.info().p);
    assert(p<1.35,'a swipe to 02 should not jump to 03: p='+p);
    await phone.evaluate(()=>{
      window.__haizHome.go(4);
      window.__haizHome.still(.1,20);
    });
    const shape=await phone.evaluate(()=>{
      const e=window.__haizHome.world.camera.projectionMatrix.elements;
      return {projectionAspect:e[5]/e[0],screenAspect:innerWidth/innerHeight};
    });
    assert(Math.abs(shape.projectionAspect/shape.screenAspect-1)<.02,
      'phone camera distorted: '+JSON.stringify(shape));
    const overflow=await phone.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    assert(overflow<=0,'phone horizontal overflow '+overflow);
    assert.deepEqual(errors,[]);
    await ctx.close();
    console.log('PASS mobile homepage: desktop unchanged; 390x844 swipe and camera proportions; mobile lossless textures served');
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
