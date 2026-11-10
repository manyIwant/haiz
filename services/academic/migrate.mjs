import { readFileSync } from 'node:fs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { assignmentView } from './model.mjs';

export function transaction(db, operation) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = operation();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  }
}

export function migrate(db, { sql = readFileSync(new URL('./migrations/001-versioned-assignments.sql', import.meta.url), 'utf8') } = {}) {
  db.exec('PRAGMA busy_timeout=1500;');
  transaction(db, () => {
    db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const previous = db.prepare('SELECT checksum FROM schema_migrations WHERE version=1').get();
    if (previous) {
      if (previous.checksum !== checksum) throw Error('Migration checksum mismatch; database left unchanged');
      return;
    }
    db.exec(sql);
    const set = db.prepare('INSERT INTO academic_meta VALUES (?,?)');
    for (const [key, value] of [['instanceId', randomUUID()], ['cursorSecret', randomBytes(32).toString('hex')], ['eventFloor', '0']]) set.run(key, value);
    backfill(db);
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw Error('Migration foreign key check failed');
    if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw Error('Migration integrity check failed');
    db.prepare('INSERT INTO schema_migrations VALUES (1,?,?)').run(checksum, new Date().toISOString());
  });
}

function backfill(db) {
  const revision = db.prepare('INSERT INTO assignment_revisions VALUES (?,?,?,?,?,?,?)');
  const event = db.prepare('INSERT INTO sync_events(type,class_id,resource_id,version,occurred_at,snapshot) VALUES (?,?,?,?,?,?)');
  for (const row of db.prepare('SELECT * FROM assignments ORDER BY created_at,id').all()) {
    const snapshot = JSON.stringify(assignmentView(row));
    revision.run(row.id, 1, row.created_by, 'legacy.publish', row.created_at, JSON.stringify(['status']), snapshot);
    event.run('assignment.published', row.class_id, row.id, 1, row.created_at, snapshot);
  }
  db.exec('INSERT INTO version_acknowledgements SELECT assignment_id,user_id,1,viewed_at FROM acknowledgements');
}
