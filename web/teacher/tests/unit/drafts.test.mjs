import test from 'node:test';
import assert from 'node:assert/strict';
import { createDraftStore, createKeyStore, DRAFT_STATE } from '../../js/drafts.js';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: k => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: k => data.delete(k),
    clear: () => data.clear(),
  };
}

function fakeNow(start = Date.parse('2026-10-27T08:00:00Z')) {
  let t = start;
  return () => new Date((t += 1000));
}

let counter = 0;
const idFactory = () => `id-${++counter}`;

test('creates a local draft that is not published', () => {
  const store = createDraftStore({ storage: memoryStorage(), now: fakeNow(), idFactory });
  const draft = store.create({ subject: '数学', title: '完成练习册' });
  assert.equal(draft.state, DRAFT_STATE.LOCAL);
  assert.equal(draft.publishedId, null);
  assert.equal(store.all().length, 1);
  assert.equal(store.localOnly().length, 1);
});

test('a local draft is never mistaken for published', () => {
  const store = createDraftStore({ storage: memoryStorage(), now: fakeNow(), idFactory });
  const draft = store.create({ subject: '数学', title: 'x' });
  assert.equal(store.localOnly().some(d => d.id === draft.id), true);
  assert.equal(draft.state === DRAFT_STATE.PUBLISHED, false);
});

test('only a server-confirmed assignment moves a draft to published', () => {
  const store = createDraftStore({ storage: memoryStorage(), now: fakeNow(), idFactory });
  const draft = store.create({ subject: '数学', title: 'x' });
  store.save({ ...draft, state: DRAFT_STATE.PUBLISHED, publishedId: 'srv-1', publishedVersion: 3 });
  assert.equal(store.localOnly().length, 0);
  assert.equal(store.get(draft.id).publishedId, 'srv-1');
});

test('mid-flight drafts reconcile to unknown, never to published', () => {
  const storage = memoryStorage();
  const store = createDraftStore({ storage, now: fakeNow(), idFactory });
  const draft = store.create({ subject: '数学', title: 'x' });
  store.save({ ...draft, state: DRAFT_STATE.SUBMITTING });
  const reloaded = createDraftStore({ storage, now: fakeNow(), idFactory });
  const reconciled = reloaded.reconcileOnLoad();
  assert.equal(reconciled.find(d => d.id === draft.id).state, DRAFT_STATE.UNKNOWN);
  assert.equal(reconciled.find(d => d.id === draft.id).state === DRAFT_STATE.PUBLISHED, false);
});

test('corrupt storage is reported without erasing original bytes', () => {
  const storage = memoryStorage({ 'haiz.teacher.v3.drafts/local': '{not json' });
  const store = createDraftStore({ storage });
  assert.throws(() => store.all(), /损坏/);
  assert.equal(storage.getItem('haiz.teacher.v3.drafts/local'), '{not json');
});

test('save replaces by id and stamps updatedAt immutably', () => {
  const store = createDraftStore({ storage: memoryStorage(), now: fakeNow(), idFactory });
  const draft = store.create({ subject: '数学', title: 'x' });
  const before = store.get(draft.id).updatedAt;
  store.save({ ...draft, title: 'y' });
  const after = store.get(draft.id);
  assert.equal(after.title, 'y');
  assert.notEqual(after.updatedAt, before);
  assert.equal(store.all().length, 1);
});

test('remove deletes only the named draft', () => {
  const store = createDraftStore({ storage: memoryStorage(), now: fakeNow(), idFactory });
  const a = store.create({ subject: '数学', title: 'a' });
  const b = store.create({ subject: '语文', title: 'b' });
  store.remove(a.id);
  assert.deepEqual(store.all().map(d => d.id), [b.id]);
});

test('draft storage isolates accounts and does not adopt old global drafts', () => {
  const disk = memoryStorage({ 'haiz.teacher.v2.drafts': JSON.stringify([{ id: 'old' }]) });
  const first = createDraftStore({ storage: disk, scope: 'instance/user1', idFactory });
  first.create({ title: 'private', subject: '数学' });
  assert.equal(createDraftStore({ storage: disk, scope: 'instance/user2' }).all().length, 0);
  assert.equal(createDraftStore({ storage: disk, scope: 'other/user1' }).all().length, 0);
});

test('explicit legacy import preserves source and is idempotent', () => {
  const legacy = JSON.stringify([{ subject: '数学', title: '旧练习', due: '2026-10-29' }]);
  const disk = memoryStorage({ 'haiz.teacher.v1.drafts': legacy });
  const store = createDraftStore({ storage: disk, scope: 'i/u', idFactory });
  assert.equal(store.hasLegacy(), true);
  assert.equal(store.all().length, 0);
  assert.equal(store.importLegacy(), 1);
  assert.equal(store.importLegacy(), 0);
  assert.equal(store.all()[0].state, DRAFT_STATE.LOCAL);
  assert.equal(disk.getItem('haiz.teacher.v1.drafts'), legacy);
});

test('quota errors are explicit and capacity never silently removes a draft', () => {
  const failed = createDraftStore({ storage: { getItem: () => null, setItem: () => { throw new Error('quota'); } }, idFactory });
  assert.throws(() => failed.create({ subject: 's', title: 't' }), /保存/);
  const store = createDraftStore({ storage: memoryStorage(), idFactory });
  for (let index = 0; index < 100; index++) store.create({ subject: 's', title: String(index) });
  assert.throws(() => store.create({ subject: 's', title: 'overflow' }), /100/);
  assert.equal(store.all().length, 100);
});

test('keystore survives reload within a session', () => {
  const session = memoryStorage();
  const ks = createKeyStore(session);
  ks.save({ 'create:x': 'AbCdEfGh_123' });
  const reloaded = createKeyStore(session).load();
  assert.equal(reloaded['create:x'], 'AbCdEfGh_123');
});
