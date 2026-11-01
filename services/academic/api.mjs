import { createCommands } from './commands.mjs';
import { createSync } from './sync.mjs';
import { assignmentView, fail, page } from './model.mjs';

export function createApi(db, dependencies) {
  const commands = createCommands(db, dependencies), sync = createSync(db);
  const { requireUser, classAccess, teacherAccess, readBody, reply } = dependencies;
  const send = (res, data, status = 200, meta = {}, state = 'Synced') =>
    reply(res, status, { state, data, error: null, meta });
  function collection(res, key, rows, query, map = row => row) {
    const { limit, after } = page(query), hasMore = rows.length > limit;
    return send(res, { [key]: rows.slice(0, limit).map(map) }, 200,
      { nextAfter: hasMore ? after + limit : null });
  }
  function classroom(req, res, query) {
    const match = /^Bearer ([0-9a-f]{96})$/.exec(req.headers.authorization || '');
    const c = match && db.prepare('SELECT id,title FROM classes WHERE screen_key=?').get(match[1]);
    if (!c) fail(401, 'SCREEN_REVOKED', '展示凭据无效');
    const { limit, after } = page(query);
    const rows = db.prepare("SELECT * FROM assignments WHERE class_id=? AND status IN ('published','revised') ORDER BY id LIMIT ? OFFSET ?").all(c.id, limit + 1, after);
    return send(res, { classId: c.id, className: c.title,
      assignments: rows.slice(0, limit).map(row => ({ id: row.id, version: row.version,
        subject: row.subject, title: row.title, details: row.details, due: row.due,
        duePrecision: row.due_precision, status: row.status, updatedAt: row.updated_at })),
      readOnly: true, containsStudentIdentity: false }, 200,
      { nextAfter: rows.length > limit ? after + limit : null });
  }
  async function handle(req, res, url) {
    const path = url.pathname, method = req.method, query = url.searchParams;
    if (path === '/api/v1/classroom' && method === 'GET') return classroom(req, res, query);
    const user = requireUser(req);
    if (path === '/api/v1/identity' && method === 'GET') return send(res, sync.identity(user));
    if (path === '/api/v1/sync' && method === 'GET') {
      const data = sync.pull(user, query);
      return send(res, data, 200, {}, data.hasMore ? 'Pending' : 'Synced');
    }
    const { limit, after } = page(query);
    let match = /^\/api\/v1\/classes\/([\da-f-]{36})\/assignments$/.exec(path);
    if (match && method === 'POST') {
      const { data } = await readBody(req);
      const user = requireUser(req);
      const result = commands.create(match[1], user, data, req.headers['idempotency-key']);
      return send(res, result.data, result.status);
    }
    if (match && method === 'GET') {
      classAccess(match[1], user);
      const filter = user.role === 'student' ? " AND status IN ('published','revised','retracted')" : '';
      const rows = db.prepare(`SELECT * FROM assignments WHERE class_id=?${filter} ORDER BY id LIMIT ? OFFSET ?`).all(match[1], limit + 1, after);
      return collection(res, 'assignments', rows, query, assignmentView);
    }
    match = /^\/api\/v1\/classes\/([\da-f-]{36})\/members\/([\da-f-]{36})\/revoke$/.exec(path);
    if (match && method === 'POST') {
      const { data } = await readBody(req);
      const user = requireUser(req);
      const result = commands.revoke(match[1], match[2], user, data, req.headers['idempotency-key']);
      return send(res, result.data, result.status);
    }
    match = /^\/api\/v1\/assignments\/([\da-f-]{36})(?:\/(review|publish|retract|history|acknowledge|acknowledgements))?$/.exec(path);
    if (!match) fail(404, 'NOT_FOUND', '没有该接口');
    const [, id, action] = match;
    if ((method === 'PATCH' && !action) || (method === 'POST' && ['review', 'publish', 'retract', 'acknowledge'].includes(action))) {
      const { data } = await readBody(req), key = req.headers['idempotency-key'];
      const user = requireUser(req);
      const result = action === 'acknowledge' ? commands.acknowledge(id, user, data, key) :
        commands.update(id, user, data, action || 'edit', key);
      return send(res, result.data, result.status);
    }
    const row = commands.authorized(id, user);
    if (!action && method === 'GET') return send(res, { assignment: assignmentView(row) });
    if (action === 'history' && method === 'GET') {
      const filter = user.role === 'student' ? " AND json_extract(snapshot,'$.status') IN ('published','revised','retracted')" : '';
      const rows = db.prepare(`SELECT * FROM assignment_revisions WHERE assignment_id=?${filter} ORDER BY version LIMIT ? OFFSET ?`).all(id, limit + 1, after);
      return collection(res, 'revisions', rows, query, item => ({ version: item.version, actorId: item.actor_id,
        operation: item.operation, occurredAt: item.occurred_at, changedFields: JSON.parse(item.changed_fields), assignment: JSON.parse(item.snapshot) }));
    }
    if (action === 'acknowledgements' && method === 'GET') {
      teacherAccess(row.class_id, user);
      const rows = db.prepare('SELECT user_id AS userId,version,viewed_at AS viewedAt FROM version_acknowledgements WHERE assignment_id=? ORDER BY user_id,version LIMIT ? OFFSET ?').all(id, limit + 1, after);
      return collection(res, 'acknowledgements', rows, query);
    }
    fail(404, 'NOT_FOUND', '没有该接口');
  }
  return { handle, commands, send };
}

export function apiFailure(error) {
  const busy = error.errcode === 5 || error.errcode === 6 || /database is (locked|busy)/i.test(error.message);
  const status = busy ? 503 : error.status || 500;
  const state = error.state || (status === 401 || status === 403 ? 'Revoked' : status === 409 ? 'Conflict' : 'Failed');
  return { status, body: { state, data: null, error: {
    code: busy ? 'DATABASE_BUSY' : status === 500 ? 'INTERNAL_ERROR' : error.code || `HTTP_${status}`,
    message: busy ? '数据库繁忙，请使用相同请求标识重试' : status === 500 ? '内部错误' : error.message,
    ...(error.currentVersion ? { currentVersion: error.currentVersion } : {}),
    ...(error.resyncRequired ? { resyncRequired: true } : {}),
    ...(error.authorizedClassIds ? { authorizedClassIds: error.authorizedClassIds } : {}),
  }, meta: {} } };
}
