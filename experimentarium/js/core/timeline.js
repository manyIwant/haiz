// HAIZ 实验册 · 第三代 · 时间线
// 一段可以倒回去、也可以往前推的历史。模拟按固定步长前进，每隔 dt 记一帧状态；
// 读者抓住时间的任何时刻，都能精确取回那一刻的全部状态（线性插值），而不是重新播放动画。
//   const tl = new Timeline(['th', 'om', 'l'], { dt: 1 / 120, span: 40 });
//   tl.push(k, { th, om, l })          // k：第几帧（整数，时间 = k·dt）
//   tl.at(t, out)                      // 取回时刻 t 的状态
//   tl.truncate(t)                     // 从 t 之后改写历史（例如在过去松手、换了条件）
export class Timeline {
  constructor(fields, o = {}) {
    this.fields = fields; this.dt = o.dt ?? 1 / 120;
    this.cap = Math.ceil((o.span ?? 40) / this.dt);
    this.buf = Object.fromEntries(fields.map((f) => [f, new Float64Array(this.cap)]));
    this.k0 = 0; this.k1 = -1;      // 存着的帧号范围 [k0, k1]
  }
  get t0() { return this.k0 * this.dt; }
  get t1() { return this.k1 * this.dt; }
  get empty() { return this.k1 < this.k0; }
  clear(k = 0) { this.k0 = k; this.k1 = k - 1; }
  push(k, s) {
    if (this.empty) { this.k0 = k; this.k1 = k - 1; }
    if (k !== this.k1 + 1) { this.clear(k); }
    const i = ((k % this.cap) + this.cap) % this.cap;
    for (const f of this.fields) this.buf[f][i] = s[f];
    this.k1 = k;
    if (this.k1 - this.k0 + 1 > this.cap) this.k0 = this.k1 - this.cap + 1;
  }
  /** 第 k 帧的某个量（k 必须在范围内） */
  get(f, k) { return this.buf[f][((k % this.cap) + this.cap) % this.cap]; }
  /** 时刻 t 的状态（超出范围取端点） */
  at(t, out = {}) {
    if (this.empty) return null;
    const u = Math.min(this.k1, Math.max(this.k0, t / this.dt));
    const a = Math.floor(u), b = Math.min(this.k1, a + 1), w = u - a;
    for (const f of this.fields) out[f] = this.get(f, a) * (1 - w) + this.get(f, b) * w;
    out.t = u * this.dt;
    return out;
  }
  truncate(t) { const k = Math.floor(t / this.dt + 1e-9); if (k < this.k1) this.k1 = Math.max(this.k0 - 1, k); }
  /** 便于离开页面时整段保存、回来时原样恢复 */
  snapshot() { return { k0: this.k0, k1: this.k1, buf: Object.fromEntries(this.fields.map((f) => [f, this.buf[f].slice()])) }; }
  restore(s) { if (!s) return; this.k0 = s.k0; this.k1 = s.k1; for (const f of this.fields) if (s.buf[f]) this.buf[f].set(s.buf[f]); }
}
