// 第二代样板：单摆、酸碱中和滴定、活字印刷
// 三种不同的做法——真实仪器、玻璃与液体、依史料复原的工序——共用同一套书本、光影与墨线。
import { C, TAU, clamp, lerp, group, at, rot, box, cyl, ball, rod, wire, strip, dash, note, card, plot, sheet, flat, glow, lathe, vessel, dimension, retort, solid, torus, THREE } from '../ink.js';

const STEEL = '#cfd6dc', CORK = '#d9c39a', BRASS = '#d9b36a';
// 可复现的伪随机数：同一次操作序列得到同一组“人手误差”，便于课堂对照
const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const gauss = (r) => Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(TAU * r());

// ================================================================ 单摆
const PLACES = [['地球', 9.80], ['月球', 1.62], ['木星', 24.8]];
export const pendulum = {
  id: 'phy-pendulum', subject: 'phy', title: '用单摆测量重力加速度', en: 'Measuring g with a simple pendulum',
  lede: ['一根细线，一颗小球。在小角度下，单摆来回一次的时间只由摆长和当地的重力加速度决定。', '量出摆长，数出几十次全振动的总时间，就能“称”出脚下这颗星球的 g。'],
  formula: 'T = 2π √(l / g)', formulaNote: '周期 = 2π × √(摆长 ÷ 重力加速度)，摆角小于约 5° 时成立；g = 4π²l / T²',
  terms: [['摆长 l', '悬点到摆球球心的距离，不是线长。'], ['周期 T', '完成一次全振动所用的时间。'], ['累积法', '测 N 次全振动的总时间再除以 N，把按表的误差摊薄。']],
  predict: { q: '按秒表的手总有零点一秒左右的快慢。只测 1 次全振动和连测 30 次相比，算出的 g 会怎样？', options: ['一样准，手的误差和次数无关', '测 30 次的准得多', '测 1 次的更准，时间短误差小'], answer: 1, why: '每次按表的误差大约是固定的零点一秒。只测一次，这零点一秒全算在一个周期上；连测 30 次再除以 30，摊到每个周期只剩千分之几秒。这就是累积法。' },
  challenge: '在同一地点换三个摆长各测一次，看 T² 与 l 是不是成正比。',
  fig: '铁架台、软木夹、细线与摆球、米尺、秒表', hint: '拖动摆球拉开一个小角度松手，再按“计时并记录”。',
  teach: {
    ask: ['把摆角拉到 40°，秒表读数和公式算出的周期还一样吗？为什么实验要求小角度？', '为什么从平衡位置（最低点）开始计时，而不是从最高点？', '悬点没夹紧、摆动中线长变化，会让 g 的结果偏大还是偏小？'],
    simplify: '细线无质量、不可伸长；运动按 θ″ = −(g/l)·sinθ − γθ′ 数值积分，空气阻力只取与速度成正比的一项（木球比铁球衰减快），所以大角度时周期略长于公式值、摆幅会慢慢变小，这都是真实现象。秒表读数叠加了标准差约 0.1 s 的模拟按表误差；不模拟摆长测量误差和圆锥摆。计时期间演示以 4 倍速播放，秒表读数仍是装置里的时间。',
    safety: '真实实验中摆球应在同一竖直面内摆动；铁架台放稳，摆球下方不要放易碎物。',
  },
  controls: [
    { id: 'l', label: '摆长 l', min: 0.3, max: 1.5, step: 0.01, value: 0.8, unit: 'm' },
    { id: 'g', type: 'choice', label: '在', options: PLACES.map((x) => x[0]), value: 0 },
    { id: 'bob', type: 'choice', label: '摆球', options: ['木球', '铁球'], value: 0 },
    { id: 'n', type: 'choice', label: '连测', options: ['1 次', '10 次', '30 次'], value: 2 },
    { id: 'go', type: 'button', label: '拉到 5° 释放' }, { id: 'time', type: 'button', label: '计时并记录' },
  ],
  record: {
    title: '测量记录',
    note: '每按一次“计时并记录”（或这里的“记录一组”），秒表从摆球经过最低点开始，数满 N 次全振动后停表，自动记成一行。',
    columns: [
      { key: 'place', label: '地点' }, { key: 'l', label: '摆长 l', unit: 'm', digits: 2 }, { key: 'n', label: 'N', digits: 0 },
      { key: 't', label: '总时间 t', unit: 's', digits: 2 }, { key: 'T', label: '周期 T', unit: 's', digits: 3 }, { key: 'g', label: 'g', unit: 'm/s²', digits: 2, stat: true },
    ],
    sample: (inst) => inst.measure?.(), pending: '秒表已经开始：数满 N 次全振动后会自动记成一行。',
    summary(rows) {
      const out = [], here = rows.filter((r) => r.place === rows[rows.length - 1]?.place);
      const ls = [...new Set(here.map((r) => r.l))];
      if (ls.length >= 3) { // T² – l 图线的斜率：最小二乘
        const xs = here.map((r) => r.l), ys = here.map((r) => r.T * r.T), n = xs.length;
        const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
        const k = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
        out.push(['图像法', `${here[0].place}：T²–l 图线斜率 k = ${k.toFixed(3)} s²/m，g = 4π²/k = ${(4 * Math.PI ** 2 / k).toFixed(2)} m/s²`]);
      } else if (here.length) out.push(['图像法', '再换几个摆长（至少三个不同的 l），就能用 T²–l 图线的斜率求 g。']);
      return out;
    },
    errors: ['按表的反应时间：每次约 ±0.1 s，N 越大摊得越薄。', '摆角过大：周期比公式值偏长，g 偏小。', '把线长当摆长（漏了球半径）：l 偏小，g 偏小。', '数错全振动次数：多数一次，T 偏小，g 偏大。'],
  },
  build(k) {
    const p = k.p, S = 3.6, Z = -1.0, PIV = [0.25, 6.86, Z], R = 0.3, rand = rng(20261112);
    // 铁架台 + 横杆 + 软木夹（悬点必须夹死，不能绕在杆上）
    const st = at(retort(7.5, { w: 3.2, d: 2.3 }), -2.7, 0, Z);
    st.boss(7.12);
    k.root.add(st);
    const px = -2.7 + st.postX;
    k.root.add(rod([px - 0.3, 7.12, Z], [PIV[0] + 0.25, 7.12, Z], 0.065, STEEL));
    k.root.add(at(box(0.5, 0.3, 0.12, CORK), PIV[0], PIV[1], Z + 0.075), at(box(0.5, 0.3, 0.12, CORK), PIV[0], PIV[1], Z - 0.075));
    k.root.add(at(rot(cyl(0.035, 0.42, STEEL, { seg: 10 }), Math.PI / 2, 0, 0), PIV[0] + 0.14, PIV[1] + 0.18, Z - 0.21));
    // 量角板：悬点后面的一块刻度纸，每小格 1°
    const prot = at(sheet(3.4, 2.0, (x, s, w, h) => {
      const cx = w / 2 * s, cy = 0.06 * s, r0 = 1.72 * s;
      x.strokeStyle = C.ink; x.fillStyle = C.ink; x.lineCap = 'round';
      for (let d = -25; d <= 25; d++) {
        const a = Math.PI / 2 + d * Math.PI / 180, l = d % 5 === 0 ? 0.16 : 0.08;
        x.lineWidth = s * (d % 5 === 0 ? 0.014 : 0.008);
        x.beginPath(); x.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); x.lineTo(cx + Math.cos(a) * (r0 - l * s), cy + Math.sin(a) * (r0 - l * s)); x.stroke();
      }
      x.font = `italic ${s * 0.15}px Georgia,serif`; x.textAlign = 'center';
      for (const d of [-20, -10, -5, 5, 10, 20]) { const a = Math.PI / 2 + d * Math.PI / 180; x.fillText(`${Math.abs(d)}°`, cx + Math.cos(a) * (r0 + 0.14 * s), cy + Math.sin(a) * (r0 + 0.14 * s)); }
      x.fillStyle = 'rgba(180,101,58,.16)'; x.beginPath(); x.moveTo(cx, cy);
      x.arc(cx, cy, r0 - 0.2 * s, Math.PI / 2 - 5 * Math.PI / 180, Math.PI / 2 + 5 * Math.PI / 180); x.closePath(); x.fill();
    }), PIV[0], PIV[1] - 1.0, Z - 0.14);
    k.root.add(prot);
    // 米尺：零刻度对齐悬点，量到球心
    const RX = -1.55, rule = at(box(0.36, 5.9, 0.05, '#ead9b8'), RX, PIV[1] - 5.9, Z - 0.2);
    const scale = at(sheet(0.36, 5.9, (x, s, w, h) => {
      x.strokeStyle = C.ink; x.fillStyle = C.ink; x.textBaseline = 'middle'; x.textAlign = 'right';
      for (let i = 0; i <= 160; i++) {
        const y = (i / 100) * S * s; if (y > h * s) break;
        const big = i % 10 === 0, l = big ? 0.2 : i % 5 === 0 ? 0.14 : 0.08;
        x.lineWidth = s * (big ? 0.012 : 0.006);
        x.beginPath(); x.moveTo(0, y); x.lineTo(l * s, y); x.stroke();
        if (big && i) { x.font = `${s * 0.12}px Georgia,serif`; x.fillText((i / 100).toFixed(1), (w - 0.02) * s, y); }
      }
    }), RX, PIV[1] - 2.95, Z - 0.17);
    const mark = flat(new THREE.ConeGeometry(0.07, 0.2, 3).rotateZ(-Math.PI / 2), C.copper);
    const lead = strip(2, { color: C.copper, w: 0.02, opacity: 0.7 });
    k.root.add(rule, scale, mark, lead);
    k.root.add(dash([PIV[0], PIV[1], Z - 0.02], [PIV[0], 0.5, Z - 0.02], { w: 0.02, len: 0.16, gap: 0.14 }));
    // 摆线与摆球（带小挂环）
    const str = wire(PIV, [PIV[0], 3, Z], 0.016);
    const mkBob = (color, kind) => group(solid(new THREE.SphereGeometry(R, 40, 24), color, { kind, roughness: kind === 'metal' ? 0.3 : 0.6 }), at(rot(torus(0.05, 0.016, STEEL), Math.PI / 2, 0, 0), 0, R + 0.03, 0));
    const bobs = [mkBob('#e3cfa6', 'wood'), mkBob('#bfc6cc', 'metal')];
    const trail = strip(40, { color: C.violet, w: 0.07, opacity: 0.42 });
    const dim = dimension({ w: 1.5, size: 0.3 });
    k.root.add(str, ...bobs, trail, dim);
    // 秒表：一只真的表——表壳、表冠、表盘上的读数与秒针
    const watch = new THREE.Group();
    watch.add(solid(new THREE.CylinderGeometry(0.92, 0.92, 0.2, 48).rotateX(Math.PI / 2), STEEL, { kind: 'metal' }));
    watch.add(at(solid(new THREE.CylinderGeometry(0.1, 0.1, 0.26, 16), STEEL, { kind: 'metal' }), 0, 1.03, 0), at(rot(torus(0.13, 0.03, STEEL), Math.PI / 2, 0, 0), 0, 1.24, 0));
    let wtxt = '', wang = 0;
    const face = sheet(1.68, 1.68, () => {}, { opaque: false });
    const drawFace = () => face.redraw((x, s, w) => {
      const c = w / 2 * s;
      x.fillStyle = '#fffdf6'; x.beginPath(); x.arc(c, c, 0.82 * s, 0, TAU); x.fill();
      x.strokeStyle = C.ink; x.lineCap = 'round';
      for (let i = 0; i < 60; i++) { const a = i / 60 * TAU, l = i % 5 === 0 ? 0.1 : 0.05; x.lineWidth = s * (i % 5 === 0 ? 0.014 : 0.007); x.beginPath(); x.moveTo(c + Math.sin(a) * 0.78 * s, c - Math.cos(a) * 0.78 * s); x.lineTo(c + Math.sin(a) * (0.78 - l) * s, c - Math.cos(a) * (0.78 - l) * s); x.stroke(); }
      x.fillStyle = C.ink; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = `600 ${s * 0.25}px Georgia,serif`; x.fillText(wtxt, c, c + 0.3 * s);
      x.font = `${s * 0.1}px Georgia,serif`; x.fillStyle = C.copper; x.fillText('s', c, c + 0.5 * s);
      x.strokeStyle = C.red; x.lineWidth = s * 0.016; x.beginPath(); x.moveTo(c - Math.sin(wang) * 0.12 * s, c + Math.cos(wang) * 0.12 * s); x.lineTo(c + Math.sin(wang) * 0.66 * s, c - Math.cos(wang) * 0.66 * s); x.stroke();
      x.fillStyle = C.ink; x.beginPath(); x.arc(c, c, 0.035 * s, 0, TAU); x.fill();
    });
    face.position.z = 0.105; watch.add(face);
    watch.position.set(2.85, 0.75, 1.7); watch.rotation.x = -0.95;
    const tally = at(card('\n', { size: 0.27, w: 3.3, align: 'left' }), 2.75, 0, 3.6);
    k.root.add(watch, tally);

    let th = 0.2, om = 0, t = 0, held = false, lastCross = null, T = 0, amp = 0.2;
    let timing = 0, cnt = 0, t0 = 0, shown = 0, last = null, fresh = false; // timing: 0 闲 1 等过零 2 计数中
    const hist = [];
    const release = (a) => { th = a; om = 0; lastCross = null; T = 0; amp = Math.abs(a); hist.length = 0; timing = 0; };
    const N = () => [1, 10, 30][p.n];
    bobs.forEach((b) => k.drag(b.children[0], {
      start: () => { held = true; timing = 0; },
      move: (q) => { th = clamp(Math.atan2(q.x - PIV[0], PIV[1] - q.y), -1.05, 1.05); om = 0; },
      end: () => { held = false; release(th); },
    }));
    const finish = (tN) => {
      const n = N(), read = Math.max(0.05, tN + gauss(rand) * 0.1), Tm = read / n;
      last = { place: PLACES[p.g][0], l: p.l, n, t: read, T: Tm, g: 4 * Math.PI ** 2 * p.l / (Tm * Tm) };
      shown = read; timing = 0; fresh = true;
      k.record(last);
    };
    return {
      press(id) { if (id === 'go') release(5 * Math.PI / 180); else if (!held) { if (amp < 0.01) release(5 * Math.PI / 180); timing = 1; cnt = 0; shown = 0; } },
      change(id) { if (id === 'l' || id === 'g') release(Math.max(Math.abs(th), 0.087) * (th < 0 ? -1 : 1)); },
      /** 记录本要一组数据：有刚测完的就不重复，没有就立刻再测一轮 */
      measure() { if (timing) return null; if (amp < 0.01) release(5 * Math.PI / 180); timing = 1; cnt = 0; shown = 0; return null; },
      update(dt) {
        const g = PLACES[p.g][1], gam = p.bob ? 0.012 : 0.035;
        if (!held && dt > 0) {
          const speed = timing === 2 ? 4 : 1, steps = 12 * speed, h = dt * speed / steps;
          for (let i = 0; i < steps; i++) {
            const prev = th;
            om += (-(g / p.l) * Math.sin(th) - gam * om) * h; th += om * h; t += h;
            if (prev < 0 && th >= 0) {
              const tc = t - h * (th / (th - prev));
              if (lastCross !== null) T = tc - lastCross;
              lastCross = tc;
              if (timing === 1) { timing = 2; t0 = tc; cnt = 0; }
              else if (timing === 2 && ++cnt >= N()) { finish(tc - t0); break; }
            }
            amp = Math.max(Math.abs(th), amp - gam * amp * h * 0.5);
          }
          if (timing === 2) shown = t - t0;
        }
        const L = p.l * S, q = [PIV[0] + Math.sin(th) * L, PIV[1] - Math.cos(th) * L, Z];
        const top = [PIV[0] + Math.sin(th) * (L - R - 0.05), PIV[1] - Math.cos(th) * (L - R - 0.05), Z];
        str.span(PIV, top);
        bobs.forEach((b, i) => { b.visible = i === p.bob; b.position.set(...q); b.rotation.z = th; });
        hist.push(q); if (hist.length > 22) hist.shift();
        trail.set(hist); trail.visible = !held && Math.abs(om) > 0.02;
        // 米尺上的读数：球心的高度对到尺上
        const yc = PIV[1] - L;
        mark.position.set(RX + 0.3, yc, Z - 0.16); lead.set([[RX + 0.36, yc, Z - 0.16], [PIV[0], yc, Z - 0.16]]);
        dim.set([PIV[0] + 1.05, PIV[1], Z - 0.1], [PIV[0] + 1.05, yc, Z - 0.1], `l = ${p.l.toFixed(2)} m`);
        const txt = timing === 2 ? shown.toFixed(1) : shown ? shown.toFixed(2) : '0.00';
        const ang = (shown % 60) / 60 * TAU;
        if (txt !== wtxt || Math.abs(ang - wang) > 0.03) { wtxt = txt; wang = ang; drawFace(); }
        tally.set(timing === 1 ? '等摆球经过最低点…\n' : timing === 2 ? `全振动 ${cnt} / ${N()} 次\n（演示 4 倍速播放）` : last && fresh ? `N = ${last.n}，t = ${last.t.toFixed(2)} s\nT = ${last.T.toFixed(3)} s  已记录` : '按“计时并记录”\n秒表从最低点开始计');
        this.T = T;
      },
      margin() {
        const g = PLACES[p.g][1], Tf = TAU * Math.sqrt(p.l / g);
        const out = ['T = 2π√(l/g)', ` = 2π√(${p.l.toFixed(2)}/${g})`, ` = ${Tf.toFixed(3)} s`];
        if (last && fresh) out.push('秒表：', ` ${last.n}T = ${last.t.toFixed(2)} s`, ` T = ${last.T.toFixed(3)} s`, 'g = 4π²l/T²', ` = ${last.g.toFixed(2)} m/s²`);
        else out.push('秒表：还没测', amp > 0.18 ? '摆角大于 10°！' : '');
        return out.filter(Boolean);
      },
    };
  },
};

// ================================================================ 酸碱中和滴定
const ACIDS = [['甲', 0.1000], ['乙', 0.0800], ['丙', 0.1250]];
const V0S = [0.00, 0.35, 0.80, 0.10];
export const titration = {
  id: 'chem-titration', subject: 'chem', title: '强酸与强碱的中和滴定', en: 'Acid–base titration',
  lede: ['锥形瓶里是 20.00 mL 不知道浓度的盐酸，滴了两滴酚酞。碱式滴定管里是 0.1000 mol/L 的氢氧化钠标准溶液。', '一滴一滴加进去，直到最后半滴让溶液从无色变成浅红，并且半分钟不褪色。读出用掉的体积，就能算出盐酸的浓度。'],
  formula: 'c(酸)·V(酸) = c(碱)·V(碱)', formulaNote: '恰好中和时，酸提供的 H⁺ 与碱提供的 OH⁻ 物质的量相等；V(碱) = 末读数 − 初读数',
  terms: [['滴定终点', '指示剂恰好变色、半分钟不恢复的那一刻。'], ['读数', '滴定管 0 刻度在上；视线与凹液面最低处相平，估读到 0.01 mL。'], ['pH 突跃', '终点附近 pH 的急剧变化。']],
  predict: { q: '快到终点时，多加一滴氢氧化钠（约 0.05 mL），溶液的 pH 会？', options: ['只变一点点，和之前差不多', '一下子跳好几个单位', '反而降低'], answer: 1, why: '接近终点时溶液里剩下的 H⁺ 已经极少，一滴碱就足以把它们全部中和并过量，pH 会从 4 左右直接跳到 10 左右。所以终点前必须逐滴加。' },
  challenge: '同一瓶盐酸平行滴定三次，三次用量相差不超过 0.10 mL。',
  fig: '铁架台与滴定管夹、碱式滴定管、锥形瓶与白瓷板；右：读数放大与 pH 曲线', hint: '先快滴，瓶里出现一闪而过的红色时改成逐滴。',
  teach: {
    ask: ['“快速”一路滴到变色，算出来的浓度偏大还是偏小？为什么？', '读末读数时仰视，记下的体积偏大还是偏小？对结果有什么影响？', '如果改用甲基橙作指示剂，终点的颜色变化是什么？'],
    simplify: '强酸强碱、25 ℃，pH 由物料守恒与水的离子积精确计算；一滴按 0.05 mL 计。读数按凹液面最低处给出，估读到 0.01 mL。接近终点时滴落处“局部变红、摇匀后褪去”是示意。不模拟润洗、气泡、挂液等操作误差。',
    safety: '氢氧化钠有腐蚀性，须戴护目镜；滴定管使用前要检漏、润洗、赶走尖嘴处的气泡。',
  },
  controls: [
    { id: 'rate', type: 'choice', label: '滴速', options: ['关', '逐滴', '快速'], value: 0 },
    { id: 'acid', type: 'choice', label: '待测盐酸', options: ACIDS.map((a) => a[0]), value: 0 },
    { id: 'drop', type: 'button', label: '滴一滴' }, { id: 'half', type: 'button', label: '半滴' }, { id: 'log', type: 'button', label: '读数并记录' }, { id: 'reset', type: 'button', label: '换一瓶重来' },
  ],
  record: {
    title: '滴定记录',
    note: '到终点后按“读数并记录”，把初读数、末读数记成一行。同一瓶盐酸做三次平行实验，取平均。',
    columns: [
      { key: 'acid', label: '盐酸' }, { key: 'v0', label: '初读数', unit: 'mL', digits: 2 }, { key: 'v1', label: '末读数', unit: 'mL', digits: 2 },
      { key: 'dv', label: 'V(NaOH)', unit: 'mL', digits: 2, stat: true }, { key: 'c', label: 'c(HCl)', unit: 'mol/L', digits: 4, stat: true },
    ],
    sample: (inst) => inst.reading?.(), pending: '还没到终点，或这一次已经记过了。',
    summary(rows) {
      if (!rows.length) return [];
      const acid = rows[rows.length - 1].acid, mine = rows.filter((r) => r.acid === acid).map((r) => r.dv);
      const spread = Math.max(...mine) - Math.min(...mine), truth = ACIDS.find((a) => a[0] === acid)[1];
      const mean = mine.reduce((a, b) => a + b, 0) / mine.length, c = 0.1 * mean / 20;
      return [['平行性', mine.length < 2 ? `盐酸${acid}只滴了 1 次，至少再做 2 次。` : `盐酸${acid}共 ${mine.length} 次，极差 ${spread.toFixed(2)} mL${spread > 0.2 ? '，相差过大，应舍去离群的一次重做' : '，可以取平均'}。`],
        ['结果', `盐酸${acid}：平均用量 ${mean.toFixed(2)} mL，c = ${c.toFixed(4)} mol/L；配制值 ${truth.toFixed(4)}，相对偏差 ${(Math.abs(c - truth) / truth * 100).toFixed(2)}%`]];
    },
    errors: ['滴过终点（溶液深红）：V(NaOH) 偏大，c(HCl) 偏大。', '读数：仰视读数偏大、俯视偏小；初末读数的视线要一致。', '滴定管没用标准液润洗：标准液被稀释，用量偏大，结果偏大。', '锥形瓶用待测液润洗：酸变多，结果偏大（锥形瓶只用蒸馏水洗）。'],
  },
  build(k) {
    const p = k.p, X = -1.55, Z = -0.9, MLU = 0.085;                  // 每毫升在滴定管上的长度
    const B0 = 7.35, TIP = 2.42;                                       // 0 刻度的高度、尖嘴出口高度
    // 铁架台、滴定管夹（蝴蝶夹）
    const st = at(retort(7.9, { w: 3.3, d: 2.5 }), X - 0.65, 0, Z); st.boss(5.4);
    const px = X - 0.65 + st.postX;
    k.root.add(st, rod([px, 5.4, Z], [X - 0.24, 5.4, Z], 0.06, STEEL));
    for (const s of [-1, 1]) k.root.add(rod([X - 0.3, 5.4, Z], [X + 0.02, 5.4, Z + s * 0.22], 0.04, STEEL), at(box(0.1, 0.34, 0.07, '#3c4650'), X + 0.05, 5.23, Z + s * 0.2));
    // 白瓷板 + 锥形瓶
    k.root.add(at(solid(new THREE.BoxGeometry(2.3, 0.1, 2.1).translate(0, 0.05, 0), '#ffffff', { kind: 'ceramic' }), X + 0.15, 0.18, Z));
    const flask = at(vessel([[0, 0], [0.96, 0], [1.04, 0.07], [1.04, 0.16], [0.36, 1.5], [0.33, 1.62], [0.33, 2.06], [0.4, 2.14]], { color: '#eaf4ff', opacity: 0.4, wall: 0.04 }), X, 0.3, Z);
    const blush = glow(C.rose, 1.2, 0), halo = glow(C.rose, 3.4, 0);
    flask.add(at(blush, 0, 0.5, 0), at(halo, 0, 0.45, 0));
    // 碱式滴定管：玻璃管 + 刻度 + 乳胶管（内有玻璃珠）+ 尖嘴
    const TOP = B0 + 0.55, BOT = B0 - 50 * MLU - 0.25;
    const bur = at(vessel([[0, 0], [0.05, 0.02], [0.105, 0.2], [0.105, TOP - BOT]], { color: C.sky, opacity: 0.55, wall: 0.022, seg: 28 }), X, BOT, Z);
    const marks = at(sheet(0.36, 50 * MLU + 0.2, (x, s, w, h) => {
      x.strokeStyle = C.ink; x.fillStyle = C.ink; x.textBaseline = 'middle'; x.textAlign = 'left';
      for (let i = 0; i <= 50; i++) {
        const y = (0.1 + i * MLU) * s, big = i % 10 === 0, mid = i % 5 === 0;
        x.lineWidth = s * (big ? 0.012 : 0.007);
        x.beginPath(); x.moveTo((w / 2 - (big ? 0.11 : mid ? 0.085 : 0.06)) * s, y); x.lineTo((w / 2 + (big ? 0.11 : mid ? 0.085 : 0.06)) * s, y); x.stroke();
        if (big) { x.font = `${s * 0.085}px Georgia,serif`; x.fillText(String(i), (w / 2 + 0.115) * s, y); }
      }
    }), X + 0.0, B0 - 25 * MLU, Z + 0.135);
    const hose = at(cyl(0.085, 0.36, '#c9a27c', { seg: 16 }), X, BOT - 0.36, Z), bead = at(ball(0.07, '#eef4f2'), X, BOT - 0.18, Z);
    const tip = at(lathe([[0.02, 0], [0.035, 0.05], [0.06, 0.3], [0.06, 0.36]], '#eef4f2', { kind: 'ceramic', seg: 16 }), X, BOT - 0.72, Z);
    k.root.add(flask, bur, marks, hose, bead, tip);
    const drop = flat(new THREE.SphereGeometry(0.055, 12, 10), C.sky, { opacity: 0.85 }); drop.visible = false;
    k.root.add(drop);
    // 读数放大镜：把液面附近 1 mL 的刻度放大，按凹液面最低处读数
    let rv = -1;
    const lens = at(sheet(2.3, 2.3, () => {}, { lay: 'tilt', opaque: false }), 2.35, 0, 1.25);
    const ring = at(rot(torus(1.1, 0.045, BRASS), Math.PI / 2 - 0.8, 0, 0), 2.35, 0, 1.25);
    ring.position.y += Math.cos(0.8) * 1.15; ring.position.z -= Math.sin(0.8) * 1.15;
    const drawLens = (V) => lens.redraw((x, s, w, h) => {
      const c = w / 2 * s, r = 1.06 * s, ppm = 1.5 * s;        // 每毫升的像素
      x.save(); x.beginPath(); x.arc(c, c, r, 0, TAU); x.clip();
      x.fillStyle = '#fffdf6'; x.fillRect(0, 0, w * s, h * s);
      const x0 = c - 0.42 * s, x1 = c + 0.42 * s, yv = c;       // 管壁、液面所在的屏幕高度
      x.fillStyle = 'rgba(58,156,255,.5)'; x.beginPath(); x.moveTo(x0, yv - 0.04 * s);
      x.quadraticCurveTo(c, yv + 0.07 * s, x1, yv - 0.04 * s); x.lineTo(x1, h * s); x.lineTo(x0, h * s); x.closePath(); x.fill();
      x.strokeStyle = C.ink; x.lineWidth = s * 0.022; x.beginPath(); x.moveTo(x0, 0); x.lineTo(x0, h * s); x.moveTo(x1, 0); x.lineTo(x1, h * s); x.stroke();
      x.fillStyle = C.ink; x.textBaseline = 'middle'; x.textAlign = 'left';
      for (let i = Math.floor((V - 1) * 10); i <= Math.ceil((V + 1) * 10); i++) {
        if (i < 0 || i > 500) continue;
        const y = yv + 0.032 * s + (i / 10 - V) * ppm, big = i % 10 === 0, mid = i % 5 === 0, l = big ? 0.4 : mid ? 0.28 : 0.18;
        x.lineWidth = s * (big ? 0.02 : 0.011);
        x.beginPath(); x.moveTo(c - l * s, y); x.lineTo(c + l * s, y); x.stroke();
        if (big) { x.font = `600 ${s * 0.2}px Georgia,serif`; x.fillText(String(i / 10), x1 + 0.08 * s, y); }
      }
      x.setLineDash([s * 0.05, s * 0.04]); x.strokeStyle = C.copper; x.lineWidth = s * 0.016;
      x.beginPath(); x.moveTo(0, yv + 0.032 * s); x.lineTo(x0 - 0.04 * s, yv + 0.032 * s); x.stroke(); x.setLineDash([]);
      x.fillStyle = C.copper; x.font = `italic ${s * 0.13}px Georgia,serif`; x.textAlign = 'left'; x.fillText('视线', 0.12 * s + c - r, yv - 0.1 * s);
      x.restore();
    });
    const leader = strip(2, { color: BRASS, w: 0.02, opacity: 0.8 });
    const g = at(plot({ w: 3.9, h: 3.0, xr: [0, 30], yr: [0, 14], xl: 'V(NaOH) / mL', yl: 'pH' }), 2.5, 0, -2.9);
    const info = at(card('\n\n', { w: 4.5, size: 0.27, align: 'left' }), 2.0, 0, 3.6);
    k.root.add(lens, ring, leader, g, info);

    let V = 0, V0 = 0, run = 0, acc = 0, end = null, dy = -1, flash = 0, logged = false; const trace = [];
    const ca = () => ACIDS[p.acid][1];
    const pH = (v) => { const d = (ca() * 20 - 0.1 * v) / (20 + v); return -Math.log10((d + Math.sqrt(d * d + 4e-14)) / 2); };
    const draw = () => { g.clear().curve(trace, C.violet, 0.04); if (end !== null) g.dot(end, 8.2, C.rose); g.dot(V, pH(V), C.amber, 0.08).done(); };
    const add = (dv) => {
      if (V0 + V >= 49.5) return;
      V = +(V + dv).toFixed(3); const h = pH(V); trace.push([V, h]);
      if (end === null && h >= 8.2) end = V;
      if (h < 8.2 && V > ca() * 200 * 0.8) flash = 1;             // 快到终点：滴落处一闪而过的红
      dy = TIP; logged = false; draw();
    };
    const reset = () => { V = 0; V0 = V0S[run++ % V0S.length]; end = null; logged = false; trace.length = 0; trace.push([0, pH(0)]); k.set('rate', 0); draw(); };
    reset();
    return {
      press(id) {
        if (id === 'drop') add(0.05); else if (id === 'half') add(0.025); else if (id === 'reset') reset();
        else { const r = this.reading(); if (r) k.record(r); }
      },
      change(id) { if (id === 'acid') { run = 0; reset(); } },
      /** 此刻的读数。没到终点不记；到了终点，记的是“你停手时”的体积——滴过头就如实偏大 */
      reading() {
        if (end === null || logged) return null;
        logged = true;
        return { acid: ACIDS[p.acid][0], v0: V0, v1: V0 + V, dv: V, c: 0.1 * V / 20 };
      },
      update(dt) {
        if (p.rate && end !== null && V - end > 3) k.set('rate', 0);
        if (p.rate) { acc += dt * (p.rate === 1 ? 0.12 : 1.5); while (acc >= 0.05) { acc -= 0.05; add(0.05); } }
        const read = V0 + V;
        bur.fill(B0 - read * MLU - BOT + 0.0);
        const h = pH(V), pink = clamp((h - 8.2) / 1.8);
        flask.fill(0.34 + (20 + V) * 0.0125);
        flask.tint(new THREE.Color('#eaf4ff').lerp(new THREE.Color('#ff4fa3'), pink), lerp(0.36, 0.78, pink));
        halo.material.opacity = pink * 0.34;
        flash = Math.max(0, flash - dt * 1.6); blush.material.opacity = flash * 0.55 * (1 - pink);
        if (dy > 0.9) { dy -= dt * 6.5; drop.position.set(X, dy, Z); drop.visible = true; } else drop.visible = false;
        const lv = B0 - read * MLU;
        if (Math.abs(read - rv) > 0.004) { rv = read; drawLens(read); }
        leader.set([[X + 0.14, lv, Z + 0.1], [1.45, 1.6, 0.6]]);
        info.set(`读数 ${V0.toFixed(2)} → ${read.toFixed(2)} mL\nV(NaOH) = ${V.toFixed(2)} mL，pH = ${h.toFixed(2)}\n${end === null ? '酚酞：无色，未到终点' : V - end > 0.12 ? '已变红——滴过头了' : logged ? '已到终点，已记录' : '浅红，半分钟不褪：到终点'}`);
        this.s = { h, read };
      },
      margin() {
        const out = [`读数 ${(this.s?.read ?? 0).toFixed(2)} mL`, `已滴入 ${V.toFixed(2)} mL`, `pH = ${(this.s?.h ?? 1).toFixed(2)}`];
        if (end !== null) { const c = 0.1 * V / 20; out.push('c(HCl)', ' = 0.1000 × V / 20.00', ` = ${c.toFixed(4)} mol/L`, V - end > 0.12 ? '滴过头：结果偏大' : '恰在终点附近'); } else out.push('酚酞：无色', '还没到终点');
        return out;
      },
    };
  },
};

// ================================================================ 活字印刷
const TEXTS = ['学而不厌诲人不倦', '人而无信不知其可', '己所不欲勿施于人'];
const STEPS = [
  ['设板', '铁板上敷一层松脂、蜡和纸灰'],
  ['排字', '置铁范，密布字印，满铁范为一板'],
  ['炀之', '持就火炀之，药稍镕'],
  ['按平', '以一平板按其面，字平如砥'],
  ['刷墨', '在字面上刷墨'],
  ['覆纸', '覆纸，刷印'],
  ['揭纸', '揭起翻面：反字成了正字'],
  ['拆版', '再火令药镕，以手拂之，其印自落'],
];
export const printing = {
  id: 'his-type', subject: 'his', title: '活字印刷', en: 'Movable type',
  lede: ['北宋庆历年间，平民毕昇用胶泥刻字，一字一印，烧硬后排进铁范，就能印书。印完再用火一烤，字印落下，还能再用。这件事被沈括记在《梦溪笔谈》里。', '和整块雕刻的雕版相比，活字省的不是印一页的工夫，而是换一页时不必重新刻一整块版。'],
  formula: '字印：反字　→　印张：正字', formulaNote: '字印上的字左右相反，纸覆上去再揭开翻面，才是正的；竖排的行序在版上也要反过来',
  terms: [['雕版印刷', '把整页内容反刻在一块木板上。'], ['活字（活板）', '每字为一印，可以拆开重排。'], ['铁范', '围住字印的铁框，一范排满即为一板。']],
  predict: { q: '字印上刻的字是什么样子的？', options: ['和书上一样的正字', '左右相反的反字', '上下颠倒的字'], answer: 1, why: '印刷相当于盖印章：纸覆上去再揭开翻面，左右就对调了。所以字印必须刻成反字，竖排的行序在版上也是从左往右排，印出来才是从右往左读。' },
  challenge: '三句话各印一次，雕版和活字一共各要刻多少个字？为什么差得不算太多？',
  fig: '依《梦溪笔谈》所记工序复原：铁板、铁范、胶泥字印、字盘与印张', hint: '按“下一步”走一遍工序，看纸揭起翻面的那一下。',
  teach: {
    ask: ['只印一种书、印很多份，雕版和活字哪个更合算？印很多种书、每种印得少呢？', '活字印刷发明后，雕版在中国仍长期是主流，可能有哪些原因？（提示：汉字的数量、字印的管理）', '《梦溪笔谈》是沈括的记述而不是毕昇本人的记录。这对我们使用这条史料有什么影响？'],
    simplify: '工序按《梦溪笔谈·技艺》“活板”一条复原，用 8 个字的版面示意；字印、铁范的具体尺寸与工具形制没有实物留存，这里的造型是示意。“刻字数”只统计本页演示的三句话，真实印书需要数以万计的字印，常用字要备二十余枚。',
  },
  controls: [
    { id: 'text', type: 'choice', label: '', options: TEXTS.map((s) => `${s.slice(0, 4)}…`), value: 0, wide: true },
    { id: 'mode', type: 'choice', label: '版式', options: ['活字', '雕版'], value: 0 },
    { id: 'next', type: 'button', label: '下一步' }, { id: 'all', type: 'button', label: '连续演示' },
  ],
  inquiry: {
    note: '历史不做“实验”，而是用史料说话。这一页的装置是按一条史料复原的：先读原文，再判断哪些是史料里有的、哪些是今人的推测。',
    steps: [
      { key: 'evidence', label: '证据', prompt: '沈括《梦溪笔谈》卷十八“活板”条是怎样描述毕昇的方法的？请摘出与工序有关的句子。',
        hints: ['“庆历中，有布衣毕昇，又为活板。其法：用胶泥刻字，薄如钱唇，每字为一印，火烧令坚。”', '“若止印三二本，未为简易；若印数十百千本，则极为神速。”', '“每一字皆有数印，如‘之’‘也’等字，每字有二十余印，以备一板内有重复者。”'] },
      { key: 'explain', label: '解释', prompt: '依据上面的句子，活字相对雕版的优势在什么条件下才成立？装置里“累计刻字数”的变化支持你的解释吗？' },
      { key: 'compare', label: '比较', prompt: '比较两种说法：“活字印刷一发明就取代了雕版”与“活字发明后雕版长期仍是主流”。哪一种更有依据？还需要什么样的材料来验证？',
        hints: ['想一想：这条记载的作者是谁、离事件多远、有没有实物（字印、印本）可以互证。'] },
    ],
  },
  build(k) {
    const p = k.p, FX = -2.65, Z = -0.9, DX = 1.06, DZ = 1.04, TY = 0.26, TH = 0.5;
    const CX = 2.95, CZ = -1.2;                                         // 字盘
    // 铁板、药层、铁范
    const iron = '#bfc6cc';
    k.root.add(at(solid(new THREE.BoxGeometry(3.3, 0.14, 5.3).translate(0, 0.07, 0), iron, { kind: 'metal', roughness: 0.55 }), FX, 0, Z));
    const wax = at(flat(new THREE.BoxGeometry(2.5, 0.05, 4.5), '#e8c98a', { opacity: 0.9 }), FX, 0.2, Z);
    const frame = group(); for (const [w, d, ox, oz] of [[2.62, 0.1, 0, -2.3], [2.62, 0.1, 0, 2.3], [0.1, 4.7, -1.31, 0], [0.1, 4.7, 1.31, 0]]) frame.add(at(solid(new THREE.BoxGeometry(w, 0.42, d).translate(0, 0.21, 0), iron, { kind: 'metal', roughness: 0.5 }), ox, 0.14, oz));
    frame.position.set(FX, 0, Z);
    const heat = at(glow(C.flame, 5, 0), FX, 0.3, Z), board = at(box(2.5, 0.16, 4.5, '#ead9b8'), FX, 5, Z);
    board.visible = false;
    // 字盘：一格一格的木盘，备用字印放在里面
    const tray = group(at(box(3.0, 0.12, 3.6, '#e3cfa6'), 0, 0, 0));
    for (let i = 0; i <= 3; i++) tray.add(at(box(0.05, 0.3, 3.6, '#e3cfa6'), -1.475 + i * 0.983, 0.1, 0));
    for (let j = 0; j <= 3; j++) tray.add(at(box(3.0, 0.3, 0.05, '#e3cfa6'), 0, 0.1, -1.775 + j * 1.183));
    tray.position.set(CX, 0, CZ);
    // 刷子、纸、纸垛
    const brush = group(at(box(0.5, 0.2, 1.5, '#e3cfa6'), 0, 0.22, 0), at(flat(new THREE.BoxGeometry(0.44, 0.22, 1.4), '#2a2f36'), 0, 0.11, 0)); brush.visible = false;
    const paper = new THREE.Group(), leafP = box(2.5, 0.03, 4.5, '#fffdf6');
    const printed = sheet(2.5, 4.5, () => {}, {}); printed.rotation.x = Math.PI / 2; printed.position.y = -0.006; printed.visible = false;
    paper.add(leafP, printed);
    const pile = at(box(2.6, 0.16, 4.6, '#fffdf6'), CX, 0, 3.05);
    const info = at(card('\n', { w: 5.0, size: 0.28, align: 'left' }), FX + 1.3, 0, 3.6);
    const sorts = new THREE.Group(), blockG = new THREE.Group();
    k.root.add(wax, frame, heat, board, tray, brush, paper, pile, info, sorts, blockG);

    const stock = {}, plates = new Set(); let carved = 0, n = 0, step = 0, t = 1, auto = false, last = '', inked = 0;
    const slot = (i) => { const c = i < 4 ? 0 : 1, r = i % 4; return [FX + (c - 0.5) * DX, Z + (r - 1.5) * DZ]; };   // 版上：第一行在左（印出来在右）
    const home = (i) => [CX - 0.98 + (i % 3) * 0.983, CZ - 1.18 + Math.floor(i / 3) * 1.183];
    const makeSort = (ch) => {
      const g = group(box(0.94, TH, 0.94, '#e8d4b4'), at(box(0.8, 0.06, 0.8, '#e8d4b4'), 0, TH, 0));
      const glyph = at(note(ch, { size: 0.6, lay: 'flat', bold: true }), 0, TH + 0.066, 0); glyph.scale.x = -1;   // 反字
      const inkFace = at(flat(new THREE.PlaneGeometry(0.8, 0.8).rotateX(-Math.PI / 2), '#20262d', { opacity: 0 }), 0, TH + 0.064, 0);
      g.add(inkFace, glyph); g.ink = inkFace; g.glyph = glyph;
      return g;
    };
    const layout = () => {
      for (const g of [sorts, blockG]) { g.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); }); g.clear(); }
      const s = TEXTS[p.text], need = {};
      [...s].forEach((ch) => { need[ch] = (need[ch] || 0) + 1; });
      for (const ch in need) if ((stock[ch] || 0) < need[ch]) { carved += need[ch] - (stock[ch] || 0); stock[ch] = need[ch]; }
      plates.add(p.text);
      [...s].forEach((ch, i) => { const g = makeSort(ch); g.userData = { i }; (p.mode ? blockG : sorts).add(g); });
      if (p.mode) blockG.add(at(box(2.36, TH + 0.004, 4.36, '#e3cfa6'), 0, 0, 0));
      printed.redraw((x, S, w, h) => {
        x.fillStyle = '#1e2b36'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `600 ${S * 0.6}px "Songti SC","Noto Serif CJK SC",serif`;
        [...s].forEach((ch, i) => {
          const [sx, sz] = slot(i);
          x.save(); x.translate((w / 2 + (sx - FX)) * S, (h / 2 - (sz - Z)) * S); x.rotate(Math.PI); x.fillText(ch, 0, 0); x.restore();
        });
      });
      step = 0; t = 1; auto = false; inked = 0; printed.visible = false;
    };
    const go = () => { if (t < 1) return; step = step >= STEPS.length ? 1 : step + 1; t = 0; if (step === 1 && n) { printed.visible = false; inked = 0; } };
    return {
      press(id) { if (id === 'all') { auto = true; if (t >= 1) go(); } else { auto = false; go(); } },
      update(dt) {
        const key = `${p.text}|${p.mode}`; if (key !== last) { last = key; layout(); }
        const dur = [0, 0.7, 1.5, 1.2, 1.2, 1.2, 1.3, 1.9, 1.5][step] || 1;
        if (t < 1) { t = Math.min(1, t + dt / dur); if (t >= 1) { if (step === 6) n++; if (auto && step < STEPS.length) go(); else if (step >= STEPS.length) auto = false; } }
        const e = t * t * (3 - 2 * t), done = (s) => step > s || (step === s && t >= 1), at_ = (s) => (step === s ? e : step > s ? 1 : 0);
        wax.visible = step >= 1 && step <= 8; wax.material.opacity = 0.9 * (step === 1 ? e : 1);
        frame.visible = step >= 2 || p.mode === 1;
        // 排字：字印从字盘飞进铁范（雕版：整块版放上去）
        const a2 = at_(2), out = at_(8);
        sorts.children.forEach((g) => {
          const i = g.userData.i, [sx, sz] = slot(i), [hx, hz] = home(i);
          const u = clamp((a2 * 1.6 - i * 0.075) / 1) * (1 - clamp(out * 1.6 - i * 0.075)), uu = u * u * (3 - 2 * u);
          g.position.set(lerp(hx, sx, uu), lerp(0.12, TY, uu) + Math.sin(uu * Math.PI) * 1.3, lerp(hz, sz, uu));
          g.ink.material.opacity = inked * 0.92;
        });
        blockG.position.set(lerp(CX, FX, a2 * (1 - out)), lerp(0.12, TY, a2 * (1 - out)) + Math.sin(a2 * (1 - out) * Math.PI) * 1.2, lerp(CZ, Z, a2 * (1 - out)));
        blockG.children.forEach((g) => { if (g.userData.i !== undefined) { const [sx, sz] = slot(g.userData.i); g.position.set(sx - FX, 0, sz - Z); g.ink.material.opacity = inked * 0.92; } });
        // 火、平板
        heat.material.opacity = (step === 3 ? Math.sin(e * Math.PI) : step === 8 ? Math.sin(Math.min(1, e * 2) * Math.PI) : 0) * 0.5;
        board.visible = step === 4; board.position.y = step === 4 ? lerp(4.2, TY + TH + 0.08, Math.sin(e * Math.PI) ** 0.6) : 5;
        // 刷墨
        brush.visible = step === 5;
        if (step === 5) { brush.position.set(FX, TY + TH + 0.1, Z - 2.0 + 4.0 * (0.5 - 0.5 * Math.cos(e * TAU))); inked = Math.max(inked, clamp(e * 2)); }
        if (step === 8 && t >= 1) inked = 0;
        // 覆纸 → 揭纸翻面：纸绕靠字盘一侧的长边翻过去，落在版的右边，印面朝上
        const edge = FX + 1.25, a6 = at_(6), a7 = at_(7);
        if (step < 6 || step > 8) { paper.visible = step > 8 ? false : false; }
        if (step === 6) { paper.visible = true; paper.rotation.set(0, 0, 0); paper.position.set(lerp(CX, FX, a6), lerp(0.4, TY + TH + 0.09, a6) + Math.sin(a6 * Math.PI) * 2.2, lerp(3.05, Z, a6)); if (t > 0.9) printed.visible = true; }
        if (step === 7 || step === 8) {
          paper.visible = true; printed.visible = true;
          const ang = a7 * Math.PI, yb = TY + TH + 0.09;
          paper.rotation.set(0, 0, -ang);
          paper.position.set(edge - Math.cos(ang) * 1.25, lerp(yb, 0.22, a7) + Math.sin(ang) * 1.25, Z);
        }
        info.set(step === 0 ? `${p.mode ? '雕版：整块木板，一页一版' : '活字：一字一印，可拆可排'}\n按“下一步”开始` : `第 ${step} 步 / 共 ${STEPS.length} 步 · ${STEPS[step - 1][0]}\n${STEPS[step - 1][1]}`);
        void done;
      },
      margin: () => ['累计要刻的字：', `雕版 ${plates.size * 8} 个`, `（${plates.size} 块版）`, `活字 ${carved} 个`, '（旧字印直接再用）', `已印 ${n} 张`, '版上是反字，', '行序也是反的'],
    };
  },
};
