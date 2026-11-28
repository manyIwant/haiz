/**
 * 收件 · the inbox of the current identity (HAIZ Native 002).
 *
 * The native queue (HaizIntakeStore: opt-in, chosen groups, task-like text) is imported into the
 * identity that is active, analysed on the phone (./analyze), deduplicated against what this
 * identity already has (Notice Hub's similar_text, 7 days, across groups), and kept as items
 * awaiting the student's confirmation. Messages that are not about a task are dropped at import.
 * Confirming turns an item into a task (待办) or a schedule entry (日程) of this identity; nothing
 * is created without that tap. The group list belongs to the identity and is handed to the native
 * filter whenever the identity becomes active.
 */
import { getState, setState, toast } from "../app/store";
import type { Event, Task } from "../data/demo";
import { HaizIntake, isNative, type IntakeEntry, type IntakeNativeConfig } from "../platform/native";
import { analyze, fmtWhen, similarText, splitNotification, KIND_LABEL, type Kind } from "./analyze";
import type { InboxItem, IntakeConfig, SourceKey } from "./types";

const MAX_ITEMS = 300;
const DUP_MS = 7 * 864e5;

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };

/** turn one raw message into an item, or null when it is not about a task (or is a repeat) */
export function intakeOne(raw: { id?: string; source: SourceKey; group: string; text: string; at: number }, have: InboxItem[]): { item: InboxItem | null; merged?: InboxItem[]; skipped?: boolean } {
  const split = raw.source === "share" || raw.source === "paste" ? { sender: "", body: raw.text.trim(), count: 1, mention: false } : splitNotification(raw.text);
  const body = split.body;
  if (!body) return { item: null };
  const result = analyze(body, split.sender, raw.at);
  if (split.mention && !result.tags.includes("broadcast")) result.tags.push("broadcast");
  // only what is about a task is kept, whatever the source
  if (!result.taskRelated) return { item: null, skipped: true };
  const dup = have.find((h) => Math.abs(h.receivedAt - raw.at) < DUP_MS && similarText(h.text, body));
  if (dup) {
    if (raw.group && raw.group !== dup.group && !(dup.also ?? []).includes(raw.group)) {
      return { item: null, merged: have.map((h) => (h === dup ? { ...h, also: [...(h.also ?? []), raw.group] } : h)) };
    }
    return { item: null };
  }
  return {
    item: {
      id: raw.id ?? "ib-" + hash(raw.source + raw.group + body) + raw.at.toString(36),
      source: raw.source, group: raw.group, sender: split.sender, text: body, receivedAt: raw.at, result, status: "pending",
    },
  };
}

/** import a batch into the current identity; returns how many new items awaited confirmation */
export function importEntries(entries: { id?: string; source: string; group: string; text: string; at: number }[]): number {
  if (!getState().identity) return 0;
  let items = getState().inbox;
  let added = 0;
  for (const e of [...entries].sort((a, b) => a.at - b.at)) {
    const src = (["wechat", "qq", "tim", "dingtalk", "chaoxing", "share", "paste"].includes(e.source) ? e.source : "share") as SourceKey;
    const r = intakeOne({ ...e, source: src }, items);
    if (r.merged) items = r.merged;
    if (r.item) { items = [r.item, ...items]; added++; }
  }
  if (items !== getState().inbox) setState({ inbox: items.slice(0, MAX_ITEMS) });
  return added;
}

/* ---------------------------------------------------------------- native */
let listening = false;
async function pullNative(announce: boolean) {
  if (!isNative() || !getState().identity) return;
  try {
    const { entries } = await HaizIntake.entries();
    if (!entries.length) return;
    const n = importEntries(entries);
    await HaizIntake.ack({ ids: entries.map((e) => e.id) });
    if (announce && n) toast(n === 1 ? "收件：1 条班群通知待确认" : `收件：${n} 条班群通知待确认`, { tone: "lit" });
  } catch (e) { console.warn("[intake] import failed", e); }
}

/** the identity became active: hand its group list to the native filter, then take the queue */
export async function onIdentityActivated() {
  if (!isNative()) return;
  await pushConfig(getState().intake);
  if (!listening) {
    listening = true;
    HaizIntake.addListener("entry", (_e: IntakeEntry) => { void pullNative(true); }).catch(() => {});
    document.addEventListener("visibilitychange", () => { if (!document.hidden) void pullNative(true); });
  }
  await pullNative(true);
}

export async function pushConfig(c: IntakeConfig): Promise<IntakeNativeConfig | null> {
  if (!isNative()) return null;
  try { return await HaizIntake.setConfig({ enabled: c.enabled, groups: c.groups, sources: c.sources as Record<string, boolean> }); }
  catch (e) { console.warn("[intake] config failed", e); return null; }
}

export function setIntake(p: Partial<IntakeConfig>) {
  const next = { ...getState().intake, ...p };
  if (!next.groups.length) next.enabled = next.enabled && false;
  setState({ intake: next });
  return pushConfig(next);
}

/* ---------------------------------------------------------------- decide */
const patch = (id: string, f: (i: InboxItem) => InboxItem) => setState((s) => ({ inbox: s.inbox.map((i) => (i.id === id ? f(i) : i)) }));
export const editItem = (id: string, edit: InboxItem["edit"]) => patch(id, (i) => ({ ...i, edit: { ...i.edit, ...edit } }));
export const dismissItem = (id: string) => patch(id, (i) => ({ ...i, status: "dismissed", decidedAt: Date.now() }));
export const restoreItem = (id: string) => patch(id, (i) => ({ ...i, status: "pending", decidedAt: undefined }));
export const deleteItem = (id: string) => setState((s) => ({ inbox: s.inbox.filter((i) => i.id !== id) }));

export function view(i: InboxItem) {
  const e = i.edit ?? {};
  return {
    title: e.title ?? i.result.title,
    subject: e.subject ?? i.result.subject,
    kind: (e.kind ?? i.result.kind) as Kind,
    due: e.due !== undefined ? e.due : i.result.due ?? i.result.start,
  };
}

/** 加入待办: a task of this identity, with where it came from in its note */
export function confirmAsTask(id: string) {
  const i = getState().inbox.find((x) => x.id === id);
  if (!i) return;
  const v = view(i);
  const t: Task = {
    id: "ib" + Date.now().toString(36), title: v.title, subject: v.subject, due: v.due ? fmtWhen(v.due) : "未定",
    note: `${i.text}\n— 来自${i.group ? `「${i.group}」` : ""}${i.sender ? ` · ${i.sender}` : ""}（收件识别，已确认）`,
    done: false, urgent: i.result.category === "urgent", mine: true,
  };
  setState((s) => ({
    tasks: [t, ...s.tasks],
    inbox: s.inbox.map((x) => (x.id === id ? { ...x, status: "confirmed", decidedAt: Date.now(), linked: { ...x.linked, taskId: t.id } } : x)),
  }));
  toast(`已加入待办：${v.title.slice(0, 18)}`, { tone: "lit" });
}

/** 加入日程: an event of this identity on the recognised day */
export function confirmAsEvent(id: string) {
  const i = getState().inbox.find((x) => x.id === id);
  if (!i) return;
  const v = view(i);
  const when = v.due ? new Date(v.due) : null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = when ? Math.round((new Date(when.getFullYear(), when.getMonth(), when.getDate()).getTime() - today.getTime()) / 864e5) : 0;
  const ev: Event = {
    id: "ie" + Date.now().toString(36), day, date: when ? v.due!.slice(0, 10) : undefined,
    time: when && !i.result.allDay ? `${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}` : "全天",
    title: v.title, place: i.result.where ?? (i.group || "班群通知"), kind: v.kind === "exam" ? "exam" : v.kind === "event" ? "school" : "me",
  };
  setState((s) => ({
    events: [...s.events, ev],
    inbox: s.inbox.map((x) => (x.id === id ? { ...x, status: "confirmed", decidedAt: Date.now(), linked: { ...x.linked, eventId: ev.id } } : x)),
  }));
  toast(`已加入日程：${KIND_LABEL[v.kind]} · ${v.title.slice(0, 14)}`, { tone: "lit" });
}
