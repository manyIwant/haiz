// The pocket map: opened over the walk in an instant (M, or the map button), closed as fast.
//
// It is not chapter 04: no camera flight, no buildings folding. A flat drawing of the same
// features (lanren/map/geo.js, the very rectangles of the plan and the model), north (towards
// the North Gate, campus coordinates) up, with the walker's position and heading, the place
// chosen as destination, and the names. Drag pans, the wheel or two fingers zoom, a tap on a
// place makes it the destination. From here: the full chapter 04, or a fresh start at the tree.
import { placeAt } from '../map/geo.js';

const COL = {
  paper: '#e8e1d1', road: '#f4efe4', roadEdge: '#bdb39f', building: '#cdbfa6', buildingInk: '#4a5348', garden: '#c3cca9', botanic: '#aebc92',
  field: '#b7c79c', court: '#c69b84', water: '#79a6a2', tree: '#5f7d4b', corridor: '#e2dacb', pavilion: '#c7a888', rock: '#a29d92', gate: '#b48a68'
};

export function createPocket({ geo, W, onClose, onFullMap, onRestart, say = () => {} }) {
  const frame = geo.frame, places = geo.places, features = geo.features;
  const el = document.createElement('div');
  el.className = 'wd-pocket';
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', '随身地图');
  el.innerHTML = `
    <div class="wd-pocket-card">
      <header><p><b>随身地图</b><span>北（校园坐标）朝上 · 点地点设为目的地</span></p><button type="button" class="wd-x" data-pk="close" aria-label="关闭随身地图">关闭 <kbd>M</kbd></button></header>
      <div class="wd-pocket-map"><canvas aria-label="校园平面与你的位置"></canvas><p class="wd-pocket-scale"><i></i><b></b></p></div>
      <p class="wd-pocket-dest" aria-live="polite"></p>
      <footer>
        <button type="button" data-pk="full">第四幕 · 完整地图</button>
        <button type="button" data-pk="restart">从榄仁树重新出发</button>
        <button type="button" data-pk="clear">清除目的地</button>
      </footer>
      <p class="wd-pocket-note">平面与三维校园同一套近似数据，不作实地导航；建筑不能进入。</p>
    </div>`;
  document.body.append(el);
  const canvas = el.querySelector('canvas'), g = canvas.getContext('2d');
  const R = frame.rotation, cR = Math.cos(R), sR = Math.sin(R);
  // world ↔ map (campus axes relative to the tree, metres; +y down the screen is campus +Z, i.e. south)
  const toMap = (x, z) => ({ x: x * cR - z * sR, y: x * sR + z * cR });
  const toWorld = (mx, my) => ({ x: mx * cR + my * sR, z: -mx * sR + my * cR });
  const view = { cx: 0, cy: 0, ppm: 1.4 };   // centre (map metres), pixels per metre
  let player = null, dpr = 1, W0 = 0, H0 = 0, open = false;

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, devicePixelRatio || 1);
    W0 = r.width; H0 = r.height;
    canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
  }
  const sx = (mx) => (mx - view.cx) * view.ppm + W0 / 2, sy = (my) => (my - view.cy) * view.ppm + H0 / 2;
  function rectPath(f) {
    g.beginPath();
    const c = Math.cos(f.rot), s = Math.sin(f.rot);
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([i, j], k) => {
      const lx = i * f.hw, lz = j * f.hd;
      const wx = f.cx + lx * c + lz * s, wz = f.cz - lx * s + lz * c;
      const m = toMap(wx, wz);
      if (k) g.lineTo(sx(m.x), sy(m.y)); else g.moveTo(sx(m.x), sy(m.y));
    });
    g.closePath();
  }
  function draw() {
    if (!open) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = COL.paper; g.fillRect(0, 0, W0, H0);
    for (const f of features) {
      rectPath(f);
      const fill = f.kind === 'court' ? COL.court : COL[f.kind] || COL.building;
      g.fillStyle = fill; g.fill();
      if (f.kind === 'building' || f.kind === 'gate') { g.strokeStyle = COL.buildingInk; g.lineWidth = 1; g.stroke(); }
      else if (f.kind === 'road') { g.strokeStyle = COL.roadEdge; g.lineWidth = 0.6; g.stroke(); }
    }
    // the tree
    const t = toMap(0, 0);
    g.fillStyle = COL.tree; g.beginPath(); g.arc(sx(t.x), sy(t.y), Math.max(5, 8 * view.ppm), 0, Math.PI * 2); g.fill();
    // names
    g.font = '12px "PingFang SC","Noto Sans SC",system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const p of places) {
      if (p.priority > (view.ppm > 2.2 ? 3 : 2)) continue;
      const m = toMap(p.x, p.z), x = sx(m.x), y = sy(m.y);
      if (x < -40 || y < -20 || x > W0 + 40 || y > H0 + 20) continue;
      const dest = W.destination === p.id;
      g.lineWidth = 3; g.strokeStyle = 'rgba(244,239,228,.9)'; g.strokeText(p.name, x, y);
      g.fillStyle = dest ? '#7a4c12' : '#2b3a32'; g.fillText(p.name, x, y);
    }
    // destination
    const d = W.destination && places.find((p) => p.id === W.destination);
    if (d) {
      const m = toMap(d.x, d.z), x = sx(m.x), y = sy(m.y) - 14;
      g.fillStyle = '#c8902f'; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(x - 4, y + 3); g.lineTo(x, y + 13); g.lineTo(x + 4, y + 3); g.fill();
    }
    // the walker: position and heading
    if (player) {
      const m = toMap(player.x, player.z), x = sx(m.x), y = sy(m.y);
      const yr = (player.yaw * Math.PI) / 180, dx = Math.sin(yr), dz = Math.cos(yr);
      const h = toMap(dx, dz), a = Math.atan2(h.y, h.x);
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = 'rgba(200,144,47,.25)'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 34, -0.5, 0.5); g.closePath(); g.fill();
      g.fillStyle = '#c8902f'; g.strokeStyle = '#fff'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(11, 0); g.lineTo(-7, -7); g.lineTo(-3, 0); g.lineTo(-7, 7); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
    // scale bar
    const nice = [5, 10, 20, 25, 50, 100, 200];
    const m = nice.find((v) => v * view.ppm > 60) || 200;
    el.querySelector('.wd-pocket-scale i').style.width = (m * view.ppm).toFixed(0) + 'px';
    el.querySelector('.wd-pocket-scale b').textContent = m + ' m';
    const dl = el.querySelector('.wd-pocket-dest');
    dl.textContent = d ? `目的地：${d.name}${player ? ` · 约 ${Math.round(Math.hypot(d.x - player.x, d.z - player.z))} m` : ''}` : '还没有目的地：点地图上的地点名称即可设定（可随时更换或清除）。';
  }

  // ---------------------------------------------------------------- input (the map's own while it is open)
  const pts = new Map();
  let down = null, pinch = null;
  canvas.addEventListener('pointerdown', (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture?.(e.pointerId);
    down = { x: e.clientX, y: e.clientY, t: e.timeStamp, moved: 0 };
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (down) down.moved += Math.abs(dx) + Math.abs(dy);
    if (pts.size >= 2 && pinch) {
      const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      view.ppm = Math.min(8, Math.max(0.5, view.ppm * (d / pinch))); pinch = d;
    } else { view.cx -= dx / view.ppm; view.cy -= dy / view.ppm; }
    draw();
  });
  const up = (e) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (down && down.moved < 6 && e.timeStamp - down.t < 600 && e.type === 'pointerup') {
      const r = canvas.getBoundingClientRect();
      const mx = (e.clientX - r.left - W0 / 2) / view.ppm + view.cx, my = (e.clientY - r.top - H0 / 2) / view.ppm + view.cy;
      const w = toWorld(mx, my);
      const p = placeAt(places, features, w.x, w.z);
      if (p) { W.setDestination(p.id); say(`${p.name} 设为目的地。`); draw(); }
    }
    down = null;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); view.ppm = Math.min(8, Math.max(0.5, view.ppm * Math.exp(-e.deltaY * 0.0015))); draw(); }, { passive: false });
  el.addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest('[data-pk]') : null;
    if (!b) return;
    if (b.dataset.pk === 'close') onClose();
    else if (b.dataset.pk === 'full') onFullMap();
    else if (b.dataset.pk === 'restart') onRestart();
    else if (b.dataset.pk === 'clear') { W.setDestination(null); draw(); }
  });
  el.addEventListener('pointerdown', (e) => { if (e.target === el) onClose(); });
  addEventListener('resize', () => { if (open) { resize(); draw(); } });
  W.on('destination', () => draw());

  return {
    el,
    get open() { return open; },
    show(pl) {
      player = pl ? { ...pl } : null;
      open = true;
      el.hidden = false;
      resize();
      if (player) { const m = toMap(player.x, player.z); view.cx = m.x; view.cy = m.y; }
      view.ppm = Math.max(0.8, Math.min(3, H0 / 260));
      draw();
      el.querySelector('[data-pk="close"]').focus({ preventScroll: true });
    },
    update(pl) { player = pl ? { ...pl } : player; draw(); },
    hide() { open = false; el.hidden = true; },
    /** for tests: map metres of a world point */
    toMap
  };
}
