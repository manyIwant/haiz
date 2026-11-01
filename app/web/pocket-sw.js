/* HAIZ Pocket service worker. Build placeholders are filled after flutter build web.
 * Only public application files are cached. Account data, APIs and cross-origin
 * requests (including Supabase) never enter Cache Storage.
 */
const HAIZ_VERSION = '__HAIZ_BUILD_ID__';
const HAIZ_PRECACHE = __HAIZ_PRECACHE__;
const CACHE_PREFIX = 'haiz-pocket-';
const SHELL_CACHE = CACHE_PREFIX + 'shell-' + HAIZ_VERSION;
const RUNTIME_CACHE = CACHE_PREFIX + 'assets-' + HAIZ_VERSION;
const SCOPE = self.registration.scope;
const PRECACHE_URLS = new Set(HAIZ_PRECACHE.map(path => new URL(path, SCOPE).href));

function isPublicAsset(url) {
  if (url.origin !== new URL(SCOPE).origin || !url.href.startsWith(SCOPE)) {
    return false;
  }
  const relative = url.href.slice(SCOPE.length).split('?')[0];
  return /^(assets|canvaskit|icons)\//.test(relative) ||
    /^(main\.dart\.js|flutter\.js|flutter_bootstrap\.js|manifest\.json|pocket-client\.js|favicon\.png)$/.test(relative);
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    for (const path of HAIZ_PRECACHE) {
      const url = new URL(path, SCOPE).href;
      const response = await fetch(url, { cache: 'reload' });
      if (!response.ok) throw new Error('HAIZ offline asset unavailable: ' + path);
      await cache.put(url, response);
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith(CACHE_PREFIX) &&
        key !== SHELL_CACHE && key !== RUNTIME_CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'HAIZ_APPLY_UPDATE') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== new URL(SCOPE).origin || !url.href.startsWith(SCOPE)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        // Network-first avoids trapping users on a stale index after deployment.
        const response = await fetch(request);
        if (response.ok) return response;
      } catch (_) { /* offline fallback below */ }
      const cache = await caches.open(SHELL_CACHE);
      return (await cache.match(new URL('index.html', SCOPE).href)) ||
        new Response('HAIZ 离线资源暂不可用，请在联网后重新打开。', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    })());
    return;
  }

  if (!isPublicAsset(url)) return;
  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(RUNTIME_CACHE);
        // Limit incremental caching to immutable Flutter static assets.
        await cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch (_) {
      return Response.error();
    }
  })());
});
