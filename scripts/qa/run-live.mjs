// Run a disposable synthetic HTTP fixture, never a deployment database.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const directory = await mkdtemp(join(tmpdir(), 'haiz-qa-live-'));
let server;
let db;
let child;
let interrupted = false;
const terminate = () => { interrupted = true; child?.kill('SIGTERM'); };
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, terminate);
try {
  process.env.HAIZ_DB_PATH = join(directory, 'academic.sqlite');
  process.env.HAIZ_HOST = '127.0.0.1';
  process.env.HAIZ_ADMIN_LOGIN = 'synthetic_admin';
  process.env.HAIZ_ADMIN_PASSWORD = 'SyntheticTestPassword2026!';
  process.env.HAIZ_QQ_RELAY_SECRET = '';
  process.env.HAIZ_SCHOOL_ROSTER_SECRET = '';
  process.env.HAIZ_SCHOOL_ISSUER = '';
  ({ server, db } = await import('../../services/academic/server.mjs'));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  process.exitCode = await new Promise((resolve, reject) => {
    if (interrupted) { resolve(143); return; }
    child = spawn(process.execPath, [fileURLToPath(new URL('./live-contract.mjs', import.meta.url))], {
      env: { ...process.env, HAIZ_QA_BASE: `http://127.0.0.1:${server.address().port}` },
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (status) => resolve(status ?? 1));
  });
} finally {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  db?.close();
  await rm(directory, { recursive: true, force: true });
  for (const signal of ['SIGINT', 'SIGTERM']) process.off(signal, terminate);
  if (interrupted) process.exitCode = 143;
}
