// HAIZ World Engine — In-World Interactive Scientific Simulation Station Drawer
//
// Connects the 3D campus directly to real numerical models (world-engine/science/kernel.js):
//   1. 科学馆 · 非线性阻尼单摆 (RK4 ODE + Haikou Somigliana gravity g = 9.7864 m/s² + error propagation)
//   2. 砚池 · 光的折射与菲涅耳反射 (live WorldClock sun altitude coupling + Snell/Fresnel + Brewster angle)
//   3. 榄仁树微气候 · 表面蒸发与路面湿润动力学 (live WorldClock rain/solar/wind/VPD water budget)

import {
  MODEL_META,
  createPendulumSim,
  fresnelOptics,
  microclimateStep,
  sampleStats,
} from '../science/kernel.js';

export function createScienceDrawer({ rootEl, getClimateSnapshot, onRecordTrial, onClose }) {
  if (!rootEl) return { open() {}, close() {}, tick() {}, isOpen: false };

  const tabsEl = rootEl.querySelector('#we-sci-tabs');
  const bodyEl = rootEl.querySelector('#we-sci-body');
  const metaEl = rootEl.querySelector('#we-sci-meta');

  let openState = false;
  let activeStation = 'pendulum';
  const pendSim = createPendulumSim({ length: 1.2, angleDeg: 42, damping: 0.04 });
  const pendTrials = [];
  const opticsState = { followSun: true, incidentDeg: 45, pair: 'air-water' };
  const microState = { rainMmHr: 12, solarWm2: 520, windMs: 3.2, tempC: 28, rhPct: 76, followWorld: true };

  const OPTICS_PAIRS = {
    'air-water': { label: '空气 → 砚池淡水', n1: 1.0003, n2: 1.333 },
    'air-glass': { label: '空气 → 冕牌玻璃', n1: 1.0003, n2: 1.517 },
    'water-air': { label: '淡水 → 空气（可观测全反射）', n1: 1.333, n2: 1.0003 },
  };

  function renderMeta() {
    const m = MODEL_META[activeStation];
    if (!metaEl || !m) return;
    metaEl.innerHTML = `
      <div class="we-sci-eq"><span>控制方程</span><code>${m.equation}</code></div>
      <p><b>适用范围：</b>${m.scope}</p>
      <p><b>简化条件：</b>${m.simplifications}</p>
      <p><b>精度说明：</b>${m.accuracy}</p>
    `;
  }

  function renderTabs() {
    if (!tabsEl) return;
    const list = [
      ['pendulum', '科学馆 · RK4 单摆'],
      ['optics', '砚池 · 菲涅耳光学'],
      ['microclimate', '榄仁树 · 微气候水膜'],
    ];
    tabsEl.innerHTML = list
      .map(([id, label]) => `<button type="button" class="we-chip ${id === activeStation ? 'is-active' : ''}" data-sci-tab="${id}">${label}</button>`)
      .join('');
    tabsEl.querySelectorAll('[data-sci-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeStation = btn.dataset.sciTab;
        buildStationDom();
      });
    });
  }

  function buildStationDom() {
    renderTabs();
    renderMeta();
    if (!bodyEl) return;

    if (activeStation === 'pendulum') {
      bodyEl.innerHTML = `
        <div class="we-sci-grid">
          <canvas id="we-sci-canvas" width="520" height="240" aria-label="单摆与相空间实时图像"></canvas>
          <div class="we-sci-controls">
            <label>摆长 L：<b id="we-p-l-val">${pendSim.params.length.toFixed(2)} m</b>
              <input id="we-p-l" type="range" min="0.4" max="3.0" step="0.05" value="${pendSim.params.length}">
            </label>
            <label>初始摆角 θ₀：<b id="we-p-a-val">${pendSim.params.angleDeg}°</b>
              <input id="we-p-a" type="range" min="5" max="140" step="1" value="${pendSim.params.angleDeg}">
            </label>
            <label>粘滞阻尼 γ：<b id="we-p-g-val">${pendSim.params.damping.toFixed(2)} s⁻¹</b>
              <input id="we-p-g" type="range" min="0" max="0.30" step="0.01" value="${pendSim.params.damping}">
            </label>
            <div class="we-sci-readout" id="we-p-readout"></div>
            <div class="we-sci-btnrow">
              <button type="button" class="we-btn we-btn-primary" id="we-p-sample">记录一次测时（±15 ms 误差）</button>
              <button type="button" class="we-btn" id="we-p-reset">重新释放</button>
              <button type="button" class="we-btn" id="we-p-csv">导出 CSV</button>
            </div>
            <div class="we-sci-log" id="we-p-log"></div>
          </div>
        </div>
      `;
      const onChange = () => {
        const l = Number(bodyEl.querySelector('#we-p-l').value);
        const a = Number(bodyEl.querySelector('#we-p-a').value);
        const g = Number(bodyEl.querySelector('#we-p-g').value);
        bodyEl.querySelector('#we-p-l-val').textContent = `${l.toFixed(2)} m`;
        bodyEl.querySelector('#we-p-a-val').textContent = `${a}°`;
        bodyEl.querySelector('#we-p-g-val').textContent = `${g.toFixed(2)} s⁻¹`;
        pendSim.reset({ length: l, angleDeg: a, damping: g });
      };
      bodyEl.querySelectorAll('input').forEach((el) => el.addEventListener('input', onChange));
      bodyEl.querySelector('#we-p-reset')?.addEventListener('click', onChange);
      bodyEl.querySelector('#we-p-sample')?.addEventListener('click', () => {
        const rec = pendSim.sampleWithStopwatchNoise({ sigmaSec: 0.015 });
        pendTrials.unshift(rec);
        onRecordTrial?.({ station: 'pendulum', ...rec });
        renderPendulumLog();
      });
      bodyEl.querySelector('#we-p-csv')?.addEventListener('click', exportPendulumCsv);
      renderPendulumLog();
    } else if (activeStation === 'optics') {
      bodyEl.innerHTML = `
        <div class="we-sci-grid">
          <canvas id="we-sci-canvas" width="520" height="240" aria-label="砚池界面折射与菲涅耳反射曲线"></canvas>
          <div class="we-sci-controls">
            <label class="we-check">
              <input id="we-o-sun" type="checkbox" ${opticsState.followSun ? 'checked' : ''}>
              耦合世界时钟实时太阳入射角（从当前海口太阳高度角换算）
            </label>
            <label>介质界面：
              <select id="we-o-pair">
                ${Object.entries(OPTICS_PAIRS).map(([k, v]) => `<option value="${k}" ${k === opticsState.pair ? 'selected' : ''}>${v.label}</option>`).join('')}
              </select>
            </label>
            <label>入射角 θᵢ：<b id="we-o-ang-val">${opticsState.incidentDeg.toFixed(1)}°</b>
              <input id="we-o-ang" type="range" min="0" max="89" step="0.5" value="${opticsState.incidentDeg}">
            </label>
            <div class="we-sci-readout" id="we-o-readout"></div>
          </div>
        </div>
      `;
      bodyEl.querySelector('#we-o-sun')?.addEventListener('change', (e) => {
        opticsState.followSun = e.target.checked;
        drawStation();
      });
      bodyEl.querySelector('#we-o-pair')?.addEventListener('change', (e) => {
        opticsState.pair = e.target.value;
        drawStation();
      });
      bodyEl.querySelector('#we-o-ang')?.addEventListener('input', (e) => {
        opticsState.followSun = false;
        const sunChk = bodyEl.querySelector('#we-o-sun');
        if (sunChk) sunChk.checked = false;
        opticsState.incidentDeg = Number(e.target.value);
        drawStation();
      });
    } else {
      bodyEl.innerHTML = `
        <div class="we-sci-grid">
          <canvas id="we-sci-canvas" width="520" height="240" aria-label="12小时路面湿润与积水演化曲线"></canvas>
          <div class="we-sci-controls">
            <label class="we-check">
              <input id="we-m-world" type="checkbox" ${microState.followWorld ? 'checked' : ''}>
              同步读取当前世界时钟气象参数
            </label>
            <label>初始阵雨强度：<b id="we-m-rain-val">${microState.rainMmHr} mm/h</b>
              <input id="we-m-rain" type="range" min="0" max="45" step="1" value="${microState.rainMmHr}">
            </label>
            <label>太阳短波辐射：<b id="we-m-rad-val">${microState.solarWm2} W/m²</b>
              <input id="we-m-rad" type="range" min="0" max="950" step="20" value="${microState.solarWm2}">
            </label>
            <label>校园风速：<b id="we-m-wind-val">${microState.windMs.toFixed(1)} m/s</b>
              <input id="we-m-wind" type="range" min="0.2" max="22" step="0.2" value="${microState.windMs}">
            </label>
            <div class="we-sci-readout" id="we-m-readout"></div>
          </div>
        </div>
      `;
      bodyEl.querySelector('#we-m-world')?.addEventListener('change', (e) => {
        microState.followWorld = e.target.checked;
        drawStation();
      });
      for (const [id, key, unit, fixed] of [
        ['#we-m-rain', 'rainMmHr', ' mm/h', 0],
        ['#we-m-rad', 'solarWm2', ' W/m²', 0],
        ['#we-m-wind', 'windMs', ' m/s', 1],
      ]) {
        bodyEl.querySelector(id)?.addEventListener('input', (e) => {
          microState.followWorld = false;
          const chk = bodyEl.querySelector('#we-m-world');
          if (chk) chk.checked = false;
          microState[key] = Number(e.target.value);
          bodyEl.querySelector(`${id}-val`).textContent = `${microState[key].toFixed(fixed)}${unit}`;
          drawStation();
        });
      }
    }

    drawStation();
  }

  function renderPendulumLog() {
    const logEl = bodyEl?.querySelector('#we-p-log');
    if (!logEl) return;
    if (!pendTrials.length) {
      logEl.innerHTML = '<p class="we-muted">尚未记录测时样本。点击「记录一次测时」采集含仪器噪声的数据以计算标准误。</p>';
      return;
    }
    const statsT = sampleStats(pendTrials.map((r) => r.observedPeriodSec));
    const statsG = sampleStats(pendTrials.map((r) => r.inferredG));
    logEl.innerHTML = `
      <p><b>样本统计 (n=${statsT.n})：</b>T̄ = ${statsT.mean.toFixed(4)} ± ${statsT.se.toFixed(4)} s；推算 g = ${statsG.mean.toFixed(3)} ± ${statsG.se.toFixed(3)} m/s²（海口理论值 ${pendTrials[0].trueG} m/s²）</p>
      <ul>${pendTrials.slice(0, 4).map((r, i) => `<li>#${pendTrials.length - i} · L=${r.length}m, θ₀=${r.angleDeg}° → T=${r.observedPeriodSec}s (g≈${r.inferredG})</li>`).join('')}</ul>
    `;
  }

  function exportPendulumCsv() {
    if (!pendTrials.length) return;
    const header = 'length_m,angle_deg,true_T_s,observed_T_s,inferred_g_ms2,haikou_true_g_ms2\n';
    const rows = pendTrials.map((r) => `${r.length},${r.angleDeg},${r.truePeriodSec},${r.observedPeriodSec},${r.inferredG},${r.trueG}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'haiz-pendulum-rk4-trials.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function drawStation() {
    if (!openState) return;
    const canvas = bodyEl?.querySelector('#we-sci-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = '#faf7f0';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(31,58,48,0.16)';
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

    if (activeStation === 'pendulum') {
      const s = pendSim.snapshot();
      // Left: physical pendulum bob
      const px = 118, py = 36, lenPx = Math.min(155, 52 + s.params.length * 42);
      const bx = px + Math.sin(s.thetaRad) * lenPx;
      const by = py + Math.cos(s.thetaRad) * lenPx;
      ctx.strokeStyle = 'rgba(31,58,48,0.22)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, py + lenPx + 14);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = '#1f3a30';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.fillStyle = '#a8482c';
      ctx.beginPath();
      ctx.arc(bx, by, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1f3a30';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText(`海口实测纬度重力 g = ${s.params.g.toFixed(4)} m/s²`, 14, H - 14);

      // Right: phase-space (theta, omega) orbit
      const cx = 375, cy = 122;
      ctx.strokeStyle = 'rgba(31,58,48,0.2)';
      ctx.beginPath();
      ctx.moveTo(255, cy);
      ctx.lineTo(495, cy);
      ctx.moveTo(cx, 24);
      ctx.lineTo(cx, 220);
      ctx.stroke();
      ctx.fillStyle = '#1f3a30';
      ctx.fillText('相空间轨迹 (θ, ω)', 258, 22);
      if (s.phaseHistory.length > 1) {
        ctx.strokeStyle = '#2a4a3c';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        s.phaseHistory.forEach(([th, om], i) => {
          const x = cx + th * 42;
          const y = cy - om * 22;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
      const ro = bodyEl.querySelector('#we-p-readout');
      if (ro) {
        ro.innerHTML = `
          <span>实时摆角：<b>${s.thetaDeg}°</b></span>
          <span>小角近似 T₀：<b>${s.tSmall} s</b></span>
          <span>精确椭圆周期：<b>${s.tExact} s</b>（+${((s.largeAngleRatio - 1) * 100).toFixed(2)}%）</span>
          <span>RK4 测得周期：<b>${s.measuredPeriod ? `${s.measuredPeriod} s` : '等待过零…'}</b></span>
          <span>总机械能：<b>${s.energy.total.toFixed(4)} J/kg</b></span>
        `;
      }
    } else if (activeStation === 'optics') {
      const snap = getClimateSnapshot?.();
      if (opticsState.followSun && snap?.sun) {
        const sunAlt = Math.max(1, snap.sun.alt);
        opticsState.incidentDeg = Math.max(0.5, Math.min(89, 90 - sunAlt));
        const slider = bodyEl.querySelector('#we-o-ang');
        if (slider) slider.value = opticsState.incidentDeg.toFixed(1);
      }
      const angLabel = bodyEl.querySelector('#we-o-ang-val');
      if (angLabel) angLabel.textContent = `${opticsState.incidentDeg.toFixed(1)}°`;
      const pair = OPTICS_PAIRS[opticsState.pair];
      const res = fresnelOptics({ n1: pair.n1, n2: pair.n2, incidentDeg: opticsState.incidentDeg });

      // Left: Ray interface diagram
      const ox = 128, oy = 124;
      ctx.fillStyle = 'rgba(108, 152, 158, 0.22)';
      ctx.fillRect(10, oy, 236, H - oy - 10);
      ctx.strokeStyle = '#1f3a30';
      ctx.beginPath();
      ctx.moveTo(10, oy);
      ctx.lineTo(246, oy);
      ctx.stroke();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(31,58,48,0.35)';
      ctx.beginPath();
      ctx.moveTo(ox, 16);
      ctx.lineTo(ox, H - 16);
      ctx.stroke();
      ctx.setLineDash([]);

      const ti = (res.incidentDeg * Math.PI) / 180;
      const rLen = 96;
      // Incident ray
      ctx.strokeStyle = '#a8482c';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(ox - Math.sin(ti) * rLen, oy - Math.cos(ti) * rLen);
      ctx.lineTo(ox, oy);
      ctx.stroke();
      // Reflected ray (alpha scaled by reflectance R)
      ctx.strokeStyle = `rgba(168, 72, 44, ${Math.max(0.18, res.R)})`;
      ctx.lineWidth = 1.5 + res.R * 2.2;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.sin(ti) * rLen, oy - Math.cos(ti) * rLen);
      ctx.stroke();
      // Refracted ray
      if (!res.totalInternalReflection) {
        const tt = (res.refractedDeg * Math.PI) / 180;
        ctx.strokeStyle = `rgba(42, 74, 60, ${Math.max(0.18, res.T)})`;
        ctx.lineWidth = 1.5 + res.T * 2.2;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + Math.sin(tt) * rLen, oy + Math.cos(tt) * rLen);
        ctx.stroke();
      }

      // Right: Fresnel reflectance curve Rs, Rp, R vs angle 0..90
      const gx = 276, gy = 28, gw = 224, gh = 178;
      ctx.strokeStyle = 'rgba(31,58,48,0.28)';
      ctx.strokeRect(gx, gy, gw, gh);
      const plot = (key, color, width) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        for (let deg = 0; deg <= 89; deg += 1) {
          const r = fresnelOptics({ n1: pair.n1, n2: pair.n2, incidentDeg: deg });
          const x = gx + (deg / 90) * gw;
          const y = gy + gh * (1 - r[key]);
          if (deg === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };
      plot('Rs', 'rgba(42, 74, 60, 0.55)', 1.3);
      plot('Rp', 'rgba(143, 106, 31, 0.7)', 1.3);
      plot('R', '#a8482c', 2.2);
      // Current angle marker
      const mx = gx + (res.incidentDeg / 90) * gw;
      ctx.strokeStyle = '#1f3a30';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(mx, gy);
      ctx.lineTo(mx, gy + gh);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#1f3a30';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(`菲涅耳反射率 R(θᵢ) · 布儒斯特角 ${res.brewsterDeg}°`, gx, 20);

      const ro = bodyEl.querySelector('#we-o-readout');
      if (ro) {
        ro.innerHTML = `
          <span>折射角 θₜ：<b>${res.totalInternalReflection ? '全内反射' : `${res.refractedDeg}°`}</b></span>
          <span>自然光反射率 R：<b>${(res.R * 100).toFixed(2)}%</b></span>
          <span>透射率 T：<b>${(res.T * 100).toFixed(2)}%</b></span>
          <span>Rₛ / Rₚ：<b>${(res.Rs * 100).toFixed(1)}% / ${(res.Rp * 100).toFixed(1)}%</b></span>
          <span>布儒斯特角 θ_B：<b>${res.brewsterDeg}°</b>${res.criticalDeg ? ` · 临界角 ${res.criticalDeg}°` : ''}</span>
        `;
      }
    } else {
      const snap = getClimateSnapshot?.();
      if (microState.followWorld && snap?.raw) {
        microState.rainMmHr = Math.max(0, +(snap.raw.rain ?? 0).toFixed(1));
        microState.solarWm2 = Math.round(snap.raw.rad ?? 350);
        microState.windMs = +(snap.raw.wind ?? 2.5).toFixed(1);
        microState.tempC = +(snap.raw.temp ?? 27).toFixed(1);
        microState.rhPct = Math.round(snap.raw.rh ?? 75);
      }

      // Simulate 12-hour pulse (2h rain followed by 10h drying under current solar/wind)
      let wet = 0.08, puddle = 0;
      const wetPts = [], pudPts = [];
      let lastRes = null;
      for (let hr = 0; hr <= 12; hr += 0.25) {
        const rainNow = hr < 2 ? Math.max(microState.rainMmHr, 4) : 0;
        const radNow = hr < 2 ? microState.solarWm2 * 0.25 : microState.solarWm2;
        lastRes = microclimateStep({
          rainMmHr: rainNow,
          solarWm2: radNow,
          windMs: microState.windMs,
          tempC: microState.tempC,
          rhPct: microState.rhPct,
          wet,
          puddle,
          dtSec: 900,
        });
        wet = lastRes.wet;
        puddle = lastRes.puddle;
        wetPts.push([hr, wet]);
        pudPts.push([hr, puddle]);
      }

      const gx = 44, gy = 30, gw = W - 64, gh = H - 64;
      ctx.strokeStyle = 'rgba(31,58,48,0.22)';
      ctx.strokeRect(gx, gy, gw, gh);
      // Rain window highlight (0..2h)
      ctx.fillStyle = 'rgba(108, 152, 158, 0.16)';
      ctx.fillRect(gx, gy, (2 / 12) * gw, gh);

      const drawSeries = (pts, color, width) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        pts.forEach(([h, v], i) => {
          const x = gx + (h / 12) * gw;
          const y = gy + gh * (1 - v);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      };
      drawSeries(wetPts, '#2a4a3c', 2.2);
      drawSeries(pudPts, '#a8482c', 2.0);
      ctx.fillStyle = '#1f3a30';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText('2 小时阵雨后 10 小时地面蒸发演化（绿：湿润度 wet · 红：积水 puddle）', gx, 20);
      ctx.fillText('0 h', gx, H - 14);
      ctx.fillText('6 h', gx + gw * 0.5 - 8, H - 14);
      ctx.fillText('12 h', gx + gw - 24, H - 14);

      const ro = bodyEl.querySelector('#we-m-readout');
      if (ro && lastRes) {
        ro.innerHTML = `
          <span>气温 / 湿度：<b>${microState.tempC.toFixed(1)}°C / ${microState.rhPct}%</b></span>
          <span>饱和水汽压差 VPD：<b>${lastRes.vpdKpa} kPa</b></span>
          <span>潜在蒸发速率：<b>${lastRes.evapMmHr} mm/h</b></span>
          <span>12h 后残留湿润：<b>${(wet * 100).toFixed(0)}%</b></span>
        `;
      }
    }
  }

  rootEl.querySelector('[data-sci-close]')?.addEventListener('click', () => close());

  function open(stationId = activeStation) {
    if (MODEL_META[stationId]) activeStation = stationId;
    openState = true;
    rootEl.hidden = false;
    buildStationDom();
  }

  function close() {
    if (!openState) return;
    openState = false;
    rootEl.hidden = true;
    onClose?.();
  }

  function tick(dt) {
    if (!openState) return;
    if (activeStation === 'pendulum') {
      pendSim.step(dt);
    }
    drawStation();
  }

  return {
    open,
    close,
    tick,
    get isOpen() { return openState; },
    get activeStation() { return activeStation; },
  };
}
