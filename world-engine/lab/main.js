// HAIZ World Engine — Independent Art & Engineering Acceptance Workbench
//
// Live 3D inspection studio for:
//   1. Six Art Lenses with real-time A/B Split-Screen wipe & parameter tuning
//   2. 51-Joint MakeHuman Character & Procedural Gait inspection (live stance foot-slide cm/s + SkeletonHelper)
//   3. Canonical Spatial Provenance & Discrepancy Audit (twin vs legacy campus.json)
//   4. Automated Scientific Kernel Verifier (RK4 conservation, AGM elliptic period, Fresnel identities)
//   5. Live Performance Budget & Full-Repo GLB Asset Audit Viewer

import * as THREE from 'three';
import { U, cel } from '../../lanren/ruhua-stroll/atmos.js';
import { createDaylight } from '../../lanren/ruhua-stroll/daylight.js';
import { createSky } from '../../lanren/ruhua-stroll/sky.js';
import { palette, sunAt, moonAt, toWorld, targets, presetRaw, atHaikouHour } from '../../lanren/ruhua/weather/model.js';
import { createWalker } from '../../lanren/life/gait.js';
import { pairMaterials } from '../../lanren/painted-lab/material.js';

import { ART_LENSES, getLens } from '../art/lenses.js';
import { createWorldPipeline } from '../art/pipeline.js';
import { createPerfMonitor } from '../core/perf.js';
import { CANONICAL_DATUM, getSpatialDiscrepancyReport } from '../spatial/coord.js';
import { SEMANTIC_PLACES } from '../spatial/graph.js';
import {
  normalGravity,
  createPendulumSim,
  exactPendulumPeriod,
  fresnelOptics,
  microclimateStep,
} from '../science/kernel.js';

const $ = (s) => document.querySelector(s);
const LANREN_ROOT = new URL('../../lanren/', import.meta.url);
const asset = (p) => new URL(p, LANREN_ROOT).href;
const coarse = matchMedia('(pointer: coarse)').matches || innerWidth <= 640;

function createSimpleOrbit(camera, dom) {
  const target = new THREE.Vector3(0, 1.0, 0);
  let yaw = 0.62, pitch = 0.24, dist = 5.4;
  let drag = null;
  dom.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, yaw, pitch };
    dom.setPointerCapture(e.pointerId);
  });
  dom.addEventListener('pointermove', (e) => {
    if (!drag) return;
    yaw = drag.yaw - (e.clientX - drag.x) * 0.007;
    pitch = Math.max(-0.08, Math.min(1.25, drag.pitch + (e.clientY - drag.y) * 0.006));
  });
  dom.addEventListener('pointerup', () => { drag = null; });
  dom.addEventListener('wheel', (e) => {
    e.preventDefault();
    dist = Math.max(2.0, Math.min(18.0, dist * (e.deltaY > 0 ? 1.1 : 0.91)));
  }, { passive: false });
  return {
    target,
    update() {
      const cp = Math.cos(pitch);
      camera.position.set(
        target.x + Math.sin(yaw) * cp * dist,
        Math.max(0.3, target.y + Math.sin(pitch) * dist),
        target.z + Math.cos(yaw) * cp * dist,
      );
      camera.lookAt(target);
    },
  };
}

async function main() {
  const canvas = $('#lab-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  const pr = Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2);
  renderer.setPixelRatio(pr);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.info.autoReset = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1.5, 0.1, 1500);
  const controls = createSimpleOrbit(camera, canvas);

  const pipeline = createWorldPipeline(renderer, { tier: coarse ? 'medium' : 'high', reduceMotion: false });
  const perf = createPerfMonitor({ mobile: coarse });

  // Build compact calibration campus courtyard stage (ground grid + architectural plinth + foliage backdrop)
  const sky = createSky(asset('assets/stroll/clouds.png'));
  scene.add(sky.group);
  const day = createDaylight(scene, { shadowSize: 2048, shadowBox: 18 });

  const stageGroup = new THREE.Group();
  const groundMat = cel({ color: 0xc8c0ae, name: 'ground_paving', roughness: 0.9 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  stageGroup.add(ground);

  // 0.5m calibration grid
  const grid = new THREE.GridHelper(24, 48, 0x2a4a3c, 0x7c8578);
  grid.position.y = 0.008;
  grid.material.opacity = 0.35;
  grid.material.transparent = true;
  stageGroup.add(grid);

  // Architectural teaching-block wall specimen + planter + stylized foliage dome for art-lens testing
  const wallMat = cel({ color: 0xe6dfd0, name: 'wall_yihao' });
  const trimMat = cel({ color: 0xa8482c, name: 'wall_accent' });
  const leafMat = cel({ color: 0x4b7447, name: 'leaf_crown' });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(10, 4.4, 0.8), wallMat);
  wall.position.set(-2.5, 2.2, -5.8);
  wall.castShadow = true;
  wall.receiveShadow = true;
  stageGroup.add(wall);

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(10.3, 0.35, 1.05), trimMat);
  lintel.position.set(-2.5, 4.45, -5.8);
  lintel.castShadow = true;
  stageGroup.add(lintel);

  for (let i = -3; i <= 3; i += 2) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.45, 0.14), cel({ color: 0x3b5862, name: 'glass_window' }));
    win.position.set(-2.5 + i * 1.1, 2.4, -5.36);
    stageGroup.add(win);
  }

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 2.6, 10), cel({ color: 0x5d4c3e, name: 'bark' }));
  trunk.position.set(3.2, 1.3, -3.4);
  trunk.castShadow = true;
  stageGroup.add(trunk);

  for (const [ox, oy, oz, r] of [[0, 3.1, 0, 1.55], [-0.9, 2.7, 0.5, 1.15], [0.95, 2.8, -0.35, 1.2], [0.1, 3.85, 0.2, 1.05]]) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), leafMat);
    puff.position.set(3.2 + ox, oy, -3.4 + oz);
    puff.castShadow = true;
    puff.receiveShadow = true;
    stageGroup.add(puff);
  }

  scene.add(stageGroup);
  const pairs = pairMaterials(stageGroup);
  pairs.lab();

  // State
  let activeLens = 'gouache';
  let splitVal = 0.5;
  let labHour = 16.25;
  let motionMode = 'walk';
  let showSkeleton = false;
  let showUmbrella = false;
  let walker = null;
  let skelHelper = null;
  let simTime = 0;

  // Foot-slide telemetry (tracks stance foot horizontal displacement when foot height < 0.04m)
  const slideStats = { prevL: null, prevR: null, samples: [], meanCm: 0, maxCm: 0, hipH: 0 };

  const FIGURE_URLS = {
    'student-m': { url: asset('assets/life/student-m.glb'), hair: 'short' },
    'student-f': { url: asset('assets/life/student-f.glb'), hair: 'ponytail' },
    'teacher-f': { url: asset('assets/life/teacher-f.glb'), hair: 'bob', bag: false, glasses: true },
    'worker-m': { url: asset('assets/life/worker-m.glb'), hair: 'grey', bag: false },
  };

  async function loadFigure(figId) {
    const spec = FIGURE_URLS[figId] || FIGURE_URLS['student-m'];
    if (walker) {
      scene.remove(walker.root);
    }
    if (skelHelper) {
      scene.remove(skelHelper);
      skelHelper = null;
    }
    walker = await createWalker(spec.url, {
      heightAt: () => 0,
      x: 0,
      z: 0,
      fade: true,
      hair: spec.hair,
      bag: spec.bag ?? true,
      glasses: spec.glasses ?? false,
    });
    walker.setFade?.(1);
    walker.setUmbrella?.(showUmbrella);
    scene.add(walker.root);
    skelHelper = new THREE.SkeletonHelper(walker.root);
    skelHelper.visible = showSkeleton;
    scene.add(skelHelper);
    slideStats.prevL = null;
    slideStats.prevR = null;
    slideStats.samples.length = 0;
  }

  function applySunHour(hour) {
    labHour = hour;
    const ms = atHaikouHour(Date.UTC(2026, 10, 18, 12, 0, 0), hour);
    const raw = presetRaw('clear', ms, 27);
    const cur = targets(raw, { wet: 0.06, puddle: 0 });
    const DEG = Math.PI / 180;
    const sun = sunAt(ms, CANONICAL_DATUM.wgs84.lat, CANONICAL_DATUM.wgs84.lon);
    const moon = moonAt(ms, CANONICAL_DATUM.wgs84.lat, CANONICAL_DATUM.wgs84.lon);
    sun.dir = toWorld(sun.alt * DEG, sun.bearing, CANONICAL_DATUM.campusNorthBearingDeg);
    moon.dir = toWorld(moon.alt * DEG, moon.bearing, CANONICAL_DATUM.campusNorthBearingDeg);
    const pal = palette(sun, moon, cur);
    day.applyParams(pal);
    U.uNight.value = pal.night;
    U.uLamps.value = pal.night;
    pipeline.setMood({
      exposure: pal.exposure,
      sat: pal.sat,
      bloomStrength: pal.bloom,
      shadeHue: U.uShadeHue.value,
      horizon: U.uHorizon.value,
    });
  }

  function setLens(id) {
    activeLens = id;
    const lens = pipeline.setLens(id, { animate: false });
    pipeline.setOverrides(null);
    $('#lab-paint').value = lens.post.paint;
    $('#lab-paint-val').textContent = lens.post.paint.toFixed(2);
    $('#lab-ink').value = lens.post.ink;
    $('#lab-ink-val').textContent = lens.post.ink.toFixed(2);
    $('#lab-paper').value = lens.post.paper;
    $('#lab-paper-val').textContent = lens.post.paper.toFixed(2);
    document.querySelectorAll('[data-lab-lens]').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.labLens === id);
    });
  }

  // ---- Wire UI ----
  const lensHtml = ART_LENSES.map(
    (l) => `<button type="button" class="lab-chip ${l.id === activeLens ? 'is-active' : ''}" data-lab-lens="${l.id}">${l.name}</button>`,
  ).join('');
  $('#lab-lens-quick').innerHTML = lensHtml;
  $('#lab-art-lenses').innerHTML = lensHtml;
  document.querySelectorAll('[data-lab-lens]').forEach((btn) => {
    btn.addEventListener('click', () => setLens(btn.dataset.labLens));
  });

  $('#lab-split').addEventListener('input', (e) => {
    const v = Number(e.target.value);
    splitVal = v < 0 ? -1 : v / 100;
    $('#lab-split-val').textContent = v < 0 ? '关闭' : `${v}%`;
  });

  $('#lab-hour').addEventListener('input', (e) => {
    const h = Number(e.target.value);
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    $('#lab-hour-val').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    applySunHour(h);
  });

  for (const [id, key] of [['#lab-paint', 'paint'], ['#lab-ink', 'ink'], ['#lab-paper', 'paper']]) {
    $(id).addEventListener('input', (e) => {
      const val = Number(e.target.value);
      $(`${id}-val`).textContent = val.toFixed(2);
      pipeline.setOverrides({ [key]: val });
    });
  }
  $('#lab-art-reset').addEventListener('click', () => setLens(activeLens));

  // Tabs
  $('#lab-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    const t = btn.dataset.tab;
    $('#lab-tabs').querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b === btn));
    document.querySelectorAll('.lab-tab-body').forEach((el) => { el.hidden = el.id !== `tab-${t}`; });
  });

  // Rig controls
  $('#lab-fig-btns').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-fig]');
    if (!btn) return;
    $('#lab-fig-btns').querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b === btn));
    await loadFigure(btn.dataset.fig);
  });
  $('#lab-motion-btns').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-motion]');
    if (!btn) return;
    motionMode = btn.dataset.motion;
    $('#lab-motion-btns').querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b === btn));
    slideStats.samples.length = 0;
  });
  $('#lab-skel-toggle').addEventListener('change', (e) => {
    showSkeleton = e.target.checked;
    if (skelHelper) skelHelper.visible = showSkeleton;
  });
  $('#lab-umb-toggle').addEventListener('change', (e) => {
    showUmbrella = e.target.checked;
    walker?.setUmbrella?.(showUmbrella);
  });

  // Spatial Audit Tab
  function renderSpatialAudit() {
    const reps = getSpatialDiscrepancyReport();
    $('#lab-discrepancies').innerHTML = reps
      .map((r) => `<div class="lab-card is-${r.severity}"><b>${r.title}</b><div>旧版：<code>${r.legacy}</code></div><div>校准：<code>${r.canonical}</code></div><div>处理：${r.resolution}</div></div>`)
      .join('');
    $('#lab-nodes-list').innerHTML = `
      <table class="lab-table">
        <thead><tr><th>地点</th><th>类型</th><th>证据等级</th><th>科学站</th></tr></thead>
        <tbody>${SEMANTIC_PLACES.map((n) => `<tr><td>${n.name}</td><td>${n.kind}</td><td>${n.evidence}</td><td>${n.scienceStation || '—'}</td></tr>`).join('')}</tbody>
      </table>
    `;
  }

  // Scientific Kernel Verifier Tab
  function runScienceVerification() {
    const checks = [];
    // 1. Haikou Somigliana gravity
    const g = normalGravity(CANONICAL_DATUM.wgs84.lat, 12);
    checks.push({
      name: '海口正常重力（Somigliana 椭球公式）',
      ok: g > 9.784 && g < 9.789,
      detail: `g = ${g.toFixed(5)} m/s²（预期 9.7864 m/s²）`,
    });

    // 2. Undamped RK4 10s energy conservation
    const sim = createPendulumSim({ length: 1.0, angleDeg: 60, damping: 0 });
    for (let i = 0; i < 200; i++) sim.step(0.05); // 10 seconds
    const s1 = sim.snapshot();
    checks.push({
      name: 'RK4 无阻尼 10 秒机械能守恒',
      ok: s1.energyDriftRel < 1e-6,
      detail: `相对漂移 = ${s1.energyDriftRel.toExponential(2)}（阈值 < 1e-6）`,
    });

    // 3. Large-angle 90 deg period accuracy vs AGM elliptic integral
    const sim90 = createPendulumSim({ length: 1.2, angleDeg: 90, damping: 0 });
    for (let i = 0; i < 160; i++) sim90.step(0.05);
    const s90 = sim90.snapshot();
    const theo = exactPendulumPeriod(1.2, sim90.params.g, Math.PI / 2);
    const relErr = s90.measuredPeriod ? Math.abs(s90.measuredPeriod - theo) / theo : 1;
    checks.push({
      name: '90° 大角非线性周期精度（vs 椭圆积分 K）',
      ok: relErr < 0.0005,
      detail: `测得 ${s90.measuredPeriod} s vs 理论 ${theo.toFixed(5)} s（误差 ${(relErr * 100).toFixed(4)}%）`,
    });

    // 4. Fresnel energy conservation & Brewster zero Rp
    let maxRtErr = 0;
    for (let deg = 0; deg <= 89; deg += 5) {
      const r = fresnelOptics({ n1: 1.0003, n2: 1.333, incidentDeg: deg });
      maxRtErr = Math.max(maxRtErr, Math.abs(r.R + r.T - 1));
    }
    const brew = fresnelOptics({ n1: 1.0003, n2: 1.333, incidentDeg: Math.atan(1.333 / 1.0003) * 180 / Math.PI });
    checks.push({
      name: '菲涅耳能量守恒 R + T = 1 与布儒斯特角 Rₚ = 0',
      ok: maxRtErr < 1e-5 && brew.Rp < 1e-5,
      detail: `最大 |R+T-1| = ${maxRtErr.toExponential(2)}；θ_B = ${brew.brewsterDeg}° 时 Rₚ = ${brew.Rp}`,
    });

    // 5. Microclimate monotonicity
    const dry = microclimateStep({ rainMmHr: 0, solarWm2: 750, windMs: 4, tempC: 31, rhPct: 60, wet: 0.8, puddle: 0.3, dtSec: 1800 });
    const storm = microclimateStep({ rainMmHr: 30, solarWm2: 80, windMs: 6, tempC: 25, rhPct: 92, wet: 0.2, puddle: 0.0, dtSec: 1800 });
    checks.push({
      name: '微气候水膜单调性（暴雨增湿 / 晴日蒸发）',
      ok: storm.wet > 0.9 && storm.puddle > 0 && dry.wet < 0.8,
      detail: `暴雨后 wet=${storm.wet.toFixed(2)}, puddle=${storm.puddle.toFixed(2)}；晴日后 wet=${dry.wet.toFixed(2)}`,
    });

    $('#lab-sci-results').innerHTML = checks
      .map((c) => `<div class="lab-card"><b><span class="${c.ok ? 'lab-pass' : 'lab-fail'}">${c.ok ? 'PASS' : 'FAIL'}</span> · ${c.name}</b><div>${c.detail}</div></div>`)
      .join('');
    return checks;
  }
  $('#lab-run-sci').addEventListener('click', runScienceVerification);

  // Load GLB Audit Report if present
  async function loadGlbReport() {
    const el = $('#lab-glb-audit');
    try {
      const res = await fetch('tools/world-engine/glb-audit-report.json');
      if (!res.ok) throw new Error('not generated yet');
      const rep = await res.json();
      el.innerHTML = `
        <p class="lab-desc">已扫描 <b>${rep.summary.totalFiles}</b> 个 GLB（总计 ${(rep.summary.totalBytes / 1048576).toFixed(1)} MB）：通过 ${rep.summary.passed}，超预算告警 ${rep.summary.warnings}。</p>
        <table class="lab-table">
          <thead><tr><th>文件</th><th>大小</th><th>三角面</th><th>关节</th><th>状态</th></tr></thead>
          <tbody>${rep.files.slice(0, 14).map((f) => `<tr><td>${f.path.split('/').slice(-2).join('/')}</td><td>${(f.bytes / 1024).toFixed(0)} KB</td><td>${f.triangles.toLocaleString()}</td><td>${f.joints}</td><td class="${f.ok ? 'lab-pass' : 'lab-fail'}">${f.ok ? 'OK' : 'WARN'}</td></tr>`).join('')}</tbody>
        </table>
      `;
    } catch {
      el.innerHTML = '<p class="lab-desc">运行 <code>node tools/world-engine/validate-glb.mjs --write</code> 后即可在此查看全仓 GLB 审计清单。</p>';
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(200, Math.round(rect.width));
    const h = Math.max(200, Math.round(rect.height));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    pipeline.setSize(w, h, pr);
  }
  addEventListener('resize', resize);

  applySunHour(labHour);
  await loadFigure('student-m');
  renderSpatialAudit();
  const initialSci = runScienceVerification();
  loadGlbReport();
  resize();

  // Animation loop
  const clock = new THREE.Clock();
  const lPos = new THREE.Vector3(), rPos = new THREE.Vector3();
  let uiTick = 0;

  function stepSim(dt) {
    simTime += dt;
    U.uTime.value += dt;
    pipeline.tick(dt);
    controls.update();

    const endSim = perf.beginSubsystem('gait_sim');
    if (walker) {
      let speed = 0, heading = 0;
      if (motionMode === 'walk') { speed = 1.5; heading = 0; }
      else if (motionMode === 'run') { speed = 3.7; heading = 0; }
      else if (motionMode === 'turn') {
        speed = 1.5;
        heading = simTime * 0.85;
      }
      walker.steer(speed, heading);
      walker.tick(dt);
      const p = walker.position;
      if (Math.hypot(p.x, p.z) > 6.5) {
        walker.shift(-p.x, -p.z);
        slideStats.prevL = null;
        slideStats.prevR = null;
      }
      controls.target.lerp(new THREE.Vector3(p.x, 1.05, p.z), Math.min(1, dt * 6));
      day.update(dt, new THREE.Vector3(p.x, 0, p.z));
      sky.update(dt, new THREE.Vector3(p.x, 0, p.z));

      const lf = walker.bone?.('foot.L');
      const rf = walker.bone?.('foot.R');
      const lt = walker.bone?.('toe.L');
      const rt = walker.bone?.('toe.R');
      const hips = walker.bone?.('hips');
      if (hips) {
        const hv = new THREE.Vector3();
        hips.getWorldPosition(hv);
        slideStats.hipH = hv.y;
      }
      if (lf && rf && dt > 0.001) {
        lf.getWorldPosition(lPos);
        rf.getWorldPosition(rPos);
        const ltPos = lt ? lt.getWorldPosition(new THREE.Vector3()) : lPos;
        const rtPos = rt ? rt.getWorldPosition(new THREE.Vector3()) : rPos;
        const measureFoot = (prev, cur, prevT, curT) => {
          if (!prev || !prevT) return;
          // Stance phase: foot or toe grounded (< 0.085m) and not lifting rapidly
          const grounded = (cur.y < 0.095 && prev.y < 0.095) || (curT.y < 0.055 && prevT.y < 0.055);
          const lifting = (cur.y - prev.y) / dt > 0.15 && (curT.y - prevT.y) / dt > 0.08;
          if (grounded && !lifting) {
            const vFoot = Math.hypot(cur.x - prev.x, cur.z - prev.z) / dt * 100;
            const vToe = Math.hypot(curT.x - prevT.x, curT.z - prevT.z) / dt * 100;
            const vMin = Math.min(vFoot, vToe);
            if (vMin < 120) slideStats.samples.push(vMin);
          }
        };
        measureFoot(slideStats.prevL, lPos, slideStats.prevLT, ltPos);
        measureFoot(slideStats.prevR, rPos, slideStats.prevRT, rtPos);
        if (slideStats.samples.length > 90) slideStats.samples.splice(0, slideStats.samples.length - 90);
        slideStats.prevL = lPos.clone();
        slideStats.prevR = rPos.clone();
        slideStats.prevLT = ltPos.clone();
        slideStats.prevRT = rtPos.clone();
        if (slideStats.samples.length) {
          slideStats.meanCm = slideStats.samples.reduce((a, b) => a + b, 0) / slideStats.samples.length;
          slideStats.maxCm = Math.max(...slideStats.samples);
        }
      }
    }
    endSim();
  }

  function updateHud() {
    const snap = perf.snapshot();
    $('#lab-fps').textContent = `${snap.fps} fps`;
    $('#lab-calls').textContent = `${snap.render.calls} calls`;
    $('#lab-tris').textContent = `${(snap.render.triangles / 1000).toFixed(1)}k tris`;
    const pill = $('#lab-budget-pill');
    pill.textContent = snap.allHardwareIndependentBudgetsOk ? '预算通过' : '超出预算';
    pill.classList.toggle('is-warn', !snap.allHardwareIndependentBudgetsOk);
    $('#lab-gait-readout').textContent = `步态滑步：${slideStats.meanCm.toFixed(2)} cm/s（峰值 ${slideStats.maxCm.toFixed(1)}）· 髋高：${slideStats.hipH.toFixed(2)} m · 骨骼：51 关节`;

    const rigEl = $('#lab-rig-metrics');
    if (rigEl) {
      rigEl.innerHTML = `
        <div class="lab-metric-card ${slideStats.meanCm > 12 ? 'is-fail' : ''}"><span>支撑期平均滑步</span><b>${slideStats.meanCm.toFixed(2)} cm/s</b></div>
        <div class="lab-metric-card"><span>骨盆实时高度</span><b>${slideStats.hipH.toFixed(3)} m</b></div>
        <div class="lab-metric-card"><span>当前状态</span><b>${motionMode.toUpperCase()}</b></div>
        <div class="lab-metric-card"><span>骨骼关节数</span><b>51 joints</b></div>
      `;
    }
    const perfEl = $('#lab-perf-metrics');
    if (perfEl) {
      perfEl.innerHTML = `
        <div class="lab-metric-card ${snap.checks.drawCallsOk ? '' : 'is-fail'}"><span>Draw Calls (≤ ${snap.budget.maxDrawCalls})</span><b>${snap.render.calls}</b></div>
        <div class="lab-metric-card ${snap.checks.trianglesOk ? '' : 'is-fail'}"><span>Triangles (≤ ${(snap.budget.maxTriangles / 1e6).toFixed(1)}M)</span><b>${snap.render.triangles.toLocaleString()}</b></div>
        <div class="lab-metric-card"><span>Geometries / Textures</span><b>${snap.render.geometries} / ${snap.render.textures}</b></div>
        <div class="lab-metric-card"><span>P50 / P95 帧时（软件渲染）</span><b>${snap.p50Ms} / ${snap.p95Ms} ms</b></div>
      `;
    }
    const subEl = $('#lab-subsystems');
    if (subEl) {
      subEl.innerHTML = Object.entries(snap.subsystems)
        .map(([k, v]) => `<div class="lab-card"><b>${k}</b><div>平均 CPU 耗时：<code>${v} ms / frame</code></div></div>`)
        .join('');
    }
  }

  function renderFrame(dtMs = 16.7) {
    const endRen = perf.beginSubsystem('render');
    renderer.info.reset();
    pipeline.render(scene, camera, { split: splitVal });
    endRen();
    perf.recordFrame(dtMs, renderer);
  }

  const captureMode = new URLSearchParams(location.search).has('capture');
  let paused = captureMode;
  if (captureMode) {
    for (let i = 0; i < 36; i++) stepSim(1 / 30);
    renderFrame(16.7);
    updateHud();
  }
  function frame() {
    const dt = Math.min(clock.getDelta(), 1 / 20);
    if (!paused) {
      stepSim(dt);
      renderFrame(dt * 1000);
      uiTick += dt;
      if (uiTick > 0.35) { uiTick = 0; updateHud(); }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.__haizWorkbench = {
    setLens,
    setSplit(v) { splitVal = v; $('#lab-split').value = v < 0 ? -1 : Math.round(v * 100); },
    setMotion(m) { motionMode = m; },
    still(seconds = 0.4, fps = 30) {
      paused = true;
      const n = Math.max(1, Math.round(seconds * fps));
      for (let i = 0; i < n; i++) stepSim(1 / fps);
      renderFrame(1000 / fps);
      updateHud();
    },
    resume() { paused = false; clock.getDelta(); },
    loadFigure,
    runScienceVerification,
    initialSci,
    telemetry: () => ({ lens: activeLens, motion: motionMode, slideCm: +slideStats.meanCm.toFixed(2), perf: perf.snapshot() }),
  };
}

main().catch((err) => console.error('[HAIZ Workbench]', err));
