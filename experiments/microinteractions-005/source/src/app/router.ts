/** Hash routes: #/today, #/campus/map, #/rings … Static hosting needs nothing more. */
import { useSyncExternalStore } from "react";

export type Route = { page: string; sub: string; raw: string };
export const PRIMARY = ["today", "study", "campus", "me"] as const;
export const PAGES = ["today", "study", "focus", "schedule", "growth", "campus", "rings", "tree", "wander", "me", "teacher"] as const;

const parse = (h: string): Route => {
  const parts = h.replace(/^#\/?/, "").split("/").filter(Boolean);
  const page = (PAGES as readonly string[]).includes(parts[0]) ? parts[0] : "today";
  return { page, sub: parts[1] ?? "", raw: `${page}${parts[1] ? "/" + parts[1] : ""}` };
};
let cur = parse(typeof location === "undefined" ? "" : location.hash);
let origin: { x: number; y: number } | null = null;
let dir = 1;
const subs = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    const n = parse(location.hash);
    if (n.raw !== cur.raw) { cur = n; subs.forEach((f) => f()); }
  });
}
export function useRoute(): Route {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => cur, () => cur);
}
/** Navigate. `from` is where the gesture came from: the new page reveals outward from it. */
export function go(to: string, from?: { x: number; y: number } | Element | null) {
  if (from instanceof Element) { const r = from.getBoundingClientRect(); origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  else origin = from ?? null;
  const n = parse("#/" + to);
  dir = (PAGES as readonly string[]).indexOf(n.page) >= (PAGES as readonly string[]).indexOf(cur.page) ? 1 : -1;
  if (n.raw === cur.raw) return;
  location.hash = "#/" + n.raw;
}
export const takeOrigin = () => { const o = origin; origin = null; return o; };
export const lastDir = () => dir;

export const TITLES: Record<string, string> = {
  today: "今日", study: "学习", focus: "专注", schedule: "日程", growth: "成长记录", campus: "校园",
  rings: "年轮", tree: "榄仁", wander: "入画", me: "我", teacher: "教师工作台",
};
export const CAMPUS_SUBS: Record<string, string> = { "": "公告", notice: "公告", club: "社团", map: "地图", culture: "文化" };
