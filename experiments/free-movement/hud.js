// HAIZ · 自由移动 — Anti-Clutter Spatial HUD, Horizon Orientation Tape,
// Foldable Architectural Campus Map + Fast Travel, and Campus Ten Views Sketchbook
//
// Rethinks driving & exploration UI from first principles (synthesizing insights from
// 网上南宁's real-city map/fast-travel/clean-HUD toggle, Petalwake's zero-clutter sky,
// and Season/Sable's diegetic exploration):
//   - NO permanent boxy corner minimap!
//   - NO generic RPM/speedometer dial!
//   - Top feather-thin Horizon Landmark Tape (地标方位尺): silently glides `北` and nearby
//     campus landmarks in your field of view, dissolving away when still.
//   - Bottom-left Kinetic Whisper: place name + mode-native rhythm line (踏频 / S-Carve流 /
//     乘风蓄力 / 热气流升率) + thin ink altitude bar ONLY when airborne.
//   - Foldable Watercolor Campus Map (M): full campus plan with roads, hatched buildings,
//     live NPCs, parked bike, 8 thermal updraft rings, live wind vector — click any landmark
//     to Paint Road Route (画路前往) OR Fast Travel (瞬移直达)!
//   - Clean Screenshot / Zen Mode (H): hides 100% of chrome cleanly!
import * as THREE from 'three';
import { PLACES, SPOTS } from '../../lanren/life/places.js';
import { INKS } from '../../lanren/life/map.js';
import { createWheelPath } from '../../lanren/free/wheelpath.js';
import { THERMALS } from './fx.js';

const FONT_HAND = '"Kaiti SC","STKaiti","KaiTi","Noto Serif SC","Songti SC",serif';
const TAU = Math.PI * 2;
const wrap = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

export const DESTS = [
  { key: 'tree', label: '百年榄仁树', short: '榄仁树', pt: () => SPOTS.tree_n, desc: '校园原点 · 百年绿冠' },
  { key: 'beimen', label: '北门', short: '北门', pt: () => SPOTS.beimen_in, desc: '中轴线入口' },
  { key: 'yihao', label: '一号教学楼', short: '一号楼', pt: () => PLACES.yihao.doors[0], desc: '前庭红瓦主楼' },
  { key: 'erhao', label: '二号教学楼', short: '二号楼', pt: () => PLACES.erhao.doors[0], desc: '连廊与庭院' },
  { key: 'library', label: '图书馆', short: '图书馆', pt: () => PLACES.library.doors[0], desc: '东侧阅览高台' },
  { key: 'yanchi', label: '砚池', short: '砚池', pt: () => SPOTS.pond_n, desc: '石刻与水岸 · 掠水起雾' },
  { key: 'yishu', label: '艺术中心', short: '艺术中心', pt: () => PLACES.yishu.doors[0], desc: '四组红瓦楼翼' },
  { key: 'track', label: '操场跑道', short: '操场', pt: () => SPOTS.track_s, desc: '泵滑竞速与强热气流' },
  { key: 'court', label: '篮球场', short: '篮球场', pt: () => SPOTS.court_edge, desc: '物理篮球与街头滑板' },
  { key: 'canteen1', label: '第一食堂', short: '一食堂', pt: () => PLACES.canteen1.doors[0], desc: '橘猫守望的小巷' },
  { key: 'kexue', label: '科学馆', short: '科学馆', pt: () => PLACES.kexue.doors[0], desc: '实验大楼与南风坡' },
  { key: 'garden', label: '植物园', short: '植物园', pt: () => SPOTS.garden_a, desc: '西南深绿曲径' },
];

const WHERE = {
  road: '校道', court: '球场', field: '操场', corridor: '连廊',
  pavilion: '亭下', gate: '校门', garden: '园径', botanic: '植物园', open: '', water: '水边',
};

// Ten spatial discovery moments across all 5 movement modes!
export const VIGNETTES = [
  { id: 'crown', name: '榄仁听风', hint: '骑竹扫帚停进百年榄仁树冠里。', test: (s) => s.mode === 'broom' && s.inLanshu > 0.25 && s.speed < 5 },
  { id: 'soar', name: '纸鸢乘流', hint: '驾榄仁纸鸢飞入任意一处上升热气流。', test: (s) => s.mode === 'glider' && s.thermalLift > 0.85 },
  { id: 'skim', name: '砚池掠水', hint: '低空贴着砚池水面飞掠，卷起一层水雾。', test: (s) => (s.mode === 'broom' || s.mode === 'glider') && s.overWater && s.agl < 4.5 && s.speed > 4 },
  { id: 'roof', name: '屋顶栖风', hint: '在教学楼或艺术中心屋顶上轻落（双击空格）。', test: (s) => s.mode === 'broom' && s.onRoof && (s.perched || s.speed < 2) },
  { id: 'above', name: '全校画卷', hint: '驾纸鸢或扫帚升到 34 米以上俯瞰府城校区。', test: (s) => (s.mode === 'broom' || s.mode === 'glider') && s.agl > 34 },
  { id: 'track', name: '跑道追风', hint: '骑单车或滑板在操场跑道跑出畅快速度。', test: (s) => (s.mode === 'bike' || s.mode === 'board') && s.speed > 5.5 && Math.hypot((s.x + 201) / 85, (s.z + 58.8) / 48) < 1.1 },
  { id: 'carve', name: '街头泵滑', hint: '踩滑板在球场或校道做出一次腾跃（空格/Q）。', test: (s) => s.mode === 'board' && s.air },
  { id: 'pond', name: '砚池晚照', hint: '傍晚或夕照时骑单车经过砚池岸边。', test: (s) => s.mode === 'bike' && Math.hypot(s.x - 4, s.z - 138) < 26 },
  { id: 'gate', name: '北门入画', hint: '经过府城校区北门中轴线。', test: (s) => Math.hypot(s.x + 35.6, s.z + 72) < 16 },
  { id: 'night', name: '晚自习灯火', hint: '夜晚抬头望见亮灯的教学楼。', test: (s) => s.hours >= 18.8 && s.hours < 23 && s.x > -95 && s.x < 35 && s.z > -10 && s.z < 95 && s.lookUp },
];

const SKETCH_KEY = 'haiz-fm-sketchbook-v1';

export function createHud({ world, nav, onRoute, onTeleport, onSketch }) {
  const wheel = createWheelPath(nav);
  const $ = (s) => document.querySelector(s);

  const el = {
    horizon: $('#fm-horizon'),
    horizonTrack: $('#fm-horizon-track'),
    whisper: $('#fm-whisper'),
    place: $('[data-fm="place"]'),
    rhythm: $('[data-fm="rhythm"]'),
    speed: $('[data-fm="speed"]'),
    dest: $('[data-fm="dest"]'),
    meterWrap: $('[data-fm="meter-wrap"]'),
    meterFill: $('[data-fm="meter-fill"]'),
    meterLabel: $('[data-fm="meter-label"]'),
    altWrap: $('#fm-alt'),
    altPin: $('#fm-alt i'),
    altVal: $('#fm-alt b'),
    trick: $('#fm-trick'),
    mapDrawer: $('#fm-map-drawer'),
    mapCanvas: $('#fm-map-canvas'),
    mapList: $('#fm-map-list'),
    mapInfo: $('#fm-map-info'),
    vista: $('#fm-vista'),
    bookModal: $('#fm-book'),
    bookBtn: $('#fm-book-btn'),
    flyImg: $('#fm-fly'),
  };

  // Pre-render the campus watercolor plan ONCE for the foldable architectural map
  const PX = 1.65;
  const B = { x0: -325, x1: 215, z0: -180, z1: 325 };
  const plan = document.createElement('canvas');
  plan.width = Math.round((B.x1 - B.x0) * PX);
  plan.height = Math.round((B.z1 - B.z0) * PX);
  const toP = (x, z) => [(x - B.x0) * PX, (z - B.z0) * PX];
  {
    const c = plan.getContext('2d');
    c.fillStyle = '#efe5cf'; c.fillRect(0, 0, plan.width, plan.height);
    const gp = world.ground.paint;
    const [px, pz] = toP(gp.x0, gp.z0);
    c.globalAlpha = 0.78; c.drawImage(gp.c, px, pz, gp.span * PX, gp.span * PX);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'soft-light'; c.fillStyle = '#f3e8ce'; c.fillRect(0, 0, plan.width, plan.height);
    c.globalCompositeOperation = 'source-over';
    const rectPath = (f) => {
      const cs = Math.cos(f.rot || 0), sn = Math.sin(f.rot || 0);
      c.beginPath();
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([i, j], k) => {
        const lx = i * f.hw, lz = j * f.hd;
        const [x, z] = toP(f.cx + lx * cs + lz * sn, f.cz - lx * sn + lz * cs);
        k ? c.lineTo(x, z) : c.moveTo(x, z);
      });
      c.closePath();
    };
    for (const f of world.geo.features) {
      if (f.kind !== 'water') continue;
      rectPath(f); c.fillStyle = 'rgba(65,126,136,.6)'; c.fill(); c.strokeStyle = 'rgba(30,62,72,.65)'; c.lineWidth = 1.2; c.stroke();
    }
    for (const b of world.model.buildings) {
      const f = { cx: b.cx, cz: b.cz, hw: b.w / 2, hd: b.d / 2, rot: b.rot };
      rectPath(f);
      const corr = b.form === 'corr' || b.form === 'pavilion';
      c.fillStyle = corr ? 'rgba(236,226,206,.6)' : '#e6dac2'; c.fill();
      c.save(); c.clip();
      c.strokeStyle = 'rgba(60,52,40,.24)'; c.lineWidth = 1;
      const [cx, cz] = toP(b.cx, b.cz), R = Math.hypot(b.w, b.d) * PX;
      for (let k = -R; k < R; k += corr ? 6 : 3.5) { c.beginPath(); c.moveTo(cx + k - R, cz - R); c.lineTo(cx + k + R, cz + R); c.stroke(); }
      c.restore();
      rectPath(f); c.strokeStyle = 'rgba(42,38,32,.85)'; c.lineWidth = corr ? 0.8 : 1.3; c.stroke();
    }
    const [tx, tz] = toP(0, 0);
    c.fillStyle = 'rgba(64,118,56,.78)'; c.beginPath(); c.arc(tx, tz, 11 * PX, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(38,68,34,.9)'; c.lineWidth = 1.3; c.stroke();
  }

  // Horizon tape landmark markers (DOM reused cleanly every frame — zero allocation!)
  const horizonItems = [
    { key: 'N', label: '北', isNorth: true, x: 0, z: -1e5 },
    ...DESTS.slice(0, 10).map((d) => { const p = d.pt(); return { key: d.key, label: d.short, x: p[0], z: p[1] }; }),
  ];
  const horizonEls = horizonItems.map((it) => {
    const s = document.createElement('span');
    s.className = it.isNorth ? 'fm-h-n' : 'fm-h-poi';
    s.innerHTML = it.isNorth ? '<b>北</b>' : `<i></i><span>${it.label}</span><small></small>`;
    el.horizonTrack?.appendChild(s);
    return { it, el: s, distEl: s.querySelector('small') };
  });

  // Foldable map landmark list + actions (Route vs Fast Travel!)
  let selectedDest = null;
  const state = {
    dest: null, route: null, routeAt: -99, arrived: 0,
    mapOpen: false, bookOpen: false, zen: false,
    show: 0, lastActive: 0, t: 0, smoothSpd: 0, placeT: 0,
    currentVista: null, shownVista: null,
  };

  if (el.mapList) {
    el.mapList.innerHTML = DESTS.map((d) =>
      `<li>
        <div class="fm-ml-meta"><b>${d.label}</b><small>${d.desc}</small></div>
        <div class="fm-ml-acts">
          <button type="button" data-map-route="${d.key}" title="在校园地面或空中画路引导">画路</button>
          <button type="button" data-map-tp="${d.key}" class="fm-tp" title="立即前往该地标">直达</button>
        </div>
      </li>`
    ).join('');
    el.mapList.addEventListener('click', (e) => {
      const rb = e.target.closest('[data-map-route]');
      const tb = e.target.closest('[data-map-tp]');
      if (rb) { setDest(rb.dataset.mapRoute); toggleMap(false); }
      if (tb) {
        const d = DESTS.find((x) => x.key === tb.dataset.mapTp);
        if (d) { const p = d.pt(); onTeleport?.(p[0], p[1], d.label); toggleMap(false); }
      }
    });
  }

  // Click directly on the watercolor map canvas to pick nearest landmark OR teleport!
  el.mapCanvas?.addEventListener('click', (e) => {
    const r = el.mapCanvas.getBoundingClientRect();
    const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
    const wx = B.x0 + u * (B.x1 - B.x0), wz = B.z0 + v * (B.z1 - B.z0);
    // Find nearest destination within 32m, else paint route directly to clicked campus spot
    let best = null, bd = 32;
    for (const d of DESTS) {
      const p = d.pt();
      const dd = Math.hypot(p[0] - wx, p[1] - wz);
      if (dd < bd) { bd = dd; best = d; }
    }
    if (best) {
      selectedDest = best;
      setDest(best.key);
      if (el.mapInfo) el.mapInfo.innerHTML = `已画路前往 <b>${best.label}</b>（点右侧「直达」可瞬移）`;
    } else {
      onTeleport?.(wx, wz, '选定位置');
      toggleMap(false);
    }
  });

  function setDest(key) {
    if (!key) { state.dest = null; state.route = null; onRoute?.(null); return; }
    const d = DESTS.find((x) => x.key === key);
    if (!d) return;
    const p = d.pt();
    state.dest = { key, label: d.label, x: p[0], z: p[1] };
    state.route = null; state.routeAt = -99; state.arrived = 0;
  }

  function planRoute(from, air, wheels) {
    if (!state.dest) return null;
    if (air) return { points: [{ x: from.x, z: from.z }, { x: state.dest.x, z: state.dest.z }], air: true };
    const r = (wheels && wheel.path(from.x, from.z, state.dest.x, state.dest.z)) || nav.path(from.x, from.z, state.dest.x, state.dest.z);
    return r ? { points: r.points, air: false, length: r.length } : { points: [{ x: from.x, z: from.z }, { x: state.dest.x, z: state.dest.z }], air: true };
  }

  function toggleMap(on) {
    const open = on ?? !state.mapOpen;
    state.mapOpen = open;
    if (el.mapDrawer) el.mapDrawer.hidden = !open;
    document.body.classList.toggle('fm-map-open', open);
    return open;
  }

  function toggleZen(on) {
    state.zen = on ?? !state.zen;
    document.body.classList.toggle('fm-zen', state.zen);
    return state.zen;
  }

  // Sketchbook (校园十景)
  let book = {};
  try { book = JSON.parse(localStorage.getItem(SKETCH_KEY) || '{}') || {}; } catch { book = {}; }
  const saveBook = () => { try { localStorage.setItem(SKETCH_KEY, JSON.stringify(book)); } catch { /* ignore */ } };

  function renderBook() {
    if (!el.bookModal) return;
    const list = el.bookModal.querySelector('ol');
    list.innerHTML = VIGNETTES.map((v) => {
      const p = book[v.id];
      return p
        ? `<li class="fm-pg-on"><figure><img src="${p.img}" alt="${v.name}"><figcaption><b>${v.name}</b><span>${p.when}</span></figcaption></figure></li>`
        : `<li><figure><div class="fm-pg-blank"><p>${v.hint}</p></div><figcaption><b>${'□'.repeat(4)}</b><span>待寻</span></figcaption></figure></li>`;
    }).join('');
    const n = Object.keys(book).filter((k) => VIGNETTES.some((v) => v.id === k)).length;
    const cnt = el.bookModal.querySelector('[data-fm="book-count"]');
    if (cnt) cnt.textContent = `${n} / ${VIGNETTES.length}`;
    if (el.bookBtn) el.bookBtn.querySelector('span').textContent = n ? `速写 ${n}/${VIGNETTES.length}` : '速写本';
  }
  renderBook();

  function toggleBook(on) {
    const open = on ?? !state.bookOpen;
    state.bookOpen = open;
    if (el.bookModal) { el.bookModal.hidden = !open; if (open) renderBook(); }
    return open;
  }

  // Ink-and-wash sketchbook page generator (reads WebGL buffer directly after render)
  function captureSketch(srcCanvas, caption) {
    const v = state.currentVista || { id: 'free-' + Date.now(), name: '海中行记' };
    const W = 480, H = 360;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    const sw = srcCanvas.width, sh = srcCanvas.height, ar = W / H;
    let cw = sw, ch = sw / ar; if (ch > sh) { ch = sh; cw = sh * ar; }
    g.drawImage(srcCanvas, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, W, H);
    const img = g.getImageData(0, 0, W, H), d = img.data;
    const L = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) L[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
    const out = g.createImageData(W, H), o = out.data;
    const rnd = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };
    const paper = [240, 232, 212];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const xm = Math.max(0, x - 1), xp = Math.min(W - 1, x + 1), ym = Math.max(0, y - 1), yp = Math.min(H - 1, y + 1);
        const gx = L[y * W + xp] - L[y * W + xm] + 0.5 * (L[ym * W + xp] - L[ym * W + xm] + L[yp * W + xp] - L[yp * W + xm]);
        const gy = L[yp * W + x] - L[ym * W + x] + 0.5 * (L[yp * W + xm] - L[ym * W + xm] + L[yp * W + xp] - L[ym * W + xp]);
        const edge = Math.min(1, Math.max(0, (Math.hypot(gx, gy) - 0.09) * 4.5)) * (0.65 + 0.35 * rnd(x, y));
        const q = Math.round(L[i] * 6) / 6;
        const k = 0.58 + 0.14 * rnd(x >> 2, y >> 2);
        let r = paper[0] * (1 - k) + (d[i * 4] * 0.78 + q * 255 * 0.22) * k;
        let gg = paper[1] * (1 - k) + (d[i * 4 + 1] * 0.78 + q * 255 * 0.22) * k;
        let b = paper[2] * (1 - k) + (d[i * 4 + 2] * 0.78 + q * 255 * 0.22) * k;
        const ex = Math.min(x, W - 1 - x) / W, ey = Math.min(y, H - 1 - y) / H;
        const wash = Math.max(0, Math.min(1, Math.min(ex, ey) * 9 + (rnd(x >> 3, y >> 3) - 0.5) * 0.32));
        r = paper[0] + (r - paper[0]) * wash; gg = paper[1] + (gg - paper[1]) * wash; b = paper[2] + (b - paper[2]) * wash;
        const ink = edge * (0.38 + 0.62 * wash);
        o[i * 4] = r * (1 - ink) + 38 * ink; o[i * 4 + 1] = gg * (1 - ink) + 34 * ink; o[i * 4 + 2] = b * (1 - ink) + 28 * ink; o[i * 4 + 3] = 255;
      }
    }
    g.putImageData(out, 0, 0);
    g.save(); g.translate(W - 48, H - 50); g.rotate(-0.05);
    g.fillStyle = 'rgba(176,32,28,.9)'; g.fillRect(0, 0, 34, 34);
    g.fillStyle = '#f6ead6'; g.font = `600 13px ${FONT_HAND}`; g.textAlign = 'center';
    g.fillText(v.name.slice(0, 2), 17, 15); g.fillText(v.name.slice(2, 4), 17, 30);
    g.restore();
    g.fillStyle = 'rgba(42,38,32,.85)'; g.font = `14px ${FONT_HAND}`; g.textAlign = 'left';
    g.fillText(caption, 16, H - 16);
    const url = c.toDataURL('image/jpeg', 0.82);
    if (VIGNETTES.some((x) => x.id === v.id)) { book[v.id] = { img: url, when: caption, t: Date.now() }; saveBook(); renderBook(); }
    if (el.flyImg) {
      el.flyImg.src = url; el.flyImg.hidden = false; el.flyImg.classList.remove('fly');
      requestAnimationFrame(() => setTimeout(() => el.flyImg.classList.add('fly'), 950));
      setTimeout(() => { el.flyImg.hidden = true; el.flyImg.classList.remove('fly'); }, 2200);
    }
    onSketch?.(v, url);
    return { view: v, url };
  }

  function placeName(p, agl) {
    if (Math.hypot(p.x, p.z) < 16) return agl > 5 ? '百年榄仁树上空' : '百年榄仁树下';
    if (Math.hypot(p.x - 4, p.z - 138) < 22) return agl > 4 ? '砚池上空' : '砚池岸边';
    let best = null, bd = 1e9;
    for (const b of world.model.buildings) {
      if (!b.name || b.form === 'corr') continue;
      const dx = p.x - b.cx, dz = p.z - b.cz, c = Math.cos(b.rot || 0), sn = Math.sin(b.rot || 0);
      const lx = Math.abs(dx * c - dz * sn) - b.w / 2, lz = Math.abs(dx * sn + dz * c) - b.d / 2;
      const d = Math.hypot(Math.max(lx, 0), Math.max(lz, 0));
      if (d < bd) { bd = d; best = b; }
    }
    const under = WHERE[nav.surfaceAt(p.x, p.z)] || '';
    if (!best || bd > 48) return agl > 5 ? '府城校区上空' : under || '府城校区';
    const name = PLACES[best.id]?.short || best.name.replace(/教学楼$/, '楼');
    const dx = p.x - best.cx, dz = p.z - best.cz;
    const side = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? '东' : '西') : (dz > 0 ? '南' : '北');
    if (agl > 5) return bd < 2.5 ? `${name}屋顶` : `${name}${side}上空`;
    return `${name}${bd < 13 ? side + '侧' : side}${under ? ' · ' + under : ''}`;
  }

  function drawFoldMap(s) {
    const cv = el.mapCanvas;
    if (!cv || !state.mapOpen) return;
    const g = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    g.drawImage(plan, 0, 0, W, H);
    const sx = W / (B.x1 - B.x0), sy = H / (B.z1 - B.z0);
    const mx = (x) => (x - B.x0) * sx, mz = (z) => (z - B.z0) * sy;

    // 8 Campus Thermal Updraft Zones (subtle golden dashed rings!)
    g.save();
    g.strokeStyle = 'rgba(210,145,42,0.52)'; g.lineWidth = 1.4; g.setLineDash([4, 4]);
    for (const th of THERMALS) {
      g.beginPath();
      g.ellipse(mx(th.x), mz(th.z), th.r * sx * 0.65, th.r * sy * 0.65, 0, 0, TAU);
      g.stroke();
    }
    g.restore();

    // Active Route painted on map
    if (state.route?.points?.length > 1) {
      g.save();
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = 'rgba(176,32,28,0.88)'; g.lineWidth = 3.2;
      if (state.route.air) g.setLineDash([7, 5]);
      g.beginPath();
      state.route.points.forEach((p, i) => (i ? g.lineTo(mx(p.x), mz(p.z)) : g.moveTo(mx(p.x), mz(p.z))));
      g.stroke();
      g.restore();
    }

    // Landmark pins & calligraphy labels
    g.font = `600 12px ${FONT_HAND}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const d of DESTS) {
      const p = d.pt();
      const x = mx(p[0]), z = mz(p[1]);
      const isDest = state.dest?.key === d.key;
      g.fillStyle = isDest ? '#b0201c' : 'rgba(42,38,32,0.72)';
      g.beginPath(); g.arc(x, z, isDest ? 5.5 : 3.0, 0, TAU); g.fill();
      g.fillStyle = isDest ? '#b0201c' : '#2c261f';
      g.fillText(d.short, x, z - 10);
    }

    // Living Campus NPCs
    for (const p of s.people || []) {
      const x = mx(p.x), z = mz(p.z);
      g.fillStyle = p.ink; g.beginPath(); g.arc(x, z, 3.6, 0, TAU); g.fill();
      g.strokeStyle = '#fff9ee'; g.lineWidth = 1.2; g.stroke();
    }

    // Parked bicycle marker
    if (s.parked) {
      const x = mx(s.parked.x), z = mz(s.parked.z);
      g.strokeStyle = '#1e5b49'; g.lineWidth = 2;
      g.beginPath(); g.arc(x - 4, z, 3, 0, TAU); g.moveTo(x + 7, z); g.arc(x + 4, z, 3, 0, TAU); g.stroke();
    }

    // Player crimson seal arrow (world +Z is down on canvas, yaw=0 faces +Z)
    const px = mx(s.pos.x), pz = mz(s.pos.z);
    g.save();
    g.translate(px, pz);
    g.rotate(Math.PI - s.heading);
    g.fillStyle = '#b0201c'; g.strokeStyle = '#fff8ea'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 7); g.lineTo(0, 3.5); g.lineTo(-7, 7); g.closePath();
    g.fill(); g.stroke();
    g.restore();
  }

  let acc = 0;
  function update(dt, s, vistaCtx) {
    state.t += dt;
    // Route lifecycle
    if (state.dest) {
      const air = (s.mode === 'broom' || s.mode === 'glider') && s.agl > 2.2;
      const wheels = s.mode === 'bike' || s.mode === 'board';
      const far = Math.hypot(state.dest.x - s.pos.x, state.dest.z - s.pos.z);
      if (far < (air ? 12 : 6.5)) {
        const label = state.dest.label;
        state.arrived = state.t; setDest(null);
        onRoute?.({ arrived: label });
      } else if (!state.route || state.route.air !== air || !!state.route.wheels !== wheels || state.t - state.routeAt > (air ? 0.6 : 4.2)) {
        state.route = planRoute(s.pos, air, wheels);
        if (state.route) state.route.wheels = wheels;
        state.routeAt = state.t;
        onRoute?.(state.route ? { points: state.route.points, air, dest: state.dest } : null);
      }
    }

    // Whisper & Horizon Tape visibility (auto-recedes when standing still on foot!)
    const active = s.riding || s.speed > 1.8 || !!state.dest;
    if (active) state.lastActive = state.t;
    const want = active || state.t - state.lastActive < 3.0 ? 1 : 0;
    state.show += (want - state.show) * (1 - Math.exp(-dt * (want ? 4.5 : 1.6)));
    if (el.whisper) el.whisper.style.opacity = (state.show * 0.96).toFixed(3);
    if (el.horizon) el.horizon.style.opacity = (0.35 + state.show * 0.65).toFixed(3);

    // Trick callout whisper
    if (el.trick) {
      if (s.trickT > 0.05 && s.trickLabel) {
        el.trick.textContent = s.trickLabel;
        el.trick.hidden = false;
        el.trick.classList.add('on');
      } else {
        el.trick.classList.remove('on');
      }
    }

    // Vignette / Campus Ten Views detection
    if (vistaCtx) {
      const v = VIGNETTES.find((x) => { try { return x.test(vistaCtx); } catch { return false; } }) || null;
      state.currentVista = v;
      const id = v ? v.id : null;
      if (id !== state.shownVista) {
        state.shownVista = id;
        if (v && el.vista) {
          el.vista.querySelector('b').textContent = `「${v.name}」`;
          el.vista.querySelector('span').textContent = book[v.id] ? '已入画 · 可再描一张' : '此刻可入画';
          el.vista.hidden = false;
          requestAnimationFrame(() => el.vista.classList.add('on'));
        } else if (el.vista) {
          el.vista.classList.remove('on');
          setTimeout(() => { if (!state.shownVista) el.vista.hidden = true; }, 400);
        }
      }
    }

    acc += dt;
    if (acc < 1 / 30) return;
    acc = 0;

    // 1. Update Top Horizon Orientation Tape (shows North + de-cluttered non-overlapping landmarks)
    const camYaw = s.camYaw;
    const candidates = [];
    for (const h of horizonEls) {
      const it = h.it;
      const dx = it.x - s.pos.x, dz = it.z - s.pos.z;
      const targetYaw = it.isNorth ? Math.PI : Math.atan2(dx, dz);
      const rel = -wrap(targetYaw - camYaw);
      const isDest = state.dest?.key === it.key;
      const dist = it.isNorth ? 0 : Math.hypot(dx, dz);
      if (Math.abs(rel) < 1.18) {
        const pct = 50 + (rel / 1.18) * 45;
        const prio = isDest ? 0 : it.isNorth ? 1 : dist;
        candidates.push({ h, pct, dist, isDest, prio });
      } else {
        h.el.style.display = 'none';
      }
    }
    candidates.sort((a, b) => a.prio - b.prio);
    const placed = [];
    const minGap = innerWidth < 600 ? 22 : 14;
    for (const c of candidates) {
      const collides = placed.some((p) => Math.abs(p - c.pct) < minGap);
      if (collides) {
        c.h.el.style.display = 'none';
        continue;
      }
      placed.push(c.pct);
      c.h.el.style.display = '';
      c.h.el.style.left = c.pct.toFixed(1) + '%';
      c.h.el.classList.toggle('dest', c.isDest);
      if (!c.h.it.isNorth && c.h.distEl) {
        c.h.distEl.textContent = c.dist < 1000 ? `${Math.max(5, Math.round(c.dist / 5) * 5)}m` : `${(c.dist / 1000).toFixed(1)}km`;
      }
    }

    // 2. Update Bottom-Left Kinetic Whisper (mode-specific tactile state, NOT a boxy speedometer)
    state.smoothSpd += (s.speed * 3.6 - state.smoothSpd) * 0.35;
    if (el.speed) el.speed.textContent = state.smoothSpd < 0.6 ? '0' : state.smoothSpd.toFixed(0);
    let rhythm = '';
    if (s.mode === 'bike') {
      rhythm = s.stand > 0.5 ? '起身摇车' : s.cadence > 5 ? `踏频 ${Math.round(s.cadence)}` : s.speed > 0.5 ? '飞轮滑行' : '单脚点地';
    } else if (s.mode === 'board') {
      rhythm = s.air ? '腾跃滞空' : s.manual > 0.5 ? '板尾平衡' : s.carveFlow >= 2 ? `泵滑流 ×${s.carveFlow}` : s.pushes ? `第 ${s.pushes} 蹬` : '准备起滑';
    } else if (s.mode === 'broom') {
      rhythm = s.perched ? '屋顶栖风' : s.overWater && s.agl < 4 ? '砚池掠水 · 乘风蓄力' : s.agl < 1.8 ? (s.speed > 1 ? '贴地乘风' : '低空悬停') : `掠空 ${Math.round(s.agl)} 米`;
    } else if (s.mode === 'glider') {
      rhythm = s.thermalLift > 0.6 ? `${s.thermalName || '上升热流'} +${s.thermalLift.toFixed(1)}m/s` : `无动力滑翔 · 离地 ${Math.round(s.agl)} 米`;
    } else {
      rhythm = s.speed > 2.5 ? '轻快奔跑' : s.speed > 0.3 ? '校园漫步' : '';
    }
    if (el.rhythm) el.rhythm.textContent = rhythm;

    // Mode-contextual subtle ink meter (Gust charge for Broom, Thermal Lift for Glider, hidden otherwise!)
    if (el.meterWrap && el.meterFill && el.meterLabel) {
      if (s.mode === 'broom') {
        el.meterWrap.hidden = false;
        el.meterLabel.textContent = '乘风';
        el.meterFill.style.width = `${Math.round(s.gust * 100)}%`;
      } else if (s.mode === 'glider') {
        el.meterWrap.hidden = false;
        el.meterLabel.textContent = s.thermalLift > 0.5 ? '热流' : '空速';
        const frac = s.thermalLift > 0.5 ? Math.min(1, s.thermalLift / 3.4) : Math.min(1, (s.speed - 5) / 14);
        el.meterFill.style.width = `${Math.round(frac * 100)}%`;
      } else {
        el.meterWrap.hidden = true;
      }
    }

    // Thin vertical altitude ink-hairline ONLY when airborne!
    const isAir = s.mode === 'broom' || s.mode === 'glider';
    if (el.altWrap) {
      el.altWrap.hidden = !isAir;
      if (isAir) {
        const ceil = s.mode === 'glider' ? 68 : 58;
        const pct = Math.min(1, Math.max(0, s.agl / ceil));
        if (el.altPin) el.altPin.style.bottom = `${(pct * 100).toFixed(1)}%`;
        if (el.altVal) el.altVal.textContent = `${Math.round(s.agl)}m`;
      }
    }

    state.placeT -= 1 / 30;
    if (state.placeT <= 0 && el.place) {
      state.placeT = 0.55;
      el.place.textContent = placeName(s.pos, isAir ? s.agl : 0);
    }
    if (el.dest) {
      if (state.dest) {
        const dist = Math.hypot(state.dest.x - s.pos.x, state.dest.z - s.pos.z);
        el.dest.textContent = `→ ${state.dest.label} · ${Math.max(5, Math.round(dist / 5) * 5)} 米`;
      } else if (state.t - state.arrived < 3.2) {
        el.dest.textContent = '已抵达';
      } else {
        el.dest.textContent = '';
      }
    }

    if (state.mapOpen) drawFoldMap(s);
  }

  return {
    update, setDest, toggleMap, toggleBook, toggleZen, captureSketch,
    get mapOpen() { return state.mapOpen; },
    get bookOpen() { return state.bookOpen; },
    get zen() { return state.zen; },
    get currentVista() { return state.currentVista; },
    get dest() { return state.dest; },
  };
}
