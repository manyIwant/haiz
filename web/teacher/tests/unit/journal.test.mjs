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

test('definite rejection is terminal but service failure remains pending', async () => {
  for (const status of [403, 409, 503]) {
    const journal = createJournal({ storage: storage(), scope: `i/${status}`, send: async () => { throw Object.assign(new Error('rejected'), { status }); } });
    await assert.rejects(journal.execute('operation', command));
    assert.equal(journal.pending().length, status === 503 ? 1 : 0);
  }
});
