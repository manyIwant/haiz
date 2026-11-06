// Node checks for chapter 04's campus beneath the water (lanren/map): the
// tree-centred frame, the places and their real relative positions, the reveal's
// arrival field and timing, the colour inversion, and the map camera's maths.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const mod = (p) => import(pathToFileURL(path.join(root, p)).href);
const near = (a, b, eps, msg) => assert(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);

(async () => {
  const geo = await mod('lanren/map/geo.js');
  const reveal = await mod('lanren/map/reveal.js');
  const tone = await mod('lanren/map/tone.js');
  const ch = await mod('lanren/js/chapters.js');
  const campus = JSON.parse(fs.readFileSync(path.join(root, 'assets/walk/campus.json'), 'utf8'));
  const extras = JSON.parse(fs.readFileSync(path.join(root, 'data/buildings.json'), 'utf8'));
  const checks = [];
  const G = geo.buildGeo(campus, extras);
  const { frame, features, places } = G;

  // ---------------------------------------------------------------- the frame
  // the walk's own transform (assets/walk/world.js rectWorld), reproduced independently
  const TF = { ox: 900, oy: 784, s: 0.167 };
  const rectWorld = (r) => { const x0 = (Math.min(r[0], r[2]) - TF.ox) * TF.s, x1 = (Math.max(r[0], r[2]) - TF.ox) * TF.s, z0 = -(Math.max(r[1], r[3]) - TF.oy) * TF.s, z1 = -(Math.min(r[1], r[3]) - TF.oy) * TF.s; return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 }; };
  assert.deepStrictEqual(campus.meta.transform.originPx, [900, 784]);
  for (const b of campus.buildings) {
    const a = geo.rectCampus(b.rect, campus.meta.transform), w = rectWorld(b.rect);
    for (const k of ['x', 'z', 'w', 'd']) near(a[k], w[k], 1e-9, b.id + ' rect ' + k);
  }
  const lanshu = rectWorld(campus.buildings.find((b) => b.id === 'lanshu').rect);
  near(frame.pivot.x, 49.098, 1e-3, 'tree pivot x'); near(frame.pivot.z, -78.098, 1e-3, 'tree pivot z');
  const o = frame.toWorld(lanshu.x, lanshu.z);
  near(o.x, 0, 1e-9, 'the tree is the origin (x)'); near(o.z, 0, 1e-9, 'the tree is the origin (z)');
  assert.strictEqual(geo.GROUND_Y, ch.WATER, 'the map lies on V4\'s water plane');
  for (let k = 0; k < 50; k++) {
    const x = (k * 37.3) % 600 - 300, z = (k * 53.1) % 560 - 280;
    const w = frame.toWorld(x, z), c = frame.toCampus(w.x, w.z);
    near(c.x, x, 1e-9, 'round trip x'); near(c.z, z, 1e-9, 'round trip z');
  }
  // 1 m is 1 m: distances are kept
  const yh = rectWorld(campus.buildings.find((b) => b.id === 'yihao').rect), lib = rectWorld(campus.buildings.find((b) => b.id === 'library').rect);
  const wy = frame.toWorld(yh.x, yh.z), wl = frame.toWorld(lib.x, lib.z);
  near(Math.hypot(wy.x - wl.x, wy.z - wl.z), Math.hypot(yh.x - lib.x, yh.z - lib.z), 1e-9, 'scale 1:1');
  checks.push(`frame: the walk's plan transform reproduced for all ${campus.buildings.length} footprints; 百年榄仁树 (49.098, −78.098) → world origin; round trip exact; 1 m = 1 m; ground y = V4 water ${geo.GROUND_Y}`);

  // the landmarks, relative to the tree (campus-local axes, −Z towards the North Gate)
  const P = (id) => places.find((p) => p.id === id);
  // expected values: the materials kit's independent export (tools/export_campus_origin.py →
  // blueprints/map-locations-derived.json, tree centre rounded to the millimetre there)
  const expect = { yihao: [-34.903, 24.499], library: [59.995, 14.504], fengqitang: [-74.298, -38.001], yanchi: [9.502, 140.497], beimen: [-36.097, -80.502], hujulongpan: [-38.602, -0.501] };
  for (const [id, [x, z]] of Object.entries(expect)) { near(P(id).x, x, 0.01, id + ' x'); near(P(id).z, z, 0.01, id + ' z'); }
  assert(P('yihao').box.z0 > 0 && P('yihao').box.z0 < 12, '一号教学楼 stands just south of the tree (its north face ' + P('yihao').box.z0.toFixed(1) + ' m)');
  assert(P('library').x > 0, '图书馆 is east'); assert(P('beimen').z < -60, '北门 is north'); assert(P('yanchi').z > 100, '砚池 is far south');
  assert(P('fengqitang').x < 0 && P('fengqitang').z < 0, '凤栖堂 is north-west');
  assert.strictEqual(P('library').fromTree.bearing, '东'); assert.strictEqual(P('beimen').fromTree.bearing, '西北'); assert.strictEqual(P('yihao').fromTree.bearing, '西南');
  checks.push('landmarks relative to the tree: ' + Object.keys(expect).map((id) => `${P(id).name} (${P(id).x.toFixed(1)}, ${P(id).z.toFixed(1)}) ${P(id).fromTree.bearing} ${Math.round(P(id).fromTree.distance)} m`).join('; '));

  // ---------------------------------------------------------------- features and places
  assert.strictEqual(features.length, campus.buildings.length + campus.roads.length + campus.sports.length, 'every footprint, path and court is drawn');
  for (let i = 1; i < features.length; i++) assert(features[i].layer >= features[i - 1].layer, 'draw order by layer');
  for (const f of features) assert(geo.featureSDF(f, f.cx, f.cz) < 0, f.id + ' contains its own centre');
  const keji = features.find((f) => f.id === 'keji');
  assert(Math.abs(keji.rot + 0.267) < 1e-9, 'the one rotated building keeps its rotation');
  // a point along keji's own long axis is inside; the same point unrotated is outside
  const along = { x: keji.cx + Math.cos(keji.rot) * (keji.hw - 1), z: keji.cz - Math.sin(keji.rot) * (keji.hw - 1) };
  assert(geo.featureSDF(keji, along.x, along.z) < 0, 'rotation follows the walk (group.rotation.y = rot)');
  assert.strictEqual(geo.placeAt(places, features, 0, 0).id, 'lanshu', 'the tree\'s plot answers at the origin');
  assert.strictEqual(geo.placeAt(places, features, P('library').x, P('library').z).id, 'library');
  assert.strictEqual(geo.placeAt(places, features, P('fengqitang').x, P('fengqitang').z).id, 'fengqitang_ting', 'the smaller pavilion wins inside its garden');
  const dorm = P('dorm_m');
  assert(dorm.features.length === 4, 'the boys\' dormitory is one place of four wings');
  for (const p of places) {
    assert(p.walk === 'campus-3d.html?focus=' + p.id, 'walk link for ' + p.id);
    assert(campus.buildings.some((b) => b.id === p.id && Array.isArray(b.size)), p.id + ' is a building the walk can start from (goTo needs size)');
    assert(p.name && p.desc, p.id + ' has words from the data');
  }
  assert.strictEqual(P('library').image, 'assets/images/campus/campus_library.jpg');
  for (const p of places) if (p.image) assert(fs.existsSync(path.join(root, p.image)), 'photo exists: ' + p.image);
  assert.strictEqual(P('yanlintang').image, null); assert(P('yanlintang').imageWithheld, '衍林堂\'s mislabelled photo stays withheld');
  checks.push(`${features.length} features drawn from the data (${campus.buildings.length} footprints, ${campus.roads.length} paths, ${campus.sports.length} courts); ${places.length} places with the data's words, ${places.filter((p) => p.image).length} project photos (all present), walk links to campus-3d.html?focus=<id>`);

  // ---------------------------------------------------------------- arrival field
  const A = geo.computeArrival(features, frame);
  near(geo.arrivalAt(A, 0, 0), 0, 1e-6, 'the reveal starts at the roots');
  let prev = 0;
  for (let r = 10; r <= 200; r += 10) { const v = geo.arrivalAt(A, r * 0.7, -r * 0.7); assert(v >= prev - 0.02, 'arrival grows outwards'); prev = v; }
  // along a path it is quicker than across a building at the same distance
  const road = features.find((f) => f.id === 'r_h_mid1');   // the path between 一号 and 二号
  const bld = features.find((f) => f.id === 'yihao');
  const pr = { x: -60, z: road.cz }, pb = { x: bld.cx - 30, z: bld.cz };
  const dr = Math.hypot(pr.x, pr.z), db = Math.hypot(pb.x, pb.z);
  assert(Math.abs(dr - db) < 25, 'comparable distances');
  assert(geo.arrivalAt(A, pr.x, pr.z) / dr < geo.arrivalAt(A, pb.x, pb.z) / db, 'paths surface before roofs');
  checks.push(`arrival field ${A.nx}×${A.nz} (${A.cell} m): 0 at the roots, rising outwards, faster along paths than through buildings`);

  // ---------------------------------------------------------------- the reveal's timing
  let pi = -9, ps = -9;
  for (let T = 0; T <= 1.0001; T += 0.01) { const r = reveal.revealAt(T); assert(r.ink >= pi - 1e-9 && r.surf >= ps - 1e-9, 'fronts only move outwards'); pi = r.ink; ps = r.surf; assert(r.ink >= r.surf - 1e-9 || T > 0.97, 'lines before ground'); }
  const r0 = reveal.revealAt(0), r1 = reveal.revealAt(1);
  assert(r0.ink + 0 < 0 && r0.surf < 0, 'T = 0 is V4\'s water');
  assert(r1.surf - 1 > r1.surfFeather * 0.5 && r1.settle === 1, 'T = 1 is the whole campus surfaced, the islet settled');
  const view = [0.02, 0.06, 0.1];
  for (const a of view) assert(reveal.localAt(0.9, a).surf === 1, 'the chapter frame is surfaced before the end');
  assert(reveal.localAt(0.3, 0.02).ink > 0.5 && reveal.localAt(0.3, 0.02).surf === 0, 'R1: lines near the roots under water');
  checks.push('reveal: fronts move only outwards, lines lead the ground, T=0 is V4, T=1 is the campus; the 04 frame (arrival ≤ 0.1) is ground by T = 0.9');

  // ---------------------------------------------------------------- colour
  const layerSrc = fs.readFileSync(path.join(root, 'lanren/map/layer.js'), 'utf8');
  const pal = [...layerSrc.matchAll(/\['(\w+)', '(#[0-9a-f]{6})'\]/g)].map((m) => [m[1], m[2]]);
  assert(pal.length >= 20, 'palette parsed');
  const grade = { exposure: ch.LIGHT[3].exposure, sat: 1.0, contrast: 1.04, warm: ch.LIGHT[3].warm };
  let worst = 0;
  for (const [k, h] of pal) {
    const lin = tone.invert(tone.hex(h), grade);
    assert(lin.every((v) => Number.isFinite(v) && v > 0 && v < 16), k + ' inverted to a sane linear colour');
    const back = tone.forward(lin, grade), err = Math.max(...back.map((v, i) => Math.abs(v - tone.hex(h)[i]) * 255));
    if (!k.startsWith('ink')) worst = Math.max(worst, err);
    assert(err < (k.startsWith('ink') ? 12 : 1), `${k} ${h} reproduces on screen (±${err.toFixed(2)}/255)`);
  }
  checks.push(`palette: ${pal.length} colours authored as seen, inverted through V4's ACES + Finish grade at chapter 04 (worst ${worst.toFixed(2)}/255; the two water inks within 12/255)`);

  // ---------------------------------------------------------------- the camera
  const V = await mod('lanren/map/view.js');
  for (const portrait of [false, true]) {
    ch.setPortrait(portrait);
    const f = ch.poseAt(3), v = V.viewFromPose(f), e = V.eyeOf(v);
    near(e.x, f.ex, 1e-6, 'oblique default is chapter 04 (eye x)'); near(e.y, f.ey, 1e-6, 'eye y'); near(e.z, f.ez, 1e-6, 'eye z');
    const back = V.poseFromView(v);
    const d1 = [f.lx - f.ex, f.ly - f.ey, f.lz - f.ez], d2 = [back.lx - back.ex, back.ly - back.ey, back.lz - back.ez];
    const n1 = Math.hypot(...d1), n2 = Math.hypot(...d2);
    for (let i = 0; i < 3; i++) near(d1[i] / n1, d2[i] / n2, 1e-9, 'same direction back to V4');
    // the top view keeps the target and the ground scale at it (a dolly zoom)
    const t = V.withLook(v, V.TOP);
    near(V.distanceOf(t) * Math.tan((t.fov * Math.PI) / 360), V.distanceOf(v) * Math.tan((v.fov * Math.PI) / 360), 1e-9, 'scale at the target kept');
    assert(t.tx === v.tx && t.tz === v.tz, 'target kept');
    // zooming about a ground point keeps it under the same pixel: the ray eye→g keeps its direction
    const g = { x: v.tx + 12, z: v.tz - 7 }, z = V.zoomAbout(v, g, 2.3), e1 = V.eyeOf(v), e2 = V.eyeOf(z);
    const r1 = [g.x - e1.x, ch.WATER - e1.y, g.z - e1.z], r2 = [g.x - e2.x, ch.WATER - e2.y, g.z - e2.z];
    const m1 = Math.hypot(...r1), m2 = Math.hypot(...r2);
    for (let i = 0; i < 3; i++) near(r1[i] / m1, r2[i] / m2, 1e-9, 'zoom about the cursor');
    assert(V.minScale(v) * Math.sin((v.pitch * Math.PI) / 180) / Math.tan((v.fov * Math.PI) / 360) >= V.LIMITS.eyeMin - 1e-9, 'the closest view keeps the eye above the crown');
  }
  ch.setPortrait(false);
  checks.push('camera: the default map view is exactly chapter 04 (landscape and phone), hands back the same direction; top view keeps target and ground scale (dolly zoom); zoom keeps the point under the cursor');

  // ---------------------------------------------------------------- history
  const { parseHash } = await import(pathToFileURL(path.join(root, 'lanren/map/hash.js')).href);
  assert.deepStrictEqual(parseHash('#map/top/library'), { view: 'top', id: 'library' });
  assert.deepStrictEqual(parseHash('#map/oblique'), { view: 'oblique', id: null });
  assert.strictEqual(parseHash('#map'), null); assert.strictEqual(parseHash('#days'), null);
  checks.push('history hashes: #map (the shot) · #map/<oblique|top> (the plan) · #map/<view>/<place>');

  fs.writeFileSync(path.join(root, 'tests/campus-map-results.json'), JSON.stringify({ checks }, null, 2));
  console.log('PASS campus-map:\n- ' + checks.join('\n- '));
})().catch((e) => { console.error(e); process.exit(1); });
