/**
 * NIANLUN · 年轮 交互实验场 002 — Main Orchestrator
 *
 * Manages:
 * - 4 fundamentally distinct polar/fluid interaction experiments on shared live specimens
 * - Live Side-by-Side Comparison Stage (shared world state across both halves)
 * - 60fps unified physics heartbeat
 * - URL hash routing (#yielding, #fisheye, #marking, #sunburst, #compare)
 * - Warm Mineral Paper / Darkroom Slate theme switch & Research Notes drawer
 */

import { world, stepWorldPhysics, onWorldChange, runSpecimenAction } from './specimens.js';
import { mountYieldingExperiment } from './exp-yielding.js';
import { mountFisheyeExperiment } from './exp-fisheye.js';
import { mountMarkingExperiment } from './exp-marking.js';
import { mountSunburstExperiment } from './exp-sunburst.js';

export const EXPERIMENTS = [
  {
    id: 'yielding',
    num: 'I',
    title: '让位生长',
    en: 'Spatial Yielding',
    stack: 'd3-force + flubber + GSAP',
    cue: '点按任意节点在原位弹性生长，周围节点物理让位；拖动两个节点靠近可建立「双体共生」连结。',
    mount: mountYieldingExperiment,
  },
  {
    id: 'fisheye',
    num: 'II',
    title: '时空透镜',
    en: 'Fisheye Membrane',
    stack: 'd3-fisheye + d3-delaunay + GSAP',
    cue: '整张画布是一片连续的 Voronoi 细胞膜：移动指针即弯折空间，点按任意细胞锁焦并在多边形内直接操作。',
    mount: mountFisheyeExperiment,
  },
  {
    id: 'marking',
    num: 'III',
    title: '一笔穿层',
    en: 'Marking Gesture',
    stack: 'Kando GestureDetector + GSAP',
    cue: '在画布任意位置按住拖动，划向目标后「拐弯或微停」即就地裂变子环，一笔完成跨层级操作（亦支持逐层点击）。',
    mount: mountMarkingExperiment,
  },
  {
    id: 'sunburst',
    num: 'IV',
    title: '年轮解体',
    en: 'Semantic Dissolution',
    stack: 'd3-hierarchy + d3-shape + GSAP',
    cue: '点击任意扇弧，年轮沿原角度平滑展开为 360° 操作环，圆心同步转化为该对象的实时交互画布。',
    mount: mountSunburstExperiment,
  },
];

const stageHost = document.getElementById('stage-host');
const navTabs = document.getElementById('exp-tabs');
const cueText = document.getElementById('cue-text');
const stackBadge = document.getElementById('stack-badge');
const toastEl = document.getElementById('lab-toast');
const themeBtn = document.getElementById('btn-theme');
const soundBtn = document.getElementById('btn-sound');
const notesBtn = document.getElementById('btn-notes');
const notesDrawer = document.getElementById('notes-drawer');
const notesClose = document.getElementById('notes-close');

let activeInstances = [];
let currentView = 'yielding';
let compareLeftId = 'yielding';
let compareRightId = 'fisheye';
let toastTimer = null;

// Theme init (default: warm mineral paper — deliberately breaking away from black-HUD clichés!)
let theme = localStorage.getItem('nianlun-v2-theme') || 'paper';
document.documentElement.dataset.theme = theme;
if (themeBtn) themeBtn.textContent = theme === 'paper' ? '暗房' : '纸面';

function showToast(msg) {
  if (!msg || !toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 2400);
}

onWorldChange((w, toast) => {
  if (toast) showToast(toast);
  if (soundBtn) {
    soundBtn.textContent = w.pulse.soundOn ? '🔊 声景开' : '🔇 静音';
    soundBtn.classList.toggle('is-active', w.pulse.soundOn);
  }
});

function destroyActive() {
  for (const inst of activeInstances) {
    try { inst.destroy(); } catch { /* noop */ }
  }
  activeInstances = [];
}

function mountView(viewId, updateHash = true) {
  destroyActive();
  currentView = viewId;
  if (updateHash) {
    history.replaceState(null, '', `#${viewId}`);
  }

  // Update nav tabs
  for (const btn of navTabs.querySelectorAll('[data-view]')) {
    btn.classList.toggle('is-active', btn.dataset.view === viewId);
  }

  stageHost.innerHTML = '';
  stageHost.className = viewId === 'compare' ? 'stage-host is-compare' : 'stage-host';

  if (viewId === 'compare') {
    cueText.textContent = '双机制实时对照：两侧共享同一组物理与天文状态，在左侧操作会即时反映在右侧对象中。';
    stackBadge.textContent = 'Live Dual-Engine Comparison';

    const makePane = (side, selectedId) => {
      const pane = document.createElement('div');
      pane.className = 'compare-pane';
      const bar = document.createElement('div');
      bar.className = 'compare-pane-bar';
      const sel = document.createElement('select');
      sel.className = 'compare-select';
      sel.setAttribute('aria-label', side === 'left' ? '选择左侧交互机制' : '选择右侧交互机制');
      sel.innerHTML = EXPERIMENTS.map((e) =>
        `<option value="${e.id}" ${e.id === selectedId ? 'selected' : ''}>${e.num}. ${e.title}（${e.stack}）</option>`
      ).join('');
      bar.appendChild(sel);

      const canvas = document.createElement('div');
      canvas.className = 'compare-pane-canvas';
      pane.appendChild(bar);
      pane.appendChild(canvas);
      stageHost.appendChild(pane);

      const exp = EXPERIMENTS.find((e) => e.id === selectedId) || EXPERIMENTS[0];
      const inst = exp.mount(canvas);
      activeInstances.push(inst);

      sel.addEventListener('change', (e) => {
        if (side === 'left') compareLeftId = e.target.value;
        else compareRightId = e.target.value;
        mountView('compare', false);
      });
    };

    makePane('left', compareLeftId);
    makePane('right', compareRightId);
  } else {
    const exp = EXPERIMENTS.find((e) => e.id === viewId) || EXPERIMENTS[0];
    cueText.textContent = exp.cue;
    stackBadge.textContent = exp.stack;

    const canvas = document.createElement('div');
    canvas.className = 'single-canvas';
    stageHost.appendChild(canvas);
    const inst = exp.mount(canvas);
    activeInstances.push(inst);
  }
}

// Build top navigation tabs
navTabs.innerHTML = EXPERIMENTS.map((e) =>
  `<button type="button" class="nav-tab" data-view="${e.id}"><span class="tab-num">${e.num}</span> ${e.title}</button>`
).join('') + `<button type="button" class="nav-tab nav-tab-compare" data-view="compare">⇄ 双屏对照</button>`;

navTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-view]');
  if (!btn) return;
  mountView(btn.dataset.view);
});

themeBtn?.addEventListener('click', () => {
  theme = theme === 'paper' ? 'dark' : 'paper';
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('nianlun-v2-theme', theme);
  themeBtn.textContent = theme === 'paper' ? '暗房' : '纸面';
});

soundBtn?.addEventListener('click', () => {
  runSpecimenAction('pulse', 'toggleSound');
});

notesBtn?.addEventListener('click', () => {
  notesDrawer?.classList.toggle('is-open');
});
notesClose?.addEventListener('click', () => {
  notesDrawer?.classList.remove('is-open');
});

window.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  if (e.key === '1') mountView('yielding');
  else if (e.key === '2') mountView('fisheye');
  else if (e.key === '3') mountView('marking');
  else if (e.key === '4') mountView('sunburst');
  else if (e.key === 'c' || e.key === 'C') mountView('compare');
  else if (e.key === 'Escape') notesDrawer?.classList.remove('is-open');
});

window.addEventListener('resize', () => {
  for (const inst of activeInstances) inst.resize();
});

// Unified 60fps loop
function loop(ts) {
  stepWorldPhysics(ts);
  for (const inst of activeInstances) {
    inst.frame(ts);
  }
  requestAnimationFrame(loop);
}

// Boot from URL hash
const initialHash = location.hash.replace('#', '').trim();
const validViews = [...EXPERIMENTS.map((e) => e.id), 'compare'];
mountView(validViews.includes(initialHash) ? initialHash : 'yielding', false);
requestAnimationFrame(loop);
