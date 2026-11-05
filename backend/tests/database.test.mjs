import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../database.mjs';

test('newer database schemas are rejected without being silently downgraded', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'haiz-schema-')); let connection;
  try {
    const file = join(directory, 'haiz.sqlite'), newer = new DatabaseSync(file);
    newer.exec('PRAGMA user_version=99'); newer.close();
    await assert.rejects(async () => { connection = await openDatabase(directory); }, /数据库版本高于当前服务/);
    const restored = new DatabaseSync(file, { readOnly: true });
    assert.equal(restored.prepare('PRAGMA user_version').get().user_version, 99); restored.close();
  } finally { await connection?.close(); await rm(directory, { recursive: true, force: true }); }
});

test('version 1 databases migrate atomically and preserve existing audit history', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'haiz-migrate-')); let connection;
  try {
    const file = join(directory, 'haiz.sqlite'), old = new DatabaseSync(file);
    old.exec(`CREATE TABLE audit(sequence INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, at TEXT NOT NULL);
      INSERT INTO audit(actor,action,target,at) VALUES('old-actor','old-action','old-target','2026-11-04'); PRAGMA user_version=1;`); old.close();
    connection = await openDatabase(directory);
    assert.equal((await connection.call('ready')).schemaVersion, 3);
    await connection.close(); connection = null;
    const migrated = new DatabaseSync(file, { readOnly: true });
    assert.equal(migrated.prepare('SELECT action,revision FROM audit').get().action, 'old-action');
    assert.equal(migrated.prepare('SELECT revision FROM audit').get().revision, null); migrated.close();
    connection = await openDatabase(directory);
    assert.equal((await connection.call('ready')).schemaVersion, 3);
  } finally { await connection?.close(); await rm(directory, { recursive: true, force: true }); }
});

test('version 2 upgrade preserves personal content, tombstones, sessions and existing revisions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'haiz-migrate-v2-')); let connection;
  try {
    const file = join(directory, 'haiz.sqlite'), old = new DatabaseSync(file);
    old.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE,password_hash TEXT,role TEXT NOT NULL,scope TEXT NOT NULL,scopes TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE sessions(id TEXT PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,user_id TEXT NOT NULL,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE personal_data(owner TEXT NOT NULL,collection TEXT NOT NULL,id TEXT NOT NULL,revision INTEGER NOT NULL,deleted INTEGER NOT NULL DEFAULT 0,data TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(owner,collection,id));
      CREATE TABLE audit(sequence INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,at TEXT NOT NULL,revision INTEGER);
      INSERT INTO users VALUES('legacy','legacy','hash','student','campus','["campus"]',1);
      INSERT INTO personal_data VALUES('legacy','notes','live',7,0,'{"text":"legacy content"}','2001-01-01');
      INSERT INTO personal_data VALUES('legacy','notes','gone',8,1,'null','2001-01-02');
      INSERT INTO audit(actor,action,target,at,revision) VALUES('legacy','personal_updated','notes:live','2001-01-01',7);
      PRAGMA user_version=2;`);
    old.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run('legacy-session', 'legacy-token', 'legacy', Date.now() + 3600000, 1); old.close();
    connection = await openDatabase(directory);
    assert.equal((await connection.call('ready')).schemaVersion, 3);
    const auth = await connection.call('authenticate', { tokenHash: 'legacy-token' });
    const args = { who: auth.identity, sessionId: auth.sessionId, collection: 'notes' };
    assert.equal((await connection.call('personalHistory', { ...args, id: 'live' })).items[0].revision, 7);
    assert.deepEqual((await connection.call('personalTrash', args)).items, []);
    await connection.call('personal', { ...args, method: 'DELETE', id: 'live', input: { expectedRevision: 7 } });
    assert.equal((await connection.call('personalTrash', args)).items[0].data.text, 'legacy content');
    await connection.close(); connection = null;
    const migrated = new DatabaseSync(file, { readOnly: true });
    assert.equal(migrated.prepare("SELECT revision FROM personal_data WHERE id='gone'").get().revision, 8);
    assert.equal(migrated.prepare("SELECT revision FROM audit WHERE action='personal_updated'").get().revision, 7);
    assert.equal(migrated.prepare('PRAGMA foreign_key_check').all().length, 0); migrated.close();
  } finally { await connection?.close(); await rm(directory, { recursive: true, force: true }); }
});

test('failed schema upgrade leaves the previous version and its tables unchanged', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'haiz-migrate-rollback-')); let connection;
  try {
    const file = join(directory, 'haiz.sqlite'), old = new DatabaseSync(file);
    old.exec(`CREATE TABLE audit(sequence INTEGER PRIMARY KEY,actor TEXT,action TEXT,target TEXT,at TEXT,revision INTEGER);
      INSERT INTO audit VALUES(1,'actor','keep','target','2001-01-01',4);
      CREATE VIEW personal_versions AS SELECT 1 AS owner; PRAGMA user_version=2;`); old.close();
    await assert.rejects(async () => { connection = await openDatabase(directory); });
    const unchanged = new DatabaseSync(file, { readOnly: true });
    assert.equal(unchanged.prepare('PRAGMA user_version').get().user_version, 2);
    assert.equal(unchanged.prepare('SELECT action FROM audit').get().action, 'keep');
    assert.equal(unchanged.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name='users'").get().n, 0);
    unchanged.close();
  } finally { await connection?.close(); await rm(directory, { recursive: true, force: true }); }
});
