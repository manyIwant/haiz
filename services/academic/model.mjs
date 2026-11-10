export const PUBLIC_STATES = ['published', 'revised', 'retracted'];
export const ACTIVE_STATES = ['published', 'revised'];
export const FIELDS = ['subject', 'title', 'details', 'due', 'duePrecision'];
export const fail = (status, code, message, extra = {}) => {
  throw Object.assign(new Error(message), { status, code, ...extra });
};

export function assignmentView(row) {
  return {
    id: row.id, classId: row.class_id, subject: row.subject, title: row.title,
    details: row.details, due: row.due, duePrecision: row.due_precision,
    createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at,
    version: row.version, status: row.status,
    source: { kind: row.source_kind, ...(row.source_id ? { id: row.source_id } : {}) },
  };
}

export function onlyFields(input, allowed) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    fail(400, 'INVALID_BODY', '请求必须是 JSON 对象');
  if (Object.keys(input).some(key => !allowed.includes(key)))
    fail(400, 'UNKNOWN_FIELD', '请求包含不允许的字段');
}

function text(value, name, max, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()))
    fail(400, 'INVALID_FIELD', `${name} 无效或过长`);
  return value.trim();
}

function validateDue(due, precision) {
  if (precision === 'none' && due === null) return;
  if (typeof due !== 'string') fail(400, 'INVALID_DUE', '截止时间与精度不一致');
  const date = due.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)
    fail(400, 'INVALID_DUE', '截止日期不存在');
  if (precision === 'date' && due === date) return;
  if (precision === 'minute' && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::00)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(due) &&
      Number.isFinite(Date.parse(due))) return;
  fail(400, 'INVALID_DUE', '截止时间必须含有效精度与时区');
}

export function content(input, previous = {}) {
  const combined = { subject: '', title: '', details: '', due: null, duePrecision: 'none', ...previous, ...input };
  const result = {
    subject: text(combined.subject, '科目', 32), title: text(combined.title, '标题', 240),
    details: text(combined.details, '详细内容', 3000, false),
    due: combined.due, duePrecision: combined.duePrecision,
  };
  validateDue(result.due, result.duePrecision);
  return result;
}

export function expectedVersion(input) {
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1)
    fail(400, 'VERSION_REQUIRED', '需要正整数 expectedVersion');
}

export function page(query) {
  const integer = (value, fallback, min, max) => {
    if (value === null) return fallback;
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max)
      fail(400, 'INVALID_PAGE', '分页参数无效');
    return Number(value);
  };
  return { limit: integer(query.get('limit'), 100, 1, 200), after: integer(query.get('after'), 0, 0, Number.MAX_SAFE_INTEGER) };
}

export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
