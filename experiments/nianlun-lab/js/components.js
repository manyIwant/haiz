/**
 * NIANLUN · Chronoscope — Original Polar Interaction Components
 *
 * Reusable across both the main Chronoscope and the Geometry & Component Bench.
 */

import { polarToXY, xyToPolar, describeArc, normAngle } from './polar.js';
import { formatMinutesAsHm } from './astro.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  return el;
}

/**
 * 1. Polar Arc Time-Range Selector (极坐标弧段区间选择器)
 * Maps 24h (0..1440 min) onto a circle where 12:00 = 0° (top), 00:00 = 180° (bottom).
 */
export function createArcRangeSelector(container, {
  startMin = 9 * 60,
  endMin = 11 * 60,
  existingEvents = [],
  onChange = () => {},
} = {}) {
  let state = { startMin, endMin };

  const minToAngle = (m) => normAngle((m / 1440) * 360 + 180);
  const angleToMin = (ang) => {
    const shifted = normAngle(ang - 180);
    const raw = (shifted / 360) * 1440;
    return Math.round(raw / 15) * 15 % 1440;
  };

  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'nl-arc-range';

  const svg = svgEl('svg', { viewBox: '-130 -130 260 260', class: 'nl-arc-range-svg', role: 'group', 'aria-label': '极坐标时间区间选择器' });
  const R = 92;

  // Base dial + 24h ticks
  svg.appendChild(svgEl('circle', { cx: 0, cy: 0, r: R, class: 'ar-track' }));
  for (let h = 0; h < 24; h++) {
    const a = minToAngle(h * 60);
    const p1 = polarToXY(R - (h % 6 === 0 ? 10 : 5), a);
    const p2 = polarToXY(R + 3, a);
    svg.appendChild(svgEl('line', {
      x1: p1.x.toFixed(1), y1: p1.y.toFixed(1),
      x2: p2.x.toFixed(1), y2: p2.y.toFixed(1),
      class: h % 6 === 0 ? 'ar-tick-major' : 'ar-tick',
    }));
    if (h % 6 === 0) {
      const lp = polarToXY(R + 18, a);
      const t = svgEl('text', { x: lp.x.toFixed(1), y: (lp.y + 4).toFixed(1), class: 'ar-label', 'text-anchor': 'middle' });
      t.textContent = `${String(h).padStart(2, '0')}`;
      svg.appendChild(t);
    }
  }

  // Existing events layer (to show overlaps)
  const existingG = svgEl('g', { class: 'ar-existing' });
  for (const ev of existingEvents) {
    const a1 = minToAngle(ev.startMin);
    const a2 = minToAngle(ev.endMin);
    if (Math.abs(ev.endMin - ev.startMin) > 5) {
      existingG.appendChild(svgEl('path', {
        d: describeArc(R - 14, a1, a2),
        class: 'ar-existing-arc',
      }));
    }
  }
  svg.appendChild(existingG);

  const activeArc = svgEl('path', { class: 'ar-active' });
  svg.appendChild(activeArc);

  const startHandle = svgEl('circle', { r: 8, class: 'ar-handle ar-handle-start', tabindex: 0, 'aria-label': '开始时间手柄' });
  const endHandle = svgEl('circle', { r: 8, class: 'ar-handle ar-handle-end', tabindex: 0, 'aria-label': '结束时间手柄' });
  svg.appendChild(startHandle);
  svg.appendChild(endHandle);

  const centerText = svgEl('text', { x: 0, y: -4, class: 'ar-center-time', 'text-anchor': 'middle' });
  const centerDur = svgEl('text', { x: 0, y: 16, class: 'ar-center-dur', 'text-anchor': 'middle' });
  svg.appendChild(centerText);
  svg.appendChild(centerDur);

  wrap.appendChild(svg);

  // Accessible fallback / fine-tune steppers
  const controls = document.createElement('div');
  controls.className = 'ar-steppers';
  controls.innerHTML = `
    <div class="ar-step-group">
      <span>起</span>
      <button type="button" data-act="s-minus" aria-label="开始时间减15分">−15m</button>
      <button type="button" data-act="s-plus" aria-label="开始时间加15分">+15m</button>
    </div>
    <div class="ar-step-group">
      <span>止</span>
      <button type="button" data-act="e-minus" aria-label="结束时间减15分">−15m</button>
      <button type="button" data-act="e-plus" aria-label="结束时间加15分">+15m</button>
    </div>
  `;
  wrap.appendChild(controls);
  container.appendChild(wrap);

  function render() {
    const a1 = minToAngle(state.startMin);
    const a2 = minToAngle(state.endMin);
    const spanMin = ((state.endMin - state.startMin) + 1440) % 1440 || 1440;
    const endAngle = normAngle(a1 + (spanMin / 1440) * 360);

    activeArc.setAttribute('d', describeArc(R, a1, endAngle));
    const p1 = polarToXY(R, a1);
    const p2 = polarToXY(R, endAngle);
    startHandle.setAttribute('cx', p1.x.toFixed(1));
    startHandle.setAttribute('cy', p1.y.toFixed(1));
    endHandle.setAttribute('cx', p2.x.toFixed(1));
    endHandle.setAttribute('cy', p2.y.toFixed(1));

    centerText.textContent = `${formatMinutesAsHm(state.startMin)}–${formatMinutesAsHm(state.endMin)}`;
    const hrs = Math.floor(spanMin / 60);
    const mins = spanMin % 60;
    centerDur.textContent = hrs > 0 ? `${hrs}h ${mins ? mins + 'm' : ''}`.trim() : `${mins}m`;
  }

  let dragging = null;
  const getSvgCoords = (evt) => {
    const rect = svg.getBoundingClientRect();
    const x = ((evt.clientX - rect.left) / rect.width) * 260 - 130;
    const y = ((evt.clientY - rect.top) / rect.height) * 260 - 130;
    return xyToPolar(x, y);
  };

  startHandle.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    dragging = 'start';
    startHandle.setPointerCapture(e.pointerId);
  });
  endHandle.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    dragging = 'end';
    endHandle.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const { angle } = getSvgCoords(e);
    const m = angleToMin(angle);
    if (dragging === 'start') {
      state.startMin = m;
    } else {
      state.endMin = m;
    }
    render();
    onChange({ ...state });
  });
  const stopDrag = () => { dragging = null; };
  svg.addEventListener('pointerup', stopDrag);
  svg.addEventListener('pointercancel', stopDrag);

  controls.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 's-minus') state.startMin = (state.startMin - 15 + 1440) % 1440;
    if (act === 's-plus') state.startMin = (state.startMin + 15) % 1440;
    if (act === 'e-minus') state.endMin = (state.endMin - 15 + 1440) % 1440;
    if (act === 'e-plus') state.endMin = (state.endMin + 15) % 1440;
    render();
    onChange({ ...state });
  });

  render();
  return {
    setRange(s, e) {
      state.startMin = s;
      state.endMin = e;
      render();
    },
    getRange: () => ({ ...state }),
  };
}

/**
 * 2. Hold-to-Confirm Polar Ring (画满一圈确认)
 */
export function bindHoldRing(button, { durationMs = 850, onConfirm = () => {} } = {}) {
  const fg = button.querySelector('.hold-fg');
  const CIRC = 69.115; // 2 * pi * 11
  let raf = null;
  let startTs = 0;
  let confirmed = false;

  const reset = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    startTs = 0;
    confirmed = false;
    if (fg) fg.style.strokeDashoffset = String(CIRC);
    button.classList.remove('holding');
  };

  const step = (ts) => {
    if (!startTs) startTs = ts;
    const p = Math.min(1, (ts - startTs) / durationMs);
    if (fg) fg.style.strokeDashoffset = String(CIRC * (1 - p));
    if (p >= 1) {
      confirmed = true;
      reset();
      onConfirm();
      return;
    }
    raf = requestAnimationFrame(step);
  };

  const begin = (e) => {
    if (e.type === 'keydown' && e.key !== ' ' && e.key !== 'Enter') return;
    if (e.type === 'keydown') e.preventDefault();
    if (raf) return;
    confirmed = false;
    button.classList.add('holding');
    raf = requestAnimationFrame(step);
  };

  const end = () => {
    if (!confirmed) reset();
  };

  button.addEventListener('pointerdown', begin);
  button.addEventListener('pointerup', end);
  button.addEventListener('pointerleave', end);
  button.addEventListener('pointercancel', end);
  button.addEventListener('keydown', begin);
  button.addEventListener('keyup', end);
}
