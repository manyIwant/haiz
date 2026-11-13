// HAIZ 实验册 · 第三代 · 知识的笔法
// 书上每一笔都要说清楚“我们是怎么知道的”。同一张纸上可能同时出现：
//   理论公式算出来的、数值模型算出来的、带随机误差的模拟测量、真人亲手的测量、只是示意的图。
// 这里把这几种来源定成固定的笔法（颜色 + 线型 + 记号），所有第三代页面共用：
// 读者不用看图例，也能从笔迹分出“公式说的”“模型算的”“量出来的”。
export const KIND = {
  theory: { key: 'theory', label: '理论公式', mark: '铜色虚线', color: '#b4653a', dash: [0.16, 0.11], note: '由公式直接算出；只在公式的前提条件下成立。' },
  model: { key: 'model', label: '数值模型', mark: '墨色实线', color: '#1e2b36', dash: null, note: '把更完整的运动方程一步一步数值积分得到，仍是模型，不是观测。' },
  simulated: { key: 'simulated', label: '模拟测量', mark: '空心圆 + 误差棒', color: '#51606b', note: '模型的结果叠加了按统计规律生成的随机误差，用来演示测量误差，不是真实数据。' },
  human: { key: 'human', label: '你的计时', mark: '实心圆', color: '#1f4a3e', note: '由你亲手按表得到：反应时间是真实的，被计时的摆仍是模型。' },
  measured: { key: 'measured', label: '真实观测', mark: '实心方块', color: '#1e2b36', note: '来自可追溯的真实测量（须注明来源与许可）。' },
  sketch: { key: 'sketch', label: '示意', mark: '铅笔淡线', color: '#8a8f94', note: '只表达关系或结构，数值不具精确意义。' },
};

/** 页面上的一枚“笔法”小标签（印在纸上） */
export function kindTag(k, text) {
  const K = KIND[k];
  return `<span class="kt kt-${K.key}" title="${K.note}"><i></i>${text ?? K.label}</span>`;
}

// ---------------------------------------------------------------- 数学
/** 第一类完全椭圆积分 K(k)，用算术-几何平均：K = π / (2·AGM(1, √(1−k²))) */
export function ellipK(k) {
  let a = 1, b = Math.sqrt(Math.max(0, 1 - k * k));
  for (let i = 0; i < 30 && Math.abs(a - b) > 1e-15; i++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)];
  return Math.PI / (2 * a);
}
/** 单摆（无阻尼）的精确周期与小角公式之比：T/T₀ = 2K(sin(θ₀/2))/π */
export const periodFactor = (th0) => (2 * ellipK(Math.sin(Math.abs(th0) / 2))) / Math.PI;
/** 周期修正的级数前两项：1 + θ₀²/16 + 11θ₀⁴/3072 */
export const periodSeries = (th0) => 1 + th0 * th0 / 16 + 11 * th0 ** 4 / 3072;
export const DEG = Math.PI / 180;

/** 可复现的伪随机数与正态分布 */
export const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
export const gauss = (r) => Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r());
