/**
 * 专注 · the timer is a cross-section that grows a ring for every five minutes kept.
 * While it runs the rest of the product yields: the rail recedes, the bar dims, and the dock
 * becomes the timer's own controls.
 */
import { useRef, useState } from "react";
import { useStore, startFocus, pauseFocus, stopFocus, fmtClock } from "../app/store";
import { clock, clamp } from "../kernel/motion";
import { useConst, useTick } from "../kernel/react";
import { Button, Chip, Demo } from "../ui/controls";
import "./pages.css";

const wob = (th: number, k: number) => 1 + 0.03 * Math.sin(2 * th + 0.6 + k * 0.3) + 0.017 * Math.sin(5 * th + 2.1 + k * 0.7) + 0.009 * Math.sin(9 * th + 4);
function ring(r: number, k: number, n = 96) {
  let d = "";
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * Math.PI * 2, rr = r * wob(th, k);
    d += (i ? "L" : "M") + (160 + rr * Math.sin(th)).toFixed(2) + " " + (160 - rr * Math.cos(th)).toFixed(2);
  }
  return d + "Z";
}

export function Focus({ phone }: { phone: boolean }) {
  const f = useStore((s) => s.focus);
  const [m, setM] = useState(25);
  const live = f.state === "running" || f.state === "paused";
  const done = f.total - f.left;
  const rings = live || f.state === "done" ? Math.floor(done / 300) : 0;
  const total = Math.max(1, Math.ceil(f.total / 300));
  const arc = useRef<SVGPathElement>(null);
  const disc = useRef<SVGGElement>(null);
  const s = useConst(() => ({ p: 0, t: 0 }));
  useTick((dt, now) => {
    const target = live || f.state === "done" ? done / f.total : 0;
    s.p += (target - s.p) * Math.min(1, dt * 6);
    const R = 132, a = s.p * Math.PI * 2;
    if (arc.current) {
      const x = 160 + R * Math.sin(a), y = 160 - R * Math.cos(a);
      arc.current.setAttribute("d", s.p > 0.001 ? `M160 ${160 - R}A${R} ${R} 0 ${a > Math.PI ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}` : "");
    }
    // breathing, only while running and only as much as the reader allows
    if (disc.current) disc.current.setAttribute("transform", f.state === "running" ? `translate(160 160) scale(${(1 + Math.sin(now / 1400) * 0.006 * clock.intensity).toFixed(4)}) translate(-160 -160)` : "");
    return f.state === "running" || Math.abs(target - s.p) > 0.0005;
  });
  return (
    <div className={"focus" + (live ? " is-live" : "")}>
      <div className="focus-stage" data-rv>
        <svg className="focus-disc" viewBox="0 0 320 320" aria-hidden="true">
          <g ref={disc}>
            {Array.from({ length: total }, (_, k) => {
              const r = 18 + ((k + 1) / total) * 104;
              return <path key={k} d={ring(r, k)} className={"fr" + (k < rings ? " is-grown" : "")} style={{ ["--k" as any]: k }} />;
            })}
          </g>
          <circle cx="160" cy="160" r="132" className="fr-track" />
          <path ref={arc} className="fr-arc" />
        </svg>
        <div className="focus-read">
          <span className="focus-k">{f.state === "done" ? "完成" : live ? (f.state === "paused" ? "已暂停" : f.label) : "准备好了吗"}</span>
          <span className="focus-time t-num">{fmtClock(live || f.state === "done" ? f.left : m * 60)}</span>
          <span className="focus-m">{live ? `已经长出 ${rings} 圈 · 每 5 分钟一圈` : "每专注 5 分钟，长出一圈年轮"}</span>
        </div>
      </div>
      <div className="focus-ctl" data-rv>
        {!live ? (
          <>
            <div className="chips">{[15, 25, 45, 90].map((x) => <Chip key={x} on={m === x} onClick={() => setM(x)}><span className="t-num">{x}</span> 分钟</Chip>)}</div>
            <Button kind="pri" size="lg" onClick={() => startFocus(m)}>{f.state === "done" ? "再来一段" : "开始专注"}</Button>
          </>
        ) : (
          <div className="focus-run">
            <Button kind="sec" size="lg" icon="playpause" onClick={pauseFocus}>{f.state === "paused" ? "继续" : "暂停"}</Button>
            <Button kind="line" size="lg" icon="stop" onClick={stopFocus}>结束</Button>
          </div>
        )}
        <p className="focus-hint">{live ? (phone ? "底部的舰已经变成计时器的控制。" : "侧轨与顶栏暂时退后；底部的舰变成了计时器的控制。") : "开始后，界面其余部分会让出注意力。"}</p>
      </div>
      <section className="focus-log" data-rv>
        <h2 className="t-kicker">今天</h2>
        <ul>
          {[["07:10", "晨读 · 英语", 25], ["12:40", "午间 · 数学错题", 15], ["19:35", "晚自习 · 物理", 45]].map(([t, l, mm], i) => (
            <li key={i}><span className="t-num">{t}</span><span>{l}</span><span className="t-num">{mm} 分钟</span><i style={{ width: `${clamp((mm as number) / 90, 0, 1) * 100}%` }} /></li>
          ))}
        </ul>
        <p className="foot-note"><Demo /> 记录为演示数据。</p>
      </section>
    </div>
  );
}
