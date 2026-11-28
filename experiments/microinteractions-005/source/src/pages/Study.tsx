import { useState } from "react";
import { setState, startFocus } from "../app/store";
import { go } from "../app/router";
import { NOTES, LABS } from "../data/demo";
import { nextCourse, teachingWeek } from "../app/time";
import { PageHead } from "../ui/PageHead";
import { Section } from "../ui/Section";
import { Button, Chip, Demo, Icon } from "../ui/controls";
import { Pendulum, MagnetCoil, Lens } from "./labs";
import "./pages.css";

const SUBJECTS = ["全部", "语文", "数学", "英语", "物理", "化学", "生物", "历史"];

export function Study({ phone }: { phone: boolean }) {
  const [sub, setSub] = useState("全部");
  const [lab, setLab] = useState(LABS[0].id);
  const notes = NOTES.filter((n) => sub === "全部" || n.subject === sub);
  const n = nextCourse();
  const counts = NOTES.reduce<Record<string, number>>((a, m) => ((a[m.subject] = (a[m.subject] ?? 0) + 1), a), {});
  return (
    <div className="study">
      <PageHead kicker={`Study · 第 ${teachingWeek()} 教学周`} title="学习"
        sub={<>下一节是<b>{n.course.subject}</b>：{n.course.topic}。预习只需要十分钟。</>}
        aside={!phone && <Button kind="pri" icon="focus" onClick={() => { startFocus(25, "预习"); go("focus"); }}>预习 25 分钟</Button>} />

      <div className="study-relay" data-rv>
        <div className="relay-l">
          <span className="t-kicker">学习接力</span>
          <b className="t-sub">楞次定律 · 第 2 页</b>
          <span className="t-meta">昨晚 21:40 停在“增反减同”的例题 3 <Demo /></span>
        </div>
        <div className="relay-bar" aria-label="进度 2/3"><i style={{ width: "62%" }} /></div>
        <Button kind="sec" icon="relay" onClick={(e) => setState({ inspector: { kind: "note", id: "m1", from: e.currentTarget.getBoundingClientRect() } })}>继续</Button>
      </div>

      <Section kicker="Notes" title="笔记" action={<span className="t-meta">{notes.length} 篇</span>}>
        <div className="chips" role="tablist" aria-label="按学科筛选">
          {SUBJECTS.map((s) => <Chip key={s} on={sub === s} onClick={() => setSub(s)}>{s}{s !== "全部" && counts[s] ? <span className="chip-n t-num">{counts[s]}</span> : null}</Chip>)}
        </div>
        <ul className="notes">
          {notes.map((m) => (
            <li key={m.id}>
              <button type="button" className="note" onClick={(e) => setState({ inspector: { kind: "note", id: m.id, from: e.currentTarget.getBoundingClientRect() } })}>
                <span className="note-k"><span className="note-sub">{m.subject}</span><span>{m.when} · {m.pages} 页</span></span>
                <span className="note-t">{m.title}</span>
                <span className="note-x">{m.excerpt}</span>
              </button>
            </li>
          ))}
          {!notes.length && <li className="empty">这个学科还没有笔记。</li>}
        </ul>
        <p className="foot-note"><Demo /> 笔记为演示内容。</p>
      </Section>

      <Section kicker="Lab book" title="交互实验册" action={<a className="link" href="https://haiz.space/lab/" target="_blank" rel="noopener">主站完整实验册 ↗</a>}>
        <div className="labs">
          <div className="labs-tabs" role="tablist">
            {LABS.map((l) => (
              <button key={l.id} type="button" role="tab" aria-selected={lab === l.id} className={"labs-tab" + (lab === l.id ? " is-on" : "")} onClick={() => setLab(l.id)}>
                <Icon kind="lab" size={18} active={lab === l.id} />
                <span><b>{l.title}</b><small>{l.desc}</small></span>
              </button>
            ))}
          </div>
          <div className="labs-stage">
            {lab === "l1" && <Pendulum />}
            {lab === "l2" && <MagnetCoil />}
            {lab === "l3" && <Lens />}
          </div>
        </div>
      </Section>
    </div>
  );
}
