// 入画 · 画境实验室 — entry.
//
// The V2 painted campus (the world 第六幕「入画」 walks into), assembled from the same modules the walk
// uses, with no player: a free orbit camera and five fixed study views. Every frame can be drawn
// three ways — the V2 original, the lab, or both split down the middle — so each experiment is
// judged against the look HAIZ already has, not against nothing.
//
// URL: ?quality=high|medium|low  ?view=lanshu|yihao|library|fengqi|aerial  ?time=morning|noon|golden
//      ?mode=lab|base|split  ?still (frozen time, draws only on change: for screenshots and review)
//      ?layers=core,brush,broken,light,wash,planes,paint,ink,paper (the lab layers to start with)
import * as THREE from 'three';
import { buildGeo } from '../map/geo.js';
import { buildCampus } from '../map/campus3d.js';
import { U } from '../ruhua-stroll/atmos.js';
import { createSky } from '../ruhua-stroll/sky.js';
import { createDaylight, MOODS } from '../ruhua-stroll/daylight.js';
import { createGround, createWater } from '../ruhua-stroll/ground.js';
import { createGrass } from '../ruhua-stroll/grass.js';
import { createFlora, plantings, beds } from '../ruhua-stroll/flora.js';
import { createHorizon } from '../ruhua-stroll/horizon.js';
import { pairMaterials, LABM } from './material.js';
import { createLabPipeline } from './passes.js';
import { VIEWS, resolveView } from './views.js';
import { createOrbit } from './orbit.js';

const Q = new URLSearchParams(location.search);
const ROOT = new URL('../', import.meta.url);
const asset = (p) => new URL(p, ROOT).href;
const coarse = matchMedia('(pointer: coarse)').matches;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TIERS = {
  high: { pr: Math.min(devicePixelRatio, 2), shadow: 4096, samples: 4, paint: 3072 },
  medium: { pr: Math.min(devicePixelRatio, 1.5), shadow: 2048, samples: 4, paint: 2048 },
  low: { pr: Math.min(devicePixelRatio, 1), shadow: 2048, samples: 0, paint: 2048 },
};
const tierName = TIERS[Q.get('quality')] ? Q.get('quality') : (coarse ? 'medium' : 'high');
const tier = TIERS[tierName];
const still = Q.has('still');
const $ = (s) => document.querySelector(s);
const say = (t) => { const s = $('#pl-status'); if (s) s.textContent = t; };
const bar = (k) => { const b = $('#pl-bar i'); if (b) b.style.transform = `scaleX(${k})`; };

const LAYERS = [
  { id: 'core', group: '材质', label: '交界色带', hint: '明暗交界处更饱和、略暖的颜色' },
  { id: 'brush', group: '材质', label: '笔触', hint: '沿表面铺开、屏幕尺度稳定的笔触' },
  { id: 'broken', group: '材质', label: '碎色', hint: '同一明度里冷暖交替的颜色' },
  { id: 'light', group: '光', label: '光色', hint: '受光面偏暖、阴影带色相，明度不变' },
  { id: 'wash', group: '光', label: '遮蔽色', hint: '凹处向阴影色相罩染，而不是变灰' },
  { id: 'planes', group: '空间', label: '空间层次', hint: '远景明度收拢，近景色度略升' },
  { id: 'paint', group: '画面', label: '油彩', hint: '沿结构方向的笔触滤镜，远处概括为形' },
  { id: 'ink', group: '画面', label: '线', hint: '轮廓与转折处的有色线，随距离淡出' },
  { id: 'paper', group: '画面', label: '纸', hint: '固定在画面上的纸纹与颜料沉积' },
  { id: 'focus', group: '画意', label: '焦点', hint: '画中心画完，四周与前后放松、笔触变大', bold: true },
  { id: 'margin', group: '画意', label: '留白', hint: '四边颜色退回到纸上，只剩起稿的线', bold: true },
];

async function main() {
  const t0 = performance.now();
  const canvas = $('#pl-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: still });
  renderer.setPixelRatio(tier.pr);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.info.autoReset = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 6000);
  // a portrait phone keeps roughly the landscape view's width of the scene, not just its height
  const fitFov = () => {
    camera.aspect = innerWidth / innerHeight;
    const h = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(24)) * (16 / 9));
    camera.fov = camera.aspect >= 1 ? 48 : Math.min(78, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(h / 2) / camera.aspect)) * 0.62);
    camera.updateProjectionMatrix();
  };
  fitFov();

  say('读取校园数据…'); bar(0.05);
  const campus = await (await fetch(asset('../assets/walk/campus.json'))).json();
  const geo = buildGeo(campus, null, { rotation: 0 });
  const model = buildCampus(campus, geo.frame);
  const trees = plantings(geo);
  const bedList = beds(geo, trees);
  const allTrees = [...trees, ...bedList.map((b) => ({ ...b, kind: 'shrub' })), { x: 0, z: 0, kind: 'lanshu', s: 1 }];

  const sky = createSky(asset('assets/stroll/clouds.png'));
  scene.add(sky.group);
  const day = createDaylight(scene, { shadowSize: tier.shadow, shadowBox: 70 });
  day.set(MOODS[Q.get('time')] ? Q.get('time') : 'noon', true);
  const ground = createGround(geo, allTrees, tier.paint);
  scene.add(ground.mesh, createWater(geo));
  const grass = createGrass({ ground });
  scene.add(grass.group);
  scene.add(createHorizon(geo));
  bar(0.15);

  say('载入树木…');
  const flora = await createFlora(geo, { url: asset('assets/toon/flora.glb'), atlasUrl: asset('assets/stroll/leaf-atlas-v2.png') });
  scene.add(flora.group);
  bar(0.3);

  say('载入校园建筑（约 11 MB）…');
  let buildings = 'loading';
  try {
    const { createCampus } = await import('../ruhua-stroll/campus.js');
    const c = await createCampus(geo, model);
    scene.add(c.scene);
    buildings = 'ready';
  } catch (e) {
    console.warn('campus buildings unavailable', e);
    buildings = 'failed';
  }
  bar(0.85);

  const mats = pairMaterials(scene);
  const pipe = createLabPipeline(renderer, { samples: tier.samples, tier: tierName });
  pipe.setSize(innerWidth, innerHeight, tier.pr);

  // ------------------------------------------------------------ camera
  const orbit = createOrbit(camera, canvas, { minY: geo.frame.ground + 0.6, onChange: () => { dirty = true; } });
  const setView = (id, instant = false) => {
    const v = VIEWS.find((x) => x.id === id) || VIEWS[0];
    const r = resolveView(v, geo);
    orbit.go(r.pos, r.target, instant || reduce || still ? 0 : 1.4);
    view = v.id;
    document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v.id)));
    const n = $('#pl-note'); if (n) n.textContent = v.note;
    dirty = true;
  };
  let view = VIEWS[0].id;

  // ------------------------------------------------------------ state
  const on = {};
  const fromQ = Q.get('layers');
  // 研究 study: every measured layer on, the composition layers off. 画意 painting: everything,
  // with wider strokes — a bolder picture for the few shots worth taking that far
  let preset = Q.get('preset') === 'painting' ? 'painting' : 'study';
  for (const l of LAYERS) on[l.id] = fromQ ? fromQ.split(',').includes(l.id) : (preset === 'painting' || !l.bold);
  let mode = ['lab', 'base', 'split'].includes(Q.get('mode')) ? Q.get('mode') : 'split';
  let split = 0.5;
  let dirty = true;
  const applyLayers = () => {
    LABM.uLabLight.value = on.light ? 1 : 0;
    LABM.uLabMat.value.set(on.core ? 1 : 0, on.brush ? 1 : 0, on.broken ? 1 : 0, (on.core || on.brush || on.broken) ? 1 : 0);
    Object.assign(pipe.S, { wash: on.wash ? 1 : 0, planes: on.planes ? 1 : 0, paint: on.paint ? 1 : 0, ink: on.ink ? 1 : 0, paper: on.paper ? 1 : 0, focus: on.focus ? 1 : 0, margin: on.margin ? 1 : 0 });
    pipe.radius = preset === 'painting' ? [3.8, 8] : [3.2, 6];
    dirty = true;
  };
  applyLayers();

  // ------------------------------------------------------------ interface
  const markPreset = () => document.querySelectorAll('[data-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === preset)));
  document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    preset = b.dataset.preset;
    for (const l of LAYERS) on[l.id] = preset === 'painting' || !l.bold;
    document.querySelectorAll('[data-layer]').forEach((i) => { i.checked = on[i.dataset.layer]; });
    markPreset(); applyLayers();
  }));
  markPreset();
  const list = $('#pl-layers');
  let group = '';
  for (const l of LAYERS) {
    if (l.group !== group) { group = l.group; const h = document.createElement('h3'); h.textContent = group; list.append(h); }
    const lab = document.createElement('label');
    lab.className = 'pl-layer';
    lab.innerHTML = `<input type="checkbox" data-layer="${l.id}"><span><b>${l.label}</b><small>${l.hint}</small></span>`;
    const input = lab.querySelector('input');
    input.checked = on[l.id];
    input.addEventListener('change', () => { on[l.id] = input.checked; applyLayers(); });
    list.append(lab);
  }
  const views = $('#pl-views');
  for (const v of VIEWS) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.view = v.id; b.textContent = v.label; b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => setView(v.id));
    views.append(b);
  }
  const markMode = () => {
    document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    document.body.dataset.mode = mode;
    dirty = true;
  };
  document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; markMode(); }));
  markMode();
  const markTime = () => document.querySelectorAll('[data-time]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.time === day.name)));
  document.querySelectorAll('[data-time]').forEach((b) => b.addEventListener('click', () => { day.set(b.dataset.time, still || reduce); markTime(); dirty = true; }));
  markTime();
  if (innerWidth < 720) { $('#pl-panel').hidden = true; $('[data-act="panel"]').setAttribute('aria-expanded', 'false'); }
  $('[data-act="panel"]')?.addEventListener('click', (e) => {
    const p = $('#pl-panel'); p.hidden = !p.hidden; e.currentTarget.setAttribute('aria-expanded', String(!p.hidden));
  });
  // the split handle
  const handle = $('#pl-split');
  const setSplit = (x) => { split = Math.min(0.98, Math.max(0.02, x)); handle.style.left = `${split * 100}%`; handle.setAttribute('aria-valuenow', String(Math.round(split * 100))); dirty = true; };
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation(); handle.setPointerCapture(e.pointerId);
    const move = (ev) => setSplit(ev.clientX / innerWidth);
    const up = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up); };
    handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up);
  });
  handle.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { setSplit(split - 0.05); e.preventDefault(); }
    if (e.key === 'ArrowRight') { setSplit(split + 0.05); e.preventDefault(); }
  });
  setSplit(0.5);
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, button, [role="slider"]')) return;
    if (e.code === 'KeyH') document.body.classList.toggle('pl-bare');
    if (e.code === 'KeyC') { mode = mode === 'split' ? 'lab' : mode === 'lab' ? 'base' : 'split'; markMode(); }
  });
  addEventListener('resize', () => { fitFov(); pipe.setSize(innerWidth, innerHeight, tier.pr); dirty = true; });

  setView(VIEWS.find((v) => v.id === Q.get('view')) ? Q.get('view') : VIEWS[0].id, true);

  // ------------------------------------------------------------ loop
  const info = { tier: tierName, buildings, materials: mats.count, meshes: mats.meshes, loadMs: 0, frames: 0, ms: 0, scale: 1, mode, still };
  const focus = new THREE.Vector3();
  const clock = new THREE.Clock();
  let ema = 16, acc = 0, frames = 0, govT = 0;
  const budget = Number(Q.get('budget')) || 30;
  const fixedScale = Q.has('scale') ? Number(Q.get('scale')) : null;
  if (fixedScale) pipe.setScale(fixedScale, innerWidth, innerHeight, tier.pr);

  function step(dt) {
    if (!still) U.uTime.value += dt;
    orbit.update(dt);
    focus.copy(orbit.target);
    day.update(dt, focus);
    sky.update(dt, focus);
    camera.updateMatrixWorld();
    grass.update(camera, focus, geo.frame.ground);
    pipe.setMood(day.mood, U);
    pipe.focus = camera.position.distanceTo(orbit.target);
    pipe.M.final.uniforms.uGroundY.value = geo.frame.ground;
    pipe.tick(dt);
  }
  function draw() {
    renderer.info.reset();
    renderer.shadowMap.needsUpdate = true;
    if (mode === 'base') {
      mats.base(); pipe.renderScene(scene, camera); pipe.finishBase(null);
    } else if (mode === 'lab') {
      mats.lab(); pipe.renderScene(scene, camera); pipe.finishLab(camera);
    } else {
      mats.base(); pipe.renderScene(scene, camera); pipe.finishBase();
      renderer.shadowMap.needsUpdate = false;
      mats.lab(); pipe.renderScene(scene, camera); pipe.finishLab(camera, { split });
    }
    info.frames++;
  }
  function frame() {
    const raw = clock.getDelta();
    const dt = Math.min(raw, 1 / 20);
    const moving = orbit.moving;
    if (!still || dirty || moving) {
      step(still ? 1 / 30 : dt);
      draw();
      dirty = false;
    }
    if (!still) {
      ema = ema * 0.92 + raw * 1000 * 0.08;
      acc += raw; frames++; govT += raw;
      if (!fixedScale && govT > 1.5) {
        govT = 0;
        if (ema > budget * 1.15 && pipe.scale > 0.55) pipe.setScale(pipe.scale - 0.1, innerWidth, innerHeight, tier.pr);
        else if (ema < budget * 0.7 && pipe.scale < 1) pipe.setScale(pipe.scale + 0.05, innerWidth, innerHeight, tier.pr);
      }
      if (acc > 1) {
        const ri = renderer.info;
        Object.assign(info, { ms: Math.round((acc / frames) * 10) / 10, scale: pipe.scale, calls: ri.render.calls, triangles: ri.render.triangles, mode });
        const dbg = $('#pl-debug');
        if (dbg && !dbg.hidden) dbg.textContent = `${info.ms} ms · ×${pipe.scale.toFixed(2)} · ${info.calls} calls · ${(info.triangles / 1000).toFixed(0)}k tris · ${mode}`;
        acc = 0; frames = 0;
      }
    }
    if (!document.hidden) requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { clock.getDelta(); requestAnimationFrame(frame); } });
  if (Q.has('debug')) $('#pl-debug').hidden = false;

  // settle the wind springs and the shadow before the first picture
  for (let i = 0; i < 20; i++) step(1 / 30);
  requestAnimationFrame(frame);
  info.loadMs = Math.round(performance.now() - t0);
  bar(1);
  say(buildings === 'failed' ? '校园建筑未能载入：仍可查看场地与树木' : '');
  document.body.dataset.stage = 'ready';

  window.__lab = {
    info, renderer, scene, camera, U, pipe, mats, day, views: VIEWS.map((v) => v.id),
    setView: (id) => { setView(id, true); orbit.update(0); dirty = true; },
    setMode: (m) => { mode = m; markMode(); },
    setTime: (n) => { day.set(n, true); markTime(); dirty = true; },
    setPreset: (p) => { document.querySelector(`[data-preset="${p}"]`)?.click(); },
    setLayers: (ids) => { for (const l of LAYERS) on[l.id] = ids.includes(l.id); document.querySelectorAll('[data-layer]').forEach((i) => { i.checked = on[i.dataset.layer]; }); applyLayers(); },
    setSplit,
    debug: (name) => { pipe.debug = name || null; dirty = true; },
    /** draw one frame now (for screenshots in ?still mode) */
    render: () => { step(1 / 30); draw(); dirty = false; return info.frames; },
  };
}

main().catch((e) => {
  console.error(e);
  say('无法启动三维场景：' + (e.message || e));
  document.body.dataset.stage = 'failed';
});
