import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

// A real SQLite connection with transaction ownership outside the repository.
// Any SQL BEGIN emitted by the core would violate the Durable Object contract.
function connection() {
  const native = new DatabaseSync(':memory:');
  const db = {
    prepare: sql => native.prepare(sql),
    exec(sql) {
      assert.doesNotMatch(sql, /(?:^|;)\s*(?:BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i);
      return native.exec(sql);
    },
  };
  const transaction = callback => {
    native.exec('BEGIN IMMEDIATE');
    try { const result = callback(); native.exec('COMMIT'); return result; }
    catch (error) { native.exec('ROLLBACK'); throw error; }
  };
  return { native, db, transaction };
}

// Executes actual SQL, while enforcing the native DO SQL restrictions at the
// adapter boundary. Workerd integration is exercised by the cloud test suite.
function storageConnection() {
  const { native, transaction } = connection();
  return {
    native,
    storage: {
      transactionSync: transaction,
      sql: {
        exec(sql, ...bindings) {
          if (!/^PRAGMA foreign_keys=ON$/i.test(sql)) assert.doesNotMatch(sql, /(?:^|;)\s*(?:PRAGMA|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i);
          let rows = [], rowsWritten = 0;
          if (/^\s*(?:CREATE|ALTER|DROP)\b/i.test(sql)) native.exec(sql);
          else {
            const statement = native.prepare(sql);
            if (statement.columns().length) rows = statement.all(...bindings);
            else rowsWritten = Number(statement.run(...bindings).changes);
          }
          return { toArray: () => rows, rowsWritten };
        },
      },
    },
  };
}

const register = (repository, name, tokenHash = name + '-token') => repository.run('register', { name, passwordHash: name + '-hash', tokenHash, sessionMs: 3600000 });
const personal = (repository, user, method, input) => repository.run('personal', { who: user.identity, sessionId: user.sessionId, method, collection: 'notes', id: 'note', input });

test('injected transactions roll back archives and writes when the audit fails', async () => {
  const { createRepositoryCore } = await import('../repository-core.mjs');
  const f = connection();
  try {
    const repository = createRepositoryCore(f.db, { transaction: f.transaction });
    const user = register(repository, 'core-user');
    personal(repository, user, 'PUT', { expectedRevision: 0, data: { text: 'keep' } });
    f.native.exec("CREATE TRIGGER reject_audit BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT,'audit blocked'); END");
    assert.throws(() => personal(repository, user, 'PUT', { expectedRevision: 1, data: { text: 'discard' } }), /audit blocked/);
    assert.equal(personal(repository, user, 'GET').item.data.text, 'keep');
    assert.equal(f.native.prepare('SELECT count(*) AS n FROM personal_versions').get().n, 0);
    assert.throws(() => repository.run('personal', { who: user.identity, sessionId: 'wrong-session', method: 'GET', collection: 'notes', id: 'note' }), error => error.status === 401);
  } finally { f.native.close(); }
});

test('injected schema migration rolls back and rejects newer versions without downgrading', async () => {
  const { createRepositoryCore } = await import('../repository-core.mjs');
  const f = connection();
  try {
    f.native.exec(`CREATE TABLE audit(sequence INTEGER PRIMARY KEY,actor TEXT,action TEXT,target TEXT,at TEXT,revision INTEGER);
      CREATE VIEW personal_versions AS SELECT 1 AS owner; PRAGMA user_version=2;`);
    assert.throws(() => createRepositoryCore(f.db, { transaction: f.transaction }));
    assert.equal(f.native.prepare('PRAGMA user_version').get().user_version, 2);
    assert.equal(f.native.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='users'").get().n, 0);
    f.native.exec('PRAGMA user_version=99');
    assert.throws(() => createRepositoryCore(f.db, { transaction: f.transaction }), /数据库版本高于当前服务/);
    assert.equal(f.native.prepare('PRAGMA user_version').get().user_version, 99);
  } finally { f.native.close(); }
});

test('cloud storage persists schema metadata, data and conflict checks without Node pragmas', async () => {
  const { createCloudRepository } = await import('../cloudflare/sqlite.mjs');
  const f = storageConnection();
  try {
    let repository = createCloudRepository(f.storage);
    assert.equal(repository.run('ready', {}).schemaVersion, 3);
    const user = register(repository, 'cloud-user');
    personal(repository, user, 'PUT', { expectedRevision: 0, data: { text: 'first' } });
    personal(repository, user, 'PUT', { expectedRevision: 1, data: { text: 'second' } });
    repository = createCloudRepository(f.storage);
    assert.equal(personal(repository, user, 'GET').item.revision, 2);
    assert.throws(() => personal(repository, user, 'PUT', { expectedRevision: 1, data: { text: 'stale' } }), error => error.status === 409 && error.remote.revision === 2);
    assert.deepEqual(repository.run('personalHistory', { who: user.identity, sessionId: user.sessionId, collection: 'notes', id: 'note' }).items.map(row => row.data.text), ['second', 'first']);
    assert.equal(f.native.prepare('PRAGMA user_version').get().user_version, 0);
    assert.throws(() => repository.run('revokeOwn', { who: user.identity, sessionId: user.sessionId, id: 'missing' }), error => error.status === 404);
    assert.equal(repository.run('authenticate', { tokenHash: 'cloud-user-token' }).identity.id, user.identity.id);
  } finally { f.native.close(); }
});

test('cloud storage rejects newer schemas and cannot claim local file backup support', async () => {
  const { createCloudRepository } = await import('../cloudflare/sqlite.mjs');
  const f = storageConnection();
  try {
    const repository = createCloudRepository(f.storage);
    await assert.rejects(repository.run('backup', { destination: '/tmp/not-a-backup.sqlite' }), error => error.status === 501);
    f.native.prepare("UPDATE __haiz_metadata SET value=99 WHERE key='schema_version'").run();
    assert.throws(() => createCloudRepository(f.storage), /数据库版本高于当前服务/);
    assert.equal(f.native.prepare("SELECT value FROM __haiz_metadata WHERE key='schema_version'").get().value, 99);
  } finally { f.native.close(); }
});
