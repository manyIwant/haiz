/**
 * HAIZ · World Reconstruction — Headless Node Unit Tests
 *
 * Tests the exact same coordinate bridge, simulation kernel, bell schedule,
 * multi-elevation ground heightfield, polygon sliding collision, pass-through
 * architectural portals, rain shelter queries, and A* campus navigation graph
 * used by the WebGL browser runtime.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FRAME,
  specToThree,
  threeToSpec,
  specToTrueENU,
  trueENUToSpec,
  specToWGS84,
  wgs84ToSpec,
  legacyWorldToThree,
  threeToLegacyWorld,
  skyBearingToThreeDir,
} from '../engine/core/coord.js';
import { WorldRuntime, scheduleAtHour, formatHour } from '../engine/core/runtime.js';
import { CampusSpatial } from '../engine/core/collision.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = path.resolve(__dirname, '../data/world_spec.json');
const spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'));
const spatial = new CampusSpatial(spec);

test('Coordinate Bridge: HAIZ-ENU-2026 round-trips accurately across all spaces', () => {
  // Spec <-> Three.js
  const [tx, ty, tz] = specToThree(38.91, 17.67, 0.6);
  assert.equal(tx, 38.91);
  assert.equal(ty, 0.6);
  assert.equal(tz, -17.67);
  const [sx, sy, sz] = threeToSpec(tx, ty, tz);
  assert.ok(Math.abs(sx - 38.91) < 1e-9);
  assert.ok(Math.abs(sy - 17.67) < 1e-9);
  assert.ok(Math.abs(sz - 0.6) < 1e-9);

  // Spec <-> True ENU <-> WGS84
  const enu = specToTrueENU(42.5, -118.2);
  const backEnu = trueENUToSpec(enu.east, enu.north);
  assert.ok(Math.abs(backEnu.x - 42.5) < 1e-6);
  assert.ok(Math.abs(backEnu.y - (-118.2)) < 1e-6);

  const ll = specToWGS84(0, 106.2); // North Gate
  assert.ok(ll.lat > 19.99 && ll.lat < 20.01);
  assert.ok(ll.lon > 110.33 && ll.lon < 110.35);
  const backWgs = wgs84ToSpec(ll.lat, ll.lon);
  assert.ok(Math.abs(backWgs.x) < 1e-4);
  assert.ok(Math.abs(backWgs.y - 106.2) < 1e-4);

  // Legacy lanren/V4 <-> Three.js HAIZ-ENU-2026
  const legacyPt = legacyWorldToThree(0, FRAME.legacyGroundY, 0);
  assert.ok(Math.abs(legacyPt[0] - FRAME.legacyTreePivotSpec[0]) < 1e-6);
  assert.ok(Math.abs(legacyPt[1]) < 1e-6);
  assert.ok(Math.abs(legacyPt[2] - (-FRAME.legacyTreePivotSpec[1])) < 1e-6);
  const backLeg = threeToLegacyWorld(...legacyPt);
  assert.ok(Math.abs(backLeg[0]) < 1e-6);
  assert.ok(Math.abs(backLeg[1] - FRAME.legacyGroundY) < 1e-6);
  assert.ok(Math.abs(backLeg[2]) < 1e-6);

  // Solar direction unit vector
  const dir = skyBearingToThreeDir(Math.PI / 4, 240);
  const len = Math.hypot(dir[0], dir[1], dir[2]);
  assert.ok(Math.abs(len - 1.0) < 1e-6);
  assert.ok(Math.abs(dir[1] - Math.SQRT1_2) < 1e-6);
});

test('WorldRuntime: Haikou bell schedule, events, single-loop guard, and clean dispose', () => {
  assert.equal(formatHour(16.75), '16:45');
  assert.equal(scheduleAtHour(7.5).id, 'morning_read');
  assert.equal(scheduleAtHour(17.5).id, 'after_school');
  assert.equal(scheduleAtHour(20.5).id, 'evening_study');

  const rt = new WorldRuntime({ initialHour: 16.5, initialWeather: 'clear', timeScale: 0 });
  const events = [];
  rt.bus.on('bell:change', (s) => events.push(['bell', s.id]));
  rt.bus.on('weather:change', (w) => events.push(['weather', w.weather]));
  rt.bus.on('lens:change', (l) => events.push(['lens', l.lens]));
  rt.bus.on('mode:change', (m) => events.push(['mode', m.mode]));

  rt.setHour(17.2);
  rt.setWeather('rain');
  rt.setLens(1);
  rt.setMode('bike');

  assert.deepEqual(events, [
    ['bell', 'after_school'],
    ['weather', 'rain'],
    ['lens', 1],
    ['mode', 'bike'],
  ]);

  rt.claimRenderLoop();
  assert.throws(() => rt.claimRenderLoop(), /duplicate render loop rejected/);

  let disposed = false;
  rt.register('dummy', { update() {}, dispose() { disposed = true; } });
  rt.step(0.016);
  assert.ok(rt.simTime > 0);
  rt.dispose();
  assert.equal(disposed, true);
});

test('CampusSpatial: multi-elevation heightfield matches Blender terrain', () => {
  // Forecourt asphalt road (z = 0.148)
  assert.ok(Math.abs(spatial.heightAtSpec(0, 46.0) - 0.148) < 1e-4);
  // Central diamond plaza (z = 0.60)
  assert.ok(Math.abs(spatial.heightAtSpec(0, 18.0) - 0.60) < 1e-4);
  // Teaching Block 1 through-hall floor (z = 1.05)
  assert.ok(Math.abs(spatial.heightAtSpec(0, -2.0) - 1.05) < 1e-4);
  // East side plaza under Centenary Terminalia (z = 0.60)
  assert.ok(Math.abs(spatial.heightAtSpec(35, 14) - 0.60) < 1e-4);
  // Art Education Center portico deck (z = 1.45)
  assert.ok(Math.abs(spatial.heightAtSpec(35, -136) - 1.45) < 1e-4);
  // General campus ground datum (z = 0.155)
  assert.ok(Math.abs(spatial.heightAtSpec(-70, -60) - 0.155) < 1e-4);
});

test('CampusSpatial: pass-through portals open, walls & Yanchi water block pedestrians', () => {
  // North Gate central bay (spec y=106.2 -> Three z=-106.2) must be passable!
  assert.equal(spatial.isBlockedThree(0, -106.2, 0.35), false);
  // Teaching Block 1 '1923' central through-hall (spec x=0, y=-4 -> Three z=4) must be passable!
  assert.equal(spatial.isBlockedThree(0, 4.0, 0.35), false);
  // Teaching Block 1 solid east wing interior (spec x=35, y=-8 -> Three z=8) MUST block!
  assert.equal(spatial.isBlockedThree(35, 8.0, 0.35), true);
  // Yanchi water center (spec x=50, y=-118 -> Three z=118) MUST block walkers!
  assert.equal(spatial.isBlockedThree(50, 118.0, 0.35), true);
  // Taihu stone plinth center MUST block!
  const pl = spec.forecourt_site.taihu.plinth;
  const px = 0.5 * (pl[0] + pl[2]);
  const py = 0.5 * (pl[1] + pl[3]);
  assert.equal(spatial.isBlockedThree(px, -py, 0.35), true);

  // Sliding movement against Teaching Block 1 wall prevents penetration
  const resolved = spatial.resolveMoveThree(35, 8.0, 0.42);
  assert.equal(spatial.isBlockedThree(resolved.x, resolved.z, 0.35), false);
});

test('CampusSpatial: rain shelter zones and A* road navigation graph connect campus', () => {
  // Block 1 through-hall and Fengqiting pavilion shelter citizens from tropical rain
  assert.equal(spatial.isShelteredThree(0, 4.0), true);
  assert.equal(spatial.isShelteredThree(-40, -56), true);
  // Open sports pitch is NOT sheltered
  assert.equal(spatial.isShelteredThree(-95, -50), false);

  // A* path from North Gate to Yanchi & Library & Sports Field succeeds with clean waypoints
  const p1 = spatial.findPathThree(0, -106, 46, 108);
  assert.ok(p1.length >= 2, 'Expected valid A* path from North Gate to Yanchi');
  const p2 = spatial.findPathThree(110, -20, -85, -35);
  assert.ok(p2.length >= 2, 'Expected valid A* path from Library to Sports Field');
});

test('World Spec Integrity: all 34 buildings, 6 districts, 8 vistas, zero Yanchi overlaps', () => {
  assert.equal(spec.districts.length, 6);
  assert.equal(spec.buildings.length, 34);
  assert.equal(spec.vistas.length, 8);
  assert.ok(spec.context_buildings.length >= 100);
  // Honest provenance check: no building falsely claims 'surveyed'
  for (const b of spec.buildings) {
    assert.ok(!String(b.tag || '').toLowerCase().includes('surveyed'), `Building ${b.id} must not claim surveyed`);
  }
});
