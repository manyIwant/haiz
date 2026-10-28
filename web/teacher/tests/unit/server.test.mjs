import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createTeacherServer } from '../../server.mjs';

async function listen(t, server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return `http://127.0.0.1:${server.address().port}`;
}

async function fixture(t, handler, options = {}) {
  const upstream = await listen(t, createServer(handler));
  const origin = await listen(t, createTeacherServer({ academicOrigin: upstream, ...options }));
  return { origin, upstream };
}

const json = (res, data) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };

test('only browser assets are served and documents have strict CSP', async t => {
  const { origin } = await fixture(t, (_req, res) => json(res, {}));
  for (const path of ['/package.json', '/package-lock.json', '/server.mjs', '/tests/unit/api.test.mjs', '/ios_skin.css', '/js/%2e%2e/package.json', '/css/tokens.css%00']) {
    assert.equal((await fetch(origin + path)).status, 404, path);
  }
  for (const path of ['/', '/classroom.html', '/js/api.js', '/css/tokens.css']) assert.equal((await fetch(origin + path)).status, 200, path);
  const response = await fetch(origin);
  assert.match(response.headers.get('content-security-policy'), /script-src 'self'/);
  assert.doesNotMatch(response.headers.get('content-security-policy'), /unsafe-inline/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});

test('cross-site writes are refused before upstream and v1 headers survive', async t => {
  let requests = 0;
  const { origin } = await fixture(t, async (req, res) => {
    requests++;
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    res.setHeader('Set-Cookie', 'hsid=synthetic; HttpOnly; SameSite=Strict; Path=/');
    json(res, { headers: req.headers, body: Buffer.concat(chunks).toString() });
  });
  const path = '/api/v1/classes/synthetic/assignments';
  for (const headers of [{ Origin: 'https://other.example' }, { 'Sec-Fetch-Site': 'cross-site' }, { Origin: origin, 'Sec-Fetch-Site': 'cross-site' }]) {
    assert.equal((await fetch(origin + path, { method: 'POST', headers, body: '{}' })).status, 403);
  }
  assert.equal(requests, 0);
  const response = await fetch(origin + path, { method: 'POST', headers: { Origin: origin, Cookie: 'hsid=test', Authorization: 'Bearer synthetic', 'Idempotency-Key': 'synthetic_key', 'Content-Type': 'application/json' }, body: '{"title":"test"}' });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  const { headers, body } = await response.json();
  assert.equal(headers.origin, undefined);
  assert.equal(headers.cookie, 'hsid=test');
  assert.equal(headers.authorization, 'Bearer synthetic');
  assert.equal(headers['idempotency-key'], 'synthetic_key');
  assert.equal(body, '{"title":"test"}');
});

test('legacy publishing is blocked while management and v1 remain reachable', async t => {
  const { origin } = await fixture(t, (req, res) => json(res, { path: req.url }));
  for (const [path, method] of [['/api/classes/class1/assignments', 'POST'], ['/api/classes/class1/assignments?retry=1', 'POST'], ['/api/classes/class1/inbox/item1/publish', 'POST'], ['/api/assignments/a1', 'PATCH'], ['/api/assignments/a1', 'DELETE']]) {
    const response = await fetch(origin + path, { method });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, 'USE_ONE_PUBLISH');
  }
  for (const [path, method] of [['/api/classes', 'POST'], ['/api/v1/assignments/a1', 'PATCH'], ['/api/classes/class1/inbox/item1/dismiss', 'POST']]) {
    assert.equal((await fetch(origin + path, { method })).status, 200);
  }
});

test('management console assets are mapped and absolute asset references are rewritten', async t => {
  const { origin } = await fixture(t, (req, res) => {
    if (req.url === '/index.html') {
      res.setHeader('Content-Type', 'text/html');
      return res.end('<link href="/ui.css"><script src="/app.js"></script>');
    }
    res.end(req.url);
  });
  const consolePage = await fetch(origin + '/academic/');
  assert.equal(consolePage.status, 200);
  assert.equal(await consolePage.text(), '<link href="/academic/ui.css"><script src="/academic/app.js"></script>');
  assert.match(consolePage.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(await (await fetch(origin + '/academic/app.js')).text(), '/app.js');
  assert.equal((await fetch(origin + '/academic/server.mjs')).status, 404);
});

test('upstream deadline covers a stalled response body', async t => {
  const { origin } = await fixture(t, (_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write('{');
  }, { upstreamTimeoutMs: 40 });
  const response = await fetch(origin + '/api/v1/identity', { signal: AbortSignal.timeout(2000) });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'ACADEMIC_UNAVAILABLE');
});

test('expected actor is checked with the exact incoming cookie before a mutation', async t => {
  const seen = [];
  const { origin } = await fixture(t, (req, res) => {
    seen.push({ path: req.url, cookie: req.headers.cookie });
    if (req.url === '/api/v1/identity') return json(res, { data: { instanceId: 'school', userId: req.headers.cookie === 'hsid=A' ? 'A' : 'B' } });
    json(res, { data: { accepted: true } });
  });
  const headers = { Cookie: 'hsid=B', 'X-HAIZ-Expected-Actor': encodeURIComponent(JSON.stringify(['school', 'A'])) };
  const blocked = await fetch(origin + '/api/v1/assignments/a1/publish', { method: 'POST', headers, body: '{}' });
  assert.equal(blocked.status, 401);
  assert.equal(seen.filter(item => item.path.endsWith('/publish')).length, 0);
  const accepted = await fetch(origin + '/api/v1/assignments/a1/publish', { method: 'POST', headers: { ...headers, Cookie: 'hsid=A' }, body: '{}' });
  assert.equal(accepted.status, 200);
  assert.deepEqual(seen.slice(-2).map(item => item.cookie), ['hsid=A', 'hsid=A']);
});

test('only fixed HTTP origins are accepted as upstream configuration', () => {
  for (const academicOrigin of ['file:///etc/passwd', 'http://user:password@localhost', 'https://example.com/api', 'http://localhost?x=1', 'http://localhost/#x']) {
    assert.throws(() => createTeacherServer({ academicOrigin }), /origin/);
  }
});
