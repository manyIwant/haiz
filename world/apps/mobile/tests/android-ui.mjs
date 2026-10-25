/** Tests the running Android WebView through its real DevTools socket, not a desktop replica. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const out=process.env.HAIZ_QA_OUTPUT || 'mobile-test-output';
mkdirSync(out,{recursive:true});
const mode=process.argv[2] || 'exercise';
const note='HAIZ QA — fictional next step: compare the second solution.';
const adb=(...args)=>execFileSync('adb',args,{encoding:'utf8',timeout:30000}).trim();
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let ws,port=9222,seq=0;
const pending=new Map(),events=[],checks=[];
async function connect(){
 const deadline=Date.now()+90000;
 let last='No WebView debugging socket';
 while(Date.now()<deadline){
  try {
   const sockets=adb('shell','cat','/proc/net/unix').split('\n').map(l=>l.match(/@(webview_devtools_remote[^\s]*)/)?.[1]).filter(Boolean);
   for(const socket of sockets){
    adb('forward',`tcp:${port}`,`localabstract:${socket}`);
    const targets=await fetch(`http://127.0.0.1:${port}/json`,{signal:AbortSignal.timeout(3000)}).then(r=>r.json());
    const target=targets.find(t=>t.type==='page'&&/localhost.*(?:world\/|index\.html)/.test(t.url))||targets.find(t=>t.type==='page'&&/localhost/.test(t.url));
    if(!target?.webSocketDebuggerUrl)continue;
    ws=new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
    ws.addEventListener('message',({data})=>{const msg=JSON.parse(data);if(msg.id){const p=pending.get(msg.id);if(p){pending.delete(msg.id);clearTimeout(p.timer);msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result);}}else if(['Runtime.exceptionThrown','Log.entryAdded','Network.loadingFailed'].includes(msg.method))events.push(msg);});
    await call('Runtime.enable');await call('Log.enable');await call('Network.enable');return;
   }
  }catch(e){last=e.message;}
  await delay(1000);
 }
 throw Error(`Cannot inspect app WebView: ${last}`);
}
function call(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error(`CDP timeout: ${method}`));},15000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text+' '+JSON.stringify(r.exceptionDetails.exception));return r.result.value;}
async function waitFor(expression,label,timeout=30000){const deadline=Date.now()+timeout;while(Date.now()<deadline){if(await evaluate(expression))return;await delay(250);}throw Error(`UI condition failed: ${label}`);}
async function ready(route='study'){
 await waitFor(`document.documentElement?.dataset.haizReady==='true' && document.documentElement.dataset.haizRoute===${JSON.stringify(route)} && !!document.querySelector('#app[data-testid="haiz-app-ready"] #main[data-testid="haiz-main"]')`,'real application ready '+route);
 assert.equal(await evaluate(`!!document.querySelector('#haiz-native-boot[data-state="error"]')`),false,'No boot error screen');
 const rect=await evaluate(`(()=>{const r=document.querySelector('#main').getBoundingClientRect();return {w:r.width,h:r.height}})()`);
 assert.ok(rect.w>200&&rect.h>100,'Main surface has visible geometry');
}
async function tap(selector){
 const point=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,radiusX:2,radiusY:2,force:1,id:1}]});
 await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}
async function screenshot(name){const {data}=await call('Page.captureScreenshot',{format:'png'});writeFileSync(path.join(out,name+'.png'),Buffer.from(data,'base64'));}
try {
 await connect(); await ready(); await screenshot(mode+'-ready');
 if(mode==='exercise'){
  await tap('[data-testid="dock-today"]');await ready('assignments');
  await tap('[data-testid="dock-study"]');await ready('study');
  await evaluate(`document.querySelector('#space-note').focus()`);
  await call('Input.insertText',{text:note});
  await waitFor(`document.querySelector('#space-note').value===${JSON.stringify(note)}`,'note entered using WebView input');
  await evaluate(`document.querySelector('#space-note').blur()`);
  await delay(700);
  await screenshot('note-saved');
  checks.push('Native WebView touch navigation and editable local study note');
 }else{
  assert.equal(await evaluate(`document.querySelector('#space-note').value`),note,'Actual study note survives '+mode);
  checks.push('Actual study note survives '+mode);
 }
 await call('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 await call('Page.reload',{ignoreCache:true});await ready();
 assert.equal(await evaluate(`document.querySelector('#space-note').value`),note,'Offline reload retains private note');
 await screenshot(mode+'-offline');
 await call('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 checks.push('Bundled page remains interactive offline; private record retained');
 const exceptions=events.filter(e=>e.method==='Runtime.exceptionThrown');
 assert.deepEqual(exceptions,[],'Unhandled WebView JavaScript exceptions');
 writeFileSync(path.join(out,mode+'-result.json'),JSON.stringify({status:'PASS',mode,at:new Date().toISOString(),checks,physicalDevice:false,events},null,2));
}catch(e){writeFileSync(path.join(out,mode+'-result.json'),JSON.stringify({status:'FAIL',mode,error:e.stack,events},null,2));throw e;}
finally{ws?.close();for(const p of pending.values())clearTimeout(p.timer);try{adb('forward','--remove',`tcp:${port}`);}catch{}}
