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
const APP_DOCUMENT = new URL('index.html', SCOPE).href;
const INSTALL_DOCUMENT = new URL('install.html', SCOPE).href;

function isPublicAsset(url) {
  if (url.origin !== new URL(SCOPE).origin || !url.href.startsWith(SCOPE)) {
    return false;
  }
  const relative = url.href.slice(SCOPE.length).split('?')[0];
  return /^(assets|canvaskit|icons)\//.test(relative) ||
    /^ocr\/(vendor\/(tesseract|worker)\.min\.js|core\/tesseract-core[-a-z0-9]*\.wasm(\.js)?|lang\/(chi_sim|eng)\.traineddata\.gz)$/.test(relative) ||
    /^(main\.dart\.js|flutter\.js|flutter_bootstrap\.js|manifest\.json|pocket-client\.js|pocket-ocr\.js|pocket-ui\.css|favicon\.png)$/.test(relative);
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // Bounded parallelism shortens install time without downloading every
    // optional Flutter/PDF renderer into the first-launch cache.
    for (let i = 0; i < HAIZ_PRECACHE.length; i += 3) {
      await Promise.all(HAIZ_PRECACHE.slice(i, i + 3).map(async path => {
        const url = new URL(path, SCOPE).href;
        const response = await fetch(url, { cache: 'reload' });
        if (!response.ok) throw new Error('HAIZ offline asset unavailable: ' + path);
        await cache.put(url, response);
      }));
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
      // Keep the iPhone installation instructions available offline, too.
      const documentUrl = url.pathname.endsWith('/install.html') ? INSTALL_DOCUMENT : APP_DOCUMENT;
      return (await cache.match(documentUrl)) ||
        new Response('HAIZ 离线资源暂不可用，请在联网后重新打开。', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    })());
    return;
  }

  if (!isPublicAsset(url)) return;
  event.respondWith((async () => {
    // Only use this worker's caches, not outdated assets from another build.
    const shell = await caches.open(SHELL_CACHE);
    const cachedShell = await shell.match(request, { ignoreSearch: true });
    if (cachedShell) return cachedShell;
    const runtime = await caches.open(RUNTIME_CACHE);
    const cachedRuntime = await runtime.match(request, { ignoreSearch: true });
    if (cachedRuntime) return cachedRuntime;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        // Only static resources go into this version's runtime cache.
        await runtime.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch (_) {
      return Response.error();
    }
  })());
});
