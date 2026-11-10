import { randomUUID } from 'node:crypto';
import { check, text } from '../errors.mjs';
import { rateLimiter } from '../auth.mjs';

const MAX_QUEUE_BYTES = 65536;
const HEARTBEAT_MS = 15000;
const MAX_TIMEOUT_MS = 2147483647;
const encoder = new TextEncoder();

export function createCloudRooms(database) {
  const rooms = new Map(), members = new Map(), limits = rateLimiter();
  let sequence = 0, heartbeatTimer = null, heartbeatRunning = false, closed = false;
  const publicMember = member => ({ connectionId: member.id, name: member.who.name, position: member.position });
  const authorized = (who, room) => check(typeof room === 'string' &&
    (room === 'campus' || (room.startsWith('class:') && who?.scopes?.includes(room.slice(6)))), 403, '无权进入该房间');
  const validAuth = auth => check(auth?.identity?.id && typeof auth.sessionId === 'string' &&
    Number.isFinite(auth.expiresAt) && auth.expiresAt > Date.now(), 401, '会话已失效');

  function leave(member) {
    if (!members.delete(member.id)) return;
    clearTimeout(member.expiryTimer);
    member.request.signal.removeEventListener('abort', member.onAbort);
    const room = rooms.get(member.room);
    room?.delete(member.id);
    try { member.controller.close(); } catch { /* Cancellation has already closed the stream. */ }
    if (!room?.size) rooms.delete(member.room);
    else broadcast(member.room, 'presence', { kind: 'left', member: publicMember(member) });
    if (!members.size) {
      clearTimeout(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function enqueue(member, frame) {
    if (!members.has(member.id)) return;
    if (Date.now() >= member.expiresAt) { leave(member); return; }
    const chunk = encoder.encode(frame);
    // The Web stream's queue is measured in bytes, including multibyte text.
    // Never enqueue the frame that would cross the bound.
    if (member.controller.desiredSize === null || chunk.byteLength > member.controller.desiredSize) {
      leave(member); return;
    }
    try { member.controller.enqueue(chunk); } catch { leave(member); }
  }

  function send(member, event, data) {
    enqueue(member, `id: ${++sequence}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  function broadcast(room, event, data) {
    for (const member of [...(rooms.get(room)?.values() || [])]) send(member, event, data);
  }

  function scheduleExpiry(member) {
    clearTimeout(member.expiryTimer);
    const remaining = member.expiresAt - Date.now();
    if (remaining <= 0) { leave(member); return; }
    member.expiryTimer = setTimeout(() => {
      if (members.has(member.id)) scheduleExpiry(member);
    }, Math.min(MAX_TIMEOUT_MS, remaining));
    member.expiryTimer.unref?.();
  }

  function scheduleHeartbeat() {
    if (closed || !members.size || heartbeatTimer !== null || heartbeatRunning) return;
    heartbeatTimer = setTimeout(heartbeat, HEARTBEAT_MS);
    heartbeatTimer.unref?.();
  }

  async function heartbeat() {
    heartbeatTimer = null;
    heartbeatRunning = true;
    limits.clean();
    try {
      for (const member of [...members.values()]) {
        if (!members.has(member.id)) continue;
        if (Date.now() >= member.expiresAt) { leave(member); continue; }
        try {
          const current = await database.call('authenticate', { tokenHash: member.tokenHash });
          if (!members.has(member.id)) continue;
          validAuth(current);
          check(current.sessionId === member.sessionId && current.identity.id === member.who.id, 401, '会话已失效');
          authorized(current.identity, member.room);
          if (current.expiresAt < member.expiresAt) {
            member.expiresAt = current.expiresAt;
            scheduleExpiry(member);
          }
          enqueue(member, ': heartbeat\n\n');
        } catch { leave(member); }
      }
    } finally {
      heartbeatRunning = false;
      scheduleHeartbeat();
    }
  }

  return {
    join(request, auth, room) {
      check(!closed, 503, '房间服务已停止');
      validAuth(auth);
      authorized(auth.identity, room);
      check(typeof auth.tokenHash === 'string' && auth.tokenHash.length > 0, 401, '会话已失效');
      check(!request.signal.aborted, 499, '连接已取消');
      check(members.size < 256, 429, '在线连接数已达上限');
      check((rooms.get(room)?.size || 0) < 64, 429, '房间已满');
      check([...members.values()].filter(member => member.who.id === auth.identity.id).length < 4, 429, '每个账号最多 4 个在线连接');
      const member = { id: randomUUID(), who: auth.identity, sessionId: auth.sessionId, expiresAt: auth.expiresAt,
        tokenHash: auth.tokenHash, room, request, position: null, controller: null, expiryTimer: null, onAbort: null };
      const body = new ReadableStream({
        start(controller) { member.controller = controller; },
        cancel() { leave(member); },
      }, { highWaterMark: MAX_QUEUE_BYTES, size: chunk => chunk.byteLength });
      if (!rooms.has(room)) rooms.set(room, new Map());
      rooms.get(room).set(member.id, member);
      members.set(member.id, member);
      member.onAbort = () => leave(member);
      request.signal.addEventListener('abort', member.onAbort, { once: true });
      scheduleExpiry(member);
      scheduleHeartbeat();
      enqueue(member, 'retry: 2000\n\n');
      send(member, 'snapshot', { room, connectionId: member.id, members: [...rooms.get(room).values()].map(publicMember) });
      for (const peer of [...rooms.get(room).values()]) {
        if (peer.id !== member.id) send(peer, 'presence', { kind: 'joined', member: publicMember(member) });
      }
      return new Response(body, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } });
    },

    post(auth, room, action, input) {
      validAuth(auth);
      authorized(auth.identity, room);
      const member = members.get(input?.connectionId);
      check(member && member.room === room && member.sessionId === auth.sessionId && member.who.id === auth.identity.id,
        403, '连接不属于当前会话，请重新连接');
      if (Date.now() >= member.expiresAt) { leave(member); check(false, 401, '会话已失效'); }
      check(action === 'position' || action === 'messages', 404, '接口不存在');
      if (action === 'position') {
        limits.take('position:' + auth.sessionId, 15, 1000);
        check(['x', 'z', 'yaw'].every(key => typeof input[key] === 'number' && Number.isFinite(input[key])), 400, '位置无效');
        check(Math.abs(input.x) <= 10000 && Math.abs(input.z) <= 10000 && Math.abs(input.yaw) <= 1000, 400, '位置超出范围');
        member.position = { x: input.x, z: input.z, yaw: input.yaw };
        broadcast(room, 'position', { connectionId: member.id, position: member.position });
      } else {
        limits.take('message:' + auth.sessionId, 10, 10000);
        broadcast(room, 'message', { id: randomUUID(), name: member.who.name, connectionId: member.id,
          text: text(input.text, 500, true), at: new Date().toISOString() });
      }
      return { ok: true };
    },

    closeSession(id) { for (const member of [...members.values()]) if (member.sessionId === id) leave(member); },
    closeUser(id) { for (const member of [...members.values()]) if (member.who.id === id) leave(member); },
    get metrics() { return { rooms: rooms.size, connections: members.size }; },
    close() {
      closed = true;
      clearTimeout(heartbeatTimer);
      heartbeatTimer = null;
      for (const member of [...members.values()]) leave(member);
    },
  };
}
