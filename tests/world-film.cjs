// Node checks for chapters 05 → 06 and the walk (lanren/world):
//   - the film is a pure function of q: forwards, backwards and a direct jump give the same pose
//   - it starts on V4's 05 frame and ends on the 06 frame; it never jumps between samples
//   - the eye is always in the drawn walker's head; the feet are on the limb or the ground
//   - the composition decides whether the film's path and 06's eye are clear of the campus
//     (b and a: clear; the stage-1 campus as it stands, n: 06 is inside 一号教学楼)
//   - collision: walls stop the walker and it slides along them; a restored spot inside a
//     building is moved to the nearest free ground
//   - the turned campus (composition b) is still one source with the plan
//   - the campus's presence outside chapter 04 is a function of p
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const mod = (p) => import(pathToFileURL(path.join(root, p)).href);
const near = (a, b, eps, msg) => assert(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);
const wrap = (a) => { while (a > 180) a -= 360; while (a < -180) a += 360; return a; };

(async () => {
  const geoM = await mod('lanren/map/geo.js');
  const C3 = await mod('lanren/map/campus3d.js');
  const F = await mod('lanren/world/film.js');
  const K = await mod('lanren/world/skeleton.js');
  const X = await mod('lanren/world/collide.js');
  const CO = await mod('lanren/world/compose.js');
  const CH = await mod('lanren/js/chapters.js');
  const campus = JSON.parse(fs.readFileSync(path.join(root, 'assets/walk/campus.json'), 'utf8'));
  const tree = JSON.parse(fs.readFileSync(path.join(root, 'lanren/assets/tree.json'), 'utf8'));
  const checks = [];
  const G = CO.GROUND_Y;
  const ground = (x, z) => (Math.abs(x) < 8.5 && Math.abs(z) < 8.5 ? -0.2 : G + 0.02);
  const anchors = tree.anchors;
  const onLimb = (t) => { const a = anchors.limbDip, b = anchors.limbEnd; return a.map((v, i) => v + (b[i] - v) * t + (i === 1 ? 0.24 : 0)); };
  const limb = { a: onLimb(0.12), b: onLimb(0.9) };   // as world.js (LEAP.t)

  function build(id) {
    const compose = CO.COMPOSITIONS[id];
    const geo = geoM.buildGeo(campus, null, { rotation: compose.rotation });
    const model = C3.buildCampus(campus, geo.frame);
    const f5 = CH.shot(4), f6 = CH.shot(5);
    const s6 = compose.shot6;
    const e6 = s6 ? { ex: s6.eye[0], ez: s6.eye[2], lx: s6.look[0], ly: s6.look[1], lz: s6.look[2], fov: s6.fov, auth: 0 }
      : (() => { const y = (f6.yaw * Math.PI) / 180, p = (f6.pitch * Math.PI) / 180; return { ex: f6.ex, ez: f6.ez, lx: f6.ex + Math.sin(y) * Math.cos(p) * f6.dist, ly: f6.ey + Math.sin(p) * f6.dist, lz: f6.ez + Math.cos(y) * Math.cos(p) * f6.dist, fov: f6.fov, auth: f6.auth }; })();
    // the leap lands beyond the islet, turned towards 06 (as world.js computes it)
    const ld = [limb.b[0] - limb.a[0], limb.b[2] - limb.a[2]], l1 = Math.hypot(...ld), to6 = [e6.ex - limb.b[0], e6.ez - limb.b[2]], l2 = Math.hypot(...to6);
    let dx = ld[0] / l1 + 1.6 * to6[0] / l2, dz = ld[1] / l1 + 1.6 * to6[1] / l2; const n = Math.hypot(dx, dz); dx /= n; dz /= n;
    let lx = limb.b[0] + dx * 4.4, lz = limb.b[2] + dz * 4.4; const r = Math.hypot(lx, lz); if (r < 10) { lx *= 10 / r; lz *= 10 / r; }
    const film = F.makeFilm({ e5: { ex: f5.ex, ey: f5.ey, ez: f5.ez, yaw: f5.yaw, pitch: f5.pitch, fov: f5.fov, auth: f5.auth }, e6, limb, land: [lx, lz], ground });
    const col = X.buildColliders(model.buildings, {}, geo.frame.sheet);
    return { compose, geo, model, film, e6, f5, col };
  }

  // ---------------------------------------------------------------- the film itself (composition b)
  const B = build('b');
  const N = 2000;
  const fwd = [], bwd = [];
  for (let i = 0; i <= N; i++) fwd.push(B.film.pose(i / N));
  for (let i = N; i >= 0; i--) bwd.push(B.film.pose(i / N));
  bwd.reverse();
  for (let i = 0; i <= N; i += 37) {
    const j = B.film.pose(i / N);
    for (const k of ['ex', 'ey', 'ez', 'yaw', 'pitch', 'fov']) { assert.strictEqual(fwd[i].cam[k], bwd[i].cam[k], 'backwards = forwards'); assert.strictEqual(fwd[i].cam[k], j.cam[k], 'a jump = the same pose'); }
    for (const k of ['x', 'y', 'z', 'yaw', 'phase', 'amp', 'crouch', 'tuck']) assert.strictEqual(fwd[i].body[k], j.body[k], 'body pure');
  }
  checks.push(`pure: ${N + 1} samples forwards, backwards and by direct jump give identical eye, gaze, lens and body`);

  // endpoints: V4's 05 and the 06 eye
  const p0 = B.film.pose(0).cam, p1 = B.film.pose(1).cam, fx = B.film.facts;
  near(p0.ex, B.f5.ex, 1e-9, '05 eye x'); near(p0.ey, B.f5.ey, 1e-9, '05 eye y'); near(p0.ez, B.f5.ez, 1e-9, '05 eye z');
  near(wrap(p0.yaw - B.f5.yaw), 0, 1e-9, '05 yaw'); near(p0.pitch, B.f5.pitch, 1e-9, '05 pitch'); near(p0.fov, B.f5.fov, 1e-9, '05 lens');
  const v4 = CH.poseAt(4);
  const d0 = [p0.lx - p0.ex, p0.ly - p0.ey, p0.lz - p0.ez], dv = [v4.lx - v4.ex, v4.ly - v4.ey, v4.lz - v4.ez];
  const cosA = (d0[0] * dv[0] + d0[1] * dv[1] + d0[2] * dv[2]) / Math.hypot(...d0) / Math.hypot(...dv);
  assert(cosA > 1 - 1e-9, 'q = 0 looks exactly where V4 05 looks');
  near(p1.ex, B.e6.ex, 1e-6, '06 eye x'); near(p1.ez, B.e6.ez, 1e-6, '06 eye z'); near(p1.ey, G + 0.02 + K.EYE, 1e-6, '06 eye a person\'s height above the ground');
  near(wrap(p1.yaw - fx.y6), 0, 1e-6, '06 yaw'); near(p1.pitch, fx.p6, 1e-6, '06 pitch'); near(p1.fov, B.e6.fov, 1e-9, '06 lens');
  const look6 = [p1.lx - p1.ex, p1.ly - p1.ey, p1.lz - p1.ez], want6 = [B.e6.lx - p1.ex, B.e6.ly - p1.ey, B.e6.lz - p1.ez];
  assert((look6[0] * want6[0] + look6[1] * want6[1] + look6[2] * want6[2]) / Math.hypot(...look6) / Math.hypot(...want6) > 1 - 1e-9, '06 looks at what V4 06 looks at');
  checks.push(`ends: q = 0 is V4's 05 frame exactly; q = 1 stands at the composition's own 06 eye (b: 27 m from the tree, not V4's 06), a person's eye height ${K.EYE.toFixed(2)} m above the ground, looking at its point with its lens`);

  // continuity
  let jump = 0, turn = 0, lens = 0, at = 0;
  for (let i = 1; i <= N; i++) {
    const a = fwd[i - 1].cam, b = fwd[i].cam;
    const d = Math.hypot(b.ex - a.ex, b.ey - a.ey, b.ez - a.ez);
    if (d > jump) { jump = d; at = i / N; }
    turn = Math.max(turn, Math.abs(wrap(b.yaw - a.yaw)), Math.abs(b.pitch - a.pitch));
    lens = Math.max(lens, Math.abs(b.fov - a.fov));
  }
  // limits in the film's own time (film.js FILM_SECONDS): at most ~13 m/s for the eye, ~130°/s for the gaze, ~50°/s for the lens
  const dtStep = F.FILM_SECONDS / N;
  assert(jump / dtStep < 13, `the eye never jumps (worst ${(jump / dtStep).toFixed(1)} m/s at q ${at})`);
  assert(turn / dtStep < 130 && lens / dtStep < 50, `the gaze and lens never jump (worst ${(turn / dtStep).toFixed(0)}°/s, ${(lens / dtStep).toFixed(0)}°/s)`);
  checks.push(`continuous (in the film's own ${F.FILM_SECONDS.toFixed(1)} s): the eye moves at most ${(jump / dtStep).toFixed(1)} m/s, the gaze ${(turn / dtStep).toFixed(0)}°/s, the lens ${(lens / dtStep).toFixed(0)}°/s`);

  // the eye is in the head (once the camera has become the person), the feet on the limb or the ground
  const PH = F.PHASE;
  let worstEye = 0, worstFoot = 0;
  for (let i = 0; i <= N; i++) {
    const s = fwd[i], q = i / N, b = s.body;
    if (q >= PH.self[0]) {
      const e = B.film.eyeAt(b);
      worstEye = Math.max(worstEye, Math.hypot(s.cam.ex - e[0], s.cam.ey - e[1], s.cam.ez - e[2]));
      assert(b.firstPerson, 'first person from ' + PH.self[0]);
    }
    if (q >= PH.land[0]) worstFoot = Math.max(worstFoot, Math.abs(b.y - ground(b.x, b.z)));
    else if (q < PH.leap[0]) { const lo = Math.min(limb.a[1], limb.b[1]) - 1e-9, hi = Math.max(limb.a[1], limb.b[1]) + 1e-9; assert(b.y >= lo && b.y <= hi, 'on the limb'); }
  }
  assert(worstEye < 1e-6, 'eye in the head ' + worstEye);
  assert(worstFoot < 1e-9, 'feet on the ground ' + worstFoot);
  // the leap comes down: the lowest point of the arc is the landing, never below it
  for (let i = 0; i <= N; i++) { const q = i / N; if (q > PH.leap[0] && q < PH.land[0]) assert(fwd[i].body.y >= fx.L[1] - 1e-9, 'never below the ground in the air'); }
  checks.push(`the body: from q ${PH.self[0]} the eye stays in the drawn head (Δ < 1e-6 m, the head turned about the neck, the upper body's balance included); feet on the limb (${limb.a[1].toFixed(2)}–${limb.b[1].toFixed(2)} m) then on the ground; the leap never dips below the landing`);
  // before that, the person is someone in the scene: the eye finds them and comes round behind them
  {
    let minD = Infinity, inView = 0, n = 0;
    for (let i = Math.round(N * 0.045); i <= Math.round(N * PH.enter[0]); i++) {
      const s = fwd[i], e = B.film.eyeAt(s.body), c = s.cam;
      const d = [e[0] - c.ex, e[1] - c.ey, e[2] - c.ez], dl = Math.hypot(...d), g = [c.lx - c.ex, c.ly - c.ey, c.lz - c.ez], gl = Math.hypot(...g);
      minD = Math.min(minD, dl);
      assert(!s.body.firstPerson && s.third, 'third person while the eye finds them');
      const cosv = (d[0] * g[0] + d[1] * g[1] + d[2] * g[2]) / dl / gl;
      if (i >= N * 0.07) { n++; if (Math.acos(Math.min(1, cosv)) * 180 / Math.PI < c.fov * 0.5) inView++; }
    }
    assert(minD > 0.9, 'the camera stays outside the person until it enters (' + minD.toFixed(2) + ' m)');
    const late = fwd[Math.round(N * 0.12)], e = B.film.eyeAt(late.body);
    assert(inView / n > 0.7, 'the person is in the frame for most of the discovery (' + inView + '/' + n + ')');
    checks.push(`third person first: from q 0.045 to ${PH.enter[0]} the camera stays ≥ ${minD.toFixed(2)} m from the person on the limb and has them in the frame ${inView}/${n} samples from q 0.07 (once the pan has found them); it reaches their eye at ${PH.enter[1]}`);
    // the turn: the gaze comes round low (on the walker's own long shadow), then rises into the tree
    const t9 = B.film.pose(0.9).cam, t1 = B.film.pose(1).cam;
    assert(t9.pitch < -10 && t1.pitch > t9.pitch + 10, 'the gaze is low through the turn and rises to the tree');
    checks.push(`the turn: the gaze is ${t9.pitch.toFixed(0)}° at q 0.9 (the shadow on the ground) and rises to ${t1.pitch.toFixed(1)}° at 06`);
  }
  // beats are rests: the pose barely changes round each beat
  for (const q of F.BEATS.slice(1, -1)) {
    const a = B.film.pose(q - 0.003).cam, b = B.film.pose(q + 0.003).cam;
    assert(Math.hypot(b.ex - a.ex, b.ey - a.ey, b.ez - a.ez) < 0.35, 'beat ' + q + ' rests');
  }
  checks.push(`beats ${F.BEATS.join(' · ')}: the scroll snaps to poses that rest (the eye moves < 0.35 m within ±0.003 of each)`);

  // ---------------------------------------------------------------- compositions against the campus
  const clearPath = (S) => {
    let worst = Infinity;
    for (let i = Math.round(N * 0.47); i <= N; i++) { const b = S.film.pose(i / N).body; worst = Math.min(worst, X.nearest(S.col, b.x, b.z).d); }
    return worst;
  };
  const out = {};
  for (const id of ['b', 'a', 'n', 'c']) {
    const S = id === 'b' ? B : build(id);
    const c6 = X.nearest(S.col, S.film.facts.G6[0], S.film.facts.G6[2]);
    out[id] = { path: clearPath(S), at6: c6.d, in6: c6.id };
  }
  assert(out.b.path > 0.35 && out.b.at6 > 3, 'b: the film walks in the open and 06 stands in the open ' + JSON.stringify(out.b));
  assert(out.a.path > 0.35 && out.a.at6 > 3, 'a: the film walks in the open and 06 stands in the open ' + JSON.stringify(out.a));
  assert(out.n.at6 < 0 && out.n.in6 === 'yihao', 'the stage-1 campus as it stands puts V4 06 inside 一号教学楼 ' + JSON.stringify(out.n));
  assert(out.c.at6 < 0, 'c keeps V4 06 inside 一号教学楼: the walk cannot start where the film ends');
  checks.push(`compositions: b clears the film's walk by ${out.b.path.toFixed(1)} m and 06 by ${out.b.at6.toFixed(1)} m; a by ${out.a.path.toFixed(1)} / ${out.a.at6.toFixed(1)} m; the unturned campus puts V4's 06 eye ${(-out.n.at6).toFixed(1)} m inside ${out.n.in6} (n, c)`);
  // 05's view out of the crown: how high the skyline stands along its line of sight (the first 160 m)
  const sight = (S) => {
    const e = [S.f5.ex, S.f5.ey, S.f5.ez], y = (S.f5.yaw * Math.PI) / 180;
    let worst = { el: -90, id: null, t: 0 };
    for (let t = 1; t < 160; t += 0.5) {
      const x = e[0] + Math.sin(y) * t, z = e[2] + Math.cos(y) * t;
      for (const bd of S.model.buildings) {
        if (X.nearest({ near: () => [{ ...bd, hw: bd.w / 2, hd: bd.d / 2, c: Math.cos(bd.rot), s: Math.sin(bd.rot) }] }, x, z).d >= 0) continue;
        const el = (Math.atan2(G + bd.top - e[1], t) * 180) / Math.PI;
        if (el > worst.el) worst = { el, id: bd.id, t };
      }
    }
    return worst;
  };
  const sb = sight(B), sn = sight(build('n'));
  assert(sn.id === 'yihao' && sn.el > 25, '05 looks into 一号教学楼 with the campus unturned ' + JSON.stringify(sn));
  assert(sb.t > 2 * sn.t && sb.el < sn.el - 10, '05 looks further over the campus turned ' + JSON.stringify(sb));
  checks.push(`05's line of sight: as the data lies (n) ${sn.id} stands ${sn.el.toFixed(0)}° above the eye ${sn.t} m away (a wall); turned (b) the highest thing on the line is ${sb.id || 'nothing'}, ${sb.el.toFixed(1)}° above the eye at ${sb.t} m (the campus in the distance, not a wall)`);

  // ---------------------------------------------------------------- collision
  {
    const col = B.col, yh = B.model.buildings.find((b) => b.id === 'yihao');
    const c = Math.cos(yh.rot), s = Math.sin(yh.rot);
    // start 6 m outside the north face (local -Z), walk straight at it
    const lz = -(yh.d / 2 + 6);
    const sx = yh.cx + 0 * c + lz * s, sz = yh.cz - 0 * s + lz * c;
    const nx = -s * -1, nz = -c * -1;   // towards the building (local +Z)
    const m = X.move(col, sx, sz, nx * 12, nz * 12);
    assert(X.nearest(col, m.x, m.z).d > 0.31, 'stopped at the wall, not inside it');
    assert(m.hit === 'yihao', 'hit 一号教学楼');
    // walking diagonally along the wall slides
    const tx = c, tz = -s;   // local +X
    const m2 = X.move(col, m.x, m.z, (nx + tx) * 5, (nz + tz) * 5);
    const along = (m2.x - m.x) * tx + (m2.z - m.z) * tz;
    assert(along > 4, 'slides along the wall (' + along.toFixed(2) + ' m)');
    const fs1 = X.freeSpot(col, yh.cx, yh.cz);
    assert(fs1.moved > 0 && X.nearest(col, fs1.x, fs1.z).d >= 0.32, 'a spot inside a building moves to free ground');
    checks.push(`collision: walking at 一号教学楼 stops ${X.nearest(col, m.x, m.z).d.toFixed(2)} m from its (padded) wall and slides ${along.toFixed(1)} m along it; a spot inside it is moved ${fs1.moved.toFixed(1)} m to free ground`);
  }

  // ---------------------------------------------------------------- the turned campus is still one source with its plan
  {
    let same = 0;
    for (const b of B.model.buildings) {
      const f = B.geo.features.find((x) => x.id === b.id);
      near(b.rot, f.rot, 1e-12, b.id + ' rotation (turned)');
      if (b.form === 'corr' || b.id.startsWith('dorm_m_')) {
        const dx = b.cx - f.cx, dz = b.cz - f.cz, c = Math.cos(f.rot), s = Math.sin(f.rot);
        assert(Math.abs(dx * c - dz * s) <= f.hw + 1e-6 && Math.abs(dx * s + dz * c) <= f.hd + 1e-6, b.id + ' within its footprint (turned)');
        continue;
      }
      near(b.cx, f.cx, 1e-9, b.id + ' x'); near(b.cz, f.cz, 1e-9, b.id + ' z'); near(b.w, f.hw * 2, 1e-9, b.id + ' w'); near(b.d, f.hd * 2, 1e-9, b.id + ' d');
      same++;
    }
    const fr = B.geo.frame;
    for (const [x, z] of [[0, 0], [37, -12], [-120, 240]]) { const w = fr.toWorld(x, z), c = fr.toCampus(w.x, w.z); near(c.x, x, 1e-9, 'round trip x'); near(c.z, z, 1e-9, 'round trip z'); }
    near(fr.northYaw, 270, 1e-9, 'north heading with the campus turned 90°');
    const tree = B.geo.places.find((p) => p.id === 'lanshu');
    near(tree.x, 0, 1e-9, 'the tree stays at the root'); near(tree.z, 0, 1e-9, 'the tree stays at the root');
    const yb = B.geo.places.find((p) => p.id === 'yihao'), y0 = build('n').geo.places.find((p) => p.id === 'yihao');
    assert(yb.fromTree.bearing === y0.fromTree.bearing && Math.abs(yb.fromTree.distance - y0.fromTree.distance) < 1e-9, '一号教学楼 keeps its bearing and distance from the tree in campus terms');
    checks.push(`turned campus (b, 90°): ${same} buildings share centre, size and rotation with the plan's features; bridges stay in their footprints; frame round trip exact; the tree stays at the root; 一号教学楼 is still ${yb.fromTree.bearing} of the tree, ${yb.fromTree.distance.toFixed(1)} m (campus terms); north is heading ${fr.northYaw}°`);
  }

  // ---------------------------------------------------------------- the campus outside chapter 04
  {
    const b = CO.COMPOSITIONS.b, a = CO.COMPOSITIONS.a, c = CO.COMPOSITIONS.c;
    let prev = -1;
    for (let p = 2; p <= 5; p += 0.01) { const u = CO.campusAt(b, p); assert(u >= prev - 1e-12, 'b rises monotonically'); prev = u; }
    assert(CO.campusAt(b, 2.9) === 0 && CO.campusAt(b, 4) === 1 && CO.campusAt(b, 5) === 1, 'b: plan in 01–04, standing from 05');
    assert(CO.campusAt(b, 3, { pinned: true }) === 1 && CO.campusAt(b, 2.4, { pinned: true }) === 0, 'b: a campus left standing in 04 stays, and sinks on the way back to 03');
    assert(CO.campusAt(a, 4) === 0 && CO.campusAt(a, 4.47) > 0.97 && CO.campusAt(a, 5) === 1, 'a: no campus in 05, standing before the landing');
    assert(CO.campusAt(c, 5) === 0 && CO.campusAt(c, 5, { walking: true }) === 1, 'c: only for the walk');
    checks.push('campus beyond 04: b plan in 01–04, rises 04 → 05 (monotonic), stands in 05/06; a campus left standing in 04 stays standing and sinks only on the way back to 03; a stands before the landing; c only for the walk');
  }

  // ---------------------------------------------------------------- the skeleton
  {
    const st = K.angles({});
    near(st.hip, K.HIP, 1e-9, 'standing hip height');
    near(K.eyeOffset({}).up, CO.EYE_H, 1e-9, 'eye height = compose EYE_H');
    const cr = K.eyeOffset({ crouch: 1 });
    assert(cr.up < CO.EYE_H - 0.3, 'a full crouch lowers the eye by more than 30 cm');
    for (let ph = 0; ph < Math.PI * 4; ph += 0.1) { const a = K.angles({ phase: ph, amp: 1 }); assert(a.hip <= K.HIP + 1e-9 && a.hip > K.HIP - 0.08, 'walking keeps the hips within a few cm'); }
    checks.push(`skeleton: eye ${CO.EYE_H} m standing, ${cr.up.toFixed(2)} m in a full crouch; walking keeps the hips within 8 cm (the stance foot stays on the ground)`);
  }

  // ---------------------------------------------------------------- one owner of camera and input at a time
  {
    const ST = await mod('lanren/world/state.js');
    const fakeCam = { enabled: true }, fakeCanvas = { style: {} };
    const W = ST.createWorldState({ compose: CO.COMPOSITIONS.b, canvas: fakeCanvas, cam: fakeCam });
    const seen = [];
    W.on('owner', (o) => seen.push(o.prev + '→' + o.owner));
    assert(W.owner === 'scroll' && W.policy().scroll && W.policy().wheel === 'film', 'starts with the six-shot film');
    W.claim('hold'); W.claim('play');
    assert(!W.policy().scroll && W.policy().wheel === 'none' && fakeCam.enabled === false && fakeCanvas.style.touchAction === 'none', 'the walk locks the page, takes the touches, the wheel does nothing, V4\'s camera is off');
    W.claim('pocket'); assert(W.policy().wheel === 'pocket', 'the pocket map has the wheel');
    W.claim('play'); W.claim('map');
    assert(fakeCam.enabled === false, 'map.js manages its own camera hand-over');
    W.release('map');
    assert(W.owner === 'scroll' && fakeCam.enabled === true && fakeCanvas.style.touchAction === '', 'releasing gives the film back its scroll, touches and camera');
    assert.throws(() => W.claim('nobody'), /unknown owner/);
    let dest = null; W.on('destination', (d) => { dest = d; });
    W.setDestination('library'); assert(dest === 'library' && W.destination === 'library', 'destination announced');
    W.setDestination(null); assert(dest === null, 'destination cleared');
    for (const [k, pol] of Object.entries(ST.POLICY)) assert(typeof pol.scroll === 'boolean' && ['film', 'map', 'none', 'pocket', 'canopy', 'seventh'].includes(pol.wheel), k + ' policy complete');
    checks.push(`ownership: ${seen.join(' · ')}; every owner says whether the page scrolls, what the wheel means, who has the touches and V4's camera`);
  }

  for (const c of checks) console.log('✓ ' + c);
  fs.writeFileSync(path.join(__dirname, 'world-film-results.json'), JSON.stringify({ date: new Date().toISOString(), checks }, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
