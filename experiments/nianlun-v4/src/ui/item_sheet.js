/**
 * HAIZ · NIANLUN · 一卷 V4 — Thing Panel (事物面板, Master v4 §5, §6, §9.3, §11.3)
 *
 * Opens as a half-sheet on mobile / docked right pane on desktop while keeping the live scroll visible.
 * Enforces:
 *  - Seven non-judgmental task statuses / Event plan-vs-fact distinction (Issue #5)
 *  - Live Fog condensation & dispersion with identity continuity (§5.1)
 *  - Task-to-Block scheduling strictly guarded by Time Sovereignty (Issue #4)
 *  - Multi-dimensional lineage inspection, rumor adoption, split-to-new-event (Issue #3)
 *  - 10-second undoable hard delete for private records vs hide-only for school notices (§11.3)
 */

import {
  TASK_STATUSES,
  EVENT_STATUSES,
  EPISTEMIC_KINDS,
  WEEKDAY_LABELS,
  createId,
  formatHour,
  isItemPrivateLocked,
} from '../core/model.js';
import { canScheduleBlock, parseIsoDate, addDays, toIsoDate } from '../core/calendar.js';

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formLabel(item) {
  if (item.isReturnWall) return '墙 · 返校边界';
  if (item.form === 'fog') return '雾 + 珠 · 时间范围待定';
  if (item.form === 'day_fog') return '雾（已凝聚到某天）· 时刻未定';
  if (item.kind === 'task') return '槽 + 墙 · 可选窗口与截止';
  if (item.kind === 'block') return '安排块 + 迹 · 个人时间';
  if (item.kind === 'memory') return '个人记忆 · 琥珀印记';
  if (item.kind === 'companion') return '伴随 · 附日提醒';
  if (item.kind === 'trace_log') return '迹 · 已记录投入';
  return '占用 · 必须在场';
}

export function renderItemSheet(container, { item, store, onClose, onRefresh, onToast, onOpenSettings, onSelectItem }) {
  if (!item) {
    container.innerHTML = '';
    return;
  }

  const state = store.state;
  const locked = isItemPrivateLocked(item, state.privacyLocked);

  if (locked) {
    container.innerHTML = `
      <div class="sheet-head">
        <div>
          <span class="eyebrow">共用手机隐私锁已开启</span>
          <h2>私密个人记录</h2>
        </div>
        <button class="icon-btn" data-close aria-label="关闭">✕</button>
      </div>
      <div class="sheet-body">
        <p class="muted">当前处于隐私锁定状态，私人记忆、备注和细节均已遮蔽。解锁后即可查看和编辑。</p>
        <div class="btn-row">
          <button class="btn pri" data-open-settings>前往隐私锁设置</button>
          <button class="btn" data-close>关闭</button>
        </div>
      </div>
    `;
    container.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', onClose));
    const setBtn = container.querySelector('[data-open-settings]');
    if (setBtn) setBtn.addEventListener('click', () => { onClose(); onOpenSettings(); });
    return;
  }

  const ep = EPISTEMIC_KINDS[item.epistemicKind] || EPISTEMIC_KINDS.plan;
  const isPersonal = item.epistemicKind === 'personal_record' || item.kind === 'memory' || item.kind === 'block' || item.kind === 'trace_log';
  const isTask = item.kind === 'task';
  const statusList = isTask ? TASK_STATUSES : EVENT_STATUSES;
  const linkedBlocks = isTask ? state.items.filter((x) => x.linkedTaskId === item.id && !x.hiddenByStudent) : [];
  const linkedTask = item.linkedTaskId ? state.items.find((x) => x.id === item.linkedTaskId) : null;

  // Check if Fog can condense/disperse
  const canCondense = item.kind === 'event' || item.kind === 'exam' || item.form === 'fog' || item.form === 'day_fog';

  // Build HTML
  container.innerHTML = `
    <div class="sheet-head">
      <div class="sheet-title-wrap">
        <div class="pill-row">
          <span class="pill subtle">${esc(formLabel(item))}</span>
          <span class="pill epistemic-${esc(ep.id)}" title="${esc(ep.hint)}">${esc(ep.label)}</span>
          ${item.isDemo ? '<span class="pill demo-pill">演示数据</span>' : ''}
        </div>
        <h2>${esc(item.title)}</h2>
        <div class="meta-line">
          <span>${esc(item.subject || '校务')}</span>
          ${item.dateIso ? `<span>· ${esc(item.dateIso)}</span>` : '<span>· 具体日期待定</span>'}
          ${item.startHour != null ? `<span>${formatHour(item.startHour)}${item.endHour != null ? `–${formatHour(item.endHour)}` : ''}</span>` : ''}
          ${item.estimatedByStudent ? '<span class="tag-est">我估计</span>' : ''}
          ${item.dueLabel ? `<span>· ${esc(item.dueLabel)}</span>` : ''}
        </div>
      </div>
      <button class="icon-btn" data-close aria-label="关闭面板">✕</button>
    </div>

    <div class="sheet-body">
      ${item.needsAnchorDateQuestion ? `
        <div class="callout">
          <strong>这张截图缺少原始发送日期</strong>
          <p class="muted">原文写着「${esc(item.rawRelativeHint || item.title)}」，系统不猜测“下周一”是哪一天。请告诉我大概是哪周收到的：</p>
          <div class="btn-row">
            <button class="btn pri" data-anchor-week="this">大概是这周发的（→ 12/7 截止）</button>
            <button class="btn" data-anchor-week="last">上周发的（→ 11/30 截止）</button>
            <button class="btn" data-anchor-week="keep">不知道，保持为雾</button>
          </div>
        </div>
      ` : ''}

      ${item.isReturnWall ? `
        <div class="callout">
          <strong>海南中学返校边界（可配置）</strong>
          <p class="muted">当前设为周日 ${formatHour(state.config.returnHour)}（${state.config.returnVerified ? '你已核实' : '演示占位 · 尚未完全核实'}）。修改后返校墙与周末可自主安排范围将同步更新。</p>
          <div class="btn-row">
            <button class="btn pri" data-open-settings>调整离校 / 返校与晚修时刻</button>
          </div>
        </div>
      ` : ''}

      <!-- Status Section (§6.3: describes the thing, never judges the student) -->
      ${!item.isReturnWall && item.kind !== 'memory' && item.kind !== 'trace_log' ? `
        <section class="sheet-sec">
          <div class="sec-label">状态（只描述事情，不评价人）</div>
          <div class="chip-grid" data-status-group>
            ${statusList.map((st) => `
              <button type="button" class="chip ${item.status === st.id ? 'active' : ''}" data-status="${st.id}">
                ${st.symbol ? `<span class="sym">${st.symbol}</span>` : ''}${esc(st.label)}
              </button>
            `).join('')}
          </div>
          ${item.status === 'past_due_needed' ? '<p class="hint-inline">槽已穿过截止墙，以虚线延伸到现在——墙仍是事实，但不会把你推入红色“逾期”区。</p>' : ''}
          ${item.status === 'plan_elapsed' ? '<p class="hint-inline">原定时间已过，但软件不假定学校必然按计划进行。你可留在此态，或按事实手动确认。</p>' : ''}
        </section>
      ` : ''}

      <!-- Epistemic Distinction Control (Issue #5: Plan ≠ Fact ≠ Personal Record) -->
      ${item.kind === 'exam' || item.kind === 'event' || item.kind === 'change' ? `
        <section class="sheet-sec">
          <div class="sec-label">事实核实（区分原定计划与实际发生）</div>
          <div class="btn-row">
            <button class="btn ${item.epistemicKind === 'verified_fact' && item.status === 'confirmed_happened' ? 'pri' : ''}" data-verify-fact="happened">确认已如期进行</button>
            <button class="btn ${item.epistemicKind === 'plan' ? 'pri' : ''}" data-verify-fact="plan">保持原定计划（未核实）</button>
          </div>
        </section>
      ` : ''}

      <!-- Condensation / Dispersion (§5.1: same object morphs across Fog -> Day -> Time) -->
      ${canCondense && !item.isReturnWall ? `
        <section class="sheet-sec">
          <div class="sec-label">时间精度（凝聚与散开 · 始终是同一件事）</div>
          <p class="muted small">当前范围：${item.form === 'fog' ? `${item.fogFromIso || '下周'} 至 ${item.fogToIso || '之后'}（雾 · 约 ${item.durationMinutes || 40} 分钟）` : item.form === 'day_fog' ? `${item.dateIso} · 具体时刻未定（约 ${item.durationMinutes || 40} 分钟）` : `${item.dateIso || ''} ${formatHour(item.startHour)}–${formatHour(item.endHour)}`}</p>
          <div class="btn-row">
            <button class="btn ${item.form === 'day_fog' ? 'pri' : ''}" data-condense="wed">定在周三 12/2（我估计）</button>
            <button class="btn ${item.form === 'occupation' && item.startHour != null ? 'pri' : ''}" data-condense="time">定到 15:20–16:00</button>
            <button class="btn ${item.form === 'fog' ? 'pri' : ''}" data-condense="fog">改回待定（散开成雾）</button>
          </div>
          <div class="inline-form">
            <label>自选日期凝聚：</label>
            <input type="date" value="${esc(item.dateIso || item.fogFromIso || '2026-12-02')}" data-condense-date>
            <button class="btn" data-condense-apply>定在此日</button>
          </div>
        </section>
      ` : ''}

      <!-- Task Channel -> Independent Scheduled Block & Trace (§5.2, Issue #4) -->
      ${isTask ? `
        <section class="sheet-sec">
          <div class="sec-label">安排与投入（任务永不直接变成占用）</div>
          <p class="muted small">作业的槽只代表可写的窗口。你可以为它安排一段或多段独立的学习块（仅限离校在家或你手动开放的时段）。</p>
          <div class="btn-row">
            <button class="btn pri" data-plan-slot="sun_am">安排周日上午 09:00–10:30</button>
            <button class="btn" data-plan-slot="sat_pm">安排周六下午 15:30–17:00</button>
            <button class="btn" data-plan-slot="school_test" title="验证：不得虚构在校自主时间">尝试排进周一第3节（校内锁定）</button>
          </div>
          <div class="btn-row" style="margin-top:8px">
            <button class="btn" data-log-trace="30">记录投入 +30 分钟（迹）</button>
            ${item.loggedMinutes ? `<span class="pill subtle">已累计记录 ${item.loggedMinutes} 分钟</span>` : ''}
          </div>
          <div class="sovereignty-msg" data-sovereignty-msg hidden></div>
          ${linkedBlocks.length > 0 ? `
            <div class="linked-list">
              <div class="small muted">已关联的独立安排块（删块不删任务）：</div>
              ${linkedBlocks.map((blk) => `
                <div class="linked-row">
                  <button class="link-btn" data-jump-item="${blk.id}">▪ ${esc(blk.dateIso)} ${formatHour(blk.startHour)}–${formatHour(blk.endHour)}（已投入 ${blk.loggedMinutes || 0} 分钟）</button>
                  <button class="mini-btn" data-del-block="${blk.id}">移除块</button>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </section>
      ` : ''}

      ${item.kind === 'block' ? `
        <section class="sheet-sec">
          <div class="sec-label">实际投入（迹）</div>
          <p class="muted small">已记录 ${item.loggedMinutes || 0} / ${item.durationMinutes || 90} 分钟。斜线填充只显示你主动记录的投入，永不进入年轮几何。</p>
          <div class="btn-row">
            <button class="btn pri" data-block-trace="30">记录投入 +30 分钟</button>
            <button class="btn" data-block-trace="-30">减少 30 分钟</button>
            ${linkedTask ? `<button class="btn" data-jump-item="${linkedTask.id}">查看关联任务：${esc(linkedTask.title)}</button>` : ''}
          </div>
        </section>
      ` : ''}

      <!-- Expandable Provenance & Lineage (§8.1 + Issue #3) -->
      <section class="sheet-sec">
        <div class="sec-label">来源与谱系（${(item.lineage || []).length} 层记录 · 原文永久保留）</div>
        <div class="source-summary">${esc(item.sourceSummary || '本地记录')}</div>
        ${(item.lineage && item.lineage.length > 0) ? `
          <div class="lineage-list">
            ${item.lineage.map((lyr, idx) => `
              <div class="lineage-layer status-${esc(lyr.layerStatus)}">
                <div class="lyr-meta">
                  <span class="lyr-badge">${lyr.layerStatus === 'active' ? '当前有效' : lyr.layerStatus === 'superseded' ? '已被覆盖' : lyr.layerStatus === 'rumor' ? '据传附注' : lyr.layerStatus === 'outdated' ? '旧通知重转' : '存在不一致'}</span>
                  <span>${esc(lyr.originalSentIso ? lyr.originalSentIso.slice(5, 16).replace('T', ' ') : '原发时间未知')}</span>
                  <span>· ${esc(lyr.sourceLabel || lyr.sender)}</span>
                  <span class="score-tag">可信权值 ${lyr.effectiveScore ?? '—'}</span>
                </div>
                <div class="lyr-text">「${esc(lyr.rawText)}」</div>
                <div class="lyr-why">${esc(lyr.verdictReason || '')}${lyr.derivation ? ` · ${esc(lyr.derivation)}` : ''}</div>
                ${(lyr.layerStatus === 'rumor' || lyr.layerStatus === 'conflict') ? `
                  <div class="btn-row" style="margin-top:6px">
                    <button class="mini-btn pri" data-adopt-layer="${idx}">采纳此层</button>
                    <button class="mini-btn" data-split-layer="${idx}">拆成独立事件</button>
                  </div>
                ` : ''}
                ${(lyr.layerStatus === 'active' && item.lineage.length > 1) ? `
                  <div class="btn-row" style="margin-top:6px">
                    <button class="mini-btn" data-split-layer="${idx}">从本事件拆开</button>
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        ` : '<p class="muted small">暂无多条群消息谱系层。</p>'}
      </section>

      <!-- Personal Notes -->
      <section class="sheet-sec">
        <div class="sec-label">备注（仅保存在本机）</div>
        <textarea class="notes-input" rows="2" placeholder="记一句只有自己看的提醒…" data-notes-input>${esc(item.notes || '')}</textarea>
      </section>

      <!-- Danger / Honesty Actions (§11.3) -->
      ${!item.isReturnWall ? `
        <section class="sheet-sec sheet-footer-actions">
          ${isPersonal
            ? '<button class="btn subtle-danger" data-delete-private>删除私人记录（10 秒后彻底清除）</button>'
            : '<button class="btn" data-hide-school>标记为与我无关并隐藏（保留来源事实）</button>'}
        </section>
      ` : ''}
    </div>
  `;

  // --- Wire Event Handlers ---
  container.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', onClose));
  const openSet = container.querySelector('[data-open-settings]');
  if (openSet) openSet.addEventListener('click', () => { onClose(); onOpenSettings(); });

  // Undated screenshot 3-choice resolution
  container.querySelectorAll('[data-anchor-week]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const choice = btn.dataset.anchorWeek;
      store.pushUndo('确认截图原发时间');
      if (choice === 'this') {
        item.needsAnchorDateQuestion = false;
        item.dateIso = '2026-12-07';
        item.dueIso = '2026-12-07';
        item.form = 'task_channel';
        item.dueLabel = '12/07 当天前（按本周截图推算）';
        item.channelStartIso = state.nowIso;
        onToast('已凝聚到 12 月 7 日（下周一）截止。');
      } else if (choice === 'last') {
        item.needsAnchorDateQuestion = false;
        item.dateIso = '2026-11-30';
        item.dueIso = '2026-11-30';
        item.form = 'task_channel';
        item.dueLabel = '11/30 当天前（按上周截图推算）';
        item.channelStartIso = '2026-11-28';
        onToast('已凝聚到 11 月 30 日（本周一）截止。');
      } else {
        item.needsAnchorDateQuestion = false;
        onToast('好，保持为时间待定的雾，不猜测。');
      }
      store.emit('anchor_resolved');
      onRefresh();
    });
  });

  // Status buttons
  container.querySelectorAll('[data-status]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.status;
      store.pushUndo(`更改「${item.title}」状态`);
      item.status = next;
      if (next === 'done' && isTask && linkedBlocks.length > 0) {
        onToast('任务已标记完成；关联的未来安排块已变淡，你可按需移除。');
      } else if (next === 'past_due_needed') {
        onToast('槽已穿过截止墙继续延伸，直到你完成或不再需要。');
      }
      store.emit('status_change');
      onRefresh();
    });
  });

  // Fact verification (Issue #5)
  container.querySelectorAll('[data-verify-fact]').forEach((btn) => {
    btn.addEventListener('click', () => {
      store.pushUndo('更新事实核实状态');
      if (btn.dataset.verifyFact === 'happened') {
        item.epistemicKind = 'verified_fact';
        item.status = 'confirmed_happened';
        onToast('已标记为「已确认事实」。');
      } else {
        item.epistemicKind = 'plan';
        item.status = item.dateIso && item.dateIso < state.nowIso ? 'plan_elapsed' : 'planned';
        onToast('已保持为「原定计划」，不做自动推断。');
      }
      store.emit('epistemic_change');
      onRefresh();
    });
  });

  // Condensation / Dispersion (§5.1)
  container.querySelectorAll('[data-condense]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.condense;
      store.pushUndo(`调整「${item.title}」时间精度`);
      item.lineage = item.lineage || [];
      if (mode === 'wed') {
        item.form = 'day_fog';
        item.dateIso = '2026-12-02';
        item.fogFromIso = '2026-12-02';
        item.fogToIso = '2026-12-02';
        item.startHour = null;
        item.endHour = null;
        item.estimatedByStudent = true;
        item.status = 'tentative';
        item.lineage.unshift({
          id: createId('lyr'), sender: '我自己', originalAuthor: '我自己',
          sourceLabel: '学生估计 · 凝聚到某天', originChannel: 'student_self',
          directness: 'original', scopeMatch: 'exact', effectiveScore: 70,
          originalSentIso: `${state.nowIso}T14:15:00`, rawText: '手动凝聚到周三 12/2（我估计）',
          layerStatus: 'active', verdictReason: '区分学生估计与学校正式通知',
        });
        onToast('已凝聚到周三 12/2（标注“我估计”），身份与谱系保持不变。');
      } else if (mode === 'time') {
        item.form = 'occupation';
        item.dateIso = item.dateIso || '2026-12-02';
        item.fogFromIso = item.dateIso;
        item.fogToIso = item.dateIso;
        item.startHour = 15.33;
        item.endHour = 16.0;
        item.status = 'planned';
        item.lineage.unshift({
          id: createId('lyr'), sender: '我自己', originalAuthor: '我自己',
          sourceLabel: '精确到时刻', originChannel: 'student_self',
          directness: 'original', scopeMatch: 'exact', effectiveScore: 70,
          originalSentIso: `${state.nowIso}T14:16:00`, rawText: `凝聚到 ${item.dateIso} 15:20–16:00`,
          layerStatus: 'active', verdictReason: '由雾凝聚为具体时段，可在时刻读法中看到',
        });
        onToast('已凝聚到 15:20–16:00，双指拉长该天即可在时刻读法中查看。');
      } else {
        // Disperse back to Fog, preserving previous time in lineage!
        for (const l of item.lineage) {
          if (l.layerStatus === 'active') l.layerStatus = 'superseded';
        }
        item.form = 'fog';
        item.dateIso = null;
        item.startHour = null;
        item.endHour = null;
        item.fogFromIso = '2026-11-30';
        item.fogToIso = '2026-12-04';
        item.estimatedByStudent = false;
        item.status = 'tbd';
        item.lineage.unshift({
          id: createId('lyr'), sender: '我自己', originalAuthor: '我自己',
          sourceLabel: '改回待定 · 散开为雾', originChannel: 'student_self',
          directness: 'original', scopeMatch: 'exact', effectiveScore: 70,
          originalSentIso: `${state.nowIso}T14:17:00`, rawText: '改回下周某天待定，旧时间保留在谱系',
          layerStatus: 'active', verdictReason: '散开为雾，历史记录不丢失',
        });
        onToast('已散开回雾的状态，先前时间保留在谱系中。');
      }
      store.emit('condense');
      onRefresh();
    });
  });

  const condenseApply = container.querySelector('[data-condense-apply]');
  if (condenseApply) {
    condenseApply.addEventListener('click', () => {
      const val = container.querySelector('[data-condense-date]').value;
      if (!val) return;
      store.pushUndo(`凝聚「${item.title}」到 ${val}`);
      item.form = 'day_fog';
      item.dateIso = val;
      item.fogFromIso = val;
      item.fogToIso = val;
      item.startHour = null;
      item.endHour = null;
      item.estimatedByStudent = true;
      item.status = 'tentative';
      store.emit('condense');
      onToast(`已凝聚到 ${val}（我估计）。`);
      onRefresh();
    });
  }

  // Schedule independent block with strict Time Sovereignty guard (Issue #4!)
  container.querySelectorAll('[data-plan-slot]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const slot = btn.dataset.planSlot;
      const msgBox = container.querySelector('[data-sovereignty-msg]');
      let targetIso;
      let startH;
      let endH;
      if (slot === 'sun_am') { targetIso = '2026-11-29'; startH = 9.0; endH = 10.5; }
      else if (slot === 'sat_pm') { targetIso = '2026-11-28'; startH = 15.5; endH = 17.0; }
      else { targetIso = '2026-11-30'; startH = 9.67; endH = 10.33; } // Monday Period 3 (School locked!)

      const day = store.days.find((d) => d.iso === targetIso);
      const check = canScheduleBlock(day, startH, endH, state.config);
      if (!check.allowed) {
        if (msgBox) {
          msgBox.hidden = false;
          msgBox.textContent = `不可安排：${check.reason}`;
        }
        onToast(check.reason);
        return;
      }

      if (msgBox) msgBox.hidden = true;
      store.pushUndo(`为「${item.title}」安排学习块`);
      const blk = {
        id: createId('blk'),
        kind: 'block',
        subject: item.subject,
        title: `安排：${item.title.slice(0, 12)}`,
        epistemicKind: 'personal_record',
        status: 'not_started',
        form: 'block',
        dateIso: targetIso,
        startHour: startH,
        endHour: endH,
        durationMinutes: Math.round((endH - startH) * 60),
        loggedMinutes: 0,
        linkedTaskId: item.id,
        relationGroup: item.relationGroup || item.id,
        sourceSummary: '我自己 · 在家可自主安排时段',
        lineage: [],
        flyInAt: Date.now(),
      };
      if (!item.relationGroup) item.relationGroup = blk.relationGroup;
      state.items.push(blk);
      store.emit('add_block');
      onToast(`已在 ${targetIso} ${formatHour(startH)}–${formatHour(endH)} 创建关联安排块（原任务不变）。`);
      onRefresh();
    });
  });

  // Log trace (+30m) on Task or Block
  const logTraceBtn = container.querySelector('[data-log-trace]');
  if (logTraceBtn) {
    logTraceBtn.addEventListener('click', () => {
      store.pushUndo('记录投入 30 分钟');
      item.loggedMinutes = (item.loggedMinutes || 0) + 30;
      if (item.status === 'not_started' || item.status === 'unknown') item.status = 'partial';
      if (linkedBlocks.length > 0) {
        linkedBlocks[0].loggedMinutes = Math.min(linkedBlocks[0].durationMinutes || 90, (linkedBlocks[0].loggedMinutes || 0) + 30);
      }
      store.emit('log_trace');
      onToast('已记录 30 分钟实际投入（迹），永不改变年轮几何。');
      onRefresh();
    });
  }

  container.querySelectorAll('[data-block-trace]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const delta = Number(btn.dataset.blockTrace);
      store.pushUndo('更新实际投入迹');
      item.loggedMinutes = Math.max(0, Math.min(item.durationMinutes || 120, (item.loggedMinutes || 0) + delta));
      if (linkedTask) {
        linkedTask.loggedMinutes = Math.max(0, (linkedTask.loggedMinutes || 0) + delta);
      }
      store.emit('log_trace');
      onRefresh();
    });
  });

  // Delete linked block (does NOT delete parent task! §5.2)
  container.querySelectorAll('[data-del-block]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const res = store.deletePrivateItem(btn.dataset.delBlock);
      if (res.ok) {
        onToast('已移除安排块（原任务完整保留），10 秒内可撤销。', { undoDeleteId: btn.dataset.delBlock });
        onRefresh();
      }
    });
  });

  container.querySelectorAll('[data-jump-item]').forEach((btn) => {
    btn.addEventListener('click', () => onSelectItem(btn.dataset.jumpItem));
  });

  // Adopt rumor/conflict layer OR split layer into independent event (Issue #3 & §8.4)
  container.querySelectorAll('[data-adopt-layer]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.adoptLayer);
      const lyr = item.lineage[idx];
      if (!lyr) return;
      store.pushUndo('采纳谱系层');
      for (const l of item.lineage) {
        if (l.layerStatus === 'active') l.layerStatus = 'superseded';
      }
      lyr.layerStatus = 'active';
      lyr.verdictReason += ' · 经你手动采纳';
      if (lyr.proposedDateIso) item.dateIso = lyr.proposedDateIso;
      if (lyr.proposedStartHour != null) {
        item.startHour = lyr.proposedStartHour;
        item.endHour = lyr.proposedEndHour ?? (lyr.proposedStartHour + 0.75);
        item.form = 'occupation';
      }
      item.status = 'tentative';
      item.estimatedByStudent = true;
      store.emit('adopt_layer');
      onToast('已采纳此层并更新位置，旧层划线保留。');
      onRefresh();
    });
  });

  container.querySelectorAll('[data-split-layer]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.splitLayer);
      const lyr = item.lineage[idx];
      if (!lyr) return;
      store.pushUndo('拆出独立事件');
      item.lineage.splice(idx, 1);
      const splitItem = {
        id: createId('split'),
        kind: item.kind,
        subject: item.subject,
        title: `${item.title}（拆出）`,
        epistemicKind: 'plan',
        status: lyr.proposedDateIso ? 'tentative' : 'tbd',
        form: lyr.proposedStartHour != null ? 'occupation' : (lyr.proposedDateIso ? 'day_fog' : 'fog'),
        dateIso: lyr.proposedDateIso || null,
        fogFromIso: lyr.proposedDateIso || state.nowIso,
        fogToIso: lyr.proposedDateIso || toIsoDate(addDays(parseIsoDate(state.nowIso), 7)),
        startHour: lyr.proposedStartHour ?? null,
        endHour: lyr.proposedEndHour ?? null,
        durationMinutes: 45,
        sourceSummary: lyr.sourceLabel,
        lineage: [{ ...lyr, layerStatus: 'active', verdictReason: '由学生从原事件手动拆开' }],
        flyInAt: Date.now(),
      };
      state.items.push(splitItem);
      store.emit('split_layer');
      onToast('已将此消息拆成独立事件。');
      onSelectItem(splitItem.id);
    });
  });

  // Notes live save
  const notesInput = container.querySelector('[data-notes-input]');
  if (notesInput) {
    notesInput.addEventListener('change', () => {
      item.notes = notesInput.value;
      store.emit('edit_note');
    });
  }

  // Delete Private (10s memory undo -> permanent purge!) vs Hide School Item
  const delBtn = container.querySelector('[data-delete-private]');
  if (delBtn) {
    delBtn.addEventListener('click', () => {
      const res = store.deletePrivateItem(item.id);
      if (res.ok) {
        onClose();
        onToast(res.backupNotice, { undoDeleteId: item.id, duration: 10000 });
        onRefresh();
      } else {
        onToast(res.reason);
      }
    });
  }

  const hideBtn = container.querySelector('[data-hide-school]');
  if (hideBtn) {
    hideBtn.addEventListener('click', () => {
      store.toggleHideSchoolItem(item.id, true);
      onClose();
      onToast(`已隐藏「${item.title}」（学校原始记录仍保留，可撤销）。`);
      onRefresh();
    });
  }
}
