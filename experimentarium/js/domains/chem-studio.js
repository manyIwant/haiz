// HAIZ · EXPERIMENTARIUM — 化学反应与分析实验包（全 12 项完整上线：L3/L4 覆盖必修与选必核心实验）
import {
  C, TAU, clamp, lerp, group, at, rot, box, cyl, ball, cone, torus, plate,
  solid, flat, glass, rod, wire, tube, arrow, strip, glow, jar, label, note, card, plot, dots,
  liquid, sheet, meter, bubbler, flow, lathe, vessel, retort, stand,
  wavelength, sig, freshGroup, THREE,
} from '../core/ink.js';
import { solveTitrationPH, solveHydrolysisPH } from '../core/science-models.js';
import { rng, gauss, linearRegression } from '../core/epistemic.js';

const STEEL = '#cfd6dc';

function mixHex(hex1, hex2, t) {
  const c1 = new THREE.Color(hex1), c2 = new THREE.Color(hex2);
  c1.lerp(c2, clamp(t));
  return '#' + c1.getHexString();
}

function makeBeaker(r, h, color = '#dff0ff', opacity = 0.45) {
  return vessel(
    [[0, 0], [r * 0.96, 0], [r, 0.06], [r, h], [r * 1.06, h + 0.06]],
    { color, opacity, wall: 0.032 },
  );
}

function makeTestTube(r = 0.24, h = 2.1, color = '#d6ecfa', opacity = 0.55) {
  const prof = [];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    prof.push([Math.sin(a) * r, r * (1 - Math.cos(a))]);
  }
  prof.push([r, h], [r * 1.12, h + 0.05]);
  return vessel(prof, { color, opacity, wall: 0.025, seg: 28 });
}

// ================================================================ 1. 配制一定物质的量浓度的溶液 (L3)
const MOL_STEPS = ['计算', '称量', '溶解', '转移', '洗涤', '定容', '摇匀'];

export const molarity = {
  id: 'chem-molarity',
  subject: 'chem',
  title: '配制一定物质的量浓度的溶液',
  en: 'Preparing a solution of known molarity & meniscus parallax',
  lede: [
    '配制 100 mL 一定浓度的氯化钠溶液：经过计算、称量、溶解、玻璃棒引流转移、洗涤烧杯与玻璃棒、定容至凹液面与刻度线相切，再盖塞摇匀。',
    '容量瓶只有一条标线。溶质少了一滴或定容时俯视/仰视产生视差，都会直接把误差带进最终浓度；在工作台实时推演视线偏角带来的浓度偏差。',
  ],
  formula: 'c = n / V = m / (M · V) · M(NaCl) = 58.5 g/mol',
  formulaNote: '俯视刻度线 → 实际加水量偏少 (V 偏小) → c 偏大；仰视刻度线 → 实际加水量偏多 (V 偏大) → c 偏小',
  terms: [
    ['容量瓶标线', '在标定温度（通常 20°C）下，凹液面最低点与刻度线相切时容积恰为 100.0 mL'],
    ['玻璃棒引流', '转移与洗涤时玻璃棒下端靠在刻度线以下内壁，防止液滴溅出或挂壁'],
    ['定容视差', '俯视使视线向下斜切刻度，液面低于标线（偏大）；仰视使液面高于标线（偏小）'],
  ],
  predict: {
    q: '定容时仰视容量瓶刻度线（眼睛位置低于刻度线），最终配得溶液的实际浓度会怎样？',
    options: ['偏大', '偏小', '没有影响'],
    answer: 1,
    why: '仰视时视线由下向上斜过刻度线，看起来凹液面已“相切”，实际凹液面还在刻度线上方——水加多了（V 偏大），而溶质物质的量 n 不变，由 c = n/V 可知浓度偏小；俯视则相反（偏大）。',
  },
  challenge: '先规范平视配出一份相对误差 < 1% 的 1.0 mol/L 溶液；再切换到“俯视”与“不洗”，在工作台对比两种失误对浓度的相反方向偏离。',
  fig: '电子天平、玻璃棒引流、100 mL 刻度容量瓶与凹液面放大镜',
  hint: '选好定容视线与洗涤方式，连续点击“下一步”走完 7 个步骤；也可在工作台直接拖动眼位视差角实时计算偏差。',
  teach: {
    where: '人教版化学必修第一册第二章 §2.3《物质的量》（实验：配制一定物质的量浓度的溶液）',
    ask: [
      '转移后未洗涤烧杯与玻璃棒 2–3 次，会对最终浓度造成什么方向的影响？',
      '定容摇匀后发现液面略低于刻度线，能否再滴加蒸馏水补齐？为什么？',
    ],
    simplify: '设天平分度为 0.1 g，不洗涤按残余损失 3.5% 溶质计；仰视/俯视默认对应 ±1.4 mL 定容体积偏差，工作台可连续调节视差角。',
    safety: '容量瓶使用前需检漏；禁止在容量瓶中直接溶解固体或加热。',
  },
  controls: [
    { id: 'c', label: '目标浓度', min: 0.5, max: 2.0, step: 0.1, value: 1.0, unit: 'mol/L' },
    { id: 'eye', type: 'choice', label: '定容视线', options: ['平视', '仰视 (低视角)', '俯视 (高视角)'], value: 0 },
    { id: 'wash', type: 'choice', label: '洗涤步骤', options: ['洗 3 次', '不洗涤'], value: 0 },
    { id: 'next', type: 'button', label: '下一步' },
    { id: 'reset', type: 'button', label: '重来' },
  ],
  record: {
    note: '走完七步（到“摇匀”结束）后，记录当前实际配制结果并对比理论目标浓度偏差。',
    pending: '请按“下一步”依次走完七个实验步骤至“摇匀”完成。',
    columns: [
      { key: 'c0', label: '目标 c', unit: 'mol/L', digits: 2 },
      { key: 'm', label: '称取 m', unit: 'g', digits: 1 },
      { key: 'eye', label: '定容视线' },
      { key: 'wash', label: '洗涤' },
      { key: 'v', label: '实际 V', unit: 'mL', digits: 1 },
      { key: 'c', label: '实际 c', unit: 'mol/L', digits: 3, stat: true },
      { key: 'err', label: '相对偏差', unit: '%', digits: 1 },
    ],
    sample: (inst) => inst.result?.(),
    summary: (rows) => [
      ['已配制记录', `${rows.length} 组`],
      ['最近实配浓度', rows.length ? `${rows[rows.length - 1].c.toFixed(3)} mol/L` : '—'],
    ],
    errors: [
      '称量误差：0.1 g 分度天平在低浓度时取整相对偏差更大。',
      '漏洗烧杯与玻璃棒导致溶质 n 减少，结果系统偏小。',
      '定容俯视导致水加少（V 偏小）→ 浓度偏大；仰视导致水加多（V 偏大）→ 浓度偏小。',
    ],
  },

  build(k) {
    const p = k.p, FX = 0.2, FZ = -0.9, MARK = 2.95;
    const bal = at(group(
      box(2.2, 0.36, 1.9, '#ffffff'),
      at(cyl(0.72, 0.05, STEEL, { seg: 40 }), 0, 0.42, -0.2),
      at(cyl(0.12, 0.08, STEEL, { seg: 16 }), 0, 0.36, -0.2),
    ), -3.1, 0, -2.5);
    const read = at(card('0.0 g', { w: 1.35, size: 0.3, lay: 'up' }), -3.1, 0.02, -1.35);
    read.rotation.x = -1.15;
    const salt = at(lathe([[0, 0], [0.42, 0], [0.3, 0.14], [0, 0.2]], '#ffffff', { seg: 20 }), -3.1, 0.47, -2.7);
    const bkr = at(makeBeaker(0.74, 1.5), -3.0, 0.02, 1.0);
    const stick = rod([-3.25, 0.1, 1.0], [-2.55, 2.4, 0.8], 0.035, '#eef4f2');

    const flask = at(vessel(
      [[0, 0], [0.78, 0], [1.02, 0.2], [1.1, 0.72], [0.92, 1.3], [0.36, 1.82], [0.17, 2.05], [0.17, 3.7], [0.23, 3.8]],
      { color: '#dff0ff', opacity: 0.45, wall: 0.035 },
    ), FX, 0.02, FZ);
    const mark = at(torus(0.212, 0.013, C.red), FX, 0.02 + MARK, FZ);
    const flaskTag = at(note('100 mL · 20°C', { size: 0.24, color: C.ink }), FX + 1.05, 1.15, FZ);
    const stopper = at(lathe(
      [[0, 0], [0.15, 0], [0.2, 0.3], [0.32, 0.34], [0.32, 0.5], [0, 0.5]],
      '#eef4f2', { kind: 'ceramic', seg: 20 },
    ), FX, 3.7, FZ);
    const pour = strip(12, { color: '#9fd0ff', w: 0.07, opacity: 0.72 });
    pour.visible = false;

    let lv = -9, eyeLast = -1, customDv = null;
    const lens = at(sheet(2.35, 2.35, () => {}, { lay: 'tilt' }), 2.9, 0, 1.3);
    const ring = at(rot(torus(1.12, 0.045, '#d9b36a'), Math.PI / 2 - 0.8, 0, 0), 2.9, Math.cos(0.8) * 1.16, 1.3 - Math.sin(0.8) * 1.16);
    const drawLens = (dv, eIdx) => lens.redraw((x, s, w, h) => {
      const c = (w / 2) * s, r = 1.08 * s, x0 = c - 0.36 * s, x1 = c + 0.36 * s;
      const ym = c, yl = ym - dv * 0.28 * s;
      x.save();
      x.beginPath(); x.arc(c, c, r, 0, TAU); x.clip();
      x.fillStyle = '#fffdf6'; x.fillRect(0, 0, w * s, h * s);
      x.fillStyle = 'rgba(110,175,240,0.48)';
      x.beginPath();
      x.moveTo(x0, yl - 0.07 * s);
      x.quadraticCurveTo(c, yl + 0.07 * s, x1, yl - 0.07 * s);
      x.lineTo(x1, h * s); x.lineTo(x0, h * s); x.closePath(); x.fill();
      x.strokeStyle = C.ink; x.lineWidth = s * 0.022;
      x.beginPath(); x.moveTo(x0, 0); x.lineTo(x0, h * s); x.moveTo(x1, 0); x.lineTo(x1, h * s); x.stroke();
      x.strokeStyle = C.red; x.lineWidth = s * 0.028;
      x.beginPath(); x.moveTo(x0, ym); x.lineTo(x1, ym); x.stroke();
      const slope = [0, -0.55, 0.55][eIdx] ?? 0;
      x.setLineDash([s * 0.05, s * 0.04]);
      x.strokeStyle = C.copper; x.lineWidth = s * 0.018;
      x.beginPath();
      x.moveTo(c - r, ym + slope * (r - 0.36 * s));
      x.lineTo(x0, ym);
      x.lineTo(c, ym - slope * 0.36 * s);
      x.stroke();
      x.setLineDash([]);
      x.fillStyle = C.copper; x.font = `600 ${s * 0.14}px Georgia,serif`;
      x.fillText(['平视(切线)', '仰视(液面高)', '俯视(液面低)'][eIdx] || '', c - r + 0.08 * s, ym + slope * (r - 0.36 * s) + (slope > 0 ? 0.17 : -0.09) * s);
      x.restore();
    });

    const info = at(card('\n\n', { w: 4.7, size: 0.26, align: 'left' }), 1.4, 0, 3.6);
    k.root.add(bal, read, salt, bkr, stick, flask, mark, flaskTag, stopper, pour, lens, ring, info);

    let step = 0, t = 1, shake = 0;
    const calc = () => {
      const m = Math.round(p.c * 0.1 * 58.5 * 10) / 10;
      const n = (m / 58.5) * (p.wash ? 0.965 : 1);
      const dv = customDv !== null ? customDv : [0, 1.4, -1.4][p.eye ?? 0];
      const v = clamp(100 + dv, 92, 108);
      return { m, n, dv, v, c: n / (v / 1000) };
    };

    return {
      calc,
      state: () => ({ step, t, customDv }),
      setParallaxDv(dv) { customDv = dv; k.dirty(); },
      press(id) {
        if (id === 'reset') { step = 0; t = 1; customDv = null; }
        else if (id === 'next' && t >= 1) { step = step >= 7 ? 1 : step + 1; t = 0; }
      },
      change(id) {
        if (id === 'eye') customDv = null;
        if (step >= 6) { step = 5; t = 1; }
      },
      result() {
        if (step < 7 || t < 1) return null;
        const r = calc();
        return {
          _kind: 'human',
          c0: p.c, m: r.m,
          eye: ['平视', '仰视', '俯视'][p.eye ?? 0],
          wash: p.wash ? '不洗' : '洗 3 次',
          v: r.v, c: r.c, err: ((r.c - p.c) / p.c) * 100,
        };
      },
      update(dt) {
        if (t < 1) t = Math.min(1, t + dt / 1.3);
        const e = t * t * (3 - 2 * t), r = calc();
        const on = (s) => (step === s ? e : step > s ? 1 : 0);
        read.set(`${(r.m * on(2)).toFixed(1)} g`);
        salt.visible = (step >= 2 && step < 3) || (step === 3 && e < 0.35);
        salt.scale.setScalar(0.4 + 0.6 * on(2));
        const inBeaker = on(3) * (1 - on(4)) * 0.75 + (step === 5 ? Math.sin(e * Math.PI) * 0.25 : 0);
        bkr.fill(inBeaker);
        stick.visible = step >= 3 && step <= 5;
        const washAdd = p.wash ? 0 : 0.36;
        const level = 0.02 + on(4) * 1.25 + on(5) * washAdd + on(6) * (MARK - 1.25 - washAdd + r.dv * 0.28);
        flask.fill(level);
        pour.visible = (step === 4 || (step === 5 && !p.wash) || step === 6) && t < 0.92;
        if (pour.visible) {
          const pts = [];
          for (let i = 0; i < 12; i++) {
            const u = i / 11;
            pts.push([lerp(-1.4, FX, u), 4.55 - u * u * (4.55 - level - 0.02) + Math.sin(u * 3.1) * 0.45, lerp(0.4, FZ, u)]);
          }
          pour.set(pts);
        }
        stopper.visible = step >= 7 || step === 0;
        shake = step === 7 && t < 1 ? Math.sin(e * TAU * 3) * 0.45 * (1 - e) : 0;
        flask.rotation.z = shake; stopper.rotation.z = shake; mark.rotation.z = shake;
        stopper.position.set(FX - Math.sin(shake) * 3.7, 0.02 + Math.cos(shake) * 3.68, FZ);
        mark.position.set(FX - Math.sin(shake) * MARK, 0.02 + Math.cos(shake) * MARK, FZ);
        const dvNow = step >= 6 ? lerp(-5, r.dv, on(6)) : -5;
        if (Math.abs(dvNow - lv) > 0.02 || eyeLast !== p.eye) {
          lv = dvNow; eyeLast = p.eye; drawLens(dvNow, p.eye ?? 0);
        }
        const done = step === 7 && t >= 1;
        const errPct = ((r.c - p.c) / p.c) * 100;
        info.set(step === 0
          ? `目标：配制 100 mL ${p.c.toFixed(1)} mol/L NaCl\n流程：${MOL_STEPS.join(' → ')}`
          : `第 ${step}/7 步 · ${MOL_STEPS[step - 1]}\n${[
              'n = cV，m = nM',
              `称取 ${r.m.toFixed(1)} g NaCl`,
              '烧杯中加水，玻璃棒搅拌溶解',
              '沿玻璃棒引流转入 100 mL 容量瓶',
              p.wash ? '（跳过洗涤：约 3.5% 溶质残留烧杯）' : '洗涤烧杯和玻璃棒 3 次并转入',
              `定容至凹液面与刻度线相切（${['平视', '仰视', '俯视'][p.eye ?? 0]}）`,
              '盖好瓶塞，上下颠倒摇匀',
            ][step - 1]}\n${done ? `实配 ${r.c.toFixed(3)} mol/L (偏差 ${errPct >= 0 ? '+' : ''}${errPct.toFixed(1)}%)` : ''}`);
        this.r = r; this.done = done;
      },
      margin() {
        const r = this.r || calc();
        const out = [
          'c = n / V',
          `n_标 = ${(p.c * 0.1).toFixed(3)} mol`,
          `m_称 = ${r.m.toFixed(1)} g`,
          `视线 = ${['平视', '仰视', '俯视'][p.eye ?? 0]}`,
          `V_实 = ${r.v.toFixed(1)} mL`,
        ];
        if (this.done) out.push(`c_实 = ${r.c.toFixed(3)} M`, `偏差 ${(((r.c - p.c) / p.c) * 100).toFixed(1)}%`);
        return out;
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec = wb.section('1 · 凹液面视差模拟器与浓度误差拆解');
    let angleDeg = [0, -18, 18][sp.params.eye ?? 0];
    const row = document.createElement('div');
    row.className = 'wb-row';
    row.innerHTML = `
      <label class="wb-ctl">视线仰俯角 θ:
        <input type="range" min="-25" max="25" step="1" value="${angleDeg}" data-ang>
        <b data-ang-out>${angleDeg}°</b>
      </label>
      <div class="wb-btn-row" style="margin:0">
        <button type="button" class="wb-btn" data-pre="-18">仰视 (-18°)</button>
        <button type="button" class="wb-btn primary" data-pre="0">平视 (0°)</button>
        <button type="button" class="wb-btn" data-pre="18">俯视 (+18°)</button>
        <button type="button" class="wb-btn" data-log>计入实验记录</button>
      </div>`;
    sec.append(row);

    const cv = wb.canvas(sec, 520, 230, (x, W, H) => {
      const p = sp.params;
      const m = Math.round(p.c * 0.1 * 58.5 * 10) / 10;
      const n = (m / 58.5) * (p.wash ? 0.965 : 1);
      // 俯视(+angle): 视线从上向下穿过前刻度，看到后方液面偏高，提前停止加水 -> 实际液面低 dv < 0 -> V 偏小 -> c 偏大
      const dv = -Math.sin((angleDeg * Math.PI) / 180) * 4.5;
      const vAct = clamp(100 + dv, 92, 108);
      const cAct = n / (vAct / 1000);
      const errPct = ((cAct - p.c) / p.c) * 100;

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      // 左侧瓶颈剖面与视线几何
      const nx = 140, nw = 64, ym = 115;
      const yl = ym - dv * 11;
      x.fillStyle = 'rgba(102,174,238,0.42)';
      x.beginPath();
      x.moveTo(nx - nw / 2, yl - 6);
      x.quadraticCurveTo(nx, yl + 6, nx + nw / 2, yl - 6);
      x.lineTo(nx + nw / 2, H - 15);
      x.lineTo(nx - nw / 2, H - 15);
      x.closePath(); x.fill();

      x.strokeStyle = '#1e2b36'; x.lineWidth = 2;
      x.beginPath();
      x.moveTo(nx - nw / 2, 15); x.lineTo(nx - nw / 2, H - 15);
      x.moveTo(nx + nw / 2, 15); x.lineTo(nx + nw / 2, H - 15);
      x.stroke();

      // 红色刻度线
      x.strokeStyle = '#e5483f'; x.lineWidth = 2.4;
      x.beginPath(); x.moveTo(nx - nw / 2 - 8, ym); x.lineTo(nx + nw / 2 + 8, ym); x.stroke();
      x.fillStyle = '#e5483f'; x.font = '12px Georgia,serif';
      x.fillText('100 mL 标线', nx + nw / 2 + 12, ym + 4);

      // 视线矢量
      const rad = (angleDeg * Math.PI) / 180;
      const ex = 35, ey = ym - Math.tan(rad) * (nx - ex);
      x.setLineDash([5, 4]); x.strokeStyle = '#b4653a'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(ex, ey); x.lineTo(nx + nw / 2 + 15, ym + Math.tan(rad) * (nw / 2 + 15)); x.stroke();
      x.setLineDash([]);
      x.fillStyle = '#b4653a';
      x.beginPath(); x.arc(ex, ey, 6, 0, TAU); x.fill();
      x.font = 'bold 12px "Songti SC",serif';
      x.fillText(angleDeg > 2 ? '俯视' : angleDeg < -2 ? '仰视' : '平视', ex - 10, ey - 12);

      // 右侧偏差条形对照
      const rx = 285, rw = 210;
      x.fillStyle = '#f7f1e1'; x.fillRect(rx, 20, rw, H - 40);
      x.strokeStyle = '#d8cfb8'; x.lineWidth = 1; x.strokeRect(rx, 20, rw, H - 40);
      x.fillStyle = '#1e2b36'; x.font = 'bold 13px "Songti SC",serif';
      x.fillText('实时误差拆解（c = n / V）', rx + 14, 44);
      x.font = '12px Georgia,serif';
      x.fillText(`目标浓度 c₀ = ${p.c.toFixed(3)} mol/L`, rx + 14, 72);
      x.fillText(`称量溶质 n  = ${n.toFixed(4)} mol (${p.wash ? '未洗-3.5%' : '已洗净'})`, rx + 14, 96);
      x.fillText(`定容体积 V  = ${vAct.toFixed(2)} mL (ΔV=${dv >= 0 ? '+' : ''}${dv.toFixed(2)})`, rx + 14, 120);
      x.fillStyle = Math.abs(errPct) < 1 ? '#1f4a3e' : '#b43e2e';
      x.font = 'bold 14px Georgia,serif';
      x.fillText(`实际浓度 c  = ${cAct.toFixed(4)} mol/L`, rx + 14, 152);
      x.fillText(`相对误差    = ${errPct >= 0 ? '+' : ''}${errPct.toFixed(2)} %`, rx + 14, 176);
      x.font = '12px "Songti SC",serif';
      x.fillText(angleDeg > 2 ? '结论：俯视使体积偏小 → 浓度偏大' : angleDeg < -2 ? '结论：仰视使体积偏大 → 浓度偏小' : '结论：平视切线 → 体积误差趋零', rx + 14, 200);
    });

    const diag = document.createElement('div');
    diag.className = 'wb-metrics';
    sec.append(diag);

    const angInput = row.querySelector('[data-ang]');
    const angOut = row.querySelector('[data-ang-out]');

    const refresh = () => {
      const p = sp.params;
      const m = Math.round(p.c * 0.1 * 58.5 * 10) / 10;
      const n = (m / 58.5) * (p.wash ? 0.965 : 1);
      const dv = -Math.sin((angleDeg * Math.PI) / 180) * 4.5;
      const vAct = clamp(100 + dv, 92, 108);
      const cAct = n / (vAct / 1000);
      angInput.value = angleDeg;
      angOut.textContent = `${angleDeg}°`;
      sp.inst?.setParallaxDv?.(dv);
      cv.redraw();
      diag.innerHTML = `
        <div class="wb-m"><span>称量质量偏差</span><b>${m.toFixed(1)} g (理论 ${(p.c * 5.85).toFixed(2)} g)</b></div>
        <div class="wb-m"><span>定容体积 V</span><b>${vAct.toFixed(2)} mL</b></div>
        <div class="wb-m"><span>实际浓度 c</span><b>${cAct.toFixed(4)} mol/L (${(((cAct - p.c) / p.c) * 100).toFixed(2)}%)</b></div>`;
    };

    angInput.addEventListener('input', () => { angleDeg = +angInput.value; refresh(); });
    row.addEventListener('click', (e) => {
      const pre = e.target.closest('[data-pre]');
      if (pre) {
        angleDeg = +pre.dataset.pre;
        wb.setParam('eye', angleDeg < -2 ? 1 : angleDeg > 2 ? 2 : 0);
        refresh();
      } else if (e.target.closest('[data-log]')) {
        const p = sp.params;
        const m = Math.round(p.c * 0.1 * 58.5 * 10) / 10;
        const n = (m / 58.5) * (p.wash ? 0.965 : 1);
        const dv = -Math.sin((angleDeg * Math.PI) / 180) * 4.5;
        const v = clamp(100 + dv, 92, 108);
        const c = n / (v / 1000);
        wb.record({
          _kind: 'human', c0: p.c, m,
          eye: angleDeg > 2 ? `俯视(${angleDeg}°)` : angleDeg < -2 ? `仰视(${angleDeg}°)` : '平视',
          wash: p.wash ? '不洗' : '洗 3 次', v, c, err: ((c - p.c) / p.c) * 100,
        });
      }
    });

    refresh();
    return { update() { cv.redraw(); } };
  },
};

// ================================================================ 2. 铁与含硫物质的价类二维转化 (L3)
const FE_TUBES = [
  { name: '管1: Fe³⁺ + KSCN', initCol: '#d98a2b', endCol: '#9b0d14', eq: 'Fe³⁺ + 3SCN⁻ ⇌ Fe(SCN)₃ (血红色)', ppt: null, bub: false, desc: 'Fe³⁺ 特效显色检验：生成血红色络合物' },
  { name: '管2: Fe²⁺ + K₃[Fe(CN)₆]', initCol: '#bce8c8', endCol: '#1b499c', eq: 'Fe²⁺ + K⁺ + [Fe(CN)₆]³⁻ = KFe[Fe(CN)₆]↓', ppt: '#15387a', bub: false, desc: 'Fe²⁺ 特效检验：生成特征蓝色沉淀（滕氏蓝）' },
  { name: '管3: Fe²⁺ + Cl₂水', initCol: '#bce8c8', endCol: '#d98a2b', eq: '2Fe²⁺ + Cl₂ = 2Fe³⁺ + 2Cl⁻', ppt: null, bub: false, desc: '氯水将浅绿色 Fe²⁺ 氧化为棕黄色 Fe³⁺' },
  { name: '管4: Fe³⁺ + Fe粉', initCol: '#d98a2b', endCol: '#bce8c8', eq: '2Fe³⁺ + Fe = 3Fe²⁺', ppt: '#5a6066', bub: false, desc: '归中反应：铁粉把棕黄色 Fe³⁺ 还原为浅绿色 Fe²⁺' },
  { name: '管5: Fe³⁺ + Cu粉', initCol: '#d98a2b', endCol: '#1f8a8c', eq: '2Fe³⁺ + Cu = 2Fe²⁺ + Cu²⁺', ppt: '#b4653a', bub: false, desc: '蚀刻电路板原理：Cu 被氧化为蓝色 Cu²⁺，溶液呈蓝绿色' },
];
const S_TUBES = [
  { name: '管1: H₂S + SO₂', initCol: '#e4f0f5', endCol: '#f2e079', eq: '2H₂S + SO₂ = 3S↓ + 2H₂O', ppt: '#e8d03a', bub: false, desc: 'S⁻² 与 S⁺⁴ 发生归中反应，析出淡黄色硫单质浑浊' },
  { name: '管2: SO₂ + Cl₂水', initCol: '#f5f0c6', endCol: '#eef6fa', eq: 'SO₂ + Cl₂ + 2H₂O = H₂SO₄ + 2HCl', ppt: null, bub: false, desc: 'Cl₂ 氧化 +4 价硫为 +6 价 SO₄²⁻，黄绿色褪去' },
  { name: '管3: SO₂ + KMnO₄(H⁺)', initCol: '#9b1d78', endCol: '#eef6fa', eq: '5SO₂ + 2MnO₄⁻ + 2H₂O = 5SO₄²⁻ + 2Mn²⁺ + 4H⁺', ppt: null, bub: false, desc: 'SO₂ 体现强还原性，使酸性高锰酸钾紫红色褪去' },
  { name: '管4: Cu + 浓H₂SO₄(Δ)', initCol: '#eef2f5', endCol: '#2986cc', eq: 'Cu + 2H₂SO₄(浓) = CuSO₄ + SO₂↑ + 2H₂O', ppt: '#b4653a', bub: true, desc: '浓硫酸体现强氧化性与酸性，生成 Cu²⁺ 与刺激性 SO₂ 气体' },
  { name: '管5: Na₂S₂O₃ + H₂SO₄', initCol: '#eef6fa', endCol: '#ede198', eq: 'S₂O₃²⁻ + 2H⁺ = S↓ + SO₂↑ + H₂O', ppt: '#e3c946', bub: true, desc: '+2 价硫发生歧化反应：既生成 0 价 S↓ 又生成 +4 价 SO₂↑' },
];
const REDOX_EQS = [
  {
    title: 'Fe³⁺ 被 Fe 粉还原（归中）',
    lhs: ['Fe³⁺', 'Fe'], rhs: ['Fe²⁺'],
    ans: [2, 1, 3], eShift: 2,
    arrowTxt: 'Fe³⁺(+3 → +2, 得1e⁻×2) · Fe(0 → +2, 失2e⁻×1)',
  },
  {
    title: 'Fe²⁺ 被 Cl₂ 氧化',
    lhs: ['Fe²⁺', 'Cl₂'], rhs: ['Fe³⁺', 'Cl⁻'],
    ans: [2, 1, 2, 2], eShift: 2,
    arrowTxt: 'Fe²⁺(+2 → +3, 失1e⁻×2) · Cl₂(0 → -1, 得1e⁻×2)',
  },
  {
    title: 'Fe³⁺ 腐蚀 Cu 箔',
    lhs: ['Fe³⁺', 'Cu'], rhs: ['Fe²⁺', 'Cu²⁺'],
    ans: [2, 1, 2, 1], eShift: 2,
    arrowTxt: 'Fe³⁺(+3 → +2, 得1e⁻×2) · Cu(0 → +2, 失2e⁻×1)',
  },
  {
    title: 'H₂S 与 SO₂ 归中析硫',
    lhs: ['H₂S', 'SO₂'], rhs: ['S↓', 'H₂O'],
    ans: [2, 1, 3, 2], eShift: 4,
    arrowTxt: 'H₂S(-2 → 0, 失2e⁻×2) · SO₂(+4 → 0, 得4e⁻×1)',
  },
  {
    title: 'SO₂ 被 Cl₂ 水氧化',
    lhs: ['SO₂', 'Cl₂', 'H₂O'], rhs: ['H₂SO₄', 'HCl'],
    ans: [1, 1, 2, 1, 2], eShift: 2,
    arrowTxt: 'SO₂(+4 → +6, 失2e⁻×1) · Cl₂(0 → -1, 得1e⁻×2)',
  },
];

export const feRedox = {
  id: 'chem-fe-redox',
  subject: 'chem',
  title: '铁及其化合物与含硫物质的价类转化',
  en: 'Valence-category Fe & S redox test-tube rack',
  lede: [
    '把“物质类别”作横轴、“核心元素化合价”作纵轴，就能在一张二维坐标图上预言任意含铁或含硫物质的氧化还原转化方向。',
    '在试管架上逐管加入 KSCN、K₃[Fe(CN)₆]、氯水、铁粉或铜粉，观察血红络合、滕氏蓝沉淀与价态升降，并在工作台完成双线桥电子守恒配平。',
  ],
  formula: '2Fe³⁺ + Fe = 3Fe²⁺ · 2Fe²⁺ + Cl₂ = 2Fe³⁺ + 2Cl⁻ · 2H₂S + SO₂ = 3S↓ + 2H₂O',
  formulaNote: '最高价态只具氧化性，最低价态只具还原性，中间价态兼有氧化性与还原性（可发生歧化或归中）',
  terms: [
    ['Fe³⁺ 与 Fe²⁺ 鉴别', 'KSCN 遇 Fe³⁺ 显血红色；K₃[Fe(CN)₆] 遇 Fe²⁺ 生成蓝色沉淀（滕氏蓝）'],
    ['归中反应', '同种元素高价态与低价态相遇向中间价态转化，如 Fe³⁺ + Fe → Fe²⁺、H₂S + SO₂ → S↓'],
    ['价类二维图', '横轴按氢化物—单质—氧化物—酸/碱—盐排布，纵轴按元素化合价排列'],
  ],
  predict: {
    q: '向 FeCl₃ 溶液中加入足量铜粉充分反应后，再滴入 KSCN 溶液，不会出现血红色的是哪种现象？',
    options: ['溶液变为蓝绿色，滴加 KSCN 不显血红（Fe³⁺ 已耗尽）', '仍立即呈血红色', '产生红褐色 Fe(OH)₃ 沉淀'],
    answer: 0,
    why: '反应 2Fe³⁺ + Cu = 2Fe²⁺ + Cu²⁺ 使 Fe³⁺ 被足量铜粉完全还原为 Fe²⁺，生成的 Cu²⁺（蓝色）与 Fe²⁺（浅绿）混合呈蓝绿色；由于已无 Fe³⁺，滴加 KSCN 不会显血红色。',
  },
  challenge: '逐一触发铁系 5 支试管反应（KSCN、K₃[Fe(CN)₆]、Cl₂、Fe粉、Cu粉），再切换至含硫价类转化组并完成工作台配平检验！',
  fig: '五管化学反应试管架、试剂滴管与价态指示牌',
  hint: '切换 Fe / S 体系并选择 1–5 号试管，按“滴加试剂 / 反应”触发颜色与沉淀变化；在工作台交互点击价类二维图并配平双线桥。',
  teach: {
    where: '人教版化学必修第一册第三章 §3.1《铁及其化合物》与必修第二册第五章 §5.1《硫及其化合物》',
    ask: [
      '用价类二维图解释为什么亚铁盐溶液保存时常加入少量铁粉？',
      '氯水氧化 Fe²⁺ 与铁粉还原 Fe³⁺ 的两支试管中，如何设计对照实验确认转化是否完全？',
    ],
    simplify: '试管颜色变化与沉淀析出采用一阶动力学平滑过渡示意；双线桥配平在工作台以最小整数比和电子转移总数检验。',
    safety: 'Cl₂ 水、SO₂ 及浓 H₂SO₄ 具有刺激性与强腐蚀性，真实实验须在通风橱中佩戴防护手套操作。',
  },
  controls: [
    { id: 'sys', type: 'choice', label: '转化体系', options: ['铁价类反应架 (Fe⁰/²⁺/³⁺)', '硫价类反应架 (S⁻²/⁰/⁺⁴/⁺⁶)'], value: 0 },
    { id: 'tube', type: 'choice', label: '选中试管', options: ['1 号管', '2 号管', '3 号管', '4 号管', '5 号管'], value: 0 },
    { id: 'react', type: 'button', label: '滴加试剂 / 反应' },
    { id: 'resetTube', type: 'button', label: '重置本组试管' },
  ],
  record: {
    note: '将已完成反应的试管编号、核心方程式与显色/沉淀现象记入实验册。',
    pending: '请先选择试管并点击“滴加试剂 / 反应”观察现象后记录。',
    columns: [
      { key: 'sysName', label: '元素体系' },
      { key: 'tubeName', label: '反应试管' },
      { key: 'eq', label: '离子/化学方程式' },
      { key: 'phen', label: '现象与检验结果' },
    ],
    sample: (inst, p) => inst.getSample?.(p),
    summary: (rows) => [
      ['已完成转化验证', `${rows.length} 管`],
      ['最新反应', rows.length ? rows[rows.length - 1].tubeName : '—'],
    ],
    errors: [
      '检验含 Fe³⁺ 溶液中的少量 Fe²⁺ 时不可用 KSCN（会被血红掩盖），应选用 K₃[Fe(CN)₆] 产生蓝色沉淀。',
      'SO₂ 与 Cl₂ 等物质的量混合通入水中不仅不叠加漂白，反而发生氧化还原反应使漂白性完全丧失。',
    ],
  },

  build(k) {
    const p = k.p, Z = -0.7;
    // 试管架底座 + 支架
    const rack = group(
      at(box(6.4, 0.16, 1.4, C.wood), 0, 0, Z),
      at(box(0.18, 1.65, 1.1, C.wood), -2.95, 0.16, Z),
      at(box(0.18, 1.65, 1.1, C.wood), 2.95, 0.16, Z),
      at(box(6.2, 0.12, 1.0, C.wood), 0, 1.62, Z),
    );
    k.root.add(rack);

    const XS = [-2.1, -1.05, 0, 1.05, 2.1];
    const tubes = XS.map((x, idx) => {
      const tt = at(makeTestTube(0.24, 2.15), x, 0.25, Z);
      tt.fill(1.35);
      const ppt = at(cyl(0.21, 0.18, '#555', { seg: 20 }), x, 0.28, Z);
      ppt.visible = false;
      const bub = bubbler(10, { x, z: Z, rad: 0.14, y0: 0.45, r: 0.04, speed: 1.5 });
      const tag = at(note(`${idx + 1}`, { size: 0.28, bold: true }), x, 2.75, Z);
      k.root.add(tt, ppt, bub, tag);
      return { tt, ppt, bub, tag, progress: 0, active: false };
    });

    // 胶头滴管与指示箭头
    const dropper = group(
      at(glass(new THREE.CylinderGeometry(0.06, 0.02, 0.9, 14).translate(0, 0.45, 0)), 0, 0, 0),
      at(cyl(0.09, 0.35, C.red, { seg: 14 }), 0, 0.9, 0),
    );
    dropper.position.set(XS[0], 2.9, Z);
    const dropBall = flat(new THREE.SphereGeometry(0.045, 10, 8), '#9fd0ff');
    dropBall.visible = false;
    const pointer = arrow(C.copper, 0.04);
    const info = at(card('\n\n', { w: 5.8, size: 0.25, align: 'left' }), 0, 0, 2.65);
    k.root.add(dropper, dropBall, pointer, info);

    const state = { sys: 0, prog: [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]], trig: [[false, false, false, false, false], [false, false, false, false, false]], dropT: 0 };

    const activeList = () => (p.sys === 1 ? S_TUBES : FE_TUBES);

    return {
      getState: () => state,
      getSample(par) {
        const s = par.sys ?? 0, idx = par.tube ?? 0;
        const item = (s === 1 ? S_TUBES : FE_TUBES)[idx];
        return {
          _kind: 'human',
          sysName: s === 1 ? '硫元素 (S)' : '铁元素 (Fe)',
          tubeName: item.name,
          eq: item.eq,
          phen: state.trig[s][idx] ? item.desc : '未滴加试剂（初始态）',
        };
      },
      press(id) {
        const s = p.sys ?? 0, idx = p.tube ?? 0;
        if (id === 'react') {
          state.trig[s][idx] = true;
          state.dropT = 1.0;
        } else if (id === 'resetTube') {
          state.trig[s].fill(false);
          state.prog[s].fill(0);
          state.dropT = 0;
        }
        k.dirty();
      },
      change() { k.dirty(); },
      update(dt) {
        const s = p.sys ?? 0, sel = p.tube ?? 0;
        const list = activeList();
        dropper.position.x = lerp(dropper.position.x, XS[sel], clamp(dt * 8, 0.15, 1));
        pointer.set([XS[sel], 3.35, Z + 0.55], [XS[sel], 2.95, Z + 0.2]);

        if (state.dropT > 0) {
          state.dropT = Math.max(0, state.dropT - dt * 1.4);
          dropBall.visible = true;
          dropBall.position.set(XS[sel], lerp(1.5, 2.85, state.dropT), Z);
        } else {
          dropBall.visible = false;
        }

        list.forEach((item, i) => {
          const target = state.trig[s][i] ? 1 : 0;
          state.prog[s][i] = lerp(state.prog[s][i], target, clamp(dt * 2.5, 0.08, 1));
          const f = state.prog[s][i];
          const col = mixHex(item.initCol, item.endCol, f);
          tubes[i].tt.tint(col, 0.62 + f * 0.2);
          tubes[i].ppt.visible = Boolean(item.ppt) && f > 0.18;
          if (tubes[i].ppt.visible) {
            tubes[i].ppt.material.color.set(item.ppt);
            tubes[i].ppt.scale.y = 0.2 + 0.8 * f;
          }
          tubes[i].bub.step(dt, item.bub && state.trig[s][i] ? 8 : 0, 1.58);
          tubes[i].tag.set(i === sel ? `▼${i + 1}` : `${i + 1}`);
        });

        const cur = list[sel];
        const reacted = state.trig[s][sel];
        info.set(`${cur.name} · ${reacted ? '已反应' : '待滴加试剂'}\n方程式：${cur.eq}\n现象：${reacted ? cur.desc : '点击“滴加试剂 / 反应”观察价态与颜色转化'}`);
      },
      margin() {
        const s = p.sys ?? 0, sel = p.tube ?? 0;
        const cur = activeList()[sel];
        return s === 0
          ? ['Fe 价态梯度：', 'Fe⁰ ↔ Fe²⁺ ↔ Fe³⁺', `当前：${cur.name}`, 'Fe³⁺ + SCN⁻ → 血红', 'Fe²⁺ + 铁氰化钾 → 蓝']
          : ['S 价态梯度：', 'S⁻² ↔ S⁰ ↔ S⁺⁴ ↔ S⁺⁶', `当前：${cur.name}`, '归中：-2 与 +4 → 0', '歧化：+2 → 0 与 +4'];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 价类二维转化交互图（Fe / S）');
    const row1 = document.createElement('div');
    row1.className = 'wb-btn-row';
    row1.innerHTML = `
      <button type="button" class="wb-btn primary" data-sys="0">铁及其化合物价类图</button>
      <button type="button" class="wb-btn" data-sys="1">含硫物质价类图</button>`;
    sec1.append(row1);

    const cv1 = wb.canvas(sec1, 520, 235, (x, W, H) => {
      const isS = (sp.params.sys ?? 0) === 1;
      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      const pad = { l: 52, r: 22, t: 24, b: 36 };
      const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;

      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.6;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();
      x.fillStyle = '#1e2b36'; x.font = 'bold 12px "Songti SC",serif';
      x.fillText('化合价', 10, pad.t + 10);

      const cats = isS ? ['氢化物', '单质', '氧化物', '含氧酸', '正盐'] : ['单质', '氧化物', '氢氧化物', '盐'];
      const vals = isS ? [6, 4, 2, 0, -2] : [3, 2, 0];
      const vy = (v) => isS
        ? pad.t + 18 + ((6 - v) / 8) * (ph - 36)
        : pad.t + 22 + ((3 - v) / 3) * (ph - 44);
      const cx = (i) => pad.l + ((i + 0.5) / cats.length) * pw;

      x.strokeStyle = 'rgba(30,43,54,0.12)'; x.lineWidth = 1;
      vals.forEach((v) => {
        const y = vy(v);
        x.beginPath(); x.moveTo(pad.l, y); x.lineTo(pad.l + pw, y); x.stroke();
        x.fillStyle = '#51606b'; x.font = '11px Georgia,serif'; x.textAlign = 'right';
        x.fillText(`${v > 0 ? '+' : ''}${v}`, pad.l - 8, y + 4);
      });
      cats.forEach((c, i) => {
        x.fillStyle = '#51606b'; x.font = '11.5px "Songti SC",serif'; x.textAlign = 'center';
        x.fillText(c, cx(i), H - 14);
      });

      const nodes = isS
        ? [
            [0, -2, 'H₂S'], [1, 0, 'S'], [2, 4, 'SO₂'], [2, 6, 'SO₃'],
            [3, 4, 'H₂SO₃'], [3, 6, 'H₂SO₄'], [4, 2, 'Na₂S₂O₃'], [4, 6, 'SO₄²⁻'],
          ]
        : [
            [0, 0, 'Fe'], [1, 2, 'FeO'], [1, 3, 'Fe₂O₃'],
            [2, 2, 'Fe(OH)₂'], [2, 3, 'Fe(OH)₃'], [3, 2, 'Fe²⁺'], [3, 3, 'Fe³⁺'],
          ];

      const edges = isS
        ? [
            [0, 1, '+O₂/SO₂', '#b4653a'], [2, 1, '+H₂S(归中)', '#1f4a3e'],
            [2, 7, '+Cl₂/KMnO₄', '#b4653a'], [5, 2, '+Cu(Δ)', '#1f4a3e'], [6, 1, '+H⁺(歧化)', '#7a5cff'],
          ]
        : [
            [0, 5, '+H⁺', '#b4653a'], [5, 6, '+Cl₂', '#b4653a'], [6, 5, '+Fe/+Cu', '#1f4a3e'],
            [3, 4, '+O₂+H₂O', '#b4653a'],
          ];

      edges.forEach(([a, b, lbl, col]) => {
        const na = nodes[a], nb = nodes[b];
        const x1 = cx(na[0]), y1 = vy(na[1]), x2 = cx(nb[0]), y2 = vy(nb[1]);
        x.strokeStyle = col; x.lineWidth = 1.8;
        x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke();
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        x.fillStyle = col; x.font = '10px Georgia,serif'; x.textAlign = 'center';
        x.fillText(lbl, mx, my - 5);
      });

      nodes.forEach(([ci, v, txt]) => {
        const px = cx(ci), py = vy(v);
        x.fillStyle = '#fffdf7'; x.strokeStyle = '#1e2b36'; x.lineWidth = 1.8;
        x.beginPath(); x.roundRect(px - 28, py - 11, 56, 22, 6); x.fill(); x.stroke();
        x.fillStyle = '#1e2b36'; x.font = 'bold 11.5px Georgia,serif'; x.textAlign = 'center';
        x.fillText(txt, px, py + 4);
      });
    });

    const sec2 = wb.section('2 · 双线桥氧化还原配平检验器');
    let eqIdx = 0;
    const eqWrap = document.createElement('div');
    sec2.append(eqWrap);

    const renderEq = () => {
      const eq = REDOX_EQS[eqIdx];
      const coeffs = eq.ans.map(() => 1);
      eqWrap.innerHTML = `
        <div class="wb-btn-row">
          ${REDOX_EQS.map((e, i) => `<button type="button" class="wb-btn ${i === eqIdx ? 'primary' : ''}" data-eq="${i}">${e.title}</button>`).join('')}
        </div>
        <div class="wb-row" style="font-family:Georgia,serif;font-size:15px;padding:8px 10px;background:#f7f1e1;border-radius:4px" data-form></div>
        <div class="wb-metrics" data-res></div>`;

      const form = eqWrap.querySelector('[data-form]');
      const res = eqWrap.querySelector('[data-res]');
      const terms = [...eq.lhs, ...eq.rhs];

      const rebuildInputs = () => {
        let html = '';
        eq.lhs.forEach((spName, i) => {
          html += `${i > 0 ? ' + ' : ''}<input type="number" min="1" max="9" value="${coeffs[i]}" data-ci="${i}" class="wb-input" style="width:44px;text-align:center"> <b>${spName}</b>`;
        });
        html += ' <span style="margin:0 6px">═</span> ';
        eq.rhs.forEach((spName, j) => {
          const idx = eq.lhs.length + j;
          html += `${j > 0 ? ' + ' : ''}<input type="number" min="1" max="9" value="${coeffs[idx]}" data-ci="${idx}" class="wb-input" style="width:44px;text-align:center"> <b>${spName}</b>`;
        });
        html += ` <button type="button" class="wb-btn primary" style="margin-left:auto" data-check>核对双线桥</button>`;
        form.innerHTML = html;
      };

      const check = () => {
        const k0 = coeffs[0] / eq.ans[0];
        const ratioOk = eq.ans.every((a, i) => Math.abs(coeffs[i] - a * k0) < 1e-6);
        const minOk = ratioOk && Math.abs(k0 - 1) < 1e-6;
        res.innerHTML = `
          <div class="wb-m"><span>双线桥电子得失</span><b>${eq.arrowTxt}</b></div>
          <div class="wb-m"><span>配平检验</span><b>${minOk ? `✓ 电子守恒且为最简整数比（转移 ${eq.eShift}e⁻）` : ratioOk ? '△ 比例守恒但未化为最简整数比' : '✗ 未配平：请核对化合价升降总数'}</b></div>`;
      };

      rebuildInputs();
      check();

      form.addEventListener('input', (e) => {
        const inp = e.target.closest('[data-ci]');
        if (!inp) return;
        coeffs[+inp.dataset.ci] = Math.max(1, parseInt(inp.value, 10) || 1);
        check();
      });
      form.addEventListener('click', (e) => {
        if (e.target.closest('[data-check]')) {
          check();
          const k0 = coeffs[0] / eq.ans[0];
          const minOk = eq.ans.every((a, i) => Math.abs(coeffs[i] - a * k0) < 1e-6) && Math.abs(k0 - 1) < 1e-6;
          if (minOk) {
            wb.record({
              _kind: 'human',
              sysName: (sp.params.sys ?? 0) === 1 ? '硫元素 (S)' : '铁元素 (Fe)',
              tubeName: `配平验证: ${eq.title}`,
              eq: `${eq.lhs.map((s, i) => (eq.ans[i] > 1 ? eq.ans[i] : '') + s).join(' + ')} = ${eq.rhs.map((s, j) => (eq.ans[eq.lhs.length + j] > 1 ? eq.ans[eq.lhs.length + j] : '') + s).join(' + ')}`,
              phen: `电子转移总数 ${eq.eShift}e⁻ 守恒通过`,
            });
          }
        }
      });
      void terms;
    };

    eqWrap.addEventListener('click', (e) => {
      const b = e.target.closest('[data-eq]');
      if (!b) return;
      eqIdx = +b.dataset.eq;
      renderEq();
    });
    row1.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sys]');
      if (!b) return;
      wb.setParam('sys', +b.dataset.sys);
      row1.querySelectorAll('[data-sys]').forEach((x) => x.classList.toggle('primary', x === b));
      cv1.redraw();
    });

    cv1.redraw();
    renderEq();
    return { update() { cv1.redraw(); } };
  },
};

// ================================================================ 3. 粗盐提纯试剂顺序与残余离子矩阵 (L3)
function evaluateSaltSequence(seq) {
  const ions = { Na: true, Cl: true, SO4: true, Ca: true, Mg: true, Ba: false, OH: false, CO3: false };
  const ppts = { BaSO4: false, MgOH2: false, CaCO3: false, BaCO3: false };
  const trace = [];
  let filtered = false;
  for (const op of seq) {
    if (op === 'BaCl2') {
      if (ions.SO4) { ions.SO4 = false; ppts.BaSO4 = true; }
      ions.Ba = true;
    } else if (op === 'NaOH') {
      if (ions.Mg) { ions.Mg = false; ppts.MgOH2 = true; }
      ions.OH = true;
    } else if (op === 'Na2CO3') {
      if (ions.Ca) { ions.Ca = false; ppts.CaCO3 = true; }
      if (ions.Ba) { ions.Ba = false; ppts.BaCO3 = true; }
      ions.CO3 = true;
    } else if (op === '过滤') {
      ppts.BaSO4 = ppts.MgOH2 = ppts.CaCO3 = ppts.BaCO3 = false;
      filtered = true;
    } else if (op === 'HCl') {
      ions.OH = false;
      ions.CO3 = false;
      // 若尚未过滤就加盐酸，酸溶性沉淀重新溶解返混！
      if (ppts.MgOH2) { ppts.MgOH2 = false; ions.Mg = true; }
      if (ppts.CaCO3) { ppts.CaCO3 = false; ions.Ca = true; }
      if (ppts.BaCO3) { ppts.BaCO3 = false; ions.Ba = true; }
    }
    trace.push({ op, ions: { ...ions }, ppts: { ...ppts }, filtered });
  }
  const hasBa = ions.Ba, hasCO3 = ions.CO3, hasOH = ions.OH, hasCa = ions.Ca, hasMg = ions.Mg, hasSO4 = ions.SO4;
  const all5 = ['BaCl2', 'NaOH', 'Na2CO3', '过滤', 'HCl'].every((x) => seq.includes(x));
  const iBa = seq.indexOf('BaCl2'), iCO3 = seq.indexOf('Na2CO3'), iFil = seq.indexOf('过滤'), iHCl = seq.indexOf('HCl');
  const pure = all5 && !hasBa && !hasCO3 && !hasOH && !hasCa && !hasMg && !hasSO4 && iCO3 > iBa && iHCl > iFil;
  let reason = '';
  if (!all5) reason = '步骤尚未完整覆盖五项操作 (BaCl₂, NaOH, Na₂CO₃, 过滤, HCl)';
  else if (iCO3 < iBa) reason = '错误：Na₂CO₃ 在 BaCl₂ 之前加入，过量 Ba²⁺ 无法被除去！';
  else if (iHCl < iFil) reason = '错误：HCl 在过滤之前加入，Mg(OH)₂/CaCO₃/BaCO₃ 沉淀重新溶解！';
  else if (iFil < Math.max(iBa, seq.indexOf('NaOH'), iCO3)) reason = '错误：过滤过早，后续仍有沉淀停留在溶液中未滤除！';
  else if (pure) reason = '✓ 成功！过量 Ba²⁺ 已由 Na₂CO₃ 沉淀，过滤后 HCl 除去 OH⁻/CO₃²⁻ 并蒸发得纯净 NaCl';
  return { ions, ppts, pure, reason, trace };
}

export const crudeSalt = {
  id: 'chem-crude-salt',
  subject: 'chem',
  title: '粗盐提纯与除杂试剂顺序诊断',
  en: 'Crude salt purification sequencing & residual ion matrix',
  lede: [
    '粗盐水中除 Na⁺、Cl⁻ 外，还混有 SO₄²⁻、Ca²⁺、Mg²⁺ 三类可溶性杂质。为了除尽杂质又不引入新杂质，必须使用过量的 BaCl₂、NaOH、Na₂CO₃，再配合过滤与盐酸调酸。',
    '试剂先后并非任意：一旦把 Na₂CO₃ 放在 BaCl₂ 之前，或把 HCl 加在过滤之前，残余离子矩阵就会立刻亮起红灯。亲自组合加药顺序并诊断残余离子！',
  ],
  formula: 'Ba²⁺ + SO₄²⁻ = BaSO₄↓ · Mg²⁺ + 2OH⁻ = Mg(OH)₂↓ · Ca²⁺/Ba²⁺ + CO₃²⁻ = MCO₃↓',
  formulaNote: '铁律 1：Na₂CO₃ 必须在 BaCl₂ 之后（兼除 Ca²⁺ 与过量 Ba²⁺）；铁律 2：HCl 必须在过滤之后（防沉淀复溶）',
  terms: [
    ['过量原则', '为使杂质离子沉淀完全，除杂试剂须略微过量，过量试剂再由后续步骤除去'],
    ['顺序约束', 'BaCl₂ → Na₂CO₃（先除 SO₄²⁻，再用 CO₃²⁻ 一并除去 Ca²⁺ 与过量 Ba²⁺）'],
    ['酸化时机', '必须在过滤除去所有沉淀之后再滴加稀盐酸中和过量 OH⁻ 与 CO₃²⁻'],
  ],
  predict: {
    q: '以下哪种操作顺序能最终得到纯净的 NaCl 溶液（经蒸发结晶得精盐）？',
    options: [
      'Na₂CO₃ → NaOH → BaCl₂ → 过滤 → HCl',
      'BaCl₂ → NaOH → Na₂CO₃ → HCl → 过滤',
      'NaOH → BaCl₂ → Na₂CO₃ → 过滤 → HCl',
    ],
    answer: 2,
    why: '选项 1 导致过量 Ba²⁺ 残留；选项 2 在过滤前加 HCl 使 CaCO₃、BaCO₃、Mg(OH)₂ 重新溶解；只有选项 3 满足 Na₂CO₃ 在 BaCl₂ 之后且 HCl 在过滤之后。',
  },
  challenge: '尝试用至少两种不同但都合法的加药顺序得到“纯净 NaCl”；再故意把 HCl 放在过滤前，观察 Ba²⁺、Ca²⁺、Mg²⁺ 如何返混回溶液！',
  fig: '粗盐水反应烧杯、沉淀沉积层、漏斗过滤台与残余离子警示板',
  hint: '按任意顺序点击下方试剂与过滤按钮，右侧实时显示溶液中残余离子与沉淀层；也可在工作台查看每步的残余离子矩阵。',
  teach: {
    where: '人教版化学必修第一册第一/二章（经典探究：粗盐中可溶性杂质的去除）',
    ask: [
      '列出满足“除去所有杂质且不留新杂质”的 3 种合法试剂加入顺序。',
      '为什么不能用 KOH 代替 NaOH、或用 K₂CO₃ 代替 Na₂CO₃、或用稀硫酸代替稀盐酸？',
    ],
    simplify: '设各步除杂试剂均足量微过量（恰好完全沉淀目标离子）；蒸发结晶阶段过量 HCl 随水蒸气挥发除尽。',
    safety: 'BaCl₂ 为可溶性重金属钡盐有毒，真实实验严禁入口并需回收含钡废液。',
  },
  controls: [
    { id: 'addBa', type: 'button', label: '+ BaCl₂ (除SO₄²⁻)' },
    { id: 'addNaOH', type: 'button', label: '+ NaOH (除Mg²⁺)' },
    { id: 'addCO3', type: 'button', label: '+ Na₂CO₃ (除Ca²⁺/Ba²⁺)' },
    { id: 'filter', type: 'button', label: '过滤 (滤除沉淀)' },
    { id: 'addHCl', type: 'button', label: '+ HCl (中和调pH)' },
    { id: 'resetSalt', type: 'button', label: '重置粗盐水' },
  ],
  record: {
    note: '完成一整套提纯序列后，记入试剂顺序、是否得到纯净 NaCl 及残余杂质离子。',
    pending: '请先依次点击加药与过滤操作，再记录该提纯方案结果。',
    columns: [
      { key: 'seqStr', label: '操作顺序' },
      { key: 'pureStr', label: '提纯判定' },
      { key: 'remain', label: '最终残余杂质离子' },
    ],
    sample: (inst) => inst.getSample?.(),
    summary: (rows) => [
      ['已测试方案', `${rows.length} 套`],
      ['纯品达成数', `${rows.filter((r) => r.pureStr === '✓ 纯净 NaCl').length} 套`],
    ],
    errors: [
      '遗漏某一步试剂或把 Na₂CO₃ 放在 BaCl₂ 之前会导致 Ba²⁺ 残余。',
      '先加 HCl 后过滤会让碳酸盐与氢氧化物沉淀重新溶回溶液。',
    ],
  },

  build(k) {
    const X = -1.3, Z = -0.6;
    const bkr = at(makeBeaker(1.25, 2.35), X, 0.04, Z);
    bkr.fill(1.55);
    const pptLayer = at(cyl(1.18, 0.25, '#f2efe4', { seg: 32 }), X, 0.08, Z);
    pptLayer.visible = false;
    const bub = bubbler(16, { x: X, z: Z, rad: 0.55, y0: 0.4, r: 0.045, speed: 1.7 });

    // 漏斗与滤液接收瓶（过滤时显示滤纸漏斗在上方或右侧）
    const funnel = at(group(
      glass(new THREE.ConeGeometry(0.75, 0.95, 28, 1, true).rotateX(Math.PI).translate(0, 1.3, 0)),
      glass(new THREE.CylinderGeometry(0.11, 0.09, 0.85, 16).translate(0, 0.45, 0)),
      at(cone(0.68, 0.78, '#fffdf5', { open: true }), 0, 1.68, 0),
    ), X + 2.4, 1.25, Z);
    funnel.rotation.z = 0;
    const recvBkr = at(makeBeaker(0.85, 1.55), X + 2.4, 0.04, Z);
    const rodF = rod([X + 1.5, 2.8, Z], [X + 2.25, 1.9, Z], 0.03, '#eef4f2');

    const statusBoard = at(sheet(3.6, 2.25, () => {}, { opaque: true, ink: true, lay: 'tilt' }), 2.35, 0, 0.5);
    const info = at(card('\n\n', { w: 4.8, size: 0.25, align: 'left' }), -1.1, 0, 2.75);
    k.root.add(bkr, pptLayer, bub, funnel, recvBkr, rodF, statusBoard, info);

    let seq = [], co2Burst = 0, lastKey = '';
    const mapOp = { addBa: 'BaCl2', addNaOH: 'NaOH', addCO3: 'Na2CO3', filter: '过滤', addHCl: 'HCl' };

    const redrawBoard = (ev) => {
      const kStr = seq.join('>') + '|' + ev.pure;
      if (kStr === lastKey) return;
      lastKey = kStr;
      statusBoard.redraw((x, s, w, h) => {
        x.fillStyle = '#fffdf7'; x.fillRect(0, 0, w * s, h * s);
        x.strokeStyle = C.ink; x.lineWidth = s * 0.025; x.strokeRect(0.02 * s, 0.02 * s, (w - 0.04) * s, (h - 0.04) * s);
        x.fillStyle = C.ink; x.font = `bold ${s * 0.19}px "Songti SC",serif`;
        x.fillText('溶液中实时离子监测', 0.16 * s, 0.28 * s);
        const list = [
          ['SO₄²⁻', ev.ions.SO4], ['Mg²⁺', ev.ions.Mg], ['Ca²⁺', ev.ions.Ca],
          ['Ba²⁺', ev.ions.Ba], ['OH⁻', ev.ions.OH], ['CO₃²⁻', ev.ions.CO3],
        ];
        list.forEach(([nm, on], i) => {
          const col = i % 3, row = Math.floor(i / 3);
          const bx = (0.18 + col * 1.12) * s, by = (0.52 + row * 0.55) * s;
          x.fillStyle = on ? '#fbe3df' : '#dff2e7';
          x.fillRect(bx, by, 1.0 * s, 0.42 * s);
          x.strokeStyle = on ? '#c63d2f' : '#1f4a3e'; x.lineWidth = s * 0.015;
          x.strokeRect(bx, by, 1.0 * s, 0.42 * s);
          x.fillStyle = on ? '#9c2318' : '#1f4a3e';
          x.font = `bold ${s * 0.16}px Georgia,serif`;
          x.fillText(`${nm}: ${on ? '存在' : '已除'}`, bx + 0.08 * s, by + 0.27 * s);
        });
        x.fillStyle = ev.pure ? '#1f4a3e' : '#8a4326';
        x.font = `bold ${s * 0.16}px "Songti SC",serif`;
        x.fillText(ev.pure ? '结论：纯净 NaCl 溶液！' : '提示：尚有杂质或步骤未完成', 0.18 * s, 1.92 * s);
      });
    };

    return {
      getSeq: () => [...seq],
      setSeq(newSeq) { seq = [...newSeq]; k.dirty(); },
      getSample() {
        if (!seq.length) return null;
        const ev = evaluateSaltSequence(seq);
        const rem = ['SO4', 'Ca', 'Mg', 'Ba', 'OH', 'CO3'].filter((kIon) => ev.ions[kIon]);
        return {
          _kind: 'human',
          seqStr: seq.join(' → '),
          pureStr: ev.pure ? '✓ 纯净 NaCl' : '✗ 含杂质',
          remain: rem.length ? rem.join(', ') : '无（纯 NaCl）',
        };
      },
      press(id) {
        if (id === 'resetSalt') { seq = []; co2Burst = 0; lastKey = ''; }
        else if (mapOp[id]) {
          const op = mapOp[id];
          const prev = evaluateSaltSequence(seq);
          seq.push(op);
          if (op === 'HCl' && (prev.ions.CO3 || prev.ppts.CaCO3 || prev.ppts.BaCO3)) co2Burst = 2.5;
        }
        k.dirty();
      },
      update(dt) {
        const ev = evaluateSaltSequence(seq);
        redrawBoard(ev);
        const pptCount = Object.values(ev.ppts).filter(Boolean).length;
        pptLayer.visible = pptCount > 0;
        if (pptLayer.visible) pptLayer.scale.y = 0.4 + pptCount * 0.35;
        bkr.tint(pptCount > 0 ? '#ebe7d8' : '#d6ecfa', pptCount > 0 ? 0.78 : 0.45);
        recvBkr.fill(seq.includes('过滤') ? 1.05 : 0.05);
        if (co2Burst > 0) co2Burst = Math.max(0, co2Burst - dt);
        bub.step(dt, co2Burst > 0 ? 14 : 0, 1.55);
        info.set(`当前序列：${seq.length ? seq.join(' → ') : '（原始粗盐水：含 Na⁺, Cl⁻, SO₄²⁻, Ca²⁺, Mg²⁺）'}\n${ev.reason}`);
      },
      margin() {
        const ev = evaluateSaltSequence(seq);
        const pList = Object.entries(ev.ppts).filter(([, v]) => v).map(([n]) => n);
        return [
          '除杂五步铁律：',
          '1. Na₂CO₃ 在 BaCl₂ 后',
          '2. HCl 在 过滤 之后',
          `当前步骤数：${seq.length}`,
          `容器沉淀：${pList.length ? pList.join(',') : '无'}`,
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec = wb.section('1 · 试剂顺序编排与残余离子矩阵诊断');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn" data-add="BaCl2">+ BaCl₂</button>
      <button type="button" class="wb-btn" data-add="NaOH">+ NaOH</button>
      <button type="button" class="wb-btn" data-add="Na2CO3">+ Na₂CO₃</button>
      <button type="button" class="wb-btn" data-add="过滤">+ 过滤</button>
      <button type="button" class="wb-btn" data-add="HCl">+ HCl</button>
      <button type="button" class="wb-btn primary" data-preset="good">合法范例</button>
      <button type="button" class="wb-btn" data-preset="badBa">反例(Ba²⁺残留)</button>
      <button type="button" class="wb-btn" data-preset="badHCl">反例(沉淀复溶)</button>
      <button type="button" class="wb-btn" data-clear>清空</button>
      <button type="button" class="wb-btn" data-log>记录方案</button>`;
    sec.append(bar);

    const cv = wb.canvas(sec, 520, 240, (x, W, H) => {
      const seq = sp.inst?.getSeq?.() || [];
      const ev = evaluateSaltSequence(seq);
      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      const cols = ['初始粗盐', ...ev.trace.map((t) => t.op)];
      const ionRows = [
        ['SO₄²⁻', 'SO4'], ['Mg²⁺', 'Mg'], ['Ca²⁺', 'Ca'],
        ['Ba²⁺', 'Ba'], ['OH⁻', 'OH'], ['CO₃²⁻', 'CO3'],
      ];
      const cellW = Math.min(82, (W - 76) / Math.max(1, cols.length));
      const rowH = 26, topY = 34, leftX = 66;

      x.fillStyle = '#1e2b36'; x.font = 'bold 12px "Songti SC",serif'; x.textAlign = 'center';
      cols.forEach((cName, j) => {
        x.fillText(cName, leftX + j * cellW + cellW / 2, 20);
      });

      ionRows.forEach(([lbl, key], i) => {
        const y = topY + i * rowH;
        x.fillStyle = '#1e2b36'; x.font = 'bold 12px Georgia,serif'; x.textAlign = 'right';
        x.fillText(lbl, leftX - 8, y + 17);
        cols.forEach((_, j) => {
          const stateIons = j === 0
            ? { SO4: true, Mg: true, Ca: true, Ba: false, OH: false, CO3: false }
            : ev.trace[j - 1].ions;
          const present = stateIons[key];
          const cx0 = leftX + j * cellW + 3;
          x.fillStyle = present ? '#fbe3df' : '#dff2e7';
          x.fillRect(cx0, y + 2, cellW - 6, rowH - 4);
          x.strokeStyle = present ? '#d04a3b' : '#2f7a5e'; x.lineWidth = 1;
          x.strokeRect(cx0, y + 2, cellW - 6, rowH - 4);
          x.fillStyle = present ? '#9e2618' : '#1f4a3e';
          x.font = '11px "Songti SC",serif'; x.textAlign = 'center';
          x.fillText(present ? '存在' : '无', cx0 + (cellW - 6) / 2, y + 17);
        });
      });

      x.fillStyle = ev.pure ? '#1f4a3e' : '#b43e2e';
      x.font = 'bold 12.5px "Songti SC",serif'; x.textAlign = 'left';
      x.fillText(ev.reason, 14, H - 14);
    });

    const diag = document.createElement('div');
    diag.className = 'wb-metrics';
    sec.append(diag);

    const refresh = () => {
      cv.redraw();
      const seq = sp.inst?.getSeq?.() || [];
      const ev = evaluateSaltSequence(seq);
      const rem = ['SO4', 'Ca', 'Mg', 'Ba', 'OH', 'CO3'].filter((k) => ev.ions[k]);
      diag.innerHTML = `
        <div class="wb-m"><span>当前序列</span><b>${seq.length ? seq.join(' → ') : '未加药'}</b></div>
        <div class="wb-m"><span>残余杂质</span><b>${rem.length ? rem.join(', ') : '无（纯 NaCl）'}</b></div>
        <div class="wb-m"><span>纯度结论</span><b>${ev.pure ? '✓ 合格精盐' : '✗ 不纯'}</b></div>`;
    };

    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const cur = sp.inst?.getSeq?.() || [];
      if (btn.dataset.add) sp.inst?.setSeq?.([...cur, btn.dataset.add]);
      else if (btn.dataset.preset === 'good') sp.inst?.setSeq?.(['BaCl2', 'NaOH', 'Na2CO3', '过滤', 'HCl']);
      else if (btn.dataset.preset === 'badBa') sp.inst?.setSeq?.(['Na2CO3', 'NaOH', 'BaCl2', '过滤', 'HCl']);
      else if (btn.dataset.preset === 'badHCl') sp.inst?.setSeq?.(['BaCl2', 'NaOH', 'Na2CO3', 'HCl', '过滤']);
      else if ('clear' in btn.dataset) sp.inst?.setSeq?.([]);
      else if ('log' in btn.dataset) {
        const row = sp.inst?.getSample?.();
        if (row) wb.record(row);
      }
      refresh();
    });

    refresh();
    return { update() { refresh(); } };
  },
};

// ================================================================ 4. 元素周期律：第三周期金属与 VIIA 族卤素递变 (L3)
const PERIOD3_DATA = [
  { sym: 'Na', z: 11, ie1: 496, r: 186, en: 0.93 },
  { sym: 'Mg', z: 12, ie1: 738, r: 160, en: 1.31 },
  { sym: 'Al', z: 13, ie1: 578, r: 143, en: 1.61 },
  { sym: 'Si', z: 14, ie1: 787, r: 117, en: 1.90 },
  { sym: 'P',  z: 15, ie1: 1012, r: 110, en: 2.19 },
  { sym: 'S',  z: 16, ie1: 1000, r: 104, en: 2.58 },
  { sym: 'Cl', z: 17, ie1: 1251, r: 99,  en: 3.16 },
];

export const periodic = {
  id: 'chem-periodic',
  subject: 'chem',
  title: '同周期与同主族元素性质递变规律',
  en: 'Period-3 metal reactivity & Group-VIIA halogen displacement',
  lede: [
    '同一周期从左到右，原子半径减小、核电荷吸引增强，金属性减弱而非金属性增强（Na > Mg > Al）；同一主族从上到下，电子层数增加，卤素氧化性 Cl₂ > Br₂ > I₂ 依次减弱。',
    '左台对照 Na、Mg、Al 与冷水、热水或盐酸的反应剧烈程度；切换卤素置换模式，用 CCl₄ 萃取观察 Br₂ 的橙红色与 I₂ 的紫红色有机层！',
  ],
  formula: '金属性：Na > Mg > Al · 氧化性：Cl₂ > Br₂ > I₂ · Cl₂ + 2I⁻ = 2Cl⁻ + I₂',
  formulaNote: '注意第一电离能的反常：Mg(3s² 全满) > Al(3p¹)，P(3p³ 半满) > S(3p⁴)',
  terms: [
    ['金属性判据', '单质与水或酸置换出 H₂ 的难易及剧烈程度、最高价氧化物对应水化物的碱性强弱'],
    ['卤素置换', '氧化性强的高能卤素单质把氧化性弱的卤素从其盐溶液中置换出来，CCl₄ 萃取显色（下层）'],
    ['第一电离能反常', '第 IIA 族 ns² 全满、第 VA 族 np³ 半满构型更稳定，导致 I₁ 高于相邻后一位元素'],
  ],
  predict: {
    q: '向 NaBr 溶液中滴入少量新制氯水，再加入 CCl₄ 振荡静置后，试管下层（有机层）呈什么颜色？',
    options: ['无色', '橙红色（Br₂ 溶于 CCl₄）', '紫红色（I₂ 溶于 CCl₄）'],
    answer: 1,
    why: 'Cl₂ 氧化性强于 Br₂，发生 Cl₂ + 2Br⁻ = 2Cl⁻ + Br₂。由于 CCl₄ 密度 (1.59 g/cm³) 大于水且 Br₂ 易溶于 CCl₄，下层有机相呈橙红色；I₂ 在 CCl₄ 中呈紫红色。',
  },
  challenge: '分别运行 Na/Mg/Al 与冷水及盐酸对照；再切至 VIIA 卤素模式对比 Cl₂ 水与 Br₂ 水对 NaCl、NaBr、KI 溶液的置换萃取结果。',
  fig: '三联对照反应容器（金属反应烧杯 / 卤素 CCl₄ 分液萃取试管）',
  hint: '选择探究模式与试剂条件，点击“投入试剂观察”；展开工作台切换查看原子半径、电负性与第一电离能曲线。',
  teach: {
    where: '人教版化学必修第一册第四章 §4.2《元素周期律》与选择性必修 2 第一章《原子结构与性质》',
    ask: [
      '比较 Mg 与冷水、热水反应的不同现象，如何体现温度与金属性相对强弱？',
      '为什么第三周期第一电离能出现 Mg > Al 与 P > S 两个“反常峰”？',
    ],
    simplify: '反应气泡速率按典型相对剧烈程度建模（Na 浮熔游响红，Mg 热水显泡、酸中剧烈）；CCl₄ 萃取层颜色直接呈现特征有机相色。',
    safety: '金属钠切绿豆大小并在烧杯加盖玻璃片防溅；氯水与 CCl₄ 均须在通风条件下微量操作。',
  },
  controls: [
    { id: 'mode', type: 'choice', label: '实验组别', options: ['第三周期金属 (Na/Mg/Al)', 'VIIA 族卤素置换 (CCl₄)'], value: 0 },
    { id: 'reag', type: 'choice', label: '对照试剂', options: ['试剂 A (冷水酚酞 / 氯水)', '试剂 B (1M 盐酸 / 溴水)'], value: 0 },
    { id: 'heat', type: 'toggle', label: '水浴加热 (80°C)', value: false },
    { id: 'runP', type: 'button', label: '投入试剂观察' },
    { id: 'resetP', type: 'button', label: '复位' },
  ],
  record: {
    note: '记录每一组对照实验的条件与三联现象，总结同周期与同主族递变结论。',
    pending: '点击“投入试剂观察”触发三联现象后再记入实验册。',
    columns: [
      { key: 'modeName', label: '探究体系' },
      { key: 'cond', label: '试剂与条件' },
      { key: 'obs', label: '三联对比现象' },
      { key: 'concl', label: '递变结论' },
    ],
    sample: (inst, p) => inst.getSample?.(p),
    summary: (rows) => [
      ['已录入对比组', `${rows.length} 组`],
      ['最新探究', rows.length ? rows[rows.length - 1].modeName : '—'],
    ],
    errors: [
      '检验 Mg、Al 与酸反应速率前须用砂纸打磨表面氧化膜（Al₂O₃/MgO），否则初始阶段被钝化掩盖。',
      'CCl₄ 密度大于水（在下层），苯或汽油密度小于水（在上层），切忌混淆萃取层位置。',
    ],
  },

  build(k) {
    const p = k.p, Z = -0.6, XS = [-2.2, 0, 2.2];
    const vessels = XS.map((x, idx) => {
      const bkr = at(makeBeaker(0.85, 2.0), x, 0.04, Z);
      bkr.fill(1.3);
      const botLayer = at(cyl(0.8, 0.55, '#eef5fa', { seg: 32 }), x, 0.08, Z);
      botLayer.visible = false;
      const piece = at(ball(0.16, ['#e8ecf0', '#bfc8cf', '#d5dce2'][idx]), x, 0.25, Z);
      const bub = bubbler(16, { x, z: Z, rad: 0.35, y0: 0.3, r: 0.045, speed: 1.8 });
      const tag = at(note('', { size: 0.3, bold: true }), x, 2.38, Z);
      k.root.add(bkr, botLayer, piece, bub, tag);
      return { bkr, botLayer, piece, bub, tag };
    });

    const info = at(card('\n\n', { w: 5.8, size: 0.25, align: 'left' }), 0, 0, 2.55);
    k.root.add(info);

    let active = false, elapsed = 0;

    return {
      getSample(par) {
        if (!active) return null;
        const m = par.mode ?? 0, r = par.reag ?? 0;
        if (m === 0) {
          const cond = r === 0 ? (par.heat ? '热水(+酚酞)' : '冷水(+酚酞)') : '1 mol/L HCl';
          const obs = r === 0
            ? `Na:剧烈游动变红; Mg:${par.heat ? '冒较多气泡微红' : '极缓慢微泡'}; Al:几乎无泡`
            : 'Na:剧烈爆炸式产气; Mg:迅速大量产气; Al:平稳产生气泡';
          return { _kind: 'human', modeName: '第三周期金属', cond, obs, concl: '金属性 Na > Mg > Al' };
        }
        const cond = r === 0 ? '滴加 Cl₂水 + CCl₄' : '滴加 Br₂水 + CCl₄';
        const obs = r === 0
          ? 'NaCl:无变化; NaBr:下层橙红(Br₂); KI:下层紫红(I₂)'
          : 'NaCl:无置换(上浅橙); NaBr:无变化; KI:下层紫红(I₂)';
        return { _kind: 'human', modeName: 'VIIA 族卤素', cond, obs, concl: '氧化性 Cl₂ > Br₂ > I₂' };
      },
      press(id) {
        if (id === 'runP') { active = true; elapsed = 0; }
        else if (id === 'resetP') { active = false; elapsed = 0; }
        k.dirty();
      },
      change() { active = false; elapsed = 0; k.dirty(); },
      update(dt, t) {
        if (active) elapsed += dt;
        const f = active ? clamp(elapsed / 1.5, 0, 1) : 0;
        const m = p.mode ?? 0, r = p.reag ?? 0;
        if (m === 0) {
          const names = ['Na', 'Mg', 'Al'];
          vessels.forEach((v, i) => {
            v.tag.set(names[i]);
            v.botLayer.visible = false;
            v.piece.visible = true;
            if (i === 0) {
              v.piece.position.set(XS[0] + (active ? Math.sin(t * 9) * 0.35 : 0), 1.32, Z + (active ? Math.cos(t * 7) * 0.25 : 0));
              v.piece.scale.setScalar(active ? Math.max(0.15, 1 - f * 0.65) : 1);
            } else {
              v.piece.position.set(XS[i], 0.24, Z);
              v.piece.scale.setScalar(1);
            }
            const pinkCol = r === 0 && i === 0 ? mixHex('#d6ecfa', '#e02478', f)
              : r === 0 && i === 1 && p.heat ? mixHex('#d6ecfa', '#f2a5c8', f * 0.65)
              : '#d6ecfa';
            v.bkr.tint(pinkCol, 0.55);
            const rateBub = !active ? 0 : r === 0
              ? [18, p.heat ? 6 : 0.7, 0][i]
              : [24, 14, 6][i];
            v.bub.step(dt, rateBub, 1.32);
          });
          info.set(`第三周期金属递变 · 条件：${r === 0 ? (p.heat ? '80°C 水 + 酚酞' : '25°C 冷水 + 酚酞') : '1 mol/L 稀盐酸'}\n${active ? (r === 0 ? 'Na 浮熔游响并变紫红；Mg 热水泡增多；Al 无明显变化' : '剧烈程度：Na ≫ Mg > Al，失电子能力依次减弱') : '点击“投入试剂观察”对比三者与水或酸的反应剧烈程度'}`);
        } else {
          const names = ['NaCl + CCl₄', 'NaBr + CCl₄', 'KI + CCl₄'];
          vessels.forEach((v, i) => {
            v.tag.set(names[i]);
            v.piece.visible = false;
            v.botLayer.visible = true;
            v.bub.step(dt, 0, 1.3);
            let topC = '#e2eff8', botC = '#edf2f5';
            if (active) {
              if (r === 0) { // Cl2水
                if (i === 0) topC = '#eff7d8';
                if (i === 1) botC = mixHex('#edf2f5', '#e85a1b', f);
                if (i === 2) botC = mixHex('#edf2f5', '#7b2cbf', f);
              } else { // Br2水
                if (i === 0 || i === 1) botC = mixHex('#edf2f5', '#f39c4b', f * 0.55);
                if (i === 2) botC = mixHex('#edf2f5', '#7b2cbf', f);
              }
            }
            v.bkr.tint(topC, 0.42);
            v.botLayer.material.color.set(botC);
          });
          info.set(`VIIA 族卤素置换 · 试剂：${r === 0 ? '新制 Cl₂ 水' : '饱和 Br₂ 水'} + 下层 CCl₄\n${active ? (r === 0 ? 'Cl₂ 置换出 Br₂(橙红) 与 I₂(紫红)' : 'Br₂ 可置换出 I₂(紫红)，不能置换 Cl₂') : '点击“投入试剂观察”对比 CCl₄ 下层有机相特征显色'}`);
        }
      },
      margin() {
        return (p.mode ?? 0) === 0
          ? ['第三周期递变：', 'r: Na > Mg > Al', '金属性：Na > Mg > Al', 'I₁ 反常：Mg > Al']
          : ['VIIA 族卤素递变：', '氧化性 Cl₂ > Br₂ > I₂', 'CCl₄ 密度 > 水(下层)', 'Br₂ 橙红 · I₂ 紫红'];
      },
    };
  },

  buildWorkbench(wb) {
    const sec = wb.section('1 · 第三周期（Na → Cl）原子结构与性质递变图谱');
    let prop = 'ie1';
    const row = document.createElement('div');
    row.className = 'wb-btn-row';
    row.innerHTML = `
      <button type="button" class="wb-btn primary" data-prop="ie1">第一电离能 I₁ (kJ/mol)</button>
      <button type="button" class="wb-btn" data-prop="r">原子半径 r (pm)</button>
      <button type="button" class="wb-btn" data-prop="en">电负性 χ (Pauling)</button>`;
    sec.append(row);

    const cv = wb.canvas(sec, 520, 230, (x, W, H) => {
      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      const pad = { l: 54, r: 22, t: 24, b: 36 };
      const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      const vals = PERIOD3_DATA.map((d) => d[prop]);
      const yMin = prop === 'ie1' ? 400 : prop === 'r' ? 80 : 0.5;
      const yMax = prop === 'ie1' ? 1350 : prop === 'r' ? 200 : 3.5;
      const sx = (i) => pad.l + ((i + 0.5) / PERIOD3_DATA.length) * pw;
      const sy = (v) => pad.t + ph - ((v - yMin) / (yMax - yMin)) * ph;

      x.strokeStyle = 'rgba(30,43,54,0.1)'; x.lineWidth = 1;
      for (let k = 0; k <= 4; k++) {
        const y = pad.t + (ph * k) / 4;
        x.beginPath(); x.moveTo(pad.l, y); x.lineTo(pad.l + pw, y); x.stroke();
      }
      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.6;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();

      x.strokeStyle = '#b4653a'; x.lineWidth = 2.4; x.beginPath();
      vals.forEach((v, i) => { if (i === 0) x.moveTo(sx(i), sy(v)); else x.lineTo(sx(i), sy(v)); });
      x.stroke();

      PERIOD3_DATA.forEach((d, i) => {
        const px = sx(i), py = sy(d[prop]);
        const anomaly = prop === 'ie1' && (d.sym === 'Mg' || d.sym === 'P');
        x.fillStyle = anomaly ? '#e5483f' : '#1f4a3e';
        x.beginPath(); x.arc(px, py, anomaly ? 6 : 4.5, 0, TAU); x.fill();
        x.fillStyle = '#1e2b36'; x.font = 'bold 12px Georgia,serif'; x.textAlign = 'center';
        x.fillText(d.sym, px, H - 15);
        x.font = '11px Georgia,serif';
        x.fillText(String(d[prop]), px, py - 10);
      });

      x.fillStyle = '#51606b'; x.font = '11.5px "Songti SC",serif'; x.textAlign = 'left';
      x.fillText(prop === 'ie1' ? '红点标注全满(Mg 3s²)与半满(P 3p³)电离能反常升高' : prop === 'r' ? '核电荷数增大，原子半径单调减小' : '对键合电子吸引能力单调递增', pad.l + 8, pad.t + 14);
    });

    row.addEventListener('click', (e) => {
      const b = e.target.closest('[data-prop]');
      if (!b) return;
      prop = b.dataset.prop;
      row.querySelectorAll('[data-prop]').forEach((kBtn) => kBtn.classList.toggle('primary', kBtn === b));
      cv.redraw();
    });
    cv.redraw();
    return { update() { cv.redraw(); } };
  },
};

// ================================================================ 5. 焰色试验与发射光谱鉴定 (L3)
const FLAME_SALTS = [
  { name: '钠 Na', col: '#ffc31f', desc: '黄色', lines: [[589.0, 1.0], [589.6, 0.9]] },
  { name: '钾 K (含钠杂质)', col: '#ffcf55', desc: '黄色掩盖紫色', lines: [[404.4, 0.45], [589.0, 0.95], [693.9, 0.35], [766.5, 0.55]] },
  { name: '纯钾 K', col: '#c084fc', desc: '浅紫色', lines: [[404.4, 0.72], [404.7, 0.65], [693.9, 0.4], [766.5, 0.85]] },
  { name: '锂 Li', col: '#ff3d6e', desc: '紫红色', lines: [[610.4, 0.45], [670.8, 1.0]] },
  { name: '钙 Ca', col: '#ff6a2e', desc: '砖红色', lines: [[422.7, 0.5], [553.5, 0.45], [616.2, 0.95], [643.9, 0.6]] },
  { name: '锶 Sr', col: '#ff2f4c', desc: '洋红色', lines: [[460.7, 0.6], [606.0, 0.55], [650.4, 0.8], [679.1, 0.9]] },
  { name: '钡 Ba', col: '#bfee4d', desc: '黄绿色', lines: [[493.4, 0.55], [524.2, 0.8], [553.5, 1.0]] },
  { name: '铜 Cu', col: '#35e08c', desc: '绿色', lines: [[440.0, 0.45], [510.6, 0.9], [521.8, 0.95], [578.2, 0.5]] },
];

export const flame = {
  id: 'chem-flame',
  subject: 'chem',
  title: '焰色试验与原子发射线状光谱鉴定',
  en: 'Flame tests, cobalt glass filter & 380–760 nm emission lines',
  lede: [
    '用稀盐酸洗净并灼烧至无色的铂丝蘸取金属盐溶液伸入本生灯火焰，热激发使原子外层电子跃迁到高能级，回落时辐射出特征波长的单色线状光谱。',
    '钠的 589 nm 黄光极其明亮，常掩盖钾的 404 nm 紫光；架上蓝色钴玻璃滤除黄光，钾的浅紫色焰色立刻显现！',
  ],
  formula: 'ΔE = E₂ − E₁ = h ν = h c / λ',
  formulaNote: '焰色反应是原子核外电子能级跃迁引起的物理变化；蓝色钴玻璃可吸收 550–640 nm 黄绿光并透射紫光',
  terms: [
    ['操作口诀', '洗（稀盐酸洗铂丝）→ 烧（灼烧至与原焰同色）→ 蘸（蘸取待测液）→ 烧（观察焰色）→ 洗'],
    ['蓝色钴玻璃', '含氧化钴的特制滤光玻璃，选择性吸收钠的 589 nm 黄光而允许钾的 404 nm 紫光通过'],
    ['线状发射光谱', '每种元素具有独一无二的特征发射谱线波长（如 Na 589 nm 双线，Li 671 nm，Ba 554 nm）'],
  ],
  predict: {
    q: '某碳酸钾样品中混有少量 NaCl，直接灼烧呈现明亮黄色。如何检验其中是否含有钾元素？',
    options: ['把火焰调至最大温度', '透过蓝色钴玻璃观察，若显浅紫色则含钾', '先加稀硫酸酸化后再烧'],
    answer: 1,
    why: '钠的 589 nm 发射强度极高，少量钠即可掩盖钾的紫光；蓝色钴玻璃强烈吸收黄光、透过紫光，透过它看见紫色即可确证钾元素存在。',
  },
  challenge: '对比“钾 K (含钠杂质)”在撤去与架上蓝色钴玻璃时的火焰与光谱变化；再在工作台识别隐藏未知金属样品！',
  fig: '本生灯、铂丝环、可插拔蓝色钴玻璃滤片与实时发射光谱仪',
  hint: '切换待测金属盐并开关“蓝色钴玻璃”，按“洗-烧-蘸-烧”观看铂丝循环演示；展开工作台在 380–760 nm 全谱上定位特征谱线并破译未知样。',
  teach: {
    where: '人教版化学必修第一册第二章 §2.1《钠及其化合物》（焰色试验）与选择性必修 2 第一章《原子光谱》',
    ask: [
      '为什么不能用普通玻璃棒或铜丝代替铂丝（或光洁无锈铁丝）蘸取待测液？',
      '焰色试验属于物理变化还是化学变化？检验对象是元素还是特定化合物分子？',
    ],
    simplify: '发射谱线取各金属最显著的特征波长（nm）与相对强度；钴玻璃透射函数近似以 589 nm 中心高斯吸收带模拟。',
    safety: '酒精灯/本生灯注意明火防烫伤，稀盐酸洗铂丝切勿溅入眼内。',
  },
  controls: [
    { id: 'salt', type: 'choice', label: '', options: FLAME_SALTS.map((s) => s.name), value: 1, wide: true },
    { id: 'co', type: 'toggle', label: '蓝色钴玻璃', value: false },
    { id: 'washCycle', type: 'button', label: '洗-烧-蘸-烧演示' },
  ],
  record: {
    note: '记录观察到的金属元素、滤光片状态、肉眼焰色与主特征发射波长。',
    pending: '选择盐类并切换钴玻璃后点击记录，或完成工作台未知样鉴定。',
    columns: [
      { key: 'saltName', label: '样品' },
      { key: 'coUsed', label: '钴玻璃' },
      { key: 'colorDesc', label: '观察焰色' },
      { key: 'peakNm', label: '主特征谱线', unit: 'nm', digits: 1 },
    ],
    sample: (inst, p) => {
      const s = FLAME_SALTS[p.salt ?? 0];
      const visLines = p.co ? s.lines.filter(([nm]) => nm < 540 || nm > 650) : s.lines;
      const top = (visLines.length ? visLines : s.lines).slice().sort((a, b) => b[1] - a[1])[0];
      return {
        _kind: 'human',
        saltName: s.name,
        coUsed: p.co ? '透过' : '无',
        colorDesc: p.co && p.salt === 1 ? '浅紫色 (已滤黄)' : p.co && p.salt === 0 ? '极暗蓝 (黄光被滤)' : s.desc,
        peakNm: top[0],
      };
    },
    summary: (rows) => [
      ['已录入光谱', `${rows.length} 条`],
      ['最新主峰', rows.length ? `${rows[rows.length - 1].peakNm} nm` : '—'],
    ],
    errors: [
      '每次更换样品前未用稀盐酸清洗并灼烧铂丝，残留 Na⁺ 黄光会污染下一次观察。',
      '观察钾焰色忘记透过蓝色钴玻璃，误将含钠杂质的黄色判断为“不含钾”。',
    ],
  },

  build(k) {
    const p = k.p, X = -1.4, Z = -0.6;
    k.root.add(
      at(cyl(0.92, 0.3, STEEL), X, 0, Z),
      at(cyl(0.22, 1.9, STEEL), X, 0.3, Z),
      at(cyl(0.34, 0.3, C.shade), X, 0.72, Z),
    );
    const outer = flat(new THREE.ConeGeometry(0.42, 1.95, 24, 6, true).translate(0, 0.97, 0), C.amber, { opacity: 0.82 });
    const core = flat(new THREE.ConeGeometry(0.2, 1.0, 20, 1, true).translate(0, 0.5, 0), '#cfe6ff', { opacity: 0.85 });
    const halo = glow(C.amber, 4.2, 0.55);
    const fl = at(group(outer, core, at(halo, 0, 1.0, 0)), X, 2.2, Z);

    const ptLoop = group(
      rod([0.35, 3.05, 0.15], [2.5, 1.9, 1.4], 0.03, C.metal),
      rod([2.5, 1.9, 1.4], [3.5, 1.4, 2.0], 0.09, C.paper),
    );
    ptLoop.position.set(X, 0, Z);

    const co = at(flat(new THREE.PlaneGeometry(2.4, 2.8), '#2b4fd6', { opacity: 0.5 }), X, 3.2, Z + 1.3);
    const coFrame = at(group(rod([-1.25, 0, 0], [-1.25, 4.7, 0], 0.05), rod([1.25, 0, 0], [1.25, 4.7, 0], 0.05)), X, 0, Z + 1.3);
    const spec = at(sheet(4.3, 1.05, () => {}, { opaque: true, ink: true, lay: 'tilt' }), 2.35, 0, -2.55);
    const info = at(card('\n', { w: 4.3, size: 0.28, align: 'left' }), 2.35, 0, 2.2);
    k.root.add(fl, ptLoop, co, coFrame, spec, info, at(note('380 nm           发射波长 λ           760 nm', { size: 0.23 }), 2.35, 1.08, -3.25));

    let last = '', cycleT = -1;
    return {
      press(id) {
        if (id === 'washCycle') cycleT = 0;
        k.dirty();
      },
      update(dt, t) {
        const s = FLAME_SALTS[p.salt ?? 0];
        const isKwithNa = p.salt === 1, isPureK = p.salt === 2, isNa = p.salt === 0;
        let col = new THREE.Color(s.col);
        if (p.co) {
          if (isKwithNa || isPureK) col = new THREE.Color('#b88cff');
          else if (isNa) col = new THREE.Color('#273775');
          else col = new THREE.Color(mixHex(s.col, '#3040b0', 0.55));
        }

        let cycleStep = '';
        if (cycleT >= 0) {
          cycleT += dt;
          if (cycleT < 1.2) { cycleStep = '① 稀盐酸洗净铂丝…'; ptLoop.position.set(X + 1.1, -0.8, Z); }
          else if (cycleT < 2.4) { cycleStep = '② 灼烧至火焰无色…'; ptLoop.position.set(X, 0, Z); col = new THREE.Color('#9ec6ff'); }
          else if (cycleT < 3.4) { cycleStep = '③ 蘸取待测金属盐…'; ptLoop.position.set(X + 1.1, -0.5, Z); }
          else if (cycleT < 5.0) { cycleStep = '④ 伸入外焰观察焰色！'; ptLoop.position.set(X, 0, Z); }
          else { cycleT = -1; ptLoop.position.set(X, 0, Z); }
        }

        outer.material.color.copy(col); halo.material.color.copy(col);
        halo.material.opacity = p.co && isNa ? 0.12 : 0.55;
        fl.scale.set(1 + Math.sin(t * 13) * 0.06, 1 + Math.sin(t * 9.1) * 0.07 + Math.sin(t * 23) * 0.03, 1 + Math.cos(t * 11) * 0.06);
        co.visible = coFrame.visible = Boolean(p.co);

        const key = `${p.salt}|${p.co}`;
        if (key !== last) {
          last = key;
          spec.redraw((x, S, w, h) => {
            x.fillStyle = '#12151a'; x.fillRect(0, 0, w * S, h * S);
            s.lines.forEach(([nm, inten]) => {
              const trans = p.co && nm > 535 && nm < 645 ? 0.05 : 1;
              const c = wavelength(nm), px = ((nm - 380) / 380) * w * S;
              x.fillStyle = `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},${inten * trans})`;
              x.fillRect(px - S * 0.035, h * S * 0.12, S * 0.07, h * S * 0.76);
            });
          });
        }
        const msg = cycleStep || (p.co
          ? (isKwithNa || isPureK ? '透过钴玻璃：浅紫色\n589 nm 钠黄光已被滤除，确认含钾！' : isNa ? '透过钴玻璃：几乎熄灭\n钠黄光被完全吸收' : `透过钴玻璃观察 (${s.desc}被部分吸收)`)
          : `火焰显色：${s.desc}\n${s.name} · 主线 ${s.lines.map((l) => l[0]).join(', ')} nm`);
        info.set(msg);
      },
      margin: () => ['常见焰色口诀：', 'Na 黄 · K 浅紫(钴玻)', 'Li 紫红 · Ca 砖红', 'Sr 洋红 · Ba 黄绿', 'Cu 绿色', '步骤：洗-烧-蘸-烧-洗'],
    };
  },

  buildWorkbench(wb, sp) {
    const sec = wb.section('1 · 380–760 nm 原子发射光谱与未知样品鉴别');
    let unknownIdx = 3; // Li 默认未知
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn" data-new>抽取新未知样品</button>
      ${FLAME_SALTS.filter((_, i) => i !== 1).map((s, kIdx) => `<button type="button" class="wb-btn" data-guess="${s.name}">${s.name}</button>`).join('')}`;
    sec.append(bar);
    void bar.children;

    const cv = wb.canvas(sec, 520, 235, (x, W, H) => {
      const p = sp.params;
      const s = FLAME_SALTS[p.salt ?? 0];
      x.fillStyle = '#0e1116'; x.fillRect(0, 0, W, H);
      const pad = { l: 38, r: 18, t: 24, b: 36 };
      const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      const sx = (nm) => pad.l + ((nm - 380) / 380) * pw;

      // 蓝钴玻璃透射率包络线
      if (p.co) {
        x.strokeStyle = 'rgba(85, 130, 255, 0.75)'; x.lineWidth = 1.6; x.setLineDash([4, 3]);
        x.beginPath();
        for (let nm = 380; nm <= 760; nm += 4) {
          const block = Math.exp(-Math.pow((nm - 588) / 42, 2));
          const T = 0.88 * (1 - 0.94 * block);
          const yy = pad.t + ph - T * ph;
          if (nm === 380) x.moveTo(sx(nm), yy); else x.lineTo(sx(nm), yy);
        }
        x.stroke(); x.setLineDash([]);
        x.fillStyle = '#89b4ff'; x.font = '11px "Songti SC",serif';
        x.fillText('蓝色钴玻璃透射曲线 T(λ) — 强吸收 550–630 nm 黄光', pad.l + 8, pad.t + 14);
      }

      // 底部连续彩虹参考条
      for (let i = 0; i < pw; i += 2) {
        const nm = 380 + (i / pw) * 380;
        const c = wavelength(nm);
        x.fillStyle = `rgb(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0})`;
        x.fillRect(pad.l + i, pad.t + ph + 4, 2, 7);
      }

      // 发射谱线
      s.lines.forEach(([nm, inten]) => {
        const block = p.co ? Math.exp(-Math.pow((nm - 588) / 42, 2)) : 0;
        const trans = p.co ? 0.88 * (1 - 0.94 * block) : 1;
        const eff = inten * trans;
        const c = wavelength(nm);
        const px = sx(nm);
        const hBar = eff * (ph - 16);
        x.strokeStyle = `rgb(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0})`;
        x.lineWidth = 4;
        x.beginPath(); x.moveTo(px, pad.t + ph); x.lineTo(px, pad.t + ph - hBar); x.stroke();
        x.fillStyle = '#e8edf2'; x.font = '11px Georgia,serif'; x.textAlign = 'center';
        x.fillText(`${nm}`, px, pad.t + ph - hBar - 6);
      });

      x.fillStyle = '#b4c0cc'; x.font = '11px Georgia,serif'; x.textAlign = 'center';
      for (let nm = 400; nm <= 760; nm += 60) x.fillText(`${nm}nm`, sx(nm), H - 8);
    });

    const unkBox = document.createElement('div');
    unkBox.className = 'wb-metrics';
    sec.append(unkBox);

    const showUnk = (msg = '点击上方按钮猜测右侧未知样品光谱所属元素') => {
      const unk = FLAME_SALTS[unknownIdx];
      unkBox.innerHTML = `
        <div class="wb-m"><span>盲测未知光谱主峰</span><b>${unk.lines.map((l) => `${l[0]} nm`).join(' · ')}</b></div>
        <div class="wb-m"><span>鉴别判定</span><b>${msg}</b></div>`;
    };

    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if ('new' in btn.dataset) {
        const pool = [0, 2, 3, 4, 5, 6, 7];
        unknownIdx = pool[Math.floor(Math.random() * pool.length)];
        showUnk('已抽取新未知样品，请结合谱线波长判断！');
      } else if (btn.dataset.guess) {
        const trueName = FLAME_SALTS[unknownIdx].name;
        const ok = btn.dataset.guess === trueName;
        showUnk(ok ? `✓ 正确！未知样品确为 ${trueName}` : `✗ 不匹配（你选了 ${btn.dataset.guess}，请对照主谱线波长）`);
        if (ok) {
          wb.record({
            _kind: 'human',
            saltName: `盲测命中: ${trueName}`,
            coUsed: sp.params.co ? '透过' : '无',
            colorDesc: FLAME_SALTS[unknownIdx].desc,
            peakNm: FLAME_SALTS[unknownIdx].lines[0][0],
          });
        }
      }
    });

    cv.redraw();
    showUnk();
    return { update() { cv.redraw(); } };
  },
};

// ================================================================ 6. 影响化学反应速率的因素 (L3)
export const rate = {
  id: 'chem-rate',
  subject: 'chem',
  title: '化学反应速率的影响因素与阿伦尼乌斯活化能',
  en: 'Reaction rate factors, MnO₂ catalysis & Arrhenius ln k – 1/T',
  lede: [
    '在 Na₂S₂O₃ + H₂SO₄ → S↓ + SO₂↑ 实验中记录杯底“十”字消失时间，或在 H₂O₂ 分解中观察 MnO₂ 催化剂对集气速率的暴增。',
    '升温不仅让分子运动更快，更使能量超过活化能 E_a 的活化分子百分数呈指数增长；催化剂则另辟新路径降低 E_a！在工作台拟合 ln k – 1/T 求取表观活化能。',
  ],
  formula: 'k = A exp(−Eₐ / RT) · ln k = ln A − (Eₐ / R) · (1/T)',
  formulaNote: '有效碰撞理论：增大浓度提高单位体积活化分子数；升高温度或加入催化剂提高活化分子百分数',
  terms: [
    ['表观活化能 Eₐ', '活化分子平均能量与普通反应物分子平均能量之差；MnO₂ 可大幅降低 H₂O₂ 分解的 Eₐ'],
    ['阿伦尼乌斯图', '以 ln k（k ∝ 1/t）对 1/T 作线性回归，斜率 k_fit = −Eₐ / R'],
    ['控变原则', '探究温度、浓度或催化剂单一变量时，其余条件必须保持恒定'],
  ],
  predict: {
    q: '在过氧化氢（H₂O₂）分解中加入少量 MnO₂ 粉末，反应速率剧增的原因是？',
    options: [
      'MnO₂ 显著提高了反应放热温度',
      'MnO₂ 改变了反应路径、降低了活化能 Eₐ，使活化分子百分数骤增',
      'MnO₂ 与 H₂O₂ 发生永久反应生成更多氧气',
    ],
    answer: 1,
    why: '催化剂不改变反应物与生成物总能量及平衡转化率，但通过参与中间步大幅降低活化能 Eₐ（如 H₂O₂ 分解 Eₐ 由 ~75 降至 ~42 kJ/mol），使玻尔兹曼高能尾部的活化分子比例呈指数扩大。',
  },
  challenge: '在工作台连续采集 4 组不同温度下的速率数据，利用线性回归拟合 ln k – 1/T 测定表观活化能 Eₐ；再开启 MnO₂ 对比玻尔兹曼高能尾巴面积变化！',
  fig: '恒温反应杯/集气装置、温度计与速率–温度实时记录图',
  hint: '调节温度 T、浓度 c 与 MnO₂ 催化剂后按“混合，开始计时”；进入工作台绘制 ln k – 1/T 阿伦尼乌斯回归线与玻尔兹曼分布。',
  teach: {
    where: '人教版化学选择性必修 1 第二章 §2.1《化学反应速率》（实验：影响化学反应速率的因素）',
    ask: [
      '比较升高温度和增大浓度两种手段，对“活化分子百分数”的影响有何本质区别？',
      '为什么 H₂O₂ 加入 MnO₂ 催化后，最终能收集到的 O₂ 总体积并没有增加？',
    ],
    simplify: 'Na₂S₂O₃ 体系设定 Eₐ = 52.0 kJ/mol；H₂O₂ 体系无催化 Eₐ = 68.0 kJ/mol，加 MnO₂ 后降至 38.0 kJ/mol，动画以 6 倍速播放。',
    safety: 'Na₂S₂O₃ + H₂SO₄ 产生少量刺激性 SO₂，真实实验须控制小用量并保持通风。',
  },
  controls: [
    { id: 'sys', type: 'choice', label: '反应体系', options: ['Na₂S₂O₃ + H₂SO₄ (浑浊)', 'H₂O₂ 分解 (O₂ 集气)'], value: 0 },
    { id: 'T', label: '反应温度 T', min: 10, max: 60, step: 5, value: 25, unit: '°C' },
    { id: 'c', label: '反应物浓度 c', min: 0.05, max: 0.20, step: 0.01, value: 0.10, unit: 'mol/L' },
    { id: 'cat', type: 'toggle', label: 'MnO₂ 催化剂 (H₂O₂)', value: false },
    { id: 'go', type: 'button', label: '混合，开始计时' },
    { id: 'resetR', type: 'button', label: '重置记录' },
  ],
  record: {
    note: '每次“十”字完全消失或收集满 20 mL O₂ 后记入一条速率测量数据，供工作台阿伦尼乌斯回归。',
    pending: '请按“混合，开始计时”完成一次计时后再记入实验册。',
    columns: [
      { key: 'sysName', label: '体系' },
      { key: 'tempC', label: 'T', unit: '°C', digits: 0 },
      { key: 'conc', label: 'c', unit: 'mol/L', digits: 2 },
      { key: 'catStr', label: '催化剂' },
      { key: 'tSec', label: '耗时 t', unit: 's', digits: 2 },
      { key: 'kRate', label: '表观速率 1/t', unit: 's⁻¹', digits: 4, stat: true },
    ],
    sample: (inst) => inst.getLastSample?.(),
    summary: (rows) => [
      ['已录入速率点', `${rows.length} 组`],
      ['最快反应耗时', rows.length ? `${Math.min(...rows.map((r) => r.tSec)).toFixed(2)} s` : '—'],
    ],
    errors: [
      '判断“十”字消失的主观判据差异会在不同观测者间引入 ±1 s 随机误差。',
      '高浓度或高温下混合瞬间反应已启动，计时延迟造成系统偏短误差。',
    ],
  },

  build(k) {
    const p = k.p, X = -1.9, Z = -0.6;
    const cross = at(note('十', { size: 1.3, lay: 'flat', bold: true }), X, 0.1, Z);
    const bk = at(makeBeaker(1.42, 2.1), X, 0.05, Z);
    const liq = at(liquid(1.34, 1.3, '#f4ecb4', 0.12), X, 0.09, Z);
    const catPile = at(lathe([[0, 0], [0.35, 0], [0.2, 0.12], [0, 0.16]], '#26292e', { seg: 16 }), X, 0.09, Z);
    const bub = bubbler(22, { x: X, z: Z, rad: 0.45, y0: 0.35, r: 0.05, speed: 1.9 });
    const therm = at(jar(0.1, 3.0, C.red, { fill: 0.4, glow: 0.2 }), X + 1.05, 0.3, Z - 0.5);
    const g = at(plot({ w: 4.1, h: 3.1, xr: [10, 60], yr: [0, 140], xl: '温度 / °C', yl: '耗时 / s' }), 2.3, 0, -2.4);
    const info = at(card('\n', { w: 3.8, size: 0.28, align: 'left' }), 2.3, 0, 2.3);
    k.root.add(at(plate(3.6, 3.4), X, 0, Z), cross, bk, liq, catPile, bub, therm, g, info);

    const calcTotalTime = (sys, T, c, cat) => {
      const Ea = sys === 0 ? 52000 : (cat ? 38000 : 68000);
      const R = 8.314, T0 = 298.15, TK = T + 273.15;
      const arrh = Math.exp((Ea / R) * (1 / TK - 1 / T0));
      const baseT = sys === 0 ? 34.0 : (cat ? 16.0 : 95.0);
      return clamp(baseT * (0.10 / c) * arrh, 1.5, 220);
    };

    let t = 0, run = false, done = 0, lastRun = null;
    const runs = [];
    const drawPlot = () => {
      g.clear()
        .fn((T) => Math.min(140, calcTotalTime(p.sys ?? 0, T, p.c, p.cat)), 'rgba(30,43,54,.35)', 0.03, true);
      runs.forEach((r) => g.dot(r.T, Math.min(140, r.t), r.sys === (p.sys ?? 0) ? C.flame : '#bbb'));
      g.done();
    };
    drawPlot();

    return {
      calcTotalTime,
      getRuns: () => [...runs],
      getLastSample: () => lastRun,
      press(id) {
        if (id === 'go') { t = 0; run = true; done = 0; }
        else if (id === 'resetR') { t = 0; run = false; done = 0; runs.length = 0; lastRun = null; drawPlot(); }
        k.dirty();
      },
      change() { run = false; t = 0; done = 0; drawPlot(); k.dirty(); },
      update(dt) {
        const sys = p.sys ?? 0;
        const tt = calcTotalTime(sys, p.T, p.c, p.cat);
        if (run) {
          t += dt * 6;
          if (t >= tt) {
            t = tt; run = false; done = tt;
            const rec = { sys, T: p.T, c: p.c, cat: Boolean(p.cat), t: tt, k: 1 / tt };
            runs.push(rec);
            if (runs.length > 16) runs.shift();
            lastRun = {
              _kind: 'human',
              sysName: sys === 0 ? 'Na₂S₂O₃+H₂SO₄' : 'H₂O₂ 分解',
              tempC: p.T, conc: p.c, catStr: sys === 1 && p.cat ? 'MnO₂' : '无',
              tSec: tt, kRate: 1 / tt,
            };
            drawPlot();
          }
        }
        const f = clamp(t / tt);
        cross.visible = sys === 0;
        catPile.visible = sys === 1 && Boolean(p.cat);
        liq.set(1.3, sys === 0 ? '#f4ecb4' : '#dff2ff');
        liq.fade(sys === 0 ? 0.1 + Math.pow(f, 1.3) * 0.88 : 0.35);
        bub.step(dt, run && sys === 1 ? clamp(28 / Math.max(2, tt * 0.15), 2, 24) : 0, 1.38);
        therm.fill(p.T / 65);
        info.set(`${sys === 0 ? '硫单质浑浊计时' : '过氧化氢集气计时'}\n秒表 ${t.toFixed(1)} s / 预计 ${tt.toFixed(1)} s\n${done ? '✓ 已达终点' : run ? '反应进行中…' : '待启动'}`);
      },
      margin() {
        const sys = p.sys ?? 0;
        const Ea = sys === 0 ? 52 : (p.cat ? 38 : 68);
        return [
          `T = ${p.T}°C (${(p.T + 273.15).toFixed(1)} K)`,
          `c = ${p.c.toFixed(2)} mol/L`,
          `理论 Eₐ = ${Ea} kJ/mol`,
          `实测点：${runs.length} 组`,
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 阿伦尼乌斯图 ln k – 1000/T 线性回归求活化能');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn primary" data-sample-pt>采集当前条件点</button>
      <button type="button" class="wb-btn" data-sweep>自动扫描 4 组温度 (15/25/40/55°C)</button>
      <button type="button" class="wb-btn" data-clear-pts>清空采样</button>`;
    sec1.append(bar);

    const pts = []; // [invT*1000, lnk, kind]
    const regChart = wb.regressionChart(sec1, {
      w: 520, h: 225, xLabel: '1000 / T (K⁻¹)', yLabel: 'ln k (k = 1/t)',
      xRange: [2.95, 3.55], yRange: [-5.5, -0.5],
    });

    const sec2 = wb.section('2 · 麦克斯韦–玻尔兹曼动能分布与 MnO₂ 催化降垒');
    const boltzCv = wb.canvas(sec2, 520, 210, (x, W, H) => {
      const p = sp.params;
      const TK = p.T + 273.15;
      const Ea = (p.sys ?? 0) === 0 ? 52 : (p.cat ? 38 : 68);
      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      const pad = { l: 42, r: 20, t: 20, b: 32 };
      const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      const eMax = 100;
      const sx = (E) => pad.l + (E / eMax) * pw;
      const RT = 8.314e-3 * TK; // kJ/mol
      const fB = (E) => Math.sqrt(E) * Math.exp(-E / RT);
      const fPeak = fB(0.5 * RT);
      const sy = (val) => pad.t + ph - (val / (fPeak * 1.15)) * ph;

      // 填充高能活化分子尾部 E >= Ea
      x.fillStyle = p.cat && (p.sys ?? 0) === 1 ? 'rgba(47,180,106,0.28)' : 'rgba(180,101,58,0.26)';
      x.beginPath(); x.moveTo(sx(Ea), pad.t + ph);
      for (let E = Ea; E <= eMax; E += 1) x.lineTo(sx(E), sy(fB(E)));
      x.lineTo(sx(eMax), pad.t + ph); x.closePath(); x.fill();

      // 分布曲线
      x.strokeStyle = '#1e2b36'; x.lineWidth = 2.2; x.beginPath();
      for (let E = 0; E <= eMax; E += 1) {
        const px = sx(E), py = sy(fB(E));
        if (E === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.stroke();

      // Ea 垂直线
      x.strokeStyle = '#e5483f'; x.lineWidth = 2; x.setLineDash([5, 3]);
      x.beginPath(); x.moveTo(sx(Ea), pad.t); x.lineTo(sx(Ea), pad.t + ph); x.stroke(); x.setLineDash([]);
      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.4;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();

      x.fillStyle = '#e5483f'; x.font = 'bold 12px Georgia,serif';
      x.fillText(`Eₐ = ${Ea} kJ/mol`, sx(Ea) + 6, pad.t + 16);
      const frac = Math.exp(-Ea / RT);
      x.fillStyle = '#1f4a3e'; x.font = '12px "Songti SC",serif';
      x.fillText(`T = ${p.T}°C 时活化分子比例 ≈ ${(frac * 100).toExponential(2)}%`, pad.l + 10, pad.t + 34);
      x.fillStyle = '#51606b'; x.textAlign = 'center';
      x.fillText('分子平动动能 E (kJ/mol)', pad.l + pw / 2, H - 8);
    });

    const diag = document.createElement('div');
    diag.className = 'wb-metrics';
    sec1.append(diag);

    const refresh = () => {
      const reg = linearRegression(pts.map(([x, y]) => [x, y]));
      const EaFit = reg ? -reg.k * 8.314 : NaN;
      regChart.redraw({ pts, xRange: [2.95, 3.55], yRange: [-6.0, 0.0] });
      boltzCv.redraw();
      diag.innerHTML = `
        <div class="wb-m"><span>回归样本数</span><b>${pts.length} 点</b></div>
        <div class="wb-m"><span>拟合表观 Eₐ</span><b>${Number.isFinite(EaFit) ? `${EaFit.toFixed(1)} kJ/mol` : '需 ≥ 2 个不同温度点'}</b></div>
        <div class="wb-m"><span>线性相关度 R²</span><b>${reg ? reg.r2.toFixed(4) : '—'}</b></div>`;
    };

    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn || !sp.inst?.calcTotalTime) return;
      const p = sp.params;
      if ('samplePt' in btn.dataset) {
        const tSec = sp.inst.calcTotalTime(p.sys ?? 0, p.T, p.c, p.cat);
        pts.push([1000 / (p.T + 273.15), Math.log(1 / tSec), 'human']);
      } else if ('sweep' in btn.dataset) {
        pts.length = 0;
        [15, 25, 40, 55].forEach((T) => {
          const tSec = sp.inst.calcTotalTime(p.sys ?? 0, T, p.c, p.cat);
          pts.push([1000 / (T + 273.15), Math.log(1 / tSec), 'simulated']);
        });
      } else if ('clearPts' in btn.dataset) {
        pts.length = 0;
      }
      refresh();
    });

    refresh();
    return { update() { refresh(); } };
  },
};

// ================================================================ 7. 原电池、盐桥电池、燃料电池与电镀原理 (L3)
export const cell = {
  id: 'chem-cell',
  subject: 'chem',
  title: '原电池、盐桥电池、燃料电池与电镀原理',
  en: 'Daniell salt-bridge, H₂–O₂ PEM fuel cell & CuSO₄ electroplating',
  lede: [
    '化学能与电能的相互转化都围绕两个半反应展开：氧化在阳极/负极发生，还原在阴极/正极发生；电子走外电路导线，离子走内电路电解质或质子膜。',
    '在盐桥原电池、氢氧 PEM 燃料电池和硫酸铜电镀池间一键切换，调节离子浓度验证能斯特方程电势偏移，观察电子与阴阳离子定向迁移！',
  ],
  formula: 'E = E° − (0.0592 / n) lg Q · Daniell E° = 1.10 V · PEMFC E° = 1.23 V',
  formulaNote: '原电池：负极氧化、正极还原（自发）；电解池：阳极氧化、阴极还原（外电源驱动）',
  terms: [
    ['KCl 盐桥', '沟通内电路并维持两烧杯电中性：K⁺ 移向正极(CuSO₄)，Cl⁻ 移向负极(ZnSO₄)'],
    ['质子交换膜', '仅允许 H⁺ 从氢阳极迁往氧阴极，阻止 H₂ 与 O₂ 直接混合燃烧'],
    ['电镀铜规律', '阳极纯铜溶解 Cu − 2e⁻ = Cu²⁺，阴极待镀件析铜，电镀液 c(Cu²⁺) 基本不变'],
  ],
  predict: {
    q: '在 Zn–ZnSO₄ || KCl盐桥 || CuSO₄–Cu 原电池工作过程中，盐桥里的 K⁺ 和 Cl⁻ 分别向哪一侧烧杯移动？',
    options: ['K⁺ 移向 CuSO₄ 正极室，Cl⁻ 移向 ZnSO₄ 负极室', '两者都移向正极室', 'K⁺ 移向负极室，Cl⁻ 移向正极室'],
    answer: 0,
    why: '负极 Zn 失电子生成 Zn²⁺ 使左池正电荷增多，吸引 Cl⁻ 移入；正极 Cu²⁺ 得电子析出使右池正电荷减少，吸引 K⁺ 移入以维持电中性。',
  },
  challenge: '在丹尼尔电池模式下把 [Cu²⁺] 升到 2.0 mol/L、[Zn²⁺] 降至 0.01 mol/L，观察电压如何突破 1.10 V；再切换电镀池比较电极方向！',
  fig: '可切换三模式电化学反应台、盐桥/质子膜与伏特计',
  hint: '切换三种电化学装置并调节离子浓度；开启/断开盐桥或开关观察电流与电压表偏转；展开工作台观测半反应与能斯特曲线。',
  teach: {
    where: '人教版化学选择性必修 1 第四章 §4.1《原电池》与 §4.3《电解池（电镀）》',
    ask: [
      '为什么带盐桥的双液原电池比单液原电池输出电流更平稳、持续时间更长？',
      'H₂–O₂ 燃料电池在酸性（PEM）与碱性（KOH）电解质中，正负极反应式分别如何书写？',
    ],
    simplify: '能斯特计算按 25°C (298.15 K) 理想活度=浓度近似，暂不计浓差极化与欧姆内阻压降。',
    safety: '燃料电池真实操作严禁氢气与氧气未经隔膜混合，电镀硫酸铜溶液注意防止误食。',
  },
  controls: [
    { id: 'kind', type: 'choice', label: '电化学装置', options: ['Zn–Cu 盐桥原电池', 'H₂–O₂ 燃料电池', 'CuSO₄ 电镀池'], value: 0 },
    { id: 'cCat', label: '阴/正极液浓度', min: 0.01, max: 2.0, step: 0.05, value: 1.0, unit: 'mol/L' },
    { id: 'cAn', label: '阳/负极液浓度', min: 0.01, max: 2.0, step: 0.05, value: 1.0, unit: 'mol/L' },
    { id: 'bridge', type: 'toggle', label: '盐桥 / 闭合电路', value: true },
  ],
  record: {
    note: '记录不同装置与离子浓度下的开路/工作电动势与电极半反应。',
    pending: '点击记录以存入当前电化学装置参数与能斯特电压。',
    columns: [
      { key: 'kindName', label: '装置模式' },
      { key: 'cAn', label: '负极/阳极 c', unit: 'mol/L', digits: 2 },
      { key: 'cCat', label: '正极/阴极 c', unit: 'mol/L', digits: 2 },
      { key: 'volt', label: '理论电压 E', unit: 'V', digits: 3, stat: true },
      { key: 'anodeEq', label: '氧化半反应' },
    ],
    sample: (inst, p) => inst.getSample?.(p),
    summary: (rows) => [
      ['已录入电化学工况', `${rows.length} 次`],
      ['最大输出电压', rows.length ? `${Math.max(...rows.map((r) => r.volt)).toFixed(3)} V` : '—'],
    ],
    errors: [
      '抽取盐桥或未闭合电路时电压骤降为零，所有氧化还原电子转移停止。',
      '忽视温度或浓差项误以为所有条件下的 Daniell 电池电压恒等于 1.10 V。',
    ],
  },

  build(k) {
    const p = k.p, Z = -0.6;
    const bL = at(makeBeaker(1.15, 1.9), -1.65, 0.04, Z);
    const bR = at(makeBeaker(1.15, 1.9), 1.65, 0.04, Z);
    bL.fill(1.35); bR.fill(1.35);

    const elecL = at(box(0.45, 2.5, 0.1, '#a9b5bf'), -1.85, 0.35, Z);
    const elecR = at(box(0.45, 2.5, 0.1, C.copper), 1.85, 0.35, Z);
    const platingCoat = at(box(0.49, 1.1, 0.14, C.copper), 1.85, 0.35, Z);
    platingCoat.visible = false;

    const saltBridge = tube(
      [[-1.15, 0.85, Z], [-1.15, 2.45, Z], [0, 2.65, Z], [1.15, 2.45, Z], [1.15, 0.85, Z]],
      0.16, '#eef5fa',
    );
    const pemWall = at(box(0.14, 1.75, 1.8, '#e8d7a6'), 0, 0.1, Z);
    pemWall.visible = false;

    const pathWire = [[-1.85, 2.85, Z], [-1.85, 3.85, Z], [0, 4.15, Z], [1.85, 3.85, Z], [1.85, 2.85, Z]];
    const wireLine = tube(pathWire, 0.035, C.copper);
    const vMeter = at(meter('V', { w: 1.5, h: 1.05 }), 0, 3.65, Z + 0.5);
    const eFlow = flow(pathWire, 10, C.sky, { r: 0.075 });
    const ionFlow = flow([[-1.15, 0.9, Z], [-1.15, 2.45, Z], [0, 2.65, Z], [1.15, 2.45, Z], [1.15, 0.9, Z]], 8, C.amber, { r: 0.065 });
    const bubL = bubbler(12, { x: -1.85, z: Z, rad: 0.25, y0: 0.5, r: 0.04, speed: 1.4 });
    const bubR = bubbler(12, { x: 1.85, z: Z, rad: 0.25, y0: 0.5, r: 0.04, speed: 1.4 });

    const tagL = at(note('负极 (Zn)', { size: 0.28 }), -1.85, 3.2, Z);
    const tagR = at(note('正极 (Cu)', { size: 0.28 }), 1.85, 3.2, Z);
    const info = at(card('\n\n', { w: 5.5, size: 0.25, align: 'left' }), 0, 0, 2.6);
    k.root.add(bL, bR, elecL, elecR, platingCoat, saltBridge, pemWall, wireLine, vMeter, eFlow, ionFlow, bubL, bubR, tagL, tagR, info);

    const computeE = (par) => {
      const kind = par.kind ?? 0;
      if (!par.bridge) return 0;
      const q = Math.max(1e-4, par.cAn / Math.max(0.01, par.cCat));
      if (kind === 0) return Math.max(0, 1.10 - (0.0592 / 2) * Math.log10(q));
      if (kind === 1) return Math.max(0, 1.23 - (0.0592 / 4) * Math.log10(q));
      return 2.00; // 外加 2V 直流电镀电压
    };

    return {
      computeE,
      getSample(par) {
        const kind = par.kind ?? 0;
        return {
          _kind: 'human',
          kindName: ['Daniell 盐桥电池', 'H₂–O₂ PEMFC', 'CuSO₄ 电镀池'][kind],
          cAn: par.cAn, cCat: par.cCat,
          volt: computeE(par),
          anodeEq: ['Zn − 2e⁻ = Zn²⁺', 'H₂ − 2e⁻ = 2H⁺', 'Cu − 2e⁻ = Cu²⁺'][kind],
        };
      },
      update(dt) {
        const kind = p.kind ?? 0;
        const on = Boolean(p.bridge);
        const E = computeE(p);
        saltBridge.visible = kind === 0 && on;
        pemWall.visible = kind === 1;
        platingCoat.visible = kind === 2 && on;

        if (kind === 0) {
          bL.tint('#dff0ff', 0.45);
          bR.tint(mixHex('#cce8ff', '#1e78d6', clamp(p.cCat / 2, 0.2, 1)), 0.58);
          elecL.material.color.set('#b8c3cc'); elecR.material.color.set(C.copper);
          tagL.set('负极: Zn (氧化)'); tagR.set('正极: Cu (还原)');
        } else if (kind === 1) {
          bL.tint('#e4f5ef', 0.4); bR.tint('#e4f5ef', 0.4);
          elecL.material.color.set('#37414a'); elecR.material.color.set('#37414a');
          tagL.set('阳/负极: H₂'); tagR.set('阴/正极: O₂');
        } else {
          bL.tint('#2a80d8', 0.52); bR.tint('#2a80d8', 0.52);
          elecL.material.color.set(C.copper); elecR.material.color.set('#737c84');
          tagL.set('阳极: 粗/纯铜 (溶)'); tagR.set('阴极: 铁镀件 (镀铜)');
        }

        eFlow.visible = ionFlow.visible = on;
        if (on) {
          eFlow.step(dt, E * 2.4);
          ionFlow.step(dt, E * 1.4);
        }
        bubL.step(dt, on && kind === 1 ? 8 : 0, 1.38);
        bubR.step(dt, on && kind === 1 ? 4 : 0, 1.38);
        vMeter.set(clamp(E / 2.2, 0, 1), on ? `${E.toFixed(2)} V` : '0.00 V');

        info.set(on
          ? `${['Zn–Cu 丹尼尔盐桥原电池', 'H₂–O₂ 质子交换膜燃料电池', 'CuSO₄ 电镀铜电解池 (外加 2.0V 电源)'][kind]}\n${kind === 2 ? '阳极 Cu 溶解，阴极铁件镀铜，[Cu²⁺] 基本不变' : `能斯特实测电动势 E = ${E.toFixed(3)} V (电子由左经导线流向右)`}`
          : '电路已断开 / 盐桥已抽出：离子无法迁徙形成闭合回路，E = 0 V');
      },
      margin() {
        const E = computeE(p);
        const kind = p.kind ?? 0;
        return [
          `装置：${['Daniell', 'PEMFC', '电镀'][kind]}`,
          `E = ${E.toFixed(3)} V`,
          kind === 0 ? 'K⁺→Cu池, Cl⁻→Zn池' : kind === 1 ? 'H⁺ 透过 PEM 膜→O₂极' : 'Cu²⁺ 移向阴极镀件',
          '电子不下水，离子不上岸',
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec = wb.section('1 · 电极半反应示意图与能斯特电势曲线 E – lg Q');
    const cv = wb.canvas(sec, 520, 235, (x, W, H) => {
      const p = sp.params;
      const kind = p.kind ?? 0;
      const E0 = kind === 0 ? 1.10 : kind === 1 ? 1.23 : 0;
      const n = kind === 1 ? 4 : 2;
      const lgQ = Math.log10(Math.max(1e-4, p.cAn / Math.max(0.01, p.cCat)));
      const E = kind === 2 ? 2.0 : Math.max(0, E0 - (0.0592 / n) * lgQ);

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      // 上半区：半反应示意
      x.fillStyle = '#f7f1e1'; x.fillRect(14, 12, W - 28, 66);
      x.strokeStyle = '#d4cbb5'; x.strokeRect(14, 12, W - 28, 66);
      x.fillStyle = '#1e2b36'; x.font = 'bold 12px "Songti SC",serif';
      const lTxt = ['负极: Zn − 2e⁻ = Zn²⁺', '负极: H₂ − 2e⁻ = 2H⁺', '阳极: Cu − 2e⁻ = Cu²⁺'][kind];
      const rTxt = ['正极: Cu²⁺ + 2e⁻ = Cu', '正极: O₂ + 4H⁺ + 4e⁻ = 2H₂O', '阴极: Cu²⁺ + 2e⁻ = Cu'][kind];
      x.fillText(lTxt, 24, 34);
      x.fillText(rTxt, 278, 34);
      x.fillStyle = '#3a9cff'; x.font = 'bold 12px Georgia,serif';
      x.fillText('e⁻ 外电路导线 ──────────▶', 178, 58);
      x.fillStyle = '#b4653a';
      x.fillText(kind === 0 ? '盐桥: K⁺→右, Cl⁻→左' : kind === 1 ? 'PEM 膜: H⁺→右' : '电解液: Cu²⁺→阴极', 24, 58);

      // 下半区：能斯特曲线 E vs lg Q
      const pad = { l: 54, r: 22, t: 94, b: 28 };
      const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      const sx = (q) => pad.l + ((q + 3) / 6) * pw;
      const sy = (v) => pad.t + ph - clamp(v / 1.4, 0, 1) * ph;

      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.4;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();

      if (kind < 2) {
        x.strokeStyle = '#b4653a'; x.lineWidth = 2.2; x.beginPath();
        for (let i = 0; i <= 60; i++) {
          const qv = -3 + (i / 60) * 6;
          const ev = E0 - (0.0592 / n) * qv;
          if (i === 0) x.moveTo(sx(qv), sy(ev)); else x.lineTo(sx(qv), sy(ev));
        }
        x.stroke();
        x.fillStyle = '#1f4a3e';
        x.beginPath(); x.arc(sx(clamp(lgQ, -3, 3)), sy(E), 5.5, 0, TAU); x.fill();
        x.fillStyle = '#1e2b36'; x.font = '11.5px Georgia,serif';
        x.fillText(`当前工况：lg Q = ${lgQ.toFixed(2)}, E = ${E.toFixed(3)} V`, pad.l + 8, pad.t + 14);
      } else {
        x.fillStyle = '#1f4a3e'; x.font = '12px "Songti SC",serif';
        x.fillText('电镀模式外接直流稳压 2.00 V，阴极铜离子不断还原附着于铁件表面。', pad.l + 10, pad.t + ph / 2);
      }
      x.fillStyle = '#51606b'; x.textAlign = 'center'; x.font = '11px Georgia,serif';
      x.fillText('lg Q = lg([阳/负极] / [阴/正极])  (-3 ~ +3)', pad.l + pw / 2, H - 6);
    });

    cv.redraw();
    return { update() { cv.redraw(); } };
  },
};

// ================================================================ 8. 探究影响化学平衡移动的因素 (L3)
export const equilibrium = {
  id: 'chem-equilibrium',
  subject: 'chem',
  title: '化学平衡的移动与 Q_c–K_c 弛豫过程',
  en: '2NO₂ ⇌ N₂O₄ Le Chatelier piston & Qc–Kc relaxation tracker',
  lede: [
    '密封针筒内的红棕色 NO₂ 与无色 N₂O₄ 时刻处于可逆动态平衡：正反应放热（ΔH < 0）且气体总分子数减少。',
    '猛然推压活塞将体积减半时，气体颜色会“先瞬间变深，随后略微变浅，但最终仍比压缩前更深”——因为平衡移动只能“减弱”而不能“完全抵消”外界的改变。',
  ],
  formula: '2NO₂(g) ⇌ N₂O₄(g) · ΔH = −57.2 kJ/mol · K_c = [N₂O₄] / [NO₂]²',
  formulaNote: '升温平衡逆向移动（NO₂ 加深）；加压平衡正向移动（先因浓度加倍瞬间变深，再随平衡右移略微变浅）',
  terms: [
    ['勒夏特列原理', '如果改变影响平衡的一个条件，平衡就向着能够减弱这种改变的方向移动'],
    ['浓度商 Q_c', '任意时刻 Q_c = [N₂O₄]/[NO₂]²；Q_c < K_c 时正向移动，Q_c > K_c 时逆向移动，Q_c = K_c 达平衡'],
    ['先深后浅机制', '压缩瞬间 V 减半使两组分浓度均瞬间翻倍（颜色暴深），随后 Q_c 变为原来一半 (< K_c)，平衡正向弛豫'],
  ],
  predict: {
    q: '在 25°C 下将平衡状态的 2NO₂ ⇌ N₂O₄ 针筒迅速压缩至体积的一半，重新达到平衡后，c(NO₂) 与压缩前相比？',
    options: ['比压缩前更小', '与压缩前完全相等', '比压缩前更大（但小于压缩瞬间的 2 倍）'],
    answer: 2,
    why: '假设压缩前 [NO₂]=c₀，压缩瞬间翻倍为 2c₀；平衡虽向右移动消耗部分 NO₂，但依据勒夏特列原理只能“减弱”不能“抵消”，新平衡浓度必然大于原平衡 c₀。',
  },
  challenge: '把温度保持在 25°C，点击“一键压缩减半 (50→25 mL)”，盯紧工作台的 Q_c 与 K_c 曲线：看 Q_c 如何跌破 K_c 后再弛豫回 K_c！',
  fig: '密封玻璃针筒、NO₂/N₂O₄ 分子动态碰撞模型与 c(NO₂) 时序曲线',
  hint: '调节温度 T（热水浴/冰水浴）或推拉针筒体积 V；点击“一键压缩减半”清晰观测“先深后浅”瞬态脉冲！',
  teach: {
    where: '人教版化学选择性必修 1 第二章 §2.3《化学平衡》（实验：温度与压强对化学平衡的影响）',
    ask: [
      '用浓度商 Q_c 与平衡常数 K_c 的比较，定量解释压缩针筒瞬间平衡为何必然向生成 N₂O₄ 方向移动？',
      '如果保持容积不变向针筒充入不参与反应的 Ar 气，NO₂ 颜色和转化率是否改变？',
    ],
    simplify: '设初始等当总量对应 0.030 mol N₂O₄ 等效基准，按热力学参数 ΔH° = −57.2 kJ/mol、ΔS° = −175.8 J/(mol·K) 计算平衡常数，以一阶速率方程驱动 Q_c 向 K_c 弛豫。',
    safety: 'NO₂ 具有强毒性与腐蚀性，真实实验必须使用严密密封玻璃球/针筒并在通风橱内进行。',
  },
  controls: [
    { id: 'T', label: '水浴温度 T', min: 0, max: 100, step: 1, value: 25, unit: '°C' },
    { id: 'V', label: '针筒体积 V', min: 20, max: 60, step: 1, value: 50, unit: 'mL' },
    { id: 'compressHalf', type: 'button', label: '一键压缩减半' },
    { id: 'resetEq', type: 'button', label: '恢复 25°C / 50mL' },
  ],
  record: {
    note: '在不同温度或体积平衡态下记录当前 c(NO₂)、c(N₂O₄) 与平衡常数 K_c。',
    pending: '点击“记录当前数据”把热力学平衡状态记入实验册。',
    columns: [
      { key: 'tempC', label: 'T', unit: '°C', digits: 0 },
      { key: 'volMl', label: 'V', unit: 'mL', digits: 0 },
      { key: 'cNO2', label: 'c(NO₂)', unit: 'mol/L', digits: 3, stat: true },
      { key: 'cN2O4', label: 'c(N₂O₄)', unit: 'mol/L', digits: 3 },
      { key: 'qc', label: '浓度商 Qc', digits: 2 },
      { key: 'kc', label: '平衡常数 Kc', digits: 2 },
    ],
    sample: (inst) => inst.getSample?.(),
    summary: (rows) => [
      ['已录入平衡态', `${rows.length} 组`],
      ['最高 c(NO₂)', rows.length ? `${Math.max(...rows.map((r) => r.cNO2)).toFixed(3)} mol/L` : '—'],
    ],
    errors: [
      '仅根据压缩后颜色最终比初态深，误以为平衡向生成 NO₂ 方向移动（忽略了体积减半导致浓度基准加倍）。',
      '改变压强时误以为平衡常数 K_c 会变化（K_c 仅是温度 T 的函数）。',
    ],
  },

  build(k) {
    const p = k.p, X = -2.2, Z = -0.8, R = 1.05, H = 4.3, N = 15;
    const wall = at(group(glass(new THREE.CylinderGeometry(R, R, H, 44, 1, true).translate(0, H / 2, 0))), X, 0.5, Z);
    const tint = liquid(R * 0.96, 1, '#b5561d', 0.3);
    const piston = group(cyl(R * 0.97, 0.22, C.shade), at(cyl(0.12, 2.3), 0, 0.22, 0), at(cyl(0.6, 0.14), 0, 2.5, 0));
    const gas = dots(N * 2, 0.085, '#ffffff', { flat: true });
    wall.add(tint, piston, gas);
    const g = at(plot({ w: 4.1, h: 3.1, xr: [0, 12], yr: [0, 1.4], xl: '时间 / s', yl: 'c(NO₂) (mol/L)' }), 2.3, 0, -2.4);
    const info = at(card('\n', { w: 3.9, size: 0.27, align: 'left' }), 2.3, 0, 2.3);
    k.root.add(at(cyl(1.3, 0.5), X, 0, Z), wall, g, info);

    const rnd = () => new THREE.Vector3().randomDirection();
    const ps = Array.from({ length: N * 2 }, () => {
      const ang = Math.random() * TAU, rad = Math.sqrt(Math.random()) * 0.85;
      return { p: new THREE.Vector3(Math.cos(ang) * rad, Math.random() * 2, Math.sin(ang) * rad), v: rnd() };
    });

    const N0_TOTAL = 0.025; // mol basis of N2O4 equivalents
    const calcKc = (TC) => {
      const TK = TC + 273.15;
      // 2NO2 <-> N2O4: dH = -57200, dS = -175.8, Kp (bar^-1) -> Kc ≈ Kp * R*T
      const Kp = Math.exp((57200 - TK * 175.8) / (8.314 * TK));
      return Kp * 0.08314 * TK;
    };
    const alphaEqFor = (TC, Vml) => {
      const Kc = calcKc(TC), c0 = N0_TOTAL / (Vml / 1000);
      // Kc = c0*(1-a) / (4*c0^2*a^2) -> 4*Kc*c0 * a^2 + a - 1 = 0
      const A = 4 * Kc * c0;
      return (-1 + Math.sqrt(1 + 4 * A)) / (2 * A);
    };

    let alpha = alphaEqFor(p.T, p.V), tl = 0, acc = 0;
    const hist = []; // [t, cNO2, cN2O4, Qc, Kc]
    const brown = new THREE.Color('#a8501c'), pale = new THREE.Color('#e9dfc6');

    const getConcs = () => {
      const c0 = N0_TOTAL / (p.V / 1000);
      const cNO2 = 2 * alpha * c0;
      const cN2O4 = (1 - alpha) * c0;
      const Qc = cN2O4 / Math.max(1e-8, cNO2 * cNO2);
      const Kc = calcKc(p.T);
      return { cNO2, cN2O4, Qc, Kc };
    };

    return {
      getHistory: () => hist,
      getConcs,
      getSample() {
        const s = getConcs();
        return { _kind: 'human', tempC: p.T, volMl: p.V, cNO2: s.cNO2, cN2O4: s.cN2O4, qc: s.Qc, kc: s.Kc };
      },
      press(id) {
        if (id === 'compressHalf') {
          k.set('V', Math.max(20, Math.round(p.V / 2)));
        } else if (id === 'resetEq') {
          k.set('T', 25); k.set('V', 50);
          alpha = alphaEqFor(25, 50);
        }
        k.dirty();
      },
      update(dt) {
        const aEq = alphaEqFor(p.T, p.V);
        alpha += (aEq - alpha) * (1 - Math.exp(-dt / 1.1));
        const hp = 0.3 + (p.V / 60) * (H - 1.0);
        const sp = Math.sqrt((p.T + 273.15) / 298.15) * 2.2;
        const nd = Math.round(N * alpha);
        piston.position.y = hp;

        const { cNO2, cN2O4, Qc, Kc } = getConcs();
        tint.set(hp, mixHex('#efe4c4', '#963b0d', clamp(cNO2 / 1.25)));
        tint.fade(clamp(0.1 + cNO2 * 0.35, 0, 0.72));

        for (let j = 0; j < N; j++) {
          const A = ps[j * 2], B = ps[j * 2 + 1], free = j < nd;
          for (const m of free ? [A, B] : [A]) {
            m.p.addScaledVector(m.v, sp * dt * (free ? 1 : 0.7));
            const rr = Math.hypot(m.p.x, m.p.z);
            if (rr > 0.9) {
              const nx = m.p.x / rr, nz = m.p.z / rr, d = m.v.x * nx + m.v.z * nz;
              if (d > 0) { m.v.x -= 2 * d * nx; m.v.z -= 2 * d * nz; }
              m.p.x = nx * 0.9; m.p.z = nz * 0.9;
            }
            if (m.p.y < 0.12) { m.p.y = 0.12; m.v.y = Math.abs(m.v.y); }
            if (m.p.y > hp - 0.12) { m.p.y = hp - 0.12; m.v.y = -Math.abs(m.v.y); }
          }
          if (!free) { B.p.copy(A.p); B.p.x += 0.15; B.v.copy(rnd()); }
          gas.put(j * 2, A.p.x, A.p.y, A.p.z).paint(j * 2, free ? brown : pale);
          gas.put(j * 2 + 1, B.p.x, B.p.y, B.p.z).paint(j * 2 + 1, free ? brown : pale);
        }
        gas.done();

        tl += dt; acc += dt;
        if (acc > 0.08) {
          acc = 0;
          hist.push([tl, cNO2, cN2O4, Qc, Kc]);
          while (hist.length && hist[0][0] < tl - 12) hist.shift();
          g.clear().curve(hist.map(([t0, v]) => [t0 - (tl - 12), Math.min(1.4, v)]), C.flame, 0.045).done();
        }
        const dir = Math.abs(Qc - Kc) / Math.max(0.01, Kc) < 0.04 ? '已达新平衡 (Qc = Kc)'
          : Qc < Kc ? 'Qc < Kc → 正向移动 (颜色略变浅)' : 'Qc > Kc → 逆向移动 (颜色加深)';
        info.set(`c(NO₂) = ${cNO2.toFixed(3)} mol/L\nQc = ${Qc.toFixed(2)} vs Kc = ${Kc.toFixed(2)}\n${dir}`);
      },
      margin() {
        const s = getConcs();
        return [`T = ${p.T}°C · V = ${p.V} mL`, `Kc = ${s.Kc.toFixed(2)}`, `Qc = ${s.Qc.toFixed(2)}`, `分解率 α = ${(alpha * 100).toFixed(1)}%`];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec = wb.section('1 · 浓度商 Qc vs 平衡常数 Kc 弛豫追踪台');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn primary" data-act="half">突然压缩体积减半 (加压)</button>
      <button type="button" class="wb-btn" data-act="double">突然扩大体积加倍 (减压)</button>
      <button type="button" class="wb-btn" data-act="hot">瞬间升温至 70°C</button>
      <button type="button" class="wb-btn" data-act="ice">瞬间冰浴至 5°C</button>
      <button type="button" class="wb-btn" data-act="log">记录当前状态</button>`;
    sec.append(bar);

    const cv = wb.canvas(sec, 520, 235, (x, W, H) => {
      const hist = sp.inst?.getHistory?.() || [];
      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      const pad = { l: 50, r: 22, t: 22, b: 32 };
      const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;

      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();

      if (hist.length < 2) return;
      const tEnd = hist[hist.length - 1][0], t0 = tEnd - 12;
      const maxQ = Math.max(5, ...hist.map((h) => Math.max(h[3], h[4]))) * 1.1;
      const sx = (t) => pad.l + ((t - t0) / 12) * pw;
      const sy = (q) => pad.t + ph - clamp(q / maxQ, 0, 1) * ph;

      // 绿色虚线 Kc
      x.strokeStyle = '#1f4a3e'; x.lineWidth = 2; x.setLineDash([6, 4]);
      x.beginPath();
      hist.forEach((h, i) => { if (i === 0) x.moveTo(sx(h[0]), sy(h[4])); else x.lineTo(sx(h[0]), sy(h[4])); });
      x.stroke(); x.setLineDash([]);

      // 铜色实线 Qc
      x.strokeStyle = '#b4653a'; x.lineWidth = 2.4;
      x.beginPath();
      hist.forEach((h, i) => { if (i === 0) x.moveTo(sx(h[0]), sy(h[3])); else x.lineTo(sx(h[0]), sy(h[3])); });
      x.stroke();

      x.fillStyle = '#1f4a3e'; x.font = 'bold 12px Georgia,serif';
      const cur = hist[hist.length - 1];
      x.fillText(`--- Kc(T) = ${cur[4].toFixed(2)}`, pad.l + 10, pad.t + 14);
      x.fillStyle = '#b4653a';
      x.fillText(`─── Qc(t) = ${cur[3].toFixed(2)}`, pad.l + 150, pad.t + 14);
      x.fillStyle = '#51606b'; x.textAlign = 'center';
      x.fillText('最近 12 s 平衡弛豫窗口', pad.l + pw / 2, H - 8);
    });

    bar.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      if (act === 'half') wb.setParam('V', Math.max(20, Math.round(sp.params.V / 2)));
      else if (act === 'double') wb.setParam('V', Math.min(60, Math.round(sp.params.V * 2)));
      else if (act === 'hot') wb.setParam('T', 70);
      else if (act === 'ice') wb.setParam('T', 5);
      else if (act === 'log') {
        const row = sp.inst?.getSample?.();
        if (row) wb.record(row);
      }
      cv.redraw();
    });

    cv.redraw();
    return { update() { cv.redraw(); } };
  },
};

// ================================================================ 9. 酸碱中和滴定与缓冲突跃边界 (L4 — 完整保留)
const IND = [
  { name: '酚酞 (8.2–10.0)', a: 8.2, b: 10.0, colA: '#f2f7fb', colM: '#f7c5dc', colB: '#d81b78' },
  { name: '甲基红 (4.4–6.2)', a: 4.4, b: 6.2, colA: '#df3342', colM: '#f29b38', colB: '#f4d35e' },
  { name: '甲基橙 (3.1–4.4)', a: 3.1, b: 4.4, colA: '#e03131', colM: '#f08c2e', colB: '#f5cb3c' },
];
const ACID_TYPES = ['strong', 'weak']; // 0: HCl 强酸, 1: CH3COOH 弱酸

function indicatorColor(pH, idx) {
  const it = IND[idx] || IND[0];
  if (pH <= it.a) return it.colA;
  if (pH >= it.b) return it.colB;
  return mixHex(it.colA, it.colB, (pH - it.a) / (it.b - it.a));
}

export const titration = {
  id: 'chem-titration',
  subject: 'chem',
  title: '酸碱中和滴定与缓冲突跃边界',
  en: 'Acid–base neutralization titration & equivalence jump limits',
  lede: [
    '用已知浓度的 NaOH 标准液滴定未知浓度的盐酸或醋酸。滴定不是按图索骥的“变色瞬间”，而是溶液电荷守恒与质子平衡在等当点附近的指数级跳变。',
    '直接转动滴定管下端的聚四氟乙烯活塞控制流速，对比强酸与弱酸的 pH 突跃区间，诊断为何醋酸不可用甲基橙作指示剂。',
  ],
  formula: '[H⁺] + [Na⁺] = [OH⁻] + [A⁻] · K_w = 1.0×10⁻¹⁴ (25°C)',
  formulaNote: '采用全区间电荷/质子守恒解析与二分精确求解，实时输出 [H⁺], [OH⁻], [HA], [A⁻]',
  terms: [
    ['突跃范围', '等当点 ±0.1% 体积内 pH 剧变区间；弱酸突跃更窄、整体偏碱性 (7.7–9.7)'],
    ['缓冲半程点', '弱酸加入一半体积强碱时 [HA]=[A⁻]，溶液 pH 恰好等于 pKa (醋酸 ≈ 4.76)'],
    ['系统误差边界', '滴定前尖嘴气泡未排尽，终点逸出后会虚增标准液消耗读数 ΔV'],
  ],
  predict: {
    q: '用 0.1000 mol/L NaOH 滴定 20.00 mL 同浓度醋酸（CH₃COOH, pKa=4.76），为何不能选甲基橙（3.1–4.4）作指示剂？',
    options: [
      '甲基橙会与醋酸发生沉淀反应',
      '醋酸等当点在碱性 (~8.72)，而甲基橙在酸性缓冲半程 (3.1–4.4) 就已提前变色结束',
      '甲基橙只能指示强碱被强酸滴定',
    ],
    answer: 1,
    why: '强碱滴定弱酸生成的醋酸钠水解显碱性（等当点 pH ≈ 8.72，突跃约 7.7–9.7），只有酚酞（8.2–10.0）落在突跃区内；甲基橙在半程缓冲段就变黄，误差高达 50% 以上。',
  },
  challenge: '分别完成 0.100 mol/L 强酸与弱酸两套滴定；再打开“尖嘴气泡”或“仰视误差”，在记录簿中核算待测液计算浓度的相对偏差！',
  fig: '酸式/碱式滴定管、聚四氟乙烯控制阀与 pH 传感器联测台',
  hint: '左右拖动紫色活塞旋钮（或按滴加按钮）流放标准 NaOH 溶液；摇晃锥形瓶加速混匀；在工作台查看一阶导数 ΔpH/ΔV 突跃峰。',
  teach: {
    where: '人教版化学选择性必修1第三章《水溶液中的离子反应与平衡》§3.2 实验（海南高中化学学生必做实验）',
    ask: [
      '比较 HCl 与 CH₃COOH 在加入 10.00 mL NaOH（半当量点）时的 pH 差异，并用平衡常数 Ka 解释。',
      '为什么滴定终点前尖嘴气泡突然排出，会让算出的待测酸浓度 c(酸) 偏高？',
    ],
    simplify: '设 25°C 下 Kw = 1.0×10⁻¹⁴，醋酸 Ka = 1.75×10⁻⁵；假设体积严格加和且忽略活度系数修正与溶解 CO₂ 影响。',
    safety: '实验室使用强酸、强碱溶液应佩戴护目镜；NaOH 溶液必须装入带聚四氟乙烯塞或乳胶管的碱式滴定管中，防止磨口玻璃活塞粘连。',
  },
  controls: [
    { id: 'acid', label: '待测酸体系', type: 'choice', options: ['强酸 HCl (20.0 mL)', '弱酸 CH₃COOH (20.0 mL)'], value: 0 },
    { id: 'ind', label: '酸碱指示剂', type: 'choice', options: IND.map((x) => x.name), value: 0 },
    { id: 'cAcid', label: '真实待测酸浓度', min: 0.06, max: 0.14, step: 0.01, value: 0.10, unit: 'mol/L' },
    { id: 'errMode', label: '操作误差模拟', type: 'choice', options: ['规范操作', '滴前尖嘴气泡 (+0.35mL)', '终点仰视读数 (+0.20mL)'], value: 0 },
    { id: 'bDrop', label: '精准微滴', type: 'button', action: 'drop05', text: '逐滴 +0.05 mL' },
    { id: 'bFast', label: '快速加液', type: 'button', action: 'add1', text: '放液 +1.00 mL' },
    { id: 'bResetT', label: '重装滴定管', type: 'button', action: 'resetT', text: '清零重做' },
  ],
  record: {
    note: '在颜色刚刚发生明显持久突变（半分钟不褪色）时记录终点体积并计算待测酸浓度，比较与真实值的相对误差。',
    pending: '控制活塞滴加 NaOH 并点击记录或完成工作台突跃判定后自动记入实验册。',
    columns: [
      { key: 'acidName', label: '酸体系' },
      { key: 'indName', label: '指示剂' },
      { key: 'vUsed', label: '消耗 V(NaOH)', unit: 'mL', digits: 2 },
      { key: 'pH', label: '实时 pH', digits: 2 },
      { key: 'cCalc', label: '测算 c(酸)', unit: 'mol/L', digits: 4, stat: true },
      { key: 'relErrPct', label: '相对误差', unit: '%', digits: 2 },
    ],
    sample: (inst, p) => {
      const s = inst.snapshot();
      return {
        _kind: 'human',
        acidName: p.acid === 1 ? 'CH₃COOH' : 'HCl',
        indName: IND[p.ind ?? 0].name.split(' ')[0],
        vUsed: s.vRead,
        pH: s.pH,
        cCalc: (0.100 * s.vRead) / 20.0,
        relErrPct: (((0.100 * s.vRead) / 20.0 - p.cAcid) / p.cAcid) * 100,
      };
    },
    summary: (rows) => [
      ['已录入终点数据', `${rows.length} 次`],
      ['最近一次测算浓度', rows.length ? `${rows[rows.length - 1].cCalc.toFixed(4)} mol/L` : '—'],
    ],
    errors: [
      '终点指示剂误选（如醋酸用甲基橙）可造成系统负偏差超过 -40%。',
      '尖嘴未排气泡并在滴定中排出会多计空气占位体积 ΔV ≈ 0.35 mL，导致测得 c(酸) 虚高。',
    ],
  },

  build(k) {
    const p = k.p;
    const rand = rng(31415);
    const base = group(
      at(box(4.6, 0.16, 2.8, '#e8e5dc'), 0, 0.08, -0.3),
      at(cyl(0.08, 4.9, '#b8c0c6', { seg: 16 }), -1.1, 2.55, -0.8),
      at(box(1.1, 0.10, 0.16, '#48545e'), -0.55, 3.6, -0.8),
    );
    k.root.add(base);

    const burette = group();
    burette.position.set(0, 3.6, -0.8);
    const tubeGlass = glass(new THREE.CylinderGeometry(0.14, 0.14, 3.2, 24), { color: 0xe6f2fa, opacity: 0.25 });
    const tipGlass = glass(new THREE.CylinderGeometry(0.08, 0.025, 0.45, 16), { color: 0xe6f2fa, opacity: 0.28 });
    tipGlass.position.y = -1.98;
    const liqCol = flat(new THREE.CylinderGeometry(0.115, 0.115, 1, 20).translate(0, 0.5, 0), '#d6ecfa', { opacity: 0.58 });
    const stopcock = group(
      solid(new THREE.CylinderGeometry(0.16, 0.16, 0.24, 18).rotateZ(Math.PI / 2), '#f7f8fa', { kind: 'ceramic' }),
      at(box(0.46, 0.11, 0.08, '#4a90d9'), 0, 0, 0),
    );
    stopcock.position.y = -1.68;
    burette.add(tubeGlass, tipGlass, liqCol, stopcock);
    k.root.add(burette);

    const flaskGlass = glass(new THREE.CylinderGeometry(0.32, 0.96, 1.55, 28, 1, true), { color: 0xe8f4fb, opacity: 0.28 });
    flaskGlass.position.set(0, 0.95, -0.8);
    const liqMat = new THREE.MeshStandardMaterial({ color: '#f2f7fb', roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.78 });
    const flaskLiq = new THREE.Mesh(new THREE.CylinderGeometry(0.70, 0.92, 0.55, 28), liqMat);
    flaskLiq.position.set(0, 0.45, -0.8);
    flaskLiq.layers.set(1);
    const electrode = at(cyl(0.04, 1.45, '#2b3944', { seg: 12 }), 0.28, 1.15, -0.8);
    const drop = flat(new THREE.SphereGeometry(0.045, 12, 8), '#d6ecfa', { opacity: 0.9 });
    drop.position.set(0, 1.35, -0.8);
    k.root.add(flaskGlass, flaskLiq, electrode, drop);

    const readout = sheet(2.45, 1.35, () => {}, {});
    readout.position.set(1.9, 2.35, -0.4);
    readout.rotation.y = -0.25;
    k.root.add(readout, at(note('拖动旋钮控制流速', { size: 0.22, w: 2.2 }), -1.5, 1.95, -0.2));

    let vBase = 0, valve = 0, dropY = 1.4, curPH = 1, lastPaintKey = '';
    const vEquiv = () => (p.cAcid * 20.0) / 0.100;
    const vDisplayed = () => vBase + (p.errMode === 1 && vBase > vEquiv() * 0.65 ? 0.35 : 0) + (p.errMode === 2 ? 0.20 : 0);

    const computePH = () => {
      const sol = solveTitrationPH(vBase, p.cAcid, 20.0, 0.100, ACID_TYPES[p.acid ?? 0]);
      curPH = sol.pH;
      return sol;
    };

    const drawVisuals = () => {
      const sol = computePH();
      const col = indicatorColor(curPH, p.ind ?? 0);
      liqMat.color.set(col);
      const frac = clamp(1 - vDisplayed() / 42.0, 0.06, 1);
      liqCol.scale.set(1, frac * 3.0, 1);
      liqCol.position.y = -1.55;
      stopcock.rotation.z = valve * (Math.PI / 2);

      const hScaled = clamp(0.45 + vBase * 0.014, 0.4, 1.05);
      flaskLiq.scale.set(1, hScaled / 0.55, 1);
      flaskLiq.position.y = 0.18 + hScaled * 0.5;

      const pk = `${vBase.toFixed(2)}|${curPH.toFixed(2)}|${p.ind}|${p.acid}|${p.errMode}|${valve.toFixed(2)}`;
      if (pk !== lastPaintKey) {
        lastPaintKey = pk;
        readout.redraw((x, s, w, h) => {
          x.fillStyle = '#fffdf7'; x.fillRect(0, 0, w * s, h * s);
          x.strokeStyle = C.ink; x.lineWidth = s * 0.03; x.strokeRect(0.03 * s, 0.03 * s, (w - 0.06) * s, (h - 0.06) * s);
          x.fillStyle = C.ink; x.font = `700 ${s * 0.26}px Georgia,serif`; x.textBaseline = 'top';
          x.fillText(`pH ${curPH.toFixed(2)}`, 0.16 * s, 0.16 * s);
          x.fillStyle = '#51606b'; x.font = `${s * 0.16}px "Songti SC",serif`;
          x.fillText(`读数 V = ${vDisplayed().toFixed(2)} mL`, 0.16 * s, 0.56 * s);
          x.fillStyle = col; x.fillRect(0.16 * s, 0.88 * s, 0.42 * s, 0.24 * s);
          x.strokeStyle = C.ink; x.lineWidth = s * 0.015; x.strokeRect(0.16 * s, 0.88 * s, 0.42 * s, 0.24 * s);
          x.fillStyle = '#1f4a3e'; x.font = `${s * 0.14}px "Songti SC",serif`;
          const stText = Math.abs(vBase - vEquiv()) <= 0.15 ? '已近突跃终点' : vBase > vEquiv() + 0.15 ? '碱过量' : '酸液剩余';
          x.fillText(stText, 0.68 * s, 0.93 * s);
          void sol;
        });
      }
    };

    let dragX0 = null, v0 = 0;
    k.drag(stopcock, {
      start: (q) => { dragX0 = q.x; v0 = valve; },
      move: (q) => { if (dragX0 !== null) { valve = clamp(v0 + (q.x - dragX0) * 1.4, 0, 1); k.dirty(); } },
      end: () => { valve = 0; dragX0 = null; k.dirty(); },
    });

    const addVolume = (dv) => {
      vBase = clamp(vBase + dv, 0, 40.0);
      drawVisuals();
      k.dirty();
    };

    drawVisuals();
    return {
      snapshot: () => ({ vBase, vRead: vDisplayed(), pH: curPH }),
      setVolume(v) { vBase = clamp(v, 0, 40.0); drawVisuals(); k.dirty(); },
      press(id) {
        if (id === 'drop05' || id === 'bDrop') addVolume(0.05);
        else if (id === 'add1' || id === 'bFast') addVolume(1.00);
        else if (id === 'resetT' || id === 'bResetT') { vBase = 0; valve = 0; drawVisuals(); k.dirty(); }
      },
      change() { drawVisuals(); k.dirty(); },
      update(dt) {
        if (valve > 0.04) {
          addVolume(valve * 1.6 * dt);
          drop.visible = true;
          dropY -= dt * 3.4; if (dropY < 0.7) dropY = 1.45;
          drop.position.y = dropY;
        } else {
          drop.visible = false;
        }
        void gauss(rand);
      },
      margin() {
        const ve = vEquiv();
        return [
          `${p.acid === 1 ? 'CH₃COOH' : 'HCl'} 20.0 mL (真 ${p.cAcid.toFixed(2)} M)`,
          `V_读 = ${vDisplayed().toFixed(2)} mL`,
          `pH = ${curPH.toFixed(2)}`,
          `理论等当点 ${ve.toFixed(2)} mL`,
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 全程质子守恒滴定曲线 V–pH 与一阶导数突跃峰 ΔpH/ΔV');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn primary" data-wb="drop">逐滴 +0.05 mL</button>
      <button type="button" class="wb-btn" data-wb="near">跳转至终点前 (-0.5 mL)</button>
      <button type="button" class="wb-btn" data-wb="record">计入当前终点记录</button>
      <button type="button" class="wb-btn" data-wb="reset">重装清零</button>`;
    sec1.append(bar);

    let hoverV = null;
    const cvBox = wb.canvas(sec1, 520, 270, (x, W, H) => {
      const p = sp.params, inst = sp.inst;
      const vNow = inst?.snapshot?.().vBase ?? 0;
      const acidType = ACID_TYPES[p.acid ?? 0];
      const cAcid = p.cAcid ?? 0.10;
      const ind = IND[p.ind ?? 0];
      const pad = { l: 48, r: 22, t: 24, b: 36 };
      const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      const sx = (v) => pad.l + (v / 40) * pw;
      const sy = (phv) => pad.t + ph - (phv / 14) * ph;

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      x.fillStyle = 'rgba(216, 27, 120, 0.10)';
      x.fillRect(pad.l, sy(ind.b), pw, sy(ind.a) - sy(ind.b));
      x.fillStyle = '#a03b66'; x.font = '11px "Noto Serif SC",serif';
      x.fillText(`当前指示剂变色带: ${ind.name}`, pad.l + 8, sy(ind.b) + 13);

      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.4;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();
      x.fillStyle = '#51606b'; x.font = '11px Georgia,serif'; x.textAlign = 'center';
      for (let v = 0; v <= 40; v += 10) x.fillText(`${v}mL`, sx(v), H - 18);
      x.fillText('加入 NaOH 体积 V (mL)', pad.l + pw / 2, H - 5);
      x.textAlign = 'right';
      for (let pH = 0; pH <= 14; pH += 2) x.fillText(`${pH}`, pad.l - 6, sy(pH) + 4);

      x.strokeStyle = '#b4653a'; x.lineWidth = 2.1; x.beginPath();
      let prevPH = null;
      const deriv = [];
      for (let i = 0; i <= 200; i++) {
        const v = (i / 200) * 40;
        const sol = solveTitrationPH(v, cAcid, 20.0, 0.100, acidType);
        if (i === 0) x.moveTo(sx(v), sy(sol.pH)); else x.lineTo(sx(v), sy(sol.pH));
        if (prevPH !== null) deriv.push([v, (sol.pH - prevPH) / (40 / 200)]);
        prevPH = sol.pH;
      }
      x.stroke();

      const maxD = Math.max(2, ...deriv.map((d) => d[1]));
      x.strokeStyle = 'rgba(31, 74, 62, 0.55)'; x.lineWidth = 1.3; x.beginPath();
      deriv.forEach(([v, dv], i) => {
        const yy = pad.t + ph - clamp(dv / maxD, 0, 1) * (ph * 0.85);
        if (i === 0) x.moveTo(sx(v), yy); else x.lineTo(sx(v), yy);
      });
      x.stroke();

      const curSol = solveTitrationPH(vNow, cAcid, 20.0, 0.100, acidType);
      x.fillStyle = '#1f4a3e'; x.beginPath(); x.arc(sx(vNow), sy(curSol.pH), 5.5, 0, TAU); x.fill();

      const inspectV = hoverV !== null ? hoverV : vNow;
      const spSol = solveTitrationPH(inspectV, cAcid, 20.0, 0.100, acidType);
      x.strokeStyle = 'rgba(30,43,54,0.4)'; x.setLineDash([4, 3]);
      x.beginPath(); x.moveTo(sx(inspectV), pad.t); x.lineTo(sx(inspectV), pad.t + ph); x.stroke(); x.setLineDash([]);
      x.fillStyle = '#1e2b36'; x.textAlign = 'left'; x.font = '12px Georgia,serif';
      x.fillText(`V=${inspectV.toFixed(2)}mL · pH=${spSol.pH.toFixed(2)} · [H⁺]=${spSol.species.H.toExponential(1)}`, pad.l + 8, pad.t + 14);
    });

    const diag = document.createElement('div');
    diag.className = 'wb-metrics';
    sec1.append(diag);

    const refresh = () => {
      cvBox.redraw();
      const p = sp.params;
      const ve = (p.cAcid * 20.0) / 0.100;
      const eqPH = solveTitrationPH(ve, p.cAcid, 20.0, 0.100, ACID_TYPES[p.acid ?? 0]).pH;
      const ind = IND[p.ind ?? 0];
      const fitInd = eqPH >= ind.a - 0.8 && eqPH <= ind.b + 0.8;
      diag.innerHTML = `
        <div class="wb-m"><span>等当点真实 pH</span><b>${eqPH.toFixed(2)} (V_eq=${ve.toFixed(2)}mL)</b></div>
        <div class="wb-m"><span>指示剂匹配诊断</span><b>${fitInd ? '匹配突跃区间' : '⚠ 偏离突跃区！将产严重误差'}</b></div>`;
    };

    cvBox.cv.addEventListener('pointermove', (e) => {
      const pt = cvBox.toLocal(e);
      hoverV = clamp(((pt.x - 48) / (520 - 70)) * 40, 0, 40);
      cvBox.redraw();
    });
    cvBox.cv.addEventListener('pointerleave', () => { hoverV = null; cvBox.redraw(); });

    bar.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.wb;
      if (!act) return;
      if (act === 'drop') wb.press('bDrop');
      else if (act === 'near') {
        const ve = (sp.params.cAcid * 20.0) / 0.100;
        sp.inst?.setVolume?.(Math.max(0, ve - 0.5));
      } else if (act === 'record') {
        const row = titration.record.sample(sp.inst, sp.params);
        if (row) wb.record(row);
      } else if (act === 'reset') wb.press('bResetT');
      refresh();
    });

    refresh();
    return { update() { refresh(); } };
  },
};

// ================================================================ 10. 盐类水解的应用与酸碱性测定 (L3)
const SALTS_HYD = [
  { key: 'NaCl', label: 'NaCl (强酸强碱盐)', col: '#eef6fa' },
  { key: 'CH3COONa', label: 'CH₃COONa (强碱弱酸盐)', col: '#eef6fa' },
  { key: 'NH4Cl', label: 'NH₄Cl (强酸弱碱盐)', col: '#eef6fa' },
  { key: 'Na2CO3', label: 'Na₂CO₃ (强碱弱酸盐)', col: '#eef6fa' },
  { key: 'FeCl3', label: 'FeCl₃ (强烈水解生成胶体)', col: '#d89b3c' },
];

function phStripColor(pH) {
  const stops = [
    [1, '#d92638'], [3, '#eb6b2d'], [5, '#f2b729'], [7, '#75b843'],
    [9, '#2b9c7a'], [11, '#2b6cb8'], [13, '#6e34a8'],
  ];
  if (pH <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (pH <= stops[i][0]) {
      return mixHex(stops[i - 1][1], stops[i][1], (pH - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
    }
  }
  return stops[stops.length - 1][1];
}

function hydrolysisDegree(saltKey, conc, tempC) {
  const sol = solveHydrolysisPH(saltKey, conc, tempC);
  if (saltKey === 'NaCl') return { ...sol, hPct: 0 };
  const hIon = Math.pow(10, -sol.pH);
  const ohIon = Math.pow(10, -(sol.pKw - sol.pH));
  const h = (saltKey === 'CH3COONa' || saltKey === 'Na2CO3') ? ohIon / conc : hIon / conc;
  return { ...sol, hPct: clamp(h * 100, 0, 100) };
}

export const hydrolysis = {
  id: 'chem-hydrolysis',
  subject: 'chem',
  title: '盐类水解的应用与酸碱性定量测定',
  en: 'Salt hydrolysis pH solver, dilution & heating degree h',
  lede: [
    '“谁弱谁水解，谁强显谁性”：CH₃COONa 与 Na₂CO₃ 水解显碱性，NH₄Cl 与 FeCl₃ 水解显酸性，而 NaCl 不水解显中性。',
    '调用严格水相离子平衡求解器，用 pH 计与广范试纸测出不同浓度与温度下的 pH，并在工作台亲眼验证“越稀越水解、越热越水解”两条铁律！',
  ],
  formula: 'A⁻ + H₂O ⇌ HA + OH⁻ · K_h = K_w / K_a · h ≈ √(K_h / c)',
  formulaNote: '稀释使浓度 c 减小，水解度 h 增大（越稀越水解）；升温既增大 K_w 又促进吸热水解平衡正向移动（越热越水解）',
  terms: [
    ['越稀越水解', '稀释盐溶液时离子浓度减小，平衡向离子数目增多的水解方向移动，水解百分率 h 上升'],
    ['越热越水解', '盐类水解是中和反应的逆反应，故必定吸热 (ΔH > 0)；升温促进行动使 FeCl₃ 趋向 Fe(OH)₃ 胶体'],
    ['Kw(T) 随温变', '升温同时增大水的离子积 K_w，使中性界线 pK_w/2 低于 7（如 80°C 中性 pH ≈ 6.3）'],
  ],
  predict: {
    q: '将 0.1 mol/L 的 CH₃COONa 溶液加水稀释至 0.01 mol/L，其水解程度 h 与溶液 pH 分别如何变化？',
    options: ['h 增大，pH 减小', 'h 增大，pH 增大', 'h 减小，pH 减小'],
    answer: 0,
    why: '加水稀释促进水解，故水解百分率 h ≈ √(Kh/c) 增大；但溶液体积增大的稀释主导效应使 [OH⁻] 总浓度降低，因此 pH 减小（仍大于 7）。',
  },
  challenge: '选择 FeCl₃ 并把温度升高到 85°C 观察溶液颜色由淡黄转深红褐胶体；再到工作台将 CH₃COONa 从 1.0 M 稀释到 0.001 M 观察 h 曲线飙升！',
  fig: '恒温盐溶液烧杯、数字 pH 计、表面皿与广范 pH 试纸变色卡',
  hint: '选择盐种类、浓度与温度，按“试纸蘸取测 pH”触发试纸变色并读取精确 pH；在工作台检验稀释与升温双曲线。',
  teach: {
    where: '人教版化学选择性必修 1 第三章 §3.3《盐类的水解》',
    ask: [
      '比较同浓度 Na₂CO₃ 与 CH₃COONa 的 pH 差异，说明对应共轭酸 Ka 与盐根水解能力的关系。',
      '实验室配制 FeCl₃ 溶液时为何要先加浓盐酸溶解，再稀释到所需体积？',
    ],
    simplify: '采用 ../core/science-models.js 中 solveHydrolysisPH 全区间二分电荷守恒与温度相关 Kw(T) 模型；FeCl₃ 胶体色泽按温度/稀释程度插值示意。',
    safety: 'Na₂CO₃ 与 FeCl₃ 均具一定腐蚀性，加热高温玻璃烧杯勿直接徒手触碰。',
  },
  controls: [
    { id: 'salt', type: 'choice', label: '', options: SALTS_HYD.map((s) => s.label), value: 1, wide: true },
    { id: 'conc', label: '盐溶液浓度 c', min: 0.01, max: 1.0, step: 0.01, value: 0.10, unit: 'mol/L' },
    { id: 'tempC', label: '溶液温度 T', min: 10, max: 90, step: 5, value: 25, unit: '°C' },
    { id: 'dip', type: 'button', label: '试纸蘸取测 pH' },
  ],
  record: {
    note: '测定五种盐在不同浓度和温度下的真实 pH 与水解百分率 h，检验“越稀越水解、越热越水解”。',
    pending: '点击“试纸蘸取测 pH”或记录按钮将当前测定结果存入实验册。',
    columns: [
      { key: 'saltName', label: '盐溶液' },
      { key: 'conc', label: 'c', unit: 'mol/L', digits: 2 },
      { key: 'tempC', label: 'T', unit: '°C', digits: 0 },
      { key: 'pH', label: '实测 pH', digits: 2, stat: true },
      { key: 'hPct', label: '水解度 h', unit: '%', digits: 3 },
      { key: 'nature', label: '酸碱性' },
    ],
    sample: (inst, p) => inst.getSample?.(p),
    summary: (rows) => [
      ['已测定盐样', `${rows.length} 次`],
      ['最大水解度', rows.length ? `${Math.max(...rows.map((r) => r.hPct)).toFixed(3)}%` : '—'],
    ],
    errors: [
      '用广范 pH 试纸测 pH 时先用水润湿试纸，相当于局部稀释，会使酸碱盐测得值向中性偏移。',
      '高温下直接按 pH=7 判别中性而忘记考虑水的电离平衡常数 Kw(T) 随温度升高。',
    ],
  },

  build(k) {
    const p = k.p, X = -1.6, Z = -0.6;
    const bkr = at(makeBeaker(1.25, 2.05), X, 0.04, Z);
    bkr.fill(1.35);
    const probe = at(cyl(0.06, 2.35, '#2b3944', { seg: 14 }), X + 0.45, 0.45, Z);
    const dish = at(lathe([[0, 0], [0.85, 0.02], [1.05, 0.14], [1.0, 0.18], [0, 0.05]], '#eef6fa', { seg: 28 }), 1.2, 0.02, Z + 0.5);
    const stripMesh = at(box(1.15, 0.03, 0.24, '#f5d966'), 1.2, 0.09, Z + 0.5);
    const meterCard = at(sheet(2.6, 1.4, () => {}, { opaque: true, ink: true, lay: 'tilt' }), 1.6, 0, -1.8);
    const info = at(card('\n\n', { w: 4.8, size: 0.25, align: 'left' }), 1.2, 0, 2.5);
    k.root.add(bkr, probe, dish, stripMesh, meterCard, info);

    let dipped = false, lastKey = '';

    return {
      getSample(par) {
        const s = SALTS_HYD[par.salt ?? 0];
        const res = hydrolysisDegree(s.key, par.conc, par.tempC);
        return {
          _kind: 'human',
          saltName: s.key,
          conc: par.conc,
          tempC: par.tempC,
          pH: res.pH,
          hPct: res.hPct,
          nature: res.nature,
        };
      },
      press(id) {
        if (id === 'dip') dipped = true;
        k.dirty();
      },
      change() { lastKey = ''; k.dirty(); },
      update() {
        const s = SALTS_HYD[p.salt ?? 0];
        const res = hydrolysisDegree(s.key, p.conc, p.tempC);
        let solCol = s.col;
        if (s.key === 'FeCl3') {
          const collFactor = clamp((p.tempC - 20) / 70 + (1 - p.conc) * 0.3, 0, 1);
          solCol = mixHex('#e2a53b', '#8e2812', collFactor);
        }
        bkr.tint(solCol, s.key === 'FeCl3' ? 0.72 : 0.45);
        stripMesh.material.color.set(dipped ? phStripColor(res.pH) : '#f5d966');

        const pk = `${s.key}|${p.conc.toFixed(2)}|${p.tempC}|${dipped}`;
        if (pk !== lastKey) {
          lastKey = pk;
          meterCard.redraw((x, sc, w, h) => {
            x.fillStyle = '#fffdf7'; x.fillRect(0, 0, w * sc, h * sc);
            x.strokeStyle = C.ink; x.lineWidth = sc * 0.025; x.strokeRect(0.02 * sc, 0.02 * sc, (w - 0.04) * sc, (h - 0.04) * sc);
            x.fillStyle = C.ink; x.font = `bold ${sc * 0.28}px Georgia,serif`;
            x.fillText(`pH ${res.pH.toFixed(2)}`, 0.16 * sc, 0.4 * sc);
            x.fillStyle = '#1f4a3e'; x.font = `${sc * 0.16}px "Songti SC",serif`;
            x.fillText(`${res.nature} · 中性点 ${(res.pKw / 2).toFixed(2)}`, 0.16 * sc, 0.78 * sc);
            x.fillStyle = '#b4653a';
            x.fillText(`水解度 h ≈ ${res.hPct.toFixed(3)}%`, 0.16 * sc, 1.08 * sc);
          });
        }
        info.set(`${s.label} (${p.conc.toFixed(2)} M, ${p.tempC}°C)\n${res.reaction || '强酸强碱盐不发生水解'}\n${dipped ? `pH 试纸显色对应 pH ≈ ${res.pH.toFixed(1)}` : '点击“试纸蘸取测 pH”对比试纸标准色卡'}`);
      },
      margin() {
        const s = SALTS_HYD[p.salt ?? 0];
        const res = hydrolysisDegree(s.key, p.conc, p.tempC);
        return [
          `盐：${s.key}`,
          `pH = ${res.pH.toFixed(2)}`,
          `pKw(T) = ${res.pKw.toFixed(2)}`,
          `h = ${res.hPct.toFixed(3)}%`,
          '越稀越水解 · 越热越水解',
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec = wb.section('1 · “越稀越水解”与“越热越水解”双曲线解析');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `<button type="button" class="wb-btn primary" data-log>记录当前水解工况</button>`;
    sec.append(bar);

    const cv = wb.canvas(sec, 520, 235, (x, W, H) => {
      const p = sp.params;
      const s = SALTS_HYD[p.salt ?? 0];
      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      // 左图：log10(c) [-3..0] vs 水解度 h (%)
      const drawSub = (ox, wSub, title, xLbl, evalFn, curX, curY, yMax, col, xr, refFn) => {
        const pad = { l: ox + 40, r: ox + wSub - 12, t: 28, b: H - 30 };
        const pw = pad.r - pad.l, ph = pad.b - pad.t;
        const sx = (v) => pad.l + ((v - xr[0]) / (xr[1] - xr[0])) * pw;
        const sy = (v) => pad.b - clamp(v / yMax, 0, 1) * ph;
        x.strokeStyle = '#1e2b36'; x.lineWidth = 1.4;
        x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.b); x.lineTo(pad.r, pad.b); x.stroke();
        if (refFn) {
          x.strokeStyle = '#888'; x.setLineDash([4, 3]); x.beginPath();
          for (let i = 0; i <= 40; i++) {
            const xv = lerp(xr[0], xr[1], i / 40), yv = refFn(xv);
            if (i === 0) x.moveTo(sx(xv), sy(yv)); else x.lineTo(sx(xv), sy(yv));
          }
          x.stroke(); x.setLineDash([]);
        }
        x.strokeStyle = col; x.lineWidth = 2.2; x.beginPath();
        for (let i = 0; i <= 40; i++) {
          const xv = lerp(xr[0], xr[1], i / 40), yv = evalFn(xv);
          if (i === 0) x.moveTo(sx(xv), sy(yv)); else x.lineTo(sx(xv), sy(yv));
        }
        x.stroke();
        x.fillStyle = '#1e2b36';
        x.beginPath(); x.arc(sx(curX), sy(curY), 4.5, 0, TAU); x.fill();
        x.font = 'bold 11.5px "Songti SC",serif'; x.textAlign = 'left';
        x.fillText(title, pad.l + 4, 16);
        x.fillStyle = '#51606b'; x.font = '10.5px Georgia,serif'; x.textAlign = 'center';
        x.fillText(xLbl, pad.l + pw / 2, H - 8);
      };

      const cur = hydrolysisDegree(s.key, p.conc, p.tempC);
      const hMax = Math.max(1, hydrolysisDegree(s.key, 0.001, p.tempC).hPct * 1.15);
      drawSub(
        0, 260, `越稀越水解：h (%) vs lg c`, 'lg c (-3=0.001M → 0=1M)',
        (lgC) => hydrolysisDegree(s.key, Math.pow(10, lgC), p.tempC).hPct,
        Math.log10(p.conc), cur.hPct, hMax, '#b4653a', [-3, 0],
      );
      drawSub(
        260, 260, `越热越水解：pH vs T (°C)`, '温度 T (10°C → 90°C)',
        (T) => hydrolysisDegree(s.key, p.conc, T).pH,
        p.tempC, cur.pH, 14, '#1f4a3e', [10, 90],
        (T) => solveHydrolysisPH('NaCl', p.conc, T).pH,
      );
    });

    bar.addEventListener('click', (e) => {
      if (e.target.closest('[data-log]')) {
        const row = sp.inst?.getSample?.(sp.params);
        if (row) wb.record(row);
      }
    });
    cv.redraw();
    return { update() { cv.redraw(); } };
  },
};

// ================================================================ 11. 电解水与饱和食盐水法拉第定量 (L3)
export const electrolysis = {
  id: 'chem-electrolysis',
  subject: 'chem',
  title: '霍夫曼电解池、氯碱反应与法拉第定量',
  en: 'Hofmann voltameter, brine electrolysis & Faraday n = Q/(zF)',
  lede: [
    '接通直流电源，霍夫曼电解器两支刻度管分别收集还原产物与氧化产物：电解水时阴极 H₂ 与阳极 O₂ 体积比恒为 2 : 1。',
    '若换成饱和食盐水（氯碱工业），阴极产生 H₂ 并伴随 OH⁻ 使酚酞显红，阳极则析出黄绿色 Cl₂ 并能使湿润淀粉–KI 试纸变蓝！在工作台回归斜率测定法拉第常数 F。',
  ],
  formula: 'Q = I · t · n(e⁻) = Q / F · V(H₂) = (Q / 2F) · V_m (F = 96485 C/mol)',
  formulaNote: '电解水：2H₂O = 2H₂↑ + O₂↑ (2:1)；电解食盐水：2NaCl + 2H₂O = 2NaOH + H₂↑ + Cl₂↑ (1:1)',
  terms: [
    ['法拉第常数 F', '1 mol 电子所带的电量，F = N_A · e ≈ 96485 C/mol'],
    ['氯碱显色检验', '阴极生成 OH⁻ 使酚酞变紫红；阳极 Cl₂ 氧化 I⁻ 生成 I₂ 使淀粉变蓝'],
    ['体积偏差原因', '真实电解中 O₂ 与 Cl₂ 在水中的溶解度显著大于 H₂，初期收集的阳极气体体积略偏小'],
  ],
  predict: {
    q: '用惰性电极电解饱和 NaCl 溶液（预先在两极附近滴加酚酞），通电后两极观察到的正确现象是？',
    options: [
      '阴极产生气泡且周围溶液变红，阳极产生黄绿色刺激性气体',
      '阳极产生气泡且溶液变红，阴极析出金属钠',
      '两极产生 2:1 的氢气与氧气，溶液均不变色',
    ],
    answer: 0,
    why: '溶液中 H⁺ 放电能力强于 Na⁺，阴极反应 2H₂O + 2e⁻ = H₂↑ + 2OH⁻，使酚酞变红；Cl⁻ 放电能力强于 OH⁻，阳极反应 2Cl⁻ − 2e⁻ = Cl₂↑。',
  },
  challenge: '对比电解水 (2:1) 与电解饱和食盐水 (1:1 酚酞变红)；再到工作台在不同电流/时间点采样，线性拟合 V(H₂) – Q 核验法拉第常数！',
  fig: '霍夫曼 H 型双管电解仪、直流电源与电流表',
  hint: '调节电流 I 与电解液体系，打开“酚酞/淀粉-KI”开关观察阴极变红与阳极试纸变蓝；在工作台采样验证 n = Q/(zF)。',
  teach: {
    where: '人教版化学选择性必修 1 第四章 §4.3《电解池》（水电解与氯碱工业）',
    ask: [
      '电解饱和食盐水时，若去掉阴极阳极间的隔膜使 Cl₂ 与 NaOH 混合，会发生什么副反应？',
      '在电路通过 0.02 mol 电子时，电解水共收集到标准状况下多少毫升混合气体？',
    ],
    simplify: '设 25°C、101 kPa 下气体摩尔体积 Vm = 24.5 L/mol，法拉第常数 F = 96485 C/mol；动画以 10 倍时间流逝加速呈现。',
    safety: 'Cl₂ 有毒且具强烈刺激性，真实氯碱实验须加装 NaOH 尾气吸收装置并注意直流安全电压。',
  },
  controls: [
    { id: 'elecMode', type: 'choice', label: '电解体系', options: ['电解水 (稀 Na₂SO₄)', '电解饱和食盐水 (NaCl)'], value: 0 },
    { id: 'I', label: '直流电流 I', min: 0.2, max: 2.0, step: 0.1, value: 1.0, unit: 'A' },
    { id: 'on', type: 'toggle', label: '直流电源', value: true },
    { id: 'phen', type: 'toggle', label: '酚酞 + 淀粉KI检验', value: false },
    { id: 'resetE', type: 'button', label: '排空重做' },
  ],
  record: {
    note: '记下通电电量 Q、阴/阳极气体体积与产物摩尔数，在工作台线性拟合校验法拉第定律。',
    pending: '通电产生一定量气体后点击记录，存入电量–体积定量数据。',
    columns: [
      { key: 'modeName', label: '电解体系' },
      { key: 'qC', label: '电量 Q', unit: 'C', digits: 1 },
      { key: 'vCat', label: '阴极 V(H₂)', unit: 'mL', digits: 2, stat: true },
      { key: 'vAn', label: '阳极体积', unit: 'mL', digits: 2 },
      { key: 'nElec', label: '转移电子', unit: 'mmol', digits: 3 },
    ],
    sample: (inst, p) => inst.getSample?.(p),
    summary: (rows) => [
      ['已录入法拉第点', `${rows.length} 组`],
      ['最大累计电量', rows.length ? `${Math.max(...rows.map((r) => r.qC)).toFixed(1)} C` : '—'],
    ],
    errors: [
      'Cl₂ 易溶于水并与水反应，真实电解食盐水时初期阳极测得 Cl₂ 体积常小于理论 1:1。',
      '电流读数波动或未计及电解液温升导致气体热膨胀引入约 2% 体积测量偏差。',
    ],
  },

  build(k) {
    const p = k.p, Z = -0.6, H = 3.6, CAP = 22;
    const rig = at(new THREE.Group(), 0.7, 0, 0);
    k.root.add(rig);

    // 霍夫曼 H 型双管与中央连通储液管
    rig.add(
      at(glass(new THREE.BoxGeometry(4.6, 1.35, 2.2).translate(0, 0.675, 0)), 0, 0.02, Z),
      at(flat(new THREE.BoxGeometry(4.5, 1.0, 2.1).translate(0, 0.5, 0), '#cfe6ff', { opacity: 0.38 }), 0, 0.04, Z),
      tube([[-1.1, 1.1, Z], [1.1, 1.1, Z]], 0.14, '#e6f2fa'),
    );

    const mkTube = (x) => {
      const g = at(group(
        glass(new THREE.CylinderGeometry(0.42, 0.42, H, 32, 1, true).translate(0, H / 2, 0)),
        glass(new THREE.SphereGeometry(0.42, 24, 12, 0, TAU, 0, Math.PI / 2).translate(0, H, 0)),
      ), x, 0.5, Z);
      const col = liquid(0.39, H, '#cfe6ff', 0.48);
      const gasFill = liquid(0.37, 0.01, '#ffffff', 0.12);
      gasFill.position.y = H;
      g.add(col, gasFill, at(cyl(0.08, 0.9, '#8f989e'), 0, -0.3, 0));
      return { g, col, gasFill, bub: bubbler(14, { x, z: Z, rad: 0.2, y0: 1.0, r: 0.045, speed: 1.5 }) };
    };
    const neg = mkTube(-1.1), pos = mkTube(1.1);
    const kiPaper = at(box(0.28, 0.45, 0.04, '#f7f4e8'), 1.1, H + 0.75, Z);
    const bat = at(group(box(1.6, 0.9, 0.9, C.shade), at(note('直流电源', { size: 0.24 }), 0, 0.5, 0.46)), 0, 0, 2.15);
    const aMeter = at(meter('A', { w: 1.35, h: 0.95 }), -2.9, 0.1, 1.8);
    const info = at(card('\n\n', { w: 3.3, size: 0.26, align: 'left' }), -3.85, 0, -0.3);

    rig.add(
      neg.g, pos.g, neg.bub, pos.bub, kiPaper, bat, aMeter, info,
      tube([[-0.6, 0.5, 2.15], [-2.1, 0.08, 1.5], [-2.7, 0.08, Z], [-2.1, 0.6, Z], [-1.1, 0.25, Z]], 0.035, C.ink),
      tube([[0.6, 0.5, 2.15], [2.1, 0.08, 1.5], [2.7, 0.08, Z], [2.1, 0.6, Z], [1.1, 0.25, Z]], 0.035, C.red),
      at(note('− 阴极 (H₂)', { size: 0.28 }), -1.1, H + 1.45, Z),
      at(note('+ 阳极', { size: 0.28 }), 1.1, H + 1.45, Z),
    );

    let q = 0, t = 0;
    const calcV = () => {
      const nE = q / 96485;
      const vH2 = (nE / 2) * 24500;
      const vAn = (p.elecMode ?? 0) === 0 ? vH2 / 2 : vH2;
      return { nE, vH2, vAn };
    };

    return {
      getState: () => ({ q, t, ...calcV() }),
      getSample(par) {
        const s = calcV();
        return {
          _kind: 'human',
          modeName: (par.elecMode ?? 0) === 0 ? '电解水' : '电解食盐水',
          qC: q, vCat: s.vH2, vAn: s.vAn, nElec: s.nE * 1000,
        };
      },
      press(id) {
        if (id === 'resetE') { q = 0; t = 0; }
        k.dirty();
      },
      change(id) {
        if (id === 'elecMode') { q = 0; t = 0; }
        k.dirty();
      },
      update(dt) {
        const mode = p.elecMode ?? 0;
        const vNow = calcV();
        const run = Boolean(p.on) && vNow.vH2 < CAP;
        if (run) { q += p.I * dt * 10; t += dt * 10; }
        const s = calcV();
        const h2 = Math.min(CAP, s.vH2), an = Math.min(CAP, s.vAn);
        const hFrac = (h2 / CAP) * 0.9, aFrac = (an / CAP) * 0.9;

        const pink = mode === 1 && p.phen && q > 5;
        neg.col.set(H * (1 - hFrac), pink ? mixHex('#cfe6ff', '#e02478', clamp(q / 45, 0.2, 0.95)) : '#cfe6ff');
        pos.col.set(H * (1 - aFrac), mode === 1 ? '#e4f0c4' : '#cfe6ff');

        neg.gasFill.position.y = H * (1 - hFrac);
        neg.gasFill.set(H * hFrac, '#ffffff');
        neg.gasFill.fade(0.08);
        pos.gasFill.position.y = H * (1 - aFrac);
        pos.gasFill.set(H * aFrac, mode === 1 ? '#d8ea6b' : '#ffffff');
        pos.gasFill.fade(mode === 1 ? 0.28 : 0.08);

        kiPaper.visible = mode === 1 && Boolean(p.phen);
        kiPaper.material.color.set(q > 8 ? '#233b8c' : '#f7f4e8');

        neg.bub.step(dt, run ? p.I * 9 : 0, 0.5 + H * (1 - hFrac));
        pos.bub.step(dt, run ? p.I * (mode === 0 ? 4.5 : 9) : 0, 0.5 + H * (1 - aFrac));
        aMeter.set(run ? p.I / 2.2 : 0, `${(run ? p.I : 0).toFixed(1)} A`);

        info.set(`${mode === 0 ? '电解水 (2:1)' : '电解食盐水 (氯碱)'}\n阴极 H₂: ${h2.toFixed(1)} mL\n阳极 ${mode === 0 ? 'O₂' : 'Cl₂'}: ${an.toFixed(1)} mL\nQ = ${q.toFixed(1)} C · t = ${t.toFixed(0)} s`);
      },
      margin() {
        const s = calcV();
        const mode = p.elecMode ?? 0;
        return [
          `Q = It = ${q.toFixed(1)} C`,
          `n(e⁻) = ${(s.nE * 1000).toFixed(2)} mmol`,
          `V(H₂) = ${s.vH2.toFixed(1)} mL`,
          mode === 0 ? `V(O₂) = ${s.vAn.toFixed(1)} mL (2:1)` : `V(Cl₂) = ${s.vAn.toFixed(1)} mL (1:1)`,
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec = wb.section('1 · 法拉第电解定律定量验证 V(H₂) – Q 线性回归');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn primary" data-cap>采集当前 (Q, V_H₂) 点</button>
      <button type="button" class="wb-btn" data-clr>清空回归点</button>`;
    sec.append(bar);

    const pts = [];
    const regChart = wb.regressionChart(sec, {
      w: 520, h: 230, xLabel: '通过电量 Q (C)', yLabel: '阴极 H₂ 体积 V (mL)',
      xRange: [0, 180], yRange: [0, 24],
    });
    const diag = document.createElement('div');
    diag.className = 'wb-metrics';
    sec.append(diag);

    const refresh = () => {
      const reg = linearRegression(pts.map(([x, y]) => [x, y]));
      // slope k = Vm(24500 mL/mol) / (2 * F) -> F_fit = 24500 / (2 * k)
      const Ffit = reg && reg.k > 1e-6 ? 24500 / (2 * reg.k) : NaN;
      regChart.redraw({
        pts,
        xRange: [0, 180], yRange: [0, 24],
        theoryFn: (Q) => (Q / (2 * 96485)) * 24500,
      });
      const st = sp.inst?.getState?.() || { q: 0, nE: 0, vH2: 0, vAn: 0 };
      diag.innerHTML = `
        <div class="wb-m"><span>实时电量 Q / n(e⁻)</span><b>${st.q.toFixed(1)} C (${(st.nE * 1000).toFixed(2)} mmol)</b></div>
        <div class="wb-m"><span>回归求得法拉第常数 F</span><b>${Number.isFinite(Ffit) ? `${Ffit.toFixed(0)} C/mol` : '需 ≥ 2 个采样点'}</b></div>
        <div class="wb-m"><span>理论参考值</span><b>96485 C/mol (25°C Vm=24.5 L/mol)</b></div>`;
    };

    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if ('cap' in btn.dataset) {
        const st = sp.inst?.getState?.();
        if (st && st.q > 0.5) {
          pts.push([st.q, st.vH2, 'human']);
          const row = sp.inst?.getSample?.(sp.params);
          if (row) wb.record(row);
        }
      } else if ('clr' in btn.dataset) {
        pts.length = 0;
      }
      refresh();
    });

    refresh();
    return { update() { refresh(); } };
  },
};

// ================================================================ 12. 乙酸乙酯的制备、防倒吸与同位素示踪 (L3)
export const ethylAcetate = {
  id: 'chem-ethyl-acetate',
  subject: 'chem',
  title: '乙酸乙酯的制备、防倒吸与 ¹⁸O 断键示踪',
  en: 'Ethyl acetate esterification, anti-suckback & ¹⁸O tracing',
  lede: [
    '将乙醇、冰乙酸与浓硫酸混合共热发生可逆酯化反应，生成的乙酸乙酯蒸气经长导管导出，由盛有饱和 Na₂CO₃ 溶液的试管接收并在液面聚集油状芳香液体。',
    '为什么长导管口绝不能插入饱和 Na₂CO₃ 液面以下？用开关对比“液面上方防倒吸”与“插入液面撤火冷却倒吸”危险工况，并在工作台用 ¹⁸O 示踪验证“酸脱羟基、醇脱氢”。',
  ],
  formula: 'CH₃COOH + H¹⁸OC₂H₅ ⇌ CH₃CO¹⁸OC₂H₅ + H₂O (浓H₂SO₄, Δ)',
  formulaNote: '浓硫酸作催化剂与吸水剂；饱和 Na₂CO₃ 溶液兼具中和乙酸、溶解乙醇、降低乙酸乙酯溶解度三重作用',
  terms: [
    ['酸脱羟基、醇脱氢', '用 CH₃CH₂¹⁸OH 示踪表明 ¹⁸O 全部进入酯分子 CH₃CO¹⁸OC₂H₅ 中，水分子含 ¹⁶O'],
    ['防倒吸原理', '长导管不仅冷凝回流，且末端悬停在饱和 Na₂CO₃ 液面上方，防止冷却降压时碱液倒灌炸裂热试管'],
    ['饱和 Na₂CO₃ 三作用', '① 与挥发乙酸反应除杂；② 溶解混出的乙醇；③ 盐析降低乙酸乙酯在水中溶解度利于分层'],
  ],
  predict: {
    q: '在 CH₃COOH 与 CH₃CH₂¹⁸OH 的酯化反应中，¹⁸O 同位素最终会出现在哪种产物里？',
    options: ['全部进入 H₂O 中', '进入乙酸乙酯 CH₃CO¹⁸OC₂H₅ 中', '平均分配在酯和水中'],
    answer: 1,
    why: '羧酸分子脱去羟基（—OH），醇分子脱去羟基上的氢原子（—H），二者结合成 H₂O；因此醇上的 ¹⁸O 保留在酰氧基氧桥中进入乙酸乙酯，水中的氧来自羧酸的 —OH。',
  },
  challenge: '先在“液面上方”加热制取乙酸乙酯油层；再把导管切换为“插入液面下”并按“撤火冷却检验倒吸”，观察液柱倒灌报警！最后在工作台对照 ¹⁸O 示踪机理。',
  fig: '铁架台倾斜反应管、酒精灯、长导气管与饱和 Na₂CO₃ 接收管',
  hint: '开启加热开始酯化收集；切换“导管位置”并与“撤火冷却”配合安全模拟防倒吸必要性；工作台可直观演示 ¹⁸O 断键历程。',
  teach: {
    where: '人教版化学必修第二册第七章 §7.3《乙醇与乙酸（酯化反应）》（高中有机核心实验）',
    ask: [
      '试剂混合顺序为何必须是“先加乙醇，再边摇边慢加浓硫酸，冷却后再加乙酸”？',
      '右侧接收试管中饱和 Na₂CO₃ 溶液能否换成 NaOH 溶液？为什么？',
    ],
    simplify: '倒吸液柱动态按内外压差 Δp 示意上升；油状酯层厚度随反应推进增厚并与 Na₂CO₃ 碱性酚酞层清晰分层。',
    safety: '浓硫酸稀释剧烈放热切忌将乙醇倒入浓硫酸中；反应试管必须加碎瓷片防暴沸，导管口须位于饱和 Na₂CO₃ 液面上方。',
  },
  controls: [
    { id: 'heat', type: 'toggle', label: '酒精灯加热', value: true },
    { id: 'submerge', type: 'choice', label: '导管末端位置', options: ['液面上方 (防倒吸安全)', '插入液面下 (倒吸危险)'], value: 0 },
    { id: 'iso', type: 'toggle', label: '¹⁸O 示踪 (CH₃CH₂¹⁸OH)', value: true },
    { id: 'coolTest', type: 'button', label: '撤火冷却检验倒吸' },
    { id: 'resetEA', type: 'button', label: '重置装置' },
  ],
  record: {
    note: '记录当前导管布置、加热状态、收集酯层厚度及是否发生倒吸险情。',
    pending: '运行酯化反应或完成一次防倒吸/倒吸检验后记入实验册。',
    columns: [
      { key: 'tubePos', label: '导管位置' },
      { key: 'heatStr', label: '热源状态' },
      { key: 'esterMl', label: '酯层收集量', unit: 'mL', digits: 2, stat: true },
      { key: 'suckStr', label: '倒吸状况' },
      { key: 'isoLoc', label: '¹⁸O 去向' },
    ],
    sample: (inst, p) => inst.getSample?.(p),
    summary: (rows) => [
      ['已录入实验工况', `${rows.length} 次`],
      ['最大酯层收集', rows.length ? `${Math.max(...rows.map((r) => r.esterMl)).toFixed(2)} mL` : '—'],
    ],
    errors: [
      '把饱和 Na₂CO₃ 误换成强碱 NaOH 溶液，会导致生成的乙酸乙酯发生不可逆碱性水解。',
      '导管插到液面以下后撤火或加热不均，造成管内降压引发碱液倒吸炸裂热试管。',
    ],
  },

  build(k) {
    const p = k.p, Z = -0.6;
    const standLeft = at(retort(5.2, { w: 2.6, d: 1.8 }), -2.3, 0, Z);
    standLeft.boss(2.8);
    k.root.add(standLeft);

    // 倾斜反应试管 + 酒精灯
    const rxnGroup = new THREE.Group();
    rxnGroup.position.set(-1.6, 2.35, Z);
    rxnGroup.rotation.z = -0.95;
    const rxnTube = makeTestTube(0.32, 2.55, '#f2ecd8', 0.65);
    rxnTube.fill(1.1);
    const boilBub = bubbler(12, { x: 0, z: 0, rad: 0.16, y0: 0.25, r: 0.04, speed: 1.4 });
    rxnGroup.add(rxnTube, boilBub);
    k.root.add(rxnGroup);

    const lampBase = at(group(cyl(0.55, 0.45, '#e8eef2'), cyl(0.14, 0.65, STEEL)), -2.15, 0, Z);
    const flameCone = at(flat(new THREE.ConeGeometry(0.22, 0.72, 18).translate(0, 0.36, 0), C.amber, { opacity: 0.85 }), -2.15, 0.65, Z);
    const flameGlow = at(glow(C.amber, 2.2, 0.45), -2.15, 1.0, Z);
    k.root.add(lampBase, flameCone, flameGlow);

    // 右侧饱和 Na2CO3 收集试管
    const colTube = at(makeTestTube(0.42, 2.65, '#f7c5dc', 0.55), 1.8, 0.15, Z);
    colTube.fill(1.4);
    const esterLayer = at(liquid(0.39, 0.02, '#f5de7a', 0.85), 1.8, 1.55, Z);
    esterLayer.visible = false;
    const isoDots = dots(8, 0.045, '#e5483f', { flat: true });
    k.root.add(colTube, esterLayer, isoDots, at(note('饱和 Na₂CO₃ (含酚酞)', { size: 0.24 }), 1.8, 3.05, Z));

    // 长导气管（上段固定 + 末端高度随 submerge 变化） + 倒吸液柱指示带
    const tubeAbove = tube([[-0.45, 3.05, Z], [0.55, 3.55, Z], [1.8, 3.25, Z], [1.8, 1.82, Z]], 0.045, '#e6f2fa');
    const tubeSub = tube([[-0.45, 3.05, Z], [0.55, 3.55, Z], [1.8, 3.25, Z], [1.8, 0.95, Z]], 0.045, '#e6f2fa');
    const suckCol = at(liquid(0.036, 0.01, '#f7c5dc', 0.92), 1.8, 0.95, Z);
    suckCol.visible = false;
    const info = at(card('\n\n', { w: 5.5, size: 0.25, align: 'left' }), 0.2, 0, 2.55);
    k.root.add(tubeAbove, tubeSub, suckCol, info);

    let esterMl = 0, suckLevel = 0, warnSuck = false;

    return {
      getState: () => ({ esterMl, suckLevel, warnSuck }),
      getSample(par) {
        return {
          _kind: 'human',
          tubePos: (par.submerge ?? 0) === 0 ? '液面上方(安全)' : '插入液面下(危险)',
          heatStr: par.heat ? '加热反应中' : '撤火冷却',
          esterMl,
          suckStr: warnSuck ? '⚠ 发生液体倒吸！' : '安全无倒吸',
          isoLoc: par.iso ? 'CH₃CO¹⁸OC₂H₅ (酯)' : '未开启示踪',
        };
      },
      press(id) {
        if (id === 'coolTest') {
          k.set('heat', false);
        } else if (id === 'resetEA') {
          esterMl = 0; suckLevel = 0; warnSuck = false;
          k.set('heat', true);
        }
        k.dirty();
      },
      update(dt, t) {
        const heating = Boolean(p.heat);
        const sub = (p.submerge ?? 0) === 1;
        flameCone.visible = flameGlow.visible = heating;
        if (heating) {
          flameCone.scale.set(1 + Math.sin(t * 11) * 0.08, 1 + Math.cos(t * 9) * 0.1, 1);
          esterMl = Math.min(3.5, esterMl + dt * 0.22);
          suckLevel = Math.max(0, suckLevel - dt * 0.9);
          if (suckLevel < 0.05) warnSuck = false;
        } else if (sub) {
          suckLevel = Math.min(2.25, suckLevel + dt * 0.85);
          if (suckLevel > 0.35) warnSuck = true;
        } else {
          suckLevel = Math.max(0, suckLevel - dt * 1.2);
          warnSuck = false;
        }

        boilBub.step(dt, heating ? 9 : 0, 1.05);
        tubeAbove.visible = !sub;
        tubeSub.visible = sub;
        suckCol.visible = sub && suckLevel > 0.04;
        if (suckCol.visible) suckCol.set(suckLevel);

        const hEster = clamp(esterMl * 0.12, 0, 0.42);
        esterLayer.visible = hEster > 0.015;
        if (esterLayer.visible) {
          esterLayer.position.y = 1.55;
          esterLayer.set(hEster, '#f5de7a');
        }
        for (let i = 0; i < 8; i++) {
          if (p.iso && esterLayer.visible) {
            const ang = (i / 8) * TAU + t * 0.6;
            isoDots.put(i, 1.8 + Math.cos(ang) * 0.22, 1.56 + hEster * 0.5, Z + Math.sin(ang) * 0.22, 1);
          } else {
            isoDots.put(i, 0, -50, 0, 0.001);
          }
        }
        isoDots.done();

        info.set(warnSuck
          ? '⚠ 警告：发生倒吸！撤火冷却导致管内气压低于大气压，Na₂CO₃ 液柱正沿 submerged 导管倒灌！\n请立即将导管移至液面上方或恢复加热！'
          : `${heating ? '正在共热酯化' : '热源已撤除'} · 导管${sub ? '插于液面下 (有倒吸隐患)' : '位于液面上方 (防倒吸安全)'}\n乙酸乙酯浮层 ≈ ${esterMl.toFixed(2)} mL${p.iso ? ' · 红色示踪粒子(¹⁸O)富集于上层酯分子中' : ''}`);
      },
      margin() {
        return [
          '酯化：酸脱羟基、醇脱氢',
          p.iso ? '¹⁸O 富集于乙酸乙酯' : '未启用 ¹⁸O 示踪',
          `酯收集量：${esterMl.toFixed(2)} mL`,
          warnSuck ? '⚠ 状态：倒吸发生！' : '状态：防倒吸安全',
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · ¹⁸O 同位素断键示踪机理对比（酸脱羟基 vs 醇脱氢）');
    let mechMode = 0; // 0: 正确(酸脱-OH), 1: 错误假设(醇脱-OH)
    const row = document.createElement('div');
    row.className = 'wb-btn-row';
    row.innerHTML = `
      <button type="button" class="wb-btn primary" data-m="0">正确机理：酸脱羟基 · 醇脱氢</button>
      <button type="button" class="wb-btn" data-m="1">对照假设：醇脱羟基 · 酸脱氢 (质谱否定)</button>`;
    sec1.append(row);

    const cv = wb.canvas(sec1, 520, 215, (x, W, H) => {
      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#1e2b36'; x.font = 'bold 13px Georgia,serif';
      x.fillText('CH₃—C(=O)—OH   +   H—¹⁸O—C₂H₅   ⇌   产物与质谱同位素检测', 20, 32);

      // 绘制断键虚线框
      x.strokeStyle = '#e5483f'; x.lineWidth = 2; x.setLineDash([5, 3]);
      if (mechMode === 0) {
        // 酸脱 -OH, 醇脱 H
        x.strokeRect(102, 48, 34, 28); // -OH of acid
        x.strokeRect(184, 48, 22, 28); // H- of alcohol
      } else {
        x.strokeRect(118, 48, 18, 28); // H of acid
        x.strokeRect(184, 48, 48, 28); // H-18O of alcohol
      }
      x.setLineDash([]);

      x.font = 'bold 14px Georgia,serif'; x.fillStyle = '#1e2b36';
      x.fillText('CH₃CO', 45, 67);
      x.fillStyle = mechMode === 0 ? '#e5483f' : '#1e2b36';
      x.fillText('OH', 107, 67);
      x.fillStyle = '#1e2b36';
      x.fillText('+', 156, 67);
      x.fillStyle = mechMode === 0 ? '#e5483f' : '#1e2b36';
      x.fillText('H', 188, 67);
      x.fillStyle = mechMode === 1 ? '#e5483f' : '#b4653a';
      x.fillText('¹⁸O', 203, 67);
      x.fillStyle = '#1e2b36';
      x.fillText('C₂H₅', 232, 67);

      x.fillStyle = '#1f4a3e'; x.font = 'bold 14px Georgia,serif';
      if (mechMode === 0) {
        x.fillText('⟶   CH₃CO¹⁸OC₂H₅ (质谱 M=90, 含 ¹⁸O)   +   H₂O (M=18)', 45, 118);
        x.fillStyle = '#1f4a3e'; x.font = '12.5px "Songti SC",serif';
        x.fillText('✓ 实验实测证实：¹⁸O 100% 留在乙酸乙酯中，水分子不带 ¹⁸O → 酸脱羟基、醇脱氢！', 20, 158);
      } else {
        x.fillStyle = '#b43e2e';
        x.fillText('⟶   CH₃COOC₂H₅ (M=88)   +   H₂¹⁸O (假想 M=20)', 45, 118);
        x.font = '12.5px "Songti SC",serif';
        x.fillText('✗ 与质谱检测矛盾：实验中生成的水不含 ¹⁸O，故该假设不成立。', 20, 158);
      }

      const st = sp.inst?.getState?.() || { esterMl: 0, warnSuck: false };
      x.fillStyle = st.warnSuck ? '#c63d2f' : '#51606b';
      x.font = '12px "Songti SC",serif';
      x.fillText(`饱和 Na₂CO₃ 液面监控：${st.warnSuck ? '⚠ 检测到导管插液倒吸！' : `安全（当前酯层 ${st.esterMl.toFixed(2)} mL）`}`, 20, 192);
    });

    row.addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]');
      if (!b) return;
      mechMode = +b.dataset.m;
      row.querySelectorAll('[data-m]').forEach((kBtn) => kBtn.classList.toggle('primary', kBtn === b));
      cv.redraw();
    });
    cv.redraw();
    return { update() { cv.redraw(); } };
  },
};

export default [
  molarity,
  feRedox,
  crudeSalt,
  periodic,
  flame,
  rate,
  cell,
  equilibrium,
  titration,
  hydrolysis,
  electrolysis,
  ethylAcetate,
];
