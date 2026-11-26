// HAIZ · EXPERIMENTARIUM — 知识的笔法与科学统计工具
export const KIND = {
  theory: { key: 'theory', label: '理论公式', mark: '铜色虚线', color: '#b4653a', dash: [0.16, 0.11], note: '由理想化解析公式算出，仅在标注的前提条件下成立。' },
  model: { key: 'model', label: '数值模型', mark: '墨色实线', color: '#1e2b36', dash: null, note: '由完整动力学/平衡方程数值计算得到，仍是模型而非实测。' },
  simulated: { key: 'simulated', label: '模拟测量', mark: '空心圆+误差棒', color: '#51606b', note: '模型结果叠加统计误差模型，用于演示随机与系统误差。' },
  human: { key: 'human', label: '你的操作', mark: '绿实心圆', color: '#1f4a3e', note: '由你在页面或工作台亲手操作/读数/计数产生。' },
  measured: { key: 'measured', label: '史料/参考值', mark: '朱砂引框', color: '#8a6a3c', note: '来自可追溯古籍原文或公开权威统计/物理参考区间。' },
  sketch: { key: 'sketch', label: '教学示意', mark: '铅笔淡线', color: '#8a8f94', note: '表达定性机制或教学比例示意，不作精确工程数据。' },
};

export function kindTag(k, text) {
  const K = KIND[k] || KIND.model;
  return `<span class="kt kt-${K.key}" title="${K.note}"><i></i>${text ?? K.label}</span>`;
}

export function renderEpistemicBar(kinds = []) {
  const uniq = [...new Set(kinds.length ? kinds : ['theory', 'model'])];
  return uniq.map((k) => kindTag(k)).join('');
}

export function ellipK(k) {
  let a = 1, b = Math.sqrt(Math.max(0, 1 - k * k));
  for (let i = 0; i < 30 && Math.abs(a - b) > 1e-15; i++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)];
  return Math.PI / (2 * a);
}

export const periodFactor = (th0) => (2 * ellipK(Math.sin(Math.abs(th0) / 2))) / Math.PI;
export const periodSeries = (th0) => 1 + th0 * th0 / 16 + 11 * th0 ** 4 / 3072;
export const DEG = Math.PI / 180;

export const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
export const gauss = (r) => Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r());

/** 最小二乘一元线性回归 y = kx + b */
export function linearRegression(pts) {
  const v = pts.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const n = v.length;
  if (n < 2) return null;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of v) { sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; }
  const den = n * sxx - sx * sx;
  if (Math.abs(den) < 1e-12) return null;
  const k = (n * sxy - sx * sy) / den;
  const b = (sy - k * sx) / n;
  const my = sy / n;
  let ssTot = 0, ssRes = 0;
  for (const [x, y] of v) { ssTot += (y - my) ** 2; ssRes += (y - (k * x + b)) ** 2; }
  const r2 = ssTot > 1e-12 ? Math.max(0, 1 - ssRes / ssTot) : 1;
  return { n, k, b, r2, rss: ssRes };
}

/** 样本统计：均值、样本标准差、标准误 */
export function sampleStats(xs) {
  const v = xs.filter((x) => Number.isFinite(x)), n = v.length;
  if (!n) return { n: 0, mean: NaN, sd: NaN, se: NaN };
  const mean = v.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : NaN;
  return { n, mean, sd, se: n > 1 ? sd / Math.sqrt(n) : NaN };
}

/** Pearson 卡方拟合优度检验 */
export function chiSquare(observed, expected) {
  let x2 = 0;
  for (let i = 0; i < observed.length; i++) {
    if (expected[i] > 0) x2 += ((observed[i] - expected[i]) ** 2) / expected[i];
  }
  return { chi2: x2, df: Math.max(1, observed.length - 1) };
}
