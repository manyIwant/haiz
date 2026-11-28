/**
 * 侧轨 · the desk's navigation rail (006).
 *
 * Paper, not glaze: it is the ground the pages stand beside. Its right edge is the DATUM, and in
 * 006 the datum is a liquid surface. Hover an entry and a drop of optical glass is drawn out of
 * that surface beside it — it swells at the edge, necks, and grows outward into the gutter — so
 * the rail's own icons and labels are never covered. Move to the next entry and the drop travels
 * with you: it stretches with speed, its neck lags behind on the wall, and a long jump lets the
 * old drop sink back while a new one rises. Two drops that come close fuse (surface tension, one
 * contour: kernel/liquid). The active entry keeps a small bead on the wall with the one lit mark,
 * and a drop that grows next to it is born from it.
 *
 * Inside the drop is a glimpse of the destination — the next lesson, the unread notices, this
 * month's 榄仁 — so the hover tells you something before the click. There is no native tooltip
 * any more (005 showed one on top of its own glass); the label for assistive tech is aria-label.
 */
import { useLayoutEffect, useRef, useState } from "react";
import { clock, spring, stepS, settle, SP, clamp, lerp, type Spring } from "../kernel/motion";
import { sdCapsule, sdEllipse, smin, trace, wallSpans } from "../kernel/liquid";
import { useConst, useTick } from "../kernel/react";
import type { IconKind } from "../icons/kinetic";
import { go, useRoute } from "../app/router";
import { useStore, setState } from "../app/store";
import { Icon } from "./controls";
import { Drop } from "./drop";
import { nextCourse, now as clockNow } from "../app/time";
import { NOTES, STUDENT, WEEK } from "../data/demo";
import { fmtClock } from "../app/store";
import { useClimate, sameDayLastYear } from "../culture/useClimate";
import { seasonAt, leafColour } from "../culture/season";

type Item = { id: string; label: string; icon: IconKind; to: string; badge?: boolean; kids?: { id: string; label: string; to: string }[] };
const GROUPS: { label: string; items: Item[] }[] = [
  { label: "日常", items: [
    { id: "today", label: "今日", icon: "today", to: "today" },
    { id: "schedule", label: "日程", icon: "schedule", to: "schedule" },
    { id: "focus", label: "专注", icon: "focus", to: "focus" },
  ] },
  { label: "学习", items: [
    { id: "study", label: "学习", icon: "study", to: "study" },
    { id: "growth", label: "成长记录", icon: "growth", to: "growth" },
  ] },
  { label: "校园", items: [
    { id: "campus", label: "校园", icon: "campus", to: "campus", kids: [
      { id: "notice", label: "公告", to: "campus/notice" },
      { id: "club", label: "社团", to: "campus/club" },
      { id: "map", label: "地图", to: "campus/map" },
    ] },
  ] },
  { label: "文化", items: [
    { id: "rings", label: "年轮", icon: "rings", to: "rings" },
    { id: "tree", label: "榄仁", icon: "tree", to: "tree" },
    { id: "wander", label: "入画", icon: "wander", to: "wander" },
  ] },
];
const FOOT: Item[] = [
  { id: "teacher", label: "教师工作台", icon: "teacher", to: "teacher" },
  { id: "me", label: "我", icon: "me", to: "me" },
];


const GAP = 12;          // the drop's inner edge sits this far out from the wall
const K_NECK = 15;       // meniscus width between the drop and the wall (px)
const SMALL = (x: number) => x * x * (3 - 2 * x);

type Slot = { id: string | null; y: Spring; ay: Spring; g: Spring; w: Spring; press: Spring };

/** the glimpse shown inside a drop: what is on the other side of this entry, right now */
function usePeeks() {
  const unread = useStore((s) => s.notices.filter((n) => n.unread).length);
  const focus = useStore((s) => s.focus);
  const role = useStore((s) => s.role);
  const c = useClimate();
  const last = c ? sameDayLastYear(c) : null;
  const m = clockNow().getMonth();
  const doy = Math.floor((Date.UTC(2025, m, 15) - Date.UTC(2025, 0, 0)) / 864e5);
  const ss = seasonAt(doy);
  const lc = leafColour(Math.min(1, ss.turn * 0.75), 0.35, Math.max(0, 1 - ss.flush) * 0.8, 0.5).map((v: number) => Math.round(255 * Math.pow(Math.min(1, v * 1.6), 1 / 2.2)));
  const nc = nextCourse();
  return (id: string): React.ReactNode => {
    switch (id) {
      case "today": return <><b>{nc.now ? "正在上" : "下一节"}</b>{nc.course.subject} · {nc.course.start}</>;
      case "schedule": return <><b>本周</b>{WEEK.reduce((a, d) => a + d.length, 0)} 节课</>;
      case "focus": return focus.state === "running" || focus.state === "paused" ? <><b>进行中</b><span className="t-num">{fmtClock(focus.left)}</span></> : <><b>一轮</b>25 分钟</>;
      case "study": return <><b>笔记</b>{NOTES.length} 篇 · 实验册</>;
      case "growth": return <><b>本学期</b>成长档案</>;
      case "campus": return unread ? <><b className="lanren">{unread}</b>条未读公告</> : <><b>公告</b>都读过了</>;
      case "k-notice": return <><b>公告</b>{unread ? `${unread} 条未读` : "全部已读"}</>;
      case "k-club": return <><b>社团</b>本周 3 场活动</>;
      case "k-map": return <><b>地图</b>26 栋真实建筑</>;
      case "rings": return last ? <><b>去年今日</b><span className="t-num">{last.tmin.toFixed(0)}–{last.tmax.toFixed(0)}°C</span></> : <><b>年轮</b>逐日天气</>;
      case "tree": return <><i className="peek-leaf" style={{ background: `rgb(${lc.join(",")})` }} /><b>{m + 1} 月</b>{ss.label}</>;
      case "wander": return <><i className="peek-lens" /><b>入画</b>走进画里</>;
      case "teacher": return <><b>{role === "teacher" ? "已切换" : "切换"}</b>教师身份</>;
      case "me": return <><b>{STUDENT.name}</b>{STUDENT.cls}</>;
    }
    return null;
  };
}

export function Rail({ compact }: { compact: boolean }) {
  const route = useRoute();
  const unread = useStore((s) => s.notices.some((n) => n.unread));
  const focusOn = useStore((s) => s.focus.state === "running" || s.focus.state === "paused");
  const root = useRef<HTMLElement>(null);
  const plate = useRef<HTMLDivElement>(null);
  const datum = useRef<SVGPathElement>(null);
  const mark = useRef<HTMLDivElement>(null);
  const liquid = useRef<HTMLDivElement>(null);
  const peekEls = useRef<(HTMLDivElement | null)[]>([null, null]);
  const [hover, setHover] = useState<string | null>(null);
  const [slotIds, setSlotIds] = useState<(string | null)[]>([null, null]);
  const peeks = usePeeks();
  const mkSlot = (): Slot => ({ id: null, y: spring(0, SP.lift), ay: spring(0, SP.follow), g: spring(0, { k: 190, c: 21 }), w: spring(80, SP.ui), press: spring(0, SP.snap) });
  const s = useConst(() => ({
    py: spring(0, SP.ui), ph: spring(36, SP.ui), pshow: spring(0, SP.ui),
    ay: spring(0, SP.ui), slots: [mkSlot(), mkSlot()] as Slot[], drop: null as Drop | null, init: false,
  }));
  const activeId = route.page === "campus" ? "campus" : route.page;

  useLayoutEffect(() => {
    s.drop = new Drop(liquid.current!, "rail-drop");
    return () => s.drop?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rowOf = (id: string) => root.current?.querySelector<HTMLElement>(`[data-rail="${id}"]`) ?? null;
  const rowY = (id: string) => {
    const r = root.current, row = rowOf(id);
    if (!r || !row) return null;
    const b = row.getBoundingClientRect();
    return b.top - r.getBoundingClientRect().top + b.height / 2;
  };

  // which drop serves the hovered entry: travel if close, otherwise sink one and raise the other
  useLayoutEffect(() => {
    const [A, B] = s.slots;
    if (!hover) { for (const sl of s.slots) sl.g.t = 0; clock.wake(); return; }
    const y = rowY(hover);
    if (y == null) return;
    const own = s.slots.find((sl) => sl.id === hover && sl.g.t > 0);
    if (own) { own.y.t = y; clock.wake(); return; }
    const live = A.g.t > 0 ? A : B.g.t > 0 ? B : (A.g.x >= B.g.x ? A : B);
    const other = live === A ? B : A;
    if (live.g.x > 0.25 && Math.abs(live.y.x - y) < 150) {
      live.id = hover; live.y.t = y; live.g.t = 1;
      other.g.t = 0;
    } else {
      live.g.t = 0;
      other.id = hover; settle(other.y, y); settle(other.ay, y); other.g.x = 0; other.g.v = 0; other.g.t = 1;
      other.w.x = other.w.t;
    }
    setSlotIds(s.slots.map((sl) => sl.id));
    clock.wake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hover]);

  useTick((dt) => {
    const r = root.current;
    if (!r) return false;
    const W = r.clientWidth, H = r.clientHeight;
    const rtop = r.getBoundingClientRect().top;
    const hRow = hover ? rowOf(hover) : null;
    const aRow = rowOf(activeId);
    if (hRow && !compact) {
      const b = hRow.getBoundingClientRect();
      s.py.t = b.top - rtop + b.height / 2; s.ph.t = b.height; s.pshow.t = 1;
    } else s.pshow.t = 0;
    if (aRow) { const b = aRow.getBoundingClientRect(); s.ay.t = b.top - rtop + b.height / 2; }
    if (!s.init && aRow) { settle(s.ay, s.ay.t); settle(s.py, s.ay.t); s.init = true; }
    let mv = false;
    for (const k of [s.py, s.ph, s.pshow, s.ay]) if (stepS(k, dt)) mv = true;
    for (let i = 0; i < 2; i++) {
      const sl = s.slots[i];
      const pe = peekEls.current[i];
      if (pe) sl.w.t = pe.scrollWidth + 30;
      if (sl.id && sl.g.t > 0) { const y = rowY(sl.id); if (y != null) sl.y.t = y; }
      sl.ay.t = sl.y.t;
      for (const k of [sl.y, sl.ay, sl.g, sl.w, sl.press]) if (stepS(k, dt)) mv = true;
    }

    // the plate (expanded only): paper, under the row — it never covers the icon
    if (plate.current) {
      const st = clamp(Math.abs(s.py.v) * 0.022, 0, 14) * clock.intensity;
      const h = s.ph.x - 4 + st;
      plate.current.style.transform = `translate3d(0, ${(s.py.x - h / 2).toFixed(2)}px, 0) scaleX(${(1 - st * 0.006).toFixed(3)})`;
      plate.current.style.height = `${h.toFixed(2)}px`;
      plate.current.style.opacity = clamp(s.pshow.x, 0, 1).toFixed(3);
    }

    // ---- the liquid wall: bead at the active entry + up to two drops, one field, one contour ----
    const I = clock.intensity;
    const bead = { x: -1.6, y: s.ay.x, rx: 4.4 * (0.6 + 0.4 * I), ry: 10 + clamp(Math.abs(s.ay.v) * 0.02, 0, 14) * I };
    type D = { cap: { x: number; y: number; rx: number; ry: number }; tail: { x: number; y: number; rx: number; ry: number }; e: number };
    const drops: D[] = [];
    for (const sl of s.slots) {
      const g = clamp(sl.g.x, 0, 1.08);
      if (g < 0.004) continue;
      const e = SMALL(clamp(g, 0, 1));
      const st = clamp(Math.abs(sl.y.v) * 0.016, 0, 9) * I;
      const w = Math.max(40, sl.w.x) * (1 - 0.05 * sl.press.x);
      const rx = lerp(5, w / 2, e) - st * 0.7;
      const ry = lerp(4, 17, Math.min(1, g * 1.15)) + st;
      drops.push({
        e,
        cap: { x: lerp(-3, GAP + w / 2, e) + (g - e) * 10, y: sl.y.x, rx: Math.max(3, rx), ry },
        tail: { x: -2, y: lerp(sl.y.x, sl.ay.x, 0.85), rx: lerp(2, 5.5, e), ry: lerp(5, 11, e) + st * 0.6 },
      });
    }
    let x1 = 12, y0 = bead.y - 30, y1 = bead.y + 30;
    for (const d of drops) { x1 = Math.max(x1, d.cap.x + d.cap.rx + 18); y0 = Math.min(y0, d.cap.y - d.cap.ry - 34, d.tail.y - 30); y1 = Math.max(y1, d.cap.y + d.cap.ry + 34, d.tail.y + 30); }
    y0 = Math.max(-40, y0); y1 = Math.min(H + 40, y1);
    const sdf = (x: number, y: number) => {
      let v = smin(x, sdEllipse(x, y, bead), 7);
      for (const d of drops) {
        const blob = smin(sdCapsule(x, y, d.cap), sdEllipse(x, y, d.tail), 12);
        v = smin(v, blob, K_NECK * (0.55 + 0.45 * d.e));
      }
      return Math.max(v, 1.3 - x);
    };
    const bx = -4, by = y0 - 6, bw = x1 + 12, bh = y1 - y0 + 12;
    const tr = trace((x, y) => sdf(x + bx, y + by), 0, 0, bw, bh, drops.length ? 2.2 : 1.6);
    if (liquid.current) liquid.current.style.left = `${W}px`;
    s.drop?.draw(tr.d, bx, by, bw, bh);
    if (s.drop) s.drop.el.dataset.live = drops.length ? "1" : "0";

    // the straight datum, broken where the surface bulges out (the bulges draw their own edge)
    const spans = wallSpans(tr.rings, 1.3 - bx, 1.8).map(([a, b]) => [a + by, b + by] as [number, number]);
    let d = "", yy = 0;
    const xd = W - 0.5;
    for (const [a, b] of spans) { if (a > yy) d += `M${xd} ${yy.toFixed(1)}L${xd} ${a.toFixed(1)}`; yy = Math.max(yy, b); }
    if (yy < H) d += `M${xd} ${yy.toFixed(1)}L${xd} ${H}`;
    datum.current?.setAttribute("d", d);
    if (mark.current) {
      const ms = clamp(Math.abs(s.ay.v) * 0.03, 0, 18) * I;
      mark.current.style.transform = `translate3d(${(W - 1.2).toFixed(2)}px, ${(s.ay.x - 8 - ms / 2).toFixed(2)}px, 0)`;
      mark.current.style.height = `${(16 + ms).toFixed(2)}px`;
    }
    // glimpses ride their drops
    for (let i = 0; i < 2; i++) {
      const pe = peekEls.current[i], sl = s.slots[i];
      if (!pe) continue;
      const g = clamp(sl.g.x, 0, 1);
      const show = clamp((g - 0.55) / 0.45, 0, 1);
      pe.style.transform = `translate3d(${(W + GAP + 15 - (1 - show) * 8).toFixed(1)}px, ${(sl.y.x - 13).toFixed(2)}px, 0)`;
      pe.style.opacity = show.toFixed(3);
      pe.style.filter = show < 0.98 ? `blur(${((1 - show) * 3).toFixed(2)}px)` : "";
    }
    return mv;
  });

  const onMove = (e: React.PointerEvent) => {
    const row = (e.target as Element).closest<HTMLElement>("[data-rail]");
    setHover(row?.dataset.rail ?? null);
    clock.wake();
  };
  const pressSlot = (on: boolean) => { const sl = s.slots.find((x) => x.id === hover); if (sl) { sl.press.t = on ? 1 : 0; clock.wake(); } };
  const labelOf = (id: string | null) => !id ? "" : [...GROUPS.flatMap((g) => g.items), ...FOOT].find((i) => i.id === id)?.label ?? GROUPS.flatMap((g) => g.items.flatMap((i) => i.kids ?? [])).find((k) => "k-" + k.id === id)?.label ?? "";

  const row = (it: Item) => {
    const on = activeId === it.id;
    const open = it.kids && (activeId === it.id);
    return (
      <li key={it.id}>
        <a href={`#/${it.to}`} data-rail={it.id} className={"rail-i" + (on ? " is-on" : "")} aria-current={on ? "page" : undefined} aria-label={compact ? it.label : undefined}
          onFocus={() => setHover(it.id)} onBlur={() => setHover(null)}
          onClick={(e) => { e.preventDefault(); go(it.to, e.currentTarget); }}>
          <Icon kind={it.icon} size={20} active={on} />
          <span className="rail-l">{it.label}</span>
          {it.id === "campus" && unread && <i className="rail-dot" aria-label="有未读" />}
          {it.id === "focus" && focusOn && <i className="rail-live" aria-label="进行中" />}
        </a>
        {it.kids && !compact && (
          <Unfold open={!!open}>
            {it.kids.map((k, i) => {
              const kon = activeId === "campus" && (route.sub || "notice") === k.id;
              return (
                <a key={k.id} href={`#/${k.to}`} data-rail={"k-" + k.id} className={"rail-k" + (kon ? " is-on" : "")} style={{ ["--i" as any]: i }}
                  onFocus={() => setHover("k-" + k.id)} onBlur={() => setHover(null)}
                  onClick={(e) => { e.preventDefault(); go(k.to, e.currentTarget); }}>{k.label}</a>
              );
            })}
          </Unfold>
        )}
      </li>
    );
  };

  return (
    <nav ref={root} className={"rail" + (compact ? " rail--compact" : "")} onPointerMove={onMove} onPointerLeave={() => { setHover(null); clock.wake(); }}
      onPointerDown={() => pressSlot(true)} onPointerUp={() => pressSlot(false)} aria-label="主导航">
      <div ref={plate} className="rail-plate" />
      <svg className="rail-datum" aria-hidden="true"><path ref={datum} /></svg>
      <div ref={liquid} className="rail-liquid" aria-hidden="true" />
      <div ref={mark} className="rail-mark" />
      <a className="rail-brand" href="#/today" onClick={(e) => { e.preventDefault(); go("today"); }}>
        <span className="rail-seal">海</span>
        <span className="rail-bt"><b>HAIZ</b><small>非官方 · 演示原型</small></span>
      </a>
      <div className="rail-scroll">
        {GROUPS.map((g) => (
          <section key={g.label} className="rail-g">
            <h3 className="rail-gl">{g.label}</h3>
            <ul>{g.items.map(row)}</ul>
          </section>
        ))}
      </div>
      <ul className="rail-foot">{FOOT.map(row)}</ul>
      <button className="rail-toggle" type="button" onClick={() => setState((st) => ({ railCompact: !st.railCompact }))} aria-label={compact ? "展开侧轨" : "收起侧轨"}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d={compact ? "M6 4 L10 8 L6 12" : "M10 4 L6 8 L10 12"} /></svg>
      </button>
      {slotIds.map((id, i) => (
        <div key={i} ref={(el) => { peekEls.current[i] = el; }} className="rail-peek" aria-hidden="true">
          {id && <span className="rail-peek-in" key={id}>{compact && <em>{labelOf(id)}</em>}{peeks(id)}</span>}
        </div>
      ))}
    </nav>
  );
}

/** height on a spring; children reveal from the top with a distance stagger, and what follows yields */
export function Unfold({ open, children }: { open: boolean; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const s = useConst(() => ({ h: spring(open ? -1 : 0, SP.lift), first: true }));
  useLayoutEffect(() => { clock.wake(); }, [open]);
  useTick((dt) => {
    const ih = inner.current?.scrollHeight ?? 0;
    s.h.t = open ? ih : 0;
    if (s.first) { settle(s.h, s.h.t); s.first = false; }
    const m = stepS(s.h, dt);
    if (box.current) {
      box.current.style.height = `${Math.max(0, s.h.x).toFixed(2)}px`;
      box.current.style.setProperty("--q", ih ? clamp(s.h.x / ih, 0, 1).toFixed(3) : "0");
    }
    return m;
  });
  return <div ref={box} className="unfold" aria-hidden={!open}><div ref={inner} className="unfold-in">{children}</div></div>;
}
