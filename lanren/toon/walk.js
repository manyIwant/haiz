// HAIZ · 校园漫步（画风预览）— the campus as a painted, sunlit world, walked in third person.
//
// Shares the project's authoritative campus data and frame (assets/walk/campus.json, lanren/map/
// geo.js), the Blender V3 buildings and their colliders (lanren/map/campus-v3.js, lanren/world/
// collide.js). The look follows docs/toon-campus-style-20261116.md. Everything that is quick to
// make (sky, ground, grass, trees, the student) appears first; the 11 MB building model streams in
// behind and rises into place, so the walk can start before it arrives.
import * as THREE from 'three';
import { buildGeo } from '../map/geo.js';
import { buildColliders } from '../world/collide.js';
import { buildCampus } from '../map/campus3d.js';
import { TOON } from './toon.js';
import { createSky, SKY } from './sky.js';
import { createDaylight, PRESETS } from './daylight.js';
import { createGround, paintGrassMask, createWater } from './ground.js';
import { createGrass } from './grass.js';
import { createFlora } from './flora.js';
import { createHorizon } from './horizon.js';
import { createStudent } from './student.js';
import { createPlayer } from './player.js';
import { createPost } from './post.js';

const Q = new URLSearchParams(location.search);
const ROOT = new URL('../', import.meta.url);
const asset = (p) => new URL(p, ROOT).href;
const coarse = matchMedia('(pointer: coarse)').matches;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// quality tiers: the art is the same; only counts and buffer sizes change
const TIERS = {
  high: { pr: Math.min(devicePixelRatio, 2), shadow: 4096, samples: 4, grass: [{ count: 110000, radius: 20, height: 0.3, width: 0.038, segments: 4 }, { count: 80000, radius: 62, height: 0.36, width: 0.1, segments: 2, inner: 0.25 }] },
  medium: { pr: Math.min(devicePixelRatio, 1.5), shadow: 2048, samples: 4, grass: [{ count: 76000, radius: 16, height: 0.3, width: 0.04, segments: 4 }, { count: 46000, radius: 52, height: 0.36, width: 0.11, segments: 2, inner: 0.25 }] },
  low: { pr: Math.min(devicePixelRatio, 1.25), shadow: 2048, samples: 0, grass: [{ count: 34000, radius: 14, height: 0.3, width: 0.05, segments: 3 }, { count: 24000, radius: 40, height: 0.36, width: 0.13, segments: 2, inner: 0.25 }] },
};
const tierName = TIERS[Q.get('quality')] ? Q.get('quality') : (coarse ? 'medium' : 'high');
const tier = TIERS[tierName];

const $ = (s) => document.querySelector(s);
const status = $('#tw-status');
const say = (t) => { if (status) status.textContent = t; };

async function main() {
  const canvas = $('#tw-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(tier.pr);
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(coarse && innerHeight > innerWidth ? 62 : 50, innerWidth / innerHeight, 0.1, 5000);

  say('读取校园数据…');
  const campus = await (await fetch(asset('../assets/walk/campus.json'))).json();
  const geo = buildGeo(campus, null, { rotation: 0 });
  const model = buildCampus(campus, geo.frame);

  // ---------------------------------------------------------------- world, quick parts first
  scene.add(createSky());
  const day = createDaylight(scene, renderer, { shadowSize: tier.shadow, shadowBox: 60 });
  const start = PRESETS[Q.get('time')] ? Q.get('time') : 'noon';
  day.set(start, true);
  const { mesh: groundMesh, painter } = createGround(geo);
  scene.add(groundMesh);
  scene.add(createWater(geo, SKY));
  const mask = paintGrassMask(geo);
  const grass = createGrass({ paint: painter, mask, layers: tier.grass });
  scene.add(grass.group);
  scene.add(createHorizon(geo));

  // colliders: footprints until the Blender hulls arrive
  const sheet = geo.frame.sheet;
  const water = geo.features.filter((f) => f.kind === 'water').map((f) => ({ id: f.id, cx: f.cx, cz: f.cz, hw: f.hw, hd: f.hd, rot: f.rot, tall: false }));
  const rockF = geo.features.find((f) => f.id === 'hujulongpan');
  const rock = rockF ? [{ id: 'taihu', cx: rockF.cx, cz: rockF.cz, hw: 3.4, hd: 2.3, rot: rockF.rot, tall: false }] : [];
  let circles = [{ id: 'lanshu', x: 0.1, z: 0, r: 1.15 }];
  let col = buildColliders(model.buildings, { rects: [...water, ...rock], circles }, sheet);
  let decksAt = () => geo.frame.ground + 0.02;
  const heightAt = (x, z) => decksAt(x, z);

  say('载入人物与树木…');
  const [student, flora] = await Promise.all([
    createStudent(asset('assets/toon/student.glb')),
    createFlora(geo, { url: asset('assets/toon/flora.glb'), atlasUrl: asset('assets/toon/leaf-atlas.png') }),
  ]);
  scene.add(student.root, flora.group);
  circles = circles.concat(flora.trees.map((t, i) => ({ id: 'tree' + i, x: t.x, z: t.z, r: t.kind === 'shrub' ? 0.55 * t.s : t.kind === 'palm' ? 0.24 : 0.3 * t.s })));
  col = buildColliders(model.buildings, { rects: [...water, ...rock], circles }, sheet);

  // spawn: the north forecourt, looking south past the old tree to 一号教学楼 (campus -Z is north)
  const spawn = { x: Number(Q.get('x')) || 3, z: Number(Q.get('z')) || -34, yaw: Q.has('yaw') ? Number(Q.get('yaw')) * Math.PI / 180 : 0.05 };
  const player = createPlayer({ camera, dom: canvas, student, getColliders: () => col, heightAt, ground: (x, z) => heightAt(x, z), spawn, coarse });
  player.place(spawn.x, spawn.z, spawn.yaw);
  player.bindStick($('#tw-stick'));

  const post = createPost(renderer, scene, camera, { samples: tier.samples });
  post.setSize(innerWidth, innerHeight);
  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.fov = coarse && innerHeight > innerWidth ? 62 : 50;
    camera.updateProjectionMatrix();
    post.setSize(innerWidth, innerHeight);
  });

  // ---------------------------------------------------------------- the buildings, streamed in behind
  const info = { tier: tierName, buildings: 'loading', tris: 0, trees: flora.trees.length };
  let rise = null;
  if (Q.get('campus') !== 'off') {
    say('校园建筑载入中（约 11 MB）· 可以先走走');
    import('./campus.js').then(({ createCampus }) => createCampus(geo, model)).then((c) => {
      scene.add(c.scene);
      col = buildColliders([], { rects: [...c.hulls, ...water, ...rock], circles }, sheet);
      decksAt = c.heightAt;
      info.buildings = 'ready'; info.tris = c.tris;
      rise = { t: reduce ? 1 : 0, scene: c.scene };
      c.scene.position.y = reduce ? 0 : -6;
      say('');
      document.body.classList.add('tw-ready');
    }).catch((e) => {
      console.warn('campus buildings unavailable', e);
      info.buildings = 'failed';
      say('校园建筑未能载入：仍可在场地中漫步');
    });
  } else { info.buildings = 'off'; say(''); }

  // ---------------------------------------------------------------- interface
  const chips = document.querySelectorAll('[data-time]');
  const markTime = () => chips.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.time === day.name)));
  chips.forEach((b) => b.addEventListener('click', () => { day.set(b.dataset.time); markTime(); }));
  markTime();
  const order = ['morning', 'noon', 'golden'];
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyT') { day.set(order[(order.indexOf(day.name) + 1) % 3]); markTime(); }
    if (e.code === 'KeyH') document.body.classList.toggle('tw-bare');
    if (e.code === 'KeyV') markView();
  });
  const viewBtn = $('[data-view]');
  const markView = () => { if (viewBtn) viewBtn.textContent = player.firstPerson ? '第一人称' : '第三人称'; };
  viewBtn?.addEventListener('click', () => { player.toggleView(); markView(); });
  $('[data-jump]')?.addEventListener('pointerdown', (e) => { e.preventDefault(); player.jump(); });
  $('[data-help]')?.addEventListener('click', () => { const h = $('#tw-help'); h.hidden = !h.hidden; });
  $('#tw-help [data-close]')?.addEventListener('click', () => { $('#tw-help').hidden = true; });

  // ---------------------------------------------------------------- loop, with a gentle quality governor
  const clock = new THREE.Clock();
  let acc = 0, frames = 0, grassQ = 1, settled = 0;
  const focus = new THREE.Vector3();
  function frame() {
    const raw = clock.getDelta();
    const dt = Math.min(raw, 1 / 20);
    TOON.uTime.value += dt;
    const S = player.update(dt);
    if (rise && rise.t < 1) {
      rise.t = Math.min(1, rise.t + dt / 2.4);
      const k = 1 - Math.pow(1 - rise.t, 3);
      rise.scene.position.y = -6 * (1 - k);
    }
    focus.set(S.pos.x, S.pos.y, S.pos.z);
    day.update(dt, focus);
    post.setGrade(day.grade);
    grass.update(focus, S.pos);
    post.render(dt);
    // the governor: if frames are slow for a few seconds, draw fewer blades (never below 45%)
    acc += raw; frames++;
    if (acc > 2) {
      const ms = (acc / frames) * 1000;
      info.ms = Math.round(ms * 10) / 10;
      if (ms > 24 && grassQ > 0.45 && !Q.has('quality')) { grassQ = Math.max(0.45, grassQ - 0.15); grass.setQuality(grassQ); }
      else if (ms < 14 && grassQ < 1 && settled++ > 2) { grassQ = Math.min(1, grassQ + 0.1); grass.setQuality(grassQ); }
      info.grass = grassQ;
      acc = 0; frames = 0;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  $('#tw-loading')?.classList.add('done');
  document.body.classList.add('tw-live');
  if (!coarse) { const h = $('#tw-help'); if (h && !sessionStorageGet('haiz.toonHelp')) { h.hidden = false; sessionStorageSet('haiz.toonHelp', '1'); } }

  // a small handle for tests and screenshots (read-only facts, plus pose/time setters)
  window.__toon = {
    info, renderer, scene, camera, player, day, student, TOON,
    colliders: () => col,
    setTime: (n) => { day.set(n, true); markTime(); },
    place: (x, z, yawDeg) => player.place(x, z, yawDeg * Math.PI / 180),
    view: (yawDeg, pitch, dist) => { const S = player.state; S.camYaw = yawDeg * Math.PI / 180; if (pitch != null) S.camPitch = pitch; if (dist != null) { S.distWant = dist; S.distSmooth = dist; } S.lastLook = S.time; },
  };
}

function sessionStorageGet(k) { try { return sessionStorage.getItem(k); } catch { return null; } }
function sessionStorageSet(k, v) { try { sessionStorage.setItem(k, v); } catch { /* blocked */ } }

main().catch((e) => {
  console.error(e);
  say('无法启动三维场景：' + (e.message || e));
  document.body.classList.add('tw-failed');
});
