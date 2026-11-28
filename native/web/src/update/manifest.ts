/**
 * Pure checks for the update manifest and the updater's native errors (no imports, so the
 * regression tests in tests/update.test.mjs run them against the real published manifest).
 */
export type Manifest = { packageId: string; versionName: string; versionCode: number; apkUrl: string; sha256: string; sizeBytes: number; notes: string; publishedAt?: string; minAndroid?: number };
export type ManifestIssue = { field: string; kind: "missing" | "type" | "value"; message: string };

const MIN_APK = 1024 * 1024, MAX_APK = 400 * 1024 * 1024;

export function validateManifest(m: unknown, pkg: string): { ok: true; manifest: Manifest } | { ok: false; issues: ManifestIssue[] } {
  const issues: ManifestIssue[] = [];
  if (!m || typeof m !== "object" || Array.isArray(m)) return { ok: false, issues: [{ field: "(root)", kind: "type", message: "更新清单不是 JSON 对象" }] };
  const o = m as Record<string, unknown>;
  const need = (field: string, type: "string" | "number") => {
    const v = o[field];
    if (v === undefined || v === null || v === "") { issues.push({ field, kind: "missing", message: `缺少字段 ${field}` }); return false; }
    if (typeof v !== type) { issues.push({ field, kind: "type", message: `字段 ${field} 应为${type === "string" ? "文本" : "数字"}，实际是 ${typeof v}` }); return false; }
    return true;
  };
  if (need("packageId", "string") && o.packageId !== pkg) issues.push({ field: "packageId", kind: "value", message: `包名 ${String(o.packageId)} 与本机 ${pkg} 不一致` });
  need("versionName", "string");
  if (need("versionCode", "number") && (!Number.isSafeInteger(o.versionCode) || (o.versionCode as number) <= 0)) issues.push({ field: "versionCode", kind: "type", message: "versionCode 应为正整数" });
  if (need("apkUrl", "string") && !(o.apkUrl as string).startsWith("https://")) issues.push({ field: "apkUrl", kind: "value", message: "apkUrl 必须使用 HTTPS" });
  if (need("sha256", "string") && !/^[0-9a-f]{64}$/i.test(o.sha256 as string)) issues.push({ field: "sha256", kind: "value", message: "sha256 应为 64 位十六进制" });
  if (need("sizeBytes", "number")) {
    const s = o.sizeBytes as number;
    if (!Number.isSafeInteger(s)) issues.push({ field: "sizeBytes", kind: "type", message: "sizeBytes 应为整数" });
    else if (s <= MIN_APK || s > MAX_APK) issues.push({ field: "sizeBytes", kind: "value", message: `sizeBytes 超出范围：${s}` });
  }
  if (o.notes !== undefined && typeof o.notes !== "string") issues.push({ field: "notes", kind: "type", message: "notes 应为文本" });
  return issues.length ? { ok: false, issues } : { ok: true, manifest: { notes: "", ...(o as any) } as Manifest };
}

/** one line for the user, by kind of failure */
export function manifestProblem(issues: ManifestIssue[]): string {
  const k = issues.some((i) => i.kind === "missing") ? "字段缺失" : issues.some((i) => i.kind === "type") ? "字段类型错误" : "字段取值无效";
  return `更新清单${k}：${issues.map((i) => i.message).join("；")}`;
}

/** Native reject codes (HaizUpdateArgs.java) → category label shown before the detail. */
export const ERROR_LABEL: Record<string, string> = {
  NETWORK: "网络异常",
  MANIFEST_MISSING_FIELD: "更新信息字段缺失",
  MANIFEST_TYPE: "更新信息类型错误",
  MANIFEST_VALUE: "更新信息无效",
  SIZE_MISMATCH: "完整性校验失败（大小不符）",
  SHA_MISMATCH: "完整性校验失败（SHA-256 不符）",
  PACKAGE_MISMATCH: "签名校验失败（包名不同）",
  VERSION_NOT_NEWER: "版本校验失败",
  SIGNATURE_MISMATCH: "签名校验失败",
  NO_VERIFIED_APK: "没有已校验的安装包",
  BUSY: "正在下载",
  IO: "存储异常",
};

export function describeError(e: unknown): string {
  const any = e as { code?: string; message?: string } | null;
  const msg = any?.message ?? String(e);
  const label = any?.code ? ERROR_LABEL[any.code] : undefined;
  if (label) return msg.includes(label) ? msg : `${label}：${msg}`;
  if (/network|timeout|unable to resolve|failed to connect|connection/i.test(msg)) return `网络异常：${msg}`;
  return msg;
}
