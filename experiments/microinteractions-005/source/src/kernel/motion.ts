/**
 * HAIZ 005 · 运动内核 (Motion Kernel)
 *
 * One clock for the whole product. Every moving number in the app — the dock's bays, the
 * rail's plate, a sheet, a page, an icon's leaf — is a spring or a tween stepped here, so the
 * acceptance bench can slow the *entire product* to 0.12×, pause it, or step it a frame at a time.
 *
 * The two clocks are Hairline's (MIT © Lucas Marques, packages/hairline/src/core/motion.ts):
 *   - continuous input (where the pointer / finger is)  → spring, substepped at 240 Hz
 *   - discrete change  (which item, a reveal stagger)    → tween on (.32, .72, 0, 1), 700 ms
 * Time-scale, pause, single-frame stepping and telemetry follow Experiment 004's clock.
 * The loop sleeps when nothing moves (Hairline rule 07) and lands everything at once when the
 * reader asks for less motion.
 */

export type Spring = { x: number; v: number; t: number; k: number; c: number; m: number; eps: number };
export type SpringOpts = { k?: number; c?: number; m?: number; eps?: number };

/** Named spring characters. ζ = c / (2√k): all near-critical except `pulse`, which rings on purpose. */
export const SP = {
  /** press feedback: stiff, almost no overshoot */
  snap: { k: 560, c: 44 },
  /** plates, pills, selection: quick and exact */
  ui: { k: 330, c: 31 },
  /** container geometry: bays, rails, contours */
  lift: { k: 230, c: 25 },
  /** large surfaces: sheets, pages, panels */
  soft: { k: 150, c: 22.5 },
  /** Hairline's default, for things that follow the pointer */
  follow: { k: 100, c: 18 },
  /** an impulse that visibly finishes its arc (icons) */
  pulse: { k: 135, c: 9.8 },
} as const;

let reduced = false;
export const reducedMotion = () => reduced;

export function spring(x: number, o: SpringOpts = SP.ui): Spring {
  return { x, v: 0, t: x, k: o.k ?? 330, c: o.c ?? 31, m: o.m ?? 1, eps: o.eps ?? 0.01 };
}

/** Advances toward `sp.t` by dt seconds. Returns whether it is still moving. */
export function stepS(sp: Spring, dt: number): boolean {
  if (reduced) {
    const moved = sp.x !== sp.t || sp.v !== 0;
    sp.x = sp.t; sp.v = 0;
    return moved && false;
  }
  if (dt <= 0) return Math.abs(sp.x - sp.t) > sp.eps || Math.abs(sp.v) > sp.eps * 10;
  const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
  for (let i = 0; i < n; i++) {
    const a = (-sp.k * (sp.x - sp.t) - sp.c * sp.v) / sp.m;
    sp.v += a * h; sp.x += sp.v * h;
  }
  if (Math.abs(sp.x - sp.t) < sp.eps && Math.abs(sp.v) < sp.eps * 10) { sp.x = sp.t; sp.v = 0; return false; }
  return true;
}

/** Jump a spring to a value with no motion (initial layout, reduced motion). */
export const settle = (sp: Spring, x: number) => { sp.x = sp.t = x; sp.v = 0; };

/* ---------------- the discrete clock ---------------- */

export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (u: number) => ((ax * u + bx) * u + cx) * u;
  const Y = (u: number) => ((ay * u + by) * u + cy) * u;
  const dX = (u: number) => (3 * ax * u + 2 * bx) * u + cx;
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let u = t;
    for (let i = 0; i < 8; i++) {
      const e = X(u) - t;
      if (Math.abs(e) < 1e-5) break;
      const d = dX(u);
      if (Math.abs(d) < 1e-6) break;
      u -= e / d;
    }
    if (!(u >= 0 && u <= 1) || Math.abs(X(u) - t) > 1e-4) {
      let lo = 0, hi = 1; u = t;
      for (let i = 0; i < 24; i++) { if (X(u) < t) lo = u; else hi = u; u = (lo + hi) / 2; }
    }
    return Y(u);
  };
}
export const EASE_LIFT = bezier(0.32, 0.72, 0, 1);

export type Tween = { from: number; to: number; t0: number; dur: number };
export const tween = (v: number, dur = 700): Tween => ({ from: v, to: v, t0: -1e9, dur });
export const tval = (tw: Tween, now: number) => {
  const p = Math.min(1, Math.max(0, (now - tw.t0) / tw.dur));
  return tw.from + (tw.to - tw.from) * (reduced ? 1 : EASE_LIFT(p));
};
export const tset = (tw: Tween, to: number, now: number, delay = 0) => {
  if (tw.to === to) return;
  tw.from = tval(tw, now); tw.to = to; tw.t0 = now + delay;
};
export const tdone = (tw: Tween, now: number) => reduced || now >= tw.t0 + tw.dur;

/* ---------------- helpers ---------------- */

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Hairline's falloff, as a fraction of a reach: 1 → .31 at 42% → .09 at the edge and beyond. */
export const falloff = (u: number) =>
  u <= 0 ? 1 : u <= 0.417 ? 1 - (u / 0.417) * 0.6875 : u <= 1 ? 0.3125 - ((u - 0.417) / 0.583) * 0.2185 : 0.094;
export const r1 = (n: number) => Math.round(n * 10) / 10;
export const r2 = (n: number) => Math.round(n * 100) / 100;

/* ---------------- the clock ---------------- */

export type Tick = (dt: number, now: number) => boolean | void;
export type Telemetry = { fps: number; latency: number; frame: number; now: number; scale: number; paused: boolean; active: number; frameMs: number; worstMs: number };

class Clock {
  private subs = new Set<Tick>();
  private tele = new Set<(t: Telemetry) => void>();
  private raf = 0;
  private last = 0;
  private deltas: number[] = [];
  private inputAt = 0;
  scale = 1;
  paused = false;
  now = 0;           // virtual ms
  frame = 0;
  fps = 60;
  latency = 0;
  active = 0;
  frameMs = 0;       // cost of the last frame's work
  worstMs = 0;       // worst frame interval in the last second
  /** 0 … 1: how strongly decorative motion answers (the app's 「动态强度」). 0 = still. */
  intensity = 1;

  add(fn: Tick): () => void {
    this.subs.add(fn);
    this.wake();
    return () => { this.subs.delete(fn); };
  }
  onTelemetry(fn: (t: Telemetry) => void) {
    this.tele.add(fn);
    return () => { this.tele.delete(fn); };
  }
  markInput() { this.inputAt = performance.now(); this.wake(); }

  wake() {
    if (this.paused) { this.advance(0); return; }
    if (!this.raf && typeof requestAnimationFrame !== "undefined") {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  private loop = (t: number) => {
    this.raf = 0;
    if (this.paused) return;
    const real = (t - this.last) / 1000;
    this.last = t;
    if (real > 0 && real < 0.25) {
      this.deltas.push(real);
      if (this.deltas.length > 30) this.deltas.shift();
      const avg = this.deltas.reduce((a, b) => a + b, 0) / this.deltas.length;
      this.fps = clamp(1 / Math.max(0.004, avg), 1, 240);
      this.worstMs = Math.max(...this.deltas.slice(-60)) * 1000;
    }
    const dt = clamp(real, 0.001, 0.05) * this.scale;
    const moving = this.advance(dt);
    if (moving) this.raf = requestAnimationFrame(this.loop);
    else this.deltas.length = 0;
  };

  private advance(dt: number): boolean {
    const t0 = performance.now();
    this.now += dt * 1000;
    if (dt > 0) this.frame++;
    let n = 0;
    for (const fn of this.subs) if (fn(dt, this.now)) n++;
    this.active = n;
    this.frameMs = performance.now() - t0;
    if (this.inputAt) {
      const s = performance.now() - this.inputAt;
      if (s < 120) this.latency = this.latency ? this.latency * 0.5 + s * 0.5 : s;
      this.inputAt = 0;
    }
    if (this.tele.size) {
      const p: Telemetry = { fps: Math.round(this.fps), latency: r1(this.latency), frame: this.frame, now: Math.round(this.now), scale: this.scale, paused: this.paused, active: n, frameMs: r2(this.frameMs), worstMs: r1(this.worstMs) };
      for (const f of this.tele) f(p);
    }
    return n > 0;
  }

  setScale(s: number) { this.scale = clamp(s, 0.05, 2); this.paused = false; this.wake(); }
  setPaused(p: boolean) {
    this.paused = p;
    if (p && this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
    if (!p) this.wake();
    else this.advance(0);
  }
  step(ms = 16.667) {
    this.paused = true;
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
    this.advance(ms / 1000);
  }
  setIntensity(v: number) {
    this.intensity = clamp(v, 0, 1);
    reduced = this.intensity < 0.04;
    this.wake();
  }
}

export const clock = new Clock();

if (typeof window !== "undefined") {
  const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  if (mq?.matches) clock.setIntensity(0);
  (window as any).__haizClock = clock;
}
