import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { migrate } from '../migrate.mjs';
import { fixture, expectOk, expectError, sync } from './helpers.mjs';

const migrationSql = readFileSync(new URL('../migrations/001-versioned-assignments.sql', import.meta.url), 'utf8');
const ids = Object.freeze({
  teacher: '00000000-0000-4000-8000-000000000001',
  student: '00000000-0000-4000-8000-000000000002',
  classroom: '00000000-0000-4000-8000-000000000003',
  assignment: '00000000-0000-4000-8000-000000000004',
  missingClass: '00000000-0000-4000-8000-000000000005',
});
const createdAt = '2026-10-27T08:00:00.000Z';
const viewedAt = '2026-10-27T09:00:00.000Z';
const legacyTables = ['users', 'sessions', 'classes', 'memberships', 'assignments', 'acknowledgements'];

function legacyDatabase(t, { orphan = false } = {}) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec('PRAGMA foreign_keys=OFF');
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, login TEXT UNIQUE NOT NULL, label TEXT NOT NULL,
      role TEXT NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL);
    CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), expiry INTEGER NOT NULL);
    CREATE TABLE classes (id TEXT PRIMARY KEY, title TEXT NOT NULL, teacher_id TEXT REFERENCES users(id),
      join_code TEXT UNIQUE NOT NULL, screen_key TEXT UNIQUE NOT NULL);
    CREATE TABLE memberships (class_id TEXT REFERENCES classes(id), user_id TEXT REFERENCES users(id),
      status TEXT NOT NULL, PRIMARY KEY(class_id,user_id));
    CREATE TABLE assignments (id TEXT PRIMARY KEY, class_id TEXT REFERENCES classes(id), subject TEXT NOT NULL,
      title TEXT NOT NULL, due TEXT, details TEXT NOT NULL, source_id TEXT, created_by TEXT REFERENCES users(id), created_at TEXT NOT NULL);
    CREATE TABLE acknowledgements (assignment_id TEXT REFERENCES assignments(id), user_id TEXT REFERENCES users(id),
      viewed_at TEXT, PRIMARY KEY(assignment_id,user_id));
  `);
  const user = db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)');
  user.run(ids.teacher, 'synthetic_legacy_teacher', '虚构旧教师', 'teacher', 'synthetic-salt', 'synthetic-hash');
  user.run(ids.student, 'synthetic_legacy_student', '虚构旧学生', 'student', 'synthetic-salt', 'synthetic-hash');
  db.prepare('INSERT INTO sessions VALUES (?,?,?)').run('synthetic-session-digest', ids.student, 2000000000000);
  db.prepare('INSERT INTO classes VALUES (?,?,?,?,?)').run(ids.classroom, '虚构旧班级', ids.teacher, 'synthetic-invite', 'synthetic-screen');
  db.prepare('INSERT INTO memberships VALUES (?,?,?)').run(ids.classroom, ids.student, 'active');
  db.prepare('INSERT INTO assignments VALUES (?,?,?,?,?,?,?,?,?)').run(ids.assignment,
    orphan ? ids.missingClass : ids.classroom, '数学', '保留旧作业 UUID', '2026-10-29',
    '原始说明不得丢失', 'synthetic-intake', ids.teacher, createdAt);
  db.prepare('INSERT INTO acknowledgements VALUES (?,?,?)').run(ids.assignment, ids.student, viewedAt);
  db.exec('PRAGMA foreign_keys=ON');
  return db;
}

const plain = value => JSON.parse(JSON.stringify(value));
const rows = (db, table) => plain(db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all());
const oldRecords = db => Object.fromEntries(legacyTables.map(table => [table, rows(db, table)]));
const schema = db => plain(db.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all());
const count = (db, table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
const columns = db => db.prepare('PRAGMA table_info(assignments)').all().map(row => row.name);

function counts(db) {
  return Object.fromEntries(['assignments', 'assignment_revisions', 'sync_events', 'command_receipts', 'audit']
    .map(table => [table, count(db, table)]));
}

test('populated v1.3 migration preserves every old row and backfills identity, revisions, events and viewed version', t => {
  const db = legacyDatabase(t);
  const before = oldRecords(db);
  migrate(db);
  for (const table of legacyTables.filter(table => table !== 'assignments')) {
    assert.deepEqual(rows(db, table), before[table], `${table} changed during migration`);
  }
  const assignment = rows(db, 'assignments')[0];
  assert.deepEqual(Object.fromEntries(Object.keys(before.assignments[0]).map(key => [key, assignment[key]])), before.assignments[0]);
  assert.equal(assignment.id, ids.assignment);
  assert.equal(assignment.version, 1);
  assert.equal(assignment.status, 'published');
  assert.equal(assignment.due_precision, 'date');
  const revision = rows(db, 'assignment_revisions')[0];
  const event = rows(db, 'sync_events')[0];
  assert.equal(revision.assignment_id, ids.assignment);
  assert.equal(revision.version, 1);
  assert.equal(revision.actor_id, ids.teacher);
  assert.equal(event.resource_id, ids.assignment);
  assert.equal(event.class_id, ids.classroom);
  assert.equal(event.type, 'assignment.published');
  assert.equal(event.version, 1);
  assert.equal(event.snapshot, revision.snapshot);
  assert.equal(JSON.parse(event.snapshot).due, '2026-10-29');
  assert.deepEqual(rows(db, 'version_acknowledgements'), [{
    assignment_id: ids.assignment, user_id: ids.student, version: 1, viewed_at: viewedAt,
  }]);
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('migration rerun preserves instance, signing secret, rows and ledger without duplicate events', t => {
  const db = legacyDatabase(t);
  migrate(db);
  const names = [...legacyTables, 'assignment_revisions', 'sync_events', 'version_acknowledgements', 'academic_meta', 'schema_migrations'];
  const before = Object.fromEntries(names.map(name => [name, rows(db, name)]));
  migrate(db);
  assert.deepEqual(Object.fromEntries(names.map(name => [name, rows(db, name)])), before);
  assert.equal(count(db, 'schema_migrations'), 1);
  assert.equal(count(db, 'sync_events'), 1);
});

test('changed applied migration checksum fails closed and leaves schema and data unchanged', t => {
  const db = legacyDatabase(t);
  migrate(db);
  const before = { schema: schema(db), records: oldRecords(db), meta: rows(db, 'academic_meta'), ledger: rows(db, 'schema_migrations') };
  assert.throws(() => migrate(db, { sql: migrationSql + '\n-- synthetic checksum mismatch\n' }), /checksum mismatch/i);
  assert.equal(db.isTransaction, false);
  assert.deepEqual({ schema: schema(db), records: oldRecords(db), meta: rows(db, 'academic_meta'), ledger: rows(db, 'schema_migrations') }, before);
});

test('migration SQL failure rolls back additive schema and retains original user data for retry', t => {
  const db = legacyDatabase(t);
  const before = { schema: schema(db), records: oldRecords(db) };
  assert.throws(() => migrate(db, { sql: migrationSql + '\nINSERT INTO synthetic_missing_table VALUES (1);' }), /synthetic_missing_table/);
  assert.equal(db.isTransaction, false);
  assert.deepEqual({ schema: schema(db), records: oldRecords(db) }, before);
  assert.equal(columns(db).includes('version'), false);
  migrate(db);
  assert.equal(rows(db, 'assignments')[0].id, ids.assignment);
  assert.equal(count(db, 'sync_events'), 1);
});

test('legacy foreign-key corruption stops migration without rewriting the broken source record', t => {
  const db = legacyDatabase(t, { orphan: true });
  const before = { schema: schema(db), records: oldRecords(db) };
  assert.ok(db.prepare('PRAGMA foreign_key_check').all().length > 0);
  assert.throws(() => migrate(db), /foreign key/i);
  assert.equal(db.isTransaction, false);
  assert.deepEqual({ schema: schema(db), records: oldRecords(db) }, before);
  assert.equal(columns(db).includes('version'), false);
});

test('recorded assignment revisions and public events reject update and deletion', t => {
  const db = legacyDatabase(t);
  migrate(db);
  for (const table of ['assignment_revisions', 'sync_events']) {
    const before = rows(db, table);
    assert.throws(() => db.exec(`UPDATE ${table} SET version=99`), /immutable/i);
    assert.throws(() => db.exec(`DELETE FROM ${table}`), /immutable/i);
    assert.deepEqual(rows(db, table), before);
  }
});

test('SQLite write contention returns explicit 503 with no partial command and same-key retry publishes once', async t => {
  const f = await fixture(t);
  const db = new DatabaseSync(f.database);
  try {
    const before = counts(db);
    const path = `/classes/${f.classroom.id}/assignments`;
    const key = 'synthetic_storage_lock_retry';
    const body = { subject: '数学', title: '写锁后只创建一次', details: '虚构锁竞争测试' };
    db.exec('BEGIN IMMEDIATE');
    try {
      const blocked = await f.command(f.teacher, path, body, 'POST', key);
      assert.equal(expectError(blocked, 503, 'Failed').code, 'DATABASE_BUSY');
      assert.deepEqual(counts(db), before);
    } finally {
      db.exec('ROLLBACK');
    }
    const created = expectOk(await f.command(f.teacher, path, body, 'POST', key), 201);
    const repeated = expectOk(await f.command(f.teacher, path, body, 'POST', key), 201);
    assert.equal(repeated.replayed, true);
    assert.equal(repeated.assignment.id, created.assignment.id);
    assert.equal(count(db, 'assignments'), before.assignments + 1);
    assert.equal(count(db, 'assignment_revisions'), before.assignment_revisions + 1);
    assert.equal(count(db, 'command_receipts'), before.command_receipts + 1);
  } finally {
    if (db.isTransaction) db.exec('ROLLBACK');
    db.close();
  }
});

test('cursor below retained event floor requires safe resnapshot without returning assignment content', async t => {
  const f = await fixture(t);
  await f.publish({ title: '保留水位前作业' });
  const baseline = expectOk(await sync(f.b));
  const db = new DatabaseSync(f.database);
  try {
    const oldHigh = db.prepare('SELECT MAX(sequence) AS n FROM sync_events').get().n;
    await f.publish({ title: '保留水位后作业' });
    db.prepare("UPDATE academic_meta SET value=? WHERE key='eventFloor'").run(String(oldHigh + 1));
    const response = await sync(f.b, baseline.cursor);
    const error = expectError(response, 410, 'Failed');
    assert.equal(error.code, 'CURSOR_EXPIRED');
    assert.equal(error.resyncRequired, true);
    assert.equal(JSON.stringify(response.body).includes('保留水位后作业'), false);
    const fresh = expectOk(await sync(f.b));
    assert.equal(fresh.mode, 'snapshot');
    assert.equal(fresh.assignments.length, 2);
  } finally {
    db.close();
  }
});

test('event insertion failure rolls back publication, revision, audit and receipt before same-key retry', async t => {
  const f = await fixture(t);
  const draft = await f.create();
  const review = expectOk(await f.command(f.teacher, `/assignments/${draft.id}/review`, {
    expectedVersion: draft.version,
  })).assignment;
  const db = new DatabaseSync(f.database);
  const key = 'synthetic_storage_atomic_retry';
  const path = `/assignments/${draft.id}/publish`;
  const body = { expectedVersion: review.version };
  try {
    const before = counts(db);
    const beforeAssignment = rows(db, 'assignments');
    db.exec("CREATE TRIGGER synthetic_event_failure BEFORE INSERT ON sync_events BEGIN SELECT RAISE(ABORT,'synthetic event failure'); END;");
    const failed = await f.command(f.teacher, path, body, 'POST', key);
    const error = expectError(failed, 500, 'Failed');
    assert.equal(error.code, 'INTERNAL_ERROR');
    assert.equal(error.message.includes('synthetic event failure'), false);
    assert.deepEqual(counts(db), before);
    assert.deepEqual(rows(db, 'assignments'), beforeAssignment);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM command_receipts WHERE key=?').get(key).n, 0);
    db.exec('DROP TRIGGER synthetic_event_failure');
    const published = expectOk(await f.command(f.teacher, path, body, 'POST', key)).assignment;
    assert.equal(published.status, 'published');
    assert.equal(published.version, review.version + 1);
    const replay = expectOk(await f.command(f.teacher, path, body, 'POST', key));
    assert.equal(replay.replayed, true);
    assert.equal(count(db, 'assignment_revisions'), before.assignment_revisions + 1);
    assert.equal(count(db, 'sync_events'), before.sync_events + 1);
    assert.equal(count(db, 'command_receipts'), before.command_receipts + 1);
    assert.equal(count(db, 'audit'), before.audit + 1);
  } finally {
    db.exec('DROP TRIGGER IF EXISTS synthetic_event_failure');
    db.close();
  }
});
