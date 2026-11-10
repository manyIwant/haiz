// Explicit deployment acceptance check. Creates two synthetic student accounts,
// verifies the live API, then removes those accounts and all their test data.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
const base = process.argv[2];
if (!base || new URL(base).protocol !== 'https:' || process.argv[3] !== '--confirm-synthetic-write') throw Error('Usage: node public-smoke.mjs https://deployed-origin --confirm-synthetic-write');
function client() {
  let cookie = '';
  return { async call(path, { method, body, headers = {}, stream = false } = {}) {
    const response = await fetch(base + path, { method: method || (body === undefined ? 'GET' : 'POST'), headers: { Origin: base, ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(25000) });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    if (stream) return response;
    const raw = await response.text(); let data; try { data = JSON.parse(raw); } catch { data = raw; }
    return { status: response.status, data, headers: response.headers, url: response.url };
  } };
}
const users = [], publicClient = client(); let reader;
try {
  const health = await publicClient.call('/api/health'); assert.equal(health.status, 200, JSON.stringify(health.data));
  const ready = await publicClient.call('/api/ready'); assert.equal(ready.status, 200); assert.equal(ready.data.schemaVersion, 3);
  const anonymous = await publicClient.call('/account/'); assert.equal(new URL(anonymous.url).pathname, '/login/');
  for (const suffix of ['a','b']) {
    const api = client(), name = 'cloud-qa-' + randomBytes(4).toString('hex') + '-' + suffix, password = randomBytes(24).toString('base64url');
    const registration = await api.call('/api/auth/register', { body: { username: name, password } });
    assert.equal(registration.status, 201, JSON.stringify(registration.data)); assert.match(registration.headers.get('set-cookie'), /__Host-haiz_session=.*Secure/);
    users.push({ api, name, password, id: registration.data.identity.id });
  }
  const [a,b] = users, route = '/api/v1/data/notes/cloud-qa';
  assert.equal((await a.api.call(route, { method: 'PUT', body: { expectedRevision: 0, data: { title: '公网验收临时记录', text: '验证后删除的合成测试数据' } } })).status, 200);
  assert.equal((await b.api.call(route)).status, 404);
  assert.equal((await b.api.call('/api/v1/usage', { headers: { 'X-HAIZ-User': a.id } })).status, 409);
  assert.equal((await a.api.call(route, { method: 'DELETE', body: { expectedRevision: 1 } })).status, 200);
  const restored = await a.api.call(route + '/restore', { body: { expectedRevision: 2 } }); assert.equal(restored.status, 200); assert.equal(restored.data.item.revision, 3);
  assert.equal((await a.api.call(route + '/history')).data.items[0].revision, 3);
  assert.equal((await a.api.call('/api/v1/search?q=' + encodeURIComponent('公网验收'))).data.items.length, 1);
  const events = await a.api.call('/api/v1/rooms/campus/events?user=' + a.id, { stream: true }); assert.equal(events.status, 200); assert.match(events.headers.get('content-type'), /text\/event-stream/);
  reader = events.body.getReader(); let text = '';
  while (!/event: snapshot\ndata: [^\n]+\n/.test(text)) { const chunk = await reader.read(); assert.equal(chunk.done, false); text += new TextDecoder().decode(chunk.value); }
  const snapshot = JSON.parse(/event: snapshot\ndata: ([^\n]+)/.exec(text)[1]);
  assert.equal((await a.api.call('/api/v1/rooms/campus/messages', { body: { connectionId: snapshot.connectionId, text: '公网实时连接验收' } })).status, 200);
  while (!text.includes('event: message')) { const chunk = await reader.read(); assert.equal(chunk.done, false); text += new TextDecoder().decode(chunk.value); }
  assert.match(text, /公网实时连接验收/); await reader.cancel(); reader = null;
  const homepage = await a.api.call('/'); assert.equal(homepage.status, 200); assert.match(homepage.data, /<html/); assert.ok(homepage.data.includes('data-haiz-user="' + a.id + '"')); assert.equal(homepage.headers.get('cache-control'), 'no-store');
  console.log(JSON.stringify({ publicHealth: true, schemaVersion: 3, secureRegistration: true, crossAccountIsolation: true, identitySwitchProtection: true, historyRestore: true, SSE: true, originalHomepageAuthenticated: true, url: base }));
} finally {
  await reader?.cancel().catch(() => {});
  for (const user of users) { const result = await user.api.call('/api/v1/auth/account', { method: 'DELETE', body: { password: user.password, confirm: user.name } }); assert.equal(result.status, 200, 'Synthetic account cleanup failed'); }
  if (users.length) console.log(JSON.stringify({ syntheticTestAccountsRemoved: users.length }));
}
