import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { openDatabase } from '../database.mjs';
import { hash } from '../auth.mjs';
import { createService } from '../server.mjs';
const execute = promisify(execFile);

test('operator issues role-scoped invites and recovers an inaccessible administrator without printing secrets', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'haiz-operator-')); let db, service;
  try {
    db = await openDatabase(directory);
    await db.call('bootstrap', { tokenHash: hash('initial'), inviteMs: 60000 }); await db.close(); db = null;
    const run = async args => JSON.parse((await execute(process.execPath, ['backend/manage.mjs', ...args], { cwd: new URL('../../', import.meta.url), env: { ...process.env, HAIZ_DATA_DIR: directory } })).stdout.trim());
    const issued = await run(['invite', 'teacher-one', 'teacher', '一班']);
    const token = (await readFile(issued.file, 'utf8')).trim();
    assert.ok(!JSON.stringify(issued).includes(token));
    db = await openDatabase(directory);
    const teacher = await db.call('claimInvite', { inviteHash: hash(token), tokenHash: hash('teacher-session'), sessionMs: 60000 });
    assert.equal(teacher.identity.role, 'teacher'); assert.deepEqual(teacher.identity.scopes, ['一班']);
    await db.close(); db = null;
    const recovered = await run(['recover-admin']);
    // Exercise the documented stop -> recover -> start lifecycle, including bootstrap.
    service = await createService({ directory, development: true, port: 0, logger: () => {} });
    db = await openDatabase(directory);
    const adminToken = (await readFile(recovered.file, 'utf8')).trim();
    assert.equal((await db.call('claimInvite', { inviteHash: hash(adminToken), tokenHash: hash('new-admin-session'), sessionMs: 60000 })).identity.role, 'admin');
    const destination = join(directory, 'operator-backup.sqlite');
    const result = await run(['backup', destination]); assert.equal(result.ok, true);
  } finally { await db?.close(); await service?.close(); await rm(directory, { recursive: true, force: true }); }
});
