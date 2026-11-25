// HAIZ World Engine — Unified Digital Campus Vertical Slice
//
// Brings together HAIZ's core achievements into ONE coherent, event-driven World Engine:
//   - Canonical Spatial Graph & Provenance (coord.js + graph.js)
//   - Unified World Clock + Live Haikou Weather + 86-Year ERA5 Climate Archive (clock.js)
//   - "One World, Six Ways of Seeing" Multi-Lens Art Pipeline (lenses.js + pipeline.js)
//   - Zero-Slide 51-Joint MakeHuman Gait + Multi-Modal Locomotion (Walk / Bike / Board / Broom)
//   - Living Campus Ecology (5 Scheduled NPCs + Orange Cat + 3 Butterfly Species + 3D Altitude Guard)
//   - Interactive Semantic Watercolor Campus Map (syncs live with 3D world & A* routes)
//   - In-World Scientific Simulation Field Stations (RK4 Pendulum, Yanchi Optics, Microclimate)

import * as THREE from 'three';
import { U } from '../lanren/ruhua-stroll/atmos.js';
import { SKY } from '../lanren/ruhua-stroll/sky.js';
import { UNIFORMS } from '../lanren/js/foliage.js';
import { loadV4, V4_ROT } from '../lanren/ruhua/v4.js';
import { createWorld, shadeAt } from '../lanren/ruhua/world.js';
import { createRain } from '../lanren/ruhua/fx.js';
import { createHabitat, createEcosystem } from '../lanren/ruhua/eco/habitat.js';
import { createFlowers } from '../lanren/ruhua/eco/flowers.js';
import { createButterflies } from '../lanren/ruhua/eco/butterflies.js';
import { createCat } from '../lanren/ruhua/eco/cat.js';
import { createWalker } from '../lanren/life/gait.js';
import { createPlayer } from '../lanren/life/player.js';
import { buildNav } from '../lanren/life/nav.js';
import { createLife } from '../lanren/life/life.js';
import { createPeople } from '../lanren/life/npc.js';
import { INKS } from '../lanren/life/map.js';
import { createFree } from '../lanren/free/free.js';
import { createWake } from '../lanren/free/wake.js';
import { createWheelPath } from '../lanren/free/wheelpath.js';
import { pairMaterials } from '../lanren/painted-lab/material.js';

import { createWorldRuntime } from './core/runtime.js';
import { serializePeerPacket } from './core/entities.js';
import { createSpatialGraph } from './spatial/graph.js';
import { createWorldClock, ERA_BOOKMARKS, WEATHER_PRESETS } from './climate/clock.js';
import { ART_LENSES, getLens } from './art/lenses.js';
import { createWorldPipeline } from './art/pipeline.js';
import { createMapDrawer } from './ui/map-drawer.js';
import { createScienceDrawer } from './ui/science-drawer.js';

const Q = new URLSearchParams(location.search);
const LANREN_ROOT = new URL('../lanren/', import.meta.url);
const asset = (p) => new URL(p, LANREN_ROOT).href;
const coarse = matchMedia('(pointer: coarse)').matches || innerWidth <= 640;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const WORLD_TIERS = {
  high: { pr: Math.min(devicePixelRatio || 1, 2), shadow: 2048, paint: 2048, pipeline: 'high', leafDensity: 1.0 },
  medium: { pr: Math.min(devicePixelRatio || 1, 1.5), shadow: 2048, paint: 2048, pipeline: 'medium', leafDensity: 0.75 },
  low: { pr: Math.min(devicePixelRatio || 1, 1), shadow: 1024, paint: 1024, pipeline: 'low', leafDensity: 0.5 },
};
const defaultTier = coarse ? 'medium' : 'high';
const tierName = WORLD_TIERS[Q.get('quality')] ? Q.get('quality') : defaultTier;
const tier = WORLD_TIERS[tierName];
const LAYER_WORLD = 0;

const $ = (s) => document.querySelector(s);

function setLoad(pct, text) {
  const bar = $('#we-load-bar');
  const status = $('#we-load-status');
  if (bar) bar.style.width = `${Math.round(pct * 100)}%`;
  if (status && text) status.textContent = text;
}

function showWhisper(who, text) {
  const el = $('#we-whisper');
  if (!el) return;
  el.querySelector('b').textContent = who;
  el.querySelector('span').textContent = text;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('is-on'));
  clearTimeout(showWhisper._t);
  showWhisper._t = setTimeout(() => {
    el.classList.remove('is-on');
    setTimeout(() => { el.hidden = true; }, 500);
  }, 4600);
}

async function boot() {
  const tBoot = performance.now();
  const runtime = createWorldRuntime({ mobile: coarse });
  const { bus, store, perf, assets, entities } = runtime;
  const releaseLoop = runtime.claimRenderLoop('world-engine-main');

  const canvas = $('#we-canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: Q.has('capture'),
  });
  renderer.setPixelRatio(tier.pr);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.info.autoReset = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 6000);
  const followCam = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 6000);

  const pipeline = createWorldPipeline(renderer, { tier: tier.pipeline, reduceMotion });
  pipeline.setSize(innerWidth, innerHeight, tier.pr);

  // 1. Unified World Clock + 86-year ERA5 Climate Archive + Live Haikou Weather
  const worldClock = createWorldClock({
    bus,
    climateBaseUrl: new URL('../lanren/rings/data/', import.meta.url),
    liveFetch: !Q.has('offline'),
  });
  worldClock.ensureArchive();

  // Optional URL deep-link presets (?lens=inkwash&wx=clear&hour=16.5&era=1985-11-18)
  if (Q.get('era')) {
    worldClock.applyEraDate(Q.get('era'), Q.has('hour') ? Number(Q.get('hour')) : 16.2);
  } else if (Q.get('wx') || Q.has('hour')) {
    worldClock.setFreeWeather(Q.get('wx') || 'clear', Q.has('hour') ? Number(Q.get('hour')) : 15.8);
  } else {
    // Start in crisp, inviting late-afternoon Haikou daylight unless user toggles Live
    worldClock.setFreeWeather('clear', 16.2);
  }

  setLoad(0.12, '载入校园空间数据与百年榄仁树…');
  const [campus, buildingsMeta, v4] = await Promise.all([
    fetch(asset('../assets/walk/campus.json')).then((r) => r.json()),
    fetch(asset('../data/buildings.json')).then((r) => r.json()).catch(() => null),
    loadV4(asset('assets/'), { mobile: coarse, onProgress: (p) => setLoad(0.12 + p * 0.25) }),
  ]);

  setLoad(0.4, '构建统一校园世界与植被…');
  const world = await createWorld({ campus, v4, tier, asset, say: (s) => setLoad(0.45, s) });
  world.sceneRoot = scene;
  scene.add(world.group);

  setLoad(0.55, '载入影像校准建筑（一号楼 · 科学馆 · 砚池 · 艺术中心）…');
  await world.loadCampus();

  // Pair every cel material with painted-lab's gouache shader sibling & activate it
  const materialPairs = pairMaterials(world.group);
  materialPairs.lab();

  setLoad(0.74, '载入 51 骨骼人物模型与自然步态…');
  const heightAt = (x, z) => world.heightAt(x, z);
  // Spawn on the open forecourt plaza facing 百年榄仁树 and 一号教学楼's 1923 portal
  const SPAWN = { x: -16.0, z: -20.0, yaw: 0.52 };
  const student = await createWalker(asset('assets/life/student-m.glb'), {
    heightAt,
    x: SPAWN.x,
    z: SPAWN.z,
    fade: true,
    hair: 'short',
  });
  student.root.visible = true;
  student.setFade?.(1);
  world.group.add(student.root);

  // Synced weather adapter so existing eco/rain/free modules read the Unified World Clock
  let lastClimate = worldClock.update(0.016);
  const weatherFacade = {
    get state() {
      return {
        clock: lastClimate.clock,
        time: lastClimate.time,
        raw: lastClimate.raw,
        cur: lastClimate.cur,
        surf: lastClimate.surf,
        rainNow: lastClimate.rainNow,
        sun: lastClimate.sun,
        moon: lastClimate.moon,
        pal: lastClimate.pal,
        origin: lastClimate.origin,
      };
    },
    caption() {
      const c = lastClimate.clk;
      return {
        clock: `${String(c.h).padStart(2, '0')}:${String(c.min).padStart(2, '0')}`,
        name: lastClimate.weatherWord,
        temp: Math.round(lastClimate.raw.temp ?? 26),
      };
    },
  };

  setLoad(0.84, '唤醒校园生态（蝴蝶 · 橘猫 · 五位校园人物）…');
  const rain = createRain({ world, mobile: coarse, layer: LAYER_WORLD });
  world.group.add(rain.group);

  const habitat = createHabitat({ world, weather: weatherFacade });
  const flowers = createFlowers(habitat, {
    extra: [
      { x: 46, z: 58 }, { x: 63, z: 58.5 }, { x: 79, z: 69 },
      { x: 52, z: 80 }, { x: 87, z: 79 }, { x: 108, z: 79.5 },
    ],
  });
  world.group.add(flowers.group);
  world.rebuild();

  const nav = buildNav({
    colliders: world.colliders,
    features: world.geo.features,
    bounds: { x0: -300, x1: 200, z0: -140, z1: 300 },
  });
  const wheelPath = createWheelPath(nav);
  const graph = createSpatialGraph({ campus, buildingsMeta, nav, wheelPath });

  let isRaining = false;
  const life = createLife({ nav, isRaining: () => isRaining });
  const people = createPeople({
    life,
    url: asset('assets/life/student-m.glb'),
    heightAt,
    getColliders: () => world.colliders,
    layer: LAYER_WORLD,
    mobile: coarse,
    say: (who, text) => showWhisper(who, text),
  });
  world.group.add(people.group);

  const eco = createEcosystem({ habitat });
  const butterflies = eco.add(createButterflies(habitat, { max: coarse ? 14 : 24, layer: LAYER_WORLD }));
  world.group.add(butterflies.mesh);
  const cat = eco.add(createCat(habitat, { layer: LAYER_WORLD, butterflies }));
  world.group.add(cat.root);

  // Wake wind-field patched AFTER pairMaterials.lab() so both gouache + wake coexist cleanly
  const wake = createWake({ renderer, world, layer: LAYER_WORLD });

  const player = createPlayer({
    camera: followCam,
    dom: canvas,
    student,
    getColliders: () => world.colliders,
    heightAt,
    spawn: SPAWN,
    coarse,
    pois: graph.nodes.map((n) => ({ x: n.position[0], y: n.position[1] + 2.5, z: n.position[2], r: n.radius })),
  });
  player.setEnabled(true);

  const free = createFree({
    world,
    student,
    canvas,
    layer: LAYER_WORLD,
    coarse,
    followCam,
    camera,
    player: () => player,
    heightAt,
    getColliders: () => world.colliders,
    nav,
    life,
    people,
    wake,
    UNIFORMS,
    weather: weatherFacade,
    ui: { line: showWhisper },
  });
  free.setEnabled(true);

  // Pair vehicle materials too so bikes/boards/brooms respond to art lenses
  pairMaterials(world.group);

  // Apply initial lens (URL ?lens= or saved or default gouache)
  const initialLens = Q.get('lens') || store.state.user.lens || 'gouache';
  store.setLens(initialLens, { force: true });
  pipeline.setLens(initialLens, { animate: false });

  // 2. Semantic Watercolor Map Drawer (works even while riding!)
  let activeNavRoute = null;
  const mapDrawer = createMapDrawer({
    rootEl: $('#we-map-modal'),
    graph,
    world,
    getPlayer: () => {
      const p = free.position;
      return { x: p.x, z: p.z, yaw: free.ride.riding ? free.ride.state.yaw : player.state.yaw };
    },
    getNpcs: () =>
      life.agents
        .map((a) => {
          const s = a.live || a.state;
          if (!s || a.state?.away) return null;
          return {
            id: a.id,
            name: a.person.name,
            x: s.x,
            z: s.z,
            inside: !!a.state?.inside,
            color: INKS[a.id] || '#2a4a3c',
          };
        })
        .filter(Boolean),
    getCat: () => (cat?.root ? { x: cat.root.position.x, z: cat.root.position.z } : null),
    getRoute: () => activeNavRoute?.points || null,
    onNavigate: (node) => {
      const p = free.position;
      const mode = free.mode;
      const r = graph.findPath(p.x, p.z, node.approach[0], node.approach[2], { mode, wet: isRaining });
      activeNavRoute = r;
      free.route.set({ pts: r.points, dest: { x: node.approach[0], z: node.approach[2], name: node.name }, air: mode === 'broom' });
      showWhisper('导航', `已规划至「${node.name}」约 ${Math.round(r.distance)} m`);
      return r;
    },
    onTeleport: (node) => {
      teleportTo(node);
    },
    onOpenStation: (stationId) => {
      openScience(stationId);
    },
    onSelectEra: (iso) => {
      worldClock.applyEraDate(iso, 16.0);
      syncWorldClockUi();
      showWhisper('时间旅行', `已切换至 ${iso} 的历史校园气象`);
    },
    onClose: () => {
      store.setAuthority('explore');
      syncAuthority();
    },
  });

  // 3. In-World Scientific Simulation Drawer
  const scienceDrawer = createScienceDrawer({
    rootEl: $('#we-science-modal'),
    getClimateSnapshot: () => lastClimate,
    onRecordTrial: (trial) => store.recordScienceTrial(trial),
    onClose: () => {
      store.setAuthority('explore');
      syncAuthority();
    },
  });

  function syncAuthority() {
    const canMove = store.state.authority === 'explore';
    player.setEnabled(canMove && !free.ride.riding);
    free.setEnabled(canMove);
  }

  function openMap(placeId = null) {
    if (scienceDrawer.isOpen) scienceDrawer.close();
    store.setAuthority('map');
    syncAuthority();
    mapDrawer.open(placeId);
  }

  function openScience(stationId = 'pendulum') {
    if (mapDrawer.isOpen) mapDrawer.close();
    store.setAuthority('lab');
    syncAuthority();
    scienceDrawer.open(stationId);
  }

  function teleportTo(node) {
    if (!node) return;
    if (free.ride.riding) free.ride.request('walk');
    const [tx, , tz] = node.approach || node.position;
    const ty = heightAt(tx, tz);
    player.state.pos.set(tx, ty, tz);
    student.place?.(tx, tz, Math.atan2(node.position[0] - tx, node.position[2] - tz));
    showWhisper(node.name, node.purpose);
  }

  // 4. Build UI Controls (Art Lenses, World Clock / ERA5, Place Witness, Mobile Drawer)
  function initUi() {
    // Art Lens Strip
    const lensStrip = $('#we-lens-strip');
    if (lensStrip) {
      lensStrip.innerHTML = ART_LENSES.map(
        (l) => `<button type="button" class="we-lens-btn ${l.id === store.state.user.lens ? 'is-active' : ''}" data-lens="${l.id}" title="${l.description}">${l.short}</button>`,
      ).join('');
      lensStrip.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-lens]');
        if (!btn) return;
        selectLens(btn.dataset.lens);
      });
    }

    // Weather Preset Buttons
    const wxGrid = $('#we-wx-presets');
    if (wxGrid) {
      wxGrid.innerHTML = WEATHER_PRESETS.map(
        (w) => `<button type="button" class="we-chip" data-wx="${w.id}">${w.label}</button>`,
      ).join('');
      wxGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-wx]');
        if (!btn) return;
        worldClock.setFreeWeather(btn.dataset.wx);
        syncWorldClockUi();
      });
    }

    // ERA5 Historical Bookmarks
    const eraGrid = $('#we-era-list');
    if (eraGrid) {
      eraGrid.innerHTML = ERA_BOOKMARKS.map(
        (b) => `<button type="button" class="we-era-btn" data-era="${b.id}"><b>${b.label}</b><span>${b.note}</span></button>`,
      ).join('');
      eraGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-era]');
        if (!btn) return;
        const bm = ERA_BOOKMARKS.find((x) => x.id === btn.dataset.era);
        if (!bm) return;
        if (bm.id === 'live') {
          worldClock.setLive();
        } else {
          worldClock.applyEraDate(bm.iso, bm.hour ?? 15.5);
          if (bm.year && bm.year < 2000) {
            showWhisper(bm.label, '可尝试切换至「旧影」画境观看历史时刻');
          }
        }
        syncWorldClockUi();
      });
    }

    // 24h Time Slider & Custom ERA Date Input
    const hourSlider = $('#we-hour-slider');
    hourSlider?.addEventListener('input', (e) => {
      worldClock.setHour(Number(e.target.value));
      syncWorldClockUi();
    });

    const dateInput = $('#we-era-date');
    dateInput?.addEventListener('change', (e) => {
      if (e.target.value) {
        worldClock.applyEraDate(e.target.value, Number(hourSlider?.value || 15.5));
        syncWorldClockUi();
      }
    });

    const timelapseBtn = $('#we-timelapse-btn');
    let timelapseOn = false;
    timelapseBtn?.addEventListener('click', () => {
      timelapseOn = !timelapseOn;
      worldClock.setTimeScale(timelapseOn ? 240 : 1);
      timelapseBtn.setAttribute('aria-pressed', String(timelapseOn));
      timelapseBtn.textContent = timelapseOn ? '暂停流逝' : '昼夜流逝';
    });

    // Top-right Panel Toggles
    const clockPanel = $('#we-clock-panel');
    $('#we-clock-btn')?.addEventListener('click', () => {
      const next = clockPanel.hidden;
      clockPanel.hidden = !next;
      $('#we-clock-btn').setAttribute('aria-expanded', String(next));
      syncWorldClockUi();
    });
    $('#we-clock-close')?.addEventListener('click', () => {
      clockPanel.hidden = true;
      $('#we-clock-btn')?.setAttribute('aria-expanded', 'false');
    });

    $('#we-map-btn')?.addEventListener('click', () => {
      if (mapDrawer.isOpen) mapDrawer.close();
      else openMap();
    });

    $('#we-sci-btn')?.addEventListener('click', () => {
      if (scienceDrawer.isOpen) scienceDrawer.close();
      else openScience(currentPlaceNode?.scienceStation || 'pendulum');
    });

    $('#we-view-btn')?.addEventListener('click', () => {
      if (free.ride.riding) free.ride.toggleView();
      else player.toggleView?.();
    });

    // Contextual Place Witness action buttons
    $('#we-place-story-btn')?.addEventListener('click', () => {
      if (currentPlaceNode) openMap(currentPlaceNode.id);
    });
    $('#we-place-sci-btn')?.addEventListener('click', () => {
      if (currentPlaceNode?.scienceStation) openScience(currentPlaceNode.scienceStation);
    });

    // Global shortcuts
    addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.code === 'KeyM') {
        e.preventDefault();
        if (mapDrawer.isOpen) mapDrawer.close();
        else openMap();
      } else if (e.code === 'KeyL') {
        const idx = ART_LENSES.findIndex((l) => l.id === store.state.user.lens);
        selectLens(ART_LENSES[(idx + 1) % ART_LENSES.length].id);
      } else if (e.code === 'KeyE' && currentPlaceNode?.scienceStation && !free.ride.nearParked(free.position.x, free.position.z)) {
        openScience(currentPlaceNode.scienceStation);
      } else if (e.code === 'Escape') {
        if (mapDrawer.isOpen) mapDrawer.close();
        if (scienceDrawer.isOpen) scienceDrawer.close();
        if (clockPanel && !clockPanel.hidden) clockPanel.hidden = true;
      }
    });
  }

  function selectLens(lensId, { animate = true } = {}) {
    const lens = getLens(lensId);
    store.setLens(lens.id);
    pipeline.setLens(lens.id, { animate, origin: [0.5, 0.48] });
    document.querySelectorAll('.we-lens-btn').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.lens === lens.id);
    });
    const caption = $('#we-lens-caption');
    if (caption) caption.textContent = `${lens.name} · ${lens.kicker}`;
  }

  function syncWorldClockUi() {
    const hourSlider = $('#we-hour-slider');
    const hourVal = $('#we-hour-val');
    const h = lastClimate.clk.hours;
    if (hourSlider && document.activeElement !== hourSlider) hourSlider.value = h.toFixed(2);
    if (hourVal) {
      const hh = Math.floor(h);
      const mm = Math.floor((h - hh) * 60);
      hourVal.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }
    const noteEl = $('#we-era-note');
    if (noteEl) noteEl.textContent = `${lastClimate.eraNote} · 物候：${lastClimate.phenology.label} · 太阳高度 ${lastClimate.sun.alt.toFixed(1)}°`;
    document.querySelectorAll('.we-era-btn').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.era === lastClimate.eraId);
    });
  }

  // 5. Atmosphere Sync (Unified Clock -> Three.js shaders, sky, tree phenology, lamps)
  let lastDoy = -1;
  const v4Wind = new THREE.Vector3();
  const cRot = Math.cos(-V4_ROT), sRot = Math.sin(-V4_ROT);

  function applyAtmosphere(S) {
    const P = S.pal, C = S.cur;
    world.day.applyParams(P);
    U.uCloudCover.value = C.cover;
    SKY.uCardCover.value = Math.min(1, Math.max(0.08, C.cover * 1.45));
    SKY.uOvercast.value = C.overcast;
    SKY.uCirrus.value = 0.1 + C.cirrus * 0.8;
    SKY.uStars.value = P.night * (1 - C.overcast);
    SKY.uMoonDisc.value = P.night > 0.5 && S.moon.alt > 2 ? S.moon.fraction : 0;
    SKY.uSunDisc.value = 5 * (1 - P.night) * (1 - C.overcast * 0.9);
    U.uWindDir.value.set(C.windDir[0], C.windDir[1]);
    U.uWindSpeed.value = C.windSpeed;
    U.uWindGust.value = C.gust;
    U.uWindSway.value = C.sway;
    U.uWet.value = C.wet;
    U.uPuddle.value = C.puddle;
    U.uRain.value = Math.min(1, S.rainNow);
    U.uNight.value = P.night;
    U.uLamps.value = S.nightLamps;
    world.sky.drift = 0.6 + C.windSpeed * 0.4;

    // Sync V4 Terminalia tree wind & seasonal leaf phenology (updates live on date travel!)
    v4Wind.set(C.windDir[0] * cRot + C.windDir[1] * sRot, 0, -C.windDir[0] * sRot + C.windDir[1] * cRot);
    UNIFORMS.uWindDir.value.copy(v4Wind).normalize();
    UNIFORMS.uWind.value = Math.min(1.4, C.sway * 0.42);
    UNIFORMS.uGust.value = 0.5 + 0.5 * Math.sin(S.time * 0.21) * Math.sin(S.time * 0.13 + 1);
    UNIFORMS.uTime.value = S.time;

    if (S.dayOfYear !== lastDoy) {
      lastDoy = S.dayOfYear;
      world.tree.setDay(S.dayOfYear);
    }

    // Update top-right World Clock chip
    const chip = $('#we-clock-label');
    if (chip) {
      const hh = String(S.clk.h).padStart(2, '0');
      const mm = String(S.clk.min).padStart(2, '0');
      chip.textContent = `${S.mode === 'era' ? S.eraDateLabel : '海口'} ${hh}:${mm} · ${S.weatherWord} ${Math.round(S.raw.temp ?? 26)}°`;
    }
  }

  // 6. Semantic Place Witness (quiet, non-intrusive context pill at bottom-left)
  let currentPlaceNode = graph.get('lanshu');
  let placeCheckTimer = 0;

  function updatePlaceWitness(dt, pos) {
    placeCheckTimer -= dt;
    if (placeCheckTimer > 0) return;
    placeCheckTimer = 0.25;
    const ctx = graph.queryContext(pos);
    if (!ctx) return;
    currentPlaceNode = ctx.node;
    store.markPlaceVisited(ctx.node.id, ctx.node.name);
    const nameEl = $('#we-place-name');
    const tagEl = $('#we-place-evidence');
    const sciBtn = $('#we-place-sci-btn');
    if (nameEl) nameEl.textContent = ctx.inside ? ctx.node.name : `近 ${ctx.node.name}（${Math.round(ctx.horiz)} m）`;
    if (tagEl) {
      tagEl.textContent = ctx.node.evidenceLabel;
      tagEl.className = `we-badge we-badge-${ctx.node.evidenceTone}`;
    }
    if (sciBtn) {
      sciBtn.hidden = !ctx.node.scienceStation;
      if (ctx.node.scienceStation) {
        sciBtn.textContent = coarse ? '科学站' : '科学站 (E)';
      }
    }
  }

  // 7. Main Simulation & Render Loop (with per-subsystem profiling & 3D altitude guard!)
  let shadeTimer = 0;
  let shadeValue = 0;
  let eyeAdapt = 1;
  let cameraOverride = null;
  const focusPos = new THREE.Vector3();
  const groundProxyPos = new THREE.Vector3();
  let mapFrameSkip = 0;
  let paused = Q.has('capture');

  function step(dt) {
    U.uTime.value += dt;
    pipeline.tick(dt);

    // Subsystem 1: Unified Climate & Ephemeris
    let end = perf.beginSubsystem('climate');
    const S = worldClock.update(dt);
    lastClimate = S;
    applyAtmosphere(S);
    end();

    // Subsystem 2: Player & Multi-Modal Locomotion
    end = perf.beginSubsystem('locomotion');
    free.update(dt);
    if (cameraOverride) {
      camera.position.set(...cameraOverride.eye);
      camera.lookAt(...cameraOverride.at);
      if (camera.fov !== cameraOverride.fov) {
        camera.fov = cameraOverride.fov;
        camera.updateProjectionMatrix();
      }
    } else {
      camera.position.copy(followCam.position);
      camera.quaternion.copy(followCam.quaternion);
      if (Math.abs(camera.fov - followCam.fov) > 0.01) {
        camera.fov = followCam.fov;
        camera.updateProjectionMatrix();
      }
    }
    free.world(dt, S);
    end();

    const playerPos = free.position;
    const agl = free.mode === 'broom' ? free.ride.state.agl : 0;
    const isHighAltitude = agl > 3.2;

    // Subsystem 3: World Environment (Daylight shadow frustum, sky, grass, rain)
    end = perf.beginSubsystem('environment');
    focusPos.copy(playerPos);
    world.day.update(dt, focusPos);
    world.sky.update(dt, focusPos);
    camera.updateMatrixWorld();
    world.grass.update(camera, focusPos, world.geo.frame.ground);
    rain.update(dt, weatherFacade, camera.position);
    student.setUmbrella?.((S.rainNow > 0.1 || S.cur.rain > 0.15) && !free.ride.riding);
    end();

    // Subsystem 4: Living Campus NPCs & Ecology (with 3D altitude guard + unified clock!)
    end = perf.beginSubsystem('life_eco');
    const wetNow = Math.max(S.rainNow, S.cur.rain);
    isRaining = isRaining ? wetNow > 0.08 : wetNow > 0.3;

    // 3D Altitude Fix: flying >3.2m overhead does NOT spook ground cat / butterflies or push NPCs off paths
    if (isHighAltitude) {
      groundProxyPos.set(playerPos.x + 120, world.geo.frame.ground, playerPos.z + 120);
      habitat.player.pos = groundProxyPos;
      habitat.player.speed = 0;
      habitat.player.vel = { x: 0, z: 0 };
    } else {
      habitat.player.pos = playerPos;
      habitat.player.speed = free.speed;
      habitat.player.vel = { x: free.velocity.x, z: free.velocity.z };
    }

    eco.update(dt, { clock: S.clock, time: S.time });
    life.update(S.clock);
    people.update(dt, S.clock, {
      player: isHighAltitude
        ? { x: playerPos.x + 120, z: playerPos.z + 120, speed: 0, mode: 'broom' }
        : { x: playerPos.x, z: playerPos.z, speed: free.speed, mode: free.mode },
      rain: isRaining,
      hours: S.clk.hours,
    });
    end();

    // Subsystem 5: Semantic Spatial Context & Science Station
    end = perf.beginSubsystem('spatial_sci');
    updatePlaceWitness(dt, playerPos);
    if (scienceDrawer.isOpen) scienceDrawer.tick(dt);
    end();

    // Shade adaptation + Pipeline Mood sync
    shadeTimer -= dt;
    if (shadeTimer <= 0) {
      shadeTimer = 0.25;
      shadeValue = shadeAt(world, focusPos);
    }
    eyeAdapt += (1 + 0.15 * shadeValue - eyeAdapt) * (1 - Math.exp(-dt * 1.2));
    pipeline.setMood({
      exposure: S.pal.exposure * eyeAdapt,
      sat: S.pal.sat,
      bloomStrength: S.pal.bloom,
      shadeHue: U.uShadeHue.value,
      horizon: U.uHorizon.value,
    });

    // Update authoritative WorldState snapshot
    store.state.world.clockMs = S.clock;
    store.state.world.clockMode = S.mode;
    store.state.world.eraId = S.eraId;
    store.state.world.haikouHour = +S.clk.hours.toFixed(2);
    store.state.world.dayOfYear = S.dayOfYear;
    store.state.world.weatherLabel = S.weatherWord;
    store.state.world.temperatureC = +(S.raw.temp ?? 26).toFixed(1);
    store.state.world.rainIntensity = +S.rainNow.toFixed(2);
    store.state.world.wetness = +S.cur.wet.toFixed(2);
    store.state.world.sunAltDeg = +S.sun.alt.toFixed(1);
    store.state.world.nightFactor = +S.pal.night.toFixed(2);
    store.state.user.locomotionMode = free.mode;
    store.state.user.position = [+playerPos.x.toFixed(2), +playerPos.y.toFixed(2), +playerPos.z.toFixed(2)];
    store.state.user.agl = +agl.toFixed(2);
    store.state.user.speedMs = +free.speed.toFixed(2);
  }

  // Smart GPU Workload Optimization:
  // 1) Shadow-caster culling: disable castShadow on static campus meshes far outside the 55m shadow box
  // 2) Throttled shadow-map update: refresh shadow map on frame 0, sun/weather changes, >0.8m movement, or every Nth frame
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const shadowCasters = [];
  const tmpBox = new THREE.Box3();
  const tmpCenter = new THREE.Vector3();
  world.group.traverse((o) => {
    if (o.isMesh && o.castShadow) {
      o.geometry?.computeBoundingBox?.();
      if (o.geometry?.boundingBox) {
        tmpBox.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
        tmpBox.getCenter(tmpCenter);
        const rad = tmpBox.getSize(new THREE.Vector3()).length() * 0.5;
        shadowCasters.push({ mesh: o, x: tmpCenter.x, z: tmpCenter.z, rad, dynamic: o.isSkinnedMesh || o.isInstancedMesh });
      }
    }
  });
  let shadowFrameIdx = 0;
  let lastShadowX = 1e9, lastShadowZ = 1e9, lastSunAlt = -999;
  const shadowCullDist = coarse ? 42 : 54;
  function updateShadowBudget(fx, fz, sunAlt, { skipShadowUpdate = false } = {}) {
    if (skipShadowUpdate) {
      renderer.shadowMap.needsUpdate = false;
      return;
    }
    shadowFrameIdx++;
    const moved = Math.hypot(fx - lastShadowX, fz - lastShadowZ) > 0.8;
    const sunChanged = Math.abs(sunAlt - lastSunAlt) > 0.35;
    const cadence = coarse ? 6 : 4;
    if (shadowFrameIdx === 1 || moved || sunChanged || shadowFrameIdx % cadence === 0) {
      for (const c of shadowCasters) {
        if (c.dynamic) { c.mesh.castShadow = true; continue; }
        c.mesh.castShadow = Math.hypot(c.x - fx, c.z - fz) <= shadowCullDist + c.rad;
      }
      renderer.shadowMap.needsUpdate = true;
      lastShadowX = fx;
      lastShadowZ = fz;
      lastSunAlt = sunAlt;
    } else {
      renderer.shadowMap.needsUpdate = false;
    }
  }

  function renderFrame(dtMs = 16.7, opts = {}) {
    renderer.info.reset();
    const end = perf.beginSubsystem('render');
    updateShadowBudget(focusPos.x, focusPos.z, lastClimate.sun.alt, opts);
    wake.render();
    pipeline.render(scene, camera);
    free.afterRender(canvas);
    end();
    perf.recordFrame(dtMs, renderer);
  }

  initUi();
  setLoad(0.95, '预编译画境着色器…');
  try {
    await renderer.compileAsync(scene, camera);
  } catch (err) {
    console.warn('[WorldEngine] compileAsync fallback:', err);
  }

  // Step once before revealing so shadows, sky, and camera are fully settled on frame 1
  step(1 / 30);
  renderFrame();
  const bootMs = Math.round(performance.now() - tBoot);
  setLoad(1, `世界就绪（${bootMs} ms）`);
  document.body.dataset.ready = '1';
  const loader = $('#we-loading');
  if (loader) {
    loader.classList.add('is-done');
    setTimeout(() => { loader.hidden = true; }, 450);
  }
  syncWorldClockUi();

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    followCam.aspect = innerWidth / innerHeight;
    followCam.updateProjectionMatrix();
    pipeline.setSize(innerWidth, innerHeight, tier.pr);
    if (mapDrawer.isOpen) mapDrawer.render();
  });

  // Register live entities into the unified EntityManager (proves shared spatial & multiplayer interfaces)
  entities.register({
    id: 'player:local',
    kind: 'avatar',
    assetId: 'char:student-m',
    transform: { x: SPAWN.x, y: heightAt(SPAWN.x, SPAWN.z), z: SPAWN.z, yaw: SPAWN.yaw },
    snapshot: () => {
      const p = free.position;
      return {
        id: 'player:local',
        assetId: 'char:student-m',
        mode: free.mode,
        transform: { x: p.x, y: p.y, z: p.z, yaw: free.ride.riding ? free.ride.state.yaw : player.state.yaw },
        speed: free.speed,
        roll: free.ride.state.roll || 0,
        steer: free.ride.state.steer || 0,
        crank: free.ride.state.crank || 0,
      };
    },
  });
  entities.register({
    id: 'creature:campus-cat',
    kind: 'creature',
    assetId: 'creature:campus-cat',
    transform: { x: cat.root.position.x, y: cat.root.position.y, z: cat.root.position.z, yaw: cat.root.rotation.y },
    update: () => {
      const ent = entities.get('creature:campus-cat');
      if (ent) {
        ent.transform.x = cat.root.position.x;
        ent.transform.y = cat.root.position.y;
        ent.transform.z = cat.root.position.z;
        ent.transform.yaw = cat.root.rotation.y;
      }
    },
  });
  for (const agent of life.agents) {
    const s0 = agent.live || agent.state || { x: 0, z: 0 };
    entities.register({
      id: `npc:${agent.id}`,
      kind: 'npc',
      assetId: agent.id === 'fu' ? 'char:teacher-f' : agent.id === 'wu' ? 'char:worker-m' : agent.id === 'lin' ? 'char:student-f' : 'char:student-m',
      transform: { x: s0.x ?? 0, y: world.geo.frame.ground, z: s0.z ?? 0, yaw: 0 },
      update: () => {
        const s = agent.live || agent.state;
        const ent = entities.get(`npc:${agent.id}`);
        if (s && ent && Number.isFinite(s.x) && Number.isFinite(s.z)) {
          ent.transform.x = s.x;
          ent.transform.z = s.z;
        }
      },
    });
  }

  let rafId = 0;
  let disposed = false;
  const threeClock = new THREE.Clock();
  function scheduleLoop() {
    if (!disposed && !paused && !rafId) {
      rafId = requestAnimationFrame(loop);
    }
  }
  function loop() {
    rafId = 0;
    if (disposed || paused) return;
    const rawSec = threeClock.getDelta();
    const dt = Math.min(rawSec, 1 / 20);
    step(dt);
    mapFrameSkip = mapDrawer.isOpen ? mapFrameSkip + 1 : 0;
    if (!mapDrawer.isOpen || mapFrameSkip % 4 === 1) {
      renderFrame(rawSec * 1000);
    }
    if (mapDrawer.isOpen && mapFrameSkip % 6 === 1) {
      mapDrawer.render();
    }
    scheduleLoop();
  }
  scheduleLoop();

  function disposeEngine() {
    if (disposed) return;
    disposed = true;
    if (rafId) cancelAnimationFrame(rafId);
    releaseLoop();
    pipeline.dispose();
    runtime.dispose();
    renderer.dispose();
  }
  addEventListener('pagehide', disposeEngine);

  // Clean public debug & acceptance API (used by automated Playwright tests & Workbench)
  window.__haizWorldEngine = {
    version: '1.1.0',
    bootMs,
    tier: tierName,
    sceneUuid: scene.uuid,
    runtime,
    bus,
    store,
    perf,
    assets,
    entities,
    graph,
    worldClock,
    pipeline,
    world,
    player,
    student,
    free,
    life,
    people,
    cat,
    butterflies,
    mapDrawer,
    scienceDrawer,
    selectLens,
    openMap,
    openScience,
    teleportTo: (id) => teleportTo(graph.get(id)),
    placeAvatar(x, z, yaw = 0.5) {
      const y = heightAt(x, z);
      player.state.pos.set(x, y, z);
      player.state.yaw = yaw;
      student.place?.(x, z, yaw);
      if (student.group) student.group.visible = true;
    },
    peerPacket: () => serializePeerPacket(entities.get('player:local')),
    dispose: disposeEngine,
    look(eye, at, fov = 44) {
      cameraOverride = eye ? { eye, at, fov } : null;
    },
    still(seconds = 0.5, fps = 30) {
      paused = true;
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      const n = Math.max(1, Math.round(seconds * fps));
      for (let i = 0; i < n; i++) step(1 / fps);
      renderFrame(1000 / fps);
      if (mapDrawer.isOpen) mapDrawer.render();
    },
    renderOnly() {
      paused = true;
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      renderFrame(16.7, { skipShadowUpdate: true });
    },
    resume() {
      paused = false;
      threeClock.getDelta();
      scheduleLoop();
    },
    telemetry() {
      return {
        bootMs,
        tier: tierName,
        sceneUuid: scene.uuid,
        loopOwner: runtime.loopOwner,
        entityCount: entities.count,
        lens: store.state.user.lens,
        authority: store.state.authority,
        world: store.state.world,
        user: {
          locomotionMode: store.state.user.locomotionMode,
          position: store.state.user.position,
          agl: store.state.user.agl,
          speedMs: store.state.user.speedMs,
        },
        cat: cat.describe?.() || null,
        perf: perf.snapshot(),
      };
    },
  };
}

boot().catch((err) => {
  console.error('[HAIZ World Engine] Boot error:', err);
  setLoad(1, `启动失败：${err.message || err}`);
  document.body.dataset.failed = '1';
});
