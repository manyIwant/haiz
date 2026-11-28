/**
 * 基础组件 · base components. Each is a small study in one of the four laws:
 *   Switch     同源 — the knob is a drop of the track's material; it stretches as it travels
 *   Slider     基准 — the track is a datum that dips under the thumb; the readout grows from it
 *   Segmented  让位 — one plate, shared, gliding with a velocity stretch
 *   Field      基准 — the underline lights outward from where you pressed
 *   Check      生长 — the stroke draws itself; the row then yields its place
 *   Select     同源 — the menu grows out of the button's own outline
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { clock, spring, stepS, settle, SP, clamp, falloff, type Spring } from "../kernel/motion";
import { stack, type Box } from "../kernel/membrane";
import { useConst, useTick } from "../kernel/react";
import { mountIcon, type IconKind, type KineticIcon } from "../icons/kinetic";
import { Skin } from "./skin";
import { Grow } from "./Grow";

/* ---------------- Icon ---------------- */
export function Icon({ kind, size = 22, active = false, variant, lean, className, hoverHost = true, ping }: { kind: IconKind; size?: number; active?: boolean; variant?: number; lean?: number; className?: string; hoverHost?: boolean; ping?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const ic = useRef<KineticIcon | null>(null);
  useLayoutEffect(() => {
    const i = mountIcon(ref.current!, kind, size);
    ic.current = i;
    i.setActive(active);
    if (variant !== undefined) i.setVariant(variant);
    // the nearest interactive ancestor drives the icon's pass state (Muse: change before the click)
    const host = hoverHost ? (ref.current!.closest("button, a, [data-hover]") as HTMLElement | null) : null;
    let lx = 0;
    const enter = (e: PointerEvent) => { if (e.pointerType !== "touch") i.setHover(true, (e.clientX - lx) / 12); };
    const leave = (e: PointerEvent) => i.setHover(false, (e.clientX - lx) / 30);
    const move = (e: PointerEvent) => { lx = e.clientX; };
    const down = () => i.setPress(true);
    const up = () => i.setPress(false);
    const fin = () => { if (host?.matches(":focus-visible")) i.setHover(true, 0); };
    const fout = () => i.setHover(false, 0);
    if (host) {
      host.addEventListener("pointerenter", enter);
      host.addEventListener("pointerleave", leave);
      host.addEventListener("pointermove", move);
      host.addEventListener("pointerdown", down);
      window.addEventListener("pointerup", up);
      host.addEventListener("focus", fin);
      host.addEventListener("blur", fout);
    }
    return () => {
      i.destroy();
      if (host) {
        host.removeEventListener("pointerenter", enter);
        host.removeEventListener("pointerleave", leave);
        host.removeEventListener("pointermove", move);
        host.removeEventListener("pointerdown", down);
        window.removeEventListener("pointerup", up);
        host.removeEventListener("focus", fin);
        host.removeEventListener("blur", fout);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, size]);
  useEffect(() => { ic.current?.setActive(active); }, [active]);
  useEffect(() => { if (variant !== undefined) ic.current?.setVariant(variant); }, [variant]);
  useEffect(() => { if (lean !== undefined) ic.current?.setLean(lean); }, [lean]);
  // a count that rises (a new notice) knocks the icon once; falling counts stay quiet
  const lastPing = useRef(ping);
  useEffect(() => {
    if (ping !== undefined && lastPing.current !== undefined && ping > lastPing.current) ic.current?.impulse(1.2);
    lastPing.current = ping;
  }, [ping]);
  return <span ref={ref} className={"ico" + (className ? " " + className : "")} style={{ width: size, height: size }} />;
}

export const Demo = ({ children = "演示" }: { children?: ReactNode }) => <span className="demo-tag">{children}</span>;

/* ---------------- Button ---------------- */
export function Button({ children, icon, kind = "sec", size = "md", onClick, type = "button", disabled, className, style, title }: {
  children?: ReactNode; icon?: IconKind; kind?: "pri" | "sec" | "ghost" | "line"; size?: "sm" | "md" | "lg"; onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: "button" | "submit"; disabled?: boolean; className?: string; style?: CSSProperties; title?: string;
}) {
  return (
    <button type={type} className={`btn btn--${kind} btn--${size}${icon && !children ? " btn--icon" : ""}${className ? " " + className : ""}`} onClick={onClick} disabled={disabled} style={style} title={title} aria-label={title}>
      {icon && <Icon kind={icon} size={size === "sm" ? 18 : 20} />}
      {children && <span className="btn-l">{children}</span>}
    </button>
  );
}

/* ---------------- Switch ---------------- */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  const knob = useRef<HTMLSpanElement>(null);
  const s = useConst(() => ({ x: spring(checked ? 1 : 0, SP.ui), press: spring(0, SP.snap) }));
  const [pressed, setPressed] = useState(false);
  s.x.t = checked ? 1 : 0;
  s.press.t = pressed ? 1 : 0;
  useLayoutEffect(() => { clock.wake(); }, [checked, pressed]);
  useTick((dt) => {
    const a = stepS(s.x, dt), b = stepS(s.press, dt);
    const el = knob.current;
    if (el) {
      const W = 46, K = 22, P = 2;
      const stretch = clamp(Math.abs(s.x.v) * 2.4, 0, 9) * clock.intensity + s.press.x * 5;
      const w = K + stretch;
      const x = P + s.x.x * (W - 2 * P - w);
      el.style.transform = `translateX(${x.toFixed(2)}px)`;
      el.style.width = `${w.toFixed(2)}px`;
    }
    return a || b;
  });
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={"sw" + (checked ? " is-on" : "")}
      onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)} onPointerLeave={() => setPressed(false)}
      onClick={() => onChange(!checked)}>
      <span className="sw-track"><span ref={knob} className="sw-knob" /></span>
    </button>
  );
}

/* ---------------- Slider ---------------- */
export function Slider({ value, onChange, min = 0, max = 1, step = 0.01, label, format = (v) => v.toFixed(2), width }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; label?: string; format?: (v: number) => string; width?: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const path = useRef<SVGPathElement>(null);
  const fill = useRef<SVGPathElement>(null);
  const thumb = useRef<HTMLDivElement>(null);
  const read = useRef<HTMLDivElement>(null);
  const skinHost = useRef<HTMLDivElement>(null);
  const s = useConst(() => ({ x: spring((value - min) / (max - min), SP.ui), drag: spring(0, SP.ui), skin: null as Skin | null, w: 240 }));
  const [drag, setDrag] = useState(false);
  const [hot, setHot] = useState(false);
  s.x.t = clamp((value - min) / (max - min), 0, 1);
  s.drag.t = drag ? 1 : hot ? 0.35 : 0;
  useLayoutEffect(() => {
    s.skin = new Skin(skinHost.current!, "sl-skin");
    return () => s.skin?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLayoutEffect(() => { clock.wake(); }, [value, drag, hot]);
  useTick((dt) => {
    const a = stepS(s.x, dt), b = stepS(s.drag, dt);
    const r = root.current;
    if (!r) return a || b;
    const W = r.clientWidth, cy = 22, pad = 11;
    s.w = W;
    const tx = pad + s.x.x * (W - 2 * pad);
    const g = s.drag.x;
    // the datum dips under the thumb while it is held (a string pressed by a finger)
    const depth = 3.2 * g * clock.intensity, reach = 46;
    let d = "", fd = "";
    const N = 48;
    for (let i = 0; i <= N; i++) {
      const x = pad + (i / N) * (W - 2 * pad);
      const u = Math.abs(x - tx) / reach;
      const y = cy + depth * (u < 1 ? 0.5 * (1 + Math.cos(Math.PI * u)) : 0);
      d += (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(2);
      if (x <= tx) fd += (fd ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(2);
    }
    fd += `L${tx.toFixed(1)} ${(cy + depth).toFixed(2)}`;
    path.current?.setAttribute("d", d);
    fill.current?.setAttribute("d", fd);
    const tr = 9 + 2 * g;
    if (thumb.current) {
      thumb.current.style.transform = `translate3d(${(tx - tr).toFixed(2)}px, ${(cy + depth - tr).toFixed(2)}px, 0)`;
      thumb.current.style.width = thumb.current.style.height = `${(2 * tr).toFixed(2)}px`;
    }
    // the readout grows out of the thumb's own outline
    const rh = 30 * Math.max(0, (g - 0.3) / 0.7), rw = 54;
    const base: Box = { x0: tx - tr, x1: tx + tr, y0: cy + depth - tr, y1: cy + depth + tr, R: tr };
    if (rh > 0.5) {
      const st: Box = { x0: tx - rw / 2, x1: tx + rw / 2, y0: base.y0 - rh - 4, y1: base.y0, R: 12 };
      const ox = st.x0 - 2, oy = st.y0 - 2;
      const sh = (q: Box): Box => ({ x0: q.x0 - ox, x1: q.x1 - ox, y0: q.y0 - oy, y1: q.y1 - oy, R: q.R });
      s.skin?.draw(stack(sh(st), sh(base), 7, "up"), ox, oy, rw + 4, base.y1 - st.y0 + 4);
      s.skin && (s.skin.el.style.opacity = "1");
      if (read.current) {
        read.current.style.transform = `translate3d(${(tx - rw / 2).toFixed(2)}px, ${(st.y0).toFixed(2)}px, 0)`;
        read.current.style.opacity = clamp((rh - 14) / 12, 0, 1).toFixed(3);
      }
    } else {
      s.skin && (s.skin.el.style.opacity = "0");
      if (read.current) read.current.style.opacity = "0";
    }
    return a || b;
  });
  const setFrom = (clientX: number) => {
    const r = root.current!.getBoundingClientRect();
    const u = clamp((clientX - r.left - 11) / (r.width - 22), 0, 1);
    const v = min + Math.round((u * (max - min)) / step) * step;
    onChange(clamp(v, min, max));
  };
  return (
    <div className="sl" style={width ? { width } : undefined}>
      <div ref={root} className="sl-track" role="slider" tabIndex={0} aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={format(value)}
        onPointerEnter={() => setHot(true)} onPointerLeave={() => setHot(false)}
        onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); setDrag(true); setFrom(e.clientX); }}
        onPointerMove={(e) => { if (drag) setFrom(e.clientX); }}
        onPointerUp={() => setDrag(false)} onPointerCancel={() => setDrag(false)}
        onFocus={(e) => { if ((e.target as Element).matches(":focus-visible")) setHot(true); }} onBlur={() => setHot(false)}
        onKeyDown={(e) => {
          const big = (max - min) / 10;
          if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); onChange(clamp(value + (e.shiftKey ? big : step), min, max)); }
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); onChange(clamp(value - (e.shiftKey ? big : step), min, max)); }
          if (e.key === "Home") onChange(min);
          if (e.key === "End") onChange(max);
        }}>
        <svg className="sl-svg" aria-hidden="true"><path ref={path} className="sl-line" /><path ref={fill} className="sl-fill" /></svg>
        <div ref={skinHost} className="sl-skinhost" />
        <div ref={read} className="sl-read t-num">{format(value)}</div>
        <div ref={thumb} className="sl-thumb" />
      </div>
    </div>
  );
}

/* ---------------- Segmented ---------------- */
export function Segmented<T extends string>({ value, options, onChange, size = "md", label }: { value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void; size?: "sm" | "md"; label?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const plate = useRef<HTMLDivElement>(null);
  const s = useConst(() => ({ x: spring(0, SP.ui), w: spring(0, SP.ui), init: false }));
  const idx = Math.max(0, options.findIndex((o) => o.id === value));
  const measure = () => {
    const el = root.current?.querySelectorAll<HTMLButtonElement>(".seg-o")[idx];
    if (!el) return;
    if (s.init && s.x.t === el.offsetLeft && s.w.t === el.offsetWidth) return; // nothing to move: stay asleep
    s.x.t = el.offsetLeft; s.w.t = el.offsetWidth;
    if (!s.init) { settle(s.x, s.x.t); settle(s.w, s.w.t); s.init = true; }
    clock.wake();
  };
  useLayoutEffect(measure);
  useEffect(() => { document.fonts?.ready.then(measure); const ro = new ResizeObserver(measure); ro.observe(root.current!); return () => ro.disconnect(); });
  useTick((dt) => {
    const a = stepS(s.x, dt), b = stepS(s.w, dt);
    const p = plate.current;
    if (p) {
      const st = clamp(Math.abs(s.x.v) * 0.02, 0, 12) * clock.intensity;
      p.style.transform = `translateX(${(s.x.x - st / 2).toFixed(2)}px) scaleY(${(1 - st * 0.012).toFixed(3)})`;
      p.style.width = `${(s.w.x + st).toFixed(2)}px`;
    }
    return a || b;
  });
  return (
    <div ref={root} className={`seg seg--${size}`} role="tablist" aria-label={label}>
      <div ref={plate} className="seg-plate" />
      {options.map((o, i) => (
        <button key={o.id} type="button" role="tab" aria-selected={i === idx} className={"seg-o" + (i === idx ? " is-on" : "")} onClick={() => onChange(o.id)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") { e.preventDefault(); onChange(options[Math.min(options.length - 1, i + 1)].id); (e.currentTarget.nextElementSibling as HTMLElement | null)?.focus(); }
            if (e.key === "ArrowLeft") { e.preventDefault(); onChange(options[Math.max(0, i - 1)].id); (e.currentTarget.previousElementSibling as HTMLElement | null)?.focus(); }
          }}>{o.label}</button>
      ))}
    </div>
  );
}

/* ---------------- Field ---------------- */
export function Field({ label, value, onChange, placeholder, multiline, hint, onEnter, autoFocus }: {
  label?: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; hint?: ReactNode; onEnter?: () => void; autoFocus?: boolean;
}) {
  const line = useRef<HTMLSpanElement>(null);
  const setOrigin = (x: number | null) => {
    const el = line.current;
    if (!el) return;
    const r = el.parentElement!.getBoundingClientRect();
    el.style.transformOrigin = x === null ? "0 50%" : `${clamp(x - r.left, 0, r.width)}px 50%`;
  };
  return (
    <label className="fld">
      {label && <span className="fld-l">{label}</span>}
      <span className="fld-box" onPointerDown={(e) => setOrigin(e.clientX)}>
        {multiline
          ? <textarea className="fld-in" value={value} placeholder={placeholder} rows={3} onChange={(e) => onChange(e.target.value)} onFocus={(e) => { if (!e.target.matches(":hover")) setOrigin(null); }} autoFocus={autoFocus} />
          : <input className="fld-in" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onEnter?.(); }} onFocus={(e) => { if (!e.target.matches(":hover")) setOrigin(null); }} autoFocus={autoFocus} />}
        <span className="fld-line" /><span ref={line} className="fld-lit" />
      </span>
      {hint && <span className="fld-h">{hint}</span>}
    </label>
  );
}

/* ---------------- Check ---------------- */
export function Check({ checked, onChange, label }: { checked: boolean; onChange: () => void; label?: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} className={"chk" + (checked ? " is-on" : "")} onClick={(e) => { e.stopPropagation(); onChange(); }}>
      <svg viewBox="0 0 22 22" aria-hidden="true">
        <circle className="chk-ring" cx="11" cy="11" r="9.2" />
        <circle className="chk-fill" cx="11" cy="11" r="9.2" />
        <path className="chk-mark" d="M6.6 11.4 L9.6 14.2 L15.4 8.2" pathLength={1} />
      </svg>
    </button>
  );
}

/* ---------------- Chip ---------------- */
export const Chip = ({ on, children, onClick }: { on?: boolean; children: ReactNode; onClick?: () => void }) => (
  <button type="button" className={"chip" + (on ? " is-on" : "")} aria-pressed={!!on} onClick={onClick}>{children}</button>
);

/* ---------------- Select ---------------- */
export function Select<T extends string>({ value, options, onChange, label, width = 200 }: { value: T; options: { id: T; label: string; meta?: string }[]; onChange: (v: T) => void; label?: string; width?: number }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const cur = options.find((o) => o.id === value);
  const [hi, setHi] = useState(0);
  return (
    <div className={"sel" + (open ? " is-open" : "")}>
      {label && <span className="fld-l">{label}</span>}
      <div className="sel-wrap">
        <button ref={btn} type="button" className="sel-btn" aria-haspopup="listbox" aria-expanded={open} style={{ width }}
          onClick={() => { setOpen(!open); setHi(Math.max(0, options.findIndex((o) => o.id === value))); }}
          onKeyDown={(e) => {
            if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); setOpen(true); return; }
            if (!open) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(options.length - 1, h + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
            if (e.key === "Enter") { e.preventDefault(); onChange(options[hi].id); setOpen(false); }
          }}>
          <span>{cur?.label}</span>
          <svg className="sel-chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.6 L6 7.6 L9 4.6" /></svg>
        </button>
        <Grow open={open} anchor={btn} w={width} h={options.length * 38 + 12} align="start" dir="down" R={14} fillet={0} onClose={() => setOpen(false)}>
          <ul className="sel-list" role="listbox">
            {options.map((o, i) => (
              <li key={o.id} role="option" aria-selected={o.id === value} className={"sel-o" + (o.id === value ? " is-on" : "") + (i === hi ? " is-hi" : "")} style={{ ["--i" as any]: i }}
                onPointerEnter={() => setHi(i)} onClick={() => { onChange(o.id); setOpen(false); }}>
                <span>{o.label}</span>{o.meta && <span className="sel-m">{o.meta}</span>}
              </li>
            ))}
          </ul>
        </Grow>
      </div>
    </div>
  );
}

/* ---------------- WeekPicker ---------------- */
export function WeekPicker({ value, onChange, labels }: { value: number; onChange: (i: number) => void; labels: { top: string; bottom: string; mark?: boolean }[] }) {
  return (
    <Segmented<string> value={String(value)} onChange={(v) => onChange(+v)} label="选择日期"
      options={labels.map((l, i) => ({ id: String(i), label: <span className="wk-o"><span className="wk-t">{l.top}</span><span className="wk-b t-num">{l.bottom}</span>{l.mark && <i className="wk-mark" />}</span> }))} />
  );
}

/* ---------------- yielding list: rows glide to their new places (FLIP on springs) ---------------- */
export function useFlip(container: React.RefObject<HTMLElement>, keys: string) {
  const prev = useRef(new Map<string, number>());
  const springs = useRef(new Map<string, Spring>());
  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const rows = [...el.querySelectorAll<HTMLElement>("[data-flip]")];
    const now = new Map<string, number>();
    for (const r of rows) {
      r.style.transform = "";
      const k = r.dataset.flip!;
      const top = r.offsetTop;
      now.set(k, top);
      const was = prev.current.get(k);
      let s = springs.current.get(k);
      if (!s) { s = spring(0, SP.lift); springs.current.set(k, s); }
      if (was !== undefined && was !== top) { s.x += was - top; s.t = 0; }
    }
    prev.current = now;
    clock.wake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);
  useTick((dt) => {
    const el = container.current;
    if (!el) return false;
    let moving = false;
    for (const r of el.querySelectorAll<HTMLElement>("[data-flip]")) {
      const s = springs.current.get(r.dataset.flip!);
      if (!s) continue;
      if (stepS(s, dt)) moving = true;
      r.style.transform = Math.abs(s.x) > 0.05 ? `translateY(${s.x.toFixed(2)}px)` : "";
    }
    return moving;
  });
}
void falloff;
