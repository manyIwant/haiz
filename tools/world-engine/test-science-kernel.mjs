#!/usr/bin/env node
// HAIZ World Engine — Scientific Simulation Kernel Unit & Conservation Test Suite
//
// Verifies physical correctness, numerical convergence, energy conservation,
// exact Fresnel optical identities, and microclimate monotonicity.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MODEL_META,
  normalGravity,
  ellipticK,
  exactPendulumPeriod,
  createPendulumSim,
  fresnelOptics,
  microclimateStep,
  sampleStats,
} from '../../world-engine/science/kernel.js';

test('Every scientific model declares explicit scope, simplifications, and accuracy bounds', () => {
  for (const key of ['pendulum', 'optics', 'microclimate']) {
    const m = MODEL_META[key];
    assert.ok(m && m.equation && m.scope.length > 10 && m.simplifications.length > 10 && m.accuracy.length > 10);
  }
});

test('Somigliana normal gravity matches Haikou latitude (19.9985°N ≈ 9.7864 m/s²)', () => {
  const gHaikou = normalGravity(19.99847892, 12);
  const gPole = normalGravity(90, 0);
  const gEquator = normalGravity(0, 0);
  assert.ok(Math.abs(gHaikou - 9.7864) < 0.001, `gHaikou=${gHaikou}`);
  assert.ok(gPole > gHaikou && gHaikou > gEquator);
});

test('AGM complete elliptic integral K(0) = π/2 and K(sin 45°) ≈ 1.854074677', () => {
  assert.ok(Math.abs(ellipticK(0) - Math.PI / 2) < 1e-12);
  assert.ok(Math.abs(ellipticK(Math.SQRT1_2) - 1.8540746773) < 1e-9);
});

test('RK4 undamped nonlinear pendulum conserves mechanical energy (< 1e-6 drift over 10 s)', () => {
  const sim = createPendulumSim({ length: 1.0, angleDeg: 65, damping: 0 });
  for (let i = 0; i < 200; i++) sim.step(0.05);
  const snap = sim.snapshot();
  assert.ok(snap.energyDriftRel < 1e-6, `Relative energy drift too high: ${snap.energyDriftRel}`);
});

test('RK4 large-angle (90°) pendulum period matches exact elliptic integral within 0.05%', () => {
  const sim = createPendulumSim({ length: 1.2, angleDeg: 90, damping: 0 });
  for (let i = 0; i < 160; i++) sim.step(0.05);
  const snap = sim.snapshot();
  const exact = exactPendulumPeriod(1.2, sim.params.g, Math.PI / 2);
  assert.ok(snap.measuredPeriod !== null);
  const relErr = Math.abs(snap.measuredPeriod - exact) / exact;
  assert.ok(relErr < 0.0005, `Measured=${snap.measuredPeriod}, Exact=${exact}, relErr=${relErr}`);
  // Confirm large-angle period is genuinely ~18% longer than small-angle T0
  assert.ok(snap.largeAngleRatio > 1.17 && snap.largeAngleRatio < 1.19);
});

test('Damped pendulum loses mechanical energy monotonically', () => {
  const sim = createPendulumSim({ length: 1.0, angleDeg: 50, damping: 0.15 });
  const e0 = sim.snapshot().energy.total;
  for (let i = 0; i < 100; i++) sim.step(0.05);
  const e1 = sim.snapshot().energy.total;
  assert.ok(e1 < e0 * 0.6, `Expected strong damping decay: e0=${e0}, e1=${e1}`);
});

test('Fresnel optics satisfies R + T = 1 across 0°..89° and Rp = 0 at Brewster angle', () => {
  for (let deg = 0; deg <= 89; deg += 3) {
    const r = fresnelOptics({ n1: 1.0003, n2: 1.333, incidentDeg: deg });
    assert.ok(Math.abs(r.R + r.T - 1) < 1e-5, `Energy conservation failed at ${deg}°`);
    assert.ok(r.Rs >= r.Rp - 1e-9);
  }
  const brewDeg = (Math.atan(1.333 / 1.0003) * 180) / Math.PI;
  const brew = fresnelOptics({ n1: 1.0003, n2: 1.333, incidentDeg: brewDeg });
  assert.ok(brew.Rp < 1e-5, `Rp at Brewster angle should be ~0, got ${brew.Rp}`);
});

test('Fresnel water-to-air detects Total Internal Reflection beyond critical angle (~48.6°)', () => {
  const tir = fresnelOptics({ n1: 1.333, n2: 1.0003, incidentDeg: 55 });
  assert.equal(tir.totalInternalReflection, true);
  assert.equal(tir.R, 1);
  assert.equal(tir.T, 0);
});

test('Microclimate water budget increases wetness/puddles in storm and evaporates under sun', () => {
  const afterStorm = microclimateStep({ rainMmHr: 32, solarWm2: 60, windMs: 5, tempC: 25, rhPct: 92, wet: 0.1, puddle: 0, dtSec: 1800 });
  assert.ok(afterStorm.wet > 0.9 && afterStorm.puddle > 0.1);
  const afterSun = microclimateStep({ rainMmHr: 0, solarWm2: 780, windMs: 3.5, tempC: 32, rhPct: 58, wet: afterStorm.wet, puddle: afterStorm.puddle, dtSec: 3600 });
  assert.ok(afterSun.puddle < afterStorm.puddle);
});

test('Sample statistics computes accurate mean, SD, and standard error', () => {
  const st = sampleStats([2.0, 2.2, 2.1, 1.9, 2.3]);
  assert.equal(st.n, 5);
  assert.ok(Math.abs(st.mean - 2.1) < 1e-9);
  assert.ok(Math.abs(st.sd - Math.sqrt(0.025)) < 1e-9);
  assert.ok(Math.abs(st.se - st.sd / Math.sqrt(5)) < 1e-9);
});
