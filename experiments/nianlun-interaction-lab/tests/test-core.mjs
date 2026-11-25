import assert from 'node:assert/strict';
import d3Fisheye from 'd3-fisheye';
import flubber from 'flubber';
const { radial: fisheyeRadial } = d3Fisheye;
const { interpolate: flubberInterpolate } = flubber;
import { KandoGestureDetector } from '../src/kando-gesture.js';
import {
  SPECIMENS,
  world,
  computeSolarGeometry,
  describeCoupling,
  runSpecimenAction,
} from '../src/specimens.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

test('KandoGestureDetector detects sharp corner turn during continuous stroke', () => {
  const hits = [];
  const det = new KandoGestureDetector({
    minStrokeLength: 60,
    minStrokeAngle: 25,
    jitterThreshold: 5,
    onSelection: (pivot, reason) => hits.push({ pivot, reason }),
  });
  det.onMotionEvent({ x: 0, y: 0 });
  det.onMotionEvent({ x: 40, y: 0 });
  det.onMotionEvent({ x: 80, y: 0 });
  // Sharp 90-degree turn downward
  det.onMotionEvent({ x: 80, y: 30 });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].reason, 'corner');
  assert.equal(hits[0].pivot.x, 80);
  det.reset();
});

test('d3-fisheye radial distortion magnifies near focus and supports exact inverse', () => {
  const fe = fisheyeRadial().radius(200).distortion(3.5).smoothing(0.3).focus([100, 100]);
  const pt = [140, 100];
  const warped = fe(pt);
  assert.ok(warped[0] > pt[0], 'Point should be pushed outward from focus to create room');
  assert.ok(warped[2] > 1.2, 'Magnification z should exceed 1 near focus');
  const inv = fe([warped[0], warped[1]], true);
  assert.ok(Math.abs(inv[0] - pt[0]) < 1e-3, 'Inverse should recover original x');
});

test('flubber smoothly interpolates organic seed to squircle aperture', () => {
  const p1 = 'M 0,-40 L 40,0 L 0,40 L -40,0 Z';
  const p2 = 'M -120,-120 L 120,-120 L 120,120 L -120,120 Z';
  const interp = flubberInterpolate(p1, p2);
  const mid = interp(0.5);
  assert.ok(typeof mid === 'string' && mid.startsWith('M'), 'Flubber returns valid SVG path');
});

test('Shared world specimens & solar geometry calculations', () => {
  assert.equal(SPECIMENS.length, 5);
  const noon = computeSolarGeometry(12.2, 172, 20.044);
  const night = computeSolarGeometry(2.0, 172, 20.044);
  assert.ok(noon.altitude > 75, 'Haikou summer solstice noon should be near zenith');
  assert.ok(night.altitude < -20, 'Haikou 02:00 should be well below horizon');
});

test('Multi-object coupling descriptors & specimen actions', () => {
  const c = describeCoupling('atlas', 'helios');
  assert.equal(c.label, '校园日影');
  runSpecimenAction('helios', 'setHour', 6.75);
  assert.equal(world.helios.hour, 6.75);
  runSpecimenAction('cambium', 'setYear', 2014);
  assert.equal(world.cambium.year, 2014);
});

console.log(`\nAll ${passed} core interaction & library integration tests passed.`);
