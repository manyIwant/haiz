// NIANLUN 004 · motion primitives, Sarkar–Brown fisheye & Living Cambium radial scale.
//
// Spring: a damped harmonic oscillator, integrated semi-implicitly (Motion-style stiffness/damping/mass).
// fisheye / fisheyeInv: Sarkar & Brown graphical fisheye in 1D, ported from Mike Bostock's
// d3 fisheye plugin (d3/d3-plugins, BSD-3-Clause; Copyright (c) 2012-2015 Michael Bostock).
// Living Cambium: non-uniform radial allocation mirroring living tree physiology — dense
// historical heartwood in the core, spacious sapwood & cambium near the bark so recent
// academic years and the current year are effortless to select on desktop and mobile.

export class Spring {
  constructor(x = 0, { stiffness = 170, damping = 26, mass = 1 } = {}) {
    this.x = x; this.v = 0; this.target = x;
    this.k = stiffness; this.c = damping; this.m = mass;
  }
  set(x) { this.x = x; this.v = 0; this.target = x; return this; }
  to(target, params) {
    this.target = target;
    if (params) {
      if (params.stiffness) this.k = params.stiffness;
      if (params.damping) this.c = params.damping;
    }
    return this;
  }
  step(dt) {
    const a = (-this.k * (this.x - this.target) - this.c * this.v) / this.m;
    this.v += a * dt; this.x += this.v * dt;
  }
  get settled() { return Math.abs(this.x - this.target) < 1e-3 && Math.abs(this.v) < 1e-3; }
}

/** Damped springs toward moving targets, for many 2D nodes at once (Float32Array xy pairs). */
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

/** Sarkar–Brown 1D fisheye on [lo, hi] with focus f and distortion d: original -> displayed. */
export function fisheye(x, f, lo, hi, d) {
  if (d <= 1e-4) return x;
  if (x < f) { const span = f - lo; return span <= 0 ? x : f - span * g((f - x) / span, d); }
  const span = hi - f; return span <= 0 ? x : f + span * g((x - f) / span, d);
}

/** Exact inverse of 1D fisheye: displayed -> original. */
export function fisheyeInv(y, f, lo, hi, d) {
  if (d <= 1e-4) return y;
  if (y < f) { const span = f - lo; return span <= 0 ? y : f - span * gInv(Math.min(1, (f - y) / span), d); }
  const span = hi - f; return span <= 0 ? y : f + span * gInv(Math.min(1, (y - f) / span), d);
}

/**
 * Living Cambium radial multiplier for ring age = (nR - 1 - k).
 * age = 0 (current year) gets lush cambium thickness (~15x relative to deep heartwood);
 * recent 4 years (high school / centenary era) taper gracefully through sapwood;
 * earlier century compresses softly into dense heartwood while preserving rainfall variation.
 */
export function cambiumBoost(age) {
  if (age < 0) return 1;
  return 1 + 11.2 * Math.exp(-age / 1.05) + 3.0 * Math.exp(-age / 6.2);
}

/**
 * Compute normalized radial ring edges in [E0, E1] blending uniform rainfall widths
 * (scaleMix = 0) and Living Cambium widths (scaleMix = 1), plus groove collapse for pulled ring.
 */
export function computeDisplayEdges(baseEdges, nR, { scaleMix = 1, pulled = -1, gap = 0, groove = 0.008 } = {}) {
  const E0 = baseEdges[0], E1 = baseEdges[nR];
  const ws = new Float64Array(nR);
  let sum = 0;
  const gAmt = clamp(gap, 0, 1);
  const sMix = clamp(scaleMix, 0, 1);
  for (let k = 0; k < nR; k++) {
    const rawW = baseEdges[k + 1] - baseEdges[k];
    const age = nR - 1 - k;
    let w = rawW * lerp(1, cambiumBoost(age), sMix);
    if (k === pulled) w = lerp(w, groove, gAmt);
    ws[k] = w;
    sum += w;
  }
  const scale = (E1 - E0) / (sum || 1);
  const out = new Float64Array(nR + 1);
  out[0] = E0;
  for (let k = 0; k < nR; k++) out[k + 1] = out[k] + ws[k] * scale;
  out[nR] = E1;
  return out;
}

/**
 * Adaptive radial fisheye distortion: stronger in compressed historical heartwood so
 * narrow rings expand cleanly under a finger, gentler in the already-wide cambium so
 * the current year stays rock-steady instead of jumping away from your thumb.
 */
export function adaptiveFishD(focus, E0, E1, fishAmt, { coarse = false, portrait = false, scaleMix = 1 } = {}) {
  if (fishAmt <= 1e-4) return 0;
  const t = clamp((focus - E0) / Math.max(1e-4, E1 - E0));
  const outerRelax = lerp(1.0, 0.34, smooth(0.68, 0.96, t) * scaleMix);
  const base = coarse || portrait ? 8.8 : 4.2;
  return base * outerRelax * fishAmt;
}

/**
 * Magnetic ring detent with gentle hysteresis: avoids accidental 1-ring jitter when
 * lifting a fingertip on dense historical rings.
 */
export function applyRingDetent(rawK, rawR, edges, prevK, hysteresis = 0.16) {
  if (rawK < 0 || prevK < 0 || rawK === prevK || Math.abs(rawK - prevK) > 1) return rawK;
  const p0 = edges[prevK], p1 = edges[prevK + 1], pw = p1 - p0;
  if (rawR >= p0 - pw * hysteresis && rawR <= p1 + pw * hysteresis) return prevK;
  return rawK;
}

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
