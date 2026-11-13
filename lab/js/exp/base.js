// 高一基础页：力的合成（物理必修 1）、配制一定物质的量浓度的溶液（化学必修 1）、函数的单调性与奇偶性（数学必修 1）
import { C, TAU, clamp, lerp, group, at, rot, box, cyl, ball, rod, wire, arrow, strip, note, card, sheet, flat, lathe, vessel, solid, torus, THREE } from '../ink.js';

const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const gauss = (r) => Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(TAU * r());
const STEEL = '#cfd6dc';

// ================================================================ 力的合成
const forces = {
  id: 'phy-forces', subject: 'phy', title: '探究两个互成角度的力的合成规律', en: 'Adding two forces at an angle',
  lede: ['橡皮条一端钉在木板上，另一端的小圆环被两只弹簧测力计拉到 O 点。换成一只测力计，也把圆环拉到同一个 O 点——两次的作用效果相同。', '把三个力按同一标度画在纸上：以 F₁、F₂ 为邻边作平行四边形，它的对角线和那一个力 F′ 重合吗？'],
  formula: 'F = F₁ + F₂（矢量和）', formulaNote: '合力的大小 F = √(F₁² + F₂² + 2F₁F₂cosθ)；方向沿平行四边形的对角线',
  terms: [['等效替代', '一个力产生的效果与几个力共同的效果相同，就可以互相替代。'], ['力的图示', '用带标度的有向线段表示力的大小、方向和作用点。'], ['平行四边形定则', '以两个分力为邻边作平行四边形，对角线表示合力。']],
  predict: { q: '保持两个分力的大小不变，把夹角从 60° 拉大到 120°，合力会怎样？', options: ['变大', '变小', '不变，合力总等于两力之和'], answer: 1, why: '两个力越“对着干”，合起来越小。夹角 0° 时合力是两力之和，180° 时是两力之差；夹角越大合力越小。力是矢量，不能直接把大小相加。' },
  challenge: '让 F₁ = F₂ = 3 N，找到合力也恰好是 3 N 的夹角。',
  fig: '木板与白纸、橡皮条、圆环、两只弹簧测力计；纸上是力的图示', hint: '调两个力和夹角，再换成“一只测力计”比较 F 与 F′。',
  teach: {
    ask: ['图上哪一个力一定沿橡皮条 AO 的方向：作图得到的 F，还是一只测力计测出的 F′？为什么？', '为什么两次都必须把圆环拉到同一个 O 点？', '测力计没有与木板平行，读数会偏大还是偏小？'],
    simplify: '橡皮条按胡克定律伸长，圆环位置 O 由合力决定。测力计读数叠加了约 ±0.05 N 的读数误差，记录方向时叠加约 ±1° 的描点误差，所以作图得到的 F 与实测的 F′ 一般不会完全重合——真实实验也是如此。不模拟测力计自重、摩擦和不共面带来的误差。',
    safety: '弹簧测力计不要超量程；拉力方向要与木板平行。',
  },
  controls: [
    { id: 'f1', label: 'F₁', min: 1, max: 4, step: 0.1, value: 3, unit: 'N' },
    { id: 'f2', label: 'F₂', min: 1, max: 4, step: 0.1, value: 2.5, unit: 'N' },
    { id: 'th', label: '夹角 θ', min: 20, max: 160, step: 1, value: 70, unit: '°' },
    { id: 'mode', type: 'choice', label: '用', options: ['两只测力计', '一只测力计'], value: 0 },
    { id: 'log', type: 'button', label: '作图并记录' },
  ],
  record: {
    note: '先用两只测力计记下 F₁、F₂ 的大小和方向，再用一只测力计拉到同一 O 点记下 F′。按“作图并记录”把这一组记成一行。',
    pending: '按页面上的“作图并记录”。',
    columns: [
      { key: 'f1', label: 'F₁', unit: 'N', digits: 1 }, { key: 'f2', label: 'F₂', unit: 'N', digits: 1 }, { key: 'th', label: 'θ', unit: '°', digits: 0 },
      { key: 'f', label: 'F（作图）', unit: 'N', digits: 2 }, { key: 'fm', label: 'F′（实测）', unit: 'N', digits: 2 }, { key: 'dev', label: '大小偏差', unit: '%', digits: 1, stat: true }, { key: 'ang', label: '方向偏差', unit: '°', digits: 1, stat: true },
    ],
    sample: (inst) => inst.take?.(),
    errors: ['测力计读数：最小分度 0.1 N，估读有 ±0.05 N 的出入。', '描点定方向：两点离得太近，方向就画不准。', '测力计外壳与纸面摩擦、拉力不与木板平行。', '两次没有把圆环拉到同一个 O 点。'],
  },
  build(k) {
    const p = k.p, Z0 = -3.0, Y = 0.34, U = 0.72, K = 0.42, L0 = 1.3, rand = rng(7);       // U：每牛顿的图示长度
    k.root.add(at(box(8.6, 0.24, 7.4, '#ead9b8'), 0, 0, 0.3), at(box(7.8, 0.03, 6.6, '#ffffff'), 0, 0.24, 0.3));
    for (const [x, z] of [[-3.7, -2.8], [3.7, -2.8], [-3.7, 3.4], [3.7, 3.4]]) k.root.add(at(cyl(0.09, 0.05, '#d9b36a', { seg: 14 }), x, 0.27, z));
    const A = [0, Y, Z0];
    k.root.add(at(cyl(0.07, 0.22, STEEL, { seg: 12 }), 0, 0.27, Z0), at(note('A', { size: 0.3, lay: 'flat', italic: true }), -0.35, 0.29, Z0));
    const band = strip(2, { color: '#b4653a', w: 0.1, normal: [0, 1, 0] });
    const ring = at(rot(torus(0.13, 0.03, STEEL), 0, 0, 0), 0, Y, 0);
    const oTag = note('O', { size: 0.3, lay: 'flat', italic: true });
    const mkScale = () => {
      const g = group(at(box(0.5, 0.16, 1.7, '#ffffff'), 0, 0, 1.45), at(box(0.34, 0.03, 1.2, '#f3ead6'), 0, 0.16, 1.45), at(rot(torus(0.12, 0.025, STEEL), 0, 0, 0), 0, 0.08, 2.42));
      const pointer = at(flat(new THREE.BoxGeometry(0.3, 0.02, 0.04), C.red), 0, 0.2, 1.0), str = wire([0, 0.08, 0], [0, 0.08, 0.6], 0.016);
      g.add(pointer, str); g.pointer = pointer;
      return g;
    };
    const s1 = mkScale(), s2 = mkScale(), s3 = mkScale();
    const a1 = arrow(C.violet, 0.035), a2 = arrow(C.sky, 0.035), aF = arrow(C.copper, 0.04), aM = arrow(C.leaf, 0.04);
    const para = strip(3, { color: C.ink, w: 0.022, opacity: 0.5, normal: [0, 1, 0] });
    const t1 = note('F₁', { size: 0.3, lay: 'flat', color: C.violet }), t2 = note('F₂', { size: 0.3, lay: 'flat', color: C.sky }), tF = note('F', { size: 0.3, lay: 'flat', color: C.copper }), tM = note("F′", { size: 0.3, lay: 'flat', color: C.leaf });
    const info = at(card('\n\n', { w: 4.4, size: 0.28, align: 'left' }), 2.2, 0.24, 3.3);
    k.root.add(band, ring, oTag, s1, s2, s3, a1, a2, aF, aM, para, t1, t2, tF, tM, info);
    let drawn = null, key = '';
    const place = (s, O, ang, f) => { s.position.set(O[0], Y - 0.06, O[2]); s.rotation.y = ang; s.pointer.position.z = 1.0 + f * 0.2; };
    const state = () => {
      const th = p.th * Math.PI / 180, F = Math.sqrt(p.f1 ** 2 + p.f2 ** 2 + 2 * p.f1 * p.f2 * Math.cos(th));
      const al1 = Math.atan2(p.f2 * Math.sin(th), p.f1 + p.f2 * Math.cos(th)), al2 = th - al1;
      return { th, F, al1, al2, O: [0, Y, Z0 + L0 + F * K] };
    };
    return {
      press() { this.take(true); },
      /** 把这一组“读数 + 描点”画成力的图示：读数和方向都带一点真实的出入 */
      take(push) {
        const s = state();
        const r1 = Math.round((p.f1 + gauss(rand) * 0.04) * 20) / 20, r2 = Math.round((p.f2 + gauss(rand) * 0.04) * 20) / 20;
        const d1 = s.al1 + gauss(rand) * 0.017, d2 = s.al2 + gauss(rand) * 0.017;
        const fx = -r1 * Math.sin(d1) + r2 * Math.sin(d2), fz = r1 * Math.cos(d1) + r2 * Math.cos(d2);
        const f = Math.hypot(fx, fz), fm = Math.round((s.F + gauss(rand) * 0.04) * 20) / 20;
        drawn = { r1, r2, d1, d2, fx, fz, f, fm };
        const row = { f1: r1, f2: r2, th: p.th, f, fm, dev: Math.abs(f - fm) / fm * 100, ang: Math.abs(Math.atan2(fx, fz)) * 180 / Math.PI };
        if (push) k.record(row);
        return push ? null : row;
      },
      update() {
        const s = state(), O = s.O, kk = `${p.f1}|${p.f2}|${p.th}`;
        if (kk !== key) { key = kk; drawn = null; }
        band.set([A, O]); ring.position.set(O[0], Y, O[2]); oTag.position.set(O[0] + 0.4, 0.29, O[2] - 0.1);
        const two = p.mode === 0;
        s1.visible = s2.visible = two; s3.visible = !two;
        place(s1, O, -s.al1, p.f1); place(s2, O, s.al2, p.f2); place(s3, O, 0, s.F);
        const tip = (f, a) => [O[0] + Math.sin(a) * f * U, 0.3, O[2] + Math.cos(a) * f * U];
        const o = [O[0], 0.3, O[2]];
        const g1 = drawn ? tip(drawn.r1, -drawn.d1) : tip(p.f1, -s.al1), g2 = drawn ? tip(drawn.r2, drawn.d2) : tip(p.f2, s.al2);
        a1.set(o, g1); a2.set(o, g2); t1.position.set(g1[0] - 0.35, 0.3, g1[2] + 0.2); t2.position.set(g2[0] + 0.35, 0.3, g2[2] + 0.2);
        const gF = [g1[0] + g2[0] - o[0], 0.3, g1[2] + g2[2] - o[2]];
        aF.visible = para.visible = tF.visible = !!drawn; aM.visible = tM.visible = !!drawn;
        if (drawn) {
          aF.set(o, gF); para.set([g1, gF, g2]); tF.position.set(gF[0] - 0.4, 0.3, gF[2] + 0.3);
          const gM = tip(drawn.fm, 0); aM.set([o[0] + 0.06, 0.3, o[2]], [gM[0] + 0.06, 0.3, gM[2]]); tM.position.set(gM[0] + 0.5, 0.3, gM[2] + 0.3);
        }
        info.set(drawn ? `读数 F₁ = ${drawn.r1.toFixed(2)} N，F₂ = ${drawn.r2.toFixed(2)} N\n作图 F = ${drawn.f.toFixed(2)} N，实测 F′ = ${drawn.fm.toFixed(2)} N\n相差 ${(Math.abs(drawn.f - drawn.fm) / drawn.fm * 100).toFixed(1)}%，在误差范围内重合` : `${two ? '两只测力计把圆环拉到 O' : '一只测力计拉到同一个 O'}\n${two ? `F₁ = ${p.f1.toFixed(1)} N，F₂ = ${p.f2.toFixed(1)} N` : `F′ ≈ ${s.F.toFixed(2)} N`}\n按“作图并记录”画出力的图示`);
        this.s = s;
      },
      margin() {
        const s = this.s || state();
        return ['F² = F₁² + F₂²', '   + 2F₁F₂cosθ', `F = ${s.F.toFixed(2)} N`, `|F₁−F₂| = ${Math.abs(p.f1 - p.f2).toFixed(1)} N`, `F₁+F₂ = ${(p.f1 + p.f2).toFixed(1)} N`, '合力总在这两者之间'];
      },
    };
  },
};

// ================================================================ 配制一定物质的量浓度的溶液
const STEPS = ['计算', '称量', '溶解', '转移', '洗涤', '定容', '摇匀'];
const molarity = {
  id: 'chem-molarity', subject: 'chem', title: '配制一定物质的量浓度的溶液', en: 'Preparing a solution of known molarity',
  lede: ['要配 100 mL 一定浓度的氯化钠溶液：算出质量，称量，在烧杯里溶解，转移进 100 mL 容量瓶，洗涤烧杯和玻璃棒，最后加水到刻度线。', '容量瓶只有一条刻度线。溶质一点不能少，体积一点不能多——每一步的小动作都会改变最后的浓度。'],
  formula: 'c = n / V = m / (M·V)', formulaNote: '物质的量浓度 = 溶质的物质的量 ÷ 溶液的体积；NaCl 的 M = 58.5 g/mol',
  terms: [['容量瓶', '在标定温度下，液面与刻度线相切时容积恰为标称值。'], ['定容', '加水至离刻度线 1～2 cm，改用胶头滴管滴到凹液面与刻度线相切。'], ['洗涤', '用少量蒸馏水洗烧杯和玻璃棒 2～3 次，洗涤液都转入容量瓶。']],
  predict: { q: '定容时仰视刻度线（眼睛比刻度线低），配出的溶液浓度会怎样？', options: ['偏大', '偏小', '没有影响'], answer: 1, why: '仰视时，看上去液面已经“到线”，实际凹液面还在刻度线上方——水加多了。溶质没变而体积偏大，浓度就偏小。俯视则相反。' },
  challenge: '配出与目标值相差不到 1% 的溶液；再故意做错一步，看偏差往哪边走。',
  fig: '电子天平、烧杯与玻璃棒、100 mL 容量瓶；右：刻度线附近的放大', hint: '选好做法，按“下一步”走完七步，看最后的实际浓度。',
  teach: {
    ask: ['转移后没有洗涤烧杯，浓度偏大还是偏小？为什么？', '摇匀后发现液面低于刻度线，能不能再加水补到刻度线？', '为什么不能直接在容量瓶里溶解固体？'],
    simplify: '称量按 0.1 g 的天平读数取整（真实实验用托盘天平或电子天平）；不洗涤按损失 3% 溶质计，仰视、俯视按多加或少加约 1.2 mL 水计，数值是示意量级。不模拟溶解放热、温度对体积的影响和转移时的洒落。',
    safety: '容量瓶使用前要检查是否漏水；不能在容量瓶中溶解、稀释或长期存放溶液。',
  },
  controls: [
    { id: 'c', label: '目标浓度', min: 0.5, max: 2, step: 0.1, value: 1, unit: 'mol/L' },
    { id: 'eye', type: 'choice', label: '定容视线', options: ['平视', '仰视', '俯视'], value: 0 },
    { id: 'wash', type: 'choice', label: '洗涤', options: ['洗 3 次', '不洗'], value: 0 },
    { id: 'next', type: 'button', label: '下一步' }, { id: 'reset', type: 'button', label: '重来' },
  ],
  record: {
    note: '走完七步后，把这一次的做法和结果记成一行。换一种做法再配一次，比较偏差的方向。',
    pending: '还没配完：先按“下一步”走到“摇匀”。',
    columns: [
      { key: 'c0', label: '目标 c', unit: 'mol/L', digits: 2 }, { key: 'm', label: 'm(NaCl)', unit: 'g', digits: 1 }, { key: 'eye', label: '视线' }, { key: 'wash', label: '洗涤' },
      { key: 'v', label: 'V', unit: 'mL', digits: 1 }, { key: 'c', label: '实际 c', unit: 'mol/L', digits: 3 }, { key: 'err', label: '相对偏差', unit: '%', digits: 1 },
    ],
    sample: (inst) => inst.result?.(),
    errors: ['称量：天平只读到 0.1 g，取整带来的偏差随质量减小而变明显。', '转移后不洗涤：溶质留在烧杯里，n 偏小，c 偏小。', '定容仰视：V 偏大，c 偏小；俯视：V 偏小，c 偏大。', '摇匀后再补水：V 偏大，c 偏小。'],
  },
  build(k) {
    const p = k.p, FX = 0.2, FZ = -1.0, MARK = 2.95;
    // 电子天平
    const bal = at(group(box(2.2, 0.36, 1.9, '#ffffff'), at(cyl(0.72, 0.05, STEEL, { seg: 40 }), 0, 0.42, -0.2), at(cyl(0.12, 0.08, STEEL, { seg: 16 }), 0, 0.36, -0.2)), -3.1, 0, -2.6);
    const read = at(card('0.0 g', { w: 1.3, size: 0.3, lay: 'up' }), -3.1, 0.02, -1.5); read.rotation.x = -1.15;
    const salt = at(lathe([[0, 0], [0.42, 0], [0.3, 0.14], [0, 0.2]], '#ffffff', { seg: 20 }), -3.1, 0.47, -2.8);
    // 烧杯 + 玻璃棒
    const beaker = at(vessel([[0, 0], [0.72, 0], [0.75, 0.06], [0.75, 1.5], [0.8, 1.56]], { color: '#dff0ff', opacity: 0.45, wall: 0.035 }), -3.0, 0.02, 1.0);
    const stick = rod([-3.25, 0.1, 1.0], [-2.55, 2.4, 0.8], 0.035, '#eef4f2');
    // 容量瓶：梨形瓶身、细长颈、一条刻度线、磨口塞
    const flask = at(vessel([[0, 0], [0.78, 0], [1.02, 0.2], [1.1, 0.72], [0.92, 1.3], [0.36, 1.82], [0.17, 2.05], [0.17, 3.7], [0.23, 3.8]], { color: '#dff0ff', opacity: 0.45, wall: 0.035 }), FX, 0.02, FZ);
    const mark = at(rot(torus(0.212, 0.012, C.red), 0, 0, 0), FX, 0.02 + MARK, FZ);
    const stopper = at(lathe([[0, 0], [0.15, 0], [0.2, 0.3], [0.32, 0.34], [0.32, 0.5], [0, 0.5]], '#eef4f2', { kind: 'ceramic', seg: 20 }), FX, 3.7, FZ);
    const pour = strip(12, { color: '#9fd0ff', w: 0.07, opacity: 0.7 }); pour.visible = false;
    // 刻度线放大
    let lv = -9, eye = -1;
    const lens = at(sheet(2.3, 2.3, () => {}, { lay: 'tilt' }), 2.9, 0, 1.3);
    const ring = at(rot(torus(1.1, 0.045, '#d9b36a'), Math.PI / 2 - 0.8, 0, 0), 2.9, Math.cos(0.8) * 1.15, 1.3 - Math.sin(0.8) * 1.15);
    const drawLens = (dv, e) => lens.redraw((x, s, w, h) => {
      const c = w / 2 * s, r = 1.06 * s, x0 = c - 0.36 * s, x1 = c + 0.36 * s, ym = c, yl = ym - dv * 0.3 * s;   // 每 mL 0.3 单位
      x.save(); x.beginPath(); x.arc(c, c, r, 0, TAU); x.clip();
      x.fillStyle = '#fffdf6'; x.fillRect(0, 0, w * s, h * s);
      x.fillStyle = 'rgba(120,180,240,.45)'; x.beginPath(); x.moveTo(x0, yl - 0.07 * s); x.quadraticCurveTo(c, yl + 0.07 * s, x1, yl - 0.07 * s); x.lineTo(x1, h * s); x.lineTo(x0, h * s); x.closePath(); x.fill();
      x.strokeStyle = C.ink; x.lineWidth = s * 0.022; x.beginPath(); x.moveTo(x0, 0); x.lineTo(x0, h * s); x.moveTo(x1, 0); x.lineTo(x1, h * s); x.stroke();
      x.strokeStyle = C.red; x.lineWidth = s * 0.026; x.beginPath(); x.moveTo(x0, ym); x.lineTo(x1, ym); x.stroke();
      // 视线：平视过刻度线水平；仰视从下往上、俯视从上往下，都穿过刻度线看到“相切”
      const slope = [0, -0.5, 0.5][e];
      x.setLineDash([s * 0.05, s * 0.04]); x.strokeStyle = C.copper; x.lineWidth = s * 0.016;
      x.beginPath(); x.moveTo(c - r, ym - slope * (-r - 0.36 * s + c - c)); x.moveTo(c - r, ym + slope * (r - 0.36 * s)); x.lineTo(x0, ym); x.lineTo(c, ym - slope * 0.36 * s); x.stroke(); x.setLineDash([]);
      x.fillStyle = C.copper; x.font = `italic ${s * 0.13}px Georgia,serif`; x.fillText(['平视', '仰视', '俯视'][e], c - r + 0.1 * s, ym + slope * (r - 0.36 * s) + (slope > 0 ? 0.16 : -0.08) * s);
      x.restore();
    });
    const info = at(card('\n\n', { w: 4.6, size: 0.27, align: 'left' }), 1.4, 0, 3.6);
    k.root.add(bal, read, salt, beaker, stick, flask, mark, stopper, pour, lens, ring, info);
    let step = 0, t = 1, shake = 0;
    const calc = () => {
      const m = Math.round(p.c * 0.1 * 58.5 * 10) / 10, n = m / 58.5 * (p.wash ? 0.97 : 1), dv = [0, 1.2, -1.2][p.eye], v = 100 + dv;
      return { m, n, dv, v, c: n / (v / 1000) };
    };
    return {
      press(id) { if (id === 'reset') { step = 0; t = 1; } else if (t >= 1) { step = step >= 7 ? 1 : step + 1; t = 0; } },
      change() { if (step >= 6) { step = 5; t = 1; } },
      result() { if (step < 7 || t < 1) return null; const r = calc(); return { c0: p.c, m: r.m, eye: ['平视', '仰视', '俯视'][p.eye], wash: p.wash ? '不洗' : '洗 3 次', v: r.v, c: r.c, err: (r.c - p.c) / p.c * 100 }; },
      update(dt) {
        if (t < 1) t = Math.min(1, t + dt / 1.4);
        const e = t * t * (3 - 2 * t), r = calc(), on = (s) => (step === s ? e : step > s ? 1 : 0);
        read.set(`${(r.m * on(2)).toFixed(1)} g`);
        salt.visible = step >= 2 && step < 3 || (step === 3 && e < 0.3); salt.scale.setScalar(0.4 + 0.6 * on(2));
        // 烧杯里的溶液：溶解时出现，转移、洗涤后倒空
        const inBeaker = on(3) * (1 - on(4)) * 0.75 + (step === 5 ? Math.sin(e * Math.PI) * 0.25 : 0);
        beaker.fill(inBeaker); stick.visible = step >= 3 && step <= 5;
        // 容量瓶液面：转移到瓶身一半多，洗涤液再加一点，定容到刻度线（或因视线而偏离）
        const washAdd = p.wash ? 0 : 0.35;
        const level = 0.02 + on(4) * 1.25 + on(5) * washAdd + on(6) * (MARK - 1.25 - washAdd + r.dv * 0.3);
        flask.fill(level);
        pour.visible = (step === 4 || (step === 5 && !p.wash) || step === 6) && t < 0.92;
        if (pour.visible) { const pts = []; for (let i = 0; i < 12; i++) { const u = i / 11; pts.push([lerp(-1.4, FX, u), 4.6 - u * u * (4.6 - level - 0.02) + Math.sin(u * 3.1) * 0.5, lerp(0.4, FZ, u)]); } pour.set(pts); }
        stopper.visible = step >= 7 || step === 0;
        shake = step === 7 && t < 1 ? Math.sin(e * TAU * 3) * 0.5 * (1 - e) : 0;
        flask.rotation.z = shake; stopper.rotation.z = shake; mark.rotation.z = shake;
        stopper.position.set(FX - Math.sin(shake) * 3.7, 0.02 + Math.cos(shake) * 3.68, FZ); mark.position.set(FX - Math.sin(shake) * MARK, 0.02 + Math.cos(shake) * MARK, FZ);
        const dvNow = step >= 6 ? lerp(-5, r.dv, on(6)) : -5;
        if (Math.abs(dvNow - lv) > 0.02 || eye !== p.eye) { lv = dvNow; eye = p.eye; drawLens(dvNow, p.eye); }
        const done = step === 7 && t >= 1;
        info.set(step === 0 ? `要配 100 mL ${p.c.toFixed(1)} mol/L 的 NaCl 溶液\n按“下一步”开始：${STEPS.join(' → ')}` : `第 ${step} 步 / 共 7 步 · ${STEPS[step - 1]}\n${['n = cV，m = nM', `称取 ${r.m.toFixed(1)} g NaCl`, '在烧杯中加水，玻璃棒搅拌溶解', '沿玻璃棒引流，转入容量瓶', p.wash ? '（跳过洗涤：溶质留在烧杯里）' : '洗烧杯和玻璃棒，洗涤液也转入', `加水到刻度线（${['平视', '仰视', '俯视'][p.eye]}）`, '盖好瓶塞，上下颠倒摇匀'][step - 1]}\n${done ? `实际浓度 ${r.c.toFixed(3)} mol/L，${Math.abs(r.c - p.c) / p.c < 0.01 ? '合格' : r.c > p.c ? '偏大' : '偏小'}` : ''}`);
        this.r = r; this.done = done;
      },
      margin() {
        const r = this.r || calc();
        const out = ['n = cV', ` = ${p.c.toFixed(1)} × 0.100`, ` = ${(p.c * 0.1).toFixed(3)} mol`, 'm = nM', ` = ${(p.c * 5.85).toFixed(2)} g`, `天平称 ${r.m.toFixed(1)} g`];
        if (this.done) out.push(`实际 c = ${r.c.toFixed(3)}`, `偏差 ${((r.c - p.c) / p.c * 100).toFixed(1)}%`);
        return out;
      },
    };
  },
};

// ================================================================ 函数的单调性与奇偶性
const FN = [
  ['y = x²', (x) => x * x, '偶函数'], ['y = x³', (x) => x * x * x, '奇函数'], ['y = 1/x', (x) => 1 / x, '奇函数'],
  ['y = |x|', (x) => Math.abs(x), '偶函数'], ['y = x + 1/x', (x) => x + 1 / x, '奇函数'], ['y = 2ˣ', (x) => 2 ** x, '非奇非偶'],
];
const func = {
  id: 'math-function', subject: 'math', title: '函数的单调性与奇偶性', en: 'Monotonicity and parity',
  lede: ['函数的性质，是图象“看得见”的规律：从左往右是升还是降，关于 y 轴或原点对不对称。', '把图象复制一份，沿 y 轴翻折过去，或者绕原点转半圈——如果和原来的图象重合，对称性就不必再靠眼睛估计了。'],
  formula: 'x₁ < x₂ ⇒ f(x₁) < f(x₂)', formulaNote: '区间上任取 x₁ < x₂ 都有 f(x₁) < f(x₂)，则 f 在该区间上单调递增；f(−x) = f(x) 为偶函数，f(−x) = −f(x) 为奇函数',
  terms: [['单调区间', '函数在其上单调递增或单调递减的区间。'], ['偶函数', '定义域关于原点对称，且 f(−x) = f(x)；图象关于 y 轴对称。'], ['奇函数', '定义域关于原点对称，且 f(−x) = −f(x)；图象关于原点对称。']],
  predict: { q: 'y = 1/x 在 (−∞, 0) 和 (0, +∞) 上都单调递减。能不能说它“在定义域上单调递减”？', options: ['能，两段都在下降', '不能', '只有 x > 0 时可以这么说'], answer: 1, why: '取 x₁ = −1、x₂ = 1，x₁ < x₂，但 f(x₁) = −1 < f(x₂) = 1，函数值反而变大了。单调性是对“一个区间”说的，两个单调区间不能用并集连起来。' },
  challenge: '找一个既不是奇函数也不是偶函数的例子；再想想有没有既奇又偶的函数。',
  fig: '立在纸面上的坐标平面：紫色是 y = f(x)，铜色是它被翻折或旋转后的副本', hint: '移动 x₁ 和 Δx 看函数值的升降；再把“变换”拉到 180°。',
  teach: {
    ask: ['“任取 x₁ < x₂”中的“任取”能不能换成“存在”？用页面上的两个点举一个反例。', 'y = x² 在 [−1, 2] 上是不是偶函数？为什么要先看定义域？', '奇函数如果在 x = 0 处有定义，f(0) 一定等于多少？'],
    simplify: '图象画在有限的窗口里（|x| ≤ 3.6，|y| ≤ 4），y = 1/x 与 y = x + 1/x 在 x = 0 附近截断。“重合”按窗口内采样点的最大偏差判断，是数值检验而不是证明；证明要回到定义。',
  },
  controls: [
    { id: 'f', type: 'choice', label: '', options: FN.map((f) => f[0]), value: 0, wide: true },
    { id: 'x', label: 'x₁', min: -3, max: 3, step: 0.05, value: -2 },
    { id: 'd', label: 'Δx', min: 0.1, max: 3, step: 0.05, value: 1 },
    { id: 'sym', type: 'choice', label: '副本', options: ['沿 y 轴翻折', '绕原点旋转'], value: 0 },
    { id: 't', label: '变换', min: 0, max: 180, step: 1, value: 0, unit: '°' },
  ],
  build(k) {
    const p = k.p, CX = 0, CY = 2.95, Z = -1.6, SX = 1.2, SY = 0.62, XR = 3.6, YR = 4;
    const P = (x, y, dz = 0) => [CX + x * SX, CY + y * SY, Z + dz];
    // 坐标平面：一张竖立的方格纸，轴线与刻度是墨线
    const W = XR * 2 * SX + 0.5, H = YR * 2 * SY + 0.5;
    const grid = at(sheet(W, H, (x, s, w, h) => {
      x.fillStyle = 'rgba(255,253,246,.9)'; x.fillRect(0, 0, w * s, h * s);
      x.strokeStyle = 'rgba(30,43,54,.13)'; x.lineWidth = s * 0.012;
      for (let i = -3; i <= 3; i++) { const gx = (w / 2 + i * SX) * s; x.beginPath(); x.moveTo(gx, 0.25 * s); x.lineTo(gx, (h - 0.25) * s); x.stroke(); }
      for (let j = -4; j <= 4; j++) { const gy = (h / 2 - j * SY) * s; x.beginPath(); x.moveTo(0.25 * s, gy); x.lineTo((w - 0.25) * s, gy); x.stroke(); }
      x.strokeStyle = C.ink; x.lineWidth = s * 0.028;
      x.beginPath(); x.moveTo(0.15 * s, h / 2 * s); x.lineTo((w - 0.15) * s, h / 2 * s); x.moveTo(w / 2 * s, (h - 0.15) * s); x.lineTo(w / 2 * s, 0.15 * s); x.stroke();
      x.fillStyle = C.ink; x.font = `italic ${s * 0.26}px Georgia,serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('x', (w - 0.2) * s, (h / 2 + 0.28) * s); x.fillText('y', (w / 2 + 0.28) * s, 0.24 * s); x.fillText('O', (w / 2 - 0.22) * s, (h / 2 + 0.26) * s);
      x.font = `${s * 0.19}px Georgia,serif`;
      for (const i of [-3, -2, -1, 1, 2, 3]) x.fillText(String(i), (w / 2 + i * SX) * s, (h / 2 + 0.24) * s);
      for (const j of [-4, -2, 2, 4]) x.fillText(String(j), (w / 2 - 0.25) * s, (h / 2 - j * SY) * s);
    }, { opaque: false }), CX, CY, Z - 0.03);
    const frame = group(rod(P(-XR - 0.2, -YR - 0.3), P(XR + 0.2, -YR - 0.3), 0.05), rod(P(-XR - 0.2, -YR - 0.3, 0), [CX - XR * SX - 0.24, 0, Z], 0.05), rod(P(XR + 0.2, -YR - 0.3), [CX + XR * SX + 0.24, 0, Z], 0.05));
    const mk = (color, w, op) => [strip(90, { color, w, opacity: op }), strip(90, { color, w, opacity: op })];
    const main = mk(C.violet, 0.075, 0.95), ghost = mk(C.copper, 0.06, 0.8);
    const pivot = new THREE.Group(); pivot.position.set(CX, CY, Z + 0.02); ghost.forEach((g) => pivot.add(g));
    const d1 = ball(0.11, C.paper), d2 = ball(0.11, C.paper);
    const drop1 = strip(2, { color: C.ink, w: 0.02, opacity: 0.5 }), drop2 = strip(2, { color: C.ink, w: 0.02, opacity: 0.5 }), sec = strip(2, { color: C.leaf, w: 0.05, opacity: 0.9 });
    const n1 = note('x₁', { size: 0.26, italic: true }), n2 = note('x₂', { size: 0.26, italic: true });
    const info = at(card('\n\n', { w: 4.6, size: 0.27, align: 'left' }), 1.4, 0, 3.6);
    k.root.add(grid, frame, ...main, pivot, d1, d2, drop1, drop2, sec, n1, n2, info);
    let key = '', dev = 0;
    const sample = (f, a, b, local) => { const pts = []; for (let i = 0; i <= 88; i++) { const x = lerp(a, b, i / 88), y = f(x); if (Math.abs(y) <= YR + 0.05) pts.push(local ? [x * SX, y * SY, 0] : P(x, y, 0.02)); } return pts; };
    return {
      update() {
        const [, f, parity] = FN[p.f], cut = p.f === 2 || p.f === 4;
        if (key !== `${p.f}`) {
          key = `${p.f}`;
          main[0].set(sample(f, -XR, cut ? -0.02 : 0, false)); main[1].set(sample(f, cut ? 0.02 : 0, XR, false));
          ghost[0].set(sample(f, -XR, cut ? -0.02 : 0, true)); ghost[1].set(sample(f, cut ? 0.02 : 0, XR, true));
        }
        // 副本的空间变换：沿 y 轴翻折 = 绕竖直轴转半圈；绕原点转半圈 = 绕垂直于纸面的轴转
        const a = p.t * Math.PI / 180;
        pivot.rotation.set(0, p.sym === 0 ? a : 0, p.sym === 1 ? a : 0);
        pivot.visible = p.t > 0;
        dev = 0; for (let i = 1; i <= 40; i++) { const x = i / 40 * XR, y = f(x), y2 = p.sym === 0 ? f(-x) : -f(-x); if (Math.abs(y) < YR && Math.abs(y2) < YR) dev = Math.max(dev, Math.abs(y - y2)); }
        const x1 = p.x, x2 = Math.min(XR, p.x + p.d), ok = (x) => Number.isFinite(f(x)) && Math.abs(f(x)) <= YR;
        const y1 = f(x1), y2 = f(x2), vis = ok(x1) && ok(x2);
        [d1, d2, drop1, drop2, sec, n1, n2].forEach((o) => (o.visible = vis));
        if (vis) {
          d1.position.set(...P(x1, y1, 0.06)); d2.position.set(...P(x2, y2, 0.06));
          drop1.set([P(x1, 0, 0.04), P(x1, y1, 0.04)]); drop2.set([P(x2, 0, 0.04), P(x2, y2, 0.04)]); sec.set([P(x1, y1, 0.05), P(x2, y2, 0.05)]);
          n1.position.set(...P(x1, -0.5 * Math.sign(y1 || 1), 0.06)); n2.position.set(...P(x2, -0.5 * Math.sign(y2 || 1), 0.06));
        }
        const same = dev < 0.02;
        info.set(`${vis ? `f(x₁) = ${y1.toFixed(2)}，f(x₂) = ${y2.toFixed(2)}：这两点间${y2 > y1 ? '上升' : y2 < y1 ? '下降' : '持平'}` : '（x₁ 或 x₂ 处的函数值在窗口之外）'}\n${p.t < 179 ? `把“变换”拉到 180°，看副本是否与原图象重合` : `${p.sym ? '绕原点转半圈' : '沿 y 轴翻折'}后${same ? '完全重合' : `不重合（最大相差 ${dev.toFixed(2)}）`}`}\n${p.t < 179 ? '' : same ? `${FN[p.f][0]} 是${p.sym ? '奇' : '偶'}函数` : `所以它不是${p.sym ? '奇' : '偶'}函数`}`);
        this.s = { x1, x2, y1, y2, vis, parity };
      },
      margin() {
        const s = this.s; if (!s) return [];
        const out = [`x₁ = ${s.x1.toFixed(2)}`, `x₂ = ${s.x2.toFixed(2)}`];
        if (s.vis) out.push(`Δy/Δx = ${((s.y2 - s.y1) / (s.x2 - s.x1)).toFixed(2)}`, '两个点升 ≠ 区间上递增', '定义要求“任取”');
        out.push(`${FN[p.f][0]}：`, ` ${s.parity}`);
        return out;
      },
    };
  },
};

export default [forces, molarity, func];
