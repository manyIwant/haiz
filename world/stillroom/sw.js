const CACHE='haiz-stillroom-v1';
const CORE=['./','index.html','styles.css','app.js','manifest.webmanifest','assets/favicon.svg','assets/offline-study.svg','assets/grain.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('haiz-stillroom-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==location.origin||!url.pathname.startsWith(new URL('./',location.href).pathname))return;e.respondWith(fetch(e.request).catch(()=>caches.match(e.request).then(hit=>hit||Response.error())))});
