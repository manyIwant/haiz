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
import { createWalker } from './walker.js';
import { createPlayer } from '../ruhua-stroll/player.js';
import { UNIFORMS } from '../js/foliage.js';
import { loadV4, SHOT6, sun6Dir, LIGHT6, V4_ROT } from './v4.js';
import { createWorld, shadeAt } from './world.js';
import { createRealWorld } from './realworld.js';
import { createPipeline } from './pipeline.js';
import { createEasel } from './easel.js';
import { createRain } from './fx.js';
import { PAINT, NO_PROJECTION, sideOf, twin } from './paintfield.js';
import { createSource } from './weather/source.js';
import { createWeather } from './weather/weather.js';
import { haikouClock } from './weather/model.js';
import { createUI } from './ui.js';
import { createHabitat, createEcosystem } from './eco/habitat.js';
import { createFlowers } from './eco/flowers.js';
import { createButterflies } from './eco/butterflies.js';
import { createCat } from './eco/cat.js';

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
const T = { project: 0.9, front: 2.2, sky: 3.3, enter: 9.6, enterDur: 3.4, done: 14.0 };
if (reduce) Object.assign(T, { project: 0.4, front: 1.2, sky: 1.8, enter: 6.0, enterDur: 1.6, done: 9.5 });

async function main() {
  const ui = createUI({ coarse });
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
  let student;
  try { student = Q.get('figure') === 'v2' ? await createStudent(asset('assets/toon/student.glb')) : await createWalker(asset('assets/ruhua/student.glb')); }
  catch (e) { console.warn('walker unavailable, using the V2 figure', e); student = await createStudent(asset('assets/toon/student.glb')); }
  student.root.visible = false;
  world.group.add(student.root);
  const rain = createRain({ world, mobile: coarse, layer: LAYER_PAINT });
  world.group.add(rain.group);
  // the living campus: flowers to visit, butterflies, the cat of the lane by 第一食堂
  const habitat = createHabitat({ world, weather });
  const flowers = createFlowers(habitat, { extra: [{ x: 46, z: 58 }, { x: 63, z: 58.5 }, { x: 79, z: 69 }, { x: 52, z: 80 }, { x: 87, z: 79 }, { x: 108, z: 79.5 }] });
  world.group.add(flowers.group);
  world.rebuild();
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
      player = createPlayer({ camera: followCam, dom: canvas, student, getColliders: () => world.colliders, heightAt: world.heightAt, spawn: { x, z, yaw }, coarse, pois });
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
    D.stage = 'hold'; D.clock = 0; D.t = 0;
    PAINT.uPaintOn.value = 0; PAINT.uProjStart.value = 1e6; PAINT.uFrontStart.value = 1e6; PAINT.uSkyStart.value = 1e6;
    PAINT.uProjMap.value = NO_PROJECTION; PAINT.uProjDepth.value = NO_PROJECTION;
    setPaintMaterials(true);
    real.group.visible = true;
    student.root.visible = false;
    easel.reset();
    player?.setEnabled(false);
    holdCamera();
    ui.stage('hold');
  }

  async function startPainting() {
    if (D.stage !== 'hold') return;
    D.stage = 'easel'; D.t = 0;
    ui.stage('easel');
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
    player.setEnabled(false);
    for (let i = 0; i < 60; i++) player.update(1 / 30);
    D.enterFrom = { pos: camera.position.clone(), quat: camera.quaternion.clone(), fov: camera.fov };
    D.stage = instant ? 'stroll' : 'enter'; D.t = 0;
    if (instant) { player.setEnabled(true); ui.stage('stroll'); }
  }

  ui.on('paint', startPainting);
  ui.on('skip', () => { if (D.stage === 'hold' || D.stage === 'paint' || D.stage === 'spill' || D.stage === 'easel') skip(); else if (D.stage === 'depart' || D.stage === 'spread' || D.stage === 'enter') D.clock = D.departAt + T.done; });
  ui.on('depart', depart);
  ui.on('replay', resetToHold);
  ui.on('weather', (k, h) => (k === 'live' ? weather.setLive() : weather.setFree(k, h)));
  ui.on('hold', (on) => easel.hold(on));

  // pointer on the canvas while painting (the eye is the painter's: screen = painter's screen)
  const ptr = { down: false };
  canvas.addEventListener('pointerdown', (e) => { if (D.stage !== 'paint' && D.stage !== 'spill') return; ptr.down = true; canvas.setPointerCapture?.(e.pointerId); easel.pointer(e.clientX / innerWidth, 1 - e.clientY / innerHeight, true); });
  canvas.addEventListener('pointermove', (e) => { if (D.stage !== 'paint' && D.stage !== 'spill') return; easel.pointer(e.clientX / innerWidth, 1 - e.clientY / innerHeight, ptr.down); });
  const up = () => { ptr.down = false; if (easel.state.pointer) easel.pointer(...easel.state.pointer, false); };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);

  addEventListener('resize', () => {
    pipeline.setSize(innerWidth, innerHeight);
    followCam.aspect = camera.aspect = innerWidth / innerHeight;
    followCam.updateProjectionMatrix(); camera.updateProjectionMatrix();
    if (D.stage === 'hold') holdCamera();
  });

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
  const focus = new THREE.Vector3(), tmpV = new THREE.Vector3();
  const LOOK_TREE = new THREE.Vector3(0.2, 7.0, 0.6);           // the crown (tree.json crown centre, turned into this frame), a little low
  let frameMs = 16, govT = 0;
  const fixedScale = Q.has('scale') ? Number(Q.get('scale')) : null;
  if (fixedScale) pipeline.setScale(fixedScale);
  function step(dt) {
    U.uTime.value += dt;
    pipeline.tick(dt);
    D.t += dt;
    const S = applyWeather(dt);
    const painting = D.stage !== 'hold' && D.stage !== 'stroll';
    if (painting) D.clock += dt;
    PAINT.uPaintClock.value = D.clock;
    PAINT.uPaintOn.value = painting ? 1 : 0;
    // ---- stages
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
        enterWalk(camera.position.x, camera.position.z, yaw);
        ui.stage('enter');
      }
    }
    if (D.stage === 'enter') {
      easel.update(dt, D.clock);
      player.update(dt);
      const k = smoother(D.t / T.enterDur);
      // up out of the walker's head, then back to the walk's own camera
      camera.position.lerpVectors(D.enterFrom.pos, followCam.position, k);
      camera.position.y += Math.sin(k * Math.PI) * 0.9;
      camera.quaternion.slerpQuaternions(D.enterFrom.quat, followCam.quaternion, smooth(k * 1.15));
      camera.fov = D.enterFrom.fov + (followCam.fov - D.enterFrom.fov) * k;
      camera.updateProjectionMatrix();
      if (D.t >= T.enterDur && D.clock - D.departAt > T.done) {
        D.stage = 'stroll';
        easel.empty();
        setPaintMaterials(false);
        real.group.visible = false;
        player.setEnabled(true);
        ui.stage('stroll');
      }
    } else if (D.stage === 'stroll') {
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
    if (D.stage === 'hold') pipeline.renderReal(scene, camera, null);
    else if (D.stage === 'stroll') pipeline.renderPainted(scene, camera, null);
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
  let paused = false;
  function frame() {
    const raw = clock.getDelta();
    if (paused) { requestAnimationFrame(frame); return; }   // a still is on screen: resizing would clear it
    step(Math.min(raw, 1 / 20)); render();
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
    D, PAINT, weather, world, real, easel, pipeline, renderer, scene, camera, U, SKY, eco, cat, butterflies, flowers, habitat,
    get player() { return player; },
    get student() { return student; },
    get stage() { return D.stage; },
    paint: startPainting, depart, skip, replay: resetToHold,
    /** review: hold the camera somewhere in the walk (null hands it back) */
    look(eye, at, fov = 40) { D.override = eye ? { eye, at, fov } : null; },
    /** tests and stills: step the simulation without the frame loop, then draw once */
    still(seconds = 1, fps = 30) { paused = true; for (let i = 0; i < Math.round(seconds * fps); i++) step(1 / fps); render(); },
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
