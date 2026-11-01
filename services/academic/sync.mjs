import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { fail, page } from './model.mjs';

export function createSync(db) {
  const meta = key => db.prepare('SELECT value FROM academic_meta WHERE key=?').get(key).value;
  const instanceId = meta('instanceId'), secret = meta('cursorSecret');
  const sign = value => createHmac('sha256', secret).update(value).digest('base64url');
  const encode = value => {
    const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
    return payload + '.' + sign(payload);
  };
  function scopes(user) {
    const sql = user.role === 'admin' ? 'SELECT id FROM classes ORDER BY id' :
      user.role === 'teacher' ? 'SELECT id FROM classes WHERE teacher_id=? ORDER BY id' :
        "SELECT class_id AS id FROM memberships WHERE user_id=? AND status='active' ORDER BY class_id";
    return db.prepare(sql).all(...(user.role === 'admin' ? [] : [user.id])).map(row => row.id);
  }
  function identity(user) {
    const authorizedClassIds = scopes(user);
    return { userId: user.id, instanceId, role: user.role, authorizedClassIds,
      cacheScope: `haiz/v1/${instanceId}/${user.id}` };
  }
  function fingerprint(user, ids) {
    const epoch = db.prepare('SELECT epoch FROM permission_epochs WHERE user_id=?').get(user.id)?.epoch || 0;
    return createHash('sha256').update(JSON.stringify([user.role, epoch, ids])).digest('hex');
  }
  function decode(cursor, user, scope) {
    if (typeof cursor !== 'string' || cursor.length > 2000) fail(400, 'INVALID_CURSOR', '游标格式无效');
    const [payload, signature, ...extra] = cursor.split('.'), expected = sign(payload || '');
    if (extra.length || !/^[A-Za-z0-9_-]{43}$/.test(signature || '') ||
        Buffer.byteLength(signature) !== Buffer.byteLength(expected) ||
        !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) fail(400, 'INVALID_CURSOR', '游标签名无效');
    let value;
    try { value = JSON.parse(Buffer.from(payload, 'base64url').toString()); }
    catch { fail(400, 'INVALID_CURSOR', '游标格式无效'); }
    if (!value || value.instanceId !== instanceId || value.userId !== user.id || value.scope !== scope)
      fail(409, 'SCOPE_CHANGED', '身份或班级权限已变化，请重新同步', { resyncRequired: true, authorizedClassIds: scopes(user), state: 'Revoked' });
    if (!['snapshot', 'delta'].includes(value.mode) || !Number.isSafeInteger(value.position) || value.position < 0 ||
        (value.mode === 'snapshot' && (!Number.isSafeInteger(value.high) || value.high < value.position)))
      fail(400, 'INVALID_CURSOR', '游标位置无效');
    const floor = Number(meta('eventFloor'));
    if ((value.mode === 'snapshot' ? value.high : value.position) < floor)
      fail(410, 'CURSOR_EXPIRED', '游标已过期，请重新同步', { resyncRequired: true });
    return value;
  }
  function pull(user, query) {
    const { limit } = page(query), ids = scopes(user), scope = fingerprint(user, ids);
    const high = db.prepare('SELECT COALESCE(MAX(sequence),0) AS n FROM sync_events').get().n;
    const base = { instanceId, userId: user.id, scope };
    const cursor = query.has('cursor') ? decode(query.get('cursor'), user, scope) :
      { ...base, mode: 'snapshot', position: 0, high };
    if (cursor.position > high) fail(410, 'CURSOR_EXPIRED', '游标不属于当前数据时间线', { resyncRequired: true });
    const predicate = ids.length ? `class_id IN (${ids.map(() => '?').join(',')})` : '0';
    const snapshot = cursor.mode === 'snapshot';
    const rows = snapshot ? db.prepare(`SELECT * FROM sync_events WHERE sequence IN
      (SELECT MAX(sequence) FROM sync_events WHERE sequence<=? AND ${predicate} GROUP BY resource_id)
      AND sequence>? ORDER BY sequence LIMIT ?`).all(cursor.high, ...ids, cursor.position, limit + 1) :
      db.prepare(`SELECT * FROM sync_events WHERE sequence>? AND sequence<=? AND ${predicate} ORDER BY sequence LIMIT ?`)
        .all(cursor.position, high, ...ids, limit + 1);
    const hasMore = rows.length > limit, selected = rows.slice(0, limit);
    const next = hasMore ? { ...cursor, position: selected.at(-1).sequence } :
      { ...base, mode: 'delta', position: snapshot ? cursor.high : high };
    const common = { instanceId, userId: user.id, authorizedClassIds: ids, mode: cursor.mode,
      cursor: encode(next), hasMore };
    return snapshot ? { ...common, assignments: selected.map(row => JSON.parse(row.snapshot)) } :
      { ...common, events: selected.map(row => ({ sequence: row.sequence, type: row.type,
        resourceId: row.resource_id, version: row.version, occurredAt: row.occurred_at,
        scope: { classId: row.class_id }, assignment: JSON.parse(row.snapshot) })) };
  }
  return { identity, pull };
}
