// HAIZ · EXPERIMENTARIUM — 数学与几何拓扑探究包
// 包含 6 个核心实验：math-function / math-sine / math-cube / math-conic-locus (L4) / math-derivative / math-galton
import {
  C, TAU, clamp, lerp, group, at, rot, box, cyl, ball, rod, wire, arrow,
  strip, dash, flat, solid, glass, clean, sheet, note, card, dots, THREE,
} from '../core/ink.js';
import { classifyConicSection } from '../core/science-models.js';
import { DEG, rng, sampleStats, chiSquare } from '../core/epistemic.js';

const piFmt = (v) => `${(v / Math.PI).toFixed(2)}π`;

// ================================================================
// 1. 函数的单调性、奇偶性与二次函数退化边界 (math-function, L3)
// ================================================================
function analyzeQuadratic(a, b, c) {
  const isLinear = Math.abs(a) < 1e-6;
  const delta = b * b - 4 * a * c;
  let roots = [];
  let kind = '';
  if (isLinear) {
    if (Math.abs(b) < 1e-6) {
      kind = Math.abs(c) < 1e-6 ? '退化：恒等零线 y = 0' : `退化：水平常函数 y = ${c.toFixed(2)}`;
    } else {
      const r = -c / b;
      roots = [r];
      kind = '退化：一次直线 (a = 0)';
    }
  } else {
    if (delta > 1e-6) {
      const sq = Math.sqrt(delta);
      roots = [(-b - sq) / (2 * a), (-b + sq) / (2 * a)].sort((u, v) => u - v);
      kind = a > 0 ? '开口向上抛物线（两实根）' : '开口向下抛物线（两实根）';
    } else if (Math.abs(delta) <= 1e-6) {
      roots = [-b / (2 * a)];
      kind = a > 0 ? '开口向上抛物线（相切重根）' : '开口向下抛物线（相切重根）';
    } else {
      kind = a > 0 ? '开口向上抛物线（无实根，一对共轭复根）' : '开口向下抛物线（无实根，一对共轭复根）';
    }
  }
  const xv = isLinear ? NaN : -b / (2 * a);
  const yv = isLinear ? NaN : c - (b * b) / (4 * a);
  let parity = '非奇非偶';
  if (isLinear) {
    if (Math.abs(b) < 1e-6 && Math.abs(c) < 1e-6) parity = '既奇又偶';
    else if (Math.abs(b) < 1e-6) parity = '偶函数';
    else if (Math.abs(c) < 1e-6) parity = '奇函数';
  } else if (Math.abs(b) < 1e-6) {
    parity = '偶函数 (b = 0)';
  }
  return { isLinear, delta, roots, kind, xv, yv, parity };
}

const EXPLORE_FNS = [
  { id: 'quad', label: '当前二次家族 ax²+bx+c', fn: (x, p) => p.a * x * x + p.b * x + p.c, cutZero: false },
  { id: 'cube', label: 'y = x³', fn: (x) => x * x * x, cutZero: false },
  { id: 'inv', label: 'y = 1/x', fn: (x) => (Math.abs(x) < 0.04 ? NaN : 1 / x), cutZero: true },
  { id: 'abs', label: 'y = |x|', fn: (x) => Math.abs(x), cutZero: false },
  { id: 'hook', label: 'y = x + 1/x', fn: (x) => (Math.abs(x) < 0.04 ? NaN : x + 1 / x), cutZero: true },
  { id: 'exp', label: 'y = 2ˣ', fn: (x) => Math.pow(2, x), cutZero: false },
];

export const func = {
  id: 'math-function',
  subject: 'math',
  title: '函数的单调性、奇偶性与二次函数退化边界',
  en: 'Monotonicity, parity & quadratic degeneration',
  lede: [
    '函数性质是图象与代数结构在定义域上的严格约束：当二次函数 y = ax² + bx + c 的系数 a 穿过 0 时，抛物线瞬间失去顶点与对称轴，“退化”为一条直线。',
    '拖动系数 a、b、c 观察判别式 Δ = b² − 4ac 如何支配实根分合及顶点轨迹；在工作台切换对称与非对称定义域，检验奇偶性与单调区间不可盲目并集的边界。',
  ],
  formula: 'y = ax² + bx + c · Δ = b² − 4ac · f(−x) = ±f(x)',
  formulaNote: '当 a = 0 时退化为一次函数；仅当定义域关于原点对称且 f(−x) = ±f(x) 时才具奇偶性',
  terms: [
    ['退化边界 a = 0', '二次项系数归零后，曲线曲率消失，顶点逃逸至无穷远，仅余直线 y = bx + c'],
    ['判别式 Δ', 'Δ > 0 有两不等实根，Δ = 0 两根重合（与 x 轴相切），Δ < 0 无实根（共轭复根）'],
    ['单调区间并集谬误', '例如 y = 1/x 在 (−∞, 0) 与 (0, +∞) 均递减，但跨过 x = 0 取 x₁ = −1 < x₂ = 1 却有 f(−1) < f(1)'],
  ],
  predict: {
    q: '保持 b = −2, c = 1 不变，把抛物线 y = ax² − 2x + 1 的二次项系数 a 连续调到 0，图象和实根会发生什么？',
    options: [
      '开口越来越平缓，在 a = 0 处退化为直线 y = −2x + 1，只剩 1 个实根 x = 0.5',
      '一直保持两个对称的根',
      '突然在原点断开',
    ],
    answer: 0,
    why: '当 a → 0⁺ 时，其中一个根趋于 0.5，另一个根 (2 + √(4−4a))/(2a) → +∞ 逃逸到无穷远；a = 0 时方程降为一次方程 −2x + 1 = 0，抛物线退化为直线。',
  },
  challenge: '调出 a = 0 验证退化直线，再设置 Δ = 0 相切重根与 b = 0 偶函数对称；在工作台用 y = 1/x 找出一组推翻“全定义域单调递减”的反例点！',
  fig: '立式方格坐标板：紫色为主曲线 y = ax²+bx+c，铜色虚线为顶点轨迹与对称轴，绿珠为实根',
  hint: '拖滑杆或直接拖 3D 铜色顶点球改变 b、c；展开工作台切换一般式/顶点式/交点式并探索奇偶单调边界。',
  teach: {
    where: '人教 A 版数学必修第一册第二、三章：二次函数与一元二次方程、函数的单调性与奇偶性',
    ask: [
      '固定 a ≠ 0 与 c，只改变一次项系数 b，顶点 (x_v, y_v) 沿着哪条抛物线轨迹移动？',
      '为什么说“y = x² 在 [−1, 2] 上是偶函数”是错误的？奇偶性的首要前提是什么？',
    ],
    simplify: '三维画布采样范围 |x| ≤ 3.6, |y| ≤ 4.0，超出部分按坐标边界裁剪；工作台同步提供复根虚部与代数三式转换。',
    safety: '纯代数与几何解析可视化实验。',
  },
  controls: [
    { id: 'a', label: '二次项 a', min: -2, max: 2, step: 0.1, value: 1 },
    { id: 'b', label: '一次项 b', min: -4, max: 4, step: 0.2, value: -1 },
    { id: 'c', label: '常数项 c', min: -3, max: 3, step: 0.2, value: -1 },
    { id: 'showTrace', label: '顶点轨迹与对称轴', type: 'toggle', value: true },
    { id: 'btnDeg', label: '退化边界', type: 'button', text: 'a = 0' },
    { id: 'btnEven', label: '偶对称', type: 'button', text: 'b = 0' },
    { id: 'btnTan', label: '相切重根', type: 'button', text: 'Δ = 0' },
  ],
  record: {
    note: '记下每次参数变化后的函数类型、判别式 Δ、实根及奇偶性，对比 a = 0 退化前后差异。',
    pending: '调节参数或在工作台点击“记入实验册”保存当前二次曲线样本。',
    columns: [
      { key: 'kind', label: '曲线构型' },
      { key: 'a', label: 'a', digits: 1 },
      { key: 'b', label: 'b', digits: 1 },
      { key: 'c', label: 'c', digits: 1 },
      { key: 'delta', label: 'Δ', digits: 2, stat: true },
      { key: 'rootsText', label: '实根' },
      { key: 'parity', label: '奇偶性' },
    ],
    sample: (inst, p) => {
      const a = p.a ?? 1, b = p.b ?? -1, c = p.c ?? -1;
      const q = analyzeQuadratic(a, b, c);
      return {
        _kind: 'model',
        kind: q.isLinear ? '退化直线(a=0)' : '抛物线',
        a, b, c,
        delta: q.delta,
        rootsText: q.roots.length ? q.roots.map((r) => r.toFixed(2)).join(', ') : '无实根',
        parity: q.parity,
      };
    },
    summary: (rows) => [
      ['已记录构型数', `${rows.length} 组`],
      ['含退化样本 (a=0)', `${rows.filter((r) => Math.abs(r.a) < 1e-6).length} 组`],
    ],
    errors: [
      '忽略 a = 0 退化条件：直接套用求根公式 (-b±√Δ)/(2a) 会在 a = 0 时除零失效。',
      '忽略定义域对称性：只检验 f(−x) = f(x) 而不看区间是否关于原点对称。',
    ],
  },

  build(k) {
    const p = k.p;
    const CX = 0, CY = 2.95, Z = -1.5, SX = 1.15, SY = 0.62, XR = 3.6, YR = 4.0;
    const P = (x, y, dz = 0) => [CX + x * SX, CY + y * SY, Z + dz];
    const W = XR * 2 * SX + 0.5, H = YR * 2 * SY + 0.5;

    const grid = at(sheet(W, H, (x, s, w, h) => {
      x.fillStyle = 'rgba(255,253,246,.92)';
      x.fillRect(0, 0, w * s, h * s);
      x.strokeStyle = 'rgba(30,43,54,.13)';
      x.lineWidth = s * 0.012;
      for (let i = -3; i <= 3; i++) {
        const gx = (w / 2 + i * SX) * s;
        x.beginPath(); x.moveTo(gx, 0.25 * s); x.lineTo(gx, (h - 0.25) * s); x.stroke();
      }
      for (let j = -4; j <= 4; j++) {
        const gy = (h / 2 - j * SY) * s;
        x.beginPath(); x.moveTo(0.25 * s, gy); x.lineTo((w - 0.25) * s, gy); x.stroke();
      }
      x.strokeStyle = C.ink;
      x.lineWidth = s * 0.028;
      x.beginPath();
      x.moveTo(0.15 * s, (h / 2) * s); x.lineTo((w - 0.15) * s, (h / 2) * s);
      x.moveTo((w / 2) * s, (h - 0.15) * s); x.lineTo((w / 2) * s, 0.15 * s);
      x.stroke();
      x.fillStyle = C.ink;
      x.font = `italic ${s * 0.25}px Georgia,serif`;
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('x', (w - 0.2) * s, (h / 2 + 0.28) * s);
      x.fillText('y', (w / 2 + 0.28) * s, 0.24 * s);
      x.fillText('O', (w / 2 - 0.22) * s, (h / 2 + 0.26) * s);
      x.font = `${s * 0.18}px Georgia,serif`;
      for (const i of [-3, -2, -1, 1, 2, 3]) x.fillText(String(i), (w / 2 + i * SX) * s, (h / 2 + 0.24) * s);
      for (const j of [-4, -2, 2, 4]) x.fillText(String(j), (w / 2 - 0.25) * s, (h / 2 - j * SY) * s);
    }, { opaque: false }), CX, CY, Z - 0.03);

    const standFrame = group(
      rod(P(-XR - 0.2, -YR - 0.3), P(XR + 0.2, -YR - 0.3), 0.05),
      rod(P(-XR - 0.2, -YR - 0.3), [CX - XR * SX - 0.23, 0, Z], 0.05),
      rod(P(XR + 0.2, -YR - 0.3), [CX + XR * SX + 0.23, 0, Z], 0.05),
    );
    const mainCurve = strip(160, { color: C.violet, w: 0.075, opacity: 0.95 });
    const linearCurve = strip(160, { color: C.copper, w: 0.08, opacity: 0.95 });
    const traceCurve = strip(120, { color: C.copper, w: 0.035, opacity: 0.5 });
    const axisLine = strip(2, { color: C.ink, w: 0.022, opacity: 0.45 });
    const vtxBall = ball(0.13, C.copper);
    const rootBalls = [ball(0.105, C.leaf), ball(0.105, C.leaf)];
    const yIntBall = ball(0.09, C.sky);
    const vtxTag = note('V', { size: 0.26, italic: true, color: C.copper });
    const info = at(card('\n\n', { w: 4.9, size: 0.26, align: 'left' }), 1.35, 0, 3.55);

    k.root.add(grid, standFrame, mainCurve, linearCurve, traceCurve, axisLine, vtxBall, ...rootBalls, yIntBall, vtxTag, info);

    const sync = () => {
      const a = p.a ?? 1, b = p.b ?? -1, c = p.c ?? -1;
      const q = analyzeQuadratic(a, b, c);
      const pts = [];
      for (let i = 0; i <= 156; i++) {
        const x = lerp(-XR, XR, i / 156);
        const y = a * x * x + b * x + c;
        if (Math.abs(y) <= YR + 0.15) pts.push(P(x, clamp(y, -YR, YR), 0.02));
      }
      mainCurve.visible = !q.isLinear && pts.length > 1;
      linearCurve.visible = q.isLinear && pts.length > 1;
      if (mainCurve.visible) mainCurve.set(pts);
      if (linearCurve.visible) linearCurve.set(pts);

      const showTr = (p.showTrace ?? true) && !q.isLinear;
      traceCurve.visible = showTr;
      axisLine.visible = showTr && Math.abs(q.xv) <= XR;
      if (showTr) {
        // 固定 a, c 时改变 b，顶点满足 y = -a*x^2 + c
        const tPts = [];
        for (let i = 0; i <= 116; i++) {
          const x = lerp(-XR, XR, i / 116);
          const y = -a * x * x + c;
          if (Math.abs(y) <= YR + 0.1) tPts.push(P(x, clamp(y, -YR, YR), 0.015));
        }
        traceCurve.visible = tPts.length > 1;
        if (traceCurve.visible) traceCurve.set(tPts);
        if (axisLine.visible) axisLine.set([P(q.xv, -YR, 0.015), P(q.xv, YR, 0.015)]);
      }

      const vtxVisible = !q.isLinear && Math.abs(q.xv) <= XR && Math.abs(q.yv) <= YR;
      vtxBall.visible = vtxTag.visible = vtxVisible;
      if (vtxVisible) {
        vtxBall.position.set(...P(q.xv, q.yv, 0.07));
        vtxTag.position.set(...P(q.xv + 0.22, clamp(q.yv + (a >= 0 ? -0.35 : 0.35), -YR + 0.3, YR - 0.3), 0.08));
      }

      rootBalls.forEach((rb, i) => {
        const r = q.roots[i];
        rb.visible = r !== undefined && Math.abs(r) <= XR;
        if (rb.visible) rb.position.set(...P(r, 0, 0.06));
      });
      yIntBall.visible = Math.abs(c) <= YR;
      if (yIntBall.visible) yIntBall.position.set(...P(0, c, 0.05));

      const eqStr = q.isLinear
        ? `y = ${b.toFixed(1)}x ${c >= 0 ? '+' : '−'} ${Math.abs(c).toFixed(1)}（退化边界 a = 0）`
        : `y = ${a.toFixed(1)}x² ${b >= 0 ? '+' : '−'} ${Math.abs(b).toFixed(1)}x ${c >= 0 ? '+' : '−'} ${Math.abs(c).toFixed(1)}`;
      const rootStr = q.roots.length ? q.roots.map((r) => r.toFixed(2)).join(' , ') : '无实根 (Δ < 0)';
      const vtxStr = q.isLinear ? '无顶点（斜率 k = ' + b.toFixed(1) + '）' : `顶点 (${q.xv.toFixed(2)}, ${q.yv.toFixed(2)})`;
      info.set(`${eqStr}\n${q.kind} · ${q.parity}\nΔ = ${q.delta.toFixed(2)} · 实根：${rootStr}\n${vtxStr}`);
      thisState = q;
    };

    let thisState = analyzeQuadratic(p.a ?? 1, p.b ?? -1, p.c ?? -1);
    let dragStart = null;
    k.drag(vtxBall, {
      start: (q) => {
        dragStart = { x: q.x, y: q.y, b: p.b, c: p.c };
      },
      move: (q) => {
        if (!dragStart) return;
        const a = p.a ?? 1;
        if (Math.abs(a) < 1e-6) {
          k.set('c', clamp(Math.round((dragStart.c + (q.y - dragStart.y) / SY) * 5) / 5, -3, 3));
        } else {
          const curQ = analyzeQuadratic(a, dragStart.b, dragStart.c);
          const nx = clamp(curQ.xv + (q.x - dragStart.x) / SX, -3, 3);
          const ny = clamp(curQ.yv + (q.y - dragStart.y) / SY, -3.5, 3.5);
          k.set('b', clamp(Math.round((-2 * a * nx) * 5) / 5, -4, 4));
          k.set('c', clamp(Math.round((ny + a * nx * nx) * 5) / 5, -3, 3));
        }
        sync();
        k.dirty();
      },
      end: () => { dragStart = null; },
    });

    sync();
    return {
      press(id) {
        if (id === 'btnDeg' || id === 'deg') {
          k.set('a', 0);
        } else if (id === 'btnEven' || id === 'even') {
          k.set('b', 0);
          if (Math.abs(p.a) < 0.1) k.set('a', 1);
        } else if (id === 'btnTan' || id === 'tan') {
          if (Math.abs(p.a) < 0.1) k.set('a', 1);
          const aa = p.a;
          const bb = Math.abs(p.b) < 0.2 ? -2 : p.b;
          const cc = (bb * bb) / (4 * aa);
          if (Math.abs(cc) <= 3) {
            k.set('b', bb);
            k.set('c', Math.round(cc * 10) / 10);
          } else {
            k.set('a', 1); k.set('b', -2); k.set('c', 1);
          }
        }
        sync();
        k.dirty();
      },
      change() { sync(); k.dirty(); },
      update() {},
      margin() {
        const a = p.a ?? 1, b = p.b ?? -1, c = p.c ?? -1;
        const q = thisState || analyzeQuadratic(a, b, c);
        if (q.isLinear) {
          return ['a = 0 退化边界', `直线斜率 ${b.toFixed(1)}`, q.roots.length ? `零点 x = ${q.roots[0].toFixed(2)}` : '无零点', q.parity];
        }
        return [
          `Δ = b²−4ac = ${q.delta.toFixed(2)}`,
          `对称轴 x = ${q.xv.toFixed(2)}`,
          `顶点 y = ${q.yv.toFixed(2)}`,
          q.roots.length ? `实根 ${q.roots.map((r) => r.toFixed(2)).join(', ')}` : '共轭复根',
          q.parity,
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 二次函数三式互转与退化边界 (a = 0 / Δ 判别)');
    let formMode = 0; // 0:一般式, 1:顶点式, 2:交点式
    const bar1 = document.createElement('div');
    bar1.className = 'wb-btn-row';
    bar1.innerHTML = `
      <button type="button" class="wb-btn primary" data-fm="0">一般式 ax²+bx+c</button>
      <button type="button" class="wb-btn" data-fm="1">顶点式 a(x−h)²+k</button>
      <button type="button" class="wb-btn" data-fm="2">交点式 a(x−x₁)(x−x₂)</button>
      <button type="button" class="wb-btn" data-act="deg">退化边界 a=0</button>
      <button type="button" class="wb-btn" data-act="rec">记入实验册</button>`;
    sec1.append(bar1);

    const formNote = document.createElement('div');
    formNote.className = 'wb-stat';
    sec1.append(formNote);

    const sec2 = wb.section('2 · 定义域对称性与单调性反例探索器');
    let fnIdx = 0;
    let domL = -2.5, domR = 2.5;
    let x1 = -1.0, x2 = 1.0;
    let symMode = 0; // 0: 沿 y 轴翻折 f(-x), 1: 绕原点旋转 -f(-x)
    let flipDeg = 0;

    const ctlRow = document.createElement('div');
    ctlRow.className = 'wb-row';
    ctlRow.innerHTML = `
      <label class="wb-ctl">函数
        <select class="wb-input" data-fn>${EXPLORE_FNS.map((f, i) => `<option value="${i}">${f.label}</option>`).join('')}</select>
      </label>
      <label class="wb-ctl">左端 L <input type="range" min="-3" max="0" step="0.5" value="-2.5" data-dl><span data-dlv>-2.5</span></label>
      <label class="wb-ctl">右端 R <input type="range" min="0" max="3" step="0.5" value="2.5" data-dr><span data-drv>2.5</span></label>
      <label class="wb-ctl">对称变换 <input type="range" min="0" max="180" step="5" value="0" data-deg><span data-degv>0°</span></label>`;
    sec2.append(ctlRow);

    const bar2 = document.createElement('div');
    bar2.className = 'wb-btn-row';
    bar2.style.marginTop = '8px';
    bar2.innerHTML = `
      <button type="button" class="wb-btn primary" data-sm="0">沿 y 轴翻折 (检偶性)</button>
      <button type="button" class="wb-btn" data-sm="1">绕原点旋转 (检奇性)</button>
      <button type="button" class="wb-btn" data-ce="inv">1/x 反例 (x₁=−1, x₂=1)</button>
      <button type="button" class="wb-btn" data-ce="asym">不对称定义域 [−1, 2]</button>`;
    sec2.append(bar2);

    const ptRow = document.createElement('div');
    ptRow.className = 'wb-row';
    ptRow.innerHTML = `
      <label class="wb-ctl">点 x₁ <input type="range" min="-3" max="2.5" step="0.1" value="-1" data-x1><span data-x1v>-1.0</span></label>
      <label class="wb-ctl">点 x₂ <input type="range" min="-2.5" max="3" step="0.1" value="1" data-x2><span data-x2v>1.0</span></label>`;
    sec2.append(ptRow);

    const cv2 = wb.canvas(sec2, 520, 270, (x, W, H) => {
      const p = sp.params;
      const spec = EXPLORE_FNS[fnIdx];
      const f = (v) => spec.fn(v, p);
      const xr = 3.5, yr = 4.2;
      const cx = W / 2, cy = H / 2;
      const sx = (v) => cx + (v / xr) * (W * 0.44);
      const sy = (v) => cy - (v / yr) * (H * 0.44);

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      // 区间外部阴影提示定义域裁剪
      x.fillStyle = 'rgba(30,43,54,0.06)';
      x.fillRect(0, 0, sx(domL), H);
      x.fillRect(sx(domR), 0, W - sx(domR), H);

      x.strokeStyle = 'rgba(30,43,54,0.14)'; x.lineWidth = 1;
      for (let i = -3; i <= 3; i++) {
        x.beginPath(); x.moveTo(sx(i), 10); x.lineTo(sx(i), H - 10); x.stroke();
      }
      for (let j = -4; j <= 4; j += 2) {
        x.beginPath(); x.moveTo(10, sy(j)); x.lineTo(W - 10, sy(j)); x.stroke();
      }
      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.6;
      x.beginPath(); x.moveTo(10, cy); x.lineTo(W - 10, cy); x.moveTo(cx, 10); x.lineTo(cx, H - 10); x.stroke();

      // 主函数在 [domL, domR] 内绘制
      const drawCurve = (fnEval, color, lw, dashed = false) => {
        x.save();
        x.strokeStyle = color; x.lineWidth = lw; x.setLineDash(dashed ? [5, 4] : []);
        x.beginPath();
        let started = false;
        for (let i = 0; i <= 200; i++) {
          const xv = lerp(domL, domR, i / 200);
          const yv = fnEval(xv);
          if (!Number.isFinite(yv) || Math.abs(yv) > yr) { started = false; continue; }
          if (!started) { x.moveTo(sx(xv), sy(yv)); started = true; }
          else x.lineTo(sx(xv), sy(yv));
        }
        x.stroke();
        x.restore();
      };

      drawCurve(f, '#7a5cff', 2.4);

      // 变换副本：t = flipDeg / 180，沿 y 轴翻折 x -> lerp(x, -x, t)；绕原点旋转 (x,y) -> cosθ, sinθ 平面内旋转
      if (flipDeg > 0) {
        const th = (flipDeg * Math.PI) / 180;
        x.save();
        x.strokeStyle = '#b4653a'; x.lineWidth = 2; x.setLineDash([5, 3]);
        x.beginPath();
        let started = false;
        for (let i = 0; i <= 200; i++) {
          const xv = lerp(domL, domR, i / 200);
          const yv = f(xv);
          if (!Number.isFinite(yv) || Math.abs(yv) > yr) { started = false; continue; }
          let tx = xv, ty = yv;
          if (symMode === 0) {
            tx = xv * Math.cos(th); // 绕 y 轴三维翻折投影
          } else {
            tx = xv * Math.cos(th) - yv * Math.sin(th);
            ty = xv * Math.sin(th) + yv * Math.cos(th);
          }
          if (Math.abs(ty) > yr + 0.5) { started = false; continue; }
          if (!started) { x.moveTo(sx(tx), sy(ty)); started = true; }
          else x.lineTo(sx(tx), sy(ty));
        }
        x.stroke();
        x.restore();
      }

      // 两点 x1, x2 与割线
      const y1 = f(x1), y2 = f(x2);
      if (Number.isFinite(y1) && Number.isFinite(y2) && Math.abs(y1) <= yr && Math.abs(y2) <= yr) {
        x.strokeStyle = '#2fb46a'; x.lineWidth = 1.8; x.beginPath();
        x.moveTo(sx(x1), sy(y1)); x.lineTo(sx(x2), sy(y2)); x.stroke();
        for (const [px, py, lbl] of [[x1, y1, 'x₁'], [x2, y2, 'x₂']]) {
          x.fillStyle = '#1f4a3e'; x.beginPath(); x.arc(sx(px), sy(py), 5, 0, TAU); x.fill();
          x.font = '11px Georgia,serif'; x.fillText(lbl, sx(px) + 6, sy(py) - 6);
        }
      }
    });

    const stats2 = document.createElement('div');
    stats2.className = 'wb-metrics';
    sec2.append(stats2);

    const refresh = () => {
      const p = sp.params;
      const a = p.a ?? 1, b = p.b ?? -1, c = p.c ?? -1;
      const q = analyzeQuadratic(a, b, c);
      let formHtml = '';
      if (q.isLinear) {
        formHtml = `<b>退化边界触发 (a = 0)：</b>二次项归零，方程退化为一次直线 <code>y = ${b.toFixed(1)}x ${c >= 0 ? '+' : '−'} ${Math.abs(c).toFixed(1)}</code>。`
          + (formMode > 0 ? ' 原抛物线顶点式与双根交点式不再存在。' : '');
      } else if (formMode === 0) {
        formHtml = `<b>一般式：</b>y = ${a.toFixed(1)}x² ${b >= 0 ? '+' : '−'} ${Math.abs(b).toFixed(1)}x ${c >= 0 ? '+' : '−'} ${Math.abs(c).toFixed(1)} · <b>Δ = ${q.delta.toFixed(2)}</b>`;
      } else if (formMode === 1) {
        formHtml = `<b>顶点式：</b>y = ${a.toFixed(1)}(x ${q.xv >= 0 ? '−' : '+'} ${Math.abs(q.xv).toFixed(2)})² ${q.yv >= 0 ? '+' : '−'} ${Math.abs(q.yv).toFixed(2)} · 顶点 (${q.xv.toFixed(2)}, ${q.yv.toFixed(2)})`;
      } else {
        if (q.delta > 1e-6) {
          formHtml = `<b>交点式：</b>y = ${a.toFixed(1)}(x ${q.roots[0] >= 0 ? '−' : '+'} ${Math.abs(q.roots[0]).toFixed(2)})(x ${q.roots[1] >= 0 ? '−' : '+'} ${Math.abs(q.roots[1]).toFixed(2)})`;
        } else if (Math.abs(q.delta) <= 1e-6) {
          formHtml = `<b>重根交点式：</b>y = ${a.toFixed(1)}(x ${q.roots[0] >= 0 ? '−' : '+'} ${Math.abs(q.roots[0]).toFixed(2)})²`;
        } else {
          const re = -b / (2 * a), im = Math.sqrt(-q.delta) / (2 * Math.abs(a));
          formHtml = `<b>Δ = ${q.delta.toFixed(2)} < 0：</b>实数域内无交点式，共轭复根为 ${re.toFixed(2)} ± ${im.toFixed(2)}i`;
        }
      }
      formNote.innerHTML = formHtml;

      const spec = EXPLORE_FNS[fnIdx];
      const f = (v) => spec.fn(v, p);
      const symDomain = Math.abs(domL + domR) < 1e-6;
      let maxEven = 0, maxOdd = 0;
      for (let i = 1; i <= 30; i++) {
        const xv = (i / 30) * Math.min(Math.abs(domL), Math.abs(domR));
        const yPos = f(xv), yNeg = f(-xv);
        if (Number.isFinite(yPos) && Number.isFinite(yNeg)) {
          maxEven = Math.max(maxEven, Math.abs(yNeg - yPos));
          maxOdd = Math.max(maxOdd, Math.abs(yNeg + yPos));
        }
      }
      const parityVerdict = !symDomain
        ? `非奇非偶（定义域 [${domL.toFixed(1)}, ${domR.toFixed(1)}] 不关于原点对称）`
        : maxEven < 1e-3 && maxOdd < 1e-3 ? '既奇又偶'
        : maxEven < 1e-3 ? '偶函数 f(−x)=f(x)'
        : maxOdd < 1e-3 ? '奇函数 f(−x)=−f(x)'
        : '非奇非偶';

      const y1 = f(x1), y2 = f(x2);
      const inDom = x1 >= domL && x1 <= domR && x2 >= domL && x2 <= domR;
      const monoText = !inDom
        ? 'x₁ 或 x₂ 超出当前定义域'
        : !Number.isFinite(y1) || !Number.isFinite(y2)
        ? '在间断点 x = 0 处无定义'
        : x1 < x2
        ? `${y1 < y2 ? 'f(x₁) < f(x₂) (上升)' : y1 > y2 ? 'f(x₁) > f(x₂) (下降)' : '持平'}${spec.cutZero && x1 * x2 < 0 ? ' ⚠ 跨过间断点！' : ''}`
        : '请令 x₁ < x₂';

      stats2.innerHTML = `
        <div class="wb-m"><span>定义域 [${domL.toFixed(1)}, ${domR.toFixed(1)}]</span><b>${symDomain ? '关于原点对称 ✓' : '不对称 ✗'}</b></div>
        <div class="wb-m"><span>奇偶性判定</span><b>${parityVerdict}</b></div>
        <div class="wb-m"><span>两点检验 (${x1.toFixed(1)} vs ${x2.toFixed(1)})</span><b>${monoText}</b></div>`;
      cv2.redraw();
    };

    bar1.addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      if (btn.dataset.fm !== undefined) {
        formMode = +btn.dataset.fm;
        bar1.querySelectorAll('[data-fm]').forEach((b) => b.classList.toggle('primary', +b.dataset.fm === formMode));
      } else if (btn.dataset.act === 'deg') {
        wb.press('btnDeg');
      } else if (btn.dataset.act === 'rec') {
        wb.record(func.record.sample(sp.inst, sp.params));
      }
      refresh();
    });

    ctlRow.querySelector('[data-fn]').addEventListener('change', (e) => { fnIdx = +e.target.value; refresh(); });
    ctlRow.querySelector('[data-dl]').addEventListener('input', (e) => { domL = +e.target.value; ctlRow.querySelector('[data-dlv]').textContent = domL.toFixed(1); refresh(); });
    ctlRow.querySelector('[data-dr]').addEventListener('input', (e) => { domR = +e.target.value; ctlRow.querySelector('[data-drv]').textContent = domR.toFixed(1); refresh(); });
    ctlRow.querySelector('[data-deg]').addEventListener('input', (e) => { flipDeg = +e.target.value; ctlRow.querySelector('[data-degv]').textContent = `${flipDeg}°`; refresh(); });
    ptRow.querySelector('[data-x1]').addEventListener('input', (e) => { x1 = +e.target.value; ptRow.querySelector('[data-x1v]').textContent = x1.toFixed(1); refresh(); });
    ptRow.querySelector('[data-x2]').addEventListener('input', (e) => { x2 = +e.target.value; ptRow.querySelector('[data-x2v]').textContent = x2.toFixed(1); refresh(); });

    bar2.addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      if (btn.dataset.sm !== undefined) {
        symMode = +btn.dataset.sm;
        bar2.querySelectorAll('[data-sm]').forEach((b) => b.classList.toggle('primary', +b.dataset.sm === symMode));
        flipDeg = 180;
        ctlRow.querySelector('[data-deg]').value = '180';
        ctlRow.querySelector('[data-degv]').textContent = '180°';
      } else if (btn.dataset.ce === 'inv') {
        fnIdx = 2; ctlRow.querySelector('[data-fn]').value = '2';
        domL = -3; domR = 3; x1 = -1; x2 = 1;
        ctlRow.querySelector('[data-dl]').value = '-3'; ctlRow.querySelector('[data-dlv]').textContent = '-3.0';
        ctlRow.querySelector('[data-dr]').value = '3'; ctlRow.querySelector('[data-drv]').textContent = '3.0';
        ptRow.querySelector('[data-x1]').value = '-1'; ptRow.querySelector('[data-x1v]').textContent = '-1.0';
        ptRow.querySelector('[data-x2]').value = '1'; ptRow.querySelector('[data-x2v]').textContent = '1.0';
      } else if (btn.dataset.ce === 'asym') {
        fnIdx = 0; ctlRow.querySelector('[data-fn]').value = '0';
        wb.setParam('b', 0);
        domL = -1; domR = 2;
        ctlRow.querySelector('[data-dl]').value = '-1'; ctlRow.querySelector('[data-dlv]').textContent = '-1.0';
        ctlRow.querySelector('[data-dr]').value = '2'; ctlRow.querySelector('[data-drv]').textContent = '2.0';
      }
      refresh();
    });

    let lastK = '';
    refresh();
    return {
      update() {
        const p = sp.params;
        const kk = `${p.a}|${p.b}|${p.c}`;
        if (kk !== lastK) { lastK = kk; refresh(); }
      },
    };
  },
};

// ================================================================
// 2. 三角函数图像变换与从圆周运动到正弦曲线 (math-sine, L3)
// ================================================================
export const sine = {
  id: 'math-sine',
  subject: 'math',
  title: '三角函数图像变换与从圆周运动到正弦曲线',
  en: 'Trigonometric transformations & unit circle',
  lede: [
    '相量半径绕圆心匀速旋转，把每一时刻末端的竖直高度沿横轴展开，就得到正弦波 y = A sin(ωx + φ) + k。',
    '然而从 y = sin x 变换出目标波形时，“先平移还是先伸缩”并不等价！在工作台使用相位变换顺序对比器，直观分辨 sin(ωx + φ) 与 sin(ω(x + φ)) 的本质差异。',
  ],
  formula: 'y = A sin(ωx + φ) + k · T = 2π / ω',
  formulaNote: '等价写法 y = A sin[ω(x + φ/ω)] + k：先伸缩 ω 倍后再左/右平移应取 |φ|/ω 而非 |φ|',
  terms: [
    ['振幅与偏置 (A, k)', 'A 决定波形偏离平衡线 y = k 的最大高度，值域为 [k − A, k + A]'],
    ['角频率 ω 与周期 T', '点在圆上转得越快，ω 越大，周期 T = 2π/ω 越小，曲线在横向上被压缩'],
    ['相位变换非交换性', '先左移 φ 再横向压缩 ω 倍得 sin(ωx + φ)；若先压缩 ω 倍再左移 φ 则错得 sin(ω(x + φ)) = sin(ωx + ωφ)'],
  ],
  predict: {
    q: '要从 y = sin x 的图象得到 y = sin(2x + π/3)，如果“先将横坐标缩短为原来的 1/2”，下一步需要怎样平移？',
    options: [
      '向左平移 π/3 个单位',
      '向左平移 π/6 个单位（即 φ/ω）',
      '向右平移 π/6 个单位',
    ],
    answer: 1,
    why: '先伸缩得到 y = sin(2x)；再把 x 替换为 (x + π/6)，才得到 y = sin[2(x + π/6)] = sin(2x + π/3)。若平移 π/3 则会变成 sin(2x + 2π/3)！',
  },
  challenge: '调出 φ = π/2 验证正弦变余弦；再把 ω 设为 2、φ 设为 π/3，打开工作台对比“先移后缩”与“先缩后移”两条曲线的相位差！',
  fig: '左侧旋转相量圆与右侧展开的正弦曲线 y = A sin(ωx + φ) + k（灰色为参考 y = sin x）',
  hint: '拖 A、ω、φ、k 四滑杆，或直接拖动圆上红点手动拨动相位 x。',
  teach: {
    where: '人教 A 版数学必修第一册第五章 §5.6《函数 y = A sin(ωx + φ)》',
    ask: [
      '为什么改变 k 只上下移动圆心与平衡位置，而不改变周期和振幅？',
      '证明从 y = sin(ωx + φ) + k 反推到 y = sin x 时的逆变换顺序。',
    ],
    simplify: '展开窗口为 x ∈ [0, 2.6π]；约定 A > 0, ω > 0 的标准相位讨论区间。',
    safety: '纯几何运动与三角函数解析可视化实验。',
  },
  controls: [
    { id: 'A', label: '振幅 A', min: 0.4, max: 1.5, step: 0.1, value: 1.0 },
    { id: 'w', label: '角频率 ω', min: 0.5, max: 3.0, step: 0.1, value: 1.0 },
    { id: 'f', label: '初相 φ', min: -3.14, max: 3.14, step: 0.01, value: 0, fmt: piFmt },
    { id: 'k', label: '竖直偏置 k', min: -0.9, max: 0.9, step: 0.1, value: 0 },
    { id: 'run', label: '相量转动', type: 'toggle', value: true },
    { id: 'btnCos', label: '余弦等价', type: 'button', text: 'φ = π/2' },
    { id: 'btnExam', label: '变换考题', type: 'button', text: 'ω=2, φ=π/3' },
  ],
  record: {
    note: '记录每组三要素与偏置下的周期、值域与等效先缩后移量 −φ/ω。',
    pending: '在工作台点击“记入实验册”保存当前波形参数。',
    columns: [
      { key: 'A', label: 'A', digits: 1 },
      { key: 'w', label: 'ω', digits: 1 },
      { key: 'f', label: 'φ (rad)', digits: 2 },
      { key: 'k', label: 'k', digits: 1 },
      { key: 'T', label: '周期 T', digits: 2, stat: true },
      { key: 'shift', label: '先缩后移 −φ/ω', digits: 3 },
    ],
    sample: (inst, p) => {
      const w = p.w ?? 1, f = p.f ?? 0;
      return {
        _kind: 'theory',
        A: p.A ?? 1,
        w,
        f,
        k: p.k ?? 0,
        T: TAU / w,
        shift: -f / w,
      };
    },
    summary: (rows) => [
      ['已记录波形组', `${rows.length} 组`],
      ['最新周期 T', rows.length ? `${rows[rows.length - 1].T.toFixed(3)}` : '—'],
    ],
    errors: [
      '把 y = sin(ωx + φ) 的平移量误认作 −φ：所有对 x 的平移都必须提取公因子 ω，变成 sin[ω(x + φ/ω)]。',
    ],
  },

  build(k) {
    const p = k.p;
    const Z = -1.25, YC = 2.85, CX = -3.15, U = 0.95, X0 = -1.25, XS = 0.65, XMAX = 2.6 * Math.PI;
    k.root.add(at(clean(box(9.6, 5.8, 0.08)), 0, 0, Z - 0.2));
    k.root.add(
      wire([X0, YC, Z], [X0 + XMAX * XS + 0.3, YC, Z]),
      wire([X0, YC - 2.35, Z], [X0, YC + 2.35, Z]),
      wire([CX - 1.75, YC, Z], [CX + 1.75, YC, Z], 0.014),
      wire([CX, YC - 2.2, Z], [CX, YC + 2.2, Z], 0.014),
    );
    [1, 2].forEach((n) => {
      k.root.add(
        at(note(`${n}π`, { size: 0.24 }), X0 + n * Math.PI * XS, YC - 0.28, Z + 0.02),
        wire([X0 + n * Math.PI * XS, YC - 0.08, Z], [X0 + n * Math.PI * XS, YC + 0.08, Z]),
      );
    });

    const circ = strip(65, { w: 0.042, color: C.ink });
    const refWave = strip(120, { w: 0.032, color: '#b9b4a6' });
    const eqLine = strip(2, { w: 0.022, color: C.copper, opacity: 0.5 });
    const wave = strip(160, { w: 0.075, color: C.flame });
    const rad = rod([CX, YC, Z], [CX + 1, YC, Z], 0.03, C.flame);
    const P = flat(new THREE.SphereGeometry(0.14, 16, 12), C.flame);
    const Q = flat(new THREE.SphereGeometry(0.13, 16, 12), C.violet);
    const link = strip(2, { w: 0.028, color: C.copper, opacity: 0.7 });
    const drop = strip(2, { w: 0.028, color: C.copper, opacity: 0.7 });
    const info = at(card('\n\n', { w: 4.3, size: 0.27, align: 'left' }), 2.35, 0, 2.75);
    k.root.add(circ, refWave, eqLine, wave, rad, P, Q, link, drop, info);
    refWave.set(Array.from({ length: 120 }, (_, i) => {
      const xx = (i / 119) * XMAX;
      return [X0 + xx * XS, YC + Math.sin(xx) * U, Z];
    }));

    let xPhase = 0;
    const render = () => {
      const A = p.A ?? 1, w = p.w ?? 1, f = p.f ?? 0, kv = p.k ?? 0;
      const cy = YC + kv * U;
      const r = A * U;
      const ph = w * xPhase + f;
      circ.set(Array.from({ length: 65 }, (_, i) => [CX + Math.cos((i / 64) * TAU) * r, cy + Math.sin((i / 64) * TAU) * r, Z]));
      eqLine.set([[X0, cy, Z], [X0 + XMAX * XS, cy, Z]]);
      wave.set(Array.from({ length: 160 }, (_, i) => {
        const xx = (i / 159) * XMAX;
        return [X0 + xx * XS, cy + A * Math.sin(w * xx + f) * U, Z];
      }));
      const px = CX + Math.cos(ph) * r, py = cy + Math.sin(ph) * r;
      const qx = X0 + xPhase * XS;
      rad.span([CX, cy, Z], [px, py, Z]);
      P.position.set(px, py, Z + 0.02);
      Q.position.set(qx, py, Z + 0.02);
      link.set([[px, py, Z], [qx, py, Z]]);
      drop.set([[qx, YC, Z], [qx, py, Z]]);
      const sh = -f / w;
      const shTxt = Math.abs(sh) < 0.005 ? '无水平平移' : `等效${sh < 0 ? '左' : '右'}移 ${Math.abs(sh).toFixed(2)}`;
      info.set(`y = ${A.toFixed(1)} sin(${w.toFixed(1)}x ${f >= 0 ? '+' : '−'} ${Math.abs(f).toFixed(2)}) ${kv >= 0 ? '+' : '−'} ${Math.abs(kv).toFixed(1)}\n周期 T = ${(TAU / w).toFixed(2)} (${piFmt(TAU / w)}) · ${shTxt}\n值域 [${(kv - A).toFixed(1)}, ${(kv + A).toFixed(1)}]`);
    };

    let qx0 = null, x0 = 0;
    k.drag(Q, {
      start: (q) => { qx0 = q.x; x0 = xPhase; },
      move: (q) => {
        if (qx0 === null) return;
        xPhase = clamp(x0 + (q.x - qx0) / XS, 0, XMAX);
        render(); k.dirty();
      },
      end: () => { qx0 = null; },
    });

    render();
    return {
      press(id) {
        if (id === 'btnCos') { k.set('A', 1); k.set('w', 1); k.set('f', 1.57); k.set('k', 0); }
        else if (id === 'btnExam') { k.set('w', 2); k.set('f', 1.05); }
        render(); k.dirty();
      },
      change() { render(); k.dirty(); },
      update(dt) {
        if (p.run ?? true) {
          xPhase = (xPhase + dt * 1.25) % XMAX;
        }
        render();
      },
      margin() {
        const A = p.A ?? 1, w = p.w ?? 1, f = p.f ?? 0, kv = p.k ?? 0;
        const sh = -f / w;
        return [
          `A = ${A.toFixed(1)}, k = ${kv.toFixed(1)}`,
          `ω = ${w.toFixed(1)}, T = ${(TAU / w).toFixed(2)}`,
          `φ = ${piFmt(f)}`,
          `等价 ω(x ${f >= 0 ? '+' : '−'} ${Math.abs(f / w).toFixed(2)})`,
          Math.abs(sh) < 0.005 ? '无左右平移' : `相当于${sh < 0 ? '左' : '右'}移 ${Math.abs(sh).toFixed(2)}`,
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 相位变换顺序对比器：f(ω(x+φ/ω)) vs f(ω(x+φ))');
    let showWrong = true;
    let showCorrectOrder = true;
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn primary" data-act="exam">经典示例 ω=2, φ=π/3</button>
      <button type="button" class="wb-btn" data-act="togWrong">切换误用曲线 sin(ω(x+φ))</button>
      <button type="button" class="wb-btn" data-act="togOrder">切换先缩后移 sin(ω(x+φ/ω))</button>
      <button type="button" class="wb-btn" data-act="rec">记入实验册</button>`;
    sec1.append(bar);

    const cv = wb.canvas(sec1, 520, 270, (x, W, H) => {
      const p = sp.params;
      const A = p.A ?? 1, w = p.w ?? 1, f = p.f ?? 0, kv = p.k ?? 0;
      const pad = { l: 44, r: 16, t: 22, b: 30 };
      const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      const xMax = 2 * Math.PI, yMin = -2.6, yMax = 2.6;
      const sx = (xv) => pad.l + (xv / xMax) * pw;
      const sy = (yv) => pad.t + ph - ((yv - yMin) / (yMax - yMin)) * ph;

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      x.strokeStyle = 'rgba(30,43,54,0.13)'; x.lineWidth = 1;
      for (let m = 0; m <= 4; m++) {
        const gx = sx((m * Math.PI) / 2);
        x.beginPath(); x.moveTo(gx, pad.t); x.lineTo(gx, pad.t + ph); x.stroke();
      }
      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(pad.l, sy(0)); x.lineTo(pad.l + pw, sy(0)); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.stroke();

      const plotWave = (fn, color, lw, dashPat = []) => {
        x.save(); x.strokeStyle = color; x.lineWidth = lw; x.setLineDash(dashPat);
        x.beginPath();
        for (let i = 0; i <= 220; i++) {
          const xv = (i / 220) * xMax;
          const yv = fn(xv);
          if (i === 0) x.moveTo(sx(xv), sy(yv)); else x.lineTo(sx(xv), sy(yv));
        }
        x.stroke(); x.restore();
      };

      // 母函数 y = sin x
      plotWave((v) => Math.sin(v), '#b9b4a6', 1.6, [4, 4]);
      // 目标：先移 φ 再缩 ω => A sin(ωx + φ) + k
      plotWave((v) => A * Math.sin(w * v + f) + kv, '#ff6a3d', 2.8);
      // 正确先缩后移：A sin(ω(x + φ/ω)) + k（与目标完全重合！）
      if (showCorrectOrder) {
        plotWave((v) => A * Math.sin(w * (v + f / w)) + kv, '#7a5cff', 2.0, [7, 5]);
      }
      // 常见错法：先缩 ω 再移 φ => A sin(ω(x + φ)) + k = A sin(ωx + ωφ) + k
      if (showWrong) {
        plotWave((v) => A * Math.sin(w * (v + f)) + kv, '#1f4a3e', 2.0, [3, 3]);
      }

      x.fillStyle = '#1e2b36'; x.font = '11px Georgia,serif'; x.textAlign = 'center';
      ['0', 'π/2', 'π', '3π/2', '2π'].forEach((t, i) => x.fillText(t, sx((i * Math.PI) / 2), H - 10));
      x.textAlign = 'left';
      x.fillStyle = '#ff6a3d'; x.fillText('— 目标: A sin(ωx + φ) + k（先移 φ 后缩 ω）', pad.l + 6, 15);
      if (showCorrectOrder) {
        x.fillStyle = '#7a5cff'; x.fillText('-- 等价: A sin(ω(x + φ/ω)) + k（先缩 ω 后移 φ/ω，完全重合）', pad.l + 6, 30);
      }
      if (showWrong) {
        x.fillStyle = '#1f4a3e'; x.fillText('·· 常见错法: A sin(ω(x + φ)) + k（错移 φ 而非 φ/ω）', pad.l + 6, 45);
      }
    });

    const stats = document.createElement('div');
    stats.className = 'wb-metrics';
    sec1.append(stats);

    const refresh = () => {
      const p = sp.params;
      const A = p.A ?? 1, w = p.w ?? 1, f = p.f ?? 0, kv = p.k ?? 0;
      const phaseDiff = (w - 1) * f;
      const eqShift = -f / w;
      stats.innerHTML = `
        <div class="wb-m"><span>先移后缩平移量</span><b>${f >= 0 ? '左移' : '右移'} ${Math.abs(f).toFixed(3)} rad</b></div>
        <div class="wb-m"><span>先缩后移所需平移</span><b>${eqShift <= 0 ? '左移' : '右移'} ${Math.abs(eqShift).toFixed(3)} (φ/ω)</b></div>
        <div class="wb-m"><span>错法相位偏差 (ω−1)φ</span><b>${phaseDiff.toFixed(3)} rad${Math.abs(phaseDiff) < 1e-3 ? ' (仅ω=1重合)' : ' (明显错位!)'}</b></div>
        <div class="wb-m"><span>周期 T & 值域</span><b>T=${(TAU / w).toFixed(3)} · [${(kv - A).toFixed(1)}, ${(kv + A).toFixed(1)}]</b></div>`;
      cv.redraw();
    };

    bar.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (!act) return;
      if (act === 'exam') { wb.setParam('A', 1); wb.setParam('w', 2); wb.setParam('f', 1.05); wb.setParam('k', 0); }
      else if (act === 'togWrong') showWrong = !showWrong;
      else if (act === 'togOrder') showCorrectOrder = !showCorrectOrder;
      else if (act === 'rec') wb.record(sine.record.sample(sp.inst, sp.params));
      refresh();
    });

    let lastK = '';
    refresh();
    return {
      update() {
        const p = sp.params;
        const kk = `${p.A}|${p.w}|${p.f}|${p.k}`;
        if (kk !== lastK) { lastK = kk; refresh(); }
      },
    };
  },
};

// ================================================================
// 3. 正方体的截面形状与空间几何约束证明 (math-cube, L3)
// ================================================================
const UNIT_CUBE_VERTS = [];
for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) UNIT_CUBE_VERTS.push([x, y, z]);
const UNIT_CUBE_EDGES = [];
for (let i = 0; i < 8; i++) {
  for (let j = i + 1; j < 8; j++) {
    if (UNIT_CUBE_VERTS[i].filter((v, q) => v !== UNIT_CUBE_VERTS[j][q]).length === 1) UNIT_CUBE_EDGES.push([i, j]);
  }
}
const CUBE_FACES = [
  { key: 'x+', label: '右面 x=+½', axis: 0, val: 0.5 },
  { key: 'x-', label: '左面 x=−½', axis: 0, val: -0.5 },
  { key: 'y+', label: '顶面 y=+½', axis: 1, val: 0.5 },
  { key: 'y-', label: '底面 y=−½', axis: 1, val: -0.5 },
  { key: 'z+', label: '前面 z=+½', axis: 2, val: 0.5 },
  { key: 'z-', label: '后面 z=−½', axis: 2, val: -0.5 },
];

function sliceUnitCube(aDeg, bDeg, d) {
  const a = aDeg * DEG, b = bDeg * DEG;
  const n = new THREE.Vector3(Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)).normalize();
  const raw = [];
  for (const [i, j] of UNIT_CUBE_EDGES) {
    const A = new THREE.Vector3(...UNIT_CUBE_VERTS[i]);
    const B = new THREE.Vector3(...UNIT_CUBE_VERTS[j]);
    const da = n.dot(A) - d;
    const db = n.dot(B) - d;
    if (Math.abs(da) < 1e-6 && Math.abs(db) < 1e-6) {
      raw.push(A, B);
    } else if (Math.abs(da) < 1e-6) {
      raw.push(A);
    } else if (Math.abs(db) < 1e-6) {
      raw.push(B);
    } else if (da * db < 0) {
      raw.push(A.clone().lerp(B, da / (da - db)));
    }
  }
  // 以容差 1e-5 合并过顶点重合交点
  const pts = [];
  for (const pt of raw) {
    if (!pts.some((q) => q.distanceToSquared(pt) < 1e-10)) pts.push(pt);
  }
  if (pts.length < 3) {
    return { n, pts: [], u: new THREE.Vector3(1, 0, 0), w: new THREE.Vector3(0, 0, 1), centroid: new THREE.Vector3(), area: 0, perimeter: 0, edgeLengths: [], facesHit: [], angles: [], name: '未形成截面' };
  }
  const centroid = pts.reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(1 / pts.length);
  const ref = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(n, ref).normalize();
  const w = new THREE.Vector3().crossVectors(n, u).normalize();
  pts.sort((P1, P2) => {
    const d1 = P1.clone().sub(centroid), d2 = P2.clone().sub(centroid);
    return Math.atan2(d1.dot(w), d1.dot(u)) - Math.atan2(d2.dot(w), d2.dot(u));
  });

  // 验证极角排序后的凸多边形边长、面积与相交面（每个边中点落入唯一正方体表面）
  let area = 0, perimeter = 0;
  const edgeLengths = [];
  const facesHit = new Set();
  for (let i = 0; i < pts.length; i++) {
    const P1 = pts[i], P2 = pts[(i + 1) % pts.length];
    const len = P1.distanceTo(P2);
    edgeLengths.push(len);
    perimeter += len;
    area += new THREE.Vector3().crossVectors(P1.clone().sub(centroid), P2.clone().sub(centroid)).length() * 0.5;
    const mid = P1.clone().add(P2).multiplyScalar(0.5);
    const arr = [mid.x, mid.y, mid.z];
    for (const f of CUBE_FACES) {
      if (Math.abs(arr[f.axis] - f.val) < 1e-4) facesHit.add(f.key);
    }
  }
  // 排除因共面边界导致的异常（仅保留真内截面）
  const angles = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[(i - 1 + pts.length) % pts.length].clone().sub(pts[i]).normalize();
    const next = pts[(i + 1) % pts.length].clone().sub(pts[i]).normalize();
    angles.push(Math.acos(clamp(prev.dot(next), -1, 1)) / DEG);
  }
  const names = ['', '', '', '三角形', '四边形', '五边形', '六边形'];
  let name = names[pts.length] || `${pts.length}边形`;
  if (pts.length === 4) {
    const eq = edgeLengths.every((l) => Math.abs(l - edgeLengths[0]) < 1e-3);
    const right = angles.every((ang) => Math.abs(ang - 90) < 0.5);
    if (eq && right) name = '正方形（四边形）';
    else if (eq) name = '菱形（四边形）';
    else if (right) name = '矩形（四边形）';
    else name = '梯形/一般四边形';
  } else if (pts.length === 6) {
    const eq = edgeLengths.every((l) => Math.abs(l - edgeLengths[0]) < 1e-3);
    if (eq) name = '正六边形';
  } else if (pts.length === 3) {
    const eq = edgeLengths.every((l) => Math.abs(l - edgeLengths[0]) < 1e-3);
    if (eq) name = '正三角形';
  }
  return { n, pts, u, w, centroid, area, perimeter, edgeLengths, facesHit: [...facesHit], angles, name };
}

export const cube = {
  id: 'math-cube',
  subject: 'math',
  title: '正方体的截面形状与空间几何约束证明',
  en: 'Cross sections of a cube',
  lede: [
    '用一个平面去截棱长为 1 的正方体，截面多边形的每一条边，都是该平面与正方体某一个面的交线。正方体只有 6 个面，因而截面边数永远不超过 6。',
    '调节平面法向倾角与偏移量 d，观察三角形、正方形/梯形、五边形与正六边形截面；并在工作台逐面检验相交面数定理与三角形必为锐角的几何不等式！',
  ],
  formula: '边数 N = 相交正方体面数 ≤ 6 · 周长 L = ∑|PᵢPᵢ₊₁|',
  formulaNote: '单位正方体（棱长 1）：正六边形周长 3√2 ≈ 4.243、面积 3√3/4 ≈ 1.299；任意三角形截面必满足三内角均 < 90°',
  terms: [
    ['相交面数定理', '截面多边形的每条边都落在正方体一个表面上，每个面至多交出一条直线段，故边数 ≤ 6'],
    ['正六边形截面', '平面垂直于体对角线且过中心 (d = 0) 时，恰切过六条棱的中点，边长为 √2/2'],
    ['锐角三角形约束', '若截面为三角形，三条边必分别来自共顶点的三个两两垂直的面，由勾股与余弦定理可证 cosθ > 0'],
  ],
  predict: {
    q: '用平面去截正方体得到一个三角形截面，这个三角形有可能是直角三角形或钝角三角形吗？',
    options: [
      '可能，斜着切就能切出直角三角形',
      '不可能，它一定是锐角三角形',
      '只有当截面过顶点时才是直角',
    ],
    answer: 1,
    why: '设切下墙角的三条交棱长为 x, y, z > 0，则截面三边平方为 x²+y²、y²+z²、z²+x²。任意两边平方和减第三边平方 = 2z² > 0，余弦恒正，故三内角必全为锐角！',
  },
  challenge: '切出一个边长为 √2/2 的正六边形；再调出三角形截面，在工作台核对三个内角是否全部严格小于 90°！',
  fig: '单位半透明正方体、可控法向切割平面及截交多边形',
  hint: '点下方截面预设，或拖 3D 截面橙色法向控制球改变方向与深度 d；展开工作台查看二维展开周长与面交统计。',
  teach: {
    where: '人教 A 版数学必修第二册第八章 §8.4《空间点、直线、平面之间的位置关系》',
    ask: [
      '正方体截面为四边形时，为什么至少有一组对边平行？',
      '用余弦定理证明：棱长为 1 的正方体截出的任意三角形截面三内角均小于 90°。',
    ],
    simplify: '设正方体中心在原点、棱长为 1，算法对 12 条棱求交并以 ε = 10⁻⁵ 合并过顶点重合交点，保证交点数与面交计数一致。',
    safety: '纯空间立体几何演绎可视化实验。',
  },
  controls: [
    { id: 'a', label: '法向倾角 θ', min: 0, max: 90, step: 0.2, value: 54.7, unit: '°' },
    { id: 'b', label: '法向方位 φ', min: 0, max: 90, step: 0.5, value: 45, unit: '°' },
    { id: 'd', label: '中心偏移 d', min: -0.9, max: 0.9, step: 0.01, value: 0, unit: 'u' },
    { id: 'p3', label: '截面预设', type: 'button', text: '正三角形' },
    { id: 'p4', label: '截面预设', type: 'button', text: '正方形' },
    { id: 'p5', label: '截面预设', type: 'button', text: '五边形' },
    { id: 'p6', label: '截面预设', type: 'button', text: '正六边形' },
  ],
  record: {
    note: '记录每组截面参数下的多边形边数、相交面数、周长 L 与面积 A。',
    pending: '点击预设或拖滑杆后在工作台点击“记入实验册”。',
    columns: [
      { key: 'name', label: '截面类型' },
      { key: 'edges', label: '边数 N', digits: 0 },
      { key: 'faces', label: '交面数', digits: 0 },
      { key: 'perimeter', label: '周长 L', digits: 4, stat: true },
      { key: 'area', label: '面积 A', digits: 4, stat: true },
    ],
    sample: (inst, p) => {
      const s = sliceUnitCube(p.a ?? 54.7, p.b ?? 45, p.d ?? 0);
      if (s.pts.length < 3) return null;
      return {
        _kind: 'model',
        name: s.name,
        edges: s.pts.length,
        faces: s.facesHit.length,
        perimeter: s.perimeter,
        area: s.area,
      };
    },
    summary: (rows) => [
      ['已切截面数', `${rows.length} 组`],
      ['最大验证边数', rows.length ? `${Math.max(...rows.map((r) => r.edges))} 边形` : '—'],
    ],
    errors: [
      '把平面穿过正方体顶点时的交点重复计数：三条棱汇于一点但只代表一个多边形顶点，必须去重。',
    ],
  },

  build(k) {
    const p = k.p;
    const X = -1.25, CY = 2.35, Z = -0.75, U = 2.55;
    const holder = at(new THREE.Group(), X, CY, Z);
    holder.scale.setScalar(U);

    // 单位正方体半透明玻璃体 + 棱边墨线
    const cubeGlass = glass(new THREE.BoxGeometry(1, 1, 1), { color: 0xd9e8f5, opacity: 0.24 });
    const edgeWire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: C.ink }));
    edgeWire.layers.set(1);

    // 切割玻璃平面片与法向控制球
    const planeGrp = group();
    const planeMesh = glass(new THREE.PlaneGeometry(1.75, 1.75), { color: 0xf6dfc7, opacity: 0.25 });
    const planeHandle = solid(new THREE.SphereGeometry(0.065, 16, 12), C.copper, { kind: 'metal' });
    planeHandle.position.set(0, 0, 0.45);
    planeGrp.add(planeMesh, planeHandle);

    const fillGeo = new THREE.BufferGeometry();
    fillGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18 * 3), 3));
    const fill = flat(fillGeo, C.flame, { opacity: 0.45 });
    fill.frustumCulled = false;
    const polyEdge = strip(10, { w: 0.028, color: C.flame });
    const vtxDots = dots(6, 0.032, C.flame, { flat: true });
    const normArrow = arrow(C.copper, 0.018);

    holder.add(cubeGlass, edgeWire, planeGrp, fill, polyEdge, vtxDots, normArrow);
    const info = at(card('\n\n', { w: 4.1, size: 0.27, align: 'left' }), 2.35, 0, 2.55);
    const big = at(note('正六边形', { size: 0.56, bold: true, w: 3.8, color: C.ink }), 2.35, 3.25, -2.0);
    k.root.add(holder, info, big);

    let lastState = null;
    const sync = () => {
      const aDeg = p.a ?? 54.7, bDeg = p.b ?? 45, d = p.d ?? 0;
      const s = sliceUnitCube(aDeg, bDeg, d);
      lastState = s;

      // 定向切割平面到法向 s.n 与偏移 d
      planeGrp.position.copy(s.n.clone().multiplyScalar(d));
      planeGrp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), s.n);
      normArrow.set(planeGrp.position, planeGrp.position.clone().addScaledVector(s.n, 0.48));

      const arr = fillGeo.attributes.position.array;
      arr.fill(0);
      const valid = s.pts.length >= 3;
      fill.visible = polyEdge.visible = valid;
      if (valid) {
        s.pts.forEach((P1, i) => {
          const P2 = s.pts[(i + 1) % s.pts.length];
          arr.set([s.centroid.x, s.centroid.y, s.centroid.z, P1.x, P1.y, P1.z, P2.x, P2.y, P2.z], i * 9);
        });
        fillGeo.attributes.position.needsUpdate = true;
        fillGeo.setDrawRange(0, s.pts.length * 3);
        polyEdge.nrm.copy(s.n);
        polyEdge.set([...s.pts, s.pts[0]]);
      }
      for (let i = 0; i < 6; i++) {
        if (s.pts[i]) vtxDots.put(i, s.pts[i].x, s.pts[i].y, s.pts[i].z, 1);
        else vtxDots.put(i, 0, -50, 0, 0.001);
      }
      vtxDots.done();

      big.set(s.name);
      info.set(`截面：${s.name}（${s.pts.length} 边 / 交 ${s.facesHit.length} 面）\n周长 L = ${s.perimeter.toFixed(4)}（棱长 1）\n面积 A = ${s.area.toFixed(4)}`);
    };

    let drag0 = null;
    k.drag(planeHandle, {
      start: (q) => { drag0 = { x: q.x, y: q.y, a: p.a, b: p.b, d: p.d }; },
      move: (q) => {
        if (!drag0) return;
        k.set('b', clamp(Math.round((drag0.b + (q.x - drag0.x) * 28) * 2) / 2, 0, 90));
        k.set('a', clamp(Math.round((drag0.a - (q.y - drag0.y) * 22) * 5) / 5, 0, 90));
        sync(); k.dirty();
      },
      end: () => { drag0 = null; },
    });

    const PRESETS = {
      p3: [54.7, 45, 0.5],
      p4: [0, 45, 0],
      p5: [60, 25, -0.22],
      p6: [54.7, 45, 0],
    };
    sync();
    return {
      press(id) {
        const q = PRESETS[id];
        if (q) { k.set('a', q[0]); k.set('b', q[1]); k.set('d', q[2]); sync(); k.dirty(); }
      },
      change() { sync(); k.dirty(); },
      update(dt, t) {
        holder.rotation.y = Math.sin(t * 0.25) * 0.22 - 0.35;
      },
      margin() {
        const s = lastState || sliceUnitCube(p.a ?? 54.7, p.b ?? 45, p.d ?? 0);
        return [
          `相交 ${s.facesHit.length} 面 → ${s.pts.length} 边`,
          `周长 L = ${s.perimeter.toFixed(3)}`,
          `面积 A = ${s.area.toFixed(3)}`,
          '正六边形 L = 3√2 ≈ 4.243',
          '正六边形 A = 3√3/4 ≈ 1.299',
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 截面二维展开图与周长 / 锐角三角形定理校验台');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn" data-pre="p3">正三角形</button>
      <button type="button" class="wb-btn" data-pre="p4">正方形</button>
      <button type="button" class="wb-btn" data-pre="p5">五边形</button>
      <button type="button" class="wb-btn" data-pre="p6">正六边形</button>
      <button type="button" class="wb-btn primary" data-act="rec">记入实验册</button>`;
    sec1.append(bar);

    const cv = wb.canvas(sec1, 520, 265, (x, W, H) => {
      const p = sp.params;
      const s = sliceUnitCube(p.a ?? 54.7, p.b ?? 45, p.d ?? 0);
      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      if (s.pts.length < 3) {
        x.fillStyle = '#51606b'; x.font = '14px "Noto Serif SC",serif';
        x.textAlign = 'center'; x.fillText('当前平面未切出截面多边形，请减小 |d|', W / 2, H / 2);
        return;
      }
      const proj = s.pts.map((pt) => {
        const rel = pt.clone().sub(s.centroid);
        return [rel.dot(s.u), rel.dot(s.w)];
      });
      const cx = W * 0.42, cy = H / 2, sc = 135;
      const sx = (u) => cx + u * sc, sy = (w) => cy - w * sc;

      // 多边形填充与边长标注
      x.fillStyle = 'rgba(255, 106, 61, 0.22)';
      x.strokeStyle = '#ff6a3d'; x.lineWidth = 2.4;
      x.beginPath();
      proj.forEach(([u, w], i) => (i === 0 ? x.moveTo(sx(u), sy(w)) : x.lineTo(sx(u), sy(w))));
      x.closePath(); x.fill(); x.stroke();

      x.font = '11px Georgia,serif';
      proj.forEach(([u1, w1], i) => {
        const [u2, w2] = proj[(i + 1) % proj.length];
        const mx = (sx(u1) + sx(u2)) / 2, my = (sy(w1) + sy(w2)) / 2;
        x.fillStyle = '#1e2b36';
        x.beginPath(); x.arc(sx(u1), sy(w1), 4.5, 0, TAU); x.fill();
        x.fillText(`V${i + 1}`, sx(u1) + 7, sy(w1) - 6);
        x.fillStyle = '#b4653a';
        x.fillText(s.edgeLengths[i].toFixed(3), mx + 4, my - 4);
      });

      // 右侧六面相交诊断清单
      const fx = W * 0.76;
      x.fillStyle = '#1e2b36'; x.font = 'bold 12px "Noto Serif SC",serif';
      x.fillText(`面交定理：${s.facesHit.length} 面 ⇒ ${s.pts.length} 边`, fx, 28);
      CUBE_FACES.forEach((f, idx) => {
        const hit = s.facesHit.includes(f.key);
        const yy = 54 + idx * 28;
        x.fillStyle = hit ? 'rgba(31,74,62,0.14)' : 'rgba(30,43,54,0.05)';
        x.fillRect(fx, yy, 112, 22);
        x.fillStyle = hit ? '#1f4a3e' : '#8a8f94';
        x.font = '11.5px "Noto Serif SC",serif';
        x.fillText(`${hit ? '✓' : '·'} ${f.label}`, fx + 8, yy + 15);
      });
    });

    const stats = document.createElement('div');
    stats.className = 'wb-metrics';
    sec1.append(stats);

    const refresh = () => {
      const p = sp.params;
      const s = sliceUnitCube(p.a ?? 54.7, p.b ?? 45, p.d ?? 0);
      const theoremText = s.pts.length === 3
        ? `内角 ${s.angles.map((v) => v.toFixed(1) + '°').join(', ')}（全 < 90° 锐角!）`
        : s.pts.length === 4 ? '至少一组对边所在面平行 ⇒ 对边平行'
        : s.pts.length >= 5 ? '切过 5–6 个面，不可超过 6 边' : '—';
      stats.innerHTML = `
        <div class="wb-m"><span>多边形分类</span><b>${s.name}</b></div>
        <div class="wb-m"><span>周长 L (边长之和)</span><b>${s.perimeter.toFixed(4)}</b></div>
        <div class="wb-m"><span>截面面积 A</span><b>${s.area.toFixed(4)}</b></div>
        <div class="wb-m"><span>几何定理检验</span><b>${theoremText}</b></div>`;
      cv.redraw();
    };

    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      if (btn.dataset.pre) wb.press(btn.dataset.pre);
      else if (btn.dataset.act === 'rec') {
        const row = cube.record.sample(sp.inst, sp.params);
        if (row) wb.record(row);
      }
      refresh();
    });

    let lastK = '';
    refresh();
    return {
      update() {
        const p = sp.params;
        const kk = `${p.a}|${p.b}|${p.d}`;
        if (kk !== lastK) { lastK = kk; refresh(); }
      },
    };
  },
};

// ================================================================
// 4. 丹德林双球与圆锥曲线的统一几何发生 (math-conic-locus, L4 — 原样保留)
// ================================================================
const ALPHA = 30 * DEG; // 圆锥半顶角 30°

/** 求解给定倾角 θ(rad) 与平面偏移 d 下、与圆锥(半顶角α)和平面同时相切的丹德林球 */
function dandelinGeometry(thetaDeg, d, alphaRad = ALPHA) {
  const th = thetaDeg * DEG;
  const k = Math.tan(alphaRad); // r(y) = k * |y|
  const n = [Math.sin(th), Math.cos(th)]; // 平面法向 (x, y) 方向, n·X = d
  const cosA = Math.cos(alphaRad);
  const spheres = [];
  // 圆锥轴上球心 (0, ys), 半径 R = |ys| * sinA; 点到平面距离 = |ys * cos(th) - d| = R
  const sinA = Math.sin(alphaRad);
  const tryBranch = (signY, signDist) => {
    const denom = Math.cos(th) - signY * signDist * sinA;
    if (Math.abs(denom) < 1e-4) return;
    const ys = d / denom;
    if (ys * signY <= 0.05 || Math.abs(ys) > 3.6) return;
    const R = Math.abs(ys) * sinA;
    if (R < 0.04 || R > 2.4) return;
    const distSigned = ys * Math.cos(th) - d;
    // 焦点即球心沿法向投影到平面上
    const fx = -distSigned * n[0];
    const fy = ys - distSigned * n[1];
    spheres.push({ ys, R, fx, fy, signY });
  };
  tryBranch(1, 1); tryBranch(1, -1); tryBranch(-1, 1); tryBranch(-1, -1);
  // 去重
  const uniq = [];
  for (const s of spheres) {
    if (!uniq.some((u) => Math.abs(u.ys - s.ys) < 1e-3)) uniq.push(s);
  }
  return { uniq: uniq.slice(0, 2), th, k, n, cosA };
}

export const conicLocus = {
  id: 'math-conic-locus',
  subject: 'math',
  title: '丹德林双球与圆锥曲线的统一几何发生',
  en: 'Dandelin spheres & unified conic section locus',
  lede: [
    '两千多年前古希腊人用平面斜截双对顶圆锥得到椭圆、抛物线与双曲线；一千八百多年后丹德林在圆锥内塞入与截面和锥面同时相切的两只球，一举把“焦半径和/差定值”与“离心率定义”化作可见的切线段相等！',
    '拖动截面控制柄旋转倾角 θ 并平移偏移量 d，观察退化临界点 d = 0 如何瞬间裂变为点、母线或两相交直线。',
  ],
  formula: 'e = sinθ / cosα · |PF₁ ± PF₂| = 2a · PF / d(P,l) = e',
  formulaNote: '固定圆锥半顶角 α = 30°（cosα = √3/2）：当 θ = 60° 时 sin60° = cos30°，离心率恰好 e = 1（抛物线）',
  terms: [
    ['切线段定理', '从截线上任意一点 P 向同一只丹德林球引两切线（至焦点 F 与至相切纬圆上点 Q），长度必然相等'],
    ['准线由来', '丹德林球与圆锥的相切水平圆所在平面，和斜截平面的交线就是该焦点对应的准线 l'],
    ['退化圆锥曲线', '当截面刚好穿过圆锥顶点 (d = 0) 时，交集不再光滑，分别退化为单点、一条母线或两相交直线'],
  ],
  predict: {
    q: '圆锥半顶角 α = 30°。要把截面截成一条标准的抛物线，截面与水平面的倾角 θ 应当调到多少度？',
    options: ['30°（与半顶角相同）', '45°', '60°（与圆锥母线平行，θ = 90° − α）'],
    answer: 2,
    why: '抛物线的定义要求截面平行于圆锥的一条母线，此时截面与水平面夹角 θ = 90° − α = 60°，离心率 e = sin60°/cos30° = 1，上侧刚好只容得下 1 只丹德林球！',
  },
  challenge: '调出离心率恰好等于 1.000 的抛物线；随后把偏移量 d 推到 0 观察三种退化极限，并在工作台拖动动点 P 验证 |PF₁−PF₂| 与 PF₁/d 恒等！',
  fig: '对顶双圆锥、可旋转斜截平面与内切丹德林球',
  hint: '拖截面铜环可直接倾斜或上下推移平面；打开工作台检验二维平面坐标 (u,v) 内焦半径与准线比例实时数值。',
  teach: {
    where: '人教A版数学选择性必修第一册第三章《圆锥曲线的方程》章首阅读与探究：用 Dandelin 双球证椭圆第一定义',
    ask: [
      '为什么截面从 θ = 59° 变为 θ = 61° 时，第二只丹德林球突然“从无穷远处跳到另一侧圆锥上”？',
      '证明从点 P 到准线 l 的距离为何正比于 P 沿母线到顶点的高度差，从而推导出 e = sinθ/cosα。',
    ],
    simplify: '设圆锥顶角 α = 30° 且截线保持对称于 xOy 竖直平面截取，焦点位置与交线点集由严格空间解析交点公式实时算出，非贴图近似。',
    safety: '纯几何演绎与坐标解析可视化实验。',
  },
  controls: [
    { id: 'theta', label: '截面倾角 θ', min: 0, max: 82, step: 0.5, value: 26, unit: '°' },
    { id: 'd', label: '截面距顶点偏移 d', min: -1.1, max: 1.1, step: 0.02, value: 0.55, unit: 'u' },
    { id: 'showSpheres', label: '丹德林相切球', type: 'toggle', value: true },
    { id: 'presetP', label: '切出抛物线', type: 'button', action: 'parabola', text: 'θ=60° 抛物线' },
    { id: 'presetH', label: '切出双曲线', type: 'button', action: 'hyperbola', text: 'θ=75° 双曲线' },
    { id: 'presetD', label: '过顶点退化', type: 'button', action: 'apex', text: 'd=0 退化极限' },
  ],
  record: {
    note: '记下每次几何参数改变后的截面类型、离心率 e = sinθ/cos30° 及丹德林球数量。',
    pending: '旋转截面或点击记录将当前圆锥曲线参数归档对比。',
    columns: [
      { key: 'kind', label: '截面类型' },
      { key: 'theta', label: '倾角 θ', unit: '°', digits: 1 },
      { key: 'd', label: '偏移 d', digits: 2 },
      { key: 'e', label: '离心率 e', digits: 4, stat: true },
      { key: 'spheres', label: '丹德林球数', digits: 0 },
    ],
    sample: (inst, p) => {
      const c = classifyConicSection(p.theta ?? 26, p.d ?? 0.55, 30);
      const dg = dandelinGeometry(p.theta ?? 26, p.d ?? 0.55);
      return { _kind: 'model', kind: c.kind, theta: p.theta, d: p.d, e: c.e, spheres: dg.uniq.length };
    },
    summary: (rows) => [
      ['已探究构型数', `${rows.length} 组`],
      ['最新类型与离心率', rows.length ? `${rows[rows.length - 1].kind} (e=${rows[rows.length - 1].e.toFixed(3)})` : '—'],
    ],
    errors: [
      '把平面倾角 θ 与圆锥半顶角 α 混淆：抛物线条件是截面平行于母线（θ = 90° − α），而非 θ = α。',
    ],
  },

  build(k) {
    const p = k.p;
    const XC = 0, CY = 2.45, ZC = -0.35;
    const hCone = 2.2, rCone = hCone * Math.tan(ALPHA);
    const rig = group(); rig.position.set(XC, CY, ZC); k.root.add(rig);

    const upCone = glass(new THREE.ConeGeometry(rCone, hCone, 42, 1, true).rotateX(Math.PI).translate(0, hCone / 2, 0), { color: 0xd9e8f5, opacity: 0.25 });
    const dnCone = glass(new THREE.ConeGeometry(rCone, hCone, 42, 1, true).translate(0, -hCone / 2, 0), { color: 0xd9e8f5, opacity: 0.22 });
    const axis = at(cyl(0.015, hCone * 2.1, C.ink, { seg: 8 }), 0, 0, 0);
    rig.add(upCone, dnCone, axis);

    // 斜截玻璃平面与直接把手
    const planeGrp = group();
    const planeMesh = glass(new THREE.BoxGeometry(3.4, 0.03, 3.4), { color: 0xf6dfc7, opacity: 0.36 });
    const rim = flat(new THREE.BoxGeometry(3.44, 0.035, 0.05), C.copper, { opacity: 0.8 }); rim.position.z = 1.7;
    const handle = solid(new THREE.SphereGeometry(0.16, 18, 12), C.copper, { kind: 'metal' });
    handle.position.set(1.55, 0.08, 0.5);
    planeGrp.add(planeMesh, rim, handle);
    rig.add(planeGrp);

    // 2 个预分配丹德林球 + 2 个焦点红点 + 交线线段
    const spheres = [0, 1].map(() => glass(new THREE.SphereGeometry(1, 28, 18), { color: 0xb4653a, opacity: 0.44 }));
    const foci = [0, 1].map(() => flat(new THREE.SphereGeometry(0.075, 14, 10), C.red));
    const curveMat = new THREE.LineBasicMaterial({ color: C.ink, linewidth: 2 });
    const curveGeo = new THREE.BufferGeometry();
    const curveLine = new THREE.LineSegments(curveGeo, curveMat);
    curveLine.layers.set(1); curveLine.frustumCulled = false;
    rig.add(...spheres, ...foci, curveLine);

    const lbl = at(note('', { size: 0.23, w: 3.4 }), 0, -2.15, 0.4);
    rig.add(lbl);

    const rebuildCurve = () => {
      const th = (p.theta ?? 26) * DEG, d = p.d ?? 0.55;
      const cl = classifyConicSection(p.theta ?? 26, d, 30);
      planeGrp.rotation.z = -th;
      planeGrp.position.set(d * Math.sin(th), d * Math.cos(th), 0);

      // 求解平面 x*sin(th)+y*cos(th)=d 与圆锥 x^2+z^2=(k*y)^2 的截面曲线点对
      const segs = [];
      const uMax = 1.65;
      let prevPos = null, prevNeg = null;
      const pushSeg = (a, b) => { if (a && b) segs.push(...a, ...b); };
      for (let i = 0; i <= 140; i++) {
        const u = -uMax + (2 * uMax * i) / 140; // 沿截平面斜向坐标系
        const x = d * Math.sin(th) + u * Math.cos(th);
        const y = d * Math.cos(th) - u * Math.sin(th);
        if (Math.abs(y) > hCone) { prevPos = prevNeg = null; continue; }
        const z2 = (Math.tan(ALPHA) * y) ** 2 - x * x;
        if (z2 >= 0) {
          const z = Math.sqrt(z2);
          const pt1 = [x, y, z], pt2 = [x, y, -z];
          pushSeg(prevPos, pt1); pushSeg(prevNeg, pt2);
          prevPos = pt1; prevNeg = pt2;
        } else {
          if (prevPos && prevNeg) pushSeg(prevPos, prevNeg);
          prevPos = prevNeg = null;
        }
      }
      curveGeo.setAttribute('position', new THREE.Float32BufferAttribute(segs.length ? segs : [0, 0, 0, 0, 0, 0], 3));

      const dg = dandelinGeometry(p.theta ?? 26, d);
      for (let i = 0; i < 2; i++) {
        const spObj = dg.uniq[i];
        const show = !!(p.showSpheres ?? true) && spObj && !cl.degenerate;
        spheres[i].visible = show; foci[i].visible = show;
        if (show) {
          spheres[i].position.set(0, spObj.ys, 0);
          spheres[i].scale.setScalar(spObj.R);
          foci[i].position.set(spObj.fx, spObj.fy, 0);
        }
      }
      lbl.set(`${cl.kind} · 离心率 e = ${cl.e.toFixed(3)}`);
    };

    let py0 = null, px0 = null, th0 = 0, d0 = 0;
    k.drag(handle, {
      start: (q) => { py0 = q.y; px0 = q.x; th0 = p.theta; d0 = p.d; },
      move: (q) => {
        if (py0 === null) return;
        k.set('theta', clamp(Math.round((th0 + (q.x - px0) * 26) * 2) / 2, 0, 82));
        k.set('d', clamp(Math.round((d0 + (q.y - py0) * 0.65) * 50) / 50, -1.1, 1.1));
        rebuildCurve(); k.dirty();
      },
      end: () => { py0 = null; },
    });

    rebuildCurve();
    return {
      press(id) {
        if (id === 'parabola' || id === 'presetP') { k.set('theta', 60); k.set('d', 0.6); }
        else if (id === 'hyperbola' || id === 'presetH') { k.set('theta', 75); k.set('d', 0.45); }
        else if (id === 'apex' || id === 'presetD') { k.set('d', 0.0); }
        rebuildCurve(); k.dirty();
      },
      change() { rebuildCurve(); k.dirty(); },
      update() {},
      margin() {
        const cl = classifyConicSection(p.theta ?? 26, p.d ?? 0.55, 30);
        return [`当前截交：${cl.kind}`, `θ = ${(p.theta ?? 26).toFixed(1)}°`, `d = ${(p.d ?? 0.55).toFixed(2)}`, `e = ${cl.e.toFixed(4)}`];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 截面坐标系 (u, v) 动态焦点距离验证台（拖动橙色动点 P）');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn" data-c="ellipse">椭圆 e<1</button>
      <button type="button" class="wb-btn" data-c="parabola">抛物线 e=1</button>
      <button type="button" class="wb-btn" data-c="hyperbola">双曲线 e>1</button>
      <button type="button" class="wb-btn" data-c="apex">过顶点退化 d=0</button>
      <button type="button" class="wb-btn primary" data-c="rec">记入实验册</button>`;
    sec1.append(bar);

    let pParamU = 0.35; // 沿交线参数定位 P
    let curvePts = [];
    const cv = wb.canvas(sec1, 520, 290, (x, W, H) => {
      const p = sp.params, th = (p.theta ?? 26) * DEG, d = p.d ?? 0.55;
      const cl = classifyConicSection(p.theta ?? 26, d, 30);
      const dg = dandelinGeometry(p.theta ?? 26, d);
      const cx = W / 2, cy = H / 2, sc = 78;
      const sx = (u) => cx + u * sc, sy = (z) => cy - z * sc;

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      x.strokeStyle = 'rgba(30,43,54,0.12)'; x.lineWidth = 1;
      x.beginPath(); x.moveTo(0, cy); x.lineTo(W, cy); x.moveTo(cx, 0); x.lineTo(cx, H); x.stroke();

      curvePts = [];
      for (let i = 0; i <= 180; i++) {
        const u = -3.0 + (6.0 * i) / 180;
        const X = d * Math.sin(th) + u * Math.cos(th), Y = d * Math.cos(th) - u * Math.sin(th);
        const z2 = (Math.tan(ALPHA) * Y) ** 2 - X * X;
        if (z2 >= 0) curvePts.push([u, Math.sqrt(z2), Y]);
      }

      // 画上下对称曲线分支
      x.strokeStyle = '#1e2b36'; x.lineWidth = 2.2;
      for (const sgn of [1, -1]) {
        x.beginPath();
        let started = false;
        for (let i = 0; i < curvePts.length; i++) {
          const [u, z] = curvePts[i];
          if (i > 0 && Math.abs(u - curvePts[i - 1][0]) > 0.12) started = false;
          if (!started) { x.moveTo(sx(u), sy(sgn * z)); started = true; }
          else x.lineTo(sx(u), sy(sgn * z));
        }
        x.stroke();
      }

      // 焦点的平面 u 坐标: F_x = u*cos(th) + d*sin(th) => uF = (fx - d*sin(th))/cos(th) 或通式 uF = fx*cos(th) - fy*sin(th)
      const fociU = dg.uniq.map((spO) => spO.fx * Math.cos(th) - spO.fy * Math.sin(th));
      fociU.forEach((uF, idx) => {
        x.fillStyle = '#a23a2c'; x.beginPath(); x.arc(sx(uF), cy, 5, 0, TAU); x.fill();
        x.font = '11px Georgia,serif'; x.fillText(`F${idx + 1}`, sx(uF) + 6, cy - 6);
      });

      // 选中曲线上的动点 P 验证几何不变量
      if (curvePts.length) {
        const idx = clamp(Math.round(pParamU * (curvePts.length - 1)), 0, curvePts.length - 1);
        const [pu, pz] = curvePts[idx];
        x.fillStyle = '#b4653a'; x.beginPath(); x.arc(sx(pu), sy(pz), 6, 0, TAU); x.fill();
        x.strokeStyle = '#1f4a3e'; x.setLineDash([4, 3]);
        fociU.forEach((uF) => {
          x.beginPath(); x.moveTo(sx(uF), cy); x.lineTo(sx(pu), sy(pz)); x.stroke();
        });
        x.setLineDash([]);
        x.fillStyle = '#1e2b36'; x.font = '12px "Noto Serif SC",serif';
        const d1 = fociU[0] !== undefined ? Math.hypot(pu - fociU[0], pz) : NaN;
        const d2 = fociU[1] !== undefined ? Math.hypot(pu - fociU[1], pz) : NaN;
        const invText = Number.isFinite(d2)
          ? (cl.e < 1 ? `PF₁+PF₂ = ${(d1 + d2).toFixed(4)}` : `|PF₁−PF₂| = ${Math.abs(d1 - d2).toFixed(4)}`)
          : Number.isFinite(d1) ? `PF₁ = ${d1.toFixed(4)} (抛物线焦点)` : '退化截交集';
        x.fillText(`${cl.kind} · e=${cl.e.toFixed(3)} · ${invText}`, 14, 22);
      }
    });

    const stats = document.createElement('div');
    stats.className = 'wb-metrics';
    sec1.append(stats);

    const refresh = () => {
      cv.redraw();
      const p = sp.params, cl = classifyConicSection(p.theta ?? 26, p.d ?? 0.55, 30);
      const dg = dandelinGeometry(p.theta ?? 26, p.d ?? 0.55);
      stats.innerHTML = `
        <div class="wb-m"><span>几何分类</span><b>${cl.kind}</b></div>
        <div class="wb-m"><span>离心率 e</span><b>${cl.e.toFixed(4)}</b></div>
        <div class="wb-m"><span>内切丹德林球</span><b>${cl.degenerate ? '0 (过顶点退化)' : dg.uniq.length + ' 球'}</b></div>`;
    };

    cv.cv.addEventListener('pointermove', (e) => {
      if (e.buttons === 0 && e.pointerType === 'mouse') return;
      const pt = cv.toLocal(e);
      pParamU = clamp(pt.x / 520, 0, 1);
      refresh();
    });
    cv.cv.addEventListener('pointerdown', (e) => {
      const pt = cv.toLocal(e);
      pParamU = clamp(pt.x / 520, 0, 1);
      refresh();
    });

    bar.addEventListener('click', (e) => {
      const c = e.target.closest('button')?.dataset.c;
      if (!c) return;
      if (c === 'ellipse') { wb.setParam('theta', 26); wb.setParam('d', 0.55); }
      else if (c === 'parabola') wb.press('parabola');
      else if (c === 'hyperbola') wb.press('hyperbola');
      else if (c === 'apex') wb.press('apex');
      else if (c === 'rec') wb.record(conicLocus.record.sample(sp.inst, sp.params));
      refresh();
    });

    refresh();
    return { update() { refresh(); } };
  },
};

// ================================================================
// 5. 从割线到切线：导数的双侧极限与不可导边界 (math-derivative, L3)
// ================================================================
const DERIV_FNS = [
  {
    name: 'y = x²/2',
    f: (x) => (x * x) / 2,
    leftD: (x) => x,
    rightD: (x) => x,
    isDiff: () => true,
  },
  {
    name: 'y = sin x',
    f: (x) => Math.sin(x),
    leftD: (x) => Math.cos(x),
    rightD: (x) => Math.cos(x),
    isDiff: () => true,
  },
  {
    name: 'y = x³/4 − x',
    f: (x) => (x * x * x) / 4 - x,
    leftD: (x) => 0.75 * x * x - 1,
    rightD: (x) => 0.75 * x * x - 1,
    isDiff: () => true,
  },
  {
    name: 'y = |x| (尖角)',
    f: (x) => Math.abs(x),
    leftD: (x) => (x <= 1e-6 ? -1 : 1),
    rightD: (x) => (x >= -1e-6 ? 1 : -1),
    isDiff: (x) => Math.abs(x) > 1e-6,
  },
  {
    name: 'y = x^(2/3) (尖点)',
    f: (x) => Math.cbrt(x * x),
    leftD: (x) => (Math.abs(x) < 1e-6 ? -Infinity : (2 / 3) * Math.cbrt(1 / x)),
    rightD: (x) => (Math.abs(x) < 1e-6 ? Infinity : (2 / 3) * Math.cbrt(1 / x)),
    isDiff: (x) => Math.abs(x) > 1e-6,
  },
];

export const deriv = {
  id: 'math-derivative',
  subject: 'math',
  title: '从割线到切线：导数的双侧极限与不可导边界',
  en: 'Secant to tangent, one-sided limits & corners',
  lede: [
    '割线 PQ 的斜率是平均变化率 Δy/Δx；当动点 Q 分别从右侧 (Δx → 0⁺) 与左侧 (Δx → 0⁻) 逼近切点 P 时，只有在左右极限相等且有限时，切线才唯一存在。',
    '切换到 y = |x|（尖角）或 y = x^(2/3)（尖点）并在 x₀ = 0 处推动 Δx 穿过 0：你会亲眼看到割线突然从斜率 −1 跳变到 +1（或爆至 ±∞），证明连续并不一定可导！',
  ],
  formula: "f′(x₀) = lim(Δx→0⁺) Δy/Δx = lim(Δx→0⁻) Δy/Δx",
  formulaNote: '可导充要条件：左右导数 f′₋(x₀) 与 f′₊(x₀) 存在且相等；如 |x| 在 x=0 处 −1 ≠ +1 故不可导',
  terms: [
    ['左/右导数', 'Δx → 0⁻ 时的差商极限为左导数 f′₋，Δx → 0⁺ 时的差商极限为右导数 f′₊'],
    ['尖角不可导 |x|', '在 x₀ = 0 处函数连续，但 f′₋(0) = −1 ≠ f′₊(0) = +1，左右切线形成折角'],
    ['尖点 x^(2/3)', '在 x₀ = 0 处左右差商趋于 −∞ 与 +∞，切线竖直且无有限导数'],
  ],
  predict: {
    q: '在 y = |x| 的顶点 x₀ = 0 处，让增量 Δx 从 −0.01 变成 +0.01，割线斜率 Δy/Δx 会如何变化？',
    options: [
      '平滑过渡并趋近于 0',
      '从 −1 突然跳变成 +1，左右极限不相等',
      '保持等于 +1 不变',
    ],
    answer: 1,
    why: '当 Δx < 0 时 [|0+Δx|−0]/Δx = −Δx/Δx = −1；当 Δx > 0 时为 +Δx/Δx = +1。左右极限不等，因此 y = |x| 在 x = 0 处连续但不可导。',
  },
  challenge: '切换至 y = |x| 并将 x₀ 置于 0，反向切换 Δx = ±0.2 观察左右切线分叉；随后在工作台查看 Δx → 0± 差商收敛表！',
  fig: '函数曲线、割线 PQ（橙）、切线或左右单侧切线（紫/红/蓝）',
  hint: '拖 x₀ 与支持正负双侧的 Δx；也可以直接在三维坐标板上拖拽 P 点与 Q 点。',
  teach: {
    where: '人教 A 版数学选择性必修第二册第五章 §5.1《导数的概念及其意义》',
    ask: [
      '列举一个“处处连续但存在不可导尖角”的函数，并说明为什么“可导必连续，连续未必可导”。',
      '在浮点计算中为什么 Δx 小于 10⁻⁸ 时数值差商反而会失真？',
    ],
    simplify: '三维面板当 |Δx| < 0.005 时做极限符号显示与防除零保护（实际采样间距底限 10⁻⁴），工作台显式列出多级步长收敛对比。',
    safety: '纯微积分极限概念可视化实验。',
  },
  controls: [
    { id: 'fn', type: 'choice', label: '', options: DERIV_FNS.map((item) => item.name), value: 0, wide: true },
    { id: 'x0', label: '切点 x₀', min: -1.8, max: 1.8, step: 0.05, value: 0.5 },
    { id: 'h', label: '增量 Δx', min: -1.5, max: 1.5, step: 0.01, value: 1.0 },
    { id: 'btnCorner', label: '不可导反例', type: 'button', text: '|x| 在 x₀=0' },
    { id: 'btnFlip', label: '双侧对比', type: 'button', text: '反向 ±Δx' },
  ],
  record: {
    note: '记下不同函数与左右侧 Δx 逼近时的差商 Δy/Δx、左导数 f′₋、右导数 f′₊ 及可导判定。',
    pending: '点击“反向 ±Δx”或在工作台点击“记入实验册”保存当前逼近记录。',
    columns: [
      { key: 'fnName', label: '函数' },
      { key: 'x0', label: 'x₀', digits: 2 },
      { key: 'dx', label: 'Δx', digits: 3 },
      { key: 'secant', label: '差商 Δy/Δx', digits: 4, stat: true },
      { key: 'leftD', label: 'f′₋(x₀)', digits: 3 },
      { key: 'rightD', label: 'f′₊(x₀)', digits: 3 },
      { key: 'diff', label: '可导性' },
    ],
    sample: (inst, p) => {
      const spec = DERIV_FNS[p.fn ?? 0];
      const x0 = p.x0 ?? 0.5;
      let h = p.h ?? 1.0;
      if (Math.abs(h) < 1e-4) h = h >= 0 ? 1e-4 : -1e-4;
      const ks = (spec.f(x0 + h) - spec.f(x0)) / h;
      const ld = spec.leftD(x0), rd = spec.rightD(x0);
      return {
        _kind: 'model',
        fnName: spec.name,
        x0,
        dx: h,
        secant: ks,
        leftD: Number.isFinite(ld) ? ld : (ld > 0 ? 999 : -999),
        rightD: Number.isFinite(rd) ? rd : (rd > 0 ? 999 : -999),
        diff: spec.isDiff(x0) ? '可导 (f′₋=f′₊)' : '不可导',
      };
    },
    summary: (rows) => [
      ['已采集逼近样本', `${rows.length} 组`],
      ['不可导尖点样本', `${rows.filter((r) => r.diff === '不可导').length} 组`],
    ],
    errors: [
      '只测右侧 Δx → 0⁺ 就下结论可导：在 x₀ = 0 对 |x| 只看右侧会误以为导数为 +1，必须同时验证 Δx → 0⁻。',
    ],
  },

  build(k) {
    const p = k.p;
    const Z = -1.25, XS = 1.38, YS = 1.18, Y0 = 2.5;
    const wx = (x) => x * XS, wy = (y) => Y0 + y * YS;

    k.root.add(
      at(clean(box(9.4, 5.9, 0.08)), 0, 0, Z - 0.2),
      wire([wx(-3.1), Y0, Z], [wx(3.1), Y0, Z]),
      wire([0, 0.4, Z], [0, 5.6, Z]),
      at(note('x', { size: 0.28, italic: true }), wx(3.05), Y0 - 0.3, Z),
      at(note('y', { size: 0.28, italic: true }), 0.28, 5.45, Z),
    );
    [-2, -1, 1, 2].forEach((n) => {
      k.root.add(
        wire([wx(n), Y0 - 0.07, Z], [wx(n), Y0 + 0.07, Z]),
        at(note(`${n}`, { size: 0.23 }), wx(n), Y0 - 0.28, Z),
      );
    });

    const curve = strip(180, { w: 0.072, color: C.ink });
    const sec = strip(2, { w: 0.06, color: C.flame });
    const tan = strip(2, { w: 0.052, color: C.violet });
    const tanL = strip(2, { w: 0.048, color: C.sky });
    const tanR = strip(2, { w: 0.048, color: C.rose });
    const legs = strip(3, { w: 0.032, color: C.copper });
    const P = flat(new THREE.SphereGeometry(0.13, 16, 12), C.violet);
    const Q = flat(new THREE.SphereGeometry(0.13, 16, 12), C.flame);
    const tP = note('P', { size: 0.3, italic: true });
    const tQ = note('Q', { size: 0.3, italic: true });
    const info = at(card('\n\n', { w: 4.35, size: 0.27, align: 'left' }), 2.35, 0, 2.75);
    k.root.add(curve, sec, tan, tanL, tanR, legs, P, Q, tP, tQ, info);

    const clipRay = (x, y, m, side = 0) => {
      if (!Number.isFinite(m)) {
        const yLo = side < 0 ? y - 1.4 : side > 0 ? y : y - 1.4;
        const yHi = side < 0 ? y : y + 1.4;
        return [[wx(x), wy(clamp(yLo, -1.65, 2.45)), Z + 0.02], [wx(x), wy(clamp(yHi, -1.65, 2.45)), Z + 0.02]];
      }
      const xBounds = side < 0 ? [-3.0, x] : side > 0 ? [x, 3.0] : [-3.0, 3.0];
      const pts = [];
      for (const xx of xBounds) {
        let yy = y + m * (xx - x), xe = xx;
        const lo = -1.65, hi = 2.45;
        if (Math.abs(m) > 1e-6) {
          if (yy > hi) { xe = x + (hi - y) / m; yy = hi; }
          else if (yy < lo) { xe = x + (lo - y) / m; yy = lo; }
        }
        pts.push([wx(xe), wy(yy), Z + 0.02]);
      }
      return pts;
    };

    let lastFn = -1, st = {};
    const sync = () => {
      const fnIdx = p.fn ?? 0;
      const spec = DERIV_FNS[fnIdx];
      if (fnIdx !== lastFn) {
        lastFn = fnIdx;
        curve.set(Array.from({ length: 180 }, (_, i) => {
          const xv = -2.6 + (5.2 * i) / 179;
          return [wx(xv), wy(clamp(spec.f(xv), -1.65, 2.45)), Z];
        }));
      }
      const x0 = p.x0 ?? 0.5;
      const hRaw = p.h ?? 1.0;
      const hEff = Math.abs(hRaw) < 1e-4 ? (hRaw >= 0 ? 1e-4 : -1e-4) : hRaw;
      const x1 = clamp(x0 + hEff, -2.6, 2.6);
      const dxUsed = x1 - x0;
      const y0 = spec.f(x0), y1 = spec.f(x1);
      const ks = Math.abs(dxUsed) >= 1e-5 ? (y1 - y0) / dxUsed : (hRaw >= 0 ? spec.rightD(x0) : spec.leftD(x0));
      const diff = spec.isDiff(x0);
      const ld = spec.leftD(x0), rd = spec.rightD(x0);

      P.position.set(wx(x0), wy(y0), Z + 0.03);
      Q.position.set(wx(x1), wy(y1), Z + 0.03);
      Q.visible = Math.abs(hRaw) >= 0.005;
      tP.position.set(wx(x0) - 0.28, wy(y0) + 0.28, Z + 0.03);
      tQ.visible = Q.visible;
      tQ.position.set(wx(x1) + 0.28, wy(y1) + 0.28, Z + 0.03);

      sec.visible = Q.visible && Number.isFinite(ks);
      if (sec.visible) sec.set(clipRay(x0, y0, ks, 0));

      tan.visible = diff;
      tanL.visible = tanR.visible = !diff;
      if (diff) {
        tan.set(clipRay(x0, y0, ld, 0));
      } else {
        tanL.set(clipRay(x0, y0, ld, -1));
        tanR.set(clipRay(x0, y0, rd, 1));
      }

      legs.visible = Q.visible;
      if (legs.visible) {
        legs.set([[wx(x0), wy(y0), Z + 0.01], [wx(x1), wy(y0), Z + 0.01], [wx(x1), wy(y1), Z + 0.01]]);
      }

      st = { x0, hRaw, ks, ld, rd, diff, y0, y1 };
      const ldTxt = Number.isFinite(ld) ? ld.toFixed(3) : (ld > 0 ? '+∞' : '−∞');
      const rdTxt = Number.isFinite(rd) ? rd.toFixed(3) : (rd > 0 ? '+∞' : '−∞');
      const secTxt = Q.visible ? ks.toFixed(3) : 'Δx → 0 极限状态';
      info.set(diff
        ? `割线斜率 Δy/Δx = ${secTxt}\n切线导数 f′(x₀) = ${ldTxt} (f′₋ = f′₊)\n相差 ${Q.visible ? Math.abs(ks - ld).toFixed(4) : '0.0000'}`
        : `⚠ x₀ = ${x0.toFixed(2)} 处不可导！\n左导数 f′₋ = ${ldTxt} ≠ 右导数 f′₊ = ${rdTxt}\n当前割线 (${hRaw >= 0 ? '0⁺' : '0⁻'} 侧) 斜率 = ${secTxt}`);
    };

    let dragP = null, dragQ = null;
    k.drag(P, {
      start: (q) => { dragP = { x: q.x, x0: p.x0 }; },
      move: (q) => { if (!dragP) return; k.set('x0', clamp(Math.round((dragP.x0 + (q.x - dragP.x) / XS) * 20) / 20, -1.8, 1.8)); sync(); k.dirty(); },
      end: () => { dragP = null; },
    });
    k.drag(Q, {
      start: (q) => { dragQ = { x: q.x, h: p.h }; },
      move: (q) => { if (!dragQ) return; k.set('h', clamp(Math.round((dragQ.h + (q.x - dragQ.x) / XS) * 100) / 100, -1.5, 1.5)); sync(); k.dirty(); },
      end: () => { dragQ = null; },
    });

    sync();
    return {
      press(id) {
        if (id === 'btnCorner') { k.set('fn', 3); k.set('x0', 0); k.set('h', 0.5); }
        else if (id === 'btnFlip') { k.set('h', -(p.h === 0 ? 0.5 : p.h)); }
        sync(); k.dirty();
      },
      change() { sync(); k.dirty(); },
      update() {},
      margin() {
        const s = st;
        const ldTxt = Number.isFinite(s.ld) ? s.ld.toFixed(3) : (s.ld > 0 ? '+∞' : '−∞');
        const rdTxt = Number.isFinite(s.rd) ? s.rd.toFixed(3) : (s.rd > 0 ? '+∞' : '−∞');
        return [
          `x₀ = ${(s.x0 ?? 0).toFixed(2)}, Δx = ${(s.hRaw ?? 0).toFixed(2)}`,
          `Δy/Δx = ${(s.ks ?? 0).toFixed(3)}`,
          `左导 f′₋ = ${ldTxt}`,
          `右导 f′₊ = ${rdTxt}`,
          s.diff ? '左右导数相等 → 可导' : '左右导数不等 → 不可导',
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 双侧差商极限收敛图：q(h) = [f(x₀+h) − f(x₀)] / h (h → 0±)');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn" data-act="abs0">|x| 尖角 x₀=0</button>
      <button type="button" class="wb-btn" data-act="cusp0">x^(2/3) 尖点 x₀=0</button>
      <button type="button" class="wb-btn" data-act="flip">反向 ±Δx</button>
      <button type="button" class="wb-btn primary" data-act="rec">记入实验册</button>`;
    sec1.append(bar);

    const cv = wb.canvas(sec1, 520, 235, (x, W, H) => {
      const p = sp.params;
      const spec = DERIV_FNS[p.fn ?? 0];
      const x0 = p.x0 ?? 0.5, hCur = p.h ?? 1.0;
      const pad = { l: 48, r: 18, t: 22, b: 28 };
      const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      const xMin = -1.5, xMax = 1.5;
      // 动态估算 y 范围
      const samples = [];
      for (let i = -30; i <= 30; i++) {
        if (i === 0) continue;
        const h = (i / 30) * 1.5;
        const q = (spec.f(x0 + h) - spec.f(x0)) / h;
        if (Number.isFinite(q)) samples.push(q);
      }
      const absM = Math.min(8, Math.max(2.2, ...samples.map((v) => Math.abs(v))));
      const yMin = -absM, yMax = absM;
      const sx = (v) => pad.l + ((v - xMin) / (xMax - xMin)) * pw;
      const sy = (v) => pad.t + ph - ((clamp(v, yMin, yMax) - yMin) / (yMax - yMin)) * ph;

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      x.strokeStyle = 'rgba(30,43,54,0.12)'; x.lineWidth = 1;
      x.beginPath(); x.moveTo(pad.l, sy(0)); x.lineTo(pad.l + pw, sy(0)); x.moveTo(sx(0), pad.t); x.lineTo(sx(0), pad.t + ph); x.stroke();

      // 左支 h < 0 与右支 h > 0 差商曲线
      for (const [lo, hi, col] of [[-1.5, -0.01, '#3a9cff'], [0.01, 1.5, '#ff5d8f']]) {
        x.strokeStyle = col; x.lineWidth = 2.2;
        x.beginPath();
        for (let i = 0; i <= 60; i++) {
          const h = lerp(lo, hi, i / 60);
          const q = (spec.f(x0 + h) - spec.f(x0)) / h;
          if (i === 0) x.moveTo(sx(h), sy(q)); else x.lineTo(sx(h), sy(q));
        }
        x.stroke();
      }

      // 空心极限圆圈于 h = 0 处
      const ld = spec.leftD(x0), rd = spec.rightD(x0);
      for (const [val, col] of [[ld, '#3a9cff'], [rd, '#ff5d8f']]) {
        if (Number.isFinite(val)) {
          x.fillStyle = '#fffdf7'; x.strokeStyle = col; x.lineWidth = 2;
          x.beginPath(); x.arc(sx(0), sy(val), 4.5, 0, TAU); x.fill(); x.stroke();
        }
      }
      if (Math.abs(hCur) >= 0.005) {
        const qCur = (spec.f(x0 + hCur) - spec.f(x0)) / hCur;
        x.fillStyle = '#1f4a3e';
        x.beginPath(); x.arc(sx(hCur), sy(qCur), 5.5, 0, TAU); x.fill();
      }
      x.fillStyle = '#1e2b36'; x.font = '11px Georgia,serif';
      x.fillText('h = −1.5', pad.l, H - 8);
      x.fillText('h = 0', sx(0) - 12, H - 8);
      x.fillText('h = +1.5', pad.l + pw - 42, H - 8);
      x.fillStyle = '#3a9cff'; x.fillText('— h → 0⁻ (左差商)', pad.l + 8, 14);
      x.fillStyle = '#ff5d8f'; x.fillText('— h → 0⁺ (右差商)', pad.l + 140, 14);
    });

    const sec2 = wb.section('2 · 双侧差商数值收敛表 (Δx → 0⁻ vs Δx → 0⁺)');
    const tblBox = document.createElement('div');
    sec2.append(tblBox);

    const refresh = () => {
      const p = sp.params;
      const spec = DERIV_FNS[p.fn ?? 0], x0 = p.x0 ?? 0.5;
      const steps = [1, 0.1, 0.01, 0.001, 0.0001];
      const rowsHtml = steps.map((h) => {
        const ql = (spec.f(x0 - h) - spec.f(x0)) / (-h);
        const qr = (spec.f(x0 + h) - spec.f(x0)) / h;
        return `<tr>
          <td>±${h}</td>
          <td>${ql.toFixed(6)}</td>
          <td>${qr.toFixed(6)}</td>
          <td>${Math.abs(qr - ql).toFixed(6)}</td>
        </tr>`;
      }).join('');
      const ld = spec.leftD(x0), rd = spec.rightD(x0);
      const diff = spec.isDiff(x0);
      tblBox.innerHTML = `
        <p class="wb-muted"><b>${spec.name}</b> 在 x₀ = ${x0.toFixed(2)} 处：左极限 f′₋ = ${Number.isFinite(ld) ? ld.toFixed(4) : (ld > 0 ? '+∞' : '−∞')}，右极限 f′₊ = ${Number.isFinite(rd) ? rd.toFixed(4) : (rd > 0 ? '+∞' : '−∞')} → <b>${diff ? '左右相等，可导 ✓' : '左右不相等或发散，不可导 ✗'}</b></p>
        <table style="width:100%;border-collapse:collapse;font-size:12.5px;text-align:right">
          <thead><tr style="border-bottom:1.5px solid #1e2b36"><th style="text-align:left;padding:4px">步长 |Δx|</th><th style="padding:4px;color:#3a9cff">左侧 Δx < 0</th><th style="padding:4px;color:#ff5d8f">右侧 Δx > 0</th><th style="padding:4px">左右差 |q₊−q₋|</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>`;
      cv.redraw();
    };

    bar.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (!act) return;
      if (act === 'abs0') { wb.setParam('fn', 3); wb.setParam('x0', 0); wb.setParam('h', 0.4); }
      else if (act === 'cusp0') { wb.setParam('fn', 4); wb.setParam('x0', 0); wb.setParam('h', 0.4); }
      else if (act === 'flip') wb.press('btnFlip');
      else if (act === 'rec') wb.record(deriv.record.sample(sp.inst, sp.params));
      refresh();
    });

    let lastK = '';
    refresh();
    return {
      update() {
        const p = sp.params;
        const kk = `${p.fn}|${p.x0}|${p.h}`;
        if (kk !== lastK) { lastK = kk; refresh(); }
      },
    };
  },
};

// ================================================================
// 6. 高尔顿板、二项分布与正态近似 (math-galton, L3)
// ================================================================
function binomPMF(n, k, p) {
  if (k < 0 || k > n) return 0;
  let coeff = 1;
  const kk = Math.min(k, n - k);
  for (let i = 1; i <= kk; i++) coeff = (coeff * (n - kk + i)) / i;
  return coeff * Math.pow(p, k) * Math.pow(1 - p, n - k);
}

function normalPDF(x, mu, sigma) {
  if (sigma <= 1e-9) return 0;
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(TAU));
}

export const galton = {
  id: 'math-galton',
  subject: 'math',
  title: '高尔顿板、二项分布与正态近似',
  en: 'Galton board, binomial & normal approximation',
  lede: [
    '小球从顶部落下，先后经过 N 层交错铁钉；每次碰撞以概率 p 向右、1 − p 向左偏转一格，最终落入底部 N + 1 个收集槽中。',
    '调节钉子层数 N（6–16 层）与右偏概率 p，当球数累积到数百上千颗时，槽内实测频率从随机抖动迅速收敛到理论二项分布 B(N, p) 与棣莫弗–拉普拉斯正态包络！',
  ],
  formula: 'P(X = k) = Cₙᵏ pᵏ (1 − p)ⁿ⁻ᵏ · N(np, np(1−p))',
  formulaNote: 'μ = np，σ² = np(1 − p)；当 np ≥ 5 且 n(1 − p) ≥ 5 时，正态密度曲线很好地包络离散二项分布',
  terms: [
    ['二项分布 B(N, p)', 'N 次独立伯努利碰撞中，恰好向右偏转 k 次的离散概率质量函数'],
    ['大数收敛', '单个小球路径不可预测，但大量独立样本的频率分布以 1/√M 速率稳定趋近理论分布'],
    ['棣莫弗–拉普拉斯定理', '当层数 N 充分大且 p 不过分极端时，二项分布渐近趋于均值 np、方差 np(1−p) 的正态分布'],
  ],
  predict: {
    q: '保持层数 N = 10、向右概率 p = 0.7，落球数足够多后，堆叠最高峰大约出现在第几个槽（k 从 0 到 10）？',
    options: [
      'k = 5（总是在正中间）',
      'k = 7（均值 μ = Np = 10 × 0.7 = 7 附近）',
      'k = 10（最右端）',
    ],
    answer: 1,
    why: '二项分布的期望为 μ = Np = 7，最大概率项在 ⌊(N+1)p⌋ = ⌊7.7⌋ = 7 处取得。p 偏离 0.5 时峰向概率大的一侧平移。',
  },
  challenge: '调至 N = 14、p = 0.65，投满至少 1000 个球；在工作台观察卡方 χ² 拟合度及正态包络线如何吻合偏态二项分布！',
  fig: 'N 层高尔顿钉板、连续落球柱状槽与理论二项/正态包络线',
  hint: '调层数 N 与概率 p，或按按钮一次批量投球；展开工作台查看精确二项 vs 实测频率 vs 正态包络与 χ² 检验。',
  teach: {
    where: '人教 A 版数学选择性必修第三册第七章 §7.4–7.5《二项分布与正态分布》',
    ask: [
      '为什么高尔顿板总能把独立的 0/1 选择合成近似钟形曲线？这与中心极限定理有何关联？',
      '当 N = 6, p = 0.15 时为什么正态曲线和柱状图在左端出现明显偏差？',
    ],
    simplify: '设每次碰撞独立、向右概率严格恒定为 p，忽略球间弹跳碰撞与空气阻力；可复现伪随机数驱动落球路径。',
    safety: '纯概率统计随机模拟实验。',
  },
  controls: [
    { id: 'n', label: '钉子层数 N', min: 6, max: 16, step: 1, value: 10, unit: '层' },
    { id: 'p', label: '向右概率 p', min: 0.15, max: 0.85, step: 0.05, value: 0.50 },
    { id: 'run', label: '连续落球', type: 'toggle', value: true },
    { id: 'add200', label: '批量投球', type: 'button', text: '+200 球' },
    { id: 'add1000', label: '大数试验', type: 'button', text: '+1000 球' },
    { id: 'clr', label: '重置', type: 'button', text: '清空' },
  ],
  record: {
    note: '记下每次试验的总球数、实测均值/标准差与理论二项分布值及 Pearson χ² 检验值。',
    pending: '投放至少 10 个球后再点记录（或点击工作台“记入实验册”）。',
    columns: [
      { key: 'n', label: 'N', digits: 0 },
      { key: 'p', label: 'p', digits: 2 },
      { key: 'total', label: '总球数', digits: 0 },
      { key: 'empMean', label: '实测均值', digits: 2 },
      { key: 'theoMean', label: '理论 np', digits: 2 },
      { key: 'chi2', label: 'χ² 拟合优度', digits: 2, stat: true },
    ],
    sample: (inst) => inst.takeSample?.(),
    summary: (rows) => [
      ['已记录试验批次', `${rows.length} 组`],
      ['最大单批样本量', rows.length ? `${Math.max(...rows.map((r) => r.total))} 球` : '—'],
    ],
    errors: [
      '样本量太小就判别分布：投 20 颗球时随机涨落很大，不能据此否认二项分布规律。',
    ],
  },

  build(k) {
    const p = k.p;
    const MAX_N = 16, MAX_BINS = MAX_N + 1, MAX_BALLS = 56;
    const Z = -1.3, BOARD_W = 7.4, TOP = 5.3, BOT = 2.0, BASE_Y = 0.14;
    k.root.add(at(clean(box(BOARD_W, 5.85, 0.1)), 0, 0, Z - 0.12));

    const pegs = dots((MAX_N * (MAX_N + 1)) / 2, 0.052, C.ink, { flat: true });
    const dividers = Array.from({ length: MAX_BINS + 1 }, () => wire([0, BASE_Y, Z], [0, BOT + 0.25, Z], 0.014));
    const bars = Array.from({ length: MAX_BINS }, () => flat(new THREE.BoxGeometry(1, 1, 0.06).translate(0, 0.5, 0), C.amber, { opacity: 0.85 }));
    const balls = dots(MAX_BALLS, 0.085, C.amber, { flat: true });
    const theoLine = strip(MAX_BINS, { w: 0.055, color: C.violet });
    const normLine = strip(64, { w: 0.042, color: C.copper });
    const info = at(card('\n\n', { w: 4.1, size: 0.27, align: 'left' }), 2.55, 0, 2.75);
    k.root.add(pegs, ...dividers, ...bars, balls, theoLine, normLine, info);

    const rand = rng(202611);
    const cnt = new Array(MAX_BINS).fill(0);
    const act = [];
    let acc = 0, lastKey = '';

    const layout = () => {
      const N = p.n ?? 10;
      const dx = Math.min(0.64, 6.2 / (N + 1));
      const dy = (TOP - (BOT + 0.45)) / N;
      let q = 0;
      for (let r = 0; r < N; r++) {
        for (let i = 0; i <= r; i++) {
          pegs.put(q++, (i - r / 2) * dx, TOP - r * dy, Z);
        }
      }
      while (q < (MAX_N * (MAX_N + 1)) / 2) pegs.put(q++, 0, -50, 0, 0.001);
      pegs.done();

      dividers.forEach((d, j) => {
        d.visible = j <= N + 1;
        if (d.visible) {
          const xPos = (j - (N + 1) / 2) * dx;
          d.span([xPos, BASE_Y, Z], [xPos, BOT + 0.2, Z]);
        }
      });
      bars.forEach((b, j) => {
        b.visible = j <= N && cnt[j] > 0;
        b.position.set((j - N / 2) * dx, BASE_Y, Z);
        b.scale.x = dx * 0.78;
      });
      return { N, dx, dy };
    };

    const rollPath = (N, prob) => {
      let j = 0;
      const path = [];
      for (let r = 0; r < N; r++) {
        j += rand() < prob ? 1 : 0;
        path.push(j);
      }
      return path;
    };

    const computeStats = () => {
      const N = p.n ?? 10, prob = p.p ?? 0.5;
      const counts = cnt.slice(0, N + 1);
      const tot = counts.reduce((a, b) => a + b, 0);
      const expected = counts.map((_, j) => binomPMF(N, j, prob) * Math.max(1, tot));
      let sum = 0, sumSq = 0;
      for (let j = 0; j <= N; j++) { sum += counts[j] * j; sumSq += counts[j] * j * j; }
      const empMean = tot ? sum / tot : NaN;
      const empSd = tot > 1 ? Math.sqrt(Math.max(0, (sumSq - tot * empMean * empMean) / (tot - 1))) : NaN;
      const theoMean = N * prob;
      const theoSd = Math.sqrt(N * prob * (1 - prob));
      const chi = tot > 0 ? chiSquare(counts, expected) : { chi2: 0, df: N };
      return { N, prob, counts, tot, expected, empMean, empSd, theoMean, theoSd, chi2: chi.chi2 };
    };

    const redrawScene = () => {
      const { N, dx, dy } = layout();
      const prob = p.p ?? 0.5;
      for (let i = 0; i < MAX_BALLS; i++) {
        const b = act[i];
        if (!b) { balls.put(i, 0, -50, 0, 0.001); continue; }
        const r = Math.min(N - 1, Math.floor(b.s));
        const f = b.s - r;
        const j0 = r === 0 ? 0 : b.path[r - 1], j1 = b.path[r];
        const x0 = (j0 - r / 2) * dx, x1 = (j1 - (r + 1) / 2) * dx;
        balls.put(i, lerp(x0, x1, f), TOP - r * dy + 0.1 - f * dy + Math.sin(f * Math.PI) * 0.1, Z + 0.08);
      }
      balls.done();

      const tot = cnt.slice(0, N + 1).reduce((a, b) => a + b, 0);
      const theoProbs = Array.from({ length: N + 1 }, (_, j) => binomPMF(N, j, prob));
      const mx = Math.max(10, ...cnt.slice(0, N + 1), Math.max(...theoProbs) * tot * 1.15);
      const barH = BOT - BASE_Y - 0.06;
      bars.forEach((b, j) => {
        b.visible = j <= N && cnt[j] > 0;
        if (b.visible) b.scale.y = Math.max(0.002, (cnt[j] / mx) * barH);
      });

      theoLine.visible = tot > 0;
      normLine.visible = tot > 0;
      if (tot > 0) {
        theoLine.set(theoProbs.map((pr, j) => [(j - N / 2) * dx, BASE_Y + (pr * tot / mx) * barH, Z + 0.05]));
        const mu = N * prob, sd = Math.sqrt(N * prob * (1 - prob));
        normLine.set(Array.from({ length: 64 }, (_, i) => {
          const kv = (i / 63) * N;
          const nv = normalPDF(kv, mu, sd) * tot;
          return [(kv - N / 2) * dx, BASE_Y + (nv / mx) * barH, Z + 0.06];
        }));
      }
      const st = computeStats();
      const peakK = Math.round(st.theoMean);
      info.set(`N = ${N} 层 · p = ${prob.toFixed(2)} · 已落 ${tot} 球\n理论峰值 k ≈ ${peakK} (${(binomPMF(N, peakK, prob) * 100).toFixed(1)}%)\n${tot ? `实测均值 ${st.empMean.toFixed(2)} vs 理论 np=${st.theoMean.toFixed(2)}` : '等待落球累积…'}`);
    };

    const resetBins = () => { cnt.fill(0); act.length = 0; };
    const dropBatch = (count) => {
      const N = p.n ?? 10, prob = p.p ?? 0.5;
      for (let i = 0; i < count; i++) cnt[rollPath(N, prob)[N - 1]]++;
    };

    lastKey = `${p.n}|${p.p}`;
    redrawScene();

    return {
      getStats: computeStats,
      dropBatch(count) { dropBatch(count); redrawScene(); },
      resetBins() { resetBins(); redrawScene(); },
      takeSample() {
        const st = computeStats();
        if (st.tot < 10) return null;
        return {
          _kind: 'simulated',
          n: st.N,
          p: st.prob,
          total: st.tot,
          empMean: st.empMean,
          theoMean: st.theoMean,
          chi2: st.chi2,
        };
      },
      press(id) {
        if (id === 'clr') resetBins();
        else if (id === 'add1000') dropBatch(1000);
        else dropBatch(200);
        redrawScene(); k.dirty();
      },
      change() {
        const kk = `${p.n}|${p.p}`;
        if (kk !== lastKey) { lastKey = kk; resetBins(); }
        redrawScene(); k.dirty();
      },
      update(dt) {
        const N = p.n ?? 10, prob = p.p ?? 0.5;
        if (p.run ?? true) {
          acc += dt * 8;
          while (acc >= 1 && act.length < MAX_BALLS) {
            acc -= 1;
            act.push({ s: 0, path: rollPath(N, prob) });
          }
          acc = Math.min(acc, 2);
        }
        for (let i = act.length - 1; i >= 0; i--) {
          act[i].s += dt * 5.2;
          if (act[i].s >= N) {
            cnt[act[i].path[N - 1]]++;
            act.splice(i, 1);
          }
        }
        redrawScene();
      },
      margin() {
        const st = computeStats();
        return [
          `N = ${st.N}, p = ${st.prob.toFixed(2)}`,
          `理论均值 np = ${st.theoMean.toFixed(2)}`,
          `理论 σ = ${st.theoSd.toFixed(2)}`,
          st.tot ? `实测均值 = ${st.empMean.toFixed(2)}` : '尚无落球',
          st.tot ? `实测 σ = ${(st.empSd || 0).toFixed(2)}` : '',
          st.tot ? `χ² = ${st.chi2.toFixed(2)}` : '',
        ].filter(Boolean);
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 精确二项分布 vs 实测频率 vs 棣莫弗–拉普拉斯正态包络');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn" data-act="b200">+200 球</button>
      <button type="button" class="wb-btn" data-act="b1000">+1000 球</button>
      <button type="button" class="wb-btn" data-act="clr">清空重测</button>
      <button type="button" class="wb-btn primary" data-act="rec">记入实验册</button>`;
    sec1.append(bar);

    const cv = wb.canvas(sec1, 520, 260, (x, W, H) => {
      const st = sp.inst?.getStats?.();
      if (!st) return;
      const { N, prob, counts, tot, theoMean, theoSd } = st;
      const pad = { l: 48, r: 16, t: 24, b: 32 };
      const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;

      const theoProbs = Array.from({ length: N + 1 }, (_, k) => binomPMF(N, k, prob));
      const empProbs = counts.map((c) => (tot > 0 ? c / tot : 0));
      const maxY = Math.max(0.15, ...theoProbs, ...empProbs) * 1.18;
      const sx = (k) => pad.l + ((k + 0.5) / (N + 1)) * pw;
      const sy = (v) => pad.t + ph - (v / maxY) * ph;
      const bw = Math.max(8, (pw / (N + 1)) * 0.72);

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      x.strokeStyle = 'rgba(30,43,54,0.12)'; x.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {
        const gy = pad.t + (ph * i) / 4;
        x.beginPath(); x.moveTo(pad.l, gy); x.lineTo(pad.l + pw, gy); x.stroke();
      }
      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();

      // 实测频率柱
      for (let k = 0; k <= N; k++) {
        const hBar = (empProbs[k] / maxY) * ph;
        x.fillStyle = 'rgba(255, 181, 46, 0.72)';
        x.strokeStyle = '#b4653a'; x.lineWidth = 1;
        x.fillRect(sx(k) - bw / 2, pad.t + ph - hBar, bw, hBar);
        if (tot > 0 && counts[k] > 0) x.strokeRect(sx(k) - bw / 2, pad.t + ph - hBar, bw, hBar);
      }

      // 精确二项分布折线与圆点
      x.strokeStyle = '#7a5cff'; x.lineWidth = 2.2;
      x.beginPath();
      theoProbs.forEach((pv, k) => (k === 0 ? x.moveTo(sx(k), sy(pv)) : x.lineTo(sx(k), sy(pv))));
      x.stroke();
      theoProbs.forEach((pv, k) => {
        x.fillStyle = '#7a5cff'; x.beginPath(); x.arc(sx(k), sy(pv), 3.6, 0, TAU); x.fill();
      });

      // 棣莫弗–拉普拉斯正态近似密度包络
      x.save(); x.strokeStyle = '#b4653a'; x.lineWidth = 2; x.setLineDash([6, 4]);
      x.beginPath();
      for (let i = 0; i <= 120; i++) {
        const kv = -0.5 + ((N + 1) * i) / 120;
        const yv = normalPDF(kv, theoMean, theoSd);
        if (i === 0) x.moveTo(sx(kv), sy(yv)); else x.lineTo(sx(kv), sy(yv));
      }
      x.stroke(); x.restore();

      x.fillStyle = '#1e2b36'; x.font = '11px Georgia,serif'; x.textAlign = 'center';
      for (let k = 0; k <= N; k += N > 12 ? 2 : 1) x.fillText(String(k), sx(k), H - 12);
      x.textAlign = 'right';
      x.fillText(`${(maxY * 100).toFixed(0)}%`, pad.l - 6, pad.t + 8);
      x.fillText('0%', pad.l - 6, pad.t + ph);
      x.textAlign = 'left';
      x.fillStyle = '#7a5cff'; x.fillText('● 精确二项分布 B(N,p)', pad.l + 8, 14);
      x.fillStyle = '#b4653a'; x.fillText('-- 正态包络 N(np, np(1−p))', pad.l + 150, 14);
      x.fillStyle = '#1f4a3e'; x.fillText(`实测样本 M=${tot}`, pad.l + 340, 14);
    });

    const stats = document.createElement('div');
    stats.className = 'wb-metrics';
    sec1.append(stats);

    const sec2 = wb.section('2 · 逐槽二项概率 C(N,k)pᵏ(1−p)ⁿ⁻ᵏ 与正态近似对照');
    const tblBox = document.createElement('div');
    sec2.append(tblBox);

    const refresh = () => {
      const st = sp.inst?.getStats?.();
      if (!st) return;
      cv.redraw();
      const npGood = st.N * st.prob >= 5 && st.N * (1 - st.prob) >= 5;
      stats.innerHTML = `
        <div class="wb-m"><span>总样本量 M</span><b>${st.tot} 球</b></div>
        <div class="wb-m"><span>均值 (实测 vs np)</span><b>${st.tot ? st.empMean.toFixed(3) : '—'} vs ${st.theoMean.toFixed(2)}</b></div>
        <div class="wb-m"><span>标准差 (实测 vs σ)</span><b>${st.tot ? (st.empSd || 0).toFixed(3) : '—'} vs ${st.theoSd.toFixed(3)}</b></div>
        <div class="wb-m"><span>正态近似条件 & χ²</span><b>${npGood ? 'np,nq≥5 良好' : '⚠ 偏极端近似有偏'} · χ²=${st.chi2.toFixed(2)}</b></div>`;

      const rows = st.counts.map((c, k) => {
        const bp = binomPMF(st.N, k, st.prob);
        const ep = st.tot ? c / st.tot : 0;
        const np = normalPDF(k, st.theoMean, st.theoSd);
        return `<tr>
          <td>${k}</td>
          <td>${c}</td>
          <td>${(ep * 100).toFixed(2)}%</td>
          <td>${(bp * 100).toFixed(2)}%</td>
          <td>${(np * 100).toFixed(2)}%</td>
        </tr>`;
      }).join('');
      tblBox.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px;text-align:right">
        <thead><tr style="border-bottom:1.5px solid #1e2b36"><th style="padding:3px">槽 k</th><th style="padding:3px">落球数</th><th style="padding:3px">实测频率</th><th style="padding:3px;color:#7a5cff">精确二项</th><th style="padding:3px;color:#b4653a">正态密度</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    };

    bar.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (!act) return;
      if (act === 'b200') sp.inst?.dropBatch?.(200);
      else if (act === 'b1000') sp.inst?.dropBatch?.(1000);
      else if (act === 'clr') sp.inst?.resetBins?.();
      else if (act === 'rec') {
        const row = galton.record.sample(sp.inst, sp.params);
        if (row) wb.record(row);
      }
      refresh();
    });

    let lastSnap = '';
    refresh();
    return {
      update() {
        const st = sp.inst?.getStats?.();
        if (!st) return;
        const snap = `${st.N}|${st.prob}|${st.tot}`;
        if (snap !== lastSnap) { lastSnap = snap; refresh(); }
      },
    };
  },
};

export default [func, sine, cube, conicLocus, deriv, galton];
