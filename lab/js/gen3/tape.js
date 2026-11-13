// HAIZ 实验册 · 第三代 · 记录纸带与世界线
// 一条从纸卷里送出来的记录纸（像沙摆实验里匀速拉动的木板，或实验室的走纸记录仪）。
// 物体在纸上方运动，它的横向位置被一笔一笔记在纸上：纸就是时间轴，纸上的曲线就是 x–t 图像。
// 把这条曲线“提起来”，每一点升到物体当时真实的高度——平面图像连续地变成物体在时空里走过的路径（世界线）：
//   从正前方看它是物体来回的轨迹，从正上方看它就是印在纸上的 x–t 图像，从侧面看是高度随时间的变化。
// 用法：
//   const r = recorder({ width, z0, z1, speed, traces: [{ kind:'model', fn: (t) => [x, y] | null }] });
//   r.update(tNow, lift)   每帧调用；lift 0 = 只有纸上的印迹，1 = 世界线完全立起
//   r.tOf(z) / r.zOf(t)    纸面位置与时刻互换（抓住纸带拖动 = 拖动时间）
import { THREE, L, C, solid, flat, label, group, at, rot, cyl, box, matFor, TAU } from '../ink.js';
import { KIND } from './know.js';

const SIDES = 7;

function paperTexture(width, unit) {
  // 一格 = 0.5 书本单位；一张贴图覆盖 4 个单位长度，沿纸带方向重复
  const c = document.createElement('canvas'), S = 96;
  c.width = Math.round(width * S); c.height = Math.round(4 * S);
  const x = c.getContext('2d');
  x.fillStyle = '#fbf6e8'; x.fillRect(0, 0, c.width, c.height);
  const grid = (step, a, lw) => {
    x.strokeStyle = `rgba(180,101,58,${a})`; x.lineWidth = lw;
    for (let u = 0; u <= c.height + 1; u += step * S) { x.beginPath(); x.moveTo(0.42 * S, u); x.lineTo(c.width - 0.42 * S, u); x.stroke(); }
    for (let v = c.width / 2 % (step * S); v <= c.width; v += step * S) { if (v < 0.42 * S || v > c.width - 0.42 * S) continue; x.beginPath(); x.moveTo(v, 0); x.lineTo(v, c.height); x.stroke(); }
  };
  grid(0.1, 0.07, 1); grid(0.5, 0.2, 1.4);
  x.strokeStyle = 'rgba(30,43,54,.5)'; x.lineWidth = 2; x.beginPath(); x.moveTo(c.width / 2, 0); x.lineTo(c.width / 2, c.height); x.stroke();
  // 两侧的走纸齿孔：纸动起来时看得见
  x.fillStyle = 'rgba(60,48,32,.55)';
  for (let u = 0.25; u < 4; u += 0.5) for (const v of [0.2, width - 0.2]) { x.beginPath(); x.arc(v * S, u * S, 0.06 * S, 0, TAU); x.fill(); }
  x.strokeStyle = 'rgba(180,101,58,.35)'; x.lineWidth = 1.5;
  for (const v of [0.42, width - 0.42]) { x.beginPath(); x.moveTo(v * S, 0); x.lineTo(v * S, c.height); x.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  t.repeat.set(1, unit / 4);
  return t;
}

/** 一条随时间写在纸上的印迹 + 它立起来的世界线 */
function trace(o, M) {
  const K = KIND[o.kind] || KIND.model;
  const col = o.color ?? K.color, dash = o.dash !== undefined ? o.dash : K.dash;
  // 纸上的印迹：一条贴着纸的扁带
  const pg = new THREE.BufferGeometry(), pp = new Float32Array(M * 2 * 3);
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setIndex(new THREE.BufferAttribute(new Uint32Array((M - 1) * 6), 1));
  const print = flat(pg, col, { opacity: o.opacity ?? 0.92 }); print.frustumCulled = false; print.renderOrder = 2;
  // 世界线：一根细管（参与描边，像一根立在空中的墨线）
  const wg = new THREE.BufferGeometry(), wp = new Float32Array(M * SIDES * 3), wn = new Float32Array(M * SIDES * 3);
  wg.setAttribute('position', new THREE.BufferAttribute(wp, 3)); wg.setAttribute('normal', new THREE.BufferAttribute(wn, 3));
  wg.setIndex(new THREE.BufferAttribute(new Uint32Array((M - 1) * SIDES * 6), 1));
  const line = solid(wg, col, { kind: 'card', roughness: 0.6 }); line.frustumCulled = false; line.castShadow = true;
  line.userData.r = o.lineR;
  // 世界线到纸面的垂线：每隔一段落一根，读者看得出“这一点的影子就是纸上那一点”
  const dg = new THREE.BufferGeometry(), dp = new Float32Array(64 * 2 * 3);
  dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const drops = new THREE.LineSegments(dg, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.35 }));
  drops.layers.set(L.COLOR); drops.frustumCulled = false;
  return { o, K, col, dash, print, pg, pp, line, wg, wp, wn, drops, dg, dp, xs: new Float32Array(M), ys: new Float32Array(M), zs: new Float32Array(M), ok: new Uint8Array(M), ts: new Float64Array(M), ss: new Float64Array(M) };
}

export function recorder(o = {}) {
  const W = o.width ?? 8.6, z0 = o.z0 ?? -3, z1 = o.z1 ?? 4.4, v = o.speed ?? 1.1, Y = o.y ?? 0.035;
  const span = (z1 - z0) / v, ds = o.ds ?? 1 / 60, M = Math.ceil(span / ds) + 2;
  const rW = o.lineR ?? 0.05, pW = o.printW ?? 0.075;
  const g = new THREE.Group();
  // ---- 纸：从纸卷经过“此刻”的笔下，一直铺到近处
  const back = z0 - (o.lead ?? 1.7), len = z1 - back;
  const tex = paperTexture(W, len);
  const paperMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  paperMat.envMapIntensity = 0.5;
  const paper = new THREE.Mesh(new THREE.BoxGeometry(W, 0.022, len).translate(0, 0.011, back + len / 2), paperMat);
  paper.layers.set(L.CLEAN); paper.receiveShadow = true;
  // 纸卷：铜端盖、纸芯；随走纸转动
  const rollR = o.rollR ?? 0.3, rollZ = back - rollR * 0.15;
  const roll = at(rot(cyl(rollR, W - 0.1, '#f4eedd', { seg: 40 }), 0, 0, Math.PI / 2), (W - 0.1) / 2, rollR + 0.03, rollZ);
  const capL = at(rot(cyl(rollR + 0.07, 0.07, '#d9b36a', { seg: 40 }), 0, 0, Math.PI / 2), W / 2 + 0.02, rollR + 0.03, rollZ);
  const capR = at(rot(cyl(rollR + 0.07, 0.07, '#d9b36a', { seg: 40 }), 0, 0, Math.PI / 2), -W / 2 + 0.05, rollR + 0.03, rollZ);
  const spokes = group(...[0, 1, 2].map((i) => rot(box(0.05, 0.03, rollR * 1.7, C.ink), i * Math.PI / 3, 0, 0)));
  spokes.children.forEach((s) => s.geometry.translate(0, -0.015, 0));
  const spin = group(at(spokes.clone(), W / 2 + 0.065, 0, 0), at(spokes, -W / 2 + 0.01, 0, 0));
  spin.position.set(0, rollR + 0.03, rollZ);
  const brackets = [W / 2 + 0.16, -W / 2 - 0.1].map((x) => at(box(0.08, rollR + 0.12, 0.34, '#cfd6dc'), x, 0, rollZ));
  // “此刻”：记录笔落下的那条线
  const now = flat(new THREE.PlaneGeometry(W - 0.84, 0.03).rotateX(-Math.PI / 2), C.copper, { opacity: 0.85 });
  now.position.set(0, Y + 0.004, z0);
  g.add(paper, roll, capL, capR, spin, ...brackets, now);
  // ---- 时间刻度：每秒一格，数字随纸移动
  const ticks = [], tickN = Math.ceil(span) + 2;
  for (let i = 0; i < tickN; i++) {
    const t = label('', { lay: 'flat', size: 0.24, italic: true, color: '#51606b', w: 1.1, align: 'left' });
    const m = flat(new THREE.PlaneGeometry(0.34, 0.025).rotateX(-Math.PI / 2), C.ink, { opacity: 0.6 });
    g.add(t, m); ticks.push({ t, m, n: null });
  }
  // ---- 印迹与世界线
  const trs = (o.traces || []).map((d) => trace(d, M));
  trs.forEach((t) => g.add(t.print, t.line, t.drops));

  const zOf = (t, tNow) => z0 + (tNow - t) * v;
  const tOf = (z, tNow) => tNow - (z - z0) / v;
  const tg = new THREE.Vector3(), nm = new THREE.Vector3(), bn = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

  g.update = (tNow, lift = 0, tMin = -Infinity) => {
    tex.offset.y = -((tNow * v) / 4) % 1;
    spin.rotation.x = -(tNow * v) / rollR; roll.rotation.x = spin.rotation.x;
    // 刻度
    const n0 = Math.ceil(tNow - span), used = new Set();
    for (let n = n0; n <= Math.floor(tNow); n++) used.add(n);
    for (const tk of ticks) if (tk.n !== null && !used.has(tk.n)) tk.n = null;
    for (const n of used) {
      if (n < Math.max(0, Math.ceil(tMin))) continue;
      let tk = ticks.find((x) => x.n === n) || ticks.find((x) => x.n === null);
      if (!tk) continue;
      if (tk.n !== n) { tk.n = n; tk.t.set(`${n} s`); }
    }
    for (const tk of ticks) {
      const on = tk.n !== null && tk.n >= Math.max(0, Math.ceil(tMin));
      tk.t.visible = tk.m.visible = on;
      if (!on) continue;
      const z = zOf(tk.n, tNow);
      tk.m.position.set(W / 2 - 0.62, Y + 0.004, z); tk.t.position.set(W / 2 - 0.06, Y + 0.004, z - 0.02);
      tk.t.visible = z > z0 + 0.25 && z < z1 - (o.tickClear ?? 0);
    }
    // 采样：网格对齐（t = j·ds），纸动时曲线不闪
    const jNow = Math.floor(tNow / ds);
    for (const T of trs) {
      let n = 0;
      for (let j = 0; j < M; j++) {
        const t = j === 0 ? tNow : (jNow - j + 1) * ds;
        if (t < tMin - 1e-9) break;
        const p = T.o.fn(t);
        T.ts[n] = t;
        if (!p) { T.ok[n] = 0; T.xs[n] = 0; T.ys[n] = 0; T.zs[n] = zOf(t, tNow); n++; continue; }
        T.ok[n] = 1; T.xs[n] = p[0]; T.ys[n] = p[1]; T.zs[n] = zOf(t, tNow); T.ss[n] = p[2] ?? t * v;
        n++;
        if (T.zs[n - 1] > z1) break;
      }
      write(T, n, lift);
    }
  };

  function write(T, n, lift) {
    const { pp, wp, wn, xs, ys, zs, ok, ts, ss } = T, dash = T.dash;
    // 虚线按纸面上的绝对路程分段（fn 可给出第三个值 = 路程；否则按走纸长度）：节拍印在纸上，跟着纸走
    const per = dash ? dash[0] + dash[1] : 1;
    const on = (i) => ok[i] && ok[i + 1] && zs[i + 1] <= z1 + 1e-6 && (!dash || ((((ss[i] + ss[i + 1]) / 2 % per) + per) % per) < dash[0]);
    // 纸上的印迹
    const pi = T.pg.index.array; let pc = 0;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      let tx = xs[b] - xs[a], tz = zs[b] - zs[a]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const sx = -tz * pW / 2, sz = tx * pW / 2;
      pp.set([xs[i] + sx, Y + 0.006, zs[i] + sz, xs[i] - sx, Y + 0.006, zs[i] - sz], i * 6);
      if (i < n - 1 && on(i)) { const k = i * 2; pi.set([k, k + 1, k + 2, k + 1, k + 3, k + 2], pc); pc += 6; }
    }
    T.pg.setDrawRange(0, pc); T.pg.index.needsUpdate = true; T.pg.attributes.position.needsUpdate = true;
    // 世界线
    const show = lift > 0.004;
    T.line.visible = show; T.drops.visible = show && lift > 0.08 && T.o.drops !== false;
    if (!show) { T.wg.setDrawRange(0, 0); return; }   // 收起时清空：射线拾取不看 visible，旧几何不能挡住别的把手
    const wi = T.wg.index.array; let wc = 0;
    const r = (T.line.userData.r ?? rW) * Math.min(1, 0.35 + lift);
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      tg.set(xs[b] - xs[a], (ys[b] - ys[a]) * lift, zs[b] - zs[a]);
      if (tg.lengthSq() < 1e-12) tg.set(0, 0, 1);
      tg.normalize();
      nm.crossVectors(tg, up); if (nm.lengthSq() < 1e-6) nm.set(1, 0, 0); nm.normalize();
      bn.crossVectors(nm, tg).normalize();
      const cy = Y + 0.02 + ys[i] * lift;
      for (let s = 0; s < SIDES; s++) {
        const ang = (s / SIDES) * TAU, c = Math.cos(ang), si = Math.sin(ang);
        const nx = nm.x * c + bn.x * si, ny = nm.y * c + bn.y * si, nz = nm.z * c + bn.z * si;
        const k = (i * SIDES + s) * 3;
        wp[k] = xs[i] + nx * r; wp[k + 1] = cy + ny * r; wp[k + 2] = zs[i] + nz * r;
        wn[k] = nx; wn[k + 1] = ny; wn[k + 2] = nz;
      }
      if (i < n - 1 && on(i)) for (let s = 0; s < SIDES; s++) {
        const p0 = i * SIDES + s, p1 = i * SIDES + (s + 1) % SIDES, q0 = p0 + SIDES, q1 = p1 + SIDES;
        wi.set([p0, q0, p1, p1, q0, q1], wc); wc += 6;
      }
    }
    T.wg.setDrawRange(0, wc); T.wg.index.needsUpdate = true; T.wg.attributes.position.needsUpdate = true; T.wg.attributes.normal.needsUpdate = true;
    T.wg.computeBoundingSphere();
    // 垂线：每隔一段落一根
    let dc = 0;
    const every = T.o.dropEvery ?? 0.25;
    for (let i = 0; i < n && dc < 64; i++) {
      if (!ok[i] || zs[i] > z1) continue;
      const tt = ts[i], ph = ((tt % every) + every) % every;
      if (ph > ds * 0.999 && i !== 0) continue;
      T.dp.set([xs[i], Y + 0.01, zs[i], xs[i], Y + 0.02 + ys[i] * lift, zs[i]], dc * 6); dc++;
    }
    T.dg.setDrawRange(0, dc * 2); T.dg.attributes.position.needsUpdate = true;
    T.drops.material.opacity = (T.o.dropOpacity ?? 0.3) * Math.min(1, lift * 2);
  }

  g.paper = paper; g.zOf = zOf; g.tOf = tOf; g.span = span; g.z0 = z0; g.z1 = z1; g.speed = v; g.width = W; g.traces = trs;
  return g;
}
