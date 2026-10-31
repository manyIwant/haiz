import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, expectOk, expectError, sync, PASSWORD } from './helpers.mjs';

const active = rows => rows.filter(row => ['published', 'revised'].includes(row.status));
const resourcePath = assignment => `/assignments/${assignment.id}`;

test('draft and review stay private; publication has one identity for two students and classroom', async t => {
  const f = await fixture(t);
  const draft = await f.create();
  assert.equal(draft.status, 'draft');
  const studentDraft = await f.b.call(`/api/v1/assignments/${draft.id}`);
  assert.ok([403, 404].includes(studentDraft.status));
  assert.deepEqual(expectOk(await sync(f.b)).assignments, []);
  const review = expectOk(await f.command(f.teacher, `${resourcePath(draft)}/review`, {
    expectedVersion: draft.version,
  })).assignment;
  assert.equal(review.status, 'review');
  assert.deepEqual(expectOk(await sync(f.b)).assignments, []);
  const published = expectOk(await f.command(f.teacher, `${resourcePath(review)}/publish`, {
    expectedVersion: review.version,
  })).assignment;
  assert.equal(published.status, 'published');
  for (const student of [f.b, f.c]) {
    const received = expectOk(await sync(student));
    assert.deepEqual(received.assignments.map(a => [a.id, a.version]), [[published.id, published.version]]);
  }
  const screen = expectOk(await f.anonymous.call('/api/v1/classroom', 'GET', undefined, {
    Authorization: `Bearer ${f.classroom.screenKey}`,
  }));
  assert.equal(screen.classId, f.classroom.id);
  assert.equal(screen.readOnly, true);
  assert.equal(screen.containsStudentIdentity, false);
  assert.deepEqual(screen.assignments.map(a => [a.id, a.version]), [[published.id, published.version]]);
  for (const field of ['createdBy', 'actorId', 'members', 'notes', 'source']) {
    assert.equal(Object.hasOwn(screen.assignments[0], field), false, `classroom leaks ${field}`);
  }
});

test('date revision reaches online and offline students with traceable old due', async t => {
  const f = await fixture(t);
  const published = await f.publish();
  const bCursor = expectOk(await sync(f.b)).cursor;
  const cCursor = expectOk(await sync(f.c)).cursor;
  const revised = expectOk(await f.command(f.teacher, resourcePath(published), {
    expectedVersion: published.version, due: '2026-10-30',
  }, 'PATCH')).assignment;
  assert.equal(revised.id, published.id);
  assert.equal(revised.version, published.version + 1);
  assert.equal(revised.status, 'revised');
  for (const [student, cursor] of [[f.b, bCursor], [f.c, cCursor]]) {
    const page = expectOk(await sync(student, cursor));
    assert.equal(page.events.length, 1);
    assert.equal(page.events[0].resourceId, published.id);
    assert.equal(page.events[0].version, revised.version);
    assert.equal(page.events[0].assignment.due, '2026-10-30');
  }
  const history = expectOk(await f.teacher.call(`/api/v1${resourcePath(published)}/history`));
  assert.ok(history.revisions.some(r => r.assignment.due === '2026-10-29'));
  assert.ok(history.revisions.some(r => r.version === revised.version && r.changedFields.includes('due')));
  assert.ok(history.revisions.every(r => typeof r.actorId === 'string'));
});

test('retraction reaches cached clients and keeps owner-private notes in client reconciliation', async t => {
  const f = await fixture(t);
  const published = await f.publish();
  const original = expectOk(await sync(f.b));
  const personal = Object.freeze({ assignmentId: published.id, notes: '仅在虚构学生 B 设备上的笔记', completed: true });
  const retracted = expectOk(await f.command(f.teacher, `${resourcePath(published)}/retract`, {
    expectedVersion: published.version,
  })).assignment;
  assert.equal(retracted.status, 'retracted');
  const delta = expectOk(await sync(f.b, original.cursor));
  assert.equal(delta.events[0].assignment.status, 'retracted');
  const reconciled = { ...personal, sourceVersion: delta.events[0].version, sourceStatus: 'retracted' };
  assert.equal(reconciled.notes, personal.notes);
  assert.equal(reconciled.completed, true);
  assert.equal(active(expectOk(await sync(f.c)).assignments).length, 0);
  const screen = expectOk(await f.anonymous.call('/api/v1/classroom', 'GET', undefined, {
    Authorization: `Bearer ${f.classroom.screenKey}`,
  }));
  assert.equal(screen.assignments.length, 0);
  assert.equal(JSON.stringify(delta).includes(personal.notes), false);
});

test('student cannot edit teacher assignments or read another class', async t => {
  const f = await fixture(t);
  const assignment = await f.publish();
  expectError(await f.command(f.b, resourcePath(assignment), {
    expectedVersion: assignment.version, title: '越权修改',
  }, 'PATCH'), 403, 'Revoked');
  expectError(await f.command(f.b, `/classes/${f.classroom.id}/assignments`, {
    subject: '数学', title: '越权发布',
  }), 403, 'Revoked');
  const foreign = await f.admin.call('/api/classes', 'POST', { title: '另一个虚构班级' });
  assert.equal(foreign.status, 201);
  expectError(await f.b.call(`/api/v1/classes/${foreign.body.id}/assignments`), 403, 'Revoked');
  expectError(await f.command(f.teacher, `/classes/${foreign.body.id}/assignments`, {
    subject: '数学', title: '非本班教师修改',
  }), 403, 'Revoked');
});

test('identity namespaces are distinct and student acknowledgement data never crosses accounts', async t => {
  const f = await fixture(t);
  const assignment = await f.publish();
  const bIdentity = expectOk(await f.b.call('/api/v1/identity'));
  const cIdentity = expectOk(await f.c.call('/api/v1/identity'));
  assert.equal(bIdentity.instanceId, cIdentity.instanceId);
  assert.notEqual(bIdentity.userId, cIdentity.userId);
  assert.deepEqual(bIdentity.authorizedClassIds, [f.classroom.id]);
  expectOk(await f.command(f.b, `${resourcePath(assignment)}/acknowledge`, { version: assignment.version }));
  const cSync = expectOk(await sync(f.c));
  const serialized = JSON.stringify(cSync);
  assert.equal(serialized.includes(f.b.id), false);
  assert.equal(serialized.includes('仅在虚构学生 B 设备上的笔记'), false);
  expectError(await f.c.call(`/api/v1${resourcePath(assignment)}/acknowledgements`), 403, 'Revoked');
});

test('same idempotency key and canonical payload create exactly one assignment', async t => {
  const f = await fixture(t);
  const path = `/classes/${f.classroom.id}/assignments`;
  const body = { subject: '数学', title: '唯一作业', details: '唯一内容' };
  const key = 'synthetic_duplicate_key';
  const first = expectOk(await f.command(f.teacher, path, body, 'POST', key), 201).assignment;
  const repeated = expectOk(await f.command(f.teacher, path, {
    details: body.details, title: body.title, subject: body.subject,
  }, 'POST', key), 201);
  assert.equal(repeated.assignment.id, first.id);
  assert.equal(repeated.assignment.version, first.version);
  assert.equal(repeated.replayed, true);
  const rows = expectOk(await f.teacher.call(`/api/v1${path}`)).assignments;
  assert.equal(rows.filter(a => a.id === first.id).length, 1);
  expectError(await f.command(f.teacher, path, { ...body, title: 'changed' }, 'POST', key), 409, 'Conflict');
  const history = expectOk(await f.teacher.call(`/api/v1${resourcePath(first)}/history`));
  assert.equal(history.revisions.length, 1);
});

test('two concurrent edits based on one version yield one winner and one explicit conflict', async t => {
  const f = await fixture(t);
  const assignment = await f.publish();
  const replies = await Promise.all(['页面甲', '页面乙'].map(title => f.command(f.teacher,
    resourcePath(assignment), { expectedVersion: assignment.version, title }, 'PATCH')));
  assert.deepEqual(replies.map(r => r.status).sort(), [200, 409]);
  const winner = expectOk(replies.find(r => r.status === 200)).assignment;
  const conflict = expectError(replies.find(r => r.status === 409), 409, 'Conflict');
  assert.equal(conflict.currentVersion, winner.version);
  const actual = expectOk(await f.teacher.call(`/api/v1${resourcePath(assignment)}`)).assignment;
  assert.equal(actual.title, winner.title);
  assert.equal(actual.version, assignment.version + 1);
});

test('database restart preserves class, assignment history, idempotency and sync cursor', async t => {
  const f = await fixture(t);
  const assignment = await f.publish();
  const baseline = expectOk(await sync(f.b));
  const body = { expectedVersion: assignment.version, due: '2026-10-30' };
  const key = 'synthetic_restart_key';
  const revised = expectOk(await f.command(f.teacher, resourcePath(assignment), body, 'PATCH', key)).assignment;
  const beforeIdentity = expectOk(await f.b.call('/api/v1/identity'));
  await f.restart();
  const afterIdentity = expectOk(await f.b.call('/api/v1/identity'));
  assert.equal(afterIdentity.instanceId, beforeIdentity.instanceId);
  const delta = expectOk(await sync(f.b, baseline.cursor));
  assert.equal(delta.events[0].resourceId, assignment.id);
  assert.equal(delta.events[0].version, revised.version);
  const replay = expectOk(await f.command(f.teacher, resourcePath(assignment), body, 'PATCH', key));
  assert.equal(replay.replayed, true);
  assert.equal(replay.assignment.version, revised.version);
  assert.equal(expectOk(await f.teacher.call(`/api/v1${resourcePath(assignment)}/history`)).revisions.length, revised.version);
});

test('revocation invalidates existing cursor, blocks fresh class reads and leaks no later event', async t => {
  const f = await fixture(t);
  const assignment = await f.publish();
  const baseline = expectOk(await sync(f.b));
  expectOk(await f.command(f.teacher, `/classes/${f.classroom.id}/members/${f.b.id}/revoke`, {}));
  expectOk(await f.command(f.teacher, resourcePath(assignment), {
    expectedVersion: assignment.version, title: '撤销权限后发布的新内容',
  }, 'PATCH'));
  const rejected = await sync(f.b, baseline.cursor);
  const error = expectError(rejected, 409, 'Revoked');
  assert.equal(error.resyncRequired, true);
  assert.equal(JSON.stringify(rejected.body).includes('撤销权限后发布的新内容'), false);
  expectError(await f.b.call(`/api/v1/classes/${f.classroom.id}/assignments`), 403, 'Revoked');
  assert.deepEqual(expectOk(await sync(f.b)).assignments, []);
});

test('revoke then restore cannot revive an old authorization cursor', async t => {
  const f = await fixture(t);
  await f.publish();
  const baseline = expectOk(await sync(f.b));
  expectOk(await f.command(f.teacher, `/classes/${f.classroom.id}/members/${f.b.id}/revoke`, {}));
  assert.equal((await f.b.call('/api/classes/join', 'POST', { joinCode: f.classroom.joinCode })).status, 200);
  assert.equal((await f.teacher.call(`/api/classes/${f.classroom.id}/members/${f.b.id}/approve`, 'POST', {})).status, 200);
  assert.equal(expectError(await sync(f.b, baseline.cursor), 409, 'Revoked').resyncRequired, true);
  assert.equal(expectOk(await sync(f.b)).assignments.length, 1);
});

test('a cursor belongs to its account even when class membership is identical', async t => {
  const f = await fixture(t);
  await f.publish();
  const baseline = expectOk(await sync(f.b));
  const response = await sync(f.c, baseline.cursor);
  assert.equal(expectError(response, 409, 'Revoked').resyncRequired, true);
  assert.equal(response.body.data, null);
  const cSnapshot = expectOk(await sync(f.c));
  assert.equal(cSnapshot.userId, f.c.id);
  assert.equal(cSnapshot.assignments.length, 1);
});

test('forged and malformed sync cursors fail explicitly', async t => {
  const f = await fixture(t);
  const baseline = expectOk(await sync(f.b));
  const cursor = baseline.cursor;
  const forged = cursor.slice(0, -2) + (cursor.endsWith('AA') ? 'BB' : 'AA');
  for (const invalid of ['not-a-cursor', forged, 'x'.repeat(10000)]) {
    expectError(await sync(f.b, invalid), 400, 'Failed');
  }
});

test('snapshot pagination stays at its high water and a later delta delivers intervening edits', async t => {
  const f = await fixture(t);
  const assignments = await Promise.all(['甲', '乙', '丙'].map(title => f.publish({ title })));
  let page = expectOk(await sync(f.b, undefined, 1));
  assert.equal(page.hasMore, true);
  const first = page.assignments[0];
  const changed = expectOk(await f.command(f.teacher, resourcePath(first), {
    expectedVersion: first.version, title: '分页期间修改',
  }, 'PATCH')).assignment;
  let snapshot = [...page.assignments];
  for (let count = 0; page.hasMore && count < 5; count++) {
    page = expectOk(await sync(f.b, page.cursor, 1));
    snapshot = [...snapshot, ...(page.assignments || [])];
  }
  assert.equal(page.hasMore, false);
  assert.equal(snapshot.length, 3);
  assert.equal(new Set(snapshot.map(a => a.id)).size, 3);
  assert.deepEqual([...snapshot.map(a => a.id)].sort(), assignments.map(a => a.id).sort());
  assert.equal(snapshot.find(a => a.id === first.id).version, first.version);
  const delta = expectOk(await sync(f.b, page.cursor));
  assert.ok(delta.events.some(event => event.resourceId === first.id && event.version === changed.version));
});

test('acknowledgement records the viewed public revision and never implies submission', async t => {
  const f = await fixture(t);
  const assignment = await f.publish();
  const revised = expectOk(await f.command(f.teacher, resourcePath(assignment), {
    expectedVersion: assignment.version, title: '新版',
  }, 'PATCH')).assignment;
  expectOk(await f.command(f.b, `${resourcePath(assignment)}/acknowledge`, { version: assignment.version }));
  const reports = expectOk(await f.teacher.call(`/api/v1${resourcePath(assignment)}/acknowledgements`));
  assert.ok(reports.acknowledgements.some(a => a.userId === f.b.id && a.version === assignment.version));
  assert.equal(reports.acknowledgements.some(a => a.version === revised.version), false);
  assert.equal(reports.acknowledgements.some(a => a.completed === true || a.verifiedSubmission === true), false);
  const impossible = await f.command(f.c, `${resourcePath(assignment)}/acknowledge`, { version: revised.version + 100 });
  assert.ok([400, 404, 409].includes(impossible.status));
  const draftVersion = await f.command(f.c, `${resourcePath(assignment)}/acknowledge`, { version: 1 });
  assert.ok([400, 403, 404, 409].includes(draftVersion.status));
});

test('strict input validation rejects read-only fields, invalid dates, missing keys and stale preconditions', async t => {
  const f = await fixture(t);
  const path = `/classes/${f.classroom.id}/assignments`;
  const base = { subject: '数学', title: '合成作业' };
  for (const extra of [{ status: 'published' }, { version: 999 }, { id: 'injected' },
    { classId: f.classroom.id }, { createdBy: f.b.id }, { unexpected: true },
    { due: '2026-02-30', duePrecision: 'date' },
    { due: '2026-10-29T18:30', duePrecision: 'minute' }]) {
    expectError(await f.command(f.teacher, path, { ...base, ...extra }), 400, 'Failed');
  }
  expectError(await f.teacher.call('/api/v1' + path, 'POST', base), 400, 'Failed');
  const assignment = await f.create();
  for (const expectedVersion of [undefined, '1', -1, 1.5]) {
    expectError(await f.command(f.teacher, resourcePath(assignment), { expectedVersion, title: 'bad' }, 'PATCH'), 400, 'Failed');
  }
});

test('minute deadline retains explicit precision and review edit requires a fresh review', async t => {
  const f = await fixture(t);
  const draft = await f.create({ due: '2026-10-30T18:30:00+08:00', duePrecision: 'minute' });
  assert.equal(draft.duePrecision, 'minute');
  assert.equal(Date.parse(draft.due), Date.parse('2026-10-30T18:30:00+08:00'));
  const review = expectOk(await f.command(f.teacher, `${resourcePath(draft)}/review`, { expectedVersion: draft.version })).assignment;
  const edited = expectOk(await f.command(f.teacher, resourcePath(review), {
    expectedVersion: review.version, details: '需要重新核对的内容',
  }, 'PATCH')).assignment;
  assert.equal(edited.status, 'draft');
  assert.equal(edited.version, review.version + 1);
  expectError(await f.command(f.teacher, `${resourcePath(edited)}/publish`, { expectedVersion: edited.version }), 409, 'Conflict');
});

test('retracted assignments cannot be edited or silently republished', async t => {
  const f = await fixture(t);
  const assignment = await f.publish();
  const retracted = expectOk(await f.command(f.teacher, `${resourcePath(assignment)}/retract`, {
    expectedVersion: assignment.version,
  })).assignment;
  expectError(await f.command(f.teacher, resourcePath(retracted), {
    expectedVersion: retracted.version, title: '恢复旧作业',
  }, 'PATCH'), 409, 'Conflict');
  expectError(await f.command(f.teacher, `${resourcePath(retracted)}/publish`, {
    expectedVersion: retracted.version,
  }), 409, 'Conflict');
});

test('logout and unapproved enrollment cannot access official content', async t => {
  const f = await fixture(t);
  await f.publish();
  const pending = await f.enroll('pending', false);
  expectError(await pending.call(`/api/v1/classes/${f.classroom.id}/assignments`), 403, 'Revoked');
  assert.deepEqual(expectOk(await sync(pending)).assignments, []);
  const baseline = expectOk(await sync(f.b));
  assert.equal((await f.b.call('/api/auth/logout', 'POST', {})).status, 200);
  expectError(await sync(f.b, baseline.cursor), 401, 'Revoked');
  expectError(await f.b.call('/api/v1/identity'), 401, 'Revoked');
  assert.equal((await f.b.call('/api/auth/login', 'POST', {
    login: 'synthetic_student_c', password: PASSWORD,
  })).status, 200);
  expectError(await sync(f.b, baseline.cursor), 409, 'Revoked');
});
