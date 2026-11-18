export const PROTOCOL_VERSION = 1;
export const FRAME_ID = 'haiz-campus-v1';
export const ALIAS = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
export const ROOM = /^[a-z0-9][a-z0-9-]{0,31}$/;
export const MOTIONS = new Set(['idle', 'walk', 'run', 'jump']);
const TAU = Math.PI * 2;
const quantize = (x, step) => Math.round(x * step) / step;
export const wrapYaw = x => Math.atan2(Math.sin(x), Math.cos(x));

// 75 billable Broadcast deliveries/s at full room occupancy, below Free's
// project-wide 100 messages/s. All clients use the same provisioned capacity.
export function sendInterval(capacity) {
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 20) throw new Error('无效的房间容量');
  return Math.ceil(Math.max(125, 1000 * capacity ** 2 / 75));
}

export function nicknameOf(value) {
  if (typeof value !== 'string') return '访客';
  const clean = value.slice(0, 128).normalize('NFC').replace(/[\p{Cc}\p{Cf}]/gu, '').trim();
  return Array.from(clean).slice(0, 20).join('') || '访客';
}

export function readState(s, bounds, round = false) {
  if (!s || !MOTIONS.has(s.motion)) return null;
  const { x, y, z, yaw, speed, motion } = s;
  if (![x, y, z, yaw, speed].every(Number.isFinite) ||
    x < bounds.x0 || x > bounds.x1 || z < bounds.z0 || z > bounds.z1 ||
    y < bounds.y0 || y > bounds.y1 || Math.abs(yaw) > (round ? 1e9 : TAU) ||
    speed < 0 || speed > 8) return null;
  return round ? {
    x: quantize(x, 100), y: quantize(y, 100), z: quantize(z, 100),
    yaw: quantize(wrapYaw(yaw), 1000), speed: quantize(speed, 100), motion,
  } : { x, y, z, yaw: wrapYaw(yaw), speed, motion };
}

export function movementChanged(a, b) {
  return !b || a.motion !== b.motion || Math.abs(a.speed - b.speed) >= 0.12 ||
    Math.abs(wrapYaw(a.yaw - b.yaw)) >= 0.025 ||
    Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) >= 0.025;
}

export function readPresence(raw) {
  if (!raw || raw.v !== PROTOCOL_VERSION || raw.frame !== FRAME_ID ||
      typeof raw.sid !== 'string' || !ALIAS.test(raw.sid) ||
      typeof raw.nickname !== 'string') return null;
  return { sid: raw.sid, nickname: nicknameOf(raw.nickname) };
}

export function readPacket(raw, bounds) {
  if (!raw || raw.v !== PROTOCOL_VERSION || raw.frame !== FRAME_ID ||
      typeof raw.sid !== 'string' || !ALIAS.test(raw.sid) ||
      !Number.isSafeInteger(raw.seq) || raw.seq < 1 ||
      !Number.isSafeInteger(raw.timestamp) || raw.timestamp < 0) return null;
  if (raw.hidden === true && raw.state === undefined) return { sid: raw.sid, seq: raw.seq, hidden: true };
  const state = readState(raw.state, bounds);
  return state && { state, sid: raw.sid, seq: raw.seq, timestamp: raw.timestamp };
}
