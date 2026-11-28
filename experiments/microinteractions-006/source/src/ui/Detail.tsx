/**
 * 列表 ↔ 详情 · one transition, two forms.
 *
 * Desk: the inspector slides in at the right and the page YIELDS its width to it (nothing is
 * covered). For a moment a liquid bridge joins the row you pressed to the panel's edge, so the
 * eye is carried from the source to its detail, then it drains away.
 * Phone: the row itself becomes the sheet — a container transform from the row's rectangle to
 * the sheet's, corner radii and all; drag it down and it shrinks back toward where it came from.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { clock, spring, stepS, settle, SP, clamp, lerp } from "../kernel/motion";
import { useConst, useTick } from "../kernel/react";
import { useStore, setState } from "../app/store";
import { Icon } from "./controls";

export function Detail({ phone, render }: { phone: boolean; render: (kind: string, id: string, close: () => void) => { title: string; body: ReactNode } | null }) {
  const insp = useStore((s) => s.inspector);
  const [shown, setShown] = useState(insp);
  const close = () => setState({ inspector: null });
  useEffect(() => { if (insp) setShown(insp); }, [insp]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && insp) close(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [insp]);
  const content = shown ? render(shown.kind, shown.id, close) : null;
  return phone
    ? <PhoneSheet open={!!insp} from={shown?.from ?? null} onClose={close} onGone={() => setShown(null)} title={content?.title ?? ""}>{content?.body}</PhoneSheet>
    : <Inspector open={!!insp} from={insp?.from ?? null} onClose={close} onGone={() => setShown(null)} title={content?.title ?? ""} k={shown ? shown.kind + shown.id : ""}>{content?.body}</Inspector>;
}

export const INSPECTOR_W = 392;

function Inspector({ open, from, onClose, onGone, title, children, k }: { open: boolean; from: DOMRect | null; onClose: () => void; onGone: () => void; title: string; children: ReactNode; k: string }) {
  const panel = useRef<HTMLElement>(null);
  const bridge = useRef<SVGPathElement>(null);
  const s = useConst(() => ({ x: spring(0, SP.soft), b: spring(0, { k: 120, c: 20 }), from: null as DOMRect | null }));
  useLayoutEffect(() => {
    s.x.t = open ? 1 : 0;
    if (open && from) { s.from = from; s.b.x = 1; s.b.v = 0; s.b.t = 0; }
    clock.wake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, from, k]);
  useTick((dt) => {
    const a = stepS(s.x, dt), b = stepS(s.b, dt);
    const p = clamp(s.x.x, 0, 1.02);
    document.documentElement.style.setProperty("--insp", (p * INSPECTOR_W).toFixed(2) + "px");
    if (panel.current) {
      panel.current.style.transform = `translate3d(${((1 - p) * (INSPECTOR_W + 24)).toFixed(2)}px, 0, 0)`;
      panel.current.style.visibility = p > 0.002 ? "visible" : "hidden";
      panel.current.style.setProperty("--q", clamp((p - 0.25) / 0.75, 0, 1).toFixed(3));
    }
    // the bridge: from the row's right edge to the panel's left edge, draining as b → 0
    const el = bridge.current;
    if (el) {
      const f = s.from, bb = clamp(s.b.x, 0, 1) * clock.intensity;
      if (f && bb > 0.02 && panel.current) {
        const px = window.innerWidth - INSPECTOR_W * p;
        const x0 = Math.min(f.right, px - 30) - 6, y0 = f.top + f.height / 2, h0 = (f.height / 2) * bb;
        const top = 72, h1 = Math.max(h0, 46 * bb);
        const y1 = clamp(y0, top + h1, window.innerHeight - h1 - 20);
        const mx = (x0 + px) / 2;
        el.setAttribute("d", `M${x0} ${y0 - h0}C${mx} ${y0 - h0} ${mx} ${y1 - h1} ${px} ${y1 - h1}L${px} ${y1 + h1}C${mx} ${y1 + h1} ${mx} ${y0 + h0} ${x0} ${y0 + h0}Z`);
        el.style.opacity = (0.9 * Math.min(1, bb * 1.6)).toFixed(3);
      } else el.style.opacity = "0";
    }
    if (!open && s.x.x < 0.002 && !a) onGone();
    return a || b;
  });
  return (
    <>
      <svg className="bridge" aria-hidden="true"><path ref={bridge} /></svg>
      <aside ref={panel} className="insp" aria-label={title} aria-hidden={!open}>
        <header className="insp-h">
          <span className="insp-t">{title}</span>
          <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={onClose} aria-label="关闭"><Icon kind="close" size={18} /></button>
        </header>
        <div className="insp-b" key={k}>{children}</div>
      </aside>
    </>
  );
}

function PhoneSheet({ open, from, onClose, onGone, title, children }: { open: boolean; from: DOMRect | null; onClose: () => void; onGone: () => void; title: string; children: ReactNode }) {
  const card = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const s = useConst(() => ({ p: spring(0, SP.soft), drag: 0, dragging: false, from: null as DOMRect | null, y0: 0 }));
  useLayoutEffect(() => {
    if (open) { s.from = from; s.p.t = 1; } else s.p.t = 0;
    clock.wake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, from]);
  useTick((dt) => {
    const m = stepS(s.p, dt);
    const el = card.current;
    if (!el) return m;
    const W = window.innerWidth, H = window.innerHeight;
    const p = clamp(s.p.x, 0, 1.03);
    const f = s.from ?? new DOMRect(16, H - 120, W - 32, 80);
    const top = Math.round(H * 0.1) + Math.max(0, s.drag);
    const tx0 = 0, ty0 = top, tx1 = W, ty1 = H + 40;
    const x0 = lerp(f.left, tx0, p), y0 = lerp(f.top, ty0, p), x1 = lerp(f.right, tx1, p), y1 = lerp(f.bottom, ty1, p);
    el.style.transform = `translate3d(${x0.toFixed(2)}px, ${y0.toFixed(2)}px, 0)`;
    el.style.width = `${(x1 - x0).toFixed(2)}px`;
    el.style.height = `${(y1 - y0).toFixed(2)}px`;
    el.style.borderRadius = `${lerp(14, 26, p).toFixed(1)}px ${lerp(14, 26, p).toFixed(1)}px ${lerp(14, 0, p).toFixed(1)}px ${lerp(14, 0, p).toFixed(1)}px`;
    el.style.visibility = s.p.x > 0.003 || s.p.t > 0 ? "visible" : "hidden";
    el.style.setProperty("--q", clamp((p - 0.45) / 0.55, 0, 1).toFixed(3));
    if (scrim.current) scrim.current.style.opacity = (clamp(p, 0, 1) * 0.32 * (1 - clamp(s.drag / 400, 0, 1))).toFixed(3);
    if (scrim.current) scrim.current.style.pointerEvents = open ? "auto" : "none";
    if (!open && s.p.x < 0.003 && !m) onGone();
    return m;
  });
  return (
    <>
      <div ref={scrim} className="sheet-scrim" onClick={onClose} />
      <div ref={card} className="psheet" role="dialog" aria-modal="true" aria-label={title} aria-hidden={!open}>
        <div className="psheet-grab"
          onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); s.dragging = true; s.y0 = e.clientY; }}
          onPointerMove={(e) => { if (!s.dragging) return; s.drag = Math.max(-20, e.clientY - s.y0); clock.wake(); }}
          onPointerUp={() => { s.dragging = false; if (s.drag > 110) onClose(); s.drag = 0; clock.wake(); }}>
          <i />
        </div>
        <header className="psheet-h"><span className="insp-t">{title}</span><button type="button" className="btn btn--sec btn--icon btn--sm" onClick={onClose} aria-label="关闭"><Icon kind="close" size={18} /></button></header>
        <div className="psheet-b">{children}</div>
      </div>
    </>
  );
}
