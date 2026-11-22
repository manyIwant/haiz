// HAIZ · 自由共游 — the margin of the picture: where you are, which way, how fast, where to.
//
// After looking at what a driving game's HUD does (a minimap that turns with you, a route line, a speed
// readout, the street you are on) — and at what 入画 is (a painting you walked into) — the same jobs are
// done here in the painting's own materials, at its edge, and only while they are useful:
//
//   罗盘 the compass   a disc of paper in the lower left: the campus as it is painted on the ground (the very
//                     texture the world's lawns and paths are drawn from), buildings inked and hatched like
//                     the 活点地图. It turns with the view (up is where you look), the North Gate's 北 rides
//                     its rim; you are a red seal at its centre. The people of the campus are dots in their
//                     inks, the parked bike is a tick, a route is a vermilion brush line. On the broom it
//                     draws back as you climb (the higher you are, the more of the campus it holds)
//   the reading       beside it, hand-lettered: the speed (km/h, as on a bike computer) and one line that
//                     belongs to the way you move — 踏频 for the bike, the count of kicks on the board, 离地
//                     for the broom with an ink altitude scale — and the place you are passing ("图书馆南 ·
//                     校道"), as a driving game names the street
//   去哪儿 where to    a paper slip of places (N, or tap the compass). On the ground the way is found on the
//                     same grid the campus's people walk (lanren/life/nav.js) and painted ahead of you on
//                     the paths themselves; in the air it is a line straight to a tall brush stroke of light
//   退场 stepping back standing still on foot with nowhere to go, the margin empties; it comes back the moment
//                     you move fast, ride, or ask for a way
import * as THREE from 'three';
import { PLACES, SPOTS } from '../life/places.js';
import { INKS } from '../life/map.js';
import { createWheelPath } from './wheelpath.js';

const FONT_HAND = '"Kaiti SC","STKaiti","KaiTi","Noto Serif SC","Songti SC",serif';
const FONT_SERIF = '"Songti SC","Noto Serif SC","Source Han Serif SC","STSong",serif';
const TAU = Math.PI * 2;

// where one can ask to go: [key, label, point]
export const DESTS = [
  ['tree', '百年榄仁树', () => SPOTS.tree_n],
  ['yihao', '一号教学楼', () => PLACES.yihao.doors[0]],
  ['erhao', '二号教学楼', () => PLACES.erhao.doors[0]],
  ['library', '图书馆', () => PLACES.library.doors[0]],
  ['keji', '科技楼', () => PLACES.keji.doors[0]],
  ['canteen1', '第一食堂', () => PLACES.canteen1.doors[0]],
  ['dorm_m', '男生宿舍', () => PLACES.dorm_m.doors[0]],
  ['dorm_f', '女生宿舍', () => PLACES.dorm_f.doors[0]],
  ['track', '操场', () => SPOTS.track_s],
  ['court', '篮球场', () => SPOTS.court_edge],
  ['pond', '砚池', () => SPOTS.pond_n],
  ['garden', '植物园', () => SPOTS.garden_a],
  ['beimen', '北门', () => SPOTS.beimen_in],
  ['yishu', '艺术中心', () => PLACES.yishu.doors[0]],
];
const WHERE = { road: '校道', court: '球场', field: '操场', corridor: '连廊', pavilion: '亭下', gate: '校门', garden: '园中小径', botanic: '植物园', open: '', water: '水边' };

export function createHud({ world, nav, life, root, coarse, onRoute }) {
  const wheel = createWheelPath(nav);
  const el = {
    root, canvas: root.querySelector('canvas'), speed: root.querySelector('[data-hud="speed"]'), unit: root.querySelector('[data-hud="unit"]'),
    line: root.querySelector('[data-hud="line"]'), place: root.querySelector('[data-hud="place"]'), dest: root.querySelector('[data-hud="dest"]'),
    alt: root.querySelector('[data-hud="alt"]'), slip: document.querySelector('#fr-slip'),
  };
  const g = el.canvas.getContext('2d');
  // ---------------------------------------------------------------- the plan, painted once from the ground's own painting
  const PX = 1.6;                                    // px per metre on the plan
  const B = { x0: -330, x1: 240, z0: -195, z1: 345 };
  const plan = document.createElement('canvas');
  plan.width = Math.round((B.x1 - B.x0) * PX); plan.height = Math.round((B.z1 - B.z0) * PX);
  {
    const c = plan.getContext('2d');
    const toP = (x, z) => [(x - B.x0) * PX, (z - B.z0) * PX];
    c.fillStyle = '#efe5cf'; c.fillRect(0, 0, plan.width, plan.height);
    // the ground's painting, washed toward paper (a map, not a photograph)
    const gp = world.ground.paint;
    const [px, pz] = toP(gp.x0, gp.z0);
    c.globalAlpha = 0.72; c.drawImage(gp.c, px, pz, gp.span * PX, gp.span * PX);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'soft-light'; c.fillStyle = '#f2e6c8'; c.fillRect(0, 0, plan.width, plan.height);
    c.globalCompositeOperation = 'source-over';
    // water: a blue-green wash with a darker edge
    for (const f of world.geo.features) {
      if (f.kind !== 'water') continue;
      rectPath(c, f, toP); c.fillStyle = 'rgba(70,120,130,.55)'; c.fill(); c.strokeStyle = 'rgba(30,60,70,.6)'; c.lineWidth = 1; c.stroke();
    }
    // buildings: paper, hatched, inked edge
    for (const b of world.model.buildings) {
      const f = { cx: b.cx, cz: b.cz, hw: b.w / 2, hd: b.d / 2, rot: b.rot };
      rectPath(c, f, toP);
      const corr = b.form === 'corr' || b.form === 'pavilion';
      c.fillStyle = corr ? 'rgba(236,226,206,.6)' : '#e4d9c2'; c.fill();
      c.save(); c.clip();
      c.strokeStyle = 'rgba(60,52,40,.28)'; c.lineWidth = 1;
      const [cx, cz] = toP(b.cx, b.cz), R = Math.hypot(b.w, b.d) * PX;
      for (let k = -R; k < R; k += corr ? 6 : 3.2) { c.beginPath(); c.moveTo(cx + k - R, cz - R); c.lineTo(cx + k + R, cz + R); c.stroke(); }
      c.restore();
      rectPath(c, f, toP); c.strokeStyle = 'rgba(42,38,32,.85)'; c.lineWidth = corr ? 0.8 : 1.3; c.stroke();
    }
    // the old tree: a ring of leaves at the origin
    const [tx, tz] = toP(0, 0);
    c.fillStyle = 'rgba(70,120,60,.75)'; c.beginPath(); c.arc(tx, tz, 12 * PX * 0.9, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(40,70,35,.9)'; c.lineWidth = 1.2; c.stroke();
    for (const t of world.trees) { const [x, z] = toP(t.x, t.z); c.fillStyle = 'rgba(70,115,60,.45)'; c.beginPath(); c.arc(x, z, (t.kind === 'palm' ? 1.6 : 2.4) * (t.s || 1) * PX, 0, TAU); c.fill(); }
  }
  function rectPath(c, f, toP) {
    const cs = Math.cos(f.rot || 0), sn = Math.sin(f.rot || 0);
    c.beginPath();
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([i, j], k) => {
      const lx = i * f.hw, lz = j * f.hd;
      const [x, z] = toP(f.cx + lx * cs + lz * sn, f.cz - lx * sn + lz * cs);
      k ? c.lineTo(x, z) : c.moveTo(x, z);
    });
    c.closePath();
  }
  // names of the main buildings, written at draw time (so they stay upright as the disc turns)
  const LABELS = world.model.buildings.filter((b) => b.name && !['corr', 'gate'].includes(b.form) && b.w * b.d > 500).map((b) => ({ x: b.cx, z: b.cz, t: (PLACES[b.id]?.short) || b.name.replace(/教学楼$/, '楼').slice(0, 5) }));

  // ---------------------------------------------------------------- state
  const H = { show: 0, want: 0, size: 0, dpr: Math.min(2, devicePixelRatio || 1), route: null, dest: null, arrived: 0, placeT: 0, lastSpeed: 0, scale: 2.2, t: 0 };
  function resize() {
    const s = coarse || innerWidth < 600 ? 116 : 150;
    H.size = s;
    el.canvas.width = el.canvas.height = Math.round(s * H.dpr);
    el.canvas.style.width = el.canvas.style.height = s + 'px';
  }
  resize();
  addEventListener('resize', resize);

  // ---------------------------------------------------------------- where to
  if (el.slip) {
    el.slip.querySelector('ul').innerHTML = DESTS.map(([k, label]) => `<li><button type="button" data-dest="${k}">${label}</button></li>`).join('');
    el.slip.addEventListener('click', (e) => {
      const b = e.target.closest('[data-dest]');
      if (b) { setDest(b.dataset.dest); toggleSlip(false); }
      if (e.target.closest('[data-hud="clear"]')) { setDest(null); toggleSlip(false); }
      if (e.target.closest('[data-hud="close"]')) toggleSlip(false);
    });
  }
  el.canvas.addEventListener('click', () => toggleSlip());
  function toggleSlip(on) {
    if (!el.slip) return;
    const open = on ?? el.slip.hidden;
    el.slip.hidden = !open;
    el.slip.querySelectorAll('[data-dest]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.dest === H.dest?.key)));
  }
  function setDest(key) {
    if (!key) { H.dest = null; H.route = null; onRoute?.(null); return; }
    const d = DESTS.find((x) => x[0] === key);
    const p = d[2]();
    H.dest = { key, label: d[1], x: p[0], z: p[1] };
    H.route = null; H.routeAt = -99; H.arrived = 0;
  }
  function plan2(from, air, wheels) {
    if (!H.dest) return null;
    if (air) return { points: [{ x: from.x, z: from.z }, { x: H.dest.x, z: H.dest.z }], air: true };
    // on a bike or a board the way keeps to the paving; on foot it is the campus's own walking way
    const r = (wheels && wheel.path(from.x, from.z, H.dest.x, H.dest.z)) || nav.path(from.x, from.z, H.dest.x, H.dest.z);
    return r ? { points: r.points, air: false, length: r.length } : { points: [{ x: from.x, z: from.z }, { x: H.dest.x, z: H.dest.z }], air: true };
  }

  // ---------------------------------------------------------------- per frame
  let acc = 0;
  /**
   * s: { pos, speed, mode, yaw (camera), agl, cadence, pushes, riding, parked, people: [{x, z, ink}], idle, moving }
   */
  function update(dt, s) {
    H.t += dt;
    // the margin is wanted while riding, moving briskly, navigating, or just after a change
    const want = s.riding || s.speed > 2.6 || H.dest || (el.slip && !el.slip.hidden) ? 1 : 0;
    if (want) H.lastWant = H.t;
    const show = want || H.t - (H.lastWant ?? -99) < 2.5 ? 1 : 0;
    H.show += (show - H.show) * (1 - Math.exp(-dt * (show ? 4 : 1.5)));
    el.root.style.opacity = H.show.toFixed(3);
    // only the compass itself takes a tap: the readings beside it must not swallow a thumb reaching for the stick
    el.canvas.style.pointerEvents = H.show > 0.3 ? 'auto' : 'none';
    if (H.show < 0.01) return;
    // ---- route: replanned when you leave it (ground) or every second (air)
    if (H.dest) {
      const air = s.mode === 'broom' && s.agl > 2;
      const wheels = s.mode === 'bike' || s.mode === 'board';
      const far = Math.hypot(H.dest.x - s.pos.x, H.dest.z - s.pos.z);
      if (far < (air ? 10 : 6)) { H.arrived = H.t; const label = H.dest.label; setDest(null); onRoute?.({ arrived: label }); }
      else if (!H.route || H.route.air !== air || !!H.route.wheels !== wheels || H.t - H.routeAt > (air ? 0.5 : 4) || offRoute(s.pos)) {
        H.route = plan2(s.pos, air, wheels); if (H.route) H.route.wheels = wheels; H.routeAt = H.t;
        onRoute?.(H.route ? { points: H.route.points, air, dest: H.dest } : null);
      }
    }
    acc += dt;
    if (acc < 1 / 30) return;
    acc = 0;
    // ---- the reading
    const kmh = s.speed * 3.6;
    H.lastSpeed += (kmh - H.lastSpeed) * 0.35;
    el.speed.textContent = H.lastSpeed < 0.5 ? '0' : H.lastSpeed.toFixed(0);
    let line = '';
    if (s.mode === 'bike') line = s.cadence > 5 ? `踏频 ${Math.round(s.cadence)}` : s.speed > 0.4 ? '滑行' : '一只脚点地';
    else if (s.mode === 'board') line = s.pushes ? `第 ${s.pushes} 蹬` : '站上滑板';
    else if (s.mode === 'broom') line = s.agl < 1.6 ? (s.speed > 1 ? '贴地' : '悬停') : `离地 ${Math.round(s.agl)} 米`;
    else line = s.speed > 2.6 ? '跑' : s.speed > 0.3 ? '走' : '';
    el.line.textContent = line;
    el.alt.hidden = s.mode !== 'broom';
    if (s.mode === 'broom') el.alt.style.setProperty('--alt', Math.min(1, Math.max(0, s.agl / 56)).toFixed(3));   // the scale ends at the broom's ceiling
    H.placeT -= 1 / 30;
    if (H.placeT <= 0) { H.placeT = 0.6; el.place.textContent = placeName(s.pos, s.mode === 'broom' ? s.agl : 0); }
    el.dest.textContent = H.dest ? `去 ${H.dest.label} · ${fmt(remaining(s.pos))}` : (H.t - H.arrived < 3 ? '到了' : '');
    drawCompass(s);
  }
  const fmt = (m) => (m < 1000 ? `${Math.max(5, Math.round(m / 5) * 5)} 米` : `${(m / 1000).toFixed(1)} 公里`);
  function remaining(p) {
    if (!H.route) return Math.hypot(H.dest.x - p.x, H.dest.z - p.z);
    const pts = H.route.points;
    let best = 0, bd = 1e9;
    for (let i = 0; i < pts.length; i++) { const d = Math.hypot(pts[i].x - p.x, pts[i].z - p.z); if (d < bd) { bd = d; best = i; } }
    let L = bd;
    for (let i = best + 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    return L;
  }
  function offRoute(p) {
    const pts = H.route?.points;
    if (!pts || H.route.air) return false;
    let bd = 1e9;
    for (let i = 1; i < pts.length; i++) bd = Math.min(bd, segDist(p.x, p.z, pts[i - 1], pts[i]));
    return bd > 8;
  }
  function segDist(x, z, a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2));
    return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
  }
  function placeName(p, agl) {
    // the nearest building (with which side of it), and what is underfoot
    let best = null, bd = 1e9;
    for (const b of world.model.buildings) {
      if (!b.name || b.form === 'corr') continue;
      const dx = p.x - b.cx, dz = p.z - b.cz, c = Math.cos(b.rot), sn = Math.sin(b.rot);
      const lx = Math.abs(dx * c - dz * sn) - b.w / 2, lz = Math.abs(dx * sn + dz * c) - b.d / 2;
      const d = Math.hypot(Math.max(lx, 0), Math.max(lz, 0));
      if (d < bd) { bd = d; best = b; }
    }
    if (Math.hypot(p.x, p.z) < 16) return agl > 6 ? '榄仁树上空' : '百年榄仁树下';
    const under = WHERE[nav.surfaceAt(p.x, p.z)] || '';
    if (!best || bd > 45) return agl > 6 ? '校园上空' : under || '校园';
    const name = PLACES[best.id]?.short || best.name.replace(/教学楼$/, '楼');
    const dx = p.x - best.cx, dz = p.z - best.cz;
    const side = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? '东' : '西') : (dz > 0 ? '南' : '北');
    if (agl > 6) return bd < 2 ? `${name}屋顶` : `${name}${side}上空`;
    return `${name}${bd < 12 ? side + '侧' : side}${under ? ' · ' + under : ''}`;
  }

  function drawCompass(s) {
    const S = H.size, d = H.dpr, R = S / 2;
    g.setTransform(d, 0, 0, d, 0, 0);
    g.clearRect(0, 0, S, S);
    // scale: px per metre — closer on foot, further on the broom as it climbs
    const want = s.mode === 'broom' ? 1.6 / (1 + Math.max(0, s.agl) / 22) : s.mode === 'walk' ? 2.0 : 1.5;
    H.scale += (want * (S / 150) - H.scale) * 0.1;
    const k = H.scale, y = s.yaw;
    g.save();
    // the paper disc, its edge a little uneven
    g.beginPath();
    for (let i = 0; i <= 64; i++) { const a = (i / 64) * TAU, r = R - 3 - Math.sin(a * 7 + 1.3) * 0.8 - Math.sin(a * 13) * 0.5; i ? g.lineTo(R + Math.cos(a) * r, R + Math.sin(a) * r) : g.moveTo(R + Math.cos(a) * r, R + Math.sin(a) * r); }
    g.closePath();
    g.shadowColor = 'rgba(20,14,6,.35)'; g.shadowBlur = 8; g.shadowOffsetY = 2;
    g.fillStyle = '#efe5cf'; g.fill();
    g.shadowColor = 'transparent';
    g.clip();
    // world → disc: up is the way you look
    const cs = Math.cos(y), sn = Math.sin(y);
    g.setTransform(-cs * k * d, -sn * k * d, sn * k * d, -cs * k * d, R * d, R * d);
    g.translate(-s.pos.x, -s.pos.z);
    g.drawImage(plan, B.x0, B.z0, B.x1 - B.x0, B.z1 - B.z0);
    // the route: a vermilion brush line
    if (H.route) {
      const pts = H.route.points;
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = 'rgba(176,32,28,.25)'; g.lineWidth = 7 / k; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.z) : g.moveTo(p.x, p.z))); g.stroke();
      g.strokeStyle = 'rgba(176,32,28,.9)'; g.lineWidth = 2.6 / k;
      if (H.route.air) g.setLineDash([5 / k, 4 / k]);
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.z) : g.moveTo(p.x, p.z))); g.stroke();
      g.setLineDash([]);
    }
    // back to disc space for things that stay upright
    g.setTransform(d, 0, 0, d, 0, 0);
    const toD = (x, z) => { const dx = x - s.pos.x, dz = z - s.pos.z; return [R + (-dx * cs + dz * sn) * k, R - (dx * sn + dz * cs) * k]; };
    // building names, upright
    g.font = `${S < 130 ? 9 : 10}px ${FONT_HAND}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const L of LABELS) {
      const [x, z] = toD(L.x, L.z);
      if (Math.hypot(x - R, z - R) > R - 14) continue;
      g.fillStyle = 'rgba(42,38,32,.75)'; g.fillText(L.t, x, z);
    }
    // the people (their inks), the parked bike
    for (const p of s.people || []) {
      const [x, z] = toD(p.x, p.z);
      if (Math.hypot(x - R, z - R) > R - 6) continue;
      g.fillStyle = p.ink; g.beginPath(); g.arc(x, z, 2.6, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,250,240,.8)'; g.lineWidth = 1; g.stroke();
    }
    if (s.parked) {
      const [x, z] = toD(s.parked.x, s.parked.z);
      if (Math.hypot(x - R, z - R) < R - 6) { g.strokeStyle = '#2c5b4f'; g.lineWidth = 1.6; g.beginPath(); g.arc(x - 3, z + 1, 2.4, 0, TAU); g.moveTo(x + 5.4, z + 1); g.arc(x + 3, z + 1, 2.4, 0, TAU); g.moveTo(x - 3, z + 1); g.lineTo(x, z - 2.5); g.lineTo(x + 3, z + 1); g.stroke(); }
    }
    // the destination: a small seal, pinned to the rim when it is off the disc
    if (H.dest) {
      let [x, z] = toD(H.dest.x, H.dest.z);
      const dx = x - R, dz = z - R, L = Math.hypot(dx, dz);
      const edge = L > R - 12;
      if (edge) { x = R + dx / L * (R - 12); z = R + dz / L * (R - 12); }
      g.save(); g.translate(x, z); g.rotate(-0.06);
      g.fillStyle = '#b0201c'; g.fillRect(-6, -6, 12, 12);
      g.fillStyle = '#fbf2e4'; g.font = `600 9px ${FONT_HAND}`; g.fillText(H.dest.label[0], 0, 0.5);
      g.restore();
    }
    // the rim: a thin ink circle; 北 (the North Gate side of the campus frame) riding it
    g.restore();
    g.setTransform(d, 0, 0, d, 0, 0);
    g.strokeStyle = 'rgba(42,38,32,.7)'; g.lineWidth = 1.2; g.beginPath(); g.arc(R, R, R - 3.5, 0, TAU); g.stroke();
    {
      const [nx, nz] = toD(s.pos.x, s.pos.z - 1000);
      const a = Math.atan2(nz - R, nx - R);
      const x = R + Math.cos(a) * (R - 10), z = R + Math.sin(a) * (R - 10);
      g.fillStyle = 'rgba(239,229,207,.95)'; g.beginPath(); g.arc(x, z, 7.5, 0, TAU); g.fill();
      g.fillStyle = '#2a2620'; g.font = `600 11px ${FONT_HAND}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('北', x, z + 0.5);
    }
    // you: a red arrowhead (where you face, against where you look)
    {
      const rel = (s.heading ?? y) - y;
      g.save(); g.translate(R, R); g.rotate(-rel);
      g.fillStyle = '#b0201c'; g.strokeStyle = 'rgba(255,248,236,.95)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(0, -8); g.lineTo(5.5, 5.5); g.lineTo(0, 2.8); g.lineTo(-5.5, 5.5); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
  }

  return {
    update, setDest, toggleSlip,
    get dest() { return H.dest; },
    get route() { return H.route; },
    wheel,
    get shown() { return H.show; },
  };
}
