/**
 * 明暗 · the glass light toggle (HAIZ Native 002, after the Whitespace "glass light toggle" study,
 * reimplemented in HAIZ's own code; none of the study's code or assets are used).
 *
 *   left  = dark  · a moon of pixels (with earthshine and two stars) under a cool blue light
 *   right = light · a sun of pixels (core and eight rays) under a warm amber light
 *
 * Everything is driven by one number p (0 … 1, the knob's place on the track). The finger moves p
 * directly while it drags, so the knob, the light's colour, the LED arc and the pixel icon all
 * answer the finger live; nothing waits for the release. On release p springs home and the theme
 * is committed and spreads over the page from the knob (006's view-transition circle).
 *
 *   knob   a rounded-square lens: stretches along its motion with speed (volume kept), squashes
 *          when it overshoots an end, squeezes a little under the finger
 *   LED    a short arc of light hugging the knob, orbiting from the bottom (dark) to the top
 *          (light) a little behind the knob (critically damped lag); the side it orbits by is
 *          latched at rest so it always leads the knob
 *   icon   each pixel of the moon is paired with a pixel of the sun by angle; each has its own
 *          spring, its own delay (the drawing comes apart from one side and settles on the other),
 *          a curl and a lift on the way, shrinks and brightens mid-flight, and trails the knob
 *
 * The theme state is read from the store, never from the DOM, so the drawing can never show the
 * other theme's icon. Cost: one 2D canvas the size of the knob and a few CSS variables, written
 * only while something moves; nothing runs at rest. No layout is read per frame.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { clock } from "../kernel/motion";
import { isDark, setThemeFrom, useStore } from "../app/store";
import "./themetoggle.css";

const N = 15, C = 7;
type Px = { x: number; y: number; a: number; tone: number };
function grid(f: (x: number, y: number) => number): Px[] {
  const o: Px[] = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const a = f(x, y); if (a > 0) o.push({ x, y, a, tone: 0 }); }
  return o;
}
// moon: a crescent, the dark part faintly lit (earthshine, every other pixel), two stars
const MOON: Px[] = [
  ...grid((x, y) => {
    const d = Math.hypot(x - C, y - C), cut = Math.hypot(x - (C + 2.6), y - (C - 2.2));
    if (d > 5.6) return 0;
    if (cut > 4.7) return 1;
    return (x + y) % 2 === 0 ? 0.16 : 0;
  }),
  { x: 13, y: 2, a: 0.85, tone: 1 }, { x: 11, y: 12, a: 0.55, tone: 1 },
];
// sun: a disc and eight rays of three pixels
const SUN: Px[] = (() => {
  const o = grid((x, y) => (Math.hypot(x - C, y - C) <= 3.2 ? 1 : 0));
  for (let k = 0; k < 8; k++) {
    const t = (k * Math.PI) / 4;
    for (const r of [4.9, 5.9, 6.9]) {
      const x = Math.round(C + r * Math.cos(t)), y = Math.round(C + r * Math.sin(t));
      if (!o.some((p) => p.x === x && p.y === y)) o.push({ x, y, a: r > 6 ? 0.8 : 1, tone: 1 });
    }
  }
  return o;
})();

type Pair = { a: Px; b: Px; d: number; k: number; c: number; curl: number; lead: number; e: number; v: number };
function pairUp(): Pair[] {
  const n = Math.max(MOON.length, SUN.length);
  const pad = (s: Px[]) => { const o = [...s]; let i = 0; while (o.length < n) o.push({ ...s[i++ % s.length], a: 0 }); return o; };
  const ang = (p: Px) => Math.atan2(p.y - C, p.x - C) + Math.hypot(p.x - C, p.y - C) * 0.002;
  const A = pad(MOON).sort((p, q) => ang(p) - ang(q)), B = pad(SUN).sort((p, q) => ang(p) - ang(q));
  // a fixed pseudo-random per pixel, so every toggle on the page moves the same way
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return A.map((a, i) => {
    // the sweep leads from the upper right (where the light comes from) round the dial
    const lead = ((Math.atan2(a.y - C, a.x - C) + Math.PI * 1.25) % (Math.PI * 2)) / (Math.PI * 2);
    const k = 260 + rnd() * 200;
    return { a, b: B[i], lead, d: 0.04 + lead * 0.26, k, c: 2 * Math.sqrt(k) * 0.72, curl: (rnd() - 0.5) * 3.2, e: 0, v: 0 };
  });
}

const MOON_RGB = [205, 216, 255], STAR_RGB = [232, 238, 255], SUN_RGB = [255, 176, 46], RAY_RGB = [255, 200, 92];
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function ThemeToggle({ size = "md", label = "深色外观" }: { size?: "sm" | "md"; label?: string }) {
  useStore((s) => s.theme);
  const [, bump] = useState(0);
  useEffect(() => { const mq = matchMedia("(prefers-color-scheme: dark)"); const f = () => bump((n) => n + 1); mq.addEventListener?.("change", f); return () => mq.removeEventListener?.("change", f); }, []);
  const light = !isDark();

  const root = useRef<HTMLButtonElement>(null);
  const cvs = useRef<HTMLCanvasElement>(null);
  const sim = useRef<null | {
    p: number; v: number; target: number; drag: boolean; press: number; pressV: number; pressT: number;
    led: number; ledV: number; mode: 0 | 1; pairs: Pair[]; off: null | (() => void); dpr: number; px: number;
  }>(null);
  if (!sim.current) {
    const p0 = light ? 1 : 0;
    const pairs = pairUp();
    for (const q of pairs) q.e = p0;
    sim.current = { p: p0, v: 0, target: p0, drag: false, press: 0, pressV: 0, pressT: 0, led: p0, ledV: 0, mode: p0 < 0.5 ? 0 : 1, pairs, off: null, dpr: 1, px: 0 };
  }

  const draw = () => {
    const s = sim.current!, r = root.current, cv = cvs.current;
    if (!r || !cv) return;
    const t = smooth(0.18, 0.82, s.p);
    // the knob: speed stretch (volume kept), overshoot squash, press squeeze
    const speed = Math.abs(s.v);
    const stretch = Math.min(0.24, speed * 0.05);
    const over = Math.max(0, -s.p, s.p - 1);
    const sq = 1 - 0.035 * s.press;
    const sx = (1 + stretch - over * 1.6) * sq, sy = (1 - stretch * 0.45 + over * 1.1) * sq;
    // LED arc: bottom (dark) → top (light), by the side latched at rest
    const ph = Math.min(1.15, Math.max(-0.15, s.led));
    const deg = s.mode === 0 ? 90 - 180 * ph : 90 + 180 * ph;
    const st = r.style;
    st.setProperty("--p", s.p.toFixed(4));
    st.setProperty("--t", t.toFixed(3));
    st.setProperty("--sx", sx.toFixed(3));
    st.setProperty("--sy", sy.toFixed(3));
    st.setProperty("--led", `${deg.toFixed(1)}deg`);
    st.setProperty("--ledlit", (0.55 + 0.45 * Math.min(1, speed * 0.4 + Math.abs(s.led - s.p) * 3)).toFixed(3));

    // the icon
    const px = s.px || cv.clientWidth;
    if (!px) return;
    s.px = px;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(px * dpr)) { cv.width = cv.height = Math.round(px * dpr); s.dpr = dpr; }
    const g = cv.getContext("2d");
    if (!g) return;
    const cell = (px * dpr) / N;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    g.shadowBlur = cell * 1.6;
    const trail = -s.v * 0.32;
    for (const q of s.pairs) {
      const u = Math.min(1, Math.max(0, q.e));
      const mid = Math.sin(Math.PI * u);
      const ax = q.a.x, ay = q.a.y, bx = q.b.x, by = q.b.y;
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
      // curl: off the straight line, perpendicular; lift: up a little; trail: behind the knob
      const x = ax + dx * u + (-dy / len) * q.curl * mid + trail * q.lead;
      const y = ay + dy * u + (dx / len) * q.curl * mid - 1.1 * mid;
      const alpha = Math.min(1, (q.a.a + (q.b.a - q.a.a) * u) * (1 + 0.5 * mid));
      if (alpha < 0.02) continue;
      const m = q.a.tone ? STAR_RGB : MOON_RGB, n = q.b.tone ? RAY_RGB : SUN_RGB;
      const k = Math.min(1, u + mid * 0.25);
      const R = Math.round(m[0] + (n[0] - m[0]) * k + 30 * mid), G = Math.round(m[1] + (n[1] - m[1]) * k + 24 * mid), B = Math.round(m[2] + (n[2] - m[2]) * k);
      const col = `rgba(${Math.min(255, R)},${Math.min(255, G)},${Math.min(255, B)},${alpha.toFixed(3)})`;
      g.fillStyle = col;
      g.shadowColor = col;
      const sz = cell * 0.84 * (1 - 0.38 * mid);
      g.fillRect((x + 0.5) * cell - sz / 2, (y + 0.5) * cell - sz / 2, sz, sz);
    }
  };

  const run = () => {
    const s = sim.current!;
    if (s.off) return;
    s.off = clock.add((dt) => {
      if (clock.intensity < 0.04) {
        if (!s.drag) { s.p = s.target; s.v = 0; }
        s.led = s.p; s.ledV = 0; s.press = s.pressT;
        for (const q of s.pairs) { q.e = s.p; q.v = 0; }
      } else {
        const h = Math.min(0.032, dt) / 4;
        for (let i = 0; i < 4; i++) {
          if (!s.drag) { const k = 129, c = 2 * Math.sqrt(k) * 0.6; s.v += (-k * (s.p - s.target) - c * s.v) * h; s.p += s.v * h; }
          s.ledV += (-70 * (s.led - s.p) - 2 * Math.sqrt(70) * s.ledV) * h; s.led += s.ledV * h;
          s.pressV += (-420 * (s.press - s.pressT) - 30 * s.pressV) * h; s.press += s.pressV * h;
          for (const q of s.pairs) {
            const goal = Math.min(1, Math.max(0, (s.p - q.d) / 0.66));
            q.v += (-q.k * (q.e - goal) - q.c * q.v) * h; q.e += q.v * h;
          }
        }
      }
      draw();
      let still = !s.drag && Math.abs(s.p - s.target) < 0.0008 && Math.abs(s.v) < 0.01 && Math.abs(s.led - s.p) < 0.002 && Math.abs(s.ledV) < 0.01 && Math.abs(s.press - s.pressT) < 0.002;
      if (still) for (const q of s.pairs) if (Math.abs(q.e - s.target) > 0.002 || Math.abs(q.v) > 0.01) { still = false; break; }
      if (still) {
        s.p = s.led = s.target; s.v = s.ledV = 0; s.press = s.pressT;
        for (const q of s.pairs) { q.e = s.target; q.v = 0; }
        s.mode = s.target < 0.5 ? 0 : 1;
        draw();
        s.off?.(); s.off = null;
        return false;
      }
      return true;
    });
  };

  // the theme changed (here, in another toggle, or with the system): head there
  useLayoutEffect(() => {
    const s = sim.current!;
    const t = light ? 1 : 0;
    if (s.drag) return;
    s.target = t;
    if (s.p === t && s.led === t && !s.v) { draw(); return; }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [light]);
  useEffect(() => () => { sim.current?.off?.(); }, []);

  const commit = (toLight: boolean) => {
    const s = sim.current!;
    s.target = toLight ? 1 : 0;
    run();
    if (toLight === light) return;
    const r = root.current!.getBoundingClientRect();
    const kw = r.height;
    const cx = r.left + kw / 2 + (r.width - kw) * s.target, cy = r.top + r.height / 2;
    setThemeFrom(toLight ? "light" : "dark", cx, cy);
  };

  const g = useRef<{ x0: number; p0: number; moved: boolean; travel: number; lx: number; lt: number; id: number } | null>(null);
  const onDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button > 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const s = sim.current!;
    const el = e.currentTarget;
    // one read at the start of the gesture, none per move
    const travel = Math.max(1, el.offsetWidth - el.offsetHeight);
    g.current = { x0: e.clientX, p0: s.p, moved: false, travel, lx: e.clientX, lt: performance.now(), id: e.pointerId };
    s.pressT = 1;
    run();
  };
  const onMove = (e: React.PointerEvent) => {
    const d = g.current;
    if (!d || e.pointerId !== d.id) return;
    const s = sim.current!;
    const dx = e.clientX - d.x0;
    if (!d.moved && Math.abs(dx) > 3) { d.moved = true; s.drag = true; }
    if (!d.moved) return;
    let raw = d.p0 + dx / d.travel;
    if (raw < 0) raw *= 0.22; else if (raw > 1) raw = 1 + (raw - 1) * 0.22;
    const now = performance.now(), dtt = Math.max(0.004, (now - d.lt) / 1000);
    const iv = (raw - s.p) / dtt;
    s.v = s.v * 0.55 + iv * 0.45;
    s.p = raw;
    d.lx = e.clientX; d.lt = now;
    run();
  };
  const onUp = (e: React.PointerEvent, cancel = false) => {
    const d = g.current;
    if (!d || e.pointerId !== d.id) return;
    g.current = null;
    const s = sim.current!;
    s.drag = false;
    s.pressT = 0;
    if (cancel) { s.target = light ? 1 : 0; run(); return; }
    if (!d.moved) commit(!light);
    else commit(s.p + s.v * 0.15 > 0.5);
  };

  return (
    <button ref={root} type="button" role="switch" aria-checked={!light} aria-label={label}
      className={`gtog gtog--${size}`}
      style={{ ["--p" as any]: light ? 1 : 0, ["--t" as any]: light ? 1 : 0, ["--led" as any]: light ? "-90deg" : "90deg" }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={(e) => onUp(e)} onPointerCancel={(e) => onUp(e, true)}
      onKeyDown={(e) => { if (e.key === "ArrowLeft") { e.preventDefault(); commit(false); } else if (e.key === "ArrowRight") { e.preventDefault(); commit(true); } }}
      onClick={(e) => { if (e.detail === 0) commit(!light); }}>
      <span className="gtog-spill" aria-hidden="true" />
      <span className="gtog-led" aria-hidden="true"><svg viewBox="-20 -20 40 40"><circle r="17.5" pathLength="100" /></svg></span>
      <span className="gtog-knob" aria-hidden="true"><canvas ref={cvs} /></span>
    </button>
  );
}
