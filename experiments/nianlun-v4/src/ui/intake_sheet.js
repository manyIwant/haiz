/**
 * HAIZ · NIANLUN · 一卷 V4 — Unified "放入" (Information Convergence Intake Panel)
 *
 * Implements Master v4 §8, §9.4, §14 + Issue #3 (multi-dimensional authority):
 *  - Step-by-step & batch 9-message Hainan Middle School group-chat convergence demo
 *  - Custom text paste + quick single-sentence batch input ("周三物理考试，周四交实验报告")
 *  - Local same-origin screenshot OCR (reusing HAIZ Pocket's `HAIZ_OCR` Tesseract.js worker!)
 *  - Class Shared Roll code subscription (school events only, zero personal data)
 *  - One-way, undoable HAIZ Pocket `PersonalSnapshot` JSON migration (§14)
 *  - Unparsed raw messages list ("没看懂的消息" — never guessed, never discarded)
 *  - Whole-batch rollback ("撤销整次导入")
 */

import { createId } from '../core/model.js';
import { convergeMessage, splitQuickBatchText } from '../core/convergence.js';
import { DEMO_CONVERGENCE_MESSAGES, DEMO_CLASS_SHARED_ROLL } from '../core/demo_data.js';

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SAMPLE_POCKET_BACKUP = {
  format: 'haiz-pocket-guest-backup-v1',
  snapshot: {
    tasks: [
      { id: 'sample1', title: '整理今天的数学课堂笔记', subject: '数学', completed: false, example: true },
      { id: 'pk_real_1', title: '生物必修二遗传图谱整理', subject: '生物', completed: false, example: false, dueIso: '2026-12-05', source: 'Pocket 粘贴导入', originalNotice: '生物课代表：下周六前整理遗传图谱。' },
      { id: 'pk_real_2', title: '语文期中作文修改稿', subject: '语文', completed: false, example: false, dueIso: '2026-11-10', source: 'Pocket 课代表通知', originalNotice: '11月10日前交期中作文修改稿。' },
      { id: 'pk_real_3', title: '英语 Unit 4 单词听写订正', subject: '英语', completed: true, example: false, dueIso: '2026-11-20', source: '手动输入', originalNotice: '' },
    ],
    courses: [],
    focusLogs: [
      { at: '2026-11-28T13:15:00', minutes: 35, label: '数学立体几何错题回顾' },
    ],
    taskNotes: {
      pk_real_1: '重点画伴性遗传系谱图判断步骤。',
    },
  },
};

export function createIntakeController({ store, onRefresh, onToast, onSelectItem, onJumpDate, onClose }) {
  let activeSubTab = 'demo_flow'; // 'demo_flow' | 'paste' | 'ocr' | 'class_roll' | 'pocket'
  let demoStepIndex = 0;
  let demoLog = [];
  let ocrBusy = false;
  let ocrStatusText = '';
  let ocrExtractedText = '';

  function runSingleDemoStep(batchId) {
    if (demoStepIndex >= DEMO_CONVERGENCE_MESSAGES.length) return null;
    const msg = DEMO_CONVERGENCE_MESSAGES[demoStepIndex];
    demoStepIndex++;
    const res = convergeMessage(msg, store.state, {
      nowIso: `${store.state.nowIso}T14:15:00`,
      batchId,
    });
    if (res.fingerprint && res.outcome !== 'duplicate_skipped') {
      store.state.seenFingerprints.push(res.fingerprint);
    }
    if (res.unparsedRecord) {
      store.state.unparsedMessages.unshift(res.unparsedRecord);
    }
    demoLog.unshift({ msg, res });
    store.state.lastImportedLabel = `截至 11 月 28 日，已归流 ${store.state.seenFingerprints.length} 条群消息`;
    return res;
  }

  function render(container) {
    const state = store.state;
    const demoDone = demoStepIndex >= DEMO_CONVERGENCE_MESSAGES.length;

    container.innerHTML = `
      <div class="sheet-head">
        <div>
          <span class="eyebrow">放入 · 本地信息归流</span>
          <h2>从群消息到可信的时间</h2>
        </div>
        <button class="icon-btn" data-close aria-label="关闭放入面板">✕</button>
      </div>

      <div class="sheet-body">
        <div class="subtab-bar" role="tablist">
          <button class="subtab ${activeSubTab === 'demo_flow' ? 'active' : ''}" data-subtab="demo_flow">归流演练 (9条)</button>
          <button class="subtab ${activeSubTab === 'paste' ? 'active' : ''}" data-subtab="paste">粘贴 / 一句话</button>
          <button class="subtab ${activeSubTab === 'ocr' ? 'active' : ''}" data-subtab="ocr">截图 OCR</button>
          <button class="subtab ${activeSubTab === 'class_roll' ? 'active' : ''}" data-subtab="class_roll">班级共享卷</button>
          <button class="subtab ${activeSubTab === 'pocket' ? 'active' : ''}" data-subtab="pocket">Pocket 迁移</button>
        </div>

        ${activeSubTab === 'demo_flow' ? `
          <div class="callout subtle-box">
            <strong>真实群消息归流（多维可信判断 · 演示数据）</strong>
            <p class="muted small">包含：物理任课原发 → 按发送日改期 → <strong>化学老师跨学科转述（不覆盖）</strong> → 同学听闻 → <strong>家长原文转发年级组通知</strong> → 旧通知重转拦截 → 无日期截图变雾 → 非安排闲聊进「没看懂」 → 年级通知恢复照常。</p>
            <div class="btn-row">
              <button class="btn pri" data-demo-next ${demoDone ? 'disabled' : ''}>${demoDone ? '全部 9 条已归流' : `放入第 ${demoStepIndex + 1} 条消息`}</button>
              <button class="btn" data-demo-all ${demoDone ? 'disabled' : ''}>一键全部归流</button>
              ${demoStepIndex > 0 ? '<button class="btn" data-demo-reset>重置演练</button>' : ''}
            </div>
          </div>

          <div class="msg-queue">
            ${DEMO_CONVERGENCE_MESSAGES.map((m, idx) => `
              <div class="msg-card ${idx < demoStepIndex ? 'done' : idx === demoStepIndex ? 'next' : ''}">
                <div class="msg-meta">
                  <span>${esc(m.whenLabel)}</span>
                  <span>· ${esc(m.sender)}</span>
                  <span class="pill subtle">${esc(m.tag)}</span>
                </div>
                <div class="msg-txt">${esc(m.text)}</div>
              </div>
            `).join('')}
          </div>

          ${demoLog.length > 0 ? `
            <div class="sheet-sec">
              <div class="sec-label">归流结果（点击可立即在卷上定位并展开谱系）</div>
              ${demoLog.slice(0, 6).map(({ msg, res }) => `
                <div class="log-entry outcome-${esc(res.outcome)}">
                  <div class="log-head">
                    <strong>${esc(msg.sender)}</strong>
                    ${res.targetItemId ? `<button class="mini-btn pri" data-open-item="${res.targetItemId}">在卷上看此事件</button>` : ''}
                  </div>
                  <div class="small muted">${esc(res.summary)}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        ` : ''}

        ${activeSubTab === 'paste' ? `
          <section class="sheet-sec">
            <div class="sec-label">粘贴群消息或一句话批量输入（全本地解析，不上传）</div>
            <textarea class="notes-input" rows="3" data-paste-text placeholder="例如：周三物理考试，周四交实验报告；或直接粘贴班主任/家长群转发的完整通知…"></textarea>
            <div class="form-grid-2">
              <label>来源出处
                <select data-paste-origin>
                  <option value="official_grade">学校 / 年级正式发布</option>
                  <option value="homeroom_teacher">班主任</option>
                  <option value="subject_teacher" selected>任课教师</option>
                  <option value="class_committee">班委 / 课代表</option>
                  <option value="peer_parent">同学 / 家长</option>
                  <option value="student_self">我自己（快速输入）</option>
                  <option value="unknown">未知来源</option>
                </select>
              </label>
              <label>传递方式（原发 vs 转述）
                <select data-paste-directness>
                  <option value="original" selected>原发通知</option>
                  <option value="verbatim_forward">完整原文转发</option>
                  <option value="paraphrase">口头转述</option>
                  <option value="rumor">听说 / 未核实</option>
                </select>
              </label>
              <label>发送人职责学科（可选）
                <input type="text" data-paste-subject placeholder="如：物理 / 化学 / 留空" value="">
              </label>
              <label>原发日期（留空 = 未知原发日，不猜）
                <input type="date" data-paste-date value="${esc(state.nowIso)}">
              </label>
            </div>
            <div class="btn-row" style="margin-top:10px">
              <button class="btn pri" data-paste-run>本地解析并放入卷中</button>
              <button class="btn" data-paste-quick>示例：一句话生成两件事</button>
            </div>
          </section>
        ` : ''}

        ${activeSubTab === 'ocr' ? `
          <section class="sheet-sec">
            <div class="sec-label">本地截图 / 纸质通知 OCR（复用 HAIZ Pocket 同源离线引擎）</div>
            <p class="muted small">图片仅在你本机浏览器内用同源 Tesseract WASM 识别，绝不上传至任何服务器。未识别到原发日期的截图会自动落成「雾」并询问你。</p>
            <div class="btn-row">
              <label class="btn pri file-btn">
                选择 PNG / JPG 截图
                <input type="file" accept="image/png,image/jpeg" data-ocr-file hidden ${ocrBusy ? 'disabled' : ''}>
              </label>
              ${ocrBusy ? '<button class="btn" data-ocr-cancel>取消识别</button>' : ''}
              <button class="btn" data-ocr-demo>体验无日期作业截图识别结果</button>
            </div>
            ${ocrStatusText ? `<div class="ocr-status">${esc(ocrStatusText)}</div>` : ''}
            ${ocrExtractedText ? `
              <div class="sheet-sec">
                <div class="sec-label">识别文字（可先人工校对，再放入卷中）</div>
                <textarea class="notes-input" rows="3" data-ocr-text>${esc(ocrExtractedText)}</textarea>
                <div class="btn-row" style="margin-top:8px">
                  <button class="btn pri" data-ocr-commit>按未知原发日放入（变成雾并提问）</button>
                </div>
              </div>
            ` : ''}
          </section>
        ` : ''}

        ${activeSubTab === 'class_roll' ? `
          <section class="sheet-sec">
            <div class="sec-label">班级共享卷（单向发布 · 仅含学校事件 · 零个人数据）</div>
            <p class="muted small">班主任或班委通过班级码发布校历与年级考试安排，不包含任何个人笔记或成绩。权威级别与正式校方通知一致。</p>
            <div class="inline-form">
              <input type="text" data-class-code value="${esc(DEMO_CLASS_SHARED_ROLL.code)}" placeholder="输入班级共享码">
              <button class="btn pri" data-class-import>订阅演示班级卷</button>
            </div>
            <div class="callout subtle-box" style="margin-top:10px">
              <strong>预览：${esc(DEMO_CLASS_SHARED_ROLL.school)} · ${esc(DEMO_CLASS_SHARED_ROLL.grade)}</strong>
              <ul class="plain-list">
                ${DEMO_CLASS_SHARED_ROLL.events.map((ev) => `<li>${esc(ev.title)} · ${esc(ev.dateIso || `${ev.fogFromIso}–${ev.fogToIso}（雾）`)}</li>`).join('')}
              </ul>
            </div>
          </section>
        ` : ''}

        ${activeSubTab === 'pocket' ? `
          <section class="sheet-sec">
            <div class="sec-label">从 HAIZ Pocket 单向复制迁移（保留原数据 · 整组可撤销）</div>
            <p class="muted small">严格遵循母本 §14：跳过 <code>example:true</code> 示例项；仅日期的截止不编造 23:59；已过截止未完成任务映射为「软件不知道」而非逾期；<code>FocusLog</code> 迁为独立「迹」，不影响年轮几何。</p>
            <div class="btn-row">
              <label class="btn pri file-btn">
                选择 Pocket 备份 JSON
                <input type="file" accept="application/json,.json" data-pocket-file hidden>
              </label>
              <button class="btn" data-pocket-sample>用示例 Pocket 快照演练迁移</button>
            </div>
          </section>
        ` : ''}

        <!-- Unparsed Raw Messages (§8.5: "没看懂" is NOT a failure) -->
        ${state.unparsedMessages.length > 0 ? `
          <section class="sheet-sec">
            <div class="sec-label">没看懂的消息（${state.unparsedMessages.length} 条 · 原文完整保留，不猜测假日期）</div>
            ${state.unparsedMessages.map((u) => `
              <div class="unparsed-row">
                <div class="small"><strong>${esc(u.sender)}</strong>：${esc(u.text)}</div>
                <div class="small muted">${esc(u.reason)}</div>
                <div class="btn-row" style="margin-top:6px">
                  <button class="mini-btn pri" data-promote-raw="${u.id}">手动转成待定雾</button>
                  <button class="mini-btn" data-ignore-raw="${u.id}">忽略</button>
                </div>
              </div>
            `).join('')}
          </section>
        ` : ''}

        <!-- Whole-Batch Rollback (§8.7, §11.3) -->
        ${state.importBatches.length > 0 ? `
          <section class="sheet-sec">
            <div class="sec-label">最近导入批次（一键整组撤销）</div>
            ${state.importBatches.slice(0, 4).map((b) => `
              <div class="linked-row">
                <span class="small">${esc(b.label)}</span>
                <button class="mini-btn" data-undo-batch="${b.id}">撤销整组</button>
              </div>
            `).join('')}
          </section>
        ` : ''}

        <div class="honest-foot">${esc(state.lastImportedLabel)} · 一卷从不声称“已同步全部群通知”。</div>
      </div>
    `;

    // Bind events
    container.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', onClose));
    container.querySelectorAll('[data-subtab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeSubTab = btn.dataset.subtab;
        render(container);
      });
    });

    // Demo step-by-step
    const nextBtn = container.querySelector('[data-demo-next]');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        let batch = state.importBatches.find((b) => b.id === 'demo_conv_batch');
        if (!batch) {
          batch = { id: 'demo_conv_batch', label: '9 条海南中学群消息归流演练', createdAt: new Date().toISOString(), addedFingerprints: [] };
          state.importBatches.unshift(batch);
        }
        const res = runSingleDemoStep(batch.id);
        if (res && res.fingerprint) batch.addedFingerprints.push(res.fingerprint);
        store.emit('intake_demo_step');
        onRefresh();
        if (res) onToast(res.summary);
        render(container);
      });
    }

    const allBtn = container.querySelector('[data-demo-all]');
    if (allBtn) {
      allBtn.addEventListener('click', () => {
        let batch = state.importBatches.find((b) => b.id === 'demo_conv_batch');
        if (!batch) {
          batch = { id: 'demo_conv_batch', label: '9 条海南中学群消息归流演练', createdAt: new Date().toISOString(), addedFingerprints: [] };
          state.importBatches.unshift(batch);
        }
        while (demoStepIndex < DEMO_CONVERGENCE_MESSAGES.length) {
          const res = runSingleDemoStep(batch.id);
          if (res && res.fingerprint) batch.addedFingerprints.push(res.fingerprint);
        }
        store.emit('intake_demo_all');
        onRefresh();
        onToast('9 条群消息已全部归流，可在卷上点击「物理考试」查看完整谱系。');
        render(container);
      });
    }

    const resetBtn = container.querySelector('[data-demo-reset]');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        store.undoImportBatch('demo_conv_batch');
        demoStepIndex = 0;
        demoLog = [];
        onRefresh();
        render(container);
      });
    }

    // Paste / Quick batch
    const quickBtn = container.querySelector('[data-paste-quick]');
    if (quickBtn) {
      quickBtn.addEventListener('click', () => {
        const ta = container.querySelector('[data-paste-text]');
        if (ta) ta.value = '周三物理考试，周四交生物实验报告';
        const sel = container.querySelector('[data-paste-origin]');
        if (sel) sel.value = 'student_self';
      });
    }

    const pasteRun = container.querySelector('[data-paste-run]');
    if (pasteRun) {
      pasteRun.addEventListener('click', () => {
        const raw = (container.querySelector('[data-paste-text]')?.value || '').trim();
        if (!raw) { onToast('请先粘贴或输入消息文字。'); return; }
        const origin = container.querySelector('[data-paste-origin]')?.value || 'subject_teacher';
        const directness = container.querySelector('[data-paste-directness]')?.value || 'original';
        const senderSubject = (container.querySelector('[data-paste-subject]')?.value || '').trim();
        const sentDate = container.querySelector('[data-paste-date]')?.value || '';

        store.pushUndo('本地导入粘贴消息');
        const batchId = createId('batch');
        const msgs = origin === 'student_self'
          ? splitQuickBatchText(raw, sentDate ? `${sentDate}T14:20:00` : null)
          : [{
              id: createId('msg'),
              sender: senderSubject ? `${senderSubject}来源` : '手动粘贴来源',
              senderChannel: origin,
              originChannel: origin,
              senderSubject,
              directness,
              originalSentIso: sentDate ? `${sentDate}T12:00:00` : null,
              text: raw,
            }];

        const addedFingerprints = [];
        const outcomes = [];
        for (const m of msgs) {
          const res = convergeMessage(m, state, { nowIso: `${state.nowIso}T14:20:00`, batchId });
          if (res.fingerprint && res.outcome !== 'duplicate_skipped') {
            state.seenFingerprints.push(res.fingerprint);
            addedFingerprints.push(res.fingerprint);
          }
          if (res.unparsedRecord) state.unparsedMessages.unshift(res.unparsedRecord);
          outcomes.push(res);
        }
        state.importBatches.unshift({
          id: batchId,
          label: `本地粘贴导入（${msgs.length} 条）`,
          createdAt: new Date().toISOString(),
          addedFingerprints,
        });
        state.lastImportedLabel = `截至 ${state.nowIso.slice(5)}，已归流 ${state.seenFingerprints.length} 条消息`;
        store.emit('intake_paste');
        onRefresh();
        onToast(outcomes.map((o) => o.summary).join('；'));
        render(container);
      });
    }

    // Local OCR (HAIZ_OCR bridge from Pocket!)
    const ocrFile = container.querySelector('[data-ocr-file]');
    if (ocrFile) {
      ocrFile.addEventListener('change', async () => {
        const file = ocrFile.files && ocrFile.files[0];
        if (!file) return;
        if (!window.HAIZ_OCR) {
          ocrStatusText = '当前离线预览壳未加载 Tesseract OCR 引擎（可将 pocket/ocr/ 部署在同源目录下开启真图识别）。你仍可直接粘贴文字或使用下方示例。';
          render(container);
          return;
        }
        ocrBusy = true;
        ocrStatusText = '正在本机加载中文 OCR 模型（图片不上传）…';
        render(container);
        try {
          const buf = new Uint8Array(await file.arrayBuffer());
          const poll = setInterval(() => {
            if (!ocrBusy) { clearInterval(poll); return; }
            const st = window.HAIZ_OCR.status();
            if (st && st !== ocrStatusText) {
              ocrStatusText = st;
              const stEl = container.querySelector('.ocr-status');
              if (stEl) stEl.textContent = st;
            }
          }, 250);
          const text = await window.HAIZ_OCR.recognize(buf);
          clearInterval(poll);
          ocrExtractedText = text;
          ocrStatusText = '本机识别完成，请校对后放入卷中。';
        } catch (err) {
          ocrStatusText = err.message || '本地识别未能完成，可手动输入。';
        } finally {
          ocrBusy = false;
          render(container);
        }
      });
    }

    const ocrCancel = container.querySelector('[data-ocr-cancel]');
    if (ocrCancel) {
      ocrCancel.addEventListener('click', () => {
        if (window.HAIZ_OCR) window.HAIZ_OCR.cancel();
        ocrBusy = false;
        ocrStatusText = '已取消本地识别。';
        render(container);
      });
    }

    const ocrDemo = container.querySelector('[data-ocr-demo]');
    if (ocrDemo) {
      ocrDemo.addEventListener('click', () => {
        ocrExtractedText = '下周一交化学有机推断专项练习册（截图未拍到发送时间）';
        ocrStatusText = '示例 OCR 提取文字（演示数据，未联网）。';
        render(container);
      });
    }

    const ocrCommit = container.querySelector('[data-ocr-commit]');
    if (ocrCommit) {
      ocrCommit.addEventListener('click', () => {
        const txt = (container.querySelector('[data-ocr-text]')?.value || '').trim();
        if (!txt) return;
        store.pushUndo('放入截图识别内容');
        const batchId = createId('ocr');
        const res = convergeMessage({
          id: createId('msg'),
          sender: '本地截图 OCR',
          senderChannel: 'unknown',
          originChannel: 'unknown',
          directness: 'verbatim_forward',
          originalSentIso: null,
          text: txt,
        }, state, { nowIso: `${state.nowIso}T14:25:00`, batchId });
        if (res.fingerprint) state.seenFingerprints.push(res.fingerprint);
        state.importBatches.unshift({
          id: batchId,
          label: '本地截图 OCR 导入',
          createdAt: new Date().toISOString(),
          addedFingerprints: res.fingerprint ? [res.fingerprint] : [],
        });
        ocrExtractedText = '';
        store.emit('intake_ocr');
        onRefresh();
        onToast(res.summary);
        if (res.targetItemId) onSelectItem(res.targetItemId);
      });
    }

    // Class Shared Roll
    const classBtn = container.querySelector('[data-class-import]');
    if (classBtn) {
      classBtn.addEventListener('click', () => {
        const code = (container.querySelector('[data-class-code]')?.value || '').trim();
        if (!code) return;
        store.pushUndo('订阅演示班级共享卷');
        const batchId = createId('class_roll');
        for (const ev of DEMO_CLASS_SHARED_ROLL.events) {
          state.items.push({
            id: createId('cls'),
            batchId,
            kind: ev.kind,
            subject: ev.subject,
            title: ev.title,
            epistemicKind: 'plan',
            status: ev.dateIso ? 'planned' : 'tbd',
            form: ev.dateIso ? 'occupation' : 'fog',
            dateIso: ev.dateIso || null,
            startHour: ev.startHour ?? null,
            endHour: ev.endHour ?? null,
            fogFromIso: ev.fogFromIso || null,
            fogToIso: ev.fogToIso || null,
            durationMinutes: ev.durationMinutes || 60,
            isMandatoryOccupation: Boolean(ev.isMandatoryOccupation),
            sourceSummary: `班级共享卷（${code}）· 仅学校事件`,
            lineage: [{
              id: createId('lyr'), batchId, sender: DEMO_CLASS_SHARED_ROLL.publisher,
              originalAuthor: DEMO_CLASS_SHARED_ROLL.publisher,
              sourceLabel: '班级共享卷 · 校方发布', originChannel: 'official_grade',
              directness: 'original', scopeMatch: 'exact', effectiveScore: 100,
              originalSentIso: DEMO_CLASS_SHARED_ROLL.publishedAt, rawText: ev.rawText,
              layerStatus: 'active', verdictReason: '单向学校事件共享卷，不含个人数据',
            }],
            flyInAt: Date.now(),
            isDemo: true,
          });
        }
        state.importBatches.unshift({
          id: batchId,
          label: `班级共享卷 ${code}（${DEMO_CLASS_SHARED_ROLL.events.length} 项学校事件）`,
          createdAt: new Date().toISOString(),
          addedFingerprints: [],
        });
        store.emit('intake_class_roll');
        onRefresh();
        onToast(`已订阅班级共享卷（新增 ${DEMO_CLASS_SHARED_ROLL.events.length} 项学校事件，不含任何个人数据）。`);
        render(container);
      });
    }

    // HAIZ Pocket Migration (§14)
    const pocketFile = container.querySelector('[data-pocket-file]');
    if (pocketFile) {
      pocketFile.addEventListener('change', async () => {
        const file = pocketFile.files && pocketFile.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const res = store.migrateFromPocketSnapshot(text);
          onRefresh();
          onToast(`迁移完成：${res.migratedTasks} 项任务（跳过 ${res.skippedExamples} 示例）、${res.migratedTraces} 条投入迹。可整组撤销。`);
          render(container);
        } catch (err) {
          onToast(err.message || 'Pocket 备份文件解析失败。');
        }
      });
    }

    const pocketSample = container.querySelector('[data-pocket-sample]');
    if (pocketSample) {
      pocketSample.addEventListener('click', () => {
        const res = store.migrateFromPocketSnapshot(SAMPLE_POCKET_BACKUP);
        onRefresh();
        onToast(`已用示例 Pocket 快照迁移：${res.migratedTasks} 任务（自动跳过 ${res.skippedExamples} 条示例，过去未完成迁为“软件不知道”）、${res.migratedTraces} 条迹。`);
        render(container);
      });
    }

    // Open target item on scroll
    container.querySelectorAll('[data-open-item]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = state.items.find((x) => x.id === btn.dataset.openItem);
        if (item && (item.dateIso || item.fogFromIso)) {
          onJumpDate(item.dateIso || item.fogFromIso);
        }
        onSelectItem(btn.dataset.openItem);
      });
    });

    // Unparsed message actions
    container.querySelectorAll('[data-promote-raw]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = state.unparsedMessages.findIndex((u) => u.id === btn.dataset.promoteRaw);
        if (idx < 0) return;
        const raw = state.unparsedMessages[idx];
        store.pushUndo('将未识别消息手动转为雾');
        state.unparsedMessages.splice(idx, 1);
        const item = {
          id: createId('man'),
          kind: 'event',
          subject: '其他',
          title: raw.text.slice(0, 20),
          epistemicKind: 'personal_record',
          status: 'tbd',
          form: 'fog',
          dateIso: null,
          fogFromIso: state.nowIso,
          fogToIso: '2026-12-05',
          durationMinutes: 30,
          sourceSummary: `${raw.sender}（手动从原文选出）`,
          lineage: [{
            id: createId('lyr'), sender: raw.sender, originalAuthor: raw.sender,
            sourceLabel: '原文手动摘出', originChannel: 'student_self',
            directness: 'original', scopeMatch: 'exact', effectiveScore: 70,
            originalSentIso: raw.originalSentIso, rawText: raw.text,
            layerStatus: 'active', verdictReason: '由你从“没看懂的消息”手动创建为待定雾',
          }],
          flyInAt: Date.now(),
        };
        state.items.push(item);
        store.emit('promote_raw');
        onRefresh();
        onSelectItem(item.id);
      });
    });

    container.querySelectorAll('[data-ignore-raw]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.unparsedMessages = state.unparsedMessages.filter((u) => u.id !== btn.dataset.ignoreRaw);
        store.emit('ignore_raw');
        render(container);
      });
    });

    // Undo whole import batch
    container.querySelectorAll('[data-undo-batch]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.undoBatch;
        if (id === 'demo_conv_batch') {
          demoStepIndex = 0;
          demoLog = [];
        }
        store.undoImportBatch(id);
        onRefresh();
        onToast('已整组撤销该次导入，所有生成事件与谱系层已回退。');
        render(container);
      });
    });
  }

  return { render };
}
