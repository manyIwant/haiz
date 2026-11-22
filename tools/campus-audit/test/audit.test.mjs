// node --test tools/campus-audit/test/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { overlapArea, rectToFootprint, fitSimilarity, gap, components, distanceTo } from '../lib/geom.mjs';
import { wgsToGcj, gcjToWgs, distance, imagePixelToGround, bearingOf } from '../lib/geo.mjs';
import { audit } from '../audit.mjs';
import { lintClaims } from '../checks/credibility.mjs';

const near = (a, b, eps) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);
const TF = { originPx: [0, 0], scale: 1, flipY: true };

test('footprint transform matches lanren/map/geo.js rectCampus', () => {
  const f = rectToFootprint([637.7, 1024.1, 1332.3, 1185.8], { originPx: [900, 784], scale: 0.167 });
  near(f.cx, 14.195, 1e-3); near(f.cz, -53.599, 1e-3); near(2 * f.hw, 116, 0.01); near(2 * f.hd, 27, 0.01);
});

test('overlap area of oriented rectangles', () => {
  const a = { cx: 0, cz: 0, hw: 1, hd: 1, rot: 0 };
  near(overlapArea(a, { cx: 1, cz: 0, hw: 1, hd: 1, rot: 0 }), 2, 1e-9);
  near(overlapArea(a, { cx: 3, cz: 0, hw: 1, hd: 1, rot: 0 }), 0, 1e-9);
  // a square turned 45° about the same centre: octagon area 8(√2 − 1)
  near(overlapArea(a, { cx: 0, cz: 0, hw: 1, hd: 1, rot: Math.PI / 4 }), 8 * (Math.SQRT2 - 1), 1e-9);
  near(gap(a, { cx: 5, cz: 0, hw: 1, hd: 1, rot: 0 }), 3, 1e-9);
  near(distanceTo(a, 4, 5), 5, 1e-9);
});

test('union-find components', () => {
  const g = components(5, (i, j) => Math.abs(i - j) === 1 && i !== 2 && j !== 2);
  assert.deepEqual(g.map((x) => x.length).sort(), [1, 2, 2]);
});

test('similarity fit recovers a known rotation, scale and shift, with residuals', () => {
  const src = [[0, 0], [100, 0], [0, 50], [80, 70]];
  const r = 0.7, s = 1.03, t = [12, -7];
  const dst = src.map(([x, y]) => [s * (Math.cos(r) * x - Math.sin(r) * y) + t[0], s * (Math.sin(r) * x + Math.cos(r) * y) + t[1]]);
  const f = fitSimilarity(src, dst);
  near(f.rot, r, 1e-9); near(f.scale, s, 1e-9); near(f.tx, t[0], 1e-6); near(f.ty, t[1], 1e-6); near(f.rms, 0, 1e-6);
});

test('GCJ-02 round trip and the known offset size in Haikou', () => {
  const w = [19.998, 110.343];
  const g = wgsToGcj(w), back = gcjToWgs(g);
  assert.ok(distance(w, back) < 0.01, 'inverse within 1 cm');
  const off = distance(w, g);
  assert.ok(off > 300 && off < 700, `GCJ offset in Haikou is several hundred metres (got ${off.toFixed(0)})`);
});

test('Web Mercator pixels become ground metres (sec φ correction)', () => {
  const b = [12283006.868267957, 2272500.465952118, 12283606.868267957, 2273100.465952118];
  const g = imagePixelToGround(1024, 512, b, 1024);
  near(g.e, 300 * Math.cos((g.lat * Math.PI) / 180), 1e-6);
  near(g.metresPerPixel, 0.551, 0.002);
  near(bearingOf(1, 0), 90, 1e-9); near(bearingOf(0, -1), 180, 1e-9);
});

// ------------------------------------------------------------- a synthetic checkout
function fixture(mut = (c, cred) => {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'campus-audit-'));
  const campus = {
    meta: { transform: TF, ground: { width: 400, depth: 400 } },
    buildings: [
      { id: 'lanshu', name: 'tree', form: 'oldtree', rect: [-5, -5, 5, 5], rot: 0 },
      { id: 'a', name: 'A', form: 'academic', rect: [20, 20, 60, 40], size: [40, 19, 20], floors: 5, floorH: 3.8, rot: 0 },
      { id: 'b', name: 'B', form: 'academic', rect: [50, 30, 90, 50], size: [40, 19, 20], floors: 5, floorH: 3.8, rot: 0 }
    ],
    roads: [{ id: 'r1', rect: [0, 0, 100, 10] }, { id: 'r2', rect: [150, 0, 160, 100] }],
    lawns: [], water: [], trees: [{ t: 'palm', p: [30, 30] }], views: [], tour: []
  };
  const cred = { tags: {}, defaults: { building: { position: { tag: 'estimated' } }, landscape: { position: { tag: 'estimated' } }, road: { position: { tag: 'estimated' } }, tree: { position: { tag: 'invented' } }, view: { position: { tag: 'invented' } } }, items: {} };
  mut(campus, cred);
  fs.mkdirSync(path.join(dir, 'assets/walk'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'assets/walk/campus.json'), JSON.stringify(campus));
  fs.writeFileSync(path.join(dir, 'data/campus-credibility.json'), JSON.stringify(cred));
  return dir;
}
const has = (R, check, severity, re) => R.findings.some((f) => f.check === check && f.severity === severity && re.test(f.subject + ' ' + f.message));

test('audit flags overlapping buildings, split paths and a tree in a wall', async () => {
  const R = await audit(fixture());
  assert.ok(has(R, 'space', 'error', /a × b/), 'overlap is an error');
  assert.ok(has(R, 'network', 'warn', /disconnected/), 'two path groups');
  assert.ok(has(R, 'space', 'warn', /tree points stand inside/), 'tree inside building');
  assert.ok(R.counts.error >= 1);
});

test('"surveyed" without a raw survey file in the repo is an error; with one it passes', async () => {
  let R = await audit(fixture((c, cred) => { cred.items.a = { position: { tag: 'surveyed', sources: ['docs/notes.md'] } }; }));
  assert.ok(has(R, 'credibility', 'error', /a\.position.*no raw survey file/));
  const dir = fixture((c, cred) => { cred.items.a = { position: { tag: 'surveyed', sources: ['survey/a.geojson'] } }; });
  fs.mkdirSync(path.join(dir, 'survey')); fs.writeFileSync(path.join(dir, 'survey/a.geojson'), '{}');
  R = await audit(dir);
  assert.ok(!has(R, 'credibility', 'error', /a\.position/));
});

test('unknown tags are errors', async () => {
  const R = await audit(fixture((c, cred) => { cred.defaults.road.position.tag = 'probably-right'; }));
  assert.ok(has(R, 'credibility', 'error', /unknown or missing tag/));
});

test('claims lint: unqualified 实测 is flagged, negated or counted ones are not', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'campus-claims-'));
  fs.writeFileSync(path.join(dir, 'README.md'), '路网来自 KML 实测形状。\n建筑不是测绘复刻。\n实测 300 棵中 61 棵落在建筑内。\n');
  const hits = lintClaims(dir);
  assert.equal(hits.length, 1);
  assert.match(hits[0].text, /KML 实测形状/);
});

test('the real repository audits without errors', async () => {
  const R = await audit();
  const errs = R.findings.filter((f) => f.severity === 'error');
  assert.deepEqual(errs, []);
  const g = R.results.georef.result.imagery;
  assert.ok(g && Math.abs(g.rotationDeg - 41.4) < 5, 'orientation near the legacy claim');
  assert.ok(Math.abs(g.scale - 1) < 0.08, 'scale near 1');
});
