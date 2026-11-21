/* 《春天没有收件人》 — deterministic film renderer.
 *
 * renderAt(t) draws the frame for film time t (seconds). Nothing depends on wall-clock
 * time, so the render script can step through frames one by one.
 *
 * Honesty rules baked into this file:
 *  - The terminal is the real recording (data/recording.js) replayed byte for byte by xterm.js.
 *    Speed-ups and skipped idle time are always labelled on screen.
 *  - Every visualisation reads its numbers from data/trace.js, which analysis/trace.py
 *    recomputed from the corpus files Claude Code wrote in the recording.
 *  - Generated lines appear exactly as the program printed them; the one human edit is
 *    drawn in amber and labelled.
 */
'use strict';
const C = window.CUES, R = window.RECORDING, TR = window.TRACE;
const W = 1920, H = 1080;

/* ------------------------------------------------------------------ helpers */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, u) => a + (b - a) * u;
const eio = u => (u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const eo = u => 1 - Math.pow(1 - u, 3);
const ramp = (t, a, b, e = eio) => (b <= a ? (t >= b ? 1 : 0) : e(clamp((t - a) / (b - a))));
function fade(t, a, b, c, d) { if (t <= a || t >= d) return 0; if (t < b) return eio((t - a) / (b - a)); if (t <= c) return 1; return 1 - eio((t - c) / (d - c)); }
function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }
function el(tag, cls, parent, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; }
function chars(parent, text, cls = 'ch') { return [...text].map(c => el('span', cls, parent, c)); }
function setStyle(e, o) { for (const k in o) e.style[k] = o[k]; }
const SFX = []; // sound events exported for the score (music/compose.py)

/* ------------------------------------------------------------------ background + grain */
const bg = document.getElementById('bg').getContext('2d');
const grainCtx = document.getElementById('grain').getContext('2d');
const grainTiles = [];
(function makeGrain() {
  for (let k = 0; k < 8; k++) {
    const c = document.createElement('canvas'); c.width = 960; c.height = 540;
    const g = c.getContext('2d'); const img = g.createImageData(960, 540); let s = 1234 + k * 7919;
    for (let i = 0; i < img.data.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff; const v = (s >>> 16) & 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0); grainTiles.push(c);
  }
})();
function warmthAt(t) { // 0 = neutral (technical), 1 = warm (poems)
  return Math.max(fade(t, 196, 204, 240, 246) * .6, fade(t, 244, 250, 314, 320), fade(t, 332, 338, 420, 426));
}
function drawBackground(t, frame) {
  const w = warmthAt(t);
  bg.fillStyle = '#0b0a09'; bg.fillRect(0, 0, W, H);
  const gx = W * (.5 + .18 * Math.sin(t * .031)), gy = H * (.42 + .1 * Math.cos(t * .023));
  const g = bg.createRadialGradient(gx, gy, 0, gx, gy, 1100);
  g.addColorStop(0, `rgba(${Math.round(lerp(60, 92, w))},${Math.round(lerp(58, 66, w))},${Math.round(lerp(56, 44, w))},${lerp(.32, .42, w)})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  bg.fillStyle = g; bg.fillRect(0, 0, W, H);
  const v = bg.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * 1.05);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.78)');
  bg.fillStyle = v; bg.fillRect(0, 0, W, H);
  grainCtx.clearRect(0, 0, W, H);
  grainCtx.globalAlpha = .055; grainCtx.drawImage(grainTiles[frame % 8], 0, 0, W, H);
}

/* ------------------------------------------------------------------ the real terminal */
const bin = Uint8Array.from(atob(R.b64), c => c.charCodeAt(0));
const term = new Terminal({
  cols: R.cols, rows: R.rows, fontSize: 20, lineHeight: 1.0, scrollback: 5000,
  fontFamily: '"JetBrains Mono", "Noto Sans Mono CJK SC", monospace',
  allowProposedApi: true, cursorBlink: false, cursorStyle: 'block', cursorInactiveStyle: 'none',
  theme: { background: '#0f0f11', foreground: '#e6e3de' },
});
term.loadAddon(new Unicode11Addon.Unicode11Addon());
term.unicode.activeVersion = '11';
term.open(document.getElementById('term'));
let bytePos = R.header;
function byteEndAt(rt) {
  const ev = R.events; let lo = 0, hi = ev.length - 1, ans = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (ev[m][0] <= rt) { ans = m; lo = m + 1; } else hi = m - 1; }
  return ans < 0 ? R.header : ev[ans][1];
}
function termWriteTo(rt) {
  const end = byteEndAt(rt);
  if (end < bytePos) { term.reset(); bytePos = R.header; }
  if (end === bytePos) return Promise.resolve();
  const chunk = bin.slice(bytePos, end); bytePos = end;
  return new Promise(res => term.write(chunk, res));
}
function recAt(t) { // film time -> {rt, seg}
  const S = C.termSegments; let last = null;
  for (const s of S) {
    if (t >= s.film[0] && t < s.film[1]) return { rt: lerp(s.rec[0], s.rec[1], (t - s.film[0]) / (s.film[1] - s.film[0])), seg: s, inside: true };
    if (s.film[1] <= t) last = s;
  }
  if (last) return { rt: last.rec[1], seg: last, inside: false };
  return { rt: S[0].rec[0], seg: S[0], inside: false };
}
let cellW = 12, cellH = 24;
function measureCells() {
  try { const d = term._core._renderService.dimensions.css.cell; if (d.width) { cellW = d.width; cellH = d.height; } } catch (e) { }
}
const PADX = 16, PADY = 14;
function boxW() { return R.cols * cellW + PADX * 2; }
function boxH() { return R.rows * cellH + PADY * 2; }
/* find text in the visible terminal rows; returns box-pixel rect or null */
function locate(text, last = false) {
  const buf = term.buffer.active; const target = [...text];
  const rows = [...Array(R.rows).keys()]; if (last) rows.reverse();
  for (const r of rows) {
    const line = buf.getLine(buf.viewportY + r); if (!line) continue;
    const cells = [];
    for (let x = 0; x < R.cols; x++) { const c = line.getCell(x); if (!c) break; const w = c.getWidth(); if (w === 0) continue; cells.push({ ch: c.getChars() || ' ', x, w }); }
    const s = cells.map(c => c.ch);
    outer: for (let i = 0; i + target.length <= s.length; i++) {
      for (let j = 0; j < target.length; j++) if (s[i + j] !== target[j]) continue outer;
      const a = cells[i], b = cells[i + target.length - 1];
      return { x: PADX + a.x * cellW, y: PADY + r * cellH, w: (b.x + b.w - a.x) * cellW, h: cellH, row: r };
    }
  }
  return null;
}
function findInBuffer(text) { const buf = term.buffer.active; for (let i = 0; i < buf.length; i++) { const l = buf.getLine(i); if (l && l.translateToString(true).includes(text)) return i; } return -1; }

const TERM_VIS = [[3.0, 5.5, 57.2, 58.8], [117.3, 118.3, 156.0, 157.8], [319.0, 320.6, 333.0, 334.6]];
const INPUT = { input: true };
const CENTER = { center: true };
const CAM = [
  [4.0, 1.22, CENTER], [8.3, 1.28, CENTER], [10.2, 1.9, INPUT], [14.6, 1.9, INPUT], [17.2, 1.28, CENTER],
  [28.9, 1.28, CENTER], [30.8, 1.62, { text: '名岂文章黑', dy: -14 }], [33.6, 1.62, { text: '名岂文章黑', dy: -14 }], [35.2, 1.45, { text: '"春风吹又生"' }], [36.99, 1.45, { text: '"春风吹又生"' }],
  [37.0, 1.9, INPUT], [41.0, 1.9, INPUT], [42.6, 1.28, CENTER], [50.6, 1.28, CENTER], [52.6, 1.9, { text: '39. 外面有点饿了' }], [58.8, 2.25, { text: '39. 外面有点饿了' }],
  [118.0, 1.9, INPUT], [122.7, 1.9, INPUT], [124.3, 1.28, CENTER], [132.0, 1.28, CENTER], [134.2, 1.6, { text: 'output_things.txt 里' }], [140.99, 1.7, { text: 'output_things.txt 里' }],
  [141.0, 1.9, INPUT], [144.3, 1.9, INPUT], [145.8, 1.28, CENTER], [150.5, 1.28, CENTER], [152.2, 1.62, { text: '2 个字是唯一一个' }], [157.8, 1.7, { text: '2 个字是唯一一个' }],
  [320.0, 1.28, CENTER], [334.6, 1.62, INPUT],
];
function resolveFocus(f) {
  if (f.center) return [boxW() / 2, boxH() / 2];
  if (f.input) { const r = locate('❯', true); if (r) return [r.x + 420, r.y + cellH / 2 - 40]; return [boxW() / 2, boxH() - 120]; }
  if (f.text) { const r = locate(f.text); if (r) return [Math.min(Math.max(r.x + r.w / 2, 560), boxW() - 560), r.y + r.h / 2 + (f.dy || 0)]; return [boxW() / 2, boxH() / 2]; }
  return [boxW() / 2, boxH() / 2];
}
function cameraAt(t) {
  let i = 0; while (i < CAM.length - 1 && CAM[i + 1][0] <= t) i++;
  const a = CAM[i], b = CAM[Math.min(i + 1, CAM.length - 1)];
  const [ax, ay] = resolveFocus(a[2]);
  if (b === a || t <= a[0]) return { s: a[1], x: ax, y: ay };
  const [bx, by] = resolveFocus(b[2]);
  const u = eio(clamp((t - a[0]) / (b[0] - a[0])));
  return { s: lerp(a[1], b[1], u), x: lerp(ax, bx, u), y: lerp(ay, by, u) };
}
const HL = [
  [31.0, 36.8, '秋风吹又生，一览众山贫。'], [31.3, 36.8, '名岂文章黑，官应老病山。'],
  [34.4, 36.8, '"秋风吹又生"是"春风吹又生"和"秋风吹不尽"'],
  [53.0, 58.8, '外面有点饿了'],
  [134.6, 141.0, '完整输出也存在了 output_things.txt 里。'],
  [152.4, 157.8, '2 个字是唯一一个既不乱、又不只是背书的设置'],
];
const hlLayer = document.getElementById('hl');
const hlBoxes = HL.map(() => el('div', 'hlbox', hlLayer));
const SCROLL = { a: -1, b: -1, end: -1 }; // (no scroll-back: Claude Code clears its scrollback on redraw)
let scrollTargetCache = null;

async function renderTerminal(t) {
  const vis = Math.max(...TERM_VIS.map(v => fade(t, ...v)));
  const cam = document.getElementById('termCam');
  cam.style.opacity = vis;
  cam.style.display = vis > 0.001 ? '' : 'none';
  const { rt, seg, inside } = recAt(t);
  if (vis <= 0.001) { hud.clock = ''; hud.speed = ''; hud.skip = ''; hud.skipO = 0; hud.clockO = 0; return; }
  await termWriteTo(rt);
  // scroll-back scene (a real user action on the real buffer)
  if (t >= SCROLL.a && t < SCROLL.end) {
    if (scrollTargetCache == null) { const idx = findInBuffer(SCROLL.text); scrollTargetCache = Math.max(0, idx - 9); }
    const base = term.buffer.active.baseY; const u = ramp(t, SCROLL.a + .6, SCROLL.b);
    term.scrollToLine(Math.round(lerp(base, scrollTargetCache, u)));
  } else if (term.buffer.active.viewportY !== term.buffer.active.baseY) term.scrollToBottom();
  await new Promise(r => requestAnimationFrame(r));
  measureCells();
  const c = cameraAt(t);
  const box = document.getElementById('termBox');
  box.style.width = boxW() + 'px';
  cam.style.transform = `translate(${W / 2 - c.x * c.s}px, ${H / 2 - c.y * c.s}px) scale(${c.s})`;
  HL.forEach((h, i) => {
    const o = fade(t, h[0], h[0] + .5, h[1] - .5, h[1]); const b = hlBoxes[i];
    if (o <= 0) { b.style.display = 'none'; return; }
    const r = locate(h[2]); if (!r) { b.style.display = 'none'; return; }
    setStyle(b, { display: '', left: (r.x - 6) + 'px', top: (r.y - 3) + 'px', width: (r.w + 12) + 'px', height: (r.h + 6) + 'px', opacity: o });
  });
  // HUD: real timestamp + labelled speed
  const secs = 38 * 60 + 45 + Math.floor(rt);
  hud.clock = `REC  04:${String(Math.floor(secs / 60) % 60).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  hud.clockO = vis;
  hud.speed = inside && seg.label ? seg.label : '';
  hud.skip = inside && seg.skip && t - seg.film[0] < 2.4 ? `⋯  ${seg.skip}  ⋯` : '';
  hud.skipO = inside && seg.skip ? fade(t - seg.film[0], 0, .3, 1.9, 2.4) : 0;
}

/* ------------------------------------------------------------------ HUD: tags, captions */
const hud = { clock: '', speed: '', skip: '', clockO: 0, skipO: 0 };
const RED = '#d9534f', AMBER = '#e2a65a', GREY = '#8a8378';
const FINAL = '定稿 · 此前一次 N-gram 实验的输出，经人工挑选、排列与少量修改';
const TAGS = [
  [2.0, 58.4, '真实录屏 · Claude Code v2.1.330 · 终端原样回放', RED],
  [58.8, 117.4, '可视化 · 依据录屏中第二份语料（94 句）的真实计数', AMBER],
  [118.0, 157.4, '真实录屏 · Claude Code · 终端原样回放', RED],
  [157.8, 176.0, '原始输出 · 录屏中程序的运行结果，未改字', GREY],
  [176.3, 186.1, '原始输出 · output_things.txt 全部 80 行，未改字', GREY],
  [186.3, 188.6, '筛选 · 本片制作时挑选', AMBER],
  [188.8, 221.6, '可视化 · 依据第三份语料（100 句）的真实计数', AMBER],
  [222.4, 245.4, '本次实验 · 原始输出 ＋ 人工修改（琥珀色）', AMBER],
  [246.6, 257.0, FINAL, GREY], [311.4, 319.4, FINAL, GREY],
  [320.4, 333.6, '真实录屏 · 会话结束前', RED],
  [334.6, 345.0, FINAL, GREY], [408.4, 417.6, FINAL, GREY],
];
const CAPS = [
  [17.4, 22.4, '目录是空的。它先写语料，再写程序。'],
  [23.0, 28.2, '第一次，它凭记忆录入了约六十首唐诗，当作语料。'],
  [30.6, 34.0, '程序把唐诗拆成片段，又拼了回去。'],
  [43.2, 49.4, '第二次，语料换成了它写的 94 句日常大白话。'],
  [59.2, 62.4, '外面不会饿。'],
  [62.8, 65.8, '这一行，是怎么来的？'],
  [66.3, 70.4, '第一个字：看语料里每句话怎么开头。'],
  [70.6, 72.4, '按出现的次数，随机抽一个。'],
  [72.6, 76.0, '之后，它只看最后两个字。'],
  [76.3, 80.0, '“有点”后面，语料里出现过九个不同的字。'],
  [80.2, 84.0, '每个都是九分之一。这一次，抽到了“饿”。'],
  [84.4, 89.4, '一直抽下去，直到抽到“句末”。'],
  [90.6, 95.4, '两句平常的话，在“有点”这里接上了。'],
  [95.7, 99.6, '句子的意思，在接缝处拐了个弯。'],
  [100.6, 104.0, '这就是它学会的全部：数一数，再抽一个。'],
  [104.3, 108.0, '程序里没有“外面”，也没有“饿”。只有字。'],
  [109.0, 112.6, '同样的接缝，到处都是。'],
  [124.6, 130.6, '第三次：还是它写的平常句子，换成天气、车站、信、河、钥匙。'],
  [134.8, 140.4, '屏幕上只显示了结尾。完整的 80 行，存在这个文件里。'],
  [145.8, 150.2, '最后，改变它往前看的字数。'],
  [152.6, 157.2, '这是 Claude 自己的总结。'],
  [158.6, 163.0, '看得太少，字和字连不成词；'],
  [163.2, 167.8, '看得太多，就只能背诵原句。'],
  [168.4, 175.4, '这份语料里，81% 的两字组合后面，只跟过一个字。'],
  [177.0, 181.4, 'output_things.txt，第三轮的 80 行。'],
  [181.7, 186.0, '有的不通，有的照抄，有的……'],
  [188.9, 193.0, '“没有”后面，语料里出现过六个不同的字：'],
  [193.2, 197.6, '停，写，去，寄，看，给。每一个，都是六分之一。'],
  [202.0, 206.8, '语料，是 Claude 写下的一百句平常话。'],
  [207.0, 212.0, '里面本来就有一个人，在等一封信。'],
  [212.4, 216.8, '程序只是让其中两句，在“没有”这里相遇。'],
  [217.0, 221.4, '它不会觉得这一行，比另外 79 行更好。'],
  [222.6, 226.4, '觉得它像诗的，是读它的人。'],
  [226.8, 231.4, '挑选，排列——'],
  [231.8, 236.8, '偶尔，改一两个字。'],
  [237.6, 241.8, '此前的一次实验，也是这样完成的。'],
  [242.0, 245.6, '下面是那次实验的两首定稿。'],
  [321.6, 326.6, '程序运行完，就结束了。'],
  [327.0, 332.8, '它不知道这些字的意思，也不会记得写过它们。'],
];
const tagEl = document.getElementById('tag'), tagDot = tagEl.querySelector('i'), tagTxt = tagEl.querySelector('span');
const capEl = document.getElementById('cap');
const capBg = el('div', null, document.getElementById('stage')); capBg.id = 'capBg'; document.getElementById('stage').insertBefore(capBg, capEl);
const capDivs = CAPS.map(c => { const d = el('div', null, capEl, c[2]); d.style.opacity = 0; return d; });
function renderHud(t) {
  let to = 0, tt = '', tc = RED;
  for (const g of TAGS) { const o = fade(t, g[0], g[0] + .5, g[1] - .5, g[1]); if (o > to) { to = o; tt = g[2]; tc = g[3]; } }
  tagEl.style.opacity = to; if (tagTxt.textContent !== tt) tagTxt.textContent = tt; tagDot.style.background = tc;
  CAPS.forEach((c, i) => { const o = fade(t, c[0], c[0] + .45, c[1] - .45, c[1]); capDivs[i].style.opacity = o; capDivs[i].style.display = o > 0 ? '' : 'none'; capDivs[i].style.transform = `translateY(${(1 - o) * 8}px)`; });
  let capMax = 0; CAPS.forEach(c => { capMax = Math.max(capMax, fade(t, c[0] - .3, c[0] + .3, c[1] - .3, c[1] + .3)); });
  capBg.style.opacity = capMax * (parseFloat(document.getElementById('termCam').style.opacity) || 0);
  const ck = document.getElementById('clock'), sp = document.getElementById('speed'), sk = document.getElementById('skip');
  ck.textContent = hud.clock; ck.style.opacity = hud.clockO;
  sp.textContent = hud.speed; sp.style.opacity = hud.clockO;
  sk.textContent = hud.skip; sk.style.opacity = hud.skipO;
}

/* ------------------------------------------------------------------ scene framework */
const sceneRoot = document.getElementById('scene');
const SCENES = [];
function scene(range, build, update) { const s = { range, build, update, root: null }; SCENES.push(s); return s; }
function renderScenes(t) {
  for (const s of SCENES) {
    const on = t >= s.range[0] && t < s.range[1];
    if (on && !s.root) { s.root = el('div', 'sc', sceneRoot); s.build(s.root); }
    if (s.root) { s.root.style.display = on ? '' : 'none'; if (on) s.update(t, s.root); }
  }
}

/* ------------------------------------------------------------------ data helpers */
const EX = TR.explain;
function sentencesWith(corpus, ctx, next) { return corpus.filter(s => ('<<' + s + '>').includes(ctx + next)); }
function dispChar(c) { return c === '>' ? '句末' : c; }

/* ================================================================== ACT: mechanism (58–118) */
const MECH = (() => {
  const line = '外面有点饿了', ex = EX[line];
  // step schedule: [start, pickTime, end]
  const sched = [[66.0, 70.6, 72.4], [72.4, 73.0, 73.8], [73.8, 74.3, 75.0], [75.0, 75.5, 76.2], [76.2, 81.0, 84.2], [84.2, 84.8, 85.6], [85.6, 86.4, 87.6]];
  sched.forEach(s => SFX.push({ t: s[1], type: 'pick' }));
  return { line, ex, sched };
})();
const SLOT = 150, LINE_Y = 352;
const slotX = j => 960 - 2.5 * SLOT + j * SLOT; // char j of the 6-char line; j=-2,-1 start pads, j=6 end
scene([57.0, 118.2], root => {
  const st = MECH;
  st.big = el('div', 'abs big center', root); st.big.style.top = (LINE_Y - 80) + 'px'; st.bigChars = chars(st.big, st.line);
  st.pads = [-2, -1, 6].map(j => { const d = el('div', 'abs', root); setStyle(d, { left: (slotX(j) - 58) + 'px', top: (LINE_Y - 64) + 'px', width: '116px', height: '128px', border: '1.5px dashed rgba(236,229,216,.22)', borderRadius: '10px' }); const lab = el('div', 'note abs', d, j === 6 ? '句末' : '句首'); setStyle(lab, { left: 0, right: 0, top: '138px', textAlign: 'center', fontFamily: 'var(--sans)', fontSize: '19px' }); return d; });
  st.slots = [...st.line].map((c, j) => { const d = el('div', 'abs big', root, c); setStyle(d, { left: (slotX(j) - 60) + 'px', top: (LINE_Y - 80) + 'px', width: '120px', textAlign: 'center' }); return d; });
  st.endMark = el('div', 'abs', root, '句末'); setStyle(st.endMark, { left: (slotX(6) - 58) + 'px', top: (LINE_Y - 30) + 'px', width: '116px', textAlign: 'center', fontSize: '34px', color: 'var(--amber)' });
  st.q = el('div', 'abs big', root, '?'); setStyle(st.q, { width: '120px', textAlign: 'center', color: 'rgba(226,166,90,.75)', fontFamily: 'var(--mono)', fontSize: '84px', top: (LINE_Y - 56) + 'px' });
  st.win = el('div', 'abs', root); setStyle(st.win, { top: (LINE_Y - 76) + 'px', height: '152px', borderRadius: '14px', boxShadow: '0 0 0 2px rgba(226,166,90,.95), 0 0 40px rgba(226,166,90,.25)' });
  st.winLab = el('div', 'abs', st.win, '只看这两个字'); setStyle(st.winLab, { left: 0, right: 0, top: '-46px', textAlign: 'center', fontSize: '21px', color: 'var(--amber)', letterSpacing: '.1em' });
  // probability strips (one per step)
  st.strips = MECH.ex.steps.map((s, k) => {
    const d = el('div', 'abs', root); setStyle(d, { left: '260px', top: '640px', width: '1400px', height: '70px' });
    const total = s.total; let x = 0; const segs = [];
    s.dist.forEach(([c, n], i) => {
      const w = 1400 * n / total; const g = el('div', 'abs', d);
      const bgc = i % 2 ? 'rgba(236,229,216,.13)' : 'rgba(236,229,216,.2)'; g.dataset.bg = bgc;
      setStyle(g, { left: x + 'px', width: Math.max(w - 2, 1) + 'px', top: 0, height: '70px', background: bgc, borderRadius: '3px' });
      if (w > 30) { const lab = el('div', 'abs', g, dispChar(c)); setStyle(lab, { left: 0, right: 0, top: '12px', textAlign: 'center', fontSize: c === '>' ? '22px' : '36px', lineHeight: '44px' }); }
      if (w > 60 && n > 1) { const cn = el('div', 'abs note', g, String(n)); setStyle(cn, { left: 0, right: 0, top: '78px', textAlign: 'center', fontSize: '18px' }); }
      segs.push({ c, n, x, w, g }); x += w;
    });
    const head = el('div', 'abs note', d); setStyle(head, { left: 0, top: '-44px', fontSize: '20px', fontFamily: 'var(--sans)', color: '#b9b1a3' });
    const ctxShow = s.ctx.replace(/</g, '·');
    head.textContent = s.ctx === '<<' ? `句首之后，语料里出现过的字（共 ${total} 次）` : `「${ctxShow}」之后，语料里出现过的字（共 ${total} 次）`;
    const pick = segs.find(sg => sg.c === s.pick);
    const pickLab = el('div', 'abs', d, `${dispChar(s.pick)}  ${pick.n}/${total}`); setStyle(pickLab, { left: (pick.x + pick.w / 2 - 100) + 'px', width: '200px', textAlign: 'center', top: '112px', fontSize: '26px', color: 'var(--amber)', fontFamily: 'var(--sans)' });
    const marker = el('div', 'abs', d); setStyle(marker, { width: '2px', height: '96px', background: 'var(--amber)', boxShadow: '0 0 12px rgba(226,166,90,.8)' });
    const mx = pick.x + pick.w * (.35 + .3 * hash(k + 17));
    // the source sentence under each candidate (shown for the many-way junction)
    const srcs = [];
    if (s.dist.length > 1 && s.dist.length <= 12) {
      segs.forEach(sg => {
        const sent = sentencesWith(TR.corpus_modern, s.ctx, sg.c)[0]; if (!sent) return;
        const v = el('div', 'abs', d); setStyle(v, { left: (sg.x + sg.w / 2 - 14) + 'px', top: '170px', writingMode: 'vertical-rl', height: '330px', fontSize: '22px', letterSpacing: '.12em', color: '#8a8378', lineHeight: '28px' });
        const i0 = sent.indexOf(s.ctx + sg.c);
        [...sent].forEach((ch, ci) => { const sp = el('span', null, v, ch); if (ci >= i0 && ci < i0 + 3) sp.style.color = sg.c === s.pick ? 'var(--amber)' : '#d6cfc2'; });
        srcs.push(v);
      });
    }
    return { d, segs, pick, pickLab, marker, mx, srcs };
  });
  // seam view (90–100)
  st.seam = buildSeam(root, line => line, '外面有点饿了', TR.corpus_modern);
  // code card (100–108)
  const card = el('div', 'abs', root); st.card = card;
  setStyle(card, { left: '300px', right: '300px', top: '330px', padding: '44px 56px', borderRadius: '14px', background: 'rgba(15,15,17,.92)', boxShadow: '0 0 0 1px rgba(255,255,255,.08), 0 30px 90px rgba(0,0,0,.6)' });
  const fn = el('div', 'note', card, 'ngram.py · 录屏中 Claude Code 写下的代码（原样）'); fn.style.marginBottom = '30px';
  const L = (no, code, cmt) => {
    const row = el('div', null, card); setStyle(row, { display: 'flex', alignItems: 'baseline', gap: '28px', margin: '18px 0' });
    const n = el('span', 'mono', row, String(no)); setStyle(n, { color: '#5d584f', fontSize: '24px', width: '36px', textAlign: 'right' });
    const c = el('span', 'mono', row); c.innerHTML = code; setStyle(c, { fontSize: '28px', color: '#e6e3de', whiteSpace: 'pre' });
    const k = el('div', null, card, cmt); setStyle(k, { marginLeft: '64px', fontSize: '24px', color: 'var(--amber)', letterSpacing: '.08em' });
  };
  L(28, 'self.counts[k][ctx][toks[i]] <span style="color:#e2a65a">+= 1</span>', '训练：这几个字后面跟着哪个字，记一次');
  L(40, 'return rng.<span style="color:#e2a65a">choices</span>(chars, weights)[0]', '生成：按记下的次数，随机抽一个');
  // montage (108–118)
  st.mont = [buildSeam(root, null, '电梯今天又要加班了', TR.corpus_modern), buildSeam(root, null, '书里的故事有点堵车', TR.corpus_modern)];
}, (t, root) => {
  const st = MECH;
  // 57–64: the line arrives big, then dissolves into empty slots
  const bigO = fade(t, 57.2, 58.6, 63.0, 64.4);
  st.big.style.opacity = bigO; st.big.style.display = bigO > 0 ? '' : 'none';
  st.bigChars.forEach((c, j) => { c.style.transform = `translateY(${(1 - ramp(t, 57.2 + j * .06, 58.8 + j * .06)) * 14}px)`; });
  const padO = fade(t, 63.4, 64.6, 88.8, 90.0);
  st.pads.forEach((p, i) => { p.style.opacity = padO * (i === 2 ? (t < 86.4 ? 1 : 1 - ramp(t, 86.4, 86.8)) : 1); });
  // filled slots
  st.slots.forEach((s, j) => {
    const sc = st.sched[j]; const shown = t >= sc[1] + .45;
    const u = ramp(t, sc[1], sc[1] + .55, eo);
    s.style.display = t >= sc[1] && t < 90.2 ? '' : 'none';
    if (t >= sc[1]) {
      const stripY = 640 + 35 - (LINE_Y); const pick = st.strips[j].pick;
      const fromX = 260 + pick.x + pick.w / 2 - slotX(j);
      s.style.transform = `translate(${(1 - u) * fromX}px, ${(1 - u) * stripY}px) scale(${lerp(.42, 1, u)})`;
      s.style.color = shown && t < 89.0 ? (j === 4 ? 'var(--amber)' : 'var(--paper)') : 'var(--paper)';
      s.style.opacity = 1 - ramp(t, 89.6, 90.2);
    }
  });
  const endO = t >= st.sched[6][1] ? ramp(t, st.sched[6][1], st.sched[6][1] + .5) * (1 - ramp(t, 88.8, 90)) : 0;
  st.endMark.style.opacity = endO;
  // the window + question mark
  let k = st.sched.findIndex(s => t >= s[0] && t < s[2]);
  const winO = fade(t, 65.6, 66.3, 87.4, 88.4);
  st.win.style.opacity = winO; st.q.style.opacity = 0;
  if (k >= 0 || (t >= 87.4 && t < 88.4)) {
    if (k < 0) k = 6;
    const prevK = Math.max(0, k - 1); const u = ramp(t, st.sched[k][0], st.sched[k][0] + .45);
    const pos = j => slotX(j - 2) - 66;
    const x = lerp(pos(prevK), pos(k), k === 0 ? 1 : u);
    setStyle(st.win, { left: x + 'px', width: (SLOT + 132) + 'px' });
    const qO = t < st.sched[k][1] ? fade(t, st.sched[k][0] + .2, st.sched[k][0] + .5, st.sched[k][1] - .1, st.sched[k][1]) : 0;
    setStyle(st.q, { left: (slotX(k) - 60) + 'px', opacity: qO * (.55 + .45 * Math.sin(t * 6) ** 2) });
  }
  // strips
  st.strips.forEach((s, j) => {
    const sc = st.sched[j];
    const o = fade(t, sc[0] + .15, sc[0] + .5, sc[2] - .25, sc[2] + (j === 6 ? 1.4 : .05));
    s.d.style.display = o > 0 ? '' : 'none'; if (o <= 0) return;
    s.d.style.opacity = o;
    s.segs.forEach((g, i) => { g.g.style.transform = `scaleY(${ramp(t, sc[0] + .15 + i * .012, sc[0] + .6 + i * .012, eo)})`; g.g.style.transformOrigin = 'bottom'; });
    const dropU = ramp(t, sc[1] - .45, sc[1], t => t * t);
    setStyle(s.marker, { left: s.mx + 'px', top: (lerp(-140, -14, dropU)) + 'px', opacity: t > sc[1] - .5 ? 1 : 0 });
    const hit = t >= sc[1];
    s.pick.g.style.background = hit ? 'rgba(226,166,90,.85)' : s.pick.g.dataset.bg;
    s.pickLab.style.opacity = hit ? ramp(t, sc[1], sc[1] + .3) : 0;
    s.srcs.forEach((v, i) => { v.style.opacity = fade(t, sc[0] + .8 + i * .12, sc[0] + 1.3 + i * .12, sc[2] - .3, sc[2]); });
  });
  // seams 89.6–100.4
  updateSeam(st.seam, t, 89.4, 100.0, { fromMech: true });
  // code card 100–108
  const co = fade(t, 100.0, 100.8, 107.6, 108.4); st.card.style.opacity = co; st.card.style.display = co > 0 ? '' : 'none';
  st.card.style.transform = `translateY(${(1 - co) * 16}px)`;
  updateSeam(st.mont[0], t, 108.4, 113.4, {});
  updateSeam(st.mont[1], t, 113.2, 118.0, {});
});

/* generic "seam" view: generated line in the middle, its source sentences above/below,
   aligned where they share the two-character context */
function buildSeam(root, _unused, line, corpus) {
  const ex = EX[line]; const pcs = ex.seams;
  const rowsY = [362, 540, 718];
  const d = el('div', 'abs', root); setStyle(d, { inset: 0 });
  // alignment: piece p's sentence starts at line index (from - sent_from)
  const starts = pcs.map(p => p.from - p.sent_from);
  let minI = 0, maxI = [...line].length - 1;
  pcs.forEach((p, i) => { const s = corpus[p.sent]; minI = Math.min(minI, starts[i]); maxI = Math.max(maxI, starts[i] + [...s].length - 1); });
  const span = maxI - minI + 1; const sp = Math.min(140, 1640 / span); const fs = Math.round(sp * .7);
  const x0 = 960 - (span - 1) * sp / 2 - minI * sp;
  const xOf = i => x0 + i * sp;
  const COL = ['var(--amber)', 'var(--blue)', '#c9a6d8'];
  const lineChars = [...line].map((c, i) => {
    const e = el('div', 'abs', d, c); setStyle(e, { left: (xOf(i) - sp / 2) + 'px', width: sp + 'px', textAlign: 'center', top: (rowsY[1] - fs * .7) + 'px', fontSize: fs + 'px' });
    const owners = pcs.map((p, k) => (i >= p.from && i < p.to ? k : -1)).filter(k => k >= 0);
    e.style.color = owners.length > 1 ? '#fffaf0' : COL[owners[0] % 3];
    if (owners.length > 1) e.style.textShadow = '0 0 22px rgba(255,240,210,.85)';
    return e;
  });
  const srcRows = pcs.map((p, k) => {
    const s = [...corpus[p.sent]]; const y = pcs.length === 2 ? rowsY[k === 0 ? 0 : 2] : rowsY[0] - 30 + k * (rowsY[2] - rowsY[0] + 60) / (pcs.length - 1);
    const items = s.map((c, j) => {
      const li = starts[k] + j; const used = li >= p.from && li < p.to;
      const e = el('div', 'abs', d, c); setStyle(e, { left: (xOf(li) - sp / 2) + 'px', width: sp + 'px', textAlign: 'center', top: (y - fs * .5) + 'px', fontSize: Math.round(fs * .62) + 'px', color: used ? COL[k % 3] : '#5f5a52' });
      return e;
    });
    return { items, y };
  });
  return { d, lineChars, srcRows, rowsY, fs };
}
function updateSeam(sv, t, a, b, opt) {
  const o = fade(t, a, a + .8, b - .6, b); sv.d.style.display = o > 0 ? '' : 'none'; if (o <= 0) return;
  sv.d.style.opacity = o;
  sv.srcRows.forEach((r, k) => {
    const u = ramp(t, a + .5 + k * .35, a + 1.5 + k * .35, eo);
    r.items.forEach(e => { e.style.opacity = u; e.style.transform = `translateY(${(1 - u) * (r.y < sv.rowsY[1] ? -26 : 26)}px)`; });
  });
  sv.lineChars.forEach((e, i) => { const u = opt.fromMech ? 1 : ramp(t, a + i * .05, a + .6 + i * .05); e.style.opacity = u; });
}

/* ================================================================== ACT: window-size sweep (157–176) */
scene([156.5, 176.6], root => {
  const n1 = TR.n_sweep['1'][4].slice(4), n2 = TR.n_sweep['2'][5].slice(4), n5 = TR.n_sweep['5'][5].slice(4).replace('  [语料原句]', '');
  const rows = [
    { k: 0, label: '只看前 0 个字', line: n1, note: '各自独立地抽字' },
    { k: 1, label: '只看前 1 个字', line: n2, note: '能拼出词，拼不成句' },
    { k: 2, label: '只看前 2 个字', line: '外面的雨还没有给我回信', note: '第三轮 · 第 34 行' },
    { k: 4, label: '只看前 4 个字', line: n5, note: '与语料原句一字不差' },
  ];
  root._rows = rows.map((r, i) => {
    const y = 250 + i * 150; const g = el('div', 'abs', root); setStyle(g, { left: 0, right: 0, top: y + 'px', height: '120px' });
    const lab = el('div', 'abs', g, r.label); setStyle(lab, { left: '170px', top: '16px', fontSize: '26px', color: '#b9b1a3', letterSpacing: '.06em' });
    const boxes = el('div', 'abs', g); setStyle(boxes, { left: '170px', top: '62px', display: 'flex', gap: '6px' });
    for (let q = 0; q < 4; q++) { const b = el('div', null, boxes); setStyle(b, { width: '22px', height: '22px', borderRadius: '4px', border: '1.5px solid ' + (q < r.k ? 'var(--amber)' : 'rgba(236,229,216,.18)'), background: q < r.k ? 'rgba(226,166,90,.25)' : 'transparent' }); }
    const arrow = el('div', null, boxes, '→ ?'); setStyle(arrow, { fontFamily: 'var(--mono)', fontSize: '20px', color: 'var(--amber)', marginLeft: '6px', lineHeight: '22px' });
    const txt = el('div', 'abs', g); setStyle(txt, { left: '520px', top: '4px', fontSize: '50px', letterSpacing: '.04em', color: r.k === 2 ? 'var(--paper)' : '#cfc8bb', whiteSpace: 'nowrap' });
    const cs = chars(txt, r.line);
    const note = el('div', 'abs note', g, r.note); setStyle(note, { left: '524px', top: '80px', fontFamily: 'var(--sans)', fontSize: '20px' });
    return { g, cs, note, lab, boxes };
  });
  const ax = el('div', 'abs', root); root._ax = ax; setStyle(ax, { left: '520px', width: '1240px', top: '880px', height: '2px', background: 'linear-gradient(90deg, rgba(141,180,204,.1), rgba(226,166,90,.9) 50%, rgba(141,180,204,.1))' });
  const l1 = el('div', 'abs note', ax, '噪声'); setStyle(l1, { left: '-10px', top: '14px', fontFamily: 'var(--sans)', fontSize: '22px' });
  const l2 = el('div', 'abs note', ax, '背诵'); setStyle(l2, { right: '-10px', top: '14px', fontFamily: 'var(--sans)', fontSize: '22px' });
  const l3 = el('div', 'abs note', ax, '奇怪的新句子'); setStyle(l3, { left: '560px', top: '14px', fontFamily: 'var(--sans)', fontSize: '22px', color: 'var(--amber)' });
}, (t, root) => {
  const o = fade(t, 156.8, 157.8, 175.4, 176.5); root.style.opacity = o;
  root._rows.forEach((r, i) => {
    const a = 157.8 + i * 1.2; const u = ramp(t, a, a + .6);
    r.g.style.opacity = u;
    r.cs.forEach((c, j) => { c.style.opacity = ramp(t, a + .2 + j * .035, a + .5 + j * .035); });
    r.g.style.opacity = u * (t > 168 ? lerp(1, i === 2 ? 1 : .45, ramp(t, 168, 169.5)) : 1);
  });
  root._ax.style.opacity = ramp(t, 163.4, 164.6);
});

/* ================================================================== ACT: junction (176–222) + small poem (222–246) */
const JUNC = (() => {
  const all = TR.corpus_things.filter(s => s.includes('没有'));
  // order: the two that will meet go first and last
  const top = '外面的雨还没有停', bottom = '他一直没有给我回信';
  const mid = all.filter(s => s !== top && s !== bottom);
  return { rows: [top, ...mid, bottom] };
})();
SFX.push({ t: 186.3, type: 'select' }, { t: 199.5, type: 'land' });
const PICKED80 = [34, 67, 9, 23, 25, 33, 55]; // 1-based line numbers chosen during production
scene([175.8, 246.4], root => {
  // field of 80 raw lines
  const field = el('div', 'abs', root); root._field = field; setStyle(field, { inset: 0 });
  root._items = TR.raw80.map((s, i) => {
    const col = i < 40 ? 0 : 1, row = i % 40;
    const e = el('div', 'abs', field); setStyle(e, { left: (col ? 1010 : 170) + 'px', top: (96 + row * 22.4) + 'px', fontSize: '17px', whiteSpace: 'nowrap', color: '#9a9388' });
    const n = el('span', 'mono', e, String(i + 1).padStart(2, ' ') + '. '); n.style.color = '#5d584f';
    el('span', null, e, s);
    if (TR.copies80[i]) { const m = el('span', null, e, '  [语料原句]'); m.style.color = '#5d584f'; }
    return e;
  });
  // KWIC concordance on 没有
  const SP = 60, FS = 48, keyX = 960 - SP; // 没 at keyX, 有 at keyX+SP
  root._kw = JUNC.rows.map((s, r) => {
    const y = 300 + r * 96; const i0 = s.indexOf('没有'); const cs = [...s];
    const items = cs.map((c, j) => {
      const e = el('div', 'abs', root, c); const x = keyX + (j - i0) * SP;
      setStyle(e, { left: (x - SP / 2) + 'px', width: SP + 'px', textAlign: 'center', top: (y - FS * .7) + 'px', fontSize: FS + 'px', color: '#cfc8bb' });
      return { e, j, rel: j - i0, x, y };
    });
    return { items, r, i0, y };
  });
  const band = el('div', 'abs', root); root._band = band;
  setStyle(band, { left: (keyX - SP / 2 - 8) + 'px', width: (SP * 2 + 16) + 'px', top: '226px', height: '600px', borderRadius: '12px', background: 'linear-gradient(180deg, rgba(255,240,210,0), rgba(255,240,210,.09) 20%, rgba(255,240,210,.09) 80%, rgba(255,240,210,0))' });
  // small poem (this run's lines; one labelled human edit)
  const sp = el('div', 'abs', root); root._sp = sp; setStyle(sp, { inset: 0 });
  const LINES = [['信封上的雪很厚', 9], ['我坐在车站的钟', 25], ['钟停了，我也没有看见我', 67]];
  root._spLines = LINES.map(([s, no], i) => {
    const e = el('div', 'abs serif', sp); setStyle(e, { left: 0, right: 0, textAlign: 'center', top: (420 + i * 104) + 'px', fontSize: '54px', letterSpacing: '.12em', color: 'var(--paper)', fontWeight: 400 });
    const main = el('span', null, e, s);
    let ins = null; if (no === 25) { ins = el('span', null, e, '声里'); ins.style.color = 'var(--amber)'; }
    const n = el('div', 'abs note', sp, `第 ${no} 行`); setStyle(n, { left: '1500px', top: (446 + i * 104) + 'px', fontFamily: 'var(--sans)', fontSize: '19px' });
    return { e, main, ins, n };
  });
  root._n34 = el('div', 'abs note', sp, '第 34 行'); setStyle(root._n34, { left: '1500px', top: '342px', fontFamily: 'var(--sans)', fontSize: '19px' });
  root._editNote = el('div', 'abs', sp, '人工修改 · +2 字'); setStyle(root._editNote, { left: 0, right: 0, textAlign: 'center', top: '742px', fontSize: '22px', color: 'var(--amber)', letterSpacing: '.12em' });
  SFX.push({ t: 232.6, type: 'key' }, { t: 233.05, type: 'key' });
}, (t, root) => {
  // field
  const fo = fade(t, 176.0, 176.8, 188.0, 189.2); root._field.style.display = fo > 0 ? '' : 'none'; root._field.style.opacity = fo;
  root._items.forEach((e, i) => {
    const a = 176.2 + (i % 40) * .04 + (i >= 40 ? .3 : 0);
    const picked = PICKED80.includes(i + 1);
    const sel = ramp(t, 186.3 + PICKED80.indexOf(i + 1) * .12, 186.9 + PICKED80.indexOf(i + 1) * .12);
    const base = ramp(t, a, a + .4);
    e.style.opacity = base * (picked ? 1 : lerp(1, .16, ramp(t, 186.2, 187.2)));
    e.style.color = picked && t > 186.3 ? `rgba(${Math.round(lerp(154, 240, sel))},${Math.round(lerp(147, 232, sel))},${Math.round(lerp(136, 216, sel))},1)` : '#9a9388';
  });
  // KWIC
  const kwO = fade(t, 188.4, 189.6, 245.0, 246.2);
  root._band.style.opacity = fade(t, 189.2, 190.4, 196.6, 198.0);
  const meet = ramp(t, 196.6, 199.5);
  const serifU = ramp(t, 202.6, 205.6);
  const upU = ramp(t, 223.0, 225.0); // line rises to make room for the small poem
  root._kw.forEach((row, r) => {
    const first = r === 0, last = r === JUNC.rows.length - 1;
    row.items.forEach(it => {
      const a = 188.6 + r * .22; let o = ramp(t, a, a + .6) * kwO;
      const nextChar = it.rel === 2;
      let col = '#cfc8bb', y = row.y, x = it.x;
      if (nextChar && t > 193.2) { const u = ramp(t, 193.2 + r * .18, 193.6 + r * .18); col = `rgba(${Math.round(lerp(207, 226, u))},${Math.round(lerp(200, 166, u))},${Math.round(lerp(187, 90, u))},1)`; }
      // which characters survive the meeting
      const keep = (first && it.rel < 2) || (last && it.rel >= 2);
      if (!keep) o *= 1 - ramp(t, 196.6 + (first || last ? .4 : 0), 197.8 + (first || last ? .4 : 0));
      if (keep) {
        y = lerp(row.y, 540, meet);
        if (first) col = mix(col, '#e2a65a', meet * (it.rel < 0 ? 1 : 0));
        if (first && it.rel >= 0) col = mix(col, '#fffaf0', meet);
        if (last) col = mix(col, '#8db4cc', meet);
        col = mix(col, '#ece5d8', serifU);
        x = x + 60 * meet; // recentre: 5 chars left of the junction, 4 right
        y = lerp(y, 330, upU);
        it.e.style.fontFamily = serifU > .5 ? 'var(--serif)' : 'var(--sans)';
        it.e.style.fontSize = lerp(48, 58, serifU) + 'px';
        it.e.style.textShadow = first && it.rel >= 0 && it.rel < 2 ? `0 0 ${24 * meet * (1 - serifU)}px rgba(255,240,210,.9)` : 'none';
      }
      setStyle(it.e, { opacity: o, color: col, top: (y - 48 * .7) + 'px', left: (x - 30) + 'px' });
    });
  });
  // small poem
  const spO = fade(t, 222.0, 222.5, 245.0, 246.2); root._sp.style.opacity = spO; root._sp.style.display = spO > 0 ? '' : 'none';
  root._n34.style.opacity = ramp(t, 224.4, 225.2);
  root._spLines.forEach((l, i) => {
    const a = 226.4 + i * 1.6; l.e.style.opacity = ramp(t, a, a + 1.0); l.n.style.opacity = ramp(t, a + .4, a + 1.2);
    l.e.style.transform = `translateY(${(1 - ramp(t, a, a + 1.0, eo)) * 10}px)`;
    if (l.ins) { const s = '声里'; const k = t < 232.6 ? 0 : t < 233.05 ? 1 : 2; l.ins.textContent = s.slice(0, k); }
  });
  root._editNote.style.opacity = fade(t, 233.2, 233.8, 240.5, 241.5);
});
function mix(c1, c2, u) {
  const p = c => { if (c.startsWith('#')) { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; } const m = c.match(/[\d.]+/g).map(Number); return m.slice(0, 3); };
  const a = p(c1), b = p(c2); return `rgb(${Math.round(lerp(a[0], b[0], u))},${Math.round(lerp(a[1], b[1], u))},${Math.round(lerp(a[2], b[2], u))})`;
}

/* ================================================================== the two poems */
const POEM1 = { title: '失物招领', lines: [
  '后来天空学会了失物招领', '有人在教室捡到旧时间', '信里写着：一场雨留给黄昏', '河流认出了窗户', '夜晚把名字弄丢了',
  '后来车站把名字交给了风', '请把钥匙放在靠窗的位置', '时钟没有归还那把钥匙', '那年我们把自己的名字弄丢了',
  '我在黑夜里排队，等春天来领走明天', '直到影子认出了另一个早晨。'], cue: C.poem1, machineView: 3 };
const POEM2 = { title: '春天没有收件人', lines: [
  '凌晨有人问时间会不会认错回家的路', '月亮走过操场，捡到没有寄出的路', '风把远方塞进了半开的回信', '雨停以后河流替山记住了全部花期',
  '河流还不知道自己的名字', '春天带走了每一个没有地址的夏天', '黄昏把远方塞进了空椅子', '钟表背着所有来不及说的话，还给树',
  '回声在黎明之前又叫了一个秋天', '我把一段沉默交给了凌晨的河。'], cue: C.poem2, alone: 4, titleGlow: '没有', dissolve: true };
function poemScene(P, endT) {
  const cue = P.cue; const LS = cue.lines; const nL = P.lines.length;
  scene([cue.title[0] - .2, endT], root => {
    const tt = el('div', 'abs serif center', root); setStyle(tt, { top: '470px', fontSize: '78px', letterSpacing: '.42em', fontWeight: 300, paddingLeft: '.42em' });
    root._title = chars(tt, P.title); root._tt = tt;
    root._lines = P.lines.map((s, i) => {
      const e = el('div', 'abs serif center', root); setStyle(e, { top: '0px', fontSize: '60px', letterSpacing: '.14em', fontWeight: 400, paddingLeft: '.14em' });
      return { e, cs: chars(e, s) };
    });
    // machine view brackets (window sliding over pairs)
    root._mv = el('div', 'abs', root); setStyle(root._mv, { height: '96px', borderRadius: '10px', boxShadow: '0 0 0 1.5px rgba(226,166,90,.8)' });
    // full page
    const page = el('div', 'abs serif', root); root._page = page; setStyle(page, { left: 0, right: 0, top: '0px', textAlign: 'center' });
    const pt = el('div', null, page, P.title); root._pt = pt; setStyle(pt, { fontSize: '40px', letterSpacing: '.4em', paddingLeft: '.4em', marginBottom: '44px', fontWeight: 300, color: '#d8d0c2' });
    root._pageLines = P.lines.map(s => { const d = el('div', null, page); setStyle(d, { fontSize: '35px', letterSpacing: '.12em', lineHeight: '66px', color: '#e6dfd2' }); return { d, cs: chars(d, s) }; });
    root._pageH = 40 + 44 + nL * 66;
    page.style.top = Math.round((H - root._pageH) / 2 - 10) + 'px';
    SFX.push({ t: cue.title[0], type: 'title' });
  }, (t, root) => {
    // title
    const to = fade(t, cue.title[0], cue.title[0] + 1.4, cue.title[1] - 1.2, cue.title[1] - .1);
    root._tt.style.opacity = to;
    root._title.forEach((c, j) => {
      c.style.opacity = ramp(t, cue.title[0] + j * .16, cue.title[0] + 1.0 + j * .16);
      if (P.titleGlow) { const gi = P.title.indexOf(P.titleGlow); const g = (j === gi || j === gi + 1) ? fade(t, cue.title[0] + 2.0, cue.title[0] + 2.8, cue.title[1] - 2.0, cue.title[1] - 1.0) : 0; c.style.color = mix('#ece5d8', '#e2a65a', g); c.style.textShadow = g > 0 ? `0 0 ${20 * g}px rgba(226,166,90,.6)` : 'none'; }
    });
    // lines: current at centre, previous dimmed above
    root._lines.forEach((L, i) => {
      const s0 = LS[i], s1 = i + 1 < nL ? LS[i + 1] : cue.end, s2 = i + 2 < nL ? LS[i + 2] : cue.end + 1;
      const isLast = i === nL - 1;
      let o = 0, y = 540;
      if (t >= s0 - .1) {
        const up = isLast ? 0 : ramp(t, s1 - .2, s1 + .8);
        y = lerp(540, 452, up);
        o = lerp(1, .26, up);
        if (!isLast) o *= 1 - ramp(t, s2 - .4, s2 + .5);
        if (isLast) o *= 1 - ramp(t, cue.page[0] - .4, cue.page[0] + .8);
        if (P.alone != null && i === P.alone - 1) o *= 1 - ramp(t, LS[P.alone] - .2, LS[P.alone] + .9);
        if (P.alone != null && i === P.alone - 2) o *= 1 - ramp(t, LS[P.alone] - .4, LS[P.alone] + .4);
      }
      L.e.style.display = o > .001 ? '' : 'none'; if (o <= .001) return;
      L.e.style.opacity = o; L.e.style.top = (y - 46) + 'px';
      const slow = P.alone === i ? 2.4 : 1;
      const rate = Math.min(.085, 1.15 / L.cs.length) * slow;
      const mv = P.machineView === i;
      L.cs.forEach((c, j) => {
        const a = s0 + (mv ? 1.0 + j * .32 : .1 + j * rate);
        const u = ramp(t, a, a + (mv ? .5 : .75 * slow));
        c.style.opacity = u; c.style.transform = `translateY(${(1 - eo(u)) * 8}px)`;
        c.style.filter = u < 1 ? `blur(${(1 - u) * 5}px)` : 'none';
      });
    });
    // machine view on one line: a two-character window walks across it, once
    if (P.machineView != null) {
      const i = P.machineView, s0 = LS[i], L = root._lines[i];
      const n = L.cs.length; const tStart = s0 + .7, step = .32; const k = Math.floor((t - tStart) / step);
      const o = fade(t, tStart - .2, tStart + .1, tStart + step * (n - 1), tStart + step * (n - 1) + .5);
      root._mv.style.opacity = o; root._mv.style.display = o > 0 ? '' : 'none';
      if (o > 0) {
        const kk = clamp(k, 0, n - 2); const a = L.cs[kk].getBoundingClientRect(), b = L.cs[kk + 1].getBoundingClientRect();
        setStyle(root._mv, { left: (a.left - 10) + 'px', top: (a.top - 14) + 'px', width: (b.right - a.left + 12) + 'px' });
      }
    }
    // full page
    const po = P.dissolve ? ramp(t, cue.page[0], cue.page[0] + 1.6) : fade(t, cue.page[0], cue.page[0] + 1.6, endT - 1.4, endT - .1);
    root._page.style.opacity = po; root._page.style.display = po > 0 ? '' : 'none';
    if (P.dissolve) root._pt.style.opacity = 1 - ramp(t, C.acts.ending[0] + .6, C.acts.ending[0] + 2.4);
    root._pageLines.forEach((L, i) => {
      L.d.style.opacity = ramp(t, cue.page[0] + i * .1, cue.page[0] + .9 + i * .1);
      if (P.dissolve) L.cs.forEach((c, j) => {
        const h1 = hash(i * 97 + j * 13 + 5), h2 = hash(i * 31 + j * 7 + 11);
        const u = ramp(t, C.acts.ending[0] + h1 * 1.2, C.acts.ending[0] + 1.6 + h1 * 1.6, t => t * t);
        c.style.opacity = 1 - u; c.style.transform = `translate(${(h2 - .5) * 60 * u}px, ${-u * (20 + 50 * h1)}px)`;
        c.style.filter = u > 0 ? `blur(${u * 6}px)` : 'none';
      });
    });
  });
}
poemScene(POEM1, C.acts.poem1[1]);
poemScene(POEM2, C.acts.ending[0] + 3.4);

/* ================================================================== ending + credits */
scene([C.acts.ending[0], C.duration + 1], root => {
  const q1 = el('div', 'abs serif center', root, '当文字本身并不知道自己意味着什么，'); setStyle(q1, { top: '440px', fontSize: '46px', letterSpacing: '.14em', fontWeight: 300 });
  const q2 = el('div', 'abs serif center', root, '意义究竟诞生在何处？'); setStyle(q2, { top: '540px', fontSize: '46px', letterSpacing: '.14em', fontWeight: 300 });
  root._q = [q1, q2];
  const cr = el('div', 'abs center', root); root._cr = cr; setStyle(cr, { top: '190px' });
  const CR = [
    ['春天没有收件人', 'title'],
    ['', 'gap'],
    ['真实录屏', 'h'], ['Claude Code v2.1.330，2026-11-21，同一会话中的四轮对话。等待部分加速或略过，均已在画面中标出。', 'p'],
    ['程序与语料', 'h'], ['N-gram 程序与三份语料均由录屏中的 Claude Code 当场写下（唐诗为凭记忆录入），完整文件随工程附带。', 'p'],
    ['原始输出', 'h'], ['片中出现的生成句均为程序原样输出；唯一的改动“声里”二字以琥珀色标出。', 'p'],
    ['可视化', 'h'], ['依据同一语料重新统计的真实次数绘制，不改变算法。', 'p'],
    ['两首诗', 'h'], ['《失物招领》《春天没有收件人》来自此前的 N-gram 创作实验，经人工挑选、排列与少量文字调整。', 'p'],
    ['音乐', 'h'], ['原创配乐 · FluidSynth 与 FluidR3 GM 音色（MIT）', 'p'],
    ['字体', 'h'], ['思源宋体 / 思源黑体（Noto CJK，OFL）· JetBrains Mono（OFL）', 'p'],
  ];
  root._crs = CR.map(([s, k]) => {
    const d = el('div', null, cr, s);
    if (k === 'title') setStyle(d, { fontFamily: 'var(--serif)', fontSize: '44px', letterSpacing: '.4em', paddingLeft: '.4em', fontWeight: 300, marginBottom: '6px' });
    if (k === 'gap') setStyle(d, { height: '34px' });
    if (k === 'h') setStyle(d, { fontSize: '21px', color: 'var(--amber)', letterSpacing: '.3em', marginTop: '22px', paddingLeft: '.3em' });
    if (k === 'p') setStyle(d, { fontSize: '23px', color: '#cbc4b7', letterSpacing: '.06em', marginTop: '8px', fontWeight: 300 });
    return d;
  });
}, (t, root) => {
  const e = C.acts.ending, c = C.acts.credits;
  root._q[0].style.opacity = fade(t, e[0] + 2.2, e[0] + 3.6, e[1] - 1.4, e[1] - .2);
  root._q[1].style.opacity = fade(t, e[0] + 4.2, e[0] + 5.6, e[1] - 1.4, e[1] - .2);
  root._cr.style.opacity = fade(t, c[0] + .4, c[0] + 1.8, C.duration - 1.6, C.duration - .2);
  root._crs.forEach((d, i) => { d.style.opacity = ramp(t, c[0] + .4 + i * .18, c[0] + 1.4 + i * .18); });
});

/* ------------------------------------------------------------------ main entry */
SFX.push({ t: 58.0, type: 'whoosh' }, { t: 118.0, type: 'whoosh' }, { t: 157.2, type: 'whoosh' }, { t: 246.0, type: 'whoosh' }, { t: 334.0, type: 'whoosh' });
window.SFX = SFX;
let frameNo = 0;
window.renderAt = async function (t) {
  frameNo = Math.round(t * C.fps);
  drawBackground(t, frameNo);
  await renderTerminal(t);
  renderScenes(t);
  renderHud(t);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  return true;
};
window.filmReady = document.fonts.ready.then(() => { measureCells(); return true; });

// preview: film/index.html?t=123  or  ?play
(async () => {
  const q = new URLSearchParams(location.search);
  await window.filmReady;
  if (q.has('t')) await window.renderAt(parseFloat(q.get('t')));
  else if (q.has('play')) {
    const t0 = performance.now() - (parseFloat(q.get('play')) || 0) * 1000;
    const loop = async () => { await window.renderAt((performance.now() - t0) / 1000); requestAnimationFrame(loop); };
    loop();
  } else await window.renderAt(0);
})();
