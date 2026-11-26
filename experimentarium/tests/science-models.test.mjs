// HAIZ · EXPERIMENTARIUM — 纯科学内核 Node 单元测试（科学真实性核心防线）
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  stepPendulumRK4, pendulumExactPeriod, solveTitrationPH, solveHydrolysisPH,
  classifyConicSection, solveEarthSun, solveBeamDeflection,
  solveMovableTypeEconomics, solveLorenzGini, checkSyllogismValidity,
  solveMarketEquilibrium,
} from '../js/core/science-models.js';
import { periodFactor, linearRegression, chiSquare, DEG } from '../js/core/epistemic.js';

test('单摆完整非线性 RK4 与第一类完全椭圆积分定量一致且小角收敛至 2π√(l/g)', () => {
  const { T0, T: T60, factor } = pendulumExactPeriod(1.0, 9.8, 60 * DEG);
  assert.ok(Math.abs(T0 - 2 * Math.PI * Math.sqrt(1 / 9.8)) < 1e-12);
  assert.ok(factor > 1.07 && factor < 1.08, `60° factor 应约 1.0732，实得 ${factor}`);

  // 从 60° 静止无阻尼释放，用 RK4 测两次负向到正向过零点时间间隔 = 真实周期
  let th = 60 * DEG, om = 0, lastCross = null, simT = 0;
  const h = 1 / 480;
  for (let i = 0; i < 480 * 8; i++) {
    const prev = th;
    [th, om] = stepPendulumRK4(th, om, 9.8, 1.0, 0, h, false);
    if (prev < 0 && th >= 0) {
      const tc = (i + 1) * h - h * (th / (th - prev));
      if (lastCross !== null) { simT = tc - lastCross; break; }
      lastCross = tc;
    }
  }
  assert.ok(Math.abs(simT - T60) < 5e-4, `RK4 实测周期 ${simT} 应贴合精确椭圆积分周期 ${T60}`);
  assert.ok(periodFactor(4 * DEG) - 1 < 0.0005, '4°以内误差应低于 0.05%');
});

test('酸碱中和滴定（强酸强碱与弱酸醋酸）严格满足质子守恒与半当量点特征', () => {
  // 20 mL 0.1 M HCl + 20 mL 0.1 M NaOH => pH 7.000
  const eqStrong = solveTitrationPH(20.0, 0.1, 20.0, 0.1, 'strong');
  assert.ok(Math.abs(eqStrong.pH - 7.0) < 1e-3);

  // 20 mL 0.1 M CH3COOH (Ka=1.75e-5) + 10 mL 0.1 M NaOH => 半当量缓冲点 pH ≈ pKa ≈ 4.757
  const halfWeak = solveTitrationPH(10.0, 0.1, 20.0, 0.1, 'weak', 1.75e-5);
  assert.ok(Math.abs(halfWeak.pH - (-Math.log10(1.75e-5))) < 0.02);

  // 弱酸等当点明显呈碱性（> 8.5）
  const eqWeak = solveTitrationPH(20.0, 0.1, 20.0, 0.1, 'weak', 1.75e-5);
  assert.ok(eqWeak.pH > 8.6 && eqWeak.pH < 8.9);
});

test('盐类水解受盐类型及温度升高（吸热使 Kw 增大、促进水解）影响真实', () => {
  const nacl25 = solveHydrolysisPH('NaCl', 0.1, 25);
  assert.ok(Math.abs(nacl25.pH - 7.0) < 1e-4);
  const nacl80 = solveHydrolysisPH('NaCl', 0.1, 80);
  assert.ok(nacl80.pH < 6.45, '纯水在80°C依然中性但pH小于7');
  assert.ok(solveHydrolysisPH('CH3COONa', 0.1, 25).pH > 8.5);
  assert.ok(solveHydrolysisPH('NH4Cl', 0.1, 25).pH < 5.5);
});

test('圆锥曲线截面分类与 d=0 退化极限严格成立', () => {
  assert.equal(classifyConicSection(0, 0.5, 30).kind, '圆');
  assert.equal(classifyConicSection(30, 0.5, 30).kind, '椭圆');
  const para = classifyConicSection(60, 0.5, 30);
  assert.equal(para.kind, '抛物线');
  assert.ok(Math.abs(para.e - 1) < 1e-6);
  assert.equal(classifyConicSection(75, 0.5, 30).kind, '双曲线');
  assert.equal(classifyConicSection(60, 0.0, 30).degenerate, true);
  assert.equal(classifyConicSection(75, 0.0, 30).kind, '退化：两条相交直线');
});

test('天文地球公转与海口正午太阳高度、极昼判别正确', () => {
  // 夏至日(约第172天)，北回归线以南的海口(20°N)正午太阳高度接近 86.5°
  const summer = solveEarthSun(172, 20);
  assert.ok(summer.decDeg > 23.0);
  assert.ok(summer.solarAlt > 85.0 && summer.dayHours > 13.0);
  assert.equal(solveEarthSun(172, 75).polarDay, true);
});

test('材料力学等截面梁立放与工字钢抗弯刚度显著高于平放', () => {
  const flatB = solveBeamDeflection(1.0, 500, 200e9, 'flat');
  const edgeB = solveBeamDeflection(1.0, 500, 200e9, 'edge');
  const iB = solveBeamDeflection(1.0, 500, 200e9, 'i');
  assert.ok(Math.abs(flatB.delta / edgeB.delta - 25) < 1e-6, '等截面 30×6 立放惯性矩是平放的 25 倍');
  assert.ok(iB.delta < edgeB.delta);
});

test('亚里士多德三段论判定真有效式(AAA-1)与中项不周延谬误(AAA-2)', () => {
  assert.equal(checkSyllogismValidity('A', 'A', 'A', 1).valid, true);
  assert.equal(checkSyllogismValidity('E', 'A', 'E', 1).valid, true);
  const f2 = checkSyllogismValidity('A', 'A', 'A', 2);
  assert.equal(f2.valid, false);
  assert.ok(f2.errors.some((e) => e.includes('中项')));
});

test('活字印刷经济临界、基尼系数、供需无谓损失、回归与卡方检验自洽', () => {
  const smallRun = solveMovableTypeEconomics(1, 5, 800, 0.65);
  assert.equal(smallRun.movableFaster, false);
  const bigRun = solveMovableTypeEconomics(8, 300, 800, 0.65);
  assert.equal(bigRun.movableFaster, true);

  const lorenz = solveLorenzGini(0.7, 0.3);
  assert.ok(lorenz.giniPost < lorenz.giniPre && lorenz.giniPre > 0 && lorenz.giniPre < 1);

  const mkt = solveMarketEquilibrium(0, 0, 1, 3.5, 7);
  assert.ok(mkt.shortage > 0 && mkt.dwl > 0);

  const reg = linearRegression([[1, 3], [2, 5], [3, 7]]);
  assert.ok(Math.abs(reg.k - 2) < 1e-9 && Math.abs(reg.b - 1) < 1e-9 && reg.r2 > 0.9999);
  assert.ok(chiSquare([50, 50], [50, 50]).chi2 === 0);
});
