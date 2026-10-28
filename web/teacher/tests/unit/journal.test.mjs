import test from 'node:test';
import assert from 'node:assert/strict';
import { createJournal } from '../../js/journal.js';

function storage() {
  let values = {};
  return { getItem: key => values[key] ?? null, setItem: (key, value) => { values = { ...values, [key]: value }; } };
}
const command = { path: '/api/v1/classes/c/assignments', method: 'POST', body: { title: '练习', subject: '数学' } };

test('lost response replays exact request after reload without creating twice', async () => {
  const disk = storage();
  let receipts = {};
  let count = 0;
  const seen = [];
  const send = async (path, options) => {
    seen.push({ path, ...options });
    let result = receipts[options.idempotencyKey];
    if (!result) result = { data: { assignment: { id: `a${++count}` } } };
    receipts = { ...receipts, [options.idempotencyKey]: result };
    if (seen.length === 1) throw new TypeError('response lost after commit');
    return result;
  };
  await assert.rejects(createJournal({ storage: disk, scope: 'i/u', send }).execute('create:d1', command));
  const reloaded = createJournal({ storage: disk, scope: 'i/u', send });
  assert.equal((await reloaded.replay('create:d1')).data.assignment.id, 'a1');
  assert.equal(count, 1);
  assert.deepEqual(seen[0], seen[1]);
  assert.equal(reloaded.pending().length, 0);
  await reloaded.execute('create:d1', command);
  assert.equal(seen.length, 2);
});

for (const operation of [
  { name: 'create', path: '/api/v1/classes/c/assignments', method: 'POST', body: { subject: '数学', title: '原始内容', details: '保留正文', due: null, duePrecision: 'none' }, version: 1 },
  { name: 'review', path: '/api/v1/assignments/a/review', method: 'POST', body: { expectedVersion: 1 }, version: 2 },
  { name: 'publish', path: '/api/v1/assignments/a/publish', method: 'POST', body: { expectedVersion: 2 }, version: 3 },
  { name: 'edit', path: '/api/v1/assignments/a', method: 'PATCH', body: { expectedVersion: 3, subject: '数学', title: '修订内容', details: '保留修订', due: '2026-11-03', duePrecision: 'date' }, version: 4 },
  { name: 'retract', path: '/api/v1/assignments/a/retract', method: 'POST', body: { expectedVersion: 4 }, version: 5 },
]) {
  test(`${operation.name} recovers a lost committed response after reload with one transition and exact original payload`, async () => {
    const disk = storage();
    const requests = [];
    let transitions = 0;
    let receipt;
    const send = async (path, options) => {
      requests.push({ path, ...options });
      if (!receipt) {
        transitions++;
        receipt = { data: { assignment: { id: 'original-assignment', version: operation.version } } };
      }
      if (requests.length === 1) throw new TypeError('connection reset after transaction commit');
      return receipt;
    };
    const { name, version, ...request } = operation;
    await assert.rejects(createJournal({ storage: disk, scope: 'school/teacher', send }).execute(name, request), /after transaction/);
    const reloaded = createJournal({ storage: disk, scope: 'school/teacher', send });
    assert.equal(reloaded.pending().length, 1);
    assert.deepEqual(reloaded.get(name).body, request.body);
    const result = await reloaded.replay(name);
    assert.equal(result.data.assignment.version, version);
    assert.equal(transitions, 1);
    assert.deepEqual(requests[1], requests[0]);
    assert.equal(reloaded.pending().length, 0);
    await reloaded.replay(name);
    assert.equal(requests.length, 2);
  });
}

test('changed content cannot reuse an unresolved intention', async () => {
  const journal = createJournal({ storage: storage(), scope: 'i/u', send: async () => { throw new Error('offline'); } });
  await assert.rejects(journal.execute('create:x', command));
  await assert.rejects(journal.execute('create:x', { ...command, body: { ...command.body, title: 'changed' } }), /原始请求/);
  assert.equal(journal.get('create:x').body.title, '练习');
});

test('journal isolates instance and account', async () => {
  const disk = storage();
  const options = { storage: disk, send: async () => { throw new Error('offline'); } };
  await assert.rejects(createJournal({ ...options, scope: 'i/user1' }).execute('create:x', command));
  assert.equal(createJournal({ ...options, scope: 'i/user2' }).pending().length, 0);
  assert.equal(createJournal({ ...options, scope: 'other/user1' }).pending().length, 0);
});

test('storage failure prevents mutation and corruption is explicit', async () => {
  let calls = 0;
  const journal = createJournal({ storage: { getItem: () => null, setItem: () => { throw new Error('quota'); } }, scope: 'i/u', send: async () => { calls++; } });
  await assert.rejects(journal.execute('create:x', command), /保存/);
  assert.equal(calls, 0);
  assert.throws(() => createJournal({ storage: { getItem: () => '{' }, scope: 'i/u', send: async () => {} }), /损坏/);
});

test('success then failed persistence retains original pending key on disk', async () => {
  const disk = storage();
  let writes = 0;
  const flaky = { getItem: disk.getItem, setItem: (key, value) => { if (++writes === 2) throw new Error('quota'); disk.setItem(key, value); } };
  const journal = createJournal({ storage: flaky, scope: 'i/u', send: async () => ({ data: { assignment: { id: 'a1' } } }) });
  await assert.rejects(journal.execute('create:x', command), /保存/);
  assert.equal(createJournal({ storage: disk, scope: 'i/u', send: async () => ({}) }).pending().length, 1);
});

test('expired authentication retains the original key until the original account returns', async () => {
  const disk = storage(); let calls = 0; const seen = [];
  const send = async (path, options) => {
    seen.push({ path, ...options }); calls++;
    if (calls === 1) throw new Error('lost committed response');
    if (calls === 2) throw Object.assign(new Error('expired'), { status: 401 });
    return { data: { assignment: { id: 'original' } } };
  };
  const journal = createJournal({ storage: disk, scope: 'i/u', send });
  await assert.rejects(journal.execute('create:original', command));
  await assert.rejects(journal.replay('create:original'));
  assert.equal(journal.pending().length, 1);
  assert.equal((await createJournal({ storage: disk, scope: 'i/u', send }).replay('create:original')).data.assignment.id, 'original');
  assert.deepEqual(seen[0], seen[2]);
});

test('definite rejection is terminal but service failure remains pending', async () => {
  for (const status of [401, 403, 409, 503]) {
    const journal = createJournal({ storage: storage(), scope: `i/${status}`, send: async () => { throw Object.assign(new Error('rejected'), { status }); } });
    await assert.rejects(journal.execute('operation', command));
    assert.equal(journal.pending().length, status === 409 ? 0 : 1);
  }
});
