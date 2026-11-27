/**
 * HAIZ · Round 3 Living Campus Runtime Entry.
 * Reuses Round 2's reconstructed campus districts, spatial navigation, atmosphere,
 * HDR IBL, and HUD unmodified while upgrading Player & 6 Living Citizens to R3
 * biomechanically grounded characters.
 */
import * as THREE from 'three';
import { WorldRuntime } from '../../world-reconstruction-r2/engine/core/runtime.js';
import { CampusSpatial } from '../../world-reconstruction-r2/engine/core/collision.js';
import { CampusAtmosphere } from '../../world-reconstruction-r2/engine/atmosphere/environment.js';
import { loadHdrEnvironment } from '../../world-reconstruction-r2/engine/atmosphere/rgbe-loader.js';
import { DistrictManagerR2 } from '../../world-reconstruction-r2/engine/streaming/district-manager-r2.js';
import { CampusHUD, COMPARISON_VISTAS } from '../../world-reconstruction-r2/engine/ui/hud.js';
import { createCampusGroundDetector } from './terrain-adapter-r3.js';
import { PlayerControllerR3 } from './player-r3.js';
import { LivingCampusR3 } from './living-citizens-r3.js';

const Q = new URLSearchParams(location.search);
const isCoarse = matchMedia('(pointer: coarse)').matches || Q.get('touch') === '1' || window.innerWidth <= 720;
if (isCoarse) document.body.classList.add('wr-coarse');

const QUALITY_TIERS = {
  ultra: { pr: Math.min(window.devicePixelRatio || 1, 2.0), shadow: 2048, shadows: true },
  high: { pr: Math.min(window.devicePixelRatio || 1, 1.75), shadow: 2048, shadows: true },
  balanced: { pr: Math.min(window.devicePixelRatio || 1, 1.25), shadow: 1024, shadows: true },
  mobile: { pr: Math.min(window.devicePixelRatio || 1, 1.15), shadow: 1024, shadows: true },
};
const defaultQuality = QUALITY_TIERS[Q.get('quality')] ? Q.get('quality') : (isCoarse ? 'mobile' : 'high');

function setLoading(pct, msg) {
  const bar = document.querySelector('#wr-loading .wr-load-bar i');
  const sub = document.querySelector('#wr-loading .wr-load-sub');
  if (bar) bar.style.width = `${Math.round(pct * 100)}%`;
  if (sub && msg) sub.textContent = msg;
}

async function boot() {
  const repoRoot = new URL('../../', import.meta.url);
  const r2Root = new URL('world-reconstruction-r2/', repoRoot);

  setLoading(0.08, '正在载入海南中学府城校区 R2 建筑群与 R3 生命角色系统…');
  const [spec, instances] = await Promise.all([
    fetch(new URL('data/world_spec.json', r2Root)).then((r) => r.json()),
    fetch(new URL('data/instances_r2.json', r2Root)).then((r) => r.json()),
  ]);

  const canvas = document.getElementById('wr-canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isCoarse,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  let currentQuality = defaultQuality;
  const tier = QUALITY_TIERS[currentQuality];
  renderer.setPixelRatio(tier.pr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = tier.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.25, 2200);

  loadHdrEnvironment(new URL('assets/walk/textures/campus-light.hdr', repoRoot).href, renderer)
    .then((envRT) => {
      scene.environment = envRT.texture;
      if ('environmentIntensity' in scene) scene.environmentIntensity = 0.72;
    })
    .catch(() => {});

  const initialHour = Q.has('hour') ? Number(Q.get('hour')) : 16.65;
  const initialWx = Q.get('wx') || 'clear';
  const initialLens = Q.has('lens') ? Number(Q.get('lens')) : 0;
  const runtime = new WorldRuntime({ initialHour, initialWeather: initialWx, initialLens });
  const spatial = new CampusSpatial(spec);
  const atmosphere = new CampusAtmosphere(scene, renderer, { shadowSize: tier.shadow });
  atmosphere.setWeather(initialWx);
  atmosphere.setLens(initialLens);

  const districts = new DistrictManagerR2(scene, atmosphere, spec, {
    districtsBaseUrl: new URL('assets/districts/', r2Root).href,
    atelierBaseUrl: new URL('twin/assets/runtime/', repoRoot).href,
    dracoUrl: new URL('lanren/vendor/three/addons/libs/draco/', repoRoot).href,
    quality: currentQuality,
    onProgress: setLoading,
  });

  await districts.loadPriority0(instances);
  setLoading(0.76, '正在装配 HAIZ_LivingRig_v3 骨骼角色与步态控制器…');

  const groundDetector = createCampusGroundDetector(spatial);
  const buildingById = new Map(spec.buildings.map((b) => [b.id, b]));
  let hud = null;

  const living = new LivingCampusR3(scene, spatial, atmosphere, groundDetector, {
    onSpeak: (name, role, line) => hud?.showToast(name, role, line),
  });
  const [player] = await Promise.all([
    PlayerControllerR3.create(scene, camera, spatial, atmosphere, spec, groundDetector, {
      onBell: (pos) => living.onPlayerBell(pos),
    }),
    living.loadCitizens(),
  ]);

  hud = new CampusHUD(spec, {
    onVista: (vista) => player.flyToVista(vista),
    onLens: (lensIdx) => {
      runtime.setLens(lensIdx);
      atmosphere.setLens(lensIdx);
      player.setPlanAerial(lensIdx === 2);
      if ('environmentIntensity' in scene) {
        scene.environmentIntensity = lensIdx === 0 ? 0.72 : 0.42;
      }
    },
    onWeather: (wx) => { runtime.setWeather(wx); atmosphere.setWeather(wx); },
    onHour: (h) => runtime.setHour(h),
    onMode: (mode) => { runtime.setMode(mode); player.setMode(mode); },
    onQuality: (q) => {
      if (!QUALITY_TIERS[q]) return;
      currentQuality = q;
      const t = QUALITY_TIERS[q];
      renderer.setPixelRatio(t.pr);
      renderer.setSize(window.innerWidth, window.innerHeight);
      districts.setQuality(q);
    },
    onTeleport: (tx, tz) => player.teleport(tx, tz, player.yaw),
    onJoy: (jx, jy) => { player.joy.x = jx; player.joy.y = jy; },
    onTouchPrimary: () => {
      if (player.mode === 'bike') player.ringBell();
      else { player.keys.add('Space'); setTimeout(() => player.keys.delete('Space'), 240); }
    },
    onTouchSecondary: () => {
      if (player.mode === 'glide') { player.keys.add('KeyC'); setTimeout(() => player.keys.delete('KeyC'), 280); }
      else {
        const order = ['walk', 'bike', 'glide'];
        const next = order[(order.indexOf(player.mode) + 1) % order.length];
        player.setMode(next);
        hud.setActiveMode(next);
      }
    },
  });

  // Wire R3-specific quick controls (Bags cycle + Link to Lab)
  const bagBtn = document.getElementById('r3-btn-bags');
  const bagOrder = ['both', 'backpack', 'crossbody', 'none'];
  const bagLabels = { both: '包具：双包', backpack: '包具：双肩包', crossbody: '包具：斜挎包', none: '包具：无' };
  let bagIdx = 0;
  if (bagBtn) {
    bagBtn.addEventListener('click', () => {
      bagIdx = (bagIdx + 1) % bagOrder.length;
      const mode = bagOrder[bagIdx];
      player.setBags(mode);
      bagBtn.textContent = bagLabels[mode];
    });
  }

  hud.setActiveQuality(currentQuality);
  hud.setActiveMode('walk');
  hud.setActiveLens(initialLens);
  hud.setActiveWeather(initialWx);
  hud.updateClock(runtime.hour);

  const raycaster = new THREE.Raycaster();
  const ptrNdc = new THREE.Vector2();
  let ptrDownPos = null;

  canvas.addEventListener('pointerdown', (e) => {
    player.dragging = true;
    ptrDownPos = { x: e.clientX, y: e.clientY };
    player._lastPtr = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('pointermove', (e) => {
    if (!player.dragging) return;
    const dx = e.clientX - player._lastPtr.x;
    const dy = e.clientY - player._lastPtr.y;
    player._lastPtr = { x: e.clientX, y: e.clientY };
    if (Math.hypot(dx, dy) > 1.5) player.cancelVista();
    player.camYaw -= dx * 0.0052;
    player.camPitch = Math.max(-0.12, Math.min(1.18, player.camPitch + dy * 0.0045));
  });
  window.addEventListener('pointerup', (e) => {
    const wasClick = ptrDownPos && Math.hypot(e.clientX - ptrDownPos.x, e.clientY - ptrDownPos.y) < 6;
    player.dragging = false;
    ptrDownPos = null;
    if (wasClick && e.target === canvas) {
      ptrNdc.x = (e.clientX / window.innerWidth) * 2 - 1;
      ptrNdc.y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(ptrNdc, camera);
      const hits = raycaster.intersectObjects(districts.pickables, false);
      if (hits.length) {
        const ud = hits[0].object.userData || {};
        const bMeta = ud.haiz_building_id ? buildingById.get(ud.haiz_building_id) : null;
        hud.showProvenance(ud.haiz_tag ? { ...bMeta, ...ud } : (bMeta || ud));
      }
    }
  });
  canvas.addEventListener('wheel', (e) => {
    player.camDist = Math.max(3.0, Math.min(24.0, player.camDist + e.deltaY * 0.01));
  }, { passive: true });

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    player.keys.add(e.code);
    if (e.code === 'Digit1') { player.setMode('walk'); hud.setActiveMode('walk'); }
    else if (e.code === 'Digit2') { player.setMode('bike'); hud.setActiveMode('bike'); }
    else if (e.code === 'Digit3') { player.setMode('glide'); hud.setActiveMode('glide'); }
    else if (e.code === 'Space' && player.mode === 'bike') { e.preventDefault(); player.ringBell(); }
    else if (e.code === 'KeyM') hud.toggleMap();
    else if (e.code === 'KeyC') hud.toggleComparison();
    else if (e.code === 'KeyH') document.body.classList.toggle('wr-zen');
    else if (e.code === 'Escape') { hud.closePanels(); hud.toggleMap(false); hud.toggleComparison(false); hud.showProvenance(null); }
  });
  window.addEventListener('keyup', (e) => player.keys.delete(e.code));

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const streamPromise = districts.streamRemainingDistricts();

  let fpsSmooth = 60;
  let frameMsSmooth = 16.6;
  let lastHudTick = 0;

  function nearestPlaceLabel() {
    let best = null;
    let bd = 34;
    for (const [, p] of Object.entries(spatial.places)) {
      const d = Math.hypot(player.pos.x - p.x, player.pos.z - (-p.y));
      if (d < bd) { bd = d; best = p.label; }
    }
    return best;
  }

  function tickFrame(dt) {
    const t0 = performance.now();
    runtime.step(dt);
    player.update(dt, runtime);
    atmosphere.update(dt, runtime, player.pos);
    living.update(dt, runtime, player.pos, camera.position);
    districts.update(dt, runtime);
    districts.updateLod(camera.position);

    if ('environmentIntensity' in scene && runtime.lens === 0) {
      const night = atmosphere.uniforms.uNight.value;
      scene.environmentIntensity = 0.72 * (1.0 - 0.80 * night);
    }

    renderer.info.reset();
    renderer.render(scene, camera);

    const frameMs = Math.max(0.5, performance.now() - t0);
    frameMsSmooth = frameMsSmooth * 0.9 + frameMs * 0.1;
    if (dt > 0.001) fpsSmooth = fpsSmooth * 0.9 + (1 / dt) * 0.1;

    const now = performance.now();
    if (now - lastHudTick > 180) {
      lastHudTick = now;
      hud.updateClock(runtime.hour);
      hud.updateLocationWhisper(player.pos, player.mode, player.inThermal, nearestPlaceLabel());
      const ds = districts.getStatus();
      hud.updateTelemetry({
        fps: fpsSmooth,
        frameMs: frameMsSmooth,
        calls: renderer.info.render.calls,
        tris: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        loadedAssets: ds.loaded,
        totalAssets: ds.total,
      });
    }
    if (hud.mapOpen) hud.renderMap(player.pos, player.yaw, living.getCitizenMapPoints());
  }

  tickFrame(0.016);
  setLoading(1.0, '欢迎回到海南中学府城校区（Round 3 生命角色系统）');
  document.getElementById('wr-loading')?.classList.add('done');
  runtime.claimRenderLoop();

  let prev = performance.now();
  let manualStep = false;
  function animate(now) {
    requestAnimationFrame(animate);
    if (manualStep) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - prev) / 1000));
    prev = now;
    tickFrame(dt);
  }

  if (Q.get('vista')) {
    const v = spec.vistas.find((x) => x.id === Q.get('vista'));
    if (v) { player.flyToVista(v); player._vistaAnim.t = 1; }
  }
  document.body.dataset.stage = 'ready';

  window.__HAIZ_R3__ = {
    ready: true,
    player,
    living,
    runtime,
    atmosphere,
    districts,
    spatial,
    COMPARISON_VISTAS,
    streamPromise,
    setManualStep: (v) => { manualStep = Boolean(v); },
    step: (dt = 1 / 30) => tickFrame(dt),
    setLens: (idx) => { runtime.setLens(idx); atmosphere.setLens(idx); hud.setActiveLens(idx); player.setPlanAerial(idx === 2); },
    setWeather: (wx) => { runtime.setWeather(wx); atmosphere.setWeather(wx); hud.setActiveWeather(wx); },
    setHour: (h) => { runtime.setHour(h); hud.updateClock(h); },
    setMode: (m) => { runtime.setMode(m); player.setMode(m); hud.setActiveMode(m); },
    setBags: (b) => { player.setBags(b); },
    teleport: (x, z, yaw = 0) => player.teleport(x, z, yaw),
    flyToVista: (id) => {
      const v = spec.vistas.find((x) => x.id === id);
      if (v) player.flyToVista(v);
    },
    getStats: () => ({
      fps: fpsSmooth,
      frameMs: frameMsSmooth,
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      citizensLoaded: living.citizens.length,
      playerPos: player.pos.toArray(),
      playerSpeed: player.speed,
      playerMode: player.mode,
    }),
  };

  requestAnimationFrame(animate);
}

boot();
