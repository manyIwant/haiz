// HAIZ · EXPERIMENTARIUM — 离线优先 Service Worker
const CACHE = 'haiz-experimentarium-v1';
const CORE_URLS = [
  './',
  './index.html',
  './css/experimentarium.css',
  './data/curriculum-matrix.json',
  './js/core/app.js',
  './js/core/book.js',
  './js/core/stage.js',
  './js/core/ink.js',
  './js/core/print.js',
  './js/core/catalog.js',
  './js/core/journal.js',
  './js/core/workbench.js',
  './js/core/matrix-ui.js',
  './js/core/epistemic.js',
  './js/core/science-models.js',
  './js/core/timeline.js',
  './js/core/scrub.js',
  './js/core/handle.js',
  './js/core/tape.js',
  './js/core/bridge.js',
  '../lanren/vendor/three/three.module.min.js',
  '../lanren/fonts/cormorant-garamond-latin-500-normal.woff2',
  '../lanren/fonts/cormorant-garamond-latin-400-italic.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE_URLS).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
