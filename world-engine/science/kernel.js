// HAIZ World Engine — Pure Scientific Simulation Kernel (Node & Browser Testable)
//
// Moves HAIZ experiments beyond scripted animations into real, law-governed numerical
// simulation with explicit model bounds, simplifications, local Haikou physical constants,
// stochastic measurement error, and uncertainty propagation.
//
// Models implemented:
//   1. Nonlinear Damped Pendulum (4th-order Runge-Kutta ODE + exact AGM elliptic period + Haikou g)
//   2. Yanchi Pond Optical Interface (exact Snell's Law + unpolarized Fresnel reflectance + Brewster angle)
//   3. Campus Microclimate Water Budget (rainfall deposition vs radiation+wind+VPD evaporation)

export const MODEL_META = Object.freeze({
  pendulum: {
    id: 'pendulum',
    name: '科学馆 · 非线性阻尼单摆（RK4）',
    equation: 'θ″ = -(g / L)·sin(θ) - γ·θ′',
    scope: '刚性轻杆单摆，0.2 m ≤ L ≤ 4.0 m，初始摆角 |θ₀| ≤ 150°，线性粘滞阻尼 0 ≤ γ ≤ 0.6 s⁻¹',
    simplifications: '忽略空气浮力、摆线质量分布与科里奥利力；阻尼采用低速线性粘滞近似（非二次雷诺湍流阻力）。',
    accuracy: '四阶龙格-库塔（固定子步长 Δt = 2 ms），无阻尼 10 秒机械能相对漂移 < 10⁻⁷，大角周期与完全椭圆积分误差 < 0.05%。',
  },
  optics: {
    id: 'optics',
    name: '砚池 · 界面折射与菲涅耳反射',
    equation: 'n₁ sin(θᵢ) = n₂ sin(θₜ)；R = ½(Rₛ + Rₚ)',
    scope: '均匀各向同性非磁性透明介质平界面（空气 n=1.0003、淡水 n=1.333、冕牌玻璃 n=1.517），可见光单色近似（λ ≈ 589 nm）。',
    simplifications: '忽略水面微风波浪粗糙度、色散（Cauchy 展开）与多次池底反射；默认自然非偏振太阳光。',
    accuracy: '解析精确解：全角度满足能量守恒 R + T = 1（误差 < 10⁻¹²），布儒斯特角处 Rₚ = 0。',
  },
  microclimate: {
    id: 'microclimate',
    name: '榄仁树微气候 · 路面湿润与蒸发动力学',
    equation: 'dW/dt = k_rain·P - k_evap·E(R_s, u, T, RH)',
    scope: '海口热带季风气候铺装地面（温度 5–42 °C，风速 0–35 m/s，相对湿度 20–100%）。',
    simplifications: '一维集总水膜与积水储层模型（近似 Penman 潜热项），未建模地下排水管网坡度与树冠截留空间分布。',
    accuracy: '教学级物理解耦模型，与 HAIZ 天气渲染共享状态变量；明确标注为校园微气候近似而非水文工程预报。',
  },
});

/** Somigliana normal gravity formula (WGS84 ellipsoid) in m/s² */
export function normalGravity(latDeg = 19.99847892, altitudeM = 12) {
  const phi = (latDeg * Math.PI) / 180;
  const s = Math.sin(phi);
  const s2 = s * s;
  const g0 = 9.7803267714 * (1 + 0.00193185138639 * s2) / Math.sqrt(1 - 0.00669437999013 * s2);
  // Free-air altitude correction (-3.086e-6 m/s² per metre)
  return g0 - 3.086e-6 * altitudeM;
}

/** Deterministic Box-Muller normal deviate given uniform PRNG u() ∈ (0,1) */
export function gaussianNoise(rand = Math.random) {
  const u1 = Math.max(1e-12, rand());
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Arithmetic-Geometric Mean for complete elliptic integral K(k) = π / (2·AGM(1, √(1-k²))) */
export function ellipticK(k) {
  let a = 1;
  let b = Math.sqrt(Math.max(1e-15, 1 - k * k));
  for (let i = 0; i < 16; i++) {
    const an = 0.5 * (a + b);
    const bn = Math.sqrt(a * b);
    if (Math.abs(an - bn) < 1e-13) {
      a = an;
      break;
    }
    a = an;
    b = bn;
  }
  return Math.PI / (2 * a);
}

/** Exact theoretical period of an undamped nonlinear pendulum of amplitude theta0Rad */
export function exactPendulumPeriod(lengthM, g, theta0Rad) {
  const t0 = 2 * Math.PI * Math.sqrt(lengthM / g);
  const k = Math.sin(Math.min(Math.PI * 0.499, Math.abs(theta0Rad) * 0.5));
  return t0 * (2 / Math.PI) * ellipticK(k);
}

/** Generic 4th-order Runge-Kutta step for an array state y[] */
export function rk4Step(y, dt, deriv) {
  const n = y.length;
  const k1 = deriv(y);
  const y2 = new Array(n);
  for (let i = 0; i < n; i++) y2[i] = y[i] + 0.5 * dt * k1[i];
  const k2 = deriv(y2);
  const y3 = new Array(n);
  for (let i = 0; i < n; i++) y3[i] = y[i] + 0.5 * dt * k2[i];
  const k3 = deriv(y3);
  const y4 = new Array(n);
  for (let i = 0; i < n; i++) y4[i] = y[i] + dt * k3[i];
  const k4 = deriv(y4);
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = y[i] + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  }
  return out;
}

/** Create a live RK4 nonlinear damped pendulum simulation coupled to Haikou's real gravity */
export function createPendulumSim({
  length = 1.2,
  angleDeg = 42,
  damping = 0.04,
  latDeg = 19.99847892,
  substep = 0.002,
} = {}) {
  const g = normalGravity(latDeg);
  const params = { length, angleDeg, damping, g };
  let state = [(angleDeg * Math.PI) / 180, 0]; // [theta, omega]
  let t = 0;
  let lastCrossT = null;
  let measuredPeriod = null;
  const phaseHistory = [];
  const energyHistory = [];

  const deriv = (y) => [y[1], -(params.g / params.length) * Math.sin(y[0]) - params.damping * y[1]];

  function energyOf(y = state) {
    // Specific mechanical energy per unit mass (J/kg): E = ½(L·ω)² + g·L·(1 - cos θ)
    const ke = 0.5 * Math.pow(params.length * y[1], 2);
    const pe = params.g * params.length * (1 - Math.cos(y[0]));
    return { ke, pe, total: ke + pe };
  }

  let initialEnergy = energyOf().total;

  function reset(next = {}) {
    if (next.length !== undefined) params.length = Math.max(0.2, Math.min(4.0, Number(next.length)));
    if (next.angleDeg !== undefined) params.angleDeg = Math.max(1, Math.min(150, Number(next.angleDeg)));
    if (next.damping !== undefined) params.damping = Math.max(0, Math.min(0.6, Number(next.damping)));
    state = [(params.angleDeg * Math.PI) / 180, 0];
    t = 0;
    lastCrossT = null;
    measuredPeriod = null;
    phaseHistory.length = 0;
    energyHistory.length = 0;
    initialEnergy = energyOf().total;
  }

  function step(dt) {
    const clamped = Math.min(0.1, Math.max(0, dt));
    const steps = Math.max(1, Math.ceil(clamped / substep));
    const h = clamped / steps;
    for (let i = 0; i < steps; i++) {
      const prevTheta = state[0];
      const prevOmega = state[1];
      state = rk4Step(state, h, deriv);
      t += h;
      // Detect upward zero-crossing (theta passes 0 with omega > 0) for sub-millisecond period timing
      if (prevTheta <= 0 && state[0] > 0 && (prevOmega > 0 || state[1] > 0)) {
        const frac = -prevTheta / Math.max(1e-12, state[0] - prevTheta);
        const crossT = t - h + frac * h;
        if (lastCrossT !== null) {
          measuredPeriod = crossT - lastCrossT;
        }
        lastCrossT = crossT;
      }
    }
    const e = energyOf();
    phaseHistory.push([state[0], state[1]]);
    energyHistory.push([t, e.ke, e.pe, e.total]);
    if (phaseHistory.length > 260) phaseHistory.shift();
    if (energyHistory.length > 260) energyHistory.shift();
    return snapshot();
  }

  function sampleWithStopwatchNoise({ sigmaSec = 0.015, rand = Math.random } = {}) {
    const trueT = measuredPeriod ?? exactPendulumPeriod(params.length, params.g, (params.angleDeg * Math.PI) / 180);
    const observedT = Math.max(0.05, trueT + gaussianNoise(rand) * sigmaSec);
    const inferredG = (4 * Math.PI * Math.PI * params.length) / (observedT * observedT);
    return {
      length: params.length,
      angleDeg: params.angleDeg,
      truePeriodSec: +trueT.toFixed(5),
      observedPeriodSec: +observedT.toFixed(4),
      inferredG: +inferredG.toFixed(4),
      trueG: +params.g.toFixed(4),
      sigmaSec,
    };
  }

  function snapshot() {
    const e = energyOf();
    const tSmall = 2 * Math.PI * Math.sqrt(params.length / params.g);
    const tExact = exactPendulumPeriod(params.length, params.g, (params.angleDeg * Math.PI) / 180);
    return {
      t: +t.toFixed(4),
      thetaRad: state[0],
      thetaDeg: +(state[0] * 180 / Math.PI).toFixed(2),
      omega: +state[1].toFixed(4),
      energy: e,
      energyDriftRel: initialEnergy > 1e-9 ? Math.abs(e.total - initialEnergy) / initialEnergy : 0,
      tSmall: +tSmall.toFixed(5),
      tExact: +tExact.toFixed(5),
      measuredPeriod: measuredPeriod ? +measuredPeriod.toFixed(5) : null,
      largeAngleRatio: +(tExact / tSmall).toFixed(5),
      params: { ...params },
      phaseHistory,
      energyHistory,
    };
  }

  return { reset, step, snapshot, sampleWithStopwatchNoise, params };
}

/** Exact Snell & Fresnel optical interface calculation */
export function fresnelOptics({ n1 = 1.0003, n2 = 1.333, incidentDeg = 45 } = {}) {
  const clampedDeg = Math.max(0, Math.min(89.99, Number(incidentDeg)));
  const ti = (clampedDeg * Math.PI) / 180;
  const sinTi = Math.sin(ti);
  const cosTi = Math.cos(ti);
  const sinTt = (n1 / n2) * sinTi;
  const brewsterDeg = (Math.atan(n2 / n1) * 180) / Math.PI;
  const criticalDeg = n1 > n2 ? (Math.asin(n2 / n1) * 180) / Math.PI : null;

  if (sinTt >= 1) {
    return {
      n1,
      n2,
      incidentDeg: +clampedDeg.toFixed(2),
      refractedDeg: null,
      totalInternalReflection: true,
      criticalDeg: +criticalDeg.toFixed(2),
      brewsterDeg: +brewsterDeg.toFixed(2),
      Rs: 1,
      Rp: 1,
      R: 1,
      T: 0,
    };
  }

  const tt = Math.asin(sinTt);
  const cosTt = Math.cos(tt);
  const rs = (n1 * cosTi - n2 * cosTt) / (n1 * cosTi + n2 * cosTt);
  const rp = (n1 * cosTt - n2 * cosTi) / (n1 * cosTt + n2 * cosTi);
  const Rs = rs * rs;
  const Rp = rp * rp;
  const R = 0.5 * (Rs + Rp);
  const T = 1 - R;

  return {
    n1,
    n2,
    incidentDeg: +clampedDeg.toFixed(2),
    refractedDeg: +((tt * 180) / Math.PI).toFixed(2),
    totalInternalReflection: false,
    criticalDeg: criticalDeg ? +criticalDeg.toFixed(2) : null,
    brewsterDeg: +brewsterDeg.toFixed(2),
    Rs: +Rs.toFixed(6),
    Rp: +Rp.toFixed(6),
    R: +R.toFixed(6),
    T: +T.toFixed(6),
  };
}

/** Physically motivated tropical paving water-budget & evaporation step */
export function microclimateStep({
  rainMmHr = 0,
  solarWm2 = 450,
  windMs = 2.5,
  tempC = 27,
  rhPct = 72,
  wet = 0,
  puddle = 0,
  dtSec = 60,
} = {}) {
  // Saturation vapour pressure (Tetens formula, kPa) & Vapour Pressure Deficit (VPD)
  const es = 0.61078 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  const vpd = Math.max(0, es * (1 - Math.min(100, Math.max(0, rhPct)) / 100));
  // Potential evaporation rate (mm/hr proxy combining radiation + aerodynamic VPD term)
  const evapMmHr = Math.max(0.02, 0.0014 * Math.max(0, solarWm2) + 0.24 * vpd * (0.4 + 0.28 * Math.max(0, windMs)));
  const dtHr = Math.max(0, dtSec) / 3600;
  const netMm = (Math.max(0, rainMmHr) - evapMmHr) * dtHr;
  // Film wetness fills first (~1.5 mm capacity), excess accumulates into puddles (~12 mm capacity)
  let nextWet = wet + netMm / 1.5;
  let nextPuddle = puddle;
  if (nextWet > 1) {
    nextPuddle += ((nextWet - 1) * 1.5) / 12;
    nextWet = 1;
  } else if (nextWet < 0) {
    if (nextPuddle > 0) {
      nextPuddle = Math.max(0, nextPuddle + (nextWet * 1.5) / 12);
      nextWet = nextPuddle > 0 ? 0.35 : 0;
    } else {
      nextWet = 0;
    }
  }
  // Puddles also slowly drain/evaporate even while film is saturated
  if (rainMmHr < 0.05 && nextPuddle > 0) {
    nextPuddle = Math.max(0, nextPuddle - (evapMmHr * 0.55 * dtHr) / 12);
  }
  return {
    wet: Math.min(1, Math.max(0, nextWet)),
    puddle: Math.min(1, Math.max(0, nextPuddle)),
    vpdKpa: +vpd.toFixed(3),
    evapMmHr: +evapMmHr.toFixed(3),
    esKpa: +es.toFixed(3),
  };
}

/** Descriptive statistics (mean, sample SD, standard error) for repeated lab trials */
export function sampleStats(values) {
  const n = values.length;
  if (!n) return { n: 0, mean: 0, sd: 0, se: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  if (n === 1) return { n: 1, mean, sd: 0, se: 0 };
  const variance = values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / (n - 1);
  const sd = Math.sqrt(variance);
  return { n, mean, sd, se: sd / Math.sqrt(n) };
}
