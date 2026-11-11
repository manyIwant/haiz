// Node checks for the world's clock (lanren/world/clock.js) and an audit of the light it replaces.
//
// Part 1 · audit (what V4's six art-directed suns are, measured; nothing here can fail a build:
//          it is the evidence the clock answers, written to world-clock-results.json)
//   - the six shots' suns as compass bearings over this campus, against every real sun of the year
//   - how far and how many times back and forth the sun travels over the scroll
//   - how fast the sun moves inside the 05 → 06 film, which is a single take in a person's time
// Part 2 · the clock
//   - time never runs backwards over the scroll: neither the date nor the hour
//   - 05 → 06 is exactly the film's seconds; the sun moves as the real sun does in that time
//   - the sun is the ephemeris's, through the campus's compass (composition and campus bearing)
//   - the sun's heading turns one way through the whole day
//   - 06's sun is the one composition b was composed for, without being placed there
//   - looking at 06 lets the evening go on: monotonic, bounded, the lights follow the sun's height
//   - every reading is a pure function of (p, held): the same in any order, after any detour
//   - 06's standpoint derived from the last light puts the walker's shadow on the trunk
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const mod = (p) => import(pathToFileURL(path.join(root, p)).href);
const R2D = 180 / Math.PI, D2R = Math.PI / 180;
const wrap360 = (a) => ((a % 360) + 360) % 360;
const wrap = (a) => { a = wrap360(a); return a > 180 ? a - 360 : a; };
const vec = (az, el) => [Math.sin(az * D2R) * Math.cos(el * D2R), Math.sin(el * D2R), Math.cos(az * D2R) * Math.cos(el * D2R)];
const between = (a, b) => Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * R2D;

(async () => {
  const CH = await mod('lanren/js/chapters.js');
  const SUN = await mod('lanren/js/sun.js');
  const CO = await mod('lanren/world/compose.js');
  const F = await mod('lanren/world/film.js');
  const CK = await mod('lanren/world/clock.js');
  const tree = JSON.parse(fs.readFileSync(path.join(root, 'lanren/assets/tree.json'), 'utf8'));
  const B = CO.COMPOSITIONS.b;
  const audit = [], checks = [];

  // ------------------------------------------------------------------ part 1: the audit
  const north = CK.northHeading(B.rotation);
  // V4's sun at p, with composition b's turn of 06's sun (world.js light)
  const v4 = (p) => {
    const L = CH.lightAt(p);
    if (p > 4 && B.sun6 != null) { const f = Math.min(1, p - 4), t = f * f * f * (f * (f * 6 - 15) + 10); L.sunAz += wrap(B.sun6 - CH.LIGHT[5].sun[0]) * t; }
    return L;
  };
  // every real sun of the year over the campus (bearing, height), every 2 days and 4 minutes
  const real = [];
  for (let d = 1; d <= 365; d += 2) for (let m = 300; m <= 1200; m += 4) { const s = SUN.sunPosition(SUN.haikouToMs(2026, d, m)); if (s.altitude > 0) real.push([vec(s.bearing, s.altitude * R2D), d, m]); }
  const nearestReal = (bearing, el) => { const v = vec(bearing, el); let best = [1e9, 0, 0]; for (const r of real) { const a = between(v, r[0]); if (a < best[0]) best = [a, r[1], r[2]]; } return best; };
  const shots = CH.LIGHT.map((l, i) => {
    const az = i === 5 ? B.sun6 : l.sun[0], el = l.sun[1], bearing = wrap360(north - az), n = nearestReal(bearing, el), md = SUN.monthDayOf(n[1]);
    return { shot: '0' + (i + 1), worldAz: az, el, bearing: +bearing.toFixed(1), offReal: +n[0].toFixed(1), nearest: `${md.month}/${md.day} ${SUN.formatClock(n[2])}`, note: i === 2 ? 're-aimed at load on a leaf cluster (home.js aimStudy)' : '' };
  });
  const impossible = shots.filter((s) => s.offReal > 5);
  audit.push(`V4's six suns as bearings over the campus (composition b, campus north ${SUN.SITE.campusNorthBearing}°): ` + shots.map((s) => `${s.shot} ${s.bearing}°/${s.el}° (${s.offReal}° from any real sun)`).join(' · '));
  audit.push(`${impossible.length} of 6 stand where the sun never is at Haikou (more than 5° from every sun of the year): ${impossible.map((s) => s.shot).join(', ')}`);
  let travelled = 0, reversals = 0, dirPrev = 0, prev = null;
  for (let p = 0; p <= 5.0001; p += 0.01) { const a = v4(p).sunAz; if (prev != null) { const d = wrap(a - prev); travelled += Math.abs(d); const dir = Math.sign(d); if (dir && dirPrev && dir !== dirPrev) reversals++; if (dir) dirPrev = dir; } prev = a; }
  audit.push(`over the scroll V4's sun travels ${travelled.toFixed(0)}° of heading and turns back ${reversals} times (a real day: one way, at most ~230°)`);
  let v4Rate = 0;
  for (let q = 0; q < 1; q += 0.002) { const a = v4(4 + q), b = v4(4 + q + 0.002); v4Rate = Math.max(v4Rate, between(vec(a.sunAz, a.sunEl), vec(b.sunAz, b.sunEl)) / (0.002 * F.FILM_SECONDS)); }
  const w0 = v4(4 + F.PHASE.walk[0]), w1 = v4(4 + F.PHASE.walk[1]);
  audit.push(`inside the 05 → 06 film (${F.FILM_SECONDS.toFixed(1)} s, one take): V4's sun goes ${v4(4).sunAz.toFixed(0)}° → ${v4(5).sunAz.toFixed(0)}° and ${v4(4).sunEl.toFixed(1)}° → ${v4(5).sunEl.toFixed(1)}° up, at most ${v4Rate.toFixed(2)}°/s (${Math.round(v4Rate / (360 / 86400))}× the real sun); the shadows turn ${Math.abs(wrap(w1.sunAz - w0.sunAz)).toFixed(1)}° during the walk alone`);
  // the walker's shadow at V4's 06 does not reach the tree
  const s6 = B.shot6, trunk = tree.anchors.trunk;
  const dist6 = Math.hypot(s6.eye[0] - trunk[0], s6.eye[2] - trunk[2]);
  const shadowLen = (el) => 1.75 / Math.tan(el * D2R);
  audit.push(`at V4's 06 the walker stands ${dist6.toFixed(1)} m from the trunk and their shadow is ${shadowLen(CH.LIGHT[5].sun[1]).toFixed(1)} m long (sun ${CH.LIGHT[5].sun[1]}° up): it points at the tree and stops ${(dist6 - shadowLen(CH.LIGHT[5].sun[1])).toFixed(1)} m short of it`);
  audit.push(`the compass itself is an estimate: sun.js gives the campus's north as ${SUN.SITE.campusNorthBearing}° (23° west of north); campus.json's source note says the campus is turned about 41.4° from north; campus.json marks the orientation unverified`);

  // ------------------------------------------------------------------ part 2: the clock
  const C = CK.createClock({ rotation: B.rotation, filmSeconds: F.FILM_SECONDS });
  {
    let prevDay = -1, prevMin = -1, prevMs = -1;
    for (let p = 0; p <= 5.00001; p += 0.001) {
      const w = C.when(p);
      assert(w.dayOfYear >= prevDay - 1e-9, `the date runs backwards at p = ${p.toFixed(3)}`);
      assert(w.minutes >= prevMin - 1e-6, `the hour runs backwards at p = ${p.toFixed(3)}`);
      assert(w.ms >= prevMs, `time runs backwards at p = ${p.toFixed(3)}`);
      prevDay = w.dayOfYear; prevMin = w.minutes; prevMs = w.ms;
    }
    checks.push(`time never runs backwards over the scroll (date and hour, 5000 steps): ${[0, 1, 2, 3, 4, 5].map((p) => `0${p + 1} ${C.when(p).label}`).join(' · ')}`);
  }
  {
    const a = C.when(4), b = C.when(5);
    assert(Math.abs((b.ms - a.ms) / 1000 - F.FILM_SECONDS) < 1e-6, '05 → 06 lasts the film');
    for (const q of [0.1, 0.37, 0.5, 0.93]) assert(Math.abs((C.when(4 + q).ms - a.ms) / 1000 - q * F.FILM_SECONDS) < 1e-6, 'a second of the film is a second of the evening');
    const sa = C.sun(4), sb = C.sun(5), moved = between(vec(sa.sunAz, sa.sunEl), vec(sb.sunAz, sb.sunEl));
    assert(moved < 0.25, `the sun moves ${moved}° in the film`);
    checks.push(`05 → 06 is ${F.FILM_SECONDS.toFixed(1)} s of one evening, linearly; in it the sun moves ${moved.toFixed(2)}° (V4: ${between(vec(v4(4).sunAz, v4(4).sunEl), vec(v4(5).sunAz, v4(5).sunEl)).toFixed(1)}°)`);
  }
  {
    // the sun is the ephemeris's, through the compass
    for (const p of [0, 1, 2, 3, 4, 4.6, 5]) {
      const w = C.when(p), s = C.sun(p), e = SUN.sunPosition(w.ms);
      if (!w.dayFrac) {
        assert(Math.abs(wrap(s.sunAz - (north - e.bearing))) < 1e-6 && Math.abs(s.sunEl - e.altitude * R2D) < 1e-6, 'sun = ephemeris through the compass at p = ' + p);
        // the same thing as sun.js's own scene vector, turned with the campus (sunVector: +X east, −Z north)
        const v = SUN.sunVector(e.altitude, e.bearing), cr = Math.cos(B.rotation), sr = Math.sin(B.rotation);
        const turned = [v[0] * cr + v[2] * sr, v[1], -v[0] * sr + v[2] * cr];
        assert(between(turned, vec(s.sunAz, s.sunEl)) < 1e-4, 'the clock and sun.js sunVector agree at p = ' + p);
      }
    }
    // another composition, another compass: the bearing over the campus is the same, the world heading turns with it
    const Ca = CK.createClock({ rotation: 0, filmSeconds: F.FILM_SECONDS });
    assert(Math.abs(Ca.sun(5).bearing - C.sun(5).bearing) < 1e-9 && Math.abs(wrap(C.sun(5).sunAz - Ca.sun(5).sunAz) - 90) < 1e-6, 'the sun turns with the campus');
    checks.push('the sun is sun.js\'s ephemeris through the campus compass (agrees with sunVector to 0.0001°); turning the campus (a ↔ b) turns the sun with it');
  }
  {
    // one way round, all day; continuous
    let dirs = new Set(), worst = 0, prevS = null, total = 0;
    for (let p = 0; p <= 5.00001; p += 0.0005) {
      const s = C.sun(p);
      if (prevS) { const d = wrap(s.sunAz - prevS.sunAz); if (Math.abs(d) > 0.02) dirs.add(Math.sign(d)); total += Math.abs(d); worst = Math.max(worst, between(vec(s.sunAz, s.sunEl), vec(prevS.sunAz, prevS.sunEl))); }
      prevS = s;
      assert(s.sunEl > 3, 'the sun is up in every shot');
    }
    assert(dirs.size === 1, 'the sun turns one way through the day');
    assert(worst < 0.5, `the sun jumps ${worst}° between two samples`);
    checks.push(`the sun turns one way through the whole scroll (${total.toFixed(0)}° of heading, no reversal), never more than ${worst.toFixed(2)}° per 0.05 % of scroll`);
  }
  {
    // 06: the real sun stands where composition b was composed for it
    const s = C.sun(5);
    assert(Math.abs(wrap(s.sunAz - B.sun6)) < 0.5, `06's real sun is at ${s.sunAz}°, the composition's at ${B.sun6}°`);
    assert(Math.abs(s.sunEl - CH.LIGHT[5].sun[1]) < 0.5, `06's real sun is ${s.sunEl}° up`);
    checks.push(`06 (${C.when(5).label}): the real sun stands at ${s.sunAz.toFixed(1)}°, ${s.sunEl.toFixed(1)}° up — where composition b put its own (${B.sun6}°, ${CH.LIGHT[5].sun[1]}°), found by choosing the day rather than by moving the sun`);
  }
  {
    // 06 held: the evening goes on
    let prevMs = -1, prevEv = -1, prevEl = 99;
    const row = [];
    for (let h = 0; h <= 300; h += 0.25) {
      C.held = h; const a = C.at(5);
      assert(a.ms >= prevMs && a.evening >= prevEv - 1e-9 && a.sunEl <= prevEl + 1e-9, 'held: time, the lights and the sun go one way');
      assert(a.sunEl >= CK.LAST_LIGHT_EL - 0.01, 'the evening stops at the last light');
      prevMs = a.ms; prevEv = a.evening; prevEl = a.sunEl;
      if ([0, 3, 6, 12, 30, 120].includes(h)) row.push(`${h} s ${a.clock} sun ${a.sunEl.toFixed(1)}° lights ${Math.round(a.evening * 100)}%`);
    }
    C.held = 0;
    assert(C.at(5).evening === 0 && C.at(0).evening === 0, 'no lights at the film\'s last frame, none at dawn');
    checks.push('06 held, the evening goes on at the tree\'s pace and comes to rest at the last light: ' + row.join(' · '));
  }
  {
    // pure: any order, any detour
    const read = (p, h) => { C.held = h; const a = C.at(p); return [a.ms, a.sunAz, a.sunEl, a.evening].join(); };
    const want = read(5, 7.5);
    for (const [p, h] of [[0, 0], [3.3, 0], [4.5, 2], [5, 200], [4.95, 9], [1, 0]]) read(p, h);
    assert(read(5, 7.5) === want, 'the same (p, held) reads the same after any detour');
    // scrolling back out of 06 lets the held evening go, continuously
    let prevMs = Infinity;
    for (let p = 5; p >= 4.9; p -= 0.002) { C.held = 40; const w = C.when(p); assert(w.ms <= prevMs, 'scrolling back out of 06 runs the evening back'); prevMs = w.ms; }
    C.held = 40;
    assert(Math.abs((C.when(4.93).ms - C.when(4).ms) / 1000 - 0.93 * F.FILM_SECONDS) < 1e-6, 'below the last look the film is on its own clock again');
    C.held = 0;
    checks.push('every reading is a pure function of (p, held): same after any detour; scrolling back out of 06 runs the held evening back without a jump');
  }
  {
    // the standpoint derived from the last light (world.js frame6): the shadow reaches the trunk
    const last = C.lastLight();
    const t = trunk, e = s6.eye, have = Math.atan2(e[0] - t[0], e[2] - t[2]) * R2D, d = wrap(last.sunAz - have) * D2R;
    const x = e[0] - t[0], z = e[2] - t[2], eye = [t[0] + x * Math.cos(d) + z * Math.sin(d), t[2] - x * Math.sin(d) + z * Math.cos(d)];
    const r = Math.hypot(eye[0] - t[0], eye[1] - t[2]);
    assert(Math.abs(r - dist6) < 1e-9, 'the standpoint keeps its distance from the tree');
    // the shadow's line from the walker (away from the sun) passes the trunk's axis within its radius
    const sd = [-Math.sin(last.sunAz * D2R), -Math.cos(last.sunAz * D2R)];
    const miss = Math.abs((t[0] - eye[0]) * sd[1] - (t[2] - eye[1]) * sd[0]);
    const missV4 = (() => { const a = B.sun6 * D2R, v = [-Math.sin(a), -Math.cos(a)]; return Math.abs((t[0] - e[0]) * v[1] - (t[2] - e[2]) * v[0]); })();
    assert(miss < 0.05, `the last shadow misses the trunk by ${miss} m`);
    // the islet's rocks begin 8.5 m from the trunk (world.js ground): by the last light the shadow's head lies on them
    const ISLET = 8.5, len = shadowLen(last.sunEl);
    assert(len > dist6 - ISLET && len < dist6, `at the last light the shadow (${len} m) ends on the rocks at the tree's foot`);
    assert(Math.abs(d * R2D) < 6, `the standpoint turns ${d * R2D}° about the tree`);
    checks.push(`06's standpoint follows from the sun: turned ${(d * R2D).toFixed(1)}° about the trunk (same ${dist6.toFixed(1)} m), the walker's shadow lies on the trunk's axis at the last light (V4: passes ${missV4.toFixed(1)} m beside it) and is ${len.toFixed(1)} m long by then (V4: ${shadowLen(CH.LIGHT[5].sun[1]).toFixed(1)} m): its head lies on the rocks at the tree's foot, ${(dist6 - len).toFixed(1)} m from the trunk`);
  }

  {
    // a sun that stays put need not be re-rendered: over the film at 60 fps, how often the sun's part of
    // the two keys changes that make the renderer redo work (scene.js setStage envKey: the sky baked into
    // the environment map; section.js update shadowKey: the whole campus drawn again into its shadow map)
    const frames = Math.round(F.FILM_SECONDS * 60);
    const count = (sunAt) => {
      let env = 0, sh = 0, ek = '', sk = '';
      for (let i = 0; i <= frames; i++) {
        const p = 4 + i / frames, L = CH.lightAt(p), s = sunAt(p), d = vec(s.sunAz, s.sunEl);
        const e = [L.horizon[0], L.zenith[2], d[0], d[1]].map((v) => v.toFixed(2)).join(), k = d.map((v) => v.toFixed(3)).join();
        if (e !== ek) { env++; ek = e; } if (k !== sk) { sh++; sk = k; }
      }
      return { env, sh };
    };
    const before = count(v4), after = count((p) => C.sun(p));
    assert(after.sh <= 8 && after.sh * 20 < before.sh, `campus shadow map: ${before.sh} → ${after.sh}`);
    assert(after.env < before.env, `environment map: ${before.env} → ${after.env}`);
    checks.push(`cost of a moving sun, counted over the film at 60 fps (${frames} frames): the whole-campus shadow map is re-rendered for the sun ${before.sh}× with V4's light and ${after.sh}× with the clock's; the sky is re-baked into the environment map ${before.env}× and ${after.env}× (counts of key changes in the source's own keys, not a frame-rate measurement)`);
  }

  console.log('audit (V4\'s light, measured):');
  for (const a of audit) console.log('  · ' + a);
  for (const c of checks) console.log('✓ ' + c);
  fs.writeFileSync(path.join(__dirname, 'world-clock-results.json'), JSON.stringify({ date: new Date().toISOString(), audit, shots, checks }, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
