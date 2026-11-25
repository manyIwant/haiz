// 抽出一年 · motion primitives.
//
// Spring: a damped harmonic oscillator, integrated semi-implicitly. Parameterised the way
// Motion (motion.dev, MIT) and react-spring describe springs — stiffness / damping / mass —
// so the feel of their layout animations carries over: a gesture hands its velocity to the
// spring, and an interrupted animation simply gets a new target, never a restart.
//
// fisheye: Sarkar & Brown's graphical fisheye in one dimension, as in Mike Bostock's
// d3 fisheye plugin (d3/d3-plugins, BSD-3-Clause; https://bost.ocks.org/mike/fisheye/).
// g(x) = (d + 1) x / (d x + 1) magnifies near the focus by (d + 1) and keeps both the
// focus and the two ends fixed. We use it on the radius of the cross-section and along
// the unrolled year.

export class Spring {
  constructor(x = 0, { stiffness = 170, damping = 26, mass = 1 } = {}) {
    this.x = x; this.v = 0; this.target = x;
    this.k = stiffness; this.c = damping; this.m = mass;
  }
  set(x) { this.x = x; this.v = 0; this.target = x; return this; }
  to(target, params) {
    this.target = target;
    if (params) { if (params.stiffness) this.k = params.stiffness; if (params.damping) this.c = params.damping; }
    return this;
  }
  step(dt) {
    const a = (-this.k * (this.x - this.target) - this.c * this.v) / this.m;
    this.v += a * dt; this.x += this.v * dt;
  }
  get settled() { return Math.abs(this.x - this.target) < 1e-3 && Math.abs(this.v) < 1e-3; }
}

/** a damped spring toward a moving target, for many particles at once (Float32Array xy pairs) */
export function stepParticles(X, V, T, K, damping, dt, n) {
  for (let i = 0; i < n; i++) {
    const k = K[i], c = damping * 2 * Math.sqrt(k);
    for (let a = 0; a < 2; a++) {
      const j = i * 2 + a;
      const acc = -k * (X[j] - T[j]) - c * V[j];
      V[j] += acc * dt; X[j] += V[j] * dt;
    }
  }
}

const g = (x, d) => ((d + 1) * x) / (d * x + 1);
const gInv = (y, d) => y / (d + 1 - d * y);

/** fisheye on [lo, hi] with focus f and distortion d: original → displayed */
export function fisheye(x, f, lo, hi, d) {
  if (d <= 1e-4) return x;
  if (x < f) { const span = f - lo; return span <= 0 ? x : f - span * g((f - x) / span, d); }
  const span = hi - f; return span <= 0 ? x : f + span * g((x - f) / span, d);
}
/** inverse: displayed → original */
export function fisheyeInv(y, f, lo, hi, d) {
  if (d <= 1e-4) return y;
  if (y < f) { const span = f - lo; return span <= 0 ? y : f - span * gInv(Math.min(1, (f - y) / span), d); }
  const span = hi - f; return span <= 0 ? y : f + span * gInv(Math.min(1, (y - f) / span), d);
}

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
