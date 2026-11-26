// HAIZ · 自由移动 — Campus Vehicles & Spatial Exploration Experiment Director
//
// Builds directly on HAIZ's high-precision living campus (twin/assets/runtime Atelier GLBs,
// 百年榄仁树, MakeHuman CC0 51-bone student, living NPCs, butterflies, orange cat, Haikou weather)
// and unifies:
//   - HAIZ painted-lab gouache material layer (core band + distance-stable brushstrokes + chromatic shade)
//   - Real cannon-es 0.20.0 (MIT) rigid-body & suspension physics + interactive campus props
//   - Five genuinely distinct movement modes (步行 / 单车 / 滑板 / 竹扫帚 / 榄仁纸鸢)
//   - Petalwake-inspired twin counter-rotating vortex wake -> grass, lawn, tree crowns, 砚池 water
//   - Eight campus microclimate thermal columns + audio variometer wind-chimes
//   - Anti-clutter spatial HUD (horizon orientation tape, kinetic whisper, foldable fast-travel map, Zen mode)
import * as THREE from 'three';
import { U } from '../../lanren/ruhua-stroll/atmos.js';
import { SKY } from '../../lanren/ruhua-stroll/sky.js';
import { createWalker } from '../../lanren/life/gait.js';
import { createPlayer } from '../../lanren/life/player.js';
import { buildNav } from '../../lanren/life/nav.js';
import { createLife } from '../../lanren/life/life.js';
import { createPeople } from '../../lanren/life/npc.js';
import { INKS } from '../../lanren/life/map.js';
import { UNIFORMS } from '../../lanren/js/foliage.js';
import { loadV4, V4_ROT } from '../../lanren/ruhua/v4.js';
import { createWorld, shadeAt } from '../../lanren/ruhua/world.js';
import { createPipeline } from '../../lanren/life/pipeline.js';
import { createRain } from '../../lanren/ruhua/fx.js';
import { createSource } from '../../lanren/ruhua/weather/source.js';
import { createWeather } from '../../lanren/ruhua/weather/weather.js';
import { haikouClock } from '../../lanren/ruhua/weather/model.js';
import { createHabitat, createEcosystem } from '../../lanren/ruhua/eco/habitat.js';
import { createFlowers } from '../../lanren/ruhua/eco/flowers.js';
import { createButterflies } from '../../lanren/ruhua/eco/butterflies.js';
import { createCat } from '../../lanren/ruhua/eco/cat.js';
import { pairMaterials } from '../../lanren/painted-lab/material.js';
import { createRoute } from '../../lanren/free/route.js';

import { createPhysics } from './physics.js';
import { createRig } from './rig.js';
import { createInput } from './input.js';
import { VortexWake } from './vortex.js';
import { createWake } from './wake.js';
import { createFX } from './fx.js';
import { createRide, MODES } from './ride.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';

const Q = new URLSearchParams(location.search);
const LANREN = new URL('../../lanren/', import.meta.url);
const asset = (p) => new URL(p, LANREN).href;
const coarse = matchMedia('(pointer: coarse)').matches || Q.get('touch') === '1';
if (coarse) document.body.classList.add('fm-coarse');

const TIERS = {
  high: { pr: Math.min(devicePixelRatio || 1, 2), shadow: 4096, samples: 4, paint: 3072, leafDensity: 1.0, isletGrass: 9000 },
  medium: { pr: Math.min(devicePixelRatio || 1, 1.5), shadow: 2048, samples: 2, paint: 2048, leafDensity: 0.7, isletGrass: 6000 },
  low: { pr: Math.min(devicePixelRatio || 1, 1), shadow: 1024, samples: 0, paint: 2048, leafDensity: 0.45, isletGrass: 3000 },
};
const tierName = TIERS[Q.get('quality')] ? Q.get('quality') : (coarse ? 'medium' : 'high');
const tier = TIERS[tierName];
const LAYER_PAINT = 2;

const REACT = {
  lin: {
    bike: ['骑慢些，林荫道刚落了一层榄仁叶。', '车筐里那本速写本快露出来啦。'],
    bell: ['听见啦，让给你走。'],
    board: ['滑板转弯好稳，小心路沿。'],
    broom: ['……那是吴伯今早刚扎好的竹扫帚吧？', '树冠上面看校园是什么颜色？'],
    glider: ['哇，那片大榄仁叶在阳光下是半透明的！', '乘着海风飞过去，像一幅会动的画。'],
  },
  chen: {
    bike: ['借我骑两圈！比比谁先到篮球场？'],
    bell: ['叮什么叮，马上让开！'],
    board: ['再来一个 Kickflip！', '跑道那边滑起来更爽！'],
    broom: ['带我飞一圈呗！'],
    glider: ['酷毙了！操场那边上升气流最强！'],
  },
  fu: {
    bike: ['校园骑行注意车速，弯道提前减速。'],
    bell: ['嗯，提前打铃很有礼貌。'],
    board: ['注意角动量与重心偏移，别磕着。'],
    broom: ['这绕流尾涡挺有意思，下来聊聊伯努利原理。'],
    glider: ['无动力滑翔靠热气流与升阻比——飞得很漂亮！'],
  },
  wang: {
    bike: ['（从书页间抬起眼）……'],
    bell: ['啊，抱歉，我走神挡道了。'],
    board: ['轮子压过石板缝的声音很有节奏。'],
    broom: ['像故事里写的那样掠过屋檐。'],
    glider: ['纸鸢借风，比扫帚更安静。'],
  },
  wu: {
    bike: ['车停放整齐些。'],
    bell: ['好好好，让你先过。'],
    board: ['别把台阶棱角蹭坏了。'],
    broom: ['哎——我的竹扫帚！飞稳点，用完记得还我。'],
    glider: ['好大的榄仁叶！这海风真托得起人。'],
  },
};

const HINTS = {
  walk: 'WASD 漫步 · Shift 奔跑 · 空格 跳 · 1-5 切换载具 · M 地图/直达 · H 纯净画面',
  bike: 'W 蹬车 · Shift 站立摇车 · S 刹车 · 空格 铜铃 · V 车把第一视角 · M 地图',
  board: 'W 蹬地 · A/D 左右S形泵滑加速 · Shift 板尾平衡 · 空格 Ollie · Q 尖翻 · V 视角',
  broom: 'W 巡航 · Shift 乘风疾飞 · 空格 升 · C 降 · 贴地/掠水蓄能 · 双击空格 屋顶栖风',
  glider: 'A/D 压翼盘旋 · W/C 俯冲增速 · S/空格 拉升 · 飞入金色热流柱自动攀升 · V 翼下视角',
};

const $ = (s) => document.querySelector(s);

function setProgress(pct, text) {
  const bar = $('#fm-bar i');
  const st = $('#fm-status');
  if (bar) bar.style.width = `${Math.round(pct * 100)}%`;
  if (st && text) st.textContent = text;
}

function showLine(who, text) {
  const el = $('#fm-line');
  if (!el) return;
  el.querySelector('b').textContent = who;
  el.querySelector('span').textContent = text;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('on'));
  clearTimeout(showLine._t);
  showLine._t = setTimeout(() => {
    el.classList.remove('on');
    setTimeout(() => { el.hidden = true; }, 450);
  }, 4000);
}

function dayOfYear(ms) {
  const c = haikouClock(ms);
  return Math.round((Date.UTC(c.y, c.m - 1, c.d) - Date.UTC(c.y, 0, 1)) / 86400000) + 1;
}

async function main() {
  const t0 = performance.now();
  const canvas = $('#fm-canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: false, powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(tier.pr);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.info.autoReset = false;

  const scene = new THREE.Scene();
  const followCam = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 6000);
  const pipeline = createPipeline(renderer, { samples: tier.samples });
  pipeline.setBase(tier.pr);
  pipeline.setSize(innerWidth, innerHeight);

  // Weather: default sunlit golden afternoon (16:25 clear) for unmistakable tropical painterly craft,
  // or ?live=1 for real-time Haikou weather! Users can toggle any weather/hour in 1 click.
  const source = createSource({ onUpdate: () => weather.onForecast() });
  const weather = createWeather({ source });
  source.start();
  const wxPreset = Q.get('wx') || 'clear';
  const hourPreset = Q.has('hour') ? Number(Q.get('hour')) : 16.4;
  if (Q.get('live') !== '1') weather.setFree(wxPreset, Number.isFinite(hourPreset) ? hourPreset : 16.4);

  setProgress(0.12, '载入海南中学府城校区与百年榄仁树…');
  const [campus, v4] = await Promise.all([
    fetch(asset('../assets/walk/campus.json')).then((r) => r.json()),
    loadV4(asset('assets/'), { mobile: coarse, onProgress: (p) => setProgress(0.12 + p * 0.25) }),
  ]);

  setProgress(0.42, '绘制校园地面与光影大气…');
  const world = await createWorld({ campus, v4, tier, asset, say: (s) => setProgress(0.48, s) });
  world.sceneRoot = scene;
  scene.add(world.group);

  setProgress(0.58, '载入高精度府城校园建筑群…');
  await world.loadCampus();

  setProgress(0.74, '准备角色骨骼与物理引擎…');
  const heightAt = (x, z) => world.heightAt(x, z);
  // Spawn on the sunlit paved central axis facing 一号教学楼 portico, 太湖石, and 百年榄仁树!
  const spawn = { x: -35.2, z: -34.0, yaw: 0.08 };
  const student = await createWalker(asset('assets/life/student-m.glb'), {
    heightAt, x: spawn.x, z: spawn.z, yaw: spawn.yaw, fade: true, hair: 'short',
  });
  student.root.visible = true;
  world.group.add(student.root);

  const rain = createRain({ world, mobile: coarse, layer: LAYER_PAINT });
  world.group.add(rain.group);

  const habitat = createHabitat({ world, weather });
  const flowers = createFlowers(habitat, {
    extra: [{ x: 46, z: 58 }, { x: 63, z: 58.5 }, { x: 79, z: 69 }, { x: 52, z: 80 }, { x: 87, z: 79 }, { x: 108, z: 79.5 }],
  });
  world.group.add(flowers.group);
  world.rebuild();

  // Living Campus NPCs & Ecosystem
  const nav = buildNav({ colliders: world.colliders, features: world.geo.features, bounds: { x0: -300, x1: 200, z0: -140, z1: 300 } });
  let raining = false;
  const life = createLife({ nav, isRaining: () => raining });
  const people = createPeople({
    life, url: asset('assets/life/student-m.glb'), heightAt,
    getColliders: () => world.colliders, layer: LAYER_PAINT, mobile: coarse,
    say: (who, line) => showLine(who, line),
  });
  world.group.add(people.group);

  const eco = createEcosystem({ habitat });
  const butterflies = eco.add(createButterflies(habitat, { max: coarse ? 14 : 24, layer: LAYER_PAINT }));
  world.group.add(butterflies.mesh);
  const cat = eco.add(createCat(habitat, { layer: LAYER_PAINT, butterflies }));
  world.group.add(cat.root);

  // Activate HAIZ painted-lab gouache material pipeline (core band + brushstroke + chromatic shade)
  // BEFORE wake shader patching & precompilation so every building, ground, flora, and prop feels painted as ONE!
  let materialPairs = null;
  if (Q.get('style') !== 'v2') {
    materialPairs = pairMaterials(world.group);
    materialPairs.lab();
  }

  // Real cannon-es physics + interactive campus props
  const physics = createPhysics({ world, layer: LAYER_PAINT, heightAt });
  // Twin counter-rotating vortex wake + 384² world-space GPU field (grass, lawn, crowns, 砚池 water!)
  const vortex = new VortexWake(heightAt);
  const wake = createWake({ renderer, world, vortex });
  const fx = createFX({ world, wake, layer: LAYER_PAINT, maxLeaves: coarse ? 340 : 720, maxSpray: coarse ? 180 : 420 });
  const route = createRoute({ world, layer: LAYER_PAINT });

  // Surface lookup (lawn vs paving from HAIZ's painted ground mask)
  const mask = world.ground.mask;
  const md = mask.g.getImageData(0, 0, mask.c.width, mask.c.height).data, mw = mask.c.width;
  const surface = (x, z) => {
    const u = (x - mask.x0) / mask.span, v = (z - mask.z0) / mask.span;
    if (u < 0 || v < 0 || u >= 1 || v >= 1) return 'pave';
    return md[(Math.floor(v * mw) * mw + Math.floor(u * mw)) * 4] > 110 ? 'lawn' : 'pave';
  };

  // Walking player controller + 5-mode ride system
  const pois = [{ x: 0, y: 8, z: 0, r: 140, w: 3 }];
  const player = createPlayer({
    camera: followCam, dom: canvas, student,
    getColliders: () => world.colliders, heightAt, spawn, coarse, pois,
  });
  player.bindStick($('#fm-stick'));
  player.setEnabled(true);

  const rig = createRig(student);
  const input = createInput({ dom: canvas, stickEl: $('#fm-stick'), padEl: $('#fm-pad') });
  const audio = createAudio();

  const listeners = [];
  const ride = createRide({
    world, student, rig, input, physics, fx, followCam, layer: LAYER_PAINT,
    player: () => player, heightAt, getColliders: () => world.colliders, surface,
    onEvent: (name, data) => { for (const fn of listeners) fn(name, data); },
  });

  // Ensure every object in world is on LAYER_PAINT
  world.group.traverse((o) => o.layers.set(LAYER_PAINT));
  pipeline.setGround(world.ground);
  world.tree.setDay(dayOfYear(weather.state.clock));

  // Spatial Anti-Clutter HUD + Foldable Fast-Travel Map + Sketchbook
  let wantSketch = false;
  const hud = createHud({
    world, nav,
    onRoute: (r) => {
      if (r && r.arrived) { showLine('抵达', `已到达 ${r.arrived}`); route.set(null); return; }
      route.set(r);
    },
    onTeleport: (x, z, label) => {
      ride.teleportTo(x, z);
      showLine('直达', `已前往 ${label}`);
    },
    onSketch: (v) => {
      audio.event('sketch');
      showLine('速写', `「${v.name}」已收入速写本`);
    },
  });

  // Wire UI buttons & keyboard shortcuts
  const modeBar = $('#fm-modes');
  const padEl = $('#fm-pad');
  const hintStrip = $('#fm-hint-strip');
  const viewBtn = $('#fm-view-btn');
  const mapBtn = $('#fm-map-btn');
  const zenBtn = $('#fm-zen-btn');
  const zenRestore = $('#fm-zen-restore');
  const bookBtn = $('#fm-book-btn');
  const soundBtn = $('#fm-sound-btn');
  const wxBtn = $('#fm-wx-btn');
  const wxPanel = $('#fm-wx-panel');

  const syncModeUI = () => {
    const m = ride.mode, ph = ride.phase;
    const activeMode = ride.state.want && ph !== 'ride' ? ride.state.want : m;
    for (const b of modeBar.querySelectorAll('[data-mode]')) {
      b.setAttribute('aria-pressed', String(b.dataset.mode === activeMode));
    }
    document.body.dataset.ride = ph === 'free' ? 'walk' : m;
    if (padEl) padEl.dataset.mode = (ph === 'ride' || ph === 'mount') ? m : 'none';
    if (hintStrip) hintStrip.textContent = HINTS[activeMode] || HINTS.walk;
    if (viewBtn) {
      viewBtn.setAttribute('aria-pressed', String(ride.cam.firstPerson));
      viewBtn.querySelector('span').textContent = ride.cam.firstPerson ? '第一视角' : '跟随视角';
    }
  };

  modeBar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]');
    if (!b) return;
    const m = b.dataset.mode;
    ride.request(m === ride.mode && m !== 'walk' ? 'walk' : m);
  });

  viewBtn?.addEventListener('click', () => {
    if (!ride.riding) { showLine('视角', '切换任一载具后按 V 可进入第一人称驾驶视角'); return; }
    ride.toggleView();
    syncModeUI();
  });
  mapBtn?.addEventListener('click', () => hud.toggleMap());
  $('#fm-map-close')?.addEventListener('click', () => hud.toggleMap(false));
  $('#fm-map-clear')?.addEventListener('click', () => { hud.setDest(null); showLine('路线', '已清除导航路线'); });
  $('#fm-map-drawer')?.addEventListener('click', (e) => { if (e.target.id === 'fm-map-drawer') hud.toggleMap(false); });

  bookBtn?.addEventListener('click', () => hud.toggleBook());
  $('#fm-book-close')?.addEventListener('click', () => hud.toggleBook(false));
  $('#fm-book')?.addEventListener('click', (e) => { if (e.target.id === 'fm-book') hud.toggleBook(false); });
  $('#fm-vista-btn')?.addEventListener('click', () => { wantSketch = true; });

  zenBtn?.addEventListener('click', () => hud.toggleZen());
  zenRestore?.addEventListener('click', () => hud.toggleZen(false));

  soundBtn?.addEventListener('click', () => {
    audio.boot();
    const on = audio.toggle();
    soundBtn.setAttribute('aria-pressed', String(!on));
    soundBtn.querySelector('span').textContent = on ? '声景' : '静音';
  });

  // Weather & Time Popover
  wxBtn?.addEventListener('click', () => {
    if (!wxPanel) return;
    wxPanel.hidden = !wxPanel.hidden;
    wxBtn.setAttribute('aria-expanded', String(!wxPanel.hidden));
  });
  $('#fm-wx-close')?.addEventListener('click', () => { if (wxPanel) wxPanel.hidden = true; });
  wxPanel?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-wx],[data-hour],[data-live]');
    if (!b) return;
    if (b.dataset.live) {
      weather.setLive();
      wxPanel.querySelectorAll('[data-wx],[data-hour]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
    } else if (b.dataset.wx) {
      weather.setFree(b.dataset.wx, undefined);
      wxPanel.querySelectorAll('[data-wx]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      wxPanel.querySelector('[data-live]')?.setAttribute('aria-pressed', 'false');
    } else if (b.dataset.hour) {
      weather.setFree(undefined, Number(b.dataset.hour));
      wxPanel.querySelectorAll('[data-hour]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      wxPanel.querySelector('[data-live]')?.setAttribute('aria-pressed', 'false');
    }
  });

  const MODE_KEYS = { Digit1: 'walk', Digit2: 'bike', Digit3: 'board', Digit4: 'broom', Digit5: 'glider' };
  addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (MODE_KEYS[e.code]) {
      const m = MODE_KEYS[e.code];
      ride.request(m === ride.mode && m !== 'walk' ? 'walk' : m);
    } else if (e.code === 'KeyE' && ride.mode === 'walk') {
      const P = player.state;
      if (ride.nearParked(P.pos.x, P.pos.z)) ride.request('bike');
    } else if (e.code === 'KeyV' && ride.riding) {
      ride.toggleView(); syncModeUI();
    } else if (e.code === 'KeyM' || e.code === 'KeyN') {
      hud.toggleMap();
    } else if (e.code === 'KeyH') {
      hud.toggleZen();
    } else if (e.code === 'KeyF') {
      wantSketch = true;
    } else if (e.code === 'Escape') {
      if (hud.mapOpen) hud.toggleMap(false);
      else if (hud.bookOpen) hud.toggleBook(false);
      else if (hud.zen) hud.toggleZen(false);
      else if (wxPanel && !wxPanel.hidden) wxPanel.hidden = true;
    }
  });

  // NPC contextual reactions
  let lastReact = -99, simClock = 0, lampK = 0;
  const said = new Map();
  function reactNPC(kind) {
    if (simClock - lastReact < 8.5) return;
    const R = ride.state;
    for (const [id, b] of people.bodies || []) {
      if (!b.active || b.fade < 0.9) continue;
      const fp = b.fig.position;
      const d = Math.hypot(fp.x - R.pos.x, fp.z - R.pos.z);
      const dy = R.pos.y - fp.y;
      const near = (kind === 'broom' || kind === 'glider') ? d < 14 && dy > 1.5 && dy < 18 : kind === 'bell' ? d < 12 : d < 4.2;
      if (!near) continue;
      const lines = REACT[id]?.[kind];
      if (!lines) continue;
      const k = id + kind;
      if (simClock - (said.get(k) ?? -999) < 80) continue;
      said.set(k, simClock); lastReact = simClock;
      showLine(life.byId.get(id).person.name, lines[(said.size + Math.floor(simClock)) % lines.length]);
      break;
    }
  }
  listeners.push((name, data) => {
    audio.event(name, data);
    if (name === 'bell') reactNPC('bell');
  });

  // Weather -> World sync
  const lampsAt = (night, hours) => night * (hours >= 18.3 && hours < 22.6 ? 1 : hours >= 22.6 && hours < 23.6 ? 1 - (hours - 22.6) * 0.8 : hours >= 5.6 && hours < 7.2 ? 0.45 : 0.12);
  const v4wind = new THREE.Vector3();
  let lifeT = 0;
  function applyWeather(dt) {
    const S = weather.update(dt);
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
    U.uWindSpeed.value = C.windSpeed; U.uWindGust.value = C.gust; U.uWindSway.value = C.sway;
    U.uWet.value = C.wet; U.uPuddle.value = C.puddle; U.uRain.value = Math.min(1, S.rainNow);
    U.uNight.value = P.night; U.uLamps.value = lampsAt(P.night, haikouClock(S.clock).hours);
    world.sky.drift = 0.6 + C.windSpeed * 0.4;
    const c = Math.cos(-V4_ROT), s = Math.sin(-V4_ROT);
    v4wind.set(C.windDir[0] * c + C.windDir[1] * s, 0, -C.windDir[0] * s + C.windDir[1] * c);
    UNIFORMS.uWindDir.value.copy(v4wind).normalize();
    UNIFORMS.uWind.value = Math.min(1.3, C.sway * 0.38);
    UNIFORMS.uGust.value = 0.5 + 0.5 * Math.sin(S.time * 0.21) * Math.sin(S.time * 0.13 + 1);
    UNIFORMS.uTime.value = S.time;
    const lag = S.clock - lifeT;
    if (Math.abs(lag) > 90000) lifeT = S.clock;
    else lifeT += dt * 1000;
    return S;
  }

  // Warm up player & precompile shaders
  setProgress(0.9, '预热着色器与画布…');
  applyWeather(0.016);
  for (let i = 0; i < 40; i++) player.update(1 / 30);
  try { await renderer.compileAsync(scene, followCam); } catch (e) { console.warn('precompile', e); }

  addEventListener('resize', () => {
    pipeline.setSize(innerWidth, innerHeight);
    followCam.aspect = innerWidth / innerHeight;
    followCam.updateProjectionMatrix();
  });

  // Main Simulation Step
  const focus = new THREE.Vector3(), lookDir = new THREE.Vector3();
  const feedState = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), mode: 'walk', agl: 0, speed: 0, yaw: 0, roll: 0, turnRate: 0, boost: 0, inCrown: 0, surface: 'pave', carve: 0, braking: false, ribbonAnchors: null };
  const peoplePts = [];
  let adapt = 1, shade = 0, shadeT = 0, frameMs = 16, overrideCam = null;

  function step(dt) {
    simClock += dt;
    U.uTime.value += dt;
    pipeline.tick(dt);
    const W = applyWeather(dt);

    // 1. Update Ride / Walk controller
    ride.update(dt);
    syncModeUI();

    const R = ride.state;
    const P = player.state;
    const riding = ride.riding;
    const curPos = riding ? R.pos : P.pos;
    const curVel = riding ? R.vel : new THREE.Vector3(P.vel.x, 0, P.vel.y);
    const curMode = riding && ride.phase !== 'summon' ? ride.mode : 'walk';

    // Bike dusk/night headlamp
    const night = W.pal?.night ?? 0;
    const lampOn = riding && ride.mode === 'bike' && ride.phase !== 'dismount' ? Math.min(1, Math.max(0, (night - 0.25) / 0.4)) : 0;
    lampK += (lampOn - lampK) * (1 - Math.exp(-dt * (lampOn > lampK ? 5 : 2.5)));
    ride.machines.bike.setLamp(lampK < 0.005 ? 0 : lampK, R.roll || 0);

    // 2. Step cannon-es physics + Vortex Wake + Environmental FX
    feedState.pos.copy(curPos);
    feedState.vel.copy(curVel);
    feedState.mode = curMode;
    feedState.agl = (curMode === 'broom' || curMode === 'glider') ? R.agl : 0;
    feedState.speed = riding ? R.speed : P.speed;
    feedState.yaw = riding ? R.yaw : P.yaw;
    feedState.roll = riding ? R.roll : 0;
    feedState.turnRate = riding ? R.turnRate : 0;
    feedState.boost = riding ? R.boost : 0;
    feedState.inCrown = (curMode === 'broom' || curMode === 'glider') ? R.inCrown : 0;
    feedState.surface = surface(curPos.x, curPos.z);
    feedState.carve = R.carve;
    feedState.braking = R.braking;
    feedState.ribbonAnchors = (curMode === 'broom' || curMode === 'glider') ? R.ribbonAnchors : null;

    wake.feed(dt, feedState, UNIFORMS, W.time);
    physics.update(dt, curPos, curVel, vortex);
    fx.update(dt, feedState, followCam.position);

    // 3. Camera override (for controlled review/demos) or live camera
    if (overrideCam) {
      followCam.position.set(...overrideCam.eye);
      followCam.lookAt(...overrideCam.at);
      if (overrideCam.fov && Math.abs(followCam.fov - overrideCam.fov) > 0.01) {
        followCam.fov = overrideCam.fov; followCam.updateProjectionMatrix();
      }
    }

    // 4. World, Grass, Rain, Living NPCs & Ecosystem
    focus.copy(curPos);
    world.day.update(dt, focus);
    world.sky.update(dt, focus);
    followCam.updateMatrixWorld();
    world.grass.update(followCam, focus, world.geo.frame.ground);
    rain.update(dt, weather, followCam.position);
    student.setUmbrella?.((W.rainNow > 0.1 || W.cur.rain > 0.15) && !riding);

    habitat.player.pos = curPos;
    habitat.player.speed = feedState.speed;
    habitat.player.vel = { x: curVel.x, z: curVel.z };
    eco.update(dt, { clock: W.clock, time: W.time });
    const wet = Math.max(W.rainNow, W.cur.rain);
    raining = raining ? wet > 0.08 : wet > 0.3;
    life.update(lifeT);
    people.update(dt, lifeT, { player: { x: curPos.x, z: curPos.z, speed: feedState.speed, mode: curMode }, rain: raining, hours: haikouClock(W.clock).hours });

    if (riding && ride.phase === 'ride') {
      if ((curMode === 'bike' && R.speed > 2.8) || (curMode === 'board' && R.speed > 2.4) || ((curMode === 'broom' || curMode === 'glider') && R.agl > 1.5)) {
        reactNPC(curMode);
      }
    }

    // 5. Route & Anti-Clutter Spatial HUD
    route.update(dt, curPos);
    peoplePts.length = 0;
    for (const a of life.agents) {
      const s = a.live || a.state;
      if (s && !a.state?.inside && !a.state?.away) peoplePts.push({ x: s.x, z: s.z, ink: INKS[a.id] || '#333' });
    }
    const crown = world.crowns[world.crowns.length - 1];
    const lx = (curPos.x - crown.x) / crown.r, ly = (curPos.y - crown.y) / crown.ry, lz = (curPos.z - crown.z) / crown.r;
    const top = ride.solids.topAt(curPos.x, curPos.z);
    followCam.getWorldDirection(lookDir);

    const vistaCtx = {
      mode: curMode, x: curPos.x, z: curPos.z, agl: feedState.agl, speed: feedState.speed,
      hours: haikouClock(W.clock).hours, raining,
      onRoof: curMode === 'broom' && top > world.geo.frame.ground + 3 && Math.abs(curPos.y - top) < 2.2,
      perched: R.perched,
      inLanshu: (curMode === 'broom' || curMode === 'glider') ? Math.max(0, 1 - (lx * lx + ly * ly + lz * lz)) : 0,
      thermalLift: R.thermalLift, overWater: R.overWater, air: R.air, lookUp: lookDir.y > 0.22,
    };
    hud.update(dt, {
      pos: curPos, speed: feedState.speed, mode: curMode, riding: riding && ride.phase !== 'dismount',
      camYaw: riding ? ride.cam.yaw : player.cam.yaw.v, heading: feedState.yaw,
      agl: feedState.agl, cadence: R.cadence * 60 / (Math.PI * 2), stand: R.stand,
      pushes: R.pushes, air: R.air, manual: R.manual, carveFlow: R.carveFlow,
      perched: R.perched, gust: R.gust, thermalLift: R.thermalLift, thermalName: R.thermalName,
      overWater: R.overWater, trickLabel: R.trickLabel, trickT: R.trickT,
      parked: R.parked, people: peoplePts,
    }, vistaCtx);

    // Prompt near parked bike or rooftop perch
    const promptEl = $('#fm-prompt');
    if (promptEl) {
      const nearBike = !riding && ride.nearParked(P.pos.x, P.pos.z);
      const canPerch = riding && curMode === 'broom' && !R.perched && vistaCtx.onRoof && R.speed < 5;
      if (nearBike) { promptEl.hidden = false; promptEl.textContent = coarse ? '轻点「骑」骑上停放的单车' : '按 E 重新骑上单车'; }
      else if (canPerch) { promptEl.hidden = false; promptEl.textContent = coarse ? '轻点「栖」在屋顶落脚' : '双击空格 · 在屋顶栖风环顾'; }
      else promptEl.hidden = true;
    }

    // 6. Procedural Soundscape
    audio.update(dt, {
      mode: curMode, speed: feedState.speed, surface: feedState.surface, air: R.air,
      inCrown: feedState.inCrown, coasting: R.pedalling < 0.5, boost: R.boost,
      roll: R.roll, agl: feedState.agl, overWater: R.overWater, thermalLift: R.thermalLift,
    });

    // 7. Eye shade adaptation + weather button caption (tame daytime bloom so gouache stays crisp while dusk/night lamps glow!)
    shadeT -= dt;
    if (shadeT <= 0) { shadeT = 0.22; shade = shadeAt(world, focus); }
    adapt += (1 + 0.16 * shade - adapt) * (1 - Math.exp(-dt * 1.1));
    pipeline.setGrade(W.pal.exposure * adapt, W.pal.sat, W.pal.bloom * (0.22 + 0.78 * night));
    const cap = weather.caption();
    if (wxBtn) wxBtn.querySelector('span').textContent = `${cap.clock} · ${cap.name}`;
    const wxDet = $('#fm-wx-detail');
    if (wxDet) wxDet.textContent = `海口府城 · ${cap.clock} · ${cap.name} ${cap.temp}°C`;
  }

  function render() {
    renderer.info.reset();
    wake.render();
    pipeline.renderPainted(scene, followCam, null);
    followCam.layers.enableAll();
    if (wantSketch) {
      wantSketch = false;
      const cap = weather.caption();
      const k = haikouClock(weather.state.clock);
      hud.captureSketch(canvas, `${k.m} 月 ${k.d} 日 ${cap.clock} · 海口 ${cap.name} ${cap.temp}°`);
    }
  }

  const clock = new THREE.Clock();
  let paused = false;
  function frame() {
    const raw = clock.getDelta();
    if (!paused) {
      step(Math.min(raw, 1 / 20));
      render();
      frameMs = frameMs * 0.92 + raw * 1000 * 0.08;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  setProgress(1, '就绪');
  document.body.dataset.stage = 'ready';
  setTimeout(() => { $('#fm-loading')?.remove(); }, 460);
  syncModeUI();
  setTimeout(() => showLine('HAIZ · 自由移动', '按 1–5 切换步行、单车、滑板、竹扫帚与榄仁纸鸢，按 M 打开校园地图'), 900);

  // Public inspection & test handle
  window.__haizMove = {
    world, scene, followCam, renderer, pipeline, weather, student, player, rig, ride, input,
    physics, vortex, wake, fx, hud, route, audio, materialPairs,
    MODES,
    setMode(m) { return ride.request(m); },
    setFirstPerson(on) { ride.setFirstPerson(on); syncModeUI(); },
    teleport(x, z, yaw) { ride.teleportTo(x, z, yaw); },
    setWeather(wx, hour) { weather.setFree(wx, hour); },
    look(eye, at, fov = 48) { overrideCam = eye ? { eye, at, fov } : null; },
    step(seconds = 1, fps = 30) {
      $('#fm-loading')?.remove();
      paused = true;
      const n = Math.max(1, Math.round(seconds * fps));
      for (let i = 0; i < n; i++) step(1 / fps);
      render();
    },
    resume() { paused = false; clock.getDelta(); },
    info: () => ({
      bootMs: Math.round(performance.now() - t0),
      tier: tierName,
      calls: renderer.info.render.calls,
      tris: renderer.info.render.triangles,
      fps: +(1000 / Math.max(1, frameMs)).toFixed(1),
      ms: +frameMs.toFixed(1),
      ride: ride.snapshot(),
      wake: wake.stats(),
      fx: fx.stats(),
      physics: physics.stats(),
      gouache: materialPairs ? materialPairs.state : 'v2',
    }),
  };
}

main().catch((e) => {
  console.error(e);
  const st = $('#fm-status');
  if (st) st.textContent = '三维场景启动失败：' + (e.message || e);
});
