/**
 * HAIZ · NIANLUN · 一卷 V4 — Search, Weekend 30-Second Glance & Quick Memory Entry
 *
 * Adapted from HAIZ Pocket's `command_palette.dart` philosophy.
 * Respects Privacy Lock (§12): locked memories NEVER leak in search!
 */

import { createId, isItemPrivateLocked, getTaskStatusMeta } from '../core/model.js';

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderSearchPanel(container, { store, onClose, onSelectItem, onJumpDate, onRefresh, onToast }) {
  const state = store.state;
  let query = '';
  let filterMode = 'all'; // 'all' | 'weekend' | 'exams' | 'fog' | 'unknown_past'

  function getMatches() {
    const q = query.trim().toLowerCase();
    return state.items.filter((item) => {
      if (item.hiddenByStudent || item.isReturnWall) return false;
      if (isItemPrivateLocked(item, state.privacyLocked)) return false;

      if (filterMode === 'weekend') {
        const isWeekendDue = item.kind === 'task' && (item.dueIso === '2026-11-29' || item.dateIso === '2026-11-28' || item.dateIso === '2026-11-29');
        const isDone = item.status === 'done' || item.status === 'not_needed' || item.status === 'cancelled_by_source';
        if (!isWeekendDue || isDone) return false;
      } else if (filterMode === 'exams') {
        if (item.kind !== 'exam') return false;
      } else if (filterMode === 'fog') {
        if (item.form !== 'fog' && item.form !== 'day_fog') return false;
      } else if (filterMode === 'unknown_past') {
        if (!(item.kind === 'task' && item.status === 'unknown' && (item.dateIso || '') < state.nowIso)) return false;
      }

      if (!q) return true;
      return (item.title || '').toLowerCase().includes(q)
        || (item.subject || '').toLowerCase().includes(q)
        || (item.notes || '').toLowerCase().includes(q)
        || (item.sourceSummary || '').toLowerCase().includes(q);
    });
  }

  function paint() {
    const matches = getMatches();
    const weekendPending = state.items.filter((x) => !x.hiddenByStudent && x.kind === 'task' && x.dueLabel === '周日返校前' && x.status !== 'done' && x.status !== 'not_needed');
    const nextExam = state.items
      .filter((x) => !x.hiddenByStudent && x.kind === 'exam' && (x.dateIso || '') >= state.nowIso)
      .sort((a, b) => (a.dateIso || '').localeCompare(b.dateIso || ''))[0];

    container.innerHTML = `
      <div class="sheet-head">
        <div>
          <span class="eyebrow">搜索与周末速览</span>
          <h2>找一件事，或记一句此刻</h2>
        </div>
        <button class="icon-btn" data-close aria-label="关闭搜索">✕</button>
      </div>
      <div class="sheet-body">
        <input type="search" class="search-input" data-search-input value="${esc(query)}" placeholder="搜索考试、作业、课程、记忆（涵盖已卷起的过去与未来）…">

        <div class="chip-grid" style="margin-top:10px">
          <button class="chip ${filterMode === 'all' ? 'active' : ''}" data-filter="all">全部</button>
          <button class="chip ${filterMode === 'weekend' ? 'active' : ''}" data-filter="weekend">本周末待交 (${weekendPending.length})</button>
          <button class="chip ${filterMode === 'exams' ? 'active' : ''}" data-filter="exams">全部考试</button>
          <button class="chip ${filterMode === 'fog' ? 'active' : ''}" data-filter="fog">待定的雾</button>
          <button class="chip ${filterMode === 'unknown_past' ? 'active' : ''}" data-filter="unknown_past">过去未知结果</button>
        </div>

        ${nextExam ? `
          <div class="quick-banner">
            <span>下一次考试：<strong>${esc(nextExam.title)}</strong>（${esc(nextExam.dateIso)}）</span>
            <button class="mini-btn pri" data-jump-next-exam="${nextExam.id}">在卷上定位</button>
          </div>
        ` : ''}

        <div class="search-results">
          ${matches.length === 0 ? '<p class="muted small" style="padding:12px 0">没有找到匹配的事项。</p>' : matches.map((it) => `
            <button class="result-row" data-hit-item="${it.id}">
              <div>
                <div class="result-title">${esc(it.title)}</div>
                <div class="small muted">${esc(it.subject)} · ${esc(it.dateIso || (it.fogFromIso ? `${it.fogFromIso}–${it.fogToIso}（雾）` : '待定'))}${it.kind === 'task' ? ` · ${getTaskStatusMeta(it.status).label}` : ''}</div>
              </div>
              <span class="arrow">→</span>
            </button>
          `).join('')}
        </div>

        ${!state.privacyLocked ? `
          <section class="sheet-sec">
            <div class="sec-label">在今天留下一条琥珀记忆（个人记录 · 仅自己可见）</div>
            <div class="inline-form">
              <input type="text" data-mem-input placeholder="例如：周六傍晚在老街买了椰子水…">
              <button class="btn pri" data-mem-save>留下</button>
            </div>
          </section>
        ` : '<p class="muted small" style="margin-top:12px">隐私锁已开启：搜索结果已自动隐藏私密个人记录。</p>'}
      </div>
    `;

    container.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', onClose));
    const input = container.querySelector('[data-search-input]');
    if (input) {
      input.addEventListener('input', () => {
        query = input.value;
        paint();
        const fresh = container.querySelector('[data-search-input]');
        if (fresh) { fresh.focus(); fresh.setSelectionRange(query.length, query.length); }
      });
    }

    container.querySelectorAll('[data-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        filterMode = btn.dataset.filter;
        paint();
      });
    });

    const jumpExam = container.querySelector('[data-jump-next-exam]');
    if (jumpExam) {
      jumpExam.addEventListener('click', () => {
        const it = state.items.find((x) => x.id === jumpExam.dataset.jumpNextExam);
        if (it && it.dateIso) onJumpDate(it.dateIso);
        onSelectItem(it.id);
      });
    }

    container.querySelectorAll('[data-hit-item]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const it = state.items.find((x) => x.id === btn.dataset.hitItem);
        if (it && (it.dateIso || it.fogFromIso)) onJumpDate(it.dateIso || it.fogFromIso);
        onSelectItem(btn.dataset.hitItem);
      });
    });

    const memSave = container.querySelector('[data-mem-save]');
    if (memSave) {
      memSave.addEventListener('click', () => {
        const txt = (container.querySelector('[data-mem-input]')?.value || '').trim();
        if (!txt) return;
        store.pushUndo('记录一条个人记忆');
        const mem = {
          id: createId('mem'),
          kind: 'memory',
          subject: '记忆',
          title: txt,
          epistemicKind: 'personal_record',
          status: 'confirmed_happened',
          form: 'memory',
          dateIso: state.nowIso,
          notes: '',
          sourceSummary: '我自己 · 个人记录',
          isPrivate: true,
          lineage: [],
          flyInAt: Date.now(),
        };
        state.items.push(mem);
        store.emit('add_memory');
        onRefresh();
        onToast('已在今天刻下一条琥珀记忆（卷起后将显现在年轮端面）。');
        onClose();
      });
    }
  }

  paint();
}
