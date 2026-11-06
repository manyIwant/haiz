import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
const origin = 'https://haiz.example', password = 'haiz-cloud-runtime-password!';
test('real workerd runs scrypt, sessions, isolated recovery, teacher publication and live SSE', async () => {
  // Miniflare's HTTP bridge rewrites Host to its loopback port while retaining
  // the supplied public URL. Normalize only that test transport before invoking
  // the actual application, whose Host check stays enabled in production.
  const bundle = await build({ stdin: { contents: `import worker, {HaizBackend} from './worker.mjs'; export {HaizBackend}; export default {fetch(request,env,ctx){const headers=new Headers(request.headers);headers.set('Host',new URL(request.url).host);return worker.fetch(new Request(request,{headers}),env,ctx)}};`, resolveDir: fileURLToPath(new URL('../', import.meta.url)), sourcefile: 'runtime-probe.mjs' }, bundle: true, write: false, format: 'esm', platform: 'browser', external: ['cloudflare:workers','node:*'] });
  const script = bundle.outputFiles[0].text;
  const invite = 'runtime-bootstrap-invite-'.padEnd(43, 'x');
  const mf = new Miniflare({ modules: true, script, compatibilityDate: '2026-08-06', compatibilityFlags: ['nodejs_compat'],
    durableObjects: { HAIZ_DB: { className: 'HaizBackend', useSQLite: true } },
    bindings: { PUBLIC_ORIGIN: origin, REGISTRATION: '1', BOOTSTRAP_INVITE: invite } });
  const call = async (path, { method, body, cookie, headers = {} } = {}) => {
    const response = await mf.dispatchFetch(origin + path, { method: method || (body === undefined ? 'GET' : 'POST'),
      headers: { Host: 'haiz.example', Origin: origin, 'CF-Connecting-IP': '203.0.113.8', ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const raw = await response.text(); let data; try { data = JSON.parse(raw); } catch { data = raw; }
    return { response, status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  let stream;
  try {
    const health = await call('/api/health'); assert.equal(health.status, 200, JSON.stringify(health.data));
    const a = await call('/api/auth/register', { body: { username: 'cloud-first', password } });
    assert.equal(a.status, 201, JSON.stringify(a.data)); assert.match(a.response.headers.get('set-cookie'), /__Host-haiz_session=.*Secure/);
    const b = await call('/api/auth/register', { body: { username: 'cloud-second', password } }); assert.equal(b.status, 201, JSON.stringify(b.data));
    const route = '/api/v1/data/notes/private-note';
    const put = await call(route, { method: 'PUT', cookie: a.cookie, body: { expectedRevision: 0, data: { title: '云端真实记录', text: '先保存再恢复' } } }); assert.equal(put.status, 200, JSON.stringify(put.data));
    assert.equal((await call(route, { cookie: b.cookie })).status, 404);
    assert.equal((await call('/api/v1/usage', { cookie: b.cookie, headers: { 'X-HAIZ-User': a.data.identity.id } })).status, 409);
    assert.equal((await call(route, { method: 'DELETE', cookie: a.cookie, body: { expectedRevision: 1 } })).status, 200);
    assert.equal((await call('/api/v1/trash/notes', { cookie: a.cookie })).data.items[0].data.title, '云端真实记录');
    assert.equal((await call(route + '/restore', { cookie: a.cookie, body: { expectedRevision: 2 } })).data.item.revision, 3);
    assert.equal((await call('/api/v1/search?q=' + encodeURIComponent('云端真实'), { cookie: a.cookie })).data.items.length, 1);
    const admin = await call('/api/flow/login', { body: { invite } }); assert.equal(admin.status, 200, JSON.stringify(admin.data));
    const issued = await call('/api/flow/admin/invite', { cookie: admin.cookie, body: { username: 'teacher-cloud', role: 'teacher', scope: '一班' } }); assert.equal(issued.status, 201);
    const teacher = await call('/api/flow/login', { body: { invite: issued.data.invite } }); assert.equal(teacher.status, 200);
    const draft = await call('/api/flow/drafts', { cookie: teacher.cookie, body: { id: 'runtime-draft', expectedRevision: 0, scope: '一班', title: '云端课堂', body: '私人正文', summary: '公开摘要', startsAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString() } }); assert.equal(draft.status, 200, JSON.stringify(draft.data));
    assert.equal((await call('/api/flow/publish', { cookie: teacher.cookie, body: { id: 'runtime-draft', expectedRevision: 1, confirmed: true, confirmedSummary: '公开摘要' } })).status, 200);
    const events = await mf.dispatchFetch(origin + '/api/v1/rooms/campus/events?user=' + a.data.identity.id, { headers: { Host: 'haiz.example', Cookie: a.cookie, 'CF-Connecting-IP': '203.0.113.8' } });
    assert.equal(events.status, 200); assert.match(events.headers.get('content-type'), /text\/event-stream/); stream = events.body.getReader();
    let text = ''; while (!text.includes('event: snapshot')) text += new TextDecoder().decode((await stream.read()).value);
    const snapshot = JSON.parse(/event: snapshot\ndata: ([^\n]+)/.exec(text)[1]); assert.equal(snapshot.members.length, 1);
    assert.equal((await call('/api/v1/rooms/campus/messages', { cookie: a.cookie, body: { connectionId: snapshot.connectionId, text: '真实云运行时消息' } })).status, 200);
    let message = ''; while (!message.includes('event: message')) message += new TextDecoder().decode((await stream.read()).value); assert.match(message, /真实云运行时消息/);
    assert.equal((await call('/api/auth/logout', { cookie: a.cookie, body: {} })).status, 200);
    assert.equal((await call('/api/auth/session', { cookie: a.cookie })).status, 401);
    const login = await call('/api/auth/login', { body: { username: 'cloud-first', password } }); assert.equal(login.status, 200, JSON.stringify(login.data));
    assert.equal((await call(route, { cookie: login.cookie })).data.item.data.title, '云端真实记录');
  } finally { await stream?.cancel(); await mf.dispose(); }
});
