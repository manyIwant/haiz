// HAIZ 实验册 · 第三代 · 时间把手
// 抓住运动物体（或它的轨迹）拖动，时间就跟着走到那一刻：
// 给出 pos(t) 和时间范围，把指针在运动平面上的位置换成“离它最近的那个时刻”。
// 先粗采样找到最近的一段，再用三分法细化；轨迹自交时取离上一刻最近的解，拖动不会跳。
export function nearestT(pos, t0, t1, q, o = {}) {
  const n = o.n ?? 80, prev = o.prev;
  const d2 = (t) => { const p = pos(t); return (p[0] - q.x) ** 2 + (p[1] - q.y) ** 2 + ((p[2] ?? 0) - (q.z ?? 0)) ** 2; };
  let best = t0, bd = Infinity;
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    // 与上一刻相近的解稍占便宜：轨迹折回或自交时不乱跳
    const d = d2(t) + (prev === undefined ? 0 : 0.02 * (t - prev) ** 2);
    if (d < bd) { bd = d; best = t; }
  }
  let a = Math.max(t0, best - (t1 - t0) / n), b = Math.min(t1, best + (t1 - t0) / n);
  for (let i = 0; i < 30; i++) { const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3; if (d2(m1) < d2(m2)) b = m2; else a = m1; }
  return (a + b) / 2;
}
