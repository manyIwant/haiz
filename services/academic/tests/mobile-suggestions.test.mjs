import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.mjs';

test('mobile proposals require active membership, redact chats, and publish only after teacher approval', async t => {
  const { classroom, teacher, b, c, enroll, anonymous } = await fixture(t);
  const path = '/api/classes/' + classroom.id + '/mobile-suggestions';
  const task = {
    clientKey: 'mobile_test_first_0001',
    subject: '物理', title: '完成实验报告', due: '2026-11-01',
  };
  const newcomer = await enroll('pending_mobile', false);
  assert.equal((await newcomer.call(path, 'POST', task)).status, 403);
  assert.equal((await anonymous.call(path, 'POST', task)).status, 401);
  assert.equal((await b.call(path, 'POST', { ...task, originalNotice: 'private conversation text' })).status, 400);
  assert.equal((await b.call(path, 'POST', { ...task, conversation: 'Private class chat' })).status, 400);
  assert.equal((await b.call(path, 'POST', { ...task, due: '2026-02-30' })).status, 400);
  assert.equal((await b.call(path, 'POST', { ...task, title: ' '.repeat(20) })).status, 400);
  assert.equal((await b.call(path, 'POST', { ...task, clientKey: 'weak' })).status, 400);

  const submitted = await b.call(path, 'POST', task);
  assert.equal(submitted.status, 202);
  assert.equal(submitted.body.reviewRequired, true);
  const id = submitted.body.id;
  assert.match(id, /^[0-9a-f-]{36}$/);
  const duplicate = await b.call(path, 'POST', task);
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.duplicate, true);
  assert.equal(duplicate.body.id, id);
  assert.equal((await b.call(path, 'POST', { ...task, title: 'Changed title' })).status, 409);
  assert.equal((await b.call(path)).status, 403);
  const waiting = await teacher.call(path);
  assert.equal(waiting.status, 200);
  assert.equal(waiting.body.suggestions.length, 1);
  assert.deepEqual(Object.keys(waiting.body.suggestions[0]).sort(), ['createdAt', 'due', 'id', 'subject', 'title']);
  assert.equal(JSON.stringify(waiting.body).includes('originalNotice'), false);
  assert.equal((await c.call('/api/my/assignments')).body.assignments.length, 0);

  assert.equal((await b.call(path + '/' + id + '/publish', 'POST', task)).status, 403);
  assert.equal((await teacher.call(path + '/' + id + '/publish', 'POST',
    { ...task, sender: 'do not share' })).status, 400);
  const published = await teacher.call(path + '/' + id + '/publish', 'POST', {
    subject: task.subject, title: '完成实验报告（经老师核对）', due: task.due,
  });
  assert.equal(published.status, 201, JSON.stringify(published.body));
  assert.equal(published.body.manuallyReviewed, true);
  assert.equal(published.body.assignment.title, '完成实验报告（经老师核对）');
  const studentAssignments = await c.call('/api/my/assignments');
  assert.equal(studentAssignments.status, 200);
  assert.equal(studentAssignments.body.assignments.length, 1);
  assert.equal(studentAssignments.body.assignments[0].title, '完成实验报告（经老师核对）');
  assert.equal((await teacher.call(path)).body.suggestions.length, 0);
  assert.equal((await teacher.call(path + '/' + id + '/publish', 'POST', {})).status, 409);
  const other = await b.call(path, 'POST', { ...task, clientKey: 'mobile_test_second_0002' });
  assert.equal(other.status, 202);
  assert.equal((await teacher.call(path + '/' + other.body.id + '/dismiss', 'POST', {})).status, 200);
  assert.equal((await teacher.call(path + '/' + other.body.id + '/publish', 'POST', {})).status, 409);
});

test('mobile proposals survive a backend restart without leaking raw chat information', async t => {
  const { classroom, teacher, b, restart } = await fixture(t);
  const path = '/api/classes/' + classroom.id + '/mobile-suggestions';
  const proposal = {
    clientKey: 'mobile_restart_test_0001', subject: '语文',
    title: '完成课堂读书摘录', due: null,
  };
  assert.equal((await b.call(path, 'POST', proposal)).status, 202);
  await restart();
  const pending = await teacher.call(path);
  assert.equal(pending.status, 200);
  assert.equal(pending.body.suggestions.length, 1);
  assert.equal(pending.body.suggestions[0].title, proposal.title);
  assert.equal(JSON.stringify(pending.body).includes('WeChat'), false);
});
