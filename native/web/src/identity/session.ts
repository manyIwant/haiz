/**
 * 校园身份 · the session: which identity the app is, restoring it on launch, switching, and
 * saving its data as it changes. Switching re-renders the whole app from the new identity's data
 * (the App root is keyed by the identity), so no state of one identity can leak into another.
 */
import { getState, setState, subscribe } from "../app/store";
import { applyIdentityData, NOTICES, TASKS } from "../data/demo";
import { currentId, listIdentities, loadIdentity, markUsed, writeRecords, type Identity, type Prefs } from "./repo";

export async function restoreLastIdentity(): Promise<Identity | null> {
  try {
    let id = await currentId();
    if (!id) { const all = await listIdentities(); id = all.sort((a, b) => b.lastUsedAt - a.lastUsedAt)[0]?.id ?? null; }
    if (!id) return null;
    return await activate(id);
  } catch (e) {
    console.warn("[identity] restore failed", e);
    return null;
  }
}

let saving = false;
export async function activate(id: string): Promise<Identity | null> {
  const l = await loadIdentity(id);
  if (!l) return null;
  await flush();
  saving = false;
  applyIdentityData(l.data);
  const p = l.prefs;
  setState({
    identity: l.identity,
    role: l.identity.role,
    tasks: l.data.tasks.map((t) => ({ ...t })),
    notices: NOTICES.map((n) => ({ ...n, unread: l.notices[n.id] === undefined ? n.unread : !l.notices[n.id] })),
    favorites: l.favorites,
    theme: p.theme, intensity: p.intensity, notify: p.notify, railCompact: p.railCompact, keyboard: p.keyboard,
    inspector: null, searchOpen: false, lensOpen: false,
  });
  await markUsed(id);
  snapshot = sig();
  saving = true;
  return l.identity;
}

/* ---------------- autosave ---------------- */
let snapshot = "";
const sig = () => { const s = getState(); return JSON.stringify([s.tasks, s.notices.map((n) => n.unread), s.favorites, s.theme, s.intensity, s.notify, s.railCompact, s.keyboard, s.role]); };
let timer = 0;
let pending: Promise<void> | null = null;
function persistNow() {
  const s = getState();
  const id = s.identity?.id;
  if (!id) return Promise.resolve();
  const prefs: Prefs = { theme: s.theme, intensity: s.intensity, notify: s.notify, railCompact: s.railCompact, keyboard: s.keyboard };
  const notices: Record<string, boolean> = {};
  for (const n of s.notices) notices[n.id] = !n.unread;
  pending = writeRecords(id, { tasks: s.tasks, notices, favorites: s.favorites, prefs }).catch((e) => console.warn("[identity] save failed", e)).then(() => { pending = null; });
  return pending;
}
export async function flush() { if (timer) { clearTimeout(timer); timer = 0; await persistNow(); } else if (pending) await pending; }
subscribe(() => {
  if (!saving) return;
  const n = sig();
  if (n === snapshot) return;
  snapshot = n;
  clearTimeout(timer);
  timer = window.setTimeout(() => { timer = 0; void persistNow(); }, 400);
});
if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => { if (document.hidden) void flush(); });
void TASKS;
