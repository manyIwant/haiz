// HAIZ · 海中活点地图 — a page of the walker's sketchbook on which the campus is drawn, and on which the
// people of the campus leave their footprints as they walk (see docs/life-20261117.md, 第二部分).
//
// Not a navigation HUD and not a copy of anyone else's magic map. It belongs to 入画: you came into this
// campus through a painting of its tree, and here you look at the campus through another drawing. So:
//
//   the book    the map is a page of the same sketchbook. It comes up from the bottom of the picture,
//               the cover opens, and the plan draws itself — from the 百年榄仁树 outward, the way the
//               painting spread across the campus in 06 (the tree is the plan's origin, (0, 0), as it is
//               the origin of every campus coordinate in HAIZ)
//   the plan    ink on warm paper: the surveyed paths left as bare paper between double ink lines, the
//               buildings hatched like an architect's plan, washes for lawns, courts, the track and the
//               ponds, a dab of green for each of the 300 trees in the data, and the old tree drawn as a
//               ring of its own leaves. The north is the North Gate (the campus frame, not true north)
//   the life    each person's last two or three minutes of steps, pressed into the paper in their own
//               ink and drying as they age; their name written beside the newest step with what they
//               are doing; people indoors are written inside their building in graphite; the cat leaves
//               paw prints; you leave red ones. Steps come from the same day (life.js) the 3D bodies walk,
//               so a name on the page is a person on the path
//   the weather rain falls on the page too: drops bloom and dry on the paper and the paths darken; at
//               night the page lies under a lamp and the classrooms of 晚自习 glow
//
// Drawing: one static layer painted once into an offscreen canvas (4 px per metre; 3 on phones), then
// each frame the visible part of it, the reveal, the footprints, the names and the weather.
const TAU = Math.PI * 2;
const INK = '#2a2620';
const FONT_HAND = '"Kaiti SC","STKaiti","KaiTi","Noto Serif SC","Songti SC","Source Han Serif SC",serif';
const FONT_SERIF = '"Songti SC","Noto Serif SC","Source Han Serif SC","STSong",serif';
export const INKS = { lin: '#2f5a46', chen: '#2b3f78', fu: '#6a4126', wang: '#5a3550', wu: '#55583a', cat: '#a5532a', you: '#b0201c' };

function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash2(x, y) { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
const fbm = (x, y) => vnoise(x, y) * 0.5 + vnoise(x * 2.1 + 7, y * 2.1 + 3) * 0.3 + vnoise(x * 4.3 + 1, y * 4.3 + 9) * 0.2;

/**
 * geo:     lanren/map/geo.js buildGeo() (features, trees, places, frame)
 * life:    lanren/life/life.js (agents with .state / .live, steps())
 * get():   { clock (ms), player {x, z, yaw, camYaw}, playerSteps [], cat {x, z, act, pose}, weather {rain, wet, night, lamps, wind}, caption }
 */
export function createMap({ geo, life, get, mobile = false, root = document.querySelector('#lf-map') }) {
  const canvas = root.querySelector('canvas');
  const g = canvas.getContext('2d');
  const PX = mobile ? 3 : 4;
  const R = { x0: -312, x1: 212, z0: -152, z1: 312 };
  const SW = Math.round((R.x1 - R.x0) * PX), SH = Math.round((R.z1 - R.z0) * PX);
  let sheet = null, roads = null, lit = null;
  const view = { cx: 0, cz: 20, s: 2.4, target: null };
  const state = { open: false, t: 0, reveal: 0, selected: null, follow: null, blooms: [], leaves: [], lastSpawn: 0, built: false, w: 0, h: 0, dpr: 1, catTrail: [], day: { on: false, traces: {}, cursor: {}, from: 0 } };
  const toS = (x, z) => [(x - view.cx) * view.s + state.w / 2, (z - view.cz) * view.s + state.h / 2];
  const toW = (sx, sy) => [(sx - state.w / 2) / view.s + view.cx, (sy - state.h / 2) / view.s + view.cz];

  // ---------------------------------------------------------------- the plan, painted once
  function build() {
    if (state.built) return;
    state.built = true;
    sheet = document.createElement('canvas'); sheet.width = SW; sheet.height = SH;
    const c = sheet.getContext('2d');
    const P = (x, z) => [(x - R.x0) * PX, (z - R.z0) * PX];
    const r0 = rng(20261117);
    // paper: warm, uneven, with fibres
    c.fillStyle = '#eee5cf'; c.fillRect(0, 0, SW, SH);
    const img = c.getImageData(0, 0, SW, SH), d = img.data;
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      const k = (y * SW + x) * 4;
      const n = fbm(x / 140, y / 140) * 0.6 + vnoise(x / 9, y / 9) * 0.25 + hash2(x, y) * 0.15;
      const v = (n - 0.5) * 22;
      d[k] = Math.min(255, d[k] + v); d[k + 1] = Math.min(255, d[k + 1] + v * 0.95); d[k + 2] = Math.min(255, d[k + 2] + v * 0.8);
    }
    c.putImageData(img, 0, 0);
    c.globalAlpha = 0.05; c.strokeStyle = '#7a6a50'; c.lineWidth = 0.6;
    for (let i = 0; i < SW * SH / 2600; i++) { const x = r0() * SW, y = r0() * SH, a = r0() * TAU, L = 3 + r0() * 9; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a + 0.5) * L * 0.5, y + Math.sin(a + 0.5) * L * 0.5, x + Math.cos(a) * L, y + Math.sin(a) * L); c.stroke(); }
    c.globalAlpha = 1;
    // a surveyor's grid, very faint (10 m), centred on the tree: the campus's own coordinates
    c.strokeStyle = 'rgba(70, 100, 120, 0.07)'; c.lineWidth = 1;
    for (let x = Math.ceil(R.x0 / 10) * 10; x <= R.x1; x += 10) { const [px] = P(x, 0); c.beginPath(); c.moveTo(px, 0); c.lineTo(px, SH); c.stroke(); }
    for (let z = Math.ceil(R.z0 / 10) * 10; z <= R.z1; z += 10) { const [, pz] = P(0, z); c.beginPath(); c.moveTo(0, pz); c.lineTo(SW, pz); c.stroke(); }

    const F = geo.features;
    const rect = (f, grow = 0) => {
      const cs = Math.cos(f.rot), sn = Math.sin(f.rot), pts = [];
      for (const [i, j] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const lx = i * (f.hw + grow), lz = j * (f.hd + grow);
        pts.push(P(f.cx + lx * cs + lz * sn, f.cz - lx * sn + lz * cs));
      }
      return pts;
    };
    // a hand-drawn closed line: each edge in short segments, nudged by noise
    const wob = (pts, amp, seed) => {
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        const L = Math.hypot(bx - ax, by - ay), n = Math.max(2, Math.ceil(L / 14));
        const nx = -(by - ay) / (L || 1), ny = (bx - ax) / (L || 1);
        for (let k = 0; k < n; k++) {
          const t = k / n, w = (vnoise(seed + (i * 50 + k) * 0.37, seed * 0.3) - 0.5) * 2 * amp;
          out.push([ax + (bx - ax) * t + nx * w, ay + (by - ay) * t + ny * w]);
        }
      }
      return out;
    };
    const path = (pts) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
    // a watercolour wash: soft fill, granulation, a darker drying edge
    const wash = (pts, col, alpha, seed, edge = 0.5) => {
      const w = wob(pts, PX * 0.6, seed);
      c.save(); path(w); c.clip();
      c.globalAlpha = alpha; c.fillStyle = col; c.fill();
      const [x0, y0, x1, y1] = bbox(w);
      c.globalAlpha = alpha * 0.5;
      for (let y = y0; y < y1; y += 5) for (let x = x0; x < x1; x += 5) { const n = fbm(x / 60 + seed, y / 60); if (n > 0.55) { c.globalAlpha = alpha * (n - 0.5) * 1.3; c.fillRect(x, y, 5, 5); } }
      c.restore();
      c.save(); path(w); c.globalAlpha = alpha * edge; c.strokeStyle = col; c.lineWidth = PX * 0.7; c.stroke(); c.restore();
      return w;
    };
    const bbox = (pts) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return [x0, y0, x1, y1]; };
    // ground washes first
    let seed = 1;
    for (const f of F) if (f.kind === 'botanic' || f.kind === 'garden') wash(rect(f), f.kind === 'botanic' ? '#7f9a5a' : '#93a86a', 0.42, seed++);
    for (const f of F) if (f.kind === 'field') {
      // the track: a terracotta ring around a green infield
      const [cx, cz] = P(f.cx, f.cz), L = Math.max(f.hw, f.hd) * PX, S = Math.min(f.hw, f.hd) * PX;
      const ring = (inset) => { const r = S - inset, l = L - S; const pts = []; for (let i = 0; i <= 48; i++) { const a = -Math.PI / 2 + (i / 48) * Math.PI; pts.push([cx + l + Math.cos(a) * r, cz + Math.sin(a) * r]); } for (let i = 0; i <= 48; i++) { const a = Math.PI / 2 + (i / 48) * Math.PI; pts.push([cx - l + Math.cos(a) * r, cz + Math.sin(a) * r]); } return pts; };
      wash(ring(0), '#b8735a', 0.38, seed++);
      wash(ring(9 * PX), '#86a35e', 0.5, seed++);
      c.save(); path(ring(4.5 * PX)); c.setLineDash([PX * 2, PX * 2]); c.strokeStyle = 'rgba(250,245,235,0.7)'; c.lineWidth = 1; c.stroke(); c.restore();
    }
    for (const f of F) if (f.kind === 'court') {
      const w = wash(rect(f), f.sport === 'basketball' ? '#8094a8' : '#9aa88a', 0.36, seed++);
      c.save(); path(w); c.strokeStyle = 'rgba(245,242,232,0.6)'; c.lineWidth = 1; c.stroke(); c.restore();
    }
    for (const f of F) if (f.kind === 'water') {
      const w = wash(rect(f, -0.5), '#5f8fb0', 0.5, seed++, 1.0);
      c.save(); path(w); c.clip(); c.globalAlpha = 0.25; c.strokeStyle = '#f6f2e8'; c.lineWidth = 1;
      const [x0, y0, x1, y1] = bbox(w); for (let y = y0 + 4; y < y1; y += 6) { c.beginPath(); for (let x = x0; x < x1; x += 4) c.lineTo(x, y + Math.sin(x * 0.15 + y) * 1.2); c.stroke(); } c.restore();
    }
    // the paths: bare paper between double ink lines (and a road mask for the rain)
    roads = document.createElement('canvas'); roads.width = SW; roads.height = SH;
    const rc = roads.getContext('2d'); rc.fillStyle = '#fff';
    for (const f of F) if (f.kind === 'road') {
      const pts = rect(f);
      c.save(); path(pts); c.fillStyle = '#f2ead6'; c.fill(); c.restore();
      rc.beginPath(); pts.forEach(([x, y], i) => (i ? rc.lineTo(x, y) : rc.moveTo(x, y))); rc.closePath(); rc.fill();
    }
    c.strokeStyle = INK; c.lineCap = 'round'; c.lineJoin = 'round';
    for (const f of F) if (f.kind === 'road') { c.globalAlpha = 0.55; c.lineWidth = 0.9; path(wob(rect(f), 0.8, seed++)); c.stroke(); }
    c.globalAlpha = 1;
    // trees: a dab of green and an ink dot each (the old 榄仁 gets its own drawing below)
    const greens = ['#5f7f45', '#6f8a4a', '#4f6e44', '#7c8f52', '#8a6f45'];
    for (const t of geo.trees) {
      const [x, y] = P(t.x, t.z), r = Math.max(2.5, Math.min(t.r, 6) * PX * 0.42);
      const rr = rng(Math.round(t.x * 31 + t.z * 17));
      c.globalAlpha = 0.32; c.fillStyle = greens[Math.floor(rr() * greens.length)];
      for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(x + (rr() - 0.5) * r * 0.7, y + (rr() - 0.5) * r * 0.7, r * (0.55 + rr() * 0.35), 0, TAU); c.fill(); }
      c.globalAlpha = 0.6; c.fillStyle = INK; c.beginPath(); c.arc(x, y, 0.9, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
    // buildings: an architect's plan — double outline, 45° hatching
    for (const f of F) {
      if (f.kind !== 'building' && f.kind !== 'gate') continue;
      const pts = rect(f);
      const w = wob(pts, 0.9, seed++);
      c.save(); path(w); c.fillStyle = 'rgba(214, 204, 182, 0.55)'; c.fill(); c.clip();
      const [x0, y0, x1, y1] = bbox(w);
      c.strokeStyle = INK; c.globalAlpha = 0.22; c.lineWidth = 0.7;
      for (let k = x0 - (y1 - y0); k < x1; k += PX * 1.6) { c.beginPath(); c.moveTo(k, y1); c.lineTo(k + (y1 - y0), y0); c.stroke(); }
      c.restore();
      c.globalAlpha = 0.85; c.strokeStyle = INK; c.lineWidth = 1.4; path(w); c.stroke();
      c.globalAlpha = 0.35; c.lineWidth = 0.7; path(wob(rect(f, 0.9), 0.9, seed++)); c.stroke();
      c.globalAlpha = 1;
    }
    // covered walks dashed, pavilions with their roof's cross
    for (const f of F) {
      if (f.kind === 'corridor') { c.save(); c.setLineDash([3, 3]); c.strokeStyle = INK; c.globalAlpha = 0.6; c.lineWidth = 1; path(rect(f)); c.stroke(); c.restore(); }
      if (f.kind === 'pavilion') {
        const p = rect({ ...f, hw: 4.5, hd: 4.5 });
        c.strokeStyle = INK; c.globalAlpha = 0.8; c.lineWidth = 1.1; path(p); c.stroke();
        c.beginPath(); c.moveTo(...p[0]); c.lineTo(...p[2]); c.moveTo(...p[1]); c.lineTo(...p[3]); c.globalAlpha = 0.45; c.stroke(); c.globalAlpha = 1;
      }
    }
    // the old tree: a ring of its own leaves around the origin
    {
      const [x, y] = P(0, 0), r = 11 * PX;
      c.globalAlpha = 0.22; c.fillStyle = '#6c8a4a'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * TAU + 0.1, rr = r * (0.55 + 0.4 * ((i * 7) % 5) / 4);
        leaf(c, x + Math.cos(a) * rr, y + Math.sin(a) * rr, a + Math.PI / 2, PX * 2.6, i % 9 === 0 ? '#b5552f' : i % 4 === 0 ? '#7d8f3e' : '#4f7044', 0.75);
      }
      c.globalAlpha = 1; c.fillStyle = INK; c.beginPath(); c.arc(x, y, 2.2, 0, TAU); c.fill();
    }
    // (the places' names are written per frame, at a size the eye can read: see placeNames)
    c.globalAlpha = 0.9; c.font = `16px ${FONT_HAND}`; c.fillStyle = '#3d4a30';
    { const [x, y] = P(0, 0); c.fillText('百年榄仁树', x + 15 * PX, y - 13 * PX); c.font = `11px ${FONT_HAND}`; c.globalAlpha = 0.6; c.fillText('(0, 0)', x + 15 * PX, y - 9.5 * PX); }
    c.globalAlpha = 1;
    // lamps: the teaching blocks' windows, for the evening (drawn when lit)
    lit = document.createElement('canvas'); lit.width = SW; lit.height = SH;
    const lc = lit.getContext('2d');
    for (const f of F) if (f.kind === 'building' && /教学楼|科学馆|图书馆|宿舍/.test(f.name)) {
      const pts = rect(f, -1.5);
      lc.fillStyle = 'rgba(255, 196, 92, 0.85)';
      lc.beginPath(); pts.forEach(([x, y], i) => (i ? lc.lineTo(x, y) : lc.moveTo(x, y))); lc.closePath(); lc.fill();
    }
  }
  // the places' names: one per place, at the footprint's centre (the boys' dormitory once, on its spine)
  const NAMES = [];
  {
    const seen = new Set();
    for (const f of geo.features) {
      if (!f.name || f.kind === 'road' || seen.has(f.name)) continue;
      if (!['building', 'gate', 'water', 'botanic', 'garden', 'field', 'court', 'pavilion'].includes(f.kind)) continue;
      seen.add(f.name);
      NAMES.push({ name: f.name.replace('（推演）', ''), x: f.cx, z: f.cz + (f.kind === 'pavilion' ? 7 : 0), kind: f.kind, area: f.hw * f.hd, tall: f.hd > f.hw * 1.8 && f.kind === 'building' });
    }
    NAMES.sort((a, b) => b.area - a.area);
  }
  function placeNames(placed) {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const n of NAMES) {
      const [x, y] = toS(n.x, n.z);
      if (x < -60 || y < -60 || x > state.w + 60 || y > state.h + 60) continue;
      const big = n.area > 900, size = Math.round((big ? 13 : 11.5) * Math.min(1.25, Math.max(0.9, view.s / 2.4)));
      if (n.area < 120 && view.s < 2.2) continue;
      g.font = `${size}px ${FONT_SERIF}`;
      const w = n.tall ? size + 4 : g.measureText(n.name).width + 6, h = n.tall ? n.name.length * size * 1.05 + 4 : size + 4;
      const box = { x: x - w / 2, y: y - h / 2, w, h };
      if (placed.some((p) => box.x < p.x + p.w && box.x + box.w > p.x && box.y < p.y + p.h && box.y + box.h > p.y)) continue;
      placed.push(box);
      g.globalAlpha = n.kind === 'building' || n.kind === 'gate' ? 0.82 : 0.66; g.fillStyle = INK;
      if (n.tall) vertical(g, n.name, x, y, size); else g.fillText(n.name, x, y);
    }
    g.globalAlpha = 1; g.textBaseline = 'alphabetic';
  }
  function leaf(c, x, y, a, s, col, alpha) {
    // the 榄仁 leaf: obovate, widest near the tip, a midrib
    c.save(); c.translate(x, y); c.rotate(a); c.globalAlpha = alpha; c.fillStyle = col;
    c.beginPath(); c.moveTo(0, s * 0.55);
    c.bezierCurveTo(s * 0.42, s * 0.3, s * 0.5, -s * 0.45, 0, -s * 0.6);
    c.bezierCurveTo(-s * 0.5, -s * 0.45, -s * 0.42, s * 0.3, 0, s * 0.55);
    c.fill();
    c.globalAlpha = alpha * 0.6; c.strokeStyle = '#2a3320'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(0, s * 0.55); c.lineTo(0, -s * 0.5); c.stroke();
    c.restore();
  }
  function vertical(c, text, x, y, size) {
    const n = text.length;
    for (let i = 0; i < n; i++) c.fillText(text[i], x, y + (i - (n - 1) / 2) * size * 1.05);
  }

  // ---------------------------------------------------------------- the page, every frame
  function resize() {
    const r = canvas.getBoundingClientRect();
    state.dpr = Math.min(devicePixelRatio || 1, 2);
    state.w = r.width; state.h = r.height;
    canvas.width = Math.round(r.width * state.dpr); canvas.height = Math.round(r.height * state.dpr);
  }
  function draw(dt) {
    const W = state.w, Hh = state.h;
    g.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    g.fillStyle = '#e9dfc6'; g.fillRect(0, 0, W, Hh);
    const info = get();
    // the reveal: the plan draws outward from the tree
    state.reveal = Math.min(1, state.reveal + dt / (state.reveal < 1 ? 1.5 : 1));
    const rv = easeOut(state.reveal) * 520;
    const [ox, oy] = toS(0, 0);
    g.save();
    if (state.reveal < 1) {
      g.beginPath();
      for (let i = 0; i <= 96; i++) { const a = (i / 96) * TAU; const rr = rv * view.s * (0.86 + 0.28 * fbm(Math.cos(a) * 2 + 5, Math.sin(a) * 2 + state.t * 0.2)); g.lineTo(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr); }
      g.closePath(); g.clip();
    }
    // the visible part of the plan
    const [wx0, wz0] = toW(0, 0), [wx1, wz1] = toW(W, Hh);
    const sx = (wx0 - R.x0) * PX, sy = (wz0 - R.z0) * PX, sw = (wx1 - wx0) * PX, sh = (wz1 - wz0) * PX;
    g.imageSmoothingEnabled = true;
    g.drawImage(sheet, sx, sy, sw, sh, 0, 0, W, Hh);
    // weather on the page
    const wx = info.weather;
    if (wx.wet > 0.02) { g.globalAlpha = Math.min(0.32, wx.wet * 0.32); g.globalCompositeOperation = 'multiply'; g.drawImage(tinted(), sx, sy, sw, sh, 0, 0, W, Hh); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
    if (wx.lamps > 0.05) { g.globalAlpha = wx.lamps * 0.55; g.globalCompositeOperation = 'screen'; g.filter = 'blur(3px)'; g.drawImage(lit, sx, sy, sw, sh, 0, 0, W, Hh); g.filter = 'none'; g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
    g.restore();
    rain(dt, wx);
    // at night the page lies under a desk lamp: warm in the middle, the edges falling into the dark
    if (wx.night > 0.05) {
      const k = Math.min(1, wx.night);
      g.save(); g.globalCompositeOperation = 'multiply';
      const R0 = Math.hypot(W, Hh) * 0.62;
      const gr = g.createRadialGradient(W * 0.55, Hh * 0.45, R0 * 0.12, W * 0.5, Hh * 0.5, R0);
      gr.addColorStop(0, `rgba(255, 236, 200, ${0.0})`); gr.addColorStop(0.55, `rgba(214, 190, 150, ${0.35 * k})`); gr.addColorStop(1, `rgba(70, 60, 55, ${0.75 * k})`);
      g.fillStyle = gr; g.fillRect(0, 0, W, Hh); g.restore();
    }
    // the life on the page
    const ms = info.clock;
    if (state.day.on) dayTraces(ms);
    const items = [];
    for (const a of life.agents) {
      const s = a.state;
      if (!s || s.away) continue;
      const ink = INKS[a.id] || INK;
      if (s.inside) { items.push({ kind: 'inside', a, ink, x: s.x, z: s.z, label: a.person.name, sub: `${s.label} · ${s.what}` }); }
      const steps = stepsFor(a, ms);
      drawSteps(steps, ink, a.person.kind === 'teacher' ? 1.4 : 1.32, 'shoe');
      if (!s.inside) {
        const p = a.live || s;
        items.push({ kind: 'out', a, ink, x: p.x, z: p.z, label: a.person.name, sub: s.act === 'walk' ? `去${s.toLabel}${s.going ? '（' + s.going + '）' : ''}` : `${s.label} · ${s.what}` });
      }
    }
    // the cat: paw prints
    if (info.cat) {
      const ct = state.catTrail, c = info.cat;
      const last = ct[ct.length - 1];
      if (!last || Math.hypot(c.x - last.x, c.z - last.z) > 0.32) { ct.push({ x: c.x, z: c.z, t: ms, yaw: last ? Math.atan2(c.x - last.x, c.z - last.z) : 0, side: last ? -last.side : 1 }); if (ct.length > 300) ct.shift(); }
      drawSteps(ct.filter((p) => ms - p.t < 240000), INKS.cat, 1.05, 'paw', ms);
      items.push({ kind: 'out', a: { id: 'cat', person: { name: '橘猫' } }, ink: INKS.cat, x: c.x, z: c.z, label: '橘猫', sub: c.label || '' });
    }
    // where you painted the tree: the easel still stands there, with its charcoal
    if (info.easel) {
      const [ex, ey] = toS(info.easel.x, info.easel.z);
      g.save(); g.translate(ex, ey); g.strokeStyle = INKS.you; g.globalAlpha = 0.75; g.lineWidth = 1.1; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-5, 6); g.lineTo(0, -7); g.lineTo(5, 6); g.moveTo(0, -7); g.lineTo(0, 7); g.moveTo(-6, -1); g.lineTo(6, -1); g.stroke();
      g.globalAlpha = 0.65; g.fillStyle = INKS.you; g.font = `11px ${FONT_HAND}`; g.textAlign = 'center'; g.fillText('写生处', 0, 18);
      g.restore(); g.globalAlpha = 1;
    }
    // you
    if (info.player) {
      drawSteps(info.playerSteps.filter((p) => ms - p.t < 240000), INKS.you, 1.32, 'shoe', ms);
      const [px, py] = toS(info.player.x, info.player.z);
      // where you are looking: a pencil wedge
      const th = Math.atan2(Math.cos(info.player.camYaw), Math.sin(info.player.camYaw));
      g.fillStyle = 'rgba(176, 32, 28, 0.1)'; g.beginPath(); g.moveTo(px, py); g.arc(px, py, 46, th - 0.42, th + 0.42); g.closePath(); g.fill();
      g.fillStyle = INKS.you; g.beginPath(); g.arc(px, py, 3.4, 0, TAU); g.fill();
      g.strokeStyle = INKS.you; g.lineWidth = 1; g.beginPath(); g.arc(px, py, 7 + Math.sin(state.t * 2.4) * 1.2, 0, TAU); g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1;
      items.push({ kind: 'you', a: { id: 'you', person: { name: '你' } }, ink: INKS.you, x: info.player.x, z: info.player.z, label: '你', sub: '' });
    }
    labels(items);
    state.items = items;
    frameMarks(info);
    state.t += dt;
    if (state.follow) { const it = items.find((i) => i.a.id === state.follow); if (it) { view.cx += (it.x - view.cx) * (1 - Math.exp(-dt * 3)); view.cz += (it.z - view.cz) * (1 - Math.exp(-dt * 3)); } }
  }
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  // 今日足迹: every path walked since six in the morning, in pencil, each in its person's ink. Worked out a
  // little each frame (the day's walks need their paths found), so the lines draw themselves onto the page
  function dayTraces(ms) {
    const D = state.day, t0 = performance.now();
    const start = ms - ((((ms / 3600000 + 8) % 24) + 24) % 24 - 6) * 3600000;           // 06:00 Haikou today
    if (D.from !== start) { D.from = start; D.traces = {}; D.cursor = {}; }
    for (const a of life.agents) {
      const tr = D.traces[a.id] || (D.traces[a.id] = [[]]);
      let t = D.cursor[a.id] ?? start;
      while (t < ms && performance.now() - t0 < 7) {
        const s = life.stateOf(a.id, t);
        const seg = tr[tr.length - 1];
        if (s.inside || s.away) { if (seg.length) tr.push([]); }
        else { const last = seg[seg.length - 1]; if (!last || Math.hypot(s.x - last.x, s.z - last.z) > 1.2) { if (last && Math.hypot(s.x - last.x, s.z - last.z) > 40) tr.push([{ x: s.x, z: s.z }]); else seg.push({ x: s.x, z: s.z }); } }
        t += 15000;
      }
      D.cursor[a.id] = t;
    }
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    for (const a of life.agents) {
      const tr = D.traces[a.id]; if (!tr) continue;
      g.strokeStyle = INKS[a.id] || INK; g.globalAlpha = 0.28; g.lineWidth = 1.1;
      for (const seg of tr) {
        if (seg.length < 2) continue;
        g.beginPath();
        seg.forEach((q, i) => { const [x, y] = toS(q.x, q.z); i ? g.lineTo(x, y) : g.moveTo(x, y); });
        g.stroke();
      }
    }
    g.restore(); g.globalAlpha = 1;
  }
  let tintCanvas = null;
  function tinted() {
    if (tintCanvas) return tintCanvas;
    tintCanvas = document.createElement('canvas'); tintCanvas.width = SW; tintCanvas.height = SH;
    const t = tintCanvas.getContext('2d');
    t.drawImage(roads, 0, 0); t.globalCompositeOperation = 'source-in'; t.fillStyle = '#6f8ea0'; t.fillRect(0, 0, SW, SH);
    t.globalCompositeOperation = 'destination-over'; t.fillStyle = '#ffffff'; t.fillRect(0, 0, SW, SH);
    return tintCanvas;
  }
  function stepsFor(a, ms) {
    if (a.live && a.live.steps && a.live.steps.length) {
      // the body's real footsteps while it walks near you, the day's before that
      const now = performance.now();
      const live = a.live.steps.filter((p) => now - p.t < 150000).map((p) => ({ ...p, t: ms - (now - p.t) }));
      const tFirst = live.length ? live[0].t : ms;
      return life.steps(a.person, tFirst, 150 - (ms - tFirst) / 1000).concat(live);
    }
    if (!a._steps || ms - a._stepsAt > 900 || ms < a._stepsAt) { a._steps = life.steps(a.person, ms, 150); a._stepsAt = ms; }
    return a._steps;
  }
  // footprints, thinned to what the page can show at this scale, drying as they age
  function drawSteps(steps, ink, size, kind, msNow) {
    const ms = msNow ?? get().clock;
    let lastX = -1e9, lastY = -1e9, side = 1;
    const gap = kind === 'paw' ? 8 : 11;
    for (let i = steps.length - 1; i >= 0; i--) {
      const p = steps[i];
      const [x, y] = toS(p.x, p.z);
      if (x < -20 || y < -20 || x > state.w + 20 || y > state.h + 20) { lastX = -1e9; continue; }
      if (Math.hypot(x - lastX, y - lastY) < gap) continue;
      lastX = x; lastY = y; side = -side;
      const age = Math.max(0, (ms - p.t) / 1000);
      const alpha = Math.max(0, 0.95 - age / 170) * (age < 1 ? age : 1) + (age < 1 ? 0.0 : 0);
      if (alpha <= 0.02) continue;
      const fresh = age < 2.5 ? 1 + (2.5 - age) * 0.08 : 1;
      g.save(); g.translate(x + Math.cos(p.yaw) * side * 2.4, y - Math.sin(p.yaw) * side * 2.4); g.rotate(-p.yaw + Math.PI);
      g.globalAlpha = Math.min(1, alpha + 0.15); g.fillStyle = ink;
      if (kind === 'paw') {
        const s = size * fresh;
        g.beginPath(); g.ellipse(0, 1.2 * s, 1.6 * s, 1.3 * s, 0, 0, TAU); g.fill();
        for (const [tx, ty] of [[-1.5, -0.9], [-0.5, -1.7], [0.5, -1.7], [1.5, -0.9]]) { g.beginPath(); g.arc(tx * s, ty * s, 0.55 * s, 0, TAU); g.fill(); }
      } else {
        const s = size * fresh * (p.run ? 0.92 : 1);
        g.beginPath(); g.ellipse(0, -1.3 * s, 1.35 * s, 2.0 * s, 0, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(0, 2.2 * s, 1.05 * s, 1.15 * s, 0, 0, TAU); g.fill();
      }
      g.restore();
    }
    g.globalAlpha = 1;
  }
  function labels(items) {
    g.textBaseline = 'alphabetic';
    // people indoors: stacked in graphite inside their building
    const inside = new Map();
    for (const it of items) if (it.kind === 'inside') { const k = it.x.toFixed(0) + ',' + it.z.toFixed(0); if (!inside.has(k)) inside.set(k, []); inside.get(k).push(it); }
    for (const list of inside.values()) {
      list.forEach((it, i) => {
        const [x, y] = toS(it.x, it.z);
        const yy = y - 14 - i * 26;
        g.globalAlpha = 0.55 + 0.12 * Math.sin(state.t * 1.3 + i);
        g.fillStyle = it.ink; g.font = `600 13px ${FONT_HAND}`; g.textAlign = 'center';
        g.fillText(it.label, x, yy);
        g.globalAlpha = 0.5; g.fillStyle = '#4a463e'; g.font = `11px ${FONT_HAND}`;
        g.fillText('（' + it.sub + '）', x, yy + 12);
        it.hit = { x: x - 40, y: yy - 14, w: 80, h: 28 };
      });
    }
    g.globalAlpha = 1;
    // outdoors: a leader line to the name; names try four corners and take the first that is free
    const placed = [];
    for (const list of inside.values()) for (const it of list) if (it.hit) placed.push(it.hit);
    const order = items.filter((it) => it.kind !== 'inside').sort((a, b) => (a.kind === 'you' ? -1 : b.kind === 'you' ? 1 : 0));
    for (const it of order) {
      const [x, y] = toS(it.x, it.z);
      if (it.kind !== 'you') { g.fillStyle = it.ink; g.beginPath(); g.arc(x, y, 2.6, 0, TAU); g.fill(); }
      g.font = `600 ${it.kind === 'you' ? 15 : 14}px ${FONT_HAND}`;
      const w0 = g.measureText(it.label).width;
      g.font = `11px ${FONT_HAND}`;
      const w1 = it.sub ? g.measureText(it.sub).width : 0;
      const bw = Math.max(w0, w1) + 6, bh = it.sub ? 31 : 19;
      let box = null;
      for (const [dx, dy, al] of [[12, -12, 'l'], [12, 18 + (it.sub ? 12 : 0), 'l'], [-12, -12, 'r'], [-12, 18 + (it.sub ? 12 : 0), 'r'], [12, -40, 'l'], [-12, -40, 'r']]) {
        const bx = al === 'l' ? x + dx - 3 : x + dx - bw + 3, by = y + dy - 15;
        const cand = { x: bx, y: by, w: bw, h: bh, lx: al === 'l' ? x + dx : x + dx, ly: y + dy, al };
        if (!placed.some((p) => cand.x < p.x + p.w && cand.x + cand.w > p.x && cand.y < p.y + p.h && cand.y + cand.h > p.y)) { box = cand; break; }
      }
      if (!box) box = { x: x + 9, y: y - 27, w: bw, h: bh, lx: x + 12, ly: y - 12, al: 'l' };
      placed.push(box);
      g.strokeStyle = it.ink; g.globalAlpha = 0.5; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(box.al === 'l' ? box.lx - 2 : box.lx + 2, box.ly - 4); g.stroke();
      g.globalAlpha = 1; g.textAlign = box.al === 'l' ? 'left' : 'right';
      g.font = `600 ${it.kind === 'you' ? 15 : 14}px ${FONT_HAND}`; g.fillStyle = it.ink;
      g.fillText(it.label, box.lx, box.ly);
      if (it.sub) { g.font = `11px ${FONT_HAND}`; g.globalAlpha = 0.78; g.fillText(it.sub, box.lx, box.ly + 13); g.globalAlpha = 1; }
      it.hit = { x: Math.min(x - 8, box.x), y: Math.min(y - 8, box.y), w: Math.abs(box.x - x) + box.w + 8, h: Math.max(box.h, Math.abs(box.y - y) + 8) + 8 };
      if (state.selected === it.a.id) { g.strokeStyle = it.ink; g.globalAlpha = 0.6; g.setLineDash([2, 3]); g.strokeRect(box.x - 2, box.y - 1, box.w + 4, box.h + 2); g.setLineDash([]); g.globalAlpha = 1; }
    }
    placeNames(placed);
  }
  // the compass (a 榄仁 leaf pointing to the North Gate), the scale, the seal
  function frameMarks(info) {
    const W = state.w, Hh = state.h;
    const cx = W - 46, cy = 92;
    g.save(); g.globalAlpha = 0.85;
    leaf(g, cx, cy, 0, 30, '#5a7a48', 0.85);
    g.fillStyle = INK; g.font = `13px ${FONT_HAND}`; g.textAlign = 'center'; g.fillText('北门', cx, cy - 22);
    g.font = `10px ${FONT_HAND}`; g.globalAlpha = 0.55; g.fillText('校园坐标 · 非真北', cx, cy + 30);
    g.restore();
    // scale bar
    const m = view.s > 4 ? 20 : 50, L = m * view.s, x0 = 30, y0 = Hh - 62;
    g.strokeStyle = INK; g.lineWidth = 1.2; g.globalAlpha = 0.75;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + L, y0); g.moveTo(x0, y0 - 4); g.lineTo(x0, y0 + 4); g.moveTo(x0 + L, y0 - 4); g.lineTo(x0 + L, y0 + 4); g.moveTo(x0 + L / 2, y0 - 2.5); g.lineTo(x0 + L / 2, y0 + 2.5); g.stroke();
    g.fillStyle = INK; g.font = `11px ${FONT_HAND}`; g.textAlign = 'left'; g.fillText(m + ' 米', x0 + L + 6, y0 + 4);
    g.globalAlpha = 1;
    void info;
  }
  // rain on the page: drops bloom and dry
  function rain(dt, wx) {
    const B = state.blooms;
    if (wx.rain > 0.05) {
      state.lastSpawn += dt * wx.rain * 9;
      while (state.lastSpawn > 1) {
        state.lastSpawn -= 1;
        const [x, z] = toW(Math.random() * state.w, Math.random() * state.h);
        B.push({ x, z, r: 3 + Math.random() * 9, age: 0, life: 14 + Math.random() * 18, seed: Math.random() * 100 });
      }
    }
    for (let i = B.length - 1; i >= 0; i--) {
      const b = B[i]; b.age += dt;
      if (b.age > b.life) { B.splice(i, 1); continue; }
      const [x, y] = toS(b.x, b.z);
      const grow = Math.min(1, b.age / 0.6), dry = 1 - b.age / b.life;
      const r = b.r * (0.7 + 0.5 * grow);
      g.save(); g.globalCompositeOperation = 'multiply';
      const gr = g.createRadialGradient(x, y, r * 0.2, x, y, r);
      gr.addColorStop(0, `rgba(170, 160, 140, ${0.10 * dry})`); gr.addColorStop(0.82, `rgba(150, 140, 120, ${0.16 * dry})`); gr.addColorStop(1, `rgba(120, 110, 95, ${0.32 * dry})`);
      g.fillStyle = gr; g.beginPath();
      for (let k = 0; k <= 20; k++) { const a = (k / 20) * TAU; const rr = r * (0.85 + 0.25 * vnoise(b.seed + Math.cos(a) * 1.6, Math.sin(a) * 1.6)); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      g.closePath(); g.fill(); g.restore();
    }
    if (B.length > 220) B.splice(0, B.length - 220);
  }

  // ---------------------------------------------------------------- reading the page: drag, zoom, tap
  const pts = new Map();
  let drag = null, pinch = null, moved = 0;
  canvas.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, [e.clientX, e.clientY]); canvas.setPointerCapture?.(e.pointerId); moved = 0; if (pts.size === 1) drag = { x: e.clientX, y: e.clientY }; else { drag = null; pinch = null; } });
  canvas.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / pinch);
      pinch = d; moved += 10; return;
    }
    if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved += Math.abs(dx) + Math.abs(dy); view.cx -= dx / view.s; view.cz -= dy / view.s; drag = { x: e.clientX, y: e.clientY }; state.follow = null; clampView(); }
  });
  const up = (e) => {
    if (pts.size === 1 && moved < 6) tap(e.clientX, e.clientY);
    pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) drag = null;
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); drag = null; pinch = null; });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  function zoomAt(cx, cy, k) {
    const r = canvas.getBoundingClientRect();
    const [wx, wz] = toW(cx - r.left, cy - r.top);
    view.s = Math.min(9, Math.max(fitScale() * 0.85, view.s * k));
    view.cx = wx - (cx - r.left - state.w / 2) / view.s; view.cz = wz - (cy - r.top - state.h / 2) / view.s;
    clampView();
  }
  const fitScale = () => Math.min(state.w / (R.x1 - R.x0), state.h / (R.z1 - R.z0));
  function clampView() { view.cx = Math.min(R.x1, Math.max(R.x0, view.cx)); view.cz = Math.min(R.z1, Math.max(R.z0, view.cz)); }
  function tap(cx, cy) {
    const r = canvas.getBoundingClientRect();
    const x = cx - r.left, y = cy - r.top;
    const hit = (state.items || []).find((it) => it.hit && x >= it.hit.x && x <= it.hit.x + it.hit.w && y >= it.hit.y && y <= it.hit.y + it.hit.h);
    state.selected = hit && hit.a.id !== 'you' ? hit.a.id : null;
    onSelect?.(state.selected);
  }
  let onSelect = null;

  return {
    get isOpen() { return state.open; },
    open(center) {
      build(); resize();
      state.open = true; state.reveal = 0; state.t = 0;
      view.s = Math.max(fitScale() * 1.25, Math.min(3.0, Math.min(state.w, state.h) / 240));
      if (center) { view.cx = center.x; view.cz = center.z; }
      clampView();
    },
    close() { state.open = false; state.follow = null; },
    frame(dt) { if (state.open) draw(dt); },
    resize: () => { if (state.open) resize(); },
    select(id) { state.selected = id; },
    follow(id) { state.follow = id; },
    /** 今日足迹 on/off */
    toggleDay(on = !state.day.on) { state.day.on = on; return on; },
    get dayOn() { return state.day.on; },
    center(x, z) { view.cx = x; view.cz = z; clampView(); },
    onSelect(fn) { onSelect = fn; },
    get view() { return view; },
    get items() { return state.items || []; },
    toScreen: toS,
  };
}
