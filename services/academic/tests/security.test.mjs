import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { request } from 'node:http';
import { fixture, expectOk, expectError, PASSWORD } from './helpers.mjs';

function database(f, operation) {
  const db = new DatabaseSync(f.database);
  try { return operation(db); }
  finally { db.close(); }
}

const assignmentPath = assignment => `/assignments/${assignment.id}`;

function streamedPost(url, cookie, body, firstChunkLength) {
  let resolveResponse, rejectResponse;
  const response = new Promise((resolve, reject) => { resolveResponse = resolve; rejectResponse = reject; });
  const outgoing = request(url, { method: 'POST', headers: {
    Cookie: cookie, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body),
    'Idempotency-Key': 'synthetic_paused_body',
  } }, incoming => {
    const chunks = [];
    incoming.on('data', chunk => chunks.push(chunk));
    incoming.once('end', () => {
      try { resolveResponse({ status: incoming.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }); }
      catch (error) { rejectResponse(error); }
    });
  });
  outgoing.once('error', rejectResponse);
  const started = new Promise((resolve, reject) => outgoing.write(body.slice(0, firstChunkLength), error => {
    if (error) reject(error); else resolve();
  }));
  return { outgoing, response, started, finish: () => outgoing.end(body.slice(firstChunkLength)) };
}

async function teacherCookie(f) {
  const response = await fetch(f.service.root + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'synthetic_teacher', password: PASSWORD }),
  });
  assert.equal(response.status, 200);
  await response.json();
  return response.headers.get('set-cookie').split(';')[0];
}

test('logout while a mutation body is incomplete prevents the delayed request from committing', async t => {
  const f = await fixture(t);
  const cookie = await teacherCookie(f);
  const body = JSON.stringify({ subject: '数学', title: '注销后不得发布的延迟草稿' });
  const paused = streamedPost(f.service.root + `/api/v1/classes/${f.classroom.id}/assignments`, cookie, body, 1);
  t.after(() => paused.outgoing.destroy());
  await paused.started;
  const logout = await fetch(f.service.root + '/api/auth/logout', {
    method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal(logout.status, 200);
  await logout.json();
  paused.finish();
  expectError(await paused.response, 401, 'Revoked');
  assert.equal(database(f, db => db.prepare('SELECT COUNT(*) AS count FROM assignments').get().count), 0);
  assert.equal(database(f, db => db.prepare('SELECT COUNT(*) AS count FROM command_receipts').get().count), 0);
});

test('non-ASCII cursor signatures fail as validation errors rather than internal errors', async t => {
  const f = await fixture(t);
  const baseline = expectOk(await f.b.call('/api/v1/sync'));
  const payload = baseline.cursor.split('.')[0];
  const response = await f.b.call('/api/v1/sync?cursor=' + encodeURIComponent(payload + '.' + '字'.repeat(43)));
  expectError(response, 400, 'Failed');
});

test('successful logins do not consume the failed-login throttle budget', async t => {
  const f = await fixture(t);
  for (let index = 0; index < 12; index++) {
    const response = await f.anonymous.call('/api/auth/login', 'POST', {
      login: 'synthetic_teacher', password: PASSWORD,
    });
    assert.equal(response.status, 200, `successful login ${index + 1} was throttled`);
  }
});

test('expired session cannot read or mutate assignments while another account remains authorized', async t => {
  const f = await fixture(t);
  const assignment = await f.publish();
  database(f, db => db.prepare('UPDATE sessions SET expiry=0 WHERE user_id=?').run(f.b.id));
  expectError(await f.b.call('/api/v1/identity'), 401, 'Revoked');
  expectError(await f.command(f.b, `${assignmentPath(assignment)}/acknowledge`, {
    version: assignment.version,
  }), 401, 'Revoked');
  assert.equal(expectOk(await f.c.call(`/api/v1${assignmentPath(assignment)}`)).assignment.id, assignment.id);
  assert.equal(database(f, db => db.prepare('SELECT COUNT(*) AS count FROM version_acknowledgements').get().count), 0);
});

test('cross-site mutation is denied before a draft or command receipt is created', async t => {
  const f = await fixture(t);
  const response = await f.teacher.call(`/api/v1/classes/${f.classroom.id}/assignments`, 'POST', {
    subject: '数学', title: '跨站伪造草稿',
  }, { Origin: 'https://synthetic-attacker.invalid', 'Idempotency-Key': 'synthetic_csrf_key' });
  expectError(response, 403, 'Revoked');
  assert.equal(database(f, db => db.prepare('SELECT COUNT(*) AS count FROM assignments').get().count), 0);
  assert.equal(database(f, db => db.prepare('SELECT COUNT(*) AS count FROM command_receipts').get().count), 0);
});

test('invalid JSON, non-object and oversized bodies fail without persisting assignments', async t => {
  const f = await fixture(t);
  const cookie = await teacherCookie(f);
  const bodies = [
    ['{"subject":', 400], ['[]', 400], ['null', 400],
    [JSON.stringify({ subject: '数学', title: '超大请求', details: 'x'.repeat(81000) }), 413],
  ];
  for (const [body, status] of bodies) {
    const response = await fetch(f.service.root + `/api/v1/classes/${f.classroom.id}/assignments`, {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json',
        'Idempotency-Key': 'synthetic_invalid_body' }, body,
    });
    expectError({ status: response.status, body: await response.json() }, status, 'Failed');
  }
  assert.equal(database(f, db => db.prepare('SELECT COUNT(*) AS count FROM assignments').get().count), 0);
});

test('repeated invalid invitations are throttled without creating users or memberships', async t => {
  const f = await fixture(t);
  const before = database(f, db => ({
    users: db.prepare('SELECT COUNT(*) AS count FROM users').get().count,
    members: db.prepare('SELECT COUNT(*) AS count FROM memberships').get().count,
  }));
  let limited = false;
  for (let index = 0; index < 31; index++) {
    const response = await f.b.call('/api/classes/join', 'POST', { joinCode: 'invalid_synthetic_code' });
    assert.ok([400, 429].includes(response.status));
    if (response.status === 429) { limited = true; break; }
  }
  assert.equal(limited, true);
  assert.equal((await f.b.call('/api/classes/join', 'POST', { joinCode: f.classroom.joinCode })).status, 429);
  const after = database(f, db => ({
    users: db.prepare('SELECT COUNT(*) AS count FROM users').get().count,
    members: db.prepare('SELECT COUNT(*) AS count FROM memberships').get().count,
  }));
  assert.deepEqual(after, before);
});

test('classroom bearer is read-only and cannot substitute for a user session cookie', async t => {
  const f = await fixture(t);
  const bearer = { Authorization: `Bearer ${f.classroom.screenKey}` };
  expectOk(await f.anonymous.call('/api/v1/classroom', 'GET', undefined, bearer));
  expectError(await f.anonymous.call('/api/v1/identity', 'GET', undefined, bearer), 401, 'Revoked');
  expectError(await f.anonymous.call(`/api/v1/classes/${f.classroom.id}/assignments`, 'POST', {
    subject: '数学', title: '只读密钥不能发布',
  }, { ...bearer, 'Idempotency-Key': 'synthetic_screen_write' }), 401, 'Revoked');
  expectError(await f.anonymous.call('/api/v1/identity', 'GET', undefined, {
    Cookie: `hsid=${f.classroom.screenKey}`,
  }), 401, 'Revoked');
  assert.equal(database(f, db => db.prepare('SELECT COUNT(*) AS count FROM assignments').get().count), 0);
});

test('screen key rotation revokes the old bearer and preserves public identity for the new bearer', async t => {
  const f = await fixture(t);
  const assignment = await f.publish();
  const rotation = await f.teacher.call(`/api/classes/${f.classroom.id}/screens/rotate`, 'POST', {});
  assert.equal(rotation.status, 200);
  assert.notEqual(rotation.body.screenKey, f.classroom.screenKey);
  expectError(await f.anonymous.call('/api/v1/classroom', 'GET', undefined, {
    Authorization: `Bearer ${f.classroom.screenKey}`,
  }), 401, 'Revoked');
  const screen = expectOk(await f.anonymous.call('/api/v1/classroom', 'GET', undefined, {
    Authorization: `Bearer ${rotation.body.screenKey}`,
  }));
  assert.deepEqual(screen.assignments.map(row => [row.id, row.version]), [[assignment.id, assignment.version]]);
  assert.equal((await f.anonymous.call(`/api/screens/${f.classroom.screenKey}`)).status, 404);
});

test('idempotent teacher replay rechecks current ownership before returning an earlier result', async t => {
  const f = await fixture(t);
  const path = `/classes/${f.classroom.id}/assignments`;
  const body = { subject: '数学', title: '仅原教师曾有权的草稿' };
  const key = 'synthetic_ownership_replay';
  const draft = expectOk(await f.command(f.teacher, path, body, 'POST', key), 201).assignment;
  const admin = (await f.admin.call('/api/me')).body.user;
  database(f, db => db.prepare('UPDATE classes SET teacher_id=? WHERE id=?').run(admin.id, f.classroom.id));
  const denied = await f.command(f.teacher, path, body, 'POST', key);
  expectError(denied, 403, 'Revoked');
  assert.equal(JSON.stringify(denied.body).includes(draft.title), false);
  assert.equal(expectOk(await f.admin.call(`/api/v1${assignmentPath(draft)}`)).assignment.version, draft.version);
  assert.equal(database(f, db => db.prepare('SELECT COUNT(*) AS count FROM assignments').get().count), 1);
});

test('acknowledgement replay rechecks membership after revocation', async t => {
  const f = await fixture(t);
  const assignment = await f.publish();
  const path = `${assignmentPath(assignment)}/acknowledge`;
  const body = { version: assignment.version }, key = 'synthetic_ack_replay';
  expectOk(await f.command(f.b, path, body, 'POST', key));
  expectOk(await f.command(f.teacher, `/classes/${f.classroom.id}/members/${f.b.id}/revoke`, {}));
  expectError(await f.command(f.b, path, body, 'POST', key), 403, 'Revoked');
  assert.equal(database(f, db => db.prepare('SELECT COUNT(*) AS count FROM version_acknowledgements WHERE user_id=?').get(f.b.id).count), 1);
});

test('confirmed QQ intake cannot produce duplicate assignments under different request keys', async t => {
  const f = await fixture(t);
  const intakeId = randomUUID();
  database(f, db => db.prepare('INSERT INTO intake VALUES (?,?,?,?,?,?)').run(
    intakeId, f.classroom.id, 'synthetic_qq_source', '虚构群消息，经教师人工确认', 'pending', new Date().toISOString(),
  ));
  const path = `/api/classes/${f.classroom.id}/inbox/${intakeId}/publish`;
  const body = { subject: '数学', title: '同一来源只能正式发布一次', due: '2026-10-30' };
  const first = await f.teacher.call(path, 'POST', body, { 'Idempotency-Key': 'synthetic_qq_publish_one' });
  const replay = await f.teacher.call(path, 'POST', body, { 'Idempotency-Key': 'synthetic_qq_publish_two' });
  assert.equal(first.status, 201);
  assert.equal(replay.status, 201);
  assert.equal(replay.body.assignment.id, first.body.assignment.id);
  assert.equal(replay.body.assignment.version, first.body.assignment.version);
  database(f, db => {
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM assignments WHERE source_id=?').get(intakeId).count, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sync_events WHERE resource_id=?').get(first.body.assignment.id).count, 1);
    assert.equal(db.prepare('SELECT status FROM intake WHERE id=?').get(intakeId).status, 'published');
  });
});

test('legacy viewed status applies to one public version and resets after a revision', async t => {
  const f = await fixture(t);
  const assignment = await f.publish();
  assert.equal((await f.b.call(`/api/assignments/${assignment.id}/acknowledge`, 'POST', {})).status, 200);
  const viewed = (await f.b.call('/api/my/assignments')).body.assignments.find(row => row.id === assignment.id);
  assert.equal(viewed.viewed, true);
  const revised = expectOk(await f.command(f.teacher, assignmentPath(assignment), {
    expectedVersion: assignment.version, title: '已查看后修订的作业',
  }, 'PATCH')).assignment;
  const fresh = (await f.b.call('/api/my/assignments')).body.assignments.find(row => row.id === assignment.id);
  assert.equal(fresh.viewed, false);
  assert.equal(fresh.version, revised.version);
});

test('legacy class, student and screen lists exclude drafts, review and retracted work', async t => {
  const f = await fixture(t);
  await f.create({ title: '私有草稿' });
  const review = await f.create({ title: '私有待审' });
  expectOk(await f.command(f.teacher, `${assignmentPath(review)}/review`, { expectedVersion: review.version }));
  const published = await f.publish({ title: '随后撤回' });
  expectOk(await f.command(f.teacher, `${assignmentPath(published)}/retract`, { expectedVersion: published.version }));
  for (const [actor, path] of [
    [f.teacher, `/api/classes/${f.classroom.id}/assignments`],
    [f.b, '/api/my/assignments'],
    [f.anonymous, `/api/screens/${f.classroom.screenKey}`],
  ]) {
    const response = await actor.call(path);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.assignments, []);
  }
});

test('empty edits, private-data injection and invalid pagination cannot change an assignment', async t => {
  const f = await fixture(t);
  const assignment = await f.publish();
  const path = assignmentPath(assignment);
  const empty = expectError(await f.command(f.teacher, path, { expectedVersion: assignment.version }, 'PATCH'), 400, 'Failed');
  assert.equal(empty.code, 'EMPTY_EDIT');
  for (const injected of [{ notes: 'private' }, { completed: true }, { source: { kind: 'qq' } }, { userId: f.b.id }]) {
    expectError(await f.command(f.teacher, path, { expectedVersion: assignment.version, ...injected }, 'PATCH'), 400, 'Failed');
  }
  for (const query of ['limit=0', 'limit=201', 'limit=1.5', 'after=-1', 'after=NaN']) {
    expectError(await f.teacher.call(`/api/v1/classes/${f.classroom.id}/assignments?${query}`), 400, 'Failed');
  }
  assert.equal(expectOk(await f.teacher.call(`/api/v1${path}`)).assignment.version, assignment.version);
});
