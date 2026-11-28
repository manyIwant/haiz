/**
 * 校园身份 · the local identity repository. Every row belongs to one identity and every query is
 * scoped by its id, so identities never see each other's schedule, tasks, notes, favourites,
 * growth record or preferences. Deleting an identity deletes its records (ON DELETE CASCADE).
 */
import { db, type Row } from "./db";
import { SAMPLE, type IdentityData } from "../data/demo";

export type LampTone = "amber" | "ivory" | "jade" | "dusk";
export type Identity = {
  id: string; school: string; name: string; cls: string; no: string; role: "student" | "teacher";
  lamp: LampTone; seq: number; createdAt: number; updatedAt: number; lastUsedAt: number;
};
export type Prefs = { theme: "system" | "light" | "dark"; intensity: number; notify: boolean; railCompact: boolean; keyboard: "haiz" | "system" };
export const DEFAULT_PREFS: Prefs = { theme: "system", intensity: 1, notify: true, railCompact: false, keyboard: "haiz" };
export const KINDS = ["week", "tasks", "notes", "events", "growth", "notices", "favorites", "prefs", "teacher", "inbox", "intake"] as const;
export type Kind = (typeof KINDS)[number];

const toIdentity = (r: Row): Identity => ({
  id: r.id, school: r.school, name: r.name, cls: r.cls, no: r.no, role: r.role === "teacher" ? "teacher" : "student",
  lamp: (r.lamp || "amber") as LampTone, seq: Number(r.seq) || 0, createdAt: Number(r.created_at), updatedAt: Number(r.updated_at), lastUsedAt: Number(r.last_used_at) || 0,
});
const uid = () => "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export async function listIdentities(): Promise<Identity[]> {
  const e = await db();
  return (await e.query("SELECT * FROM identities ORDER BY seq ASC, created_at ASC")).map(toIdentity);
}
export async function getIdentity(id: string): Promise<Identity | null> {
  const e = await db();
  const r = await e.query("SELECT * FROM identities WHERE id = ?", [id]);
  return r[0] ? toIdentity(r[0]) : null;
}
export async function currentId(): Promise<string | null> {
  const e = await db();
  const r = await e.query("SELECT value FROM meta WHERE key = 'current'");
  return (r[0]?.value as string) || null;
}

export type NewIdentity = { school: string; name: string; cls?: string; no?: string; role?: "student" | "teacher"; lamp?: LampTone; startFrom?: "sample" | "blank"; prefs?: Partial<Prefs> };

export async function createIdentity(n: NewIdentity): Promise<Identity> {
  const e = await db();
  const id = uid(), now = Date.now();
  const seq = ((await e.query("SELECT COALESCE(MAX(seq), -1) + 1 AS s FROM identities"))[0]?.s as number) ?? 0;
  const blank = n.startFrom === "blank";
  const data: Record<Kind, unknown> = {
    week: clone(SAMPLE.WEEK),
    tasks: blank ? [] : clone(SAMPLE.TASKS),
    notes: blank ? [] : clone(SAMPLE.NOTES),
    events: blank ? [] : clone(SAMPLE.EVENTS),
    growth: blank ? { focus: [0, 0, 0, 0, 0, 0, 0], tasks: [0, 0, 0, 0, 0, 0, 0], reading: [0, 0, 0, 0, 0, 0, 0], streak: 0 } : clone(SAMPLE.GROWTH),
    notices: {},
    favorites: [],
    prefs: { ...DEFAULT_PREFS, ...(n.prefs ?? {}) },
    teacher: clone(SAMPLE.TEACHER),
    inbox: [],
    intake: { enabled: false, groups: [], sources: {} },
  };
  await e.run([
    { sql: "INSERT INTO identities (id, school, name, cls, no, role, lamp, seq, created_at, updated_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)",
      params: [id, n.school.trim(), n.name.trim(), (n.cls ?? "").trim(), (n.no ?? "").trim(), n.role ?? "student", n.lamp ?? "amber", seq, now, now] },
    ...KINDS.map((k) => ({ sql: "INSERT INTO records (identity_id, kind, json, updated_at) VALUES (?, ?, ?, ?)", params: [id, k, JSON.stringify(data[k]), now] })),
  ]);
  return (await getIdentity(id))!;
}

export async function updateIdentity(id: string, p: Partial<Pick<Identity, "school" | "name" | "cls" | "no" | "role" | "lamp">>) {
  const e = await db();
  const cur = await getIdentity(id);
  if (!cur) throw new Error("身份不存在");
  const n = { ...cur, ...p };
  await e.run([{ sql: "UPDATE identities SET school = ?, name = ?, cls = ?, no = ?, role = ?, lamp = ?, updated_at = ? WHERE id = ?", params: [n.school.trim(), n.name.trim(), n.cls.trim(), n.no.trim(), n.role, n.lamp, Date.now(), id] }]);
}

export async function markUsed(id: string) {
  const e = await db();
  await e.run([
    { sql: "UPDATE identities SET last_used_at = ? WHERE id = ?", params: [Date.now(), id] },
    { sql: "INSERT INTO meta (key, value) VALUES ('current', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", params: [id] },
  ]);
}

export async function deleteIdentity(id: string) {
  const e = await db();
  await e.run([
    { sql: "DELETE FROM records WHERE identity_id = ?", params: [id] },   // explicit as well as cascaded
    { sql: "DELETE FROM identities WHERE id = ?", params: [id] },
    { sql: "DELETE FROM meta WHERE key = 'current' AND value = ?", params: [id] },
  ]);
}

export async function readRecords(id: string): Promise<Partial<Record<Kind, any>>> {
  const e = await db();
  const out: Partial<Record<Kind, any>> = {};
  for (const r of await e.query("SELECT kind, json FROM records WHERE identity_id = ?", [id])) {
    try { out[r.kind as Kind] = JSON.parse(r.json); } catch { /* a damaged row falls back to defaults */ }
  }
  return out;
}

export async function writeRecords(id: string, recs: Partial<Record<Kind, unknown>>) {
  const e = await db();
  const now = Date.now();
  const stmts = Object.entries(recs).map(([k, v]) => ({
    sql: "INSERT INTO records (identity_id, kind, json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(identity_id, kind) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at",
    params: [id, k, JSON.stringify(v), now],
  }));
  if (stmts.length) await e.run(stmts);
}

/** everything the app needs to become this identity */
export async function loadIdentity(id: string): Promise<{ identity: Identity; data: IdentityData; prefs: Prefs; notices: Record<string, boolean>; favorites: string[]; inbox: any[]; intake: any } | null> {
  const identity = await getIdentity(id);
  if (!identity) return null;
  const r = await readRecords(id);
  return {
    identity,
    data: {
      profile: { name: identity.name, cls: identity.cls, no: identity.no, school: identity.school },
      week: r.week ?? clone(SAMPLE.WEEK), tasks: r.tasks ?? [], notes: r.notes ?? [], events: r.events ?? [],
      growth: r.growth ?? clone(SAMPLE.GROWTH), teacher: r.teacher ?? clone(SAMPLE.TEACHER),
    },
    prefs: { ...DEFAULT_PREFS, ...(r.prefs ?? {}) },
    notices: r.notices ?? {},
    favorites: r.favorites ?? [],
    inbox: Array.isArray(r.inbox) ? r.inbox : [],
    intake: r.intake ?? null,
  };
}

/* ---------------- backup, import, export ---------------- */
export const BACKUP_FORMAT = "haiz-identities";
export async function exportBackup(ids?: string[]) {
  const all = await listIdentities();
  const list = ids ? all.filter((i) => ids.includes(i.id)) : all;
  const identities = [];
  for (const i of list) identities.push({ ...i, records: await readRecords(i.id) });
  return { format: BACKUP_FORMAT, version: 1, exportedAt: new Date().toISOString(), app: "HAIZ Android", identities };
}

/** Merge a backup: an identity with the same id is replaced, any other is added. Returns the count. */
export async function importBackup(json: unknown): Promise<number> {
  const b = json as any;
  if (!b || b.format !== BACKUP_FORMAT || !Array.isArray(b.identities)) throw new Error("这不是 HAIZ 身份备份文件");
  const e = await db();
  let n = 0;
  for (const i of b.identities) {
    if (typeof i?.id !== "string" || typeof i?.name !== "string" || typeof i?.school !== "string") continue;
    const now = Date.now();
    const stmts = [
      { sql: "DELETE FROM records WHERE identity_id = ?", params: [i.id] },
      { sql: "DELETE FROM identities WHERE id = ?", params: [i.id] },
      { sql: "INSERT INTO identities (id, school, name, cls, no, role, lamp, seq, created_at, updated_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(seq), -1) + 1 FROM identities), ?, ?, ?)",
        params: [i.id, i.school, i.name, i.cls ?? "", i.no ?? "", i.role === "teacher" ? "teacher" : "student", i.lamp ?? "amber", Number(i.createdAt) || now, now, Number(i.lastUsedAt) || 0] },
      ...Object.entries(i.records ?? {}).filter(([k]) => (KINDS as readonly string[]).includes(k)).map(([k, v]) => ({
        sql: "INSERT INTO records (identity_id, kind, json, updated_at) VALUES (?, ?, ?, ?)", params: [i.id, k, JSON.stringify(v), now] })),
    ];
    await e.run(stmts);
    n++;
  }
  return n;
}
