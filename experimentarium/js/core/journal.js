// HAIZ · EXPERIMENTARIUM — 个人实验记录系统 (haiz-experiment-record/1)
// IndexedDB 优先（离线持久）+ localStorage 回退 + 旧版 haiz-lab-notebook-v1 只读一次性导入；
// 支持多实验批次(Runs)、修订版本号、异常值剔除、历史并排对比、按记录恢复实验条件、CSV/Markdown/JSON 导出与合并。
import { sampleStats, linearRegression } from './epistemic.js';

const DB_NAME = 'haiz-experimentarium-db';
const DB_VER = 1;
const STORE = 'records';
const LS_KEY = 'haiz-experimentarium-records-v1';
const LEGACY_KEY = 'haiz-lab-notebook-v1';

const $ = (s, r = document) => r.querySelector(s);
const fmt = (v, d = 3) => (typeof v === 'number' ? (Number.isFinite(v) ? v.toFixed(d) : '—') : v ?? '—');
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function openIDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no-idb'));
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'expId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function downloadFile(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function initJournal(ctx) {
  const { esc, subjects, onRestoreParams, onToggleState } = ctx;
  const box = $('#notebook');
  const btn = $('#bRec');
  let idb = null;
  let storageKind = 'localStorage';
  const db = {}; // expId -> { expId, activeRunId, runs: [...] }
  let exp = null;
  let sp = null;
  let isOpen = false;
  let compareMode = false;
  let compareIds = [];

  async function initStorage() {
    try {
      const rawLS = localStorage.getItem(LS_KEY);
      if (rawLS) Object.assign(db, JSON.parse(rawLS));
    } catch {}
    try {
      idb = await openIDB();
      storageKind = 'IndexedDB';
      const rows = await new Promise((res, rej) => {
        const tx = idb.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => rej(req.error);
      });
      for (const rec of rows) {
        if (rec && rec.expId) db[rec.expId] = rec;
      }
    } catch {
      storageKind = 'localStorage';
    }
    // 一次性只读导入旧版 lab/ 记录，不改写旧键
    try {
      const legacyFlag = localStorage.getItem(LS_KEY + ':legacy-imported');
      const legacyRaw = localStorage.getItem(LEGACY_KEY);
      if (!legacyFlag && legacyRaw) {
        const legacy = JSON.parse(legacyRaw);
        for (const [expId, val] of Object.entries(legacy || {})) {
          if ((val.rows?.length || Object.keys(val.notes || {}).length) && !db[expId]) {
            db[expId] = {
              expId,
              activeRunId: 'legacy-1',
              runs: [{
                runId: 'legacy-1',
                title: '旧版实验册导入批次',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                revision: 1,
                savedParams: {},
                hypothesis: '',
                rows: (val.rows || []).map((r) => ({ ...r, _kind: 'simulated', _excluded: false })),
                notes: { memo: val.notes?.memo || '', ...val.notes },
                errorReflection: '',
                conclusion: '',
              }],
            };
            await persistExp(expId);
          }
        }
        localStorage.setItem(LS_KEY + ':legacy-imported', '1');
      }
    } catch {}
    if (isOpen) render();
  }

  async function persistExp(expId) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(db)); } catch {}
    if (!idb) return;
    try {
      await new Promise((res, rej) => {
        const tx = idb.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(db[expId]);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    } catch {}
  }

  function ensureStore(e) {
    const entry = (db[e.id] ||= { expId: e.id, activeRunId: null, runs: [] });
    if (!entry.runs.length) {
      const r = createEmptyRun(e, '实验批次 #1');
      entry.runs.push(r);
      entry.activeRunId = r.runId;
    }
    if (!entry.runs.some((r) => r.runId === entry.activeRunId)) {
      entry.activeRunId = entry.runs[entry.runs.length - 1].runId;
    }
    return entry;
  }

  function createEmptyRun(e, title) {
    const now = new Date().toISOString();
    return {
      runId: uid(),
      title: title || `批次 #${(db[e.id]?.runs.length || 0) + 1}`,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      savedParams: sp?.params ? { ...sp.params } : {},
      hypothesis: '',
      rows: [],
      notes: {},
      errorReflection: '',
      conclusion: '',
    };
  }

  function activeRun(e) {
    const entry = ensureStore(e);
    return entry.runs.find((r) => r.runId === entry.activeRunId) || entry.runs[0];
  }

  function specOf(e) {
    if (e.record) return { kind: 'table', ...e.record };
    if (e.inquiry) return { kind: 'inquiry', ...e.inquiry };
    const cols = (e.controls || []).filter((c) => c.type !== 'button').map((c) => ({
      key: c.id, label: c.label || c.id, unit: c.unit || '',
      digits: String(c.step ?? 1).includes('.') ? String(c.step).split('.')[1].length : 0, of: c,
    }));
    return {
      kind: 'table', generic: true, title: '条件与观测记录', columns: cols,
      sample: (inst, p) => Object.fromEntries(cols.map((c) => [
        c.key,
        c.of.type === 'choice' ? c.of.options[p[c.key]] : c.of.type === 'toggle' ? (p[c.key] ? '开' : '关') : c.of.fmt ? c.of.fmt(p[c.key]) : p[c.key],
      ])),
      note: '按“记录一组”采集当前实验条件与读数，支持自由编辑、剔除异常值与保存历史批次。',
    };
  }

  function touchRun(run) {
    run.updatedAt = new Date().toISOString();
    run.revision = (run.revision || 1) + 1;
    if (sp?.params) run.savedParams = { ...sp.params };
  }

  function summarizeRun(spec, run) {
    const activeRows = run.rows.filter((r) => !r._excluded);
    const out = [];
    for (const c of (spec.columns || []).filter((col) => col.stat)) {
      const st = sampleStats(activeRows.map((r) => Number(r[c.key])));
      if (st.n) {
        const refTxt = Number.isFinite(c.ref)
          ? `；相对参考值 ${c.ref} 偏差 ${fmt((Math.abs(st.mean - c.ref) / Math.abs(c.ref)) * 100, 1)}%`
          : '';
        out.push([c.label, `均值 ${fmt(st.mean, (c.digits ?? 2) + 1)} ${c.unit || ''}${st.n > 1 ? `，SD ${fmt(st.sd, (c.digits ?? 2) + 1)} (n=${st.n})` : ' (n=1)'}${refTxt}`]);
      }
    }
    if (spec.summary && activeRows.length) {
      for (const pair of spec.summary(activeRows) || []) out.push(pair);
    }
    return out;
  }

  function render() {
    btn?.setAttribute('aria-pressed', String(isOpen));
    if (!box) return;
    box.hidden = !isOpen;
    onToggleState?.(isOpen);
    if (!isOpen || !exp) return;

    const entry = ensureStore(exp);
    const run = activeRun(exp);
    const spec = specOf(exp);
    const s = subjects[exp.meta?.subject || exp.subject] || { name: exp.subject };
    const activeCount = run.rows.filter((r) => !r._excluded).length;

    let html = `<button class="x" type="button" aria-label="关闭记录册">×</button>
      <div class="nb-head">
        <div><h3>实验记录册 · ${esc(s.name)} ${exp.no || ''}</h3><h2>${esc(exp.title)}</h2></div>
        <span class="nb-ver" title="结构版本 haiz-experiment-record/1">v${run.revision}</span>
      </div>`;

    // 批次管理栏
    html += `<div class="nb-runs">
      <label><span>批次</span><select id="nbRunSel">${entry.runs.map((r) => `<option value="${esc(r.runId)}"${r.runId === run.runId ? ' selected' : ''}>${esc(r.title)} (${r.rows.length}条 · rev.${r.revision})</option>`).join('')}</select></label>
      <div class="nb-run-btns">
        <button type="button" data-a="newRun" title="新建实验批次">+ 新批次</button>
        <button type="button" data-a="restoreParams" title="按此批次保存的参数恢复当前实验装置">恢复条件</button>
        <button type="button" data-a="toggleCompare" aria-pressed="${compareMode}" ${entry.runs.length < 2 ? 'disabled' : ''}>批次对比</button>
      </div>
    </div>`;

    if (compareMode && entry.runs.length >= 2) {
      const rA = entry.runs.find((r) => r.runId === compareIds[0]) || entry.runs[0];
      const rB = entry.runs.find((r) => r.runId === compareIds[1]) || entry.runs.find((r) => r.runId !== rA.runId) || entry.runs[1];
      const sumA = summarizeRun(spec, rA);
      const sumB = summarizeRun(spec, rB);
      html += `<div class="nb-compare">
        <h3>历史批次并排对比</h3>
        <div class="nb-cmp-pick">
          <select id="cmpA">${entry.runs.map((r) => `<option value="${esc(r.runId)}"${r.runId === rA.runId ? ' selected' : ''}>${esc(r.title)}</option>`).join('')}</select>
          <span>vs</span>
          <select id="cmpB">${entry.runs.map((r) => `<option value="${esc(r.runId)}"${r.runId === rB.runId ? ' selected' : ''}>${esc(r.title)}</option>`).join('')}</select>
        </div>
        <div class="nb-cmp-grid">
          <div><b>${esc(rA.title)}</b><small>有效数据 ${rA.rows.filter((x) => !x._excluded).length} 组</small><ul>${(sumA.length ? sumA : [['参数', JSON.stringify(rA.savedParams)]]).map(([k, v]) => `<li><b>${esc(k)}：</b>${esc(v)}</li>`).join('')}</ul><p><em>结论：</em>${esc(rA.conclusion || '未填写')}</p></div>
          <div><b>${esc(rB.title)}</b><small>有效数据 ${rB.rows.filter((x) => !x._excluded).length} 组</small><ul>${(sumB.length ? sumB : [['参数', JSON.stringify(rB.savedParams)]]).map(([k, v]) => `<li><b>${esc(k)}：</b>${esc(v)}</li>`).join('')}</ul><p><em>结论：</em>${esc(rB.conclusion || '未填写')}</p></div>
        </div>
      </div>`;
    }

    html += `<div class="nb-field"><label>批次名称</label><input type="text" data-meta="title" value="${esc(run.title)}"></div>`;
    html += `<div class="nb-field"><label>实验前假设 / 预期</label><textarea data-meta="hypothesis" rows="2" placeholder="在改变某个条件前，写下你的预测与判断依据…">${esc(run.hypothesis || '')}</textarea></div>`;

    if (spec.kind === 'table') {
      const cols = spec.columns;
      html += `<p class="nb-note">${esc(spec.note || '按“记录一组”将当前观测数据写入表格，可单击单元格直接修改或勾选剔除离群点。')}</p>
      <div class="nb-acts">
        <button type="button" data-a="add" class="act">记录一组</button>
        <button type="button" data-a="undo">删去末行</button>
        <button type="button" data-a="clearRun">清空本批</button>
        <button type="button" data-a="csv">导出 CSV</button>
        <button type="button" data-a="md">导出报告(.md)</button>
      </div>
      <div class="nb-scroll"><table><thead><tr><th>#</th><th>来源</th>${cols.map((c) => `<th>${esc(c.label)}${c.unit ? `<small> / ${esc(c.unit)}</small>` : ''}</th>`).join('')}<th>有效</th></tr></thead>
      <tbody>${run.rows.map((r, i) => `<tr class="${r._excluded ? 'excluded' : ''}">
        <td>${i + 1}</td>
        <td><span class="nb-kind">${esc(r._kind === 'human' ? '手测' : r._kind === 'measured' ? '参考' : '模型')}</span></td>
        ${cols.map((c) => `<td><input class="nb-cell" data-row="${i}" data-col="${esc(c.key)}" value="${esc(fmt(r[c.key], c.digits ?? 2))}" aria-label="${esc(c.label)}"></td>`).join('')}
        <td><input type="checkbox" data-excl="${i}" ${r._excluded ? '' : 'checked'} title="取消勾选可剔除此异常行"></td>
      </tr>`).join('') || `<tr><td colspan="${cols.length + 3}" class="empty">尚无测量数据（点击“记录一组”或器材直接记录）</td></tr>`}</tbody></table></div>`;

      const sum = summarizeRun(spec, run);
      if (sum.length) {
        html += `<h3>数据处理（有效样本 ${activeCount}/${run.rows.length}）</h3><dl class="nb-sum">${sum.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
      }
      if (spec.errors) html += `<h3>误差与反思提示</h3><ul class="nb-err">${spec.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`;
    } else {
      html += `<p class="nb-note">${esc(spec.note || '用证据说话：记录史料/材料、解释机制并与不同观点比较。')}</p>`;
      for (const st of spec.steps || []) {
        html += `<h3>${esc(st.label)}</h3><p class="nb-q">${esc(st.prompt)}</p>${st.hints ? `<ul class="nb-err">${st.hints.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}<textarea data-n="${esc(st.key)}" rows="3" placeholder="写下你的考据与判断…">${esc(run.notes[st.key] || '')}</textarea>`;
      }
      html += `<div class="nb-acts"><button type="button" data-a="md" class="act">导出研习报告(.md)</button><button type="button" data-a="clearRun">清空本批</button></div>`;
    }

    html += `<div class="nb-field"><label>误差分析与反思</label><textarea data-meta="errorReflection" rows="2" placeholder="实验偏离理想模型的原因、系统误差/偶然误差分析…">${esc(run.errorReflection || '')}</textarea></div>
      <div class="nb-field"><label>个人判断与实验结论</label><textarea data-meta="conclusion" rows="2" placeholder="基于以上证据与数据，你的结论是什么？">${esc(run.conclusion || '')}</textarea></div>
      <div class="nb-backup">
        <button type="button" data-a="exportAllJson">导出全册备份 (.json)</button>
        <label class="nb-import">导入合并备份<input type="file" id="nbImportFile" accept=".json" hidden></label>
      </div>
      <p class="nb-foot"><b>存储与隐私状态：</b>本地私有存储已启用（${esc(storageKind)} · 离线可用）；<b>HAIZ 云端账户同步：未接入</b>（生产 Supabase 当前仅开放 Pocket 快照表，实验手册独立 RLS 同步表尚处于草案待审阶段）。数据默认仅存本设备，严禁将模拟数据作为线下实体实验原始记录上交。</p>`;

    box.innerHTML = html;
    bindEvents(spec, entry, run);
  }

  function bindEvents(spec, entry, run) {
    box.querySelector('.x')?.addEventListener('click', () => api.close());
    box.querySelector('#nbRunSel')?.addEventListener('change', (ev) => {
      entry.activeRunId = ev.target.value;
      persistExp(exp.id);
      render();
    });
    box.querySelector('#cmpA')?.addEventListener('change', (ev) => { compareIds[0] = ev.target.value; render(); });
    box.querySelector('#cmpB')?.addEventListener('change', (ev) => { compareIds[1] = ev.target.value; render(); });

    box.querySelectorAll('[data-meta]').forEach((el) => {
      el.addEventListener('input', () => {
        run[el.dataset.meta] = el.value;
        touchRun(run);
        persistExp(exp.id);
      });
    });
    box.querySelectorAll('textarea[data-n]').forEach((el) => {
      el.addEventListener('input', () => {
        run.notes[el.dataset.n] = el.value;
        touchRun(run);
        persistExp(exp.id);
      });
    });
    box.querySelectorAll('input[data-row]').forEach((inp) => {
      inp.addEventListener('change', () => {
        const i = +inp.dataset.row, k = inp.dataset.col;
        const num = Number(inp.value);
        run.rows[i][k] = Number.isFinite(num) && inp.value.trim() !== '' ? num : inp.value;
        touchRun(run);
        persistExp(exp.id);
        render();
      });
    });
    box.querySelectorAll('input[data-excl]').forEach((chk) => {
      chk.addEventListener('change', () => {
        run.rows[+chk.dataset.excl]._excluded = !chk.checked;
        touchRun(run);
        persistExp(exp.id);
        render();
      });
    });
    box.querySelector('#nbImportFile')?.addEventListener('change', async (ev) => {
      const f = ev.target.files?.[0];
      if (!f) return;
      try {
        const parsed = JSON.parse(await f.text());
        if (parsed?.schema !== 'haiz-experiment-record/1' || !parsed.records) throw new Error('格式不匹配');
        for (const [eid, remoteRec] of Object.entries(parsed.records)) {
          const localRec = (db[eid] ||= { expId: eid, activeRunId: remoteRec.activeRunId, runs: [] });
          const seen = new Set(localRec.runs.map((r) => r.runId));
          for (const rr of remoteRec.runs || []) {
            if (!seen.has(rr.runId)) localRec.runs.push(rr);
          }
          await persistExp(eid);
        }
        render();
      } catch (e) {
        flash(`备份导入失败：${e.message}`);
      }
    });
    box.querySelectorAll('[data-a]').forEach((b) => {
      b.addEventListener('click', () => handleAction(b.dataset.a, spec, entry, run));
    });
  }

  function handleAction(a, spec, entry, run) {
    if (a === 'add') {
      const row = spec.sample?.(sp?.inst || {}, sp?.params || {});
      if (row) {
        run.rows.push({ _kind: row._kind || 'simulated', _excluded: false, ...row });
        touchRun(run);
        persistExp(exp.id);
        render();
      } else {
        flash(spec.pending || '请先在实验装置中完成操作或等待读数稳定后再记录。');
      }
    } else if (a === 'undo') {
      run.rows.pop();
      touchRun(run);
      persistExp(exp.id);
      render();
    } else if (a === 'clearRun') {
      run.rows = [];
      run.notes = {};
      run.errorReflection = '';
      run.conclusion = '';
      touchRun(run);
      persistExp(exp.id);
      render();
    } else if (a === 'newRun') {
      const nr = createEmptyRun(exp);
      entry.runs.push(nr);
      entry.activeRunId = nr.runId;
      persistExp(exp.id);
      render();
    } else if (a === 'restoreParams') {
      if (run.savedParams && Object.keys(run.savedParams).length) {
        onRestoreParams?.(run.savedParams);
      } else {
        flash('此批次尚未保存实验条件参数。');
      }
    } else if (a === 'toggleCompare') {
      compareMode = !compareMode;
      if (compareMode && entry.runs.length >= 2) {
        compareIds = [entry.runs[entry.runs.length - 2].runId, entry.runs[entry.runs.length - 1].runId];
      }
      render();
    } else if (a === 'csv') {
      const cols = spec.columns || [];
      const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const lines = [
        ['序号', '来源', '有效', ...cols.map((c) => c.label + (c.unit ? ` (${c.unit})` : ''))].map(q).join(','),
        ...run.rows.map((r, i) => [
          i + 1, r._kind || 'simulated', r._excluded ? '已剔除' : '有效',
          ...cols.map((c) => (typeof r[c.key] === 'number' ? fmt(r[c.key], c.digits ?? 2) : r[c.key])),
        ].map(q).join(',')),
      ];
      if (run.conclusion) lines.push('', q('实验结论'), q(run.conclusion));
      downloadFile(`HAIZ-${exp.id}-${run.title}.csv`, '\ufeff' + lines.join('\r\n'), 'text/csv;charset=utf-8');
    } else if (a === 'md') {
      const lines = [
        `# ${exp.title} — 实验报告`,
        `- 批次：${run.title} (rev.${run.revision})`,
        `- 时间：${run.updatedAt}`,
        `- 参数条件：\`${JSON.stringify(run.savedParams || {})}\``,
        '', `## 假设与预测`, run.hypothesis || '（未填写）', '',
      ];
      if (spec.kind === 'table') {
        const cols = spec.columns || [];
        lines.push('## 实验数据', `| # | 来源 | 状态 | ${cols.map((c) => c.label).join(' | ')} |`, `| --- | --- | --- | ${cols.map(() => '---').join(' | ')} |`);
        run.rows.forEach((r, i) => {
          lines.push(`| ${i + 1} | ${r._kind || 'simulated'} | ${r._excluded ? '剔除' : '有效'} | ${cols.map((c) => fmt(r[c.key], c.digits ?? 2)).join(' | ')} |`);
        });
        const sum = summarizeRun(spec, run);
        if (sum.length) lines.push('', '## 数据处理', ...sum.map(([k, v]) => `- **${k}**：${v}`));
      } else {
        for (const st of spec.steps || []) lines.push(`## ${st.label}`, `> ${st.prompt}`, '', run.notes[st.key] || '（未填写）', '');
      }
      lines.push('', '## 误差分析与反思', run.errorReflection || '（未填写）', '', '## 结论', run.conclusion || '（未填写）', '');
      downloadFile(`HAIZ-${exp.id}-report.md`, lines.join('\n'), 'text/markdown;charset=utf-8');
    } else if (a === 'exportAllJson') {
      const payload = {
        schema: 'haiz-experiment-record/1',
        exportedAt: new Date().toISOString(),
        records: db,
      };
      downloadFile(`HAIZ-Experimentarium-Journal-${new Date().toISOString().slice(0, 10)}.haiz-journal.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    }
  }

  function flash(msg) {
    const p = box?.querySelector('.nb-note') || box?.querySelector('.nb-runs');
    if (p) { const tip = document.createElement('p'); tip.className = 'nb-note warn'; tip.textContent = msg; p.after(tip); setTimeout(() => tip.remove(), 3500); }
  }

  initStorage();

  const api = {
    show(e, spread) { exp = e; sp = spread; compareMode = false; render(); },
    toggle() { isOpen = !isOpen; render(); },
    openPanel() { isOpen = true; render(); },
    close() { isOpen = false; render(); },
    push(e, row) {
      const run = activeRun(e);
      run.rows.push({ _kind: row._kind || 'simulated', _excluded: false, ...row });
      touchRun(run);
      persistExp(e.id);
      if (isOpen && exp?.id === e.id) render();
    },
    rows: (id) => {
      const entry = db[id];
      if (!entry?.runs?.length) return [];
      const r = entry.runs.find((x) => x.runId === entry.activeRunId) || entry.runs[entry.runs.length - 1];
      return r.rows.filter((x) => !x._excluded);
    },
    exportAll: () => ({ schema: 'haiz-experiment-record/1', storageKind, records: structuredClone(db) }),
    get open() { return isOpen; },
    get storageKind() { return storageKind; },
  };
  return api;
}
