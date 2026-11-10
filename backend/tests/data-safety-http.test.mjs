import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';
import { createService } from '../server.mjs';
import { createHaizClient } from '../client.mjs';

const password = 'haiz-safety-password-123';
const safetyRoutes = [
  ['/api/v1/data/notes/private/history', 'GET'],
  ['/api/v1/data/notes/private/restore', 'POST'],
  ['/api/v1/trash/notes', 'GET'],
  ['/api/v1/search?q=private', 'GET'],
  ['/api/v1/usage', 'GET'],
  ['/api/v1/activity', 'GET'],
];

async function fixture(options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'haiz-safety-http-'));
  let service;
  try {
    service = await createService({ directory, development: true, port: 0, logger: () => {}, ...options });
    await service.listen();
  } catch (error) { await service?.close(); await rm(directory, { recursive: true, force: true }); throw error; }
  const call = async (route, { cookie, body, method = body === undefined ? 'GET' : 'POST', headers = {} } = {}) => {
    const response = await fetch(service.origin + route, { method,
      headers: { Origin: service.origin, ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  const invite = (await readFile(service.bootstrapFile, 'utf8')).trim();
  const admin = await call('/api/flow/login', { body: { invite } });
  assert.equal(admin.status, 200);
  const register = async () => {
    const result = await call('/api/v1/auth/register', { body: { username: 'safety-' + randomUUID().slice(0, 8), password } });
    assert.equal(result.status, 201); return result;
  };
  return { directory, service, call, admin, register,
    put: (cookie, collection, id, data, expectedRevision = 0) => call(`/api/v1/data/${collection}/${id}`, { cookie, method: 'PUT', body: { data, expectedRevision } }),
    remove: (cookie, collection, id, expectedRevision) => call(`/api/v1/data/${collection}/${id}`, { cookie, method: 'DELETE', body: { expectedRevision } }),
    close: async () => { await service.close(); await rm(directory, { recursive: true, force: true }); } };
}

test('safety routes require authentication, reject wrong methods and preserve Origin and identity preconditions', async () => {
  const f = await fixture();
  try {
    const a = await f.register(), b = await f.register();
    for (const [route, method] of safetyRoutes) {
      const body = method === 'POST' ? { expectedRevision: 0 } : undefined;
      assert.equal((await f.call(route, { method, body })).status, 401, route);
      const mismatch = await f.call(route, { method, body, cookie: b.cookie, headers: { 'X-HAIZ-User': a.data.identity.id } });
      assert.equal(mismatch.status, 409, route); assert.equal(mismatch.data.identityChanged, true);
      assert.equal((await f.call(route, { method, body, cookie: a.cookie, headers: { Origin: 'https://evil.test' } })).status, 403, route);
      const wrongMethod = method === 'POST' ? 'GET' : 'POST';
      assert.equal((await f.call(route, { method: wrongMethod, ...(wrongMethod === 'POST' ? { body: {} } : {}), cookie: a.cookie })).status, 405, route);
    }
    const restore = '/api/v1/data/notes/private/restore';
    assert.equal((await f.call(restore, { cookie: a.cookie, body: { expectedRevision: 0 }, headers: { Origin: '' } })).status, 403);
    assert.equal((await f.call(restore, { cookie: a.cookie, body: { expectedRevision: 0, extra: 'x'.repeat(70000) } })).status, 413);
    assert.equal((await f.call(restore, { cookie: a.cookie, body: [], headers: { 'Content-Type': 'application/json' } })).status, 400);
    await f.call('/api/v1/auth/logout', { cookie: a.cookie, body: {} });
    for (const [route, method] of safetyRoutes) assert.equal((await f.call(route, { cookie: a.cookie, method, ...(method === 'POST' ? { body: { expectedRevision: 0 } } : {}) })).status, 401, route);
  } finally { await f.close(); }
});

test('HTTP history and trash recover committed bodies with new revisions and preserve conflict details', async () => {
  const f = await fixture();
  try {
    const a = await f.register(), route = '/api/v1/data/notes/private';
    assert.equal((await f.put(a.cookie, 'notes', 'private', { text: 'first' })).status, 200);
    assert.equal((await f.put(a.cookie, 'notes', 'private', { text: 'second' }, 1)).status, 200);
    assert.equal((await f.remove(a.cookie, 'notes', 'private', 2)).status, 200);
    const history = await f.call(route + '/history', { cookie: a.cookie });
    assert.equal(history.status, 200);
    assert.deepEqual(history.data.items.map(item => item.revision), [3, 2, 1]);
    assert.deepEqual(history.data.retention, { days: 30, perItem: 20, perUser: 2000 });
    const trash = await f.call('/api/v1/trash/notes', { cookie: a.cookie });
    assert.equal(trash.status, 200); assert.equal(trash.data.items[0].revision, 3);
    assert.deepEqual(trash.data.items[0].data, { text: 'second' });
    const stale = await f.call(route + '/restore', { cookie: a.cookie, body: { expectedRevision: 2 } });
    assert.equal(stale.status, 409); assert.equal(stale.data.remote.revision, 3);
    const restored = await f.call(route + '/restore', { cookie: a.cookie, body: { expectedRevision: 3, revision: 1 } });
    assert.equal(restored.status, 200); assert.equal(restored.data.item.revision, 4);
    assert.deepEqual(restored.data.item.data, { text: 'first' });
    assert.equal((await f.call('/api/v1/trash/notes', { cookie: a.cookie })).data.items.length, 0);
    assert.equal((await f.call(route + '/restore', { cookie: a.cookie, body: { expectedRevision: 4, revision: 99 } })).status, 404);
    assert.equal((await f.call(route + '/restore', { cookie: a.cookie, body: { expectedRevision: 4 } })).status, 400);
    assert.equal((await f.remove(a.cookie, 'notes', 'private', 4)).status, 200);
    const latest = await f.call(route + '/restore', { cookie: a.cookie, body: { expectedRevision: 5 } });
    assert.equal(latest.status, 200); assert.equal(latest.data.item.revision, 6);
    assert.deepEqual(latest.data.item.data, { text: 'first' });
  } finally { await f.close(); }
});

test('history, restore, trash, search, usage and activity never read another account, including for administrators', async () => {
  const f = await fixture();
  try {
    const a = await f.register(), b = await f.register();
    await f.put(a.cookie, 'notes', 'private', { text: 'private-secret-body' });
    await f.put(a.cookie, 'notes', 'private', { text: 'private-latest-body' }, 1);
    await f.remove(a.cookie, 'notes', 'private', 2);
    for (const viewer of [b, f.admin]) {
      assert.equal((await f.call('/api/v1/data/notes/private/history', { cookie: viewer.cookie })).status, 404);
      assert.equal((await f.call('/api/v1/data/notes/private/restore', { cookie: viewer.cookie, body: { expectedRevision: 0, revision: 1 } })).status, 404);
      assert.deepEqual((await f.call('/api/v1/trash/notes', { cookie: viewer.cookie })).data.items, []);
      assert.deepEqual((await f.call('/api/v1/search?q=private', { cookie: viewer.cookie })).data.items, []);
      const usage = await f.call('/api/v1/usage', { cookie: viewer.cookie });
      assert.equal(usage.status, 200); assert.equal(usage.data.totals.active, 0); assert.equal(usage.data.totals.deleted, 0);
      const activity = await f.call('/api/v1/activity', { cookie: viewer.cookie });
      assert.equal(activity.status, 200); assert.ok(!activity.data.events.some(event => event.target.includes('private')));
      assert.ok(!JSON.stringify(activity.data).includes('private-secret-body'));
    }
  } finally { await f.close(); }
});

test('literal search, trash and activity paginate without skipping items; usage reports active and retained bytes', async () => {
  const f = await fixture();
  try {
    const a = await f.register();
    for (const [collection, id] of [['notes', 'a'], ['bookmarks', 'b'], ['preferences', 'c']]) {
      assert.equal((await f.put(a.cookie, collection, id, { text: 'find %_ 你好' })).status, 200);
    }
    await f.put(a.cookie, 'notes', 'wildcard-decoy', { text: 'find AA 你好' });
    await f.put(a.cookie, 'notes', 'old', { text: 'find %_ 你好 deleted' });
    await f.remove(a.cookie, 'notes', 'old', 1);
    let route = '/api/v1/search?q=' + encodeURIComponent('%_') + '&limit=1';
    const matches = [];
    for (let page = 0; page < 4; page++) {
      const result = await f.call(route, { cookie: a.cookie }); assert.equal(result.status, 200);
      matches.push(...result.data.items.map(item => `${item.collection}:${item.id}`));
      if (!result.data.nextCursor) break;
      route = '/api/v1/search?q=' + encodeURIComponent('%_') + '&limit=1&cursor=' + encodeURIComponent(result.data.nextCursor);
    }
    assert.deepEqual(matches, ['bookmarks:b', 'notes:a', 'preferences:c']);
    assert.deepEqual((await f.call('/api/v1/search?q=' + encodeURIComponent('你好') + '&collection=notes', { cookie: a.cookie })).data.items.map(item => item.id), ['a', 'wildcard-decoy']);
    for (const invalid of ['/api/v1/search', '/api/v1/search?q=x&limit=0', '/api/v1/search?q=x&cursor=bad', '/api/v1/trash/notes?limit=201', '/api/v1/activity?cursor=bad', '/api/v1/activity?limit=0']) assert.equal((await f.call(invalid, { cookie: a.cookie })).status, 400, invalid);
    await f.remove(a.cookie, 'notes', 'a', 1);
    const first = await f.call('/api/v1/trash/notes?limit=1', { cookie: a.cookie });
    assert.equal(first.status, 200); assert.deepEqual(first.data.items.map(item => item.id), ['a']); assert.ok(first.data.nextCursor);
    const next = await f.call('/api/v1/trash/notes?limit=1&cursor=' + encodeURIComponent(first.data.nextCursor), { cookie: a.cookie });
    assert.deepEqual(next.data.items.map(item => item.id), ['old']); assert.equal(next.data.nextCursor, null);
    const usage = (await f.call('/api/v1/usage', { cookie: a.cookie })).data;
    assert.equal(usage.collections.notes.active, 1); assert.equal(usage.collections.notes.deleted, 2);
    assert.equal(usage.totals.active, 3); assert.equal(usage.totals.deleted, 2);
    assert.equal(usage.totals.historyVersions, 2); assert.ok(usage.totals.bytes > 0 && usage.totals.historyBytes > 0);
    assert.equal(usage.limits.itemBytes, 16000);
    const activity = await f.call('/api/v1/activity?limit=2', { cookie: a.cookie });
    assert.equal(activity.status, 200); assert.equal(activity.data.events.length, 2); assert.ok(activity.data.nextCursor);
    const older = await f.call('/api/v1/activity?limit=2&cursor=' + activity.data.nextCursor, { cookie: a.cookie });
    assert.equal(older.status, 200); assert.ok(older.data.events.every(event => event.id < activity.data.events.at(-1).id));
    for (const event of [...activity.data.events, ...older.data.events]) assert.deepEqual(Object.keys(event).sort(), ['action', 'at', 'id', 'revision', 'target']);
    assert.ok(!JSON.stringify(activity.data).includes('你好'));
  } finally { await f.close(); }
});

test('SDK recovery and query methods use real service sessions and surface stale-cookie identity changes', async () => {
  const f = await fixture(); let cookie = '';
  try {
    const client = createHaizClient({ base: f.service.origin, fetch: async (url, options) => {
      const response = await fetch(url, { ...options, headers: { ...options.headers, Origin: f.service.origin, ...(cookie ? { Cookie: cookie } : {}) } });
      const setCookie = response.headers.get('set-cookie'); if (setCookie) cookie = setCookie.split(';')[0]; return response;
    } });
    await client.register('sdk-safety-user', password);
    await client.put('notes', 'sdk', { text: 'SDK %_ 你好' }, 0);
    await client.put('notes', 'sdk', { text: 'latest' }, 1);
    assert.deepEqual((await client.history('notes', 'sdk')).items.map(item => item.revision), [2, 1]);
    assert.equal((await client.search('%_ 你好', { collection: 'notes', limit: 1 })).items.length, 0);
    await client.remove('notes', 'sdk', 2);
    assert.equal((await client.trash('notes', { limit: 1 })).items[0].data.text, 'latest');
    await assert.rejects(client.restore('notes', 'sdk', 2), error => error.status === 409 && error.remote.revision === 3);
    assert.equal((await client.restore('notes', 'sdk', 3, 1)).item.data.text, 'SDK %_ 你好');
    assert.equal((await client.search('%_ 你好')).items[0].id, 'sdk');
    assert.equal((await client.usage()).totals.active, 1);
    assert.equal((await client.activity()).events[0].revision, 4);
    assert.equal((await client.activity({ limit: 1 })).events.length, 1);
    await client.remove('notes', 'sdk', 4);
    assert.equal((await client.restore('notes', 'sdk', 5)).item.revision, 6);
    const b = await f.register(); cookie = b.cookie;
    for (const task of [() => client.history('notes', 'sdk'), () => client.trash('notes'), () => client.restore('notes', 'sdk', 6, 1), () => client.search('SDK'), () => client.usage(), () => client.activity()]) await assert.rejects(task(), error => error.status === 409 && error.identityChanged);
  } finally { await f.close(); }
});

test('development disables automatic backups and exposes backup status only in administrator metrics', async () => {
  const f = await fixture();
  try {
    const a = await f.register();
    assert.equal((await f.call('/api/v1/admin/metrics', { cookie: a.cookie })).status, 403);
    const metrics = await f.call('/api/v1/admin/metrics', { cookie: f.admin.cookie });
    assert.equal(metrics.status, 200);
    assert.deepEqual(metrics.data.backup, { enabled: false, running: false, lastSuccessAt: null, lastFailureAt: null, retained: 0 });
    assert.ok(!JSON.stringify(metrics.data.backup).includes(f.directory));
  } finally { await f.close(); }
});

test('service starts due backups after listening and waits before closing the database', async () => {
  const f = await fixture({ backupIntervalMs: 3600000 });
  try {
    let status;
    for (let attempt = 0; attempt < 100; attempt++) {
      const metrics = await f.call('/api/v1/admin/metrics', { cookie: f.admin.cookie });
      assert.equal(metrics.status, 200); status = metrics.data.backup;
      if (status?.lastSuccessAt) break;
      await delay(20);
    }
    assert.equal(status.enabled, true); assert.ok(status.lastSuccessAt); assert.equal(status.retained, 1);
    await f.service.close();
    const files = (await readdir(join(f.directory, 'backups'))).filter(name => name.endsWith('.sqlite'));
    assert.equal(files.length, 1);
    const db = new DatabaseSync(join(f.directory, 'backups', files[0]), { readOnly: true });
    try { assert.equal(db.prepare('PRAGMA quick_check').get().quick_check, 'ok'); } finally { db.close(); }
  } finally { await f.close(); }
});

test('invalid backup intervals are rejected before the service opens its database', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'haiz-safety-config-'));
  try {
    for (const backupIntervalMs of [-1, 1, 3600000.5, 169 * 3600000, NaN]) {
      let service;
      try { await assert.rejects(async () => { service = await createService({ directory, development: true, backupIntervalMs, logger: () => {} }); }, /配置|备份/); }
      finally { await service?.close(); }
    }
    for (const value of ['', '-1', '0.5', '169', 'invalid']) {
      const result = await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['backend/server.mjs', '--dev'], { cwd: new URL('../../', import.meta.url), env: { ...process.env, PORT: '0', HAIZ_DATA_DIR: directory, HAIZ_BACKUP_INTERVAL_HOURS: value }, stdio: ['ignore', 'pipe', 'pipe'] });
        let stderr = ''; child.stderr.on('data', data => { stderr += data; }); child.on('error', reject);
        const timeout = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('invalid backup configuration started a server: ' + value)); }, 5000);
        child.on('exit', code => { clearTimeout(timeout); resolve({ code, stderr }); });
      });
      assert.notEqual(result.code, 0, value); assert.match(result.stderr, /配置|备份/, value);
    }
    assert.deepEqual(await readdir(directory), []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
