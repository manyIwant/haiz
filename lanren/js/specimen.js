// A caught leaf becomes a pressed specimen: drawn from the same atlas and
// the same colour model as the leaves in the tree, dated in Haikou time,
// and kept (only on this device) in a small book.
import { leafColour, stageName } from './season.js';
import { formatClock, partOfDay } from './sun.js';

const ATLAS_URL = new URL('../assets/leaf-atlas.png', import.meta.url).href;
let atlasPromise = null;
function loadAtlas() {
  if (!atlasPromise) {
    atlasPromise = new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0);
        res(g.getImageData(0, 0, img.width, img.height));
      };
      img.onerror = rej;
      img.src = ATLAS_URL;
    });
  }
  return atlasPromise;
}

const toSRGB = (v) => {
  v = Math.max(0, Math.min(1, v));
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
};

/** Render one pressed leaf into an offscreen canvas (cell size of the atlas). */
async function leafBitmap(leaf) {
  const atlas = await loadAtlas();
  const cw = atlas.width / 4, ch = atlas.height;
  const out = new ImageData(cw, ch);
  const src = atlas.data;
  const dst = out.data;
  const x0 = leaf.variant * cw;
  const shade = ((leaf.variant * 0.37 + 0.3) % 1);
  // dried leaves lose saturation and darken slightly as they press
  const dry = leaf.from === 'ground' ? 0.35 : 0.15;
  const cache = new Map();
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = ((y * atlas.width) + x0 + x) * 4;
      const a = src[si + 3];
      const di = (y * cw + x) * 4;
      if (a < 4) { dst[di + 3] = 0; continue; }
      const lum = src[si] / 255, vein = src[si + 1] / 255, sen = src[si + 2];
      let c = cache.get(sen);
      if (!c) { c = leafColour(leaf.age, sen / 255, leaf.young || 0, shade); cache.set(sen, c); }
      const k = lum * 1.38;
      let r = c[0] * k + vein * 0.012, g = c[1] * k + vein * 0.012, b = c[2] * k + vein * 0.01;
      const l = 0.3 * r + 0.59 * g + 0.11 * b;
      r = r + (l - r) * dry; g = g + (l - g) * dry; b = b + (l - b) * dry;
      // exposure for a paper scan: leaves read a bit lighter than in shade
      dst[di] = toSRGB(r * 1.9) * 255;
      dst[di + 1] = toSRGB(g * 1.9) * 255;
      dst[di + 2] = toSRGB(b * 1.9) * 255;
      dst[di + 3] = a;
    }
  }
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  c.getContext('2d').putImageData(out, 0, 0);
  return c;
}

function paper(g, w, h, seed = 1) {
  g.fillStyle = '#f7f3eb';
  g.fillRect(0, 0, w, h);
  // faint fibres
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  g.globalAlpha = 0.05;
  g.strokeStyle = '#8a7a5c';
  for (let i = 0; i < w * h / 2500; i++) {
    const x = rnd() * w, y = rnd() * h, a = rnd() * Math.PI;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); g.stroke();
  }
  g.globalAlpha = 1;
}

const SERIF = '"Noto Serif SC","Noto Serif CJK SC","Songti SC","STSong",serif';

/** Draw a full specimen sheet (used for the card, the book and the export). */
async function drawSheet(g, w, h, leaf, opts = {}) {
  paper(g, w, h, leaf.seed || 3);
  const bmp = await leafBitmap(leaf);
  const leafH = h * (opts.compact ? 0.74 : 0.64);
  const leafW = leafH * (bmp.width / bmp.height) * 1.24;   // atlas cells are drawn narrow
  const rot = ((leaf.seed || 0) % 7 - 3) * 0.035;
  g.save();
  g.translate(w * 0.5, h * (opts.compact ? 0.47 : 0.45));
  g.rotate(rot);
  // soft shadow of a slightly lifted, pressed leaf
  g.save();
  g.filter = 'blur(6px)';
  g.globalAlpha = 0.18;
  g.translate(6, 9);
  g.drawImage(bmp, -leafW / 2, -leafH / 2, leafW, leafH);
  g.restore();
  g.filter = 'none';
  g.drawImage(bmp, -leafW / 2, -leafH / 2, leafW, leafH);
  // a strip of paper tape across the petiole
  g.fillStyle = 'rgba(232, 222, 196, 0.86)';
  g.rotate(-0.12);
  g.fillRect(-leafW * 0.16, leafH * 0.42, leafW * 0.32, h * 0.03);
  g.restore();
  if (opts.compact) return;
  g.fillStyle = '#3b4038';
  g.font = `italic ${Math.round(h * 0.022)}px ${SERIF}`;
  g.fillText('Terminalia catappa L.', w * 0.07, h * 0.065);
  g.font = `${Math.round(h * 0.019)}px ${SERIF}`;
  g.fillStyle = '#6d6a5e';
  g.fillText('榄仁 · 使君子科 · 海南中学一号教学楼前', w * 0.07, h * 0.098);
  // scale bar: 5 cm at the leaf's modelled length
  const px5 = leafH * (0.05 / leaf.len);
  const by = h * 0.9;
  g.strokeStyle = '#3b4038'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(w * 0.07, by); g.lineTo(w * 0.07 + px5, by); g.stroke();
  for (const x of [w * 0.07, w * 0.07 + px5]) { g.beginPath(); g.moveTo(x, by - 6); g.lineTo(x, by + 6); g.stroke(); }
  g.font = `${Math.round(h * 0.017)}px ${SERIF}`;
  g.fillStyle = '#3b4038';
  g.fillText('5 cm', w * 0.07, by - 14);
  g.textAlign = 'right';
  g.fillText(`${leaf.year || ''} 年 ${leaf.month} 月 ${leaf.day} 日 ${leaf.when}`, w * 0.93, by - 14);
  g.fillStyle = '#6d6a5e';
  g.fillText(leaf.note ? `“${leaf.note}”` : `${leaf.stage} · 长约 ${Math.round(leaf.len * 100)} cm（模型）`, w * 0.93, by + 22);
  g.textAlign = 'left';
}

export class Specimens {
  constructor(visits, onCount = () => {}) {
    this.visits = visits;
    this.onCount = onCount;
    this.dlg = document.getElementById('specimen');
    this.book = document.getElementById('book');
    this.current = null;
    document.getElementById('specKeep').addEventListener('click', () => this.keep());
    document.getElementById('specLet').addEventListener('click', () => this.dlg.close());
    this.book.querySelector('[data-close]').addEventListener('click', () => this.book.close());
    document.getElementById('bookExport').addEventListener('click', () => this.exportPage());
    document.getElementById('bookClear').addEventListener('click', () => {
      if (confirm('清空书页里的所有叶子？只影响这台设备。')) { this.visits.clearLeaves(); this.renderBook(); this.onCount(0); }
    });
    onCount(this.visits.leaves.length);
  }
  isOpen() { return this.dlg.open || this.book.open; }

  async open(raw, parts, season, sun) {
    const altDeg = sun.altitude * 180 / Math.PI;
    const leaf = {
      id: Math.random().toString(36).slice(2, 10),
      seed: Math.floor(Math.random() * 1e6),
      t: Date.now(), year: parts.year, month: parts.month, day: parts.day,
      when: `${partOfDay(parts.minutes, altDeg)} ${formatClock(parts.minutes)}`,
      age: Math.min(1.2, raw.age), young: raw.young || 0, variant: raw.variant, len: raw.len,
      from: raw.from, label: season.label, stage: stageName(raw.age, raw.young || 0), note: ''
    };
    this.current = leaf;
    document.getElementById('specFrom').textContent = raw.from === 'air' ? '接住了一片叶子' : '从地上拾起一片叶子';
    document.getElementById('specTitle').textContent = leaf.stage;
    const dl = document.getElementById('specFacts');
    dl.replaceChildren();
    for (const [k, v] of [['日期', `${leaf.month} 月 ${leaf.day} 日 · ${leaf.when}`], ['那时', `${season.label}（季节为推演）`],
      ['长度', `约 ${Math.round(leaf.len * 100)} cm（模型中的这片叶子）`], ['在哪儿', '一号教学楼前 · 榄仁树下']]) {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      dl.append(dt, dd);
    }
    document.getElementById('specNote').value = '';
    const cv = document.getElementById('specCanvas');
    this.dlg.showModal();
    try { await drawSheet(cv.getContext('2d'), cv.width, cv.height, leaf); } catch (e) { console.warn(e); }
  }

  keep() {
    if (!this.current) return;
    this.current.note = document.getElementById('specNote').value.trim().slice(0, 40);
    const ok = this.visits.keep(this.current);
    this.onCount(this.visits.leaves.length);
    this.dlg.close();
    if (!ok) alert('这台设备的浏览器不允许保存，叶子没能夹进书里。');
  }

  async openBook() {
    this.book.showModal();
    await this.renderBook();
  }

  async renderBook() {
    const grid = document.getElementById('bookGrid');
    grid.replaceChildren();
    const leaves = this.visits.leaves.slice().reverse();
    if (!leaves.length) {
      const p = document.createElement('p');
      p.className = 'book-empty';
      p.textContent = '书页还是空的。回到树下多停一会儿，等一片叶子落下，点击接住它。';
      grid.append(p);
      return;
    }
    for (const leaf of leaves) {
      const fig = document.createElement('figure');
      const c = document.createElement('canvas');
      c.width = 300; c.height = 400;
      const cap = document.createElement('figcaption');
      cap.textContent = `${leaf.month} 月 ${leaf.day} 日 · ${leaf.stage}`;
      const small = document.createElement('small');
      small.textContent = leaf.note || leaf.when;
      cap.append(small);
      fig.append(c, cap);
      grid.append(fig);
      drawSheet(c.getContext('2d'), 300, 400, leaf, { compact: true }).catch(() => {});
    }
  }

  async exportPage() {
    const leaves = this.visits.leaves.slice(-12);
    if (!leaves.length) return;
    const cols = 4, cw = 400, chh = 540;
    const rows = Math.ceil(leaves.length / cols);
    const c = document.createElement('canvas');
    c.width = cols * cw + 120; c.height = rows * chh + 260;
    const g = c.getContext('2d');
    paper(g, c.width, c.height, 7);
    g.fillStyle = '#293f36';
    g.font = `500 54px ${SERIF}`;
    g.fillText('书页 · 一棵榄仁树', 60, 110);
    g.font = `22px ${SERIF}`;
    g.fillStyle = '#6d6a5e';
    g.fillText('海南中学府城校区 · 一号教学楼前 · haiz.space', 60, 156);
    for (let i = 0; i < leaves.length; i++) {
      const L = leaves[i];
      const sheet = document.createElement('canvas');
      sheet.width = cw - 20; sheet.height = chh - 70;
      await drawSheet(sheet.getContext('2d'), sheet.width, sheet.height, L, { compact: true });
      const x = 60 + (i % cols) * cw, y = 200 + Math.floor(i / cols) * chh;
      g.drawImage(sheet, x, y);
      g.fillStyle = '#3b4038';
      g.font = `20px ${SERIF}`;
      g.fillText(`${L.month} 月 ${L.day} 日 · ${L.stage}`, x + 10, y + sheet.height + 30);
      if (L.note) { g.fillStyle = '#6d6a5e'; g.font = `17px ${SERIF}`; g.fillText(L.note, x + 10, y + sheet.height + 56); }
    }
    c.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'haiz-lanren-book.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, 'image/png');
  }
}
