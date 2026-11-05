// Node checks for the tree homepage (v3): shots, camera path, growth,
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

  // camera: one continuous film — smooth, above water, never through the trunk,
  // each shot exact at its stop, every move keeps travelling forward in time
  let worst = 0, travelled = 0;
  for (let p = 0; p < N - 1; p += 0.005) {
    const a = ch.poseAt(p), b = ch.poseAt(p + 0.005);
    const d = Math.hypot(a.ex - b.ex, a.ey - b.ey, a.ez - b.ez);
    worst = Math.max(worst, d); travelled += d;
    assert(a.ey > ch.WATER + 0.3, 'eye above the water at p=' + p.toFixed(3));
    assert(Math.hypot(a.ex - 0.15, a.ez) > 1.8 || a.ey > 3.6, 'eye clear of the trunk at p=' + p.toFixed(3));
    assert(a.fov > 15 && a.fov < 80, 'focal length sane at p=' + p.toFixed(3));
    for (const k of ['lx', 'ly', 'lz', 'ex', 'ey', 'ez']) assert(Number.isFinite(a[k]), k + ' finite at p=' + p.toFixed(3));
  }
  assert(worst < 0.6, 'camera jumps: ' + worst.toFixed(2) + ' m per 0.5 %');
  for (let i = 0; i < N; i++) {
    const at = ch.poseAt(i), f = ch.shot(i);
    assert(Math.abs(at.ex - f.ex) < 1e-6 && Math.abs(at.ey - f.ey) < 1e-6 && Math.abs(at.fov - f.fov) < 1e-6, 'shot ' + i + ' exact');
  }
  // phones fly their own compositions for the opening, the map and full bloom: same rules,
  // a looser step (the map climbs higher so the whole crown fits a narrow screen)
  ch.setPortrait(true);
  let worstP = 0;
  for (let p = 0; p < N - 1; p += 0.005) {
    const a = ch.poseAt(p), b = ch.poseAt(p + 0.005);
    worstP = Math.max(worstP, Math.hypot(a.ex - b.ex, a.ey - b.ey, a.ez - b.ez));
    assert(a.ey > ch.WATER + 0.3, 'portrait eye above the water at p=' + p.toFixed(3));
    assert(Math.hypot(a.ex - 0.15, a.ez) > 1.8 || a.ey > 3.6, 'portrait eye clear of the trunk at p=' + p.toFixed(3));
  }
  assert(worstP < 1.3, 'portrait camera jumps: ' + worstP.toFixed(2) + ' m per 0.5 %');
  ch.setPortrait(false);
  checks.push(`portrait path continuous (≤${worstP.toFixed(2)} m per 0.5 %), above water, clear of the trunk`);
  // the opening and closing shots frame the whole tree; the details shot is a close-up
  const far = (i) => Math.hypot(ch.shot(i).ex - ch.AXIS.x, ch.shot(i).ez - ch.AXIS.z);
  assert(far(0) > 30 && far(5) > 25 && ch.shot(2).fov < 32, 'shot scales: wide open, wide close, macro in between');
  checks.push(`camera path continuous (≤${worst.toFixed(2)} m per 0.5 %, ${travelled.toFixed(0)} m in all), above water, clear of the trunk; six shots exact`);

  // light keys complete and blended
  for (let p = 0; p <= N - 1; p += 0.125) {
    const L = ch.lightAt(p);
    for (const k of ['sunAz', 'sunEl', 'I', 'density', 'mist', 'rays', 'exposure', 'aperture', 'sat', 'contrast']) assert(Number.isFinite(L[k]), 'light ' + k + ' at ' + p);
    assert(L.sunEl >= 3 && L.sunEl < 75, 'the sun stays up: ' + L.sunEl);
    assert(L.density < 0.01, 'haze stays light: ' + L.density);
  }
  checks.push('art-directed light keys (world-space sun, haze, grade) finite and blended between shots');

  // links: every destination exists and matches the generated HTML
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const link of ch.allLinks()) {
    assert(fs.existsSync(path.join(root, link.href.split(/[?#]/)[0])), 'missing destination ' + link.href);
    assert(home.includes(`href="${link.href}"`), 'index.html lacks ' + link.href);
  }
  for (const c of ch.CHAPTERS) { assert(home.includes(`id="p-${c.id}"`) && home.includes(`id="${c.id}"`), 'panel and stop ' + c.id); }
  checks.push(ch.allLinks().length + ' destinations exist and match index.html (generated from chapters.js)');

  // Blender assets: growth data present
  const meta = JSON.parse(fs.readFileSync(path.join(root, 'lanren/assets/tree.json'), 'utf8'));
  const S = meta.rosetteStride;
  assert.strictEqual(S, 16);
  const buf = new Float32Array(fs.readFileSync(path.join(root, 'lanren/assets/rosettes.bin')).buffer.slice(0));
  assert.strictEqual(buf.length, meta.counts.rosettes * S, 'rosette buffer size');
  let old = 0, minT = 9, maxT = -9;
  for (let i = 0; i < buf.length; i += S) {
    if (buf[i + 9] >= 0) { minT = Math.min(minT, buf[i + 9]); maxT = Math.max(maxT, buf[i + 9]); }
    if (buf[i + 10] > 0) { old++; assert(buf[i + 10] < 0.36, 'old leaves drop during the first part of the walk'); }
    assert(Math.hypot(buf[i] - buf[i + 12], buf[i + 1] - buf[i + 13], buf[i + 2] - buf[i + 14]) < 5, 'rosette near its clump');
    assert(buf[i + 8] >= 0 && buf[i + 8] <= 1 && buf[i + 15] >= 0 && buf[i + 15] <= 1, 'occlusion and shell in 0..1');
  }
  assert(minT >= 0.05 && maxT < 0.6, 'leaves emerge within the walk: ' + minT.toFixed(2) + '..' + maxT.toFixed(2));
  assert(old > 500, 'last year\'s red leaves fill the opening shot: ' + old);
  // growth reaches full leaf by the last shot: every leaf open by g = 1
  assert(maxT + ch.LEAF_TIMING.unfold < ch.GROW[ch.GROW.length - 1], 'every leaf has unfolded at the end');
  const glb = fs.readFileSync(path.join(root, 'lanren/assets/tree.glb'));
  const json = JSON.parse(glb.slice(20, 20 + glb.readUInt32LE(12)).toString());
  const attrs = json.meshes[0].primitives[0].attributes;
  assert(json.extensionsUsed.includes('EXT_meshopt_compression') && attrs.TEXCOORD_1 !== undefined && attrs.COLOR_0 !== undefined, 'growth data (TEXCOORD_1) and AO (COLOR_0) in the GLB');
  checks.push(`Blender tree: ${meta.counts.nodes} branch nodes (space colonisation), ${meta.counts.clumps} clumps, ${meta.counts.rosettes} rosettes (${old} with last year's leaves); new leaves emerge ${minT.toFixed(2)}–${maxT.toFixed(2)}`);

  // the specimen date still uses real Haikou time
  const p = sun.haikouParts(Date.UTC(2026, 10, 3, 7, 12));
  assert.deepStrictEqual([p.month, p.day, p.hour, p.minute], [11, 3, 15, 12]);
  checks.push('pressed-leaf dates use Haikou time');

  fs.writeFileSync(path.join(root, 'tests/lanren-results.json'), JSON.stringify({ checks }, null, 2));
  console.log('PASS lanren:\n- ' + checks.join('\n- '));
})().catch((e) => { console.error(e); process.exit(1); });
