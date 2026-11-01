import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const site = new URL('../public/haiz/', import.meta.url);
const read = path => readFileSync(new URL(path, site), 'utf8');
const data = JSON.parse(read('assets/walk/campus.json'));

// Recorded from PR #16 head c6cebfbbd213dd0a2bc6becdd89391e82b1279ed.
// Fixed digests keep these checks reproducible without a GitHub connection or /tmp checkout.
const originalDigests = {
  'assets/walk/campus.json': '97a778b3dd0fa83784a04866a77dd8609ee23ac56711def30aa4724050a8beed',
  'assets/walk/campus-data.js': 'c44316791506903d3043bce140b1d4d0619e07393675f36c04ab5ee1b809e1d2',
  'assets/walk/world.js': '261fd416dbebb092118e5e436e27db658a27ef0fa5735706bff36cbbb2cf4daf',
  'assets/walk/movement.js': '6737bd8c2298307eec920b1eaf4790f4a0e4ac0c587c7cf44e969704070357ba',
  // V3 intentionally extends the derivative campus runtime. Original model,
  // movement, coordinates and independent destinations remain pinned.
  'world/stillroom/index.html': 'e811b972bef722cbd5d30d24108a64b34e9a14661b696cd23e5ce511bcc89d82',
  'world/room/immersive/index.html': 'bf0752f3ccadfdb44acaccf3e8753186f4c8a914653c81cb822d8fa72b83cfb7',
};

// Original world centers and footprints [x, z, width, depth], including corridors and gardens.
// These are model-local units, not independently surveyed east/north coordinates.
const originalFootprints = {
  beimen: [13.00095, -158.5999, 13.0093, 8.2164],
  keji: [56.50445, -152.7048, 57.9991, 30.9952],
  xiaoyouhui: [77.19575, -116.9, 26.3025, 19.0046],
  yihao: [14.195, -53.59865, 115.9982, 27.0039],
  erhao: [13.40175, -7.1977, 92.0003, 22.0106],
  kexue: [16.4996, 30.50255, 67.0004, 24.9999],
  chem: [-34.0012, 30.50255, 34.0012, 24.9999],
  sanhao: [-33.4, 59.79435, 36.0052, 24.6993],
  sihao: [-33.5002, 91.00665, 36.0052, 24.9999],
  library: [109.09275, -63.5936, 40.9985, 49.1982],
  canteen1: [202.0032, -22.00225, 51.0018, 62.0071],
  canteen3: [-136.99845, 40.2971, 35.9885, 46.092],
  dorm_f: [-92.0003, 37.09905, 53.0058, 55.2937],
  yishu: [32.2978, 103.09745, 78.49, 69.9897],
  nanmen: [-56.1955, 203.39765, 17.4014, 10.4041],
  lanshu: [49.098, -78.09755, 14.696, 11.9071],
  yanchi: [58.6003, 62.39955, 22.712, 14.4121],
  hujulongpan: [10.49595, -78.59855, 10.4041, 7.3981],
  corr_w12: [-11.09715, -33.10775, 8.4001, 25.3005],
  corr_e12: [40.10505, -32.6986, 7.6987, 27.7888],
  corr_sci2: [-8.4001, 11.39775, 11.189, 27.6051],
  corr_big: [-13.40175, 73.3965, 4.7929, 50.9016],
  corr_34: [-23.00425, 75.5007, 5.4943, 9.2852],
  yundong: [-152.24555, -136.89825, 173.4963, 94.8059],
  zhiwuyuan: [-109.6021, 108.6001, 88.2094, 82.7986],
  zhiwuyuan_pond: [-123.5967, 102.59645, 20.0066, 13.0093],
  fengqitang: [-25.2003, -116.0984, 59.0846, 37.408],
  fengqitang_ting: [-25.2003, -116.10675, 8.9846, 9.0013],
  yanlintang: [38.00085, -113.9942, 35.9885, 32.9992],
  yanlintang_ting: [38.00085, -114.00255, 9.0013, 9.0013],
  dorm_m: [146.50075, -39.95475, 14.0113, 71.6931],
  dorm_m_n: [157.9987, -12.1075, 37.0072, 15.9986],
  dorm_m_m: [157.9987, -39.9464, 37.0072, 15.9986],
  dorm_m_s: [157.9987, -67.802, 37.0072, 15.9986],
};

// Execute the actual pure conversion functions from the retained source rather than
// maintaining a second coordinate implementation in the test.
const conversionSource = read('assets/walk/world.js').match(/var TF =[\s\S]*?function rectWorld\(r\) \{[\s\S]*?\n  \}/)?.[0];
assert.ok(conversionSource, 'retained coordinate conversion can be inspected');
const rectWorld = runInNewContext(`${conversionSource}; rectWorld`);
const footprints = Object.fromEntries(data.buildings.map(b => [b.id, rectWorld(b.rect)]));
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-7, `${label}: ${actual} != ${expected}`);

test('original campus, geometry, movement and destination pages remain byte-for-byte intact', () => {
  for (const [path, expected] of Object.entries(originalDigests)) {
    const actual = createHash('sha256').update(readFileSync(new URL(path, site))).digest('hex');
    assert.equal(actual, expected, `${path} differs from reviewed PR source`);
  }
});

test('all 34 original node IDs retain their converted centers and footprints', () => {
  assert.equal(data.buildings.length, 34);
  assert.equal(new Set(data.buildings.map(b => b.id)).size, 34);
  assert.deepEqual(Object.keys(footprints).sort(), Object.keys(originalFootprints).sort());
  for (const [id, values] of Object.entries(originalFootprints)) {
    ['x', 'z', 'w', 'd'].forEach((key, i) => near(footprints[id][key], values[i], `${id}.${key}`));
  }
});

test('the two teaching axes and historic halls preserve the reviewed spatial relationships', () => {
  const mainAxis = ['beimen', 'yihao', 'erhao', 'kexue'].map(id => footprints[id]);
  assert.ok(Math.max(...mainAxis.map(b => b.x)) - Math.min(...mainAxis.map(b => b.x)) < 4);
  assert.ok(mainAxis.every((b, i) => !i || b.z > mainAxis[i - 1].z));
  const sideAxis = ['chem', 'sanhao', 'sihao'].map(id => footprints[id]);
  assert.ok(Math.max(...sideAxis.map(b => b.x)) - Math.min(...sideAxis.map(b => b.x)) < 1);
  assert.ok(sideAxis.every((b, i) => !i || b.z > sideAxis[i - 1].z));
  for (const id of ['fengqitang', 'yanlintang']) {
    assert.ok(footprints[id].z > footprints.beimen.z && footprints[id].z < footprints.yihao.z);
  }
  assert.ok(footprints.fengqitang.x < footprints.beimen.x && footprints.yanlintang.x > footprints.beimen.x);
  assert.ok(footprints.yanchi.z > footprints.kexue.z && footprints.yanchi.w < 23 && footprints.yanchi.d < 15);
});

test('library stays beside the first teaching building with distinct non-overlapping footprints', () => {
  const a = footprints.yihao, b = footprints.library;
  const gap = (b.x - b.w / 2) - (a.x + a.w / 2);
  assert.ok(gap > 16 && gap < 17, 'retain the approximately 16.4 model-unit lateral gap');
  assert.ok(Math.abs(a.z - b.z) < (a.d + b.d) / 2, 'library lies beside the teaching building rather than at the far campus end');
});

test('derivative engine resolves every retained script and stylesheet locally', () => {
  const html = read('world/atlas-engine.html');
  const documentURL = new URL('world/atlas-engine.html', 'https://prototype.invalid/haiz/');
  const baseHref = html.match(/<base\b[^>]*href=["']([^"']+)/i)?.[1];
  const base = new URL(baseHref || documentURL.href, documentURL);
  const dependencies = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/gi)].map(m => m[1]);
  assert.ok(dependencies.length > 20, 'the existing engine is loaded, not substituted with a static image');
  for (const path of dependencies) {
    const url = new URL(path, base);
    assert.equal(url.origin, documentURL.origin, `unexpected remote engine dependency: ${path}`);
    assert.ok(url.pathname.startsWith('/haiz/'));
    const local = new URL(url.pathname.slice('/haiz/'.length), site);
    assert.ok(existsSync(local), `missing engine dependency: ${fileURLToPath(local)}`);
  }
});

test('library and teaching portals resolve to the preserved STILLROOM and immersive classroom', () => {
  const connections = read('world/campus-journey-ui.js');
  for (const route of ['world/stillroom/', 'world/room/immersive/']) {
    assert.ok(connections.includes(`route:"${route}"`), `missing original contextual route ${route}`);
    assert.ok(existsSync(new URL(`${route}index.html`, site)), `destination is available locally: ${route}`);
  }
});
