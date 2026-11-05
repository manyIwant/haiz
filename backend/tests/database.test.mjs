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
    assert.equal((await connection.call('ready')).schemaVersion, 2);
    await connection.close(); connection = null;
    const migrated = new DatabaseSync(file, { readOnly: true });
    assert.equal(migrated.prepare('SELECT action,revision FROM audit').get().action, 'old-action');
    assert.equal(migrated.prepare('SELECT revision FROM audit').get().revision, null); migrated.close();
    connection = await openDatabase(directory);
    assert.equal((await connection.call('ready')).schemaVersion, 2);
  } finally { await connection?.close(); await rm(directory, { recursive: true, force: true }); }
});
