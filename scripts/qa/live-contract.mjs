// Seed a running loopback-only QA service and execute real Flutter HTTP tests.
// All credentials below are public synthetic fixtures, never deployment secrets.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const base = process.env.HAIZ_QA_BASE || 'http://127.0.0.1:8796';
const target = new URL(base);
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'QA only seeds loopback');
const password = 'SyntheticTestPassword2026!';
const suffix = randomUUID().slice(0, 8);
function actor() {
  let cookie = '';
  return async (path, body, key) => {
    const response = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(cookie ? { Cookie: cookie } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(key ? { 'Idempotency-Key': key } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const session = response.headers.get('set-cookie');
    if (session) cookie = session.split(';')[0];
    const result = await response.json();
    assert.ok(response.ok, `fixture request ${path}: ${response.status} ${JSON.stringify(result)}`);
    return result;
  };
}
const admin = actor();
await admin('/api/auth/login', { login: 'synthetic_admin', password });
const teacherLogin = `qa_teacher_${suffix}`;
await admin('/api/admin/teachers', { login: teacherLogin, password, label: '虚构 QA 教师' });
const teacher = actor();
await teacher('/api/auth/login', { login: teacherLogin, password });
const classroom = await teacher('/api/classes', { title: '虚构 QA 班级' });
const learners = await Promise.all(['a', 'b'].map(async name => {
  const call = actor();
  const login = `qa_student_${name}_${suffix}`;
  await call('/api/auth/register', { login, password, label: `虚构学生 ${name}`, joinCode: classroom.joinCode });
  const { user } = await call('/api/me');
  await teacher(`/api/classes/${classroom.id}/members/${user.id}/approve`, {});
  return { login, id: user.id };
}));
await teacher(`/api/classes/${classroom.id}/assignments`, {
  title: '虚构 QA 初始作业', subject: '数学', details: '只用于合成验收', due: '2026-11-02',
});
const env = { ...process.env, HAIZ_LIVE_BASE: base,
  HAIZ_LIVE_A: learners[0].login, HAIZ_LIVE_A_PASS: password, HAIZ_LIVE_A_ID: learners[0].id,
  HAIZ_LIVE_B: learners[1].login, HAIZ_LIVE_B_PASS: password, HAIZ_LIVE_B_ID: learners[1].id,
  HAIZ_QA_TEACHER: teacherLogin, HAIZ_QA_PASSWORD: password,
  HAIZ_QA_CLASS: classroom.id, HAIZ_QA_SCREEN: classroom.screenKey,
};
// The lifecycle test revokes A; execute files sequentially after baseline tests.
const child = spawn('flutter', ['test', '--no-pub', '--concurrency=1', '--tags', 'live', '--reporter', 'expanded',
  'test/academic_contract_live_test.dart', 'test/qa_lifecycle_live_test.dart'], {
  cwd: fileURLToPath(new URL('../../app/', import.meta.url)), env, stdio: 'inherit',
});
const terminate = () => child.kill('SIGTERM');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, terminate);
const detachSignals = () => {
  for (const signal of ['SIGINT', 'SIGTERM']) process.off(signal, terminate);
};
child.once('error', error => { detachSignals(); console.error(error.message); process.exitCode = 1; });
child.once('exit', code => { detachSignals(); process.exitCode = code ?? 1; });
