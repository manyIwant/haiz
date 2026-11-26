/**
 * HAIZ · NIANLUN · 一卷 V4 — Optional "带走" (Paper Export, Master v4 §9.5, §12)
 *
 * Implements "所见即所带" (WYSIWYG export reflecting the exact currently expanded/rolled scroll shape!)
 * plus classic templates: 下周页 / 考前复习卡 / 空白周页.
 *
 * Privacy guarantee (§12): NEVER includes grades or locked private memories on printed sheets!
 * Exports:
 *  - High-DPI crisp PNG image (generated locally on canvas)
 *  - Printable A4/A5 sheet / PDF via native browser print (`print.css`)
 *  - Standard RFC 5545 `.ics` calendar file (reusing Pocket's date-only honesty!)
 */

import { WEEKDAY_LABELS, formatHour, isItemPrivateLocked } from '../core/model.js';

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function renderTakeawaySheet(container, { store, renderer, onClose, onToast }) {
  let template = 'wysiwyg'; // 'wysiwyg' | 'next_week' | 'review_card' | 'blank_week'
  let includeOneLiner = '';

  function buildPrintableRows() {
    const state = store.state;
    const days = store.days;
    const rows = [];

    const safeItemsForDay = (iso) => state.items.filter((it) => {
      if (it.hiddenByStudent || it.isReturnWall) return false;
      // Privacy guard (§12): NEVER print locked private memories or grades!
      if (it.kind === 'memory' && state.privacyLocked) return false;
      if (isItemPrivateLocked(it, state.privacyLocked)) return false;
      return (it.dateIso === iso || it.dueIso === iso) && it.status !== 'cancelled' && it.status !== 'not_needed';
    });

    if (template === 'wysiwyg') {
      // Exact current state of the user's scroll! (§9.5 所见即所带)
      for (const s of renderer.segs || []) {
        if (s.roll) {
          const dA = days[s.from].date;
          const dB = days[s.to].date;
          const n = s.to - s.from + 1;
          rows.push({
            type: 'roll',
            label: `${s.position === 'past' ? '已卷起' : s.position === 'middle' ? '中间卷' : '未展开'} · ${dA.getMonth() + 1}/${dA.getDate()}–${dB.getMonth() + 1}/${dB.getDate()}（${n < 7 ? `${n}天` : `${Math.ceil(n / 7)}周`}）`,
          });
        } else {
          const d = days[s.i];
          const items = safeItemsForDay(d.iso);
          rows.push({
            type: 'day',
            day: d,
            modeName: s.modeName,
            detailLevel: s.mode,
            items,
          });
        }
      }
    } else if (template === 'next_week') {
      // Next 7 days starting from Sunday/Monday around Now
      for (let i = store.nowIdx; i < Math.min(days.length, store.nowIdx + 8); i++) {
        const d = days[i];
        rows.push({ type: 'day', day: d, modeName: '清单', detailLevel: 2, items: safeItemsForDay(d.iso) });
      }
    } else if (template === 'review_card') {
      // Exam & pending tasks review card
      const exams = state.items.filter((it) => !it.hiddenByStudent && it.kind === 'exam' && (it.dateIso || '') >= state.nowIso);
      const tasks = state.items.filter((it) => !it.hiddenByStudent && it.kind === 'task' && it.status !== 'done' && it.status !== 'not_needed' && it.status !== 'cancelled_by_source');
      const fogs = state.items.filter((it) => !it.hiddenByStudent && (it.form === 'fog' || it.form === 'day_fog'));
      rows.push({ type: 'card_group', title: '近期考试', items: exams });
      rows.push({ type: 'card_group', title: '尚未完结的任务（不含评价）', items: tasks });
      rows.push({ type: 'card_group', title: '时间待定（雾）', items: fogs });
    } else {
      // Blank Week Sheet (§9.5: usable even with zero imported data!)
      for (let i = store.nowIdx; i < Math.min(days.length, store.nowIdx + 7); i++) {
        const d = days[i];
        rows.push({ type: 'blank_day', day: d });
      }
    }
    return rows;
  }

  function renderPreviewHtml(rows) {
    const state = store.state;
    const cfg = state.config;
    const titleMap = {
      wysiwyg: '所见即所带 · 当前卷形态',
      next_week: '下周便携页',
      review_card: '考前折叠复习卡',
      blank_week: '空白周页（手写带回校）',
    };

    const bodyHtml = rows.map((r) => {
      if (r.type === 'roll') {
        return `<div class="pr-roll">${esc(r.label)}</div>`;
      }
      if (r.type === 'blank_day') {
        const d = r.day;
        return `
          <div class="pr-day blank">
            <div class="pr-date">周${WEEKDAY_LABELS[d.wd]} · ${d.date.getMonth() + 1}/${d.date.getDate()}</div>
            <div class="pr-lines">
              <div class="pr-cls">${d.school ? esc(d.clsGlyphs.split('').join('  ')) : '离校在家'}</div>
              <div class="pr-write-line"></div>
              <div class="pr-write-line"></div>
            </div>
          </div>
        `;
      }
      if (r.type === 'card_group') {
        return `
          <div class="pr-group">
            <div class="pr-group-title">${esc(r.title)}</div>
            ${r.items.length === 0 ? '<div class="pr-empty">暂无记录</div>' : r.items.map((it) => `
              <div class="pr-item">
                <span>□ ${esc(it.title)}</span>
                <span class="pr-meta">${esc(it.dateIso || it.dueLabel || '待定')}</span>
              </div>
            `).join('')}
          </div>
        `;
      }
      const d = r.day;
      return `
        <div class="pr-day level-${r.detailLevel}">
          <div class="pr-date">
            <strong>周${WEEKDAY_LABELS[d.wd]}</strong>
            <span>${d.date.getMonth() + 1}/${d.date.getDate()}</span>
            <small>${esc(r.modeName)}</small>
          </div>
          <div class="pr-content">
            ${d.school ? `<div class="pr-cls">${esc(d.clsGlyphs.split('').join('  '))}</div>` : '<div class="pr-cls">在家</div>'}
            ${r.items.length === 0 ? '<div class="pr-empty">（无特别标注）</div>' : r.items.map((it) => `
              <div class="pr-item">
                <span>${it.kind === 'exam' ? '◉' : '○'} ${esc(it.title)}</span>
                <span class="pr-meta">${esc(it.dueLabel || (it.startHour != null ? formatHour(it.startHour) : ''))}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="paper-sheet" id="printable-paper-sheet">
        <div class="pr-head">
          <div>
            <div class="pr-brand">一卷 · ${esc(cfg.schoolName)}</div>
            <div class="pr-title">${esc(titleMap[template])}</div>
          </div>
          <div class="pr-stamp">
            <div>${esc(state.nowIso)} 导出</div>
            <div>不含成绩与锁定私密记录</div>
          </div>
        </div>
        ${includeOneLiner ? `<div class="pr-oneliner">「${esc(includeOneLiner)}」</div>` : ''}
        <div class="pr-body">${bodyHtml}</div>
        <div class="pr-foot">返校参考：周日 ${formatHour(cfg.returnHour)}${cfg.returnVerified ? '' : '（待核实）'} · ${state.isDemoActive ? '含演示数据标注' : '个人本地记录'}</div>
      </div>
    `;
  }

  function exportPng(rows) {
    const W = 820;
    const rowEst = 140 + rows.length * 76 + (includeOneLiner ? 48 : 0);
    const H = Math.max(680, Math.min(2600, rowEst));
    const cv = document.createElement('canvas');
    cv.width = W * 2;
    cv.height = H * 2;
    const ctx = cv.getContext('2d');
    ctx.scale(2, 2);

    ctx.fillStyle = '#faf8f2';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#1f2421';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(24, 24, W - 48, H - 48);

    ctx.fillStyle = '#1f2421';
    ctx.font = '600 22px "Songti SC", "Noto Serif SC", serif';
    ctx.fillText(`一卷 · ${store.state.config.schoolName} · 带走纸页`, 46, 66);
    ctx.font = '400 12px -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = '#636862';
    ctx.fillText(`导出日 ${store.state.nowIso} · 不含成绩与锁定私密记录 · ${store.state.isDemoActive ? '含演示数据' : '个人记录'}`, 46, 90);

    let y = 114;
    if (includeOneLiner) {
      ctx.fillStyle = '#2a5ea8';
      ctx.font = '500 14px "Songti SC", serif';
      ctx.fillText(`「${includeOneLiner}」`, 46, y);
      y += 30;
    }

    ctx.strokeStyle = '#d4cec0';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(46, y); ctx.lineTo(W - 46, y); ctx.stroke();
    y += 22;

    for (const r of rows) {
      if (y > H - 64) break;
      if (r.type === 'roll') {
        ctx.fillStyle = '#ece6d8';
        ctx.fillRect(46, y - 14, W - 92, 26);
        ctx.fillStyle = '#5a5347';
        ctx.font = '500 12px -apple-system, "PingFang SC", sans-serif';
        ctx.fillText(r.label, 58, y + 3);
        y += 34;
      } else if (r.type === 'card_group') {
        ctx.fillStyle = '#1f2421';
        ctx.font = '600 14px -apple-system, "PingFang SC", sans-serif';
        ctx.fillText(r.title, 46, y);
        y += 22;
        for (const it of r.items.slice(0, 6)) {
          ctx.font = '400 13px -apple-system, "PingFang SC", sans-serif';
          ctx.fillStyle = '#2b302c';
          ctx.fillText(`□ ${it.title}   ${it.dateIso || it.dueLabel || '待定'}`, 60, y);
          y += 22;
        }
        y += 12;
      } else {
        const d = r.day;
        ctx.fillStyle = '#1f2421';
        ctx.font = '600 14px -apple-system, "PingFang SC", sans-serif';
        ctx.fillText(`周${WEEKDAY_LABELS[d.wd]} ${d.date.getMonth() + 1}/${d.date.getDate()}`, 46, y);
        ctx.fillStyle = '#636862';
        ctx.font = '400 12px -apple-system, "PingFang SC", sans-serif';
        ctx.fillText(d.school ? d.clsGlyphs.split('').join('  ') : '在家', 150, y);
        y += 20;
        if (r.type === 'blank_day') {
          ctx.strokeStyle = '#d4cec0';
          ctx.beginPath(); ctx.moveTo(150, y + 8); ctx.lineTo(W - 52, y + 8); ctx.stroke();
          y += 26;
        } else {
          for (const it of (r.items || []).slice(0, 4)) {
            ctx.fillStyle = '#1f2421';
            ctx.font = '400 13px -apple-system, "PingFang SC", sans-serif';
            ctx.fillText(`○ ${it.title}${it.dueLabel ? ` · ${it.dueLabel}` : ''}`, 150, y);
            y += 20;
          }
          y += 10;
        }
      }
    }

    cv.toBlob((blob) => {
      if (blob) {
        downloadBlob(blob, `haiz-yijuan-${template}-${store.state.nowIso}.png`);
        onToast('已生成高清带走纸页 PNG（全本地生成，不含成绩）。');
      }
    }, 'image/png');
  }

  function paint() {
    const rows = buildPrintableRows();
    container.innerHTML = `
      <div class="sheet-head">
        <div>
          <span class="eyebrow">带走 · 可选纸质导出（§9.5）</span>
          <h2>把你在卷上拉好的形态带回学校</h2>
        </div>
        <button class="icon-btn" data-close aria-label="关闭带走面板">✕</button>
      </div>
      <div class="sheet-body">
        <div class="chip-grid">
          <button class="chip ${template === 'wysiwyg' ? 'active' : ''}" data-tpl="wysiwyg">所见即所带（当前卷）</button>
          <button class="chip ${template === 'next_week' ? 'active' : ''}" data-tpl="next_week">下周页</button>
          <button class="chip ${template === 'review_card' ? 'active' : ''}" data-tpl="review_card">复习卡</button>
          <button class="chip ${template === 'blank_week' ? 'active' : ''}" data-tpl="blank_week">空白周页</button>
        </div>

        <div class="inline-form" style="margin-top:10px">
          <input type="text" data-oneliner value="${esc(includeOneLiner)}" placeholder="可选：在页眉印一句带给自己下周的话…">
        </div>

        <div class="takeaway-preview-frame">
          ${renderPreviewHtml(rows)}
        </div>

        <div class="btn-row" style="margin-top:12px">
          <button class="btn pri" data-export-print>打印 / 存为 PDF</button>
          <button class="btn" data-export-png>导出高清 PNG</button>
          <button class="btn" data-export-ics>导出日历 .ics</button>
        </div>
      </div>
    `;

    container.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', onClose));
    container.querySelectorAll('[data-tpl]').forEach((btn) => {
      btn.addEventListener('click', () => {
        template = btn.dataset.tpl;
        paint();
      });
    });

    const ol = container.querySelector('[data-oneliner]');
    if (ol) {
      ol.addEventListener('input', () => {
        includeOneLiner = ol.value;
        const preview = container.querySelector('.takeaway-preview-frame');
        if (preview) preview.innerHTML = renderPreviewHtml(buildPrintableRows());
      });
    }

    container.querySelector('[data-export-print]')?.addEventListener('click', () => {
      const mount = document.getElementById('print-stage');
      if (mount) mount.innerHTML = renderPreviewHtml(buildPrintableRows());
      window.print();
    });

    container.querySelector('[data-export-png]')?.addEventListener('click', () => {
      exportPng(buildPrintableRows());
    });

    container.querySelector('[data-export-ics]')?.addEventListener('click', () => {
      const ics = store.exportIcs();
      downloadBlob(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), `haiz-yijuan-${store.state.nowIso}.ics`);
      onToast('已导出标准 .ics（仅日期任务保留全天格式，不编造具体时刻）。');
    });
  }

  paint();
}
