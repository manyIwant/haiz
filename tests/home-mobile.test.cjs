const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const source = (file) => fs.readFileSync(path.join(root, file), 'utf8');
test('phone swipes do not rotate the tree on vertical scroll noise', async () => {
  const { touchIntent } = await import(pathToFileURL(path.join(root, 'lanren/js/mobile-gesture.js')).href);
  assert.equal(touchIntent(2, 3), null, 'a tap stays a tap');
  assert.equal(touchIntent(9, 45), 'scroll');
  assert.equal(touchIntent(19, 32), 'scroll', 'diagonal native pan is not camera yaw');
  assert.equal(touchIntent(40, 7), 'look');
  assert.equal(touchIntent(-28, 3), 'look');
});
test('mobile snapping chooses the closest station, unlike desktop directional snap', async () => {
  const { nearestSnap } = await import(pathToFileURL(path.join(root, 'lanren/js/mobile-gesture.js')).href);
  const stops = [0, 0.08, 0.13, 0.38, 0.7, 1];
  assert.equal(nearestSnap(0.10, stops), 0.08);
  assert.equal(nearestSnap(0.12, stops), 0.13);
  assert.equal(nearestSnap(0.43, stops), 0.38);
  assert.equal(nearestSnap(0.95, stops), 1);
});
test('phone-only source guards keep the desktop rail and assets intact', () => {
  const home = source('lanren/js/home.js');
  const css = source('lanren/home.css');
  const scene = source('lanren/js/scene.js');
  const camera = source('lanren/js/camera.js');
  assert.match(home, /matchMedia\('\(pointer: coarse\) and \(max-width: 760px\)'\)/);
  assert.match(home, /mobileTouch \? 0\.22 : 1\.15/);
  assert.match(home, /mobileTouch \? nearestSnap\(v, points\) : snapper/);
  assert.match(home, /ignoreMobileResize: true/);
  assert.match(home, /loadMapData\(\)\.then\(attachMap\)/);
  assert.match(css, /height: 100lvh/);
  assert.match(camera, /touchIntent\(e\.clientX - p\.startX, e\.clientY - p\.startY\)/);
  assert.match(scene, /leaf-atlas-web\.png/);
  assert.match(scene, /tree\.glb/);
});
