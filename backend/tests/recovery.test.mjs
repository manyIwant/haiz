import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createRepository } from '../repository.mjs';

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'haiz-recovery-'));
  const repository = createRepository(directory);
  const inspect = new DatabaseSync(join(directory, 'haiz.sqlite'));
  const register = (name = 'user-' + randomUUID()) => repository.run('register', { name, passwordHash: 'credential-' + name, tokenHash: randomUUID(), sessionMs: 3600000 });
  const run = (user, operation, args = {}) => repository.run(operation, { ...args, who: user.identity, sessionId: user.sessionId });
  const put = (user, id, expectedRevision, data, collection = 'notes') => run(user, 'personal', { method: 'PUT', collection, id, input: { expectedRevision, data } }).item;
  const remove = (user, id, expectedRevision, collection = 'notes') => run(user, 'personal', { method: 'DELETE', collection, id, input: { expectedRevision } }).item;
  return { repository, inspect, register, run, put, remove, close: async () => { inspect.close(); repository.run('close', {}); await rm(directory, { recursive: true, force: true }); } };
}
const status = expected => error => error.status === expected;

test('history archives before changes and restores as a new revision with conflict protection', async () => {
  const f = await fixture();
  try {
    const u = f.register();
    f.put(u, 'note', 0, { text: 'first' }); f.put(u, 'note', 1, { text: 'second' });
    const deleted = f.remove(u, 'note', 2);
    assert.deepEqual(deleted.data, null);
    const history = f.run(u, 'personalHistory', { collection: 'notes', id: 'note' });
    assert.deepEqual(history.items.map(i => [i.revision, i.deleted, i.data]), [[3, true, null], [2, false, { text: 'second' }], [1, false, { text: 'first' }]]);
    assert.deepEqual(history.retention, { days: 30, perItem: 20, perUser: 2000 });
    assert.throws(() => f.remove(u, 'note', 3), status(404));
    assert.throws(() => f.run(u, 'personalRestore', { collection: 'notes', id: 'note', input: { expectedRevision: 2 } }), error => error.status === 409 && error.remote.revision === 3 && error.remote.deleted);
    const trash = f.run(u, 'personalTrash', { collection: 'notes' });
    assert.deepEqual(trash.items, [{ ...deleted, data: { text: 'second' } }]);
    assert.equal(trash.nextCursor, null);
    const restored = f.run(u, 'personalRestore', { collection: 'notes', id: 'note', input: { expectedRevision: 3 } }).item;
    assert.deepEqual([restored.revision, restored.deleted, restored.data], [4, false, { text: 'second' }]);
    assert.throws(() => f.run(u, 'personalRestore', { collection: 'notes', id: 'note', input: { expectedRevision: 4 } }), status(400));
    assert.throws(() => f.run(u, 'personalRestore', { collection: 'notes', id: 'note', input: { expectedRevision: 4, revision: 3 } }), status(404));
    assert.deepEqual(f.run(u, 'personalRestore', { collection: 'notes', id: 'note', input: { expectedRevision: 4, revision: 1 } }).item.data, { text: 'first' });
    assert.deepEqual(f.run(u, 'personalHistory', { collection: 'notes', id: 'note' }).items.map(i => i.revision), [5, 4, 3, 2, 1]);
    assert.equal(f.run(u, 'personalTrash', { collection: 'notes' }).items.length, 0);
  } finally { await f.close(); }
});

test('deleting long unchanged content starts recovery retention then expired archives stay unreadable before cleanup', async () => {
  const f = await fixture();
  try {
    const u = f.register(); f.put(u, 'old', 0, { text: 'years old' });
    f.inspect.prepare('UPDATE personal_data SET updated_at=? WHERE owner=?').run('2001-01-01T00:00:00.000Z', u.identity.id);
    f.remove(u, 'old', 1);
    assert.deepEqual(f.run(u, 'personalTrash', { collection: 'notes' }).items[0].data, { text: 'years old' });
    assert.ok(f.inspect.prepare('SELECT stored_at FROM personal_versions').get().stored_at > Date.now() - 60000);
    f.inspect.prepare('UPDATE personal_versions SET stored_at=?').run(Date.now() - 31 * 86400000);
    assert.deepEqual(f.run(u, 'personalHistory', { collection: 'notes', id: 'old' }).items.map(i => i.revision), [2]);
    assert.equal(f.run(u, 'personalTrash', { collection: 'notes' }).items.length, 0);
    assert.throws(() => f.run(u, 'personalRestore', { collection: 'notes', id: 'old', input: { expectedRevision: 2, revision: 1 } }), status(404));
    assert.throws(() => f.put(u, 'old', 0, { text: 'stale' }), error => error.status === 409 && error.remote.revision === 2);
    f.repository.run('cleanup', {});
    assert.equal(f.inspect.prepare('SELECT count(*) AS n FROM personal_versions').get().n, 0);
    assert.equal(f.inspect.prepare('SELECT revision,deleted FROM personal_data').get().deleted, 1);
  } finally { await f.close(); }
});

test('personal recovery, search, usage and activity remain private even for administrators and invalid sessions', async () => {
  const f = await fixture();
  try {
    const a = f.register(), b = f.register('admin-viewer');
    f.inspect.prepare("UPDATE users SET role='admin' WHERE id=?").run(b.identity.id); b.identity.role = 'admin';
    f.put(a, 'secret', 0, { text: 'PRIVATE_CONTENT' }); f.remove(a, 'secret', 1);
    assert.throws(() => f.run(b, 'personalHistory', { collection: 'notes', id: 'secret' }), status(404));
    assert.throws(() => f.run(b, 'personalRestore', { collection: 'notes', id: 'secret', input: { expectedRevision: 2 } }), status(404));
    assert.deepEqual(f.run(b, 'personalTrash', { collection: 'notes' }).items, []);
    assert.deepEqual(f.run(b, 'personalSearch', { q: 'PRIVATE' }).items, []);
    assert.equal(f.run(b, 'personalUsage').totals.deleted, 0);
    const activity = f.run(b, 'personalActivity');
    assert.ok(activity.events.every(e => !e.target.includes('secret')));
    assert.ok(!JSON.stringify(activity).includes('PRIVATE_CONTENT'));
    for (const operation of ['personalHistory', 'personalTrash', 'personalRestore', 'personalSearch', 'personalUsage', 'personalActivity']) {
      assert.throws(() => f.repository.run(operation, { who: a.identity, sessionId: b.sessionId, collection: 'notes', id: 'secret', q: 'PRIVATE', input: { expectedRevision: 2 } }), status(401));
    }
  } finally { await f.close(); }
});

test('history caps each item at twenty archives and each owner at two thousand while preserving tombstones', async () => {
  const f = await fixture();
  try {
    const u = f.register();
    for (let i = 0; i < 25; i++) f.put(u, 'many', i, { value: i });
    assert.deepEqual(f.run(u, 'personalHistory', { collection: 'notes', id: 'many' }).items.map(i => i.revision), Array.from({ length: 21 }, (_, i) => 25 - i));
    assert.throws(() => f.run(u, 'personalRestore', { collection: 'notes', id: 'many', input: { expectedRevision: 25, revision: 4 } }), status(404));
    f.inspect.exec('BEGIN IMMEDIATE');
    const seed = f.inspect.prepare('INSERT INTO personal_versions(owner,collection,id,revision,deleted,data,updated_at,stored_at) VALUES(?,?,?,?,?,?,?,?)');
    for (let i = 0; i < 2000; i++) seed.run(u.identity.id, 'bookmarks', 'seed-' + Math.floor(i / 20), i % 20 + 1, 0, '{"x":1}', '2000-01-01', Date.now() - 10000 + i);
    f.inspect.exec('COMMIT');
    f.put(u, 'many', 25, { value: 25 });
    assert.equal(f.inspect.prepare('SELECT count(*) AS n FROM personal_versions WHERE owner=?').get(u.identity.id).n, 2000);
    assert.equal(f.inspect.prepare("SELECT count(*) AS n FROM personal_versions WHERE collection='notes' AND id='many'").get().n, 20);
    assert.equal(f.run(u, 'personalHistory', { collection: 'notes', id: 'many' }).items[0].revision, 26);
  } finally { await f.close(); }
});

test('search matches literal JSON substrings, skips deleted rows and paginates by collection and id', async () => {
  const f = await fixture();
  try {
    const u = f.register();
    f.put(u, 'a', 0, { text: 'MiXeD 100%_ value' }, 'bookmarks');
    f.put(u, 'b', 0, { text: 'mixed other' }, 'bookmarks');
    f.put(u, 'a', 0, { text: 'MIXED 100%_' }); f.put(u, 'z', 0, { text: 'mixed deleted' }); f.remove(u, 'z', 1);
    assert.deepEqual(f.run(u, 'personalSearch', { q: '%_' }).items.map(i => [i.collection, i.id]), [['bookmarks', 'a'], ['notes', 'a']]);
    const first = f.run(u, 'personalSearch', { q: 'mixed', limit: 2 });
    assert.deepEqual(first.items.map(i => [i.collection, i.id]), [['bookmarks', 'a'], ['bookmarks', 'b']]); assert.equal(first.nextCursor, 'bookmarks:b');
    const last = f.run(u, 'personalSearch', { q: 'mixed', limit: 2, cursor: first.nextCursor });
    assert.deepEqual(last.items.map(i => [i.collection, i.id]), [['notes', 'a']]); assert.equal(last.nextCursor, null);
    assert.deepEqual(f.run(u, 'personalSearch', { q: 'mixed', collection: 'notes' }).items.map(i => i.id), ['a']);
    assert.deepEqual(f.run(u, 'personalSearch', { q: "' OR 1=1 --" }).items, []);
    for (const args of [{ q: '' }, { q: 'x'.repeat(101) }, { q: null }, { q: 10 }, { q: 'x', limit: 0 }, { q: 'x', limit: 201 }, { q: 'x', limit: '2' }, { q: 'x', cursor: 'notes:a:b' }, { q: 'x', cursor: 'bad:a' }, { q: 'x', collection: 'bad' }]) assert.throws(() => f.run(u, 'personalSearch', args), e => [400, 404].includes(e.status));
  } finally { await f.close(); }
});

test('usage counts UTF-8 current payloads and retained archives across all collections', async () => {
  const f = await fixture();
  try {
    const u = f.register();
    f.put(u, 'a', 0, { text: '一' }); f.put(u, 'a', 1, { text: '海' });
    f.put(u, 'b', 0, { url: 'a' }, 'bookmarks'); f.remove(u, 'b', 1, 'bookmarks');
    assert.deepEqual(f.run(u, 'personalUsage'), {
      collections: { notes: { active: 1, deleted: 0, bytes: 14 }, bookmarks: { active: 0, deleted: 1, bytes: 4 }, preferences: { active: 0, deleted: 0, bytes: 0 }, works: { active: 0, deleted: 0, bytes: 0 } },
      totals: { active: 1, deleted: 1, bytes: 18, historyBytes: 25, historyVersions: 2 },
      limits: { items: 5000, itemBytes: 16000, historyPerItem: 20, historyPerUser: 2000, historyDays: 30 },
    });
    f.inspect.prepare('UPDATE personal_versions SET stored_at=?').run(Date.now() - 31 * 86400000);
    assert.deepEqual(f.run(u, 'personalUsage').totals, { active: 1, deleted: 1, bytes: 18, historyBytes: 0, historyVersions: 0 });
  } finally { await f.close(); }
});

test('own activity is safe, newest first and cursor paginated across personal and session actions', async () => {
  const f = await fixture();
  try {
    const u = f.register('activity-user');
    f.put(u, 'a', 0, { text: 'SECRET_TEXT' }); f.put(u, 'a', 1, { text: 'SECRET_TEXT_2' }); f.remove(u, 'a', 2);
    f.run(u, 'personalRestore', { collection: 'notes', id: 'a', input: { expectedRevision: 3 } });
    const other = f.repository.run('login', { userId: u.identity.id, credentialHash: 'credential-activity-user', tokenHash: 'SECRET_TOKEN', sessionMs: 3600000 });
    f.run(u, 'revokeOwn', { id: other.sessionId });
    const another = f.repository.run('login', { userId: u.identity.id, credentialHash: 'credential-activity-user', tokenHash: 'SECRET_TOKEN_2', sessionMs: 3600000 });
    f.repository.run('logout', { sessionId: another.sessionId });
    const first = f.run(u, 'personalActivity', { limit: 3 });
    assert.deepEqual(first.events.map(e => e.action), ['logout', 'login', 'session_revoked']);
    assert.equal(first.nextCursor, String(first.events[2].id));
    const second = f.run(u, 'personalActivity', { limit: 200, cursor: first.nextCursor });
    assert.deepEqual(second.events.filter(e => e.action.startsWith('personal_')).map(e => [e.action, e.target, e.revision]), [['personal_restored', 'notes:a', 4], ['personal_deleted', 'notes:a', 3], ['personal_updated', 'notes:a', 2], ['personal_created', 'notes:a', 1]]);
    assert.equal(second.nextCursor, null);
    assert.ok(first.events.every(e => Object.keys(e).sort().join(',') === 'action,at,id,revision,target'));
    assert.ok(!JSON.stringify([...first.events, ...second.events]).includes('SECRET'));
    for (const args of [{ limit: 0 }, { limit: 201 }, { cursor: '1x' }, { cursor: '-1' }, { cursor: '9007199254740992' }]) assert.throws(() => f.run(u, 'personalActivity', args), status(400));
    f.run(u, 'logoutAll');
    assert.equal(f.inspect.prepare("SELECT action FROM audit WHERE actor=? ORDER BY sequence DESC LIMIT 1").get(u.identity.id).action, 'logout_all');
  } finally { await f.close(); }
});

test('audit failure rolls back data archives, session issuance and revocation atomically', async () => {
  const f = await fixture();
  try {
    const u = f.register('atomic-user'); f.put(u, 'a', 0, { text: 'first' });
    const second = f.repository.run('login', { userId: u.identity.id, credentialHash: 'credential-atomic-user', tokenHash: 'token-before', sessionMs: 3600000 });
    f.inspect.exec("CREATE TRIGGER reject_audit BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT,'audit blocked'); END");
    assert.throws(() => f.put(u, 'a', 1, { text: 'must rollback' }), /audit blocked/);
    assert.equal(f.run(u, 'personal', { method: 'GET', collection: 'notes', id: 'a' }).item.revision, 1);
    assert.equal(f.inspect.prepare('SELECT count(*) AS n FROM personal_versions').get().n, 0);
    assert.throws(() => f.repository.run('login', { userId: u.identity.id, credentialHash: 'credential-atomic-user', tokenHash: 'token-failed', sessionMs: 3600000 }), /audit blocked/);
    assert.equal(f.inspect.prepare('SELECT count(*) AS n FROM sessions').get().n, 2);
    assert.throws(() => f.run(u, 'revokeOwn', { id: second.sessionId }), /audit blocked/);
    assert.throws(() => f.repository.run('logout', { sessionId: second.sessionId }), /audit blocked/);
    assert.equal(f.inspect.prepare('SELECT count(*) AS n FROM sessions').get().n, 2);
    assert.throws(() => f.run(u, 'logoutAll'), /audit blocked/);
    assert.equal(f.inspect.prepare('SELECT count(*) AS n FROM sessions').get().n, 2);
  } finally { await f.close(); }
});

test('trash pagination and restore validate inputs without changing retained content', async () => {
  const f = await fixture();
  try {
    const u = f.register();
    for (const id of ['a', 'b', 'c']) { f.put(u, id, 0, { text: id }); f.remove(u, id, 1); }
    const page = f.run(u, 'personalTrash', { collection: 'notes', limit: 2 });
    assert.deepEqual(page.items.map(i => i.id), ['a', 'b']); assert.equal(page.nextCursor, 'b');
    assert.deepEqual(f.run(u, 'personalTrash', { collection: 'notes', cursor: page.nextCursor }).items.map(i => i.id), ['c']);
    for (const args of [{ collection: 'bad' }, { collection: 'notes', limit: 0 }, { collection: 'notes', limit: 201 }, { collection: 'notes', cursor: ':' }]) assert.throws(() => f.run(u, 'personalTrash', args), e => [400, 404].includes(e.status));
    for (const args of [{ id: '../a', input: { expectedRevision: 2 } }, { id: 123, input: { expectedRevision: 2 } }, { id: 'a', input: null }, { id: 'a', input: {} }, { id: 'a', input: { expectedRevision: 2, revision: -1 } }, { id: 'a', input: { expectedRevision: 2, revision: '1' } }]) assert.throws(() => f.run(u, 'personalRestore', { collection: 'notes', ...args }), status(400));
    assert.equal(f.run(u, 'personalHistory', { collection: 'notes', id: 'a' }).items[0].revision, 2);
  } finally { await f.close(); }
});

test('account deletion removes only its own archives and active session privileges', async () => {
  const f = await fixture();
  try {
    const a = f.register('erase-user'), b = f.register();
    for (const u of [a, b]) { f.put(u, 'a', 0, { text: u.identity.name }); f.put(u, 'a', 1, { text: 'updated' }); }
    f.run(a, 'deleteAccount', { expectedHash: 'credential-erase-user', confirm: 'erase-user' });
    assert.equal(f.inspect.prepare('SELECT count(*) AS n FROM personal_versions WHERE owner=?').get(a.identity.id).n, 0);
    assert.equal(f.inspect.prepare('SELECT count(*) AS n FROM audit WHERE actor=?').get(a.identity.id).n, 0);
    assert.equal(f.run(b, 'personalHistory', { collection: 'notes', id: 'a' }).items.length, 2);
    assert.throws(() => f.run(a, 'personalUsage'), status(401));
  } finally { await f.close(); }
});

test('personal activity never enters the legacy teacher Flow revision audit', async () => {
  const f = await fixture();
  try {
    const u = f.register(); f.inspect.prepare("UPDATE users SET role='teacher' WHERE id=?").run(u.identity.id); u.identity.role = 'teacher';
    const id = randomUUID();
    f.run(u, 'flowWrite', { route: 'drafts', key: randomUUID(), hash: 'flow-request', input: { id, expectedRevision: 0, scope: 'campus', title: 'Teaching', body: 'Lesson', summary: 'Public summary', startsAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString() } });
    f.put(u, 'personal-note', 0, { text: 'Private' }); f.put(u, 'personal-note', 1, { text: 'Private updated' });
    const flow = f.run(u, 'flowRead', { route: 'drafts' });
    assert.deepEqual(flow.audit.map(e => [e.action, e.objectId, e.revision]), [['draft_saved', id, 1]]);
    assert.equal(f.run(u, 'personalActivity').events.filter(e => e.action.startsWith('personal_')).length, 2);
  } finally { await f.close(); }
});

test('personal quotas include tombstones but allow existing edits and restore at the item limit', async () => {
  const f = await fixture();
  try {
    const u = f.register(); f.put(u, 'recover', 0, { text: 'recover me' }); f.remove(u, 'recover', 1);
    const seed = f.inspect.prepare('INSERT INTO personal_data VALUES(?,?,?,?,?,?,?)');
    f.inspect.exec('BEGIN IMMEDIATE');
    for (let i = 0; i < 4999; i++) seed.run(u.identity.id, 'notes', 'quota-' + i, 1, 1, 'null', '2001-01-01');
    f.inspect.exec('COMMIT');
    assert.throws(() => f.put(u, 'new', 0, { x: 'new' }), status(429));
    const restored = f.run(u, 'personalRestore', { collection: 'notes', id: 'recover', input: { expectedRevision: 2 } });
    assert.deepEqual([restored.item.revision, restored.item.data], [3, { text: 'recover me' }]);
    assert.equal(f.put(u, 'recover', 3, { x: 'x'.repeat(15992) }).revision, 4);
    assert.throws(() => f.put(u, 'recover', 4, { x: 'x'.repeat(15993) }), status(413));
    assert.equal(f.run(u, 'personalHistory', { collection: 'notes', id: 'recover' }).items[0].revision, 4);
    assert.equal(f.inspect.prepare('SELECT count(*) AS n FROM personal_data').get().n, 5000);
  } finally { await f.close(); }
});
