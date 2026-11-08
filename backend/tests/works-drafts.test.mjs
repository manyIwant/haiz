import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

// Chapter 03 (lanren/canopy): a student's private work drafts live in the owner-only
// `works` personal collection. This is the one real link of the work lifecycle in this
// round; submission, review and publication do not exist yet and nothing here makes a
// draft visible to anyone else.
function repository() {
  const native = new DatabaseSync(':memory:');
  const transaction = callback => {
    native.exec('BEGIN IMMEDIATE');
    try { const result = callback(); native.exec('COMMIT'); return result; }
    catch (error) { native.exec('ROLLBACK'); throw error; }
  };
  return import('../repository-core.mjs').then(({ createRepositoryCore }) => ({ native, repo: createRepositoryCore({ prepare: sql => native.prepare(sql), exec: sql => native.exec(sql) }, { transaction }) }));
}
const register = (repo, name) => repo.run('register', { name, passwordHash: name + '-hash', tokenHash: name + '-token', sessionMs: 3600000 });
const call = (repo, user, op, args) => repo.run(op, { who: user.identity, sessionId: user.sessionId, collection: 'works', ...args });

test('work drafts are private to their author, versioned and recoverable', async () => {
  const { native, repo } = await repository();
  try {
    const author = register(repo, 'draft-author'), classmate = register(repo, 'classmate');
    const draft = { title: '叶隙', kind: 'work', direction: 'words', body: '光不是从天上来的', state: 'draft' };
    const saved = call(repo, author, 'personal', { method: 'PUT', id: 'd-1', input: { expectedRevision: 0, data: draft } });
    assert.equal(saved.item.revision, 1);
    assert.equal(call(repo, author, 'personal', { method: 'GET', id: 'd-1' }).item.data.title, '叶隙');
    // another account cannot read, list, overwrite or delete it
    assert.throws(() => call(repo, classmate, 'personal', { method: 'GET', id: 'd-1' }), error => error.status === 404);
    assert.deepEqual(call(repo, classmate, 'personal', { method: 'GET' }).items, []);
    const own = call(repo, classmate, 'personal', { method: 'PUT', id: 'd-1', input: { expectedRevision: 0, data: { title: '同名' } } });
    assert.equal(own.item.revision, 1, 'the same id in another account is a different record');
    assert.equal(call(repo, author, 'personal', { method: 'GET', id: 'd-1' }).item.data.title, '叶隙');
    // edits are versioned; a stale device gets a conflict instead of overwriting
    call(repo, author, 'personal', { method: 'PUT', id: 'd-1', input: { expectedRevision: 1, data: { ...draft, body: '第二稿' } } });
    assert.throws(() => call(repo, author, 'personal', { method: 'PUT', id: 'd-1', input: { expectedRevision: 1, data: { ...draft, body: '旧设备' } } }), error => error.status === 409);
    assert.deepEqual(call(repo, author, 'personalHistory', { id: 'd-1' }).items.map(row => row.data.body), ['第二稿', '光不是从天上来的']);
    // deleting keeps a recoverable copy in the author's own trash
    call(repo, author, 'personal', { method: 'DELETE', id: 'd-1', input: { expectedRevision: 2 } });
    assert.equal(call(repo, author, 'personalTrash', {}).items[0].data.body, '第二稿');
    assert.deepEqual(call(repo, classmate, 'personalTrash', {}).items, []);
    // usage reports the new collection
    assert.ok('works' in repo.run('personalUsage', { who: author.identity, sessionId: author.sessionId }).collections);
  } finally { native.close(); }
});
