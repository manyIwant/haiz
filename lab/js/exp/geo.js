// 地理
import { C, TAU, clamp, lerp, group, at, rot, box, cyl, ball, cone, torus, rod, wire, arrow, strip, glow, note, card, flat, flow, sheet, solid, THREE } from '../ink.js';

const RAD = Math.PI / 180;
const MD = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const dateOf = (n) => { let m = 0, d = Math.max(1, Math.min(365, Math.round(n))); while (d > MD[m]) { d -= MD[m]; m++; } return `${m + 1}月${d}日`; };
const lat = (v) => (v === 0 ? '0°' : `${Math.abs(v)}°${v > 0 ? 'N' : 'S'}`);

// ---------------------------------------------------------------- 四季与昼夜长短
const seasons = {
  id: 'geo-seasons', subject: 'geo', title: '地球公转与昼夜长短', en: 'Seasons and day length',
  lede: ['地球斜着身子绕太阳转，地轴始终指向同一个方向。于是一年里，太阳直射点在南北回归线之间来回移动。', '直射点在哪个半球，哪个半球就昼长夜短；纬度越高，昼夜长短的变化越大。'],
  formula: 'H = 90° − | φ − δ |', formulaNote: '正午太阳高度 = 90° − 当地纬度与太阳直射点纬度之差',
  terms: [['黄赤交角', '地轴倾斜造成的夹角，约 23°26′。'], ['太阳直射点', '太阳光垂直照射的地点，纬度记作 δ。'], ['晨昏线', '昼半球与夜半球的分界线。']],
  predict: { q: '夏至这一天，海口（约 20°N）和哈尔滨（约 45°N），谁的白昼更长？', options: ['海口，离直射点更近', '哈尔滨', '一样长'], answer: 1, why: '太阳直射北半球时，北半球纬度越高白昼越长，北极圈内甚至出现极昼。离直射点近决定的是正午太阳高度，而不是昼长。' },
  challenge: '找出海口一年中正午太阳高度达到 90° 的两天。',
  fig: '太阳、公转轨道与倾斜的地球（大小和距离不按比例）', hint: '拖日期和纬度；红点是你所在的地方。',
  teach: {
    where: '人教版地理 选择性必修 1 · 地球的运动：地球公转的地理意义（昼夜长短和正午太阳高度的变化、四季更替）。',
    ask: ['春分和秋分，全球各地昼长有什么共同点？从图上晨昏线的位置解释。', '把纬度拖到 66°N 以上再看夏至，昼长是多少？这叫什么现象？'],
    simplify: '公转轨道画成正圆、匀速运动，直射点纬度按 δ = 23.44°·sin(2π(N−80)/365) 近似；昼长不计大气折射和太阳视半径。',
  },
  controls: [
    { id: 'n', label: '日期', min: 1, max: 365, step: 1, value: 172, fmt: dateOf },
    { id: 'lat', label: '纬度', min: -60, max: 70, step: 1, value: 20, fmt: lat },
    { id: 'auto', type: 'toggle', label: '公转', value: false },
    { id: 'd0', type: 'button', label: '春分' }, { id: 'd1', type: 'button', label: '夏至' }, { id: 'd2', type: 'button', label: '秋分' }, { id: 'd3', type: 'button', label: '冬至' },
  ],
  build(k) {
    const p = k.p, R = 3.3, Y = 1.9, Z = -0.7, RE = 0.62, EPS = 23.44 * RAD;
    const axis = new THREE.Vector3(Math.sin(EPS), Math.cos(EPS), 0);
    k.root.add(at(flat(new THREE.SphereGeometry(0.6, 32, 20), C.amber), 0, Y, Z), at(glow(C.amber, 4.5, 0.7), 0, Y, Z), at(cyl(0.05, Y - 0.6), 0, 0, Z), at(cyl(0.5, 0.1), 0, 0, Z));
    k.root.add(at(torus(R, 0.018, C.ink), 0, Y, Z));
    [['春分', 0, -R], ['夏至', -R, 0], ['秋分', 0, R], ['冬至', R, 0]].forEach(([s, x, z]) => k.root.add(at(note(s, { size: 0.3, lay: 'flat' }), x * 1.0, 0.03, Z + z * 1.0 + (z > 0 ? 0.5 : z < 0 ? -0.5 : 0.75))));
    const globe = group(ball(RE), torus(RE + 0.01, 0.02, C.ink), rod([0, -RE - 0.35, 0], [0, RE + 0.35, 0], 0.03, C.ink));
    const ring = torus(1, 0.022, C.red); globe.add(ring);
    globe.rotation.z = -EPS;
    const night = flat(new THREE.SphereGeometry(RE * 1.03, 32, 16, 0, TAU, 0, Math.PI / 2), '#1e2b36', { opacity: 0.42 });
    const city = flat(new THREE.SphereGeometry(0.085, 12, 8), C.red), sub = flat(new THREE.SphereGeometry(0.075, 12, 8), C.amber);
    const earth = group(globe, night, city, sub);
    const ray = strip(2, { w: 0.05, color: C.amber, opacity: 0.6, normal: [0, 1, 0] });
    const info = at(card('\n\n', { w: 4.3, size: 0.3, align: 'left' }), 2.5, 0, 3.0);
    k.root.add(earth, ray, info);
    const s = new THREE.Vector3(), e1 = new THREE.Vector3(), q = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const st = {};
    return {
      press(id) { k.set('n', [80, 172, 266, 356][+id[1]]); },
      update(dt) {
        if (p.auto) k.set('n', ((p.n - 1 + dt * 22) % 365) + 1);
        const th = Math.PI / 2 + TAU * (p.n - 80) / 365;
        earth.position.set(R * Math.cos(th), Y, Z - R * Math.sin(th));
        s.set(-Math.cos(th), 0, Math.sin(th));
        const sinD = axis.dot(s), dec = Math.asin(sinD), phi = p.lat * RAD;
        night.quaternion.setFromUnitVectors(up, q.copy(s).negate());
        e1.copy(s).addScaledVector(axis, -sinD).normalize();
        city.position.copy(e1).multiplyScalar(Math.cos(phi) * RE).addScaledVector(axis, Math.sin(phi) * RE);
        sub.position.copy(s).multiplyScalar(RE);
        ring.scale.set(Math.cos(phi) * RE, 1, Math.cos(phi) * RE); ring.position.y = Math.sin(phi) * RE;
        ray.set([[0, Y, Z], [earth.position.x, Y, earth.position.z]]);
        const x = -Math.tan(phi) * Math.tan(dec), day = x >= 1 ? 0 : x <= -1 ? 24 : 2 * Math.acos(x) / RAD / 15, H = 90 - Math.abs(p.lat - dec / RAD);
        Object.assign(st, { dec: dec / RAD, day, H });
        info.set(`直射点 ${Math.abs(st.dec).toFixed(1)}°${st.dec >= 0 ? 'N' : 'S'}\n昼长 ${day >= 24 ? '24 时（极昼）' : day <= 0 ? '0 时（极夜）' : `${Math.floor(day)} 时 ${Math.round((day % 1) * 60)} 分`}\n正午太阳高度 ${Math.max(0, H).toFixed(1)}°`);
      },
      margin() {
        return [dateOf(p.n), `δ = ${st.dec?.toFixed(1)}°`, `φ = ${lat(p.lat)}`, 'H = 90° − |φ − δ|', ` = ${Math.max(0, st.H || 0).toFixed(1)}°`, st.dec > 0.5 ? '北半球昼长夜短' : st.dec < -0.5 ? '北半球昼短夜长' : '全球昼夜等长'];
      },
    };
  },
};

// ---------------------------------------------------------------- 热力环流
const breeze = {
  id: 'geo-breeze', subject: 'geo', title: '热力环流与海陆风', en: 'Sea and land breezes',
  lede: ['同样晒一个白天，沙滩烫脚，海水却只是微温。陆地升温快、降温也快，海洋正相反。', '冷热不均让空气先上下动起来，再水平流动，形成一个闭合的圈：这就是最简单的大气运动，热力环流。'],
  formula: '受热 → 上升 → 近地面低压', formulaNote: '同一水平面上，空气从高压流向低压，形成风',
  terms: [['热力环流', '由地面冷热不均引起的空气环流。'], ['海风', '白天从海洋吹向陆地的风。'], ['等压面', '气压相等的面；高压处向上凸。']],
  predict: { q: '夏天的白天，站在海边，近地面的风从哪里吹向哪里？', options: ['从陆地吹向海洋', '从海洋吹向陆地', '没有固定方向'], answer: 1, why: '白天陆地升温快，空气受热上升，近地面形成低压；海面相对凉爽，气压较高。近地面空气从海洋（高压）流向陆地（低压），这就是凉爽的海风。' },
  challenge: '切到夜晚，在脑子里先画出四个箭头，再看画面对不对。',
  fig: '海岸剖面：陆地、海洋与上方的空气环流', hint: '切换白天和夜晚，调温差大小。',
  teach: {
    where: '人教版地理 必修第一册 · 地球上的大气：大气受热过程和大气运动（热力环流）。',
    ask: ['近地面和高空的气压高低正好相反，从空气上升、下沉后“堆积”在哪里来解释。', '城市热岛环流和海陆风是同一个原理吗？城郊之间近地面的风怎么吹？'],
    simplify: '只画出剖面内的理想闭合环流，不考虑地转偏向力、背景风和地形；温度数值为示意。',
  },
  controls: [
    { id: 'time', type: 'choice', label: '时间', options: ['白天', '夜晚'], value: 0 },
    { id: 'dT', label: '海陆温差', min: 0, max: 10, step: 0.5, value: 6, unit: '℃' },
  ],
  build(k) {
    const p = k.p, Z = -0.8;
    const land = at(box(4.2, 0.6, 3), -2.3, 0, Z), sea = at(flat(new THREE.BoxGeometry(4.4, 0.42, 3).translate(0, 0.21, 0), C.sky, { opacity: 0.36 }), 2.1, 0.02, Z);
    k.root.add(land, sea, at(glow(C.sky, 5, 0.25), 2.1, 0.3, Z));
    [[-3.6, -0.6], [-2.6, 0.5], [-1.4, -0.9]].forEach(([x, z], i) => k.root.add(i === 1 ? group(at(cyl(0.07, 0.5, C.wood), x, 0.6, Z + z), at(cone(0.4, 0.9, '#d9ecd0'), x, 1.0, Z + z)) : group(at(box(0.7, 0.5, 0.6), x, 0.6, Z + z), rot(at(solid(new THREE.ConeGeometry(0.62, 0.4, 4), C.shade), x, 1.3, Z + z), 0, Math.PI / 4, 0))));
    const loop = [[-2.6, 1.3, Z], [-2.6, 4.2, Z], [2.6, 4.2, Z], [2.6, 1.3, Z]];
    const air = flow(loop, 26, '#8fb8e8', { closed: true, r: 0.085 });
    const arrows = [C.flame, C.ink, C.blue, C.ink].map((c) => arrow(c, 0.06));
    const isoL = strip(20, { w: 0.045, color: C.ink, opacity: 0.55 }), isoH = strip(20, { w: 0.045, color: C.ink, opacity: 0.55 });
    const sun = at(group(flat(new THREE.SphereGeometry(0.45, 24, 16), C.amber), glow(C.amber, 3.4, 0.6)), -3.8, 5.3, Z - 1.5);
    const moon = at(group(flat(new THREE.SphereGeometry(0.4, 24, 16), '#e9edf5'), glow('#b9c8ff', 2.6, 0.5)), 3.6, 5.3, Z - 1.5);
    const tL = at(note('低压', { size: 0.34 }), -2.6, 0.95, Z + 1.7), tS = at(note('高压', { size: 0.34 }), 2.6, 0.8, Z + 1.7);
    const info = at(card('\n\n', { w: 4.4, size: 0.3, align: 'left' }), 0.4, 0, 3.0);
    k.root.add(air, ...arrows, isoL, isoH, sun, moon, tL, tS, info);
    let dir = 1;
    return {
      update(dt) {
        const day = p.time === 0, sgn = day ? 1 : -1, a = p.dT / 10;
        dir = lerp(dir, sgn * a, 1 - Math.exp(-dt * 2.5));
        air.step(dt, dir * 3.2); air.visible = Math.abs(dir) > 0.02;
        sun.visible = day; moon.visible = !day;
        const ends = [[[-2.6, 1.6, Z], [-2.6, 3.9, Z]], [[-2.2, 4.2, Z], [2.2, 4.2, Z]], [[2.6, 3.9, Z], [2.6, 1.6, Z]], [[2.2, 1.3, Z], [-2.2, 1.3, Z]]];
        arrows.forEach((ar, i) => {
          const [A, B] = ends[i], f = clamp(Math.abs(dir) * 1.2), m = A.map((v, j) => (v + B[j]) / 2), h = A.map((v, j) => (B[j] - v) / 2 * f * Math.sign(dir || 1));
          ar.set(m.map((v, j) => v - h[j]), m.map((v, j) => v + h[j]));
          ar.children.forEach((c) => c.material.color.set(i % 2 ? C.ink : (i === 0) === (dir > 0) ? C.flame : C.blue));
        });
        const pl = [], ph = [];
        for (let i = 0; i < 20; i++) { const x = -3.4 + i * 0.358, b = Math.tanh(x / 1.6) * 0.3 * dir; pl.push([x, 2.1 + b, Z + 0.02]); ph.push([x, 3.5 - b, Z + 0.02]); }
        isoL.set(pl); isoH.set(ph);
        tL.set(Math.abs(dir) < 0.05 ? '—' : dir > 0 ? '低压' : '高压'); tS.set(Math.abs(dir) < 0.05 ? '—' : dir > 0 ? '高压' : '低压');
        const tl = day ? 26 + p.dT : 24 - p.dT * 0.6, ts = day ? 26 : 24;
        info.set(`陆地 ${tl.toFixed(1)} ℃　海洋 ${ts.toFixed(1)} ℃\n${p.dT < 0.5 ? '冷热均匀，空气不动' : day ? '近地面：海洋 → 陆地（海风）' : '近地面：陆地 → 海洋（陆风）'}\n弯曲的线是等压面`);
      },
      margin() {
        const day = p.time === 0;
        return [day ? '白天' : '夜晚', day ? '陆地升温快 → 热' : '陆地降温快 → 冷', day ? '陆上空气上升' : '陆上空气下沉', day ? '近地面：陆低海高' : '近地面：陆高海低', '高空正好相反', '风：高压 → 低压'];
      },
    };
  },
};

// ---------------------------------------------------------------- 等高线
const hgt = (x, z) => 2.7 * Math.exp(-((x + 0.9) ** 2 + (z + 0.2) ** 2) / 1.5) + 1.9 * Math.exp(-((x - 1.1) ** 2 + (z - 0.5) ** 2) / 0.9) + 0.5 * Math.exp(-((x + 0.2) ** 2 + (z - 1.6) ** 2) / 1.2);
const contour = {
  id: 'geo-contour', subject: 'geo', title: '等高线地形图', en: 'Reading contour lines',
  lede: ['用一个水平面去切一座山，切口是一条闭合的曲线。每隔相同的高度切一刀，把所有切口垂直投影到纸上，就得到等高线地形图。', '学会读它，一张平面的图就能在脑子里重新立起来。'],
  formula: '坡度 ≈ 高差 ÷ 水平距离', formulaNote: '同一幅图上，等高线越密，坡越陡；越疏，坡越缓',
  terms: [['等高距', '相邻两条等高线之间的高度差。'], ['山脊与山谷', '等高线向低处凸为山脊，向高处凸为山谷。'], ['鞍部', '两个山顶之间较低的部位。']],
  predict: { q: '图上等高线最密集的地方，实地是什么样？', options: ['最高的地方', '坡最陡的地方', '最平坦的地方'], answer: 1, why: '相邻等高线的高差固定。线挤得越密，说明走很短的水平距离就升高了一个等高距，坡当然陡。密集到重叠，就是陡崖。' },
  challenge: '移动水面，找出两座山头“连成一片”时的海拔，那里就是鞍部的高度。',
  fig: '立体地形（左）与它的等高线地形图（右）', hint: '升降蓝色截面，看它在图上是哪一条线。',
  teach: {
    where: '人教版地理 必修第一册 · 地貌：常见地貌类型、地貌的观察；等高线地形图的判读（初高中衔接）。',
    ask: ['从主峰下山，沿哪个方向走最省力？沿哪个方向最陡？在图上指出来。', '如果下雨，雨水会沿山脊流还是沿山谷流？河流在图上应该画在哪里？'],
    simplify: '地形是用几个平滑山包叠加出来的虚构地形，1 个书本单位约合 200 m；等高线由程序在网格上插值绘出。',
  },
  controls: [
    { id: 'h', label: '截面海拔', min: 0, max: 560, step: 10, value: 300, unit: 'm' },
    { id: 'step', type: 'choice', label: '等高距', options: ['50 m', '100 m', '200 m'], value: 1 },
    { id: 'cut', type: 'toggle', label: '显示截面', value: true },
  ],
  build(k) {
    const p = k.p, X = -2.4, Z = -0.9, S = 4.7, N = 72, HALF = 2.6;
    const cv = document.createElement('canvas'); cv.width = cv.height = 768;
    const x = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv); tex.anisotropy = 8;
    const geo = new THREE.PlaneGeometry(S, S, N, N).rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, k2 = (2 * HALF) / S;
    for (let i = 0; i < pos.count; i++) pos.setY(i, hgt(pos.getX(i) * k2, pos.getZ(i) * k2) / k2);
    geo.computeVertexNormals();
    const hill = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
    hill.castShadow = hill.receiveShadow = true;
    const map = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 3.7).translate(0, 1.85, 0), new THREE.MeshBasicMaterial({ map: tex }));
    map.rotation.x = -0.8;
    const water = flat(new THREE.PlaneGeometry(S + 0.3, S + 0.3).rotateX(-Math.PI / 2), C.sky, { opacity: 0.28 });
    const info = at(card('\n', { w: 3.7, size: 0.31, align: 'left' }), 2.6, 0, 2.9);
    k.root.add(at(hill, X, 0.03, Z), at(map, 2.7, 0, -1.4), at(water, X, 0, Z), info, at(box(S + 0.2, 0.06, S + 0.2), X, -0.04, Z));
    const G = 96, grid = new Float32Array((G + 1) * (G + 1));
    for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++) grid[j * (G + 1) + i] = hgt(-HALF + (2 * HALF * i) / G, -HALF + (2 * HALF * j) / G) * 200;
    const trace = (lv) => {
      const c = cv.width / G; x.beginPath();
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
        const a = grid[j * (G + 1) + i], b = grid[j * (G + 1) + i + 1], d = grid[(j + 1) * (G + 1) + i], e = grid[(j + 1) * (G + 1) + i + 1];
        const pts = [];
        if ((a < lv) !== (b < lv)) pts.push([i + (lv - a) / (b - a), j]);
        if ((b < lv) !== (e < lv)) pts.push([i + 1, j + (lv - b) / (e - b)]);
        if ((d < lv) !== (e < lv)) pts.push([i + (lv - d) / (e - d), j + 1]);
        if ((a < lv) !== (d < lv)) pts.push([i, j + (lv - a) / (d - a)]);
        for (let q = 0; q + 1 < pts.length; q += 2) { x.moveTo(pts[q][0] * c, pts[q][1] * c); x.lineTo(pts[q + 1][0] * c, pts[q + 1][1] * c); }
      }
      x.stroke();
    };
    let last = '';
    const draw = () => {
      const st = [50, 100, 200][p.step];
      x.fillStyle = '#fdfaf2'; x.fillRect(0, 0, 768, 768);
      x.strokeStyle = '#1e2b36'; x.lineCap = 'round';
      for (let lv = st; lv < 560; lv += st) { x.lineWidth = lv % (st * 5) === 0 || st === 200 ? 3 : 1.8; trace(lv); }
      if (p.cut && p.h > 0) { x.strokeStyle = '#2f7fe0'; x.lineWidth = 6; trace(p.h + 0.01); }
      x.fillStyle = '#b4653a'; x.font = 'bold 22px Georgia,serif'; x.textAlign = 'center';
      [[-0.9, -0.2, hgt(-0.9, -0.2)], [1.1, 0.5, hgt(1.1, 0.5)]].forEach(([px, pz, hh]) => { const u = ((px + HALF) / (2 * HALF)) * 768, v = ((pz + HALF) / (2 * HALF)) * 768; x.fillText('▲', u, v + 8); x.fillText(`${Math.round(hh * 200)}`, u, v - 14); });
      x.strokeStyle = '#1e2b36'; x.lineWidth = 6; x.strokeRect(3, 3, 762, 762);
      tex.needsUpdate = true;
    };
    return {
      update() {
        const key = `${p.h}|${p.step}|${p.cut}`;
        if (key !== last) { last = key; draw(); }
        water.visible = p.cut; water.position.y = 0.03 + (p.h / 200) / k2;
        const peaks = (p.h < hgt(-0.9, -0.2) * 200 ? 1 : 0) + (p.h < hgt(1.1, 0.5) * 200 ? 1 : 0);
        info.set(`蓝线：海拔 ${p.h} m\n${peaks === 0 ? '高过所有山顶' : p.h > 268 && peaks === 2 ? '两座山头各自成圈' : peaks === 2 ? '两座山连成一片' : '只剩主峰露出水面'}`);
      },
      margin: () => [`等高距 ${[50, 100, 200][p.step]} m`, '主峰 约 558 m', '次峰 约 408 m', '线密 → 坡陡', '线疏 → 坡缓', '闭合小圈 → 山顶', '两峰之间 → 鞍部'],
    };
  },
};

// ---------------------------------------------------------------- 月相
const LUNAR = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];
const moon = {
  id: 'geo-moon', subject: 'geo', title: '月相的变化', en: 'Phases of the Moon',
  lede: ['月球自己不发光，永远有半个球被太阳照亮。它绕地球转一圈，我们从地球上看到的亮面，就从一条细眉变成半圆、满圆，再慢慢亏回去。', '变的不是月亮，是我们看它的角度。'],
  formula: '朔望月 ≈ 29.53 天', formulaNote: '新月 → 上弦月 → 满月 → 下弦月 → 新月',
  terms: [['新月（朔）', '月球在地球和太阳之间，亮面背对地球。'], ['满月（望）', '地球在月球和太阳之间，亮面正对地球。'], ['上弦月', '农历初七、初八，右半边亮。']],
  predict: { q: '上弦月出现在农历的哪几天？亮的是哪半边（北半球看）？', options: ['初七、初八，右半边亮', '初七、初八，左半边亮', '廿二、廿三，右半边亮'], answer: 0, why: '上半月，月球运行到太阳以东 90° 的位置，被照亮的右（西）半边朝向我们。口诀：“上上上西西，下下下东东”。上弦月、上半月、上半夜，西边天空、西半边亮。' },
  challenge: '中秋节（八月十五）的月亮大约几点升起？从画面上的位置推一推。',
  fig: '俯视：阳光从左侧来，月球绕地球公转（右下为从地球看到的月相）', hint: '拖动农历日期，或打开“公转”。',
  teach: {
    where: '人教版地理 必修第一册 · 宇宙中的地球（地球的宇宙环境、月相拓展）；初中科学/地理衔接内容。',
    ask: ['“月上柳梢头，人约黄昏后”写的是农历什么时候的月亮？为什么？', '日食只可能发生在农历哪一天？月食呢？'],
    simplify: '月球轨道画成正圆并与黄道面重合（所以这里每个月都“该”有日月食，实际上轨道面有约 5° 的夹角）；月出时间按“每天推迟约 49 分钟”粗略估算，大小与距离不按比例。',
  },
  controls: [
    { id: 'd', label: '农历', min: 1, max: 30, step: 0.1, value: 8, fmt: (v) => LUNAR[Math.min(29, Math.floor(v) - 1)] },
    { id: 'auto', type: 'toggle', label: '公转', value: false },
  ],
  build(k) {
    const p = k.p, Y = 1.8, Z = -0.9, R = 3.0, X = 0.4;
    const half = (r) => flat(new THREE.SphereGeometry(r * 1.03, 28, 14, 0, TAU, 0, Math.PI / 2), '#1e2b36', { opacity: 0.5 });
    const nE = half(0.7), nM = half(0.36); nE.rotation.z = -Math.PI / 2; nM.rotation.z = -Math.PI / 2;
    const earth = at(group(ball(0.7), nE, at(cyl(0.05, Y - 0.7), 0, -Y, 0)), X, Y, Z);
    const moonG = group(ball(0.36, '#f3efe2'), nM);
    const sight = strip(2, { w: 0.035, color: C.ink, opacity: 0.5, normal: [0, 1, 0] });
    k.root.add(earth, moonG, sight, at(torus(R, 0.016, C.ink), X, Y, Z), at(cyl(0.45, 0.1), X, 0, Z));
    for (let i = 0; i < 4; i++) k.root.add(arrow(C.amber, 0.05).set([-4.6, Y, Z - 2.4 + i * 1.6], [-3.6, Y, Z - 2.4 + i * 1.6]));
    k.root.add(at(note('太阳光', { size: 0.32, color: C.copper }), -4.1, Y + 1.5, Z - 2.4));
    const view = at(sheet(2.5, 2.5, () => {}, { lay: 'tilt', opaque: true, ink: true }), 3.3, 0, 2.6);
    const info = at(card('\n\n', { w: 3.9, size: 0.3, align: 'left' }), -0.9, 0, 3.0);
    k.root.add(view, info);
    let last = -1; const st = {};
    return {
      update(dt) {
        if (p.auto) k.set('d', ((p.d - 1 + dt * 1.6) % 29.5) + 1);
        const E = TAU * (p.d - 1) / 29.53, f = (1 - Math.cos(E)) / 2;
        moonG.position.set(X - R * Math.cos(E), Y, Z + R * Math.sin(E));
        sight.set([[X, Y, Z], [moonG.position.x, Y, moonG.position.z]]);
        if (Math.abs(E - last) > 0.01) {
          last = E;
          view.redraw((x, S, w, h) => {
            const c = w * S / 2, r = c * 0.74, wax = E < Math.PI;
            x.fillStyle = '#14171c'; x.fillRect(0, 0, w * S, h * S);
            x.fillStyle = '#3a3f48'; x.beginPath(); x.arc(c, c, r, 0, TAU); x.fill();
            x.fillStyle = '#f6efd6'; x.beginPath();
            x.arc(c, c, r, -Math.PI / 2, Math.PI / 2, !wax);
            x.ellipse(c, c, Math.abs(Math.cos(E)) * r, r, 0, Math.PI / 2, -Math.PI / 2, (Math.cos(E) > 0) === wax);
            x.fill();
          });
        }
        const name = f < 0.03 ? '新月' : f > 0.97 ? '满月' : Math.abs(f - 0.5) < 0.06 ? (E < Math.PI ? '上弦月' : '下弦月') : f < 0.5 ? (E < Math.PI ? '蛾眉月' : '残月') : (E < Math.PI ? '盈凸月' : '亏凸月');
        const rise = (6 + 24 * E / TAU) % 24;
        Object.assign(st, { name, f, rise });
        info.set(`${LUNAR[Math.min(29, Math.floor(p.d) - 1)]}　${name}\n亮面约 ${(f * 100).toFixed(0)}%\n月出约 ${Math.round(rise) % 24} 时`);
      },
      margin: () => [st.name || '', `日地月夹角 ${(((p.d - 1) / 29.53) * 360).toFixed(0)}°`, p.d < 15.8 ? '上半月：西(右)边亮' : '下半月：东(左)边亮', '初一 新月 同升同落', '初七八 上弦 正午升', '十五六 满月 日落升', '廿二三 下弦 半夜升'],
    };
  },
};

export default [seasons, breeze, contour, moon];
