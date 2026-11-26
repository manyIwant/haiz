// HAIZ · EXPERIMENTARIUM — 地理与地球系统科学实验包（L3 全套 5 个交互实验 + 开放工作台）
import {
  C, L, TAU, clamp, lerp, group, at, rot, solid, flat, glass,
  box, cyl, ball, cone, torus, plate, rod, wire, tube, arrow, strip, dash, glow,
  label, note, card, plot, dots, liquid, sheet, flow, dimension, sig, freshGroup, THREE,
} from '../core/ink.js';
import { DEG, rng, gauss, sampleStats } from '../core/epistemic.js';
import { solveEarthSun } from '../core/science-models.js';

const MD = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const dateOf = (n) => {
  let m = 0, d = Math.max(1, Math.min(365, Math.round(n)));
  while (d > MD[m] && m < 11) { d -= MD[m]; m++; }
  return `${m + 1}月${d}日`;
};
const fmtLat = (v) => (Math.abs(v) < 0.05 ? '0°' : `${Math.abs(v).toFixed(1).replace(/\.0$/, '')}°${v > 0 ? 'N' : 'S'}`);
const fmtHours = (h) => {
  if (h >= 23.99) return '24时00分（极昼）';
  if (h <= 0.01) return '0时00分（极夜）';
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return mm === 60 ? `${hh + 1}时00分` : `${hh}时${String(mm).padStart(2, '0')}分`;
};

function shadowInfo(latDeg, decDeg, solarAlt) {
  if (solarAlt <= 0.05) return { dir: '无日照（极夜）', len: Infinity };
  if (Math.abs(latDeg - decDeg) < 0.25) return { dir: '直射无影', len: 0 };
  const northShadow = latDeg > decDeg;
  return { dir: northShadow ? '正北' : '正南', len: 1 / Math.tan(solarAlt * DEG) };
}

// ================================================================
// 1. geo-seasons — 地球公转、海口双直射与昼夜长短 (L3)
// ================================================================
const seasons = {
  id: 'geo-seasons',
  subject: 'geo',
  title: '地球公转、海口双直射与昼夜长短',
  en: 'Earth revolution, seasons & Haikou zenith sun',
  lede: [
    '地球以 23.44° 黄赤交角绕太阳公转，地轴始终指向北极星附近。一年里太阳直射点在南北回归线之间往返移动，改写各地的昼夜长短与正午太阳高度。',
    '位于 20°N 的海口地处热带北缘，每年 5 月下旬与 7 月下旬会迎来两次太阳直射——立竿无影，前后正午日影还会发生南北翻转！',
  ],
  formula: 'H = 90° − | φ − δ | · cos ω₀ = −tan φ · tan δ',
  formulaNote: '正午太阳高度 H 与昼弧半角 ω₀（23.44° 黄赤交角，15°/h 换算昼长）',
  terms: [
    ['黄赤交角', '赤道平面与黄道平面的夹角（23°26′ ≈ 23.44°），是四季更替与五带划分的根源。'],
    ['海口双直射', '纬度处于回归线之间（|φ| < 23.44°）的地区一年两次被太阳直射（海口约 5 月 20 日与 7 月 21 日）。'],
    ['晨昏线', '太阳光线与球面相切形成的大圆，永远平分地球但仅在二分日与经线圈重合。'],
  ],
  predict: {
    q: '夏至日（6 月 21 日前后），海口（20°N）和哈尔滨（45°N）相比，谁的白昼更长？谁的正午太阳高度更大？',
    options: [
      '海口白昼更长，且海口正午太阳高度更大',
      '哈尔滨白昼更长，海口正午太阳高度更大',
      '哈尔滨白昼更长，且哈尔滨正午太阳高度更大',
    ],
    answer: 1,
    why: '夏至太阳直射 23.44°N，北半球纬度越高白昼越长（哈尔滨约 15.6 h > 海口约 13.3 h）；而正午太阳高度 H = 90° − |φ − δ| 取决于距直射点纬度差，海口仅差 3.44°（H ≈ 86.6°）远高于哈尔滨（68.4°）。',
  },
  challenge: '切换至“海口 20°N”，寻找一年中正午太阳高度 H ≈ 90° 的两次直射日期，并观察立竿测影从“朝北”翻转为“朝南”的临界瞬间！',
  fig: '3D 太阳–地球公转轨道（23.44° 地轴倾角、晨昏线、纬度环与海口立竿测影台）',
  hint: '拖动日期与纬度滑块或点击预设按钮；打开工作台可直接在全年 H(N) 与昼长曲线上点选日期并观测天球穹顶日影变化。',
  teach: {
    where: '人教版普通高中教科书·地理 选择性必修 1 第一章《地球的运动》§1.2 地球公转的地理意义。',
    ask: [
      '为什么海口（20°N）从 5 月底到 7 月底正午影子朝南，而一年其余 10 个月影子朝北？',
      '当纬度推至 66.5°N 时，夏至与冬至前后极昼极夜如何由 cos ω₀ = −tan φ tan δ 临界条件决定？',
    ],
    simplify: '采用 23.44° 黄赤交角正圆轨道与赤纬正弦近似 δ = arcsin(sin 23.44° · sin(2π(N−80)/365))，不计大气折射与均时差。',
  },
  controls: [
    { id: 'n', label: '公转日期 N', min: 1, max: 365, step: 1, value: 172, fmt: dateOf },
    { id: 'lat', label: '观测纬度 φ', min: -66.5, max: 75, step: 0.5, value: 20, fmt: fmtLat },
    { id: 'auto', type: 'toggle', label: '连续公转', value: false },
    { id: 'bHaikou', type: 'button', label: '海口 20°N' },
    { id: 'bZenith', type: 'button', label: '海口直射日' },
    { id: 'bBeijing', type: 'button', label: '北京 40°N' },
    { id: 'bArctic', type: 'button', label: '北极圈 66.5°N' },
    { id: 'd0', type: 'button', label: '春分' },
    { id: 'd1', type: 'button', label: '夏至' },
    { id: 'd2', type: 'button', label: '秋分' },
    { id: 'd3', type: 'button', label: '冬至' },
  ],
  record: {
    note: '记录不同日期与纬度下的太阳赤纬 δ、正午太阳高度 H、昼长及立竿日影朝向。',
    pending: '点击工作台“记录当前天象观测”或页面记录按钮录入数据。',
    columns: [
      { key: 'date', label: '日期' },
      { key: 'latStr', label: '纬度 φ' },
      { key: 'decDeg', label: '直射点 δ', unit: '°', digits: 2 },
      { key: 'solarAlt', label: '太阳高度 H', unit: '°', digits: 1, stat: true },
      { key: 'dayHours', label: '昼长', unit: 'h', digits: 2 },
      { key: 'shadow', label: '正午影向' },
    ],
    sample: (_inst, p) => {
      const sol = solveEarthSun(p.n, p.lat);
      const sh = shadowInfo(p.lat, sol.decDeg, sol.solarAlt);
      return {
        _kind: 'human',
        date: dateOf(p.n),
        latStr: fmtLat(p.lat),
        decDeg: sol.decDeg,
        solarAlt: sol.solarAlt,
        dayHours: sol.dayHours,
        shadow: sh.dir,
      };
    },
    summary: (rows) => [
      ['已录入天象记录', `${rows.length} 条`],
      ['最大正午高度', rows.length ? `${Math.max(...rows.map((r) => r.solarAlt)).toFixed(1)}°` : '—'],
    ],
    errors: [
      '混淆“正午太阳高度最大”与“白昼最长”：海口白昼最长在夏至，但正午太阳高度 90° 在 5 月 20 日和 7 月 21 日左右。',
    ],
  },

  build(k) {
    const p = k.p;
    const R = 3.15, Y = 1.95, Z = -0.8, RE = 0.62, EPS = 23.44 * DEG;
    const axis = new THREE.Vector3(Math.sin(EPS), Math.cos(EPS), 0);

    // 太阳与公转轨道环
    k.root.add(
      at(flat(new THREE.SphereGeometry(0.54, 32, 20), C.amber), 0, Y, Z),
      at(glow(C.amber, 4.4, 0.72), 0, Y, Z),
      at(cyl(0.05, Y - 0.54, C.ink), 0, 0, Z),
      at(cyl(0.45, 0.08, C.shade), 0, 0, Z),
      at(torus(R, 0.018, C.ink), 0, Y, Z),
    );
    [['春分', 0, -R - 0.45], ['夏至', -R - 0.55, 0], ['秋分', 0, R + 0.48], ['冬至', R + 0.55, 0]].forEach(([s, x, z]) => {
      k.root.add(at(note(s, { size: 0.28, lay: 'flat' }), x, 0.04, Z + z));
    });

    // 倾斜地球（赤道环、回归线虚环、观测纬线圈、地轴、晨昏线夜半球壳）
    const tropicY = Math.sin(EPS) * RE, tropicR = Math.cos(EPS) * RE;
    const globe = group(
      ball(RE),
      torus(RE + 0.012, 0.018, C.ink),
      at(torus(tropicR + 0.008, 0.009, C.copper), 0, tropicY, 0),
      at(torus(tropicR + 0.008, 0.009, C.copper), 0, -tropicY, 0),
      rod([0, -RE - 0.36, 0], [0, RE + 0.36, 0], 0.026, C.ink),
    );
    const latRing = torus(1, 0.022, C.red);
    globe.add(latRing);
    globe.rotation.z = -EPS;

    const night = flat(new THREE.SphereGeometry(RE * 1.03, 32, 16, 0, TAU, 0, Math.PI / 2), '#1e2b36', { opacity: 0.45 });
    const termRing = flat(new THREE.TorusGeometry(RE * 1.032, 0.014, 8, 48).rotateX(Math.PI / 2), C.amber, { opacity: 0.85 });
    const nightGrp = group(night, termRing);
    const city = flat(new THREE.SphereGeometry(0.082, 12, 8), C.red);
    const sub = flat(new THREE.SphereGeometry(0.072, 12, 8), C.amber);
    const earth = group(globe, nightGrp, city, sub);
    const ray = strip(2, { w: 0.055, color: C.amber, opacity: 0.65, normal: [0, 1, 0] });

    // 立竿测影局部微台（右前角）
    const gnomonBase = at(group(
      plate(1.5, 1.5, C.paper, 0.06),
      at(rod([0, 0.06, 0], [0, 0.66, 0], 0.024, C.copper), 0, 0, 0),
      at(note('N', { size: 0.22, lay: 'flat', color: C.red }), 0, 0.07, -0.58),
      at(note('S', { size: 0.22, lay: 'flat', color: C.ink }), 0, 0.07, 0.58),
      at(note('立竿测影', { size: 0.2, lay: 'flat' }), 0, 0.07, 0.88),
    ), -3.1, 0.02, 2.35);
    const shadowBar = flat(new THREE.BoxGeometry(0.05, 0.02, 1).translate(0, 0.07, -0.5), '#1e2b36', { opacity: 0.72 });
    gnomonBase.add(shadowBar);

    const info = at(card('\n\n\n', { w: 4.5, size: 0.28, align: 'left' }), 2.35, 0, 2.85);
    k.root.add(earth, ray, gnomonBase, info);

    const s = new THREE.Vector3(), e1 = new THREE.Vector3(), q = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    let zenithToggle = 0;
    const st = { decDeg: 23.44, dayHours: 13.3, solarAlt: 86.6 };

    const sync = () => {
      const th = Math.PI / 2 + TAU * (p.n - 80) / 365;
      earth.position.set(R * Math.cos(th), Y, Z - R * Math.sin(th));
      s.set(-Math.cos(th), 0, Math.sin(th)).normalize();
      const sol = solveEarthSun(p.n, p.lat);
      Object.assign(st, sol);
      const phi = p.lat * DEG;

      nightGrp.quaternion.setFromUnitVectors(up, q.copy(s).negate());
      const sinD = axis.dot(s);
      e1.copy(s).addScaledVector(axis, -sinD);
      if (e1.lengthSq() < 1e-8) e1.set(0, 0, 1);
      e1.normalize();
      city.position.copy(e1).multiplyScalar(Math.cos(phi) * RE).addScaledVector(axis, Math.sin(phi) * RE);
      sub.position.copy(s).multiplyScalar(RE);
      latRing.scale.set(Math.cos(phi) * RE, 1, Math.cos(phi) * RE);
      latRing.position.y = Math.sin(phi) * RE;
      ray.set([[0, Y, Z], [earth.position.x, Y, earth.position.z]]);

      const sh = shadowInfo(p.lat, sol.decDeg, sol.solarAlt);
      if (sol.solarAlt <= 0.1) {
        shadowBar.visible = false;
      } else {
        shadowBar.visible = true;
        const lenVis = clamp(sh.len * 0.42, 0.02, 0.62);
        shadowBar.scale.z = lenVis;
        shadowBar.rotation.y = p.lat >= sol.decDeg ? 0 : Math.PI;
      }

      const decTxt = `${Math.abs(sol.decDeg).toFixed(1)}°${sol.decDeg >= 0 ? 'N' : 'S'}`;
      info.set(`${dateOf(p.n)} · 纬度 ${fmtLat(p.lat)}\n直射点 ${decTxt} · 正午 H = ${sol.solarAlt.toFixed(1)}°\n昼长 ${fmtHours(sol.dayHours)} · 影向：${sh.dir}`);
    };

    sync();
    return {
      press(id) {
        if (id === 'bHaikou') k.set('lat', 20);
        else if (id === 'bBeijing') k.set('lat', 40);
        else if (id === 'bArctic') k.set('lat', 66.5);
        else if (id === 'bZenith') {
          k.set('lat', 20);
          zenithToggle = 1 - zenithToggle;
          k.set('n', zenithToggle ? 140 : 202);
        } else if (id[0] === 'd') {
          k.set('n', [80, 172, 266, 356][+id[1]]);
        }
        sync();
        k.dirty();
      },
      change() { sync(); k.dirty(); },
      update(dt) {
        if (p.auto && dt > 0) {
          k.set('n', ((p.n - 1 + dt * 24) % 365) + 1);
          sync();
        }
      },
      margin() {
        const sh = shadowInfo(p.lat, st.decDeg, st.solarAlt);
        return [
          `${dateOf(p.n)} (N=${Math.round(p.n)})`,
          `δ = ${st.decDeg.toFixed(1)}° · φ = ${fmtLat(p.lat)}`,
          `H = ${st.solarAlt.toFixed(1)}°`,
          `昼长 ${fmtHours(st.dayHours)}`,
          `正午日影：${sh.dir}`,
          Math.abs(p.lat - 20) < 0.6 && st.solarAlt > 89 ? '海口太阳直射！' : (st.decDeg > 0.5 ? '北半球昼长夜短' : st.decDeg < -0.5 ? '北半球昼短夜长' : '全球昼夜平分'),
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 全年正午太阳高度 H(N) 与昼长曲线（点击或拖动选日期）');
    const btns = document.createElement('div');
    btns.className = 'wb-btn-row';
    btns.innerHTML = `
      <button type="button" class="wb-btn primary" data-act="hk">海口 20°N</button>
      <button type="button" class="wb-btn" data-act="z1">第一次直射 (~5/20)</button>
      <button type="button" class="wb-btn" data-act="z2">第二次直射 (~7/21)</button>
      <button type="button" class="wb-btn" data-act="sol">夏至 6/21</button>
      <button type="button" class="wb-btn" data-act="rec">记录当前天象观测</button>`;
    sec1.append(btns);

    const chart = wb.canvas(sec1, 540, 250, (x, W, H) => {
      const p = sp.params;
      const pad = { l: 46, r: 46, t: 26, b: 34 };
      const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      const sx = (n) => pad.l + ((n - 1) / 364) * pw;
      const syH = (alt) => pad.t + ph - (alt / 90) * ph;
      const syD = (hrs) => pad.t + ph - (hrs / 24) * ph;

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      x.strokeStyle = 'rgba(30,43,54,0.1)'; x.lineWidth = 1;
      for (let g = 0; g <= 4; g++) {
        const yy = pad.t + (ph * g) / 4;
        x.beginPath(); x.moveTo(pad.l, yy); x.lineTo(pad.l + pw, yy); x.stroke();
      }
      // 坐标轴与左右双纵轴刻度
      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.4;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.moveTo(pad.l + pw, pad.t); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();

      x.font = '11px Georgia,serif';
      x.fillStyle = C.copper; x.textAlign = 'right';
      for (let a = 0; a <= 90; a += 30) x.fillText(`${a}°`, pad.l - 6, syH(a) + 4);
      x.textAlign = 'left'; x.fillText('正午高度 H', pad.l + 4, pad.t - 8);

      x.fillStyle = C.blue; x.textAlign = 'left';
      for (let d = 0; d <= 24; d += 6) x.fillText(`${d}h`, pad.l + pw + 6, syD(d) + 4);
      x.textAlign = 'right'; x.fillText('昼长 (h)', pad.l + pw - 4, pad.t - 8);

      x.fillStyle = '#51606b'; x.textAlign = 'center';
      [[80, '春分'], [172, '夏至'], [266, '秋分'], [356, '冬至']].forEach(([d, lbl]) => {
        x.strokeStyle = 'rgba(30,43,54,0.18)'; x.setLineDash([3, 3]);
        x.beginPath(); x.moveTo(sx(d), pad.t); x.lineTo(sx(d), pad.t + ph); x.stroke(); x.setLineDash([]);
        x.fillText(lbl, sx(d), H - 14);
      });

      // 绘制正午太阳高度 H(N) 曲线
      x.strokeStyle = C.copper; x.lineWidth = 2.3; x.beginPath();
      const zenithDays = [];
      for (let n = 1; n <= 365; n++) {
        const res = solveEarthSun(n, p.lat);
        if (Math.abs(p.lat - res.decDeg) < 0.35) zenithDays.push(n);
        if (n === 1) x.moveTo(sx(n), syH(res.solarAlt)); else x.lineTo(sx(n), syH(res.solarAlt));
      }
      x.stroke();

      // 绘制昼长曲线
      x.strokeStyle = C.blue; x.lineWidth = 2.0; x.beginPath();
      for (let n = 1; n <= 365; n++) {
        const res = solveEarthSun(n, p.lat);
        if (n === 1) x.moveTo(sx(n), syD(res.dayHours)); else x.lineTo(sx(n), syD(res.dayHours));
      }
      x.stroke();

      // 标记热带双直射峰
      if (Math.abs(p.lat) <= 23.44) {
        for (const zn of zenithDays) {
          x.fillStyle = C.amber; x.strokeStyle = C.copper; x.lineWidth = 1.5;
          x.beginPath(); x.arc(sx(zn), syH(90), 4.5, 0, TAU); x.fill(); x.stroke();
        }
      }

      // 当前日期游标
      const cur = solveEarthSun(p.n, p.lat);
      const cx = sx(p.n);
      x.strokeStyle = '#1f4a3e'; x.lineWidth = 1.6;
      x.beginPath(); x.moveTo(cx, pad.t); x.lineTo(cx, pad.t + ph); x.stroke();
      x.fillStyle = C.copper; x.beginPath(); x.arc(cx, syH(cur.solarAlt), 5, 0, TAU); x.fill();
      x.fillStyle = C.blue; x.beginPath(); x.arc(cx, syD(cur.dayHours), 5, 0, TAU); x.fill();
      x.fillStyle = '#1e2b36'; x.textAlign = 'center'; x.font = 'bold 11.5px "Noto Serif SC",serif';
      x.fillText(`${dateOf(p.n)} (${fmtLat(p.lat)})`, clamp(cx, pad.l + 65, pad.l + pw - 65), pad.t + 14);
    });

    const sec2 = wb.section('2 · 当地天球穹顶与正午立竿测影实时投影');
    const dome = wb.canvas(sec2, 540, 185, (x, W, H) => {
      const p = sp.params;
      const sol = solveEarthSun(p.n, p.lat);
      const sh = shadowInfo(p.lat, sol.decDeg, sol.solarAlt);
      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      const gx = 190, gy = 148, R = 108;

      // 地平线与正午天球半圆
      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.6;
      x.beginPath(); x.moveTo(gx - R - 25, gy); x.lineTo(gx + R + 25, gy); x.stroke();
      x.strokeStyle = 'rgba(30,43,54,0.22)'; x.setLineDash([4, 4]);
      x.beginPath(); x.arc(gx, gy, R, Math.PI, 0); x.stroke(); x.setLineDash([]);
      x.fillStyle = '#51606b'; x.font = '11.5px "Noto Serif SC",serif';
      x.textAlign = 'center';
      x.fillText('正北 (N)', gx - R - 12, gy + 16);
      x.fillText('正南 (S)', gx + R + 12, gy + 16);
      x.fillText('天顶 90°', gx, gy - R - 10);

      // 立竿 (杆高 48 px)
      const poleH = 48;
      x.strokeStyle = C.copper; x.lineWidth = 3.2;
      x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx, gy - poleH); x.stroke();

      // 太阳位置（北半球视角：若直射点在南，太阳在南侧即右；若直射点在北，太阳在北侧即左）
      const sunIsSouth = sol.decDeg <= p.lat;
      const altRad = sol.solarAlt * DEG;
      const dirSign = sunIsSouth ? 1 : -1;
      const sxp = gx + dirSign * R * Math.cos(altRad);
      const syp = gy - R * Math.sin(altRad);
      if (sol.solarAlt > 0.1) {
        x.strokeStyle = 'rgba(255,181,46,0.55)'; x.lineWidth = 1.6; x.setLineDash([5, 3]);
        x.beginPath(); x.moveTo(sxp, syp); x.lineTo(gx, gy - poleH);
        const sLen = clamp(poleH / Math.max(0.08, Math.tan(altRad)), 0, R + 15);
        const shEndX = gx - dirSign * sLen;
        x.lineTo(shEndX, gy); x.stroke(); x.setLineDash([]);
        // 地面影子粗线
        x.strokeStyle = '#1e2b36'; x.lineWidth = 5;
        x.beginPath(); x.moveTo(gx, gy); x.lineTo(shEndX, gy); x.stroke();
        // 太阳图标
        x.fillStyle = C.amber; x.strokeStyle = C.copper; x.lineWidth = 1.6;
        x.beginPath(); x.arc(sxp, syp, 9, 0, TAU); x.fill(); x.stroke();
      }

      // 右侧定量仪表读数块
      x.textAlign = 'left'; x.fillStyle = '#1e2b36'; x.font = 'bold 13px "Noto Serif SC",serif';
      x.fillText(`观测点：${fmtLat(p.lat)} · ${dateOf(p.n)}`, 345, 38);
      x.font = '12.5px Georgia,serif'; x.fillStyle = '#51606b';
      x.fillText(`太阳赤纬 δ = ${sol.decDeg >= 0 ? '+' : ''}${sol.decDeg.toFixed(2)}°`, 345, 66);
      x.fillText(`正午高度 H = ${sol.solarAlt.toFixed(2)}°`, 345, 88);
      x.fillText(`白昼长度 = ${fmtHours(sol.dayHours)}`, 345, 110);
      x.fillStyle = Math.abs(p.lat - sol.decDeg) < 0.35 ? C.red : '#1f4a3e';
      x.fillText(`立竿影长比 L/h = ${Number.isFinite(sh.len) ? sh.len.toFixed(2) : '∞'} (${sh.dir})`, 345, 134);
    });

    const metrics = document.createElement('div');
    metrics.className = 'wb-metrics';
    sec2.append(metrics);

    const refresh = () => {
      chart.redraw();
      dome.redraw();
      const sol = solveEarthSun(sp.params.n, sp.params.lat);
      const sh = shadowInfo(sp.params.lat, sol.decDeg, sol.solarAlt);
      metrics.innerHTML = `
        <div class="wb-m"><span>直射点纬度 δ</span><b>${Math.abs(sol.decDeg).toFixed(2)}°${sol.decDeg >= 0 ? 'N' : 'S'}</b></div>
        <div class="wb-m"><span>正午太阳高度 H</span><b>${sol.solarAlt.toFixed(2)}°</b></div>
        <div class="wb-m"><span>昼长 / 夜长</span><b>${fmtHours(sol.dayHours)}</b></div>
        <div class="wb-m"><span>立竿日影朝向</span><b>${sh.dir}</b></div>`;
    };

    let scrubbing = false;
    const scrubDay = (ev) => {
      const pt = chart.toLocal(ev);
      const n = Math.round(clamp(1 + ((pt.x - 46) / (540 - 92)) * 364, 1, 365));
      wb.setParam('n', n);
      refresh();
    };
    chart.cv.addEventListener('pointerdown', (e) => { scrubbing = true; chart.cv.setPointerCapture?.(e.pointerId); scrubDay(e); });
    chart.cv.addEventListener('pointermove', (e) => { if (scrubbing) scrubDay(e); });
    chart.cv.addEventListener('pointerup', () => { scrubbing = false; });

    btns.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (!act) return;
      if (act === 'hk') wb.setParam('lat', 20);
      else if (act === 'z1') { wb.setParam('lat', 20); wb.setParam('n', 140); }
      else if (act === 'z2') { wb.setParam('lat', 20); wb.setParam('n', 202); }
      else if (act === 'sol') wb.setParam('n', 172);
      else if (act === 'rec') wb.record(seasons.record.sample(sp.inst, sp.params));
      refresh();
    });

    let lastKey = '';
    refresh();
    return {
      update() {
        const k = `${sp.params.n}|${sp.params.lat}`;
        if (k !== lastKey) { lastKey = k; refresh(); }
      },
    };
  },
};

// ================================================================
// 2. geo-breeze — 热力环流、海陆风与等压面探空 (L3)
// ================================================================
function breezeAtmosphere(timeIdx, dT) {
  const day = timeIdx === 0;
  const tSea = day ? 25.0 : 23.0;
  const tLand = day ? 25.0 + dT : 23.0 - dT * 0.75;
  const sgn = day ? 1 : -1;
  const strength = (day ? dT : dT * 0.75);
  // 近地面热区气压微降，冷区微升；由静力平衡 p(z) = p0 * exp(-z / H(T)) 在高空自动反转成高凸低凹
  const p0Land = 1013.2 - sgn * 0.25 * strength;
  const p0Sea = 1013.2 + sgn * 0.25 * strength;
  const pAt = (xFrac, zMeters) => {
    // xFrac: 0 = 陆地中心, 1 = 海洋中心
    const u = 0.5 + 0.5 * Math.tanh((xFrac - 0.5) * 4.2);
    const p0 = lerp(p0Land, p0Sea, u);
    const tC = lerp(tLand, tSea, u);
    const H = 29.26 * (tC + 273.15); // 标高 (m)
    return { p: p0 * Math.exp(-zMeters / H), tC };
  };
  return { day, tLand, tSea, p0Land, p0Sea, pAt };
}

const breeze = {
  id: 'geo-breeze',
  subject: 'geo',
  title: '热力环流、海陆风与等压面探空',
  en: 'Thermal circulation & coastal breezes',
  lede: [
    '白昼海滩烫脚而海水凉爽，夜晚陆地散热快于海洋。海陆比热容差异造成冷热不均，空气先垂直升降，再沿水平气压梯度流动，闭合成热力环流。',
    '热空气柱密度小、随海拔气压衰减慢，因此高空形成高压（等压面上凸），近地面却是低压（等压面下凹）——“高凸低凹”在垂直探空中一目了然。',
  ],
  formula: 'p(z) = p₀ · exp(−z / H(T)) · 受热上升 → 近地面低压、高空高压',
  formulaNote: 'H(T) = R_d·T / g 随气温升高而增大；高压区等压面上凸，低压区等压面下凹',
  terms: [
    ['海风与陆风', '白天近地面由海洋吹向陆地为海风；夜晚陆地冷于海洋，风向反转为陆风。'],
    ['等压面凹凸规律', '高压处等压面向高空凸起，低压处向低处凹陷（高凸低凹），且近地面与高空高低压相反。'],
    ['静力平衡廓线', '海拔每升高，气压呈指数下降；暖气柱气压随高度下降较慢，故高空相对高压。'],
  ],
  predict: {
    q: '晴朗的白天，海边热力环流稳定时，近地面与高空的等压面弯曲方向分别是怎样的？',
    options: [
      '近地面陆地上凸、海洋下凹；高空也是陆地上凸',
      '近地面陆地下凹（低压）、海洋上凸（高压）；高空陆地上凸、海洋下凹',
      '近地面和高空都保持完全水平',
    ],
    answer: 1,
    why: '白天陆地升温快、空气膨胀上升，近地面空气减少形成低压（等压面下凹），高空空气堆积形成高压（等压面上凸）；海洋一侧恰好相反。',
  },
  challenge: '对比白天和夜晚 2500 m 高空与 0 m 近地面的气压差；在实验台拖动气象探空气球找出海陆气压相等的“等压零梯度高度层”！',
  fig: '3D 海岸剖面热力环流、双层弯曲等压面与垂直探空仪',
  hint: '切换白天/夜晚并调节海陆温差；上下拖动蓝色探空气球滑块或 3D 探空仪，在工作台测量全剖面气压分布。',
  teach: {
    where: '人教版地理 必修第一册 第二章《地球上的大气》§2.2 大气受热过程和大气运动（热力环流）。',
    ask: [
      '根据 p(z) = p₀ exp(−z/H(T))，为什么暖空气柱在近地面气压低，上升到约 1 km 以上气压反而高于冷空气柱？',
      '海南岛白天的海风和陆上的城市热岛环流如何叠加影响沿海气温？',
    ],
    simplify: '采用二维海岸剖面理想静力平衡模型与单层对流闭环，忽略科氏力偏转、海风锋云系及背景信风。',
  },
  controls: [
    { id: 'time', type: 'choice', label: '昼夜时段', options: ['白天 (海风)', '夜晚 (陆风)'], value: 0 },
    { id: 'dT', label: '海陆温差', min: 0, max: 12, step: 0.5, value: 6, unit: '℃' },
    { id: 'probeZ', label: '探空高度 z', min: 0, max: 3000, step: 100, value: 500, unit: 'm' },
    { id: 'bFlip', type: 'button', label: '昼夜切换' },
  ],
  record: {
    note: '记录白天与夜晚在近地面及高空测得的海陆气压差 Δp = p_陆 − p_海。',
    pending: '点击工作台“记录当前探空读数”或在记录簿点击采样。',
    columns: [
      { key: 'mode', label: '时段' },
      { key: 'z', label: '探空高度', unit: 'm', digits: 0 },
      { key: 'pLand', label: '陆上气压', unit: 'hPa', digits: 2 },
      { key: 'pSea', label: '海上气压', unit: 'hPa', digits: 2 },
      { key: 'dp', label: '陆−海气压差', unit: 'hPa', digits: 2, stat: true },
      { key: 'wind', label: '水平风向' },
    ],
    sample: (_inst, p) => {
      const atm = breezeAtmosphere(p.time, p.dT);
      const pL = atm.pAt(0.05, p.probeZ).p;
      const pS = atm.pAt(0.95, p.probeZ).p;
      const dp = pL - pS;
      return {
        _kind: 'human',
        mode: atm.day ? '白天' : '夜晚',
        z: p.probeZ,
        pLand: pL,
        pSea: pS,
        dp,
        wind: Math.abs(dp) < 0.08 ? '静风均衡层' : dp < 0 ? '海 → 陆' : '陆 → 海',
      };
    },
    summary: (rows) => [
      ['探空记录数', `${rows.length} 条`],
      ['气压差范围', rows.length ? `${Math.min(...rows.map((r) => r.dp)).toFixed(2)} ~ ${Math.max(...rows.map((r) => r.dp)).toFixed(2)} hPa` : '—'],
    ],
    errors: [
      '误以为地面热的地方高空也是低压：其实受热膨胀抬高了等压面，高空反而形成相对高压。',
    ],
  },

  build(k) {
    const p = k.p, Z = -0.8;
    const land = at(box(4.2, 0.56, 3.0, C.paper), -2.25, 0, Z);
    const sea = at(flat(new THREE.BoxGeometry(4.3, 0.42, 3.0).translate(0, 0.21, 0), C.sky, { opacity: 0.38 }), 2.05, 0.02, Z);
    k.root.add(land, sea, at(glow(C.sky, 4.8, 0.24), 2.05, 0.3, Z));

    // 海南岸边建筑与椰树轮廓
    [[-3.55, -0.55], [-2.5, 0.55], [-1.35, -0.85]].forEach(([x, z], i) => {
      if (i === 1) {
        k.root.add(group(at(cyl(0.06, 0.65, C.wood), x, 0.56, Z + z), at(cone(0.38, 0.72, '#2fb46a'), x, 1.15, Z + z)));
      } else {
        k.root.add(group(at(box(0.68, 0.46, 0.58, C.paper), x, 0.56, Z + z), rot(at(solid(new THREE.ConeGeometry(0.58, 0.36, 4), C.shade), x, 1.2, Z + z), 0, Math.PI / 4, 0)));
      }
    });

    const loopPts = [[-2.55, 1.25, Z], [-2.55, 4.25, Z], [2.55, 4.25, Z], [2.55, 1.25, Z]];
    const air = flow(loopPts, 28, '#8fb8e8', { closed: true, r: 0.085 });
    const arrows = [C.flame, C.ink, C.blue, C.ink].map((c) => arrow(c, 0.058));
    const isoL = strip(24, { w: 0.048, color: C.ink, opacity: 0.65 });
    const isoH = strip(24, { w: 0.048, color: C.copper, opacity: 0.75 });
    const sun = at(group(flat(new THREE.SphereGeometry(0.42, 24, 16), C.amber), glow(C.amber, 3.2, 0.6)), -3.6, 5.2, Z - 1.3);
    const moon = at(group(flat(new THREE.SphereGeometry(0.36, 24, 16), '#e9edf5'), glow('#b9c8ff', 2.4, 0.5)), 3.5, 5.2, Z - 1.3);

    // 3D 可拖拽气象探空气球（同步 probeZ）
    const sonde = group(
      ball(0.18, C.sky),
      at(wire([0, -0.18, 0], [0, -0.52, 0], 0.014), 0, 0, 0),
      at(box(0.12, 0.1, 0.12, C.copper), 0, -0.56, 0),
    );
    sonde.position.set(0, 1.6, Z + 0.55);

    const tL = at(note('低压', { size: 0.32 }), -2.55, 0.92, Z + 1.65);
    const tS = at(note('高压', { size: 0.32 }), 2.55, 0.82, Z + 1.65);
    const tHL = at(note('高压', { size: 0.28, color: C.copper }), -2.55, 4.55, Z + 0.3);
    const tHS = at(note('低压', { size: 0.28, color: C.copper }), 2.55, 4.55, Z + 0.3);
    const info = at(card('\n\n\n', { w: 4.5, size: 0.28, align: 'left' }), 0.3, 0, 2.95);
    k.root.add(air, ...arrows, isoL, isoH, sun, moon, sonde, tL, tS, tHL, tHS, info);

    let y0 = 0, z0 = 0;
    k.drag(sonde, {
      start: (q) => { y0 = q.y; z0 = p.probeZ; },
      move: (q) => {
        k.set('probeZ', clamp(Math.round((z0 + (q.y - y0) * 900) / 100) * 100, 0, 3000));
        k.dirty();
      },
    });

    let dir = 1;
    const syncStatic = () => {
      const atm = breezeAtmosphere(p.time, p.dT);
      sun.visible = atm.day;
      moon.visible = !atm.day;
      sonde.position.y = 1.15 + (p.probeZ / 3000) * 3.1;
      const pL = atm.pAt(0.05, p.probeZ).p, pS = atm.pAt(0.95, p.probeZ).p;
      const zName = p.probeZ < 50 ? '近地面' : `${p.probeZ} m`;
      const calm = p.dT < 0.4;
      tL.set(calm ? '—' : atm.day ? '近地低压' : '近地高压');
      tS.set(calm ? '—' : atm.day ? '近地高压' : '近地低压');
      tHL.set(calm ? '—' : atm.day ? '高空高压' : '高空低压');
      tHS.set(calm ? '—' : atm.day ? '高空低压' : '高空高压');
      info.set(`陆 ${atm.tLand.toFixed(1)}℃  海 ${atm.tSea.toFixed(1)}℃  (${calm ? '均温无环流' : atm.day ? '海风' : '陆风'})\n探空 ${zName}：陆 ${pL.toFixed(2)} vs 海 ${pS.toFixed(2)} hPa\n虚实弧线为等压面（高压上凸、低压下凹）`);
    };

    syncStatic();
    return {
      press(id) {
        if (id === 'bFlip') { k.set('time', p.time === 0 ? 1 : 0); syncStatic(); k.dirty(); }
      },
      change() { syncStatic(); k.dirty(); },
      update(dt) {
        const atm = breezeAtmosphere(p.time, p.dT);
        const targetDir = (atm.day ? 1 : -1) * (p.dT / 12);
        dir = dt > 0 ? lerp(dir, targetDir, 1 - Math.exp(-dt * 2.8)) : targetDir;
        air.step(dt, dir * 3.4);
        air.visible = Math.abs(dir) > 0.02;

        const ends = [[[-2.55, 1.55, Z], [-2.55, 3.95, Z]], [[-2.1, 4.25, Z], [2.1, 4.25, Z]], [[2.55, 3.95, Z], [2.55, 1.55, Z]], [[2.1, 1.25, Z], [-2.1, 1.25, Z]]];
        arrows.forEach((ar, i) => {
          const [A, B] = ends[i], f = clamp(Math.abs(dir) * 1.25);
          const m = A.map((v, j) => (v + B[j]) / 2);
          const h = A.map((v, j) => ((B[j] - v) / 2) * f * Math.sign(dir || 1));
          ar.set(m.map((v, j) => v - h[j]), m.map((v, j) => v + h[j]));
          ar.children.forEach((c) => c.material.color.set(i % 2 ? C.ink : (i === 0) === (dir > 0) ? C.flame : C.blue));
        });

        // 高凸低凹等压面（随物理气压差实时弯曲）
        const pl = [], ph = [];
        for (let i = 0; i < 24; i++) {
          const xFrac = i / 23;
          const xw = lerp(-3.5, 3.5, xFrac);
          const dp0 = (atm.pAt(xFrac, 0).p - 1013.2) * 0.16;
          const dpH = (atm.pAt(xFrac, 2600).p - atm.pAt(0.5, 2600).p) * 0.16;
          pl.push([xw, 1.95 + dp0, Z + 0.03]);
          ph.push([xw, 3.65 + dpH, Z + 0.03]);
        }
        isoL.set(pl);
        isoH.set(ph);
      },
      margin() {
        const atm = breezeAtmosphere(p.time, p.dT);
        const pL = atm.pAt(0.05, p.probeZ).p, pS = atm.pAt(0.95, p.probeZ).p;
        return [
          atm.day ? '白天：陆暖海凉' : '夜晚：陆凉海暖',
          `ΔT = ${p.dT.toFixed(1)} ℃`,
          `探空 z = ${p.probeZ} m`,
          `p_陆 = ${pL.toFixed(2)} hPa`,
          `p_海 = ${pS.toFixed(2)} hPa`,
          p.dT < 0.4 ? '无水平气压梯度' : pL < pS ? '风向：海洋 → 陆地' : '风向：陆地 → 海洋',
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 海岸垂直剖面等压面场与可拖拽气象探空气球');
    let probeX = 0.25; // 0=陆地, 1=海洋
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn primary" data-act="flip">切换昼夜</button>
      <button type="button" class="wb-btn" data-act="surf">移至近地面 (100 m)</button>
      <button type="button" class="wb-btn" data-act="upper">移至高空 (2400 m)</button>
      <button type="button" class="wb-btn" data-act="rec">记录当前探空读数</button>`;
    sec1.append(bar);

    const cs = wb.canvas(sec1, 540, 250, (x, W, H) => {
      const p = sp.params;
      const atm = breezeAtmosphere(p.time, p.dT);
      const pad = { l: 50, r: 22, t: 24, b: 36 };
      const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      const sx = (xf) => pad.l + xf * pw;
      const sy = (zm) => pad.t + ph - (zm / 3000) * ph;

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      // 陆地与海洋底色条
      x.fillStyle = atm.day ? 'rgba(255,106,61,0.14)' : 'rgba(58,156,255,0.1)';
      x.fillRect(pad.l, pad.t + ph - 10, pw * 0.5, 10);
      x.fillStyle = 'rgba(58,156,255,0.22)';
      x.fillRect(pad.l + pw * 0.5, pad.t + ph - 10, pw * 0.5, 10);

      // 绘制等压面曲线 (1010, 960, 910, 860, 810, 760 hPa)，通过垂直放大直观呈现高凸低凹
      const isoLevels = [1010, 960, 910, 860, 810, 760];
      isoLevels.forEach((pTarget) => {
        x.strokeStyle = pTarget > 950 ? '#1e2b36' : C.copper;
        x.lineWidth = 1.6;
        x.beginPath();
        let lastY = 0;
        for (let i = 0; i <= 50; i++) {
          const xf = i / 50;
          const p0 = atm.pAt(xf, 0).p, pTop = atm.pAt(xf, 3000).p;
          const fracZ = (p0 - pTarget) / Math.max(1e-3, p0 - pTop);
          // 对气压微差做 16× 几何凸起可视化增强以便中学肉眼判读凹凸
          const zMid = ((1013.2 - pTarget) / (1013.2 - 730)) * 3000;
          const zReal = fracZ * 3000;
          const zVis = clamp(zMid + (zReal - zMid) * 14, 0, 3000);
          lastY = sy(zVis);
          if (i === 0) x.moveTo(sx(xf), lastY); else x.lineTo(sx(xf), lastY);
        }
        x.stroke();
        x.fillStyle = '#51606b'; x.font = '10.5px Georgia,serif'; x.textAlign = 'right';
        x.fillText(`${pTarget} hPa`, pad.l - 4, lastY + 3);
      });

      // 坐标轴与标尺
      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.3;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();
      x.fillStyle = '#1e2b36'; x.textAlign = 'center'; x.font = '11.5px "Noto Serif SC",serif';
      x.fillText(`陆地 (${atm.tLand.toFixed(1)}℃)`, pad.l + pw * 0.25, H - 10);
      x.fillText(`海洋 (${atm.tSea.toFixed(1)}℃)`, pad.l + pw * 0.75, H - 10);

      // 探空气球
      const bx = sx(probeX), by = sy(p.probeZ);
      const reading = atm.pAt(probeX, p.probeZ);
      x.strokeStyle = 'rgba(31,74,62,0.35)'; x.setLineDash([3, 3]);
      x.beginPath(); x.moveTo(pad.l, by); x.lineTo(pad.l + pw, by); x.stroke(); x.setLineDash([]);
      x.fillStyle = C.sky; x.strokeStyle = '#1e2b36'; x.lineWidth = 1.8;
      x.beginPath(); x.arc(bx, by, 8, 0, TAU); x.fill(); x.stroke();
      x.fillStyle = '#1f4a3e'; x.textAlign = bx > W * 0.65 ? 'right' : 'left';
      x.font = 'bold 11.5px Georgia,serif';
      x.fillText(`z=${p.probeZ}m · ${reading.p.toFixed(2)} hPa · ${reading.tC.toFixed(1)}℃`, bx + (bx > W * 0.65 ? -12 : 12), by - 4);
    });

    const sec2 = wb.section('2 · 陆地 vs 海洋气压-高度廓线对比 p(z)');
    const prof = wb.canvas(sec2, 540, 180, (x, W, H) => {
      const p = sp.params, atm = breezeAtmosphere(p.time, p.dT);
      const pad = { l: 52, r: 22, t: 22, b: 32 };
      const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      const sx = (pVal) => pad.l + ((pVal - 700) / 320) * pw;
      const sy = (z) => pad.t + ph - (z / 3000) * ph;

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.3;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();
      x.fillStyle = '#51606b'; x.font = '10.5px Georgia,serif'; x.textAlign = 'center';
      [720, 800, 900, 1000].forEach((pv) => x.fillText(`${pv} hPa`, sx(pv), H - 10));
      x.textAlign = 'right';
      [0, 1500, 3000].forEach((zv) => x.fillText(`${zv}m`, pad.l - 5, sy(zv) + 4));

      const drawCurve = (xf, col) => {
        x.strokeStyle = col; x.lineWidth = 2.2; x.beginPath();
        for (let z = 0; z <= 3000; z += 100) {
          const px = sx(atm.pAt(xf, z).p), py = sy(z);
          if (z === 0) x.moveTo(px, py); else x.lineTo(px, py);
        }
        x.stroke();
      };
      drawCurve(0.05, C.copper);
      drawCurve(0.95, C.blue);

      // 高亮当前探空高度处的海陆差值
      const pL = atm.pAt(0.05, p.probeZ).p, pS = atm.pAt(0.95, p.probeZ).p;
      x.fillStyle = C.copper; x.beginPath(); x.arc(sx(pL), sy(p.probeZ), 4.5, 0, TAU); x.fill();
      x.fillStyle = C.blue; x.beginPath(); x.arc(sx(pS), sy(p.probeZ), 4.5, 0, TAU); x.fill();
      x.fillStyle = '#1e2b36'; x.textAlign = 'right'; x.font = '11.5px "Noto Serif SC",serif';
      x.fillText(`棕线=陆地 · 蓝线=海洋 · 当前 ${p.probeZ}m Δp(陆−海)=${(pL - pS).toFixed(2)} hPa`, pad.l + pw, pad.t + 12);
    });

    const metrics = document.createElement('div');
    metrics.className = 'wb-metrics';
    sec2.append(metrics);

    const refresh = () => {
      cs.redraw();
      prof.redraw();
      const p = sp.params, atm = breezeAtmosphere(p.time, p.dT);
      const pL = atm.pAt(0.05, p.probeZ).p, pS = atm.pAt(0.95, p.probeZ).p;
      const dp = pL - pS;
      metrics.innerHTML = `
        <div class="wb-m"><span>气球所处探空高度</span><b>${p.probeZ} m (${probeX < 0.5 ? '陆域上空' : '海域上空'})</b></div>
        <div class="wb-m"><span>该高度陆 / 海气压</span><b>${pL.toFixed(2)} / ${pS.toFixed(2)} hPa</b></div>
        <div class="wb-m"><span>气压差 Δp(陆−海)</span><b>${dp >= 0 ? '+' : ''}${dp.toFixed(2)} hPa</b></div>
        <div class="wb-m"><span>水平气流方向</span><b>${Math.abs(dp) < 0.08 ? '过渡均衡层' : dp < 0 ? '海 → 陆' : '陆 → 海'}</b></div>`;
    };

    let dragging = false;
    const moveProbe = (ev) => {
      const pt = cs.toLocal(ev);
      probeX = clamp((pt.x - 50) / (540 - 72), 0.02, 0.98);
      const zNew = Math.round(clamp(((250 - 36 - pt.y) / (250 - 60)) * 3000, 0, 3000) / 100) * 100;
      wb.setParam('probeZ', zNew);
      refresh();
    };
    cs.cv.addEventListener('pointerdown', (e) => { dragging = true; cs.cv.setPointerCapture?.(e.pointerId); moveProbe(e); });
    cs.cv.addEventListener('pointermove', (e) => { if (dragging) moveProbe(e); });
    cs.cv.addEventListener('pointerup', () => { dragging = false; });

    bar.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (!act) return;
      if (act === 'flip') wb.press('bFlip');
      else if (act === 'surf') wb.setParam('probeZ', 100);
      else if (act === 'upper') wb.setParam('probeZ', 2400);
      else if (act === 'rec') wb.record(breeze.record.sample(sp.inst, sp.params));
      refresh();
    });

    let lastKey = '';
    refresh();
    return {
      update() {
        const k = `${sp.params.time}|${sp.params.dT}|${sp.params.probeZ}|${probeX.toFixed(2)}`;
        if (k !== lastKey) { lastKey = k; refresh(); }
      },
    };
  },
};

// ================================================================
// 3. geo-contour — 等高线地形图判读与任意剖面通视分析 (L3)
// ================================================================
const TERRAIN_HALF = 2.6;
// 解析高程场（米）：主峰(-0.95,-0.25) ~560m + 次峰(1.15,0.45) ~410m + 鞍部 + 西南山脊 + 东北山谷 + 东南陡崖
function terrainElevM(x, z) {
  const mainPeak = 535 * Math.exp(-((x + 0.95) ** 2 + (z + 0.25) ** 2) / 1.35);
  const subPeak = 385 * Math.exp(-((x - 1.15) ** 2 + (z - 0.45) ** 2) / 0.85);
  // 西南方向山脊延伸
  const ridge = 145 * Math.exp(-(((x + 1.45 - 0.35 * (z - 0.5)) ** 2) / 0.32 + ((z - 0.95) ** 2) / 1.55));
  // 东北方向凹陷山谷（使等高线向高处凸出）
  const valley = -115 * Math.exp(-(((x - 0.25 - 0.65 * (-z - 0.8)) ** 2) / 0.22 + ((z + 1.35) ** 2) / 1.3));
  // 东南陡崖阶跃
  const cliff = 95 * (0.5 - 0.5 * Math.tanh(((x - 0.95) * 0.65 + (z - 1.25) * 0.76) * 5.2));
  const base = 35 * Math.exp(-(x * x + z * z) / 8.0);
  return Math.max(0, mainPeak + subPeak + ridge + valley + cliff + base);
}

function terrainProfileAndLOS(ax, az, bx, bz, nSamples = 120) {
  const distScale = 200; // 1 地图单位 ≈ 200 m 实地水平距离
  const totalDist = Math.hypot(bx - ax, bz - az) * distScale;
  const zA = terrainElevM(ax, az), zB = terrainElevM(bx, bz);
  const samples = [];
  let maxSlope = 0, blocked = false, blockPt = null, maxExcess = 0;

  for (let i = 0; i <= nSamples; i++) {
    const t = i / nSamples;
    const x = lerp(ax, bx, t), z = lerp(az, bz, t);
    const elev = terrainElevM(x, z);
    const rayZ = lerp(zA, zB, t);
    const d = t * totalDist;
    if (i > 0) {
      const prev = samples[i - 1];
      const dd = Math.max(1e-3, d - prev.d);
      maxSlope = Math.max(maxSlope, Math.abs(elev - prev.elev) / dd);
    }
    if (i > 2 && i < nSamples - 2 && elev > rayZ + 1.5) {
      blocked = true;
      if (elev - rayZ > maxExcess) {
        maxExcess = elev - rayZ;
        blockPt = { t, d, elev, rayZ, x, z };
      }
    }
    samples.push({ t, d, elev, rayZ, x, z });
  }
  return { zA, zB, totalDist, maxSlope, slopeDeg: Math.atan(maxSlope) / DEG, blocked, blockPt, samples };
}

const contour = {
  id: 'geo-contour',
  subject: 'geo',
  title: '等高线地形图判读与任意剖面通视分析',
  en: 'Contour maps, profiles & line-of-sight',
  lede: [
    '用一组等间隔的水平面去切立体山体，把交线垂直投影到平面纸上，就得到了等高线地形图。线越密坡越陡，密至叠合处便是陡崖；两山顶间的低坳处则是鞍部。',
    '在展开实验台上，你可以任意拖拽 A、B 两点切割地形剖面线，实时检验坡度变化以及两地之间是否存在视线遮挡（通视分析）。',
  ],
  formula: 'tan α = Δh / Δd · 凸低为脊，凸高为谷',
  formulaNote: '相邻等高距 Δh 固定时，水平间距 Δd 越小则坡角 α 越陡；视线贴地高于中间山脊才可通视',
  terms: [
    ['山脊与山谷', '等高线弯曲处凸向低海拔区为山脊（分水岭）；凸向高海拔区为山谷（常发育河流）。'],
    ['鞍部与陡崖', '两座山峰之间形似马鞍的过渡地带为鞍部；多条等高线近乎重叠处为陡崖。'],
    ['通视分析', '沿 A–B 连线采样高程，若中间存在任一点高于 A–B 直线高程（尤以凸形山脊常见），则不通视。'],
  ],
  predict: {
    q: '在等高线地形图上判读一条“等高线向海拔更高处凸出”的弯曲地带，它是什么地形？若下雨，水流会向哪里汇集？',
    options: [
      '山脊；水流向两侧分流',
      '山谷；水流沿弯曲轴线向低处汇集形成溪流',
      '鞍部；水流停滞在最高点',
    ],
    answer: 1,
    why: '“凸高为谷，凸低为脊”。等高线向高值方向弯曲，说明轴线上比两侧海拔更低，正是谷地，降雨会沿谷线由高处向低处汇流。',
  },
  challenge: '升降蓝色水面找出主峰与次峰“恰好分离成两个独立闭环”的海拔（鞍部高度约 265 m）；再进工作台把 A、B 拖到山峰两侧测试“不通视”与“跨山谷通视”！',
  fig: '3D 立体火山岛地貌（左）、等高线地形图投影（右）与动态 A–B 剖面视线',
  hint: '调节截面海拔和等高距；在工作台拖拽绿点 A 与红点 B，3D 立体山体上的红色激光视线与标志桩会同步联动！',
  teach: {
    where: '人教版地理 必修第一册《地貌的观察》及初高中衔接等高线地形图判读与通视计算。',
    ask: [
      '如果将等高距从 100 m 改为 50 m，同一幅地形图上的等高线疏密会怎么变化？实际坡度改变了吗？',
      '为什么站在凹坡（上陡下缓）底部往往能看见山顶，而站在凸坡（上缓下陡）底部却看不见山顶？',
    ],
    simplify: '地形由主峰、次峰、山脊、山谷与东南陡崖解析场叠加而成，1 地图单位约合 200 m；通过 Marching Squares 实时追踪等高线。',
  },
  controls: [
    { id: 'h', label: '截面海拔', min: 0, max: 580, step: 10, value: 260, unit: 'm' },
    { id: 'step', type: 'choice', label: '等高距', options: ['50 m', '100 m', '200 m'], value: 1 },
    { id: 'cut', type: 'toggle', label: '水平截面', value: true },
    { id: 'bCrossPeak', type: 'button', label: '翻越主峰(遮挡)' },
    { id: 'bCrossValley', type: 'button', label: '跨谷通视' },
  ],
  record: {
    note: '记录每条 A–B 剖面线的起终点高差、水平距离、最大坡度及通视判定结果。',
    pending: '在工作台调整 A–B 剖面线后点击“记录当前 A–B 剖面”。',
    columns: [
      { key: 'elevA', label: 'A点海拔', unit: 'm', digits: 0 },
      { key: 'elevB', label: 'B点海拔', unit: 'm', digits: 0 },
      { key: 'dist', label: '水平距', unit: 'm', digits: 0 },
      { key: 'slope', label: '最大坡角', unit: '°', digits: 1, stat: true },
      { key: 'los', label: '通视判定' },
    ],
    sample: (inst) => {
      const pts = inst?.getAB?.() || { ax: -1.8, az: 0.6, bx: 1.5, bz: -0.6 };
      const res = terrainProfileAndLOS(pts.ax, pts.az, pts.bx, pts.bz, 100);
      return {
        _kind: 'human',
        elevA: res.zA,
        elevB: res.zB,
        dist: res.totalDist,
        slope: res.slopeDeg,
        los: res.blocked ? '遮挡不通视' : '通视畅通',
      };
    },
    summary: (rows) => [
      ['已测剖面条数', `${rows.length} 条`],
      ['通视畅通占比', rows.length ? `${Math.round((rows.filter((r) => r.los === '通视畅通').length / rows.length) * 100)}%` : '—'],
    ],
    errors: [
      '只看 A、B 两端高程差而忽略中间地形起伏（凸坡/山脊遮挡），误判为可以通视。',
    ],
  },

  build(k) {
    const p = k.p, X = -2.35, Z = -0.85, S = 4.5, N = 76;
    const k2 = (2 * TERRAIN_HALF) / S;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 768;
    const ctx = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;

    const geo = new THREE.PlaneGeometry(S, S, N, N).rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const mx = pos.getX(i) * k2, mz = pos.getZ(i) * k2;
      pos.setY(i, (terrainElevM(mx, mz) / 200) / k2);
    }
    geo.computeVertexNormals();
    const hill = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
    hill.castShadow = hill.receiveShadow = true;

    const mapMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 3.5).translate(0, 1.75, 0), new THREE.MeshBasicMaterial({ map: tex }));
    mapMesh.rotation.x = -0.8;

    const water = flat(new THREE.PlaneGeometry(S + 0.25, S + 0.25).rotateX(-Math.PI / 2), C.sky, { opacity: 0.28 });
    const pinA = flat(new THREE.SphereGeometry(0.11, 12, 8), C.leaf);
    const pinB = flat(new THREE.SphereGeometry(0.11, 12, 8), C.red);
    const sightRay = strip(2, { w: 0.04, color: C.red, opacity: 0.85, normal: [0, 1, 0] });
    const info = at(card('\n\n', { w: 3.8, size: 0.29, align: 'left' }), 2.55, 0, 2.85);
    k.root.add(
      at(hill, X, 0.03, Z),
      at(mapMesh, 2.65, 0, -1.35),
      at(water, X, 0, Z),
      pinA, pinB, sightRay, info,
      at(box(S + 0.2, 0.06, S + 0.2), X, -0.04, Z),
    );

    // 预计算等高线采样网格
    const G = 96;
    const grid = new Float32Array((G + 1) * (G + 1));
    for (let j = 0; j <= G; j++) {
      for (let i = 0; i <= G; i++) {
        const mx = -TERRAIN_HALF + (2 * TERRAIN_HALF * i) / G;
        const mz = -TERRAIN_HALF + (2 * TERRAIN_HALF * j) / G;
        grid[j * (G + 1) + i] = terrainElevM(mx, mz);
      }
    }

    const traceLevel = (lv) => {
      const c = cv.width / G;
      ctx.beginPath();
      for (let j = 0; j < G; j++) {
        for (let i = 0; i < G; i++) {
          const a = grid[j * (G + 1) + i], b = grid[j * (G + 1) + i + 1];
          const d = grid[(j + 1) * (G + 1) + i], e = grid[(j + 1) * (G + 1) + i + 1];
          const pts = [];
          if ((a < lv) !== (b < lv)) pts.push([i + (lv - a) / (b - a), j]);
          if ((b < lv) !== (e < lv)) pts.push([i + 1, j + (lv - b) / (e - b)]);
          if ((d < lv) !== (e < lv)) pts.push([i + (lv - d) / (e - d), j + 1]);
          if ((a < lv) !== (d < lv)) pts.push([i, j + (lv - a) / (d - a)]);
          for (let q = 0; q + 1 < pts.length; q += 2) {
            ctx.moveTo(pts[q][0] * c, pts[q][1] * c);
            ctx.lineTo(pts[q + 1][0] * c, pts[q + 1][1] * c);
          }
        }
      }
      ctx.stroke();
    };

    const ab = { ax: -1.75, az: 0.7, bx: 1.55, bz: -0.45 };
    const toUV = (mx, mz) => [((mx + TERRAIN_HALF) / (2 * TERRAIN_HALF)) * 768, ((mz + TERRAIN_HALF) / (2 * TERRAIN_HALF)) * 768];
    const toWorld = (mx, mz, elevM) => [X + mx / k2, 0.05 + (elevM / 200) / k2, Z + mz / k2];

    let last = '';
    const draw = () => {
      const st = [50, 100, 200][p.step];
      ctx.fillStyle = '#fdfaf2'; ctx.fillRect(0, 0, 768, 768);
      ctx.strokeStyle = '#1e2b36'; ctx.lineCap = 'round';
      for (let lv = st; lv < 590; lv += st) {
        ctx.lineWidth = lv % (st * 5) === 0 || st === 200 ? 3.0 : 1.7;
        traceLevel(lv);
      }
      if (p.cut && p.h > 0) {
        ctx.strokeStyle = '#2f7fe0'; ctx.lineWidth = 6;
        traceLevel(p.h + 0.01);
      }
      // 山峰、鞍部、山脊、山谷、陡崖注记
      ctx.fillStyle = '#b4653a'; ctx.font = 'bold 20px Georgia,serif'; ctx.textAlign = 'center';
      [[-0.95, -0.25], [1.15, 0.45]].forEach(([px, pz]) => {
        const [u, v] = toUV(px, pz);
        ctx.fillText('▲', u, v + 7);
        ctx.fillText(`${Math.round(terrainElevM(px, pz))}`, u, v - 14);
      });
      // A–B 剖面连线
      const [au, av] = toUV(ab.ax, ab.az), [bu, bv] = toUV(ab.bx, ab.bz);
      const los = terrainProfileAndLOS(ab.ax, ab.az, ab.bx, ab.bz, 80);
      ctx.strokeStyle = los.blocked ? '#e5483f' : '#1f4a3e';
      ctx.lineWidth = 4; ctx.setLineDash([12, 8]);
      ctx.beginPath(); ctx.moveTo(au, av); ctx.lineTo(bu, bv); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.leaf; ctx.beginPath(); ctx.arc(au, av, 10, 0, TAU); ctx.fill();
      ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(bu, bv, 10, 0, TAU); ctx.fill();

      ctx.strokeStyle = '#1e2b36'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, 762, 762);
      tex.needsUpdate = true;

      const wA = toWorld(ab.ax, ab.az, los.zA), wB = toWorld(ab.bx, ab.bz, los.zB);
      pinA.position.set(...wA);
      pinB.position.set(...wB);
      sightRay.set([wA, wB]);
      sightRay.material.color.set(los.blocked ? C.red : C.leaf);
    };

    const sync = () => {
      const key = `${p.h}|${p.step}|${p.cut}|${ab.ax.toFixed(2)},${ab.az.toFixed(2)},${ab.bx.toFixed(2)},${ab.bz.toFixed(2)}`;
      if (key !== last) { last = key; draw(); }
      water.visible = p.cut;
      water.position.y = 0.03 + (p.h / 200) / k2;
      const los = terrainProfileAndLOS(ab.ax, ab.az, ab.bx, ab.bz, 60);
      const saddleH = Math.round(terrainElevM(0.2, 0.12));
      const peaksAbove = (p.h < terrainElevM(-0.95, -0.25) ? 1 : 0) + (p.h < terrainElevM(1.15, 0.45) ? 1 : 0);
      const floodMsg = peaksAbove === 0 ? '高过所有山顶' : p.h > saddleH + 15 && peaksAbove === 2 ? '主次峰分离（各自闭环）' : peaksAbove === 2 ? '两峰经鞍部连成一体' : '仅主峰露出水面';
      info.set(`水位 ${p.h} m：${floodMsg}\nA–B 剖面：${los.blocked ? '被山脊遮挡（不通视）' : '视线畅通（可通视）'}`);
    };

    sync();
    return {
      getAB: () => ({ ...ab }),
      setAB(ax, az, bx, bz) {
        ab.ax = clamp(ax, -2.4, 2.4); ab.az = clamp(az, -2.4, 2.4);
        ab.bx = clamp(bx, -2.4, 2.4); ab.bz = clamp(bz, -2.4, 2.4);
        sync();
        k.dirty();
      },
      press(id) {
        if (id === 'bCrossPeak') {
          ab.ax = -1.85; ab.az = -0.35; ab.bx = 0.45; ab.bz = 0.15;
          sync(); k.dirty();
        } else if (id === 'bCrossValley') {
          ab.ax = -0.35; ab.az = -1.65; ab.bx = 1.45; ab.bz = -0.85;
          sync(); k.dirty();
        }
      },
      change() { sync(); k.dirty(); },
      update() {},
      margin() {
        const los = terrainProfileAndLOS(ab.ax, ab.az, ab.bx, ab.bz, 60);
        return [
          `等高距 ${[50, 100, 200][p.step]} m`,
          `主峰 ${Math.round(terrainElevM(-0.95, -0.25))} m`,
          `次峰 ${Math.round(terrainElevM(1.15, 0.45))} m`,
          `鞍部约 ${Math.round(terrainElevM(0.2, 0.12))} m`,
          `最大坡角 ${los.slopeDeg.toFixed(1)}°`,
          los.blocked ? 'A→B：阻塞不通视' : 'A→B：通视畅通',
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 等高线地形图（拖拽绿点 A 与红点 B 任意切割剖面）');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn primary" data-act="peak">预设：翻越主峰（不通视）</button>
      <button type="button" class="wb-btn" data-act="valley">预设：跨山谷（可通视）</button>
      <button type="button" class="wb-btn" data-act="cliff">预设：东南陡崖剖面</button>
      <button type="button" class="wb-btn" data-act="rec">记录当前 A–B 剖面</button>`;
    sec1.append(bar);

    const mapCv = wb.canvas(sec1, 520, 310, (x, W, H) => {
      const p = sp.params;
      const ab = sp.inst?.getAB?.() || { ax: -1.75, az: 0.7, bx: 1.55, bz: -0.45 };
      const size = 276, ox = (W - size) / 2, oy = 16;
      const toPx = (mx, mz) => [ox + ((mx + TERRAIN_HALF) / (2 * TERRAIN_HALF)) * size, oy + ((mz + TERRAIN_HALF) / (2 * TERRAIN_HALF)) * size];

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      // 栅格高程填色与等高线
      const st = [50, 100, 200][p.step];
      const G = 72, cw = size / G;
      const grid = new Float32Array((G + 1) * (G + 1));
      for (let j = 0; j <= G; j++) {
        for (let i = 0; i <= G; i++) {
          grid[j * (G + 1) + i] = terrainElevM(-TERRAIN_HALF + (2 * TERRAIN_HALF * i) / G, -TERRAIN_HALF + (2 * TERRAIN_HALF * j) / G);
        }
      }
      x.strokeStyle = '#1e2b36';
      for (let lv = st; lv < 590; lv += st) {
        x.lineWidth = lv % (st * 5) === 0 || st === 200 ? 1.8 : 0.9;
        x.beginPath();
        for (let j = 0; j < G; j++) {
          for (let i = 0; i < G; i++) {
            const a = grid[j * (G + 1) + i], b = grid[j * (G + 1) + i + 1];
            const d = grid[(j + 1) * (G + 1) + i], e = grid[(j + 1) * (G + 1) + i + 1];
            const pts = [];
            if ((a < lv) !== (b < lv)) pts.push([i + (lv - a) / (b - a), j]);
            if ((b < lv) !== (e < lv)) pts.push([i + 1, j + (lv - b) / (e - b)]);
            if ((d < lv) !== (e < lv)) pts.push([i + (lv - d) / (e - d), j + 1]);
            if ((a < lv) !== (d < lv)) pts.push([i, j + (lv - a) / (d - a)]);
            for (let q = 0; q + 1 < pts.length; q += 2) {
              x.moveTo(ox + pts[q][0] * cw, oy + pts[q][1] * cw);
              x.lineTo(ox + pts[q + 1][0] * cw, oy + pts[q + 1][1] * cw);
            }
          }
        }
        x.stroke();
      }
      if (p.cut && p.h > 0) {
        x.strokeStyle = C.sky; x.lineWidth = 2.4; x.beginPath();
        for (let j = 0; j < G; j++) {
          for (let i = 0; i < G; i++) {
            const a = grid[j * (G + 1) + i], b = grid[j * (G + 1) + i + 1];
            const d = grid[(j + 1) * (G + 1) + i], e = grid[(j + 1) * (G + 1) + i + 1];
            const pts = [];
            if ((a < p.h) !== (b < p.h)) pts.push([i + (p.h - a) / (b - a), j]);
            if ((b < p.h) !== (e < p.h)) pts.push([i + 1, j + (p.h - b) / (e - b)]);
            if ((d < p.h) !== (e < p.h)) pts.push([i + (p.h - d) / (e - d), j + 1]);
            if ((a < p.h) !== (d < p.h)) pts.push([i, j + (p.h - a) / (d - a)]);
            for (let q = 0; q + 1 < pts.length; q += 2) {
              x.moveTo(ox + pts[q][0] * cw, oy + pts[q][1] * cw);
              x.lineTo(ox + pts[q + 1][0] * cw, oy + pts[q + 1][1] * cw);
            }
          }
        }
        x.stroke();
      }

      // 五种地形要素清晰标注
      x.font = 'bold 11px "Noto Serif SC",serif'; x.textAlign = 'center';
      [
        [-0.95, -0.25, '▲主峰', C.copper],
        [1.15, 0.45, '▲次峰', C.copper],
        [0.2, 0.12, '鞍部', '#51606b'],
        [-1.4, 1.15, '山脊', '#1f4a3e'],
        [0.6, -1.5, '山谷(流向↗)', C.blue],
        [1.15, 1.35, '陡崖', C.red],
      ].forEach(([mx, mz, txt, col]) => {
        const [px, py] = toPx(mx, mz);
        x.fillStyle = col; x.fillText(txt, px, py);
      });

      // A–B 剖面连线
      const los = terrainProfileAndLOS(ab.ax, ab.az, ab.bx, ab.bz, 100);
      const [axp, ayp] = toPx(ab.ax, ab.az), [bxp, byp] = toPx(ab.bx, ab.bz);
      x.strokeStyle = los.blocked ? C.red : C.green; x.lineWidth = 2.4; x.setLineDash([6, 4]);
      x.beginPath(); x.moveTo(axp, ayp); x.lineTo(bxp, byp); x.stroke(); x.setLineDash([]);
      if (los.blockPt) {
        const [oxp, oyp] = toPx(los.blockPt.x, los.blockPt.z);
        x.fillStyle = C.red; x.fillText('✕遮挡', oxp, oyp - 10);
      }
      [[axp, ayp, 'A', C.leaf], [bxp, byp, 'B', C.red]].forEach(([px, py, lbl, col]) => {
        x.fillStyle = col; x.strokeStyle = '#1e2b36'; x.lineWidth = 1.6;
        x.beginPath(); x.arc(px, py, 8, 0, TAU); x.fill(); x.stroke();
        x.fillStyle = '#fff'; x.font = 'bold 10.5px Georgia,serif'; x.fillText(lbl, px, py + 3.5);
      });
      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.5; x.strokeRect(ox, oy, size, size);
    });

    const sec2 = wb.section('2 · A–B 地形高程剖面图与视线通视 (LOS) 判定');
    const profCv = wb.canvas(sec2, 520, 190, (x, W, H) => {
      const ab = sp.inst?.getAB?.() || { ax: -1.75, az: 0.7, bx: 1.55, bz: -0.45 };
      const los = terrainProfileAndLOS(ab.ax, ab.az, ab.bx, ab.bz, 120);
      const pad = { l: 48, r: 22, t: 24, b: 32 };
      const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      const sx = (d) => pad.l + (d / Math.max(1, los.totalDist)) * pw;
      const sy = (elev) => pad.t + ph - (elev / 620) * ph;

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      // 剖面山体阴影填充
      x.fillStyle = 'rgba(180,101,58,0.2)';
      x.beginPath(); x.moveTo(pad.l, pad.t + ph);
      los.samples.forEach((s) => x.lineTo(sx(s.d), sy(s.elev)));
      x.lineTo(pad.l + pw, pad.t + ph); x.closePath(); x.fill();

      // 地形轮廓线
      x.strokeStyle = '#1e2b36'; x.lineWidth = 2.1; x.beginPath();
      los.samples.forEach((s, i) => (i === 0 ? x.moveTo(sx(s.d), sy(s.elev)) : x.lineTo(sx(s.d), sy(s.elev))));
      x.stroke();

      // 视线 A->B 射线
      x.strokeStyle = los.blocked ? C.red : C.green; x.lineWidth = 2; x.setLineDash([5, 4]);
      x.beginPath(); x.moveTo(sx(0), sy(los.zA)); x.lineTo(sx(los.totalDist), sy(los.zB)); x.stroke(); x.setLineDash([]);

      if (los.blockPt) {
        x.fillStyle = C.red;
        x.beginPath(); x.arc(sx(los.blockPt.d), sy(los.blockPt.elev), 5.5, 0, TAU); x.fill();
      }
      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.2;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();
      x.fillStyle = '#51606b'; x.font = '10.5px Georgia,serif'; x.textAlign = 'right';
      [0, 200, 400, 600].forEach((ev) => x.fillText(`${ev}m`, pad.l - 5, sy(ev) + 4));
      x.textAlign = 'center';
      x.fillText(`A (0m · ${Math.round(los.zA)}m)`, pad.l + 32, H - 10);
      x.fillText(`B (${Math.round(los.totalDist)}m · ${Math.round(los.zB)}m)`, pad.l + pw - 36, H - 10);

      x.fillStyle = los.blocked ? C.red : '#1f4a3e';
      x.font = 'bold 12px "Noto Serif SC",serif';
      x.fillText(los.blocked ? `视线被阻挡（中间山体高出视线 ${Math.round(los.blockPt.elev - los.blockPt.rayZ)} m）` : 'A → B 视线无阻挡，完全通视！', pad.l + pw / 2, pad.t + 12);
    });

    const metrics = document.createElement('div');
    metrics.className = 'wb-metrics';
    sec2.append(metrics);

    const refresh = () => {
      mapCv.redraw();
      profCv.redraw();
      const ab = sp.inst?.getAB?.() || { ax: -1.75, az: 0.7, bx: 1.55, bz: -0.45 };
      const los = terrainProfileAndLOS(ab.ax, ab.az, ab.bx, ab.bz, 100);
      metrics.innerHTML = `
        <div class="wb-m"><span>起终点高程 (A / B)</span><b>${Math.round(los.zA)} m / ${Math.round(los.zB)} m</b></div>
        <div class="wb-m"><span>A–B 水平距离</span><b>${Math.round(los.totalDist)} m</b></div>
        <div class="wb-m"><span>沿线最大坡角</span><b>${los.slopeDeg.toFixed(1)}° (tan α=${los.maxSlope.toFixed(2)})</b></div>
        <div class="wb-m"><span>通视测试 (LOS)</span><b>${los.blocked ? '✕ 存在遮挡' : '✓ 通视畅通'}</b></div>`;
    };

    let dragPin = null;
    const toMapCoord = (pt) => {
      const size = 276, ox = (520 - size) / 2, oy = 16;
      return [
        clamp(((pt.x - ox) / size) * 2 * TERRAIN_HALF - TERRAIN_HALF, -2.4, 2.4),
        clamp(((pt.y - oy) / size) * 2 * TERRAIN_HALF - TERRAIN_HALF, -2.4, 2.4),
      ];
    };
    mapCv.cv.addEventListener('pointerdown', (e) => {
      const pt = mapCv.toLocal(e);
      const ab = sp.inst?.getAB?.() || { ax: -1.75, az: 0.7, bx: 1.55, bz: -0.45 };
      const size = 276, ox = (520 - size) / 2, oy = 16;
      const pxA = ox + ((ab.ax + TERRAIN_HALF) / (2 * TERRAIN_HALF)) * size;
      const pyA = oy + ((ab.az + TERRAIN_HALF) / (2 * TERRAIN_HALF)) * size;
      const pxB = ox + ((ab.bx + TERRAIN_HALF) / (2 * TERRAIN_HALF)) * size;
      const pyB = oy + ((ab.bz + TERRAIN_HALF) / (2 * TERRAIN_HALF)) * size;
      dragPin = Math.hypot(pt.x - pxA, pt.y - pyA) <= Math.hypot(pt.x - pxB, pt.y - pyB) ? 'A' : 'B';
      mapCv.cv.setPointerCapture?.(e.pointerId);
      const [mx, mz] = toMapCoord(pt);
      if (dragPin === 'A') sp.inst?.setAB?.(mx, mz, ab.bx, ab.bz);
      else sp.inst?.setAB?.(ab.ax, ab.az, mx, mz);
      refresh();
    });
    mapCv.cv.addEventListener('pointermove', (e) => {
      if (!dragPin) return;
      const ab = sp.inst?.getAB?.(); if (!ab) return;
      const [mx, mz] = toMapCoord(mapCv.toLocal(e));
      if (dragPin === 'A') sp.inst?.setAB?.(mx, mz, ab.bx, ab.bz);
      else sp.inst?.setAB?.(ab.ax, ab.az, mx, mz);
      refresh();
    });
    mapCv.cv.addEventListener('pointerup', () => { dragPin = null; });

    bar.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (!act) return;
      if (act === 'peak') sp.inst?.setAB?.(-1.85, -0.35, 0.45, 0.15);
      else if (act === 'valley') sp.inst?.setAB?.(-0.35, -1.65, 1.45, -0.85);
      else if (act === 'cliff') sp.inst?.setAB?.(0.75, 0.65, 1.85, 1.95);
      else if (act === 'rec') wb.record(contour.record.sample(sp.inst, sp.params));
      refresh();
    });

    let lastKey = '';
    refresh();
    return {
      update() {
        const ab = sp.inst?.getAB?.() || {};
        const k = `${sp.params.h}|${sp.params.step}|${sp.params.cut}|${ab.ax?.toFixed(2)}|${ab.az?.toFixed(2)}|${ab.bx?.toFixed(2)}|${ab.bz?.toFixed(2)}`;
        if (k !== lastKey) { lastKey = k; refresh(); }
      },
    };
  },
};

// ================================================================
// 4. geo-moon — 月相变化、潮汐与白道交角食限 (L3)
// ================================================================
const LUNAR_DAYS = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

function lunarState(d, inclOn, nodeDeg) {
  const E = TAU * ((d - 1) / 29.53); // 朔望角：0=新月，PI=满月
  const f = (1 - Math.cos(E)) / 2;
  const incDeg = inclOn ? 5.14 : 0;
  const betaDeg = incDeg * Math.sin(E - nodeDeg * DEG); // 黄纬（度）
  // 简化日食/月食发生食限判据：在朔/望 ±10° 内且黄纬 |β| < 1.5°
  const nearNew = Math.abs(Math.sin(E / 2)) < 0.14;
  const nearFull = Math.abs(Math.cos(E / 2)) < 0.14;
  const inEclipsePlane = Math.abs(betaDeg) < 1.55;
  const solarEclipse = nearNew && inEclipsePlane;
  const lunarEclipse = nearFull && inEclipsePlane;
  // 潮汐谐波：太阳引潮力约占月球 0.46 倍，双峰合成振幅 |1 + 0.46 e^{i 2E}|
  const tideAmp = Math.hypot(1 + 0.46 * Math.cos(2 * E), 0.46 * Math.sin(2 * E));
  const tideType = tideAmp > 1.28 ? '朔望大潮' : tideAmp < 0.72 ? '上下弦小潮' : '过渡潮';
  const name = f < 0.03 ? '新月（朔）' : f > 0.97 ? '满月（望）'
    : Math.abs(f - 0.5) < 0.06 ? (E < Math.PI ? '上弦月' : '下弦月')
      : f < 0.5 ? (E < Math.PI ? '蛾眉月' : '残月') : (E < Math.PI ? '盈凸月' : '亏凸月');
  const rise = (6 + (24 * E) / TAU) % 24;
  return { E, f, incDeg, betaDeg, solarEclipse, lunarEclipse, tideAmp, tideType, name, rise };
}

const moon = {
  id: 'geo-moon',
  subject: 'geo',
  title: '月相变化、潮汐与白道交角食限',
  en: 'Lunar phases, tides & eclipse inclination',
  lede: [
    '月球永远有半个球被太阳照亮，随着它每 29.53 天绕地球公转一圈，我们看到的亮面比例经历新月、上弦、满月、下弦的周期盈亏。',
    '月球公转轨道面（白道）与地球公转轨道面（黄道）之间存在约 5.1° 的夹角。正因为这 5.1° 倾角，绝大多数初一和十五月球从地球影锥或太阳视线上下掠过，不会月月发生日月食；而日月引潮力叠加则周期性造就大潮与小潮。',
  ],
  formula: 'T_朔望 = 29.53 d · f_亮 = ½(1 − cos E) · 白道倾角 i ≈ 5.14°',
  formulaNote: '仅当朔望日恰逢白道交点（黄纬 |β| < 1.5° 食限）才发生日月食；朔望大潮振幅约为上下弦小潮的 2.7 倍',
  terms: [
    ['黄白交角 5.1°', '白道面与黄道面的平均夹角（5°09′），解释为何不是每逢初一有日食、每逢十五有月食。'],
    ['上上上西西', '上弦月出现在上半月上半夜的西边天空，西（右）半边亮；下弦月则在下半月下半夜东天，东（左）半边亮。'],
    ['大潮与小潮', '朔（初一）与望（十五）时日地月共线，引潮力叠加成大潮；上下弦垂直相消成小潮。'],
  ],
  predict: {
    q: '如果月球白道面与黄道面完全重合（倾角由 5.1° 变为 0°），每个农历月会发生什么现象？',
    options: [
      '月亮不再有盈亏变化',
      '每个初一都会发生日食，每个十五都会发生月食',
      '不再出现大潮和小潮的差别',
    ],
    answer: 1,
    why: '若白道与黄道夹角为 0°，日地月每逢朔望必定严格成一直线，月球本影必然扫过地球（日食），地球本影也必定遮住满月（月食）。5.1° 倾角让日月食成为稀有天象。',
  },
  challenge: '关闭“白道 5.1° 倾角”观察月月有食的假想情形；再开启 5.1° 倾角，旋转交点线位置，找出交点落在日地连线附近时的“食季”月食红月亮！',
  fig: '日地月三维空间轨道（含 5.1° 白道面、引潮力海水椭球、地球影锥与右侧月相望远镜视图）',
  hint: '拖动农历日期或切换白道倾角；进入工作台直观比对白道侧视食限几何与 24 小时潮汐谐波叠加曲线。',
  teach: {
    where: '人教版地理 必修第一册 第一章《宇宙中的地球》拓展：月相规律、白道黄道交角与海洋潮汐（选必衔接）。',
    ask: [
      '在海南海口赶海，为什么选择农历初一或十五前后退潮时收获最丰？（从大潮潮差最大解释）',
      '月全食时，为何满月不会完全变黑，而是变成暗古铜色的“红月亮”？',
    ],
    simplify: '三维天体尺寸、地月距与白道倾角（3D 视觉放大为约 15° 便于俯仰判读，数值计算严格采用 5.14°）均作教学示意比例。',
  },
  controls: [
    { id: 'd', label: '农历日期', min: 1, max: 30, step: 0.1, value: 8, fmt: (v) => LUNAR_DAYS[Math.min(29, Math.floor(v) - 1)] },
    { id: 'incl', type: 'toggle', label: '白道 5.1° 倾角', value: true },
    { id: 'node', label: '交点线方位 Ω', min: 0, max: 360, step: 5, value: 90, unit: '°' },
    { id: 'auto', type: 'toggle', label: '月球公转', value: false },
    { id: 'bNew', type: 'button', label: '初一 新月' },
    { id: 'bFirst', type: 'button', label: '初八 上弦' },
    { id: 'bFull', type: 'button', label: '十五 满月' },
    { id: 'bLast', type: 'button', label: '廿三 下弦' },
    { id: 'bEcl', type: 'button', label: '对齐交点(食季)' },
  ],
  record: {
    note: '记录农历日期、月相名称、白道黄纬 β、潮汐振幅系数及是否命中日月食食限。',
    pending: '在工作台点击“记录当前月相与潮汐”即可归档数据。',
    columns: [
      { key: 'lunar', label: '农历' },
      { key: 'phase', label: '月相' },
      { key: 'beta', label: '白道黄纬 β', unit: '°', digits: 2 },
      { key: 'tide', label: '相对潮差', digits: 2, stat: true },
      { key: 'tideType', label: '潮汐类型' },
      { key: 'eclipse', label: '食象判定' },
    ],
    sample: (_inst, p) => {
      const s = lunarState(p.d, p.incl, p.node);
      return {
        _kind: 'human',
        lunar: LUNAR_DAYS[Math.min(29, Math.floor(p.d) - 1)],
        phase: s.name,
        beta: s.betaDeg,
        tide: s.tideAmp,
        tideType: s.tideType,
        eclipse: s.solarEclipse ? '日食发生' : s.lunarEclipse ? '月食发生' : '无日月食',
      };
    },
    summary: (rows) => [
      ['已录入月相记录', `${rows.length} 条`],
      ['命中日月食次数', `${rows.filter((r) => r.eclipse !== '无日月食').length} 次`],
    ],
    errors: [
      '误认为初一和十五必然有日月食：忽略了 5.14° 白道交角导致大多数时候月球处于黄道面上方或下方。',
    ],
  },

  build(k) {
    const p = k.p, Y = 1.9, Z = -0.9, R = 2.95, X = 0.25;
    const half = (r) => flat(new THREE.SphereGeometry(r * 1.035, 28, 14, 0, TAU, 0, Math.PI / 2), '#1e2b36', { opacity: 0.5 });
    const nE = half(0.56), nM = half(0.28);
    nE.rotation.z = -Math.PI / 2; nM.rotation.z = -Math.PI / 2;

    // 地球与动态引潮力海水椭球（沿日/月引潮方向拉伸）
    const tideShell = flat(new THREE.SphereGeometry(0.68, 28, 18), C.sky, { opacity: 0.34 });
    const earth = at(group(ball(0.56), nE, tideShell, at(cyl(0.045, Y - 0.56, C.ink), 0, -Y, 0)), X, Y, Z);
    const moonG = group(ball(0.28, '#f3efe2'), nM);

    // 地球背面本影锥示意（+X 方向）
    const shadowCone = at(rot(flat(new THREE.ConeGeometry(0.55, 3.6, 24, 1, true).translate(0, 1.8, 0), '#1e2b36', { opacity: 0.16 }), 0, 0, -Math.PI / 2), X, Y, Z);

    // 黄道基准圈（水平）+ 白道倾斜轨道圈
    const eclipticRing = at(torus(R, 0.012, C.ink), X, Y, Z);
    const orbitPivot = at(group(), X, Y, Z);
    const whiteRing = torus(R, 0.02, C.copper);
    orbitPivot.add(whiteRing);

    const sight = strip(2, { w: 0.032, color: C.ink, opacity: 0.5, normal: [0, 1, 0] });
    k.root.add(earth, moonG, shadowCone, eclipticRing, orbitPivot, sight, at(cyl(0.45, 0.09, C.shade), X, 0, Z));
    for (let i = 0; i < 4; i++) k.root.add(arrow(C.amber, 0.045).set([-4.5, Y, Z - 2.2 + i * 1.45], [-3.5, Y, Z - 2.2 + i * 1.45]));
    k.root.add(at(note('太阳光', { size: 0.3, color: C.copper }), -4.0, Y + 1.4, Z - 2.2));

    const view = at(sheet(2.4, 2.4, () => {}, { lay: 'tilt', opaque: true, ink: true }), 3.25, 0, 2.55);
    const info = at(card('\n\n\n', { w: 4.1, size: 0.28, align: 'left' }), -1.0, 0, 2.95);
    k.root.add(view, info);

    let lastViewKey = '';
    const st = {};
    const sync = () => {
      const s = lunarState(p.d, p.incl, p.node);
      Object.assign(st, s);
      // 3D 视觉倾角：开启 5.1° 时放大至 15° 以便清晰看出“绕过地球影锥”与“穿过影锥”的差别
      const visTilt = p.incl ? 15 * DEG : 0;
      const nodeRad = p.node * DEG;
      orbitPivot.rotation.set(0, -nodeRad, 0);
      whiteRing.rotation.x = visTilt;

      const mx = X - R * Math.cos(s.E);
      const mz = Z + R * Math.sin(s.E);
      const my = Y + R * Math.sin(visTilt) * Math.sin(s.E - nodeRad);
      moonG.position.set(mx, my, mz);
      sight.set([[X, Y, Z], [mx, my, mz]]);

      // 引潮力海水椭球拉伸：沿月亮方向拉伸，朔望时与太阳叠加最明显
      tideShell.rotation.y = s.E;
      tideShell.scale.set(1 + 0.22 * s.tideAmp, 0.94, 1 - 0.1 * s.tideAmp);

      const vk = `${s.E.toFixed(2)}|${s.lunarEclipse}|${s.solarEclipse}`;
      if (vk !== lastViewKey) {
        lastViewKey = vk;
        view.redraw((x, S, w, h) => {
          const c = (w * S) / 2, r = c * 0.72, wax = s.E < Math.PI;
          x.fillStyle = '#14171c'; x.fillRect(0, 0, w * S, h * S);
          if (s.solarEclipse) {
            x.fillStyle = '#ffb52e'; x.beginPath(); x.arc(c, c, r * 1.12, 0, TAU); x.fill();
            x.fillStyle = '#14171c'; x.beginPath(); x.arc(c, c, r * 0.96, 0, TAU); x.fill();
            x.fillStyle = '#fffdf7'; x.font = `bold ${S * 0.22}px "Songti SC",serif`; x.textAlign = 'center';
            x.fillText('日食', c, S * 0.25);
            return;
          }
          x.fillStyle = s.lunarEclipse ? '#6b2019' : '#3a3f48';
          x.beginPath(); x.arc(c, c, r, 0, TAU); x.fill();
          if (!s.lunarEclipse) {
            x.fillStyle = '#f6efd6';
            x.beginPath();
            x.arc(c, c, r, -Math.PI / 2, Math.PI / 2, !wax);
            x.ellipse(c, c, Math.abs(Math.cos(s.E)) * r, r, 0, Math.PI / 2, -Math.PI / 2, (Math.cos(s.E) > 0) === wax);
            x.fill();
          } else {
            x.fillStyle = '#ff9878'; x.font = `bold ${S * 0.2}px "Songti SC",serif`; x.textAlign = 'center';
            x.fillText('月全食(红月)', c, S * 0.25);
          }
        });
      }

      const eclMsg = s.solarEclipse ? '★ 命中食限：发生日食！' : s.lunarEclipse ? '★ 命中食限：发生月食！'
        : `黄纬 β = ${s.betaDeg.toFixed(1)}°（${Math.abs(s.betaDeg) < 1.55 ? '食限内' : '偏离黄道，无食'}）`;
      info.set(`${LUNAR_DAYS[Math.min(29, Math.floor(p.d) - 1)]} · ${s.name} (亮面 ${(s.f * 100).toFixed(0)}%)\n${eclMsg}\n${s.tideType}（潮差系数 ${s.tideAmp.toFixed(2)}）`);
    };

    sync();
    return {
      press(id) {
        if (id === 'bNew') k.set('d', 1);
        else if (id === 'bFirst') k.set('d', 8.4);
        else if (id === 'bFull') k.set('d', 15.8);
        else if (id === 'bLast') k.set('d', 23.1);
        else if (id === 'bEcl') { k.set('node', 0); k.set('d', 15.8); }
        sync();
        k.dirty();
      },
      change() { sync(); k.dirty(); },
      update(dt) {
        if (p.auto && dt > 0) {
          k.set('d', ((p.d - 1 + dt * 1.8) % 29.53) + 1);
          sync();
        }
      },
      margin() {
        return [
          `${LUNAR_DAYS[Math.min(29, Math.floor(p.d) - 1)]} · ${st.name || ''}`,
          `白道倾角 ${p.incl ? '5.14° (真实)' : '0° (假想共面)'}`,
          `黄纬 β = ${(st.betaDeg || 0).toFixed(2)}°`,
          `潮汐：${st.tideType || ''}`,
          `月出约 ${Math.round(st.rise || 0) % 24} 时`,
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 白道 5.14° 倾角与日月食食限侧视几何');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn primary" data-act="toggleIncl">切换 5.1° / 0° 倾角</button>
      <button type="button" class="wb-btn" data-act="new">跳至初一 (朔)</button>
      <button type="button" class="wb-btn" data-act="full">跳至十五 (望)</button>
      <button type="button" class="wb-btn" data-act="align">交点对齐 (食季)</button>
      <button type="button" class="wb-btn" data-act="rec">记录当前月相与潮汐</button>`;
    sec1.append(bar);

    const sideCv = wb.canvas(sec1, 520, 185, (x, W, H) => {
      const p = sp.params, s = lunarState(p.d, p.incl, p.node);
      x.fillStyle = '#141a22'; x.fillRect(0, 0, W, H);
      const cy = H / 2, ex = 260;

      // 太阳方向 + 黄道基准线
      x.strokeStyle = 'rgba(255,181,46,0.45)'; x.setLineDash([5, 4]);
      x.beginPath(); x.moveTo(20, cy); x.lineTo(W - 20, cy); x.stroke(); x.setLineDash([]);
      x.fillStyle = C.amber; x.font = '11px "Noto Serif SC",serif';
      x.fillText('← 太阳平行光', 20, cy - 12);

      // 地球与±1.55° 食限影带
      x.fillStyle = 'rgba(58,156,255,0.14)';
      x.fillRect(20, cy - 22, W - 40, 44);
      x.fillStyle = '#8fb8e8'; x.textAlign = 'right';
      x.fillText('地影 / 日月食食限区 (|β| < 1.55°)', W - 18, cy - 28);

      x.fillStyle = C.sky; x.beginPath(); x.arc(ex, cy, 18, 0, TAU); x.fill();
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.fillText('地球', ex, cy + 32);

      // 侧视白道投影（按真实 5.14° 放大展示相对偏移）
      const mx = ex - Math.cos(s.E) * 165;
      const my = cy - s.betaDeg * 9.5;
      x.strokeStyle = 'rgba(255,255,255,0.28)'; x.lineWidth = 1.4;
      x.beginPath(); x.moveTo(ex - 175, cy - s.incDeg * 9.5 * Math.cos(p.node * DEG)); x.lineTo(ex + 175, cy + s.incDeg * 9.5 * Math.cos(p.node * DEG)); x.stroke();

      x.fillStyle = s.lunarEclipse ? '#d45a46' : '#f6efd6';
      x.beginPath(); x.arc(mx, my, 10, 0, TAU); x.fill();
      x.fillStyle = '#fffdf7'; x.font = 'bold 11.5px "Noto Serif SC",serif';
      x.fillText(`月球 (β=${s.betaDeg.toFixed(2)}°)`, mx, my - 16);

      x.textAlign = 'left'; x.fillStyle = s.solarEclipse || s.lunarEclipse ? C.amber : '#cfd6dc';
      x.fillText(s.solarEclipse ? '日地月共线且入食限 → 发生日食' : s.lunarEclipse ? '月球落入地球本影 → 发生月食' : '由于白道黄纬偏移，影子掠过未遮挡 → 无食', 18, 22);
    });

    const sec2 = wb.section('2 · 日月引潮力谐波合成与朔望大潮 / 上下弦小潮曲线');
    const tideCv = wb.canvas(sec2, 520, 195, (x, W, H) => {
      const p = sp.params, s = lunarState(p.d, p.incl, p.node);
      const pad = { l: 46, r: 20, t: 22, b: 32 };
      const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      const sx = (hr) => pad.l + (hr / 24) * pw;
      const sy = (val) => pad.t + ph / 2 - (val / 1.7) * (ph * 0.45);

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      x.strokeStyle = 'rgba(30,43,54,0.14)'; x.lineWidth = 1;
      x.beginPath(); x.moveTo(pad.l, pad.t + ph / 2); x.lineTo(pad.l + pw, pad.t + ph / 2); x.stroke();

      // 月球半日潮（虚线）+ 太阳半日潮（点线）+ 合成总潮汐（实线）
      const plotHarmonic = (fn, col, lw, dashArr = []) => {
        x.save(); x.strokeStyle = col; x.lineWidth = lw; x.setLineDash(dashArr);
        x.beginPath();
        for (let i = 0; i <= 120; i++) {
          const hr = (i / 120) * 24;
          const v = fn((hr / 12) * TAU);
          if (i === 0) x.moveTo(sx(hr), sy(v)); else x.lineTo(sx(hr), sy(v));
        }
        x.stroke(); x.restore();
      };
      plotHarmonic((th) => Math.cos(th), C.copper, 1.4, [4, 4]);
      plotHarmonic((th) => 0.46 * Math.cos(th - 2 * s.E), C.amber, 1.4, [2, 3]);
      plotHarmonic((th) => Math.cos(th) + 0.46 * Math.cos(th - 2 * s.E), C.blue, 2.4, []);

      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.2;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();
      x.fillStyle = '#51606b'; x.font = '10.5px Georgia,serif'; x.textAlign = 'center';
      [0, 6, 12, 18, 24].forEach((hr) => x.fillText(`${hr}h`, sx(hr), H - 10));
      x.textAlign = 'left'; x.fillStyle = '#1e2b36';
      x.fillText(`蓝线=合成潮汐 (振幅 ${s.tideAmp.toFixed(2)}× · ${s.tideType})  |  棕虚=太阴潮  |  黄点=太阳潮`, pad.l + 6, pad.t + 12);
    });

    const metrics = document.createElement('div');
    metrics.className = 'wb-metrics';
    sec2.append(metrics);

    const refresh = () => {
      sideCv.redraw();
      tideCv.redraw();
      const s = lunarState(sp.params.d, sp.params.incl, sp.params.node);
      metrics.innerHTML = `
        <div class="wb-m"><span>当前农历与月相</span><b>${LUNAR_DAYS[Math.min(29, Math.floor(sp.params.d) - 1)]} · ${s.name}</b></div>
        <div class="wb-m"><span>白道黄纬 β</span><b>${s.betaDeg.toFixed(2)}° (${s.incDeg}°倾角)</b></div>
        <div class="wb-m"><span>合成潮差倍数</span><b>${s.tideAmp.toFixed(2)}× (${s.tideType})</b></div>
        <div class="wb-m"><span>食象诊断</span><b>${s.solarEclipse ? '日食' : s.lunarEclipse ? '月食' : '无食'}</b></div>`;
    };

    bar.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (!act) return;
      if (act === 'toggleIncl') wb.setParam('incl', !sp.params.incl);
      else if (act === 'new') wb.setParam('d', 1);
      else if (act === 'full') wb.setParam('d', 15.8);
      else if (act === 'align') { wb.setParam('node', 0); wb.setParam('d', 15.8); }
      else if (act === 'rec') wb.record(moon.record.sample(sp.inst, sp.params));
      refresh();
    });

    let lastKey = '';
    refresh();
    return {
      update() {
        const k = `${sp.params.d.toFixed(1)}|${sp.params.incl}|${sp.params.node}`;
        if (k !== lastKey) { lastKey = k; refresh(); }
      },
    };
  },
};

// ================================================================
// 5. geo-sponge-hydrology — 水循环下渗与热带海绵校园暴雨径流过程线 (L3)
// ================================================================
function simulateSpongeHydrology(rainMm, spongePct, greenRoofOn) {
  const dtMin = 5, dtHr = dtMin / 60, steps = 36; // 0..180 min
  const fSponge = clamp(spongePct / 100 + (greenRoofOn ? 0.15 : 0), 0, 1);

  // 台风对流暴雨时程分配（高斯偏峰集中在 t=45min，前 120min 主雨带，120..180min 余雨）
  const rawW = [];
  for (let i = 0; i <= steps; i++) {
    const t = i * dtMin;
    rawW.push(Math.exp(-((t - 45) ** 2) / (2 * 22 * 22)) + 0.18 * Math.exp(-((t - 85) ** 2) / (2 * 30 * 30)));
  }
  const sumW = rawW.reduce((a, b) => a + b, 0);

  const runCase = (effSponge) => {
    // 参数随海绵覆盖率平滑过渡：从硬化沥青 (fc=4mm/h, S_det=2mm, K=10min) 到海绵校园 (fc=64mm/h, S_det=38mm, K=42min)
    const fMin = lerp(4, 58, effSponge);
    const fMax = lerp(9, 105, effSponge);
    const sMax = lerp(2, 38, effSponge);
    const kLagHr = lerp(10 / 60, 42 / 60, effSponge);
    const etFrac = lerp(0.035, 0.115, effSponge);

    let sDet = 0, sRun = 0, totP = 0, totI = 0, totE = 0, totR = 0;
    let peakQ = 0, peakT = 0;
    const series = [];

    for (let i = 0; i <= steps; i++) {
      const t = i * dtMin;
      const dP = (rainMm * rawW[i]) / sumW;
      const rainRate = dP / dtHr;
      const dE = dP * etFrac;
      const fCap = fMin + (fMax - fMin) * Math.exp(-0.024 * t);
      const avail = dP - dE + sDet;
      const dI = Math.min(avail, fCap * dtHr);
      const rem = avail - dI;
      sDet = Math.min(sMax, rem);
      const excess = Math.max(0, rem - sMax);
      sRun += excess;
      const qOut = sRun / kLagHr; // mm/h
      const dR = Math.min(sRun, qOut * dtHr);
      sRun -= dR;

      totP += dP; totI += dI; totE += dE; totR += dR;
      if (qOut > peakQ) { peakQ = qOut; peakT = t; }
      series.push({ t, rainRate, infRate: dI / dtHr, qOut, cumP: totP, cumI: totI, cumE: totE, cumR: totR, det: sDet + sRun });
    }
    // 将剩余滞蓄微调至尾段稳态释出报告与严格水量平衡闭环 P = I + E + R + ΔS
    return {
      series,
      peakQ,
      peakT,
      totP,
      totI,
      totE,
      totR,
      deltaS: sDet + sRun,
    };
  };

  const base = runCase(0);
  const current = runCase(fSponge);
  const peakReductionPct = base.peakQ > 1e-3 ? ((base.peakQ - current.peakQ) / base.peakQ) * 100 : 0;
  return { base, current, effSponge: fSponge, peakReductionPct, dtMin };
}

const spongeHydrology = {
  id: 'geo-sponge-hydrology',
  subject: 'geo',
  title: '水循环下渗与热带海绵校园暴雨径流过程线',
  en: 'Water cycle, infiltration & sponge-campus runoff',
  lede: [
    '海南夏秋受台风与热带对流影响，短时强降雨频发。传统硬化沥青路面几乎不透水，雨水迅速汇流形成刺眼的尖锐洪峰；而海绵校园以透水砖、绿屋顶与下凹式湿地把雨水“渗、滞、蓄、净、排”。',
    '在实验台上实时对比硬化路面与海绵校区的暴雨过程线，检验水量平衡方程 降水 = 下渗 + 蒸发 + 径流 + 滞蓄，定量算出削峰率与延迟峰现时间。',
  ],
  formula: 'P = I(下渗) + E(蒸散) + R(径流) + ΔS(滞蓄)',
  formulaNote: '提高下渗率与滞蓄容积可显著削减洪峰流量（削峰）并延后洪峰到达时间（滞峰）',
  terms: [
    ['下渗与超渗产流', '当降雨强度超过土壤下渗能力时产生超渗地表径流；透水砖与植草沟可成倍提高下渗率。'],
    ['削峰与滞峰', '海绵设施将急剧的暴雨汇流转化为平缓持久的慢速下渗与释出，降低校园积涝风险。'],
    ['水量平衡闭合', '一个区域在单场暴雨中的总降水最终必然分配为下渗、蒸发截留、径流输出与地表/湿地蓄存四部分。'],
  ],
  predict: {
    q: '同样面对一场 140 mm 的热带台风暴雨，把硬化路面改造成“透水砖 + 下凹湿地”海绵校园后，径流过程线会发生什么变化？',
    options: [
      '洪峰流量变大、峰现时间提前',
      '洪峰流量显著降低（削峰），且峰现时间推迟（滞峰）',
      '总降水量和总下渗量同时变为零',
    ],
    answer: 1,
    why: '下渗能力增强和湿地调蓄把原本瞬间涌入管网的地表水就地拦蓄并缓慢释放，因而径流过程线变得矮胖平缓：洪峰大幅下降，峰现时刻明显延后。',
  },
  challenge: '设定海口台风级暴雨 200 mm，尝试调节“海绵设施覆盖率”与“绿色屋顶”，使当前峰值径流低于 45 mm/h 校园安全防涝红线！',
  fig: '3D 硬化沥青路面（左）vs 海绵校园透水湿地剖面（右）对比沙盘与蓄水过程',
  hint: '拖动台风暴雨总雨量与海绵覆盖率，开启暴雨过程模拟；在工作台悬停或拖动时间轴检查逐 5 分钟产汇流积分。',
  teach: {
    where: '人教版地理 必修第一册 第三章《地球上的水》§3.1 水循环（结合海口海绵城市建设本地化探究）。',
    ask: [
      '从水量平衡方程出发，城市路面硬化后，下渗 I、蒸发 E 与地表径流 R 各发生怎样的定量转移？',
      '为什么海绵校园既能减轻暴雨内涝，又能缓解旱季绿植缺水？（提示：ΔS 与地下储水）',
    ],
    simplify: '采用 Horton 指数衰减下渗曲线与单级线性水库汇流演算（5 分钟步长），演示海口强降雨典型产汇流规律，不作市政排水施工设计依据。',
  },
  controls: [
    { id: 'rain', label: '台风总雨量 P', min: 40, max: 240, step: 10, value: 140, unit: 'mm' },
    { id: 'sponge', label: '海绵覆盖率', min: 0, max: 100, step: 5, value: 25, unit: '%' },
    { id: 'greenRoof', type: 'toggle', label: '绿屋顶+下凹湿地', value: false },
    { id: 'tSim', label: '降雨时刻 t', min: 0, max: 180, step: 5, value: 65, unit: 'min' },
    { id: 'play', type: 'toggle', label: '暴雨模拟', value: false },
    { id: 'bAsphalt', type: 'button', label: '全硬化对比 (0%)' },
    { id: 'bSponge', type: 'button', label: '海绵校园 (85%)' },
    { id: 'bTyphoon', type: 'button', label: '特大暴雨 200mm' },
  ],
  record: {
    note: '记录不同海绵覆盖率下暴雨水量平衡分配（下渗 I、蒸发 E、径流 R、滞蓄 ΔS）与削峰率。',
    pending: '点击工作台“记录当前水量平衡方案”录入比对表。',
    columns: [
      { key: 'rain', label: '总雨量 P', unit: 'mm', digits: 0 },
      { key: 'sponge', label: '有效海绵率', unit: '%', digits: 0 },
      { key: 'inf', label: '下渗 I', unit: 'mm', digits: 1 },
      { key: 'runoff', label: '总径流 R', unit: 'mm', digits: 1 },
      { key: 'peakQ', label: '洪峰流量', unit: 'mm/h', digits: 1, stat: true },
      { key: 'cutPct', label: '削峰率', unit: '%', digits: 1 },
    ],
    sample: (_inst, p) => {
      const sim = simulateSpongeHydrology(p.rain, p.sponge, p.greenRoof);
      return {
        _kind: 'human',
        rain: sim.current.totP,
        sponge: Math.round(sim.effSponge * 100),
        inf: sim.current.totI,
        runoff: sim.current.totR,
        peakQ: sim.current.peakQ,
        cutPct: sim.peakReductionPct,
      };
    },
    summary: (rows) => [
      ['已设计方案数', `${rows.length} 组`],
      ['最佳削峰率', rows.length ? `${Math.max(...rows.map((r) => r.cutPct)).toFixed(1)}%` : '—'],
    ],
    errors: [
      '把“总降水量 P”直接等同于“地表径流量 R”：忽略了植物截留蒸发 E、下渗 I 以及湿地蓄存 ΔS 对水量的分流。',
    ],
  },

  build(k) {
    const p = k.p, Z = -0.7;
    // 左半侧：传统硬化沥青（深灰板 + 浅土壤干涸层 + 高积水溢流）
    const leftBase = at(box(3.4, 0.72, 2.8, '#d9d4c7'), -1.95, 0, Z);
    const leftTop = at(box(3.4, 0.14, 2.8, '#555d66'), -1.95, 0.72, Z);
    const leftSoilWater = at(flat(new THREE.BoxGeometry(3.32, 1, 2.72).translate(0, 0.5, 0), C.blue, { opacity: 0.48 }), -1.95, 0.04, Z);
    const leftPond = at(flat(new THREE.BoxGeometry(3.32, 1, 2.72).translate(0, 0.5, 0), C.sky, { opacity: 0.65 }), -1.95, 0.87, Z);

    // 右半侧：海绵校园（深厚含水土层 + 透水砖 + 绿屋顶建筑 + 下凹式湿地蓄水）
    const rightBase = at(box(3.4, 0.72, 2.8, '#d9c39a'), 1.95, 0, Z);
    const rightPaver = at(box(1.9, 0.14, 2.8, '#e3e8df'), 1.2, 0.72, Z);
    const rightSoilWater = at(flat(new THREE.BoxGeometry(3.32, 1, 2.72).translate(0, 0.5, 0), C.blue, { opacity: 0.52 }), 1.95, 0.04, Z);
    const wetland = at(flat(new THREE.BoxGeometry(1.42, 1, 2.72).translate(0, 0.5, 0), C.teal, { opacity: 0.62 }), 2.9, 0.72, Z);
    const roofBlock = at(box(1.15, 0.75, 1.3, C.paper), 1.15, 0.86, Z - 0.55);
    const greenMat = at(box(1.18, 0.12, 1.32, C.leaf), 1.15, 1.61, Z - 0.55);

    // 暴雨雨滴粒子群
    const rand = rng(9081);
    const N_DROPS = 90;
    const rainDrops = dots(N_DROPS, 0.036, C.sky, { flat: true, opacity: 0.75 });
    const dropState = Array.from({ length: N_DROPS }, () => ({
      x: (rand() - 0.5) * 7.2,
      y: 1.0 + rand() * 3.4,
      z: Z + (rand() - 0.5) * 2.5,
    }));

    const lblL = at(note('传统硬化路面', { size: 0.28, lay: 'flat' }), -1.95, 0.06, Z + 1.75);
    const lblR = at(note('海绵校园 (透水+湿地)', { size: 0.28, lay: 'flat', color: C.green }), 1.95, 0.06, Z + 1.75);
    const info = at(card('\n\n\n', { w: 4.8, size: 0.27, align: 'left' }), 0, 0, 2.9);
    k.root.add(
      leftBase, leftTop, leftSoilWater, leftPond,
      rightBase, rightPaver, rightSoilWater, wetland, roofBlock, greenMat,
      rainDrops, lblL, lblR, info,
    );

    const sync = () => {
      const sim = simulateSpongeHydrology(p.rain, p.sponge, p.greenRoof);
      const idx = clamp(Math.round(p.tSim / sim.dtMin), 0, sim.base.series.length - 1);
      const bPt = sim.base.series[idx], cPt = sim.current.series[idx];

      // 左侧硬化路面：渗透少、表面积水径流深
      leftSoilWater.scale.y = clamp(0.03 + (bPt.cumI / 180) * 0.65, 0.02, 0.66);
      leftPond.scale.y = clamp(0.01 + (bPt.qOut / 180) * 0.42, 0.01, 0.45);
      leftPond.visible = bPt.qOut > 1;

      // 右侧海绵校园：绿色屋顶开关、深层下渗蓄水明显、地表无急涝积水
      greenMat.visible = !!p.greenRoof;
      rightSoilWater.scale.y = clamp(0.04 + (cPt.cumI / 160) * 0.66, 0.03, 0.68);
      wetland.scale.y = clamp(0.02 + (cPt.det / 45) * 0.36, 0.02, 0.38);

      info.set(`t=${Math.round(p.tSim)}min · 有效海绵率 ${Math.round(sim.effSponge * 100)}%\n硬化洪峰 ${sim.base.peakQ.toFixed(1)} vs 海绵 ${sim.current.peakQ.toFixed(1)} mm/h（削峰 ${sim.peakReductionPct.toFixed(0)}%）\n累计 下渗 ${cPt.cumI.toFixed(1)} · 径流 ${cPt.cumR.toFixed(1)} · 滞蓄 ${cPt.det.toFixed(1)} mm`);
    };

    sync();
    return {
      press(id) {
        if (id === 'bAsphalt') { k.set('sponge', 0); k.set('greenRoof', false); }
        else if (id === 'bSponge') { k.set('sponge', 85); k.set('greenRoof', true); }
        else if (id === 'bTyphoon') { k.set('rain', 200); }
        sync();
        k.dirty();
      },
      change() { sync(); k.dirty(); },
      update(dt) {
        if (p.play && dt > 0) {
          const nextT = (p.tSim + dt * 28) % 185;
          k.set('tSim', Math.round(nextT / 5) * 5);
          sync();
        }
        const sim = simulateSpongeHydrology(p.rain, p.sponge, p.greenRoof);
        const idx = clamp(Math.round(p.tSim / sim.dtMin), 0, sim.current.series.length - 1);
        const rate = sim.current.series[idx].rainRate;
        const speed = 2.5 + clamp(rate / 50, 0, 5);
        for (let i = 0; i < N_DROPS; i++) {
          const d = dropState[i];
          if (dt > 0) {
            d.y -= dt * speed;
            if (d.y < 0.88) d.y = 4.3;
          }
          const vis = rate > 2 ? clamp(rate / 90, 0.4, 1.35) : 0.001;
          rainDrops.put(i, d.x, d.y, d.z, vis);
        }
        rainDrops.done();
      },
      margin() {
        const sim = simulateSpongeHydrology(p.rain, p.sponge, p.greenRoof);
        const c = sim.current;
        return [
          `台风总雨量 P = ${c.totP.toFixed(1)} mm`,
          `有效海绵率 ${Math.round(sim.effSponge * 100)}%`,
          `总下渗 I = ${c.totI.toFixed(1)} mm`,
          `总径流 R = ${c.totR.toFixed(1)} mm`,
          `洪峰 ${c.peakQ.toFixed(1)} mm/h (t=${c.peakT}m)`,
          `削峰率 ${sim.peakReductionPct.toFixed(1)}%`,
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 热带暴雨产汇流过程线 Hydrograph（点击拖动时刻 t 检查瞬时流量）');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn primary" data-act="asphalt">对比 0% 硬化路面</button>
      <button type="button" class="wb-btn" data-act="sponge">一键部署 85% 海绵+湿地</button>
      <button type="button" class="wb-btn" data-act="typhoon">海口特大暴雨 200mm</button>
      <button type="button" class="wb-btn" data-act="rec">记录当前水量平衡方案</button>`;
    sec1.append(bar);

    const hydroCv = wb.canvas(sec1, 540, 260, (x, W, H) => {
      const p = sp.params;
      const sim = simulateSpongeHydrology(p.rain, p.sponge, p.greenRoof);
      const pad = { l: 48, r: 22, t: 28, b: 34 };
      const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      const maxY = Math.max(140, Math.ceil(Math.max(sim.base.peakQ, sim.base.series[9].rainRate) / 20) * 20);
      const sx = (t) => pad.l + (t / 180) * pw;
      const sy = (q) => pad.t + ph - (q / maxY) * ph;

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      // 降雨柱状背景
      x.fillStyle = 'rgba(58,156,255,0.18)';
      sim.base.series.forEach((pt) => {
        const bx = sx(pt.t), bw = (5 / 180) * pw * 0.82, bh = (pt.rainRate / maxY) * ph;
        x.fillRect(bx - bw / 2, pad.t + ph - bh, bw, bh);
      });

      // 安全防涝警戒线 45 mm/h
      x.strokeStyle = 'rgba(229,72,63,0.45)'; x.setLineDash([4, 4]);
      x.beginPath(); x.moveTo(pad.l, sy(45)); x.lineTo(pad.l + pw, sy(45)); x.stroke(); x.setLineDash([]);
      x.fillStyle = C.red; x.font = '10.5px "Noto Serif SC",serif'; x.textAlign = 'right';
      x.fillText('校园排涝警戒线 45 mm/h', pad.l + pw - 4, sy(45) - 4);

      // 削峰面积阴影
      x.fillStyle = 'rgba(25,194,176,0.16)';
      x.beginPath();
      sim.base.series.forEach((pt, i) => (i === 0 ? x.moveTo(sx(pt.t), sy(pt.qOut)) : x.lineTo(sx(pt.t), sy(pt.qOut))));
      for (let i = sim.current.series.length - 1; i >= 0; i--) {
        const pt = sim.current.series[i];
        x.lineTo(sx(pt.t), sy(pt.qOut));
      }
      x.closePath(); x.fill();

      // 硬化基准虚线、当前径流实线、下渗速率绿线
      const drawLine = (pts, key, col, lw, dashArr = []) => {
        x.save(); x.strokeStyle = col; x.lineWidth = lw; x.setLineDash(dashArr);
        x.beginPath();
        pts.forEach((pt, i) => (i === 0 ? x.moveTo(sx(pt.t), sy(pt[key])) : x.lineTo(sx(pt.t), sy(pt[key]))));
        x.stroke(); x.restore();
      };
      drawLine(sim.base.series, 'qOut', '#1e2b36', 1.8, [6, 4]);
      drawLine(sim.current.series, 'qOut', C.blue, 2.5, []);
      drawLine(sim.current.series, 'infRate', C.leaf, 1.8, []);

      // 当前时刻 tSim 游标
      const cx = sx(p.tSim);
      const idx = clamp(Math.round(p.tSim / 5), 0, sim.current.series.length - 1);
      const cPt = sim.current.series[idx];
      x.strokeStyle = C.copper; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(cx, pad.t); x.lineTo(cx, pad.t + ph); x.stroke();
      x.fillStyle = C.blue; x.beginPath(); x.arc(cx, sy(cPt.qOut), 5, 0, TAU); x.fill();

      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.3;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();
      x.fillStyle = '#51606b'; x.font = '10.5px Georgia,serif'; x.textAlign = 'center';
      [0, 45, 90, 135, 180].forEach((tm) => x.fillText(`${tm}m`, sx(tm), H - 10));
      x.textAlign = 'right';
      for (let q = 0; q <= maxY; q += Math.round(maxY / 4)) x.fillText(`${q}`, pad.l - 5, sy(q) + 4);
      x.textAlign = 'left'; x.fillStyle = '#1e2b36';
      x.fillText(`黑虚=硬化径流(${sim.base.peakQ.toFixed(0)}) | 蓝实=海绵径流(${sim.current.peakQ.toFixed(0)}) | 绿=下渗率`, pad.l + 4, pad.t - 8);
    });

    const sec2 = wb.section('2 · 水量平衡积分核算 P = I + E + R + ΔS');
    const balCv = wb.canvas(sec2, 540, 92, (x, W, H) => {
      const p = sp.params, sim = simulateSpongeHydrology(p.rain, p.sponge, p.greenRoof);
      const c = sim.current;
      const tot = Math.max(1e-6, c.totP);
      const parts = [
        { lbl: `下渗 I ${c.totI.toFixed(1)}mm`, val: c.totI, col: C.leaf },
        { lbl: `滞蓄 ΔS ${c.deltaS.toFixed(1)}mm`, val: c.deltaS, col: C.teal },
        { lbl: `蒸散 E ${c.totE.toFixed(1)}mm`, val: c.totE, col: C.amber },
        { lbl: `径流 R ${c.totR.toFixed(1)}mm`, val: c.totR, col: C.blue },
      ];
      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      let curX = 18;
      const barW = W - 36, barY = 18, barH = 30;
      parts.forEach((pt) => {
        const wSeg = (pt.val / tot) * barW;
        x.fillStyle = pt.col; x.fillRect(curX, barY, wSeg, barH);
        curX += wSeg;
      });
      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.4; x.strokeRect(18, barY, barW, barH);

      x.font = '11.5px "Noto Serif SC",serif'; x.textAlign = 'left';
      parts.forEach((pt, i) => {
        const lx = 18 + i * 130;
        x.fillStyle = pt.col; x.fillRect(lx, 62, 11, 11);
        x.fillStyle = '#1e2b36'; x.fillText(pt.lbl, lx + 15, 72);
      });
    });

    const metrics = document.createElement('div');
    metrics.className = 'wb-metrics';
    sec2.append(metrics);

    const refresh = () => {
      hydroCv.redraw();
      balCv.redraw();
      const sim = simulateSpongeHydrology(sp.params.rain, sp.params.sponge, sp.params.greenRoof);
      const c = sim.current, b = sim.base;
      const safe = c.peakQ <= 45;
      metrics.innerHTML = `
        <div class="wb-m"><span>硬化 vs 海绵洪峰</span><b>${b.peakQ.toFixed(1)} → ${c.peakQ.toFixed(1)} mm/h</b></div>
        <div class="wb-m"><span>洪峰削减 / 延迟</span><b>削峰 ${sim.peakReductionPct.toFixed(1)}% · 滞峰 +${c.peakT - b.peakT} min</b></div>
        <div class="wb-m"><span>水量平衡误差检查</span><b>${Math.abs(c.totP - (c.totI + c.totE + c.totR + c.deltaS)).toFixed(3)} mm (闭合)</b></div>
        <div class="wb-m"><span>校园防涝安全评估</span><b>${safe ? '✓ 低于 45mm/h 安全线' : '⚠ 超警！需增配海绵面积'}</b></div>`;
    };

    let scrubbing = false;
    const scrubT = (ev) => {
      const pt = hydroCv.toLocal(ev);
      const t = Math.round(clamp(((pt.x - 48) / (540 - 70)) * 180, 0, 180) / 5) * 5;
      wb.setParam('tSim', t);
      refresh();
    };
    hydroCv.cv.addEventListener('pointerdown', (e) => { scrubbing = true; hydroCv.cv.setPointerCapture?.(e.pointerId); scrubT(e); });
    hydroCv.cv.addEventListener('pointermove', (e) => { if (scrubbing) scrubT(e); });
    hydroCv.cv.addEventListener('pointerup', () => { scrubbing = false; });

    bar.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (!act) return;
      if (act === 'asphalt') { wb.setParam('sponge', 0); wb.setParam('greenRoof', false); }
      else if (act === 'sponge') { wb.setParam('sponge', 85); wb.setParam('greenRoof', true); }
      else if (act === 'typhoon') { wb.setParam('rain', 200); }
      else if (act === 'rec') wb.record(spongeHydrology.record.sample(sp.inst, sp.params));
      refresh();
    });

    let lastKey = '';
    refresh();
    return {
      update() {
        const k = `${sp.params.rain}|${sp.params.sponge}|${sp.params.greenRoof}|${sp.params.tSim}`;
        if (k !== lastKey) { lastKey = k; refresh(); }
      },
    };
  },
};

export default [seasons, breeze, contour, moon, spongeHydrology];
