import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { clock, type Tick } from "./motion";

/** A value made once per component, never again. */
export function useConst<T>(make: () => T): T {
  const r = useRef<T | null>(null);
  if (r.current === null) r.current = make();
  return r.current;
}

/**
 * Subscribes a frame function to the one clock while mounted. The function is read through a
 * ref, so it may close over fresh props without resubscribing. Return true while moving.
 */
export function useTick(fn: Tick) {
  const ref = useRef(fn);
  ref.current = fn;
  useLayoutEffect(() => clock.add((dt, now) => ref.current(dt, now)), []);
}

/** Viewport class: phone (< 760), tablet (< 1120) or desk. Independent layouts, not a stretched one. */
export type Viewport = "phone" | "tablet" | "desk";
const vpOf = (w: number): Viewport => (w < 760 ? "phone" : w < 1120 ? "tablet" : "desk");
let vp: Viewport = typeof window === "undefined" ? "desk" : vpOf(window.innerWidth);
const vpSubs = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("resize", () => {
    const n = vpOf(window.innerWidth);
    if (n !== vp) { vp = n; vpSubs.forEach((f) => f()); }
  });
}
export function useViewport(): Viewport {
  return useSyncExternalStore((f) => { vpSubs.add(f); return () => vpSubs.delete(f); }, () => vp, () => vp);
}

/** Whether the primary pointer can hover (desk mouse, trackpad) — touch gets its own grammar. */
export function useFinePointer() {
  const [fine, setFine] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches);
  useEffect(() => {
    const mq = window.matchMedia?.("(hover: hover) and (pointer: fine)");
    if (!mq) return;
    const f = () => setFine(mq.matches);
    mq.addEventListener?.("change", f);
    return () => mq.removeEventListener?.("change", f);
  }, []);
  return fine;
}

/** Pointer velocity, smoothed the way Experiment 004 measured it (px per ms, clamped). */
export function velocityTracker() {
  let lx: number | null = null, ly: number | null = null, lt = 0, vx = 0, vy = 0;
  return {
    sample(x: number, y: number, now = performance.now()) {
      if (lx !== null && ly !== null) {
        const dt = Math.max(4, Math.min(80, now - lt));
        vx = vx * 0.38 + ((x - lx) / dt) * 0.62;
        vy = vy * 0.38 + ((y - ly) / dt) * 0.62;
      }
      lx = x; ly = y; lt = now;
      return { vx: Math.max(-3.2, Math.min(3.2, vx)), vy: Math.max(-3.2, Math.min(3.2, vy)) };
    },
    reset() { lx = null; ly = null; vx = 0; vy = 0; },
    get vx() { return vx; },
    get vy() { return vy; },
  };
}

/** Whether an element is on screen (live loops pause when it is not — Hairline rule 07). */
export function useVisible(ref: React.RefObject<Element>) {
  const vis = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { vis.current = true; return; }
    const io = new IntersectionObserver(([e]) => { vis.current = e.isIntersecting; if (vis.current) clock.wake(); });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return vis;
}
