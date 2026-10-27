import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newIdempotencyKey, isValidIdempotencyKey, contentBody, validateDraft,
  describeDue, diffContent, createClient, createKeyRegistry, createAssignmentCommands,
  ApiError, UnknownOutcomeError, validateAssignment,
} from '../../js/api.js';

const assignment = { id: 'a1', classId: 'c1', subject: '数学', title: '练习', details: '', due: null, duePrecision: 'none', createdBy: 'u1', createdAt: '2026-10-27T08:00:00Z', updatedAt: '2026-10-27T08:00:00Z', version: 1, status: 'draft', source: { kind: 'teacher' } };
const envelope = data => ({ state: 'Synced', data, error: null, meta: {} });

test('validates canonical assignments and refuses malformed mutation success', async () => {
  assert.deepEqual(validateAssignment(assignment), assignment);
  for (const bad of [{}, { ...assignment, version: 0 }, { ...assignment, status: 'unknown' }, { ...assignment, due: '2026-02-30', duePrecision: 'date' }]) {
    assert.throws(() => validateAssignment(bad), UnknownOutcomeError);
  }
  const commands = createAssignmentCommands(createClient({ fetch: async () => new Response(JSON.stringify(envelope({ assignment: {} }))) }));
  await assert.rejects(commands.review('a1', 1, 'Valid_Key_123'), UnknownOutcomeError);
});

test('refuses malformed v1 envelopes and preserves legacy error messages', async () => {
  const malformed = createClient({ fetch: async () => new Response(JSON.stringify({ data: {} })) });
  await assert.rejects(malformed.send('/api/v1/identity'), UnknownOutcomeError);
  const legacy = createClient({ fetch: async () => new Response(JSON.stringify({ error: '账号或密码错误' }), { status: 401 }) });
  await assert.rejects(legacy.send('/api/auth/login'), error => error.message === '账号或密码错误');
});

test('sends request headers and times out while reading response body', async () => {
  let headers;
  const client = createClient({ headers: { Base: 'yes' }, fetch: async (_, options) => { headers = options.headers; return new Response(JSON.stringify(envelope({}))); } });
  await client.send('/api/v1/classroom', { headers: { Authorization: 'Bearer synthetic' } });
  assert.equal(headers.Authorization, 'Bearer synthetic');
  assert.equal(headers.Base, 'yes');
  const stalled = createClient({ timeoutMs: 10, fetch: async () => ({ ok: true, json: () => new Promise(() => {}) }) });
  await assert.rejects(stalled.send('/api/v1/identity'), UnknownOutcomeError);
});

test('pagination follows all list and history pages without silently truncating', async () => {
  const urls = [];
  const client = createClient({ fetch: async url => {
    urls.push(url);
    const history = url.includes('history');
    const second = url.includes('after=1');
    const item = history ? { version: second ? 2 : 1, actorId: 'u1', operation: 'edit', occurredAt: assignment.updatedAt, changedFields: ['title'], assignment } : assignment;
    return new Response(JSON.stringify({ ...envelope({ [history ? 'revisions' : 'assignments']: [item] }), meta: { nextAfter: second ? null : 1 } }));
  } });
  const commands = createAssignmentCommands(client);
  assert.equal((await commands.list('c1', { limit: 1 })).data.assignments.length, 2);
  assert.equal((await commands.history('a1', { limit: 1 })).data.revisions.length, 2);
  assert.equal(urls.length, 4);
});

test('selected due precision requires an actual valid calendar date', () => {
  for (const fields of [{ due: null, duePrecision: 'date' }, { due: null, duePrecision: 'minute' }, { due: '2026-02-30T18:30:00+08:00', duePrecision: 'minute' }]) {
    assert.ok(validateDraft({ subject: 's', title: 't', classId: 'c', ...fields }).some(problem => problem.includes('截止')));
  }
});

/* ── idempotency keys ─────────────────────────────────────────────── */

test('generated keys match the server alphabet and length', () => {
  const key = newIdempotencyKey();
  assert.equal(isValidIdempotencyKey(key), true);
  assert.ok(key.length >= 8 && key.length <= 100);
});

test('key validation rejects bad input', () => {
  for (const bad of ['', 'short', 'has space here!', null, 123, 'x'.repeat(101)]) {
    assert.equal(isValidIdempotencyKey(bad), false);
  }
});

/* ── contentBody ──────────────────────────────────────────────────── */

test('contentBody trims subject/title and pairs due with precision', () => {
  assert.deepEqual(
    contentBody({ subject: ' 数学 ', title: ' 练习 ', details: '', due: '2026-10-29', duePrecision: 'date' }),
    { subject: '数学', title: '练习', details: '', due: '2026-10-29', duePrecision: 'date' });
});

test('no due always means precision none', () => {
  assert.equal(contentBody({ subject: 'a', title: 'b', due: null, duePrecision: 'date' }).duePrecision, 'none');
  assert.equal(contentBody({ subject: 'a', title: 'b', due: '', duePrecision: 'minute' }).due, null);
});

/* ── validateDraft ────────────────────────────────────────────────── */

test('rejects missing subject, title and class', () => {
  const problems = validateDraft({ subject: '', title: '', classId: '' });
  assert.ok(problems.some(p => p.includes('科目')));
  assert.ok(problems.some(p => p.includes('标题')));
  assert.ok(problems.some(p => p.includes('班级')));
});

test('rejects an impossible calendar date', () => {
  const problems = validateDraft({ subject: 'a', title: 'b', classId: 'c', due: '2026-02-30', duePrecision: 'date' });
  assert.ok(problems.some(p => p.includes('截止')));
});

test('accepts a valid minute-precision due', () => {
  const problems = validateDraft({ subject: 'a', title: 'b', classId: 'c', due: '2026-10-29T18:30:00+08:00', duePrecision: 'minute' });
  assert.deepEqual(problems, []);
});

test('enforces field length limits', () => {
  assert.ok(validateDraft({ subject: 'a'.repeat(33), title: 'b', classId: 'c' }).some(p => p.includes('32')));
  assert.ok(validateDraft({ subject: 'a', title: 'b'.repeat(241), classId: 'c' }).some(p => p.includes('240')));
  assert.ok(validateDraft({ subject: 'a', title: 'b', details: 'x'.repeat(3001), classId: 'c' }).some(p => p.includes('3000')));
});

/* ── describeDue ──────────────────────────────────────────────────── */

test('describeDue renders none, date and minute', () => {
  assert.equal(describeDue({ due: null }), '不设截止时间');
  assert.equal(describeDue({ due: '2026-10-29', duePrecision: 'date' }), '2026 年 10 月 29 日');
  assert.equal(describeDue({ due: '2026-10-29T18:30:00+08:00', duePrecision: 'minute' }), new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date('2026-10-29T18:30:00+08:00')));
});

/* ── diffContent ──────────────────────────────────────────────────── */

test('diffContent lists only the fields that differ', () => {
  const changes = diffContent(
    { subject: '数学', title: '我的标题', details: '', due: null },
    { subject: '数学', title: '服务器标题', details: '', due: null },
  );
  assert.equal(changes.length, 1);
  assert.equal(changes[0].field, 'title');
  assert.equal(changes[0].mine, '我的标题');
  assert.equal(changes[0].theirs, '服务器标题');
});

test('diffContent reports an identical draft as no changes', () => {
  const changes = diffContent(
    { subject: '数学', title: 't', details: 'd', due: '2026-10-29', duePrecision: 'date' },
    { subject: '数学', title: 't', details: 'd', due: '2026-10-29', duePrecision: 'date' },
  );
  assert.equal(changes.length, 0);
});

/* ── client: honest error reading ─────────────────────────────────── */

function stubFetch(handlers) {
  const calls = [];
  return {
    calls,
    fetch: async (url, opts) => {
      calls.push({ url, opts });
      return handlers({ url, opts });
    },
  };
}

test('a rejected command raises ApiError with the server code', async () => {
  const { fetch } = stubFetch(() => Promise.resolve(new Response(JSON.stringify({
    state: 'Conflict', data: null, meta: {},
    error: { code: 'VERSION_CONFLICT', message: '版本冲突', currentVersion: 7 },
  }), { status: 409 })));
  const client = createClient({ fetch });
  await assert.rejects(
    client.send('/api/v1/x', { method: 'PATCH', body: {} }),
    error => error instanceof ApiError && error.code === 'VERSION_CONFLICT' && error.currentVersion === 7,
  );
});

test('a network failure raises UnknownOutcomeError, never success', async () => {
  const { fetch } = stubFetch(() => Promise.reject(new TypeError('fetch failed')));
  const client = createClient({ fetch });
  await assert.rejects(client.send('/api/v1/x'), error => error instanceof UnknownOutcomeError);
});

test('an unparseable body raises UnknownOutcomeError', async () => {
  const { fetch } = stubFetch(() => Promise.resolve(new Response('<html>oops</html>', { status: 200, headers: { 'Content-Type': 'text/html' } })));
  const client = createClient({ fetch });
  await assert.rejects(client.send('/api/v1/x'), error => error instanceof UnknownOutcomeError);
});

test('every mutating command sends the Idempotency-Key header', async () => {
  const seen = [];
  const { fetch } = stubFetch(({ opts }) => {
    seen.push(opts.headers['Idempotency-Key']);
    return Promise.resolve(new Response(JSON.stringify({ state: 'Synced', data: { assignment }, error: null, meta: {} }), { status: 200 }));
  });
  const commands = createAssignmentCommands(createClient({ fetch }));
  await commands.review('a1', 1, 'Key_review_01');
  await commands.publish('a1', 2, 'Key_publish_01');
  await commands.retract('a1', 3, 'Key_retract_01');
  await commands.create('c1', { subject: 'a', title: 'b' }, 'Key_create_01');
  assert.deepEqual(seen, ['Key_review_01', 'Key_publish_01', 'Key_retract_01', 'Key_create_01']);
});

test('edit sends expectedVersion and never sends server-owned fields', async () => {
  let body;
  const { fetch } = stubFetch(({ opts }) => {
    body = JSON.parse(opts.body);
    return Promise.resolve(new Response(JSON.stringify({ state: 'Synced', data: { assignment }, error: null, meta: {} }), { status: 200 }));
  });
  const commands = createAssignmentCommands(createClient({ fetch }));
  await commands.edit('a1', { subject: 's', title: 't', details: '', due: null, duePrecision: 'none' }, 5, 'Key_edit_01');
  assert.equal(body.expectedVersion, 5);
  assert.equal(body.title, 't');
  assert.equal(body.status, undefined); // server owns status; we never send it
});

/* ── key registry ─────────────────────────────────────────────────── */

test('the registry returns the same key for a retried intent and a new key for a new intent', () => {
  let n = 0;
  const factory = () => `key_${++n}`;
  const keys = createKeyRegistry();
  assert.equal(keys.for('create:a', factory), 'key_1');
  assert.equal(keys.for('create:a', factory), 'key_1');   // retry reuses
  assert.equal(keys.for('create:b', factory), 'key_2');   // new intent, new key
  keys.release('create:a');
  assert.equal(keys.for('create:a', factory), 'key_3');   // released, fresh key
});

test('hydrate ignores keys the server would reject', () => {
  const keys = createKeyRegistry();
  keys.hydrate({ good: 'Valid_Key_123', bad: 'has space', short: 'abc' });
  assert.equal(keys.entries().good, 'Valid_Key_123');
  assert.equal(keys.entries().bad, undefined);
  assert.equal(keys.entries().short, undefined);
});
