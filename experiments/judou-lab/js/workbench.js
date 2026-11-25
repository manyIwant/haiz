/* ═══════════════════════════════════════════════════════════════════════
   JUDOU WORKBENCH · 句读二代组件与交互验收台
   Tests all core primitives in isolation with live event logging.
   ═══════════════════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  const benchState = {
    wordIdx: 0,
    numVal: 42,
    syntaxIdx: 0,
    unfolded: false,
    logs: []
  };

  function renderWorkbench(J, rerender) {
    const tChoice = J.choice('wb-choice', {
      name: '聚合词钮',
      opts: ['着重号（选择）', '双行夹注（注释）', '推演疏（展开）', '句读标点（状态）'],
      notes: ['竖向聚合', '句内嵌注', '段落展开', '落定与边界'],
      get: () => benchState.wordIdx,
      set: (i) => { benchState.wordIdx = i; }
    });

    const tNum = J.num('wb-num', {
      name: '推敲数钮',
      min: 0,
      max: 100,
      step: 2,
      unit: ' %',
      get: () => benchState.numVal,
      set: (v) => { benchState.numVal = v; }
    });

    const tSyntax = J.syntax('wb-syntax', {
      name: '句构切换',
      opts: ['陈述结构', '条件结构', '反诘结构'],
      get: () => benchState.syntaxIdx,
      set: (i) => { benchState.syntaxIdx = i; }
    });

    const tUnfold = J.unfold('wb-unfold', {
      label: benchState.unfolded ? '收起内嵌疏' : '展开内嵌疏',
      expanded: () => benchState.unfolded,
      toggle: () => { benchState.unfolded = !benchState.unfolded; }
    });

    const syntaxExamples = [
      `当前以「${tChoice}」为核心，权重设为 ${tNum}。`,
      `只要将权重调至 ${tNum}，「${tChoice}」便会触发边界响应。`,
      `若不调整 ${tNum}，难道「${tChoice}」还能自行成立吗？`
    ];

    const logHtml = benchState.logs.length
      ? benchState.logs.slice(0, 14).map((l) => `<div>[${Judou.esc(l.time)}] <b>${Judou.esc(l.kind)}</b> → ${Judou.esc(l.detail)}</div>`).join('')
      : '<div style="color:var(--ink-3)">尚无交互事件，请操作左侧任意组件（支持点击、拖动、Tab + 方向键）。</div>';

    return `
      <div class="ch-header">
        <div class="ch-kicker">组件与交互验收台 · ACCEPTANCE BENCH</div>
        <h1 class="ch-title">句读基础原语测试场</h1>
        <p class="ch-lead">在此独立检验每一类句读原语的视觉识别、键盘无障碍（Tab / ↑↓ / Enter / Esc）、触屏/指针拖动与因果溯源高亮。</p>
      </div>

      <div class="bench-grid">
        <div class="bench-card">
          <h4>1. 聚合词钮（Paradigmatic Choice）</h4>
          <p class="jing prose">测试词：${tChoice}。支持点击展开聚合栏，或聚焦后按 ↑ / ↓ 键直接轮换。</p>
        </div>

        <div class="bench-card">
          <h4>2. 推敲数钮（Scrubbable Number）</h4>
          <p class="jing prose">当前数值：${tNum}。支持左右/上下直接拖动，点击可打开精确输入与微调浮层，聚焦后支持方向键。</p>
        </div>

        <div class="bench-card">
          <h4>3. 句构钮（Syntactic Switch）与条件重写</h4>
          <p class="jing prose">切换语法骨架：${tSyntax}</p>
          <p class="jing prose rewritten" style="margin-top:8px">${syntaxExamples[benchState.syntaxIdx]}</p>
        </div>

        <div class="bench-card">
          <h4>4. 因果溯源（Causal Trace）与展开疏</h4>
          <p class="jing prose">悬停或聚焦 ${J.dep('wb-dep', { label: '此结论', sources: ['wb-choice', 'wb-num'] })} 可反向点亮上游依赖的词钮与数钮。 ${tUnfold}</p>
          ${benchState.unfolded ? '<div class="shu indigo"><p class="shu-note" style="margin:0">这是一段动态展开的「疏」：在正文需要时出现，不打断正常阅读的视觉流。</p></div>' : ''}
        </div>
      </div>

      <div class="bench-card" style="margin-top:18px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h4 style="margin:0">实时交互事件流（Event Log）</h4>
          <button type="button" class="tool-btn" id="wb-clear-log">清空日志</button>
        </div>
        <div class="event-log" id="wb-log">${logHtml}</div>
      </div>
    `;
  }

  function recordBenchLog(entry) {
    benchState.logs.unshift(entry);
    if (benchState.logs.length > 40) benchState.logs.pop();
    const el = document.getElementById('wb-log');
    if (el) {
      el.innerHTML = benchState.logs
        .slice(0, 14)
        .map((l) => `<div>[${Judou.esc(l.time)}] <b>${Judou.esc(l.kind)}</b> → ${Judou.esc(l.detail)}</div>`)
        .join('');
    }
  }

  function afterRenderWorkbench(rerender) {
    const clr = document.getElementById('wb-clear-log');
    if (clr) {
      clr.addEventListener('click', () => {
        benchState.logs = [];
        rerender();
      });
    }
  }

  global.JudouWorkbench = {
    render: renderWorkbench,
    afterRender: afterRenderWorkbench,
    recordLog: recordBenchLog
  };
})(window);
