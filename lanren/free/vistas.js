// HAIZ · 自由共游 — 海中八景: eight views of the campus that only open from a certain place, way of moving,
// hour or weather. Not collectibles that count up a score: when you find yourself in one, you may sketch
// it — the frame on screen, as it is at that moment, becomes an ink-and-wash page in your sketchbook, with
// the date and the weather written under it. 入画 began with painting the old tree; this is how it goes on.
//
// The pages are kept in this browser only (localStorage): no account, nothing sent anywhere. The hints for
// views not yet found are written in the book, as a friend's notes would be.
const KEY = 'haiz-free-sketchbook-v1';

export const VIEWS = [
  { id: 'crown', name: '榄仁听风', hint: '骑着扫帚，停进老树的树冠里，听一会儿叶子。', test: (s) => s.mode === 'broom' && s.inLanshu > 0.25 && s.speed < 4 },
  { id: 'above', name: '凌空望校', hint: '飞到比所有楼都高的地方，看一看整个校园。', test: (s) => s.mode === 'broom' && s.agl > 38 },
  { id: 'roof', name: '屋顶小憩', hint: '把扫帚停在一栋楼的屋顶上。', test: (s) => s.mode === 'broom' && s.onRoof && s.speed < 1.5 },
  { id: 'pond', name: '砚池晚照', hint: '傍晚，骑车绕着砚池走一圈。', test: (s) => s.mode === 'bike' && s.hours >= 16.8 && s.hours < 19.4 && Math.hypot(s.x - 3, s.z - 140) < 22 },
  { id: 'gate', name: '北门晨光', hint: '清晨，从北门进校。', test: (s) => s.hours >= 6 && s.hours < 9 && Math.hypot(s.x + 35.6, s.z + 72) < 12 },
  { id: 'rain', name: '连廊听雨', hint: '下雨的时候，去一二号楼之间的连廊里躲一躲。', test: (s) => s.raining && Math.hypot(s.x + 60.2, s.z - 47.8) < 9 },
  { id: 'track', name: '跑道追风', hint: '在操场的跑道上，骑车或滑板跑出最快的速度。', test: (s) => (s.mode === 'bike' || s.mode === 'board') && s.speed > 5.8 && Math.hypot((s.x + 201) / 80, (s.z + 58.8) / 45) < 1.05 },
  { id: 'night', name: '灯下夜读', hint: '晚自习的时候，到教学楼前抬头看看亮着的窗。', test: (s) => s.hours >= 19 && s.hours < 22.5 && s.x > -95 && s.x < 25 && s.z > -5 && s.z < 95 && s.lookUp },
];

export function createVistas({ root, button, prompt, onSketch }) {
  let book = {};
  try { book = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { book = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(book)); } catch { /* storage full or blocked: the page stays for this visit */ } };
  let current = null, shown = null, flash = 0;

  function render() {
    const list = root.querySelector('ol');
    list.innerHTML = VIEWS.map((v) => {
      const p = book[v.id];
      return p
        ? `<li class="fr-page-on"><figure><img src="${p.img}" alt="${v.name}的速写"><figcaption><b>${v.name}</b><span>${p.when}</span></figcaption></figure></li>`
        : `<li><figure><div class="fr-blank"><p>${v.hint}</p></div><figcaption><b>${'□'.repeat(4)}</b><span>还没画</span></figcaption></figure></li>`;
    }).join('');
    const n = Object.keys(book).filter((k) => VIEWS.some((v) => v.id === k)).length;
    root.querySelector('[data-vista="count"]').textContent = `${n} / ${VIEWS.length}`;
    if (button) button.querySelector('span').textContent = n ? `速写本 ${n}/${VIEWS.length}` : '速写本';
  }
  render();
  root.addEventListener('click', (e) => { if (e.target.closest('[data-vista="close"]')) toggle(false); });
  button?.addEventListener('click', () => toggle());
  function toggle(on) { const open = on ?? root.hidden; root.hidden = !open; if (open) render(); button?.setAttribute('aria-expanded', String(open)); }

  /** each frame: s = { mode, x, z, agl, speed, hours, raining, onRoof, inLanshu, lookUp } */
  function update(dt, s) {
    flash = Math.max(0, flash - dt);
    const v = VIEWS.find((x) => { try { return x.test(s); } catch { return false; } }) || null;
    current = v;
    const id = v ? v.id : null;
    if (id !== shown) {
      shown = id;
      if (v) {
        const had = !!book[v.id];
        prompt.querySelector('b').textContent = `「${v.name}」`;
        prompt.querySelector('span').textContent = had ? '画过了 · 还可以再画一张' : '此处可入画';
        prompt.hidden = false;
        requestAnimationFrame(() => prompt.classList.add('on'));
      } else { prompt.classList.remove('on'); setTimeout(() => { if (!shown) prompt.hidden = true; }, 500); }
    }
  }

  /** turn a frame (the WebGL canvas, read right after it was drawn) into a page */
  function sketch(srcCanvas, caption) {
    if (!current) return null;
    const v = current;
    const W = 480, H = 360;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    // centre crop to 4:3
    const sw = srcCanvas.width, sh = srcCanvas.height, ar = W / H;
    let cw = sw, ch = sw / ar; if (ch > sh) { ch = sh; cw = sh * ar; }
    g.drawImage(srcCanvas, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, W, H);
    const img = g.getImageData(0, 0, W, H), d = img.data;
    const L = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) L[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
    const out = g.createImageData(W, H), o = out.data;
    const rnd = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      // ink: the Sobel edge of the light, thresholded and grainy
      const xm = Math.max(0, x - 1), xp = Math.min(W - 1, x + 1), ym = Math.max(0, y - 1), yp = Math.min(H - 1, y + 1);
      const gx = L[y * W + xp] - L[y * W + xm] + 0.5 * (L[ym * W + xp] - L[ym * W + xm] + L[yp * W + xp] - L[yp * W + xm]);
      const gy = L[yp * W + x] - L[ym * W + x] + 0.5 * (L[yp * W + xm] - L[ym * W + xm] + L[yp * W + xp] - L[ym * W + xp]);
      const edge = Math.min(1, Math.max(0, (Math.hypot(gx, gy) - 0.09) * 4.5)) * (0.65 + 0.35 * rnd(x, y));
      // wash: the colour lifted toward the paper, a little posterised, granulating in the darks
      const paper = [239, 230, 208];
      let r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2];
      const lum = L[i];
      const q = Math.round(lum * 6) / 6;
      const k = 0.55 + 0.16 * rnd(x >> 2, y >> 2);
      r = paper[0] * (1 - k) + (r * 0.75 + q * 255 * 0.25) * k;
      gg = paper[1] * (1 - k) + (gg * 0.75 + q * 255 * 0.25) * k;
      b = paper[2] * (1 - k) + (b * 0.75 + q * 255 * 0.25) * k;
      // the wash does not reach the edges of the page: an uneven, bleeding border
      const ex = Math.min(x, W - 1 - x) / W, ey = Math.min(y, H - 1 - y) / H;
      const border = Math.min(1, Math.min(ex, ey) * 9 + (rnd(x >> 3, y >> 3) - 0.5) * 0.35);
      const wash = Math.max(0, Math.min(1, border));
      r = paper[0] + (r - paper[0]) * wash; gg = paper[1] + (gg - paper[1]) * wash; b = paper[2] + (b - paper[2]) * wash;
      const ink = edge * (0.4 + 0.6 * wash);
      o[i * 4] = r * (1 - ink) + 40 * ink; o[i * 4 + 1] = gg * (1 - ink) + 36 * ink; o[i * 4 + 2] = b * (1 - ink) + 30 * ink; o[i * 4 + 3] = 255;
    }
    g.putImageData(out, 0, 0);
    // paper fibres, the seal and the line under it
    g.globalAlpha = 0.06; g.strokeStyle = '#7a6a50';
    for (let i = 0; i < 400; i++) { const x = rnd(i, 1) * W, y = rnd(1, i) * H, a = rnd(i, i) * 6.28; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7); g.stroke(); }
    g.globalAlpha = 1;
    g.save(); g.translate(W - 48, H - 50); g.rotate(-0.05);
    g.fillStyle = 'rgba(176,32,28,.9)'; g.fillRect(0, 0, 34, 34);
    g.fillStyle = '#f6ead6'; g.font = '600 13px "Kaiti SC","STKaiti","KaiTi",serif'; g.textAlign = 'center';
    g.fillText(v.name.slice(0, 2), 17, 15); g.fillText(v.name.slice(2, 4), 17, 30);
    g.restore();
    g.fillStyle = 'rgba(42,38,32,.85)'; g.font = '14px "Kaiti SC","STKaiti","KaiTi","Noto Serif SC",serif'; g.textAlign = 'left';
    g.fillText(caption, 16, H - 16);
    const url = c.toDataURL('image/jpeg', 0.8);
    book[v.id] = { img: url, when: caption, t: Date.now() };
    save(); render();
    flash = 1.2;
    onSketch?.(v, url);
    return { view: v, url };
  }

  return {
    update, sketch, toggle, render,
    get current() { return current; },
    get book() { return book; },
    get count() { return Object.keys(book).length; },
  };
}
