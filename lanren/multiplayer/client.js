import {
  ALIAS, ROOM, FRAME_ID, PROTOCOL_VERSION, nicknameOf, movementChanged,
  readPacket, readPresence, readState, sendInterval, wrapYaw,
} from './protocol.js';

const EVENTS = ['join', 'leave', 'update', 'connection'];
const IDLE_MS = 4000;
const BACKGROUND_MS = 8000;
const STALE_MS = 24_000;
const LIMITS = { x0: -400, x1: 400, z0: -400, z1: 400, y0: -5, y1: 40 };

function interpolate(samples, at) {
  const latest = samples.at(-1);
  if (at >= latest.at || samples.length < 2) return latest.player;
  let i = samples.findIndex(sample => sample.at > at);
  if (i <= 0) return samples[0].player;
  const { player: a, at: from } = samples[i - 1];
  const { player: b, at: to } = samples[i];
  const t = Math.min(1, Math.max(0, (at - from) / (to - from)));
  const mix = (x, y) => x + (y - x) * t;
  return Object.freeze({
    ...b, x: mix(a.x, b.x), y: mix(a.y, b.y), z: mix(a.z, b.z),
    yaw: wrapYaw(a.yaw + t * wrapYaw(b.yaw - a.yaw)), speed: mix(a.speed, b.speed),
    motion: a.motion === 'jump' || b.motion === 'jump' ? (t < 0.5 ? a.motion : b.motion) :
      (b.motion === 'idle' ? a.motion : b.motion),
    timestamp: t < 0.5 ? a.timestamp : b.timestamp,
  });
}

export function createMultiplayerClient({
  transport, bounds = {}, now = () => performance.now(), wallNow = Date.now,
  schedule = setTimeout, cancel = clearTimeout, jitter = Math.random,
  newSessionId = () => crypto.randomUUID(), onError = error => console.error(error),
} = {}) {
  if (typeof transport?.open !== 'function') throw new TypeError('需要多人传输适配器');
  const report = error => { try { onError(error); } catch { /* diagnostic sinks cannot interrupt networking */ } };
  const limits = { ...LIMITS, ...bounds };
  const listeners = new Map(EVENTS.map(event => [event, new Set()]));
  const peers = new Map();
  let connection = Object.freeze({ status: 'disconnected', roomId: null, playerId: null, detail: null });
  let intent, disposed = false, retirement = Promise.resolve();
  let local, publishedLocal, nickname = '访客', visible = true, background = false;
  let pulseTimer;
  const emit = (event, payload) => {
    for (const callback of [...listeners.get(event)]) {
      try { callback(Object.freeze(payload)); } catch (error) { report(error); }
    }
  };
  function status(next, detail = null) {
    connection = Object.freeze({
      status: next, roomId: intent?.room ?? null, playerId: intent?.attempt?.handle?.ownId ?? null, detail,
    });
    emit('connection', connection);
  }
  function publicState(id, state, name, timestamp, isLocal) {
    return Object.freeze({ ...state, id, nickname: name, source: 'user', timestamp, isLocal });
  }
  function leave(player, reason) {
    if (player) emit('leave', { player, reason });
  }
  function clearRoster(reason) {
    const snapshots = [...peers.values()].map(peer => peer.latest);
    peers.clear();
    const self = publishedLocal;
    publishedLocal = undefined;
    for (const player of snapshots) leave(player, reason);
    leave(self, reason);
  }
  function retire(attempt) {
    attempt.abort.abort();
    if (attempt.handle)
      retirement = retirement.then(() => attempt.handle.close()).catch(report);
  }
  function retry(i, a, error) {
    if (intent !== i || i.attempt !== a) return;
    i.attempt = undefined;
    retire(a);
    cancel(pulseTimer);
    const message = error?.message || String(error || '连接中断');
    clearRoster('connection');
    if (intent !== i) return;
    if (error?.permanent) {
      intent = undefined;
      i.reject(error);
      status('error', message);
      return;
    }
    status('reconnecting', message);
    if (intent !== i) return;
    const pause = Math.min(20_000, 650 * 2 ** Math.min(5, i.failures++));
    i.retry = schedule(() => dial(i), pause + Math.floor(pause * 0.3 * jitter()));
  }
  function presence(a, id, entries) {
    if (!a.handle || typeof id !== 'string' || !ALIAS.test(id) || !Array.isArray(entries)) return;
    const contenders = entries.map(readPresence).filter(Boolean).sort((x, y) => x.sid < y.sid ? -1 : x.sid > y.sid ? 1 : 0);
    if (id === a.handle.ownId) {
      // Multiple tabs/devices may join; only the lexicographically first session publishes movement.
      const wasLeader = a.leader;
      a.leader = !contenders.length || contenders[0].sid >= a.sid;
      if (!wasLeader && a.leader) a.force = true;
      return;
    }
    const next = contenders[0], old = peers.get(id);
    if (next?.sid === old?.sid) return;
    if (next) {
      peers.set(id, { ...next, seq: 0, lastAt: -Infinity, acceptedAt: -Infinity, samples: [] });
      a.force = true; // a late join gets our latest position, with normal pacing
    } else {
      peers.delete(id);
    }
    leave(old?.latest, next ? 'session' : 'presence');
  }
  function packet(a, id, data) {
    const peer = peers.get(id);
    if (!peer) return;
    const msg = readPacket(data, limits);
    if (!msg || msg.sid !== peer.sid || msg.seq <= peer.seq) return;
    if (msg.hidden) {
      peer.seq = msg.seq;
      peer.hidden = true;
      const old = peer.latest;
      peer.latest = undefined;
      peer.samples.length = 0;
      leave(old, 'visibility');
      return;
    }
    if (peer.hidden) return; // next publication must use a new Presence session id
    const at = now();
    // Never let a burst drive render events. Compare plausibility using elapsed
    // receipt time, never browser wall clocks. First observation is not authoritative.
    if (at - peer.acceptedAt < Math.min(70, a.interval / 3)) return;
    const old = peer.latest;
    const elapsed = at - peer.lastAt;
    if (old && Math.hypot(msg.state.x - old.x, msg.state.z - old.z) >
        2 + 8 * Math.max(elapsed, a.interval) / 1000) return;
    const player = publicState(id, msg.state, peer.nickname, msg.timestamp, false);
    peer.seq = msg.seq;
    peer.lastAt = peer.acceptedAt = at;
    peer.latest = player;
    // Do not animate a glide across a long silent window followed by a new sample.
    if (elapsed > Math.max(1200, a.interval * 2.5)) peer.samples.length = 0;
    peer.samples.push({ at, player });
    if (peer.samples.length > 12) peer.samples.shift();
    if (!old) emit('join', { player });
    else if (movementChanged(player, old)) emit('update', { player });
  }
  function refreshSelf(a, emitUpdate = false) {
    const previous = publishedLocal;
    if (!visible || !a.tracked || !local) {
      publishedLocal = undefined;
      leave(previous, 'visibility');
      return;
    }
    if (!previous || emitUpdate) {
      publishedLocal = publicState(a.handle.ownId, local, nickname, wallNow(), true);
      if (!previous) emit('join', { player: publishedLocal });
      else if (movementChanged(local, previous)) emit('update', { player: publishedLocal });
    }
  }
  function syncVisibility(i, a) {
    const change = a.writes.then(async () => {
      if (intent !== i || i.attempt !== a || !a.handle) return;
      if (visible && !a.tracked) {
        if (a.hasTracked) {
          a.sid = newSessionId();
          a.seq = 0;
          a.lastSent = undefined;
        }
        await a.handle.track({ v: PROTOCOL_VERSION, frame: FRAME_ID, sid: a.sid, nickname });
        if (intent !== i || i.attempt !== a) return;
        a.tracked = a.hasTracked = true;
        a.force = true;
      } else if (!visible && a.tracked) {
        a.tracked = false; // stop sending before awaiting the leave
        refreshSelf(a);
        try {
          if (a.leader && a.lastSent) await a.handle.send({
            v: PROTOCOL_VERSION, frame: FRAME_ID, sid: a.sid, seq: ++a.seq,
            timestamp: wallNow(), hidden: true,
          });
        } finally {
          await a.handle.untrack();
        }
      }
      if (intent === i && i.attempt === a) refreshSelf(a);
    });
    a.writes = change.catch(error => retry(i, a, error));
    return change;
  }
  function pulse(i, a) {
    if (intent !== i || i.attempt !== a || connection.status !== 'connected') return;
    const at = now();
    for (const peer of peers.values()) {
      if (!peer.latest || at - peer.lastAt <= STALE_MS) continue;
      const old = peer.latest;
      peer.latest = undefined;
      peer.samples.length = 0;
      leave(old, 'timeout');
    }
    if (intent !== i || i.attempt !== a) return;
    const gap = at - a.sentAt;
    const idle = Math.max(a.interval, background ? BACKGROUND_MS : IDLE_MS);
    if (visible && a.tracked && local && a.leader && !a.sending && gap >= a.interval &&
      (gap >= idle || (!background && (a.force || movementChanged(local, a.lastSent))))) {
      const state = background && a.lastSent ?
        { ...a.lastSent, speed: 0, motion: 'idle' } : local;
      a.force = false;
      a.sentAt = at;
      a.lastSent = state;
      a.sending = true;
      const msg = { v: PROTOCOL_VERSION, frame: FRAME_ID, sid: a.sid, seq: ++a.seq, timestamp: wallNow(), state };
      Promise.resolve().then(() => {
        if (intent === i && i.attempt === a && visible && a.tracked) return a.handle.send(msg);
      }).catch(error => retry(i, a, error)).finally(() => { a.sending = false; });
      refreshSelf(a, true);
    } else if (!publishedLocal && a.tracked) {
      refreshSelf(a);
    }
    if (intent === i && i.attempt === a) pulseTimer = schedule(() => pulse(i, a), 25);
  }
  async function dial(i) {
    if (intent !== i) return;
    const a = { abort: new AbortController(), sid: newSessionId(), handle: null, seq: 0,
      sentAt: -Infinity, tracked: false, writes: Promise.resolve(), force: false, leader: true, interval: 125 };
    i.attempt = a;
    const current = () => intent === i && i.attempt === a;
    try {
      await retirement;
      if (!current()) return;
      const handle = await transport.open(i.room, {
        signal: a.abort.signal,
        onPresence: (...args) => { if (current()) presence(a, ...args); },
        onPacket: (...args) => { if (current()) packet(a, ...args); },
        onLost: error => retry(i, a, error),
      });
      if (!current()) { await handle.close(); return; }
      a.handle = handle;
      a.interval = sendInterval(handle.capacity);
      if (typeof handle.ownId !== 'string' || !ALIAS.test(handle.ownId))
        throw Object.assign(new Error('房间未提供玩家标识'), { permanent: true });
      await syncVisibility(i, a);
      if (!current()) return;
      i.failures = 0;
      // Resolve only after subscriptions and the first Presence operation succeed.
      status('connected');
      if (!current()) return;
      handle.activate();
      if (!current()) return;
      i.resolve();
      pulse(i, a);
    } catch (error) {
      retry(i, a, error);
    }
  }
  async function disconnect() {
    const old = intent;
    if (!old && connection.status === 'disconnected') return retirement;
    intent = undefined;
    cancel(old?.retry);
    cancel(pulseTimer);
    if (old?.attempt) retire(old.attempt);
    old?.reject(Object.assign(new Error('已取消房间连接'), { name: 'AbortError' }));
    clearRoster('disconnect');
    if (!intent) status('disconnected');
    await retirement;
  }
  function samplePeer(peer, { mode = 'display', time = now() } = {}) {
    if (!peer?.latest || mode === 'network') return peer?.latest ?? null;
    const interval = intent.attempt.interval;
    return interpolate(peer.samples, time - Math.min(6000, interval + 40));
  }
  function getPlayer(id, opts) {
      if (connection.status !== 'connected' || !intent?.attempt) return null;
      if (id === connection.playerId)
        return publishedLocal ? (opts?.mode === 'network' ? publishedLocal :
          publicState(id, local, nickname, publishedLocal.timestamp, true)) : null;
      return samplePeer(peers.get(id), opts);
    }
  return Object.freeze({
    connect(room) {
      if (disposed) return Promise.reject(new Error('多人客户端已销毁'));
      if (typeof room !== 'string' || !ROOM.test(room)) return Promise.reject(new TypeError('房间编号格式无效'));
      if (intent?.room === room) return intent.promise;
      if (intent) void disconnect();
      let resolve, reject;
      const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
      const i = { room, promise, resolve, reject, failures: 0 };
      intent = i;
      status('connecting');
      void dial(i);
      return promise;
    },
    disconnect,
    async destroy() {
      disposed = true;
      await disconnect();
      for (const set of listeners.values()) set.clear();
    },
    setNickname(value) {
      if (intent || disposed) return false;
      nickname = nicknameOf(value);
      return true;
    },
    async setVisible(value) {
      visible = Boolean(value);
      const i = intent, a = i?.attempt;
      if (!visible && publishedLocal) {
        const old = publishedLocal;
        publishedLocal = undefined;
        leave(old, 'visibility');
      }
      if (a?.handle) await syncVisibility(i, a);
    },
    setBackground(value) {
      if (background && !value && intent?.attempt) intent.attempt.force = true;
      background = Boolean(value);
    },
    updateLocalPlayer(state) {
      if (disposed || !state || typeof state !== 'object') return false;
      const next = readState({ ...local, ...state }, limits, true);
      if (!next) return false;
      local = next;
      return true;
    },
    getConnection: () => connection,
    getPlayer,
    getPlayers(opts) {
      if (connection.status !== 'connected' || !intent?.attempt) return [];
      const frame = { ...opts, time: opts?.time ?? now() };
      const own = getPlayer(connection.playerId, frame);
      const others = Array.from(peers.values(), peer => samplePeer(peer, frame)).filter(Boolean);
      return own ? [own, ...others] : others;
    },
    subscribe(event, callback) {
      if (disposed || !listeners.has(event) || typeof callback !== 'function') throw new TypeError('无效的多人事件订阅');
      listeners.get(event).add(callback);
      return () => listeners.get(event).delete(callback);
    },
  });
}
