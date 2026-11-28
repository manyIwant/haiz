/**
 * 详情 · what a row becomes when it opens. One renderer for both forms (desk inspector, phone
 * sheet). Every body is built from the same pieces (dt-k kicker, dt-t title, dt-rows, dt-acts),
 * so a course, a notice and a building read as one family.
 */
import type { ReactNode } from "react";
import { getState, setState, startFocus, toggleTask, toast, useStore } from "../app/store";
import { go } from "../app/router";
import { WEEK, PERIODS, WEEKDAYS, NOTES, CLUBS, LABS, PHOTOS } from "../data/demo";
import { schoolDay } from "../app/time";
import { Button, Demo } from "../ui/controls";
import { useCampus } from "./CampusMap";
import { Pendulum, MagnetCoil, Lens } from "./labs";

type Out = { title: string; body: ReactNode } | null;

/** campus.json says where each photograph came from; credit it exactly that way */
export function photoCredit(note?: string) {
  if (!note) return "图：海南中学官网";
  return /用户实拍/.test(note) ? "图：HAIZ 项目实拍" : "图：海南中学官网";
}

export function renderDetail(kind: string, id: string, close: () => void): Out {
  switch (kind) {
    case "course": return course(id, close);
    case "task": return { title: "待办", body: <TaskBody id={id} close={close} /> };
    case "notice": return { title: "通知", body: <NoticeBody id={id} /> };
    case "note": return note(id, close);
    case "club": return club(id);
    case "lab": return lab(id);
    case "building": return { title: "校园建筑", body: <BuildingBody name={id} close={close} /> };
    default: return null;
  }
}

function course(id: string, close: () => void): Out {
  const [d, n] = id.includes(":") ? id.split(":").map(Number) : [schoolDay().idx, Number(id)];
  const c = WEEK[d]?.[n - 1];
  const p = PERIODS[n - 1];
  if (!c || !p) return null;
  const photo = PHOTOS[c.building];
  const notes = NOTES.filter((m) => c.subject.startsWith(m.subject));
  return {
    title: "课程",
    body: (
      <>
        <div className="dt-k">{WEEKDAYS[d]} · 第 {n} 节<Demo /></div>
        <h3 className="dt-t">{c.subject}</h3>
        {c.topic && <p className="dt-m">{c.topic}</p>}
        <div className="dt-rows">
          <div className="dt-row"><span>时间</span><span className="t-num">{p.start} – {p.end}</span></div>
          <div className="dt-row"><span>地点</span><span>{c.building} · {c.room}</span></div>
          <div className="dt-row"><span>教师</span><span>{c.teacher}</span></div>
        </div>
        {photo && <BuildingPhoto name={c.building} src={photo} />}
        {notes.length > 0 && (
          <div className="dt-sub">
            <span className="t-label">相关笔记</span>
            {notes.map((m) => (
              <button key={m.id} type="button" className="dt-link" onClick={(e) => setState({ inspector: { kind: "note", id: m.id, from: e.currentTarget.getBoundingClientRect() } })}>
                <b>{m.title}</b><span>{m.when} · {m.pages} 页</span>
              </button>
            ))}
          </div>
        )}
        <div className="dt-acts">
          <Button kind="pri" icon="focus" onClick={() => { startFocus(10, `预习 · ${c.subject}`); close(); go("focus"); }}>预习 10 分钟</Button>
          <Button kind="sec" icon="map" onClick={() => { close(); go("campus/map"); }}>在地图上看</Button>
        </div>
      </>
    ),
  };
}

function TaskBody({ id, close }: { id: string; close: () => void }) {
  const t = useStore((s) => s.tasks.find((x) => x.id === id));
  if (!t) return <p className="dt-p">这项待办已经不在了。</p>;
  return (
    <>
      <div className="dt-k">{t.subject} · {t.due}{!t.mine && <Demo />}</div>
      <h3 className={"dt-t" + (t.done ? " is-done" : "")}>{t.title}</h3>
      {t.urgent && !t.done && <p className="dt-m lanren">今天截止</p>}
      {t.note ? <p className="dt-p">{t.note}</p> : <p className="dt-p ink-3">没有备注。</p>}
      <div className="dt-acts">
        <Button kind={t.done ? "sec" : "pri"} onClick={() => { toggleTask(t.id); toast(t.done ? "已恢复为未完成" : "完成了一项", { tone: t.done ? "plain" : "lit" }); }}>{t.done ? "恢复未完成" : "标记完成"}</Button>
        {!t.done && <Button kind="sec" icon="focus" onClick={() => { startFocus(25, t.title.length > 12 ? t.title.slice(0, 12) + "…" : t.title); close(); go("focus"); }}>专注 25 分钟</Button>}
      </div>
    </>
  );
}

function NoticeBody({ id }: { id: string }) {
  const n = useStore((s) => s.notices.find((x) => x.id === id));
  if (!n) return <p className="dt-p">这条通知已经撤回。</p>;
  return (
    <>
      <div className="dt-k">{n.tag} · {n.from} · {n.time}{!n.id.startsWith("p") && <Demo />}</div>
      <h3 className="dt-t">{n.title}</h3>
      {n.img && <figure className="dt-img"><img src={n.img} alt="" /><figcaption>{n.credit}</figcaption></figure>}
      <p className="dt-p">{n.body || "（无正文）"}</p>
      <div className="dt-acts">
        <Button kind="sec" icon="schedule" onClick={() => toast("已加入日程 · 演示")}>加入日程</Button>
        <Button kind="ghost" onClick={() => toast("已转发到班级群 · 演示")}>转发</Button>
      </div>
    </>
  );
}

function note(id: string, close: () => void): Out {
  const m = NOTES.find((x) => x.id === id);
  if (!m) return null;
  return {
    title: "笔记",
    body: (
      <>
        <div className="dt-k">{m.subject} · {m.when} · {m.pages} 页<Demo /></div>
        <h3 className="dt-t">{m.title}</h3>
        <p className="dt-p">{m.excerpt}</p>
        {m.id === "m1" && (
          <>
            <ol className="dt-ol">
              <li><b>阻碍变化</b>感应电流的磁场，总要阻碍引起感应电流的磁通量的变化。</li>
              <li><b>来拒去留</b>磁铁靠近线圈时受到斥力，远离时受到引力。</li>
              <li><b>增反减同</b>磁通量增大时，感应电流的磁场与原磁场反向；减小时同向。</li>
            </ol>
            <div className="dt-lab"><MagnetCoil /></div>
          </>
        )}
        <div className="dt-acts">
          <Button kind="pri" icon="focus" onClick={() => { startFocus(25, `复习 · ${m.subject}`); close(); go("focus"); }}>复习 25 分钟</Button>
          <Button kind="sec" icon="relay" onClick={() => toast("已设为学习接力 · 演示")}>设为接力</Button>
        </div>
      </>
    ),
  };
}

function club(id: string): Out {
  const c = CLUBS.find((x) => x.id === id);
  if (!c) return null;
  return {
    title: "社团",
    body: (
      <>
        {c.img && <figure className="dt-img dt-img--top"><img src={c.img} alt="" /><figcaption>{c.credit}</figcaption></figure>}
        <div className="dt-k">社团 · <span className="t-num">{c.members}</span> 人<Demo /></div>
        <h3 className="dt-t">{c.name}</h3>
        <p className="dt-m">{c.meta}</p>
        <div className="dt-rows">
          <div className="dt-row"><span>下次活动</span><span>{c.next}</span></div>
        </div>
        <div className="dt-acts">
          <Button kind="pri" icon="plus" onClick={() => toast(`已报名 ${c.name} · 演示`, { tone: "lit" })}>报名下次活动</Button>
        </div>
      </>
    ),
  };
}

function lab(id: string): Out {
  const l = LABS.find((x) => x.id === id);
  if (!l) return null;
  return {
    title: "交互实验",
    body: (
      <>
        <div className="dt-k">{l.subject} · 交互实验</div>
        <h3 className="dt-t">{l.title}</h3>
        <p className="dt-m">{l.desc}</p>
        <div className="dt-lab">{l.kind === "pendulum" ? <Pendulum /> : l.kind === "field" ? <MagnetCoil /> : <Lens />}</div>
        <div className="dt-acts"><a className="btn btn--sec btn--md" href="https://haiz.space/lab/" target="_blank" rel="noopener"><span className="btn-l">主站完整实验册 ↗</span></a></div>
      </>
    ),
  };
}

function BuildingPhoto({ name, src }: { name: string; src: string }) {
  const campus = useCampus();
  const b = campus?.buildings.find((x) => x.name === name);
  return <figure className="dt-img"><img src={src} alt={name} loading="lazy" /><figcaption>{photoCredit(b?.note)}</figcaption></figure>;
}

function BuildingBody({ name, close }: { name: string; close: () => void }) {
  const campus = useCampus();
  if (!campus) return <p className="dt-p ink-3">正在读取校园模型…</p>;
  const b = campus.buildings.find((x) => x.name === name);
  if (!b) return <p className="dt-p">没有找到「{name}」。</p>;
  const photo = PHOTOS[b.name];
  const here = WEEK.flatMap((d, i) => d.map((c, j) => ({ c, i, j }))).filter((x) => x.c.building === b.name);
  return (
    <>
      {photo && <figure className="dt-img dt-img--top"><img src={photo} alt={b.name} /><figcaption>{photoCredit(b.note)}</figcaption></figure>}
      <div className="dt-k">{b.category} · {b.en}</div>
      <h3 className="dt-t">{b.name}</h3>
      {b.desc && <p className="dt-p">{b.desc}</p>}
      <div className="dt-rows">
        {b.floors > 1 && <div className="dt-row"><span>层数</span><span className="t-num">{b.floors} 层</span></div>}
        <div className="dt-row"><span>平面尺寸</span><span className="t-num">约 {Math.round(b.size[0])} × {Math.round(b.size[2])} m</span></div>
        {here.length > 0 && <div className="dt-row"><span>本周在这里上课</span><span className="t-num">{here.length} 节 <Demo /></span></div>}
      </div>
      {b.note && <p className="dt-src">{b.note}</p>}
      <div className="dt-acts">
        <Button kind="sec" icon="map" onClick={() => { close(); if (getState().inspector) setState({ inspector: null }); go("campus/map"); }}>在地图上看</Button>
      </div>
    </>
  );
}
