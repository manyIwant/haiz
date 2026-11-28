/**
 * 收件 · local notice analysis (HAIZ Native 002).
 *
 * A TypeScript port of the parts of Notice Hub (github.com/ExpertKT/notice-hub) that decide what a
 * class-group message is: qq_digest.analyze_message (word lists, scoring, categories, colloquial
 * question and acknowledgement filters), ingest/event_extract.extract_events (dates, clocks,
 * periods, deadlines, places), summarizer's local action line and similar_text dedupe, plus HAIZ
 * Pocket's notice_parser (PR #38/#41: subjects, the HAIZ teacher export line). Everything runs on
 * the phone; there is no model and no network. Every result is a candidate the student confirms.
 */

/* ------------------------------------------------------------------ words */
export const URGENT_WORDS = ["紧急", "加急", "火速", "立刻", "立即", "马上", "尽快", "务必", "速交", "速回", "截至", "截止", "最晚", "过期不候", "逾期", "最后期限"];
export const ACTION_WORDS = ["提交", "上交", "交到", "交至", "填写", "填好", "填报", "完成", "报名", "签到", "确认", "回复", "参加", "准备", "上传", "下载", "打印", "领取", "缴纳", "缴费", "注册", "选课", "集合", "开会", "参加考试", "复习", "预习", "背诵", "默写", "订正", "抄写", "完成作业", "汇总", "统计", "登记", "核对", "投票", "接龙", "交表", "发到", "发给", "发送给", "带好", "带上", "签字", "收齐"];
export const ACADEMIC_WORDS = ["作业", "实验", "报告", "论文", "课程", "考试", "测验", "期中", "期末", "月考", "模考", "小测", "听写", "课设", "实践", "实习", "学分", "选课", "习题", "练习册", "教材", "课后", "大作业", "答辩", "开题", "试卷", "错题", "周测"];
const ADMIN_WORDS = ["通知", "安排", "表格", "名单", "材料", "盖章", "签字", "审核", "备案", "报名表", "统一", "班级", "年级", "学院", "教务", "班会", "会议", "场地", "宿舍", "家长会"];
const AUTHORITY_WORDS = ["老师", "辅导员", "教务", "班主任", "班长", "学委", "学习委员", "课代表", "年级", "学院", "办公室", "官方", "管理员", "群主", "助教", "任课", "系主任"];
const DIRECTIVE_WORDS = ["请", "务必", "需要", "要求", "必须", "记得", "别忘", "不要忘", "统一", "一律", "按时", "尽快", "大家", "全体", "各位", "所有"];
const ACK_ONLY = new Set(["收到", "好的", "好", "谢谢", "谢啦", "嗯", "嗯嗯", "ok", "OK", "1", "+1", "辛苦了", "收到收到", "好嘞"]);
const CHATTER = ["哈哈哈", "哈哈", "hhhh", "233", "笑死", "梗图", "表情包", "狗头"];
const PLACEHOLDER = /^\s*\[(?:文件|图片|视频|语音|表情|动画表情|位置|链接|音乐|小程序)\]/;
const BROADCAST = ["全体成员", "大家", "各位同学", "全体同学", "所有同学", "@所有人"];
const SUBJECTS = ["语文", "数学", "英语", "物理", "化学", "生物", "历史", "地理", "政治", "道法", "体育", "信息", "技术", "通用", "美术", "音乐"];
const PAST = ["上次", "上回", "上上周", "上周", "昨天", "昨日", "前天", "上个月", "去年", "已经", "早就", "已结束", "结束了", "开完了"];
const DEADLINE_WORDS = ["截止", "提交", "交作业", "交表", "上报", "报名", "填表", "交材料", "前交", "之前交", "月底", "上交", "收齐"];
const EVENT_VERBS = ["开会", "集合", "上课", "面试", "报到", "考试", "聚餐", "答辩", "体检", "培训", "讲座", "报名", "交作业", "提交", "截止", "见面", "参加", "补课", "值班", "升旗", "演练", "比赛", "汇报", "签到", "活动", "班会", "家长会", "排练", "听写", "默写", "测验"];
const PERIODS = ["凌晨", "早晨", "早上", "上午", "中午", "下午", "傍晚", "晚上", "夜里", "晚自习", "晚"];
const PERIOD_HOUR: Record<string, number> = { "凌晨": 6, "早晨": 7, "早上": 9, "上午": 9, "中午": 12, "下午": 14, "傍晚": 18, "晚上": 19, "夜里": 20, "晚自习": 19, "晚": 19 };
const PLACE_SUFFIX = ["活动中心", "收发室", "办公室", "会议室", "报告厅", "体育馆", "实验室", "多媒体教室", "教学楼", "图书馆", "田径场", "篮球场", "大厅", "广场", "门口", "礼堂", "食堂", "操场", "机房", "教室", "宿舍", "楼", "栋", "室"];

/* ------------------------------------------------------------------ text */
const INVISIBLE = /[​‌‍﻿]/g;
export function cleanText(v: unknown): string {
  return String(v ?? "").replace(INVISIBLE, "").replace(/\r\n?/g, "\n").replace(/[\s 　]+/g, " ").trim();
}
export function normalize(v: unknown): string {
  return cleanText(v).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}
const hits = (body: string, words: readonly string[]) => words.filter((w) => body.includes(w));
export function hasDirective(text: string) {
  const b = cleanText(text);
  return !!b && (DIRECTIVE_WORDS.some((w) => b.includes(w)) || ACTION_WORDS.some((w) => b.includes(w)));
}
/** a passing question in the chat, not a notice (a question with a directive is still a notice) */
export function isColloquialQuestion(text: string) {
  const b = cleanText(text);
  if (!b || b.length < 6 || hasDirective(b)) return false;
  if (["截止", "报名", "提交", "填写", "务必", "统一"].some((w) => b.includes(w))) return false;
  if (/[?？]\s*$/.test(b)) return true;
  return ["吗", "呢", "吧", "么"].some((m) => b.includes(m)) && b.length >= 12;
}

/* ---------------------------------------------- similar text (dedupe) */
/** Ratcliff–Obershelp-style ratio like Python's difflib, via the longest common subsequence */
function ratio(a: string, b: string) {
  if (!a.length && !b.length) return 1;
  const n = Math.min(a.length, 600), m = Math.min(b.length, 600);
  let prev = new Uint16Array(m + 1), cur = new Uint16Array(m + 1);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    [prev, cur] = [cur, prev];
  }
  return (2 * prev[m]) / (n + m);
}
/** the same message? short texts must match exactly; containment counts when lengths are close */
export function similarText(left: string, right: string, threshold = 0.88) {
  const a = normalize(left), b = normalize(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length < 12 || b.length < 12) return false;
  if ((a.includes(b) || b.includes(a)) && Math.min(a.length, b.length) >= 0.7 * Math.max(a.length, b.length)) return true;
  return ratio(a, b) >= threshold;
}

/* ------------------------------------------------------------- numbers */
const CN: Record<string, number> = { "零": 0, "〇": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9 };
export function cnInt(t: string): number | null {
  const v = (t || "").trim();
  if (!v) return null;
  if (/^\d+$/.test(v)) return parseInt(v, 10);
  if (v.includes("十")) {
    const [l, r] = v.split("十");
    const tens = l ? cnInt(l) : 1, ones = r ? cnInt(r) : 0;
    return tens === null || ones === null ? null : tens * 10 + ones;
  }
  let n = 0;
  for (const c of v) { if (!(c in CN)) return null; n = n * 10 + CN[c]; }
  return n;
}

/* --------------------------------------------------------------- time */
const WEEKDAY: Record<string, number> = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "日": 7, "天": 7 };
const RELATIVE: Record<string, number> = { "大后天": 3, "后天": 2, "明天": 1, "明日": 1, "明早": 1, "明晨": 1, "明晚": 1, "今天": 0, "今日": 0, "今早": 0, "今晚": 0, "今天晚上": 0 };
const RELATIVE_RE = new RegExp(Object.keys(RELATIVE).sort((a, b) => b.length - a.length).join("|"));
const WEEK_RE = /(下下周|下周|本周|这周|下个|这个)?\s*(?:周|星期|礼拜)([一二三四五六日天])/;
const MONTH_DAY_RE = /(?:(20\d{2})\s*年\s*)?(\d{1,2}|[一二三四五六七八九十]{1,2})\s*[月/.-]\s*(\d{1,2}|[一二三四五六七八九十]{1,3})\s*[日号]?/;
const ISO_RE = /(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/;
const BARE_DAY_RE = /(?<![\d月/\-.])([一二两三四五六七八九十]{1,3}|\d{1,2})\s*[号日](?![楼线\d])/g;
const DEADLINE_BEFORE_RE = /[号日]\s*(?:之?前)(?![后头])/;
const CLOCK_RE = /(\d{1,2}|[零〇一二两三四五六七八九十]{1,3})\s*(?:点|时|[:：])\s*(\d{1,2}|[零〇一二两三四五六七八九十]{1,3}|半|一刻|三刻|整)?/g;
const ZAO_RE = /(?<![早凌])早([一二两三四五六七八九十]|\d{1,2})(?![点时\d分刻])/g;

const day0 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
function validDate(y: number, m: number, d: number) {
  const t = new Date(y, m - 1, d);
  return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d ? t : null;
}
function periodBefore(text: string, pos: number) {
  const w = text.slice(Math.max(0, pos - 6), pos);
  for (const p of [...PERIODS].sort((a, b) => b.length - a.length)) if (w.lastIndexOf(p) >= 0) return p;
  return "";
}
function periodAnywhere(text: string) {
  for (const p of [...PERIODS].sort((a, b) => b.length - a.length)) if (text.includes(p)) return p;
  return "";
}
const applyPeriod = (h: number, p: string) => (["下午", "傍晚", "晚上", "夜里", "晚", "晚自习"].includes(p) && h < 12) || (p === "中午" && h < 11) ? h + 12 : h;

type Clock = { h: number; m: number; s: number; e: number };
function clocks(text: string): Clock[] {
  const out: Clock[] = [];
  for (const mt of text.matchAll(CLOCK_RE)) {
    const s = mt.index!;
    // 「3点钟」yes; 「3点建议」 is still a clock; but 「第3点」「几点」 are not
    if (text[s - 1] === "第") continue;
    const h0 = cnInt(mt[1]);
    if (h0 === null) continue;
    const mm = mt[2] ?? "";
    const m = mm === "半" ? 30 : mm === "一刻" ? 15 : mm === "三刻" ? 45 : mm === "整" || mm === "" ? 0 : cnInt(mm);
    if (m === null) continue;
    // a bare 「3」 followed by 「：」 inside a list (「注意：」) is not a clock: need a digit-like hour
    const h = applyPeriod(h0, periodBefore(text, s));
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) out.push({ h, m, s, e: s + mt[0].length });
  }
  for (const mt of text.matchAll(ZAO_RE)) {
    const s = mt.index!;
    if (out.some((c) => c.s <= s && s < c.e)) continue;
    const h = cnInt(mt[1]);
    if (h !== null && h >= 1 && h <= 12) out.push({ h, m: 0, s, e: s + mt[0].length });
  }
  return out.sort((a, b) => a.s - b.s);
}

function findDate(text: string, now: Date): { date: Date | null; s: number; e: number; period: string } {
  const today = day0(now);
  const c: { at: number; date: Date; s: number; e: number; period: string }[] = [];
  const rel = RELATIVE_RE.exec(text);
  if (rel) {
    const w = rel[0];
    const period = ["今早", "明早", "明晨"].includes(w) ? "早上" : ["今晚", "明晚", "今天晚上"].includes(w) ? "晚上" : "";
    c.push({ at: rel.index, date: addDays(today, RELATIVE[w]), s: rel.index, e: rel.index + w.length, period });
  }
  const wk = WEEK_RE.exec(text);
  if (wk) {
    const day = WEEKDAY[wk[2]];
    const monday = addDays(today, -(((now.getDay() + 6) % 7)));
    let prefix = wk[1] ?? "";
    if (!prefix && wk.index > 0 && "下本这".includes(text[wk.index - 1])) prefix = text[wk.index - 1];
    let t: Date;
    if (prefix === "下周" || prefix === "下") t = addDays(monday, 7 + day - 1);
    else if (prefix === "下下周" || prefix === "下个") t = addDays(monday, 14 + day - 1);
    else if (["本周", "这周", "这个", "本", "这"].includes(prefix)) t = addDays(monday, day - 1);
    else { t = addDays(monday, day - 1); if (t < today) t = addDays(t, 7); }
    c.push({ at: wk.index, date: t, s: wk.index, e: wk.index + wk[0].length, period: "" });
  }
  const iso = ISO_RE.exec(text);
  const md = iso ? null : MONTH_DAY_RE.exec(text);
  if (iso) {
    const t = validDate(+iso[1], +iso[2], +iso[3]);
    if (t) c.push({ at: iso.index, date: t, s: iso.index, e: iso.index + iso[0].length, period: "" });
  } else if (md) {
    const mo = cnInt(md[2]), d = cnInt(md[3]), y = md[1] ? +md[1] : null;
    let t: Date | null = null;
    if (mo && d) {
      if (y) t = validDate(y, mo, d);
      else { t = validDate(now.getFullYear(), mo, d); if (t && t < addDays(today, -60)) t = validDate(now.getFullYear() + 1, mo, d); }
    }
    if (t) c.push({ at: md.index, date: t, s: md.index, e: md.index + md[0].length, period: "" });
  }
  const me = /(?<![\d号日])月底/.exec(text);
  if (me && !/^\s*(?:[一二两三四五六七八九十]{1,3}|\d{1,2})\s*[号日]/.test(text.slice(me.index + 2))) {
    c.push({ at: me.index, date: new Date(now.getFullYear(), now.getMonth() + 1, 0), s: me.index, e: me.index + 2, period: "" });
  }
  // a bare 「28号」 only counts in a deadline context, never 「3号楼」, never inside a month-day
  if (DEADLINE_BEFORE_RE.test(text) || DEADLINE_WORDS.some((w) => text.includes(w))) {
    for (const b of text.matchAll(BARE_DAY_RE)) {
      const s = b.index!, e = s + b[0].length;
      if (md && !(e <= md.index || s >= md.index + md[0].length)) continue;
      if (iso && !(e <= iso.index || s >= iso.index + iso[0].length)) continue;
      const d = cnInt(b[1]);
      if (!d || d < 1 || d > 31) continue;
      let t = validDate(now.getFullYear(), now.getMonth() + 1, d);
      if (t && t < today) t = validDate(now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear(), ((now.getMonth() + 1) % 12) + 1, d);
      if (t) { c.push({ at: s, date: t, s, e, period: "" }); break; }
    }
  }
  if (!c.length) return { date: null, s: 0, e: 0, period: "" };
  c.sort((a, b) => a.at - b.at);
  return { date: c[0].date, s: c[0].s, e: c[0].e, period: c[0].period };
}

function findPlace(text: string): string | null {
  const suf = PLACE_SUFFIX.slice().sort((a, b) => b.length - a.length).join("|");
  const m = new RegExp(`(?:在|于|到|地点[:：]?)\\s*([A-Za-z0-9\\u4e00-\\u9fa5]{0,12}?(?:${suf})(?:\\s?[A-Za-z0-9\\-]{1,6})?)`).exec(text)
    ?? new RegExp(`([A-Za-z0-9\\u4e00-\\u9fa5]{1,10}?(?:${suf})(?:\\s?[A-Za-z0-9\\-]{1,6})?)`).exec(text);
  if (!m) return null;
  const p = m[1].replace(/^(?:今天|明天|后天|下周.|本周.|周.|上午|下午|晚上|中午)/, "").trim();
  if (!p || /^(?:今|明|后|本|下|上|这)?(?:天|日|周|星期)/.test(p)) return null;
  return p.length >= 2 ? p : null;
}

export type When = { start: Date | null; end: Date | null; deadline: boolean; where: string | null; allDay: boolean };
/** the first future time a message talks about, its place, and whether it is a deadline */
export function extractWhen(text: string, now = new Date()): When {
  const out: When = { start: null, end: null, deadline: false, where: null, allDay: false };
  for (const raw of text.split(/[。；;！!\n]+/)) {
    const clause = raw.trim();
    if (!clause) continue;
    if (PAST.some((p) => clause.includes(p))) continue;
    if (/[？?]$/.test(clause) || ["几点", "什么时间", "什么时候", "哪天"].some((w) => clause.includes(w))) continue;
    const d = findDate(clause, now);
    const cl = clocks(clause);
    const deadline = DEADLINE_WORDS.some((w) => clause.includes(w)) || DEADLINE_BEFORE_RE.test(clause) || /[前之]前?(?:交|提交|上交|发)/.test(clause);
    if (!d.date && !cl.length) { out.where ??= findPlace(clause); continue; }
    const period = d.period || (cl.length ? periodBefore(clause, cl[0].s) : periodAnywhere(clause));
    let h: number, m: number, allDay = false;
    if (cl.length) {
      const endOnly = clause[cl[0].s - 1] === "到";
      if (endOnly) { [h, m] = deadline ? [23, 59] : [PERIOD_HOUR[period] ?? 9, 0]; }
      else { h = cl[0].h; m = cl[0].m; }
    } else if (deadline) { h = 23; m = 59; }
    else if (period) { h = PERIOD_HOUR[period] ?? 9; m = 0; }
    else { h = 8; m = 0; allDay = true; }
    let start: Date;
    if (d.date) start = new Date(d.date.getFullYear(), d.date.getMonth(), d.date.getDate(), h, m);
    else { start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m); if (start < now) start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, h, m); }
    let end: Date | null = null;
    if (cl.length > 1 && /^\s*(?:到|至|-|—|–|~|～)\s*$/.test(clause.slice(cl[0].e, cl[1].s))) {
      let eh = cl[1].h;
      if (!periodBefore(clause, cl[1].s) && period) eh = applyPeriod(eh, period);
      end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), eh, cl[1].m);
      if (end <= start && eh < 12) end.setHours(eh + 12);
      if (end <= start) end = null;
    }
    out.start = start; out.end = end; out.deadline = deadline; out.allDay = allDay;
    out.where = findPlace(clause) ?? out.where;
    break;
  }
  return out;
}

/* ------------------------------------------------------------ analysis */
export type Category = "urgent" | "action" | "academic" | "info";
export type Kind = "homework" | "exam" | "event" | "deadline" | "notice";
export const KIND_LABEL: Record<Kind, string> = { homework: "作业", exam: "考试", event: "活动", deadline: "截止", notice: "通知" };
export const CATEGORY_LABEL: Record<Category, string> = { urgent: "紧急", action: "待办", academic: "学业", info: "通知" };
export type Analysis = {
  category: Category; kind: Kind; score: number; tags: string[];
  subject: string; title: string; summary: string;
  due: string | null; start: string | null; end: string | null; where: string | null; allDay: boolean;
  confidence: "high" | "medium" | "low"; ambiguous: boolean; colloquial: boolean; taskRelated: boolean;
  reasons: string[];
};

const SENT = /[。！？!?；;\n]+/;
const trim = (t: string, n: number) => (t.length <= n ? t : t.slice(0, n - 1).trimEnd() + "…");
/** the sentence that says what to do (Notice Hub's local_action) */
export function actionLine(text: string, limit = 60) {
  const b = cleanText(text);
  for (const p of b.split(SENT)) { const c = p.replace(/^[\s，、]+|[\s，、]+$/g, ""); if (ACTION_WORDS.some((w) => c.includes(w)) || ACADEMIC_WORDS.some((w) => c.includes(w))) return trim(stripLead(c), limit); }
  return trim(stripLead(b), limit);
}
function summaryLine(text: string, limit = 90) {
  const b = cleanText(text);
  for (const p of b.split(SENT)) { const c = p.trim(); if (c.length >= 6) return trim(c, limit); }
  return trim(b, limit);
}
const stripLead = (s: string) => s.replace(/^(?:@所有人\s*|【[^】]{0,12}】\s*|(?:老师)?通知[:：]\s*|作业[:：]\s*|各位(?:同学|家长)[,，:：]?\s*|大家[,，:：]?\s*|请大家\s*)+/, "").trim() || s;

/** HAIZ teacher workspace export: 【HAIZ任务】科目｜标题｜YYYY-MM-DD 或 待定｜来源 */
function structured(text: string) {
  const m = /【HAIZ任务】\s*([^｜|]+)[｜|]([^｜|]+)[｜|](\d{4}-\d{2}-\d{2}|待定)(?:[｜|](.*))?/.exec(text);
  if (!m) return null;
  return { subject: m[1].trim(), title: m[2].trim(), due: m[3] === "待定" ? null : new Date(m[3] + "T23:59:00") };
}

export function analyze(text: string, sender = "", at = Date.now()): Analysis {
  const body = cleanText(text);
  const now = new Date(at);
  const reasons: string[] = [];
  const urgent = hits(body, URGENT_WORDS), action = hits(body, ACTION_WORDS), academic = hits(body, ACADEMIC_WORDS);
  const admin = hits(body, ADMIN_WORDS), authority = hits(sender, AUTHORITY_WORDS), directive = hits(body, DIRECTIVE_WORDS);
  const colloquial = isColloquialQuestion(body);
  const broadcast = BROADCAST.some((w) => body.includes(w));
  let score = 0;
  if (urgent.length) score += 3;
  if (action.length) score += 2;
  if (academic.length) score += 2;
  if (admin.length) score += 1;
  if (authority.length) score += 2;
  if (broadcast) score += 1;
  if (/https?:\/\//.test(body)) score += 1;
  if (body.length >= 80) score += 1;
  const placeholder = PLACEHOLDER.test(body);
  if (placeholder && !action.length && !directive.length) score -= 6;
  if (body.length <= 5) score -= 3;
  if (ACK_ONLY.has(body)) score -= 4;
  if (CHATTER.some((c) => body.includes(c))) score -= 6;
  if (colloquial) score -= 6;

  const st = structured(body);
  const when = colloquial || (placeholder && !hasDirective(body)) ? { start: null, end: null, deadline: false, where: null, allDay: false } as When : extractWhen(body, now);
  if (st?.due) { when.start = st.due; when.deadline = true; }
  if (when.start) { score += 1; if (when.start.getTime() - at <= 864e5 && when.start.getTime() >= at) { score += 1; urgent.push("一天内"); } }

  const tags = new Set<string>();
  if (urgent.length && !colloquial) tags.add("urgent");
  if (action.length) tags.add("action");
  if (academic.length) tags.add("academic");
  if (admin.length) tags.add("notice");
  if (when.start && !colloquial) tags.add("deadline");
  if (authority.length) tags.add("authority");
  if (broadcast) tags.add("broadcast");

  const category: Category = colloquial ? "info" : urgent.length || (when.start && score >= 6) ? "urgent" : action.length ? "action" : academic.length ? "academic" : "info";

  // HAIZ kind: what it becomes once confirmed
  let kind: Kind = "notice";
  if (/考试|测验|期中|期末|月考|模考|小测|周测|听写|默写|考场|监考/.test(body) && !/作业/.test(body.split(SENT)[0] ?? "")) kind = "exam";
  else if (/作业|练习|习题|试卷|报告|背诵|预习|复习|抄写|订正|错题|练习册|[Pp]\s?\d+|第\s?\d+.{0,3}题|课时|学案/.test(body)) kind = "homework";
  else if (when.start && !when.deadline && EVENT_VERBS.some((v) => body.includes(v))) kind = "event";
  else if (when.deadline || /截止|报名|填表|缴费|上交|收齐|接龙/.test(body)) kind = "deadline";
  else if (EVENT_VERBS.some((v) => body.includes(v)) && when.start) kind = "event";

  let subject = st?.subject ?? SUBJECTS.find((s) => body.includes(s)) ?? "";
  if (!subject && /英语|English|unit\s?\d/i.test(body)) subject = "英语";
  if (!subject) subject = kind === "event" ? "活动" : kind === "notice" ? "通知" : "其他";

  const taskRelated = !colloquial && score >= 2 && (category !== "info" || !!when.start || kind !== "notice") && !(placeholder && !hasDirective(body));
  if (urgent.length) reasons.push("紧急词：" + urgent.slice(0, 3).join("、"));
  if (action.length) reasons.push("动作：" + action.slice(0, 3).join("、"));
  if (academic.length) reasons.push("学业：" + academic.slice(0, 3).join("、"));
  if (authority.length) reasons.push("发送者：" + authority[0]);
  if (when.start) reasons.push(when.deadline ? "识别到截止时间" : "识别到时间");
  if (colloquial) reasons.push("像随口一问");

  const confidence = when.start && (action.length || academic.length) && (authority.length || directive.length) ? "high" : when.start || action.length ? "medium" : "low";
  const ambiguous = !when.start || /可能|大概|或许|暂定|待定|看情况|另行通知/.test(body);
  const iso = (d: Date | null) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : null);
  return {
    category, kind, score, tags: [...tags], subject,
    title: st?.title ?? actionLine(body), summary: summaryLine(body),
    due: when.deadline || kind === "homework" || kind === "deadline" ? iso(when.start) : null,
    start: iso(when.start), end: iso(when.end), where: when.where, allDay: when.allDay,
    confidence, ambiguous, colloquial, taskRelated, reasons,
  };
}

/* -------------------------------------------- WeChat notification text */
/**
 * WeChat shows a group message as title = group name and text = 「[3条]发送人: 内容」, sometimes
 * prefixed 「[有人@我]」. Split those apart; a body without a 「name:」 prefix stays whole.
 */
export function splitNotification(text: string): { sender: string; body: string; count: number; mention: boolean } {
  let t = cleanText(text);
  let count = 1, mention = false;
  const c = /^\[(\d+)条\]\s*/.exec(t);
  if (c) { count = +c[1]; t = t.slice(c[0].length); }
  const at = /^\[(?:有人@我|@所有人|有全体消息)\]\s*/.exec(t);
  if (at) { mention = true; t = t.slice(at[0].length); }
  const m = /^([^:：\s]{1,24})[:：]\s*/.exec(t);
  if (m && !/^(?:https?|注意|通知|作业|时间|地点|要求|备注|提醒)$/.test(m[1])) return { sender: m[1], body: t.slice(m[0].length), count, mention };
  return { sender: "", body: t, count, mention };
}

/* ------------------------------------------------------------- display */
export function fmtWhen(iso: string | null, allDay = false, now = new Date()): string {
  if (!iso) return "未识别";
  const d = new Date(iso);
  const diff = Math.round((day0(d).getTime() - day0(now).getTime()) / 864e5);
  const W = "日一二三四五六"[d.getDay()];
  const day = diff === 0 ? "今天" : diff === 1 ? "明天" : diff === 2 ? "后天" : diff > 2 && diff < 7 ? `周${W}` : `${d.getMonth() + 1}月${d.getDate()}日（周${W}）`;
  if (allDay) return day;
  return `${day} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
