import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);let pw;try{pw=require('playwright')}catch{pw=require('/opt/codex/cua_node/lib/node_modules/playwright')}
const root=path.resolve('world/apps/mobile/www'),out='docs/haiz-audit/evidence/web';mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.mp4':'video/mp4'};
const server=createServer((req,res)=>{let f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep)&&f!==root){res.writeHead(403);return res.end()};if(existsSync(f)&&statSync(f).isDirectory())f=path.join(f,'index.html');try{res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');res.end(readFileSync(f))}catch{res.writeHead(404);res.end('missing')}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await pw.chromium.launch({headless:true,executablePath:process.env.HAIZ_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});const checks=[],errors=[];
try{
const ctx=await browser.newContext({viewport:{width:390,height:844},locale:'zh-CN',recordVideo:{dir:out+'/recordings',size:{width:390,height:844}}});const p=await ctx.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));
await p.goto(origin);await p.locator('[data-testid="haiz-main"][data-route="study"]').waitFor();await p.locator('#dock-study').waitFor();assert.equal(await p.locator('#haiz-native-boot').count(),0);checks.push('Bundled root redirects to interactive study, boot overlay removed');
await p.locator('#space-note').fill('虚构测试：保留下次要比较的解法');await p.locator('#space-note').blur();await p.reload();await p.locator('#dock-study').waitFor();assert.equal(await p.locator('#space-note').inputValue(),'虚构测试：保留下次要比较的解法');checks.push('Real study note survives reload');
for(const theme of ['obsidian','porcelain','ocean']){await p.locator('#lucent-settings').click();await p.locator('[name="lucent-theme"][value="'+theme+'"]').check();await p.locator('[data-lucent-close]').click();await p.screenshot({path:out+'/'+theme+'.png',fullPage:true});}
await p.reload();await p.locator('#dock-study').waitFor();assert.equal(await p.locator('html').getAttribute('data-lucent-theme'),'ocean');checks.push('Three palettes and persisted selection');
for(let i=0;i<30;i++){const id=i%2?'study':'today';await p.locator('#dock-'+id).click();await p.waitForFunction(route=>document.documentElement.dataset.haizRoute===route,id==='study'?'study':'assignments');}checks.push('30 real route switches');
// Interrupt before the spring settles: do not use locator actionability waits.
for(let i=0;i<20;i++){
 const box=await p.locator(i%2?'#dock-study':'#dock-today').boundingBox();
 await p.mouse.click(box.x+box.width/2,box.y+box.height/2);await p.waitForTimeout(35);
}
await p.waitForFunction(()=>document.documentElement.dataset.haizRoute==='study');
for(let i=0;i<8;i++){
 const from=await p.locator(i%2?'#dock-today':'#dock-study').boundingBox(),to=await p.locator(i%2?'#dock-study':'#dock-today').boundingBox();
 await p.mouse.move(from.x+from.width/2,from.y+from.height/2);await p.mouse.down();
 await p.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:12});await p.waitForTimeout(120);await p.mouse.move(to.x+to.width/2+.1,to.y+to.height/2);await p.mouse.up();
 const route=i%2?'study':'assignments';console.log('drag',i,await p.evaluate(()=>({hash:location.hash,route:document.documentElement.dataset.haizRoute})));await p.waitForFunction(r=>document.documentElement.dataset.haizRoute===r,route);
 assert.equal(await p.locator(i%2?'#dock-study':'#dock-today').getAttribute('aria-current'),'page');
}
checks.push('20 interrupted pointer clicks and 8 pointer drags keep selected tab and real route aligned');

await p.locator('#dock-search').click();await p.locator('#lucent-query').fill('思考书架');await p.locator('#lucent-results a').click();await p.locator('[data-route="shelf"][data-testid="haiz-main"]').waitFor();await p.locator('#dock-study').click();checks.push('Search orb reaches real shelf and returns');
for(const width of [320,360,375,390,430,768,1024]){await p.setViewportSize({width,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'width '+width);}
checks.push('Seven viewport widths without horizontal overflow');
await ctx.close();
const broken=await browser.newContext();await broken.addInitScript(()=>localStorage.setItem('haiz.test.private','保留'));await broken.route('**/world/app.js',r=>r.abort());const b=await broken.newPage();await b.goto(origin);await b.locator('#haiz-native-boot[data-state="error"]').waitFor({timeout:15000});assert.equal(await b.evaluate(()=>localStorage.getItem('haiz.test.private')),'保留');await b.locator('#haiz-boot-copy').click();assert.ok((await b.locator('#haiz-boot-diagnostic').inputValue()).includes('resource_load_failed'));await b.screenshot({path:out+'/missing-resource.png'});checks.push('Missing module displays diagnostic without clearing private storage');await broken.close();
assert.deepEqual(errors,[]);writeFileSync(out+'/results.json',JSON.stringify({status:'PASS',at:new Date().toISOString(),checks,errors,environment:'Linux Chromium, native web bundle; NOT physical device'},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();await new Promise(r=>server.close(r))}
