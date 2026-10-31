import { createHash, randomUUID } from 'node:crypto';
import { assignmentView, canonical, content, expectedVersion, fail, FIELDS, onlyFields, PUBLIC_STATES } from './model.mjs';
import { transaction } from './migrate.mjs';

export function createCommands(db, { teacherAccess, classAccess, audit }) {
  const find = id => db.prepare('SELECT * FROM assignments WHERE id=?').get(id);
  function authorized(id, user, write = false) {
    const row = find(id);
    if (!row) fail(404, 'NOT_FOUND', '作业不存在');
    (write ? teacherAccess : classAccess)(row.class_id, user);
    if (!write && user.role === 'student' && !PUBLIC_STATES.includes(row.status))
      fail(404, 'NOT_FOUND', '作业不存在');
    return row;
  }

  function receipt(user, route, key, input, permission, operation, status = 200) {
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(key))
      fail(400, 'IDEMPOTENCY_KEY_REQUIRED', '需要有效 Idempotency-Key');
    const digest = createHash('sha256').update(canonical(input)).digest('hex');
    return transaction(db, () => {
      permission();
      const previous = db.prepare('SELECT * FROM command_receipts WHERE user_id=? AND route=? AND key=?').get(user.id, route, key);
      if (previous) {
        if (previous.request_hash !== digest) fail(409, 'IDEMPOTENCY_CONFLICT', '同一请求标识的内容发生变化');
        return { status: previous.status, data: { ...JSON.parse(previous.result), replayed: true } };
      }
      const result = operation();
      db.prepare('INSERT INTO command_receipts VALUES (?,?,?,?,?,?)').run(user.id, route, key, digest, JSON.stringify(result), status);
      return { status, data: { ...result, replayed: false } };
    });
  }

  function record(row, user, operation, previous, key) {
    const assignment = assignmentView(row);
    const changed = [...FIELDS, 'status'].filter(field => previous?.[field] !== assignment[field]);
    db.prepare('INSERT INTO assignment_revisions VALUES (?,?,?,?,?,?,?)').run(
      row.id, row.version, user.id, operation, row.updated_at, JSON.stringify(changed), JSON.stringify(assignment));
    if (PUBLIC_STATES.includes(row.status))
      db.prepare('INSERT INTO sync_events(type,class_id,resource_id,version,occurred_at,snapshot,command_key) VALUES (?,?,?,?,?,?,?)').run(
        'assignment.' + row.status, row.class_id, row.id, row.version, row.updated_at, JSON.stringify(assignment), key || null);
    audit(user.id, 'assignment.' + operation, row.id);
    return assignment;
  }

  function insert(classId, user, input, status, source, key) {
    const id = randomUUID(), now = new Date().toISOString(), fields = content(input);
    db.prepare(`INSERT INTO assignments(id,class_id,subject,title,due,details,source_id,created_by,created_at,
      version,status,due_precision,updated_at,source_kind) VALUES (?,?,?,?,?,?,?,?,?,1,?,?,?,?)`).run(
      id, classId, fields.subject, fields.title, fields.due, fields.details, source.id || null,
      user.id, now, status, fields.duePrecision, now, source.kind);
    return record(find(id), user, status === 'draft' ? 'create' : 'legacy.publish', null, key);
  }

  function create(classId, user, input, key) {
    onlyFields(input, FIELDS);
    return receipt(user, `create:${classId}`, key, input, () => teacherAccess(classId, user),
      () => ({ assignment: insert(classId, user, input, 'draft', { kind: 'manual' }, key) }), 201);
  }

  function update(id, user, input, operation, key) {
    onlyFields(input, operation === 'edit' ? [...FIELDS, 'expectedVersion'] : ['expectedVersion']);
    expectedVersion(input);
    if (operation === 'edit' && !FIELDS.some(field => Object.hasOwn(input, field)))
      fail(400, 'EMPTY_EDIT', '请提供需要修改的字段');
    return receipt(user, `${operation}:${id}`, key, input, () => authorized(id, user, true), () => {
      const row = authorized(id, user, true), previous = assignmentView(row);
      if (row.version !== input.expectedVersion)
        fail(409, 'VERSION_CONFLICT', '作业已有新版本，请重新核对', { currentVersion: row.version });
      const status = nextStatus(row.status, operation);
      const fields = content(Object.fromEntries(FIELDS.filter(field => Object.hasOwn(input, field)).map(field => [field, input[field]])), previous);
      const changed = db.prepare(`UPDATE assignments SET subject=?,title=?,details=?,due=?,due_precision=?,
        version=version+1,status=?,updated_at=? WHERE id=? AND version=?`).run(
        fields.subject, fields.title, fields.details, fields.due, fields.duePrecision,
        status, new Date().toISOString(), id, input.expectedVersion);
      if (changed.changes !== 1) fail(409, 'VERSION_CONFLICT', '版本冲突');
      return { assignment: record(find(id), user, operation, previous, key) };
    });
  }

  function acknowledge(id, user, input, key) {
    onlyFields(input, ['version']);
    if (user.role !== 'student') fail(403, 'FORBIDDEN', '仅学生可报告已查看');
    if (!Number.isSafeInteger(input.version) || input.version < 1) fail(400, 'INVALID_VERSION', '需要明确作业版本');
    return receipt(user, `acknowledge:${id}`, key, input, () => authorized(id, user), () => {
      const revision = db.prepare('SELECT snapshot FROM assignment_revisions WHERE assignment_id=? AND version=?').get(id, input.version);
      if (!revision || !PUBLIC_STATES.includes(JSON.parse(revision.snapshot).status))
        fail(400, 'INVALID_VERSION', '不是可查看的公开版本');
      db.prepare('INSERT OR IGNORE INTO version_acknowledgements VALUES (?,?,?,?)').run(id, user.id, input.version, new Date().toISOString());
      return { viewed: true, version: input.version, verifiedSubmission: false };
    });
  }

  function legacyPublish(classId, user, input, sourceId, key) {
    const fields = { subject: input.subject, title: input.title, details: input.details ?? '',
      due: input.due || null, duePrecision: input.due ? 'date' : 'none' };
    return receipt(user, `legacy.publish:${classId}:${sourceId || ''}`, key || randomUUID(), fields,
      () => teacherAccess(classId, user), () => {
        if (sourceId) {
          const old = db.prepare('SELECT * FROM assignments WHERE source_id=?').get(sourceId);
          if (old) return { assignment: assignmentView(old) };
          const item = db.prepare("SELECT id FROM intake WHERE id=? AND class_id=? AND status='pending'").get(sourceId, classId);
          if (!item) fail(404, 'NOT_FOUND', '没有该待审消息');
        }
        const assignment = insert(classId, user, fields, 'published', { kind: sourceId ? 'qq' : 'manual', id: sourceId }, key);
        if (sourceId) db.prepare("UPDATE intake SET status='published' WHERE id=?").run(sourceId);
        return { assignment };
      }, 201).data.assignment;
  }

  function revoke(classId, userId, user, input, key) {
    onlyFields(input, []);
    return receipt(user, `revoke:${classId}:${userId}`, key, input, () => teacherAccess(classId, user), () => {
      const change = db.prepare("UPDATE memberships SET status='rejected' WHERE class_id=? AND user_id=?").run(classId, userId);
      if (!change.changes) fail(404, 'NOT_FOUND', '成员不存在');
      audit(user.id, 'membership.revoke', userId);
      return { revoked: true };
    });
  }
  return { authorized, create, update, acknowledge, legacyPublish, revoke };
}

function nextStatus(status, operation) {
  if (status === 'retracted') fail(409, 'INVALID_TRANSITION', '已撤回作业不能自动重新发布');
  if (operation === 'edit') return status === 'review' ? 'draft' : status === 'draft' ? 'draft' : 'revised';
  const rules = { review: ['draft', 'review'], publish: ['review', 'published'] };
  if (operation === 'retract' && ['published', 'revised'].includes(status)) return 'retracted';
  if (rules[operation]?.[0] === status) return rules[operation][1];
  fail(409, 'INVALID_TRANSITION', '当前作业状态不允许此操作');
}
