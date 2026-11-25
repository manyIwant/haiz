// 抽出一年 · NIANLUN interaction study 003
//
// One gesture, three depths, no menus:
//   the trunk   a cross-section of 104 rings (1923 at the pith, this year under the bark).
//               The rings swell under your finger so a 2 px year can be found.
//   a year      press a ring and pull: it lifts out of the wood as an elastic loop (the
//               trunk closes up behind it); let go and it opens at New Year and rolls along
//               a rail like a hand-scroll, printing its 365 days as a band of wood.
//   a day       slide along the band: the days swell (fisheye). Pull one day off the band,
//               or tap it, and it opens into that day's sky — the real sun path over the
//               campus, that day's cloud, rain and wind; the band becomes the horizon.
// Every step runs backwards the same way it came: the day folds into its cell, the band
// rolls up into a ring, the ring flies home and the trunk makes room for it again.
import { loadClimate, yearStart, yearLength, parts, FIRST_YEAR, SCHOOL_YEAR } from './lib/rings/climate.js';
import { layout, colourOf, wobble } from './lib/rings/disc.js';
import { describeDay, sunTimes, moonAt, msOf } from './lib/rings/almanac.js';
import { createRenderer } from './gl.js';
import * as Sky from './sky.js';
import { Spring, stepParticles, fisheye, fisheyeInv, clamp, lerp, smooth } from './physics.js';
import { ENTRIES, GRADES, entriesOfYear } from './content.js';
import { sound } from './sound.js';

const TAU = Math.PI * 2;
const $ = (s) => document.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const STEMS = '甲乙丙丁戊己庚辛壬癸', BRANCH = '子丑寅卯辰巳午未申酉戌亥';
const ganzhi = (y) => STEMS[(y - 4) % 10] + BRANCH[(y - 4) % 12];
const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const fmtClock = (m) => `${Math.floor(m / 60)}:${String(Math.floor(m % 60)).padStart(2, '0')}`;

// ------------------------------------------------------------------ DOM
const skyCanvas = $('#sky'), glCanvas = $('#wood');
const skyCtx = skyCanvas.getContext('2d');
const R = createRenderer(glCanvas);
const ui = {
  hud: $('#hud'), hudYear: $('#hud .y'), hudGz: $('#hud .gz'), hudFacts: $('#hud .facts'), hudEvents: $('#hud .events'),
  hint: $('#hint'), title: $('#title'), tag: $('#tag'), slip: $('#slip'), months: $('#months'),
  day: $('#day'), knots: $('#knots'), rhint: $('#rhint'), corner: $('#corner'), close: $('#close'), live: $('#live'), clock: $('#clock'), quote: $('#quote')
};

// ------------------------------------------------------------------ state
let climate, lay, nR, E0, E1;
let W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
let portrait = H > W * 1.1;
let L = {};                 // layout numbers for the current viewport
let level = 'disc';         // disc | ribbon | day

const disc = {
  cx: new Spring(0, { stiffness: 120, damping: 20 }), cy: new Spring(0, { stiffness: 120, damping: 20 }),
  R: new Spring(1, { stiffness: 120, damping: 20 }), dim: new Spring(0),
  fishAmt: new Spring(0, { stiffness: 220, damping: 28 }), focus: 0.5,
  hover: -1, hoverAmt: new Spring(0, { stiffness: 300, damping: 30 }),
  gap: new Spring(0, { stiffness: 140, damping: 16 }), pulled: -1,
  alpha: new Spring(1)
};
const lutN = 1024, lutMax = 1.22;
const lutArr = new Float32Array(lutN);

// the band: one year, n = days + 1 nodes (day boundaries)
const band = {
  k: -1, y: 0, len: 365, start: -1, n: 0,
  X: null, V: null, T: null, K: null, half: null, halfV: null, halfT: null, us: null, normals: null,
  phase: null,            // pull | fly | roll | laid | rewind | home
  cx: new Spring(0, { stiffness: 150, damping: 19 }), cy: new Spring(0, { stiffness: 150, damping: 19 }),
  Rr: new Spring(0, { stiffness: 150, damping: 19 }), rho: new Spring(0, { stiffness: 150, damping: 19 }),
  s: new Spring(0, { stiffness: 38, damping: 12.5 }),
  fishAmt: new Spring(0, { stiffness: 260, damping: 30 }), focus: 0,
  railX: new Spring(0, { stiffness: 130, damping: 22 }), railY: new Spring(0, { stiffness: 130, damping: 22 }),
  halfBase: new Spring(10, { stiffness: 130, damping: 22 }),
  grab: 0, tethered: true, lift: 0, focusDay: -1
};
const day = {
  sel: -1, reveal: new Spring(0, { stiffness: 120, damping: 21 }), minutes: new Spring(840, { stiffness: 60, damping: 15 }),
  from: { x: 0, y: 0, w: 1, h: 1 }, time: 0
};

// ------------------------------------------------------------------ layout
function computeLayout() {
  W = innerWidth; H = innerHeight; dpr = Math.min(2, devicePixelRatio || 1);
  portrait = H > W * 1.1;
  if (portrait) {
    const len = Math.max(300, (H - 130) / (1 + 1 / TAU)), y0 = H - 50 - len, railX = W - 58;
    L = {
      disc: { cx: W / 2, cy: H * 0.5, R: Math.min(W * 0.43, H * 0.3) },
      corner: { cx: 46, cy: 50, R: 30 },
      rail: { x: railX, y: y0, len, psi: Math.PI / 2, half: 13, d: 9, laidX: railX, laidY: y0 },
      dayRail: { x: W - 22, y: y0, half: 8, d: 16 }
    };
  } else {
    const len = Math.min((W - 110) / (1 + 1 / Math.PI), 1400, (H * 0.62) * Math.PI);
    L = {
      disc: { cx: W * 0.5, cy: H * 0.53, R: Math.min(H * 0.37, W * 0.28) },
      corner: { cx: 72, cy: 72, R: 44 },
      rail: { x: (W - len) / 2 + len / TAU / 2, y: Math.round(H * 0.3), len, psi: 0, half: clamp(len / 46, 14, 24), d: 5, laidX: (W - len) / 2 + 40, laidY: Math.round(H * 0.47) },
      dayRail: { x: (W - len) / 2, y: H - 70, half: 11, d: 12 }
    };
  }
  L.rail.wheel = L.rail.len / TAU;
  skyCanvas.width = Math.round(W * dpr); skyCanvas.height = Math.round(H * dpr);
  skyCanvas.style.width = W + 'px'; skyCanvas.style.height = H + 'px';
  R && R.resize(W, H, dpr);
  document.body.classList.toggle('portrait', portrait);
}

function discTargets(immediate) {
  const t = level === 'disc' ? L.disc : L.corner;
  for (const [s, v] of [[disc.cx, t.cx], [disc.cy, t.cy], [disc.R, t.R]]) immediate ? s.set(v) : s.to(v);
  disc.dim.to(level === 'disc' ? 0 : 0.08);
}
function railTargets(immediate) {
  const r = level === 'day' ? L.dayRail : L.rail;
  const half = r.half;
  const laid = level === 'day' || band.phase === 'laid';
  const x = level === 'day' ? L.rail.laidX : laid ? L.rail.laidX : r.x;
  const y = level === 'day' ? r.y : laid ? L.rail.laidY : r.y;
  const rx = portrait && level === 'day' ? r.x : x;
  immediate ? band.railX.set(rx) : band.railX.to(rx);
  immediate ? band.railY.set(y) : band.railY.to(y);
  immediate ? band.halfBase.set(half) : band.halfBase.to(half);
}

// ------------------------------------------------------------------ the trunk's geometry
// widths after a year has been pulled out (the others close up), then a radial fisheye
let gapEdges = null;
function computeGapEdges() {
  const e = lay.edges;
  const pk = disc.pulled, g = clamp(disc.gap.x, 0, 1.2);
  const groove = 2 / Math.max(20, disc.R.x);
  const ws = new Float64Array(nR);
  let sum = 0;
  for (let k = 0; k < nR; k++) {
    let w = e[k + 1] - e[k];
    if (k === pk) w = lerp(w, groove, clamp(g));
    ws[k] = w; sum += w;
  }
  const scale = (E1 - E0) / sum;
  gapEdges = new Float64Array(nR + 1);
  gapEdges[0] = E0;
  for (let k = 0; k < nR; k++) gapEdges[k + 1] = gapEdges[k] + ws[k] * scale;
}
const findRing = (edges, r) => {
  if (r < edges[0] || r >= edges[nR]) return -1;
  let lo = 0, hi = nR - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (edges[mid] <= r) lo = mid; else hi = mid - 1; }
  return lo;
};
const fishD = () => (coarse || portrait ? 7 : 3.4) * disc.fishAmt.x;
/** original radius → screen radius (disc units) */
function discForward(rn) {
  if (rn < E0 || rn >= E1) return rn;
  const k = findRing(lay.edges, rn), e = lay.edges;
  const t = (rn - e[k]) / (e[k + 1] - e[k]);
  const rg = gapEdges[k] + t * (gapEdges[k + 1] - gapEdges[k]);
  return fisheye(rg, disc.focus, E0, E1, fishD());
}
/** screen radius → original radius; -1 inside the groove */
function discInverse(rs) {
  if (rs < E0 || rs >= E1) return rs;
  const rg = fisheyeInv(rs, disc.focus, E0, E1, fishD());
  const k = findRing(gapEdges, rg);
  if (k < 0) return rs;
  if (k === disc.pulled && disc.gap.x > 0.02) return -1;
  const e = lay.edges, t = (rg - gapEdges[k]) / (gapEdges[k + 1] - gapEdges[k]);
  return e[k] + t * (e[k + 1] - e[k]);
}
function updateLUT() {
  computeGapEdges();
  for (let i = 0; i < lutN; i++) lutArr[i] = discInverse((i / (lutN - 1)) * lutMax);
  R.setLUT(lutArr);
}
/** what is under a screen point of the trunk */
function discPick(px, py) {
  const R0 = disc.R.x;
  const dx = (px - disc.cx.x) / R0, dy = (py - disc.cy.x) / R0;
  const rr = Math.hypot(dx, dy);
  const th = (Math.atan2(dx, -dy) + TAU) % TAU;
  const rs = rr / wobble(th);
  const rn = discInverse(rs);
  const k = rn < 0 ? -1 : findRing(lay.edges, rn);
  return { k, th, rs, rr, inside: rs < E1 + 0.06 };
}

// ------------------------------------------------------------------ data → textures
function buildTextures() {
  const cols = 366;
  const data = new Uint8Array(cols * nR * 4), flags = new Uint8Array(cols * nR * 4);
  for (let k = 0; k < nR; k++) {
    const y = SCHOOL_YEAR + k, len = yearLength(y), s = y >= FIRST_YEAR ? yearStart(y) : -1;
    let doy = 0;
    for (let m = 1; m <= 12; m++) {
      flags[(k * cols + doy) * 4] = 255;
      doy += new Date(Date.UTC(y, m, 0)).getUTCDate();
    }
    for (let d = 0; d < cols; d++) {
      const o = (k * cols + d) * 4;
      if (d >= len) { data[o + 3] = 0; continue; }
      if (s < 0) { data[o + 3] = 60; continue; }
      const i = s + d;
      if (i >= climate.days) { data[o + 3] = 120; continue; }
      const c = colourOf(climate, i, 'wood');
      data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
      if ((climate.value('gust', i) ?? 0) >= 89) flags[o + 2] = 255;
    }
    for (const e of entriesOfYear(y)) {
      if (e.when === 'day' || e.when === 'about') flags[(k * cols + dayOfYear(y, e.m, e.d)) * 4 + 1] = 255;
      if (e.when === 'month') {
        const a = dayOfYear(y, e.m, 1), n = new Date(Date.UTC(y, e.m, 0)).getUTCDate();
        for (let d = a; d < a + n; d++) flags[(k * cols + d) * 4 + 1] = Math.max(flags[(k * cols + d) * 4 + 1], 160);
      }
    }
  }
  R.setDays(data, flags, cols, nR, SCHOOL_YEAR);
  R.setEdges(new Float32Array(lay.edges));
}
const dayOfYear = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000);
const dateOf = (y, doy) => { const t = new Date(Date.UTC(y, 0, 1 + doy)); return { y, m: t.getUTCMonth() + 1, d: t.getUTCDate(), wd: t.getUTCDay() }; };

// ------------------------------------------------------------------ band shapes
function allocBand(k) {
  const y = SCHOOL_YEAR + k, len = yearLength(y), n = len + 1;
  Object.assign(band, {
    k, y, len, n, start: y >= FIRST_YEAR ? yearStart(y) : -1,
    X: new Float32Array(n * 2), V: new Float32Array(n * 2), T: new Float32Array(n * 2), K: new Float32Array(n),
    half: new Float32Array(n), halfV: new Float32Array(n), halfT: new Float32Array(n),
    us: Float32Array.from({ length: n }, (_, j) => j), normals: new Float32Array(n * 2), focusDay: -1
  });
}
/** the ring in its place in the trunk (follows the trunk wherever it is) */
function slotTargets() {
  const e = lay.edges, k = band.k;
  const r0 = discForward(e[k] + 1e-6), r1 = discForward(e[k + 1] - 1e-6);
  // the groove: while the ring is away its screen place is the groove's, so aim at its middle
  const rg0 = gapEdges[k], rg1 = gapEdges[k + 1];
  const mid = disc.gap.x > 0.02 ? fisheye((rg0 + rg1) / 2, disc.focus, E0, E1, fishD()) : (r0 + r1) / 2;
  const half = Math.max(0.6, ((r1 - r0) / 2) * disc.R.x);
  for (let j = 0; j < band.n; j++) {
    const th = (j / band.len) * TAU;
    const r = mid * wobble(th) * disc.R.x;
    band.T[j * 2] = disc.cx.x + Math.sin(th) * r;
    band.T[j * 2 + 1] = disc.cy.x - Math.cos(th) * r;
    band.halfT[j] = half;
  }
  return { mid: mid * disc.R.x, half };
}
function loopTargets(cx, cy, Rr, rho, half) {
  for (let j = 0; j < band.n; j++) {
    const th = (j / band.len) * TAU + rho;
    band.T[j * 2] = cx + Math.sin(th) * Rr;
    band.T[j * 2 + 1] = cy - Math.cos(th) * Rr;
    band.halfT[j] = half;
  }
}
const rot = (x, y, psi) => [x * Math.cos(psi) - y * Math.sin(psi), x * Math.sin(psi) + y * Math.cos(psi)];
/** the hand-scroll: s px laid along the rail, the rest still wound on a wheel of radius Rw */
function rollTargets(s) {
  const { len: Lr, psi } = L.rail, Rw = L.rail.wheel;
  const gx = band.railX.x, gy = band.railY.x;
  const amt = band.phase === 'laid' ? band.fishAmt.x : 0;
  const dd = (level === 'day' ? L.dayRail.d : L.rail.d) * amt;
  const f = band.focus;
  const sigma = level === 'day' ? 60 : 38;
  for (let j = 0; j < band.n; j++) {
    const sj = (j / band.len) * Lr;
    let lx, ly;
    if (sj <= s) { lx = fisheye(sj, f, 0, Lr, dd); ly = 0; }
    else { const b = (sj - s) / Rw; lx = s + Rw * Math.sin(b); ly = Rw - Rw * Math.cos(b); }
    const [x, y] = rot(lx, ly, psi);
    band.T[j * 2] = gx + x; band.T[j * 2 + 1] = gy + y;
    const bulge = sj <= s && amt > 0 ? 1 + 0.75 * amt * Math.exp(-(((lx - f) / sigma) ** 2)) : 1;
    band.halfT[j] = band.halfBase.x * bulge;
  }
}
/** wheel centre for a given s */
function wheelCentre(s) {
  const [x, y] = rot(s, L.rail.wheel, L.rail.psi);
  return { x: band.railX.x + x, y: band.railY.x + y };
}

// ------------------------------------------------------------------ transitions
function pullStart(k, th, px, py) {
  allocBand(k);
  disc.pulled = k;
  computeGapEdges();
  const { mid, half } = slotTargets();
  band.X.set(band.T); band.V.fill(0);
  band.half.set(band.halfT); band.halfV.fill(0);
  band.grab = Math.round((th / TAU) * band.len) % band.len;
  band.cx.set(disc.cx.x); band.cy.set(disc.cy.x); band.Rr.set(mid); band.rho.set(0);
  band.phase = 'pull'; band.tethered = true; band.lift = 0; band.fibre = 0; band.month = 0;
  band.pull = { x0: px, y0: py, x: px, y: py, mid, half };
  disc.gap.to(1);
  if (ptr.mode !== 'intro') ui.hint.classList.add('gone');
  haptic(6);
}
function goRibbon() {
  level = 'ribbon';
  band.phase = 'fly';
  railTargets(false);
  const c = wheelCentre(0);
  band.cx.to(c.x); band.cy.to(c.y); band.Rr.to(L.rail.wheel);
  // shortest turn to the rail's frame
  let target = L.rail.psi;
  while (target - band.rho.x > Math.PI) target -= TAU;
  while (target - band.rho.x < -Math.PI) target += TAU;
  band.rho.to(target);
  band.s.set(0);
  disc.gap.to(1);
  discTargets(false);
  disc.fishAmt.to(0); disc.hoverAmt.to(0);
  showHud(-1);
  document.body.dataset.level = 'ribbon';
  announce(`抽出了 ${band.y} 年。沿着它滑动看每一天；点一天，打开那天的天空。`);
  renderSlip();
  renderKnots();
}
// the year's dated events, written beside their knots so the band can be read without searching
let knotEls = [];
function renderKnots() {
  ui.knots.innerHTML = '';
  const list = entriesOfYear(band.y).filter((e) => e.when !== 'year')
    .map((e) => ({ e, d: e.when === 'month' ? dayOfYear(e.y, e.m, 15) : dayOfYear(e.y, e.m, e.d) }))
    .sort((a, b) => a.d - b.d);
  // events a few days apart share one label, one line each
  const groups = [];
  for (const it of list) {
    const g = groups[groups.length - 1];
    if (g && it.d - g[g.length - 1].d < 20) g.push(it); else groups.push([it]);
  }
  knotEls = groups.map((g, n) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'knot ' + g[0].e.kind + (n % 2 ? ' alt' : '');
    b.innerHTML = g.map(({ e }) => `<em class="${e.kind}"><span>${e.when === 'month' ? e.m + ' 月' : e.m + '·' + e.d}</span>${e.title}</em>`).join('');
    b.addEventListener('click', () => { if (level === 'ribbon' && band.phase === 'laid') openDay(g[0].d); });
    ui.knots.appendChild(b);
    return { el: b, d: Math.round((g[0].d + g[g.length - 1].d) / 2) };
  });
}
function goHome() {
  if (level === 'day') closeDay(true);
  level = 'disc';
  document.body.dataset.level = 'disc';
  band.fishAmt.to(0);
  band.phase = band.phase === 'pull' ? 'home' : 'rewind';
  band.s.to(0);
  band.railX.to(L.rail.x); band.railY.to(L.rail.y); band.halfBase.to(L.rail.half);
  discTargets(false);
  ui.slip.classList.remove('open');
  setTag(null);
  announce('年轮放回了树干。');
}
function openDay(d) {
  if (d < 0 || d >= band.len) return;
  level = 'day';
  document.body.dataset.level = 'day';
  day.sel = d;
  day.reveal.to(1);
  sound.breath(true);
  const date = dateOf(band.y, d);
  const st = sunTimes(date.y, date.m, date.d);
  // arrive at the hour after the day has begun: the sun climbs into place
  day.minutes.set(st.rise ?? 360);
  day.minutes.to(clamp(15 * 60, (st.rise ?? 360) + 60, (st.set ?? 1080) - 60));
  band.focus = dayCentre(d);
  railTargets(false);
  renderDay();
  setTag(null);
}
function closeDay(silent) {
  if (level !== 'day') return;
  level = 'ribbon';
  document.body.dataset.level = 'ribbon';
  day.reveal.to(0);
  railTargets(false);
  sound.breath(false);
  if (!silent) announce('收起了这一天。');
}
function setDay(d) {
  d = clamp(d, 0, band.len - 1);
  if (d === day.sel) return;
  day.sel = d;
  band.focus = dayCentre(d);
  renderDay();
  sound.tick(dateOf(band.y, d).d === 1);
  tick.wake();
}
const dayCentre = (d) => ((d + 0.5) / band.len) * L.rail.len;

// ------------------------------------------------------------------ text
const fmt = (v, digits = 0) => (v == null ? '—' : v.toLocaleString('zh-CN', { maximumFractionDigits: digits, minimumFractionDigits: digits }));
function yearFacts(y) {
  if (y < FIRST_YEAR) return '这一圈没有逐日天气：ERA5 再分析从 1940 年开始。';
  const r = climate.years[y - FIRST_YEAR];
  if (!r) return '';
  const hot = parts(r.hotDay), windy = parts(r.gustDay);
  const tail = r.full ? '' : `（记录到 ${climate.meta.last.slice(5).replace('-', ' 月 ')} 日）`;
  return `雨 ${fmt(r.rain)} mm · 雨日 ${r.wet} · 最热 ${hot.m} 月 ${hot.d} 日 ${fmt(r.hot, 1)}°C · 最大阵风 ${windy.m} 月 ${windy.d} 日 ${r.gust} km/h${tail}`;
}
function showHud(k, px, py) {
  if (k < 0) { ui.hud.classList.remove('on'); return; }
  const y = SCHOOL_YEAR + k;
  ui.hudYear.textContent = y;
  ui.hudGz.textContent = `${ganzhi(y)} · 第 ${y - SCHOOL_YEAR + 1} 圈`;
  ui.hudFacts.textContent = yearFacts(y);
  const ev = entriesOfYear(y);
  ui.hudEvents.innerHTML = ev.map((e) => `<li><i class="${e.kind}"></i>${e.when === 'year' ? '' : e.m + ' 月 · '}${e.title}</li>`).join('');
  ui.hud.classList.add('on');
  // sit outside the bark, on the side the finger is
  if (!portrait) {
    const ang = Math.atan2(py - disc.cy.x, px - disc.cx.x);
    const r = disc.R.x * 1.16;
    let x = disc.cx.x + Math.cos(ang) * r, yy = disc.cy.x + Math.sin(ang) * r;
    const left = Math.cos(ang) < 0;
    ui.hud.style.transform = `translate(${left ? x - 300 : x}px, ${clamp(yy - 40, 16, H - 200)}px)`;
    ui.hud.classList.toggle('left', left);
  } else {
    ui.hud.style.transform = '';
  }
}
function setTag(d) {
  if (d == null || d < 0) { ui.tag.classList.remove('on'); return; }
  sound.tick(dateOf(band.y, d).d === 1);
  const date = dateOf(band.y, d);
  const i = band.start >= 0 ? band.start + d : -1;
  const row = i >= 0 && i < climate.days ? climate.row(i) : null;
  const ev = entriesOn(date);
  let line = row ? describeDay(row) : band.start < 0 ? '没有逐日天气记录' : '这一天的数据还没有到';
  ui.tag.querySelector('.d').textContent = `${date.m} 月 ${date.d} 日`;
  ui.tag.querySelector('.w').textContent = `星期${WEEK[date.wd]}`;
  ui.tag.querySelector('.l').textContent = line;
  const badges = extremes(i);
  ui.tag.querySelector('.e').innerHTML = [...badges.map((b) => `<b>${b}</b>`), ...ev.map((e) => `<b class="${e.kind}">${e.title}</b>`)].join('');
  ui.tag.classList.add('on');
}
let spanCache = { y: -1, s: null };
function extremes(i) {
  if (i < 0 || i >= climate.days) return [];
  if (spanCache.y !== band.y) {
    spanCache = { y: band.y, s: climate.span(band.start, band.start + band.len - 1) };
  }
  const s = spanCache.s, out = [];
  if (!s) return out;
  if (s.hot.i === i) out.push('全年最热');
  if (s.cold.i === i) out.push('全年最冷');
  if (s.wettest.i === i) out.push('全年雨最大');
  if (s.windiest.i === i) out.push('全年风最大');
  return out;
}
function entriesOn(date) {
  return ENTRIES.filter((e) => e.y === date.y && ((e.when === 'day' || e.when === 'about') ? e.m === date.m && e.d === date.d : e.when === 'month' ? e.m === date.m : false));
}
function entryHTML(e) {
  const when = e.when === 'about' ? `${e.y} 年 ${e.m} 月 ${e.d} 日前后` : e.when === 'month' ? `${e.y} 年 ${e.m} 月（具体日期不详）` : e.when === 'year' ? `${e.y} 年（月日不详）` : `${e.y} 年 ${e.m} 月 ${e.d} 日`;
  const src = e.sources.map((s) => (s.url ? `<a href="${s.url}" target="_blank" rel="noopener">${s.name}</a>` : s.name)).join('、');
  const ph = e.photo ? `<figure><img src="${e.photo.src}" alt="${e.photo.alt}" loading="lazy"><figcaption>${e.photo.credit}</figcaption></figure>` : '';
  return `<article class="entry ${e.kind}"><p class="when">${when} · ${GRADES[e.grade]}</p><h3>${e.title}</h3><p>${e.text}</p>${ph}<p class="src">来源：${src}</p></article>`;
}
function renderSlip() {
  const y = band.y;
  const ev = entriesOfYear(y);
  const yearOnly = ev.filter((e) => e.when === 'year');
  ui.slip.querySelector('.y').textContent = y;
  ui.slip.querySelector('.gz').textContent = ganzhi(y) + '年';
  ui.slip.querySelector('.facts').textContent = yearFacts(y);
  ui.slip.querySelector('.more').innerHTML = (yearOnly.length ? yearOnly.map(entryHTML).join('') : '') +
    (ev.length && !yearOnly.length ? '<p class="quiet">这一年的事，刻在带子上的结里。</p>' : '') +
    (!ev.length ? '<p class="quiet">这一年，HAIZ 的档案里还没有校史或报道。只有天气。</p>' : '');
  ui.slip.querySelector('.count').textContent = ev.length ? `${ev.length} 件事` : '';
  ui.slip.classList.toggle('has', yearOnly.length > 0);
}
function renderDay() {
  const d = day.sel, date = dateOf(band.y, d);
  const i = band.start >= 0 ? band.start + d : -1;
  const row = i >= 0 && i < climate.days ? climate.row(i) : null;
  const st = sunTimes(date.y, date.m, date.d);
  const moon = moonAt(msOf(date.y, date.m, date.d, 1320));
  const ev = entriesOn(date);
  const badges = extremes(i);
  ui.day.querySelector('.date').innerHTML = `${date.y}<small>年</small>${date.m}<small>月</small>${date.d}<small>日</small>`;
  ui.day.querySelector('.wd').textContent = `星期${WEEK[date.wd]} · ${ganzhi(date.y)}年 · 这一年的第 ${d + 1} 天`;
  ui.day.querySelector('.desc').textContent = row ? describeDay(row) : band.start < 0 ? '这一天没有逐日天气记录：ERA5 再分析从 1940 年开始。天空按晴天画出。' : '这一天的数据还没有到。';
  ui.day.querySelector('.sun').textContent = `日出 ${st.rise != null ? fmtClock(st.rise) : '—'} · 日落 ${st.set != null ? fmtClock(st.set) : '—'} · 当晚${moon.name}${row && row.cloud != null ? ` · 云量 ${row.cloud}%` : ''}`;
  ui.day.querySelector('.badges').innerHTML = badges.map((b) => `<b>${b}</b>`).join('');
  ui.day.querySelector('.entries').innerHTML = ev.map(entryHTML).join('');
  ui.day.classList.toggle('has-entries', ev.length > 0);
  announce(`${date.y} 年 ${date.m} 月 ${date.d} 日，${ui.day.querySelector('.desc').textContent}`);
}
const seen = { band: false };
let announceT = 0;
function announce(text) { clearTimeout(announceT); announceT = setTimeout(() => { ui.live.textContent = text; }, 250); }
function haptic(ms) { try { if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return; navigator.vibrate && navigator.vibrate(ms); } catch (_) { /* not available */ } }

// ------------------------------------------------------------------ input
const ptr = { id: null, x: 0, y: 0, x0: 0, y0: 0, t0: 0, mode: null, moved: false, vx: 0, vy: 0, lt: 0, hold: 0, k: -1, th: 0 };
glCanvas.style.touchAction = 'none';

function bandLocal(px, py) {
  const dx = px - band.railX.x, dy = py - band.railY.x;
  const [x, y] = rot(dx, dy, -L.rail.psi);
  return { x, y };
}
function dayAtLocal(x) {
  const dd = (level === 'day' ? L.dayRail.d : L.rail.d) * band.fishAmt.x;
  const orig = fisheyeInv(clamp(x, 0, L.rail.len), band.focus, 0, L.rail.len, dd);
  return clamp(Math.floor((orig / L.rail.len) * band.len), 0, band.len - 1);
}
function onBand(px, py, pad = 18) {
  if (!band.phase || (band.phase !== 'laid' && band.phase !== 'roll')) return null;
  const { x, y } = bandLocal(px, py);
  const s = band.s.x;
  const h = band.halfBase.x * 1.8 + pad;
  if (x > -pad && x < s + pad && Math.abs(y) < h) return { x, y, along: true };
  // the wheel, while it is still rolling
  const c = wheelCentre(s);
  if (s < L.rail.len - 2 && Math.hypot(px - c.x, py - c.y) < L.rail.wheel + band.halfBase.x + pad) return { x, y, wheel: true };
  return null;
}
function inCorner(px, py) {
  if (level === 'disc') return false;
  const dx = px - disc.cx.x, dy = py - disc.cy.x;
  // the trunk itself, or its label beside it (the label is drawn by #corner, which lets taps through)
  return Math.hypot(dx, dy) < disc.R.x * 1.3 || (dx > 0 && dx < disc.R.x * 1.3 + 90 && Math.abs(dy) < 18);
}

glCanvas.addEventListener('pointerdown', (e) => {
  if (ptr.id !== null || !climate) return;
  cancelIntro();
  sound.wake();
  glCanvas.setPointerCapture(e.pointerId);
  Object.assign(ptr, { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), lt: performance.now(), moved: false, vx: 0, vy: 0, mode: null });
  const { clientX: px, clientY: py } = e;
  if (inCorner(px, py)) { ptr.mode = 'corner'; return; }
  if (level === 'disc') {
    if (band.phase && band.phase !== 'home') return;
    const p = discPick(px, py);
    if (!p.inside) { ptr.mode = 'none'; return; }
    disc.focus = clamp(p.rs, E0, E1);
    disc.fishAmt.to(1);
    ptr.k = p.k; ptr.th = p.th;
    if (e.pointerType === 'mouse') { ptr.mode = 'armed'; if (p.k >= 0) setHover(p.k, px, py); }
    else {
      // touch: slide to find a year (the rings swell under the finger); pause to take hold
      ptr.mode = 'scrub';
      setHover(p.k, px, py);
      armHold();
    }
  } else if (level === 'ribbon') {
    const hit = onBand(px, py);
    if (!hit) { ptr.mode = 'none'; return; }
    // the wheel while it rolls, or the far end of the laid band: push it back and it rolls up
    const endGrab = portrait ? 34 : 22;
    if (hit.wheel || (band.phase === 'laid' && hit.x > band.s.x - endGrab)) {
      ptr.mode = 'wheel'; ptr.sOff = band.s.x - hit.x; band.fishAmt.to(0); setTag(null);
      if (band.phase === 'laid') { band.phase = 'roll'; band.month = 12; }
      return;
    }
    ptr.mode = 'band';
    seen.band = true; ui.rhint.classList.remove('on');
    band.focus = clamp(hit.x, 0, L.rail.len);
    band.fishAmt.to(1);
    band.focusDay = dayAtLocal(hit.x);
    setTag(band.focusDay);
  } else if (level === 'day') {
    const hit = onBand(px, py, 26);
    if (hit && hit.along) { ptr.mode = 'dayband'; setDay(dayAtLocal(hit.x)); }
    else { ptr.mode = 'sky'; ptr.m0 = day.minutes.target; }
  }
  tick.wake();
});
function armHold() {
  clearTimeout(ptr.hold);
  ptr.hold = setTimeout(() => {
    if (ptr.mode === 'scrub' && ptr.k >= 0) {
      ptr.mode = 'armed';
      haptic(10);
      disc.hoverAmt.v += 8;   // a small pop: you've got it
      ui.hint.classList.add('gone');
    }
  }, 260);
}
glCanvas.addEventListener('pointermove', (e) => {
  const { clientX: px, clientY: py } = e;
  const now = performance.now();
  if (ptr.id === e.pointerId) {
    const dt = Math.max(1, now - ptr.lt) / 1000;
    ptr.vx = lerp(ptr.vx, (px - ptr.x) / dt, 0.4); ptr.vy = lerp(ptr.vy, (py - ptr.y) / dt, 0.4);
    ptr.x = px; ptr.y = py; ptr.lt = now;
    const dist = Math.hypot(px - ptr.x0, py - ptr.y0);
    if (dist > 6) ptr.moved = true;
    switch (ptr.mode) {
      case 'scrub': {
        const p = discPick(px, py);
        if (p.inside) { disc.focus = clamp(p.rs, E0, E1); if (p.k !== ptr.k) { ptr.k = p.k; ptr.th = p.th; setHover(p.k, px, py); armHold(); } }
        if (dist > 6) { ptr.x0 = px; ptr.y0 = py; armHold(); }
        break;
      }
      case 'armed':
        if (dist > 8 && ptr.k >= 0) { ptr.mode = 'pull'; pullStart(ptr.k, ptr.th, ptr.x0, ptr.y0); showHud(-1); }
        break;
      case 'pull': band.pull.x = px; band.pull.y = py; break;
      case 'band': {
        const { x, y } = bandLocal(px, py);
        const edge = band.halfBase.x * 1.4 + 14;
        if (ptr.moved && !ptr.perp && Math.abs(y) > edge) {
          // pulling a day off the band: the sky grows out of its cell as far as you pull
          ptr.perp = true; day.sel = band.focusDay; day.reveal.set(0); renderDay(); document.body.classList.add('peek');
        }
        if (ptr.perp) {
          const p = clamp((Math.abs(y) - edge * 0.6) / (portrait ? W * 0.5 : H * 0.38));
          day.reveal.target = p; day.reveal.x = lerp(day.reveal.x, p, 0.6);
        } else {
          band.focus = clamp(x, 0, L.rail.len);
          const d = dayAtLocal(x);
          if (d !== band.focusDay) { band.focusDay = d; setTag(d); }
        }
        break;
      }
      case 'wheel': {
        const { x } = bandLocal(px, py);
        band.s.to(clamp(x + ptr.sOff, 0, L.rail.len), { stiffness: 400, damping: 40 });
        break;
      }
      case 'dayband': { const { x } = bandLocal(px, py); setDay(dayAtLocal(x)); break; }
      case 'sky': {
        const span = portrait ? W * 0.9 : W * 0.86;
        day.minutes.to(clamp(ptr.m0 + ((px - ptr.x0) / span) * 1440, 0, 1439), { stiffness: 220, damping: 30 });
        break;
      }
    }
    tick.wake();
    return;
  }
  // hover (mouse)
  if (e.pointerType !== 'mouse' || !climate) return;
  if (level === 'disc' && (!band.phase || band.phase === 'home')) {
    const p = discPick(px, py);
    if (p.inside) { disc.focus = clamp(p.rs, E0, E1); disc.fishAmt.to(1); setHover(p.k, px, py); glCanvas.style.cursor = p.k >= 0 ? 'grab' : 'default'; }
    else { disc.fishAmt.to(0); setHover(-1); glCanvas.style.cursor = 'default'; }
  } else if (level === 'ribbon') {
    const hit = onBand(px, py);
    if (hit && hit.along && band.phase === 'laid' && hit.x <= band.s.x - 22) {
      band.focus = clamp(hit.x, 0, L.rail.len); band.fishAmt.to(1);
      const d = dayAtLocal(hit.x);
      if (d !== band.focusDay) { band.focusDay = d; setTag(d); }
      glCanvas.style.cursor = 'pointer';
    } else if (hit && (hit.wheel || hit.x > band.s.x - 22)) { glCanvas.style.cursor = 'grab'; }
    else { band.fishAmt.to(0); band.focusDay = -1; setTag(null); glCanvas.style.cursor = inCorner(px, py) ? 'pointer' : 'default'; }
  } else if (level === 'day') {
    const hit = onBand(px, py, 26);
    glCanvas.style.cursor = hit ? 'pointer' : inCorner(px, py) ? 'pointer' : 'ew-resize';
  }
  tick.wake();
});
function endPointer(e) {
  if (ptr.id !== e.pointerId) return;
  clearTimeout(ptr.hold);
  const { clientX: px, clientY: py } = e;
  const tap = !ptr.moved && performance.now() - ptr.t0 < 450;
  switch (ptr.mode) {
    case 'corner': if (tap) goHome(); break;
    case 'scrub':
      // a tap on a ring on a touch screen takes it out at once
      if (tap && ptr.k >= 0) { pullStart(ptr.k, ptr.th, px, py); goRibbon(); }
      disc.fishAmt.to(0); setHover(-1);
      break;
    case 'armed':
      if (tap && ptr.k >= 0) { pullStart(ptr.k, ptr.th, px, py); goRibbon(); }
      else if (e.pointerType !== 'mouse') { disc.fishAmt.to(0); setHover(-1); }
      break;
    case 'pull': {
      const flick = Math.hypot(ptr.vx, ptr.vy) > 1100;
      if (!band.tethered || flick) goRibbon();
      else { band.phase = 'home'; haptic(4); }
      if (e.pointerType !== 'mouse') { disc.fishAmt.to(0); setHover(-1); }
      break;
    }
    case 'band':
      if (ptr.perp) {
        document.body.classList.remove('peek');
        if (day.reveal.x > 0.22) openDay(day.sel); else day.reveal.to(0);
      } else if (tap) openDay(band.focusDay);
      if (e.pointerType !== 'mouse') { band.fishAmt.to(0); band.focusDay = -1; setTag(null); }
      break;
    case 'wheel': {
      const s = band.s.target;
      band.s.k = 38; band.s.c = 12.5;
      if (s < L.rail.len * 0.3) goHome(); else band.s.to(L.rail.len);
      break;
    }
    case 'sky': if (tap) closeDay(); break;
  }
  ptr.id = null; ptr.mode = null; ptr.perp = false;
  tick.wake();
}
glCanvas.addEventListener('pointerup', endPointer);
glCanvas.addEventListener('pointercancel', endPointer);
glCanvas.addEventListener('pointerleave', (e) => {
  if (e.pointerType !== 'mouse' || ptr.id !== null) return;
  if (level === 'disc') { disc.fishAmt.to(0); setHover(-1); }
  if (level === 'ribbon') { band.fishAmt.to(0); band.focusDay = -1; setTag(null); }
  tick.wake();
});

function setHover(k, px, py) {
  if (k !== disc.hover) { disc.hover = k; disc.hoverAmt.set(0).to(1); if (k >= 0) { haptic(2); sound.tick((SCHOOL_YEAR + k) % 10 === 0); } }
  showHud(k, px, py);
}

ui.corner.addEventListener('click', () => goHome());
const soundBtn = $('#sound');
const paintSound = () => { soundBtn.textContent = sound.on ? '声 · 开' : '声 · 关'; soundBtn.setAttribute('aria-pressed', sound.on); };
paintSound();
soundBtn.addEventListener('click', () => { sound.toggle(); paintSound(); });
ui.close.addEventListener('click', () => closeDay());
ui.slip.addEventListener('click', (e) => { if (e.target.closest('a')) return; ui.slip.classList.toggle('open'); });

// keyboard: the same three depths
let kbRing = 100;
addEventListener('keydown', (e) => {
  if (!climate) return;
  cancelIntro();
  if (e.key === 'Escape') { if (level === 'day') closeDay(); else if (level === 'ribbon') goHome(); return; }
  if (level === 'disc' && (!band.phase || band.phase === 'home')) {
    if ((e.key === 'Enter' || e.key === ' ') && band.phase) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') kbRing = Math.min(nR - 1, kbRing + 1);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') kbRing = Math.max(0, kbRing - 1);
    else if (e.key === 'Enter' || e.key === ' ') { pullStart(kbRing, 0, disc.cx.x, disc.cy.x); goRibbon(); e.preventDefault(); return; }
    else return;
    const r = discForward((lay.edges[kbRing] + lay.edges[kbRing + 1]) / 2);
    disc.focus = r; disc.fishAmt.to(1);
    setHover(kbRing, disc.cx.x + disc.R.x, disc.cy.x);
    e.preventDefault();
  } else if (level === 'ribbon' && band.phase === 'laid') {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (step) {
      band.focusDay = clamp((band.focusDay < 0 ? 0 : band.focusDay + step), 0, band.len - 1);
      band.focus = dayCentre(band.focusDay); band.fishAmt.to(1); setTag(band.focusDay); e.preventDefault();
    } else if (e.key === 'Enter' && band.focusDay >= 0) openDay(band.focusDay);
  } else if (level === 'day') {
    if (e.key === 'ArrowRight') setDay(day.sel + 1);
    else if (e.key === 'ArrowLeft') setDay(day.sel - 1);
    else if (e.key === 'ArrowUp') day.minutes.to(clamp(day.minutes.target + 60, 0, 1439));
    else if (e.key === 'ArrowDown') day.minutes.to(clamp(day.minutes.target - 60, 0, 1439));
    else return;
    e.preventDefault();
  }
  tick.wake();
});

// ------------------------------------------------------------------ the frame
function stepBand(dt) {
  if (!band.phase) return;
  const P = band.phase;
  for (const s of [band.cx, band.cy, band.Rr, band.rho, band.s, band.fishAmt, band.railX, band.railY, band.halfBase]) s.step(dt);
  let damp = 1, kAll = 1400;
  if (P === 'pull') {
    const p = band.pull;
    let dx = p.x - p.x0, dy = p.y - p.y0;
    const dist = Math.hypot(dx, dy);
    const thr = portrait || coarse ? 70 : 90;
    if (band.tethered) {
      // the wood holds on: the further you pull, the harder it resists — until it lets go
      const k = 1 / (1 + dist / (thr * 1.6));
      dx *= k; dy *= k;
      const step = Math.floor(dist / 9);
      if (step > (band.fibre || 0)) { band.fibre = step; if (ptr.mode !== 'intro') sound.fibre(clamp(dist / (thr * 1.25))); }
      if (dist > thr * 1.25) { band.tethered = false; haptic(14); disc.gap.v += 3; if (ptr.mode !== 'intro') sound.pop(); }
    }
    const fx = p.x0 + dx, fy = p.y0 + dy;
    const amt = clamp(dist / (thr * 1.6));
    band.lift = amt;
    const Rr = lerp(p.mid, Math.max(p.mid, L.rail.wheel * (portrait ? 0.62 : 0.5)), smooth(0, 1, amt));
    band.Rr.to(Rr);
    const th = (band.grab / band.len) * TAU + band.rho.x;
    const cx = fx - Math.sin(th) * band.Rr.x, cy = fy + Math.cos(th) * band.Rr.x;
    loopTargets(cx, cy, band.Rr.x, band.rho.x, lerp(p.half, band.halfBase.target * 0.8, smooth(0, 1, amt)));
    // stiff near the fingers, loose far away: the loop trails and wobbles like a band of rubber
    for (let j = 0; j < band.n; j++) {
      let a = Math.abs(j - band.grab); a = Math.min(a, band.len - a) / band.len;
      band.K[j] = 60 + 1500 * Math.exp(-((a / 0.13) ** 2));
    }
    band.T[band.grab * 2] = fx; band.T[band.grab * 2 + 1] = fy;
    damp = 0.42;
  } else if (P === 'fly' || P === 'home') {
    if (P === 'home') {
      const { mid } = slotTargets();
      band.cx.to(disc.cx.x); band.cy.to(disc.cy.x); band.Rr.to(mid);
      let t = 0; while (t - band.rho.x > Math.PI) t -= TAU; while (t - band.rho.x < -Math.PI) t += TAU;
      band.rho.to(t);
      const half = band.halfT[0];
      loopTargets(band.cx.x, band.cy.x, band.Rr.x, band.rho.x, lerp(half, band.halfT[0], 1));
      const close = Math.hypot(band.cx.x - disc.cx.x, band.cy.x - disc.cy.x) + Math.abs(band.Rr.x - mid);
      if (close < 3) {
        // the ring is in its groove: the trunk makes room again
        disc.gap.to(0);
        const { half: h2 } = slotTargets();
        void h2;
        if (disc.gap.x < 0.03 && close < 1) { band.phase = null; disc.pulled = -1; disc.gap.set(0); sound.knock(0); return; }
      }
      band.lift = clamp(close / 200);
    } else {
      const c = wheelCentre(0);
      band.cx.to(c.x); band.cy.to(c.y);
      loopTargets(band.cx.x, band.cy.x, band.Rr.x, band.rho.x, band.halfBase.x);
      band.lift = 1;
      const close = Math.hypot(band.cx.x - c.x, band.cy.x - c.y) + Math.abs(band.Rr.x - L.rail.wheel) + Math.abs(band.rho.x - band.rho.target) * 100;
      if (close < 2.5) { band.phase = 'roll'; band.month = 0; band.s.set(0); band.s.to(L.rail.len); haptic(4); }
    }
    for (let j = 0; j < band.n; j++) {
      let a = Math.abs(j - band.grab); a = Math.min(a, band.len - a) / band.len;
      band.K[j] = 260 + 900 * Math.exp(-((a / 0.2) ** 2));
    }
    damp = 0.62;
  } else if (P === 'roll' || P === 'laid' || P === 'rewind') {
    rollTargets(band.s.x);
    if (P === 'roll' || P === 'rewind') {
      const m = Math.floor((band.s.x / L.rail.len) * 12 + 0.02);
      if (P === 'roll' && m > band.month && m <= 12) { band.month = m; sound.knock(m); }
      if (P === 'rewind' && m < band.month) { band.month = m; sound.knock(m); }
    }
    band.lift = P === 'laid' ? 0.15 : 0.5;
    kAll = P === 'laid' ? 900 : 1800;
    band.K.fill(kAll);
    damp = 0.9;
    if (P === 'roll' && Math.abs(band.s.x - L.rail.len) < 0.6 && Math.abs(band.s.v) < 2) {
      band.phase = 'laid'; band.s.set(L.rail.len); railTargets(false);
      if (!seen.band) ui.rhint.classList.add('on');
    }
    if (P === 'rewind' && band.s.x < 1.5 && Math.abs(band.railX.x - L.rail.x) + Math.abs(band.railY.x - L.rail.y) < 3) {
      band.phase = 'home';
      const c = wheelCentre(0);
      band.cx.set(c.x); band.cy.set(c.y); band.Rr.set(L.rail.wheel); band.rho.set(L.rail.psi);
    }
  }
  // springs for every node (in small steps: the stiff ones need them)
  const sub = Math.ceil(dt / (1 / 240));
  const h = dt / sub;
  for (let i = 0; i < sub; i++) {
    stepParticles(band.X, band.V, band.T, band.K, damp, h, band.n);
    for (let j = 0; j < band.n; j++) {
      const k = 300, c = 2 * Math.sqrt(k) * 0.8;
      band.halfV[j] += (-k * (band.half[j] - band.halfT[j]) - c * band.halfV[j]) * h;
      band.half[j] += band.halfV[j] * h;
    }
  }
  if (P === 'pull') { band.X[band.grab * 2] = band.T[band.grab * 2]; band.X[band.grab * 2 + 1] = band.T[band.grab * 2 + 1]; }
  // normals from the actual shape
  const X = band.X, N = band.normals, n = band.n;
  for (let j = 0; j < n; j++) {
    const a = Math.max(0, j - 1), b = Math.min(n - 1, j + 1);
    let tx = X[b * 2] - X[a * 2], ty = X[b * 2 + 1] - X[a * 2 + 1];
    const l = Math.hypot(tx, ty) || 1;
    N[j * 2] = ty / l; N[j * 2 + 1] = -tx / l;
  }
}

function cellRect(d) {
  const X = band.X, j0 = d, j1 = d + 1;
  const x0 = Math.min(X[j0 * 2], X[j1 * 2]), x1 = Math.max(X[j0 * 2], X[j1 * 2]);
  const y0 = Math.min(X[j0 * 2 + 1], X[j1 * 2 + 1]), y1 = Math.max(X[j0 * 2 + 1], X[j1 * 2 + 1]);
  const h = band.half[j0];
  return portrait ? { x: x0 - h, y: y0, w: x1 - x0 + 2 * h, h: Math.max(2, y1 - y0) } : { x: x0, y: y0 - h, w: Math.max(2, x1 - x0), h: y1 - y0 + 2 * h };
}

let lastT = performance.now();
function frame(now) {
  const dt = Math.min(1 / 30, (now - lastT) / 1000);
  lastT = now;
  day.time += dt;
  for (const s of [disc.cx, disc.cy, disc.R, disc.dim, disc.fishAmt, disc.hoverAmt, disc.gap, disc.alpha, day.reveal, day.minutes]) s.step(dt);
  if (level === 'day' || day.reveal.x > 0.01) { band.focus = lerp(band.focus, dayCentre(Math.max(0, day.sel)), 0.25); band.fishAmt.to(1); }
  updateLUT();
  stepBand(dt);

  // sky / paper
  let tint = Sky.PAPER;
  const fd = level === 'day' ? day.sel : band.focusDay;
  if (band.phase && fd >= 0 && band.start >= 0 && band.start + fd < climate.days) tint = Sky.dayTint(climate.row(band.start + fd));
  paperTint.r = lerp(paperTint.r, tint[0], 0.08); paperTint.g = lerp(paperTint.g, tint[1], 0.08); paperTint.b = lerp(paperTint.b, tint[2], 0.08);
  let dayState = null;
  if (day.sel >= 0 && day.reveal.x > 0.002 && band.phase) {
    const date = dateOf(band.y, day.sel);
    const i = band.start >= 0 ? band.start + day.sel : -1;
    dayState = { date, row: i >= 0 && i < climate.days ? climate.row(i) : null, minutes: day.minutes.x, horizon: portrait ? H * 0.62 : band.railY.x };
    day.from = cellRect(day.sel);
  }
  Sky.paint(skyCtx, { w: W, h: H, dpr, tint: [paperTint.r, paperTint.g, paperTint.b], reveal: day.reveal.x, from: day.from, day: dayState, time: day.time });

  // wood
  R.clear();
  R.drawDisc({ cx: disc.cx.x, cy: disc.cy.x, R: disc.R.x, lutMax, hover: level === 'disc' ? disc.hover : -1, hoverAmt: disc.hoverAmt.x, dim: disc.dim.x, alpha: disc.alpha.x });
  if (band.phase) {
    R.drawRibbon({ nodes: band.X, normals: band.normals, half: band.half, us: band.us, n: band.n, row: band.k, len: band.len, lift: band.lift,
      focusDay: level === 'ribbon' ? band.focusDay : -1, selDay: level === 'day' ? day.sel : -1 });
  }
  placeLabels();
  return busy();
}
const paperTint = { r: Sky.PAPER[0], g: Sky.PAPER[1], b: Sky.PAPER[2] };

function busy() {
  if (ptr.id !== null) return true;
  if (level === 'day' && dayState()) return true;
  const springs = [disc.cx, disc.cy, disc.R, disc.dim, disc.fishAmt, disc.hoverAmt, disc.gap, day.reveal, day.minutes, band.s, band.fishAmt, band.railX, band.railY, band.halfBase, band.cx, band.cy, band.Rr, band.rho];
  if (springs.some((s) => !s.settled)) return true;
  if (band.phase && band.phase !== 'laid') return true;
  if (band.phase) { for (let i = 0; i < band.V.length; i++) if (Math.abs(band.V[i]) > 0.05) return true; }
  return Math.abs(paperTint.r - (band.focusDay >= 0 ? paperTint.r : Sky.PAPER[0])) > 0.5;
}
// the day keeps moving only while it has weather to show
function dayState() {
  const i = band.start >= 0 ? band.start + day.sel : -1;
  if (i < 0 || i >= climate.days) return false;
  const r = climate.row(i);
  return reduced ? false : (r.rain ?? 0) >= 0.5 || (r.cloud ?? 0) > 5;
}

const tick = (() => {
  let raf = 0;
  const loop = (t) => { raf = 0; if (frame(t)) raf = requestAnimationFrame(loop); };
  return { wake() { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(loop); } } };
})();

// ------------------------------------------------------------------ labels that ride on the wood
const monthEls = [];
function placeLabels() {
  const showBand = band.phase === 'laid' || band.phase === 'roll';
  ui.months.classList.toggle('on', showBand && level !== 'disc');
  if (band.phase && band.n) {
    // month names, just outside the band, on the side away from the readout
    for (let m = 0; m < 12; m++) {
      const el = monthEls[m];
      const a = dayOfYear(band.y, m + 1, 1), b = m === 11 ? band.len : dayOfYear(band.y, m + 2, 1);
      const j = Math.round((a + b) / 2);
      const x = band.X[j * 2], y = band.X[j * 2 + 1], h = band.half[j];
      const laidOut = (j / band.len) * L.rail.len <= band.s.x;
      // a month squeezed thin by the lens loses its name
      const span = Math.hypot(band.X[b * 2] - band.X[a * 2], band.X[b * 2 + 1] - band.X[a * 2 + 1]);
      const room = smooth(portrait ? 16 : 34, portrait ? 26 : 50, span);
      el.style.opacity = laidOut && showBand && !(portrait && level === 'day') ? (level === 'day' ? 0.75 : 1) * room : 0;
      if (portrait) el.style.transform = `translate(${x + h + 6}px, ${y - 6}px)`;
      else el.style.transform = `translate(${x - 20}px, ${y + h + 10}px)`;
    }
    // the title slip at New Year's end of the scroll
    const sx = band.X[0], sy = band.X[1];
    ui.slip.classList.toggle('on', showBand && level === 'ribbon');
    if (portrait) ui.slip.style.transform = `translate(${sx - band.halfBase.x - 14}px, ${sy - 4}px) translate(-100%, 0)`;
    else ui.slip.style.transform = `translate(${sx - 26}px, ${sy - band.halfBase.x - 14}px) translate(-100%, 0)`;
    // the readout follows the swollen day
    if (level === 'ribbon' && band.focusDay >= 0) {
      const j = band.focusDay;
      const x = (band.X[j * 2] + band.X[j * 2 + 2]) / 2, y = (band.X[j * 2 + 1] + band.X[j * 2 + 3]) / 2, h = band.half[j];
      if (portrait) ui.tag.style.transform = `translate(${clamp(x - h - 14, 0, W)}px, ${clamp(y, 120, H - 140)}px) translate(-100%, -50%)`;
      else ui.tag.style.transform = `translate(${clamp(x, 170, W - 170)}px, ${y - h - 18}px) translate(-50%, -100%)`;
    }
    if (level === 'day') {
      const p = Sky.sunPoint(W, portrait ? H * 0.62 : band.railY.x, dateOf(band.y, day.sel), day.minutes.x);
      ui.clock.textContent = fmtClock(day.minutes.x);
      ui.clock.style.transform = `translate(${p.x}px, ${p.y - 34}px) translate(-50%, 0)`;
    }
  } else {
    ui.slip.classList.remove('on');
  }
  ui.knots.classList.toggle('on', band.phase === 'laid' && level === 'ribbon');
  if (band.phase && knotEls.length) {
    for (const { el, d } of knotEls) {
      const j = Math.min(d, band.n - 2);
      const x = (band.X[j * 2] + band.X[j * 2 + 2]) / 2, y = (band.X[j * 2 + 1] + band.X[j * 2 + 3]) / 2, h = band.half[j];
      const hide = band.focusDay >= 0 && Math.abs(band.focusDay - d) < (portrait ? 30 : 40);
      el.style.opacity = hide ? 0 : '';
      if (portrait) el.style.transform = `translate(${x - h - 10}px, ${y}px) translate(-100%, -50%)`;
      else el.style.transform = `translate(${x}px, ${y - h - 10}px) translate(-50%, -100%)`;
    }
  }
  ui.corner.style.transform = `translate(${disc.cx.x - disc.R.x * 1.2}px, ${disc.cy.x - disc.R.x * 1.2}px)`;
  ui.corner.style.width = ui.corner.style.height = disc.R.x * 2.4 + 'px';
}

// ------------------------------------------------------------------ first visit: show the gesture once
let intro = null;
function cancelIntro() {
  if (!intro) return;
  clearTimeout(intro.t); cancelAnimationFrame(intro.raf);
  if (ptr.mode === 'intro') { band.phase = 'home'; ptr.mode = null; ptr.id = null; }
  intro = null;
  ui.hint.classList.remove('demo');
}
function runIntro() {
  if (reduced) return;
  const k = 2023 - SCHOOL_YEAR;
  const th = TAU * (305 / 365);   // 1 November, the centenary
  const r = discForward((lay.edges[k] + lay.edges[k + 1]) / 2) * disc.R.x;
  const x0 = disc.cx.x + Math.sin(th) * r, y0 = disc.cy.x - Math.cos(th) * r;
  intro = { t: 0, raf: 0 };
  intro.t = setTimeout(() => {
    if (!intro) return;
    ui.hint.classList.add('demo');
    ptr.mode = 'intro';
    pullStart(k, th, x0, y0);
    const t0 = performance.now();
    const go = (now) => {
      if (!intro) return;
      const t = (now - t0) / 1000;
      // out along the radius, a little hesitation, then let go
      const pull = t < 0.9 ? smooth(0, 0.9, t) : t < 1.5 ? 1 : 0;
      const dx = Math.sin(th) * 85 * pull, dy = -Math.cos(th) * 85 * pull;
      band.pull.x = x0 + dx; band.pull.y = y0 + dy;
      tick.wake();
      if (t < 1.5) intro.raf = requestAnimationFrame(go);
      else { band.phase = 'home'; ptr.mode = null; intro = null; setTimeout(() => ui.hint.classList.remove('demo'), 1200); }
    };
    intro.raf = requestAnimationFrame(go);
  }, 1400);
}

// ------------------------------------------------------------------ start
async function start() {
  computeLayout();
  if (!R) { document.body.classList.add('no-gl'); return; }
  for (let m = 0; m < 12; m++) { const s = document.createElement('span'); s.textContent = portrait ? `${m + 1}月` : MONTHS[m]; ui.months.appendChild(s); monthEls.push(s); }
  climate = await loadClimate(new URL('./lib/rings/data/', import.meta.url));
  lay = layout(climate);
  nR = lay.rings.length; E0 = lay.edges[0]; E1 = lay.edges[nR];
  buildTextures();
  discTargets(true); railTargets(true);
  computeGapEdges();
  disc.R.set(L.disc.R * 0.92); disc.R.to(L.disc.R);
  document.body.classList.add('ready');
  ui.day.querySelector('.howto').textContent = portrait ? '左右拖动天空，看太阳走过这一天；在右边的带子上上下滑动，换一天。' : '左右拖动天空，看太阳走过这一天；在下面的带子上滑动，换一天。键盘：← → 换一天，↑ ↓ 换时辰。';
  ui.rhint.textContent = coarse || portrait ? '手指沿着带子滑动，看每一天。\n把某一天往外一拉，打开那天的天空。' : '沿着带子移动，看每一天；点一天，或把它从带子上拉下来，打开那天的天空。把带子的右端往回推，它会卷回成环。';
  ui.hint.textContent = coarse ? '手指按在年轮上滑动，停一下，把那一圈拉出来' : '按住任意一圈年轮，把它拉出来——或者直接点它';
  tick.wake();
  runIntro();
}
window.__nl = { ringPoint(y, th) { const k = y - SCHOOL_YEAR; const r = (lay.edges[k] + lay.edges[k + 1]) / 2 * wobble(th) * disc.R.x; return { x: disc.cx.x + Math.sin(th) * r, y: disc.cy.x - Math.cos(th) * r }; }, L: () => L, band, disc, ptr, discPick, discInverse, get gapEdges() { return gapEdges; }, get E() { return [E0, E1]; }, get level() { return level; } };
addEventListener('resize', () => {
  computeLayout();
  if (!climate) return;
  discTargets(true); railTargets(true);
  if (band.phase === 'laid') band.s.set(L.rail.len);
  tick.wake();
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick.wake(); });
start().catch((err) => { console.error(err); document.body.classList.add('failed'); });
