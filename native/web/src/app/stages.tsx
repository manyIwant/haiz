/**
 * What grows out of the dock on dwell (停). Each stage is the destination's live summary and its
 * one or two most-used actions — enough to act without entering.
 */
import { useEffect, useState } from "react";
import { useStore, addTask, startFocus, toast, setState, isDark } from "./store";
import { go } from "./router";
import { NOTES, LABS, NOTICES } from "../data/demo";
import { nextCourse, upcoming } from "./time";
import { Chip, Icon, Switch } from "../ui/controls";
import { useClimate, sameDayLastYear } from "../culture/useClimate";

export const STAGE_SIZE: Record<string, { w: number; h: number }> = {
  today: { w: 312, h: 168 },
  study: { w: 312, h: 168 },
  campus: { w: 312, h: 168 },
  me: { w: 300, h: 150 },
  plus: { w: 340, h: 168 },
  focus: { w: 320, h: 150 },
  schedule: { w: 330, h: 186 },
  rings: { w: 330, h: 168 },
  notes: { w: 340, h: 196 },
  lab: { w: 330, h: 196 },
  relay: { w: 320, h: 158 },
};

const I = (i: number) => ({ ["--i" as any]: i });

export function Stage({ id, close, phone }: { id: string; close: () => void; phone?: boolean }) {
  switch (id) {
    case "today": {
      const n = nextCourse();
      return (
        <div className="stg">
          <div className="stg-k" style={I(0)}><b>{n.now ? "正在上" : "下一节"}</b>{n.label}</div>
          <div className="stg-t" style={I(1)}>{n.course.subject} · {n.course.topic}</div>
          <div className="stg-m" style={I(2)}>{n.course.building} {n.course.room} · {n.course.teacher}<span className="demo-tag" style={{ marginLeft: 6 }}>演示</span></div>
          <div className="stg-acts" style={I(3)}>
            <button className="stg-act" data-stage-action onClick={() => { close(); go("today"); setTimeout(() => window.dispatchEvent(new CustomEvent("haiz:quickadd")), 60); }}>新建待办</button>
            <button className="stg-act stg-act--pri" data-stage-action onClick={() => { close(); startFocus(25); go("focus"); }}>专注 25 分钟</button>
          </div>
        </div>
      );
    }
    case "study": return (
      <div className="stg">
        <div className="stg-k" style={I(0)}><b>最近</b>笔记 · {NOTES[0].when}</div>
        <div className="stg-t" style={I(1)}>{NOTES[0].title}</div>
        <div className="stg-m stg-clamp" style={I(2)}>{NOTES[0].excerpt}</div>
        <div className="stg-acts" style={I(3)}>
          <button className="stg-act" data-stage-action onClick={() => { close(); go("study"); }}>全部笔记</button>
          <button className="stg-act stg-act--pri" data-stage-action onClick={() => { close(); go("study"); setState({ inspector: { kind: "lab", id: LABS[1].id } }); }}>打开实验册</button>
        </div>
      </div>
    );
    case "campus": return <CampusStage close={close} />;
    case "me": return <MeStage close={close} />;
    case "plus": return <QuickAdd close={close} phone={phone} />;
    case "focus": return <FocusStage close={close} />;
    case "schedule": {
      const ev = upcoming(3);
      return (
        <div className="stg">
          <div className="stg-k" style={I(0)}><b>接下来</b>日程</div>
          <ul className="stg-list">
            {ev.map((e, i) => (
              <li key={i} className="stg-r" style={I(i + 1)}><span className="stg-time t-num">{e.time}</span><span className="stg-li-t">{e.title}</span><span className="stg-li-m">{e.place}</span></li>
            ))}
          </ul>
          <div className="stg-acts" style={I(5)}><button className="stg-act" data-stage-action onClick={() => { close(); go("schedule"); }}>打开日程</button></div>
        </div>
      );
    }
    case "rings": return <RingsStage close={close} />;
    case "notes": return (
      <div className="stg">
        <div className="stg-k" style={I(0)}><b>笔记</b>最近 3 篇</div>
        <ul className="stg-list">
          {NOTES.slice(0, 3).map((m, i) => (
            <li key={m.id} className="stg-r" style={I(i + 1)}>
              <button className="stg-row" data-stage-action onClick={(e) => { close(); setState({ inspector: { kind: "note", id: m.id, from: e.currentTarget.getBoundingClientRect() } }); }}>
                <span className="stg-tag">{m.subject}</span><span className="stg-li-t">{m.title}</span><span className="stg-li-m">{m.when}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
    case "lab": return (
      <div className="stg">
        <div className="stg-k" style={I(0)}><b>交互实验册</b>物理</div>
        <ul className="stg-list">
          {LABS.map((l, i) => (
            <li key={l.id} className="stg-r" style={I(i + 1)}>
              <button className="stg-row" data-stage-action onClick={(e) => { close(); setState({ inspector: { kind: "lab", id: l.id, from: e.currentTarget.getBoundingClientRect() } }); }}>
                <Icon kind="lab" size={18} /><span className="stg-li-t">{l.title}</span><span className="stg-li-m">{l.desc.slice(0, 10)}…</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
    case "relay": return (
      <div className="stg">
        <div className="stg-k" style={I(0)}><b>学习接力</b>从上次停下的地方继续</div>
        <div className="stg-t" style={I(1)}>楞次定律 · 第 2 页</div>
        <div className="stg-m" style={I(2)}>昨晚 21:40 停在“增反减同”的例题 3。<span className="demo-tag" style={{ marginLeft: 6 }}>演示</span></div>
        <div className="stg-acts" style={I(3)}><button className="stg-act stg-act--pri" data-stage-action onClick={(e) => { close(); setState({ inspector: { kind: "note", id: "m1", from: e.currentTarget.getBoundingClientRect() } }); }}>继续</button></div>
      </div>
    );
  }
  return null;
}


function CampusStage({ close }: { close: () => void }) {
  const n = useStore((s) => s.notices[0]) ?? NOTICES[0];
  return (
    <div className="stg">
      <div className="stg-k" style={I(0)}><b>{n.unread ? "未读" : "最新"}</b>{n.from} · {n.time}</div>
      <div className="stg-t stg-clamp1" style={I(1)}>{n.title}</div>
      <div className="stg-m stg-clamp" style={I(2)}>{n.body}</div>
      <div className="stg-acts" style={I(3)}>
        <button className="stg-act" data-stage-action onClick={() => { close(); go("campus/map"); }}>校园地图</button>
        <button className="stg-act stg-act--pri" data-stage-action onClick={(e) => { close(); go("campus/notice"); setState({ inspector: { kind: "notice", id: n.id, from: e.currentTarget.getBoundingClientRect() } }); }}>阅读</button>
      </div>
    </div>
  );
}

function MeStage({ close }: { close: () => void }) {
  const theme = useStore((s) => s.theme);
  const [dark, setDark] = useState(isDark());
  useEffect(() => setDark(isDark()), [theme]);
  return (
    <div className="stg">
      <div className="stg-k" style={I(0)}><b>快捷</b>外观与身份</div>
      <div className="stg-line" style={I(1)}><span>深色外观</span><Switch checked={dark} onChange={(v) => setState({ theme: v ? "dark" : "light" })} label="深色外观" /></div>
      <div className="stg-acts" style={I(2)}>
        <button className="stg-act" data-stage-action onClick={() => { close(); go("me"); }}>设置</button>
        <button className="stg-act" data-stage-action onClick={() => { close(); go("growth"); }}>成长记录</button>
      </div>
    </div>
  );
}

function QuickAdd({ close, phone }: { close: () => void; phone?: boolean }) {
  const [t, setT] = useState("");
  const [sub, setSub] = useState("日常");
  const add = () => {
    if (!t.trim()) return;
    addTask(t.trim(), sub);
    setT("");
    close();
    toast("已加入今日待办", { from: "dock" });
  };
  return (
    <div className="stg">
      <div className="stg-k" style={I(0)}><b>新建</b>待办</div>
      <input className="stg-in" style={I(1)} value={t} autoFocus={!phone} placeholder="写下要做的事，回车加入" onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); if (e.key === "Escape") close(); }} />
      <div className="stg-chips" style={I(2)}>
        {["日常", "物理", "数学", "英语", "社团"].map((x) => <Chip key={x} on={sub === x} onClick={() => setSub(x)}>{x}</Chip>)}
      </div>
      <div className="stg-acts" style={I(3)}><button className="stg-act stg-act--pri" data-stage-action onClick={add} disabled={!t.trim()}>加入今日</button></div>
    </div>
  );
}

function FocusStage({ close }: { close: () => void }) {
  const [m, setM] = useState(25);
  return (
    <div className="stg">
      <div className="stg-k" style={I(0)}><b>专注</b>选一段时间</div>
      <div className="stg-chips" style={I(1)}>
        {[25, 45, 90].map((x) => <Chip key={x} on={m === x} onClick={() => setM(x)}><span className="t-num">{x}</span> 分钟</Chip>)}
      </div>
      <div className="stg-acts" style={I(2)}><button className="stg-act stg-act--pri" data-stage-action onClick={() => { close(); startFocus(m); go("focus"); }}>开始</button></div>
    </div>
  );
}

function RingsStage({ close }: { close: () => void }) {
  const c = useClimate();
  const d = c ? sameDayLastYear(c) : null;
  return (
    <div className="stg">
      <div className="stg-k" style={I(0)}><b>年轮档案</b>去年今日 · 府城</div>
      {d ? (
        <>
          <div className="stg-t t-num" style={I(1)}>{d.tmin.toFixed(0)}° – {d.tmax.toFixed(0)}°C<span className="stg-sub"> · {d.rain >= 0.1 ? `雨 ${d.rain.toFixed(1)} mm` : "无雨"}</span></div>
          <div className="stg-m" style={I(2)}>{d.label}。ERA5 再分析，网格约 25 km，不是校内观测。</div>
        </>
      ) : <div className="stg-m" style={I(1)}>正在读取年轮档案…</div>}
      <div className="stg-acts" style={I(3)}><button className="stg-act" data-stage-action onClick={() => { close(); go("rings"); }}>打开年轮</button></div>
    </div>
  );
}
