// Node checks for the seventh view (lanren/seventh/seat.js): the sun's seat.
//
// Everything the prototype says about the campus is computed here from the same data the page uses
// (assets/walk/campus.json through campus3d.js, lanren/assets/rosettes.bin, the clock's ephemeris):
//   - the way: at pull 0 the camera is the eye it started from; at pull 1 it is on the sun's ray, a dolly
//     zoom away (what is framed at the trunk keeps its size all the way; the lens only ever closes)
//   - the seat hides shadows: a 200 m shadow shows less than 0.25 m beside its caster from the seat, and
//     tens of metres a few degrees out of the light
//   - the six shots, as the light saw them: 01, 02, 03 were seen from places 一号教学楼 shades at their
//     own instants; 04, 05, 06 from places the sun reaches
//   - the morning: the school's shadow draws down off the tree from shot to shot
//   - the film's last day: the noon sun stands within 1.5° of the zenith (the seat is chapter 04's plan)
//   - the last light: the walker and the trunk are in one line of sight from the seat
//   - grade and growth: entering at 06 and leaving into 01 change nothing in the picture
//   - the picture begins behind the walker, never in front of the school
//   - it is all off unless asked for
// The model is the project's approximate campus and a concept tree; the campus's bearing is an estimate
// (lanren/js/sun.js). The results hold for that model, not for the surveyed site.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const mod = (p) => import(pathToFileURL(path.join(root, p)).href);
const R2D = 180 / Math.PI;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };

(async () => {
  const SEAT = await mod('lanren/seventh/seat.js');
  const CH = await mod('lanren/js/chapters.js');
  const CO = await mod('lanren/world/compose.js');
  const CK = await mod('lanren/world/clock.js');
  const F = await mod('lanren/world/film.js');
  const GEO = await mod('lanren/map/geo.js');
  const C3 = await mod('lanren/map/campus3d.js');
  const ST = await mod('lanren/world/state.js');
  const campus = JSON.parse(fs.readFileSync(path.join(root, 'assets/walk/campus.json'), 'utf8'));
  const tree = JSON.parse(fs.readFileSync(path.join(root, 'lanren/assets/tree.json'), 'utf8'));
  const ros = new Float32Array(fs.readFileSync(path.join(root, 'lanren/assets/rosettes.bin')).buffer.slice(0));
  const B = CO.COMPOSITIONS.b, GROUND = CO.GROUND_Y;
  const frame = GEO.makeFrame(campus, { rotation: B.rotation });
  const model = C3.buildCampus(campus, frame);
  const boxes = model.buildings.filter((b) => b.height > 3).map((b) => SEAT.boxOf(b, GROUND));
  const clock = CK.createClock({ rotation: B.rotation, filmSeconds: F.FILM_SECONDS });
  const trunk = tree.anchors.trunk;
  const s6 = CO.shot6Turned(B.shot6, clock.lastLight().sunAz, trunk);
  const gaze = norm(sub(s6.look, s6.eye));
  const from = { eye: s6.eye, dir: gaze, fov: s6.fov };
  const last = SEAT.lastLight(clock, B.rotation);
  const centre = [trunk[0] - 1.3, 9.9, trunk[2]], half = 14.2, subject = [trunk[0], 5, trunk[2]];
  const cam = (pull, o = {}) => SEAT.seatCamera({ from, sun: last.dir, centre, half, subject, pull, ...o });
  const checks = [], facts = {};

  // ------------------------------------------------------------------ the way
  {
    const c0 = cam(0);
    assert(Math.hypot(...sub(c0.eye, s6.eye)) < 1e-6 && Math.abs(c0.fov - s6.fov) < 1e-6, 'pull 0 is the eye the way starts from, with its own lens');
    const d0 = Math.hypot(...sub(c0.target, c0.eye)), g0 = norm(sub(c0.target, c0.eye));
    assert(dot(g0, gaze) > 1 - 1e-9 && d0 > 6, 'pull 0 looks where the walker looks');
    const c1 = cam(1);
    assert(Math.abs(c1.dist - SEAT.FAR) < 1e-6, 'pull 1 is the seat');
    const toEye = norm(sub(c1.eye, c1.target));
    assert(Math.acos(Math.min(1, dot(toEye, last.dir))) * R2D < 1e-6, 'the seat is on the sun\'s ray through the centre');
    let prevFov = 1e9, prevDist = 0, minY = 1e9;
    for (let u = 0; u <= 1.0001; u += 0.01) {
      const c = cam(Math.min(1, u));
      assert(c.fov <= prevFov + 1e-9 && c.dist >= prevDist - 1e-9, 'the lens only closes and the eye only recedes, at pull ' + u.toFixed(2));
      // the dolly zoom: what the frame holds at the target keeps the size the way gives it (no jump)
      assert(Math.abs(Math.tan((c.fov / 2) / R2D) * c.dist - c.half) < 1e-6, 'framed height is the dolly zoom\'s at pull ' + u.toFixed(2));
      assert(c.near >= 0.08 && c.near < c.dist && c.far > c.dist + 600, 'the depth holds the campus at pull ' + u.toFixed(2));
      prevFov = c.fov; prevDist = c.dist; minY = Math.min(minY, c.eye[1]);
    }
    assert(minY > GROUND + 0.8, 'the eye never goes under the ground on the way: lowest ' + minY.toFixed(2));
    facts.way = { fov0: s6.fov, fovSeat: +cam(1).fov.toFixed(4), far: SEAT.FAR, lowestEye: +(minY - GROUND).toFixed(2) };
    checks.push(`the way: from the walker's eye (${s6.fov}° lens) to the seat ${SEAT.FAR / 1000} km off on the sun's ray (${cam(1).fov.toFixed(3)}° lens); the lens only closes, the eye only recedes, never lower than ${(minY - GROUND).toFixed(1)} m above the ground`);
  }

  // ------------------------------------------------------------------ shadows hide behind what casts them
  {
    // a caster 20 m off the axis, its shadow 200 m long (the tree's at the last light is about 195 m)
    const c1 = cam(1);
    const r = norm([last.dir[2], 0, -last.dir[0]]), at = [centre[0] + r[0] * 20, centre[1], centre[2] + r[2] * 20];
    const seatOff = SEAT.offLight(sub(c1.eye, at), last.dir);
    const shown = SEAT.shadowShown(200, seatOff);
    assert(shown < 0.25, 'from the seat a 200 m shadow shows ' + shown.toFixed(3) + ' m');
    const lean = cam(1, { lean: [7 / R2D, 0] });
    const leanOff = SEAT.offLight(sub(lean.eye, lean.target), last.dir) * R2D;
    const shownLean = SEAT.shadowShown(200, leanOff / R2D);
    assert(leanOff > 6.5 && leanOff < 7.5 && shownLean > 20, `leaning 7° shows ${shownLean.toFixed(1)} m of it`);
    // at the walker's own eye (pull 0) the same shadow shows far more than at the seat: perspective is the difference
    const c0 = cam(0), eyeOff = SEAT.offLight(sub(c0.eye, at), last.dir);
    assert(SEAT.shadowShown(200, eyeOff) > 50, 'from the walker\'s own eye the off-axis shadow is plain');
    facts.shadows = { atSeat: +shown.toFixed(3), leaning7: +shownLean.toFixed(1), fromTheEye: +SEAT.shadowShown(200, eyeOff).toFixed(1) };
    checks.push(`shadows: a 200 m shadow of a thing 20 m off the axis shows ${shown.toFixed(2)} m from the seat, ${shownLean.toFixed(0)} m leaning 7° out of the light, ${SEAT.shadowShown(200, eyeOff).toFixed(0)} m from the walker's own eye`);
  }

  // ------------------------------------------------------------------ the six shots, as the light saw them
  let shots;
  {
    const stations = [0, 1, 2, 3, 4, 5].map((i) => { const f = CH.poseAt(i); return [f.ex, f.ey, f.ez]; });
    stations[0] = s6.eye; stations[5] = s6.eye;              // (?world=1: 01 stands where 06 stands)
    const leafOn = (i, doy) => { const g = SEAT.growOn(doy, CH.GROW), tE = ros[i + 9], old = ros[i + 10]; return old > 0 ? g < old : g > tE - 0.035; };
    shots = SEAT.sixShots({ clock, stations, boxes, ros, stride: tree.rosetteStride, leafOn, rotation: B.rotation });
    for (const i of [0, 1, 2]) assert(shots[i].shadedBy === 'yihao' && !shots[i].seen, `shot 0${i + 1} was seen from a place in 一号教学楼's shadow at its instant`);
    for (const i of [3, 4, 5]) assert(!shots[i].shadedBy && shots[i].seen, `shot 0${i + 1} was seen from a place the sun reaches`);
    // V4's own 01 eye (without ?world=1) is in that shadow too
    const v4 = CH.KEYS[0].eye;
    assert(SEAT.shadedBy(v4, shots[0].dir, boxes)?.id === 'yihao', 'V4\'s own 01 eye is in the same shadow');
    facts.shots = shots.map((s) => ({ shot: s.index + 1, instant: s.label, sunEl: +s.sunEl.toFixed(1), shadedBy: s.shadedBy, leavesBetween: s.leaves, seen: s.seen }));
    checks.push('the six shots: ' + shots.map((s) => `0${s.index + 1} ${s.label} ${s.seen ? 'in the light' : 'in ' + (s.shadedBy === 'yihao' ? '一号教学楼' : s.shadedBy) + '\'s shadow'}`).join(' · '));
  }

  // ------------------------------------------------------------------ the morning: the school's shadow draws down off the tree
  {
    const top = tree.crown.top;
    const edges = shots.slice(0, 3).map((s) => SEAT.shadowEdgeAbove(trunk[0], trunk[2], s.dir, boxes, GROUND));
    assert(edges[0] > top && edges[0] < top + 8, `at 01 the shadow's edge passes over the whole crown: ${edges[0].toFixed(1)} m (crown top ${top} m)`);
    assert(edges[1] < top && edges[1] > 8 && edges[2] < edges[1] && edges[2] > 3, `it comes down the tree: ${edges.map((e) => e.toFixed(1)).join(' → ')}`);
    // the foot of the trunk: only once the sun is high
    let foot = null;
    for (let m = 420; m < 800 && !foot; m += 1) { const i = SEAT.instantAt(SEAT.SPRING[0], m, B.rotation); if (!SEAT.shadedBy([trunk[0], GROUND + 0.6, trunk[2]], i.dir, boxes)) foot = i; }
    assert(foot && foot.sunEl > 50, 'the trunk\'s foot is reached only with the sun above 50°: ' + foot?.sunEl.toFixed(1));
    // at 01 the standpoint is under the shadow's edge as well
    const overStand = SEAT.shadowEdgeAbove(s6.eye[0], s6.eye[2], shots[0].dir, boxes, GROUND);
    assert(overStand > 10, 'at 01 the shadow\'s edge passes ' + overStand.toFixed(1) + ' m over the standpoint');
    facts.morning = { edgeOverTrunk: edges.map((e) => +e.toFixed(1)), crownTop: top, edgeOverStandAt01: +overStand.toFixed(1), trunkFootLitFrom: foot.label, atSunEl: +foot.sunEl.toFixed(1) };
    checks.push(`the morning: the edge of 一号教学楼's shadow stands ${edges[0].toFixed(1)} m over the trunk at 01 (crown top ${top} m; ${overStand.toFixed(1)} m over the standpoint), ${edges[1].toFixed(1)} m at 02, ${edges[2].toFixed(1)} m at 03; the trunk's foot is reached at ${foot.clock} on the first day, the sun ${foot.sunEl.toFixed(0)}° up`);
  }

  // ------------------------------------------------------------------ the last day's noon: no shadows; chapter 04's plan
  {
    const n = SEAT.noonOf(SEAT.SPRING[1], B.rotation);
    assert(n.sunEl > 88.5, 'on the film\'s last day the noon sun is ' + n.sunEl.toFixed(2) + '° up');
    const c = SEAT.seatCamera({ from, sun: n.dir, centre, half, subject, pull: 1 });
    assert(Math.abs(dot(c.up, SEAT.PLAN_UP)) > 0.999, 'looking down, the picture keeps the plan\'s north');
    // chapter 04's own camera looks towards -Z too
    const k4 = CH.KEYS.find((k) => k.t === 3), d4 = norm([k4.look[0] - k4.eye[0], 0, k4.look[2] - k4.eye[2]]);
    assert(dot(d4, SEAT.PLAN_UP) > 0.99, 'chapter 04\'s plan has the same side up');
    const tallest = Math.max(...model.buildings.map((b) => b.height));
    facts.noon = { instant: n.label, sunEl: +n.sunEl.toFixed(2), longestShadow: +(tallest / Math.tan(n.sunEl / R2D)).toFixed(2) };
    checks.push(`the last day's noon: ${n.label}, the sun ${n.sunEl.toFixed(2)}° up; the tallest building (${tallest} m) has a shadow ${(tallest / Math.tan(n.sunEl / R2D)).toFixed(2)} m long; the seat's picture has chapter 04's north`);
  }

  // ------------------------------------------------------------------ the last light: one line of sight
  {
    const c1 = cam(1), r = norm([last.dir[2], 0, -last.dir[0]]);
    const lat = (p) => dot(sub(p, c1.target), r);
    const person = lat(s6.eye), trk = lat([trunk[0], 0, trunk[2]]);
    assert(Math.abs(person - trk) < 0.6, `from the seat the walker stands ${Math.abs(person - trk).toFixed(2)} m beside the trunk's line`);
    // and the school is behind both: the ray from the trunk away from the sun meets 一号教学楼
    const back = last.dir.map((v) => -v);
    const hit = SEAT.shadedBy([trunk[0], 6, trunk[2]], [back[0], 0, back[2]].map((v) => v / Math.hypot(back[0], back[2])), boxes);
    assert(hit && hit.id === 'yihao', 'behind the tree on that line stands 一号教学楼');
    facts.lastLight = { instant: last.label, sunEl: +last.sunEl.toFixed(2), walkerBesideTrunkLine: +Math.abs(person - trk).toFixed(2), schoolBehind: +hit.t.toFixed(1) };
    checks.push(`the last light (${last.label}, ${last.sunEl.toFixed(1)}°): from the seat the walker is ${Math.abs(person - trk).toFixed(2)} m from the trunk's line; 一号教学楼 stands ${hit.t.toFixed(1)} m behind the trunk on it`);
  }

  // ------------------------------------------------------------------ grade and growth: no seam going in, none coming out
  {
    const els = shots.map((s) => s.sunEl);
    els[5] = CK.solarAt(CK.whenAt(5, { held: 0, filmSeconds: F.FILM_SECONDS }), B.rotation).sunEl;
    const noon = (s) => SEAT.daylight(s.doy).noon;
    assert(SEAT.gradeP(last.sunEl, last.minutes, noon(last), els) === 5, 'at the last light the grade is 06\'s own');
    assert(SEAT.gradeP(shots[0].sunEl, shots[0].minutes, noon(shots[0]), els) === 0, 'at 01\'s instant the grade is 01\'s own');
    for (const i of [1, 2, 3]) assert(Math.abs(SEAT.gradeP(shots[i].sunEl, shots[i].minutes, noon(shots[i]), els) - i) < 1e-6, `at 0${i + 1}'s instant the grade is 0${i + 1}'s own`);
    // continuous across a whole day
    let prev = null;
    for (let m = SEAT.daylight(SEAT.SPRING[1]).first; m <= SEAT.daylight(SEAT.SPRING[1]).last; m += 1) {
      const i = SEAT.instantAt(SEAT.SPRING[1], m, B.rotation), p = SEAT.gradeP(i.sunEl, i.minutes, SEAT.daylight(SEAT.SPRING[1]).noon, els);
      if (prev != null) assert(Math.abs(p - prev) < 0.12, 'the grade moves without a jump through the day, at minute ' + m);
      prev = p;
    }
    CK.TIMELINE.forEach((k) => { const d = (new Date(Date.UTC(2026, k.month - 1, k.day)) - new Date(Date.UTC(2026, 0, 1))) / 86400000 + 1; assert(Math.abs(SEAT.growOn(d, CH.GROW) - CH.GROW[k.p]) < 1e-9, 'growth on shot ' + k.p + '\'s day is the shot\'s'); });
    assert(SEAT.growOn(SEAT.SPRING[1], CH.GROW) === CH.growAt(5) && SEAT.growOn(SEAT.SPRING[0], CH.GROW) === CH.growAt(0), 'growth at the ends is the film\'s');
    for (const [d, m] of [[0, 0], [400, 3000], [100, 100]]) { const k = SEAT.clampInstant(d, m), day = SEAT.daylight(k.doy); assert(k.doy >= SEAT.SPRING[0] && k.doy <= SEAT.SPRING[1] && k.minutes >= day.first && k.minutes <= day.last, 'an instant is kept inside the spring and its daylight'); }
    checks.push('no seam: entering at 06 the grade is 06\'s and the growth 06\'s; leaving into 01 they are 01\'s; through a day the grade never jumps');
  }

  // ------------------------------------------------------------------ where the picture begins
  {
    const yh = boxes.find((b) => b.id === 'yihao'), keep = [s6.eye];
    const c = Math.cos(yh.rot), s = Math.sin(yh.rot);
    for (let lx = -yh.hw; lx <= yh.hw + 0.01; lx += 3) for (const lz of [-yh.hd, yh.hd]) for (const y of [yh.y1, GROUND]) keep.push([yh.cx + lx * c + lz * s, y, yh.cz - lx * s + lz * c]);
    const dusk = cam(1, { keep }), toEye = norm(sub(dusk.eye, dusk.target));
    const walkerDepth = dot(sub(s6.eye, dusk.target), toEye);
    assert(dusk.margin > walkerDepth + 3 && dusk.margin < walkerDepth + 12, `at the last light the picture begins ${(dusk.margin - walkerDepth).toFixed(1)} m behind the walker`);
    const dawn = SEAT.seatCamera({ from, sun: shots[0].dir, centre, half, subject, pull: 1, keep }), te = norm(sub(dawn.eye, dawn.target));
    // every part of the school the frame holds is inside the picture's depth
    const r = norm([te[2], 0, -te[0]]);
    let deepest = -1e9;
    for (const p of keep.slice(1)) { const q = sub(p, dawn.target); if (Math.abs(dot(q, r)) <= dawn.half * (16 / 9)) deepest = Math.max(deepest, dot(q, te)); }
    assert(dawn.margin > deepest, 'at 01\'s instant the picture begins behind the school (it is the school the sun sees)');
    facts.begins = { dusk: +dusk.margin.toFixed(1), behindWalker: +(dusk.margin - walkerDepth).toFixed(1), dawn: +dawn.margin.toFixed(1) };
    checks.push(`the picture begins ${(dusk.margin - walkerDepth).toFixed(1)} m behind the walker at the last light, and behind 一号教学楼 at 01's instant (${dawn.margin.toFixed(0)} m from the centre)`);
  }

  // ------------------------------------------------------------------ off unless asked for
  {
    const home = fs.readFileSync(path.join(root, 'lanren/js/home.js'), 'utf8');
    assert(/const seventhOn = flag\('seventh'\)/.test(home) && /if \(seventhOn && !seventh\)/.test(home), 'home.js loads the seventh view only with its flag');
    assert(ST.POLICY.seventh && ST.POLICY.seventh.scroll === false && ST.POLICY.seventh.v4cam === false, 'the seventh view is an owner of its own: the page does not scroll, V4\'s camera rests');
    const scene = fs.readFileSync(path.join(root, 'lanren/js/scene.js'), 'utf8');
    assert(/uSkip: \{ value: 0 \}, uOppose: \{ value: 0 \}/.test(scene) && /uShade: \{ value: 0 \}/.test(scene), 'the atmosphere\'s new terms rest at zero');
    const fol = fs.readFileSync(path.join(root, 'lanren/js/foliage.js'), 'utf8');
    assert(/uCone: \{ value: new THREE\.Vector4\(0, 0, 0, 0\) \}/.test(fol), 'the slow-light study rests at zero');
    checks.push('off unless asked for: home.js loads lanren/seventh only with ?seventh=1; the atmosphere\'s and the leaves\' new terms rest at zero');
  }

  for (const c of checks) console.log('✓ ' + c);
  fs.writeFileSync(path.join(__dirname, 'seventh-results.json'), JSON.stringify({ facts, checks }, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
