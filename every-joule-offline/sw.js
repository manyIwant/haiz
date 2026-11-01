/* HAIZ offline packer. Does not fetch/copy third-party sites. Same-origin files only. */
'use strict';
const SHELL_CACHE='haiz-every-joule-shell-v1';
const CONTENT_CACHE='haiz-every-joule-content-v1';
const SHELL=['./','./index.html','./manifest.webmanifest','./sw.js'];
const scope=new URL(self.registration?.scope||self.location.href);
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const c=await caches.open(SHELL_CACHE);
 await c.addAll(SHELL);
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const keys=await caches.keys();
 await Promise.all(keys.filter(k=>k.startsWith('haiz-every-joule-')&&!([SHELL_CACHE,CONTENT_CACHE].includes(k))).map(k=>caches.delete(k)));
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==scope.origin||!url.href.startsWith(scope.href))return;
 event.respondWith((async()=>{
 // Refresh the manifest online so a newly authorized export never reads a stale manifest.
 const isManifest=url.pathname.endsWith('/offline-index.json');
 const cached=await caches.match(req);
 if(cached&&!isManifest)return cached;
 try{
  const response=await fetch(req);
  if(response.ok && (isManifest||url.pathname.endsWith('/index.html')||url.pathname.endsWith('/manifest.webmanifest'))) {
   const c=await caches.open(isManifest?CONTENT_CACHE:SHELL_CACHE);
   await c.put(req,response.clone());
  }
  return response;
 }catch(e){
  if(cached)return cached;
  return new Response('离线资源尚未完整安装。请联网后使用“下载完整离线资源”。',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
 }
 })());
});
async function pack(){
 const res=await fetch('./offline-index.json',{cache:'no-store'});
 if(!res.ok)throw new Error('缺少离线文件清单');
 const manifest=await res.json();
 if(!Array.isArray(manifest.files)||!manifest.files.includes('app/index.html')||manifest.files.length>50000)throw new Error('离线文件清单无效');
 const fileList=[...new Set([...SHELL,'./offline-index.json',...manifest.files.map(f=>'./'+f)])];
 for(const file of fileList){
  const u=new URL(file,scope);
  if(u.origin!==scope.origin||!u.href.startsWith(scope.href))throw new Error('资源路径不在离线目录中：'+file);
 }
 const c=await caches.open(CONTENT_CACHE);
 // An interrupted cache download must never leave the previous ready marker in place.
 await c.delete(new URL('./offline-ready.json',scope));
 let done=0;
 for(const file of fileList){
  const url=new URL(file,scope);
  const res=await fetch(url,{cache:'reload'});
  if(!res.ok||res.type==='opaque')throw new Error('文件不可读取：'+file+' ('+res.status+')');
  await c.put(url,res.clone());
  done++;
  const clients=await self.clients.matchAll({includeUncontrolled:true});
  for(const client of clients)client.postMessage({type:'PROGRESS',done,total:fileList.length});
 }
 await c.put(new URL('./offline-ready.json',scope),new Response(JSON.stringify({version:manifest.version,total:fileList.length}),{headers:{'Content-Type':'application/json'}}));
}
self.addEventListener('message',event=>event.waitUntil((async()=>{
 const d=event.data||{},client=event.source;
 if(!client)return;
 if(d.type==='DOWNLOAD'){
  try{await pack();client.postMessage({type:'FINISHED'});}
  catch(error){client.postMessage({type:'FAILED',reason:String(error.message||error)});}
 }
 if(d.type==='STATUS'){
  const c=await caches.open(CONTENT_CACHE);
  const r=await c.match(new URL('./offline-ready.json',scope));
  let ready=false;
  if(r){try{const saved=await r.json(), current=await (await fetch('./offline-index.json',{cache:'no-store'})).json();ready=saved.version===current.version;}catch{}}
  client.postMessage({type:'STATUS',ready});
 }
})()));
