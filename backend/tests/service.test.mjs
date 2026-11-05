import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, copyFile, mkdir, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import http from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';

const password = 'haiz-test-password-123';
async function fixture(options = {}) {
  const { createService } = await import('../server.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'haiz-service-'));
  let service = await createService({ directory, development: true, port: 0, logger: () => {}, ...options });
  await service.listen();
  let origin = service.origin;
  const call = async (path, { method, body, cookie, headers = {}, ...rest } = {}) => {
    const response = await fetch(origin + path, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), ...rest,
    });
    const raw = await response.text();
    let data; try { data = JSON.parse(raw); } catch { data = raw; }
    return { status: response.status, data, headers: response.headers, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  const invite = (await readFile(service.bootstrapFile, 'utf8')).trim();
  const admin = await call('/api/flow/login', { body: { invite } });
  assert.equal(admin.status, 200, JSON.stringify(admin.data));
  const register = async (username = 'student-' + randomUUID().slice(0, 8)) => {
    const result = await call('/api/v1/auth/register', { body: { username, password } });
    assert.equal(result.status, 201, JSON.stringify(result.data));
    return result;
  };
  const provision = async (role = 'teacher', scope = '一班') => {
    const issued = await call('/api/flow/admin/invite', { cookie: admin.cookie,
      body: { username: role + '-' + randomUUID().slice(0, 8), role, scope, scopes: [scope] } });
    assert.equal(issued.status, 201, JSON.stringify(issued.data));
    const logged = await call('/api/flow/login', { body: { invite: issued.data.invite } });
    assert.equal(logged.status, 200, JSON.stringify(logged.data));
    return { ...logged, invite: issued.data.invite };
  };
  return { directory, call, admin, register, provision, get service() { return service; }, get origin() { return origin; },
    restart: async () => { await service.close(); service = await createService({ directory, development: true, port: 0, logger: () => {}, ...options }); await service.listen(); origin = service.origin; },
    close: async () => { await service.close(); await rm(directory, { recursive: true, force: true }); } };
}

test('accounts, one-use invitations, safe cookies, password login and durable sessions', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.call('/api/v1/auth/me')).status, 401);
    const a = await f.register('Alice');
    assert.equal(a.data.identity.name, 'alice');
    assert.equal(a.data.identity.role, 'student');
    assert.match(a.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
    assert.ok(!JSON.stringify(a.data).includes(password));
    assert.equal((await f.call('/api/v1/auth/register', { body: { username: 'alice', password, role: 'admin' } })).status, 409);
    assert.equal((await f.call('/api/v1/auth/login', { body: { username: 'alice', password: 'wrong-password-123' } })).status, 401);
    const login = await f.call('/api/v1/auth/login', { body: { username: 'alice', password } });
    assert.equal(login.status, 200);
    const teacher = await f.provision();
    assert.equal((await f.call('/api/flow/login', { body: { invite: teacher.invite } })).status, 401);
    await f.restart();
    assert.equal((await f.call('/api/v1/auth/me', { cookie: login.cookie })).data.identity.name, 'alice');
    await f.call('/api/v1/auth/logout', { body: {}, cookie: login.cookie });
    assert.equal((await f.call('/api/v1/auth/me', { cookie: login.cookie })).status, 401);
    const db = new DatabaseSync(join(f.directory, 'haiz.sqlite'), { readOnly: true });
    const user = db.prepare('SELECT password_hash FROM users WHERE name=?').get('alice');
    assert.ok(user.password_hash && !user.password_hash.includes(password));
    const tokens = db.prepare('SELECT token_hash FROM sessions').all();
    assert.ok(!JSON.stringify(tokens).includes(a.cookie.split('=')[1]));
    assert.equal(db.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
    db.close();
    assert.equal((await stat(join(f.directory, 'haiz.sqlite'))).mode & 0o077, 0);
  } finally { await f.close(); }
});

test('personal data is isolated, revision checked, paginated, tombstoned and survives restart', async () => {
  const f = await fixture();
  try {
    const a = await f.register(), b = await f.register();
    const route = '/api/v1/data/notes/my-note';
    const saved = await f.call(route, { method: 'PUT', cookie: a.cookie, body: { expectedRevision: 0, data: { text: '私人便签' } } });
    assert.equal(saved.status, 200);
    assert.equal(saved.data.item.revision, 1);
    assert.equal((await f.call(route, { cookie: b.cookie })).status, 404);
    const results = await Promise.all(['甲', '乙'].map(text => f.call(route, { method: 'PUT', cookie: a.cookie, body: { expectedRevision: 1, data: { text } } })));
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    assert.equal((await f.call('/api/v1/data/notes', { cookie: a.cookie })).data.items.length, 1);
    await f.restart();
    assert.equal((await f.call(route, { cookie: a.cookie })).data.item.revision, 2);
    assert.equal((await f.call(route, { method: 'DELETE', cookie: a.cookie, body: { expectedRevision: 2 } })).status, 200);
    assert.equal((await f.call(route, { cookie: a.cookie })).status, 404);
    assert.equal((await f.call(route, { method: 'PUT', cookie: a.cookie, body: { expectedRevision: 0, data: {} } })).status, 409);
    for (const id of ['a', 'b', 'c']) await f.call('/api/v1/data/bookmarks/' + id, { method: 'PUT', cookie: a.cookie, body: { expectedRevision: 0, data: { place: id } } });
    const page = await f.call('/api/v1/data/bookmarks?limit=2', { cookie: a.cookie });
    assert.equal(page.data.items.length, 2);
    assert.ok(page.data.nextCursor);
    assert.equal((await f.call('/api/v1/data/bookmarks?limit=2&cursor=' + page.data.nextCursor, { cookie: a.cookie })).data.items.length, 1);
  } finally { await f.close(); }
});

const draft = (scope = '一班') => ({ id: randomUUID(), expectedRevision: 0, title: '实验准备', body: '私人教师正文',
  materialNotes: '私人课件路径', summary: '带好记录纸', scope, startsAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString() });

test('Flow uses transactional idempotency, ownership, revision conflicts and public projection', async () => {
  const f = await fixture();
  try {
    const a = await f.provision(), b = await f.provision('teacher', '二班'), screen = await f.provision('display');
    const student = await f.register(), d = draft(), key = randomUUID();
    const save = body => f.call('/api/flow/drafts', { cookie: a.cookie, headers: { 'Idempotency-Key': key }, body });
    const writes = await Promise.all([save(d), save(d)]);
    assert.deepEqual(writes.map(r => r.status), [200, 200]);
    assert.deepEqual(writes[0].data, writes[1].data);
    assert.equal((await save({ ...d, title: 'changed' })).status, 409);
    assert.equal((await f.call('/api/flow/drafts', { cookie: b.cookie })).data.drafts.length, 0);
    assert.equal((await f.call('/api/flow/drafts', { cookie: student.cookie, body: d })).status, 403);
    assert.equal((await f.call('/api/flow/drafts', { cookie: b.cookie, body: draft() })).status, 403);
    assert.equal((await f.call('/api/flow/drafts', { cookie: a.cookie, body: d })).status, 409);
    const published = await f.call('/api/flow/publish', { cookie: a.cookie, body: { id: d.id, expectedRevision: 1, confirmed: true, confirmedSummary: d.summary } });
    assert.equal(published.status, 200);
    const feed = await f.call('/api/flow/feed', { cookie: screen.cookie });
    assert.equal(feed.data.notices.length, 1);
    assert.ok(!JSON.stringify(feed.data).includes('私人'));
    assert.ok(!('ownerId' in feed.data.notices[0]));
    assert.equal((await f.call('/api/flow/feed', { cookie: b.cookie })).data.notices.length, 0);
    const history = (await f.call('/api/flow/drafts', { cookie: a.cookie })).data.audit;
    assert.equal(history.find(event => event.action === 'draft_saved').revision, 1);
    assert.ok(history.every(event => ['draft_saved', 'notice_published', 'notice_revoked', 'course_saved', 'task_saved'].includes(event.action)));
    await f.restart();
    assert.equal((await save(d)).status, 200);
    assert.equal((await f.call('/api/flow/drafts', { cookie: a.cookie })).data.drafts[0].body, d.body);
    assert.equal((await f.call('/api/flow/revoke', { cookie: a.cookie, body: { id: published.data.notice.id, expectedRevision: 1 } })).status, 200);
    assert.equal((await f.call('/api/flow/feed', { cookie: screen.cookie })).data.notices.length, 0);
    const workspace = await f.call('/api/flow/workspace', { cookie: a.cookie, body: { kind: 'task', title: '备课', scope: '一班', startsAt: new Date().toISOString() } });
    assert.equal(workspace.status, 200);
    assert.equal((await f.call('/api/flow/workspace', { cookie: a.cookie })).data.tasks.length, 1);
  } finally { await f.close(); }
});

test('invalid input never corrupts state or leaks internal errors; CSRF, host and source files are protected', async () => {
  const f = await fixture();
  try {
    const teacher = await f.provision();
    for (const body of [null, [], 'bad', { ...draft(), startsAt: 'invalid' }]) {
      const r = await f.call('/api/flow/drafts', { cookie: teacher.cookie, body });
      assert.equal(r.status, 400, JSON.stringify(r));
      assert.ok(!JSON.stringify(r.data).includes('SQLITE'));
    }
    assert.equal((await f.call('/api/flow/drafts', { cookie: teacher.cookie })).data.drafts.length, 0);
    assert.equal((await f.call('/api/v1/auth/logout', { cookie: teacher.cookie, body: {}, headers: { Origin: 'https://evil.test' } })).status, 403);
    assert.equal((await f.call('/api/v1/auth/logout', { cookie: teacher.cookie, body: {}, headers: { Origin: '' } })).status, 403);
    const badHost = await new Promise((resolve, reject) => {
      const req = http.get(f.origin + '/api/health', { headers: { Host: 'evil.test' } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); }); req.on('error', reject);
    });
    assert.equal(badHost, 403);
    for (const path of ['/backend/server.mjs', '/haiz/world/pilot/server.mjs', '/haiz/package.json', '/.env', '/api/missing']) assert.equal((await f.call(path)).status, 404);
    const large = await f.call('/api/v1/data/notes/large', { method: 'PUT', cookie: teacher.cookie, body: { expectedRevision: 0, data: { text: 'a'.repeat(70000) } } });
    assert.equal(large.status, 413);
    const asset = await f.call('/haiz/world/flow/style.css');
    assert.equal(asset.status, 200);
    assert.ok(asset.headers.get('etag'));
    assert.equal((await f.call('/haiz/world/flow/style.css', { headers: { 'If-None-Match': asset.headers.get('etag') } })).status, 304);
    assert.equal((await f.call('/api/health')).status, 200);
    assert.equal((await f.call('/api/ready')).data.ok, true);
    assert.equal((await f.call('/api/v1/admin/metrics', { cookie: teacher.cookie })).status, 403);
    assert.equal((await f.call('/api/v1/admin/metrics', { cookie: f.admin.cookie })).status, 200);
  } finally { await f.close(); }
});

async function stream(f, cookie, room = 'campus') {
  const controller = new AbortController();
  const response = await fetch(f.origin + '/api/v1/rooms/' + encodeURIComponent(room) + '/events', { headers: { Cookie: cookie }, signal: controller.signal });
  assert.equal(response.status, 200);
  const reader = response.body.getReader(); let raw = '';
  const next = async type => {
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      for (;;) {
        const index = raw.indexOf('\n\n');
        if (index >= 0) {
          const part = raw.slice(0, index); raw = raw.slice(index + 2);
          const event = part.match(/^event: (.+)$/m)?.[1], data = part.match(/^data: (.+)$/m)?.[1];
          if (event === type) return JSON.parse(data);
        } else { const chunk = await reader.read(); if (chunk.done) return null; raw += new TextDecoder().decode(chunk.value); }
      }
    } finally { clearTimeout(timer); }
  };
  return { next, close: () => controller.abort(), response };
}

test('rooms deliver real presence, positions and chat with connection ownership and scope isolation', async () => {
  const f = await fixture(); let a, b;
  try {
    const u = await f.register(), v = await f.register();
    a = await stream(f, u.cookie); const first = await a.next('snapshot');
    b = await stream(f, v.cookie); const second = await b.next('snapshot');
    assert.equal(second.members.length, 2);
    assert.equal((await a.next('presence')).kind, 'joined');
    const path = '/api/v1/rooms/campus/position';
    assert.equal((await f.call(path, { cookie: v.cookie, body: { connectionId: first.connectionId, x: 1, z: 2, yaw: 0 } })).status, 403);
    assert.equal((await f.call(path, { cookie: u.cookie, body: { connectionId: first.connectionId, x: 1, z: 2, yaw: 0 } })).status, 200);
    assert.equal((await b.next('position')).position.x, 1);
    assert.equal((await f.call('/api/v1/rooms/campus/messages', { cookie: u.cookie, body: { connectionId: first.connectionId, text: '你好校园' } })).status, 200);
    assert.equal((await b.next('message')).text, '你好校园');
    assert.equal((await f.call('/api/v1/rooms/' + encodeURIComponent('class:一班') + '/events', { cookie: u.cookie })).status, 403);
    await f.call('/api/v1/auth/logout', { cookie: u.cookie, body: {} });
    assert.equal((await b.next('presence')).kind, 'left');
  } finally { a?.close(); b?.close(); await f.close(); }
});

test('invitations expire, login is rate limited, passwords can be set and all sessions revoked', async () => {
  const f = await fixture({ authLimit: 12, inviteMs: 1000 });
  try {
    const teacher = await f.provision();
    const changed = await f.call('/api/v1/auth/password', { cookie: teacher.cookie, body: { password } });
    assert.equal(changed.status, 200);
    assert.equal((await f.call('/api/v1/auth/me', { cookie: teacher.cookie })).status, 401);
    const name = teacher.data.identity.name;
    const login = await f.call('/api/v1/auth/login', { body: { username: name, password } });
    assert.equal(login.status, 200);
    const state = await f.call('/api/flow/admin', { cookie: f.admin.cookie });
    const session = state.data.sessions.find(s => s.account === name && !s.revoked);
    assert.ok(session);
    assert.equal((await f.call('/api/flow/admin/revoke', { cookie: f.admin.cookie, body: { id: session.id } })).status, 200);
    assert.equal((await f.call('/api/v1/auth/me', { cookie: login.cookie })).status, 401);
    let limited;
    for (let i = 0; i < 13; i++) limited = await f.call('/api/v1/auth/login', { body: { username: name, password: 'wrong-12345678' } });
    assert.equal(limited.status, 429);
    assert.ok(limited.headers.get('retry-after'));
  } finally { await f.close(); }
});

test('online backup restores accounts and business data without losing committed WAL writes', async () => {
  const f = await fixture(); let restoredService, restoredDirectory;
  try {
    const a = await f.register();
    await f.call('/api/v1/data/preferences/theme', { cookie: a.cookie, method: 'PUT', body: { expectedRevision: 0, data: { value: 'ocean' } } });
    const destination = join(f.directory, 'backup.sqlite');
    await f.service.backup(destination);
    const db = new DatabaseSync(destination, { readOnly: true });
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    assert.equal(db.prepare('SELECT count(*) AS n FROM personal_data').get().n, 1);
    db.close();
    restoredDirectory = await mkdtemp(join(tmpdir(), 'haiz-restored-'));
    await copyFile(destination, join(restoredDirectory, 'haiz.sqlite'));
    const { createService } = await import('../server.mjs');
    restoredService = await createService({ directory: restoredDirectory, development: true, port: 0, logger: () => {} }); await restoredService.listen();
    const logged = await fetch(restoredService.origin + '/api/v1/auth/login', { method: 'POST', headers: { Origin: restoredService.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: a.data.identity.name, password }) });
    assert.equal(logged.status, 200);
    const response = await fetch(restoredService.origin + '/api/v1/data/preferences/theme', { headers: { Cookie: logged.headers.get('set-cookie').split(';')[0] } });
    assert.equal((await response.json()).item.data.value, 'ocean');
  } finally { await restoredService?.close(); if (restoredDirectory) await rm(restoredDirectory, { recursive: true, force: true }); await f.close(); }
});

test('a revoked session cannot finish an already started slow personal-data mutation', async () => {
  const f = await fixture();
  try {
    const u = await f.register();
    let complete;
    const response = new Promise((resolve, reject) => {
      const req = http.request(f.origin + '/api/v1/data/notes/racing', { method: 'PUT', headers: {
        Origin: f.origin, Cookie: u.cookie, 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked',
      } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
      req.on('error', reject); req.write('{"expectedRevision":0,');
      complete = () => req.end('"data":{"text":"must not commit"}}');
    });
    // Let the service authenticate and wait for the remaining body.
    await delay(50);
    await f.call('/api/v1/auth/logout', { cookie: u.cookie, body: {} });
    complete();
    assert.equal(await response, 401);
    const fresh = await f.call('/api/v1/auth/login', { body: { username: u.data.identity.name, password } });
    assert.equal((await f.call('/api/v1/data/notes', { cookie: fresh.cookie })).data.items.length, 0);
  } finally { await f.close(); }
});

test('expired sessions stop live room delivery without waiting for the heartbeat', async () => {
  const f = await fixture({ sessionMs: 250 }); let connection;
  try {
    // Invited accounts avoid spending most of the short session hashing a password.
    const u = await f.provision('student');
    connection = await stream(f, u.cookie);
    assert.ok((await connection.next('snapshot')).connectionId);
    const started = Date.now();
    assert.equal(await connection.next('presence'), null);
    assert.ok(Date.now() - started < 1200);
    assert.equal((await f.call('/api/v1/auth/me', { cookie: u.cookie })).status, 401);
  } finally { connection?.close(); await f.close(); }
});

test('expired invitations are rejected without consuming or creating a session', async () => {
  const f = await fixture({ inviteMs: 150 });
  try {
    const issued = await f.call('/api/flow/admin/invite', { cookie: f.admin.cookie, body: { username: 'late-user', role: 'student' } });
    assert.equal(issued.status, 201);
    await delay(180);
    assert.equal((await f.call('/api/flow/login', { body: { invite: issued.data.invite } })).status, 401);
  } finally { await f.close(); }
});

test('an unclaimed expired bootstrap can recover on local restart', async () => {
  const { createService } = await import('../server.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'haiz-bootstrap-')); let service;
  try {
    service = await createService({ directory, development: true, port: 0, inviteMs: 100, logger: () => {} });
    await service.close(); await delay(130);
    service = await createService({ directory, development: true, port: 0, inviteMs: 1000, logger: () => {} });
    await service.listen();
    const invite = (await readFile(service.bootstrapFile, 'utf8')).trim();
    const response = await fetch(service.origin + '/api/flow/login', { method: 'POST', headers: { Origin: service.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ invite }) });
    assert.equal(response.status, 200);
  } finally { await service?.close(); await rm(directory, { recursive: true, force: true }); }
});

test('production enforces secure cookies and per-client limits from the trusted local proxy', async () => {
  const { createService } = await import('../server.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'haiz-proxy-')); let service;
  try {
    const origin = 'https://campus.example.test';
    service = await createService({ directory, publicOrigin: origin, behindProxy: true, port: 0, authLimit: 2, logger: () => {} }); await service.listen();
    const request = (ip, body) => new Promise((resolve, reject) => {
      const req = http.request({ hostname: '127.0.0.1', port: service.server.address().port, path: '/api/flow/login', method: 'POST', headers: { Host: 'campus.example.test', Origin: origin, 'Content-Type': 'application/json', ...(ip ? { 'X-HAIZ-Client-IP': ip } : {}) } }, res => {
        res.resume(); res.on('end', () => resolve({ status: res.statusCode, cookie: res.headers['set-cookie']?.[0] }));
      }); req.on('error', reject); req.end(JSON.stringify(body));
    });
    assert.equal((await request(null, { invite: 'bad' })).status, 403);
    assert.equal((await request('192.0.2.1', { invite: 'bad' })).status, 401);
    assert.equal((await request('192.0.2.1', { invite: 'bad' })).status, 401);
    assert.equal((await request('192.0.2.1', { invite: 'bad' })).status, 429);
    const invite = (await readFile(service.bootstrapFile, 'utf8')).trim();
    const login = await request('192.0.2.2', { invite });
    assert.equal(login.status, 200);
    assert.match(login.cookie, /^__Host-haiz_session=.*HttpOnly; SameSite=Strict; Secure/);
  } finally { await service?.close(); await rm(directory, { recursive: true, force: true }); }
});

test('browser SDK talks to the real service and propagates revision conflicts and cookie logout', async () => {
  const { createHaizClient } = await import('../client.mjs');
  const f = await fixture(); let cookie = '';
  try {
    const client = createHaizClient({ base: f.origin, fetch: async (url, options) => {
      const response = await fetch(url, { ...options, headers: { ...options.headers, Origin: f.origin, ...(cookie ? { Cookie: cookie } : {}) } });
      const setCookie = response.headers.get('set-cookie'); if (setCookie) cookie = setCookie.split(';')[0];
      return response;
    } });
    const registered = await client.register('sdk-user', password);
    assert.equal((await client.me()).identity.name, registered.identity.name);
    const saved = await client.put('notes', 'sdk-note', { text: '来自 SDK' }, 0);
    assert.equal((await client.get('notes', 'sdk-note')).item.data.text, '来自 SDK');
    await assert.rejects(client.put('notes', 'sdk-note', { text: '旧版本' }, 0), error => error.status === 409 && error.remote.revision === 1);
    assert.equal((await client.list('notes')).items.length, 1);
    assert.ok((await client.rooms()).rooms.includes('campus'));
    await client.remove('notes', 'sdk-note', saved.item.revision);
    assert.equal((await client.list('notes')).items.length, 0);
    await client.logout(); await assert.rejects(client.me(), error => error.status === 401);
    await client.login('sdk-user', password);
    await client.changePassword('sdk-new-password-123', password);
    await client.login('sdk-user', 'sdk-new-password-123');
    const teacher = await f.provision();
    const issued = await f.call('/api/flow/admin/invite', { cookie: f.admin.cookie, body: { account: teacher.data.identity.name } });
    await client.inviteLogin(issued.data.invite);
    const d = draft(), key = randomUUID();
    assert.equal((await client.flow('drafts', d, key)).draft.revision, 1);
    assert.equal((await client.flow('drafts', d, key)).draft.revision, 1);
  } finally { await f.close(); }
});

test('every application page requires login while registration and account assets remain accessible', async () => {
  const f = await fixture();
  try {
    for (const path of ['/', '/index.html', '/world/flow/', '/haiz/world/atlas-engine.html']) {
      const response = await fetch(f.origin + path, { redirect: 'manual' });
      assert.equal(response.status, 302, path);
      assert.ok(response.headers.get('location').startsWith('/account/?next='));
    }
    const account = await f.call('/account/');
    assert.equal(account.status, 200);
    assert.match(account.data, /我的数据/);
    assert.equal((await f.call('/account/app.js')).status, 200);
    assert.equal((await f.call('/api/v1/auth/config')).data.registration, true);
    const u = await f.register();
    assert.equal((await f.call('/world/flow/', { cookie: u.cookie })).status, 200);
    assert.match((await f.call('/world/flow/', { cookie: u.cookie })).data, /我的数据/);
    await f.call('/api/v1/auth/logout', { cookie: u.cookie, body: {} });
    assert.equal((await fetch(f.origin + '/', { headers: { Cookie: u.cookie }, redirect: 'manual' })).status, 302);
  } finally { await f.close(); }
});

test('users manage only their own devices and can revoke every session', async () => {
  const f = await fixture();
  try {
    const a = await f.register(), b = await f.register();
    const another = await f.call('/api/v1/auth/login', { body: { username: a.data.identity.name, password } });
    const sessions = await f.call('/api/v1/auth/sessions', { cookie: a.cookie });
    assert.equal(sessions.status, 200);
    assert.equal(sessions.data.sessions.length, 2);
    assert.equal(sessions.data.sessions.filter(s => s.current).length, 1);
    assert.ok(!JSON.stringify(sessions.data).includes('token_hash'));
    const otherDevice = sessions.data.sessions.find(s => !s.current);
    assert.equal((await f.call('/api/v1/auth/revoke', { cookie: b.cookie, body: { id: otherDevice.id } })).status, 404);
    assert.equal((await f.call('/api/v1/auth/revoke', { cookie: a.cookie, body: { id: otherDevice.id } })).status, 200);
    assert.equal((await f.call('/api/v1/auth/me', { cookie: another.cookie })).status, 401);
    await f.call('/api/v1/auth/logout-all', { cookie: a.cookie, body: {} });
    assert.equal((await f.call('/api/v1/auth/me', { cookie: a.cookie })).status, 401);
    assert.equal((await f.call('/api/v1/auth/me', { cookie: b.cookie })).status, 200);
  } finally { await f.close(); }
});

test('account deletion requires the owner password, removes only their records and invalidates all devices', async () => {
  const f = await fixture();
  try {
    const a = await f.register(), b = await f.register();
    for (const u of [a, b]) await f.call('/api/v1/data/notes/private', { cookie: u.cookie, method: 'PUT', body: { expectedRevision: 0, data: { text: u.data.identity.name } } });
    const erase = (body, cookie = a.cookie) => f.call('/api/v1/auth/account', { cookie, method: 'DELETE', body });
    assert.equal((await erase({ password: 'wrong-password', confirm: a.data.identity.name })).status, 401);
    assert.equal((await erase({ password, confirm: b.data.identity.name })).status, 400);
    assert.equal((await erase({ password, confirm: a.data.identity.name, userId: b.data.identity.id })).status, 200);
    assert.equal((await f.call('/api/v1/auth/me', { cookie: a.cookie })).status, 401);
    assert.equal((await f.call('/api/v1/data/notes/private', { cookie: b.cookie })).data.item.data.text, b.data.identity.name);
    assert.equal((await f.call('/api/v1/auth/login', { body: { username: a.data.identity.name, password } })).status, 401);
  } finally { await f.close(); }
});

test('main-branch static layout requires login and never serves private files or internal symlinks', async () => {
  const { createService } = await import('../server.mjs');
  const root = await mkdtemp(join(tmpdir(), 'haiz-main-layout-')), directory = join(root, 'runtime'); let service;
  try {
    await writeFile(join(root, 'index.html'), '<html><body>current-main-campus</body></html>');
    await mkdir(join(root, 'assets')); await writeFile(join(root, 'assets/style.css'), 'body{color:green}');
    service = await createService({ root, directory, development: true, port: 0, logger: () => {} }); await service.listen();
    await symlink(service.bootstrapFile, join(root, 'public-invite.txt'));
    for (const route of ['/runtime/bootstrap-invite.txt', '/public-invite.txt']) assert.equal((await fetch(service.origin + route)).status, 404, route);
    assert.equal((await fetch(service.origin + '/index%2ehtml', { redirect: 'manual' })).status, 302);
    const registered = await fetch(service.origin + '/api/v1/auth/register', { method: 'POST', headers: { Origin: service.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'main-user', password }) });
    const page = await fetch(service.origin + '/', { headers: { Cookie: registered.headers.get('set-cookie').split(';')[0] } });
    assert.equal(page.status, 200); assert.match(await page.text(), /current-main-campus/);
    assert.equal((await fetch(service.origin + '/assets/style.css')).status, 200);
    assert.equal((await fetch(service.origin + '/login/', { redirect: 'manual' })).headers.get('location'), '/account/');
  } finally { await service?.close(); await rm(root, { recursive: true, force: true }); }
});

test('SDK and legacy-page requests remain bound to their verified identity across shared-cookie account switches', async () => {
  const { createHaizClient } = await import('../client.mjs');
  const f = await fixture();
  try {
    const a = await f.register(), b = await f.register(); let sharedCookie = a.cookie;
    await f.call('/api/v1/data/bookmarks/private-b', { cookie: b.cookie, method: 'PUT', body: { expectedRevision: 0, data: { text: 'PRIVATE_B' } } });
    const oldPage = createHaizClient({ base: f.origin, fetch: (url, options) => fetch(url, { ...options, headers: { ...options.headers, Origin: f.origin, Cookie: sharedCookie } }) });
    assert.equal((await oldPage.me()).identity.id, a.data.identity.id);
    sharedCookie = b.cookie;
    await assert.rejects(oldPage.list('bookmarks'), error => error.status === 409 && error.identityChanged);
    await assert.rejects(oldPage.put('notes', 'stale-page', { text: 'must not enter B' }, 0), error => error.status === 409);
    assert.equal((await f.call('/api/v1/data/notes', { cookie: b.cookie })).data.items.length, 0);
    const legacy = await f.call('/api/flow/drafts', { cookie: b.cookie, headers: { 'X-HAIZ-User': a.data.identity.id } });
    assert.equal(legacy.status, 409); assert.equal(legacy.data.identityChanged, true);
    const html = (await f.call('/world/flow/', { cookie: a.cookie })).data;
    assert.match(html, /session-guard\.js/); assert.ok(html.includes(a.data.identity.id));
  } finally { await f.close(); }
});
