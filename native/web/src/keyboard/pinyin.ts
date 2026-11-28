/**
 * Client of the pinyin worker. Requests are serialised; while one is in flight only the newest
 * pending input is kept, so fast typing never queues up stale lookups.
 */
export type PyState = { committed: string | null; preedit: string; head: string; cursor: number; candidates: string[] } | null;

let worker: Worker | null = null;
let ready: Promise<void> | null = null;
let seq = 0;
const waits = new Map<number, (m: any) => void>();
let failed = false;

function call(op: string, arg?: unknown): Promise<any> {
  return new Promise((res, rej) => {
    const id = ++seq;
    waits.set(id, (m) => (m.error ? rej(new Error(m.error)) : res(m)));
    worker!.postMessage({ id, op, arg });
  });
}

export function warm(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    worker = new Worker(new URL("./rime.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e) => { const f = waits.get(e.data.id); if (f) { waits.delete(e.data.id); f(e.data); } };
    const dir = new URL("rime", document.baseURI).href;
    await call("init", dir);
  })().catch((e) => { failed = true; console.warn("[keyboard] pinyin engine unavailable", e); throw e; });
  return ready;
}
export const engineFailed = () => failed;

let busy = false;
let pending: string | null = null;
let latest = "";
/** look up a pinyin string; resolves with the state for the newest string asked (older answers are dropped) */
export function lookup(py: string, onState: (s: PyState, forInput: string) => void) {
  latest = py;
  if (busy) { pending = py; return; }
  busy = true;
  const run = async (q: string) => {
    try {
      await warm();
      const m = await call("input", q);
      if (q === latest) onState(m.state, q);
    } catch { if (q === latest) onState(null, q); }
    if (pending !== null) { const n = pending; pending = null; await run(n); } else busy = false;
  };
  void run(py);
}
export async function pick(i: number): Promise<PyState> {
  while (busy) await new Promise((r) => setTimeout(r, 4));
  await warm();
  return (await call("pick", i)).state;
}
export async function clear() { latest = ""; pending = null; if (!worker) return; while (busy) await new Promise((r) => setTimeout(r, 4)); await call("clear").catch(() => {}); }
