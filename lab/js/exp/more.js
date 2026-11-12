// 信息技术 · 通用技术
import { C, TAU, clamp, lerp, group, at, rot, box, cyl, ball, rod, wire, tube, strip, dash, glow, note, card, plot, flat, glass, liquid, THREE } from '../ink.js';

// ---------------------------------------------------------------- 排序算法
const ALG = ['冒泡排序', '选择排序', '插入排序', '快速排序'];
function ops(kind, a) {
  const out = [], n = a.length, cmp = (i, j) => { out.push(['c', i, j]); return a[i] > a[j]; }, swap = (i, j) => { if (i !== j) { [a[i], a[j]] = [a[j], a[i]]; out.push(['s', i, j]); } };
  if (kind === 0) for (let i = 0; i < n - 1; i++) { for (let j = 0; j < n - 1 - i; j++) if (cmp(j, j + 1)) swap(j, j + 1); out.push(['f', n - 1 - i]); }
  else if (kind === 1) for (let i = 0; i < n - 1; i++) { let m = i; for (let j = i + 1; j < n; j++) if (cmp(m, j)) m = j; swap(i, m); out.push(['f', i]); }
  else if (kind === 2) for (let i = 1; i < n; i++) for (let j = i; j > 0 && cmp(j - 1, j); j--) swap(j - 1, j);
  else { const qs = (lo, hi) => { if (lo >= hi) { if (lo === hi) out.push(['f', lo]); return; } let s = lo; for (let j = lo; j < hi; j++) if (cmp(hi, j)) swap(s++, j); swap(s, hi); out.push(['f', s]); qs(lo, s - 1); qs(s + 1, hi); }; qs(0, n - 1); }
  return out;
}
const sorting = {
  id: 'it-sort', subject: 'it', title: '排序算法', en: 'Sorting algorithms',
  lede: ['十根高矮不一的木条，要按从矮到高排好。计算机一次只能比较两根，再决定换不换位置。', '同样的任务，不同的“比较和交换的策略”就是不同的算法。数一数它们各用了多少步，就知道谁更聪明。'],
  formula: '冒泡排序：比较 n(n−1)/2 次', formulaNote: '时间复杂度 O(n²)；快速排序平均为 O(n log n)',
  terms: [['算法', '解决问题的明确、有限的步骤。'], ['时间复杂度', '运算次数随数据规模增长的趋势。'], ['比较与交换', '排序算法的两种基本操作。']],
  predict: { q: '用冒泡排序给 10 个数排序，一共要比较多少次？', options: ['10 次', '45 次', '100 次'], answer: 1, why: '第一趟比较 9 次，把最大的“冒”到最后；第二趟 8 次……一共 9 + 8 + … + 1 = 45 次，也就是 n(n−1)/2。' },
  challenge: '同一组数据，四种算法分别比较了多少次？谁最少？',
  fig: '十根木条：橙色表示正在比较，绿色表示已经就位', hint: '选一种算法，看它怎么搬木条。',
  teach: {
    where: '高中信息技术 必修 1《数据与计算》· 算法与程序实现；选择性必修 1《数据与数据结构》· 排序。',
    ask: ['如果数据本来就是有序的，哪种算法做的无用功最多？哪种几乎不用动？', '数据从 10 个变成 1000 个，冒泡排序的比较次数大约变成多少倍？'],
    simplify: '快速排序取每段最右端元素作基准（Lomuto 划分）；冒泡排序没有做“提前结束”的优化。',
  },
  controls: [
    { id: 'alg', type: 'choice', label: '', options: ALG, value: 0, wide: true },
    { id: 'sp', label: '速度', min: 1, max: 10, step: 1, value: 4 },
    { id: 'run', type: 'toggle', label: '自动', value: true },
    { id: 'step', type: 'button', label: '单步' }, { id: 'mix', type: 'button', label: '打乱重来' },
  ],
  build(k) {
    const p = k.p, N = 10, DX = 0.84, Z = -0.8, X0 = -(N - 1) / 2 * DX;
    k.root.add(at(box(9.2, 0.14, 2.2), 0, 0, Z));
    let vals, bars = [], order, list, pc, nc, ns, t, hot = [], fixed = new Set();
    const make = () => {
      bars.forEach((b) => { k.root.remove(b); b.traverse((o) => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } }); });
      vals = Array.from({ length: N }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
      bars = vals.map((v, i) => { const g = at(group(box(0.56, v * 0.4 + 0.3, 0.9, C.wood), at(note(String(v), { size: 0.36, bold: true }), 0, v * 0.4 + 0.7, 0)), X0 + i * DX, 0.14, Z); g.userData.tx = g.position.x; k.root.add(g); return g; });
      plan();
    };
    const plan = () => { order = bars.map((_, i) => i); list = ops(p.alg, vals.slice()); pc = 0; nc = 0; ns = 0; t = 0; hot = []; fixed = new Set(); bars.forEach((b, i) => { b.userData.tx = X0 + i * DX; }); };
    const stepOnce = () => {
      if (pc >= list.length) return;
      const [op, i, j] = list[pc++];
      if (op === 'c') { nc++; hot = [order[i], order[j]]; }
      else if (op === 's') { ns++; hot = [order[i], order[j]]; [order[i], order[j]] = [order[j], order[i]]; bars[order[i]].userData.tx = X0 + i * DX; bars[order[j]].userData.tx = X0 + j * DX; }
      else { fixed.add(order[i]); stepOnce(); }
      if (pc >= list.length) { hot = []; order.forEach((b) => fixed.add(b)); }
    };
    make();
    const info = at(card('\n', { w: 3.8, size: 0.32, align: 'left' }), 2.5, 0, 2.6);
    k.root.add(info);
    return {
      press(id) { if (id === 'mix') make(); else stepOnce(); },
      change(id) { if (id === 'alg') { vals = order.map((b) => vals[b]); const nb = order.map((b) => bars[b]); bars = nb; plan(); } },
      update(dt) {
        if (p.run && pc < list.length) { t += dt * p.sp * 1.6; while (t > 1) { t -= 1; stepOnce(); } }
        bars.forEach((b, i) => {
          b.position.x = lerp(b.position.x, b.userData.tx, 1 - Math.exp(-dt * 14));
          b.position.z = lerp(b.position.z, hot.includes(i) ? Z + 0.5 : Z, 1 - Math.exp(-dt * 14));
          b.children[0].material.color.set(hot.includes(i) ? C.amber : fixed.has(i) ? '#bfe6c8' : C.wood);
        });
        info.set(`比较 ${nc} 次　交换 ${ns} 次\n${pc >= list.length ? '排好了！' : ALG[p.alg]}`);
      },
      margin: () => [ALG[p.alg], `比较 ${nc} 次`, `交换 ${ns} 次`, 'n = 10', p.alg === 3 ? '平均 O(n log n)' : 'O(n²)', p.alg === 0 ? '固定比较 45 次' : p.alg === 1 ? '比较 45 次，交换 ≤ 9 次' : p.alg === 2 ? '越接近有序越快' : '基准选得好才快'],
    };
  },
};

// ---------------------------------------------------------------- 二进制
const binary = {
  id: 'it-binary', subject: 'it', title: '二进制与数据编码', en: 'Binary numbers',
  lede: ['计算机里只有两种状态：开和关，记作 1 和 0。八盏灯排成一排，每盏灯有自己的“分量”：1、2、4、8……一直到 128。', '把亮着的灯的分量加起来，就是这排灯表示的数。文字、图片、声音，最后都是这样一排一排的灯。'],
  formula: '(1011)₂ = 8 + 0 + 2 + 1 = 11', formulaNote: '从右往左第 k 位（k 从 0 数起）的权是 2ᵏ',
  terms: [['位（bit）', '一个二进制数字，0 或 1。'], ['字节（Byte）', '8 个二进制位。'], ['权', '每一位代表的大小，2 的若干次方。']],
  predict: { q: '8 个二进制位，一共能表示多少个不同的数？', options: ['16 个', '255 个', '256 个'], answer: 2, why: '每一位有 2 种状态，8 位共有 2⁸ = 256 种组合，表示 0 到 255。最大的数是 255，但别忘了 0 也算一个。' },
  challenge: '点灯拼出你名字首字母的 ASCII 码（大写 A 是 65）。',
  fig: '八盏灯表示的一个字节', hint: '直接点灯泡，或拖动滑杆。',
  teach: {
    where: '高中信息技术 必修 1《数据与计算》· 数据与信息：数制与编码。',
    ask: ['“左移一位”后数值变成了原来的几倍？为什么？如果最高位本来是 1 会怎样？', '255 再加 1 变成了多少？这种现象叫什么？'],
    simplify: '只表示 8 位无符号整数；加 1 和左移超出 8 位的部分直接丢弃（溢出）。ASCII 只显示可打印字符。',
  },
  controls: [
    { id: 'v', label: '十进制数值', min: 0, max: 255, step: 1, value: 72 },
    { id: 'inc', type: 'button', label: '加 1' }, { id: 'shl', type: 'button', label: '左移 ×2' }, { id: 'shr', type: 'button', label: '右移 ÷2' }, { id: 'not', type: 'button', label: '取反' },
  ],
  build(k) {
    const p = k.p, Z = -0.9, DX = 1.08, X0 = -3.5 * DX;
    k.root.add(at(box(9.3, 0.3, 1.8), 0, 0, Z));
    const lamps = Array.from({ length: 8 }, (_, i) => {
      const x = X0 + i * DX, bit = 7 - i;
      const bulb = at(ball(0.36), x, 1.25, Z), halo = at(glow(C.amber, 2.3, 0), x, 1.25, Z), digit = at(note('0', { size: 0.5, bold: true, w: 0.7 }), x, 2.25, Z);
      k.root.add(at(cyl(0.2, 0.6, C.shade), x, 0.3, Z), bulb, halo, digit, at(note(String(1 << bit), { size: 0.3, lay: 'flat' }), x, 0.03, Z + 1.5));
      k.drag(bulb, { start: () => k.set('v', p.v ^ (1 << bit)) });
      return { bulb, halo, digit, bit };
    });
    k.root.add(at(note('每一位的权', { size: 0.28, lay: 'flat', color: C.copper }), 0, 0.03, Z + 2.1));
    const info = at(card('\n\n', { w: 4.6, size: 0.33, align: 'left' }), 0, 0, 3.1);
    k.root.add(info);
    return {
      press(id) { k.set('v', (id === 'inc' ? p.v + 1 : id === 'shl' ? p.v << 1 : id === 'shr' ? p.v >> 1 : ~p.v) & 255); },
      update(dt) {
        const v = p.v & 255;
        lamps.forEach((l) => { const on = (v >> l.bit) & 1; l.bulb.material.color.set(on ? '#ffd76a' : C.paper); l.halo.material.opacity = lerp(l.halo.material.opacity, on ? 0.75 : 0, 1 - Math.exp(-dt * 12)); l.digit.set(String(on)); });
        info.set(`二进制 ${v.toString(2).padStart(8, '0').replace(/(.{4})/, '$1 ')}\n十进制 ${v}　十六进制 ${v.toString(16).toUpperCase().padStart(2, '0')}\nASCII 字符 ${v >= 33 && v <= 126 ? `“${String.fromCharCode(v)}”` : v === 32 ? '空格' : '（不可打印）'}`);
      },
      margin() {
        const v = p.v & 255, parts = []; for (let b = 7; b >= 0; b--) if ((v >> b) & 1) parts.push(1 << b);
        const lines = []; let cur = '';
        parts.forEach((q, i) => { const s = (i ? '+' : '') + q; if ((cur + s).length > 12) { lines.push(cur); cur = s; } else cur += s; });
        if (cur) lines.push(cur);
        return [`${v} =`, ...(lines.length ? lines : ['0']), `亮了 ${parts.length} 盏灯`, '8 位最大 255'];
      },
    };
  },
};

// ---------------------------------------------------------------- 梁的弯曲
const MATS = [['木材', 10e9, C.wood], ['铝', 70e9, '#dfe5ea'], ['钢', 200e9, '#b9c2c9']];
const beam = {
  id: 'tech-beam', subject: 'tech', title: '梁的弯曲与截面', en: 'Bending a beam',
  lede: ['一根木条搭在两个支座上，中间挂上重物。它会往下弯，弯多少取决于跨度、材料和截面的放法。', '同一根木条，平放一压就弯，立放却硬得多。材料一点没多，只是换了个方向。'],
  formula: 'δ = F L³ / (48 E I)', formulaNote: '中点挠度。E：弹性模量；I = bh³/12：截面惯性矩，h 是受力方向上的高度',
  terms: [['挠度 δ', '梁受力后中点下沉的距离。'], ['截面惯性矩 I', '截面抵抗弯曲的能力。'], ['跨度 L', '两个支座之间的距离。']],
  predict: { q: '截面 30 mm × 6 mm 的木条，立着放的抗弯能力是平着放的多少倍？', options: ['差不多', '约 5 倍', '约 25 倍'], answer: 2, why: '惯性矩 I 与受力方向的高度 h 的三次方成正比。立放时 h 变为 5 倍、b 变为 1/5，I 增大 5³ ÷ 5 = 25 倍。所以房梁、工字钢都是“立”着用的。' },
  challenge: '不换材料、不改跨度，把 20 N 下的挠度控制在 5 mm 以内。',
  fig: '简支梁：两个支座、木条与中点的重物', hint: '改截面的放法，再改跨度和载荷。',
  teach: {
    where: '高中通用技术 必修《技术与设计 2》· 结构及其设计：结构的强度与稳定性。',
    ask: ['跨度加倍，挠度变成原来的几倍？这对桥梁设计意味着什么？', '工字钢为什么把材料集中在上下两端，中间只留一道薄薄的腹板？'],
    simplify: '按材料力学的小变形公式计算（简支梁、中点集中力），挠度很大时公式不再准确；画面中截面尺寸被放大，弯曲量按真实比例显示。',
  },
  controls: [
    { id: 'L', label: '跨度 L', min: 0.4, max: 1, step: 0.05, value: 0.8, unit: 'm' },
    { id: 'F', label: '载荷 F', min: 0, max: 30, step: 1, value: 15, unit: 'N' },
    { id: 'sec', type: 'choice', label: '截面', options: ['平放', '立放'], value: 0 },
    { id: 'mat', type: 'choice', label: '材料', options: MATS.map((m) => m[0]), value: 0 },
  ],
  build(k) {
    const p = k.p, S = 6.6, Z = -0.8, TOP = 3.2;
    const sup = [0, 1].map(() => group(box(0.7, TOP - 0.25, 1.5), rot(at(cyl(0.2, 1.5, C.shade), 0, TOP - 0.2, -0.75), Math.PI / 2, 0, 0)));
    const wt = cyl(0.42, 0.6, '#b9c2c9'), hang = wire([0, 0, 0], [0, 1, 0], 0.02);
    const ref = dash([-3.6, TOP, Z + 0.9], [3.6, TOP, Z + 0.9], { len: 0.14, gap: 0.12 });
    const info = at(card('\n', { w: 3.9, size: 0.32, align: 'left' }), 2.4, 0, 2.7);
    k.root.add(...sup, wt, hang, ref, info);
    let bm = null, base = null, last = '', dv = 0, d = 0, st = {};
    const calc = () => { const b = p.sec ? 0.006 : 0.03, h = p.sec ? 0.03 : 0.006, I = b * h ** 3 / 12; return { I, d: p.F * p.L ** 3 / (48 * MATS[p.mat][1] * I) }; };
    return {
      update(dt) {
        const key = `${p.L}|${p.sec}|${p.mat}`;
        if (key !== last) {
          last = key;
          if (bm) { k.root.remove(bm); bm.geometry.dispose(); bm.material.dispose(); }
          const th = p.sec ? 1.0 : 0.2, wd = p.sec ? 0.2 : 1.0;
          bm = box(p.L * S + 1.0, th, wd, MATS[p.mat][2]);
          bm.geometry.dispose(); bm.geometry = new THREE.BoxGeometry(p.L * S + 1.0, th, wd, 48, 1, 1).translate(0, th / 2, 0);
          base = bm.geometry.attributes.position.array.slice();
          bm.position.set(0, TOP, Z); k.root.add(bm);
          sup.forEach((s, i) => s.position.set((i ? 1 : -1) * p.L * S / 2, 0, Z));
          st.th = th;
        }
        const c = calc(), target = Math.min(c.d, 0.25);
        dv += ((target - d) * 90 - dv * 9) * dt; d += dv * dt;
        const pos = bm.geometry.attributes.position, half = p.L * S / 2, dw = d * S;
        for (let i = 0; i < pos.count; i++) {
          const x = base[i * 3], ax = Math.abs(x), xi = (half - ax) / (2 * half);
          const y = ax <= half ? -dw * (3 * xi - 4 * xi ** 3) : dw * 3 / (2 * half) * (ax - half);
          pos.setY(i, base[i * 3 + 1] + y);
        }
        pos.needsUpdate = true; bm.geometry.computeVertexNormals();
        hang.span([0, TOP - dw, Z], [0, TOP - dw - 0.7, Z]); wt.position.set(0, TOP - dw - 1.3, Z);
        wt.scale.setScalar(0.5 + p.F / 40); wt.visible = hang.visible = p.F > 0;
        Object.assign(st, c);
        info.set(`中点挠度 δ = ${c.d * 1000 < 10 ? (c.d * 1000).toFixed(2) : (c.d * 1000).toFixed(0)} mm\n${c.d > 0.25 ? '弯得太厉害，要断了' : c.d * 1000 < 1 ? '几乎看不出弯曲' : MATS[p.mat][0] + (p.sec ? '，立放' : '，平放')}`);
      },
      margin() {
        const b = p.sec ? 6 : 30, h = p.sec ? 30 : 6;
        return [`b = ${b} mm，h = ${h} mm`, 'I = bh³/12', ` = ${(st.I * 1e12 || 0).toFixed(0)} mm⁴`, `E = ${MATS[p.mat][1] / 1e9} GPa`, 'δ = FL³/(48EI)', ` = ${((st.d || 0) * 1000).toFixed(2)} mm`];
      },
    };
  },
};

// ---------------------------------------------------------------- 闭环控制
const control = {
  id: 'tech-control', subject: 'tech', title: '开环与闭环控制', en: 'Open-loop and closed-loop control',
  lede: ['水箱下面有人在用水，上面的进水阀要补水。如果阀门只按固定的大小开着，用水一变，水位就跟着跑。', '加一只浮球：水位低了，浮球下沉把阀门开大；水位高了，把阀门关小。系统自己“看着”结果来调整，这就是反馈。'],
  formula: '给定 → 控制器 → 执行器 → 对象 → 输出', formulaNote: '闭环控制系统多了一条从输出量回到输入端的反馈通路',
  terms: [['被控量', '希望保持稳定的量，这里是水位。'], ['干扰因素', '除给定量外引起被控量变化的因素。'], ['反馈', '把输出量检测出来送回输入端比较。']],
  predict: { q: '用水量突然变大，哪种系统能把水位稳住？', options: ['开环系统', '闭环系统', '都能'], answer: 1, why: '开环系统不检测水位，进水量固定，用水变多水位就一直往下掉。闭环系统通过浮球感知水位下降，自动开大阀门，抵消了干扰的影响。' },
  challenge: '闭环时把用水量拉到最大：水位真的回到设定值了吗？差多少？',
  fig: '水箱、进水阀、浮球杠杆与用水龙头', hint: '先看开环，拖用水量；再切到闭环。',
  teach: {
    where: '高中通用技术 必修《技术与设计 2》· 控制及其设计：开环与闭环控制系统、干扰与反馈。',
    ask: ['指出这个系统的给定量、被控量、控制器、执行器、被控对象和检测装置。', '闭环时水位和设定值之间仍有一点差距（静差），怎样的控制器可以消除它？'],
    simplify: '出水量与用水量和水位的平方根成正比，闭环采用纯比例控制（进水量 ∝ 设定水位 − 实际水位），所以会保留一点静差；时间和流量为相对值。',
  },
  controls: [
    { id: 'u', label: '用水量（干扰）', min: 0, max: 100, step: 1, value: 50, unit: '%' },
    { id: 'set', label: '设定水位', min: 20, max: 80, step: 1, value: 60, unit: '%' },
    { id: 'mode', type: 'choice', label: '控制方式', options: ['开环', '闭环'], value: 0 },
    { id: 'reset', type: 'button', label: '重置' },
  ],
  build(k) {
    const p = k.p, X = -2.2, Z = -0.8, R = 1.4, H = 3.6, BASE = 1.2;
    k.root.add(at(box(2.6, BASE, 2.2), X, 0, Z));
    const tank = at(group(glass(new THREE.CylinderGeometry(R, R, H, 44, 1, true).translate(0, H / 2, 0)), glass(new THREE.CircleGeometry(R, 44).rotateX(-Math.PI / 2).translate(0, 0.03, 0))), X, BASE, Z);
    const water = at(liquid(R * 0.95, 1, C.sky, 0.5), X, BASE + 0.04, Z);
    const inPipe = tube([[X - 2.4, 0, Z], [X - 2.4, BASE + H + 0.9, Z], [X - 0.5, BASE + H + 0.9, Z], [X - 0.5, BASE + H + 0.45, Z]], 0.13);
    const valve = at(box(0.5, 0.36, 0.5, C.copper), X - 1.4, BASE + H + 0.72, Z);
    const inS = flat(new THREE.CylinderGeometry(1, 1, 1, 12).translate(0, -0.5, 0), C.sky, { opacity: 0.7 });
    const tap = tube([[X + R - 0.05, BASE + 0.3, Z], [X + R + 0.7, BASE + 0.3, Z], [X + R + 0.7, BASE + 0.05, Z]], 0.11);
    const outS = flat(new THREE.CylinderGeometry(1, 1, 1, 12).translate(0, -0.5, 0), C.sky, { opacity: 0.7 });
    const tray = at(group(glass(new THREE.CylinderGeometry(0.7, 0.6, 0.4, 28, 1, true).translate(0, 0.2, 0)), at(liquid(0.58, 0.2, C.sky, 0.5), 0, 0.03, 0)), X + R + 0.7, 0.02, Z);
    const fl = ball(0.3, '#ffd9a8'), arm = rod([0, 0, 0], [1, 0, 0], 0.035, C.ink), mark = flat(new THREE.TorusGeometry(R + 0.03, 0.03, 8, 48).rotateX(Math.PI / 2), C.flame);
    const g = at(plot({ w: 4.2, h: 3.1, xr: [0, 30], yr: [0, 100], xl: '时间', yl: '水位 %' }), 2.3, 0, -2.5);
    const info = at(card('\n', { w: 3.8, size: 0.32, align: 'left' }), 2.4, 0, 2.7);
    k.root.add(tank, water, inPipe, valve, inS, tap, outS, tray, fl, arm, at(mark, X, 0, Z), g, info);
    let h = 0.6, tl = 0, acc = 0, qin = 0; const hist = [];
    return {
      press() { h = p.set / 100; hist.length = 0; tl = 0; },
      update(dt) {
        const qout = (p.u / 100) * 0.9 * Math.sqrt(Math.max(h, 0)), hs = p.set / 100;
        qin = p.mode ? clamp(9 * (hs - h), 0, 1.3) : 0.45 * Math.sqrt(hs);
        h = clamp(h + (qin - qout) * dt * 0.35, 0, 1);
        const lvl = BASE + 0.04 + h * (H - 0.3);
        water.set(Math.max(0.01, h * (H - 0.3)));
        inS.position.set(X - 0.5, BASE + H + 0.45, Z); inS.scale.set(0.03 + qin * 0.09, BASE + H + 0.45 - lvl, 0.03 + qin * 0.09); inS.visible = qin > 0.01;
        outS.position.set(X + R + 0.7, BASE + 0.05, Z); outS.scale.set(0.02 + qout * 0.1, BASE - 0.1, 0.02 + qout * 0.1); outS.visible = qout > 0.01;
        fl.visible = arm.visible = !!p.mode;
        fl.position.set(X + 0.4, lvl + 0.12, Z); arm.span([X + 0.4, lvl + 0.3, Z], [X - 1.4, BASE + H + 0.6, Z]);
        valve.scale.y = 0.6 + qin * 0.7;
        mark.position.y = BASE + 0.04 + hs * (H - 0.3);
        tl += dt; acc += dt;
        if (acc > 0.15) { acc = 0; hist.push([tl, h * 100]); while (hist.length && hist[0][0] < tl - 30) hist.shift(); g.clear().curve([[0, p.set], [30, p.set]], C.flame, 0.03, true).curve(hist.map(([t, v]) => [t - Math.max(0, tl - 30), v]), C.blue, 0.045).done(); }
        info.set(`水位 ${(h * 100).toFixed(0)}%　设定 ${p.set}%\n进水 ${(qin * 100).toFixed(0)}　出水 ${(qout * 100).toFixed(0)}`);
        this.s = { h, qin, qout };
      },
      margin() {
        const s = this.s || { h: 0.6 };
        return p.mode ? ['闭环控制', '检测：浮球', '控制器：杠杆', '执行器：进水阀', `偏差 ${(p.set - s.h * 100).toFixed(1)}%`, '偏差越大，阀开越大'] : ['开环控制', '阀门开度固定', '不检测水位', `偏差 ${(p.set - s.h * 100).toFixed(1)}%`, '干扰一来就跑偏'];
      },
    };
  },
};

export default [sorting, binary, beam, control];
