// HAIZ · EXPERIMENTARIUM — 生物与生命科学全模块实验包（L4 显微有丝分裂 + 7 个 L3 深度探究实验）
import {
  C, L, TAU, clamp, lerp, group, at, rot, box, cyl, ball, cone, torus, plate,
  solid, flat, glass, rod, wire, tube, spring, arrow, strip, dash, glow, jar,
  label, note, card, plot, dots, liquid, sheet, meter, bubbler, flow, lathe,
  vessel, dimension, retort, stand, wavelength, sig, freshGroup, THREE,
} from '../core/ink.js';
import { KIND, DEG, rng, gauss, linearRegression, sampleStats, chiSquare } from '../core/epistemic.js';

const beaker = (r, h) => group(
  glass(new THREE.CylinderGeometry(r, r, h, 44, 1, true).translate(0, h / 2, 0)),
  glass(new THREE.CircleGeometry(r, 44).rotateX(-Math.PI / 2).translate(0, 0.03, 0)),
);

// ============================================================================
// 1. 洋葱根尖有丝分裂装片观测与周期推断 (L4, 原样保留)
// ============================================================================
const PHASES = ['间期', '前期', '中期', '后期', '末期'];
// 标准正常洋葱根尖分生区细胞周期约 12 小时（720 min）各时期真实比例近似分布
const BASE_WEIGHTS = [0.80, 0.09, 0.04, 0.04, 0.03];

function generateTissue(seed = 2026, perturb = 0) {
  const rand = rng(seed);
  // perturb: 0=正常, 1=秋水仙素(抑制纺锤体，中期积聚), 2=低温4°C(整体阻滞间期上升)
  const w = perturb === 1 ? [0.68, 0.08, 0.21, 0.02, 0.01] : perturb === 2 ? [0.91, 0.04, 0.02, 0.02, 0.01] : BASE_WEIGHTS;
  const cum = [];
  let acc = 0;
  for (const x of w) { acc += x; cum.push(acc); }
  const cells = [];
  const cols = 9, rows = 6;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u = rand();
      let phase = 0;
      while (phase < cum.length - 1 && u > cum[phase]) phase++;
      const cx = (c + 0.5 + (rand() - 0.5) * 0.22) / cols;
      const cy = (r + 0.5 + (rand() - 0.5) * 0.22) / rows;
      const wCell = 0.085 + rand() * 0.025, hCell = 0.11 + rand() * 0.035;
      const angle = (rand() - 0.5) * Math.PI;
      cells.push({ id: r * cols + c, cx, cy, w: wCell, h: hCell, angle, phase, tagged: null });
    }
  }
  return cells;
}

export const microscopeMitosis = {
  id: 'bio-microscope-mitosis',
  subject: 'bio',
  title: '洋葱根尖有丝分裂装片观测与周期推断',
  en: 'Root-tip mitosis microscopy & cell-cycle phase statistics',
  lede: [
    '把制备好的龙胆紫染色洋葱根尖装片推上载物台：先低倍镜寻找正方形紧致的分生区细胞，再转动转换器切换 40× 高倍物镜调细准焦螺旋。',
    '逐个判读显微镜视野中的分裂相并记入统计表，推算各时期相对时长；施加秋水仙素或低温处理，检验纺锤体阻断带来的中期细胞积聚。',
  ],
  formula: 'T_期 = T_总 × (N_期 / N_总) · 有丝分裂指数 MI = N_分裂 / N_总',
  formulaNote: '以视野中多区随机取样的细胞频数比例估算群体的周期时间分配（T_总 ≈ 12.0 h）',
  terms: [
    ['分生区特征', '细胞呈近正方形、排列紧密、细胞核大、无大液泡（伸长区呈长矩形则无分裂相）'],
    ['先低后高原则', '直接上 40× 物镜视野小且易压碎玻片，须先在 10× 下找准分生区中央并居中'],
    ['秋水仙素效应', '抑制纺锤丝形成，导致姐妹染色单体无法移向两极，大量停滞在中期（中期比例飙升）'],
  ],
  predict: {
    q: '在显微镜视野中统计 100 个洋葱根尖分生区细胞，哪种时期的细胞数量最多？',
    options: ['分裂中期（染色体最清晰）', '分裂间期（G₁ + S + G₂ 占比最长）', '分裂后期（染色体加倍时期）'],
    answer: 1,
    why: '细胞周期约 80%–90% 的时间处于分裂间期进行 DNA 复制与蛋白质合成，因此显微镜瞬时“快照”中绝大多数细胞处于间期，有丝分裂仅占约 10%–20%。',
  },
  challenge: '调准焦距并把 10× 切换至 40× 观察至少 15 个细胞完成人工判读；再用秋水仙素对照实验验证中期阻滞卡方偏离！',
  fig: '双目生物显微镜与载物台移动视野预览屏',
  hint: '旋转粗/细准焦螺旋对焦，拖动载玻片在分生区与伸长区间移动，点击切换 10×/40× 物镜；进入工作台点击视野细胞亲自判读计数！',
  teach: {
    where: '人教版生物学必修1第六章 §6.1《实验：观察根尖分生区组织细胞的有丝分裂》（海南高中生物核心必做）',
    ask: [
      '装片经过“解离—漂洗—染色—制片”后细胞是否还活着？为什么视野里不能看到单个细胞连续分裂动态？',
      '用多个独立视野合并计数相比单视野有何统计学优势？用卡方值 χ² 说明样本量效应。',
    ],
    simplify: '设洋葱根尖分生区完整周期为 12.0 h；虚拟装片模拟甲苯胺蓝/龙胆紫染色典型形态并加入焦平面离焦高斯模糊近似。',
    safety: '解离液含盐酸与酒精混合液具刺激性与腐蚀性，真实实验须通风操作并谨慎使用压片载玻片。',
  },
  controls: [
    { id: 'obj', label: '物镜倍率', type: 'choice', options: ['10× 低倍寻区', '40× 高倍辨相'], value: 0 },
    { id: 'focus', label: '焦距微调 (z)', min: -1.0, max: 1.0, step: 0.02, value: -0.36, unit: 'mm' },
    { id: 'zone', label: '载玻片视野位置', type: 'choice', options: ['分生区（正方形紧密）', '伸长区（长条已分化）'], value: 0 },
    { id: 'treat', label: '生理处理条件', type: 'choice', options: ['正常对照组 (25°C)', '秋水仙素阻滞纺锤体', '低温处理 (4°C)'], value: 0 },
    { id: 'bAutofocus', label: '精细对焦辅助', type: 'button', action: 'autofocus', text: '微调至清晰焦面' },
  ],
  record: {
    note: '统计每组视野的总细胞数、各分裂期数量与有丝分裂指数（MI），并与 12 小时标准周期模型对比。',
    pending: '点击工作台中细胞判读并按“记录本视野统计”录入个人数据。',
    columns: [
      { key: 'treatName', label: '处理条件' },
      { key: 'total', label: '样本细胞数 N', digits: 0 },
      { key: 'inter', label: '间期', digits: 0 },
      { key: 'mito', label: '分裂期合计', digits: 0 },
      { key: 'meta', label: '中期数', digits: 0 },
      { key: 'miPct', label: '有丝分裂指数', unit: '%', digits: 1, stat: true },
    ],
    sample: (inst, p) => {
      const counts = inst.counts();
      const total = counts.reduce((a, b) => a + b, 0);
      if (total < 1) return null;
      const mito = total - counts[0];
      return {
        _kind: 'human',
        treatName: ['正常对照', '秋水仙素', '低温4°C'][p.treat ?? 0],
        total, inter: counts[0], mito, meta: counts[2], miPct: (mito / total) * 100,
      };
    },
    summary: (rows) => [
      ['已录入视野组', `${rows.length} 组`],
      ['最近有丝分裂指数', rows.length ? `${rows[rows.length - 1].miPct.toFixed(1)}%` : '—'],
    ],
    errors: [
      '选区偏差：误停在伸长区会看到几乎全是间期长矩形细胞，误以为实验“未染色或无分裂”。',
      '样本偏差：仅挑分裂相集中的局部计数会高估有丝分裂指数。',
    ],
  },

  build(k) {
    const p = k.p;
    const base = group(
      at(box(2.5, 0.22, 2.8, '#283138', { kind: 'metal' }), -0.7, 0.11, -0.3),
      at(box(0.45, 3.3, 0.55, '#313c44', { kind: 'metal' }), -0.7, 1.85, -1.2),
      at(box(1.9, 0.12, 1.8, '#1e2429', { kind: 'metal' }), -0.7, 1.65, -0.2),
    );
    k.root.add(base);

    // 载玻片与紫色根尖涂片
    const slide = group(
      glass(new THREE.BoxGeometry(1.45, 0.04, 0.55), { color: 0xeaf6fb, opacity: 0.52 }),
      at(flat(new THREE.CircleGeometry(0.14, 18).rotateX(-Math.PI / 2), '#693482', { opacity: 0.78 }), 0, 0.025, 0),
    );
    slide.position.set(-0.7, 1.74, -0.15);
    k.root.add(slide);

    // 物镜转盘与镜筒
    const turret = group(
      cyl(0.42, 0.14, '#cfd6dc', { seg: 20, kind: 'metal' }),
      at(cyl(0.11, 0.48, '#2f3a42', { seg: 14 }), 0.22, -0.25, 0.14),
      at(cyl(0.11, 0.72, '#b4653a', { seg: 14 }), -0.22, -0.37, 0.14),
    );
    turret.position.set(-0.7, 2.65, -0.15);
    const tubeMesh = at(rot(cyl(0.19, 1.4, '#36414b', { seg: 18 }), 0.28, 0, 0), -0.7, 3.45, -0.35);
    const knobC = at(rot(cyl(0.24, 0.28, '#d9b36a', { seg: 18, kind: 'metal' }), 0, 0, Math.PI / 2), -0.32, 1.45, -1.2);
    k.root.add(turret, tubeMesh, knobC);

    // 右侧高清圆视野显像板
    const fovSheet = sheet(3.2, 3.2, () => {}, {});
    fovSheet.position.set(1.85, 2.35, -0.15);
    fovSheet.rotation.y = -0.2;
    k.root.add(fovSheet, at(note('拖动右旋钮调焦 · 点细胞工作台计数', { size: 0.20, w: 3.1 }), 1.85, 0.42, -0.1));

    let cells = generateTissue(2026 + (p.treat ?? 0) * 97, p.treat ?? 0);
    let lastTreat = p.treat ?? 0, lastPaint = '';

    const drawFOV = () => {
      const focusErr = Math.abs(p.focus ?? 0);
      const isElong = p.zone === 1;
      const pk = `${p.obj}|${focusErr.toFixed(2)}|${p.zone}|${p.treat}`;
      if (pk === lastPaint) return;
      lastPaint = pk;
      fovSheet.redraw((x, s, w, h) => {
        const W = w * s, H = h * s, r = W * 0.45, cx = W / 2, cy = H / 2;
        x.fillStyle = '#1b1d22'; x.fillRect(0, 0, W, H);
        x.save(); x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.clip();
        x.fillStyle = '#f8f2fc'; x.fillRect(0, 0, W, H);
        x.filter = focusErr > 0.06 ? `blur(${Math.min(10, focusErr * 12).toFixed(1)}px)` : 'none';
        const zoom = p.obj === 1 ? 1.55 : 0.92;
        for (const c of cells) {
          const px = cx + (c.cx - 0.5) * W * zoom;
          const py = cy + (c.cy - 0.5) * H * zoom;
          const cw = c.w * W * zoom * (isElong ? 2.1 : 1.0);
          const ch = c.h * H * zoom * (isElong ? 0.65 : 1.0);
          x.save(); x.translate(px, py);
          x.strokeStyle = '#6f4289'; x.lineWidth = s * 0.015;
          x.fillStyle = 'rgba(218, 194, 232, 0.42)';
          x.beginPath(); x.rect(-cw / 2, -ch / 2, cw, ch); x.fill(); x.stroke();
          // 细胞核/染色体
          const ph = isElong ? 0 : c.phase;
          x.fillStyle = '#431963';
          if (ph === 0) { x.beginPath(); x.arc(0, 0, Math.min(cw, ch) * 0.25, 0, TAU); x.fill(); }
          else if (ph === 1) {
            for (let t = 0; t < 6; t++) {
              x.beginPath(); x.arc((t % 3 - 1) * cw * 0.12, (Math.floor(t / 3) - 0.5) * ch * 0.14, s * 0.025, 0, TAU); x.fill();
            }
          } else if (ph === 2) {
            x.lineWidth = s * 0.03; x.strokeStyle = '#381058';
            x.beginPath(); x.moveTo(-cw * 0.26, 0); x.lineTo(cw * 0.26, 0); x.stroke();
          } else if (ph === 3) {
            x.fillRect(-cw * 0.22, -ch * 0.28, cw * 0.44, s * 0.03);
            x.fillRect(-cw * 0.22, ch * 0.24, cw * 0.44, s * 0.03);
          } else {
            x.beginPath(); x.arc(0, -ch * 0.22, s * 0.055, 0, TAU); x.arc(0, ch * 0.22, s * 0.055, 0, TAU); x.fill();
          }
          x.restore();
        }
        x.filter = 'none';
        x.restore();
        x.strokeStyle = '#d9b36a'; x.lineWidth = s * 0.04;
        x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.stroke();
      });
    };

    let fy0 = null, f0 = 0;
    k.drag(knobC, {
      start: (q) => { fy0 = q.y; f0 = p.focus; },
      move: (q) => { if (fy0 !== null) { k.set('focus', clamp(Math.round((f0 + (q.y - fy0) * 0.8) * 50) / 50, -1, 1)); lastPaint = ''; drawFOV(); k.dirty(); } },
      end: () => { fy0 = null; },
    });

    const syncRig = () => {
      turret.rotation.y = p.obj === 1 ? Math.PI : 0;
      turret.position.y = 2.65 - (p.focus ?? 0) * 0.22;
      knobC.rotation.x = (p.focus ?? 0) * 5;
      slide.position.x = p.zone === 1 ? -0.45 : -0.7;
      if ((p.treat ?? 0) !== lastTreat) {
        lastTreat = p.treat ?? 0;
        cells = generateTissue(2026 + lastTreat * 97, lastTreat);
        lastPaint = '';
      }
      drawFOV();
    };
    syncRig();

    return {
      getCells: () => cells,
      counts() {
        const res = [0, 0, 0, 0, 0];
        for (const c of cells) if (c.tagged !== null) res[c.tagged]++;
        return res;
      },
      autoTagAll() {
        for (const c of cells) c.tagged = p.zone === 1 ? 0 : c.phase;
      },
      press(id) {
        if (id === 'autofocus' || id === 'bAutofocus') { k.set('focus', 0); syncRig(); k.dirty(); }
      },
      change() { syncRig(); k.dirty(); },
      update() {},
      margin() {
        const clarity = Math.max(0, 100 - Math.abs(p.focus ?? 0) * 95);
        return [
          `倍率 ${p.obj === 1 ? '40× 高倍' : '10× 低倍'}`,
          `区域：${p.zone === 1 ? '伸长区(长矩形)' : '分生区(正方形)'}`,
          `对焦清晰度 ${clarity.toFixed(0)}%`,
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 高倍显微交互判读台（点击视野细胞标注所属时期）');
    let activeBrush = 0;
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = PHASES.map((ph, i) => `<button type="button" class="wb-btn${i === 0 ? ' primary' : ''}" data-ph="${i}">标注：${ph}</button>`).join('')
      + `<button type="button" class="wb-btn" data-act="auto">智能对照全视野标注</button>
         <button type="button" class="wb-btn primary" data-act="rec">计入本视野统计</button>`;
    sec1.append(bar);

    const fov = wb.canvas(sec1, 520, 310, (x, W, H) => {
      const p = sp.params, cells = sp.inst?.getCells?.() || [];
      const focusErr = Math.abs(p.focus ?? 0), isElong = p.zone === 1;
      x.fillStyle = '#181a1f'; x.fillRect(0, 0, W, H);
      x.save(); x.beginPath(); x.arc(W / 2, H / 2, 146, 0, TAU); x.clip();
      x.fillStyle = '#fbf6fe'; x.fillRect(0, 0, W, H);
      x.filter = focusErr > 0.06 ? `blur(${Math.min(8, focusErr * 10).toFixed(1)}px)` : 'none';
      for (const c of cells) {
        const px = W / 2 + (c.cx - 0.5) * 290;
        const py = H / 2 + (c.cy - 0.5) * 290;
        const cw = c.w * 280 * (isElong ? 2.1 : 1.0), ch = c.h * 280 * (isElong ? 0.65 : 1.0);
        x.save(); x.translate(px, py);
        x.fillStyle = c.tagged !== null ? 'rgba(31,74,62,0.16)' : 'rgba(218,194,232,0.38)';
        x.strokeStyle = c.tagged !== null ? '#1f4a3e' : '#7b4c96';
        x.lineWidth = c.tagged !== null ? 2 : 1.1;
        x.beginPath(); x.rect(-cw / 2, -ch / 2, cw, ch); x.fill(); x.stroke();
        const ph = isElong ? 0 : c.phase;
        x.fillStyle = '#401561';
        if (ph === 0) { x.beginPath(); x.arc(0, 0, 4.5, 0, TAU); x.fill(); }
        else if (ph === 1) { for (let i = -1; i <= 1; i++) { x.beginPath(); x.arc(i * 3.5, (i % 2) * 3, 2, 0, TAU); x.fill(); } }
        else if (ph === 2) { x.fillRect(-7, -2, 14, 4); }
        else if (ph === 3) { x.fillRect(-6, -7, 12, 2.5); x.fillRect(-6, 4.5, 12, 2.5); }
        else { x.beginPath(); x.arc(0, -5, 3, 0, TAU); x.arc(0, 5, 3, 0, TAU); x.fill(); }
        if (c.tagged !== null) {
          x.fillStyle = '#1f4a3e'; x.font = 'bold 10px "Noto Serif SC",serif';
          x.fillText(PHASES[c.tagged][0], -cw / 2 + 3, -ch / 2 + 10);
        }
        x.restore();
      }
      x.filter = 'none';
      x.restore();
      x.strokeStyle = '#d9b36a'; x.lineWidth = 4; x.beginPath(); x.arc(W / 2, H / 2, 146, 0, TAU); x.stroke();
    });

    const statsEl = document.createElement('div');
    statsEl.className = 'wb-metrics';
    sec1.append(statsEl);

    const refresh = () => {
      fov.redraw();
      const counts = sp.inst?.counts?.() || [0, 0, 0, 0, 0];
      const N = counts.reduce((a, b) => a + b, 0);
      const exp = BASE_WEIGHTS.map((w) => w * Math.max(1, N));
      const chi = N > 0 ? chiSquare(counts, exp).chi2 : 0;
      const mi = N > 0 ? ((N - counts[0]) / N) * 100 : 0;
      statsEl.innerHTML = PHASES.map((ph, i) => `<div class="wb-m"><span>${ph}</span><b>${counts[i]} (${N ? ((counts[i] / N) * 12).toFixed(2) + 'h' : '—'})</b></div>`).join('')
        + `<div class="wb-m"><span>MI & χ²(vs正常基准)</span><b>${mi.toFixed(1)}% · χ²=${chi.toFixed(2)}</b></div>`;
    };

    fov.cv.addEventListener('pointerdown', (e) => {
      const pt = fov.toLocal(e), cells = sp.inst?.getCells?.() || [];
      let best = null, bd = 24;
      for (const c of cells) {
        const px = 260 + (c.cx - 0.5) * 290, py = 155 + (c.cy - 0.5) * 290;
        const d = Math.hypot(pt.x - px, pt.y - py);
        if (d < bd) { bd = d; best = c; }
      }
      if (best) { best.tagged = activeBrush; refresh(); }
    });

    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      if (btn.dataset.ph !== undefined) {
        activeBrush = +btn.dataset.ph;
        bar.querySelectorAll('[data-ph]').forEach((b) => b.classList.toggle('primary', +b.dataset.ph === activeBrush));
      } else if (btn.dataset.act === 'auto') {
        sp.inst?.autoTagAll?.(); refresh();
      } else if (btn.dataset.act === 'rec') {
        const row = microscopeMitosis.record.sample(sp.inst, sp.params);
        if (row) wb.record(row);
      }
    });

    refresh();
    return { update() { refresh(); } };
  },
};

// ============================================================================
// 2. 植物细胞的质壁分离与复原 (L3)
// ============================================================================
const RT_MPA = 8.314 * 298 / 1000; // ≈ 2.4776 MPa / osM (25°C)
const C_SAP0 = 0.32; // 洋葱外表皮细胞液初始等渗浓度 0.32 M 蔗糖当量

function osmoticState(cExt, soluteIdx, cSap, dead) {
  const vantHoffI = soluteIdx === 1 ? 1.85 : 1.0; // KNO3 实效电离因子 ~1.85，蔗糖 1.0
  const cEffExt = cExt * vantHoffI;
  const psiS_ext = -cEffExt * RT_MPA;
  const vEq = dead ? 0.32 : (cEffExt <= cSap ? clamp(1 + (cSap - cEffExt) * 0.25, 0.95, 1.06) : clamp(cSap / cEffExt, 0.28, 1.0));
  return { vantHoffI, cEffExt, psiS_ext, vEq };
}

export const plasmolysis = {
  id: 'bio-plasmolysis',
  subject: 'bio',
  title: '植物细胞的质壁分离与复原',
  en: 'Plasmolysis and deplasmolysis',
  lede: [
    '紫色洋葱鳞片叶外表皮细胞中央有一个富含花青素的紫色大液泡。把细胞浸入高渗蔗糖溶液（0.3–1.0 M），水分顺着水势梯度渗出，原生质层收缩并与细胞壁分离。',
    '换用清水可使活细胞渗透吸水复原；若换用 KNO₃ 溶液，K⁺ 与 NO₃⁻ 主动进入液泡会引起“先分离后自动复原”；而极端高渗（>0.85 osM）会使原生质膜不可逆损伤失活。',
  ],
  formula: 'Π = i·c·R·T · Ψ_w = Ψ_s + Ψ_p · V_液泡/V₀ = Π_内 / Π_外',
  formulaNote: '水分子从高水势（低溶质浓度）向低水势（高溶质浓度）穿过选择透过性原生质层（细胞液等渗点 ≈ 0.32 M 蔗糖）',
  terms: [
    ['原生质层', '细胞膜、液泡膜以及两层膜之间的细胞质，在渗透作用中相当于半透膜。'],
    ['KNO₃ 自动复原', 'K⁺ 与 NO₃⁻ 可通过主动运输进入细胞液，使细胞液水势低于外界后重新吸水复原。'],
    ['过高渗致死', '外界浓度过高（如 0.9–1.0 M 蔗糖）使细胞剧烈失水，生物膜结构破坏导致无法复原。'],
  ],
  predict: {
    q: '把紫色洋葱外表皮细胞放入 0.30 M KNO₃ 溶液中，持续观察会发生什么现象？',
    options: ['只发生质壁分离，不会复原', '先发生质壁分离，随后无需换清水即自动复原', '细胞直接吸水胀破'],
    answer: 1,
    why: '0.30 M KNO₃ 的有效渗透压（i≈1.85，约 0.56 osM）高于细胞液（0.32 osM），细胞先失水分离；随后 K⁺ 与 NO₃⁻ 被主动吸收进入液泡，细胞液渗透势降低，水分重新渗入使细胞自动复原。',
  },
  challenge: '分别用 0.50 M 蔗糖与 0.30 M KNO₃ 对比“手动换清水复原”与“自动复原”；再把浓度拉到 1.00 M 触发不可逆失活后换清水检验细胞是否仍能复原！',
  fig: '放大的洋葱表皮细胞三维模型、水分子净流向与显微视野',
  hint: '调节外界溶液浓度（0..1.0 M）与溶质类型；点击下方按钮快速滴加 0.50 M 蔗糖、0.30 M KNO₃ 或 0.00 M 清水；进入工作台查看水势与体积动力学曲线。',
  teach: {
    where: '人教版生物学必修1第4章 §4.1《被动运输 · 探究·实践：植物细胞的吸水和失水》（海南高中生物核心实验）',
    ask: [
      '如何设计蔗糖浓度梯度实验，把该洋葱外表皮细胞的细胞液等渗浓度精确夹逼在 0.05 M 区间内？',
      '为什么 0.30 M 蔗糖不使细胞死亡，而 1.00 M 蔗糖处理后即使换清水也无法再复原？',
    ],
    simplify: '设 25°C 下细胞液初始渗透浓度为 0.32 M 蔗糖当量；KNO₃ 主动吸收以一阶动力学逐渐升高胞内渗透压；开启“过高渗致死”开关后在有效渗透浓 >0.85 osM 时不可逆失去选择透过性。',
    safety: '显微镜载玻片与盖玻片边缘薄脆，引流法滴加溶液时注意防止玻璃碎裂划伤手指。',
  },
  controls: [
    { id: 'c', label: '外界溶液浓度', min: 0, max: 1.0, step: 0.02, value: 0.0, unit: 'M' },
    { id: 'solute', label: '外界溶质类型', type: 'choice', options: ['蔗糖 (不可跨膜)', 'KNO₃ (可主动吸收)'], value: 0, wide: true },
    { id: 'deathMode', label: '过高渗致死不可逆', type: 'toggle', value: true },
    { id: 'bSuc05', label: '滴加 0.50 M 蔗糖', type: 'button' },
    { id: 'bKNO3', label: '滴加 0.30 M KNO₃', type: 'button' },
    { id: 'bWater', label: '滴加清水 (0 M)', type: 'button' },
    { id: 'bFreshCell', label: '换取鲜活表皮细胞', type: 'button' },
  ],
  record: {
    note: '记录不同溶质与浓度下的液泡相对体积、细胞水势与复原/失活状态，测定细胞液等渗浓度区间。',
    pending: '调节溶液浓度或切换溶质后点击“记录一组”归档渗透观测。',
    columns: [
      { key: 'soluteName', label: '外界溶质' },
      { key: 'cExt', label: '浓度', unit: 'M', digits: 2 },
      { key: 'osmExt', label: '外界渗透势 Ψ_s', unit: 'MPa', digits: 2 },
      { key: 'volPct', label: '液泡相对体积', unit: '%', digits: 1, stat: true },
      { key: 'psiW', label: '细胞水势 Ψ_w', unit: 'MPa', digits: 2 },
      { key: 'state', label: '状态诊断' },
    ],
    sample: (inst) => {
      const s = inst?.snapshot?.();
      if (!s) return null;
      return {
        _kind: 'human',
        soluteName: s.soluteIdx === 1 ? 'KNO₃' : '蔗糖',
        cExt: s.cExt,
        osmExt: s.psiS_ext,
        volPct: s.v * 100,
        psiW: s.psiW_cell,
        state: s.stateText,
      };
    },
    summary: (rows) => [
      ['已录入浓度梯度', `${rows.length} 组`],
      ['最低液泡体积', rows.length ? `${Math.min(...rows.map((r) => r.volPct)).toFixed(1)}%` : '—'],
    ],
    errors: [
      '误把细胞壁当作半透膜：细胞壁全透性且伸缩性极小，真正收缩的是原生质层。',
      '忽视时间维度：KNO₃ 溶液中若未连续观察，会错过“先短暂分离、后自动复原”的过程。',
    ],
  },

  build(k) {
    const p = k.p;
    const X = -1.5, Z = -0.8, W = 4.0, H = 2.4, D = 2.2;
    const bath = at(flat(new THREE.BoxGeometry(W + 1.5, H + 0.5, D + 1.3).translate(0, (H + 0.5) / 2, 0), C.amber, { opacity: 0.06 }), X, 0.05, Z);
    const wall = at(group(
      glass(new THREE.BoxGeometry(W, H, D).translate(0, H / 2, 0)),
      glass(new THREE.BoxGeometry(W - 0.14, H - 0.14, D - 0.14).translate(0, H / 2, 0)),
    ), X, 0.2, Z);
    const protoMat = new THREE.MeshBasicMaterial({ color: C.leaf, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    const proto = new THREE.Mesh(new THREE.BoxGeometry(W - 0.28, H - 0.28, D - 0.28), protoMat);
    proto.layers.set(L.COLOR);
    const vacMat = new THREE.MeshBasicMaterial({ color: C.violet, transparent: true, opacity: 0.65, depthWrite: false, side: THREE.DoubleSide });
    const vac = new THREE.Mesh(new THREE.BoxGeometry(W - 0.85, H - 0.75, D - 0.85), vacMat);
    vac.layers.set(L.COLOR);
    const nuc = at(ball(0.24, '#e7dfc8'), -1.55, -0.55, 0.55);
    const cellGlow = glow(C.violet, 3.8, 0.35);
    const cell = at(group(proto, vac, cellGlow, nuc), X, 0.2 + H / 2, Z);

    const fl = [
      flow([[X - W / 2 + 0.4, 1.4, Z + D / 2], [X - W / 2 - 1.0, 1.4, Z + D / 2 + 0.25]], 5, C.sky, { r: 0.08 }),
      flow([[X + W / 2 - 0.4, 1.4, Z + D / 2], [X + W / 2 + 1.0, 1.4, Z + D / 2 + 0.25]], 5, C.sky, { r: 0.08 }),
    ];
    const scope = at(sheet(3.1, 3.1, () => {}, { lay: 'tilt', ink: true, opaque: true }), 2.8, 0, -2.5);
    const info = at(card('\n', { w: 3.9, size: 0.29, align: 'left' }), 2.5, 0, 2.4);
    k.root.add(
      bath, wall, cell, ...fl, scope, info,
      at(note('细胞壁(全透)', { size: 0.27 }), X - 0.9, H + 0.65, Z),
      at(note('紫色大液泡', { size: 0.27, color: '#5a3fd0' }), X + 1.05, H + 0.65, Z),
    );

    let v = 1.0, cSap = C_SAP0, dead = false, lastS = -1, lastDead = false, elapsed = 0;
    const history = []; // [t, v, cSap, cEffExt, dead]

    const drawScope = (s, isDead) => scope.redraw((x, S, w, h) => {
      const c = (w * S) / 2;
      x.fillStyle = C.paper; x.fillRect(0, 0, w * S, h * S);
      x.save(); x.beginPath(); x.arc(c, c, c * 0.9, 0, TAU); x.clip();
      x.fillStyle = isDead ? '#efeae6' : '#f7f2ff'; x.fillRect(0, 0, w * S, h * S);
      const cw = w * S * 0.36, ch = h * S * 0.2;
      for (let r = -1; r < 6; r++) {
        for (let q = -1; q < 4; q++) {
          const ox = q * cw + (r % 2 ? cw / 2 : 0), oy = r * ch;
          x.strokeStyle = C.ink; x.lineWidth = S * 0.028; x.strokeRect(ox, oy, cw, ch);
          x.fillStyle = isDead ? 'rgba(130, 108, 125, 0.50)' : 'rgba(122, 92, 255, 0.65)';
          x.beginPath();
          x.roundRect(ox + cw / 2 - cw * 0.44 * s, oy + ch / 2 - ch * 0.4 * s, cw * 0.88 * s, ch * 0.8 * s, ch * 0.2 * (1.6 - s));
          x.fill();
        }
      }
      x.restore();
      x.strokeStyle = isDead ? C.red : C.ink; x.lineWidth = S * 0.05;
      x.beginPath(); x.arc(c, c, c * 0.9, 0, TAU); x.stroke();
    });

    const resetCell = () => {
      v = 1.0; cSap = C_SAP0; dead = false; elapsed = 0; history.length = 0;
      lastS = -1;
    };

    const getSnapshot = () => {
      const st = osmoticState(p.c, p.solute, cSap, dead);
      const cIn = cSap / Math.max(0.28, v);
      const psiS_cell = -cIn * RT_MPA;
      // 当 v >= 0.98 时细胞壁产生膨压 Psi_p 平衡多余渗透吸水
      const psiP_cell = dead ? 0 : Math.max(0, v >= 0.98 ? (st.psiS_ext - psiS_cell) : 0);
      const psiW_cell = psiS_cell + psiP_cell;
      const stateText = dead
        ? '超高渗失活(不可逆)'
        : v < 0.96
          ? (p.solute === 1 && cSap > C_SAP0 + 0.02 ? 'KNO₃ 自动复原中' : '质壁分离')
          : '紧贴细胞壁(正常)';
      return { ...st, cExt: p.c, soluteIdx: p.solute, cSap, cIn, v, dead, psiS_cell, psiP_cell, psiW_cell, stateText, history };
    };

    drawScope(1, false);

    return {
      snapshot: getSnapshot,
      resetCell,
      press(id) {
        if (id === 'bSuc05' || id === 'sug') { k.set('solute', 0); k.set('c', 0.50); }
        else if (id === 'bKNO3' || id === 'kno3') { k.set('solute', 1); k.set('c', 0.30); }
        else if (id === 'bWater' || id === 'wat') { k.set('c', 0.0); }
        else if (id === 'bFreshCell' || id === 'reset') { resetCell(); }
        k.dirty();
      },
      change(id) {
        if (id === 'deathMode' && !p.deathMode) dead = false;
        k.dirty();
      },
      update(dt) {
        const effExt = p.c * (p.solute === 1 ? 1.85 : 1.0);
        if (p.deathMode && effExt >= 0.85) dead = true;
        if (!dead && p.solute === 1 && p.c > 0.01) {
          // KNO3 主动跨膜吸收：内部溶质浓度逐步上升，超越外界渗透压后促进自动复原
          const targetSap = Math.max(cSap, effExt * 1.12);
          cSap += (targetSap - cSap) * (1 - Math.exp(-dt * 0.24));
        }
        const st = osmoticState(p.c, p.solute, cSap, dead);
        const net = st.vEq - v;
        v += net * (1 - Math.exp(-dt / 1.1));
        elapsed += dt;
        if (history.length === 0 || elapsed - history[history.length - 1][0] >= 0.25) {
          history.push([elapsed, v, cSap, st.cEffExt, dead]);
          if (history.length > 120) history.shift();
        }
        const s = Math.cbrt(clamp(v, 0.24, 1.04));
        cell.scale.setScalar(Math.min(1, s));
        vac.scale.setScalar(clamp(0.55 + s * 0.45, 0.45, 1));
        vacMat.color.set(dead ? '#6e5c6b' : C.violet);
        protoMat.color.set(dead ? '#8f8776' : C.leaf);
        cellGlow.material.opacity = dead ? 0.08 : 0.35;
        bath.material.opacity = 0.03 + p.c * 0.35;
        fl.forEach((f) => { f.visible = !dead && Math.abs(net) > 0.004; f.step(dt, clamp(-net * 28, -3, 3)); });
        if (Math.abs(s - lastS) > 0.004 || dead !== lastDead) {
          lastS = s; lastDead = dead;
          drawScope(Math.min(1, s), dead);
        }
        const snap = getSnapshot();
        info.set(
          `液泡体积 ${(Math.min(v, 1.04) * 100).toFixed(0)}% · Ψ_外 ${snap.psiS_ext.toFixed(2)} MPa\n`
          + `${snap.stateText} · Ψ_细胞 ${snap.psiW_cell.toFixed(2)} MPa`,
        );
        this._net = net;
      },
      margin() {
        const snap = getSnapshot();
        const n = this._net || 0;
        return [
          `外界 ${p.c.toFixed(2)} M ${p.solute === 1 ? 'KNO₃' : '蔗糖'} (${snap.cEffExt.toFixed(2)} osM)`,
          `细胞液 ≈ ${snap.cIn.toFixed(2)} osM`,
          `Ψ_s(外) = ${snap.psiS_ext.toFixed(2)} MPa`,
          dead ? '⚠ 膜结构破坏失活' : Math.abs(n) < 0.004 ? '水势动态平衡' : n < 0 ? '水：液泡 → 外界' : '水：外界 → 液泡',
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 渗透水势（Ψ_w = Ψ_s + Ψ_p）与蔗糖梯度平衡曲线');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn" data-act="iso">定位 0.32 M 等渗临界</button>
      <button type="button" class="wb-btn" data-act="suc05">0.50 M 蔗糖分离</button>
      <button type="button" class="wb-btn" data-act="kno3">0.30 M KNO₃ 自动复原</button>
      <button type="button" class="wb-btn" data-act="lethal">1.00 M 超高渗致死</button>
      <button type="button" class="wb-btn" data-act="water">换清水复原</button>
      <button type="button" class="wb-btn" data-act="fresh">换鲜活细胞</button>
      <button type="button" class="wb-btn primary" data-act="rec">记录本状态</button>`;
    sec1.append(bar);

    const chart = wb.canvas(sec1, 520, 260, (x, W, H) => {
      const p = sp.params;
      const snap = sp.inst?.snapshot?.() || { cExt: 0, v: 1, psiS_cell: -0.79, psiP_cell: 0.79, psiW_cell: 0, psiS_ext: 0, cSap: C_SAP0, dead: false };
      const pad = { l: 54, r: 54, t: 26, b: 38 };
      const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      const sx = (c) => pad.l + (c / 1.0) * pw;
      const syV = (vv) => pad.t + ph - clamp((vv - 0.2) / 0.9, 0, 1) * ph;
      const syPsi = (psi) => pad.t + ph - clamp((psi + 4.8) / 5.8, 0, 1) * ph;

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      // 超高渗致死警告带 (effExt >= 0.85)
      const lethalX = p.solute === 1 ? 0.85 / 1.85 : 0.85;
      x.fillStyle = 'rgba(229, 72, 63, 0.09)';
      x.fillRect(sx(lethalX), pad.t, sx(1.0) - sx(lethalX), ph);
      x.fillStyle = '#b43b32'; x.font = '11px "Noto Serif SC",serif'; x.textAlign = 'right';
      x.fillText('过高渗致死区 (>0.85 osM)', sx(0.99), pad.t + 14);

      // 坐标轴
      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.4;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();
      x.beginPath(); x.moveTo(pad.l + pw, pad.t); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();

      // 零水势线
      x.strokeStyle = 'rgba(30,43,54,0.22)'; x.setLineDash([4, 4]);
      x.beginPath(); x.moveTo(pad.l, syPsi(0)); x.lineTo(pad.l + pw, syPsi(0)); x.stroke();
      x.setLineDash([]);

      // 轴刻度
      x.fillStyle = '#51606b'; x.font = '11px Georgia,serif'; x.textAlign = 'center';
      for (let c = 0; c <= 1.01; c += 0.2) x.fillText(`${c.toFixed(1)}M`, sx(c), H - 18);
      x.fillText('外界溶质浓度 (mol/L)', pad.l + pw / 2, H - 4);
      x.textAlign = 'right';
      for (const vv of [0.3, 0.5, 0.8, 1.0]) x.fillText(`${(vv * 100).toFixed(0)}%`, pad.l - 6, syV(vv) + 4);
      x.textAlign = 'left';
      for (const ps of [0, -1, -2, -3, -4]) x.fillText(`${ps}MPa`, pad.l + pw + 5, syPsi(ps) + 4);

      // 平衡体积曲线 V_eq(c)
      x.strokeStyle = '#7a5cff'; x.lineWidth = 2.2; x.beginPath();
      for (let i = 0; i <= 100; i++) {
        const c = i / 100;
        const st = osmoticState(c, p.solute, C_SAP0, false);
        if (i === 0) x.moveTo(sx(c), syV(st.vEq)); else x.lineTo(sx(c), syV(st.vEq));
      }
      x.stroke();

      // 外界渗透势曲线 Ψ_s(外) = -i*c*RT
      x.strokeStyle = '#b4653a'; x.lineWidth = 1.8; x.setLineDash([6, 4]); x.beginPath();
      for (let i = 0; i <= 100; i++) {
        const c = i / 100;
        const st = osmoticState(c, p.solute, C_SAP0, false);
        if (i === 0) x.moveTo(sx(c), syPsi(st.psiS_ext)); else x.lineTo(sx(c), syPsi(st.psiS_ext));
      }
      x.stroke(); x.setLineDash([]);

      // 当前实测点
      x.fillStyle = snap.dead ? '#e5483f' : '#1f4a3e';
      x.beginPath(); x.arc(sx(snap.cExt), syV(snap.v), 5.5, 0, TAU); x.fill();
      x.fillStyle = '#b4653a';
      x.beginPath(); x.arc(sx(snap.cExt), syPsi(snap.psiS_ext), 4.5, 0, TAU); x.fill();

      // 图例
      x.fillStyle = '#7a5cff'; x.textAlign = 'left'; x.font = '11px "Noto Serif SC",serif';
      x.fillText('— 液泡相对体积 V/V₀', pad.l + 8, pad.t + 14);
      x.fillStyle = '#b4653a';
      x.fillText('--- 外界渗透势 Ψ_s (MPa)', pad.l + 145, pad.t + 14);
    });

    const statsEl = document.createElement('div');
    statsEl.className = 'wb-metrics';
    sec1.append(statsEl);

    let lastKey = '';
    const refresh = (force = false) => {
      const snap = sp.inst?.snapshot?.();
      if (!snap) return;
      const kStr = `${snap.cExt.toFixed(2)}|${snap.soluteIdx}|${snap.v.toFixed(3)}|${snap.cSap.toFixed(3)}|${snap.dead}|${sp.params.deathMode}`;
      if (!force && kStr === lastKey) return;
      lastKey = kStr;
      chart.redraw();
      statsEl.innerHTML = `
        <div class="wb-m"><span>液泡相对体积</span><b>${(snap.v * 100).toFixed(1)}%</b></div>
        <div class="wb-m"><span>外界渗透势 Ψ_s(外)</span><b>${snap.psiS_ext.toFixed(2)} MPa</b></div>
        <div class="wb-m"><span>细胞渗透势 / 膨压</span><b>Ψ_s ${snap.psiS_cell.toFixed(2)} / Ψ_p ${snap.psiP_cell.toFixed(2)} MPa</b></div>
        <div class="wb-m"><span>细胞状态诊断</span><b>${snap.stateText}</b></div>`;
    };

    bar.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (!act) return;
      if (act === 'iso') { wb.setParam('solute', 0); wb.setParam('c', 0.32); }
      else if (act === 'suc05') wb.press('bSuc05');
      else if (act === 'kno3') wb.press('bKNO3');
      else if (act === 'lethal') { wb.setParam('solute', 0); wb.setParam('c', 1.0); }
      else if (act === 'water') wb.press('bWater');
      else if (act === 'fresh') wb.press('bFreshCell');
      else if (act === 'rec') {
        const row = plasmolysis.record.sample(sp.inst, sp.params);
        if (row) wb.record(row);
      }
      refresh(true);
    });

    refresh(true);
    return { update() { refresh(false); } };
  },
};

// ============================================================================
// 3. 酶的高效性与温度、pH对酶活性的影响 (L3)
// ============================================================================
const fTempEnzyme = (T) => (T <= 37 ? Math.exp(-(((T - 37) / 17) ** 2)) : Math.exp(-(((T - 37) / 9) ** 2)));
const fPHEnzyme = (ph) => Math.exp(-(((ph - 7.0) / 1.8) ** 2));

export const enzyme = {
  id: 'bio-enzyme',
  subject: 'bio',
  title: '酶的高效性与温度、pH对酶活性的影响',
  en: 'Enzyme efficiency and denaturation',
  lede: [
    '过氧化氢酶能将 H₂O₂ 分解速率提高数百万倍：相比 FeCl₃ 溶液与蒸馏水，新鲜肝脏研磨液的 U 形气压计液柱几乎瞬间飙升、气泡翻涌。',
    '酶的活性受温度与 pH 精密制约：0°C 低温只是暂时抑制酶分子活性，回到 37°C 即完全恢复；而 80°C 高温破坏酶的空间结构，即使降温回 37°C 也不可逆失活。',
  ],
  formula: '2H₂O₂ —(过氧化氢酶)→ 2H₂O + O₂↑ · v ∝ [E]_活性 · f(T) · g(pH)',
  formulaNote: '高温（>52°C）触发一级不可逆热变性 d[E]_活性/dt = −k_d(T)[E]_活性；低温抑制不破坏空间结构',
  terms: [
    ['高效性', '酶降低化学反应活化能的作用比无机催化剂（如 FeCl₃）更显著，催化效率高得多。'],
    ['低温可逆抑制', '0°C 降低分子热运动与酶促速率，但肽链空间构象未破坏，升温回 37°C 活性恢复。'],
    ['高温不可逆变性', '80°C 破坏维持酶三维结构的氢键与疏水作用，空间结构永久损毁，降温也无法复原。'],
  ],
  predict: {
    q: '分别将两支过氧化氢酶先置于 0°C 冰浴和 80°C 沸水浴中处理 5 分钟，再同时移入 37°C 最适水浴，结果如何？',
    options: [
      '两支都能完全恢复最高活性',
      '0°C 处理组回温后活性恢复，80°C 处理组因空间结构被破坏而永久失活',
      '80°C 处理组反而催化得更快',
    ],
    answer: 1,
    why: '低温只抑制酶活性而不破坏空间结构，回温到 37°C 即可恢复；高温（80°C）导致酶不可逆变性失活，回到 37°C 也无法恢复。',
  },
  challenge: '依次测试“0°C → 37°C 可逆回温”和“80°C → 37°C 不可逆变性”，并在工作台对比“换一支新酶”前后活力曲线的重合与坍塌！',
  fig: '恒温水浴反应试管、O₂ 气泡发生器与 U 形管气压计',
  hint: '拖动温度和 pH 滑块，点击 0°C/37°C/80°C 一键切换验证可逆性；或切换 FeCl₃ / 蒸馏水比较高效性。',
  teach: {
    where: '人教版生物学必修1第5章 §5.1《降低化学反应活化能的酶 · 探究·实践》（海南高中生物核心实验）',
    ask: [
      '如果真实实验中直接用 H₂O₂ 探究温度对酶活性的影响，会有什么科学干扰？为什么教材建议温度组改用淀粉酶与淀粉？',
      '过酸（pH=2）或过碱（pH=11）环境下再调回 pH=7，酶的活性还能恢复吗？',
    ],
    simplify: '模型采用钟形温度响应（最适 37°C）和 pH 响应（最适 7.0），高于 52°C 产生一级不可逆变性累积；单独开关可切换“不可逆热变性”对照理想数学模型。',
    safety: '3%–5% 过氧化氢溶液对皮肤和眼睛有刺激性；热水浴操作注意防止烫伤。',
  },
  controls: [
    { id: 'T', label: '水浴温度 T', min: 0, max: 80, step: 1, value: 37, unit: '°C' },
    { id: 'pH', label: '缓冲液 pH', min: 2.0, max: 12.0, step: 0.2, value: 7.0 },
    { id: 'cat', label: '催化剂种类', type: 'choice', options: ['新鲜肝脏研磨液(酶)', 'FeCl₃ 无机催化剂', '蒸馏水(空白)'], value: 0, wide: true },
    { id: 'irrev', label: '高温不可逆变性', type: 'toggle', value: true },
    { id: 'bCold', label: '0°C 低温冰浴', type: 'button' },
    { id: 'bOpt', label: '回温至 37°C', type: 'button' },
    { id: 'bBoil', label: '80°C 高温处理', type: 'button' },
    { id: 'bFresh', label: '换一支新酶', type: 'button' },
  ],
  record: {
    note: '记录催化剂种类、温度、pH、失活比例与 O₂ 产气速率（个/分），比较高效性与可逆/不可逆失活。',
    pending: '设定实验条件稳定后点击“记录一组”录入反应速率。',
    columns: [
      { key: 'catName', label: '催化剂' },
      { key: 'T', label: '温度', unit: '°C', digits: 0 },
      { key: 'pH', label: 'pH', digits: 1 },
      { key: 'denPct', label: '热变性失活', unit: '%', digits: 0 },
      { key: 'rate', label: 'O₂ 产气速率', unit: '个/分', digits: 0, stat: true },
    ],
    sample: (inst, p) => {
      const s = inst?.snapshot?.();
      if (!s) return null;
      return {
        _kind: 'human',
        catName: ['过氧化氢酶', 'FeCl₃', '蒸馏水'][p.cat ?? 0],
        T: p.T,
        pH: p.pH,
        denPct: s.den * 100,
        rate: s.a * 120,
      };
    },
    summary: (rows) => [
      ['已录入测定条件', `${rows.length} 组`],
      ['最高 O₂ 产气速率', rows.length ? `${Math.max(...rows.map((r) => r.rate)).toFixed(0)} 个/分` : '—'],
    ],
    errors: [
      '把 80°C 降回 37°C 误以为酶会“复活”：变性是一级不可逆过程，必须更换新酶才能重新催化。',
      '探究温度时把底物与酶先混合再保温：应在各自温度下先预热平衡再混合。',
    ],
  },

  build(k) {
    const p = k.p;
    const X = -1.9, Z = -0.6;
    const bath = at(beaker(1.45, 1.8), X, 0.05, Z);
    const water = at(liquid(1.36, 1.35, '#cfe6ff', 0.32), X, 0.09, Z);
    const tubeG = at(group(
      glass(new THREE.CylinderGeometry(0.44, 0.44, 3.0, 32, 1, true).translate(0, 1.8, 0)),
      glass(new THREE.SphereGeometry(0.44, 24, 12, 0, TAU, Math.PI / 2, Math.PI / 2).translate(0, 0.3, 0)),
    ), X - 0.15, 0.25, Z);
    const sol = at(liquid(0.40, 1.6, '#fff3d8', 0.58), X - 0.15, 0.50, Z);
    const foam = at(flat(new THREE.CylinderGeometry(0.40, 0.40, 1, 24).translate(0, 0.5, 0), '#ffffff', { opacity: 0.85 }), X - 0.15, 2.1, Z);
    const bub = bubbler(28, { x: X - 0.15, z: Z, rad: 0.26, y0: 0.65, r: 0.052, speed: 1.5 });
    const therm = at(jar(0.09, 2.8, C.red, { fill: 0.4, glow: 0.2 }), X + 0.95, 0.25, Z - 0.4);

    // 导气管 + O2 气泡气压计 (U 形管液柱差 + 表盘)
    const connTube = tube([[X - 0.15, 3.25, Z], [X + 0.3, 3.55, Z], [X + 1.35, 3.25, Z + 0.3], [X + 1.55, 2.35, Z + 0.35]], 0.045, '#d9dfe4');
    const manoMeter = at(meter('P(O₂)', { w: 1.45, h: 1.05, text: '0 kPa' }), X + 1.75, 1.55, Z + 0.35);

    const g = at(plot({ w: 3.9, h: 2.9, xr: [0, 80], yr: [0, 1.1], xl: '温度 / °C', yl: '相对活性' }), 2.35, 0, -2.35);
    const info = at(card('\n', { w: 3.8, size: 0.29, align: 'left' }), 2.4, 0, 2.35);
    k.root.add(bath, water, tubeG, sol, foam, bub, therm, connTube, manoMeter, g, info);

    let den = 0, lastKey = '';
    const act = () => {
      if (p.cat === 0) {
        const effDen = p.irrev ? den : 0;
        return fTempEnzyme(p.T) * fPHEnzyme(p.pH) * (1 - effDen);
      }
      if (p.cat === 1) return Math.min(0.45, 0.055 * Math.pow(2, (p.T - 25) / 10));
      return 0.004 * Math.pow(2, (p.T - 25) / 10);
    };

    return {
      snapshot: () => ({ a: act(), den: p.irrev ? den : 0, T: p.T, pH: p.pH, cat: p.cat }),
      press(id) {
        if (id === 'bCold') k.set('T', 0);
        else if (id === 'bOpt') k.set('T', 37);
        else if (id === 'bBoil') k.set('T', 80);
        else if (id === 'bFresh' || id === 'new') { den = 0; lastKey = ''; }
        k.dirty();
      },
      change(id) {
        if (id === 'irrev' && !p.irrev) { den = 0; lastKey = ''; }
        k.dirty();
      },
      update(dt) {
        if (p.cat === 0 && p.irrev) {
          const dTarget = clamp((p.T - 52) / 20, 0, 1);
          if (dTarget > den) den = Math.min(1, den + (dTarget - den) * (1 - Math.exp(-dt * 1.1)));
        }
        const effDen = p.irrev ? den : 0;
        const a = act();
        bub.step(dt, a * 18, 2.1);
        foam.scale.y = lerp(foam.scale.y, 0.02 + a * 0.9, 0.08);
        therm.fill(p.T / 100);
        water.set(1.35, p.T > 50 ? '#ffd8c4' : p.T < 12 ? '#d4efff' : '#cfe6ff');
        manoMeter.set(clamp(a * 0.92, 0, 1), `${(a * 12.4).toFixed(1)} kPa`);

        const key = `${p.pH.toFixed(1)}|${p.cat}|${effDen.toFixed(2)}|${p.T}|${p.irrev}`;
        if (key !== lastKey) {
          lastKey = key;
          g.clear().fn((T) => fTempEnzyme(T) * fPHEnzyme(p.pH), 'rgba(30,43,54,0.3)', 0.03, true);
          if (p.cat === 0) g.fn((T) => fTempEnzyme(T) * fPHEnzyme(p.pH) * (1 - effDen), C.leaf, 0.045);
          else g.fn((T) => (p.cat === 1 ? Math.min(0.45, 0.055 * Math.pow(2, (T - 25) / 10)) : 0.004 * Math.pow(2, (T - 25) / 10)), C.flame, 0.045);
          g.dot(p.T, a, C.amber, 0.09).done();
        }
        const statusStr = p.cat === 0
          ? (effDen > 0.05 ? `不可逆变性 ${(effDen * 100).toFixed(0)}%` : p.T < 12 ? '低温抑制(可逆)' : '活性催化中')
          : p.cat === 1 ? 'FeCl₃ 无机催化' : '空白对照';
        info.set(`O₂ 气泡 ≈ ${(a * 120).toFixed(0)} 个/分\n${statusStr} · pH ${p.pH.toFixed(1)}`);
        this._a = a;
      },
      margin() {
        const effDen = p.irrev ? den : 0;
        return [
          `T = ${p.T}°C · pH = ${p.pH.toFixed(1)}`,
          `相对活性 ${(this._a || 0).toFixed(2)}`,
          p.cat === 0 ? (effDen > 0.05 ? '⚠ 空间结构破坏，降温不恢复' : p.T < 12 ? '低温抑制：回 37°C 即恢复' : '最适 37°C · pH 7.0') : '无机催化剂无变性',
          '灰虚线：未变性鲜酶基准',
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 酶活性响应曲线（左：温度效应与不可逆变性 · 右：pH 效应）');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn" data-act="cold">0°C 冰浴</button>
      <button type="button" class="wb-btn" data-act="opt">37°C 最适回温</button>
      <button type="button" class="wb-btn" data-act="boil">80°C 高温变性</button>
      <button type="button" class="wb-btn" data-act="fresh">换一支新酶</button>
      <button type="button" class="wb-btn primary" data-act="rec">记录当前活性</button>`;
    sec1.append(bar);

    const chart = wb.canvas(sec1, 520, 250, (x, W, H) => {
      const p = sp.params;
      const snap = sp.inst?.snapshot?.() || { a: 1, den: 0, T: 37, pH: 7, cat: 0 };
      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);

      // 左半图：温度 0..80 °C
      const drawPanel = (ox, pw, xr, labelX, curX, fnFresh, fnNow, extraNote) => {
        const padT = 26, padB = 38, ph = H - padT - padB;
        const sx = (v) => ox + ((v - xr[0]) / (xr[1] - xr[0])) * pw;
        const sy = (v) => padT + ph - clamp(v, 0, 1.08) / 1.08 * ph;
        x.strokeStyle = '#1e2b36'; x.lineWidth = 1.3;
        x.beginPath(); x.moveTo(ox, padT); x.lineTo(ox, padT + ph); x.lineTo(ox + pw, padT + ph); x.stroke();
        // 理论鲜酶曲线（虚线）
        x.save(); x.strokeStyle = 'rgba(30,43,54,0.35)'; x.setLineDash([5, 4]); x.lineWidth = 1.6; x.beginPath();
        for (let i = 0; i <= 80; i++) {
          const xv = xr[0] + ((xr[1] - xr[0]) * i) / 80, yv = fnFresh(xv);
          if (i === 0) x.moveTo(sx(xv), sy(yv)); else x.lineTo(sx(xv), sy(yv));
        }
        x.stroke(); x.restore();
        // 当前状态曲线
        x.strokeStyle = p.cat === 0 ? '#2fb46a' : '#ff6a3d'; x.lineWidth = 2.3; x.beginPath();
        for (let i = 0; i <= 80; i++) {
          const xv = xr[0] + ((xr[1] - xr[0]) * i) / 80, yv = fnNow(xv);
          if (i === 0) x.moveTo(sx(xv), sy(yv)); else x.lineTo(sx(xv), sy(yv));
        }
        x.stroke();
        // 当前点
        x.fillStyle = '#ffb52e'; x.strokeStyle = '#1e2b36'; x.lineWidth = 1.5;
        x.beginPath(); x.arc(sx(curX), sy(fnNow(curX)), 5.5, 0, TAU); x.fill(); x.stroke();
        x.fillStyle = '#51606b'; x.font = '11px Georgia,serif'; x.textAlign = 'center';
        x.fillText(String(xr[0]), ox, H - 18);
        x.fillText(String((xr[0] + xr[1]) / 2), ox + pw / 2, H - 18);
        x.fillText(String(xr[1]), ox + pw, H - 18);
        x.fillText(labelX, ox + pw / 2, H - 4);
        x.fillStyle = '#1f4a3e'; x.textAlign = 'left'; x.font = '11px "Noto Serif SC",serif';
        x.fillText(extraNote, ox + 6, padT + 12);
      };

      drawPanel(
        40, 200, [0, 80], '温度 T (°C)', p.T,
        (T) => fTempEnzyme(T) * fPHEnzyme(p.pH),
        (T) => (p.cat === 0 ? fTempEnzyme(T) * fPHEnzyme(p.pH) * (1 - snap.den) : p.cat === 1 ? Math.min(0.45, 0.055 * Math.pow(2, (T - 25) / 10)) : 0.004 * Math.pow(2, (T - 25) / 10)),
        p.cat === 0 ? (snap.den > 0.05 ? `变性 ${(snap.den * 100).toFixed(0)}%` : '最适 37°C') : '无机/对照',
      );
      drawPanel(
        295, 200, [2, 12], '酸碱度 pH', p.pH,
        (ph) => fTempEnzyme(p.T) * fPHEnzyme(ph),
        (ph) => (p.cat === 0 ? fTempEnzyme(p.T) * fPHEnzyme(ph) * (1 - snap.den) : snap.a),
        '最适 pH 7.0',
      );
    });

    const statsEl = document.createElement('div');
    statsEl.className = 'wb-metrics';
    sec1.append(statsEl);

    let lastKey = '';
    const refresh = (force = false) => {
      const snap = sp.inst?.snapshot?.();
      if (!snap) return;
      const kStr = `${snap.T}|${snap.pH.toFixed(1)}|${snap.cat}|${snap.den.toFixed(2)}|${sp.params.irrev}`;
      if (!force && kStr === lastKey) return;
      lastKey = kStr;
      chart.redraw();
      statsEl.innerHTML = `
        <div class="wb-m"><span>O₂ 冒泡速率</span><b>${(snap.a * 120).toFixed(0)} 个/分</b></div>
        <div class="wb-m"><span>压力计读数</span><b>${(snap.a * 12.4).toFixed(1)} kPa</b></div>
        <div class="wb-m"><span>已变性失活比例</span><b>${(snap.den * 100).toFixed(0)}%</b></div>
        <div class="wb-m"><span>教学提示</span><b>温度探究宜改用淀粉酶防 H₂O₂ 热分解</b></div>`;
    };

    bar.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (!act) return;
      if (act === 'cold') wb.press('bCold');
      else if (act === 'opt') wb.press('bOpt');
      else if (act === 'boil') wb.press('bBoil');
      else if (act === 'fresh') wb.press('bFresh');
      else if (act === 'rec') {
        const row = enzyme.record.sample(sp.inst, sp.params);
        if (row) wb.record(row);
      }
      refresh(true);
    });

    refresh(true);
    return { update() { refresh(false); } };
  },
};

// ============================================================================
// 4. 绿叶中色素的提取和分离（纸层析法） (L3)
// ============================================================================
const PIGMENTS = [
  { key: 'carotene', name: '胡萝卜素', color: '#f28c28', rf: 0.95, bandW: 0.30, desc: '橙黄色 · 含量最少 · 溶解度最大' },
  { key: 'xanthophyll', name: '叶黄素', color: '#f0c929', rf: 0.72, bandW: 0.42, desc: '黄色 · 仅次于胡萝卜素' },
  { key: 'chla', name: '叶绿素a', color: '#1d8f6e', rf: 0.50, bandW: 0.65, desc: '蓝绿色 · 含量最多、条带最宽' },
  { key: 'chlb', name: '叶绿素b', color: '#6eb43f', rf: 0.34, bandW: 0.48, desc: '黄绿色 · 溶解度最小、扩散最慢' },
];

// 400–700nm 菠菜光合色素吸收光谱（高斯双峰/三峰近似）
function pigmentAbs(nm) {
  const g = (c, s, h) => h * Math.exp(-0.5 * ((nm - c) / s) ** 2);
  const chla = g(430, 17, 0.92) + g(410, 12, 0.42) + g(662, 14, 0.85) + g(615, 16, 0.18);
  const chlb = g(453, 18, 0.95) + g(430, 14, 0.30) + g(642, 15, 0.60) + g(595, 14, 0.14);
  const car = g(446, 20, 0.78) + g(475, 18, 0.72) + g(420, 15, 0.45);
  return { chla: clamp(chla, 0, 1), chlb: clamp(chlb, 0, 1), car: clamp(car, 0, 1) };
}

export const pigments = {
  id: 'bio-pigments',
  subject: 'bio',
  title: '绿叶中色素的提取和分离（纸层析法）',
  en: 'Extraction & paper chromatography of leaf pigments',
  lede: [
    '用无水乙醇提取菠菜叶片中的光合色素（加 SiO₂ 助磨、CaCO₃ 保护叶绿素），在干燥定性滤纸上画出“细、直、齐”的滤液细线。',
    '将滤纸条悬入层析液中，利用各色素在层析液中溶解度不同导致的扩散速率差异，分离出由上而下的四条色素带，并实测比移值 R_f 与吸收光谱。',
  ],
  formula: 'R_f = d_色素 / d_溶剂前沿 · h_前沿(t) ∝ √t',
  formulaNote: '层析液扩散越快的色素溶解度越大（胡萝卜素 > 叶黄素 > 叶绿素a > 叶绿素b）；滤液细线切勿触及层析液',
  terms: [
    ['提取 vs 分离', '无水乙醇用于溶解提取色素；层析液（石油醚/丙酮等）用于纸层析分离色素。'],
    ['CaCO₃ 与 SiO₂', 'CaCO₃ 中和细胞有机酸防止叶绿素被破坏；SiO₂ 增大摩擦使研磨充分。'],
    ['比移值 R_f', '色素带中心迁移距离 d_色素 与溶剂前沿距离 d_溶剂 之比，为特征常数（0 < R_f < 1）。'],
  ],
  predict: {
    q: '如果画滤液细线后不慎将滤液细线浸没在层析液液面以下，层析结果会怎样？',
    options: [
      '色素分离得更快更清晰',
      '色素直接溶解到层析液中，滤纸条上得不到四条清晰色素带',
      '只有胡萝卜素能分离出来',
    ],
    answer: 1,
    why: '层析分离要求层析液自下而上通过毛细作用经过滤液细线，把色素带上去；若细线浸入层析液，色素会直接扩散溶解到瓶底溶剂中，实验失败。',
  },
  challenge: '启动层析分离后，用标尺逐一测量 4 条色素带与溶剂前沿距离算出 R_f 并录入记录簿；再切换“漏加 CaCO₃”对比叶绿素带的变化！',
  fig: '研钵研磨提取、层析筒滤纸条迁移与可移动标尺',
  hint: '拖动“游标尺位置”到任意色素带或溶剂前沿读数；可切换研磨条件与“滤液细线浸没”错误对照；进入工作台测量 R_f 并查看 400–700nm 吸收光谱！',
  teach: {
    where: '人教版生物学必修1第5章 §5.4《光合作用与能量转化 · 实验：绿叶中色素的提取和分离》（海南高中生物必做）',
    ask: [
      '滤纸条为什么要剪去下端两角？画滤液细线为什么要重复画一两次并待干后再画？',
      '结合 400–700 nm 吸收光谱，解释为什么植物叶片呈现绿色以及温室大棚为何少用纯绿光照明。',
    ],
    simplify: '毛细爬升采用 Washburn 平方根近似 h(t) = H_max·√(t/T_end)；R_f 为理想均相稳态比移参考值。',
    safety: '层析液（石油醚、丙酮、苯等）易燃、易挥发且具一定毒性，真实实验须在通风处操作并盖紧层析筒盖，远离明火。',
  },
  controls: [
    { id: 'grind', label: '研磨提取配方', type: 'choice', options: ['规范(乙醇+SiO₂+CaCO₃)', '漏加 CaCO₃', '漏加 SiO₂'], value: 0, wide: true },
    { id: 'lineMode', label: '滤液细线位置', type: 'choice', options: ['规范(高于层析液)', '错误(浸没入层析液)'], value: 0, wide: true },
    { id: 'ruler', label: '标尺游标读数 d', min: 0, max: 10.5, step: 0.05, value: 5.0, unit: 'cm' },
    { id: 'running', label: '层析迁移', type: 'toggle', options: ['暂停', '进行中'], value: true },
    { id: 'bRestart', label: '重新点样层析', type: 'button' },
    { id: 'bFinish', label: '迁移至 10.0 cm', type: 'button' },
  ],
  record: {
    note: '用标尺依次读取溶剂前沿 d_溶剂 及各色素带中心 d_色素，计算 R_f = d_色素 / d_溶剂 并归档。',
    pending: '完成层析迁移并在工作台或标尺选定色素带后点击“记录一组”。',
    columns: [
      { key: 'pigment', label: '测量目标' },
      { key: 'dPig', label: '色素距离 d', unit: 'cm', digits: 2 },
      { key: 'dSolv', label: '前沿 d_溶剂', unit: 'cm', digits: 2 },
      { key: 'rf', label: '实测 R_f', digits: 3, stat: true },
      { key: 'note', label: '条件备注' },
    ],
    sample: (inst, p) => {
      const s = inst?.snapshot?.();
      if (!s || s.dSolvent < 0.5) return null;
      const dPig = p.ruler ?? 0;
      // 匹配最近的色素带
      let bestName = '自定义读数', bd = 99;
      for (const pg of PIGMENTS) {
        const dp = pg.rf * s.dSolvent;
        if (Math.abs(dPig - dp) < bd) { bd = Math.abs(dPig - dp); bestName = bd < 0.45 ? pg.name : '游标位置'; }
      }
      return {
        _kind: 'human',
        pigment: bestName,
        dPig,
        dSolv: s.dSolvent,
        rf: dPig / s.dSolvent,
        note: p.lineMode === 1 ? '细线浸没(失败)' : p.grind === 1 ? '漏加CaCO₃' : p.grind === 2 ? '漏加SiO₂' : '规范',
      };
    },
    summary: (rows) => [
      ['已录入标尺测点', `${rows.length} 条`],
      ['最近测定 R_f', rows.length ? rows[rows.length - 1].rf.toFixed(3) : '—'],
    ],
    errors: [
      '把从滤纸条最底端起算的距离当作 d_色素：必须从“滤液细线（原点）”量起。',
      '忽略层析液挥发与细线浸没：细线一旦浸入层析液，色素溶于槽底而无法展开。',
    ],
  },

  build(k) {
    const p = k.p;
    // 左侧研钵与绿叶提取液
    const mortar = at(group(
      lathe([[0, 0], [0.55, 0], [0.85, 0.55], [0.92, 0.85], [0.80, 0.85], [0.68, 0.45], [0, 0.15]], '#f1ece0', { kind: 'ceramic' }),
      at(liquid(0.62, 0.34, '#2b7a4b', 0.82), 0, 0.16, 0),
      at(rot(cyl(0.11, 1.35, '#e8e2d3', { seg: 14, kind: 'ceramic' }), 0.35, 0, -0.45), 0.15, 0.28, 0),
    ), -2.55, 0.02, -0.5);
    const mortarLbl = at(note('研钵提取(乙醇+SiO₂+CaCO₃)', { size: 0.22, w: 2.6 }), -2.55, 0.03, 1.0);

    // 中央层析圆筒与滤纸条
    const cylJar = at(beaker(1.0, 3.8), -0.4, 0.05, -0.6);
    const stopper = at(cyl(1.04, 0.18, '#d9c39a', { seg: 32, kind: 'wood' }), -0.4, 3.85, -0.6);
    const solvent = at(liquid(0.94, 0.55, '#eef5d8', 0.55), -0.4, 0.08, -0.6);
    const stripSheet = sheet(1.15, 3.4, () => {}, { opaque: true, ink: true });
    stripSheet.position.set(-0.4, 1.95, -0.6);
    const rulerDim = dimension({ size: 0.24, w: 1.6, color: C.copper });
    const info = at(card('\n', { w: 3.7, size: 0.29, align: 'left' }), 2.35, 0, 2.2);
    const specPlot = at(plot({ w: 3.8, h: 2.7, xr: [400, 700], yr: [0, 1.05], xl: '波长 / nm', yl: '吸收率' }), 2.35, 0, -2.35);

    k.root.add(mortar, mortarLbl, cylJar, stopper, solvent, stripSheet, rulerDim, info, specPlot);

    // 预画 400–700nm 光谱小图
    specPlot.clear()
      .fn((nm) => pigmentAbs(nm).chla, '#1d8f6e', 0.045)
      .fn((nm) => pigmentAbs(nm).chlb, '#6eb43f', 0.04)
      .fn((nm) => pigmentAbs(nm).car, '#f28c28', 0.04, true)
      .text(435, 0.98, '叶绿素a/b', '#1d8f6e', 0.18)
      .text(495, 0.72, '类胡萝卜素', '#f28c28', 0.18)
      .done();

    let simT = 0, lastKey = '';
    const D_MAX = 10.0, T_END = 14.0;
    const dSolventOf = () => D_MAX * Math.sqrt(clamp(simT / T_END, 0, 1));

    const drawStrip = (dSolv) => {
      const submerged = p.lineMode === 1;
      const noCa = p.grind === 1, noSi = p.grind === 2;
      const concScale = noSi ? 0.38 : 1.0;
      const originFrac = submerged ? 0.10 : 0.18; // 原点位置（自底向上）
      const topFrac = 0.92;
      const cmToY = (cm, H) => H * (1 - (originFrac + (cm / D_MAX) * (topFrac - originFrac)));

      stripSheet.redraw((x, S, w, h) => {
        const W = w * S, H = h * S;
        x.fillStyle = '#fcf9f1'; x.fillRect(0, 0, W, H);
        // 湿润层析液背景
        const frontY = cmToY(dSolv, H);
        x.fillStyle = 'rgba(232, 240, 214, 0.45)';
        x.fillRect(0, frontY, W, H - frontY);

        // 原点细线
        const origY = cmToY(0, H);
        x.strokeStyle = submerged ? 'rgba(229,72,63,0.7)' : 'rgba(30,43,54,0.65)';
        x.lineWidth = S * 0.018;
        x.beginPath(); x.moveTo(W * 0.1, origY); x.lineTo(W * 0.9, origY); x.stroke();

        // 四条色素带
        if (!submerged && dSolv > 0.2) {
          for (const pg of PIGMENTS) {
            const dBand = pg.rf * dSolv;
            const by = cmToY(dBand, H);
            const bwPx = (pg.bandW / D_MAX) * H * (topFrac - originFrac) * 0.55;
            const isChl = pg.key === 'chla' || pg.key === 'chlb';
            x.fillStyle = (isChl && noCa) ? '#8a7e45' : pg.color;
            x.globalAlpha = clamp((isChl && noCa ? 0.35 : 0.85) * concScale, 0.15, 0.95);
            x.fillRect(W * 0.12, by - bwPx / 2, W * 0.76, bwPx);
          }
          x.globalAlpha = 1;
        } else if (submerged) {
          x.fillStyle = 'rgba(130, 165, 110, 0.25)';
          x.fillRect(W * 0.1, H * 0.75, W * 0.8, H * 0.25);
        }

        // 溶剂前沿虚线
        x.strokeStyle = '#3a9cff'; x.setLineDash([S * 0.06, S * 0.04]); x.lineWidth = S * 0.02;
        x.beginPath(); x.moveTo(W * 0.06, frontY); x.lineTo(W * 0.94, frontY); x.stroke();
        x.setLineDash([]);

        // 游标标尺线
        const rCm = clamp(p.ruler ?? 0, 0, 10.5);
        const ry = cmToY(rCm, H);
        x.strokeStyle = '#b4653a'; x.lineWidth = S * 0.025;
        x.beginPath(); x.moveTo(0, ry); x.lineTo(W, ry); x.stroke();
      });

      // 更新 3D 尺寸标尺
      const yOrigWorld = 1.95 - 1.7 + 3.4 * (submerged ? 0.10 : 0.18);
      const yCurWorld = yOrigWorld + (clamp(p.ruler ?? 0, 0, 10.5) / D_MAX) * 3.4 * (0.92 - (submerged ? 0.10 : 0.18));
      rulerDim.set([-0.4 + 0.72, yOrigWorld, -0.6], [-0.4 + 0.72, Math.max(yOrigWorld + 0.05, yCurWorld), -0.6], `d=${(p.ruler ?? 0).toFixed(2)}cm`, [1, 0, 0]);
    };

    return {
      snapshot: () => ({ dSolvent: dSolventOf(), simT, D_MAX, T_END }),
      setTime(tSec) { simT = clamp(tSec, 0, T_END); lastKey = ''; k.dirty(); },
      press(id) {
        if (id === 'bRestart') { simT = 0; k.set('running', true); lastKey = ''; }
        else if (id === 'bFinish') { simT = T_END; k.set('running', false); lastKey = ''; }
        k.dirty();
      },
      change() { lastKey = ''; k.dirty(); },
      update(dt) {
        if (p.running && simT < T_END) simT = Math.min(T_END, simT + dt);
        const dSolv = dSolventOf();
        solvent.set(0.55, p.lineMode === 1 && simT > 0.3 ? '#3b7d4c' : '#eef5d8');
        const pk = `${dSolv.toFixed(2)}|${p.grind}|${p.lineMode}|${(p.ruler ?? 0).toFixed(2)}`;
        if (pk !== lastKey) {
          lastKey = pk;
          drawStrip(dSolv);
        }
        const rfRead = dSolv > 0.1 ? (p.ruler ?? 0) / dSolv : 0;
        info.set(
          p.lineMode === 1
            ? '⚠ 滤液细线浸没层析液\n色素直接溶解，分离失败！'
            : `溶剂前沿 d_溶剂 = ${dSolv.toFixed(2)} cm\n游标 d = ${(p.ruler ?? 0).toFixed(2)} cm · R_f = ${rfRead.toFixed(3)}`,
        );
      },
      margin() {
        const dS = dSolventOf();
        return [
          `溶剂前沿 ${dS.toFixed(2)} cm`,
          `游标读数 ${(p.ruler ?? 0).toFixed(2)} cm`,
          dS > 0.1 ? `比移值 R_f = ${((p.ruler ?? 0) / dS).toFixed(3)}` : '层析刚起步',
          p.lineMode === 1 ? '⚠ 细线低于液面' : '胡>叶黄>叶绿a>叶绿b',
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 纸层析条带与交互式标尺测量 R_f = d_色素 / d_溶剂前沿');
    const bar1 = document.createElement('div');
    bar1.className = 'wb-btn-row';
    bar1.innerHTML = `
      <button type="button" class="wb-btn" data-act="finish">展开至 10.0 cm</button>
      <button type="button" class="wb-btn" data-act="restart">重新点样层析</button>
      <button type="button" class="wb-btn" data-snap="0.95">对准胡萝卜素</button>
      <button type="button" class="wb-btn" data-snap="0.72">对准叶黄素</button>
      <button type="button" class="wb-btn" data-snap="0.50">对准叶绿素a</button>
      <button type="button" class="wb-btn" data-snap="0.34">对准叶绿素b</button>
      <button type="button" class="wb-btn primary" data-act="rec">记入 R_f 记录</button>`;
    sec1.append(bar1);

    const stripCv = wb.canvas(sec1, 520, 210, (x, W, H) => {
      const p = sp.params;
      const snap = sp.inst?.snapshot?.() || { dSolvent: 0, D_MAX: 10 };
      const dSolv = snap.dSolvent;
      const pad = { l: 55, r: 30, t: 32, b: 36 };
      const pw = W - pad.l - pad.r;
      const sx = (cm) => pad.l + (cm / 10.5) * pw;

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      // 水平滤纸条本体
      const py = 54, ph = 82;
      x.fillStyle = '#fcf9f1'; x.strokeStyle = '#1e2b36'; x.lineWidth = 1.4;
      x.fillRect(pad.l - 28, py, pw + 38, ph); x.strokeRect(pad.l - 28, py, pw + 38, ph);
      // 湿润区
      x.fillStyle = 'rgba(232, 240, 214, 0.45)';
      x.fillRect(pad.l - 28, py, sx(dSolv) - (pad.l - 28), ph);

      // 原点细线 d=0
      x.strokeStyle = p.lineMode === 1 ? '#e5483f' : '#1e2b36'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(sx(0), py + 4); x.lineTo(sx(0), py + ph - 4); x.stroke();
      x.fillStyle = '#51606b'; x.font = '10px "Noto Serif SC",serif'; x.textAlign = 'center';
      x.fillText('原点 0', sx(0), py - 8);

      const noCa = p.grind === 1, noSi = p.grind === 2;
      if (p.lineMode !== 1 && dSolv > 0.15) {
        for (const pg of PIGMENTS) {
          const cx = sx(pg.rf * dSolv);
          const bw = pg.bandW * 24;
          const isChl = pg.key === 'chla' || pg.key === 'chlb';
          x.fillStyle = (isChl && noCa) ? '#8a7e45' : pg.color;
          x.globalAlpha = noSi ? 0.35 : (isChl && noCa ? 0.42 : 0.88);
          x.fillRect(cx - bw / 2, py + 8, bw, ph - 16);
          x.globalAlpha = 1;
          x.fillStyle = '#1e2b36'; x.font = '11px "Noto Serif SC",serif';
          x.fillText(pg.name, cx, py + ph + 16);
        }
      } else if (p.lineMode === 1) {
        x.fillStyle = '#b43b32'; x.font = '13px "Noto Serif SC",serif'; x.textAlign = 'center';
        x.fillText('⚠ 滤液细线浸没在层析液中，色素已溶入溶剂槽', W / 2, py + ph / 2 + 4);
      }

      // 溶剂前沿
      x.strokeStyle = '#3a9cff'; x.lineWidth = 2; x.setLineDash([5, 3]);
      x.beginPath(); x.moveTo(sx(dSolv), py - 6); x.lineTo(sx(dSolv), py + ph + 4); x.stroke();
      x.setLineDash([]);
      x.fillStyle = '#3a9cff'; x.font = '10px Georgia,serif';
      x.fillText(`前沿 ${dSolv.toFixed(2)}cm`, sx(dSolv), py - 14);

      // 标尺刻度与可拖拽游标
      x.strokeStyle = '#1e2b36'; x.lineWidth = 1;
      for (let cm = 0; cm <= 10.5; cm += 0.5) {
        const rx = sx(cm), isMaj = Math.abs(cm - Math.round(cm)) < 0.01;
        x.beginPath(); x.moveTo(rx, H - 26); x.lineTo(rx, H - (isMaj ? 14 : 20)); x.stroke();
        if (isMaj) {
          x.fillStyle = '#51606b'; x.font = '10px Georgia,serif'; x.textAlign = 'center';
          x.fillText(`${cm}`, rx, H - 3);
        }
      }
      // 铜色游标线
      const rCm = clamp(p.ruler ?? 0, 0, 10.5);
      const rx = sx(rCm);
      x.strokeStyle = '#b4653a'; x.lineWidth = 2.2;
      x.beginPath(); x.moveTo(rx, 24); x.lineTo(rx, H - 14); x.stroke();
      x.fillStyle = '#b4653a';
      x.beginPath(); x.moveTo(rx - 6, 20); x.lineTo(rx + 6, 20); x.lineTo(rx, 30); x.closePath(); x.fill();
      x.font = 'bold 11px Georgia,serif'; x.textAlign = 'left';
      x.fillText(`d=${rCm.toFixed(2)}cm (Rf=${dSolv > 0.1 ? (rCm / dSolv).toFixed(3) : '—'})`, Math.min(rx + 8, W - 160), 22);
    });

    // 拖动交互式标尺
    let dragging = false;
    const moveRuler = (e) => {
      const pt = stripCv.toLocal(e);
      const pw = 520 - 55 - 30;
      const cm = clamp(((pt.x - 55) / pw) * 10.5, 0, 10.5);
      wb.setParam('ruler', Math.round(cm * 20) / 20);
      refresh(true);
    };
    stripCv.cv.addEventListener('pointerdown', (e) => { dragging = true; moveRuler(e); });
    stripCv.cv.addEventListener('pointermove', (e) => { if (dragging) moveRuler(e); });
    const up = () => { dragging = false; };
    window.addEventListener('pointerup', up);
    wb.onCleanup(() => window.removeEventListener('pointerup', up));

    const sec2 = wb.section('2 · 400–700 nm 叶绿素与类胡萝卜素吸收光谱叠加（点击光谱查看光色波长）');
    let probeNm = 662;
    const specCv = wb.canvas(sec2, 520, 220, (x, W, H) => {
      const pad = { l: 48, r: 22, t: 22, b: 36 };
      const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      const sx = (nm) => pad.l + ((nm - 400) / 300) * pw;
      const sy = (a) => pad.t + ph - clamp(a, 0, 1.05) / 1.05 * ph;

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      // 底部可见光谱彩带
      for (let i = 0; i < 60; i++) {
        const nm = 400 + i * 5;
        x.fillStyle = '#' + wavelength(nm).getHexString();
        x.globalAlpha = 0.28;
        x.fillRect(sx(nm), pad.t + ph - 8, pw / 60 + 1, 8);
      }
      x.globalAlpha = 1;

      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.3;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();
      x.fillStyle = '#51606b'; x.font = '11px Georgia,serif'; x.textAlign = 'center';
      for (let nm = 400; nm <= 700; nm += 50) x.fillText(`${nm}nm`, sx(nm), H - 16);
      x.fillText('入射光波长 λ (nm)', pad.l + pw / 2, H - 3);
      x.textAlign = 'right';
      for (const a of [0, 0.5, 1.0]) x.fillText(a.toFixed(1), pad.l - 6, sy(a) + 4);

      const drawCurve = (fn, col, dashArr = []) => {
        x.save(); x.strokeStyle = col; x.lineWidth = 2.1; x.setLineDash(dashArr); x.beginPath();
        for (let i = 0; i <= 150; i++) {
          const nm = 400 + i * 2, val = fn(nm);
          if (i === 0) x.moveTo(sx(nm), sy(val)); else x.lineTo(sx(nm), sy(val));
        }
        x.stroke(); x.restore();
      };
      drawCurve((nm) => pigmentAbs(nm).chla, '#1d8f6e');
      drawCurve((nm) => pigmentAbs(nm).chlb, '#6eb43f');
      drawCurve((nm) => pigmentAbs(nm).car, '#f28c28', [5, 4]);

      // 绿光低吸收窗提示
      x.fillStyle = 'rgba(30,43,54,0.55)'; x.font = '11px "Noto Serif SC",serif'; x.textAlign = 'center';
      x.fillText('绿光反射窗 (~550nm)', sx(550), pad.t + ph - 20);

      // 探针线
      const ab = pigmentAbs(probeNm);
      x.strokeStyle = '#1e2b36'; x.setLineDash([3, 3]);
      x.beginPath(); x.moveTo(sx(probeNm), pad.t); x.lineTo(sx(probeNm), pad.t + ph); x.stroke(); x.setLineDash([]);
      x.fillStyle = '#1e2b36'; x.textAlign = 'left'; x.font = '11px Georgia,serif';
      x.fillText(`λ=${probeNm}nm · Chla=${(ab.chla * 100).toFixed(0)}% · Chlb=${(ab.chlb * 100).toFixed(0)}% · 类胡=${(ab.car * 100).toFixed(0)}%`, pad.l + 8, pad.t + 14);
    });

    specCv.cv.addEventListener('pointerdown', (e) => {
      const pt = specCv.toLocal(e);
      probeNm = Math.round(clamp(400 + ((pt.x - 48) / (520 - 70)) * 300, 400, 700));
      specCv.redraw();
    });

    const statsEl = document.createElement('div');
    statsEl.className = 'wb-metrics';
    sec2.append(statsEl);

    let lastKey = '';
    const refresh = (force = false) => {
      const p = sp.params;
      const snap = sp.inst?.snapshot?.() || { dSolvent: 0 };
      const kStr = `${snap.dSolvent.toFixed(2)}|${p.grind}|${p.lineMode}|${(p.ruler ?? 0).toFixed(2)}`;
      if (!force && kStr === lastKey) return;
      lastKey = kStr;
      stripCv.redraw();
      specCv.redraw();
      const dS = snap.dSolvent;
      statsEl.innerHTML = PIGMENTS.map((pg) => {
        const dP = pg.rf * dS;
        return `<div class="wb-m"><span>${pg.name} (理论 R_f ${pg.rf.toFixed(2)})</span><b>d ≈ ${dP.toFixed(2)} cm</b></div>`;
      }).join('');
    };

    bar1.addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      const snap = sp.inst?.snapshot?.() || { dSolvent: 0 };
      if (btn.dataset.act === 'finish') wb.press('bFinish');
      else if (btn.dataset.act === 'restart') wb.press('bRestart');
      else if (btn.dataset.snap !== undefined) {
        const dTarget = Math.round(snap.dSolvent * (+btn.dataset.snap) * 20) / 20;
        wb.setParam('ruler', clamp(dTarget, 0, 10.5));
      } else if (btn.dataset.act === 'rec') {
        const row = pigments.record.sample(sp.inst, sp.params);
        if (row) wb.record(row);
      }
      refresh(true);
    });

    refresh(true);
    return { update() { refresh(false); } };
  },
};

// ============================================================================
// 5. 探究环境因素对光合作用强度的影响 (L3)
// ============================================================================
function photoActionFactor(lightMode, nm) {
  if (lightMode === 0) return 1.0; // 全光谱白光
  // 红光 (645-670nm) 与蓝紫光 (430-465nm) 量子效率高，绿光 (520-570nm) 吸收极低
  const blue = 0.92 * Math.exp(-0.5 * ((nm - 448) / 26) ** 2);
  const red = 0.98 * Math.exp(-0.5 * ((nm - 660) / 24) ** 2);
  const base = 0.16;
  return clamp(base + blue + red, 0.16, 1.0);
}

function solvePhotosynthesis(I, co2, T, lightMode, nm) {
  const alpha = photoActionFactor(lightMode, nm);
  const fTempP = Math.exp(-0.5 * ((T - 29) / 11) ** 2) * (T > 40 ? clamp(1 - (T - 40) * 0.12, 0.2, 1) : 1);
  const pMax = (6.0 + 18.0 * (co2 / (co2 + 0.55))) * fTempP;
  const K_I = 4.2;
  const Ieff = I * alpha;
  const pGross = pMax * (Ieff / (Ieff + K_I));
  const resp = 2.6 * Math.pow(2, (T - 25) / 12) * (T > 42 ? clamp(1 - (T - 42) * 0.15, 0.3, 1) : 1);
  const pNet = pGross - resp;
  const lcp = pMax > resp ? (K_I * resp) / (alpha * (pMax - resp)) : Infinity;
  // 光饱和点定义：总光合达到 90% Pmax 时的有效光照强度
  const lsp = (9 * K_I) / alpha;
  return { alpha, pMax, K_I, pGross, resp, pNet, lcp, lsp };
}

export const photosynthesis = {
  id: 'bio-photosynthesis',
  subject: 'bio',
  title: '探究环境因素对光合作用强度的影响',
  en: 'Light intensity & CO2 on photosynthesis',
  lede: [
    '把一枝黑藻浸在 NaHCO₃ 溶液（提供稳定 CO₂）中，调节台灯亮度、环境温度与光源波长。光越强，黑藻叶片上冒出的 O₂ 气泡与氧气传感器读数越快。',
    '叶片同时进行细胞呼吸耗氧：微光下净光合为负；在光补偿点总光合恰好等于呼吸；超过光饱和点后，限制因素转为 CO₂ 浓度或酶活性（温度）。',
  ],
  formula: 'P_净(I) = P_总(I, C, T, λ) − R(T) · P_总 = P_max(C,T)·I_eff / (I_eff + K_I)',
  formulaNote: '净光合速率 = 总光合速率 − 呼吸速率；实测 O₂ 释放速率反映的是净光合速率',
  terms: [
    ['光补偿点', '总光合速率等于呼吸速率（P_净 = 0）时的光照强度，此时黑藻既不释放也不吸收 O₂。'],
    ['光饱和点', '光反应不再成为限制因素的临界光强；此后需提高 CO₂（NaHCO₃）或优化温度才能继续提速。'],
    ['光质（波长）', '叶绿素主要吸收红光（~660 nm）和蓝紫光（~450 nm），几乎不吸收绿光（~550 nm）。'],
  ],
  predict: {
    q: '在光饱和点以后继续大幅调强台灯照射强度，黑藻的氧气释放速率会怎样？',
    options: ['持续线性飙升，没有上限', '基本不再上升，需提高 NaHCO₃ 浓度（CO₂）才能进一步提高', '瞬间降为零'],
    answer: 1,
    why: '达到光饱和点后，光反应产生的 ATP 与 NADPH 已充足，限制暗反应速率的因子切换为 CO₂ 浓度（NaHCO₃）与酶催化速率（温度）。',
  },
  challenge: '调出黑藻刚好不冒泡的光补偿点；然后在 15 klx 饱和条件下把 NaHCO₃ 从 0.5% 提到 2.5%，再到工作台切换红光与绿光对比总光合速率！',
  fig: '可变光色照明台灯、黑藻放氧收集装置与溶解氧传感器',
  hint: '调节光照强度、NaHCO₃ 浓度、水温及光质波长；在工作台同时查看总光合曲线、呼吸基线、净光合曲线及光补偿/光饱和点定位！',
  teach: {
    where: '人教版生物学必修1第5章 §5.4《光合作用与能量转化 · 探究·实践：探究环境因素对光合作用强度的影响》',
    ask: [
      '黑暗条件（I = 0）下测得的 O₂ 变化代表什么生理过程？如何利用它把实测“净光合”换算为“真（总）光合”？',
      '为什么水温过高（>40°C）时净光合速率会骤降？（同时考虑酶失活与呼吸增强）',
    ],
    simplify: '采用直角双曲线响应模型耦合叶绿素作用光谱权重与温度酶活因子；未包含极强光下长期光抑制下降段。',
    safety: '实验台灯功率较高注意避免长时间近距离照射引发水浴过热；小心操作玻璃漏斗与收集管。',
  },
  controls: [
    { id: 'I', label: '光照强度 I', min: 0, max: 25, step: 0.5, value: 8.0, unit: 'klx' },
    { id: 'co2', label: 'NaHCO₃ (CO₂)', min: 0, max: 3.0, step: 0.1, value: 1.0, unit: '%' },
    { id: 'T', label: '水温 T', min: 5, max: 45, step: 1, value: 25, unit: '°C' },
    { id: 'lightMode', label: '光源光质', type: 'choice', options: ['全光谱白光', '单色光(按波长)'], value: 0, wide: true },
    { id: 'nm', label: '单色光波长 λ', min: 400, max: 700, step: 5, value: 660, unit: 'nm' },
  ],
  record: {
    note: '记录不同光强、CO₂ 浓度、温度与光质下的总光合、呼吸与净光合放氧速率。',
    pending: '调节环境条件后点击“记录一组”保存光合响应数据。',
    columns: [
      { key: 'lightMode', label: '光源' },
      { key: 'I', label: '光强', unit: 'klx', digits: 1 },
      { key: 'co2', label: 'NaHCO₃', unit: '%', digits: 1 },
      { key: 'T', label: '温度', unit: '°C', digits: 0 },
      { key: 'pGross', label: '总光合', digits: 1 },
      { key: 'pNet', label: '净光合速率', digits: 1, stat: true },
    ],
    sample: (inst, p) => {
      const s = inst?.snapshot?.();
      if (!s) return null;
      return {
        _kind: 'human',
        lightMode: p.lightMode === 0 ? '白光' : `${p.nm}nm`,
        I: p.I,
        co2: p.co2,
        T: p.T,
        pGross: s.pGross,
        pNet: s.pNet,
      };
    },
    summary: (rows) => [
      ['已录入测定工况', `${rows.length} 组`],
      ['最大净光合速率', rows.length ? `${Math.max(...rows.map((r) => r.pNet)).toFixed(1)}` : '—'],
    ],
    errors: [
      '混淆“净光合速率”与“总光合速率”：气泡与氧气传感器直接测得的是净释放量 P_净 = P_总 − R。',
      '忽略绿光低效性：叶绿素几乎不吸收 550 nm 绿光，相同 klx 下绿光放氧远低于红光/蓝光。',
    ],
  },

  build(k) {
    const p = k.p;
    const X = -0.85, Z = -0.6;
    const bk = at(beaker(1.45, 2.55), X, 0.05, Z);
    const water = at(liquid(1.37, 2.15, '#d6f0e4', 0.32), X, 0.09, Z);
    const plant = group();
    for (let i = 0; i < 4; i++) {
      const a = i * 1.65;
      const pts = [0, 1, 2, 3].map((j) => [X + Math.cos(a) * 0.28 * j * 0.6, 0.2 + j * 0.52, Z + Math.sin(a) * 0.28 * j * 0.6]);
      plant.add(tube(pts, 0.048, C.leaf));
      pts.forEach((q, j) => j && plant.add(rot(at(solid(new THREE.SphereGeometry(0.19, 12, 8).scale(1, 0.25, 0.45), C.leaf), q[0] + 0.14, q[1], q[2]), 0, a + j, 0.4)));
    }
    const funnel = at(group(
      glass(new THREE.CylinderGeometry(0.18, 0.96, 1.05, 32, 1, true).translate(0, 0.52, 0)),
      glass(new THREE.CylinderGeometry(0.22, 0.22, 2.2, 24, 1, true).translate(0, 2.15, 0)),
    ), X, 0.95, Z);
    const bub = bubbler(24, { x: X, z: Z, rad: 0.12, y0: 1.15, r: 0.048, speed: 1.3 });

    const lamp = at(group(
      cyl(0.55, 0.14),
      at(cyl(0.065, 2.9), 0, 0.14, 0),
      rot(at(solid(new THREE.ConeGeometry(0.66, 0.85, 28, 1, true), C.shade), 0.32, 3.0, 0), 0, 0, 1.15),
    ), -3.8, 0, Z);
    const beam = flat(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array([-3.2, 2.9, Z, X - 1.35, 2.7, Z, X - 1.35, 0.2, Z]), 3)), C.amber, { opacity: 0.22 });
    const bulb = at(glow(C.amber, 2.1, 0.65), -3.2, 2.9, Z);
    const o2Meter = at(meter('O₂', { w: 1.45, h: 1.05, center: true, text: '0.0' }), -3.0, 0.05, 1.9);

    const g = at(plot({ w: 3.9, h: 2.9, xr: [0, 25], yr: [-6, 24], xl: '光照强度 / klx', yl: '速率' }), 2.35, 0, -2.5);
    const info = at(card('\n', { w: 3.8, size: 0.29, align: 'left' }), 2.4, 0, 2.35);
    k.root.add(bk, water, plant, funnel, bub, lamp, beam, bulb, o2Meter, g, info);

    let last = '';
    const snapFn = () => solvePhotosynthesis(p.I, p.co2, p.T, p.lightMode, p.nm);

    return {
      snapshot: snapFn,
      change() { last = ''; k.dirty(); },
      update(dt) {
        const s = snapFn();
        bub.step(dt, Math.max(0, s.pNet) * 0.6, 4.2);
        const col = p.lightMode === 0 ? new THREE.Color(C.amber) : wavelength(p.nm);
        beam.material.color.copy(col);
        bulb.material.color.copy(col);
        beam.material.opacity = (p.I / 25) * 0.32;
        bulb.material.opacity = 0.1 + (p.I / 25) * 0.72;
        o2Meter.set(clamp(s.pNet / 18, -1, 1), `${s.pNet >= 0 ? '+' : ''}${s.pNet.toFixed(1)}`);

        const key = `${p.I}|${p.co2}|${p.T}|${p.lightMode}|${p.nm}`;
        if (key !== last) {
          last = key;
          g.clear()
            .curve([[0, 0], [25, 0]], 'rgba(30,43,54,0.4)', 0.02, true)
            .fn((I) => solvePhotosynthesis(I, p.co2, p.T, p.lightMode, p.nm).pGross, '#3a9cff', 0.03, true)
            .fn((I) => solvePhotosynthesis(I, p.co2, p.T, p.lightMode, p.nm).pNet, C.leaf, 0.048)
            .dot(p.I, s.pNet, C.amber, 0.09);
          if (Number.isFinite(s.lcp) && s.lcp <= 25) g.dot(s.lcp, 0, C.red, 0.065);
          g.done();
        }
        info.set(
          s.pNet > 0.12
            ? `净光合 +${s.pNet.toFixed(1)} · 总光合 ${s.pGross.toFixed(1)}\n呼吸 ${s.resp.toFixed(1)} · 光补偿 ≈ ${Number.isFinite(s.lcp) ? s.lcp.toFixed(1) : '∞'} klx`
            : s.pNet < -0.12
              ? `净光合 ${s.pNet.toFixed(1)} (无气泡 · 耗氧中)\n总光合 ${s.pGross.toFixed(1)} < 呼吸 ${s.resp.toFixed(1)}`
              : `恰好达到光补偿点！(P_总 ≈ R = ${s.resp.toFixed(1)})\n净放氧速率 ≈ 0`,
        );
        this._s = s;
      },
      margin() {
        const s = this._s || snapFn();
        return [
          `总光合 ${s.pGross.toFixed(1)} · 呼吸 ${s.resp.toFixed(1)}`,
          `净光合 ${s.pNet >= 0 ? '+' : ''}${s.pNet.toFixed(1)}`,
          `光补偿点 ≈ ${Number.isFinite(s.lcp) ? s.lcp.toFixed(1) + ' klx' : '不可达'}`,
          `光饱和点 ≈ ${s.lsp.toFixed(1)} klx`,
          p.lightMode === 1 ? `光质效率 ${(s.alpha * 100).toFixed(0)}% (${p.nm}nm)` : '全光谱白光 (100%)',
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 总光合 / 净光合 / 呼吸速率响应曲线与光补偿·光饱和点定位');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn" data-act="lcp">跳转至光补偿点</button>
      <button type="button" class="wb-btn" data-act="red">红光 660 nm</button>
      <button type="button" class="wb-btn" data-act="green">绿光 550 nm (对照)</button>
      <button type="button" class="wb-btn" data-act="blue">蓝光 450 nm</button>
      <button type="button" class="wb-btn" data-act="white">全光谱白光</button>
      <button type="button" class="wb-btn primary" data-act="rec">记录当前工况</button>`;
    sec1.append(bar);

    const chart = wb.canvas(sec1, 520, 265, (x, W, H) => {
      const p = sp.params;
      const curS = solvePhotosynthesis(p.I, p.co2, p.T, p.lightMode, p.nm);
      const pad = { l: 50, r: 22, t: 24, b: 36 };
      const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      const sx = (I) => pad.l + (I / 25) * pw;
      const sy = (v) => pad.t + ph - clamp((v + 6) / 30, 0, 1) * ph;

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      x.strokeStyle = 'rgba(30,43,54,0.12)'; x.lineWidth = 1;
      for (let v = -5; v <= 20; v += 5) {
        x.beginPath(); x.moveTo(pad.l, sy(v)); x.lineTo(pad.l + pw, sy(v)); x.stroke();
      }
      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.4;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();
      // 零线 P_net = 0
      x.strokeStyle = 'rgba(30,43,54,0.5)'; x.beginPath(); x.moveTo(pad.l, sy(0)); x.lineTo(pad.l + pw, sy(0)); x.stroke();

      x.fillStyle = '#51606b'; x.font = '11px Georgia,serif'; x.textAlign = 'center';
      for (let I = 0; I <= 25; I += 5) x.fillText(`${I}`, sx(I), H - 18);
      x.fillText('光照强度 I (klx)', pad.l + pw / 2, H - 4);
      x.textAlign = 'right';
      for (const v of [-5, 0, 5, 10, 15, 20]) x.fillText(String(v), pad.l - 6, sy(v) + 4);

      const drawFn = (fn, col, dashArr = [], lw = 2.2) => {
        x.save(); x.strokeStyle = col; x.lineWidth = lw; x.setLineDash(dashArr); x.beginPath();
        for (let i = 0; i <= 125; i++) {
          const I = (i / 125) * 25, val = fn(I);
          if (i === 0) x.moveTo(sx(I), sy(val)); else x.lineTo(sx(I), sy(val));
        }
        x.stroke(); x.restore();
      };
      // 总光合（蓝色虚线）、负呼吸基线（灰色虚线）、净光合（绿色实线）
      drawFn((I) => solvePhotosynthesis(I, p.co2, p.T, p.lightMode, p.nm).pGross, '#3a9cff', [5, 4], 1.8);
      drawFn(() => -curS.resp, '#8a8f94', [3, 3], 1.4);
      drawFn((I) => solvePhotosynthesis(I, p.co2, p.T, p.lightMode, p.nm).pNet, '#1f4a3e', [], 2.5);

      // 标注光补偿点 LCP 与光饱和点 LSP
      if (Number.isFinite(curS.lcp) && curS.lcp <= 25) {
        x.fillStyle = '#e5483f'; x.beginPath(); x.arc(sx(curS.lcp), sy(0), 5, 0, TAU); x.fill();
        x.font = '11px "Noto Serif SC",serif'; x.textAlign = 'left';
        x.fillText(`光补偿点 ${curS.lcp.toFixed(1)} klx`, sx(curS.lcp) + 6, sy(0) + 14);
      }
      if (curS.lsp <= 25) {
        const satNet = solvePhotosynthesis(curS.lsp, p.co2, p.T, p.lightMode, p.nm).pNet;
        x.strokeStyle = 'rgba(180,101,58,0.6)'; x.setLineDash([3, 3]);
        x.beginPath(); x.moveTo(sx(curS.lsp), pad.t); x.lineTo(sx(curS.lsp), pad.t + ph); x.stroke(); x.setLineDash([]);
        x.fillStyle = '#b4653a'; x.beginPath(); x.arc(sx(curS.lsp), sy(satNet), 5, 0, TAU); x.fill();
        x.font = '11px "Noto Serif SC",serif'; x.textAlign = 'right';
        x.fillText(`光饱和点 ≈${curS.lsp.toFixed(1)} klx`, Math.max(pad.l + 100, sx(curS.lsp) - 6), sy(satNet) - 10);
      }

      // 当前运行点
      x.fillStyle = '#ffb52e'; x.strokeStyle = '#1e2b36'; x.lineWidth = 1.6;
      x.beginPath(); x.arc(sx(p.I), sy(curS.pNet), 6, 0, TAU); x.fill(); x.stroke();

      x.fillStyle = '#1f4a3e'; x.textAlign = 'left'; x.font = '11px "Noto Serif SC",serif';
      x.fillText('— 净光合 P_净', pad.l + 8, pad.t + 12);
      x.fillStyle = '#3a9cff';
      x.fillText('--- 总光合 P_总', pad.l + 105, pad.t + 12);
      x.fillStyle = '#8a8f94';
      x.fillText('··· 呼吸速率 −R', pad.l + 205, pad.t + 12);
    });

    const statsEl = document.createElement('div');
    statsEl.className = 'wb-metrics';
    sec1.append(statsEl);

    let lastKey = '';
    const refresh = (force = false) => {
      const p = sp.params;
      const kStr = `${p.I}|${p.co2}|${p.T}|${p.lightMode}|${p.nm}`;
      if (!force && kStr === lastKey) return;
      lastKey = kStr;
      chart.redraw();
      const s = solvePhotosynthesis(p.I, p.co2, p.T, p.lightMode, p.nm);
      statsEl.innerHTML = `
        <div class="wb-m"><span>总光合速率 P_总</span><b>${s.pGross.toFixed(2)}</b></div>
        <div class="wb-m"><span>呼吸速率 R(T)</span><b>${s.resp.toFixed(2)}</b></div>
        <div class="wb-m"><span>净光合速率 P_净</span><b>${s.pNet >= 0 ? '+' : ''}${s.pNet.toFixed(2)}</b></div>
        <div class="wb-m"><span>光补偿点 / 光饱和点</span><b>${Number.isFinite(s.lcp) ? s.lcp.toFixed(1) : '∞'} / ${s.lsp.toFixed(1)} klx</b></div>`;
    };

    bar.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (!act) return;
      const p = sp.params;
      if (act === 'lcp') {
        const s = solvePhotosynthesis(p.I, p.co2, p.T, p.lightMode, p.nm);
        if (Number.isFinite(s.lcp)) wb.setParam('I', clamp(Math.round(s.lcp * 2) / 2, 0, 25));
      } else if (act === 'red') { wb.setParam('lightMode', 1); wb.setParam('nm', 660); }
      else if (act === 'green') { wb.setParam('lightMode', 1); wb.setParam('nm', 550); }
      else if (act === 'blue') { wb.setParam('lightMode', 1); wb.setParam('nm', 450); }
      else if (act === 'white') wb.setParam('lightMode', 0);
      else if (act === 'rec') {
        const row = photosynthesis.record.sample(sp.inst, sp.params);
        if (row) wb.record(row);
      }
      refresh(true);
    });

    refresh(true);
    return { update() { refresh(false); } };
  },
};

// ============================================================================
// 6. 性状分离比的模拟与自由组合检验 (L3)
// ============================================================================
const MENDEL_MONO = {
  labels: ['DD', 'Dd', 'dd'],
  colors: ['#ffe6ad', '#f4c76c', '#cfe6ff'],
  phenoLabels: ['显性(D_)', '隐性(dd)'],
  phenoExp: [0.75, 0.25],
  critPheno: 3.841, // df=1, alpha=0.05
};
const MENDEL_DI = {
  labels: ['黄圆(Y_R_)', '黄皱(Y_rr)', '绿圆(yyR_)', '绿皱(yyrr)'],
  colors: ['#f0c438', '#d89b28', '#39a861', '#256e43'],
  phenoLabels: ['黄圆', '黄皱', '绿圆', '绿皱'],
  phenoExp: [9 / 16, 3 / 16, 3 / 16, 1 / 16],
  critPheno: 7.815, // df=3, alpha=0.05
};

export const mendel = {
  id: 'bio-mendel',
  subject: 'bio',
  title: '性状分离比的模拟与自由组合检验',
  en: "Modelling Mendel's laws and chi-square test",
  lede: [
    '甲、乙两只小桶分别代表雌、雄生殖器官，桶内等量的彩球代表减数分裂形成的配子。每次从两桶各随机抓出一个配子结合并放回摇匀，模拟 F₁ 自交后代的随机受精。',
    '支持切换“单因子 Dd × Dd (3:1)”与“双因子 YyRr × YyRr (9:3:3:1)”。小样本（10 次）波动剧烈，大样本（1000 次）则趋近孟德尔理论比，可用卡方 χ² 检验拟合优度。',
  ],
  formula: 'DD:Dd:dd = 1:2:1 (显:隐=3:1) · Y_R_:Y_rr:yyR_:yyrr = 9:3:3:1 · χ² = Σ(Oᵢ−Eᵢ)²/Eᵢ',
  formulaNote: '当自由度 df=1 时 χ²₀.₀₅=3.841；df=3 时 χ²₀.₀₅=7.815（χ² < 临界值即认为符合理论分离/自由组合比例）',
  terms: [
    ['放回摇匀原则', '每次抓取后必须将小球放回原桶并充分混匀，保证每次抽取的独立等概率性。'],
    ['自由组合定律', '非同源染色体上的非等位基因在形成配子时自由组合，F₁ 产生 4 种等比例配子 (1:1:1:1)。'],
    ['卡方拟合优度检验', '定量判断“实测频数与孟德尔理论期望的偏离”究竟是随机抽样波动还是存在连锁/致死等非独立因素。'],
  ],
  predict: {
    q: '在单因子（3:1）或双因子（9:3:3:1）模拟中，为什么抽 16 次往往得不到刚好 9:3:3:1，而抽 1600 次就非常接近？',
    options: [
      '抽多了小球会互相吸引',
      '每次受精是独立随机事件，大样本才能抑制随机涨落、体现大数定律',
      '前 16 次是伪随机，后面才变真随机',
    ],
    answer: 1,
    why: '独立随机事件在小样本下存在显著二项/多项抽样误差；根据大数定律，当样本量 N 增大时，相对频率以 √N⁻¹ 的速率收敛到理论概率分布。',
  },
  challenge: '先抽 10 次观察偏离与 χ²，再一口气抽到 1000 次以上验证 3:1 与 9:3:3:1 收敛规律，并在工作台完成卡方拟合优度检验归档！',
  fig: '雌雄配子抽样桶、动态柱状分布与比例收敛曲线',
  hint: '切换单因子/双因子模式，点击“抽 1 次 / 10 次 / 100 次 / 1000 次”累积样本；打开工作台查看逐次收敛轨迹与 Pearson χ² 检验！',
  teach: {
    where: '人教版生物学必修2第1章 §1.1–1.2《孟德尔的豌豆杂交实验（一/二）》（海南高中生物核心必做）',
    ask: [
      '为什么甲桶（雌配子）与乙桶（雄配子）内的总球数不必严格相等，但同一桶内各类型配子数必须相等？',
      '如果双因子测验中出现 χ² = 18.4 (df=3)，可能暗示了什么生物学机制（如基因连锁或纯合致死）？',
    ],
    simplify: '假定完全显性、无致死基因、自由组合且每对基因位于非同源染色体上；采用确定性种子伪随机数可复现单次抽样轨迹。',
    safety: '纯数学概率与孟德尔遗传规律数字模拟实验。',
  },
  controls: [
    { id: 'mode', label: '杂交遗传模式', type: 'choice', options: ['单因子 Dd × Dd (3:1)', '双因子 YyRr × YyRr (9:3:3:1)'], value: 0, wide: true },
    { id: 'b1', label: '抽 1 次', type: 'button' },
    { id: 'b10', label: '抽 10 次', type: 'button' },
    { id: 'b100', label: '抽 100 次', type: 'button' },
    { id: 'b1000', label: '抽 1000 次', type: 'button' },
    { id: 'bReset', label: '清零重抽', type: 'button' },
  ],
  record: {
    note: '记录不同样本量 N 下的实测性状比例与 Pearson χ² 拟合优度检验结果。',
    pending: '完成若干次抽样后点击“记录一组”对比小样本与大样本 χ² 波动。',
    columns: [
      { key: 'crossType', label: '杂交类型' },
      { key: 'N', label: '总样本 N', digits: 0 },
      { key: 'obsStr', label: '实测频数比' },
      { key: 'chi2', label: '卡方 χ²', digits: 3, stat: true },
      { key: 'fit', label: 'P>0.05 判定' },
    ],
    sample: (inst) => {
      const s = inst?.snapshot?.();
      if (!s || s.tot < 1) return null;
      return {
        _kind: 'human',
        crossType: s.mode === 1 ? '9:3:3:1 双因子' : '3:1 单因子',
        N: s.tot,
        obsStr: s.obsPheno.join(':'),
        chi2: s.chi.chi2,
        fit: s.chi.chi2 <= s.crit ? '符合孟德尔定律' : '显著偏离 (α=0.05)',
      };
    },
    summary: (rows) => [
      ['已录入抽样批次', `${rows.length} 组`],
      ['最近样本 χ²', rows.length ? `${rows[rows.length - 1].chi2.toFixed(3)} (${rows[rows.length - 1].fit})` : '—'],
    ],
    errors: [
      '样本量过小就下结论：N = 4 或 10 时抽样涨落极易导致比例偏离 3:1 或 9:3:3:1。',
      '误将 χ² 阈值固定不变：df = 1 临界值为 3.841，df = 3 临界值为 7.815。',
    ],
  },

  build(k) {
    const p = k.p;
    const Z = -1.3;
    const mkBucket = (x, name) => {
      const g = at(group(
        glass(new THREE.CylinderGeometry(0.95, 0.80, 1.6, 36, 1, true).translate(0, 0.8, 0)),
        glass(new THREE.CircleGeometry(0.80, 36).rotateX(-Math.PI / 2).translate(0, 0.03, 0)),
      ), x, 0.05, Z);
      const balls = dots(24, 0.18, '#ffffff', { seg: 14 });
      const bCols = [C.amber, C.sky, C.leaf, C.rose];
      for (let i = 0; i < 24; i++) {
        const a = (i * 2.39996) % TAU, r = Math.sqrt((i + 0.5) / 24) * 0.58;
        balls.put(i, Math.cos(a) * r, 0.22 + (i % 4) * 0.28, Math.sin(a) * r).paint(i, bCols[i % 4]);
      }
      balls.done();
      g.add(balls, at(note(name, { size: 0.30 }), 0, 2.15, 0));
      return g;
    };
    const pick = [ball(0.22, C.amber), ball(0.22, C.sky)];

    // 最多 4 根立柱（单因子用 3 根 DD/Dd/dd，双因子用 4 根 9:3:3:1）
    const bars = [0, 1, 2, 3].map((i) => {
      const b = at(box(0.72, 1, 0.72, MENDEL_DI.colors[i]), -1.65 + i * 1.1, 0, 1.75);
      return {
        b,
        tag: at(note('', { size: 0.26, italic: true, lay: 'flat', w: 1.3 }), -1.65 + i * 1.1, 0.03, 2.48),
        num: at(note('0', { size: 0.28, w: 1.1 }), -1.65 + i * 1.1, 0.5, 1.75),
      };
    });
    const g = at(plot({ w: 3.9, h: 2.9, xr: [0, 100], yr: [0, 1], xl: '抽样次数 N', yl: '主显性比例' }), 2.5, 0, -2.9);
    k.root.add(mkBucket(-3.1, '甲（♀配子）'), mkBucket(-0.6, '乙（♂配子）'), ...pick, ...bars.flatMap((x) => [x.b, x.tag, x.num]), g, at(plate(3.0, 0.85), -1.85, 0, 0.1));

    const rand = rng(987654321);
    const monoCnt = [0, 0, 0]; // DD, Dd, dd
    const diCnt = [0, 0, 0, 0]; // Y_R_, Y_rr, yyR_, yyrr
    const histMono = [], histDi = [];
    let anim = 0, curCols = [C.amber, C.sky], lastMode = -1;

    const once = () => {
      if (p.mode === 0) {
        const a = rand() < 0.5 ? 0 : 1, b = rand() < 0.5 ? 0 : 1;
        monoCnt[a + b]++;
        curCols = [a === 0 ? C.amber : C.sky, b === 0 ? C.amber : C.sky];
        const n = monoCnt[0] + monoCnt[1] + monoCnt[2];
        histMono.push([n, (monoCnt[0] + monoCnt[1]) / n]);
      } else {
        const g1 = Math.floor(rand() * 4), g2 = Math.floor(rand() * 4);
        // 0:YR, 1:Yr, 2:yR, 3:yr
        const domY = (g1 < 2) || (g2 < 2);
        const domR = (g1 % 2 === 0) || (g2 % 2 === 0);
        const idx = domY ? (domR ? 0 : 1) : (domR ? 2 : 3);
        diCnt[idx]++;
        const gc = [C.amber, C.rose, C.leaf, C.sky];
        curCols = [gc[g1], gc[g2]];
        const n = diCnt[0] + diCnt[1] + diCnt[2] + diCnt[3];
        histDi.push([n, diCnt[0] / n]);
      }
    };

    const getSnapshot = () => {
      if (p.mode === 0) {
        const tot = monoCnt[0] + monoCnt[1] + monoCnt[2];
        const obsPheno = [monoCnt[0] + monoCnt[1], monoCnt[2]];
        const expPheno = MENDEL_MONO.phenoExp.map((w) => w * Math.max(1, tot));
        const chi = tot > 0 ? chiSquare(obsPheno, expPheno) : { chi2: 0, df: 1 };
        const chiGeno = tot > 0 ? chiSquare(monoCnt, [0.25 * tot, 0.5 * tot, 0.25 * tot]) : { chi2: 0, df: 2 };
        return { mode: 0, tot, counts: [...monoCnt], obsPheno, expPheno, chi, chiGeno, crit: MENDEL_MONO.critPheno, hist: histMono };
      }
      const tot = diCnt[0] + diCnt[1] + diCnt[2] + diCnt[3];
      const obsPheno = [...diCnt];
      const expPheno = MENDEL_DI.phenoExp.map((w) => w * Math.max(1, tot));
      const chi = tot > 0 ? chiSquare(obsPheno, expPheno) : { chi2: 0, df: 3 };
      return { mode: 1, tot, counts: [...diCnt], obsPheno, expPheno, chi, crit: MENDEL_DI.critPheno, hist: histDi };
    };

    const syncBarsAndPlot = () => {
      const isDi = p.mode === 1;
      const cfg = isDi ? MENDEL_DI : MENDEL_MONO;
      const cnt = isDi ? diCnt : monoCnt;
      const hist = isDi ? histDi : histMono;
      const targetRef = isDi ? 9 / 16 : 0.75;
      if (p.mode !== lastMode) {
        lastMode = p.mode;
        bars.forEach((x, i) => {
          const vis = i < cfg.labels.length;
          x.b.visible = x.tag.visible = x.num.visible = vis;
          if (vis) {
            x.b.material.color.set(cfg.colors[i]);
            x.tag.set(cfg.labels[i]);
            const xPos = isDi ? -1.65 + i * 1.1 : -1.3 + i * 1.3;
            x.b.position.x = x.tag.position.x = x.num.position.x = xPos;
          }
        });
      }
      const tot = cnt.reduce((a, b) => a + b, 0);
      const nMax = Math.max(100, tot);
      // 仅采样最多 200 个绘图点保持流畅
      const pts = hist.length <= 200 ? hist : hist.filter((_, i) => i % Math.ceil(hist.length / 200) === 0 || i === hist.length - 1);
      g.range([0, nMax], [0, 1]).clear()
        .curve([[0, targetRef], [nMax, targetRef]], C.violet, 0.03, true)
        .curve(pts, C.flame, 0.04)
        .text(nMax * 0.56, targetRef + 0.10, `理论 ${(targetRef * 100).toFixed(1)}%`, '#5a3fd0')
        .done();
    };

    syncBarsAndPlot();

    return {
      snapshot: getSnapshot,
      press(id) {
        if (id === 'bReset' || id === 'reset') {
          if (p.mode === 0) { monoCnt.fill(0); histMono.length = 0; }
          else { diCnt.fill(0); histDi.length = 0; }
          anim = 0;
        } else {
          const n = id === 'b1' || id === 'one' ? 1 : id === 'b10' || id === 'ten' ? 10 : id === 'b100' || id === 'hun' ? 100 : 1000;
          for (let i = 0; i < n; i++) once();
          anim = 1;
        }
        syncBarsAndPlot();
        k.dirty();
      },
      change() { syncBarsAndPlot(); k.dirty(); },
      update(dt) {
        anim = Math.max(0, anim - dt * 2.4);
        const e = 1 - anim * anim;
        const s = getSnapshot();
        const mx = Math.max(8, ...s.counts);
        pick.forEach((b, i) => {
          b.visible = s.tot > 0;
          b.material.color.set(curCols[i]);
          b.position.set(lerp(i ? -0.6 : -3.1, -1.85 + (i ? 0.3 : -0.3), e), 0.3 + Math.sin(e * Math.PI) * 2.1 + (1 - e) * 1.3, lerp(Z, 0.1, e));
        });
        bars.forEach((x, i) => {
          if (!x.b.visible) return;
          x.b.scale.y = lerp(x.b.scale.y, 0.02 + (s.counts[i] / mx) * 2.5, 0.22);
          x.num.position.y = x.b.scale.y + 0.35;
          x.num.set(String(s.counts[i]));
        });
      },
      margin() {
        const s = getSnapshot();
        return [
          `${s.mode === 1 ? '双因子 9:3:3:1' : '单因子 3:1'} · 共 ${s.tot} 次`,
          s.mode === 0 ? `DD ${s.counts[0]} · Dd ${s.counts[1]} · dd ${s.counts[2]}` : `黄圆 ${s.counts[0]} 黄皱 ${s.counts[1]} 绿圆 ${s.counts[2]} 绿皱 ${s.counts[3]}`,
          `Pearson χ² = ${s.chi.chi2.toFixed(3)} (df=${s.chi.df})`,
          s.tot > 0 ? (s.chi.chi2 <= s.crit ? `✓ < 临界 ${s.crit} (符合定律)` : `⚠ > 临界 ${s.crit} (样本偏离)`) : '待抽样',
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 样本积累收敛轨迹与 Pearson 卡方（χ²）拟合优度检验');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn" data-act="b1">抽 1 次</button>
      <button type="button" class="wb-btn" data-act="b10">抽 10 次</button>
      <button type="button" class="wb-btn" data-act="b100">抽 100 次</button>
      <button type="button" class="wb-btn" data-act="b1000">抽 1000 次</button>
      <button type="button" class="wb-btn" data-act="bReset">清零</button>
      <button type="button" class="wb-btn primary" data-act="rec">记录本批 χ² 统计</button>`;
    sec1.append(bar);

    const chart = wb.canvas(sec1, 520, 240, (x, W, H) => {
      const s = sp.inst?.snapshot?.() || { mode: 0, tot: 0, obsPheno: [0, 0], expPheno: [0, 0], chi: { chi2: 0, df: 1 }, crit: 3.841, hist: [] };
      const pad = { l: 48, r: 22, t: 22, b: 36 };
      const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      const nMax = Math.max(50, s.tot);
      const target = s.mode === 1 ? 9 / 16 : 0.75;
      const sx = (n) => pad.l + (n / nMax) * pw;
      const sy = (r) => pad.t + ph - clamp(r, 0, 1) * ph;

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      // ±2% 稳定误差带
      x.fillStyle = 'rgba(31, 74, 62, 0.08)';
      x.fillRect(pad.l, sy(target + 0.02), pw, sy(target - 0.02) - sy(target + 0.02));
      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.4;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();

      x.strokeStyle = '#7a5cff'; x.setLineDash([6, 4]); x.lineWidth = 1.8;
      x.beginPath(); x.moveTo(pad.l, sy(target)); x.lineTo(pad.l + pw, sy(target)); x.stroke();
      x.setLineDash([]);

      if (s.hist.length > 0) {
        const pts = s.hist.length <= 240 ? s.hist : s.hist.filter((_, i) => i % Math.ceil(s.hist.length / 240) === 0 || i === s.hist.length - 1);
        x.strokeStyle = '#ff6a3d'; x.lineWidth = 2.0; x.beginPath();
        pts.forEach(([n, ratio], i) => {
          if (i === 0) x.moveTo(sx(n), sy(ratio)); else x.lineTo(sx(n), sy(ratio));
        });
        x.stroke();
      }

      x.fillStyle = '#51606b'; x.font = '11px Georgia,serif'; x.textAlign = 'center';
      x.fillText('0', pad.l, H - 18); x.fillText(String(nMax), pad.l + pw, H - 18);
      x.fillText('累积抽样次数 N', pad.l + pw / 2, H - 4);
      x.textAlign = 'right';
      for (const r of [0, 0.25, 0.5, 0.75, 1.0]) x.fillText(`${(r * 100).toFixed(0)}%`, pad.l - 6, sy(r) + 4);
      x.fillStyle = '#7a5cff'; x.textAlign = 'left'; x.font = '11px "Noto Serif SC",serif';
      x.fillText(`理论目标 ${(target * 100).toFixed(2)}% (±2% 绿带)`, pad.l + 8, pad.t + 12);
    });

    const statsEl = document.createElement('div');
    statsEl.className = 'wb-metrics';
    sec1.append(statsEl);

    let lastKey = '';
    const refresh = (force = false) => {
      const s = sp.inst?.snapshot?.();
      if (!s) return;
      const kStr = `${s.mode}|${s.tot}`;
      if (!force && kStr === lastKey) return;
      lastKey = kStr;
      chart.redraw();
      const labels = s.mode === 1 ? MENDEL_DI.phenoLabels : MENDEL_MONO.phenoLabels;
      const cards = labels.map((lb, i) => `
        <div class="wb-m">
          <span>${lb} (理论 ${s.tot ? s.expPheno[i].toFixed(1) : '—'})</span>
          <b>实测 ${s.obsPheno[i]} (${s.tot ? ((s.obsPheno[i] / s.tot) * 100).toFixed(1) + '%' : '—'})</b>
        </div>`).join('');
      const fitTxt = s.tot === 0 ? '尚未抽样' : s.chi.chi2 <= s.crit ? `✓ 接受 (P > 0.05)` : `⚠ 偏离 (P < 0.05)`;
      statsEl.innerHTML = cards + `
        <div class="wb-m"><span>χ² = Σ(O−E)²/E (df=${s.chi.df})</span><b>${s.chi.chi2.toFixed(3)} · 临界 ${s.crit}</b></div>
        <div class="wb-m"><span>拟合优度结论</span><b>${fitTxt}</b></div>`;
    };

    bar.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (!act) return;
      if (act === 'rec') {
        const row = mendel.record.sample(sp.inst, sp.params);
        if (row) wb.record(row);
      } else {
        wb.press(act);
      }
      refresh(true);
    });

    refresh(true);
    return { update() { refresh(false); } };
  },
};

// ============================================================================
// 7. DNA 双螺旋结构模型与热变性探究 (L3)
// ============================================================================
const DNA_BASE = {
  A: { comp: 'T', col: C.leaf, hb: 2 },
  T: { comp: 'A', col: C.red, hb: 2 },
  G: { comp: 'C', col: C.sky, hb: 3 },
  C: { comp: 'G', col: C.amber, hb: 3 },
};
const calcTm = (gcPct) => 69.3 + 0.41 * gcPct;
const hyperchromicA260 = (T, tm) => 1.0 + 0.37 / (1 + Math.exp(-(T - tm) / 2.4));

export const dna = {
  id: 'bio-dna',
  subject: 'bio',
  title: 'DNA 双螺旋结构模型与热变性探究',
  en: 'DNA double helix & melting temperature',
  lede: [
    '两条脱氧核苷酸长链反向平行（5′→3′ 对 3′→5′）盘旋成右手双螺旋：外侧磷酸–脱氧核糖骨架作扶手，内侧 A=T（2 个氢键）、G≡C（3 个氢键）互补配对作踏板。',
    '升高温度破坏碱基间氢键与碱基堆积力使双链解旋为单链（热变性），紫外 260 nm 吸光度随之跃升约 37%（增色效应）；GC 含量越高，解链温度 T_m = 69.3 + 0.41·(%GC) 越高。',
  ],
  formula: 'A = T (2 氢键) · G ≡ C (3 氢键) · T_m = 69.3 + 0.41·(%GC) °C',
  formulaNote: 'Chargaff 定律：双链 DNA 中 A=T、G=C，嘌呤总数 (A+G) = 嘧啶总数 (T+C)；热解链时 A₂₆₀ 从 1.00 升至 1.37',
  terms: [
    ['反向平行', '两条链方向相反，一条 5′→3′，另一条 3′→5′，保证碱基互补空间构象稳定。'],
    ['热变性与 T_m', '双链解开一半时的温度称熔解温度 T_m，GC 碱基对因多 1 个氢键而显著提高热稳定性。'],
    ['增色效应 (A₂₆₀)', '单链 DNA 碱基暴露使 260 nm 紫外光吸收明显升高约 37%，是监测解链进程的核心指标。'],
  ],
  predict: {
    q: '两段等长 DNA 分子，甲的 G–C 含量为 80%，乙的 G–C 含量为 20%。加热升温时，哪一段更“耐热”（T_m 更高）？',
    options: ['乙（20% GC）T_m 更高', '甲（80% GC）T_m 更高，因为 G≡C 之间有 3 个氢键', '两段等长，T_m 完全相同'],
    answer: 1,
    why: 'G–C 配对有 3 个氢键且堆积作用更强，A–T 只有 2 个氢键。按 T_m = 69.3 + 0.41·(%GC)，80% GC 的 T_m ≈ 102.1°C（模型在 25–100°C 范围表现高热稳定性），而 20% GC 仅约 77.5°C。',
  },
  challenge: '搭出 20% GC 与 80% GC 两段序列，拉动溶液温度 T 越过 T_m 观察三维双链解旋分离，并在工作台对比两条 A₂₆₀ 熔解曲线！',
  fig: '10 碱基对 B-DNA 双螺旋三维模型与温度解链动力学',
  hint: '点击 A/T/G/C 推入新碱基或一键切换高/低 GC 序列；拖动温度滑块 T 观察双链在 T_m 处氢键断裂并分离；打开工作台查看 A₂₆₀ 增色效应熔解曲线！',
  teach: {
    where: '人教版生物学必修2第3章 §3.2《DNA 的结构 · 探究·实践：制作 DNA 双螺旋结构模型》（海南高中生物核心实验）',
    ask: [
      '验证任意碱基序列双链中 (A+G)/(T+C) 是否恒等于 1？(A+T)/(G+C) 在不同生物间有何意义？',
      'PCR 扩增第一步为何需要 94–95°C 高温变性？如果引物/模板 GC 过高会带来什么影响？',
    ],
    simplify: '模型采用 B-DNA 每对默认 36° 扭转、3.4 nm/10 bp 比例示意；T_m 采用经典经验式 69.3 + 0.41·(%GC)（标准 1×SSC 盐浓度近似）。',
    safety: '纯分子结构与热力学熔解可视化模型实验。',
  },
  controls: [
    { id: 'T', label: '溶液温度 T', min: 25, max: 105, step: 0.5, value: 25, unit: '°C' },
    { id: 'tw', label: '每对扭转角', min: 0, max: 36, step: 1, value: 36, unit: '°' },
    { id: 'bA', label: '接 A', type: 'button' },
    { id: 'bT', label: '接 T', type: 'button' },
    { id: 'bG', label: '接 G', type: 'button' },
    { id: 'bC', label: '接 C', type: 'button' },
    { id: 'bLowGC', label: '20% GC 序列', type: 'button' },
    { id: 'bHighGC', label: '80% GC 序列', type: 'button' },
    { id: 'bRand', label: '随机序列', type: 'button' },
  ],
  record: {
    note: '记录不同碱基序列的 GC%、氢键总数、理论 T_m 及当前温度下的紫外吸光度 A₂₆₀。',
    pending: '编辑序列或调节温度后点击“记录一组”保存 DNA 热变性数据。',
    columns: [
      { key: 'seq', label: '5′→3′ 序列' },
      { key: 'gcPct', label: 'GC 含量', unit: '%', digits: 0 },
      { key: 'hbonds', label: '氢键数', digits: 0 },
      { key: 'tm', label: '熔解温度 T_m', unit: '°C', digits: 1, stat: true },
      { key: 'T', label: '当前 T', unit: '°C', digits: 1 },
      { key: 'a260', label: 'A₂₆₀ 相对值', digits: 3 },
    ],
    sample: (inst, p) => {
      const s = inst?.snapshot?.();
      if (!s) return null;
      return {
        _kind: 'human',
        seq: s.seqStr,
        gcPct: s.gcPct,
        hbonds: s.hbonds,
        tm: s.tm,
        T: p.T,
        a260: s.a260,
      };
    },
    summary: (rows) => [
      ['已测定序列数', `${rows.length} 条`],
      ['T_m 区间', rows.length ? `${Math.min(...rows.map((r) => r.tm)).toFixed(1)} – ${Math.max(...rows.map((r) => r.tm)).toFixed(1)} °C` : '—'],
    ],
    errors: [
      '忘记双链反向平行：与 5′-ATGC-3′ 互补链若也按 5′→3′ 读是 GCAT，从 3′→5′ 读才是 TACG。',
      '误认为 A=T 与 G≡C 氢键数相同：G≡C 多 1 个氢键使高 GC 片段显著更耐热。',
    ],
  },

  build(k) {
    const p = k.p;
    const X = -1.45, Z = -0.75, R = 1.12, RISE = 0.48, N = 10;
    let seq = 'ATGCGTACCA'.split('');
    let spin = 0, lastBuildKey = '';
    const helixHolder = at(new THREE.Group(), X, 0.45, Z);
    const info = at(card('\n', { w: 4.0, size: 0.29, align: 'left' }), 2.45, 0, 2.35);
    const strands = at(card('\n', { w: 4.1, size: 0.28, align: 'left' }), 2.45, 0, -2.45);
    k.root.add(helixHolder, info, strands, at(cyl(1.45, 0.12), X, 0, Z));

    const getSnapshot = () => {
      const gcCount = seq.filter((b) => b === 'G' || b === 'C').length;
      const gcPct = (gcCount / N) * 100;
      const hbonds = gcCount * 3 + (N - gcCount) * 2;
      const tm = calcTm(gcPct);
      const sep = 1 / (1 + Math.exp(-(p.T - tm) / 2.4)); // 0=双链紧合, 1=解链分离
      const a260 = 1.0 + 0.37 * sep;
      const comp = seq.map((b) => DNA_BASE[b].comp);
      return { seq: [...seq], seqStr: seq.join(''), compStr: comp.join(''), gcCount, gcPct, hbonds, tm, sep, a260 };
    };

    const rebuild = () => {
      const s = getSnapshot();
      const sepQ = Math.round(s.sep * 40) / 40;
      const bKey = `${s.seqStr}|${p.tw}|${sepQ}`;
      if (bKey === lastBuildKey) return;
      lastBuildKey = bKey;

      freshGroup(helixHolder);
      const tw = ((p.tw * (1 - sepQ * 0.45)) * Math.PI) / 180;
      const rNow = R + sepQ * 0.72;
      const a1 = [], a2 = [];
      for (let i = 0; i < N; i++) {
        const a = i * tw, y = i * RISE + 0.2, c = Math.cos(a), sn = Math.sin(a);
        const P1 = [c * rNow, y, sn * rNow], P2 = [-c * rNow, y, -sn * rNow];
        const infoB = DNA_BASE[seq[i]];
        const col2 = DNA_BASE[infoB.comp].col;
        a1.push(P1); a2.push(P2);
        // 碱基棒随解链缩回各自骨架一侧，中间出现氢键断裂空隙
        const inner1 = [c * (0.04 + sepQ * 0.65), y, sn * (0.04 + sepQ * 0.65)];
        const inner2 = [-c * (0.04 + sepQ * 0.65), y, -sn * (0.04 + sepQ * 0.65)];
        helixHolder.add(
          rod(P1, inner1, 0.095, infoB.col),
          rod(P2, inner2, 0.095, col2),
          at(ball(0.155), ...P1),
          at(ball(0.155), ...P2),
        );
        // 若未完全解链，在中央显示 2 或 3 条氢键短虚杆
        if (sepQ < 0.75) {
          for (let h = 0; h < infoB.hb; h++) {
            const dy = (h - (infoB.hb - 1) / 2) * 0.08;
            helixHolder.add(wire([c * 0.14, y + dy, sn * 0.14], [-c * 0.14, y + dy, -sn * 0.14], 0.016));
          }
        }
      }
      helixHolder.add(tube(a1, 0.068, C.paper, { seg: 70 }), tube(a2, 0.068, C.paper, { seg: 70 }));
      info.set(`GC ${s.gcPct.toFixed(0)}% · 氢键 ${s.hbonds} 个\nT_m = ${s.tm.toFixed(1)}°C · A₂₆₀ = ${s.a260.toFixed(3)}`);
      strands.set(`5′-${s.seqStr}-3′\n3′-${s.compStr}-5′`);
    };

    rebuild();

    return {
      snapshot: getSnapshot,
      setBase(idx, base) { if (idx >= 0 && idx < N && DNA_BASE[base]) { seq[idx] = base; rebuild(); k.dirty(); } },
      setSeq(str) { if (str.length === N) { seq = str.split(''); rebuild(); k.dirty(); } },
      press(id) {
        const rand = rng(Date.now() & 0xffff);
        if (id === 'bRand' || id === 'rand') seq = Array.from({ length: N }, () => 'ATGC'[Math.floor(rand() * 4)]);
        else if (id === 'bLowGC') seq = 'AATTAGATTT'.split(''); // 20% GC
        else if (id === 'bHighGC') seq = 'GGCGCCATGC'.split(''); // 80% GC
        else {
          const base = id.replace(/^b/, '');
          if (DNA_BASE[base]) { seq.push(base); seq.shift(); }
        }
        rebuild();
        k.dirty();
      },
      change() { rebuild(); k.dirty(); },
      update(dt) {
        rebuild();
        spin += dt * 0.42;
        helixHolder.rotation.y = spin;
      },
      margin() {
        const s = getSnapshot();
        const cnt = (b) => seq.filter((x) => x === b).length;
        const comp = seq.map((b) => DNA_BASE[b].comp);
        const cntC = (b) => comp.filter((x) => x === b).length;
        const A = cnt('A') + cntC('A'), T = cnt('T') + cntC('T'), G = cnt('G') + cntC('G'), Cc = cnt('C') + cntC('C');
        return [
          `A ${A} = T ${T} · G ${G} = C ${Cc}`,
          `(A+G)/(T+C) = ${((A + G) / Math.max(1, T + Cc)).toFixed(2)}`,
          `GC ${s.gcPct.toFixed(0)}% · T_m = ${s.tm.toFixed(1)}°C`,
          s.sep > 0.7 ? '已热变性为两条单链' : s.sep > 0.3 ? '正在解链 (T ≈ T_m)' : '双螺旋氢键完整',
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 序列碱基编辑与 260 nm 紫外增色效应熔解曲线 (A₂₆₀ vs T)');
    const seqRow = document.createElement('div');
    seqRow.className = 'wb-btn-row';
    sec1.append(seqRow);

    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn" data-act="bLowGC">20% GC (低T_m)</button>
      <button type="button" class="wb-btn" data-act="midGC">50% GC (中T_m)</button>
      <button type="button" class="wb-btn" data-act="bHighGC">80% GC (高T_m)</button>
      <button type="button" class="wb-btn" data-act="toTm">跳至当前 T_m</button>
      <button type="button" class="wb-btn primary" data-act="rec">记录热变性数据</button>`;
    sec1.append(bar);

    const chart = wb.canvas(sec1, 520, 240, (x, W, H) => {
      const p = sp.params;
      const s = sp.inst?.snapshot?.() || { gcPct: 50, tm: 89.8, a260: 1.0, seq: [] };
      const pad = { l: 50, r: 22, t: 24, b: 36 };
      const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      const sx = (T) => pad.l + ((T - 25) / 80) * pw;
      const sy = (a) => pad.t + ph - ((a - 0.95) / 0.47) * ph;

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      x.strokeStyle = 'rgba(30,43,54,0.12)'; x.lineWidth = 1;
      for (const a of [1.0, 1.185, 1.37]) {
        x.beginPath(); x.moveTo(pad.l, sy(a)); x.lineTo(pad.l + pw, sy(a)); x.stroke();
      }
      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.4;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();

      x.fillStyle = '#51606b'; x.font = '11px Georgia,serif'; x.textAlign = 'center';
      for (let T = 25; T <= 105; T += 20) x.fillText(`${T}°C`, sx(T), H - 18);
      x.fillText('溶液温度 T (°C)', pad.l + pw / 2, H - 4);
      x.textAlign = 'right';
      for (const a of [1.0, 1.185, 1.37]) x.fillText(a.toFixed(2), pad.l - 6, sy(a) + 4);

      const drawMelt = (tmVal, col, dashArr = [], lw = 2.0) => {
        x.save(); x.strokeStyle = col; x.lineWidth = lw; x.setLineDash(dashArr); x.beginPath();
        for (let i = 0; i <= 100; i++) {
          const T = 25 + (i / 100) * 80, a = hyperchromicA260(T, tmVal);
          if (i === 0) x.moveTo(sx(T), sy(a)); else x.lineTo(sx(T), sy(a));
        }
        x.stroke(); x.restore();
      };
      // 20% GC 与 80% GC 对照虚线
      drawMelt(calcTm(20), 'rgba(229, 72, 63, 0.45)', [5, 4], 1.5);
      drawMelt(calcTm(80), 'rgba(58, 156, 255, 0.55)', [5, 4], 1.5);
      // 当前序列曲线
      drawMelt(s.tm, '#1f4a3e', [], 2.5);

      // T_m 中点虚线
      if (s.tm <= 105) {
        x.strokeStyle = 'rgba(180,101,58,0.6)'; x.setLineDash([3, 3]);
        x.beginPath(); x.moveTo(sx(s.tm), pad.t); x.lineTo(sx(s.tm), pad.t + ph); x.stroke(); x.setLineDash([]);
        x.fillStyle = '#b4653a'; x.textAlign = 'left'; x.font = '11px "Noto Serif SC",serif';
        x.fillText(`T_m=${s.tm.toFixed(1)}°C`, Math.min(sx(s.tm) + 4, W - 95), sy(1.185) + 14);
      }

      // 当前温度点
      x.fillStyle = '#ffb52e'; x.strokeStyle = '#1e2b36'; x.lineWidth = 1.6;
      x.beginPath(); x.arc(sx(p.T), sy(s.a260), 5.5, 0, TAU); x.fill(); x.stroke();

      x.fillStyle = '#e5483f'; x.textAlign = 'left'; x.font = '11px "Noto Serif SC",serif';
      x.fillText('--- 20% GC (77.5°C)', pad.l + 8, pad.t + 12);
      x.fillStyle = '#1f4a3e';
      x.fillText(`— 当前 ${s.gcPct.toFixed(0)}% GC`, pad.l + 135, pad.t + 12);
      x.fillStyle = '#3a9cff';
      x.fillText('--- 80% GC (102.1°C)', pad.l + 245, pad.t + 12);
    });

    const statsEl = document.createElement('div');
    statsEl.className = 'wb-metrics';
    sec1.append(statsEl);

    let lastKey = '';
    const CYCLE = ['A', 'T', 'G', 'C'];
    const renderSeqBtns = (seqArr) => {
      seqRow.innerHTML = `<span class="wb-muted" style="margin-right:6px">点击碱基位点轮换 5′→3′：</span>`
        + seqArr.map((b, i) => `<button type="button" class="wb-btn" data-idx="${i}" title="第 ${i + 1} 位">${b}</button>`).join('');
    };

    const refresh = (force = false) => {
      const s = sp.inst?.snapshot?.();
      if (!s) return;
      const kStr = `${s.seqStr}|${sp.params.T}`;
      if (!force && kStr === lastKey) return;
      lastKey = kStr;
      renderSeqBtns(s.seq);
      chart.redraw();
      statsEl.innerHTML = `
        <div class="wb-m"><span>GC 含量 & 氢键总数</span><b>${s.gcPct.toFixed(0)}% · ${s.hbonds} 个</b></div>
        <div class="wb-m"><span>理论熔解温度 T_m</span><b>${s.tm.toFixed(1)} °C</b></div>
        <div class="wb-m"><span>A₂₆₀ 吸光度 (相对双链)</span><b>${s.a260.toFixed(3)}</b></div>
        <div class="wb-m"><span>解链进度</span><b>${(s.sep * 100).toFixed(0)}%</b></div>`;
    };

    seqRow.addEventListener('click', (e) => {
      const idx = e.target.closest('button')?.dataset.idx;
      if (idx === undefined) return;
      const s = sp.inst?.snapshot?.();
      if (!s) return;
      const curB = s.seq[+idx];
      const nextB = CYCLE[(CYCLE.indexOf(curB) + 1) % 4];
      sp.inst?.setBase?.(+idx, nextB);
      refresh(true);
    });

    bar.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (!act) return;
      const s = sp.inst?.snapshot?.();
      if (act === 'bLowGC' || act === 'bHighGC') wb.press(act);
      else if (act === 'midGC') sp.inst?.setSeq?.('ATGCGTACCA');
      else if (act === 'toTm' && s) wb.setParam('T', clamp(Math.round(s.tm * 2) / 2, 25, 105));
      else if (act === 'rec') {
        const row = dna.record.sample(sp.inst, sp.params);
        if (row) wb.record(row);
      }
      refresh(true);
    });

    refresh(true);
    return { update() { refresh(false); } };
  },
};

// ============================================================================
// 8. 探究培养液中酵母菌种群数量的变化 (L3)
// ============================================================================
const DIL_FACTORS = [1, 10, 50, 100];
const N0_YEAST = 50; // 50 万个/mL (5.0 × 10⁵ /mL)

function yeastDensity(t, r, K, mode) {
  if (mode === 1) return N0_YEAST * Math.exp(r * t); // 理想 J 形
  const logi = K / (1 + ((K - N0_YEAST) / N0_YEAST) * Math.exp(-r * t));
  if (mode === 2) {
    // 代谢废物积累导致 24h 后进入衰退期
    const decay = 1 / (1 + Math.exp((t - 25) / 3.2));
    return logi * (0.28 + 0.72 * decay);
  }
  return logi;
}

function yeastRate(t, r, K, mode) {
  const n = yeastDensity(t, r, K, mode);
  if (mode === 1) return r * n;
  if (mode === 0) return r * n * (1 - n / K);
  const dt = 0.05;
  return (yeastDensity(t + dt, r, K, mode) - yeastDensity(Math.max(0, t - dt), r, K, mode)) / (t < dt ? dt : 2 * dt);
}

function yeastPhase(t, r, K, mode) {
  const n = yeastDensity(t, r, K, mode);
  if (mode === 1) return n < N0_YEAST * 2 ? '指数初期' : 'J 形指数暴增';
  if (mode === 2 && t > 22 && yeastRate(t, r, K, mode) < -10) return '衰退期(代谢物积累)';
  if (n < K * 0.12) return '延滞/适应期';
  if (n < K * 0.55) return '对数/加速增长期 (近 K/2)';
  if (n < K * 0.94) return '减速增长期 (趋近 K)';
  return '稳定期 (N ≈ K)';
}

function sampleFiveSquares(nWanPerMl, dil, seed) {
  // 25×16 血细胞计数板: N_total(个/mL) = count_5cells * 5 * 10^4 * dil => 期望 count_5 = nWan / (5 * dil)
  const lambda5 = nWanPerMl / (5 * dil);
  const rd = rng(seed);
  // 用泊松/正态混合给出真实整数抽样计数
  const count5 = Math.max(0, Math.round(lambda5 + gauss(rd) * Math.sqrt(Math.max(0.5, lambda5))));
  const pts = [];
  const fiveBoxes = [[0, 0], [4, 0], [2, 2], [0, 4], [4, 4]]; // 5×5 中格中的四角与中央
  const showN = Math.min(count5, 220);
  for (let i = 0; i < showN; i++) {
    const [bx, by] = fiveBoxes[i % 5];
    const lx = rd(), ly = rd();
    pts.push({ bx, by, lx, ly });
  }
  return { count5, lambda5, pts, crowded: count5 > 160 };
}

export const population = {
  id: 'bio-population',
  subject: 'bio',
  title: '探究培养液中酵母菌种群数量的变化',
  en: 'Yeast population growth & hemocytometer',
  lede: [
    '向锥形瓶培养液接种少量酵母菌：空间和营养有限时呈现“S”形逻辑斯谛增长，dN/dt = rN(1 − N/K) 在 N = K/2 时达到最大增长速率；理想条件下则为“J”形指数增长。',
    '定时振荡摇匀后用 25×16 规格血细胞计数板五点取样（四角加中央共 5 个中格 = 80 小格，遵循“计上不计下、计左不计右”压线原则），按 N = count₅ × 5 × 10⁴ × 稀释倍数 估算菌液密度。',
  ],
  formula: 'dN/dt = r·N·(1 − N/K) · N_菌液 = count_5中格 × 5 × 10⁴ × 稀释倍数 (个/mL)',
  formulaNote: 'K 为环境容纳量；K/2 处增长速率峰值 rK/4；对数后期菌液过密时须先稀释再上计数板',
  terms: [
    ['环境容纳量 K', '一定环境条件所能维持的种群最大数量（并非固定不变，受营养与代谢废物影响）。'],
    ['K/2 拐点', '此时基数与剩余环境空间乘积最大，增长速率 dN/dt 达到峰值 rK/4。'],
    ['25×16 计数板', '大方格体积 0.1 mm³ (10⁻⁴ mL)，含 25 个中格；五点抽样 5 个中格后乘以 5 即得大方格总数。'],
  ],
  predict: {
    q: '在“S”形增长曲线中，酵母菌种群增长速率 dN/dt 何时最快？',
    options: ['刚接种时（环境阻力最小）', '种群数量达到 K/2 时', '种群数量达到 K 值时'],
    answer: 1,
    why: '刚接种时 N 太小，快到 K 时 (1−N/K) 趋零；当 N = K/2 时，rN(1−N/K) 取得最大值 rK/4，即增长最快。',
  },
  challenge: '培养至接近 K/2 与 K 值两个时期，调整稀释倍数（如 10× 或 50×）避免菌体拥挤重叠，并在工作台完成血细胞计数板核算与曲线分期诊断！',
  fig: '锥形瓶酵母培养液、血细胞计数板微观五点视野与动态种群曲线',
  hint: '调节增长率 r、K 值、增长模式与稀释倍数；拖动时间滑块或开启自动培养推进，进入工作台查看 25×16 计数板五中格精细视野与增长速率诊断！',
  teach: {
    where: '人教版生物学选择性必修2第1章 §1.2《种群数量的变化 · 探究·实践：培养液中酵母菌种群数量的变化》',
    ask: [
      '从培养瓶中吸取培养液前为什么必须先充分振荡摇匀？静置直接从表层或底层吸取会导致什么误差？',
      '遇到压在计数中格四条边线上的酵母菌，为什么要坚持“计上不计下、计左不计右”？',
    ],
    simplify: '设初始接种量 N₀ = 50 万/mL，血细胞计数板大方格体积为 10⁻⁴ mL；计数细胞分布采用泊松抽样近似并忽略抱团误差。',
    safety: '显微镜盖玻片较薄，滴加菌液时先盖盖玻片再从边缘渗入，避免直接按压碎裂。',
  },
  controls: [
    { id: 'r', label: '内禀增长率 r', min: 0.15, max: 0.80, step: 0.05, value: 0.45, unit: '/h' },
    { id: 'K', label: '环境容纳量 K', min: 1000, max: 6000, step: 500, value: 4000, unit: '万/mL' },
    { id: 'mode', label: '培养生长条件', type: 'choice', options: ['资源有限(S形)', '理想条件(J形)', '含代谢废物衰退'], value: 0, wide: true },
    { id: 'dil', label: '计数板稀释倍数', type: 'choice', options: ['1× 原液', '10× 稀释', '50× 稀释', '100× 稀释'], value: 1, wide: true },
    { id: 't', label: '培养时间 t', min: 0, max: 32, step: 0.5, value: 8.0, unit: 'h' },
    { id: 'auto', label: '自动培养计时', type: 'toggle', value: false },
    { id: 'bGo', label: '重新接种(t=0)', type: 'button' },
  ],
  record: {
    note: '记录不同培养时刻与稀释倍数下的五中格计数、换算菌液密度 N_total 及所处生长时期。',
    pending: '采样某培养时刻后点击“记录一组”录入种群生长追踪表。',
    columns: [
      { key: 'modeName', label: '培养模式' },
      { key: 't', label: '时间 t', unit: 'h', digits: 1 },
      { key: 'dil', label: '稀释倍数', unit: '×', digits: 0 },
      { key: 'count5', label: '五中格计数', digits: 0 },
      { key: 'density', label: '换算密度', unit: '万/mL', digits: 0, stat: true },
      { key: 'phase', label: '生长时期' },
    ],
    sample: (inst) => {
      const s = inst?.snapshot?.();
      if (!s) return null;
      return {
        _kind: 'human',
        modeName: ['S形', 'J形', 'S+衰退'][s.mode],
        t: s.t,
        dil: s.dil,
        count5: s.sample.count5,
        density: s.nEst / 1e4,
        phase: s.phase,
      };
    },
    summary: (rows) => [
      ['已录入采样时刻', `${rows.length} 次`],
      ['峰值实测密度', rows.length ? `${Math.max(...rows.map((r) => r.density)).toFixed(0)} 万/mL` : '—'],
    ],
    errors: [
      '忘记乘以 5 和稀释倍数：25×16 规格测 5 个中格是整个大方格的 1/5，务必乘 5×10⁴×稀释倍数。',
      '高密度时未稀释直接计数：每中格超过 30 个菌体极易重叠漏数。',
    ],
  },

  build(k) {
    const p = k.p;
    const X = -2.15, Z = -1.1, TMAX = 32;
    const flask = at(group(
      glass(new THREE.CylinderGeometry(0.36, 1.48, 2.35, 44, 1, true).translate(0, 1.18, 0)),
      glass(new THREE.CylinderGeometry(0.36, 0.36, 0.78, 32, 1, true).translate(0, 2.75, 0)),
      glass(new THREE.CircleGeometry(1.48, 44).rotateX(-Math.PI / 2).translate(0, 0.03, 0)),
    ), X, 0.05, Z);
    const broth = flat(new THREE.CylinderGeometry(0.92, 1.40, 1.2, 44).translate(0, 0.65, 0), '#f4e3b0', { opacity: 0.3 });
    const yeast = dots(90, 0.068, '#e8b84a');
    for (let i = 0; i < 90; i++) yeast.put(i, 0, -50, 0, 0.001);
    const sRand = rng(202608);
    const seeds = Array.from({ length: 90 }, () => {
      const y = 0.16 + sRand() * 0.98;
      const rm = (1.38 - (y / 1.2) * 0.46) * 0.88;
      const a = sRand() * TAU, rr = Math.sqrt(sRand()) * rm;
      return [Math.cos(a) * rr, y, Math.sin(a) * rr];
    });
    flask.add(broth, yeast);

    const grid = at(sheet(2.65, 2.65, () => {}, { lay: 'tilt', ink: true, opaque: true }), 3.25, 0, 2.15);
    const g = at(plot({ w: 4.1, h: 3.0, xr: [0, TMAX], yr: [0, 6500], xl: '培养时间 / h', yl: '密度(万/mL)' }), 2.25, 0, -2.55);
    const info = at(card('\n', { w: 3.9, size: 0.28, align: 'left' }), -2.1, 0, 2.55);
    k.root.add(flask, grid, g, info);

    let lastKey = '';
    const getSnapshot = () => {
      const dil = DIL_FACTORS[p.dil ?? 1];
      const nTrue = yeastDensity(p.t, p.r, p.K, p.mode);
      const rate = yeastRate(p.t, p.r, p.K, p.mode);
      const phase = yeastPhase(p.t, p.r, p.K, p.mode);
      const seed = Math.round(p.t * 10) * 131 + p.dil * 37 + p.mode * 997 + Math.round(p.K);
      const sample = sampleFiveSquares(nTrue, dil, seed);
      const nEst = sample.count5 * 5 * 1e4 * dil; // 个/mL
      return { t: p.t, r: p.r, K: p.K, mode: p.mode, dil, nTrue, rate, phase, sample, nEst };
    };

    const drawScene = () => {
      const s = getSnapshot();
      const kStr = `${s.t.toFixed(1)}|${s.r}|${s.K}|${s.mode}|${s.dil}`;
      if (kStr === lastKey) return;
      lastKey = kStr;

      const shown = Math.round(clamp(s.nTrue / 6000, 0.02, 1) * 90);
      for (let i = 0; i < 90; i++) i < shown ? yeast.put(i, ...seeds[i]) : yeast.put(i, 0, -50, 0, 0.001);
      yeast.done();
      broth.material.opacity = 0.2 + clamp(s.nTrue / 6000, 0, 1) * 0.48;

      // 25×16 计数板五点抽样网格图
      grid.redraw((x, S, w, h) => {
        x.fillStyle = C.paper; x.fillRect(0, 0, w * S, h * S);
        const pad = 0.1 * w * S, size = 0.8 * w * S, cell = size / 5;
        // 高亮四角 + 中央 5 个抽样中格
        x.fillStyle = 'rgba(255, 181, 46, 0.16)';
        for (const [bx, by] of [[0, 0], [4, 0], [2, 2], [0, 4], [4, 4]]) {
          x.fillRect(pad + bx * cell, pad + by * cell, cell, cell);
        }
        x.strokeStyle = 'rgba(30,43,54,0.55)'; x.lineWidth = S * 0.015;
        for (let i = 0; i <= 5; i++) {
          const q = pad + i * cell;
          x.beginPath(); x.moveTo(q, pad); x.lineTo(q, pad + size); x.moveTo(pad, q); x.lineTo(pad + size, q); x.stroke();
        }
        x.fillStyle = '#e0a52a';
        for (const pt of s.sample.pts) {
          x.beginPath();
          x.arc(pad + (pt.bx + pt.lx) * cell, pad + (pt.by + pt.ly) * cell, S * 0.032, 0, TAU);
          x.fill();
        }
      });

      const yMaxPlot = Math.max(6500, p.K * 1.15);
      const pts = [];
      for (let i = 0; i <= 64; i++) {
        const tt = (s.t * i) / 64;
        pts.push([tt, Math.min(yMaxPlot, yeastDensity(tt, p.r, p.K, p.mode))]);
      }
      g.range([0, TMAX], [0, yMaxPlot]).clear();
      if (p.mode !== 1) {
        g.curve([[0, p.K], [TMAX, p.K]], C.violet, 0.03, true)
          .curve([[0, p.K / 2], [TMAX, p.K / 2]], 'rgba(30,43,54,0.3)', 0.02, true)
          .text(TMAX * 0.80, p.K * 1.04, 'K', '#5a3fd0')
          .text(TMAX * 0.76, p.K * 0.54, 'K/2');
      }
      g.curve(pts, C.leaf, 0.048).dot(s.t, Math.min(yMaxPlot, s.nTrue), C.amber, 0.08).done();

      info.set(
        `t=${s.t.toFixed(1)}h · N=${s.nTrue > 99999 ? '>10⁵' : s.nTrue.toFixed(0)} 万/mL\n`
        + `五中格=${s.sample.count5} (${s.dil}×) · ${s.phase}`,
      );
      this._s = s;
    };

    drawScene();

    return {
      snapshot: getSnapshot,
      press(id) {
        if (id === 'bGo' || id === 'go') { k.set('t', 0); lastKey = ''; drawScene(); k.dirty(); }
      },
      change() { lastKey = ''; drawScene(); k.dirty(); },
      update(dt) {
        if (p.auto) {
          const nt = p.t + dt * 2.0;
          k.set('t', nt >= TMAX ? 0 : Math.min(TMAX, nt));
          k.dirty();
        }
        drawScene();
      },
      margin() {
        const s = this._s || getSnapshot();
        return [
          `五中格计数 ${s.sample.count5} 个 (${s.dil}× 稀释)`,
          `推算 N = ${(s.nEst / 1e4).toFixed(0)} 万/mL`,
          `增长速率 ${s.rate.toFixed(0)} 万/(mL·h)`,
          p.mode === 0 ? `峰值 rK/4 = ${(p.r * p.K / 4).toFixed(0)} (在 K/2)` : s.phase,
          s.sample.crowded ? '⚠ 计数格过密，请调高稀释倍数' : '计数格密度适宜',
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 25×16 血细胞计数板（五点取样放大：计上不计下、计左不计右）与逻辑斯谛诊断');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn" data-act="step2">培养 +2.0 h</button>
      <button type="button" class="wb-btn" data-act="halfK">跳转至 K/2 (增长最快)</button>
      <button type="button" class="wb-btn" data-act="dil10">10× 稀释</button>
      <button type="button" class="wb-btn" data-act="dil50">50× 稀释</button>
      <button type="button" class="wb-btn" data-act="reset">重新接种 (t=0)</button>
      <button type="button" class="wb-btn primary" data-act="rec">记录本次计数</button>`;
    sec1.append(bar);

    const chart = wb.canvas(sec1, 520, 265, (x, W, H) => {
      const s = sp.inst?.snapshot?.();
      if (!s) return;
      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);

      // 左侧：25×16 计数板中一个代表性 4×4 中格精细微观图（带 16 小格及边界计数规则色标）
      const gx = 20, gy = 28, gs = 185;
      x.fillStyle = '#faf5e8'; x.fillRect(gx, gy, gs, gs);
      x.strokeStyle = 'rgba(30,43,54,0.28)'; x.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        x.beginPath(); x.moveTo(gx + (gs * i) / 4, gy); x.lineTo(gx + (gs * i) / 4, gy + gs); x.stroke();
        x.beginPath(); x.moveTo(gx, gy + (gs * i) / 4); x.lineTo(gx + gs, gy + (gs * i) / 4); x.stroke();
      }
      // 计入边（上、左绿实线）与不计边（下、右红虚线）
      x.strokeStyle = '#1f4a3e'; x.lineWidth = 2.4;
      x.beginPath(); x.moveTo(gx, gy + gs); x.lineTo(gx, gy); x.lineTo(gx + gs, gy); x.stroke();
      x.save(); x.strokeStyle = '#e5483f'; x.lineWidth = 2; x.setLineDash([4, 3]);
      x.beginPath(); x.moveTo(gx + gs, gy); x.lineTo(gx + gs, gy + gs); x.lineTo(gx, gy + gs); x.stroke();
      x.restore();

      // 展示中央中格 (2,2) 里的酵母菌及几个压线菌体示意
      const midPts = s.sample.pts.filter((q) => q.bx === 2 && q.by === 2);
      for (const q of midPts) {
        x.fillStyle = '#d99b26'; x.strokeStyle = '#1e2b36'; x.lineWidth = 0.8;
        x.beginPath(); x.arc(gx + q.lx * gs, gy + q.ly * gs, 3.8, 0, TAU); x.fill(); x.stroke();
      }
      x.fillStyle = '#1f4a3e'; x.font = '10.5px "Noto Serif SC",serif'; x.textAlign = 'left';
      x.fillText('绿线(上/左)：压线计入', gx, gy - 10);
      x.fillStyle = '#e5483f';
      x.fillText('红虚线(下/右)：压线不计', gx, gy + gs + 16);
      x.fillStyle = '#51606b';
      x.fillText(`五中格合计 = ${s.sample.count5} (${s.dil}×)`, gx, gy + gs + 32);

      // 右侧：种群密度 N(t)（绿线）与增长速率 dN/dt（橙虚线）双曲线
      const ox = 248, oy = 28, pw = 250, ph = 185;
      const yMax = Math.max(6500, s.K * 1.15);
      const sx = (t) => ox + (t / 32) * pw;
      const syN = (n) => oy + ph - clamp(n / yMax, 0, 1) * ph;
      const maxR = Math.max(100, s.r * s.K / 4 * 1.3);
      const syR = (rt) => oy + ph - clamp(rt / maxR, -0.2, 1) * (ph * 0.85);

      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.3;
      x.beginPath(); x.moveTo(ox, oy); x.lineTo(ox, oy + ph); x.lineTo(ox + pw, oy + ph); x.stroke();
      if (s.mode !== 1) {
        x.save(); x.strokeStyle = 'rgba(122,92,255,0.45)'; x.setLineDash([4, 4]);
        x.beginPath(); x.moveTo(ox, syN(s.K)); x.lineTo(ox + pw, syN(s.K)); x.stroke();
        x.beginPath(); x.moveTo(ox, syN(s.K / 2)); x.lineTo(ox + pw, syN(s.K / 2)); x.stroke();
        x.restore();
      }
      // 速率曲线 dN/dt
      x.save(); x.strokeStyle = '#ff6a3d'; x.lineWidth = 1.6; x.setLineDash([5, 3]); x.beginPath();
      for (let i = 0; i <= 80; i++) {
        const tt = (i / 80) * 32, rt = yeastRate(tt, s.r, s.K, s.mode);
        if (i === 0) x.moveTo(sx(tt), syR(rt)); else x.lineTo(sx(tt), syR(rt));
      }
      x.stroke(); x.restore();

      // N(t) 曲线
      x.strokeStyle = '#1f4a3e'; x.lineWidth = 2.3; x.beginPath();
      for (let i = 0; i <= 80; i++) {
        const tt = (i / 80) * 32, nn = yeastDensity(tt, s.r, s.K, s.mode);
        if (i === 0) x.moveTo(sx(tt), syN(nn)); else x.lineTo(sx(tt), syN(nn));
      }
      x.stroke();

      // 当前时刻点
      x.fillStyle = '#ffb52e'; x.strokeStyle = '#1e2b36'; x.lineWidth = 1.5;
      x.beginPath(); x.arc(sx(s.t), syN(s.nTrue), 5.5, 0, TAU); x.fill(); x.stroke();

      x.fillStyle = '#51606b'; x.font = '11px Georgia,serif'; x.textAlign = 'center';
      x.fillText('0h', ox, oy + ph + 15); x.fillText('16h', ox + pw / 2, oy + ph + 15); x.fillText('32h', ox + pw, oy + ph + 15);
      x.fillText('培养时间 t (h)', ox + pw / 2, oy + ph + 32);
      x.fillStyle = '#1f4a3e'; x.textAlign = 'left'; x.font = '11px "Noto Serif SC",serif';
      x.fillText('— 种群密度 N(t)', ox + 6, oy + 12);
      x.fillStyle = '#ff6a3d';
      x.fillText('--- 速率 dN/dt', ox + 112, oy + 12);
    });

    const statsEl = document.createElement('div');
    statsEl.className = 'wb-metrics';
    sec1.append(statsEl);

    let lastKey = '';
    const refresh = (force = false) => {
      const s = sp.inst?.snapshot?.();
      if (!s) return;
      const kStr = `${s.t.toFixed(1)}|${s.r}|${s.K}|${s.mode}|${s.dil}`;
      if (!force && kStr === lastKey) return;
      lastKey = kStr;
      chart.redraw();
      statsEl.innerHTML = `
        <div class="wb-m"><span>五中格总数 count₅</span><b>${s.sample.count5} 个 (${s.dil}× 稀释)</b></div>
        <div class="wb-m"><span>公式推算 N_total</span><b>${sig(s.nEst, 3)} 个/mL</b></div>
        <div class="wb-m"><span>瞬时增长速率 dN/dt</span><b>${s.rate.toFixed(0)} 万/(mL·h)</b></div>
        <div class="wb-m"><span>增长时期诊断</span><b>${s.phase}</b></div>`;
    };

    bar.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (!act) return;
      const p = sp.params;
      if (act === 'step2') wb.setParam('t', clamp(p.t + 2.0, 0, 32));
      else if (act === 'halfK') {
        // S 形达 K/2 的解析时间 t_half = ln((K-N0)/N0) / r
        const tHalf = Math.log((p.K - N0_YEAST) / N0_YEAST) / p.r;
        wb.setParam('mode', 0);
        wb.setParam('t', clamp(Math.round(tHalf * 2) / 2, 0, 32));
      } else if (act === 'dil10') wb.setParam('dil', 1);
      else if (act === 'dil50') wb.setParam('dil', 2);
      else if (act === 'reset') wb.press('bGo');
      else if (act === 'rec') {
        const row = population.record.sample(sp.inst, sp.params);
        if (row) wb.record(row);
      }
      refresh(true);
    });

    refresh(true);
    return { update() { refresh(false); } };
  },
};

export default [
  microscopeMitosis,
  plasmolysis,
  enzyme,
  pigments,
  photosynthesis,
  mendel,
  dna,
  population,
];
