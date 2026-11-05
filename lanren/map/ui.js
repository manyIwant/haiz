// The map's words and controls. WebGL draws the ground; HTML carries what has
// to be read and pressed, pinned to the same world points through the camera.
import { GROUND_Y } from './geo.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NICE = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500];
// the crown, as an ellipsoid (lanren/assets/tree.json crown bounds): labels behind it hide
const CROWN = { x: -2.1, y: 9.4, z: -0.45, rx: 15.2, ry: 6.8, rz: 12.0 };

export function buildDom(places) {
  const root = document.createElement('div');
  root.id = 'campusMap';
  root.className = 'cmap';
  const list = places.map((p) => `<li><button type="button" data-place="${esc(p.id)}"><span>${esc(p.name)}</span><small>${p.id === 'lanshu' ? '原点' : `${esc(p.fromTree.bearing)} · ${Math.round(p.fromTree.distance)} m`}</small></button></li>`).join('');
  root.innerHTML = `
  <div class="cmap-labels" aria-hidden="true"></div>
  <button type="button" class="cmap-locator" data-act="tree" tabindex="-1" aria-hidden="true"><i></i><span>百年榄仁树</span><small></small></button>
  <div class="cmap-reveal" role="status" aria-live="polite">
    <p><b>水面之下</b><span>是整座校园</span></p>
    <i class="cmap-progress"><i></i></i>
    <small><button type="button" data-act="hurry">轻触即刻显现</button> · 滚动继续第五幕</small>
  </div>
  <header class="cmap-head">
    <p class="cmap-eyebrow"><b>04</b><span>水面之下 · 校园平面</span></p>
    <p class="cmap-lede">以百年榄仁树为原点，1 米即 1 米。拖动平移，滚轮或双指缩放，点选地点。</p>
    <p class="cmap-note">平面沿用项目既有校园数据（KML 转换结果），为近似表达；绝对方向与精度未独立复核，不作实地导航。</p>
  </header>
  <div class="cmap-dock" role="toolbar" aria-label="地图视角与缩放">
    <div class="cmap-seg" role="radiogroup" aria-label="视角">
      <button type="button" role="radio" aria-checked="true" data-view="oblique">斜俯视</button>
      <button type="button" role="radio" aria-checked="false" data-view="top">正俯视</button>
    </div>
    <button type="button" class="cmap-round" data-act="zoomin" aria-label="放大">+</button>
    <button type="button" class="cmap-round" data-act="zoomout" aria-label="缩小">−</button>
    <button type="button" data-act="tree" aria-label="回到榄仁树（地图原点）">回到榄仁树</button>
    <button type="button" data-act="places" aria-expanded="false" aria-controls="cmapPlaces">地点</button>
  </div>
  <div class="cmap-exit">
    <button type="button" data-act="exit">返回树冠</button>
    <button type="button" class="cmap-next" data-act="next">继续 · 05 远眺 <i aria-hidden="true">→</i></button>
  </div>
  <div class="cmap-scale" aria-hidden="true"><span class="cmap-north"><i></i>北<small>校园坐标</small></span><span class="cmap-bar"><i></i><b>20 m</b></span></div>
  <p class="cmap-live" role="status" aria-live="polite"></p>
  <nav id="cmapPlaces" class="cmap-places" aria-label="校园地点" hidden>
    <header><h3>地点</h3><button type="button" data-act="places-close" aria-label="收起地点列表">收起</button></header>
    <ul>${list}</ul>
    <p class="cmap-pan"><span>平移范围（试验）</span><button type="button" data-pan="open" aria-pressed="true">自由</button><button type="button" data-pan="tether" aria-pressed="false">榄仁树保持可见</button></p>
  </nav>
  <aside class="cmap-detail" aria-labelledby="cmapTitle" hidden tabindex="-1">
    <div class="cmap-detail-in">
      <button type="button" class="cmap-close" data-act="close">← 返回地图</button>
      <p class="cmap-cat"></p>
      <h3 id="cmapTitle"></h3>
      <p class="cmap-en"></p>
      <figure class="cmap-photo"><img alt="" loading="lazy" decoding="async"><figcaption></figcaption></figure>
      <p class="cmap-desc"></p>
      <dl class="cmap-facts"></dl>
      <p class="cmap-src"></p>
      <div class="cmap-actions"><a class="cmap-walk" href="#">从这里步入校园 <i aria-hidden="true">↗</i></a><button type="button" data-act="center">在地图上居中</button></div>
      <p class="cmap-walk-note">第一人称漫游是另一个独立页面（campus-3d），从这个地点附近的校道开始；返回时回到这里的地图状态。</p>
    </div>
  </aside>`;
  document.body.append(root);
  // labels: one element per place, placed every frame
  const labels = root.querySelector('.cmap-labels');
  const labelEls = new Map();
  for (const p of places) {
    const el = document.createElement('span');
    el.className = 'cmap-label p' + p.priority + (p.id === 'lanshu' ? ' is-tree' : '');
    el.dataset.place = p.id;
    el.innerHTML = p.id === 'lanshu' ? `<b>${esc(p.name)}</b><small>原点 · 0 m</small>` : p.inscription ? `<b>${esc(p.name)}</b><small>「${esc(p.inscription)}」</small>` : `<b>${esc(p.name)}</b>`;
    labels.append(el);
    labelEls.set(p.id, el);
  }
  return { root, labels, labelEls, $: (q) => root.querySelector(q), $$: (q) => [...root.querySelectorAll(q)] };
}

/** Fill the detail panel for a place (real words, project photo, sources). */
export function fillDetail(dom, p, geo) {
  const $ = dom.$;
  $('.cmap-cat').textContent = [p.category, p.en].filter(Boolean).join(' · ');
  $('#cmapTitle').textContent = p.name;
  $('.cmap-en').textContent = p.inscription ? `题词「${p.inscription}」` : '';
  const fig = $('.cmap-photo'), img = fig.querySelector('img');
  if (p.image) {
    fig.hidden = false;
    img.src = p.image;
    img.alt = p.name + ' · 项目已有照片';
    fig.querySelector('figcaption').textContent = (p.note.match(/图片来源：[^；;]*/) || ['照片沿用项目现有资产'])[0] + '。年代与转载授权待确认。';
  } else {
    fig.hidden = true;
    img.removeAttribute('src');
  }
  $('.cmap-desc').textContent = p.desc || '这个地点在既有数据中还没有文字介绍。';
  const facts = [];
  if (p.id === 'lanshu') facts.push(['位置', '地图原点 · 一号教学楼北侧（校园坐标）']);
  else facts.push(['距榄仁树', `约 ${Math.round(p.fromTree.distance)} m · ${p.fromTree.bearing}（校园坐标方向）`]);
  facts.push(['占地', `约 ${Math.round(p.w)} × ${Math.round(p.d)} m（既有平面矩形）`]);
  if (p.floors && p.size && ['building', 'gate'].includes(p.kind)) facts.push(['体量', `${p.floors} 层 · 模型高 ${Math.round(p.size[1])} m（沿用漫游模型，非测量）`]);
  if (p.imageWithheld) facts.push(['照片', '现有照片身份存疑，暂不显示']);
  $('.cmap-facts').innerHTML = facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
  const text = (p.note.match(/文字依据[^。]*/) || [''])[0];
  $('.cmap-src').textContent = [text && text + '。', '坐标来自项目既有平面数据（' + (geo.verification === 'legacy-derived-unverified' ? '继承 KML 转换，未独立复核' : geo.verification) + '）。'].filter(Boolean).join(' ');
  $('.cmap-walk').href = p.walk + '&from=map';
}

// ---------------------------------------------------------------- the overlay, every frame
export function createOverlay(dom, places, V3) {
  const anchors = places.map((p) => (p.id === 'lanshu' ? new V3(0.6, 15.8, -0.2) : new V3(p.x, GROUND_Y + 0.2, p.z)));
  const tmp = new V3(), ray = new V3(), o = new V3();
  const sizes = new Map();
  const occludedByCrown = (cam, target) => {
    // ray from the eye to the anchor against the crown ellipsoid (in its own unit space)
    o.set((cam.position.x - CROWN.x) / CROWN.rx, (cam.position.y - CROWN.y) / CROWN.ry, (cam.position.z - CROWN.z) / CROWN.rz);
    ray.set((target.x - cam.position.x) / CROWN.rx, (target.y - cam.position.y) / CROWN.ry, (target.z - cam.position.z) / CROWN.rz);
    const a = ray.dot(ray), b = 2 * o.dot(ray), c = o.dot(o) - 1, disc = b * b - 4 * a * c;
    if (disc <= 0) return false;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    return t > 0 && t < 0.98;
  };
  let lastKey = '';
  return {
    anchors,
    /** project, cull and declutter labels; returns metres-per-pixel at the screen centre */
    update(cam, rect, view, state) {
      const W = rect.width, H = rect.height;
      const key = cam.matrixWorld.elements.map((v) => v.toFixed(3)).join() + W + 'x' + H + state.hover + state.selected + state.on;
      if (key === lastKey && !state.force) return;
      lastKey = key;
      const tierMax = view.s < 26 ? 3 : view.s < 60 ? 2 : view.s < 140 ? 1 : 0.5;
      // the free part of the screen (chrome at the top and bottom)
      const L = 24, R = W - 24, T = W > 760 ? 64 : 110, B = H - (W > 760 ? 72 : 172);   // phones: two rows of controls and the scale
      const placed = [];
      places.forEach((p, i) => {
        const el = dom.labelEls.get(p.id);
        const emph = p.id === state.hover || p.id === state.selected;
        let show = state.on, x = 0, y = 0;
        if (p.id === 'lanshu') {
          tmp.copy(anchors[i]).project(cam);
          x = (tmp.x * 0.5 + 0.5) * W; y = (-tmp.y * 0.5 + 0.5) * H;
          show = show && tmp.z < 1 && x > L && x < R && y > T - 30 && y < B;
        } else if (show) {
          // the footprint on screen; a big building's label sits in the part that is in view
          let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, behind = false;
          for (const [cx, cz] of [[p.box.x0, p.box.z0], [p.box.x1, p.box.z0], [p.box.x1, p.box.z1], [p.box.x0, p.box.z1]]) {
            tmp.set(cx, GROUND_Y, cz).project(cam);
            if (tmp.z >= 1) behind = true;
            const sx = (tmp.x * 0.5 + 0.5) * W, sy = (-tmp.y * 0.5 + 0.5) * H;
            x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
          }
          const size = Math.min(x1 - x0, y1 - y0);
          const vx0 = Math.max(x0, L), vx1 = Math.min(x1, R), vy0 = Math.max(y0, T), vy1 = Math.min(y1, B);
          x = (vx0 + vx1) / 2; y = (vy0 + vy1) / 2;
          let w = sizes.get(p.id);
          if (!w) { w = [el.offsetWidth || 60, el.offsetHeight || 18]; sizes.set(p.id, w); }
          show = !behind && vx1 - vx0 > Math.min(w[0] * 0.7, size) && vy1 - vy0 > Math.min(16, size);
          // small places wait for the zoom; the most important ones show earlier
          if (show && !emph && (p.priority > tierMax || size < (p.priority <= 1 ? 8 : 22))) show = false;
          if (show) {
            const g = new V3(((x / W) * 2 - 1), -((y / H) * 2 - 1), 0.5).unproject(cam).sub(cam.position);
            const t = (GROUND_Y - cam.position.y) / g.y;
            if (t > 0 && occludedByCrown(cam, g.multiplyScalar(t).add(cam.position))) show = emph;
          }
        }
        if (show) {
          // declutter: higher priority first (places are sorted), then keep clear of what is placed
          let w = sizes.get(p.id);
          if (!w) { w = [el.offsetWidth || 60, el.offsetHeight || 18]; sizes.set(p.id, w); }
          const box = [x - w[0] / 2 - 4, y - w[1] / 2 - 2, x + w[0] / 2 + 4, y + w[1] / 2 + 2];
          if (!emph && p.id !== 'lanshu' && placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) show = false;
          else placed.push(box);
        }
        el.classList.toggle('on', show);
        el.classList.toggle('emph', emph);
        if (show) el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      });
    }
  };
}

/** a nice round length for the scale bar */
export function niceScale(metresPerPx, targetPx = 96) {
  const want = metresPerPx * targetPx;
  let best = NICE[0];
  for (const n of NICE) if (n <= want * 1.15) best = n;
  return { metres: best, px: best / metresPerPx };
}
