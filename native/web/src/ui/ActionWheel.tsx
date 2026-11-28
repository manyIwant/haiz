/**
 * 轮盘 · the long-press action wheel (HAIZ Native 001, after the Whitespace "action wheel" study,
 * reimplemented). Hold a finger on the page (or right-click on a desk) and a ring of glass petals
 * opens around it. Slide onto a petal and lift to run it, or lift first and tap one.
 *
 * On a task it offers that task's actions; anywhere else, the quick actions: a new task, 25
 * minutes of focus, search, switching identity, the theme, the map.
 *
 * It costs nothing until a press is held: one passive pointerdown listener and a timer.
 */
import { useEffect, useRef, useState } from "react";
import { getState, setState, toggleTask, startFocus, toast } from "../app/store";
import { go } from "../app/router";
import { pushBack } from "../platform/native";
import "./wheel.css";

type Act = { id: string; label: string; glyph: string; run(): void };

const EXCLUDE = "input, textarea, select, canvas, [role=slider], [role=switch], .dock-host, .prail, .gtog, .hkb, .wl, .vrec, .upd, .perf, [data-nowheel], .tree-stage, .cmap3, iframe";

function actionsFor(el: Element | null): { title: string; acts: Act[] } {
  const w = el?.closest<HTMLElement>("[data-wheel]")?.dataset.wheel;
  if (w?.startsWith("task:")) {
    const id = w.slice(5);
    const t = getState().tasks.find((x) => x.id === id);
    if (t) return {
      title: t.title, acts: [
        { id: "done", label: t.done ? "未完成" : "完成", glyph: "✓", run: () => toggleTask(id) },
        { id: "focus", label: "专注于此", glyph: "◔", run: () => { startFocus(25, t.title); go("focus"); } },
        { id: "fav", label: getState().favorites.includes("task:" + id) ? "取消收藏" : "收藏", glyph: "☆", run: () => toggleFav("task:" + id) },
        { id: "open", label: "详情", glyph: "↗", run: () => setState({ inspector: { kind: "task", id, from: null } }) },
      ],
    };
  }
  return {
    title: "快捷", acts: [
      { id: "new", label: "新任务", glyph: "+", run: () => { go("today"); setTimeout(() => (document.querySelector(".task-add input") as HTMLInputElement | null)?.focus(), 380); } },
      { id: "focus", label: "专注 25", glyph: "◔", run: () => { startFocus(25); go("focus"); } },
      { id: "search", label: "搜索", glyph: "⌕", run: () => setState({ searchOpen: true }) },
      { id: "who", label: "切换身份", glyph: "◐", run: () => setState({ wallOpen: true }) },
      { id: "theme", label: "明暗", glyph: "☾", run: () => setState((s) => ({ theme: (s.theme === "dark" || (s.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches)) ? "light" : "dark" })) },
      { id: "map", label: "地图", glyph: "⌖", run: () => go("campus/map") },
    ],
  };
}
function toggleFav(key: string) {
  setState((s) => ({ favorites: s.favorites.includes(key) ? s.favorites.filter((x) => x !== key) : [...s.favorites, key] }));
  toast(getState().favorites.includes(key) ? "已收藏" : "已取消收藏");
}

const R = 92;

export function ActionWheel() {
  const [w, setW] = useState<{ x: number; y: number; title: string; acts: Act[]; dragging: boolean } | null>(null);
  const [hot, setHot] = useState(-1);
  const hotRef = useRef(-1); hotRef.current = hot;
  const wRef = useRef(w); wRef.current = w;

  useEffect(() => {
    let timer = 0, sx = 0, sy = 0, target: Element | null = null;
    const cancel = () => { clearTimeout(timer); timer = 0; };
    const openAt = (x: number, y: number, el: Element | null, dragging: boolean) => {
      const a = actionsFor(el);
      const pad = R + 36;
      setW({ x: Math.min(innerWidth - pad, Math.max(pad, x)), y: Math.min(innerHeight - pad, Math.max(pad + 20, y)), title: a.title, acts: a.acts, dragging });
      setHot(-1);
      try { navigator.vibrate?.(12); } catch { /* not allowed */ }
    };
    const down = (e: PointerEvent) => {
      if (wRef.current || e.button > 0 || e.pointerType === "mouse") return;
      const t = e.target as Element;
      if (t.closest(EXCLUDE)) return;
      sx = e.clientX; sy = e.clientY; target = t;
      cancel();
      timer = window.setTimeout(() => { timer = 0; openAt(sx, sy, target, true); }, 480);
    };
    const move = (e: PointerEvent) => {
      if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel();
      const cur = wRef.current;
      if (!cur) return;
      const dx = e.clientX - cur.x, dy = e.clientY - cur.y, d = Math.hypot(dx, dy);
      if (d < 34 || d > R + 70) { if (hotRef.current !== -1) setHot(-1); return; }
      const i = petalAt(Math.atan2(dy, dx), cur.acts.length);
      if (i !== hotRef.current) { setHot(i); try { navigator.vibrate?.(4); } catch { /* */ } }
    };
    const up = () => {
      cancel();
      const cur = wRef.current;
      if (!cur || !cur.dragging) return;
      if (hotRef.current >= 0) { const a = cur.acts[hotRef.current]; setW(null); a.run(); }
      else setW({ ...cur, dragging: false });      // lifted in the middle: tap mode
    };
    const ctx = (e: MouseEvent) => {
      if (wRef.current) { e.preventDefault(); return; }
      const t = e.target as Element;
      if (t.closest(EXCLUDE) || (e as any).pointerType === "touch") return;
      if (matchMedia("(pointer: coarse)").matches) { e.preventDefault(); return; }
      e.preventDefault();
      openAt(e.clientX, e.clientY, t, false);
    };
    addEventListener("pointerdown", down, { passive: true });
    addEventListener("pointermove", move, { passive: true });
    addEventListener("pointerup", up);
    addEventListener("pointercancel", cancel);
    addEventListener("scroll", cancel, { passive: true, capture: true });
    addEventListener("contextmenu", ctx);
    return () => { removeEventListener("pointerdown", down); removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", cancel); removeEventListener("scroll", cancel, true); removeEventListener("contextmenu", ctx); };
  }, []);

  useEffect(() => { if (w) return pushBack(() => setW(null)); }, [!!w]);

  if (!w) return null;
  const n = w.acts.length;
  return (
    <div className={"awheel" + (w.dragging ? " is-drag" : "")} role="menu" aria-label={w.title} onPointerDown={(e) => { if (e.target === e.currentTarget) setW(null); }}>
      <div className="awheel-ring" style={{ left: w.x, top: w.y }}>
        <div className="awheel-core"><span>{hot >= 0 ? w.acts[hot].label : w.title}</span></div>
        {w.acts.map((a, i) => {
          const th = angleOf(i, n);
          return (
            <button key={a.id} type="button" role="menuitem" className={"awheel-p" + (i === hot ? " is-hot" : "")}
              style={{ ["--x" as any]: (Math.cos(th) * R).toFixed(1) + "px", ["--y" as any]: (Math.sin(th) * R).toFixed(1) + "px", ["--i" as any]: i }}
              onClick={() => { setW(null); a.run(); }}>
              <i>{a.glyph}</i><span>{a.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
// petals start at the top and go clockwise
const angleOf = (i: number, n: number) => -Math.PI / 2 + (i / n) * Math.PI * 2;
function petalAt(a: number, n: number) {
  const step = (Math.PI * 2) / n;
  let k = Math.round((a + Math.PI / 2) / step) % n;
  if (k < 0) k += n;
  return k;
}
