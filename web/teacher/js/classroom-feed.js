/** DOM-free reader for the Academic v1.4 public classroom projection. */
import { createClient } from './api.js';

const HANDOFF_KEY = 'haiz.classroom.handoff';
const PAGE_SIZE = 100;
const MAX_PAGES = 100;
const ENVELOPE_FIELDS = ['state', 'data', 'error', 'meta'];
const DATA_FIELDS = ['classId', 'className', 'assignments', 'readOnly', 'containsStudentIdentity'];
const ASSIGNMENT_FIELDS = ['id', 'version', 'subject', 'title', 'details', 'due', 'duePrecision', 'status', 'updatedAt'];
const MINUTE_DATE = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::00)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export class ClassroomFeedError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ClassroomFeedError';
    this.code = code;
  }
}

function fail(code = 'INVALID_FEED') {
  const messages = {
    INVALID_FEED: '服务器的教室屏数据格式不正确。已清空展示，请联系管理员后重试。',
    PRIVACY_VIOLATION: '响应未通过公开数据校验。已停止展示，请联系管理员检查教室屏接口。',
    PAGINATION_ERROR: '未能完整读取全部作业。已清空展示，请重新载入。',
    INVALID_KEY: '请填写有效的教室屏凭据（96 位小写十六进制字符）。',
    HANDOFF_UNAVAILABLE: '无法读取或移除临时凭据。请手动填写教室屏凭据。',
  };
  throw new ClassroomFeedError(code, messages[code]);
}

function onlyFields(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  if (Object.keys(value).some(field => !allowed.includes(field))) fail('PRIVACY_VIOLATION');
}

function validText(value, max, required = true) {
  return typeof value === 'string' && value.length <= max && (!required || Boolean(value.trim()));
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
}

function validDue(due, precision) {
  if (precision === 'none') return due === null;
  if (typeof due !== 'string' || !validDate(due.slice(0, 10))) return false;
  if (precision === 'date') return due.length === 10;
  return precision === 'minute' && MINUTE_DATE.test(due) && Number.isFinite(Date.parse(due));
}

function publicAssignment(value) {
  onlyFields(value, ASSIGNMENT_FIELDS);
  if (!['published', 'revised'].includes(value.status)) fail('PRIVACY_VIOLATION');
  if (!validText(value.id, 200) || !Number.isSafeInteger(value.version) || value.version < 1
    || !validText(value.subject, 32) || !validText(value.title, 240)
    || !validText(value.details, 3000, false) || !validDue(value.due, value.duePrecision)
    || typeof value.updatedAt !== 'string' || !TIMESTAMP.test(value.updatedAt)
    || !validDate(value.updatedAt.slice(0, 10)) || !Number.isFinite(Date.parse(value.updatedAt))) fail();
  // Reconstruct the projection so no unvalidated property can reach the display.
  return Object.freeze({ id: value.id, version: value.version, subject: value.subject,
    title: value.title, details: value.details, due: value.due, duePrecision: value.duePrecision,
    status: value.status, updatedAt: value.updatedAt });
}

function publicPage(envelope) {
  onlyFields(envelope, ENVELOPE_FIELDS);
  if (envelope.state !== 'Synced' || envelope.error !== null) fail();
  onlyFields(envelope.data, DATA_FIELDS);
  onlyFields(envelope.meta, ['nextAfter']);
  const data = envelope.data;
  if (data.readOnly !== true || data.containsStudentIdentity !== false) fail('PRIVACY_VIOLATION');
  if (!validText(data.classId, 200) || !validText(data.className, 240)
    || !Array.isArray(data.assignments)) fail();
  return { classId: data.classId, className: data.className,
    assignments: data.assignments.map(publicAssignment), nextAfter: envelope.meta.nextAfter };
}

function checkPagination(page, after, pageSize, seen) {
  const next = page.nextAfter;
  if (page.assignments.length > pageSize || (next !== null && (!Number.isSafeInteger(next)
    || next <= after || next !== after + page.assignments.length || page.assignments.length !== pageSize))) {
    fail('PAGINATION_ERROR');
  }
  const ids = page.assignments.map(item => item.id);
  if (new Set(ids).size !== ids.length || ids.some(id => seen.has(id))) fail('PAGINATION_ERROR');
}

function validateKey(key) {
  if (typeof key !== 'string' || !/^[0-9a-f]{96}$/.test(key)) fail('INVALID_KEY');
  return key;
}

function checkAbort(signal) {
  if (signal?.aborted) throw new DOMException('读取已取消。', 'AbortError');
}

/**
 * Reads all pages atomically. Never returns a partial or privacy-unchecked result.
 * @param {{key:string, signal?:AbortSignal, pageSize?:number, maxPages?:number,
 * clientFactory?:typeof createClient}} options
 * @returns {Promise<Readonly<{classId:string,className:string,assignments:ReadonlyArray<object>,
 * readOnly:true,containsStudentIdentity:false}>>}
 */
export async function loadClassroomFeed({ key, signal, pageSize = PAGE_SIZE,
  maxPages = MAX_PAGES, clientFactory = createClient }) {
  validateKey(key);
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 200
    || !Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > MAX_PAGES) fail('PAGINATION_ERROR');
  checkAbort(signal);
  const client = clientFactory({ origin: '', headers: { Authorization: `Bearer ${key}` } });
  let assignments = [];
  let identity = null;
  let after = 0;
  let seen = new Set();
  for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
    checkAbort(signal);
    const response = await client.send(`/api/v1/classroom?limit=${pageSize}&after=${after}`, { signal });
    checkAbort(signal);
    const page = publicPage(response);
    checkPagination(page, after, pageSize, seen);
    if (identity && (page.classId !== identity.classId || page.className !== identity.className)) fail();
    identity = { classId: page.classId, className: page.className };
    assignments = [...assignments, ...page.assignments];
    seen = new Set(assignments.map(item => item.id));
    if (page.nextAfter === null) {
      return Object.freeze({ ...identity, assignments: Object.freeze(assignments),
        readOnly: true, containsStudentIdentity: false });
    }
    after = page.nextAfter;
  }
  fail('PAGINATION_ERROR');
}

/**
 * Removes the one-time teacher preview handoff before validating it. Never writes storage.
 * The preferred format is a raw screen key; {screenKey} JSON is also accepted.
 * @param {{getItem:Function,removeItem:Function}} storage
 * @returns {string} validated key, or empty string when no handoff exists
 */
export function consumeClassroomHandoff(storage) {
  let raw;
  try {
    raw = storage.getItem(HANDOFF_KEY);
    storage.removeItem(HANDOFF_KEY);
  } catch {
    fail('HANDOFF_UNAVAILABLE');
  }
  if (raw === null) return '';
  if (typeof raw === 'string' && /^[0-9a-f]{96}$/.test(raw)) return raw;
  let handoff;
  try { handoff = JSON.parse(raw); } catch { fail('INVALID_KEY'); }
  if (!handoff || typeof handoff !== 'object' || Array.isArray(handoff)
    || Object.keys(handoff).length !== 1 || !Object.hasOwn(handoff, 'screenKey')) fail('INVALID_KEY');
  return validateKey(handoff.screenKey);
}
