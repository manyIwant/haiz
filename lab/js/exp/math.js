// 数学
import { C, TAU, clamp, lerp, clean, group, at, rot, box, cyl, ball, rod, wire, strip, dash, glow, note, card, dots, flat, glass, THREE } from '../ink.js';

const piFmt = (v) => `${(v / Math.PI).toFixed(2)}π`;

// ---------------------------------------------------------------- 单位圆与正弦曲线
const sine = {
  id: 'math-sine', subject: 'math', title: '从圆周运动到正弦曲线', en: 'From circle to sine wave',
  lede: ['一个点在圆上匀速转动，把它的高度随时间记录下来，画出的就是正弦曲线。', '圆的半径决定曲线的高矮，转得多快决定曲线的疏密，从哪里出发决定曲线的左右位置。A、ω、φ 三个数，各管一件事。'],
  formula: 'y = A sin(ωx + φ)', formulaNote: '振幅 A，周期 T = 2π / ω，初相 φ',
  terms: [['振幅 A', '曲线偏离平衡位置的最大距离。'], ['周期 T', '函数值重复一次所需的 x 的增量。'], ['初相 φ', 'x = 0 时的相位，决定曲线的左右平移。']],
  predict: { q: '把 ω 变成原来的 2 倍，曲线的周期会怎样？', options: ['变成原来的 2 倍', '变成原来的一半', '不变，只是变高了'], answer: 1, why: 'T = 2π/ω。ω 越大，点转得越快，转完一圈需要的 x 越少，图象在横向上被压缩为原来的一半。' },
  challenge: '只调 φ，让曲线变成 y = cos x 的样子。φ 应该是多少？',
  fig: '旋转的半径（左）与它“展开”成的函数图象（右）', hint: '分别拖 A、ω、φ，一次只动一个。',
  teach: {
    where: '人教 A 版数学 必修第一册 · 三角函数：函数 y = A sin(ωx + φ)。',
    ask: ['由 y = sin x 得到 y = sin(2x + π/3)，先平移后伸缩和先伸缩后平移，平移的量一样吗？', '灰色曲线是 y = sin x，它和彩色曲线的交点有什么含义？'],
    simplify: '图象只画出 x ∈ [0, 2.6π] 的一段；圆上动点的角度等于当前的相位 ωx + φ。',
  },
  controls: [
    { id: 'A', label: '振幅 A', min: 0.5, max: 1.5, step: 0.1, value: 1 },
    { id: 'w', label: '角速度 ω', min: 0.5, max: 3, step: 0.1, value: 1 },
    { id: 'f', label: '初相 φ', min: -3.14, max: 3.14, step: 0.01, value: 0, fmt: piFmt },
  ],
  build(k) {
    const p = k.p, Z = -1.2, YC = 2.9, CX = -3.2, U = 1.15, X0 = -1.3, XS = 0.66, XMAX = 2.6 * Math.PI;
    k.root.add(at(clean(box(9.4, 5.9, 0.08)), 0, 0, Z - 0.2));
    k.root.add(wire([X0, YC, Z], [X0 + XMAX * XS + 0.3, YC, Z]), wire([X0, YC - 2.1, Z], [X0, YC + 2.1, Z]), wire([CX - 1.9, YC, Z], [CX + 1.9, YC, Z], 0.014), wire([CX, YC - 1.9, Z], [CX, YC + 1.9, Z], 0.014));
    [1, 2].forEach((n) => k.root.add(at(note(`${n}π`, { size: 0.26 }), X0 + n * Math.PI * XS, YC - 0.3, Z + 0.02), wire([X0 + n * Math.PI * XS, YC - 0.08, Z], [X0 + n * Math.PI * XS, YC + 0.08, Z])));
    const circ = strip(65, { w: 0.045, color: C.ink }), ref = strip(120, { w: 0.035, color: '#b9b4a6' }), wave = strip(160, { w: 0.075, color: C.flame });
    const rad = rod([CX, YC, Z], [CX + 1, YC, Z], 0.03, C.flame), P = flat(new THREE.SphereGeometry(0.13, 16, 12), C.flame), Q = flat(new THREE.SphereGeometry(0.13, 16, 12), C.flame);
    const link = strip(2, { w: 0.03, color: C.copper, opacity: 0.7 }), drop = strip(2, { w: 0.03, color: C.copper, opacity: 0.7 });
    const info = at(card('\n', { w: 3.8, size: 0.31, align: 'left' }), 2.5, 0, 2.6);
    k.root.add(circ, ref, wave, rad, P, Q, link, drop, info);
    ref.set(Array.from({ length: 120 }, (_, i) => { const x = (i / 119) * XMAX; return [X0 + x * XS, YC + Math.sin(x) * U, Z]; }));
    let x = 0;
    return {
      update(dt) {
        x = (x + dt * 1.4) % XMAX;
        const r = p.A * U, ph = p.w * x + p.f;
        circ.set(Array.from({ length: 65 }, (_, i) => [CX + Math.cos((i / 64) * TAU) * r, YC + Math.sin((i / 64) * TAU) * r, Z]));
        wave.set(Array.from({ length: 160 }, (_, i) => { const xx = (i / 159) * XMAX; return [X0 + xx * XS, YC + p.A * Math.sin(p.w * xx + p.f) * U, Z]; }));
        const px = CX + Math.cos(ph) * r, py = YC + Math.sin(ph) * r, qx = X0 + x * XS;
        rad.span([CX, YC, Z], [px, py, Z]); P.position.set(px, py, Z); Q.position.set(qx, py, Z);
        link.set([[px, py, Z], [qx, py, Z]]); drop.set([[qx, YC, Z], [qx, py, Z]]);
        info.set(`周期 T = 2π/ω = ${piFmt(TAU / p.w)}\n值域 [−${p.A.toFixed(1)}, ${p.A.toFixed(1)}]`);
      },
      margin() {
        const sh = -p.f / p.w;
        return [`A = ${p.A.toFixed(1)}`, `ω = ${p.w.toFixed(1)}`, `φ = ${piFmt(p.f)}`, `T = ${(TAU / p.w).toFixed(2)}`, `频率 f = ${(p.w / TAU).toFixed(2)}`, Math.abs(sh) < 0.005 ? '没有左右平移' : `相当于向${sh < 0 ? '左' : '右'}平移 ${Math.abs(sh).toFixed(2)}`];
      },
    };
  },
};

// ---------------------------------------------------------------- 圆锥曲线
const conic = {
  id: 'math-conic', subject: 'math', title: '圆锥曲线', en: 'Conic sections',
  lede: ['两个顶点相对的圆锥，用一个平面去切。平切得到圆，斜一点是椭圆，斜到和母线平行时是抛物线，再陡就同时切到上下两个圆锥，得到双曲线。', '两千多年前的希腊人就是这样认识它们的，所以叫“圆锥曲线”。'],
  formula: 'e = sin θ / cos α', formulaNote: '离心率由截面的倾角 θ 和圆锥的半顶角 α 决定（这里 α = 30°）',
  terms: [['离心率 e', '衡量曲线“扁”或“张开”的程度。'], ['母线', '圆锥侧面上过顶点的直线。'], ['e 的分界', '0 圆；0～1 椭圆；1 抛物线；大于 1 双曲线。']],
  predict: { q: '截面正好与圆锥的一条母线平行时，切口是什么曲线？', options: ['椭圆', '抛物线', '双曲线'], answer: 1, why: '与母线平行时，平面只和一个圆锥相交，但在那条母线的方向上永远“追不上”圆锥面，切口不闭合，这就是抛物线，离心率恰好等于 1。' },
  challenge: '保持倾角 70°，把截面移到正好过顶点。切口变成了什么？',
  fig: '对顶圆锥与可以倾斜、平移的截面', hint: '拖倾角；到 60° 附近慢一点。',
  teach: {
    where: '人教 A 版数学 选择性必修第一册 · 圆锥曲线的方程（章引言与阅读材料：为什么叫圆锥曲线）。',
    ask: ['椭圆的离心率越接近 1，形状怎样变化？越接近 0 呢？', '截面过顶点时得到的“退化”情形有哪几种？'],
    simplify: '圆锥半顶角固定为 30°，只画出有限高度内的一段，所以抛物线、双曲线在圆锥边缘被截断。',
  },
  controls: [
    { id: 'th', label: '倾角 θ', min: 0, max: 90, step: 1, value: 35, unit: '°' },
    { id: 'd', label: '截面位置', min: -2, max: 2, step: 0.1, value: 1.2 },
    { id: 'p0', type: 'button', label: '圆' }, { id: 'p1', type: 'button', label: '椭圆' }, { id: 'p2', type: 'button', label: '抛物线' }, { id: 'p3', type: 'button', label: '双曲线' },
  ],
  build(k) {
    const p = k.p, X = -1.6, Z = -0.9, Y0 = 3.0, HH = 2.6, AL = Math.PI / 6, TA = Math.tan(AL);
    const cg = new THREE.ConeGeometry(HH * TA, HH, 56, 1, true).translate(0, -HH / 2, 0);
    const cones = at(group(glass(cg), rot(glass(cg.clone()), Math.PI, 0, 0)), X, Y0, Z);
    const plane = flat(new THREE.PlaneGeometry(5.4, 4.2).rotateX(-Math.PI / 2), C.sky, { opacity: 0.22 });
    const curves = Array.from({ length: 4 }, () => strip(140, { w: 0.09, color: C.flame }));
    const holder = at(group(plane, ...curves), X, Y0, Z);
    const info = at(card('\n', { w: 3.6, size: 0.33, align: 'left' }), 2.6, 0, 2.5);
    const big = at(note('椭圆', { size: 0.7, bold: true, w: 3.6 }), 2.6, 3.2, -2.4);
    k.root.add(cones, holder, info, big, at(cyl(1.0, 0.1), X, 0.3, Z));
    const st = {}; let last = '';
    return {
      press(id) { k.set('th', [0, 35, 60, 80][+id[1]]); if (Math.abs(p.d) < 0.3) k.set('d', 1.2); },
      update() {
        const key = `${p.th}|${p.d}`; if (key === last) return; last = key;
        const th = p.th * Math.PI / 180, c = Math.cos(th), s = Math.sin(th), d = p.d;
        plane.rotation.z = th; plane.position.set(0, d, 0);
        const rad = (a) => TA * TA * (d + a * s) ** 2 - a * a * c * c, inH = (a) => Math.abs(d + a * s) <= HH;
        const runs = []; let cur = null; const NS = 600;
        for (let i = 0; i <= NS; i++) {
          const a = -5 + (10 * i) / NS, ok = rad(a) >= 0 && inH(a);
          if (ok) { if (!cur) cur = { a: [], sv: i > 0 && inH(a - 10 / NS) }; cur.a.push(a); } else if (cur) { cur.ev = inH(a); runs.push(cur); cur = null; }
        }
        if (cur) { cur.ev = false; runs.push(cur); }
        const out = [];
        runs.forEach((r) => {
          const P = r.a.map((a) => [a * c, d + a * s, Math.sqrt(Math.max(0, rad(a)))]), M = P.map((q) => [q[0], q[1], -q[2]]).reverse();
          if (r.ev && r.sv) out.push([...P, ...M, P[0]]); else if (r.ev) out.push([...P, ...M]); else if (r.sv) out.push([...M, ...P]); else out.push(P, M);
        });
        curves.forEach((cv, i) => { cv.visible = !!out[i] && out[i].length > 1; if (cv.visible) { cv.nrm.set(-s, c, 0); const q = out[i], stp = Math.max(1, Math.ceil(q.length / 139)); cv.set(q.filter((_, j) => j % stp === 0 || j === q.length - 1)); } });
        const e = s / Math.cos(AL), deg = Math.abs(d) < 0.05;
        const name = deg ? (e < 0.999 ? '一个点' : Math.abs(e - 1) < 0.02 ? '一条直线' : '两条相交直线') : p.th === 0 ? '圆' : Math.abs(e - 1) < 0.012 ? '抛物线' : e < 1 ? '椭圆' : '双曲线';
        Object.assign(st, { e, name });
        big.set(name); info.set(`截线：${name}\n离心率 e = ${e.toFixed(2)}`);
      },
      margin: () => [`θ = ${p.th}°，α = 30°`, 'e = sinθ / cosα', ` = ${(st.e || 0).toFixed(3)}`, 'θ = 0°　　圆', 'θ < 60°　 椭圆', 'θ = 60°　 抛物线', 'θ > 60°　 双曲线'],
    };
  },
};

// ---------------------------------------------------------------- 高尔顿板
const galton = {
  id: 'math-galton', subject: 'math', title: '高尔顿板与二项分布', en: 'The Galton board',
  lede: ['小球从顶上落下，每碰到一颗钉子，就随机向左或向右偏一格。碰 8 次钉子后，落进底下 9 个槽中的一个。', '单个小球去哪儿没人说得准，可是球一多，堆出来的形状几乎每次都一样：中间高，两边低。'],
  formula: 'P(X = k) = Cₙᵏ pᵏ (1 − p)ⁿ⁻ᵏ', formulaNote: 'n 次独立重复试验中，“向右”恰好发生 k 次的概率',
  terms: [['二项分布', 'n 次独立重复试验中成功次数的分布。'], ['均值 np', '成功次数的平均水平。'], ['频率与概率', '试验次数越多，频率越稳定于概率。']],
  predict: { q: '向左向右机会均等时，小球最可能落进哪个槽？', options: ['最左或最右的槽', '正中间的槽', '每个槽机会一样'], answer: 1, why: '到达中间槽需要“4 次向左、4 次向右”，这样的路线有 C(8,4) = 70 条；到达最边上的槽只有 1 条路线。路线越多，概率越大。' },
  challenge: '把 p 调到 0.7，球堆的峰移到了第几个槽？和 np 对一对。',
  fig: '钉板、落球与槽内计数（紫线为理论值）', hint: '让球一直落，再改一改 p。',
  teach: {
    where: '人教 A 版数学 选择性必修第三册 · 随机变量及其分布：二项分布与超几何分布、正态分布（高尔顿板）。',
    ask: ['只投 20 个球，形状和理论曲线差得远吗？投到 1000 个呢？', '钉子排数越来越多时，球堆的轮廓趋近于哪种曲线？'],
    simplify: '每次碰撞独立、向右概率恒为 p；小球之间互不影响。动画中小球的跳跃轨迹只是示意。',
  },
  controls: [
    { id: 'p', label: '向右的概率 p', min: 0.3, max: 0.7, step: 0.05, value: 0.5 },
    { id: 'run', type: 'toggle', label: '连续投放', value: true },
    { id: 'add', type: 'button', label: '一次放 200 个' }, { id: 'clr', type: 'button', label: '清空' },
  ],
  build(k) {
    const p = k.p, Z = -1.3, N = 8, DX = 0.66, DY = 0.36, TOP = 5.3, BIN = 2.05;
    k.root.add(at(clean(box(6.6, 5.8, 0.1)), 0, 0, Z - 0.12));
    const pegs = dots(N * (N + 1) / 2, 0.065, C.ink, { flat: true }); let q = 0;
    for (let r = 0; r < N; r++) for (let i = 0; i <= r; i++) pegs.put(q++, (i - r / 2) * DX, TOP - r * DY, Z);
    pegs.done();
    for (let j = 0; j <= N + 1; j++) k.root.add(wire([(j - (N + 1) / 2) * DX, 0.12, Z], [(j - (N + 1) / 2) * DX, BIN + 0.25, Z], 0.016));
    const bars = Array.from({ length: N + 1 }, (_, j) => at(flat(new THREE.BoxGeometry(DX * 0.82, 1, 0.06).translate(0, 0.5, 0), C.amber, { opacity: 0.85 }), (j - N / 2) * DX, 0.12, Z));
    const balls = dots(48, 0.1, C.amber, { flat: true });
    const theo = strip(N + 1, { w: 0.06, color: C.violet });
    const info = at(card('\n', { w: 3.6, size: 0.31, align: 'left' }), 2.6, 0, 2.7);
    k.root.add(pegs, ...bars, balls, theo, info);
    const cnt = new Array(N + 1).fill(0), act = []; let acc = 0;
    const C8 = [1, 8, 28, 56, 70, 56, 28, 8, 1], pr = (j) => C8[j] * Math.pow(p.p, j) * Math.pow(1 - p.p, N - j);
    const roll = () => { let j = 0; const path = []; for (let r = 0; r < N; r++) { const g = Math.random() < p.p ? 1 : 0; j += g; path.push(j); } return path; };
    return {
      press(id) { if (id === 'clr') { cnt.fill(0); act.length = 0; } else for (let i = 0; i < 200; i++) cnt[roll()[N - 1]]++; },
      change() { cnt.fill(0); act.length = 0; },
      update(dt) {
        if (p.run) { acc += dt * 7; while (acc > 1 && act.length < 48) { acc -= 1; act.push({ s: 0, path: roll() }); } acc = Math.min(acc, 2); }
        for (let i = act.length - 1; i >= 0; i--) { act[i].s += dt * 5; if (act[i].s >= N) { cnt[act[i].path[N - 1]]++; act.splice(i, 1); } }
        for (let i = 0; i < 48; i++) {
          const b = act[i]; if (!b) { balls.put(i, 0, -50, 0, 0.001); continue; }
          const r = Math.floor(b.s), f = b.s - r, j0 = r === 0 ? 0 : b.path[r - 1], j1 = b.path[r];
          const x0 = (j0 - r / 2) * DX, x1 = (j1 - (r + 1) / 2) * DX;
          balls.put(i, lerp(x0, x1, f), TOP - r * DY + 0.12 - f * DY + Math.sin(f * Math.PI) * 0.12, Z + 0.08);
        }
        balls.done();
        const tot = cnt.reduce((a, b) => a + b, 0), mx = Math.max(10, ...cnt, tot * 0.3);
        bars.forEach((b, j) => { b.scale.y = Math.max(0.001, (cnt[j] / mx) * BIN); b.visible = cnt[j] > 0; });
        theo.set(Array.from({ length: N + 1 }, (_, j) => [(j - N / 2) * DX, 0.12 + (pr(j) * Math.max(tot, 1) / mx) * BIN, Z + 0.05])); theo.visible = tot > 0;
        info.set(`已落下 ${tot} 个\n中间槽 ${tot ? ((cnt[4] / tot) * 100).toFixed(1) : '—'}%（理论 ${(pr(4) * 100).toFixed(1)}%）`);
        this.tot = tot;
      },
      margin() {
        const mean = N * p.p, tot = this.tot || 0, m = tot ? cnt.reduce((a, c, j) => a + c * j, 0) / tot : 0;
        return [`n = 8，p = ${p.p.toFixed(2)}`, `均值 np = ${mean.toFixed(1)}`, `方差 np(1−p) = ${(mean * (1 - p.p)).toFixed(2)}`, tot ? `实测平均 ${m.toFixed(2)}` : '还没有球', 'P(X=4) = C(8,4)p⁴(1−p)⁴', ` = ${(pr(4) * 100).toFixed(1)}%`];
      },
    };
  },
};

// ---------------------------------------------------------------- 导数
const FN = [
  ['y = x²/2', (x) => x * x / 2, (x) => x],
  ['y = sin x', Math.sin, Math.cos],
  ['y = x³/4 − x', (x) => x ** 3 / 4 - x, (x) => 0.75 * x * x - 1],
];
const deriv = {
  id: 'math-derivative', subject: 'math', title: '从割线到切线：导数', en: 'From secant to tangent',
  lede: ['在曲线上取两个点 P 和 Q，连成一条割线，它的斜率是这一段的平均变化率。', '让 Q 沿着曲线一点点靠近 P。割线不断转动，最后稳稳地停在一个位置上：那就是切线，它的斜率就是函数在这一点的导数。'],
  formula: "f′(x₀) = lim [f(x₀+h) − f(x₀)] / h", formulaNote: 'h 趋于 0 时，平均变化率的极限就是瞬时变化率',
  terms: [['割线', '过曲线上两点的直线。'], ['平均变化率', 'Δy / Δx，割线的斜率。'], ['导数', '瞬时变化率，切线的斜率。']],
  predict: { q: '让 h 越来越小，割线的斜率会怎样？', options: ['越来越接近切线的斜率', '变成 0', '变得无穷大'], answer: 0, why: 'Δy 和 Δx 都在趋于 0，但它们的比值并不趋于 0，而是趋近一个确定的数。这个极限值就是导数，也就是切线的斜率。' },
  challenge: '在 y = sin x 上找一点，让切线正好水平。它的导数是多少？',
  fig: '函数图象、割线 PQ（橙）与切线（紫）', hint: '把 h 慢慢拖向 0，盯住两条线。',
  teach: {
    where: '人教 A 版数学 选择性必修第二册 · 一元函数的导数及其应用：导数的概念及其意义。',
    ask: ['h 取负值（Q 在 P 左边）时，割线斜率趋近的值一样吗？', '对 y = x²/2，割线斜率恰好等于 x₀ + h/2，据此说明导数为什么是 x₀。'],
    simplify: 'h 的最小值取 0.01，割线斜率由函数值直接相减得到；坐标轴两个方向的单位长度不同，线的“视觉斜率”与数值不成 1 : 1。',
  },
  controls: [
    { id: 'x0', label: 'P 的横坐标 x₀', min: -1.5, max: 1.5, step: 0.05, value: 0.5 },
    { id: 'h', label: 'h', min: 0.01, max: 1.5, step: 0.01, value: 1.2 },
    { id: 'fn', type: 'choice', label: '', options: FN.map((f) => f[0]), value: 0, wide: true },
  ],
  build(k) {
    const p = k.p, Z = -1.2, XS = 1.45, YS = 1.25, Y0 = 2.5, wx = (x) => x * XS, wy = (y) => Y0 + y * YS;
    k.root.add(at(clean(box(9.4, 5.9, 0.08)), 0, 0, Z - 0.2), wire([wx(-3.1), Y0, Z], [wx(3.1), Y0, Z]), wire([0, 0.4, Z], [0, 5.6, Z]), at(note('x', { size: 0.3, italic: true }), wx(3.1), Y0 - 0.3, Z), at(note('y', { size: 0.3, italic: true }), 0.3, 5.5, Z));
    [-2, -1, 1, 2].forEach((n) => k.root.add(wire([wx(n), Y0 - 0.07, Z], [wx(n), Y0 + 0.07, Z]), at(note(`${n}`, { size: 0.24 }), wx(n), Y0 - 0.3, Z)));
    const curve = strip(140, { w: 0.07, color: C.ink }), sec = strip(2, { w: 0.06, color: C.flame }), tan = strip(2, { w: 0.05, color: C.violet });
    const legs = strip(3, { w: 0.035, color: C.copper });
    const P = flat(new THREE.SphereGeometry(0.13, 16, 12), C.violet), Q = flat(new THREE.SphereGeometry(0.13, 16, 12), C.flame);
    const tP = note('P', { size: 0.32, italic: true }), tQ = note('Q', { size: 0.32, italic: true });
    const info = at(card('\n', { w: 4.0, size: 0.31, align: 'left' }), 2.4, 0, 2.7);
    k.root.add(curve, sec, tan, legs, P, Q, tP, tQ, info);
    const clipLine = (x, y, m) => { const pts = []; for (const xx of [-3.1, 3.1]) { let yy = y + m * (xx - x), xe = xx; const lo = -1.68, hi = 2.48; if (yy > hi) { xe = x + (hi - y) / m; yy = hi; } else if (yy < lo) { xe = x + (lo - y) / m; yy = lo; } pts.push([wx(xe), wy(yy), Z + 0.02]); } return pts; };
    const st = {}; let lastFn = -1;
    return {
      update() {
        const [, f, df] = FN[p.fn];
        if (p.fn !== lastFn) { lastFn = p.fn; curve.set(Array.from({ length: 140 }, (_, i) => { const x = -2.6 + (5.2 * i) / 139; return [wx(x), wy(clamp(f(x), -1.7, 2.5)), Z]; })); }
        const x0 = p.x0, x1 = x0 + p.h, y0 = f(x0), y1 = f(x1), ks = (y1 - y0) / p.h, kt = df(x0);
        P.position.set(wx(x0), wy(y0), Z + 0.03); Q.position.set(wx(x1), wy(y1), Z + 0.03);
        tP.position.set(wx(x0) - 0.3, wy(y0) + 0.3, Z + 0.03); tQ.position.set(wx(x1) + 0.3, wy(y1) + 0.3, Z + 0.03);
        sec.set(clipLine(x0, y0, ks)); tan.set(clipLine(x0, y0, kt));
        legs.set([[wx(x0), wy(y0), Z + 0.01], [wx(x1), wy(y0), Z + 0.01], [wx(x1), wy(y1), Z + 0.01]]);
        Object.assign(st, { ks, kt, y0, y1 });
        info.set(`割线斜率 Δy/Δx = ${ks.toFixed(3)}\n切线斜率 f′(x₀) = ${kt.toFixed(3)}`);
      },
      margin: () => [`f(x₀) = ${st.y0?.toFixed(3)}`, `f(x₀+h) = ${st.y1?.toFixed(3)}`, `h = ${p.h.toFixed(2)}`, `Δy/Δx = ${st.ks?.toFixed(3)}`, `f′(x₀) = ${st.kt?.toFixed(3)}`, `相差 ${Math.abs(st.ks - st.kt).toFixed(3)}`],
    };
  },
};

// ---------------------------------------------------------------- 正方体的截面
const cube = {
  id: 'math-cube', subject: 'math', title: '正方体的截面', en: 'Slicing a cube',
  lede: ['用一个平面去切正方体，切口是一个多边形。平面和几个面相交，切口就有几条边。', '正方体只有 6 个面，所以切口最多 6 条边。转动、移动这把“刀”，看看三角形、四边形、五边形、六边形分别藏在哪里。'],
  formula: '边数 = 与截面相交的面数 ≤ 6', formulaNote: '截面与正方体每个面至多交出一条线段',
  terms: [['截面', '平面与几何体相交得到的平面图形。'], ['交线', '两个平面相交得到的直线。'], ['正六边形截面', '过六条棱的中点，垂直于体对角线。']],
  predict: { q: '用平面去截正方体，截面最多是几边形？', options: ['四边形', '六边形', '八边形'], answer: 1, why: '截面多边形的每一条边都落在正方体的一个面上，而每个面最多贡献一条边。正方体有 6 个面，所以最多是六边形。' },
  challenge: '不用预设按钮，自己切出一个正三角形；再试试能不能切出直角三角形。',
  fig: '棱长为 2 的正方体与截面', hint: '先点预设，再微调三根滑杆。',
  teach: {
    where: '人教 A 版数学 必修第二册 · 立体几何初步：基本立体图形、空间点线面的位置关系。',
    ask: ['截面是三角形时，它可能是直角三角形或钝角三角形吗？为什么？', '截面是四边形时，至少有一组对边平行，理由是什么？'],
    simplify: '截面由法向量的两个方位角和到中心的距离确定；面积按棱长 2 计算。',
  },
  controls: [
    { id: 'a', label: '倾斜', min: 0, max: 90, step: 0.1, value: 54.7, unit: '°' },
    { id: 'b', label: '旋转', min: 0, max: 90, step: 1, value: 45, unit: '°' },
    { id: 'd', label: '位置', min: -1.7, max: 1.7, step: 0.05, value: 0 },
    { id: 'p0', type: 'button', label: '三角形' }, { id: 'p1', type: 'button', label: '正方形' }, { id: 'p2', type: 'button', label: '五边形' }, { id: 'p3', type: 'button', label: '正六边形' },
  ],
  build(k) {
    const p = k.p, X = -1.5, Z = -0.9, U = 1.5, CY = 2.2;
    const V = []; for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) V.push([x, y, z]);
    const E = []; for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) if (V[i].filter((v, q) => v !== V[j][q]).length === 1) E.push([i, j]);
    const holder = at(new THREE.Group(), X, CY, Z); holder.scale.setScalar(U);
    const fillGeo = new THREE.BufferGeometry(); fillGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18 * 3), 3));
    const fill = flat(fillGeo, C.flame, { opacity: 0.4 }); fill.frustumCulled = false;
    const edge = strip(8, { w: 0.05, color: C.flame });
    const pts = dots(6, 0.06, C.flame, { flat: true });
    holder.add(glass(new THREE.BoxGeometry(2, 2, 2)), fill, edge, pts);
    const info = at(card('\n', { w: 3.6, size: 0.33, align: 'left' }), 2.6, 0, 2.5);
    const big = at(note('六边形', { size: 0.7, bold: true, w: 3.6 }), 2.6, 3.2, -2.4);
    k.root.add(holder, info, big);
    const st = {}; let last = '';
    const PRE = [[55, 45, 1.2], [0, 45, 0], [60, 25, -0.4], [54.7, 45, 0]];
    return {
      press(id) { const q = PRE[+id[1]]; k.set('a', q[0]); k.set('b', q[1]); k.set('d', q[2]); },
      update(dt, t) {
        holder.rotation.y = Math.sin(t * 0.3) * 0.25 - 0.35;
        const key = `${p.a}|${p.b}|${p.d}`; if (key === last) return; last = key;
        const a = p.a * Math.PI / 180, b = p.b * Math.PI / 180, n = new THREE.Vector3(Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b));
        const hit = [];
        E.forEach(([i, j]) => { const A = new THREE.Vector3(...V[i]), B = new THREE.Vector3(...V[j]), da = n.dot(A) - p.d, db = n.dot(B) - p.d; if (da * db < 0) hit.push(A.lerp(B, da / (da - db))); });
        const c = hit.reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, hit.length));
        const u = new THREE.Vector3().crossVectors(n, Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize(), w = new THREE.Vector3().crossVectors(n, u);
        hit.sort((P1, P2) => Math.atan2(P1.clone().sub(c).dot(w), P1.clone().sub(c).dot(u)) - Math.atan2(P2.clone().sub(c).dot(w), P2.clone().sub(c).dot(u)));
        const arr = fillGeo.attributes.position.array; arr.fill(0); let area = 0;
        hit.forEach((P1, i) => { const P2 = hit[(i + 1) % hit.length]; arr.set([c.x, c.y, c.z, P1.x, P1.y, P1.z, P2.x, P2.y, P2.z], i * 9); area += new THREE.Vector3().crossVectors(P1.clone().sub(c), P2.clone().sub(c)).length() / 2; });
        fillGeo.attributes.position.needsUpdate = true; fill.visible = edge.visible = hit.length >= 3;
        edge.nrm.copy(n); if (hit.length >= 3) edge.set([...hit, hit[0]]);
        for (let i = 0; i < 6; i++) hit[i] ? pts.put(i, hit[i].x, hit[i].y, hit[i].z) : pts.put(i, 0, -50, 0, 0.001);
        pts.done();
        const name = ['', '', '', '三角形', '四边形', '五边形', '六边形'][hit.length] || '没有切到';
        Object.assign(st, { n: hit.length, area });
        big.set(name); info.set(`截面：${name}\n面积 ${area.toFixed(2)}（棱长 2）`);
      },
      margin: () => [`与 ${st.n || 0} 个面相交`, `→ ${st.n || 0} 条边`, `面积 ${(st.area || 0).toFixed(2)}`, '正六边形时', ' 面积 = 3√3 ≈ 5.20', '正三角形最大', ' 面积 = 2√3 ≈ 3.46'],
    };
  },
};

export default [sine, conic, galton, deriv, cube];
