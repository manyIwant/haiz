// NIANLUN 004 · Interactive paper panels: Day Operations, Extracted Exam Analytics Scroll,
// Absence Range Digest, Inline Ribbon Popover, Unified CRUD Editor, and Privacy/HAIZ Bridge Modal.

import {
  BELL_SCHEDULES, BUILDINGS, LAB_EXPERIMENTS, SUBJECT_LIST, GRADES, TODAY_ISO, subjectByName
} from './content.js';
import {
  LOSS_REASONS, itemsForDate, freeSlotsForDate, detectConflictsForDate,
  analyzeExam, compareExams, parseScoreImport, buildAbsenceDigest, fmtMin, parseMin, parseIso, suggestFreeSlot
} from './analytics.js';
import { createSupabaseBridgeBlueprint } from './store.js';
import { sound } from './sound.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

export function createPanels({ store, toast, onNavigateDate, onStateMutated, getActiveDateIso }) {
  const els = {
    dayBody: document.querySelector('#day-body'),
    dayTabs: [...document.querySelectorAll('.day-tabs button')],
    itemPop: document.querySelector('#item-pop'),
    examScroll: document.querySelector('#exam-scroll'),
    exTitle: document.querySelector('#ex-title'),
    exMeta: document.querySelector('#ex-meta'),
    exCompare: document.querySelector('#ex-compare-select'),
    exBody: document.querySelector('#ex-body'),
    exEditBtn: document.querySelector('#ex-edit-btn'),
    exImportBtn: document.querySelector('#ex-import-btn'),
    exCloseBtn: document.querySelector('#ex-close-btn'),
    abScroll: document.querySelector('#absence-scroll'),
    abTitle: document.querySelector('#ab-title'),
    abMeta: document.querySelector('#ab-meta'),
    abBody: document.querySelector('#ab-body'),
    abCloseBtn: document.querySelector('#ab-close-btn'),
    edModal: document.querySelector('#editor-modal'),
    edTitle: document.querySelector('#ed-title'),
    edBody: document.querySelector('#ed-body'),
    edClose: document.querySelector('#ed-close'),
    prModal: document.querySelector('#privacy-modal'),
    prBody: document.querySelector('#pr-body'),
    prClose: document.querySelector('#pr-close')
  };

  let activeDayTab = 'overview';
  let activeExamId = null;
  let compareExamId = '';
  let showImportBox = false;
  let activeAbsence = null;

  // ------------------------------------------------------------------ Day Operating Tabs
  els.dayTabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      activeDayTab = btn.dataset.dtab;
      els.dayTabs.forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
      renderDayBody(getActiveDateIso());
    });
  });

  function entryHTML(e) {
    const when = e.when === 'about' ? `${e.y} 年 ${e.m} 月 ${e.d} 日前后`
      : e.when === 'month' ? `${e.y} 年 ${e.m} 月（具体日期不详）`
      : `${e.y} 年 ${e.m} 月 ${e.d} 日`;
    const src = (e.sources || []).map((s) => (s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>` : esc(s.name))).join('、');
    const ph = e.photo ? `<figure><img src="${esc(e.photo.src)}" alt="${esc(e.photo.alt)}" loading="lazy"><figcaption>${esc(e.photo.credit)}</figcaption></figure>` : '';
    return `<article class="entry ${esc(e.kind)}"><p class="when">${when} · ${esc(GRADES[e.grade] || '')}</p><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p>${ph}<p class="src">来源：${src}</p></article>`;
  }

  function renderDayBody(dateIso) {
    if (!dateIso || !els.dayBody) return;
    const state = store.getState();
    const items = itemsForDate(state, dateIso);
    const freeSlots = freeSlotsForDate(state, dateIso, 25);
    const conflicts = detectConflictsForDate(state, dateIso);
    const p = parseIso(dateIso);

    if (activeDayTab === 'overview') {
      const conflictHTML = conflicts.length ? `
        <div class="paper-block" style="border-left:3px solid var(--seal)">
          <div class="pb-head"><h4>⚠ 时间冲突提示（${conflicts.length}）</h4></div>
          <ul class="pb-list">
            ${conflicts.map((c) => `
              <li class="pb-row conflict">
                <div class="pb-main">
                  <div class="pb-title">${esc(c.a.title)} × ${esc(c.b.title)}</div>
                  <div class="pb-sub">${fmtMin(c.startMinute)}–${fmtMin(c.endMinute)} 重叠 ${c.overlapMinutes} 分钟</div>
                </div>
                <div class="pb-acts">
                  <button type="button" class="mini-btn seal" data-act="resolve-conflict" data-id="${esc(c.a.kind === 'personal' ? c.a.id : c.b.id)}">一键顺延</button>
                </div>
              </li>
            `).join('')}
          </ul>
        </div>` : '';

      const summaryHTML = `
        <div class="paper-block">
          <div class="pb-head">
            <h4>当日时间切片</h4>
            <button type="button" class="mini-btn accent" data-act="quick-add" data-date="${esc(dateIso)}">+ 记一笔</button>
          </div>
          <p class="pb-sub" style="margin:0;color:var(--ink)">
            课程 <b>${items.courses.length}</b> 节 · 作业 <b>${items.tasks.length}</b> 项 · 个人日程 <b>${items.personal.length}</b> 项 · 空闲时段 <b>${freeSlots.length}</b> 段 · 考试 <b>${items.exams.length}</b> 场
          </p>
        </div>`;

      const histHTML = items.history.map(entryHTML).join('');
      const campusHTML = items.campus.map((n) => `
        <article class="paper-block">
          <div class="pb-head">
            <h4>${n.kind === 'growth' ? '叶 · 个人成长' : '校 · 校园通知'}${n.visibility === 'private' ? '<span class="priv-badge">仅本人可见</span>' : ''}${n.example ? '<span class="demo-badge">演示</span>' : ''}</h4>
            <button type="button" class="mini-btn danger" data-act="del-campus" data-id="${esc(n.id)}">删除</button>
          </div>
          <div class="pb-title">${esc(n.title)}</div>
          <p class="pb-sub">${esc(n.text)}${BUILDINGS[n.buildingId] ? ` · 地点：${esc(BUILDINGS[n.buildingId].name)}` : ''}</p>
        </article>`).join('');

      els.dayBody.innerHTML = conflictHTML + summaryHTML + histHTML + campusHTML;
    } else if (activeDayTab === 'schedule') {
      const bell = BELL_SCHEDULES[state.bellMode || 'summer'] || BELL_SCHEDULES.summer;
      els.dayBody.innerHTML = `
        <div class="paper-block">
          <div class="pb-head">
            <h4>星期${WEEK[p?.wd0 || 0]} 课表 · ${esc(bell.label.slice(0, 4))}</h4>
            <div class="pb-acts">
              <button type="button" class="mini-btn" data-act="toggle-bell">${state.bellMode === 'summer' ? '切冬季作息' : '切夏季作息'}</button>
              <button type="button" class="mini-btn accent" data-act="add-course" data-wd="${p?.weekday || 1}">+ 加一节课</button>
            </div>
          </div>
          <p class="pb-sub" style="margin:0 0 8px">${esc(bell.source)}</p>
          <ul class="pb-list">
            ${items.courses.length ? items.courses.map((c) => {
              const sub = subjectByName(c.subject);
              const bld = BUILDINGS[c.buildingId];
              const lab = LAB_EXPERIMENTS[c.labId];
              const linkedHw = (state.tasks || []).filter((t) => t.linkedCourseId === c.id || t.subject === c.subject).length;
              return `
                <li class="pb-row" style="border-left-color:${sub.color}">
                  <div class="pb-main">
                    <div class="pb-title">${fmtMin(c.startMinute)}–${fmtMin(c.endMinute)} · ${esc(c.name)}${c.example ? '<span class="demo-badge">演示</span>' : ''}</div>
                    <div class="pb-sub">
                      ${esc(c.room || bld?.name || '未填教室')}${c.teacher ? ` · ${esc(c.teacher)}` : ''}${linkedHw ? ` · 关联作业 ${linkedHw}` : ''}
                      ${lab ? ` · <a href="${esc(lab.url)}" target="_blank" rel="noopener">实验册：${esc(lab.title)}</a>` : ''}
                    </div>
                  </div>
                  <div class="pb-acts">
                    <button type="button" class="mini-btn" data-act="course-add-hw" data-id="${esc(c.id)}" data-date="${esc(dateIso)}">+作业</button>
                    <button type="button" class="mini-btn" data-act="edit-course" data-id="${esc(c.id)}">编辑</button>
                    <button type="button" class="mini-btn danger" data-act="del-course" data-id="${esc(c.id)}">删</button>
                  </div>
                </li>`;
            }).join('') : '<li class="pb-sub">今日无固定课程安排（可自由规划自习或休息）。</li>'}
          </ul>
        </div>`;
    } else if (activeDayTab === 'tasks') {
      els.dayBody.innerHTML = `
        <div class="paper-block">
          <div class="pb-head">
            <h4>纸 · 当日到期作业（${items.tasks.length}）</h4>
            <button type="button" class="mini-btn accent" data-act="add-task" data-date="${esc(dateIso)}">+ 新作业</button>
          </div>
          <ul class="pb-list">
            ${items.tasks.length ? items.tasks.map((t) => {
              const sub = subjectByName(t.subject);
              return `
                <li class="pb-row ${t.completed ? 'done' : ''}" style="border-left-color:${sub.color}">
                  <div class="pb-main">
                    <div class="pb-title">${esc(t.subject)} · ${esc(t.title)}${t.example ? '<span class="demo-badge">演示</span>' : ''}</div>
                    <div class="pb-sub">预计 ${t.estMinutes} 分钟${t.scheduledBlockId ? ' · 已排入个人日程' : ' · 未排日程'}${t.note ? ` · ${esc(t.note)}` : ''}</div>
                  </div>
                  <div class="pb-acts">
                    <button type="button" class="mini-btn" data-act="toggle-task" data-id="${esc(t.id)}">${t.completed ? '重开' : '✓完成'}</button>
                    <button type="button" class="mini-btn indigo" data-act="pin-task" data-id="${esc(t.id)}" data-date="${esc(dateIso)}">${t.scheduledBlockId ? '调时段' : '排入空闲'}</button>
                    <button type="button" class="mini-btn" data-act="edit-task" data-id="${esc(t.id)}">改</button>
                    <button type="button" class="mini-btn danger" data-act="del-task" data-id="${esc(t.id)}">删</button>
                  </div>
                </li>`;
            }).join('') : '<li class="pb-sub">今日暂无到期作业。</li>'}
          </ul>
        </div>
        <div class="paper-block">
          <div class="pb-head">
            <h4>靛 · 个人日程 <span class="priv-badge">仅本人可见</span></h4>
            <button type="button" class="mini-btn indigo" data-act="add-personal" data-date="${esc(dateIso)}">+ 新日程</button>
          </div>
          <ul class="pb-list">
            ${items.personal.length ? items.personal.map((b) => {
              const isCf = conflicts.some((c) => c.a.id === b.id || c.b.id === b.id);
              return `
                <li class="pb-row ${b.completed ? 'done' : ''} ${isCf ? 'conflict' : ''}" style="border-left-color:${isCf ? 'var(--seal)' : 'var(--indigo)'}">
                  <div class="pb-main">
                    <div class="pb-title">${fmtMin(b.startMinute)}–${fmtMin(b.endMinute)} · ${esc(b.title)}${b.example ? '<span class="demo-badge">演示</span>' : ''}</div>
                    <div class="pb-sub">${esc(b.note || '个人安排')}${isCf ? ' · ⚠ 与课程或考试时间冲突' : ''}</div>
                  </div>
                  <div class="pb-acts">
                    ${isCf ? `<button type="button" class="mini-btn seal" data-act="resolve-conflict" data-id="${esc(b.id)}">顺延</button>` : ''}
                    <button type="button" class="mini-btn" data-act="toggle-personal" data-id="${esc(b.id)}">${b.completed ? '重开' : '✓'}</button>
                    <button type="button" class="mini-btn" data-act="edit-personal" data-id="${esc(b.id)}">改</button>
                    <button type="button" class="mini-btn danger" data-act="del-personal" data-id="${esc(b.id)}">删</button>
                  </div>
                </li>`;
            }).join('') : '<li class="pb-sub">今日尚未安排个人计划。</li>'}
          </ul>
          ${freeSlots.length ? `<div class="pb-sub" style="margin-top:8px">可用空闲：${freeSlots.map((s) => `<button type="button" class="mini-btn" style="margin:2px 4px 0 0" data-act="fill-free" data-date="${esc(dateIso)}" data-start="${s.startMinute}" data-end="${s.endMinute}">+ ${esc(s.label)} ${fmtMin(s.startMinute)}–${fmtMin(s.endMinute)}</button>`).join('')}</div>` : ''}
        </div>`;
    } else if (activeDayTab === 'exams') {
      const allExams = (state.exams || []).slice().sort((a, b) => b.dateIso.localeCompare(a.dateIso));
      els.dayBody.innerHTML = `
        <div class="paper-block">
          <div class="pb-head">
            <h4>朱 · 考试与成绩档案 <span class="priv-badge">仅本人可见</span></h4>
            <button type="button" class="mini-btn seal" data-act="add-exam" data-date="${esc(dateIso)}">+ 记一场考试</button>
          </div>
          <ul class="pb-list">
            ${allExams.map((ex) => {
              const graded = ex.status === 'graded' && ex.scores?.length;
              const tot = graded ? Math.round(ex.scores.reduce((a, s) => a + Number(s.score || 0), 0)) : null;
              return `
                <li class="pb-row" style="border-left-color:var(--seal)">
                  <div class="pb-main">
                    <div class="pb-title">${esc(ex.title)}${ex.dateIso === dateIso ? '（当日）' : ''}${ex.example ? '<span class="demo-badge">演示</span>' : ''}</div>
                    <div class="pb-sub">${esc(ex.dateIso)} · ${fmtMin(ex.startMinute || 480)}–${fmtMin(ex.endMinute || 600)} · ${graded ? `总分 ${tot} · 错题 ${(ex.mistakes || []).length} 道` : '待考安排'}</div>
                  </div>
                  <div class="pb-acts">
                    <button type="button" class="mini-btn seal" data-act="open-exam" data-id="${esc(ex.id)}">抽出学情卷</button>
                  </div>
                </li>`;
            }).join('')}
          </ul>
        </div>
        <div class="paper-block">
          <div class="pb-head">
            <h4>叶 · 当日成长与校园记事</h4>
            <button type="button" class="mini-btn accent" data-act="add-campus" data-date="${esc(dateIso)}">+ 记一笔</button>
          </div>
          <ul class="pb-list">
            ${items.campus.length ? items.campus.map((n) => `
              <li class="pb-row" style="border-left-color:${n.kind === 'growth' ? 'var(--amber)' : 'var(--news)'}">
                <div class="pb-main">
                  <div class="pb-title">${esc(n.title)}${n.visibility === 'private' ? '<span class="priv-badge">私密</span>' : ''}</div>
                  <div class="pb-sub">${esc(n.text)}</div>
                </div>
                <div class="pb-acts"><button type="button" class="mini-btn danger" data-act="del-campus" data-id="${esc(n.id)}">删</button></div>
              </li>`).join('') : '<li class="pb-sub">今日尚无成长记录，点击右上角写下今天的收获。</li>'}
          </ul>
        </div>`;
    }
  }

  // Delegate actions inside Day Body
  els.dayBody?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const { act, id, date, wd, start, end } = btn.dataset;
    const state = store.getState();
    if (act === 'toggle-task') { store.toggleTask(id); sound.snap(); onStateMutated(); }
    else if (act === 'del-task') { store.deleteTask(id); toast('已删除作业'); onStateMutated(); }
    else if (act === 'pin-task') {
      const slot = suggestFreeSlot(state, date || TODAY_ISO, 40);
      store.scheduleTaskIntoSlot(id, slot);
      sound.snap();
      toast(`已排入 ${slot.dateIso} ${slot.label}（${fmtMin(slot.startMinute)}–${fmtMin(slot.endMinute)}）`);
      onStateMutated();
    }
    else if (act === 'edit-task') openEditor('task', state.tasks.find((x) => x.id === id));
    else if (act === 'add-task') openEditor('task', { dueIso: date || getActiveDateIso() });
    else if (act === 'toggle-personal') { store.togglePersonal(id); sound.snap(); onStateMutated(); }
    else if (act === 'del-personal') { store.deletePersonal(id); toast('已删除个人日程'); onStateMutated(); }
    else if (act === 'edit-personal') openEditor('personal', state.personal.find((x) => x.id === id));
    else if (act === 'add-personal') openEditor('personal', { dateIso: date || getActiveDateIso() });
    else if (act === 'fill-free') openEditor('personal', { dateIso: date, startMinute: Number(start), endMinute: Number(end) });
    else if (act === 'resolve-conflict') {
      const res = store.resolveConflict(id);
      if (res) { sound.snap(); toast(`已顺延至 ${res.slot.dateIso} ${res.slot.label} ${fmtMin(res.slot.startMinute)}`); onStateMutated(); }
    }
    else if (act === 'toggle-bell') {
      store.setBellMode(state.bellMode === 'summer' ? 'winter' : 'summer');
      sound.bamboo(); toast(`已切换为${store.getState().bellMode === 'summer' ? '夏季' : '冬季'}作息`); onStateMutated();
    }
    else if (act === 'add-course') openEditor('course', { weekday: Number(wd) || 1 });
    else if (act === 'edit-course') openEditor('course', state.courses.find((x) => x.id === id));
    else if (act === 'del-course') { store.deleteCourse(id); toast('已删除课程'); onStateMutated(); }
    else if (act === 'course-add-hw') {
      const c = state.courses.find((x) => x.id === id);
      openEditor('task', { subject: c?.subject || '数学', linkedCourseId: id, dueIso: date || TODAY_ISO, labId: c?.labId || '' });
    }
    else if (act === 'add-exam') openEditor('exam', { dateIso: date || getActiveDateIso() });
    else if (act === 'open-exam') openExamScroll(id);
    else if (act === 'add-campus') openEditor('campus', { dateIso: date || getActiveDateIso(), kind: 'growth' });
    else if (act === 'del-campus') { store.deleteCampusNote(id); toast('已删除记录'); onStateMutated(); }
    else if (act === 'quick-add') openEditor('task', { dueIso: date || getActiveDateIso() });
  });

  // ------------------------------------------------------------------ Inline Popover on Ribbons
  function closePopover() { els.itemPop.hidden = true; els.itemPop.innerHTML = ''; }

  function openItemPopover(hit, px, py) {
    const state = store.getState();
    let html = '';
    if (hit.kind === 'task') {
      const t = hit.item;
      html = `
        <p class="pop-k"><span>纸 · 作业待办${t.example ? '（演示）' : ''}</span><span>${esc(t.dueIso)}</span></p>
        <h3>${esc(t.subject)} · ${esc(t.title)}</h3>
        <p class="pop-meta">预计 ${t.estMinutes} 分钟 · ${t.completed ? '已完成' : '待完成'}${t.scheduledBlockId ? ' · 已关联日程' : ' · 可拖入靛布日程带空闲时段'}<br>${esc(t.note || '')}</p>
        <div class="pop-actions">
          <button type="button" class="primary" data-pop="toggle-task" data-id="${esc(t.id)}">${t.completed ? '标为未完成' : '✓ 标为完成'}</button>
          <button type="button" data-pop="pin-task" data-id="${esc(t.id)}">排入空闲时段</button>
          <button type="button" data-pop="edit-task" data-id="${esc(t.id)}">编辑</button>
          <button type="button" class="danger" data-pop="del-task" data-id="${esc(t.id)}">删除</button>
        </div>`;
    } else if (hit.kind === 'course') {
      const c = hit.item;
      const bld = BUILDINGS[c.buildingId];
      const lab = LAB_EXPERIMENTS[c.labId];
      const relTasks = (state.tasks || []).filter((t) => t.linkedCourseId === c.id || t.subject === c.subject);
      html = `
        <p class="pop-k"><span>竹 · 课程${c.example ? '（演示）' : ''}</span><span>${fmtMin(c.startMinute)}–${fmtMin(c.endMinute)}</span></p>
        <h3>${esc(c.name)}</h3>
        <p class="pop-meta">教室：${esc(c.room || bld?.name || '—')} ${c.teacher ? `· ${esc(c.teacher)}` : ''}<br>关联本学科作业：${relTasks.length} 项${lab ? `<br>关联实验册：${esc(lab.title)}` : ''}</p>
        <div class="pop-actions">
          <button type="button" class="primary" data-pop="course-add-hw" data-id="${esc(c.id)}" data-date="${esc(hit.dateIso)}">+ 布置关联作业</button>
          <button type="button" data-pop="edit-course" data-id="${esc(c.id)}">编辑课程</button>
          ${lab ? `<a href="${esc(lab.url)}" target="_blank" rel="noopener">打开实验册</a>` : ''}
          <button type="button" class="danger" data-pop="del-course" data-id="${esc(c.id)}">删除</button>
        </div>`;
    } else if (hit.kind === 'personal') {
      const b = hit.item;
      html = `
        <p class="pop-k"><span>靛 · 个人日程（仅本人可见）</span><span>${esc(b.dateIso)} ${fmtMin(b.startMinute)}–${fmtMin(b.endMinute)}</span></p>
        <h3>${hit.hasConflict ? '⚠ ' : ''}${esc(b.title)}</h3>
        <p class="pop-meta">${hit.hasConflict ? '与当日考试或课程时间冲突！可一键顺延至空闲时段。<br>' : ''}${esc(b.note || '')}</p>
        <div class="pop-actions">
          ${hit.hasConflict ? `<button type="button" class="primary" style="background:var(--seal);border-color:var(--seal)" data-pop="resolve-conflict" data-id="${esc(b.id)}">一键顺延解冲突</button>` : ''}
          <button type="button" data-pop="toggle-personal" data-id="${esc(b.id)}">${b.completed ? '重开' : '✓ 完成'}</button>
          <button type="button" data-pop="edit-personal" data-id="${esc(b.id)}">编辑</button>
          <button type="button" class="danger" data-pop="del-personal" data-id="${esc(b.id)}">删除</button>
        </div>`;
    } else if (hit.kind === 'free-slot') {
      const s = hit.slot;
      const unscheduled = (state.tasks || []).filter((t) => !t.completed && !t.scheduledBlockId).slice(0, 3);
      html = `
        <p class="pop-k"><span>靛 · 可用空闲时段</span><span>${esc(s.dateIso)}</span></p>
        <h3>${esc(s.label)}（${fmtMin(s.startMinute)}–${fmtMin(s.endMinute)}）</h3>
        <p class="pop-meta">自动扣除海南中学作息、课表、考试与已有日程后空出 ${s.duration} 分钟。</p>
        <div class="pop-actions">
          <button type="button" class="primary" data-pop="fill-free" data-date="${esc(s.dateIso)}" data-start="${s.startMinute}" data-end="${s.endMinute}">+ 安排个人计划</button>
          ${unscheduled.map((t) => `<button type="button" data-pop="slot-task" data-id="${esc(t.id)}" data-date="${esc(s.dateIso)}" data-start="${s.startMinute}">排入：${esc(t.subject)}·${esc(t.title.slice(0, 7))}</button>`).join('')}
        </div>`;
    } else if (hit.kind === 'campus') {
      const n = hit.item;
      html = `
        <p class="pop-k"><span>${n.kind === 'growth' ? '叶 · 个人成长（仅本人可见）' : '校 · 校园通知'}</span><span>${esc(n.dateIso)}</span></p>
        <h3>${esc(n.title)}</h3>
        <p class="pop-meta">${esc(n.text)}${BUILDINGS[n.buildingId] ? `<br>地点：${esc(BUILDINGS[n.buildingId].name)}` : ''}</p>
        <div class="pop-actions">
          <button type="button" class="primary" data-pop="open-day" data-date="${esc(n.dateIso)}">展开这一天</button>
          <button type="button" class="danger" data-pop="del-campus" data-id="${esc(n.id)}">删除</button>
        </div>`;
    }
    if (!html) return;
    els.itemPop.innerHTML = html;
    els.itemPop.hidden = false;
    const popW = Math.min(310, innerWidth - 24);
    const left = Math.max(12, Math.min(innerWidth - popW - 12, px - popW / 2));
    const top = py > innerHeight * 0.62 ? Math.max(70, py - 190) : Math.min(innerHeight - 210, py + 18);
    els.itemPop.style.left = `${left}px`;
    els.itemPop.style.top = `${top}px`;
  }

  els.itemPop?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pop]');
    if (!btn) return;
    const { pop, id, date, start, end } = btn.dataset;
    const state = store.getState();
    closePopover();
    if (pop === 'toggle-task') { store.toggleTask(id); sound.snap(); onStateMutated(); }
    else if (pop === 'pin-task') {
      const t = state.tasks.find((x) => x.id === id);
      const slot = suggestFreeSlot(state, t?.dueIso || TODAY_ISO, t?.estMinutes || 40);
      store.scheduleTaskIntoSlot(id, slot); sound.snap();
      toast(`已排入 ${slot.dateIso} ${slot.label} ${fmtMin(slot.startMinute)}`); onStateMutated();
    }
    else if (pop === 'slot-task') {
      const t = state.tasks.find((x) => x.id === id);
      store.scheduleTaskIntoSlot(id, { dateIso: date, startMinute: Number(start), endMinute: Number(start) + (t?.estMinutes || 40) });
      sound.snap(); toast('已将作业排入该空闲时段'); onStateMutated();
    }
    else if (pop === 'edit-task') openEditor('task', state.tasks.find((x) => x.id === id));
    else if (pop === 'del-task') { store.deleteTask(id); toast('已删除作业'); onStateMutated(); }
    else if (pop === 'course-add-hw') {
      const c = state.courses.find((x) => x.id === id);
      openEditor('task', { subject: c?.subject || '数学', linkedCourseId: id, dueIso: date || TODAY_ISO, labId: c?.labId || '' });
    }
    else if (pop === 'edit-course') openEditor('course', state.courses.find((x) => x.id === id));
    else if (pop === 'del-course') { store.deleteCourse(id); toast('已删除课程'); onStateMutated(); }
    else if (pop === 'resolve-conflict') {
      const res = store.resolveConflict(id);
      if (res) { sound.snap(); toast(`冲突已化解：顺延至 ${res.slot.dateIso} ${res.slot.label}`); onStateMutated(); }
    }
    else if (pop === 'toggle-personal') { store.togglePersonal(id); sound.snap(); onStateMutated(); }
    else if (pop === 'edit-personal') openEditor('personal', state.personal.find((x) => x.id === id));
    else if (pop === 'del-personal') { store.deletePersonal(id); toast('已删除日程'); onStateMutated(); }
    else if (pop === 'fill-free') openEditor('personal', { dateIso: date, startMinute: Number(start), endMinute: Number(end) });
    else if (pop === 'del-campus') { store.deleteCampusNote(id); toast('已删除记录'); onStateMutated(); }
    else if (pop === 'open-day') onNavigateDate(date, true);
  });

  // ------------------------------------------------------------------ Extracted Exam Analytics Scroll
  function openExamScroll(examId) {
    const state = store.getState();
    const ex = state.exams.find((e) => e.id === examId);
    if (!ex) return;
    activeExamId = examId;
    showImportBox = false;
    // Default compare to the immediately preceding graded exam
    const graded = state.exams.filter((e) => e.status === 'graded' && e.scores?.length).sort((a, b) => a.dateIso.localeCompare(b.dateIso));
    const idx = graded.findIndex((e) => e.id === examId);
    compareExamId = idx > 0 ? graded[idx - 1].id : '';
    sound.seal();
    renderExamScroll();
    els.examScroll.hidden = false;
  }

  function closeExamScroll() {
    els.examScroll.hidden = true;
    activeExamId = null;
  }

  function renderExamScroll() {
    if (!activeExamId) return;
    const state = store.getState();
    const ex = state.exams.find((e) => e.id === activeExamId);
    if (!ex) { closeExamScroll(); return; }
    const gradedOthers = state.exams.filter((e) => e.id !== ex.id && e.status === 'graded' && e.scores?.length);
    const cmpEx = gradedOthers.find((e) => e.id === compareExamId) || null;
    const analysis = analyzeExam(ex, cmpEx);
    const cmp = cmpEx && analysis.hasScores ? compareExams(cmpEx, ex) : null;

    els.exTitle.textContent = ex.title + (ex.example ? '（演示）' : '');
    els.exMeta.textContent = `${ex.dateIso} · ${fmtMin(ex.startMinute || 480)}–${fmtMin(ex.endMinute || 600)} · ${ex.room || BUILDINGS[ex.buildingId]?.name || '考场待定'}${ex.note ? ` · ${ex.note}` : ''}`;

    els.exCompare.innerHTML = `<option value="">不对比历次考试</option>` +
      gradedOthers.map((o) => `<option value="${esc(o.id)}" ${o.id === compareExamId ? 'selected' : ''}>对比：${esc(o.title)}</option>`).join('');
    els.exCompare.style.display = analysis.hasScores && gradedOthers.length ? '' : 'none';

    const importHTML = showImportBox ? `
      <div class="ex-panel" style="margin-top:14px">
        <h3>粘贴或导入本次成绩（本地解析，绝不上传第三方）</h3>
        <p class="pb-sub" style="margin:0 0 8px">支持 CSV / 表格粘贴（每行：<code>科目,得分,满分,班级均分,年级百分位</code>）或 JSON 数组。</p>
        <div class="form-field full">
          <textarea id="ex-import-ta" placeholder="语文,121,150,111,83&#10;数学,128,150,108,86&#10;英语,134,150,118,89&#10;物理,81,100,71,77&#10;化学,85,100,74,85&#10;生物,88,100,76,88"></textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="mini-btn" data-ex="fill-sample-csv">填入示例成绩</button>
          <button type="button" class="mini-btn" data-ex="cancel-import">取消</button>
          <button type="button" class="mini-btn seal" data-ex="apply-import">解析并保存成绩</button>
        </div>
      </div>` : '';

    const kpiHTML = analysis.hasScores ? `
      <div class="ex-kpis">
        <div class="ex-kpi"><small>原始总分 / 满分</small><strong>${analysis.total}<span style="font-size:13px;color:var(--ink-2)"> / ${analysis.fullTotal}</span></strong></div>
        <div class="ex-kpi"><small>较上次进退步</small><strong class="${analysis.deltaTotal == null ? '' : analysis.deltaTotal >= 0 ? 'delta-up' : 'delta-down'}">${analysis.deltaTotal == null ? '首次' : (analysis.deltaTotal >= 0 ? '+' : '') + analysis.deltaTotal}</strong></div>
        <div class="ex-kpi"><small>学科均衡稳健度</small><strong>${analysis.stability}<span style="font-size:13px;color:var(--ink-2)"> / 100</span></strong></div>
        <div class="ex-kpi"><small>标准分参考估算*</small><strong>${analysis.standardEst}</strong></div>
        <div class="ex-kpi"><small>易拿回失分（审题/计算）</small><strong class="delta-down">${analysis.recoverableLost}<span style="font-size:13px;color:var(--ink-2)"> 分</span></strong></div>
      </div>
      <p class="pb-sub" style="margin:6px 0 0">* 借鉴智学网学情诊断思路的本地个人估算，标准分参考仅按录入百分位/得分率换算，不代表海南省考试局官方赋分。</p>
      <div class="ex-grid">
        <div class="ex-panel">
          <h3>墨韵学科均衡与对比</h3>
          <canvas id="ex-balance-canvas"></canvas>
          <p class="pb-sub" style="margin:6px 0 0">优势科：<b>${analysis.strengths.join('、')}</b> · 优先提分：<b>${analysis.priorities.join('、')}</b>（竖线为班级均分${cmp ? '，虚圈为对比考试' : ''}）</p>
        </div>
        <div class="ex-panel">
          <h3>失分归因拆解（共记录 ${analysis.totalLostFromMistakes} 分）</h3>
          ${analysis.lossBreakdown.length ? `<div class="loss-bars">${analysis.lossBreakdown.map((r) => `
            <div class="loss-bar-row">
              <div class="loss-bar-top"><span>${esc(r.reason)}${r.recoverable ? '（易拿回）' : ''}</span><b>-${r.lost} 分（${r.count} 题）</b></div>
              <div class="loss-track"><div class="loss-fill ${r.recoverable ? 'rec' : ''}" style="width:${Math.round((r.lost / Math.max(1, analysis.totalLostFromMistakes)) * 100)}%"></div></div>
            </div>`).join('')}</div>` : '<p class="pb-sub">录入下方错题后，自动生成失分归因矩阵。</p>'}
          ${analysis.weakTopics.length ? `<p class="pb-sub" style="margin-top:10px">高频薄弱点：${analysis.weakTopics.slice(0, 3).map((t) => `<b>${esc(t.subject)}·${esc(t.topic)}</b>(-${t.lost})`).join('；')}</p>` : ''}
        </div>
      </div>
      <div class="ex-panel" style="margin-top:14px">
        <div class="pb-head"><h3>各科成绩明细</h3><button type="button" class="mini-btn" data-ex="open-import">批量更新/导入</button></div>
        <table class="score-table">
          <thead><tr><th>学科</th><th>得分</th><th>得分率</th><th>班均</th><th>百分位</th>${cmp ? '<th>较对比</th>' : ''}<th>诊断</th></tr></thead>
          <tbody>
            ${analysis.subjects.map((s) => `
              <tr>
                <td><b style="color:${s.meta.color}">${esc(s.subject)}</b></td>
                <td><b>${s.score}</b> / ${s.full}</td>
                <td>${Math.round(s.rate * 100)}%</td>
                <td>${s.classAvg ?? '—'}</td>
                <td>${s.percentile != null ? `前 ${100 - s.percentile}%` : '—'}</td>
                ${cmp ? `<td class="${s.delta == null ? '' : s.delta >= 0 ? 'tag-strength' : 'tag-focus'}">${s.delta == null ? '—' : (s.delta >= 0 ? '+' : '') + s.delta}</td>` : ''}
                <td class="${s.tag === '优势科' ? 'tag-strength' : s.tag === '优先提分' ? 'tag-focus' : 'tag-steady'}">${s.tag}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : `
      <div class="ex-panel" style="margin-top:14px">
        <h3>待考安排 · 尚未出分</h3>
        <p class="pb-sub">考后点击上方「导入成绩」即可粘贴各科分数生成学情均衡分析，并录入错题转化为复习计划。</p>
      </div>`;

    const mistakes = ex.mistakes || [];
    const mistakesHTML = `
      <div class="ex-panel" style="margin-top:14px">
        <div class="pb-head">
          <h3>试题错题与知识点复盘（${mistakes.length}）</h3>
          <button type="button" class="mini-btn seal" data-ex="toggle-add-mistake">+ 录入一道错题</button>
        </div>
        <div id="ex-new-mistake" hidden style="margin-bottom:12px;padding:10px;border-radius:8px;background:rgba(239,232,218,0.65)">
          <div class="form-grid" style="margin-top:0">
            <div class="form-field"><label>学科</label><select id="nm-sub">${SUBJECT_LIST.slice(0, 9).map((s) => `<option value="${s.name}">${s.name}</option>`).join('')}</select></div>
            <div class="form-field"><label>题号</label><input id="nm-qno" placeholder="例如：第 15 题(2)"></div>
            <div class="form-field"><label>失分</label><input id="nm-lost" type="number" min="1" max="50" value="6"></div>
            <div class="form-field"><label>失分原因</label><select id="nm-reason">${LOSS_REASONS.map((r) => `<option value="${r}">${r}</option>`).join('')}</select></div>
            <div class="form-field full"><label>知识点</label><input id="nm-topic" placeholder="例如：电磁感应双杆动量守恒"></div>
            <div class="form-field full"><label>错因与订正笔记</label><input id="nm-note" placeholder="写下下次避坑检查步骤"></div>
          </div>
          <div class="form-actions"><button type="button" class="mini-btn seal" data-ex="save-mistake">保存错题</button></div>
        </div>
        <ul class="pb-list">
          ${mistakes.length ? mistakes.map((m) => {
            const sub = subjectByName(m.subject);
            const lab = LAB_EXPERIMENTS[m.labId];
            const revCnt = (m.reviewIds || []).length;
            return `
              <li class="pb-row ${m.mastered ? 'done' : ''}" style="border-left-color:${sub.color}">
                <div class="pb-main">
                  <div class="pb-title">${esc(m.subject)} · ${esc(m.qNo)}（−${m.lost}分 · ${esc(m.reason)}）· ${esc(m.topic)}</div>
                  <div class="pb-sub">${esc(m.note || '')}${lab ? ` · <a href="${esc(lab.url)}" target="_blank" rel="noopener">关联实验册：${esc(lab.title)}</a>` : ''}${revCnt ? ` · 已生成 ${revCnt} 次复习日程` : ''}</div>
                </div>
                <div class="pb-acts">
                  <button type="button" class="mini-btn indigo" data-ex="mistake-review" data-mid="${esc(m.id)}">转 1-3-7 天复习</button>
                  <button type="button" class="mini-btn" data-ex="toggle-mastered" data-mid="${esc(m.id)}">${m.mastered ? '未攻克' : '✓已攻克'}</button>
                  <button type="button" class="mini-btn danger" data-ex="del-mistake" data-mid="${esc(m.id)}">删</button>
                </div>
              </li>`;
          }).join('') : '<li class="pb-sub">尚未录入错题。记录错题后可一键生成 1-3-7 天艾宾浩斯复习计划并写入时间带。</li>'}
        </ul>
      </div>`;

    els.exBody.innerHTML = importHTML + kpiHTML + mistakesHTML;
    if (analysis.hasScores) drawBalanceChart(analysis, cmp);
  }

  function drawBalanceChart(analysis, cmp) {
    const canvas = document.querySelector('#ex-balance-canvas');
    if (!canvas) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = canvas.clientWidth || 380, h = 210;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const subs = analysis.subjects;
    const left = 46, right = w - 42, top = 14, rowH = Math.min(30, (h - 28) / Math.max(1, subs.length));
    const cmpMap = new Map((cmp?.rows || []).map((r) => [r.subject, r]));

    // Subtle 60% / 80% / 100% ink reference hairlines
    ctx.strokeStyle = 'rgba(84, 62, 38, 0.12)';
    ctx.lineWidth = 1;
    [0.6, 0.8, 1.0].forEach((r) => {
      const x = left + (right - left) * r;
      ctx.beginPath(); ctx.moveTo(x, top - 4); ctx.lineTo(x, top + subs.length * rowH); ctx.stroke();
      ctx.fillStyle = 'rgba(109, 97, 82, 0.65)';
      ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(r * 100)}%`, x, top + subs.length * rowH + 12);
    });

    subs.forEach((s, i) => {
      const y = top + i * rowH;
      const barH = Math.max(10, rowH - 10);
      const bw = (right - left) * Math.min(1, s.rate);
      // Subject label
      ctx.fillStyle = '#2b241c'; ctx.font = '600 12px "Songti SC", serif';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(s.subject, left - 8, y + barH / 2 + 1);
      // Paper track
      ctx.fillStyle = 'rgba(84, 62, 38, 0.08)';
      ctx.beginPath(); ctx.roundRect(left, y, right - left, barH, 4); ctx.fill();
      // Mineral pigment bar
      ctx.fillStyle = s.meta.color;
      ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.roundRect(left, y, bw, barH, 4); ctx.fill();
      ctx.globalAlpha = 1;
      // Class average vertical ink tick
      if (s.avgRate != null) {
        const ax = left + (right - left) * Math.min(1, s.avgRate);
        ctx.strokeStyle = '#2b241c'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ax, y - 2); ctx.lineTo(ax, y + barH + 2); ctx.stroke();
      }
      // Compare exam ghost marker
      const cr = cmpMap.get(s.subject);
      if (cr?.scoreA != null) {
        const cx = left + (right - left) * Math.min(1, cr.scoreA / s.full);
        ctx.strokeStyle = '#a83425'; ctx.lineWidth = 1.5; ctx.fillStyle = '#f8f2e6';
        ctx.beginPath(); ctx.arc(cx, y + barH / 2, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      // Numeric score
      ctx.fillStyle = '#2b241c'; ctx.font = '500 11.5px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${s.score}`, right + 6, y + barH / 2 + 1);
    });
  }

  els.exCompare?.addEventListener('change', () => { compareExamId = els.exCompare.value; renderExamScroll(); });
  els.exCloseBtn?.addEventListener('click', closeExamScroll);
  els.exImportBtn?.addEventListener('click', () => { showImportBox = !showImportBox; renderExamScroll(); });
  els.exEditBtn?.addEventListener('click', () => {
    const ex = store.getState().exams.find((e) => e.id === activeExamId);
    if (ex) openEditor('exam', ex);
  });
  els.exBody?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-ex]');
    if (!btn || !activeExamId) return;
    const act = btn.dataset.ex;
    if (act === 'open-import') { showImportBox = true; renderExamScroll(); }
    else if (act === 'cancel-import') { showImportBox = false; renderExamScroll(); }
    else if (act === 'fill-sample-csv') {
      const ta = document.querySelector('#ex-import-ta');
      if (ta) ta.value = '语文,123,150,112,84\n数学,129,150,109,87\n英语,135,150,119,90\n物理,84,100,72,81\n化学,87,100,75,86\n生物,89,100,77,89';
    }
    else if (act === 'apply-import') {
      const ta = document.querySelector('#ex-import-ta');
      const res = parseScoreImport(ta?.value || '');
      if (!res.ok) { toast(res.error); return; }
      store.upsertExamScores(activeExamId, res.scores);
      showImportBox = false;
      sound.snap(); toast(`已导入 ${res.scores.length} 科成绩并刷新学情分析`);
      renderExamScroll(); onStateMutated();
    }
    else if (act === 'toggle-add-mistake') {
      const box = document.querySelector('#ex-new-mistake');
      if (box) box.hidden = !box.hidden;
    }
    else if (act === 'save-mistake') {
      const topic = document.querySelector('#nm-topic')?.value.trim();
      if (!topic) { toast('请填写知识点'); return; }
      store.addMistake(activeExamId, {
        subject: document.querySelector('#nm-sub')?.value || '物理',
        qNo: document.querySelector('#nm-qno')?.value || '第 1 题',
        lost: Number(document.querySelector('#nm-lost')?.value || 5),
        reason: document.querySelector('#nm-reason')?.value || '概念不清',
        topic,
        note: document.querySelector('#nm-note')?.value || ''
      });
      sound.snap(); toast('已录入错题'); renderExamScroll(); onStateMutated();
    }
    else if (act === 'mistake-review') {
      const created = store.convertMistakeToReviews(activeExamId, btn.dataset.mid, { baseDateIso: TODAY_ISO, intervals: [1, 3, 7] });
      sound.snap();
      toast(`已生成 ${created.length} 次复习日程（${created.map((c) => c.block.dateIso.slice(5)).join(' / ')}）并写入时间带`);
      renderExamScroll(); onStateMutated();
    }
    else if (act === 'toggle-mastered') {
      store.toggleMistakeMastered(activeExamId, btn.dataset.mid);
      sound.snap(); renderExamScroll(); onStateMutated();
    }
    else if (act === 'del-mistake') {
      store.deleteMistake(activeExamId, btn.dataset.mid);
      toast('已删除错题'); renderExamScroll(); onStateMutated();
    }
  });

  // ------------------------------------------------------------------ Absence Range Digest Scroll
  function openAbsenceDigest(startIso, endIso) {
    activeAbsence = { startIso: startIso <= endIso ? startIso : endIso, endIso: startIso <= endIso ? endIso : startIso };
    renderAbsenceDigest();
    els.abScroll.hidden = false;
  }
  function closeAbsenceDigest() { els.abScroll.hidden = true; activeAbsence = null; }

  function renderAbsenceDigest() {
    if (!activeAbsence) return;
    const digest = buildAbsenceDigest(store.getState(), activeAbsence.startIso, activeAbsence.endIso);
    els.abTitle.textContent = `缺席补课单 · 共 ${digest.spanDays} 天`;
    els.abMeta.textContent = `${digest.startIso} 至 ${digest.endIso} · 错过课程 ${digest.missedCourses.length} 节 · 作业 ${digest.missedTasks.length} 项 · 考试 ${digest.missedExams.length} 场 · 通知 ${digest.missedNotices.length} 条`;

    els.abBody.innerHTML = `
      <div class="form-grid" style="margin-top:12px">
        <div class="form-field"><label>缺席开始日期</label><input type="date" id="ab-start" value="${esc(digest.startIso)}"></div>
        <div class="form-field"><label>缺席结束日期</label><input type="date" id="ab-end" value="${esc(digest.endIso)}"></div>
      </div>
      <div class="paper-block" style="margin-top:12px">
        <div class="pb-head">
          <h4>错过的课程（${digest.missedCourses.length} 节）</h4>
          <button type="button" class="mini-btn indigo" id="ab-catchup-btn">一键排入补学日程</button>
        </div>
        <p class="pb-sub" style="margin:0 0 8px">按学科汇总：${digest.courseSummary.length ? digest.courseSummary.map((s) => `<b>${esc(s.subject)}</b> ${s.count} 节`).join(' · ') : '该区间无固定课程'}</p>
        <ul class="pb-list">
          ${digest.missedCourses.slice(0, 10).map((c) => `<li class="pb-row"><div class="pb-main"><div class="pb-title">${esc(c.dateIso)} ${fmtMin(c.startMinute)} · ${esc(c.name)}</div><div class="pb-sub">${esc(c.room || '')}</div></div></li>`).join('')}
          ${digest.missedCourses.length > 10 ? `<li class="pb-sub">…其余 ${digest.missedCourses.length - 10} 节已计入上方按科汇总</li>` : ''}
        </ul>
      </div>
      <div class="paper-block">
        <div class="pb-head"><h4>区间内作业与考试（${digest.missedTasks.length + digest.missedExams.length}）</h4></div>
        <ul class="pb-list">
          ${digest.missedExams.map((e) => `<li class="pb-row conflict"><div class="pb-main"><div class="pb-title">朱印考试：${esc(e.title)}</div><div class="pb-sub">${esc(e.dateIso)} · ${esc(e.room || '')}</div></div></li>`).join('')}
          ${digest.missedTasks.map((t) => `<li class="pb-row"><div class="pb-main"><div class="pb-title">${esc(t.subject)} · ${esc(t.title)}</div><div class="pb-sub">截止 ${esc(t.dueIso)} · ${t.completed ? '已完成' : '待补交'}</div></div></li>`).join('')}
          ${!digest.missedTasks.length && !digest.missedExams.length ? '<li class="pb-sub">该区间无截止作业或考试。</li>' : ''}
        </ul>
      </div>
      <div class="paper-block">
        <div class="pb-head"><h4>校园通知（${digest.missedNotices.length}）</h4></div>
        <ul class="pb-list">
          ${digest.missedNotices.length ? digest.missedNotices.map((n) => `<li class="pb-row" style="border-left-color:var(--news)"><div class="pb-main"><div class="pb-title">${esc(n.dateIso)} · ${esc(n.title)}</div><div class="pb-sub">${esc(n.text)}</div></div></li>`).join('') : '<li class="pb-sub">该区间无校园通知。</li>'}
        </ul>
      </div>`;

    document.querySelector('#ab-start')?.addEventListener('change', (e) => { activeAbsence.startIso = e.target.value; renderAbsenceDigest(); });
    document.querySelector('#ab-end')?.addEventListener('change', (e) => { activeAbsence.endIso = e.target.value; renderAbsenceDigest(); });
    document.querySelector('#ab-catchup-btn')?.addEventListener('click', () => {
      const created = store.scheduleAbsenceCatchup(digest.startIso, digest.endIso, TODAY_ISO);
      sound.snap();
      toast(created.length ? `已为 ${created.length} 个学科自动排入补学日程` : '该区间没有需要补学的课程');
      closeAbsenceDigest();
      onStateMutated();
    });
  }
  els.abCloseBtn?.addEventListener('click', closeAbsenceDigest);

  // ------------------------------------------------------------------ Unified CRUD Editor Modal
  function openEditor(kind = 'task', initial = {}) {
    const isEdit = !!initial?.id;
    let curKind = kind;
    const renderForm = () => {
      els.edTitle.textContent = isEdit ? '编辑记录' : '新增时间记录';
      const tabs = isEdit ? '' : `
        <div class="form-tabs">
          ${[['task', '纸·作业'], ['personal', '靛·日程'], ['course', '竹·课程'], ['exam', '朱·考试'], ['campus', '叶·成长/通知']].map(([k, lbl]) =>
            `<button type="button" class="${k === curKind ? 'active' : ''}" data-edtab="${k}">${lbl}</button>`
          ).join('')}
        </div>`;

      const subOpts = (val) => SUBJECT_LIST.map((s) => `<option value="${s.name}" ${s.name === val ? 'selected' : ''}>${s.name}</option>`).join('');
      const bldOpts = (val) => Object.values(BUILDINGS).map((b) => `<option value="${b.id}" ${b.id === val ? 'selected' : ''}>${b.name}</option>`).join('');
      const labOpts = (val) => `<option value="">无关联实验</option>` + Object.values(LAB_EXPERIMENTS).map((l) => `<option value="${l.id}" ${l.id === val ? 'selected' : ''}>${l.title}</option>`).join('');

      let fields = '';
      if (curKind === 'task') {
        fields = `
          <div class="form-field full"><label>作业/待办标题</label><input id="f-title" value="${esc(initial.title || '')}" placeholder="例如：物理选必二课后第 4 题"></div>
          <div class="form-field"><label>学科</label><select id="f-sub">${subOpts(initial.subject || '物理')}</select></div>
          <div class="form-field"><label>截止日期</label><input id="f-date" type="date" value="${esc(initial.dueIso || getActiveDateIso() || TODAY_ISO)}"></div>
          <div class="form-field"><label>预计时长（分钟）</label><input id="f-est" type="number" min="10" max="240" value="${initial.estMinutes || 40}"></div>
          <div class="form-field"><label>优先级</label><select id="f-pri">${[['high', '紧急'], ['normal', '常规'], ['low', '轻松']].map(([v, l]) => `<option value="${v}" ${v === (initial.priority || 'normal') ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="form-field full"><label>关联 HAIZ 实验册（可选）</label><select id="f-lab">${labOpts(initial.labId || '')}</select></div>
          <div class="form-field full"><label>备注</label><textarea id="f-note">${esc(initial.note || '')}</textarea></div>`;
      } else if (curKind === 'personal') {
        fields = `
          <div class="form-field full"><label>个人日程标题（仅本人可见）</label><input id="f-title" value="${esc(initial.title || '')}" placeholder="例如：晚修攻克椭圆压轴题"></div>
          <div class="form-field"><label>日期</label><input id="f-date" type="date" value="${esc(initial.dateIso || getActiveDateIso() || TODAY_ISO)}"></div>
          <div class="form-field"><label>类型</label><select id="f-pkind">${[['study', '自习'], ['review', '错题复盘'], ['club', '社团活动'], ['life', '运动生活']].map(([v, l]) => `<option value="${v}" ${v === (initial.kind || 'study') ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="form-field"><label>开始时间</label><input id="f-start" type="time" value="${fmtMin(initial.startMinute ?? 1170)}"></div>
          <div class="form-field"><label>结束时间</label><input id="f-end" type="time" value="${fmtMin(initial.endMinute ?? 1230)}"></div>
          <div class="form-field full"><label>校园地点（关联校园地图）</label><select id="f-bld">${bldOpts(initial.buildingId || 'yihao')}</select></div>
          <div class="form-field full"><label>私人备注</label><textarea id="f-note">${esc(initial.note || '')}</textarea></div>`;
      } else if (curKind === 'course') {
        fields = `
          <div class="form-field"><label>学科</label><select id="f-sub">${subOpts(initial.subject || '数学')}</select></div>
          <div class="form-field"><label>星期</label><select id="f-wd">${[1, 2, 3, 4, 5, 6, 7].map((w) => `<option value="${w}" ${w === (initial.weekday || 3) ? 'selected' : ''}>星期${WEEK[w % 7]}</option>`).join('')}</select></div>
          <div class="form-field full"><label>课程名称</label><input id="f-title" value="${esc(initial.name || '')}" placeholder="例如：数学 · 导数与应用"></div>
          <div class="form-field"><label>开始时间</label><input id="f-start" type="time" value="${fmtMin(initial.startMinute ?? 480)}"></div>
          <div class="form-field"><label>结束时间</label><input id="f-end" type="time" value="${fmtMin(initial.endMinute ?? 520)}"></div>
          <div class="form-field"><label>教学楼（校园地图）</label><select id="f-bld">${bldOpts(initial.buildingId || 'yihao')}</select></div>
          <div class="form-field"><label>教室/老师</label><input id="f-room" value="${esc(initial.room || '一号楼 302')}"></div>
          <div class="form-field full"><label>关联 HAIZ 实验册</label><select id="f-lab">${labOpts(initial.labId || '')}</select></div>`;
      } else if (curKind === 'exam') {
        fields = `
          <div class="form-field full"><label>考试名称（成绩默认仅本人可见）</label><input id="f-title" value="${esc(initial.title || '')}" placeholder="例如：12 月数学联考"></div>
          <div class="form-field"><label>考试日期</label><input id="f-date" type="date" value="${esc(initial.dateIso || getActiveDateIso() || TODAY_ISO)}"></div>
          <div class="form-field"><label>状态</label><select id="f-estatus">${[['upcoming', '待考安排'], ['graded', '已出分']].map(([v, l]) => `<option value="${v}" ${v === (initial.status || 'upcoming') ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="form-field"><label>开始时间</label><input id="f-start" type="time" value="${fmtMin(initial.startMinute ?? 480)}"></div>
          <div class="form-field"><label>结束时间</label><input id="f-end" type="time" value="${fmtMin(initial.endMinute ?? 600)}"></div>
          <div class="form-field"><label>考场教学楼</label><select id="f-bld">${bldOpts(initial.buildingId || 'yihao')}</select></div>
          <div class="form-field"><label>考场教室</label><input id="f-room" value="${esc(initial.room || '一号教学楼 302')}"></div>
          <div class="form-field full"><label>考试说明 / 考后心得</label><textarea id="f-note">${esc(initial.note || '')}</textarea></div>`;
      } else {
        fields = `
          <div class="form-field"><label>性质</label><select id="f-ckind"><option value="growth" ${initial.kind !== 'campus' ? 'selected' : ''}>个人成长记录（仅本人可见）</option><option value="campus" ${initial.kind === 'campus' ? 'selected' : ''}>校园活动 / 通知备忘</option></select></div>
          <div class="form-field"><label>日期</label><input id="f-date" type="date" value="${esc(initial.dateIso || getActiveDateIso() || TODAY_ISO)}"></div>
          <div class="form-field full"><label>标题</label><input id="f-title" value="${esc(initial.title || '')}" placeholder="例如：榄仁树下完成物理复盘"></div>
          <div class="form-field full"><label>校园地点</label><select id="f-bld">${bldOpts(initial.buildingId || 'lanshu')}</select></div>
          <div class="form-field full"><label>内容记录</label><textarea id="f-note">${esc(initial.text || '')}</textarea></div>`;
      }

      els.edBody.innerHTML = `${tabs}<form id="ed-form"><div class="form-grid">${fields}</div><div class="form-actions"><button type="button" class="mini-btn" id="ed-cancel">取消</button><button type="submit" class="ink-btn">${isEdit ? '保存修改' : '确认写入时间带'}</button></div></form>`;

      els.edBody.querySelectorAll('[data-edtab]').forEach((b) => b.addEventListener('click', () => { curKind = b.dataset.edtab; renderForm(); }));
      document.querySelector('#ed-cancel')?.addEventListener('click', () => { els.edModal.hidden = true; });
      document.querySelector('#ed-form')?.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const val = (sel) => document.querySelector(sel)?.value ?? '';
        const title = val('#f-title').trim();
        if (!title) { toast('请填写标题或名称'); return; }
        if (curKind === 'task') {
          const payload = { title, subject: val('#f-sub'), dueIso: val('#f-date'), estMinutes: Number(val('#f-est')) || 40, priority: val('#f-pri'), labId: val('#f-lab'), note: val('#f-note'), linkedCourseId: initial.linkedCourseId || null };
          isEdit ? store.updateTask(initial.id, payload) : store.addTask(payload);
        } else if (curKind === 'personal') {
          const payload = { title, dateIso: val('#f-date'), kind: val('#f-pkind'), startMinute: parseMin(val('#f-start'), 1170), endMinute: parseMin(val('#f-end'), 1230), buildingId: val('#f-bld'), note: val('#f-note') };
          isEdit ? store.updatePersonal(initial.id, payload) : store.addPersonal(payload);
        } else if (curKind === 'course') {
          const payload = { name: title, subject: val('#f-sub'), weekday: Number(val('#f-wd')), startMinute: parseMin(val('#f-start'), 480), endMinute: parseMin(val('#f-end'), 520), buildingId: val('#f-bld'), room: val('#f-room'), labId: val('#f-lab') };
          isEdit ? store.updateCourse(initial.id, payload) : store.addCourse(payload);
        } else if (curKind === 'exam') {
          const payload = { title, dateIso: val('#f-date'), status: val('#f-estatus'), startMinute: parseMin(val('#f-start'), 480), endMinute: parseMin(val('#f-end'), 600), buildingId: val('#f-bld'), room: val('#f-room'), note: val('#f-note') };
          isEdit ? store.updateExam(initial.id, payload) : store.addExam(payload);
        } else {
          store.addCampusNote({ kind: val('#f-ckind'), dateIso: val('#f-date'), title, buildingId: val('#f-bld'), text: val('#f-note') });
        }
        sound.snap();
        els.edModal.hidden = true;
        toast(isEdit ? '已保存修改并持久化' : '已写入时间带并保存');
        if (activeExamId && curKind === 'exam') renderExamScroll();
        onStateMutated();
      });
    };
    renderForm();
    els.edModal.hidden = false;
  }
  els.edClose?.addEventListener('click', () => { els.edModal.hidden = true; });

  // ------------------------------------------------------------------ Privacy, Demo Data & HAIZ Bridge Modal
  function openPrivacyModal() {
    const state = store.getState();
    const bp = createSupabaseBridgeBlueprint();
    const demoCounts = [state.courses, state.tasks, state.personal, state.exams, state.campusNotes].reduce((a, arr) => a + arr.filter((x) => x.example).length, 0);
    const mineCounts = [state.courses, state.tasks, state.personal, state.exams, state.campusNotes].reduce((a, arr) => a + arr.filter((x) => !x.example).length, 0);

    els.prBody.innerHTML = `
      <div class="paper-block">
        <div class="pb-head"><h4>当前数据状态（本机持久化）</h4><span class="priv-badge">版本 v${state.casVersion || 1}</span></div>
        <p class="pb-sub" style="margin:0;color:var(--ink)">
          演示数据条目：<b>${demoCounts}</b> 条 · 你录入/修改的个人记录：<b>${mineCounts}</b> 条 · 当前作息：<b>${state.bellMode === 'summer' ? '夏季作息（海中实录）' : '冬季作息'}</b>
        </p>
        <div class="form-actions" style="justify-content:flex-start;margin-top:12px">
          <button type="button" class="mini-btn seal" id="pr-clear-demo">清空全部演示数据，开始我的记录</button>
          <button type="button" class="mini-btn" id="pr-reset-demo">恢复演示数据</button>
          <button type="button" class="mini-btn indigo" id="pr-export-json">导出 NIANLUN 备份 JSON</button>
          <button type="button" class="mini-btn" id="pr-export-pocket">导出 HAIZ Pocket v1 快照</button>
        </div>
      </div>
      <div class="paper-block">
        <div class="pb-head"><h4>隐私边界与诚实声明</h4></div>
        <ul class="pb-sub" style="margin:0;padding-left:18px;line-height:1.75;color:var(--ink)">
          <li><strong>默认仅本人可见</strong>：所有考试成绩、错题诊断、个人日程与个人成长记录均标为 <code>visibility: "private"</code>，仅保存在本机浏览器的账号隔离存储区（兼容 HAIZ <code>session-guard.js</code>），绝不公开展示。</li>
          <li><strong>零第三方账号采集</strong>：学情诊断功能仅借鉴智学网在学科均衡、失分归因与错题复盘上的产品方法；本系统<strong>不连接未经授权的智学网接口，也绝不收集任何外部账号密码</strong>。</li>
          <li><strong>HAIZ 生态预留对接</strong>：数据模型已预留 Supabase RLS 表结构 <code>${esc(bp.table)}</code>（与 <code>pocket_snapshots</code> 同源 CAS 乐观锁 + 非匿名 <code>auth.uid()</code> 隔离，蓝图见 <code>supabase-schema.sql</code>），教学楼 ID 对齐 <code>data/buildings.json</code>，实验关联对齐 <code>lab/js/catalog.js</code>。</li>
        </ul>
      </div>
      <div class="paper-block">
        <div class="pb-head"><h4>从 JSON 恢复备份</h4></div>
        <div class="form-field full"><textarea id="pr-import-ta" placeholder="粘贴此前导出的 NIANLUN 004 JSON 备份文本…"></textarea></div>
        <div class="form-actions"><button type="button" class="mini-btn accent" id="pr-import-btn">导入并覆盖本机数据</button></div>
      </div>`;

    document.querySelector('#pr-clear-demo')?.addEventListener('click', () => {
      store.clearDemoData(); toast('已清空演示数据，现在全是你自己的时光'); openPrivacyModal(); onStateMutated();
    });
    document.querySelector('#pr-reset-demo')?.addEventListener('click', () => {
      store.resetDemoData(); toast('已恢复演示数据'); openPrivacyModal(); onStateMutated();
    });
    document.querySelector('#pr-export-json')?.addEventListener('click', () => {
      downloadText('haiz-nianlun-004-backup.json', store.exportJSON());
      toast('已导出 JSON 备份');
    });
    document.querySelector('#pr-export-pocket')?.addEventListener('click', () => {
      downloadText('haiz-pocket-snapshot-v1.json', JSON.stringify(store.exportPocketSnapshotV1(), null, 2));
      toast('已导出兼容 HAIZ Pocket v1 的快照');
    });
    document.querySelector('#pr-import-btn')?.addEventListener('click', () => {
      const txt = document.querySelector('#pr-import-ta')?.value.trim();
      if (!txt) { toast('请先粘贴备份 JSON'); return; }
      try {
        store.importJSON(txt);
        toast('备份导入成功并已持久化');
        els.prModal.hidden = true;
        onStateMutated();
      } catch (_) { toast('JSON 格式无效，原数据未被改动'); }
    });
    els.prModal.hidden = false;
  }
  els.prClose?.addEventListener('click', () => { els.prModal.hidden = true; });

  function downloadText(filename, content) {
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  // Close overlays on backdrop click
  [els.examScroll, els.abScroll, els.edModal, els.prModal].forEach((overlay) => {
    overlay?.addEventListener('click', (e) => { if (e.target === overlay) overlay.hidden = true; });
  });

  return {
    renderDayBody,
    openItemPopover,
    closePopover,
    openExamScroll,
    closeExamScroll,
    openAbsenceDigest,
    closeAbsenceDigest,
    openEditor,
    openPrivacyModal,
    hasOpenModal: () => !els.examScroll.hidden || !els.abScroll.hidden || !els.edModal.hidden || !els.prModal.hidden,
    closeTopModal() {
      if (!els.edModal.hidden) { els.edModal.hidden = true; return true; }
      if (!els.prModal.hidden) { els.prModal.hidden = true; return true; }
      if (!els.abScroll.hidden) { closeAbsenceDigest(); return true; }
      if (!els.examScroll.hidden) { closeExamScroll(); return true; }
      if (!els.itemPop.hidden) { closePopover(); return true; }
      return false;
    }
  };
}
