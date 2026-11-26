// HAIZ · EXPERIMENTARIUM — 力学与机械运动实验包（9项课标必做与L4探究实验）
import {
  C, TAU, clamp, lerp, group, at, rot, box, cyl, ball, cone, torus, plate,
  rod, wire, spring, arrow, strip, dash, flat, solid, glass, note, card,
  plot, dots, sheet, dimension, stand, sig, THREE,
} from '../core/ink.js';
import { Timeline } from '../core/timeline.js';
import { recorder } from '../core/tape.js';
import { scrubbable } from '../core/scrub.js';
import { KIND, periodFactor, DEG, rng, gauss, linearRegression, sampleStats } from '../core/epistemic.js';
import { stepPendulumRK4 } from '../core/science-models.js';

const STEEL = '#cfd6dc';
const BRASS = '#d9b36a';
const G = 9.8;

/** 通用 3D 圆柱/杆跨距工具 */
const _Y = new THREE.Vector3(0, 1, 0);
const _dv = new THREE.Vector3();
function spanMesh(m, a, b) {
  _dv.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = Math.max(1e-4, _dv.length());
  m.position.set(a[0], a[1], a[2]);
  m.scale.set(1, len, 1);
  m.quaternion.setFromUnitVectors(_Y, _dv.divideScalar(len));
}

// ================================================================ 1. 打点计时器测瞬时速度 (L3)
export const tickerVelocity = {
  id: 'phy-ticker-velocity',
  subject: 'phy',
  title: '测量做直线运动物体的瞬时速度',
  en: 'Instantaneous velocity with a ticker timer',
  lede: [
    '50 Hz 交流电源驱动振针每 0.02 s 在纸带上打下一个墨点。小车牵引纸带驶过长木板，点距由密变疏（或由疏变密）就把速度变化印在纸面上。',
    '每 5 个打点间隔取一个计数点（T_count = 0.10 s），用中心差分 vₙ = (xₙ₊₁ − xₙ₋₁) / (2T_count) 逼近瞬时速度，可直接拖动小车复拉或释放。',
  ],
  formula: 'T = 1/f = 0.02 s · vₙ ≈ (xₙ₊₁ − xₙ₋₁) / (2T_count)',
  formulaNote: '50 Hz 打点周期 T = 0.02 s；每 5 点取计数点则计数周期 T_count = 0.10 s',
  terms: [
    ['打点周期 T', '50 Hz 交流电每周期打 1 个点，相邻两墨点时间间隔 T = 0.02 s。'],
    ['计数点间隔', '每 5 个打印点取一个计数点，T_count = 5 × 0.02 s = 0.10 s。'],
    ['中心差分法', '以包含第 n 点的相邻两段平均速度 (xₙ₊₁−xₙ₋₁)/(2T_count) 近似 vₙ。'],
  ],
  predict: {
    q: '纸带上的点距从左到右越来越密（在计时器右侧拖着纸带向右拉动），说明小车正在做什么运动？',
    options: ['加速运动', '匀速运动', '减速运动'],
    answer: 2,
    why: '相邻两点时间间隔恒为 0.02 s，后面打出的点之间距离越来越小，说明相等时间内位移在减小，物体正在做减速运动。',
  },
  challenge: '开启刻度尺 ±0.5 mm 估读误差并运行匀加速模式，在工作台拟合 v–t 斜率求加速度，对比小车真实加速度误差小于 5%！',
  fig: '50 Hz 电磁打点计时器、刻度尺、纸带与牵引小车轨道',
  hint: '直接左右拖动小车复位并松手释放，或按“释放小车打点”；打开工作台点击任意计数点读数并拟合 v–t 图线。',
  teach: {
    where: '人教版物理必修第一册第一章 §1.4《实验：用打点计时器测量速度》（学生必做实验 1）',
    ask: [
      '为什么通常舍去开头过于密集的点，再从清晰处开始每 5 个间隔取一个计数点？',
      '为什么用 (xₙ₊₁ − xₙ₋₁)/(2T_count) 比用 (xₙ₊₁ − xₙ)/T_count 更能减小测 vₙ 的系统偏离？',
    ],
    simplify: '设 50 Hz 电源频率严格稳定（T = 0.02 s），变加速模式采用 a(t) = a₀(0.65 + 0.55 sin 2.5t)；开启估读误差时每个计数点坐标叠加 ±0.5 mm（0.0005 m）均匀截断/读数抖动。',
    safety: '电磁打点计时器使用 8 V 低压交流电源，电火花计时器使用 220 V 交流电源；实验完毕应及时切断电源以防线圈过热。',
  },
  controls: [
    { id: 'motion', label: '运动模式', type: 'choice', options: ['匀加速直线', '滑行减速', '变加速冲击'], value: 0 },
    { id: 'aSet', label: '驱动加速度 a₀', min: 0.4, max: 2.4, step: 0.1, value: 1.2, unit: 'm/s²' },
    { id: 'v0', label: '初速度 v₀', min: 0.0, max: 1.2, step: 0.1, value: 0.3, unit: 'm/s' },
    { id: 'jitter', label: '刻度尺 ±0.5 mm 误差', type: 'toggle', value: true },
    { id: 'drag', label: '限位孔摩擦阻力', type: 'toggle', value: false },
    { id: 'releaseBtn', label: '释放小车打点', type: 'button' },
    { id: 'resetBtn', label: '复位纸带', type: 'button' },
  ],
  record: {
    note: '记录各计数点位置 xₙ、位移差及中心差分瞬时速度 vₙ，检验匀变速运动中 Δv/Δt 是否为恒量。',
    pending: '点击“释放小车打点”或直接拖放小车完成一次打点后即可采样记录。',
    columns: [
      { key: 'modeName', label: '运动模式' },
      { key: 'n', label: '计数点 n', digits: 0 },
      { key: 't', label: '时刻 t', unit: 's', digits: 2 },
      { key: 'xCm', label: '位置 xₙ', unit: 'cm', digits: 2 },
      { key: 'v', label: '测算 vₙ', unit: 'm/s', digits: 3, stat: true },
      { key: 'vTrue', label: '真值 v(t)', unit: 'm/s', digits: 3 },
    ],
    sample: (inst) => inst.latestSample?.() || null,
    summary: (rows) => {
      const pts = rows.filter((r) => Number.isFinite(r.t) && Number.isFinite(r.v)).map((r) => [r.t, r.v]);
      const reg = linearRegression(pts);
      return [
        ['已采计数点数', `${rows.length} 个`],
        ['v–t 线性回归加速度', reg ? `${reg.k.toFixed(3)} m/s² (R²=${reg.r2.toFixed(4)})` : '需 ≥2 个计数点'],
      ];
    },
    errors: [
      '刻度尺最小分度 1 mm，估读存在 ±0.5 mm 随机误差；若逐段独立量 Δx 会累积误差，应从 O 点一次性读取各计数点坐标 xₙ。',
      '振针与限位孔对纸带的周期性摩擦使实际加速度略小于无阻尼理论值。',
    ],
  },

  build(k) {
    const p = k.p;
    const rand = rng(5002);
    const TRACK_X0 = -3.4, TRACK_X1 = 3.4, TOP = 0.24, Z = -0.35, S = 3.6; // 1 m -> 3.6 world units (track ~1.88 m)
    const MAX_X_M = 1.55;
    k.root.add(
      at(box(7.2, 0.24, 1.65, C.wood), 0, 0, Z),
      at(box(6.9, 0.04, 0.9, '#f1ebe0'), 0, 0.24, Z),
      // 刻度尺（沿纸带旁）
      at(box(6.2, 0.03, 0.28, '#e8edf0', { kind: 'metal' }), 0.25, 0.26, Z + 0.45),
    );
    for (let i = 0; i <= 15; i++) {
      const rx = TRACK_X0 + 0.65 + (i * 0.1) * S;
      if (rx < TRACK_X1 - 0.1) {
        k.root.add(
          wire([rx, 0.295, Z + 0.32], [rx, 0.295, Z + 0.46], 0.012),
          at(note(`${i * 10}`, { size: 0.17, lay: 'flat' }), rx, 0.295, Z + 0.56),
        );
      }
    }
    // 50 Hz 打点计时器主机 + 振针
    const timer = group(
      at(box(0.75, 0.52, 0.72, '#414c56'), -3.1, TOP, Z),
      at(box(0.24, 0.26, 0.44, BRASS, { kind: 'metal' }), -2.65, TOP + 0.16, Z),
      at(note('50 Hz', { size: 0.20, color: '#fffdf7' }), -3.1, TOP + 0.28, Z + 0.38),
    );
    const striker = at(cyl(0.024, 0.22, C.copper, { seg: 10 }), -2.65, TOP + 0.22, Z);
    // 纸带 + 小车
    const tapeStrip = at(box(1, 0.014, 0.22, '#fffdf7'), -2.65, TOP + 0.03, Z);
    const dotPool = dots(140, 0.022, C.ink, { flat: true });
    const countPool = dots(24, 0.042, C.copper, { flat: true });
    const cart = group(
      at(box(0.88, 0.34, 0.62, '#eef2f5'), 0, 0.12, 0),
      at(box(0.18, 0.14, 0.26, BRASS, { kind: 'metal' }), -0.38, 0.46, 0),
      at(note('拖我释放', { size: 0.19 }), 0, 0.54, 0),
    );
    for (const wx of [-0.28, 0.28]) {
      for (const wz of [-0.34, 0.34]) {
        cart.add(rot(at(cyl(0.11, 0.08, C.ink, { seg: 16 }), wx, 0.11, wz), Math.PI / 2, 0, 0));
      }
    }
    const vArrow = arrow(C.leaf, 0.04);
    const info = at(card('\n\n', { w: 4.1, size: 0.26, align: 'left' }), 1.55, 0.02, 2.05);
    k.root.add(timer, striker, tapeStrip, dotPool, countPool, cart, vArrow, info);

    let running = false, t = 0, x = 0, v = 0, nextDotT = 0, cartStartX = 0.05;
    const rawDots = [];   // { t, xTrue }
    const countPts = [];  // { n, t, xTrue, xRead, vTrue }

    const accelAt = (tt) => {
      const fLoss = p.drag ? 0.12 : 0;
      if (p.motion === 0) return Math.max(0.05, p.aSet - fLoss);
      if (p.motion === 1) return -0.45 - (p.drag ? 0.14 : 0);
      return p.aSet * (0.65 + 0.55 * Math.sin(2.5 * tt)) - fLoss;
    };
    const initVel = () => (p.motion === 1 ? Math.max(1.0, p.v0 + 0.85) : p.v0);

    const clearDots = () => {
      rawDots.length = 0;
      countPts.length = 0;
      for (let i = 0; i < 140; i++) dotPool.put(i, 0, -50, 0, 0.001);
      for (let i = 0; i < 24; i++) countPool.put(i, 0, -50, 0, 0.001);
      dotPool.done(); countPool.done();
    };

    const recordDot = (td, xd, vd) => {
      const idx = rawDots.length;
      if (idx >= 140) return;
      rawDots.push({ t: td, xTrue: xd, vTrue: vd });
      if (idx % 5 === 0 && countPts.length < 24) {
        const jit = p.jitter ? (rand() - 0.5) * 0.001 : 0; // ±0.5 mm
        const xRead = Math.max(0, xd + jit);
        countPts.push({ n: countPts.length, t: td, xTrue: xd, xRead, vTrue: vd });
      }
    };

    const resetRun = (startRun = false, customX = 0) => {
      running = startRun;
      t = 0;
      x = customX;
      v = initVel();
      nextDotT = 0;
      clearDots();
      if (startRun) recordDot(0, x, v);
      nextDotT = 0.02;
    };

    // 预生成一组初始演示打点，确保首帧即有真实点痕可读
    const prefillRun = () => {
      resetRun(true, 0);
      while (running && t < 1.1 && x < MAX_X_M && rawDots.length < 130) {
        stepSim(0.005);
      }
      running = false;
    };

    const stepSim = (dt) => {
      const sub = Math.max(1, Math.ceil(dt / 0.002));
      const h = dt / sub;
      for (let i = 0; i < sub; i++) {
        if (!running) break;
        const a = accelAt(t);
        const vNext = v + a * h;
        if (p.motion === 1 && vNext <= 0.02) { v = 0; running = false; break; }
        x += 0.5 * (v + vNext) * h;
        v = vNext;
        t += h;
        while (t + 1e-6 >= nextDotT && x <= MAX_X_M) {
          recordDot(nextDotT, x, v);
          nextDotT += 0.02;
        }
        if (x >= MAX_X_M) { x = MAX_X_M; running = false; break; }
      }
    };

    const getComputedPoints = () => countPts.map((pt, i) => {
      const prev = countPts[i - 1], next = countPts[i + 1];
      const vEst = prev && next ? (next.xRead - prev.xRead) / (next.t - prev.t) : NaN;
      return { ...pt, vEst };
    });

    // 拖拽小车直接定位与放手触发打点
    let dragX0 = null, startM = 0;
    k.drag(cart, {
      normal: 'z',
      start: () => { dragX0 = null; startM = x; running = false; },
      move: (q) => {
        if (dragX0 === null) { dragX0 = q.x; return; }
        x = clamp(startM + (q.x - dragX0) / S, 0, MAX_X_M);
        k.dirty();
      },
      end: () => {
        dragX0 = null;
        cartStartX = x < 0.25 ? x : 0;
        resetRun(true, cartStartX);
        k.dirty();
      },
    });

    prefillRun();

    const drawVisuals = () => {
      const xStartWorld = -2.65;
      const cartX = xStartWorld + x * S + 0.44;
      cart.position.set(cartX, TOP, Z);
      const tapeLen = Math.max(0.25, cartX - 0.35 - xStartWorld);
      tapeStrip.scale.x = tapeLen;
      tapeStrip.position.set(xStartWorld + tapeLen * 0.5, TOP + 0.032, Z);
      striker.position.y = TOP + 0.18 + (running ? Math.sin(t * TAU * 50) * 0.045 : 0);

      // 将纸带上的历史点映射到当前纸带位置（点随纸带向右拉出，位于计时器右侧）
      for (let i = 0; i < 140; i++) {
        if (i < rawDots.length) {
          const px = xStartWorld + (x - rawDots[i].xTrue) * S;
          if (px >= xStartWorld && px <= cartX - 0.35) dotPool.put(i, px, TOP + 0.046, Z);
          else dotPool.put(i, 0, -50, 0, 0.001);
        } else dotPool.put(i, 0, -50, 0, 0.001);
      }
      for (let i = 0; i < 24; i++) {
        if (i < countPts.length) {
          const px = xStartWorld + (x - countPts[i].xTrue) * S;
          if (px >= xStartWorld && px <= cartX - 0.35) countPool.put(i, px, TOP + 0.049, Z);
          else countPool.put(i, 0, -50, 0, 0.001);
        } else countPool.put(i, 0, -50, 0, 0.001);
      }
      dotPool.done(); countPool.done();

      if (v > 0.05 && running) {
        vArrow.set([cartX, TOP + 0.65, Z], [cartX + clamp(v * 0.65, 0.25, 1.5), TOP + 0.65, Z]);
      } else vArrow.visible = false;

      const pts = getComputedPoints().filter((q) => Number.isFinite(q.vEst));
      const last = pts[pts.length - 1];
      info.set(
        `50 Hz 打点 ${rawDots.length} 点 · 计数点 ${countPts.length} 个\n`
        + `位移 x = ${(x * 100).toFixed(1)} cm · t = ${t.toFixed(2)} s\n`
        + (last ? `最近计数点 n=${last.n}: v = ${last.vEst.toFixed(3)} m/s` : '拖放或点击“释放小车打点”采集计数点'),
      );
    };

    drawVisuals();
    return {
      getPoints: getComputedPoints,
      latestSample() {
        const pts = getComputedPoints().filter((q) => Number.isFinite(q.vEst));
        if (!pts.length) return null;
        const q = pts[pts.length - 1];
        return {
          _kind: p.jitter ? 'simulated' : 'model',
          modeName: ['匀加速', '滑行减速', '变加速'][p.motion ?? 0],
          n: q.n, t: q.t, xCm: q.xRead * 100, v: q.vEst, vTrue: q.vTrue,
        };
      },
      press(id) {
        if (id === 'releaseBtn') { resetRun(true, 0); drawVisuals(); k.dirty(); }
        else if (id === 'resetBtn') { resetRun(false, 0); drawVisuals(); k.dirty(); }
      },
      change() { prefillRun(); drawVisuals(); k.dirty(); },
      update(dt) {
        if (running && dt > 0) { stepSim(dt * 0.7); k.dirty(); }
        drawVisuals();
      },
      margin() {
        const pts = getComputedPoints().filter((q) => Number.isFinite(q.vEst));
        const reg = linearRegression(pts.map((q) => [q.t, q.vEst]));
        const last = pts[pts.length - 1];
        return [
          'T = 0.02 s · T_count = 0.10 s',
          `已采计数点: ${countPts.length}`,
          last ? `v_${last.n} = ${last.vEst.toFixed(3)} m/s` : '待采集中心差分速度',
          reg ? `拟合 a = ${reg.k.toFixed(3)} m/s²` : '',
          p.jitter ? '含 ±0.5 mm 刻度估读抖动' : '理想无读数误差',
        ].filter(Boolean);
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 纸带计数点测量与中心差分瞬时速度检验');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn primary" data-wb="run">重新释放打点</button>
      <button type="button" class="wb-btn" data-wb="logAll">采录全部计数点入实验册</button>
      <button type="button" class="wb-btn" data-wb="clear">清空参考</button>`;
    sec1.append(bar);

    let selN = 2;
    const tapeCv = wb.canvas(sec1, 520, 145, (x, W, H) => {
      const pts = sp.inst?.getPoints?.() || [];
      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      // 纸带白条
      x.fillStyle = '#f8f2e4'; x.strokeStyle = C.ink; x.lineWidth = 1.4;
      x.fillRect(20, 28, W - 40, 44); x.strokeRect(20, 28, W - 40, 44);
      // 毫米刻度尺
      x.fillStyle = '#e7edf2'; x.fillRect(20, 74, W - 40, 22);
      const maxX = Math.max(0.8, ...pts.map((q) => q.xRead * 1.06));
      const sx = (xm) => 34 + (xm / maxX) * (W - 68);
      x.strokeStyle = '#51606b'; x.lineWidth = 1; x.fillStyle = '#51606b'; x.font = '10px Georgia,serif'; x.textAlign = 'center';
      for (let cm = 0; cm <= Math.floor(maxX * 100); cm += 10) {
        const px = sx(cm / 100);
        x.beginPath(); x.moveTo(px, 74); x.lineTo(px, 84); x.stroke();
        x.fillText(`${cm}`, px, 94);
      }
      pts.forEach((pt) => {
        const px = sx(pt.xRead);
        const isSel = pt.n === selN;
        x.fillStyle = isSel ? '#1f4a3e' : C.copper;
        x.beginPath(); x.arc(px, 50, isSel ? 5.5 : 3.8, 0, TAU); x.fill();
        x.fillStyle = C.ink; x.font = '11px Georgia,serif';
        x.fillText(`${pt.n}`, px, 22);
      });
      const cur = pts.find((q) => q.n === selN) || pts[Math.min(2, Math.max(0, pts.length - 2))];
      if (cur && Number.isFinite(cur.vEst)) {
        const prev = pts[cur.n - 1], next = pts[cur.n + 1];
        x.strokeStyle = '#1f4a3e'; x.lineWidth = 1.5; x.setLineDash([4, 3]);
        x.beginPath(); x.moveTo(sx(prev.xRead), 50); x.lineTo(sx(next.xRead), 50); x.stroke(); x.setLineDash([]);
        x.fillStyle = '#1e2b36'; x.textAlign = 'left'; x.font = '12px "Noto Serif SC",serif';
        x.fillText(`点击点号检验 n=${cur.n}: Δx = ${((next.xRead - prev.xRead) * 100).toFixed(2)} cm / 0.20 s → vₙ = ${cur.vEst.toFixed(3)} m/s (真值 ${cur.vTrue.toFixed(3)})`, 20, 126);
      } else {
        x.fillStyle = '#51606b'; x.textAlign = 'left'; x.font = '12px "Noto Serif SC",serif';
        x.fillText('请先释放小车打点或点击纸带计数点（需左右邻点均存在）', 20, 126);
      }
    });

    const sec2 = wb.section('2 · v–t 最小二乘直线拟合与加速度测定');
    const chart = wb.regressionChart(sec2, {
      w: 520, h: 225, xLabel: '时刻 t (s)', yLabel: '瞬时速度 v (m/s)', xRange: [0, 1.4], yRange: [0, 3.0],
    });
    const out = document.createElement('div');
    out.className = 'wb-metrics';
    sec2.append(out);

    const refresh = () => {
      tapeCv.redraw();
      const pts = (sp.inst?.getPoints?.() || []).filter((q) => Number.isFinite(q.vEst));
      const p = sp.params;
      const chartPts = pts.map((q) => [q.t, q.vEst, p.jitter ? 'simulated' : 'model']);
      const maxT = Math.max(1.0, ...pts.map((q) => q.t * 1.15));
      const maxV = Math.max(2.0, ...pts.map((q) => q.vEst * 1.25));
      const v0Init = p.motion === 1 ? Math.max(1.0, p.v0 + 0.85) : p.v0;
      const aNominal = p.motion === 0 ? p.aSet - (p.drag ? 0.12 : 0) : p.motion === 1 ? -0.45 - (p.drag ? 0.14 : 0) : null;
      chart.redraw({
        pts: chartPts,
        xRange: [0, maxT],
        yRange: [0, maxV],
        theoryFn: aNominal !== null ? (tt) => Math.max(0, v0Init + aNominal * tt) : null,
      });
      const reg = linearRegression(chartPts);
      const errPct = reg && aNominal ? ((reg.k - aNominal) / aNominal) * 100 : NaN;
      out.innerHTML = `
        <div class="wb-m"><span>拟合加速度 a_fit</span><b>${reg ? `${reg.k.toFixed(3)} m/s²` : '需 ≥2 有效计数点'}</b></div>
        <div class="wb-m"><span>拟合初速度 v₀</span><b>${reg ? `${reg.b.toFixed(3)} m/s` : '—'}</b></div>
        <div class="wb-m"><span>线性决定系数 R²</span><b>${reg ? reg.r2.toFixed(4) : '—'}</b></div>
        <div class="wb-m"><span>相对理论偏差</span><b>${Number.isFinite(errPct) ? `${errPct >= 0 ? '+' : ''}${errPct.toFixed(2)}%` : '变加速模式非线性'}</b></div>`;
    };

    tapeCv.cv.addEventListener('pointerdown', (e) => {
      const local = tapeCv.toLocal(e);
      const pts = sp.inst?.getPoints?.() || [];
      const maxX = Math.max(0.8, ...pts.map((q) => q.xRead * 1.06));
      const sx = (xm) => 34 + (xm / maxX) * (520 - 68);
      let best = selN, bd = 999;
      for (const q of pts) {
        if (q.n > 0 && q.n < pts.length - 1) {
          const d = Math.abs(sx(q.xRead) - local.x);
          if (d < bd) { bd = d; best = q.n; }
        }
      }
      if (bd < 28) { selN = best; refresh(); }
    });

    bar.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.wb;
      if (!act) return;
      if (act === 'run') wb.press('releaseBtn');
      else if (act === 'logAll') {
        const pts = (sp.inst?.getPoints?.() || []).filter((q) => Number.isFinite(q.vEst));
        const modeName = ['匀加速', '滑行减速', '变加速'][sp.params.motion ?? 0];
        pts.forEach((q) => wb.record({
          _kind: sp.params.jitter ? 'simulated' : 'model',
          modeName, n: q.n, t: q.t, xCm: q.xRead * 100, v: q.vEst, vTrue: q.vTrue,
        }));
      } else if (act === 'clear') wb.press('resetBtn');
      refresh();
    });

    refresh();
    return { update() { refresh(); } };
  },
};

// ================================================================ 2. 弹簧弹力与形变量的关系（含屈服限度）(L3)
export const hooke = {
  id: 'phy-hooke',
  subject: 'phy',
  title: '探究弹簧弹力与形变量的关系',
  en: "Hooke's law and elastic limit",
  lede: [
    '在弹簧下端逐个加挂 50 g 钩码，量出每次总长 L 与伸长量 x = L − L₀。弹性限度之内数据点排成过原点的直线，斜率就是劲度系数 k。',
    '继续挂到超载，弹簧将跨过弹性限度进入非线性屈服区——卸去钩码后也回不到原长了！可直接上下拽动挂钩感受劲度与塑性留痕。',
  ],
  formula: 'F = k(L − L₀) = kx · Eₚ = ½kx²',
  formulaNote: '线性区（F ≤ F_yield）斜率为劲度系数 k；F > F_yield 后进入屈服软化并产生不可逆塑性伸长',
  terms: [
    ['形变量 x', '弹簧现长 L 减去无载原长 L₀。'],
    ['劲度系数 k', '每伸长 1 m 所需拉力，单位 N/m，只由弹簧自身材质与几何决定。'],
    ['弹性限度', '弹簧维持线性可逆恢复的最大弹力 F_yield，超过即发生永久塑性形变。'],
  ],
  predict: {
    q: '在弹性限度内，把某根弹簧的拉力从 1.0 N 增至 2.0 N 时伸长量为 4.0 cm；若以总长 L 为横轴作 F–L 图像，该直线会经过原点吗？',
    options: ['会经过原点', '不过原点，横轴截距等于弹簧原长 L₀', '斜率会变成原来的一半'],
    answer: 1,
    why: '由 F = k(L − L₀) 可知，F = 0 时 L = L₀，因此 F–L 图像是一条不过原点的倾斜直线，横轴截距即为弹簧原长 L₀，斜率依然等于 k。',
  },
  challenge: '分别关闭与开启“计入自重”及“超弹性限度”，在工作台完成 0–4 钩码线性区 k 值标定（误差 < 2%），再加挂至屈服观察滞后塑性残余！',
  fig: '铁架台、刻度尺、弹簧、钩码组与实时 F–x / F–L 坐标图',
  hint: '增减钩码或直接拖拽挂钩下拉弹簧；切换“F–L”看横截距 L₀；过载屈服后可按“更换新弹簧”清零塑变。',
  teach: {
    where: '人教版物理必修第一册第三章 §3.2《实验：探究弹簧弹力与形变量的关系》（学生必做实验 2）',
    ask: [
      '用 F–L 图像求劲度系数时，横轴截距代表什么物理量？为什么先悬挂弹簧测原长会比平放测原长略大？',
      '当钩码拉力超过弹性限度后，卸回 0 个钩码时指针还能回到原位吗？在工作台 F–x 图上斜率发生了什么变化？',
    ],
    simplify: '设原长 L₀ = 12.0 cm，三根弹簧劲度 k = 15 / 25 / 45 N/m、弹性限度 F_yield = 2.2 / 3.2 / 4.4 N；每个钩码 50 g（0.49 N）；超限后叠加工艺软化与单调累积塑性伸长。',
    safety: '实验室挂钩码切勿超过弹簧标称弹性限度，防止弹簧永久拉直或弹射伤人。',
  },
  controls: [
    { id: 'n', label: '钩码个数 (50g/个)', min: 0, max: 10, step: 1, value: 2, unit: '个' },
    { id: 'kChoice', label: '弹簧规格', type: 'choice', options: ['软 15 N/m', '中 25 N/m', '硬 45 N/m'], value: 1 },
    { id: 'selfWeight', label: '计入弹簧自重偏移', type: 'toggle', value: false },
    { id: 'yieldOn', label: '开启超弹性限度屈服', type: 'toggle', value: true },
    { id: 'plotMode', label: '图线横轴', type: 'choice', options: ['F–x (伸长量)', 'F–L (总长)'], value: 0 },
    { id: 'logBtn', label: '记录当前载荷', type: 'button' },
    { id: 'resetSpring', label: '更换新弹簧', type: 'button' },
  ],
  record: {
    note: '记下每次钩码数、弹力 F、弹簧总长 L 与伸长量 x；在工作台用弹性区点做线性拟合求 k。',
    pending: '挂好钩码稳定后按“记录当前载荷”或“记录一组”。',
    columns: [
      { key: 'spec', label: '弹簧' },
      { key: 'n', label: '钩码', digits: 0 },
      { key: 'F', label: '弹力 F', unit: 'N', digits: 3 },
      { key: 'LCm', label: '总长 L', unit: 'cm', digits: 2 },
      { key: 'xCm', label: '形变量 x', unit: 'cm', digits: 2 },
      { key: 'kEff', label: 'F/x', unit: 'N/m', digits: 2, stat: true },
      { key: 'regime', label: '状态' },
    ],
    sample: (inst) => inst.snapshotRow?.() || null,
    summary: (rows) => {
      const elastic = rows.filter((r) => r.regime === '弹性区' && Number.isFinite(r.xCm) && r.xCm > 0);
      const reg = linearRegression(elastic.map((r) => [r.xCm / 100, r.F]));
      return [
        ['已采集载荷点', `${rows.length} 组`],
        ['弹性区线性拟合 k', reg ? `${reg.k.toFixed(2)} N/m (R²=${reg.r2.toFixed(4)})` : '需 ≥2 弹性区点'],
      ];
    },
    errors: [
      '弹簧自身重力会使竖直悬挂时的零载原长比水平测得长约 0.5–1.0 cm，使 F–x 图线不过原点而出现横截距。',
      '超过弹性限度后弹簧发生不可逆塑性延伸，k_eff 显著下降且卸载不能复原。',
    ],
  },

  build(k) {
    const p = k.p;
    const KS = [15, 25, 45], FY = [2.2, 3.2, 4.4], L0_M = 0.12;
    const TOPY = 5.8, U = 10.5, X = -1.3, Z = -0.9;
    k.root.add(at(stand(6.3, 2.3), X - 1.25, 0, Z));
    k.root.add(at(box(0.32, 5.2, 0.08, '#eef2f4'), X + 1.05, 0.65, Z - 0.2));
    for (let i = 0; i <= 18; i++) {
      const yy = TOPY - L0_M * U - i * 0.025 * U;
      if (yy > 0.7) {
        k.root.add(wire([X + 0.88, yy, Z - 0.14], [X + (i % 4 ? 1.0 : 1.16), yy, Z - 0.14], 0.013));
        if (i % 4 === 0) k.root.add(at(note(`${i * 2.5}`, { size: 0.21 }), X + 1.44, yy, Z - 0.14));
      }
    }
    const sp = spring(10, 0.28, 0.026);
    const ptr = wire([0, 0, 0], [1, 0, 0], 0.02);
    const hookW = wire([0, 0, 0], [0, 1, 0], 0.02);
    const hanger = at(torus(0.11, 0.022, BRASS), 0, 0, 0);
    const ws = Array.from({ length: 10 }, () => cyl(0.24, 0.17, STEEL, { seg: 20 }));
    const g = at(plot({ w: 3.7, h: 2.9, xr: [0, 35], yr: [0, 5.2], xl: 'x / cm', yl: 'F / N' }), 2.35, 0, -2.15);
    const info = at(card('\n\n', { w: 3.7, size: 0.28, align: 'left' }), 2.35, 0, 2.25);
    const dim = dimension({ w: 1.5, size: 0.24 });
    k.root.add(sp, ptr, hookW, hanger, ...ws, g, info, dim);

    let xCur = 0, vCur = 0, xPlastic = 0, dragging = false, dragY0 = null, xDrag0 = 0;
    const seen = new Map();

    const springParams = () => ({
      kk: KS[p.kChoice ?? 1],
      fy: FY[p.kChoice ?? 1],
      selfOff: p.selfWeight ? 0.008 : 0,
    });

    const eqExtension = (F) => {
      const { kk, fy, selfOff } = springParams();
      let xe = F / kk + selfOff;
      if (p.yieldOn && F > fy) {
        const over = F - fy;
        xe += (over / kk) * (0.42 + 1.6 * over);
        xPlastic = Math.max(xPlastic, 0.018 * over);
      }
      return xe + xPlastic;
    };

    const drawPlot = () => {
      const { kk, fy } = springParams();
      const isL = p.plotMode === 1;
      g.range(isL ? [10, 50] : [0, 38], [0, 5.2]).clear();
      g.fn((xv) => {
        const xM = isL ? (xv / 100 - L0_M) : xv / 100;
        return xM >= 0 ? Math.min(5.2, kk * xM) : 0;
      }, C.copper, 0.032, true);
      if (p.yieldOn) {
        const pts = [];
        for (let f = 0; f <= 5.0; f += 0.2) {
          let xm = f / kk + (f > fy ? ((f - fy) / kk) * (0.42 + 1.6 * (f - fy)) : 0);
          pts.push([isL ? (L0_M + xm) * 100 : xm * 100, f]);
        }
        g.curve(pts, C.ink, 0.035, false);
      }
      for (const pt of seen.values()) g.dot(isL ? pt.LCm : pt.xCm, pt.F, pt.over ? C.red : '#1f4a3e');
      g.done();
    };

    k.drag(hanger, {
      normal: 'z',
      start: () => { dragging = true; dragY0 = null; xDrag0 = xCur; },
      move: (q) => {
        if (dragY0 === null) { dragY0 = q.y; return; }
        xCur = clamp(xDrag0 - (q.y - dragY0) / U, 0, 0.42);
        vCur = 0;
        k.dirty();
      },
      end: () => { dragging = false; dragY0 = null; },
    });

    const snapshotRow = () => {
      const { fy } = springParams();
      const F = p.n * 0.05 * G;
      const xEff = Math.max(0, eqExtension(F));
      return {
        _kind: p.selfWeight || p.yieldOn ? 'simulated' : 'model',
        spec: `${KS[p.kChoice ?? 1]} N/m`,
        n: p.n,
        F,
        LCm: (L0_M + xEff) * 100,
        xCm: xEff * 100,
        kEff: xEff > 1e-4 ? F / xEff : NaN,
        regime: p.yieldOn && F > fy ? '超弹性屈服' : '弹性区',
      };
    };

    drawPlot();
    return {
      snapshotRow,
      press(id) {
        if (id === 'logBtn') {
          const row = snapshotRow();
          seen.set(p.n, { xCm: row.xCm, LCm: row.LCm, F: row.F, over: row.regime !== '弹性区' });
          drawPlot();
          k.record(row);
        } else if (id === 'resetSpring') {
          xPlastic = 0;
          seen.clear();
          p.n = 0; k.set('n', 0);
          xCur = eqExtension(0); vCur = 0;
          drawPlot();
          k.dirty();
        }
      },
      change(id) {
        if (id === 'kChoice') { xPlastic = 0; seen.clear(); }
        drawPlot();
      },
      update(dt) {
        const { kk, fy } = springParams();
        const F = p.n * 0.05 * G;
        const xe = eqExtension(F);
        if (!dragging && dt > 0) {
          vCur += ((xe - xCur) * 85 - vCur * 6.5) * dt;
          xCur = clamp(xCur + vCur * dt, 0, 0.45);
          if (Math.abs(xCur - xe) < 0.0015 && Math.abs(vCur) < 0.01 && !seen.has(p.n)) {
            seen.set(p.n, { xCm: xe * 100, LCm: (L0_M + xe) * 100, F, over: p.yieldOn && F > fy });
            drawPlot();
          }
        }
        const yb = TOPY - (L0_M + xCur) * U;
        sp.span([X, TOPY, Z], [X, yb, Z]);
        ptr.span([X, yb, Z], [X + 0.9, yb, Z - 0.1]);
        hookW.span([X, yb, Z], [X, yb - 0.24, Z]);
        hanger.position.set(X, yb - 0.25, Z);
        ws.forEach((w, i) => { w.visible = i < p.n; w.position.set(X, yb - 0.44 - i * 0.185, Z); });
        dim.set([X - 0.65, TOPY, Z], [X - 0.65, yb, Z], `L=${((L0_M + xCur) * 100).toFixed(1)}cm`, [-1, 0, 0]);
        const over = p.yieldOn && F > fy;
        info.set(
          `F = ${F.toFixed(2)} N · L = ${((L0_M + xCur) * 100).toFixed(1)} cm\n`
          + `x = ${(xCur * 100).toFixed(1)} cm${xPlastic > 1e-4 ? ` (塑变 +${(xPlastic * 100).toFixed(1)}cm)` : ''}\n`
          + (over ? `⚠ 已超弹性限度 ${fy.toFixed(1)} N，进入屈服区` : `弹性区内 · 理论 k = ${kk} N/m`),
        );
      },
      margin() {
        const { kk, fy } = springParams();
        const F = p.n * 0.05 * G, xe = eqExtension(F);
        return [
          `k = ${kk} N/m · F_y = ${fy.toFixed(1)} N`,
          `F = ${F.toFixed(2)} N`,
          `x = ${(xe * 100).toFixed(2)} cm`,
          `Eₚ = ½kx² ≈ ${(0.5 * kk * xe * xe).toFixed(3)} J`,
          xPlastic > 1e-4 ? `永久塑变 +${(xPlastic * 100).toFixed(2)} cm` : '卸载可完全恢复原长',
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 劲度系数 k 标定与 F–x / F–L 线性回归');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn primary" data-wb="sweepElastic">扫测弹性区 (0–4 钩码)</button>
      <button type="button" class="wb-btn" data-wb="sweepFull">全量程扫测 (0–10 钩码含屈服)</button>
      <button type="button" class="wb-btn" data-wb="sample1">采录当前载荷</button>
      <button type="button" class="wb-btn" data-wb="reset">换新弹簧</button>`;
    sec1.append(bar);

    const chart = wb.regressionChart(sec1, {
      w: 520, h: 235, xLabel: '伸长量 x (m)', yLabel: '弹力 F (N)', xRange: [0, 0.35], yRange: [0, 5.2],
    });
    const out = document.createElement('div');
    out.className = 'wb-metrics';
    sec1.append(out);

    const refresh = () => {
      const p = sp.params, rows = wb.rows();
      const KS = [15, 25, 45], FY = [2.2, 3.2, 4.4];
      const kk = KS[p.kChoice ?? 1], fy = FY[p.kChoice ?? 1];
      const isL = p.plotMode === 1;
      const pts = rows.filter((r) => Number.isFinite(r.xCm) && Number.isFinite(r.F)).map((r) => [
        isL ? r.LCm / 100 : r.xCm / 100, r.F, r._kind || 'simulated',
      ]);
      const elasticPts = rows.filter((r) => r.regime === '弹性区' && Number.isFinite(r.xCm)).map((r) => [
        isL ? r.LCm / 100 : r.xCm / 100, r.F,
      ]);
      const maxX = Math.max(0.32, ...pts.map((q) => q[0] * 1.15));
      chart.redraw({
        pts,
        xRange: [isL ? 0.08 : 0, maxX],
        yRange: [0, 5.2],
        theoryFn: (xv) => kk * (isL ? Math.max(0, xv - 0.12) : xv),
      });
      const regAll = linearRegression(pts);
      const regEl = linearRegression(elasticPts);
      const kFit = regEl ? regEl.k : regAll?.k;
      const relErr = kFit ? ((kFit - kk) / kk) * 100 : NaN;
      out.innerHTML = `
        <div class="wb-m"><span>标称劲度系数 k</span><b>${kk.toFixed(1)} N/m (F_yield=${fy.toFixed(1)} N)</b></div>
        <div class="wb-m"><span>弹性区回归斜率 k_fit</span><b>${kFit ? `${kFit.toFixed(2)} N/m` : '需 ≥2 组点'}</b></div>
        <div class="wb-m"><span>全点线性度 R²</span><b>${regAll ? regAll.r2.toFixed(4) : '—'}</b></div>
        <div class="wb-m"><span>相对标称偏差</span><b>${Number.isFinite(relErr) ? `${relErr >= 0 ? '+' : ''}${relErr.toFixed(2)}%` : '—'}</b></div>`;
    };

    const sampleAt = (n) => {
      wb.setParam('n', n);
      const row = sp.inst?.snapshotRow?.();
      if (row) wb.record(row);
    };

    bar.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.wb;
      if (!act) return;
      if (act === 'sweepElastic') {
        [0, 1, 2, 3, 4].forEach(sampleAt);
      } else if (act === 'sweepFull') {
        for (let n = 0; n <= 10; n += 2) sampleAt(n);
      } else if (act === 'sample1') {
        const row = sp.inst?.snapshotRow?.();
        if (row) wb.record(row);
      } else if (act === 'reset') {
        wb.press('resetSpring');
      }
      refresh();
    });

    refresh();
    return { update() { refresh(); } };
  },
};

// ================================================================ 3. 力的合成规律（升级版 + 矢量多边形闭合误差台）(L3)
export const forces = {
  id: 'phy-forces',
  subject: 'phy',
  title: '探究两个互成角度的力的合成规律',
  en: 'Parallelogram law of force addition',
  lede: [
    '橡皮条一端固定于木板 A 点，另一端圆环被两只弹簧测力计共同拉到 O 点；换用一只测力计，也把圆环拉到同一 O 点，两次作用效果完全等效。',
    '按同一标度作平行四边形得到理论合力 F，与单只测力计实测拉力 F′ 对比；直接拖拽测力计拉环可实时调节夹角与分力大小。',
  ],
  formula: 'F = F₁ + F₂（矢量和） · F = √(F₁² + F₂² + 2F₁F₂cosθ)',
  formulaNote: '以 F₁、F₂ 为邻边作平行四边形，对角线即为理论合力 F；三角形首尾相加可直检多边形闭合误差 ΔF',
  terms: [
    ['等效替代', '两次都将橡皮条拉到同一结点 O，一个力 F′ 与两分力 F₁、F₂ 效果相同。'],
    ['理论合力 F', '依据平行四边形定则几何作图得到的矢量和。'],
    ['实测合力 F′', '单只弹簧测力计拉到 O 点时的直接读数，必沿 AO 方向。'],
  ],
  predict: {
    q: '保持两个分力 F₁、F₂ 大小不变，把它们之间的夹角 θ 从 60° 拉大到 120°，合力 F 会如何变化？',
    options: ['变大', '变小', '保持不变'],
    answer: 1,
    why: '由余弦公式 F = √(F₁² + F₂² + 2F₁F₂cosθ)，夹角从 60° 增大到 120° 时 cosθ 从 +0.5 降为 −0.5，两分力相互抵消增多，合力明显变小。',
  },
  challenge: '令 F₁ = F₂ = 3.0 N，找出使合力大小也恰好等于 3.0 N 的夹角 θ；随后在工作台切换“矢量多边形闭合”视图测量闭合误差！',
  fig: '图板白纸、橡皮条 AO、结点 O、两只/一只弹簧测力计与纸面矢量图',
  hint: '可直接拖白纸上的测力计或调滑杆改变 F₁、F₂、θ；切换“一只测力计”看等效拉到 O 点；按“作图并记录”画出力矢量。',
  teach: {
    where: '人教版物理必修第一册第三章 §3.4《力的合成和分解》（学生必做实验 3）',
    ask: [
      '理论合力 F 与实测拉力 F′ 中，哪一个力的方向一定严格沿橡皮条 AO 的伸长方向？为什么？',
      '为什么在真实实验中两只测力计读数乘以标度画出的平行四边形对角线 F 与 F′ 常有微小的角度和长度偏差？',
    ],
    simplify: '橡皮条遵循胡克定律（k_band = 2.38 N/u），结点 O 位置由真实合力决定。开启读数误差时叠加 ±0.05 N 估读与 ±1° 描点方向抖动。',
    safety: '弹簧测力计不要超过量程（5 N），使用前需水平校零，拉力方向须与图板纸面平行。',
  },
  controls: [
    { id: 'f1', label: '分力 F₁', min: 1.0, max: 4.5, step: 0.1, value: 3.0, unit: 'N' },
    { id: 'f2', label: '分力 F₂', min: 1.0, max: 4.5, step: 0.1, value: 2.5, unit: 'N' },
    { id: 'th', label: '夹角 θ', min: 20, max: 160, step: 1, value: 70, unit: '°' },
    { id: 'mode', label: '测量方式', type: 'choice', options: ['两只测力计', '一只测力计'], value: 0 },
    { id: 'noise', label: '读数±0.05N与描点±1°误差', type: 'toggle', value: true },
    { id: 'logBtn', label: '作图并记录', type: 'button' },
  ],
  record: {
    note: '记下 F₁、F₂、夹角 θ、作图合力 F、实测 F′ 与大小/方向偏差，在工作台查看矢量多边形闭合误差。',
    pending: '点击“作图并记录”将当前力矢量组写入记录册。',
    columns: [
      { key: 'f1', label: 'F₁', unit: 'N', digits: 2 },
      { key: 'f2', label: 'F₂', unit: 'N', digits: 2 },
      { key: 'th', label: 'θ', unit: '°', digits: 0 },
      { key: 'f', label: '作图 F', unit: 'N', digits: 2 },
      { key: 'fm', label: '实测 F′', unit: 'N', digits: 2 },
      { key: 'dev', label: '大小偏差', unit: '%', digits: 1, stat: true },
      { key: 'ang', label: '方向偏差', unit: '°', digits: 1, stat: true },
    ],
    sample: (inst) => inst.take?.(false) || null,
    summary: (rows) => {
      const ds = sampleStats(rows.map((r) => r.dev));
      const as = sampleStats(rows.map((r) => r.ang));
      return [
        ['记录矢量组数', `${rows.length} 组`],
        ['平均大小 / 方向偏差', ds.n ? `${ds.mean.toFixed(2)}% / ${as.mean.toFixed(2)}°` : '—'],
      ];
    },
    errors: [
      '弹簧测力计最小分度 0.1 N，估读引入 ±0.05 N 随机误差。',
      '描点确定拉力方向时，若标记两点间距太近会放大角度偏转。',
      '拉力未与木板平行或测力计与纸面存在滑动摩擦。',
    ],
  },

  build(k) {
    const p = k.p;
    const Z0 = -3.0, Y = 0.34, U = 0.72, K = 0.42, L0 = 1.3, rand = rng(7);
    k.root.add(at(box(8.6, 0.24, 7.4, '#ead9b8'), 0, 0, 0.3), at(box(7.8, 0.03, 6.6, '#ffffff'), 0, 0.24, 0.3));
    for (const [x, z] of [[-3.7, -2.8], [3.7, -2.8], [-3.7, 3.4], [3.7, 3.4]]) {
      k.root.add(at(cyl(0.09, 0.05, BRASS, { seg: 14 }), x, 0.27, z));
    }
    const A = [0, Y, Z0];
    k.root.add(at(cyl(0.07, 0.22, STEEL, { seg: 12 }), 0, 0.27, Z0), at(note('A', { size: 0.3, lay: 'flat', italic: true }), -0.35, 0.29, Z0));
    const band = strip(2, { color: '#b4653a', w: 0.1, normal: [0, 1, 0] });
    const oRing = at(torus(0.13, 0.03, STEEL), 0, Y, 0);
    const oTag = note('O', { size: 0.3, lay: 'flat', italic: true });

    const mkScale = () => {
      const g = group(
        at(box(0.5, 0.16, 1.7, '#ffffff'), 0, 0, 1.45),
        at(box(0.34, 0.03, 1.2, '#f3ead6'), 0, 0.16, 1.45),
        at(torus(0.12, 0.025, STEEL), 0, 0.08, 2.42),
      );
      const pointer = at(flat(new THREE.BoxGeometry(0.3, 0.02, 0.04), C.red), 0, 0.2, 1.0);
      const str = wire([0, 0.08, 0], [0, 0.08, 0.6], 0.016);
      g.add(pointer, str);
      g.pointer = pointer;
      return g;
    };
    const s1 = mkScale(), s2 = mkScale(), s3 = mkScale();
    const a1 = arrow(C.violet, 0.035), a2 = arrow(C.sky, 0.035), aF = arrow(C.copper, 0.04), aM = arrow(C.leaf, 0.04);
    const para = strip(3, { color: C.ink, w: 0.022, opacity: 0.5, normal: [0, 1, 0] });
    const t1 = note('F₁', { size: 0.3, lay: 'flat', color: C.violet });
    const t2 = note('F₂', { size: 0.3, lay: 'flat', color: C.sky });
    const tF = note('F', { size: 0.3, lay: 'flat', color: C.copper });
    const tM = note("F′", { size: 0.3, lay: 'flat', color: C.leaf });
    const info = at(card('\n\n', { w: 4.5, size: 0.27, align: 'left' }), 2.2, 0.24, 3.3);
    k.root.add(band, oRing, oTag, s1, s2, s3, a1, a2, aF, aM, para, t1, t2, tF, tM, info);

    let drawn = null, lastKey = '';
    const place = (sc, O, ang, f) => {
      sc.position.set(O[0], Y - 0.06, O[2]);
      sc.rotation.y = ang;
      sc.pointer.position.z = 1.0 + f * 0.2;
    };
    const state = () => {
      const th = p.th * DEG;
      const F = Math.sqrt(p.f1 ** 2 + p.f2 ** 2 + 2 * p.f1 * p.f2 * Math.cos(th));
      const al1 = Math.atan2(p.f2 * Math.sin(th), p.f1 + p.f2 * Math.cos(th));
      const al2 = th - al1;
      return { th, F, al1, al2, O: [0, Y, Z0 + L0 + F * K] };
    };

    // 直接拖拽两只测力计拉环改变分力与夹角
    const bindScaleDrag = (sc, isFirst) => k.drag(sc, {
      normal: 'y',
      start: () => {},
      move: (q) => {
        const s = state(), O = s.O;
        const dx = q.x - O[0], dz = Math.max(0.2, q.z - O[2]);
        const fNew = clamp(Math.round(Math.hypot(dx, dz) / 0.55 * 10) / 10, 1.0, 4.5);
        const ang = Math.atan2(dx, dz);
        const thNew = clamp(Math.round((isFirst ? s.al2 - ang : ang + s.al1) / DEG), 20, 160);
        if (isFirst) { p.f1 = fNew; k.set('f1', fNew); } else { p.f2 = fNew; k.set('f2', fNew); }
        p.th = thNew; k.set('th', thNew);
        k.dirty();
      },
    });
    bindScaleDrag(s1, true);
    bindScaleDrag(s2, false);

    const take = (push) => {
      const s = state();
      const nf = p.noise ? 1 : 0;
      const r1 = Math.round((p.f1 + gauss(rand) * 0.04 * nf) * 20) / 20;
      const r2 = Math.round((p.f2 + gauss(rand) * 0.04 * nf) * 20) / 20;
      const d1 = s.al1 + gauss(rand) * 0.017 * nf;
      const d2 = s.al2 + gauss(rand) * 0.017 * nf;
      const fx = -r1 * Math.sin(d1) + r2 * Math.sin(d2);
      const fz = r1 * Math.cos(d1) + r2 * Math.cos(d2);
      const f = Math.hypot(fx, fz);
      const fm = Math.round((s.F + gauss(rand) * 0.04 * nf) * 20) / 20;
      drawn = { r1, r2, d1, d2, fx, fz, f, fm };
      const row = {
        _kind: p.noise ? 'simulated' : 'model',
        f1: r1, f2: r2, th: p.th, f, fm,
        dev: Math.abs(f - fm) / Math.max(1e-4, fm) * 100,
        ang: Math.abs(Math.atan2(fx, fz)) / DEG,
      };
      if (push) k.record(row);
      return row;
    };

    return {
      take,
      getState: () => ({ ...state(), drawn }),
      press(id) {
        if (id === 'logBtn') take(true);
      },
      update() {
        const s = state(), O = s.O, kk = `${p.f1}|${p.f2}|${p.th}|${p.noise}`;
        if (kk !== lastKey) { lastKey = kk; drawn = null; }
        band.set([A, O]);
        oRing.position.set(O[0], Y, O[2]);
        oTag.position.set(O[0] + 0.4, 0.29, O[2] - 0.1);
        const two = p.mode === 0;
        s1.visible = s2.visible = two; s3.visible = !two;
        place(s1, O, -s.al1, p.f1); place(s2, O, s.al2, p.f2); place(s3, O, 0, s.F);
        const tip = (f, a) => [O[0] + Math.sin(a) * f * U, 0.3, O[2] + Math.cos(a) * f * U];
        const o = [O[0], 0.3, O[2]];
        const g1 = drawn ? tip(drawn.r1, -drawn.d1) : tip(p.f1, -s.al1);
        const g2 = drawn ? tip(drawn.r2, drawn.d2) : tip(p.f2, s.al2);
        a1.set(o, g1); a2.set(o, g2);
        t1.position.set(g1[0] - 0.35, 0.3, g1[2] + 0.2);
        t2.position.set(g2[0] + 0.35, 0.3, g2[2] + 0.2);
        const gF = [g1[0] + g2[0] - o[0], 0.3, g1[2] + g2[2] - o[2]];
        aF.visible = para.visible = tF.visible = !!drawn;
        aM.visible = tM.visible = !!drawn;
        if (drawn) {
          aF.set(o, gF); para.set([g1, gF, g2]);
          tF.position.set(gF[0] - 0.4, 0.3, gF[2] + 0.3);
          const gM = tip(drawn.fm, 0);
          aM.set([o[0] + 0.06, 0.3, o[2]], [gM[0] + 0.06, 0.3, gM[2]]);
          tM.position.set(gM[0] + 0.5, 0.3, gM[2] + 0.3);
        }
        info.set(drawn
          ? `读数 F₁=${drawn.r1.toFixed(2)} N, F₂=${drawn.r2.toFixed(2)} N\n作图 F=${drawn.f.toFixed(2)} N vs 实测 F′=${drawn.fm.toFixed(2)} N\n偏差 ${(Math.abs(drawn.f - drawn.fm) / drawn.fm * 100).toFixed(1)}% · 偏角 ${(Math.abs(Math.atan2(drawn.fx, drawn.fz)) / DEG).toFixed(1)}°`
          : `${two ? '两只测力计拉圆环至 O 点' : '一只测力计等效拉至同一 O 点'}\nF₁=${p.f1.toFixed(1)} N, F₂=${p.f2.toFixed(1)} N, θ=${p.th}°\n按“作图并记录”校验平行四边形定则`);
      },
      margin() {
        const s = state();
        return [
          'F² = F₁² + F₂² + 2F₁F₂cosθ',
          `理论合力 F = ${s.F.toFixed(2)} N`,
          `|F₁−F₂| = ${Math.abs(p.f1 - p.f2).toFixed(1)} N`,
          `F₁+F₂ = ${(p.f1 + p.f2).toFixed(1)} N`,
          drawn ? `闭合残差 ΔF = ${Math.hypot(drawn.fx, drawn.fz - drawn.fm).toFixed(3)} N` : '待采样作图对比',
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 平行四边形定则与矢量多边形首尾闭合分析仪');
    let viewMode = 0; // 0: 平行四边形, 1: 三角形矢量首尾闭合
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn primary" data-wb="para">平行四边形定则视图</button>
      <button type="button" class="wb-btn" data-wb="poly">矢量首尾闭合视图</button>
      <button type="button" class="wb-btn" data-wb="sample">作图采样并记入实验册</button>`;
    sec1.append(bar);

    const cv = wb.canvas(sec1, 520, 300, (x, W, H) => {
      const p = sp.params;
      const st = sp.inst?.getState?.();
      const d = st?.drawn;
      const al1 = d ? d.d1 : st?.al1 ?? (p.th * DEG) / 2;
      const al2 = d ? d.d2 : st?.al2 ?? (p.th * DEG) / 2;
      const f1 = d ? d.r1 : p.f1;
      const f2 = d ? d.r2 : p.f2;
      const fm = d ? d.fm : Math.sqrt(f1 * f1 + f2 * f2 + 2 * f1 * f2 * Math.cos((al1 + al2)));

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      // 坐标网格
      x.strokeStyle = 'rgba(30,43,54,0.08)'; x.lineWidth = 1;
      for (let gx = 40; gx < W; gx += 40) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, H); x.stroke(); }
      for (let gy = 40; gy < H; gy += 40) { x.beginPath(); x.moveTo(0, gy); x.lineTo(W, gy); x.stroke(); }

      const ox = W * 0.5, oy = 46, scale = 32; // 1 N = 32 px
      const v1 = [-f1 * Math.sin(al1) * scale, f1 * Math.cos(al1) * scale];
      const v2 = [f2 * Math.sin(al2) * scale, f2 * Math.cos(al2) * scale];
      const vF = [v1[0] + v2[0], v1[1] + v2[1]];
      const vM = [0, fm * scale];

      const drawVec = (x0, y0, dx, dy, col, lbl, dashed = false) => {
        const x1 = x0 + dx, y1 = y0 + dy, len = Math.hypot(dx, dy);
        if (len < 2) return;
        x.save();
        x.strokeStyle = col; x.fillStyle = col; x.lineWidth = 2.4;
        if (dashed) x.setLineDash([5, 4]);
        x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
        x.setLineDash([]);
        const ux = dx / len, uy = dy / len;
        x.beginPath();
        x.moveTo(x1, y1);
        x.lineTo(x1 - ux * 9 - uy * 4.5, y1 - uy * 9 + ux * 4.5);
        x.lineTo(x1 - ux * 9 + uy * 4.5, y1 - uy * 9 - ux * 4.5);
        x.closePath(); x.fill();
        x.font = '600 12px Georgia,serif';
        x.fillText(lbl, x0 + dx * 0.55 + (dx < 0 ? -24 : 8), y0 + dy * 0.55);
        x.restore();
      };

      x.fillStyle = C.ink; x.beginPath(); x.arc(ox, oy, 4, 0, TAU); x.fill();
      x.font = 'italic 12px Georgia,serif'; x.fillText('O', ox - 14, oy - 6);

      if (viewMode === 0) {
        drawVec(ox, oy, v1[0], v1[1], C.violet, `F₁ (${f1.toFixed(2)}N)`);
        drawVec(ox, oy, v2[0], v2[1], C.sky, `F₂ (${f2.toFixed(2)}N)`);
        x.save(); x.setLineDash([4, 4]); x.strokeStyle = 'rgba(30,43,54,0.45)'; x.lineWidth = 1.4;
        x.beginPath();
        x.moveTo(ox + v1[0], oy + v1[1]); x.lineTo(ox + vF[0], oy + vF[1]);
        x.moveTo(ox + v2[0], oy + v2[1]); x.lineTo(ox + vF[0], oy + vF[1]);
        x.stroke(); x.restore();
        drawVec(ox, oy, vF[0], vF[1], C.copper, `F (${(Math.hypot(vF[0], vF[1]) / scale).toFixed(2)}N)`);
        drawVec(ox, oy, vM[0], vM[1], C.leaf, `F′ (${fm.toFixed(2)}N)`, true);
      } else {
        drawVec(ox, oy, v1[0], v1[1], C.violet, `F₁ (${f1.toFixed(2)}N)`);
        drawVec(ox + v1[0], oy + v1[1], v2[0], v2[1], C.sky, `F₂ (${f2.toFixed(2)}N)`);
        drawVec(ox + vF[0], oy + vF[1], -vM[0], -vM[1], C.leaf, `−F′ (${fm.toFixed(2)}N)`);
        const cx = ox + vF[0] - vM[0], cy = oy + vF[1] - vM[1];
        drawVec(cx, cy, ox - cx, oy - cy, C.red, 'ΔF 闭合误差');
      }
    });

    const out = document.createElement('div');
    out.className = 'wb-metrics';
    sec1.append(out);

    const refresh = () => {
      cv.redraw();
      const st = sp.inst?.getState?.();
      const d = st?.drawn;
      const Fcalc = d ? d.f : st?.F ?? 0;
      const Fmeas = d ? d.fm : st?.F ?? 0;
      const closure = d ? Math.hypot(d.fx, d.fz - d.fm) : 0;
      const angErr = d ? Math.abs(Math.atan2(d.fx, d.fz)) / DEG : 0;
      out.innerHTML = `
        <div class="wb-m"><span>作图合力 F</span><b>${Fcalc.toFixed(3)} N</b></div>
        <div class="wb-m"><span>单计实测 F′</span><b>${Fmeas.toFixed(3)} N</b></div>
        <div class="wb-m"><span>矢量闭合误差 |ΔF|</span><b>${d ? `${closure.toFixed(3)} N` : '点击上方采样显示含噪声闭合差'}</b></div>
        <div class="wb-m"><span>方向偏角 Δα</span><b>${d ? `${angErr.toFixed(2)}°` : '0.00°'}</b></div>`;
    };

    bar.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.wb;
      if (!act) return;
      if (act === 'para') { viewMode = 0; }
      else if (act === 'poly') { viewMode = 1; }
      else if (act === 'sample') { wb.press('logBtn'); }
      refresh();
    });

    refresh();
    return { update() { refresh(); } };
  },
};

// ================================================================ 4. 牛顿第二定律（含平衡摩擦斜角与大槽码边界失效）(L4)
export const newton2 = {
  id: 'phy-newton2',
  subject: 'phy',
  title: '探究加速度与物体受力、物体质量的关系',
  en: "Newton's second law",
  lede: [
    '把槽码挂过滑轮拉动小车：只有先垫高木板一端恰当倾角 θ 平衡摩擦力，且保证槽码质量 m₀ ≪ 小车质量 M 时，绳中拉力 T 才近似等于 m₀g。',
    '拖动左端垫木改变倾角 θ 亲手平衡摩擦，并试着把槽码 m₀ 加大到 250 g——观察工作台 a–F 图线如何偏离直线并向下弯曲！',
  ],
  formula: 'a = (m₀g − μMgcosθ + Mgsinθ) / (M + m₀)',
  formulaNote: '两体耦合精确解；绳中实际拉力 T = M(a + μgcosθ − gsinθ) < m₀g，仅当 tanθ = μ 且 m₀ ≪ M 时 a ≈ m₀g/M',
  terms: [
    ['平衡摩擦力', '垫高木板至倾角 tanθ = μ，使重力沿斜面向下的分力恰好抵消轨道滑动摩擦。'],
    ['系统误差边界', '近似 F ≈ m₀g 忽略了槽码自身的加速度 m₀a，当 m₀/M 增大时 a–F 曲线显著下弯。'],
    ['控制变量法', '保持 M 不变测 a–F，再保持 F 不变测 a–1/M 直线。'],
  ],
  predict: {
    q: '平衡摩擦力后，若实验者始终把槽码重力 m₀g 当成小车合力 F，不断增加槽码质量 m₀（接近甚至超过小车 M）时，画出的 a–F 图像会怎样？',
    options: ['始终保持一条过原点的直线', '末端明显向下弯曲，加速度趋向于 g', '末端向上翘起'],
    answer: 1,
    why: '真实加速度为 a = m₀g / (M + m₀)。当 m₀ 不可忽略时分母变大，实际拉力 T = Ma < m₀g；即使 m₀ → ∞，加速度也只能趋近自由落体加速度 g，因此 a–F 图像向下弯曲。',
  },
  challenge: '调 μ = 0.05 并用左端垫木找到平衡倾角 θ（tanθ ≈ 0.05 ⇒ θ ≈ 2.9°）；再在工作台扫测大槽码全量程，对比“理想近似”与“真实拉力 T”的线性度！',
  fig: '可调倾角长木板、垫木、载重小车、定滑轮与槽码组',
  hint: '直接上下拖拽左端木质垫块调节木板倾角 θ，或按“自动平衡摩擦”；按“释放小车”测量 0.60 m 计时加速度。',
  teach: {
    where: '人教版物理必修第一册第四章 §4.2《实验：探究加速度与力、质量的关系》（学生必做实验 4）',
    ask: [
      '若未平衡摩擦力（θ = 0, μ > 0），a–F 图像在纵轴与横轴上的截距分别会落在哪一侧？',
      '为什么以 1/M 为横轴而不是以 M 为横轴画图？当 m₀ 不再远小于 M 时，a–1/M 图像也会弯曲吗？',
    ],
    simplify: '两体刚性轻绳耦合，忽略滑轮转动惯量与空气阻力；若合驱动力 m₀g + Mgsinθ − μMgcosθ ≤ 0，静摩擦阻止小车启动（a = 0）。',
    safety: '小车撞击滑轮端缓冲块前需及时制动，避免重物砸落伤脚。',
  },
  controls: [
    { id: 'M', label: '小车总质量 M', min: 0.20, max: 1.20, step: 0.05, value: 0.40, unit: 'kg' },
    { id: 'm', label: '槽码质量 m₀', min: 10, max: 250, step: 5, value: 40, unit: 'g' },
    { id: 'tilt', label: '木板倾角 θ', min: 0.0, max: 8.0, step: 0.2, value: 2.3, unit: '°' },
    { id: 'mu', label: '轨道动摩擦 μ', min: 0.00, max: 0.12, step: 0.01, value: 0.04 },
    { id: 'idealApprox', label: '记账力 F 取值', type: 'choice', options: ['近似 F = m₀g', '精确绳拉 T = Ma'], value: 0 },
    { id: 'goBtn', label: '释放小车', type: 'button' },
    { id: 'balBtn', label: '自动平衡摩擦', type: 'button' },
  ],
  record: {
    note: '记下每组 (M, m₀, θ, F_rec, a)，在工作台一键扫测 a–F 与 a–1/M，直观识别 m₀ ≪ M 条件失效。',
    pending: '释放小车完成 0.60 m 跑道测时后按“记录一组”，或在工作台扫测采集。',
    columns: [
      { key: 'M', label: 'M', unit: 'kg', digits: 2 },
      { key: 'invM', label: '1/M', unit: 'kg⁻¹', digits: 2 },
      { key: 'mG', label: 'm₀', unit: 'g', digits: 0 },
      { key: 'F', label: '记账力 F', unit: 'N', digits: 3 },
      { key: 'T', label: '真拉力 T', unit: 'N', digits: 3 },
      { key: 'a', label: '测得 a', unit: 'm/s²', digits: 3, stat: true },
    ],
    sample: (inst) => inst.snapshotRow?.() || null,
    summary: (rows) => {
      const reg = linearRegression(rows.map((r) => [r.F, r.a]));
      return [
        ['有效记录组数', `${rows.length} 组`],
        ['a–F 回归斜率 (≈1/M)', reg ? `${reg.k.toFixed(3)} kg⁻¹ (R²=${reg.r2.toFixed(4)})` : '需 ≥2 组数据'],
      ];
    },
    errors: [
      '未平衡摩擦力（tanθ < μ）时图像与横轴正半轴相交；垫得过高（tanθ > μ）时与纵轴正半轴相交。',
      '槽码质量 m₀ 未远小于小车质量 M 时，近似 F ≈ m₀g 系统偏大，a–F 图线末端向下弯曲。',
    ],
  },

  build(k) {
    const p = k.p;
    const S = 5.0, D = 0.60, TOP = 3.2, X0 = -2.6, XP = 3.4, Z = -0.9;
    // 滑轮端支座固定，轨道绕 (XP, TOP, Z) 倾斜
    k.root.add(
      at(box(0.55, TOP - 0.15, 1.5, '#dfe3e6'), XP - 0.3, 0, Z),
      at(box(0.5, 0.2, 0.3, STEEL, { kind: 'metal' }), XP - 0.25, TOP, Z - 0.25),
      rot(at(cyl(0.28, 0.14, BRASS, { seg: 18 }), XP, TOP + 0.18, Z - 0.08), Math.PI / 2, 0, 0),
    );
    const boardGrp = new THREE.Group();
    boardGrp.position.set(XP, TOP, Z);
    boardGrp.add(
      at(box(7.0, 0.20, 2.1, C.wood), -3.5, -0.10, 0),
      at(wire([-6.1, 0.02, 0.7], [-6.1, 0.02, 1.0], 0.018), 0, 0, 0),
      at(wire([-6.1 + D * S, 0.02, 0.7], [-6.1 + D * S, 0.02, 1.0], 0.018), 0, 0, 0),
      at(note('0.60 m', { size: 0.28, lay: 'flat' }), -6.1 + D * S * 0.5, 0.03, 0.9),
    );
    const load = at(box(0.75, 1, 0.55, BRASS, { kind: 'metal' }), 0, 0.54, 0);
    const cart = group(at(box(1.15, 0.36, 0.78, '#eef2f5'), 0, 0.16, 0), load);
    for (const wx of [-0.38, 0.38]) for (const wz of [-0.42, 0.42]) {
      cart.add(rot(at(cyl(0.15, 0.09, C.ink, { seg: 16 }), wx, 0.15, wz), Math.PI / 2, 0, 0));
    }
    const fArr = arrow(C.copper, 0.045);
    boardGrp.add(cart, fArr);

    // 左端可拖垫木块
    const wedge = group(
      at(box(0.75, 0.65, 1.6, '#d9c39a'), 0, 0, 0),
      at(note('拖垫木调倾角', { size: 0.20 }), 0, 0.85, 0),
    );
    const s1 = wire([0, 0, 0], [1, 0, 0]), s2 = wire([0, 0, 0], [0, 1, 0]);
    const wt = cyl(0.22, 0.40, STEEL, { seg: 18 });
    const info = at(card('\n\n', { w: 4.1, size: 0.27, align: 'left' }), -2.1, 0, 2.35);
    k.root.add(boardGrp, wedge, s1, s2, wt, info);

    let t = 0, run = false, tEnd = 0;

    const physics = (M = p.M, mG = p.m, tiltDeg = p.tilt, mu = p.mu) => {
      const m = mG / 1000, th = tiltDeg * DEG;
      const drive = m * G + M * G * Math.sin(th) - mu * M * G * Math.cos(th);
      const a = drive > 0 ? drive / (M + m) : 0;
      const T = M * (a + mu * G * Math.cos(th) - G * Math.sin(th));
      const Frec = p.idealApprox === 0 ? m * G : Math.max(0, T);
      return { m, th, a, T: Math.max(0, T), Frec, balDeg: Math.atan(mu) / DEG };
    };

    const reset = () => { t = 0; run = false; tEnd = 0; };

    let wY0 = null, t0Tilt = 0;
    k.drag(wedge, {
      normal: 'z',
      start: () => { wY0 = null; t0Tilt = p.tilt; },
      move: (q) => {
        if (wY0 === null) { wY0 = q.y; return; }
        const nt = clamp(Math.round((t0Tilt + (q.y - wY0) * 2.5) * 5) / 5, 0, 8);
        p.tilt = nt; k.set('tilt', nt); reset(); k.dirty();
      },
    });

    const snapshotRow = () => {
      const ph = physics();
      return {
        _kind: p.idealApprox === 0 ? 'simulated' : 'model',
        M: p.M, invM: 1 / p.M, mG: p.m, F: ph.Frec, T: ph.T, a: ph.a,
      };
    };

    return {
      physics,
      snapshotRow,
      press(id) {
        if (id === 'goBtn') { reset(); run = true; }
        else if (id === 'balBtn') {
          const bd = clamp(Math.round((Math.atan(p.mu) / DEG) * 5) / 5, 0, 8);
          p.tilt = bd; k.set('tilt', bd); reset(); k.dirty();
        }
      },
      change: reset,
      update(dt) {
        const ph = physics();
        if (run && dt > 0) {
          t += dt;
          if (ph.a <= 1e-4) { run = false; }
          else if (0.5 * ph.a * t * t >= D) { tEnd = Math.sqrt(2 * D / ph.a); t = tEnd; run = false; }
        }
        const s = Math.min(D, 0.5 * ph.a * t * t);
        // 木板左端绕 XP 抬高: 旋转负 Z 使左端 (-x) 抬起 (+y)
        boardGrp.rotation.z = -ph.th;
        const leftLift = 6.2 * Math.sin(ph.th);
        wedge.position.set(XP - 6.2, Math.max(0, TOP - 0.72 + leftLift), Z);
        const cxLocal = -6.1 + s * S;
        cart.position.set(cxLocal, 0.0, 0);
        load.scale.y = 0.04 + (p.M - 0.2) * 1.1;
        // 滑轮绳端世界坐标
        const hookWorld = new THREE.Vector3(cxLocal + 0.58, 0.45, 0).applyMatrix4(boardGrp.matrixWorld);
        s1.span([hookWorld.x, hookWorld.y, hookWorld.z], [XP, TOP + 0.45, Z]);
        const wtY = TOP - 0.2 - s * S;
        s2.span([XP + 0.28, TOP + 0.18, Z], [XP + 0.28, wtY, Z]);
        wt.position.set(XP + 0.28, wtY - 0.40, Z);
        wt.scale.setScalar(0.65 + p.m / 240);
        fArr.set([cxLocal + 0.58, 0.75, 0], [cxLocal + 0.58 + clamp(ph.T * 1.2, 0.1, 2.2), 0.75, 0]);
        const balDiff = Math.abs(p.tilt - ph.balDeg);
        info.set(
          `倾角 θ=${p.tilt.toFixed(1)}° (${balDiff < 0.3 ? '已平衡摩擦' : p.tilt < ph.balDeg ? '倾角偏小' : '倾角偏大'})\n`
          + `t = ${t.toFixed(2)} s · a = ${ph.a.toFixed(2)} m/s²\n`
          + `m₀g = ${(ph.m * G).toFixed(3)} N vs 绳拉 T = ${ph.T.toFixed(3)} N`,
        );
      },
      margin() {
        const ph = physics();
        const ratio = (ph.m / p.M) * 100;
        return [
          `平衡摩擦需 θ ≈ ${ph.balDeg.toFixed(1)}°`,
          `m₀/M = ${ratio.toFixed(1)}%`,
          `m₀g = ${(ph.m * G).toFixed(3)} N`,
          `真拉力 T = ${ph.T.toFixed(3)} N`,
          `a_精 = ${ph.a.toFixed(3)} m/s²`,
          ratio > 10 ? '⚠ m₀≪M 条件已明显破坏' : '满足 m₀≪M 近似',
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · a–F 与 a–1/M 回归及 m₀ ≪ M 边界弯曲检验');
    let axisMode = 'F'; // 'F' | 'invM'
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn primary" data-wb="sweepSmall">扫测 a–F (小槽码 m₀≤50g)</button>
      <button type="button" class="wb-btn" data-wb="sweepLarge">扫测 a–F (大槽码至250g 露弯曲)</button>
      <button type="button" class="wb-btn" data-wb="sweepInvM">扫测 a–1/M (控 m₀)</button>
      <button type="button" class="wb-btn" data-wb="sample1">记入当前点</button>`;
    sec1.append(bar);

    const chart = wb.regressionChart(sec1, {
      w: 520, h: 245, xLabel: '拉力 F (N)', yLabel: '加速度 a (m/s²)', xRange: [0, 2.6], yRange: [0, 6.5],
    });
    const out = document.createElement('div');
    out.className = 'wb-metrics';
    sec1.append(out);

    const refresh = () => {
      const p = sp.params, rows = wb.rows();
      const isF = axisMode === 'F';
      const pts = rows.filter((r) => Number.isFinite(r.a)).map((r) => [
        isF ? r.F : r.invM, r.a, r._kind || 'simulated',
      ]);
      const maxX = Math.max(isF ? 2.5 : 5.0, ...pts.map((q) => q[0] * 1.15));
      const maxY = Math.max(5.5, ...pts.map((q) => q[1] * 1.2));
      chart.redraw({
        pts,
        xRange: [0, maxX],
        yRange: [0, maxY],
        theoryFn: isF ? (fv) => fv / p.M : (im) => (p.m / 1000) * G * im,
      });
      const reg = linearRegression(pts);
      const ph = sp.inst?.physics?.() || { m: p.m / 1000, a: 0, T: 0 };
      const sysErr = ((ph.m * G - ph.T) / Math.max(1e-4, ph.T)) * 100;
      out.innerHTML = `
        <div class="wb-m"><span>当前质量比 m₀ / M</span><b>${((ph.m / p.M) * 100).toFixed(1)}%</b></div>
        <div class="wb-m"><span>近似 m₀g 相对 T 虚高</span><b>+${Math.max(0, sysErr).toFixed(1)}%</b></div>
        <div class="wb-m"><span>当前视图回归斜率</span><b>${reg ? `${reg.k.toFixed(3)}` : '需 ≥2 组点'}</b></div>
        <div class="wb-m"><span>线性度 R² (弯曲则下降)</span><b>${reg ? reg.r2.toFixed(4) : '—'}</b></div>`;
    };

    bar.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.wb;
      if (!act) return;
      const p = sp.params;
      if (act === 'sweepSmall') {
        axisMode = 'F';
        [10, 20, 30, 40, 50].forEach((mG) => {
          wb.setParam('m', mG);
          const ph = sp.inst.physics(p.M, mG, p.tilt, p.mu);
          wb.record({ _kind: p.idealApprox === 0 ? 'simulated' : 'model', M: p.M, invM: 1 / p.M, mG, F: ph.Frec, T: ph.T, a: ph.a });
        });
      } else if (act === 'sweepLarge') {
        axisMode = 'F';
        [20, 60, 120, 180, 250].forEach((mG) => {
          wb.setParam('m', mG);
          const ph = sp.inst.physics(p.M, mG, p.tilt, p.mu);
          wb.record({ _kind: p.idealApprox === 0 ? 'simulated' : 'model', M: p.M, invM: 1 / p.M, mG, F: ph.Frec, T: ph.T, a: ph.a });
        });
      } else if (act === 'sweepInvM') {
        axisMode = 'invM';
        [0.25, 0.35, 0.50, 0.75, 1.00].forEach((MM) => {
          wb.setParam('M', MM);
          const ph = sp.inst.physics(MM, p.m, p.tilt, p.mu);
          wb.record({ _kind: p.idealApprox === 0 ? 'simulated' : 'model', M: MM, invM: 1 / MM, mG: p.m, F: ph.Frec, T: ph.T, a: ph.a });
        });
      } else if (act === 'sample1') {
        const row = sp.inst?.snapshotRow?.();
        if (row) wb.record(row);
      }
      refresh();
    });

    refresh();
    return { update() { refresh(); } };
  },
};

// ================================================================ 5. 平抛运动的特点（升级版 + 频闪二次差分求解）(L3)
export const projectile = {
  id: 'phy-projectile',
  subject: 'phy',
  title: '探究平抛运动的特点',
  en: 'Projectile motion analysis',
  lede: [
    '水平弹出的小球在空中同时进行水平匀速与竖直自由落体两个分运动；另一颗同高自由落体的小球总在相同的频闪时刻处于同一高度。',
    '可直接抓握空中飞行的小球回溯或前推时间观察分速度矢量，并在工作台对频闪坐标做 Δy = gT² 二次逐差反推 g 与 v₀。',
  ],
  formula: 'x = v₀t · y = ½gt² · Δy = gT²',
  formulaNote: '真空理想平抛水平间距相等、竖直逐差恒为 gT²；开启空气阻力则采用二次阻尼 RK4 积分对比偏离',
  terms: [
    ['初速度 v₀', '小球离开水平斜槽末端瞬间的水平速度。'],
    ['等时频闪 T', '频闪仪每隔相同时间 T 拍下小球位置，用于检验 Δx 与 Δ²y。'],
    ['二次空气阻力', 'F_d = ½ρC_dAv²，使水平速度衰减、实际抛物线末段更陡且射程变短。'],
  ],
  predict: {
    q: '在频闪照片上测得连续 3 个点（间隔 T = 0.05 s）的竖直下落高度分别为 y₁ = 5.0 cm、y₂ = 12.5 cm、y₃ = 22.5 cm，当地重力加速度约为？',
    options: ['9.0 m/s²', '9.8 m/s²', '10.0 m/s²'],
    answer: 2,
    why: '相邻两段竖直位移分别为 Δy₁ = 7.5 cm、Δy₂ = 10.0 cm，逐差 Δ²y = Δy₂ − Δy₁ = 2.5 cm = 0.025 m。由 Δ²y = gT² 得 g = 0.025 / 0.05² = 10.0 m/s²。',
  },
  challenge: '设定桌高 h = 1.25 m，找出使小球恰好落在 1.50 m 处的初速度 v₀；然后开启“空气阻力”，到工作台量化射程缩水与 Δ²y 偏差！',
  fig: '斜槽发射台、坐标方格背板、频闪双球对比与分速度矢量',
  hint: '直接左右拖拽空中紫铜球 A 可任意回溯飞行时刻；按“重新发射”或“暂停/继续”定格频闪点。',
  teach: {
    where: '人教版物理必修第二册第五章 §5.3《实验：探究平抛运动的特点》（学生必做实验 6）',
    ask: [
      '从频闪点分布中如何不借助秒表而仅用方格坐标反推出初速度 v₀？',
      '为什么真实实验室斜槽末端必须严格调至水平，且每次应让小球从斜槽同一位置静止释放？',
    ],
    simplify: '真空模式严格求解抛体方程；开启空气阻力模式时采用四阶龙格-库塔积分 a_drag = −c_d |v| v（c_d = 0.085 m⁻¹），画面慢放 0.45×。',
    safety: '发射钢球落点区域放缓冲接球盒，防止钢球弹跳滚落地面踩滑。',
  },
  controls: [
    { id: 'v', label: '初速度 v₀', min: 0.8, max: 4.0, step: 0.1, value: 2.2, unit: 'm/s' },
    { id: 'h', label: '抛出高度 h', min: 0.60, max: 2.00, step: 0.05, value: 1.25, unit: 'm' },
    { id: 'flashT', label: '频闪周期 T', type: 'choice', options: ['0.04 s', '0.06 s', '0.08 s'], value: 0 },
    { id: 'dragOn', label: '空气阻力 (RK4)', type: 'toggle', value: false },
    { id: 'fireBtn', label: '重新发射', type: 'button' },
    { id: 'pauseBtn', label: '暂停 / 继续', type: 'button' },
  ],
  record: {
    note: '记下每次平抛的初速度 v₀、高度 h、落地时间、水平射程及工作台二次差分反演的 g 与 v₀。',
    pending: '按“记录一组”或工作台求解后写入当前平抛参数与结果。',
    columns: [
      { key: 'model', label: '模型' },
      { key: 'v0', label: '设定 v₀', unit: 'm/s', digits: 2 },
      { key: 'h', label: '桌高 h', unit: 'm', digits: 2 },
      { key: 'tf', label: '飞行时间', unit: 's', digits: 3 },
      { key: 'range', label: '水平射程', unit: 'm', digits: 3 },
      { key: 'gEst', label: '反演 g', unit: 'm/s²', digits: 2, stat: true },
    ],
    sample: (inst) => inst.snapshotRow?.() || null,
    summary: (rows) => {
      const gs = sampleStats(rows.map((r) => r.gEst));
      return [
        ['已录抛射组数', `${rows.length} 组`],
        ['频闪反演 g 均值', gs.n ? `${gs.mean.toFixed(2)} m/s²` : '—'],
      ];
    },
    errors: [
      '斜槽末端若未调平（略有仰角或俯角），竖直方向初速度不为零，导致 Δ²y 虽仍为 gT² 但 y ≠ ½gt²。',
      '存在显著空气阻力时，水平速度递减，用 Δx/T 算出的 v₀ 随飞行时间逐步偏小。',
    ],
  },

  build(k) {
    const p = k.p;
    const S = 2.1, X0 = -2.85, Z = -0.85, R = 0.18;
    const FLASH_TS = [0.04, 0.06, 0.08];

    const tbl = at(box(1.4, 1, 1.8, C.wood), X0 - 0.75, 0, Z + 0.3);
    const gun = at(box(0.85, 0.26, 0.38, STEEL, { kind: 'metal' }), X0 - 0.78, 1, Z);
    // 带方格的竖直背景坐标板
    const grid = sheet(6.4, 4.6, (x, s, w, h) => {
      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, w * s, h * s);
      x.strokeStyle = 'rgba(30,43,54,0.14)'; x.lineWidth = s * 0.012;
      for (let m = 0; m <= 3.0; m += 0.2) {
        const px = (0.2 + m * S) * s;
        if (px <= w * s) { x.beginPath(); x.moveTo(px, 0); x.lineTo(px, h * s); x.stroke(); }
      }
      for (let ym = 0; ym <= 2.1; ym += 0.2) {
        const py = (h - 0.1 - ym * S) * s;
        if (py >= 0) { x.beginPath(); x.moveTo(0, py); x.lineTo(w * s, py); x.stroke(); }
      }
    }, { opaque: true });
    grid.position.set(X0 + 2.95, 2.3, Z - 0.32);

    const A = ball(R, C.copper), B = ball(R, STEEL);
    const tA = dots(48, 0.07, C.violet, { flat: true }), tB = dots(48, 0.07, C.amber, { flat: true });
    const vxArr = arrow(C.sky, 0.032), vyArr = arrow(C.leaf, 0.032), vTotArr = arrow(C.ink, 0.035);
    const land = flat(new THREE.RingGeometry(0.18, 0.28, 28).rotateX(-Math.PI / 2), C.copper);
    const info = at(card('\n\n', { w: 3.9, size: 0.28, align: 'left' }), 2.35, 0, 2.25);
    k.root.add(tbl, gun, grid, A, B, tA, tB, vxArr, vyArr, vTotArr, land, info);
    k.root.add(dash([X0, 0.03, Z + 1.55], [X0 + 3.0 * S, 0.03, Z + 1.55], { len: 0.12, gap: 0.12 }));
    for (let i = 0; i <= 3; i++) {
      k.root.add(at(note(`${i} m`, { lay: 'flat', size: 0.26 }), X0 + i * S, 0.03, Z + 1.92));
    }

    const simulatePath = (v0, h0, drag) => {
      const dt = 0.002, cd = drag ? 0.085 : 0;
      const pts = [];
      let t = 0, x = 0, y = h0, vx = v0, vy = 0;
      pts.push({ t, x, y, vx, vy });
      const deriv = (sx, sy, svx, svy) => {
        const spd = Math.hypot(svx, svy);
        return [svx, svy, -cd * spd * svx, -G - cd * spd * svy];
      };
      while (y > 0 && t < 3.0) {
        const [k1x, k1y, k1vx, k1vy] = deriv(x, y, vx, vy);
        const [k2x, k2y, k2vx, k2vy] = deriv(x + 0.5 * dt * k1x, y + 0.5 * dt * k1y, vx + 0.5 * dt * k1vx, vy + 0.5 * dt * k1vy);
        const [k3x, k3y, k3vx, k3vy] = deriv(x + 0.5 * dt * k2x, y + 0.5 * dt * k2y, vx + 0.5 * dt * k2vx, vy + 0.5 * dt * k2vy);
        const [k4x, k4y, k4vx, k4vy] = deriv(x + dt * k3x, y + dt * k3y, vx + dt * k3vx, vy + dt * k3vy);
        const ny = y + (dt / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
        const nx = x + (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
        const nvx = vx + (dt / 6) * (k1vx + 2 * k2vx + 2 * k3vx + k4vx);
        const nvy = vy + (dt / 6) * (k1vy + 2 * k2vy + 2 * k3vy + k4vy);
        if (ny <= 0) {
          const frac = y / Math.max(1e-6, y - ny);
          pts.push({ t: t + frac * dt, x: lerp(x, nx, frac), y: 0, vx: lerp(vx, nvx, frac), vy: lerp(vy, nvy, frac) });
          break;
        }
        t += dt; x = nx; y = ny; vx = nvx; vy = nvy;
        pts.push({ t, x, y, vx, vy });
      }
      return pts;
    };

    const sampleAt = (pts, tt) => {
      if (!pts.length) return { t: 0, x: 0, y: p.h, vx: p.v, vy: 0 };
      if (tt <= 0) return pts[0];
      const last = pts[pts.length - 1];
      if (tt >= last.t) return last;
      const idx = Math.min(pts.length - 2, Math.floor(tt / 0.002));
      const a = pts[idx], b = pts[idx + 1] || a;
      const u = clamp((tt - a.t) / Math.max(1e-6, b.t - a.t));
      return { t: tt, x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), vx: lerp(a.vx, b.vx, u), vy: lerp(a.vy, b.vy, u) };
    };

    let path = [], tCur = 0, paused = false, dragging = false;
    const rebuildPath = () => { path = simulatePath(p.v, p.h, p.dragOn); };
    const fire = () => { rebuildPath(); tCur = 0; paused = false; };
    fire();

    // 直接抓握小球 A 沿轨迹前后拨动飞行时刻
    k.drag(A, {
      normal: 'z',
      start: () => { dragging = true; paused = true; },
      move: (q) => {
        const tf = path[path.length - 1]?.t || 0.5;
        const xM = clamp((q.x - X0) / S, 0, path[path.length - 1]?.x || 2);
        let bestT = 0, bd = 999;
        for (let i = 0; i < path.length; i += 4) {
          const d = Math.abs(path[i].x - xM);
          if (d < bd) { bd = d; bestT = path[i].t; }
        }
        tCur = clamp(bestT, 0, tf);
        k.dirty();
      },
      end: () => { dragging = false; },
    });

    const getStrobes = () => {
      const T = FLASH_TS[p.flashT ?? 0];
      const tf = path[path.length - 1]?.t || 0;
      const out = [];
      for (let i = 0; i * T <= tf + 1e-6 && i < 48; i++) out.push(sampleAt(path, i * T));
      return { T, pts: out };
    };

    const snapshotRow = () => {
      const { T, pts } = getStrobes();
      const last = path[path.length - 1] || { t: 0, x: 0 };
      let gEst = G;
      if (pts.length >= 3) {
        const i = Math.floor(pts.length / 2);
        const y0 = p.h - pts[i - 1].y, y1 = p.h - pts[i].y, y2 = p.h - pts[i + 1].y;
        gEst = ((y2 - y1) - (y1 - y0)) / (T * T);
      }
      return {
        _kind: p.dragOn ? 'model' : 'theory',
        model: p.dragOn ? '有空气阻力' : '理想真空',
        v0: p.v, h: p.h, tf: last.t, range: last.x, gEst,
      };
    };

    return {
      getPath: () => path,
      getStrobes,
      snapshotRow,
      press(id) {
        if (id === 'fireBtn') fire();
        else if (id === 'pauseBtn') paused = !paused;
      },
      change: fire,
      update(dt) {
        const tf = path[path.length - 1]?.t || Math.sqrt(2 * p.h / G);
        tbl.scale.y = p.h * S;
        gun.position.y = p.h * S;
        if (!paused && !dragging && dt > 0) {
          tCur += dt * 0.45;
          if (tCur > tf + 1.1) tCur = 0;
        }
        const tt = Math.min(tCur, tf);
        const st = sampleAt(path, tt);
        const yVac = Math.max(0, p.h - 0.5 * G * tt * tt);
        A.position.set(X0 + st.x * S, st.y * S + R, Z);
        B.position.set(X0 + 0.15, yVac * S + R, Z + 1.0);

        const vs = 0.25;
        vxArr.set([A.position.x, A.position.y, Z], [A.position.x + st.vx * vs, A.position.y, Z]);
        vyArr.set([A.position.x, A.position.y, Z], [A.position.x, A.position.y + st.vy * vs, Z]);
        vTotArr.set([A.position.x, A.position.y, Z], [A.position.x + st.vx * vs, A.position.y + st.vy * vs, Z]);

        const { T, pts } = getStrobes();
        for (let i = 0; i < 48; i++) {
          if (i < pts.length && pts[i].t <= tt + 1e-6) {
            const pt = pts[i], yv = Math.max(0, p.h - 0.5 * G * pt.t * pt.t);
            tA.put(i, X0 + pt.x * S, pt.y * S + R, Z);
            tB.put(i, X0 + 0.15, yv * S + R, Z + 1.0);
          } else {
            tA.put(i, 0, -50, 0, 0.001); tB.put(i, 0, -50, 0, 0.001);
          }
        }
        tA.done(); tB.done();
        const last = path[path.length - 1] || { x: 0, t: tf };
        land.position.set(X0 + last.x * S, 0.03, Z);
        info.set(
          `t = ${tt.toFixed(2)} / ${tf.toFixed(2)} s · 频闪 T = ${T.toFixed(2)} s\n`
          + `射程 x = ${last.x.toFixed(2)} m · vx = ${st.vx.toFixed(2)} m/s\n`
          + (p.dragOn ? '空气阻力已开启（RK4 数值积分）' : '理想平抛（拖紫铜球可回看分速度）'),
        );
      },
      margin() {
        const last = path[path.length - 1] || { t: 0, x: 0, vx: p.v, vy: 0 };
        return [
          `t_落 = ${last.t.toFixed(3)} s`,
          `射程 x = ${last.x.toFixed(3)} m`,
          `落地 vx = ${last.vx.toFixed(2)} m/s`,
          `落地 |vy| = ${Math.abs(last.vy).toFixed(2)} m/s`,
          p.dragOn ? '二次阻尼使射程缩短' : `理想射程 v₀√(2h/g)=${(p.v * Math.sqrt(2 * p.h / G)).toFixed(3)}m`,
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 频闪坐标板与 Δy = gT² 二次逐差求解器');
    let selIdx = 2;
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn primary" data-wb="fire">重新发射</button>
      <button type="button" class="wb-btn" data-wb="record">计入本次反演结果</button>`;
    sec1.append(bar);

    const cv = wb.canvas(sec1, 520, 270, (x, W, H) => {
      const p = sp.params;
      const path = sp.inst?.getPath?.() || [];
      const strobes = sp.inst?.getStrobes?.() || { T: 0.04, pts: [] };
      const pts = strobes.pts;
      const pad = { l: 48, r: 22, t: 22, b: 34 };
      const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      const maxX = Math.max(2.5, p.v * Math.sqrt(2 * p.h / G) * 1.15);
      const sx = (xm) => pad.l + (xm / maxX) * pw;
      const sy = (ym) => pad.t + ((p.h - ym) / Math.max(0.5, p.h * 1.05)) * ph;

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      x.strokeStyle = 'rgba(30,43,54,0.1)'; x.lineWidth = 1;
      for (let xm = 0; xm <= maxX; xm += 0.5) { x.beginPath(); x.moveTo(sx(xm), pad.t); x.lineTo(sx(xm), pad.t + ph); x.stroke(); }
      for (let ym = 0; ym <= p.h; ym += 0.25) { x.beginPath(); x.moveTo(pad.l, sy(ym)); x.lineTo(pad.l + pw, sy(ym)); x.stroke(); }

      x.strokeStyle = C.ink; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();

      // 真空理想参考虚线
      x.save(); x.setLineDash([5, 4]); x.strokeStyle = C.copper; x.lineWidth = 1.8; x.beginPath();
      const tfVac = Math.sqrt(2 * p.h / G);
      for (let i = 0; i <= 50; i++) {
        const tt = (i / 50) * tfVac;
        const px = sx(p.v * tt), py = sy(p.h - 0.5 * G * tt * tt);
        if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.stroke(); x.restore();

      // 当前轨迹实线
      if (path.length) {
        x.strokeStyle = C.ink; x.lineWidth = 2; x.beginPath();
        path.forEach((pt, i) => (i === 0 ? x.moveTo(sx(pt.x), sy(pt.y)) : x.lineTo(sx(pt.x), sy(pt.y))));
        x.stroke();
      }

      const k = clamp(selIdx, 1, Math.max(1, pts.length - 2));
      pts.forEach((pt, i) => {
        const active = i >= k - 1 && i <= k + 1 && pts.length >= 3;
        x.fillStyle = i === k ? '#1f4a3e' : active ? C.copper : C.violet;
        x.beginPath(); x.arc(sx(pt.x), sy(pt.y), i === k ? 5.5 : 4, 0, TAU); x.fill();
      });

      x.fillStyle = '#51606b'; x.font = '11px Georgia,serif'; x.textAlign = 'center';
      x.fillText('水平位移 x (m)', pad.l + pw / 2, H - 6);
      x.textAlign = 'left';
      x.fillText('点击任一频闪点检验相邻三点逐差 Δ²y = gT²', pad.l + 8, pad.t + 14);
    });

    const out = document.createElement('div');
    out.className = 'wb-metrics';
    sec1.append(out);

    const refresh = () => {
      cv.redraw();
      const strobes = sp.inst?.getStrobes?.() || { T: 0.04, pts: [] };
      const T = strobes.T, pts = strobes.pts, p = sp.params;
      if (pts.length >= 3) {
        const k = clamp(selIdx, 1, pts.length - 2);
        const a = pts[k - 1], b = pts[k], c = pts[k + 1];
        const dx1 = b.x - a.x, dx2 = c.x - b.x;
        const dy1 = a.y - b.y, dy2 = b.y - c.y, d2y = dy2 - dy1;
        const gCalc = d2y / (T * T);
        const v0Calc = (c.x - a.x) / (2 * T);
        out.innerHTML = `
          <div class="wb-m"><span>选中频闪三点</span><b>n = ${k - 1}, ${k}, ${k + 1} (T=${T.toFixed(2)}s)</b></div>
          <div class="wb-m"><span>水平间隔 Δx₁ / Δx₂</span><b>${(dx1 * 100).toFixed(2)} / ${(dx2 * 100).toFixed(2)} cm</b></div>
          <div class="wb-m"><span>竖直逐差 Δ²y = Δy₂−Δy₁</span><b>${(d2y * 100).toFixed(2)} cm → g=${gCalc.toFixed(2)} m/s²</b></div>
          <div class="wb-m"><span>中心差分 vₓ = Δx/(2T)</span><b>${v0Calc.toFixed(3)} m/s (初设 ${p.v.toFixed(2)})</b></div>`;
      } else {
        out.innerHTML = `<div class="wb-m"><span>提示</span><b>频闪点不足 3 个，请增大桌高或减小 T</b></div>`;
      }
    };

    cv.cv.addEventListener('pointerdown', (e) => {
      const pt = cv.toLocal(e);
      const strobes = sp.inst?.getStrobes?.() || { pts: [] };
      const p = sp.params;
      const maxX = Math.max(2.5, p.v * Math.sqrt(2 * p.h / G) * 1.15);
      const sx = (xm) => 48 + (xm / maxX) * (520 - 70);
      let best = selIdx, bd = 999;
      strobes.pts.forEach((q, i) => {
        if (i >= 1 && i <= strobes.pts.length - 2) {
          const d = Math.abs(sx(q.x) - pt.x);
          if (d < bd) { bd = d; best = i; }
        }
      });
      if (bd < 30) { selIdx = best; refresh(); }
    });

    bar.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.wb;
      if (act === 'fire') wb.press('fireBtn');
      else if (act === 'record') {
        const row = sp.inst?.snapshotRow?.();
        if (row) wb.record(row);
      }
      refresh();
    });

    refresh();
    return { update() { refresh(); } };
  },
};

// ================================================================ 6. 探究向心力大小与半径、角速度、质量的关系 (L3)
export const centripetal = {
  id: 'phy-centripetal',
  subject: 'phy',
  title: '探究向心力大小与半径、角速度、质量的关系',
  en: 'Centripetal force demonstrator',
  lede: [
    '摇动向心力演示器手柄，皮带带动左右两个变速塔轮转动；槽内小球所需向心力推动中央弹簧测力套筒露出等分刻度格。',
    '用控制变量法对比左右两臂的球质 m、半径 r 与塔轮角速度比 ω₁:ω₂，在工作台分别绘制 Fₙ–ω²、Fₙ–r、Fₙ–m 线性检验图。',
  ],
  formula: 'Fₙ = mω²r = mv² / r',
  formulaNote: '弹簧套筒露出格数正比于向心力 Fₙ；塔轮半径比决定 ω₁:ω₂（1:1、1:2 或 2:1）',
  terms: [
    ['塔轮变速比', '皮带传动的两轮线速度相同 v₁ = v₂，故角速度 ω₁/ω₂ = R₂/R₁。'],
    ['标尺套筒', '中央弹簧受横向压臂挤压而向上弹出，露出格数 n ∝ Fₙ。'],
    ['控制变量法', '每次固定其中两个物理量，只改变第三个量观察向心力比例变化。'],
  ],
  predict: {
    q: '左右两槽放入质量相同的钢球且半径相同（r₁ = r₂），若皮带挂在使右轮角速度为左轮 2 倍的塔轮上（ω₂ = 2ω₁），右标尺露出的向心力格数是左标尺的几倍？',
    options: ['2 倍', '4 倍', '一半'],
    answer: 1,
    why: '由 Fₙ = mω²r 可知，当 m 与 r 均相同时，向心力与角速度的平方成正比，ω 变为 2 倍，Fₙ 变为 2² = 4 倍。',
  },
  challenge: '设定左臂 0.15 kg @ r₁=0.16 m、右臂 0.15 kg @ r₂=0.08 m，选择哪组塔轮传动比能使左右两侧标尺露出格数（Fₙ）恰好相等？在工作台检验 Fₙ–ω² 直线！',
  fig: '双塔轮皮带传动底座、左右旋转横臂、测试球与中央弹簧标尺套筒',
  hint: '左右拖动摇把加速或减速；切换塔轮比及左右球质量与半径，按“读取两侧标尺格数”入册。',
  teach: {
    where: '人教版物理必修第二册第六章 §6.2《向心力》（学生必做实验 7：探究向心力大小的表达式）',
    ask: [
      '皮带传动不打滑时，左右两塔轮边缘线速度相同还是角速度相同？若左轮半径是右轮的 2 倍，ω₁:ω₂ 为多少？',
      '为什么课本实验中要用“露出格数比”而非直接以牛顿为单位读数？如何转换为 Fₙ–ω² 线性验证？',
    ],
    simplify: '设每格对应标尺常数 0.25 N（满量程 12 格 = 3.0 N），皮带无打滑，左右两臂独立计算 Fₙ = mω²r。',
    safety: '高速旋转前确认挡板插销扣紧，防止金属球甩出。',
  },
  controls: [
    { id: 'mLeft', label: '左臂球质量 m₁', type: 'choice', options: ['铝 0.05 kg', '钢 0.15 kg', '铜 0.25 kg'], value: 1 },
    { id: 'mRight', label: '右臂球质量 m₂', type: 'choice', options: ['铝 0.05 kg', '钢 0.15 kg', '铜 0.25 kg'], value: 1 },
    { id: 'rLeft', label: '左臂半径 r₁', min: 0.08, max: 0.24, step: 0.02, value: 0.16, unit: 'm' },
    { id: 'rRight', label: '右臂半径 r₂', min: 0.08, max: 0.24, step: 0.02, value: 0.16, unit: 'm' },
    { id: 'ratio', label: '塔轮传动比', type: 'choice', options: ['ω₁:ω₂ = 1:1', 'ω₁:ω₂ = 1:2', 'ω₁:ω₂ = 2:1'], value: 0 },
    { id: 'omega', label: '基准角速度 ω₀', min: 2.0, max: 10.0, step: 0.5, value: 5.0, unit: 'rad/s' },
    { id: 'recBtn', label: '读取两侧标尺格数', type: 'button' },
  ],
  record: {
    note: '记下左右两臂的质量 m、半径 r、角速度 ω、向心力 Fₙ 及套筒露出格数，对比比例关系。',
    pending: '按“读取两侧标尺格数”同步记录左右臂测量组。',
    columns: [
      { key: 'arm', label: '臂位' },
      { key: 'm', label: '质量 m', unit: 'kg', digits: 2 },
      { key: 'r', label: '半径 r', unit: 'm', digits: 2 },
      { key: 'omega', label: '角速度 ω', unit: 'rad/s', digits: 1 },
      { key: 'F', label: '向心力 Fₙ', unit: 'N', digits: 3, stat: true },
      { key: 'divs', label: '标尺格数', unit: '格', digits: 2 },
    ],
    sample: (inst) => inst.sampleSide?.(0) || null,
    summary: (rows) => [
      ['已采集测点', `${rows.length} 组`],
      ['最大实测向心力', rows.length ? `${Math.max(...rows.map((r) => r.F)).toFixed(3)} N` : '—'],
    ],
    errors: [
      '传动皮带若轻微打滑会导致从动轮实际角速度略低于理论塔轮比。',
      '横槽内微摩擦使标尺套筒在静止/启动瞬间存在微小滞回误差。',
    ],
  },

  build(k) {
    const p = k.p;
    const MASSES = [0.05, 0.15, 0.25];
    const RATIOS = [[1, 1], [1, 2], [2, 1]];
    const COLS = ['#d8dde2', '#8f9aa3', C.copper];
    const DIV_N = 0.25; // 每格 0.25 N
    const RS = 6.2;     // 1 m -> 6.2 world units
    const XL = -1.9, XR = 1.9, Z = -0.75, YBASE = 0.26;

    // 底座 + 摇柄驱动轮
    k.root.add(
      at(box(6.4, 0.26, 2.5, '#e8e2d5'), 0, 0, Z),
      at(box(5.6, 0.14, 1.5, '#46525c'), 0, 0.26, Z),
    );
    const crank = group(
      rot(at(cyl(0.45, 0.14, BRASS, { seg: 24 }), 0, 0, 0), Math.PI / 2, 0, 0),
      at(box(0.08, 0.45, 0.08, STEEL, { kind: 'metal' }), 0, 0.22, 0.10),
      at(cyl(0.07, 0.24, C.copper, { seg: 12 }), 0, 0.45, 0.22),
    );
    crank.position.set(0, 0.85, Z + 0.95);
    k.root.add(crank);

    const mkTower = (xPos) => {
      const g = new THREE.Group();
      g.position.set(xPos, YBASE + 0.14, Z);
      const shaft = at(cyl(0.07, 2.35, STEEL, { seg: 16 }), 0, 0, 0);
      const pulleyA = at(cyl(0.32, 0.14, BRASS, { seg: 20 }), 0, 0.25, 0);
      const pulleyB = at(cyl(0.18, 0.14, BRASS, { seg: 20 }), 0, 0.42, 0);
      const armGrp = new THREE.Group();
      armGrp.position.y = 1.65;
      const tray = at(box(3.2, 0.10, 0.44, '#cfd6dc'), 0, 0, 0);
      const wallL = at(box(0.12, 0.36, 0.44, '#505b66'), -1.55, 0.10, 0);
      const wallR = at(box(0.12, 0.36, 0.44, '#505b66'), 1.55, 0.10, 0);
      const testBall = ball(0.20, STEEL);
      const fArrow = arrow(C.red, 0.036);
      armGrp.add(tray, wallL, wallR, testBall, fArrow);
      // 弹出式标尺套筒
      const sleeve = at(box(0.22, 0.85, 0.22, '#fffdf7'), 0, 1.75, 0);
      const scaleFlag = at(box(0.16, 0.70, 0.16, C.copper), 0, 2.0, 0);
      g.add(shaft, pulleyA, pulleyB, armGrp, sleeve, scaleFlag);
      g.armGrp = armGrp; g.testBall = testBall; g.fArrow = fArrow; g.scaleFlag = scaleFlag;
      return g;
    };
    const leftT = mkTower(XL), rightT = mkTower(XR);
    const belt = strip(3, { color: C.ink, w: 0.06, opacity: 0.75, normal: [0, 1, 0] });
    const info = at(card('\n\n', { w: 4.5, size: 0.26, align: 'left' }), 0, 0.02, 2.25);
    k.root.add(leftT, rightT, belt, info);

    let ang1 = 0, ang2 = 0, angCrank = 0, lastX = null;
    k.drag(crank, {
      normal: 'z',
      start: () => { lastX = null; },
      move: (q) => {
        if (lastX === null) { lastX = q.x; return; }
        const nw = clamp(Math.round((p.omega + (q.x - lastX) * 1.8) * 2) / 2, 2.0, 10.0);
        lastX = q.x;
        p.omega = nw; k.set('omega', nw); k.dirty();
      },
    });

    const state = () => {
      const [k1, k2] = RATIOS[p.ratio ?? 0];
      const w1 = p.omega * k1, w2 = p.omega * k2;
      const m1 = MASSES[p.mLeft ?? 1], m2 = MASSES[p.mRight ?? 1];
      const r1 = p.rLeft, r2 = p.rRight;
      const F1 = m1 * w1 * w1 * r1, F2 = m2 * w2 * w2 * r2;
      return { m1, m2, r1, r2, w1, w2, F1, F2, d1: F1 / DIV_N, d2: F2 / DIV_N };
    };

    const sampleSide = (idx) => {
      const s = state();
      return idx === 0
        ? { _kind: 'model', arm: '左臂', m: s.m1, r: s.r1, omega: s.w1, F: s.F1, divs: s.d1 }
        : { _kind: 'model', arm: '右臂', m: s.m2, r: s.r2, omega: s.w2, F: s.F2, divs: s.d2 };
    };

    const drawVisuals = () => {
      const s = state();
      leftT.armGrp.rotation.y = ang1;
      rightT.armGrp.rotation.y = ang2;
      crank.rotation.z = angCrank;
      const p1 = s.r1 * RS, p2 = s.r2 * RS;
      leftT.testBall.position.set(p1, 0.25, 0);
      leftT.testBall.material.color.set(COLS[p.mLeft ?? 1]);
      rightT.testBall.position.set(p2, 0.25, 0);
      rightT.testBall.material.color.set(COLS[p.mRight ?? 1]);
      leftT.fArrow.set([p1, 0.25, 0], [Math.max(0.05, p1 - clamp(s.F1 * 0.28, 0.15, 1.1)), 0.25, 0]);
      rightT.fArrow.set([p2, 0.25, 0], [Math.max(0.05, p2 - clamp(s.F2 * 0.28, 0.15, 1.1)), 0.25, 0]);
      leftT.scaleFlag.position.y = 2.0 + clamp(s.d1 / 14, 0, 1.1);
      rightT.scaleFlag.position.y = 2.0 + clamp(s.d2 / 14, 0, 1.1);
      const yBelt = p.ratio === 0 ? 0.65 : p.ratio === 1 ? 0.80 : 0.65;
      belt.set([[XL, yBelt, Z + 0.18], [XR, p.ratio === 2 ? 0.80 : yBelt, Z + 0.18], [XR, p.ratio === 2 ? 0.80 : yBelt, Z - 0.18]]);
      info.set(
        `左臂: m₁=${s.m1}kg r₁=${s.r1.toFixed(2)}m ω₁=${s.w1.toFixed(1)} → F₁=${s.F1.toFixed(2)}N (${s.d1.toFixed(1)}格)\n`
        + `右臂: m₂=${s.m2}kg r₂=${s.r2.toFixed(2)}m ω₂=${s.w2.toFixed(1)} → F₂=${s.F2.toFixed(2)}N (${s.d2.toFixed(1)}格)\n`
        + `比值 F₁ : F₂ = 1 : ${(s.F2 / Math.max(1e-4, s.F1)).toFixed(2)}`,
      );
    };

    drawVisuals();
    return {
      state,
      sampleSide,
      press(id) {
        if (id === 'recBtn') {
          k.record(sampleSide(0));
          k.record(sampleSide(1));
        }
      },
      change: drawVisuals,
      update(dt) {
        const s = state();
        if (dt > 0) {
          ang1 = (ang1 + s.w1 * dt * 0.65) % TAU;
          ang2 = (ang2 + s.w2 * dt * 0.65) % TAU;
          angCrank = (angCrank - p.omega * dt * 0.65) % TAU;
        }
        drawVisuals();
      },
      margin() {
        const s = state();
        return [
          `ω₁:ω₂ = ${['1:1', '1:2', '2:1'][p.ratio ?? 0]}`,
          `F₁ = ${s.F1.toFixed(3)} N (${s.d1.toFixed(1)} 格)`,
          `F₂ = ${s.F2.toFixed(3)} N (${s.d2.toFixed(1)} 格)`,
          `比例 F₁/F₂ = ${(s.F1 / Math.max(1e-5, s.F2)).toFixed(2)}`,
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 控制变量法线性检验：Fₙ–ω² / Fₙ–r / Fₙ–m');
    let varMode = 'w2'; // 'w2' | 'r' | 'm'
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn primary" data-wb="w2">控 m,r 扫 Fₙ–ω²</button>
      <button type="button" class="wb-btn" data-wb="r">控 m,ω 扫 Fₙ–r</button>
      <button type="button" class="wb-btn" data-wb="m">控 r,ω 扫 Fₙ–m</button>
      <button type="button" class="wb-btn" data-wb="logCur">采录当前左右臂</button>`;
    sec1.append(bar);

    const chart = wb.regressionChart(sec1, {
      w: 520, h: 240, xLabel: 'ω² (rad²/s²)', yLabel: '向心力 Fₙ (N)', xRange: [0, 110], yRange: [0, 4.0],
    });
    const out = document.createElement('div');
    out.className = 'wb-metrics';
    sec1.append(out);

    const refresh = () => {
      const p = sp.params, rows = wb.rows();
      const MASSES = [0.05, 0.15, 0.25];
      const m1 = MASSES[p.mLeft ?? 1], r1 = p.rLeft, w1 = p.omega;
      const pts = rows.filter((r) => Number.isFinite(r.F)).map((r) => {
        const xv = varMode === 'w2' ? r.omega * r.omega : varMode === 'r' ? r.r : r.m;
        return [xv, r.F, r._kind || 'model'];
      });
      const maxX = Math.max(varMode === 'w2' ? 105 : varMode === 'r' ? 0.26 : 0.28, ...pts.map((q) => q[0] * 1.15));
      const maxY = Math.max(3.0, ...pts.map((q) => q[1] * 1.2));
      const theorySlope = varMode === 'w2' ? m1 * r1 : varMode === 'r' ? m1 * w1 * w1 : w1 * w1 * r1;
      chart.redraw({
        pts,
        xRange: [0, maxX],
        yRange: [0, maxY],
        theoryFn: (xv) => theorySlope * xv,
      });
      const reg = linearRegression(pts);
      out.innerHTML = `
        <div class="wb-m"><span>当前检验变量</span><b>${varMode === 'w2' ? 'Fₙ vs ω²' : varMode === 'r' ? 'Fₙ vs r' : 'Fₙ vs m'}</b></div>
        <div class="wb-m"><span>理论斜率</span><b>${theorySlope.toFixed(4)}</b></div>
        <div class="wb-m"><span>拟合斜率</span><b>${reg ? reg.k.toFixed(4) : '需 ≥2 组点'}</b></div>
        <div class="wb-m"><span>线性度 R²</span><b>${reg ? reg.r2.toFixed(4) : '—'}</b></div>`;
    };

    bar.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.wb;
      if (!act) return;
      const p = sp.params;
      const MASSES = [0.05, 0.15, 0.25];
      const m1 = MASSES[p.mLeft ?? 1];
      if (act === 'w2') {
        varMode = 'w2';
        [2, 4, 6, 8, 10].forEach((w) => wb.record({ _kind: 'model', arm: '扫ω²', m: m1, r: p.rLeft, omega: w, F: m1 * w * w * p.rLeft, divs: (m1 * w * w * p.rLeft) / 0.25 }));
      } else if (act === 'r') {
        varMode = 'r';
        [0.08, 0.12, 0.16, 0.20, 0.24].forEach((rr) => wb.record({ _kind: 'model', arm: '扫r', m: m1, r: rr, omega: p.omega, F: m1 * p.omega * p.omega * rr, divs: (m1 * p.omega * p.omega * rr) / 0.25 }));
      } else if (act === 'm') {
        varMode = 'm';
        MASSES.forEach((mm) => wb.record({ _kind: 'model', arm: '扫m', m: mm, r: p.rLeft, omega: p.omega, F: mm * p.omega * p.omega * p.rLeft, divs: (mm * p.omega * p.omega * p.rLeft) / 0.25 }));
      } else if (act === 'logCur') {
        wb.press('recBtn');
      }
      refresh();
    });

    refresh();
    return { update() { refresh(); } };
  },
};

// ================================================================ 7. 验证机械能守恒定律 (L3)
export const energyConservation = {
  id: 'phy-energy-conservation',
  subject: 'phy',
  title: '验证机械能守恒定律',
  en: 'Conservation of mechanical energy',
  lede: [
    '重锤拖着纸带由静止自由下落，50 Hz 打点计时器把不同时刻的下落高度 hₙ 印在纸带上。必须先用前后两点中心差分测出瞬时速度 vₙ，再比对减小的势能 mghₙ 与增加的动能 ½mvₙ²！',
    '严禁反过来用 v = √(2gh) 算速度去“验证”守恒！可调空气阻尼与限位孔摩擦 η 观察真实世界中 ΔEₖ 总略小于 ΔEₚ 的能量耗散。',
  ],
  formula: 'ΔEₚ = mghₙ · ΔEₖ = ½mvₙ² · vₙ = (hₙ₊₁ − hₙ₋₁) / (2T)',
  formulaNote: '严禁使用 v = √(2gh) 循环论证；以中心差分测量值 vₙ 检验 mghₙ 与 ½mvₙ² 的偏差 ΔE_loss',
  terms: [
    ['中心差分测速', '第 n 计数点瞬时速度由相邻两位置差 (hₙ₊₁ − hₙ₋₁)/(2T) 直接算出。'],
    ['禁止循环论证', '若直接代 v = gt 或 v = √(2gh)，相当于默认了加速度等于 g 而丧失验证意义。'],
    ['机械能损失', '空气阻力与限位孔摩擦做负功，使 ΔEₖ = ΔEₚ − W_f 略小于 ΔEₚ。'],
  ],
  predict: {
    q: '某同学在实验报告中为了求第 4 点的动能，直接写下“由自由落体公式 v₄ = √(2gh₄)，故 ½mv₄² = mgh₄，机械能完全守恒”。这种做法的问题在于？',
    options: ['计算结果多乘了一个 m', '循环论证：未由纸带测量瞬时速度，等于用待验证结论证明自身', 'g 应该取 10 m/s²'],
    answer: 1,
    why: '自由落体公式 v = √(2gh) 本身就隐含了无阻力且机械能守恒的前提。实验中必须从纸带几何位置差分测量 vₙ，再将 ½mvₙ² 与 mghₙ 比较才能构成有效验证。',
  },
  challenge: '调阻力系数 η = 0.04，在工作台画出 v²–h 图像，用回归斜率求出有效加速度 g_eff 及机械能转化效率（应约为 96%）。',
  fig: '高架铁架台、50 Hz 打点计时器、重锤纸带与实时势能/动能柱',
  hint: '直接上下拖拽重锤改变初始高度 H，松手即开始下落打点；或点击“接通电源释放重锤”。',
  teach: {
    where: '人教版物理必修第二册第八章 §8.4《实验：验证机械能守恒定律》（学生必做实验 5）',
    ask: [
      '为什么测量数据总表现为减小的重力势能略大于增加的动能（ΔEₚ > ΔEₖ）？',
      '如果将 vₙ² 对下落高度 hₙ 作图，理想机械能守恒对应怎样一条直线？斜率是多少？',
    ],
    simplify: '设竖直下落有效加速度 a_fall = g(1 − η)，由 50 Hz 打点序列叠加 ±0.4 mm 读数抖动通过中心差分直接计算 vₙ，绝不引用理论值 √(2gh)。',
    safety: '重锤质量较大，下落底座需垫缓冲海绵垫，手勿伸入重锤正下方。',
  },
  controls: [
    { id: 'mass', label: '重锤质量 m', min: 0.10, max: 0.50, step: 0.05, value: 0.20, unit: 'kg' },
    { id: 'hMax', label: '下落高度 H', min: 0.60, max: 1.40, step: 0.05, value: 1.00, unit: 'm' },
    { id: 'dragCoef', label: '空气阻力与摩擦 η', min: 0.00, max: 0.12, step: 0.01, value: 0.03 },
    { id: 'dropBtn', label: '接通电源释放重锤', type: 'button' },
    { id: 'resetBtn', label: '重挂重锤', type: 'button' },
  ],
  record: {
    note: '记录各打点高度 hₙ、中心差分速度 vₙ、势能减少 ΔEₚ 与动能增加 ΔEₖ，核算机械能损耗率。',
    pending: '释放重锤打点后即可采样各计数点验证机械能守恒。',
    columns: [
      { key: 'n', label: '点号 n', digits: 0 },
      { key: 'h', label: '高度 hₙ', unit: 'm', digits: 3 },
      { key: 'v', label: '测速 vₙ', unit: 'm/s', digits: 3 },
      { key: 'v2', label: 'vₙ²', unit: 'm²/s²', digits: 2 },
      { key: 'dEp', label: 'ΔEₚ = mgh', unit: 'J', digits: 4 },
      { key: 'dEk', label: 'ΔEₖ = ½mv²', unit: 'J', digits: 4 },
      { key: 'lossPct', label: '耗散率', unit: '%', digits: 2, stat: true },
    ],
    sample: (inst) => inst.latestSample?.() || null,
    summary: (rows) => {
      const reg = linearRegression(rows.map((r) => [r.h, r.v2]));
      return [
        ['已采集点位', `${rows.length} 个`],
        ['v²–h 拟合斜率 (理论 2g=19.6)', reg ? `${reg.k.toFixed(2)} m/s² (R²=${reg.r2.toFixed(4)})` : '需 ≥2 点'],
      ];
    },
    errors: [
      '纸带与限位孔摩擦及空气阻力使 ΔEₖ 略小于 ΔEₚ（通常小 1%–5%）。',
      '用开头第 1–2 个密集点或尺读估读 ±0.4 mm 会使初段相对误差偏大。',
    ],
  },

  build(k) {
    const p = k.p;
    const rand = rng(804);
    const X = -1.65, Z = -0.85, TOPY = 5.65, S = 3.2;

    k.root.add(
      at(stand(6.3, 1.9), X - 0.9, 0, Z),
      at(box(0.55, 0.36, 0.45, '#414c56'), X, TOPY - 0.1, Z),
      at(box(1.1, 0.14, 0.9, '#b8c0c6'), X, 0.08, Z),
    );
    const bob = group(
      at(cyl(0.22, 0.46, BRASS, { seg: 20 }), 0, 0, 0),
      at(cone(0.22, 0.16, BRASS, { seg: 20 }), 0, -0.16, 0),
    );
    const tape = at(box(0.16, 1, 0.014, '#fffdf7'), X, TOPY, Z + 0.06);
    const dotPool = dots(60, 0.025, C.ink, { flat: true });

    // 侧立实时能量柱状塔
    const EX = 1.1;
    const barEp = at(box(0.45, 1, 0.45, C.copper), EX, 0.1, Z);
    const barEk = at(box(0.45, 1, 0.45, '#1f4a3e'), EX + 0.72, 0.1, Z);
    const barLoss = at(box(0.45, 1, 0.45, C.amber), EX + 1.44, 0.1, Z);
    k.root.add(
      at(note('ΔEₚ', { size: 0.24, color: C.copper }), EX, 3.6, Z),
      at(note('ΔEₖ', { size: 0.24, color: '#1f4a3e' }), EX + 0.72, 3.6, Z),
      at(note('ΔE_损', { size: 0.24, color: C.amber }), EX + 1.44, 3.6, Z),
    );
    const info = at(card('\n\n', { w: 4.1, size: 0.27, align: 'left' }), 2.2, 0.02, 2.1);
    k.root.add(bob, tape, dotPool, barEp, barEk, barLoss, info);

    let running = false, t = 0, hFall = 0, vFall = 0, nextDotT = 0;
    const rawPts = []; // { n, t, hTrue, hRead }

    const clearPts = () => {
      rawPts.length = 0;
      for (let i = 0; i < 60; i++) dotPool.put(i, 0, -50, 0, 0.001);
      dotPool.done();
    };

    const reset = (start = false) => {
      running = start; t = 0; hFall = 0; vFall = 0;
      clearPts();
      if (start) {
        rawPts.push({ n: 0, t: 0, hTrue: 0, hRead: 0 });
        nextDotT = 0.02;
      }
    };

    const step = (dt) => {
      const a = G * (1 - p.dragCoef);
      const sub = Math.max(1, Math.ceil(dt / 0.002));
      const hh = dt / sub;
      for (let i = 0; i < sub; i++) {
        if (!running) break;
        const vn = vFall + a * hh;
        hFall += 0.5 * (vFall + vn) * hh;
        vFall = vn;
        t += hh;
        while (t + 1e-6 >= nextDotT && hFall <= p.hMax && rawPts.length < 55) {
          const jit = (rand() - 0.5) * 0.0008;
          rawPts.push({ n: rawPts.length, t: nextDotT, hTrue: hFall, hRead: Math.max(0, hFall + jit) });
          nextDotT += 0.02;
        }
        if (hFall >= p.hMax) { hFall = p.hMax; running = false; break; }
      }
    };

    // 预生成演示落体记录
    const prefill = () => {
      reset(true);
      while (running && rawPts.length < 55) step(0.005);
      running = false;
    };
    prefill();

    const getMeasured = () => {
      const out = [];
      for (let i = 2; i < rawPts.length - 1; i += 2) {
        const prev = rawPts[i - 1], cur = rawPts[i], next = rawPts[i + 1];
        const vMeas = (next.hRead - prev.hRead) / (next.t - prev.t); // 严格中心差分，禁止用 √(2gh)
        const dEp = p.mass * G * cur.hRead;
        const dEk = 0.5 * p.mass * vMeas * vMeas;
        const lossPct = dEp > 1e-5 ? ((dEp - dEk) / dEp) * 100 : 0;
        out.push({ n: cur.n, t: cur.t, h: cur.hRead, v: vMeas, v2: vMeas * vMeas, dEp, dEk, lossPct });
      }
      return out;
    };

    let dragY0 = null, hStart = 1.0;
    k.drag(bob, {
      normal: 'z',
      start: () => { dragY0 = null; hStart = p.hMax; running = false; },
      move: (q) => {
        if (dragY0 === null) { dragY0 = q.y; return; }
        const nh = clamp(Math.round((hStart + (q.y - dragY0) / S) * 20) / 20, 0.60, 1.40);
        p.hMax = nh; k.set('hMax', nh); reset(false); k.dirty();
      },
      end: () => { dragY0 = null; reset(true); k.dirty(); },
    });

    const drawVisuals = () => {
      const bobY = Math.max(0.45, TOPY - 0.5 - hFall * S);
      bob.position.set(X, bobY, Z);
      const tapeH = Math.max(0.2, TOPY - bobY);
      tape.scale.y = tapeH;
      tape.position.set(X, bobY + tapeH * 0.5, Z + 0.06);
      for (let i = 0; i < 60; i++) {
        if (i < rawPts.length) {
          const py = bobY + (hFall - rawPts[i].hTrue) * S + 0.35;
          if (py <= TOPY - 0.1) dotPool.put(i, X, py, Z + 0.08);
          else dotPool.put(i, 0, -50, 0, 0.001);
        } else dotPool.put(i, 0, -50, 0, 0.001);
      }
      dotPool.done();

      const meas = getMeasured();
      const last = meas[meas.length - 1];
      const eMax = Math.max(1.0, p.mass * G * p.hMax);
      const epNow = last ? last.dEp : p.mass * G * hFall;
      const ekNow = last ? last.dEk : 0.5 * p.mass * vFall * vFall;
      const elNow = Math.max(0, epNow - ekNow);
      barEp.scale.y = clamp((epNow / eMax) * 3.0, 0.02, 3.3);
      barEk.scale.y = clamp((ekNow / eMax) * 3.0, 0.02, 3.3);
      barLoss.scale.y = clamp((elNow / eMax) * 3.0, 0.02, 3.3);

      info.set(
        last
          ? `第 ${last.n} 点 (h=${last.h.toFixed(3)}m) · 中心差分 v=${last.v.toFixed(2)}m/s\nΔEₚ = ${last.dEp.toFixed(4)} J vs ΔEₖ = ${last.dEk.toFixed(4)} J\n耗散率 ${last.lossPct.toFixed(2)}% (非 √2gh 伪验证)`
          : `悬锤待释放 · 设定总高度 H = ${p.hMax.toFixed(2)} m\n按“接通电源释放重锤”开始打点`,
      );
    };

    drawVisuals();
    return {
      getMeasured,
      latestSample() {
        const m = getMeasured();
        if (!m.length) return null;
        return { _kind: 'simulated', ...m[m.length - 1] };
      },
      press(id) {
        if (id === 'dropBtn') { reset(true); drawVisuals(); k.dirty(); }
        else if (id === 'resetBtn') { reset(false); drawVisuals(); k.dirty(); }
      },
      change() { prefill(); drawVisuals(); k.dirty(); },
      update(dt) {
        if (running && dt > 0) { step(dt * 0.45); k.dirty(); }
        drawVisuals();
      },
      margin() {
        const meas = getMeasured(), last = meas[meas.length - 1];
        return [
          `有效点数: ${meas.length}`,
          last ? `ΔEₚ = ${last.dEp.toFixed(4)} J` : '待释放下落',
          last ? `ΔEₖ = ${last.dEk.toFixed(4)} J` : '',
          last ? `偏差 = ${last.lossPct.toFixed(2)}%` : '',
          `阻尼设定 η = ${(p.dragCoef * 100).toFixed(0)}%`,
        ].filter(Boolean);
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · h–v² 回归图与逐点机械能核算');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn primary" data-wb="drop">重新下落打点</button>
      <button type="button" class="wb-btn" data-wb="logAll">将本次全纸带计数点计入记录册</button>`;
    sec1.append(bar);

    const chart = wb.regressionChart(sec1, {
      w: 520, h: 240, xLabel: '下落高度 hₙ (m)', yLabel: '中心差分速度平方 vₙ² (m²/s²)', xRange: [0, 1.4], yRange: [0, 28],
    });
    const out = document.createElement('div');
    out.className = 'wb-metrics';
    sec1.append(out);

    const refresh = () => {
      const meas = sp.inst?.getMeasured?.() || [];
      const p = sp.params;
      const pts = meas.map((q) => [q.h, q.v2, 'simulated']);
      const maxH = Math.max(1.0, p.hMax * 1.1);
      const maxV2 = Math.max(20, ...pts.map((q) => q[1] * 1.15));
      chart.redraw({
        pts,
        xRange: [0, maxH],
        yRange: [0, maxV2],
        theoryFn: (hv) => 2 * G * hv,
      });
      const reg = linearRegression(pts);
      const gEff = reg ? reg.k / 2 : NaN;
      const etaMeas = Number.isFinite(gEff) ? (1 - gEff / G) * 100 : NaN;
      out.innerHTML = `
        <div class="wb-m"><span>理想 v²–h 斜率 2g</span><b>${(2 * G).toFixed(2)} m/s²</b></div>
        <div class="wb-m"><span>实测回归斜率 k_fit</span><b>${reg ? `${reg.k.toFixed(2)} m/s²` : '需 ≥2 点'}</b></div>
        <div class="wb-m"><span>反演有效 g_eff = k/2</span><b>${Number.isFinite(gEff) ? `${gEff.toFixed(3)} m/s²` : '—'}</b></div>
        <div class="wb-m"><span>能量耗散损失比</span><b>${Number.isFinite(etaMeas) ? `${etaMeas.toFixed(2)}% (设定 ${(p.dragCoef * 100).toFixed(0)}%)` : '—'}</b></div>`;
    };

    bar.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.wb;
      if (act === 'drop') wb.press('dropBtn');
      else if (act === 'logAll') {
        const meas = sp.inst?.getMeasured?.() || [];
        meas.forEach((q) => wb.record({ _kind: 'simulated', ...q }));
      }
      refresh();
    });

    refresh();
    return { update() { refresh(); } };
  },
};

// ================================================================ 8. 验证动量守恒定律（气垫导轨双光电门）(L4)
export const momentum = {
  id: 'phy-momentum',
  subject: 'phy',
  title: '验证动量守恒定律',
  en: 'Conservation of linear momentum',
  lede: [
    '气垫导轨将两滑块托起在气膜之上，双光电门分别测量遮光片（宽度 d = 2.0 cm）通过的时间 Δt₁、Δt₂ 算出碰撞前后速度 v₁, v₂ 与 v₁′, v₂′。',
    '调节恢复系数 e（1.0 完全弹性 / <1 非完全弹性 / 0.0 粘连共速），直接拖拽滑块即可在导轨上放手互撞，也可关闭气垫查看外力摩擦如何破坏总动量守恒。',
  ],
  formula: 'm₁v₁ + m₂v₂ = m₁v₁′ + m₂v₂′ · e = (v₂′ − v₁′) / (v₁ − v₂)',
  formulaNote: '系统合外力为零时，任何恢复系数 e 下总动量均守恒；动能仅在完全弹性碰撞 (e = 1) 时守恒',
  terms: [
    ['恢复系数 e', '碰撞后分离相对速度与碰撞前接近相对速度之比；e=1 为完全弹性，e=0 为粘连。'],
    ['光电门测速', '由遮光片宽度 d = 2.0 cm 与遮光时间 Δt 求得瞬时平均速度 v = d / Δt。'],
    ['动量守恒条件', '气垫悬浮消除了轨道摩擦，保证水平方向系统所受合外力为零。'],
  ],
  predict: {
    q: '在水平气垫导轨上，质量 m₁ = 0.30 kg、速度 v₁ = 0.80 m/s 的滑块撞上静止的滑块 m₂ = 0.30 kg 并粘连在一起（e = 0）。碰撞后系统的总动量与总动能各如何变化？',
    options: [
      '总动量减半，总动能减半',
      '总动量守恒不变，总动能损失一半',
      '总动量与总动能都保持守恒',
    ],
    answer: 1,
    why: '水平外力为零，故总动量守恒：v′ = m₁v₁/(m₁+m₂) = 0.40 m/s，总动量仍为 0.24 kg·m/s；但粘连碰撞后动能变为 ½(0.60)(0.40)² = 0.048 J，仅为碰前 0.096 J 的一半。',
  },
  challenge: '分别验证 e = 1.0（弹性）、e = 0.5（非弹性）与 e = 0.0（粘连）三组碰撞在工作台上的动量矢量闭合与动能损耗；再关闭气垫开关观察系统动量衰减！',
  fig: '气垫导轨、双滑块（带 2.0 cm 挡光片）、双光电门与数字毫秒计',
  hint: '直接左右拖拽滑块即可重新定位或发起碰撞；按“发射碰撞”自动按设定初速驶过光电门并记录碰前后速度。',
  teach: {
    where: '人教版物理选择性必修第一册第一章 §1.3《实验：验证动量守恒定律》（选择性必修 1 必做实验）',
    ask: [
      '在 e = 0 完全非弹性碰撞中，为什么动量完全守恒而机械能却发生最大比例的损失？丢失的动能去哪里了？',
      '关闭气垫气源后，为何碰撞前后的“总动量”不再相等？动量守恒的条件究竟是什么？',
    ],
    simplify: '设两滑块一维共轴碰撞，挡光片宽 d = 0.020 m；气垫开启时动摩擦因数 μ = 0，关闭时 μ = 0.035；光电门计时含 ±0.05 ms 采样抖动。',
    safety: '禁止在未开启气垫风机时强行高速推拉重滑块，以免划伤铝合金气垫导轨表面微气孔。',
  },
  controls: [
    { id: 'm1', label: '左滑块 m₁', min: 0.10, max: 0.60, step: 0.05, value: 0.30, unit: 'kg' },
    { id: 'm2', label: '右滑块 m₂', min: 0.10, max: 0.60, step: 0.05, value: 0.20, unit: 'kg' },
    { id: 'v1', label: '初速 v₁', min: 0.20, max: 1.50, step: 0.05, value: 0.80, unit: 'm/s' },
    { id: 'v2', label: '初速 v₂', min: -1.00, max: 0.60, step: 0.05, value: 0.00, unit: 'm/s' },
    { id: 'e', label: '恢复系数 e', min: 0.00, max: 1.00, step: 0.05, value: 1.00 },
    { id: 'air', label: '气垫悬浮开启', type: 'toggle', value: true },
    { id: 'goBtn', label: '发射碰撞', type: 'button' },
    { id: 'resetBtn', label: '复位滑块', type: 'button' },
  ],
  record: {
    note: '记下碰前总动量 p_前 = m₁v₁ + m₂v₂ 与碰后总动量 p_后 = m₁v₁′ + m₂v₂′，以及动能损失百分比 ΔEₖ/Eₖ。',
    pending: '完成一次碰撞过程后即可将前后动量与动能数据记入实验册。',
    columns: [
      { key: 'regime', label: '碰撞类型' },
      { key: 'e', label: '设定 e', digits: 2 },
      { key: 'pBefore', label: '碰前总动量', unit: 'kg·m/s', digits: 3 },
      { key: 'pAfter', label: '碰后总动量', unit: 'kg·m/s', digits: 3 },
      { key: 'pErrPct', label: '动量偏差', unit: '%', digits: 2, stat: true },
      { key: 'ekLossPct', label: '动能损失', unit: '%', digits: 1 },
    ],
    sample: (inst) => inst.snapshotRow?.() || null,
    summary: (rows) => {
      const ps = sampleStats(rows.map((r) => r.pErrPct));
      return [
        ['已采集碰撞次数', `${rows.length} 次`],
        ['平均动量偏差', ps.n ? `${ps.mean.toFixed(2)}%` : '—'],
      ];
    },
    errors: [
      '关闭气垫悬浮或导轨未调水平时，摩擦/重力分力沿轨道产生冲量，导致系统总动量不守恒。',
      '非完全弹性碰撞 (e < 1) 中形变生热造成机械能损失，但内力冲量成对抵消，动量依然守恒。',
    ],
  },

  build(k) {
    const p = k.p;
    const S = 3.0, TOP = 0.42, Z = -0.55, TRACK_LEN = 7.4; // -1.2m..+1.2m -> -3.6..+3.6
    const XG1 = -0.45, XG2 = 0.45; // 两个光电门物理坐标 (m)

    // 铝合金气垫导轨 + 气源接头
    k.root.add(
      at(box(TRACK_LEN, 0.24, 0.72, STEEL, { kind: 'metal' }), 0, 0.14, Z),
      at(box(TRACK_LEN + 0.2, 0.14, 0.9, '#46525c'), 0, 0, Z),
      at(cyl(0.14, 0.35, BRASS, { seg: 16 }), -TRACK_LEN / 2 - 0.15, 0.15, Z),
    );
    // 两个门型光电门 G1, G2
    const mkGate = (xm, lbl) => {
      const gx = xm * S;
      const g = group(
        at(box(0.14, 0.85, 0.12, '#3a4650'), gx, TOP, Z - 0.48),
        at(box(0.14, 0.85, 0.12, '#3a4650'), gx, TOP, Z + 0.48),
        at(box(0.18, 0.14, 1.08, '#3a4650'), gx, TOP + 0.78, Z),
        at(note(lbl, { size: 0.22, color: C.copper }), gx, TOP + 1.05, Z),
      );
      const beam = flat(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 6).rotateX(Math.PI / 2), C.red, { opacity: 0.8 });
      beam.position.set(gx, TOP + 0.50, Z);
      g.add(beam);
      g.beam = beam;
      return g;
    };
    const gate1 = mkGate(XG1, '光电门 G₁'), gate2 = mkGate(XG2, '光电门 G₂');
    k.root.add(gate1, gate2);

    // 双滑块 + 挡光片
    const mkGlider = (col, tag) => {
      const g = group(
        at(box(0.54, 0.26, 0.56, col), 0, 0, 0),
        at(box(0.06, 0.28, 0.04, C.ink), 0, 0.26, 0), // 2.0 cm 挡光片
        at(note(tag, { size: 0.22 }), 0, 0.62, 0),
      );
      return g;
    };
    const g1 = mkGlider(C.copper, 'm₁'), g2 = mkGlider('#7ea6cf', 'm₂');
    const arr1 = arrow(C.copper, 0.036), arr2 = arrow(C.sky, 0.036);
    const info = at(card('\n\n', { w: 4.5, size: 0.26, align: 'left' }), 0, 0.02, 1.95);
    k.root.add(g1, g2, arr1, arr2, info);

    let x1 = -0.82, x2 = 0.05, v1 = p.v1, v2 = p.v2, collided = false, running = false;
    let initV1 = p.v1, initV2 = p.v2, postV1 = null, postV2 = null, dt1 = null, dt2 = null;
    const halfW = 0.11; // 滑块半宽 (m)

    const resolveCollision = () => {
      const m1 = p.m1, m2 = p.m2, e = p.e;
      const u1 = v1, u2 = v2;
      if (u1 <= u2) return;
      v1 = (m1 * u1 + m2 * u2 - m2 * e * (u1 - u2)) / (m1 + m2);
      v2 = (m1 * u1 + m2 * u2 + m1 * e * (u1 - u2)) / (m1 + m2);
      collided = true;
      postV1 = v1; postV2 = v2;
    };

    const reset = (autoRun = false) => {
      x1 = -0.82;
      x2 = p.v2 < -0.05 ? 0.68 : 0.05;
      v1 = p.v1; v2 = p.v2;
      initV1 = v1; initV2 = v2;
      collided = false; postV1 = null; postV2 = null;
      dt1 = 0.02 / Math.max(0.05, Math.abs(v1));
      dt2 = Math.abs(v2) > 0.05 ? 0.02 / Math.abs(v2) : null;
      running = autoRun;
    };

    // 预演一次解析快照用于初始展示
    const preSolve = () => {
      reset(true);
      while (running && Math.abs(x1) < 1.1 && Math.abs(x2) < 1.1) {
        step(0.01);
        if (collided && Math.abs(x2) > 0.55) { running = false; break; }
      }
    };

    const step = (dt) => {
      const sub = Math.max(1, Math.ceil(dt / 0.004)), h = dt / sub;
      const mu = p.air ? 0 : 0.035;
      for (let i = 0; i < sub; i++) {
        if (!running) break;
        if (mu > 0) {
          v1 = Math.abs(v1) > mu * G * h ? v1 - Math.sign(v1) * mu * G * h : 0;
          v2 = Math.abs(v2) > mu * G * h ? v2 - Math.sign(v2) * mu * G * h : 0;
        }
        x1 += v1 * h; x2 += v2 * h;
        if (!collided && x1 + halfW >= x2 - halfW && v1 > v2) {
          const mid = 0.5 * (x1 + x2);
          x1 = mid - halfW; x2 = mid + halfW;
          resolveCollision();
        } else if (collided && p.e < 0.02 && x1 + halfW >= x2 - halfW) {
          // 完全非弹性粘连共行
          x2 = x1 + 2 * halfW;
        }
        if (x1 < -1.12) { x1 = -1.12; v1 = 0; }
        if (x2 > 1.12) { x2 = 1.12; v2 = 0; }
        if (Math.abs(v1) < 1e-3 && Math.abs(v2) < 1e-3) running = false;
      }
    };

    // 直接拖拽滑块定位与推撞
    const bindGliderDrag = (mesh, isFirst) => k.drag(mesh, {
      normal: 'z',
      start: () => { running = false; },
      move: (q) => {
        const xm = clamp(q.x / S, -1.05, 1.05);
        if (isFirst) x1 = Math.min(xm, x2 - 2 * halfW);
        else x2 = Math.max(xm, x1 + 2 * halfW);
        k.dirty();
      },
      end: () => { v1 = p.v1; v2 = p.v2; collided = false; running = true; k.dirty(); },
    });
    bindGliderDrag(g1, true); bindGliderDrag(g2, false);

    const snapshotRow = () => {
      const m1 = p.m1, m2 = p.m2;
      const u1 = initV1, u2 = initV2;
      // 如果尚未发生物理接触，按当前设定的碰撞规律预测或取实时速度
      const muLoss = p.air ? 1 : 0.86;
      const f1 = postV1 !== null ? postV1 : ((m1 * u1 + m2 * u2 - m2 * p.e * (u1 - u2)) / (m1 + m2)) * muLoss;
      const f2 = postV2 !== null ? postV2 : ((m1 * u1 + m2 * u2 + m1 * p.e * (u1 - u2)) / (m1 + m2)) * muLoss;
      const pBefore = m1 * u1 + m2 * u2;
      const pAfter = m1 * f1 + m2 * f2;
      const ekBefore = 0.5 * m1 * u1 * u1 + 0.5 * m2 * u2 * u2;
      const ekAfter = 0.5 * m1 * f1 * f1 + 0.5 * m2 * f2 * f2;
      const pErrPct = Math.abs(pBefore) > 1e-5 ? (Math.abs(pAfter - pBefore) / Math.abs(pBefore)) * 100 : 0;
      const ekLossPct = ekBefore > 1e-6 ? Math.max(0, ((ekBefore - ekAfter) / ekBefore) * 100) : 0;
      return {
        _kind: p.air ? 'model' : 'simulated',
        regime: p.e >= 0.98 ? '完全弹性' : p.e <= 0.02 ? '粘连共速' : '非完全弹性',
        e: p.e, pBefore, pAfter, pErrPct, ekLossPct,
        u1, u2, v1p: f1, v2p: f2, ekBefore, ekAfter,
      };
    };

    const drawVisuals = () => {
      g1.position.set(x1 * S, TOP, Z);
      g2.position.set(x2 * S, TOP, Z);
      g1.scale.x = 0.75 + p.m1 * 0.8;
      g2.scale.x = 0.75 + p.m2 * 0.8;
      arr1.set([x1 * S, TOP + 0.45, Z], [x1 * S + v1 * 0.8, TOP + 0.45, Z]);
      arr2.set([x2 * S, TOP + 0.45, Z], [x2 * S + v2 * 0.8, TOP + 0.45, Z]);
      gate1.beam.visible = Math.abs(x1 - XG1) > 0.03 && Math.abs(x2 - XG1) > 0.03;
      gate2.beam.visible = Math.abs(x1 - XG2) > 0.03 && Math.abs(x2 - XG2) > 0.03;

      const snap = snapshotRow();
      info.set(
        `v₁=${v1.toFixed(2)} m/s · v₂=${v2.toFixed(2)} m/s · e=${p.e.toFixed(2)}\n`
        + `p_前=${snap.pBefore.toFixed(3)} → p_后=${snap.pAfter.toFixed(3)} kg·m/s\n`
        + `ΔEₖ 损失=${snap.ekLossPct.toFixed(1)}% · ${p.air ? '气垫已开启' : '⚠ 气垫关闭(摩擦耗损)'}`,
      );
    };

    preSolve();
    drawVisuals();
    return {
      snapshotRow,
      press(id) {
        if (id === 'goBtn') { reset(true); drawVisuals(); k.dirty(); }
        else if (id === 'resetBtn') { reset(false); drawVisuals(); k.dirty(); }
      },
      change() { reset(true); drawVisuals(); k.dirty(); },
      update(dt) {
        if (running && dt > 0) { step(dt * 0.75); k.dirty(); }
        drawVisuals();
      },
      margin() {
        const snap = snapshotRow();
        return [
          `p_前 = ${snap.pBefore.toFixed(3)} kg·m/s`,
          `p_后 = ${snap.pAfter.toFixed(3)} kg·m/s`,
          `动量偏差 = ${snap.pErrPct.toFixed(2)}%`,
          `Eₖ 损失 = ${snap.ekLossPct.toFixed(1)}%`,
          p.air ? '合外力为零（气浮）' : '轨道摩擦破坏守恒',
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 恢复系数 e、动量矢量对比与动能耗散分析');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn primary" data-wb="elastic">完全弹性 (e=1.0)</button>
      <button type="button" class="wb-btn" data-wb="inelastic">非完全弹性 (e=0.5)</button>
      <button type="button" class="wb-btn" data-wb="sticky">粘连共速 (e=0.0)</button>
      <button type="button" class="wb-btn" data-wb="toggleAir">切换气垫摩擦</button>
      <button type="button" class="wb-btn" data-wb="record">计入本次碰撞</button>`;
    sec1.append(bar);

    const cv = wb.canvas(sec1, 520, 250, (x, W, H) => {
      const snap = sp.inst?.snapshotRow?.();
      const p = sp.params;
      if (!snap) return;
      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      const drawVecBar = (y, label, p1, p2, pTot, maxP) => {
        const cx = 190, wHalf = 140;
        const sx = (pv) => (pv / Math.max(0.2, maxP)) * wHalf;
        x.fillStyle = C.ink; x.font = '600 12px "Noto Serif SC",serif'; x.textAlign = 'left';
        x.fillText(label, 16, y + 6);
        x.strokeStyle = 'rgba(30,43,54,0.25)'; x.beginPath(); x.moveTo(cx, y - 16); x.lineTo(cx, y + 26); x.stroke();
        // p1
        x.fillStyle = C.copper; x.fillRect(cx + Math.min(0, sx(p1)), y - 14, Math.abs(sx(p1)), 12);
        // p2
        x.fillStyle = C.sky; x.fillRect(cx + Math.min(0, sx(p2)), y + 1, Math.abs(sx(p2)), 12);
        // pTot
        x.fillStyle = '#1f4a3e'; x.fillRect(cx + Math.min(0, sx(pTot)), y + 16, Math.abs(sx(pTot)), 10);
        x.fillStyle = '#51606b'; x.font = '11px Georgia,serif';
        x.fillText(`p₁=${p1.toFixed(3)}  p₂=${p2.toFixed(3)}  Σp=${pTot.toFixed(3)} kg·m/s`, 345, y + 8);
      };
      const maxP = Math.max(0.4, Math.abs(snap.pBefore) * 1.4, Math.abs(p.m1 * snap.u1) * 1.2);
      drawVecBar(42, '碰撞前动量', p.m1 * snap.u1, p.m2 * snap.u2, snap.pBefore, maxP);
      drawVecBar(112, '碰撞后动量', p.m1 * snap.v1p, p.m2 * snap.v2p, snap.pAfter, maxP);

      // 下半部分动能条对比
      const ekMax = Math.max(0.1, snap.ekBefore * 1.25);
      const bw = 280;
      x.fillStyle = C.ink; x.font = '600 12px "Noto Serif SC",serif';
      x.fillText('动能对比 Eₖ', 16, 178);
      x.fillStyle = C.copper; x.fillRect(140, 165, (snap.ekBefore / ekMax) * bw, 16);
      x.fillStyle = '#1f4a3e'; x.fillRect(140, 188, (snap.ekAfter / ekMax) * bw, 16);
      x.fillStyle = '#51606b'; x.font = '11px Georgia,serif';
      x.fillText(`碰前 Eₖ = ${snap.ekBefore.toFixed(4)} J`, 430, 177);
      x.fillText(`碰后 Eₖ′ = ${snap.ekAfter.toFixed(4)} J (损 ${snap.ekLossPct.toFixed(1)}%)`, 430, 200);
      x.textAlign = 'left'; x.fillStyle = C.ink;
      x.fillText(`实测恢复系数 e = (v₂′ − v₁′)/(v₁ − v₂) = ${((snap.v2p - snap.v1p) / Math.max(1e-4, snap.u1 - snap.u2)).toFixed(2)}`, 16, 232);
    });

    const out = document.createElement('div');
    out.className = 'wb-metrics';
    sec1.append(out);

    const refresh = () => {
      cv.redraw();
      const snap = sp.inst?.snapshotRow?.();
      if (!snap) return;
      out.innerHTML = `
        <div class="wb-m"><span>碰前 → 碰后总动量</span><b>${snap.pBefore.toFixed(3)} → ${snap.pAfter.toFixed(3)} kg·m/s</b></div>
        <div class="wb-m"><span>总动量偏差</span><b>${snap.pErrPct.toFixed(2)}%</b></div>
        <div class="wb-m"><span>机械能损失率 ΔEₖ/Eₖ</span><b>${snap.ekLossPct.toFixed(1)}%</b></div>
        <div class="wb-m"><span>气垫状态</span><b>${sp.params.air ? '悬浮无摩擦' : '⚠ 关闭(存在外力冲量)'}</b></div>`;
    };

    bar.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.wb;
      if (!act) return;
      if (act === 'elastic') wb.setParam('e', 1.0);
      else if (act === 'inelastic') wb.setParam('e', 0.5);
      else if (act === 'sticky') wb.setParam('e', 0.0);
      else if (act === 'toggleAir') wb.setParam('air', !sp.params.air);
      else if (act === 'record') {
        const row = sp.inst?.snapshotRow?.();
        if (row) wb.record(row);
      }
      refresh();
    });

    refresh();
    return { update() { refresh(); } };
  },
};

// ================================================================ 9. 单摆测重力加速度（L4 旗舰，完整保留）
const PLACES = [
  ['海口 (20°N)', 9.786],
  ['地球标准', 9.80],
  ['月球', 1.62],
  ['神秘行星 X', 6.40],
];
const S = 3.2, XC = -0.15, ZP = -2.55, PY = 4.85, R = 0.26, POST = 2.90;
const H = 1 / 240, DT = 1 / 120, TAPE_V = 1.0;
const LMIN = 0.30, LMAX = 1.20, AMAX = 75 * DEG;
const A1PCT = (() => {
  let lo = 0, hi = Math.PI / 2;
  for (let i = 0; i < 50; i++) {
    const m = 0.5 * (lo + hi);
    if (periodFactor(m) < 1.01) lo = m; else hi = m;
  }
  return lo;
})();
const fmtDeg = (a) => `${(Math.abs(a) / DEG).toFixed(Math.abs(a) < 10 * DEG ? 1 : 0)}°`;

export const pendulum = {
  id: 'phy-pendulum',
  subject: 'phy',
  title: '单摆测重力加速度：一条定律的边界',
  en: 'Simple pendulum & where T = 2π√(l/g) breaks down',
  lede: [
    '公式说周期与摆幅无关——在小角度与无阻尼前提之内。摆下方走动的记录纸把运动记成波形；拉大摆角，两支摆何时分道扬镳一目了然。',
    '拖动摆球改变初角，抓纸带前后拨动时间，提起纸签把波形升成时空路径，点秒表亲自计时。',
  ],
  formula: 'T = 2π √(l / g) · (2K(sin(θ₀/2)) / π)',
  formulaNote: '完整无阻尼周期含第一类完全椭圆积分；θ₀ < 5° 时与简谐近似偏差小于 0.05%',
  law: { html: '' },
  figure: { h: 108, caption: 'a 真实大摆角周期比 T/T₀ 随 θ₀ 变化。按住图面左右拖动即拉开摆球，松开释放。' },
  terms: [],
  predict: {
    q: '把摆拉到 60° 再静止放手，用简谐公式 T₀ = 2π√(l/g) 算出的周期与真实单摆相比：',
    options: ['公式算得偏长', '公式算得偏短', '完全相等，周期与摆幅无关'],
    answer: 1,
    why: '大角度时实际切向回复力 mg·sinθ 小于小角线性近似 mg·θ（60° 时弱约 17.3%），摆回到平衡位置更慢，真实周期比公式长约 7.3%。等时性只在小摆角成立。',
  },
  challenge: '找出相对误差恰好到达 1% 的临界摆角；切换海口(9.786)与神秘行星 X，用工作台 T²–l 回归测出未知 g！',
  fig: '走纸记录仪上的双摆对比：纸面就是时间轴',
  hint: '拖摆球改初角；拖绕线轮改摆长；抓纸带回放或快进时间；提“提起 ↑ 时空”纸签立起世界线；点右立柱秒表亲手计时。',
  teach: {
    where: '人教版物理选择性必修第一册第二章 §2.5《实验：用单摆测量重力加速度》（海南中学常规必做重点探究）',
    ask: [
      '从纸带上观察，摆角 10°、30°、60° 时实体摆与铜线公式摆的相位差各是如何累积的？',
      '测量摆长若忘记加上摆球半径 r = 2.5 cm，在工作台 T²–l 图像上会导致截距偏移还是斜率偏移？对 g 测量结果是系统偏大还是偏小？',
      '改变空气阻力材料（木球 vs 铁球），振幅衰减会明显改变单个周期 T 吗？在完整方程中寻找证据。',
    ],
    simplify: '实体摆采用完整非线性阻尼方程 θ″ = −(g/l)sinθ − γθ′（定步长 RK4，步长 1/240 s）；铜线参考摆采用 θ″ = −(g/l)θ − γθ′，两者仅差 sinθ ↔ θ 一项，从而把小角近似误差从空气阻尼中彻底隔离。空气阻力仅取一阶线性项 γv，忽略摆线质量与悬点弹性变形。',
    safety: '实验室真实操作注意铁架台底座配重防倾倒，单摆摆角不宜超过 5°，秒表应在摆球经过平衡位置（速度最大、判读误差最小）时起停。',
  },
  controls: [
    { id: 'place', label: '引力环境', type: 'choice', options: PLACES.map((x) => x[0]), value: 0 },
    { id: 'bob', label: '摆球材质', type: 'choice', options: ['木球 (高阻尼)', '铁球 (低阻尼)'], value: 1 },
    { id: 'radErr', label: '摆长测量口径', type: 'choice', options: ['规范：悬点至球心', '误区：漏加球半径 (-2.5 cm)'], value: 0 },
    { id: 'l', label: '摆长 l', min: LMIN, max: LMAX, step: 0.01, value: 0.90, unit: 'm' },
    { id: 'n', label: '自动计全振动次数 N', type: 'choice', options: ['1 次', '10 次', '30 次'], value: 1 },
    { id: 'lBtn', label: '模拟按秒表测周期', type: 'button', action: 'measure', text: '过最低点开始计时' },
  ],
  record: {
    note: '对比“你亲手按表”“模拟按表”与工作台 T²–l 回归算出的当地重力加速度 g，观察大摆角与摆长口径对系统误差的影响。',
    pending: '点击“过最低点开始计时”或直接点击支架右侧的铜壳秒表亲自测时。',
    columns: [
      { key: 'who', label: '测量方式' },
      { key: 'place', label: '地点/星球' },
      { key: 'l', label: '记录摆长 l', unit: 'm', digits: 3 },
      { key: 'amp', label: '摆角 θ₀', unit: '°', digits: 1 },
      { key: 'n', label: 'N', digits: 0 },
      { key: 'T', label: '测得周期 T', unit: 's', digits: 4 },
      { key: 'g', label: '算得 g', unit: 'm/s²', digits: 3, stat: true },
    ],
    sample: (_inst, _p) => null,
    summary: (rows) => {
      const gs = sampleStats(rows.map((r) => r.g));
      return [
        ['有效记录组数', `${gs.n} 组`],
        ['均值 ± 标准误', Number.isFinite(gs.mean) ? `${gs.mean.toFixed(3)} ± ${(gs.se || 0).toFixed(3)} m/s²` : '—'],
      ];
    },
    errors: [
      '系统误差一（近似条件失效）：θ₀ > 15° 时用 T = 2π√(l/g) 计算会低估真实周期，导致算出的 g 系统偏小。',
      '系统误差二（测量起点偏差）：仅量悬线长而漏加摆球半径 r，等效使记入的 l 偏小，算得 g = 4π²l/T² 偏小。',
      '随机误差控制：取摆球经过最低点时刻起停秒表并测 N = 30 次全振动求平均，可将单次按表 ±0.12 s 的反应误差缩小至 1/30。',
    ],
  },

  build(k) {
    const p = k.p;
    const mem = k.memory;
    if (p.gv === undefined) p.gv = PLACES[p.place ?? 0][1];
    const rand = rng(9786 + Math.round((p.l ?? 0.9) * 100));
    const gam = () => (p.bob === 0 ? 0.035 : 0.012);
    const lEff = () => p.l + (p.radErr === 1 ? 0.025 : 0);

    k.root.add(
      at(box(0.56, 0.14, 1.15, BRASS, { kind: 'metal' }), XC - POST, 0.07, ZP),
      at(box(0.56, 0.14, 1.15, BRASS, { kind: 'metal' }), XC + POST, 0.07, ZP),
      at(cyl(0.11, PY + 0.1, STEEL, { seg: 18, kind: 'metal' }), XC - POST, (PY + 0.1) / 2, ZP),
      at(cyl(0.11, PY + 0.1, STEEL, { seg: 18, kind: 'metal' }), XC + POST, (PY + 0.1) / 2, ZP),
      at(box(POST * 2 + 0.55, 0.18, 0.24, STEEL, { kind: 'metal' }), XC, PY + 0.09, ZP),
      at(box(0.42, 0.34, 0.10, BRASS, { kind: 'metal' }), XC, PY - 0.08, ZP + 0.07),
      at(box(0.42, 0.34, 0.10, BRASS, { kind: 'metal' }), XC, PY - 0.08, ZP - 0.07),
    );
    const drum = group(
      solid(new THREE.CylinderGeometry(0.26, 0.26, 0.16, 32).rotateX(Math.PI / 2), BRASS, { kind: 'metal' }),
      ...[0, 1, 2, 3].map((i) => rot(box(0.05, 0.40, 0.04, C.ink), 0, 0, (i * Math.PI) / 4)),
    );
    drum.children.slice(1).forEach((m) => m.geometry.translate(0, -0.2, 0.09));
    drum.position.set(XC + 0.62, PY + 0.20, ZP + 0.12);
    const drumGrip = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
    drumGrip.layers.set(1);
    drum.add(drumGrip);
    k.root.add(drum, at(note('转轮 · 改摆长', { size: 0.24, w: 2.0 }), XC + 1.75, PY + 0.62, ZP + 0.1));

    const tl = new Timeline(['th', 'om', 'thf', 'omf', 'sf', 'l', 'held'], { dt: DT, span: 45 });
    let sf = 0, view = 0;
    const tmp = {};
    const bobXY = (th0, l0) => [XC + Math.sin(th0) * l0 * S, PY - Math.cos(th0) * l0 * S];
    const tape = recorder({
      width: 5.0, z0: ZP, z1: 4.45, speed: TAPE_V, tickClear: 0.75, lineR: 0.045, printW: 0.07,
      traces: [
        { kind: 'model', dropEvery: 0.2, dropOpacity: 0.26, fn: (t) => (t > view + 1e-9 || !tl.at(t, tmp) ? null : bobXY(tmp.th, tmp.l)) },
        { kind: 'theory', lineR: 0.026, drops: false, fn: (t) => (t > view + 1e-9 || !tl.at(t, tmp) ? null : [...bobXY(tmp.thf, tmp.l), tmp.sf]) },
      ],
    });
    tape.position.x = XC;
    tape.traces.forEach((T) => {
      const f = T.o.fn;
      T.o.fn = (t) => { const q = f(t); if (q) q[0] -= XC; return q; };
    });
    k.root.add(tape);

    const legend = sheet(3.7, 0.72, (x, s) => {
      x.lineCap = 'round';
      x.strokeStyle = KIND.model.color; x.lineWidth = s * 0.05;
      x.beginPath(); x.moveTo(0.08 * s, 0.20 * s); x.lineTo(0.62 * s, 0.20 * s); x.stroke();
      x.strokeStyle = KIND.theory.color; x.setLineDash([s * 0.13, s * 0.09]);
      x.beginPath(); x.moveTo(0.08 * s, 0.53 * s); x.lineTo(0.62 * s, 0.53 * s); x.stroke(); x.setLineDash([]);
      x.textBaseline = 'middle'; x.font = `${s * 0.185}px "Songti SC","Noto Serif CJK SC",serif`;
      x.fillStyle = KIND.model.color; x.fillText('真实摆 · 非线性RK4模型', 0.76 * s, 0.20 * s);
      x.fillStyle = KIND.theory.color; x.fillText('公式摆 · 小角简谐近似', 0.76 * s, 0.53 * s);
    }, { lay: 'flat' });
    legend.position.set(XC - 0.55, 0.05, 4.05);
    const tab = group(
      at(solid(new THREE.BoxGeometry(1.25, 0.62, 0.03).translate(0, 0.31, 0), '#f4ead2'), 0, 0, 0),
      at(rot(torus(0.08, 0.022, BRASS), Math.PI / 2, 0, 0), 0, 0.64, 0),
      at(note('提起 ↑ 时空', { size: 0.22, w: 1.2 }), 0, 0.31, 0.03),
    );
    tab.rotation.x = -0.25;
    k.root.add(legend, tab);

    const pen = flat(new THREE.CircleGeometry(0.07, 16).rotateX(-Math.PI / 2), C.copper);
    const plumbG = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const plumb = new THREE.Line(plumbG, new THREE.LineDashedMaterial({ color: C.copper, dashSize: 0.1, gapSize: 0.08, transparent: true, opacity: 0.7 }));
    plumb.layers.set(1); plumb.frustumCulled = false;
    k.root.add(pen, plumb);

    const str = solid(new THREE.CylinderGeometry(0.016, 0.016, 1, 6).translate(0, 0.5, 0), C.ink);
    str.castShadow = true;
    const mkBob = (color, kind) => group(
      solid(new THREE.SphereGeometry(R, 36, 22), color, { kind, roughness: kind === 'metal' ? 0.28 : 0.6 }),
      at(rot(torus(0.045, 0.014, STEEL), Math.PI / 2, 0, 0), 0, R + 0.03, 0),
    );
    const bobs = [mkBob('#e3cfa6', 'wood'), mkBob('#bfc6cc', 'metal')];
    const gStr = flat(new THREE.CylinderGeometry(0.011, 0.011, 1, 5).translate(0, 0.5, 0), C.copper, { opacity: 0.85 });
    const gBob = group(
      glass(new THREE.SphereGeometry(R * 0.98, 28, 16), { color: 0xf3d9c4, opacity: 0.12 }),
      flat(new THREE.SphereGeometry(R * 0.35, 12, 8), C.copper, { opacity: 0.52 }),
    );
    const fTrue = arrow(C.ink, 0.03), fForm = arrow(C.copper, 0.03);
    const fNote = note('', { size: 0.22, w: 2.7, align: 'left' });
    const dim = dimension({ w: 1.6, size: 0.26 });
    k.root.add(str, ...bobs, gStr, gBob, fTrue, fForm, fNote, dim);

    const watch = new THREE.Group();
    watch.add(solid(new THREE.CylinderGeometry(0.6, 0.6, 0.16, 40).rotateX(Math.PI / 2), STEEL, { kind: 'metal' }));
    watch.add(at(solid(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 12), STEEL, { kind: 'metal' }), 0, 0.68, 0));
    let wtxt = null, wang = -1, wsub = '';
    const face = sheet(1.12, 1.12, () => {}, {});
    const drawFace = () => face.redraw((x, s, w) => {
      const c = (w / 2) * s;
      x.fillStyle = '#fffdf6'; x.beginPath(); x.arc(c, c, 0.54 * s, 0, TAU); x.fill();
      x.strokeStyle = C.ink; x.lineCap = 'round';
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * TAU, l = i % 5 === 0 ? 0.07 : 0.035;
        x.lineWidth = s * (i % 5 === 0 ? 0.012 : 0.006);
        x.beginPath(); x.moveTo(c + Math.sin(a) * 0.5 * s, c - Math.cos(a) * 0.5 * s);
        x.lineTo(c + Math.sin(a) * (0.5 - l) * s, c - Math.cos(a) * (0.5 - l) * s); x.stroke();
      }
      x.fillStyle = C.ink; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = `600 ${s * 0.17}px Georgia,serif`; x.fillText(wtxt, c, c + 0.2 * s);
      x.font = `${s * 0.085}px "Songti SC","Noto Serif CJK SC",serif`; x.fillStyle = C.copper; x.fillText(wsub, c, c - 0.2 * s);
      x.strokeStyle = C.red; x.lineWidth = s * 0.013;
      x.beginPath(); x.moveTo(c - Math.sin(wang) * 0.08 * s, c + Math.cos(wang) * 0.08 * s);
      x.lineTo(c + Math.sin(wang) * 0.44 * s, c - Math.cos(wang) * 0.44 * s); x.stroke();
    });
    face.position.z = 0.11; watch.add(face);
    watch.position.set(XC + POST, 3.1, ZP + 0.72); watch.rotation.x = -0.12; watch.scale.setScalar(0.9);
    const watchNote = at(note('点我计时', { size: 0.22, w: 1.4 }), XC + POST - 0.1, 3.95, ZP + 0.75);
    k.root.add(watch, at(rot(cyl(0.05, 0.62, STEEL, { seg: 8 }), Math.PI / 2, 0, 0), XC + POST, 3.1, ZP + 0.05), watchNote);

    let kk = 0, th = 32 * DEG, om = 0, thf = th, omf = 0, held = false;
    let peekL = 0, peekT = mem.peeked ? -1 : 0;
    let lift = 0, liftGoal = 0, liftHeld = false, scrub = null, lenT = 0;
    let amp = Math.abs(th), relAt = 0, relAmp = amp, T = 0, lastCross = null;
    const crosses = [];
    let timing = 0, cnt = 0, tStart = 0, shown = 0, lastRow = null, human = null;
    mem.points ||= [];

    const now = () => kk * H;
    const N = () => [1, 10, 30][p.n ?? 1];
    const T0 = () => TAU * Math.sqrt(lEff() / p.gv);
    const placeName = () => PLACES.find((x) => Math.abs(x[1] - p.gv) < 1e-4)?.[0] ?? `g=${p.gv.toFixed(2)}`;
    const addPoint = (kind, a, Tm, err) => {
      mem.points.push({ kind, a, r: Tm / T0(), e: err / T0(), l: p.l, Tm, radErr: p.radErr === 1, place: placeName() });
      if (mem.points.length > 80) mem.points.shift();
      figDirty = true;
      k.dirty();
    };

    const step = () => {
      const g = p.gv, l = lEff(), gm = gam();
      if (held) {
        om = 0; thf = th; omf = 0; sf += H * TAPE_V;
      } else {
        const prev = th;
        [th, om] = stepPendulumRK4(th, om, g, l, gm, H, false);
        const xf0 = Math.sin(thf) * l * S;
        [thf, omf] = stepPendulumRK4(thf, omf, g, l, gm, H, true);
        sf += Math.hypot(Math.sin(thf) * l * S - xf0, H * TAPE_V);
        if (prev < 0 && th >= 0) {
          const tc = (kk + 1) * H - H * (th / (th - prev));
          if (lastCross !== null) T = tc - lastCross;
          lastCross = tc; crosses.push(tc); if (crosses.length > 400) crosses.shift();
          if (timing === 1) { timing = 2; tStart = tc; cnt = 0; }
          else if (timing === 2 && ++cnt >= N()) finishSim(tc - tStart);
        }
        amp = Math.max(Math.abs(th), amp * Math.exp((-gm * H) / 2));
      }
      kk++;
      if (kk % 2 === 0) tl.push(kk / 2, { th, om, thf, omf, sf, l, held: held ? 1 : 0 });
    };

    const advanceTo = (t) => {
      const target = Math.round(t / H);
      let guard = 0;
      while (kk < target && guard++ < 240 * 120) step();
    };

    const release = (a) => {
      held = false; th = clamp(a, -AMAX, AMAX); om = 0; thf = th; omf = 0;
      amp = Math.abs(th); relAt = now(); relAmp = amp; lastCross = null; T = 0;
      if (timing === 2) timing = 0;
    };

    const finishSim = (tN) => {
      const n = N(), read = Math.max(0.05, tN + gauss(rand) * 0.1), Tm = read / n;
      lastRow = {
        _kind: 'simulated',
        who: '模拟按表', place: placeName(), l: p.l, amp: relAmp / DEG, n, t: read, T: Tm,
        g: (4 * Math.PI ** 2 * p.l) / (Tm * Tm),
      };
      addPoint('simulated', relAmp, Tm, 0.1 / n);
      shown = read; timing = 0;
      k.record(lastRow);
    };

    if (mem.state) {
      ({ kk, th, om, thf, omf, sf, amp, relAt, relAmp } = mem.state);
      tl.restore(mem.tl); held = false;
      const away = Math.min(k.away, 90);
      if (away > 1) advanceTo(now() + away);
    } else {
      tl.push(0, { th, om, thf, omf, sf, l: lEff(), held: 0 });
      advanceTo(2.0);
    }
    view = now();

    const setState = (t) => {
      const tmpS = {};
      tl.at(t, tmpS); tl.truncate(t);
      kk = Math.round(tmpS.t / H); th = tmpS.th; om = tmpS.om; thf = tmpS.thf; omf = tmpS.omf; sf = tmpS.sf; held = false;
      amp = Math.acos(clamp(Math.cos(th) - (om * om * lEff()) / (2 * p.gv), -1, 1));
      relAt = Math.min(relAt, tmpS.t);
      while (crosses.length && crosses[crosses.length - 1] > tmpS.t) crosses.pop();
      lastCross = crosses.length ? crosses[crosses.length - 1] : null;
    };
    const setL = (v) => {
      p.l = clamp(Math.round(v * 100) / 100, LMIN, LMAX);
      k.set('l', p.l); lawDirty = figDirty = true; lenT = 1.5; drawLaw(); k.dirty();
    };

    bobs.forEach((b) => k.drag(b.children[0], {
      start: () => { held = true; timing = 0; human = null; scrub = null; },
      move: (q) => { th = clamp(Math.atan2(q.x - XC, PY - q.y), -AMAX, AMAX); om = 0; },
      end: () => release(th),
    }));

    const grabTape = (m) => k.drag(m, {
      normal: 'y',
      start: () => { scrub = { z: null, t: view }; human = null; timing = 0; },
      move: (q) => {
        if (!scrub) return;
        if (scrub.z === null) { scrub.z = q.z; return; }
        const t = Math.max(tl.t0, scrub.t + (q.z - scrub.z) / tape.speed);
        if (t > now()) advanceTo(Math.min(t, now() + 25));
        view = Math.min(t, now());
      },
      end: () => { if (scrub && view < now() - 1e-6) setState(view); scrub = null; view = now(); },
    });
    grabTape(tape.paper); tape.traces.forEach((tr) => grabTape(tr.line));

    k.drag(tab.children[0], {
      start: () => { liftHeld = true; },
      move: (q) => { lift = liftGoal = clamp((q.y - 0.2) / 3.2); },
      end: () => { liftHeld = false; liftGoal = lift > 0.35 ? 1 : 0; },
    });

    let drumY = null, drumL = 0;
    k.drag(drumGrip, {
      start: () => { drumY = null; drumL = p.l; },
      move: (q) => { if (drumY === null) { drumY = q.y; return; } setL(drumL - (q.y - drumY) / S); },
      end: () => { drumY = null; },
    });

    let tapT = 0;
    k.drag(watch.children[0], {
      start: () => { tapT = performance.now(); },
      end: () => {
        if (performance.now() - tapT > 600) return;
        if (!human) { human = { t: now() }; timing = 0; shown = 0; return; }
        const dur = now() - human.t;
        const win = crosses.filter((c) => c >= human.t - 0.05 && c <= now() + 0.05);
        const Tt = win.length > 1 ? (win[win.length - 1] - win[0]) / (win.length - 1) : (T || T0());
        const n = Math.max(1, Math.round(dur / Tt)), Tm = dur / n;
        shown = dur; human = null;
        if (dur < 0.3) return;
        lastRow = { _kind: 'human', who: '你', place: placeName(), l: p.l, amp: amp / DEG, n, t: dur, T: Tm, g: (4 * Math.PI ** 2 * p.l) / (Tm * Tm) };
        addPoint('human', amp, Tm, 0.15 / n);
        k.record(lastRow);
      },
    });

    let law = null, fig = null, figDirty = true, lawDirty = true;
    const figBox = { l: 34, r: 10, t: 12, b: 26 }, YR = [0.985, 1.15];

    const drawFig = () => {
      if (!fig) return;
      const W = fig.fc.clientWidth || 340, Hh = fig.fc.clientHeight || 108, dpr = 2;
      if (fig.cv.width !== W * dpr || fig.cv.height !== Hh * dpr) { fig.cv.width = W * dpr; fig.cv.height = Hh * dpr; }
      const x = fig.cv.getContext('2d');
      x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, Hh);
      const L0 = figBox.l, R0 = W - figBox.r, T0p = figBox.t, B0 = Hh - figBox.b;
      const X = (a) => L0 + (a / AMAX) * (R0 - L0);
      const Yv = (r) => B0 - ((r - YR[0]) / (YR[1] - YR[0])) * (B0 - T0p);
      x.fillStyle = 'rgba(31,74,62,.08)'; x.fillRect(L0, Yv(1.01), R0 - L0, Yv(0.99) - Yv(1.01));
      x.strokeStyle = C.ink; x.lineWidth = 1.1;
      x.beginPath(); x.moveTo(L0, T0p - 4); x.lineTo(L0, B0); x.lineTo(R0 + 4, B0); x.stroke();
      x.fillStyle = '#51606b'; x.font = '10px Georgia,serif'; x.textAlign = 'center'; x.textBaseline = 'top';
      for (let d = 0; d <= 75; d += 15) x.fillText(`${d}°`, X(d * DEG), B0 + 3);
      x.textAlign = 'right'; x.textBaseline = 'middle';
      for (const r of [1, 1.05, 1.10]) x.fillText(r.toFixed(2), L0 - 4, Yv(r));
      x.strokeStyle = C.copper; x.lineWidth = 1.5; x.setLineDash([5, 3]);
      x.beginPath(); x.moveTo(L0, Yv(1)); x.lineTo(R0, Yv(1)); x.stroke(); x.setLineDash([]);
      x.strokeStyle = C.ink; x.lineWidth = 1.8; x.beginPath();
      for (let i = 0; i <= 80; i++) {
        const a = (i / 80) * AMAX, r = periodFactor(a);
        if (i) x.lineTo(X(a), Yv(r)); else x.moveTo(X(a), Yv(r));
      }
      x.stroke();
      x.strokeStyle = 'rgba(31,74,62,.65)'; x.setLineDash([2, 2]);
      x.beginPath(); x.moveTo(X(A1PCT), Yv(1.01)); x.lineTo(X(A1PCT), B0); x.stroke(); x.setLineDash([]);
      for (const pt of mem.points) {
        const px = X(Math.min(pt.a, AMAX)), py = Yv(clamp(pt.r, YR[0], YR[1]));
        x.beginPath(); x.arc(px, py, 2.5, 0, TAU);
        if (pt.kind === 'human') { x.fillStyle = '#1f4a3e'; x.fill(); }
        else { x.fillStyle = '#fffdf6'; x.fill(); x.strokeStyle = '#51606b'; x.lineWidth = 1; x.stroke(); }
      }
      const a = Math.min(amp, AMAX), r = periodFactor(a);
      x.fillStyle = C.copper; x.beginPath(); x.arc(X(a), Yv(r), 3.6, 0, TAU); x.fill();
      x.font = '12px "Noto Serif SC",serif'; x.fillStyle = C.ink; x.textBaseline = 'bottom';
      x.textAlign = X(a) > (L0 + R0) / 2 ? 'right' : 'left';
      x.fillText(`此刻 ${fmtDeg(a)}: +${((r - 1) * 100).toFixed(r - 1 < 0.01 ? 2 : 1)}%`, X(a) + (x.textAlign === 'right' ? -6 : 6), Yv(r) - 3);
    };

    const drawLaw = () => {
      if (!law) return;
      const l = lEff(), g = p.gv, T0v = T0(), f = periodFactor(amp), err = (f - 1) * 100;
      const key = `${l.toFixed(3)}|${g}|${fmtDeg(amp)}|${p.radErr}`;
      if (key === law.key) return;
      law.key = key;
      law.sl.textContent = `${p.l.toFixed(2)} m`;
      law.sg.textContent = `${g.toFixed(2)} m/s²`;
      law.ls.refresh(); law.gs.refresh();
      law.calc.innerHTML = `= 2π√(${l.toFixed(3)} ÷ ${g.toFixed(2)}) = <b>${T0v.toFixed(3)} s</b>${p.radErr ? ' (含球半径偏移)' : ''}`;
      const broken = amp > 10 * DEG, warn = !broken && amp > 5 * DEG;
      law.ca.className = `cond${broken ? ' broken' : warn ? ' warn' : ''}`;
      law.ca.querySelector('.why').textContent = broken ? `当前 ${fmtDeg(amp)}：周期偏长 ${err.toFixed(2)}%` : warn ? `已现微偏 ${err.toFixed(2)}%` : '';
      law.more.textContent = `完整椭圆积分周期 T = ${(T0v * f).toFixed(3)} s`;
    };

    const bindPage = (leaf, _r, signal) => {
      const bx = leaf.querySelector('[data-law]'), fc = leaf.querySelector('[data-fig]');
      if (bx) {
        bx.innerHTML = `<div class="f">T = 2π √( <span class="n" data-s="l"></span> / <span class="n" data-s="g"></span> )</div>
          <div class="row" data-r="calc"></div>
          <div class="conds">
            <span class="cond" data-c="a"><i>①</i><s>摆角很小，sinθ ≈ θ</s><em class="why"></em></span>
            <span class="cond"><i>②</i><s>摆长须量至球心</s><em class="why" style="display:inline;color:var(--ink2)">${p.radErr ? '当前偏少2.5cm' : '已对齐球心'}</em></span>
          </div>
          <div class="more" data-r="more"></div>`;
        const sl = bx.querySelector('[data-s="l"]'), sg = bx.querySelector('[data-s="g"]');
        const ls = scrubbable(sl, { get: () => p.l, set: setL, min: LMIN, max: LMAX, step: 0.01, px: 3, signal, label: '摆长 l' });
        const gs = scrubbable(sg, {
          get: () => p.gv,
          set: (v) => {
            p.gv = v;
            const i = PLACES.findIndex((x) => Math.abs(x[1] - v) < 1e-3);
            p.place = i >= 0 ? i : 1; k.set('place', p.place);
            lawDirty = figDirty = true; drawLaw(); k.dirty();
          },
          min: 1.0, max: 25.0, step: 0.01, px: 2, signal, label: '重力加速度 g',
        });
        law = { box: bx, sl, sg, ls, gs, calc: bx.querySelector('[data-r="calc"]'), more: bx.querySelector('[data-r="more"]'), ca: bx.querySelector('[data-c="a"]'), key: '' };
        lawDirty = true;
      }
      if (fc) {
        const cv = fc.querySelector('canvas');
        fig = { fc, cv };
        const pick = (e) => {
          const w = fc.clientWidth || 340, ox = e.offsetX || 0;
          return Math.max(1 * DEG, clamp((ox - figBox.l) / Math.max(10, w - figBox.l - figBox.r)) * AMAX);
        };
        let down = false;
        fc.addEventListener('pointerdown', (e) => { e.preventDefault(); down = true; held = true; timing = 0; human = null; th = pick(e); amp = th; figDirty = true; k.dirty(); }, { signal });
        fc.addEventListener('pointermove', (e) => { if (!down) return; th = pick(e); amp = th; figDirty = true; k.dirty(); }, { signal });
        const up = () => { if (!down) return; down = false; release(th); figDirty = true; };
        fc.addEventListener('pointerup', up, { signal }); fc.addEventListener('pointercancel', up, { signal });
        figDirty = true;
      }
    };

    const draw = () => {
      const s = tl.at(view, tmp) ? tmp : { th, thf, l: lEff() };
      const t = s.t ?? view;
      const [bx, by] = bobXY(s.th, s.l);
      const [fx, fy] = bobXY(s.thf, s.l);
      bobs[0].visible = p.bob === 0; bobs[1].visible = p.bob !== 0;
      spanMesh(str, [XC, PY, ZP], [bx, by, ZP]); bobs.forEach((b) => b.position.set(bx, by, ZP));
      spanMesh(gStr, [XC, PY, ZP], [fx, fy, ZP]); gBob.position.set(fx, fy, ZP);
      const sth = held ? th : s.th;
      if (Math.abs(sth) > 0.03) {
        const tx = Math.cos(sth), ty = Math.sin(sth), nx = -Math.sin(sth) * (R + 0.14), ny = Math.cos(sth) * (R + 0.14);
        const ft = Math.sin(sth) * -1.8, ff = sth * -1.8;
        fTrue.visible = fForm.visible = true;
        fTrue.set([bx, by, ZP], [bx + tx * ft, by + ty * ft, ZP]);
        fForm.set([bx + nx, by + ny, ZP + R + 0.05], [bx + nx + tx * ff, by + ny + ty * ff, ZP + R + 0.05]);
        fNote.visible = held;
        if (held) {
          fNote.set(`mg·sinθ（真实）\nmg·θ（公式近似）\n差 ${((Math.abs(sth) / Math.max(1e-4, Math.abs(Math.sin(sth))) - 1) * 100).toFixed(0)}%`);
          fNote.position.set(bx + tx * ff * 0.5 + (sth > 0 ? -1.3 : 1.3), by + 0.85, ZP + 0.4);
        }
      } else { fTrue.visible = fForm.visible = fNote.visible = false; }
      dim.set([XC - 0.75, PY - 0.2, ZP - 0.1], [XC - 0.75, PY - 0.2 - s.l * S, ZP - 0.1], `l_真 = ${s.l.toFixed(3)} m`, [-1, 0, 0]);
      dim.visible = drumY !== null || lenT > 0 || p.radErr === 1;
      pen.position.set(bx, 0.05, ZP);
      plumbG.attributes.position.array.set([bx, by - R, ZP, bx, 0.05, ZP]);
      plumbG.attributes.position.needsUpdate = true; plumb.computeLineDistances();
      drum.rotation.z = -p.l * 4;
      const el = k.stage.view3.elev, camLift = clamp((0.6 - el) / 0.2);
      const L1 = Math.max(lift * lift * (3 - 2 * lift), camLift * camLift * (3 - 2 * camLift), peekL);
      tape.update(t, L1, tl.t0);
      tab.position.set(XC + 1.85, 0.03 + L1 * 3.0, 4.15);
      const running = human ? now() - human.t : timing === 2 ? now() - tStart : 0;
      const txt = human || timing === 2 ? running.toFixed(1) : shown ? shown.toFixed(2) : '0.00';
      const sub = human ? '你在计时…再点停' : timing === 1 ? '等过最低点' : timing === 2 ? `计满 ${cnt}/${N()}` : '点一下开始';
      const ang = ((human || timing === 2 ? running : shown) % 60) / 60 * TAU;
      if (txt !== wtxt || sub !== wsub || Math.abs(ang - wang) > 0.03) { wtxt = txt; wsub = sub; wang = ang; drawFace(); }
      watchNote.visible = !lastRow && !human;
    };

    let figT = 0, lastAmp = -1;
    const inst = {
      bindPage,
      press(id) {
        if (id === 'lBtn') this.measure();
      },
      change(id) {
        if (id === 'place') p.gv = PLACES[p.place ?? 0][1];
        lawDirty = figDirty = true;
      },
      measure() { if (timing) return null; if (amp < 0.03) release(5 * DEG); human = null; timing = 1; cnt = 0; shown = 0; return null; },
      update(dt) {
        if (!scrub && dt > 0) { advanceTo(now() + dt * (timing === 2 ? 4 : 1)); view = now(); }
        if (!liftHeld) { const d = liftGoal - lift; lift += d * (1 - Math.exp(-6 * dt)); if (Math.abs(d) < 0.002) lift = liftGoal; }
        if (lenT > 0) lenT -= dt;
        if (peekT >= 0) { peekT += dt; const u = clamp((peekT - 2.2) / 2.0); peekL = 0.30 * Math.sin(Math.PI * u) ** 2; if (u >= 1) { peekT = -1; peekL = 0; mem.peeked = true; } k.dirty(); }
        draw();
        figT += dt;
        if (figDirty || lawDirty || (Math.abs(amp - lastAmp) > 0.5 * DEG && figT > 0.25)) {
          figDirty = false; lawDirty = false; figT = 0; lastAmp = amp; drawFig(); drawLaw();
        }
        if (scrub || liftHeld || Math.abs(lift - liftGoal) > 0) k.dirty();
      },
      margin() {
        const T0v = T0(), f = periodFactor(amp), tau = now() - relAt;
        const lead = tau > 0 && !held ? tau * (1 - 1 / f) : 0;
        return [
          `θ₀ = ${fmtDeg(amp)} · ${placeName()}`,
          `小角公式 T₀ = ${T0v.toFixed(3)} s`,
          `完整模型 T = ${(T0v * f).toFixed(3)} s`,
          lead > 0.025 ? `公式摆已领先 ${(Math.round(lead / 0.05) * 0.05).toFixed(2)} s` : '两支摆相位基本一致',
          scrub ? `← 回看纸带 t = ${view.toFixed(2)} s` : '',
        ].filter(Boolean);
      },
      save(m) { m.peeked = true; m.state = { kk, th, om, thf, omf, sf, amp, relAt, relAmp }; m.tl = tl.snapshot(); },
    };
    draw(); drawLaw();
    return inst;
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 多摆长采集与 T²–l 最小二乘回归反演 g');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn primary" data-wb-a="sweep5">自动扫描 5 组规范小角 (5°)</button>
      <button type="button" class="wb-btn" data-wb-a="sample1">采录当前条件 1 次 (N=30)</button>
      <button type="button" class="wb-btn" data-wb-a="clear">清空图表点</button>`;
    sec1.append(bar);
    const chart = wb.regressionChart(sec1, {
      w: 500, h: 240, xLabel: '记录摆长 l (m)', yLabel: '周期平方 T² (s²)', xRange: [0.25, 1.3], yRange: [0, 6.5],
    });
    const out = document.createElement('div');
    out.className = 'wb-metrics';
    sec1.append(out);

    const redraw = () => {
      const p = sp.params, rows = wb.rows();
      const gv = PLACES[p.place ?? 0][1];
      const pts = rows.filter((r) => Number.isFinite(r.l) && Number.isFinite(r.T)).map((r) => [r.l, r.T * r.T, r._kind || 'simulated']);
      const maxY = Math.max(5.5, ...pts.map((q) => q[1] * 1.15));
      chart.redraw({
        pts, xRange: [0.25, 1.3], yRange: [0, maxY],
        theoryFn: (x) => (4 * Math.PI ** 2 * x) / gv,
      });
      const reg = linearRegression(pts);
      const k = reg ? reg.k : NaN;
      const b = reg ? reg.b : NaN;
      const gFit = Number.isFinite(k) && k > 0 ? (4 * Math.PI ** 2) / k : NaN;
      const relErr = Number.isFinite(gFit) ? ((gFit - gv) / gv) * 100 : NaN;
      out.innerHTML = `
        <div class="wb-m"><span>环境真实 g</span><b>${gv.toFixed(3)} m/s²</b></div>
        <div class="wb-m"><span>T²–l 拟合斜率 g</span><b>${Number.isFinite(gFit) ? gFit.toFixed(3) + ' m/s²' : '需 ≥2 组数据'}</b></div>
        <div class="wb-m"><span>纵截距 (检查摆长系统差)</span><b>${Number.isFinite(b) ? b.toFixed(4) + ' s²' : '—'}</b></div>
        <div class="wb-m"><span>相对误差</span><b>${Number.isFinite(relErr) ? (relErr >= 0 ? '+' : '') + relErr.toFixed(2) + '%' : '—'}</b></div>`;
    };

    const doSample = (lenM, ampDeg = 5) => {
      const p = sp.params, gv = PLACES[p.place ?? 0][1];
      const lReal = lenM + (p.radErr === 1 ? 0.025 : 0);
      const Tm = 2 * Math.PI * Math.sqrt(lReal / gv) * periodFactor(ampDeg * DEG) + (Math.random() - 0.5) * 0.004;
      wb.record({
        _kind: 'simulated',
        who: '工作台扫描', place: PLACES[p.place ?? 0][0], l: +lenM.toFixed(2),
        amp: ampDeg, n: 30, T: Tm, g: (4 * Math.PI ** 2 * lenM) / (Tm * Tm),
      });
      redraw();
    };

    bar.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.wbA;
      if (a === 'sweep5') {
        [0.40, 0.60, 0.80, 1.00, 1.15].forEach((L) => doSample(L, 5));
      } else if (a === 'sample1') {
        doSample(sp.params.l ?? 0.90, 5);
      } else if (a === 'clear') {
        redraw();
      }
    });

    redraw();
    return { update() { /* redraws on events */ } };
  },
};

export default [
  tickerVelocity,
  hooke,
  forces,
  newton2,
  projectile,
  centripetal,
  energyConservation,
  momentum,
  pendulum,
];
