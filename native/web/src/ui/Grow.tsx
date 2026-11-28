/**
 * 同源 · a surface that grows out of the thing that summoned it.
 *
 * The anchor (a button, a field) is the BASE of one contour; the panel is a STAGE that grows from
 * one of its edges with concave fillets. Opening, the stage starts as wide as the anchor and as
 * tall as nothing; closing, it folds back into the anchor. Interrupt either at any time.
 *
 * Render it inside a positioned wrapper that also holds the anchor (anchor above it in z-order),
 * so the anchor's own content stays on top of the glaze.
 */
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { clock, spring, stepS, settle, SP, clamp, type Spring } from "../kernel/motion";
import { stack, type Box, type Dir } from "../kernel/membrane";
import { Skin } from "./skin";

export type GrowProps = {
  open: boolean;
  anchor: RefObject<HTMLElement>;
  /** the stage's size */
  w: number;
  h: number;
  dir?: Dir;
  align?: "start" | "center" | "end";
  /** grow the base too (e.g. a search field that widens) — target box relative to the wrapper */
  base?: { x0: number; x1: number } | null;
  gap?: number;
  R?: number;
  fillet?: number;
  onClose?: () => void;
  className?: string;
  children?: ReactNode;
  /** called each frame with the stage's progress 0…1 (for neighbours that yield) */
  onProgress?: (q: number) => void;
};

export function Grow(p: GrowProps) {
  const host = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(p.open);
  const st = useRef<{ skin: Skin; content: HTMLDivElement; inner: HTMLDivElement; x0: Spring; x1: Spring; h: Spring; b0: Spring; b1: Spring; off: () => void } | null>(null);
  const props = useRef(p);
  props.current = p;

  if (p.open && !mounted) setMounted(true);

  useLayoutEffect(() => {
    if (!mounted || !host.current) return;
    const wrap = host.current.parentElement!;
    const skin = new Skin(host.current, "grow-skin");
    const content = document.createElement("div");
    content.className = "grow-content";
    const inner = document.createElement("div");
    inner.className = "grow-inner";
    content.appendChild(inner);
    host.current.appendChild(content);
    const s = { skin, content, inner, x0: spring(0, SP.lift), x1: spring(0, SP.lift), h: spring(0, { k: 230, c: 26 }), b0: spring(0, SP.lift), b1: spring(0, SP.lift), off: () => {} };
    const anchorBox = () => {
      const a = props.current.anchor.current!.getBoundingClientRect(), w = wrap.getBoundingClientRect();
      return { x0: a.left - w.left, x1: a.right - w.left, y0: a.top - w.top, y1: a.bottom - w.top };
    };
    const ab = anchorBox();
    settle(s.x0, ab.x0); settle(s.x1, ab.x1); settle(s.b0, ab.x0); settle(s.b1, ab.x1);
    st.current = s;
    setPortal(inner);
    let last = -1;
    s.off = clock.add((dt) => {
      const P = props.current;
      const a = anchorBox();
      const dir = P.dir ?? "down";
      const baseT = P.open && P.base ? P.base : { x0: a.x0, x1: a.x1 };
      s.b0.t = baseT.x0; s.b1.t = baseT.x1;
      const bw = baseT.x1 - baseT.x0;
      let tx0: number;
      const al = P.align ?? "center";
      if (al === "start") tx0 = baseT.x0;
      else if (al === "end") tx0 = baseT.x1 - P.w;
      else tx0 = baseT.x0 + bw / 2 - P.w / 2;
      s.x0.t = P.open ? tx0 : baseT.x0;
      s.x1.t = P.open ? tx0 + P.w : baseT.x1;
      s.h.t = P.open ? P.h : 0;
      let moving = false;
      for (const k of [s.x0, s.x1, s.h, s.b0, s.b1]) if (stepS(k, dt)) moving = true;
      const h = Math.max(0, s.h.x);
      const R = P.R ?? Math.min(20, (a.y1 - a.y0) / 2);
      const base: Box = { x0: s.b0.x, x1: s.b1.x, y0: a.y0, y1: a.y1, R: (a.y1 - a.y0) / 2 };
      const gap = P.gap ?? 0;
      const stage: Box = dir === "down"
        ? { x0: s.x0.x, x1: s.x1.x, y0: a.y1, y1: a.y1 + gap + h, R }
        : { x0: s.x0.x, x1: s.x1.x, y0: a.y0 - gap - h, y1: a.y0, R };
      // the glass only covers the contour's bounding box: build the path in that local frame
      const bx = Math.min(base.x0, stage.x0) - 2, by = Math.min(base.y0, stage.y0) - 2;
      const bw2 = Math.max(base.x1, stage.x1) + 2 - bx, bh2 = Math.max(base.y1, stage.y1) + 2 - by;
      const sh = (b: Box): Box => ({ x0: b.x0 - bx, x1: b.x1 - bx, y0: b.y0 - by, y1: b.y1 - by, R: b.R });
      const d = stack(sh(stage), sh(base), P.fillet ?? 14, dir);
      skin.draw(d, bx, by, bw2, bh2);
      const q = clamp(h / Math.max(1, P.h), 0, 1);
      const cy0 = dir === "down" ? a.y1 + gap : a.y0 - gap - h;
      content.style.transform = `translate3d(${stage.x0.toFixed(2)}px, ${cy0.toFixed(2)}px, 0)`;
      content.style.width = `${(stage.x1 - stage.x0).toFixed(2)}px`;
      content.style.height = `${h.toFixed(2)}px`;
      content.style.visibility = h > 4 ? "visible" : "hidden";
      inner.style.width = `${P.w}px`;
      inner.style.height = `${P.h}px`;
      inner.style.transform = `translate3d(${((stage.x1 - stage.x0 - P.w) / 2).toFixed(2)}px, ${dir === "down" ? 0 : (h - P.h).toFixed(2)}px, 0)`;
      inner.style.setProperty("--q", q.toFixed(3));
      if (Math.abs(q - last) > 0.001) { last = q; P.onProgress?.(q); }
      if (!P.open && h < 0.5 && !moving) { setMounted(false); return false; }
      return moving;
    });
    return () => { s.off(); skin.destroy(); content.remove(); st.current = null; setPortal(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);
  useLayoutEffect(() => { clock.wake(); }, [p.open, p.w, p.h, p.base?.x0, p.base?.x1]);

  // close on outside press / Escape
  useLayoutEffect(() => {
    if (!p.open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (host.current?.contains(t) || props.current.anchor.current?.contains(t)) return;
      props.current.onClose?.();
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") props.current.onClose?.(); };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("pointerdown", down, true); window.removeEventListener("keydown", key); };
  }, [p.open]);

  const [portal, setPortal] = useState<HTMLDivElement | null>(null);
  if (!mounted) return null;
  return (
    <div ref={host} className={"grow" + (p.className ? " " + p.className : "") + (p.open ? " is-open" : "")}>
      {portal && createPortal(p.children, portal)}
    </div>
  );
}
