import { Worker } from 'node:worker_threads';
import { fail } from './errors.mjs';

// A bounded RPC queue keeps synchronous SQLite work off the HTTP event loop.
export async function openDatabase(directory) {
  const worker = new Worker(new URL('./database-worker.mjs', import.meta.url), { workerData: { directory } });
  const pending = new Map(); let sequence = 0, stopped = false;
  let readyResolve, readyReject;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  const rejectAll = error => { stopped = true; readyReject(error); for (const task of pending.values()) task.reject(error); pending.clear(); };
  worker.on('error', rejectAll);
  worker.on('exit', code => rejectAll(fail(503, '数据库已停止', { code })));
  worker.on('message', message => {
    if (message.ready) { readyResolve(); return; }
    const task = pending.get(message.id); if (!task) return;
    pending.delete(message.id);
    if (message.error) task.reject(fail(message.error.status || 500, message.error.message, message.error.extra));
    else task.resolve(message.result);
  });
  await ready;
  const call = (operation, args = {}) => {
    if (stopped) return Promise.reject(fail(503, '数据库不可用'));
    if (pending.size >= 256) return Promise.reject(fail(503, '数据库繁忙，请稍后重试'));
    const id = ++sequence;
    return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); worker.postMessage({ id, operation, args }); });
  };
  return { call, get pending() { return pending.size; }, close: async () => {
    if (stopped) return;
    try { await call('close'); } finally { stopped = true; await worker.terminate(); }
  } };
}
