/**
 * 一键更新 · the in-place updater (HAIZ Native 001), restored from the HAIZ 1.5 updater.
 *
 * The manifest is published with every GitHub Release (haiz-update.json) and mirrored on the
 * site. The phone downloads the APK itself (resumable, retried, checked against the manifest's
 * size and SHA-256), checks that it is the same package, a newer versionCode and signed with the
 * same certificate, and hands it to the system installer. Installing over the app keeps all its
 * data: identities live in the app's SQLite database, which an update never touches.
 */
import { HaizUpdater, isNative } from "../platform/native";

export const MANIFEST_URLS = [
  "https://github.com/manyIwant/haiz/releases/latest/download/haiz-update.json",
  "https://haiz.space/updates/latest.json",
];
export type Manifest = { packageId: string; versionName: string; versionCode: number; apkUrl: string; sha256: string; sizeBytes: number; notes: string; publishedAt?: string; minAndroid?: number };
export type Phase = "idle" | "checking" | "uptodate" | "available" | "downloading" | "paused" | "verifying" | "ready" | "installing" | "error" | "unsupported";
export type UpdState = { phase: Phase; manifest: Manifest | null; installed: { versionName: string; versionCode: number } | null; received: number; total: number; bps: number; error: string | null; attempt: number; checkedAt: number };

let st: UpdState = { phase: "idle", manifest: null, installed: null, received: 0, total: 0, bps: 0, error: null, attempt: 0, checkedAt: 0 };
const subs = new Set<(s: UpdState) => void>();
const set = (p: Partial<UpdState>) => { st = { ...st, ...p }; subs.forEach((f) => f(st)); };
export const getUpdate = () => st;
export function onUpdate(f: (s: UpdState) => void) { subs.add(f); return () => { subs.delete(f); }; }

let listening = false;
function listen() {
  if (listening || !isNative()) return;
  listening = true;
  void HaizUpdater.addListener("progress", (p) => set({ received: p.received, total: p.total, bps: p.bytesPerSecond, phase: st.phase === "paused" ? "paused" : "downloading" }));
  void HaizUpdater.addListener("state", (p) => {
    if (p.state === "verifying") set({ phase: "verifying" });
    else if (p.state === "retry") set({ attempt: p.attempt });
  });
}

function valid(m: any, pkg: string): m is Manifest {
  return m && typeof m === "object" && m.packageId === pkg && Number.isInteger(m.versionCode) && typeof m.apkUrl === "string" && m.apkUrl.startsWith("https://")
    && /^[0-9a-f]{64}$/i.test(m.sha256 ?? "") && Number.isFinite(m.sizeBytes) && m.sizeBytes > 1024 * 1024;
}

export async function check(manual = false): Promise<UpdState> {
  if (!isNative()) { set({ phase: "unsupported", error: "浏览器版本随网页更新；一键更新只在 Android 安装包里可用。" }); return st; }
  if (["downloading", "verifying", "installing"].includes(st.phase)) return st;
  listen();
  set({ phase: "checking", error: null });
  try {
    const me = await HaizUpdater.installed();
    set({ installed: { versionName: me.versionName, versionCode: me.versionCode } });
    let m: Manifest | null = null, lastErr = "";
    for (const url of MANIFEST_URLS) {
      try {
        const r = await HaizUpdater.fetchManifest({ url: url + "?t=" + Math.floor(Date.now() / 60000) });
        if (r.status !== 200 || !r.text) { lastErr = `HTTP ${r.status}`; continue; }
        const j = JSON.parse(r.text);
        if (!valid(j, me.packageId)) { lastErr = "更新信息不完整"; continue; }
        if (!m || j.versionCode > m.versionCode) m = j;
        if (m && m.versionCode > me.versionCode) break;       // the first source that has something newer is enough
      } catch (e: any) { lastErr = e?.message ?? String(e); }
    }
    try { localStorage.setItem("haiz:update:checkedAt", String(Date.now())); } catch { /* private */ }
    if (!m) { set({ phase: "error", error: manual ? `无法获取更新信息（${lastErr || "网络不可用"}）` : null, checkedAt: Date.now() }); if (!manual) set({ phase: "idle" }); return st; }
    if (m.versionCode <= me.versionCode) { set({ phase: "uptodate", manifest: m, checkedAt: Date.now() }); return st; }
    const local = await HaizUpdater.local({ versionCode: m.versionCode });
    set({ manifest: m, checkedAt: Date.now(), total: m.sizeBytes, received: local.complete ? m.sizeBytes : local.partial, phase: local.complete ? "ready" : local.partial > 0 ? "paused" : "available" });
  } catch (e: any) {
    set({ phase: "error", error: e?.message ?? String(e) });
  }
  return st;
}

export async function download() {
  const m = st.manifest;
  if (!m || !isNative()) return;
  listen();
  set({ phase: "downloading", error: null, attempt: 0 });
  try {
    const r = await HaizUpdater.download({ url: m.apkUrl, sha256: m.sha256, sizeBytes: m.sizeBytes, versionCode: m.versionCode });
    set(r.state === "verified" ? { phase: "ready", received: r.total, total: r.total } : { phase: "paused", received: r.received, total: r.total });
  } catch (e: any) {
    set({ phase: "error", error: e?.message ?? String(e) });
  }
}
export async function pause() { set({ phase: "paused" }); try { await HaizUpdater.pause(); } catch { /* not running */ } }
export async function discard() { try { await HaizUpdater.pause(); await HaizUpdater.discard(); } catch { /* nothing */ } set({ phase: st.manifest ? "available" : "idle", received: 0 }); }
export async function install() {
  const m = st.manifest;
  if (!m) return;
  set({ phase: "installing", error: null });
  try {
    const r = await HaizUpdater.install({ versionCode: m.versionCode });
    if (r.state === "permission_required") set({ phase: "ready", error: "请在系统设置里允许 HAIZ “安装未知应用”，返回后再点一次安装。" });
    else window.setTimeout(() => { if (st.phase === "installing") set({ phase: "ready" }); }, 4000);
  } catch (e: any) {
    set({ phase: "error", error: e?.message ?? String(e) });
  }
}

/** at most every six hours, a quiet check a little after launch */
export function autoCheck(onAvailable: (m: Manifest) => void) {
  if (!isNative()) return;
  let last = 0;
  try { last = Number(localStorage.getItem("haiz:update:checkedAt") || 0); } catch { /* private */ }
  if (Date.now() - last < 6 * 3600e3) return;
  window.setTimeout(() => { void check(false).then((s) => { if (s.manifest && (s.phase === "available" || s.phase === "paused" || s.phase === "ready")) onAvailable(s.manifest); }); }, 9000);
}

export const fmtBytes = (b: number) => b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : (b / 1024).toFixed(0) + " KB";
