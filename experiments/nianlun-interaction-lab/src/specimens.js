/**
 * NIANLUN Interaction Lab — Shared Living Specimens & Multi-Object Coupling Engine
 *
 * All 4 interaction experiments operate on these exact same 5 real, manipulable
 * information objects so users can directly compare how different interaction
 * laws transform the same underlying reality.
 */

// ─── Real HAIZ Fucheng Campus Landmarks (from HAIZ data/buildings.json origin) ───
export const CAMPUS_LANDMARKS = [
  { id: 'tree',    name: '榄仁树',   en: 'Almond Tree',  dist: 0,   bearing: 0,   note: '校园时空原点 · 坐标 (0, 0)' },
  { id: 'yanchi',  name: '砚池',     en: 'Ink Pond',     dist: 58,  bearing: 32,  note: '东北侧水景，倒映晨光' },
  { id: 'bldg1',   name: '一号教学楼', en: 'Teaching 1',   dist: 95,  bearing: 178, note: '主轴中线 · 高 19m' },
  { id: 'library', name: '图书馆',   en: 'Library',      dist: 142, bearing: 245, note: '西侧静读区 · 藏书与自习' },
  { id: 'stone',   name: '太湖石',   en: 'Taihu Stone',  dist: 76,  bearing: 356, note: '北门中轴校验点' },
  { id: 'art',     name: '艺术中心', en: 'Art Center',   dist: 168, bearing: 118, note: '东南隅 · 高 8m 展演空间' },
];

// ─── Real Growth-Ring / Historical Markers (1940–2026) ───
export const CAMBIUM_EVENTS = [
  { year: 1940, rain: 1680, tag: '气象档案起点',   note: 'HAIZ 历史天气年轮记录的首个完整年份' },
  { year: 1958, rain: 1420, tag: '旱年窄轮',      note: '降水偏低，生长轮呈现紧致纹理' },
  { year: 1969, rain: 1890, tag: '阿波罗 11 号',   note: '人类首次登月 · 远眺地月轨道的夏天' },
  { year: 1988, rain: 2050, tag: '海南建省',      note: '岛屿记忆进入新纪元，台风与湿润季风并存' },
  { year: 2000, rain: 1760, tag: '世纪月全食',    note: '2000-01-21 满月校验点' },
  { year: 2014, rain: 2380, tag: '超强台风威马逊', note: '2014-07-18 单日暴雨 211mm，年轮留下深痕' },
  { year: 2024, rain: 1920, tag: '北美日全食',    note: '2024-04-08 朔月天文校验点' },
  { year: 2026, rain: 1840, tag: '年轮交互实验场', note: '此刻 · 从圆形看板走向流体交互空间' },
];

// ─── Pentatonic Acoustic Scales (Web Audio, muted until user interacts) ───
export const SCALES = [
  { name: '宫调 · 清越', freqs: [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25] },
  { name: '羽调 · 沉静', freqs: [220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33] },
  { name: '微光 · 泛音', freqs: [293.66, 329.63, 440.00, 493.88, 587.33, 659.25, 880.00, 987.77] },
];

export const SPECIMENS = [
  {
    id: 'pulse',
    name: '节律',
    en: 'Pulse',
    glyph: '◎',
    color: '#C24B36',
    soft: 'rgba(194, 75, 54, 0.14)',
    angle: -90, // Top
    summary: '八拍五声律动',
    children: [
      { id: 'pulse-sound', label: '发声 / 静音', action: 'toggleSound' },
      { id: 'pulse-scale', label: '切换五声音阶', action: 'nextScale' },
      { id: 'pulse-fast',  label: '加速 +16 BPM', action: 'bpmUp' },
      { id: 'pulse-slow',  label: '放缓 -16 BPM', action: 'bpmDown' },
      { id: 'pulse-seed',  label: '重排节拍型', action: 'shuffleSteps' },
    ],
  },
  {
    id: 'helios',
    name: '日照',
    en: 'Helios',
    glyph: '☀',
    color: '#C48426',
    soft: 'rgba(196, 132, 38, 0.15)',
    angle: -18, // Upper right
    summary: '太阳高度与影长',
    children: [
      { id: 'helios-dawn',  label: '晨光 06:45', action: 'setHour', value: 6.75 },
      { id: 'helios-noon',  label: '正午 12:30', action: 'setHour', value: 12.5 },
      { id: 'helios-dusk',  label: '暮色 17:35', action: 'setHour', value: 17.58 },
      { id: 'helios-night', label: '深夜 22:15', action: 'setHour', value: 22.25 },
      { id: 'helios-season', label: '夏至 / 冬至', action: 'toggleSolstice' },
    ],
  },
  {
    id: 'pendulum',
    name: '单摆',
    en: 'Pendulum',
    glyph: '◐',
    color: '#3A5A78',
    soft: 'rgba(58, 90, 120, 0.15)',
    angle: 54, // Lower right
    summary: '阻尼谐振与相轨',
    children: [
      { id: 'pend-pluck',  label: '轻拨摆锤', action: 'pluck', value: 0.72 },
      { id: 'pend-strong', label: '强力起摆', action: 'pluck', value: 1.25 },
      { id: 'pend-short',  label: '缩短摆长', action: 'setLength', value: 0.65 },
      { id: 'pend-long',   label: '加长摆长', action: 'setLength', value: 1.45 },
      { id: 'pend-damp',   label: '切换阻尼', action: 'toggleDamp' },
    ],
  },
  {
    id: 'atlas',
    name: '校景',
    en: 'Atlas',
    glyph: '⌖',
    color: '#4D7349',
    soft: 'rgba(77, 115, 73, 0.15)',
    angle: 126, // Lower left
    summary: '榄仁树方位地标',
    children: CAMPUS_LANDMARKS.slice(1).map((lm) => ({
      id: `atlas-${lm.id}`,
      label: `${lm.name} ${lm.dist}m`,
      action: 'selectLandmark',
      value: lm.id,
    })),
  },
  {
    id: 'cambium',
    name: '年轮',
    en: 'Cambium',
    glyph: '◉',
    color: '#7B563A',
    soft: 'rgba(123, 86, 58, 0.15)',
    angle: 198, // Upper left
    summary: '1940–2026 生长纹',
    children: [
      { id: 'cam-1940', label: '1940 起点', action: 'setYear', value: 1940 },
      { id: 'cam-1969', label: '1969 登月', action: 'setYear', value: 1969 },
      { id: 'cam-2014', label: '2014 威马逊', action: 'setYear', value: 2014 },
      { id: 'cam-2024', label: '2024 日全食', action: 'setYear', value: 2024 },
      { id: 'cam-2026', label: '2026 此刻', action: 'setYear', value: 2026 },
    ],
  },
];

// ─── Shared Live World State ───
export const world = {
  pulse: {
    steps: [1, 0, 1, 1, 0, 1, 0, 1],
    bpm: 88,
    scaleIdx: 0,
    stepIdx: 0,
    phase: 0,
    soundOn: false,
    lastStepTs: 0,
    pulseFlash: 0,
  },
  helios: {
    hour: 15.25,     // 15:15 local solar time
    dayOfYear: 329,  // Nov 25
    lat: 20.044,     // Haikou
    altitude: 31,
    azimuth: 235,
  },
  pendulum: {
    theta: 0.72,
    omega: 0,
    length: 1.0,
    damping: 0.012,
    trail: [],
    lastSign: 1,
  },
  atlas: {
    activeLandmarkId: 'yanchi',
    heading: 0,
  },
  cambium: {
    year: 2014,
  },
  // Active multi-object couplings: array of { a, b, label, desc }
  couplings: [],
  lastActionToast: '',
};

// Listeners notified on state changes
const listeners = new Set();
export function onWorldChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function emitWorldChange(toast = '') {
  if (toast) world.lastActionToast = toast;
  for (const fn of listeners) fn(world, toast);
}

// ─── Web Audio Acoustic Chime (Zero Dependencies, Warm Plucked Envelope) ───
let audioCtx = null;
export function playTone(freq, duration = 0.28, gainLevel = 0.09) {
  if (!world.pulse.soundOn) return;
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainLevel, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch {
    // ignore autoplay restriction before gesture
  }
}

// ─── Real Solar Geometry (Declination, Altitude, Azimuth) ───
export function computeSolarGeometry(hour, dayOfYear, lat = 20.044) {
  const rad = Math.PI / 180;
  const decl = 23.44 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81));
  const ha = (hour - 12) * 15; // degrees
  const latR = lat * rad;
  const decR = decl * rad;
  const haR = ha * rad;
  const sinAlt = Math.sin(latR) * Math.sin(decR) + Math.cos(latR) * Math.cos(decR) * Math.cos(haR);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt))) / rad;
  const cosAz = (Math.sin(decR) - Math.sin(latR) * sinAlt) / (Math.cos(latR) * Math.cos(altitude * rad) || 1e-5);
  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) / rad;
  if (ha > 0) azimuth = 360 - azimuth;
  return { altitude, azimuth, declination: decl };
}

export function formatHour(h) {
  const norm = ((h % 24) + 24) % 24;
  const hh = Math.floor(norm);
  const mm = Math.round((norm - hh) * 60) % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function getCambiumRecord(year) {
  let closest = CAMBIUM_EVENTS[0];
  let best = Infinity;
  for (const r of CAMBIUM_EVENTS) {
    const d = Math.abs(r.year - year);
    if (d < best) { best = d; closest = r; }
  }
  return closest;
}

// ─── Coupling Definitions ───
export function describeCoupling(a, b) {
  const pair = [a, b].sort().join('+');
  switch (pair) {
    case 'helios+pulse':
      return { pair, a, b, label: '光声共振', desc: '太阳高度调制音阶亮度与速度' };
    case 'pendulum+pulse':
      return { pair, a, b, label: '摆锤击节', desc: '单摆每次过零点触发五声清音' };
    case 'atlas+helios':
      return { pair, a, b, label: '校园日影', desc: '实时太阳方位投射校园建筑影向' };
    case 'cambium+helios':
      return { pair, a, b, label: '岁时节气', desc: '年轮年份牵引太阳赤纬季节变化' };
    case 'cambium+pendulum':
      return { pair, a, b, label: '台风扰摆', desc: '暴雨大风年份激发单摆扰动振幅' };
    case 'atlas+cambium':
      return { pair, a, b, label: '校史地标', desc: '年轮年份与校园原点空间叠印' };
    case 'atlas+pendulum':
      return { pair, a, b, label: '傅科摆向', desc: '单摆平面随所选地标方位偏转' };
    case 'atlas+pulse':
      return { pair, a, b, label: '声景距离', desc: '地标距树心的远近调节音色衰减' };
    case 'cambium+pulse':
      return { pair, a, b, label: '年轮节拍', desc: '当年降水量映射节拍疏密' };
    case 'helios+pendulum':
      return { pair, a, b, label: '日晷摆钟', desc: '日照时刻与单摆能量耦合' };
    default:
      return { pair, a, b, label: '双体共振', desc: '实时共享参数场' };
  }
}

export function hasCoupling(a, b) {
  const pair = [a, b].sort().join('+');
  return world.couplings.some((c) => c.pair === pair);
}

// ─── Execute Semantic Action (used by Marking Menu, Sunburst, & Direct Controls) ───
export function runSpecimenAction(specimenId, action, value) {
  if (specimenId === 'pulse') {
    if (action === 'toggleSound') {
      world.pulse.soundOn = !world.pulse.soundOn;
      if (world.pulse.soundOn) playTone(SCALES[world.pulse.scaleIdx].freqs[0], 0.35, 0.12);
      emitWorldChange(world.pulse.soundOn ? '节律发声已开启' : '节律已静音');
    } else if (action === 'nextScale') {
      world.pulse.scaleIdx = (world.pulse.scaleIdx + 1) % SCALES.length;
      playTone(SCALES[world.pulse.scaleIdx].freqs[2], 0.3, 0.1);
      emitWorldChange(`切换音阶：${SCALES[world.pulse.scaleIdx].name}`);
    } else if (action === 'bpmUp') {
      world.pulse.bpm = Math.min(148, world.pulse.bpm + 16);
      emitWorldChange(`节律加速至 ${world.pulse.bpm} BPM`);
    } else if (action === 'bpmDown') {
      world.pulse.bpm = Math.max(48, world.pulse.bpm - 16);
      emitWorldChange(`节律放缓至 ${world.pulse.bpm} BPM`);
    } else if (action === 'shuffleSteps') {
      world.pulse.steps = world.pulse.steps.map((_, i) => (i === 0 ? 1 : Math.random() > 0.45 ? 1 : 0));
      emitWorldChange('已重排八拍律动型');
    }
  } else if (specimenId === 'helios') {
    if (action === 'setHour') {
      world.helios.hour = value;
      emitWorldChange(`日照拨至 ${formatHour(value)}`);
    } else if (action === 'toggleSolstice') {
      world.helios.dayOfYear = world.helios.dayOfYear > 200 ? 172 : 355;
      emitWorldChange(world.helios.dayOfYear === 172 ? '切至夏至日轨' : '切至冬至日轨');
    }
  } else if (specimenId === 'pendulum') {
    if (action === 'pluck') {
      world.pendulum.theta = value;
      world.pendulum.omega = 0;
      world.pendulum.trail = [];
      emitWorldChange(`单摆起摆 ${(value * 57.3).toFixed(0)}°`);
    } else if (action === 'setLength') {
      world.pendulum.length = value;
      emitWorldChange(`摆长设为 ${value.toFixed(2)} m`);
    } else if (action === 'toggleDamp') {
      world.pendulum.damping = world.pendulum.damping > 0.02 ? 0.008 : 0.045;
      emitWorldChange(world.pendulum.damping > 0.02 ? '高阻尼衰减' : '低阻尼长摆');
    }
  } else if (specimenId === 'atlas') {
    if (action === 'selectLandmark') {
      world.atlas.activeLandmarkId = value;
      const lm = CAMPUS_LANDMARKS.find((x) => x.id === value);
      if (lm) {
        world.atlas.heading = lm.bearing;
        emitWorldChange(`朝向 ${lm.name}（${lm.dist}m · ${lm.bearing}°）`);
      }
    }
  } else if (specimenId === 'cambium') {
    if (action === 'setYear') {
      world.cambium.year = value;
      if (hasCoupling('cambium', 'pendulum') && value === 2014) {
        world.pendulum.theta = 1.2;
      }
      const rec = getCambiumRecord(value);
      emitWorldChange(`年轮停驻 ${value} · ${rec.tag}`);
    }
  }
}

// ─── Global Physics & Rhythm Heartbeat (60fps) ───
let lastFrameTs = 0;
export function stepWorldPhysics(ts) {
  if (!lastFrameTs) lastFrameTs = ts;
  const dt = Math.min(0.05, (ts - lastFrameTs) / 1000);
  lastFrameTs = ts;

  // 1. Solar geometry update (with cambium coupling if active)
  const doy = hasCoupling('cambium', 'helios')
    ? ((world.cambium.year * 43) % 365) + 1
    : world.helios.dayOfYear;
  const sol = computeSolarGeometry(world.helios.hour, doy, world.helios.lat);
  world.helios.altitude = sol.altitude;
  world.helios.azimuth = sol.azimuth;

  // 2. Pendulum damped harmonic integration
  const g = 9.81;
  const effLength = Math.max(0.45, world.pendulum.length);
  const alpha = -(g / (effLength * 2.2)) * Math.sin(world.pendulum.theta) - world.pendulum.damping * 8 * world.pendulum.omega;
  world.pendulum.omega += alpha * dt;
  world.pendulum.theta += world.pendulum.omega * dt;

  // Keep subtle gentle motion if user hasn't stopped it completely
  if (Math.abs(world.pendulum.theta) < 0.03 && Math.abs(world.pendulum.omega) < 0.03) {
    world.pendulum.omega += 0.25 * dt;
  }

  // Zero-crossing detection for Pendulum + Pulse coupling
  const sign = world.pendulum.theta >= 0 ? 1 : -1;
  if (sign !== world.pendulum.lastSign) {
    world.pendulum.lastSign = sign;
    if (hasCoupling('pendulum', 'pulse')) {
      const scale = SCALES[world.pulse.scaleIdx];
      const idx = Math.floor(Math.abs(world.pendulum.omega) * 3) % scale.freqs.length;
      playTone(scale.freqs[idx], 0.32, 0.08);
      world.pulse.pulseFlash = 1.0;
    }
  }

  world.pendulum.trail.push({ t: world.pendulum.theta, w: world.pendulum.omega });
  if (world.pendulum.trail.length > 48) world.pendulum.trail.shift();

  // 3. Pulse 8-step sequencer
  let effBpm = world.pulse.bpm;
  if (hasCoupling('helios', 'pulse')) {
    effBpm = Math.max(54, Math.min(144, Math.round(72 + Math.max(0, world.helios.altitude) * 0.9)));
  }
  const stepMs = (60_000 / effBpm) / 2; // eighth notes
  if (!world.pulse.lastStepTs) world.pulse.lastStepTs = ts;
  const elapsed = ts - world.pulse.lastStepTs;
  world.pulse.phase = Math.min(1, elapsed / stepMs);

  if (elapsed >= stepMs) {
    world.pulse.lastStepTs = ts;
    world.pulse.stepIdx = (world.pulse.stepIdx + 1) % 8;
    if (world.pulse.steps[world.pulse.stepIdx]) {
      world.pulse.pulseFlash = 1.0;
      const scale = SCALES[world.pulse.scaleIdx];
      const freqShift = hasCoupling('helios', 'pulse')
        ? (world.helios.altitude > 10 ? 1.122 : 0.89)
        : 1.0;
      const dur = hasCoupling('atlas', 'pulse')
        ? 0.18 + (CAMPUS_LANDMARKS.find((l) => l.id === world.atlas.activeLandmarkId)?.dist || 60) / 400
        : 0.28;
      playTone(scale.freqs[world.pulse.stepIdx] * freqShift, dur, 0.075);
    }
  }
  world.pulse.pulseFlash = Math.max(0, world.pulse.pulseFlash - dt * 3.5);
}

// ─── Get Live Short Telemetry String for Seed / Mini State ───
export function getSpecimenReadout(id) {
  switch (id) {
    case 'pulse':
      return `${world.pulse.bpm} BPM · ${world.pulse.soundOn ? '发声' : '静音'}`;
    case 'helios':
      return `${formatHour(world.helios.hour)} · 仰角 ${world.helios.altitude.toFixed(0)}°`;
    case 'pendulum':
      return `${(world.pendulum.theta * 57.3).toFixed(0)}° · L=${world.pendulum.length.toFixed(1)}m`;
    case 'atlas': {
      const lm = CAMPUS_LANDMARKS.find((l) => l.id === world.atlas.activeLandmarkId) || CAMPUS_LANDMARKS[1];
      return `${lm.name} · ${lm.dist}m`;
    }
    case 'cambium': {
      const rec = getCambiumRecord(world.cambium.year);
      return `${world.cambium.year} · ${rec.tag.slice(0, 4)}`;
    }
    default:
      return '';
  }
}

/**
 * Mount a REAL, directly manipulable micro-instrument INSIDE a morphed container
 * (an expanded force-yielding node, a warped Voronoi fisheye cell, or the sunburst core).
 * Zero modals, zero sidebars — direct tactile manipulation right inside the organism!
 */
export function mountInPlaceInstrument(hostEl, specimenId, { compact = false, onClose = null } = {}) {
  const spec = SPECIMENS.find((s) => s.id === specimenId);
  if (!spec) return () => {};

  hostEl.innerHTML = '';
  const body = document.createElement('div');
  body.className = `specimen-live-body ${compact ? 'is-compact' : ''}`;
  body.style.setProperty('--spec-color', spec.color);
  hostEl.appendChild(body);

  const head = document.createElement('div');
  head.className = 'sl-head';
  head.innerHTML = `
    <span class="sl-title"><b>${spec.name}</b> <small>${spec.en}</small></span>
    ${onClose ? `<button type="button" class="sl-close" title="收拢回归年轮" aria-label="收拢">×</button>` : ''}
  `;
  body.appendChild(head);
  if (onClose) {
    head.querySelector('.sl-close').addEventListener('click', (e) => {
      e.stopPropagation();
      onClose();
    });
  }

  const stage = document.createElement('div');
  stage.className = 'sl-stage';
  body.appendChild(stage);

  let updateFn = () => {};

  if (specimenId === 'pulse') {
    stage.innerHTML = `
      <svg class="sl-svg" viewBox="-72 -72 144 144"></svg>
      <div class="sl-controls">
        <button type="button" data-a="toggleSound" class="sl-chip">${world.pulse.soundOn ? '🔊 发声中' : '🔇 点此发声'}</button>
        <button type="button" data-a="nextScale" class="sl-chip">${SCALES[world.pulse.scaleIdx].name.split(' ')[0]}</button>
        <button type="button" data-a="bpmDown" class="sl-chip">−</button>
        <span class="sl-mono" data-r="bpm">${world.pulse.bpm}</span>
        <button type="button" data-a="bpmUp" class="sl-chip">+</button>
      </div>
    `;
    const svg = stage.querySelector('svg');
    const NS = 'http://www.w3.org/2000/svg';
    const ring = document.createElementNS(NS, 'circle');
    ring.setAttribute('r', '48');
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', 'currentColor');
    ring.setAttribute('stroke-opacity', '0.18');
    svg.appendChild(ring);

    const nodes = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const cx = Math.cos(a) * 48;
      const cy = Math.sin(a) * 48;
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', cx.toFixed(1));
      c.setAttribute('cy', cy.toFixed(1));
      c.setAttribute('r', '10');
      c.style.cursor = 'pointer';
      c.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        world.pulse.steps[i] = world.pulse.steps[i] ? 0 : 1;
        if (world.pulse.steps[i]) {
          if (!world.pulse.soundOn) world.pulse.soundOn = true;
          playTone(SCALES[world.pulse.scaleIdx].freqs[i], 0.3, 0.1);
        }
        emitWorldChange();
      });
      svg.appendChild(c);
      nodes.push(c);
    }

    const core = document.createElementNS(NS, 'circle');
    core.setAttribute('r', '14');
    core.setAttribute('fill', spec.color);
    core.setAttribute('fill-opacity', '0.2');
    svg.appendChild(core);

    stage.querySelectorAll('[data-a]').forEach((btn) => {
      btn.addEventListener('pointerdown', (e) => e.stopPropagation());
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        runSpecimenAction('pulse', btn.dataset.a);
      });
    });

    updateFn = () => {
      nodes.forEach((c, i) => {
        const active = !!world.pulse.steps[i];
        const isNow = i === world.pulse.stepIdx;
        c.setAttribute('fill', active ? spec.color : 'var(--paper-elev)');
        c.setAttribute('fill-opacity', active ? (isNow ? '1' : '0.78') : '1');
        c.setAttribute('stroke', isNow ? 'var(--ink)' : spec.color);
        c.setAttribute('stroke-width', isNow ? '2.4' : '1.2');
        c.setAttribute('r', isNow ? '12' : active ? '9.5' : '7.5');
      });
      core.setAttribute('r', (12 + world.pulse.pulseFlash * 10).toFixed(1));
      const soundBtn = stage.querySelector('[data-a="toggleSound"]');
      if (soundBtn) soundBtn.textContent = world.pulse.soundOn ? '🔊 发声中' : '🔇 点此发声';
      const scaleBtn = stage.querySelector('[data-a="nextScale"]');
      if (scaleBtn) scaleBtn.textContent = SCALES[world.pulse.scaleIdx].name.split(' ')[0];
      const bpmEl = stage.querySelector('[data-r="bpm"]');
      if (bpmEl) bpmEl.textContent = String(world.pulse.bpm);
    };
  } else if (specimenId === 'helios') {
    stage.innerHTML = `
      <svg class="sl-svg" viewBox="-76 -76 152 152"></svg>
      <div class="sl-controls">
        <span class="sl-mono" data-r="time">${formatHour(world.helios.hour)}</span>
        <input type="range" class="sl-range" min="0" max="24" step="0.1" value="${world.helios.hour}" aria-label="拨动太阳时刻" />
        <span class="sl-mono" data-r="alt"></span>
      </div>
    `;
    const svg = stage.querySelector('svg');
    const NS = 'http://www.w3.org/2000/svg';
    const horizon = document.createElementNS(NS, 'line');
    horizon.setAttribute('x1', '-62'); horizon.setAttribute('x2', '62');
    horizon.setAttribute('y1', '14'); horizon.setAttribute('y2', '14');
    horizon.setAttribute('stroke', 'currentColor'); horizon.setAttribute('stroke-opacity', '0.25');
    svg.appendChild(horizon);

    const arcPath = document.createElementNS(NS, 'path');
    arcPath.setAttribute('d', 'M -56 14 A 56 56 0 0 1 56 14');
    arcPath.setAttribute('fill', 'none'); arcPath.setAttribute('stroke', spec.color);
    arcPath.setAttribute('stroke-dasharray', '3 3'); arcPath.setAttribute('stroke-opacity', '0.5');
    svg.appendChild(arcPath);

    const shadowLine = document.createElementNS(NS, 'line');
    shadowLine.setAttribute('x1', '0'); shadowLine.setAttribute('y1', '14');
    shadowLine.setAttribute('stroke', 'var(--ink)'); shadowLine.setAttribute('stroke-width', '3.5');
    shadowLine.setAttribute('stroke-opacity', '0.3'); shadowLine.setAttribute('stroke-linecap', 'round');
    svg.appendChild(shadowLine);

    const gnomon = document.createElementNS(NS, 'line');
    gnomon.setAttribute('x1', '0'); gnomon.setAttribute('y1', '14');
    gnomon.setAttribute('x2', '0'); gnomon.setAttribute('y2', '-4');
    gnomon.setAttribute('stroke', 'var(--ink)'); gnomon.setAttribute('stroke-width', '2.2');
    svg.appendChild(gnomon);

    const sunDot = document.createElementNS(NS, 'circle');
    sunDot.setAttribute('r', '9'); sunDot.setAttribute('fill', spec.color);
    sunDot.style.cursor = 'grab';
    svg.appendChild(sunDot);

    const slider = stage.querySelector('.sl-range');
    slider.addEventListener('pointerdown', (e) => e.stopPropagation());
    slider.addEventListener('input', (e) => {
      e.stopPropagation();
      world.helios.hour = Number(e.target.value);
      emitWorldChange();
    });

    // Direct drag on SVG sun
    let draggingSun = false;
    svg.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      draggingSun = true;
      svg.setPointerCapture(e.pointerId);
      updateSunFromPointer(e);
    });
    svg.addEventListener('pointermove', (e) => {
      if (!draggingSun) return;
      e.stopPropagation();
      updateSunFromPointer(e);
    });
    svg.addEventListener('pointerup', () => { draggingSun = false; });

    function updateSunFromPointer(e) {
      const rect = svg.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1; // -1..1
      const h = Math.max(5.5, Math.min(18.5, 12 + nx * 6.5));
      world.helios.hour = h;
      slider.value = String(h);
      emitWorldChange();
    }

    updateFn = () => {
      const altNorm = Math.max(-0.4, Math.min(1, world.helios.altitude / 75));
      const azOffset = ((world.helios.hour - 12) / 6.5) * 54;
      const sx = Math.max(-58, Math.min(58, azOffset));
      const sy = 14 - altNorm * 56;
      sunDot.setAttribute('cx', sx.toFixed(1));
      sunDot.setAttribute('cy', sy.toFixed(1));
      sunDot.setAttribute('fill-opacity', world.helios.altitude > -2 ? '1' : '0.35');

      // Shadow points away from sun
      const shLen = world.helios.altitude > 2 ? Math.min(56, 26 / Math.tan(Math.max(0.15, world.helios.altitude * Math.PI / 180))) : 0;
      const shDir = sx >= 0 ? -1 : 1;
      shadowLine.setAttribute('x2', (shDir * shLen).toFixed(1));
      shadowLine.setAttribute('y2', '14');
      shadowLine.setAttribute('stroke-opacity', world.helios.altitude > 2 ? '0.35' : '0');

      const tEl = stage.querySelector('[data-r="time"]');
      if (tEl) tEl.textContent = formatHour(world.helios.hour);
      const aEl = stage.querySelector('[data-r="alt"]');
      if (aEl) aEl.textContent = `${world.helios.altitude.toFixed(0)}°`;
      if (!draggingSun) slider.value = String(world.helios.hour);
    };
  } else if (specimenId === 'pendulum') {
    stage.innerHTML = `
      <svg class="sl-svg" viewBox="-74 -16 148 134"></svg>
      <div class="sl-controls">
        <button type="button" data-a="pluck" class="sl-chip">拨动摆锤</button>
        <input type="range" class="sl-range" min="0.55" max="1.5" step="0.05" value="${world.pendulum.length}" aria-label="调节摆长" />
        <span class="sl-mono" data-r="ang"></span>
      </div>
    `;
    const svg = stage.querySelector('svg');
    const NS = 'http://www.w3.org/2000/svg';
    const trailPath = document.createElementNS(NS, 'path');
    trailPath.setAttribute('fill', 'none');
    trailPath.setAttribute('stroke', spec.color);
    trailPath.setAttribute('stroke-opacity', '0.28');
    trailPath.setAttribute('stroke-width', '1.6');
    svg.appendChild(trailPath);

    const rod = document.createElementNS(NS, 'line');
    rod.setAttribute('x1', '0'); rod.setAttribute('y1', '0');
    rod.setAttribute('stroke', 'var(--ink)'); rod.setAttribute('stroke-width', '1.6');
    svg.appendChild(rod);

    const pivot = document.createElementNS(NS, 'circle');
    pivot.setAttribute('r', '3.5'); pivot.setAttribute('fill', 'var(--ink)');
    svg.appendChild(pivot);

    const bob = document.createElementNS(NS, 'circle');
    bob.setAttribute('r', '10'); bob.setAttribute('fill', spec.color);
    bob.style.cursor = 'grab';
    svg.appendChild(bob);

    let grabbing = false;
    svg.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      grabbing = true;
      svg.setPointerCapture(e.pointerId);
      setBobFromPointer(e);
    });
    svg.addEventListener('pointermove', (e) => {
      if (!grabbing) return;
      e.stopPropagation();
      setBobFromPointer(e);
    });
    svg.addEventListener('pointerup', () => { grabbing = false; });

    function setBobFromPointer(e) {
      const rect = svg.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 148 - 74;
      const y = ((e.clientY - rect.top) / rect.height) * 134 - 16;
      world.pendulum.theta = Math.max(-1.4, Math.min(1.4, Math.atan2(x, Math.max(10, y))));
      world.pendulum.omega = 0;
    }

    stage.querySelector('[data-a="pluck"]').addEventListener('pointerdown', (e) => e.stopPropagation());
    stage.querySelector('[data-a="pluck"]').addEventListener('click', (e) => {
      e.stopPropagation();
      runSpecimenAction('pendulum', 'pluck', world.pendulum.theta > 0 ? -0.95 : 0.95);
    });
    const slider = stage.querySelector('.sl-range');
    slider.addEventListener('pointerdown', (e) => e.stopPropagation());
    slider.addEventListener('input', (e) => {
      e.stopPropagation();
      world.pendulum.length = Number(e.target.value);
      emitWorldChange();
    });

    updateFn = () => {
      const pxLen = 46 + world.pendulum.length * 36;
      const bx = Math.sin(world.pendulum.theta) * pxLen;
      const by = Math.cos(world.pendulum.theta) * pxLen;
      rod.setAttribute('x2', bx.toFixed(1));
      rod.setAttribute('y2', by.toFixed(1));
      bob.setAttribute('cx', bx.toFixed(1));
      bob.setAttribute('cy', by.toFixed(1));

      if (world.pendulum.trail.length > 2) {
        const d = world.pendulum.trail.map((pt, idx) => {
          const tx = Math.sin(pt.t) * pxLen;
          const ty = Math.cos(pt.t) * pxLen;
          return `${idx === 0 ? 'M' : 'L'} ${tx.toFixed(1)} ${ty.toFixed(1)}`;
        }).join(' ');
        trailPath.setAttribute('d', d);
      }
      const aEl = stage.querySelector('[data-r="ang"]');
      if (aEl) aEl.textContent = `${(world.pendulum.theta * 57.3).toFixed(0)}°`;
    };
  } else if (specimenId === 'atlas') {
    stage.innerHTML = `
      <svg class="sl-svg" viewBox="-76 -76 152 152"></svg>
      <div class="sl-controls sl-caption" data-r="note"></div>
    `;
    const svg = stage.querySelector('svg');
    const NS = 'http://www.w3.org/2000/svg';

    // Distance rings
    for (const r of [28, 56]) {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('r', String(r)); c.setAttribute('fill', 'none');
      c.setAttribute('stroke', 'currentColor'); c.setAttribute('stroke-opacity', '0.14');
      svg.appendChild(c);
    }

    // Live sun shadow ray when coupled with Helios!
    const shadowRay = document.createElementNS(NS, 'line');
    shadowRay.setAttribute('x1', '0'); shadowRay.setAttribute('y1', '0');
    shadowRay.setAttribute('stroke', '#C48426'); shadowRay.setAttribute('stroke-width', '2.5');
    shadowRay.setAttribute('stroke-dasharray', '3 3');
    svg.appendChild(shadowRay);

    const activeRay = document.createElementNS(NS, 'line');
    activeRay.setAttribute('x1', '0'); activeRay.setAttribute('y1', '0');
    activeRay.setAttribute('stroke', spec.color); activeRay.setAttribute('stroke-width', '1.6');
    svg.appendChild(activeRay);

    const dotMap = new Map();
    for (const lm of CAMPUS_LANDMARKS) {
      const rad = ((lm.bearing - 90) * Math.PI) / 180;
      const distPx = (lm.dist / 185) * 60;
      const x = Math.cos(rad) * distPx;
      const y = Math.sin(rad) * distPx;
      const g = document.createElementNS(NS, 'g');
      g.style.cursor = 'pointer';
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', x.toFixed(1)); c.setAttribute('cy', y.toFixed(1));
      c.setAttribute('r', lm.id === 'tree' ? '5' : '6.5');
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', x.toFixed(1)); t.setAttribute('y', (y - 9).toFixed(1));
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('font-size', '9');
      t.setAttribute('fill', 'currentColor');
      t.textContent = lm.name;
      g.appendChild(c);
      g.appendChild(t);
      g.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        runSpecimenAction('atlas', 'selectLandmark', lm.id);
      });
      svg.appendChild(g);
      dotMap.set(lm.id, { c, x, y, lm });
    }

    updateFn = () => {
      const cur = dotMap.get(world.atlas.activeLandmarkId) || dotMap.get('yanchi');
      for (const [id, item] of dotMap.entries()) {
        const isSel = id === cur.lm.id;
        item.c.setAttribute('fill', isSel ? spec.color : id === 'tree' ? 'var(--ink)' : 'var(--paper-elev)');
        item.c.setAttribute('stroke', spec.color);
        item.c.setAttribute('stroke-width', isSel ? '2' : '1.2');
      }
      activeRay.setAttribute('x2', cur.x.toFixed(1));
      activeRay.setAttribute('y2', cur.y.toFixed(1));

      // Show live solar shadow across campus when coupled with Helios!
      if (hasCoupling('atlas', 'helios')) {
        const shRad = (((world.helios.azimuth + 180) - 90) * Math.PI) / 180;
        shadowRay.setAttribute('x2', (Math.cos(shRad) * 64).toFixed(1));
        shadowRay.setAttribute('y2', (Math.sin(shRad) * 64).toFixed(1));
        shadowRay.setAttribute('stroke-opacity', '0.75');
      } else {
        shadowRay.setAttribute('stroke-opacity', '0');
      }

      const nEl = stage.querySelector('[data-r="note"]');
      if (nEl) nEl.textContent = `${cur.lm.name} · ${cur.lm.dist}m · ${cur.lm.note}`;
    };
  } else if (specimenId === 'cambium') {
    stage.innerHTML = `
      <svg class="sl-svg" viewBox="-74 -74 148 148"></svg>
      <div class="sl-controls">
        <span class="sl-mono" data-r="yr">${world.cambium.year}</span>
        <input type="range" class="sl-range" min="1940" max="2026" step="1" value="${world.cambium.year}" aria-label="拨动年轮年份" />
        <span class="sl-caption-inline" data-r="tag"></span>
      </div>
    `;
    const svg = stage.querySelector('svg');
    const NS = 'http://www.w3.org/2000/svg';
    const ringEls = [];
    for (let i = 0; i < CAMBIUM_EVENTS.length; i++) {
      const ev = CAMBIUM_EVENTS[i];
      const r = 12 + ((ev.year - 1940) / 86) * 52;
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('r', r.toFixed(1));
      c.setAttribute('fill', 'none');
      c.setAttribute('stroke', spec.color);
      c.setAttribute('stroke-width', ((ev.rain - 1200) / 480).toFixed(1));
      c.setAttribute('stroke-opacity', '0.32');
      c.style.cursor = 'pointer';
      c.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        runSpecimenAction('cambium', 'setYear', ev.year);
      });
      svg.appendChild(c);
      ringEls.push({ c, ev, r });
    }
    const activeCircle = document.createElementNS(NS, 'circle');
    activeCircle.setAttribute('fill', 'none');
    activeCircle.setAttribute('stroke', spec.color);
    activeCircle.setAttribute('stroke-width', '2.6');
    svg.appendChild(activeCircle);

    const slider = stage.querySelector('.sl-range');
    slider.addEventListener('pointerdown', (e) => e.stopPropagation());
    slider.addEventListener('input', (e) => {
      e.stopPropagation();
      runSpecimenAction('cambium', 'setYear', Number(e.target.value));
    });

    updateFn = () => {
      const rNow = 12 + ((world.cambium.year - 1940) / 86) * 52;
      activeCircle.setAttribute('r', rNow.toFixed(1));
      const rec = getCambiumRecord(world.cambium.year);
      const yrEl = stage.querySelector('[data-r="yr"]');
      if (yrEl) yrEl.textContent = String(world.cambium.year);
      const tagEl = stage.querySelector('[data-r="tag"]');
      if (tagEl) tagEl.textContent = rec.tag;
      slider.value = String(world.cambium.year);
    };
  }

  updateFn();
  return updateFn;
}
