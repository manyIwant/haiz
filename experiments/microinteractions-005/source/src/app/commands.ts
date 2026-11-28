/** What the command lens (desk) and the search lens (phone) can find. */
import type { IconKind } from "../icons/kinetic";
import { NOTES, CLUBS, WEEK } from "../data/demo";
import { getState, setState, startFocus, toast, isDark } from "./store";
import { go } from "./router";

export type Cmd = { id: string; group: "跳转" | "内容" | "操作"; title: string; meta?: string; icon: IconKind; keys: string; run: () => void };

export function allCommands(): Cmd[] {
  const s = getState();
  const pages: Cmd[] = [
    ["today", "今日", "today", "jinri today 课程 待办"],
    ["schedule", "日程", "schedule", "richeng 课表 周 schedule"],
    ["focus", "专注", "focus", "zhuanzhu 番茄 计时 focus"],
    ["study", "学习", "study", "xuexi 笔记 实验 study"],
    ["growth", "成长记录", "growth", "chengzhang 统计 growth"],
    ["campus/notice", "校园 · 公告", "notice", "xiaoyuan gonggao 通知 notice"],
    ["campus/club", "校园 · 社团", "club", "shetuan club"],
    ["campus/map", "校园 · 地图", "map", "ditu 地图 楼 map"],
    ["rings", "年轮", "rings", "nianlun 天气 气候 rings"],
    ["tree", "榄仁", "tree", "lanren 榄仁树 物候 tree"],
    ["wander", "入画", "wander", "ruhua 画 wander"],
    ["me", "我 · 设置", "me", "wo shezhi 主题 settings"],
    ["teacher", "教师工作台", "teacher", "jiaoshi 发布 作业 teacher"],
  ].map(([to, title, icon, keys]) => ({ id: "p:" + to, group: "跳转" as const, title, icon: icon as IconKind, keys: title + " " + keys, run: () => go(to) }));
  const content: Cmd[] = [
    ...s.tasks.filter((t) => !t.done).map((t) => ({ id: "t:" + t.id, group: "内容" as const, title: t.title, meta: `待办 · ${t.due}`, icon: "plus" as IconKind, keys: t.title + t.subject, run: () => { go("today"); setState({ inspector: { kind: "task", id: t.id } }); } })),
    ...s.notices.map((n) => ({ id: "n:" + n.id, group: "内容" as const, title: n.title, meta: `${n.from} · ${n.time}`, icon: "notice" as IconKind, keys: n.title + n.from + n.tag, run: () => { go("campus/notice"); setState({ inspector: { kind: "notice", id: n.id } }); } })),
    ...NOTES.map((m) => ({ id: "m:" + m.id, group: "内容" as const, title: m.title, meta: `笔记 · ${m.subject}`, icon: "notes" as IconKind, keys: m.title + m.subject + m.excerpt, run: () => { go("study"); setState({ inspector: { kind: "note", id: m.id } }); } })),
    ...CLUBS.map((c) => ({ id: "c:" + c.id, group: "内容" as const, title: c.name, meta: `社团 · ${c.next}`, icon: "club" as IconKind, keys: c.name + c.meta, run: () => { go("campus/club"); setState({ inspector: { kind: "club", id: c.id } }); } })),
    ...Array.from(new Set(WEEK.flat().map((c) => c.subject))).map((sub) => {
      const c = WEEK.flat().find((x) => x.subject === sub)!;
      return { id: "k:" + sub, group: "内容" as const, title: sub, meta: `课程 · ${c.building} ${c.room} · ${c.teacher}`, icon: "schedule" as IconKind, keys: sub + c.building + c.teacher, run: () => go("schedule") };
    }),
  ];
  const actions: Cmd[] = [
    { id: "a:f25", group: "操作", title: "开始专注 25 分钟", icon: "focus", keys: "kaishi zhuanzhu 25 focus start", run: () => { startFocus(25); go("focus"); } },
    { id: "a:f45", group: "操作", title: "开始专注 45 分钟", icon: "focus", keys: "kaishi zhuanzhu 45 focus start", run: () => { startFocus(45); go("focus"); } },
    { id: "a:theme", group: "操作", title: isDark() ? "切换到浅色" : "切换到深色", icon: "theme", keys: "zhuti 主题 深色 浅色 dark light theme", run: () => setState({ theme: isDark() ? "light" : "dark" }) },
    { id: "a:read", group: "操作", title: "全部通知标为已读", icon: "bell", keys: "yidu 已读 通知 read", run: () => { setState((st) => ({ notices: st.notices.map((n) => ({ ...n, unread: false })) })); toast("已全部标为已读"); } },
    { id: "a:role", group: "操作", title: s.role === "teacher" ? "切换到学生身份" : "切换到教师身份（演示）", icon: "teacher", keys: "qiehuan 身份 教师 学生 role", run: () => { const r = getState().role === "teacher" ? "student" : "teacher"; setState({ role: r }); go(r === "teacher" ? "teacher" : "today"); } },
    { id: "a:map", group: "操作", title: "在地图上找图书馆", icon: "map", keys: "tushuguan 图书馆 地图 library", run: () => go("campus/map") },
  ];
  return [...pages, ...actions, ...content];
}

export function search(q: string): Cmd[] {
  const all = allCommands();
  const t = q.trim().toLowerCase();
  if (!t) return [...all.filter((c) => c.group === "操作").slice(0, 3), ...all.filter((c) => c.group === "跳转").slice(0, 5)];
  const score = (c: Cmd) => {
    const a = c.title.toLowerCase(), k = c.keys.toLowerCase();
    if (a.startsWith(t)) return 3;
    if (a.includes(t)) return 2;
    if (k.includes(t)) return 1;
    // every character in order (a forgiving match for 2–3 character Chinese queries)
    let i = 0;
    for (const ch of k) if (ch === t[i]) i++;
    return i === t.length ? 0.5 : 0;
  };
  return all.map((c) => ({ c, s: score(c) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 9).map((x) => x.c);
}
