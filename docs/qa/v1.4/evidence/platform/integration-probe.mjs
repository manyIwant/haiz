// Reproduce from any cwd: node --test /absolute/path/to/integration-probe.mjs
// Uses synthetic data and an ephemeral loopback HTTP listener only; no QQ connection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { normalizeMention, relayMention } from '../../../../../integrations/qq-bot/bot.mjs';

const project = fileURLToPath(new URL('../../../../../', import.meta.url));
const scratch = mkdtempSync(join(fileURLToPath(new URL('./', import.meta.url)), 'synthetic-runtime-'));
const secret = 'SyntheticRelaySecretForQAOnly2026!!';
const password = 'SyntheticPasswordForQAOnly2026!!';
process.env.HAIZ_DB_PATH = join(scratch, 'qa.sqlite');
process.env.HAIZ_ADMIN_LOGIN = 'qa_platform_admin';
process.env.HAIZ_ADMIN_PASSWORD = password;
process.env.HAIZ_QQ_RELAY_SECRET = secret;
process.env.HAIZ_SCHOOL_ROSTER_SECRET = '';
const { server, db } = await import(new URL('services/academic/server.mjs', 'file://' + project));
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const request = async (path, data, cookie = '') => {
  const response = await fetch(baseUrl + path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(data === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
};
const event = {
  kind: 'group', rawEventType: 'GROUP_AT_MESSAGE_CREATE', senderIsBot: false,
  groupOpenid: 'synthetic-platform-group', messageId: 'synthetic-platform-message',
  content: '虚构作业内容', senderId: 'synthetic-private-sender', senderName: '不可转发身份',
  attachments: [{ url: 'https://example.invalid/private' }], raw: { private: '不可转发' },
};

test('actual adapter -> integrated backend review -> public legacy screen -> rotation', async () => {
  try {
    const login = await request('/api/auth/login', { login: 'qa_platform_admin', password });
    assert.equal(login.status, 200);
    const cookie = login.cookie;
    const created = await request('/api/classes', { title: '虚构平台 QA 班级' }, cookie);
    assert.equal(created.status, 201);
    const classroom = created.body;
    assert.match(classroom.screenKey, /^[0-9a-f]{96}$/);
    const screenPath = '/api/screens/' + classroom.screenKey;
    const before = await request(screenPath);
    assert.equal(before.status, 200);
    assert.deepEqual(before.body.assignments, []);
    assert.equal(before.headers.get('cache-control'), 'no-store');

    const mapping = await request(`/api/classes/${classroom.id}/qq/mapping`, { groupOpenid: event.groupOpenid }, cookie);
    assert.equal(mapping.status, 200);
    const accepted = await relayMention(event, { baseUrl, secret });
    assert.deepEqual(accepted, { accepted: true, reviewRequired: true });
    assert.deepEqual((await request(screenPath)).body.assignments, []);
    assert.equal((await relayMention(event, { baseUrl, secret })).duplicate, true);
    const inbox = await request(`/api/classes/${classroom.id}/inbox`, undefined, cookie);
    assert.equal(inbox.body.inbox.length, 1);
    assert.equal(inbox.body.inbox[0].content, event.content);
    const pendingId = inbox.body.inbox[0].id;
    const published = await request(`/api/classes/${classroom.id}/inbox/${pendingId}/publish`, {
      subject: '物理', title: '合成确认作业', due: '2026-10-30',
    }, cookie);
    assert.equal(published.status, 201);
    assert.equal(published.body.manuallyReviewed, true);
    const screen = await request(screenPath);
    assert.equal(screen.status, 200);
    assert.deepEqual(Object.keys(screen.body).sort(), ['assignments', 'className', 'containsStudentIdentity', 'readOnly']);
    assert.equal(screen.body.className, '虚构平台 QA 班级');
    assert.equal(screen.body.readOnly, true);
    assert.equal(screen.body.containsStudentIdentity, false);
    assert.equal(screen.body.assignments.length, 1);
    assert.deepEqual(Object.keys(screen.body.assignments[0]).sort(), ['due', 'id', 'subject', 'title', 'version']);
    assert.equal(screen.body.assignments[0].subject, '物理');
    assert.equal(screen.body.assignments[0].title, '合成确认作业');
    assert.equal(screen.body.assignments[0].due, '2026-10-30');
    for (const excluded of ['不可转发身份', event.senderId, 'groupOpenid', 'createdBy', 'details', 'screenKey']) {
      assert.equal(JSON.stringify(screen.body).includes(excluded), false);
    }
    const v1 = async (path, data) => {
      const response = await fetch(baseUrl + '/api/v1' + path, {
        method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', 'Idempotency-Key': 'qa-' + crypto.randomUUID() }, body: JSON.stringify(data),
      });
      assert.ok(response.ok, `v1 ${path} returned ${response.status}`);
      return (await response.json()).data.assignment;
    };
    const draft = await v1(`/classes/${classroom.id}/assignments`, { subject: '数学', title: '未公开虚构草稿', details: '', due: null, duePrecision: 'none' });
    assert.equal((await request(screenPath)).body.assignments.length, 1);
    const review = await v1(`/assignments/${draft.id}/review`, { expectedVersion: draft.version });
    assert.equal((await request(screenPath)).body.assignments.length, 1);
    const publicTask = await v1(`/assignments/${draft.id}/publish`, { expectedVersion: review.version });
    assert.equal((await request(screenPath)).body.assignments.length, 2);
    const projected = (await request(screenPath)).body.assignments.find(item => item.id === publicTask.id);
    assert.equal(projected.version, publicTask.version);
    assert.equal(projected.due, null);
    await v1(`/assignments/${publicTask.id}/retract`, { expectedVersion: publicTask.version });
    assert.equal((await request(screenPath)).body.assignments.length, 1);
    console.log('PASS legacy screen excludes v1 draft/review/retracted, includes published id/version and nullable due');
    const rotated = await request(`/api/classes/${classroom.id}/screens/rotate`, {}, cookie);
    assert.equal(rotated.status, 200);
    assert.equal((await request(screenPath)).status, 404);
    assert.equal((await request('/api/screens/' + rotated.body.screenKey)).status, 200);
    await assert.rejects(() => relayMention({ ...event, messageId: 'bad-signature' }, { baseUrl, secret: 'WrongSyntheticRelaySecretForQAOnly!' }), /401/);
    const unmapped = await relayMention({ ...event, messageId: 'unmapped', groupOpenid: 'unmapped-synthetic' }, { baseUrl, secret });
    assert.deepEqual(unmapped, { accepted: false, reason: 'group-not-mapped' });
    assert.equal((await relayMention({ ...event, rawEventType: 'GROUP_MESSAGE_CREATE' }, { baseUrl, secret })).ignored, true);
    assert.equal(normalizeMention({ ...event, content: ' x '.repeat(2000) }).content.length, 3500);
    assert.deepEqual(Object.keys(normalizeMention(event)).sort(), ['content', 'eventType', 'groupOpenid', 'mentioned', 'messageId']);
    console.log('PASS real relay HMAC, pending-only, duplicate, manual publication, public screen shape, key rotation, bad signature, unmapped and ignored events');
    console.log('LIMIT actual C# rendering/Windows host not executed; screen JSON shape validated only');
  } finally {
    await new Promise(resolve => server.close(resolve));
    db.close();
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('installed Tencent SDK event dispatcher and message callback match adapter assumptions without network', async () => {
  const sdkRoot = new URL('../../../../../integrations/qq-bot/node_modules/@tencent-connect/qqbot-nodejs/dist/', import.meta.url);
  const { dispatchEvent } = await import(new URL('protocol/gateway/event-dispatcher.js', sdkRoot));
  const { QQBot } = await import(new URL('QQBot.js', sdkRoot));
  const raw = { id: event.messageId, group_openid: event.groupOpenid, content: event.content,
    author: { member_openid: event.senderId, username: event.senderName, bot: false }, timestamp: '2026-10-27T00:00:00Z' };
  const dispatched = dispatchEvent('GROUP_AT_MESSAGE_CREATE', raw, 'synthetic-app', {});
  assert.equal(dispatched.action, 'message');
  assert.equal(normalizeMention(dispatched.msg).groupOpenid, event.groupOpenid);
  assert.equal(normalizeMention(dispatchEvent('GROUP_MESSAGE_CREATE', raw, 'synthetic-app', {}).msg), null);
  assert.equal(normalizeMention(dispatchEvent('C2C_MESSAGE_CREATE', { ...raw, author: { user_openid: 'synthetic-user' } }, 'synthetic-app', {}).msg), null);
  const bot = new QQBot({ appId: 'synthetic-not-used', appSecret: 'synthetic-not-used' });
  let seen = 0;
  bot.on('message', async (ctx, message) => {
    assert.equal(ctx.message, message);
    assert.deepEqual(normalizeMention(message), normalizeMention(dispatched.msg));
    seen += 1;
  });
  await bot.handleInboundMessage(dispatched.msg);
  assert.equal(seen, 1);
  console.log('PASS installed SDK event normalization and (ctx, msg) callback; bot.start never called');
});

test('relay transport errors are propagated and valid events use a timeout signal', async () => {
  await assert.rejects(() => relayMention(event, { baseUrl: 'http://10.0.0.7:8780', secret }), /HTTPS/);
  await assert.rejects(() => relayMention(event, { baseUrl, secret: 'short' }), /32/);
  await assert.rejects(() => relayMention(event, { baseUrl, secret, send: async () => ({ ok: false, status: 503 }) }), /503/);
  await assert.rejects(() => relayMention(event, { baseUrl, secret, send: async () => { throw new Error('synthetic offline'); } }), /synthetic offline/);
  await assert.rejects(() => relayMention(event, { baseUrl, secret, send: async () => ({ ok: true, json: async () => { throw new SyntaxError('synthetic malformed JSON'); } }) }), /malformed JSON/);
  const result = await relayMention(event, { baseUrl, secret, send: async (_url, config) => {
    assert.ok(config.signal instanceof AbortSignal);
    return { ok: true, json: async () => ({ accepted: true }) };
  } });
  assert.equal(result.accepted, true);
});
