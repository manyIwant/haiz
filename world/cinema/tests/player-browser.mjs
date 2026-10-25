import{createRequire}from'node:module';import{createServer}from'node:http';import{readFileSync,existsSync,statSync,mkdirSync,writeFileSync}from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{prepareNativeWeb}from'../../apps/mobile/prepare-web.mjs';
const require=createRequire(import.meta.url);let pw;try{pw=require('playwright')}catch{pw=require('/opt/codex/cua_node/lib/node_modules/playwright')}
const root='/tmp/haiz-cinema-native';prepareNativeWeb({output:root});const out='docs/haiz-audit/evidence/cinema';mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.mp4':'video/mp4'};
const server=createServer((req,res)=>{let f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep)&&f!==root){res.writeHead(403);return res.end()};if(existsSync(f)&&statSync(f).isDirectory())f=path.join(f,'index.html');try{res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');res.end(readFileSync(f))}catch{res.writeHead(404);res.end('missing')}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await pw.chromium.launch({headless:true,executablePath:process.env.HAIZ_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});const checks=[],errors=[];
try{
const c=await browser.newContext({viewport:{width:390,height:844},locale:'zh-CN',recordVideo:{dir:out,size:{width:390,height:844}}});const p=await c.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));await p.goto(origin);await p.locator('[data-cinema-enter]').waitFor();
await p.locator('[data-cinema-enter]').click();await p.locator('[data-study-ready="true"]').waitFor();const f=p.frameLocator('[data-testid="cinema-study"]');await f.locator('#mobilePanelBtn').count();
const skip=p.locator('[data-testid="cinema-skip"]');if(await skip.count())await skip.click();await p.waitForFunction(()=>!document.querySelector('.haiz-cinema-film'));
await f.locator('#mobilePanelBtn').click();await f.locator('#openJournal').click();await f.locator('#journalInput').fill('虚构测试：影片退出后仍保留的思路');await f.locator('#saveNote').click();await f.locator('.saved-note').waitFor();
await p.locator('.haiz-cinema-close').click();await p.locator('[data-cinema-enter]').click();await p.locator('[data-study-ready="true"]').waitFor();assert.equal(await p.locator('.haiz-cinema-room').getAttribute('data-film-state'),'repeat-short');await f.locator('#mobilePanelBtn').click();await f.locator('#openJournal').click();await f.locator('.saved-note').waitFor();assert.ok((await f.locator('#savedNotes').textContent()).includes('影片退出后'));await f.locator('#haiz-export-notes').waitFor();await p.screenshot({path:out+'/integrated-notes.png'});checks.push('Real integrated study initializes independently; skip/repeat preserve note and export control');
await p.locator('.haiz-cinema-close').click();
for(let i=0;i<5;i++){await p.evaluate(()=>sessionStorage.removeItem('haiz.cinema.seen.v1'));await p.route('**/HAIZ-*.mp4',r=>r.abort());await p.locator('[data-cinema-enter]').click();await p.locator('[data-study-ready="true"]').waitFor();await p.waitForFunction(()=>!document.querySelector('.haiz-cinema-film'));assert.ok(['media-failed','playback-unavailable'].includes(await p.locator('.haiz-cinema-room').getAttribute('data-film-state')));await p.locator('.haiz-cinema-close').click();await p.unroute('**/HAIZ-*.mp4');}
checks.push('Five decode/network failures enter actual tools and return without trapping navigation');
if(process.env.HAIZ_VERIFY_FILMS==='1'){
 for(const theme of ['porcelain','obsidian','ocean']){
  await p.locator('#lucent-settings').click();await p.locator('[name="lucent-theme"][value="'+theme+'"]').check();await p.locator('[data-lucent-close]').click();
  await p.evaluate(()=>sessionStorage.removeItem('haiz.cinema.seen.v1'));
  await p.locator('[data-cinema-enter]').click();await p.locator('[data-study-ready="true"]').waitFor();
  await p.waitForFunction(()=>document.querySelector('.haiz-cinema-room')?.dataset.filmState==='ended',null,{timeout:15000});
  await p.screenshot({path:out+'/film-ended-'+theme+'.png'});await p.locator('.haiz-cinema-close').click();
 }
 checks.push('All three bundled MP4 films play to ended and reveal initialized real study tools');
}
await p.emulateMedia({reducedMotion:'reduce'});await p.locator('[data-cinema-enter]').click();await p.locator('[data-study-ready="true"]').waitFor();assert.equal(await p.locator('.haiz-cinema-room').getAttribute('data-film-state'),'reduced');assert.equal(await p.locator('video').count(),0);checks.push('Reduced motion makes no video element/request');await p.locator('.haiz-cinema-close').click();
await c.close();assert.deepEqual(errors,[]);writeFileSync(out+'/results.json',JSON.stringify({status:'PASS',at:new Date().toISOString(),checks,errors,environment:'Linux Chromium native bundle; NOT physical device; recording uncut browser automation'},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();await new Promise(r=>server.close(r))}
