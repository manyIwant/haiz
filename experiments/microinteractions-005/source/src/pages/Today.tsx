import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useStore, setState, toggleTask, addTask, readNotice, toast } from "../app/store";
import { go } from "../app/router";
import { todayCourses, schoolDay, nowMins, mins, dateLine, teachingWeek, greeting, nextCourse } from "../app/time";
import { STUDENT } from "../data/demo";
import { Check, Demo, Icon, useFlip } from "../ui/controls";
import { useClimate, sameDayLastYear } from "../culture/useClimate";
import { Section } from "../ui/Section";
import "./pages.css";

export function Today({ phone }: { phone: boolean }) {
  const dl = dateLine();
  const sd = schoolDay();
  const c = useClimate();
  const last = c ? sameDayLastYear(c) : null;
  const tasks = useStore((s) => s.tasks);
  const open = tasks.filter((t) => !t.done).length;
  const left = todayCourses().filter((x) => !sd.preview && mins(x.end) > nowMins()).length;
  const next = nextCourse();
  return (
    <div className="today">
      <header className="hero" data-rv>
        <div className="t-kicker">{dl.md} · {dl.wd} · 第 {teachingWeek()} 教学周</div>
        <h1 className="t-display hero-t">{greeting()}，{STUDENT.name.slice(1)}</h1>
        <p className="hero-sub">
          {sd.preview ? "周末没有课，下面是周一的课表预览" : left ? <>今天还有 <b className="t-num">{left}</b> 节课</> : "今天的课已经上完了"}
          {open > 0 && <>；<b className="t-num">{open}</b> 项待办</>}。
          {last && <span className="hero-ring" onClick={() => go("rings")} role="link" tabIndex={0}>
            <Icon kind="rings" size={16} /> 去年今日 <span className="t-num">{last.tmin.toFixed(0)}–{last.tmax.toFixed(0)}°C</span>
          </span>}
        </p>
      </header>

      {phone && (
        <button type="button" className="nextcard" data-rv onClick={(e) => setState({ inspector: { kind: "course", id: String(next.course.n), from: e.currentTarget.getBoundingClientRect() } })}>
          <span className="nextcard-k"><i className={next.now ? "is-live" : ""} />{next.now ? "正在上" : "下一节"} · {next.label}</span>
          <span className="nextcard-t">{next.course.subject}<small>{next.course.topic}</small></span>
          <span className="nextcard-m">{next.course.building} {next.course.room} · {next.course.teacher}</span>
        </button>
      )}

      <div className="today-grid">
        <Section kicker="Schedule" title={sd.preview ? "周一课程" : "今日课程"} action={<button type="button" className="link" onClick={(e) => go("schedule", e.currentTarget)}>本周课表</button>}>
          <Timeline preview={sd.preview} />
          <p className="foot-note"><Demo /> 课表、教师与教室为演示数据；楼名取自校园地图。</p>
        </Section>
        <div className="today-side">
          <Section kicker="To do" title="待办" action={<span className="t-meta t-num">{open} / {tasks.length}</span>}>
            <Tasks />
          </Section>
          <Section kicker="Notices" title="通知" action={<button type="button" className="link" onClick={(e) => go("campus/notice", e.currentTarget)}>全部</button>}>
            <NoticeList limit={3} />
          </Section>
        </div>
      </div>

      <Section kicker="Campus" title="校园一角">
        <button type="button" className="corner" onClick={(e) => go("tree", e.currentTarget)}>
          <img src="img/web/lanshu-1600.jpg" alt="海南中学校园里的百年大叶榄仁树" loading="lazy" />
          <span className="corner-cap">
            <b>百年榄仁</b>
            <span>北门入口与一号教学楼前各立一株大叶榄仁，一前一后，护送一届届学子走出校园。</span>
            <small>图：海南中学官网 · 文：官网《海南中学校园景观简介》</small>
          </span>
        </button>
      </Section>
    </div>
  );
}

/* ---------- the day as a datum line; the now-mark rides it ---------- */
function Timeline({ preview }: { preview: boolean }) {
  const list = todayCourses();
  const box = useRef<HTMLOListElement>(null);
  const [now, setNow] = useState(nowMins());
  const [nowY, setNowY] = useState<number | null>(null);
  useEffect(() => { const t = setInterval(() => setNow(nowMins()), 20000); return () => clearInterval(t); }, []);
  useLayoutEffect(() => {
    if (preview || !box.current) { setNowY(null); return; }
    const rows = [...box.current.querySelectorAll<HTMLElement>(".tl-row")];
    let y: number | null = null;
    for (let i = 0; i < list.length; i++) {
      const s = mins(list[i].start), e = mins(list[i].end), r = rows[i];
      if (!r) continue;
      if (now >= s && now < e) { y = r.offsetTop + ((now - s) / (e - s)) * r.offsetHeight; break; }
      if (now < s) { const prev = rows[i - 1]; y = prev ? (prev.offsetTop + prev.offsetHeight + r.offsetTop) / 2 : r.offsetTop - 6; break; }
    }
    if (y === null && rows.length) { const lr = rows[rows.length - 1]; y = now > mins(list[list.length - 1].end) ? lr.offsetTop + lr.offsetHeight + 6 : null; }
    setNowY(y);
  }, [now, preview]);
  const t = new Date();
  return (
    <ol ref={box} className="tl">
      {list.map((c, i) => {
        const s = mins(c.start), e = mins(c.end);
        const state = preview ? "" : now >= e ? "is-past" : now >= s ? "is-now" : "";
        const brk = i === 2 ? "大课间" : i === 5 ? "午休" : null;
        return (
          <li key={i} className={"tl-li" + (brk ? " has-break" : "")}>
            {brk && <span className="tl-break">{brk}</span>}
            <button type="button" className={"tl-row " + state} onClick={(ev) => setState({ inspector: { kind: "course", id: String(c.n), from: ev.currentTarget.getBoundingClientRect() } })}>
              <span className="tl-time t-num">{c.start}<small>{c.end}</small></span>
              <span className="tl-tick" />
              <span className="tl-main"><b>{c.subject}</b><span>{c.topic}</span></span>
              <span className="tl-room">{c.building} · {c.room}</span>
            </button>
          </li>
        );
      })}
      {nowY !== null && (
        <li className="tl-now" style={{ transform: `translateY(${nowY}px)` }} aria-label="现在">
          <span className="t-num">{String(t.getHours()).padStart(2, "0")}:{String(t.getMinutes()).padStart(2, "0")}</span><i />
        </li>
      )}
    </ol>
  );
}

export function Tasks({ compact }: { compact?: boolean }) {
  const tasks = useStore((s) => s.tasks);
  const sorted = [...tasks.filter((t) => !t.done), ...tasks.filter((t) => t.done)];
  const list = useRef<HTMLUListElement>(null);
  useFlip(list, sorted.map((t) => t.id + (t.done ? 1 : 0)).join());
  const [v, setV] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const f = () => { input.current?.focus(); input.current?.scrollIntoView({ block: "center", behavior: "smooth" }); };
    window.addEventListener("haiz:quickadd", f);
    return () => window.removeEventListener("haiz:quickadd", f);
  }, []);
  return (
    <div className="tasks">
      {!compact && (
        <div className="task-add">
          <Icon kind="plus" size={18} />
          <input ref={input} value={v} placeholder="添加待办，回车加入" onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && v.trim()) { addTask(v.trim()); setV(""); toast("已加入今日待办"); } }} aria-label="添加待办" />
        </div>
      )}
      <ul ref={list} className="task-list">
        {sorted.map((t) => (
          <li key={t.id} data-flip={t.id} className={"task" + (t.done ? " is-done" : "")}>
            <Check checked={t.done} onChange={() => toggleTask(t.id)} label={t.title} />
            <button type="button" className="task-b" onClick={(e) => setState({ inspector: { kind: "task", id: t.id, from: e.currentTarget.getBoundingClientRect() } })}>
              <span className="task-t">{t.title}</span>
              <span className="task-m">{t.subject} · <span className={t.urgent && !t.done ? "lanren" : ""}>{t.due}</span>{t.mine ? " · 我添加的" : ""}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NoticeList({ limit }: { limit?: number }) {
  const notices = useStore((s) => s.notices);
  return (
    <ul className="nlist">
      {notices.slice(0, limit ?? 99).map((n) => (
        <li key={n.id}>
          <button type="button" className={"nrow" + (n.unread ? " is-unread" : "")} onClick={(e) => { readNotice(n.id); setState({ inspector: { kind: "notice", id: n.id, from: e.currentTarget.getBoundingClientRect() } }); }}>
            <i className="nrow-dot" />
            <span className="nrow-t">{n.title}</span>
            <span className="nrow-m">{n.from} · {n.time}</span>
            <span className="nrow-tag">{n.tag}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
