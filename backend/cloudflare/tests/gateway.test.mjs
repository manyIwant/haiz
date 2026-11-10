import test from 'node:test';
import assert from 'node:assert/strict';
import { createGateway } from '../gateway.mjs';
const origin = 'https://haiz.example';
function fixture(authenticated = false) {
  const seen = [];
  const backend = { fetch: async request => {
    seen.push(request);
    if (new URL(request.url).pathname === '/api/v1/auth/me') return Response.json(authenticated ? { identity: { id: 'verified-owner' } } : { error: '请先登录' }, { status: authenticated ? 200 : 401 });
    return Response.json({ ok: true, ip: request.headers.get('x-haiz-client-ip') });
  } };
  const gateway = createGateway({ backend, assets: { fetch: async () => new Response('local-asset') }, origin,
    fetch: async request => { seen.push(request); return new Response('<html><head><title>existing site</title></head><body>原站</body></html>', { headers: { 'content-type': new URL(request.url).pathname.endsWith('.webp') ? 'image/webp' : 'text/html', 'content-length': '999', 'set-cookie': 'foreign=secret' } }); } });
  const request = (path, init = {}) => new Request(origin + path, { ...init, headers: { 'CF-Connecting-IP': '203.0.113.7', ...init.headers } });
  return { gateway, request, seen };
}
test('anonymous HTML is gated while lamp login and public assets remain accessible', async () => {
  const f = fixture(); const response = await f.gateway(f.request('/'));
  assert.equal(response.status, 302); assert.equal(response.headers.get('location'), '/login/?next=%2F');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(await (await f.gateway(f.request('/login/'))).text(), 'local-asset');
  const asset = await f.gateway(f.request('/assets/photo.webp')); assert.equal(asset.status, 200);
});
test('API forwarding overwrites client-provided internal IP and does not rewrite Origin', async () => {
  const f = fixture(); const response = await f.gateway(f.request('/api/health', { headers: { 'X-HAIZ-Client-IP': '192.0.2.99', Origin: 'https://evil.example' } }));
  assert.equal((await response.json()).ip, '203.0.113.7');
  assert.equal(f.seen[0].headers.get('Origin'), 'https://evil.example');
});
test('verified upstream HTML receives identity guard and cannot carry cached or foreign cookies', async () => {
  const f = fixture(true), response = await f.gateway(f.request('/journal.html'));
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('content-length'), null); assert.equal(response.headers.get('set-cookie'), null);
  const html = await response.text(); assert.match(html, /existing site/); assert.match(html, /data-haiz-user="verified-owner"/); assert.match(html, /\/account\/session-guard.js/); assert.match(html, /href="\/account\/"/);
});
test('source files, encoded hidden paths and off-origin requests never reach static upstream', async () => {
  const f = fixture(true);
  for (const path of ['/backend/server.mjs','/src/private.js','/%2eenv','/package.json','/docs/private.txt','/a%5cb']) assert.equal((await f.gateway(f.request(path))).status, 404, path);
  assert.equal((await f.gateway(new Request('https://evil.example/'))).status, 403);
  assert.equal(f.seen.length, 0);
});
test('Flow aliases map to existing main resources without exposing arbitrary origin fetching', async () => {
  const f = fixture(true); await f.gateway(f.request('/world/flow/'));
  assert.equal(f.seen.at(-1).url, 'https://raw.githubusercontent.com/manyIwant/haiz/main/prototypes/haiz-world/public/haiz/world/flow/index.html');
});
