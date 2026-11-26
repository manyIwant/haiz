// HAIZ · EXPERIMENTARIUM — 纯科学计算内核（单摆RK4 / 酸碱平衡 / 水解 / 圆锥曲线 / 光学 / 天文 / 材料力学 / 逻辑 / 诗律 / 经济）
// 本模块零 DOM/Three.js 依赖，供实验三维模型、交互工作台及 Node 科学单元测试共同调用，杜绝重复实现。
import { ellipK, periodFactor, DEG } from './epistemic.js';

/** 1. 单摆 RK4 步进积分（含真实非线性 sinθ 与可选线性公式对照） */
export function stepPendulumRK4(th, om, g, l, gamma, dt, linear = false) {
  const f = (a, v) => -(g / l) * (linear ? a : Math.sin(a)) - gamma * v;
  const k1a = om, k1v = f(th, om);
  const k2a = om + 0.5 * dt * k1v, k2v = f(th + 0.5 * dt * k1a, om + 0.5 * dt * k1v);
  const k3a = om + 0.5 * dt * k2v, k3v = f(th + 0.5 * dt * k2a, om + 0.5 * dt * k2v);
  const k4a = om + dt * k3v, k4v = f(th + dt * k3a, om + dt * k3v);
  return [
    th + (dt / 6) * (k1a + 2 * k2a + 2 * k3a + k4a),
    om + (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v),
  ];
}

export function pendulumExactPeriod(l, g, th0Rad) {
  const T0 = 2 * Math.PI * Math.sqrt(l / g);
  return { T0, factor: periodFactor(th0Rad), T: T0 * periodFactor(th0Rad) };
}

/** 2. 酸碱中和滴定严格质子/电荷守恒求解（强酸 HCl 或弱酸 CH3COOH，25°C Kw=1e-14） */
export function solveTitrationPH(vBaseMl, cAcid = 0.1, vAcidMl = 20.0, cBase = 0.1, acidType = 'strong', ka = 1.75e-5) {
  const Kw = 1e-14;
  const vTot = Math.max(1e-6, vAcidMl + vBaseMl);
  const Ca = (cAcid * vAcidMl) / vTot;
  const Cb = (cBase * vBaseMl) / vTot;
  if (acidType === 'strong') {
    const delta = Ca - Cb; // [H+] - [OH-] = delta
    const h = 0.5 * (delta + Math.sqrt(delta * delta + 4 * Kw));
    return {
      pH: -Math.log10(Math.max(1e-15, h)),
      species: { H: h, OH: Kw / h, A: Ca, Na: Cb },
    };
  }
  // 弱酸 HA + NaOH: [H+] + Cb = Kw/[H+] + Ca * Ka / ([H+] + Ka)
  // f(pH) = [H+] + Cb - Kw/[H+] - Ca*Ka/([H+]+Ka) 随 pH 单调递减，用二分法在 [0, 14] 稳健求解
  let lo = 0, hi = 14;
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (lo + hi);
    const h = Math.pow(10, -mid);
    const val = h + Cb - Kw / h - (Ca * ka) / (h + ka);
    if (val > 0) lo = mid; else hi = mid;
  }
  const pH = 0.5 * (lo + hi);
  const h = Math.pow(10, -pH);
  const aMinus = (Ca * ka) / (h + ka);
  return {
    pH,
    species: { H: h, OH: Kw / h, A: aMinus, HA: Math.max(0, Ca - aMinus), Na: Cb },
  };
}

/** 3. 盐类水解 pH 求解（25°C 默认） */
export function solveHydrolysisPH(saltType, conc = 0.1, tempC = 25) {
  // Kw(T) 经验热力学近似（0-100°C）：pKw(25)=14.00, pKw(50)=13.26, pKw(80)=12.60
  const T = tempC + 273.15;
  const pKw = 14.0 - 0.032 * (tempC - 25) + 0.00011 * (tempC - 25) ** 2;
  const Kw = Math.pow(10, -pKw);
  if (saltType === 'NaCl') return { pH: pKw / 2, pKw, nature: '中性' };
  if (saltType === 'CH3COONa') {
    const Ka = 1.75e-5; // 弱酸酸根水解 Kh = Kw/Ka
    const Kh = Kw / Ka;
    // [OH-] ≈ sqrt(Kh * c) 与精确电荷守恒联合二分
    let lo = 0, hi = 14;
    for (let i = 0; i < 60; i++) {
      const mid = 0.5 * (lo + hi), h = Math.pow(10, -mid);
      const val = h + conc - Kw / h - (conc * Ka) / (h + Ka);
      if (val > 0) lo = mid; else hi = mid;
    }
    return { pH: 0.5 * (lo + hi), pKw, nature: '碱性', reaction: 'CH₃COO⁻ + H₂O ⇌ CH₃COOH + OH⁻' };
  }
  if (saltType === 'NH4Cl') {
    const Kb = 1.77e-5;
    let lo = 0, hi = 14;
    for (let i = 0; i < 60; i++) {
      const mid = 0.5 * (lo + hi), h = Math.pow(10, -mid), oh = Kw / h;
      const val = h + (conc * Kb) / (oh + Kb) - oh - conc;
      if (val > 0) lo = mid; else hi = mid;
    }
    return { pH: 0.5 * (lo + hi), pKw, nature: '酸性', reaction: 'NH₄⁺ + H₂O ⇌ NH₃·H₂O + H⁺' };
  }
  if (saltType === 'Na2CO3') {
    const Ka1 = 4.3e-7, Ka2 = 5.6e-11;
    let lo = 0, hi = 14;
    for (let i = 0; i < 60; i++) {
      const mid = 0.5 * (lo + hi), h = Math.pow(10, -mid);
      const den = h * h + h * Ka1 + Ka1 * Ka2;
      const hco3 = (conc * h * Ka1) / den, co3 = (conc * Ka1 * Ka2) / den;
      const val = h + 2 * conc - Kw / h - hco3 - 2 * co3;
      if (val > 0) lo = mid; else hi = mid;
    }
    return { pH: 0.5 * (lo + hi), pKw, nature: '强碱性', reaction: 'CO₃²⁻ + H₂O ⇌ HCO₃⁻ + OH⁻' };
  }
  // FeCl3 强烈水解（简化一级等效 pKa≈2.2 + 温度吸热增强）
  const KaFe = 6.3e-3 * Math.exp((tempC - 25) * 0.035);
  const h = 0.5 * (-KaFe + Math.sqrt(KaFe * KaFe + 4 * KaFe * conc));
  return { pH: -Math.log10(Math.max(1e-14, h)), pKw, nature: '强酸性（Fe(OH)₃ 胶体趋向）', reaction: 'Fe³⁺ + 3H₂O ⇌ Fe(OH)₃(胶体) + 3H⁺' };
}

/** 4. 圆锥曲线几何截交与退化判别 */
export function classifyConicSection(thetaDeg, d, alphaDeg = 30) {
  const e = Math.sin(thetaDeg * DEG) / Math.cos(alphaDeg * DEG);
  const atApex = Math.abs(d) < 0.04;
  let kind, degenerate = false;
  if (atApex) {
    degenerate = true;
    if (e < 0.99) kind = '退化：一个点（顶点）';
    else if (Math.abs(e - 1) <= 0.018) kind = '退化：一条直线（母线）';
    else kind = '退化：两条相交直线';
  } else {
    if (thetaDeg < 0.5) kind = '圆';
    else if (Math.abs(e - 1) <= 0.015) kind = '抛物线';
    else if (e < 1) kind = '椭圆';
    else kind = '双曲线';
  }
  return { e, kind, degenerate, atApex };
}

/** 5. 地球公转太阳直射点与正午太阳高度、昼长 */
export function solveEarthSun(dayOfYear, latDeg) {
  const decRad = Math.asin(Math.sin(23.44 * DEG) * Math.sin((2 * Math.PI * (dayOfYear - 80)) / 365));
  const decDeg = decRad / DEG;
  const phi = latDeg * DEG;
  const x = -Math.tan(phi) * Math.tan(decRad);
  const dayHours = x >= 1 ? 0 : x <= -1 ? 24 : (2 * Math.acos(x)) / DEG / 15;
  const solarAlt = Math.max(0, 90 - Math.abs(latDeg - decDeg));
  return { decDeg, dayHours, solarAlt, polarDay: x <= -1, polarNight: x >= 1 };
}

/** 6. 梁的截面惯性矩与挠度（等面积对比支持：平放、立放、空心方管、工字钢） */
export function solveBeamDeflection(L, F, matE, profile = 'flat') {
  // 所有截面基准面积固定 A = 1.8e-4 m^2 (180 mm^2)
  let I = 0, yMax = 0, label = '';
  if (profile === 'flat') {
    const b = 0.03, h = 0.006; I = (b * h ** 3) / 12; yMax = h / 2; label = '矩形平放 30×6 mm';
  } else if (profile === 'edge') {
    const b = 0.006, h = 0.03; I = (b * h ** 3) / 12; yMax = h / 2; label = '矩形立放 6×30 mm';
  } else if (profile === 'hollow') {
    // 18×18 外框，壁厚约 2.98 mm => 面积 180 mm^2
    const B = 0.018, bi = 0.01204; I = (B ** 4 - bi ** 4) / 12; yMax = B / 2; label = '等面积空心方管';
  } else {
    // 工字钢：总高 30mm，上下翼缘 20×3mm，腹板 24×2.5mm => 面积 = 2*60 + 60 = 180 mm^2
    const bw = 0.02, H = 0.03, hw = 0.024, tw = 0.0025;
    I = (bw * H ** 3 - (bw - tw) * hw ** 3) / 12; yMax = H / 2; label = '等面积工字钢';
  }
  const delta = (F * L ** 3) / (48 * matE * I);
  const Mmax = (F * L) / 4;
  const sigmaMaxMPa = ((Mmax * yMax) / I) / 1e6;
  return { I, delta, sigmaMaxMPa, label };
}

/** 7. 活字印刷与雕版印刷技术经济工时对比模型 */
export function solveMovableTypeEconomics(books = 3, copiesPerBook = 100, uniqueCharsPerBook = 800, overlapRate = 0.65) {
  // 估算全套词库所需新刻字数（首部全刻，后续书按复用率递减增量 + 常用字复本）
  const totalUniqueCarved = Math.round(uniqueCharsPerBook * (1 + (books - 1) * (1 - overlapRate)) * 1.18);
  const woodCarvePerChar = 0.45; // 分钟/字（木版精刻参考示意）
  const clayCarvePerChar = 0.35; // 分钟/字（胶泥刻制）
  const typesetPerChar = 0.08;   // 分钟/字（排字与烧固调平）
  const printPerSheet = 0.12;    // 分钟/张（刷墨覆纸揭纸）
  const woodTime = books * uniqueCharsPerBook * woodCarvePerChar + books * copiesPerBook * printPerSheet;
  const movableTime = totalUniqueCarved * clayCarvePerChar + books * uniqueCharsPerBook * typesetPerChar + books * copiesPerBook * printPerSheet * 1.05;
  return { totalUniqueCarved, woodTime, movableTime, movableFaster: movableTime < woodTime };
}

/** 8. 洛伦兹曲线与五等份基尼系数计算 */
export function solveLorenzGini(ineqG = 0.6, redistrT = 0.1) {
  const raw = [0, 1, 2, 3, 4].map((i) => Math.pow((i + 0.5) / 5, ineqG * 3.2));
  const sum = raw.reduce((a, b) => a + b, 0);
  const pre = raw.map((v) => v / sum);
  const post = pre.map((v) => v * (1 - redistrT) + 0.2 * redistrT);
  const gini = (sh) => {
    let L = 0, area = 0;
    for (const s of sh) { area += (L + (L + s)) * 0.2 * 0.5 * 2; L += s; }
    return 1 - area;
  };
  return { pre, post, giniPre: gini(pre), giniPost: gini(post), topToBottomRatio: post[4] / Math.max(1e-6, post[0]) };
}

/** 9. 亚里士多德三段论（词项逻辑）有效性严格判定 */
export function checkSyllogismValidity(majorType, minorType, conclType, figure = 1) {
  // type: 'A' | 'E' | 'I' | 'O'
  // figure 1: M-P, S-M; figure 2: P-M, S-M; figure 3: M-P, M-S; figure 4: P-M, M-S
  const isNeg = (t) => t === 'E' || t === 'O';
  const isPart = (t) => t === 'I' || t === 'O';
  const subjDist = (t) => t === 'A' || t === 'E';
  const predDist = (t) => t === 'E' || t === 'O';

  const errors = [];
  if (isNeg(majorType) && isNeg(minorType)) errors.push('两否定前提不能得出必然结论');
  if ((isNeg(majorType) || isNeg(minorType)) && !isNeg(conclType)) errors.push('前提有一否定则结论必须否定');
  if (!isNeg(majorType) && !isNeg(minorType) && isNeg(conclType)) errors.push('两肯定前提不能得出否定结论');
  if (isPart(majorType) && isPart(minorType)) errors.push('两特称前提不能得出必然结论');
  if ((isPart(majorType) || isPart(minorType)) && !isPart(conclType)) errors.push('前提有一特称则结论必须特称');

  // 中项周延检查
  const mDistMajor = (figure === 1 || figure === 3) ? subjDist(majorType) : predDist(majorType);
  const mDistMinor = (figure === 3 || figure === 4) ? subjDist(minorType) : predDist(minorType);
  if (!mDistMajor && !mDistMinor) errors.push('中项在两前提中均不周延（中项不周延谬误）');

  // 大项、小项不当周延检查（结论 S-P）
  const pDistMajor = (figure === 1 || figure === 3) ? predDist(majorType) : subjDist(majorType);
  const sDistMinor = (figure === 3 || figure === 4) ? predDist(minorType) : subjDist(minorType);
  if (predDist(conclType) && !pDistMajor) errors.push('大项在结论中周延但在大前提中不周延（大项不当周延）');
  if (subjDist(conclType) && !sDistMinor) errors.push('小项在结论中周延但在小前提中不周延（小项不当周延）');

  return { valid: errors.length === 0, errors };
}

/** 10. 供求均衡与限价无谓损失 */
export function solveMarketEquilibrium(dDemand = 0, dSupply = 0, policy = 0, capPrice = 4, floorPrice = 7) {
  const qd = (P) => Math.max(0, 100 + dDemand - 10 * P);
  const qs = (P) => Math.max(0, 12 * P - 20 + dSupply);
  const pe = (120 + dDemand - dSupply) / 22;
  const qe = qd(pe);
  let P = pe;
  if (policy === 1 && pe > capPrice) P = capPrice;
  if (policy === 2 && pe < floorPrice) P = floorPrice;
  const D = qd(P), S = qs(P), Q = Math.min(D, S);
  // 若限价生效，计算真实成交量 Q 处对应的需求意愿价与供给底价差以求无谓损失三角形面积
  let dwl = 0;
  if (Q < qe && P !== pe) {
    const pDemandAtQ = (100 + dDemand - Q) / 10;
    const pSupplyAtQ = (Q + 20 - dSupply) / 12;
    dwl = 0.5 * Math.max(0, pDemandAtQ - pSupplyAtQ) * (qe - Q);
  }
  return { pe, qe, P, D, S, Q, shortage: Math.max(0, D - S), surplus: Math.max(0, S - D), dwl };
}
