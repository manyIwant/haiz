/* ═══════════════════════════════════════════════════════════════════════
   篇章四 · 逻辑与语言：《条件、推理与句法重构》
   Models:
   1. Exact Quadrilateral Set-Inclusion & Counterexample Engine
   2. Chinese Syntactic Frame & Presupposition Engine
   ═══════════════════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  const SHAPES = [
    { id: 'para', name: '平行四边形', props: { para: true, eqSides: false, rightAngles: false } },
    { id: 'rect', name: '矩形', props: { para: true, eqSides: false, rightAngles: true } },
    { id: 'rhom', name: '菱形', props: { para: true, eqSides: true, rightAngles: false } },
    { id: 'sq', name: '正方形', props: { para: true, eqSides: true, rightAngles: true } }
  ];

  const CONDS = [
    { name: '无附加条件', add: {} },
    { name: '对角线互相垂直', add: { eqSides: true } },
    { name: '对角线相等', add: { rightAngles: true } },
    { name: '既有直角又邻边相等', add: { eqSides: true, rightAngles: true } }
  ];

  function evalLogic(s) {
    const base = SHAPES[s.base];
    const cond = CONDS[s.cond];
    const target = SHAPES[s.target];
    const combined = {
      para: base.props.para,
      eqSides: base.props.eqSides || !!cond.add.eqSides,
      rightAngles: base.props.rightAngles || !!cond.add.rightAngles
    };

    const valid =
      (!target.props.para || combined.para) &&
      (!target.props.eqSides || combined.eqSides) &&
      (!target.props.rightAngles || combined.rightAngles);

    let counterexample = '';
    if (!valid) {
      if (combined.rightAngles && !combined.eqSides) {
        counterexample = '反例：邻边为 3 与 5 的普通矩形满足全部前提，但四边不相等，故不是' + target.name + '。';
      } else if (combined.eqSides && !combined.rightAngles) {
        counterexample = '反例：内角为 60° 与 120° 的菱形满足全部前提，但没有直角，故不是' + target.name + '。';
      } else {
        counterexample = '反例：内角 60°、邻边 3 与 5 的普通平行四边形满足前提，既无直角也非等边，故不是' + target.name + '。';
      }
    }

    return { base, cond, target, combined, valid, counterexample };
  }

  const SYNTAX_FRAMES = [
    {
      name: '因果句（因为…所以…）',
      transformQ: (q) => q,
      render: (P, Q) => `因为 ${P}，所以 ${Q}。`,
      logic: 'P 现且 Q 现，预设 P 是 Q 发生的充分原因。',
      focus: '客观因果链条',
      tone: '平实陈述，因果自足'
    },
    {
      name: '让步转折句（尽管…却…）',
      transformQ: (q) => q.replace('结出了', '却并未结出').replace('挂满', '却未挂').replace('凝成', '却未凝成'),
      render: (P, Q) => `尽管 ${P}，${Q}。`,
      logic: 'P 成立但 ¬Q 成立（P ∧ ¬Q），直接打破「P → Q」的常规预期。',
      focus: '反常与例外',
      tone: '强调冲突，引起追问'
    },
    {
      name: '充分条件句（只要…就…）',
      transformQ: (q) => q.replace('结出了', '就必然结出').replace('挂满', '就必然挂满').replace('凝成', '就必然凝成'),
      render: (P, Q) => `只要 ${P}，${Q}。`,
      logic: 'P → Q（P 足以保证 Q，但 Q 发生未必只能靠 P）。',
      focus: '前提的充分性',
      tone: '规律性断言，适用面广'
    },
    {
      name: '必要条件句（只有…才…）',
      transformQ: (q) => q.replace('结出了', '才可能结出').replace('挂满', '才可能挂满').replace('凝成', '才可能凝成'),
      render: (P, Q) => `只有 ${P}，${Q}。`,
      logic: 'Q → P（等价于 ¬P → ¬Q：没有 P 就绝无 Q，但有 P 未必够）。',
      focus: '不可或缺的门槛',
      tone: '收紧条件，排除其他路径'
    },
    {
      name: '反问句（既然…难道不…吗）',
      transformQ: (q) => q.replace('结出了', '不会结出').replace('挂满', '不会挂满').replace('凝成', '不会凝成'),
      render: (P, Q) => `既然 ${P}，难道 ${Q}吗？`,
      logic: '以 P 为既定事实，通过否定式疑问强迫听者承认 Q。',
      focus: '话语压迫感与共识预设',
      tone: '修辞强烈，不适用于客观证明'
    }
  ];

  const PREMISES = ['夜晚气温骤降至零下', '持续吹起干冷北风', '水面完全静止无波'];
  const RESULTS = ['湖面结出了薄冰', '岸边芦苇挂满白霜', '水气凝成一层薄雾'];

  const chapter = {
    id: 'logic',
    kicker: '篇章四 · 逻辑与汉语语法',
    title: '条件、推理与句法重构',
    lead: '句读不仅能操作数字。改变论证的前提或切换句子的语法骨架，观察真值、反例与语义焦点如何同步变形。',

    defaultState: () => ({
      base: 0, // 平行四边形
      cond: 1, // 对角线互相垂直
      target: 3, // 正方形
      frame: 0, // 因果句
      pIdx: 0,
      qIdx: 0,
      unfoldEuler: true
    }),

    summaryOf(state) {
      const r = evalLogic(state);
      return `${r.base.name}+${r.cond.name} ⇒ ${r.target.name}（${r.valid ? '成立' : '不成立'}）`;
    },

    metricsOf(state) {
      const r = evalLogic(state);
      return {
        前提集合: r.base.name + ' ∩ ' + r.cond.name,
        结论目标: r.target.name,
        推理判定: r.valid ? '恒真（充分条件）' : '不成立（存在反例）',
        句法骨架: SYNTAX_FRAMES[state.frame].name
      };
    },

    boundsHtml() {
      return `
        <p><b>几何公理范围</b>：限定于欧几里得平面上的凸四边形；「对角线互相垂直」仅在平行四边形前提下等价于「四边相等（菱形）」。</p>
        <p><b>语言学边界</b>：句法转换演示汉语复句连词如何改变逻辑真值条件（如「只要…就…」对应 P→Q，而「只有…才…」对应 Q→P）。</p>
      `;
    },

    render(J, state) {
      const r = evalLogic(state);

      const tBase = J.choice('l-base', {
        name: '基础图形',
        opts: SHAPES.map((s) => s.name),
        get: () => state.base,
        set: (i) => { state.base = i; }
      });

      const tCond = J.choice('l-cond', {
        name: '附加条件',
        opts: CONDS.map((c) => c.name),
        get: () => state.cond,
        set: (i) => { state.cond = i; }
      });

      const tTarget = J.choice('l-target', {
        name: '结论图形',
        opts: SHAPES.map((s) => s.name),
        get: () => state.target,
        set: (i) => { state.target = i; }
      });

      const tFrame = J.syntax('l-frame', {
        name: '复句句构',
        opts: SYNTAX_FRAMES.map((f) => f.name),
        get: () => state.frame,
        set: (i) => { state.frame = i; }
      });

      const tP = J.choice('l-p', {
        name: '前件 P',
        opts: PREMISES,
        get: () => state.pIdx,
        set: (i) => { state.pIdx = i; }
      });

      const fr = SYNTAX_FRAMES[state.frame];

      const tQ = J.choice('l-q', {
        name: '后件 Q',
        opts: RESULTS.map((q) => fr.transformQ(q)),
        get: () => state.qIdx,
        set: (i) => { state.qIdx = i; }
      });

      const logicSentence = r.valid
        ? `<p class="jing prose">若一个四边形是 ${tBase}，且满足 ${tCond}，那么${J.dep('l-verdict', { html: `它必然是一个 ${tTarget}`, sources: ['l-base', 'l-cond'] })}。${J.jz('命题恒真', '前提已覆盖全部必要性质', 'indigo')}</p>`
        : `<p class="jing prose rewritten">若一个四边形是 ${tBase}，且满足 ${tCond}，那么${J.dep('l-verdict', { html: `它未必是 ${tTarget}`, sources: ['l-base', 'l-cond'] })}。${J.jz('命题不成立', '充分条件缺失', 'zhu')}</p>`;

      return `
        <h3 style="font-family:var(--sans);font-size:13px;color:var(--ink-3);letter-spacing:0.06em;margin:0 0 10px">第一部 · 改变前提，检验必然性</h3>
        ${logicSentence}
        ${!r.valid ? `<div class="shu"><p class="shu-note" style="margin:0;color:var(--zhu)"><b>自动生成反例</b>：${Judou.esc(r.counterexample)}</p></div>` : ''}

        <div class="figure-stage">
          <svg id="logic-svg" class="figure-svg" viewBox="0 0 460 195" role="img" aria-label="四边形集合包含关系欧拉图">
            <!-- Outer: Parallelogram -->
            <rect x="18" y="14" width="424" height="166" rx="14" fill="var(--paper-2)" stroke="var(--ink-3)" stroke-width="1.3" />
            <text x="30" y="34" fill="var(--ink-3)" font-family="var(--sans)" font-size="12">平行四边形</text>

            <!-- Rectangle -->
            <ellipse id="eu-rect" cx="170" cy="102" rx="115" ry="62" fill="var(--indigo-soft)" stroke="var(--indigo)" stroke-width="1.5" />
            <text x="76" y="106" fill="var(--indigo)" font-family="var(--sans)" font-size="12.5">矩形（有直角）</text>

            <!-- Rhombus -->
            <ellipse id="eu-rhom" cx="290" cy="102" rx="115" ry="62" fill="var(--zhu-soft)" stroke="var(--zhu)" stroke-width="1.5" />
            <text x="296" y="106" fill="var(--zhu)" font-family="var(--sans)" font-size="12.5">菱形（四边相等）</text>

            <!-- Intersection: Square -->
            <text x="230" y="106" text-anchor="middle" fill="var(--ink)" font-family="var(--sans)" font-size="13" font-weight="700">正方形</text>

            <!-- Current premise dot -->
            <circle id="eu-dot" cx="230" cy="134" r="6" fill="var(--zhu)" stroke="var(--paper-elev)" stroke-width="2" />
            <text id="eu-dot-lbl" x="230" y="152" text-anchor="middle" fill="var(--ink)" font-family="var(--sans)" font-size="11.5"></text>
          </svg>
          <div class="figure-caption">
            <span>欧拉图（Euler Diagram）：朱色落点表示当前「前提集合」的典型区域</span>
            <span>${r.valid ? '落点完全被目标集合包裹' : '落点可落在目标集合之外'}</span>
          </div>
        </div>

        <h3 style="font-family:var(--sans);font-size:13px;color:var(--ink-3);letter-spacing:0.06em;margin:28px 0 10px">第二部 · 重构句法，观察意义与预设迁移</h3>
        <p class="jing" style="font-size:var(--fs-jing);margin-bottom:10px">当前句构：${tFrame}</p>
        <p class="jing prose rewritten" style="padding:14px 18px;background:var(--paper-elev);border:1px solid var(--rule);border-radius:8px">${fr.render(tP, tQ)}</p>

        <div class="shu indigo">
          <div class="shu-head"><span>句法语义分析疏</span></div>
          <p class="shu-note" style="margin:0 0 6px"><b>逻辑真值条件</b>：${Judou.esc(fr.logic)}</p>
          <p class="shu-note" style="margin:0 0 6px"><b>信息焦点</b>：${Judou.esc(fr.focus)}</p>
          <p class="shu-note" style="margin:0"><b>语气与预设</b>：${Judou.esc(fr.tone)}</p>
        </div>
      `;
    },

    afterRender(J, state) {
      const dot = document.getElementById('eu-dot');
      const lbl = document.getElementById('eu-dot-lbl');
      if (!dot || !lbl) return;
      const r = evalLogic(state);
      let x = 230;
      let y = 136;
      if (r.combined.eqSides && r.combined.rightAngles) {
        x = 230;
        y = 124;
        lbl.textContent = '落入「正方形」交集';
      } else if (r.combined.rightAngles) {
        x = 125;
        y = 130;
        lbl.textContent = '可落在非正方形的矩形区';
      } else if (r.combined.eqSides) {
        x = 335;
        y = 130;
        lbl.textContent = '可落在非正方形的菱形区';
      } else {
        x = 230;
        y = 165;
        lbl.textContent = '可落在普通平行四边形区';
      }
      dot.setAttribute('cx', x);
      dot.setAttribute('cy', y);
      lbl.setAttribute('x', x);
      lbl.setAttribute('y', y + 16);
    }
  };

  global.JudouChapters = global.JudouChapters || {};
  global.JudouChapters.logic = chapter;
})(window);
