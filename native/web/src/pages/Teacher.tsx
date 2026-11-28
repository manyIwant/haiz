import { now as clockNow } from "../app/time";
/**
 * 教师工作台 · the same language in a clay key. Writing a notice and reading it as a student are
 * one gesture: the preview on the right is the student's own list, and the draft row grows in it
 * as you type. Publishing drops it into the real store, so it appears in 今日 and 校园 · 公告.
 */
import { useState } from "react";
import { useStore, publishNotice, addTask, toast } from "../app/store";
import { go } from "../app/router";
import { TEACHER, WEEK, PERIODS, WEEKDAYS, STUDENT } from "../data/demo";
import { schoolDay } from "../app/time";
import { PageHead } from "../ui/PageHead";
import { Section } from "../ui/Section";
import { Button, Demo, Field, Segmented, Select, WeekPicker } from "../ui/controls";
import "./pages.css";

type Kind = "notice" | "hw";
type Cls = "c3" | "c5" | "all";
const CLS: { id: Cls; label: string; meta: string }[] = [
  { id: "c3", label: "高二（3）班", meta: "45 人" },
  { id: "c5", label: "高二（5）班", meta: "44 人" },
  { id: "all", label: "两个班", meta: "89 人" },
];

export function Teacher({ phone }: { phone: boolean }) {
  const notices = useStore((s) => s.notices);
  const [kind, setKind] = useState<Kind>("notice");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [cls, setCls] = useState<Cls>("c3");
  const [due, setDue] = useState(2);
  const sd = schoolDay();
  const now = clockNow();
  const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const labels = WEEKDAYS.slice(0, 5).map((w, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return { top: w, bottom: String(d.getDate()), mark: !sd.preview && i === sd.idx }; });
  const mine = WEEK[sd.idx].map((c, i) => ({ c, p: PERIODS[i] })).filter((x) => x.c.teacher === TEACHER.name);
  const target = CLS.find((c) => c.id === cls)!;
  const draftTitle = title.trim() || (kind === "hw" ? "（作业标题）" : "（通知标题）");
  const ok = title.trim().length > 0;
  const publish = () => {
    if (!ok) return;
    publishNotice({ title: title.trim(), body: body.trim(), from: `${TEACHER.name} · ${TEACHER.subject}`, tag: kind === "hw" ? "作业" : "通知" });
    if (kind === "hw") addTask(title.trim(), TEACHER.subject);
    toast(`已发布给 ${target.label} · 演示`, { tone: "lit" });
    setTitle(""); setBody("");
  };
  const published = notices.filter((n) => n.id.startsWith("p"));
  return (
    <div className="tw" data-role="teacher">
      <PageHead kicker={`Workbench · ${TEACHER.subject} · ${TEACHER.classes.join("、")}`} title="教师工作台"
        sub={<>发布的内容会立刻出现在学生的「今日」与校园公告里。<Demo>身份与班级为虚构</Demo></>} />

      <div className={"tw-grid" + (phone ? " is-phone" : "")} data-rv>
        <section className="tw-form">
          <div className="tw-form-h">
            <span className="t-kicker">Compose</span>
            <Segmented<Kind> value={kind} onChange={setKind} size="sm" label="类型" options={[{ id: "notice", label: "通知" }, { id: "hw", label: "作业" }]} />
          </div>
          <Field label="标题" value={title} onChange={setTitle} placeholder={kind === "hw" ? "例如：导数练习 P58 第 1–8 题" : "例如：周五下午班会改到 16:10"} onEnter={publish} />
          <Field label="正文" value={body} onChange={setBody} placeholder="写给学生的话（可选）" multiline />
          <div className="tw-row">
            <Select<Cls> label="发送给" value={cls} onChange={setCls} options={CLS} width={phone ? 168 : 190} />
            {kind === "hw" && (
              <div className="tw-due">
                <span className="fld-l">截止</span>
                <WeekPicker value={due} onChange={setDue} labels={labels} />
              </div>
            )}
          </div>
          <div className="tw-acts">
            <span className="t-meta">{ok ? `将发送给 ${target.label}（${target.meta}）` : "写一个标题即可发布"}</span>
            <Button kind="pri" icon="notice" onClick={publish} disabled={!ok}>发布</Button>
          </div>
        </section>

        <section className="tw-prev" aria-label="学生端预览">
          <div className="tw-prev-k"><span className="t-kicker">学生端预览</span><Demo>{STUDENT.name} · 虚构</Demo></div>
          <div className="tw-phone">
            <div className="tw-phone-h"><b>通知</b><span className="t-meta">{target.label}</span></div>
            <ul className="nlist">
              <li className={"tw-draft" + (title.trim() ? " is-typing" : "")}>
                <div className="nrow is-unread">
                  <i className="nrow-dot" /><span className="nrow-t">{draftTitle}</span>
                  <span className="nrow-m">{TEACHER.name} · {kind === "hw" ? `${WEEKDAYS[due]}截止` : "刚刚"}</span>
                  <span className="nrow-tag">{kind === "hw" ? "作业" : "通知"}</span>
                </div>
                {body.trim() && <p className="tw-draft-b">{body.trim()}</p>}
              </li>
              {notices.slice(0, 3).map((n) => (
                <li key={n.id}>
                  <div className={"nrow" + (n.unread ? " is-unread" : "")}>
                    <i className="nrow-dot" /><span className="nrow-t">{n.title}</span><span className="nrow-m">{n.from} · {n.time}</span><span className="nrow-tag">{n.tag}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <div className="cols tw-cols">
        <Section kicker="Today" title="今天的课">
          {mine.length ? (
            <ul className="tw-classes">
              {mine.map(({ c, p }) => (
                <li key={p.n}><span className="t-num">{p.start}</span><b>{c.subject}</b><span>{c.topic}</span><small>{c.building} {c.room}</small></li>
              ))}
            </ul>
          ) : <p className="empty">今天没有您的课。</p>}
          <p className="foot-note"><Demo /> 课表为演示数据{sd.preview ? "；周末预览周一" : ""}。</p>
        </Section>
        <Section kicker="Submissions" title="作业回收" action={<Demo />}>
          <ul className="tw-sub">
            {[["物理实验报告", 28, 45], ["导数练习 P56", 39, 45], ["《赤壁赋》默写", 44, 44]].map(([t, a, b]) => (
              <li key={t as string}>
                <span>{t}</span>
                <span className="tw-bar"><i style={{ width: `${((a as number) / (b as number)) * 100}%` }} /></span>
                <span className="t-num">{a}/{b}</span>
              </li>
            ))}
          </ul>
          {published.length > 0 && <p className="foot-note">本次已发布 {published.length} 条 · <button type="button" className="link" onClick={(e) => go("campus/notice", e.currentTarget)}>在公告里查看</button></p>}
        </Section>
      </div>
    </div>
  );
}
