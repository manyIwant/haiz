import { createRepositoryCore } from '../repository-core.mjs';
import { check } from '../errors.mjs';

// Only these exact Node connection settings are harmless to omit: Cloudflare
// owns locking, journaling, durability and connection lifecycle.
const managedPragmas = new Set([
  'PRAGMA busy_timeout=3000',
  'PRAGMA journal_mode=WAL',
  'PRAGMA synchronous=FULL',
  'PRAGMA wal_checkpoint(TRUNCATE)',
].map(sql => sql.toLowerCase()));

function sqliteAdapter(storage) {
  const sql = storage.sql;
  storage.transactionSync(() => {
    sql.exec('CREATE TABLE IF NOT EXISTS __haiz_metadata(key TEXT PRIMARY KEY, value INTEGER NOT NULL)');
  });
  const query = (statement, bindings = []) => {
    const normalized = statement.trim().replace(/;\s*$/, '').trim();
    if (/^PRAGMA\b/i.test(normalized)) {
      check(bindings.length === 0, 500, '存储设置不接受参数');
      if (/^PRAGMA\s+user_version$/i.test(normalized)) {
        const row = sql.exec("SELECT value AS user_version FROM __haiz_metadata WHERE key='schema_version'").toArray()[0];
        return { rows: [row || { user_version: 0 }], changes: 0 };
      }
      const version = /^PRAGMA\s+user_version\s*=\s*(\d+)$/i.exec(normalized);
      if (version) {
        const value = Number(version[1]);
        check(Number.isSafeInteger(value), 500, '数据库版本无效');
        sql.exec("INSERT INTO __haiz_metadata(key,value) VALUES('schema_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", value).toArray();
        return { rows: [], changes: 1 };
      }
      if (managedPragmas.has(normalized.toLowerCase())) return { rows: [], changes: 0 };
      // Foreign keys must remain enabled; unlike file pragmas this setting has
      // real SQL semantics and is executed by the Durable Object engine.
      check(/^PRAGMA\s+foreign_keys\s*=\s*ON$/i.test(normalized), 500, '云存储不支持此数据库设置');
    }
    check(!/^(?:BEGIN|COMMIT|END|ROLLBACK|SAVEPOINT|RELEASE|ATTACH|DETACH|VACUUM)\b/i.test(normalized), 500, '云存储不支持此数据库操作');
    return { rows: sql.exec(statement, ...bindings).toArray() };
  };
  return {
    exec(statement) { query(statement); },
    prepare(statement) {
      return {
        get(...bindings) { return query(statement, bindings).rows[0]; },
        all(...bindings) { return query(statement, bindings).rows; },
        run(...bindings) {
          const result = query(statement, bindings);
          if (result.changes !== undefined) return { changes: result.changes };
          // rowsWritten includes index updates. SQLite changes() preserves the
          // affected-row contract used by session revocation and other checks.
          return sql.exec('SELECT changes() AS changes, last_insert_rowid() AS lastInsertRowid').toArray()[0];
        },
      };
    },
  };
}

export function createCloudRepository(storage) {
  check(storage?.sql && typeof storage.transactionSync === 'function', 500, '需要 SQLite Durable Object 存储');
  const db = sqliteAdapter(storage);
  return createRepositoryCore(db, { transaction: callback => storage.transactionSync(callback) });
}
