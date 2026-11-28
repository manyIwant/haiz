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
};
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
