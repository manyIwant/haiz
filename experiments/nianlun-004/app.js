// NIANLUN 004 · 活木时光 — Living Cambium & Multi-Material Time Ribbons
//
// Built directly on PR #114 (NIANLUN 003 · 抽出一年), preserving its wooden cross-section,
// elastic tethered ring pull, length-conserving hand-scroll unroll, fisheye magnification,
// astronomical campus sky, and 100% reversible transitions — while evolving:
//   1. Living Cambium non-uniform radial weighting + adaptive fisheye + magnetic detent
//   2. Semantic zoom across 百年 → 年 → 学期 → 月 → 周 → 日 → 小时
//   3. Six tactile material time ribbons (Wood, Bamboo, Cotton Paper, Indigo Linen, Vermilion Seal, Botanical Leaf)
//   4. Real cross-ribbon operations (drag homework -> free slot, exam mistake -> 1-3-7 review,
//      conflict ripple -> 1-click shift, pull out exam -> Zhixuewang-inspired local analytics,
//      absence range veil -> catch-up digest)
//   5. Full localStorage CRUD persistence + HAIZ Pocket / Supabase / Campus Map / Lab Book alignment

import { loadClimate, yearStart, yearLength, parts, FIRST_YEAR, SCHOOL_YEAR } from './lib/rings/climate.js';
import { layout, colourOf, wobble } from './lib/rings/disc.js';
import { describeDay, sunTimes, moonAt, msOf } from './lib/rings/almanac.js';
import { createRenderer } from './gl.js';
import * as Sky from './sky.js';
import {
  Spring, stepParticles, fisheye, fisheyeInv,
  computeDisplayEdges, adaptiveFishD, applyRingDetent, clamp, lerp, smooth
} from './physics.js';
import { ENTRIES, GRADES, TODAY_ISO, entriesOfYear, subjectByName } from './content.js';
import {
  doyOfIso, isoOfYearDoy, parseIso, itemsForDate, detectAllConflicts,
  weekRangeOfIso, fmtMin, freeSlotsForDate
} from './analytics.js';
import { NianlunStore } from './store.js';
import { LAYER_META, paintRibbons, hitTestRibbons, hitTestFreeSlot } from './ribbons.js';
import { createPanels } from './panels.js';
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
const dayOfYear = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000);
const dateOf = (y, doy) => { const t = new Date(Date.UTC(y, 0, 1 + doy)); return { y, m: t.getUTCMonth() + 1, d: t.getUTCDate(), wd: t.getUTCDay() }; };

const TODAY_PARTS = parseIso(TODAY_ISO);
const TODAY_YEAR = TODAY_PARTS.y;
const TODAY_DOY = doyOfIso(TODAY_ISO);

// ------------------------------------------------------------------ DOM & Store
const skyCanvas = $('#sky'), glCanvas = $('#wood'), layersCanvas = $('#layers');
const skyCtx = skyCanvas.getContext('2d');
const layersCtx = layersCanvas.getContext('2d');
const R = createRenderer(glCanvas);
const store = new NianlunStore();

const ui = {
  hud: $('#hud'), hudYear: $('#hud .y'), hudGz: $('#hud .gz'), hudFacts: $('#hud .facts'),
  hudStudent: $('#hud .student-facts'), hudEvents: $('#hud .events'),
  hint: $('#hint'), title: $('#title'), tag: $('#tag'), slip: $('#slip'), months: $('#months'),
  day: $('#day'), knots: $('#knots'), rhint: $('#rhint'), corner: $('#corner'), close: $('#close'),
  live: $('#live'), clock: $('#clock'), quote: $('#quote'),
  scaleToggle: $('#scale-toggle'), dataBtn: $('#data-btn'),
  touchBar: $('#touch-bar'), tbY: $('#touch-bar .tb-y'), tbSub: $('#touch-bar .tb-sub'),
  ribbonBar: $('#ribbon-bar'), winLabel: $('#rb-win-label'),
  subjectFilter: $('#rb-subject-filter'), absenceBtn: $('#rb-absence-btn'),
  conflictBanner: $('#rb-conflict-banner'), conflictText: $('#rb-conflict-banner .cf-text'),
  conflictFix: $('#rb-conflict-fix'),
  horizonToggle: $('#horizon-toggle'), toast: $('#toast')
};

let toastTimer = 0;
function showToast(msg) {
  if (!ui.toast) return;
  ui.toast.textContent = msg;
  ui.toast.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('on'), 2800);
}

// ------------------------------------------------------------------ Core State
let climate, lay, nR, E0, E1;
let rawFlags = null;
let W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
let portrait = H > W * 1.1;
let L = {};
let level = 'disc'; // disc | ribbon | day

const disc = {
  cx: new Spring(0, { stiffness: 120, damping: 20 }),
  cy: new Spring(0, { stiffness: 120, damping: 20 }),
  R: new Spring(1, { stiffness: 120, damping: 20 }),
  dim: new Spring(0),
  fishAmt: new Spring(0, { stiffness: 220, damping: 28 }),
  scaleMix: new Spring(1, { stiffness: 130, damping: 20 }), // 1 = 今岁舒展, 0 = 百年均分
  focus: 0.9,
  hover: -1, hoverAmt: new Spring(0, { stiffness: 300, damping: 30 }),
  gap: new Spring(0, { stiffness: 140, damping: 16 }), pulled: -1,
  alpha: new Spring(1),
  nonUniform: true,
  touchSelectedK: -1
};
const lutN = 1024, lutMax = 1.22;
const lutArr = new Float32Array(lutN);

const band = {
  k: -1, y: 0, len: 365, start: -1, n: 0,
  X: null, V: null, T: null, K: null, half: null, halfV: null, halfT: null, us: null, normals: null,
  phase: null, // pull | fly | roll | laid | rewind | home
  cx: new Spring(0, { stiffness: 150, damping: 19 }),
  cy: new Spring(0, { stiffness: 150, damping: 19 }),
  Rr: new Spring(0, { stiffness: 150, damping: 19 }),
  rho: new Spring(0, { stiffness: 150, damping: 19 }),
  s: new Spring(0, { stiffness: 38, damping: 12.5 }),
  fishAmt: new Spring(0, { stiffness: 260, damping: 30 }),
  focus: 0,
  railX: new Spring(0, { stiffness: 130, damping: 22 }),
  railY: new Spring(0, { stiffness: 130, damping: 22 }),
  halfBase: new Spring(10, { stiffness: 130, damping: 22 }),
  winA: new Spring(0, { stiffness: 145, damping: 22 }),
  winB: new Spring(365, { stiffness: 145, damping: 22 }),
  scaleMode: 'year', // year | term | month | week
  grab: 0, tethered: true, lift: 0, focusDay: -1
};

const day = {
  sel: -1,
  reveal: new Spring(0, { stiffness: 165, damping: 24 }),
  minutes: new Spring(840, { stiffness: 68, damping: 16 }),
  from: { x: 0, y: 0, w: 1, h: 1 },
  time: 0,
  horizonMode: 'hour' // hour | year
};

// Peeled multi-material ribbon state
let activeLayers = []; // subset of ['schedule', 'homework', 'personal', 'exam', 'campus']
const peelSprings = Object.fromEntries(LAYER_META.map((m) => [m.id, new Spring(0, { stiffness: 150, damping: 20 })]));
let subjectFilter = '';
let absenceMode = false;
let absenceRange = null; // { startIso, endIso }
let hoverLink = null;
const dragState = { active: false, task: null, originX: 0, originY: 0, x: 0, y: 0, hoverSlot: null };
let latestConflictId = null;

// ------------------------------------------------------------------ Panels controller
const panels = createPanels({
  store,
  toast: showToast,
  getActiveDateIso: () => {
    if (level === 'day' && band.y && day.sel >= 0) return isoOfYearDoy(band.y, day.sel);
    if (level === 'ribbon' && band.y && band.focusDay >= 0) return isoOfYearDoy(band.y, band.focusDay);
    return TODAY_ISO;
  },
  onNavigateDate: (iso, openDayView = true) => {
    const p = parseIso(iso);
    if (!p) return;
    fastJumpTo({ year: p.y, scale: 'week', focusIso: iso, openDayView });
  },
  onStateMutated: () => {
    refreshStudentFlags();
    updateConflictBanner();
    if (level === 'day') renderDay();
    if (level === 'ribbon') renderSlip();
    tick.wake();
  }
});

// ------------------------------------------------------------------ Layout
function computeLayout() {
  W = innerWidth; H = innerHeight; dpr = Math.min(2, devicePixelRatio || 1);
  portrait = H > W * 1.1;
  const hasSecondary = activeLayers.length > 0;

  if (portrait) {
    const hasConflict = ui.conflictBanner && !ui.conflictBanner.hidden;
    const topSpace = hasConflict ? 148 : 122;
    const len = Math.max(280, H - topSpace - 36);
    const y0 = topSpace + 12;
    const railX = hasSecondary ? 26 : W - 56;
    L = {
      disc: { cx: W / 2, cy: H * 0.49, R: Math.min(W * 0.43, H * 0.285) },
      corner: { cx: 34, cy: 38, R: 22 },
      rail: { x: W - 56, y: y0, len, psi: Math.PI / 2, half: hasSecondary ? 10 : 13, d: 7, laidX: railX, laidY: y0 },
      dayRail: { x: W - 22, y: y0, half: 8, d: 14 }
    };
  } else {
    const len = Math.min((W - 180) / (1 + 1 / Math.PI), 1180, (H * 0.62) * Math.PI);
    const laidX = Math.max(136, Math.round((W - len) / 2 + 28));
    const laidY = hasSecondary
      ? Math.round(Math.max(132, H * 0.215))
      : Math.round(H * 0.48);
    L = {
      disc: { cx: W * 0.5, cy: H * 0.50, R: Math.min(H * 0.36, W * 0.27) },
      corner: { cx: 68, cy: 66, R: 40 },
      rail: { x: laidX, y: Math.round(H * 0.28), len, psi: 0, half: clamp(len / 52, 13, 21), d: 4.5, laidX, laidY },
      dayRail: { x: (W - len) / 2, y: H - 64, half: 10, d: 12 }
    };
  }
  L.rail.wheel = L.rail.len / TAU;

  [skyCanvas, layersCanvas].forEach((cv) => {
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
  });
  R && R.resize(W, H, dpr);
  document.body.classList.toggle('portrait', portrait);
}

function discTargets(immediate) {
  const t = level === 'disc' ? L.disc : L.corner;
  for (const [s, v] of [[disc.cx, t.cx], [disc.cy, t.cy], [disc.R, t.R]]) immediate ? s.set(v) : s.to(v);
  disc.dim.to(level === 'disc' ? 0 : 0.08);
}

function railTargets(immediate) {
  computeLayout();
  const r = level === 'day' ? L.dayRail : L.rail;
  const laid = level === 'day' || band.phase === 'laid';
  const x = level === 'day' ? (portrait ? r.x : r.x) : laid ? L.rail.laidX : r.x;
  const y = level === 'day' ? r.y : laid ? L.rail.laidY : r.y;
  const half = r.half;
  immediate ? band.railX.set(x) : band.railX.to(x);
  immediate ? band.railY.set(y) : band.railY.to(y);
  immediate ? band.halfBase.set(half) : band.halfBase.to(half);
}

// ------------------------------------------------------------------ Living Cambium Trunk Geometry
let gapEdges = null;
function computeGapEdges() {
  const groove = 2 / Math.max(20, disc.R.x);
  gapEdges = computeDisplayEdges(lay.edges, nR, {
    scaleMix: disc.scaleMix.x,
    pulled: disc.pulled,
    gap: disc.gap.x,
    groove
  });
}

const findRing = (edges, r) => {
  if (r < edges[0] || r >= edges[nR]) return -1;
  let lo = 0, hi = nR - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (edges[mid] <= r) lo = mid; else hi = mid - 1; }
  return lo;
};

const fishD = () => adaptiveFishD(disc.focus, E0, E1, disc.fishAmt.x, { coarse, portrait, scaleMix: disc.scaleMix.x });

function discForward(rn) {
  if (rn < E0 || rn >= E1) return rn;
  const k = findRing(lay.edges, rn), e = lay.edges;
  const t = (rn - e[k]) / (e[k + 1] - e[k]);
  const rg = gapEdges[k] + t * (gapEdges[k + 1] - gapEdges[k]);
  return fisheye(rg, disc.focus, E0, E1, fishD());
}

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

function discPick(px, py, prevK = -1) {
  const R0 = disc.R.x;
  const dx = (px - disc.cx.x) / R0, dy = (py - disc.cy.x) / R0;
  const rr = Math.hypot(dx, dy);
  const th = (Math.atan2(dx, -dy) + TAU) % TAU;
  const rs = rr / wobble(th);
  const rn = discInverse(rs);
  let k = rn < 0 ? -1 : findRing(lay.edges, rn);
  if (k >= 0 && prevK >= 0) k = applyRingDetent(k, rn, lay.edges, prevK, coarse || portrait ? 0.22 : 0.14);
  return { k, th, rs, rr, inside: rs < E1 + 0.06 };
}

// ------------------------------------------------------------------ Textures (Climate + History + Student Marks)
function buildTextures() {
  const cols = 366;
  const data = new Uint8Array(cols * nR * 4);
  rawFlags = new Uint8Array(cols * nR * 4);
  for (let k = 0; k < nR; k++) {
    const y = SCHOOL_YEAR + k, len = yearLength(y), s = y >= FIRST_YEAR ? yearStart(y) : -1;
    let doy = 0;
    for (let m = 1; m <= 12; m++) {
      rawFlags[(k * cols + doy) * 4] = 255;
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
      if ((climate.value('gust', i) ?? 0) >= 89) rawFlags[o + 2] = 255;
    }
    for (const e of entriesOfYear(y)) {
      if (e.when === 'day' || e.when === 'about') rawFlags[(k * cols + dayOfYear(y, e.m, e.d)) * 4 + 1] = 255;
      if (e.when === 'month') {
        const a = dayOfYear(y, e.m, 1), n = new Date(Date.UTC(y, e.m, 0)).getUTCDate();
        for (let d = a; d < a + n; d++) rawFlags[(k * cols + d) * 4 + 1] = Math.max(rawFlags[(k * cols + d) * 4 + 1], 160);
      }
    }
  }
  applyStudentFlagsIntoBuffer();
  R.setDays(data, rawFlags, cols, nR, SCHOOL_YEAR);
  R.setEdges(new Float32Array(lay.edges));
}

function applyStudentFlagsIntoBuffer() {
  if (!rawFlags) return;
  const cols = 366;
  // Clear alpha channel (student marks) then stamp exams & tasks/growth
  for (let i = 3; i < rawFlags.length; i += 4) rawFlags[i] = 0;
  const state = store.getState();
  const stamp = (iso, val) => {
    const p = parseIso(iso);
    if (!p) return;
    const k = p.y - SCHOOL_YEAR;
    if (k < 0 || k >= nR) return;
    const d = doyOfIso(iso);
    const o = (k * cols + d) * 4 + 3;
    rawFlags[o] = Math.max(rawFlags[o], val);
  };
  (state.tasks || []).forEach((t) => stamp(t.dueIso, 110));
  (state.personal || []).forEach((b) => stamp(b.dateIso, 110));
  (state.campusNotes || []).forEach((n) => stamp(n.dateIso, 120));
  (state.exams || []).forEach((e) => stamp(e.dateIso, 240));
}

function refreshStudentFlags() {
  if (!rawFlags || !R) return;
  applyStudentFlagsIntoBuffer();
  R.setFlags(rawFlags, 366, nR);
}

// ------------------------------------------------------------------ Band Geometry & Semantic Zoom
function allocBand(k) {
  const y = SCHOOL_YEAR + k, len = yearLength(y), n = len + 1;
  Object.assign(band, {
    k, y, len, n, start: y >= FIRST_YEAR ? yearStart(y) : -1,
    X: new Float32Array(n * 2), V: new Float32Array(n * 2), T: new Float32Array(n * 2), K: new Float32Array(n),
    half: new Float32Array(n), halfV: new Float32Array(n), halfT: new Float32Array(n),
    us: Float32Array.from({ length: n }, (_, j) => j), normals: new Float32Array(n * 2), focusDay: -1,
    scaleMode: 'year'
  });
  band.winA.set(0);
  band.winB.set(len);
}

function setSemanticScale(mode, anchorIso = null) {
  if (!band.n) return;
  if (level === 'ribbon' && band.phase !== 'laid') {
    band.phase = 'laid';
    band.s.set(L.rail.len);
    railTargets(false);
  }
  band.scaleMode = mode;
  const anchor = anchorIso
    ? parseIso(anchorIso)
    : band.focusDay >= 0
      ? dateOf(band.y, band.focusDay)
      : band.y === TODAY_YEAR
        ? TODAY_PARTS
        : { y: band.y, m: 11, d: 1 };
  const anchorDoy = clamp(dayOfYear(band.y, anchor.m, anchor.d), 0, band.len - 1);

  let a = 0, b = band.len;
  if (mode === 'term') {
    if (anchor.m >= 8) { a = dayOfYear(band.y, 9, 1); b = band.len; }
    else { a = dayOfYear(band.y, 2, 15); b = dayOfYear(band.y, 7, 15); }
  } else if (mode === 'month') {
    a = dayOfYear(band.y, anchor.m, 1);
    b = a + new Date(Date.UTC(band.y, anchor.m, 0)).getUTCDate();
  } else if (mode === 'week') {
    const iso = isoOfYearDoy(band.y, anchorDoy);
    const wr = weekRangeOfIso(iso);
    const pA = parseIso(wr.startIso);
    a = pA.y < band.y ? 0 : doyOfIso(wr.startIso);
    b = Math.min(band.len, a + 7);
    if (b - a < 7) a = Math.max(0, b - 7);
  }
  band.winA.to(a);
  band.winB.to(b);
  syncScaleUI();
  tick.wake();
}

function panWindow(dir) {
  if (band.scaleMode === 'year') return;
  const span = Math.max(7, Math.round(band.winB.target - band.winA.target));
  const step = band.scaleMode === 'week' ? 7 : band.scaleMode === 'month' ? 30 : 60;
  let a = clamp(band.winA.target + dir * step, 0, Math.max(0, band.len - span));
  let b = Math.min(band.len, a + span);
  if (b - a < span) a = Math.max(0, b - span);
  band.winA.to(a); band.winB.to(b);
  sound.tick(true);
  syncScaleUI();
  tick.wake();
}

function syncScaleUI() {
  document.querySelectorAll('#ribbon-bar [data-scale]').forEach((b) => {
    b.classList.toggle('active', b.dataset.scale === band.scaleMode);
  });
  document.querySelectorAll('#ribbon-bar [data-layer]').forEach((b) => {
    b.classList.toggle('active', activeLayers.includes(b.dataset.layer));
  });
  const a = Math.round(band.winA.target), b = Math.max(a + 1, Math.round(band.winB.target));
  const dA = dateOf(band.y, clamp(a, 0, band.len - 1));
  const dB = dateOf(band.y, clamp(b - 1, 0, band.len - 1));
  if (band.scaleMode === 'year') ui.winLabel.textContent = `${band.y} 全年`;
  else if (band.scaleMode === 'term') ui.winLabel.textContent = dA.m >= 8 ? `${band.y} 秋季` : `${band.y} 春季`;
  else if (band.scaleMode === 'month') ui.winLabel.textContent = `${dA.m} 月`;
  else ui.winLabel.textContent = `${dA.m}/${dA.d}–${dB.m}/${dB.d}`;
}

function toggleLayer(id, forceState = null) {
  if (level === 'ribbon' && band.phase !== 'laid') {
    band.phase = 'laid';
    band.s.set(L.rail.len);
  }
  const has = activeLayers.includes(id);
  const next = forceState === null ? !has : forceState;
  if (next && !has) {
    activeLayers.push(id);
    peelSprings[id].to(1);
    sound.peel(true);
  } else if (!next && has) {
    activeLayers = activeLayers.filter((x) => x !== id);
    peelSprings[id].to(0);
    sound.peel(false);
  }
  panels.closePopover();
  railTargets(false);
  syncScaleUI();
  updateConflictBanner();
  tick.wake();
}

function updateConflictBanner() {
  if (!ui.conflictBanner) return;
  const conflicts = detectAllConflicts(store.getState());
  const wasHidden = ui.conflictBanner.hidden;
  if (level === 'ribbon' && band.y === TODAY_YEAR && conflicts.length > 0 && (activeLayers.includes('personal') || activeLayers.includes('exam'))) {
    const c = conflicts[0];
    latestConflictId = c.a.kind === 'personal' ? c.a.id : c.b.id;
    ui.conflictText.textContent = portrait
      ? `⚠ ${c.dateIso.slice(5)} 冲突(${c.overlapMinutes}分)`
      : `⚠ 发现冲突（${conflicts.length}）：${c.dateIso.slice(5)} ${c.a.title} × ${c.b.title} 重叠 ${c.overlapMinutes} 分钟`;
    ui.conflictBanner.hidden = false;
  } else {
    ui.conflictBanner.hidden = true;
    latestConflictId = null;
  }
  if (portrait && wasHidden !== ui.conflictBanner.hidden) railTargets(false);
}

function xOfDay(dayFloat) {
  const Lr = L.rail.len;
  const span = Math.max(0.01, band.winB.x - band.winA.x);
  const norm = clamp((dayFloat - band.winA.x) / span, 0, 1);
  const sj = norm * Lr;
  const amt = band.phase === 'laid' ? band.fishAmt.x : 0;
  const baseD = band.scaleMode === 'week' ? 0.35 : band.scaleMode === 'month' ? 1.4 : L.rail.d;
  const dd = (level === 'day' ? L.dayRail.d : baseD) * amt;
  return fisheye(sj, band.focus, 0, Lr, dd);
}

function dayAtLocal(x) {
  const Lr = L.rail.len;
  const baseD = band.scaleMode === 'week' ? 0.35 : band.scaleMode === 'month' ? 1.4 : L.rail.d;
  const dd = (level === 'day' ? L.dayRail.d : baseD) * band.fishAmt.x;
  const orig = fisheyeInv(clamp(x, 0, Lr), band.focus, 0, Lr, dd);
  const dayF = lerp(band.winA.x, band.winB.x, orig / Lr);
  return clamp(Math.floor(dayF), 0, band.len - 1);
}

const dayCentre = (d) => {
  const span = Math.max(0.01, band.winB.x - band.winA.x);
  return clamp(((d + 0.5 - band.winA.x) / span) * L.rail.len, 0, L.rail.len);
};

function slotTargets() {
  const e = lay.edges, k = band.k;
  const r0 = discForward(e[k] + 1e-6), r1 = discForward(e[k + 1] - 1e-6);
  const rg0 = gapEdges[k], rg1 = gapEdges[k + 1];
  const mid = disc.gap.x > 0.02 ? fisheye((rg0 + rg1) / 2, disc.focus, E0, E1, fishD()) : (r0 + r1) / 2;
  const half = Math.max(0.8, ((r1 - r0) / 2) * disc.R.x);
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

function rollTargets(s) {
  const { len: Lr, psi } = L.rail, Rw = L.rail.wheel;
  const gx = band.railX.x, gy = band.railY.x;
  const amt = band.phase === 'laid' ? band.fishAmt.x : 0;
  const baseD = band.scaleMode === 'week' ? 0.35 : band.scaleMode === 'month' ? 1.4 : L.rail.d;
  const dd = (level === 'day' ? L.dayRail.d : baseD) * amt;
  const f = band.focus;
  const sigma = level === 'day' ? 60 : 40;
  const zoomActive = band.phase === 'laid' && level !== 'day';

  for (let j = 0; j < band.n; j++) {
    const frac = j / band.len;
    band.us[j] = zoomActive ? lerp(band.winA.x, band.winB.x, frac) : j;
    const sj = frac * Lr;
    let lx, ly;
    if (sj <= s) { lx = fisheye(sj, f, 0, Lr, dd); ly = 0; }
    else { const b = (sj - s) / Rw; lx = s + Rw * Math.sin(b); ly = Rw - Rw * Math.cos(b); }
    const [x, y] = rot(lx, ly, psi);
    band.T[j * 2] = gx + x; band.T[j * 2 + 1] = gy + y;
    const bulgeScale = band.scaleMode === 'week' ? 0.25 : 0.7;
    const bulge = sj <= s && amt > 0 ? 1 + bulgeScale * amt * Math.exp(-(((lx - f) / sigma) ** 2)) : 1;
    band.halfT[j] = band.halfBase.x * bulge;
  }
}

function wheelCentre(s) {
  const [x, y] = rot(s, L.rail.wheel, L.rail.psi);
  return { x: band.railX.x + x, y: band.railY.x + y };
}

// ------------------------------------------------------------------ Transitions & Fast Paths
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
  ui.touchBar.hidden = true;
  haptic(6);
}

function goRibbon() {
  level = 'ribbon';
  band.phase = 'fly';
  railTargets(false);
  const c = wheelCentre(0);
  band.cx.to(c.x); band.cy.to(c.y); band.Rr.to(L.rail.wheel);
  let target = L.rail.psi;
  while (target - band.rho.x > Math.PI) target -= TAU;
  while (target - band.rho.x < -Math.PI) target += TAU;
  band.rho.to(target);
  band.s.set(0);
  disc.gap.to(1);
  discTargets(false);
  disc.fishAmt.to(0); disc.hoverAmt.to(0);
  showHud(-1);
  ui.touchBar.hidden = true;
  document.body.dataset.level = 'ribbon';
  ui.ribbonBar.classList.add('on');
  announce(`抽出了 ${band.y} 年。可缩放学期月周，或剥离课表、作业、日程与考试时间带。`);
  renderSlip();
  renderKnots();
  syncScaleUI();
  updateConflictBanner();
}

/** High-frequency fast jump (Today / This Week / This Term) — zero waiting friction! */
function fastJumpTo({ year = TODAY_YEAR, scale = 'week', layers = null, focusIso = TODAY_ISO, openDayView = false }) {
  cancelIntro();
  panels.closePopover();
  const k = clamp(year - SCHOOL_YEAR, 0, nR - 1);
  if (band.k !== k || !band.phase || band.phase === 'home') {
    allocBand(k);
    disc.pulled = k;
    disc.gap.set(1);
    computeGapEdges();
  }
  if (layers) {
    activeLayers = [...layers];
    LAYER_META.forEach((m) => peelSprings[m.id].to(activeLayers.includes(m.id) ? 1 : 0));
  }
  level = 'ribbon';
  document.body.dataset.level = 'ribbon';
  band.phase = 'laid';
  railTargets(false);
  band.s.set(L.rail.len);
  setSemanticScale(scale, focusIso);
  // Seed initial geometry cleanly so springs ease rather than snap from (0,0)
  rollTargets(L.rail.len);
  if (band.X[0] === 0 && band.X[1] === 0) {
    band.X.set(band.T); band.half.set(band.halfT);
  }
  discTargets(false);
  disc.fishAmt.to(0); disc.hoverAmt.to(0);
  showHud(-1);
  ui.touchBar.hidden = true;
  ui.hint.classList.add('gone');
  ui.ribbonBar.classList.add('on');
  renderSlip();
  renderKnots();
  syncScaleUI();
  updateConflictBanner();
  sound.peel(true);
  if (openDayView) {
    const doy = clamp(doyOfIso(focusIso), 0, band.len - 1);
    band.winA.set(0); band.winB.set(band.len); band.scaleMode = 'year';
    rollTargets(L.rail.len); band.X.set(band.T); band.half.set(band.halfT);
    openDay(doy);
  }
  tick.wake();
}

let knotEls = [];
function renderKnots() {
  ui.knots.innerHTML = '';
  const list = entriesOfYear(band.y).filter((e) => e.when !== 'year')
    .map((e) => ({ e, d: e.when === 'month' ? dayOfYear(e.y, e.m, 15) : dayOfYear(e.y, e.m, e.d) }))
    .sort((a, b) => a.d - b.d);
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
  panels.closeTopModal();
  panels.closePopover();
  absenceMode = false;
  absenceRange = null;
  ui.absenceBtn.classList.remove('active');
  if (level === 'day') closeDay(true);
  // Fold secondary ribbons neatly back behind the wood
  activeLayers = [];
  LAYER_META.forEach((m) => peelSprings[m.id].to(0));
  band.winA.to(0); band.winB.to(band.len); band.scaleMode = 'year';
  level = 'disc';
  document.body.dataset.level = 'disc';
  ui.ribbonBar.classList.remove('on');
  ui.conflictBanner.hidden = true;
  band.fishAmt.to(0);
  band.phase = band.phase === 'pull' ? 'home' : 'rewind';
  band.s.to(0);
  railTargets(false);
  discTargets(false);
  ui.slip.classList.remove('open');
  setTag(null);
  announce('年轮放回了树干。');
  tick.wake();
}

function openDay(d) {
  if (d < 0 || d >= band.len) return;
  panels.closePopover();
  level = 'day';
  document.body.dataset.level = 'day';
  day.sel = d;
  day.reveal.to(1);
  day.horizonMode = band.y === TODAY_YEAR ? 'hour' : 'year';
  paintHorizonToggle();
  sound.breath(true);
  const date = dateOf(band.y, d);
  const st = sunTimes(date.y, date.m, date.d);
  day.minutes.set(st.rise ?? 360);
  day.minutes.to(clamp(15 * 60, (st.rise ?? 360) + 60, (st.set ?? 1080) - 60));
  band.winA.to(0); band.winB.to(band.len);
  band.focus = ((d + 0.5) / band.len) * L.rail.len;
  railTargets(false);
  renderDay();
  setTag(null);
  tick.wake();
}

function closeDay(silent) {
  if (level !== 'day') return;
  level = 'ribbon';
  document.body.dataset.level = 'ribbon';
  day.reveal.to(0);
  setSemanticScale(band.scaleMode, isoOfYearDoy(band.y, day.sel));
  railTargets(false);
  sound.breath(false);
  updateConflictBanner();
  if (!silent) announce('收起了这一天。');
  tick.wake();
}

function setDay(d) {
  d = clamp(d, 0, band.len - 1);
  if (d === day.sel) return;
  day.sel = d;
  band.focus = ((d + 0.5) / band.len) * L.rail.len;
  renderDay();
  sound.tick(dateOf(band.y, d).d === 1);
  tick.wake();
}

function paintHorizonToggle() {
  ui.horizonToggle.textContent = day.horizonMode === 'hour' ? '地平线 · 时辰作息' : '地平线 · 全年木带';
}

// ------------------------------------------------------------------ Text & HUD
const fmt = (v, digits = 0) => (v == null ? '—' : v.toLocaleString('zh-CN', { maximumFractionDigits: digits, minimumFractionDigits: digits }));

function yearFacts(y) {
  if (y < FIRST_YEAR) return '这一圈没有逐日天气：ERA5 再分析从 1940 年开始。';
  const r = climate.years[y - FIRST_YEAR];
  if (!r) return '';
  const hot = parts(r.hotDay), windy = parts(r.gustDay);
  const tail = r.full ? '' : `（天气记录到 ${climate.meta.last.slice(5).replace('-', ' 月 ')} 日）`;
  return `雨 ${fmt(r.rain)} mm · 雨日 ${r.wet} · 最热 ${hot.m}/${hot.d} ${fmt(r.hot, 1)}°C · 最大阵风 ${r.gust} km/h${tail}`;
}

function studentYearSummary(y) {
  const state = store.getState();
  const tasks = (state.tasks || []).filter((t) => parseIso(t.dueIso)?.y === y);
  const exams = (state.exams || []).filter((e) => parseIso(e.dateIso)?.y === y);
  const growth = (state.campusNotes || []).filter((n) => parseIso(n.dateIso)?.y === y);
  if (!tasks.length && !exams.length && !growth.length) return '';
  const pending = tasks.filter((t) => !t.completed).length;
  return `活木时光：待办 ${pending}/${tasks.length} · 考试 ${exams.length} 场 · 校园与成长 ${growth.length} 条`;
}

function showHud(k, px, py) {
  if (k < 0) { ui.hud.classList.remove('on'); return; }
  const y = SCHOOL_YEAR + k;
  ui.hudYear.textContent = y;
  const ageTag = y === TODAY_YEAR ? ' · 今岁形成层' : y >= TODAY_YEAR - 4 ? ' · 近岁边材' : ' · 百年心材';
  ui.hudGz.textContent = `${ganzhi(y)} · 第 ${y - SCHOOL_YEAR + 1} 圈${ageTag}`;
  ui.hudFacts.textContent = yearFacts(y);
  ui.hudStudent.textContent = studentYearSummary(y);
  const ev = entriesOfYear(y);
  ui.hudEvents.innerHTML = ev.map((e) => `<li><i class="${e.kind}"></i>${e.when === 'year' ? '' : e.m + ' 月 · '}${e.title}</li>`).join('');
  ui.hud.classList.add('on');
  if (!portrait) {
    const ang = Math.atan2(py - disc.cy.x, px - disc.cx.x);
    const left = Math.cos(ang) < 0;
    const minOut = disc.R.x * 1.18;
    const rawX = disc.cx.x + Math.cos(ang) * disc.R.x * 1.24;
    const x = left ? Math.min(rawX, disc.cx.x - minOut) : Math.max(rawX, disc.cx.x + minOut);
    const yy = disc.cy.x + Math.sin(ang) * disc.R.x * 0.92;
    ui.hud.style.transform = `translate(${left ? Math.max(16, x - 300) : Math.min(W - 316, x)}px, ${clamp(yy - 40, 86, H - 240)}px)`;
    ui.hud.classList.toggle('left', left);
  } else {
    ui.hud.style.transform = '';
  }
}

function updateTouchBar(k) {
  if (k < 0 || level !== 'disc') { ui.touchBar.hidden = true; return; }
  disc.touchSelectedK = k;
  const y = SCHOOL_YEAR + k;
  ui.tbY.textContent = String(y);
  const sub = studentYearSummary(y) || (entriesOfYear(y)[0]?.title) || `${ganzhi(y)}年 · 第 ${k + 1} 圈`;
  ui.tbSub.textContent = sub;
  ui.touchBar.hidden = false;
}

function setTag(d) {
  if (d == null || d < 0) { ui.tag.classList.remove('on'); return; }
  sound.tick(dateOf(band.y, d).d === 1);
  const date = dateOf(band.y, d);
  const iso = isoOfYearDoy(band.y, d);
  const i = band.start >= 0 ? band.start + d : -1;
  const row = i >= 0 && i < climate.days ? climate.row(i) : null;
  const ev = entriesOn(date);
  const dayItems = itemsForDate(store.getState(), iso);
  const line = row ? describeDay(row) : band.start < 0 ? '没有逐日天气记录' : 'ERA5 气候记录截至 11 月 16 日';
  ui.tag.querySelector('.d').textContent = `${date.m} 月 ${date.d} 日`;
  ui.tag.querySelector('.w').textContent = `星期${WEEK[date.wd]}${iso === TODAY_ISO ? ' · 今日' : ''}`;
  ui.tag.querySelector('.l').textContent = line;
  const sParts = [];
  if (dayItems.courses.length) sParts.push(`课 ${dayItems.courses.length}`);
  if (dayItems.tasks.length) sParts.push(`作业 ${dayItems.tasks.length}`);
  if (dayItems.personal.length) sParts.push(`日程 ${dayItems.personal.length}`);
  if (dayItems.exams.length) sParts.push(`考试 ${dayItems.exams.length}`);
  ui.tag.querySelector('.s').textContent = sParts.join(' · ');
  const badges = extremes(i);
  ui.tag.querySelector('.e').innerHTML = [
    ...badges.map((b) => `<b>${b}</b>`),
    ...dayItems.exams.map((ex) => `<b class="exam">${ex.title.slice(0, 10)}</b>`),
    ...ev.map((e) => `<b class="${e.kind}">${e.title}</b>`)
  ].join('');
  ui.tag.classList.add('on');
}

let spanCache = { y: -1, s: null };
function extremes(i) {
  if (i < 0 || i >= climate.days) return [];
  if (spanCache.y !== band.y) spanCache = { y: band.y, s: climate.span(band.start, band.start + band.len - 1) };
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
  const stSummary = studentYearSummary(y);
  ui.slip.querySelector('.y').textContent = y;
  ui.slip.querySelector('.gz').textContent = ganzhi(y) + '年';
  ui.slip.querySelector('.facts').textContent = yearFacts(y) + (stSummary ? `｜${stSummary}` : '');
  ui.slip.querySelector('.more').innerHTML = (yearOnly.length ? yearOnly.map(entryHTML).join('') : '') +
    (ev.length && !yearOnly.length ? '<p class="quiet">这一年的事，刻在带子上的结与叠层里。</p>' : '') +
    (!ev.length ? '<p class="quiet">这一年，HAIZ 史料档案尚未录入事件。可在上方叠层记录自己的时光。</p>' : '');
  const totalCount = ev.length + (y === TODAY_YEAR ? store.getState().exams.length : 0);
  ui.slip.querySelector('.count').textContent = totalCount ? `${totalCount} 处印记` : '';
}

function renderDay() {
  const d = day.sel, date = dateOf(band.y, d);
  const iso = isoOfYearDoy(band.y, d);
  const i = band.start >= 0 ? band.start + d : -1;
  const row = i >= 0 && i < climate.days ? climate.row(i) : null;
  const st = sunTimes(date.y, date.m, date.d);
  const moon = moonAt(msOf(date.y, date.m, date.d, 1320));
  const badges = extremes(i);
  ui.day.querySelector('.date').innerHTML = `${date.y}<small>年</small>${date.m}<small>月</small>${date.d}<small>日</small>`;
  ui.day.querySelector('.wd').textContent = `星期${WEEK[date.wd]} · ${ganzhi(date.y)}年 · 第 ${d + 1} 天${iso === TODAY_ISO ? ' · 今日' : ''}`;
  ui.day.querySelector('.desc').textContent = row ? describeDay(row) : band.start < 0 ? '这一天没有逐日天气记录：ERA5 从 1940 年开始。天空按晴天画出。' : 'ERA5 天气实录截至 2026-11-16；今日校园天空按实时太阳轨迹画出。';
  ui.day.querySelector('.sun').textContent = `日出 ${st.rise != null ? fmtClock(st.rise) : '—'} · 日落 ${st.set != null ? fmtClock(st.set) : '—'} · 当晚${moon.name}${row && row.cloud != null ? ` · 云量 ${row.cloud}%` : ''}`;
  ui.day.querySelector('.badges').innerHTML = badges.map((b) => `<b>${b}</b>`).join('');
  panels.renderDayBody(iso);
  announce(`${date.y} 年 ${date.m} 月 ${date.d} 日`);
}

const seen = { band: false };
let announceT = 0;
function announce(text) { clearTimeout(announceT); announceT = setTimeout(() => { ui.live.textContent = text; }, 250); }
function haptic(ms) { try { if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return; navigator.vibrate && navigator.vibrate(ms); } catch (_) {} }

// ------------------------------------------------------------------ Input & Cross-Ribbon Drag
const ptr = { id: null, x: 0, y: 0, x0: 0, y0: 0, t0: 0, mode: null, moved: false, vx: 0, vy: 0, lt: 0, hold: 0, k: -1, th: 0, hit: null, absStartDoy: -1 };
glCanvas.style.touchAction = 'none';

function bandLocal(px, py) {
  const dx = px - band.railX.x, dy = py - band.railY.x;
  const [x, y] = rot(dx, dy, -L.rail.psi);
  return { x, y };
}

function onBand(px, py, pad = 18) {
  if (!band.phase || (band.phase !== 'laid' && band.phase !== 'roll')) return null;
  const { x, y } = bandLocal(px, py);
  const s = band.s.x;
  const h = band.halfBase.x * 1.8 + pad;
  if (x > -pad && x < s + pad && Math.abs(y) < h) return { x, y, along: true };
  const c = wheelCentre(s);
  if (s < L.rail.len - 2 && Math.hypot(px - c.x, py - c.y) < L.rail.wheel + band.halfBase.x + pad) return { x, y, wheel: true };
  return null;
}

function inCorner(px, py) {
  if (level === 'disc') return false;
  const dx = px - disc.cx.x, dy = py - disc.cy.x;
  return Math.hypot(dx, dy) < disc.R.x * 1.35 || (dx > 0 && dx < disc.R.x * 1.35 + 88 && Math.abs(dy) < 18);
}

glCanvas.addEventListener('pointerdown', (e) => {
  if (ptr.id !== null || !climate || panels.hasOpenModal()) return;
  cancelIntro();
  sound.wake();
  panels.closePopover();
  glCanvas.setPointerCapture(e.pointerId);
  Object.assign(ptr, { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), lt: performance.now(), moved: false, vx: 0, vy: 0, mode: null, hit: null });
  const { clientX: px, clientY: py } = e;

  if (inCorner(px, py)) { ptr.mode = 'corner'; return; }

  if (level === 'disc') {
    if (band.phase && band.phase !== 'home') return;
    const p = discPick(px, py, disc.hover);
    if (!p.inside) { ptr.mode = 'none'; ui.touchBar.hidden = true; return; }
    disc.focus = clamp(p.rs, E0, E1);
    disc.fishAmt.to(1);
    ptr.k = p.k; ptr.th = p.th;
    if (e.pointerType === 'mouse') {
      ptr.mode = 'armed';
      if (p.k >= 0) setHover(p.k, px, py);
    } else {
      ptr.mode = 'scrub';
      setHover(p.k, px, py);
      updateTouchBar(p.k);
      armHold();
    }
  } else if (level === 'ribbon') {
    // 1. Absence range selection drag
    if (absenceMode && band.phase === 'laid') {
      const { x } = bandLocal(px, py);
      const d = dayAtLocal(x);
      ptr.mode = 'absence';
      ptr.absStartDoy = d;
      const iso = isoOfYearDoy(band.y, d);
      absenceRange = { startIso: iso, endIso: iso };
      tick.wake();
      return;
    }

    // 2. Check peeled secondary material ribbons first
    const rHit = hitTestRibbons(px, py);
    if (rHit) {
      ptr.hit = rHit;
      if (rHit.kind === 'task') {
        ptr.mode = 'task-drag';
        dragState.task = rHit.item;
        dragState.originX = px; dragState.originY = py;
        dragState.x = px; dragState.y = py;
        dragState.active = false;
        dragState.hoverSlot = null;
        return;
      }
      ptr.mode = 'ribbon-item';
      return;
    }

    // 3. Primary WebGL wood ribbon
    const hit = onBand(px, py);
    if (!hit) { ptr.mode = 'none'; return; }
    const endGrab = portrait ? 34 : 22;
    if (band.scaleMode === 'year' && (hit.wheel || (band.phase === 'laid' && hit.x > band.s.x - endGrab))) {
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
    // Check Day hourly horizon hit first
    if (day.horizonMode === 'hour') {
      const hHit = hitTestRibbons(px, py);
      if (hHit) { ptr.mode = 'day-item'; ptr.hit = hHit; return; }
    }
    const hit = onBand(px, py, 26);
    if (day.horizonMode === 'year' && hit && hit.along) { ptr.mode = 'dayband'; setDay(dayAtLocal(hit.x)); }
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
      disc.hoverAmt.v += 8;
      ui.hint.classList.add('gone');
    }
  }, 240);
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
        const p = discPick(px, py, ptr.k);
        if (p.inside) {
          disc.focus = clamp(p.rs, E0, E1);
          if (p.k !== ptr.k && p.k >= 0) {
            ptr.k = p.k; ptr.th = p.th;
            setHover(p.k, px, py);
            updateTouchBar(p.k);
            armHold();
          }
        }
        if (dist > 6) { ptr.x0 = px; ptr.y0 = py; armHold(); }
        break;
      }
      case 'armed':
        if (dist > 8 && ptr.k >= 0) { ptr.mode = 'pull'; pullStart(ptr.k, ptr.th, ptr.x0, ptr.y0); showHud(-1); }
        break;
      case 'pull': band.pull.x = px; band.pull.y = py; break;
      case 'task-drag': {
        if (dist > 8) {
          dragState.active = true;
          dragState.x = px; dragState.y = py;
          // Auto-peel Personal ribbon if hidden so student can drop right onto free slots!
          if (!activeLayers.includes('personal')) toggleLayer('personal', true);
          dragState.hoverSlot = hitTestFreeSlot(px, py);
        }
        break;
      }
      case 'absence': {
        const { x } = bandLocal(px, py);
        const d = dayAtLocal(x);
        const a = isoOfYearDoy(band.y, Math.min(ptr.absStartDoy, d));
        const b = isoOfYearDoy(band.y, Math.max(ptr.absStartDoy, d));
        absenceRange = { startIso: a, endIso: b };
        break;
      }
      case 'band': {
        const { x, y } = bandLocal(px, py);
        const edge = band.halfBase.x * 1.4 + 14;
        if (ptr.moved && !ptr.perp && Math.abs(y) > edge && activeLayers.length === 0) {
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

  // Hover (mouse)
  if (e.pointerType !== 'mouse' || !climate || panels.hasOpenModal()) return;
  if (level === 'disc' && (!band.phase || band.phase === 'home' || ptr.mode === 'intro')) {
    const p = discPick(px, py, disc.hover);
    if (p.inside) { cancelIntro(); disc.focus = clamp(p.rs, E0, E1); disc.fishAmt.to(1); setHover(p.k, px, py); glCanvas.style.cursor = p.k >= 0 ? 'grab' : 'default'; }
    else { disc.fishAmt.to(0); setHover(-1); glCanvas.style.cursor = 'default'; }
  } else if (level === 'ribbon') {
    const rHit = hitTestRibbons(px, py);
    if (rHit) {
      hoverLink = rHit.kind === 'course' ? { courseId: rHit.item.id, subject: rHit.item.subject }
        : rHit.kind === 'task' ? { taskId: rHit.item.id, subject: rHit.item.subject }
        : rHit.kind === 'personal' ? { personalId: rHit.item.id }
        : rHit.kind === 'exam' ? { examId: rHit.item.id }
        : null;
      glCanvas.style.cursor = rHit.kind === 'task' ? 'grab' : 'pointer';
      const { x } = bandLocal(px, py);
      band.focus = clamp(x, 0, L.rail.len);
      band.focusDay = dayAtLocal(x);
      setTag(null);
      tick.wake();
      return;
    }
    hoverLink = null;
    const hit = onBand(px, py);
    if (hit && hit.along && band.phase === 'laid' && (band.scaleMode !== 'year' || hit.x <= band.s.x - 22)) {
      band.focus = clamp(hit.x, 0, L.rail.len); band.fishAmt.to(1);
      const d = dayAtLocal(hit.x);
      if (d !== band.focusDay) { band.focusDay = d; setTag(d); }
      glCanvas.style.cursor = absenceMode ? 'crosshair' : 'pointer';
    } else if (hit && band.scaleMode === 'year' && (hit.wheel || hit.x > band.s.x - 22)) {
      glCanvas.style.cursor = 'grab';
    } else {
      band.fishAmt.to(0); band.focusDay = -1; setTag(null);
      glCanvas.style.cursor = inCorner(px, py) ? 'pointer' : 'default';
    }
  } else if (level === 'day') {
    const hHit = day.horizonMode === 'hour' ? hitTestRibbons(px, py) : null;
    const hit = day.horizonMode === 'year' ? onBand(px, py, 26) : null;
    glCanvas.style.cursor = hHit || hit || inCorner(px, py) ? 'pointer' : 'ew-resize';
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
      if (tap && ptr.k >= 0) {
        // On outer wide rings (recent 5 years), tap extracts immediately; on compressed heartwood, lock into touch-bar for crisp confirm!
        if (ptr.k >= nR - 5) { pullStart(ptr.k, ptr.th, px, py); goRibbon(); }
        else updateTouchBar(ptr.k);
      }
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
    case 'task-drag': {
      if (dragState.active && dragState.task) {
        const slot = dragState.hoverSlot || hitTestFreeSlot(px, py);
        if (slot) {
          store.scheduleTaskIntoSlot(dragState.task.id, {
            dateIso: slot.dateIso,
            startMinute: slot.startMinute,
            endMinute: Math.min(slot.endMinute, slot.startMinute + (dragState.task.estMinutes || 40))
          });
          sound.snap();
          showToast(`已将「${dragState.task.title.slice(0, 10)}」排入 ${slot.dateIso.slice(5)} ${slot.label} ${fmtMin(slot.startMinute)}`);
          refreshStudentFlags();
          updateConflictBanner();
        }
      } else if (tap && ptr.hit) {
        panels.openItemPopover(ptr.hit, px, py);
      }
      dragState.active = false; dragState.task = null; dragState.hoverSlot = null;
      break;
    }
    case 'ribbon-item': {
      if (tap && ptr.hit) {
        const h = ptr.hit;
        if (h.kind === 'exam') panels.openExamScroll(h.item.id);
        else if (h.kind === 'lane-add') {
          const mapKind = { schedule: 'course', homework: 'task', personal: 'personal', exam: 'exam', campus: 'campus' };
          panels.openEditor(mapKind[h.layer] || 'task', { dateIso: TODAY_ISO, dueIso: TODAY_ISO });
        } else if (h.kind === 'day-layer') {
          openDay(doyOfIso(h.dateIso));
        } else {
          panels.openItemPopover(h, px, py);
        }
      }
      break;
    }
    case 'absence': {
      if (absenceRange) {
        panels.openAbsenceDigest(absenceRange.startIso, absenceRange.endIso);
        absenceMode = false;
        ui.absenceBtn.classList.remove('active');
      }
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
    case 'day-item': {
      if (tap && ptr.hit) {
        const h = ptr.hit;
        if (h.kind === 'exam') panels.openExamScroll(h.item.id);
        else if (h.kind === 'hour-free') panels.openEditor('personal', { dateIso: h.dateIso, startMinute: h.slot.startMinute, endMinute: h.slot.endMinute });
        else if (h.kind === 'hour-course') panels.openEditor('course', h.item);
        else if (h.kind === 'hour-personal') panels.openEditor('personal', h.item);
      }
      break;
    }
    case 'sky': if (tap) closeDay(); break;
  }
  ptr.id = null; ptr.mode = null; ptr.perp = false; ptr.hit = null;
  tick.wake();
}

glCanvas.addEventListener('pointerup', endPointer);
glCanvas.addEventListener('pointercancel', endPointer);
glCanvas.addEventListener('pointerleave', (e) => {
  if (e.pointerType !== 'mouse' || ptr.id !== null) return;
  if (level === 'disc') { disc.fishAmt.to(0); setHover(-1); }
  if (level === 'ribbon') { band.fishAmt.to(0); band.focusDay = -1; hoverLink = null; setTag(null); }
  tick.wake();
});

// Mouse wheel semantic zoom & pan on ribbon
glCanvas.addEventListener('wheel', (e) => {
  if (level !== 'ribbon' || band.phase !== 'laid' || panels.hasOpenModal()) return;
  e.preventDefault();
  if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
    panWindow(e.deltaX + e.deltaY > 0 ? 1 : -1);
    return;
  }
  const order = ['year', 'term', 'month', 'week'];
  const idx = order.indexOf(band.scaleMode);
  const next = clamp(idx + (e.deltaY < 0 ? 1 : -1), 0, order.length - 1);
  if (next !== idx) { sound.tick(true); setSemanticScale(order[next]); }
}, { passive: false });

function setHover(k, px, py) {
  if (k !== disc.hover) {
    disc.hover = k; disc.hoverAmt.set(0).to(1);
    if (k >= 0) { haptic(2); sound.tick((SCHOOL_YEAR + k) % 10 === 0 || SCHOOL_YEAR + k === TODAY_YEAR); }
  }
  showHud(k, px, py);
}

// ------------------------------------------------------------------ UI Controls Binding
ui.corner.addEventListener('click', () => goHome());
const soundBtn = $('#sound');
const paintSound = () => { soundBtn.textContent = sound.on ? '声 · 开' : '声 · 关'; soundBtn.setAttribute('aria-pressed', sound.on); };
paintSound();
soundBtn.addEventListener('click', () => { sound.toggle(); paintSound(); });
ui.close.addEventListener('click', () => closeDay());
ui.slip.addEventListener('click', (e) => { if (e.target.closest('a')) return; ui.slip.classList.toggle('open'); });

ui.scaleToggle.addEventListener('click', () => {
  disc.nonUniform = !disc.nonUniform;
  disc.scaleMix.to(disc.nonUniform ? 1 : 0);
  ui.scaleToggle.textContent = disc.nonUniform ? '疏密 · 今岁舒展' : '疏密 · 百年均分';
  sound.peel(disc.nonUniform);
  showToast(disc.nonUniform ? '今岁形成层舒展：近期更易精准选中' : '百年均分：按历年雨量自然排布');
  tick.wake();
});

ui.dataBtn.addEventListener('click', () => panels.openPrivacyModal());

// Quick paths beneath the trunk
document.querySelectorAll('#quick-paths [data-quick]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const q = btn.dataset.quick;
    if (q === 'today') fastJumpTo({ year: TODAY_YEAR, scale: 'week', layers: ['schedule', 'homework', 'personal'], focusIso: TODAY_ISO, openDayView: true });
    else if (q === 'week') fastJumpTo({ year: TODAY_YEAR, scale: 'week', layers: ['schedule', 'homework', 'personal', 'exam'], focusIso: TODAY_ISO });
    else if (q === 'term') fastJumpTo({ year: TODAY_YEAR, scale: 'term', layers: ['homework', 'exam', 'campus'], focusIso: TODAY_ISO });
    else if (q === 'year2026') { cancelIntro(); const k = TODAY_YEAR - SCHOOL_YEAR; pullStart(k, TAU * (TODAY_DOY / 365), disc.cx.x, disc.cy.x); goRibbon(); }
    else if (q === 'year2023') { cancelIntro(); const k = 2023 - SCHOOL_YEAR; pullStart(k, TAU * (305 / 365), disc.cx.x, disc.cy.x); goRibbon(); }
  });
});

// Mobile touch-bar fine stepping & confirm extract
$('#tb-prev')?.addEventListener('click', () => {
  const k = clamp((disc.touchSelectedK < 0 ? nR - 1 : disc.touchSelectedK) - 1, 0, nR - 1);
  disc.focus = discForward((lay.edges[k] + lay.edges[k + 1]) / 2);
  disc.fishAmt.to(1); setHover(k, disc.cx.x, disc.cy.x); updateTouchBar(k); tick.wake();
});
$('#tb-next')?.addEventListener('click', () => {
  const k = clamp((disc.touchSelectedK < 0 ? nR - 1 : disc.touchSelectedK) + 1, 0, nR - 1);
  disc.focus = discForward((lay.edges[k] + lay.edges[k + 1]) / 2);
  disc.fishAmt.to(1); setHover(k, disc.cx.x, disc.cy.x); updateTouchBar(k); tick.wake();
});
$('#tb-pull')?.addEventListener('click', () => {
  const k = disc.touchSelectedK >= 0 ? disc.touchSelectedK : nR - 1;
  pullStart(k, 0, disc.cx.x, disc.cy.x); goRibbon();
});

// Ribbon toolbar actions
document.querySelectorAll('#ribbon-bar [data-scale]').forEach((b) => {
  b.addEventListener('click', () => { sound.tick(true); setSemanticScale(b.dataset.scale); });
});
document.querySelectorAll('#ribbon-bar [data-layer]').forEach((b) => {
  b.addEventListener('click', () => toggleLayer(b.dataset.layer));
});
$('#rb-pan-prev')?.addEventListener('click', () => panWindow(-1));
$('#rb-pan-next')?.addEventListener('click', () => panWindow(1));
$('#rb-today-btn')?.addEventListener('click', () => {
  if (band.y !== TODAY_YEAR) fastJumpTo({ year: TODAY_YEAR, scale: 'week', focusIso: TODAY_ISO, openDayView: true });
  else openDay(TODAY_DOY);
});
ui.subjectFilter?.addEventListener('change', () => { subjectFilter = ui.subjectFilter.value; tick.wake(); });
ui.absenceBtn?.addEventListener('click', () => {
  absenceMode = !absenceMode;
  ui.absenceBtn.classList.toggle('active', absenceMode);
  if (absenceMode) {
    showToast('在时间带上拖选一段缺席日期，或直接点此确认默认 3 日区间');
    // Also provide quick default range if user clicks again or prefers editing
    absenceRange = { startIso: '2026-11-24', endIso: '2026-11-26' };
  } else if (absenceRange) {
    panels.openAbsenceDigest(absenceRange.startIso, absenceRange.endIso);
  }
  tick.wake();
});
$('#rb-add-btn')?.addEventListener('click', () => panels.openEditor('task', { dueIso: TODAY_ISO }));
$('#day-add-btn')?.addEventListener('click', () => panels.openEditor('task', { dueIso: isoOfYearDoy(band.y, day.sel) }));
ui.conflictFix?.addEventListener('click', () => {
  if (!latestConflictId) return;
  const res = store.resolveConflict(latestConflictId);
  if (res) {
    sound.snap();
    showToast(`冲突已化解：顺延至 ${res.slot.dateIso} ${res.slot.label} ${fmtMin(res.slot.startMinute)}`);
    refreshStudentFlags(); updateConflictBanner(); tick.wake();
  }
});
ui.horizonToggle?.addEventListener('click', () => {
  day.horizonMode = day.horizonMode === 'hour' ? 'year' : 'hour';
  paintHorizonToggle();
  sound.bamboo();
  tick.wake();
});

// Keyboard support across all depths
let kbRing = 103;
addEventListener('keydown', (e) => {
  if (!climate) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
    if (e.key === 'Escape') panels.closeTopModal();
    return;
  }
  cancelIntro();
  if (e.key === 'Escape') {
    if (panels.closeTopModal()) return;
    if (level === 'day') closeDay();
    else if (level === 'ribbon') goHome();
    return;
  }
  if (panels.hasOpenModal()) return;
  if (level === 'disc' && (!band.phase || band.phase === 'home')) {
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
      const lo = Math.floor(band.winA.target), hi = Math.min(band.len - 1, Math.ceil(band.winB.target) - 1);
      band.focusDay = clamp((band.focusDay < lo ? lo : band.focusDay + step), lo, hi);
      band.focus = dayCentre(band.focusDay); band.fishAmt.to(1); setTag(band.focusDay); e.preventDefault();
    } else if (e.key === 'Enter' && band.focusDay >= 0) openDay(band.focusDay);
    else if (e.key === '+' || e.key === '=') {
      const order = ['year', 'term', 'month', 'week'];
      setSemanticScale(order[Math.min(3, order.indexOf(band.scaleMode) + 1)]);
    } else if (e.key === '-') {
      const order = ['year', 'term', 'month', 'week'];
      setSemanticScale(order[Math.max(0, order.indexOf(band.scaleMode) - 1)]);
    }
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

// ------------------------------------------------------------------ Physics & Frame Loop
function stepBand(dt) {
  if (!band.phase) return;
  const P = band.phase;
  for (const s of [band.cx, band.cy, band.Rr, band.rho, band.s, band.fishAmt, band.railX, band.railY, band.halfBase, band.winA, band.winB]) s.step(dt);
  let damp = 1, kAll = 1400;

  if (P === 'pull') {
    const p = band.pull;
    let dx = p.x - p.x0, dy = p.y - p.y0;
    const dist = Math.hypot(dx, dy);
    const thr = portrait || coarse ? 70 : 90;
    if (band.tethered) {
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
      loopTargets(band.cx.x, band.cy.x, band.Rr.x, band.rho.x, half);
      const close = Math.hypot(band.cx.x - disc.cx.x, band.cy.x - disc.cy.x) + Math.abs(band.Rr.x - mid);
      if (close < 3) {
        disc.gap.to(0);
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

  const X = band.X, N = band.normals, n = band.n;
  for (let j = 0; j < n; j++) {
    const a = Math.max(0, j - 1), b = Math.min(n - 1, j + 1);
    const tx = X[b * 2] - X[a * 2], ty = X[b * 2 + 1] - X[a * 2 + 1];
    const l = Math.hypot(tx, ty) || 1;
    N[j * 2] = ty / l; N[j * 2 + 1] = -tx / l;
  }
}

function cellRect(d) {
  const X = band.X, span = Math.max(1, band.winB.x - band.winA.x);
  const j = clamp(Math.round(((d - band.winA.x) / span) * band.len), 0, band.n - 2);
  const x0 = Math.min(X[j * 2], X[(j + 1) * 2]), x1 = Math.max(X[j * 2], X[(j + 1) * 2]);
  const y0 = Math.min(X[j * 2 + 1], X[(j + 1) * 2 + 1]), y1 = Math.max(X[j * 2 + 1], X[(j + 1) * 2 + 1]);
  const h = band.half[j];
  return portrait ? { x: x0 - h, y: y0, w: x1 - x0 + 2 * h, h: Math.max(4, y1 - y0) } : { x: x0, y: y0 - h, w: Math.max(4, x1 - x0), h: y1 - y0 + 2 * h };
}

const paperTint = { r: Sky.PAPER[0], g: Sky.PAPER[1], b: Sky.PAPER[2] };
let lastT = performance.now();

function frame(now) {
  const dt = Math.min(1 / 30, (now - lastT) / 1000);
  lastT = now;
  day.time += dt;
  for (const s of [disc.cx, disc.cy, disc.R, disc.dim, disc.fishAmt, disc.scaleMix, disc.hoverAmt, disc.gap, disc.alpha, day.reveal, day.minutes]) s.step(dt);
  for (const m of LAYER_META) peelSprings[m.id].step(dt);
  if (level === 'day' || day.reveal.x > 0.01) { band.focus = lerp(band.focus, ((Math.max(0, day.sel) + 0.5) / band.len) * L.rail.len, 0.25); band.fishAmt.to(1); }
  updateLUT();
  stepBand(dt);

  // 1. Sky / Paper
  let tint = Sky.PAPER;
  const fd = level === 'day' ? day.sel : band.focusDay;
  if (band.phase && fd >= 0 && band.start >= 0 && band.start + fd < climate.days) tint = Sky.dayTint(climate.row(band.start + fd));
  paperTint.r = lerp(paperTint.r, tint[0], 0.08); paperTint.g = lerp(paperTint.g, tint[1], 0.08); paperTint.b = lerp(paperTint.b, tint[2], 0.08);
  let dayStateObj = null;
  if (day.sel >= 0 && day.reveal.x > 0.002 && band.phase) {
    const date = dateOf(band.y, day.sel);
    const i = band.start >= 0 ? band.start + day.sel : -1;
    dayStateObj = {
      date, row: i >= 0 && i < climate.days ? climate.row(i) : null,
      minutes: day.minutes.x, horizon: portrait ? H * 0.57 : H - 86,
      showHourBeam: day.horizonMode === 'hour'
    };
    day.from = cellRect(day.sel);
  }
  Sky.paint(skyCtx, { w: W, h: H, dpr, tint: [paperTint.r, paperTint.g, paperTint.b], reveal: day.reveal.x, from: day.from, day: dayStateObj, time: day.time });

  // 2. WebGL 2 Wood (Trunk + Primary Wooden Ribbon)
  R.clear();
  const todayRow = TODAY_YEAR - SCHOOL_YEAR;
  R.drawDisc({
    cx: disc.cx.x, cy: disc.cy.x, R: disc.R.x, lutMax,
    hover: level === 'disc' ? disc.hover : -1, hoverAmt: disc.hoverAmt.x,
    dim: disc.dim.x, alpha: disc.alpha.x,
    todayRow, todayDay: TODAY_DOY, pulse: day.time
  });
  const hideWoodInHourDay = level === 'day' && day.horizonMode === 'hour';
  if (band.phase && !hideWoodInHourDay) {
    R.drawRibbon({
      nodes: band.X, normals: band.normals, half: band.half, us: band.us, n: band.n,
      row: band.k, len: band.len, lift: band.lift,
      focusDay: level === 'ribbon' ? band.focusDay : -1,
      selDay: level === 'day' ? day.sel : -1,
      todayDay: band.y === TODAY_YEAR ? TODAY_DOY : -1
    });
  }

  // 3. Multi-Material Peeled Ribbons + Cross-Layer Threads + Day Hour Horizon
  paintRibbons(layersCtx, {
    W, H, dpr, portrait, level, phase: band.phase,
    year: band.y, yearLen: band.len,
    railX: band.railX.x, railY: band.railY.x, railLen: L.rail.len, halfBase: band.halfBase.x,
    winA: band.winA.x, winB: band.winB.x,
    activeLayers, peelSprings, state: store.getState(), scaleMode: band.scaleMode,
    xOfDay, focusDay: band.focusDay, hoverLink, dragState, absenceRange, time: day.time,
    subjectFilter, daySel: day.sel, dayHorizonMode: day.horizonMode, dayMinutes: day.minutes.x
  });

  placeLabels();
  return busy();
}

function busy() {
  if (ptr.id !== null || dragState.active) return true;
  if (level === 'day' && dayAnimated()) return true;
  if (level === 'ribbon' && activeLayers.includes('personal') && detectAllConflicts(store.getState()).length > 0 && !reduced) return true;
  const springs = [
    disc.cx, disc.cy, disc.R, disc.dim, disc.fishAmt, disc.scaleMix, disc.hoverAmt, disc.gap,
    day.reveal, day.minutes, band.s, band.fishAmt, band.railX, band.railY, band.halfBase,
    band.cx, band.cy, band.Rr, band.rho, band.winA, band.winB,
    ...LAYER_META.map((m) => peelSprings[m.id])
  ];
  if (springs.some((s) => !s.settled)) return true;
  if (band.phase && band.phase !== 'laid') return true;
  if (band.phase) { for (let i = 0; i < band.V.length; i++) if (Math.abs(band.V[i]) > 0.05) return true; }
  return false;
}

function dayAnimated() {
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

// ------------------------------------------------------------------ Labels Riding on Wood
const monthEls = [];
function placeLabels() {
  const showBand = band.phase === 'laid' || band.phase === 'roll';
  const showMonths = showBand && level !== 'disc' && !(level === 'day' && day.horizonMode === 'hour') && band.scaleMode !== 'week';
  ui.months.classList.toggle('on', showMonths);
  if (band.phase && band.n) {
    const wA = band.winA.x, wB = band.winB.x;
    for (let m = 0; m < 12; m++) {
      const el = monthEls[m];
      const a = dayOfYear(band.y, m + 1, 1), b = m === 11 ? band.len : dayOfYear(band.y, m + 2, 1);
      const midD = (a + b) / 2;
      const inWin = midD >= wA && midD <= wB && (midD / band.len) * L.rail.len <= band.s.x;
      const p0 = xOfDay(Math.max(wA, a)), p1 = xOfDay(Math.min(wB, b)), pm = xOfDay(midD);
      const span = Math.abs(p1 - p0);
      const room = smooth(portrait ? 16 : 30, portrait ? 28 : 48, span);
      el.style.opacity = inWin && showMonths && !(portrait && (level === 'day' || activeLayers.length > 0)) ? (level === 'day' ? 0.75 : 1) * room : 0;
      if (portrait) el.style.transform = `translate(${band.railX.x + band.halfBase.x + 6}px, ${band.railY.x + pm - 6}px)`;
      else el.style.transform = `translate(${band.railX.x + pm - 16}px, ${band.railY.x + band.halfBase.x + 7}px)`;
    }

    const sx = band.X[0], sy = band.X[1];
    const showSlip = showBand && level === 'ribbon' && !(portrait && activeLayers.length > 0);
    ui.slip.classList.toggle('on', showSlip);
    if (portrait) ui.slip.style.transform = `translate(${sx - band.halfBase.x - 14}px, ${sy - 4}px) translate(-100%, 0)`;
    else ui.slip.style.transform = `translate(${sx - 20}px, ${sy - band.halfBase.x - 14}px) translate(-100%, 0)`;

    if (level === 'ribbon' && band.focusDay >= 0) {
      const pos = xOfDay(band.focusDay + 0.5);
      const x = portrait ? band.railX.x : band.railX.x + pos;
      const y = portrait ? band.railY.x + pos : band.railY.x;
      const h = band.halfBase.x;
      if (portrait) {
        const rightSide = activeLayers.length > 0;
        ui.tag.style.transform = rightSide
          ? `translate(${clamp(x + h + 14, 14, W - 200)}px, ${clamp(y, 120, H - 140)}px) translate(0, -50%)`
          : `translate(${clamp(x - h - 14, 0, W)}px, ${clamp(y, 120, H - 140)}px) translate(-100%, -50%)`;
      } else {
        ui.tag.style.transform = `translate(${clamp(x, 175, W - 175)}px, ${Math.max(108, y - h - 14)}px) translate(-50%, -100%)`;
      }
    }

    if (level === 'day') {
      const hz = portrait ? H * 0.57 : H - 86;
      const p = Sky.sunPoint(W, hz, dateOf(band.y, day.sel), day.minutes.x);
      ui.clock.textContent = fmtClock(day.minutes.x);
      ui.clock.style.transform = `translate(${p.x}px, ${Math.max(42, p.y - 32)}px) translate(-50%, 0)`;
    }
  } else {
    ui.slip.classList.remove('on');
  }

  const showKnots = band.phase === 'laid' && level === 'ribbon' && activeLayers.length === 0;
  ui.knots.classList.toggle('on', showKnots);
  if (band.phase && knotEls.length && showKnots) {
    for (const { el, d } of knotEls) {
      const inWin = d >= band.winA.x && d <= band.winB.x;
      const pos = xOfDay(d + 0.5);
      const hide = !inWin || (band.focusDay >= 0 && Math.abs(band.focusDay - d) < (portrait ? 26 : 36));
      el.style.opacity = hide ? 0 : '';
      if (portrait) el.style.transform = `translate(${band.railX.x - band.halfBase.x - 10}px, ${band.railY.x + pos}px) translate(-100%, -50%)`;
      else el.style.transform = `translate(${band.railX.x + pos}px, ${band.railY.x - band.halfBase.x - 10}px) translate(-50%, -100%)`;
    }
  }

  const cr = Math.round(disc.R.x * 1.2);
  ui.corner.style.transform = `translate(${Math.round(disc.cx.x - cr)}px, ${Math.round(disc.cy.x - cr)}px)`;
  ui.corner.style.width = ui.corner.style.height = (cr * 2) + 'px';
}

// ------------------------------------------------------------------ First-Visit Subtle Demo Pull
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
  const th = TAU * (305 / 365);
  const r = discForward((lay.edges[k] + lay.edges[k + 1]) / 2) * disc.R.x;
  const x0 = disc.cx.x + Math.sin(th) * r, y0 = disc.cy.x - Math.cos(th) * r;
  intro = { t: 0, raf: 0 };
  intro.t = setTimeout(() => {
    if (!intro || level !== 'disc') return;
    ui.hint.classList.add('demo');
    ptr.mode = 'intro';
    pullStart(k, th, x0, y0);
    const t0 = performance.now();
    const go = (now) => {
      if (!intro) return;
      const t = (now - t0) / 1000;
      const pull = t < 0.85 ? smooth(0, 0.85, t) : t < 1.35 ? 1 : 0;
      band.pull.x = x0 + Math.sin(th) * 78 * pull;
      band.pull.y = y0 - Math.cos(th) * 78 * pull;
      tick.wake();
      if (t < 1.35) intro.raf = requestAnimationFrame(go);
      else { band.phase = 'home'; ptr.mode = null; intro = null; setTimeout(() => ui.hint.classList.remove('demo'), 1000); }
    };
    intro.raf = requestAnimationFrame(go);
  }, 2400);
}

// ------------------------------------------------------------------ Boot
async function start() {
  computeLayout();
  if (!R) { document.body.classList.add('no-gl'); return; }
  for (let m = 0; m < 12; m++) {
    const s = document.createElement('span');
    s.textContent = portrait ? `${m + 1}月` : MONTHS[m];
    ui.months.appendChild(s); monthEls.push(s);
  }
  climate = await loadClimate(new URL('./lib/rings/data/', import.meta.url));
  lay = layout(climate);
  nR = lay.rings.length; E0 = lay.edges[0]; E1 = lay.edges[nR];
  buildTextures();
  discTargets(true); railTargets(true);
  computeGapEdges();
  disc.R.set(L.disc.R * 0.92); disc.R.to(L.disc.R);
  document.body.classList.add('ready');
  ui.day.querySelector('.howto').textContent = portrait
    ? '左右拖动天空拨动太阳与时辰；点击地平线作息带快速记录。'
    : '左右拖动天空看太阳掠过今日作息；点击下方时辰带或切换标签直接编辑课表、作业与日程。';
  ui.rhint.textContent = coarse || portrait
    ? '点击上方叠层剥离课表/作业/日程/考试，或点某一天展开天空。'
    : '点击上方叠层同时展开多条时间带；把作业纸签直接拖入靛布日程的空闲时段；点朱砂方印抽出考试学情卷。';
  ui.hint.textContent = coarse
    ? '外圈今岁更宽可直接轻点，或在年轮上滑选并锁定抽出'
    : '外圈今岁舒展、内圈百年沉淀 —— 按住任意一圈往外拉，或点下方快径直达今日与本周';
  if (portrait) {
    $('#q-today').textContent = '今日';
    $('#q-week').textContent = '本周';
    $('#q-term').textContent = '本学期';
    $('#q-2026').textContent = '2026';
    $('#q-2023').textContent = '2023百年';
  }
  tick.wake();
  runIntro();
}

// Inspection & testing handle (clean, deterministic)
window.__nl = {
  ringPoint(y, th = 0.8) {
    const k = y - SCHOOL_YEAR;
    computeGapEdges();
    const r = ((gapEdges[k] + gapEdges[k + 1]) / 2) * wobble(th) * disc.R.x;
    return { x: disc.cx.x + Math.sin(th) * r, y: disc.cy.x - Math.cos(th) * r };
  },
  ringPixelWidth(y) {
    const k = y - SCHOOL_YEAR;
    computeGapEdges();
    return (gapEdges[k + 1] - gapEdges[k]) * disc.R.x;
  },
  L: () => L,
  band, disc, day, ptr, store, panels,
  fastJumpTo, toggleLayer, setSemanticScale, openDay, closeDay, goHome,
  get activeLayers() { return [...activeLayers]; },
  get level() { return level; },
  get gapEdges() { return gapEdges; }
};

addEventListener('resize', () => {
  computeLayout();
  if (!climate) return;
  discTargets(true); railTargets(true);
  if (band.phase === 'laid') band.s.set(L.rail.len);
  tick.wake();
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick.wake(); });
start().catch((err) => { console.error(err); document.body.classList.add('failed'); });
