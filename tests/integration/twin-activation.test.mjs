import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

test('06 enters the real free-roam variant, not the former living-only preview', () => {
  const world = read('lanren/world/world.js');
  const free = read('ruhua-free.html');
  assert.match(world, /class="wd-ruhua" href="ruhua-free\.html\?stage=stroll"/);
  assert.match(world, /href: 'ruhua-free\.html\?stage=stroll'/);
  assert.match(free, /src="lanren\/free\/main\.js/);
  assert.match(free, /data-thread="mark"/);
  assert.match(free, /src="assets\/js\/thread\.js/);
  assert.match(read('lanren/free/main.js'), /createFree/);
  assert.match(read('lanren/free/main.js'), /Q.get\('stage'\) === 'stroll'/);
});

test('chapter 04 and both painted campus worlds use one twin-aware V3 loader', () => {
  const map = read('lanren/map/section.js');
  const world = read('lanren/ruhua/world.js');
  const v3 = read('lanren/map/campus-v3.js');
  const upgrade = read('lanren/map/twin-phase2.js');
  assert.match(map, /loadCampusV3/);
  assert.match(world, /loadCampusV3/);
  assert.match(v3, /upgradeCampusLandmarks\(entries\)/);
  assert.match(upgrade, /yihao: 'yihao', beimen: 'gate'/);
  assert.match(upgrade, /twin.*off/);
  for (const name of ['yihao', 'gate']) assert.ok(existsSync(new URL('../../twin/assets/phase1/' + name + '.glb', import.meta.url)));
});

test('V4 film tree and rock are not silently duplicated by the landmark bridge', () => {
  const upgrade = read('lanren/map/twin-phase2.js');
  assert.doesNotMatch(upgrade, /PARTS\s*=.*trees\.glb/);
  assert.match(upgrade, /stay with V4/);
});
