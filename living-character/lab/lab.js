import * as THREE from 'three';
import { LivingCharacterAgent } from '../engine/motion-engine.js';
import { createCharacterInstance, loadMotionPack } from '../engine/character-factory.js';
import { createCharacterShaderUniforms } from '../engine/painterly-shader.js';
import { buildLabTerrainStage } from './terrains.js';
import { LabDebugOverlay } from './debug-overlay.js';
import { createLegacyTrack } from './comparators.js';

const params = new URLSearchParams(window.location.search);

const canvas = document.getElementById('lab-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeae4d8);
scene.fog = new THREE.Fog(0xeae4d8, 28, 72);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 150);
camera.position.set(2.4, 1.45, 3.2);

const controls = {
  enabled: false,
  target: new THREE.Vector3(0, 0.92, 0),
  yaw: 0.7,
  pitch: 0.25,
  dist: 3.9,
  dragging: false,
  px: 0,
  py: 0,
  update() {
    const cy = Math.cos(this.pitch) * this.dist;
    camera.position.set(
      this.target.x + Math.sin(this.yaw) * cy,
      this.target.y + Math.sin(this.pitch) * this.dist,
      this.target.z + Math.cos(this.yaw) * cy
    );
    camera.lookAt(this.target);
  },
};

renderer.domElement.addEventListener('pointerdown', (e) => {
  controls.dragging = true;
  controls.px = e.clientX;
  controls.py = e.clientY;
});
window.addEventListener('pointermove', (e) => {
  if (!controls.dragging) return;
  if (state.cameraPreset !== 'orbit') {
    state.cameraPreset = 'orbit';
    const sel = document.getElementById('sel-camera');
    if (sel) sel.value = 'orbit';
  }
  controls.yaw -= (e.clientX - controls.px) * 0.008;
  controls.pitch = Math.max(-0.2, Math.min(1.25, controls.pitch + (e.clientY - controls.py) * 0.006));
  controls.px = e.clientX;
  controls.py = e.clientY;
});
window.addEventListener('pointerup', () => { controls.dragging = false; });
renderer.domElement.addEventListener('wheel', (e) => {
  controls.dist = Math.max(1.2, Math.min(14, controls.dist * (1 + e.deltaY * 0.001)));
}, { passive: true });

// Clean editorial tropical daylight setup
const hemiLight = new THREE.HemisphereLight(0xf6f8fc, 0xb8aa94, 0.92);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfff4de, 2.25);
sunLight.position.set(8, 14, 9);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 45;
const d = 12;
sunLight.shadow.camera.left = -d;
sunLight.shadow.camera.right = d;
sunLight.shadow.camera.top = d;
sunLight.shadow.camera.bottom = -d;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);
scene.add(sunLight.target);

const shaderUniforms = createCharacterShaderUniforms();
const terrain = buildLabTerrainStage(scene);
const debugOverlay = new LabDebugOverlay(scene, document.getElementById('lab-chart'));

const state = {
  ready: false,
  mode: params.get('mode') === 'compare' ? 'compare' : 'solo', // 'solo' | 'compare'
  archetype: params.get('char') || 'student_hero',
  bags: params.get('bags') || 'both',
  lens: params.get('lens') === 'gouache' ? 1 : 0,
  terrain: params.get('terrain') || 'flat',
  scenario: params.get('scenario') || 'auto_showcase',
  cameraPreset: params.get('cam') || 'three_quarter',
  playing: true,
  speedScale: Number(params.get('rate') || 1),
  debugVisible: false,
  simTime: 0,
  scenarioTime: 0,
  keys: new Set(),
};

let motionPack = null;
let heroAgent = null;
let compareTracks = null; // { claude, r2 }
const groundHitTmp = { point: new THREE.Vector3(), normal: new THREE.Vector3(0, 1, 0), distance: 0 };

function queryHeightAt(x, z) {
  const ok = terrain.groundDetector.castDown(new THREE.Vector3(x, 8, z), 20, groundHitTmp);
  return ok ? groundHitTmp.point.y : 0;
}

function getBagFlags(bagMode) {
  return {
    backpack: bagMode === 'both' || bagMode === 'backpack',
    crossbody: bagMode === 'both' || bagMode === 'crossbody',
  };
}

async function rebuildHero(archetype) {
  if (heroAgent) {
    scene.remove(heroAgent.model);
  }
  const bags = getBagFlags(state.bags);
  const inst = await createCharacterInstance({
    archetype,
    lod: 'lod0',
    shaderUniforms,
    showBackpack: bags.backpack,
    showCrossbody: bags.crossbody,
  });
  heroAgent = new LivingCharacterAgent({
    ...inst,
    groundDetector: terrain.groundDetector,
    motionPack,
    shaderUniforms,
  });
  scene.add(heroAgent.model);
  resetScenario();
}

async function ensureCompareTracks() {
  if (compareTracks) return compareTracks;
  const [claude, r2] = await Promise.all([
    createLegacyTrack('claude', { scene, heightAt: queryHeightAt, xOffset: -2.2 }),
    createLegacyTrack('r2', { scene, heightAt: queryHeightAt, xOffset: 0 }),
  ]);
  compareTracks = { claude, r2 };
  return compareTracks;
}

function resetScenario() {
  state.scenarioTime = 0;
  let startZ = -3.0;
  let startHeading = 0;

  if (state.scenario === 'stairs_demo' || state.terrain === 'stairs') {
    terrain.setTerrainMode('stairs');
    startZ = -0.5;
  } else if (state.scenario === 'slopes_demo' || state.terrain === 'slopes') {
    terrain.setTerrainMode('slopes');
    startZ = 9.0;
  } else if (state.terrain === 'course') {
    terrain.setTerrainMode('course');
    startZ = -1.2;
  } else {
    terrain.setTerrainMode(state.terrain);
    startZ = state.scenario === 'idle' ? 0 : -4.0;
  }

  const xHero = state.mode === 'compare' ? 2.2 : 0;
  const yHero = queryHeightAt(xHero, startZ);
  if (heroAgent) {
    heroAgent.setStrafe(false, 0);
    heroAgent.setPosition(xHero, yHero, startZ, startHeading);
  }
  if (compareTracks) {
    const isCmp = state.mode === 'compare';
    compareTracks.claude.setVisible(isCmp);
    compareTracks.r2.setVisible(isCmp);
    if (isCmp) {
      compareTracks.claude.reset(-2.2, startZ, startHeading);
      compareTracks.r2.reset(0, startZ, startHeading);
    }
  }
}

function computeScenarioCommand(t) {
  // Keyboard manual override takes priority if any WASD / arrow key is pressed
  const k = state.keys;
  let kx = 0;
  let kz = 0;
  if (k.has('KeyW') || k.has('ArrowUp')) kz -= 1;
  if (k.has('KeyS') || k.has('ArrowDown')) kz += 1;
  if (k.has('KeyA') || k.has('ArrowLeft')) kx -= 1;
  if (k.has('KeyD') || k.has('ArrowRight')) kx += 1;
  if (kx !== 0 || kz !== 0) {
    const moveHeading = Math.atan2(kx, kz);
    const run = k.has('ShiftLeft') || k.has('ShiftRight');
    const strafe = k.has('AltLeft') || k.has('AltRight');
    return {
      speed: run ? 4.35 : 1.45,
      heading: moveHeading,
      strafe,
      aimHeading: 0,
    };
  }

  switch (state.scenario) {
    case 'idle':
      return { speed: 0, heading: Math.sin(t * 0.45) * 0.42, strafe: false, aimHeading: 0 };
    case 'walk_slow':
      return { speed: 0.85, heading: Math.sin(t * 0.25) * 0.12, strafe: false, aimHeading: 0 };
    case 'walk_normal':
      return { speed: 1.42, heading: 0, strafe: false, aimHeading: 0 };
    case 'jog':
      return { speed: 3.05, heading: 0, strafe: false, aimHeading: 0 };
    case 'run':
      return { speed: 4.55, heading: 0, strafe: false, aimHeading: 0 };
    case 'start_stop': {
      const cyc = t % 6.0;
      const spd = cyc < 1.2 ? 0 : cyc < 4.0 ? 1.45 : 0;
      return { speed: spd, heading: 0, strafe: false, aimHeading: 0 };
    }
    case 'turn_cascade': {
      const cyc = t % 9.0;
      let spd = 0;
      let hdg = 0;
      if (cyc < 1.5) { spd = 0; hdg = 0; }
      else if (cyc < 3.4) { spd = 0; hdg = Math.PI * 0.5; } // 90 deg idle pivot cascade
      else if (cyc < 5.6) { spd = 1.45; hdg = Math.PI * 0.5; } // walk
      else if (cyc < 7.8) { spd = 1.45; hdg = -Math.PI * 0.5; } // 180 deg Brake-Plant-Pivot reversal!
      else { spd = 0; hdg = 0; }
      return { speed: spd, heading: hdg, strafe: false, aimHeading: 0 };
    }
    case 'diagonal_strafe': {
      const side = Math.floor(t / 3.5) % 2 === 0 ? 0.82 : -0.82;
      return { speed: 1.35, heading: side, strafe: true, aimHeading: 0 };
    }
    case 'stairs_demo': {
      const spd = heroAgent && heroAgent.human.position.z > 9.3 ? 0 : 1.35;
      return { speed: spd, heading: 0, strafe: false, aimHeading: 0 };
    }
    case 'slopes_demo': {
      const spd = heroAgent && heroAgent.human.position.z > 23.0 ? 0 : 1.42;
      return { speed: spd, heading: 0, strafe: false, aimHeading: 0 };
    }
    case 'auto_showcase':
    default: {
      const cyc = t % 16.0;
      if (cyc < 2.2) return { speed: 0, heading: 0.35, strafe: false, aimHeading: 0 };
      if (cyc < 6.2) return { speed: 1.42, heading: 0, strafe: false, aimHeading: 0 };
      if (cyc < 9.2) return { speed: 3.05, heading: Math.sin((cyc - 6.2) * 0.8) * 0.35, strafe: false, aimHeading: 0 };
      if (cyc < 12.6) return { speed: 1.42, heading: Math.PI, strafe: false, aimHeading: 0 }; // 180° turnaround back toward start
      return { speed: 0, heading: 0, strafe: false, aimHeading: 0 };
    }
  }
}

function stepSimulation(rawDt) {
  if (!heroAgent) return;
  const dt = Math.min(rawDt, 0.05) * state.speedScale;
  if (dt <= 0) return;

  state.simTime += dt;
  state.scenarioTime += dt;
  shaderUniforms.uTime.value = state.simTime;

  const cmd = computeScenarioCommand(state.scenarioTime);
  heroAgent.setStrafe(cmd.strafe, cmd.aimHeading);
  heroAgent.setMoveTarget(cmd.speed, cmd.heading);
  heroAgent.step(dt);

  if (state.mode === 'compare' && compareTracks) {
    compareTracks.claude.step(dt, cmd.speed, cmd.heading);
    compareTracks.r2.step(dt, cmd.speed, cmd.heading);
  }

  // Loop back cleanly on pure straight demos when passing far end
  if ((state.scenario === 'walk_normal' || state.scenario === 'jog' || state.scenario === 'run') &&
      heroAgent.human.position.z > 16) {
    resetScenario();
  }
}

function updateCamera(dt) {
  if (!heroAgent) return;
  const targetCenter = new THREE.Vector3();
  if (state.mode === 'compare') {
    targetCenter.set(0, heroAgent.human.position.y + 0.92, heroAgent.human.position.z);
  } else {
    targetCenter.set(heroAgent.human.position.x, heroAgent.human.position.y + 0.92, heroAgent.human.position.z);
  }

  // Move directional sun shadow frustum with character
  sunLight.position.set(targetCenter.x + 8, targetCenter.y + 13, targetCenter.z + 9);
  sunLight.target.position.copy(targetCenter);

  if (state.cameraPreset === 'orbit') {
    controls.enabled = true;
    controls.target.lerp(targetCenter, 1 - Math.exp(-Math.max(dt, 0.016) * 8));
    controls.update();
    return;
  }

  controls.enabled = false;
  const distScale = state.mode === 'compare' ? 2.25 : 1.0;
  const desiredPos = new THREE.Vector3();
  const h = state.mode === 'compare' ? 0 : heroAgent.human.heading;

  switch (state.cameraPreset) {
    case 'side':
      desiredPos.set(targetCenter.x + 3.4 * distScale, targetCenter.y + 0.05, targetCenter.z);
      break;
    case 'front':
      desiredPos.set(targetCenter.x + Math.sin(h) * 3.1 * distScale, targetCenter.y + 0.08, targetCenter.z + Math.cos(h) * 3.1 * distScale);
      break;
    case 'back':
      desiredPos.set(targetCenter.x - Math.sin(h) * 2.6 * distScale, targetCenter.y + 0.25, targetCenter.z - Math.cos(h) * 2.6 * distScale);
      break;
    case 'low_foot':
      desiredPos.set(targetCenter.x + 1.85 * distScale, heroAgent.human.position.y + 0.24, targetCenter.z + 0.45);
      targetCenter.y = heroAgent.human.position.y + 0.26;
      break;
    case 'three_quarter':
    default:
      desiredPos.set(targetCenter.x + 2.45 * distScale, targetCenter.y + 0.42, targetCenter.z + 2.65 * distScale);
      break;
  }

  const k = 1 - Math.exp(-Math.max(dt, 0.016) * 8);
  camera.position.lerp(desiredPos, k);
  controls.target.lerp(targetCenter, k);
  camera.lookAt(controls.target);
}

function updateDebugHUD() {
  if (!state.debugVisible || !heroAgent) return;
  const diag = debugOverlay.update(heroAgent);
  if (!diag) return;
  document.getElementById('m-speed').textContent = `${diag.speed.toFixed(2)} / ${diag.targetSpeed.toFixed(2)} m/s`;
  document.getElementById('m-left').textContent = `${diag.leftPhase} · ${diag.leftSlideMmS.toFixed(1)} mm/s`;
  document.getElementById('m-right').textContent = `${diag.rightPhase} · ${diag.rightSlideMmS.toFixed(1)} mm/s`;
  document.getElementById('m-p95').textContent = `${diag.penetrationMaxMm.toFixed(1)} mm · ${diag.slideP95MmS.toFixed(1)} mm/s`;
  document.getElementById('m-cascade').textContent = `${diag.turnCascade.mode} · ${diag.turnCascade.deltaDeg.toFixed(0)}°`;
  document.getElementById('m-leads').textContent = `${diag.turnCascade.headYawDeg.toFixed(0)}° / ${diag.turnCascade.neckYawDeg.toFixed(0)}° / ${diag.turnCascade.chestYawDeg.toFixed(0)}°`;
  document.getElementById('m-bank').textContent = `${diag.turnCascade.bankDeg.toFixed(1)}°`;
}

// UI Bindings
function bindUI() {
  const btnSolo = document.getElementById('btn-mode-solo');
  const btnCmp = document.getElementById('btn-mode-compare');
  const cmpLabels = document.getElementById('lab-cmp-labels');

  const syncModeUI = async () => {
    btnSolo.classList.toggle('active', state.mode === 'solo');
    btnCmp.classList.toggle('active', state.mode === 'compare');
    cmpLabels.classList.toggle('visible', state.mode === 'compare');
    if (state.mode === 'compare') {
      await ensureCompareTracks();
    }
    resetScenario();
  };

  btnSolo.addEventListener('click', () => { state.mode = 'solo'; syncModeUI(); });
  btnCmp.addEventListener('click', () => { state.mode = 'compare'; syncModeUI(); });

  document.getElementById('sel-archetype').addEventListener('change', async (e) => {
    state.archetype = e.target.value;
    await rebuildHero(state.archetype);
  });

  document.getElementById('sel-bags').addEventListener('change', (e) => {
    state.bags = e.target.value;
    if (heroAgent) heroAgent.setAccessories(getBagFlags(state.bags));
  });

  const btnLens = document.getElementById('btn-lens');
  btnLens.addEventListener('click', () => {
    state.lens = state.lens === 0 ? 1 : 0;
    shaderUniforms.uLensMode.value = state.lens;
    btnLens.textContent = state.lens === 1 ? '画境：入画水粉' : '画境：南海晴光';
    btnLens.classList.toggle('active', state.lens === 1);
  });

  const btnDebug = document.getElementById('btn-debug');
  const debugPanel = document.getElementById('lab-debug-panel');
  btnDebug.addEventListener('click', () => {
    state.debugVisible = !state.debugVisible;
    btnDebug.classList.toggle('active', state.debugVisible);
    debugPanel.classList.toggle('open', state.debugVisible);
    debugOverlay.setVisible(state.debugVisible);
  });

  document.getElementById('sel-terrain').addEventListener('change', (e) => {
    state.terrain = e.target.value;
    resetScenario();
  });

  document.getElementById('sel-scenario').addEventListener('change', (e) => {
    state.scenario = e.target.value;
    resetScenario();
  });

  document.getElementById('sel-camera').addEventListener('change', (e) => {
    state.cameraPreset = e.target.value;
    updateCamera(0.1);
  });

  const btnPlay = document.getElementById('btn-play');
  btnPlay.addEventListener('click', () => {
    state.playing = !state.playing;
    btnPlay.classList.toggle('active', state.playing);
  });

  document.getElementById('btn-step').addEventListener('click', () => {
    state.playing = false;
    btnPlay.classList.remove('active');
    stepSimulation(1 / 60);
    updateCamera(1 / 60);
    updateDebugHUD();
    renderer.render(scene, camera);
  });

  document.querySelectorAll('.speed-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.speedScale = Number(btn.dataset.scale);
      document.querySelectorAll('.speed-btn').forEach((b) => b.classList.toggle('active', b === btn));
    });
  });

  window.addEventListener('keydown', (e) => {
    state.keys.add(e.code);
    if (e.code === 'Space' && heroAgent) heroAgent.jump();
  });
  window.addEventListener('keyup', (e) => state.keys.delete(e.code));
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// Automation API for closed-loop capture, metrics & video recording
window.__HAIZ_LAB__ = {
  isReady: () => state.ready,
  setMode: async (m) => {
    state.mode = m === 'compare' ? 'compare' : 'solo';
    document.getElementById('btn-mode-solo').classList.toggle('active', state.mode === 'solo');
    document.getElementById('btn-mode-compare').classList.toggle('active', state.mode === 'compare');
    document.getElementById('lab-cmp-labels').classList.toggle('visible', state.mode === 'compare');
    if (state.mode === 'compare') await ensureCompareTracks();
    resetScenario();
  },
  setTerrain: (t) => { state.terrain = t; document.getElementById('sel-terrain').value = t; resetScenario(); },
  setScenario: (s) => { state.scenario = s; document.getElementById('sel-scenario').value = s; resetScenario(); },
  setCamera: (c) => { state.cameraPreset = c; document.getElementById('sel-camera').value = c; updateCamera(1.0); },
  setSpeedScale: (r) => { state.speedScale = Number(r); },
  setPlaying: (p) => { state.playing = Boolean(p); },
  setLens: (l) => { state.lens = l ? 1 : 0; shaderUniforms.uLensMode.value = state.lens; },
  setBags: (b) => { state.bags = b; if (heroAgent) heroAgent.setAccessories(getBagFlags(b)); },
  setArchetype: async (a) => { state.archetype = a; await rebuildHero(a); },
  setDebug: (v) => {
    state.debugVisible = Boolean(v);
    document.getElementById('lab-debug-panel').classList.toggle('open', state.debugVisible);
    debugOverlay.setVisible(state.debugVisible);
  },
  stepFixed: (dt = 1 / 60) => {
    stepSimulation(dt);
    updateCamera(dt);
    updateDebugHUD();
    renderer.render(scene, camera);
  },
  getMetrics: () => (heroAgent ? heroAgent.getDiagnosticState() : null),
  getCompareMetrics: () => ({
    claude: compareTracks?.claude?.getSummary() ?? null,
    r2: compareTracks?.r2?.getSummary() ?? null,
    r3: heroAgent ? { ...heroAgent.getDiagnosticState(), ...heroAgent.telemetry.summary() } : null,
  }),
  getRenderInfo: () => ({
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
  }),
};

let prevNow = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - prevNow) / 1000, 0.05);
  prevNow = now;
  if (state.ready) {
    if (state.playing) stepSimulation(dt);
    updateCamera(dt);
    updateDebugHUD();
  }
  renderer.render(scene, camera);
}

async function init() {
  bindUI();
  motionPack = await loadMotionPack('./living-character/assets/motion/haiz-motion-pack.json');
  await rebuildHero(state.archetype);
  if (state.mode === 'compare') {
    await ensureCompareTracks();
    resetScenario();
  }
  updateCamera(1.0);
  state.ready = true;
  document.getElementById('lab-loading').classList.add('hidden');
  requestAnimationFrame(animate);
}

init();
