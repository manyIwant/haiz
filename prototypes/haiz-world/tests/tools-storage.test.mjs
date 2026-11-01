import test from 'node:test';
import assert from 'node:assert/strict';
import { KEYS, loadRecord, saveRecord } from '../src/tools/storage.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  let writes = 0;
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem(key, value) { writes++; values.set(key, String(value)); },
    get writes() { return writes; },
  };
}

const envelope = (revision, value) => JSON.stringify({ schema: 1, revision, value });
const namedError = name => Object.assign(new Error('browser error'), { name });

test('storage keys isolate student, teacher, publications and preferences', () => {
  assert.deepEqual(Object.keys(KEYS), ['student', 'teacher', 'publications', 'preferences']);
  assert.equal(new Set(Object.values(KEYS)).size, 4);
  assert.ok(Object.values(KEYS).every(key => /^haiz\.tools\.[a-z]+\.v1$/.test(key)));
  const storage = memoryStorage();
  for (const key of Object.values(KEYS)) assert.equal(saveRecord(key, { key }, 0, storage).error, null);
  for (const key of Object.values(KEYS)) assert.deepEqual(loadRecord(key, [], storage).value, { key });
});

test('a missing record returns the explicit fallback without silently writing a reset', () => {
  const storage = memoryStorage();
  const fallback = { tasks: [] };
  assert.deepEqual(loadRecord(KEYS.student, fallback, storage), { value: fallback, revision: 0, error: null });
  assert.equal(storage.writes, 0);
});

test('first write uses revision one and subsequent writes round-trip valid envelopes', () => {
  const storage = memoryStorage();
  const value = { tasks: [{ id: 'task-1', completed: false }], notes: '私密笔记' };
  assert.deepEqual(saveRecord(KEYS.student, value, 0, storage), { revision: 1, error: null });
  assert.deepEqual(JSON.parse(storage.getItem(KEYS.student)), { schema: 1, revision: 1, value });
  assert.deepEqual(loadRecord(KEYS.student, null, storage), { value, revision: 1, error: null });
  assert.deepEqual(saveRecord(KEYS.student, { tasks: [] }, 1, storage), { revision: 2, error: null });
  assert.equal(loadRecord(KEYS.student, null, storage).revision, 2);
  const separate = loadRecord(KEYS.student, null, storage).value;
  separate.tasks.push('仅修改内存');
  assert.deepEqual(loadRecord(KEYS.student, null, storage).value, { tasks: [] });
});

test('null, false, zero and empty string values are data, not missing records', () => {
  for (const value of [null, false, 0, '']) {
    const storage = memoryStorage({ [KEYS.preferences]: envelope(1, value) });
    assert.deepEqual(loadRecord(KEYS.preferences, 'fallback', storage), { value, revision: 1, error: null });
  }
});

test('optimistic conflicts never overwrite newer data or resurrect a deleted record', () => {
  const storage = memoryStorage();
  const firstReader = loadRecord(KEYS.student, [], storage);
  const secondReader = loadRecord(KEYS.student, [], storage);
  saveRecord(KEYS.student, ['第一标签页'], firstReader.revision, storage);
  const saved = storage.getItem(KEYS.student);
  const stale = saveRecord(KEYS.student, ['第二标签页'], secondReader.revision, storage);
  assert.equal(stale.revision, 1);
  assert.match(stale.error, /版本冲突/);
  assert.equal(storage.getItem(KEYS.student), saved);
  assert.equal(storage.writes, 1);
  const deleted = memoryStorage();
  assert.match(saveRecord(KEYS.student, ['旧内容'], 2, deleted).error, /冲突/);
  assert.equal(deleted.writes, 0);
});

test('invalid expected revisions are rejected without writing', () => {
  const storage = memoryStorage();
  for (const revision of [undefined, null, '0', -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.match(saveRecord(KEYS.student, [], revision, storage).error, /版本/);
  }
  assert.equal(storage.writes, 0);
  const maxed = memoryStorage({ [KEYS.student]: envelope(Number.MAX_SAFE_INTEGER, []) });
  assert.match(saveRecord(KEYS.student, [], Number.MAX_SAFE_INTEGER, maxed).error, /上限/);
  assert.equal(maxed.writes, 0);
});

test('malformed JSON and invalid envelope shapes remain untouched with visible Chinese errors', () => {
  for (const raw of [
    '{', 'null', '[]', '{}', JSON.stringify({ schema: 1, revision: 1 }),
    JSON.stringify({ schema: 1, revision: 0, value: [] }),
    JSON.stringify({ schema: 1, revision: '1', value: [] }),
    JSON.stringify({ schema: 1, revision: 1.5, value: [] }),
    JSON.stringify({ schema: 1, revision: Number.MAX_SAFE_INTEGER + 1, value: [] }),
  ]) {
    const storage = memoryStorage({ [KEYS.teacher]: raw });
    const fallback = { drafts: [] };
    const loaded = loadRecord(KEYS.teacher, fallback, storage);
    assert.equal(loaded.value, fallback);
    assert.equal(loaded.revision, 0);
    assert.match(loaded.error, /损坏/);
    assert.match(saveRecord(KEYS.teacher, { drafts: ['新内容'] }, 0, storage).error, /损坏/);
    assert.equal(storage.getItem(KEYS.teacher), raw);
    assert.equal(storage.writes, 0);
  }
});

test('unsupported schemas cannot be loaded as current data or overwritten', () => {
  for (const schema of [0, 2, '1', null]) {
    const raw = JSON.stringify({ schema, revision: 1, value: ['未来版本'] });
    const storage = memoryStorage({ [KEYS.teacher]: raw });
    assert.match(loadRecord(KEYS.teacher, [], storage).error, /不支持.*版本/);
    assert.match(saveRecord(KEYS.teacher, [], 0, storage).error, /不支持.*版本/);
    assert.equal(storage.getItem(KEYS.teacher), raw);
    assert.equal(storage.writes, 0);
  }
});

test('denied reads and writes return Chinese errors without throwing', () => {
  const denied = { getItem() { throw namedError('SecurityError'); }, setItem() { assert.fail('must not write'); } };
  const loaded = loadRecord(KEYS.student, [], denied);
  assert.deepEqual(loaded.value, []);
  assert.match(loaded.error, /权限/);
  assert.match(saveRecord(KEYS.student, [], 0, denied).error, /权限/);
  const writeDenied = { getItem: () => null, setItem() { throw namedError('SecurityError'); } };
  assert.deepEqual(saveRecord(KEYS.student, [], 0, writeDenied), {
    revision: 0, error: '无法保存本地数据，可能未获存储权限或浏览器已禁用存储；当前内容未保存。',
  });
  assert.match(loadRecord(KEYS.student, [], null).error, /无法读取/);
});

test('even a denied global localStorage getter is caught by the default storage path', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw namedError('SecurityError'); } });
  try {
    assert.match(loadRecord(KEYS.student, []).error, /权限/);
    assert.match(saveRecord(KEYS.student, [], 0).error, /权限/);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('quota failures retain the previously saved bytes and observed revision', () => {
  for (const name of ['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED']) {
    const raw = envelope(3, ['原内容']);
    const storage = { getItem: () => raw, setItem() { throw namedError(name); } };
    const saved = saveRecord(KEYS.teacher, ['新内容'], 3, storage);
    assert.equal(saved.revision, 3);
    assert.match(saved.error, /空间不足/);
    assert.equal(storage.getItem(KEYS.teacher), raw);
  }
  const firstWrite = { getItem: () => null, setItem() { throw namedError('QuotaExceededError'); } };
  assert.equal(saveRecord(KEYS.teacher, [], 0, firstWrite).revision, 0);
});

test('unserializable values surface format errors without corrupting existing storage', () => {
  const circular = {};
  circular.self = circular;
  const raw = envelope(1, ['原内容']);
  const storage = memoryStorage({ [KEYS.student]: raw });
  for (const value of [undefined, () => {}, Symbol('value'), 1n, circular]) {
    assert.match(saveRecord(KEYS.student, value, 1, storage).error, /JSON.*未保存/);
    assert.equal(storage.getItem(KEYS.student), raw);
  }
  assert.equal(storage.writes, 0);
});
