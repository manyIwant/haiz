// Chapter 02 · 根脉: the history is sourced, honest and climbable (Node, no browser).
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
(async () => {
  const H = await import(path.join(root, 'lanren/roots/history.js'));
  const P = await import(path.join(root, 'lanren/roots/path.js'));
  const ch = await import(path.join(root, 'lanren/js/chapters.js'));
  const out = [];
  const { NODES, SOURCES, PHOTOS, GRADES } = H;
  assert(NODES.length >= 10, 'enough stations to climb');
  assert.strictEqual(NODES[0].year, '1923', 'the climb starts at the founding');
  assert.strictEqual(NODES[NODES.length - 1].id, 'today', 'and ends at today');
  const ids = new Set();
  let lastYear = 0;
  for (const n of NODES) {
    assert(!ids.has(n.id), 'unique id ' + n.id); ids.add(n.id);
    assert(GRADES[n.grade], 'grade of ' + n.id);
    assert(n.title && n.lead && n.body.length, 'words for ' + n.id);
    // facts need sources; only a gap, an inferred photograph or a memory may stand without one
    if (['record', 'single', 'official', 'site'].includes(n.grade)) assert(n.sources.length, n.id + ' cites its sources');
    if (n.grade === 'record') assert(n.sources.length >= 2, n.id + ': "多源一致" needs at least two sources');
    for (const s of n.sources) { assert(SOURCES[s], 'known source ' + s); assert(SOURCES[s].checked, 'how ' + s + ' was checked'); }
    if (n.photo) {
      const ph = PHOTOS[n.photo];
      assert(ph && fs.existsSync(path.join(root, ph.src)), 'photo file ' + n.photo);
      assert(ph.alt && ph.credit && /待确认|署名|水印/.test(ph.credit), 'photo credit says what is and is not known: ' + n.photo);
      if (ph.light) assert(fs.existsSync(path.join(root, ph.light)), 'light version of ' + n.photo);
    }
    for (const l of n.links || []) assert(fs.existsSync(path.join(root, l.href.split(/[?#]/)[0])), 'link ' + l.href);
    const y = parseInt(n.year, 10);
    if (y) { assert(y >= lastYear - 30, 'roughly chronological at ' + n.id); lastYear = Math.max(lastYear, y); }
    assert(n.at && n.at.eye && (n.at.target || n.at.look), 'placed on the tree: ' + n.id);
  }
  // no personal memory is shown without an author and consent (there are none yet)
  assert(!NODES.some((n) => n.grade === 'memory' && n.author), 'no memory has been invented');
  out.push(`${NODES.length} stations 1923 → today; every fact cites sources (多源 ≥ 2), photographs exist with honest credits`);

  // the existing archive pages are reached from the climb
  const linked = new Set(NODES.flatMap((n) => (n.links || []).map((l) => l.href.split(/[?#]/)[0])));
  for (const page of ['news.html', 'alumni.html', 'architecture.html']) assert(linked.has(page), page + ' reachable from chapter 02');
  out.push('news / alumni / architecture reachable from the stations they belong to');

  // the rail: starts on V4 shot 02, ends on V4 shot 03, continuous, eyes above the water
  const frames = P.buildFrames(NODES, ch.shot(1), ch.shot(2));
  const a = P.poseOn(frames, 0), b = P.poseOn(frames, 1);
  const s1 = ch.poseAt(1), s2 = ch.poseAt(2);
  for (const k of ['ex', 'ey', 'ez', 'lx', 'ly', 'lz', 'fov']) {
    assert(Math.abs(a[k] - s1[k]) < 1e-6, 'starts exactly on shot 02: ' + k);
    assert(Math.abs(b[k] - s2[k]) < 1e-6, 'ends exactly on shot 03: ' + k);
  }
  let prev = a, worst = 0;
  for (let s = 0.0005; s <= 1; s += 0.0005) {
    const q = P.poseOn(frames, s);
    for (const k of ['ex', 'ey', 'ez', 'lx', 'ly', 'lz', 'fov', 'focus']) assert(Number.isFinite(q[k]), k + ' finite at ' + s);
    assert(q.ey > ch.WATER + 0.3, 'above the water at ' + s.toFixed(4));
    worst = Math.max(worst, Math.hypot(q.ex - prev.ex, q.ey - prev.ey, q.ez - prev.ez));
    prev = q;
  }
  assert(worst < 0.12, 'no jumps on the rail: ' + worst.toFixed(3) + ' m per 0.05 %');
  const S = P.stationS(NODES.length);
  NODES.forEach((n, i) => { const q = P.poseOn(frames, S[i + 1]); assert(Math.hypot(q.ex - n.at.eye[0], q.ey - n.at.eye[1], q.ez - n.at.eye[2]) < 1e-6, 'rests exactly at ' + n.id); });
  out.push(`rail starts on shot 02, rests at every station, ends on shot 03; continuous (≤${worst.toFixed(3)} m per 0.05 %)`);

  // the limb the climb follows, and the grain of the wood
  const ax = P.axisAt([5.6, 6.46, 2.26]);
  assert(ax[0] > 0.5 && Math.abs(Math.hypot(...ax) - 1) < 1e-6, 'limb grain runs outwards');
  assert.deepStrictEqual(P.axisAt([0.1, 1.2, 1.3]), [0, 1, 0], 'trunk grain runs up');
  out.push('limb path and grain directions sane');

  // chapter wiring: 02 is 根脉, its static reading list is in index.html
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.strictEqual(ch.CHAPTERS[1].id, 'roots');
  assert(home.includes('class="roots-static"') && NODES.every((n) => home.includes(n.title.replace(/「|」/g, (m) => m))), 'every station in the static reading list');
  for (const href of ['campus-3d.html?focus=lanshu', 'descent.html', 'director.html']) assert(home.includes(`href="${href}"`), 'walk-out link kept: ' + href);
  out.push('index.html: 02 根脉 with a no-film reading list; walk-out links kept');
  console.log('roots:\n- ' + out.join('\n- '));
})().catch((e) => { console.error(e); process.exit(1); });
