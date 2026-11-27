import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { specToThree, threeToSpec, skyBearingToThreeDir } from '../engine/core/coord.js';
import { WorldRuntime, scheduleAtHour, formatHour } from '../engine/core/runtime.js';
import { CampusSpatial } from '../engine/core/collision.js';

const R2 = '/Users/a11/manyiwant/haiz-world-reconstruction-r2/world-reconstruction-r2';

test('HAIZ-ENU-2026 coordinate transform round-trips cleanly', () => {
  const [tx, ty, tz] = specToThree(12.5, 45.0, 3.2);
  assert.deepEqual([tx, ty, tz], [12.5, 3.2, -45.0]);
  const back = threeToSpec(tx, ty, tz);
  assert.deepEqual(back, [12.5, 45.0, 3.2]);
  const dir = skyBearingToThreeDir(Math.PI / 4, 0);
  assert.ok(Math.abs(dir[1] - Math.SQRT1_2) < 1e-6);
});

test('WorldRuntime enforces clock wrapping, bell schedule transitions & single loop guard', () => {
  const rt = new WorldRuntime({ initialHour: 16.65, initialWeather: 'clear', initialLens: 0 });
  const bells = [];
  rt.bus.on('bell:change', (s) => bells.push(s.id));
  rt.setHour(25.25);
  assert.ok(Math.abs(rt.hour - 1.25) < 1e-6);
  assert.equal(formatHour(16.5), '16:30');
  assert.equal(scheduleAtHour(20.5).id, 'evening_study');
  assert.equal(bells.at(-1), 'night');

  rt.claimRenderLoop();
  assert.throws(() => rt.claimRenderLoop(), /duplicate render loop/);
  rt.dispose();
  rt.dispose();
});

test('CampusSpatial resolves ground heights cleanly across Taihu plaza & forecourt road', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(R2, 'data/world_spec.json'), 'utf8'));
  const spatial = new CampusSpatial(spec);
  assert.ok(spatial.heightAtThree(0, -15) >= 0.55, 'Central granite forecourt elevated above road');
  assert.ok(spatial.heightAtThree(0, -65) < 0.20, 'Forecourt carriageway road near datum');
});

test('Round 2 manifest, spec, Master.blend & instances maintain strict provenance & bounds', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(R2, 'data/manifest_r2.json'), 'utf8'));
  const spec = JSON.parse(fs.readFileSync(path.join(R2, 'data/world_spec.json'), 'utf8'));
  const inst = JSON.parse(fs.readFileSync(path.join(R2, 'data/instances_r2.json'), 'utf8'));

  assert.equal(manifest.inherited_atelier_runtime.length, 9);
  assert.ok(manifest.r2_districts.length >= 10);
  assert.equal(spec.provenance_policy.surveyed_count, 0);
  assert.ok(!JSON.stringify(spec.buildings).includes('"surveyed"'), 'No un-surveyed element may carry surveyed tag');
  assert.ok(fs.statSync(path.join(R2, 'assets/blend/HAIZ_World_R2_Master.blend')).size < 50 * 1024 * 1024);

  const treeTotal = Object.values(inst.flora).reduce((s, arr) => s + arr.length, 0);
  assert.ok(treeTotal >= 150, `Expected >=150 trees, got ${treeTotal}`);
});
