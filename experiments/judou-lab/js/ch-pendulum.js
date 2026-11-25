/* ═══════════════════════════════════════════════════════════════════════
   篇章一 · 物理：《单摆的等时性与边界》
   Physics Model: Exact nonlinear pendulum period via AGM(1, cos(θ₀/2))
   ═══════════════════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  const ENVS = [
    { name: '海口（北纬 20°）', g: 9.787 },
    { name: '北京（北纬 40°）', g: 9.801 },
    { name: '月球表面', g: 1.620 },
    { name: '火星表面', g: 3.721 },
    { name: '木星云顶', g: 24.79 },
    { name: '失重空间站', g: 0.0 }
  ];

  function agm(a, b) {
    for (let i = 0; i < 16; i++) {
      const an = 0.5 * (a + b);
      const bn = Math.sqrt(a * b);
      if (Math.abs(an - bn) < 1e-12) return an;
      a = an;
      b = bn;
    }
    return 0.5 * (a + b);
  }

  function calcPendulum(state) {
    const g = ENVS[state.env].g;
    const L = state.L;
    const deg = state.deg;
    const rad = (deg * Math.PI) / 180;
    if (g <= 0) {
      return { g: 0, T0: Infinity, T: Infinity, errPct: 0, regime: 'weightless' };
    }
    const T0 = 2 * Math.PI * Math.sqrt(L / g);
    const kPrime = Math.cos(rad / 2);
    const T = T0 / agm(1, kPrime);
    const errPct = ((T - T0) / T0) * 100;
    let regime = 'isochronous';
    if (deg > 30) regime = 'nonlinear';
    else if (deg > 5) regime = 'drift';
    return { g, T0, T, errPct, regime };
  }

  const TOKEN_NOTES = {
    T: '周期 T（单位：s）：单摆完成一次全振动所需的时间。',
    '2pi': '2π：来自圆周运动投影与简谐振动角频率 ω = √(g/L) 的积分常数。',
    L: '摆长 L（单位：m）：从悬点到摆球质心的距离。L 变为 4 倍，周期变为 2 倍（平方根律）。',
    g: '重力加速度 g（单位：m/s²）：提供回复力 mg sinθ 的源头。g 越小，回复越慢，周期越长。',
    agm: '算术-几何平均修正项 1 / AGM(1, cos(θ₀/2))：当 θ₀ 增大时，sinθ < θ 导致回复力比线性预测更弱，周期变长。'
  };

  const chapter = {
    id: 'pendulum',
    kicker: '篇章一 · 物理模型',
    title: '单摆的等时性与边界',
    lead: '文字不只是描述单摆。改变句中的摆长、摆角或星球，观察科学定律如何在边界之外重写自身。',

    defaultState: () => ({
      L: 1.0,
      deg: 4,
      env: 0,
      formulaMode: 0, // 0: 小角度近似式, 1: 精确椭圆积分式
      unfoldProof: false,
      activeToken: 'L',
      sound: 0 // 0: 静默, 1: 节拍
    }),

    summaryOf(state) {
      const m = calcPendulum(state);
      const tStr = m.g === 0 ? '∞' : m.T.toFixed(3) + 's';
      return `L=${state.L.toFixed(2)}m, θ₀=${state.deg}°, ${ENVS[state.env].name} → T=${tStr}`;
    },

    metricsOf(state) {
      const m = calcPendulum(state);
      return {
        摆长: state.L.toFixed(2) + ' m',
        摆角: state.deg + '°',
        环境: ENVS[state.env].name,
        精确周期: m.g === 0 ? '无周期（失重）' : m.T.toFixed(4) + ' s',
        近似偏差: m.g === 0 ? '—' : '+' + m.errPct.toFixed(3) + '%'
      };
    },

    boundsHtml() {
      return `
        <p><b>理想化假设</b>：无质量不可伸长细线、质点摆球、无空气阻力与悬点摩擦。</p>
        <p><b>数学模型</b>：精确周期采用第一类完全椭圆积分的算术-几何平均（AGM）求值，适用范围为 <code>0° &lt; θ₀ &lt; 180°</code>。</p>
        <p><b>近似边界</b>：当 <code>θ₀ ≤ 5°</code> 时，小角度近似 <code>T₀ = 2π√(L/g)</code> 的相对误差低于 <code>0.05%</code>。</p>
      `;
    },

    render(J, state, rerender) {
      const m = calcPendulum(state);

      const tL = J.num('p-L', {
        name: '摆长',
        min: 0.25,
        max: 2.5,
        step: 0.05,
        unit: ' m',
        get: () => state.L,
        set: (v) => { state.L = v; },
        fmt: (v) => v.toFixed(2)
      });

      const tDeg = J.num('p-deg', {
        name: '初始摆角',
        min: 1,
        max: 85,
        step: 1,
        unit: '°',
        get: () => state.deg,
        set: (v) => { state.deg = v; },
        fmt: (v) => String(v)
      });

      const tEnv = J.choice('p-env', {
        name: '重力环境',
        opts: ENVS.map((e) => e.name),
        notes: ENVS.map((e) => e.g.toFixed(2) + ' m/s²'),
        get: () => state.env,
        set: (i) => { state.env = i; }
      });

      const tFormulaMode = J.syntax('p-fmode', {
        name: '公式形态',
        opts: ['小角度近似式', '精确椭圆积分式'],
        get: () => state.formulaMode,
        set: (i) => { state.formulaMode = i; }
      });

      const tProof = J.unfold('p-proof', {
        label: state.unfoldProof ? '收起推导与边界实验' : '展开推导与边界实验',
        expanded: () => state.unfoldProof,
        toggle: () => { state.unfoldProof = !state.unfoldProof; }
      });

      const tSound = J.choice('p-sound', {
        name: '节拍声',
        opts: ['静默', '随周期敲击'],
        get: () => state.sound,
        set: (i) => { state.sound = i; }
      });

      // Structural prose rewriting based on physical regime
      let regimeSentence = '';
      let regimeClass = 'jing prose';
      if (m.regime === 'weightless') {
        regimeSentence = `在 ${tEnv}（g = 0 m/s²）中，摆球失去重力，切向回复力 <span class="jw-dep" data-dep-sources="p-env">mg sinθ 归零</span>；此时单摆不再往复摆动，${J.dep('p-concl', { label: '周期趋于无穷，等时性失去物理基础', sources: ['p-env'] })}。`;
        regimeClass += ' rewritten';
      } else if (m.regime === 'isochronous') {
        regimeSentence = `在 ${tEnv}（g = ${m.g.toFixed(3)} m/s²）中，当摆长取 ${tL}、以小角度 ${tDeg} 拉开时，sinθ 与 θ 的差异微乎其微（周期偏差仅 ${m.errPct.toFixed(3)}%）；因此 ${J.dep('p-concl', { label: `周期稳定在 ${m.T.toFixed(3)} 秒，几乎与振幅无关`, sources: ['p-L', 'p-env', 'p-deg'] })}——这便是伽利略发现的「等时性」。`;
      } else if (m.regime === 'drift') {
        regimeSentence = `在 ${tEnv} 中，摆长 ${tL} 的单摆被拉开至 ${tDeg}：此时 sinθ 开始明显小于 θ，回复力偏弱。${J.dep('p-concl', { label: `实际周期拉长为 ${m.T.toFixed(3)} 秒（比小角度近似慢了 ${m.errPct.toFixed(2)}%）`, sources: ['p-deg', 'p-L', 'p-env'] })}，等时性开始出现可测量的偏差。`;
        regimeClass += ' rewritten';
      } else {
        regimeSentence = `警告：摆角已放大至 ${tDeg}（远超 5° 边界）！在 ${tEnv} 中，线性回复力假设彻底失效，${J.dep('p-concl', { label: `精确周期 ${m.T.toFixed(3)} 秒比近似值 ${m.T0.toFixed(3)} 秒慢了 ${m.errPct.toFixed(2)}%`, sources: ['p-deg', 'p-L', 'p-env'] })}——若仍套用 T₀ = 2π√(L/g) 将产生严重误差。`;
        regimeClass += ' rewritten';
      }

      const formulaHtml =
        state.formulaMode === 0
          ? `<div class="formula-row">
               <button type="button" class="f-token ${state.activeToken === 'T' ? 'active' : ''}" data-ftok="T">T₀</button>
               <span>=</span>
               <button type="button" class="f-token ${state.activeToken === '2pi' ? 'active' : ''}" data-ftok="2pi">2π</button>
               <span>√</span>
               <span class="f-sqrt">
                 <span class="f-frac">
                   <button type="button" class="f-token num ${state.activeToken === 'L' ? 'active' : ''}" data-ftok="L">L = ${state.L.toFixed(2)}</button>
                   <button type="button" class="f-token den ${state.activeToken === 'g' ? 'active' : ''}" data-ftok="g">g = ${m.g.toFixed(2)}</button>
                 </span>
               </span>
               <span>=</span>
               <strong>${m.g === 0 ? '∞' : m.T0.toFixed(3) + ' s'}</strong>
             </div>`
          : `<div class="formula-row">
               <button type="button" class="f-token ${state.activeToken === 'T' ? 'active' : ''}" data-ftok="T">T</button>
               <span>=</span>
               <button type="button" class="f-token ${state.activeToken === '2pi' ? 'active' : ''}" data-ftok="2pi">2π</button>
               <span class="f-sqrt">
                 <span class="f-frac">
                   <button type="button" class="f-token num ${state.activeToken === 'L' ? 'active' : ''}" data-ftok="L">L</button>
                   <button type="button" class="f-token den ${state.activeToken === 'g' ? 'active' : ''}" data-ftok="g">g</button>
                 </span>
               </span>
               <span>·</span>
               <button type="button" class="f-token ${state.activeToken === 'agm' ? 'active' : ''}" data-ftok="agm">1 / AGM(1, cos(${state.deg}°/2))</button>
               <span>=</span>
               <strong>${m.g === 0 ? '∞' : m.T.toFixed(3) + ' s'}</strong>
             </div>`;

      const proofHtml = state.unfoldProof
        ? `<div class="shu indigo">
             <div class="shu-head"><span>展开的疏 · 为什么摆角越大，周期越长？</span></div>
             <p class="shu-note">单摆的真实运动方程为 <code>d²θ/dt² = -(g/L) sinθ</code>。当 <code>θ</code> 很小时，泰勒展开 <code>sinθ ≈ θ - θ³/6</code> 中高阶项可忽略，方程化为简谐振动。当 <code>θ₀ = ${state.deg}°</code> 时，实际回复力矩比线性值小了 <code>${((1 - Math.sin((state.deg * Math.PI) / 180) / ((state.deg * Math.PI) / 180)) * 100).toFixed(1)}%</code>（在最大位移处），因此摆球「折返」得更慢。</p>
             <table class="j-table" style="margin-top:12px">
               <thead><tr><th>初始摆角 θ₀</th><th>精确周期 T (s)</th><th>小角度 T₀ (s)</th><th>相对偏差</th></tr></thead>
               <tbody>
                 ${[2, 5, 15, 30, 60, 85]
                   .map((a) => {
                     const tmp = calcPendulum({ ...state, deg: a });
                     const isCur = a === state.deg;
                     return `<tr class="${isCur ? 'active' : ''}"><td>${a}°</td><td>${tmp.g === 0 ? '∞' : tmp.T.toFixed(4)}</td><td>${tmp.g === 0 ? '∞' : tmp.T0.toFixed(4)}</td><td>+${tmp.errPct.toFixed(3)}%</td></tr>`;
                   })
                   .join('')}
               </tbody>
             </table>
           </div>`
        : '';

      return `
        <p class="${regimeClass}" id="pend-main-prose">${regimeSentence}</p>

        <div class="figure-stage">
          <svg id="pend-svg" class="figure-svg" viewBox="-220 -20 440 270" role="img" aria-label="可拖动单摆实验装置：拖动摆球可同时改变摆长与初始摆角">
            <line x1="-180" y1="10" x2="180" y2="10" stroke="var(--rule-strong)" stroke-width="2" />
            <line x1="0" y1="10" x2="0" y2="230" stroke="var(--rule)" stroke-dasharray="4 4" />
            <path id="pend-arc" fill="none" stroke="var(--zhu)" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.7" />
            <g id="pend-arm" style="cursor:grab">
              <line id="pend-rod" x1="0" y1="10" x2="0" y2="150" stroke="var(--ink)" stroke-width="2" />
              <circle id="pend-bob" cx="0" cy="150" r="13" fill="var(--zhu)" stroke="var(--paper-elev)" stroke-width="2" />
              <circle cx="0" cy="150" r="24" fill="transparent" />
            </g>
            <text id="pend-readout" x="-205" y="236" fill="var(--ink-2)" font-family="var(--sans)" font-size="12"></text>
          </svg>
          <div class="figure-caption">
            <span>直接拖动朱色摆球改变摆长 L 与摆角 θ₀ · 声响：${tSound}</span>
            <span>${tProof}</span>
          </div>
        </div>

        <div class="formula-box">
          <div class="shu-head" style="margin:0">
            <span>可拆解公式 · 当前选用 ${tFormulaMode}</span>
            <span style="color:var(--ink-3)">点击公式中的任一项查看物理意义</span>
          </div>
          ${formulaHtml}
          <div class="formula-explain">${Judou.esc(TOKEN_NOTES[state.activeToken] || '')}</div>
        </div>

        ${proofHtml}
      `;
    },

    afterRender(J, state, rerender) {
      // Formula token clicks
      document.querySelectorAll('[data-ftok]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.activeToken = btn.dataset.ftok;
          rerender();
        });
      });

      const svg = document.getElementById('pend-svg');
      const arm = document.getElementById('pend-arm');
      const rod = document.getElementById('pend-rod');
      const bob = document.getElementById('pend-bob');
      const arc = document.getElementById('pend-arc');
      const readout = document.getElementById('pend-readout');
      if (!svg || !arm) return;

      const pxPerM = 72;
      const baseLen = 30;
      const rPx = baseLen + state.L * pxPerM;
      const radMax = (state.deg * Math.PI) / 180;
      const m = calcPendulum(state);

      rod.setAttribute('y2', 10 + rPx);
      bob.setAttribute('cy', 10 + rPx);
      const ax1 = -rPx * Math.sin(radMax);
      const ay1 = 10 + rPx * Math.cos(radMax);
      const ax2 = rPx * Math.sin(radMax);
      const ay2 = ay1;
      arc.setAttribute('d', `M ${ax1.toFixed(1)} ${ay1.toFixed(1)} A ${rPx.toFixed(1)} ${rPx.toFixed(1)} 0 0 0 ${ax2.toFixed(1)} ${ay2.toFixed(1)}`);
      readout.textContent = m.g === 0 ? '失重状态：无回复力' : `L = ${state.L.toFixed(2)} m · θ₀ = ${state.deg}° · T = ${m.T.toFixed(3)} s`;

      // Drag bob directly on SVG
      let draggingBob = false;
      const onMove = (e) => {
        if (!draggingBob) return;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const local = pt.matrixTransform(svg.getScreenCTM().inverse());
        const dx = local.x;
        const dy = Math.max(20, local.y - 10);
        const dist = Math.hypot(dx, dy);
        const newL = Math.min(2.5, Math.max(0.25, Math.round(((dist - baseLen) / pxPerM) / 0.05) * 0.05));
        const newDeg = Math.min(85, Math.max(1, Math.round((Math.atan2(Math.abs(dx), dy) * 180) / Math.PI)));
        state.L = Number(newL.toFixed(2));
        state.deg = newDeg;
        const rNow = baseLen + state.L * pxPerM;
        rod.setAttribute('y2', 10 + rNow);
        bob.setAttribute('cy', 10 + rNow);
        const ang = (Math.atan2(dx, dy) * 180) / Math.PI;
        arm.setAttribute('transform', `rotate(${-ang}, 0, 10)`);
      };

      arm.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        draggingBob = true;
        arm.setPointerCapture?.(e.pointerId);
        if (this._raf) cancelAnimationFrame(this._raf);
      });
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener(
        'pointerup',
        () => {
          if (draggingBob) {
            draggingBob = false;
            rerender();
          }
        },
        { once: true }
      );

      // Animate pendulum
      if (this._raf) cancelAnimationFrame(this._raf);
      if (m.g <= 0) {
        arm.setAttribute('transform', `rotate(${state.deg}, 0, 10)`);
        return;
      }
      const reduced = document.documentElement.dataset.motion === 'reduce';
      if (reduced) {
        arm.setAttribute('transform', `rotate(${state.deg}, 0, 10)`);
        return;
      }

      const t0 = performance.now();
      let lastSign = 1;
      const tick = (now) => {
        if (!document.body.contains(arm) || draggingBob) return;
        const elapsed = (now - t0) / 1000;
        const phase = (2 * Math.PI * elapsed) / m.T;
        const cosVal = Math.cos(phase);
        const angle = state.deg * cosVal;
        arm.setAttribute('transform', `rotate(${angle.toFixed(2)}, 0, 10)`);

        // Optional audio tick at equilibrium crossing
        const sign = cosVal >= 0 ? 1 : -1;
        if (state.sound === 1 && sign !== lastSign) {
          lastSign = sign;
          playTick();
        }
        this._raf = requestAnimationFrame(tick);
      };
      this._raf = requestAnimationFrame(tick);
    },

    unmount() {
      if (this._raf) cancelAnimationFrame(this._raf);
    }
  };

  let audioCtx = null;
  function playTick() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(660, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.045);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    } catch {}
  }

  global.JudouChapters = global.JudouChapters || {};
  global.JudouChapters.pendulum = chapter;
})(window);
