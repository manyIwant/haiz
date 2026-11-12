// 物理（上）：力学
import { C, TAU, clamp, group, at, rot, box, cyl, ball, plate, rod, wire, spring, arrow, strip, dash, note, card, plot, dots, flat, glass, meter, tube, stand, THREE } from '../ink.js';

const G = 9.8;

// ---------------------------------------------------------------- 单摆
const pendulum = {
  id: 'phy-pendulum', subject: 'phy', title: '单摆与重力加速度', en: 'The simple pendulum',
  lede: ['一根细线，一颗小球。在小角度下，单摆来回一次的时间只由摆长和当地的重力加速度决定。', '量出摆长，数出周期，就能“称”出脚下这颗星球的 g。'],
  formula: 'T = 2π √(l / g)', formulaNote: '周期 = 2π × √(摆长 ÷ 重力加速度)，摆角小于约 5° 时成立',
  terms: [['摆长 l', '悬点到摆球球心的距离。'], ['周期 T', '完成一次全振动所用的时间。'], ['全振动', '摆球回到同一位置且运动方向相同。']],
  predict: { q: '把木球换成同样大小、质量大得多的铁球，周期会怎样？', options: ['变长，铁球更“懒”', '变短，铁球落得快', '不变'], answer: 2, why: '质量越大，重力越大，但惯性也同比例增大，两者正好抵消。周期公式里没有质量。' },
  challenge: '只动摆长，让这只摆变成“秒摆”：周期正好 2.00 s。',
  fig: '单摆：铁架台、细线、摆球与秒表', hint: '拖动摆球拉开一个角度，松手。',
  teach: {
    where: '人教版物理 选择性必修第一册 · 机械振动：单摆；实验：用单摆测量重力加速度。',
    ask: ['把摆角拉到 40°，秒表读数和公式算出的周期还一样吗？为什么实验要求小角度？', '在月球上同一只摆的周期是地球上的多少倍？'],
    simplify: '细线无质量、不可伸长，无空气阻力与悬点摩擦；运动按 θ″ = −(g/l)·sinθ 数值积分，所以大角度时周期会比公式值略长，这是真实现象。',
  },
  controls: [
    { id: 'l', label: '摆长 l', min: 0.3, max: 1.5, step: 0.01, value: 0.8, unit: 'm' },
    { id: 'g', type: 'choice', label: '在', options: ['地球', '月球', '木星'], value: 0 },
    { id: 'bob', type: 'choice', label: '摆球', options: ['木球', '铁球'], value: 0 },
    { id: 'go', type: 'button', label: '拉到 5° 释放' },
  ],
  build(k) {
    const p = k.p, S = 3.4, PIV = [0.4, 5.8, -1.2], GS = [9.8, 1.62, 24.8];
    k.root.add(at(plate(3.4, 2.4), -2.4, 0, -1.2), at(cyl(0.11, 6.0), -3.4, 0.08, -1.2));
    k.root.add(rod([-3.4, 5.8, -1.2], [PIV[0] + 0.3, 5.8, -1.2], 0.09), at(box(0.5, 0.34, 0.5), -3.4, 5.63, -1.2));
    k.root.add(at(box(0.3, 0.16, 0.3), PIV[0], PIV[1] - 0.08, PIV[2]));
    k.root.add(dash([PIV[0], PIV[1], PIV[2] - 0.02], [PIV[0], 0.3, PIV[2] - 0.02]));
    const str = wire(PIV, [PIV[0], 3, PIV[2]], 0.02);
    const bobs = [ball(0.34, C.wood), ball(0.34, '#cfd6dc')];
    const trail = strip(60, { color: C.violet, w: 0.09, opacity: 0.5 });
    const watch = at(card('T = 0.00 s\n全振动 0 次', { size: 0.34, w: 3.2, align: 'left' }), 2.6, 0, 2.2);
    const lenTag = note('l', { size: 0.42, italic: true });
    k.root.add(str, ...bobs, trail, watch, lenTag);
    let th = 0.26, om = 0, t = 0, n = 0, lastCross = null, T = 0, held = false;
    const hist = [];
    const release = (a) => { th = a; om = 0; t = 0; n = 0; lastCross = null; T = 0; hist.length = 0; };
    bobs.forEach((b) => k.drag(b, {
      start: () => { held = true; },
      move: (q) => { th = clamp(Math.atan2(q.x - PIV[0], PIV[1] - q.y), -1.05, 1.05); om = 0; },
      end: () => { held = false; release(th); },
    }));
    return {
      press: () => release(5 * Math.PI / 180),
      change: (id) => { if (id !== 'bob') release(Math.max(Math.abs(th), 0.09) * (th < 0 ? -1 : 1)); },
      update(dt) {
        const g = GS[p.g];
        if (!held && dt > 0) {
          const steps = 8, h = dt / steps;
          for (let i = 0; i < steps; i++) {
            const prev = th;
            om += -(g / p.l) * Math.sin(th) * h; th += om * h; t += h;
            if (prev < 0 && th >= 0) {
              const tc = t - h * (th / (th - prev));
              if (lastCross !== null) { T = tc - lastCross; n++; }
              lastCross = tc;
            }
          }
        }
        const L = p.l * S, q = [PIV[0] + Math.sin(th) * L, PIV[1] - Math.cos(th) * L, PIV[2]];
        str.span(PIV, q);
        bobs.forEach((b, i) => { b.visible = i === p.bob; b.position.set(...q); });
        hist.push(q); if (hist.length > 26) hist.shift();
        trail.set(hist); trail.visible = !held;
        lenTag.position.set(PIV[0] + Math.sin(th) * L * 0.5 + 0.35, PIV[1] - Math.cos(th) * L * 0.5, PIV[2] + 0.05);
        watch.set(`T = ${T ? T.toFixed(2) : '—'} s\n全振动 ${n} 次`);
        this.T = T;
      },
      margin() {
        const g = GS[p.g], Tf = TAU * Math.sqrt(p.l / g), T = this.T;
        return ['T = 2π√(l/g)', ` = 2π√(${p.l.toFixed(2)}/${g})`, ` = ${Tf.toFixed(2)} s`, T ? `秒表: T = ${T.toFixed(2)} s` : '秒表: 等一个来回…', ...(T ? ['g = 4π²l/T²', ` = ${(4 * Math.PI ** 2 * p.l / T / T).toFixed(2)} m/s²`] : [])];
      },
    };
  },
};

// ---------------------------------------------------------------- 平抛
const projectile = {
  id: 'phy-projectile', subject: 'phy', title: '平抛运动', en: 'Projectile motion',
  lede: ['水平抛出的小球，一边匀速向前，一边自由下落。两个方向的运动互不干扰。', '频闪照片把它拆开给你看：横向间隔相等，纵向间隔越来越大。'],
  formula: 'x = v₀t　 y = ½ g t²', formulaNote: '水平：匀速直线运动；竖直：自由落体运动',
  terms: [['初速度 v₀', '离开桌边瞬间的水平速度。'], ['射程 x', '落地点到桌边的水平距离。'], ['频闪', '每隔相同时间记录一次位置。']],
  predict: { q: '同一高度，一颗球水平抛出，另一颗同时松手下落，谁先落地？', options: ['下落的那颗先落地', '抛出的那颗先落地', '同时落地'], answer: 2, why: '竖直方向上，两颗球都从静止开始做自由落体，下落高度相同，用时就相同。水平速度不改变下落的快慢。' },
  challenge: '保持高度 1.25 m，让小球正好落在 1.50 m 处。',
  fig: '平抛与自由落体的频闪对比（慢放）', hint: '调初速度和桌高，按“发射”。',
  teach: {
    where: '人教版物理 必修第二册 · 抛体运动；实验：探究平抛运动的特点。',
    ask: ['数一数频闪点：相邻两点的水平间距有什么特点？竖直间距之比呢？', '初速度加倍，飞行时间变不变？射程呢？'],
    simplify: '忽略空气阻力与小球大小；画面按 0.35 倍速慢放，频闪间隔 0.04 s。',
  },
  controls: [
    { id: 'v', label: '初速度 v₀', min: 0.5, max: 3.5, step: 0.1, value: 2, unit: 'm/s' },
    { id: 'h', label: '桌高 h', min: 0.5, max: 2, step: 0.05, value: 1.25, unit: 'm' },
    { id: 'go', type: 'button', label: '发射' },
  ],
  build(k) {
    const p = k.p, S = 2.2, X0 = -2.9, Z = -0.8, R = 0.2;
    const tbl = at(box(1.5, 1, 1.9), X0 - 0.75, 0, Z + 0.35);
    const gun = at(box(0.9, 0.3, 0.42), X0 - 0.8, 1, Z);
    const A = ball(R), B = ball(R, '#cfd6dc');
    const tA = dots(36, 0.075, C.violet, { flat: true }), tB = dots(36, 0.075, C.amber, { flat: true });
    const land = flat(new THREE.RingGeometry(0.2, 0.3, 28).rotateX(-Math.PI / 2), C.copper);
    const info = at(card('\n', { w: 3.5, size: 0.32, align: 'left' }), 2.4, 0, -3.2);
    k.root.add(tbl, gun, A, B, tA, tB, land, info, dash([X0, 0.03, Z + 1.75], [X0 + 3.4 * S, 0.03, Z + 1.75], { len: 0.12, gap: 0.12 }));
    for (let i = 0; i <= 3; i++) k.root.add(at(note(`${i} m`, { lay: 'flat', size: 0.28 }), X0 + i * S, 0.03, Z + 2.15), wire([X0 + i * S, 0.03, Z + 1.6], [X0 + i * S, 0.03, Z + 1.9]));
    let t = 0, n = 0;
    const fire = () => { t = 0; n = 0; for (let i = 0; i < 36; i++) { tA.put(i, 0, -50, 0, 0.001); tB.put(i, 0, -50, 0, 0.001); } tA.done(); tB.done(); };
    return {
      press: fire, change: fire,
      update(dt) {
        const h = p.h, tf = Math.sqrt(2 * h / G);
        tbl.scale.y = h * S; gun.position.y = h * S;
        t += dt * 0.35;
        const tt = Math.min(t, tf), y = (h - 0.5 * G * tt * tt) * S + R;
        A.position.set(X0 + p.v * tt * S, y, Z); B.position.set(X0 + 0.15, y, Z + 1.1);
        while (n < 36 && n * 0.04 <= tt) {
          const ts = n * 0.04, ys = (h - 0.5 * G * ts * ts) * S + R;
          tA.put(n, X0 + p.v * ts * S, ys, Z); tB.put(n, X0 + 0.15, ys, Z + 1.1); n++;
          tA.done(); tB.done();
        }
        land.position.set(X0 + p.v * tf * S, 0.03, Z);
        info.set(`飞行时间 t = ${tf.toFixed(2)} s\n水平射程 x = ${(p.v * tf).toFixed(2)} m`);
        if (t > tf + 1.4) fire();
      },
      margin() {
        const tf = Math.sqrt(2 * p.h / G), vy = G * tf;
        return ['t = √(2h/g)', ` = √(2×${p.h.toFixed(2)}/9.8)`, ` = ${tf.toFixed(2)} s`, `x = v₀t = ${(p.v * tf).toFixed(2)} m`, `落地 vy = gt = ${vy.toFixed(1)} m/s`, `落地速率 ${Math.hypot(p.v, vy).toFixed(1)} m/s`];
      },
    };
  },
};

// ---------------------------------------------------------------- 牛顿第二定律
const newton2 = {
  id: 'phy-newton2', subject: 'phy', title: '加速度与力、质量', en: "Newton's second law",
  lede: ['槽码下落，细绳拉着小车加速。拉力越大，加速度越大；小车越重，加速度越小。', '每次只改一个量，另一个保持不变，这叫控制变量。'],
  formula: 'a = F / m', formulaNote: '加速度 = 合外力 ÷ 质量。本装置中 a = m₀g ÷ (M + m₀)',
  terms: [['合外力 F', '物体所受各力的矢量和。'], ['控制变量', '研究一个因素时让其他因素不变。'], ['槽码', '挂在绳端、提供拉力的小重物。']],
  predict: { q: '拉力不变，把小车的质量加到原来的 2 倍，加速度变为原来的？', options: ['2 倍', '一半', '不变'], answer: 1, why: '力一定时，加速度与质量成反比。同样的力要带动两倍的质量，速度增加得只有原来一半快。' },
  challenge: '让小车跑完 0.60 m 正好用 1.00 s。',
  fig: '小车、轨道、定滑轮与槽码', hint: '设好质量，按“释放小车”。',
  teach: {
    where: '人教版物理 必修第一册 · 运动和力的关系；实验：探究加速度与力、质量的关系。',
    ask: ['槽码 100 g、小车 200 g 时，绳的拉力等于槽码的重力吗？看左边批注里的两个数。', '为什么实验要求槽码质量远小于小车质量？'],
    simplify: '轨道已“平衡摩擦力”，滑轮与细绳质量不计。拉力按 T = Ma 精确计算，所以能看到 T 略小于 m₀g 的系统误差来源。',
  },
  controls: [
    { id: 'M', label: '小车 M', min: 0.2, max: 1, step: 0.05, value: 0.4, unit: 'kg' },
    { id: 'm', label: '槽码 m₀', min: 10, max: 100, step: 5, value: 50, unit: 'g' },
    { id: 'go', type: 'button', label: '释放小车' },
  ],
  build(k) {
    const p = k.p, S = 5, D = 0.6, TOP = 3.4, X0 = -2.7, XP = 3.5, Z = -0.9;
    k.root.add(at(box(7.0, 0.22, 2.2), -0.2, TOP - 0.22, Z));
    for (const x of [-3.4, 2.8]) for (const z of [Z - 0.9, Z + 0.9]) k.root.add(rod([x, 0, z], [x, TOP - 0.22, z], 0.09));
    k.root.add(rot(at(cyl(0.3, 0.16), XP, TOP + 0.2, Z - 0.08), Math.PI / 2, 0, 0), at(box(0.5, 0.2, 0.3), XP - 0.25, TOP, Z - 0.25));
    const load = at(box(0.8, 1, 0.6, C.wood), 0, 0.58, 0);
    const cart = group(at(box(1.2, 0.4, 0.8), 0, 0.18, 0), load);
    for (const x of [-0.4, 0.4]) for (const z of [-0.45, 0.35]) cart.add(rot(at(cyl(0.17, 0.1), x, 0.17, z), Math.PI / 2, 0, 0));
    const s1 = wire([0, 0, 0], [1, 0, 0]), s2 = wire([0, 0, 0], [0, 1, 0]);
    const wt = cyl(0.22, 0.42, '#cfd6dc');
    const F = arrow(C.copper, 0.05);
    const info = at(card('\n', { w: 3.5, size: 0.32, align: 'left' }), -2.3, 0, 2.4);
    k.root.add(cart, s1, s2, wt, F, info, at(note('0.60 m', { size: 0.3 }), X0 + 1.9, TOP + 1.3, Z));
    k.root.add(wire([X0 + 0.6, TOP + 0.02, Z + 0.7], [X0 + 0.6, TOP + 0.02, Z + 1.05]), wire([X0 + 0.6 + D * S, TOP + 0.02, Z + 0.7], [X0 + 0.6 + D * S, TOP + 0.02, Z + 1.05]));
    let t = 0, run = false, tEnd = 0;
    const acc = () => (p.m / 1000) * G / (p.M + p.m / 1000);
    const reset = () => { t = 0; run = false; tEnd = 0; };
    return {
      press: () => { reset(); run = true; }, change: reset,
      update(dt) {
        const a = acc();
        if (run) { t += dt; if (0.5 * a * t * t >= D) { tEnd = Math.sqrt(2 * D / a); t = tEnd; run = false; } }
        const s = Math.min(D, 0.5 * a * t * t), x = X0 + s * S;
        cart.position.set(x, TOP, Z);
        load.scale.y = 0.02 + (p.M - 0.2) * 1.3;
        s1.span([x + 0.6, TOP + 0.5, Z], [XP, TOP + 0.5, Z]);
        const top = TOP - 0.1 - s * S;
        s2.span([XP + 0.3, TOP + 0.2, Z], [XP + 0.3, top, Z]);
        wt.position.set(XP + 0.3, top - 0.42, Z); wt.scale.setScalar(0.7 + p.m / 160);
        F.set([x + 0.6, TOP + 0.9, Z], [x + 0.6 + p.M * a * 2.4, TOP + 0.9, Z]);
        info.set(`t = ${t.toFixed(2)} s\na = ${tEnd ? `2x/t² = ${(2 * D / tEnd / tEnd).toFixed(2)} m/s²` : '—'}`);
      },
      margin() {
        const a = acc(), m = p.m / 1000;
        return ['a = m₀g/(M+m₀)', ` = ${(m * G).toFixed(2)}/${(p.M + m).toFixed(2)}`, ` = ${a.toFixed(2)} m/s²`, `槽码重 m₀g = ${(m * G).toFixed(3)} N`, `绳拉力 T = Ma`, ` = ${(p.M * a).toFixed(3)} N`];
      },
    };
  },
};

// ---------------------------------------------------------------- 胡克定律
const hooke = {
  id: 'phy-hooke', subject: 'phy', title: '弹簧的弹力与形变', en: "Hooke's law",
  lede: ['在弹簧下端一个一个地挂上钩码，量出每次伸长了多少。', '把数据点画到坐标纸上，它们排成一条过原点的直线，直线的斜率就是劲度系数。'],
  formula: 'F = k x', formulaNote: '弹力 = 劲度系数 × 形变量（在弹性限度内）',
  terms: [['形变量 x', '弹簧现在的长度减去原长。'], ['劲度系数 k', '弹簧的“硬度”，单位 N/m。'], ['弹性限度', '超过它，弹簧就回不去了。']],
  predict: { q: '挂 2 个钩码时伸长 4 cm，挂 4 个钩码时伸长多少？', options: ['6 cm', '8 cm', '16 cm'], answer: 1, why: '弹性限度内，弹力与形变量成正比。拉力变成 2 倍，伸长也变成 2 倍。' },
  challenge: '换一根弹簧，让 3 个钩码正好把它拉长 10 cm 左右。',
  fig: '铁架台、弹簧、钩码（每个 50 g）与刻度尺', hint: '增减钩码，看数据点落在哪里。',
  teach: {
    where: '人教版物理 必修第一册 · 相互作用——力；实验：探究弹簧弹力与形变量的关系。',
    ask: ['图线为什么过原点？如果横轴画的是弹簧总长，图线会怎样？', '两根弹簧的图线，哪条更陡？陡代表什么？'],
    simplify: '弹簧自身质量不计，始终在弹性限度内；g 取 9.8 m/s²。',
  },
  controls: [
    { id: 'n', label: '钩码个数', min: 0, max: 5, step: 1, value: 2, unit: '个' },
    { id: 'k', type: 'choice', label: '弹簧', options: ['软 15 N/m', '中 25 N/m', '硬 50 N/m'], value: 1 },
  ],
  build(k) {
    const p = k.p, KS = [15, 25, 50], TOPY = 5.7, L0 = 1.5, U = 12, X = -1.2, Z = -1;
    k.root.add(at(stand(6, 2.2), X - 1.2, 0, Z));
    k.root.add(at(box(0.3, 4.9, 0.08), X + 1.0, 0.9, Z - 0.2));
    for (let i = 0; i <= 11; i++) k.root.add(wire([X + 0.86, TOPY - L0 - i * 0.025 * U, Z - 0.15], [X + (i % 4 ? 0.98 : 1.14), TOPY - L0 - i * 0.025 * U, Z - 0.15], 0.014));
    for (let i = 0; i <= 2; i++) k.root.add(at(note(`${i * 10}`, { size: 0.24 }), X + 1.42, TOPY - L0 - i * 0.1 * U, Z - 0.15));
    const sp = spring(7, 0.3, 0.026);
    const ptr = wire([0, 0, 0], [1, 0, 0], 0.02);
    const ws = Array.from({ length: 5 }, () => cyl(0.24, 0.26, '#cfd6dc'));
    const hookW = wire([0, 0, 0], [0, 1, 0], 0.02);
    const g = at(plot({ w: 3.7, h: 2.9, xr: [0, 20], yr: [0, 3], xl: 'x / cm', yl: 'F / N' }), 2.4, 0, -2.2);
    const info = at(card('\n', { w: 3.3, size: 0.32, align: 'left' }), 2.4, 0, 2.3);
    k.root.add(sp, ptr, hookW, ...ws, g, info);
    let x = 0, v = 0; const seen = new Set();
    const draw = () => {
      const kk = KS[p.k];
      g.clear().fn((xc) => kk * xc / 100, C.violet, 0.035, true);
      seen.forEach((n) => g.dot(n * 0.05 * G / kk * 100, n * 0.05 * G));
      g.done();
    };
    draw();
    return {
      change(id) { if (id === 'k') seen.clear(); draw(); },
      update(dt) {
        const kk = KS[p.k], xe = p.n * 0.05 * G / kk;
        v += ((xe - x) * 70 - v * 5) * dt; x += v * dt;
        if (Math.abs(x - xe) < 0.002 && Math.abs(v) < 0.01 && !seen.has(p.n)) { seen.add(p.n); draw(); }
        const yb = TOPY - L0 - x * U;
        sp.span([X, TOPY, Z], [X, yb, Z]);
        ptr.span([X, yb, Z], [X + 0.9, yb, Z - 0.1]);
        hookW.span([X, yb, Z], [X, yb - 0.25, Z]);
        ws.forEach((w, i) => { w.visible = i < p.n; w.position.set(X, yb - 0.25 - (i + 1) * 0.29, Z); });
        info.set(`F = ${(p.n * 0.05 * G).toFixed(2)} N\nx = ${(x * 100).toFixed(1)} cm`);
      },
      margin() {
        const kk = KS[p.k], F = p.n * 0.05 * G, xe = F / kk;
        return [`F = mg = ${p.n}×0.05×9.8`, ` = ${F.toFixed(2)} N`, `x = F/k = ${(xe * 100).toFixed(1)} cm`, '弹性势能', `Eₚ = ½kx²`, ` = ${(0.5 * kk * xe * xe).toFixed(3)} J`];
      },
    };
  },
};

// ---------------------------------------------------------------- 玻意耳定律
const boyle = {
  id: 'phy-boyle', subject: 'phy', title: '气体的等温变化', en: "Boyle's law",
  lede: ['把一定质量的气体关在针筒里，慢慢推活塞。体积变小，分子撞击器壁更频繁，压强就升高。', '温度不变时，压强与体积的乘积保持不变。'],
  formula: 'p V = C', formulaNote: '一定质量的气体，温度不变时，压强 × 体积 = 常量',
  terms: [['等温变化', '温度保持不变的状态变化。'], ['压强 p', '气体分子撞击器壁产生的效果。'], ['等温线', 'p–V 图上同一温度的曲线。']],
  predict: { q: '温度不变，把气体体积压缩到原来的一半，压强变为？', options: ['原来的一半', '原来的 2 倍', '原来的 4 倍'], answer: 1, why: '分子数不变、体积减半，单位体积里的分子数加倍，单位时间撞击器壁的次数加倍，压强加倍。' },
  challenge: '在 27 ℃ 下把压强表推到正好 200 kPa，这时体积是多少？',
  fig: '注射器、活塞、压强表与 p–V 图线', hint: '拖体积滑杆，按“记录”攒数据点。',
  teach: {
    where: '人教版物理 选择性必修第三册 · 气体、固体和液体；实验：探究气体等温变化的规律。',
    ask: ['换成 p–1/V 图，数据点排成什么形状？为什么这样画更容易判断规律？', '同一份气体，100 ℃ 的等温线在 27 ℃ 等温线的上方还是下方？'],
    simplify: '理想气体，推拉足够缓慢（等温），不漏气；画面中的分子数只是示意。',
  },
  controls: [
    { id: 'V', label: '体积 V', min: 10, max: 50, step: 1, value: 30, unit: 'mL' },
    { id: 'T', type: 'choice', label: '温度', options: ['0 ℃', '27 ℃', '100 ℃'], value: 1 },
    { id: 'ax', type: 'choice', label: '图线', options: ['p–V', 'p–1/V'], value: 0 },
    { id: 'rec', type: 'button', label: '记录' }, { id: 'clr', type: 'button', label: '清空' },
  ],
  build(k) {
    const p = k.p, TS = [273, 300, 373], R = 1.05, X = -2.2, Z = -0.8, H = 4.4;
    const wall = at(new THREE.Group(), X, 0.5, Z);
    k.root.add(at(cyl(1.3, 0.5), X, 0, Z), wall);
    wall.add(glass(new THREE.CylinderGeometry(R, R, H, 44, 1, true).translate(0, H / 2, 0)));
    const piston = group(cyl(R * 0.97, 0.22, C.shade), at(cyl(0.12, 2.6), 0, 0.22, 0), at(cyl(0.6, 0.14), 0, 2.8, 0));
    wall.add(piston);
    const gas = dots(46, 0.07, C.violet, { flat: true });
    wall.add(gas);
    const st = Array.from({ length: 46 }, () => { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * 0.9, d = new THREE.Vector3().randomDirection(); return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: Math.random(), vx: d.x, vy: d.y, vz: d.z }; });
    const gauge = at(meter('kPa', { w: 2 }), 1.3, 0, 2.3);
    k.root.add(gauge, tube([[X + 1.2, 0.25, Z], [X + 2.2, 0.08, Z + 1.2], [1.3, 0.08, 1.9]], 0.05));
    const g = at(plot({ w: 4, h: 3.1, xr: [0, 55], yr: [0, 400], xl: 'V / mL', yl: 'p / kPa' }), 2.3, 0, -2.4);
    k.root.add(g);
    const pts = [];
    const pr = () => 10 * TS[p.T] / p.V;
    const draw = () => {
      const inv = p.ax === 1;
      g.range(inv ? [0, 0.11] : [0, 55], [0, 400]).clear();
      TS.forEach((T, i) => g.fn((v) => (inv ? 10 * T * v : 10 * T / Math.max(v, 1)), i === p.T ? C.violet : 'rgba(30,43,54,.25)', 0.03, i !== p.T));
      pts.forEach(([V, P]) => g.dot(inv ? 1 / V : V, P));
      g.dot(inv ? 1 / p.V : p.V, pr(), C.amber, 0.09).text(inv ? 0.062 : 30, 372, inv ? '横轴: 1/V (mL⁻¹)' : '').done();
    };
    draw();
    return {
      press(id) { if (id === 'rec') pts.push([p.V, pr()]); else pts.length = 0; draw(); },
      change: draw,
      update(dt) {
        const hp = 0.25 + (p.V / 50) * (H - 0.9), sp = Math.sqrt(TS[p.T] / 300) * 2.6;
        piston.position.y = hp;
        st.forEach((m, i) => {
          m.x += m.vx * sp * dt; m.y += m.vy * sp * dt; m.z += m.vz * sp * dt;
          const rr = Math.hypot(m.x, m.z);
          if (rr > 0.93) { const nx = m.x / rr, nz = m.z / rr, d = m.vx * nx + m.vz * nz; if (d > 0) { m.vx -= 2 * d * nx; m.vz -= 2 * d * nz; } m.x = nx * 0.93; m.z = nz * 0.93; }
          if (m.y < 0.1) { m.y = 0.1; m.vy = Math.abs(m.vy); }
          if (m.y > hp - 0.1) { m.y = hp - 0.1; m.vy = -Math.abs(m.vy); }
          gas.put(i, m.x, m.y, m.z);
        });
        gas.done();
        gauge.set(pr() / 400, `${pr().toFixed(0)} kPa`);
      },
      margin() {
        const P = pr();
        return [`p = ${P.toFixed(0)} kPa`, `V = ${p.V} mL`, `pV = ${(P * p.V).toFixed(0)}`, '（单位 kPa·mL）', `T = ${TS[p.T]} K`, `pV/T = ${(P * p.V / TS[p.T]).toFixed(1)}`];
      },
    };
  },
};

export default [pendulum, projectile, newton2, hooke, boyle];
