/**
 * HAIZ · NIANLUN · 一卷 V4 — Main Application Orchestrator
 *
 * Connects the single living elastic scroll with:
 *  - Thing Panel (事物面板) + Yield/Focus relation threads
 *  - Unified Intake Panel (放入 · 多维信息归流 + 本地 OCR + 班级卷 + Pocket 迁移)
 *  - Search & Weekend Quick Glance (搜索与速览)
 *  - Optional WYSIWYG Paper Export (带走)
 *  - Hainan Middle School Schedule, Boundaries & Privacy Settings
 *  - Desktop Ambient Desk Rail + Keyboard Shortcuts + Shake/Button Undo + 6h Idle Reset
 */

import { NianlunStore } from './core/store.js';
import { loadOptionalClimatePatina } from './core/climate.js';
import { createId, WEEKDAY_LABELS } from './core/model.js';
import { ScrollCanvasRenderer } from './render/scroll_canvas.js';
import { ScrollGestureController } from './render/gestures.js';
import { clearWoodTextureCache } from './render/wood_textures.js';
import { ScrollA11yMirror } from './ui/a11y_layer.js';
import { renderItemSheet } from './ui/item_sheet.js';
import { createIntakeController } from './ui/intake_sheet.js';
import { renderSearchPanel } from './ui/search_panel.js';
import { renderTakeawaySheet } from './ui/takeaway_sheet.js';
import { renderSettingsSheet } from './ui/settings_sheet.js';

const store = new NianlunStore();
const climateRef = { current: { available: false, getDay: () => null } };

const canvas = document.getElementById('scroll-canvas');
const drawer = document.getElementById('drawer-sheet');
const backdrop = document.getElementById('sheet-backdrop');
const a11yMirrorEl = document.getElementById('a11y-mirror');
const toastEl = document.getElementById('toast-bar');
const rollMenuEl = document.getElementById('roll-menu');
const firstHintEl = document.getElementById('first-hint');
const btnResetNow = document.getElementById('btn-reset-now');
const btnUndo = document.getElementById('btn-undo');
const ribbonText = document.getElementById('ribbon-text');
const ribbonToggleStress = document.getElementById('ribbon-stress-btn');
const deskStatusEl = document.getElementById('desk-live-status');

// Apply saved theme immediately
if (store.state.theme && store.state.theme !== 'auto') {
  document.documentElement.dataset.theme = store.state.theme;
}
if (store.state.hasDismissedHint && firstHintEl) {
  firstHintEl.classList.add('faded');
}

const renderer = new ScrollCanvasRenderer(canvas, store, climateRef);
let activeDrawer = null; // null | 'item' | 'intake' | 'search' | 'takeaway' | 'settings'
let toastTimer = null;

function showToast(message, { undoDeleteId = null, duration = 4200 } = {}) {
  if (!toastEl) return;
  clearTimeout(toastTimer);
  toastEl.innerHTML = '';
  const span = document.createElement('span');
  span.textContent = message;
  toastEl.appendChild(span);

  if (undoDeleteId) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '撤销删除';
    btn.addEventListener('click', () => {
      if (store.undoPrivateDelete(undoDeleteId)) {
        toastEl.classList.remove('show');
        refreshAll();
        showToast('已恢复私人记录。');
      }
    });
    toastEl.appendChild(btn);
  }

  toastEl.classList.add('show');
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
  }, duration);
}

function closeRollMenu() {
  if (rollMenuEl) rollMenuEl.hidden = true;
}

function openRollMenu(rollSeg) {
  if (!rollMenuEl || !rollSeg) return;
  const days = store.days;
  const dA = days[rollSeg.from].date;
  const dB = days[rollSeg.to].date;
  const n = rollSeg.to - rollSeg.from + 1;
  const posName = rollSeg.position === 'past' ? '过去卷' : rollSeg.position === 'middle' ? '中间并置卷' : '未来卷';
  rollMenuEl.innerHTML = `
    <h3>${posName} · ${dA.getMonth() + 1}/${dA.getDate()}–${dB.getMonth() + 1}/${dB.getDate()}（${n < 7 ? `${n} 天` : `${Math.ceil(n / 7)} 周`}）</h3>
    <div class="btn-row">
      <button class="btn pri" data-rm="week">展开一周</button>
      <button class="btn" data-rm="day_out">卷出一天</button>
      <button class="btn" data-rm="day_in">卷回一天</button>
      <button class="btn" data-rm="all">全部展开此卷</button>
      <button class="btn" data-rm="close">关闭</button>
    </div>
  `;
  rollMenuEl.hidden = false;
  rollMenuEl.querySelector('[data-rm="week"]').addEventListener('click', () => {
    closeRollMenu();
    gestures.unrollSegment(rollSeg, 7);
  });
  rollMenuEl.querySelector('[data-rm="day_out"]').addEventListener('click', () => {
    closeRollMenu();
    gestures.windOneDay(rollSeg.position, 1, rollSeg);
  });
  rollMenuEl.querySelector('[data-rm="day_in"]').addEventListener('click', () => {
    closeRollMenu();
    gestures.windOneDay(rollSeg.position, -1, rollSeg);
  });
  rollMenuEl.querySelector('[data-rm="all"]').addEventListener('click', () => {
    closeRollMenu();
    gestures.unrollSegment(rollSeg, n);
  });
  rollMenuEl.querySelector('[data-rm="close"]').addEventListener('click', closeRollMenu);
}

function openDrawer(kind, { tall = false } = {}) {
  closeRollMenu();
  activeDrawer = kind;
  drawer.classList.toggle('tall', tall);
  drawer.classList.add('open');
  backdrop.classList.add('open');
}

function closeDrawer() {
  activeDrawer = null;
  renderer.selectedItemId = null;
  drawer.classList.remove('open');
  backdrop.classList.remove('open');
  renderer.draw();
  updateChrome();
}

function selectItem(itemId) {
  if (!itemId) {
    closeDrawer();
    return;
  }
  const item = store.state.items.find((x) => x.id === itemId);
  if (!item) return;
  renderer.selectedItemId = item.id;
  renderer.draw();
  openDrawer('item', { tall: false });
  renderItemSheet(drawer, {
    item,
    store,
    onClose: closeDrawer,
    onRefresh: () => {
      refreshAll();
      // Keep item panel synchronized with live edits
      const fresh = store.state.items.find((x) => x.id === item.id);
      if (fresh && activeDrawer === 'item') {
        renderItemSheet(drawer, {
          item: fresh,
          store,
          onClose: closeDrawer,
          onRefresh: () => selectItem(fresh.id),
          onToast: showToast,
          onOpenSettings: openSettings,
          onSelectItem: selectItem,
        });
      }
    },
    onToast: showToast,
    onOpenSettings: openSettings,
    onSelectItem: selectItem,
  });
}

const intakeCtrl = createIntakeController({
  store,
  onRefresh: () => {
    gestures.kickAnimation();
    refreshAll();
  },
  onToast: showToast,
  onSelectItem: selectItem,
  onJumpDate: (iso) => gestures.jumpToDateIso(iso, 'list'),
  onClose: closeDrawer,
});

function openIntake() {
  renderer.selectedItemId = null;
  openDrawer('intake', { tall: true });
  intakeCtrl.render(drawer);
}

function openSearch() {
  renderer.selectedItemId = null;
  openDrawer('search', { tall: true });
  renderSearchPanel(drawer, {
    store,
    onClose: closeDrawer,
    onSelectItem: selectItem,
    onJumpDate: (iso) => gestures.jumpToDateIso(iso, 'list'),
    onRefresh: refreshAll,
    onToast: showToast,
  });
}

function openTakeaway() {
  renderer.selectedItemId = null;
  openDrawer('takeaway', { tall: true });
  renderTakeawaySheet(drawer, {
    store,
    renderer,
    onClose: closeDrawer,
    onToast: showToast,
  });
}

function openSettings() {
  renderer.selectedItemId = null;
  openDrawer('settings', { tall: true });
  renderSettingsSheet(drawer, {
    store,
    climateRef,
    onClose: closeDrawer,
    onRefresh: refreshAll,
    onToast: showToast,
  });
}

function openFogCluster(itemIds) {
  if (!itemIds || itemIds.length === 0) return;
  selectItem(itemIds[0]);
  showToast(`此区间共有 ${itemIds.length + 2} 项待定雾，已打开其中一项；可在「搜索 → 待定的雾」查看全部。`);
}

function handleDropFogOnDay(itemId, targetDay) {
  const item = store.state.items.find((x) => x.id === itemId);
  if (!item || !targetDay) return;
  store.pushUndo(`将「${item.title}」凝聚到 ${targetDay.iso}`);
  item.form = 'day_fog';
  item.dateIso = targetDay.iso;
  item.fogFromIso = targetDay.iso;
  item.fogToIso = targetDay.iso;
  item.startHour = null;
  item.endHour = null;
  item.estimatedByStudent = true;
  item.status = 'tentative';
  item.lineage = item.lineage || [];
  item.lineage.unshift({
    id: createId('lyr'),
    sender: '我自己',
    originalAuthor: '我自己',
    sourceLabel: '拖动凝聚 · 学生估计',
    originChannel: 'student_self',
    directness: 'original',
    scopeMatch: 'exact',
    effectiveScore: 70,
    originalSentIso: `${store.state.nowIso}T14:15:00`,
    rawText: `将雾拖到 ${targetDay.iso} 周${WEEKDAY_LABELS[targetDay.wd]}（我估计）`,
    layerStatus: 'active',
    verdictReason: '同一物体连续变形，身份与来源谱系保留',
  });
  store.emit('drag_condense');
  showToast(`已将「${item.title}」凝聚到周${WEEKDAY_LABELS[targetDay.wd]}（我估计），点它可继续定到时刻或改回待定。`);
  refreshAll();
}

const gestures = new ScrollGestureController(canvas, renderer, store, {
  onSelectItem: selectItem,
  onOpenReturnWall: (wallId) => selectItem(wallId),
  onOpenRollMenu: openRollMenu,
  onOpenFogCluster: openFogCluster,
  onDropFogOnDay: handleDropFogOnDay,
  onFirstTouch: () => {
    if (firstHintEl && !store.state.hasDismissedHint) {
      store.state.hasDismissedHint = true;
      firstHintEl.classList.add('faded');
    }
  },
  onMutated: () => {
    a11yMirror.sync();
    updateChrome();
  },
});

const a11yMirror = new ScrollA11yMirror(a11yMirrorEl, store, renderer, gestures, {
  onSelectItem: selectItem,
});

function updateChrome() {
  const state = store.state;
  const isDef = store.isDefaultLayout();
  if (btnResetNow) btnResetNow.hidden = isDef && !renderer.selectedItemId;
  if (btnUndo) btnUndo.hidden = store.undoStack.length === 0;
  const floatBar = document.querySelector('.floating-bar');
  if (floatBar) floatBar.classList.toggle('mirror-right', Boolean(state.leftHandedDial));
  if (firstHintEl && (!isDef || store.undoStack.length > 0)) {
    firstHintEl.classList.add('faded');
  }

  // Honest demo / boundary / privacy ribbon
  if (ribbonText) {
    const bits = [];
    if (state.isDemoActive) bits.push('海南中学演示数据');
    else bits.push('本机真实空白卷');
    if (state.config.boundaryMode !== 'normal') {
      const bm = { holiday: '假期模式', graduated: '毕业封卷', transferred: '转学保留来源', on_leave: '休学留白' }[state.config.boundaryMode];
      if (bm) bits.push(bm);
    }
    if (state.privacyLocked) bits.push('隐私锁已开');
    if (state.highDensityStress) bits.push('高密度考前压力中');
    ribbonText.textContent = bits.join(' · ');
  }
  if (ribbonToggleStress) {
    ribbonToggleStress.textContent = state.highDensityStress ? '退回常规密度' : '高密度压力测试';
  }

  // Update desktop ambient companion status
  if (deskStatusEl) {
    const expanded = renderer.segs.filter((s) => !s.roll);
    const rolls = renderer.segs.filter((s) => s.roll);
    const modes = expanded.reduce((acc, s) => {
      acc[s.modeName] = (acc[s.modeName] || 0) + 1;
      return acc;
    }, {});
    const modeSummary = Object.entries(modes).map(([k, v]) => `${k} ${v}天`).join(' · ') || '全卷收起';
    deskStatusEl.innerHTML = `
      <div>展开：<strong>${expanded.length} 天</strong>（${modeSummary}）</div>
      <div>卷起：<strong>${rolls.length} 卷</strong>（${rolls.map((r) => r.position === 'past' ? '过去' : r.position === 'middle' ? '中间并置' : '未来').join(' / ')}）</div>
      <div>气候木色：${climateRef.current.available ? `海口 ERA5 真实档案` : '离线默认木色'}</div>
    `;
  }
}

function refreshAll() {
  renderer.draw();
  a11yMirror.sync();
  updateChrome();
}

// Header & Floating Button Wiring
document.getElementById('btn-intake')?.addEventListener('click', openIntake);
document.getElementById('btn-search')?.addEventListener('click', openSearch);
document.getElementById('btn-takeaway')?.addEventListener('click', openTakeaway);
document.getElementById('btn-settings')?.addEventListener('click', openSettings);
document.getElementById('dismiss-hint')?.addEventListener('click', () => {
  store.state.hasDismissedHint = true;
  firstHintEl?.classList.add('faded');
  store.persist();
});
backdrop?.addEventListener('click', closeDrawer);

btnResetNow?.addEventListener('click', () => {
  store.pushUndo('回到现在默认形态');
  store.applyDefaultWeights(false);
  renderer.selectedItemId = null;
  gestures.kickAnimation();
  setTimeout(() => {
    renderer.centerOnToday();
    refreshAll();
  }, gestures.isReducedMotion() ? 10 : 320);
});

btnUndo?.addEventListener('click', () => {
  const label = store.undo();
  if (label) {
    gestures.kickAnimation();
    refreshAll();
    showToast(`已撤销：${label}`);
  }
});

ribbonToggleStress?.addEventListener('click', () => {
  store.toggleHighDensityStress();
  refreshAll();
  showToast(store.state.highDensityStress
    ? '已开启「高密度考前周」（周六 8 项 + 4 雾 + 6 槽）。'
    : '已恢复常规周末密度。');
});

// Desktop Rail quick-action buttons
document.getElementById('rail-juxtapose')?.addEventListener('click', () => {
  // Quick helper to demonstrate Middle Roll juxtaposition: squeeze Sun 11/29..Tue 12/1 into a middle roll!
  store.pushUndo('并置今天与下周三（形成中间卷）');
  const todayI = store.nowIdx;
  for (let i = todayI + 1; i <= todayI + 3; i++) {
    if (store.days[i]) store.days[i].tw = 0;
  }
  if (store.days[todayI + 4]) store.days[todayI + 4].tw = 2.6;
  store.persist();
  gestures.kickAnimation();
  showToast('已将中间 3 天捏成并置卷，今天（周六）与下周三月考并排呈现。');
});

document.getElementById('rail-hour')?.addEventListener('click', () => {
  gestures.expandDayToMode(store.nowIdx, 'hour');
  renderer.centerOnToday();
  refreshAll();
});

document.getElementById('rail-conflict')?.addEventListener('click', () => {
  gestures.jumpToDateIso('2026-12-01', 'hour');
  showToast('已展开周二 12/1 时刻读法：下午 15:35 彩排与竞赛初筛自动局部分道标注「重叠」。');
});

document.getElementById('rail-intake')?.addEventListener('click', openIntake);
document.getElementById('rail-takeaway')?.addEventListener('click', openTakeaway);

// Keyboard shortcuts for desktop & assistive use
window.addEventListener('keydown', (e) => {
  if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
  if (e.key === 'Escape') {
    closeRollMenu();
    closeDrawer();
  } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    const label = store.undo();
    if (label) { gestures.kickAnimation(); refreshAll(); showToast(`已撤销：${label}`); }
  } else if (e.key === '0') {
    btnResetNow?.click();
  } else if (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
    e.preventDefault();
    openSearch();
  }
});

// Resize observer + color-scheme watcher
new ResizeObserver(() => {
  renderer.resize();
  a11yMirror.sync();
  updateChrome();
}).observe(canvas);

window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
  clearWoodTextureCache();
  refreshAll();
});

// Load optional real Haikou ERA5 weather patina asynchronously (never blocks startup!)
loadOptionalClimatePatina().then((climate) => {
  climateRef.current = climate;
  if (climate.available) {
    clearWoodTextureCache();
    refreshAll();
  }
});

// Register offline-first Service Worker when served over http(s)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// Initial render
renderer.resize();
refreshAll();

// Structured read-only telemetry hook for automated E2E, boundary & FPS testing
window.__NIANLUN_V4__ = {
  getState: () => ({
    segs: renderer.segs.map((s) => s.roll
      ? { roll: true, position: s.position, from: s.from, to: s.to, y: s.y, h: s.h }
      : { roll: false, i: s.i, iso: store.days[s.i].iso, mode: s.mode, modeName: s.modeName, y: s.y, h: s.h, w: store.days[s.i].w }),
    scrollOffset: renderer.scrollOffset,
    totalHeight: renderer.totalHeight,
    nowIdx: store.nowIdx,
    selectedItemId: renderer.selectedItemId,
    activeDrawer,
    itemCount: store.state.items.length,
    unparsedCount: store.state.unparsedMessages.length,
    privacyLocked: store.state.privacyLocked,
    highDensityStress: store.state.highDensityStress,
    climateLoaded: climateRef.current.available,
    hitRegions: renderer.hitRegions,
    rollHitBoxes: renderer.rollHitBoxes,
  }),
  expandDay: (iso, mode) => gestures.jumpToDateIso(iso, mode),
  selectItem,
  openIntake,
  openSearch,
  openTakeaway,
  openSettings,
  closeDrawer,
  centerOnToday: () => { renderer.centerOnToday(); refreshAll(); },
  windOne: (pos, dir) => gestures.windOneDay(pos, dir),
  toggleStress: (v) => { store.toggleHighDensityStress(v); refreshAll(); },
  resetDefault: () => { store.applyDefaultWeights(true); renderer.centerOnToday(); refreshAll(); },
};
