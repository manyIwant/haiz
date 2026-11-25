/* ═══════════════════════════════════════════════════════════════════════
   JUDOU LAB · 应用外壳、路由、状态持久化与探索手记
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const J = new Judou.JudouEngine();
  const CHAPTER_ORDER = ['pendulum', 'quadratic', 'daynight', 'logic'];
  const NAV_ITEMS = [
    { id: 'cover', phrase: '翻开卷首目录' },
    { id: 'pendulum', phrase: '实验：单摆的等时性与边界' },
    { id: 'quadratic', phrase: '推演：二次函数的形与根' },
    { id: 'daynight', phrase: '观测：晨昏线与昼夜长短' },
    { id: 'logic', phrase: '辨析：条件、推理与句法重构' },
    { id: 'workbench', phrase: '检验：句读基础组件验收台' },
    { id: 'research', phrase: '阅读：设计研究与迭代手记' }
  ];

  const appState = {
    route: 'cover',
    theme: 'light',
    fontScaleIdx: 0, // 0: 1.0, 1: 1.12, 2: 1.24
    showGuide: false,
    coverVerb: 0,
    coverObj: 0,
    chapters: {}
  };

  function loadPersisted() {
    try {
      const saved = JSON.parse(localStorage.getItem('judou-lab-v2-state') || 'null');
      if (saved) {
        if (saved.theme) appState.theme = saved.theme;
        if (typeof saved.fontScaleIdx === 'number') appState.fontScaleIdx = saved.fontScaleIdx;
        if (saved.chapters) appState.chapters = saved.chapters;
      }
    } catch {}
    CHAPTER_ORDER.forEach((id) => {
      const ch = window.JudouChapters[id];
      if (!appState.chapters[id]) {
        appState.chapters[id] = ch.defaultState();
      }
      J.recordState(id, appState.chapters[id], '初始状态');
    });
  }

  function savePersisted() {
    try {
      localStorage.setItem(
        'judou-lab-v2-state',
        JSON.stringify({
          theme: appState.theme,
          fontScaleIdx: appState.fontScaleIdx,
          chapters: appState.chapters
        })
      );
    } catch {}
  }

  function applyThemeAndFont() {
    document.documentElement.dataset.theme = appState.theme;
    const scales = [1, 1.12, 1.24];
    document.documentElement.style.setProperty('--fs-scale', scales[appState.fontScaleIdx] || 1);
    const themeBtn = document.getElementById('btn-theme');
    if (themeBtn) themeBtn.textContent = appState.theme === 'dark' ? '日读' : '夜读';
  }

  function navigate(route) {
    const valid = NAV_ITEMS.some((n) => n.id === route);
    const nextRoute = valid ? route : 'cover';
    const prevCh = window.JudouChapters[appState.route];
    if (prevCh && prevCh.unmount) prevCh.unmount();

    appState.route = nextRoute;
    if (location.hash.slice(1) !== nextRoute) {
      history.pushState(null, '', '#' + nextRoute);
    }
    renderAll({ scrollTop: true });
  }

  function renderTopbar() {
    const navIdx = Math.max(0, NAV_ITEMS.findIndex((n) => n.id === appState.route));
    const tNav = J.choice('app-nav', {
      name: '导航',
      opts: NAV_ITEMS.map((n) => n.phrase),
      alwaysMenu: true,
      get: () => navIdx,
      set: (i) => { navigate(NAV_ITEMS[i].id); }
    });
    document.getElementById('brand-clause').innerHTML = `<span>我想</span> ${tNav}<span>。</span>`;

    const isCh = CHAPTER_ORDER.includes(appState.route);
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    const resetBtn = document.getElementById('btn-reset');
    if (undoBtn) undoBtn.disabled = !isCh || !J.canUndo(appState.route);
    if (redoBtn) redoBtn.disabled = !isCh || !J.canRedo(appState.route);
    if (resetBtn) resetBtn.disabled = !isCh;

    const mUndo = document.getElementById('mob-undo');
    if (mUndo) mUndo.disabled = !isCh || !J.canUndo(appState.route);
  }

  function renderCover() {
    const verbs = ['操作', '拆解', '改写'];
    const objs = ['一条物理定律', '一个代数方程', '一颗行星的光照', '一段汉语逻辑'];
    const targets = ['pendulum', 'quadratic', 'daynight', 'logic'];

    const tV = J.choice('cv-v', {
      name: '动作',
      opts: verbs,
      get: () => appState.coverVerb,
      set: (i) => { appState.coverVerb = i; }
    });
    const tO = J.choice('cv-o', {
      name: '对象',
      opts: objs,
      get: () => appState.coverObj,
      set: (i) => { appState.coverObj = i; }
    });
    const tGo = J.go('cv-go', {
      label: '立即进入这一章',
      onClick: () => navigate(targets[appState.coverObj])
    });

    const cards = CHAPTER_ORDER.map((id) => {
      const ch = window.JudouChapters[id];
      return `
        <button type="button" class="chapter-card" data-nav="${id}">
          <span class="tag">${Judou.esc(ch.kicker)}</span>
          <h3>${Judou.esc(ch.title)}</h3>
          <p>${Judou.esc(ch.lead)}</p>
        </button>
      `;
    }).join('');

    return `
      <section class="cover-hero">
        <div class="ch-kicker">JUDOU / 句读 · 中文原生交互设计实验 001</div>
        <h1 class="cover-title">可改写的教科书</h1>
        <p class="jing prose" style="max-width:44em">传统软件通过按钮、滑块与菜单接受意图；句读尝试把操作融入语言本身。在这里，文字不再只是旁观式的描述——${tV}${tO}，${tGo}。</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
          <button type="button" class="tool-btn" data-nav="workbench">进入组件验收台</button>
          <button type="button" class="tool-btn" data-nav="research">阅读设计研究手记</button>
        </div>
      </section>

      <h2 style="font-family:var(--sans);font-size:13px;letter-spacing:0.08em;color:var(--ink-3);margin:0 0 12px">四篇交互知识实验</h2>
      <div class="chapter-grid">${cards}</div>
    `;
  }

  function renderResearch() {
    return `
      <div class="ch-header">
        <div class="ch-kicker">设计研究与迭代手记 · DESIGN RESEARCH</div>
        <h1 class="ch-title">从第一代「句读」到可改写的教科书</h1>
        <p class="ch-lead">记录本次实验如何突破第一代词钮与句号提交机制，探索语言即界面、双向图文绑定与可逆知识推演。</p>
      </div>
      <article class="research-doc">
        <h2>一、对第一代句读（PR #108）的继承与超越</h2>
        <p>第一代句读确立了「横着读是句子（组合轴），竖着换是选择（聚合轴）」的核心隐喻，并用着重号、双行夹注与朱线疏建立了鲜明的中文版面识别度。然而，第一代实验主要聚焦于表单、导航与设置——即把既有的 GUI 控件翻译成句子。</p>
        <p>在第二代「可改写的教科书」中，我们探索更本质的问题：<b>当知识本身成为可操作媒介时，语言与模型如何双向耦合？</b></p>
        <ul>
          <li><b>从「换词」到「重构句法」</b>：在单摆、二次函数与逻辑篇章中，改变核心参数不仅重算数字，还会在边界处触发句子语法结构的自我重写（如摆角超过 5° 时从等时性断言转为偏差警告；二次项系数归零时抛物线退化为直线）。</li>
          <li><b>从「静态公式」到「可拆解、可变形的公式」</b>：公式中的符号可点击展开物理/代数意义，且解析式可在「一般式 / 顶点式 / 交点式」或「近似式 / 椭圆积分式」之间切换。</li>
          <li><b>因果溯源（Causal Trace）</b>：悬停或聚焦任意结论词组，系统即刻点亮其上游依赖的前提条件，让「为什么成立」成为直观的空间反馈。</li>
          <li><b>双向图文绑定</b>：不仅改文字会驱动物理摆、抛物线与地球晨昏线，直接拖动图形中的摆球、顶点或纬线也会反向改写正文与公式。</li>
        </ul>

        <h2>二、科学模型与边界说明</h2>
        <ul>
          <li><b>单摆</b>：采用第一类完全椭圆积分的算术-几何平均（AGM）计算任意摆角（0°–85°）下的精确周期，并与小角度近似对比误差百分比。</li>
          <li><b>二次函数</b>：严格计算顶点、判别式与实/复根，在 Δ &lt; 0 时拒绝生成实数交点式并就地给出夹注解释。</li>
          <li><b>昼夜长短</b>：依据球面天文公式 cos ω₀ = −tan φ · tan δ 计算日出日落时刻、昼弧比例与正午太阳高度，完整覆盖极昼与极夜边界。</li>
          <li><b>逻辑与句法</b>：基于凸四边形性质集合（平行、等边、直角）精确判定充分条件是否成立，并在不成立时自动生成几何反例。</li>
        </ul>

        <h2>三、浏览器实测与自我批判（第一轮 → 第二轮改进）</h2>
        <p>在完成首轮实现并经桌面（1440×900）与手机（390×844）浏览器实测后，我们修正了以下问题：</p>
        <ul>
          <li><b>数钮在触屏上的发现性与精度冲突</b>：纯靠拖动数钮在手机上难以精确输入特定小数。第二轮为 <code>.jw-num</code> 增加了 <code>↕</code> 视觉提示，并支持「拖动快调 + 点击弹出精确输入框与 ± 微调」的双模态操作。</li>
          <li><b>长句对比困难</b>：学生修改参数后容易忘记之前的结论。第二轮在右栏加入了「探索手记（Snapshots）」与「双快照并排比较」，并实现完整 Undo / Redo 历史栈。</li>
        </ul>
      </article>
    `;
  }

  function renderMargin(chId) {
    const ch = window.JudouChapters[chId];
    if (!ch) return '';
    const snaps = J.getSnapshots(chId);
    const pair = J.getComparePair(chId);
    const selIds = J.compareSelection[chId] || [];

    const snapHtml = snaps.length
      ? snaps
          .map((s) => {
            const isSel = selIds.includes(s.id);
            return `
              <div class="snapshot-item ${isSel ? 'selected' : ''}">
                <div><b>${Judou.esc(s.summary)}</b></div>
                <div style="color:var(--ink-3);font-size:11.5px">${Judou.esc(s.time)}</div>
                <div class="snapshot-actions">
                  <button type="button" data-snap-restore="${s.id}">恢复此态</button>
                  <button type="button" data-snap-cmp="${s.id}">${isSel ? '取消对比' : '加入对比'}</button>
                  <button type="button" data-snap-del="${s.id}" style="color:var(--ink-3)">删去</button>
                </div>
              </div>
            `;
          })
          .join('')
      : '<div style="color:var(--ink-3);font-size:12.5px">尚未记录快照。调整参数后点击「记下此刻」，即可在此保存并比较不同实验条件。</div>';

    let compareHtml = '';
    if (pair.length === 2) {
      const keys = Object.keys(pair[0].metrics || {});
      compareHtml = `
        <div class="margin-card">
          <div class="margin-title"><span>双态对比</span></div>
          <table class="j-table" style="font-size:12px">
            <thead><tr><th>指标</th><th>记录 A</th><th>记录 B</th></tr></thead>
            <tbody>
              ${keys.map((k) => `<tr><td>${Judou.esc(k)}</td><td>${Judou.esc(pair[0].metrics[k] ?? '—')}</td><td>${Judou.esc(pair[1].metrics[k] ?? '—')}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    return `
      <div class="margin-card">
        <div class="margin-title"><span>简化条件与适用范围</span></div>
        <div class="margin-body">${ch.boundsHtml()}</div>
      </div>

      <div class="margin-card">
        <div class="margin-title">
          <span>探索手记（${snaps.length}）</span>
          <button type="button" class="tool-btn" id="btn-snapshot" style="padding:3px 9px;min-height:26px">记下此刻</button>
        </div>
        <div class="snapshot-list">${snapHtml}</div>
      </div>

      ${compareHtml}
    `;
  }

  function renderAll(opts = {}) {
    J.clearDefs();
    renderTopbar();

    const ws = document.getElementById('workspace');
    const main = document.getElementById('main-col');
    const margin = document.getElementById('margin-col');

    const isCh = CHAPTER_ORDER.includes(appState.route);
    ws.classList.toggle('single-col', !isCh);
    margin.style.display = isCh ? 'flex' : 'none';

    if (appState.route === 'cover') {
      main.innerHTML = renderCover();
    } else if (appState.route === 'workbench') {
      main.innerHTML = window.JudouWorkbench.render(J, () => renderAll());
      window.JudouWorkbench.afterRender(() => renderAll());
    } else if (appState.route === 'research') {
      main.innerHTML = renderResearch();
    } else if (isCh) {
      const ch = window.JudouChapters[appState.route];
      const st = appState.chapters[appState.route];
      J.recordState(appState.route, st);
      savePersisted();

      main.innerHTML = `
        <div class="ch-header">
          <div class="ch-kicker">${Judou.esc(ch.kicker)}</div>
          <h1 class="ch-title">${Judou.esc(ch.title)}</h1>
          <p class="ch-lead">${Judou.esc(ch.lead)}</p>
        </div>
        ${ch.render(J, st, () => renderAll())}
      `;
      margin.innerHTML = renderMargin(appState.route);
      ch.afterRender?.(J, st, () => renderAll());
    }

    if (opts.focusId) {
      const el = document.querySelector(`[data-jid="${CSS.escape(opts.focusId)}"]`);
      el?.focus({ preventScroll: true });
    }
    if (opts.scrollTop) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }

  function initEvents() {
    J.onRender = (opts) => renderAll(opts);
    J.onLog = (entry) => window.JudouWorkbench?.recordLog(entry);
    J.mountInteractions();

    document.getElementById('brand-home').addEventListener('click', () => navigate('cover'));

    document.addEventListener('click', (e) => {
      const navEl = e.target.closest('[data-nav]');
      if (navEl) {
        navigate(navEl.dataset.nav);
        return;
      }

      const snapBtn = e.target.closest('#btn-snapshot, #mob-snap');
      if (snapBtn && CHAPTER_ORDER.includes(appState.route)) {
        const ch = window.JudouChapters[appState.route];
        const st = appState.chapters[appState.route];
        J.addSnapshot(appState.route, ch.summaryOf(st), st, ch.metricsOf(st));
        renderAll();
        return;
      }

      const resBtn = e.target.closest('[data-snap-restore]');
      if (resBtn && CHAPTER_ORDER.includes(appState.route)) {
        const snap = J.getSnapshots(appState.route).find((s) => s.id === resBtn.dataset.snapRestore);
        if (snap) {
          appState.chapters[appState.route] = JSON.parse(JSON.stringify(snap.state));
          J.announce('已恢复快照：' + snap.summary);
          renderAll();
        }
        return;
      }

      const cmpBtn = e.target.closest('[data-snap-cmp]');
      if (cmpBtn && CHAPTER_ORDER.includes(appState.route)) {
        J.toggleCompare(appState.route, cmpBtn.dataset.snapCmp);
        renderAll();
        return;
      }

      const delBtn = e.target.closest('[data-snap-del]');
      if (delBtn && CHAPTER_ORDER.includes(appState.route)) {
        J.deleteSnapshot(appState.route, delBtn.dataset.snapDel);
        renderAll();
      }
    });

    const doUndo = () => {
      if (!CHAPTER_ORDER.includes(appState.route)) return;
      J.undo(appState.route, (prev) => {
        appState.chapters[appState.route] = prev;
        renderAll();
      });
    };

    const doRedo = () => {
      if (!CHAPTER_ORDER.includes(appState.route)) return;
      J.redo(appState.route, (next) => {
        appState.chapters[appState.route] = next;
        renderAll();
      });
    };

    document.getElementById('btn-undo').addEventListener('click', doUndo);
    document.getElementById('mob-undo').addEventListener('click', doUndo);
    document.getElementById('btn-redo').addEventListener('click', doRedo);

    document.getElementById('btn-reset').addEventListener('click', () => {
      if (!CHAPTER_ORDER.includes(appState.route)) return;
      const ch = window.JudouChapters[appState.route];
      appState.chapters[appState.route] = ch.defaultState();
      J.announce('已重置本章参数');
      renderAll();
    });

    document.getElementById('btn-theme').addEventListener('click', () => {
      appState.theme = appState.theme === 'dark' ? 'light' : 'dark';
      applyThemeAndFont();
      savePersisted();
    });

    document.getElementById('btn-font').addEventListener('click', () => {
      appState.fontScaleIdx = (appState.fontScaleIdx + 1) % 3;
      applyThemeAndFont();
      savePersisted();
    });

    document.getElementById('btn-guide').addEventListener('click', () => {
      appState.showGuide = !appState.showGuide;
      document.getElementById('guide-strip').hidden = !appState.showGuide;
      document.getElementById('btn-guide').classList.toggle('active', appState.showGuide);
    });

    document.getElementById('mob-next').addEventListener('click', () => {
      const idx = CHAPTER_ORDER.indexOf(appState.route);
      const next = CHAPTER_ORDER[(idx + 1) % CHAPTER_ORDER.length];
      navigate(next);
    });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) doRedo();
        else doUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        doRedo();
      }
    });

    window.addEventListener('popstate', () => {
      const r = location.hash.slice(1) || 'cover';
      if (r !== appState.route) {
        appState.route = NAV_ITEMS.some((n) => n.id === r) ? r : 'cover';
        renderAll({ scrollTop: true });
      }
    });
  }

  loadPersisted();
  applyThemeAndFont();
  initEvents();

  const initialHash = location.hash.slice(1);
  if (NAV_ITEMS.some((n) => n.id === initialHash)) {
    appState.route = initialHash;
  }
  renderAll({ scrollTop: false });
})();
