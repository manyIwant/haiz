// HAIZ · 校园活着 — Node checks for the campus's paths and the people's days (lanren/life/{nav,places,people,life}.js).
//   node tests/life/life.cjs
// Uses tests/fixtures/life-colliders.json (the walk's colliders as ruhua.html builds them in the browser).
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const results = [];
const check = (name, fn) => { try { const note = fn(); results.push({ name, ok: true, note }); console.log('ok  ', name, note ? '— ' + note : ''); } catch (e) { results.push({ name, ok: false, error: e.message }); console.log('FAIL', name, '—', e.message); } };

(async () => {
  const imp = (p) => import(path.join(__dirname, '../../', p));
  const { buildGeo } = await imp('lanren/map/geo.js');
  const { buildNav, polylineLength } = await imp('lanren/life/nav.js');
  const { PLACES, SPOTS, SHELTERS, placePoint } = await imp('lanren/life/places.js');
  const { PEOPLE } = await imp('lanren/life/people.js');
  const { createLife } = await imp('lanren/life/life.js');
  const campus = JSON.parse(fs.readFileSync(path.join(__dirname, '../../assets/walk/campus.json')));
  const col = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/life-colliders.json')));
  const geo = buildGeo(campus, null, { rotation: 0 });
  const t0 = Date.now();
  const nav = buildNav({ colliders: col, features: geo.features, bounds: { x0: -300, x1: 200, z0: -140, z1: 300 } });
  const buildMs = Date.now() - t0;
  const H = 3600000;
  const dayAt = (y, m, d) => Date.UTC(y, m - 1, d) - 8 * H;          // Haikou midnight
  const TUE = dayAt(2026, 11, 17), SAT = dayAt(2026, 11, 21), SUN = dayAt(2026, 11, 22);

  check('nav grid builds from the walk\'s colliders', () => { assert(nav.nx * nav.nz > 200000); return `${nav.nx}×${nav.nz} cells in ${buildMs} ms`; });

  check('every door and spot is reachable from the old tree', () => {
    const keys = [...Object.keys(PLACES).flatMap((k) => PLACES[k].doors.map((_, i) => [k, i])), ...Object.keys(SPOTS).map((k) => [k, 0])];
    const bad = keys.filter(([k, i]) => { const p = placePoint(k, i); return !nav.path(-1.5, -8.2, p.x, p.z); });
    assert.deepStrictEqual(bad, []);
    return `${keys.length} places`;
  });

  check('paths never cross a wall, a pond or a trunk (sampled every 10 cm)', () => {
    const pairs = [['dorm_f', 'canteen3'], ['canteen3', 'yihao'], ['dorm_m', 'canteen1'], ['canteen1', 'erhao'], ['kexue', 'yihao'], ['yihao', 'library'], ['beimen_out', 'kexue'], ['yihao', 'garden_a'], ['erhao', 'court_a'], ['yihao', 'tree_e']];
    let n = 0;
    for (const [a, b] of pairs) {
      const A = placePoint(a), B = placePoint(b);
      const p = nav.path(A.x, A.z, B.x, B.z);
      assert(p, `no path ${a} → ${b}`);
      for (let i = 1; i < p.points.length; i++) {
        const P0 = p.points[i - 1], P1 = p.points[i], L = Math.hypot(P1.x - P0.x, P1.z - P0.z);
        for (let s = 0; s <= L; s += 0.1) {
          const x = P0.x + (P1.x - P0.x) * (s / L || 0), z = P0.z + (P1.z - P0.z) * (s / L || 0);
          // the first/last metre may sit in a door's snapped cell against the wall
          if ((i === 1 && s < 1.2) || (i === p.points.length - 1 && L - s < 1.2)) continue;
          assert(nav.isFree(x, z), `${a} → ${b} crosses a solid at (${x.toFixed(1)}, ${z.toFixed(1)})`);
          n++;
        }
      }
    }
    return `${n} samples`;
  });

  check('the paths keep to the 校道: most of a long walk is on surveyed paths and courts', () => {
    const A = placePoint('dorm_f'), B = placePoint('yihao', 1);
    const p = nav.path(A.x, A.z, B.x, B.z);
    let on = 0, all = 0;
    for (let i = 1; i < p.points.length; i++) {
      const P0 = p.points[i - 1], P1 = p.points[i], L = Math.hypot(P1.x - P0.x, P1.z - P0.z);
      for (let s = 0; s < L; s += 0.5) { const k = nav.surfaceAt(P0.x + (P1.x - P0.x) * s / L, P0.z + (P1.z - P0.z) * s / L); all++; if (k === 'road' || k === 'court' || k === 'field' || k === 'corridor') on++; }
    }
    assert(on / all > 0.6, `only ${(100 * on / all).toFixed(0)}% on paths`);
    return `${(100 * on / all).toFixed(0)}% on paths, ${polylineLength(p.points).toFixed(0)} m`;
  });

  const simulate = (life, start, hours, step = 20, rainFn = null, setRain = null) => {
    const prev = {}, stats = {};
    for (const a of life.agents) stats[a.id] = { maxV: 0, blocked: 0, outdoorMin: 0, jumps: 0 };
    for (let t = 0; t <= hours * 3600; t += step) {
      const ms = start + t * 1000;
      if (rainFn) setRain(rainFn(t / 3600));
      life.update(ms);
      for (const a of life.agents) {
        const s = a.state, p = prev[a.id], st = stats[a.id];
        const out = !s.inside && !s.away;
        if (out) { st.outdoorMin += step / 60; if (!nav.isFree(s.x, s.z) && s.act !== 'laps') st.blocked++; }
        if (p && out && !p.inside && !p.away) {
          const v = Math.hypot(s.x - p.x, s.z - p.z) / step;
          st.maxV = Math.max(st.maxV, v);
          if (v > a.person.run * 1.15 + 0.2) st.jumps++;
        }
        prev[a.id] = s;
      }
    }
    return stats;
  };

  check('a weekday: everyone moves at their own pace, never through a wall, never jumps', () => {
    let raining = false;
    const life = createLife({ nav, isRaining: () => raining });
    const st = simulate(life, TUE + 6 * H, 17, 20);
    for (const p of PEOPLE) {
      const s = st[p.id];
      assert.strictEqual(s.jumps, 0, `${p.name} jumped`);
      assert.strictEqual(s.blocked, 0, `${p.name} stood in a solid ${s.blocked} times`);
      assert(s.maxV <= p.run * 1.15 + 0.05, `${p.name} moved at ${s.maxV.toFixed(2)} m/s`);
    }
    return PEOPLE.map((p) => `${p.name} ${st[p.id].outdoorMin.toFixed(0)} min outdoors`).join(', ');
  });

  check('the day has its rhythm: 课间操 on the field, lunch in a canteen, 晚自习 indoors, asleep at night', () => {
    const life = createLife({ nav, isRaining: () => false });
    const at = (id, h) => life.stateOf(id, TUE + h * H);
    assert.strictEqual(at('lin', 9.75).act, 'exercise');
    assert.strictEqual(at('chen', 9.75).act, 'exercise');
    assert(at('lin', 12.55).place === 'canteen3' && at('lin', 12.55).inside, 'Lin lunches in 第三食堂');
    assert(at('chen', 20).inside && at('chen', 20).place === 'erhao', 'Chen at 晚自习 in 二号楼');
    for (const p of PEOPLE) { const s = at(p.id, 23.5); assert(s.inside || s.away, `${p.name} outdoors at 23:30`); }
    assert.strictEqual(at('fu', 10.2).place, 'yihao');
    return 'ok';
  });

  check('the same minute is the same for every visitor (deterministic)', () => {
    const a = createLife({ nav, isRaining: () => false }), b = createLife({ nav, isRaining: () => false });
    for (const h of [7.2, 9.6, 12.71, 16.95, 18.4]) {
      const ms = TUE + h * H;
      for (const p of PEOPLE) { const x = a.stateOf(p.id, ms), y = b.stateOf(p.id, ms); assert(Math.abs(x.x - y.x) < 1e-9 && Math.abs(x.z - y.z) < 1e-9, `${p.name} at ${h}`); }
    }
    return '5 moments × 5 people';
  });

  check('rain starting at 12:36 re-plans without anyone jumping; they go to shelter or indoors', () => {
    let raining = false;
    const life = createLife({ nav, isRaining: () => raining });
    const st = simulate(life, TUE + 12.4 * H, 1.2, 5, (h) => h > 0.2, (v) => { raining = v; });
    for (const p of PEOPLE) assert.strictEqual(st[p.id].jumps, 0, `${p.name} jumped when the rain came`);
    const lin = life.stateOf('lin', TUE + 13.1 * H);
    assert(lin.inside || /连廊|檐下|亭/.test(lin.label || '') , `Lin in the rain at ${lin.label}`);
    const wu = life.stateOf('wu', TUE + 15.0 * H);
    assert(wu.inside || wu.place === 'yanlin_ting' || wu.act === 'walk', `Wu in the rain: ${wu.place}`);
    return `Lin: ${lin.label} · ${lin.what}`;
  });

  check('weekends are different: the teacher is away on Saturday, Sunday brings the boarders back for 晚自习', () => {
    const life = createLife({ nav, isRaining: () => false });
    assert(life.stateOf('fu', SAT + 10 * H).away);
    assert.strictEqual(life.stateOf('wang', SAT + 10 * H).place, 'library');
    assert(life.stateOf('lin', SUN + 11 * H).away);
    assert(life.stateOf('lin', SUN + 20 * H).inside);
    return 'ok';
  });

  check('footprints for the map come from the same day (stride, sides alternate)', () => {
    const life = createLife({ nav, isRaining: () => false });
    // the end of a walk of hers after lunch
    let t = TUE + 12.4 * H; while (life.stateOf('lin', t).act !== 'walk' && t < TUE + 14 * H) t += 10000;
    while (life.stateOf('lin', t).act === 'walk') t += 5000;
    const steps = life.steps(PEOPLE.find((p) => p.id === 'lin'), t, 120);
    assert(steps.length > 40, `${steps.length} steps`);
    for (let i = 1; i < steps.length; i++) assert.notStrictEqual(steps[i].side, steps[i - 1].side);
    return `${steps.length} steps in two minutes`;
  });

  const ok = results.every((r) => r.ok);
  fs.writeFileSync(path.join(__dirname, 'life-results.json'), JSON.stringify({ date: new Date().toISOString(), ok, results }, null, 2));
  console.log(ok ? `\n${results.length}/${results.length} passed` : `\n${results.filter((r) => !r.ok).length} failed`);
  process.exit(ok ? 0 : 1);
})();
