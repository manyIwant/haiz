// HAIZ · EXPERIMENTARIUM — 目录导航、覆盖矩阵总览与教师备课面板
const LEVEL_LABEL = { L4: 'L4 开放探究', L3: 'L3 完整实验', L2: 'L2 交互模拟', L1: 'L1 动态演示', L0: 'L0 资料/规划' };
const KIND_LABEL = { must: '课标必做', lab: '教材实验', inquiry: '证据探究', model: '学科建模', reference: '知识资料' };
const STAGE_LABEL = { bx: '必修', xb: '选择性必修', tz: '拓展' };

export function initMatrixAndToc(ctx) {
  const { esc, catalog, onOpenExp } = ctx;
  const toc = document.querySelector('#toc');
  const tocList = document.querySelector('#tocList');
  const tocFilter = document.querySelector('#tocFilter');
  const tocCount = document.querySelector('#tocCount');
  const teach = document.querySelector('#teach');
  const matrixModal = document.querySelector('#matrixModal');

  const filt = { stage: '', kind: '', level: '', q: '' };
  const mFilt = { subject: '', status: '', mustOnly: false, q: '' };

  function renderToc(curExpId) {
    if (!tocList) return;
    tocList.innerHTML = '';
    const q = filt.q.trim().toLowerCase();
    let shown = 0;
    for (const s of Object.values(catalog.subjects)) {
      const items = catalog.completed.filter((meta) => {
        const c = meta.curriculum, impl = meta.implementation;
        return meta.subject === s.id
          && (!filt.stage || c.stage === filt.stage)
          && (!filt.kind || c.activityType === filt.kind)
          && (!filt.level || impl.currentLevel === filt.level)
          && (!q || `${meta.title} ${meta.en} ${s.name} ${c.chapter} ${c.module}`.toLowerCase().includes(q));
      });
      if (!items.length) continue;
      shown += items.length;
      const sec = document.createElement('section');
      sec.className = 'toc-sub';
      sec.style.setProperty('--subj', s.color);
      sec.innerHTML = `<h3><i></i>${esc(s.name)}<em>${esc(s.en)} (${items.length})</em></h3>`;
      for (const meta of items) {
        const c = meta.curriculum, impl = meta.implementation;
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.id = meta.id;
        b.setAttribute('aria-current', String(curExpId === meta.id));
        b.innerHTML = `<b>${meta.no}</b><span class="t">${esc(meta.title)}<small>${esc(STAGE_LABEL[c.stage] || c.stage)} · ${esc(KIND_LABEL[c.activityType] || c.activityType)} · ${esc(impl.currentLevel)}</small></span><span class="e">${esc(meta.en)}</span>`;
        b.addEventListener('click', () => { toc.hidden = true; onOpenExp(meta.id); });
        sec.append(b);
      }
      tocList.append(sec);
    }
    tocCount.textContent = `已实装交互实验 ${shown} / ${catalog.completed.length} 项（全学科矩阵共登记 ${catalog.allItems.length} 项，含 ${catalog.allItems.length - catalog.completed.length} 项 L0 资料/规划）`;
  }

  function initTocFilters(curGetter) {
    if (!tocFilter) return;
    tocFilter.innerHTML = '';
    const addGroup = (name, key, opts) => {
      const g = document.createElement('div');
      g.className = 'chips';
      g.setAttribute('role', 'group');
      g.setAttribute('aria-label', name);
      g.innerHTML = `<span>${name}</span>`;
      for (const [v, lbl] of [['', '全部'], ...opts]) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = lbl;
        b.setAttribute('aria-pressed', String(filt[key] === v));
        b.addEventListener('click', () => {
          filt[key] = v;
          g.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
          renderToc(curGetter());
        });
        g.append(b);
      }
      tocFilter.append(g);
    };
    addGroup('学段', 'stage', [['bx', '必修'], ['xb', '选择性必修'], ['tz', '拓展']]);
    addGroup('类型', 'kind', [['must', '课标必做'], ['lab', '教材实验'], ['model', '学科建模'], ['inquiry', '证据探究']]);
    addGroup('等级', 'level', [['L4', 'L4 开放探究'], ['L3', 'L3 完整实验']]);
    const inp = document.createElement('input');
    inp.type = 'search';
    inp.placeholder = '搜索实验、章节、模块…';
    inp.setAttribute('aria-label', '搜索实验');
    inp.addEventListener('input', () => { filt.q = inp.value; renderToc(curGetter()); });
    tocFilter.append(inp);
  }

  function renderMatrix() {
    if (!matrixModal || matrixModal.hidden) return;
    const st = catalog.stats;
    const q = mFilt.q.trim().toLowerCase();
    const list = catalog.allItems.filter((m) => {
      const okSub = !mFilt.subject || m.subject === mFilt.subject;
      const okStat = !mFilt.status || (mFilt.status === 'done' ? m.implementation.status === 'completed' : m.implementation.status !== 'completed');
      const okMust = !mFilt.mustOnly || m.curriculum.isCoreCurriculumExperiment;
      const okQ = !q || `${m.id} ${m.title} ${m.en} ${m.curriculum.chapter} ${m.science.modelSummary}`.toLowerCase().includes(q);
      return okSub && okStat && okMust && okQ;
    });

    const subCards = Object.values(catalog.subjects).map((s) => {
      const subAll = catalog.allItems.filter((x) => x.subject === s.id);
      const subDone = subAll.filter((x) => x.implementation.status === 'completed').length;
      const verified = s.editionVerificationStatus === 'confirmed-national-unified' ? '国家统编版已确认' : '省主流版·待核对校本征订';
      return `<button type="button" class="mx-sub ${mFilt.subject === s.id ? 'on' : ''}" data-msub="${s.id}" style="--subj:${s.color}">
        <b>${esc(s.name)}</b><span>${subDone}/${subAll.length} 已完成</span><small>${esc(verified)}</small>
      </button>`;
    }).join('');

    matrixModal.querySelector('.mx-body').innerHTML = `
      <div class="mx-kpis">
        <div><b>${st.completedItems}</b><span>已实装实验 (L3: ${st.byLevel.L3} · L4: ${st.byLevel.L4})</span></div>
        <div><b>${st.physicsMandatoryCovered} / 21</b><span>物理课标必做覆盖</span></div>
        <div><b>${st.chemistryMandatoryCompleted} / ${st.chemistryMandatoryRegistered}</b><span>化学课标必做完成/登记</span></div>
        <div><b>${st.plannedOrReferenceItems}</b><span>如实标注 L0 资料/待开发</span></div>
      </div>
      <p class="mx-policy">${esc(catalog.editionPolicy.provincialSelectionNotice)}</p>
      <div class="mx-subs"><button type="button" class="mx-sub ${!mFilt.subject ? 'on' : ''}" data-msub=""><b>全部 11 学科</b><span>${st.completedItems}/${st.totalItems}</span><small>点击筛选</small></button>${subCards}</div>
      <div class="mx-bar">
        <button type="button" data-mstat="" aria-pressed="${mFilt.status === ''}">全部 (${st.totalItems})</button>
        <button type="button" data-mstat="done" aria-pressed="${mFilt.status === 'done'}">已实装 L3/L4 (${st.completedItems})</button>
        <button type="button" data-mstat="todo" aria-pressed="${mFilt.status === 'todo'}">L0 资料/待开发 (${st.plannedOrReferenceItems})</button>
        <button type="button" data-mmust="1" aria-pressed="${mFilt.mustOnly}">仅看核心课标实验</button>
        <input type="search" id="mxSearch" value="${esc(mFilt.q)}" placeholder="按 ID、章节、模型关键词筛选…">
      </div>
      <div class="mx-table-wrap"><table class="mx-table">
        <thead><tr><th>学科</th><th>名称与课程定位</th><th>教材版本与核查状态</th><th>等级</th><th>科学模型与边界</th><th>操作</th></tr></thead>
        <tbody>${list.map((m) => {
          const s = catalog.subjects[m.subject], c = m.curriculum, impl = m.implementation;
          const edTag = c.editionVerificationStatus === 'confirmed-national-unified' ? '统编已确认' : '待校单核对';
          const done = impl.status === 'completed';
          return `<tr class="${done ? '' : 'mx-todo'}">
            <td><span class="mx-dot" style="background:${s.color}"></span>${esc(s.name)}</td>
            <td><b>${esc(m.title)}</b><br><small>${esc(c.module)} · ${esc(c.chapter)}</small></td>
            <td><small>${esc(c.primaryEdition.split('（')[0])}<br><em>${edTag}${c.hainanAlternates?.length ? ` · 海南并行:${esc(c.hainanAlternates[0].split('（')[0])}` : ''}</em></small></td>
            <td><span class="mx-lvl lvl-${impl.currentLevel}">${esc(LEVEL_LABEL[impl.currentLevel] || impl.currentLevel)}</span></td>
            <td><small>${esc(m.science.modelSummary)}</small></td>
            <td>${done ? `<button type="button" class="mx-go" data-open="${esc(m.id)}">打开实验 ↗</button>` : `<span class="mx-na">待开发</span>`}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>`;

    matrixModal.querySelectorAll('[data-msub]').forEach((b) => b.addEventListener('click', () => { mFilt.subject = b.dataset.msub; renderMatrix(); }));
    matrixModal.querySelectorAll('[data-mstat]').forEach((b) => b.addEventListener('click', () => { mFilt.status = b.dataset.mstat; renderMatrix(); }));
    matrixModal.querySelector('[data-mmust]')?.addEventListener('click', () => { mFilt.mustOnly = !mFilt.mustOnly; renderMatrix(); });
    matrixModal.querySelector('#mxSearch')?.addEventListener('input', (ev) => { mFilt.q = ev.target.value; renderMatrix(); });
    matrixModal.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => { matrixModal.hidden = true; onOpenExp(b.dataset.open); }));
  }

  function renderTeach(exp, open) {
    if (!teach) return;
    teach.hidden = !open;
    document.querySelector('#bTeach')?.setAttribute('aria-pressed', String(open));
    if (!open || !exp) return;
    const meta = exp.meta || {}, c = meta.curriculum || {}, t = exp.teach || {}, s = catalog.subjects[exp.subject] || {};
    const edStatus = c.editionVerificationStatus === 'confirmed-national-unified'
      ? '国家统编教材（海南中学统一使用，已核实）'
      : `海南省主流参照版本（待对照海南中学当学期内部征订书单核实；省目录并行参考：${(c.hainanAlternates || []).join('、') || '无'}）`;
    teach.innerHTML = `<button class="x" type="button" aria-label="关闭教师备课">×</button>
      <h3>教师备课 · ${esc(s.name)} ${exp.no}</h3>
      <h2>${esc(exp.title)}</h2>
      <h3>课程定位与完成等级</h3>
      <p><b>${esc(LEVEL_LABEL[meta.implementation?.currentLevel || 'L3'])}</b> · ${esc(STAGE_LABEL[c.stage] || '')} · ${esc(c.grade || '')} · ${c.isCoreCurriculumExperiment ? '课标核心实验' : '教材/探究活动'}</p>
      <p>${esc(c.module || '')} · ${esc(c.chapter || t.where || '')}</p>
      <p class="basis">${esc(edStatus)}</p>
      ${meta.pedagogy?.objectives?.length ? `<h3>教学目标</h3><ul>${meta.pedagogy.objectives.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}
      ${t.ask?.length ? `<h3>课堂追问</h3><ul>${t.ask.map((q) => `<li>${esc(q)}</li>`).join('')}</ul>` : ''}
      ${t.simplify ? `<h3>模型边界与近似说明</h3><p>${esc(t.simplify)}</p>` : ''}
      ${t.safety || meta.governance?.safetyBoundary ? `<h3>安全与教学提示</h3><p class="warn">${esc(t.safety || meta.governance.safetyBoundary)}</p>` : ''}
      ${meta.science?.sources?.length ? `<h3>依据来源</h3><p class="basis">${meta.science.sources.map((x) => esc(x)).join('；')}</p>` : ''}`;
    teach.querySelector('.x')?.addEventListener('click', () => { ctx.closeTeach(); });
  }

  return { initTocFilters, renderToc, renderMatrix, renderTeach };
}
