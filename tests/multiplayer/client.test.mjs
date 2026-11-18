import test from 'node:test';
import assert from 'node:assert/strict';
import { createMultiplayerClient } from '../../lanren/multiplayer/client.js';
import { PROTOCOL_VERSION, FRAME_ID, sendInterval } from '../../lanren/multiplayer/protocol.js';

const ids = [1, 2, 3].map(n => `00000000-0000-4000-8000-00000000000${n}`);
const p = (x = 0, patch = {}) => ({ x, y: -0.8, z: 1, yaw: 0, speed: 0, motion: 'idle', ...patch });
const room = 'campus-alpha';
const turn = () => new Promise(resolve => setImmediate(resolve));
function harness(capacity = 2) {
  let at = 1;
  const jobs = new Map(), active = new Map();
  let jid = 0;
  const config = {
    now: () => at, wallNow: () => 42,
    schedule: (fn, delay) => { jobs.set(++jid, { fn, at: at + delay }); return jid; },
    cancel: id => jobs.delete(id), onError: () => {},
  };
  async function advance(ms) {
    const until = at + ms;
    while (true) {
      const job = [...jobs].sort((a, b) => a[1].at - b[1].at)[0];
      if (!job || job[1].at > until) break;
      at = job[1].at;
      jobs.delete(job[0]); job[1].fn();
      await turn();
    }
    at = until; await turn();
  }
  const trackSync = id => {
    const peers = active.get(id) ?? [];
    for (const list of active.values()) for (const member of list)
      member.hooks.onPresence(id, peers.filter(m => m.presence).map(m => m.presence));
  };
  let n = 4;
  function peer(id, nickname, sid) {
    const transport = {
      async open(_room, hooks) {
        const member = { hooks, presence: null, packets: [], dropped: false };
        const list = active.get(id) ?? [];
        list.push(member); active.set(id, list);
        return {
          ownId: id, capacity,
          activate() { for (const other of active.keys()) trackSync(other); },
          async track(value) { member.presence = value; trackSync(id); },
          async untrack() { member.presence = null; trackSync(id); },
          async send(packet) {
            member.packets.push(packet);
            if (!member.dropped) broadcast(id, packet);
          },
          async close() {
            member.presence = null;
            const idx = list.indexOf(member);
            if (idx >= 0) list.splice(idx, 1);
            trackSync(id);
          },
        };
      },
    };
    const client = createMultiplayerClient({ transport, ...config,
      newSessionId: () => sid ?? `00000000-0000-4000-8000-${String(n++).padStart(12, '0')}`,
      jitter: () => 0,
    });
    client.setNickname(nickname);
    client.updateLocalPlayer(p());
    return client;
  }
  function broadcast(id, packet) {
    for (const list of active.values()) for (const member of list) member.hooks.onPacket(id, packet);
  }
  return { peer, advance, broadcast, active, config };
}

test('two room members see one another and move; the map and scene can sample the same interpolated state', async () => {
  const h = harness(), a = h.peer(ids[0], '榄仁'), b = h.peer(ids[1], '海风');
  const events = [];
  const off = b.subscribe('join', ({player}) => events.push(player.nickname));
  await a.connect(room); await b.connect(room);
  await h.advance(160);
  assert.equal(a.getPlayers().length, 2);
  assert.deepEqual(events, ['海风', '榄仁']);
  off();
  a.updateLocalPlayer(p(0.65, { motion: 'run', speed: 4.3, yaw: Math.PI - 0.01 }));
  await h.advance(125);
  assert.equal(b.getPlayer(ids[0], { mode: 'network' }).motion, 'run');
  assert.equal(b.getPlayer(ids[0], { mode: 'network' }).x, 0.65);
  assert.ok(b.getPlayer(ids[0]).x < 0.65);
  await h.advance(200);
  assert.equal(b.getPlayer(ids[0]).x, 0.65);
  assert.equal(b.getPlayer(ids[0]).source, 'user');
  assert.ok(Object.isFrozen(b.getPlayer(ids[0])));
  await a.destroy(); await b.destroy();
});

test('ignores spoofed, reordered, invalid and implausible movement packets', async () => {
  const h = harness(), a = h.peer(ids[0], '访客'), b = h.peer(ids[1], '访客');
  await a.connect(room); await b.connect(room); await h.advance(160);
  const m = h.active.get(ids[0])[0], last = m.packets.at(-1);
  for (const [id, packet] of [
    [ids[0], { ...last, seq: last.seq - 1, state: p(1) }],
    [ids[0], { ...last, v: 999, seq: last.seq + 1, state: p(1) }],
    [ids[0], { ...last, seq: last.seq + 1, state: p(Infinity) }],
    [ids[0], { ...last, seq: last.seq + 1, state: p(200) }],
    [ids[1], { ...last, seq: last.seq + 1, state: p(1) }],
    [ids[2], { ...last, seq: last.seq + 1, state: p(1) }],
  ]) h.broadcast(id, packet);
  assert.equal(b.getPlayer(ids[0], { mode: 'network' }).x, 0);
  await a.destroy(); await b.destroy();
});

test('hide/leave removes the player; drop clears ghosts and rejoins with a new session', async () => {
  const h = harness(), a = h.peer(ids[0], '甲'), b = h.peer(ids[1], '乙');
  await a.connect(room); await b.connect(room); await h.advance(160);
  const initial = h.active.get(ids[0])[0].presence.sid;
  const reasons = [];
  b.subscribe('leave', ({ player, reason }) => { if (player.id === ids[0]) reasons.push(reason); });
  await a.setVisible(false);
  assert.equal(b.getPlayer(ids[0]), null);
  assert.deepEqual(reasons, ['visibility']);
  const withdrawal = h.active.get(ids[0])[0].packets.at(-1);
  assert.equal(withdrawal.hidden, true);
  assert.ok(!('state' in withdrawal));
  await a.setVisible(true); await h.advance(160);
  assert.ok(b.getPlayer(ids[0]));
  const original = h.active.get(ids[0])[0];
  original.hooks.onLost('offline');
  assert.equal(a.getConnection().status, 'reconnecting');
  assert.equal(a.getPlayers().length, 0);
  await h.advance(1000);
  assert.equal(a.getConnection().status, 'connected');
  assert.notEqual(h.active.get(ids[0])[0].presence.sid, initial);
  original.hooks.onLost('late old socket');
  assert.equal(a.getConnection().status, 'connected');
  await a.disconnect();
  assert.equal(b.getPlayer(ids[0]), null);
  await b.destroy();
});

test('same identity renders one player with deterministic handoff; idle/background traffic stays bounded', async () => {
  const h = harness(), a = h.peer(ids[0], '甲一', ids[0]), duplicate = h.peer(ids[0], '甲二', ids[2]);
  const b = h.peer(ids[1], '乙');
  await a.connect(room); await duplicate.connect(room); await b.connect(room);
  await h.advance(200);
  assert.equal(b.getPlayers().length, 2);
  assert.equal(b.getPlayer(ids[0]).nickname, '甲一');
  await a.disconnect(); await h.advance(4200);
  assert.equal(b.getPlayer(ids[0]).nickname, '甲二');
  const m = h.active.get(ids[0])[0], sent = m.packets.length;
  duplicate.setBackground(true);
  for (let i = 0; i < 25; i++) { duplicate.updateLocalPlayer(p(i / 40)); await h.advance(40); }
  assert.ok(m.packets.length - sent <= 1);
  await duplicate.destroy(); await b.destroy();
});

test('silence expires a ghost while preserving sequence protection; throttles fast-moving clients', async () => {
  const h = harness(), a = h.peer(ids[0], '甲'), b = h.peer(ids[1], '乙');
  await a.connect(room); await b.connect(room); await h.advance(160);
  const m = h.active.get(ids[0])[0], before = m.packets.length;
  for (let i = 0; i < 40; ++i) { a.updateLocalPlayer(p(i/80)); await h.advance(25); }
  assert.ok(m.packets.length - before <= 8);
  m.dropped = true;
  const old = m.packets.at(-1);
  await h.advance(26_000);
  assert.equal(b.getPlayer(ids[0]), null);
  h.broadcast(ids[0], { ...old, seq: 1 });
  assert.equal(b.getPlayer(ids[0]), null);
  m.dropped = false;
  await h.advance(4200);
  assert.ok(b.getPlayer(ids[0]));
  await a.destroy(); await b.destroy();
});

test('permanent authorization rejection and cancelled connects cannot later enter a room', async () => {
  const h = harness();
  const denied = createMultiplayerClient({ ...h.config, transport: {
    async open() { throw Object.assign(new Error('denied'), { permanent: true }); },
  } });
  await assert.rejects(denied.connect(room), /denied/);
  assert.equal(denied.getConnection().status, 'error');
  let finish, closed = 0;
  const delayed = createMultiplayerClient({ ...h.config, transport: {
    open() { return new Promise(done => { finish = done; }); },
  } });
  const opening = delayed.connect(room);
  const rejected = assert.rejects(opening, { name: 'AbortError' });
  await turn(); // cancel while the transport is open but has not returned a handle
  await delayed.disconnect();
  finish({ close: async () => { closed++; } });
  await rejected; await turn();
  assert.equal(closed, 1);
  assert.equal(delayed.getConnection().status, 'disconnected');
});

test('2–20 player pacing respects the Alpha room message budget and protocol advertises its frame', () => {
  for (const n of [2, 5, 10, 20]) assert.ok(n * n * 1000 / sendInterval(n) <= 75);
  assert.equal(PROTOCOL_VERSION, 1);
  assert.equal(FRAME_ID, 'haiz-campus-v1');
});

test('twenty simulated identities remain bounded at capacity-based pacing', async () => {
  const h = harness(20);
  const clients = Array.from({length: 20}, (_, i) => h.peer(
    '10000000-0000-4000-8000-' + String(i).padStart(12, '0'), '访客' + i));
  for (const client of clients) await client.connect(room);
  await h.advance(6000); // late joins wait for the next capacity-paced keyframe
  for (const client of clients) assert.equal(client.getPlayers().length, 20);
  for (let frame = 0; frame < 300; frame++) {
    for (const client of clients) client.updateLocalPlayer(p(frame / 100, { speed: 1, motion: 'walk' }));
    await h.advance(100);
  }
  const sent = [...h.active.values()].flat().reduce((sum, m) => sum + m.packets.length, 0);
  assert.ok(sent <= 140, 'bounded to first snapshot plus at most 6 periodic samples per identity');
  for (const client of clients) {
    assert.equal(client.getPlayers().length, 20);
    assert.ok(client.getPlayers().every(p => Number.isFinite(p.x)));
  }
  for (const client of clients) await client.destroy();
});

test('one throwing observer or error reporter cannot break later subscribers', { timeout: 1000 }, async () => {
  const h = harness();
  h.config.onError = () => { throw new Error('reporter failed'); };
  const a = h.peer(ids[0], '甲');
  let reached = 0;
  a.subscribe('join', () => { throw new Error('observer failed'); });
  const off = a.subscribe('join', () => reached++);
  await a.connect(room);
  assert.equal(reached, 1);
  off();
  await a.disconnect();
  await a.connect(room);
  assert.equal(reached, 1);
  await a.destroy();
});
