// 晨径 · The morning path — boot, frame loop and the three ways of being here:
//   film    the director walks you from outside 北门 along the axis to 太湖石 and the tree (shot(t) is a
//           pure function of time; any frame can be drawn alone)
//   free    you walk; the film's place and heading become yours, nothing jumps
//   memory  at a photographer's spot the photograph develops onto the place (memory.js)
import * as THREE from 'three';
import { createWorld } from './world.js';
import { patchSky, HZ } from './memory-shader.js';
import { createFilm } from './film.js';
import { createWalker } from './walk.js';
import { createMemory, STATIONS } from './memory.js';
import { createUI } from './ui.js';
import { createSound } from './sound.js';

const Q = new URLSearchParams(location.search);
const coarse = matchMedia('(pointer: coarse)').matches;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || Q.has('reduce');
const TIERS = {
  high: { pr: Math.min(devicePixelRatio, 2), shadow: 4096, leafDensity: 1.0, bedGrass: 9000, ground: 4096, aa: true, mobileLeaves: false },
  medium: { pr: Math.min(devicePixelRatio, 1.6), shadow: 2048, leafDensity: 0.7, bedGrass: 6000, ground: 2048, aa: true, mobileLeaves: true },
  low: { pr: Math.min(devicePixelRatio, 1), shadow: 2048, leafDensity: 0.45, bedGrass: 3000, ground: 2048, aa: false, mobileLeaves: true },
};
const tierName = TIERS[Q.get('quality')] ? Q.get('quality') : (coarse ? 'medium' : 'high');
const tier = TIERS[tierName];
// the film's day: an early-summer school morning, the sun computed for the campus (not a mood preset)
const FILM_DAY = Date.UTC(2026, 5, 6, 7 - 8, 15);   // 2026-06-06 07:15 Haikou

async function main() {
  const t0 = performance.now();
  const ui = createUI({ coarse, reduce });
  const canvas = document.querySelector('#pw');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier.aa, powerPreference: 'high-performance', preserveDrawingBuffer: Q.has('capture') });
  renderer.setPixelRatio(tier.pr);
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.info.autoReset = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.15, 2600);

  ui.status('读取校园数据…');
  const campus = await (await fetch(new URL('../../assets/walk/campus.json', import.meta.url))).json();
  const world = await createWorld({ campus, tier, onProgress: (k, f) => ui.progress(k, f), say: ui.status });
  scene.add(world.group);
  scene.fog = new THREE.FogExp2(0xc8c2b2, 0.0021);
  patchSky(world.sky);
  let when = Q.has('now') ? Date.now() : FILM_DAY;
  world.setTime(when);

  const bakeEnv = () => {
    const pm = new THREE.PMREMGenerator(renderer);
    const es = new THREE.Scene();
    const s2 = new THREE.Mesh(world.sky.geometry, world.sky.material);
    s2.frustumCulled = false; es.add(s2);
    const env = pm.fromScene(es, 0, 1, 3000);
    scene.environment?.dispose?.();
    scene.environment = env.texture;
    scene.environmentIntensity = 0.6;
    pm.dispose();
  };
  bakeEnv();

  const film = createFilm({ world, reduce });
  const walker = createWalker({ world, canvas, coarse, ui });
  const memory = createMemory({ world, renderer, scene, ui, reduce });
  const sound = createSound();
  ui.onSound((on) => sound.enable(on));

  // ---------------------------------------------------------------- state
  const S = { mode: Q.has('free') ? 'free' : 'film', filmT: +(Q.get('t') || 0), override: null, paused: false, clock: 0 };
  const focus = new THREE.Vector3();
  const startFree = (fromFilm = true) => {
    if (S.mode === 'free') return;
    const sh = film.shot(S.filmT);
    walker.takeOver(sh.eye, sh.look);
    S.mode = 'free';
    ui.mode('free');
  };
  const resumeFilm = () => {
    S.filmT = film.nearestT(walker.state.pos);
    film.blendFrom(camera, S.clock);
    S.mode = 'film';
    ui.mode('film');
  };
  walker.onInput(() => { if (S.mode === 'film') startFree(); });
  ui.setFilm(film, (t) => { film.blendFrom(camera, S.clock); S.filmT = t; S.mode = 'film'; ui.mode('film'); });
  ui.onDirector(() => (S.mode === 'film' ? startFree() : resumeFilm()));
  ui.onTime((k) => { when = k === 'now' ? Date.now() : FILM_DAY; world.setTime(when); bakeEnv(); ui.when(world.when, k); });
  ui.when(world.when, Q.has('now') ? 'now' : 'film');
  if (S.mode === 'free') { const sh = film.shot(S.filmT); walker.takeOver(sh.eye, sh.look); ui.mode('free'); }

  // the buildings stream in after the first frame
  const buildings = world.loadBuildings().then(() => { memory.invalidate(); ui.status(''); }).catch((e) => { console.warn(e); ui.status('建筑模型未能载入：只显示地面、树与石'); });

  // ---------------------------------------------------------------- frame
  const clock = new THREE.Clock();
  let frameMs = 16, acc = 0, frames = 0;
  const info = { tier: tierName, loadMs: 0 };
  function step(dt) {
    S.clock += dt;
    if (S.mode === 'film') {
      S.filmT = Math.min(film.duration, S.filmT + dt);
      const sh = film.shot(S.filmT, S.clock);
      camera.position.copy(sh.eye); camera.lookAt(sh.look);
      if (camera.fov !== sh.fov) { camera.fov = sh.fov; camera.updateProjectionMatrix(); }
      if (S.filmT >= film.duration) startFree();
    } else {
      walker.step(dt, camera);
    }
    if (S.override) { camera.position.fromArray(S.override.eye); camera.lookAt(new THREE.Vector3().fromArray(S.override.at)); camera.fov = S.override.fov; camera.updateProjectionMatrix(); }
    camera.getWorldDirection(focus);
    focus.multiplyScalar(18).add(camera.position);
    world.update(S.clock, focus);
    memory.update(dt, camera, S);
    sound.update(dt, camera, world, S, walker);
    ui.update(S, film);
    HZ.uHzTime.value = S.clock;
  }
  function render() {
    renderer.info.reset();
    memory.prepass();
    renderer.render(scene, camera);
  }
  function frame() {
    const dt = Math.min(0.05, clock.getDelta());
    if (!S.paused) {
      const a = performance.now();
      step(dt);
      render();
      frameMs = frameMs * 0.9 + (performance.now() - a + dt * 0) * 0.1;
      acc += dt; frames++;
      if (acc > 1) { info.fps = Math.round(frames / acc); info.calls = renderer.info.render.calls; info.tris = renderer.info.render.triangles; acc = 0; frames = 0; }
    }
    requestAnimationFrame(frame);
  }
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) walker.release(); });
  requestAnimationFrame(frame);
  info.loadMs = Math.round(performance.now() - t0);
  ui.ready();

  window.__path = {
    S, world, film, walker, memory, renderer, scene, camera, info, STATIONS, buildings,
    look(eye, at, fov = 50) { S.override = eye ? { eye, at, fov } : null; },
    seek(t) { S.mode = 'film'; S.filmT = t; },
    free: startFree, director: resumeFilm,
    still(seconds = 0.5, fps = 30) { S.paused = true; for (let i = 0; i < Math.max(1, Math.round(seconds * fps)); i++) step(1 / fps); render(); },
    resume() { S.paused = false; clock.getDelta(); },
    stats: () => ({ ...info, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, programs: renderer.info.programs?.length, mode: S.mode, filmT: +S.filmT.toFixed(2), pos: camera.position.toArray().map((v) => +v.toFixed(2)) }),
  };
}

main().catch((e) => { console.error(e); const s = document.querySelector('#pw-ui'); if (s) s.innerHTML = '<p class="pw-fail">无法启动三维场景：' + (e.message || e) + '</p>'; document.body.classList.add('pw-failed'); });
