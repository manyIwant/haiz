// The public Worker only routes requests. Passwords, transactions and rooms run
// inside one Durable Object; no process on the owner's computer is involved.
const localAssets = new Map([
  ['/login/', '/login/index.html'], ['/login/index.html', '/login/index.html'],
  ['/account/', '/account/index.html'], ['/account/index.html', '/account/index.html'],
  ['/account/app.js', '/account/app.js'], ['/account/style.css', '/account/style.css'],
  ['/account/session-guard.js', '/account/session-guard.js'],
  ['/src/account/lamp-auth.js', '/src/account/lamp-auth.js'], ['/haiz-client.js', '/haiz-client.js'],
  ['/lamp-preview/wall-photo.webp', '/lamp-preview/wall-photo.webp'],
]);
const blocked = new Set(['backend', 'services', 'tests', 'scripts', 'docs', 'pilot', 'node_modules', 'release', 'src', 'remotion', 'portable']);
const extensions = /\.(?:html|js|css|json|webmanifest|svg|png|ico|jpe?g|webp|woff2?|mp3|wav|ogg|mp4|webm|glb|gltf|hdr|bin|txt)$/i;
const noStore = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' };
const mime = { html:'text/html; charset=utf-8', js:'text/javascript; charset=utf-8', css:'text/css; charset=utf-8', json:'application/json', webmanifest:'application/manifest+json', svg:'image/svg+xml', png:'image/png', ico:'image/x-icon', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp', woff:'font/woff', woff2:'font/woff2', mp3:'audio/mpeg', wav:'audio/wav', ogg:'audio/ogg', mp4:'video/mp4', webm:'video/webm', glb:'model/gltf-binary', gltf:'model/gltf+json', hdr:'application/octet-stream', bin:'application/octet-stream', txt:'text/plain; charset=utf-8' };
const error = (status, message) => Response.json({ error: message }, { status, headers: noStore });
export function createGateway({ backend, assets, origin, upstream = 'https://raw.githubusercontent.com/manyIwant/haiz/main/', fetch: upstreamFetch = globalThis.fetch, development = false }) {
  const source = new URL(upstream);
  if (source.protocol !== 'https:' || source.origin !== 'https://raw.githubusercontent.com' || source.pathname !== '/manyIwant/haiz/main/') throw new Error('Invalid static origin');
  return async function gateway(request) {
    const url = new URL(request.url);
    if (url.origin !== origin || (request.headers.has('Host') && request.headers.get('Host') !== url.host)) return error(403, '请求来源无效');
    const headers = new Headers(request.headers);
    headers.set('X-HAIZ-Client-IP', request.headers.get('CF-Connecting-IP') || (development ? '127.0.0.1' : ''));
    const internal = path => new Request(new URL(path, origin), { method: 'GET', headers });
    if (url.pathname.startsWith('/api/')) return backend.fetch(new Request(request, { headers }));
    if (!['GET', 'HEAD'].includes(request.method)) return error(405, '方法不支持');
    if (url.pathname === '/account' || url.pathname === '/login') return new Response(null, { status: 302, headers: { ...noStore, Location: url.pathname + '/' + url.search } });
    let path;
    try { path = decodeURIComponent(url.pathname); } catch { return error(400, '路径无效'); }
    const asset = localAssets.get(path);
    if (!asset && (path.includes('\\') || path.includes('\0') || path.split('/').some(p => p.startsWith('.') || blocked.has(p)) || /(?:^|\/)(?:package(?:-lock)?\.json|.*\.test\..*)$/i.test(path) || (!path.endsWith('/') && !extensions.test(path)))) return error(404, '页面不存在');
    const isAccount = path === '/account/' || path === '/account/index.html';
    const protectedHtml = isAccount || (!asset && (path.endsWith('/') || path.endsWith('.html')));
    let identity;
    async function identify() {
      const response = await backend.fetch(internal('/api/v1/auth/me'));
      if (!response.ok) return response.status === 401
        ? new Response(null, { status: 302, headers: { ...noStore, Location: '/login/?next=' + encodeURIComponent(url.pathname + url.search) } })
        : response;
      const result = await response.json(); identity = result.identity;
      if (!identity || !/^[\w-]{1,100}$/.test(identity.id)) return error(502, '无法验证登录状态');
      return null;
    }
    if (protectedHtml) { const failure = await identify(); if (failure) return failure; }
    if (asset) {
      const response = await assets.fetch(new Request(new URL(asset, origin), { method: request.method }));
      const output = new Headers(response.headers); for (const [name, value] of Object.entries(noStore)) output.set(name, value);
      return new Response(response.body, { status: response.status, headers: output });
    }
    if (path.endsWith('/sw.js') || path.endsWith('/flutter_service_worker.js')) return new Response(request.method === 'HEAD' ? null : 'self.addEventListener("install",()=>self.skipWaiting());self.addEventListener("activate",e=>e.waitUntil((async()=>{for(const k of await caches.keys())await caches.delete(k);await self.registration.unregister();await self.clients.claim()})()));', { headers: { ...noStore, 'Content-Type': 'text/javascript; charset=utf-8' } });
    let sourcePath = path;
    if (path.startsWith('/world/')) sourcePath = '/prototypes/haiz-world/public/haiz' + path;
    else if (path.startsWith('/haiz/')) sourcePath = '/prototypes/haiz-world/public' + path;
    if (sourcePath.endsWith('/')) sourcePath += 'index.html';
    const remote = new URL(source.pathname + sourcePath.slice(1), source.origin); remote.search = url.search;
    let response;
    try { response = await upstreamFetch(new Request(remote, { method: request.method, headers: { Accept: request.headers.get('Accept') || '*/*', ...(request.headers.has('Range') ? { Range: request.headers.get('Range') } : {}) }, redirect: 'manual' })); }
    catch { return error(502, '页面来源暂时不可用'); }
    const output = new Headers(response.headers); output.delete('set-cookie');
    for (const [name, value] of Object.entries(noStore)) output.set(name, value);
    // Raw GitHub adds sandbox/CSP and text/plain for code. These are source-file
    // download headers, not the security policy or MIME types of the website.
    output.delete('Content-Security-Policy'); output.delete('Access-Control-Allow-Origin');
    output.set('X-Frame-Options', 'SAMEORIGIN'); output.set('Cross-Origin-Resource-Policy', 'same-origin');
    const extension = sourcePath.split('.').at(-1).toLowerCase();
    if (mime[extension]) output.set('Content-Type', mime[extension]);
    if (response.status >= 300 && response.status < 400) {
      const target = new URL(output.get('Location') || remote.href, remote);
      if (target.origin !== source.origin || !target.pathname.startsWith(source.pathname)) return error(502, '页面跳转无效');
      let targetPath = '/' + target.pathname.slice(source.pathname.length);
      targetPath = targetPath.replace(/^\/prototypes\/haiz-world\/public\/haiz\/world\//, '/world/').replace(/^\/prototypes\/haiz-world\/public\/haiz\//, '/haiz/');
      output.set('Location', targetPath + target.search); return new Response(null, { status: response.status, headers: output });
    }
    if (output.get('Content-Type')?.includes('text/html')) {
      if (!identity) { const failure = await identify(); if (failure) return failure; }
      if (request.method === 'HEAD') return new Response(null, { status: response.status, headers: output });
      let html = await response.text();
      html = html.replace(/<head(?:\s[^>]*)?>/i, head => head + `<script src="/account/session-guard.js" data-haiz-user="${identity.id}"></script>`);
      if (path.startsWith('/world/flow/') || path.startsWith('/world/stillroom/')) html = html.replace(/<head(?:\s[^>]*)?>/i, head => head + `<base href="${path.startsWith('/world/flow/') ? '/world/flow/' : '/world/stillroom/'}"><script>window.HAIZ_PILOT=true;window.HAIZ_BACKEND=true;</script>`);
      if (!/\/(?:atlas-engine|campus|immersive)\//.test(path)) html = html.replace(/<\/body>/i, '<a href="/account/" aria-label="我的数据与账号" style="position:fixed;right:16px;top:86px;z-index:2147483000;background:#faf8f2;color:#244d42;border:1px solid #b8c4b3;border-radius:6px;padding:10px 14px;font:14px/24px sans-serif;text-decoration:none">我的数据</a></body>');
      output.delete('Content-Length'); output.delete('Content-Encoding'); output.set('Vary', 'Cookie');
      output.delete('ETag');
      return new Response(html, { status: response.status, headers: output });
    }
    output.set('Cache-Control', 'public, max-age=300');
    return new Response(response.body, { status: response.status, headers: output });
  };
}
