import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as immediate } from 'node:timers/promises';
import { createCloudRooms } from '../rooms.mjs';

function fixture(t) {
  const sessions = new Map();
  const database = { async call(operation, { tokenHash }) {
    assert.equal(operation, 'authenticate');
    const auth = sessions.get(tokenHash);
    if (!auth || auth.expiresAt <= Date.now()) throw Object.assign(new Error('revoked'), { status: 401 });
    return auth;
  } };
  const rooms = createCloudRooms(database);
  t.after(() => rooms.close());
  const auth = (name, extra = {}) => {
    const value = { identity: { id: name, name, role: 'student', scopes: ['一班'] },
      sessionId: 'session-' + name, tokenHash: 'hash-' + name, expiresAt: Date.now() + 60000, ...extra };
    sessions.set(value.tokenHash, value);
    return value;
  };
  return { rooms, sessions, auth };
}

function connect(rooms, auth, room = 'campus') {
  const abort = new AbortController();
  const response = rooms.join(new Request('https://haiz.space/api/v1/rooms/events', { signal: abort.signal }), auth, room);
  const reader = response.body.getReader();
  let raw = '';
  const next = async type => {
    for (;;) {
      const boundary = raw.indexOf('\n\n');
      if (boundary >= 0) {
        const frame = raw.slice(0, boundary); raw = raw.slice(boundary + 2);
        const event = frame.match(/^event: (.+)$/m)?.[1];
        if (event === type) return { id: frame.match(/^id: (.+)$/m)?.[1], data: JSON.parse(frame.match(/^data: (.+)$/m)[1]) };
      } else {
        const chunk = await reader.read();
        if (chunk.done) return null;
        raw += new TextDecoder().decode(chunk.value);
      }
    }
  };
  return { response, next, abort: () => abort.abort(), cancel: () => reader.cancel(), reader };
}

const status = code => error => error.status === code;

test('real SSE streams deliver public snapshots, presence, positions and plain chat without history', async t => {
  const { rooms, auth } = fixture(t);
  const alice = auth('alice'), bob = auth('bob'), carol = auth('carol');
  const a = connect(rooms, alice);
  assert.equal(a.response.status, 200);
  assert.equal(a.response.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  assert.equal(a.response.headers.get('cache-control'), 'no-store');
  const first = await a.next('snapshot');
  assert.match(first.id, /^\d+$/);
  assert.deepEqual(first.data, { room: 'campus', connectionId: first.data.connectionId,
    members: [{ connectionId: first.data.connectionId, name: 'alice', position: null }] });
  assert.ok(!JSON.stringify(first.data).includes('session-alice'));
  const b = connect(rooms, bob);
  const second = (await b.next('snapshot')).data;
  assert.equal(second.members.length, 2);
  assert.deepEqual((await a.next('presence')).data, { kind: 'joined',
    member: { connectionId: second.connectionId, name: 'bob', position: null } });
  assert.deepEqual(rooms.post(alice, 'campus', 'position', { connectionId: first.data.connectionId, x: 1, z: -2, yaw: 0.5 }), { ok: true });
  assert.deepEqual((await b.next('position')).data, { connectionId: first.data.connectionId, position: { x: 1, z: -2, yaw: 0.5 } });
  rooms.post(alice, 'campus', 'messages', { connectionId: first.data.connectionId, text: '  <script>你好</script>  ' });
  const message = (await b.next('message')).data;
  assert.equal(message.text, '<script>你好</script>');
  assert.equal(message.name, 'alice');
  assert.equal(message.connectionId, first.data.connectionId);
  assert.ok(Number.isFinite(Date.parse(message.at)));
  assert.match(message.id, /^[a-f\d-]{36}$/);
  const c = connect(rooms, carol);
  const third = (await c.next('snapshot')).data;
  assert.equal(third.members.length, 3);
  assert.deepEqual(third.members.find(member => member.name === 'alice').position, { x: 1, z: -2, yaw: 0.5 });
  assert.ok(!JSON.stringify(third).includes('<script>'));
  assert.deepEqual(rooms.metrics, { rooms: 1, connections: 3 });
  a.abort();
  assert.deepEqual((await b.next('presence')).data, { kind: 'joined', member: { connectionId: third.connectionId, name: 'carol', position: null } });
  assert.deepEqual((await b.next('presence')).data, { kind: 'left', member: { connectionId: first.data.connectionId, name: 'alice', position: { x: 1, z: -2, yaw: 0.5 } } });
  assert.deepEqual(rooms.metrics, { rooms: 1, connections: 2 });
  await b.cancel(); await c.cancel();
  assert.deepEqual(rooms.metrics, { rooms: 0, connections: 0 });
});

test('room scopes and connection ownership reject cross-account and cross-session actions', async t => {
  const { rooms, auth } = fixture(t);
  const alice = auth('alice'), bob = auth('bob');
  assert.throws(() => connect(rooms, auth('outsider', { identity: { id: 'outsider', name: 'outsider', scopes: [] } }), 'class:一班'), status(403));
  assert.throws(() => connect(rooms, alice, 'unknown'), status(403));
  const a = connect(rooms, alice, 'class:一班');
  const id = (await a.next('snapshot')).data.connectionId;
  assert.throws(() => rooms.post(bob, 'class:一班', 'position', { connectionId: id, x: 1, z: 1, yaw: 0 }), status(403));
  assert.throws(() => rooms.post({ ...alice, sessionId: 'another-session' }, 'class:一班', 'messages', { connectionId: id, text: 'wrong session' }), status(403));
  assert.throws(() => rooms.post({ ...bob, sessionId: alice.sessionId }, 'class:一班', 'messages', { connectionId: id, text: 'wrong user' }), status(403));
  assert.throws(() => rooms.post(alice, 'campus', 'messages', { connectionId: id, text: 'wrong room' }), status(403));
  assert.throws(() => rooms.post(alice, 'class:一班', 'unknown', { connectionId: id, text: 'wrong action' }), status(404));
  await a.cancel();
  assert.throws(() => rooms.post(alice, 'class:一班', 'messages', { connectionId: id, text: 'closed' }), status(403));
});

test('request abortion, stream cancellation, and session or user revocation remove only matching connections', async t => {
  const { rooms, auth } = fixture(t);
  const alice = auth('alice'), otherSession = auth('alice-two', { identity: alice.identity }), bob = auth('bob');
  const a = connect(rooms, alice), a2 = connect(rooms, otherSession), b = connect(rooms, bob);
  await a.next('snapshot'); await a2.next('snapshot'); await b.next('snapshot');
  rooms.closeSession(alice.sessionId);
  assert.equal(rooms.metrics.connections, 2);
  rooms.closeUser(alice.identity.id);
  assert.equal(rooms.metrics.connections, 1);
  assert.equal((await b.next('presence')).data.kind, 'left');
  assert.equal((await b.next('presence')).data.kind, 'left');
  await b.cancel();
  assert.deepEqual(rooms.metrics, { rooms: 0, connections: 0 });
  const abort = new AbortController(); abort.abort();
  assert.throws(() => rooms.join(new Request('https://haiz.space/events', { signal: abort.signal }), bob, 'campus'), status(499));
  assert.equal(rooms.metrics.connections, 0);
});

test('expired or unverifiable sessions cannot join or post, and exact expiry closes streams before heartbeat', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 100000 });
  const { rooms, auth } = fixture(t);
  const expired = auth('expired', { expiresAt: Date.now() });
  assert.throws(() => connect(rooms, expired), status(401));
  assert.throws(() => connect(rooms, auth('missing-token', { tokenHash: undefined })), status(401));
  const short = auth('short', { expiresAt: Date.now() + 250 });
  const a = connect(rooms, short);
  const id = (await a.next('snapshot')).data.connectionId;
  t.mock.timers.tick(249);
  assert.equal(rooms.metrics.connections, 1);
  assert.throws(() => rooms.post({ ...short, expiresAt: Date.now() }, 'campus', 'messages', { connectionId: id, text: 'expired' }), status(401));
  t.mock.timers.tick(1);
  assert.equal(rooms.metrics.connections, 0);
  assert.equal(await a.next('presence'), null);
});

test('long session expiry reschedules after the timer maximum rather than closing early', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 100000 });
  const { rooms, auth } = fixture(t);
  const a = connect(rooms, auth('long', { expiresAt: Date.now() + 2147483647 + 1000 }));
  await a.next('snapshot');
  t.mock.timers.tick(2147483647);
  await immediate();
  assert.equal(rooms.metrics.connections, 1);
  t.mock.timers.tick(1000);
  assert.equal(rooms.metrics.connections, 0);
});

test('active heartbeats recheck server authentication and revoked sessions leave peer streams', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 100000 });
  const { rooms, auth, sessions } = fixture(t);
  const alice = auth('alice'), bob = auth('bob');
  const a = connect(rooms, alice), b = connect(rooms, bob);
  const id = (await a.next('snapshot')).data.connectionId;
  await b.next('snapshot');
  sessions.delete(alice.tokenHash);
  t.mock.timers.tick(15000); await immediate();
  assert.equal(rooms.metrics.connections, 1);
  assert.equal((await b.next('presence')).data.member.connectionId, id);
  await b.cancel();
  // A closed service must also stay closed when an earlier heartbeat completes.
  rooms.close(); t.mock.timers.tick(60000); await immediate();
  assert.deepEqual(rooms.metrics, { rooms: 0, connections: 0 });
});

test('an authenticated member receives a heartbeat and a shortened server expiry closes it exactly', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 100000 });
  const { rooms, auth, sessions } = fixture(t);
  const value = auth('alice');
  const stream = connect(rooms, value); await stream.next('snapshot');
  sessions.set(value.tokenHash, { ...value, expiresAt: Date.now() + 15250 });
  t.mock.timers.tick(15000); await immediate();
  assert.equal(new TextDecoder().decode((await stream.reader.read()).value), ': heartbeat\n\n');
  t.mock.timers.tick(249);
  assert.equal(rooms.metrics.connections, 1);
  t.mock.timers.tick(1);
  assert.equal((await stream.reader.read()).done, true);
  assert.deepEqual(rooms.metrics, { rooms: 0, connections: 0 });
});

test('cancellation during an authentication check cannot restore the departed member', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 100000 });
  let authenticate;
  // Only authentication is controlled here so the real Web stream can be
  // cancelled while the database's asynchronous reply is still in flight.
  const rooms = createCloudRooms({ call: () => new Promise(resolve => { authenticate = resolve; }) });
  t.after(() => rooms.close());
  const value = { identity: { id: 'alice', name: 'alice', scopes: [] }, sessionId: 'alice-session',
    tokenHash: 'alice-hash', expiresAt: Date.now() + 60000 };
  const stream = connect(rooms, value); await stream.next('snapshot');
  t.mock.timers.tick(15000);
  await stream.cancel();
  authenticate(value); await immediate();
  assert.deepEqual(rooms.metrics, { rooms: 0, connections: 0 });
  assert.equal((await stream.reader.read()).done, true);
  t.mock.timers.tick(15000); await immediate();
  assert.deepEqual(rooms.metrics, { rooms: 0, connections: 0 });
});

test('server authentication cannot change the user, session, or class authority of an active connection', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 100000 });
  const { rooms, auth, sessions } = fixture(t);
  const cases = [
    ['user', value => ({ ...value, identity: { ...value.identity, id: 'another-user' } })],
    ['session', value => ({ ...value, sessionId: 'another-session' })],
    ['scope', value => ({ ...value, identity: { ...value.identity, scopes: [] } })],
  ];
  for (const [name, change] of cases) {
    const value = auth(name);
    const stream = connect(rooms, value, 'class:一班'); await stream.next('snapshot');
    sessions.set(value.tokenHash, change(value));
  }
  t.mock.timers.tick(15000); await immediate();
  assert.deepEqual(rooms.metrics, { rooms: 0, connections: 0 });
});

test('position bounds and per-session message and position rates are enforced', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 100000 });
  const { rooms, auth } = fixture(t);
  const alice = auth('alice');
  const a = connect(rooms, alice); const id = (await a.next('snapshot')).data.connectionId;
  for (const input of [{ x: NaN, z: 0, yaw: 0 }, { x: 10001, z: 0, yaw: 0 }, { x: 0, z: 0, yaw: 1001 }]) {
    assert.throws(() => rooms.post(alice, 'campus', 'position', { connectionId: id, ...input }), status(400));
  }
  t.mock.timers.tick(1000);
  for (let n = 0; n < 15; n++) rooms.post(alice, 'campus', 'position', { connectionId: id, x: 10000, z: -10000, yaw: -1000 });
  assert.throws(() => rooms.post(alice, 'campus', 'position', { connectionId: id, x: 0, z: 0, yaw: 0 }), status(429));
  t.mock.timers.tick(1000);
  assert.deepEqual(rooms.post(alice, 'campus', 'position', { connectionId: id, x: 0, z: 0, yaw: 0 }), { ok: true });
  assert.throws(() => rooms.post(alice, 'campus', 'messages', { connectionId: id, text: ' ' }), status(400));
  assert.throws(() => rooms.post(alice, 'campus', 'messages', { connectionId: id, text: 'x'.repeat(501) }), status(400));
  t.mock.timers.tick(10000);
  for (let n = 0; n < 10; n++) rooms.post(alice, 'campus', 'messages', { connectionId: id, text: 'hello' });
  assert.throws(() => rooms.post(alice, 'campus', 'messages', { connectionId: id, text: 'hello' }), status(429));
});

test('connection limits enforce four per user, 64 per room, and 256 total', async t => {
  const { rooms, auth } = fixture(t);
  const alice = auth('alice');
  for (let n = 0; n < 4; n++) connect(rooms, alice);
  assert.throws(() => connect(rooms, alice), status(429));
  rooms.closeUser(alice.identity.id);
  for (let room = 0; room < 4; room++) {
    for (let n = 0; n < 64; n++) connect(rooms, auth(`user-${room}-${n}`, { identity: { id: `user-${room}-${n}`, name: 'peer', scopes: ['room-' + room] } }), 'class:room-' + room);
    assert.throws(() => connect(rooms, auth('extra-' + room, { identity: { id: 'extra-' + room, name: 'extra', scopes: ['room-' + room] } }), 'class:room-' + room), status(429));
  }
  assert.throws(() => connect(rooms, auth('last')), status(429));
  assert.deepEqual(rooms.metrics, { rooms: 4, connections: 256 });
});

test('a slow consumer is disconnected before its queued SSE bytes exceed 64 KiB', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 100000 });
  const { rooms, auth } = fixture(t);
  const slow = auth('slow'), sender = auth('sender');
  const slowStream = connect(rooms, slow); await slowStream.next('snapshot');
  const active = connect(rooms, sender); const id = (await active.next('snapshot')).data.connectionId;
  let departure;
  for (let n = 0; rooms.metrics.connections === 2 && n < 200; n++) {
    rooms.post(sender, 'campus', 'messages', { connectionId: id, text: '界'.repeat(500) });
    if (rooms.metrics.connections === 1) departure = (await active.next('presence')).data;
    await active.next('message');
    if (n % 10 === 9) t.mock.timers.tick(10000);
  }
  assert.equal(rooms.metrics.connections, 1);
  let bytes = 0;
  for (;;) {
    const chunk = await slowStream.reader.read(); if (chunk.done) break;
    bytes += chunk.value.byteLength;
  }
  assert.ok(bytes <= 65536, `queued ${bytes} bytes`);
  assert.equal(departure.kind, 'left');
});
