/** 成长记录 · what you kept, not how you rank. */
import { useState } from "react";
import { GROWTH } from "../data/demo";
import { PageHead } from "../ui/PageHead";
import { Section } from "../ui/Section";
import { Demo, Segmented } from "../ui/controls";
import "./pages.css";

const DAYS = ["一", "二", "三", "四", "五", "六", "日"];
type K = "focus" | "tasks" | "reading";
const META: Record<K, { label: string; unit: string }> = { focus: { label: "专注", unit: "分钟" }, tasks: { label: "完成待办", unit: "项" }, reading: { label: "阅读", unit: "分钟" } };

export function Growth({ phone }: { phone: boolean }) {
  const [k, setK] = useState<K>("focus");
  const data = GROWTH[k];
  const max = Math.max(...data);
  const sum = data.reduce((a, b) => a + b, 0);
  const [hi, setHi] = useState<number | null>(null);
  return (
    <div className="growth">
      <PageHead kicker="Growth · 本周" title="成长记录" sub={<>只和上周的自己比较，不排名。<Demo /></>} />
      <div className="stats" data-rv>
        <div className="stat"><span className="stat-n t-num">{GROWTH.streak}</span><span className="stat-l">连续专注天数</span></div>
        <div className="stat"><span className="stat-n t-num">{GROWTH.focus.reduce((a, b) => a + b, 0)}</span><span className="stat-l">本周专注 · 分钟</span></div>
        <div className="stat"><span className="stat-n t-num">{GROWTH.tasks.reduce((a, b) => a + b, 0)}</span><span className="stat-l">完成待办 · 项</span></div>
      </div>
      <Section kicker="Week" title={`${META[k].label} · ${sum} ${META[k].unit}`} action={<Segmented<K> value={k} onChange={setK} size="sm" options={(Object.keys(META) as K[]).map((id) => ({ id, label: META[id].label }))} />}>
        <div className="band" onPointerLeave={() => setHi(null)}>
          {data.map((v, i) => (
            <div key={i} className={"band-c" + (hi === i ? " is-hi" : "") + (i === 6 ? " is-today" : "")} onPointerEnter={() => setHi(i)}>
              <span className="band-v t-num">{v}</span>
              <span className="band-bar"><i style={{ height: `${max ? (v / max) * 100 : 0}%` }} /></span>
              <span className="band-d">{DAYS[i]}</span>
            </div>
          ))}
        </div>
        <p className="foot-note">柱高表示当天的{META[k].label}{META[k].unit === "分钟" ? "时长" : "数量"}；周日为今天（演示）。</p>
      </Section>
    </div>
  );
}
