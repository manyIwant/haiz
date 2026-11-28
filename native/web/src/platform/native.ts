/**
 * HAIZ Native · the bridge to the Android shell. In the browser every call has a web fallback, so
 * the same app runs on the web preview, in the acceptance bench and in the APK.
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export const isNative = () => Capacitor.isNativePlatform();
export const platform = () => Capacitor.getPlatform();

export type Insets = { top: number; bottom: number; left: number; right: number; ime: number };
export type DeviceInfo = { model: string; android: string; sdk: number; refreshRate: number; webview: string; memTotalMB: number; memAvailMB: number; appPssMB: number; lowMemory: boolean; thermal?: number };

type NativeShell = {
  immersive(o: { on: boolean }): Promise<void>;
  systemKeyboard(o: { show: boolean }): Promise<void>;
  pickInputMethod(): Promise<void>;
  info(): Promise<DeviceInfo>;
  frameStart(): Promise<void>;
  frameStop(): Promise<void>;
  frames(): Promise<NativeFrames>;
};
type Pct = { p50?: number; p95?: number; max?: number };
/** Android FrameMetrics since the last call (ms) — the app window's real frames, GPU time on Android 12+ */
export type NativeFrames = { frames: number; jank: number; droppedReported: number; total: Pct; renderThread: Pct; gpu?: Pct };
export const HaizNative = registerPlugin<NativeShell>("HaizNative");

export type UpdaterProgress = { received: number; total: number; bytesPerSecond: number };
type Updater = {
  installed(): Promise<{ packageId: string; versionCode: number; versionName: string; installedAt: number; updatedAt: number; certSha256: string }>;
  fetchManifest(o: { url: string }): Promise<{ status: number; text?: string }>;
  local(o: { versionCode: number }): Promise<{ partial: number; complete: boolean }>;
  download(o: { url: string; sha256: string; sizeBytes: number; versionCode: number }): Promise<{ state: "verified" | "paused"; received: number; total: number }>;
  pause(): Promise<void>;
  discard(): Promise<void>;
  install(o: { versionCode: number }): Promise<{ state: "installer_opened" | "permission_required" }>;
  addListener(e: "progress", f: (p: UpdaterProgress) => void): Promise<PluginListenerHandle>;
  addListener(e: "state", f: (p: { state: string; attempt: number }) => void): Promise<PluginListenerHandle>;
};
export const HaizUpdater = registerPlugin<Updater>("HaizUpdater");

type Store = {
  run(o: { statements: { sql: string; params?: unknown[] }[] }): Promise<void>;
  query(o: { sql: string; params?: unknown[] }): Promise<{ rows: Record<string, unknown>[] }>;
  saveFile(o: { name: string; text: string }): Promise<{ uri: string }>;
  openFile(): Promise<{ text: string }>;
};
export const HaizStore = registerPlugin<Store>("HaizStore");

/* ---------------- insets → CSS ---------------- */
let insets: Insets = { top: 0, bottom: 0, left: 0, right: 0, ime: 0 };
const insetSubs = new Set<(i: Insets) => void>();
export const getInsets = () => insets;
export function onInsets(f: (i: Insets) => void) { insetSubs.add(f); return () => insetSubs.delete(f); }
function applyInsets(i: Insets) {
  insets = i;
  const r = document.documentElement.style;
  r.setProperty("--safe-t", i.top + "px");
  r.setProperty("--safe-b", i.bottom + "px");
  r.setProperty("--safe-l", i.left + "px");
  r.setProperty("--safe-r", i.right + "px");
  r.setProperty("--ime", i.ime + "px");
  insetSubs.forEach((f) => f(i));
}
if (typeof window !== "undefined") (window as any).__haizInsets = applyInsets;

export function installNative() {
  if (!isNative()) return;
  document.documentElement.dataset.native = "1";
}

/* ---------------- back: overlays take the back gesture first, newest first ---------------- */
const backStack: (() => void)[] = [];
export function pushBack(fn: () => void) { backStack.push(fn); return () => { const i = backStack.lastIndexOf(fn); if (i >= 0) backStack.splice(i, 1); }; }
export function popBack(): boolean { const f = backStack[backStack.length - 1]; if (!f) return false; f(); return true; }

/* ---------------- files: the system's save / open pickers on Android, a download in a browser ---------------- */
export async function saveText(name: string, text: string): Promise<string> {
  if (isNative()) return (await HaizStore.saveFile({ name, text })).uri;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return name;
}
export async function openText(): Promise<string> {
  if (isNative()) return (await HaizStore.openFile()).text;
  return new Promise((res, rej) => {
    const i = document.createElement("input");
    i.type = "file"; i.accept = "application/json,.json";
    i.onchange = () => { const f = i.files?.[0]; if (!f) return rej(new Error("cancelled")); f.text().then(res, rej); };
    i.click();
  });
}

type Voice = {
  available(): Promise<{ recognizer: boolean; intent: boolean }>;
  start(o: { lang?: string }): Promise<{ mode: "stream" | "system"; text?: string }>;
  stop(): Promise<void>;
  cancel(): Promise<void>;
  addListener(e: "level", f: (p: { db: number }) => void): Promise<PluginListenerHandle>;
  addListener(e: "partial" | "final", f: (p: { text: string }) => void): Promise<PluginListenerHandle>;
  addListener(e: "state", f: (p: { state: string }) => void): Promise<PluginListenerHandle>;
  addListener(e: "error", f: (p: { code: number }) => void): Promise<PluginListenerHandle>;
};
export const HaizVoice = registerPlugin<Voice>("HaizVoice");

/* 收件 · the opt-in notice queue (Native 002) */
export type IntakeEntry = { id: string; source: string; label: string; group: string; text: string; at: number };
export type IntakeNativeConfig = { enabled: boolean; groups: string[]; sources: Record<string, boolean>; granted: boolean; discoveringUntil: number; pending: number };
type Intake = {
  getConfig(): Promise<IntakeNativeConfig>;
  setConfig(o: { enabled: boolean; groups: string[]; sources: Record<string, boolean> }): Promise<IntakeNativeConfig>;
  openAccessSettings(): Promise<void>;
  entries(): Promise<{ entries: IntakeEntry[] }>;
  ack(o: { ids: string[] }): Promise<void>;
  clear(): Promise<void>;
  startDiscovery(): Promise<IntakeNativeConfig>;
  stopDiscovery(): Promise<void>;
  discovered(): Promise<{ groups: { title: string; source: string; n: number; at: number }[] }>;
  addListener(e: "entry", f: (p: IntakeEntry) => void): Promise<PluginListenerHandle>;
};
export const HaizIntake = registerPlugin<Intake>("HaizIntake");
