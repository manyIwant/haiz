/* ═══════════════════════════════════════════════════════════════════════
   篇章二 · 数学：《二次函数的形与根》
   Math Model: y = ax² + bx + c, vertex (h, k), discriminant Δ = b² - 4ac
   ═══════════════════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  function analyzeQuad(s) {
    const { a, b, c } = s;
    if (Math.abs(a) < 1e-9) {
      const root = Math.abs(b) > 1e-9 ? -c / b : null;
      return { isLinear: true, a: 0, b, c, root };
    }
    const h = -b / (2 * a);
    const k = c - (b * b) / (4 * a);
    const delta = b * b - 4 * a * c;
    let roots = [];
    if (delta > 1e-9) {
      const sq = Math.sqrt(delta);
      const r1 = (-b - sq) / (2 * a);
      const r2 = (-b + sq) / (2 * a);
      roots = [Math.min(r1, r2), Math.max(r1, r2)];
    } else if (Math.abs(delta) <= 1e-9) {
      roots = [h];
    }
    return { isLinear: false, a, b, c, h, k, delta, roots };
  }

  function fmtSign(v, varPart = '') {
    const abs = Math.abs(v).toFixed(2).replace(/\.00$/, '');
    return (v >= 0 ? ' + ' : ' − ') + abs + varPart;
  }

  const chapter = {
    id: 'quadratic',
    kicker: '篇章二 · 代数与几何',
    title: '二次函数的形与根',
    lead: '同一条抛物线可以用「一般式」「顶点式」或「交点式」书写。改写句中的系数，或直接在坐标系中拖动顶点。',

    defaultState: () => ({
      a: 1.0,
      b: -2.0,
      c: -3.0,
      form: 0, // 0: 一般式, 1: 顶点式, 2: 交点式
      unfoldDelta: false
    }),

    summaryOf(state) {
      const q = analyzeQuad(state);
      if (q.isLinear) return `退化为直线 y = ${state.b.toFixed(1)}x + ${state.c.toFixed(1)}`;
      return `a=${state.a.toFixed(1)}, 顶点(${q.h.toFixed(2)}, ${q.k.toFixed(2)}), Δ=${q.delta.toFixed(2)}`;
    },

    metricsOf(state) {
      const q = analyzeQuad(state);
      if (q.isLinear) {
        return {
          形态: '一次/常函数（a = 0）',
          斜率: state.b.toFixed(2),
          零点: q.root !== null ? q.root.toFixed(2) : '无'
        };
      }
      return {
        开口: q.a > 0 ? '向上（有极小值）' : '向下（有极大值）',
        顶点: `(${q.h.toFixed(2)}, ${q.k.toFixed(2)})`,
        判别式Δ: q.delta.toFixed(2),
        实根: q.roots.length === 2 ? `${q.roots[0].toFixed(2)}, ${q.roots[1].toFixed(2)}` : q.roots.length === 1 ? `${q.roots[0].toFixed(2)}（重根）` : '无实根'
      };
    },

    boundsHtml() {
      return `
        <p><b>定义域</b>：全实数集 <code>ℝ</code>（本图视窗展示 <code>x ∈ [-6, 6], y ∈ [-6, 6]</code>）。</p>
        <p><b>退化边界</b>：当 <code>a = 0</code> 时二次项消失，函数退化为一次函数或常函数，顶点与判别式不再适用。</p>
        <p><b>分解边界</b>：仅当 <code>a ≠ 0</code> 且 <code>Δ = b² − 4ac ≥ 0</code> 时，函数才能在实数域内写成交点式 <code>a(x − x₁)(x − x₂)</code>。</p>
      `;
    },

    render(J, state) {
      const q = analyzeQuad(state);

      const tA = J.num('q-a', {
        name: '二次项系数 a',
        min: -3,
        max: 3,
        step: 0.25,
        get: () => state.a,
        set: (v) => { state.a = v; },
        fmt: (v) => v.toFixed(2)
      });

      const tB = J.num('q-b', {
        name: '一次项系数 b',
        min: -6,
        max: 6,
        step: 0.5,
        get: () => state.b,
        set: (v) => { state.b = v; },
        fmt: (v) => v.toFixed(2)
      });

      const tC = J.num('q-c', {
        name: '常数项 c',
        min: -6,
        max: 6,
        step: 0.5,
        get: () => state.c,
        set: (v) => { state.c = v; },
        fmt: (v) => v.toFixed(2)
      });

      const tH = !q.isLinear
        ? J.num('q-h', {
            name: '顶点横坐标 h',
            min: -4,
            max: 4,
            step: 0.25,
            get: () => Number(q.h.toFixed(2)),
            set: (newH) => {
              const oldK = q.k;
              state.b = Number((-2 * state.a * newH).toFixed(4));
              state.c = Number((state.a * newH * newH + oldK).toFixed(4));
            },
            fmt: (v) => v.toFixed(2)
          })
        : '';

      const tK = !q.isLinear
        ? J.num('q-k', {
            name: '顶点纵坐标 k',
            min: -5,
            max: 5,
            step: 0.25,
            get: () => Number(q.k.toFixed(2)),
            set: (newK) => {
              state.c = Number((newK + (state.b * state.b) / (4 * state.a)).toFixed(4));
            },
            fmt: (v) => v.toFixed(2)
          })
        : '';

      const tForm = J.syntax('q-form', {
        name: '解析式形态',
        opts: ['一般式', '顶点式', '交点式'],
        get: () => state.form,
        set: (i) => { state.form = i; }
      });

      const tUnfold = J.unfold('q-unfold', {
        label: state.unfoldDelta ? '收起配方法与判别式推导' : '展开配方法与判别式推导',
        expanded: () => state.unfoldDelta,
        toggle: () => { state.unfoldDelta = !state.unfoldDelta; }
      });

      // Structural prose rewriting
      let mainProse = '';
      if (q.isLinear) {
        mainProse = `<p class="jing prose rewritten">当二次项系数 ${tA} 归零时，函数退化为一次直线 <code>y = ${state.b.toFixed(2)}x${fmtSign(state.c)}</code>：${J.dep('q-deg', { label: '「开口方向」「顶点」与「判别式」全部失去意义', sources: ['q-a'] })}，图像仅以斜率 ${tB} 与纵截距 ${tC} 穿过平面。</p>`;
      } else {
        const openTxt = q.a > 0 ? '开口向上' : '开口向下';
        const extremumTxt = q.a > 0 ? '全局最小值' : '全局最大值';
        let rootProse = '';
        if (q.delta > 1e-9) {
          rootProse = `由于 ${J.dep('q-d-dep', { label: `判别式 Δ = ${q.delta.toFixed(2)} > 0`, sources: ['q-a', 'q-b', 'q-c'] })}，抛物线穿过 x 轴两次，留下两个实根 <code>x₁ = ${q.roots[0].toFixed(2)}</code> 与 <code>x₂ = ${q.roots[1].toFixed(2)}</code>。`;
        } else if (Math.abs(q.delta) <= 1e-9) {
          rootProse = `恰在此时，${J.dep('q-d-dep', { label: '判别式 Δ = 0', sources: ['q-a', 'q-b', 'q-c'] })}，抛物线轻触 x 轴于顶点，两个实根重合为 <code>x = ${q.h.toFixed(2)}</code>。`;
        } else {
          rootProse = `因为 ${J.dep('q-d-dep', { label: `判别式 Δ = ${q.delta.toFixed(2)} < 0`, sources: ['q-a', 'q-b', 'q-c'] })}，整条抛物线悬在 x 轴${q.a > 0 ? '上方' : '下方'}，在实数域内没有交点（共轭复根为 <code>${q.h.toFixed(2)} ± ${(Math.sqrt(-q.delta) / (2 * Math.abs(q.a))).toFixed(2)}i</code>）。`;
        }
        mainProse = `<p class="jing prose">此二次函数系数为 ${tA}、${tB}、${tC}：图像${J.dep('q-open', { label: openTxt, sources: ['q-a'] })}，对称轴落在 <code>x = ${q.h.toFixed(2)}</code>，在顶点 <code>(${q.h.toFixed(2)}, ${q.k.toFixed(2)})</code> 处取得${extremumTxt}。${rootProse}</p>`;
      }

      // Equation sentence according to selected form
      let eqSentence = '';
      if (q.isLinear) {
        eqSentence = `y = ${tB} x ${state.c >= 0 ? '+' : '−'} ${Math.abs(state.c).toFixed(2)}`;
      } else if (state.form === 0) {
        eqSentence = `y = ${tA} x² + (${tB}) x + (${tC})`;
      } else if (state.form === 1) {
        eqSentence = `y = ${tA} (x − ${tH})² + (${tK}) ${J.jz('顶点一眼可见', `(${q.h.toFixed(2)}, ${q.k.toFixed(2)})`, 'indigo')}`;
      } else {
        if (q.delta >= -1e-9 && q.roots.length > 0) {
          const r1 = q.roots[0];
          const r2 = q.roots.length === 2 ? q.roots[1] : r1;
          eqSentence = `y = ${tA} (x − ${r1.toFixed(2)})(x − ${r2.toFixed(2)}) ${J.jz('实根直接可读', `x₁=${r1.toFixed(2)}, x₂=${r2.toFixed(2)}`, 'indigo')}`;
        } else {
          eqSentence = `无法写成实系数交点式 ${J.jz('因 Δ < 0，无实数一次因式', '请调小 c 或增大 |b|', 'zhu')}`;
        }
      }

      const unfoldHtml = state.unfoldDelta && !q.isLinear
        ? `<div class="shu indigo">
             <div class="shu-head"><span>展开的疏 · 从一般式配方到顶点式</span></div>
             <p class="shu-note"><code>ax² + bx + c = a(x + b/2a)² + (c − b²/4a)</code>。令 <code>y = 0</code>，得 <code>(x − h)² = Δ / (4a²)</code>。可见「是否有实根」完全取决于分子 <code>Δ = b² − 4ac</code> 的符号，而「顶点在哪」由 <code>h = −b/2a</code> 与 <code>k = −Δ/4a</code> 决定。</p>
           </div>`
        : '';

      return `
        ${mainProse}

        <div class="formula-box">
          <div class="shu-head" style="margin:0">
            <span>解析式形态：${tForm}</span>
            <span>${tUnfold}</span>
          </div>
          <div class="formula-row" style="font-size:clamp(18px, 1.2vw + 12px, 23px)">${eqSentence}</div>
        </div>

        ${unfoldHtml}

        <div class="figure-stage">
          <svg id="quad-svg" class="figure-svg" viewBox="-220 -220 440 440" role="img" aria-label="二次函数交互坐标系，可拖动顶点">
            <g id="quad-grid"></g>
            <line x1="-210" y1="0" x2="210" y2="0" stroke="var(--ink-3)" stroke-width="1.2" />
            <line x1="0" y1="-210" x2="0" y2="210" stroke="var(--ink-3)" stroke-width="1.2" />
            <line id="quad-axis" x1="0" y1="-210" x2="0" y2="210" stroke="var(--indigo)" stroke-width="1.2" stroke-dasharray="5 5" opacity="0.7" />
            <path id="quad-curve" fill="none" stroke="var(--ink)" stroke-width="2.4" />
            <g id="quad-roots"></g>
            <g id="quad-vertex" style="cursor:grab">
              <circle cx="0" cy="0" r="8" fill="var(--zhu)" stroke="var(--paper-elev)" stroke-width="2" />
              <circle cx="0" cy="0" r="20" fill="transparent" />
            </g>
            <text id="quad-label" x="-205" y="205" fill="var(--ink-2)" font-family="var(--sans)" font-size="12"></text>
          </svg>
          <div class="figure-caption">
            <span>直接拖动朱色顶点：反推 b 与 c，同步改写上方解析式与正文</span>
            <span>视图范围：x, y ∈ [−6, 6]</span>
          </div>
        </div>
      `;
    },

    afterRender(J, state, rerender) {
      const svg = document.getElementById('quad-svg');
      const grid = document.getElementById('quad-grid');
      const curve = document.getElementById('quad-curve');
      const axis = document.getElementById('quad-axis');
      const vGroup = document.getElementById('quad-vertex');
      const rootsG = document.getElementById('quad-roots');
      const label = document.getElementById('quad-label');
      if (!svg || !curve) return;

      const scale = 33; // 33px per unit -> [-6, 6] fits in [-198, 198]
      const toX = (x) => x * scale;
      const toY = (y) => -y * scale;

      // Grid
      let gridHtml = '';
      for (let i = -6; i <= 6; i++) {
        if (i === 0) continue;
        const p = i * scale;
        gridHtml += `<line x1="${p}" y1="-205" x2="${p}" y2="205" stroke="var(--rule)" stroke-width="0.8" />`;
        gridHtml += `<line x1="-205" y1="${p}" x2="205" y2="${p}" stroke="var(--rule)" stroke-width="0.8" />`;
      }
      grid.innerHTML = gridHtml;

      // Curve path
      let d = '';
      for (let px = -6.2; px <= 6.2; px += 0.1) {
        const py = state.a * px * px + state.b * px + state.c;
        const sx = toX(px).toFixed(1);
        const sy = Math.max(-240, Math.min(240, toY(py))).toFixed(1);
        d += (d === '' ? 'M ' : ' L ') + sx + ' ' + sy;
      }
      curve.setAttribute('d', d);

      const q = analyzeQuad(state);
      if (q.isLinear) {
        axis.setAttribute('opacity', '0');
        vGroup.setAttribute('opacity', '0');
        rootsG.innerHTML = q.root !== null && Math.abs(q.root) <= 6
          ? `<circle cx="${toX(q.root)}" cy="0" r="5" fill="var(--indigo)" />`
          : '';
        label.textContent = `直线：斜率 ${state.b.toFixed(2)}，纵截距 ${state.c.toFixed(2)}`;
        return;
      }

      axis.setAttribute('opacity', '0.7');
      axis.setAttribute('x1', toX(q.h));
      axis.setAttribute('x2', toX(q.h));
      vGroup.setAttribute('opacity', '1');
      vGroup.setAttribute('transform', `translate(${toX(q.h)}, ${toY(q.k)})`);

      rootsG.innerHTML = q.roots
        .filter((r) => Math.abs(r) <= 6.2)
        .map((r) => `<circle cx="${toX(r).toFixed(1)}" cy="0" r="5.5" fill="var(--indigo)" stroke="var(--paper-elev)" stroke-width="1.5" />`)
        .join('');

      label.textContent = `顶点 (${q.h.toFixed(2)}, ${q.k.toFixed(2)}) · Δ = ${q.delta.toFixed(2)}`;

      // Drag vertex
      let dragging = false;
      const onMove = (e) => {
        if (!dragging) return;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
        const nh = Math.max(-4, Math.min(4, Math.round((loc.x / scale) / 0.25) * 0.25));
        const nk = Math.max(-5, Math.min(5, Math.round((-loc.y / scale) / 0.25) * 0.25));
        state.b = Number((-2 * state.a * nh).toFixed(4));
        state.c = Number((state.a * nh * nh + nk).toFixed(4));
        vGroup.setAttribute('transform', `translate(${toX(nh)}, ${toY(nk)})`);
        axis.setAttribute('x1', toX(nh));
        axis.setAttribute('x2', toX(nh));
        let nd = '';
        for (let px = -6.2; px <= 6.2; px += 0.1) {
          const py = state.a * px * px + state.b * px + state.c;
          nd += (nd === '' ? 'M ' : ' L ') + toX(px).toFixed(1) + ' ' + Math.max(-240, Math.min(240, toY(py))).toFixed(1);
        }
        curve.setAttribute('d', nd);
      };

      vGroup.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        dragging = true;
        vGroup.setPointerCapture?.(e.pointerId);
      });
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener(
        'pointerup',
        () => {
          if (dragging) {
            dragging = false;
            rerender();
          }
        },
        { once: true }
      );
    }
  };

  global.JudouChapters = global.JudouChapters || {};
  global.JudouChapters.quadratic = chapter;
})(window);
