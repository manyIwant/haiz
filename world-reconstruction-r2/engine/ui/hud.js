/**
 * HAIZ · World Reconstruction Round 2 — Editorial Spatial HUD, Map, Provenance & Comparison Drawer.
 */
import { formatHour, scheduleAtHour } from '../core/runtime.js';

const LENSES = [
  { id: 0, name: '南海晴光', desc: '热带建筑 HDR IBL 与真实材质光影' },
  { id: 1, name: '入画水粉', desc: '蓝紫冷影、暖光反射与绘画明度凝聚' },
  { id: 2, name: '建筑剖面', desc: '1.2m 水平建筑剖切与平面阅读模式' },
];

const WEATHERS = [
  { id: 'clear', name: '晴朗微风', desc: '海口晴空与热带积云' },
  { id: 'cloudy', name: '多云海风', desc: '柔和散射光与阵风' },
  { id: 'rain', name: '热带阵雨', desc: '雨丝、湿石反光与撑伞避雨' },
  { id: 'after_rain', name: '雨后初晴', desc: '石板积水倒影与通透空气' },
];

const TIME_PRESETS = [
  { h: 6.75, label: '06:45 晨光' },
  { h: 11.5, label: '11:30 正午' },
  { h: 16.65, label: '16:40 晴暮' },
  { h: 18.25, label: '18:15 晚霞' },
  { h: 20.5, label: '20:30 晚自习' },
];

const QUALITIES = [
  { id: 'ultra', label: '极清 Ultra' },
  { id: 'high', label: '高画质 High' },
  { id: 'balanced', label: '均衡 Balanced' },
  { id: 'mobile', label: '移动 Mobile' },
];

export const COMPARISON_VISTAS = [
  {
    id: 'beimen',
    name: '北门牌坊（海南中學）',
    plate: './world-reconstruction-r2/renders/comparisons/comp_beimen.jpg',
    basis: 'hero-2560 Calibrated Camera · Xingkai「學中南海」真刻扁额、回字纹、石狮须弥座与孔雀绿筒瓦',
    vista: { id: 'cmp_beimen', name: '北门牌坊实景标定机位', pos: [0.44, 120.28, 1.8], target: [0.05, 106.2, 4.9] },
  },
  {
    id: 'library',
    name: '图书馆与天文台',
    plate: './world-reconstruction-r2/renders/comparisons/comp_library.jpg',
    basis: 'campus_library.jpg · 西侧室外大台阶、弧形蓝绿玻璃幕墙、倒角遮阳外廊与 20 肋银灰天文穹顶',
    vista: { id: 'cmp_library', name: '图书馆西南标定机位', pos: [52.0, -31.0, 2.3], target: [95.0, 1.5, 9.8] },
  },
  {
    id: 'fengqitang',
    name: '凤栖堂与春风化雨铜像',
    plate: './world-reconstruction-r2/renders/comparisons/comp_fengqitang.jpg',
    basis: 'campus_fengqitang.jpg · 孔雀绿琉璃瓦顶、八柱金色木柱础、白格红木门窗与先贤铜像',
    vista: { id: 'cmp_fengqitang', name: '凤栖堂庭院正面机位', pos: [-43.1, 47.0, 1.8], target: [-43.1, 74.0, 3.2] },
  },
  {
    id: 'yanlinting',
    name: '衍林亭',
    plate: './world-reconstruction-r2/renders/comparisons/comp_yanlinting.jpg',
    basis: 'campus_yanlintang.jpg · 四角攒尖绿瓦宝顶、朱红翘角飞椽、红木匾额「衍林亭」与美人靠坐凳',
    vista: { id: 'cmp_yanlinting', name: '衍林亭西南特写机位', pos: [23.8, 46.8, 1.8], target: [34.0, 55.0, 3.2] },
  },
  {
    id: 'keji',
    name: '科技楼',
    plate: './world-reconstruction-r2/renders/comparisons/comp_keji.jpg',
    basis: 'campus_keji.jpg · 棕色横百叶裙墙、香槟壁柱、双层青铜玻璃大堂与错格石材前庭广场',
    vista: { id: 'cmp_keji', name: '科技楼对角广场机位', pos: [12.5, 58.5, 2.0], target: [41.0, 84.5, 7.6] },
  },
];

export class CampusHUD {
  constructor(spec, callbacks) {
    this.spec = spec;
    this.cb = callbacks;
    this.activePanel = null;
    this.mapOpen = false;
    this.cmpOpen = false;
    this.activeCmpId = 'beimen';
    this._toastTimer = null;

    this.elClock = document.getElementById('wr-clock');
    this.elWhisperLoc = document.getElementById('wr-whisper-loc');
    this.elWhisperSub = document.getElementById('wr-whisper-sub');
    this.elHint = document.getElementById('wr-hint');
    this.elToast = document.getElementById('wr-toast');
    this.elProv = document.getElementById('wr-provenance');
    this.elMapModal = document.getElementById('wr-map-modal');
    this.elMapCanvas = document.getElementById('wr-map-canvas');
    this.mapCtx = this.elMapCanvas.getContext('2d');
    this.elCmpModal = document.getElementById('wr-cmp-modal');

    this._buildPanels();
    this._bindTopBar();
    this._bindDock();
    this._bindMap();
    this._bindComparison();
    this._bindTouch();
  }

  _buildPanels() {
    const vList = document.getElementById('wr-vistas-list');
    vList.innerHTML = '';
    for (const v of this.spec.vistas) {
      const btn = document.createElement('button');
      btn.className = 'wr-chip';
      btn.dataset.vistaId = v.id;
      btn.innerHTML = `${v.name}<small>${v.subtitle}</small>`;
      btn.addEventListener('click', () => {
        this.cb.onVista(v);
        this.closePanels();
      });
      vList.appendChild(btn);
    }

    const lList = document.getElementById('wr-lens-list');
    lList.innerHTML = '';
    for (const l of LENSES) {
      const btn = document.createElement('button');
      btn.className = 'wr-chip' + (l.id === 0 ? ' active' : '');
      btn.dataset.lens = String(l.id);
      btn.innerHTML = `${l.name}<small>${l.desc}</small>`;
      btn.addEventListener('click', () => {
        this.cb.onLens(l.id);
        this.setActiveLens(l.id);
      });
      lList.appendChild(btn);
    }

    const wGrid = document.getElementById('wr-weather-grid');
    wGrid.innerHTML = '';
    for (const w of WEATHERS) {
      const btn = document.createElement('button');
      btn.className = 'wr-chip' + (w.id === 'clear' ? ' active' : '');
      btn.dataset.wx = w.id;
      btn.innerHTML = `${w.name}<small>${w.desc}</small>`;
      btn.addEventListener('click', () => {
        this.cb.onWeather(w.id);
        this.setActiveWeather(w.id);
      });
      wGrid.appendChild(btn);
    }

    const tGrid = document.getElementById('wr-time-grid');
    tGrid.innerHTML = '';
    for (const tp of TIME_PRESETS) {
      const btn = document.createElement('button');
      btn.className = 'wr-chip';
      btn.textContent = tp.label;
      btn.addEventListener('click', () => {
        this.cb.onHour(tp.h);
        document.getElementById('wr-hour-slider').value = String(tp.h);
      });
      tGrid.appendChild(btn);
    }
    const slider = document.getElementById('wr-hour-slider');
    slider.addEventListener('input', () => this.cb.onHour(Number(slider.value)));

    const qGrid = document.getElementById('wr-quality-grid');
    qGrid.innerHTML = '';
    for (const q of QUALITIES) {
      const btn = document.createElement('button');
      btn.className = 'wr-chip';
      btn.dataset.quality = q.id;
      btn.textContent = q.label;
      btn.addEventListener('click', () => {
        this.cb.onQuality(q.id);
        this.setActiveQuality(q.id);
      });
      qGrid.appendChild(btn);
    }
  }

  _bindTopBar() {
    document.querySelectorAll('[data-panel]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.panel;
        if (this.activePanel === id) this.closePanels();
        else this.openPanel(id);
      });
    });
    document.getElementById('wr-btn-cmp')?.addEventListener('click', () => this.toggleComparison());
    document.getElementById('wr-btn-map').addEventListener('click', () => this.toggleMap());
    document.getElementById('wr-btn-zen').addEventListener('click', () => document.body.classList.toggle('wr-zen'));
    document.getElementById('wr-zen-exit').addEventListener('click', () => document.body.classList.remove('wr-zen'));
    document.getElementById('wr-prov-close').addEventListener('click', () => { this.elProv.hidden = true; });
  }

  _bindComparison() {
    if (!this.elCmpModal) return;
    const tabs = document.getElementById('wr-cmp-tabs');
    const img = document.getElementById('wr-cmp-img');
    const basis = document.getElementById('wr-cmp-basis');
    const flyBtn = document.getElementById('wr-cmp-fly');
    const selectItem = (id) => {
      const item = COMPARISON_VISTAS.find((c) => c.id === id) || COMPARISON_VISTAS[0];
      this.activeCmpId = item.id;
      if (img) img.src = item.plate;
      if (basis) basis.textContent = `${item.name} · ${item.basis}`;
      tabs?.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.cmp === item.id));
    };
    if (tabs) {
      tabs.innerHTML = '';
      for (const item of COMPARISON_VISTAS) {
        const b = document.createElement('button');
        b.className = 'wr-cmp-tab';
        b.dataset.cmp = item.id;
        b.textContent = item.name.split('（')[0];
        b.addEventListener('click', () => selectItem(item.id));
        tabs.appendChild(b);
      }
    }
    flyBtn?.addEventListener('click', () => {
      const item = COMPARISON_VISTAS.find((c) => c.id === this.activeCmpId);
      if (item) {
        this.cb.onVista(item.vista);
        this.toggleComparison(false);
      }
    });
    document.getElementById('wr-cmp-close')?.addEventListener('click', () => this.toggleComparison(false));
    this.elCmpModal.addEventListener('click', (e) => {
      if (e.target === this.elCmpModal) this.toggleComparison(false);
    });
    selectItem('beimen');
  }

  toggleComparison(force, itemId = null) {
    if (!this.elCmpModal) return;
    this.cmpOpen = typeof force === 'boolean' ? force : !this.cmpOpen;
    this.elCmpModal.hidden = !this.cmpOpen;
    if (this.cmpOpen) {
      this.closePanels();
      this.toggleMap(false);
      if (itemId) this.elCmpModal.querySelector(`[data-cmp="${itemId}"]`)?.click();
    }
  }

  _bindDock() {
    document.querySelectorAll('#wr-dock button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        this.cb.onMode(mode);
        this.setActiveMode(mode);
      });
    });
  }

  _bindMap() {
    document.getElementById('wr-map-close').addEventListener('click', () => this.toggleMap(false));
    this.elMapModal.addEventListener('click', (e) => {
      if (e.target === this.elMapModal) this.toggleMap(false);
    });
    this.elMapCanvas.addEventListener('click', (e) => {
      const rect = this.elMapCanvas.getBoundingClientRect();
      const px = (e.clientX - rect.left) * (this.elMapCanvas.width / rect.width);
      const py = (e.clientY - rect.top) * (this.elMapCanvas.height / rect.height);
      const specPt = this._mapPxToSpec(px, py);
      this.cb.onTeleport(specPt.x, -specPt.y);
      this.toggleMap(false);
    });
  }

  _bindTouch() {
    const base = document.getElementById('wr-joy-base');
    const knob = document.getElementById('wr-joy-knob');
    if (!base || !knob) return;
    let activeId = null;
    const maxR = 38;
    const updateJoy = (clientX, clientY) => {
      const r = base.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > maxR) { dx = (dx / d) * maxR; dy = (dy / d) * maxR; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.cb.onJoy(dx / maxR, -dy / maxR);
    };
    base.addEventListener('pointerdown', (e) => { e.stopPropagation(); activeId = e.pointerId; base.setPointerCapture(e.pointerId); updateJoy(e.clientX, e.clientY); });
    base.addEventListener('pointermove', (e) => { if (e.pointerId === activeId) { e.stopPropagation(); updateJoy(e.clientX, e.clientY); } });
    const endJoy = (e) => { if (e.pointerId === activeId) { activeId = null; knob.style.transform = 'translate(0px, 0px)'; this.cb.onJoy(0, 0); } };
    base.addEventListener('pointerup', endJoy);
    base.addEventListener('pointercancel', endJoy);
    document.getElementById('wr-touch-primary')?.addEventListener('click', () => this.cb.onTouchPrimary());
    document.getElementById('wr-touch-secondary')?.addEventListener('click', () => this.cb.onTouchSecondary());
  }

  openPanel(id) {
    this.closePanels();
    this.activePanel = id;
    const el = document.getElementById(`wr-panel-${id}`);
    if (el) el.hidden = false;
    document.querySelector(`[data-panel="${id}"]`)?.classList.add('active');
  }

  closePanels() {
    document.querySelectorAll('.wr-panel').forEach((p) => { p.hidden = true; });
    document.querySelectorAll('[data-panel]').forEach((b) => b.classList.remove('active'));
    this.activePanel = null;
  }

  toggleMap(force) {
    this.mapOpen = typeof force === 'boolean' ? force : !this.mapOpen;
    this.elMapModal.hidden = !this.mapOpen;
    if (this.mapOpen) {
      this.closePanels();
      this.toggleComparison(false);
    }
  }

  setActiveMode(mode) {
    document.querySelectorAll('#wr-dock button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    const hints = {
      walk: 'WASD 漫步 · Shift 奔跑 · 空格 跳跃 · 点击建筑查看溯源 · M 地图 · C 对照',
      bike: 'W/S 骑行刹车 · A/D 转向 · 空格 拨响铜铃 · Shift 加速 · M 地图 · C 对照',
      glide: 'A/D 压翼盘旋 · 空格/C 升降 · 飞入金色热流柱攀升 · M 地图',
    };
    if (this.elHint) this.elHint.textContent = hints[mode] || hints.walk;
    const tp = document.getElementById('wr-touch-primary');
    const ts = document.getElementById('wr-touch-secondary');
    if (tp && ts) {
      tp.textContent = mode === 'bike' ? '铜铃' : mode === 'glide' ? '爬升' : '跳跃';
      ts.textContent = mode === 'glide' ? '下降' : '切换';
    }
  }

  setActiveLens(lens) { document.querySelectorAll('[data-lens]').forEach((b) => b.classList.toggle('active', Number(b.dataset.lens) === lens)); }
  setActiveWeather(wx) { document.querySelectorAll('[data-wx]').forEach((b) => b.classList.toggle('active', b.dataset.wx === wx)); }
  setActiveQuality(q) { document.querySelectorAll('[data-quality]').forEach((b) => b.classList.toggle('active', b.dataset.quality === q)); }

  showProvenance(info) {
    if (!info) { this.elProv.hidden = true; return; }
    document.getElementById('wr-prov-title').textContent = info.name || info.haiz_name || '校园建筑';
    document.getElementById('wr-prov-en').textContent = info.en || info.haiz_district || '';
    document.getElementById('wr-prov-tag').textContent = `可信度：${info.tag || info.haiz_tag || 'estimated'}`;
    document.getElementById('wr-prov-story').textContent = info.story || '海南中学府城校区真实感重构节点。';
    document.getElementById('wr-prov-basis').textContent = `资料依据：${info.basis || info.haiz_basis || '公开地图轮廓与照片推断'}`;
    this.elProv.hidden = false;
  }

  showToast(name, role, text) {
    this.elToast.innerHTML = `<b>${name}</b><span style="opacity:.65;font-size:11px;margin-right:6px">${role}</span>${text}`;
    this.elToast.hidden = false;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { this.elToast.hidden = true; }, 4200);
  }

  updateClock(hour) {
    const sched = scheduleAtHour(hour);
    this.elClock.textContent = `${formatHour(hour)} · ${sched.label.split(' · ')[0]}`;
    const lbl = document.getElementById('wr-hour-label');
    if (lbl) lbl.textContent = `${formatHour(hour)} (${sched.label})`;
  }

  updateLocationWhisper(playerPos, mode, inThermal, nearPlace) {
    this.elWhisperLoc.textContent = nearPlace || '海南中学 · 府城校区 (R2)';
    if (mode === 'glide') {
      this.elWhisperSub.textContent = inThermal ? `乘风滑翔 · 高度 ${Math.round(playerPos.y)}m · 「${inThermal}」` : `乘风滑翔 · 高度 ${Math.round(playerPos.y)}m`;
    } else if (mode === 'bike') {
      this.elWhisperSub.textContent = '校园单车 · 按空格拨响铜铃';
    } else {
      this.elWhisperSub.textContent = '步履校园 · 点击建筑查看真实溯源';
    }
  }

  updateTelemetry(stats) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('wr-st-fps', `${stats.fps.toFixed(0)} FPS`);
    set('wr-st-ms', `${stats.frameMs.toFixed(1)} ms`);
    set('wr-st-calls', String(stats.calls));
    set('wr-st-tris', `${(stats.tris / 1000).toFixed(1)}k`);
    set('wr-st-dist', `${stats.loadedAssets}/${stats.totalAssets}`);
    set('wr-st-mem', `${stats.geometries} geo / ${stats.textures} tex`);
  }

  _mapSpecToPx(sx, sy) {
    const w = this.elMapCanvas.width, h = this.elMapCanvas.height;
    const x0 = -265, x1 = 248, y0 = -275, y1 = 148;
    const scale = Math.min((w - 36) / (x1 - x0), (h - 36) / (y1 - y0));
    const ox = (w - (x1 - x0) * scale) * 0.5;
    const oy = (h - (y1 - y0) * scale) * 0.5;
    return { x: ox + (sx - x0) * scale, y: oy + (y1 - sy) * scale, scale, ox, oy, x0, y1 };
  }

  _mapPxToSpec(px, py) {
    const m = this._mapSpecToPx(0, 0);
    return { x: m.x0 + (px - m.ox) / m.scale, y: m.y1 - (py - m.oy) / m.scale };
  }

  renderMap(playerPos, playerYaw, agents) {
    if (!this.mapOpen) return;
    const ctx = this.mapCtx;
    const w = this.elMapCanvas.width, h = this.elMapCanvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#efe9dc';
    ctx.fillRect(0, 0, w, h);

    const drawPoly = (poly, fill, stroke) => {
      if (!poly || poly.length < 3) return;
      ctx.beginPath();
      poly.forEach((p, i) => {
        const pt = this._mapSpecToPx(p[0], p[1]);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
    };

    ctx.lineWidth = 1.6;
    drawPoly(this.spec.school_boundary, '#dce6cf', '#6f8769');

    for (const sf of this.spec.sports_and_landuse) {
      if (sf.kind === 'stadium_track') drawPoly(sf.poly, '#d69986', '#9e4c3a');
      else if (sf.kind === 'football_pitch') drawPoly(sf.poly, '#9ec488', '#ffffff');
      else if (sf.kind === 'basketball_court') drawPoly(sf.poly, '#7eb09a', '#b85b48');
      else if (sf.kind === 'volleyball_court') drawPoly(sf.poly, '#cf9480', '#ffffff');
    }

    ctx.strokeStyle = '#c8c0b0';
    ctx.lineCap = 'round';
    for (const rd of this.spec.roads) {
      ctx.lineWidth = Math.max(2.5, rd.width * 0.65);
      ctx.beginPath();
      rd.pts.forEach((p, i) => {
        const pt = this._mapSpecToPx(p[0], p[1]);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
    }

    drawPoly(this.spec.yanchi.poly, '#4e8a7d', '#24524a');
    for (const cb of this.spec.context_buildings) drawPoly(cb.poly, 'rgba(160, 154, 140, 0.35)', null);

    ctx.lineWidth = 1;
    for (const b of this.spec.buildings) {
      let col = '#6f7c76';
      if (String(b.roof_style).includes('terracotta')) col = '#b84b36';
      else if (String(b.roof_style).includes('emerald')) col = '#1f6f54';
      else if (b.id === 'library') col = '#357996';
      drawPoly(b.poly, col, '#2b3630');
    }

    const tp = this._mapSpecToPx(38.91, 17.67);
    ctx.beginPath(); ctx.arc(tp.x, tp.y, 9, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(46, 118, 56, 0.65)'; ctx.fill();
    ctx.strokeStyle = '#1f4d26'; ctx.stroke();

    ctx.fillStyle = '#1f2b25';
    ctx.font = '600 11px -apple-system, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    for (const [txt, sx, sy] of [
      ['北门牌坊', 0, 114], ['一号楼 1923', 0, -10], ['百年榄仁', 42, 26],
      ['二号楼', -4, -50], ['科学馆', 6, -86], ['砚池', 50, -118],
      ['艺术中心', 14, -158], ['图书馆天文台', 98, 5], ['凤栖堂', -40, 82],
      ['运动场', -152, 76], ['体育馆', -154, -24], ['女生宿舍', -97, -104],
      ['第一食堂', 152, -138], ['南门', -66, -264],
    ]) {
      const pt = this._mapSpecToPx(sx, sy);
      ctx.fillText(txt, pt.x, pt.y);
    }

    for (const a of agents) {
      const pt = this._mapSpecToPx(a.x, -a.z);
      ctx.beginPath(); ctx.arc(pt.x, pt.y, a.kind === 'cat' ? 4.5 : 3.8, 0, Math.PI * 2);
      ctx.fillStyle = a.kind === 'cat' ? '#e07a24' : '#256099'; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke();
    }

    const pp = this._mapSpecToPx(playerPos.x, -playerPos.z);
    ctx.save(); ctx.translate(pp.x, pp.y); ctx.rotate(Math.PI - playerYaw);
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6); ctx.closePath();
    ctx.fillStyle = '#c9332b'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.restore();
  }
}
