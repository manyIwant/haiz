import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { check, fail, text, revision, date, username } from './errors.mjs';

const identity = row => ({ id: row.id, name: row.name, role: row.role, scope: row.scope, scopes: JSON.parse(row.scopes) });
const parse = row => row ? JSON.parse(row.data) : null;
export function createRepository(directory) {
  mkdirSync(directory, { recursive: true, mode: 0o700 }); chmodSync(directory, 0o700);
  const file = join(directory, 'haiz.sqlite');
  const db = new DatabaseSync(file); chmodSync(file, 0o600);
  const schemaVersion = db.prepare('PRAGMA user_version').get().user_version;
  if (schemaVersion > 2) { db.close(); throw Error('数据库版本高于当前服务，请使用匹配版本'); }
  db.exec(`PRAGMA busy_timeout=3000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
    BEGIN IMMEDIATE;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, password_hash TEXT,
      role TEXT NOT NULL CHECK(role IN ('student','teacher','display','admin')), scope TEXT NOT NULL, scopes TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS invites(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY, kind TEXT NOT NULL, owner TEXT NOT NULL REFERENCES users(id), scope TEXT NOT NULL, revision INTEGER NOT NULL, state TEXT, starts_at TEXT, expires_at TEXT, data TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS records_owner ON records(owner,kind,id);
    CREATE INDEX IF NOT EXISTS records_feed ON records(kind,scope,state,expires_at);
    CREATE INDEX IF NOT EXISTS records_draft_notice ON records(json_extract(data,'$.draftId'),state,expires_at) WHERE kind='notice';
    CREATE TABLE IF NOT EXISTS personal_data(owner TEXT NOT NULL REFERENCES users(id), collection TEXT NOT NULL, id TEXT NOT NULL, revision INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(owner,collection,id));
    CREATE TABLE IF NOT EXISTS requests(owner TEXT NOT NULL REFERENCES users(id), key TEXT NOT NULL, hash TEXT NOT NULL, result TEXT NOT NULL, expires_at INTEGER NOT NULL, PRIMARY KEY(owner,key));
    CREATE INDEX IF NOT EXISTS requests_expiry ON requests(expires_at);
    CREATE TABLE IF NOT EXISTS audit(sequence INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, at TEXT NOT NULL);
    COMMIT;`);
  if (schemaVersion < 2) db.exec('BEGIN IMMEDIATE; ALTER TABLE audit ADD COLUMN revision INTEGER; PRAGMA user_version=2; COMMIT;');
  const statements = new Map();
  const stmt = sql => { if (!statements.has(sql)) statements.set(sql, db.prepare(sql)); return statements.get(sql); };
  const get = (sql, ...values) => stmt(sql).get(...values);
  const all = (sql, ...values) => stmt(sql).all(...values);
  const exec = (sql, ...values) => stmt(sql).run(...values);
  const transaction = callback => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = callback(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  const audit = (actor, action, target, version = null) => exec('INSERT INTO audit(actor,action,target,at,revision) VALUES(?,?,?,?,?)', actor, action, target, new Date().toISOString(), version);
  const userByName = name => get('SELECT * FROM users WHERE name=?', name);
  const addUser = ({ name, role = 'student', scope = 'campus', scopes = [scope], passwordHash = null }) => {
    check(!userByName(name), 409, '账号已存在');
    check(get('SELECT count(*) AS n FROM users').n < 10000, 429, '用户配额已满');
    const id = randomUUID();
    exec('INSERT INTO users VALUES(?,?,?,?,?,?,?)', id, name, passwordHash, role, scope, JSON.stringify(scopes), Date.now());
    return userByName(name);
  };
  const session = (user, tokenHash, sessionMs) => {
    exec('DELETE FROM sessions WHERE expires_at<=?', Date.now());
    check(get('SELECT count(*) AS n FROM sessions WHERE user_id=?', user.id).n < 20, 429, '当前账号会话数量已达上限');
    const id = randomUUID(), expiresAt = Date.now() + sessionMs;
    exec('INSERT INTO sessions VALUES(?,?,?,?,?)', id, tokenHash, user.id, expiresAt, Date.now());
    return { identity: identity(user), expiresAt, sessionId: id };
  };
  const item = row => ({ id: row.id, revision: row.revision, data: JSON.parse(row.data), updatedAt: row.updated_at, deleted: Boolean(row.deleted) });
  const record = id => parse(get('SELECT data FROM records WHERE id=?', id));
  const putRecord = (kind, owner, data) => exec(`INSERT INTO records VALUES(?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET scope=excluded.scope,revision=excluded.revision,state=excluded.state,starts_at=excluded.starts_at,expires_at=excluded.expires_at,data=excluded.data`,
    data.id, kind, owner, data.scope, data.revision, data.state || null, data.startsAt || null, data.expiresAt || null, JSON.stringify(data));
  const ownRecord = (who, id, kind) => { const row = get('SELECT data FROM records WHERE id=? AND owner=? AND kind=?', id, who.id, kind); check(row, 404, '内容不存在'); return parse(row); };
  const allow = (who, scope) => check(who.scopes.includes(scope), 403, '当前身份未获该班级授权');
  const quota = (who, kind, max) => check(get('SELECT count(*) AS n FROM records WHERE owner=? AND kind=?', who.id, kind).n < max, 429, '内容配额已满');

  const operations = {
    operatorInvite({ input, tokenHash, inviteMs }) {
      const admin = userByName('admin'); check(admin, 400, '请先启动后端完成初始化');
      return operations.invite({ who: identity(admin), input, tokenHash, inviteMs });
    },
    operatorRecover({ tokenHash, inviteMs }) {
      return transaction(() => {
        const admin = userByName('admin'); check(admin, 400, '管理员不存在，请先启动后端');
        exec('UPDATE users SET password_hash=NULL WHERE id=?', admin.id);
        exec('DELETE FROM sessions WHERE user_id=?', admin.id); exec('DELETE FROM invites WHERE user_id=?', admin.id);
        const expiresAt = Date.now() + inviteMs;
        exec('INSERT INTO invites VALUES(?,?,?)', tokenHash, admin.id, expiresAt);
        audit(admin.id, 'operator_recovery', admin.id); return { expiresAt, account: admin.name };
      });
    },
    bootstrap({ tokenHash, inviteMs }) {
      return transaction(() => {
        if (get('SELECT count(*) AS n FROM users').n > 0) {
          const admin = userByName('admin');
          if (admin && !admin.password_hash && !get('SELECT id FROM sessions WHERE user_id=? AND expires_at>?', admin.id, Date.now())) {
            const pending = get('SELECT token_hash FROM invites WHERE user_id=? AND expires_at>? ORDER BY expires_at DESC LIMIT 1', admin.id, Date.now());
            // Keep recovery invitations issued by a local operator while stopped.
            if (pending) return { created: pending.token_hash === tokenHash };
            if (!pending) {
              exec('DELETE FROM invites WHERE user_id=?', admin.id);
              exec('INSERT INTO invites VALUES(?,?,?)', tokenHash, admin.id, Date.now() + inviteMs);
              audit(admin.id, 'bootstrap_recovered', admin.id);
            }
            return { created: true, recovered: true };
          }
          return { created: false };
        }
        const user = addUser({ name: 'admin', role: 'admin', scope: '管理' });
        exec('INSERT INTO invites VALUES(?,?,?)', tokenHash, user.id, Date.now() + inviteMs);
        audit(user.id, 'bootstrap', user.id);
        return { created: true };
      });
    },
    credentials({ name }) { const user = userByName(name); return user ? { id: user.id, passwordHash: user.password_hash } : null; },
    register({ name, passwordHash, tokenHash, sessionMs }) {
      return transaction(() => { const user = addUser({ name, passwordHash }); audit(user.id, 'registered', user.id); return session(user, tokenHash, sessionMs); });
    },
    login({ userId, credentialHash, tokenHash, sessionMs }) {
      return transaction(() => { const user = get('SELECT * FROM users WHERE id=? AND password_hash=?', userId, credentialHash); check(user, 401, '账号或密码无效'); return session(user, tokenHash, sessionMs); });
    },
    claimInvite({ inviteHash, tokenHash, sessionMs }) {
      return transaction(() => {
        const invitation = get('SELECT * FROM invites WHERE token_hash=? AND expires_at>?', inviteHash, Date.now());
        check(invitation, 401, '邀请码无效、已使用或已过期');
        const user = get('SELECT * FROM users WHERE id=?', invitation.user_id);
        exec('DELETE FROM invites WHERE token_hash=?', inviteHash); audit(user.id, 'invite_claimed', user.id);
        return session(user, tokenHash, sessionMs);
      });
    },
    authenticate({ tokenHash }) {
      const row = get('SELECT users.*,sessions.id AS session_id,sessions.expires_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?', tokenHash, Date.now());
      check(row, 401, '会话已失效，请重新登录');
      return { identity: identity(row), sessionId: row.session_id, expiresAt: row.expires_at };
    },
    logout({ sessionId }) { exec('DELETE FROM sessions WHERE id=?', sessionId); return { ok: true }; },
    sessions({ who, sessionId }) {
      return { sessions: all('SELECT id,created_at AS createdAt,expires_at AS expiresAt FROM sessions WHERE user_id=? AND expires_at>? ORDER BY created_at DESC', who.id, Date.now()).map(s => ({ ...s, current: s.id === sessionId })) };
    },
    revokeOwn({ who, id }) {
      check(exec('DELETE FROM sessions WHERE user_id=? AND id=?', who.id, text(id, 80, true)).changes > 0, 404, '会话不存在');
      return { ok: true };
    },
    logoutAll({ who }) { exec('DELETE FROM sessions WHERE user_id=?', who.id); return { ok: true }; },
    deleteAccount({ who, expectedHash, confirm }) {
      return transaction(() => {
        check(confirm === who.name, 400, '请输入当前账号名确认注销');
        const current = userByName(who.name);
        check(current && current.password_hash && current.password_hash === expectedHash, 409, '密码已变化，请重新验证');
        check(who.role !== 'admin' || get("SELECT count(*) AS n FROM users WHERE role='admin'").n > 1, 403, '最后一个管理员不能注销');
        for (const table of ['sessions', 'invites']) exec(`DELETE FROM ${table} WHERE user_id=?`, who.id);
        for (const table of ['records', 'personal_data', 'requests']) exec(`DELETE FROM ${table} WHERE owner=?`, who.id);
        exec('DELETE FROM audit WHERE actor=?', who.id); exec('DELETE FROM users WHERE id=?', who.id);
        return { ok: true };
      });
    },
    password({ who, passwordHash, expectedHash }) {
      return transaction(() => {
        const current = get('SELECT password_hash FROM users WHERE id=?', who.id);
        check(current && current.password_hash === expectedHash, 409, '密码已更改，请重试');
        exec('UPDATE users SET password_hash=? WHERE id=?', passwordHash, who.id);
        exec('DELETE FROM sessions WHERE user_id=?', who.id);
        exec('DELETE FROM invites WHERE user_id=?', who.id);
        audit(who.id, 'password_changed', who.id); return { ok: true };
      });
    },
    invite({ who, input, tokenHash, inviteMs }) {
      return transaction(() => {
        check(who.role === 'admin', 403, '需要管理员权限');
        const name = username(input.username || input.account);
        let user = userByName(name);
        if (!user) {
          const role = input.role || 'student';
          check(['student', 'teacher', 'display', 'admin'].includes(role), 400, '身份无效');
          const scope = text(input.scope || 'campus', 80, true), scopes = input.scopes || [scope];
          check(Array.isArray(scopes) && scopes.length > 0 && scopes.length <= 30 && scopes.includes(scope), 400, '班级授权无效');
          scopes.forEach(s => text(s, 80, true));
          user = addUser({ name, role, scope, scopes: [...new Set(scopes)] });
        }
        exec('DELETE FROM invites WHERE expires_at<=?', Date.now());
        check(get('SELECT count(*) AS n FROM invites').n < 1000, 429, '待用邀请过多');
        const expiresAt = Date.now() + inviteMs;
        exec('INSERT INTO invites VALUES(?,?,?)', tokenHash, user.id, expiresAt);
        audit(who.id, 'invite_created', user.id); return { expiresAt, account: name };
      });
    },
    admin({ who }) {
      check(who.role === 'admin', 403, '需要管理员权限');
      return { accounts: all('SELECT * FROM users ORDER BY created_at LIMIT 1000').map(identity),
        sessions: all('SELECT sessions.id,users.name AS account,sessions.expires_at AS expiresAt,sessions.created_at AS createdAt FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.expires_at>? ORDER BY sessions.created_at DESC LIMIT 1000', Date.now()).map(s => ({ ...s, revoked: false })),
        events: all('SELECT * FROM audit ORDER BY sequence DESC LIMIT 50'), limits: { sessions: 20, drafts: 500, notices: 1000 }, dataPolicy: '用户隔离；仅公开经教师确认的摘要' };
    },
    revoke({ who, id }) {
      check(who.role === 'admin', 403, '需要管理员权限');
      check(exec('DELETE FROM sessions WHERE id=?', text(id, 80, true)).changes > 0, 404, '会话不存在');
      audit(who.id, 'session_revoked', id); return { ok: true };
    },
    personal({ who, method, collection, id, input, limit = 100, cursor = '' }) {
      check(['notes', 'bookmarks', 'preferences'].includes(collection), 404, '数据集合不存在');
      if (id !== undefined) check(/^[\w-]{1,100}$/.test(id), 400, '数据 ID 无效');
      if (method === 'GET') {
        if (id !== undefined) { const row = get('SELECT * FROM personal_data WHERE owner=? AND collection=? AND id=? AND deleted=0', who.id, collection, id); check(row, 404, '内容不存在'); return { item: item(row) }; }
        check(Number.isInteger(limit) && limit > 0 && limit <= 200 && /^[\w-]{0,100}$/.test(cursor), 400, '分页参数无效');
        const rows = all('SELECT * FROM personal_data WHERE owner=? AND collection=? AND deleted=0 AND id>? ORDER BY id LIMIT ?', who.id, collection, cursor, limit + 1);
        return { items: rows.slice(0, limit).map(item), nextCursor: rows.length > limit ? rows[limit - 1].id : null };
      }
      check(id !== undefined && ['PUT', 'DELETE'].includes(method), 405, '方法不支持');
      return transaction(() => {
        const old = get('SELECT * FROM personal_data WHERE owner=? AND collection=? AND id=?', who.id, collection, id);
        check((old?.revision || 0) === revision(input.expectedRevision), 409, '另一台设备已更新，请刷新', { remote: old ? item(old) : null });
        check(method !== 'DELETE' || (old && !old.deleted), 404, '内容不存在');
        if (!old) check(get('SELECT count(*) AS n FROM personal_data WHERE owner=?', who.id).n < 5000, 429, '个人数据配额已满');
        const data = method === 'DELETE' ? null : input.data;
        check(method === 'DELETE' || (data && typeof data === 'object' && !Array.isArray(data)), 400, 'data 必须是对象');
        const raw = JSON.stringify(data); check(Buffer.byteLength(raw) <= 16000, 413, '个人数据过大');
        const updatedAt = new Date().toISOString();
        exec('INSERT INTO personal_data VALUES(?,?,?,?,?,?,?) ON CONFLICT(owner,collection,id) DO UPDATE SET revision=excluded.revision,deleted=excluded.deleted,data=excluded.data,updated_at=excluded.updated_at', who.id, collection, id, (old?.revision || 0) + 1, method === 'DELETE' ? 1 : 0, raw, updatedAt);
        return { item: item(get('SELECT * FROM personal_data WHERE owner=? AND collection=? AND id=?', who.id, collection, id)) };
      });
    },
    flowRead({ who, route }) {
      if (route === 'me') return { identity: who, demo: false, serverTime: new Date().toISOString() };
      if (route === 'feed') {
        const current = new Date().toISOString();
        const notices = all("SELECT data FROM records WHERE kind='notice' AND scope=? AND state='published' AND starts_at<=? AND expires_at>? ORDER BY starts_at DESC LIMIT 1000", who.scope, current, current).map(parse).map(({ id, revision, title, summary, scope, startsAt, expiresAt, updatedAt }) => ({ id, revision, title, summary, scope, startsAt, expiresAt, updatedAt }));
        return { notices, sequence: get('SELECT coalesce(max(sequence),0) AS n FROM audit').n, bridge: { source: 'unconnected', available: false, current: '未连接', next: '未连接' }, serverTime: current };
      }
      check(who.role === 'teacher', 403, '仅教师可读自己的工作区');
      if (route === 'workspace') return { courses: all("SELECT data FROM records WHERE owner=? AND kind='course' ORDER BY id", who.id).map(parse), tasks: all("SELECT data FROM records WHERE owner=? AND kind='task' ORDER BY id", who.id).map(parse) };
      if (route === 'drafts') return { drafts: all("SELECT data FROM records WHERE owner=? AND kind='draft' ORDER BY id", who.id).map(parse), notices: all("SELECT data FROM records WHERE owner=? AND kind='notice' ORDER BY id", who.id).map(parse), audit: all('SELECT sequence AS id,action,target AS objectId,revision,at FROM audit WHERE actor=? AND revision IS NOT NULL ORDER BY sequence DESC LIMIT 500', who.id).map(event => ({ ...event, actorId: who.name })), serverTime: new Date().toISOString() };
      throw fail(404, '接口不存在');
    },
    flowWrite({ who, route, input, key, hash, sessionId }) {
      check(who.role === 'teacher', 403, '仅教师可编辑或发布内容');
      check(typeof key === 'string' && /^[\w-]{12,100}$/.test(key), 400, '需要有效的幂等键');
      return transaction(() => {
        check(get('SELECT id FROM sessions WHERE id=? AND expires_at>?', sessionId, Date.now()), 401, '会话已失效');
        const replay = get('SELECT * FROM requests WHERE owner=? AND key=? AND expires_at>?', who.id, key, Date.now());
        if (replay) { check(replay.hash === hash, 409, '同一请求键不能用于不同操作'); return JSON.parse(replay.result); }
        const stamp = new Date().toISOString(); let result, action;
        if (route === 'drafts') {
          const id = text(input.id, 80, true); check(/^[\w-]{8,80}$/.test(id), 400, '草稿 ID 无效');
          const existing = get('SELECT * FROM records WHERE id=?', id);
          check(!existing || (existing.owner === who.id && existing.kind === 'draft'), 404, '草稿不存在');
          const old = parse(existing);
          check((old?.revision || 0) === revision(input.expectedRevision), 409, '另一台设备已更新，请合并', { remote: old });
          allow(who, input.scope);
          check(!get("SELECT id FROM records WHERE kind='notice' AND state='published' AND expires_at>? AND json_extract(data,'$.draftId')=?", stamp, id), 409, '请先撤回已发布内容');
          const startsAt = date(input.startsAt), expiresAt = date(input.expiresAt);
          check(expiresAt > startsAt, 400, '失效时间须晚于生效时间');
          if (!old) quota(who, 'draft', 500);
          const d = { id, ownerId: who.name, scope: input.scope, title: text(input.title, 100, true), body: text(input.body, 8000), summary: text(input.summary, 280).replace(/\s+/g, ' '), materialNotes: text(input.materialNotes, 1500), startsAt, expiresAt,
            revision: (old?.revision || 0) + 1, updatedAt: stamp, updatedBy: who.name, sourceDevice: text(input.sourceDevice, 30), step: 'editing', visibility: 'private', cursor: Math.max(0, Math.min(8000, Number(input.cursor) || 0)) };
          putRecord('draft', who.id, d); result = { draft: d }; action = 'draft_saved';
        } else if (route === 'workspace') {
          const kind = input.kind; check(['course', 'task'].includes(kind), 400, '工作区对象无效'); allow(who, input.scope);
          const old = input.id ? ownRecord(who, text(input.id, 80, true), kind) : null;
          if (old) check(old.revision === revision(input.expectedRevision), 409, '内容已更新', { remote: old });
          else quota(who, kind, 200);
          const d = { id: old?.id || randomUUID(), ownerId: who.name, scope: input.scope, title: text(input.title, 100, true), startsAt: date(input.startsAt), period: text(input.period, 30), materialNotes: text(input.materialNotes, 1500), source: 'manual', visibility: 'private', status: input.status === 'done' ? 'done' : 'open', revision: (old?.revision || 0) + 1, updatedAt: stamp };
          putRecord(kind, who.id, d); result = { draft: d }; action = kind + '_saved';
        } else if (route === 'publish') {
          const d = ownRecord(who, text(input.id, 80, true), 'draft');
          check(d.revision === revision(input.expectedRevision), 409, '草稿版本已变化', { remote: d }); allow(who, d.scope);
          check(input.confirmed === true && input.confirmedSummary === d.summary && d.summary && d.expiresAt > stamp, 400, '请核对有效公开摘要并确认');
          check(!get("SELECT id FROM records WHERE kind='notice' AND state='published' AND expires_at>? AND json_extract(data,'$.draftId')=?", stamp, d.id), 409, '草稿已发布');
          quota(who, 'notice', 1000);
          const n = { id: randomUUID(), draftId: d.id, ownerId: who.name, scope: d.scope, title: d.title, summary: d.summary, startsAt: d.startsAt, expiresAt: d.expiresAt, revision: 1, state: 'published', updatedAt: stamp, approval: { actorId: who.name, confirmedAt: stamp, policy: 'authorized-class-teacher' } };
          putRecord('notice', who.id, n); result = { notice: n }; action = 'notice_published';
        } else if (route === 'revoke') {
          const n = ownRecord(who, text(input.id, 80, true), 'notice');
          check(n.revision === revision(input.expectedRevision), 409, '公告版本已变化'); check(n.state === 'published', 409, '公告已撤回');
          n.state = 'revoked'; n.revision++; n.updatedAt = stamp; putRecord('notice', who.id, n); result = { notice: n }; action = 'notice_revoked';
        } else throw fail(404, '接口不存在');
        audit(who.id, action, result.draft?.id || result.notice.id, result.draft?.revision || result.notice.revision);
        exec('INSERT INTO requests VALUES(?,?,?,?,?) ON CONFLICT(owner,key) DO UPDATE SET hash=excluded.hash,result=excluded.result,expires_at=excluded.expires_at', who.id, key, hash, JSON.stringify(result), Date.now() + 7 * 86400000);
        return result;
      });
    },
    metrics() { return { users: get('SELECT count(*) AS n FROM users').n, sessions: get('SELECT count(*) AS n FROM sessions WHERE expires_at>?', Date.now()).n, records: get('SELECT count(*) AS n FROM records').n, personalItems: get('SELECT count(*) AS n FROM personal_data WHERE deleted=0').n }; },
    ready() { return { ok: get('SELECT 1 AS ok').ok === 1, schemaVersion: get('PRAGMA user_version').user_version }; },
    cleanup() { return transaction(() => { for (const table of ['sessions', 'invites', 'requests']) exec(`DELETE FROM ${table} WHERE expires_at<=?`, Date.now()); exec('DELETE FROM audit WHERE sequence < (SELECT coalesce(max(sequence),0)-10000 FROM audit)'); return { ok: true }; }); },
    async backup({ destination }) { check(resolve(destination) !== resolve(file), 400, '备份不能覆盖正在使用的数据库'); await backup(db, destination); chmodSync(destination, 0o600); return { ok: true }; },
    close() { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); db.close(); return { ok: true }; },
  };
  return { run(operation, args) {
    check(Object.hasOwn(operations, operation), 500, '未知数据库操作');
    // Body uploads and password derivation may outlive the original authentication.
    // Re-check at the worker boundary immediately before any user operation runs.
    if (args.who) check(get('SELECT id FROM sessions WHERE id=? AND user_id=? AND expires_at>?', args.sessionId, args.who.id, Date.now()), 401, '会话已失效，请重新登录');
    return operations[operation](args);
  } };
}
