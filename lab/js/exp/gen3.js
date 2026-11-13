// 第三代样板：一页单摆，一条定律的边界
// 纸就是时间。摆的下面是一条匀速走动的记录纸（教材里的“沙摆”画出振动图像，就是这个道理），
// 摆球的横向位置一笔一笔记在纸上，成为 x–t 图像。读者可以：
//   · 拖摆球改变初始条件，转摆线轮改摆长，拖公式里的数也一样；
//   · 抓住纸带往回推，时间倒流；往前拉，时间快进——摆精确地回到（或跑到）那一刻；
//   · 提起纸签，纸上的曲线升到摆球当时真实的高度，变成摆在时空中走过的路径；
//   · 同一根悬点下还挂着一只“公式的摆”（铜色铅笔线），它严格按 T = 2π√(l/g) 运动。
//     小角度时两只摆重合；拉到大角度，两条记录在纸上慢慢分开——公式的前提被打破的样子，看得见。
// 物理：完整模型 θ″ = −(g/l)·sinθ − γθ′，RK4 定步长积分；公式的世界 θ″ = −(g/l)·θ（小角、无阻尼）。
import { C, TAU, clamp, group, at, rot, box, cyl, solid, flat, glass, note, sheet, dimension, torus, arrow, THREE } from '../ink.js';
import { Timeline } from '../gen3/timeline.js';
import { recorder } from '../gen3/tape.js';
import { scrubbable } from '../gen3/scrub.js';
import { KIND, periodFactor, DEG, rng, gauss } from '../gen3/know.js';

const STEEL = '#cfd6dc', BRASS = '#d9b36a';
const PLACES = [['地球', 9.80], ['月球', 1.62], ['木星', 24.8]];
const S = 3.2, XC = -0.15, ZP = -2.55, PY = 4.85, R = 0.26;   // 每米多少书本单位；装置中心；悬点
const H = 1 / 240, DT = 1 / 120, TAPE_V = 1.0;                // 积分步长；记录间隔；走纸速度（书本单位/秒）
const LMIN = 0.3, LMAX = 1.2, AMAX = 75 * DEG;
// 公式误差刚好 1% 的摆角（二分求解 2K(sin(θ/2))/π = 1.01，约 22.8°）
const A1PCT = (() => { let lo = 0, hi = Math.PI / 2; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (periodFactor(m) < 1.01) lo = m; else hi = m; } return lo; })();
const fmtDeg = (a) => `${(Math.abs(a) / DEG).toFixed(Math.abs(a) < 10 * DEG ? 1 : 0)}°`;

export const pendulum = {
  id: 'phy-pendulum', subject: 'phy', title: '单摆：一条定律的边界', en: 'The pendulum, and where its law ends',
  lede: ['公式说：周期与摆得多高无关——在它的前提之内。摆下的纸带匀速走动，把运动记成曲线；拉大摆角，看公式与完整的物理何时分道扬镳。'],
  formula: 'T = 2π √(l / g)', formulaNote: '周期 = 2π × √(摆长 ÷ 重力加速度)；摆角很小时成立',
  law: { html: '' },
  figure: { h: 106, caption: '<b>图 a</b>周期与摆角。在图上按住拖动，就把摆拉到那个角度；松开即释放。' },
  terms: [],
  predict: { q: '把摆拉到 60° 再放手。用 T = 2π√(l/g) 算出的周期，和摆真正的周期相比？', options: ['公式算得偏长', '公式算得偏短', '一样，周期与摆角无关'], answer: 1, why: '摆角大时，真正把摆拉回来的力是 mg·sinθ，比公式默认的 mg·θ 小（60° 时小约 17%）。回复力弱，摆回来就慢，真实周期比公式长约 7%。摆角小于 5° 时二者相差不到 0.05%——“等时性”只在小角度下成立。' },
  challenge: '找出公式误差刚好到 1% 的摆角；再到月球上试一次，这个角度变不变？',
  fig: '走纸记录仪上的单摆：纸带就是时间轴', hint: '拖摆球放手；抓住纸带前后拉动时间；提起纸签 ↑ 曲线立成时空路径；点秒表亲手计时。',
  teach: {
    ask: ['从纸带上读出公式的摆和真实的摆每一周差多少？摆角 10°、30°、60° 各是多少？', '为什么回复力 mg·sinθ 比 mg·θ 小，就会让周期变长？用纸带上的曲线说明。', '在月球上，误差 1% 对应的摆角会变吗？为什么？（看公式：误差只与 θ₀ 有关）', '木球的振幅一直在变小，它的周期也在变吗？在纸带上找证据。'],
    simplify: '大摆角周期 T = T₀·2K(sin ½θ₀)/π 中 K 为第一类完全椭圆积分（用算术–几何平均计算）。完整模型：θ″ = −(g/l)·sinθ − γθ′，四阶龙格–库塔法，步长 1/240 s；线无质量、不伸长，摆球视为质点，空气阻力只取与速度成正比的一项（木球 γ = 0.035 s⁻¹，铁球 0.012 s⁻¹）。公式的摆：θ″ = −(g/l)·θ − γθ′——与完整模型只差 sinθ → θ 这一处，所以纸上两条曲线的分离全部来自“小角近似”（相同的阻尼只让振幅变小，周期 2π/√(g/l − γ²/4) 与 2π√(l/g) 相差不到十万分之一）。图 a 的“完整模型”曲线是无阻尼大角周期的精确解 T = T₀·2K(sin(θ₀/2))/π（K 为第一类完全椭圆积分）。“模拟按表”给读数叠加标准差 0.1 s 的随机误差；“你的计时”用的是你真实的反应时间，次数按你数对计算。纸带速度 1 书本单位/秒（示意比例）。模拟计时期间以 4 倍速播放。',
    safety: '真实实验中摆角应小于约 5°，摆球在同一竖直平面内摆动；铁架台放稳，下方不放易碎物。',
  },
  controls: [
    { id: 'place', type: 'choice', label: '在', options: PLACES.map((x) => x[0]), value: 0 },
    { id: 'bob', type: 'choice', label: '摆球', options: ['木球', '铁球'], value: 0 },
    { id: 'n', type: 'choice', label: '模拟按表连测', options: ['1 次', '10 次', '30 次'], value: 1, wide: true },
  ],
  record: {
    title: '测量记录',
    note: '“记录一组”用模拟的手按表（读数含 ±0.1 s 的随机误差）；点装置上的秒表则是你亲手计时（真实的反应时间）。两种来源分开标注。',
    columns: [
      { key: 'who', label: '计时' }, { key: 'place', label: '地点' }, { key: 'l', label: '摆长 l', unit: 'm', digits: 2 }, { key: 'amp', label: '摆角 θ₀', unit: '°', digits: 1 },
      { key: 'n', label: 'N', digits: 0 }, { key: 't', label: '总时间 t', unit: 's', digits: 2 }, { key: 'T', label: '周期 T', unit: 's', digits: 3 }, { key: 'g', label: 'g', unit: 'm/s²', digits: 2, stat: true },
    ],
    sample: (inst) => inst.measure?.(), pending: '模拟的秒表已经开始：从摆球经过最低点起数满 N 次全振动，自动记成一行。',
    summary(rows) {
      const out = [], here = rows.filter((r) => r.place === rows[rows.length - 1]?.place && r.amp < 10);
      const ls = [...new Set(here.map((r) => r.l))];
      if (ls.length >= 3) {
        const xs = here.map((r) => r.l), ys = here.map((r) => r.T * r.T), n = xs.length;
        const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
        const k = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
        out.push(['图像法', `${here[0].place}（摆角 < 10° 的组）：T²–l 斜率 k = ${k.toFixed(3)} s²/m，g = 4π²/k = ${(4 * Math.PI ** 2 / k).toFixed(2)} m/s²`]);
      } else out.push(['图像法', '在摆角小于 10° 时换至少三个摆长，就能用 T²–l 图线的斜率求 g。']);
      const big = rows.filter((r) => r.amp >= 15);
      if (big.length) out.push(['摆角的影响', `摆角 ≥ 15° 的 ${big.length} 组：按公式算出的 g 系统偏小——这不是手的误差，是公式的前提不成立。`]);
      return out;
    },
    errors: ['按表的反应时间：每次约 ±0.1 s，N 越大摊得越薄。', '摆角过大：真实周期比公式长，g 偏小（系统误差，多测几次也消不掉）。', '把线长当摆长（漏了球半径）：l 偏小，g 偏小。', '数错全振动次数：多数一次，T 偏小，g 偏大。'],
  },

  build(k) {
    const p = k.p, mem = k.memory, rand = rng(20261113);
    if (p.l === undefined) p.l = 0.8;
    if (p.gv === undefined) p.gv = PLACES[p.place ?? 0][1];
    const gam = () => (p.bob ? 0.012 : 0.035);

    // ================================================================ 装置：走纸记录仪的门架
    const POST = 4.55;
    for (const sx of [-1, 1]) {
      const x = XC + sx * POST;
      k.root.add(at(box(0.62, 0.14, 1.5, '#d8dde1'), x, 0, ZP));
      k.root.add(at(cyl(0.085, PY + 0.25, STEEL, { seg: 20 }), x, 0.14, ZP));
      k.root.add(at(cyl(0.15, 0.12, STEEL, { seg: 20 }), x, 0.14, ZP));
    }
    k.root.add(at(rot(cyl(0.075, POST * 2 + 0.3, STEEL, { seg: 18 }), 0, 0, Math.PI / 2), XC + POST + 0.15, PY + 0.2, ZP));
    // 悬点：两片夹板夹住摆线（悬点必须夹死）
    k.root.add(at(box(0.42, 0.34, 0.1, BRASS), XC, PY - 0.08, ZP + 0.07), at(box(0.42, 0.34, 0.1, BRASS), XC, PY - 0.08, ZP - 0.07));
    // 绕线轮：转动改变摆长
    const drum = group(solid(new THREE.CylinderGeometry(0.26, 0.26, 0.16, 32).rotateX(Math.PI / 2), BRASS, { kind: 'metal' }),
      ...[0, 1, 2, 3].map((i) => rot(box(0.05, 0.4, 0.04, C.ink), 0, 0, i * Math.PI / 4)));
    drum.children.slice(1).forEach((m) => { m.geometry.translate(0, -0.2, 0.09); });
    drum.position.set(XC + 0.62, PY + 0.2, ZP + 0.12);
    // 看不见、但抓得到的把手：比轮子大一圈，手指好按
    const drumGrip = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), new THREE.MeshBasicMaterial({ visible: false })); drumGrip.layers.set(1);
    drum.add(drumGrip);
    const drumNote = at(note('转轮 · 改摆长', { size: 0.24, w: 2.0 }), XC + 1.75, PY + 0.62, ZP + 0.1);
    k.root.add(drum, drumNote);

    // ================================================================ 记录纸带
    // sf：公式的摆在纸上画过的路程（虚线按路程分段，陡的地方也匀称）
    const tl = new Timeline(['th', 'om', 'thf', 'omf', 'sf', 'l', 'held'], { dt: DT, span: 45 });
    let sf = 0;
    const tmp = {};
    const bobXY = (th, l) => [XC + Math.sin(th) * l * S, PY - Math.cos(th) * l * S];
    let view = 0;                     // 正在看的时刻（拖纸带时 ≠ 模拟到的时刻）
    const tape = recorder({
      width: 8.3, z0: ZP, z1: 4.45, speed: TAPE_V, tickClear: 0.75, lineR: 0.045, printW: 0.07,
      traces: [
        { kind: 'model', dropEvery: 0.2, dropOpacity: 0.26, fn: (t) => (t > view + 1e-9 || !tl.at(t, tmp) ? null : bobXY(tmp.th, tmp.l)) },
        { kind: 'theory', lineR: 0.026, drops: false, fn: (t) => (t > view + 1e-9 || !tl.at(t, tmp) ? null : [...bobXY(tmp.thf, tmp.l), tmp.sf]) },
      ],
    });
    tape.position.x = XC;
    // 纸带的 fn 用的是装置坐标：整条纸带平移了 XC，这里抵消回来
    tape.traces.forEach((T) => { const f = T.o.fn; T.o.fn = (t) => { const q = f(t); if (q) q[0] -= XC; return q; }; });
    k.root.add(tape);
    // 纸带近端：笔法图例 + 提起时空路径的纸签
    const legend = sheet(3.7, 0.72, (x, s) => {
      x.lineCap = 'round';
      x.strokeStyle = KIND.model.color; x.lineWidth = s * 0.05; x.beginPath(); x.moveTo(0.08 * s, 0.2 * s); x.lineTo(0.62 * s, 0.2 * s); x.stroke();
      x.strokeStyle = KIND.theory.color; x.setLineDash([s * 0.13, s * 0.09]); x.beginPath(); x.moveTo(0.08 * s, 0.53 * s); x.lineTo(0.62 * s, 0.53 * s); x.stroke(); x.setLineDash([]);
      x.textBaseline = 'middle'; x.font = `${s * 0.19}px "Songti SC","Noto Serif CJK SC",serif`;
      x.fillStyle = KIND.model.color; x.fillText('真实的摆 · 完整模型（数值积分）', 0.76 * s, 0.2 * s);
      x.fillStyle = KIND.theory.color; x.fillText('公式的摆 · 小角近似 T=2π√(l/g)', 0.76 * s, 0.53 * s);
    }, { lay: 'flat' });
    legend.position.set(XC - 2.15, 0.05, 4.05);
    k.root.add(legend);
    const tab = group(
      at(solid(new THREE.BoxGeometry(1.25, 0.62, 0.03).translate(0, 0.31, 0), '#f4ead2'), 0, 0, 0),
      at(rot(torus(0.08, 0.022, BRASS), Math.PI / 2, 0, 0), 0, 0.64, 0),
      at(note('提起 ↑ 时空', { size: 0.22, w: 1.2 }), 0, 0.31, 0.03),
    );
    tab.rotation.x = -0.25;
    k.root.add(tab);
    // 记录笔：摆球正下方落在纸上的那一点
    const pen = flat(new THREE.CircleGeometry(0.07, 16).rotateX(-Math.PI / 2), C.copper);
    const plumbG = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const plumb = new THREE.Line(plumbG, new THREE.LineDashedMaterial({ color: C.copper, dashSize: 0.1, gapSize: 0.08, transparent: true, opacity: 0.7 }));
    plumb.layers.set(1); plumb.frustumCulled = false;
    k.root.add(pen, plumb);

    // ================================================================ 两只摆
    const str = solid(new THREE.CylinderGeometry(0.016, 0.016, 1, 6).translate(0, 0.5, 0), C.ink); str.castShadow = true;
    const mkBob = (color, kind) => group(solid(new THREE.SphereGeometry(R, 40, 24), color, { kind, roughness: kind === 'metal' ? 0.28 : 0.6 }), at(rot(torus(0.045, 0.014, STEEL), Math.PI / 2, 0, 0), 0, R + 0.03, 0));
    const bobs = [mkBob('#e3cfa6', 'wood'), mkBob('#bfc6cc', 'metal')];
    // 公式的摆：只有轮廓的铅笔线（理论 = 画出来的，模型 = 实体）
    const gStr = flat(new THREE.CylinderGeometry(0.011, 0.011, 1, 5).translate(0, 0.5, 0), C.copper, { opacity: 0.85 });
    const gBob = group(glass(new THREE.SphereGeometry(R * 0.98, 32, 18), { color: 0xf3d9c4, opacity: 0.1 }), flat(new THREE.SphereGeometry(R * 0.35, 12, 8), C.copper, { opacity: 0.5 }));
    // 回复力：真实的 mg·sinθ（墨）与公式默认的 mg·θ（铜）
    const fTrue = arrow(C.ink, 0.03), fForm = arrow(C.copper, 0.03);
    const fNote = note('mg·sinθ（真实）\nmg·θ（公式默认）\n差 100%', { size: 0.22, w: 2.7, align: 'left' });
    const dim = dimension({ w: 1.6, size: 0.26 });
    k.root.add(str, ...bobs, gStr, gBob, fTrue, fForm, fNote, dim);
    const Y_ = new THREE.Vector3(0, 1, 0), dv = new THREE.Vector3();
    const span = (m, a, b) => { dv.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const len = Math.max(1e-4, dv.length()); m.position.set(...a); m.scale.set(1, len, 1); m.quaternion.setFromUnitVectors(Y_, dv.divideScalar(len)); };

    // ================================================================ 秒表：挂在门架横梁上，点一下开始，再点一下停
    const watch = new THREE.Group();
    watch.add(solid(new THREE.CylinderGeometry(0.6, 0.6, 0.16, 48).rotateX(Math.PI / 2), STEEL, { kind: 'metal' }));
    watch.add(at(solid(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 14), STEEL, { kind: 'metal' }), 0, 0.68, 0), at(rot(torus(0.09, 0.022, STEEL), Math.PI / 2, 0, 0), 0, 0.82, 0));
    let wtxt = null, wang = -1, wsub = '';
    const face = sheet(1.12, 1.12, () => {}, {});
    const drawFace = () => face.redraw((x, s, w) => {
      const c = w / 2 * s;
      x.fillStyle = '#fffdf6'; x.beginPath(); x.arc(c, c, 0.54 * s, 0, TAU); x.fill();
      x.strokeStyle = C.ink; x.lineCap = 'round';
      for (let i = 0; i < 60; i++) { const a = i / 60 * TAU, l = i % 5 === 0 ? 0.07 : 0.035; x.lineWidth = s * (i % 5 === 0 ? 0.012 : 0.006); x.beginPath(); x.moveTo(c + Math.sin(a) * 0.5 * s, c - Math.cos(a) * 0.5 * s); x.lineTo(c + Math.sin(a) * (0.5 - l) * s, c - Math.cos(a) * (0.5 - l) * s); x.stroke(); }
      x.fillStyle = C.ink; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = `600 ${s * 0.17}px Georgia,serif`; x.fillText(wtxt, c, c + 0.2 * s);
      x.font = `${s * 0.085}px "Songti SC","Noto Serif CJK SC",serif`; x.fillStyle = C.copper; x.fillText(wsub, c, c - 0.2 * s);
      x.strokeStyle = C.red; x.lineWidth = s * 0.013; x.beginPath(); x.moveTo(c - Math.sin(wang) * 0.08 * s, c + Math.cos(wang) * 0.08 * s); x.lineTo(c + Math.sin(wang) * 0.44 * s, c - Math.cos(wang) * 0.44 * s); x.stroke();
      x.fillStyle = C.ink; x.beginPath(); x.arc(c, c, 0.025 * s, 0, TAU); x.fill();
    });
    face.position.z = 0.085; watch.add(face);
    // 秒表夹在右立柱上
    watch.position.set(XC + POST, 3.1, ZP + 0.72); watch.rotation.x = -0.12; watch.scale.setScalar(0.9);
    const hanger = at(rot(cyl(0.05, 0.62, STEEL, { seg: 8 }), Math.PI / 2, 0, 0), XC + POST, 3.1, ZP + 0.05);
    const watchNote = at(note('点我计时', { size: 0.22, w: 1.4 }), XC + POST - 0.1, 3.95, ZP + 0.75);
    k.root.add(watch, hanger, watchNote);

    // ================================================================ 状态与积分
    let kk = 0, th = 35 * DEG, om = 0, thf = th, omf = 0, held = false, view0 = 0;
    let peekL = 0, peekT = mem.peeked ? -1 : 0;
    let lift = 0, liftGoal = 0, liftHeld = false, scrub = null, flash = 0, awayNote = '';
    let amp = Math.abs(th), relAt = 0, relAmp = amp, T = 0, lastCross = null;
    const crosses = [];
    let timing = 0, cnt = 0, tStart = 0, shown = 0, lastRow = null, human = null;   // timing: 0 闲 1 等过零 2 模拟计数
    const deriv = (a, w, g, l, gm) => -(g / l) * Math.sin(a) - gm * w;
    const step = () => {
      const g = p.gv, l = p.l, gm = gam();
      if (held) { om = 0; thf = th; omf = 0; sf += H * TAPE_V; }
      else {
        // 完整模型：RK4
        const k1a = om, k1w = deriv(th, om, g, l, gm);
        const k2a = om + k1w * H / 2, k2w = deriv(th + k1a * H / 2, om + k1w * H / 2, g, l, gm);
        const k3a = om + k2w * H / 2, k3w = deriv(th + k2a * H / 2, om + k2w * H / 2, g, l, gm);
        const k4a = om + k3w * H, k4w = deriv(th + k3a * H, om + k3w * H, g, l, gm);
        const prev = th;
        th += (k1a + 2 * k2a + 2 * k3a + k4a) * H / 6; om += (k1w + 2 * k2w + 2 * k3w + k4w) * H / 6;
        // 公式的世界：θ″ = −(g/l)·θ − γθ′。和真实的摆只差一处：sinθ 换成了 θ（阻尼相同，只改变振幅，周期仍是 2π√(l/g)）
        const lin = (a, w) => -(g / l) * a - gm * w;
        const j1a = omf, j1w = lin(thf, omf);
        const j2a = omf + j1w * H / 2, j2w = lin(thf + j1a * H / 2, omf + j1w * H / 2);
        const j3a = omf + j2w * H / 2, j3w = lin(thf + j2a * H / 2, omf + j2w * H / 2);
        const j4a = omf + j3w * H, j4w = lin(thf + j3a * H, omf + j3w * H);
        const xf0 = Math.sin(thf) * l * S;
        thf += (j1a + 2 * j2a + 2 * j3a + j4a) * H / 6; omf += (j1w + 2 * j2w + 2 * j3w + j4w) * H / 6;
        sf += Math.hypot(Math.sin(thf) * l * S - xf0, H * TAPE_V);
        if (prev < 0 && th >= 0) {
          const tc = (kk + 1) * H - H * (th / (th - prev));
          if (lastCross !== null) T = tc - lastCross;
          lastCross = tc; crosses.push(tc); if (crosses.length > 400) crosses.shift();
          if (timing === 1) { timing = 2; tStart = tc; cnt = 0; }
          else if (timing === 2 && ++cnt >= N()) finishSim(tc - tStart);
        }
        amp = Math.max(Math.abs(th), amp * Math.exp(-gm * H / 2));
      }
      kk++;
      if (kk % 2 === 0) tl.push(kk / 2, { th, om, thf, omf, sf, l: p.l, held: held ? 1 : 0 });
    };
    const now = () => kk * H;
    const advanceTo = (t) => { const target = Math.round(t / H); let guard = 0; while (kk < target && guard++ < 240 * 120) step(); };
    const N = () => [1, 10, 30][p.n ?? 1];
    const release = (a) => {
      held = false; th = clamp(a, -AMAX, AMAX); om = 0; thf = th; omf = 0;
      amp = Math.abs(th); relAt = now(); relAmp = amp; lastCross = null; T = 0;
      if (timing === 2) timing = 0;
    };
    const finishSim = (tN) => {
      const n = N(), read = Math.max(0.05, tN + gauss(rand) * 0.1), Tm = read / n;
      lastRow = { who: '模拟按表', place: placeName(), l: p.l, amp: relAmp / DEG, n, t: read, T: Tm, g: 4 * Math.PI ** 2 * p.l / (Tm * Tm) };
      addPoint('simulated', relAmp, Tm, 0.1 / n);
      shown = read; timing = 0;
      k.record(lastRow);
    };
    const placeName = () => (PLACES.find((x) => Math.abs(x[1] - p.gv) < 1e-9)?.[0] ?? `g=${p.gv.toFixed(2)}`);
    const T0 = () => TAU * Math.sqrt(p.l / p.gv);
    mem.points ||= [];
    const addPoint = (kind, a, Tm, err) => { mem.points.push({ kind, a, r: Tm / T0(), e: err / T0() }); if (mem.points.length > 60) mem.points.shift(); figDirty = true; };

    // ---------------------------------------------------------------- 恢复：翻走之后回来，世界接着走
    if (mem.state) {
      ({ kk, th, om, thf, omf, sf, amp, relAt, relAmp } = mem.state);
      tl.restore(mem.tl); held = false;
      const away = Math.min(k.away, 120);
      if (away > 1) { advanceTo(now() + away); awayNote = `你离开的 ${Math.round(k.away)} 秒里，它一直在摆`; flash = 4; }
    } else {
      // 第一次打开：摆在 35° 刚松手，先走 2 秒，让纸上已经有一段记录
      tl.push(0, { th, om, thf, omf, sf, l: p.l, held: 0 });
      advanceTo(2.2);
    }
    view = now();

    // ================================================================ 交互
    const tmpS = {};
    const setState = (t) => {   // 把模拟拨到时刻 t（拖纸带后松手）
      tl.at(t, tmpS); tl.truncate(t);
      kk = Math.round(tmpS.t / H); th = tmpS.th; om = tmpS.om; thf = tmpS.thf; omf = tmpS.omf; sf = tmpS.sf; held = false;
      // 振幅由那一刻的能量反推：cos a = cos θ − ω²l/(2g)
      amp = Math.acos(clamp(Math.cos(th) - om * om * p.l / (2 * p.gv), -1, 1));
      relAt = Math.min(relAt, tmpS.t);
      while (crosses.length && crosses[crosses.length - 1] > tmpS.t) crosses.pop();
      lastCross = crosses.length ? crosses[crosses.length - 1] : null;
    };
    bobs.forEach((b) => k.drag(b.children[0], {
      start: () => { held = true; timing = 0; human = null; if (scrub) scrub = null; },
      move: (q) => { th = clamp(Math.atan2(q.x - XC, PY - q.y), -AMAX, AMAX); om = 0; },
      end: () => release(th),
    }));
    // 纸带：抓住拖动 = 拖动时间（往近处拉 = 让时间走，往远处推 = 倒回去）
    const grabTape = (m) => k.drag(m, {
      normal: 'y',
      start: () => { scrub = { z: null, t: view }; human = null; if (timing) timing = 0; },
      move: (q) => {
        if (!scrub) return;
        if (scrub.z === null) { scrub.z = q.z; return; }
        const t = Math.max(tl.t0, scrub.t + (q.z - scrub.z) / tape.speed);
        if (t > now()) advanceTo(Math.min(t, now() + 30));
        view = Math.min(t, now());
      },
      end: () => { if (scrub && view < now() - 1e-6) setState(view); scrub = null; view = now(); },
    });
    grabTape(tape.paper); tape.traces.forEach((T) => grabTape(T.line));
    // 纸签：往上提，曲线立起来
    k.drag(tab.children[0], {
      start: () => { liftHeld = true; },
      move: (q) => { lift = liftGoal = clamp((q.y - 0.2) / 3.2); },
      end: () => { liftHeld = false; liftGoal = lift > 0.35 ? 1 : 0; },
    });
    // 绕线轮：上下拖改摆长
    let drumY = null, drumL = 0;
    k.drag(drumGrip, {
      start: () => { drumY = null; drumL = p.l; },
      move: (q) => { if (drumY === null) { drumY = q.y; return; } setL(drumL - (q.y - drumY) / S); },
      end: () => { drumY = null; },
    });
    // 秒表：你亲手计时
    let tapT = 0;
    k.drag(watch.children[0], {
      start: () => { tapT = performance.now(); },
      end: () => {
        if (performance.now() - tapT > 600) return;
        if (!human) { human = { t: now() }; timing = 0; shown = 0; return; }
        const dur = now() - human.t, win = crosses.filter((c) => c >= human.t - 0.05 && c <= now() + 0.05);
        const Tt = win.length > 1 ? (win[win.length - 1] - win[0]) / (win.length - 1) : (T || T0());
        const n = Math.max(1, Math.round(dur / Tt)), Tm = dur / n;
        shown = dur; human = null;
        if (dur < 0.3) return;
        lastRow = { who: '你', place: placeName(), l: p.l, amp: amp / DEG, n, t: dur, T: Tm, g: 4 * Math.PI ** 2 * p.l / (Tm * Tm) };
        addPoint('human', amp, Tm, 0.15 / n);
        k.record(lastRow);
      },
    });
    const setL = (v) => { p.l = clamp(Math.round(v * 100) / 100, LMIN, LMAX); lawDirty = true; figDirty = true; lenT = 1.5; drawLaw(); k.dirty(); };
    let lenT = 0;

    // ================================================================ 左页：活的公式 + 定律的边界图
    let law = null, fig = null, figDirty = true, lawDirty = true;
    const bindPage = (leaf, _r, signal) => {
      const box = leaf.querySelector('[data-law]'), fc = leaf.querySelector('[data-fig]');
      if (box) {
        box.innerHTML = `<div class="f">T = 2π √( <span class="n" data-s="l"></span> / <span class="n" data-s="g"></span> )</div>
          <div class="row" data-r="calc"></div>
          <div class="conds">
            <span class="cond" data-c="a"><i>①</i><s>摆角很小，sinθ ≈ θ</s><em class="why"></em></span>
            <span class="cond" data-c="d"><i>②</i><s>没有空气阻力</s><em class="why"></em></span>
            <span class="cond" data-c="x"><i>③</i>线不伸长、摆球是质点 <em class="why" style="display:inline;color:var(--ink2)">（本页模型也这样假设）</em></span>
          </div>
          <div class="more" data-r="more"></div>`;
        const sl = box.querySelector('[data-s="l"]'), sg = box.querySelector('[data-s="g"]');
        const ls = scrubbable(sl, { get: () => p.l, set: setL, min: LMIN, max: LMAX, step: 0.01, px: 3, signal, label: '摆长 l，左右拖动改变' });
        const gs = scrubbable(sg, { get: () => p.gv, set: (v) => { p.gv = v; const i = PLACES.findIndex((x) => Math.abs(x[1] - v) < 1e-9); if (i >= 0) { p.place = i; } k.set('place', i >= 0 ? i : -1); lawDirty = figDirty = true; drawLaw(); k.dirty(); }, min: 1.0, max: 25, step: 0.01, px: 2, signal, label: '重力加速度 g，左右拖动改变' });
        law = { box, sl, sg, ls, gs, calc: box.querySelector('[data-r="calc"]'), more: box.querySelector('[data-r="more"]'), ca: box.querySelector('[data-c="a"]'), cd: box.querySelector('[data-c="d"]'), key: '' };
        lawDirty = true;
      }
      if (fc) {
        const cv = fc.querySelector('canvas');
        fig = { fc, cv, w: 0, h: 0 };
        // offsetX 是元素自身坐标（已经抵消了书页的透视变形）
        const pick = (e) => { const w = fc.clientWidth || 340, ox = e.target === fc || e.target === cv ? e.offsetX : 0; return Math.max(0.5 * DEG, clamp((ox - figBox.l) / (w - figBox.l - figBox.r)) * AMAX); };
        let down = false;
        fc.addEventListener('pointerdown', (e) => { e.preventDefault(); down = true; try { fc.setPointerCapture(e.pointerId); } catch {} held = true; timing = 0; human = null; th = pick(e); amp = th; figDirty = true; k.dirty(); }, { signal });
        fc.addEventListener('pointermove', (e) => { if (!down) return; th = pick(e); amp = th; figDirty = true; k.dirty(); }, { signal });
        const up = () => { if (!down) return; down = false; release(th); figDirty = true; };
        fc.addEventListener('pointerup', up, { signal }); fc.addEventListener('pointercancel', up, { signal });
        figDirty = true;
      }
    };
    const figBox = { l: 34, r: 10, t: 12, b: 26 };
    const YR = [0.985, 1.15];
    const drawFig = () => {
      if (!fig) return;
      const W = fig.fc.clientWidth || 340, Hh = fig.fc.clientHeight || 150, dpr = 3;
      if (fig.cv.width !== W * dpr || fig.cv.height !== Hh * dpr) { fig.cv.width = W * dpr; fig.cv.height = Hh * dpr; }
      const x = fig.cv.getContext('2d');
      x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, Hh);
      const L0 = figBox.l, R0 = W - figBox.r, T0p = figBox.t, B0 = Hh - figBox.b;
      const X = (a) => L0 + (a / AMAX) * (R0 - L0), Yv = (r) => B0 - ((r - YR[0]) / (YR[1] - YR[0])) * (B0 - T0p);
      // 1% 带
      x.fillStyle = 'rgba(31,74,62,.07)'; x.fillRect(L0, Yv(1.01), R0 - L0, Yv(0.99) - Yv(1.01));
      x.strokeStyle = 'rgba(30,43,54,.1)'; x.lineWidth = 0.6;
      for (let d = 15; d <= 75; d += 15) { x.beginPath(); x.moveTo(X(d * DEG), T0p); x.lineTo(X(d * DEG), B0); x.stroke(); }
      for (const r of [1.05, 1.1]) { x.beginPath(); x.moveTo(L0, Yv(r)); x.lineTo(R0, Yv(r)); x.stroke(); }
      x.strokeStyle = C.ink; x.lineWidth = 1.1; x.beginPath(); x.moveTo(L0, T0p - 4); x.lineTo(L0, B0); x.lineTo(R0 + 4, B0); x.stroke();
      x.fillStyle = '#51606b'; x.font = '10px Georgia,serif'; x.textAlign = 'center'; x.textBaseline = 'top';
      for (let d = 0; d <= 75; d += 15) x.fillText(`${d}°`, X(d * DEG), B0 + 3);
      x.textAlign = 'right'; x.textBaseline = 'middle';
      for (const r of [1, 1.05, 1.1]) x.fillText(r.toFixed(2), L0 - 4, Yv(r));
      x.font = 'italic 11px Georgia,serif'; x.textAlign = 'left'; x.textBaseline = 'top';
      x.fillText('T / T公式', L0 + 4, 0); x.textAlign = 'right'; x.textBaseline = 'bottom'; x.fillText('摆角 θ₀', R0, B0 - 2);
      x.fillStyle = '#1f4a3e'; x.font = '10px "Songti SC","Noto Serif CJK SC",serif'; x.textAlign = 'left'; x.textBaseline = 'middle';
      x.fillText('误差 1% 以内', L0 + 6, Yv(1.0) - 7);
      // 公式：一条水平线
      x.strokeStyle = C.copper; x.lineWidth = 1.6; x.setLineDash([5, 3.5]); x.beginPath(); x.moveTo(L0, Yv(1)); x.lineTo(R0, Yv(1)); x.stroke(); x.setLineDash([]);
      // 完整模型（无阻尼精确解）
      x.strokeStyle = C.ink; x.lineWidth = 1.8; x.beginPath();
      for (let i = 0; i <= 120; i++) { const a = (i / 120) * AMAX, r = periodFactor(a); i ? x.lineTo(X(a), Yv(r)) : x.moveTo(X(a), Yv(r)); }
      x.stroke();
      // 1% 的角度
      const a1 = A1PCT;
      x.strokeStyle = 'rgba(31,74,62,.6)'; x.lineWidth = 0.8; x.setLineDash([2, 2]); x.beginPath(); x.moveTo(X(a1), Yv(1.01)); x.lineTo(X(a1), B0); x.stroke(); x.setLineDash([]);
      // 测量点
      for (const pt of mem.points) {
        const px = X(Math.min(pt.a, AMAX)), py = Yv(clamp(pt.r, YR[0], YR[1]));
        x.strokeStyle = pt.kind === 'human' ? '#1f4a3e' : '#51606b'; x.lineWidth = 0.9;
        x.beginPath(); x.moveTo(px, Yv(pt.r + pt.e)); x.lineTo(px, Yv(pt.r - pt.e)); x.stroke();
        x.beginPath(); x.arc(px, py, 2.6, 0, TAU);
        if (pt.kind === 'human') { x.fillStyle = '#1f4a3e'; x.fill(); } else { x.fillStyle = '#fffdf6'; x.fill(); x.stroke(); }
      }
      // 此刻
      const a = Math.min(amp, AMAX), r = periodFactor(a);
      x.strokeStyle = C.copper; x.lineWidth = 1; x.beginPath(); x.moveTo(X(a), B0); x.lineTo(X(a), Yv(r)); x.stroke();
      x.fillStyle = C.copper; x.beginPath(); x.arc(X(a), Yv(r), 3.6, 0, TAU); x.fill();
      x.strokeStyle = C.ink; x.lineWidth = 1; x.stroke();
      x.font = '13px "Kaiti SC","STKaiti","KaiTi","AR PL UKai CN",cursive'; x.fillStyle = C.ink; x.textBaseline = 'bottom';
      const lbl = `此刻 ${fmtDeg(a)}：长 ${((r - 1) * 100).toFixed(r - 1 < 0.01 ? 2 : 1)}%`;
      x.textAlign = X(a) > (L0 + R0) / 2 ? 'right' : 'left';
      x.fillText(lbl, X(a) + (x.textAlign === 'right' ? -7 : 7), Yv(r) - 4);
    };
    const drawLaw = () => {
      if (!law) return;
      const l = p.l, g = p.gv, T0v = T0(), f = periodFactor(amp), Tx = T0v * f, err = (f - 1) * 100;
      // 只在显示出来的数字变了时才改 DOM：书页上的 DOM 是贴在三维纸面上的混合图层，每改一次都要重新合成
      const key = [l, g, fmtDeg(amp), f.toFixed(4), p.bob].join('|');
      if (key === law.key) return;
      law.key = key;
      law.sl.textContent = `${l.toFixed(2)} m`; law.sg.textContent = `${g.toFixed(2)} m/s²`;
      law.ls.refresh(); law.gs.refresh();
      law.calc.innerHTML = `= 2π √(${l.toFixed(2)} ÷ ${g.toFixed(2)}) = <b>${T0v.toFixed(3)} s</b>`;
      const broken = amp > 10 * DEG, warn = !broken && amp > 5 * DEG;
      law.ca.className = `cond${broken ? ' broken' : warn ? ' warn' : ''}`;
      law.ca.querySelector('.why').textContent = broken ? `θ₀ = ${fmtDeg(amp)}：sinθ 比 θ 小 ${((1 - Math.sin(amp) / amp) * 100).toFixed(1)}%` : warn ? `θ₀ = ${fmtDeg(amp)}：误差已到 ${err.toFixed(2)}%` : '';
      law.cd.className = `cond${p.bob ? '' : ' warn'}`;
      law.cd.querySelector('.why').textContent = p.bob ? '' : '木球：振幅在衰减，周期几乎不变';
      law.more.innerHTML = `<small>大摆角</small> T = T₀·2K(sin ½θ₀)/π = ${T0v.toFixed(3)} × ${f.toFixed(4)} = <b>${Tx.toFixed(3)} s</b>${err >= 0.1 ? `<span class="err">公式短了 ${err.toFixed(err < 1 ? 2 : 1)}%</span>` : ''}`;
    };

    // ================================================================ 每帧
    const draw = () => {
      const t = view;
      const s = tl.at(t, tmpS) || { th, thf, l: p.l };
      const sth = s.th, sthf = s.thf, L = s.l * S;
      const [bx, by] = bobXY(sth, s.l), [gx, gy] = bobXY(sthf, s.l);
      const PIV = [XC, PY - 0.2, ZP];
      span(str, PIV, [XC + Math.sin(sth) * (L - R - 0.05), PY - Math.cos(sth) * (L - R - 0.05), ZP]);
      bobs.forEach((b, i) => { b.visible = i === (p.bob ? 1 : 0); b.position.set(bx, by, ZP); b.rotation.z = sth; });
      span(gStr, PIV, [XC + Math.sin(sthf) * (L - R), PY - Math.cos(sthf) * (L - R), ZP - 0.02]);
      gBob.position.set(gx, gy, ZP - 0.02);
      const apart = Math.hypot(bx - gx, by - gy);
      gBob.visible = gStr.visible = true;
      gBob.children[1].material.opacity = clamp(apart / 0.4) * 0.55;
      // 回复力：沿切线指向平衡位置。长度 1.3 单位 = mg
      const showF = Math.abs(sth) > 6 * DEG && (held || amp > 12 * DEG);
      fTrue.visible = fForm.visible = fNote.visible = showF;
      if (showF) {
        const tx = -Math.cos(sth) * Math.sign(sth), ty = -Math.sin(sth) * Math.sign(sth), K = 1.3;
        const ft = K * Math.abs(Math.sin(sth)), ff = K * Math.abs(sth);
        const ox = Math.sin(sth) * 0.0, oy = 0;
        fTrue.set([bx + ox, by + oy, ZP + R + 0.05], [bx + tx * ft, by + ty * ft, ZP + R + 0.05]);
        const nx = -Math.sin(sth) * 0.16, ny = Math.cos(sth) * 0.16;   // 铜色箭头略微错开一点，看得出两根
        fForm.set([bx + nx, by + ny, ZP + R + 0.05], [bx + nx + tx * ff, by + ny + ty * ff, ZP + R + 0.05]);
        fNote.visible = held;
        if (held) {
          fNote.set(`mg·sinθ（真实）\nmg·θ（公式默认）\n差 ${((Math.abs(sth) / Math.abs(Math.sin(sth)) - 1) * 100).toFixed(0)}%`);
          fNote.position.set(bx + tx * ff * 0.5 + (sth > 0 ? -1.3 : 1.3), by + 0.85, ZP + 0.4);
        }
      }
      dim.set([XC - 0.75, PY - 0.2, ZP - 0.1], [XC - 0.75, PY - 0.2 - s.l * S, ZP - 0.1], `l = ${s.l.toFixed(2)} m`, [-1, 0, 0]);
      dim.visible = drumY !== null || lenT > 0;
      // 记录笔
      pen.position.set(bx, 0.05, ZP);
      plumbG.attributes.position.array.set([bx, by - R, ZP, bx, 0.05, ZP]); plumbG.attributes.position.needsUpdate = true; plumb.computeLineDistances();
      drum.rotation.z = -p.l * 4;
      // 纸带
      // 镜头放低，曲线自己立起来；抬到俯视，它躺回纸上成为图像——转动视角就是在抽象的阶梯上走动
      const el = k.stage.view3.elev, camLift = clamp((0.6 - el) / 0.2);
      const L1 = Math.max(ease3(lift), ease3(camLift), peekL);
      tape.update(t, L1, tl.t0);
      tab.position.set(XC + 3.35, 0.03 + L1 * 3.0, 4.15);
      // 秒表
      const running = human ? now() - human.t : timing === 2 ? now() - tStart : 0;
      const txt = human || timing === 2 ? running.toFixed(1) : shown ? shown.toFixed(2) : '0.00';
      const sub = human ? '你在计时…再点停' : timing === 1 ? '等过最低点' : timing === 2 ? `模拟按表 ${cnt}/${N()}` : lastRow ? (lastRow.who === '你' ? `你：N=${lastRow.n}` : `模拟：N=${lastRow.n}`) : '点一下开始';
      const ang = ((human || timing === 2 ? running : shown) % 60) / 60 * TAU;
      if (txt !== wtxt || sub !== wsub || Math.abs(ang - wang) > 0.03) { wtxt = txt; wsub = sub; wang = ang; drawFace(); }
      watchNote.visible = !lastRow && !human;
    };
    const ease3 = (u) => u * u * (3 - 2 * u);
    let figT = 0, lastAmp = -1;
    const awayLabel = note('', { size: 0.3, w: 6, align: 'left', color: C.copper });
    awayLabel.rotation.x = -Math.PI / 2; awayLabel.position.set(XC - 1.0, 0.09, ZP + 1.4);
    k.root.add(awayLabel);

    const inst = {
      bindPage,
      press() {},
      change(id) {
        if (id === 'place' && p.place >= 0) { p.gv = PLACES[p.place][1]; lawDirty = figDirty = true; }
        if (id === 'bob') lawDirty = true;
      },
      measure() { if (timing) return null; if (amp < 0.01) release(5 * DEG); human = null; timing = 1; cnt = 0; shown = 0; return null; },
      update(dt) {
        if (!scrub && dt > 0) { const speed = timing === 2 ? 4 : 1; advanceTo(now() + dt * speed); view = now(); }
        if (!liftHeld) { const d = liftGoal - lift; lift += d * (1 - Math.exp(-6 * dt)); if (Math.abs(d) < 0.002) lift = liftGoal; }
        if (lenT > 0) lenT -= dt;
        // 第一次打开：纸签自己轻轻提一下又放下，告诉读者这里可以提
        if (peekT >= 0) { peekT += dt; const u = clamp((peekT - 2.5) / 2.2); peekL = 0.32 * Math.sin(Math.PI * u) ** 2; if (u >= 1) { peekT = -1; peekL = 0; mem.peeked = true; } k.dirty(); }
        if (flash > 0) { flash -= dt; awayLabel.set(awayNote); awayLabel.visible = flash > 0; } else awayLabel.visible = false;
        draw();
        figT += dt;
        if (figDirty || lawDirty || (Math.abs(amp - lastAmp) > 0.5 * DEG && figT > 0.25)) { figDirty = false; lawDirty = false; figT = 0; lastAmp = amp; drawFig(); drawLaw(); }
        this.T = T;
        if (scrub || liftHeld || Math.abs(lift - liftGoal) > 0) k.dirty();
      },
      margin() {
        const T0v = T0(), f = periodFactor(amp), tau = now() - relAt;
        const lead = tau > 0 && !held ? tau * (1 - 1 / f) : 0;
        return [
          `θ₀ = ${fmtDeg(amp)}`,
          `公式 T₀ = ${T0v.toFixed(3)} s`,
          `完整 T = ${(T0v * f).toFixed(3)} s`,
          lead > 0.025 ? `公式的摆已领先\n ${(Math.round(lead / 0.05) * 0.05).toFixed(2)} s（约 ${Math.round(lead / (T0v * f) * 36) * 10}° 相位）` : '两只摆几乎重合',
          scrub ? `← 正在回看 t = ${view.toFixed(2)} s` : '',
        ].filter(Boolean);
      },
      save(m) { m.peeked = true; m.state = { kk, th, om, thf, omf, sf, amp, relAt, relAmp }; m.tl = tl.snapshot(); },
      // 测试与调试用：直接读状态
      get state() { return { t: now(), view, th, thf, amp, lift, held, scrubbing: !!scrub, l: p.l, g: p.gv, t0: tl.t0, worldline: tape.traces.map((T) => (T.line.visible ? T.wg.drawRange.count : 0)) }; },
      _scrubTo(t) { scrub = { z: 0, t: view }; view = clamp(t, tl.t0, now()); },
      _endScrub() { if (view < now() - 1e-6) setState(view); scrub = null; view = now(); },
      _lift(v) { lift = liftGoal = v; },
      _release(a) { release(a); },
      _hold(a) { held = true; th = a; amp = Math.abs(a); },
    };
    draw(); drawLaw();
    return inst;
  },
};
