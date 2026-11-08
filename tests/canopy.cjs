// Chapter 03 · works canopy — rules that must hold without a browser:
// stable leaf addresses, the lifecycle and who may see what, fair discovery, addresses in URLs,
// and that development samples can never pass for real work.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const mod = (p) => import(pathToFileURL(path.join(root, p)).href);

(async () => {
  const results = [];
  const A = await mod('lanren/canopy/address.js');
  const D = await mod('lanren/canopy/directions.js');
  const M = await mod('lanren/canopy/model.js');
  const R = await mod('lanren/canopy/route.js');
  const buf = fs.readFileSync(path.join(root, 'lanren/assets/rosettes.bin'));
  const ros = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  const meta = JSON.parse(fs.readFileSync(path.join(root, 'lanren/assets/tree.json'), 'utf8'));

  // ---- leaf addresses
  assert.strictEqual(meta.seed, 2611, 'slot tables were laid out on the locked V4 tree (seed 2611)');
  const T1 = A.buildSlots(ros), T2 = A.buildSlots(new Float32Array(ros));
  assert.strictEqual(A.fingerprint(T1), A.fingerprint(T2), 'the slot table is a pure function of the tree');
  assert.strictEqual(A.fingerprint(T1), '9f1a9f49', 'slot table fingerprint changed: the tree or the rule changed — migrate addresses, do not silently move leaves');
  const all = new Set();
  for (const d of D.DIRECTIONS) {
    const s = T1.get(d.id);
    assert(s.length >= 200, `${d.id} has room for its first works (${s.length})`);
    assert.strictEqual(new Set(s).size, s.length, `${d.id}: one work per leaf`);
    for (const i of s) { assert(!all.has(i), 'a leaf belongs to one limb only'); all.add(i); }
    for (const i of s.slice(0, 40)) {
      const deg = A.azimuth(ros[i * 16], ros[i * 16 + 2]);
      assert.strictEqual(D.directionAt(deg)?.id, d.id, `${d.id} slot leaf lies on its own limb`);
      assert(A.candidate(ros, i * 16), 'slot leaves are outer, new-growth rosettes');
    }
  }
  results.push(`slot tables: ${[...T1].map(([k, v]) => `${k} ${v.length}`).join(', ')} leaves; deterministic (fingerprint ${A.fingerprint(T1)}), disjoint`);
  // resolution and allocation
  assert.strictEqual(A.resolve('v4-2611:photo:0', T1), T1.get('photo')[0]);
  assert.strictEqual(A.resolve('v5-0000:photo:0', T1), null, 'an address on another tree does not resolve silently');
  assert.strictEqual(A.resolve('v4-2611:nope:0', T1), null);
  assert.strictEqual(A.resolve('v4-2611:photo:99999', T1), null);
  assert.strictEqual(A.parse('../../etc'), null);
  assert.strictEqual(A.allocate('words', [], T1, ros), 0, 'the first work takes the first leaf');
  assert.strictEqual(A.allocate('words', [0, 1, 3], T1, ros), 2, 'lowest free slot');
  const withdrawn = new Set([0, 1, 2]);   // slot 1 withdrawn: still reserved
  assert.strictEqual(A.allocate('words', withdrawn, T1, ros), 3, 'a withdrawn work keeps its leaf; nobody moves in');
  const src = T1.get('photo')[0];
  const k = A.allocate('photo', [0], T1, ros, { near: src });
  const dist = (i) => Math.hypot(ros[i * 16] - ros[src * 16], ros[i * 16 + 1] - ros[src * 16 + 1], ros[i * 16 + 2] - ros[src * 16 + 2]);
  for (let j = 1; j < T1.get('photo').length; j++) assert(dist(T1.get('photo')[k]) <= dist(T1.get('photo')[j]) + 1e-9, 'a relay grows on the nearest free leaf to its source');
  results.push('addresses: resolve only on their own tree; allocation is append-only, withdrawal keeps the leaf, relays grow beside their source');

  // ---- lifecycle and visibility
  const owner = { id: 'u1', role: 'student' }, other = { id: 'u2', role: 'student' }, editor = { id: 'e1', role: 'editor' }, mod1 = { id: 'm1', role: 'moderator' };
  const w = { id: 'w', owner: 'u1', state: 'draft', contributors: [{ account: 'u3', accepted: true, name: 'B' }] };
  assert(M.canView(w, owner) && !M.canView(w, other) && !M.canView(w, editor) && !M.canView(w, null), 'a private draft is the author’s alone (not even reviewers)');
  assert(!M.canView(w, { id: 'u3' }), 'co-creators see a shared work only once it leaves private draft');
  assert(M.canTransition(w, 'submit', owner) && !M.canTransition(w, 'submit', other));
  const sub = { ...w, state: 'submitted' };
  assert(M.canView(sub, editor) && !M.canView(sub, other), 'reviewers see what was submitted to them');
  assert(M.canTransition(sub, 'approve', editor) && !M.canTransition(sub, 'approve', owner), 'authors cannot approve themselves');
  const ok = { ...w, state: 'approved' };
  assert(!M.canView(ok, other), 'approved is not public');
  assert(!M.canTransition(ok, 'publish', editor), 'review never publishes: only the author does');
  assert(M.canTransition(ok, 'publish', owner));
  const pub = { ...w, state: 'public' };
  assert(M.canView(pub, null), 'public works are for everyone');
  assert(M.canTransition(pub, 'withdraw', owner) && !M.canTransition(pub, 'withdraw', editor), 'only the author withdraws');
  assert(M.canTransition(pub, 'hide', mod1) && !M.canTransition(pub, 'hide', other), 'moderators can hide on report');
  const gone = { ...w, state: 'withdrawn' };
  assert(!M.canView(gone, other) && M.canView(gone, owner) && M.canTransition(gone, 'publish', owner), 'withdrawn: private again, the author may republish');
  const pv = M.publicView({ ...pub, reviewNotes: 'x', reports: [1] });
  assert(!('owner' in pv) && !('reviewNotes' in pv) && !('reports' in pv) && !pv.contributors.some((c) => 'account' in c), 'the public projection carries no private fields');
  assert.strictEqual(M.publicView(gone), null);
  results.push('lifecycle: draft → submitted → approved → (author) public ↔ withdrawn; drafts author-only; review never publishes; public projection strips private fields');

  // ---- discovery
  const works = [
    { id: 'a', state: 'public', published: '2026-11-01', picks: [{ issue: 1 }] },
    { id: 'b', state: 'public', published: '2026-11-05', picks: [{ issue: 2 }], recommendations: [{ reason: '好', at: '2026-11-06' }] },
    { id: 'c', state: 'public', published: '2026-11-06', recommendations: [{ reason: ' ', at: '2026-11-07' }], relations: [{ type: 'responds-to', work: 'a' }] },
    { id: 'd', state: 'draft', published: '2026-11-06', picks: [{ issue: 2 }] }
  ];
  assert.deepStrictEqual(M.lens(works, 'picks').map((x) => x.id), ['b'], 'this issue only; drafts never shown');
  assert.deepStrictEqual(M.lens(works, 'recommended').map((x) => x.id), ['b'], 'a recommendation needs a reason');
  assert.deepStrictEqual(M.lens(works, 'linked').map((x) => x.id), ['c']);
  const n1 = M.lens(works, 'new', { today: '2026-11-07' }).map((x) => x.id), n2 = M.lens(works, 'new', { today: '2026-11-08' }).map((x) => x.id);
  assert.strictEqual(n1.length, 3);
  assert.deepStrictEqual([...n1].sort(), [...n2].sort());
  assert.deepStrictEqual(M.lens(works, 'new', { today: '2026-11-07' }).map((x) => x.id), n1, 'the daily rotation is stable within a day');
  assert.deepStrictEqual(M.chain(works, 'c').map((x) => x.id), ['a', 'c']);
  assert.deepStrictEqual(M.related(works, 'a').map((r) => [r.dir, r.work.id]), [['to', 'c']]);
  results.push('discovery: 本期向阳 per issue, 同学推荐 needs a reason, 初生新叶 rotates daily, 枝叶相连 follows relations; nothing is ordered by popularity');

  // ---- addresses in URLs
  assert.deepStrictEqual(R.parseHash('#leaves/w/demo-0207'), { work: 'demo-0207' });
  assert.deepStrictEqual(R.parseHash('#leaves/words'), { dir: 'words', inside: true });
  assert.deepStrictEqual(R.parseHash('#leaves/all'), { dir: null, inside: true });
  assert.deepStrictEqual(R.parseHash('#archive'), { shot: true }, 'the former chapter id still opens chapter 03');
  assert.deepStrictEqual(R.parseHash('#leaves/w/<script>'), { shot: true }, 'ids are validated');
  assert.strictEqual(R.parseHash('#map/top'), null);
  results.push('routes: #leaves, #leaves/<direction>, #leaves/w/<id>; former #archive kept; ids validated');

  // ---- development samples stay labelled, and resolve on the tree
  const demo = JSON.parse(fs.readFileSync(path.join(root, 'lanren/canopy/demo/works.json'), 'utf8'));
  assert.strictEqual(demo.demo, true);
  assert.strictEqual(demo.slotFingerprint, A.fingerprint(T1), 'demo addresses were allocated on this slot table');
  const seen = new Set();
  for (const x of demo.works) {
    assert.strictEqual(x.demo, true, x.id + ' is marked as a sample');
    assert(x.id.startsWith('demo-'), x.id);
    assert((x.contributors || []).every((c) => /^演示作者/.test(c.name) && c.demo), x.id + ' authors are placeholders');
    assert((x.recommendations || []).every((r) => /^演示同学/.test(r.by)), x.id + ' recommenders are placeholders');
    assert(A.resolve(x.address, T1) !== null, x.id + ' resolves to a leaf');
    assert(!seen.has(x.address), 'one work per leaf'); seen.add(x.address);
    for (const m of x.media || []) if (m.src) assert(fs.existsSync(path.join(root, m.src)), 'media exists: ' + m.src);
    for (const m of x.media || []) if (m.type === 'image') assert(/演示占位/.test(m.caption), x.id + ' image caption states it is a placeholder');
  }
  const src2 = fs.readFileSync(path.join(root, 'lanren/canopy/source.js'), 'utf8');
  assert(/if \(!demo\)/.test(src2) && /status: 'none', works: \[\]/.test(src2), 'without ?works=demo the canopy shows no works (no service yet)');
  results.push(`samples: ${demo.works.length} demo works, all flagged, placeholder authors, media present with provenance; production loads none`);

  const out = path.join(__dirname, 'canopy-results.json');
  fs.writeFileSync(out, JSON.stringify({ date: new Date().toISOString(), results }, null, 2) + '\n');
  for (const r of results) console.log('✓', r);
})().catch((e) => { console.error(e); process.exit(1); });
