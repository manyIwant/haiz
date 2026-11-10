import { constants } from 'node:fs';
import { lstat, mkdir, open, opendir, link, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Worker } from 'node:worker_threads';

const HOUR = 3600000, RETRY_MS = 60000, MAX_FILES = 10000;
const COMPLETE_NAME = /^haiz-backup-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)-[a-f0-9]{32}\.sqlite$/;
const unsafe = () => Error('Backup operation refused');
const identity = info => ({ dev: info.dev.toString(), ino: info.ino.toString() });
const sameFile = (info, expected) => info.dev.toString() === expected.dev && info.ino.toString() === expected.ino;
const noFollow = constants.O_RDONLY | constants.O_NOFOLLOW;

// Verification uses a separate Worker: even a large quick_check never runs on
// the HTTP event loop, and its messages contain no paths or SQLite errors.
function verifyBackup(file, expected) {
  return new Promise((resolveVerification, rejectVerification) => {
    const worker = new Worker(new URL('./backup-verifier-worker.mjs', import.meta.url), { workerData: { file, expected } });
    let valid = false, integrityInvalid = false, settled = false;
    const finish = (ok, invalid = false) => {
      if (settled) return; settled = true; clearTimeout(timeout);
      if (ok) resolveVerification();
      else { const error = unsafe(); if (invalid) error.code = 'BACKUP_INTEGRITY_INVALID'; rejectVerification(error); }
    };
    const timeout = setTimeout(() => { void worker.terminate(); finish(false); }, 120000); timeout.unref();
    worker.once('message', message => { valid = message?.ok === true; integrityInvalid = message?.integrityInvalid === true; });
    worker.once('error', () => finish(false));
    worker.once('exit', code => finish(code === 0 && valid, code === 0 && integrityInvalid));
  });
}

function backupTime(name) {
  const match = COMPLETE_NAME.exec(name); if (!match) return null;
  const value = match[1].replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, 'T$1:$2:$3.$4Z');
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value ? { at: value, timestamp } : null;
}

/**
 * directory is the private data root; backups are stored in its backups/ child.
 * start() is nonblocking, stop() waits for active work. run() explicitly requests
 * one immediate backup and shares any existing run; failures are in status.
 */
export function createBackupScheduler({ database, directory, intervalMs = 86400000, keep = 7, logger = () => {} }) {
  if (!Number.isInteger(intervalMs) || (intervalMs !== 0 && (intervalMs < HOUR || intervalMs > 168 * HOUR))) throw TypeError('Invalid backup interval');
  if (!Number.isInteger(keep) || keep < 1 || keep > 365) throw TypeError('Invalid backup keep count');
  if (!database || typeof database.call !== 'function') throw TypeError('Invalid backup database');
  if (typeof directory !== 'string' || !directory.trim()) throw TypeError('Invalid backup directory');
  const root = resolve(directory), destination = join(root, 'backups');
  const state = { enabled: intervalMs !== 0, running: false, lastSuccessAt: null, lastFailureAt: null, retained: 0 };
  let active = false, stopping = false, current = null, timer = null;
  const log = event => { try { logger({ event }); } catch { /* logging cannot break maintenance */ } };

  async function secureDirectory() {
    await mkdir(root, { recursive: true, mode: 0o700 });
    const rootHandle = await open(root, noFollow | constants.O_DIRECTORY);
    let rootInfo;
    try { rootInfo = await rootHandle.stat({ bigint: true }); if (!rootInfo.isDirectory()) throw unsafe(); await rootHandle.chmod(0o700); }
    finally { await rootHandle.close(); }
    try { await mkdir(destination, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    const handle = await open(destination, noFollow | constants.O_DIRECTORY);
    try {
      const info = await handle.stat({ bigint: true }); if (!info.isDirectory()) throw unsafe();
      await handle.chmod(0o700); return { root: identity(rootInfo), backups: identity(info) };
    } finally { await handle.close(); }
  }
  async function assertDirectory(expected) {
    const [parent, child] = await Promise.all([lstat(root, { bigint: true }), lstat(destination, { bigint: true })]);
    if (!parent.isDirectory() || !child.isDirectory() || !sameFile(parent, expected.root) || !sameFile(child, expected.backups)) throw unsafe();
  }
  async function inspect(expected) {
    await assertDirectory(expected);
    const files = [], directoryHandle = await opendir(destination);
    for await (const entry of directoryHandle) {
      if (!entry.isFile()) continue;
      const time = backupTime(entry.name); if (!time) continue;
      const info = await lstat(join(destination, entry.name), { bigint: true });
      // A hard link is also excluded: it can alias a file outside this private directory.
      if (!info.isFile() || info.nlink !== 1n) continue;
      if (time.timestamp > Date.now() + 300000 || files.length >= MAX_FILES) throw unsafe();
      files.push({ name: entry.name, ...time, ...identity(info) });
    }
    await assertDirectory(expected);
    return files.sort((a, b) => b.timestamp - a.timestamp || b.name.localeCompare(a.name));
  }
  async function assertFile(file, expected) {
    const info = await lstat(file, { bigint: true });
    if (!info.isFile() || info.nlink !== 1n || !sameFile(info, expected)) throw unsafe();
    return info;
  }
  async function checkLatest(files, expected) {
    if (!files.length) { state.retained = 0; return false; }
    await assertDirectory(expected);
    const latest = files[0], file = join(destination, latest.name);
    await assertFile(file, latest);
    let verificationError;
    try { await verifyBackup(file, latest); } catch (error) { verificationError = error; }
    // A changed directory or file identity is always fatal. Only an unchanged
    // snapshot's integrity failure may trigger replacement from the primary.
    await assertDirectory(expected); await assertFile(file, latest);
    if (verificationError) {
      if (verificationError.code !== 'BACKUP_INTEGRITY_INVALID') throw verificationError;
      state.lastFailureAt = new Date().toISOString(); state.retained = files.length;
      log('backup_existing_invalid'); return false;
    }
    state.lastSuccessAt = latest.at; state.retained = files.length; return true;
  }
  async function perform(force) {
    const expected = await secureDirectory();
    const files = await inspect(expected), latestValid = await checkLatest(files, expected);
    if (!force && latestValid && Date.now() - files[0].timestamp < intervalMs) return;
    const temporary = join(destination, `.haiz-backup-${randomBytes(16).toString('hex')}.tmp`);
    let handle, temporaryIdentity;
    try {
      await assertDirectory(expected);
      handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
      temporaryIdentity = identity(await handle.stat({ bigint: true }));
      await database.call('backup', { destination: temporary });
      await assertDirectory(expected); await assertFile(temporary, temporaryIdentity); await handle.chmod(0o600);
      await verifyBackup(temporary, temporaryIdentity);
      await assertDirectory(expected); await assertFile(temporary, temporaryIdentity);
      // Preserve publication order through small backward clock changes, so
      // rotation can never rank an older corrupt snapshot ahead of this one.
      const at = new Date(Math.max(Date.now(), (files[0]?.timestamp ?? 0) + 1)).toISOString();
      const name = `haiz-backup-${at.replaceAll(':', '-').replace('.', '-')}-${randomBytes(16).toString('hex')}.sqlite`;
      // link + unlink gives an atomic, same-directory publication with EEXIST
      // protection. Unlike rename(), it can never overwrite an existing backup.
      await link(temporary, join(destination, name)); await unlink(temporary);
      state.lastSuccessAt = at; state.retained = files.length + 1;
      const completed = await inspect(expected);
      for (const obsolete of completed.slice(keep)) {
        await assertDirectory(expected); await assertFile(join(destination, obsolete.name), obsolete);
        await unlink(join(destination, obsolete.name)); state.retained--;
      }
      state.retained = completed.length - Math.max(0, completed.length - keep);
      log('backup_completed');
    } finally {
      if (handle) {
        try {
          await assertDirectory(expected);
          const info = await lstat(temporary, { bigint: true });
          if (info.isFile() && sameFile(info, temporaryIdentity)) await unlink(temporary);
        } catch { /* a changed path is never followed or removed */ }
        await handle.close();
      }
    }
  }
  function schedule(failed) {
    if (!active || stopping) return;
    const remaining = state.lastSuccessAt ? intervalMs - (Date.now() - Date.parse(state.lastSuccessAt)) : 0;
    timer = setTimeout(() => { timer = null; launch(false); }, failed ? RETRY_MS : Math.max(1, remaining)); timer.unref();
  }
  function launch(force) {
    if (!state.enabled || stopping) return Promise.resolve();
    if (current) return current;
    clearTimeout(timer); timer = null; state.running = true;
    let failed = false;
    current = perform(force).catch(() => {
      failed = true; state.lastFailureAt = new Date().toISOString(); log('backup_failed');
    }).finally(() => { state.running = false; current = null; schedule(failed); });
    return current;
  }
  return {
    start() { if (!state.enabled || active) return; stopping = false; active = true; launch(false); },
    async stop() { stopping = true; active = false; clearTimeout(timer); timer = null; await current; },
    run() { return launch(true); },
    get status() { return { ...state }; },
  };
}
