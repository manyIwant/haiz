import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serviceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PASSWORD = 'SyntheticTestPassword2026!';
const START_TIMEOUT = 10000;

async function unusedPort() {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolveClose => reservation.close(resolveClose));
  return port;
}

export async function startService(database) {
  const port = await unusedPort();
  const child = spawn(process.execPath, [join(serviceRoot, 'server.mjs')], {
    cwd: serviceRoot,
    env: {
      ...process.env,
      HAIZ_DB_PATH: database,
      HAIZ_HOST: '127.0.0.1',
      HAIZ_PORT: String(port),
      HAIZ_ADMIN_LOGIN: 'synthetic_admin',
      HAIZ_ADMIN_PASSWORD: PASSWORD,
      HAIZ_QQ_RELAY_SECRET: '',
      HAIZ_SCHOOL_ROSTER_SECRET: '',
      HAIZ_SCHOOL_ISSUER: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  await new Promise((resolveReady, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Academic startup timed out: ${output}`));
    }, START_TIMEOUT);
    const collect = chunk => {
      output += chunk.toString();
      if (output.includes(`http://127.0.0.1:${port}`)) {
        clearTimeout(timer);
        resolveReady();
      }
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => {
      clearTimeout(timer);
      reject(new Error(`Academic exited ${code}: ${output}`));
    });
  });
  return {
    root: `http://127.0.0.1:${port}`,
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      await exited;
    },
  };
}

export function client(service) {
  let cookie = '';
  return {
    async call(path, method = 'GET', data, headers = {}) {
      const response = await fetch(service.root + path, {
        method,
        headers: {
          ...(cookie ? { Cookie: cookie } : {}),
          ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...headers,
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
      const session = response.headers.get('set-cookie');
      if (session?.startsWith('hsid=')) cookie = session.split(';')[0];
      const body = await response.json();
      return { status: response.status, body, headers: response.headers };
    },
  };
}

export function expectOk(response, status = 200) {
  assert.equal(response.status, status, JSON.stringify(response.body));
  assert.equal(response.body.error, null);
  assert.ok(['Synced', 'Pending'].includes(response.body.state));
  assert.ok(response.body.meta && typeof response.body.meta === 'object');
  return response.body.data;
}

export function expectError(response, status, state) {
  assert.equal(response.status, status, JSON.stringify(response.body));
  assert.equal(response.body.state, state);
  assert.equal(response.body.data, null);
  assert.equal(typeof response.body.error.code, 'string');
  assert.equal(typeof response.body.error.message, 'string');
  return response.body.error;
}

export async function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'haiz-v14-synthetic-'));
  const database = join(directory, 'academic.sqlite');
  let running = await startService(database);
  const service = { get root() { return running.root; } };
  t.after(async () => {
    await running.stop();
    rmSync(directory, { recursive: true, force: true });
  });
  const admin = client(service);
  assert.equal((await admin.call('/api/auth/login', 'POST', {
    login: 'synthetic_admin', password: PASSWORD,
  })).status, 200);
  assert.equal((await admin.call('/api/admin/teachers', 'POST', {
    login: 'synthetic_teacher', label: '虚构教师 A', password: PASSWORD,
  })).status, 201);
  const teacher = client(service);
  assert.equal((await teacher.call('/api/auth/login', 'POST', {
    login: 'synthetic_teacher', password: PASSWORD,
  })).status, 200);
  const created = await teacher.call('/api/classes', 'POST', { title: '虚构数学班' });
  assert.equal(created.status, 201);
  const classroom = created.body;
  const enroll = async (suffix, approve = true) => {
    const student = client(service);
    assert.equal((await student.call('/api/auth/register', 'POST', {
      login: `synthetic_student_${suffix}`, label: `虚构学生 ${suffix}`,
      password: PASSWORD, joinCode: classroom.joinCode,
    })).status, 201);
    const me = await student.call('/api/me');
    const id = me.body.user.id;
    if (approve) assert.equal((await teacher.call(
      `/api/classes/${classroom.id}/members/${id}/approve`, 'POST', {},
    )).status, 200);
    return { ...student, id };
  };
  const b = await enroll('b');
  const c = await enroll('c');
  let sequence = 0;
  const command = (actor, path, body, method = 'POST', key) => actor.call(
    '/api/v1' + path, method, body,
    { 'Idempotency-Key': key || `synthetic_key_${++sequence}` },
  );
  const create = async (fields = {}) => expectOk(await command(teacher,
    `/classes/${classroom.id}/assignments`, {
      subject: '数学', title: '虚构数学作业', details: '完成合成测试题',
      due: '2026-10-29', duePrecision: 'date', ...fields,
    }), 201).assignment;
  const publish = async (fields = {}) => {
    const draft = await create(fields);
    const review = expectOk(await command(teacher, `/assignments/${draft.id}/review`,
      { expectedVersion: draft.version })).assignment;
    return expectOk(await command(teacher, `/assignments/${draft.id}/publish`,
      { expectedVersion: review.version })).assignment;
  };
  return {
    service, database, admin, teacher, b, c, classroom, enroll,
    anonymous: client(service), command, create, publish,
    async restart() { await running.stop(); running = await startService(database); },
  };
}

export async function sync(actor, cursor, limit = 100) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set('cursor', cursor);
  return actor.call('/api/v1/sync?' + query);
}
