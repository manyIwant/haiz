import test from 'node:test';
import assert from 'node:assert/strict';
import { loadClassroomFeed, consumeClassroomHandoff, ClassroomFeedError } from '../../js/classroom-feed.js';

const key = 'a'.repeat(96);
const assignment = (id = 'one', extra = {}) => ({
  id, version: 1, subject: '数学', title: '复习分数', details: '完成第 24 页练习。',
  due: '2026-10-28', duePrecision: 'date', status: 'published',
  updatedAt: '2026-10-27T08:00:00.000Z', ...extra,
});
const page = (assignments = [assignment()], nextAfter = null, extra = {}) => ({
  state: 'Synced', error: null,
  data: { classId: 'class-one', className: '七年级一班', assignments,
    readOnly: true, containsStudentIdentity: false, ...extra },
  meta: { nextAfter },
});
const clientFor = responses => () => ({ send: async () => responses.shift() });
const rejectsFeed = async (response, code = 'INVALID_FEED') => {
  await assert.rejects(loadClassroomFeed({ key, clientFactory: clientFor([response]) }),
    error => error instanceof ClassroomFeedError && error.code === code);
};

test('loads every page using a bearer header, with no credential in URLs', async () => {
  const responses = [page([assignment('one'), assignment('two', { status: 'revised' })], 2), page([assignment('three')])];
  const calls = [];
  let options;
  const result = await loadClassroomFeed({ key, pageSize: 2, clientFactory: config => {
    options = config;
    return { send: async (path, request) => { calls.push({ path, request }); return responses.shift(); } };
  } });
  assert.deepEqual(options, { origin: '', headers: { Authorization: `Bearer ${key}` } });
  assert.deepEqual(calls.map(call => call.path), ['/api/v1/classroom?limit=2&after=0', '/api/v1/classroom?limit=2&after=2']);
  assert.ok(calls.every(call => !call.path.includes(key)));
  assert.deepEqual(result.assignments.map(item => item.id), ['one', 'two', 'three']);
  assert.equal(result.className, '七年级一班');
  assert.equal(result.readOnly, true);
  assert.equal(result.containsStudentIdentity, false);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.assignments));
  assert.ok(Object.isFrozen(result.assignments[0]));
});

test('accepts a verified empty classroom', async () => {
  const result = await loadClassroomFeed({ key, clientFactory: clientFor([page([])]) });
  assert.deepEqual(result.assignments, []);
});

for (const extra of [
  { readOnly: false }, { readOnly: undefined }, { readOnly: 'true' },
  { containsStudentIdentity: true }, { containsStudentIdentity: undefined }, { containsStudentIdentity: 0 },
]) {
  test(`requires exact privacy flags ${JSON.stringify(extra)}`, () => rejectsFeed(page([], null, extra), 'PRIVACY_VIOLATION'));
}

for (const [location, response] of [
  ['data', page([], null, { students: [] })],
  ['assignment', page([assignment('one', { createdBy: 'private-teacher-id' })])],
  ['nested assignment', page([assignment('one', { source: { studentName: 'private' } })])],
  ['envelope', { ...page(), studentName: 'private' }],
  ['metadata', { ...page(), meta: { nextAfter: null, notes: 'private' } }],
]) {
  test(`rejects unexpected fields in ${location}`, () => rejectsFeed(response, 'PRIVACY_VIOLATION'));
}

for (const status of ['draft', 'review', 'retracted', 'Published', null]) {
  test(`rejects nonpublic assignment status ${status}`, () => rejectsFeed(page([assignment('one', { status })]), 'PRIVACY_VIOLATION'));
}

for (const [name, response] of [
  ['null', null], ['array', []], ['missing assignments', page(undefined, null, { assignments: undefined })],
  ['error envelope', { ...page(), error: { code: 'ERROR' } }],
  ['pending state', { ...page(), state: 'Pending' }],
  ['empty class name', page([], null, { className: '' })],
  ['missing class id', page([], null, { classId: undefined })],
  ['invalid version', page([assignment('one', { version: 0 })])],
  ['missing title', page([assignment('one', { title: undefined })])],
  ['oversized subject', page([assignment('one', { subject: 'a'.repeat(33) })])],
  ['invalid updatedAt', page([assignment('one', { updatedAt: 'yesterday' })])],
  ['impossible date', page([assignment('one', { due: '2026-02-30' })])],
  ['precision mismatch', page([assignment('one', { due: null, duePrecision: 'date' })])],
  ['invalid minute date', page([assignment('one', { due: '2026-02-30T10:00Z', duePrecision: 'minute' })])],
  ['minute without zone', page([assignment('one', { due: '2026-10-27T10:00', duePrecision: 'minute' })])],
]) {
  test(`rejects malformed public feed: ${name}`, () => rejectsFeed(response));
}

test('accepts none and minute precision values from the Academic model', async () => {
  const rows = [assignment('one', { due: null, duePrecision: 'none' }),
    assignment('two', { due: '2026-10-28T10:30:00+08:00', duePrecision: 'minute' })];
  const result = await loadClassroomFeed({ key, clientFactory: clientFor([page(rows)]) });
  assert.equal(result.assignments.length, 2);
});

for (const cursor of [undefined, -1, 0, '2', 1.5, Number.MAX_SAFE_INTEGER + 1, 'https://evil.test']) {
  test(`rejects unsafe or missing pagination cursor ${String(cursor)}`, () => rejectsFeed(
    { ...page(), meta: { nextAfter: cursor } }, 'PAGINATION_ERROR'));
}

test('rejects duplicate assignments across pages rather than showing a partial snapshot', async () => {
  await assert.rejects(loadClassroomFeed({ key, pageSize: 1,
    clientFactory: clientFor([page([assignment('one')], 1), page([assignment('one')])]) }),
  { code: 'PAGINATION_ERROR' });
});

test('rejects a class change while paging', async () => {
  await assert.rejects(loadClassroomFeed({ key, pageSize: 1,
    clientFactory: clientFor([page([assignment('one')], 1), page([], null, { classId: 'another' })]) }),
  { code: 'INVALID_FEED' });
});

test('rejects oversized pages, skipped offsets, and empty continuation pages', async () => {
  for (const response of [page([assignment('one'), assignment('two')]), page([assignment()], 3), page([], 1)]) {
    await assert.rejects(loadClassroomFeed({ key, pageSize: 1, clientFactory: clientFor([response]) }),
      { code: 'PAGINATION_ERROR' });
  }
});

test('bounds pagination and does not return a partial result at the limit', async () => {
  await assert.rejects(loadClassroomFeed({ key, pageSize: 1, maxPages: 1,
    clientFactory: clientFor([page([assignment()], 1)]) }), { code: 'PAGINATION_ERROR' });
});

test('propagates later authorization errors without returning previous pages', async () => {
  const revoked = Object.assign(new Error('revoked'), { status: 401, code: 'SCREEN_REVOKED' });
  let count = 0;
  await assert.rejects(loadClassroomFeed({ key, pageSize: 1, clientFactory: () => ({ send: async () => {
    if (count++ === 0) return page([assignment()], 1);
    throw revoked;
  } }) }), error => error === revoked);
});

test('passes cancellation to the client and checks already aborted signals', async () => {
  const controller = new AbortController();
  let seen;
  await loadClassroomFeed({ key, signal: controller.signal, clientFactory: () => ({
    send: async (_path, options) => { seen = options.signal; return page(); },
  }) });
  assert.equal(seen, controller.signal);
  controller.abort();
  await assert.rejects(loadClassroomFeed({ key, signal: controller.signal,
    clientFactory: () => { throw new Error('must not construct client'); } }), { name: 'AbortError' });
});

for (const badKey of ['', 'a'.repeat(95), 'A'.repeat(96), 'Bearer ' + key, null]) {
  test(`validates credentials before making requests (${String(badKey).length} chars)`, async () => {
    await assert.rejects(loadClassroomFeed({ key: badKey, clientFactory: () => {
      throw new Error('must not send');
    } }), { code: 'INVALID_KEY' });
  });
}

for (const config of [{ pageSize: 0 }, { pageSize: 201 }, { pageSize: 1.5 }, { maxPages: 0 }, { maxPages: Infinity }]) {
  test(`rejects invalid loader bounds ${JSON.stringify(config)}`, async () => {
    await assert.rejects(loadClassroomFeed({ key, ...config }), { code: 'PAGINATION_ERROR' });
  });
}

test('consumes and removes the handoff before using its raw credential', () => {
  const calls = [];
  const storage = { getItem: name => { calls.push(['get', name]); return key; },
    removeItem: name => calls.push(['remove', name]) };
  assert.equal(consumeClassroomHandoff(storage), key);
  assert.deepEqual(calls, [['get', 'haiz.classroom.handoff'], ['remove', 'haiz.classroom.handoff']]);
});

test('accepts a screenKey object handoff and removes malformed handoffs too', () => {
  for (const [value, expected] of [[JSON.stringify({ screenKey: key }), key], [null, '']]) {
    assert.equal(consumeClassroomHandoff({ getItem: () => value, removeItem() {} }), expected);
  }
  let removed = false;
  assert.throws(() => consumeClassroomHandoff({ getItem: () => '{bad', removeItem() { removed = true; } }),
    { code: 'INVALID_KEY' });
  assert.equal(removed, true);
  assert.throws(() => consumeClassroomHandoff({ getItem: () => JSON.stringify({ screenKey: key, private: true }), removeItem() {} }),
    { code: 'INVALID_KEY' });
});

test('reports inaccessible handoff storage without exposing the credential', () => {
  assert.throws(() => consumeClassroomHandoff({ getItem() { throw new Error('denied'); } }),
    { code: 'HANDOFF_UNAVAILABLE' });
  assert.throws(() => consumeClassroomHandoff({ getItem: () => key, removeItem() { throw new Error('denied'); } }),
    { code: 'HANDOFF_UNAVAILABLE' });
});

// Small DOM port for controller behaviors. Visual and browser checks belong to the main task.
class TestNode {
  constructor() { this.hidden = false; this.value = ''; this.textContent = ''; this.children = []; this.handlers = {}; this.attributes = {}; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, handler) { this.handlers[name] = handler; }
  focus() { this.focused = true; }
  emit(name) { return this.handlers[name]?.({ preventDefault() {} }); }
}
const settle = () => new Promise(resolve => setImmediate(resolve));
let controllerImport = 0;
async function controllerHarness(run, { handoff = null } = {}) {
  const previous = { document: globalThis.document, window: globalThis.window, fetch: globalThis.fetch };
  const nodes = new Map();
  const get = id => { if (!nodes.has(id)) nodes.set(id, new TestNode()); return nodes.get(id); };
  const storageCalls = [];
  const window = new TestNode();
  window.sessionStorage = {
    getItem: name => { storageCalls.push(['get', name]); return handoff; },
    removeItem: name => storageCalls.push(['remove', name]),
  };
  const document = new TestNode();
  document.getElementById = get;
  document.createElement = () => new TestNode();
  document.documentElement = new TestNode();
  const replies = [];
  const requests = [];
  globalThis.document = document;
  globalThis.window = window;
  globalThis.fetch = async (path, options) => {
    requests.push({ path, options });
    const reply = replies.shift();
    if (reply instanceof Error) throw reply;
    return { ok: reply?.ok ?? true, status: reply?.status ?? 200, json: async () => reply?.payload ?? page() };
  };
  try {
    await import(`../../js/classroom.js?controller-test=${++controllerImport}`);
    await settle();
    await run({ get, document, window, storageCalls, replies, requests });
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[name];
      else globalThis[name] = value;
    }
  }
}

test('manual entry authorizes the actual client, clears the input, and revocation removes old cards', async () => {
  await controllerHarness(async ({ get, replies, requests }) => {
    get('key-input').value = key;
    get('key-row').emit('submit');
    assert.equal(get('key-input').value, '');
    await settle();
    assert.equal(requests[0].options.headers.Authorization, `Bearer ${key}`);
    assert.equal(requests[0].path, '/api/v1/classroom?limit=100&after=0');
    assert.equal(get('items').children[0].className, 'card');
    assert.equal(get('connection').hidden, true);
    assert.match(get('stamp').textContent, /最近完整读取/);
    assert.match(get('stamp').textContent, /手动刷新/);
    replies.push({ ok: false, status: 401, payload: { state: 'Revoked', data: null,
      error: { code: 'SCREEN_REVOKED', message: 'private error must not render' }, meta: {} } });
    get('refresh').emit('click');
    assert.equal(get('items').children.some(node => node.className === 'card'), false);
    await settle();
    assert.equal(get('items').children.some(node => node.className === 'card'), false);
    assert.equal(get('connection').hidden, false);
    assert.equal(get('refresh').disabled, true);
    assert.match(get('error').textContent, /凭据无效或已被撤销/);
    assert.doesNotMatch(get('error').textContent, /private error/);
    assert.match(get('stamp').textContent, /无已验证数据/);
  });
});

test('privacy failure clears previous cards and forgets the credential', async () => {
  await controllerHarness(async ({ get, replies }) => {
    get('key-input').value = key;
    get('key-row').emit('submit');
    await settle();
    replies.push({ payload: page([assignment('one', { studentName: 'private' })]) });
    get('refresh').emit('click');
    await settle();
    assert.equal(get('items').children.some(node => node.className === 'card'), false);
    assert.equal(get('connection').hidden, false);
    assert.equal(get('refresh').disabled, true);
    assert.match(get('error').textContent, /公开数据校验/);
    assert.doesNotMatch(get('error').textContent, /private/);
  });
});

test('network failure clears cards but allows a memory-only retry', async () => {
  await controllerHarness(async ({ get, replies, requests }) => {
    get('key-input').value = key;
    get('key-row').emit('submit');
    await settle();
    replies.push(new Error('offline'));
    get('refresh').emit('click');
    await settle();
    assert.equal(get('items').children.some(node => node.className === 'card'), false);
    assert.equal(get('refresh').disabled, false);
    get('refresh').emit('click');
    await settle();
    assert.equal(get('items').children[0].className, 'card');
    assert.equal(requests[2].options.headers.Authorization, `Bearer ${key}`);
  });
});

test('teacher handoff is removed once and never copied into the input or persistent storage', async () => {
  await controllerHarness(async ({ get, storageCalls, requests, window }) => {
    assert.deepEqual(storageCalls, [['get', 'haiz.classroom.handoff'], ['remove', 'haiz.classroom.handoff']]);
    assert.equal(get('key-input').value, '');
    assert.equal(requests.length, 1);
    window.emit('pagehide');
    assert.equal(get('refresh').disabled, true);
    assert.equal(get('items').children.some(node => node.className === 'card'), false);
  }, { handoff: key });
});

test('changing credentials clears the previous class before loading another', async () => {
  await controllerHarness(async ({ get }) => {
    get('key-input').value = key;
    get('key-row').emit('submit');
    await settle();
    get('change-key').emit('click');
    assert.equal(get('refresh').disabled, true);
    assert.equal(get('key-input').value, '');
    assert.equal(get('key-input').focused, true);
    assert.equal(get('items').children.some(node => node.className === 'card'), false);
    assert.equal(get('classroom-name').textContent, '课堂作业');
  });
});

test('unsupported or rejected fullscreen is handled with inline feedback', async () => {
  await controllerHarness(async ({ get, document }) => {
    get('fullscreen').emit('click');
    await settle();
    assert.equal(get('display-status').hidden, false);
    assert.match(get('display-status').textContent, /未能切换全屏/);
    document.documentElement.requestFullscreen = async () => { throw new Error('denied'); };
    get('fullscreen').emit('click');
    await settle();
    assert.equal(get('display-status').hidden, false);
    document.documentElement.requestFullscreen = async () => { document.fullscreenElement = {}; };
    get('fullscreen').emit('click');
    await settle();
    assert.equal(get('fullscreen').textContent, '退出全屏');
    document.exitFullscreen = async () => { document.fullscreenElement = null; };
    get('fullscreen').emit('click');
    await settle();
    assert.equal(get('fullscreen').textContent, '进入全屏');
  });
});
