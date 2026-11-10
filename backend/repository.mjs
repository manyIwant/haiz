import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { check } from './errors.mjs';
import { createRepositoryCore } from './repository-core.mjs';

export function createRepository(directory) {
  mkdirSync(directory, { recursive: true, mode: 0o700 }); chmodSync(directory, 0o700);
  const file = join(directory, 'haiz.sqlite');
  const db = new DatabaseSync(file); chmodSync(file, 0o600);
  try {
    return createRepositoryCore(db, {
      async backup({ destination }) {
        check(resolve(destination) !== resolve(file), 400, '备份不能覆盖正在使用的数据库');
        await backup(db, destination); chmodSync(destination, 0o600);
        return { ok: true };
      },
      close() { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); db.close(); return { ok: true }; },
    });
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    db.close(); throw error;
  }
}
