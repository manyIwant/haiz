/**
 * The pinyin engine off the main thread: librime (luna_pinyin, Apache-2.0) compiled to WASM by
 * the jsh_rime package. Typing never waits on a dictionary lookup in the UI thread.
 */
import { RimePinyinEngine } from "jsh_rime";

let eng: RimePinyinEngine | null = null;
const post = (m: unknown) => (self as unknown as { postMessage(m: unknown): void }).postMessage(m);
const slim = (s: any) => s && ({ committed: s.committed, preedit: (s.preeditHead ?? "") + (s.preeditBody ?? "") + (s.preeditTail ?? ""), head: s.preeditHead ?? "", cursor: s.cursorPos ?? 0, candidates: (s.candidates ?? []).map((c: any) => c.text) });

self.onmessage = async (e: MessageEvent) => {
  const { id, op, arg } = e.data;
  try {
    if (op === "init") { if (!eng) { eng = new RimePinyinEngine({ wasmDir: arg, simplified: true }); await eng.initialize(); } post({ id, ok: true }); return; }
    if (!eng) throw new Error("not ready");
    if (op === "input") post({ id, state: slim(await eng.processInput(arg)) });
    else if (op === "pick") post({ id, state: slim(await eng.pickCandidate(arg)) });
    else if (op === "clear") { await eng.clearInput(); await eng.processInput(""); post({ id, state: null }); }
  } catch (err: any) { post({ id, error: String(err?.message ?? err) }); }
};
