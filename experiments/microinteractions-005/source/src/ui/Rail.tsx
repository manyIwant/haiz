/**
 * 侧轨 · the desk's navigation rail.
 *
 * Paper, not glaze: it is the ground the pages stand beside. Its right edge is the DATUM — a
 * hairline that bows toward the active destination and carries the one lit mark; it leans a
 * hair toward the pointer as well. A single liquid plate follows the pointer with a velocity
 * stretch. Campus unfolds its children and the items below yield to make room.
 * Compact (tablet): icons only; the hovered icon's plate stretches out past the rail into its
 * label — the same pass grammar as the dock, turned on its side.
 */
import { useLayoutEffect, useRef, useState } from "react";
import { clock, spring, stepS, settle, SP, clamp } from "../kernel/motion";
import { stack, type Box } from "../kernel/membrane";
import { useConst, useTick } from "../kernel/react";
import type { IconKind } from "../icons/kinetic";
import { go, useRoute } from "../app/router";
import { useStore, setState } from "../app/store";
import { Icon } from "./controls";
import { Skin } from "./skin";

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

export function Rail({ compact }: { compact: boolean }) {
  const route = useRoute();
  const unread = useStore((s) => s.notices.some((n) => n.unread));
  const focusOn = useStore((s) => s.focus.state === "running" || s.focus.state === "paused");
  const root = useRef<HTMLElement>(null);
  const plate = useRef<HTMLDivElement>(null);
  const datum = useRef<SVGPathElement>(null);
  const mark = useRef<HTMLDivElement>(null);
  const flyHost = useRef<HTMLDivElement>(null);
  const flyLabel = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const s = useConst(() => ({
    py: spring(0, SP.ui), ph: spring(36, SP.ui), pshow: spring(0, SP.ui),
    ay: spring(0, SP.ui), hy: spring(0, SP.follow), hpull: spring(0, SP.ui),
    fw: spring(0, SP.lift), fy: spring(0, SP.ui), skin: null as Skin | null, init: false, ptrY: 0,
  }));
  const activeId = route.page;

  useLayoutEffect(() => {
    s.skin = new Skin(flyHost.current!, "rail-fly");
    return () => s.skin?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rowOf = (id: string) => root.current?.querySelector<HTMLElement>(`[data-rail="${id}"]`) ?? null;

  useTick((dt) => {
    const r = root.current;
    if (!r) return false;
    const W = r.clientWidth, H = r.clientHeight;
    const rtop = r.getBoundingClientRect().top;
    const hRow = hover ? rowOf(hover) : null;
    const aRow = rowOf(activeId);
    if (hRow) {
      const b = hRow.getBoundingClientRect();
      s.py.t = b.top - rtop + b.height / 2; s.ph.t = b.height; s.pshow.t = 1;
    } else s.pshow.t = 0;
    if (aRow) { const b = aRow.getBoundingClientRect(); s.ay.t = b.top - rtop + b.height / 2; }
    s.hy.t = s.ptrY;
    s.hpull.t = hover ? 1 : 0;
    if (!s.init && aRow) { settle(s.ay, s.ay.t); settle(s.py, s.ay.t); s.init = true; }
    let mv = false;
    for (const k of [s.py, s.ph, s.pshow, s.ay, s.hy, s.hpull, s.fw, s.fy]) if (stepS(k, dt)) mv = true;

    // the plate: one, liquid, under the pointer
    const st = clamp(Math.abs(s.py.v) * 0.022, 0, 14) * clock.intensity;
    if (plate.current) {
      const h = s.ph.x - 4 + st;
      plate.current.style.transform = `translate3d(0, ${(s.py.x - h / 2).toFixed(2)}px, 0) scaleX(${(1 - st * 0.006).toFixed(3)})`;
      plate.current.style.height = `${h.toFixed(2)}px`;
      plate.current.style.opacity = clamp(s.pshow.x, 0, 1).toFixed(3);
    }
    // the datum: bows toward the active row (and a hair toward the pointer)
    const x0 = W - 0.5;
    const depth = (compact ? 2.4 : 3.2) * clock.intensity;
    const pull = 1.2 * s.hpull.x * clock.intensity;
    let d = "";
    const N = 90;
    for (let i = 0; i <= N; i++) {
      const y = (i / N) * H;
      const ua = Math.abs(y - s.ay.x) / 54, uh = Math.abs(y - s.hy.x) / 70;
      const ba = ua < 1 ? 0.5 * (1 + Math.cos(Math.PI * ua)) : 0;
      const bh = uh < 1 ? 0.5 * (1 + Math.cos(Math.PI * uh)) : 0;
      d += (i ? "L" : "M") + (x0 + depth * ba + pull * bh).toFixed(2) + " " + y.toFixed(1);
    }
    datum.current?.setAttribute("d", d);
    if (mark.current) {
      const ms = clamp(Math.abs(s.ay.v) * 0.03, 0, 18) * clock.intensity;
      mark.current.style.transform = `translate3d(${(x0 + depth - 1.5).toFixed(2)}px, ${(s.ay.x - 9 - ms / 2).toFixed(2)}px, 0)`;
      mark.current.style.height = `${(18 + ms).toFixed(2)}px`;
    }
    // compact: the plate stretches out past the rail into the label
    if (compact && s.skin) {
      const lab = flyLabel.current;
      const lw = lab ? lab.scrollWidth : 60;
      s.fw.t = hover ? lw + 26 : 0;
      s.fy.t = s.py.t;
      const fw = Math.max(0, s.fw.x);
      if (fw > 1 && hRow) {
        const h = 36;
        const base: Box = { x0: 14, x1: W - 14, y0: s.fy.x - h / 2, y1: s.fy.x + h / 2, R: 12 };
        const stg: Box = { x0: W - 14, x1: W - 14 + fw, y0: base.y0, y1: base.y1, R: 12 };
        const ox = 12, oy = base.y0 - 2;
        const sh = (q: Box): Box => ({ x0: q.x0 - ox, x1: q.x1 - ox, y0: q.y0 - oy, y1: q.y1 - oy, R: q.R });
        s.skin.draw(stack(sh(stg), sh(base), 0, "right"), ox, oy, stg.x1 - ox + 2, h + 4);
        s.skin.el.style.opacity = "1";
        if (lab) {
          lab.style.transform = `translate3d(${(W - 4).toFixed(1)}px, ${(s.fy.x - 13).toFixed(2)}px, 0)`;
          lab.style.clipPath = `inset(0 ${Math.max(0, lw + 12 - (fw - 6)).toFixed(1)}px 0 0)`;
          lab.style.opacity = "1";
        }
      } else {
        s.skin.el.style.opacity = "0";
        if (lab) lab.style.opacity = "0";
      }
    }
    return mv;
  });

  const onMove = (e: React.PointerEvent) => {
    const r = root.current!.getBoundingClientRect();
    s.ptrY = e.clientY - r.top;
    const row = (e.target as Element).closest<HTMLElement>("[data-rail]");
    setHover(row?.dataset.rail ?? null);
    clock.wake();
  };
  const hoveredLabel = hover ? [...GROUPS.flatMap((g) => g.items), ...FOOT].find((i) => i.id === hover)?.label ?? GROUPS.flatMap((g) => g.items.flatMap((i) => i.kids ?? [])).find((k) => k.id === hover)?.label : "";

  const row = (it: Item) => {
    const on = activeId === it.id;
    const open = it.kids && (activeId === it.id);
    return (
      <li key={it.id}>
        <a href={`#/${it.to}`} data-rail={it.id} className={"rail-i" + (on ? " is-on" : "")} aria-current={on ? "page" : undefined}
          onClick={(e) => { e.preventDefault(); go(it.to, e.currentTarget); }} title={compact ? it.label : undefined}>
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
                  onClick={(e) => { e.preventDefault(); go(k.to, e.currentTarget); }}>{k.label}</a>
              );
            })}
          </Unfold>
        )}
      </li>
    );
  };

  return (
    <nav ref={root} className={"rail" + (compact ? " rail--compact" : "")} onPointerMove={onMove} onPointerLeave={() => { setHover(null); clock.wake(); }} aria-label="主导航">
      <div ref={plate} className="rail-plate" />
      <svg className="rail-datum" aria-hidden="true"><path ref={datum} /></svg>
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
      <div ref={flyHost} className="rail-flyhost" />
      {compact && <div ref={flyLabel} className="rail-flylabel">{hoveredLabel}</div>}
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
