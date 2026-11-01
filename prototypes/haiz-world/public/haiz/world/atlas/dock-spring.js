/* HAIZ ATLAS — bounded, dependency-free spring mathematics. */
(function (root) {
  "use strict";
  const DEFAULT_STIFFNESS = 430;
  const DEFAULT_DAMPING = 34;
  const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
  function step(state, target, dt, stiffness = DEFAULT_STIFFNESS, damping = DEFAULT_DAMPING) {
    const goal = finite(target);
    let x = finite(state.x, goal);
    let v = finite(state.v);
    // Bounded integration handles tab-resume and dropped frames without NaN/teleport.
    let remaining = Math.min(Math.max(finite(dt), 0), .05);
    const k = Math.max(1, finite(stiffness, DEFAULT_STIFFNESS));
    const c = Math.max(1, finite(damping, DEFAULT_DAMPING));
    while (remaining > 0) {
      const h = Math.min(remaining, 1 / 120);
      const a = -k * (x - goal) - c * v;
      v += a * h;
      x += v * h;
      remaining -= h;
    }
    return { x, v };
  }
  function settled(state, target, positionTolerance = .2, velocityTolerance = .5) {
    return Math.abs(finite(state.x) - finite(target)) <= positionTolerance &&
      Math.abs(finite(state.v)) <= velocityTolerance;
  }
  const api = Object.freeze({ step, settled });
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HAIZ_DOCK_SPRING = api;
})(typeof window !== "undefined" ? window : null);
