/**
 * HAIZ · World Reconstruction Round 2 — Hybrid Heritage & Real-Time Campus World Director.
 */
import * as THREE from 'three';
import { WorldRuntime } from './core/runtime.js';
import { CampusSpatial } from './core/collision.js';
import { CampusAtmosphere } from './atmosphere/environment.js';
import { loadHdrEnvironment } from './atmosphere/rgbe-loader.js';
import { DistrictManagerR2 } from './streaming/district-manager-r2.js';
import { LivingCampus } from './world/living-campus.js';
import { PlayerController } from './world/vehicles.js';
import { CampusHUD, COMPARISON_VISTAS } from './ui/hud.js';

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
  const tStart = performance.now();
  const baseUrl = new URL('../', import.meta.url);
  const rootUrl = new URL('../../', import.meta.url);

  setLoading(0.08, '读取海南中学府城校区真实感重构空间母版…');
  const [spec, instances] = await Promise.all([
    fetch(new URL('data/world_spec.json', baseUrl)).then((r) => r.json()),
    fetch(new URL('data/instances_r2.json', baseUrl)).then((r) => r.json()),
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

  // Load real calibrated tropical HDR environment IBL (assets/walk/textures/campus-light.hdr)
  loadHdrEnvironment(new URL('assets/walk/textures/campus-light.hdr', rootUrl).href, renderer)
    .then((envRT) => {
      scene.environment = envRT.texture;
      if ('environmentIntensity' in scene) scene.environmentIntensity = 0.72;
    })
    .catch((e) => console.warn('HDR IBL skipped:', e));

  const initialHour = Q.has('hour') ? Number(Q.get('hour')) : 16.65;
  const initialWx = Q.get('wx') || 'clear';
  const initialLens = Q.has('lens') ? Number(Q.get('lens')) : 0;
  const runtime = new WorldRuntime({ initialHour, initialWeather: initialWx, initialLens });
  const spatial = new CampusSpatial(spec);
  const atmosphere = new CampusAtmosphere(scene, renderer, { shadowSize: tier.shadow });
  atmosphere.setWeather(initialWx);
  atmosphere.setLens(initialLens);

  const districts = new DistrictManagerR2(scene, atmosphere, spec, {
    districtsBaseUrl: new URL('assets/districts/', baseUrl).href,
    atelierBaseUrl: new URL('twin/assets/runtime/', rootUrl).href,
    dracoUrl: new URL('lanren/vendor/three/addons/libs/draco/', rootUrl).href,
    quality: currentQuality,
    onProgress: setLoading,
  });

  await districts.loadPriority0(instances);

  const buildingById = new Map(spec.buildings.map((b) => [b.id, b]));
  let hud = null;

  const living = new LivingCampus(scene, spatial, atmosphere, {
    lifeAssetBaseUrl: new URL('lanren/assets/life/', rootUrl).href,
    onSpeak: (name, role, line) => hud?.showToast(name, role, line),
  });

  const player = new PlayerController(scene, camera, spatial, atmosphere, spec, {
    onBell: (pos) => living.onPlayerBell(pos),
  });

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
    player.camDist = Math.max(3.2, Math.min(26.0, player.camDist + e.deltaY * 0.01));
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
    let best = null, bd = 34;
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
    living.update(dt, runtime, player.pos);
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
  setLoading(1.0, '欢迎回到海南中学府城校区（Round 2 真实感迭代版）');
  const veil = document.getElementById('wr-loading');
  setTimeout(() => veil?.classList.add('done'), 180);

  runtime.claimRenderLoop();
  let lastNow = performance.now();
  let manualStep = false;
  function raf(now) {
    requestAnimationFrame(raf);
    if (manualStep) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
    lastNow = now;
    tickFrame(dt);
  }
  requestAnimationFrame(raf);

  const bootMs = Math.round(performance.now() - tStart);
  document.body.dataset.stage = 'ready';

  const api = {
    bootMs,
    streamPromise,
    spec,
    scene,
    camera,
    runtime,
    player,
    districts,
    atmosphere,
    living,
    hud,
    setManualStep(v) { manualStep = !!v; },
    step(dt = 1 / 30) { tickFrame(dt); },
    teleport(x, z, yaw = 0) {
      player.teleport(x, z, yaw);
      tickFrame(0.016);
      hud.updateLocationWhisper(player.pos, player.mode, player.inThermal, nearestPlaceLabel());
    },
    setMode(m) {
      runtime.setMode(m); player.setMode(m); hud.setActiveMode(m); tickFrame(0.016);
      hud.updateLocationWhisper(player.pos, player.mode, player.inThermal, nearestPlaceLabel());
    },
    setLens(i) { runtime.setLens(i); atmosphere.setLens(i); player.setPlanAerial(i === 2); hud.setActiveLens(i); tickFrame(0.016); },
    setWeather(w) { runtime.setWeather(w); atmosphere.setWeather(w); hud.setActiveWeather(w); for (let k = 0; k < 20; k++) tickFrame(0.08); },
    setHour(h) { runtime.setHour(h); hud.updateClock(runtime.hour); for (let k = 0; k < 18; k++) tickFrame(0.08); },
    flyToVista(id) {
      const cmp = COMPARISON_VISTAS.find((c) => c.id === id);
      const v = cmp ? cmp.vista : spec.vistas.find((x) => x.id === id);
      if (!v) return false;
      player.flyToVista(v);
      for (let k = 0; k < 42; k++) tickFrame(0.04);
      hud.updateLocationWhisper(player.pos, player.mode, player.inThermal, v.name);
      return true;
    },
    selectBuilding(id) {
      const b = buildingById.get(id);
      if (b) hud.showProvenance(b);
      return !!b;
    },
    openMap(v) { hud.toggleMap(v); tickFrame(0.016); },
    openComparison(v, itemId = null) { hud.toggleComparison(v, itemId); tickFrame(0.016); },
    setZen(v) { document.body.classList.toggle('wr-zen', !!v); },
    getStats() {
      const ds = districts.getStatus();
      return {
        bootMs,
        sceneUuid: scene.uuid,
        quality: currentQuality,
        mode: player.mode,
        lens: runtime.lens,
        weather: runtime.weather,
        hour: +runtime.hour.toFixed(2),
        playerPos: [ +player.pos.x.toFixed(2), +player.pos.y.toFixed(2), +player.pos.z.toFixed(2) ],
        fps: +fpsSmooth.toFixed(1),
        frameMs: +frameMsSmooth.toFixed(2),
        calls: renderer.info.render.calls,
        tris: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        loadedAssets: ds.loaded,
        totalAssets: ds.total,
        atelierCount: ds.atelierLoaded.length,
        r2DistrictsCount: ds.r2DistrictsLoaded.length,
        citizens: living.citizens.length,
      };
    },
  };
  window.__HAIZ_R2__ = api;
  window.__haizWorld = api;
}

boot().catch((err) => {
  console.error('HAIZ Round 2 boot failed:', err);
  setLoading(1.0, `载入失败：${err.message}`);
});
