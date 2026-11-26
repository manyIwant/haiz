// HAIZ · EXPERIMENTARIUM — 电磁与光学 + 热学分子实验包（11 项完整探究实验）
import {
  C, L, TAU, clamp, lerp, group, at, rot, box, cyl, ball, torus, plate,
  rod, wire, tube, spring, arrow, strip, dash, glow, flat, glass, label, note, card,
  plot, dots, liquid, sheet, meter, flow, dimension, stand, wavelength,
  sig, freshGroup, THREE,
} from '../core/ink.js';
import { KIND, DEG, rng, gauss, linearRegression, sampleStats } from '../core/epistemic.js';

const STEEL = '#cfd6dc';
const BRASS = '#d9b36a';
const DARK = '#26323c';

// ---------------------------------------------------------------------------
// 公共物理与几何辅助
// ---------------------------------------------------------------------------
function makeSolenoid(x, y, z, radius, height, turns = 12, color = C.copper) {
  const g = group();
  g.position.set(x, y, z);
  const core = at(glass(new THREE.CylinderGeometry(radius * 0.94, radius * 0.94, height, 32, 1, true).translate(0, height / 2, 0)), 0, 0, 0);
  g.add(core);
  const rings = [];
  for (let i = 0; i < turns; i++) {
    const yy = height * 0.08 + (i / Math.max(1, turns - 1)) * height * 0.84;
    const t = at(torus(radius, 0.04, color), 0, yy, 0);
    rings.push(t);
    g.add(t);
  }
  g.rings = rings;
  return g;
}

function makeWireLoop(pts, r = 0.028, color = C.ink) {
  const g = group();
  for (let i = 0; i < pts.length - 1; i++) {
    g.add(rod(pts[i], pts[i + 1], r, color));
  }
  return g;
}

function makeRheostat(x, z, len = 3.2) {
  const g = group();
  g.add(
    rot(at(cyl(0.24, len, C.paper), x + len / 2, 0.48, z), 0, 0, Math.PI / 2),
    at(box(0.18, 0.78, 0.44, STEEL, { kind: 'metal' }), x - len / 2 - 0.08, 0, z),
    at(box(0.18, 0.78, 0.44, STEEL, { kind: 'metal' }), x + len / 2 + 0.08, 0, z),
    rod([x - len / 2 - 0.08, 0.92, z], [x + len / 2 + 0.08, 0.92, z], 0.036, STEEL),
  );
  const coils = 16;
  for (let i = 0; i < coils; i++) {
    const cx = lerp(x - len * 0.44, x + len * 0.44, i / (coils - 1));
    g.add(rot(at(torus(0.25, 0.018, C.copper), cx, 0.48, z), 0, 0, Math.PI / 2));
  }
  const slider = box(0.28, 0.36, 0.36, C.copper, { kind: 'metal' });
  slider.position.set(x, 0.76, z);
  g.add(slider);
  g.slider = slider;
  g.setFrac = (f) => { slider.position.x = lerp(x - len * 0.44, x + len * 0.44, clamp(f)); };
  return g;
}

function wbRangeRow(parent, labelText, min, max, step, val, unit, onChange) {
  const row = document.createElement('label');
  row.className = 'wb-ctl';
  const span = document.createElement('span');
  span.textContent = labelText;
  const inp = document.createElement('input');
  inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = val;
  const out = document.createElement('b');
  const dec = String(step).includes('.') ? String(step).split('.')[1].length : 0;
  const fmt = (v) => `${Number(v).toFixed(dec)}${unit ? ' ' + unit : ''}`;
  out.textContent = fmt(val);
  inp.addEventListener('input', () => {
    const v = +inp.value;
    out.textContent = fmt(v);
    onChange(v);
  });
  row.append(span, inp, out);
  parent.append(row);
  return {
    inp,
    set(v) { inp.value = v; out.textContent = fmt(v); },
  };
}

// ===========================================================================
// 1. phy-resistivity-caliper (L4) — 游标卡尺、螺旋测微器与金属丝电阻率
// ===========================================================================
const WIRE_MATS = [
  { name: '康铜丝', rho: 5.0e-7, dDefault: 0.64 },
  { name: '镍铬丝', rho: 1.1e-6, dDefault: 0.50 },
  { name: '锰铜丝', rho: 4.4e-7, dDefault: 0.80 },
];
const CAL_RA = 0.5;
const CAL_RV = 3000;

function solveResistivityCircuit(matIdx, dMm, lengthM, U, connMode) {
  const mat = WIRE_MATS[matIdx] || WIRE_MATS[0];
  const dM = dMm * 1e-3;
  const area = Math.PI * (dM / 2) ** 2;
  const rTrue = (mat.rho * lengthM) / Math.max(1e-12, area);
  let uRead = U;
  let iRead = 0;
  let rMeas = rTrue;
  if (connMode === 0) {
    // 外接法：V 并联在 Rx 两端，A 测总电流 I = U/Rx + U/RV
    iRead = U / rTrue + U / CAL_RV;
    rMeas = uRead / Math.max(1e-9, iRead);
  } else {
    // 内接法：A 与 Rx 串联，V 测两者总压 U = I*(Rx + RA)
    iRead = U / (rTrue + CAL_RA);
    rMeas = uRead / Math.max(1e-9, iRead);
  }
  const rhoMeas = (rMeas * area) / Math.max(1e-6, lengthM);
  const power = (U * U) / Math.max(1e-6, rTrue);
  return { mat, rTrue, rMeas, uRead, iRead, area, rhoMeas, power };
}

function drawVernier2D(x, W, H, readingMm, divCount = 50) {
  x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
  const pxPerMm = 14;
  const x0 = 36;
  const yMain = 76;

  // 主尺体
  x.fillStyle = '#e7ecef';
  x.fillRect(x0 - 12, yMain - 42, W - x0, 42);
  x.strokeStyle = C.ink; x.lineWidth = 1.4;
  x.strokeRect(x0 - 12, yMain - 42, W - x0, 42);

  // 主尺刻度 (0..32 mm)
  x.fillStyle = C.ink; x.font = '11px Georgia, serif'; x.textAlign = 'center';
  for (let mm = 0; mm <= 32; mm++) {
    const px = x0 + mm * pxPerMm;
    if (px > W - 18) break;
    const h = mm % 10 === 0 ? 18 : mm % 5 === 0 ? 13 : 8;
    x.beginPath(); x.moveTo(px, yMain); x.lineTo(px, yMain - h); x.stroke();
    if (mm % 10 === 0) x.fillText(`${mm / 10}`, px, yMain - 22);
  }
  x.textAlign = 'left'; x.font = '11px "Noto Serif SC", serif';
  x.fillText('主尺 (cm)', x0, yMain - 28);

  // 游标尺体 (向右滑动 readingMm)
  const shiftPx = readingMm * pxPerMm;
  const vLenMm = divCount === 50 ? 49 : divCount === 20 ? 19 : 9;
  const vScaleW = Math.min(vLenMm * pxPerMm * (divCount === 50 ? 0.56 : 1), W - x0 - shiftPx - 10);
  // 为保证 50 分度在 520px 宽画布清晰可见，主尺与游标分别按同比例 0.98mm/格 绘制局部放大视窗
  const vx0 = x0 + shiftPx;
  const pitch = divCount === 50 ? 0.98 * pxPerMm : divCount === 20 ? 0.95 * pxPerMm : 0.9 * pxPerMm;
  const boxW = Math.min(divCount * pitch + 20, W - vx0 + 180);

  x.fillStyle = '#f3ebd8';
  x.fillRect(vx0 - 8, yMain + 2, boxW, 46);
  x.strokeStyle = C.ink; x.lineWidth = 1.4;
  x.strokeRect(vx0 - 8, yMain + 2, boxW, 46);

  const frac = readingMm - Math.floor(readingMm);
  const alignIdx = Math.round(frac * divCount) % divCount;
  for (let i = 0; i <= divCount; i++) {
    const px = vx0 + i * pitch;
    if (px > W - 8) break;
    const major = i % (divCount === 50 ? 5 : 5) === 0;
    const isMatch = i === alignIdx;
    x.strokeStyle = isMatch ? C.red : C.ink;
    x.lineWidth = isMatch ? 2.2 : 1;
    const h = major ? 18 : 10;
    x.beginPath(); x.moveTo(px, yMain + 2); x.lineTo(px, yMain + 2 + h); x.stroke();
    if (i % 10 === 0 || (divCount === 10 && i % 2 === 0)) {
      x.fillStyle = isMatch ? C.red : C.ink;
      x.font = '10px Georgia, serif'; x.textAlign = 'center';
      x.fillText(String(divCount === 50 ? i / 5 : i), px, yMain + 32);
    }
  }
  x.fillStyle = C.copper; x.textAlign = 'left'; x.font = '11px "Noto Serif SC", serif';
  x.fillText(`${divCount} 分度游标 (精度 ${(1 / divCount).toFixed(2)} mm) · 红线为对齐格`, x0, H - 10);
}

function drawMicrometer2D(x, W, H, dMm) {
  x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
  const cx = 56, cy = H / 2;
  const pxPerMm = 26;
  // 固定套筒
  x.fillStyle = '#e7ecef';
  x.fillRect(cx, cy - 26, 220, 52);
  x.strokeStyle = C.ink; x.lineWidth = 1.5;
  x.strokeRect(cx, cy - 26, 220, 52);
  // 基线
  x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + 220, cy); x.stroke();
  for (let m = 0; m <= 6; m++) {
    const px = cx + 16 + m * pxPerMm;
    x.beginPath(); x.moveTo(px, cy); x.lineTo(px, cy - 16); x.stroke();
    x.fillStyle = C.ink; x.font = '11px Georgia, serif'; x.textAlign = 'center';
    x.fillText(String(m), px, cy - 19);
    if (m < 6) {
      const hx = px + 0.5 * pxPerMm;
      x.beginPath(); x.moveTo(hx, cy); x.lineTo(hx, cy + 12); x.stroke();
    }
  }
  // 微分筒边缘位置
  const edgeX = cx + 16 + dMm * pxPerMm;
  x.fillStyle = '#f2ead7';
  x.beginPath();
  x.moveTo(edgeX, cy - 34);
  x.lineTo(edgeX + 22, cy - 42);
  x.lineTo(edgeX + 150, cy - 42);
  x.lineTo(edgeX + 150, cy + 42);
  x.lineTo(edgeX + 22, cy + 42);
  x.lineTo(edgeX, cy + 34);
  x.closePath();
  x.fill(); x.stroke();

  // 可动刻度 50 等分，以基线 cy 为读数基准
  const subDiv = (dMm % 0.5) * 100; // 0..50
  for (let k = -12; k <= 12; k++) {
    const tick = ((Math.round(subDiv) + k) % 50 + 50) % 50;
    const offset = (tick - subDiv);
    const wrapped = offset > 25 ? offset - 50 : offset < -25 ? offset + 50 : offset;
    const py = cy - wrapped * 2.6;
    if (py < cy - 34 || py > cy + 34) continue;
    const major = tick % 5 === 0;
    x.strokeStyle = Math.abs(wrapped) < 0.35 ? C.red : C.ink;
    x.lineWidth = Math.abs(wrapped) < 0.35 ? 2 : 1;
    x.beginPath(); x.moveTo(edgeX + 2, py); x.lineTo(edgeX + (major ? 22 : 13), py); x.stroke();
    if (major) {
      x.fillStyle = C.ink; x.font = '10px Georgia, serif'; x.textAlign = 'left';
      x.fillText(String(tick), edgeX + 25, py + 3);
    }
  }
  x.fillStyle = '#51606b'; x.font = '11px "Noto Serif SC", serif'; x.textAlign = 'left';
  x.fillText('固定套筒 (上整毫米 / 下半毫米)', cx, 16);
  x.fillText('可动微分筒 (50 格，每格 0.01 mm)', edgeX + 24, H - 8);
}

const resistivityCaliper = {
  id: 'phy-resistivity-caliper',
  subject: 'phy',
  title: '长度测量工具选用与金属丝电阻率测定',
  en: 'Caliper, micrometer & wire resistivity',
  lede: [
    '测金属丝直径不能用米尺估摸：直径差 0.05 mm，截面积平方后电阻率误差就会超过 15%。游标卡尺（0.02 mm）量外径与槽宽，螺旋测微器（0.01 mm 并估读到 0.001 mm）精准测丝径。',
    '拖动三维游标卡尺副尺与千分尺旋钮读出长度直径，切换电流表内接法与外接法，从电表分流/分压系统误差中算出金属丝电阻率 ρ。',
  ],
  formula: 'D = 主尺 + 副尺对齐格 × 精度 · ρ = π d² R / (4 L)',
  formulaNote: '电表内阻 R_A = 0.5 Ω，R_V = 3000 Ω；判断 R_x² 与 R_A·R_V 大小选定外接或内接',
  terms: [
    ['50 分度游标卡尺', '副尺 50 格总长 49 mm，每格 0.98 mm，精度 0.02 mm（不需估读）。'],
    ['螺旋测微器', '螺距 0.5 mm、可动 50 格，每格 0.01 mm；读数需看清半毫米线并估读到千分位。'],
    ['大电阻内接 / 小电阻外接', '待测丝阻值 R_x 远小于 √(R_A·R_V) ≈ 38.7 Ω 时，外接法电压表分流极小，应选外接法。'],
  ],
  predict: {
    q: '用螺旋测微器测得一根阻值约 4 Ω 的康铜丝直径，接伏安法电路测其电阻时应采用哪种接法？为什么？',
    options: [
      '内接法，因为电流表内阻 0.5 Ω 对 4 Ω 影响可以忽略',
      '外接法，因为 R_x ≈ 4 Ω 远小于 √(R_A·R_V) ≈ 38.7 Ω，电压表分流仅约 0.13%，而内接法偏大 12.5%',
      '两种接法测出的阻值完全一致',
    ],
    answer: 1,
    why: '当 R_x = 4 Ω 时，若用内接法，电流表内阻 0.5 Ω 直接串联进去，测量误差 +12.5%；若用外接法，3000 Ω 电压表分流误差仅约 -0.13%，外接法精确得多！',
  },
  challenge: '在 3D 台面拖动游标卡尺与千分尺完成测量，对比同一根 0.50 mm 镍铬丝在内接法与外接法下的 R 偏差，并在工作台完成游标读数校验！',
  fig: '50 分度游标卡尺、0.01 mm 螺旋测微器与可切换内/外接伏安电路',
  hint: '直接左右拖动金属卡尺游标或转动千分尺套筒；切换“接法”按钮看电压表、电流表接入位置与示数变化。',
  teach: {
    where: '人教版物理必修第三册第十一章 §11.3《实验：导体电阻率的测量》（海南高中物理必做重点实验）',
    ask: [
      '为什么金属丝直径要用螺旋测微器在不同位置互相垂直地测 3 次求平均，而长度用米尺测量即可？',
      '若电压表与电流表换用未知大电阻（如 R_x = 500 Ω），内接与外接哪一个误差更小？',
    ],
    simplify: '设金属丝处于 20 ℃ 恒温环境（工作台会在功率 P > 0.8 W 时给出焦耳热温升警报）；R_A = 0.5 Ω，R_V = 3000 Ω。',
    safety: '通电时间不宜过长，电流不宜过大，避免金属丝发热造成电阻率随温度明显上升。',
  },
  controls: [
    { id: 'wire', label: '金属丝材质', type: 'choice', options: ['康铜丝', '镍铬丝', '锰铜丝'], value: 0 },
    { id: 'd', label: '丝径 d（千分尺）', min: 0.30, max: 2.00, step: 0.01, value: 0.64, unit: 'mm' },
    { id: 'calX', label: '卡尺开口', min: 0.0, max: 25.0, step: 0.02, value: 12.46, unit: 'mm' },
    { id: 'L', label: '接入长度 L', min: 0.20, max: 1.00, step: 0.05, value: 0.60, unit: 'm' },
    { id: 'U', label: '电源电压 U', min: 0.5, max: 3.0, step: 0.1, value: 1.5, unit: 'V' },
    { id: 'conn', label: '伏安电路接法', type: 'choice', options: ['外接法 (测小电阻)', '内接法 (测大电阻)'], value: 0, wide: true },
    { id: 'rec', type: 'button', label: '记录本组数据' },
  ],
  record: {
    note: '记录游标/千分尺测得直径 d、长度 L、电压 U、电流 I，核算电阻 R 与电阻率 ρ。',
    pending: '调节电路参数或切换接法后点击“记录本组数据”。',
    columns: [
      { key: 'matName', label: '金属丝' },
      { key: 'connName', label: '接法' },
      { key: 'd', label: '丝径 d', unit: 'mm', digits: 3 },
      { key: 'L', label: '长度 L', unit: 'm', digits: 2 },
      { key: 'U', label: 'U', unit: 'V', digits: 2 },
      { key: 'I', label: 'I', unit: 'A', digits: 3 },
      { key: 'R', label: 'R_测', unit: 'Ω', digits: 3 },
      { key: 'rho7', label: 'ρ (×10⁻⁷)', unit: 'Ω·m', digits: 2, stat: true },
    ],
    sample: (_inst, p) => {
      const sol = solveResistivityCircuit(p.wire ?? 0, p.d ?? 0.64, p.L ?? 0.60, p.U ?? 1.5, p.conn ?? 0);
      return {
        _kind: 'simulated',
        matName: sol.mat.name,
        connName: p.conn === 1 ? '内接' : '外接',
        d: p.d, L: p.L, U: sol.uRead, I: sol.iRead, R: sol.rMeas,
        rho7: sol.rhoMeas * 1e7,
      };
    },
    summary: (rows) => {
      const st = sampleStats(rows.map((r) => r.rho7));
      return [
        ['已采测量组数', `${rows.length} 组`],
        ['平均电阻率 ρ', st.n ? `${st.mean.toFixed(2)} × 10⁻⁷ Ω·m` : '—'],
      ];
    },
    errors: [
      '游标卡尺读数常见错误：把副尺对齐格数误乘以 0.1 mm，或忘记加上主尺整毫米数。',
      '内接法因分压 R_A = 0.5 Ω 导致测得 R 与 ρ 系统偏大；外接法因分流 1/R_V 导致系统偏小。',
    ],
  },

  build(k) {
    const p = k.p;
    // 前景左：50 分度游标卡尺
    const calGrp = at(group(), -1.5, 0.15, 1.35);
    const mainBar = at(box(3.8, 0.16, 0.42, STEEL, { kind: 'metal' }), 0, 0.35, 0);
    const fixedJaw = at(box(0.22, 0.18, 0.95, STEEL, { kind: 'metal' }), -1.79, 0.34, 0.28);
    const scaleFace = sheet(3.5, 0.34, (x, s, w, h) => {
      x.fillStyle = '#edf1f3'; x.fillRect(0, 0, w * s, h * s);
      x.strokeStyle = C.ink; x.lineWidth = s * 0.015;
      for (let i = 0; i <= 28; i++) {
        const px = (0.15 + i * 0.115) * s;
        x.beginPath(); x.moveTo(px, h * s); x.lineTo(px, (h - (i % 5 === 0 ? 0.18 : 0.1)) * s); x.stroke();
      }
    }, { lay: 'flat', opaque: true });
    scaleFace.position.set(0.05, 0.52, 0);
    const vernierSlide = group(
      at(box(1.35, 0.20, 0.50, '#dfe5e9', { kind: 'metal' }), 0.65, 0.36, 0),
      at(box(0.20, 0.20, 0.95, '#dfe5e9', { kind: 'metal' }), -0.02, 0.36, 0.28),
      at(note('游标(拖)', { size: 0.2, w: 1.3 }), 0.65, 0.62, 0.05),
    );
    calGrp.add(mainBar, fixedJaw, scaleFace, vernierSlide);

    // 前景右：0.01 mm 螺旋测微器
    const micGrp = at(group(), 1.9, 0.2, 1.45);
    const uFrame = at(torus(0.55, 0.08, DARK, Math.PI), 0, 0.62, 0);
    uFrame.rotation.z = Math.PI;
    uFrame.rotation.x = Math.PI / 2;
    const sleeve = rot(at(cyl(0.14, 1.15, STEEL, { kind: 'metal' }), 0.55, 0.62, 0), 0, 0, -Math.PI / 2);
    const spindle = rot(at(cyl(0.06, 0.85, BRASS, { kind: 'metal' }), -0.45, 0.62, 0), 0, 0, -Math.PI / 2);
    const thimble = rot(at(cyl(0.21, 0.62, '#c8d0d6', { kind: 'metal' }), 1.05, 0.62, 0), 0, 0, -Math.PI / 2);
    const micWire = rot(at(cyl(0.05, 0.9, C.copper, { kind: 'metal' }), -0.35, 0.62, 0), Math.PI / 2, 0, 0);
    micGrp.add(uFrame, sleeve, spindle, thimble, micWire, at(note('千分尺(拖)', { size: 0.2, w: 1.5 }), 0.6, 1.15, 0));

    // 后部：待测金属丝伏安电路（电源、变阻器、Rx 金属丝、A、V 表）
    const ZB = -1.65;
    k.root.add(
      at(box(1.1, 0.55, 0.7, '#d8d2c5'), -2.7, 0, ZB),
      at(note('E = 3V', { size: 0.22, w: 1.2 }), -2.7, 0.68, ZB),
      at(box(2.2, 0.14, 0.55, C.wood, { kind: 'wood' }), 0, 0, ZB - 1.1),
      at(box(0.12, 0.30, 0.18, BRASS, { kind: 'metal' }), -0.95, 0.14, ZB - 1.1),
      at(box(0.12, 0.30, 0.18, BRASS, { kind: 'metal' }), 0.95, 0.14, ZB - 1.1),
    );
    const wireSpecimen = rod([-0.95, 0.36, ZB - 1.1], [0.95, 0.36, ZB - 1.1], 0.04, C.copper);
    const Am = at(meter('A', { w: 1.4, h: 1.0 }), 2.5, 0, ZB - 0.8);
    const Vm = at(meter('V', { w: 1.4, h: 1.0 }), 0, 0, ZB + 0.35);
    const circuitWires = makeWireLoop([
      [-2.15, 0.06, ZB], [-1.5, 0.06, ZB - 1.1], [-0.95, 0.28, ZB - 1.1],
    ], 0.025, C.ink);
    const outerVLead = wire([0.95, 0.28, ZB - 1.1], [0.7, 0.06, ZB + 0.35], 0.024);
    const innerVLead = wire([2.1, 0.06, ZB - 0.8], [0.7, 0.06, ZB + 0.35], 0.024);
    const leftVLead = wire([-0.95, 0.28, ZB - 1.1], [-0.7, 0.06, ZB + 0.35], 0.024);
    const rightMainLead = makeWireLoop([[0.95, 0.28, ZB - 1.1], [1.9, 0.06, ZB - 0.8], [3.1, 0.06, ZB], [-2.15, 0.06, ZB]], 0.025, C.ink);
    const cur = flow([[-2.15, 0.08, ZB], [-0.95, 0.38, ZB - 1.1], [0.95, 0.38, ZB - 1.1], [2.5, 0.08, ZB - 0.8], [2.5, 0.08, ZB], [-2.15, 0.08, ZB]], 18, C.amber, { r: 0.065 });
    const info = at(card('\n', { w: 3.3, size: 0.28, align: 'left' }), -2.35, 0, -0.05);
    k.root.add(wireSpecimen, Am, Vm, circuitWires, outerVLead, innerVLead, leftVLead, rightMainLead, cur, info);

    // 拖动游标卡尺与螺旋测微器
    let calDragX0 = null, calStart = 0;
    k.drag(vernierSlide, {
      normal: 'y',
      start: () => { calDragX0 = null; calStart = p.calX; },
      move: (q) => {
        if (calDragX0 === null) { calDragX0 = q.x; return; }
        const nx = clamp(Math.round((calStart + (q.x - calDragX0) * 10) * 50) / 50, 0, 25);
        k.set('calX', nx);
      },
      end: () => { calDragX0 = null; },
    });
    let micDragX0 = null, micStart = 0;
    k.drag(thimble, {
      normal: 'y',
      start: () => { micDragX0 = null; micStart = p.d; },
      move: (q) => {
        if (micDragX0 === null) { micDragX0 = q.x; return; }
        const nd = clamp(Math.round((micStart + (q.x - micDragX0) * 0.8) * 100) / 100, 0.30, 2.00);
        k.set('d', nd);
      },
      end: () => { micDragX0 = null; },
    });

    return {
      press(id) {
        if (id === 'rec') {
          const row = resistivityCaliper.record.sample(this, p);
          if (row) k.record(row);
        }
      },
      change(id) {
        if (id === 'wire') {
          k.set('d', WIRE_MATS[p.wire]?.dDefault ?? 0.64);
        }
      },
      update(dt) {
        const sol = solveResistivityCircuit(p.wire ?? 0, p.d ?? 0.64, p.L ?? 0.60, p.U ?? 1.5, p.conn ?? 0);
        vernierSlide.position.x = -1.68 + (p.calX / 25) * 2.55;
        thimble.position.x = 0.85 + (p.d / 2.0) * 0.45;
        thimble.rotation.x = (p.d / 0.5) * TAU;
        spindle.position.x = -0.62 + (p.d / 2.0) * 0.25;
        micWire.scale.set(0.5 + p.d, 1, 0.5 + p.d);
        wireSpecimen.scale.x = 0.5 + p.d;
        wireSpecimen.scale.z = 0.5 + p.d;
        outerVLead.visible = p.conn === 0;
        innerVLead.visible = p.conn === 1;
        Am.set(clamp(sol.iRead / 1.5), `${sol.iRead.toFixed(3)} A`);
        Vm.set(clamp(sol.uRead / 3.0), `${sol.uRead.toFixed(2)} V`);
        cur.step(dt, clamp(sol.iRead * 2.2, 0.3, 4.5));
        const errPct = ((sol.rMeas - sol.rTrue) / sol.rTrue) * 100;
        info.set(
          `卡尺 ${p.calX.toFixed(2)} mm · 千分尺 ${p.d.toFixed(3)} mm\n` +
          `${p.conn === 1 ? '内接' : '外接'} R_测=${sol.rMeas.toFixed(3)} Ω (${errPct >= 0 ? '+' : ''}${errPct.toFixed(2)}%)`
        );
        this._sol = sol;
      },
      margin() {
        const s = this._sol || solveResistivityCircuit(p.wire ?? 0, p.d ?? 0.64, p.L ?? 0.60, p.U ?? 1.5, p.conn ?? 0);
        return [
          `材质：${s.mat.name}`,
          `d = ${p.d.toFixed(3)} mm · L = ${p.L.toFixed(2)} m`,
          `真值 R_x = ${s.rTrue.toFixed(3)} Ω`,
          `测量 R_测 = ${s.rMeas.toFixed(3)} Ω`,
          `ρ_测 = ${sig(s.rhoMeas, 3)} Ω·m`,
          s.power > 0.8 ? '⚠ 功率偏高，注意发热漂移' : `功率 P = ${s.power.toFixed(2)} W`,
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 50 分度游标卡尺与 0.01 mm 螺旋测微器精读训练台');
    const bar1 = document.createElement('div');
    bar1.className = 'wb-btn-row';
    bar1.innerHTML = `
      <button type="button" class="wb-btn primary" data-a="quiz">随机出题 (游标+千分尺)</button>
      <button type="button" class="wb-btn" data-a="check">核对我的读数</button>
      <button type="button" class="wb-btn" data-a="sync">同步当前 3D 器具数值</button>`;
    sec1.append(bar1);

    const quizState = { vTarget: 12.46, mTarget: 1.735, vDiv: 50 };
    const cvCal = wb.canvas(sec1, 520, 138, (x, W, H) => drawVernier2D(x, W, H, quizState.vTarget, quizState.vDiv));
    const cvMic = wb.canvas(sec1, 520, 128, (x, W, H) => drawMicrometer2D(x, W, H, quizState.mTarget));

    const inpRow = document.createElement('div');
    inpRow.className = 'wb-row';
    inpRow.innerHTML = `
      <label class="wb-ctl"><span>游标卡尺读数 (mm)</span><input type="number" step="0.02" class="wb-input" data-in="v" value="12.46"></label>
      <label class="wb-ctl"><span>千分尺读数 (mm)</span><input type="number" step="0.001" class="wb-input" data-in="m" value="1.735"></label>
      <span class="wb-muted" data-msg="quiz">拖动上方刻度或输入判读数值后点“核对我的读数”。</span>`;
    sec1.append(inpRow);

    // 交互拖动工作台 2D 卡尺画布
    let dCal = null;
    cvCal.cv.addEventListener('pointerdown', (e) => { dCal = { x: cvCal.toLocal(e).x, v: quizState.vTarget }; cvCal.cv.setPointerCapture(e.pointerId); });
    cvCal.cv.addEventListener('pointermove', (e) => {
      if (!dCal) return;
      const dx = (cvCal.toLocal(e).x - dCal.x) / 14;
      quizState.vTarget = clamp(Math.round((dCal.v + dx) * 50) / 50, 0, 26);
      cvCal.redraw();
    });
    const endCal = () => { dCal = null; };
    cvCal.cv.addEventListener('pointerup', endCal); cvCal.cv.addEventListener('pointercancel', endCal);

    const sec2 = wb.section('2 · 内接法 vs 外接法系统误差对比与 ρ = πd²R/(4L) 核算');
    const cmpBar = document.createElement('div');
    cmpBar.className = 'wb-btn-row';
    cmpBar.innerHTML = `
      <button type="button" class="wb-btn primary" data-b="rec">记录当前工况至实验册</button>
      <button type="button" class="wb-btn" data-b="toggle">切换 内接 / 外接</button>`;
    sec2.append(cmpBar);
    const chart = wb.canvas(sec2, 520, 195, (x, W, H) => {
      const p = sp.params;
      const pad = { l: 50, r: 20, t: 20, b: 32 }, pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();
      const sExt = solveResistivityCircuit(p.wire ?? 0, p.d ?? 0.64, p.L ?? 0.60, p.U ?? 1.5, 0);
      const sInt = solveResistivityCircuit(p.wire ?? 0, p.d ?? 0.64, p.L ?? 0.60, p.U ?? 1.5, 1);
      const maxI = Math.max(0.5, sExt.iRead * 1.4, 3.0 / Math.max(0.5, sExt.rTrue) * 1.1);
      const sx = (iv) => pad.l + (iv / maxI) * pw;
      const sy = (uv) => pad.t + ph - (uv / 3.2) * ph;
      // 理想线、外接、内接三条 U-I 线
      const drawLine = (R, col, dashArr) => {
        x.save(); x.strokeStyle = col; x.lineWidth = 2; x.setLineDash(dashArr || []);
        x.beginPath(); x.moveTo(sx(0), sy(0));
        const iMaxLine = Math.min(maxI, 3.2 / Math.max(0.05, R));
        x.lineTo(sx(iMaxLine), sy(iMaxLine * R)); x.stroke(); x.restore();
      };
      drawLine(sExt.rTrue, KIND.theory.color, [6, 4]);
      drawLine(sExt.rMeas, '#1f4a3e', null);
      drawLine(sInt.rMeas, '#3b6fe0', [3, 3]);
      const curS = p.conn === 1 ? sInt : sExt;
      x.fillStyle = C.red; x.beginPath(); x.arc(sx(curS.iRead), sy(curS.uRead), 5, 0, TAU); x.fill();
      x.fillStyle = C.ink; x.font = '11px "Noto Serif SC", serif';
      x.fillText(`铜虚线: 真实 R=${sExt.rTrue.toFixed(3)}Ω   绿实线: 外接 R=${sExt.rMeas.toFixed(3)}Ω   蓝虚线: 内接 R=${sInt.rMeas.toFixed(3)}Ω`, pad.l + 8, pad.t + 12);
      x.fillText('I / A', pad.l + pw - 24, H - 6);
      x.fillText('U / V', 10, pad.t + 10);
    });
    const metrics = document.createElement('div');
    metrics.className = 'wb-metrics';
    sec2.append(metrics);

    const refresh = () => {
      cvCal.redraw(); cvMic.redraw(); chart.redraw();
      const p = sp.params;
      const s = solveResistivityCircuit(p.wire ?? 0, p.d ?? 0.64, p.L ?? 0.60, p.U ?? 1.5, p.conn ?? 0);
      const errPct = ((s.rMeas - s.rTrue) / s.rTrue) * 100;
      const warn = s.power > 0.8 ? '⚠ 大电流焦耳热明显 (>0.8W)' : '恒温低功耗区间';
      metrics.innerHTML = `
        <div class="wb-m"><span>真值电阻 / 测量电阻</span><b>${s.rTrue.toFixed(3)} Ω / ${s.rMeas.toFixed(3)} Ω (${errPct >= 0 ? '+' : ''}${errPct.toFixed(2)}%)</b></div>
        <div class="wb-m"><span>算得电阻率 ρ</span><b>${sig(s.rhoMeas, 3)} Ω·m (真值 ${sig(s.mat.rho, 3)})</b></div>
        <div class="wb-m"><span>焦耳热功率 P = U²/R</span><b>${s.power.toFixed(3)} W · ${warn}</b></div>`;
    };

    bar1.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      const msg = inpRow.querySelector('[data-msg="quiz"]');
      if (a === 'quiz') {
        quizState.vTarget = +(Math.floor(Math.random() * 1100) * 0.02 + 2).toFixed(2);
        quizState.mTarget = +(Math.floor(Math.random() * 450) * 0.01 + 0.5).toFixed(3);
        msg.textContent = '已生成随机刻度题，请观察刻度尺并填写读数！';
        cvCal.redraw(); cvMic.redraw();
      } else if (a === 'check') {
        const uv = parseFloat(inpRow.querySelector('[data-in="v"]').value);
        const um = parseFloat(inpRow.querySelector('[data-in="m"]').value);
        const okV = Math.abs(uv - quizState.vTarget) <= 0.025;
        const okM = Math.abs(um - quizState.mTarget) <= 0.005;
        msg.textContent = `游标${okV ? '✓ 准确' : `✗ 应为 ${quizState.vTarget.toFixed(2)} mm`}；千分尺${okM ? '✓ 准确' : `✗ 应为 ${quizState.mTarget.toFixed(3)} mm`}`;
      } else if (a === 'sync') {
        quizState.vTarget = sp.params.calX ?? 12.46;
        quizState.mTarget = sp.params.d ?? 0.64;
        inpRow.querySelector('[data-in="v"]').value = quizState.vTarget.toFixed(2);
        inpRow.querySelector('[data-in="m"]').value = quizState.mTarget.toFixed(3);
        cvCal.redraw(); cvMic.redraw();
      }
    });
    cmpBar.addEventListener('click', (e) => {
      const b = e.target.closest('button')?.dataset.b;
      if (b === 'rec') wb.press('rec');
      else if (b === 'toggle') wb.setParam('conn', sp.params.conn === 1 ? 0 : 1);
      refresh();
    });

    refresh();
    return { update() { refresh(); } };
  },
};

// ===========================================================================
// 2. phy-multimeter (L3) — 练习使用多用电表
// ===========================================================================
const MM_MODES = [
  { id: 'v10', label: 'DC 10V', kind: 'V', full: 10 },
  { id: 'ma50', label: 'DC 50mA', kind: 'mA', full: 50 },
  { id: 'x1', label: 'Ω×1', kind: 'R', mult: 1, rMid: 15 },
  { id: 'x10', label: 'Ω×10', kind: 'R', mult: 10, rMid: 150 },
  { id: 'x100', label: 'Ω×100', kind: 'R', mult: 100, rMid: 1500 },
];
const MM_TARGETS = [
  { name: '短接表笔 (调零)', kind: 'R', val: 0 },
  { name: '未知电阻 R₁ (150Ω)', kind: 'R', val: 150 },
  { name: '未知电阻 R₂ (1.8kΩ)', kind: 'R', val: 1800 },
  { name: '二极管正向 (红接负极)', kind: 'R', val: 95 },
  { name: '二极管反向 (红接正极)', kind: 'R', val: 6e5 },
  { name: '干电池组 (4.5 V)', kind: 'V', val: 4.5 },
  { name: '直流支路 (24 mA)', kind: 'mA', val: 24 },
];

function solveMultimeter(modeIdx, targetIdx, mechZero, ohmZeroPct) {
  const m = MM_MODES[modeIdx] || MM_MODES[2];
  const t = MM_TARGETS[targetIdx] || MM_TARGETS[1];
  let frac = 0; // 0..1 on dial (left=0, right=1)
  let display = '—';
  let status = '正常';
  if (m.kind === 'R') {
    if (t.kind !== 'R') {
      frac = clamp(0.98 + mechZero, 0, 1);
      display = '禁带电测阻!';
      status = '⚠ 严禁用欧姆档直接测量带电电压/电流源！';
    } else {
      // 表盘左∞(f=0)，右0Ω(f=1)；R_x = R_mid*(1/f - 1) => f = R_mid/(R_mid + R_x)
      const rMid = m.rMid;
      const zeroScale = 1 + ohmZeroPct / 100;
      const fIdeal = rMid / (rMid + t.val);
      frac = clamp(fIdeal * zeroScale + mechZero, 0, 1.03);
      const fEff = clamp(frac, 1e-4, 0.9999);
      const rDial = t.val === 0 && Math.abs(ohmZeroPct) < 0.6 && Math.abs(mechZero) < 0.005
        ? 0
        : rMid * (1 / fEff - 1);
      display = frac <= 0.015 ? '∞' : `${rDial >= 1000 ? (rDial / 1000).toFixed(2) + ' kΩ' : rDial.toFixed(1) + ' Ω'}`;
      if (t.val > 0 && (fIdeal < 0.16 || fIdeal > 0.84) && t.val < 1e5) {
        status = fIdeal < 0.16 ? '偏转过小，建议调大欧姆倍率' : '偏转过大，建议调小欧姆倍率';
      } else if (Math.abs(ohmZeroPct) > 0.5) {
        status = `欧姆未调零 (偏差 ${ohmZeroPct > 0 ? '+' : ''}${ohmZeroPct.toFixed(1)}%)`;
      } else {
        status = t.val > 1e5 ? '反向截止（电阻极高）' : '指针落于中值读数区';
      }
    }
  } else if (m.kind === t.kind) {
    frac = clamp(t.val / m.full + mechZero, 0, 1.03);
    const val = frac * m.full;
    display = `${val.toFixed(m.kind === 'V' ? 2 : 1)} ${m.kind}`;
  } else {
    frac = clamp(mechZero, 0, 1);
    display = '0 (档位不匹配)';
    status = '表笔未接入对应物理量';
  }
  return { m, t, frac, display, status };
}

function drawMultimeterDial2D(x, W, H, res) {
  x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H * 0.92, R = H * 0.74;
  const ang = (f) => Math.PI * (1.2 + 0.6 * f); // 左侧 1.2π 到右侧 1.8π

  // 顶弧：非线性欧姆刻度（左 ∞ → 右 0）
  x.strokeStyle = C.ink; x.lineWidth = 1.8;
  x.beginPath(); x.arc(cx, cy, R, ang(0), ang(1)); x.stroke();
  const ohmTicks = [Infinity, 500, 200, 100, 50, 30, 20, 15, 10, 5, 2, 0];
  x.fillStyle = C.ink; x.font = '10.5px Georgia, serif'; x.textAlign = 'center';
  for (const val of ohmTicks) {
    const f = val === Infinity ? 0 : 15 / (15 + val);
    const a = ang(f);
    x.beginPath();
    x.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    x.lineTo(cx + Math.cos(a) * (R - 11), cy + Math.sin(a) * (R - 11));
    x.stroke();
    x.fillText(val === Infinity ? '∞' : String(val), cx + Math.cos(a) * (R + 14), cy + Math.sin(a) * (R + 14));
  }
  x.fillStyle = C.copper; x.fillText('Ω (×倍率)', cx - R * 0.84, cy - R * 0.45);

  // 中弧：直流 V / mA 线性刻度 (0..10 / 0..50)
  const R2 = R * 0.78;
  x.strokeStyle = '#3b6fe0'; x.lineWidth = 1.4;
  x.beginPath(); x.arc(cx, cy, R2, ang(0), ang(1)); x.stroke();
  x.fillStyle = '#3b6fe0';
  for (let i = 0; i <= 10; i++) {
    const f = i / 10, a = ang(f);
    x.beginPath();
    x.moveTo(cx + Math.cos(a) * R2, cy + Math.sin(a) * R2);
    x.lineTo(cx + Math.cos(a) * (R2 - (i % 2 === 0 ? 10 : 5)), cy + Math.sin(a) * (R2 - (i % 2 === 0 ? 10 : 5)));
    x.stroke();
    if (i % 2 === 0) x.fillText(`${i * (res.m.kind === 'mA' ? 5 : 1)}`, cx + Math.cos(a) * (R2 - 20), cy + Math.sin(a) * (R2 - 20));
  }

  // 指针
  const ap = ang(clamp(res.frac, -0.02, 1.03));
  x.strokeStyle = C.red; x.lineWidth = 2.4;
  x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(ap) * (R - 3), cy + Math.sin(ap) * (R - 3)); x.stroke();
  x.fillStyle = C.ink; x.beginPath(); x.arc(cx, cy, 6, 0, TAU); x.fill();

  x.fillStyle = C.ink; x.font = '600 13px "Noto Serif SC", serif'; x.textAlign = 'left';
  x.fillText(`档位: ${res.m.label}   读数: ${res.display}`, 14, 22);
}

const multimeter = {
  id: 'phy-multimeter',
  subject: 'phy',
  title: '用多用电表测量电学中的物理量',
  en: 'Using a multimeter',
  lede: [
    '多用电表的表头其实是一只微安表：切换拨盘，只是把不同的分压电阻、分流电阻或内部电池接进同一表头。',
    '使用欧姆档前必须短接表笔调零；测量二极管时记住内部电源正极接黑表笔、负极接红表笔（“红进黑出”）。',
  ],
  formula: 'I = E / (R_内 + R_x) · R_中 = R_内',
  formulaNote: '欧姆表盘左 ∞ 右 0 且刻度不均匀；指针指在中值电阻 R_中 附近时读数最准',
  terms: [
    ['欧姆调零', '换欧姆档倍率后内阻改变，必须红黑表笔短接，调可变电阻使指针满偏指 0 Ω。'],
    ['红进黑出', '电流总是从红表笔流入、黑表笔流出；测电阻时黑表笔接内部电源正极。'],
    ['中值电阻', '指针恰好半偏时待测电阻等于欧姆表内阻 R_中 = E/I_g。'],
  ],
  predict: {
    q: '用多用电表“×10”欧姆档测某电阻，指针偏转角度很小（紧靠左侧 ∞ 刻度）。下一步应该怎样操作？',
    options: [
      '直接读出刻度值乘以 10 即可',
      '换用“×100”更大倍率，并重新短接欧姆调零后再测',
      '换用“×1”更小倍率，无需调零直接测',
    ],
    answer: 1,
    why: '指针偏转角小说明待测电阻很大，应增大倍率（如换 ×100）让指针落回中央 1/3 清晰区；且每次更换欧姆档倍率后都必须重新短接表笔欧姆调零！',
  },
  challenge: '依次完成“机械调零 → 选合适欧姆倍率 → 短接调零 → 测 R₁、R₂ 与二极管正反向电阻”，并记录 3 组以上读数！',
  fig: '指针式多用电表、旋钮开关、调零旋钮与被测元件盒',
  hint: '旋转档位与切换被测元件；测欧姆档时可点“短接表笔欧姆调零”修正倍率零点偏差。',
  teach: {
    where: '人教版物理必修第三册第十一章 §11.5《实验：练习使用多用电表》（海南高中物理必做重点实验）',
    ask: [
      '为什么欧姆表的刻度线左侧稀疏、右侧密集（或者左 ∞ 右 0 且非线性）？',
      '测二极管正向电阻时，红表笔应该接二极管的哪一极？为什么？',
    ],
    simplify: '设基准表盘中值刻度为 15（×1 档对应 R_中 = 15 Ω），内部电池 1.5 V；二极管近似用等效静态正/反向阻值表示。',
    safety: '测量电阻前必须断开被测元件所在的外电源；测量未知电压/电流前应先试触最大量程。',
  },
  controls: [
    { id: 'mode', label: '选择开关', type: 'choice', options: MM_MODES.map((m) => m.label), value: 2, wide: true },
    { id: 'target', label: '被测对象', type: 'choice', options: MM_TARGETS.map((t) => t.name), value: 1, wide: true },
    { id: 'mechZero', label: '机械零点偏移', min: -0.05, max: 0.05, step: 0.005, value: 0.0, unit: 'fs' },
    { id: 'ohmZero', label: '欧姆调零微调', min: -12, max: 12, step: 0.5, value: -6.0, unit: '%' },
    { id: 'zeroBtn', type: 'button', label: '短接欧姆调零' },
    { id: 'rec', type: 'button', label: '记录读数' },
  ],
  record: {
    note: '记录不同档位和对象下的表盘读数，验证倍率选择与调零操作对结果的影响。',
    pending: '选择被测对象并完成调零后，按“记录读数”记入实验册。',
    columns: [
      { key: 'modeLabel', label: '档位' },
      { key: 'targetName', label: '被测对象' },
      { key: 'ohmZero', label: '调零偏差', unit: '%', digits: 1 },
      { key: 'display', label: '表盘读数' },
    ],
    sample: (_inst, p) => {
      const res = solveMultimeter(p.mode ?? 2, p.target ?? 1, p.mechZero ?? 0, p.ohmZero ?? 0);
      return { _kind: 'simulated', modeLabel: res.m.label, targetName: res.t.name, ohmZero: p.ohmZero ?? 0, display: res.display };
    },
    summary: (rows) => [['已测物理量组数', `${rows.length} 组`]],
    errors: [
      '换欧姆档未重新调零：不同倍率内部并联/串联分流电阻不同，满偏电流条件改变。',
      '倍率不当使指针落在极左或极右端，刻度非线性压缩导致读数误差急剧增大。',
    ],
  },

  build(k) {
    const p = k.p;
    // 多用电表本体
    const body = at(box(2.8, 0.45, 3.6, '#d9d3c3', { kind: 'card' }), -0.7, 0, -0.3);
    const dialFace = sheet(2.4, 1.5, () => {}, { lay: 'flat', opaque: true });
    dialFace.position.set(-0.7, 0.46, -1.25);
    const needlePivot = at(group(rod([0, 0, 0], [0, 0, -1.05], 0.018, C.red)), -0.7, 0.49, -0.58);
    // 旋钮选择开关 & 调零旋钮
    const knob = group(
      cyl(0.45, 0.16, DARK, { kind: 'metal' }),
      at(box(0.10, 0.18, 0.72, BRASS, { kind: 'metal' }), 0, 0.06, 0),
    );
    knob.position.set(-0.7, 0.46, 0.35);
    const zeroKnob = at(cyl(0.18, 0.16, C.copper, { kind: 'metal' }), 0.28, 0.46, 0.35);
    const info = at(card('\n', { w: 3.1, size: 0.28, align: 'left' }), 2.3, 0, -1.9);

    // 被测组件台（右前方）
    const compBox = at(box(1.9, 0.35, 1.4, '#efe9da'), 2.3, 0, 1.1);
    const compComp = at(box(0.85, 0.24, 0.36, C.copper), 2.3, 0.35, 1.1);
    const redLead = tube([[-0.1, 0.2, 1.15], [0.8, 0.12, 1.8], [1.9, 0.48, 1.1]], 0.035, C.red);
    const blkLead = tube([[-1.3, 0.2, 1.15], [0.5, 0.12, 2.1], [2.7, 0.48, 1.1]], 0.035, DARK);
    k.root.add(body, dialFace, needlePivot, knob, zeroKnob, info, compBox, compComp, redLead, blkLead,
      at(note('选择开关(拖)', { size: 0.22, w: 1.8 }), -0.7, 0.72, 0.92),
      at(note('Ω调零', { size: 0.2, w: 1.0 }), 0.35, 0.72, 0.35));

    const drawDial = (frac) => {
      dialFace.redraw((x, s, w, h) => {
        x.fillStyle = '#fffdf7'; x.fillRect(0, 0, w * s, h * s);
        const cx = (w / 2) * s, cy = h * 0.90 * s, R = h * 0.72 * s;
        x.strokeStyle = C.ink; x.lineWidth = s * 0.018;
        x.beginPath(); x.arc(cx, cy, R, Math.PI * 1.2, Math.PI * 1.8); x.stroke();
        [Infinity, 100, 30, 15, 5, 0].forEach((v) => {
          const f = v === Infinity ? 0 : 15 / (15 + v);
          const a = Math.PI * (1.2 + 0.6 * f);
          x.beginPath(); x.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
          x.lineTo(cx + Math.cos(a) * (R - 0.12 * s), cy + Math.sin(a) * (R - 0.12 * s)); x.stroke();
        });
        x.strokeStyle = '#3b6fe0'; x.lineWidth = s * 0.012;
        x.beginPath(); x.arc(cx, cy, R * 0.72, Math.PI * 1.2, Math.PI * 1.8); x.stroke();
        void frac;
      });
    };
    drawDial(0);

    let dragX = null, mStart = 0;
    k.drag(knob, {
      normal: 'y',
      start: () => { dragX = null; mStart = p.mode; },
      move: (q) => {
        if (dragX === null) { dragX = q.x; return; }
        const nm = clamp(Math.round(mStart + (q.x - dragX) * 1.6), 0, MM_MODES.length - 1);
        if (nm !== p.mode) { k.set('mode', nm); p.ohmZero = -5.5; k.set('ohmZero', p.ohmZero); }
      },
      end: () => { dragX = null; },
    });

    let curFrac = 0;
    return {
      press(id) {
        if (id === 'zeroBtn') {
          k.set('target', 0);
          k.set('ohmZero', 0);
        } else if (id === 'rec') {
          const row = multimeter.record.sample(this, p);
          if (row) k.record(row);
        }
      },
      change(id) {
        if (id === 'mode' && MM_MODES[p.mode]?.kind === 'R') {
          // 每次切换欧姆倍率引入真实未调零漂移，提示用户调零
          p.ohmZero = [-7.0, -5.0, 6.0][p.mode % 3];
          k.set('ohmZero', p.ohmZero);
        }
      },
      update(dt) {
        const res = solveMultimeter(p.mode ?? 2, p.target ?? 1, p.mechZero ?? 0, p.ohmZero ?? 0);
        curFrac = lerp(curFrac, res.frac, dt > 0 ? 1 - Math.exp(-12 * dt) : 1);
        needlePivot.rotation.y = (0.5 - curFrac) * 0.6 * Math.PI;
        knob.rotation.y = -((p.mode - 2) * 0.42);
        zeroKnob.rotation.y = (p.ohmZero / 12) * 1.5;
        info.set(`档位: ${res.m.label}\n读数: ${res.display}\n${res.status}`);
        this._res = res;
      },
      margin() {
        const res = this._res || solveMultimeter(p.mode ?? 2, p.target ?? 1, p.mechZero ?? 0, p.ohmZero ?? 0);
        return [`档位：${res.m.label}`, `对象：${res.t.name}`, `读数：${res.display}`, res.status, '提示：换 Ω 倍率后', '须点“短接欧姆调零”'];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 多用电表高精度表盘判读与倍率优选');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn primary" data-a="zero">短接表笔欧姆调零</button>
      <button type="button" class="wb-btn" data-a="rec">记录本次读数</button>`;
    sec1.append(bar);
    const dial = wb.canvas(sec1, 520, 220, (x, W, H) => {
      const p = sp.params;
      drawMultimeterDial2D(x, W, H, solveMultimeter(p.mode ?? 2, p.target ?? 1, p.mechZero ?? 0, p.ohmZero ?? 0));
    });
    const metrics = document.createElement('div');
    metrics.className = 'wb-metrics';
    sec1.append(metrics);

    const refresh = () => {
      dial.redraw();
      const p = sp.params;
      const r = solveMultimeter(p.mode ?? 2, p.target ?? 1, p.mechZero ?? 0, p.ohmZero ?? 0);
      metrics.innerHTML = `
        <div class="wb-m"><span>当前倍率 / 指针归一化</span><b>${r.m.label} (${(r.frac * 100).toFixed(1)}% 满偏)</b></div>
        <div class="wb-m"><span>表盘判读结果</span><b>${r.display}</b></div>
        <div class="wb-m"><span>规范检查</span><b>${r.status}</b></div>`;
    };
    bar.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'zero') wb.press('zeroBtn');
      else if (a === 'rec') wb.press('rec');
      refresh();
    });
    refresh();
    return { update() { refresh(); } };
  },
};

// ===========================================================================
// 3. phy-emf (L4) — 测量电源的电动势和内阻 (升级自 phy2.js#phy-emf)
// ===========================================================================
const EMF_BATS = [
  { name: '新干电池', E: 1.50, r: 0.45 },
  { name: '旧干电池', E: 1.38, r: 1.85 },
];
const EMF_RA = 0.35;
const EMF_RV = 30.0; // 教学低阻值电压表以便在 U-I 坐标上清晰呈现外接法系统误差

function solveEmfCircuit(batIdx, R, connMode) {
  const bat = EMF_BATS[batIdx] || EMF_BATS[0];
  const { E, r } = bat;
  if (connMode === 0) {
    // 理想电表
    const I = E / (R + r);
    return { bat, I, U: E - I * r, P: I * (E - I * r), Eeff: E, reff: r };
  }
  if (connMode === 1) {
    // 电源外接法（电压表并接在电源两端，测得 E_测 与 r_测 均偏小）
    const Rpar = (R * EMF_RV) / (R + EMF_RV);
    const U = (E * Rpar) / (r + Rpar);
    const I = U / R; // 电流表只测通过变阻器的电流
    return {
      bat, I, U, P: U * I,
      Eeff: (E * EMF_RV) / (EMF_RV + r),
      reff: (r * EMF_RV) / (EMF_RV + r),
    };
  }
  // 电源内接法（电流表串联紧贴电源，测得 E_测=E 准，r_测=r+R_A 偏大）
  const I = E / (R + r + EMF_RA);
  const U = I * R;
  return { bat, I, U, P: U * I, Eeff: E, reff: r + EMF_RA };
}

const emf = {
  id: 'phy-emf',
  subject: 'phy',
  title: '测量电源的电动势和内阻',
  en: 'Measuring EMF and internal resistance',
  lede: [
    '电池不是一个“恒定 1.5 V”。电流越大，电池内阻吃掉的电压 Ir 就越多，路端电压 U = E − Ir 随电流线性下降。',
    '在实验台切换理想电表与真实“外接法 / 内接法”，观察有限内阻电表如何把 U–I 直线旋转或平移，造成截距 E 与斜率 r 的系统误差。',
  ],
  formula: 'U = E − I r · r_测 = −dU / dI',
  formulaNote: '纵截距为电源电动势 E，斜率绝对值为内阻 r；对比外接（E↓, r↓）与内接（E准, r↑）误差',
  terms: [
    ['电动势 E', '电源非静电力把单位正电荷从负极搬到正极所做的功。'],
    ['电源外接法', '电压表直接测路端电压，电流表只测外电阻电流；漏计 I_V 导致 E_测、r_测 均偏小。'],
    ['电源内接法', '电流表测真实总电流，电压表包含了 I·R_A 压降；导致 E_测 准确但 r_测 = r + R_A 偏大。'],
  ],
  predict: {
    q: '用电流表“相对电源外接法”（图甲，电压表并接电池两端）测干电池电动势和内阻，系统误差方向是？',
    options: [
      'E_测 偏大，r_测 偏大',
      'E_测 偏小，r_测 偏小（因为电压表分流，但短路点无分流保持准确）',
      'E_测 准确，r_测 偏大',
    ],
    answer: 1,
    why: '外接法中当 U = 0（短路）时电压表分流为零，因此横轴截距 I_短 准确；当 I_A = 0 时仍有 I_V 电流经过内阻，故测得开路电压低于真实 E，整条线以短路点为枢轴向下偏转，E_测 与 r_测 均偏小！',
  },
  challenge: '分别在“电源外接法”与“电源内接法”下采集 5 组 U–I 数据，在工作台对比回归出的 E、r 与真实值的系统偏差！',
  fig: '干电池、滑动变阻器、电流表、电压表与实时 U–I 坐标图',
  hint: '拖动变阻器滑片或按“记录一组”，切换电表接法观察 U–I 直线斜率与截距的变化。',
  teach: {
    where: '人教版物理必修第三册第十二章 §12.3《实验：电池电动势和内阻的测量》（海南高中物理必做重点实验）',
    ask: [
      '为什么测量干电池（内阻 r 很小，约 0.5 Ω）时，常用“相对电源外接法”而不是“内接法”？',
      '若采用旧电池（r ≈ 1.85 Ω），最大输出功率何时达到峰值？这时的电源效率是多少？',
    ],
    simplify: '设电流表内阻 R_A = 0.35 Ω、教学电压表内阻 R_V = 30 Ω（故意取较低值以便直观观察分流导致的 E、r 偏小趋势）；短时测量不计极化效应。',
  },
  controls: [
    { id: 'R', label: '变阻器 R', min: 0.6, max: 12, step: 0.2, value: 4.0, unit: 'Ω' },
    { id: 'bat', type: 'choice', label: '电池', options: ['新干电池', '旧干电池'], value: 0 },
    { id: 'conn', type: 'choice', label: '系统误差接法', options: ['理想电表', '电源外接法', '电源内接法'], value: 1, wide: true },
    { id: 'rec', type: 'button', label: '记录一组' },
    { id: 'clr', type: 'button', label: '清空图点' },
  ],
  record: {
    note: '采集多组 (I, U) 并计算 U–I 最小二乘回归截距 E 与斜率绝对值 r。',
    pending: '调节变阻器 R 并点击“记录一组”采集至少 2 组数据。',
    columns: [
      { key: 'batName', label: '电池' },
      { key: 'connName', label: '接法' },
      { key: 'I', label: '电流 I', unit: 'A', digits: 3 },
      { key: 'U', label: '电压 U', unit: 'V', digits: 3 },
      { key: 'P', label: '输出功率 P', unit: 'W', digits: 3 },
    ],
    sample: (_inst, p) => {
      const s = solveEmfCircuit(p.bat ?? 0, p.R ?? 4, p.conn ?? 1);
      return {
        _kind: 'simulated',
        batName: s.bat.name,
        connName: ['理想', '外接法', '内接法'][p.conn ?? 1],
        I: s.I, U: s.U, P: s.P,
      };
    },
    summary: (rows) => {
      const reg = linearRegression(rows.map((r) => [r.I, r.U]));
      return [
        ['已录样本数', `${rows.length} 组`],
        ['回归电动势 E_fit', reg ? `${reg.b.toFixed(3)} V` : '需 ≥2 组'],
        ['回归内阻 r_fit', reg ? `${(-reg.k).toFixed(3)} Ω (R²=${reg.r2.toFixed(4)})` : '—'],
      ];
    },
    errors: [
      '外接法：U = E·R_V/(R_V+r) − I·(rR_V)/(R_V+r)，E 与 r 均系统偏小。',
      '内接法：U = E − I(r + R_A)，E 准确但 r 系统偏大 R_A。',
    ],
  },

  build(k) {
    const p = k.p, y = 0.05;
    k.root.add(
      rot(at(cyl(0.35, 1.5, C.shade), 2.35, 0.36, -2.85), 0, 0, Math.PI / 2),
      rot(at(cyl(0.11, 0.16, BRASS, { kind: 'metal' }), 2.51, 0.36, -2.85), 0, 0, Math.PI / 2),
      at(note('+', { size: 0.36 }), 2.45, 0.95, -2.85),
      at(note('−', { size: 0.36 }), 0.9, 0.95, -2.85),
    );
    const loop = [[2.55, y, -2.85], [3.4, y, -2.85], [3.4, y, 1.85], [-3.4, y, 1.85], [-3.4, y, -2.85], [0.85, y, -2.85]];
    for (let i = 0; i < loop.length - 1; i++) k.root.add(wire(loop[i], loop[i + 1], 0.028));
    const cur = flow([...loop, [2.55, y, -2.85]], 28, C.amber, { r: 0.075 });
    const rheo = makeRheostat(0, 1.85, 3.2);
    const Am = at(meter('A', { w: 1.5, h: 1.1 }), 3.3, 0, 0.4);
    const Vm = at(meter('V', { w: 1.5, h: 1.1 }), 1.7, 0, -0.8);
    const vLeadOuter = group(wire([0.85, y, -2.85], [1.1, y, -0.8]), wire([2.55, y, -2.85], [2.3, y, -0.8]));
    const vLeadInner = group(wire([0.85, y, -2.85], [1.1, y, -0.8]), wire([3.3, y, 1.0], [2.3, y, -0.8]));
    const g = at(plot({ w: 3.8, h: 2.9, xr: [0, 1.6], yr: [0.4, 1.6], xl: 'I / A', yl: 'U / V' }), -2.15, 0, -3.2);
    k.root.add(rheo, Am, Vm, vLeadOuter, vLeadInner, cur, g);

    const pts = [];
    let fit = null;
    const draw = () => {
      const curS = solveEmfCircuit(p.bat ?? 0, p.R ?? 4, p.conn ?? 1);
      g.clear();
      // 画理论参考虚线（理想线）
      g.fn((x) => curS.bat.E - curS.bat.r * x, KIND.theory.color, 0.025, true);
      fit = linearRegression(pts);
      if (fit) {
        g.fn((x) => fit.b + fit.k * x, C.violet, 0.032, false);
      }
      pts.forEach((q) => g.dot(q[0], q[1]));
      g.dot(curS.I, curS.U, C.amber, 0.085).done();
    };
    draw();

    // 拖动变阻器滑片
    let dX = null, r0 = 0;
    k.drag(rheo.slider, {
      normal: 'y',
      start: () => { dX = null; r0 = p.R; },
      move: (q) => {
        if (dX === null) { dX = q.x; return; }
        k.set('R', clamp(Math.round((r0 + (q.x - dX) * 4) * 5) / 5, 0.6, 12));
        draw();
      },
      end: () => { dX = null; },
    });

    return {
      press(id) {
        const s = solveEmfCircuit(p.bat ?? 0, p.R ?? 4, p.conn ?? 1);
        if (id === 'rec') {
          pts.push([s.I, s.U]);
          const row = emf.record.sample(this, p);
          if (row) k.record(row);
        } else if (id === 'clr') {
          pts.length = 0;
        }
        draw();
      },
      change(id) {
        if (id === 'bat' || id === 'conn') pts.length = 0;
        draw();
      },
      update(dt) {
        const s = solveEmfCircuit(p.bat ?? 0, p.R ?? 4, p.conn ?? 1);
        rheo.setFrac((p.R - 0.6) / (12 - 0.6));
        vLeadOuter.visible = p.conn !== 2;
        vLeadInner.visible = p.conn === 2;
        Am.set(clamp(s.I / 1.6), `${s.I.toFixed(2)} A`);
        Vm.set(clamp(s.U / 1.8), `${s.U.toFixed(2)} V`);
        cur.step(dt, clamp(s.I * 3.0, 0.2, 4.5));
        this._s = s;
        this._fit = fit;
      },
      margin() {
        const s = this._s || solveEmfCircuit(p.bat ?? 0, p.R ?? 4, p.conn ?? 1);
        return [
          `${s.bat.name} (真 E=${s.bat.E}V, r=${s.bat.r}Ω)`,
          `I = ${s.I.toFixed(3)} A · U = ${s.U.toFixed(3)} V`,
          ...(this._fit ? [`拟合 E ≈ ${this._fit.b.toFixed(3)} V`, `拟合 r ≈ ${(-this._fit.k).toFixed(3)} Ω`] : [`已采集 ${pts.length} 点`, '采集 ≥2 点显示回归线']),
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 电源 U–I 线性回归与内外接系统误差对照');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn primary" data-a="sweep">当前接法自动采 5 组 (0.8–10 Ω)</button>
      <button type="button" class="wb-btn" data-a="sample">采集当前点</button>
      <button type="button" class="wb-btn" data-a="swap">切换接法对比</button>`;
    sec1.append(bar);
    const chart = wb.regressionChart(sec1, {
      w: 510, h: 235, xLabel: '电流 I (A)', yLabel: '路端电压 U (V)', xRange: [0, 1.6], yRange: [0.3, 1.65],
    });
    const out = document.createElement('div');
    out.className = 'wb-metrics';
    sec1.append(out);

    const refresh = () => {
      const p = sp.params;
      const bat = EMF_BATS[p.bat ?? 0];
      const conn = p.conn ?? 1;
      const connName = ['理想', '外接法', '内接法'][conn];
      const rows = wb.rows().filter((r) => r.batName === bat.name && r.connName === connName);
      const pts = rows.map((r) => [r.I, r.U, r._kind || 'simulated']);
      const reg = linearRegression(pts);
      chart.redraw({
        pts,
        xRange: [0, 1.6], yRange: [0.3, 1.65],
        theoryFn: (iv) => bat.E - bat.r * iv,
      });
      const eTrue = bat.E, rTrue = bat.r;
      const curTh = solveEmfCircuit(p.bat ?? 0, p.R ?? 4, conn);
      out.innerHTML = `
        <div class="wb-m"><span>真值 / 模型有效值</span><b>E=${eTrue.toFixed(2)}V, r=${rTrue.toFixed(2)}Ω → ${curTh.Eeff.toFixed(3)}V, ${curTh.reff.toFixed(3)}Ω</b></div>
        <div class="wb-m"><span>工作台回归 (${rows.length}组)</span><b>${reg ? `E=${reg.b.toFixed(3)}V, r=${(-reg.k).toFixed(3)}Ω` : '需 ≥2 组数据'}</b></div>
        <div class="wb-m"><span>误差方向判定</span><b>${conn === 1 ? '外接法：E偏小, r偏小' : conn === 2 ? '内接法：E准确, r偏大 (+0.35Ω)' : '理想对照无系统误差'}</b></div>`;
    };
    bar.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      const p = sp.params;
      if (a === 'sweep') {
        [0.8, 1.8, 3.5, 6.0, 10.0].forEach((R) => {
          const s = solveEmfCircuit(p.bat ?? 0, R, p.conn ?? 1);
          wb.record({ _kind: 'simulated', batName: s.bat.name, connName: ['理想', '外接法', '内接法'][p.conn ?? 1], I: s.I, U: s.U, P: s.P });
        });
      } else if (a === 'sample') {
        wb.press('rec');
      } else if (a === 'swap') {
        wb.setParam('conn', ((p.conn ?? 1) + 1) % 3);
      }
      refresh();
    });
    refresh();
    return { update() { refresh(); } };
  },
};

// ===========================================================================
// 4. phy-capacitor (L3) — 观察电容器的充、放电现象
// ===========================================================================
const CAP_E = 6.0;

function rcIntegrate(R, CuF, mode, tMax) {
  const C_F = CuF * 1e-6;
  const tau = R * C_F;
  const n = 120;
  const dt = tMax / n;
  const pts = [];
  let qTrap = 0;
  let prevI = 0;
  for (let i = 0; i <= n; i++) {
    const t = i * dt;
    const mag = (CAP_E / R) * Math.exp(-t / tau);
    const I = mode === 2 ? -mag : mag; // 1: 充电(+), 2: 放电(-)
    pts.push([t, I * 1000]); // mA
    if (i > 0) qTrap += 0.5 * (Math.abs(prevI) + Math.abs(I)) * dt;
    prevI = I;
  }
  const qExact = C_F * CAP_E * (1 - Math.exp(-tMax / tau));
  return { tau, pts, qTrap, qExact, cEstuF: (qTrap / CAP_E) * 1e6 };
}

const capacitor = {
  id: 'phy-capacitor',
  subject: 'phy',
  title: '观察电容器的充、放电现象',
  en: 'Capacitor charging and discharging',
  lede: [
    '把单刀双掷开关拨向电源，电流从电源流出充入极板，灵敏电流计指针猛然一偏随即缓慢回零；再拨向放电回路，电流反向涌出，同样指数衰减。',
    'I–t 曲线下围成的面积就是流过的总电荷量 Q。用方格数一数或用梯形积分算出 Q，就能检验电容的定义式 C = Q / U。',
  ],
  formula: 'I(t) = ± (E / R) e^(−t / RC) · Q = ∫ I(t) dt = C U',
  formulaNote: '时间常数 τ = RC 决定充放电快慢；经过 5τ 后电荷量已达终值的 99.3%',
  terms: [
    ['时间常数 τ', 'τ = R·C，单位秒 (s)；经过 1 个 τ，电流衰减至初值的 1/e ≈ 36.8%。'],
    ['I–t 图像面积', '微元思想 i·Δt = Δq，曲线与时间轴围成的总面积等于迁移电荷量 Q。'],
    ['双向电流', '充电时电流流入正极板，放电时电流从正极板流出，二者方向恰好相反。'],
  ],
  predict: {
    q: '在 E = 6 V 的 RC 电路中，保持电容 C 不变，把串联电阻 R 增大为原来的 2 倍，充电结束时电容器最终存储的总电荷量 Q 会怎样变化？',
    options: ['变成原来的一半', '保持不变（只变慢，最终充满仍满足 Q = CE）', '变成原来的 2 倍'],
    answer: 1,
    why: 'R 增大后，起始充电电流 E/R 减半，时间常数 τ = RC 加倍，充电过程变慢，但曲线拉长 2 倍后总积分面积 Q = ∫(E/R)e^(−t/RC)dt = CE 完全不变！',
  },
  challenge: '调出 τ = 2.0 s 的充放电组合，观察一轮完整充电与放电，并在工作台用梯形积分与网格计数推算出电容值 C！',
  fig: '6 V 电源、单刀双掷开关、电阻 R、电解电容 C、电流计 G 与 I–t 示波屏',
  hint: '拨动“单刀双掷开关”切换充电 / 断开 / 放电；调节 R 和 C 观察时间常数 τ = RC 变化。',
  teach: {
    where: '人教版物理必修第三册第十章 §10.4《电容器的电容：实验：观察电容器的充、放电现象》',
    ask: [
      '充电曲线和放电曲线在 I–t 图像上有什么对称关系？',
      '为什么电解电容器在真实实验中要注意正负极性不可接反？',
    ],
    simplify: '设电源内阻可忽略，电容无漏电；为使教学过程清晰可观，电阻取 500–2500 Ω、电容取 500–3000 μF（τ 约 0.25–7.5 s）。',
  },
  controls: [
    { id: 'sw', label: '单刀双掷开关', type: 'choice', options: ['断开', '1 · 充电 (接6V)', '2 · 放电'], value: 1, wide: true },
    { id: 'R', label: '串联电阻 R', min: 500, max: 2500, step: 100, value: 1000, unit: 'Ω' },
    { id: 'Cval', label: '电容 C', min: 500, max: 3000, step: 100, value: 2000, unit: 'μF' },
    { id: 'rec', type: 'button', label: '记录积分测算 C' },
  ],
  record: {
    note: '记录电阻 R、标称电容 C，与 I–t 数值积分求出的总电荷量 Q 及反演电容 C = Q/E。',
    pending: '运行充电或放电后点击“记录积分测算 C”。',
    columns: [
      { key: 'mode', label: '过程' },
      { key: 'R', label: 'R', unit: 'Ω', digits: 0 },
      { key: 'Cnom', label: '标称 C', unit: 'μF', digits: 0 },
      { key: 'Q', label: '积分 Q', unit: 'mC', digits: 2 },
      { key: 'Cest', label: '测算 C', unit: 'μF', digits: 1, stat: true },
    ],
    sample: (_inst, p) => {
      const m = p.sw === 2 ? 2 : 1;
      const tau = (p.R ?? 1000) * (p.Cval ?? 2000) * 1e-6;
      const res = rcIntegrate(p.R ?? 1000, p.Cval ?? 2000, m, 6 * tau);
      return {
        _kind: 'model',
        mode: m === 2 ? '放电' : '充电',
        R: p.R, Cnom: p.Cval, Q: res.qTrap * 1000, Cest: res.cEstuF,
      };
    },
    summary: (rows) => {
      const st = sampleStats(rows.map((r) => r.Cest));
      return [['积分测算组数', `${rows.length} 组`], ['平均测算电容', st.n ? `${st.mean.toFixed(1)} μF` : '—']];
    },
    errors: [
      '若采样时间 t_max 过短（不足 5τ），尾部余面积被截断会造成测得 Q 与 C 系统偏小。',
    ],
  },

  build(k) {
    const p = k.p;
    // 元件布局
    k.root.add(
      at(box(1.1, 0.7, 0.8, '#d8d2c5'), -2.7, 0, 1.3),
      at(note('6 V', { size: 0.25, w: 0.8 }), -2.7, 0.82, 1.3),
      at(box(1.4, 0.36, 0.42, C.wood, { kind: 'wood' }), -0.7, 0, 1.5),
      at(note('R', { size: 0.28, w: 0.6 }), -0.7, 0.52, 1.5),
      at(cyl(0.36, 0.95, '#3b6fe0', { kind: 'metal' }), 1.2, 0, 1.4),
      at(cyl(0.37, 0.14, STEEL, { kind: 'metal' }), 1.2, 0.95, 1.4),
      at(note('C', { size: 0.28, w: 0.6 }), 1.2, 1.25, 1.4),
    );
    const blade = group(rot(at(box(0.08, 0.08, 0.85, C.copper, { kind: 'metal' }), 0, 0, -0.4), 0, 0, 0));
    blade.position.set(-1.7, 0.25, 1.4);
    const Gm = at(meter('G', { center: true, w: 1.5, h: 1.1 }), 0.2, 0, -0.35);
    const Vm = at(meter('V', { w: 1.4, h: 1.0 }), 2.4, 0, -0.35);
    const scope = at(plot({ w: 3.9, h: 2.5, xr: [0, 10], yr: [-12, 12], xl: 't / s', yl: 'I / mA' }), -1.65, 0, -2.55);
    const capChargeGlow = glow(C.sky, 1.3, 0);
    capChargeGlow.position.set(1.2, 0.5, 1.4);
    const curLoop = flow([[1.2, 0.08, 1.4], [-0.7, 0.08, 1.5], [0.2, 0.08, -0.35], [1.2, 0.08, -0.35], [1.2, 0.08, 1.4]], 18, C.amber, { r: 0.07 });
    k.root.add(blade, Gm, Vm, scope, capChargeGlow, curLoop,
      makeWireLoop([[-2.15, 0.06, 1.3], [-1.7, 0.06, 1.4], [-0.7, 0.06, 1.5], [1.2, 0.06, 1.4], [1.2, 0.06, -0.35], [0.2, 0.06, -0.35], [-1.7, 0.06, -0.35], [-1.7, 0.06, 1.4]], 0.024, C.ink));

    let uc = 0, t = 0;
    const trace = [];
    return {
      press(id) {
        if (id === 'rec') {
          const row = capacitor.record.sample(this, p);
          if (row) k.record(row);
        }
      },
      change(id) {
        if (id === 'sw') {
          trace.length = 0; t = 0;
          if (p.sw === 2 && uc < 0.5) uc = CAP_E; // 直接点放电时先预充至 6V 便于立即观测
          if (p.sw === 1 && uc > 5.5) uc = 0;
        }
      },
      update(dt) {
        const tau = (p.R ?? 1000) * (p.Cval ?? 2000) * 1e-6;
        let I = 0;
        if (p.sw === 1) {
          if (dt > 0) uc += (CAP_E - uc) * (1 - Math.exp(-dt / tau));
          I = (CAP_E - uc) / p.R;
        } else if (p.sw === 2) {
          if (dt > 0) uc *= Math.exp(-dt / tau);
          I = -uc / p.R;
        }
        if (dt > 0 && p.sw !== 0) {
          t += dt;
          if (t <= 10) trace.push([t, I * 1000]);
          if (trace.length > 180) trace.shift();
        }
        blade.rotation.y = p.sw === 1 ? 0.5 : p.sw === 2 ? -0.5 : 0;
        const iMaxMa = (CAP_E / p.R) * 1000;
        Gm.set(clamp((I * 1000) / Math.max(6, iMaxMa), -1, 1), `${(I * 1000).toFixed(2)} mA`);
        Vm.set(clamp(uc / CAP_E), `${uc.toFixed(2)} V`);
        capChargeGlow.material.opacity = (uc / CAP_E) * 0.55;
        curLoop.step(dt, clamp(I * 350, -4, 4));
        curLoop.visible = Math.abs(I) > 1e-4;
        if (trace.length >= 2 || dt === 0) {
          const yrMax = Math.ceil(Math.max(8, iMaxMa * 1.1));
          scope.range([0, 10], [-yrMax, yrMax]).clear();
          if (trace.length >= 2) scope.curve(trace, C.violet, 0.036);
          scope.done();
        }
        this._state = { uc, I, tau };
      },
      margin() {
        const s = this._state || { uc: 0, I: 0, tau: 2 };
        return [
          `τ = RC = ${s.tau.toFixed(2)} s`,
          `电容电压 U_C = ${s.uc.toFixed(2)} V`,
          `瞬时电流 I = ${(s.I * 1000).toFixed(2)} mA`,
          `电荷量 Q = ${((p.Cval ?? 2000) * 1e-3 * s.uc).toFixed(2)} mC`,
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec = wb.section('1 · 示波器 I–t 曲线网格计数与梯形积分求电容 C = Q / U');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn primary" data-a="chg">完整充电脉冲</button>
      <button type="button" class="wb-btn" data-a="dis">完整放电脉冲</button>
      <button type="button" class="wb-btn" data-a="rec">记录积分结果</button>`;
    sec.append(bar);
    let tCutoff = 1.0; // fraction of 6*tau
    let pulseMode = 1;
    const cv = wb.canvas(sec, 520, 235, (x, W, H) => {
      const p = sp.params;
      const R = p.R ?? 1000, CuF = p.Cval ?? 2000;
      const tau = R * CuF * 1e-6;
      const tMax = 6 * tau;
      const res = rcIntegrate(R, CuF, pulseMode, tMax * tCutoff);
      const pad = { l: 52, r: 20, t: 22, b: 36 }, pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      const iMax = (CAP_E / R) * 1000 * 1.1;
      const sx = (tv) => pad.l + (tv / tMax) * pw;
      const sy = (im) => pad.t + ph - (Math.abs(im) / iMax) * ph;

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      // 10x8 计量方格
      const nx = 10, ny = 8;
      x.strokeStyle = 'rgba(30,43,54,0.13)'; x.lineWidth = 1;
      for (let i = 0; i <= nx; i++) {
        const gx = pad.l + (pw * i) / nx;
        x.beginPath(); x.moveTo(gx, pad.t); x.lineTo(gx, pad.t + ph); x.stroke();
      }
      for (let j = 0; j <= ny; j++) {
        const gy = pad.t + (ph * j) / ny;
        x.beginPath(); x.moveTo(pad.l, gy); x.lineTo(pad.l + pw, gy); x.stroke();
      }

      // 填充梯形积分阴影区
      x.fillStyle = pulseMode === 1 ? 'rgba(58, 156, 255, 0.22)' : 'rgba(180, 101, 58, 0.22)';
      x.beginPath();
      x.moveTo(sx(0), sy(0));
      res.pts.forEach(([tv, im]) => x.lineTo(sx(tv), sy(im)));
      x.lineTo(sx(tMax * tCutoff), sy(0));
      x.closePath();
      x.fill();

      // 曲线
      x.strokeStyle = pulseMode === 1 ? C.blue : C.copper;
      x.lineWidth = 2.2;
      x.beginPath();
      res.pts.forEach(([tv, im], i) => (i === 0 ? x.moveTo(sx(tv), sy(im)) : x.lineTo(sx(tv), sy(im))));
      x.stroke();

      // 轴与标尺
      x.strokeStyle = C.ink; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();
      x.fillStyle = C.ink; x.font = '11px Georgia, serif'; x.textAlign = 'center';
      x.fillText(`0`, pad.l, H - 18);
      x.fillText(`${tMax.toFixed(2)} s (6τ)`, pad.l + pw - 20, H - 18);
      x.fillText('时间 t (s)', pad.l + pw / 2, H - 5);
      x.textAlign = 'right';
      x.fillText('0', pad.l - 6, pad.t + ph);
      x.fillText(`${iMax.toFixed(1)}`, pad.l - 6, pad.t + 8);
      x.textAlign = 'left';
      x.fillText(`|I(t)| (mA) · 单格电荷 Δq = ${((tMax / nx) * (iMax / ny)).toFixed(3)} mC`, pad.l + 8, pad.t + 12);
    });

    const ctlRow = document.createElement('div');
    ctlRow.className = 'wb-row';
    wbRangeRow(ctlRow, '积分截止时间 (×6τ)', 0.2, 1.0, 0.05, 1.0, '', (v) => { tCutoff = v; refresh(); });
    sec.append(ctlRow);
    const metrics = document.createElement('div');
    metrics.className = 'wb-metrics';
    sec.append(metrics);

    const refresh = () => {
      cv.redraw();
      const p = sp.params;
      const R = p.R ?? 1000, CuF = p.Cval ?? 2000;
      const tau = R * CuF * 1e-6;
      const res = rcIntegrate(R, CuF, pulseMode, 6 * tau * tCutoff);
      const cellQ = ((6 * tau) / 10) * (((CAP_E / R) * 1000 * 1.1) / 8); // mC/格
      const nSquares = (res.qTrap * 1000) / Math.max(1e-6, cellQ);
      metrics.innerHTML = `
        <div class="wb-m"><span>时间常数 τ = RC</span><b>${tau.toFixed(2)} s</b></div>
        <div class="wb-m"><span>等效方格数 / 积分 Q</span><b>${nSquares.toFixed(1)} 格 → ${(res.qTrap * 1000).toFixed(2)} mC</b></div>
        <div class="wb-m"><span>算得 C = Q / 6V</span><b>${res.cEstuF.toFixed(1)} μF (标称 ${CuF} μF)</b></div>`;
    };
    bar.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'chg') { pulseMode = 1; wb.setParam('sw', 1); }
      else if (a === 'dis') { pulseMode = 2; wb.setParam('sw', 2); }
      else if (a === 'rec') wb.press('rec');
      refresh();
    });
    refresh();
    return { update() { refresh(); } };
  },
};

// ===========================================================================
// 5. phy-refract (L3) — 测量玻璃的折射率与全反射 (升级自 phy2.js#phy-refract)
// ===========================================================================
const REFRACT_MEDIA = [
  { name: '水 (1.33)', n: 1.33 },
  { name: '冕牌玻璃 (1.50)', n: 1.50 },
  { name: '重火石玻璃 (1.65)', n: 1.65 },
  { name: '金刚石 (2.42)', n: 2.42 },
];

const refract = {
  id: 'phy-refract',
  subject: 'phy',
  title: '测量玻璃的折射率与全反射',
  en: 'Refractive index & total internal reflection',
  lede: [
    '光斜射进玻璃砖会在界面弯折，满足斯涅耳定律 n₁ sin i = n₂ sin r；平行玻璃砖出射光平行于入射光，只产生侧向平移。',
    '把平行砖换成半圆砖、让光从介质射向空气：入射角超过临界角 sin C = 1/n 时折射光突然消失，进入全反射状态。',
  ],
  formula: 'n₁ sin i = n₂ sin r · sin C = 1 / n',
  formulaNote: '以 sin i 为纵轴、sin r 为横轴作线性回归，直线斜率即介质折射率 n',
  terms: [
    ['插针法', '在玻璃砖一侧插两枚大头针 P₁、P₂ 确定入射光，在另一侧依次插 P₃、P₄ 挡住像，连线即可确定折射角。'],
    ['折射率 n', '光在真空中速度与在介质中速度之比 n = c / v，定量决定光线偏折程度。'],
    ['全反射临界角 C', '光由光密介质射向光疏介质、折射角恰好到达 90° 时的入射角。'],
  ],
  predict: {
    q: '在“插针法”测平行玻璃砖折射率实验中，若画玻璃砖下表面边界线时不小心向下平移了 2 mm（偏离真实玻璃砖），算出的折射率 n 会？',
    options: ['偏大', '偏小', '不变'],
    answer: 1,
    why: '出射光线与入射光线仍平行，但若画线向下偏移，连接入射点 O 与出射点 O′ 的作图光线偏折角度变小、测得折射角 r 偏大，因此 n = sin i / sin r 偏小。',
  },
  challenge: '在工作台亲手拖动大头针 P₃、P₄ 对齐四针一线，采集 4 组角度用 sin i – sin r 线性回归测出折射率 n！',
  fig: '量角圆盘、可切换半圆/平行玻璃砖、激光器与四枚光学大头针',
  hint: '切换“半圆砖全反射”或“平行砖插针”；调入射角看折射率、侧移与反射率变化。',
  teach: {
    where: '人教版物理选择性必修第一册第四章 §4.2《实验：测量玻璃的折射率》与 §4.3《全反射》',
    ask: [
      '半圆形玻璃砖为什么要求入射光线必须对准圆心 O 入射？',
      '为什么测量时入射角不宜太小（如 < 15°）也不宜太大（如 > 80°）？',
    ],
    simplify: '设单色光无色散、界面理想光滑；反射光强度按菲涅耳公式计算。',
  },
  controls: [
    { id: 'shape', type: 'choice', label: '玻璃砖构型', options: ['半圆砖 (折射/全反射)', '平行砖 (插针法)'], value: 0, wide: true },
    { id: 'i', label: '入射角 i', min: 5, max: 85, step: 1, value: 40, unit: '°' },
    { id: 'n', type: 'choice', label: '介质', options: REFRACT_MEDIA.map((m) => m.name), value: 1, wide: true },
    { id: 'dir', type: 'choice', label: '半圆砖光路', options: ['空气 → 介质', '介质 → 空气'], value: 0, wide: true },
    { id: 'rec', type: 'button', label: '记录折射角度' },
  ],
  record: {
    note: '记录入射角 i 与折射角 r 的正弦值，用 sin i–sin r 线性回归测定折射率 n。',
    pending: '选择角度后点击“记录折射角度”或在工作台对齐大头针后记录。',
    columns: [
      { key: 'med', label: '介质' },
      { key: 'iDeg', label: 'i', unit: '°', digits: 1 },
      { key: 'rDeg', label: 'r', unit: '°', digits: 1 },
      { key: 'sinI', label: 'sin i', digits: 4 },
      { key: 'sinR', label: 'sin r', digits: 4 },
      { key: 'nEst', label: 'n = sin i/sin r', digits: 3, stat: true },
    ],
    sample: (_inst, p) => {
      const med = REFRACT_MEDIA[p.n ?? 1];
      const iRad = (p.i ?? 40) * DEG;
      const rRad = Math.asin(Math.sin(iRad) / med.n);
      return {
        _kind: 'simulated',
        med: med.name,
        iDeg: p.i, rDeg: rRad / DEG,
        sinI: Math.sin(iRad), sinR: Math.sin(rRad),
        nEst: Math.sin(iRad) / Math.sin(rRad),
      };
    },
    summary: (rows) => {
      const reg = linearRegression(rows.map((r) => [r.sinR, r.sinI]));
      return [
        ['已采集角度组数', `${rows.length} 组`],
        ['sin i–sin r 回归 n', reg ? `${reg.k.toFixed(4)} (R²=${reg.r2.toFixed(4)})` : '需 ≥2 组'],
      ];
    },
    errors: [
      '大头针间距过近会导致视线对准角误差放大；P₁P₂、P₃P₄ 间距宜尽量拉大。',
    ],
  },

  build(k) {
    const p = k.p, R = 3.1, Y = 0.30, O = [0, Y, 0.25];
    const disc = at(sheet(R * 2 + 0.5, R * 2 + 0.5, (x, S, w) => {
      const c = (w * S) / 2;
      x.strokeStyle = C.ink; x.lineWidth = S * 0.024;
      x.beginPath(); x.arc(c, c, R * S, 0, TAU); x.stroke();
      for (let a = 0; a < 360; a += 10) {
        const t = a * DEG, l = a % 30 ? 0.12 : 0.24;
        x.beginPath();
        x.moveTo(c + Math.sin(t) * R * S, c - Math.cos(t) * R * S);
        x.lineTo(c + Math.sin(t) * (R - l) * S, c - Math.cos(t) * (R - l) * S);
        x.stroke();
      }
      x.setLineDash([S * 0.12, S * 0.1]);
      x.beginPath(); x.moveTo(c, c - R * S); x.lineTo(c, c + R * S); x.stroke();
      x.setLineDash([]);
      x.beginPath(); x.moveTo(c - R * S, c); x.lineTo(c + R * S, c); x.stroke();
    }, { lay: 'flat' }), 0, 0.03, O[2]);

    const semiBlock = at(glass(new THREE.CylinderGeometry(2.0, 2.0, 0.48, 48, 1, false, Math.PI / 2, Math.PI).translate(0, 0.24, 0)), 0, 0.04, O[2]);
    const rectBlock = at(glass(new THREE.BoxGeometry(4.2, 0.48, 1.8).translate(0, 0.24, -0.9)), 0, 0.04, O[2]);
    const mkBeam = () => strip(2, { w: 0.09, color: C.red, opacity: 0.9, normal: [0, 1, 0] });
    const inc = mkBeam(), refl = mkBeam(), refr = mkBeam(), emerg = mkBeam();
    const laser = group(rot(at(cyl(0.14, 0.95, DARK), 0, 0, 0), Math.PI / 2, 0, 0));
    const pins = [0, 1, 2, 3].map(() => at(group(cyl(0.03, 0.45, STEEL, { kind: 'metal' }), at(ball(0.07, C.red), 0, 0.46, 0)), 0, 0.04, 0));
    const info = at(card('\n', { w: 3.4, size: 0.3, align: 'left' }), 2.35, 0, -3.1);
    k.root.add(disc, semiBlock, rectBlock, inc, refl, refr, emerg, laser, ...pins, info);

    const dirv = (ang, side) => [Math.sin(ang), 0, Math.cos(ang) * side];
    const pt = (o, d, len) => [o[0] + d[0] * len, Y, o[2] + d[2] * len];
    const st = {};

    return {
      press(id) {
        if (id === 'rec') {
          const row = refract.record.sample(this, p);
          if (row) k.record(row);
        }
      },
      update() {
        const n = (REFRACT_MEDIA[p.n ?? 1] || REFRACT_MEDIA[1]).n;
        const i = (p.i ?? 40) * DEG;
        const isRect = p.shape === 1;
        semiBlock.visible = !isRect;
        rectBlock.visible = isRect;
        pins.forEach((pin) => { pin.visible = isRect; });

        if (!isRect) {
          emerg.visible = false;
          const fromAir = p.dir === 0;
          const s = fromAir ? Math.sin(i) / n : Math.sin(i) * n;
          const tir = s >= 1;
          const r = tir ? Math.PI / 2 : Math.asin(s);
          const n1 = fromAir ? 1 : n, n2 = fromAir ? n : 1;
          const Rf = tir ? 1 : ((n1 * Math.cos(i) - n2 * Math.cos(r)) / (n1 * Math.cos(i) + n2 * Math.cos(r))) ** 2;
          const inSide = fromAir ? 1 : -1;
          const dIn = dirv(-i, inSide), dRe = dirv(i, inSide), dTr = dirv(r, -inSide);
          inc.set([pt(O, dIn, R + 0.4), O]);
          refl.set([O, pt(O, dRe, R)]);
          refr.set([O, pt(O, dTr, R)]);
          refl.material.opacity = clamp(0.14 + Rf * 0.85);
          refr.material.opacity = tir ? 0 : clamp(1 - Rf) * 0.9;
          refr.visible = !tir;
          laser.position.set(...pt(O, dIn, R + 0.85));
          laser.lookAt(k.root.localToWorld(new THREE.Vector3(...O)));
          Object.assign(st, { n, r, tir, fromAir, Rf, isRect });
          info.set(tir ? `全反射！\ni=${p.i}° > C=${(Math.asin(1 / n) / DEG).toFixed(1)}°` : `${fromAir ? '折射角' : '出射角'} r = ${(r / DEG).toFixed(1)}°\n反射率 ≈ ${(Rf * 100).toFixed(0)}%`);
        } else {
          const r = Math.asin(Math.sin(i) / n);
          const thick = 1.8;
          const dx = thick * Math.tan(r);
          const O2 = [O[0] + dx, Y, O[2] - thick];
          const dIn = dirv(-i, 1);
          const pInEnd = pt(O, dIn, 2.7);
          const dOut = dirv(i, -1);
          const pOutEnd = pt(O2, dOut, 2.2);
          inc.set([pInEnd, O]);
          refl.set([O, pt(O, dirv(i, 1), 1.8)]);
          refl.material.opacity = 0.25;
          refr.visible = true; refr.material.opacity = 0.9;
          refr.set([O, O2]);
          emerg.visible = true;
          emerg.set([O2, pOutEnd]);
          laser.position.set(...pt(O, dIn, 3.1));
          laser.lookAt(k.root.localToWorld(new THREE.Vector3(...O)));
          const p1 = pt(O, dIn, 1.9), p2 = pt(O, dIn, 0.9), p3 = pt(O2, dOut, 0.8), p4 = pt(O2, dOut, 1.7);
          [p1, p2, p3, p4].forEach((q, idx) => pins[idx].position.set(q[0], 0.04, q[2]));
          Object.assign(st, { n, r, tir: false, fromAir: true, Rf: 0.08, isRect, latShift: thick * Math.sin(i - r) / Math.cos(r) });
          info.set(`平行砖插针法\nr = ${(r / DEG).toFixed(1)}° · n = ${n.toFixed(2)}`);
        }
      },
      margin() {
        const Cc = Math.asin(1 / st.n) / DEG;
        return [
          `n = ${st.n.toFixed(2)} · C = ${Cc.toFixed(1)}°`,
          st.tir ? `i = ${p.i}° > C · 全反射` : `i = ${p.i}° · r = ${(st.r / DEG).toFixed(1)}°`,
          ...(st.isRect ? [`侧向平移 Δx ∝ t·sin(i−r)/cos r`] : []),
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 平行玻璃砖插针法（拖动 P₃、P₄ 对齐 P₁、P₂ 折射像）');
    const bar1 = document.createElement('div');
    bar1.className = 'wb-btn-row';
    bar1.innerHTML = `
      <button type="button" class="wb-btn primary" data-a="cap">记入当前插针角度</button>
      <button type="button" class="wb-btn" data-a="align">自动精准对准辅助</button>`;
    sec1.append(bar1);

    // 平行玻璃砖厚度 t=80px (在 520x230 纸面中)
    const slabY0 = 75, slabY1 = 155, ox = 240;
    let p3x = 290, p4x = 345;
    const calcPins = () => {
      const n = (REFRACT_MEDIA[sp.params.n ?? 1] || REFRACT_MEDIA[1]).n;
      const iRad = (sp.params.i ?? 40) * DEG;
      const rRad = Math.asin(Math.sin(iRad) / n);
      const t = slabY1 - slabY0;
      const o2x = ox + t * Math.tan(rRad);
      return { n, iRad, rRad, o2x };
    };

    const cvPin = wb.canvas(sec1, 520, 230, (x, W, H) => {
      const { iRad, o2x } = calcPins();
      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      // 玻璃砖
      x.fillStyle = 'rgba(190, 224, 240, 0.35)';
      x.fillRect(90, slabY0, 340, slabY1 - slabY0);
      x.strokeStyle = C.ink; x.lineWidth = 1.6;
      x.strokeRect(90, slabY0, 340, slabY1 - slabY0);
      // 法线
      x.save(); x.setLineDash([4, 3]); x.strokeStyle = 'rgba(30,43,54,0.4)';
      x.beginPath(); x.moveTo(ox, 16); x.lineTo(ox, H - 16); x.stroke();
      x.beginPath(); x.moveTo(o2x, 16); x.lineTo(o2x, H - 16); x.stroke();
      x.restore();
      // P1, P2 入射光
      const p1 = [ox - 65 * Math.tan(iRad), slabY0 - 65];
      const p2 = [ox - 28 * Math.tan(iRad), slabY0 - 28];
      x.strokeStyle = C.red; x.lineWidth = 2;
      x.beginPath(); x.moveTo(...p1); x.lineTo(ox, slabY0); x.lineTo(o2x, slabY1); x.stroke();
      // 玩家拖动的 P3, P4 连线反向交下表面
      const slope = (p4x - p3x) / 36;
      const hitX = p3x - slope * 28;
      x.strokeStyle = '#1f4a3e'; x.lineWidth = 1.8;
      x.beginPath(); x.moveTo(hitX, slabY1); x.lineTo(p4x, slabY1 + 64); x.stroke();
      x.save(); x.setLineDash([3, 3]);
      x.beginPath(); x.moveTo(ox, slabY0); x.lineTo(hitX, slabY1); x.stroke();
      x.restore();

      const drawPin = (px, py, lbl, col) => {
        x.fillStyle = col; x.beginPath(); x.arc(px, py, 6, 0, TAU); x.fill();
        x.strokeStyle = C.ink; x.lineWidth = 1.2; x.stroke();
        x.fillStyle = C.ink; x.font = '11px Georgia, serif'; x.fillText(lbl, px + 9, py + 4);
      };
      drawPin(p1[0], p1[1], 'P₁', C.red);
      drawPin(p2[0], p2[1], 'P₂', C.red);
      drawPin(p3x, slabY1 + 28, 'P₃(拖)', '#1f4a3e');
      drawPin(p4x, slabY1 + 64, 'P₄(拖)', '#1f4a3e');
    });

    let dragPin = 0;
    cvPin.cv.addEventListener('pointerdown', (e) => {
      const pt = cvPin.toLocal(e);
      if (Math.hypot(pt.x - p3x, pt.y - (slabY1 + 28)) < 18) dragPin = 3;
      else if (Math.hypot(pt.x - p4x, pt.y - (slabY1 + 64)) < 18) dragPin = 4;
      if (dragPin) cvPin.cv.setPointerCapture(e.pointerId);
    });
    cvPin.cv.addEventListener('pointermove', (e) => {
      if (!dragPin) return;
      const pt = cvPin.toLocal(e);
      if (dragPin === 3) p3x = clamp(pt.x, 120, 440);
      else p4x = clamp(pt.x, 120, 450);
      refresh();
    });
    const endDrag = () => { dragPin = 0; };
    cvPin.cv.addEventListener('pointerup', endDrag); cvPin.cv.addEventListener('pointercancel', endDrag);

    const sec2 = wb.section('2 · sin i – sin r 线性回归测折射率 n');
    const regChart = wb.regressionChart(sec2, {
      w: 510, h: 205, xLabel: 'sin r', yLabel: 'sin i', xRange: [0, 0.75], yRange: [0, 1.0],
    });
    const out = document.createElement('div');
    out.className = 'wb-metrics';
    sec2.append(out);

    const alignPins = () => {
      const { iRad, o2x } = calcPins();
      p3x = o2x + 28 * Math.tan(iRad);
      p4x = o2x + 64 * Math.tan(iRad);
    };
    alignPins();

    const refresh = () => {
      cvPin.redraw();
      const { n, iRad, o2x } = calcPins();
      const slope = (p4x - p3x) / 36;
      const hitX = p3x - slope * 28;
      const rMeas = Math.atan2(hitX - ox, slabY1 - slabY0);
      const nHuman = Math.sin(iRad) / Math.max(0.02, Math.sin(rMeas));
      const rows = wb.rows();
      const pts = rows.map((r) => [r.sinR, r.sinI, r._kind || 'simulated']);
      regChart.redraw({ pts, xRange: [0, 0.75], yRange: [0, 1.0], theoryFn: (sr) => n * sr });
      const reg = linearRegression(pts);
      out.innerHTML = `
        <div class="wb-m"><span>你对准的 P₃P₄ 测得</span><b>r = ${(rMeas / DEG).toFixed(1)}° → n = ${nHuman.toFixed(3)}</b></div>
        <div class="wb-m"><span>回归斜率 n (${rows.length} 组)</span><b>${reg ? reg.k.toFixed(4) : '需 ≥2 组'} (真值 ${n.toFixed(2)})</b></div>`;
    };
    bar1.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'align') alignPins();
      else if (a === 'cap') {
        const { n, iRad } = calcPins();
        const slope = (p4x - p3x) / 36;
        const hitX = p3x - slope * 28;
        const rMeas = Math.atan2(hitX - ox, slabY1 - slabY0);
        const s1 = Math.sin(iRad), s2 = Math.max(0.02, Math.sin(rMeas));
        wb.record({
          _kind: 'human',
          med: REFRACT_MEDIA[sp.params.n ?? 1].name,
          iDeg: sp.params.i ?? 40, rDeg: rMeas / DEG, sinI: s1, sinR: s2, nEst: s1 / s2,
        });
        void n;
      }
      refresh();
    });
    refresh();
    return { update() { refresh(); } };
  },
};

// ===========================================================================
// 6. phy-young (L3) — 用双缝干涉实验测量光的波长 (升级自 phy2.js#phy-young)
// ===========================================================================
const young = {
  id: 'phy-young',
  subject: 'phy',
  title: '用双缝干涉实验测量光的波长',
  en: "Young's double-slit wavelength measurement",
  lede: [
    '单色激光穿过间距仅为十分之几毫米的双缝，在远处的屏上形成等间距明暗相间的干涉条纹。',
    '直接拖动测量目镜的十字叉丝横移数条亮纹，用逐差法 Δx = (a_k − a_1)/(k − 1) 读出条纹间距，就能精密反推几百纳米的光波波长。',
  ],
  formula: 'Δx = L λ / d · λ = d (a_k − a_1) / [(k − 1) L]',
  formulaNote: '采用逐差法测多条亮纹跨度再除以间隔数，显著降低单次对准叉丝的随机误差',
  terms: [
    ['干涉条件', '两束频率相同、相位差恒定的相干光叠加，光程差为波长的整数倍处出现亮纹。'],
    ['测量头叉丝', '目镜内可随螺旋测微手轮左右平移的十字分划板，用于对准亮纹中心。'],
    ['单缝衍射包络', '真实双缝干涉亮度受单缝宽度衍射因子 sinc² 调制，中央亮纹最亮、两侧渐暗。'],
  ],
  predict: {
    q: '保持其他条件不变，将红光激光器（630 nm）换成绿光（530 nm），屏上相邻亮纹间距 Δx 会如何变化？',
    options: ['变宽变疏', '变窄变密', '间距不变，只变颜色'],
    answer: 1,
    why: '根据 Δx = Lλ/d，条纹间距与波长 λ 成正比，绿光波长短于红光，因此条纹变窄变密。',
  },
  challenge: '在工作台将十字叉丝分别对准第 1 条与第 5 条亮纹中心并记下位置，用逐差法反推激光波长（误差 < 5 nm）！',
  fig: '激光器、双缝片、光屏与可滑动十字叉丝测量头',
  hint: '拖动 3D 测量头指针或调节“叉丝位置 x”滑杆对准不同级次亮纹；进入工作台读数测波长。',
  teach: {
    where: '人教版物理选择性必修第一册第四章 §4.4《实验：用双缝干涉测量光的波长》',
    ask: [
      '为什么要测连续 5 到 8 条亮纹的总距离再求平均，而不只测相邻两条？',
      '单缝的作用是什么？如果去掉双缝前的单缝直接用普通灯泡照明，还能看到清晰干涉条纹吗？',
    ],
    simplify: '旁轴小角近似 x ≪ L；亮纹强度模型为 cos²(πdx/(λL))·exp(−(x/18)²)。',
  },
  controls: [
    { id: 'lam', label: '波长 λ', min: 400, max: 700, step: 5, value: 630, unit: 'nm' },
    { id: 'd', label: '缝距 d', min: 0.10, max: 0.50, step: 0.01, value: 0.20, unit: 'mm' },
    { id: 'L', label: '屏距 L', min: 0.50, max: 1.50, step: 0.05, value: 1.00, unit: 'm' },
    { id: 'cx', label: '测量叉丝位置 x', min: -16, max: 16, step: 0.02, value: 0.0, unit: 'mm' },
    { id: 'rec', type: 'button', label: '记录叉丝坐标' },
  ],
  record: {
    note: '对准多条亮纹中心记录坐标 a_k (mm)，计算相邻亮纹间距 Δx 与实测波长 λ。',
    pending: '移动叉丝对准亮纹中心并点击“记录叉丝坐标”。',
    columns: [
      { key: 'lamTrue', label: '设定 λ', unit: 'nm', digits: 0 },
      { key: 'd', label: 'd', unit: 'mm', digits: 2 },
      { key: 'L', label: 'L', unit: 'm', digits: 2 },
      { key: 'ax', label: '叉丝读数 a', unit: 'mm', digits: 2 },
      { key: 'order', label: '最接近级次 k', digits: 0 },
    ],
    sample: (_inst, p) => {
      const dx = (p.L * p.lam * 1e-6) / (p.d * 1e-3);
      return {
        _kind: 'human',
        lamTrue: p.lam, d: p.d, L: p.L, ax: p.cx ?? 0,
        order: Math.round((p.cx ?? 0) / dx),
      };
    },
    summary: (rows) => {
      if (rows.length < 2) return [['已采亮纹坐标', `${rows.length} 个（需 ≥2 个同条件点算 Δx）`]];
      const sorted = [...rows].sort((a, b) => a.order - b.order);
      const a0 = sorted[0], a1 = sorted[sorted.length - 1];
      const dk = a1.order - a0.order;
      if (!dk) return [['级次差为 0', '请对准不同亮纹']];
      const dxEst = (a1.ax - a0.ax) / dk;
      const lamEst = (a1.d * 1e-3 * dxEst * 1e-3) / a1.L * 1e9;
      return [['逐差测得 Δx', `${dxEst.toFixed(3)} mm`], ['反推波长 λ', `${lamEst.toFixed(1)} nm`]];
    },
    errors: [
      '分划板中心刻线未对准亮纹中心线或数错亮纹条数 n（误将间隔数 n−1 当作 n）。',
    ],
  },

  build(k) {
    const p = k.p, ZS = -3.4, W = 5.6, H = 2.3;
    k.root.add(at(box(W + 0.4, H + 0.85, 0.16), 0, 0, ZS - 0.1));
    const scr = at(sheet(W, H, () => {}, { opaque: true }), 0, 0.55 + H / 2, ZS);
    const laser = group(rot(at(cyl(0.28, 0.95, DARK), 0, 1.7, 2.2), Math.PI / 2, 0, 0), at(box(0.4, 1.35, 0.4), 0, 0, 2.7));
    const slit = group(at(box(1.5, 2.4, 0.08), 0, 0, 0), at(box(1.9, 0.12, 0.7), 0, 0, 0));
    const beam = strip(2, { w: 0.09, color: C.red, opacity: 0.85, normal: [0, 1, 0] });
    const fan = flat(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3)), C.red, { opacity: 0.2 });
    fan.frustumCulled = false;
    const halo = glow(C.red, 1.1, 0.65);
    const crosshair = group(
      wire([0, 0.55, ZS + 0.06], [0, 0.55 + H, ZS + 0.06], 0.022),
      at(cyl(0.09, 0.35, BRASS, { kind: 'metal' }), 0, 0.15, ZS + 0.08),
    );
    const info = at(card('\n', { w: 3.3, size: 0.3, align: 'left' }), -2.4, 0, 2.1);
    k.root.add(scr, laser, slit, beam, fan, halo, crosshair, info, at(note('40 mm 屏宽 · 拖黄铜手轮移叉丝', { size: 0.25 }), 0, 0.25, ZS + 0.03));

    const draw = () => {
      const col = wavelength(p.lam);
      const dx = (p.L * p.lam * 1e-6) / (p.d * 1e-3);
      scr.redraw((x, S, w, h) => {
        x.fillStyle = '#14171c'; x.fillRect(0, 0, w * S, h * S);
        const n = Math.ceil(w * S);
        for (let i = 0; i < n; i++) {
          const mm = (i / n - 0.5) * 40;
          const I = Math.cos((Math.PI * mm) / dx) ** 2 * Math.exp(-((mm / 17) ** 2));
          x.fillStyle = `rgba(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0},${I})`;
          x.fillRect(i, h * S * 0.14, 1.5, h * S * 0.72);
        }
      });
      const zs = ZS + p.L * 2.7;
      slit.position.set(0, 0, zs);
      beam.set([[0, 1.7, 2.2], [0, 1.7, zs]]);
      [beam, fan, halo].forEach((m) => m.material.color.copy(col));
      fan.geometry.attributes.position.array.set([0, 1.7, zs, -W / 2, 1.7, ZS + 0.02, W / 2, 1.7, ZS + 0.02]);
      fan.geometry.attributes.position.needsUpdate = true;
      halo.position.set(0, 1.7, zs + 0.1);
      crosshair.position.x = ((p.cx ?? 0) / 40) * W;
      info.set(`Δx = ${dx.toFixed(2)} mm\n叉丝 x = ${(p.cx ?? 0).toFixed(2)} mm`);
      return dx;
    };
    let dx = draw();

    let dragX = null, cx0 = 0;
    k.drag(crosshair, {
      normal: 'y',
      start: () => { dragX = null; cx0 = p.cx ?? 0; },
      move: (q) => {
        if (dragX === null) { dragX = q.x; return; }
        k.set('cx', clamp(Math.round((cx0 + ((q.x - dragX) / W) * 40) * 50) / 50, -16, 16));
        dx = draw();
      },
      end: () => { dragX = null; },
    });

    return {
      press(id) {
        if (id === 'rec') {
          const row = young.record.sample(this, p);
          if (row) k.record(row);
        }
      },
      change() { dx = draw(); },
      update() {},
      margin: () => [
        `Δx = Lλ/d = ${dx.toFixed(2)} mm`,
        `叉丝坐标 x = ${(p.cx ?? 0).toFixed(2)} mm`,
        `最接近亮纹级次 k = ${Math.round((p.cx ?? 0) / dx)}`,
        '反演：λ = d·Δx / L',
      ],
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 测量头目镜十字叉丝与亮纹峰值剖析');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn primary" data-a="snap">吸附到最近亮纹中心并记录</button>
      <button type="button" class="wb-btn" data-a="cap">按当前位置直接记录</button>
      <button type="button" class="wb-btn" data-a="k1">跳至 k=−2 亮纹</button>
      <button type="button" class="wb-btn" data-a="k5">跳至 k=+3 亮纹</button>`;
    sec1.append(bar);

    const cv = wb.canvas(sec1, 520, 210, (x, W, H) => {
      const p = sp.params;
      const dx = (p.L * p.lam * 1e-6) / (p.d * 1e-3);
      const col = wavelength(p.lam);
      const rgb = `${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0}`;
      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      // 上半部：目镜干涉条纹视野 (x in [-16, +16] mm)
      const fy = 12, fh = 84;
      x.fillStyle = '#12151a'; x.fillRect(28, fy, W - 56, fh);
      for (let i = 0; i < W - 56; i++) {
        const mm = (i / (W - 56) - 0.5) * 32;
        const I = Math.cos((Math.PI * mm) / dx) ** 2 * Math.exp(-((mm / 16) ** 2));
        x.fillStyle = `rgba(${rgb},${I})`;
        x.fillRect(28 + i, fy + 6, 1.5, fh - 12);
      }
      // 十字叉丝
      const cxPx = 28 + (((p.cx ?? 0) + 16) / 32) * (W - 56);
      x.strokeStyle = '#fff'; x.lineWidth = 1.4;
      x.beginPath(); x.moveTo(cxPx, fy); x.lineTo(cxPx, fy + fh); x.stroke();
      x.setLineDash([4, 3]);
      x.beginPath(); x.moveTo(28, fy + fh / 2); x.lineTo(W - 28, fy + fh / 2); x.stroke();
      x.setLineDash([]);

      // 下半部：光强曲线 I(x)
      const py0 = 112, py1 = 186;
      x.strokeStyle = C.ink; x.lineWidth = 1.3;
      x.beginPath(); x.moveTo(28, py0); x.lineTo(28, py1); x.lineTo(W - 28, py1); x.stroke();
      x.strokeStyle = `rgb(${rgb})`; x.lineWidth = 2; x.beginPath();
      for (let i = 0; i <= 200; i++) {
        const mm = -16 + (i / 200) * 32;
        const I = Math.cos((Math.PI * mm) / dx) ** 2 * Math.exp(-((mm / 16) ** 2));
        const px = 28 + (i / 200) * (W - 56), py = py1 - I * (py1 - py0 - 8);
        if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.stroke();
      x.strokeStyle = C.red; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(cxPx, py0); x.lineTo(cxPx, py1); x.stroke();
      x.fillStyle = C.ink; x.font = '11px Georgia, serif'; x.textAlign = 'center';
      x.fillText(`叉丝位置 x = ${(p.cx ?? 0).toFixed(2)} mm (拖动条纹区域移动叉丝)`, W / 2, H - 5);
    });

    let drag = false;
    const moveToPt = (e) => {
      const pt = cv.toLocal(e);
      const mm = clamp(Math.round((((pt.x - 28) / (520 - 56)) * 32 - 16) * 50) / 50, -16, 16);
      wb.setParam('cx', mm);
      refresh();
    };
    cv.cv.addEventListener('pointerdown', (e) => { drag = true; cv.cv.setPointerCapture(e.pointerId); moveToPt(e); });
    cv.cv.addEventListener('pointermove', (e) => { if (drag) moveToPt(e); });
    const endD = () => { drag = false; };
    cv.cv.addEventListener('pointerup', endD); cv.cv.addEventListener('pointercancel', endD);

    const out = document.createElement('div');
    out.className = 'wb-metrics';
    sec1.append(out);

    const refresh = () => {
      cv.redraw();
      const p = sp.params;
      const dx = (p.L * p.lam * 1e-6) / (p.d * 1e-3);
      const rows = wb.rows().filter((r) => Math.abs(r.d - p.d) < 1e-4 && Math.abs(r.L - p.L) < 1e-4);
      let dxEst = NaN, lamEst = NaN;
      if (rows.length >= 2) {
        const reg = linearRegression(rows.map((r) => [r.order, r.ax]));
        if (reg && reg.k > 0) {
          dxEst = reg.k;
          lamEst = (p.d * 1e-3 * dxEst * 1e-3) / p.L * 1e9;
        }
      }
      out.innerHTML = `
        <div class="wb-m"><span>理论条纹间距 Δx</span><b>${dx.toFixed(3)} mm</b></div>
        <div class="wb-m"><span>已采同条件亮纹数</span><b>${rows.length} 条</b></div>
        <div class="wb-m"><span>逐差回归波长 λ_测</span><b>${Number.isFinite(lamEst) ? `${lamEst.toFixed(1)} nm (真 ${p.lam} nm)` : '请记录 ≥2 条不同级次亮纹'}</b></div>`;
    };

    bar.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      const p = sp.params;
      const dx = (p.L * p.lam * 1e-6) / (p.d * 1e-3);
      if (a === 'snap') {
        const kOrd = Math.round((p.cx ?? 0) / dx);
        wb.setParam('cx', clamp(+(kOrd * dx).toFixed(2), -16, 16));
        wb.press('rec');
      } else if (a === 'cap') {
        wb.press('rec');
      } else if (a === 'k1') {
        wb.setParam('cx', clamp(+(-2 * dx).toFixed(2), -16, 16));
      } else if (a === 'k5') {
        wb.setParam('cx', clamp(+(3 * dx).toFixed(2), -16, 16));
      }
      refresh();
    });
    refresh();
    return { update() { refresh(); } };
  },
};

// ===========================================================================
// 7. phy-induction (L3) — 电磁感应与楞次定律 (升级自 phy2.js#phy-induction)
// ===========================================================================
const induction = {
  id: 'phy-induction',
  subject: 'phy',
  title: '探究影响感应电流方向的因素（楞次定律）',
  en: "Electromagnetic induction and Lenz's law",
  lede: [
    '把条形磁铁插入线圈，指针向一侧偏转；拔出线圈，指针向相反方向偏转；停在原地不动，指针立刻回零。',
    '感应电流激发的磁场总是“增反减同”——阻碍引起它的磁通量变化，把机械能转化为回路电能。',
  ],
  formula: 'ε = − N dΦ / dt · I = ε / R_总',
  formulaNote: '感应电动势大小取决于磁通量变化率；负号即楞次定律“阻碍变化”',
  terms: [
    ['磁通量 Φ', '穿过闭合线圈磁感线的条数，Φ ≈ B·S_⊥。'],
    ['楞次定律', '感应电流具有这样的方向：它的磁场总是阻碍引起感应电流的磁通量的变化。'],
    ['增反减同', '原磁通增加时 B_感 与 B_原 方向相反；原磁通减少时 B_感 与 B_原 同向。'],
  ],
  predict: {
    q: 'N 极朝下插入线圈时指针向右偏，那么 S 极朝下从线圈拔出时，指针将向哪边偏？',
    options: ['向右偏（与 N 极插入相同）', '向左偏', '不偏转'],
    answer: 0,
    why: 'N 极插入：原磁场向下且磁通量增加 → B_感 向上；S 极拔出：原磁场向上且磁通量减少 → 阻碍减少，B_感 同样向上！因此感应电流方向相同，指针同样向右偏。',
  },
  challenge: '关闭自动插拔，亲手快慢两次拖入磁铁比较感应电动势峰值，并在工作台观察 Φ(t)–ε(t) 相位环！',
  fig: '条形磁铁、螺线管、灵敏电流计与 Φ/ε 相位演示台',
  hint: '上下拖动磁铁插入/拔出，切换 N/S 极与匝数；可在工作台记录四象限楞次定律真值表。',
  teach: {
    where: '人教版物理选择性必修第二册第二章 §2.2《楞次定律》与实验《探究影响感应电流方向的因素》',
    ask: [
      '实验正式开始前，为什么要先用一节干电池与保护电阻试触灵敏电流计？',
      '为什么磁铁在靠近线圈中点深处且高速穿过线圈两端时，感应电动势比正中间更高？',
    ],
    simplify: '轴向磁通模型 Φ(y) = [1 + ((y − 1.3)/1.05)²]^(−1.5)；设回路总电阻 R_总 固定，电流按感应电动势瞬时比例响应。',
  },
  controls: [
    { id: 'pole', type: 'choice', label: '朝下磁极', options: ['N 极朝下', 'S 极朝下'], value: 0 },
    { id: 'n', type: 'choice', label: '线圈匝数 N', options: ['100 匝', '200 匝', '400 匝'], value: 1 },
    { id: 'speed', label: '自动插拔速度', min: 0.6, max: 3.0, step: 0.2, value: 1.4, unit: '×' },
    { id: 'auto', type: 'toggle', label: '自动插拔', value: true },
    { id: 'rec', type: 'button', label: '记录当前状态' },
  ],
  record: {
    note: '记录 N/S 极插入或拔出时的磁通量变化 ΔΦ 与感应电动势极性、电流计偏转方向。',
    pending: '插拔磁铁过程中点击“记录当前状态”。',
    columns: [
      { key: 'pole', label: '朝下磁极' },
      { key: 'motion', label: '运动方向' },
      { key: 'N', label: '匝数', digits: 0 },
      { key: 'phi', label: 'Φ (相对)', digits: 3 },
      { key: 'emf', label: 'ε (相对)', digits: 3 },
      { key: 'deflect', label: '电流计偏转' },
    ],
    sample: (inst, p) => {
      const s = inst?.snapshot?.();
      if (!s) return null;
      return {
        _kind: 'simulated',
        pole: p.pole === 0 ? 'N 极' : 'S 极',
        motion: Math.abs(s.vy) < 0.05 ? '静止' : s.vy < 0 ? '插入' : '拔出',
        N: [100, 200, 400][p.n ?? 1],
        phi: s.P, emf: s.emfV,
        deflect: Math.abs(s.needle) < 0.03 ? '零刻度' : s.needle < 0 ? '右偏 →' : '← 左偏',
      };
    },
    summary: (rows) => [['已采集感应记录', `${rows.length} 组`]],
    errors: [
      '判断“增反减同”时容易混淆：B_感 阻碍的是磁通量的“变化”，而不是阻止磁场本身。',
    ],
  },

  build(k) {
    const p = k.p, X = -1.6, Z = -0.8, NS = [100, 200, 400];
    const sol = makeSolenoid(X, 0.1, Z, 0.72, 2.2, 12, C.copper);
    k.root.add(at(box(2.2, 0.1, 2.2), X, 0, Z), sol);
    const top = group(at(box(0.54, 1.05, 0.38, C.red), 0, 1.05, 0), at(box(0.54, 1.05, 0.38, C.blue), 0, 0, 0));
    const tN = at(note('N', { size: 0.34, color: '#fff', bold: true }), 0, 0.52, 0.20);
    const tS = at(note('S', { size: 0.34, color: '#fff', bold: true }), 0, 1.58, 0.20);
    const mag = group(top, tN, tS);
    const G = at(meter('G', { center: true, w: 1.9 }), 2.3, 0, 1.55);
    const loopPts = Array.from({ length: 25 }, (_, i) => {
      const a = (i / 24) * TAU;
      return [X + Math.cos(a) * 0.92, 2.42, Z + Math.sin(a) * 0.92];
    });
    const cur = flow(loopPts, 10, C.amber, { r: 0.08 });
    const bInd = arrow(C.violet, 0.055);
    const info = at(card('\n', { w: 3.5, size: 0.28, align: 'left' }), 2.3, 0, -2.9);
    k.root.add(mag, G, cur, bInd, info,
      tube([[X + 0.74, 0.3, Z], [X + 1.4, 0.06, Z + 0.4], [1.8, 0.06, 1.35]], 0.032, C.copper),
      tube([[X + 0.74, 2.1, Z], [X + 1.7, 1.2, Z + 0.2], [X + 2.2, 0.06, Z + 0.6], [2.8, 0.06, 1.35]], 0.032, C.copper));

    let y = 4.0, prevY = 4.0, vy = 0, held = false, t = 0, lastPhi = null, emfV = 0, needle = 0;
    const hist = [];
    k.drag(top, {
      start: () => { held = true; k.set('auto', false); p.auto = false; },
      move: (q) => { y = clamp(q.y - 1.05, 0.6, 4.5); },
      end: () => { held = false; },
    });
    const phi = (yy) => 1 / Math.pow(1 + ((yy - 1.3) / 1.05) ** 2, 1.5);

    return {
      snapshot: () => ({ y, vy, P: (p.pole === 0 ? 1 : -1) * phi(y), emfV, needle, hist }),
      press(id) {
        if (id === 'rec') {
          const row = induction.record.sample(this, p);
          if (row) k.record(row);
        }
      },
      update(dt) {
        if (p.auto && !held) {
          t += dt * (p.speed ?? 1.4);
          y = 2.55 + 1.85 * Math.cos(t * 1.3);
        }
        const sgn = p.pole === 0 ? 1 : -1;
        top.rotation.x = sgn > 0 ? 0 : Math.PI;
        top.position.y = sgn > 0 ? 0 : 2.1;
        tN.position.y = sgn > 0 ? 0.52 : 1.58;
        tS.position.y = sgn > 0 ? 1.58 : 0.52;
        mag.position.set(X, y, Z);
        sol.rings.forEach((r, i) => { r.visible = i < [5, 8, 12][p.n ?? 1]; });
        const P = sgn * phi(y);
        if (dt > 0) {
          vy = (y - prevY) / dt;
          prevY = y;
          if (lastPhi !== null) emfV = lerp(emfV, -(NS[p.n ?? 1] / 200) * ((P - lastPhi) / dt), 0.35);
          lastPhi = P;
          needle = lerp(needle, emfV, 1 - Math.exp(-dt * 14));
          hist.push([t, P, emfV]);
          if (hist.length > 160) hist.shift();
        } else {
          needle = lerp(needle, 0, 0.1);
        }
        G.set(clamp(-needle * 0.85, -1, 1), Math.abs(needle) < 0.03 ? '0' : needle < 0 ? '右偏 →' : '← 左偏');
        cur.step(dt, -needle * 5);
        cur.visible = Math.abs(needle) > 0.03;
        const up = needle > 0 ? 1 : -1, len = clamp(Math.abs(needle) * 1.5, 0, 1.5);
        bInd.set([X + 1.45, 1.35 - up * len / 2, Z], [X + 1.45, 1.35 + up * len / 2, Z]);
        this._s = { P, needle, sgn };
        info.set(Math.abs(needle) < 0.03 ? '磁通量不变\n无感应电流' : `磁通量${needle * Math.sign(P) < 0 ? '增加' : '减少'}\n感应磁场${needle * Math.sign(P) < 0 ? '反向阻碍' : '同向补偿'}`);
      },
      margin() {
        const s = this._s || { P: 0, needle: 0 };
        return [
          `Φ = ${s.P.toFixed(2)} · 匝数 N = ${NS[p.n ?? 1]}`,
          `ε = −N dΦ/dt ≈ ${s.needle.toFixed(2)}`,
          Math.abs(s.needle) < 0.03 ? '磁场静止 → 无电流' : '紫色箭头为 B_感 (“增反减同”)',
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 实时 Φ(t) 与 ε(t) 波形及 Φ–ε 相位轨迹');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn primary" data-a="rec">记录此刻感应状态</button>
      <button type="button" class="wb-btn" data-a="flip">翻转磁极 (N↔S)</button>`;
    sec1.append(bar);
    const cv = wb.canvas(sec1, 520, 215, (x, W, H) => {
      const snap = sp.inst?.snapshot?.();
      const hist = snap?.hist || [];
      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      // 左图 Φ(t), ε(t) 时域；右图 Φ-ε 相图
      const w1 = 290, x0 = 36, x1 = x0 + w1, yMid = H / 2;
      x.strokeStyle = C.ink; x.lineWidth = 1.4;
      x.beginPath(); x.moveTo(x0, 22); x.lineTo(x0, H - 22); x.moveTo(x0, yMid); x.lineTo(x1, yMid); x.stroke();
      if (hist.length >= 2) {
        x.strokeStyle = C.blue; x.lineWidth = 2; x.beginPath();
        hist.forEach((h, i) => {
          const px = x0 + (i / (hist.length - 1)) * w1, py = yMid - h[1] * 70;
          i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
        });
        x.stroke();
        x.strokeStyle = C.copper; x.lineWidth = 2; x.beginPath();
        hist.forEach((h, i) => {
          const px = x0 + (i / (hist.length - 1)) * w1, py = yMid - clamp(h[2], -2, 2) * 38;
          i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
        });
        x.stroke();
      }
      x.fillStyle = C.ink; x.font = '11px "Noto Serif SC", serif';
      x.fillText('蓝: Φ(t)  铜: ε(t) = -N dΦ/dt', x0 + 8, 18);

      // 右侧相图
      const cx = 425, cy = H / 2;
      x.strokeStyle = C.ink; x.lineWidth = 1.4;
      x.beginPath(); x.moveTo(350, cy); x.lineTo(500, cy); x.moveTo(cx, 24); x.lineTo(cx, H - 24); x.stroke();
      if (hist.length >= 2) {
        x.strokeStyle = C.violet; x.lineWidth = 1.8; x.beginPath();
        hist.forEach((h, i) => {
          const px = cx + h[1] * 62, py = cy - clamp(h[2], -2, 2) * 35;
          i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
        });
        x.stroke();
        const last = hist[hist.length - 1];
        x.fillStyle = C.red; x.beginPath();
        x.arc(cx + last[1] * 62, cy - clamp(last[2], -2, 2) * 35, 4.5, 0, TAU); x.fill();
      }
      x.fillStyle = C.ink; x.fillText('Φ–ε 相图', 360, 18);
    });
    bar.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'rec') wb.press('rec');
      else if (a === 'flip') wb.setParam('pole', sp.params.pole === 0 ? 1 : 0);
    });
    return { update() { cv.redraw(); } };
  },
};

// ===========================================================================
// 8. phy-transformer (L3) — 探究变压器原、副线圈电压与匝数的关系
// ===========================================================================
const COIL_TURNS = [200, 400, 800, 1200];

function solveTransformer(acOn, yokeClosed, n1, n2, U1, RL) {
  if (!acOn) {
    return { k: yokeClosed ? 0.985 : 0.34, U2ideal: 0, U2: 0, I2: 0, I1: U1 / (0.008 * n1), Pout: 0, Pin: (U1 * U1) / (0.008 * n1), eta: 0 };
  }
  const k = yokeClosed ? 0.985 : 0.34;
  const r1 = 0.006 * n1;
  const r2 = 0.006 * n2;
  const U2ideal = U1 * (n2 / n1);
  const U2oc = k * U2ideal;
  const U2 = U2oc * (RL / (RL + r2));
  const I2 = U2 / RL;
  const Pout = U2 * I2;
  const Pfe = (yokeClosed ? 0.16 : 0.04) * ((U1 / 6) ** 2);
  const I1 = k * (n2 / n1) * I2 + (yokeClosed ? 0.04 : 0.18) * (U1 / 6);
  const Pcu = I1 * I1 * r1 + I2 * I2 * r2;
  const Pin = Pout + Pcu + Pfe;
  const eta = Pin > 1e-6 ? Pout / Pin : 0;
  return { k, U2ideal, U2oc, U2, I2, I1, Pout, Pin, Pcu, Pfe, eta };
}

const transformer = {
  id: 'phy-transformer',
  subject: 'phy',
  title: '探究变压器原、副线圈电压与匝数的关系',
  en: 'Transformer turns ratio & efficiency',
  lede: [
    '可拆铁芯变压器把交变电压通过闭合铁芯里的交变磁通耦合到副线圈：理想空载时 U₁ / U₂ = n₁ / n₂。',
    '拆掉顶部铁芯横梁留出气隙，漏磁骤增、副线圈电压瞬间暴跌；若把电源换成直流，稳态时没有磁通变化，副线圈电压为零！',
  ],
  formula: 'U₁ / U₂ = n₁ / n₂（理想空载） · η = P_出 / P_入',
  formulaNote: '闭合硅钢片铁芯耦合系数 k ≈ 0.985；拆开横梁漏磁使 k ≈ 0.34，叠加绕组铜损与铁芯涡流铁损',
  terms: [
    ['互感变压', '原线圈交变电流在闭合铁芯中激发交变磁通，穿过副线圈感生交变电动势。'],
    ['漏磁与铁损', '未闭合铁芯使磁感线散逸到空气中；闭合整块铁芯改用硅钢叠片可抑制涡流损耗。'],
    ['带载压降', '副线圈接负载电流 I₂ 增大时，自身绕组电阻 r₂ 产生压降使端电压 U₂ 略降。'],
  ],
  predict: {
    q: '保持原线圈接 6 V 低压交流电、n₁ = 400、n₂ = 800，如果把可拆变压器顶部的铁芯横梁拿走，副线圈空载电压 U₂ 会？',
    options: [
      '仍然约等于 12 V',
      '大幅下降（可能跌到 4 V 左右，因为大量磁通漏出铁芯）',
      '升高到 24 V',
    ],
    answer: 1,
    why: '变压器依靠高磁导率闭合铁芯把几乎全部磁通锁在磁路中；拿掉横梁后空气隙磁阻剧增，耦合系数 k 从 0.985 跌至约 0.34，U₂ 随之大幅下降。',
  },
  challenge: '对比闭合铁芯与拆开横梁两种状态下的 U₂ 读数，再在工作台观察负载电阻 R_L 变化时的传输效率曲线！',
  fig: '可拆 U 型硅钢叠片铁芯、原副线圈、低压交流/直流电源与负载灯泡',
  hint: '切换“铁芯横梁闭合/拆开”，或将“交直流”切到直流验证“只变交流不变直流”。',
  teach: {
    where: '人教版物理选择性必修第二册第三章 §3.3《变压器：探究变压器原、副线圈电压与匝数的关系》',
    ask: [
      '为什么教材严格规定必须使用 12 V 以下学生低压交流电源做实验？',
      '为什么变压器铁芯由涂有绝缘漆的硅钢片叠成，而不是用一整块实心铁块？',
    ],
    simplify: '仅允许 2–12 V 安全低压教学电源；非理想模型包含磁路耦合系数 k、线圈直流铜损 r₁/r₂ 与铁芯磁滞涡流损耗 P_fe。',
    safety: '严禁将教学可拆变压器直接接入 220 V 市电插座！',
  },
  controls: [
    { id: 'ac', type: 'choice', label: '电源类型', options: ['直流 DC', '交流 AC 50Hz'], value: 1 },
    { id: 'yoke', type: 'toggle', label: '铁芯横梁闭合', value: true },
    { id: 'n1', type: 'choice', label: '原线圈 n₁', options: COIL_TURNS.map(String), value: 1 },
    { id: 'n2', type: 'choice', label: '副线圈 n₂', options: COIL_TURNS.map(String), value: 2 },
    { id: 'U1', label: '输入电压 U₁', min: 2, max: 12, step: 1, value: 6, unit: 'V' },
    { id: 'RL', label: '负载电阻 R_L', min: 5, max: 200, step: 5, value: 50, unit: 'Ω' },
    { id: 'rec', type: 'button', label: '记录匝比与效率' },
  ],
  record: {
    note: '记录不同匝比、铁芯闭合状态及负载电阻下的输入输出电压和效率 η。',
    pending: '设定参数后点击“记录匝比与效率”。',
    columns: [
      { key: 'acName', label: '电源' },
      { key: 'yokeName', label: '铁芯' },
      { key: 'n1', label: 'n₁', digits: 0 },
      { key: 'n2', label: 'n₂', digits: 0 },
      { key: 'U1', label: 'U₁', unit: 'V', digits: 1 },
      { key: 'U2', label: 'U₂', unit: 'V', digits: 2 },
      { key: 'eta', label: '效率 η', unit: '%', digits: 1, stat: true },
    ],
    sample: (_inst, p) => {
      const n1 = COIL_TURNS[p.n1 ?? 1], n2 = COIL_TURNS[p.n2 ?? 2];
      const s = solveTransformer(p.ac === 1, !!p.yoke, n1, n2, p.U1 ?? 6, p.RL ?? 50);
      return {
        _kind: 'simulated',
        acName: p.ac === 1 ? 'AC' : 'DC',
        yokeName: p.yoke ? '闭合' : '拆开',
        n1, n2, U1: p.U1, U2: s.U2, eta: s.eta * 100,
      };
    },
    summary: (rows) => [['已测工况组数', `${rows.length} 组`]],
    errors: [
      '将直流误接原线圈：稳态磁通恒定 dΦ/dt = 0，副线圈输出永远为 0 V。',
    ],
  },

  build(k) {
    const p = k.p, ZC = -0.7;
    // U 型硅钢片叠片底座与两立柱
    const uCore = group(
      at(box(3.2, 0.45, 0.72, '#9ba4ad', { kind: 'metal' }), 0, 0, ZC),
      at(box(0.55, 1.9, 0.72, '#9ba4ad', { kind: 'metal' }), -1.32, 0.45, ZC),
      at(box(0.55, 1.9, 0.72, '#9ba4ad', { kind: 'metal' }), 1.32, 0.45, ZC),
    );
    // 可拆横梁（闭合 vs 抬起气隙）
    const yoke = at(box(3.2, 0.45, 0.72, '#aeb7c0', { kind: 'metal' }), 0, 2.35, ZC);
    const coil1 = makeSolenoid(-1.32, 0.55, ZC, 0.56, 1.65, 10, C.copper);
    const coil2 = makeSolenoid(1.32, 0.55, ZC, 0.56, 1.65, 10, '#c8895a');
    const fluxDots = flow([[-1.32, 0.25, ZC], [-1.32, 2.55, ZC], [1.32, 2.55, ZC], [1.32, 0.25, ZC], [-1.32, 0.25, ZC]], 20, C.sky, { r: 0.065 });
    const U1m = at(meter('U₁', { w: 1.5, h: 1.1 }), -2.3, 0, 1.6);
    const U2m = at(meter('U₂', { w: 1.5, h: 1.1 }), 2.3, 0, 1.6);
    const bulb = at(ball(0.28, '#fff7d6'), 0.2, 0.45, 1.65);
    const bulbGlow = glow(C.amber, 1.5, 0);
    bulbGlow.position.set(0.2, 0.45, 1.65);
    const info = at(card('\n', { w: 3.3, size: 0.28, align: 'left' }), 0, 0, -2.8);
    k.root.add(uCore, yoke, coil1, coil2, fluxDots, U1m, U2m, bulb, bulbGlow, info,
      at(note('原线圈 n₁', { size: 0.24, w: 1.5 }), -1.32, 1.4, ZC + 0.8),
      at(note('副线圈 n₂', { size: 0.24, w: 1.5 }), 1.32, 1.4, ZC + 0.8));

    let phase = 0;
    return {
      press(id) {
        if (id === 'rec') {
          const row = transformer.record.sample(this, p);
          if (row) k.record(row);
        }
      },
      update(dt) {
        const n1 = COIL_TURNS[p.n1 ?? 1], n2 = COIL_TURNS[p.n2 ?? 2];
        const s = solveTransformer(p.ac === 1, !!p.yoke, n1, n2, p.U1 ?? 6, p.RL ?? 50);
        const goalY = p.yoke ? 2.35 : 3.25;
        yoke.position.y = lerp(yoke.position.y, goalY, dt > 0 ? 1 - Math.exp(-10 * dt) : 1);
        coil1.rings.forEach((r, i) => { r.visible = i < [4, 6, 8, 10][p.n1 ?? 1]; });
        coil2.rings.forEach((r, i) => { r.visible = i < [4, 6, 8, 10][p.n2 ?? 2]; });
        U1m.set(clamp((p.U1 ?? 6) / 14), `${(p.U1 ?? 6).toFixed(1)} V`);
        U2m.set(clamp(s.U2 / 24), `${s.U2.toFixed(2)} V`);
        bulbGlow.material.opacity = clamp(s.Pout / 3.0) * 0.8;
        if (p.ac === 1) {
          phase += dt * 4;
          fluxDots.visible = true;
          fluxDots.step(dt, Math.sin(phase) * (p.yoke ? 2.6 : 1.0));
        } else {
          fluxDots.visible = false;
        }
        info.set(p.ac === 0
          ? '直流输入：磁通恒定\n副线圈 U₂ = 0.00 V'
          : `理想 U₂ = ${s.U2ideal.toFixed(2)} V\n实测 U₂ = ${s.U2.toFixed(2)} V (η=${(s.eta * 100).toFixed(0)}%)`);
        this._s = { s, n1, n2 };
      },
      margin() {
        const { s, n1, n2 } = this._s || { s: solveTransformer(true, true, 400, 800, 6, 50), n1: 400, n2: 800 };
        return [
          `n₁:n₂ = ${n1}:${n2}`,
          `耦合 k = ${s.k.toFixed(3)}`,
          `实测 U₂ = ${s.U2.toFixed(2)} V`,
          `P_out = ${s.Pout.toFixed(2)} W`,
          `效率 η = ${(s.eta * 100).toFixed(1)}%`,
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec = wb.section('1 · 理想匝比 vs 漏磁压降 & 负载效率 η(R_L) 曲线');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn primary" data-a="yoke">切换铁芯横梁闭合/拆开</button>
      <button type="button" class="wb-btn" data-a="rec">记录当前效率</button>`;
    sec.append(bar);
    const cv = wb.canvas(sec, 520, 215, (x, W, H) => {
      const p = sp.params;
      const n1 = COIL_TURNS[p.n1 ?? 1], n2 = COIL_TURNS[p.n2 ?? 2];
      const U1 = p.U1 ?? 6, RL = p.RL ?? 50;
      const pad = { l: 48, r: 44, t: 22, b: 36 }, pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      x.strokeStyle = C.ink; x.lineWidth = 1.4;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();
      const sx = (rl) => pad.l + (rl / 200) * pw;
      const syU = (u) => pad.t + ph - (u / Math.max(12, U1 * 4.2)) * ph;
      const syE = (e) => pad.t + ph - e * ph;

      // 闭合铁芯 η 曲线 vs 当前状态 η 曲线
      const drawEta = (yokeOn, col, dashArr) => {
        x.save(); x.strokeStyle = col; x.lineWidth = 2; x.setLineDash(dashArr || []);
        x.beginPath();
        for (let i = 1; i <= 40; i++) {
          const rl = i * 5;
          const st = solveTransformer(p.ac === 1, yokeOn, n1, n2, U1, rl);
          const px = sx(rl), py = syE(st.eta);
          i === 1 ? x.moveTo(px, py) : x.lineTo(px, py);
        }
        x.stroke(); x.restore();
      };
      drawEta(true, KIND.theory.color, [6, 4]);
      drawEta(!!p.yoke, '#1f4a3e', null);
      // U2(RL) 曲线
      x.strokeStyle = C.blue; x.lineWidth = 1.8; x.beginPath();
      for (let i = 1; i <= 40; i++) {
        const rl = i * 5;
        const st = solveTransformer(p.ac === 1, !!p.yoke, n1, n2, U1, rl);
        const px = sx(rl), py = syU(st.U2);
        i === 1 ? x.moveTo(px, py) : x.lineTo(px, py);
      }
      x.stroke();

      const cur = solveTransformer(p.ac === 1, !!p.yoke, n1, n2, U1, RL);
      x.fillStyle = C.red; x.beginPath(); x.arc(sx(RL), syE(cur.eta), 5, 0, TAU); x.fill();
      x.fillStyle = C.ink; x.font = '11px "Noto Serif SC", serif';
      x.fillText(`绿线: 当前效率 η(R_L)   铜虚线: 闭合铁芯参考 η   蓝线: 负载端电压 U₂(R_L)`, pad.l + 6, pad.t + 12);
      x.fillText('负载 R_L (Ω)', pad.l + pw / 2 - 20, H - 5);
    });
    const out = document.createElement('div');
    out.className = 'wb-metrics';
    sec.append(out);

    const refresh = () => {
      cv.redraw();
      const p = sp.params;
      const n1 = COIL_TURNS[p.n1 ?? 1], n2 = COIL_TURNS[p.n2 ?? 2];
      const s = solveTransformer(p.ac === 1, !!p.yoke, n1, n2, p.U1 ?? 6, p.RL ?? 50);
      out.innerHTML = `
        <div class="wb-m"><span>理想空载电压 / 实际带载 U₂</span><b>${s.U2ideal.toFixed(2)} V / ${s.U2.toFixed(2)} V</b></div>
        <div class="wb-m"><span>铁芯耦合系数 k</span><b>${s.k.toFixed(3)} (${p.yoke ? '闭合' : '气隙漏磁'})</b></div>
        <div class="wb-m"><span>传输效率 η</span><b>${(s.eta * 100).toFixed(1)}% (铜损 ${(s.Pcu || 0).toFixed(2)}W, 铁损 ${(s.Pfe || 0).toFixed(2)}W)</b></div>`;
    };
    bar.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'yoke') wb.setParam('yoke', !sp.params.yoke);
      else if (a === 'rec') wb.press('rec');
      refresh();
    });
    refresh();
    return { update() { refresh(); } };
  },
};

// ===========================================================================
// 9. phy-sensor (L3) — 利用传感器制作简单的自动控制装置
// ===========================================================================
const VCC_SENSOR = 5.0;

function sensorRes(typeIdx, envVal) {
  if (typeIdx === 0) {
    // LDR 光敏电阻 (envVal = 光照 Lux 1..500)
    const E = Math.max(0.5, envVal);
    return 20000 * Math.pow(10 / E, 0.80); // 10 lux -> 20 kΩ, 100 lux -> 3.17 kΩ, 1 lux -> 126 kΩ
  }
  // NTC 热敏电阻 (envVal = 温度 °C 0..100)
  const T = envVal + 273.15;
  return 10000 * Math.exp(3450 * (1 / T - 1 / 298.15));
}

function solveSensorControl(typeIdx, envVal, RpK, prevRelay, hystOn, noiseV = 0) {
  const Rs = sensorRes(typeIdx, envVal);
  const Rp = RpK * 1000;
  // 光控路灯：暗时电阻高、希望 V_in 升高触发点亮 => V_in = Vcc * Rs / (Rs + Rp)
  // 温控报警：高温时 NTC 电阻降低、希望 V_in 升高触发报警 => V_in = Vcc * Rp / (Rs + Rp)
  const Vin = (typeIdx === 0 ? (VCC_SENSOR * Rs) / (Rs + Rp) : (VCC_SENSOR * Rp) / (Rs + Rp)) + noiseV;
  const vHigh = hystOn ? 2.8 : 2.4;
  const vLow = hystOn ? 2.0 : 2.4;
  let relay = prevRelay;
  if (Vin >= vHigh) relay = true;
  else if (Vin <= vLow) relay = false;
  return { Rs, Rp, Vin, vHigh, vLow, relay };
}

const sensor = {
  id: 'phy-sensor',
  subject: 'phy',
  title: '利用传感器制作简单的自动控制装置',
  en: 'Sensor-based automatic control circuit',
  lede: [
    '光敏电阻在暗处阻值猛增、NTC 热敏电阻随温度升高阻值指数下降。把传感器和分压电位器接成串联分压器，就能把光/温变化翻译成电信号 V_in。',
    '送进带滞回窗口的施密特触发器后，继电器会在上限阈值吸合、直到低于下限阈值才释放，彻底消除临界点附近的频繁抖动。',
  ],
  formula: 'R_NTC(T) = R₀ e^[B(1/T − 1/T₀)] · V_in = V_cc · R分 / (R_s + R_p)',
  formulaNote: '施密特触发器具有上/下双门限（2.8 V / 2.0 V），防止临界噪声触发继电器颤振',
  terms: [
    ['光敏电阻 LDR', '半导体内光电效应：光照越强，载流子越多，电阻越小。'],
    ['NTC 热敏电阻', '负温度系数半导体材料，温度越高电阻呈指数急剧下降。'],
    ['施密特滞回', '吸合阈值高于释放阈值，形成防抖滞回区间 ΔV = V_high − V_low。'],
  ],
  predict: {
    q: '在天黑自动点亮的路灯控制电路中，把分压电位器 R_p 的阻值调大，路灯会？',
    options: [
      '天更暗时才亮',
      '天还比较亮时就提前亮（或更早点亮）',
      '亮度阈值不变',
    ],
    answer: 0,
    why: '因为 V_in = V_cc·R_LDR/(R_LDR + R_p) 达到 2.8 V 时点亮；若 R_p 调大，必须等 R_LDR 变得更大（即天更黑）才能分到足够触发电压！',
  },
  challenge: '分别配置“天黑 15 Lux 亮灯”的光控路灯与“高温 60 ℃ 报警”的温控装置，并在工作台对比开关滞回防抖效果！',
  fig: '光敏/热敏传感器、电位器分压器、施密特触发芯片、电磁继电器与路灯',
  hint: '切换传感器类型与光照/温度滑杆，调节 R_p 设定触发门限；看电磁继电器衔铁吸合与路灯点亮。',
  teach: {
    where: '人教版物理选择性必修第二册第五章 §5.3《实验：利用传感器制作简单的自动控制装置》',
    ask: [
      '为什么要通过电磁继电器去控制路灯或大功率加热器，而不直接让传感器串联在市电灯泡电路里？',
      '如果没有施密特触发器的滞回窗口，黄昏或温度临界点叠加微弱噪声时会发生什么现象？',
    ],
    simplify: '设控制电源 V_cc = 5.0 V；施密特窗口 V_high = 2.8 V、V_low = 2.0 V（关闭滞回时退化为单比较器 V_ref = 2.4 V）。',
  },
  controls: [
    { id: 'stype', type: 'choice', label: '控制装置', options: ['光控路灯 (LDR)', '温控报警 (NTC)'], value: 0, wide: true },
    { id: 'env', label: '环境光照 / 温度', min: 1, max: 100, step: 1, value: 30, unit: 'Lux/℃' },
    { id: 'Rp', label: '分压电位器 R_p', min: 2, max: 50, step: 1, value: 15, unit: 'kΩ' },
    { id: 'hyst', type: 'toggle', label: '施密特滞回防抖', value: true },
    { id: 'rec', type: 'button', label: '记录动作状态' },
  ],
  record: {
    note: '记录传感器阻值 R_s、分压信号 V_in 与继电器吸合状态。',
    pending: '调节环境量与电位器 R_p 后点击“记录动作状态”。',
    columns: [
      { key: 'stypeName', label: '传感器' },
      { key: 'env', label: '环境值', digits: 0 },
      { key: 'RsK', label: 'R_s', unit: 'kΩ', digits: 2 },
      { key: 'Rp', label: 'R_p', unit: 'kΩ', digits: 1 },
      { key: 'Vin', label: 'V_in', unit: 'V', digits: 2 },
      { key: 'state', label: '继电器/负载' },
    ],
    sample: (inst, p) => {
      const relay = inst?.snapshot?.().relay ?? false;
      const st = solveSensorControl(p.stype ?? 0, p.env ?? 30, p.Rp ?? 15, relay, !!p.hyst);
      return {
        _kind: 'model',
        stypeName: p.stype === 0 ? 'LDR(Lux)' : 'NTC(℃)',
        env: p.env, RsK: st.Rs / 1000, Rp: p.Rp, Vin: st.Vin,
        state: st.relay ? '吸合 ON' : '释放 OFF',
      };
    },
    summary: (rows) => [['已测阈值采样', `${rows.length} 组`]],
    errors: [
      '分压方向接反（如将 R_p 与 R_LDR 位置互换）会使电路变成“天亮亮灯、天黑熄灭”。',
    ],
  },

  build(k) {
    const p = k.p;
    // 电路底板
    k.root.add(
      at(box(5.8, 0.16, 3.8, '#e3e7dc', { kind: 'card' }), 0, 0, -0.4),
      at(box(0.9, 0.5, 0.65, '#3b6fe0'), -2.1, 0.16, 0.6),
      at(note('5 V', { size: 0.24, w: 0.8 }), -2.1, 0.78, 0.6),
      // 施密特 IC 芯片
      at(box(0.95, 0.28, 0.7, DARK, { kind: 'metal' }), -0.1, 0.16, -0.2),
      at(note('施密特 IC', { size: 0.22, w: 1.5 }), -0.1, 0.56, -0.2),
      // 电磁继电器盒
      at(box(0.9, 0.55, 0.8, '#538cc6'), 1.25, 0.16, -0.2),
      at(note('继电器', { size: 0.22, w: 1.2 }), 1.25, 0.85, -0.2),
      // 路灯灯柱
      at(cyl(0.06, 2.2, STEEL, { kind: 'metal' }), 2.35, 0.16, -1.2),
      at(box(0.45, 0.08, 0.14, STEEL, { kind: 'metal' }), 2.15, 2.3, -1.2),
    );
    const sensorHead = at(cyl(0.24, 0.22, C.copper, { kind: 'metal' }), -1.5, 0.16, -1.1);
    const potKnob = at(cyl(0.26, 0.24, BRASS, { kind: 'metal' }), -1.5, 0.16, 0.3);
    const armature = at(box(0.55, 0.06, 0.10, C.copper, { kind: 'metal' }), 1.25, 0.75, -0.2);
    const lampBulb = at(ball(0.22, '#fff5cc'), 1.98, 2.15, -1.2);
    const lampGlow = glow(C.amber, 2.2, 0);
    lampGlow.position.set(1.98, 2.15, -1.2);
    const Vm = at(meter('V_in', { w: 1.45, h: 1.05 }), -0.1, 0.16, 1.35);
    const info = at(card('\n', { w: 3.1, size: 0.28, align: 'left' }), 1.75, 0.16, 1.4);
    k.root.add(sensorHead, potKnob, armature, lampBulb, lampGlow, Vm, info,
      makeWireLoop([[-2.1, 0.2, 0.6], [-1.5, 0.2, 0.3], [-1.5, 0.2, -1.1], [-0.1, 0.2, -0.2], [1.25, 0.2, -0.2], [2.35, 0.2, -1.2]], 0.025, C.ink));

    let relayState = false;
    return {
      snapshot: () => ({ relay: relayState }),
      press(id) {
        if (id === 'rec') {
          const row = sensor.record.sample(this, p);
          if (row) k.record(row);
        }
      },
      update() {
        const st = solveSensorControl(p.stype ?? 0, p.env ?? 30, p.Rp ?? 15, relayState, !!p.hyst);
        relayState = st.relay;
        potKnob.rotation.y = (p.Rp / 50) * Math.PI * 1.5;
        sensorHead.material.color.set(p.stype === 0 ? C.amber : C.red);
        armature.rotation.z = relayState ? -0.18 : 0.18;
        lampGlow.material.opacity = relayState ? 0.92 : 0;
        Vm.set(clamp(st.Vin / VCC_SENSOR), `${st.Vin.toFixed(2)} V`);
        info.set(`R_s = ${(st.Rs / 1000).toFixed(2)} kΩ\nV_in = ${st.Vin.toFixed(2)} V\n输出：${relayState ? '已触发 (ON)' : '待机 (OFF)'}`);
        this._st = st;
      },
      margin() {
        const st = this._st || solveSensorControl(p.stype ?? 0, p.env ?? 30, p.Rp ?? 15, relayState, !!p.hyst);
        return [
          p.stype === 0 ? `光照 E = ${p.env} Lux` : `温度 T = ${p.env} ℃`,
          `R_s = ${(st.Rs / 1000).toFixed(2)} kΩ`,
          `V_in = ${st.Vin.toFixed(2)} V`,
          `触发区间 [${st.vLow.toFixed(1)}, ${st.vHigh.toFixed(1)}] V`,
          `状态：${st.relay ? '继电器吸合' : '继电器释放'}`,
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec = wb.section('1 · 传感器非线性 R(x) 特性曲线与施密特防抖测试');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn primary" data-a="chatter">在临界点注入 ±0.18V 噪声测试抖动</button>
      <button type="button" class="wb-btn" data-a="rec">记录阈值状态</button>`;
    sec.append(bar);
    let noiseActive = false;
    let chatterFlips = 0;

    const cv = wb.canvas(sec, 520, 220, (x, W, H) => {
      const p = sp.params;
      const stype = p.stype ?? 0;
      const Rp = p.Rp ?? 15;
      const hystOn = !!p.hyst;
      const pad = { l: 50, r: 20, t: 22, b: 36 }, pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);

      const sx = (v) => pad.l + ((v - 1) / 99) * pw;
      const syV = (v) => pad.t + ph - (v / 5.2) * ph;

      // 滞回窗口带
      const vHi = hystOn ? 2.8 : 2.4, vLo = hystOn ? 2.0 : 2.4;
      x.fillStyle = hystOn ? 'rgba(122, 92, 255, 0.14)' : 'rgba(229, 72, 63, 0.15)';
      x.fillRect(pad.l, syV(vHi), pw, Math.max(2, syV(vLo) - syV(vHi)));

      x.strokeStyle = C.ink; x.lineWidth = 1.4;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();

      // V_in 曲线
      x.strokeStyle = '#1f4a3e'; x.lineWidth = 2.2; x.beginPath();
      for (let i = 0; i <= 99; i++) {
        const env = 1 + i;
        const sol = solveSensorControl(stype, env, Rp, false, hystOn);
        const px = sx(env), py = syV(sol.Vin);
        i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
      }
      x.stroke();

      // R_s 相对曲线 (虚线)
      x.save(); x.strokeStyle = C.copper; x.setLineDash([5, 4]); x.lineWidth = 1.6;
      x.beginPath();
      for (let i = 0; i <= 99; i++) {
        const env = 1 + i;
        const rk = clamp(sensorRes(stype, env) / 1000, 0, 80);
        const px = sx(env), py = pad.t + ph - (rk / 80) * ph;
        i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
      }
      x.stroke(); x.restore();

      const cur = solveSensorControl(stype, p.env ?? 30, Rp, false, hystOn);
      x.fillStyle = C.red; x.beginPath(); x.arc(sx(p.env ?? 30), syV(cur.Vin), 5, 0, TAU); x.fill();
      x.fillStyle = C.ink; x.font = '11px "Noto Serif SC", serif';
      x.fillText(`绿线: 分压 V_in (0–5V)   铜虚线: R_s (0–80kΩ)   紫带: 施密特滞回 [${vLo.toFixed(1)}, ${vHi.toFixed(1)}]V`, pad.l + 6, pad.t + 12);
      x.fillText(stype === 0 ? '光照强度 E (Lux)' : '温度 T (℃)', pad.l + pw / 2 - 30, H - 5);
    });
    const out = document.createElement('div');
    out.className = 'wb-metrics';
    sec.append(out);

    const refresh = () => {
      cv.redraw();
      const p = sp.params;
      const snap = sp.inst?.snapshot?.() || { relay: false };
      const st = solveSensorControl(p.stype ?? 0, p.env ?? 30, p.Rp ?? 15, snap.relay, !!p.hyst);
      out.innerHTML = `
        <div class="wb-m"><span>当前 R_s / V_in</span><b>${(st.Rs / 1000).toFixed(2)} kΩ / ${st.Vin.toFixed(2)} V</b></div>
        <div class="wb-m"><span>临界防抖测试</span><b>${noiseActive ? `40步噪声测试翻转次数: ${chatterFlips} 次` : '点击上方按钮测试临界噪声'}</b></div>`;
    };
    bar.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'chatter') {
        noiseActive = true;
        chatterFlips = 0;
        const p = sp.params;
        // 在正好 V_in ≈ 2.4 V 的临界点附近施加随机微扰
        let prev = false;
        const rRand = rng(2026);
        for (let i = 0; i < 40; i++) {
          const nv = (rRand() - 0.5) * 0.36;
          const res = solveSensorControl(p.stype ?? 0, p.env ?? 30, p.Rp ?? 15, prev, !!p.hyst, nv);
          // 寻找临界点演示：直接用 2.4V + nv 评估比较器抗噪力
          const vTest = 2.4 + nv;
          const next = vTest >= res.vHigh ? true : vTest <= res.vLow ? false : prev;
          if (next !== prev) chatterFlips++;
          prev = next;
        }
      } else if (a === 'rec') wb.press('rec');
      refresh();
    });
    refresh();
    return { update() { refresh(); } };
  },
};

// ===========================================================================
// 10. phy-oil-film (L3) — 用油膜法估测油酸分子的大小
// ===========================================================================
const OIL_CONCS = [
  { label: '1 : 1000', ratio: 1 / 1000 },
  { label: '1 : 2000', ratio: 1 / 2000 },
  { label: '1 : 4000', ratio: 1 / 4000 },
];
const OIL_D_TRUE = 5.0e-10; // 0.50 nm 真实单分子油膜厚度

function buildOilBlob(seed, targetAreaCm2) {
  const r = rng(seed);
  const baseR = Math.sqrt(targetAreaCm2 / Math.PI); // cm
  const harmonics = Array.from({ length: 5 }, (_, k) => ({
    amp: (0.06 + r() * 0.08) / (k + 1),
    ph: r() * TAU,
    f: k + 2,
  }));
  const rAt = (ang) => {
    let f = 1;
    for (const h of harmonics) f += h.amp * Math.cos(h.f * ang + h.ph);
    return baseR * f;
  };
  return { rAt, baseR };
}

function computeOilGrid(blob) {
  const N = 20; // 20 x 20 cm 方格，每格 1 cm²
  const half = N / 2;
  const cells = [];
  let autoCount = 0;
  for (let gy = 0; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      let inside = 0;
      const sub = 5;
      for (let sy = 0; sy < sub; sy++) {
        for (let sx = 0; sx < sub; sx++) {
          const cx = gx - half + (sx + 0.5) / sub;
          const cy = gy - half + (sy + 0.5) / sub;
          const dist = Math.hypot(cx, cy);
          const ang = Math.atan2(cy, cx);
          if (dist <= blob.rAt(ang)) inside++;
        }
      }
      const frac = inside / (sub * sub);
      const auto = frac >= 0.5;
      if (auto) autoCount++;
      cells.push({ gx, gy, frac, auto, manual: null });
    }
  }
  return { N, cells, autoCount };
}

const oilFilm = {
  id: 'phy-oil-film',
  subject: 'phy',
  title: '用油膜法估测油酸分子的大小',
  en: 'Estimating molecular size by oil film',
  lede: [
    '把按千分之一比例稀释的油酸酒精溶液滴一滴到撒了爽身粉的水面上：酒精溶于水并挥发，油酸分子彼此紧挨着摊开成单分子层薄膜。',
    '盖上 1 cm² 透明方格板，按“不足半格舍去、多于半格算一格”统计油膜面积 S，即可用 d = V_纯 / S 估测 10⁻¹⁰ m 量级的分子直径！',
  ],
  formula: 'V_纯 = (1 mL / N) · c · d = V_纯 / S',
  formulaNote: '1 mL 溶液共有 N 滴，稀释浓度 c；单分子层假设把纳米尺度的测量化作宏观面积计数',
  terms: [
    ['酒精的作用', '稀释油酸减小单滴纯油酸量，同时帮助油酸在水面迅速铺展后挥发溶解。'],
    ['爽身粉 / 痱子粉', '漂浮在水面，被扩散的油膜推开，勾勒出清晰的油膜边界。'],
    ['半格计数法则', '大于等于半格算 1 格，不足半格舍去，用 1 cm² 网格近似不规则面积。'],
  ],
  predict: {
    q: '配制油酸酒精溶液时，如果不小心让酒精部分挥发导致真实浓度变大（但计算仍按原配比），算出的油酸分子直径 d 会？',
    options: ['偏大', '偏小', '不变'],
    answer: 1,
    why: '酒精挥发使一滴中含有的实际纯油酸增多，水面铺开的实际油膜面积 S 变大；计算时仍用偏小的名义 V_纯 除以变大的 S，因此算得的 d = V_纯 / S 偏小！',
  },
  challenge: '滴入一滴稀释油酸并打开方格板，在工作台亲手点选或校验网格数，算出数量级约 10⁻¹⁰ m 的油酸分子直径！',
  fig: '浅水盘、爽身粉层、滴管、稀释油酸溶液与 1 cm² 透明方格板',
  hint: '点击“滴入一滴油酸”看油膜在水面推开爽身粉形成单分子层；开启方格板后可进工作台逐格计数。',
  teach: {
    where: '人教版物理选择性必修第三册第一章 §1.2《实验：用油膜法估测油酸分子的大小》',
    ask: [
      '为什么要等水面完全平静后再撒爽身粉，且粉层不能撒得太厚？',
      '为什么测量 1 滴溶液体积时，要数出 1 mL 共有多少滴（如 80 滴）求平均，而不能只测 1 滴？',
    ],
    simplify: '设油酸分子呈紧邻球形单分子平铺，理想厚度取 d = 5.0×10⁻¹⁰ m（忽略分子间空隙与长链直立角度修正）。',
  },
  controls: [
    { id: 'conc', type: 'choice', label: '稀释配比 c', options: OIL_CONCS.map((x) => x.label), value: 1 },
    { id: 'Ndrop', label: '1 mL 滴数 N', min: 50, max: 120, step: 5, value: 80, unit: '滴' },
    { id: 'grid', type: 'toggle', label: '盖上 1cm² 方格板', value: false },
    { id: 'dropBtn', type: 'button', label: '滴入一滴油酸' },
    { id: 'rec', type: 'button', label: '记录面积与分子直径' },
  ],
  record: {
    note: '记录溶液浓度、每毫升滴数、方格计数面积 S 及求得的分子直径 d。',
    pending: '滴入油酸待油膜稳定后点击“记录面积与分子直径”。',
    columns: [
      { key: 'concLabel', label: '配比 c' },
      { key: 'N', label: 'N (滴/mL)', digits: 0 },
      { key: 'Vpure', label: 'V_纯 (×10⁻⁵cm³)', digits: 3 },
      { key: 'S', label: 'S', unit: 'cm²', digits: 0 },
      { key: 'dNm', label: '测得 d', unit: 'nm', digits: 3, stat: true },
    ],
    sample: (inst, p) => {
      const s = inst?.snapshot?.();
      if (!s || !s.spreadDone) return null;
      return {
        _kind: 'human',
        concLabel: OIL_CONCS[p.conc ?? 1].label,
        N: p.Ndrop,
        Vpure: s.vPureCm3 * 1e5,
        S: s.usedSquares,
        dNm: s.dEstM * 1e9,
      };
    },
    summary: (rows) => {
      const st = sampleStats(rows.map((r) => r.dNm));
      return [['已测实验组数', `${rows.length} 组`], ['平均分子直径', st.n ? `${st.mean.toFixed(3)} nm (≈${sig(st.mean * 1e-9, 2)} m)` : '—']];
    },
    errors: [
      '油酸尚未完全散开或粉末太厚阻碍铺展，会使测得 S 偏小、d 偏大。',
      '数格时漏数大量大于半格的边缘格或把不足半格全计入。',
    ],
  },

  build(k) {
    const p = k.p, Z = -0.3;
    // 浅水盘
    const dishWall = at(glass(new THREE.CylinderGeometry(2.55, 2.55, 0.42, 48, 1, true).translate(0, 0.21, 0)), 0, 0.02, Z);
    const dishBase = at(box(5.6, 0.08, 5.6, '#e8ecee'), 0, 0, Z);
    const waterSheet = at(sheet(4.8, 4.8, () => {}, { lay: 'flat' }), 0, 0.28, Z);
    const gridSheet = at(sheet(4.2, 4.2, (x, s, w) => {
      x.strokeStyle = 'rgba(30,43,54,0.35)'; x.lineWidth = s * 0.012;
      for (let i = 0; i <= 20; i++) {
        const q = (i / 20) * w * s;
        x.beginPath(); x.moveTo(q, 0); x.lineTo(q, w * s); x.stroke();
        x.beginPath(); x.moveTo(0, q); x.lineTo(w * s, q); x.stroke();
      }
      x.strokeStyle = C.ink; x.lineWidth = s * 0.024;
      x.strokeRect(0, 0, w * s, w * s);
    }, { lay: 'flat' }), 0, 0.48, Z);
    const dropper = group(
      at(glass(new THREE.CylinderGeometry(0.11, 0.03, 0.9, 18)), 0, 2.5, Z),
      at(cyl(0.13, 0.35, C.red), 0, 3.05, Z),
    );
    const droplet = at(ball(0.06, C.amber), 0, 2.0, Z);
    droplet.visible = false;
    const info = at(card('\n', { w: 3.3, size: 0.28, align: 'left' }), -2.35, 0, -3.1);
    k.root.add(dishBase, dishWall, waterSheet, gridSheet, dropper, droplet, info);

    let spreadFrac = 1.0, dropping = false, dropY = 2.0;
    let seed = 1024;
    let manualOverride = null;

    const getPhys = () => {
      const conc = OIL_CONCS[p.conc ?? 1];
      const vPureCm3 = (1.0 / (p.Ndrop ?? 80)) * conc.ratio;
      const vPureM3 = vPureCm3 * 1e-6;
      const targetAreaCm2 = clamp(vPureM3 / OIL_D_TRUE * 1e4, 25, 290);
      const blob = buildOilBlob(seed, targetAreaCm2);
      const grid = computeOilGrid(blob);
      const usedSquares = manualOverride !== null ? manualOverride : grid.autoCount;
      const dEstM = usedSquares > 0 ? vPureM3 / (usedSquares * 1e-4) : 0;
      return { conc, vPureCm3, vPureM3, targetAreaCm2, blob, grid, usedSquares, dEstM };
    };

    let phys = getPhys();
    const paintWater = () => {
      waterSheet.redraw((x, s, w) => {
        const c = (w * s) / 2;
        x.clearRect(0, 0, w * s, w * s);
        x.save();
        x.beginPath(); x.arc(c, c, 2.32 * s, 0, TAU); x.clip();
        // 爽身粉层底色
        x.fillStyle = '#f2ede1'; x.fillRect(0, 0, w * s, w * s);
        if (spreadFrac > 0.02) {
          // 油酸单分子膜推开爽身粉露出清澈蓝灰水面
          const scale = (0.21 * spreadFrac) * s; // 20cm -> 4.2u => 1cm = 0.21u
          x.fillStyle = '#cbe0ec';
          x.strokeStyle = C.copper; x.lineWidth = s * 0.02;
          x.beginPath();
          for (let i = 0; i <= 96; i++) {
            const a = (i / 96) * TAU;
            const rr = phys.blob.rAt(a) * scale;
            const px = c + Math.cos(a) * rr, py = c + Math.sin(a) * rr;
            i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
          }
          x.closePath(); x.fill(); x.stroke();
        }
        x.restore();
      });
    };
    paintWater();

    return {
      snapshot: () => ({ ...phys, spreadDone: spreadFrac > 0.96 && !dropping }),
      setManualSquares(n) { manualOverride = n; phys = getPhys(); },
      press(id) {
        if (id === 'dropBtn') {
          seed += 37; manualOverride = null;
          phys = getPhys();
          dropping = true; dropY = 2.0; spreadFrac = 0.01;
          paintWater();
        } else if (id === 'rec') {
          const row = oilFilm.record.sample(this, p);
          if (row) k.record(row);
        }
      },
      change() { manualOverride = null; phys = getPhys(); paintWater(); },
      update(dt) {
        gridSheet.visible = !!p.grid;
        if (dropping) {
          droplet.visible = true;
          dropY -= dt * 5.2;
          droplet.position.y = dropY;
          if (dropY <= 0.3) { dropping = false; droplet.visible = false; }
        } else if (spreadFrac < 1.0 && dt > 0) {
          spreadFrac = Math.min(1.0, spreadFrac + dt * 0.85);
          paintWater();
        }
        info.set(
          `V_纯 = ${sig(phys.vPureM3, 3)} m³\n` +
          `油膜面积 S ≈ ${phys.usedSquares} cm²\n` +
          `分子直径 d ≈ ${sig(phys.dEstM, 3)} m`
        );
      },
      margin() {
        return [
          `配比 ${phys.conc.label} · ${p.Ndrop} 滴/mL`,
          `V_纯 = ${sig(phys.vPureM3, 3)} m³`,
          `计数 S = ${phys.usedSquares} cm²`,
          `d = V_纯 / S = ${sig(phys.dEstM, 3)} m`,
          '（典型油酸分子 ≈ 10⁻¹⁰ m）',
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec = wb.section('1 · 1 cm² 透明方格板逐格计数与半格规则校验');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn primary" data-a="auto">半格规则自动判别 (≥0.5 算 1)</button>
      <button type="button" class="wb-btn" data-a="clear">清空手动点选</button>
      <button type="button" class="wb-btn" data-a="drop">重新滴入一滴油酸</button>
      <button type="button" class="wb-btn" data-a="rec">记录面积与直径 d</button>`;
    sec.append(bar);

    let showAuto = true;
    const cv = wb.canvas(sec, 420, 420, (x, W, H) => {
      const snap = sp.inst?.snapshot?.();
      if (!snap) return;
      const { grid, blob } = snap;
      const N = grid.N, cell = W / N;
      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      for (const c of grid.cells) {
        const picked = c.manual !== null ? c.manual : (showAuto && c.auto);
        if (picked) {
          x.fillStyle = c.manual !== null ? 'rgba(31, 74, 62, 0.35)' : 'rgba(58, 156, 255, 0.28)';
          x.fillRect(c.gx * cell, c.gy * cell, cell, cell);
        }
      }
      // 网格线
      x.strokeStyle = 'rgba(30,43,54,0.22)'; x.lineWidth = 1;
      for (let i = 0; i <= N; i++) {
        x.beginPath(); x.moveTo(i * cell, 0); x.lineTo(i * cell, H); x.stroke();
        x.beginPath(); x.moveTo(0, i * cell); x.lineTo(W, i * cell); x.stroke();
      }
      // 油膜边界
      x.strokeStyle = C.copper; x.lineWidth = 2.4;
      x.beginPath();
      for (let i = 0; i <= 120; i++) {
        const a = (i / 120) * TAU, r = blob.rAt(a) * cell;
        const px = W / 2 + Math.cos(a) * r, py = H / 2 + Math.sin(a) * r;
        i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
      }
      x.closePath(); x.stroke();
    });
    const out = document.createElement('div');
    out.className = 'wb-metrics';
    sec.append(out);

    const countSelected = () => {
      const snap = sp.inst?.snapshot?.();
      if (!snap) return 0;
      let n = 0;
      for (const c of snap.grid.cells) {
        const picked = c.manual !== null ? c.manual : (showAuto && c.auto);
        if (picked) n++;
      }
      return n;
    };

    const refresh = () => {
      cv.redraw();
      const snap = sp.inst?.snapshot?.();
      if (!snap) return;
      const nSel = countSelected();
      const dM = nSel > 0 ? snap.vPureM3 / (nSel * 1e-4) : 0;
      out.innerHTML = `
        <div class="wb-m"><span>已点选方格数 (点击画布可逐格增删)</span><b>${nSel} 格 → S = ${nSel} cm²</b></div>
        <div class="wb-m"><span>单滴纯油酸体积 V_纯</span><b>${sig(snap.vPureM3, 3)} m³</b></div>
        <div class="wb-m"><span>分子直径 d = V_纯 / S</span><b>${nSel > 0 ? `${sig(dM, 3)} m (${(dM * 1e9).toFixed(3)} nm)` : '—'}</b></div>`;
    };

    cv.cv.addEventListener('pointerdown', (e) => {
      const snap = sp.inst?.snapshot?.();
      if (!snap) return;
      const pt = cv.toLocal(e);
      const gx = Math.floor((pt.x / 420) * snap.grid.N);
      const gy = Math.floor((pt.y / 420) * snap.grid.N);
      const cell = snap.grid.cells.find((c) => c.gx === gx && c.gy === gy);
      if (cell) {
        const cur = cell.manual !== null ? cell.manual : (showAuto && cell.auto);
        cell.manual = !cur;
        sp.inst?.setManualSquares?.(countSelected());
        refresh();
      }
    });

    bar.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      const snap = sp.inst?.snapshot?.();
      if (a === 'auto') {
        showAuto = true;
        if (snap) snap.grid.cells.forEach((c) => { c.manual = null; });
        sp.inst?.setManualSquares?.(null);
      } else if (a === 'clear') {
        showAuto = false;
        if (snap) snap.grid.cells.forEach((c) => { c.manual = false; });
        sp.inst?.setManualSquares?.(0);
      } else if (a === 'drop') {
        showAuto = true;
        wb.press('dropBtn');
      } else if (a === 'rec') {
        sp.inst?.setManualSquares?.(countSelected());
        wb.press('rec');
      }
      refresh();
    });
    refresh();
    return { update() { refresh(); } };
  },
};

// ===========================================================================
// 11. phy-boyle (L3) — 探究等温情况下一定质量气体压强与体积的关系 (升级自 phy.js#phy-boyle)
// ===========================================================================
const BOYLE_TEMPS = [
  { label: '0 ℃ (273 K)', T: 273 },
  { label: '27 ℃ (300 K)', T: 300 },
  { label: '100 ℃ (373 K)', T: 373 },
];
const BOYLE_V0 = 4.0; // mL 软管死体积

function solveBoyle(tempIdx, V, hasDeadVol) {
  const T = (BOYLE_TEMPS[tempIdx] || BOYLE_TEMPS[1]).T;
  const V0 = hasDeadVol ? BOYLE_V0 : 0;
  // 真实气体总体积 V + V0 满足 p * (V + V0) = 10 * T (kPa·mL)
  const p = (10 * T) / Math.max(1, V + V0);
  return { T, V, V0, p, pV: p * V, pVtrue: p * (V + V0) };
}

const boyle = {
  id: 'phy-boyle',
  subject: 'phy',
  title: '探究等温情况下一定质量气体压强与体积的关系',
  en: "Boyle's law: p-V and p-1/V",
  lede: [
    '把一定质量的空气封闭在带刻度的玻璃注射器里，缓慢推拉活塞改变空气柱体积 V：温度不变时，压强 p 与体积成反比，p–1/V 呈过原点的直线。',
    '若忘记计入连接压强传感器的细软管死体积 V₀，用注射器读数 V 作图时 p–1/V 会向下弯曲，而在 V–1/p 图像上截距则会下移 −V₀！',
  ],
  formula: 'p (V + V₀) = C(T) · p V = 常量（V₀ = 0）',
  formulaNote: '当存在死体积 V₀ 时，V = C/p − V₀，纵截距直接暴露未计入的软管容积',
  terms: [
    ['等温缓慢推拉', '推拉活塞须足够缓慢，使压缩功产生的热量及时与环境热交换，维持温度恒定。'],
    ['死体积 V₀', '注射器嘴到传感器膜片之间细软管内的气体体积；忽略它会破坏 p 与 1/V 的正比性。'],
    ['化曲为直', 'p–V 双曲线难以用肉眼直接判别是否反比，改画 p–1/V 或 V–1/p 直线一目了然。'],
  ],
  predict: {
    q: '实验时连接软管内部有 4.0 mL 未被注射器刻度计入的气体（死体积 V₀ = 4.0 mL），记录数据后以纵轴 p、横轴 1/V_注射器 作图，图线会呈现什么形状？',
    options: [
      '仍然是一条严格过原点的直线',
      '随着 1/V 增大（体积越小），图线逐渐向下弯曲（斜率变小）',
      '随着 1/V 增大，图线急剧向上弯曲',
    ],
    answer: 1,
    why: '真实规律是 p = C / (V + V₀) = C·(1/V) / [1 + V₀·(1/V)]。当 V 很小（1/V 很大）时分母 1 + V₀/V 明显大于 1，导致实测压强 p 低于理想直线，曲线向下弯曲！',
  },
  challenge: '开启“软管死体积 V₀ = 4 mL”采满 5 组不同体积，进入工作台切换到 V–1/p 坐标系，利用线性回归截距反推出隐藏死体积 V₀！',
  fig: '玻璃注射器、可拖动活塞、气体分子、压强表、软管与双坐标系图板',
  hint: '直接上下拖动活塞或用滑杆改体积 V；按“记录一组”采集数据，切换 p–V 与 p–1/V 观察线形。',
  teach: {
    where: '人教版物理选择性必修第三册第二章 §2.2《气体的等温变化：实验探究》',
    ask: [
      '实验中为什么不能用手直接紧握注射器的封闭空气柱部分？',
      '除了改画 p–1/V 之外，改画 V–1/p 有什么独特好处？截距代表什么物理量？',
    ],
    simplify: '设封闭空气为理想气体（nR 常数标定为 10 kPa·mL/K），不漏气；快推时在工作台提示非等温绝热升温偏差。',
  },
  controls: [
    { id: 'V', label: '注射器刻度 V', min: 10, max: 50, step: 1, value: 30, unit: 'mL' },
    { id: 'T', type: 'choice', label: '温度', options: BOYLE_TEMPS.map((x) => x.label), value: 1 },
    { id: 'deadVol', type: 'toggle', label: '软管死体积 V₀ (4mL)', value: false, wide: true },
    { id: 'ax', type: 'choice', label: '图线坐标系', options: ['p–V', 'p–1/V'], value: 0 },
    { id: 'rec', type: 'button', label: '记录一组' },
    { id: 'clr', type: 'button', label: '清空图点' },
  ],
  record: {
    note: '采集多组 (V, p)，核对 p·V 乘积与死体积 V₀ 对线性度的影响。',
    pending: '调节注射器体积 V 并点击“记录一组”。',
    columns: [
      { key: 'tempC', label: '温度', digits: 0, unit: '℃' },
      { key: 'v0Name', label: '死体积' },
      { key: 'V', label: 'V_刻度', unit: 'mL', digits: 1 },
      { key: 'p', label: '压强 p', unit: 'kPa', digits: 1 },
      { key: 'pV', label: 'p·V', unit: 'kPa·mL', digits: 0 },
    ],
    sample: (_inst, p) => {
      const s = solveBoyle(p.T ?? 1, p.V ?? 30, !!p.deadVol);
      return {
        _kind: 'simulated',
        tempC: s.T - 273,
        v0Name: p.deadVol ? '4mL' : '0',
        V: s.V, p: s.p, pV: s.pV,
      };
    },
    summary: (rows) => {
      const reg = linearRegression(rows.map((r) => [1 / r.p, r.V]));
      return [
        ['已采集状态数', `${rows.length} 组`],
        ['V–1/p 回归截距 (−V₀)', reg ? `${reg.b.toFixed(2)} mL (R²=${reg.r2.toFixed(4)})` : '需 ≥2 组'],
      ];
    },
    errors: [
      '活塞推动过快造成气体温度短暂升高，会使同一批数据偏离等温双曲线。',
      '忽略软管死体积 V₀ 时，p–1/V 曲线向下弯曲；改作 V–1/p 图可由纵截距 −V₀ 直接测出死体积。',
    ],
  },

  build(k) {
    const p = k.p, R = 1.05, X = -2.2, Z = -0.8, H = 4.4;
    const wall = at(new THREE.Group(), X, 0.5, Z);
    k.root.add(at(cyl(1.3, 0.5), X, 0, Z), wall);
    wall.add(glass(new THREE.CylinderGeometry(R, R, H, 44, 1, true).translate(0, H / 2, 0)));
    const piston = group(cyl(R * 0.97, 0.22, C.shade), at(cyl(0.12, 2.5), 0, 0.22, 0), at(cyl(0.62, 0.14, BRASS, { kind: 'metal' }), 0, 2.7, 0));
    wall.add(piston);
    const gas = dots(46, 0.07, C.violet, { flat: true });
    wall.add(gas);
    const st = Array.from({ length: 46 }, () => {
      const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * 0.9, d = new THREE.Vector3().randomDirection();
      return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: Math.random(), vx: d.x, vy: d.y, vz: d.z };
    });
    const gauge = at(meter('kPa', { w: 2 }), 1.25, 0, 2.2);
    const shortTube = tube([[X + 1.2, 0.25, Z], [X + 2.1, 0.08, Z + 1.15], [1.25, 0.08, 1.85]], 0.05);
    const deadTube = tube([[X + 1.2, 0.25, Z], [X + 1.9, 0.12, Z + 0.6], [X + 2.6, 0.12, Z + 1.5], [1.6, 0.08, 2.1], [1.25, 0.08, 1.85]], 0.085, '#c8895a');
    const g = at(plot({ w: 4, h: 3.05, xr: [0, 55], yr: [0, 400], xl: 'V / mL', yl: 'p / kPa' }), 2.3, 0, -2.35);
    k.root.add(gauge, shortTube, deadTube, g);

    const pts = [];
    const draw = () => {
      const inv = p.ax === 1;
      const cur = solveBoyle(p.T ?? 1, p.V ?? 30, !!p.deadVol);
      g.range(inv ? [0, 0.11] : [0, 55], [0, 400]).clear();
      BOYLE_TEMPS.forEach((bt, i) => {
        g.fn((x) => {
          const V = inv ? 1 / Math.max(x, 0.008) : Math.max(x, 1);
          return (10 * bt.T) / (V + (p.deadVol ? BOYLE_V0 : 0));
        }, i === p.T ? C.violet : 'rgba(30,43,54,.24)', 0.03, i !== p.T);
      });
      pts.forEach(([V, P]) => g.dot(inv ? 1 / V : V, P));
      g.dot(inv ? 1 / cur.V : cur.V, cur.p, C.amber, 0.09)
        .text(inv ? 0.055 : 26, 370, inv ? '横轴: 1/V (mL⁻¹)' : '')
        .done();
    };
    draw();

    // 直接上下拖活塞改体积
    let dY = null, v0 = 30;
    k.drag(piston, {
      normal: 'z',
      start: () => { dY = null; v0 = p.V; },
      move: (q) => {
        if (dY === null) { dY = q.y; return; }
        const nv = clamp(Math.round(v0 + ((q.y - dY) / (H - 0.9)) * 40), 10, 50);
        k.set('V', nv);
        draw();
      },
      end: () => { dY = null; },
    });

    return {
      press(id) {
        const cur = solveBoyle(p.T ?? 1, p.V ?? 30, !!p.deadVol);
        if (id === 'rec') {
          pts.push([cur.V, cur.p]);
          const row = boyle.record.sample(this, p);
          if (row) k.record(row);
        } else if (id === 'clr') {
          pts.length = 0;
        }
        draw();
      },
      change(id) {
        if (id === 'T' || id === 'deadVol') pts.length = 0;
        draw();
      },
      update(dt) {
        const cur = solveBoyle(p.T ?? 1, p.V ?? 30, !!p.deadVol);
        const hp = 0.25 + ((p.V ?? 30) / 50) * (H - 0.9);
        const sp = Math.sqrt(cur.T / 300) * 2.5;
        piston.position.y = hp;
        shortTube.visible = !p.deadVol;
        deadTube.visible = !!p.deadVol;
        st.forEach((m, i) => {
          m.x += m.vx * sp * dt; m.y += m.vy * sp * dt; m.z += m.vz * sp * dt;
          const rr = Math.hypot(m.x, m.z);
          if (rr > 0.93) {
            const nx = m.x / rr, nz = m.z / rr, d = m.vx * nx + m.vz * nz;
            if (d > 0) { m.vx -= 2 * d * nx; m.vz -= 2 * d * nz; }
            m.x = nx * 0.93; m.z = nz * 0.93;
          }
          if (m.y < 0.1) { m.y = 0.1; m.vy = Math.abs(m.vy); }
          if (m.y > hp - 0.1) { m.y = hp - 0.1; m.vy = -Math.abs(m.vy); }
          gas.put(i, m.x, m.y, m.z);
        });
        gas.done();
        gauge.set(clamp(cur.p / 400), `${cur.p.toFixed(0)} kPa`);
      },
      margin() {
        const cur = solveBoyle(p.T ?? 1, p.V ?? 30, !!p.deadVol);
        return [
          `p = ${cur.p.toFixed(1)} kPa · V = ${cur.V} mL`,
          `p·V = ${cur.pV.toFixed(0)} kPa·mL`,
          p.deadVol ? `死体积 V₀ = ${BOYLE_V0} mL (开启)` : '理想模型 V₀ = 0 mL',
          `T = ${cur.T} K`,
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec = wb.section('1 · p–V 双曲线 vs p–1/V 与 V–1/p 死体积截距反演');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn primary" data-a="sweep">采集 5 组典型体积 (12–48 mL)</button>
      <button type="button" class="wb-btn" data-a="dead">切换死体积 V₀ (0 / 4 mL)</button>
      <button type="button" class="wb-btn" data-a="mode">切换图轴 (p–1/V ↔ V–1/p)</button>`;
    sec.append(bar);
    let viewMode = 0; // 0: p-1/V, 1: V-1/p (直接看 -V0 截距)
    const chart = wb.regressionChart(sec, {
      w: 510, h: 235, xLabel: '1/V (mL⁻¹)', yLabel: 'p (kPa)', xRange: [0, 0.11], yRange: [0, 400],
    });
    const out = document.createElement('div');
    out.className = 'wb-metrics';
    sec.append(out);

    const refresh = () => {
      const p = sp.params;
      const T = (BOYLE_TEMPS[p.T ?? 1] || BOYLE_TEMPS[1]).T;
      const V0 = p.deadVol ? BOYLE_V0 : 0;
      const rows = wb.rows();
      if (viewMode === 0) {
        const pts = rows.map((r) => [1 / r.V, r.p, r._kind || 'simulated']);
        chart.redraw({
          pts, xRange: [0, 0.11], yRange: [0, 400],
          theoryFn: (invV) => (10 * T) / (1 / Math.max(invV, 0.008) + V0),
        });
      } else {
        const pts = rows.map((r) => [1 / r.p, r.V, r._kind || 'simulated']);
        chart.redraw({
          pts, xRange: [0, 0.018], yRange: [-8, 56],
          theoryFn: (invP) => 10 * T * invP - V0,
        });
      }
      const regV = linearRegression(rows.map((r) => [1 / r.p, r.V]));
      out.innerHTML = `
        <div class="wb-m"><span>当前坐标系</span><b>${viewMode === 0 ? 'p – 1/V（有 V₀ 时曲线向下弯）' : 'V – 1/p（截距直接给出 −V₀）'}</b></div>
        <div class="wb-m"><span>V–1/p 回归截距 (${rows.length} 组)</span><b>${regV ? `${regV.b.toFixed(2)} mL → 测得 V₀ ≈ ${(-regV.b).toFixed(2)} mL` : '需 ≥2 组数据'}</b></div>`;
    };
    bar.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'sweep') {
        [12, 18, 25, 35, 48].forEach((V) => {
          const s = solveBoyle(sp.params.T ?? 1, V, !!sp.params.deadVol);
          wb.record({ _kind: 'simulated', tempC: s.T - 273, v0Name: sp.params.deadVol ? '4mL' : '0', V: s.V, p: s.p, pV: s.pV });
        });
      } else if (a === 'dead') {
        wb.setParam('deadVol', !sp.params.deadVol);
      } else if (a === 'mode') {
        viewMode = 1 - viewMode;
      }
      refresh();
    });
    refresh();
    return { update() { refresh(); } };
  },
};

export default [
  resistivityCaliper,
  multimeter,
  emf,
  capacitor,
  refract,
  young,
  induction,
  transformer,
  sensor,
  oilFilm,
  boyle,
];
