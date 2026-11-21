/* 《春天没有收件人》 — part one: the real terminal, then the fork at "有一".
 *
 * The terminal is the real `script` recording (bytes + timestamps) of the Claude Code session,
 * replayed by xterm.js. Every terminal segment plays at 1x; cuts are jump cuts and are labelled.
 * The cursor blinks the way a terminal does: 600 ms on / 600 ms off, restarting at every write.
 * renderAt(t) is deterministic: the same t always gives the same frame.
 */
'use strict';
const W = 1920, H = 1080;
const R = window.RECORDING, F = window.FORK;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const eio = (k) => (k = clamp(k), k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const eo = (k) => 1 - Math.pow(1 - clamp(k), 3);
const ramp = (t, a, b, f = eio) => f((t - a) / (b - a));
const fade = (t, a, b, c, d) => (t <= a || t >= d) ? 0 : t < b ? eio((t - a) / (b - a)) : t <= c ? 1 : 1 - eio((t - c) / (d - c));
function el(tag, cls, parent, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; }
function css(e, o) { for (const k in o) e.style[k] = o[k]; return e; }

// ---------------------------------------------------------------- edit decision list
// film seconds -> recording seconds (1x). A freeze holds one recorded instant.
const SEGS = [
  { f: [1.2, 6.9], r: [6.6, 12.3] },                                   // empty prompt, typing 「用 ngram 写两首诗」, Enter
  { f: [6.9, 10.4], r: [12.3, 15.8] },                                 // Claude Code starts working
  { f: [10.4, 15.4], r: [161.0, 166.0], jump: '跳过 2 分 25 秒' },      // the third request being typed and sent
  { f: [15.4, 17.6], r: [190.0, 192.2], jump: '跳过 24 秒' },           // the reply arrives: lines 35-59 snap onto the screen
  { f: [17.6, 23.0], r: [192.2, 192.2], freeze: true },                // freeze: line 37 is on screen for 0.15 s in reality
];
const END = 42.0;          // hand-off to the river (film/world)
const TERM_END = 25.6;

function recAt(t) {
  let last = null;
  for (const s of SEGS) {
    if (t >= s.f[0] && t < s.f[1]) return { rt: lerp(s.r[0], s.r[1], (t - s.f[0]) / (s.f[1] - s.f[0])), seg: s };
    if (s.f[1] <= t) last = s;
  }
  return last ? { rt: last.r[1], seg: last, after: true } : { rt: SEGS[0].r[0], seg: SEGS[0], before: true };
}

// ---------------------------------------------------------------- the real terminal
const bin = Uint8Array.from(atob(R.b64), c => c.charCodeAt(0));
const term = new Terminal({
  cols: R.cols, rows: R.rows, fontSize: 30, lineHeight: 1.0, scrollback: 0,
  fontFamily: '"Noto Sans Mono CJK SC", monospace',
  allowProposedApi: true, cursorBlink: false, cursorStyle: 'block', cursorInactiveStyle: 'block',
  theme: { background: '#0c0c0e', foreground: '#e7e4dd', cursor: '#e7e4dd', cursorAccent: '#0c0c0e' },
});
term.loadAddon(new Unicode11Addon.Unicode11Addon());
term.unicode.activeVersion = '11';
term.open(document.getElementById('term'));
let bytePos = R.header;
const EV = R.events;
function evIndexAt(rt) { let lo = 0, hi = EV.length - 1, a = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (EV[m][0] <= rt) { a = m; lo = m + 1; } else hi = m - 1; } return a; }
function writeTo(rt) {
  const i = evIndexAt(rt); const end = i < 0 ? R.header : EV[i][1];
  if (end < bytePos) { term.reset(); bytePos = R.header; }
  if (end === bytePos) return Promise.resolve();
  const chunk = bin.slice(bytePos, end); bytePos = end;
  return new Promise(res => term.write(chunk, res));
}
// a terminal's cursor blink restarts whenever something is written
function cursorOn(rt, frozen) {
  if (frozen) return true;
  const i = evIndexAt(rt); const lastWrite = i < 0 ? 0 : EV[i][0];
  return Math.floor((rt - lastWrite) / 0.6) % 2 === 0;
}
function cell() { try { const d = term._core._renderService.dimensions.css.cell; return { w: d.width, h: d.height }; } catch (e) { return { w: 15, h: 34 }; } }
function promptRow() { for (let y = R.rows - 1; y >= 0; y--) if (rowText(y).trimStart().startsWith('❯')) return y; return R.rows - 4; }
function rowText(y) { const l = term.buffer.active.getLine(term.buffer.active.viewportY + y); return l ? l.translateToString(true) : ''; }
function findRow(text) { for (let y = 0; y < R.rows; y++) if (rowText(y).includes(text)) return y; return -1; }

// ---------------------------------------------------------------- HUD
const hud = document.getElementById('hud');
const tag = el('div', 'tag', hud);
tag.innerHTML = '<b>真实终端记录 · 2026-11-21 · Claude Code v2.1.330</b><br>按录制时的字节与时间戳逐字回放，不是屏幕录像';
const rec = el('div', 'rec', hud); rec.innerHTML = '<i></i><span></span>';
const jump = el('div', 'jump', hud); const jumpSpan = el('span', null, jump);
const freezeLab = el('div', 'rec', hud); css(freezeLab, { top: '64px' }); freezeLab.textContent = '定格';

// ---------------------------------------------------------------- the fork
const mech = document.getElementById('mech');
const FS = 76;                      // character size of the program-output lines
const X0 = 520;                     // x of the first character of line 37
const ROW = { l37: 420, zuo: 545, l23: 670 };
const COL_FORK = 2;                 // "有一" sits at columns 2,3 of line 37
const colX = (c) => X0 + c * FS;    // left edge of a column (line 37 coordinates)

function lineEl(text, y, startCol) {
  const d = el('div', 'line abs', mech); css(d, { left: '0px', top: '0px', fontSize: FS + 'px', lineHeight: FS + 'px', height: FS + 'px' });
  const chars = [...text].map((c, i) => { const s = el('span', 'ch abs', d, c); css(s, { left: colX(startCol + i) + 'px', top: (y - FS / 2) + 'px', width: FS + 'px' }); return s; });
  return { d, chars };
}
const L37 = lineEl(F.lines[37].text, ROW.l37, 0);          // 河上有一条河很长
const L23 = lineEl(F.lines[23].text, ROW.l23, -2);         // 我家门前有一个名字 ("有一" at cols 2,3 as well)
const optZuo = el('div', 'opt abs', mech, '座'); css(optZuo, { left: colX(4) + 'px', top: (ROW.zuo - FS / 2) + 'px', width: FS + 'px', textAlign: 'center', fontSize: FS + 'px', lineHeight: FS + 'px', color: '#e7e4dd' });
const fr = {}, srcs = {};
const OPT_ROW = { '条': ROW.l37, '座': ROW.zuo, '个': ROW.l23 };
for (const c of ['条', '座', '个']) {
  const o = F.fork.options[c];
  fr[c] = el('div', 'frac abs', mech, `${o.n}/${o.total}`); css(fr[c], { left: (colX(4) + FS * 0.22) + 'px', top: (OPT_ROW[c] + FS / 2 + 6) + 'px' });
  const s = o.sources[0]; const i = s.indexOf('有一' + c);
  srcs[c] = el('div', 'src abs', mech); srcs[c].innerHTML = `${s.slice(0, i)}<b>${s.slice(i, i + 3)}</b>${s.slice(i + 3)}`;
  css(srcs[c], { left: '1430px', top: (OPT_ROW[c] - 17) + 'px' });
}
const srcHead = el('div', 'lab abs', mech, '语料里，“有一”后面出现过的字'); css(srcHead, { left: '1430px', top: (ROW.l37 - 92) + 'px' });
const win = el('div', 'abs', mech); css(win, { border: '2px solid rgba(224,150,90,.85)', borderRadius: '10px', height: (FS + 22) + 'px', width: (FS * 2 + 22) + 'px' });
const winLab = el('div', 'lab abs', win, '只看这两个字'); css(winLab, { left: '0', right: '0', top: '-40px', textAlign: 'center', color: '#e0965a' });
const lab37 = el('div', 'lab abs', mech, '第 37 行 · 屏幕上实时出现的原始输出'); css(lab37, { left: colX(0) + 'px', top: (ROW.l37 - FS / 2 - 104) + 'px' });
const lab23 = el('div', 'lab abs', mech, '第 23 行 · 同一次运行，写进 output_things.txt，没有显示在屏幕上'); css(lab23, { left: colX(-2) + 'px', top: (ROW.l23 + FS / 2 + 48) + 'px' });
const svgNS = 'http://www.w3.org/2000/svg';
const svg = document.createElementNS(svgNS, 'svg'); svg.setAttribute('width', W); svg.setAttribute('height', H); mech.appendChild(svg);
function path(d, stroke, dash) { const p = document.createElementNS(svgNS, 'path'); p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke', stroke); p.setAttribute('stroke-width', '2'); if (dash) p.setAttribute('stroke-dasharray', dash); svg.appendChild(p); return p; }
const forkX = colX(4) - 6, nodeX = colX(4) - 14;
const brZuo = path(`M ${nodeX} ${ROW.l37} C ${nodeX + 10} ${ROW.l37 + 60}, ${forkX - 10} ${ROW.zuo - 30}, ${colX(4) + 6} ${ROW.zuo}`, 'rgba(231,228,221,.35)');
const brGe = path(`M ${nodeX} ${ROW.l37} C ${nodeX + 18} ${ROW.l37 + 120}, ${forkX - 18} ${ROW.l23 - 60}, ${colX(4) + 6} ${ROW.l23}`, 'rgba(231,228,221,.35)');
const same = path(`M ${colX(2) + FS} ${ROW.l37 + FS / 2 + 8} L ${colX(2) + FS} ${ROW.l23 - FS / 2 - 8}`, 'rgba(224,150,90,.55)', '6 8');
const caps = [
  [25.8, 29.4, '每写一个字，程序只看前面两个字。'],
  [29.6, 33.6, '“有一”后面，语料里只出现过三个字，各一次。它随便抽一个。'],
  [33.9, 37.4, '同一次运行，第 23 行走到同一个路口，抽到了“个”。'],
  [37.6, 40.4, '它不知道河是什么，也不知道名字是什么。'],
].map(c => { const d = el('div', 'cap', mech, c[2]); return { a: c[0], b: c[1], d }; });

// ---------------------------------------------------------------- render
async function renderAt(t) {
  const stage = document.getElementById('stage');
  const { rt, seg } = recAt(t);
  const termVis = t < SEGS[0].f[0] ? 0 : (t < TERM_END ? 1 : 0);
  await writeTo(rt);
  await new Promise(r => requestAnimationFrame(r));
  const c = cell();
  const box = document.getElementById('termBox');
  const bw = R.cols * c.w + 52, bh = R.rows * c.h + 36;
  // camera on the terminal: fit to width, top-aligned; during the freeze, lean in on line 37
  const base = Math.min((W - 120) / bw, (H - 120) / bh);
  const OFFY = 34;                        // leave a band at the top for the labels
  // editor-style framing of the recording: push in on the prompt while it is typed
  const focus = (kind, z) => {
    if (typeof kind === 'number') return { s: base * z, cx: clamp(26 + c.w * 50, bw / 2 / z, bw - bw / 2 / z), cy: clamp(18 + kind * c.h, bh / 2 / z, bh - bh / 2 / z) };
    if (kind === 'prompt') { const pr = promptRow(); return { s: base * z, cx: clamp(26 + c.w * 50, bw / 2 / z, bw - bw / 2 / z), cy: clamp(18 + (pr - 1.5) * c.h, bh / 2 / z, bh - bh / 2 / z) }; }
    return { s: base, cx: bw / 2, cy: bh / 2 - OFFY / base };
  };
  let F0;
  if (t < 2.6) F0 = focus('all', 1);
  else if (t < 3.8) { const a = focus('all', 1), b = focus('prompt', 1.42), k = ramp(t, 2.6, 3.8); F0 = { s: lerp(a.s, b.s, k), cx: lerp(a.cx, b.cx, k), cy: lerp(a.cy, b.cy, k) }; }
  else if (t < 6.9) F0 = focus('prompt', 1.42);
  else if (t < 10.4) F0 = focus(11, 1.3);
  else if (t < 15.4) F0 = focus('prompt', 1.42);
  else F0 = focus(14.5, 1.22);
  let s = F0.s, cx = F0.cx, cy = F0.cy;
  const row37 = findRow('河上有一条河很长');
  if (t >= 17.6 && row37 >= 0) {
    const k = ramp(t, 18.6, 22.6);
    s = lerp(base * 1.22, base * 1.5, k);
    cx = lerp(cx, 26 + c.w * 44, k); cy = lerp(cy, 18 + (row37 + 0.5) * c.h + bh * 0.08, k);
  }
  const cam = document.getElementById('termCam');
  css(cam, { transform: `translate(${W / 2 - cx * s}px, ${H / 2 - cy * s}px) scale(${s})`, opacity: termVis * (1 - ramp(t, 23.4, 25.4)), display: termVis ? '' : 'none' });
  stage.classList.toggle('cursor-off', !cursorOn(rt, seg.freeze));
  // dim every other row in the freeze
  const rows = document.querySelectorAll('#term .xterm-rows > div');
  const dim = ramp(t, 18.4, 20.0);
  rows.forEach((r, i) => { r.style.opacity = (i === row37) ? 1 : 1 - 0.86 * dim; });
  // HUD
  const hudVis = t < 1.2 ? 0 : 1 - ramp(t, 22.6, 24.0);
  tag.style.opacity = hudVis * (1 - ramp(t, 6.0, 7.2) * 0.45);
  const secs = 38 * 60 + 45 + Math.floor(rt);
  rec.querySelector('span').textContent = `04:${String(Math.floor(secs / 60) % 60).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  rec.style.opacity = hudVis;
  const js = SEGS.find(g => g.jump && t >= g.f[0] - 0.05 && t < g.f[0] + 1.9);
  jump.style.opacity = js ? fade(t, js.f[0] - 0.05, js.f[0] + 0.15, js.f[0] + 1.4, js.f[0] + 1.9) : 0;
  if (js) jumpSpan.textContent = `⋯  ${js.jump}  ⋯`;
  freezeLab.style.opacity = seg.freeze ? fade(t, 17.6, 17.9, 22.4, 23.2) : 0;

  // ---------------- the fork
  const mv = t >= 22.6 ? 1 : 0;
  mech.style.display = mv ? '' : 'none';
  if (!mv) return;
  // line 37 lifts out of the terminal into place
  const lift = ramp(t, 22.8, 25.2);
  let fromX = 0, fromY = 0, fromS = 1;
  if (row37 >= 0) {
    const tsx = W / 2 - cx * s, tsy = H / 2 - cy * s;          // terminal origin on screen
    fromX = tsx + s * (26 + c.w * 6);                          // "  37. " is 6 cells wide
    fromY = tsy + s * (18 + (row37 + 0.5) * c.h);
    fromS = (s * c.w * 2) / FS;                                // one CJK char = 2 cells
  }
  L37.d.style.transformOrigin = '0 0';
  const k = lift;
  const tx = lerp(fromX - colX(0) * fromS, 0, k), ty = lerp(fromY - ROW.l37 * fromS, 0, k), sc = lerp(fromS, 1, k);
  L37.d.style.transform = `translate(${tx}px, ${ty}px) scale(${sc})`;
  L37.d.style.opacity = t < 23.0 ? 0 : 1;
  lab37.style.opacity = fade(t, 25.0, 25.6, 39.4, 40.2);
  // the two-character window walks: 河上 -> 上有 -> 有一
  const steps = [[0, 25.6], [1, 26.6], [2, 27.6]];
  let wc = 0;
  for (const [cc, ts] of steps) if (t >= ts) wc = cc;
  const prev = steps.find(s2 => s2[0] === wc - 1);
  const wx = prev && t < steps[wc][1] + 0.35 ? lerp(colX(prev[0]), colX(wc), eio((t - steps[wc][1]) / 0.35)) : colX(wc);
  css(win, { left: (wx - 11) + 'px', top: (ROW.l37 - FS / 2 - 11) + 'px', opacity: fade(t, 25.5, 25.9, 33.0, 33.6) });
  // characters after the window are not written yet
  const shown37 = (i) => {
    if (t < 25.5) return 1;
    if (i < wc + 2) return 1;
    if (i === wc + 2 && t < 28.2) return 0.9;                 // the next char, as the one picked before
    if (t >= 31.0) return i >= 4 ? lerp(0.12, 1, ramp(t, 31.0 + (i - 4) * 0.12, 31.4 + (i - 4) * 0.12)) : 1;
    return 0.12;
  };
  L37.chars.forEach((ch, i) => { ch.style.opacity = shown37(i) * (1 - ramp(t, 39.8, 41.0) * (i === 5 ? 0 : 1)); ch.style.color = (i === 4 && t >= 31.0) ? '#e0965a' : (i === 2 || i === 3) && t >= 27.6 ? '#ffffff' : '#e7e4dd'; });
  // the options at "有一"
  const optIn = ramp(t, 28.0, 29.0);
  const end = 1 - ramp(t, 39.6, 40.8);
  const pick37 = ramp(t, 31.0, 31.6), pick23 = ramp(t, 34.2, 34.8);
  optZuo.style.opacity = optIn * lerp(1, 0.32, Math.max(pick37, pick23) * 0.9) * end;
  brZuo.style.opacity = optIn * lerp(1, 0.35, pick37) * end;
  brGe.style.opacity = optIn * end;
  brGe.setAttribute('stroke', pick23 > 0.5 ? 'rgba(224,150,90,.8)' : 'rgba(231,228,221,.35)');
  for (const ch of ['条', '座', '个']) {
    fr[ch].style.opacity = optIn * end * (ch === '条' ? 1 : ch === '个' ? 1 : lerp(1, 0.5, pick37));
    srcs[ch].style.opacity = ramp(t, 28.6 + (ch === '条' ? 0 : ch === '座' ? 0.25 : 0.5), 29.4 + (ch === '条' ? 0 : ch === '座' ? 0.25 : 0.5)) * end * (ch === '座' ? lerp(1, 0.55, pick23) : 1);
    fr[ch].style.color = (ch === '条' && pick37 > 0.5) || (ch === '个' && pick23 > 0.5) ? '#e0965a' : '#8a847b';
  }
  srcHead.style.opacity = ramp(t, 28.4, 29.2) * end;
  // option 个 appears in the column first as a lone character; then line 23 grows around it
  const l23in = ramp(t, 33.9, 35.2);
  L23.chars.forEach((ch, i) => {
    const col = i - 2;                       // column in line-37 coordinates
    let o;
    if (col === 4) o = optIn;                // 个: one of the three options
    else if (col < 4) o = l23in;             // 我家门前有一
    else o = ramp(t, 34.8 + (col - 5) * 0.14, 35.3 + (col - 5) * 0.14);
    ch.style.opacity = o * end;
    ch.style.color = col === 4 && pick23 > 0.5 ? '#e0965a' : (col === 2 || col === 3) && l23in > 0.5 ? '#ffffff' : '#e7e4dd';
  });
  same.style.opacity = l23in * 0.9 * end;
  lab23.style.opacity = fade(t, 34.6, 35.4, 39.4, 40.2);
  caps.forEach(cp => cp.d.style.opacity = fade(t, cp.a, cp.a + 0.45, cp.b - 0.45, cp.b));
  // hand-off: only the river remains, drifting to the centre
  const go = ramp(t, 40.2, 42.0);
  const r = L37.chars[5];
  const rx0 = colX(5), ry0 = ROW.l37 - FS / 2;
  css(r, { left: lerp(rx0, W / 2 - FS / 2, go) + 'px', top: lerp(ry0, H / 2 - FS / 2, go) + 'px', color: go > 0 ? `rgb(${lerp(231, 236, go)}, ${lerp(228, 226, go)}, ${lerp(221, 210, go)})` : r.style.color, textShadow: go > 0 ? `0 0 ${18 * go}px rgba(255,236,200,${0.35 * go})` : 'none' });
}

window.renderAt = renderAt;
window.FILM_TERM = { END, SEGS };
document.fonts.ready.then(() => { window.ready = true; });
