/**
 * 明暗 · the glass light toggle (HAIZ Native 001, after the Whitespace "glass light toggle" study,
 * reimplemented). A capsule of glass with a light strip along its edge, cool blue at night and
 * warm gold by day; the knob is a lens that slides across it, stretching with its speed; inside
 * the lens a moon made of dots comes apart and reassembles as a sun. The new theme then spreads
 * over the page from the knob (006's view-transition circle).
 *
 * Cost: an SVG of ~40 dots and one knob, moved on the app clock for the ~0.6 s of a switch, then
 * nothing. Tap it, or drag the knob.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { clock } from "../kernel/motion";
import { isDark, setState, useStore } from "../app/store";
import "./themetoggle.css";

type P = { x: number; y: number };
function grid(f: (x: number, y: number) => boolean): P[] { const o: P[] = []; for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if (f(x, y)) o.push({ x, y }); return o; }
const MOON = grid((x, y) => Math.hypot(x - 4, y - 4) <= 3.7 && Math.hypot(x - 5.9, y - 2.4) > 3.1);
const SUN = grid((x, y) => { const d = Math.hypot(x - 4, y - 4); if (d <= 2.1) return true; const a = Math.atan2(y - 4, x - 4); const k = Math.abs(((a / (Math.PI / 4)) % 1 + 1) % 1 - 0.5); return d >= 3.3 && d <= 4.3 && k > 0.38; });
// the same number of dots in both drawings, matched by angle so the reassembly turns, not scrambles
function match(a: P[], b: P[]) {
  const n = Math.max(a.length, b.length);
  const pad = (s: P[]) => { const o = [...s]; let i = 0; while (o.length < n) o.push(s[i++ % s.length]); return o; };
  const ang = (p: P) => Math.atan2(p.y - 4, p.x - 4) + Math.hypot(p.x - 4, p.y - 4) * 0.001;
  return [pad(a).sort((p, q) => ang(p) - ang(q)), pad(b).sort((p, q) => ang(p) - ang(q))];
}
const [M, S] = match(MOON, SUN);

export function ThemeToggle({ size = "md", label = "深色外观" }: { size?: "sm" | "md"; label?: string }) {
  const theme = useStore((s) => s.theme);
  const [dark, setDark] = useState(isDark());
  useEffect(() => setDark(isDark()), [theme]);
  useEffect(() => { const mq = matchMedia("(prefers-color-scheme: dark)"); const f = () => setDark(isDark()); mq.addEventListener?.("change", f); return () => mq.removeEventListener?.("change", f); }, []);

  const root = useRef<HTMLButtonElement>(null);
  const knob = useRef<HTMLSpanElement>(null);
  const dots = useRef<SVGGElement>(null);
  const sim = useRef({ x: dark ? 1 : 0, v: 0, t: dark ? 1 : 0, m: dark ? 0 : 1, mv: 0, mt: dark ? 0 : 1, drag: false, off: null as null | (() => void) });

  // no layout reads: the knob's travel is CSS (var(--w) - var(--h)), so a mount or a frame never forces a reflow
  const paint = () => {
    const s = sim.current, k = knob.current, g = dots.current, r = root.current;
    if (!k || !g || !r) return;
    const stretch = 1 + Math.min(0.38, Math.abs(s.v) * 0.05);
    k.style.setProperty("--x", s.x.toFixed(4));
    k.style.setProperty("--sx", stretch.toFixed(3));
    k.style.setProperty("--sy", (1 / Math.sqrt(stretch)).toFixed(3));
    r.style.setProperty("--lit", s.x.toFixed(3));
    const m = s.m, cs = g.children;
    for (let i = 0; i < cs.length; i++) {
      const a = M[i], b = S[i];
      // each dot leaves a little later than the one before: the drawing comes apart, then settles
      const e = Math.min(1, Math.max(0, m * 1.35 - (i / cs.length) * 0.35));
      const lift = Math.sin(e * Math.PI) * 1.6;
      const x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e - lift;
      (cs[i] as SVGCircleElement).setAttribute("cx", (x * 2 + 1).toFixed(2));
      (cs[i] as SVGCircleElement).setAttribute("cy", (y * 2 + 1).toFixed(2));
    }
  };
  const run = () => {
    const s = sim.current;
    if (s.off) return;
    s.off = clock.add((dt) => {
      const h = Math.min(0.032, dt);
      if (!s.drag) { s.v += ((s.t - s.x) * 420 - s.v * 30) * h; s.x += s.v * h; }
      s.mv += ((s.mt - s.m) * 160 - s.mv * 19) * h; s.m += s.mv * h;
      paint();
      const still = !s.drag && Math.abs(s.t - s.x) < 0.001 && Math.abs(s.v) < 0.01 && Math.abs(s.mt - s.m) < 0.002 && Math.abs(s.mv) < 0.01;
      if (still) { s.x = s.t; s.m = s.mt; s.v = s.mv = 0; paint(); s.off?.(); s.off = null; return false; }
      return true;
    });
  };
  useLayoutEffect(() => { const s = sim.current; s.t = dark ? 1 : 0; s.mt = dark ? 0 : 1; if (s.x === s.t && s.m === s.mt && !s.v) return; if (!s.drag) run(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [dark]);
  useEffect(() => () => { sim.current.off?.(); }, []);

  const set = (d: boolean) => {
    if (d === dark) { sim.current.t = d ? 1 : 0; run(); return; }
    setState({ theme: d ? "dark" : "light" });
  };
  const drag = useRef<{ x0: number; s0: number; moved: boolean; travel: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { x0: e.clientX, s0: sim.current.x, moved: false, travel: Math.max(1, root.current!.clientWidth - root.current!.clientHeight) };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const travel = d.travel;
    const dx = e.clientX - d.x0;
    if (Math.abs(dx) > 4) { d.moved = true; sim.current.drag = true; }
    if (!d.moved) return;
    const s = sim.current, nx = Math.min(1.08, Math.max(-0.08, d.s0 + dx / travel));
    s.v = (nx - s.x) * 60; s.x = nx;
    run();
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    const s = sim.current;
    s.drag = false;
    if (!d) return;
    if (!d.moved) set(!dark);
    else set(s.x > 0.5);
    run();
  };

  return (
    <button ref={root} type="button" role="switch" aria-checked={dark} aria-label={label} className={`gtog gtog--${size}${dark ? " is-dark" : ""}`} style={{ ["--lit" as any]: dark ? 1 : 0 }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      onKeyDown={(e) => { if (e.key === "ArrowLeft") set(false); else if (e.key === "ArrowRight") set(true); }}
      onClick={(e) => { if (e.detail === 0) set(!dark); }}>
      <span className="gtog-led" aria-hidden="true" />
      <span ref={knob} className="gtog-knob" aria-hidden="true" style={{ ["--x" as any]: dark ? 1 : 0 }}>
        <svg viewBox="0 0 19 19"><g ref={dots}>{(sim.current.m > 0.5 ? S : M).map((p, i) => <circle key={i} cx={p.x * 2 + 1} cy={p.y * 2 + 1} r=".78" />)}</g></svg>
      </span>
    </button>
  );
}
