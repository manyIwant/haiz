/**
 * 日程 · the week as five columns that YIELD: the day under the pointer opens into an agenda
 * (topics, rooms, teachers), the other four compress to their subjects — total width conserved.
 */
import { useRef, useState } from "react";
import { setState } from "../app/store";
import { WEEK, PERIODS, WEEKDAYS, EVENTS } from "../data/demo";
import { schoolDay, teachingWeek, dayLabel } from "../app/time";
import { clock, spring, stepS, clamp, SP, type Spring } from "../kernel/motion";
import { useConst, useTick } from "../kernel/react";
import { PageHead } from "../ui/PageHead";
import { Section } from "../ui/Section";
import { Demo, WeekPicker } from "../ui/controls";
import "./pages.css";

const KIND: Record<string, string> = { exam: "考试", club: "社团", school: "学校", me: "我的" };

export function Schedule({ phone }: { phone: boolean }) {
  const sd = schoolDay();
  const [day, setDay] = useState(sd.idx);
  const now = new Date();
  const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const labels = WEEKDAYS.slice(0, 5).map((w, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return { top: w, bottom: String(d.getDate()), mark: !sd.preview && i === sd.idx }; });
  return (
    <div className="sched">
      <PageHead kicker={`Week ${teachingWeek()} · ${monday.getMonth() + 1}月${monday.getDate()}日起`} title="日程" sub={<>本周 <b className="t-num">{WEEK.flat().length}</b> 节课，下周三期中考试。<Demo /></>} />
      {phone ? (
        <>
          <div className="sched-pick" data-rv><WeekPicker value={day} onChange={setDay} labels={labels} /></div>
          <ol className="agenda" data-rv>
            {WEEK[day].map((c, i) => (
              <li key={i}>
                <button type="button" className="agenda-row" onClick={(e) => setState({ inspector: { kind: "course", id: `${day}:${i + 1}`, from: e.currentTarget.getBoundingClientRect() } })}>
                  <span className="t-num agenda-t">{PERIODS[i].start}</span>
                  <span className="agenda-s">{c.subject}</span>
                  <span className="agenda-m">{c.building} {c.room}</span>
                </button>
              </li>
            ))}
          </ol>
        </>
      ) : <WeekGrid today={sd.preview ? -1 : sd.idx} />}

      <Section kicker="Upcoming" title="接下来">
        <ul className="events">
          {EVENTS.map((e) => (
            <li key={e.id} className={"event event--" + e.kind}>
              <span className="event-d"><b className="t-num">{dayLabel(e.day)}</b><small className="t-num">{e.time}</small></span>
              <span className="event-t">{e.title}<small>{e.place}</small></span>
              <span className="event-k">{KIND[e.kind]}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function WeekGrid({ today }: { today: number }) {
  const grid = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState<number>(today >= 0 ? today : 0);
  const ws = useConst(() => Array.from({ length: 5 }, (_, i): Spring => spring(i === (today >= 0 ? today : 0) ? 2.3 : 1, SP.lift)));
  useTick((dt) => {
    let m = false;
    ws.forEach((s, i) => { s.t = i === focus ? 2.3 : 1; if (stepS(s, dt)) m = true; });
    const el = grid.current;
    if (el) {
      el.style.gridTemplateColumns = `56px ${ws.map((s) => `minmax(0, ${s.x.toFixed(3)}fr)`).join(" ")}`;
      ws.forEach((s, i) => el.style.setProperty(`--o${i}`, clamp((s.x - 1.25) / 1, 0, 1).toFixed(3)));
    }
    return m;
  });
  return (
    <div ref={grid} className="wg" data-rv onPointerLeave={() => { setFocus(today >= 0 ? today : focus); clock.wake(); }}>
      <div className="wg-h" />
      {WEEKDAYS.slice(0, 5).map((w, i) => (
        <div key={w} className={"wg-h" + (i === today ? " is-today" : "") + (i === focus ? " is-focus" : "")} onPointerEnter={() => { setFocus(i); clock.wake(); }}>{w}{i === today && <i />}</div>
      ))}
      {PERIODS.map((p, r) => (
        <div key={r} className="wg-row" style={{ display: "contents" }}>
          <div className={"wg-t t-num" + (r === 5 ? " wg-gap" : "")}>{p.start}</div>
          {WEEK.map((d, i) => {
            const c = d[r];
            return (
              <button key={i} type="button" className={"wg-c" + (i === focus ? " is-focus" : "") + (i === today ? " is-today" : "") + (r === 5 ? " wg-gap" : "")}
                style={{ ["--o" as any]: `var(--o${i})` }}
                onPointerEnter={() => { setFocus(i); clock.wake(); }}
                onClick={(e) => setState({ inspector: { kind: "course", id: `${i}:${r + 1}`, from: e.currentTarget.getBoundingClientRect() } })}>
                <b>{c.subject}</b>
                <span className="wg-more"><span>{c.topic}</span><small>{c.building} {c.room} · {c.teacher}</small></span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
