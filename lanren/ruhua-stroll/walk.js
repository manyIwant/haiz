// HAIZ · 校园漫步 V2 — entry. See docs/stroll-v2-20261116.md for the art decisions.
// Shares the campus data, frame, Blender V3 buildings and colliders with the six chapters and V1.
import * as THREE from 'three';
import { buildGeo } from '../map/geo.js';
import { buildColliders } from '../world/collide.js';
import { buildCampus } from '../map/campus3d.js';
import { U } from './atmos.js';
import { createSky } from './sky.js';
import { createDaylight, MOODS } from './daylight.js';
import { createGround, createWater } from './ground.js';
import { createGrass } from './grass.js';
import { createFlora, plantings, beds } from './flora.js';
import { createHorizon } from './horizon.js';
import { createStudent } from './student.js';
import { createPlayer } from './player.js';
import { createPost } from './post.js';

const Q = new URLSearchParams(location.search);
const ROOT = new URL('../', import.meta.url);
const asset = (p) => new URL(p, ROOT).href;
const coarse = matchMedia('(pointer: coarse)').matches;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
// every device draws the same world; tiers only set the starting resolution, MSAA and shadow texels
const TIERS = {
  high: { pr: Math.min(devicePixelRatio, 2), shadow: 4096, samples: 4, paint: 3072 },
  medium: { pr: Math.min(devicePixelRatio, 1.5), shadow: 2048, samples: 4, paint: 2048 },
  low: { pr: Math.min(devicePixelRatio, 1), shadow: 2048, samples: 0, paint: 2048 },
};
const tierName = TIERS[Q.get('quality')] ? Q.get('quality') : (coarse ? 'medium' : 'high');
const tier = TIERS[tierName];
const $ = (s) => document.querySelector(s);
const say = (t) => { const s = $('#sw-status'); if (s) s.textContent = t; };

async function main() {
  const t0 = performance.now();
  const canvas = $('#sw-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(tier.pr);
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.info.autoReset = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 6000);

  const phases = {};
  say('读取校园数据…');
  const campus = await (await fetch(asset('../assets/walk/campus.json'))).json();
  const geo = buildGeo(campus, null, { rotation: 0 });
  const model = buildCampus(campus, geo.frame);
  const trees = plantings(geo);
  const bedList = beds(geo, trees);
  const allTrees = [...trees, ...bedList.map((b) => ({ ...b, kind: 'shrub' })), { x: 0, z: 0, kind: 'lanshu', s: 1 }];

  const sky = createSky(asset('assets/stroll/clouds.png'));
  scene.add(sky.group);
  const day = createDaylight(scene, { shadowSize: tier.shadow, shadowBox: 55 });
  day.set(MOODS[Q.get('time')] ? Q.get('time') : 'noon', true);
  const tg = performance.now();
  const ground = createGround(geo, allTrees, tier.paint);
  phases.ground = Math.round(performance.now() - tg);
  scene.add(ground.mesh, createWater(geo));
  let tp = performance.now();
  const grass = createGrass({ ground });
  phases.grass = Math.round(performance.now() - tp);
  scene.add(grass.group);
  scene.add(createHorizon(geo));

  const sheet = geo.frame.sheet;
  const water = geo.features.filter((f) => f.kind === 'water').map((f) => ({ id: f.id, cx: f.cx, cz: f.cz, hw: f.hw, hd: f.hd, rot: f.rot, tall: false }));
  const rockF = geo.features.find((f) => f.id === 'hujulongpan');
  const rock = rockF ? [{ id: 'taihu', cx: rockF.cx, cz: rockF.cz, hw: 3.4, hd: 2.3, rot: rockF.rot, tall: false }] : [];
  const circles = [{ id: 'lanshu', x: 0.1, z: 0, r: 1.15 },
    ...trees.map((t, i) => ({ id: 'tree' + i, x: t.x, z: t.z, r: t.kind === 'shrub' ? 0.55 * t.s : t.kind === 'palm' ? 0.24 : 0.3 * t.s })),
    ...bedList.map((b, i) => ({ id: 'bed' + i, x: b.x, z: b.z, r: 0.5 * b.s }))];
  let col = buildColliders(model.buildings, { rects: [...water, ...rock], circles }, sheet);
  let decksAt = () => geo.frame.ground + 0.02;
  const heightAt = (x, z) => decksAt(x, z);

  say('载入人物与树木…');
  tp = performance.now();
  const [student, flora] = await Promise.all([
    createStudent(asset('assets/toon/student.glb')),
    createFlora(geo, { url: asset('assets/toon/flora.glb'), atlasUrl: asset('assets/stroll/leaf-atlas-v2.png') }),
  ]);
  scene.add(student.root, flora.group);
  phases.figureAndFlora = Math.round(performance.now() - tp);

  // landmarks the student glances at when resting (height = what the eye goes to)
  const place = (id) => geo.features.find((f) => f.id === id);
  const pois = [{ x: 0, y: 8, z: 0, r: 140, w: 3 }];
  for (const [id, y, w] of [['yihao', 10, 1.2], ['erhao', 10, 1], ['library', 9, 1.4], ['keji', 12, 1], ['beimen', 5, 1.6], ['yundong', 1, 1.2], ['yanchi', 0, 1.3], ['fengqitang_ting', 3, 1.2], ['yanlintang_ting', 3, 1.2], ['hujulongpan', 2, 1.5]]) {
    const f = place(id); if (f) pois.push({ x: f.cx, y: geo.frame.ground + y, z: f.cz, r: 160, w });
  }
  const spawn = { x: Number(Q.get('x')) || 1, z: Number(Q.get('z')) || -31, yaw: Q.has('yaw') ? Number(Q.get('yaw')) * Math.PI / 180 : 4 * Math.PI / 180 };
  const player = createPlayer({ camera, dom: canvas, student, getColliders: () => col, heightAt, spawn, coarse, pois });
  player.place(spawn.x, spawn.z, spawn.yaw);
  player.bindStick($('#sw-stick'));

  const post = createPost(renderer, scene, camera, { samples: tier.samples });
  post.setSize(innerWidth, innerHeight);
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); post.setSize(innerWidth, innerHeight); });

  const info = { version: 2, tier: tierName, buildings: 'loading', tris: 0, trees: trees.length, beds: bedList.length, floraDraws: flora.draws, loadMs: 0, campusMs: 0, phases };
  let rise = null;
  if (Q.get('campus') !== 'off') {
    say('校园建筑载入中（约 11 MB）· 可以先走走');
    const tc = performance.now();
    import('./campus.js').then(({ createCampus }) => createCampus(geo, model)).then((c) => {
      scene.add(c.scene);
      col = buildColliders([], { rects: [...c.hulls, ...water, ...rock], circles }, sheet);
      decksAt = c.heightAt;
      info.buildings = 'ready'; info.tris = c.tris; info.campusMs = Math.round(performance.now() - tc);
      rise = { t: reduce ? 1 : 0, scene: c.scene };
      c.scene.position.y = reduce ? 0 : -6;
      say('');
    }).catch((e) => { console.warn('campus buildings unavailable', e); info.buildings = 'failed'; say('校园建筑未能载入：仍可在场地中漫步'); });
  } else { info.buildings = 'off'; say(''); }

  // ---------------------------------------------------------------- shade: is the student under a tree or a building?
  const sunTest = new THREE.Vector3();
  const crowns = [...trees.filter((t) => t.kind !== 'shrub').map((t) => ({ x: t.x, z: t.z, y: geo.frame.ground + (t.kind === 'palm' ? 8.6 : t.kind === 'kapok' ? 9 : 5.3) * t.h, r: (t.kind === 'palm' ? 3.4 : t.kind === 'banyan' ? 5.6 : 3.4) * t.s, ry: (t.kind === 'palm' ? 1.0 : 2.4) * t.h })), { x: 0, z: 0, y: geo.frame.ground + 8.5, r: 11.5, ry: 6.5 }];
  function inShade(p) {
    const d = U.uSunDir.value;
    for (let s = 0.5; s < 60; s += 1.2) {
      sunTest.set(p.x + d.x * s, p.y + 1.3 + d.y * s, p.z + d.z * s);
      for (const b of model.buildings) {
        if (b.form === 'corr' || b.form === 'gate') continue;
        const dx = sunTest.x - b.cx, dz = sunTest.z - b.cz, c = Math.cos(b.rot), sn = Math.sin(b.rot);
        if (Math.abs(dx * c - dz * sn) < b.w / 2 && Math.abs(dx * sn + dz * c) < b.d / 2 && sunTest.y < geo.frame.ground + b.height) return 1;
      }
      for (const t of crowns) {
        const dx = (sunTest.x - t.x) / t.r, dy = (sunTest.y - t.y) / t.ry, dz = (sunTest.z - t.z) / t.r;
        if (dx * dx + dy * dy + dz * dz < 0.7) return 0.85;
      }
      if (sunTest.y > geo.frame.ground + 30) break;
    }
    return 0;
  }

  // ---------------------------------------------------------------- interface
  const chips = document.querySelectorAll('[data-time]');
  const markTime = () => chips.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.time === day.name)));
  chips.forEach((b) => b.addEventListener('click', () => { day.set(b.dataset.time); markTime(); }));
  markTime();
  const order = ['morning', 'noon', 'golden'];
  const viewBtn = $('[data-view]');
  const markView = () => { if (viewBtn) viewBtn.textContent = player.firstPerson ? '第一人称' : '第三人称'; };
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyT') { day.set(order[(order.indexOf(day.name) + 1) % 3]); markTime(); }
    if (e.code === 'KeyH') document.body.classList.toggle('sw-bare');
    if (e.code === 'KeyV') markView();
  });
  viewBtn?.addEventListener('click', () => { player.toggleView(); markView(); });
  $('[data-jump]')?.addEventListener('pointerdown', (e) => { e.preventDefault(); player.jump(); });
  $('[data-help]')?.addEventListener('click', () => { const h = $('#sw-help'); h.hidden = !h.hidden; });
  $('#sw-help [data-close]')?.addEventListener('click', () => { $('#sw-help').hidden = true; });
  const dbg = Q.has('debug') ? $('#sw-debug') : null;
  if (dbg) dbg.hidden = false;

  // ---------------------------------------------------------------- loop
  const clock = new THREE.Clock();
  const focus = new THREE.Vector3();
  let adapt = 1, shadeT = 0, ema = 16, acc = 0, frames = 0, jsMs = 0, govT = 0;
  const fixedScale = Q.has('scale') ? Number(Q.get('scale')) : null;
  if (fixedScale) post.setScale(fixedScale);
  const budget = Number(Q.get('budget')) || 22;
  function step(dt) {
    U.uTime.value += dt;
    const S = player.update(dt);
    if (rise && rise.t < 1) { rise.t = Math.min(1, rise.t + dt / 2.4); rise.scene.position.y = -6 * Math.pow(1 - rise.t, 3); }
    focus.set(S.pos.x, S.pos.y, S.pos.z);
    day.update(dt, focus);
    sky.update(dt, focus);
    camera.updateMatrixWorld();
    grass.update(camera, S.pos, geo.frame.ground);
    shadeT -= dt;
    if (shadeT <= 0) { shadeT = 0.15; S.shade = inShade(S.pos); }
    const want = 1 + 0.2 * (S.shade || 0);
    adapt += (want - adapt) * (1 - Math.exp(-dt * 1.1));
    const m = day.mood;
    post.setGrade(m.exposure * adapt, m.sat, m.bloom);
    return S;
  }
  function frame() {
    const raw = clock.getDelta();
    const dt = Math.min(raw, 1 / 20);
    renderer.info.reset();
    const a = performance.now();
    step(dt);
    jsMs = jsMs * 0.9 + (performance.now() - a) * 0.1;
    post.render(dt);
    ema = ema * 0.92 + raw * 1000 * 0.08;
    acc += raw; frames++; govT += raw;
    if (!fixedScale && govT > 1.5) {
      govT = 0;
      if (ema > budget * 1.15 && post.scale > 0.55) post.setScale(post.scale - 0.1);
      else if (ema < budget * 0.7 && post.scale < 1) post.setScale(post.scale + 0.05);
    }
    if (acc > 1) {
      const ri = renderer.info;
      Object.assign(info, { ms: Math.round((acc / frames) * 10000) / 10, jsMs: Math.round(jsMs * 100) / 100, scale: post.scale, calls: ri.render.calls, triangles: ri.render.triangles, textures: ri.memory.textures, geometries: ri.memory.geometries, grassTiles: grass.stats.tiles.slice(), grassVerts: grass.stats.verts, pixelRatio: renderer.getPixelRatio() });
      if (dbg) dbg.textContent = `${info.ms} ms · JS ${info.jsMs} ms · ×${post.scale.toFixed(2)} · ${info.calls} calls · ${(info.triangles / 1000).toFixed(0)}k tris · grass ${grass.stats.tiles.join('/')} tiles`;
      acc = 0; frames = 0;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  info.loadMs = Math.round(performance.now() - t0);
  $('#sw-loading')?.classList.add('done');
  if (!coarse) { const h = $('#sw-help'); try { if (h && !sessionStorage.getItem('haiz.strollHelp')) { h.hidden = false; sessionStorage.setItem('haiz.strollHelp', '1'); } } catch { /* storage blocked */ } }

  window.__stroll = {
    info, renderer, scene, camera, player, student, day, grass, U,
    colliders: () => col,
    setTime: (n) => { day.set(n, true); markTime(); },
    place: (x, z, yawDeg) => player.place(x, z, yawDeg * Math.PI / 180),
    view: (yawDeg, pitch, zoom) => { const S = player.state; S.camYaw = yawDeg * Math.PI / 180; if (pitch != null) S.camPitch = pitch; if (zoom != null) S.zoom = zoom; S.lastLook = S.lastInput = S.time; },
    /** run the simulation for `sec` seconds at 30 Hz without drawing (settles springs for screenshots) */
    settle: (sec = 3) => { for (let i = 0; i < sec * 30; i++) step(1 / 30); },
  };
}

main().catch((e) => { console.error(e); say('无法启动三维场景：' + (e.message || e)); document.body.classList.add('sw-failed'); });
