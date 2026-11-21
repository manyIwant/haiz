// HAIZ · 第六幕「入画」— from the remembered tree, into the painting, and on into a campus that keeps
// its own weather. See docs/ruhua-20261117.md for the art decisions.
//
//   hold     chapter 06: the walker has turned and looks back at the tree (V4's frame and light)
//   easel    an easel is set up between the eye and the tree; the canvas hides what it will show
//   paint    the player paints it: 起稿 → 铺色 → 塑形 → 点叶; a seal and the date
//   spill    the brush goes past the frame: what it touches turns to paint
//   depart   the walker steps aside; the paint leaves the canvas along the sight lines and lands
//            on the tree, the ground, the building; the canvas keeps only its charcoal
//   spread   the painting goes on from the tree across the campus, and today's sky comes over
//   enter    the eye rises out of the walker and draws back: the walker stands in the painting
//   stroll   the walk (V2), under Haikou's weather now, with its butterflies and its cat
import * as THREE from 'three';
import { U } from '../ruhua-stroll/atmos.js';
import { SKY } from '../ruhua-stroll/sky.js';
import { createStudent } from '../ruhua-stroll/student.js';
import { createWalker } from './gait.js';
import { createPlayer } from './player.js';
import { createPlayer as createOldPlayer } from '../ruhua-stroll/player.js';
import { buildNav } from './nav.js';
import { createLife } from './life.js';
import { createPeople } from './npc.js';
import { createMap, INKS } from './map.js';
import { ACT_LABEL } from './people.js';
import { UNIFORMS } from '../js/foliage.js';
import { loadV4, SHOT6, sun6Dir, LIGHT6, V4_ROT } from '../ruhua/v4.js';
import { createWorld, shadeAt } from '../ruhua/world.js';
import { createRealWorld } from '../ruhua/realworld.js';
import { createPipeline } from './pipeline.js';
import { createEasel } from './easel.js';
import { createRain } from '../ruhua/fx.js';
import { PAINT, NO_PROJECTION, sideOf, twin } from '../ruhua/paintfield.js';
import { createSource } from '../ruhua/weather/source.js';
import { createWeather } from '../ruhua/weather/weather.js';
import { haikouClock } from '../ruhua/weather/model.js';
import { createUI } from '../ruhua/ui.js';
import { createHabitat, createEcosystem } from '../ruhua/eco/habitat.js';
import { createFlowers } from '../ruhua/eco/flowers.js';
import { createButterflies } from '../ruhua/eco/butterflies.js';
import { createCat } from '../ruhua/eco/cat.js';

const Q = new URLSearchParams(location.search);
const ROOT = new URL('../', import.meta.url);
const asset = (p) => new URL(p, ROOT).href;
const coarse = matchMedia('(pointer: coarse)').matches;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TIERS = {
  high: { pr: Math.min(devicePixelRatio, 2), shadow: 4096, samples: 4, paint: 3072, leafDensity: 1.0, isletGrass: 9000 },
  medium: { pr: Math.min(devicePixelRatio, 1.5), shadow: 2048, samples: 4, paint: 2048, leafDensity: 0.7, isletGrass: 6000 },
  low: { pr: Math.min(devicePixelRatio, 1), shadow: 2048, samples: 0, paint: 2048, leafDensity: 0.45, isletGrass: 3000 },
};
const tierName = TIERS[Q.get('quality')] ? Q.get('quality') : (coarse ? 'medium' : 'high');
const tier = TIERS[tierName];
const LAYER_REAL = 1, LAYER_PAINT = 2;
const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const smoother = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * x * (x * (x * 6 - 15) + 10); };
// the transition's clock, relative to the moment the walker steps aside
// (the exit from the body starts once the tree and the sky are painted; the campus goes on filling in
// behind the dolly and the walk is handed back when the dolly ends — see 'finishing')
const T = { project: 0.9, front: 2.2, sky: 3.3, enter: 6.8, enterDur: 4.4, done: 14.4 };
if (reduce) Object.assign(T, { project: 0.4, front: 1.2, sky: 1.8, enter: 4.6, enterDur: 1.6, done: 9.5 });

async function main() {
  const ui = createUI({ coarse });
  // a word from someone passing: shown at the foot of the picture, then gone
  {
    const el = document.querySelector('#lf-line');
    let timer = 0;
    ui.line = (who, text) => {
      if (!el) return;
      el.querySelector('b').textContent = who; el.querySelector('span').textContent = text;
      el.hidden = false; requestAnimationFrame(() => el.classList.add('on'));
      clearTimeout(timer); timer = setTimeout(() => { el.classList.remove('on'); setTimeout(() => { el.hidden = true; }, 800); }, 4200);
    };
  }
  const t0 = performance.now();
  const canvas = document.querySelector('#rh-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: Q.has('capture') });
  renderer.setPixelRatio(tier.pr);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.info.autoReset = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 6000);
  const followCam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 6000);
  const pipeline = createPipeline(renderer, { samples: tier.samples });
  pipeline.setBase(tier.pr);
  pipeline.setSize(innerWidth, innerHeight);

  // ---------------------------------------------------------------- weather first: the painting needs today's sky
  const source = createSource({ onUpdate: () => weather.onForecast() });
  const weather = createWeather({ source });
  source.start();

  ui.say('读取校园与榄仁树…');
  const [campus, v4] = await Promise.all([
    fetch(asset('../assets/walk/campus.json')).then((r) => r.json()),
    loadV4(asset('assets/'), { mobile: coarse, onProgress: (p) => ui.progress(p * 0.35) }),
  ]);
  ui.say('画出校园…');
  const world = await createWorld({ campus, v4, tier, asset, say: ui.say });
  world.sceneRoot = scene;
  scene.add(world.group);
  ui.progress(0.45);
  const real = createRealWorld({ world, v4, tier, LAYER: LAYER_REAL });
  scene.add(real.group);
  ui.say('校园建筑载入中（约 11 MB）…');
  await world.loadCampus();
  real.addCampus(world.campusV3);
  ui.progress(0.8);
  // the walker (scripts/ruhua/build_student.py, walked by walker.js); V2's figure if it cannot load (?figure=v2 to compare)
  // the walker: the living campus's gait (lanren/life/gait.js); ?figure=v1 the 入画 v1 walker, ?figure=v2 the V2 clips (comparison)
  const figure = Q.get('figure') || 'new';
  let student, createPlayerFor = createPlayer;
  const heightAt = (x, z) => world.heightAt(x, z);
  try {
    if (figure === 'v2') { student = await createStudent(asset('assets/toon/student.glb')); createPlayerFor = createOldPlayer; }
    else if (figure === 'v1') { student = await (await import('./legacy/walker-v1.js')).createWalker(asset('assets/ruhua/student.glb')); createPlayerFor = createOldPlayer; }
    else student = await createWalker(asset('assets/life/student-m.glb'), { heightAt, x: SHOT6.eye[0], z: SHOT6.eye[2], fade: true, hair: 'short' });
  } catch (e) { console.warn('walker unavailable, using the V2 figure', e); student = await createStudent(asset('assets/toon/student.glb')); createPlayerFor = createOldPlayer; }
  student.root.visible = false;
  world.group.add(student.root);
  const rain = createRain({ world, mobile: coarse, layer: LAYER_PAINT });
  world.group.add(rain.group);
  // the living campus: flowers to visit, butterflies, the cat of the lane by 第一食堂
  const habitat = createHabitat({ world, weather });
  const flowers = createFlowers(habitat, { extra: [{ x: 46, z: 58 }, { x: 63, z: 58.5 }, { x: 79, z: 69 }, { x: 52, z: 80 }, { x: 87, z: 79 }, { x: 108, z: 79.5 }] });
  world.group.add(flowers.group);
  world.rebuild();
  // ---------------------------------------------------------------- the people of the campus (lanren/life)
  // one walkable grid from the same walls the player meets; the day of each person, from Haikou's clock
  const nav = buildNav({ colliders: world.colliders, features: world.geo.features, bounds: { x0: -300, x1: 200, z0: -140, z1: 300 } });
  let raining = false;
  const life = createLife({ nav, isRaining: () => raining });
  // review: ?date=2026-11-17 lives that day (Haikou) at the clock's hour, whatever today is
  let dayShift = 0;
  if (/^\d{4}-\d{2}-\d{2}$/.test(Q.get('date') || '')) {
    const [y, m, d] = Q.get('date').split('-').map(Number);
    const c = haikouClock(Date.now());
    dayShift = Date.UTC(y, m - 1, d) - Date.UTC(c.y, c.m - 1, c.d);
  }
  // the campus's clock advances with the simulation (so bodies and their day move together, also when
  // frames are stepped or clamped), and catches up with Haikou's clock when it falls behind or jumps
  let lifeT = 0;
  const advanceLife = (dt, wall) => {
    lifeT += dt * 1000;
    if (wall > lifeT || wall < lifeT - 60000) lifeT = wall;
    return lifeT;
  };
  const lifeClock = () => lifeT + dayShift;
  const people = createPeople({ life, url: asset('assets/life/student-m.glb'), heightAt, getColliders: () => world.colliders, layer: LAYER_PAINT, mobile: coarse, say: (who, line) => ui.line?.(who, line) });
  world.group.add(people.group);
  const eco = createEcosystem({ habitat });
  const butterflies = eco.add(createButterflies(habitat, { max: coarse ? 16 : 24, layer: LAYER_PAINT }));
  world.group.add(butterflies.mesh);
  const cat = eco.add(createCat(habitat, { layer: LAYER_PAINT, butterflies }));
  world.group.add(cat.root);
  const easel = createEasel({ renderer, pipeline, world, layerPaint: LAYER_PAINT, mobile: coarse });
  scene.add(easel.group, easel.fly);
  world.group.traverse((o) => o.layers.set(LAYER_PAINT));
  real.bakeEnv(renderer, scene);
  pipeline.setGround(world.ground);

  // ---------------------------------------------------------------- every painted surface, twice: as it is, and gated by the paint
  const swaps = [];
  {
    const variants = new Map();
    const variant = (m) => {
      if (!m || m.isShaderMaterial) return m;
      if (!variants.has(m)) variants.set(m, sideOf(twin(m), 'paint', { wet: true }));
      return variants.get(m);
    };
    world.group.traverse((o) => {
      if (!o.isMesh || o === student.root) return;
      if (Array.isArray(o.material)) swaps.push({ o, normal: o.material, paint: o.material.map(variant) });
      else if (!o.material.isShaderMaterial) swaps.push({ o, normal: o.material, paint: variant(o.material) });
    });
  }
  const setPaintMaterials = (on) => { for (const s of swaps) s.o.material = on ? s.paint : s.normal; };

  // ---------------------------------------------------------------- the walker of the walk
  const place = (id) => world.geo.features.find((f) => f.id === id);
  const pois = [{ x: 0, y: 8, z: 0, r: 140, w: 3 }];
  for (const [id, y, w] of [['yihao', 10, 1.2], ['erhao', 10, 1], ['library', 9, 1.4], ['keji', 12, 1], ['beimen', 5, 1.6], ['yundong', 1, 1.2], ['yanchi', 0, 1.3], ['fengqitang_ting', 3, 1.2], ['yanlintang_ting', 3, 1.2]]) {
    const f = place(id); if (f) pois.push({ x: f.cx, y: world.geo.frame.ground + y, z: f.cz, r: 160, w });
  }
  let player = null;
  function ensurePlayer(x, z, yaw) {
    if (!player) {
      player = createPlayerFor({ camera: followCam, dom: canvas, student, getColliders: () => world.colliders, heightAt: world.heightAt, spawn: { x, z, yaw }, coarse, pois });
      player.bindStick(document.querySelector('#rh-stick'));
    }
    player.place(x, z, yaw);
    return player;
  }

  // ---------------------------------------------------------------- the director
  const D = { stage: 'hold', clock: 0, t: 0, departAt: 0, eyeFrom: null, eyeTo: null, look: new THREE.Vector3(), enterFrom: null, adapt: 1, shade: 0, shadeT: 0 };
  const shot = () => (innerWidth < innerHeight ? SHOT6.portrait : SHOT6);
  function holdCamera() {
    const s = shot();
    camera.fov = s.fov; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    camera.position.set(...s.eye);
    camera.lookAt(...s.look);
    D.look.set(...s.look);
  }
  holdCamera();
  real.update(0, camera.position);

  function resetToHold() {
    D.stage = 'hold'; D.clock = 0; D.t = 0; D.finishing = false;
    PAINT.uPaintOn.value = 0; PAINT.uProjStart.value = 1e6; PAINT.uFrontStart.value = 1e6; PAINT.uSkyStart.value = 1e6;
    PAINT.uProjMap.value = NO_PROJECTION; PAINT.uProjDepth.value = NO_PROJECTION;
    setPaintMaterials(true);
    real.group.visible = true;
    student.root.visible = false;
    people.group.visible = false;                  // the campus's people return with the painting
    if (map.isOpen) closeMap();
    easel.reset();
    player?.setEnabled(false);
    holdCamera();
    ui.stage('hold');
  }

  async function startPainting() {
    if (D.stage !== 'hold') return;
    // 支起画架: first the painter turns to face the tree squarely (the 回望 shot had it to one side), so
    // the blank canvas will stand over its heart and the real crown spill past the frame on both sides
    ui.stage('easel');
    D.stage = 'aim'; D.t = 0;
    D.aimFrom = camera.quaternion.clone();
    const look = camera.clone(); look.lookAt(LOOK_TREE); D.aimTo = look.quaternion.clone();
    await new Promise((res) => { D.aimDone = res; });
    D.stage = 'easel'; D.t = 0;
    const c = weather.caption();
    const clk = haikouClock(weather.state.clock);
    // the reference is the whole painted world: no gating while it is drawn, no rain streaks across it
    PAINT.uPaintOn.value = 0;
    const rainWas = rain.group.visible; rain.group.visible = false;
    const info = await easel.setup(camera, { portrait: innerWidth < innerHeight, lines: [`${clk.y}.${clk.m}.${clk.d} 写生于海中`, `海口 ${c.name} ${c.temp}°`] });
    rain.group.visible = rainWas;
    easel.setLight(sun6Dir(), pipeline.gradeB.uniforms.uExposure.value);
    D.rise = 0;
    console.info('入画: strokes planned', info);
    D.stage = 'paint'; D.t = 0;
    ui.stage('paint');
  }
  function depart() {
    if (D.stage !== 'spill' && D.stage !== 'paint') return;
    D.stage = 'depart'; D.t = 0; D.departAt = D.clock;
    PAINT.uProjStart.value = D.clock + T.project;
    PAINT.uFrontStart.value = D.clock + T.front;
    PAINT.uSkyStart.value = D.clock + T.sky;
    easel.setFront(D.clock + T.front + 2.8);
    easel.depart();
    // the step aside: to the right of the easel and a little back, the tree kept in view
    const P = easel.state.P;
    const right = new THREE.Vector3().setFromMatrixColumn(P.matrixWorld, 0); right.y = 0; right.normalize();
    const fwd = P.getWorldDirection(new THREE.Vector3()); fwd.y = 0; fwd.normalize();
    D.eyeFrom = P.position.clone();
    D.eyeTo = P.position.clone().addScaledVector(right, 1.5).addScaledVector(fwd, -0.55).add(new THREE.Vector3(0, 0.04, 0));
    D.lookFrom = P.position.clone().add(P.getWorldDirection(new THREE.Vector3()).multiplyScalar(30));
    ui.stage('depart');
  }
  function skip() {
    // straight into the walk, the world already painted (for return visits)
    PAINT.uPaintOn.value = 0;
    setPaintMaterials(false);
    real.group.visible = false;
    easel.reset();
    const s = shot();
    const yaw = Math.atan2(s.look[0] - s.eye[0], s.look[2] - s.eye[2]);
    enterWalk(s.eye[0], s.eye[2], yaw, true);
  }
  function enterWalk(x, z, yaw, instant = false) {
    ensurePlayer(x, z, yaw);
    student.root.visible = true;
    people.group.visible = true;
    player.setEnabled(false);
    for (let i = 0; i < 60; i++) player.update(1 / 30);
    D.enterFrom = { pos: camera.position.clone(), quat: camera.quaternion.clone(), fov: camera.fov };
    D.enterBack = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    if (!instant) student.setFade?.(0); else student.setFade?.(1);
    D.stage = instant ? 'stroll' : 'enter'; D.t = 0;
    if (instant) { player.setEnabled(true); ui.stage('stroll'); }
  }

  ui.on('paint', startPainting);
  ui.on('skip', () => { if (D.stage === 'hold' || D.stage === 'paint' || D.stage === 'spill' || D.stage === 'easel') skip(); else if (D.stage === 'depart' || D.stage === 'spread' || D.stage === 'enter') D.clock = D.departAt + T.done; });
  ui.on('depart', depart);
  ui.on('replay', resetToHold);
  ui.on('weather', (k, h) => (k === 'live' ? weather.setLive() : weather.setFree(k, h)));
  ui.on('hold', (on) => easel.hold(on));

  // ---------------------------------------------------------------- 海中活点地图: a page of the sketchbook
  const playerSteps = [];
  student.on?.('footstep', ({ position }) => {
    const h = student.heading ?? 0;
    playerSteps.push({ x: position.x, z: position.z, yaw: h, side: playerSteps.length % 2 ? 1 : -1, t: lifeClock(), run: (student.human?.runBlend || 0) > 0.5 });
    if (playerSteps.length > 400) playerSteps.shift();
  });
  // the sketchbook itself, in the walker's left hand while the map is open
  let sketchbook = null;
  if (student.bone) {
    const hand = student.bone('hand.L');
    sketchbook = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.25, 0.19), new THREE.MeshLambertMaterial({ color: '#2f4a3c' }));
    sketchbook.position.set(0.03, 0.1, 0.03); sketchbook.visible = false; sketchbook.castShadow = true;
    sketchbook.layers.set(LAYER_PAINT);
    hand.add(sketchbook);
  }
  const CAT_WORDS = { sleep: '睡觉', patrol: '巡视', bask: '晒太阳', groom: '理毛', canteen: '守在食堂门口', nap: '午睡', watch: '坐着看', shelter: '躲雨' };
  const mapEl = document.querySelector('#lf-map'), mapBtn = document.querySelector('[data-life="map"]'), card = document.querySelector('#lf-card'), mapDate = document.querySelector('#lf-map-date');
  const map = createMap({
    geo: world.geo, life, mobile: coarse, root: mapEl,
    get: () => {
      const S = weather.state, P = player?.state;
      const c = cat.describe();
      return {
        clock: lifeClock(),
        player: P ? { x: P.pos.x, z: P.pos.z, camYaw: P.camYaw } : null, playerSteps,
        cat: { x: c.at[0], z: c.at[1], label: CAT_WORDS[c.act] || '' },
        easel: easel.group.visible && easel.canvasMesh ? { x: easel.canvasMesh.position.x, z: easel.canvasMesh.position.z } : null,
        weather: { rain: Math.min(1, Math.max(S.rainNow, S.cur.rain)), wet: S.cur.wet, night: S.pal.night, lamps: U.uLamps.value, wind: S.cur.sway },
      };
    },
  });
  function openMap() {
    if (D.stage !== 'stroll' || map.isOpen) return;
    const P = player.state;
    mapEl.hidden = false;                           // shown first: the page measures its canvas when it opens
    map.open({ x: P.pos.x, z: P.pos.z });
    const c = weather.caption();
    mapDate.textContent = `${c.date} · ${c.clock} · ${c.name} ${c.temp}°`;
    requestAnimationFrame(() => requestAnimationFrame(() => mapEl.classList.add('on')));
    mapBtn?.setAttribute('aria-expanded', 'true');
    player.setEnabled(false);
    // in the picture behind the page, the walker has the sketchbook up and is looking into it
    student.setHold?.('sketchbook'); if (sketchbook) sketchbook.visible = true;
  }
  function closeMap() {
    if (!map.isOpen) return;
    map.close(); mapEl.classList.remove('on'); card.hidden = true;
    mapBtn?.setAttribute('aria-expanded', 'false');
    setTimeout(() => { if (!map.isOpen) mapEl.hidden = true; }, 700);
    player.setEnabled(true);
    student.setHold?.(null); setTimeout(() => { if (!map.isOpen && sketchbook) sketchbook.visible = false; }, 500);
  }
  const bearing = (dx, dz) => ['北', '东北', '东', '东南', '南', '西南', '西', '西北'][((Math.round((Math.atan2(dx, -dz) * 180 / Math.PI) / 45) % 8) + 8) % 8];
  map.onSelect((id) => {
    if (!id) { card.hidden = true; return; }
    const P = player.state;
    if (id === 'cat') {
      const c = cat.describe();
      const d = Math.hypot(c.at[0] - P.pos.x, c.at[1] - P.pos.z);
      card.innerHTML = `<h3 style="color:${INKS.cat}">橘猫<small>第一食堂旁</small></h3><p class="lf-now">正在${CAT_WORDS[c.act] || '附近'}</p><p class="lf-far">在你${bearing(c.at[0] - P.pos.x, c.at[1] - P.pos.z)}方约 ${Math.round(d / 5) * 5} 米</p><p>它的一天跟着海口的钟走：清晨巡视，上午晒太阳，饭点守在食堂门口。</p>`;
    } else {
      const a = life.byId.get(id), s = a.state, pos = a.live || s;
      const d = Math.hypot(pos.x - P.pos.x, pos.z - P.pos.z);
      const now = s.inside ? `在${s.label} · ${s.what}` : s.act === 'walk' ? `正在去${s.toLabel}${s.going ? '（' + s.going + '）' : ''}` : `在${s.label} · ${s.what}`;
      card.innerHTML = `<h3 style="color:${INKS[id]}">${a.person.name}<small>${a.person.role}</small></h3><p class="lf-now">${now}</p><p class="lf-far">在你${bearing(pos.x - P.pos.x, pos.z - P.pos.z)}方约 ${Math.max(5, Math.round(d / 5) * 5)} 米</p><p>${a.person.about}</p><button type="button" data-life="follow">在地图上跟着看</button>`;
      card.querySelector('[data-life="follow"]').onclick = () => map.follow(id);
    }
    card.hidden = false;
  });
  mapBtn?.addEventListener('click', () => (map.isOpen ? closeMap() : openMap()));
  mapEl.addEventListener('click', (e) => {
    const act = e.target.closest('[data-life]')?.dataset.life;
    if (act === 'close') closeMap();
    if (act === 'me') { map.follow(null); map.center(player.state.pos.x, player.state.pos.z); }
    if (act === 'day') { const on = map.toggleDay(); e.target.closest('[data-life]').setAttribute('aria-pressed', String(on)); }
  });
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && !/INPUT|TEXTAREA/.test(e.target.tagName || '')) { map.isOpen ? closeMap() : openMap(); }
    if (e.code === 'Escape' && map.isOpen) closeMap();
  });
  addEventListener('resize', () => map.resize());

  // pointer on the canvas while painting (the eye is the painter's: screen = painter's screen)
  // the pointer, in the painter's screen: a ray through the visible camera, projected by the painter's eye
  // (the same eye, so this is exact whatever the window has become since the canvas was set up)
  const ptr = { down: false };
  const pv = new THREE.Vector3();
  const toPainter = (e) => {
    const P = easel.state.P;
    const nx = (e.clientX / innerWidth) * 2 - 1, ny = 1 - (e.clientY / innerHeight) * 2;
    if (!P) return [(nx + 1) / 2, (ny + 1) / 2];
    pv.set(nx, ny, 0.5).unproject(camera).project(P);
    return [(pv.x + 1) / 2, (pv.y + 1) / 2];
  };
  canvas.addEventListener('pointerdown', (e) => { if (D.stage !== 'paint' && D.stage !== 'spill') return; ptr.down = true; canvas.setPointerCapture?.(e.pointerId); easel.pointer(...toPainter(e), true); });
  canvas.addEventListener('pointermove', (e) => { if (D.stage !== 'paint' && D.stage !== 'spill') return; easel.pointer(...toPainter(e), ptr.down); });
  const up = () => { ptr.down = false; if (easel.state.pointer) easel.pointer(...easel.state.pointer, false); };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);

  addEventListener('resize', () => {
    pipeline.setSize(innerWidth, innerHeight);
    followCam.aspect = camera.aspect = innerWidth / innerHeight;
    if (D.stage === 'hold') holdCamera();
    else if (easel.state.P && ['easel', 'paint', 'spill', 'depart', 'spread'].includes(D.stage)) fitPainter();
    followCam.updateProjectionMatrix(); camera.updateProjectionMatrix();
  });
  // the canvas stays whole in the picture when the window changes shape mid-painting: the eye does not
  // move (so painting and world still agree), only the lens widens to keep the painter's frame in view
  function fitPainter() {
    const P = easel.state.P;
    const tanV = Math.tan(THREE.MathUtils.degToRad(P.fov) / 2), tanH = tanV * P.aspect;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(tanV, tanH / camera.aspect)));
  }

  // ---------------------------------------------------------------- weather → the painted world
  const lampsAt = (night, hours) => night * (hours >= 18.3 && hours < 22.6 ? 1 : hours >= 22.6 && hours < 23.6 ? 1 - (hours - 22.6) * 0.8 : hours >= 5.6 && hours < 7.2 ? 0.45 : 0.12);
  const v4wind = new THREE.Vector3();
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
    // the six chapters' tree in today's wind (turned into its own frame); in the memory, its own breeze
    const today = D.stage === 'stroll' || D.stage === 'enter' ? 1 : D.stage === 'depart' || D.stage === 'spread' ? smooth((D.clock - PAINT.uFrontStart.value) / 4) : 0;
    const c = Math.cos(-V4_ROT), s = Math.sin(-V4_ROT);
    v4wind.set(C.windDir[0] * c + C.windDir[1] * s, 0, -C.windDir[0] * s + C.windDir[1] * c);
    UNIFORMS.uWindDir.value.set(0.8, 0, -0.6).normalize().lerp(v4wind, today).normalize();
    UNIFORMS.uWind.value = 0.3 + (Math.min(1.3, C.sway * 0.38) - 0.3) * today;
    UNIFORMS.uGust.value = 0.5 + 0.5 * Math.sin(S.time * 0.21) * Math.sin(S.time * 0.13 + 1);
    UNIFORMS.uTime.value = S.time;
    return S;
  }
  world.tree.setDay(dayOfYear(weather.state.clock));

  // ---------------------------------------------------------------- per frame
  const focus = new THREE.Vector3(), tmpV = new THREE.Vector3(), enterQ = new THREE.Quaternion();
  const LOOK_TREE = new THREE.Vector3(0.2, 7.0, 0.6);           // the crown (tree.json crown centre, turned into this frame), a little low
  let frameMs = 16, govT = 0;
  const fixedScale = Q.has('scale') ? Number(Q.get('scale')) : null;
  if (fixedScale) pipeline.setScale(fixedScale);
  function step(dt) {
    U.uTime.value += dt;
    pipeline.tick(dt);
    D.t += dt;
    const S = applyWeather(dt);
    advanceLife(dt, S.clock);
    const painting = D.stage !== 'hold' && (D.stage !== 'stroll' || D.finishing);
    if (painting) D.clock += dt;
    PAINT.uPaintClock.value = D.clock;
    PAINT.uPaintOn.value = painting ? 1 : 0;
    // ---- stages
    if (D.stage === 'aim') {
      const dur = reduce ? 0.6 : 1.5;
      camera.quaternion.slerpQuaternions(D.aimFrom, D.aimTo, smoother(D.t / dur));
      if (D.t >= dur && D.aimDone) { const f = D.aimDone; D.aimDone = null; f(); }
    }
    if (D.stage === 'easel' || D.stage === 'paint' || D.stage === 'spill') {
      D.rise = Math.min(1, (D.rise ?? 0) + dt / 1.1);
      easel.group.position.y = -1.6 * Math.pow(1 - smoother(D.rise), 2);
      if (D.stage !== 'easel') {
        const ev = easel.update(dt, D.clock);
        if (ev === 'stage') ui.paintStage(easel.stageName(), easel.progress);
        if (ev === 'spillReady') { D.stage = 'spill'; D.t = 0; ui.stage('spill'); }
        if (D.stage === 'spill' && (easel.spillAmount > 26 || D.t > (reduce ? 4 : 9))) depart();
      }
    } else if (D.stage === 'depart' || D.stage === 'spread') {
      easel.update(dt, D.clock);
      const k = smoother((D.clock - D.departAt) / 2.8);
      camera.position.lerpVectors(D.eyeFrom, D.eyeTo, k);
      camera.position.y += Math.sin(k * Math.PI) * 0.03;              // a step
      camera.lookAt(tmpV.lerpVectors(D.lookFrom, LOOK_TREE, k * 0.7));
      if (D.stage === 'depart' && D.clock > PAINT.uFrontStart.value) { D.stage = 'spread'; ui.stage('spread'); }
      if (D.clock - D.departAt > T.enter) {
        const yaw = Math.atan2(-camera.position.x, -camera.position.z);
        world.extraCircles = world.extraCircles.filter((c) => c.id !== 'easel').concat([{ id: 'easel', x: easel.canvasMesh.position.x, z: easel.canvasMesh.position.z, r: 0.45 }]);
        world.rebuild();
        enterWalk(camera.position.x + Math.sin(yaw) * 0.45, camera.position.z + Math.cos(yaw) * 0.45, yaw);
        ui.stage('enter');
      }
    }
    if (D.stage === 'enter') {
      easel.update(dt, D.clock);
      player.update(dt);
      // out of the body: the eye draws straight back at the walker's height, still looking at the tree,
      // and only at the end settles into the walk's own framing. The walker is painted in around the
      // place the eye was — the last stroke of the transition is the person standing in the painting.
      const k = smoother(D.t / T.enterDur);
      const back = smooth(Math.min(1, D.t / (T.enterDur * 0.55)));
      tmpV.copy(D.enterFrom.pos).addScaledVector(D.enterBack, back * 2.4);
      tmpV.y += Math.min(1, back * 1.6) * 0.42;                       // up over the head first, then back
      camera.position.lerpVectors(tmpV, followCam.position, smoother((D.t - T.enterDur * 0.35) / (T.enterDur * 0.65)));
      camera.position.y += Math.sin(k * Math.PI) * 0.12;
      camera.lookAt(LOOK_TREE);
      enterQ.copy(camera.quaternion);
      camera.quaternion.copy(D.enterFrom.quat).slerp(enterQ, smooth(Math.min(1, D.t / (T.enterDur * 0.3))));
      camera.quaternion.slerp(followCam.quaternion, smoother((D.t - T.enterDur * 0.55) / (T.enterDur * 0.45)));
      camera.fov = D.enterFrom.fov + (followCam.fov - D.enterFrom.fov) * k;
      camera.updateProjectionMatrix();
      student.setFade?.(smooth((back - 0.32) / 0.38));                // painted in once the eye is clear of the head
      student.lookAt(0, 0.28, 0.85);                                   // still looking up into the tree
      if (D.t >= T.enterDur) {
        // the walk is yours; the far campus may still be filling in for a few seconds
        D.stage = 'stroll'; D.finishing = true;
        player.setEnabled(true);
        ui.stage('stroll');
      }
    } else if (D.stage === 'stroll') {
      if (D.finishing) {
        easel.update(dt, D.clock);
        if (D.clock - D.departAt > T.done) { D.finishing = false; easel.empty(); setPaintMaterials(false); real.group.visible = false; }
      }
      player.update(dt);
      if (D.override) { const o = D.override; camera.position.set(...o.eye); camera.lookAt(...o.at); if (camera.fov !== o.fov) { camera.fov = o.fov; camera.updateProjectionMatrix(); } }
      else {
        camera.position.copy(followCam.position); camera.quaternion.copy(followCam.quaternion);
        if (Math.abs(camera.fov - followCam.fov) > 0.01) { camera.fov = followCam.fov; camera.updateProjectionMatrix(); }
      }
    }
    // ---- the world
    const feet = player && (D.stage === 'enter' || D.stage === 'stroll') ? player.state.pos : tmpV.set(camera.position.x, world.geo.frame.ground, camera.position.z);
    focus.copy(feet);
    world.day.update(dt, focus);
    world.sky.update(dt, focus);
    real.update(U.uTime.value, focus);
    camera.updateMatrixWorld();
    world.grass.update(camera, feet, world.geo.frame.ground);
    rain.update(dt, weather, camera.position);
    student.setUmbrella?.(S.rainNow > 0.1 || S.cur.rain > 0.15);
    // the creatures live once the painting has reached them (the cat's day ran on regardless: plan() reads the clock)
    const alive = D.stage === 'stroll' || D.stage === 'enter';
    butterflies.mesh.visible = alive;
    if (alive) {
      const ps = player.state;
      habitat.player.pos = ps.pos; habitat.player.speed = ps.speed; habitat.player.vel = { x: ps.vel.x, z: ps.vel.y };
      eco.update(dt, { clock: S.clock, time: S.time });
      const wet = Math.max(S.rainNow, S.cur.rain);
      raining = raining ? wet > 0.08 : wet > 0.3;
      life.update(lifeClock());
      people.update(dt, lifeClock(), { player: { x: ps.pos.x, z: ps.pos.z, speed: ps.speed }, rain: raining, hours: haikouClock(S.clock).hours });
      if (map.isOpen) student.lookAt(0, -0.6, 1);
    }
    // eyes adapt a little in deep shade
    D.shadeT -= dt;
    if (D.shadeT <= 0) { D.shadeT = 0.2; D.shade = shadeAt(world, feet); }
    D.adapt += (1 + 0.18 * D.shade - D.adapt) * (1 - Math.exp(-dt * 1.1));
    pipeline.setGrade(S.pal.exposure * D.adapt, S.pal.sat, S.pal.bloom);
    ui.weather(weather.caption(), S);
  }
  function render() {
    renderer.info.reset();
    if (D.stage === 'hold' || D.stage === 'aim') pipeline.renderReal(scene, camera, null);
    else if (D.stage === 'stroll' && !D.finishing) pipeline.renderPainted(scene, camera, null);
    else pipeline.renderBoth(scene, camera);
    camera.layers.enableAll();
  }
  // precompile both material sets (no hitch at the handoff)
  ui.say('准备画布…');
  try {
    setPaintMaterials(false); await renderer.compileAsync(scene, camera);
    setPaintMaterials(true); await renderer.compileAsync(scene, camera);
  } catch (e) { console.warn('precompile', e); }
  resetToHold();
  if (Q.get('stage') === 'stroll') skip();

  const clock = new THREE.Clock();
  let paused = false, mapFrames = 0;
  function frame() {
    const raw = clock.getDelta();
    if (paused) { requestAnimationFrame(frame); return; }   // a still is on screen: resizing would clear it
    step(Math.min(raw, 1 / 20));
    // the page covers the picture while the map is open: the world goes on, drawn less often
    mapFrames = map.isOpen ? mapFrames + 1 : 0;
    if (!map.isOpen || mapFrames % 4 === 1) render();
    map.frame(Math.min(raw, 1 / 20));
    frameMs = frameMs * 0.92 + raw * 1000 * 0.08;
    govT += raw;
    if (!fixedScale && govT > 1.5) {
      govT = 0;
      const budget = D.stage === 'hold' || D.stage === 'stroll' ? 22 : 30;
      if (frameMs > budget * 1.15 && pipeline.scale > 0.55) pipeline.setScale(pipeline.scale - 0.1);
      else if (frameMs < budget * 0.7 && pipeline.scale < 1) pipeline.setScale(pipeline.scale + 0.05);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  ui.ready(Math.round(performance.now() - t0));

  window.__ruhua = {
    nav, life, people, get map() { return map; }, openMap, closeMap,
    D, PAINT, weather, world, real, easel, pipeline, renderer, scene, camera, U, SKY, eco, cat, butterflies, flowers, habitat,
    get player() { return player; },
    get student() { return student; },
    get stage() { return D.stage; },
    paint: startPainting, depart, skip, replay: resetToHold,
    /** review: hold the camera somewhere in the walk (null hands it back) */
    look(eye, at, fov = 40) { D.override = eye ? { eye, at, fov } : null; },
    /** tests and stills: step the simulation without the frame loop, then draw once */
    still(seconds = 1, fps = 30) { paused = true; for (let i = 0; i < Math.round(seconds * fps); i++) step(1 / fps); render(); if (map.isOpen) map.frame(seconds); },
    resume() { paused = false; clock.getDelta(); },
    /** step without drawing (tests drive the brush between stills) */
    tick(seconds = 1 / 30, fps = 30) { paused = true; for (let i = 0; i < Math.max(1, Math.round(seconds * fps)); i++) step(1 / fps); },
    /** paint every stage at once (tests) */
    paintAll() { const S = easel.state; S.layers.forEach((L, li) => L.forEach((st) => { if (!st.shown) { st.shown = true; S.rib.reveal(st.k, D.clock - 1); S.revealed[li]++; } })); S.cur = S.layers.length; S.stage = 'seal'; S.stageT = 0; },
    info: () => ({ stage: D.stage, clock: +D.clock.toFixed(2), tier: tierName, scale: pipeline.scale, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, ms: +frameMs.toFixed(1),
      weather: weather.caption(), origin: weather.state.origin, progress: easel.progress, player: player ? [+player.state.pos.x.toFixed(2), +player.state.pos.z.toFixed(2)] : null,
      cat: cat.describe(), butterflies: butterflies.stats() }),
  };
}

function dayOfYear(ms) {
  const c = haikouClock(ms);
  return Math.round((Date.UTC(c.y, c.m - 1, c.d) - Date.UTC(c.y, 0, 1)) / 86400000) + 1;
}

main().catch((e) => { console.error(e); const s = document.querySelector('#rh-status'); if (s) s.textContent = '无法启动三维场景：' + (e.message || e); document.body.classList.add('rh-failed'); });
