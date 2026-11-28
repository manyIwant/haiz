/**
 * The app's one small store. Plain object + subscribers, read through useSyncExternalStore.
 * Everything here is demo state kept in memory (and a little in localStorage for preferences);
 * nothing is sent anywhere.
 */
import { useSyncExternalStore } from "react";
import { clock } from "../kernel/motion";
import { TASKS, NOTICES, type Task, type Notice } from "../data/demo";

export type Theme = "system" | "light" | "dark";
export type Role = "student" | "teacher";
export type FocusState = { state: "idle" | "running" | "paused" | "done"; total: number; left: number; label: string; endsAt: number };
export type Toast = { id: number; text: string; tone?: "lit" | "plain"; from?: "dock" | "bar" };

export type State = {
  theme: Theme;
  intensity: number;
  role: Role;
  tasks: Task[];
  notices: Notice[];
  focus: FocusState;
  toasts: Toast[];
  notify: boolean;
  railCompact: boolean;
  searchOpen: boolean;
  lensOpen: boolean;
  inspector: { kind: string; id: string; from?: DOMRect | null } | null;
};

const pref = (k: string, d: any) => {
  try { const v = localStorage.getItem("haiz006:" + k); return v == null ? d : JSON.parse(v); } catch { return d; }
};
const save = (k: string, v: any) => { try { localStorage.setItem("haiz006:" + k, JSON.stringify(v)); } catch { /* private mode */ } };

let state: State = {
  theme: pref("theme", "system"),
  intensity: pref("intensity", 1),
  role: pref("role", "student"),
  tasks: TASKS.map((t) => ({ ...t })),
  notices: NOTICES.map((n) => ({ ...n })),
  focus: { state: "idle", total: 25 * 60, left: 25 * 60, label: "专注", endsAt: 0 },
  toasts: [],
  notify: pref("notify", true),
  railCompact: pref("railCompact", false),
  searchOpen: false,
  lensOpen: false,
  inspector: null,
};
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const getState = () => state;
export function setState(p: Partial<State> | ((s: State) => Partial<State>)) {
  const patch = typeof p === "function" ? p(state) : p;
  state = { ...state, ...patch };
  if ("theme" in patch) { save("theme", state.theme); sweepTheme(); }
  if ("intensity" in patch) { save("intensity", state.intensity); clock.setIntensity(state.intensity); applyMotionVars(); }
  if ("role" in patch) save("role", state.role);
  if ("notify" in patch) save("notify", state.notify);
  if ("railCompact" in patch) save("railCompact", state.railCompact);
  emit();
}
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => sel(state), () => sel(state));
}

/* ---------------- theme & motion ---------------- */
export function applyTheme() {
  const r = document.documentElement;
  if (state.theme === "system") r.removeAttribute("data-theme");
  else r.setAttribute("data-theme", state.theme);
  const dark = state.theme === "dark" || (state.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0f1210" : "#f4f2ec");
}
/** the last place a hand touched the page: a theme change spreads from there */
let touchAt = { x: innerWidth - 120, y: 30 };
addEventListener("pointerdown", (e) => { touchAt = { x: e.clientX, y: e.clientY }; }, { capture: true, passive: true });
/**
 * 006 · the theme does not flip, it spreads: the new light (or dusk) opens as a circle from the
 * point that asked for it, over a still image of the old page (View Transitions). Without the API,
 * or at intensity 0, it simply changes.
 */
function sweepTheme() {
  const d = document as any;
  if (!d.startViewTransition || clock.intensity < 0.04) { applyTheme(); return; }
  const { x, y } = touchAt;
  const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const vt = d.startViewTransition(() => applyTheme());
  vt.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${R}px at ${x}px ${y}px)`] },
      { duration: 720 / Math.max(0.3, clock.intensity), easing: "cubic-bezier(.22,.8,.2,1)", pseudoElement: "::view-transition-new(root)" },
    );
  }).catch(() => {});
}
export const isDark = () => document.documentElement.getAttribute("data-theme") === "dark" || (state.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);

/** CSS transitions follow the same clock: their durations divide by the time scale, and vanish at intensity 0 */
export function applyMotionVars() {
  const r = document.documentElement.style;
  const reduced = clock.intensity < 0.04;
  r.setProperty("--ts", reduced ? "1000" : String(clock.scale));
  r.setProperty("--mi", String(clock.intensity));
}

/* ---------------- actions ---------------- */
let toastSeq = 0;
export function toast(text: string, o: Omit<Toast, "id" | "text"> = {}) {
  const t = { id: ++toastSeq, text, ...o };
  setState((s) => ({ toasts: [...s.toasts, t] }));
  setTimeout(() => setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) })), 2600 / Math.max(0.1, clock.scale));
}
export function toggleTask(id: string) {
  setState((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }));
}
export function addTask(title: string, subject = "日常") {
  const t: Task = { id: "u" + Date.now(), title, subject, due: "今天", note: "", done: false, mine: true };
  setState((s) => ({ tasks: [t, ...s.tasks] }));
}
export function readNotice(id: string) {
  setState((s) => ({ notices: s.notices.map((n) => (n.id === id ? { ...n, unread: false } : n)) }));
}
export function readAll() { setState((s) => ({ notices: s.notices.map((n) => ({ ...n, unread: false })) })); }
export function publishNotice(n: Omit<Notice, "id" | "unread" | "time">) {
  const item: Notice = { ...n, id: "p" + Date.now(), unread: true, time: "刚刚" };
  setState((s) => ({ notices: [item, ...s.notices] }));
}

/* ---------------- focus timer (on the one clock's virtual time, so the bench can slow it) ---------------- */
let focusTick: (() => void) | null = null;
export function startFocus(minutes: number, label = "专注") {
  const total = Math.round(minutes * 60);
  setState({ focus: { state: "running", total, left: total, label, endsAt: 0 } });
  runFocus();
}
function runFocus() {
  focusTick?.();
  let acc = 0;
  focusTick = clock.add((dt) => {
    const f = state.focus;
    if (f.state !== "running") return false;
    acc += dt;
    if (acc >= 1) {
      const n = Math.floor(acc);
      acc -= n;
      const left = Math.max(0, f.left - n);
      setState({ focus: { ...f, left, state: left === 0 ? "done" : "running" } });
      if (left === 0) toast(`${f.label}完成 · ${Math.round(f.total / 60)} 分钟`, { tone: "lit", from: "dock" });
    }
    return true;
  });
}
export function pauseFocus() {
  const f = state.focus;
  if (f.state === "running") setState({ focus: { ...f, state: "paused" } });
  else if (f.state === "paused") { setState({ focus: { ...f, state: "running" } }); runFocus(); }
}
export function stopFocus() {
  focusTick?.(); focusTick = null;
  setState({ focus: { ...state.focus, state: "idle", left: state.focus.total } });
}
export const fmtClock = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
