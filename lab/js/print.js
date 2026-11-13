// HAIZ 实验册 · 印刷
// 把一页排好版的 DOM “印”到画布上，成为纸张的贴图：
// 文字逐字读回浏览器排版后的位置再画，所以与 DOM 版面逐像素一致；
// 这样纸上的字会跟着纸一起弯、一起被装置的影子盖住，翻页时正反面都有内容。
// 只支持本书用到的那一小部分 CSS（纯色/双色渐变背景、边框、圆角、简单投影、二维变换）。

const PAPER = '#fbf7ec';
let grainTile = null;
function grain() {
  if (grainTile) return grainTile;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  let s = 7;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 2600; i++) {
    x.fillStyle = `rgba(${r() < 0.5 ? '96,78,48' : '255,255,255'},${r() * 0.05})`;
    x.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r());
  }
  for (let i = 0; i < 26; i++) { // 偶尔一根看得见的纤维
    x.strokeStyle = `rgba(110,92,60,${0.04 + r() * 0.05})`; x.lineWidth = 0.5;
    const px = r() * 256, py = r() * 256, a = r() * 6.28, l = 4 + r() * 9;
    x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * l * 0.5 + r() * 3, py + Math.sin(a) * l * 0.5, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  return (grainTile = c);
}

const px = (v) => parseFloat(v) || 0;
function rgba(str, alpha) {
  if (alpha >= 0.999) return str;
  const m = str.match(/rgba?\(([^)]+)\)/);
  if (!m) return str;
  const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  return `rgba(${p[0]},${p[1]},${p[2]},${(p[3] ?? 1) * alpha})`;
}
const visibleColor = (c) => c && c !== 'transparent' && !/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(c);

function roundRect(x, l, t, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  x.beginPath();
  if (r <= 0.01) { x.rect(l, t, w, h); return; }
  x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
}

/**
 * @param {HTMLElement} el   已排好版、未做三维变换的页面元素
 * @param {HTMLCanvasElement} canvas
 * @param {{scale?:number, live?:boolean, side?:number}} opt  live=false 时跳过 [data-live]（由 DOM 实时显示）
 */
export function paint(el, canvas, opt = {}) {
  const S = opt.scale ?? 3, W = el.offsetWidth, H = el.offsetHeight;
  if (canvas.width !== Math.round(W * S)) canvas.width = Math.round(W * S);
  if (canvas.height !== Math.round(H * S)) canvas.height = Math.round(H * S);
  const x = canvas.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.fillStyle = PAPER; x.fillRect(0, 0, canvas.width, canvas.height);
  x.fillStyle = x.createPattern(grain(), 'repeat'); x.fillRect(0, 0, canvas.width, canvas.height);
  x.setTransform(S, 0, 0, S, 0, 0);
  // 订口一侧的暗部：纸往书脊里收，光进不去
  const side = opt.side ?? 1, gx = side > 0 ? 0 : W;
  const g = x.createLinearGradient(gx, 0, gx + side * W * 0.2, 0);
  g.addColorStop(0, 'rgba(84,70,50,.42)'); g.addColorStop(0.12, 'rgba(84,70,50,.2)'); g.addColorStop(0.45, 'rgba(84,70,50,.05)'); g.addColorStop(1, 'rgba(84,70,50,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const g2 = x.createLinearGradient(side > 0 ? W : 0, 0, side > 0 ? W * 0.97 : W * 0.03, 0);
  g2.addColorStop(0, 'rgba(84,70,50,.07)'); g2.addColorStop(1, 'rgba(84,70,50,0)');
  x.fillStyle = g2; x.fillRect(0, 0, W, H);

  // 先读变换，再关掉变换量位置
  const all = [el, ...el.querySelectorAll('*')], info = new Map();
  for (const n of all) {
    const cs = getComputedStyle(n);
    info.set(n, { cs, tf: cs.transform, to: cs.transformOrigin });
  }
  el.classList.add('measuring');
  const O = el.getBoundingClientRect();
  const range = document.createRange();
  const probe = new Map();
  const metrics = (font) => {
    let m = probe.get(font);
    if (!m) { x.font = font; const t = x.measureText('Hg国'); m = { a: t.fontBoundingBoxAscent ?? t.actualBoundingBoxAscent, d: t.fontBoundingBoxDescent ?? t.actualBoundingBoxDescent }; probe.set(font, m); }
    return m;
  };

  const text = (node, cs, alpha) => {
    const s = node.nodeValue;
    if (!s.trim()) return;
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, m = metrics(font);
    x.font = font; x.fillStyle = x.strokeStyle = rgba(cs.color, alpha); x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    // 油墨扩散：纸上的小字比屏幕上略重。贴图按线性光取平均会让细笔画发灰，这里补回来。
    const fs = px(cs.fontSize), gain = fs < 22 ? 0.42 : 0.2;
    x.lineWidth = gain; x.lineJoin = 'round';
    const strike = cs.textDecorationLine.includes('line-through'), upper = cs.textTransform === 'uppercase';
    let i = 0;
    for (const ch of s) {
      const j = i + ch.length;
      if (ch.trim()) {
        range.setStart(node, i); range.setEnd(node, j);
        const r = range.getBoundingClientRect();
        if (r.width > 0) {
          const base = r.top - O.top + (r.height * m.a) / (m.a + m.d);
          const gl = upper ? ch.toUpperCase() : ch; x.fillText(gl, r.left - O.left, base); x.strokeText(gl, r.left - O.left, base);
          if (strike) x.fillRect(r.left - O.left, base - px(cs.fontSize) * 0.3, r.width + 0.5, 1);
        }
      }
      i = j;
    }
  };

  const slider = (n, r, alpha) => {
    const min = +n.min, max = +n.max, f = max > min ? (+n.value - min) / (max - min) : 0;
    const cy = r.top + r.height / 2, tr = 8.5, cx = r.left + tr + f * (r.width - tr * 2);
    x.fillStyle = rgba('rgb(30,43,54)', alpha); x.fillRect(r.left, cy - 1, r.width, 2);
    x.beginPath(); x.arc(cx, cy, tr, 0, Math.PI * 2); x.fillStyle = rgba('rgb(252,249,241)', alpha); x.fill();
    x.lineWidth = 2; x.strokeStyle = rgba('rgb(30,43,54)', alpha); x.stroke();
  };

  const walk = (n, alpha) => {
    const { cs, tf, to } = info.get(n) || {};
    if (!cs || cs.display === 'none' || cs.visibility === 'hidden') return;
    if (opt.live === false && n.dataset.live !== undefined) return;
    alpha *= parseFloat(cs.opacity);
    if (alpha < 0.01) return;
    const b = n.getBoundingClientRect(), r = { left: b.left - O.left, top: b.top - O.top, width: b.width, height: b.height };
    let saved = false;
    if (tf && tf !== 'none' && n !== el) {
      const m = tf.match(/^matrix\(([^)]+)\)/);
      if (!m) return;                 // 三维变换的元素（掀到一半的答案纸）不印
      const v = m[1].split(',').map(Number), o = to.split(' ').map(px);
      x.save(); saved = true;
      x.translate(r.left + o[0], r.top + o[1]); x.transform(v[0], v[1], v[2], v[3], v[4], v[5]); x.translate(-r.left - o[0], -r.top - o[1]);
    }
    if (n !== el && r.width > 0 && r.height > 0) {
      const rad = cs.borderTopLeftRadius.includes('%') ? (px(cs.borderTopLeftRadius) / 100) * Math.min(r.width, r.height) : px(cs.borderTopLeftRadius);
      const bg = cs.backgroundColor, bi = cs.backgroundImage;
      const sh = cs.boxShadow !== 'none' && cs.boxShadow.match(/(rgba?\([^)]+\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/);
      if (visibleColor(bg) || bi.startsWith('linear-gradient')) {
        x.save();
        if (sh && !/inset/.test(cs.boxShadow.split('rgb')[1] || '')) { x.shadowColor = rgba(sh[1], alpha); x.shadowOffsetX = +sh[2] * S; x.shadowOffsetY = +sh[3] * S; x.shadowBlur = +sh[4] * S; }
        if (bi.startsWith('linear-gradient')) {
          const cols = bi.match(/rgba?\([^)]+\)/g) || [], gr = x.createLinearGradient(0, r.top, 0, r.top + r.height);
          cols.forEach((c, i) => gr.addColorStop(cols.length > 1 ? i / (cols.length - 1) : 0, rgba(c, alpha)));
          x.fillStyle = gr;
        } else x.fillStyle = rgba(bg, alpha);
        roundRect(x, r.left, r.top, r.width, r.height, rad); x.fill();
        x.restore();
      }
      const bw = { t: px(cs.borderTopWidth), r: px(cs.borderRightWidth), b: px(cs.borderBottomWidth), l: px(cs.borderLeftWidth) };
      const bs = { t: cs.borderTopStyle, r: cs.borderRightStyle, b: cs.borderBottomStyle, l: cs.borderLeftStyle };
      const bc = { t: cs.borderTopColor, r: cs.borderRightColor, b: cs.borderBottomColor, l: cs.borderLeftColor };
      const on = (k) => bw[k] > 0 && bs[k] !== 'none' && bs[k] !== 'hidden' && visibleColor(bc[k]);
      const dashOf = (k) => (bs[k] === 'dashed' ? [bw[k] * 3, bw[k] * 2.4] : bs[k] === 'dotted' ? [bw[k], bw[k] * 1.6] : []);
      if (on('t') && on('r') && on('b') && on('l') && bw.t === bw.r && bw.t === bw.b && bw.t === bw.l && bc.t === bc.b && bc.t === bc.l && bc.t === bc.r && bs.t === bs.b && bs.t === bs.l) {
        x.lineWidth = bw.t; x.strokeStyle = rgba(bc.t, alpha); x.setLineDash(dashOf('t'));
        roundRect(x, r.left + bw.t / 2, r.top + bw.t / 2, r.width - bw.t, r.height - bw.t, Math.max(0, rad - bw.t / 2)); x.stroke(); x.setLineDash([]);
      } else {
        const line = (k, x0, y0, x1, y1) => { if (!on(k)) return; x.lineWidth = bw[k]; x.strokeStyle = rgba(bc[k], alpha); x.setLineDash(dashOf(k)); x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); x.setLineDash([]); };
        line('t', r.left, r.top + bw.t / 2, r.left + r.width, r.top + bw.t / 2);
        line('b', r.left, r.top + r.height - bw.b / 2, r.left + r.width, r.top + r.height - bw.b / 2);
        line('l', r.left + bw.l / 2, r.top, r.left + bw.l / 2, r.top + r.height);
        line('r', r.left + r.width - bw.r / 2, r.top, r.left + r.width - bw.r / 2, r.top + r.height);
      }
    }
    if (n.tagName === 'INPUT' && n.type === 'range') slider(n, r, alpha);
    else if (n.tagName === 'CANVAS') { if (n.width && n.height) { x.globalAlpha = alpha; x.drawImage(n, r.left, r.top, r.width, r.height); x.globalAlpha = 1; } }   // 页面上的活图：照原样印上去
    else for (const c of n.childNodes) {
      if (c.nodeType === 3) text(c, cs, alpha);
      else if (c.nodeType === 1) walk(c, alpha);
    }
    if (saved) x.restore();
  };
  try { walk(el, 1); } finally { el.classList.remove('measuring'); }
  return canvas;
}

/** 把交互页上实时变化的部分（滑块数值、勾选、批注、掀开的答案）同步到排版副本上 */
export function syncLive(from, to) {
  const a = from.querySelectorAll('[data-live]'), b = to.querySelectorAll('[data-live]');
  a.forEach((src, i) => {
    const dst = b[i]; if (!dst) return;
    src.querySelectorAll('input').forEach((inp) => inp.setAttribute('value', inp.value));
    const clone = src.cloneNode(true);
    clone.querySelectorAll('input').forEach((inp, k) => { inp.value = src.querySelectorAll('input')[k].value; });
    const cs = src.querySelectorAll('canvas');
    clone.querySelectorAll('canvas').forEach((c, k) => { const o = cs[k]; if (o && o.width) { c.width = o.width; c.height = o.height; c.style.cssText = o.style.cssText; c.getContext('2d').drawImage(o, 0, 0); } });
    dst.replaceWith(clone);
  });
}
