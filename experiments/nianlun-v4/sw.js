/* HAIZ · NIANLUN · 一卷 V4 — Offline-First Service Worker (Master v4 §11.5)
 * Caches core UI, rendering, parsing, and optional climate patina locally.
 * Never intercepts or uploads private local storage data.
 */
const CACHE_NAME = 'haiz-nianlun-v4-shell-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './styles/tokens.css',
  './styles/app.css',
  './styles/print.css',
  './src/main.js',
  './src/ocr-bridge.js',
  './src/core/model.js',
  './src/core/calendar.js',
  './src/core/layout.js',
  './src/core/convergence.js',
  './src/core/climate.js',
  './src/core/demo_data.js',
  './src/core/store.js',
  './src/render/wood_textures.js',
  './src/render/scroll_canvas.js',
  './src/render/gestures.js',
  './src/ui/foley.js',
  './src/ui/a11y_layer.js',
  './src/ui/item_sheet.js',
  './src/ui/intake_sheet.js',
  './src/ui/search_panel.js',
  './src/ui/takeaway_sheet.js',
  './src/ui/settings_sheet.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        }
        return resp;
      }).catch(() => caches.match('./index.html'));
    }),
  );
});
