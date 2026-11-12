// 物理（下）：电磁与光
import { C, TAU, clamp, lerp, group, at, rot, box, cyl, torus, rod, wire, tube, arrow, strip, dash, glow, note, card, plot, flat, glass, meter, flow, sheet, wavelength, THREE } from '../ink.js';

// ---------------------------------------------------------------- 电动势和内阻
const emf = {
  id: 'phy-emf', subject: 'phy', title: '电源的电动势和内阻', en: 'EMF and internal resistance',
  lede: ['电池并不是一个“恒定的 1.5 V”。电流越大，电池自己“吃掉”的电压越多，留给外电路的就越少。', '改变滑动变阻器，记下几组电压和电流，画成一条直线：截距是电动势，斜率是内阻。'],
  formula: 'U = E − I r', formulaNote: '路端电压 = 电动势 − 电流 × 内阻',
  terms: [['电动势 E', '电源把其他能转化为电能的本领。'], ['内阻 r', '电源内部对电流的阻碍。'], ['路端电压 U', '电源两极间的实际电压。']],
  predict: { q: '把滑动变阻器的阻值调小，电压表的示数会怎样？', options: ['变大', '变小', '不变，电池电压是固定的'], answer: 1, why: '外电阻变小，电流变大，内阻上分走的电压 Ir 变大，路端电压 U = E − Ir 就变小。' },
  challenge: '记录 4 组数据，让拟合出的内阻与真实值相差不超过 0.05 Ω。',
  fig: '电池、滑动变阻器、电流表与电压表', hint: '移动变阻器滑片，按“记录”攒数据点。',
  teach: {
    where: '人教版物理 必修第三册 · 电能 能量守恒定律；实验：电池电动势和内阻的测量。',
    ask: ['图线与纵轴的交点代表什么？此时电路处于什么状态？', '旧电池的图线为什么更陡？用旧电池带小灯泡会怎样？'],
    simplify: '电表视为理想电表（电流表内阻为零、电压表内阻无穷大），电池的 E、r 不随放电变化。光点代表电流方向，不是电子的真实速度。',
  },
  controls: [
    { id: 'R', label: '变阻器 R', min: 0.5, max: 15, step: 0.1, value: 6, unit: 'Ω' },
    { id: 'bat', type: 'choice', label: '电池', options: ['新电池', '旧电池'], value: 0 },
    { id: 'rec', type: 'button', label: '记录' }, { id: 'clr', type: 'button', label: '清空' },
  ],
  build(k) {
    const p = k.p, BAT = [[1.5, 0.4], [1.38, 1.8]], y = 0.05;
    // 电池
    k.root.add(rot(at(cyl(0.36, 1.6, C.shade), 2.4, 0.38, -2.9), 0, 0, Math.PI / 2), rot(at(cyl(0.12, 0.16, C.metal), 2.56, 0.38, -2.9), 0, 0, Math.PI / 2));
    k.root.add(at(note('+', { size: 0.4 }), 2.5, 1.0, -2.9), at(note('−', { size: 0.4 }), 0.9, 1.0, -2.9));
    // 回路导线
    const loop = [[2.6, y, -2.9], [3.5, y, -2.9], [3.5, y, 1.9], [-3.5, y, 1.9], [-3.5, y, -2.9], [0.8, y, -2.9]];
    for (let i = 0; i < loop.length - 1; i++) k.root.add(wire(loop[i], loop[i + 1], 0.03));
    const cur = flow([...loop, [2.6, y, -2.9]], 30, C.amber, { r: 0.08 });
    // 滑动变阻器
    k.root.add(rot(at(cyl(0.3, 3.4, C.paper), 1.7, 0.55, 1.9), 0, 0, Math.PI / 2), at(box(0.2, 0.9, 0.5), -1.8, 0, 1.9), at(box(0.2, 0.9, 0.5), 1.8, 0, 1.9), rod([-1.8, 1.05, 1.9], [1.8, 1.05, 1.9], 0.04));
    for (let i = 0; i < 16; i++) k.root.add(rot(at(torus(0.31, 0.02, C.copper), -1.5 + i * 0.2, 0.55, 1.9), 0, 0, Math.PI / 2));
    const slider = box(0.3, 0.42, 0.42, C.copper);
    // 电表
    const A = at(meter('A'), 3.5, 0, 0.5), Vm = at(meter('V'), 1.7, 0, -0.7);
    k.root.add(slider, A, Vm, cur, wire([0.8, y, -2.9], [0.8, y, -0.9], 0.03), wire([2.6, y, -2.9], [2.6, y, -0.9], 0.03));
    const g = at(plot({ w: 3.9, h: 3, xr: [0, 2], yr: [0.6, 1.6], xl: 'I / A', yl: 'U / V' }), -2.3, 0, -3.4);
    k.root.add(g);
    const pts = []; let fit = null;
    const now = () => { const [E, r] = BAT[p.bat]; const I = E / (p.R + r); return [I, E - I * r]; };
    const draw = () => {
      g.clear(); fit = null;
      if (pts.length >= 2) {
        const n = pts.length, sx = pts.reduce((a, q) => a + q[0], 0), sy = pts.reduce((a, q) => a + q[1], 0);
        const sxx = pts.reduce((a, q) => a + q[0] * q[0], 0), sxy = pts.reduce((a, q) => a + q[0] * q[1], 0), den = n * sxx - sx * sx;
        if (Math.abs(den) > 1e-9) { const m = (n * sxy - sx * sy) / den, b = (sy - m * sx) / n; fit = [b, -m]; g.fn((x) => b + m * x, C.violet, 0.03, true); }
      }
      pts.forEach((q) => g.dot(q[0], q[1]));
      g.dot(...now(), C.amber, 0.09).done();
    };
    draw();
    return {
      press(id) { if (id === 'rec') pts.push(now()); else pts.length = 0; draw(); },
      change(id) { if (id === 'bat') pts.length = 0; draw(); },
      update(dt) {
        const [I, U] = now();
        slider.position.set(lerp(-1.5, 1.5, p.R / 15), 0.86, 1.9);
        A.set(I / 2, `${I.toFixed(2)} A`); Vm.set(U / 2, `${U.toFixed(2)} V`);
        cur.step(dt, I * 3.2);
        this.fit = fit;
      },
      margin() {
        const [I, U] = now(), [E, r] = BAT[p.bat];
        return [`I = E/(R+r) = ${I.toFixed(2)} A`, `U = IR = ${U.toFixed(2)} V`, `内阻分压 Ir = ${(I * r).toFixed(2)} V`, ...(this.fit ? ['由图线：', `E ≈ ${this.fit[0].toFixed(2)} V`, `r ≈ ${this.fit[1].toFixed(2)} Ω`] : [`已记录 ${pts.length} 组`, '至少两组才能画线'])];
      },
    };
  },
};

// ---------------------------------------------------------------- 双缝干涉
const young = {
  id: 'phy-young', subject: 'phy', title: '双缝干涉测波长', en: "Young's double slits",
  lede: ['一束激光穿过两条靠得很近的狭缝，在远处的屏上不是两条亮线，而是一排明暗相间的条纹。', '条纹的间距藏着光的波长：量出间距，就量出了几百纳米的长度。'],
  formula: 'Δx = L λ / d', formulaNote: '相邻亮纹间距 = 缝到屏的距离 × 波长 ÷ 双缝间距',
  terms: [['干涉', '两列波叠加，有的地方加强，有的地方抵消。'], ['波长 λ', '决定光的颜色，可见光约 400～700 nm。'], ['双缝间距 d', '两条狭缝中心之间的距离。']],
  predict: { q: '其他都不变，把红光换成蓝光，条纹会怎样？', options: ['变宽变疏', '变窄变密', '间距不变，只是颜色变了'], answer: 1, why: '蓝光的波长比红光短，而条纹间距与波长成正比，所以条纹变密。' },
  challenge: '调出相邻亮纹间距正好 3.0 mm 的绿色条纹。',
  fig: '激光器、双缝与光屏（屏宽 40 mm）', hint: '改变波长、缝距和屏距，数一数亮纹。',
  teach: {
    where: '人教版物理 选择性必修第一册 · 光：光的干涉；实验：用双缝干涉测量光的波长。',
    ask: ['想让条纹更宽、更好测量，可以怎样调整装置？至少说两种办法。', '如果用白光做光源，中央条纹和两侧条纹各是什么颜色？'],
    simplify: '单色平行光垂直入射，屏距远大于缝距（小角度近似）；条纹亮度的包络只作示意。',
  },
  controls: [
    { id: 'lam', label: '波长 λ', min: 400, max: 700, step: 5, value: 630, unit: 'nm' },
    { id: 'd', label: '缝距 d', min: 0.1, max: 0.5, step: 0.01, value: 0.2, unit: 'mm' },
    { id: 'L', label: '屏距 L', min: 0.5, max: 1.5, step: 0.05, value: 1, unit: 'm' },
  ],
  build(k) {
    const p = k.p, ZS = -3.5, W = 5.6, H = 2.3;
    k.root.add(at(box(W + 0.4, H + 0.9, 0.16), 0, 0, ZS - 0.1));
    const scr = at(sheet(W, H, () => {}, { opaque: true }), 0, 0.55 + H / 2, ZS);
    const laser = group(rot(at(cyl(0.3, 1.0, C.shade), 0, 1.7, 2.3), Math.PI / 2, 0, 0), at(box(0.4, 1.4, 0.4), 0, 0, 2.8));
    const slit = group(at(box(1.6, 2.5, 0.08), 0, 0, 0), at(box(2.0, 0.12, 0.7), 0, 0, 0));
    const beam = strip(2, { w: 0.09, color: C.red, opacity: 0.85, normal: [0, 1, 0] });
    const fan = flat(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3)), C.red, { opacity: 0.22 });
    fan.frustumCulled = false;
    const halo = glow(C.red, 1.2, 0.7);
    const info = at(card('\n', { w: 3.4, size: 0.32, align: 'left' }), -2.6, 0, 2.3);
    k.root.add(scr, laser, slit, beam, fan, halo, info, at(note('40 mm', { size: 0.28 }), 0, 0.3, ZS + 0.02));
    const draw = () => {
      const col = wavelength(p.lam), dx = p.L * p.lam * 1e-6 / (p.d * 1e-3); // mm
      scr.redraw((x, S, w, h) => {
        x.fillStyle = '#14171c'; x.fillRect(0, 0, w * S, h * S);
        const n = Math.ceil(w * S);
        for (let i = 0; i < n; i++) {
          const mm = (i / n - 0.5) * 40, I = Math.cos(Math.PI * mm / dx) ** 2 * Math.exp(-((mm / 17) ** 2));
          x.fillStyle = `rgba(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0},${I})`;
          x.fillRect(i, h * S * 0.14, 1.5, h * S * 0.72);
        }
      });
      const zs = ZS + p.L * 2.8;
      slit.position.set(0, 0, zs);
      beam.set([[0, 1.7, 2.3], [0, 1.7, zs]]);
      [beam, fan, halo].forEach((m) => m.material.color.copy(col));
      fan.geometry.attributes.position.array.set([0, 1.7, zs, -W / 2, 1.7, ZS + 0.02, W / 2, 1.7, ZS + 0.02]);
      fan.geometry.attributes.position.needsUpdate = true;
      halo.position.set(0, 1.7, zs + 0.1);
      info.set(`Δx = ${dx.toFixed(2)} mm\n屏上约 ${Math.floor(40 / dx)} 条亮纹`);
      return dx;
    };
    let dx = draw();
    return {
      change() { dx = draw(); },
      margin: () => ['Δx = Lλ/d', ` = ${p.L.toFixed(2)}×${p.lam}×10⁻⁹`, `   ÷ ${p.d.toFixed(2)}×10⁻³`, ` = ${dx.toFixed(2)} mm`, '反过来测波长：', 'λ = d·Δx / L'],
    };
  },
};

// ---------------------------------------------------------------- 折射与全反射
const refract = {
  id: 'phy-refract', subject: 'phy', title: '光的折射与全反射', en: 'Refraction and total internal reflection',
  lede: ['光从一种介质斜着进入另一种介质，会在界面上拐弯。拐多少，由两边的折射率决定。', '从玻璃射向空气时，入射角大到一定程度，折射光突然消失，光被全部“关”在玻璃里。'],
  formula: 'n = sin i / sin r', formulaNote: '折射率 = 空气中角度的正弦 ÷ 介质中角度的正弦；临界角 sin C = 1 / n',
  terms: [['法线', '过入射点、垂直于界面的直线。'], ['折射率 n', '光在真空中与在介质中的速度之比。'], ['临界角 C', '刚好发生全反射时的入射角。']],
  predict: { q: '光从玻璃射向空气，入射角不断增大，折射光线会怎样？', options: ['一直存在，只是越来越偏', '越来越暗，然后突然消失', '变得越来越亮'], answer: 1, why: '入射角增大时折射角先达到 90°。超过临界角后没有折射光，能量全部回到玻璃里，这就是全反射。光纤靠它传光。' },
  challenge: '找出玻璃的临界角，再换成水和金刚石比一比。',
  fig: '半圆形玻璃砖放在量角盘上（俯视纸面）', hint: '转动入射角；再把光路改成“介质→空气”。',
  teach: {
    where: '人教版物理 选择性必修第一册 · 光：光的折射、全反射；实验：测量玻璃的折射率。',
    ask: ['为什么用半圆形玻璃砖，并让光对准圆心入射？', '金刚石的临界角只有约 24°，这和它“火彩”很亮有什么关系？'],
    simplify: '单色光、界面理想光滑；反射光和折射光的明暗按菲涅耳公式估算，只作定性参考。',
  },
  controls: [
    { id: 'i', label: '入射角', min: 0, max: 89, step: 1, value: 40, unit: '°' },
    { id: 'n', type: 'choice', label: '介质', options: ['水 1.33', '玻璃 1.50', '金刚石 2.42'], value: 1 },
    { id: 'dir', type: 'choice', label: '光路', options: ['空气→介质', '介质→空气'], value: 0, wide: true },
  ],
  build(k) {
    const p = k.p, NS = [1.33, 1.5, 2.42], R = 3.3, Y = 0.32, O = [0, Y, 0.3];
    const disc = at(sheet(R * 2 + 0.6, R * 2 + 0.6, (x, S, w, h) => {
      const c = w * S / 2; x.strokeStyle = C.ink; x.lineWidth = S * 0.025;
      x.beginPath(); x.arc(c, c, R * S, 0, TAU); x.stroke();
      for (let a = 0; a < 360; a += 10) {
        const t = a * Math.PI / 180, l = a % 30 ? 0.12 : 0.24;
        x.beginPath(); x.moveTo(c + Math.sin(t) * R * S, c - Math.cos(t) * R * S); x.lineTo(c + Math.sin(t) * (R - l) * S, c - Math.cos(t) * (R - l) * S); x.stroke();
      }
      x.setLineDash([S * 0.12, S * 0.1]); x.beginPath(); x.moveTo(c, c - R * S); x.lineTo(c, c + R * S); x.stroke();
      x.setLineDash([]); x.lineWidth = S * 0.018; x.beginPath(); x.moveTo(c - R * S, c); x.lineTo(c + R * S, c); x.stroke();
    }, { lay: 'flat' }), 0, 0.03, O[2]);
    const block = at(glass(new THREE.CylinderGeometry(2.2, 2.2, 0.5, 48, 1, false, Math.PI / 2, Math.PI).translate(0, 0.25, 0)), 0, 0.04, O[2]);
    const tint = at(flat(new THREE.CircleGeometry(2.2, 48, Math.PI, Math.PI).rotateX(-Math.PI / 2).scale(1, 1, -1), C.sky, { opacity: 0.16 }), 0, 0.05, O[2]);
    const mk = () => strip(2, { w: 0.1, color: C.red, opacity: 0.9, normal: [0, 1, 0] });
    const inc = mk(), refl = mk(), refr = mk();
    const laser = group(rot(at(cyl(0.16, 1.1, C.shade), 0, 0, 0), Math.PI / 2, 0, 0));
    const spot = glow(C.red, 0.9, 0.8);
    const info = at(card('\n', { w: 3.6, size: 0.32, align: 'left' }), 2.5, 0, -3.3);
    k.root.add(disc, block, tint, inc, refl, refr, laser, at(spot, ...O), info, at(note('法线', { size: 0.3, lay: 'flat' }), 0.5, 0.04, O[2] + R - 0.5), at(note('空气', { size: 0.3, lay: 'flat' }), -2.6, 0.04, O[2] + 1.2), at(note('介质', { size: 0.3, lay: 'flat' }), -1.2, 0.56, O[2] - 0.8));
    const st = {};
    const dirv = (ang, side) => [Math.sin(ang), 0, Math.cos(ang) * side]; // side +1 朝读者（空气），−1 朝后（介质）
    const pt = (d, len) => [O[0] + d[0] * len, Y, O[2] + d[2] * len];
    return {
      update() {
        const n = NS[p.n], i = p.i * Math.PI / 180, fromAir = p.dir === 0;
        const s = fromAir ? Math.sin(i) / n : Math.sin(i) * n;
        const tir = s >= 1, r = tir ? Math.PI / 2 : Math.asin(s);
        const n1 = fromAir ? 1 : n, n2 = fromAir ? n : 1;
        const Rf = tir ? 1 : ((n1 * Math.cos(i) - n2 * Math.cos(r)) / (n1 * Math.cos(i) + n2 * Math.cos(r))) ** 2;
        const inSide = fromAir ? 1 : -1;
        const dIn = dirv(-i, inSide), dRe = dirv(i, inSide), dTr = dirv(r, -inSide);
        inc.set([pt(dIn, R + 0.5), O]); refl.set([O, pt(dRe, R)]); refr.set([O, pt(dTr, R)]);
        refl.material.opacity = clamp(0.12 + Rf * 0.85); refr.material.opacity = tir ? 0 : clamp(1 - Rf) * 0.9;
        refr.visible = !tir;
        laser.position.set(...pt(dIn, R + 1.0)); laser.lookAt(k.root.localToWorld(new THREE.Vector3(...O)));
        Object.assign(st, { n, r, tir, fromAir, Rf });
        info.set(tir ? `全反射！\n入射角 ${p.i}° > 临界角` : `${fromAir ? '折射角' : '出射角'} = ${(r * 180 / Math.PI).toFixed(1)}°\n反射约 ${(Rf * 100).toFixed(0)}% 的光`);
      },
      margin() {
        const Cc = Math.asin(1 / st.n) * 180 / Math.PI;
        const a = st.fromAir ? [`sin r = sin ${p.i}° / ${st.n}`, ` r = ${(st.r * 180 / Math.PI).toFixed(1)}°`] : st.tir ? [`sin ${p.i}° × ${st.n} > 1`, '没有折射光'] : [`sin r = ${st.n}·sin ${p.i}°`, ` r = ${(st.r * 180 / Math.PI).toFixed(1)}°`];
        return [`n = ${st.n}`, ...a, '临界角', `C = arcsin(1/n)`, ` = ${Cc.toFixed(1)}°`];
      },
    };
  },
};

// ---------------------------------------------------------------- 电磁感应
const induction = {
  id: 'phy-induction', subject: 'phy', title: '电磁感应与楞次定律', en: "Electromagnetic induction and Lenz's law",
  lede: ['磁铁插进线圈，电流计的指针偏一下；拔出来，指针往反方向偏；停着不动，指针回零。', '感应电流总是“唱反调”：它产生的磁场，总在阻碍引起它的那个磁通量变化。'],
  formula: 'E = n ΔΦ / Δt', formulaNote: '感应电动势 = 匝数 × 磁通量的变化率',
  terms: [['磁通量 Φ', '穿过线圈的磁感线的多少。'], ['楞次定律', '感应电流的磁场阻碍磁通量的变化。'], ['增反减同', '磁通量增加时反向，减少时同向。']],
  predict: { q: '把磁铁插进线圈后停住不动，电流计的指针会？', options: ['一直偏着', '回到零刻度', '来回摆动不停'], answer: 1, why: '感应电流来自磁通量的“变化”。磁铁不动，穿过线圈的磁通量再大也不变，就没有感应电流。' },
  challenge: '同样的磁铁，怎样让指针偏得最厉害？试试速度和匝数。',
  fig: '条形磁铁、螺线管与灵敏电流计', hint: '上下拖动磁铁，快一点、慢一点各试试。',
  teach: {
    where: '人教版物理 选择性必修第二册 · 电磁感应：楞次定律、法拉第电磁感应定律；实验：探究影响感应电流方向的因素。',
    ask: ['N 极插入和 S 极拔出，指针偏转方向相同还是相反？用“增反减同”解释。', '磁铁插得越快，指针偏得越多，这说明感应电动势与什么有关？'],
    simplify: '磁通量随距离的变化用一条平滑的经验曲线近似；指针偏转方向与实际电流计接线有关，这里约定“阻碍 N 极靠近”时向右偏。',
  },
  controls: [
    { id: 'pole', type: 'choice', label: '朝下的磁极', options: ['N 极', 'S 极'], value: 0 },
    { id: 'n', type: 'choice', label: '匝数', options: ['100', '200', '400'], value: 1 },
    { id: 'auto', type: 'toggle', label: '自动插拔', value: true },
  ],
  build(k) {
    const p = k.p, X = -1.6, Z = -0.8, NS = [100, 200, 400];
    k.root.add(at(glass(new THREE.CylinderGeometry(0.7, 0.7, 2.2, 36, 1, true).translate(0, 1.1, 0)), X, 0.1, Z), at(box(2.2, 0.1, 2.2), X, 0, Z));
    const rings = Array.from({ length: 12 }, (_, i) => at(torus(0.74, 0.045, C.copper), X, 0.3 + i * 0.17, Z));
    const top = group(at(box(0.56, 1.1, 0.4, C.red), 0, 1.1, 0), at(box(0.56, 1.1, 0.4, C.blue), 0, 0, 0));
    const tN = at(note('N', { size: 0.36, color: '#fff', bold: true }), 0, 0.55, 0.21), tS = at(note('S', { size: 0.36, color: '#fff', bold: true }), 0, 1.65, 0.21);
    const mag = group(top, tN, tS);
    const G = at(meter('G', { center: true, w: 2 }), 2.4, 0, 1.6);
    const loopPts = Array.from({ length: 25 }, (_, i) => { const a = i / 24 * TAU; return [X + Math.cos(a) * 0.95, 2.45, Z + Math.sin(a) * 0.95]; });
    const cur = flow(loopPts, 10, C.amber, { r: 0.085 });
    const bInd = arrow(C.violet, 0.06);
    const info = at(card('\n', { w: 3.7, size: 0.3, align: 'left' }), 2.4, 0, -3.2);
    k.root.add(...rings, mag, G, cur, bInd, info, tube([[X + 0.75, 0.3, Z], [X + 1.4, 0.06, Z + 0.4], [1.9, 0.06, 1.4]], 0.035, C.copper), tube([[X + 0.75, 2.2, Z], [X + 1.7, 1.2, Z + 0.2], [X + 2.2, 0.06, Z + 0.6], [2.9, 0.06, 1.4]], 0.035, C.copper));
    let y = 4.2, held = false, t = 0, lastPhi = null, emfV = 0, needle = 0;
    k.drag(top, { start: () => { held = true; k.set('auto', false); p.auto = false; }, move: (q) => { y = clamp(q.y - 1.1, 0.6, 4.6); }, end: () => { held = false; } });
    const phi = (yy) => { const d = yy - 1.3; return 1 / Math.pow(1 + (d / 1.1) ** 2, 1.5); };
    return {
      update(dt) {
        if (p.auto && !held) { t += dt; y = 2.6 + 1.9 * Math.cos(t * 1.5); }
        const sgn = p.pole === 0 ? 1 : -1;
        top.rotation.x = sgn > 0 ? 0 : Math.PI; top.position.y = sgn > 0 ? 0 : 2.2;
        tN.position.y = sgn > 0 ? 0.55 : 1.65; tS.position.y = sgn > 0 ? 1.65 : 0.55;
        mag.position.set(X, y, Z);
        rings.forEach((r, i) => { r.visible = i < [5, 8, 12][p.n]; });
        const P = sgn * phi(y);
        if (dt > 0) { if (lastPhi !== null) emfV = lerp(emfV, -(NS[p.n] / 200) * (P - lastPhi) / dt, 0.35); lastPhi = P; needle = lerp(needle, emfV, 1 - Math.exp(-dt * 14)); }
        else needle = lerp(needle, 0, 0.1);
        G.set(clamp(-needle * 0.9, -1, 1), Math.abs(needle) < 0.03 ? '0' : needle < 0 ? '右偏 →' : '← 左偏');
        cur.step(dt, -needle * 5); cur.visible = Math.abs(needle) > 0.03;
        // 感应电流的磁场方向（线圈上方）：与 −dΦ/dt 同号
        const up = needle > 0 ? 1 : -1, len = clamp(Math.abs(needle) * 1.6, 0, 1.6);
        bInd.set([X + 1.5, 1.4 - up * len / 2, Z], [X + 1.5, 1.4 + up * len / 2, Z]);
        this.s = { P, needle, sgn };
        info.set(Math.abs(needle) < 0.03 ? '磁通量不变\n没有感应电流' : `磁通量在${needle * Math.sign(P) < 0 ? '增加' : '减少'}\n感应磁场${needle * Math.sign(P) < 0 ? '与原磁场相反' : '与原磁场相同'}`);
      },
      margin() {
        const s = this.s || { P: 0, needle: 0 };
        return [`Φ（相对值）= ${Math.abs(s.P).toFixed(2)}`, `ΔΦ/Δt = ${(-s.needle).toFixed(2)}`, `匝数 n = ${NS[p.n]}`, '紫色箭头：', '感应电流的磁场', Math.abs(s.needle) < 0.03 ? '（现在没有）' : '“增反减同”'];
      },
    };
  },
};

export default [emf, young, refract, induction];
