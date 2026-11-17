// HAIZ · 校园的一天 — where everyone is, at any minute (pure; Node-testable).
//
// A person's day (lanren/life/people.js) is a list of blocks: be at a place, leave it at a time. Between
// two blocks they walk (or run) the campus path (lanren/life/nav.js) at their own pace, leaving when the
// last block ends (give or take a minute). So a position is a function of the clock: open the page at
// 12:41 and 林知夏 is on her way from 第三食堂 to the 植物园, exactly as far along as she would be for
// anyone else opening it then. Only the walk that spans "now" needs a path, and paths are cached.
//
// The weather changes the plan: when rain starts (or stops), each day is planned again from that
// minute, and whoever was outdoors walks from where they actually were to wherever the new plan sends
// them (shelter, a door) — nobody jumps. 10-minute breaks between periods take some students outside for
// a few minutes, on a coin seeded by the date and the period.
//
// The 3D layer (lanren/life/npc.js) and the map (lanren/life/map.js) both read this. When a person is
// near the player their body walks the same path; while it does, its real position and footsteps are
// what the map shows (agent.live).
import { PEOPLE, PERIODS, ROUTES, fieldSpot, ACT_LABEL } from './people.js';
import { placePoint, PLACES, labelOf, nearestDoor } from './places.js';
import { pointAt, polylineLength } from './nav.js';

const TZ = 8;
const H = 3600000;
export function clockOf(ms) {
  const t = new Date(ms + TZ * H);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), dow: t.getUTCDay(), hours: t.getUTCHours() + t.getUTCMinutes() / 60 + t.getUTCSeconds() / 3600 };
}
const midnight = (ms) => { const c = clockOf(ms); return Date.UTC(c.y, c.m - 1, c.d) - TZ * H; };
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rngOf(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** where a block happens: a point (and a route for walking activities) */
export function blockPoint(b) {
  const k = b.place;
  if (k.startsWith('field:')) return { ...fieldSpot(k), inside: false };
  if (ROUTES[k]) { const r = ROUTES[k]; return { x: r[0][0], z: r[0][1], yaw: null, inside: false, route: r.map(([x, z]) => ({ x, z })), label: k.startsWith('sweep') ? '扫落叶' : '浇花' }; }
  if (k === 'track_s' && b.act === 'laps') return { ...placePoint('track_s'), laps: true };
  return placePoint(k, b.door || 0);
}

export function createLife({ nav, people = PEOPLE, isRaining = () => false }) {
  const paths = new Map();
  function pathBetween(a, b, wet) {
    const key = `${a.x.toFixed(1)},${a.z.toFixed(1)}>${b.x.toFixed(1)},${b.z.toFixed(1)}:${wet ? 1 : 0}`;
    if (!paths.has(key)) {
      const p = nav.path(a.x, a.z, b.x, b.z, { wet });
      paths.set(key, p ? p.points : [{ x: a.x, z: a.z }, { x: b.x, z: b.z }]);
      if (paths.size > 600) paths.delete(paths.keys().next().value);
    }
    return paths.get(key);
  }

  // where a block happens, on walkable ground: spots snapped to the nearest free cell, activity routes
  // (sweeping, watering) walked along the campus paths between their waypoints
  const points = new Map();
  function pointOf(b) {
    const key = b.place + '#' + (b.door || 0) + ':' + b.act;
    if (!points.has(key)) {
      const p = { ...blockPoint(b) };
      if (!p.inside && !p.laps) { const sn = nav.snap(p.x, p.z, 3); if (sn) { p.x = sn.x; p.z = sn.z; } }
      if (p.route) {
        const r = [];
        for (let i = 1; i < p.route.length; i++) { const seg = pathBetween(p.route[i - 1], p.route[i], false); r.push(...(r.length ? seg.slice(1) : seg)); }
        p.route = r; p.x = r[0].x; p.z = r[0].z;
      }
      points.set(key, p);
    }
    return points.get(key);
  }

  // ---------------------------------------------------------------- one person's day
  const days = new Map();          // person.id → { key, base, blocks, legs: [], bridge }
  function planDay(person, ms, rain, prev = null) {
    const c = clockOf(ms), base = midnight(ms);
    const dateKey = `${c.y}-${c.m}-${c.d}`;
    const rng = rngOf(hash(person.id + dateKey));
    let blocks = person.plan({ dow: c.dow, rain, rng, hourNow: c.hours }).map((b) => ({ ...b }));
    blocks = expandBreaks(person, blocks, rng, dateKey);
    blocks.sort((a, b) => a.at - b.at);
    for (const b of blocks) {
      b.pt = pointOf(b);
      // departures wander a minute or two (except the bell-bound)
      const jitter = b.act === 'class' || b.act === 'teach' || b.act === 'break' ? 0 : (rng() - 0.3) * 0.03;
      b.atMs = base + b.at * H; b.untilMs = base + Math.max(b.at, b.until + jitter) * H;
    }
    const day = { key: dateKey + (rain ? ':rain' : ''), dateKey, rain, base, blocks, legs: new Map(), bridge: null };
    if (prev) {
      // re-planned mid-day: walk from where the old plan had them to the new plan's next place
      const T0 = Math.min(ms, base + 24 * H - 1);
      const was = stateIn(person, prev, T0);
      let k = blocks.findIndex((b) => b.untilMs > T0);
      if (k < 0) k = blocks.length - 1;
      const tgt = blocks[k].pt;
      const samePlace = was.inside && blocks[k].pt.inside && was.place === blocks[k].place;
      if (!samePlace && Math.hypot(was.x - tgt.x, was.z - tgt.z) > 0.8) {
        const from = { x: was.x, z: was.z };
        const pts = pathBetween(from, tgt, rain);
        const run = person.rainHabit === 'dash' && rain;
        const v = run ? person.run : person.speed;
        day.bridge = { t0: T0, k, pts, L: polylineLength(pts), v, run, fromInside: was.inside, fromPlace: was.place };
      }
    }
    return day;
  }
  function dayFor(person, ms) {
    const rain = isRaining();
    let d = days.get(person.id);
    const c = clockOf(ms);
    const dateKey = `${c.y}-${c.m}-${c.d}`;
    if (!d || d.dateKey !== dateKey) { d = planDay(person, ms, rain); days.set(person.id, d); }
    else if (d.rain !== rain) { d = planDay(person, ms, rain, d); days.set(person.id, d); }
    return d;
  }

  /** the walk into block k (from block k-1), with its timing */
  function legInto(person, day, k) {
    if (day.legs.has(k)) return day.legs.get(k);
    const b = day.blocks[k], a = day.blocks[k - 1];
    let leg = null;
    if (a) {
      const end = at(person, a, a.untilMs - 1, k - 1);           // where the last activity left them
      const from = { x: end.x, z: end.z }, to = b.pt;
      const same = a.place === b.place && (a.door || 0) === (b.door || 0);
      if (!same && Math.hypot(from.x - to.x, from.z - to.z) > 0.5) {
        const run = !!b.run || (day.rain && person.rainHabit === 'dash');
        const v = run ? person.run : person.speed;
        const pts = pathBetween(from, to, day.rain);
        const L = polylineLength(pts);
        const t0 = a.untilMs;
        leg = { pts, L, v, run, t0, t1: t0 + (L / v) * 1000 };
      }
    }
    day.legs.set(k, leg);
    return leg;
  }

  // ---------------------------------------------------------------- the state at a moment
  const tmp = {};
  function stateIn(person, day, ms) {
    const B = day.blocks, br = day.bridge;
    if (br && ms >= br.t0) {
      // re-planned: the bridge walk, then block br.k, then on as usual
      const t1 = br.t0 + (br.L / br.v) * 1000;
      if (ms < t1) return walking(person, br.pts, br.L, br.v, (ms - br.t0) / 1000, br.run, B[br.k]);
      let k = br.k;
      while (k < B.length - 1 && ms >= B[k].untilMs) k++;
      if (k > br.k) { const leg = legInto(person, day, k); if (leg && ms < leg.t1) return walking(person, leg.pts, leg.L, leg.v, (ms - leg.t0) / 1000, leg.run, B[k]); }
      return at(person, B[k], ms, k);
    }
    let k = 0;
    while (k < B.length - 1 && ms >= B[k].untilMs) k++;
    if (k > 0) { const leg = legInto(person, day, k); if (leg && ms >= leg.t0 && ms < leg.t1) return walking(person, leg.pts, leg.L, leg.v, (ms - leg.t0) / 1000, leg.run, B[k]); }
    return at(person, B[k], ms, k);
  }
  function walking(person, pts, L, v, sec, run, toBlock) {
    const s = Math.min(L, sec * v);
    pointAt(pts, s, tmp);
    return { x: tmp.x, z: tmp.z, yaw: tmp.yaw, moving: true, speed: v, run, inside: false, away: false, act: 'walk', place: null,
      to: toBlock.place, toLabel: toBlock.pt.label || labelOf(toBlock.place), going: ACT_LABEL[toBlock.act] || '', path: pts, s, L };
  }
  function at(person, b, ms, k) {
    const p = b.pt;
    const st = { x: p.x, z: p.z, yaw: p.yaw ?? 0, moving: false, speed: 0, run: false, inside: !!p.inside, away: b.act === 'away', act: b.act, place: b.place,
      label: b.act === 'break' ? labelOf(b.place) : (p.label || labelOf(b.place)), what: ACT_LABEL[b.act] || '', k };
    const sec = (ms - b.atMs) / 1000;
    if (p.route) {
      // sweeping / watering: along the route and back, slowly, with pauses
      const L = polylineLength(p.route), v = b.act === 'sweep' ? 0.28 : 0.45;
      const cycle = 9 + 7;                                                  // 9 s moving, 7 s working in place
      const n = Math.floor(sec / cycle), r = sec - n * cycle;
      const s = ((n * 9 + Math.min(9, r)) * v) % (2 * L);
      pointAt(p.route, s <= L ? s : 2 * L - s, tmp);
      st.x = tmp.x; st.z = tmp.z; st.yaw = s <= L ? tmp.yaw : tmp.yaw + Math.PI; st.moving = r < 9; st.speed = r < 9 ? v : 0;
    } else if (p.laps) {
      // laps of the track (the field's oval, inner lane)
      const cx = -201.3, cz = -58.8, R = 36, half = 86.7 - 4 - R;
      const per = 4 * half + 2 * Math.PI * R, v = person.run * 0.85;
      const s = (sec * v) % per;
      lap(s, cx, cz, R, half, tmp);
      st.x = tmp.x; st.z = tmp.z; st.yaw = tmp.yaw; st.moving = true; st.speed = v; st.run = true;
    } else if (b.act === 'play' || b.act === 'tend') {
      // around the spot: short moves and stops, seeded per block
      const step = b.act === 'play' ? 3.5 : 14, rad = b.act === 'play' ? 7 : 5, v = b.act === 'play' ? person.run * 0.75 : 0.5;
      const i = Math.floor(sec / step), f = sec / step - i;
      const wp = (j) => { const r = rngOf(hash(`${person.id}:${b.place}:${b.atMs}:${j}`)); for (let n = 0; n < 6; n++) { const a = r() * Math.PI * 2, d = rad * Math.sqrt(r()); const q = { x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d }; if (nav.isFree(q.x, q.z)) return q; } return { x: p.x, z: p.z }; };
      const A = i === 0 ? { x: p.x, z: p.z } : wp(i - 1), Bp = wp(i);
      const dist = Math.hypot(Bp.x - A.x, Bp.z - A.z), dur = Math.min(step * 0.8, dist / v);
      const tt = Math.min(1, (f * step) / Math.max(dur, 1e-3));
      st.x = A.x + (Bp.x - A.x) * tt; st.z = A.z + (Bp.z - A.z) * tt;
      st.moving = tt < 1 && dist > 0.2; st.speed = st.moving ? v : 0; st.run = b.act === 'play' && st.moving;
      st.yaw = Math.atan2(Bp.x - A.x, Bp.z - A.z);
      if (b.act === 'play' && !st.moving) st.yaw = Math.atan2(-128 - st.x + (p.x + 128), -26 - st.z);   // face the hoop end
    }
    return st;
  }

  // ---------------------------------------------------------------- the agents
  const agents = people.map((person) => ({ id: person.id, person, state: null, live: null, trail: [] }));
  const byId = new Map(agents.map((a) => [a.id, a]));
  function update(ms) {
    for (const a of agents) {
      const day = dayFor(a.person, ms);
      a.state = stateIn(a.person, day, ms);
    }
    return agents;
  }
  /** footprints of the last `seconds` before ms (from the plan): [{x, z, yaw, side, t}] */
  function steps(person, ms, seconds = 150, stride = 0.68) {
    const out = [];
    const day = dayFor(person, ms);
    let prev = null, acc = 0, side = 1;
    for (let t = ms - seconds * 1000; t <= ms; t += 250) {
      const s = stateIn(person, day, t);
      if (s.inside || s.away) { prev = null; continue; }
      if (prev) {
        const d = Math.hypot(s.x - prev.x, s.z - prev.z);
        if (d > 6) { prev = s; continue; }                            // a re-plan or a day boundary
        acc += d;
        const st = s.run ? stride * 1.6 : stride;
        while (acc >= st) {
          acc -= st; side = -side;
          const yaw = Math.atan2(s.x - prev.x, s.z - prev.z);
          out.push({ x: s.x + Math.cos(yaw) * 0.09 * side, z: s.z - Math.sin(yaw) * 0.09 * side, yaw, side, t, run: s.run });
        }
      }
      prev = s;
    }
    return out;
  }
  return { agents, byId, update, stateOf: (id, ms) => stateIn(byId.get(id).person, dayFor(byId.get(id).person, ms), ms), steps, dayFor, pathBetween, people };
}

function lap(s, cx, cz, R, half, out) {
  // an oval: two straights along x (z = cz ± R) joined by half circles at x = cx ± half
  const S = 2 * half, C = Math.PI * R;
  if (s < S) { out.x = cx - half + s; out.z = cz - R; out.yaw = Math.PI / 2; return; }
  s -= S;
  if (s < C) { const a = -Math.PI / 2 + s / R; out.x = cx + half + Math.cos(a) * R; out.z = cz + Math.sin(a) * R; out.yaw = Math.atan2(-Math.sin(a), Math.cos(a)); return; }
  s -= C;
  if (s < S) { out.x = cx + half - s; out.z = cz + R; out.yaw = -Math.PI / 2; return; }
  s -= S;
  const a = Math.PI / 2 + s / R; out.x = cx - half + Math.cos(a) * R; out.z = cz + Math.sin(a) * R; out.yaw = Math.atan2(-Math.sin(a), Math.cos(a));
}

/** class blocks with breaks: in each 10-minute break, maybe step out to a spot nearby */
function expandBreaks(person, blocks, rng, dateKey) {
  const out = [];
  for (const b of blocks) {
    if (!b.breaks || (b.act !== 'class')) { out.push(b); continue; }
    let cur = { ...b };
    delete cur.breaks;
    for (let i = 0; i < PERIODS.length - 1; i++) {
      const gapA = PERIODS[i][1], gapB = PERIODS[i + 1][0];
      if (gapB - gapA > 0.2) continue;                                  // only the short breaks
      if (gapA <= cur.at + 0.05 || gapB >= cur.until - 0.05) continue;
      const r = rngOf(hash(`${person.id}:${dateKey}:break${i}`))();
      if (r > 0.6) continue;
      const spot = b.breaks[Math.floor(r * 10) % b.breaks.length];
      out.push({ ...cur, until: gapA + 0.005 });
      out.push({ at: gapA + 0.04, until: gapB - 0.045, place: spot, act: 'break' });
      cur = { ...cur, at: gapB - 0.01 };
    }
    out.push(cur);
  }
  void rng;
  return out;
}

export { PLACES, nearestDoor };
