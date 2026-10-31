// Group 10 synthetic HTTP probes. Several deliberately repeat PR #21 scenarios
// as independent checks. These establish the assertions named in each test;
// they do not certify all routes, native-device isolation or private-note sync.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, client, expectOk, expectError, sync, PASSWORD } from './helpers.mjs';

const resourcePath = assignment => `/assignments/${assignment.id}`;

test('QA-ISO-01 unauthenticated selected routes reject access and classmates cannot list acknowledgements', async t => {
  const f = await fixture(t);
  const published = await f.publish();

  for (const path of ['/api/v1/identity', '/api/v1/sync', `/api/v1/assignments/${published.id}`,
    `/api/v1/classes/${f.classroom.id}/assignments`]) {
    const refused = await f.anonymous.call(path);
    expectError(refused, 401, 'Revoked');
    assert.equal(refused.body.data, null);
  }
  expectError(await f.anonymous.call('/api/v1/identity', 'GET', undefined, {
    Authorization: `Bearer ${f.classroom.screenKey}`,
  }), 401, 'Revoked');

  expectOk(await f.command(f.b, `${resourcePath(published)}/acknowledge`,
    { version: published.version }), 200);
  const bView = expectOk(await f.b.call(`/api/v1${resourcePath(published)}`)).assignment;
  assert.equal(Object.hasOwn(bView, 'acknowledgements'), false);
  assert.equal(Object.hasOwn(bView, 'viewedBy'), false);

  expectError(await f.c.call(`/api/v1${resourcePath(published)}/acknowledgements`), 403, 'Revoked');
  const reports = expectOk(await f.teacher.call(`/api/v1${resourcePath(published)}/acknowledgements`));
  assert.deepEqual(reports.acknowledgements.map(row => row.userId), [f.b.id]);
});

test('QA-ISO-02 a second class stays invisible to students of the first class', async t => {
  const f = await fixture(t);
  const shared = await f.publish();
  const other = await f.teacher.call('/api/classes', 'POST', { title: '虚构物理班' });
  assert.equal(other.status, 201);
  const otherClass = other.body;
  const foreign = expectOk(await f.command(f.teacher, `/classes/${otherClass.id}/assignments`, {
    subject: '物理', title: '只属于物理班的作业', details: '', due: null, duePrecision: 'none',
  }), 201).assignment;
  expectOk(await f.command(f.teacher, `/assignments/${foreign.id}/review`, {
    expectedVersion: foreign.version,
  }));
  expectOk(await f.command(f.teacher, `/assignments/${foreign.id}/publish`, {
    expectedVersion: foreign.version + 1,
  }));

  const snapshot = expectOk(await sync(f.b));
  assert.deepEqual(snapshot.assignments.map(a => a.id), [shared.id]);
  expectError(await f.b.call(`/api/v1${resourcePath(foreign)}`), 403, 'Revoked');
  expectError(await f.b.call(`/api/v1/classes/${otherClass.id}/assignments`), 403, 'Revoked');
  // Legacy join route answers with its own shape, not the v1 envelope.
  const join = await f.b.call('/api/classes/join', 'POST', { joinCode: otherClass.joinCode });
  assert.equal(join.status, 200);
  assert.equal(join.body.status, 'pending');
  expectError(await f.b.call(`/api/v1/classes/${otherClass.id}/assignments`), 403, 'Revoked');
});

test('QA-ISO-03 an expired session is refused on read, write and sync', async t => {
  const f = await fixture(t);
  const published = await f.publish();
  const cursor = expectOk(await sync(f.b)).cursor;
  // WAL lets QA open a second connection without stopping the service.
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(f.database);
  db.exec('UPDATE sessions SET expiry = 0');
  db.close();

  expectError(await f.b.call('/api/v1/identity'), 401, 'Revoked');
  expectError(await sync(f.b, cursor), 401, 'Revoked');
  expectError(await f.b.call(`/api/v1${resourcePath(published)}/acknowledge`, 'POST',
    { version: published.version }, { 'Idempotency-Key': 'qa_expired_key' }), 401, 'Revoked');
  expectError(await f.b.call(`/api/v1${resourcePath(published)}`), 401, 'Revoked');
});

test('QA-SYNC-01 a cursor is bound to one user even across identical memberships', async t => {
  const f = await fixture(t);
  const published = await f.publish();
  const bCursor = expectOk(await sync(f.b)).cursor;
  expectError(await sync(f.c, bCursor), 409, 'Revoked');
  expectError(await sync(f.teacher, bCursor), 409, 'Revoked');
  const [payload, signature] = bCursor.split('.');
  expectError(await sync(f.c, `${payload}.${signature}`), 409, 'Revoked');
  expectError(await sync(f.b, `${payload.slice(0, -3)}AAA.${signature}`), 400, 'Failed');
  expectOk(await f.b.call(`/api/v1${resourcePath(published)}`));
});

test('QA-SYNC-02 draft and review are absent from public sync and classroom projections', async t => {
  const f = await fixture(t);
  const draft = await f.create();
  assert.deepEqual(expectOk(await sync(f.b)).assignments, []);
  assert.deepEqual(expectOk(await sync(f.teacher)).assignments, []);
  assert.deepEqual(expectOk(await sync(f.admin)).assignments, []);
  const screen = expectOk(await f.anonymous.call('/api/v1/classroom', 'GET', undefined, {
    Authorization: `Bearer ${f.classroom.screenKey}`,
  }));
  assert.deepEqual(screen.assignments, []);
  const review = expectOk(await f.command(f.teacher, `${resourcePath(draft)}/review`, {
    expectedVersion: draft.version,
  })).assignment;
  assert.deepEqual(expectOk(await sync(f.b)).assignments, []);
  expectError(await f.b.call(`/api/v1${resourcePath(draft)}`), 404, 'Failed');
  assert.equal(review.status, 'review');
});

test('QA-SYNC-03 a retraction keeps identity, hides the task and preserves acknowledgement history', async t => {
  const f = await fixture(t);
  const published = await f.publish();
  expectOk(await f.command(f.b, `${resourcePath(published)}/acknowledge`,
    { version: published.version }));
  const cursor = expectOk(await sync(f.b)).cursor;
  const retracted = expectOk(await f.command(f.teacher, `${resourcePath(published)}/retract`, {
    expectedVersion: published.version,
  })).assignment;
  assert.equal(retracted.status, 'retracted');
  const delta = expectOk(await sync(f.b, cursor));
  assert.equal(delta.events.length, 1);
  assert.equal(delta.events[0].assignment.status, 'retracted');
  assert.equal(delta.events[0].assignment.id, published.id);
  const listed = expectOk(await f.b.call(`/api/v1/classes/${f.classroom.id}/assignments`));
  assert.equal(listed.assignments.some(row => row.id === published.id), true,
    'a retracted row stays addressable so the client can remove it');
  const my = await f.b.call('/api/my/assignments');
  assert.equal(my.body.assignments.some(row => row.id === published.id), false,
    'the legacy active list drops retracted work');
  const reports = expectOk(await f.teacher.call(`/api/v1${resourcePath(published)}/acknowledgements`));
  assert.equal(reports.acknowledgements.length, 1);
});

test('QA-SYNC-04 replaying one create idempotency key returns the same draft and changed payload conflicts', async t => {
  const f = await fixture(t);
  const body = { subject: '语文', title: '重复通知测试', details: '', due: null, duePrecision: 'none' };
  const first = expectOk(await f.command(f.teacher, `/classes/${f.classroom.id}/assignments`,
    body, 'POST', 'qa_fixed_key_1'), 201).assignment;
  const replay = expectOk(await f.command(f.teacher, `/classes/${f.classroom.id}/assignments`,
    body, 'POST', 'qa_fixed_key_1'), 201);
  assert.equal(replay.replayed, true);
  assert.equal(replay.assignment.id, first.id);
  expectError(await f.command(f.teacher, `/classes/${f.classroom.id}/assignments`,
    { ...body, title: '被改写的同键请求' }, 'POST', 'qa_fixed_key_1'), 409, 'Conflict');
  const list = expectOk(await f.teacher.call(`/api/v1/classes/${f.classroom.id}/assignments?limit=200`));
  assert.equal(list.assignments.filter(row => row.title === '重复通知测试').length, 1);
});

test('QA-SYNC-05 sequential writes from two teacher sessions reject the stale assignment version', async t => {
  const f = await fixture(t);
  const published = await f.publish();
  const teacher2 = client(f.service);
  assert.equal((await teacher2.call('/api/auth/login', 'POST', {
    login: 'synthetic_teacher', password: PASSWORD,
  })).status, 200);
  const winner = expectOk(await f.command(teacher2, resourcePath(published), {
    expectedVersion: published.version, title: '设备一改后的标题',
  }, 'PATCH')).assignment;
  const loss = expectError(await f.command(f.teacher, resourcePath(published), {
    expectedVersion: published.version, title: '设备二改后的标题',
  }, 'PATCH'), 409, 'Conflict');
  assert.equal(loss.currentVersion, winner.version);
  const current = expectOk(await f.teacher.call(`/api/v1${resourcePath(published)}`)).assignment;
  assert.equal(current.title, '设备一改后的标题');
});

test('QA-SYNC-06 revision keeps the pre-edit snapshot and student history contains only public states', async t => {
  const f = await fixture(t);
  const published = await f.publish({ title: '原始标题', due: '2026-10-29' });
  const revised = expectOk(await f.command(f.teacher, resourcePath(published), {
    expectedVersion: published.version, title: '教师改后的标题', due: '2026-11-02',
  }, 'PATCH')).assignment;
  const history = expectOk(await f.teacher.call(`/api/v1${resourcePath(published)}/history`));
  assert.ok(history.revisions.some(row => row.assignment.title === '原始标题'));
  assert.ok(history.revisions.some(row => row.assignment.title === '教师改后的标题'));
  const studentHistory = expectOk(await f.b.call(`/api/v1${resourcePath(published)}/history`));
  assert.ok(studentHistory.revisions.every(row =>
    ['published', 'revised', 'retracted'].includes(row.assignment.status)));
  assert.equal(revised.version, published.version + 1);
});

test('QA-ISO-04 revoking a member invalidates the cursor and hides later work even after restore', async t => {
  const f = await fixture(t);
  const before = await f.publish({ title: '撤销前可见' });
  const cursor = expectOk(await sync(f.b)).cursor;
  expectOk(await f.command(f.teacher, `/classes/${f.classroom.id}/members/${f.b.id}/revoke`, {}));
  expectError(await sync(f.b, cursor), 409, 'Revoked');
  // A fresh snapshot without a cursor is allowed: it returns an empty
  // authorizedClassIds list so the client can purge, never assignment content.
  const purged = expectOk(await sync(f.b));
  assert.deepEqual(purged.authorizedClassIds, []);
  assert.deepEqual(purged.assignments, []);
  expectError(await f.b.call(`/api/v1${resourcePath(before)}`), 403, 'Revoked');
  const after = expectOk(await f.command(f.teacher, `/classes/${f.classroom.id}/assignments`, {
    subject: '数学', title: '撤销后发布', details: '', due: null, duePrecision: 'none',
  }, 'POST', 'qa_after_revoke'), 201).assignment;
  expectOk(await f.command(f.teacher, `/assignments/${after.id}/review`, {
    expectedVersion: after.version,
  }));
  expectOk(await f.command(f.teacher, `/assignments/${after.id}/publish`, {
    expectedVersion: after.version + 1,
  }));
  assert.deepEqual(expectOk(await sync(f.b)).assignments, []);
  const reapprove = await f.teacher.call(
    `/api/classes/${f.classroom.id}/members/${f.b.id}/approve`, 'POST', {});
  assert.equal(reapprove.status, 404, 'a revoked member cannot be silently re-approved');
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(f.database);
  db.prepare("UPDATE memberships SET status='active' WHERE user_id=? AND class_id=?")
    .run(f.b.id, f.classroom.id);
  db.close();
  // Same live session, restored membership: the old cursor must still be dead.
  expectError(await sync(f.b, cursor), 409, 'Revoked');
  const restored = expectOk(await sync(f.b));
  assert.ok(restored.assignments.length >= 2);
});

test('QA-ISO-05 identical student logins on independent servers have distinct identities and reject real foreign sessions', async t => {
  const first = await fixture(t);
  const second = await fixture(t);
  const identityA = expectOk(await first.b.call('/api/v1/identity'));
  const identityB = expectOk(await second.b.call('/api/v1/identity'));
  assert.notEqual(identityA.instanceId, identityB.instanceId);
  assert.notEqual(identityA.userId, identityB.userId);
  assert.notEqual(identityA.cacheScope, identityB.cacheScope);

  // Both fixtures create synthetic_student_b with the same synthetic password.
  // Get a genuine session from each; never print either cookie in test output.
  const firstLogin = await first.b.call('/api/auth/login', 'POST', {
    login: 'synthetic_student_b', password: PASSWORD,
  });
  const secondLogin = await second.b.call('/api/auth/login', 'POST', {
    login: 'synthetic_student_b', password: PASSWORD,
  });
  assert.equal(firstLogin.status, 200);
  assert.equal(secondLogin.status, 200);
  const firstCookie = firstLogin.headers.get('set-cookie')?.split(';')[0];
  const secondCookie = secondLogin.headers.get('set-cookie')?.split(';')[0];
  assert.ok(firstCookie && secondCookie, 'both fixture logins issue a session');
  for (const [service, cookie] of [[second.service, firstCookie], [first.service, secondCookie]]) {
    const response = await fetch(service.root + '/api/v1/identity', {
      headers: { Cookie: cookie },
    });
    expectError({ status: response.status, body: await response.json() }, 401, 'Revoked');
  }

  const foreignCursor = expectOk(await sync(first.b)).cursor;
  // second.b still authenticates with its own valid session, so this verifies
  // cursor signing differs between instances, rather than just a missing login.
  expectError(await sync(second.b, foreignCursor), 400, 'Failed');
  assert.equal(expectOk(await second.b.call('/api/v1/identity')).instanceId, identityB.instanceId);
});

test('QA-ISO-06 identity fields are stable across restarts and never echo the login', async t => {
  const f = await fixture(t);
  const before = expectOk(await f.b.call('/api/v1/identity'));
  await f.restart();
  const after = expectOk(await f.b.call('/api/v1/identity'));
  assert.equal(after.instanceId, before.instanceId, 'instance survives restart');
  assert.equal(after.cacheScope, `haiz/v1/${before.instanceId}/${before.userId}`);
  assert.equal(Object.hasOwn(after, 'login'), false, 'identity never echoes the login name');
  assert.equal(Object.hasOwn(after, 'label'), false, 'identity never echoes the display name');
  assert.deepEqual(after.authorizedClassIds, before.authorizedClassIds);
});
