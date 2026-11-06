// Node checks for the campus model behind chapter 04's plan (lanren/map/campus3d.js)
// and the plan → campus timeline (lanren/map/unfold.js):
//   - the model is built from the plan's own features: same centres, sizes, rotations
//   - its solids are closed (a cut can be filled from their back faces)
//   - storeys and heights follow the data; nothing is NaN; indices are in range
//   - a timeline cut never rests inside a floor slab
//   - the unfold is a pure function of u: it starts at the plan camera, ends at the
//     campus view, every building rises 0 → 1, and folding retraces it
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const mod = (p) => import(pathToFileURL(path.join(root, p)).href);
const near = (a, b, eps, msg) => assert(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);

(async () => {
  const geo = await mod('lanren/map/geo.js');
  const C = await mod('lanren/map/campus3d.js');
  const U = await mod('lanren/map/unfold.js');
  const campus = JSON.parse(fs.readFileSync(path.join(root, 'assets/walk/campus.json'), 'utf8'));
  const G = geo.buildGeo(campus);
  const checks = [];
  const t0 = performance.now();
  const m = C.buildCampus(campus, G.frame);
  const ms = performance.now() - t0;
  const { position, normal, index, info } = m.arrays;
  const nv = position.length / 3;

  // ---------------------------------------------------------------- arrays
  for (const v of position) assert(Number.isFinite(v), 'finite positions');
  for (const i of index) assert(i < nv, 'index in range');
  for (let i = 0; i < nv; i++) {
    const l = Math.hypot(normal[i * 3], normal[i * 3 + 1], normal[i * 3 + 2]) / 127;
    assert(l > 0.97 && l < 1.03, 'unit normals');
    assert(info[i * 2] < C.MATERIALS.length, 'material id in range');
    assert(info[i * 2 + 1] < m.buildings.length, 'building id in range');
  }
  checks.push(`model: ${m.buildings.length} buildings, ${nv} vertices, ${index.length / 3} triangles, ${((position.byteLength + normal.byteLength + m.arrays.edge.byteLength + info.byteLength + index.byteLength) / 1e6).toFixed(1)} MB, built in ${ms.toFixed(0)} ms; all finite, indices and ids in range, unit normals`);

  // ---------------------------------------------------------------- one source of truth with the plan
  let same = 0;
  for (const b of m.buildings) {
    const f = G.features.find((x) => x.id === b.id);
    assert(f, b.id + ' is a feature of the plan');
    near(b.rot, f.rot, 1e-12, b.id + ' rotation');
    if (b.form === 'corr' || b.id.startsWith('dorm_m_')) {
      // bridges stop at the blocks they meet, wings start at the spine: inside their own rectangle
      assert(b.w <= f.hw * 2 + 1e-6 && b.d <= f.hd * 2 + 1e-6, b.id + ' trimmed within its footprint');
      assert(Math.abs(b.cx - f.cx) <= f.hw && Math.abs(b.cz - f.cz) <= f.hd, b.id + ' centre within its footprint');
      continue;
    }
    near(b.cx, f.cx, 1e-9, b.id + ' x'); near(b.cz, f.cz, 1e-9, b.id + ' z');
    near(b.w, f.hw * 2, 1e-9, b.id + ' width'); near(b.d, f.hd * 2, 1e-9, b.id + ' depth');
    same++;
  }
  // every vertex of a building lies on or near its own footprint (porches, galleries and the
  // library's grand stair reach out a few metres), and no higher than its top
  for (const b of m.buildings) {
    const c = Math.cos(b.rot), s = Math.sin(b.rot);
    let ox = 0, oz = 0;
    for (let i = b.verts[0]; i < b.verts[1]; i++) {
      const dx = position[i * 3] - b.cx, dz = position[i * 3 + 2] - b.cz;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      ox = Math.max(ox, Math.abs(lx) - b.w / 2); oz = Math.max(oz, Math.abs(lz) - b.d / 2);
      assert(position[i * 3 + 1] <= geo.GROUND_Y + b.top + 1e-6 && position[i * 3 + 1] >= geo.GROUND_Y - 1e-6, b.id + ' within its height');
    }
    const reach = b.form === 'gate' ? 12 : b.form === 'library' || b.form === 'art' || b.form === 'academic' ? 16 : 6;
    assert(Math.max(ox, oz) < reach, `${b.id} stays near its footprint (reaches out ${Math.max(ox, oz).toFixed(1)} m)`);
  }
  checks.push(`one source with the plan: ${same} buildings share centre, size and rotation with the features the plan shader draws (Δ < 1e-9 m); bridges and dormitory wings are trimmed inside their own rectangles; every vertex stays on its footprint (porches, galleries, the library's stair excepted by a few metres) and within its height`);

  // ---------------------------------------------------------------- storeys and heights
  for (const b of m.buildings) {
    const src = campus.buildings.find((x) => x.id === b.id);
    if (b.floors) {
      assert.strictEqual(b.floors, src.floors, b.id + ' storeys');
      near(b.levels[b.levels.length - 1] + b.floorH, src.size[1], 1e-6, b.id + ' the top storey ends at the model height');
      assert(b.top >= src.size[1] - 1e-6, b.id + ' roof above the model height');
    }
  }
  checks.push('storeys and heights: every building has the data\'s storeys; the top storey ends exactly at the data\'s model height; roofs, parapets and plant sit above it');

  // ---------------------------------------------------------------- closed solids
  // every directed edge has its reverse (by position): the solids have no holes, so the
  // back faces seen through any cut fill it
  const closed = (b) => {
    const key = (i) => [0, 1, 2].map((k) => Math.round(position[i * 3 + k] * 1000)).join(',');
    const edges = new Map();
    for (let t = b.tris[0]; t < b.tris[1]; t++) {
      const a = [index[t * 3], index[t * 3 + 1], index[t * 3 + 2]].map(key);
      for (let k = 0; k < 3; k++) {
        const e = a[k] + '>' + a[(k + 1) % 3], r = a[(k + 1) % 3] + '>' + a[k];
        if (edges.get(r) > 0) edges.set(r, edges.get(r) - 1); else edges.set(e, (edges.get(e) || 0) + 1);
      }
    }
    let open = 0;
    for (const v of edges.values()) open += v;
    return open;
  };
  const sample = ['beimen', 'yihao', 'library', 'fengqitang_ting', 'corr_w12', 'dorm_m', 'yishu'];
  for (const id of sample) assert.strictEqual(closed(m.buildings.find((b) => b.id === id)), 0, id + ' is closed');
  checks.push(`closed solids: ${sample.join(', ')} have no open edge (every directed edge has its reverse)`);

  // ---------------------------------------------------------------- cuts and slabs
  for (const b of m.buildings) {
    for (let y = -0.5; y < b.top + 1; y += 0.013) {
      const c2 = C.clearOfBands(y, b.bands);
      if (c2 <= 0.001) continue;
      for (const [a, c] of b.bands) assert(!(c2 > a + 1e-6 && c2 < c - 1e-6), `${b.id}: a cut at ${y.toFixed(2)} rests outside its slabs`);
    }
    if (b.floors) assert(b.bands.length === b.floors + 1, b.id + ' plinth and one slab per storey');
  }
  for (const b of m.buildings) {
    const plan = b.base + C.CUT_HEIGHT;
    assert.strictEqual(C.clearOfBands(plan, b.bands), plan, b.id + ': the plan cut is never moved');
  }
  checks.push('cuts: swept through every building in 13 mm steps, a timeline cut never rests inside its plinth or a floor slab (which would fill the whole plan with ink); the plan\'s own 1.2 m cut is never moved');

  // ---------------------------------------------------------------- the timeline
  for (const order of [0, 0.25, 0.5, 0.75, 1]) {
    assert.strictEqual(U.riseAt(0, order), 0); assert.strictEqual(U.riseAt(1, order), 1);
    let prev = -1;
    for (let u = 0; u <= 1.0001; u += 0.01) { const r = U.riseAt(u, order); assert(r >= prev - 1e-12, 'rise grows with u'); prev = r; }
  }
  assert(U.riseAt(0.3, 0) > U.riseAt(0.3, 1), 'buildings near the tree rise first');
  let pf = -1;
  for (let u = 0; u <= 1.0001; u += 0.01) { const s = U.sweepAt(u).f; assert(s >= pf - 1e-12, 'the front only grows'); pf = s; }
  assert.strictEqual(U.sweepAt(0).f, 0); assert.strictEqual(U.sweepAt(1).f, 1); assert.strictEqual(U.sweepAt(1).glow, 0);
  const A = { tx: 2.31, tz: -0.08, s: 19.87, pitch: 73.5, yaw: -176.73, fov: 50, auth: 0 };
  const ext = { x0: -290, x1: 190, z0: -130, z1: 300 };
  const P = U.unfoldPath(A, ext, 16 / 9);
  const a0 = U.cameraAt(P, 0), a1 = U.cameraAt(P, 1);
  for (const k of ['tx', 'tz', 's', 'pitch', 'fov']) { near(a0[k], A[k], 1e-9, 'starts at the plan camera ' + k); near(a1[k], P.B[k], 1e-9, 'ends at the campus view ' + k); }
  // continuity: small steps of u move the camera by small amounts (no cut anywhere on the path)
  let worst = 0;
  for (let u = 0; u < 1; u += 0.001) {
    const p = U.cameraAt(P, u), q = U.cameraAt(P, u + 0.001);
    worst = Math.max(worst, Math.abs(q.tx - p.tx) + Math.abs(q.tz - p.tz) + Math.abs(Math.log(q.s / p.s)) * 100 + Math.abs(q.pitch - p.pitch) + Math.abs(((q.yaw - p.yaw + 540) % 360) - 180) + Math.abs(q.fov - p.fov));
  }
  // (a cut in the film would show as a step of hundreds; the eased path stays within a few units)
  assert(worst < 6, 'the camera path is continuous: worst step per 0.1 % of u = ' + worst.toFixed(3));
  const F = U.foldPath(P.B, { pitch: 73.5, yaw: -176.73, fov: 50 });
  near(U.cameraAt(F, 1).pitch, P.B.pitch, 1e-9, 'a fold starts where the campus view is');
  near(U.cameraAt(F, 0).pitch, 73.5, 1e-9, 'and ends in the plan look');
  near(U.cameraAt(F, 0).tx, P.B.tx, 1e-9, 'over the same ground');
  assert(U.labelsAt(0) === 1 && U.labelsAt(0.5) === 0 && U.labelsAt(1) === 1, 'labels rest during the change');
  checks.push(`timeline: every building rises 0 → 1 monotonically (near the tree first); the material front only grows and ends without its seam; the camera starts at the plan camera and ends at the campus view, continuous at 0.1 % steps (worst ${worst.toFixed(2)}); a fold starts at the 3D view and ends in the plan look over the same ground`);

  fs.writeFileSync(path.join(root, 'tests/campus-model-results.json'), JSON.stringify({ checks }, null, 2));
  for (const c of checks) console.log('✓ ' + c);
})().catch((e) => { console.error(e); process.exit(1); });
