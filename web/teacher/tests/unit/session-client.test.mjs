import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionClient } from '../../js/session-client.js';

const identity = { userId: 'teacher1', instanceId: 'school1', role: 'teacher', authorizedClassIds: ['class1'] };

test('identity changes block commands before sending and invalidate the workspace', async () => {
  for (const change of [{ userId: 'teacher2' }, { instanceId: 'school2' }, { role: 'student' }, { authorizedClassIds: [] }]) {
    let commands = 0; let invalidated = 0;
    const client = createSessionClient({ identity, onInvalid: () => invalidated++, client: { send: async path => {
      if (path.endsWith('/identity')) return { data: { ...identity, ...change } };
      commands++; return {};
    } } });
    await assert.rejects(client.send('/api/v1/classes/class1/assignments', { method: 'POST' }), /身份|权限/);
    assert.equal(commands, 0); assert.equal(invalidated, 1);
  }
});

test('a stale result after account change is never adopted', async () => {
  let current = identity; let invalidated = 0;
  const client = createSessionClient({ identity, onInvalid: () => invalidated++, client: { send: async path => {
    if (path.endsWith('/identity')) return { data: current };
    current = { ...identity, userId: 'teacher2' };
    return { data: { assignment: { id: 'a1' } } };
  } } });
  await assert.rejects(client.send('/api/v1/assignments/a1'), /身份|权限/);
  assert.equal(invalidated, 1);
});

test('revocation clears the official view and a suspended client stays suspended', async () => {
  let fail = false; let invalidated = 0;
  const client = createSessionClient({ identity, onInvalid: () => invalidated++, client: { send: async path => {
    if (path.endsWith('/identity')) return { data: identity };
    if (fail) throw Object.assign(new Error('revoked'), { status: 403 });
    return { data: 'ok' };
  } } });
  assert.equal((await client.send('/api/classes')).data, 'ok');
  fail = true;
  await assert.rejects(client.send('/api/classes'), /revoked/);
  fail = false;
  await assert.rejects(client.validate(), /身份|权限/);
  assert.equal(invalidated, 1);
});
