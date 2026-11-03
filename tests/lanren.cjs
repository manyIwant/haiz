// Node checks for the tree homepage: sun, season model, rail, links, assets.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const mod = (p) => import(pathToFileURL(path.join(root, p)).href);

(async () => {
  const sun = await mod('lanren/js/sun.js');
  const season = await mod('lanren/js/season.js');
  const ch = await mod('lanren/js/chapters.js');
  const checks = [];

  // --- sun: Haikou solar geometry
  const noonJune = sun.haikouToMs(2026, sun.dayOfYearFor(6, 21), 12 * 60 + 38);
  const pJune = sun.sunPosition(noonJune);
  // at 20°N the June solstice sun culminates ~3.4° north of the zenith
  assert(Math.abs(pJune.altitude * 180 / Math.PI - 86.6) < 1.2, 'June noon altitude ' + pJune.altitude * 180 / Math.PI);
  assert(pJune.bearing < 30 || pJune.bearing > 330, 'June noon sun to the north, got ' + pJune.bearing);
  const noonDec = sun.sunPosition(sun.haikouToMs(2026, sun.dayOfYearFor(12, 21), 12 * 60 + 38));
  assert(Math.abs(noonDec.altitude * 180 / Math.PI - 46.6) < 1.2, 'December noon altitude');
  assert(Math.abs(noonDec.bearing - 180) < 8, 'December noon sun to the south');
  const night = sun.sunPosition(sun.haikouToMs(2026, 100, 2 * 60));
  assert(night.altitude < 0, 'sun below horizon at 2:00');
  const parts = sun.haikouParts(Date.UTC(2026, 10, 3, 7, 12));   // 15:12 in Haikou
  assert.deepStrictEqual([parts.month, parts.day, parts.hour, parts.minute], [11, 3, 15, 12]);
  const v = sun.sunVector(Math.PI / 4, sun.SITE.campusNorthBearing + 90);
  assert(v[0] > 0.7 && Math.abs(v[2]) < 1e-9, 'campus-east sun lands on +X');
  checks.push('solar geometry at 20°N (solstice culmination, bearings, night, Haikou clock, campus frame)');

  // --- season: continuity over the whole year and plausible stages
  let prev = season.seasonAt(1);
  let maxJump = 0, falls = 0;
  for (let d = 1.25; d <= 365; d += 0.25) {
    const s = season.seasonAt(d);
    // visible state per leaf must not jump: sample leaves on the CPU twin of the shader
    for (let k = 0; k < 40; k++) {
      const r1 = (k * 0.6180339) % 1, r2 = (k * 0.4142135) % 1;
      const A = seasonCPU(prev, r1, r2), B = seasonCPU(s, r1, r2);
      // a fully coloured leaf letting go is a fall, not a glitch
      if (A.age > 0.95 && B.scl === 0) { falls++; continue; }
      maxJump = Math.max(maxJump, Math.abs(A.scl - B.scl), Math.abs(A.age - B.age) * (A.scl > 0.05 ? 1 : 0));
    }
    prev = s;
  }
  assert(maxJump < 0.2, 'leaf state jumps between adjacent quarter-days: ' + maxJump.toFixed(3));
  assert(falls >= 40, 'every sampled leaf falls at least once a year');
  const jan = season.seasonAt(25), may = season.seasonAt(140), jul = season.seasonAt(200), feb = season.seasonAt(52);
  assert(jan.turn > 0.8 && jan.label.match(/红|落/), 'late January is red / falling: ' + jan.label);
  assert(feb.fallen > 0.6, 'late February mostly bare');
  assert(may.turn === 0 && may.flush === 1 && may.label.startsWith('浓荫'), 'May is full shade: ' + may.label);
  assert(jul.fruit > 0.4, 'fruit in summer');
  checks.push('phenology continuous to ' + maxJump.toFixed(3) + ' per quarter-day; winter red, February bare, May shade, summer fruit');

  // --- chapters: rail is continuous and every stop links somewhere real
  const N = ch.CHAPTERS.length;
  assert.strictEqual(N, 6);
  // walking: the eye moves at most ~0.4 m per 1% of a stop and never enters the trunk or boulders
  let worst = 0;
  for (let p = 0; p < N - 1; p += 0.01) {
    const a = ch.poseAt(p), b = ch.poseAt(p + 0.01);
    worst = Math.max(worst, Math.hypot(a.ex - b.ex, a.ey - b.ey, a.ez - b.ez));
    for (const o of ch.OBSTACLES) assert(Math.hypot(a.ex - o.x, a.ez - o.z) >= o.r - 1e-6, 'eye inside an obstacle at p=' + p.toFixed(2));
  }
  assert(worst < 0.45, 'camera rail jumps: ' + worst);
  for (let i = 0; i < N; i++) {
    const at = ch.poseAt(i), want = ch.frameOf(ch.CHAPTERS[i].pose);
    for (const k of Object.keys(want)) assert(Math.abs(at[k] - want[k]) < 1e-6, `stop ${i} frame ${k}`);
  }
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const link of ch.allLinks()) {
    const file = link.href.split('?')[0];
    assert(fs.existsSync(path.join(root, file)), 'missing destination ' + file);
    assert(home.includes(`href="${link.href}"`), 'index.html lacks ' + link.href);
  }
  for (const c of ch.CHAPTERS) assert(home.includes(`id="${c.id}"`), 'section ' + c.id);
  checks.push('six stops, continuous rail, poses exact at stops, ' + ch.allLinks().length + ' destinations exist and match the HTML');

  // --- assets from the Blender pipeline
  const meta = JSON.parse(fs.readFileSync(path.join(root, 'lanren/assets/tree.json'), 'utf8'));
  const ros = fs.statSync(path.join(root, 'lanren/assets/rosettes.bin')).size;
  assert.strictEqual(ros, meta.counts.rosettes * meta.rosetteStride * 4, 'rosette buffer size');
  const fr = fs.statSync(path.join(root, 'lanren/assets/fruits.bin')).size;
  assert.strictEqual(fr, meta.counts.fruits * 16, 'fruit buffer size');
  const buf = new Float32Array(fs.readFileSync(path.join(root, 'lanren/assets/rosettes.bin')).buffer.slice(0));
  let minY = 1e9, maxY = -1e9, minX = 1e9, maxX = -1e9;
  for (let i = 0; i < buf.length; i += meta.rosetteStride) {
    minY = Math.min(minY, buf[i + 1]); maxY = Math.max(maxY, buf[i + 1]);
    minX = Math.min(minX, buf[i]); maxX = Math.max(maxX, buf[i]);
    assert(buf[i + 8] >= 0 && buf[i + 8] <= 1, 'occlusion range');
  }
  assert(minY > 1.2 && maxY < 15.5, 'canopy height ' + minY + '..' + maxY);
  assert(maxX > 10 && maxX > -minX, 'dragon limb reaches further east (+X) than the crown reaches west, ' + minX.toFixed(1) + '..' + maxX.toFixed(1));
  for (const f of ['tree.glb', 'stones.glb', 'leaf-atlas.png', 'leaf-atlas-web.png', 'leaf-normal-web.png', 'bark-color.jpg', 'bark-normal.jpg', 'paving-color.jpg', 'paving-normal.jpg', 'poster.jpg']) {
    assert(fs.existsSync(path.join(root, 'lanren/assets', f)), 'asset ' + f);
  }
  const glb = fs.readFileSync(path.join(root, 'lanren/assets/tree.glb'));
  assert.strictEqual(glb.readUInt32LE(0), 0x46546c67, 'glTF magic');
  const json = JSON.parse(glb.slice(20, 20 + glb.readUInt32LE(12)).toString());
  assert(json.extensionsUsed.includes('EXT_meshopt_compression'), 'meshopt compressed');
  assert(json.meshes[0].primitives[0].attributes.COLOR_0 !== undefined, 'baked AO / flex in COLOR_0');
  checks.push(`Blender assets: ${meta.counts.rosettes} rosettes, ${meta.counts.branches} branches, meshopt GLB with baked colour attribute`);

  fs.writeFileSync(path.join(root, 'tests/lanren-results.json'), JSON.stringify({ checks }, null, 2));
  console.log('PASS lanren:\n- ' + checks.join('\n- '));

  // CPU twin of SEASON_GLSL (kept here so the test does not need three.js)
  function seasonCPU(s, r1, r2) {
    const cl = (x, a, b) => Math.min(b, Math.max(a, x));
    const ss = (a, b, x) => { const t = cl((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const oldAge = cl((s.turn - r1 * 0.85) * 2.2, 0, 1.3);
    const sp = r2 > 0.86 ? cl(s.summer - r1 * 0.3, 0, 2) : 0;
    let age = Math.max(oldAge, Math.min(sp, 1)), scl = 1;
    if (oldAge >= 1) { scl = ss(r2 * 0.35, r2 * 0.35 + 0.5, s.flush); age = 0; }
    else if (sp >= 1) { const f = cl((sp - 1) * 1.1, 0, 1); scl = ss(0.1, 0.6, f); age = 0; }
    return { age, scl };
  }
})().catch((e) => { console.error(e); process.exit(1); });
