/**
 * NIANLUN · Chronoscope / 时间仪 — Main Controller & Polar Renderer
 */

import {
  OBSERVERS,
  WEEKDAYS_ZH,
  MONTHS_ZH,
  SOLAR_TERMS,
  daysInMonth,
  daysInYear,
  makeUtcFromObserverLocal,
  getObserverLocalParts,
  addDaysUtc,
  addMinutesUtc,
  addMonthsObserver,
  addYearsObserver,
  getSunTimesAndPosition,
  getLunarPhase,
  getSolarTermInfo,
  getSeasonInfo,
  formatMinutesAsHm,
} from './astro.js';

import {
  SCALES,
  normAngle,
  angleDiff,
  polarToXY,
  xyToPolar,
  describeArc,
  describeSector,
  computeScaleLayout,
  getScaleProgressAngle,
} from './polar.js';

import {
  EVENT_CATEGORIES,
  RECURRENCE_OPTIONS,
  loadAllEvents,
  saveEventState,
  getHiddenIds,
  getEventsForDate,
  getCategoryMeta,
} from './events.js';

import { createArcRangeSelector, bindHoldRing } from './components.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

// ─── Application State ───
const state = {
  nowMs: Date.now(),
  cursorMs: Date.now(),
  sigma: 1.0,        // current continuous scale [0..5]
  targetSigma: 1.0,  // target scale for smooth animation
  observerId: 'haikou',
  compareMs: null,
  selectedEventId: null,
  editingEvent: null, // null or { mode: 'create'|'edit', data: {...} }
  searchQuery: '',
  historyTrail: [],
  events: loadAllEvents(),
  hiddenIds: getHiddenIds(),
  theme: localStorage.getItem('nianlun-theme') || 'dark',
  hand: localStorage.getItem('nianlun-hand') || 'right',
};

// Apply initial theme & hand
document.documentElement.dataset.theme = state.theme;
document.documentElement.dataset.hand = state.hand;

// DOM refs
const svg = document.getElementById('chronoscope-svg');
const deckEl = document.getElementById('deck');
const scaleSlider = document.getElementById('scale-slider');
const scaleStopsEl = document.getElementById('scale-stops');
const observerSelect = document.getElementById('observer-select');
const themeBtn = document.getElementById('btn-theme');
const handBtn = document.getElementById('btn-hand');
const compareBtn = document.getElementById('btn-compare');
const backBtn = document.getElementById('btn-back');
const nowBtn = document.getElementById('btn-now');
const quadToggleBtn = document.getElementById('mobile-quad-toggle');
const toastEl = document.getElementById('toast');

let toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

function getObserver() {
  return OBSERVERS.find((o) => o.id === state.observerId) || OBSERVERS[0];
}

function getSightAngle() {
  const isMobile = window.innerWidth <= 860;
  if (!isMobile) return 0;
  return state.hand === 'left' ? 45 : 315;
}

function pushTrail(label) {
  const top = state.historyTrail[state.historyTrail.length - 1];
  if (top && Math.abs(top.cursorMs - state.cursorMs) < 60_000 && Math.abs(top.sigma - state.targetSigma) < 0.1) {
    return;
  }
  state.historyTrail.push({
    cursorMs: state.cursorMs,
    sigma: state.targetSigma,
    label,
  });
  if (state.historyTrail.length > 24) state.historyTrail.shift();
  updateTrailButtons();
}

function updateTrailButtons() {
  if (backBtn) {
    backBtn.disabled = state.historyTrail.length === 0;
    backBtn.style.opacity = state.historyTrail.length === 0 ? '0.45' : '1';
  }
}

function setScale(newSigma, recordTrail = false) {
  const clamped = Math.max(0, Math.min(5, newSigma));
  if (recordTrail) pushTrail('切换尺度');
  state.targetSigma = clamped;
  if (scaleSlider) scaleSlider.value = String(clamped);
  updateScaleStopsUI();
  startAnimLoop();
}

function updateScaleStopsUI() {
  const nearest = Math.round(state.targetSigma);
  for (const btn of scaleStopsEl.querySelectorAll('.scale-stop')) {
    btn.classList.toggle('active', Number(btn.dataset.scale) === nearest);
  }
}

function jumpToTime(newMs, newSigma = null, label = '跳转') {
  pushTrail(label);
  state.cursorMs = newMs;
  if (newSigma !== null) {
    state.targetSigma = Math.max(0, Math.min(5, newSigma));
    if (scaleSlider) scaleSlider.value = String(state.targetSigma);
    updateScaleStopsUI();
  }
  startAnimLoop();
  renderAll();
}

// ─── Smooth Animation Loop (Scale Zoom + Angular Inertia) ───
let animRaf = null;
let angularVelocity = 0; // deg per frame

function startAnimLoop() {
  if (animRaf) return;
  const tick = () => {
    let needsMore = false;

    // 1. Scale lens interpolation
    const ds = state.targetSigma - state.sigma;
    if (Math.abs(ds) > 0.004) {
      state.sigma += ds * 0.22;
      needsMore = true;
    } else if (state.sigma !== state.targetSigma) {
      state.sigma = state.targetSigma;
    }

    // 2. Angular inertia
    if (Math.abs(angularVelocity) > 0.05) {
      applyAngleDeltaToCursor(angularVelocity);
      angularVelocity *= 0.91;
      needsMore = true;
    } else {
      angularVelocity = 0;
    }

    renderChronoscope();
    if (needsMore) {
      renderDeckHeaderOnly();
      animRaf = requestAnimationFrame(tick);
    } else {
      animRaf = null;
      renderDeck();
    }
  };
  animRaf = requestAnimationFrame(tick);
}

function applyAngleDeltaToCursor(dAngleDeg) {
  // Dragging clockwise (+dAngle) moves the dial clockwise, which brings earlier angles under the fixed sightline
  // So time advances by -dAngle
  const deltaAngle = -dAngleDeg;
  const focusIdx = Math.round(state.targetSigma);
  const obs = getObserver();
  const parts = getObserverLocalParts(state.cursorMs, obs.tz);

  if (focusIdx === 0) {
    // Hour: 360° = 60 min
    state.cursorMs = addMinutesUtc(state.cursorMs, (deltaAngle / 360) * 60);
  } else if (focusIdx === 1) {
    // Day: 360° = 1440 min
    state.cursorMs = addMinutesUtc(state.cursorMs, (deltaAngle / 360) * 1440);
  } else if (focusIdx === 2) {
    // Week: 360° = 7 days
    state.cursorMs = addDaysUtc(state.cursorMs, (deltaAngle / 360) * 7);
  } else if (focusIdx === 3) {
    // Month: 360° = daysInThisMonth
    state.cursorMs = addDaysUtc(state.cursorMs, (deltaAngle / 360) * parts.daysInThisMonth);
  } else if (focusIdx === 4) {
    // Year: 360° = daysInThisYear
    state.cursorMs = addDaysUtc(state.cursorMs, (deltaAngle / 360) * parts.daysInThisYear);
  } else {
    // Era: 360° = 1 year
    state.cursorMs = addDaysUtc(state.cursorMs, (deltaAngle / 360) * 365.25);
  }
}

// ─── SVG Polar Renderer ───
function renderChronoscope() {
  const obs = getObserver();
  const parts = getObserverLocalParts(state.cursorMs, obs.tz);
  const nowParts = getObserverLocalParts(state.nowMs, obs.tz);
  const sun = getSunTimesAndPosition(state.cursorMs, obs.lat, obs.lon, obs.tz);
  const moon = getLunarPhase(state.cursorMs);
  const season = getSeasonInfo(state.cursorMs);
  const solarTerm = getSolarTermInfo(state.cursorMs);
  const sightAngle = getSightAngle();

  const layout = computeScaleLayout(state.sigma);
  const dayEvents = getEventsForDate(state.events, parts.year, parts.month, parts.day, obs.tz);

  svg.innerHTML = '';

  // Outer subtle instrument frame
  svg.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 410, class: 'ring-track', 'stroke-opacity': 0.35 }));

  // Render rings from outermost/child to innermost or sorted by radius
  const sorted = [...layout].sort((a, b) => b.rOuter - a.rOuter);

  for (const ring of sorted) {
    if (ring.opacity <= 0.02) continue;

    const g = svgEl('g', {
      opacity: ring.opacity.toFixed(3),
      'data-scale': ring.id,
    });

    const isFocus = Math.abs(ring.d) < 0.55;
    const progAngle = getScaleProgressAngle(ring.id, parts);
    const rotDeg = sightAngle - progAngle;

    // Ring track boundaries
    g.appendChild(svgEl('circle', {
      cx: 0, cy: 0, r: ring.rOuter.toFixed(1),
      class: isFocus ? 'ring-band-focus' : 'ring-track',
    }));
    g.appendChild(svgEl('circle', {
      cx: 0, cy: 0, r: ring.rInner.toFixed(1),
      class: 'ring-track',
    }));

    // Rotating coordinate group for this ring
    const rotG = svgEl('g', { transform: `rotate(${rotDeg.toFixed(2)})` });

    if (ring.id === 'hour') {
      renderHourRing(rotG, ring, isFocus, parts, dayEvents);
    } else if (ring.id === 'day') {
      renderDayRing(rotG, ring, isFocus, parts, nowParts, sun, moon, dayEvents);
    } else if (ring.id === 'week') {
      renderWeekRing(rotG, ring, isFocus, parts, obs.tz);
    } else if (ring.id === 'month') {
      renderMonthRing(rotG, ring, isFocus, parts, obs.tz);
    } else if (ring.id === 'year') {
      renderYearRing(rotG, ring, isFocus, parts, obs.tz);
    } else if (ring.id === 'era') {
      renderEraRing(rotG, ring, isFocus, parts, obs.tz);
    }

    g.appendChild(rotG);
    svg.appendChild(g);
  }

  // Dual-Sightline Ghost Ray (if comparing)
  if (state.compareMs !== null) {
    const focusRing = layout.find((r) => Math.round(state.sigma) === r.index) || layout[1];
    const compParts = getObserverLocalParts(state.compareMs, obs.tz);
    const curA = getScaleProgressAngle(focusRing.id, parts);
    const compA = getScaleProgressAngle(focusRing.id, compParts);
    const ghostScreenAngle = normAngle(sightAngle + (compA - curA));
    const pIn = polarToXY(56, ghostScreenAngle);
    const pOut = polarToXY(416, ghostScreenAngle);
    svg.appendChild(svgEl('line', {
      x1: pIn.x.toFixed(1), y1: pIn.y.toFixed(1),
      x2: pOut.x.toFixed(1), y2: pOut.y.toFixed(1),
      class: 'ghost-ray',
    }));
  }

  // Fixed Sightline Ray (准线)
  const sIn = polarToXY(54, sightAngle);
  const sOut = polarToXY(422, sightAngle);
  svg.appendChild(svgEl('line', {
    x1: sIn.x.toFixed(1), y1: sIn.y.toFixed(1),
    x2: sOut.x.toFixed(1), y2: sOut.y.toFixed(1),
    class: 'sightline-ray',
  }));
  const tip = polarToXY(424, sightAngle);
  svg.appendChild(svgEl('circle', {
    cx: tip.x.toFixed(1), cy: tip.y.toFixed(1), r: 4,
    class: 'sightline-head',
  }));

  // Origin Core (圆心 · 来处)
  const coreG = svgEl('g', { class: 'core-group' });
  coreG.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 52, fill: 'var(--bg)', stroke: 'var(--dim)', 'stroke-width': 1 }));
  const focusMeta = SCALES[Math.round(state.sigma)] || SCALES[1];
  const tScale = svgEl('text', { x: 0, y: -16, 'text-anchor': 'middle', class: 'core-scale-tag' });
  tScale.textContent = `${focusMeta.label} · ${focusMeta.en.toUpperCase()}`;
  const tMain = svgEl('text', { x: 0, y: 7, 'text-anchor': 'middle', class: 'core-title' });
  tMain.textContent = focusMeta.index <= 1 ? parts.hm : focusMeta.index === 2 ? WEEKDAYS_ZH[parts.weekday] : focusMeta.index === 3 ? `${parts.month}/${parts.day}` : `${parts.year}`;
  const tSub = svgEl('text', { x: 0, y: 26, 'text-anchor': 'middle', class: 'core-sub' });
  tSub.textContent = `${solarTerm.current.name} · ${season.name.split(' ')[0]}`;
  coreG.appendChild(tScale);
  coreG.appendChild(tMain);
  coreG.appendChild(tSub);
  svg.appendChild(coreG);
}

function renderHourRing(g, ring, isFocus, parts, dayEvents) {
  const { rInner, rOuter } = ring;
  const count = isFocus ? 60 : 12;
  for (let i = 0; i < count; i++) {
    const m = isFocus ? i : i * 5;
    const a = (m / 60) * 360;
    const isMajor = m % 5 === 0;
    const p1 = polarToXY(rOuter - (isMajor ? 10 : 5), a);
    const p2 = polarToXY(rOuter, a);
    g.appendChild(svgEl('line', {
      x1: p1.x.toFixed(1), y1: p1.y.toFixed(1),
      x2: p2.x.toFixed(1), y2: p2.y.toFixed(1),
      class: isMajor ? 'tick-major' : 'tick-minor',
    }));
    if (isFocus && m % 10 === 0) {
      const lp = polarToXY(rInner + 16, a);
      const t = svgEl('text', { x: lp.x.toFixed(1), y: (lp.y + 4).toFixed(1), 'text-anchor': 'middle', class: 'dial-label' });
      t.textContent = String(m).padStart(2, '0');
      g.appendChild(t);
    }
  }

  if (isFocus) {
    // Show events overlapping the current hour
    const hourStart = parts.hour * 60;
    const hourEnd = hourStart + 60;
    for (const ev of dayEvents) {
      const s = Math.max(hourStart, ev.startMin);
      const e = Math.min(hourEnd, ev.endMin);
      if (e > s) {
        const a1 = ((s - hourStart) / 60) * 360;
        const a2 = ((e - hourStart) / 60) * 360;
        const cat = getCategoryMeta(ev.category);
        const arc = svgEl('path', {
          d: describeArc((rInner + rOuter) / 2, a1, a2),
          fill: 'none',
          stroke: cat.color,
          'stroke-width': 12,
          'stroke-opacity': 0.78,
          class: 'event-arc',
        });
        arc.addEventListener('click', (evt) => { evt.stopPropagation(); selectEvent(ev.id); });
        g.appendChild(arc);
      }
    }
  }
}

function renderDayRing(g, ring, isFocus, parts, nowParts, sun, moon, dayEvents) {
  const { rInner, rOuter } = ring;
  const minToAng = (m) => normAngle((m / 1440) * 360 + 180);

  // Day & Night optical sectors
  if (!sun.polarDay && !sun.polarNight && sun.sunriseMin !== null && sun.sunsetMin !== null) {
    const aRise = minToAng(sun.sunriseMin);
    const aSet = minToAng(sun.sunsetMin);
    g.appendChild(svgEl('path', { d: describeSector(rInner, rOuter, aRise, aSet), class: 'sun-arc-day' }));
    g.appendChild(svgEl('path', { d: describeSector(rInner, rOuter, aSet, aRise), class: 'sun-arc-night' }));
  } else if (sun.polarDay) {
    g.appendChild(svgEl('circle', { cx: 0, cy: 0, r: (rInner + rOuter) / 2, fill: 'none', stroke: 'var(--sun)', 'stroke-width': rOuter - rInner, 'stroke-opacity': 0.1 }));
  } else {
    g.appendChild(svgEl('circle', { cx: 0, cy: 0, r: (rInner + rOuter) / 2, fill: 'none', stroke: 'var(--night)', 'stroke-width': rOuter - rInner, 'stroke-opacity': 0.14 }));
  }

  // 24h ticks
  for (let h = 0; h < 24; h++) {
    const a = minToAng(h * 60);
    const major = h % 6 === 0;
    const mid = h % 3 === 0;
    const len = major ? 14 : mid ? 9 : 5;
    const p1 = polarToXY(rOuter - len, a);
    const p2 = polarToXY(rOuter, a);
    g.appendChild(svgEl('line', {
      x1: p1.x.toFixed(1), y1: p1.y.toFixed(1),
      x2: p2.x.toFixed(1), y2: p2.y.toFixed(1),
      class: major ? 'tick-major' : 'tick-minor',
    }));

    if (isFocus && (h % 3 === 0)) {
      const lp = polarToXY(rOuter - 26, a);
      const t = svgEl('text', {
        x: lp.x.toFixed(1), y: (lp.y + 4).toFixed(1),
        'text-anchor': 'middle',
        class: major ? 'dial-label dial-label-active' : 'dial-label',
      });
      t.textContent = `${String(h).padStart(2, '0')}`;
      g.appendChild(t);
    }
  }

  // Sun & Moon positions on the outer rim when in focus
  if (isFocus) {
    if (sun.sunriseMin !== null) {
      const aR = minToAng(sun.sunriseMin);
      const pR = polarToXY(rOuter + 10, aR);
      g.appendChild(svgEl('circle', { cx: pR.x.toFixed(1), cy: pR.y.toFixed(1), r: 3.5, fill: 'var(--sun)' }));
    }
    if (sun.sunsetMin !== null) {
      const aS = minToAng(sun.sunsetMin);
      const pS = polarToXY(rOuter + 10, aS);
      g.appendChild(svgEl('circle', { cx: pS.x.toFixed(1), cy: pS.y.toFixed(1), r: 3.5, fill: 'var(--night)', stroke: 'var(--sun)', 'stroke-width': 1 }));
    }
    const aMoon = minToAng(moon.transitMin);
    const pM = polarToXY(rInner + 14, aMoon);
    g.appendChild(svgEl('circle', { cx: pM.x.toFixed(1), cy: pM.y.toFixed(1), r: 4, fill: 'none', stroke: 'var(--memory)', 'stroke-width': 1.5 }));
  }

  // Events as layered polar arcs
  const rBandBase = isFocus ? rInner + 34 : (rInner + rOuter) / 2;
  const bandStep = isFocus ? 16 : 5;
  dayEvents.forEach((ev, idx) => {
    const a1 = minToAng(ev.startMin);
    const a2 = minToAng(ev.endMin);
    const rEv = Math.min(rOuter - 38, rBandBase + (idx % 3) * bandStep);
    const cat = getCategoryMeta(ev.category);
    const isSel = state.selectedEventId === ev.id;
    const path = svgEl('path', {
      d: describeArc(isFocus ? rEv : (rInner + rOuter) / 2, a1, a2),
      fill: 'none',
      stroke: cat.color,
      'stroke-width': isFocus ? (isSel ? 12 : 9) : 5,
      'stroke-linecap': 'butt',
      'stroke-opacity': isSel ? 1 : 0.82,
      class: 'event-arc',
    });
    path.addEventListener('click', (evt) => {
      evt.stopPropagation();
      selectEvent(ev.id);
    });
    g.appendChild(path);
  });

  // Real wall-clock "Now" marker if viewing today
  if (parts.isoDate === nowParts.isoDate) {
    const aNow = minToAng(nowParts.minuteOfDay);
    const p1 = polarToXY(rInner, aNow);
    const p2 = polarToXY(rOuter + 4, aNow);
    g.appendChild(svgEl('line', { x1: p1.x.toFixed(1), y1: p1.y.toFixed(1), x2: p2.x.toFixed(1), y2: p2.y.toFixed(1), class: 'now-marker' }));
  }
}

function renderWeekRing(g, ring, isFocus, parts, tzHours) {
  const { rInner, rOuter } = ring;
  const monIdx = (parts.weekday + 6) % 7; // 0=Mon..6=Sun
  const mondayUtc = addDaysUtc(state.cursorMs, -monIdx);
  const weekLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  for (let d = 0; d < 7; d++) {
    const aStart = (d / 7) * 360;
    const aEnd = ((d + 1) / 7) * 360;
    const aMid = (aStart + aEnd) / 2;

    const p1 = polarToXY(rInner, aStart);
    const p2 = polarToXY(rOuter, aStart);
    g.appendChild(svgEl('line', { x1: p1.x.toFixed(1), y1: p1.y.toFixed(1), x2: p2.x.toFixed(1), y2: p2.y.toFixed(1), class: 'tick-major' }));

    const dayUtc = addDaysUtc(mondayUtc, d);
    const dp = getObserverLocalParts(dayUtc, tzHours);
    const evs = getEventsForDate(state.events, dp.year, dp.month, dp.day, tzHours);

    // Interactive sector when in focus
    if (isFocus) {
      const hit = svgEl('path', {
        d: describeSector(rInner, rOuter, aStart, aEnd),
        fill: d === monIdx ? 'var(--now)' : 'transparent',
        'fill-opacity': d === monIdx ? 0.08 : 0,
        style: 'cursor:pointer',
      });
      hit.addEventListener('click', (evt) => {
        evt.stopPropagation();
        jumpToTime(dayUtc, 1.0, `进入 ${weekLabels[d]}`);
      });
      g.appendChild(hit);

      const lp = polarToXY(rOuter - 20, aMid);
      const t = svgEl('text', {
        x: lp.x.toFixed(1), y: (lp.y + 4).toFixed(1),
        'text-anchor': 'middle',
        class: d === monIdx ? 'dial-label-zh dial-label-active' : 'dial-label-zh',
      });
      t.textContent = `${weekLabels[d]} ${dp.day}`;
      g.appendChild(t);
    }

    // Nested day events inside the weekday sector!
    evs.forEach((ev, idx) => {
      const frac1 = ev.startMin / 1440;
      const frac2 = ev.endMin / 1440;
      const ea1 = aStart + frac1 * (aEnd - aStart);
      const ea2 = aStart + frac2 * (aEnd - aStart);
      const rEv = isFocus ? rInner + 28 + (idx % 3) * 14 : (rInner + rOuter) / 2;
      const cat = getCategoryMeta(ev.category);
      g.appendChild(svgEl('path', {
        d: describeArc(rEv, ea1, Math.max(ea1 + 1.2, ea2)),
        fill: 'none',
        stroke: cat.color,
        'stroke-width': isFocus ? 7 : 4,
      }));
    });
  }
}

function renderMonthRing(g, ring, isFocus, parts, tzHours) {
  const { rInner, rOuter } = ring;
  const total = parts.daysInThisMonth;
  for (let d = 1; d <= total; d++) {
    const aStart = ((d - 1) / total) * 360;
    const aEnd = (d / total) * 360;
    const aMid = (aStart + aEnd) / 2;
    const isToday = d === parts.day;

    const p1 = polarToXY(rOuter - (d % 5 === 1 ? 10 : 5), aStart);
    const p2 = polarToXY(rOuter, aStart);
    g.appendChild(svgEl('line', {
      x1: p1.x.toFixed(1), y1: p1.y.toFixed(1),
      x2: p2.x.toFixed(1), y2: p2.y.toFixed(1),
      class: d % 5 === 1 ? 'tick-major' : 'tick-minor',
    }));

    const dayUtc = makeUtcFromObserverLocal(parts.year, parts.month, d, parts.hour, parts.minute, 0, tzHours);
    const moon = getLunarPhase(dayUtc);
    const evs = getEventsForDate(state.events, parts.year, parts.month, d, tzHours);

    if (isFocus) {
      // Lunar illumination micro-bar on outer rim
      const moonDot = polarToXY(rOuter + 8, aMid);
      g.appendChild(svgEl('circle', {
        cx: moonDot.x.toFixed(1), cy: moonDot.y.toFixed(1),
        r: (1 + moon.illumination * 2.5).toFixed(1),
        fill: 'var(--memory)',
        'fill-opacity': (0.25 + moon.illumination * 0.7).toFixed(2),
      }));

      const hit = svgEl('path', {
        d: describeSector(rInner, rOuter, aStart, aEnd),
        fill: isToday ? 'var(--now)' : 'transparent',
        'fill-opacity': isToday ? 0.1 : 0,
        style: 'cursor:pointer',
      });
      hit.addEventListener('click', (evt) => {
        evt.stopPropagation();
        jumpToTime(dayUtc, 1.0, `查看 ${parts.month}月${d}日`);
      });
      g.appendChild(hit);

      if (d === 1 || d % 5 === 0 || isToday) {
        const lp = polarToXY(rOuter - 22, aMid);
        const t = svgEl('text', {
          x: lp.x.toFixed(1), y: (lp.y + 4).toFixed(1),
          'text-anchor': 'middle',
          class: isToday ? 'dial-label dial-label-active' : 'dial-label',
        });
        t.textContent = String(d);
        g.appendChild(t);
      }
    }

    // Radial event bars
    evs.slice(0, 3).forEach((ev, idx) => {
      const cat = getCategoryMeta(ev.category);
      const r1 = isFocus ? rInner + 14 + idx * 18 : rInner + 4;
      const r2 = isFocus ? r1 + 12 : rOuter - 4;
      const ep1 = polarToXY(r1, aMid);
      const ep2 = polarToXY(r2, aMid);
      g.appendChild(svgEl('line', {
        x1: ep1.x.toFixed(1), y1: ep1.y.toFixed(1),
        x2: ep2.x.toFixed(1), y2: ep2.y.toFixed(1),
        stroke: cat.color,
        'stroke-width': isFocus ? 3.5 : 2,
      }));
    });
  }
}

function renderYearRing(g, ring, isFocus, parts, tzHours) {
  const { rInner, rOuter } = ring;
  const totalDays = parts.daysInThisYear;
  let dayAcc = 0;

  for (let m = 1; m <= 12; m++) {
    const dim = daysInMonth(parts.year, m);
    const aStart = (dayAcc / totalDays) * 360;
    const aEnd = ((dayAcc + dim) / totalDays) * 360;
    const aMid = (aStart + aEnd) / 2;

    const p1 = polarToXY(rInner, aStart);
    const p2 = polarToXY(rOuter, aStart);
    g.appendChild(svgEl('line', { x1: p1.x.toFixed(1), y1: p1.y.toFixed(1), x2: p2.x.toFixed(1), y2: p2.y.toFixed(1), class: 'tick-major' }));

    if (isFocus) {
      const monthUtc = makeUtcFromObserverLocal(parts.year, m, 1, 12, 0, 0, tzHours);
      const hit = svgEl('path', {
        d: describeSector(rInner, rOuter, aStart, aEnd),
        fill: m === parts.month ? 'var(--now)' : 'transparent',
        'fill-opacity': m === parts.month ? 0.08 : 0,
        style: 'cursor:pointer',
      });
      hit.addEventListener('click', (evt) => {
        evt.stopPropagation();
        jumpToTime(monthUtc, 3.0, `进入 ${parts.year}年${m}月`);
      });
      g.appendChild(hit);

      const lp = polarToXY(rOuter - 20, aMid);
      const t = svgEl('text', {
        x: lp.x.toFixed(1), y: (lp.y + 4).toFixed(1),
        'text-anchor': 'middle',
        class: m === parts.month ? 'dial-label-zh dial-label-active' : 'dial-label-zh',
      });
      t.textContent = MONTHS_ZH[m - 1];
      g.appendChild(t);
    }

    // Plot non-daily events on the year ring so annual patterns & history stand out
    for (let d = 1; d <= dim; d++) {
      const evs = getEventsForDate(state.events, parts.year, m, d, tzHours)
        .filter((e) => e.recurrence !== 'daily');
      if (evs.length > 0) {
        const doy = dayAcc + d - 1;
        const aDoy = (doy / totalDays) * 360;
        const cat = getCategoryMeta(evs[0].category);
        const ep1 = polarToXY(isFocus ? rInner + 16 : rInner + 3, aDoy);
        const ep2 = polarToXY(isFocus ? rInner + 38 : rOuter - 3, aDoy);
        g.appendChild(svgEl('line', {
          x1: ep1.x.toFixed(1), y1: ep1.y.toFixed(1),
          x2: ep2.x.toFixed(1), y2: ep2.y.toFixed(1),
          stroke: cat.color,
          'stroke-width': isFocus ? 2.4 : 1.5,
        }));
      }
    }

    dayAcc += dim;
  }

  // 4 cardinal solar terms (equinoxes & solstices) on outer rim
  if (isFocus) {
    const cardinals = [
      { label: '春分', approxDoy: 79 },
      { label: '夏至', approxDoy: 171 },
      { label: '秋分', approxDoy: 265 },
      { label: '冬至', approxDoy: 355 },
    ];
    for (const c of cardinals) {
      const a = (c.approxDoy / totalDays) * 360;
      const p1 = polarToXY(rOuter, a);
      const p2 = polarToXY(rOuter + 10, a);
      g.appendChild(svgEl('line', { x1: p1.x.toFixed(1), y1: p1.y.toFixed(1), x2: p2.x.toFixed(1), y2: p2.y.toFixed(1), stroke: 'var(--sun)', 'stroke-width': 1.4 }));
      const lp = polarToXY(rOuter + 22, a);
      const t = svgEl('text', { x: lp.x.toFixed(1), y: (lp.y + 4).toFixed(1), 'text-anchor': 'middle', class: 'dial-label-zh' });
      t.textContent = c.label;
      g.appendChild(t);
    }
  }
}

function renderEraRing(g, ring, isFocus, parts, tzHours) {
  const { rInner, rOuter } = ring;
  const startYear = 1923;
  const endYear = 2036;
  const span = endYear - startYear;

  if (!isFocus) {
    // Minimal nested indicator
    const t = svgEl('text', { x: 0, y: -rInner - 6, 'text-anchor': 'middle', class: 'dial-label' });
    t.textContent = String(parts.year);
    g.appendChild(t);
    return;
  }

  // Concentric growth rings: every decade + active year
  for (let y = startYear; y <= endYear; y++) {
    const isDecade = y % 10 === 0 || y === 1923;
    const isSelected = y === parts.year;
    if (!isDecade && !isSelected) continue;
    const r = rInner + ((y - startYear) / span) * (rOuter - rInner);
    g.appendChild(svgEl('circle', {
      cx: 0, cy: 0, r: r.toFixed(1),
      fill: 'none',
      stroke: isSelected ? 'var(--now)' : 'var(--dim)',
      'stroke-width': isSelected ? 2 : 0.8,
    }));
    if (y % 20 === 0 || y === 1923 || isSelected) {
      const isLeft = isSelected && y % 20 !== 0;
      const t = svgEl('text', {
        x: isLeft ? -6 : 6,
        y: (-r + 11).toFixed(1),
        'text-anchor': isLeft ? 'end' : 'start',
        class: isSelected ? 'dial-label dial-label-active' : 'dial-label',
      });
      t.textContent = String(y);
      g.appendChild(t);
    }
  }

  // Historical nodes
  for (const ev of state.events) {
    if (ev.source !== 'history') continue;
    const [ey, em, ed] = ev.date.split('-').map(Number);
    if (ey < startYear || ey > endYear) continue;
    const r = rInner + ((ey - startYear) / span) * (rOuter - rInner);
    const evUtc = makeUtcFromObserverLocal(ey, em, ed, 12, 0, 0, tzHours);
    const ep = getObserverLocalParts(evUtc, tzHours);
    const a = getScaleProgressAngle('year', ep);
    const pt = polarToXY(r, a);
    const node = svgEl('circle', {
      cx: pt.x.toFixed(1), cy: pt.y.toFixed(1), r: 5,
      fill: 'var(--sun)',
      stroke: 'var(--bg)',
      'stroke-width': 1.5,
      style: 'cursor:pointer',
    });
    node.addEventListener('click', (evt) => {
      evt.stopPropagation();
      jumpToTime(evUtc, 4.0, ev.title);
      selectEvent(ev.id);
    });
    g.appendChild(node);
  }
}

// ─── Observation Deck Renderer ───
function renderDeckHeaderOnly() {
  const dateEl = document.getElementById('deck-date');
  const timeEl = document.getElementById('deck-time');
  if (!dateEl || !timeEl) return;
  const obs = getObserver();
  const parts = getObserverLocalParts(state.cursorMs, obs.tz);
  dateEl.textContent = `${parts.year}年${parts.month}月${parts.day}日 ${WEEKDAYS_ZH[parts.weekday]}`;
  timeEl.textContent = parts.hms;
}

function renderDeck() {
  const obs = getObserver();
  const parts = getObserverLocalParts(state.cursorMs, obs.tz);
  const sun = getSunTimesAndPosition(state.cursorMs, obs.lat, obs.lon, obs.tz);
  const moon = getLunarPhase(state.cursorMs);
  const solarTerm = getSolarTermInfo(state.cursorMs);
  const season = getSeasonInfo(state.cursorMs);
  const dayEvents = getEventsForDate(state.events, parts.year, parts.month, parts.day, obs.tz);

  const dayLenH = Math.floor(sun.dayLengthMin / 60);
  const dayLenM = Math.round(sun.dayLengthMin % 60);

  let compareHtml = '';
  if (state.compareMs !== null) {
    const cp = getObserverLocalParts(state.compareMs, obs.tz);
    const cSun = getSunTimesAndPosition(state.compareMs, obs.lat, obs.lon, obs.tz);
    const cMoon = getLunarPhase(state.compareMs);
    const diffDayMin = Math.round(sun.dayLengthMin - cSun.dayLengthMin);
    const diffDays = Math.round((state.cursorMs - state.compareMs) / 86400_000);
    compareHtml = `
      <div class="compare-card" id="compare-card">
        <div class="deck-eyebrow">
          <span>双准线对比 · 副准线</span>
          <button type="button" class="step-btn" id="btn-clear-compare">取消对比</button>
        </div>
        <div style="margin-top:6px;">
          <strong>${cp.isoDate} ${cp.hm}</strong>（相距 <span class="mono">${diffDays >= 0 ? '+' : ''}${diffDays}</span> 天）
        </div>
        <div class="deck-meta" style="margin-top:4px;">
          昼长差 <span class="mono">${diffDayMin >= 0 ? '+' : ''}${diffDayMin}</span> 分 ·
          副准线月相 ${cMoon.name} (${Math.round(cMoon.illumination * 100)}%)
        </div>
      </div>
    `;
  }

  // Search results
  let searchResultsHtml = '';
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.trim().toLowerCase();
    const hits = state.events.filter((ev) =>
      ev.title.toLowerCase().includes(q) ||
      ev.date.includes(q) ||
      (ev.note && ev.note.toLowerCase().includes(q))
    ).slice(0, 6);
    searchResultsHtml = hits.length
      ? hits.map((ev) => `
          <div class="event-card" data-jump-event="${ev.id}">
            <div class="event-card-top">
              <span class="event-title">${ev.title}</span>
              <span class="event-time">${ev.date}</span>
            </div>
          </div>
        `).join('')
      : `<div class="deck-meta" style="padding:6px 0;">未找到匹配的日程或历史记录。可输入如 YYYY-MM-DD 直接跳转。</div>`;
  }

  // Editor HTML
  let editorHtml = '';
  if (state.editingEvent) {
    const ed = state.editingEvent.data;
    const isEdit = state.editingEvent.mode === 'edit';
    editorHtml = `
      <div class="editor-box" id="event-editor">
        <h3>${isEdit ? '编辑极坐标日程' : '新建极坐标日程'}</h3>
        <div class="field-row">
          <label for="ev-title">名称</label>
          <input id="ev-title" type="text" value="${escapeHtml(ed.title)}" placeholder="例如：暮色步测 / 实验记录" />
        </div>
        <div class="field-row">
          <label for="ev-date">日期</label>
          <input id="ev-date" type="date" value="${ed.date}" />
        </div>
        <div class="field-row">
          <label>极坐标弧段区间（拖动起止手柄或微调）</label>
          <div id="polar-range-mount"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div class="field-row">
            <label for="ev-cat">分类</label>
            <select id="ev-cat">
              ${EVENT_CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === ed.category ? 'selected' : ''}>${c.label}</option>`).join('')}
            </select>
          </div>
          <div class="field-row">
            <label for="ev-rec">周期规律</label>
            <select id="ev-rec">
              ${RECURRENCE_OPTIONS.map((r) => `<option value="${r.id}" ${r.id === ed.recurrence ? 'selected' : ''}>${r.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field-row">
          <label for="ev-note">备注</label>
          <textarea id="ev-note" rows="2">${escapeHtml(ed.note || '')}</textarea>
        </div>
        <div class="editor-actions">
          <div style="display:flex;gap:8px;">
            <button type="button" class="btn-primary" id="btn-save-ev">保存至年轮</button>
            <button type="button" class="btn-ghost" id="btn-cancel-ev">取消</button>
          </div>
          ${isEdit ? `
            <button type="button" class="hold-btn" id="btn-delete-ev" title="按住画满一圈以删除">
              <svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="11" class="hold-bg"></circle><circle cx="13" cy="13" r="11" class="hold-fg"></circle></svg>
              <span>按住删除</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  deckEl.innerHTML = `
    <div class="deck-header">
      <div class="deck-eyebrow">
        <span>${obs.name} · UTC${obs.tz >= 0 ? '+' : ''}${obs.tz}</span>
        <span>第 <span class="mono">${parts.dayOfYear}</span>/${parts.daysInThisYear} 天</span>
      </div>
      <div class="deck-date" id="deck-date">${parts.year}年${parts.month}月${parts.day}日 ${WEEKDAYS_ZH[parts.weekday]}</div>
      <div class="deck-time-row">
        <span class="deck-time" id="deck-time">${parts.hms}</span>
        <span class="deck-meta">${solarTerm.current.name} · ${season.name}</span>
      </div>
    </div>

    ${compareHtml}

    <div class="astro-grid">
      <div class="astro-cell">
        <span class="k">日出 / 日落</span>
        <span class="v">${sun.polarDay ? '极昼' : sun.polarNight ? '极夜' : `${formatMinutesAsHm(sun.sunriseMin)} / ${formatMinutesAsHm(sun.sunsetMin)}`}</span>
        <span class="s">昼长 ${dayLenH}h ${dayLenM}m</span>
      </div>
      <div class="astro-cell">
        <span class="k">太阳高度</span>
        <span class="v">${sun.altitude.toFixed(1)}°</span>
        <span class="s">方位 ${sun.azimuth.toFixed(0)}°</span>
      </div>
      <div class="astro-cell">
        <span class="k">月相 · 盈亏</span>
        <span class="v">${moon.name}</span>
        <span class="s">照度 ${Math.round(moon.illumination * 100)}%</span>
      </div>
    </div>

    <div class="time-steppers" aria-label="快捷时间步进">
      <button type="button" class="step-btn" data-step="day:-1">← 昨日</button>
      <button type="button" class="step-btn" data-step="hour:-1">−1h</button>
      <button type="button" class="step-btn" data-step="hour:1">+1h</button>
      <button type="button" class="step-btn" data-step="day:1">明日 →</button>
      <button type="button" class="step-btn" data-step="month:1">+1月</button>
      <button type="button" class="step-btn" data-step="year:1">+1年</button>
    </div>

    <div class="search-box">
      <input type="text" id="search-input" value="${escapeHtml(state.searchQuery)}" placeholder="搜索事件，或输入 2024-04-08 跳转…" aria-label="搜索或跳转日期" />
      <button type="button" class="step-btn" id="btn-jump-date">跳转</button>
    </div>
    ${searchResultsHtml}

    <div class="sec-head">
      <h2>当日弧段与记忆 (${dayEvents.length})</h2>
      <button type="button" class="step-btn" id="btn-new-ev">+ 新建日程</button>
    </div>

    <div class="event-list">
      ${dayEvents.length ? dayEvents.map((ev) => {
        const cat = getCategoryMeta(ev.category);
        const badgeLabel = ev.source === 'history' ? '历史' : ev.source === 'sample' ? '示例' : '个人';
        const recLabel = ev.recurrence !== 'none' ? ` · ${RECURRENCE_OPTIONS.find((r) => r.id === ev.recurrence)?.label}` : '';
        return `
          <div class="event-card ${state.selectedEventId === ev.id ? 'selected' : ''}" data-ev-id="${ev.id}" style="border-left-color:${cat.color}">
            <div class="event-card-top">
              <span class="event-title">${escapeHtml(ev.title)}<span class="badge ${ev.source}">${badgeLabel}${recLabel}</span></span>
              <span class="event-time">${formatMinutesAsHm(ev.startMin)}–${formatMinutesAsHm(ev.endMin)}</span>
            </div>
            ${ev.note ? `<div class="event-note">${escapeHtml(ev.note)}</div>` : ''}
          </div>
        `;
      }).join('') : `<div class="deck-meta" style="padding:10px 0;">这一天尚无记录。点击「+ 新建日程」或在圆盘上旋转探索。</div>`}
    </div>

    ${editorHtml}

    <div class="provenance-note">
      <strong>数据边界说明：</strong>
      日出日落、太阳高度、月相与二十四节气均为实时天文星历计算（非实测气象站）；
      带「示例」标签的日程为演示数据；「历史」条目为公开历史/天文锚点；个人新建日程仅保存在本机浏览器 <code>localStorage</code>。
    </div>
  `;

  bindDeckInteractions(dayEvents, parts);
}

function bindDeckInteractions(dayEvents, parts) {
  deckEl.querySelectorAll('[data-step]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [unit, valStr] = btn.dataset.step.split(':');
      const val = Number(valStr);
      const obs = getObserver();
      let next = state.cursorMs;
      if (unit === 'hour') next = addMinutesUtc(state.cursorMs, val * 60);
      if (unit === 'day') next = addDaysUtc(state.cursorMs, val);
      if (unit === 'month') next = addMonthsObserver(state.cursorMs, val, obs.tz);
      if (unit === 'year') next = addYearsObserver(state.cursorMs, val, obs.tz);
      jumpToTime(next, null, `步进 ${val > 0 ? '+' : ''}${val} ${unit}`);
    });
  });

  const searchInput = document.getElementById('search-input');
  const jumpBtn = document.getElementById('btn-jump-date');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderDeck();
      const restored = document.getElementById('search-input');
      if (restored) {
        restored.focus();
        restored.setSelectionRange(restored.value.length, restored.value.length);
      }
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleDateJump(searchInput.value);
    });
  }
  if (jumpBtn) {
    jumpBtn.addEventListener('click', () => handleDateJump(searchInput?.value || ''));
  }

  deckEl.querySelectorAll('[data-jump-event]').forEach((card) => {
    card.addEventListener('click', () => {
      const ev = state.events.find((x) => x.id === card.dataset.jumpEvent);
      if (!ev) return;
      const [y, m, d] = ev.date.split('-').map(Number);
      const obs = getObserver();
      const target = makeUtcFromObserverLocal(y, m, d, Math.floor(ev.startMin / 60), ev.startMin % 60, 0, obs.tz);
      state.selectedEventId = ev.id;
      state.searchQuery = '';
      jumpToTime(target, 1.0, ev.title);
    });
  });

  deckEl.querySelectorAll('[data-ev-id]').forEach((card) => {
    card.addEventListener('click', () => selectEvent(card.dataset.evId));
  });

  const newBtn = document.getElementById('btn-new-ev');
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      const startM = Math.floor(parts.minuteOfDay / 15) * 15;
      const endM = (startM + 60) % 1440;
      state.editingEvent = {
        mode: 'create',
        data: {
          id: `usr-${Date.now()}`,
          title: '',
          category: 'focus',
          source: 'user',
          date: parts.isoDate,
          startMin: startM,
          endMin: endM,
          recurrence: 'none',
          note: '',
        },
      };
      renderDeck();
    });
  }

  const clearComp = document.getElementById('btn-clear-compare');
  if (clearComp) {
    clearComp.addEventListener('click', () => {
      state.compareMs = null;
      compareBtn.classList.remove('active');
      renderAll();
    });
  }

  // Editor bindings
  if (state.editingEvent) {
    const mount = document.getElementById('polar-range-mount');
    const ed = state.editingEvent.data;
    const rangeCtrl = createArcRangeSelector(mount, {
      startMin: ed.startMin,
      endMin: ed.endMin,
      existingEvents: dayEvents.filter((x) => x.id !== ed.id),
      onChange: ({ startMin, endMin }) => {
        ed.startMin = startMin;
        ed.endMin = endMin;
      },
    });

    document.getElementById('btn-cancel-ev')?.addEventListener('click', () => {
      state.editingEvent = null;
      renderDeck();
    });

    document.getElementById('btn-save-ev')?.addEventListener('click', () => {
      const title = document.getElementById('ev-title').value.trim() || '未命名时间弧';
      const date = document.getElementById('ev-date').value || parts.isoDate;
      const category = document.getElementById('ev-cat').value;
      const recurrence = document.getElementById('ev-rec').value;
      const note = document.getElementById('ev-note').value.trim();
      const { startMin, endMin } = rangeCtrl.getRange();

      const updated = {
        ...ed,
        title,
        date,
        category,
        recurrence,
        note,
        startMin,
        endMin,
        edited: state.editingEvent.mode === 'edit',
      };

      if (state.editingEvent.mode === 'create') {
        state.events.push(updated);
      } else {
        const idx = state.events.findIndex((x) => x.id === updated.id);
        if (idx >= 0) state.events[idx] = updated;
      }
      saveEventState(state.events, state.hiddenIds);
      state.editingEvent = null;
      state.selectedEventId = updated.id;
      showToast('已写入年轮');
      renderAll();
    });

    const delBtn = document.getElementById('btn-delete-ev');
    if (delBtn) {
      bindHoldRing(delBtn, {
        durationMs: 800,
        onConfirm: () => {
          const id = ed.id;
          state.events = state.events.filter((x) => x.id !== id);
          if (!state.hiddenIds.includes(id)) state.hiddenIds.push(id);
          saveEventState(state.events, state.hiddenIds);
          state.editingEvent = null;
          state.selectedEventId = null;
          showToast('已从年轮移除');
          renderAll();
        },
      });
    }
  }
}

function selectEvent(id) {
  const ev = state.events.find((x) => x.id === id);
  if (!ev) return;
  state.selectedEventId = id;
  state.editingEvent = { mode: 'edit', data: { ...ev } };
  renderAll();
}

function handleDateJump(raw) {
  const m = raw.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) {
    showToast('请输入 YYYY-MM-DD 格式日期，如 2024-04-08');
    return;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) {
    showToast('无效的公历日期');
    return;
  }
  const obs = getObserver();
  const parts = getObserverLocalParts(state.cursorMs, obs.tz);
  const target = makeUtcFromObserverLocal(y, mo, d, parts.hour, parts.minute, 0, obs.tz);
  state.searchQuery = '';
  jumpToTime(target, null, `跳转 ${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderAll() {
  renderChronoscope();
  renderDeck();
  updateTrailButtons();
}

// ─── Pointer Dragging & Wheel on Chronoscope ───
let dragState = null;

function getDialPolar(evt) {
  const rect = svg.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return xyToPolar(evt.clientX - cx, evt.clientY - cy);
}

svg.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.event-arc') || e.target.closest('[style*="cursor:pointer"]')) return;
  angularVelocity = 0;
  const { angle } = getDialPolar(e);
  dragState = { lastAngle: angle, lastTs: performance.now(), moved: false };
  svg.setPointerCapture(e.pointerId);
});

svg.addEventListener('pointermove', (e) => {
  if (!dragState) return;
  const { angle } = getDialPolar(e);
  const dAngle = angleDiff(dragState.lastAngle, angle);
  if (Math.abs(dAngle) > 0.1) dragState.moved = true;
  applyAngleDeltaToCursor(dAngle);

  const nowTs = performance.now();
  const dt = Math.max(8, nowTs - dragState.lastTs);
  angularVelocity = (dAngle / dt) * 16;

  dragState.lastAngle = angle;
  dragState.lastTs = nowTs;
  renderChronoscope();
  renderDeckHeaderOnly();
});

const endDrag = () => {
  if (!dragState) return;
  dragState = null;
  if (Math.abs(angularVelocity) > 0.35) {
    startAnimLoop();
  } else {
    angularVelocity = 0;
    renderDeck();
  }
};
svg.addEventListener('pointerup', endDrag);
svg.addEventListener('pointercancel', endDrag);

svg.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (e.ctrlKey || e.shiftKey) {
    setScale(state.targetSigma + (e.deltaY > 0 ? 0.35 : -0.35));
  } else {
    applyAngleDeltaToCursor(-e.deltaY * 0.12);
    renderAll();
  }
}, { passive: false });

// ─── Topbar & Scale Bar Bindings ───
if (observerSelect) {
  observerSelect.innerHTML = OBSERVERS.map((o) => `<option value="${o.id}">${o.name}</option>`).join('');
  observerSelect.value = state.observerId;
  observerSelect.addEventListener('change', (e) => {
    state.observerId = e.target.value;
    showToast(`观测点切换至 ${getObserver().name}`);
    renderAll();
  });
}

if (scaleStopsEl) {
  scaleStopsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.scale-stop');
    if (!btn) return;
    setScale(Number(btn.dataset.scale), true);
  });
}

if (scaleSlider) {
  scaleSlider.addEventListener('input', (e) => {
    setScale(Number(e.target.value), false);
  });
}

themeBtn?.addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'paper' : 'dark';
  document.documentElement.dataset.theme = state.theme;
  localStorage.setItem('nianlun-theme', state.theme);
  themeBtn.textContent = state.theme === 'dark' ? '纸面' : '暗室';
});

handBtn?.addEventListener('click', () => {
  state.hand = state.hand === 'right' ? 'left' : 'right';
  document.documentElement.dataset.hand = state.hand;
  localStorage.setItem('nianlun-hand', state.hand);
  handBtn.textContent = state.hand === 'right' ? '右手象限' : '左手象限';
  renderChronoscope();
});

compareBtn?.addEventListener('click', () => {
  if (state.compareMs === null) {
    state.compareMs = state.cursorMs;
    compareBtn.classList.add('active');
    showToast('已锁定副准线，请旋转或跳转以对比');
  } else {
    state.compareMs = null;
    compareBtn.classList.remove('active');
  }
  renderAll();
});

backBtn?.addEventListener('click', () => {
  const prev = state.historyTrail.pop();
  if (!prev) return;
  state.cursorMs = prev.cursorMs;
  state.targetSigma = prev.sigma;
  if (scaleSlider) scaleSlider.value = String(prev.sigma);
  updateScaleStopsUI();
  startAnimLoop();
  renderAll();
});

nowBtn?.addEventListener('click', () => {
  state.nowMs = Date.now();
  jumpToTime(state.nowMs, null, '回到此刻');
  showToast('已回到此刻');
});

quadToggleBtn?.addEventListener('click', () => {
  const collapsed = document.body.classList.toggle('quad-collapsed');
  quadToggleBtn.textContent = collapsed ? '展开时间仪' : '收起时间仪';
});

// Keyboard navigation
window.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    applyAngleDeltaToCursor(15);
    renderAll();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    applyAngleDeltaToCursor(-15);
    renderAll();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    setScale(Math.round(state.targetSigma) - 1, true);
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    setScale(Math.round(state.targetSigma) + 1, true);
  } else if (e.key === 'n' || e.key === 'N') {
    state.nowMs = Date.now();
    jumpToTime(state.nowMs, null, '回到此刻');
  }
});

// Live 1s clock update
setInterval(() => {
  const wasAtNow = Math.abs(state.cursorMs - state.nowMs) < 2000;
  state.nowMs = Date.now();
  if (wasAtNow && !dragState && angularVelocity === 0) {
    state.cursorMs = state.nowMs;
    renderChronoscope();
    renderDeckHeaderOnly();
  }
}, 1000);

window.addEventListener('resize', () => renderChronoscope());

// Initial render
updateScaleStopsUI();
renderAll();
