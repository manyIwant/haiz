// 生物
import { C, TAU, clamp, lerp, group, at, rot, box, cyl, ball, plate, rod, tube, glow, jar, note, card, plot, dots, liquid, flat, glass, bubbler, flow, sheet, solid, THREE } from '../ink.js';

const beaker = (r, h) => group(glass(new THREE.CylinderGeometry(r, r, h, 44, 1, true).translate(0, h / 2, 0)), glass(new THREE.CircleGeometry(r, 44).rotateX(-Math.PI / 2).translate(0, 0.03, 0)));

// ---------------------------------------------------------------- 质壁分离
const plasmolysis = {
  id: 'bio-plasmolysis', subject: 'bio', title: '质壁分离与复原', en: 'Plasmolysis',
  lede: ['洋葱鳞片叶外表皮细胞里有一个紫色的大液泡。把细胞泡进浓蔗糖溶液，水从液泡里跑出去，原生质层缩成一团，和细胞壁分开。', '再换回清水，水又渗回来，细胞恢复原状：它是活的。'],
  formula: '水：低浓度溶液 → 高浓度溶液', formulaNote: '水分子顺着自身的相对含量梯度，穿过原生质层这层“半透膜”',
  terms: [['原生质层', '细胞膜、液泡膜和两层膜之间的细胞质。'], ['渗透作用', '水分子通过半透膜的扩散。'], ['细胞液', '液泡里的液体，有一定浓度。']],
  predict: { q: '把已经质壁分离的活细胞放回清水里，会怎样？', options: ['保持分离状态', '慢慢复原', '细胞立刻胀破'], answer: 1, why: '清水的浓度低于细胞液，水渗透进入液泡，原生质层重新贴紧细胞壁。细胞壁伸缩性小，会保护细胞不被胀破。' },
  challenge: '找到“刚好开始分离”的浓度：它大约等于细胞液的浓度。',
  fig: '一个放大的表皮细胞，以及显微镜视野', hint: '拖动蔗糖浓度，或直接滴加。',
  teach: {
    where: '人教版生物学 必修 1 · 细胞的物质输入和输出；探究·实践：探究植物细胞的吸水和失水。',
    ask: ['为什么选紫色洋葱的外表皮？换成根尖分生区细胞能看到同样现象吗？', '如果把蔗糖换成一定浓度的 KNO₃ 溶液，细胞会先分离、后自动复原，为什么？'],
    simplify: '细胞液等渗点取 0.12 g/mL，体积按“溶质不变、浓度相等”估算，变化快慢为示意；模型里细胞不会因浓度过高而死亡，真实实验中 0.5 g/mL 的蔗糖可能使细胞失活而无法复原。',
  },
  controls: [
    { id: 'c', label: '外界蔗糖浓度', min: 0, max: 0.5, step: 0.01, value: 0, unit: 'g/mL' },
    { id: 'sug', type: 'button', label: '滴加 0.3 g/mL 蔗糖' }, { id: 'wat', type: 'button', label: '滴加清水' },
  ],
  build(k) {
    const p = k.p, X = -1.5, Z = -0.9, W = 4.2, H = 2.6, D = 2.4, C0 = 0.12;
    const bath = at(flat(new THREE.BoxGeometry(W + 1.6, H + 0.6, D + 1.4).translate(0, (H + 0.6) / 2, 0), C.amber, { opacity: 0.05 }), X, 0.05, Z);
    const wall = at(group(glass(new THREE.BoxGeometry(W, H, D).translate(0, H / 2, 0)), glass(new THREE.BoxGeometry(W - 0.14, H - 0.14, D - 0.14).translate(0, H / 2, 0))), X, 0.2, Z);
    const proto = flat(new THREE.BoxGeometry(W - 0.3, H - 0.3, D - 0.3), C.leaf, { opacity: 0.22 });
    const vac = flat(new THREE.BoxGeometry(W - 0.9, H - 0.8, D - 0.9), C.violet, { opacity: 0.6 });
    const nuc = at(ball(0.26, '#e7dfc8'), -1.75, -0.6, 0.6);
    const cell = at(group(proto, vac, at(glow(C.violet, 4, 0.35), 0, 0, 0), nuc), X, 0.2 + H / 2, Z);
    const fl = [flow([[X - W / 2 + 0.5, 1.5, Z + D / 2], [X - W / 2 - 1.0, 1.5, Z + D / 2 + 0.3]], 5, C.sky, { r: 0.08 }), flow([[X + W / 2 - 0.5, 1.5, Z + D / 2], [X + W / 2 + 1.0, 1.5, Z + D / 2 + 0.3]], 5, C.sky, { r: 0.08 })];
    const scope = at(sheet(3.3, 3.3, () => {}, { lay: 'tilt', ink: true, opaque: true }), 2.9, 0, -2.6);
    const info = at(card('\n', { w: 3.8, size: 0.31, align: 'left' }), 2.5, 0, 2.5);
    k.root.add(bath, wall, cell, ...fl, scope, info, at(note('细胞壁', { size: 0.3 }), X - 0.8, H + 0.7, Z), at(note('液泡', { size: 0.3, color: '#5a3fd0' }), X + 1.1, H + 0.7, Z));
    let v = 1, lastS = -1;
    const veq = () => (p.c <= C0 ? 1 + (C0 - p.c) * 0.3 : Math.max(0.3, C0 / p.c));
    const drawScope = (s) => scope.redraw((x, S, w, h) => {
      const c = w * S / 2;
      x.fillStyle = C.paper; x.fillRect(0, 0, w * S, h * S);
      x.save(); x.beginPath(); x.arc(c, c, c * 0.9, 0, TAU); x.clip();
      x.fillStyle = '#f7f2ff'; x.fillRect(0, 0, w * S, h * S);
      const cw = w * S * 0.36, ch = h * S * 0.2;
      for (let r = -1; r < 6; r++) for (let q = -1; q < 4; q++) {
        const ox = q * cw + (r % 2 ? cw / 2 : 0), oy = r * ch;
        x.strokeStyle = C.ink; x.lineWidth = S * 0.03; x.strokeRect(ox, oy, cw, ch);
        x.fillStyle = 'rgba(122,92,255,.62)'; x.beginPath();
        x.roundRect(ox + cw / 2 - cw * 0.44 * s, oy + ch / 2 - ch * 0.4 * s, cw * 0.88 * s, ch * 0.8 * s, ch * 0.2 * (1.6 - s)); x.fill();
      }
      x.restore(); x.strokeStyle = C.ink; x.lineWidth = S * 0.05; x.beginPath(); x.arc(c, c, c * 0.9, 0, TAU); x.stroke();
    });
    return {
      press(id) { k.set('c', id === 'sug' ? 0.3 : 0); },
      update(dt) {
        const e = veq(), net = e - v;
        v += net * (1 - Math.exp(-dt / 1.3));
        const s = Math.cbrt(clamp(v, 0.2, 1.05));
        cell.scale.setScalar(Math.min(1, s)); vac.scale.setScalar(clamp(0.6 + s * 0.4, 0.5, 1));
        bath.material.opacity = 0.03 + p.c * 0.5;
        fl.forEach((f) => { f.visible = Math.abs(net) > 0.004; f.step(dt, clamp(-net * 30, -3, 3)); });
        if (Math.abs(s - lastS) > 0.004) { lastS = s; drawScope(Math.min(1, s)); }
        const st = v < 0.97 ? (net > 0.004 ? '正在复原' : '质壁分离') : '原生质层紧贴细胞壁';
        info.set(`原生质体体积 ${(Math.min(v, 1.04) * 100).toFixed(0)}%\n${st}`);
        this.net = net;
      },
      margin() {
        const n = this.net || 0;
        return [`外界 ${p.c.toFixed(2)} g/mL`, `细胞液 ≈ ${(C0 / Math.min(1.04, Math.max(v, 0.3))).toFixed(2)} g/mL`, p.c > C0 ? '外界浓度更高' : '细胞液浓度更高', Math.abs(n) < 0.004 ? '水分进出平衡' : n < 0 ? '水：细胞 → 外界' : '水：外界 → 细胞', '蓝点 = 水分子的净流向'];
      },
    };
  },
};

// ---------------------------------------------------------------- 酶
const enzyme = {
  id: 'bio-enzyme', subject: 'bio', title: '酶的活性', en: 'Enzyme activity',
  lede: ['过氧化氢会缓慢分解成水和氧气。滴进两滴新鲜的肝脏研磨液，气泡立刻翻涌，里面的过氧化氢酶让反应快了成千上万倍。', '但酶很娇气：太冷它“睡着”，太热它“熟了”，太酸太碱它也罢工。'],
  formula: '2H₂O₂ ═ 2H₂O + O₂↑（酶）', formulaNote: '酶降低反应的活化能；每种酶都有最适温度和最适 pH',
  terms: [['酶', '活细胞产生的、有催化作用的有机物。'], ['高效性', '比无机催化剂的效率高得多。'], ['变性', '高温等使酶的空间结构被破坏而失活。']],
  predict: { q: '把在 80 ℃ 里泡过的酶重新放回 37 ℃，它的活性能恢复吗？', options: ['能，回到最适温度就好了', '不能', '活性反而更高'], answer: 1, why: '高温破坏了酶的空间结构，这种变性是不可逆的。低温只是抑制活性，结构没坏，回温后还能恢复。这就是“冷”和“热”的根本区别。' },
  challenge: '先把温度拉到 80 ℃ 再拉回 37 ℃，对比“换一支新酶”后的气泡。',
  fig: '水浴中的试管：过氧化氢溶液与催化剂', hint: '改温度和 pH，数气泡的快慢。',
  teach: {
    where: '人教版生物学 必修 1 · 细胞的能量供应和利用：降低化学反应活化能的酶；探究·实践：比较过氧化氢在不同条件下的分解、影响酶活性的条件。',
    ask: ['比较“肝脏研磨液”和“FeCl₃”，说明了酶的什么特性？', '探究温度对酶活性的影响时，通常不选过氧化氢作底物，为什么？'],
    simplify: '活性曲线是示意性的钟形曲线（最适 37 ℃、pH 7），高于约 55 ℃ 时酶逐渐不可逆失活；真实实验里过氧化氢本身受热也会分解。',
  },
  controls: [
    { id: 'T', label: '水浴温度', min: 0, max: 80, step: 1, value: 37, unit: '℃' },
    { id: 'pH', label: 'pH', min: 3, max: 11, step: 0.1, value: 7 },
    { id: 'cat', type: 'choice', label: '加入', options: ['肝脏研磨液', 'FeCl₃', '蒸馏水'], value: 0, wide: true },
    { id: 'new', type: 'button', label: '换一支新酶' },
  ],
  build(k) {
    const p = k.p, X = -1.9, Z = -0.6;
    const bath = at(beaker(1.6, 1.9), X, 0.05, Z), water = at(liquid(1.5, 1.4, '#cfe6ff', 0.3), X, 0.09, Z);
    const tubeG = at(group(glass(new THREE.CylinderGeometry(0.46, 0.46, 3.2, 32, 1, true).translate(0, 1.9, 0)), glass(new THREE.SphereGeometry(0.46, 24, 12, 0, TAU, Math.PI / 2, Math.PI / 2).translate(0, 0.3, 0))), X - 0.2, 0.3, Z);
    const sol = at(liquid(0.42, 1.7, '#fff3d8', 0.55), X - 0.2, 0.55, Z);
    const foam = at(flat(new THREE.CylinderGeometry(0.42, 0.42, 1, 24).translate(0, 0.5, 0), '#ffffff', { opacity: 0.85 }), X - 0.2, 2.25, Z);
    const bub = bubbler(26, { x: X - 0.2, z: Z, rad: 0.28, y0: 0.7, r: 0.055, speed: 1.5 });
    const therm = at(jar(0.09, 3.0, C.red, { fill: 0.4, glow: 0.2 }), X + 1.0, 0.3, Z - 0.4);
    const g = at(plot({ w: 4.1, h: 3.1, xr: [0, 80], yr: [0, 1.1], xl: '温度 / ℃', yl: '相对活性' }), 2.3, 0, -2.4);
    const info = at(card('\n', { w: 3.7, size: 0.32, align: 'left' }), 2.4, 0, 2.4);
    k.root.add(bath, water, tubeG, sol, foam, bub, therm, g, info);
    let den = 0, lastKey = '';
    const fT = (T) => (T <= 37 ? Math.exp(-(((T - 37) / 17) ** 2)) : Math.exp(-(((T - 37) / 9) ** 2)));
    const fpH = (h) => Math.exp(-(((h - 7) / 1.7) ** 2));
    const act = () => (p.cat === 0 ? fT(p.T) * fpH(p.pH) * (1 - den) : p.cat === 1 ? Math.min(0.5, 0.06 * Math.pow(2, (p.T - 25) / 10)) : 0.004 * Math.pow(2, (p.T - 25) / 10));
    return {
      press() { den = 0; },
      update(dt) {
        if (p.cat === 0) { const d = clamp((p.T - 52) / 20); den = Math.max(den, den + (d - den) * (1 - Math.exp(-dt * 0.9))); }
        const a = act();
        bub.step(dt, a * 16, 2.25);
        foam.scale.y = lerp(foam.scale.y, 0.02 + a * 0.9, 0.05);
        therm.fill(p.T / 100);
        const key = `${p.pH}|${p.cat}|${den.toFixed(2)}|${p.T}`;
        if (key !== lastKey) {
          lastKey = key;
          g.clear().fn((T) => fT(T) * fpH(p.pH), 'rgba(30,43,54,.3)', 0.03, true);
          if (p.cat === 0) g.fn((T) => fT(T) * fpH(p.pH) * (1 - den), C.leaf, 0.045);
          else g.fn((T) => (p.cat === 1 ? Math.min(0.5, 0.06 * Math.pow(2, (T - 25) / 10)) : 0.004 * Math.pow(2, (T - 25) / 10)), C.flame, 0.045);
          g.dot(p.T, a, C.amber, 0.09).done();
        }
        info.set(`气泡 ≈ ${(a * 120).toFixed(0)} 个/分\n${p.cat === 0 && den > 0.05 ? `酶已失活 ${(den * 100).toFixed(0)}%` : p.cat === 0 ? '过氧化氢酶' : p.cat === 1 ? '无机催化剂' : '没有催化剂'}`);
        this.a = a;
      },
      margin() {
        return [`T = ${p.T} ℃　pH = ${p.pH.toFixed(1)}`, `相对活性 ${(this.a || 0).toFixed(2)}`, p.cat === 0 ? (den > 0.05 ? '高温：结构被破坏' : p.T < 15 ? '低温：活性被抑制' : '最适 37 ℃、pH 7') : '无机催化剂不怕热', '灰虚线：新鲜的酶', '绿线：这支酶现在', den > 0.05 ? '降温也回不来了' : ''].filter(Boolean);
      },
    };
  },
};

// ---------------------------------------------------------------- 光合作用
const photo = {
  id: 'bio-photosynthesis', subject: 'bio', title: '光照强度与光合作用', en: 'Light and photosynthesis',
  lede: ['把一枝黑藻泡在碳酸氢钠溶液里，对着灯。光越强，叶片上冒出的氧气泡越密。', '但别忘了它同时还在呼吸。灯太暗时，光合作用放出的氧气还不够自己用，一个气泡也冒不出来。'],
  formula: 'CO₂ + H₂O ─→ (CH₂O) + O₂', formulaNote: '光能、叶绿体。净光合速率 = 总光合速率 − 呼吸速率',
  terms: [['光补偿点', '光合与呼吸速率相等时的光照强度。'], ['光饱和点', '再增强光照，速率也不再上升。'], ['净光合速率', '实际测到的氧气释放速率。']],
  predict: { q: '不断增强光照，氧气泡会一直越冒越快吗？', options: ['会，光越强越快，没有上限', '不会，到一定强度就不再加快', '光太强反而立刻停止'], answer: 1, why: '光反应再快，暗反应也受 CO₂ 浓度、酶的数量等限制。达到光饱和点后，限制因素不再是光，而是 CO₂ 等其他条件。' },
  challenge: '找到光补偿点；再提高 CO₂ 浓度，看饱和时的速率能高多少。',
  fig: '台灯、烧杯里的黑藻与收集气体的试管', hint: '调光照强度，再改 NaHCO₃ 浓度。',
  teach: {
    where: '人教版生物学 必修 1 · 细胞的能量供应和利用：光合作用的原理和应用；探究·实践：探究环境因素对光合作用强度的影响。',
    ask: ['曲线与纵轴的交点是负值，它代表什么？', '光饱和之后，想让气泡更快，应该改变哪个条件？'],
    simplify: '速率用饱和曲线 P = Pmax·I/(I+K) 减去固定的呼吸速率估算，数值为相对值；温度固定在 25 ℃。',
  },
  controls: [
    { id: 'I', label: '光照强度', min: 0, max: 20, step: 0.5, value: 8, unit: 'klx' },
    { id: 'c', label: 'NaHCO₃', min: 0, max: 3, step: 0.1, value: 1, unit: '%' },
  ],
  build(k) {
    const p = k.p, X = -0.7, Z = -0.6;
    const bk = at(beaker(1.5, 2.6), X, 0.05, Z), water = at(liquid(1.42, 2.2, '#d6f0e4', 0.3), X, 0.09, Z);
    const plant = group();
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7, pts = [0, 1, 2, 3].map((j) => [X + Math.cos(a) * 0.3 * j * 0.6, 0.2 + j * 0.55, Z + Math.sin(a) * 0.3 * j * 0.6]);
      plant.add(tube(pts, 0.05, C.leaf));
      pts.forEach((q, j) => j && plant.add(rot(at(solid(new THREE.SphereGeometry(0.2, 12, 8).scale(1, 0.25, 0.45), C.leaf), q[0] + 0.15, q[1], q[2]), 0, a + j, 0.4)));
    }
    const funnel = at(group(glass(new THREE.CylinderGeometry(0.18, 1.0, 1.1, 32, 1, true).translate(0, 0.55, 0)), glass(new THREE.CylinderGeometry(0.22, 0.22, 2.3, 24, 1, true).translate(0, 2.25, 0))), X, 1.0, Z);
    const bub = bubbler(22, { x: X, z: Z, rad: 0.12, y0: 1.2, r: 0.05, speed: 1.3 });
    const lamp = at(group(cyl(0.6, 0.14), at(cyl(0.07, 3.0), 0, 0.14, 0), rot(at(solid(new THREE.ConeGeometry(0.7, 0.9, 28, 1, true), C.shade), 0.35, 3.1, 0), 0, 0, 1.15)), -4.0, 0, Z);
    const beam = flat(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array([-3.4, 3.0, Z, X - 1.4, 2.8, Z, X - 1.4, 0.2, Z]), 3)), C.amber, { opacity: 0.2 });
    const bulb = at(glow(C.amber, 2.2, 0.6), -3.4, 3.0, Z);
    const g = at(plot({ w: 4.0, h: 3.0, xr: [0, 20], yr: [-5, 20], xl: '光照强度 / klx', yl: '净光合速率' }), 2.3, 0, -3.0);
    const info = at(card('\n', { w: 3.7, size: 0.32, align: 'left' }), 2.4, 0, 2.4);
    k.root.add(bk, water, plant, funnel, bub, lamp, beam, bulb, g, info);
    const R = 3, pmax = () => 6 + 16 * p.c / (p.c + 0.6), net = (I) => pmax() * I / (I + 4) - R;
    let last = '';
    return {
      update(dt) {
        const n = net(p.I);
        bub.step(dt, Math.max(0, n) * 0.55, 4.4);
        beam.material.opacity = p.I / 20 * 0.3; bulb.material.opacity = 0.1 + p.I / 20 * 0.7;
        const key = `${p.I}|${p.c}`;
        if (key !== last) {
          last = key;
          g.clear().curve([[0, 0], [20, 0]], 'rgba(30,43,54,.4)', 0.02, true).fn(net, C.leaf, 0.045).dot(p.I, n, C.amber, 0.09).done();
        }
        info.set(n > 0.05 ? `放氧速率 ${n.toFixed(1)}（相对值）\n光合 > 呼吸` : n < -0.05 ? '没有气泡\n光合 < 呼吸，在耗氧' : '恰好不冒泡\n这里是光补偿点');
        this.n = n;
      },
      margin() {
        const pm = pmax(), comp = R * 4 / (pm - R);
        return [`总光合 ${(this.n + R || 0).toFixed(1)}`, `呼吸 ${R.toFixed(1)}`, `净光合 ${(this.n || 0).toFixed(1)}`, `光补偿点 ≈ ${comp.toFixed(1)} klx`, `饱和时净值 → ${(pm - R).toFixed(1)}`, '（CO₂ 越足越高）'];
      },
    };
  },
};

// ---------------------------------------------------------------- 性状分离比的模拟
const mendel = {
  id: 'bio-mendel', subject: 'bio', title: '性状分离比的模拟', en: "Modelling Mendel's 3 : 1",
  lede: ['两只小桶代表雌、雄生殖器官，桶里各有数量相等的 D 球和 d 球，代表两种配子。', '闭着眼从两只桶里各抓一个，凑成一对，就是一个后代的遗传因子组成。抓得越多，比例越接近孟德尔的数字。'],
  formula: 'DD : Dd : dd = 1 : 2 : 1', formulaNote: '显性性状 : 隐性性状 = 3 : 1（Dd × Dd 的后代）',
  terms: [['配子', '生殖细胞，只含成对遗传因子中的一个。'], ['分离定律', '成对的遗传因子在形成配子时彼此分离。'], ['随机结合', '雌雄配子结合的机会均等。']],
  predict: { q: '只抓 4 次，结果一定是 3 个显性、1 个隐性吗？', options: ['一定是', '不一定', '一定不是'], answer: 1, why: '3 : 1 是大量统计才显现的规律，每一次抓取都是独立的随机事件。样本太小，偏差可能很大。孟德尔数了几千粒豌豆。' },
  challenge: '抓到显性比例稳定在 75% ± 2% 之内，大约需要多少次？',
  fig: '甲、乙两只小桶与统计柱', hint: '先抓几次，再一口气抓 100 次。',
  teach: {
    where: '人教版生物学 必修 2 · 遗传因子的发现：孟德尔的豌豆杂交实验（一）；探究·实践：性状分离比的模拟实验。',
    ask: ['每次抓完为什么必须把小球放回原桶并摇匀？', '两只桶里小球的总数必须相等吗？每只桶里 D 和 d 的数量呢？'],
    simplify: '每次抓取为独立的等概率随机事件（相当于放回并摇匀）；用的是浏览器的伪随机数。',
  },
  controls: [
    { id: 'one', type: 'button', label: '抓 1 次' }, { id: 'ten', type: 'button', label: '抓 10 次' }, { id: 'hun', type: 'button', label: '抓 100 次' }, { id: 'reset', type: 'button', label: '重来' },
  ],
  build(k) {
    const Z = -1.3, COL = { D: C.amber, d: C.sky };
    const mkBucket = (x, name) => {
      const g = at(group(glass(new THREE.CylinderGeometry(1.0, 0.85, 1.7, 36, 1, true).translate(0, 0.85, 0)), glass(new THREE.CircleGeometry(0.85, 36).rotateX(-Math.PI / 2).translate(0, 0.03, 0))), x, 0.05, Z);
      const balls = dots(20, 0.2, '#ffffff', { seg: 16 });
      for (let i = 0; i < 20; i++) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * 0.6; balls.put(i, Math.cos(a) * r, 0.25 + (i % 4) * 0.3 + Math.random() * 0.1, Math.sin(a) * r).paint(i, i % 2 ? COL.D : COL.d); }
      balls.done(); g.add(balls, at(note(name, { size: 0.34 }), 0, 2.3, 0));
      return g;
    };
    const pick = [ball(0.24), ball(0.24)];
    const bars = ['DD', 'Dd', 'dd'].map((n, i) => {
      const b = at(box(0.8, 1, 0.8, i === 2 ? '#cfe6ff' : '#ffe6ad'), -1.4 + i * 1.4, 0, 1.7);
      return { b, tag: at(note(n, { size: 0.36, italic: true, lay: 'flat' }), -1.4 + i * 1.4, 0.03, 2.5), num: at(note('0', { size: 0.34, w: 1.2 }), -1.4 + i * 1.4, 0.5, 1.7) };
    });
    const g = at(plot({ w: 3.9, h: 2.9, xr: [0, 100], yr: [0, 1], xl: '抓取次数', yl: '显性所占比例' }), 2.5, 0, -3.2);
    k.root.add(mkBucket(-3.2, '甲（♀配子）'), mkBucket(-0.6, '乙（♂配子）'), ...pick, ...bars.flatMap((x) => [x.b, x.tag, x.num]), g, at(plate(3.2, 0.9), -1.9, 0, 0.1));
    const cnt = [0, 0, 0], hist = []; let anim = 0, cur = ['D', 'd'];
    const once = () => { const a = Math.random() < 0.5 ? 'D' : 'd', b = Math.random() < 0.5 ? 'D' : 'd'; cnt[a === 'D' && b === 'D' ? 0 : a === 'd' && b === 'd' ? 2 : 1]++; cur = [a, b]; const n = cnt[0] + cnt[1] + cnt[2]; hist.push([n, (cnt[0] + cnt[1]) / n]); };
    const draw = () => {
      const n = Math.max(100, cnt[0] + cnt[1] + cnt[2]);
      g.range([0, n], [0, 1]).clear().curve([[0, 0.75], [n, 0.75]], C.violet, 0.03, true).curve(hist, C.flame, 0.04).text(n * 0.62, 0.86, '理论值 0.75', '#5a3fd0').done();
    };
    draw();
    return {
      press(id) {
        if (id === 'reset') { cnt.fill(0); hist.length = 0; anim = 0; } else { for (let i = 0; i < (id === 'one' ? 1 : id === 'ten' ? 10 : 100); i++) once(); anim = 1; }
        draw();
      },
      update(dt) {
        anim = Math.max(0, anim - dt * 2.2);
        const e = 1 - anim * anim, tot = cnt[0] + cnt[1] + cnt[2], mx = Math.max(8, ...cnt);
        pick.forEach((b, i) => {
          b.visible = tot > 0; b.material.color.set(COL[cur[i]]);
          b.position.set(lerp(i ? -0.6 : -3.2, -1.9 + (i ? 0.3 : -0.3), e), 0.33 + Math.sin(e * Math.PI) * 2.2 + (1 - e) * 1.4, lerp(Z, 0.1, e));
        });
        bars.forEach((x, i) => { x.b.scale.y = lerp(x.b.scale.y, 0.02 + cnt[i] / mx * 2.6, 0.2); x.num.position.y = x.b.scale.y + 0.35; x.num.set(String(cnt[i])); });
      },
      margin() {
        const t = cnt[0] + cnt[1] + cnt[2];
        return [`共抓 ${t} 次`, `DD ${cnt[0]}　Dd ${cnt[1]}　dd ${cnt[2]}`, '显性 : 隐性', t && cnt[2] ? ` = ${((cnt[0] + cnt[1]) / cnt[2]).toFixed(2)} : 1` : ' = —', '理论 3 : 1', t ? `显性占 ${(((cnt[0] + cnt[1]) / t) * 100).toFixed(1)}%` : ''].filter(Boolean);
      },
    };
  },
};

// ---------------------------------------------------------------- 种群增长
const population = {
  id: 'bio-population', subject: 'bio', title: '种群数量的增长', en: 'Population growth',
  lede: ['往一瓶培养液里接种少量酵母菌。起初它们几乎不受限制地翻倍；随着营养减少、空间变挤，增长慢下来，最后稳定在一个上限附近。', '这个上限叫环境容纳量，写作 K 值。'],
  formula: 'dN/dt = r N (1 − N / K)', formulaNote: '“J”形增长：Nₜ = N₀λᵗ（理想条件）；“S”形增长：受 K 值限制',
  terms: [['K 值', '环境条件不变时，种群能维持的最大数量。'], ['增长速率', '单位时间内增加的个体数。'], ['K/2', '“S”形曲线上增长最快的时刻。']],
  predict: { q: '“S”形增长中，种群数量增长最快是在什么时候？', options: ['刚接种时', '数量达到 K/2 时', '数量接近 K 时'], answer: 1, why: '刚开始个体太少，快到 K 时阻力太大，都长不快。在 K/2 时，“基数”和“剩余空间”的乘积最大，增长速率最高。渔业捕捞常让鱼群保持在 K/2 附近。' },
  challenge: '把 K 值加倍，达到 K/2 所需的时间变了多少？',
  fig: '锥形瓶中的酵母菌培养液与计数板', hint: '调增长率和 K 值，按“重新接种”。',
  teach: {
    where: '人教版生物学 选择性必修 2 · 种群及其动态：种群数量的变化；探究·实践：培养液中酵母菌种群数量的变化。',
    ask: ['“J”形曲线成立需要哪些理想条件？自然界里什么时候会近似出现？', '真实的酵母菌培养后期数量会下降，模型里为什么没有？'],
    simplify: '采用逻辑斯谛模型，K 值恒定，不考虑代谢废物积累造成的衰退期；数量单位为“万个/mL”，仅作示意。',
  },
  controls: [
    { id: 'r', label: '增长率 r', min: 0.2, max: 1.2, step: 0.05, value: 0.6, unit: '/h' },
    { id: 'K', label: 'K 值', min: 200, max: 1000, step: 50, value: 600 },
    { id: 'mode', type: 'choice', label: '条件', options: ['资源有限（S 形）', '理想条件（J 形）'], value: 0, wide: true },
    { id: 'go', type: 'button', label: '重新接种' },
  ],
  build(k) {
    const p = k.p, X = -2.2, Z = -1.2, N0 = 10, TMAX = 24;
    const flask = at(group(glass(new THREE.CylinderGeometry(0.36, 1.5, 2.4, 44, 1, true).translate(0, 1.2, 0)), glass(new THREE.CylinderGeometry(0.36, 0.36, 0.8, 32, 1, true).translate(0, 2.8, 0)), glass(new THREE.CircleGeometry(1.5, 44).rotateX(-Math.PI / 2).translate(0, 0.03, 0))), X, 0.05, Z);
    const broth = flat(new THREE.CylinderGeometry(0.93, 1.42, 1.2, 44).translate(0, 0.66, 0), '#f4e3b0', { opacity: 0.3 });
    const yeast = dots(90, 0.07, '#e8b84a');
    for (let i = 0; i < 90; i++) yeast.put(i, 0, -50, 0, 0.001);
    const seeds = Array.from({ length: 90 }, () => { const y = 0.15 + Math.random() * 1.0, rm = (1.42 - (y / 1.2) * 0.49) * 0.9, a = Math.random() * TAU, r = Math.sqrt(Math.random()) * rm; return [Math.cos(a) * r, y, Math.sin(a) * r]; });
    flask.add(broth, yeast);
    const grid = at(sheet(2.6, 2.6, () => {}, { lay: 'tilt', ink: true, opaque: true }), 3.3, 0, 2.2);
    const g = at(plot({ w: 4.2, h: 3.2, xr: [0, TMAX], yr: [0, 1100], xl: '时间 / h', yl: '数量 N' }), 2.2, 0, -2.6);
    const info = at(card('\n', { w: 3.6, size: 0.32, align: 'left' }), -2.2, 0, 2.8);
    const cells = Array.from({ length: 60 }, () => [Math.random(), Math.random()]);
    k.root.add(flask, grid, g, info);
    const N = (t) => (p.mode === 0 ? p.K / (1 + ((p.K - N0) / N0) * Math.exp(-p.r * t)) : N0 * Math.exp(p.r * t));
    let t = 0, lastN = -1;
    return {
      press() { t = 0; }, change() { t = 0; },
      update(dt) {
        t = Math.min(TMAX, t + dt * 2);
        const n = N(t), shown = Math.round(clamp(n / 1000) * 90);
        if (shown !== lastN) {
          lastN = shown;
          for (let i = 0; i < 90; i++) i < shown ? yeast.put(i, ...seeds[i]) : yeast.put(i, 0, -50, 0, 0.001);
          yeast.done();
          const m = Math.round(clamp(n / 1000) * 60);
          grid.redraw((x, S, w, h) => {
            x.fillStyle = C.paper; x.fillRect(0, 0, w * S, h * S); x.strokeStyle = 'rgba(30,43,54,.5)'; x.lineWidth = S * 0.015;
            for (let i = 0; i <= 4; i++) { const q = (0.1 + i * 0.2) * w * S; x.beginPath(); x.moveTo(q, 0.1 * h * S); x.lineTo(q, 0.9 * h * S); x.moveTo(0.1 * w * S, q); x.lineTo(0.9 * w * S, q); x.stroke(); }
            x.fillStyle = '#e0a52a';
            cells.slice(0, m).forEach(([a, b]) => { x.beginPath(); x.arc((0.12 + a * 0.76) * w * S, (0.12 + b * 0.76) * h * S, S * 0.05, 0, TAU); x.fill(); });
          });
        }
        broth.material.opacity = 0.2 + clamp(n / 1000) * 0.45;
        const pts = []; for (let i = 0; i <= 60; i++) { const tt = (t * i) / 60; pts.push([tt, N(tt)]); }
        g.clear();
        if (p.mode === 0) g.curve([[0, p.K], [TMAX, p.K]], C.violet, 0.03, true).curve([[0, p.K / 2], [TMAX, p.K / 2]], 'rgba(30,43,54,.3)', 0.02, true).text(TMAX * 0.78, p.K + 60, 'K', '#5a3fd0').text(TMAX * 0.78, p.K / 2 + 60, 'K/2');
        g.curve(pts, C.leaf, 0.05).dot(t, Math.min(n, 1100), C.amber, 0.08).done();
        const rate = p.mode === 0 ? p.r * n * (1 - n / p.K) : p.r * n;
        info.set(`t = ${t.toFixed(1)} h　N = ${n > 9999 ? '很多很多' : n.toFixed(0)}\n增长速率 ${rate > 9999 ? '爆炸' : rate.toFixed(0)} /h`);
        this.s = { n, rate };
      },
      margin() {
        const s = this.s || { n: N0, rate: 0 };
        return p.mode === 0 ? [`K = ${p.K}`, `N/K = ${(s.n / p.K * 100).toFixed(0)}%`, '增长速率最大值', ` rK/4 = ${(p.r * p.K / 4).toFixed(0)} /h`, ' 出现在 N = K/2', `倍增约 ${(Math.LN2 / p.r).toFixed(1)} h（初期）`] : ['理想条件：', '食物空间充裕', '没有天敌', `每 ${(Math.LN2 / p.r).toFixed(1)} h 翻一倍`, '曲线没有上限', '现实中不会持久'];
      },
    };
  },
};

// ---------------------------------------------------------------- DNA
const BASE = { A: ['T', C.leaf], T: ['A', C.red], G: ['C', C.sky], C: ['G', C.amber] };
const dna = {
  id: 'bio-dna', subject: 'bio', title: 'DNA 的双螺旋结构', en: 'The double helix',
  lede: ['两条长链反向平行，盘成一架扭转的梯子。扶手是脱氧核糖和磷酸交替连成的骨架，踏板是一对一对的碱基。', '踏板怎么配对是定死的：A 只和 T 配，G 只和 C 配。知道一条链，就等于知道了另一条。'],
  formula: 'A = T　 G ≡ C', formulaNote: 'A–T 之间 2 个氢键，G–C 之间 3 个氢键；嘌呤总数 = 嘧啶总数',
  terms: [['碱基互补配对', 'A 与 T、G 与 C 一一对应。'], ['反向平行', '两条链的方向相反：5′→3′ 对 3′→5′。'], ['氢键', '把配对的碱基连在一起的弱相互作用。']],
  predict: { q: '一条链的碱基顺序是 5′-ATGC-3′，与它配对的另一条链（从 3′ 到 5′ 读）是？', options: ['ATGC', 'TACG', 'CGTA'], answer: 1, why: '按 A–T、G–C 逐个配对：A 对 T，T 对 A，G 对 C，C 对 G，得到 TACG。两条链方向相反，所以它要从 3′ 端往 5′ 端读。' },
  challenge: '搭一段 G–C 含量 80% 的 DNA。它为什么更“耐热”？',
  fig: '10 个碱基对的 DNA 模型（A 绿 T 红 G 蓝 C 黄）', hint: '按字母往上接碱基；把螺旋“拧”起来。',
  teach: {
    where: '人教版生物学 必修 2 · 基因的本质：DNA 的结构；探究·实践：制作 DNA 双螺旋结构模型。',
    ask: ['在双链 DNA 中，(A+G)/(T+C) 恒等于多少？(A+T)/(G+C) 呢？', 'G–C 含量高的 DNA 解旋温度更高，从氢键数目解释。'],
    simplify: '模型只表示配对规则与螺旋走向：每圈 10 个碱基对（每对扭转 36°），未区分大沟小沟，骨架、碱基的尺寸均为示意。',
  },
  controls: [
    { id: 'tw', label: '每对扭转', min: 0, max: 36, step: 1, value: 36, unit: '°' },
    { id: 'A', type: 'button', label: 'A' }, { id: 'T', type: 'button', label: 'T' }, { id: 'G', type: 'button', label: 'G' }, { id: 'C', type: 'button', label: 'C' }, { id: 'rand', type: 'button', label: '随机' },
  ],
  build(k) {
    const p = k.p, X = -1.5, Z = -0.8, R = 1.15, RISE = 0.5, N = 10;
    let seq = 'ATGCGTACCA'.split(''), model = null, spin = 0, lastTw = -1;
    const info = at(card('\n', { w: 3.9, size: 0.31, align: 'left' }), 2.5, 0, 2.4);
    const strands = at(card('\n', { w: 4.2, size: 0.3, align: 'left' }), 2.5, 0, -2.6);
    k.root.add(info, strands, at(cyl(1.5, 0.12), X, 0, Z));
    const rebuild = () => {
      if (model) { k.root.remove(model); model.traverse((o) => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } }); }
      model = at(new THREE.Group(), X, 0.5, Z);
      const tw = (p.tw * Math.PI) / 180, a1 = [], a2 = [];
      for (let i = 0; i < N; i++) {
        const a = i * tw, y = i * RISE + 0.2, c = Math.cos(a), s = Math.sin(a);
        const P1 = [c * R, y, s * R], P2 = [-c * R, y, -s * R], [comp, col] = BASE[seq[i]];
        a1.push(P1); a2.push(P2);
        model.add(rod(P1, [c * 0.04, y, s * 0.04], 0.1, col), rod(P2, [-c * 0.04, y, -s * 0.04], 0.1, BASE[comp][1]), at(ball(0.17), ...P1), at(ball(0.17), ...P2));
      }
      model.add(tube(a1, 0.07, C.paper, { seg: 80 }), tube(a2, 0.07, C.paper, { seg: 80 }));
      k.root.add(model);
      const comp = seq.map((b) => BASE[b][0]), gc = seq.filter((b) => b === 'G' || b === 'C').length;
      info.set(`氢键共 ${gc * 3 + (N - gc) * 2} 个\nG–C 含量 ${gc * 10}%`);
      strands.set(`5′-${seq.join('')}-3′\n3′-${comp.join('')}-5′`);
    };
    rebuild();
    return {
      press(id) { if (id === 'rand') seq = Array.from({ length: N }, () => 'ATGC'[Math.random() * 4 | 0]); else { seq.push(id); seq.shift(); } rebuild(); },
      update(dt) {
        if (p.tw !== lastTw) { lastTw = p.tw; rebuild(); }
        spin += dt * 0.4; model.rotation.y = spin;
      },
      margin() {
        const n = (b) => seq.filter((x) => x === b).length, comp = seq.map((b) => BASE[b][0]), m = (b) => comp.filter((x) => x === b).length;
        const A = n('A') + m('A'), T = n('T') + m('T'), G = n('G') + m('G'), Cc = n('C') + m('C');
        return ['双链中：', `A ${A} = T ${T}`, `G ${G} = C ${Cc}`, `嘌呤 A+G = ${A + G}`, `嘧啶 T+C = ${T + Cc}`, p.tw ? `每圈 ${(360 / p.tw).toFixed(0)} 对碱基` : '还没拧成螺旋'];
      },
    };
  },
};

export default [plasmolysis, enzyme, photo, mendel, population, dna];
