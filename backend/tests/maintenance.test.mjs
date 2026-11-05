import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, link, lstat, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../database.mjs';
import { createBackupScheduler } from '../maintenance.mjs';

const ownedName = (at, suffix = 'a'.repeat(32)) => `haiz-backup-${at.replaceAll(':', '-').replace('.', '-')}-${suffix}.sqlite`;
const completeFiles = async directory => (await readdir(join(directory, 'backups'))).filter(name => /^haiz-backup-.+\.sqlite$/.test(name));
async function waitFor(predicate) {
  const deadline = Date.now() + 10000;
  while (!predicate()) { assert.ok(Date.now() < deadline, 'backup state did not settle'); await delay(10); }
}
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'haiz-maintenance-'));
  const database = await openDatabase(directory);
  await database.call('bootstrap', { tokenHash: 'private-backup-test-token', inviteMs: 86400000 });
  const schedulers = [];
  const scheduler = options => { const item = createBackupScheduler({ database, directory, logger: () => {}, ...options }); schedulers.push(item); return item; };
  t.after(async () => { for (const item of schedulers) await item.stop(); await database.close(); await rm(directory, { recursive: true, force: true }); });
  return { directory, database, scheduler };
}

test('startup makes a private verified SQLite backup that can be restored', async t => {
  const f = await fixture(t), scheduler = f.scheduler();
  assert.equal(scheduler.start(), undefined);
  await waitFor(() => scheduler.status.lastSuccessAt !== null);
  await scheduler.stop();
  const files = await completeFiles(f.directory);
  assert.equal(files.length, 1);
  assert.deepEqual(await readdir(join(f.directory, 'backups')), files, 'verification must not leave SQLite WAL/shared-memory files');
  assert.equal((await stat(join(f.directory, 'backups'))).mode & 0o777, 0o700);
  assert.equal((await stat(join(f.directory, 'backups', files[0]))).mode & 0o777, 0o600);
  const restoredDirectory = join(f.directory, 'restored'); await mkdir(restoredDirectory);
  await copyFile(join(f.directory, 'backups', files[0]), join(restoredDirectory, 'haiz.sqlite'));
  const restored = await openDatabase(restoredDirectory);
  try { assert.ok((await restored.call('ready')).schemaVersion >= 2); } finally { await restored.close(); }
  const inspection = new DatabaseSync(join(restoredDirectory, 'haiz.sqlite'), { readOnly: true });
  try { assert.equal(inspection.prepare('SELECT token_hash FROM invites').get().token_hash, 'private-backup-test-token'); }
  finally { inspection.close(); }
  assert.deepEqual(scheduler.status, { enabled: true, running: false, lastSuccessAt: scheduler.status.lastSuccessAt, lastFailureAt: null, retained: 1 });
  assert.equal(new Date(scheduler.status.lastSuccessAt).toISOString(), scheduler.status.lastSuccessAt);
});

test('explicit backups rotate only completed owned regular files after success', async t => {
  const f = await fixture(t), scheduler = f.scheduler({ keep: 2 });
  await scheduler.run(); const oldest = (await completeFiles(f.directory))[0];
  await writeFile(join(f.directory, 'backups', 'operator.sqlite'), 'leave this file alone');
  await writeFile(join(f.directory, 'backups', '.haiz-backup-unfinished.tmp'), 'unfinished');
  await scheduler.run(); await scheduler.run();
  const files = await completeFiles(f.directory);
  assert.equal(files.length, 2); assert.ok(!files.includes(oldest)); assert.equal(scheduler.status.retained, 2);
  assert.equal(await readFile(join(f.directory, 'backups', 'operator.sqlite'), 'utf8'), 'leave this file alone');
  assert.equal(await readFile(join(f.directory, 'backups', '.haiz-backup-unfinished.tmp'), 'utf8'), 'unfinished');
});

test('failed writes preserve completed backups and clean their temporary file without leaking errors', async t => {
  const f = await fixture(t), events = []; let fail = false;
  const database = { call: async (operation, args) => {
    if (fail) { await writeFile(args.destination, 'partial'); throw Error(`private-backup-test-token ${f.directory}`); }
    return f.database.call(operation, args);
  } };
  const scheduler = f.scheduler({ database, keep: 1, logger: event => events.push(event) });
  await scheduler.run(); const before = await readdir(join(f.directory, 'backups'));
  fail = true; await scheduler.run();
  assert.deepEqual(await readdir(join(f.directory, 'backups')), before);
  assert.equal(scheduler.status.retained, 1); assert.ok(scheduler.status.lastFailureAt); assert.ok(scheduler.status.lastSuccessAt);
  assert.ok(events.length > 0); assert.ok(!JSON.stringify(events).includes(f.directory)); assert.ok(!JSON.stringify(events).includes('private-backup-test-token'));
  assert.equal(scheduler.status.running, false);
});

test('a corrupt SQLite backup is rejected before publication or rotation', async t => {
  const f = await fixture(t); let corrupt = false;
  const database = { call: async (operation, args) => corrupt ? writeFile(args.destination, 'not a sqlite database') : f.database.call(operation, args) };
  const scheduler = f.scheduler({ database, keep: 1 });
  await scheduler.run(); const before = await readdir(join(f.directory, 'backups'));
  corrupt = true; await scheduler.run();
  assert.deepEqual(await readdir(join(f.directory, 'backups')), before); assert.ok(scheduler.status.lastFailureAt);
});

test('an empty backup result is refused even though SQLite accepts an empty database', async t => {
  const f = await fixture(t), scheduler = f.scheduler({ database: { call: async () => ({ ok: true }) } });
  await scheduler.run();
  assert.ok(scheduler.status.lastFailureAt); assert.equal(scheduler.status.lastSuccessAt, null);
  assert.deepEqual(await readdir(join(f.directory, 'backups')), []);
});

test('stop waits for an ongoing backup and concurrent triggers share that work', async t => {
  const f = await fixture(t); let release, markEntered;
  const gate = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { markEntered = resolve; });
  const database = { call: async (operation, args) => { markEntered(); await gate; return f.database.call(operation, args); } };
  const scheduler = f.scheduler({ database }); scheduler.start(); await entered;
  const running = scheduler.run(); assert.equal(scheduler.status.running, true);
  let stopped = false; const closing = scheduler.stop().then(() => { stopped = true; });
  await delay(20); assert.equal(stopped, false); release(); await closing; await running;
  assert.equal(scheduler.status.running, false); assert.equal((await completeFiles(f.directory)).length, 1);
});

test('startup checks the latest completed backup and waits until it is due', async t => {
  const f = await fixture(t), first = f.scheduler(); await first.run(); await first.stop();
  const before = await completeFiles(f.directory), second = f.scheduler(); second.start();
  await waitFor(() => second.status.lastSuccessAt !== null && !second.status.running);
  await second.stop(); assert.deepEqual(await completeFiles(f.directory), before);
  assert.equal(second.status.lastSuccessAt, first.status.lastSuccessAt); assert.equal(second.status.retained, 1);
});

test('an overdue completed backup triggers a new startup backup', async t => {
  const f = await fixture(t), first = f.scheduler(); await first.run(); await first.stop();
  const [name] = await completeFiles(f.directory), path = join(f.directory, 'backups');
  await copyFile(join(path, name), join(path, ownedName('2020-01-01T00:00:00.000Z'))); await rm(join(path, name));
  const scheduler = f.scheduler(); scheduler.start();
  await waitFor(() => scheduler.status.retained === 2); await scheduler.stop();
  assert.equal((await completeFiles(f.directory)).length, 2); assert.ok(scheduler.status.lastSuccessAt > '2020-01-01T00:00:00.000Z');
});

test('a symlinked backup directory is refused without modifying its target', async t => {
  const f = await fixture(t), outside = await mkdtemp(join(tmpdir(), 'haiz-backup-target-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(join(outside, 'keep'), 'private'); await symlink(outside, join(f.directory, 'backups'));
  const scheduler = f.scheduler(); await scheduler.run();
  assert.ok(scheduler.status.lastFailureAt); assert.equal(scheduler.status.lastSuccessAt, null);
  assert.deepEqual(await readdir(outside), ['keep']); assert.ok((await lstat(join(f.directory, 'backups'))).isSymbolicLink());
});

test('completed-looking symlinks never delay backups or enter retention rotation', async t => {
  const f = await fixture(t), outside = join(f.directory, 'sensitive'); await writeFile(outside, 'do not change');
  await mkdir(join(f.directory, 'backups'));
  const link = join(f.directory, 'backups', ownedName('2099-01-01T00:00:00.000Z'));
  await symlink(outside, link);
  const scheduler = f.scheduler({ keep: 1 }); await scheduler.run(); await scheduler.run();
  assert.equal(scheduler.status.retained, 1); assert.ok((await lstat(link)).isSymbolicLink());
  assert.equal(await readFile(outside, 'utf8'), 'do not change');
});

test('completed-looking hard links and invalid timestamps remain outside backup ownership', async t => {
  const f = await fixture(t), outside = join(f.directory, 'sensitive'); await writeFile(outside, 'do not change');
  await mkdir(join(f.directory, 'backups'));
  const hardLink = join(f.directory, 'backups', ownedName('2099-01-01T00:00:00.000Z'));
  const invalidDate = join(f.directory, 'backups', ownedName('2026-02-31T00:00:00.000Z'));
  await link(outside, hardLink); await writeFile(invalidDate, 'leave invalid names alone');
  const scheduler = f.scheduler({ keep: 1 }); await scheduler.run(); await scheduler.run();
  assert.equal(scheduler.status.retained, 1); assert.equal((await lstat(hardLink)).nlink, 2);
  assert.equal(await readFile(outside, 'utf8'), 'do not change'); assert.equal(await readFile(invalidDate, 'utf8'), 'leave invalid names alone');
});

test('a corrupt latest backup is preserved until fresh verified snapshots replace it through ordinary rotation', async t => {
  const f = await fixture(t), events = [], scheduler = f.scheduler({ keep: 3, logger: event => events.push(event) });
  await mkdir(join(f.directory, 'backups'));
  const name = ownedName(new Date().toISOString()); await writeFile(join(f.directory, 'backups', name), 'corrupt');
  scheduler.start(); await waitFor(() => !scheduler.status.running && scheduler.status.lastFailureAt !== null);
  assert.ok(scheduler.status.lastSuccessAt, 'integrity failure must not permanently block healthy primary backups');
  assert.ok(events.some(event => event.event === 'backup_existing_invalid'));
  assert.equal(await readFile(join(f.directory, 'backups', name), 'utf8'), 'corrupt');
  assert.equal((await completeFiles(f.directory)).length, 2);
  const primary = new DatabaseSync(join(f.directory, 'haiz.sqlite'));
  try {
    for (const token of ['committed-after-corruption', 'next-committed-change']) {
      primary.prepare('UPDATE invites SET token_hash=?').run(token);
      const before = new Set(await completeFiles(f.directory)); await scheduler.run();
      const [created] = (await completeFiles(f.directory)).filter(file => !before.has(file)); assert.ok(created);
      const snapshot = new DatabaseSync(`${pathToFileURL(join(f.directory, 'backups', created)).href}?immutable=1`, { readOnly: true });
      try { assert.equal(snapshot.prepare('SELECT token_hash FROM invites').get().token_hash, token); }
      finally { snapshot.close(); }
    }
  } finally { primary.close(); }
  const remaining = await completeFiles(f.directory); assert.equal(remaining.length, 3); assert.ok(!remaining.includes(name));
  assert.equal(scheduler.status.retained, 3); await scheduler.stop();
});

test('replacing a corrupt snapshot with clock skew retains the fresh verified backup', async t => {
  const f = await fixture(t), scheduler = f.scheduler({ keep: 1 }); await mkdir(join(f.directory, 'backups'));
  const name = ownedName(new Date(Date.now() + 120000).toISOString());
  await writeFile(join(f.directory, 'backups', name), 'corrupt'); scheduler.start();
  await waitFor(() => !scheduler.status.running && scheduler.status.lastSuccessAt !== null); await scheduler.stop();
  const files = await completeFiles(f.directory); assert.equal(files.length, 1); assert.notEqual(files[0], name);
  const snapshot = new DatabaseSync(`${pathToFileURL(join(f.directory, 'backups', files[0])).href}?immutable=1`, { readOnly: true });
  try { assert.equal(snapshot.prepare('SELECT token_hash FROM invites').get().token_hash, 'private-backup-test-token'); }
  finally { snapshot.close(); }
});

test('replacing a temporary backup with a symlink is refused without touching its target', async t => {
  const f = await fixture(t), target = join(f.directory, 'sensitive'); await writeFile(target, 'do not change', { mode: 0o644 });
  const database = { call: async (_operation, { destination }) => { await rm(destination); await symlink(target, destination); } };
  const scheduler = f.scheduler({ database }); await scheduler.run();
  assert.ok(scheduler.status.lastFailureAt); assert.equal(scheduler.status.lastSuccessAt, null);
  assert.equal(await readFile(target, 'utf8'), 'do not change'); assert.equal((await stat(target)).mode & 0o777, 0o644);
});

test('disabled backups create no directories and reject unsupported interval values', async t => {
  const f = await fixture(t), scheduler = f.scheduler({ intervalMs: 0 });
  scheduler.start(); await scheduler.run(); await scheduler.stop();
  assert.deepEqual(scheduler.status, { enabled: false, running: false, lastSuccessAt: null, lastFailureAt: null, retained: 0 });
  await assert.rejects(stat(join(f.directory, 'backups')), { code: 'ENOENT' });
  for (const intervalMs of [-1, 1, 3599999, 604800001, Infinity, NaN, '3600000']) {
    assert.throws(() => f.scheduler({ intervalMs }), /interval/i);
  }
  for (const keep of [0, -1, 1.5, Infinity, '7']) assert.throws(() => f.scheduler({ keep }), /keep/i);
});
