/**
 * Assignment command layer for the HAIZ Teacher workspace (Mission 04 · One Publish).
 *
 * Everything here talks to the real Academic v1.4 API (`docs/architecture/API-CONTRACT.md`).
 * Two rules shape the whole file:
 *
 *   1. Nothing is "published" until the server says so. Any transport failure surfaces as an
 *      explicit unknown outcome, never as success.
 *   2. Every mutating request carries a stable Idempotency-Key, and every request against an
 *      existing assignment carries `expectedVersion`. Retrying reuses the same key, so a lost
 *      response can never create a duplicate assignment.
 */

/** Mutating routes the workspace is allowed to call. Anything else is a programming error. */
export const ROUTES = Object.freeze({
  create: classId => `/api/v1/classes/${classId}/assignments`,
  edit: id => `/api/v1/assignments/${id}`,
  review: id => `/api/v1/assignments/${id}/review`,
  publish: id => `/api/v1/assignments/${id}/publish`,
  retract: id => `/api/v1/assignments/${id}/retract`,
  read: id => `/api/v1/assignments/${id}`,
  history: id => `/api/v1/assignments/${id}/history`,
  list: classId => `/api/v1/classes/${classId}/assignments`,
  identity: () => '/api/v1/identity',
});

/** Server lifecycle states, in the order a teacher moves through them. */
export const STATUS = Object.freeze({
  DRAFT: 'draft',
  REVIEW: 'review',
  PUBLISHED: 'published',
  REVISED: 'revised',
  RETRACTED: 'retracted',
});

/** States a student or the classroom screen can actually see. */
export const PUBLIC_STATES = Object.freeze([STATUS.PUBLISHED, STATUS.REVISED]);

/** Editable content fields, exactly the set the server accepts. */
export const CONTENT_FIELDS = Object.freeze(['subject', 'title', 'details', 'due', 'duePrecision']);

export const DUE_PRECISION = Object.freeze({ NONE: 'none', DATE: 'date', MINUTE: 'minute' });

const KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
const DEFAULT_TIMEOUT_MS = 12_000;
const MINUTE_DUE = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::00)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/;

/**
 * Raised when the server answered and rejected the command. `code` is the server's own error
 * code (VERSION_CONFLICT, INVALID_TRANSITION, …) so callers can branch without parsing prose.
 */
export class ApiError extends Error {
  constructor({ status, code, message, currentVersion = null, state = 'Failed' }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.currentVersion = currentVersion;
    this.state = state;
  }
}

/**
 * Raised when we do not know whether the server applied the command: timeout, dropped
 * connection, unparseable body. Deliberately distinct from ApiError — the UI must never render
 * an unknown outcome as either success or failure.
 */
export class UnknownOutcomeError extends Error {
  constructor(message, { cause } = {}) {
    super(message);
    this.name = 'UnknownOutcomeError';
    this.cause = cause;
  }
}

/**
 * A cryptographically random idempotency key in the server's accepted alphabet (8–100 chars).
 * `crypto` is injectable so tests can pin keys.
 */
export function newIdempotencyKey(crypto = globalThis.crypto) {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let key = '';
  for (const byte of bytes) key += KEY_ALPHABET[byte % KEY_ALPHABET.length];
  return key;
}

/** True when a string is acceptable to the server as an Idempotency-Key header. */
export function isValidIdempotencyKey(key) {
  return typeof key === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(key);
}

/**
 * Builds the create/patch body. Only fields the server accepts, and a due/precision pair that
 * always agrees — the server rejects a mismatched pair rather than guessing.
 */
export function contentBody(draft) {
  const due = draft?.due ? String(draft.due) : null;
  const duePrecision = !due ? DUE_PRECISION.NONE
    : draft?.duePrecision === DUE_PRECISION.MINUTE ? DUE_PRECISION.MINUTE
      : DUE_PRECISION.DATE;
  return {
    subject: String(draft?.subject ?? '').trim(),
    title: String(draft?.title ?? '').trim(),
    details: String(draft?.details ?? ''),
    due,
    duePrecision,
  };
}

/**
 * Client-side pre-flight so an obviously invalid draft never reaches the server and never
 * burns an idempotency key. Mirrors `model.mjs` limits; not a substitute for them.
 *
 * @returns {string[]} human-readable problems, empty when the draft may be sent
 */
export function validateDraft(draft) {
  const problems = [];
  const subject = String(draft?.subject ?? '').trim();
  const title = String(draft?.title ?? '').trim();
  const details = String(draft?.details ?? '');
  if (!subject) problems.push('请填写科目。');
  else if (subject.length > 32) problems.push('科目不能超过 32 个字。');
  if (!title) problems.push('请填写作业标题。');
  else if (title.length > 240) problems.push('标题不能超过 240 个字。');
  if (details.length > 3000) problems.push('详细要求不能超过 3000 个字。');
  const precision = draft?.duePrecision ?? (draft?.due ? 'date' : 'none');
  if (!validDue(draft?.due || null, precision)) problems.push('截止时间格式无效，请重新选择。');
  if (!draft?.classId) problems.push('请选择要发布的班级。');
  return problems;
}

/**
 * Turns the canonical due value into what a teacher reads. Pure, so the review screen, the
 * published list and the student preview never disagree.
 */
export function describeDue(assignment) {
  if (!assignment?.due) return '不设截止时间';
  const { due, duePrecision } = assignment;
  if (duePrecision === DUE_PRECISION.DATE) {
    const [year, month, day] = due.slice(0, 10).split('-');
    return `${year} 年 ${Number(month)} 月 ${Number(day)} 日`;
  }
  const parsed = new Date(due);
  if (Number.isNaN(parsed.getTime())) return String(due);
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}

/**
 * Compares a published assignment with the teacher's unsent draft so a conflict dialog can show
 * exactly what changed server-side, instead of a bare "conflict".
 *
 * @returns {{field:string,label:string,mine:string,theirs:string}[]}
 */
export function diffContent(draft, serverAssignment) {
  const labels = { subject: '科目', title: '标题', details: '详细要求', due: '截止时间' };
  const mine = contentBody(draft);
  const theirs = contentBody(serverAssignment ?? {});
  const changes = [];
  for (const field of ['subject', 'title', 'details']) {
    if (mine[field] !== theirs[field]) {
      changes.push({ field, label: labels[field], mine: mine[field] || '（空）', theirs: theirs[field] || '（空）' });
    }
  }
  if (mine.due !== theirs.due) {
    changes.push({ field: 'due', label: labels.due, mine: describeDue(mine), theirs: describeDue(theirs) });
  }
  return changes;
}

const record = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

function validDue(due, precision) {
  if (precision === 'none') return due === null;
  if (typeof due !== 'string' || !validDate(due.slice(0, 10))) return false;
  return precision === 'date' ? due.length === 10
    : precision === 'minute' && MINUTE_DUE.test(due) && Number.isFinite(Date.parse(due));
}

/** @param {unknown} value @returns {object} canonical Academic assignment */
export function validateAssignment(value) {
  const valid = record(value) && ['id', 'classId', 'createdBy'].every(key => typeof value[key] === 'string' && value[key].length > 0)
    && typeof value.subject === 'string' && value.subject.trim().length > 0 && value.subject.length <= 32
    && typeof value.title === 'string' && value.title.trim().length > 0 && value.title.length <= 240
    && typeof value.details === 'string' && value.details.length <= 3000
    && Number.isSafeInteger(value.version) && value.version > 0 && Object.values(STATUS).includes(value.status)
    && ['createdAt', 'updatedAt'].every(key => typeof value[key] === 'string' && Number.isFinite(Date.parse(value[key])))
    && validDue(value.due, value.duePrecision) && record(value.source) && typeof value.source.kind === 'string'
    && value.source.kind.length > 0 && (value.source.id === undefined || typeof value.source.id === 'string');
  if (!valid) throw new UnknownOutcomeError('服务器作业数据格式不正确，尚不能确认操作结果。');
  return value;
}

function validateEnvelope(value, ok) {
  if (!record(value) || !['Synced', 'Pending', 'Conflict', 'Revoked', 'Failed', 'Offline'].includes(value.state)
    || !record(value.meta) || (ok ? value.error !== null || !record(value.data)
      : value.data !== null || !record(value.error) || typeof value.error.code !== 'string' || typeof value.error.message !== 'string')) {
    throw new UnknownOutcomeError('服务器回应格式不正确。');
  }
}

/**
 * Creates a client bound to one origin. Cookies are never read or written here: the session is
 * an HttpOnly cookie set by Academic during login, so this app cannot lift it into storage.
 *
 * @param {{origin?:string, fetch?:typeof fetch, timeoutMs?:number, headers?:Record<string,string>}} options
 */
export function createClient(options = {}) {
  const origin = options.origin ?? '';
  const request = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const baseHeaders = options.headers ?? {};

  async function send(path, { method = 'GET', body, idempotencyKey, signal, headers: requestHeaders = {} } = {}) {
    const headers = { Accept: 'application/json', ...baseHeaders, ...requestHeaders };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    signal?.addEventListener('abort', abort, { once: true });
    let timer;
    const expired = new Promise((_, reject) => {
      timer = setTimeout(() => { abort(); reject(new UnknownOutcomeError('服务器没有在预期时间内回应。')); }, timeoutMs);
    });
    try {
      const receive = async () => {
        const response = await request(origin + path, {
          method, headers, credentials: 'same-origin', signal: controller.signal,
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const payload = await response.json();
        if (path.startsWith('/api/v1/')) validateEnvelope(payload, response.ok);
        else if (!record(payload)) throw new UnknownOutcomeError('服务器回应格式不正确。');
        if (!response.ok) throw new ApiError({
          status: response.status, code: payload.error?.code ?? `HTTP_${response.status}`,
          message: typeof payload.error === 'string' ? payload.error : payload.error?.message ?? '服务器拒绝了这次操作。',
          currentVersion: payload.error?.currentVersion ?? null, state: payload.state ?? 'Failed',
        });
        return payload;
      };
      return await Promise.race([receive(), expired]);
    } catch (error) {
      if (error instanceof ApiError || error instanceof UnknownOutcomeError) throw error;
      throw new UnknownOutcomeError('无法读取服务器的完整回应，操作结果未知。', { cause: error });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }

  return { send, origin };
}

/**
 * The One Publish command set. Each command returns the full envelope so callers can read
 * `data.assignment`, `data.replayed` and `meta` without a second round trip.
 */
export function createAssignmentCommands(client) {
  const { send } = client;
  const assignmentReply = async (path, options) => {
    const response = await send(path, options);
    validateAssignment(response.data.assignment);
    return response;
  };
  async function pages(path, field, limit, validate) {
    let after = 0;
    let items = [];
    while (true) {
      const response = await send(`${path}?limit=${encodeURIComponent(limit)}&after=${after}`);
      const rows = response.data[field];
      if (!Array.isArray(rows)) throw new UnknownOutcomeError('服务器列表数据格式不正确。');
      rows.forEach(validate);
      items = [...items, ...rows];
      const next = response.meta.nextAfter;
      if (next === null) return { ...response, data: { ...response.data, [field]: items } };
      if (!Number.isSafeInteger(next) || next <= after) throw new UnknownOutcomeError('服务器分页位置不正确。');
      after = next;
    }
  }
  function revision(value) {
    if (!record(value) || !Number.isSafeInteger(value.version) || value.version < 1
      || typeof value.actorId !== 'string' || typeof value.operation !== 'string'
      || !Number.isFinite(Date.parse(value.occurredAt)) || !Array.isArray(value.changedFields)
      || !value.changedFields.every(field => typeof field === 'string')) throw new UnknownOutcomeError('服务器历史记录格式不正确。');
    validateAssignment(value.assignment);
  }
  return {
    identity: () => send(ROUTES.identity()),
    list: (classId, { limit = 100 } = {}) => pages(ROUTES.list(classId), 'assignments', limit, validateAssignment),
    read: id => assignmentReply(ROUTES.read(id)),
    history: (id, { limit = 100 } = {}) => pages(ROUTES.history(id), 'revisions', limit, revision),

    create: (classId, draft, key) => assignmentReply(ROUTES.create(classId), {
      method: 'POST', body: contentBody(draft), idempotencyKey: key,
    }),

    edit: (id, draft, expectedVersion, key) => assignmentReply(ROUTES.edit(id), {
      method: 'PATCH',
      body: { ...contentBody(draft), expectedVersion },
      idempotencyKey: key,
    }),

    review: (id, expectedVersion, key) => assignmentReply(ROUTES.review(id), {
      method: 'POST', body: { expectedVersion }, idempotencyKey: key,
    }),

    publish: (id, expectedVersion, key) => assignmentReply(ROUTES.publish(id), {
      method: 'POST', body: { expectedVersion }, idempotencyKey: key,
    }),

    retract: (id, expectedVersion, key) => assignmentReply(ROUTES.retract(id), {
      method: 'POST', body: { expectedVersion }, idempotencyKey: key,
    }),
  };
}

/**
 * Remembers the idempotency key used for a given intent (route + expected version) so a retry
 * after a timeout replays the original command instead of creating a second assignment.
 * Keys are non-secret: they grant nothing on their own.
 */
export function createKeyRegistry(seed = {}) {
  const keys = new Map();
  const registry = {
    /** Stable key for one user intention; repeated calls return the same key. */
    for(intent, factory = newIdempotencyKey) {
      if (!keys.has(intent)) keys.set(intent, factory());
      return keys.get(intent);
    },
    /** Called once the server has definitively accepted or rejected the command. */
    release(intent) { keys.delete(intent); },
    has: intent => keys.has(intent),
    entries: () => Object.fromEntries(keys),
    hydrate(persisted = {}) {
      for (const [intent, key] of Object.entries(persisted)) {
        if (isValidIdempotencyKey(key) && !keys.has(intent)) keys.set(intent, key);
      }
    },
  };
  registry.hydrate(seed);
  return registry;
}

/**
 * Reads the server's truth about one assignment after an unknown outcome. This is the safe
 * resolution path: never re-create, always look.
 */
export async function resolveUnknown(commands, id) {
  const { data } = await commands.read(id);
  return data.assignment;
}
