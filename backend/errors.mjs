export const fail = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra });
export function check(condition, status, message, extra) { if (!condition) throw fail(status, message, extra); }
export function object(value) { check(value && typeof value === 'object' && !Array.isArray(value), 400, '需要 JSON 对象'); return value; }
export function text(value, max, required = false) {
  check(typeof value === 'string' || (!required && value == null), 400, '文字格式无效');
  const result = (value || '').trim();
  check(result.length <= max && (!required || result.length > 0), 400, '文字为空或过长');
  return result;
}
export function revision(value) { check(Number.isSafeInteger(value) && value >= 0, 400, '需要有效版本号'); return value; }
export function date(value) {
  check(typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value)), 400, '日期无效');
  return new Date(value).toISOString();
}
export function username(value) {
  const name = text(value, 40, true).toLowerCase();
  check(/^[a-z0-9][a-z0-9_-]{2,39}$/.test(name), 400, '账号须为 3 至 40 位字母、数字、下划线或短横线');
  return name;
}
