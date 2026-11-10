import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../../database.mjs';
import { hash, passwords } from '../../auth.mjs';
const password = 'haiz-cloud-password-123', origin = 'https://haiz.example';
async function fixture(env = {}) {
  const { createCloudApi } = await import('../api.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'haiz-cloud-api-')), database = await openDatabase(directory), invitation = randomUUID();
  await database.call('bootstrap', { tokenHash: hash(invitation), inviteMs: 1800000 });
  const closed = [], rooms = { metrics: { rooms: 0, connections: 0 }, closeUser: id => closed.push(['user', id]), closeSession: id => closed.push(['session', id]), join: async () => new Response('data: {}\n\n', { headers: { 'content-type': 'text/event-stream' } }), post: () => ({ ok: true }) };
  const api = createCloudApi({ database, env: { PUBLIC_ORIGIN: origin, ...env }, rooms });
  const request = (path, { method, body, cookie, headers = {}, raw } = {}) => new Request(origin + path, { method: method || (body === undefined && raw === undefined ? 'GET' : 'POST'), headers: { Origin: origin, 'X-HAIZ-Client-IP': '2001:db8::1', ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined && raw === undefined ? {} : { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() }), ...headers }, ...(body === undefined && raw === undefined ? {} : { body: raw ?? JSON.stringify(body) }) });
  const call = async (path, options = {}) => { const response = await api.fetch(request(path, options)); return { status: response.status, data: await response.json(), headers: response.headers, cookie: response.headers.get('set-cookie')?.split(';')[0] }; };
  const admin = await call('/api/flow/login', { body: { invite: invitation } }); assert.equal(admin.status, 200, JSON.stringify(admin.data));
  const register = async (name = 'cloud-' + randomUUID().slice(0, 8)) => { const result = await call('/api/auth/register', { body: { username: name, password } }); assert.equal(result.status, 201, JSON.stringify(result.data)); return result; };
  const provision = async (role = 'teacher', scope = '一班') => {
    const issued = await call('/api/flow/admin/invite', { cookie: admin.cookie, body: { username: role + '-' + randomUUID().slice(0, 8), role, scope, scopes: [scope] } }); assert.equal(issued.status, 201, JSON.stringify(issued.data));
    const result = await call('/api/flow/login', { body: { invite: issued.data.invite } }); assert.equal(result.status, 200, JSON.stringify(result.data)); return result;
  };
  return { database, api, call, request, admin, register, provision, closed, close: async () => { await database.close(); await rm(directory, { recursive: true, force: true }); } };
}

test('cloud API validates origin and secure verified session identity through aliases', async () => {
  const f = await fixture(); try {
    const a = await f.register('Cloud-Alice'); assert.equal(a.data.identity.role, 'student');
    assert.match(a.headers.get('set-cookie'), /^__Host-haiz_session=[\w-]{43}; Path=\/; HttpOnly; SameSite=Strict; Secure; Max-Age=28800$/);
    assert.equal((await f.call('/api/auth/session', { cookie: a.cookie })).data.identity.name, 'cloud-alice');
    const verified = await f.api.authenticate(f.request('/', { cookie: a.cookie })); assert.equal(verified.identity.id, a.data.identity.id); assert.equal(verified.userId, verified.identity.id); assert.match(verified.tokenHash, /^[a-f0-9]{64}$/);
    const login = await f.call('/api/auth/login', { body: { username: 'cloud-alice', password, remember: false } }); assert.equal(login.status, 200); assert.ok(!login.headers.get('set-cookie').includes('Max-Age'));
    assert.equal((await f.call('/api/auth/login', { body: { username: 'cloud-alice', password: 'wrong-password' } })).status, 401);
    for (const headers of [{ Origin: 'https://evil.test' }, { Host: 'evil.test' }, { 'Sec-Fetch-Site': 'cross-site' }, { 'X-HAIZ-Client-IP': '' }, { 'X-HAIZ-Client-IP': '1.2.3.4,5.6.7.8' }]) assert.equal((await f.call('/api/health', { headers })).status, 403);
    const changed = await f.call('/api/auth/session', { cookie: a.cookie, headers: { 'X-HAIZ-User': 'wrong-user' } }); assert.equal(changed.status, 409); assert.equal(changed.data.identityChanged, true); assert.equal(changed.headers.get('x-haiz-user'), a.data.identity.id); assert.equal(changed.data.requestId, changed.headers.get('x-request-id'));
    await f.call('/api/auth/logout', { cookie: a.cookie, body: {} }); assert.equal((await f.call('/api/auth/session', { cookie: a.cookie })).status, 401); assert.ok(f.closed.some(([kind]) => kind === 'session'));
  } finally { await f.close(); }
});

test('cloud API fails closed on methods, JSON format, body size and write Origin', async () => {
  const f = await fixture(); try {
    assert.equal((await f.call('/api/v1/auth/config')).data.registration, true); assert.equal((await f.call('/api/health', { method: 'HEAD' })).status, 405); assert.equal((await f.call('/api/unknown')).status, 404);
    for (const [options, status] of [[{ body: {}, headers: { Origin: '' } }, 403], [{ raw: '{}', headers: { 'Content-Type': 'text/plain' } }, 415], [{ raw: '{}', headers: { 'Content-Encoding': 'gzip' } }, 415], [{ raw: '{broken' }, 400], [{ body: [] }, 400], [{ body: { extra: 'x'.repeat(65536) } }, 413], [{ body: {}, headers: { 'Content-Length': '65537' } }, 413]]) assert.equal((await f.call('/api/auth/register', options)).status, status);
    assert.equal((await f.call('/api/ready')).data.ok, true);
  } finally { await f.close(); }
});

test('cloud recovery and personal queries preserve revisions and forbid cross account access', async () => {
  const f = await fixture(); try {
    const a = await f.register(), b = await f.register(), route = '/api/v1/data/notes/private'; const write = (method, body) => f.call(route, { method, cookie: a.cookie, body });
    assert.equal((await write('PUT', { data: { text: 'private-first' }, expectedRevision: 0 })).status, 200); assert.equal((await write('PUT', { data: { text: 'private-second' }, expectedRevision: 1 })).status, 200); assert.equal((await write('DELETE', { expectedRevision: 2 })).status, 200);
    assert.deepEqual((await f.call(route + '/history', { cookie: a.cookie })).data.items.map(i => i.revision), [3, 2, 1]); assert.equal((await f.call('/api/v1/trash/notes', { cookie: a.cookie })).data.items[0].data.text, 'private-second');
    const stale = await f.call(route + '/restore', { cookie: a.cookie, body: { expectedRevision: 2 } }); assert.equal(stale.status, 409); assert.equal(stale.data.remote.revision, 3);
    const restored = await f.call(route + '/restore', { cookie: a.cookie, body: { expectedRevision: 3, revision: 1 } }); assert.equal(restored.status, 200); assert.equal(restored.data.item.revision, 4); assert.equal(restored.data.item.data.text, 'private-first');
    assert.equal((await f.call('/api/v1/search?q=private', { cookie: a.cookie })).data.items[0].id, 'private'); assert.equal((await f.call('/api/v1/usage', { cookie: a.cookie })).data.totals.active, 1); assert.ok((await f.call('/api/v1/activity', { cookie: a.cookie })).data.events.length);
    for (const viewer of [b, f.admin]) { assert.equal((await f.call(route + '/history', { cookie: viewer.cookie })).status, 404); assert.equal((await f.call(route + '/restore', { cookie: viewer.cookie, body: { expectedRevision: 0, revision: 1 } })).status, 404); assert.deepEqual((await f.call('/api/v1/search?q=private', { cookie: viewer.cookie })).data.items, []); assert.equal((await f.call('/api/v1/usage', { cookie: viewer.cookie })).data.totals.active, 0); }
    const changed = await f.call(route + '/restore', { cookie: b.cookie, body: { expectedRevision: 0 }, headers: { 'X-HAIZ-User': a.data.identity.id } }); assert.equal(changed.status, 409); assert.equal(changed.data.identityChanged, true);
    for (const [path, method] of [[route + '/history', 'POST'], [route + '/restore', 'GET'], ['/api/v1/trash/notes', 'POST'], ['/api/v1/search?q=x', 'POST'], ['/api/v1/usage', 'POST'], ['/api/v1/activity', 'POST']]) assert.equal((await f.call(path, { cookie: a.cookie, method, ...(method === 'POST' ? { body: {} } : {}) })).status, 405);
  } finally { await f.close(); }
});

test('cloud Flow preserves idempotency, publication projection and administrator contracts', async () => {
  const f = await fixture(); try {
    const teacher = await f.provision(), other = await f.provision('teacher', '二班'), display = await f.provision('display'); const d = { id: randomUUID(), expectedRevision: 0, title: '实验准备', body: '私人教师正文', materialNotes: '私人课件路径', summary: '带好记录纸', scope: '一班', startsAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString() };
    const key = randomUUID(), save = body => f.call('/api/flow/drafts', { cookie: teacher.cookie, headers: { 'Idempotency-Key': key }, body }); const first = await save(d), again = await save(d); assert.equal(first.status, 200); assert.deepEqual(again.data, first.data); assert.equal((await save({ ...d, title: 'changed' })).status, 409); assert.deepEqual((await f.call('/api/flow/drafts', { cookie: other.cookie })).data.drafts, []);
    const published = await f.call('/api/flow/publish', { cookie: teacher.cookie, body: { id: d.id, expectedRevision: 1, confirmed: true, confirmedSummary: d.summary } }); assert.equal(published.status, 200); const feed = await f.call('/api/flow/feed', { cookie: display.cookie }); assert.equal(feed.data.notices.length, 1); assert.ok(!JSON.stringify(feed.data).includes('私人'));
    assert.equal((await f.call('/api/flow/revoke', { cookie: teacher.cookie, body: { id: published.data.notice.id, expectedRevision: 1 } })).status, 200); assert.deepEqual((await f.call('/api/flow/feed', { cookie: display.cookie })).data.notices, []); assert.equal((await f.call('/api/v1/admin/metrics', { cookie: teacher.cookie })).status, 403);
    const metrics = await f.call('/api/v1/admin/metrics', { cookie: f.admin.cookie }); assert.equal(metrics.status, 200); assert.equal(metrics.data.hosting.plan, 'free'); assert.equal(metrics.data.backup.provider, 'cloudflare-time-travel'); assert.equal(metrics.data.backup.retentionDays, 30); assert.equal(metrics.data.backup.localSnapshots, false); assert.ok(!JSON.stringify(metrics.data).includes('BOOTSTRAP_INVITE')); assert.ok(!JSON.stringify(metrics.data).includes('/tmp/'));
  } finally { await f.close(); }
});

test('cloud auth closes room sessions on password, logout all and own-session revocation', async () => {
  const f = await fixture(); try {
    const a = await f.register(), auth = await f.api.authenticate(f.request('/', { cookie: a.cookie })); assert.equal((await f.call('/api/v1/rooms', { cookie: a.cookie })).data.rooms[0], 'campus');
    const events = await f.api.fetch(f.request('/api/v1/rooms/campus/events?user=' + a.data.identity.id, { cookie: a.cookie })); assert.equal(events.status, 200); assert.match(events.headers.get('content-type'), /event-stream/); await events.body.cancel(); assert.equal((await f.call('/api/v1/rooms/campus/events?user=wrong', { cookie: a.cookie })).status, 409); assert.equal((await f.call('/api/v1/rooms/campus/messages', { cookie: a.cookie, body: { text: 'hi' } })).status, 200);
    assert.equal((await f.call('/api/v1/auth/revoke', { cookie: a.cookie, body: { id: auth.sessionId } })).status, 200); assert.ok(f.closed.some(([kind, id]) => kind === 'session' && id === auth.sessionId));
    const next = await f.call('/api/auth/login', { body: { username: a.data.identity.name, password } }); assert.equal((await f.call('/api/v1/auth/password', { cookie: next.cookie, body: { currentPassword: password, password: password + '-new' } })).status, 200); assert.equal((await f.call('/api/auth/session', { cookie: next.cookie })).status, 401);
    const last = await f.call('/api/auth/login', { body: { username: a.data.identity.name, password: password + '-new' } }); assert.equal((await f.call('/api/v1/auth/logout-all', { cookie: last.cookie, body: {} })).status, 200); assert.ok(f.closed.some(([kind, id]) => kind === 'user' && id === a.data.identity.id));
  } finally { await f.close(); }
});

test('password hashing can limit memory to one derivation without changing credentials', async () => {
  const auth = passwords({ maxConcurrent: 1 }), first = auth.create(password); await assert.rejects(auth.create(password), error => error.status === 503); const encoded = await first; assert.match(encoded, /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/); assert.equal(await auth.verify(password, encoded), true);
});

test('cloud body streams enforce a read deadline and a limit without trusting Content-Length', async () => {
  const f = await fixture(); try {
    const make = body => new Request(origin + '/api/auth/register', { method: 'POST', headers: { Origin: origin, 'X-HAIZ-Client-IP': '127.0.0.1', 'Content-Type': 'application/json' }, body, duplex: 'half' });
    let cancelled = false;
    const large = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(65537)); }, cancel() { cancelled = true; } });
    assert.equal((await f.api.fetch(make(large))).status, 413); assert.equal(cancelled, true);
    const stalled = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{')); } });
    const response = await f.api.fetch(make(stalled)); assert.equal(response.status, 408); assert.match((await response.json()).error, /超时/);
  } finally { await f.close(); }
});

test('cloud validates development and registration configuration without accepting arbitrary HTTP', async () => {
  const { createCloudApi } = await import('../api.mjs');
  for (const env of [{}, { PUBLIC_ORIGIN: 'http://haiz.example' }, { PUBLIC_ORIGIN: origin + '/path' }, { PUBLIC_ORIGIN: origin + '?secret=1' }, { PUBLIC_ORIGIN: 'http://evil.test', DEV: '1' }, { PUBLIC_ORIGIN: origin, DEV: '1' }]) assert.throws(() => createCloudApi({ env }), error => error.status === 500);
  const f = await fixture({ REGISTRATION: '0' }); try {
    assert.equal((await f.call('/api/v1/auth/config')).data.registration, false);
    assert.equal((await f.call('/api/auth/register', { body: { username: 'no-register', password } })).status, 403);
    const api = createCloudApi({ database: f.database, env: { PUBLIC_ORIGIN: 'http://localhost:8787', DEV: '1' } });
    const response = await api.fetch(new Request('http://localhost:8787/api/health', { headers: { 'X-HAIZ-Client-IP': '::1' } })); assert.equal(response.status, 200); assert.equal(response.headers.get('strict-transport-security'), null);
  } finally { await f.close(); }
});

test('cloud personal writes recheck the session after awaiting the body', async () => {
  const f = await fixture(); try {
    const a = await f.register(), auth = await f.api.authenticate(f.request('/', { cookie: a.cookie }));
    let controller; const body = new ReadableStream({ start(value) { controller = value; } });
    const pending = f.api.fetch(new Request(origin + '/api/v1/data/notes/revoked', { method: 'PUT', headers: { Origin: origin, 'X-HAIZ-Client-IP': '127.0.0.1', 'Content-Type': 'application/json', Cookie: a.cookie }, body, duplex: 'half' }));
    await new Promise(resolve => setTimeout(resolve, 10));
    await f.database.call('logout', { sessionId: auth.sessionId });
    controller.enqueue(new TextEncoder().encode(JSON.stringify({ expectedRevision: 0, data: { text: 'must not be committed' } }))); controller.close();
    assert.equal((await pending).status, 401);
  } finally { await f.close(); }
});

test('private cloud bootstrap invite can renew after unclaimed expiry but cannot reset an established admin password', async () => {
  const { createCloudApi } = await import('../api.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'haiz-cloud-bootstrap-')), database = await openDatabase(directory), invitation = 'cloud-private-bootstrap-'.padEnd(43,'x');
  const rooms = { closeUser(){}, closeSession(){}, metrics:{rooms:0,connections:0} };
  const api = createCloudApi({database,rooms,env:{PUBLIC_ORIGIN:origin,BOOTSTRAP_INVITE:invitation}});
  const call = async (path,body,cookie) => {const response=await api.fetch(new Request(origin+path,{method:'POST',headers:{Origin:origin,'X-HAIZ-Client-IP':'203.0.113.1','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)}));return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
  try {
    await database.call('bootstrap',{tokenHash:hash(invitation),inviteMs:1});await new Promise(resolve=>setTimeout(resolve,10));
    const recovered=await call('/api/flow/login',{invite:invitation});assert.equal(recovered.status,200,JSON.stringify(recovered.data));
    assert.equal((await call('/api/flow/login',{invite:invitation})).status,401);
    assert.equal((await call('/api/v1/auth/password',{password},recovered.cookie)).status,200);
    assert.equal((await call('/api/flow/login',{invite:invitation})).status,401);
    assert.equal((await call('/api/auth/login',{username:'admin',password})).status,200);
  }finally{await database.close();await rm(directory,{recursive:true,force:true});}
});
