/* ═══════════════════════════════════════════════════════════════════════
   篇章三 · 地理：《晨昏线与昼夜长短》
   Astronomy Model: Solar declination δ, hour angle cos ω₀ = -tanφ tanδ
   ═══════════════════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  const SOLAR_TERMS = [
    { name: '春分（3月21日）', day: 80 },
    { name: '立夏（5月6日）', day: 126 },
    { name: '夏至（6月21日）', day: 172 },
    { name: '秋分（9月23日）', day: 266 },
    { name: '立冬（11月7日）', day: 311 },
    { name: '冬至（12月22日）', day: 356 }
  ];

  const CITIES = [
    { name: '海口', lat: 20.0 },
    { name: '北京', lat: 39.9 },
    { name: '哈尔滨', lat: 45.8 },
    { name: '赤道', lat: 0.0 },
    { name: '北极圈', lat: 66.6 },
    { name: '悉尼', lat: -33.9 },
    { name: '南极点', lat: -90.0 }
  ];

  function calcDayNight(s) {
    const rad = Math.PI / 180;
    const decl = 23.44 * Math.sin(((2 * Math.PI) / 365) * (s.day - 80));
    const phi = s.lat;
    const tanProd = Math.tan(phi * rad) * Math.tan(decl * rad);
    let dayHours = 12;
    let regime = 'normal';
    if (-tanProd <= -1) {
      dayHours = 24;
      regime = 'polar-day';
    } else if (-tanProd >= 1) {
      dayHours = 0;
      regime = 'polar-night';
    } else {
      const w0 = Math.acos(-tanProd);
      dayHours = (24 / Math.PI) * w0;
    }
    const noonAlt = 90 - Math.abs(phi - decl);
    const sunrise = 12 - dayHours / 2;
    const sunset = 12 + dayHours / 2;
    return { decl, dayHours, nightHours: 24 - dayHours, regime, noonAlt, sunrise, sunset };
  }

  function fmtHM(hours) {
    const totalMin = Math.round(hours * 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h} 小时 ${m} 分`;
  }

  function fmtClock(hours) {
    const totalMin = Math.round(hours * 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function fmtLat(lat) {
    if (Math.abs(lat) < 0.05) return '0.0°（赤道）';
    return `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`;
  }

  const chapter = {
    id: 'daynight',
    kicker: '篇章三 · 地球运动与天文',
    title: '晨昏线与昼夜长短',
    lead: '当太阳直射点在南北回归线之间移动，晨昏线随之倾斜。拨动节气或拖动地球上的纬线，阅读昼夜如何消长。',

    defaultState: () => ({
      day: 172, // 夏至
      lat: 20.0, // 海口
      unfoldFormula: false
    }),

    summaryOf(state) {
      const d = calcDayNight(state);
      return `第${state.day}日 · ${fmtLat(state.lat)} → 昼长 ${d.dayHours.toFixed(1)}h`;
    },

    metricsOf(state) {
      const d = calcDayNight(state);
      return {
        太阳直射纬度: fmtLat(d.decl),
        观测纬度: fmtLat(state.lat),
        昼长: d.regime === 'polar-day' ? '24h（极昼）' : d.regime === 'polar-night' ? '0h（极夜）' : fmtHM(d.dayHours),
        正午太阳高度: d.noonAlt > 0 ? d.noonAlt.toFixed(1) + '°' : '终日不见太阳'
      };
    },

    boundsHtml() {
      return `
        <p><b>球面近似</b>：将地球视为正球体，黄赤交角取 <code>23.44°</code>，忽略大气折射与太阳视半径（实际昼长比几何值多约 6–8 分钟）。</p>
        <p><b>时间基准</b>：日出日落时刻为当地地方时（太阳到达正南/正北时为 12:00）。</p>
      `;
    },

    render(J, state) {
      const d = calcDayNight(state);

      // Find nearest solar term index
      let termIdx = SOLAR_TERMS.findIndex((t) => Math.abs(t.day - state.day) <= 3);
      if (termIdx < 0) termIdx = 0;

      const tTerm = J.choice('dn-term', {
        name: '节气',
        opts: SOLAR_TERMS.map((t) => t.name),
        get: () => termIdx,
        set: (i) => { state.day = SOLAR_TERMS[i].day; }
      });

      const tDay = J.num('dn-day', {
        name: '年中第几日',
        min: 1,
        max: 365,
        step: 1,
        unit: ' 日',
        get: () => state.day,
        set: (v) => { state.day = v; }
      });

      const nearestCity = CITIES.findIndex((c) => Math.abs(c.lat - state.lat) < 0.3);
      const tCity = J.choice('dn-city', {
        name: '代表地点',
        opts: CITIES.map((c) => c.name),
        notes: CITIES.map((c) => fmtLat(c.lat)),
        get: () => (nearestCity >= 0 ? nearestCity : 0),
        set: (i) => { state.lat = CITIES[i].lat; }
      });

      const tLat = J.num('dn-lat', {
        name: '观测纬度',
        min: -90,
        max: 90,
        step: 1,
        unit: '°',
        get: () => Number(state.lat.toFixed(1)),
        set: (v) => { state.lat = v; },
        fmt: (v) => `${Math.abs(v).toFixed(1)}${v > 0.05 ? 'N' : v < -0.05 ? 'S' : ''}`
      });

      const tUnfold = J.unfold('dn-unfold', {
        label: state.unfoldFormula ? '收起球面三角公式' : '展开昼长与太阳高度公式',
        expanded: () => state.unfoldFormula,
        toggle: () => { state.unfoldFormula = !state.unfoldFormula; }
      });

      // Direction text
      let dirTxt = '正东升起、正西落下';
      if (d.decl > 0.3) dirTxt = '东北升起、西北落下';
      else if (d.decl < -0.3) dirTxt = '东南升起、西南落下';

      // Structural prose rewriting
      let prose = '';
      if (d.regime === 'polar-day') {
        prose = `<p class="jing prose rewritten">在年中第 ${tDay} 日（接近 ${tTerm}），太阳直射 ${fmtLat(d.decl)}。位于 ${tLat}（参考：${tCity}）的观测者进入了${J.dep('dn-res', { label: '极昼：太阳整日不落，昼长 24 小时', sources: ['dn-day', 'dn-lat'] })}，正午太阳高度为 <code>${d.noonAlt.toFixed(1)}°</code>，子夜时分太阳仍悬在地平线之上。</p>`;
      } else if (d.regime === 'polar-night') {
        prose = `<p class="jing prose rewritten">在年中第 ${tDay} 日（接近 ${tTerm}），太阳直射 ${fmtLat(d.decl)}。位于 ${tLat}（参考：${tCity}）的观测者处于${J.dep('dn-res', { label: '极夜：整日处于夜半球，昼长 0 小时', sources: ['dn-day', 'dn-lat'] })}，晨昏线完全越过该纬线之外。</p>`;
      } else {
        const eqNote = Math.abs(state.lat) < 0.1
          ? '由于地处赤道，晨昏线始终将赤道平分，全年昼夜等长。'
          : `太阳从${dirTxt}，地方时 <code>${fmtClock(d.sunrise)}</code> 日出、<code>${fmtClock(d.sunset)}</code> 日落。`;
        prose = `<p class="jing prose">在年中第 ${tDay} 日（接近 ${tTerm}），太阳直射 ${fmtLat(d.decl)}。对于 ${tLat}（参考：${tCity}）而言，${J.dep('dn-res', { label: `白昼长 ${fmtHM(d.dayHours)}，黑夜长 ${fmtHM(d.nightHours)}`, sources: ['dn-day', 'dn-lat'] })}，正午太阳高度达到 <code>${d.noonAlt.toFixed(1)}°</code>。${eqNote}</p>`;
      }

      const formulaShu = state.unfoldFormula
        ? `<div class="shu indigo">
             <div class="shu-head"><span>展开的疏 · 晨昏线几何与昼长公式</span></div>
             <p class="shu-note">日出时半昼弧角 <code>ω₀</code> 满足 <code>cos ω₀ = −tan φ · tan δ</code>。其中 <code>φ = ${state.lat.toFixed(1)}°</code>，<code>δ = ${d.decl.toFixed(2)}°</code>。当 <code>|−tan φ · tan δ| ≥ 1</code> 时，方程无解，对应极昼或极夜。正午太阳高度角为 <code>H = 90° − |φ − δ|</code>。</p>
           </div>`
        : '';

      return `
        ${prose}

        <div class="figure-stage">
          <svg id="dn-svg" class="figure-svg" viewBox="-230 -145 460 290" role="img" aria-label="地球昼夜半球与晨昏线示意图，可上下拖动纬线">
            <defs>
              <clipPath id="earth-clip"><circle cx="0" cy="0" r="105" /></clipPath>
            </defs>
            <!-- Sunlight arrows from right -->
            <g stroke="var(--zhu)" stroke-width="1.4" opacity="0.75">
              <line x1="150" y1="-55" x2="118" y2="-55" />
              <line x1="150" y1="0" x2="118" y2="0" />
              <line x1="150" y1="55" x2="118" y2="55" />
            </g>
            <text x="156" y="4" fill="var(--zhu)" font-family="var(--sans)" font-size="12">太阳光</text>

            <!-- Earth sphere -->
            <circle cx="0" cy="0" r="105" fill="var(--paper-2)" stroke="var(--ink)" stroke-width="1.6" />
            <g clip-path="url(#earth-clip)">
              <!-- Night hemisphere polygon -->
              <polygon id="dn-night" fill="var(--ink)" opacity="0.16" />
              <!-- Equator -->
              <line x1="-110" y1="0" x2="110" y2="0" stroke="var(--ink-3)" stroke-width="1" stroke-dasharray="3 3" />
              <!-- Observer latitude line -->
              <line id="dn-lat-line" x1="-110" y1="0" x2="110" y2="0" stroke="var(--indigo)" stroke-width="2.2" />
              <line id="dn-lat-day" x1="0" y1="0" x2="0" y2="0" stroke="var(--zhu)" stroke-width="3.5" />
              <!-- Terminator -->
              <line id="dn-term-line" x1="0" y1="-120" x2="0" y2="120" stroke="var(--zhu)" stroke-width="1.6" stroke-dasharray="5 3" />
            </g>
            <!-- Drag handle on latitude -->
            <g id="dn-lat-handle" style="cursor:ns-resize">
              <circle cx="-116" cy="0" r="7" fill="var(--indigo)" stroke="var(--paper-elev)" stroke-width="2" />
              <circle cx="-116" cy="0" r="18" fill="transparent" />
            </g>
            <text x="0" y="-118" text-anchor="middle" fill="var(--ink-3)" font-family="var(--sans)" font-size="11">N 北极</text>
            <text x="0" y="128" text-anchor="middle" fill="var(--ink-3)" font-family="var(--sans)" font-size="11">S 南极</text>
            <text id="dn-svg-note" x="-215" y="132" fill="var(--ink-2)" font-family="var(--sans)" font-size="12"></text>
          </svg>
          <div class="figure-caption">
            <span>上下拖动左侧矿蓝纬线点：实时改变观测纬度 φ（朱色粗段为昼弧）</span>
            <span>${tUnfold}</span>
          </div>
        </div>

        ${formulaShu}
      `;
    },

    afterRender(J, state, rerender) {
      const svg = document.getElementById('dn-svg');
      const nightPoly = document.getElementById('dn-night');
      const termLine = document.getElementById('dn-term-line');
      const latLine = document.getElementById('dn-lat-line');
      const latDay = document.getElementById('dn-lat-day');
      const handle = document.getElementById('dn-lat-handle');
      const note = document.getElementById('dn-svg-note');
      if (!svg || !nightPoly) return;

      const R = 105;
      const d = calcDayNight(state);
      const rad = Math.PI / 180;
      const declRad = d.decl * rad;

      // In equatorial frame, sunlight comes from angle +decl above equator on the right.
      // Terminator is perpendicular to sun direction: angle from vertical is +decl.
      // Top of terminator (night on left): (-R*sin(decl), -R*cos(decl))?
      // Wait: if decl > 0 (Northern Summer), North Pole is sunlit, so top of terminator tilts LEFT (into night side).
      // Indeed, sun vector s = (cos(decl), -sin(decl)) in SVG (y down).
      // Points with p · s < 0 are night! Boundary p · s = 0 => x cos(decl) - y sin(decl) = 0 => x = y tan(decl).
      const tx1 = -120 * Math.tan(declRad);
      const ty1 = -120;
      const tx2 = 120 * Math.tan(declRad);
      const ty2 = 120;
      termLine.setAttribute('x1', tx1.toFixed(1));
      termLine.setAttribute('y1', ty1);
      termLine.setAttribute('x2', tx2.toFixed(1));
      termLine.setAttribute('y2', ty2);

      nightPoly.setAttribute('points', `${tx1.toFixed(1)},-120 -130,-120 -130,120 ${tx2.toFixed(1)},120`);

      const ly = -R * Math.sin(state.lat * rad);
      const halfChord = R * Math.cos(state.lat * rad);
      latLine.setAttribute('y1', ly.toFixed(1));
      latLine.setAttribute('y2', ly.toFixed(1));
      handle.setAttribute('transform', `translate(0, ${ly.toFixed(1)})`);

      // Sunlit segment on latitude line: x from max(-halfChord, ly * tan(decl)) to +halfChord
      const xTerm = ly * Math.tan(declRad);
      const xStart = Math.max(-halfChord, Math.min(halfChord, xTerm));
      latDay.setAttribute('y1', ly.toFixed(1));
      latDay.setAttribute('y2', ly.toFixed(1));
      latDay.setAttribute('x1', xStart.toFixed(1));
      latDay.setAttribute('x2', halfChord.toFixed(1));

      note.textContent = `直射 ${fmtLat(d.decl)} · 昼弧 ${(d.dayHours / 24 * 100).toFixed(0)}%`;

      let dragging = false;
      const onMove = (e) => {
        if (!dragging) return;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
        const clampedY = Math.max(-R, Math.min(R, loc.y));
        const newLat = Math.round((Math.asin(-clampedY / R) * 180) / Math.PI);
        state.lat = newLat;
        const nly = -R * Math.sin(newLat * rad);
        latLine.setAttribute('y1', nly.toFixed(1));
        latLine.setAttribute('y2', nly.toFixed(1));
        handle.setAttribute('transform', `translate(0, ${nly.toFixed(1)})`);
      };

      handle.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        dragging = true;
        handle.setPointerCapture?.(e.pointerId);
      });
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener(
        'pointerup',
        () => {
          if (dragging) {
            dragging = false;
            rerender();
          }
        },
        { once: true }
      );
    }
  };

  global.JudouChapters = global.JudouChapters || {};
  global.JudouChapters.daynight = chapter;
})(window);
