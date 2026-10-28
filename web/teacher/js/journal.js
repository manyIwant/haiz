import { newIdempotencyKey, isValidIdempotencyKey } from './api.js';

const clone = value => JSON.parse(JSON.stringify(value));
const canonical = value => JSON.stringify(value, Object.keys(value).sort());

/**
 * Persist a request before sending. Unknown outcomes retain the exact request and key.
 * @param {{storage:Storage, scope:string, send:Function, keyFactory?:()=>string}} options
 * @returns {{execute:Function,replay:Function,pending:Function,get:Function,clear:Function}}
 */
export function createJournal({ storage, scope, send, keyFactory = newIdempotencyKey }) {
  if (!scope || typeof scope !== 'string') throw new Error('缺少请求日志的账号范围。');
  const storageKey = `haiz.teacher.v3.commands/${encodeURIComponent(scope)}`;
  const read = () => {
    let entries;
    try { entries = JSON.parse(storage.getItem(storageKey) ?? '{}'); }
    catch (cause) { throw new Error('请求日志无法读取或已损坏，请保留本机数据并联系管理员。', { cause }); }
    if (!entries || Array.isArray(entries) || typeof entries !== 'object' || Object.values(entries).some(entry =>
      !entry || !isValidIdempotencyKey(entry.idempotencyKey) || typeof entry.path !== 'string'
      || !entry.path.startsWith('/api/v1/') || !['POST', 'PATCH'].includes(entry.method)
      || !['pending', 'accepted', 'rejected'].includes(entry.status) || !entry.body || typeof entry.body !== 'object')) {
      throw new Error('请求日志已损坏，请保留本机数据并联系管理员。');
    }
    return entries;
  };
  const write = entries => {
    try { storage.setItem(storageKey, JSON.stringify(entries)); }
    catch (cause) { throw new Error('无法保存请求日志。请释放本机存储空间后使用原请求恢复。', { cause }); }
  };
  read();
  let active = new Set();
  async function replay(intent) {
    if (active.has(intent)) throw new Error('这项请求正在处理，请等待结果。');
    const entry = read()[intent];
    if (!entry) throw new Error('找不到原始请求，请勿重新创建作业。');
    if (entry.status === 'accepted') return clone(entry.response);
    if (entry.status === 'rejected') throw Object.assign(new Error(entry.error.message), entry.error);
    active = new Set([...active, intent]);
    try {
      let response;
      try {
        response = await send(entry.path, { method: entry.method, body: clone(entry.body), idempotencyKey: entry.idempotencyKey });
      } catch (error) {
        if (error.status >= 400 && error.status < 500 && ![401, 403, 429].includes(error.status)) {
          write({ ...read(), [intent]: { ...entry, status: 'rejected', error: { message: error.message, status: error.status, code: error.code ?? 'REJECTED' } } });
        }
        throw error;
      }
      write({ ...read(), [intent]: { ...entry, status: 'accepted', response } });
      return response;
    } finally { active = new Set([...active].filter(item => item !== intent)); }
  }
  async function execute(intent, command) {
    const entries = read();
    const original = entries[intent];
    if (original && (original.path !== command.path || original.method !== command.method || canonical(original.body) !== canonical(command.body))) {
      throw new Error('请先恢复原始请求的结果，再修改内容。');
    }
    if (!original) {
      write({ ...entries, [intent]: { ...clone(command), idempotencyKey: keyFactory(), status: 'pending' } });
      read();
    }
    return replay(intent);
  }
  return {
    execute, replay,
    get: intent => clone(read()[intent] ?? null),
    pending: () => Object.entries(read()).filter(([, value]) => value.status === 'pending').map(([intent, entry]) => ({ intent, ...entry })),
    clear(intent) {
      const entries = read();
      if (entries[intent]?.status === 'pending') throw new Error('不能删除结果未知的原始请求。');
      write(Object.fromEntries(Object.entries(entries).filter(([key]) => key !== intent)));
    },
  };
}
