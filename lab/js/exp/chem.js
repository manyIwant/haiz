// 化学
import { C, TAU, clamp, lerp, group, at, rot, box, cyl, ball, plate, rod, wire, tube, glow, jar, note, card, plot, dots, liquid, flat, glass, bubbler, flow, sheet, stand, wavelength, THREE } from '../ink.js';

const beaker = (r, h) => group(glass(new THREE.CylinderGeometry(r, r, h, 44, 1, true).translate(0, h / 2, 0)), glass(new THREE.CircleGeometry(r, 44).rotateX(-Math.PI / 2).translate(0, 0.03, 0)));
const mix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), clamp(t));

// ---------------------------------------------------------------- 酸碱中和滴定
const titration = {
  id: 'chem-titration', subject: 'chem', title: '酸碱中和滴定', en: 'Acid–base titration',
  lede: ['锥形瓶里是 20.00 mL 不知道浓度的盐酸，滴了两滴酚酞。滴定管里是 0.1000 mol/L 的氢氧化钠溶液。', '一滴一滴加进去，直到最后半滴让溶液从无色变成浅红，并且半分钟不褪色。'],
  formula: 'c(酸)·V(酸) = c(碱)·V(碱)', formulaNote: '恰好中和时，酸提供的 H⁺ 与碱提供的 OH⁻ 物质的量相等',
  terms: [['滴定终点', '指示剂恰好变色的那一刻。'], ['酚酞', 'pH 小于 8.2 无色，大于 10 呈红色。'], ['pH 突跃', '终点附近 pH 的急剧变化。']],
  predict: { q: '快到终点时，多加一滴氢氧化钠（约 0.05 mL），溶液的 pH 会？', options: ['只变一点点，和之前差不多', '一下子跳好几个单位', '反而降低'], answer: 1, why: '接近终点时溶液里剩下的 H⁺ 已经极少，一滴碱就足以把它们全部中和并过量，pH 会从 4 左右直接跳到 10 左右。所以终点前必须逐滴加。' },
  challenge: '三瓶盐酸各滴定一次，误差都控制在 0.05 mL 以内。',
  fig: '碱式滴定管、锥形瓶与 pH 曲线', hint: '先快滴，快到终点时改成逐滴。',
  teach: {
    where: '人教版化学 选择性必修 1 · 水溶液中的离子反应与平衡；实验活动：强酸与强碱的中和滴定。',
    ask: ['“快速”一路滴到变色，算出来的浓度偏大还是偏小？为什么？', '如果改用甲基橙作指示剂，终点的颜色变化是什么？'],
    simplify: '强酸强碱、25 ℃，pH 由物料守恒与水的离子积精确计算；一滴按 0.05 mL 计。不模拟润洗、读数视差等操作误差。',
    safety: '真实操作中氢氧化钠有腐蚀性，须戴护目镜；滴定管使用前要检漏、润洗。',
  },
  controls: [
    { id: 'rate', type: 'choice', label: '活塞', options: ['关', '逐滴', '快速'], value: 0 },
    { id: 'acid', type: 'choice', label: '待测盐酸', options: ['甲', '乙', '丙'], value: 0 },
    { id: 'drop', type: 'button', label: '滴一滴' }, { id: 'reset', type: 'button', label: '重来' },
  ],
  build(k) {
    const p = k.p, CA = [0.1, 0.08, 0.125], X = -1.1, Z = -1;
    k.root.add(at(stand(6, 0), X - 1.9, 0, Z), rod([X - 2.8, 4.4, Z], [X + 0.2, 4.4, Z], 0.07));
    const bur = at(jar(0.17, 3.5, C.sky, { fill: 1, opacity: 0.55, glow: 0.12 }), X + 0.4, 2.35, Z);
    k.root.add(bur, at(box(0.36, 0.14, 0.2), X + 0.4, 2.2, Z), rod([X + 0.4, 2.2, Z], [X + 0.4, 1.9, Z], 0.035));
    const flask = at(group(glass(new THREE.CylinderGeometry(0.3, 1.05, 1.4, 44, 1, true).translate(0, 0.7, 0)), glass(new THREE.CylinderGeometry(0.3, 0.3, 0.45, 32, 1, true).translate(0, 1.62, 0)), glass(new THREE.CircleGeometry(1.05, 44).rotateX(-Math.PI / 2).translate(0, 0.03, 0))), X + 0.4, 0.1, Z);
    const sol = flat(new THREE.CylinderGeometry(0.66, 0.98, 0.62, 44).translate(0, 0.35, 0), '#eaf4ff', { opacity: 0.5 });
    const halo = glow(C.rose, 3.2, 0);
    flask.add(sol, at(halo, 0, 0.4, 0));
    const drop = ball(0.06, C.sky);
    const g = at(plot({ w: 4.1, h: 3.2, xr: [0, 40], yr: [0, 14], xl: 'V(NaOH) / mL', yl: 'pH' }), 2.2, 0, -2.4);
    const info = at(card('\n', { w: 3.6, size: 0.32, align: 'left' }), 2.3, 0, 2.3);
    k.root.add(at(plate(2.3, 2.3), X + 0.45, 0, Z), flask, drop, g, info);
    let V = 0, acc = 0, end = null, dy = -1; const trace = [[0, 0]];
    const pH = (v) => { const d = (CA[p.acid] * 20 - 0.1 * v) / (20 + v); return -Math.log10((d + Math.sqrt(d * d + 4e-14)) / 2); };
    const draw = () => { g.clear().curve(trace, C.violet, 0.04); if (end) g.dot(end, 8.2, C.rose); g.dot(V, pH(V), C.amber, 0.08).done(); };
    const add = (dv) => { if (V >= 40) return; V = Math.min(40, V + dv); const h = pH(V); trace.push([V, h]); if (end === null && h >= 8.2) end = V; dy = 1.85; draw(); };
    const reset = () => { V = 0; end = null; trace.length = 0; trace.push([0, pH(0)]); k.set('rate', 0); draw(); };
    reset();
    return {
      press(id) { id === 'drop' ? add(0.05) : reset(); },
      change(id) { if (id === 'acid') reset(); },
      update(dt) {
        if (p.rate) { acc += dt * (p.rate === 1 ? 0.14 : 1.6); while (acc >= 0.05) { acc -= 0.05; add(0.05); } }
        bur.fill(1 - V / 42);
        const h = pH(V), pink = clamp((h - 8.2) / 1.6);
        sol.material.color.copy(mix('#eaf4ff', '#ff4fa3', pink)); sol.material.opacity = lerp(0.42, 0.8, pink);
        halo.material.opacity = pink * 0.4;
        if (dy > 0.9) { dy -= dt * 5; drop.position.set(X + 0.4, dy, Z); drop.visible = true; } else drop.visible = false;
        info.set(`V(NaOH) = ${V.toFixed(2)} mL\npH = ${h.toFixed(2)}${end ? '  已变色' : ''}`);
        this.s = { h };
      },
      margin() {
        const out = [`已滴入 ${V.toFixed(2)} mL`, `pH = ${(this.s?.h ?? 1).toFixed(2)}`];
        if (end) { const c = 0.1 * end / 20, tr = CA[p.acid]; out.push('终点读数', ` V = ${end.toFixed(2)} mL`, 'c(HCl) = 0.1000V/20.00', ` = ${c.toFixed(4)} mol/L`, `真实值 ${tr.toFixed(4)}`, V - end > 0.3 ? '滴过头了！' : ''); } else out.push('酚酞：无色', '还没到终点');
        return out.filter(Boolean);
      },
    };
  },
};

// ---------------------------------------------------------------- 原电池
const cell = {
  id: 'chem-cell', subject: 'chem', title: '原电池', en: 'The galvanic cell',
  lede: ['把锌片和铜片插进稀硫酸，再用导线连起来。锌片悄悄溶解，铜片上冒出气泡，导线里有了电流。', '氧化反应和还原反应被分到两个电极上进行，电子只能绕道走导线：化学能变成了电能。'],
  formula: 'Zn + 2H⁺ = Zn²⁺ + H₂↑', formulaNote: '负极：Zn − 2e⁻ = Zn²⁺（氧化）　正极：2H⁺ + 2e⁻ = H₂↑（还原）',
  terms: [['负极', '失去电子、发生氧化反应的电极。'], ['正极', '得到电子、发生还原反应的电极。'], ['电解质溶液', '靠离子定向移动来导电。']],
  predict: { q: '电子从哪里出发，经过哪里，到达哪里？', options: ['从铜片经导线到锌片', '从锌片经导线到铜片', '从锌片经溶液到铜片'], answer: 1, why: '锌比铜活泼，更容易失去电子，是负极。电子沿导线流向铜片；溶液里没有自由电子，靠 H⁺ 等离子移动导电。记住：电子不下水，离子不上岸。' },
  challenge: '找出两种“灯不亮”的组合，并说出各自缺了哪个条件。',
  fig: '铜锌原电池：电极、导线、小灯与稀硫酸', hint: '换电极，换溶液，看小灯亮不亮。',
  teach: {
    where: '人教版化学 必修第二册 · 化学反应与能量：化学能与电能；选择性必修 1 · 化学反应与电能：原电池。',
    ask: ['构成原电池需要哪几个条件？用“铜–铜”和“蔗糖溶液”两个反例说明。', '把铁换成锌，电压变大，说明了什么？'],
    simplify: '电压取标准电极电势之差的理论值，不考虑极化与浓度；真实实验中锌片表面也会直接冒少量气泡（锌不纯形成微电池），这里没有画出。',
    safety: '稀硫酸有腐蚀性，真实实验须戴护目镜。',
  },
  controls: [
    { id: 'pair', type: 'choice', label: '电极', options: ['锌–铜', '铁–铜', '铜–铜'], value: 0 },
    { id: 'sol', type: 'choice', label: '溶液', options: ['稀硫酸', '蔗糖溶液'], value: 0 },
  ],
  build(k) {
    const p = k.p, Z = -0.8, EL = [['锌', '#c3ccd3', 0.76, 'Zn − 2e⁻ = Zn²⁺'], ['铁', '#8f989e', 0.44, 'Fe − 2e⁻ = Fe²⁺'], ['铜', C.copper, 0, '']];
    const bk = at(beaker(1.7, 2.4), 0, 0, Z), liq = at(liquid(1.6, 1.7, '#cfe6ff', 0.4), 0, 0.05, Z);
    const left = at(box(0.6, 2.9, 0.12), -0.8, 0.5, Z), right = at(box(0.6, 2.9, 0.12, C.copper), 0.8, 0.5, Z);
    const path = [[-0.8, 3.4, Z], [-0.8, 4.4, Z], [-0.3, 4.7, Z], [0.3, 4.7, Z], [0.8, 4.4, Z], [0.8, 3.4, Z]];
    const lamp = at(ball(0.3), 0, 4.95, Z), lit = at(glow(C.amber, 2.6, 0), 0, 4.95, Z);
    const e = flow(path, 9, C.sky, { r: 0.085 });
    const hplus = flow([[-0.5, 1.0, Z + 0.4], [0.55, 1.0, Z + 0.4]], 4, C.flame, { r: 0.07 });
    const bub = bubbler(18, { x: 0.8, z: Z + 0.12, rad: 0.25, y0: 0.6, speed: 1.3 });
    const info = at(card('\n\n', { w: 4.0, size: 0.28, align: 'left' }), 2.7, 0, 2.7);
    const tagL = at(note('负极', { size: 0.34 }), -2.4, 3.2, Z), tagR = at(note('正极', { size: 0.34 }), 2.4, 3.2, Z), tagE = at(note('e⁻ →', { size: 0.36, color: C.blue }), 0, 5.6, Z);
    k.root.add(bk, liq, left, right, tube(path, 0.04, C.copper), lamp, lit, e, hplus, bub, info, tagL, tagR, tagE);
    const st = {};
    return {
      update(dt) {
        const m = EL[p.pair], on = p.sol === 0 && m[2] > 0, v = on ? m[2] : 0;
        left.material.color.set(m[1]);
        liq.set(1.7, p.sol === 0 ? '#cfe6ff' : '#f6e7c4');
        e.visible = hplus.visible = tagE.visible = on;
        e.step(dt, v * 3); hplus.step(dt, v * 0.8);
        bub.step(dt, on ? v * 7 : 0, 1.7);
        lit.material.opacity = lerp(lit.material.opacity, on ? 0.35 + v * 0.6 : 0, 0.1);
        tagL.set(on ? '负极' : '—'); tagR.set(on ? '正极' : '—');
        Object.assign(st, { on, v, m });
        info.set(on ? `理论电压 ≈ ${v.toFixed(2)} V\n负极：${m[0]}片（被氧化）\n正极：铜片上放出 H₂` : p.sol ? '灯不亮\n蔗糖溶液里没有\n可以自由移动的离子' : '灯不亮\n两个电极相同\n没有电势差');
      },
      margin() {
        return st.on ? ['负极（氧化）', ` ${st.m[3]}`, '正极（还原）', ' 2H⁺ + 2e⁻ = H₂↑', '电子：负极→导线→正极', 'H⁺：溶液中移向正极'] : ['形成原电池需要：', '① 活泼性不同的两极', '② 电解质溶液', '③ 闭合回路', '④ 自发的氧化还原反应'];
      },
    };
  },
};

// ---------------------------------------------------------------- 化学平衡
const equilibrium = {
  id: 'chem-equilibrium', subject: 'chem', title: '化学平衡的移动', en: 'Shifting an equilibrium',
  lede: ['针筒里封着红棕色的二氧化氮和无色的四氧化二氮，它们不停地互相转化，正逆反应速率相等时颜色就稳定下来。', '改变温度或压强，平衡被打破，体系会朝着“减弱这种改变”的方向移动。'],
  formula: '2NO₂ ⇌ N₂O₄　ΔH < 0', formulaNote: '红棕色 ⇌ 无色。正反应放热，气体分子数减少',
  terms: [['化学平衡', '正、逆反应速率相等，各组分浓度不再变化。'], ['勒夏特列原理', '平衡向减弱外界改变的方向移动。'], ['ΔH < 0', '正反应是放热反应。']],
  predict: { q: '把这管气体泡进热水里，颜色会怎样？', options: ['变深', '变浅', '不变'], answer: 0, why: '升高温度，平衡向吸热方向移动。生成 N₂O₄ 是放热的，所以平衡向生成 NO₂ 的方向移动，红棕色加深。' },
  challenge: '快速压缩针筒，盯住浓度曲线：它先怎样、后怎样？为什么最终还是比原来深？',
  fig: '密封针筒中的 NO₂–N₂O₄ 平衡体系', hint: '改变温度；再突然改变体积，看曲线。',
  teach: {
    where: '人教版化学 选择性必修 1 · 化学反应速率与化学平衡：影响化学平衡的因素。',
    ask: ['压缩后颜色“先变深后变浅”，两步分别对应什么原因？', '平衡移动能“抵消”外界的改变吗？对比压缩前后最终的 NO₂ 浓度。'],
    simplify: '按理想气体和热力学数据（ΔH = −57.2 kJ/mol，ΔS = −175.8 J/(mol·K)）计算平衡组成，趋向平衡的快慢为示意；画面中的小球数目只代表比例。',
    safety: 'NO₂ 有毒，真实实验必须使用密封装置并在通风橱中操作。',
  },
  controls: [
    { id: 'T', label: '温度', min: 0, max: 100, step: 1, value: 25, unit: '℃' },
    { id: 'V', label: '体积', min: 20, max: 60, step: 1, value: 50, unit: 'mL' },
  ],
  build(k) {
    const p = k.p, X = -2.2, Z = -0.8, R = 1.05, H = 4.3, N = 15;
    const wall = at(group(glass(new THREE.CylinderGeometry(R, R, H, 44, 1, true).translate(0, H / 2, 0))), X, 0.5, Z);
    const tint = liquid(R * 0.96, 1, '#b5561d', 0.3);
    const piston = group(cyl(R * 0.97, 0.22, C.shade), at(cyl(0.12, 2.3), 0, 0.22, 0), at(cyl(0.6, 0.14), 0, 2.5, 0));
    const gas = dots(N * 2, 0.085, '#ffffff', { flat: true });
    wall.add(tint, piston, gas);
    const g = at(plot({ w: 4.1, h: 3.1, xr: [0, 12], yr: [0, 1.6], xl: '时间 / s', yl: 'c(NO₂)（相对）' }), 2.3, 0, -2.4);
    const info = at(card('\n', { w: 3.6, size: 0.32, align: 'left' }), 2.3, 0, 2.3);
    k.root.add(at(cyl(1.3, 0.5), X, 0, Z), wall, g, info);
    const rnd = () => new THREE.Vector3().randomDirection();
    const ps = Array.from({ length: N * 2 }, () => { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * 0.85; return { p: new THREE.Vector3(Math.cos(a) * r, Math.random() * 2, Math.sin(a) * r), v: rnd() }; });
    const alphaEq = () => { const T = p.T + 273.15, K = Math.exp(-(57200 - T * 175.8) / (8.314 * T)), c = 0.6 * (60 / p.V) * (T / 298.15); return (-K + Math.sqrt(K * K + 16 * c * K)) / (8 * c); };
    let a = alphaEq(), tl = 0, acc = 0; const hist = [];
    const conc = () => 2 * a * 60 / p.V;
    const brown = new THREE.Color('#a8501c'), pale = new THREE.Color('#e9dfc6');
    return {
      update(dt) {
        a += (alphaEq() - a) * (1 - Math.exp(-dt / 0.9));
        const hp = 0.3 + (p.V / 60) * (H - 1.0), sp = Math.sqrt((p.T + 273) / 298) * 2.2, nd = Math.round(N * a);
        piston.position.y = hp;
        const c = conc();
        tint.set(hp, mix('#e8d9b0', '#9c4312', c / 1.3)); tint.fade(clamp(0.08 + c * 0.3, 0, 0.6));
        for (let j = 0; j < N; j++) {
          const A = ps[j * 2], B = ps[j * 2 + 1], free = j < nd;
          for (const m of free ? [A, B] : [A]) {
            m.p.addScaledVector(m.v, sp * dt * (free ? 1 : 0.7));
            const rr = Math.hypot(m.p.x, m.p.z);
            if (rr > 0.9) { const nx = m.p.x / rr, nz = m.p.z / rr, d = m.v.x * nx + m.v.z * nz; if (d > 0) { m.v.x -= 2 * d * nx; m.v.z -= 2 * d * nz; } m.p.x = nx * 0.9; m.p.z = nz * 0.9; }
            if (m.p.y < 0.12) { m.p.y = 0.12; m.v.y = Math.abs(m.v.y); }
            if (m.p.y > hp - 0.12) { m.p.y = hp - 0.12; m.v.y = -Math.abs(m.v.y); }
          }
          if (!free) { B.p.copy(A.p).x += 0.15; B.v.copy(rnd()); }
          gas.put(j * 2, A.p.x, A.p.y, A.p.z).paint(j * 2, free ? brown : pale);
          gas.put(j * 2 + 1, B.p.x, B.p.y, B.p.z).paint(j * 2 + 1, free ? brown : pale);
        }
        gas.done();
        tl += dt; acc += dt;
        if (acc > 0.1) {
          acc = 0; hist.push([tl, c]); while (hist.length && hist[0][0] < tl - 12) hist.shift();
          g.clear().curve(hist.map(([t, v]) => [t - (tl - 12), v]), C.flame, 0.045).done();
        }
        info.set(`NO₂ 分子占 ${(2 * a / (1 + a) * 100).toFixed(0)}%\n颜色深浅 ${c.toFixed(2)}`);
        this.a = a;
      },
      margin() {
        const T = p.T + 273.15, K = Math.exp(-(57200 - T * 175.8) / (8.314 * T));
        return [`T = ${p.T} ℃`, `N₂O₄ 分解率`, ` α = ${(this.a * 100 || 0).toFixed(1)}%`, 'N₂O₄ ⇌ 2NO₂ 的', ` Kp ≈ ${K < 10 ? K.toFixed(3) : K.toFixed(1)}`, '棕色球 = NO₂', '浅色成对 = N₂O₄'];
      },
    };
  },
};

// ---------------------------------------------------------------- 反应速率
const rate = {
  id: 'chem-rate', subject: 'chem', title: '影响化学反应速率的因素', en: 'Rates of reaction',
  lede: ['硫代硫酸钠溶液遇到稀硫酸，会慢慢析出淡黄色的硫，溶液变浑，直到看不见杯底的“十”字。', '用秒表记下“十”字消失的时间：时间越短，反应越快。只改一个条件，看它变快还是变慢。'],
  formula: 'Na₂S₂O₃ + H₂SO₄ = Na₂SO₄ + S↓ + SO₂↑ + H₂O', formulaNote: '浓度越大、温度越高，单位时间内有效碰撞越多，反应越快',
  terms: [['反应速率', '单位时间内浓度的变化量。'], ['有效碰撞', '能量足够、取向合适的碰撞。'], ['活化分子', '能量高到足以发生反应的分子。']],
  predict: { q: '其他条件不变，把温度升高 10 ℃，“十”字消失所需的时间大约？', options: ['缩短到原来的一半左右', '只缩短一点点', '延长'], answer: 0, why: '升温使活化分子的比例显著增加。经验上温度每升高 10 ℃，反应速率增大到原来的 2～4 倍，所需时间相应缩短。' },
  challenge: '做 4 组实验，在图上摆出一条“时间–温度”曲线。',
  fig: '烧杯、温度计与杯底的“十”字', hint: '设好温度和浓度，按“混合，开始计时”。',
  teach: {
    where: '人教版化学 选择性必修 1 · 化学反应速率与化学平衡：影响化学反应速率的因素。',
    ask: ['比较温度的影响时，哪些量必须保持不变？', '浓度加倍，时间大约变为原来的多少？这说明速率与浓度大致是什么关系？'],
    simplify: '用经验关系 t ∝ 1/c 和“每升高 10 ℃ 速率加倍”估算时间，画面按 6 倍速播放；真实数据会有偏差。',
    safety: '反应放出 SO₂，真实实验要控制用量并保持通风。',
  },
  controls: [
    { id: 'T', label: '温度', min: 10, max: 50, step: 5, value: 20, unit: '℃' },
    { id: 'c', label: 'c(Na₂S₂O₃)', min: 0.05, max: 0.2, step: 0.01, value: 0.1, unit: 'mol/L' },
    { id: 'go', type: 'button', label: '混合，开始计时' },
  ],
  build(k) {
    const p = k.p, X = -1.9, Z = -0.6;
    const cross = at(note('十', { size: 1.3, lay: 'flat', bold: true }), X, 0.1, Z);
    const bk = at(beaker(1.45, 2.1), X, 0.05, Z), liq = at(liquid(1.36, 1.3, '#f4ecb4', 0.1), X, 0.09, Z);
    const therm = at(jar(0.1, 3.0, C.red, { fill: 0.3, glow: 0.2 }), X + 0.9, 0.3, Z - 0.5);
    const g = at(plot({ w: 4.1, h: 3.1, xr: [10, 50], yr: [0, 170], xl: '温度 / ℃', yl: '时间 / s' }), 2.3, 0, -2.4);
    const info = at(card('\n', { w: 3.6, size: 0.32, align: 'left' }), 2.3, 0, 2.3);
    k.root.add(at(plate(3.6, 3.4), X, 0, Z), cross, bk, liq, therm, g, info);
    const total = () => 40 * (0.1 / p.c) * Math.pow(2, -(p.T - 20) / 10);
    let t = 0, run = false, done = 0; const runs = [];
    const draw = () => { g.clear().fn((T) => 40 * (0.1 / p.c) * Math.pow(2, -(T - 20) / 10), 'rgba(30,43,54,.3)', 0.03, true); runs.forEach((r) => g.dot(r.T, r.t, Math.abs(r.c - p.c) < 0.001 ? C.flame : '#bbb')); g.done(); };
    draw();
    return {
      press() { t = 0; run = true; done = 0; },
      change() { run = false; t = 0; done = 0; draw(); },
      update(dt) {
        const tt = total();
        if (run) { t += dt * 6; if (t >= tt) { t = tt; run = false; done = tt; runs.push({ T: p.T, c: p.c, t: tt }); if (runs.length > 12) runs.shift(); draw(); } }
        const f = clamp(t / tt);
        liq.fade(0.1 + Math.pow(f, 1.4) * 0.88);
        therm.fill(p.T / 60);
        info.set(`秒表 ${t.toFixed(1)} s\n${done ? '“十”字看不见了' : run ? '正在变浑浊…' : '等待混合'}`);
      },
      margin() {
        const out = [`T = ${p.T} ℃`, `c = ${p.c.toFixed(2)} mol/L`, '实验记录：'];
        runs.slice(-4).forEach((r) => out.push(`${r.T}℃ ${r.c.toFixed(2)} → ${r.t.toFixed(0)} s`));
        if (!runs.length) out.push('（还没有数据）');
        return out;
      },
    };
  },
};

// ---------------------------------------------------------------- 焰色试验
const SALTS = [
  ['钠 Na', '#ffc31f', '黄色', [589]], ['钾 K（含钠杂质）', '#ffcf55', '黄色（紫色被掩盖）', [404, 589, 694]], ['锂 Li', '#ff3d6e', '紫红色', [610, 671]],
  ['钙 Ca', '#ff6a2e', '砖红色', [423, 554, 622]], ['锶 Sr', '#ff2f4c', '洋红色', [461, 606, 650, 680]], ['钡 Ba', '#bfee4d', '黄绿色', [493, 524, 554]], ['铜 Cu', '#35e08c', '绿色', [440, 515, 535, 550]],
];
const flame = {
  id: 'chem-flame', subject: 'chem', title: '焰色试验', en: 'Flame tests',
  lede: ['用铂丝蘸一点盐溶液伸进火焰，火焰立刻染上颜色。钠是黄的，铜是绿的，锶是洋红的。', '颜色来自金属原子：电子被加热“抬”到高处，落回来时放出特定波长的光。烟花的颜色就是这么来的。'],
  formula: 'ΔE = h ν', formulaNote: '电子在两个能级之间跃迁，放出的光的频率由能量差决定',
  terms: [['焰色', '金属元素在灼烧时使火焰呈现的特征颜色。'], ['物理变化', '焰色试验没有生成新物质。'], ['蓝色钴玻璃', '滤去钠的黄光，用来观察钾的紫色。']],
  predict: { q: '钾盐里常混有微量的钠，火焰看起来是黄色。怎样才能看到钾的紫色？', options: ['把火烧得更旺', '透过蓝色钴玻璃观察', '多蘸一些样品'], answer: 1, why: '钠的黄光非常强，会掩盖钾较弱的紫光。蓝色钴玻璃能吸收黄光、让紫光通过，于是紫色就显现出来。' },
  challenge: '不看标签：火焰是砖红色的，里面是哪种金属？',
  fig: '酒精喷灯、铂丝与火焰（下方为示意光谱）', hint: '换一种盐；再架上蓝色钴玻璃。',
  teach: {
    where: '人教版化学 必修第一册 · 海水中的重要元素——钠和氯：焰色试验；选择性必修 2 · 原子结构：原子光谱。',
    ask: ['焰色试验是物理变化还是化学变化？依据是什么？', '每次试验前为什么要用盐酸洗铂丝并灼烧至无色？'],
    simplify: '火焰颜色与谱线位置均为示意（只画了几条主要谱线和谱带），屏幕颜色与真实焰色会有差别。',
    safety: '真实实验注意明火安全；观察钾的焰色须透过蓝色钴玻璃。',
  },
  controls: [
    { id: 'salt', type: 'choice', label: '', options: SALTS.map((s) => s[0]), value: 0, wide: true },
    { id: 'co', type: 'toggle', label: '蓝色钴玻璃', value: false },
  ],
  build(k) {
    const p = k.p, X = -1.4, Z = -0.6;
    k.root.add(at(cyl(0.9, 0.3), X, 0, Z), at(cyl(0.22, 1.9), X, 0.3, Z), at(cyl(0.34, 0.3, C.shade), X, 0.7, Z));
    const outer = flat(new THREE.ConeGeometry(0.42, 1.9, 24, 6, true).translate(0, 0.95, 0), C.amber, { opacity: 0.8 });
    const core = flat(new THREE.ConeGeometry(0.2, 1.0, 20, 1, true).translate(0, 0.5, 0), '#cfe6ff', { opacity: 0.85 });
    const halo = glow(C.amber, 4.2, 0.55);
    const fl = at(group(outer, core, at(halo, 0, 1, 0)), X, 2.2, Z);
    const loop = group(rod([0.35, 3.0, 0.2], [2.6, 1.9, 1.6], 0.03, C.metal), rod([2.6, 1.9, 1.6], [3.6, 1.4, 2.2], 0.09, C.paper));
    loop.position.set(X, 0, Z);
    const co = at(flat(new THREE.PlaneGeometry(2.4, 2.8), '#2b4fd6', { opacity: 0.5 }), X, 3.2, Z + 1.3);
    const coFrame = at(group(rod([-1.25, 0, 0], [-1.25, 4.7, 0], 0.05), rod([1.25, 0, 0], [1.25, 4.7, 0], 0.05)), X, 0, Z + 1.3);
    const spec = at(sheet(4.2, 1.0, () => {}, { opaque: true, ink: true, lay: 'tilt' }), 2.4, 0, -2.6);
    const info = at(card('\n', { w: 4.2, size: 0.32, align: 'left' }), 2.4, 0, 2.2);
    k.root.add(fl, loop, co, coFrame, spec, info, at(note('400            波长 / nm            700', { size: 0.24 }), 2.4, 1.05, -3.3));
    let last = '';
    return {
      update(dt, t) {
        const s = SALTS[p.salt], isK = p.salt === 1, isNa = p.salt === 0;
        const col = p.co ? (isK ? new THREE.Color('#b88cff') : isNa ? new THREE.Color('#2a3a7a') : mix(s[1], '#3040b0', 0.55)) : new THREE.Color(s[1]);
        outer.material.color.copy(col); halo.material.color.copy(col);
        halo.material.opacity = p.co && isNa ? 0.12 : 0.55;
        fl.scale.set(1 + Math.sin(t * 13) * 0.06, 1 + Math.sin(t * 9.1) * 0.07 + Math.sin(t * 23) * 0.03, 1 + Math.cos(t * 11) * 0.06);
        co.visible = coFrame.visible = p.co;
        const key = `${p.salt}|${p.co}`;
        if (key !== last) {
          last = key;
          spec.redraw((x, S, w, h) => {
            x.fillStyle = '#14171c'; x.fillRect(0, 0, w * S, h * S);
            s[3].forEach((nm) => {
              if (p.co && nm > 500 && nm < 660) return;
              const c = wavelength(nm), px = ((nm - 400) / 300) * w * S;
              x.fillStyle = `rgb(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0})`; x.fillRect(px - S * 0.03, h * S * 0.12, S * 0.06, h * S * 0.76);
            });
          });
        }
        info.set(p.co ? (isK ? '透过钴玻璃：紫色\n这才是钾的焰色' : isNa ? '透过钴玻璃：几乎看不见\n黄光被吸收了' : `透过钴玻璃观察\n（${s[2]}被部分滤去）`) : `焰色：${s[2]}\n${s[0].split('（')[0]}`);
      },
      margin: () => ['常见焰色', '钠 黄　钾 紫', '锂 紫红　钙 砖红', '锶 洋红　钡 黄绿', '铜 绿', '操作口诀：', '洗、烧、蘸、烧、洗'],
    };
  },
};

// ---------------------------------------------------------------- 电解水
const electrolysis = {
  id: 'chem-electrolysis', subject: 'chem', title: '电解水', en: 'Electrolysis of water',
  lede: ['给水通上直流电，两根电极上都冒出气泡，把它们分别收集在倒扣的试管里。', '一根试管里的气体总是另一根的两倍。这个 2 : 1，就是水的化学式 H₂O 留在试管里的签名。'],
  formula: '2H₂O ═ 2H₂↑ + O₂↑（通电）', formulaNote: '阴极：2H₂O + 2e⁻ = H₂↑ + 2OH⁻　阳极：2H₂O − 4e⁻ = O₂↑ + 4H⁺',
  terms: [['阴极', '与电源负极相连，发生还原反应。'], ['阳极', '与电源正极相连，发生氧化反应。'], ['电解', '电流通过电解质溶液引起氧化还原反应。']],
  predict: { q: '与电源负极相连的试管里收集到的是什么气体？体积比另一管？', options: ['氧气，体积是另一管的 2 倍', '氢气，体积是另一管的 2 倍', '氢气，体积是另一管的一半'], answer: 1, why: '阴极得电子，H 元素被还原成氢气。每转移 4 mol 电子生成 2 mol H₂ 和 1 mol O₂，所以氢气体积是氧气的 2 倍。' },
  challenge: '收集满 20 mL 氢气，电路里一共通过了多少摩尔电子？',
  fig: '水槽、两支倒扣的试管与直流电源', hint: '调电流，看两边液面下降的快慢。',
  teach: {
    where: '人教版化学 选择性必修 1 · 化学反应与电能：电解池；初中化学：水的组成。',
    ask: ['电流加倍，产生气体的速率怎样变化？依据是哪条定律？', '实验中常加少量硫酸钠或氢氧化钠，目的是什么？它们被消耗了吗？'],
    simplify: '按法拉第定律和 25 ℃、101 kPa 下的气体摩尔体积（24.5 L/mol）计算，画面按 8 倍速播放；不考虑气体溶解，所以比值严格为 2 : 1（真实实验中氧气略偏少）。',
  },
  controls: [
    { id: 'I', label: '电流 I', min: 0.2, max: 2, step: 0.1, value: 1, unit: 'A' },
    { id: 'on', type: 'toggle', label: '电源', value: true },
    { id: 'reset', type: 'button', label: '重来' },
  ],
  build(k) {
    const p = k.p, Z = -0.6, H = 3.6, CAP = 20;
    k.root.add(at(glass(new THREE.BoxGeometry(5, 1.5, 2.4).translate(0, 0.75, 0)), 0, 0.02, Z), at(flat(new THREE.BoxGeometry(4.9, 1.1, 2.3).translate(0, 0.55, 0), '#cfe6ff', { opacity: 0.4 }), 0, 0.04, Z));
    const mkTube = (x) => {
      const g = at(group(glass(new THREE.CylinderGeometry(0.42, 0.42, H, 32, 1, true).translate(0, H / 2, 0)), glass(new THREE.SphereGeometry(0.42, 24, 12, 0, TAU, 0, Math.PI / 2).translate(0, H, 0))), x, 0.5, Z);
      const col = liquid(0.39, H, '#cfe6ff', 0.45); g.add(col);
      g.add(at(cyl(0.08, 0.9, '#8f989e'), 0, -0.3, 0));
      return { g, col, bub: bubbler(14, { x, z: Z, rad: 0.2, y0: 1.1, r: 0.05, speed: 1.4 }) };
    };
    const neg = mkTube(-1.1), pos = mkTube(1.1);
    const bat = at(group(box(1.6, 0.9, 0.9, C.shade), at(note('直流电源', { size: 0.24 }), 0, 0.5, 0.46)), 0, 0, 2.2);
    const info = at(card('\n\n', { w: 3.2, size: 0.3, align: 'left' }), -3.0, 0, 2.5);
    k.root.add(neg.g, pos.g, neg.bub, pos.bub, bat, info, tube([[-0.6, 0.5, 2.2], [-2.2, 0.08, 1.6], [-2.9, 0.08, Z], [-2.2, 0.6, Z], [-1.1, 0.25, Z]], 0.035, C.ink), tube([[0.6, 0.5, 2.2], [2.2, 0.08, 1.6], [2.9, 0.08, Z], [2.2, 0.6, Z], [1.1, 0.25, Z]], 0.035, C.red),
      at(note('− 阴极', { size: 0.3 }), -1.1, H + 1.5, Z), at(note('+ 阳极', { size: 0.3 }), 1.1, H + 1.5, Z));
    let q = 0, t = 0;
    return {
      press() { q = 0; t = 0; },
      update(dt) {
        const vH = () => q / 96485 / 2 * 24500;
        const run = p.on && vH() < CAP;
        if (run) { q += p.I * dt * 8; t += dt * 8; }
        const h2 = Math.min(CAP, vH()), o2 = h2 / 2;
        neg.col.set(H * (1 - h2 / CAP * 0.92)); pos.col.set(H * (1 - o2 / CAP * 0.92));
        neg.bub.step(dt, run ? p.I * 9 : 0, 0.5 + H * (1 - h2 / CAP * 0.92)); pos.bub.step(dt, run ? p.I * 4.5 : 0, 0.5 + H * (1 - o2 / CAP * 0.92));
        info.set(`氢气 ${h2.toFixed(1)} mL\n氧气 ${o2.toFixed(1)} mL\n通电 ${t.toFixed(0)} s`);
        this.s = { q, h2 };
      },
      margin() {
        const s = this.s || { q: 0, h2: 0 }, ne = s.q / 96485;
        return ['Q = It', ` = ${s.q.toFixed(0)} C`, 'n(e⁻) = Q/F', ` = ${(ne * 1000).toFixed(2)} mmol`, `n(H₂) = n(e⁻)/2`, ` = ${(ne * 500).toFixed(2)} mmol`, `V(H₂):V(O₂) = 2:1`];
      },
    };
  },
};

export default [titration, cell, equilibrium, rate, flame, electrolysis];
