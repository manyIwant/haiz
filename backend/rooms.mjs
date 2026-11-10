import { randomUUID } from 'node:crypto';
import { check, text } from './errors.mjs';
import { hash, rateLimiter } from './auth.mjs';

export function createRooms(database) {
  const rooms = new Map(), members = new Map(), limits = rateLimiter(); let sequence = 0;
  const publicMember = m => ({ connectionId: m.id, name: m.who.name, position: m.position });
  const authorized = (who, room) => check(room === 'campus' || (room.startsWith('class:') && who.scopes.includes(room.slice(6))), 403, '无权进入该房间');
  function leave(member) {
    if (!members.delete(member.id)) return;
    clearTimeout(member.expiryTimer);
    const room = rooms.get(member.room); room.delete(member.id);
    member.res.end();
    if (room.size === 0) rooms.delete(member.room);
    else broadcast(member.room, 'presence', { kind: 'left', member: publicMember(member) });
  }
  function send(member, event, data) {
    if (member.res.destroyed || member.res.writableLength > 65536) { leave(member); return; }
    member.res.write(`id: ${++sequence}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
  function broadcast(room, event, data) { for (const member of [...(rooms.get(room)?.values() || [])]) send(member, event, data); }
  const timer = setInterval(async () => {
    limits.clean();
    for (const member of [...members.values()]) {
      try {
        if (Date.now() >= member.expiresAt) { leave(member); continue; }
        await database.call('authenticate', { tokenHash: member.tokenHash });
        if (!member.res.destroyed) member.res.write(': heartbeat\n\n');
      } catch { leave(member); }
    }
  }, 15000); timer.unref();
  return {
    join(req, res, auth, room, token) {
      authorized(auth.identity, room);
      check(auth.expiresAt > Date.now(), 401, '会话已失效');
      check(members.size < 256, 429, '在线连接数已达上限');
      check([...(rooms.get(room)?.values() || [])].length < 64, 429, '房间已满');
      check([...members.values()].filter(m => m.who.id === auth.identity.id).length < 4, 429, '每个账号最多 4 个在线连接');
      const member = { id: randomUUID(), who: auth.identity, sessionId: auth.sessionId, expiresAt: auth.expiresAt, tokenHash: hash(token), room, res, position: null };
      if (!rooms.has(room)) rooms.set(room, new Map());
      rooms.get(room).set(member.id, member); members.set(member.id, member);
      member.expiryTimer = setTimeout(() => leave(member), Math.min(2147483647, Math.max(1, member.expiresAt - Date.now())));
      member.expiryTimer.unref();
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 2000\n\n');
      send(member, 'snapshot', { room, connectionId: member.id, members: [...rooms.get(room).values()].map(publicMember) });
      for (const peer of [...rooms.get(room).values()]) if (peer.id !== member.id) send(peer, 'presence', { kind: 'joined', member: publicMember(member) });
      res.once('close', () => leave(member));
    },
    post(auth, room, route, input) {
      authorized(auth.identity, room);
      const member = members.get(input.connectionId);
      check(member && member.room === room && member.sessionId === auth.sessionId, 403, '连接不属于当前会话，请重新连接');
      if (route === 'position') {
        limits.take('position:' + auth.sessionId, 15, 1000);
        check(['x', 'z', 'yaw'].every(k => typeof input[k] === 'number' && Number.isFinite(input[k])), 400, '位置无效');
        check(Math.abs(input.x) <= 10000 && Math.abs(input.z) <= 10000 && Math.abs(input.yaw) <= 1000, 400, '位置超出范围');
        member.position = { x: input.x, z: input.z, yaw: input.yaw };
        broadcast(room, 'position', { connectionId: member.id, position: member.position });
      } else {
        limits.take('message:' + auth.sessionId, 10, 10000);
        broadcast(room, 'message', { id: randomUUID(), name: member.who.name, connectionId: member.id, text: text(input.text, 500, true), at: new Date().toISOString() });
      }
      return { ok: true };
    },
    closeSession(id) { for (const member of [...members.values()]) if (member.sessionId === id) leave(member); },
    closeUser(id) { for (const member of [...members.values()]) if (member.who.id === id) leave(member); },
    close() { clearInterval(timer); for (const member of [...members.values()]) leave(member); },
    get metrics() { return { rooms: rooms.size, connections: members.size }; },
  };
}
