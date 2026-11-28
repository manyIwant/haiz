/** The school day, read against the real clock. Weekends preview Monday. */
import { PERIODS, WEEK, EVENTS, type Course } from "../data/demo";

/**
 * The app's clock. `?now=2026-11-26T23:40` pins it to a moment (acceptance checks, screenshots
 * of a school day on a weekend); otherwise it is the real clock.
 */
const PIN = (() => {
  try {
    const q = new URLSearchParams(location.search).get("now");
    const t = q ? new Date(q).getTime() : NaN;
    return Number.isFinite(t) ? t - Date.now() : 0;
  } catch { return 0; }
})();
export const now = () => new Date(Date.now() + PIN);

export const mins = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
export const nowMins = () => { const d = now(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; };
/** 0 = Monday … 4 = Friday; weekends show Monday as a preview */
export function schoolDay(): { idx: number; preview: boolean; weekday: number } {
  const wd = (now().getDay() + 6) % 7; // Monday 0
  return wd > 4 ? { idx: 0, preview: true, weekday: wd } : { idx: wd, preview: false, weekday: wd };
}
export function todayCourses(): (Course & { n: number; start: string; end: string })[] {
  const d = schoolDay();
  return WEEK[d.idx].map((c, i) => ({ ...c, ...PERIODS[i] }));
}
export function nextCourse() {
  const list = todayCourses();
  const d = schoolDay();
  const t = d.preview ? -1 : nowMins();
  for (const c of list) {
    if (t >= mins(c.start) && t < mins(c.end)) return { course: c, now: true, label: `第 ${c.n} 节 · ${c.start}–${c.end}` };
    if (t < mins(c.start)) {
      const left = Math.round(mins(c.start) - t);
      return { course: c, now: false, label: d.preview ? `周一 第 ${c.n} 节 · ${c.start}` : left <= 90 ? `${c.start} · 还有 ${left} 分钟` : `第 ${c.n} 节 · ${c.start}` };
    }
  }
  const tomorrow = WEEK[(d.idx + 1) % 5][0];
  return { course: { ...tomorrow, ...PERIODS[0] }, now: false, label: "明天 第 1 节 · 07:40" };
}
export function upcoming(n: number) {
  const out: { time: string; title: string; place: string }[] = [];
  const t = schoolDay().preview ? -1 : nowMins();
  for (const c of todayCourses()) if (mins(c.end) > t) out.push({ time: c.start, title: c.subject, place: `${c.building} ${c.room}` });
  for (const e of EVENTS) out.push({ time: e.day === 0 ? e.time : `${dayLabel(e.day)}`, title: e.title, place: e.place });
  return out.slice(0, n);
}
export function dayLabel(offset: number) {
  if (offset === 0) return "今天";
  if (offset === 1) return "明天";
  const d = new Date(now().getTime() + offset * 864e5);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
const WD = ["日", "一", "二", "三", "四", "五", "六"];
export function dateLine(d = now()) {
  return { md: `${d.getMonth() + 1}月${d.getDate()}日`, wd: `星期${WD[d.getDay()]}`, y: d.getFullYear() };
}
/** teaching week of the autumn semester (assumed to start on the first Monday of September) */
export function teachingWeek(d = now()) {
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  const s = new Date(y, 8, 1);
  while (s.getDay() !== 1) s.setDate(s.getDate() + 1);
  return Math.max(1, Math.floor((d.getTime() - s.getTime()) / (7 * 864e5)) + 1);
}
export function greeting() {
  const h = now().getHours();
  return h < 5 ? "夜深了" : h < 11 ? "早上好" : h < 13 ? "中午好" : h < 18 ? "下午好" : "晚上好";
}
