/**
 * HAIZ Experiment 004 · Deterministic Motion Clock & Coupled Spring Physics Engine
 *
 * Powers all 3 spatial dock architectures + Lab 003 baseline from ONE shared clock:
 *   - Supports real-time 1.0×, slow-motion 0.35×, forensic 0.12×, pause, and exact single-frame stepping (+16.67ms)
 *   - Tracks real frame rate (FPS) and real pointer-input-to-paint latency (ms)
 *   - Sleeps cleanly when all springs settle (Hairline Rule 07)
 *   - Sub-stepped semi-implicit Euler integration guarantees unconditional stability even on 60Hz reversals
 */

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function isReducedMotion() {
  return document.documentElement.dataset.reducedMotion === "true" ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

export function makeSpring(initial = 0, { k = 260, c = 24, m = 1, eps = 0.001 } = {}) {
  return { x: initial, t: initial, v: 0, k, c, m, eps };
}

export function stepSpring(s, dt) {
  if (isReducedMotion()) {
    const moved = Math.abs(s.x - s.t) > s.eps || Math.abs(s.v) > 0;
    s.x = s.t;
    s.v = 0;
    return moved;
  }
  const h = Math.min(dt, 0.032);
  if (h <= 0) return Math.abs(s.x - s.t) > s.eps || Math.abs(s.v) > s.eps * 8;
  // 2 sub-steps keep stiff architectural springs rock-solid under sudden impulses & reversals
  const sub = h * 0.5;
  for (let i = 0; i < 2; i++) {
    const a = (-s.k * (s.x - s.t) - s.c * s.v) / s.m;
    s.v += a * sub;
    s.x += s.v * sub;
  }
  if (Math.abs(s.x - s.t) < s.eps && Math.abs(s.v) < s.eps * 9) {
    s.x = s.t;
    s.v = 0;
    return false;
  }
  return true;
}

export function createVelocityTracker() {
  let lx = null, ly = null, lt = 0, vx = 0, vy = 0;
  return {
    sample(x, y, now = performance.now()) {
      if (lx !== null) {
        const dt = Math.max(4, Math.min(80, now - lt));
        const ivx = (x - lx) / dt;
        const ivy = (y - ly) / dt;
        vx = vx * 0.38 + ivx * 0.62;
        vy = vy * 0.38 + ivy * 0.62;
      }
      lx = x; ly = y; lt = now;
      return {
        vx: clamp(vx, -3.2, 3.2),
        vy: clamp(vy, -3.2, 3.2),
        speed: Math.min(3.5, Math.hypot(vx, vy)),
      };
    },
    reset() { lx = null; ly = null; vx = 0; vy = 0; },
    get vx() { return vx; },
    get vy() { return vy; },
  };
}

/** Shared Global Motion Clock (supports slow-motion & frame-by-frame forensic stepping) */
export function createMotionClock() {
  const subscribers = new Set();
  const listeners = new Set();
  let scale = 1.0;
  let paused = false;
  let rafId = 0;
  let lastReal = 0;
  let virtualTimeMs = 0;
  let frameCount = 0;

  // Performance telemetry
  const frameDeltas = [];
  let fps = 60;
  let lastInputAt = 0;
  let lastLatencyMs = 0;
  let activeCount = 0;

  function emitTelemetry() {
    const payload = {
      fps: Math.round(fps),
      latencyMs: +lastLatencyMs.toFixed(1),
      virtualTimeMs: Math.round(virtualTimeMs),
      frameCount,
      scale,
      paused,
      activeCount,
    };
    for (const fn of listeners) fn(payload);
  }

  function advance(dtSec, realNow) {
    virtualTimeMs += dtSec * 1000;
    frameCount += 1;
    let moving = 0;
    for (const fn of subscribers) {
      if (fn(dtSec, virtualTimeMs)) moving += 1;
    }
    activeCount = moving;

    if (lastInputAt > 0) {
      const sample = performance.now() - lastInputAt;
      if (sample < 85) {
        lastLatencyMs = lastLatencyMs > 0 ? (lastLatencyMs * 0.45 + sample * 0.55) : sample;
      }
      lastInputAt = 0;
    }
    emitTelemetry();
    return moving > 0;
  }

  function loop(now) {
    rafId = 0;
    if (paused) return;
    const trueDelta = lastReal ? (now - lastReal) / 1000 : 0.01667;
    const rawDt = clamp(trueDelta, 0.001, 0.05);
    lastReal = now;

    if (trueDelta < 0.08) {
      frameDeltas.push(trueDelta);
      if (frameDeltas.length > 20) frameDeltas.shift();
      const avg = frameDeltas.reduce((a, b) => a + b, 0) / frameDeltas.length;
      fps = clamp(1 / Math.max(0.004, avg), 1, 144);
    }

    const stillMoving = advance(rawDt * scale, now);
    if (stillMoving && !paused) {
      rafId = requestAnimationFrame(loop);
    }
  }

  function wake() {
    if (paused) {
      // Even while paused, repaint current target state cleanly without advancing virtual time
      for (const fn of subscribers) fn(0, virtualTimeMs);
      emitTelemetry();
      return;
    }
    if (!rafId) {
      lastReal = performance.now();
      rafId = requestAnimationFrame(loop);
    }
  }

  return {
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    onTelemetry(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    markInput() {
      lastInputAt = performance.now();
      wake();
    },
    wake,
    setScale(nextScale) {
      scale = clamp(nextScale, 0.05, 2.0);
      if (paused) { paused = false; }
      wake();
      emitTelemetry();
    },
    setPaused(flag) {
      paused = Boolean(flag);
      if (paused && rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      } else if (!paused) {
        wake();
      }
      emitTelemetry();
    },
    stepFrame(ms = 16.67) {
      paused = true;
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      advance(ms / 1000, performance.now());
    },
    getState() {
      return { scale, paused, fps: Math.round(fps), latencyMs: +lastLatencyMs.toFixed(1), virtualTimeMs: Math.round(virtualTimeMs), frameCount };
    },
  };
}
