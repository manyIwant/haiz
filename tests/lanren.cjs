// Node checks for the tree homepage (v2): viewpoints, camera path, growth,
// light keys, links, and the Blender growth data.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const mod = (p) => import(pathToFileURL(path.join(root, p)).href);

(async () => {
  const ch = await mod('lanren/js/chapters.js');
  const sun = await mod('lanren/js/sun.js');
  const checks = [];
  const N = ch.CHAPTERS.length;
  assert.strictEqual(N, 6);

  // growth rises with the walk and ends in full leaf
  let prevG = -1;
  for (let p = 0; p <= N - 1 + 1e-9; p += 0.05) { const g = ch.growAt(p); assert(g >= prevG - 1e-9, 'growth never goes back while walking forward'); prevG = g; }
  assert.strictEqual(ch.growAt(0), 0); assert.strictEqual(ch.growAt(N - 1), 1);
  checks.push('growth is monotone from 0 (end of winter) to 1 (full leaf)');

  // camera: smooth, circling the tree, never under water or inside the trunk
  let worst = 0, turned = 0;
  for (let p = 0; p < N - 1; p += 0.01) {
    const a = ch.poseAt(p), b = ch.poseAt(p + 0.01);
    worst = Math.max(worst, Math.hypot(a.ex - b.ex, a.ey - b.ey, a.ez - b.ez));
    turned += Math.abs(b.th - a.th);
    assert(a.ey > ch.WATER + 0.3, 'eye above the water at p=' + p.toFixed(2));
    assert(Math.hypot(a.ex - 0.1, a.ez) > 2.2 || a.ey > 3, 'eye outside the trunk at p=' + p.toFixed(2));
  }
  assert(worst < 0.9, 'camera jumps: ' + worst.toFixed(2));
  assert(turned > Math.PI * 1.2, 'the walk goes round the tree: ' + (turned * 180 / Math.PI).toFixed(0) + '°');
  for (let i = 0; i < N; i++) {
    const at = ch.poseAt(i), f = ch.FRAMES[i];
    assert(Math.abs(at.lx - f.lx) < 1e-6 && Math.abs(at.ey - f.h) < 1e-6, 'viewpoint ' + i + ' exact');
  }
  checks.push(`camera path continuous (≤${worst.toFixed(2)} m per 1 %), above water, clear of the trunk, ${(turned * 180 / Math.PI).toFixed(0)}° around the tree`);

  // light keys complete and blended
  for (let p = 0; p <= N - 1; p += 0.25) {
    const L = ch.lightAt(p);
    for (const k of ['rel', 'elev', 'I', 'density', 'mist', 'rays', 'exposure', 'aperture']) assert(Number.isFinite(L[k]), 'light ' + k);
    assert(L.elev > 0 && L.elev < 40, 'the sun stays up');
  }
  checks.push('art-directed light keys finite and blended between viewpoints (dawn → evening)');

  // links: every destination exists and matches the generated HTML
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const link of ch.allLinks()) {
    assert(fs.existsSync(path.join(root, link.href.split('?')[0])), 'missing destination ' + link.href);
    assert(home.includes(`href="${link.href}"`), 'index.html lacks ' + link.href);
  }
  for (const c of ch.CHAPTERS) { assert(home.includes(`id="p-${c.id}"`) && home.includes(`id="${c.id}"`), 'panel and stop ' + c.id); }
  checks.push(ch.allLinks().length + ' destinations exist and match index.html (generated from chapters.js)');

  // Blender assets: growth data present
  const meta = JSON.parse(fs.readFileSync(path.join(root, 'lanren/assets/tree.json'), 'utf8'));
  assert.strictEqual(meta.rosetteStride, 15);
  const buf = new Float32Array(fs.readFileSync(path.join(root, 'lanren/assets/rosettes.bin')).buffer.slice(0));
  assert.strictEqual(buf.length, meta.counts.rosettes * 15, 'rosette buffer size');
  let old = 0, minT = 9, maxT = -9;
  for (let i = 0; i < buf.length; i += 15) {
    minT = Math.min(minT, buf[i + 9]); maxT = Math.max(maxT, buf[i + 9]);
    if (buf[i + 10] > 0) { old++; assert(buf[i + 10] < 0.25, 'old leaves drop early'); }
    assert(Math.hypot(buf[i] - buf[i + 12], buf[i + 1] - buf[i + 13], buf[i + 2] - buf[i + 14]) < 5, 'rosette near its pad');
  }
  assert(minT >= 0 && maxT < 0.8, 'leaves emerge within the walk: ' + minT.toFixed(2) + '..' + maxT.toFixed(2));
  assert(old > 50, 'some of last year\'s leaves remain at the start');
  const glb = fs.readFileSync(path.join(root, 'lanren/assets/tree.glb'));
  const json = JSON.parse(glb.slice(20, 20 + glb.readUInt32LE(12)).toString());
  const attrs = json.meshes[0].primitives[0].attributes;
  assert(json.extensionsUsed.includes('EXT_meshopt_compression') && attrs.TEXCOORD_1 !== undefined && attrs.COLOR_0 !== undefined, 'growth data (TEXCOORD_1) and AO (COLOR_0) in the GLB');
  checks.push(`Blender tree: ${meta.counts.branches} branches, ${meta.counts.rosettes} rosettes in ${meta.pads} pads; emergence ${minT.toFixed(2)}–${maxT.toFixed(2)}; ${old} rosettes keep last year's leaves`);

  // the specimen date still uses real Haikou time
  const p = sun.haikouParts(Date.UTC(2026, 10, 3, 7, 12));
  assert.deepStrictEqual([p.month, p.day, p.hour, p.minute], [11, 3, 15, 12]);
  checks.push('pressed-leaf dates use Haikou time');

  fs.writeFileSync(path.join(root, 'tests/lanren-results.json'), JSON.stringify({ checks }, null, 2));
  console.log('PASS lanren:\n- ' + checks.join('\n- '));
})().catch((e) => { console.error(e); process.exit(1); });
