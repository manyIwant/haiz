// HAIZ · EXPERIMENTARIUM — 信息技术与通用技术实验包（L3 全四项：二进制补码与点阵、五种排序复杂度、等面积梁弯曲、PID 水位控制）
import {
  C, TAU, clamp, lerp, group, at, rot, box, cyl, ball, rod, wire, tube,
  solid, flat, glass, dash, glow, note, card, plot, liquid, sheet, freshGroup, THREE,
} from '../core/ink.js';
import { solveBeamDeflection } from '../core/science-models.js';
import { rng, linearRegression, sampleStats } from '../core/epistemic.js';

const toSigned8 = (v) => ((v & 255) >= 128 ? (v & 255) - 256 : (v & 255));
const fmtBin8 = (v) => (v & 255).toString(2).padStart(8, '0').replace(/(.{4})/, '$1 ');
const fmtHex8 = (v) => '0x' + (v & 255).toString(16).toUpperCase().padStart(2, '0');
const fmtAscii = (v) => (v >= 33 && v <= 126 ? `“${String.fromCharCode(v)}”` : v === 32 ? '空格 (SPC)' : '控制/非ASCII');

const BITMAP_PRESETS = {
  A: [0x18, 0x24, 0x42, 0x7e, 0x42, 0x42, 0x42, 0x00],
  heart: [0x66, 0xff, 0xff, 0xff, 0x7e, 0x3c, 0x18, 0x00],
  smile: [0x3c, 0x42, 0xa5, 0x81, 0xa5, 0x99, 0x42, 0x3c],
  zhong: [0x18, 0x7e, 0x5a, 0x5a, 0x7e, 0x18, 0x18, 0x18],
};

// ================================================================ 1. 二进制、补码溢出与点阵图像编码
export const binary = {
  id: 'it-binary',
  subject: 'it',
  title: '二进制、补码溢出与点阵图像编码',
  en: 'Binary, two’s complement & bitmap encoding',
  lede: [
    '计算机用高低电平的开关（1 与 0）存储一切。拨动八枚机械开关 b₇..b₀：无符号模式下它表示 0..255；切换至有符号补码模式，最高位 b₇ 的权变为 −128，表示范围变为 −128..127。',
    '试着在 +127 时再按一次“加 1”，观察符号位翻转触发的补码溢出标志（OF）；再去工作台用 8 字节十六进制编码一幅 8×8 像素点阵字模。',
  ],
  formula: 'V_u = ∑ bᵢ·2ⁱ · V_s = −b₇·2⁷ + ∑_{i=0..6} bᵢ·2ⁱ',
  formulaNote: '8 位无符号范围 [0, 255]；8 位二补码范围 [−128, 127]，超出边界即产生溢出截断与回绕',
  terms: [
    ['二补码（Two’s Complement）', '负数用“按位取反再加 1”编码，使减法统一为加法，最高位权为 −2ⁿ⁻¹'],
    ['溢出标志（OF / CF）', 'OF 指示有符号补码运算越界（如 +127+1→−128）；CF 指示无符号最高位进/借位'],
    ['点阵字节编码', '8×8 单色点阵的每一行恰好由 8 个像素（1 Byte）表示，8 行共占 8 字节'],
  ],
  predict: {
    q: '在 8 位有符号补码（−128..127）下，0111 1111（+127）再加 1，结果和标志位会怎样？',
    options: [
      '变成 +128，不溢出',
      '变成 1000 0000（即 −128），触发有符号溢出标志 OF = 1',
      '保持 +127 不变（饱和截断）',
    ],
    answer: 1,
    why: '8 位补码最大正数是 0111 1111（+127）。加 1 后进位进入符号位变成 1000 0000，按补码权值 −128 + 0 = −128，发生正溢出回绕（OF = 1）。',
  },
  challenge: '切到“有符号补码”模式，拨出 +127 后按“加 1 (+1)”触发 OF 报警灯；再打开工作台绘制自定义 8×8 图案并把其中一行字节载入 3D 开关！',
  fig: '8 位机械拨动开关阵（b₇..b₀）、信号灯与溢出警示灯',
  hint: '直接点按任意开关拨杆或灯泡翻转该位；切换无符号/补码观察 b₇ 位权（128 ↔ −128）变化与溢出回绕。',
  teach: {
    where: '普通高中信息技术 必修 1《数据与计算》· 第一章 1.2 数据的计算与编码（数制、补码与图像数字化）',
    ask: [
      '为什么 8 位二进制只比 7 位多 1 个开关，表示的数值个数却翻了一倍？',
      '在补码下 1111 1111（−1）加 1 变成 0000 0000（0），此时无符号进位 CF = 1，但有符号溢出 OF 为什么等于 0？',
      '一幅 8×8 黑白点阵图像至少需要多少字节？若扩展为 256 级灰度（8 bit/像素）又需要多少字节？',
    ],
    simplify: '固定 8 位寄存器字长（byte），按硬件算术逻辑单元（ALU）模 256 截断；点阵编码器采用 MSB 在左的逐行扫描格式。',
  },
  controls: [
    { id: 'mode', type: 'choice', label: '编码模式', options: ['无符号 (0..255)', '有符号补码 (−128..127)'], value: 0 },
    { id: 'v', label: '8位寄存器原始码', min: 0, max: 255, step: 1, value: 72 },
    { id: 'inc', type: 'button', label: '加 1 (+1)' },
    { id: 'dec', type: 'button', label: '减 1 (−1)' },
    { id: 'shl', type: 'button', label: '左移 ×2' },
    { id: 'shr', type: 'button', label: '右移 ÷2' },
    { id: 'not', type: 'button', label: '按位取反 (~)' },
    { id: 'neg', type: 'button', label: '补码求反 (−x)' },
  ],
  record: {
    note: '记录不同编码模式下的 8 位二进制码、数值、算术溢出（OF/CF）现象或点阵编码字节。',
    pending: '操作机械开关、加减按钮或在工作台记录点阵编码后，点击“记一组数据”归档。',
    columns: [
      { key: 'modeName', label: '编码模式' },
      { key: 'bin', label: '二进制 b₇..b₀' },
      { key: 'hex', label: '十六进制' },
      { key: 'decVal', label: '十进制真值', digits: 0, stat: true },
      { key: 'flags', label: '溢出标志' },
      { key: 'noteStr', label: 'ASCII / 说明' },
    ],
    sample: (inst, p) => {
      const s = inst.snapshot();
      return {
        _kind: 'human',
        modeName: p.mode ? '有符号补码' : '无符号',
        bin: fmtBin8(s.v),
        hex: fmtHex8(s.v),
        decVal: p.mode ? toSigned8(s.v) : s.v,
        flags: `OF=${s.of ? 1 : 0} CF=${s.cf ? 1 : 0}`,
        noteStr: s.opNote || fmtAscii(s.v),
      };
    },
    summary: (rows) => [
      ['已记录状态数', `${rows.length} 条`],
      ['触发溢出次数', `${rows.filter((r) => String(r.flags).includes('1')).length} 次`],
    ],
    errors: [
      '混淆无符号进位（CF）与有符号溢出（OF）：−1 + 1 = 0 产生进位 CF=1 但补码运算完全正确（OF=0）。',
      '误以为补码“左移/右移”总是严格乘除 2：符号位改变时左移已溢出；有符号右移需保持符号位（算术右移）。',
    ],
  },

  build(k) {
    const p = k.p;
    const Z = -0.75, DX = 1.06, X0 = -3.5 * DX;
    // 仪器底座与铜质总线背板
    k.root.add(
      at(box(9.4, 0.28, 2.5, '#e8e4d8', { kind: 'card' }), 0, 0, Z + 0.1),
      at(box(9.0, 0.08, 0.14, C.copper, { kind: 'metal' }), 0, 0.28, Z - 0.55),
      at(note('8 位机械开关阵  b₇ ────────────── b₀', { size: 0.24, w: 7.4, color: C.copper }), 0, 0.03, Z + 1.55),
    );

    const switches = Array.from({ length: 8 }, (_, i) => {
      const x = X0 + i * DX;
      const bit = 7 - i;
      const baseSock = at(box(0.62, 0.18, 0.85, '#cfd6dc', { kind: 'metal' }), x, 0.28, Z + 0.35);
      const pivot = group();
      pivot.position.set(x, 0.44, Z + 0.35);
      const lever = at(cyl(0.055, 0.62, C.copper, { seg: 14, kind: 'metal' }), 0, 0, 0);
      const cap = at(ball(0.11, bit === 7 ? C.flame : '#d9b36a'), 0, 0.65, 0);
      pivot.add(lever, cap);

      const post = at(cyl(0.16, 0.48, '#d8dde1', { seg: 16, kind: 'metal' }), x, 0.28, Z - 0.35);
      const bulb = at(ball(0.32), x, 1.08, Z - 0.35);
      const halo = at(glow(C.amber, 2.0, 0), x, 1.08, Z - 0.35);
      const digit = at(note('0', { size: 0.44, bold: true, w: 0.6 }), x, 1.88, Z - 0.35);
      const bitTag = at(note(`b${bit}`, { size: 0.22, lay: 'flat', color: bit === 7 ? C.copper : C.ink }), x, 0.03, Z + 0.96);
      const weightTag = at(note(String(1 << bit), { size: 0.24, lay: 'flat', color: C.ink }), x, 0.03, Z + 1.24);

      const hit = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.4, 1.4), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(x, 0.85, Z + 0.05);
      hit.layers.set(1);

      k.root.add(baseSock, pivot, post, bulb, halo, digit, bitTag, weightTag, hit);
      const toggleBit = () => {
        const nv = (p.v ^ (1 << bit)) & 255;
        ofFlag = false; cfFlag = false;
        opNote = `拨动 b${bit} (${(p.v >> bit) & 1} → ${(nv >> bit) & 1})`;
        k.set('v', nv);
        k.dirty();
      };
      k.drag(hit, { start: toggleBit });
      return { bit, pivot, bulb, halo, digit, weightTag, ang: 0 };
    });

    // 溢出警示 LED 塔（OF / CF）
    const ovLed = at(ball(0.24), -3.85, 2.15, Z - 0.35);
    const ovHalo = at(glow(C.red, 1.8, 0), -3.85, 2.15, Z - 0.35);
    const ovLabel = at(note('OF 正常', { size: 0.24, w: 1.8, color: C.ink }), -3.85, 2.65, Z - 0.35);
    k.root.add(at(cyl(0.08, 1.85, '#cfd6dc', { seg: 12, kind: 'metal' }), -3.85, 0.28, Z - 0.35), ovLed, ovHalo, ovLabel);

    // 3D 数字读数卡片
    const readout = sheet(4.5, 1.65, () => {}, {});
    readout.position.set(0.35, 1.35, 1.95);
    readout.rotation.x = -0.62;
    k.root.add(readout);

    let ofFlag = false, cfFlag = false, opNote = '点击开关或滑杆改变数值', lastPaint = '';

    const runOp = (id) => {
      const oldV = p.v & 255;
      const oldS = toSigned8(oldV);
      let nv = oldV;
      ofFlag = false; cfFlag = false;
      if (id === 'inc') {
        nv = (oldV + 1) & 255;
        cfFlag = oldV === 255;
        ofFlag = oldV === 127; // +127 + 1 -> -128
        opNote = p.mode
          ? `${oldS} + 1 = ${toSigned8(nv)}${ofFlag ? ' ⚠ 补码正溢出！' : ''}`
          : `${oldV} + 1 = ${nv}${cfFlag ? ' ⚠ 无符号进位回绕！' : ''}`;
      } else if (id === 'dec') {
        nv = (oldV - 1) & 255;
        cfFlag = oldV === 0;
        ofFlag = oldV === 128; // -128 - 1 -> +127
        opNote = p.mode
          ? `${oldS} − 1 = ${toSigned8(nv)}${ofFlag ? ' ⚠ 补码负溢出！' : ''}`
          : `${oldV} − 1 = ${nv}${cfFlag ? ' ⚠ 无符号借位回绕！' : ''}`;
      } else if (id === 'shl') {
        nv = (oldV << 1) & 255;
        cfFlag = !!(oldV & 0x80);
        ofFlag = !!(((oldV >> 7) & 1) ^ ((oldV >> 6) & 1));
        opNote = p.mode
          ? `左移 ×2：${oldS} → ${toSigned8(nv)}${ofFlag ? ' ⚠ 符号翻转溢出！' : ''}`
          : `左移 ×2：${oldV} → ${nv}${cfFlag ? ' ⚠ 最高位丢弃(CF=1)' : ''}`;
      } else if (id === 'shr') {
        if (p.mode) {
          // 算术右移保留符号位
          nv = ((oldV >> 1) | (oldV & 0x80)) & 255;
          opNote = `算术右移 ÷2：${oldS} → ${toSigned8(nv)}`;
        } else {
          nv = (oldV >> 1) & 255;
          opNote = `逻辑右移 ÷2：${oldV} → ${nv}`;
        }
      } else if (id === 'not') {
        nv = (~oldV) & 255;
        opNote = `按位取反 ~(${fmtBin8(oldV)})`;
      } else if (id === 'neg') {
        nv = ((~oldV) + 1) & 255;
        ofFlag = oldV === 128; // -(-128) = -128 溢出
        opNote = `补码求反 −(${oldS}) = ${toSigned8(nv)}${ofFlag ? ' ⚠ −128无对应正数！' : ''}`;
      }
      k.set('v', nv);
      k.dirty();
    };

    const paintReadout = () => {
      const v = p.v & 255;
      const sv = toSigned8(v);
      const isSigned = !!p.mode;
      const activeOv = isSigned ? ofFlag : cfFlag;
      const key = `${v}|${isSigned}|${ofFlag}|${cfFlag}|${opNote}`;
      if (key === lastPaint) return;
      lastPaint = key;

      switches[0].weightTag.set(isSigned ? '−128' : '128');
      ovLed.material.color.set(activeOv ? C.red : '#88a898');
      ovLabel.set(activeOv ? (isSigned ? '⚠ 补码溢出 OF=1' : '⚠ 进借位 CF=1') : (isSigned ? 'OF=0 正常' : 'CF=0 正常'));

      readout.redraw((x, s, w, h) => {
        x.fillStyle = activeOv ? '#fff3f0' : '#fffdf7';
        x.fillRect(0, 0, w * s, h * s);
        x.strokeStyle = activeOv ? C.red : C.ink;
        x.lineWidth = s * (activeOv ? 0.045 : 0.028);
        x.strokeRect(0.03 * s, 0.03 * s, (w - 0.06) * s, (h - 0.06) * s);
        x.textBaseline = 'top';
        x.fillStyle = C.ink;
        x.font = `700 ${s * 0.25}px Georgia,serif`;
        const valText = isSigned ? `有符号补码：${sv >= 0 ? '+' : ''}${sv}` : `无符号整数：${v}`;
        x.fillText(valText, 0.16 * s, 0.12 * s);
        x.fillStyle = '#51606b';
        x.font = `${s * 0.17}px monospace`;
        x.fillText(`BIN ${fmtBin8(v)}   HEX ${fmtHex8(v)}`, 0.16 * s, 0.50 * s);
        x.font = `${s * 0.155}px "Songti SC",serif`;
        x.fillText(`无符号=${v} | 补码=${sv} | ASCII=${fmtAscii(v)}`, 0.16 * s, 0.84 * s);
        x.fillStyle = activeOv ? C.red : '#1f4a3e';
        x.font = `600 ${s * 0.15}px "Songti SC",serif`;
        x.fillText(`${opNote}  [OF=${ofFlag ? 1 : 0}, CF=${cfFlag ? 1 : 0}]`, 0.16 * s, 1.18 * s);
      });
    };

    paintReadout();
    return {
      snapshot: () => ({ v: p.v & 255, sv: toSigned8(p.v & 255), of: ofFlag, cf: cfFlag, opNote }),
      press(id) { runOp(id); },
      change(id) {
        if (id === 'v' || id === 'mode') {
          if (id === 'v') { ofFlag = false; cfFlag = false; opNote = '滑杆/点阵同步更新'; }
          paintReadout();
          k.dirty();
        }
      },
      update(dt) {
        const v = p.v & 255;
        const isSigned = !!p.mode;
        const activeOv = isSigned ? ofFlag : cfFlag;
        const kLerp = dt > 0 ? 1 - Math.exp(-dt * 14) : 1;
        switches.forEach((sw) => {
          const on = (v >> sw.bit) & 1;
          const targetAng = on ? -0.52 : 0.52;
          sw.ang = lerp(sw.ang, targetAng, kLerp);
          sw.pivot.rotation.x = sw.ang;
          sw.bulb.material.color.set(on ? (isSigned && sw.bit === 7 ? C.flame : '#ffd76a') : C.paper);
          sw.halo.material.opacity = lerp(sw.halo.material.opacity, on ? 0.72 : 0, kLerp);
          sw.digit.set(String(on));
        });
        ovHalo.material.opacity = lerp(ovHalo.material.opacity, activeOv ? 0.85 : 0.0, kLerp);
        paintReadout();
      },
      margin() {
        const v = p.v & 255;
        const sv = toSigned8(v);
        const terms = [];
        for (let b = 7; b >= 0; b--) {
          if ((v >> b) & 1) terms.push(p.mode && b === 7 ? '−128' : String(1 << b));
        }
        return [
          p.mode ? `补码值 = ${sv}` : `无符号 = ${v}`,
          terms.length ? `= ${terms.join('+')}` : '= 0',
          `Hex ${fmtHex8(v)}`,
          `OF=${ofFlag ? 1 : 0}  CF=${cfFlag ? 1 : 0}`,
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    // 1. 补码数环与开关协同区
    const sec1 = wb.section('1 · 8位二进制 / 补码溢出回绕数环（点击比特块或运算按钮）');
    const swRow = document.createElement('div');
    swRow.className = 'wb-btn-row';
    const actRow = document.createElement('div');
    actRow.className = 'wb-btn-row';
    actRow.innerHTML = `
      <button type="button" class="wb-btn" data-op="mode">切换 无符号/补码</button>
      <button type="button" class="wb-btn" data-op="set127">置 +127 (0x7F)</button>
      <button type="button" class="wb-btn" data-op="setM128">置 −128 (0x80)</button>
      <button type="button" class="wb-btn" data-op="inc">+1</button>
      <button type="button" class="wb-btn" data-op="dec">−1</button>
      <button type="button" class="wb-btn" data-op="neg">求反 (−x)</button>
      <button type="button" class="wb-btn primary" data-op="rec">记入实验记录</button>`;
    sec1.append(swRow, actRow);

    const ringCv = wb.canvas(sec1, 520, 175, (x, W, H) => {
      const p = sp.params;
      const v = (p.v ?? 0) & 255;
      const sv = toSigned8(v);
      const isSigned = !!p.mode;
      const snap = sp.inst?.snapshot?.() || { of: false, cf: false, opNote: '' };

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      // 绘制 8-bit 模 256 圆形时钟码盘
      const cx = 110, cy = H / 2, R = 64;
      x.strokeStyle = '#d8d0be'; x.lineWidth = 10;
      x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.stroke();
      // 补码正负分界线 (0 与 127/128)
      const ang = -Math.PI / 2 + (v / 256) * TAU;
      if (isSigned) {
        x.strokeStyle = 'rgba(229,72,63,0.45)'; x.lineWidth = 2; x.setLineDash([4, 3]);
        x.beginPath(); x.moveTo(cx, cy + R + 12); x.lineTo(cx, cy - R - 12); x.stroke(); x.setLineDash([]);
        x.fillStyle = '#b4653a'; x.font = '10px Georgia,serif'; x.textAlign = 'center';
        x.fillText('0 / 255', cx, cy - R - 16);
        x.fillStyle = '#e5483f';
        x.fillText('+127 | −128 溢出界', cx, cy + R + 21);
      } else {
        x.fillStyle = '#51606b'; x.font = '10px Georgia,serif'; x.textAlign = 'center';
        x.fillText('0 / 256 (CF界)', cx, cy - R - 16);
        x.fillText('128', cx, cy + R + 20);
      }
      x.strokeStyle = (isSigned ? snap.of : snap.cf) ? '#e5483f' : '#1f4a3e';
      x.lineWidth = 3;
      x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(ang) * (R - 4), cy + Math.sin(ang) * (R - 4)); x.stroke();
      x.fillStyle = (isSigned ? snap.of : snap.cf) ? '#e5483f' : '#1f4a3e';
      x.beginPath(); x.arc(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R, 5.5, 0, TAU); x.fill();

      // 右侧数值与位权拆解面板
      const rx = 215;
      x.textAlign = 'left'; x.fillStyle = '#1e2b36';
      x.font = 'bold 17px Georgia,serif';
      x.fillText(isSigned ? `有符号补码：${sv}  (原始码 ${v})` : `无符号整数：${v}  (若看作补码=${sv})`, rx, 34);
      x.font = '13px monospace'; x.fillStyle = '#33424e';
      x.fillText(`BIN: ${fmtBin8(v)}   HEX: ${fmtHex8(v)}   ASCII: ${fmtAscii(v)}`, rx, 62);
      x.font = '12.5px "Noto Serif SC",serif';
      const ov = isSigned ? snap.of : snap.cf;
      x.fillStyle = ov ? '#d93829' : '#1f4a3e';
      x.fillText(`状态：${snap.opNote || '正常'}   [OF=${snap.of ? 1 : 0}  CF=${snap.cf ? 1 : 0}]`, rx, 92);
      x.fillStyle = '#51606b'; x.font = '11.5px "Noto Serif SC",serif';
      x.fillText('提示：数环顺时针为 +1；跨越底部红线 (+127 ↔ −128) 即触发有符号溢出 OF=1。', rx, 126);
      x.fillText('跨越顶部 0 点 (255 ↔ 0) 触发无符号进借位 CF=1。', rx, 146);
    });

    const renderSwitches = () => {
      const v = (sp.params.v ?? 0) & 255;
      const isSigned = !!sp.params.mode;
      swRow.innerHTML = '';
      for (let b = 7; b >= 0; b--) {
        const on = (v >> b) & 1;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `wb-btn${on ? ' primary' : ''}`;
        const w = isSigned && b === 7 ? '−128' : String(1 << b);
        btn.textContent = `b${b}=${on} (${w})`;
        btn.addEventListener('click', () => {
          wb.setParam('v', v ^ (1 << b));
          refresh();
        });
        swRow.append(btn);
      }
    };

    // 2. 8×8 点阵像素字节十六进制编码器
    const sec2 = wb.section('2 · 8×8 点阵像素编码器（左键点击/拖涂像素，右侧同步生成 8 字节十六进制字模）');
    const bmBar = document.createElement('div');
    bmBar.className = 'wb-btn-row';
    bmBar.innerHTML = `
      <button type="button" class="wb-btn" data-bm="A">字模 “A”</button>
      <button type="button" class="wb-btn" data-bm="zhong">字模 “中”</button>
      <button type="button" class="wb-btn" data-bm="heart">心形 ♥</button>
      <button type="button" class="wb-btn" data-bm="smile">笑脸 ☺</button>
      <button type="button" class="wb-btn" data-bm="invert">反色</button>
      <button type="button" class="wb-btn" data-bm="clear">全清 0x00</button>`;
    sec2.append(bmBar);

    const gridBytes = BITMAP_PRESETS.A.slice();
    let selectedRow = 0;
    let paintMode = 1;
    let painting = false;

    const bmCv = wb.canvas(sec2, 520, 232, (x, W, H) => {
      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      const gx = 24, gy = 18, cell = 24;
      // 8x8 像素网格
      for (let r = 0; r < 8; r++) {
        const byteVal = gridBytes[r] & 255;
        const isSel = r === selectedRow;
        if (isSel) {
          x.fillStyle = 'rgba(180,101,58,0.12)';
          x.fillRect(gx - 6, gy + r * cell - 1, 8 * cell + 280, cell + 2);
        }
        for (let c = 0; c < 8; c++) {
          const bit = 7 - c;
          const on = (byteVal >> bit) & 1;
          const px = gx + c * cell, py = gy + r * cell;
          x.fillStyle = on ? '#1e2b36' : '#f4efe2';
          x.fillRect(px + 1, py + 1, cell - 2, cell - 2);
          x.strokeStyle = '#c8bfaa'; x.lineWidth = 1;
          x.strokeRect(px + 1, py + 1, cell - 2, cell - 2);
        }
        // 右侧逐行二进制 + 十六进制 + 十进制字节
        const tx = gx + 8 * cell + 16;
        const ty = gy + r * cell + cell / 2 + 4;
        x.fillStyle = isSel ? '#b4653a' : '#1e2b36';
        x.font = `${isSel ? 'bold ' : ''}12px monospace`;
        x.textAlign = 'left';
        x.fillText(`R${r}: ${fmtBin8(byteVal)}  ${fmtHex8(byteVal)}  (${String(byteVal).padStart(3, ' ')})`, tx, ty);
      }
      // 底部十六进制数组总览 + 实际尺寸缩略图
      const hexSeq = gridBytes.map((b) => fmtHex8(b)).join(', ');
      x.fillStyle = '#1f4a3e'; x.font = 'bold 12px monospace';
      x.fillText(`BYTE[8] = { ${hexSeq} }`, gx, H - 10);

      // 真实小尺寸点阵预览框
      const px0 = 468, py0 = 24, ps = 4;
      x.strokeStyle = '#1e2b36'; x.strokeRect(px0 - 4, py0 - 4, 8 * ps + 8, 8 * ps + 8);
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if ((gridBytes[r] >> (7 - c)) & 1) {
            x.fillStyle = '#1e2b36';
            x.fillRect(px0 + c * ps, py0 + r * ps, ps, ps);
          }
        }
      }
      x.fillStyle = '#51606b'; x.font = '10px "Noto Serif SC",serif';
      x.fillText('1:1预览', px0 - 2, py0 + 8 * ps + 18);
      x.fillText('点行同步', px0 - 4, py0 + 8 * ps + 34);
      x.fillText('到3D开关', px0 - 4, py0 + 8 * ps + 48);
    });

    const handleBitmapPointer = (e, isDown) => {
      const pt = bmCv.toLocal(e);
      const gx = 24, gy = 18, cell = 24;
      const r = Math.floor((pt.y - gy) / cell);
      const c = Math.floor((pt.x - gx) / cell);
      if (r < 0 || r >= 8) return;
      selectedRow = r;
      if (c >= 0 && c < 8) {
        const mask = 1 << (7 - c);
        if (isDown) paintMode = (gridBytes[r] & mask) ? 0 : 1;
        if (paintMode) gridBytes[r] |= mask; else gridBytes[r] &= ~mask;
      }
      wb.setParam('v', gridBytes[r] & 255);
      bmCv.redraw();
      refresh();
    };

    const onUp = () => { painting = false; };
    bmCv.cv.addEventListener('pointerdown', (e) => { painting = true; handleBitmapPointer(e, true); });
    bmCv.cv.addEventListener('pointermove', (e) => { if (painting) handleBitmapPointer(e, false); });
    window.addEventListener('pointerup', onUp);
    wb.onCleanup(() => window.removeEventListener('pointerup', onUp));

    bmBar.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.bm;
      if (!act) return;
      if (act === 'clear') gridBytes.fill(0);
      else if (act === 'invert') for (let i = 0; i < 8; i++) gridBytes[i] = (~gridBytes[i]) & 255;
      else if (BITMAP_PRESETS[act]) BITMAP_PRESETS[act].forEach((b, i) => { gridBytes[i] = b; });
      wb.setParam('v', gridBytes[selectedRow] & 255);
      bmCv.redraw();
      refresh();
    });

    actRow.addEventListener('click', (e) => {
      const op = e.target.closest('button')?.dataset.op;
      if (!op) return;
      if (op === 'mode') wb.setParam('mode', sp.params.mode ? 0 : 1);
      else if (op === 'set127') wb.setParam('v', 127);
      else if (op === 'setM128') wb.setParam('v', 128);
      else if (op === 'rec') wb.record(binary.record.sample(sp.inst, sp.params));
      else wb.press(op);
      refresh();
    });

    const refresh = () => {
      renderSwitches();
      ringCv.redraw();
      bmCv.redraw();
    };
    refresh();
    return { update() { refresh(); } };
  },
};

// ================================================================ 2. 排序算法、自定义输入与复杂度实测
const SORT_ALGS = ['冒泡排序', '选择排序', '插入排序', '归并排序', '快速排序'];
const INPUT_KINDS = ['随机序列', '已排序（正序）', '完全逆序'];

function makeSortInput(n, kindIdx, seed = 1024) {
  if (kindIdx === 1) return Array.from({ length: n }, (_, i) => i + 1);
  if (kindIdx === 2) return Array.from({ length: n }, (_, i) => n - i);
  const arr = Array.from({ length: n }, (_, i) => i + 1);
  const r = rng(seed);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function runSortAlgorithm(algIdx, inputArr, recordEvents = false) {
  const a = inputArr.slice();
  const n = a.length;
  const ids = recordEvents ? a.map((_, i) => i) : null;
  const out = recordEvents ? [] : null;
  let comps = 0, swaps = 0;

  const cmp = (i, j) => {
    comps++;
    if (recordEvents) out.push(['c', ids[i], ids[j]]);
    return a[i] > a[j];
  };
  const swap = (i, j) => {
    if (i === j) return;
    swaps++;
    [a[i], a[j]] = [a[j], a[i]];
    if (recordEvents) {
      [ids[i], ids[j]] = [ids[j], ids[i]];
      out.push(['s', i, j, ids[i], ids[j]]);
    }
  };

  if (algIdx === 0) {
    // 冒泡排序（标准无提前终止）
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < n - 1 - i; j++) {
        if (cmp(j, j + 1)) swap(j, j + 1);
      }
      if (recordEvents) out.push(['f', ids[n - 1 - i]]);
    }
    if (recordEvents && n > 0) out.push(['f', ids[0]]);
  } else if (algIdx === 1) {
    // 选择排序
    for (let i = 0; i < n - 1; i++) {
      let m = i;
      for (let j = i + 1; j < n; j++) {
        if (cmp(m, j)) m = j;
      }
      swap(i, m);
      if (recordEvents) out.push(['f', ids[i]]);
    }
    if (recordEvents && n > 0) out.push(['f', ids[n - 1]]);
  } else if (algIdx === 2) {
    // 插入排序
    for (let i = 1; i < n; i++) {
      for (let j = i; j > 0 && cmp(j - 1, j); j--) swap(j - 1, j);
    }
    if (recordEvents) for (let i = 0; i < n; i++) out.push(['f', ids[i]]);
  } else if (algIdx === 3) {
    // 归并排序（自顶向下）
    const tmpA = new Array(n);
    const tmpId = recordEvents ? new Array(n) : null;
    const ms = (lo, hi) => {
      if (lo >= hi) return;
      const mid = (lo + hi) >> 1;
      ms(lo, mid);
      ms(mid + 1, hi);
      if (recordEvents) out.push(['stage', ids.slice(lo, hi + 1)]);
      const isFinal = lo === 0 && hi === n - 1;
      let i = lo, j = mid + 1, k = lo;
      while (i <= mid && j <= hi) {
        comps++;
        if (recordEvents) out.push(['c', ids[i], ids[j]]);
        if (a[i] <= a[j]) {
          tmpA[k] = a[i];
          swaps++;
          if (recordEvents) { tmpId[k] = ids[i]; out.push(['w', k, ids[i], isFinal]); }
          i++; k++;
        } else {
          tmpA[k] = a[j];
          swaps++;
          if (recordEvents) { tmpId[k] = ids[j]; out.push(['w', k, ids[j], isFinal]); }
          j++; k++;
        }
      }
      while (i <= mid) {
        tmpA[k] = a[i]; swaps++;
        if (recordEvents) { tmpId[k] = ids[i]; out.push(['w', k, ids[i], isFinal]); }
        i++; k++;
      }
      while (j <= hi) {
        tmpA[k] = a[j]; swaps++;
        if (recordEvents) { tmpId[k] = ids[j]; out.push(['w', k, ids[j], isFinal]); }
        j++; k++;
      }
      for (let q = lo; q <= hi; q++) {
        a[q] = tmpA[q];
        if (recordEvents) ids[q] = tmpId[q];
      }
    };
    ms(0, n - 1);
  } else {
    // 快速排序（Lomuto 最右端基准划分）
    const qs = (lo, hi) => {
      if (lo >= hi) {
        if (lo === hi && recordEvents) out.push(['f', ids[lo]]);
        return;
      }
      let s = lo;
      for (let j = lo; j < hi; j++) {
        if (cmp(hi, j)) { swap(s, j); s++; }
      }
      swap(s, hi);
      if (recordEvents) out.push(['f', ids[s]]);
      qs(lo, s - 1);
      qs(s + 1, hi);
    };
    qs(0, n - 1);
  }

  return { comps, swaps, events: out, sorted: a };
}

export const sorting = {
  id: 'it-sort',
  subject: 'it',
  title: '排序算法、自定义输入与复杂度实测',
  en: 'Sorting algorithms & empirical complexity',
  lede: [
    '十根高低不一的木条，分别交由冒泡、选择、插入、归并与快速排序五种算法整理。同一组数据在不同输入形态（随机、正序、逆序）下，比较与移动次数天差地别。',
    '在实验台上输入自定义序列单步前后回溯，并一键实测 n = 10..200 规模的真实比较次数，亲眼验证 O(n²) 与 O(n log n) 的分叉。',
  ],
  formula: '冒泡最坏 = n(n−1)/2 · 归并/快排平均 = O(n log₂ n)',
  formulaNote: '快排采用最右端基准（Lomuto 划分），遇正序或逆序输入时退化为 O(n²)，归并排序则保持稳定 O(n log n)',
  terms: [
    ['O(n²) 算法', '冒泡、选择、插入最坏情况比较次数随规模平方增长；但插入排序对已排序输入仅需 n−1 次比较'],
    ['分治与归并排序', '将数组二分递归排序再按序合并，需 O(n) 辅助空间，无论输入如何比较次数恒为 O(n log n)'],
    ['快速排序退化', '选最右端作基准时，有序或完全逆序会让划分极度不平衡，比较次数退化至 n(n−1)/2'],
  ],
  predict: {
    q: '对于本就“已经按从小到大排好序”的 10 个数，哪种算法几乎只看一遍就能确认完成？',
    options: ['冒泡排序（无优化）与选择排序', '插入排序（仅比较 9 次、交换 0 次）', '最右基准快速排序（仅比较 9 次）'],
    answer: 1,
    why: '插入排序每次将当前元素与前一位比较，若大于等于前一位立即停止内循环，总计只需 n−1 = 9 次比较、0 次交换；而无提前终止的冒泡、选择和最右基准快排在此输入下仍要比较 45 次！',
  },
  challenge: '把输入切换为“已排序（正序）”，分别跑一遍插入排序与快速排序，比较两者的比较次数；再到工作台绘制 n = 10..200 实测曲线！',
  fig: '十根木条排序台：橙色为正在比较，后排虚位为归并辅助缓冲区',
  hint: '选算法与输入分布后自动播放，也可点击“单步前进 / 单步回退”逐帧剖析每次比较与交换。',
  teach: {
    where: '普通高中信息技术 必修 1《数据与计算》第三章 · 选择性必修 1《数据与数据结构》排序算法',
    ask: [
      '为什么归并排序的木条在合并阶段会先退到后排辅助区？这对应计算机里的什么资源开销？',
      '当数据规模 n 从 10 扩大到 200（20 倍）时，实测 O(n²) 曲线与 O(n log n) 曲线各自增长了多少倍？',
    ],
    simplify: '冒泡采用标准双循环不设提前退出标志；快速排序采用最右元素作基准的 Lomuto 划分以便直观展示最坏 O(n²) 退化；归并排序将写入新位置计入移动操作数。',
  },
  controls: [
    { id: 'alg', type: 'choice', label: '算法', options: SORT_ALGS, value: 0, wide: true },
    { id: 'inp', type: 'choice', label: '输入序列', options: INPUT_KINDS, value: 0, wide: true },
    { id: 'sp', label: '动画速度', min: 1, max: 10, step: 1, value: 4 },
    { id: 'run', type: 'toggle', label: '自动播放', value: true },
    { id: 'prev', type: 'button', label: '单步回退' },
    { id: 'step', type: 'button', label: '单步前进' },
    { id: 'mix', type: 'button', label: '重新生成' },
  ],
  record: {
    note: '对比五种算法在不同输入分布（随机、正序、逆序）下排完同一规模序列的真实比较次数与交换/移动次数。',
    pending: '运行完一轮排序或点击工作台记录，把算法实测步数归档比较。',
    columns: [
      { key: 'algName', label: '排序算法' },
      { key: 'inpName', label: '输入形态' },
      { key: 'n', label: '规模 n', digits: 0 },
      { key: 'comps', label: '比较次数', digits: 0, stat: true },
      { key: 'swaps', label: '交换/移动次数', digits: 0 },
      { key: 'complexity', label: '本工况复杂度' },
    ],
    sample: (inst, p) => {
      const s = inst.snapshot();
      const alg = p.alg ?? 0, inp = p.inp ?? 0;
      const cx = alg === 3 ? 'O(n log n)'
        : alg === 4 ? (inp === 0 ? 'O(n log n)' : '退化 O(n²)')
        : alg === 2 && inp === 1 ? '最优 O(n)' : 'O(n²)';
      return {
        _kind: 'model',
        algName: SORT_ALGS[alg],
        inpName: INPUT_KINDS[inp],
        n: s.n,
        comps: s.totalComps,
        swaps: s.totalSwaps,
        complexity: cx,
      };
    },
    summary: (rows) => [
      ['已录入对比记录', `${rows.length} 条`],
      ['最低比较次数', rows.length ? `${Math.min(...rows.map((r) => r.comps))} 次` : '—'],
    ],
    errors: [
      '误认为快速排序在任何时候都比插入排序快：小规模或几乎有序数组上插入排序更快且无需递归栈。',
    ],
  },

  build(k) {
    const p = k.p;
    const Z = -0.65;
    k.root.add(
      at(box(9.4, 0.14, 2.5, '#e8e4d8', { kind: 'card' }), 0, 0, Z - 0.15),
      at(note('归并辅助缓冲区', { size: 0.2, lay: 'flat', color: C.copper }), 0, 0.15, Z - 0.95),
    );
    const barHolder = group();
    k.root.add(barHolder);
    const info = at(card('\n\n', { w: 4.5, size: 0.30, align: 'left' }), 2.2, 0, 2.4);
    k.root.add(info);

    let seed = 2026;
    let baseVals = [];
    let bars = [];
    let events = [];
    let pc = 0, nc = 0, ns = 0, accT = 0;
    let hot = [], staged = new Set(), fixed = new Set(), order = [];
    let totalRes = { comps: 0, swaps: 0 };

    const layoutX = (n) => {
      const dx = Math.min(0.84, 8.2 / Math.max(1, n));
      const x0 = -((n - 1) / 2) * dx;
      return { dx, x0 };
    };

    const rebuildMeshes = () => {
      freshGroup(barHolder);
      const n = baseVals.length;
      const maxV = Math.max(1, ...baseVals);
      const { dx, x0 } = layoutX(n);
      const bw = Math.min(0.56, dx * 0.72);
      bars = baseVals.map((v, i) => {
        const h = (v / maxV) * 3.6 + 0.35;
        const m = box(bw, h, 0.76, C.wood);
        const tag = at(note(String(v), { size: Math.min(0.32, dx * 0.45), bold: true, w: bw + 0.12 }), 0, h + 0.28, 0);
        const g = at(group(m, tag), x0 + i * dx, 0.14, Z);
        g.userData.tx = g.position.x;
        g.userData.tz = Z;
        barHolder.add(g);
        return g;
      });
    };

    const resetReplayState = () => {
      const n = baseVals.length;
      const { dx, x0 } = layoutX(n);
      order = baseVals.map((_, i) => i);
      pc = 0; nc = 0; ns = 0; accT = 0;
      hot = []; staged = new Set(); fixed = new Set();
      bars.forEach((b, i) => {
        b.userData.tx = x0 + i * dx;
        b.userData.tz = Z;
      });
    };

    const applyEvent = (ev) => {
      const n = baseVals.length;
      const { dx, x0 } = layoutX(n);
      const op = ev[0];
      if (op === 'c') {
        nc++;
        hot = [ev[1], ev[2]];
      } else if (op === 's') {
        ns++;
        const [, posA, posB, idAtA, idAtB] = ev;
        order[posA] = idAtA;
        order[posB] = idAtB;
        bars[idAtA].userData.tx = x0 + posA * dx;
        bars[idAtB].userData.tx = x0 + posB * dx;
        hot = [idAtA, idAtB];
      } else if (op === 'stage') {
        ev[1].forEach((bid) => { staged.add(bid); bars[bid].userData.tz = Z - 0.72; });
        hot = ev[1].slice();
      } else if (op === 'w') {
        ns++;
        const [, slotPos, bid, isFinal] = ev;
        order[slotPos] = bid;
        staged.delete(bid);
        bars[bid].userData.tx = x0 + slotPos * dx;
        bars[bid].userData.tz = Z;
        hot = [bid];
        if (isFinal) fixed.add(bid);
      } else if (op === 'f') {
        fixed.add(ev[1]);
        hot = [];
      }
    };

    const planSort = (customArr = null) => {
      if (customArr) baseVals = customArr.slice();
      else baseVals = makeSortInput(10, p.inp ?? 0, seed);
      rebuildMeshes();
      const res = runSortAlgorithm(p.alg ?? 0, baseVals, true);
      events = res.events;
      totalRes = { comps: res.comps, swaps: res.swaps };
      resetReplayState();
      k.dirty();
    };

    const stepForward = () => {
      if (pc >= events.length) return;
      applyEvent(events[pc++]);
      if (pc >= events.length) {
        hot = [];
        staged.clear();
        bars.forEach((_, idx) => fixed.add(idx));
      }
      k.dirty();
    };

    const stepBackward = () => {
      if (pc <= 0) return;
      const targetPc = pc - 1;
      resetReplayState();
      for (let i = 0; i < targetPc; i++) applyEvent(events[i]);
      pc = targetPc;
      k.dirty();
    };

    planSort();
    return {
      snapshot: () => ({
        n: baseVals.length,
        pc,
        totalSteps: events.length,
        nc,
        ns,
        totalComps: totalRes.comps,
        totalSwaps: totalRes.swaps,
        vals: baseVals.slice(),
      }),
      loadCustom(arr) {
        if (!Array.isArray(arr) || arr.length < 2) return;
        planSort(arr.slice(0, 14));
      },
      press(id) {
        if (id === 'mix') { seed = (seed * 1664525 + 1013904223) >>> 0; planSort(); }
        else if (id === 'step') stepForward();
        else if (id === 'prev') stepBackward();
      },
      change(id) {
        if (id === 'inp') planSort();
        else if (id === 'alg') {
          // 保留同一份 baseVals 以公平对比不同算法
          const res = runSortAlgorithm(p.alg ?? 0, baseVals, true);
          events = res.events;
          totalRes = { comps: res.comps, swaps: res.swaps };
          resetReplayState();
          k.dirty();
        }
      },
      update(dt) {
        if (p.run && pc < events.length && dt > 0) {
          accT += dt * (p.sp ?? 4) * 1.8;
          while (accT >= 1 && pc < events.length) { accT -= 1; stepForward(); }
        }
        const kLerp = dt > 0 ? 1 - Math.exp(-dt * 15) : 1;
        bars.forEach((b, bid) => {
          b.position.x = lerp(b.position.x, b.userData.tx, kLerp);
          const zTarget = hot.includes(bid) ? b.userData.tz + 0.36 : b.userData.tz;
          b.position.z = lerp(b.position.z, zTarget, kLerp);
          const col = hot.includes(bid) ? C.amber : fixed.has(bid) ? '#a9dfbf' : staged.has(bid) ? '#d6e6f5' : C.wood;
          b.children[0].material.color.set(col);
        });
        const done = pc >= events.length;
        info.set(
          `${SORT_ALGS[p.alg ?? 0]} · ${INPUT_KINDS[p.inp ?? 0]}\n` +
          `比较 ${nc} 次  |  交换/移动 ${ns} 次\n` +
          `${done ? '✓ 排序完成' : `步数 ${pc} / ${events.length}`}`
        );
      },
      margin() {
        const alg = p.alg ?? 0, inp = p.inp ?? 0;
        const cx = alg === 3 ? 'O(n log n) 稳定'
          : alg === 4 ? (inp === 0 ? '平均 O(n log n)' : '退化至 O(n²)!')
          : alg === 2 && inp === 1 ? '最优 O(n)' : 'O(n²)';
        return [
          SORT_ALGS[alg],
          INPUT_KINDS[inp],
          `比较 ${nc} / ${totalRes.comps}`,
          `移动 ${ns} / ${totalRes.swaps}`,
          cx,
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    // 1. 自定义序列输入与五算法同台跑分
    const sec1 = wb.section('1 · 自定义输入序列与五种算法步数即时对比');
    const row1 = document.createElement('div');
    row1.className = 'wb-row';
    const inpEl = document.createElement('input');
    inpEl.type = 'text';
    inpEl.className = 'wb-input';
    inpEl.style.flex = '1';
    inpEl.style.minWidth = '200px';
    inpEl.value = '8, 3, 9, 1, 5, 10, 2, 7, 4, 6';
    row1.innerHTML = `<span class="wb-muted">序列 (逗号分隔, 3–14 个):</span>`;
    row1.append(inpEl);
    const btnApply = document.createElement('button');
    btnApply.type = 'button'; btnApply.className = 'wb-btn primary'; btnApply.textContent = '载入 3D 排序台';
    row1.append(btnApply);
    sec1.append(row1);

    const presetBar = document.createElement('div');
    presetBar.className = 'wb-btn-row';
    presetBar.style.marginTop = '8px';
    presetBar.innerHTML = `
      <button type="button" class="wb-btn" data-pre="rand">随机 10 数</button>
      <button type="button" class="wb-btn" data-pre="asc">正序 1..10</button>
      <button type="button" class="wb-btn" data-pre="desc">逆序 10..1</button>
      <button type="button" class="wb-btn" data-pre="dup">含重复值</button>
      <button type="button" class="wb-btn" data-pre="prev">◀ 单步回退</button>
      <button type="button" class="wb-btn" data-pre="step">单步前进 ▶</button>
      <button type="button" class="wb-btn primary" data-pre="rec">记入实验记录</button>`;
    sec1.append(presetBar);

    const parseInput = () => {
      const nums = inpEl.value.split(/[\s,，]+/).map((s) => Number(s.trim())).filter((v) => Number.isFinite(v));
      return nums.length >= 3 ? nums.slice(0, 14) : [8, 3, 9, 1, 5, 10, 2, 7, 4, 6];
    };

    const cmpCv = wb.canvas(sec1, 520, 175, (x, W, H) => {
      const arr = sp.inst?.snapshot?.().vals || parseInput();
      const results = SORT_ALGS.map((name, i) => ({ name, ...runSortAlgorithm(i, arr, false) }));
      const maxOp = Math.max(10, ...results.map((r) => Math.max(r.comps, r.swaps)));
      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#51606b'; x.font = '11.5px "Noto Serif SC",serif';
      x.fillText(`当前测试序列 (n=${arr.length}): [${arr.join(', ')}]`, 14, 18);

      const barW = 290, xStart = 115;
      results.forEach((r, i) => {
        const y = 34 + i * 27;
        const active = i === (sp.params.alg ?? 0);
        x.fillStyle = active ? '#b4653a' : '#1e2b36';
        x.font = `${active ? 'bold ' : ''}12px "Noto Serif SC",serif`;
        x.textAlign = 'right';
        x.fillText(r.name, xStart - 10, y + 12);
        // 比较次数条
        const wc = (r.comps / maxOp) * barW;
        x.fillStyle = active ? '#b4653a' : '#3b6fe0';
        x.fillRect(xStart, y, wc, 9);
        // 交换/移动次数条
        const ws = (r.swaps / maxOp) * barW;
        x.fillStyle = '#1f4a3e';
        x.fillRect(xStart, y + 10, ws, 7);
        x.textAlign = 'left'; x.fillStyle = '#1e2b36'; x.font = '11px Georgia,serif';
        x.fillText(`比较 ${r.comps} · 移 ${r.swaps}`, xStart + Math.max(wc, ws) + 8, y + 12);
      });
      // 图例
      x.fillStyle = '#3b6fe0'; x.fillRect(W - 155, 8, 10, 8);
      x.fillStyle = '#1e2b36'; x.font = '10.5px "Noto Serif SC",serif'; x.fillText('比较次数', W - 140, 16);
      x.fillStyle = '#1f4a3e'; x.fillRect(W - 82, 8, 10, 8);
      x.fillStyle = '#1e2b36'; x.fillText('交换/写入', W - 67, 16);
    });

    // 2. n=10..200 复杂度实测生长曲线
    const sec2 = wb.section('2 · n = 10..200 真实比较次数实测曲线（O(n²) vs O(n log n)）');
    const NS = [10, 25, 50, 80, 120, 160, 200];
    const ALG_COLORS = ['#b4653a', '#7a5cff', '#2fb46a', '#3b6fe0', '#e5483f'];
    let benchCacheKey = '';
    let benchData = [];

    const runBench = () => {
      const inpKind = sp.params.inp ?? 0;
      const key = `${inpKind}`;
      if (key === benchCacheKey && benchData.length) return;
      benchCacheKey = key;
      benchData = NS.map((n) => {
        const arr = makeSortInput(n, inpKind, 420 + n);
        return { n, counts: SORT_ALGS.map((_, a) => runSortAlgorithm(a, arr, false).comps) };
      });
    };

    const scaleCv = wb.canvas(sec2, 520, 240, (x, W, H) => {
      runBench();
      const pad = { l: 56, r: 24, t: 22, b: 36 };
      const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      const maxY = Math.max(200, ...benchData.flatMap((d) => d.counts));
      const sx = (n) => pad.l + ((n - 10) / 190) * pw;
      const sy = (c) => pad.t + ph - (c / maxY) * ph;

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      x.strokeStyle = 'rgba(30,43,54,0.1)'; x.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {
        const yy = pad.t + (ph * i) / 4;
        x.beginPath(); x.moveTo(pad.l, yy); x.lineTo(pad.l + pw, yy); x.stroke();
      }
      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.4;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();

      x.fillStyle = '#51606b'; x.font = '10.5px Georgia,serif'; x.textAlign = 'center';
      NS.forEach((n) => x.fillText(String(n), sx(n), H - 17));
      x.fillText(`输入分布：${INPUT_KINDS[sp.params.inp ?? 0]} · 数据规模 n`, pad.l + pw / 2, H - 4);
      x.textAlign = 'right';
      for (let i = 0; i <= 4; i++) {
        const v = Math.round((maxY * i) / 4);
        x.fillText(String(v), pad.l - 6, pad.t + ph - (ph * i) / 4 + 4);
      }

      // 理论参考虚线 n(n-1)/2 与 n log2(n)
      x.save(); x.setLineDash([5, 4]); x.strokeStyle = 'rgba(180,101,58,0.45)'; x.lineWidth = 1.3;
      x.beginPath();
      NS.forEach((n, i) => { const y = sy((n * (n - 1)) / 2); if (i === 0) x.moveTo(sx(n), y); else x.lineTo(sx(n), y); });
      x.stroke();
      x.strokeStyle = 'rgba(31,74,62,0.45)';
      x.beginPath();
      NS.forEach((n, i) => { const y = sy(n * Math.log2(n)); if (i === 0) x.moveTo(sx(n), y); else x.lineTo(sx(n), y); });
      x.stroke(); x.restore();

      // 5 条真实运行计数的曲线
      SORT_ALGS.forEach((name, a) => {
        x.strokeStyle = ALG_COLORS[a];
        x.lineWidth = a === (sp.params.alg ?? 0) ? 2.8 : 1.7;
        x.beginPath();
        benchData.forEach((d, idx) => {
          const px = sx(d.n), py = sy(d.counts[a]);
          if (idx === 0) x.moveTo(px, py); else x.lineTo(px, py);
        });
        x.stroke();
        benchData.forEach((d) => {
          x.fillStyle = ALG_COLORS[a];
          x.beginPath(); x.arc(sx(d.n), sy(d.counts[a]), 3, 0, TAU); x.fill();
        });
      });

      // 图例
      SORT_ALGS.forEach((name, a) => {
        const lx = pad.l + 10 + (a % 3) * 145, ly = pad.t + 10 + Math.floor(a / 3) * 16;
        x.fillStyle = ALG_COLORS[a]; x.fillRect(lx, ly - 6, 12, 3);
        x.fillStyle = '#1e2b36'; x.font = '11px "Noto Serif SC",serif'; x.textAlign = 'left';
        x.fillText(`${name} (n=200: ${benchData[benchData.length - 1].counts[a]})`, lx + 16, ly - 1);
      });
    });

    const stats = document.createElement('div');
    stats.className = 'wb-metrics';
    sec2.append(stats);

    const refresh = () => {
      cmpCv.redraw();
      scaleCv.redraw();
      const last = benchData[benchData.length - 1];
      if (last) {
        stats.innerHTML = `
          <div class="wb-m"><span>n=200 冒泡比较数</span><b>${last.counts[0]} 次</b></div>
          <div class="wb-m"><span>n=200 归并比较数</span><b>${last.counts[3]} 次</b></div>
          <div class="wb-m"><span>n=200 快排比较数</span><b>${last.counts[4]} 次 (${(sp.params.inp ?? 0) ? '退化!' : '高效'})</b></div>`;
      }
    };

    btnApply.addEventListener('click', () => {
      const arr = parseInput();
      sp.inst?.loadCustom?.(arr);
      refresh();
    });

    presetBar.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.pre;
      if (!act) return;
      if (act === 'rand') { const a = makeSortInput(10, 0, Math.floor(Math.random() * 9999)); inpEl.value = a.join(', '); sp.inst?.loadCustom?.(a); }
      else if (act === 'asc') { const a = makeSortInput(10, 1); inpEl.value = a.join(', '); sp.inst?.loadCustom?.(a); }
      else if (act === 'desc') { const a = makeSortInput(10, 2); inpEl.value = a.join(', '); sp.inst?.loadCustom?.(a); }
      else if (act === 'dup') { const a = [5, 2, 8, 5, 1, 9, 2, 5, 7, 2]; inpEl.value = a.join(', '); sp.inst?.loadCustom?.(a); }
      else if (act === 'prev') wb.press('prev');
      else if (act === 'step') wb.press('step');
      else if (act === 'rec') wb.record(sorting.record.sample(sp.inst, sp.params));
      refresh();
    });

    refresh();
    return { update() { refresh(); } };
  },
};

// ================================================================ 3. 梁的弯曲、截面形状与结构强度
const BEAM_MATS = [
  { name: '松木', E: 10e9, sigmaAllow: 40, color: C.wood },
  { name: '铝合金', E: 70e9, sigmaAllow: 180, color: '#dfe5ea' },
  { name: '结构钢', E: 200e9, sigmaAllow: 250, color: '#b9c2c9' },
];
const BEAM_PROFILES = [
  { key: 'flat', name: '矩形平放 (30×6 mm)', short: '平放 30×6', hMm: 6, bMm: 30 },
  { key: 'edge', name: '矩形立放 (6×30 mm)', short: '立放 6×30', hMm: 30, bMm: 6 },
  { key: 'hollow', name: '空心方管 (18×18 mm)', short: '空心方管', hMm: 18, bMm: 18 },
  { key: 'i', name: '工字钢 (高30×宽20 mm)', short: '工字钢', hMm: 30, bMm: 20 },
];

export const beam = {
  id: 'tech-beam',
  subject: 'tech',
  title: '梁的弯曲、截面形状与结构强度',
  en: 'Beam bending, cross-sections & structural strength',
  lede: [
    '把同样 180 mm² 截面积的材料分别做成平放矩形、立放矩形、空心方管与工字钢，架在简支座上承受相同载荷。',
    '材料一点没多，工字钢与立放截面却刚硬数十倍——秘密全在截面惯性矩 I 决定材料离中性轴越远、抗弯贡献呈平方/立方放大。',
  ],
  formula: 'δ = F L³ / (48 E I) · σ_max = M_max·y_max / I',
  formulaNote: '四种型材截面积均为 A = 180 mm²；矩形截面等面积改变高度时 I = Ah²/12，故 δ ∝ 1/h²',
  terms: [
    ['挠度 δ', '简支梁受中点集中力 F 后的最大下沉量，与跨度 L 的三次方成正比'],
    ['截面惯性矩 I', '反映截面几何抗弯能力的二阶矩：把材料布置在远离中性轴的上下边缘（如工字钢翼缘）效率最高'],
    ['最大正应力 σ_max', '梁上下表面受拉/压最剧烈处的应力，W = I/y_max 称为抗弯截面模量'],
  ],
  predict: {
    q: '截面积同为 180 mm²，把 30×6 mm 的矩形木条改为 6×30 mm 立着放，中点挠度 δ 会变成原来的几分之一？',
    options: ['1/5（高度变 5 倍）', '1/25（等面积下 I ∝ h²）', '1/125（I ∝ h³）'],
    answer: 1,
    why: '截面积 A = b·h 不变时，宽度 b = A/h，故惯性矩 I = bh³/12 = A·h²/12。高度 h 变为 5 倍时，I 增大为 5² = 25 倍，挠度 δ 减小为原来的 1/25！',
  },
  challenge: '保持跨度 0.8 m 与载荷 25 N 不变，依次切换四种等面积截面，在工作台对比它们的抗弯模量 W 与最大正应力 σ_max，并验证 δ 与 1/h² 的线性关系！',
  fig: '简支梁弯曲装置、可切换等面积截面与截面应力图卡',
  hint: '切换截面形状观察 3D 梁真实几何形态变化；在工作台检验“等面积 1/h² 定律”和四种型材抗弯模量。',
  teach: {
    where: '普通高中通用技术 必修《技术与设计 2》第一单元 · 结构及其设计（结构强度与截面形状）',
    ask: [
      '为什么跨度 L 翻倍时，在载荷不变情况下梁的挠度会暴增到 8 倍？这对大跨度桥梁截面设计有何启示？',
      '等面积（180 mm²）条件下，工字钢比立放矩形的挠度更小还是更大？对比两者的最大正应力 σ_max 与稳定性。',
    ],
    simplify: '采用 Euler-Bernoulli 简支梁小变形线弹性弯曲公式；四类截面由 science-models.js#solveBeamDeflection 统一以 A = 180 mm² 精确积分求解。',
    safety: '当最大弯曲正应力 σ_max 超过材料许用强度时模型标红预警，真实测试需防脆性材料突然断裂飞溅。',
  },
  controls: [
    { id: 'prof', type: 'choice', label: '等面积截面 (180 mm²)', options: BEAM_PROFILES.map((p) => p.short), value: 0, wide: true },
    { id: 'mat', type: 'choice', label: '材料', options: BEAM_MATS.map((m) => m.name), value: 0 },
    { id: 'L', label: '跨度 L', min: 0.4, max: 1.0, step: 0.05, value: 0.8, unit: 'm' },
    { id: 'F', label: '载荷 F', min: 0, max: 40, step: 1, value: 18, unit: 'N' },
  ],
  record: {
    note: '记录不同跨度、材料与等面积截面下的挠度 δ、截面惯性矩 I 与最大弯曲正应力 σ_max。',
    pending: '调整截面或载荷后，点击“记一组数据”录入结构对比表。',
    columns: [
      { key: 'profName', label: '截面型材' },
      { key: 'matName', label: '材料' },
      { key: 'L', label: '跨度 L', unit: 'm', digits: 2 },
      { key: 'F', label: '载荷 F', unit: 'N', digits: 0 },
      { key: 'I_mm4', label: '惯性矩 I', unit: 'mm⁴', digits: 0 },
      { key: 'deltaMm', label: '挠度 δ', unit: 'mm', digits: 2, stat: true },
      { key: 'sigmaMPa', label: '峰值应力 σ_max', unit: 'MPa', digits: 2 },
    ],
    sample: (_inst, p) => {
      const pr = BEAM_PROFILES[p.prof ?? 0];
      const mt = BEAM_MATS[p.mat ?? 0];
      const sol = solveBeamDeflection(p.L, p.F, mt.E, pr.key);
      return {
        _kind: 'model',
        profName: pr.short,
        matName: mt.name,
        L: p.L,
        F: p.F,
        I_mm4: sol.I * 1e12,
        deltaMm: sol.delta * 1000,
        sigmaMPa: sol.sigmaMaxMPa,
      };
    },
    summary: (rows) => [
      ['已测结构方案', `${rows.length} 组`],
      ['最小挠度方案', rows.length ? `${Math.min(...rows.map((r) => r.deltaMm)).toFixed(2)} mm` : '—'],
    ],
    errors: [
      '忽视截面面积是否相等而直接比较实心大木梁与薄钢片：本实验严格锁定四种截面同为 180 mm²（耗材完全相同）。',
    ],
  },

  build(k) {
    const p = k.p;
    const S = 6.2, Z = -0.8, TOP = 3.15;
    const sup = [0, 1].map(() => group(
      box(0.66, TOP - 0.24, 1.45, '#e2ddd0'),
      rot(at(cyl(0.18, 1.45, '#cfd6dc', { seg: 18, kind: 'metal' }), 0, TOP - 0.18, -0.725), Math.PI / 2, 0, 0),
    ));
    const wt = cyl(0.4, 0.58, '#b9c2c9', { kind: 'metal' });
    const hang = wire([0, 0, 0], [0, 1, 0], 0.022);
    const ref = dash([-3.5, TOP, Z + 0.85], [3.5, TOP, Z + 0.85], { len: 0.14, gap: 0.12 });
    const beamHolder = group();
    const secSheet = sheet(2.15, 1.75, () => {}, {});
    secSheet.position.set(-2.55, 1.65, 2.0);
    secSheet.rotation.x = -0.58;
    const info = at(card('\n\n', { w: 4.1, size: 0.30, align: 'left' }), 2.25, 0, 2.45);
    k.root.add(...sup, wt, hang, ref, beamHolder, secSheet, info);

    let subMeshes = [];
    let lastGeomKey = '', lastCardKey = '', dv = 0, d = 0, curSol = null;

    const addSegBox = (len, h, dpt, oy, oz, col) => {
      const geo = new THREE.BoxGeometry(len, h, dpt, 48, 1, 1).translate(0, oy, oz);
      const m = solid(geo, col);
      m.userData.base = geo.attributes.position.array.slice();
      beamHolder.add(m);
      subMeshes.push(m);
    };

    const rebuildBeam = () => {
      freshGroup(beamHolder);
      subMeshes = [];
      const pr = BEAM_PROFILES[p.prof ?? 0];
      const mt = BEAM_MATS[p.mat ?? 0];
      const len = p.L * S + 0.95;

      if (pr.key === 'flat') {
        addSegBox(len, 0.20, 1.00, 0.10, 0, mt.color);
      } else if (pr.key === 'edge') {
        addSegBox(len, 1.00, 0.20, 0.50, 0, mt.color);
      } else if (pr.key === 'hollow') {
        // 18×18 mm 外框，壁厚按比例 0.10（总高 0.60, 总宽 0.60）
        const B = 0.60, t = 0.105;
        addSegBox(len, t, B, t / 2, 0, mt.color);
        addSegBox(len, t, B, B - t / 2, 0, mt.color);
        addSegBox(len, B - 2 * t, t, B / 2, -(B - t) / 2, mt.color);
        addSegBox(len, B - 2 * t, t, B / 2, (B - t) / 2, mt.color);
      } else {
        // 工字钢：总高 1.00, 翼缘宽 0.67, 翼缘厚 0.11, 腹板厚 0.09
        const H = 1.00, bw = 0.67, ft = 0.11, tw = 0.09;
        addSegBox(len, ft, bw, ft / 2, 0, mt.color);
        addSegBox(len, ft, bw, H - ft / 2, 0, mt.color);
        addSegBox(len, H - 2 * ft, tw, H / 2, 0, mt.color);
      }

      beamHolder.position.set(0, TOP, Z);
      sup.forEach((s, i) => s.position.set((i ? 1 : -1) * (p.L * S) / 2, 0, Z));
      paintSectionCard();
    };

    const paintSectionCard = () => {
      const pr = BEAM_PROFILES[p.prof ?? 0];
      const mt = BEAM_MATS[p.mat ?? 0];
      const sol = solveBeamDeflection(p.L, p.F, mt.E, pr.key);
      secSheet.redraw((x, s, w, h) => {
        x.fillStyle = '#fffdf7'; x.fillRect(0, 0, w * s, h * s);
        x.strokeStyle = C.ink; x.lineWidth = s * 0.03; x.strokeRect(0.03 * s, 0.03 * s, (w - 0.06) * s, (h - 0.06) * s);
        x.fillStyle = C.copper; x.font = `600 ${s * 0.15}px "Songti SC",serif`; x.textAlign = 'center';
        x.fillText(`截面放大图 (A=180mm²)`, (w * s) / 2, 0.18 * s);
        const cx = (w * s) / 2, cy = (h * s) * 0.56, sc = s * 0.032;
        x.fillStyle = mt.color; x.strokeStyle = C.ink; x.lineWidth = s * 0.025;
        if (pr.key === 'flat') {
          x.fillRect(cx - 15 * sc, cy - 3 * sc, 30 * sc, 6 * sc);
          x.strokeRect(cx - 15 * sc, cy - 3 * sc, 30 * sc, 6 * sc);
        } else if (pr.key === 'edge') {
          x.fillRect(cx - 3 * sc, cy - 15 * sc, 6 * sc, 30 * sc);
          x.strokeRect(cx - 3 * sc, cy - 15 * sc, 6 * sc, 30 * sc);
        } else if (pr.key === 'hollow') {
          x.fillRect(cx - 9 * sc, cy - 9 * sc, 18 * sc, 18 * sc);
          x.strokeRect(cx - 9 * sc, cy - 9 * sc, 18 * sc, 18 * sc);
          x.fillStyle = '#fffdf7';
          x.fillRect(cx - 6.02 * sc, cy - 6.02 * sc, 12.04 * sc, 12.04 * sc);
          x.strokeRect(cx - 6.02 * sc, cy - 6.02 * sc, 12.04 * sc, 12.04 * sc);
        } else {
          x.beginPath();
          x.moveTo(cx - 10 * sc, cy - 15 * sc); x.lineTo(cx + 10 * sc, cy - 15 * sc);
          x.lineTo(cx + 10 * sc, cy - 12 * sc); x.lineTo(cx + 1.25 * sc, cy - 12 * sc);
          x.lineTo(cx + 1.25 * sc, cy + 12 * sc); x.lineTo(cx + 10 * sc, cy + 12 * sc);
          x.lineTo(cx + 10 * sc, cy + 15 * sc); x.lineTo(cx - 10 * sc, cy + 15 * sc);
          x.lineTo(cx - 10 * sc, cy + 12 * sc); x.lineTo(cx - 1.25 * sc, cy + 12 * sc);
          x.lineTo(cx - 1.25 * sc, cy - 12 * sc); x.lineTo(cx - 10 * sc, cy - 12 * sc);
          x.closePath(); x.fill(); x.stroke();
        }
        // 中性轴虚线
        x.strokeStyle = C.red; x.lineWidth = s * 0.015; x.setLineDash([4, 3]);
        x.beginPath(); x.moveTo(0.25 * s, cy); x.lineTo((w - 0.25) * s, cy); x.stroke(); x.setLineDash([]);
        x.fillStyle = C.ink; x.font = `${s * 0.14}px Georgia,serif`;
        x.fillText(`I = ${(sol.I * 1e12).toFixed(0)} mm⁴ · σ=${sol.sigmaMaxMPa.toFixed(1)} MPa`, cx, (h - 0.14) * s);
      });
    };

    return {
      update(dt) {
        const gKey = `${p.L}|${p.prof}|${p.mat}`;
        const cKey = `${gKey}|${p.F}`;
        if (gKey !== lastGeomKey) {
          lastGeomKey = gKey;
          rebuildBeam();
        }
        if (cKey !== lastCardKey) {
          lastCardKey = cKey;
          paintSectionCard();
        }
        const pr = BEAM_PROFILES[p.prof ?? 0];
        const mt = BEAM_MATS[p.mat ?? 0];
        curSol = solveBeamDeflection(p.L, p.F, mt.E, pr.key);
        const target = Math.min(curSol.delta, 0.24);
        if (dt > 0) {
          dv += ((target - d) * 90 - dv * 9) * dt;
          d += dv * dt;
        } else {
          d = target; dv = 0;
        }

        const half = (p.L * S) / 2;
        const dw = d * S;
        for (const m of subMeshes) {
          const pos = m.geometry.attributes.position;
          const base = m.userData.base;
          for (let i = 0; i < pos.count; i++) {
            const x = base[i * 3], ax = Math.abs(x), xi = (half - ax) / (2 * half);
            const y = ax <= half ? -dw * (3 * xi - 4 * xi ** 3) : (dw * 3 / (2 * half)) * (ax - half);
            pos.setY(i, base[i * 3 + 1] + y);
          }
          pos.needsUpdate = true;
          m.geometry.computeVertexNormals();
          m.material.color.set(curSol.sigmaMaxMPa > mt.sigmaAllow ? '#f2a29a' : mt.color);
        }

        hang.span([0, TOP - dw, Z], [0, TOP - dw - 0.68, Z]);
        wt.position.set(0, TOP - dw - 1.26, Z);
        wt.scale.setScalar(0.5 + p.F / 45);
        wt.visible = hang.visible = p.F > 0;

        const dMm = curSol.delta * 1000;
        const overStress = curSol.sigmaMaxMPa > mt.sigmaAllow;
        info.set(
          `${pr.name} · ${mt.name}\n` +
          `中点挠度 δ = ${dMm < 10 ? dMm.toFixed(2) : dMm.toFixed(1)} mm\n` +
          `峰值正应力 σ_max = ${curSol.sigmaMaxMPa.toFixed(1)} MPa${overStress ? ' ⚠ 屈服预警!' : ''}`
        );
      },
      margin() {
        const pr = BEAM_PROFILES[p.prof ?? 0];
        const mt = BEAM_MATS[p.mat ?? 0];
        const s = curSol || solveBeamDeflection(p.L, p.F, mt.E, pr.key);
        return [
          pr.short,
          `I = ${(s.I * 1e12).toFixed(0)} mm⁴`,
          `E = ${mt.E / 1e9} GPa`,
          `δ = ${(s.delta * 1000).toFixed(2)} mm`,
          `σ_max = ${s.sigmaMaxMPa.toFixed(1)} MPa`,
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    // 1. 四种等面积型材抗弯刚度与截面模量对比台
    const sec1 = wb.section('1 · 等截面积 (180 mm²) 四种型材抗弯刚度 EI 与截面模量 W = I/y_max 对比（点击切换 3D 截面）');
    const profBar = document.createElement('div');
    profBar.className = 'wb-btn-row';
    BEAM_PROFILES.forEach((pr, idx) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'wb-btn'; b.dataset.pi = String(idx);
      b.textContent = pr.short;
      profBar.append(b);
    });
    const btnRec = document.createElement('button');
    btnRec.type = 'button'; btnRec.className = 'wb-btn primary'; btnRec.dataset.pi = 'rec';
    btnRec.textContent = '记入实验记录';
    profBar.append(btnRec);
    sec1.append(profBar);

    const compCv = wb.canvas(sec1, 520, 210, (x, W, H) => {
      const p = sp.params;
      const mt = BEAM_MATS[p.mat ?? 0];
      const L = p.L ?? 0.8, F = p.F ?? 18;
      const sols = BEAM_PROFILES.map((pr, idx) => {
        const s = solveBeamDeflection(L, F, mt.E, pr.key);
        const yMax = (pr.hMm / 2) * 1e-3;
        const Wmm3 = (s.I / yMax) * 1e9;
        return { pr, idx, ...s, Wmm3 };
      });
      const baseI = sols[0].I;

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      const colW = W / 4;
      sols.forEach((s, i) => {
        const cx = colW * i + colW / 2, cy = 62;
        const active = i === (p.prof ?? 0);
        if (active) {
          x.fillStyle = 'rgba(180,101,58,0.10)';
          x.fillRect(colW * i + 4, 6, colW - 8, H - 12);
          x.strokeStyle = '#b4653a'; x.lineWidth = 1.6;
          x.strokeRect(colW * i + 4, 6, colW - 8, H - 12);
        }
        // 等比例绘制截面图
        const sc = 2.0;
        x.fillStyle = mt.color; x.strokeStyle = '#1e2b36'; x.lineWidth = 1.4;
        if (s.pr.key === 'flat') {
          x.fillRect(cx - 15 * sc, cy - 3 * sc, 30 * sc, 6 * sc);
          x.strokeRect(cx - 15 * sc, cy - 3 * sc, 30 * sc, 6 * sc);
        } else if (s.pr.key === 'edge') {
          x.fillRect(cx - 3 * sc, cy - 15 * sc, 6 * sc, 30 * sc);
          x.strokeRect(cx - 3 * sc, cy - 15 * sc, 6 * sc, 30 * sc);
        } else if (s.pr.key === 'hollow') {
          x.fillRect(cx - 9 * sc, cy - 9 * sc, 18 * sc, 18 * sc);
          x.strokeRect(cx - 9 * sc, cy - 9 * sc, 18 * sc, 18 * sc);
          x.fillStyle = '#fffdf7';
          x.fillRect(cx - 6.02 * sc, cy - 6.02 * sc, 12.04 * sc, 12.04 * sc);
          x.strokeRect(cx - 6.02 * sc, cy - 6.02 * sc, 12.04 * sc, 12.04 * sc);
        } else {
          x.beginPath();
          x.moveTo(cx - 10 * sc, cy - 15 * sc); x.lineTo(cx + 10 * sc, cy - 15 * sc);
          x.lineTo(cx + 10 * sc, cy - 12 * sc); x.lineTo(cx + 1.25 * sc, cy - 12 * sc);
          x.lineTo(cx + 1.25 * sc, cy + 12 * sc); x.lineTo(cx + 10 * sc, cy + 12 * sc);
          x.lineTo(cx + 10 * sc, cy + 15 * sc); x.lineTo(cx - 10 * sc, cy + 15 * sc);
          x.lineTo(cx - 10 * sc, cy + 12 * sc); x.lineTo(cx - 1.25 * sc, cy + 12 * sc);
          x.lineTo(cx - 1.25 * sc, cy - 12 * sc); x.lineTo(cx - 10 * sc, cy - 12 * sc);
          x.closePath(); x.fill(); x.stroke();
        }
        x.textAlign = 'center';
        x.fillStyle = active ? '#b4653a' : '#1e2b36';
        x.font = 'bold 12px "Noto Serif SC",serif';
        x.fillText(s.pr.short, cx, 114);
        x.fillStyle = '#33424e'; x.font = '11px Georgia,serif';
        x.fillText(`I = ${(s.I * 1e12).toFixed(0)} mm⁴`, cx, 134);
        x.fillText(`刚度倍率 ${(s.I / baseI).toFixed(1)}×`, cx, 150);
        x.fillText(`W = ${s.Wmm3.toFixed(0)} mm³`, cx, 166);
        x.fillStyle = s.sigmaMaxMPa > mt.sigmaAllow ? '#d93829' : '#1f4a3e';
        x.fillText(`δ=${(s.delta * 1000).toFixed(2)}mm · σ=${s.sigmaMaxMPa.toFixed(1)}MPa`, cx, 184);
      });
    });

    // 2. 等面积矩形截面 δ ∝ 1/h² 线性回归验证
    const sec2 = wb.section('2 · 等截面积 (A = 180 mm²) 矩形截面高度 h 与挠度 δ ∝ 1/h² 定律验证');
    const H_VALS = [6, 9, 12, 15, 18, 24, 30]; // mm (保持 b*h = 180 mm²)
    const regChart = wb.regressionChart(sec2, {
      w: 520, h: 215,
      xLabel: '1 / h² (mm⁻²)',
      yLabel: '中点挠度 δ (mm)',
      xRange: [0, 0.032],
      yRange: [0, 200],
    });
    const metrics = document.createElement('div');
    metrics.className = 'wb-metrics';
    sec2.append(metrics);

    const refresh = () => {
      const p = sp.params, mt = BEAM_MATS[p.mat ?? 0], L = p.L ?? 0.8, F = p.F ?? 18;
      profBar.querySelectorAll('button[data-pi]').forEach((b) => {
        if (b.dataset.pi !== 'rec') b.classList.toggle('primary', Number(b.dataset.pi) === (p.prof ?? 0));
      });
      compCv.redraw();

      // 计算各等面积矩形高度 h 下的理论挠度（A = 1.8e-4 m², I = A * h^2 / 12）
      const pts = H_VALS.map((hMm) => {
        const h = hMm * 1e-3, I = (1.8e-4 * h * h) / 12;
        const deltaMm = ((F * L ** 3) / (48 * mt.E * I)) * 1000;
        const kind = (hMm === 6 && p.prof === 0) || (hMm === 30 && p.prof === 1) ? 'human' : 'simulated';
        return [1 / (hMm * hMm), deltaMm, kind];
      });
      const maxD = Math.max(10, ...pts.map((pt) => pt[1])) * 1.12;
      regChart.redraw({
        xRange: [0, 0.031],
        yRange: [0, maxD],
        pts,
        theoryFn: (invH2) => {
          // invH2 in mm^-2 => h^2 in m^2 = 1e-6 / invH2
          if (invH2 <= 0) return 0;
          const I = (1.8e-4 * (1e-6 / invH2)) / 12;
          return ((F * L ** 3) / (48 * mt.E * I)) * 1000;
        },
      });
      const reg = linearRegression(pts);
      const curPr = BEAM_PROFILES[p.prof ?? 0];
      const curSol = solveBeamDeflection(L, F, mt.E, curPr.key);
      metrics.innerHTML = `
        <div class="wb-m"><span>当前截面抗弯模量 W</span><b>${((curSol.I / ((curPr.hMm / 2) * 1e-3)) * 1e9).toFixed(1)} mm³</b></div>
        <div class="wb-m"><span>1/h² 线性拟合 R²</span><b>${reg ? reg.r2.toFixed(4) : '—'}</b></div>
        <div class="wb-m"><span>材料许用应力裕度</span><b>${(mt.sigmaAllow / Math.max(0.01, curSol.sigmaMaxMPa)).toFixed(2)}×</b></div>`;
    };

    profBar.addEventListener('click', (e) => {
      const pi = e.target.closest('button')?.dataset.pi;
      if (!pi) return;
      if (pi === 'rec') wb.record(beam.record.sample(sp.inst, sp.params));
      else wb.setParam('prof', Number(pi));
      refresh();
    });
    compCv.cv.addEventListener('click', (e) => {
      const pt = compCv.toLocal(e);
      const idx = clamp(Math.floor((pt.x / 520) * 4), 0, 3);
      wb.setParam('prof', idx);
      refresh();
    });

    refresh();
    return { update() { refresh(); } };
  },
};

// ================================================================ 4. 开环控制、比例静差与 PI 闭环抗干扰
const CTRL_MODES = ['开环控制', '纯比例 P（有静差）', '比例积分 PI（消静差）'];

function stepWaterTank(state, params, dt) {
  const hs = (params.set ?? 60) / 100;
  const u = (params.u ?? 50) / 100;
  const kp = params.kp ?? 6.0;
  const ki = params.ki ?? 1.4;
  const mode = params.mode ?? 0;

  const qout = u * 0.9 * Math.sqrt(Math.max(state.h, 0));
  const err = hs - state.h;
  let qin = 0;

  if (mode === 0) {
    // 开环：按名义 50% 用水定死阀门开度
    qin = 0.45 * Math.sqrt(hs);
    state.iTerm = 0;
  } else if (mode === 1) {
    // 纯比例 P：必须维持非零偏差 e = q_out / Kp 才能持续供水（静差）
    qin = clamp(kp * err, 0, 1.35);
    state.iTerm = 0;
  } else {
    // 比例积分 PI + 抗饱和（anti-windup）钳位
    const rawQ = kp * err + state.iTerm;
    const saturatedHigh = rawQ >= 1.35 && err > 0;
    const saturatedLow = rawQ <= 0 && err < 0;
    if (!saturatedHigh && !saturatedLow) {
      state.iTerm = clamp(state.iTerm + ki * err * dt, -0.3, 1.35);
    }
    qin = clamp(kp * err + state.iTerm, 0, 1.35);
  }

  state.h = clamp(state.h + (qin - qout) * dt * 0.42, 0, 1);
  state.qin = qin;
  state.qout = qout;
  state.err = err;
}

export const control = {
  id: 'tech-control',
  subject: 'tech',
  title: '开环控制、比例静差与 PI 闭环抗干扰',
  en: 'Open-loop, proportional & PI closed-loop control',
  lede: [
    '水箱下方的水龙头随时改变用水量（负载干扰），上方进水阀负责补水。开环系统盲目固定阀门开度，用水一变水位就一路滑坡。',
    '加上浮球反馈构成纯比例（P）控制后水位被拉住，却总会差那么一截（静差）；引入积分（PI）环节持续累积偏差，才能把水位死死稳回设定值！',
  ],
  formula: 'dh/dt ∝ q_in − k_u√h · q_in(PI) = K_p e + K_i ∫e dt',
  formulaNote: '纯比例控制在持续出水 q_out > 0 时必须依赖稳态偏差 e = q_out / K_p 维持阀门开启，故必然存在静差；PI 积分项接管稳态供水使 e → 0',
  terms: [
    ['干扰因素', '除给定量之外引起被控量偏离的因素（此处为水龙头用水量 u 阶跃突变）'],
    ['比例静差（Offset）', '纯 P 闭环稳定后，被控量与设定值之间始终消不掉的残余偏差'],
    ['积分消静差（PI）', '只要偏差 e ≠ 0，积分项便持续微调阀门直到 e 精确归零（含抗饱和限幅）'],
  ],
  predict: {
    q: '在纯比例（P）闭环下，把用水量从 30% 突然阶跃拉到 80%，稳定后的最终水位会怎样？',
    options: [
      '精确回到设定水位，偏差为 0',
      '稳在低于设定值的某个位置（出现稳态静差），因为阀门需要靠残余偏差才能开得更大',
      '一直跌到水箱彻底排空',
    ],
    answer: 1,
    why: '纯比例控制器输出 q_in = K_p·(h_set − h)。用水量变大后需要更大的稳态进水量 q_in 来平衡，因此必须留下更大的正偏差 e = h_set − h，这就是比例静差。只有加入积分项（PI）才能消除它。',
  },
  challenge: '切到“比例 P”按“阶跃扰动 (+30%)”观察水位掉出并停在静差处；随后切到“比例积分 PI”，看积分项如何把偏差推回 0.0%！',
  fig: '水箱、电动调节进水阀、浮球反馈连杆与实时控制曲线',
  hint: '点“阶跃扰动”突变用水量，对比开环、P、PI 的响应；打开工作台示波器可同屏叠绘三种控制律的阶跃响应对比！',
  teach: {
    where: '普通高中通用技术 必修《技术与设计 2》第四单元 · 控制及其设计（开环、闭环、干扰与反馈优化）',
    ask: [
      '分别指认该水位系统中的给定量、被控量、控制器、执行器、被控对象与检测反馈装置。',
      '增大比例增益 K_p 可以减小纯 P 控制的静差，为什么不能把 K_p 无限调大？如果 K_p 过大或 K_i 过大，水箱响应会出现什么现象？',
    ],
    simplify: '出水量按伯努利孔口规律 q_out ∝ u√h 建模；执行器阀门流量限制在 [0, 1.35] 并对 PI 积分器做抗积分饱和（anti-windup）钳位，时间为相对仿真秒数。',
  },
  controls: [
    { id: 'mode', type: 'choice', label: '控制律', options: CTRL_MODES, value: 1, wide: true },
    { id: 'set', label: '设定水位', min: 20, max: 80, step: 1, value: 60, unit: '%' },
    { id: 'u', label: '用水量（负载干扰）', min: 0, max: 100, step: 1, value: 50, unit: '%' },
    { id: 'kp', label: '比例增益 Kp', min: 1.0, max: 15.0, step: 0.5, value: 6.0, unit: '' },
    { id: 'ki', label: '积分增益 Ki', min: 0.2, max: 4.0, step: 0.2, value: 1.4, unit: '' },
    { id: 'stepDist', type: 'button', label: '阶跃扰动 (+30%)' },
    { id: 'reset', type: 'button', label: '重置稳态' },
  ],
  record: {
    note: '记录不同控制律与干扰工况下的稳态水位、静差（设定−实际）及阀门开度，验证 PI 消除静差的效果。',
    pending: '施加负载扰动并待水位稳定后，点击“记一组数据”保存稳态表现。',
    columns: [
      { key: 'modeName', label: '控制律' },
      { key: 'setPct', label: '设定水位', unit: '%', digits: 0 },
      { key: 'uPct', label: '用水干扰', unit: '%', digits: 0 },
      { key: 'hPct', label: '实测水位', unit: '%', digits: 1 },
      { key: 'errPct', label: '静差/偏差', unit: '%', digits: 2, stat: true },
      { key: 'valvePct', label: '阀门开度', unit: '%', digits: 0 },
    ],
    sample: (inst, p) => {
      const s = inst.snapshot();
      return {
        _kind: 'model',
        modeName: CTRL_MODES[p.mode ?? 0].split('（')[0],
        setPct: p.set,
        uPct: p.u,
        hPct: s.h * 100,
        errPct: p.set - s.h * 100,
        valvePct: (s.qin / 1.35) * 100,
      };
    },
    summary: (rows) => [
      ['已录入工况', `${rows.length} 组`],
      ['最小绝对偏差', rows.length ? `${Math.min(...rows.map((r) => Math.abs(r.errPct))).toFixed(2)}%` : '—'],
    ],
    errors: [
      '尚未等到系统过渡过程稳定就匆忙读数：需观察示波器水位曲线拉平后再记录稳态静差。',
    ],
  },

  build(k) {
    const p = k.p;
    const X = -2.25, Z = -0.8, R = 1.38, H = 3.55, BASE = 1.15;
    k.root.add(at(box(2.55, BASE, 2.2, '#e6e1d3'), X, 0, Z));
    const tank = at(group(
      glass(new THREE.CylinderGeometry(R, R, H, 44, 1, true).translate(0, H / 2, 0)),
      glass(new THREE.CircleGeometry(R, 44).rotateX(-Math.PI / 2).translate(0, 0.03, 0)),
    ), X, BASE, Z);
    const water = at(liquid(R * 0.94, 1, C.sky, 0.52), X, BASE + 0.04, Z);
    const inPipe = tube([[X - 2.35, 0, Z], [X - 2.35, BASE + H + 0.85, Z], [X - 0.5, BASE + H + 0.85, Z], [X - 0.5, BASE + H + 0.45, Z]], 0.125, '#cfd6dc');
    const valve = at(box(0.52, 0.36, 0.52, C.copper), X - 1.4, BASE + H + 0.70, Z);
    const inS = flat(new THREE.CylinderGeometry(1, 1, 1, 12).translate(0, -0.5, 0), C.sky, { opacity: 0.72 });
    const tap = tube([[X + R - 0.04, BASE + 0.3, Z], [X + R + 0.68, BASE + 0.3, Z], [X + R + 0.68, BASE + 0.05, Z]], 0.105, '#cfd6dc');
    const outS = flat(new THREE.CylinderGeometry(1, 1, 1, 12).translate(0, -0.5, 0), C.sky, { opacity: 0.72 });
    const tray = at(group(
      glass(new THREE.CylinderGeometry(0.68, 0.58, 0.38, 28, 1, true).translate(0, 0.19, 0)),
      at(liquid(0.56, 0.18, C.sky, 0.5), 0, 0.03, 0),
    ), X + R + 0.68, 0.02, Z);
    const fl = ball(0.28, '#ffd9a8');
    const arm = rod([0, 0, 0], [1, 0, 0], 0.035, C.ink);
    const mark = flat(new THREE.TorusGeometry(R + 0.035, 0.032, 8, 48).rotateX(Math.PI / 2), C.flame);
    const g = at(plot({ w: 4.3, h: 3.05, xr: [0, 30], yr: [0, 100], xl: '时间 t (s)', yl: '水位 %' }), 2.35, 0, -2.35);
    const info = at(card('\n\n', { w: 4.1, size: 0.30, align: 'left' }), 2.35, 0, 2.55);
    k.root.add(tank, water, inPipe, valve, inS, tap, outS, tray, fl, arm, at(mark, X, 0, Z), g, info);

    const state = { h: (p.set ?? 60) / 100, iTerm: 0.35, qin: 0.35, qout: 0.35, err: 0 };
    let tl = 0, acc = 0;
    const hist = []; // [t, h*100, set, qin*74, u]
    const distMarks = [];

    const resetPlant = () => {
      const hs = (p.set ?? 60) / 100;
      const u = (p.u ?? 50) / 100;
      state.h = hs;
      state.iTerm = u * 0.9 * Math.sqrt(hs);
      state.qin = state.iTerm;
      state.qout = state.iTerm;
      state.err = 0;
      tl = 0; acc = 0;
      hist.length = 0;
      distMarks.length = 0;
      k.dirty();
    };

    return {
      snapshot: () => ({ ...state, tl, hist: hist.slice(), distMarks: distMarks.slice() }),
      injectStep(newU) {
        k.set('u', clamp(Math.round(newU), 0, 100));
        distMarks.push({ t: tl, u: p.u });
        while (distMarks.length && distMarks[0].t < tl - 30) distMarks.shift();
        k.dirty();
      },
      press(id) {
        if (id === 'stepDist') {
          const nextU = p.u >= 75 ? 35 : Math.min(100, p.u + 30);
          k.set('u', nextU);
          distMarks.push({ t: tl, u: nextU });
          while (distMarks.length && distMarks[0].t < tl - 30) distMarks.shift();
          k.dirty();
        } else if (id === 'reset') {
          resetPlant();
        }
      },
      change(id) {
        if (id === 'mode' && p.mode === 2) {
          // 切入 PI 时将积分项从当前进水量平滑初始化（无扰切换）
          state.iTerm = clamp(state.qin - (p.kp ?? 6) * ((p.set ?? 60) / 100 - state.h), 0, 1.35);
        }
        if (id === 'u') {
          distMarks.push({ t: tl, u: p.u });
          while (distMarks.length && distMarks[0].t < tl - 30) distMarks.shift();
        }
      },
      update(dt) {
        if (dt > 0) {
          const sub = Math.max(1, Math.ceil(dt / 0.02));
          for (let i = 0; i < sub; i++) stepWaterTank(state, p, dt / sub);
          tl += dt;
          acc += dt;
        }
        const hs = (p.set ?? 60) / 100;
        const lvl = BASE + 0.04 + state.h * (H - 0.3);
        water.set(Math.max(0.01, state.h * (H - 0.3)));
        inS.position.set(X - 0.5, BASE + H + 0.45, Z);
        inS.scale.set(0.025 + state.qin * 0.08, BASE + H + 0.45 - lvl, 0.025 + state.qin * 0.08);
        inS.visible = state.qin > 0.01;

        outS.position.set(X + R + 0.68, BASE + 0.05, Z);
        outS.scale.set(0.02 + state.qout * 0.09, BASE - 0.1, 0.02 + state.qout * 0.09);
        outS.visible = state.qout > 0.01;

        const isClosed = (p.mode ?? 0) > 0;
        fl.visible = arm.visible = isClosed;
        fl.position.set(X + 0.38, lvl + 0.12, Z);
        arm.span([X + 0.38, lvl + 0.28, Z], [X - 1.4, BASE + H + 0.58, Z]);
        valve.scale.y = 0.55 + state.qin * 0.65;
        mark.position.y = BASE + 0.04 + hs * (H - 0.3);

        if (acc >= 0.12 || hist.length === 0) {
          acc = 0;
          hist.push([tl, state.h * 100, p.set ?? 60, (state.qin / 1.35) * 100, p.u ?? 50]);
          while (hist.length && hist[0][0] < tl - 30) hist.shift();
          const t0 = Math.max(0, tl - 30);
          g.clear()
            .curve([[0, p.set], [30, p.set]], C.flame, 0.028, true)
            .curve(hist.map(([t, , , q]) => [t - t0, q]), C.leaf, 0.026)
            .curve(hist.map(([t, v]) => [t - t0, v]), C.blue, 0.048)
            .done();
        }

        const errPct = (p.set ?? 60) - state.h * 100;
        info.set(
          `${CTRL_MODES[p.mode ?? 0]}\n` +
          `水位 ${(state.h * 100).toFixed(1)}% · 设定 ${p.set}% · 偏差 ${errPct >= 0 ? '+' : ''}${errPct.toFixed(1)}%\n` +
          `阀门开度 ${((state.qin / 1.35) * 100).toFixed(0)}% · 积分项 ${state.iTerm.toFixed(2)}`
        );
      },
      margin() {
        const errPct = (p.set ?? 60) - state.h * 100;
        return [
          CTRL_MODES[p.mode ?? 0].split('（')[0],
          `设定 ${p.set}% | 实测 ${(state.h * 100).toFixed(1)}%`,
          `静差/偏差 ${errPct >= 0 ? '+' : ''}${errPct.toFixed(2)}%`,
          `进水 ${state.qin.toFixed(2)} vs 出水 ${state.qout.toFixed(2)}`,
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    // 1. 实时多通道示波器 + 扰动注入控制条
    const sec1 = wb.section('1 · 实时多通道示波器与负载阶跃扰动注入台');
    const bar = document.createElement('div');
    bar.className = 'wb-btn-row';
    bar.innerHTML = `
      <button type="button" class="wb-btn" data-ctl="m0">切至开环</button>
      <button type="button" class="wb-btn" data-ctl="m1">切至比例 P</button>
      <button type="button" class="wb-btn" data-ctl="m2">切至 PI</button>
      <button type="button" class="wb-btn" data-ctl="u85">注入大负载 u=85%</button>
      <button type="button" class="wb-btn" data-ctl="u25">注入小负载 u=25%</button>
      <button type="button" class="wb-btn" data-ctl="set75">设定阶跃 75%</button>
      <button type="button" class="wb-btn" data-ctl="reset">重置</button>
      <button type="button" class="wb-btn primary" data-ctl="rec">记入稳态数据</button>`;
    sec1.append(bar);

    const scopeCv = wb.canvas(sec1, 520, 215, (x, W, H) => {
      const snap = sp.inst?.snapshot?.() || { h: 0.6, qin: 0.35, iTerm: 0.35, tl: 0, hist: [], distMarks: [] };
      const pad = { l: 44, r: 18, t: 22, b: 30 };
      const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      const t0 = Math.max(0, snap.tl - 30);
      const sx = (t) => pad.l + (clamp(t - t0, 0, 30) / 30) * pw;
      const sy = (pct) => pad.t + ph - (clamp(pct, 0, 100) / 100) * ph;

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      x.strokeStyle = 'rgba(30,43,54,0.1)'; x.lineWidth = 1;
      for (let v = 0; v <= 100; v += 25) {
        x.beginPath(); x.moveTo(pad.l, sy(v)); x.lineTo(pad.l + pw, sy(v)); x.stroke();
      }
      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.4;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();

      // 坐标轴标签
      x.fillStyle = '#51606b'; x.font = '10.5px Georgia,serif'; x.textAlign = 'right';
      for (let v = 0; v <= 100; v += 25) x.fillText(`${v}%`, pad.l - 6, sy(v) + 4);
      x.textAlign = 'center';
      x.fillText('最近 30 s 实时示波窗口', pad.l + pw / 2, H - 6);

      // 扰动事件竖线
      x.save(); x.setLineDash([3, 3]); x.strokeStyle = '#b4653a'; x.lineWidth = 1.2;
      for (const m of snap.distMarks) {
        if (m.t >= t0) {
          const mx = sx(m.t);
          x.beginPath(); x.moveTo(mx, pad.t); x.lineTo(mx, pad.t + ph); x.stroke();
          x.fillStyle = '#b4653a'; x.font = '10px Georgia,serif';
          x.fillText(`u→${m.u}%`, mx + 16, pad.t + 12);
        }
      }
      x.restore();

      const hist = snap.hist;
      if (hist.length > 1) {
        // 偏差阴影带 (setpoint 与 h 之间)
        x.fillStyle = 'rgba(229,72,63,0.10)';
        x.beginPath();
        hist.forEach(([t, hPct], i) => { if (i === 0) x.moveTo(sx(t), sy(hPct)); else x.lineTo(sx(t), sy(hPct)); });
        for (let i = hist.length - 1; i >= 0; i--) x.lineTo(sx(hist[i][0]), sy(hist[i][2]));
        x.closePath(); x.fill();

        // 设定值虚线
        x.save(); x.setLineDash([6, 4]); x.strokeStyle = '#ff6a3d'; x.lineWidth = 1.8; x.beginPath();
        hist.forEach(([t, , sPct], i) => { if (i === 0) x.moveTo(sx(t), sy(sPct)); else x.lineTo(sx(t), sy(sPct)); });
        x.stroke(); x.restore();

        // 阀门开度绿线
        x.strokeStyle = '#2fb46a'; x.lineWidth = 1.4; x.beginPath();
        hist.forEach(([t, , , qPct], i) => { if (i === 0) x.moveTo(sx(t), sy(qPct)); else x.lineTo(sx(t), sy(qPct)); });
        x.stroke();

        // 实测水位蓝线
        x.strokeStyle = '#3b6fe0'; x.lineWidth = 2.4; x.beginPath();
        hist.forEach(([t, hPct], i) => { if (i === 0) x.moveTo(sx(t), sy(hPct)); else x.lineTo(sx(t), sy(hPct)); });
        x.stroke();
      }
      x.textAlign = 'left'; x.font = '11px "Noto Serif SC",serif';
      x.fillStyle = '#3b6fe0'; x.fillText('— 水位 h(t)', pad.l + 8, 13);
      x.fillStyle = '#ff6a3d'; x.fillText('-- 设定 r(t)', pad.l + 92, 13);
      x.fillStyle = '#2fb46a'; x.fillText('— 阀门开度 q_in(t)', pad.l + 178, 13);
      x.fillStyle = '#b4653a'; x.fillText('阴影=偏差 |e|', pad.l + 305, 13);
    });

    const diag = document.createElement('div');
    diag.className = 'wb-metrics';
    sec1.append(diag);

    // 2. 同起点三控制律（开环 / P / PI）阶跃负载扰动叠加对比仿真
    const sec2 = wb.section('2 · 同起点三控制律阶跃响应叠加对比（t = 6 s 负载从 50% 阶跃升至 85%）');
    const cmpCv = wb.canvas(sec2, 520, 195, (x, W, H) => {
      const p = sp.params;
      const hs = (p.set ?? 60) / 100;
      const kp = p.kp ?? 6.0, ki = p.ki ?? 1.4;
      const dt = 0.05, T = 36, steps = Math.round(T / dt);
      const traces = [0, 1, 2].map((m) => {
        const st = { h: hs, iTerm: 0.5 * 0.9 * Math.sqrt(hs), qin: 0, qout: 0, err: 0 };
        const pts = [];
        for (let i = 0; i <= steps; i++) {
          const t = i * dt;
          pts.push([t, st.h * 100]);
          stepWaterTank(st, { mode: m, set: p.set ?? 60, u: t >= 6 ? 85 : 50, kp, ki }, dt);
        }
        return pts;
      });

      const pad = { l: 44, r: 18, t: 22, b: 30 };
      const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      const sx = (t) => pad.l + (t / T) * pw;
      const sy = (pct) => pad.t + ph - (clamp(pct, 0, 100) / 100) * ph;

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      x.strokeStyle = 'rgba(30,43,54,0.1)'; x.lineWidth = 1;
      for (let v = 0; v <= 100; v += 25) {
        x.beginPath(); x.moveTo(pad.l, sy(v)); x.lineTo(pad.l + pw, sy(v)); x.stroke();
      }
      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.4;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();

      x.save(); x.setLineDash([4, 4]);
      x.strokeStyle = '#b4653a'; x.beginPath(); x.moveTo(sx(6), pad.t); x.lineTo(sx(6), pad.t + ph); x.stroke();
      x.strokeStyle = '#ff6a3d'; x.beginPath(); x.moveTo(pad.l, sy(p.set ?? 60)); x.lineTo(pad.l + pw, sy(p.set ?? 60)); x.stroke();
      x.restore();

      const cols = ['#e5483f', '#3b6fe0', '#1f4a3e'];
      const names = ['开环（持续失稳）', '纯比例 P（残余静差）', 'PI 闭环（零静差恢复）'];
      traces.forEach((pts, idx) => {
        x.strokeStyle = cols[idx]; x.lineWidth = 2.1; x.beginPath();
        pts.forEach(([t, v], i) => { if (i === 0) x.moveTo(sx(t), sy(v)); else x.lineTo(sx(t), sy(v)); });
        x.stroke();
      });

      x.fillStyle = '#51606b'; x.font = '10.5px Georgia,serif'; x.textAlign = 'right';
      for (let v = 0; v <= 100; v += 25) x.fillText(`${v}%`, pad.l - 6, sy(v) + 4);
      x.textAlign = 'center'; x.fillText('仿真时间 t (s) · t=6s 处施加 +35% 用水阶跃扰动', pad.l + pw / 2, H - 6);
      names.forEach((nm, idx) => {
        x.fillStyle = cols[idx]; x.textAlign = 'left'; x.font = '11px "Noto Serif SC",serif';
        x.fillText(`— ${nm}`, pad.l + 8 + idx * 155, 13);
      });
    });

    const refresh = () => {
      scopeCv.redraw();
      const s = sp.inst?.snapshot?.() || { h: 0.6, qin: 0.35, iTerm: 0 };
      const errPct = (sp.params.set ?? 60) - s.h * 100;
      diag.innerHTML = `
        <div class="wb-m"><span>当前控制律</span><b>${CTRL_MODES[sp.params.mode ?? 0].split('（')[0]}</b></div>
        <div class="wb-m"><span>实时水位 / 偏差</span><b>${(s.h * 100).toFixed(1)}% (${errPct >= 0 ? '+' : ''}${errPct.toFixed(2)}%)</b></div>
        <div class="wb-m"><span>阀门开度 / 积分项</span><b>${((s.qin / 1.35) * 100).toFixed(0)}% / I=${s.iTerm.toFixed(2)}</b></div>`;
    };

    bar.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.ctl;
      if (!act) return;
      if (act === 'm0') wb.setParam('mode', 0);
      else if (act === 'm1') wb.setParam('mode', 1);
      else if (act === 'm2') wb.setParam('mode', 2);
      else if (act === 'u85') sp.inst?.injectStep?.(85);
      else if (act === 'u25') sp.inst?.injectStep?.(25);
      else if (act === 'set75') wb.setParam('set', 75);
      else if (act === 'reset') wb.press('reset');
      else if (act === 'rec') wb.record(control.record.sample(sp.inst, sp.params));
      refresh();
      cmpCv.redraw();
    });

    let lastCmpKey = '';
    const redrawCmpIfChanged = () => {
      const k = `${sp.params.set}|${sp.params.kp}|${sp.params.ki}`;
      if (k !== lastCmpKey) { lastCmpKey = k; cmpCv.redraw(); }
    };

    refresh();
    redrawCmpIfChanged();
    return {
      update() {
        refresh();
        redrawCmpIfChanged();
      },
    };
  },
};

export default [binary, sorting, beam, control];
