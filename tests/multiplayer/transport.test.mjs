import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseTransport } from '../../lanren/multiplayer/supabase.js';

const own = '34b206b0-8bbb-4f7d-8f44-d63706e73059';
const other = '063f55bc-a73b-411e-9e60-a26d099477df';
const room = 'campus-alpha';
function fixture({ directory, joinError, rpcError, hanging } = {}) {
  const channels = [], removed = [];
  const db = {
    auth: { getSession: async () => ({ data: { session: { access_token: 'existing-session' } } }) },
    realtime: { setAuth: async () => {}, isConnected: () => true },
    rpc(name, args) {
      assert.equal(name, 'haiz_mp_directory');
      assert.deepEqual(args, { room });
      return { abortSignal: async () => ({
        data: directory ?? { self: own, members: [other, own], capacity: 2, frame: 'haiz-campus-v1' },
        error: rpcError ?? null, status: rpcError ? 403 : 200,
      }) };
    },
    channel(topic, options) {
      const calls = [], handlers = {};
      const ch = {
        topic, options, calls, handlers, members: {}, state: 'joined',
        on(type, { event }, fn) { handlers[type + event] = fn; return ch; },
        subscribe(callback) {
          ch.callback = callback;
          if (!hanging) queueMicrotask(() => callback(joinError ?? 'SUBSCRIBED'));
          return ch;
        },
        presenceState() { return ch.members; },
        async track(data) { calls.push(['track', data]); return 'ok'; },
        async untrack() { calls.push(['untrack']); return 'ok'; },
        async send(data) { calls.push(['send', data]); return 'ok'; },
      };
      channels.push(ch);
      return ch;
    },
    async removeChannel(channel) { removed.push(channel.topic); return 'ok'; },
  };
  return { db, channels, removed };
}
const noop = () => {};
const hooks = { onPresence: noop, onPacket: noop, onLost: noop };
test('subscribes only to private directory channels and originates messages on own alias only', async () => {
  const f = fixture();
  const observed = [];
  const h = await createSupabaseTransport(f.db, { presenceGap: 0 }).open(room, {
    onPresence: (...a) => observed.push(a),
    onPacket: (...a) => observed.push(a),
    onLost: e => observed.push(e.message),
  });
  assert.equal(h.ownId, own);
  assert.ok(f.channels.every(c => c.options.config.private === true && !c.options.config.broadcast.self));
  assert.ok(f.channels.every(c => c.topic.startsWith('haiz-mp:v1:' + room + ':')));
  const observer = f.channels.find(c => c.topic.endsWith(other));
  observer.members = { key: [{ sid: 'remote-session' }] };
  observer.handlers.presencesync();
  observer.handlers['broadcaststate']({ payload: { id: own } });
  assert.deepEqual(observed, []);
  h.activate();
  assert.deepEqual(observed.find(([id]) => id === other), [other, [{ sid: 'remote-session' }]]);
  observer.handlers['broadcaststate']({ payload: { id: own } });
  assert.deepEqual(observed.at(-1), [other, { id: own }]);
  await h.track({ sid: 'local-session' }); await h.send({ x: 1 }); await h.untrack();
  assert.equal(f.channels.find(c => c.topic.endsWith(own)).calls.length, 3);
  assert.equal(observer.calls.length, 0);
  observer.callback('CHANNEL_ERROR');
  assert.equal(typeof observed.at(-1), 'string');
  await h.close(); await h.close();
  assert.equal(f.removed.length, 2);
});

test('denied directory never opens channels and channel failure removes all channels', async () => {
  const denied = fixture({ rpcError: { code: '42501', message: 'denied' } });
  await assert.rejects(createSupabaseTransport(denied.db).open(room, hooks), { permanent: true });
  assert.equal(denied.channels.length, 0);
  const failed = fixture({ joinError: 'CHANNEL_ERROR' });
  await assert.rejects(createSupabaseTransport(failed.db).open(room, hooks), /CHANNEL_ERROR/);
  assert.deepEqual(failed.removed.sort(), failed.channels.map(c => c.topic).sort());
});

test('abort while negotiating does not leak subscriptions', async () => {
  const fixture1 = fixture({ hanging: true });
  const abort = new AbortController();
  const opening = createSupabaseTransport(fixture1.db).open(room, { ...hooks, signal: abort.signal });
  await new Promise(resolve => setImmediate(resolve));
  abort.abort();
  await assert.rejects(opening, { name: 'AbortError' });
  assert.equal(fixture1.removed.length, 2);
});

test('observer loss during remaining channel joins rejects the entire negotiation', async () => {
  const third = '00000000-0000-4000-8000-000000000003';
  const f = fixture({ hanging: true, directory: { self: own, members: [own, other, third], capacity: 3, frame: 'haiz-campus-v1' } });
  const opening = createSupabaseTransport(f.db, { presenceGap: 0 }).open(room, hooks);
  await new Promise(resolve => setImmediate(resolve));
  f.channels[0].callback('SUBSCRIBED');
  f.channels[1].callback('SUBSCRIBED');
  f.channels[1].callback('CHANNEL_ERROR');
  f.channels[2].callback('SUBSCRIBED');
  await assert.rejects(opening, /CHANNEL_ERROR/);
  assert.equal(f.removed.length, 3);
});

test('lost sockets refuse Broadcast before Supabase can fall back to REST', async () => {
  const f = fixture();
  const h = await createSupabaseTransport(f.db, { presenceGap: 0 }).open(room, hooks);
  h.activate();
  f.db.realtime.isConnected = () => false;
  assert.throws(() => h.send({}), /断开/);
  assert.ok(f.channels.every(c => !c.calls.length));
  await h.close();
});

test('Presence calls have bounded pacing and cancellation interrupts a delayed call', async () => {
  const f = fixture();
  const abort = new AbortController();
  const h = await createSupabaseTransport(f.db, { presenceGap: 20 }).open(room, { ...hooks, signal: abort.signal });
  await h.track({});
  const hidden = h.untrack();
  assert.equal(f.channels.find(c => c.topic.endsWith(own)).calls.length, 1);
  abort.abort();
  await assert.rejects(hidden, { name: 'AbortError' });
  await h.close();
});
