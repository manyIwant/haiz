// HAIZ homepage — walk around one tree; it grows as you go.
// One scroll progress p ∈ [0, 5] (GSAP ScrollTrigger, scrubbed and snapped to
// the six viewpoints) drives the camera, the tree's growth, the light of the
// day and which part of HAIZ is open.
import * as THREE from 'three';
import { CHAPTERS, FRAMES, poseAt, growAt, lightAt, retarget, AXIS } from './chapters.js';
import { DwellCamera } from './camera.js';
import { sunPosition, haikouParts } from './sun.js';
import { UNIFORMS } from './foliage.js';
import { Specimens } from './specimen.js';
import { Soundscape } from './sound.js';
import { Visits } from './visits.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const N = CHAPTERS.length;
const body = document.body;
const panels = $$('.panel');
const stops = $$('.stop');
const state = { p: 0 };
let world = null, cam = null, active = -1;
let override = null;
let saved = null;
try { saved = JSON.parse(sessionStorage.getItem('haiz.home') || 'null'); } catch { /* storage blocked */ }   // look-dev: a fixed camera frame for reviewing the tree itself

// ------------------------------------------------------------------ scroll → progress
const maxScroll = () => document.documentElement.scrollHeight - innerHeight;
const scrollForStop = (i) => (stops[i] ? stops[i].offsetTop : 0);
function goTo(i, instant = false) {
  i = Math.max(0, Math.min(N - 1, i));
  const y = scrollForStop(i);
  if (instant || reduceMotion) { scrollTo(0, y); state.p = i; return; }
  scrollTo({ top: y, behavior: 'smooth' });
}
function wireScroll() {
  const gsap = window.gsap, ST = window.ScrollTrigger;
  if (gsap && ST) {
    gsap.registerPlugin(ST);
    const mm = gsap.matchMedia();
    mm.add({ calm: '(prefers-reduced-motion: reduce)', full: '(prefers-reduced-motion: no-preference)' }, (ctx) => {
      const calm = ctx.conditions.calm;
      gsap.to(state, {
        p: N - 1, ease: 'none',
        scrollTrigger: {
          trigger: '#track', start: 'top top', end: 'bottom bottom',
          scrub: calm ? true : 1.15,
          snap: { snapTo: 1 / (N - 1), inertia: false, directional: true, duration: calm ? 0 : { min: 0.55, max: 1.5 }, delay: 0.1, ease: 'power2.inOut' }
        }
      });
    });
  } else {
    // GSAP unavailable: a plain, eased mapping of the native scroll
    let target = 0;
    addEventListener('scroll', () => { target = (scrollY / Math.max(1, maxScroll())) * (N - 1); }, { passive: true });
    (function follow() { state.p += (target - state.p) * 0.12; requestAnimationFrame(follow); })();
  }
}
for (const a of $$('[data-go]')) a.addEventListener('click', (e) => { if (!body.classList.contains('spatial')) return; e.preventDefault(); goTo(+a.dataset.go); });
for (const a of $$('.begin a')) a.addEventListener('click', (e) => { if (!body.classList.contains('spatial')) return; e.preventDefault(); goTo(1); });
for (const p of panels) p.addEventListener('focusin', () => { const i = +p.dataset.i; if (body.classList.contains('spatial') && i !== active) goTo(i); });

// ------------------------------------------------------------------ panels (GSAP reveals)
let panelTl = null;
function setActive(i) {
  if (i === active) return;
  const prev = active;
  active = i;
  body.dataset.chapter = i < 0 ? '' : String(i);
  const g = window.gsap;
  panels.forEach((p, k) => p.toggleAttribute('inert', k !== i));
  if (prev >= 0) {
    const out = panels[prev];
    if (g && !reduceMotion) {
      g.to(out.querySelectorAll('.display .line > span'), { yPercent: -105, duration: 0.45, ease: 'power3.in', stagger: 0.04, overwrite: true });
      g.to(out.querySelectorAll('.idx, .zh, .lede, .entries li, .note, .begin'), { opacity: 0, y: -10, duration: 0.35, overwrite: true,
        onComplete: () => { if (active !== prev) out.classList.remove('is-active'); } });
    } else out.classList.remove('is-active');
  }
  if (i >= 0) {
    const inn = panels[i];
    inn.classList.add('is-active');
    if (g && !reduceMotion) {
      panelTl?.kill();
      panelTl = g.timeline({ delay: prev >= 0 ? 0.25 : 0.1 });
      panelTl.fromTo(inn.querySelectorAll('.display .line > span'), { yPercent: 108 }, { yPercent: 0, duration: 1.15, ease: 'power4.out', stagger: 0.09 }, 0)
        .fromTo(inn.querySelectorAll('.idx, .zh, .lede, .entries li, .note, .begin'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.05 }, 0.15);
    }
    try { sessionStorage.setItem('haiz.home', JSON.stringify({ c: i, t: Date.now() })); } catch { /* storage blocked */ }
    const id = CHAPTERS[i].id;
    if (location.hash.slice(1) !== id) history.replaceState(null, '', i === 0 ? location.pathname + location.search : '#' + id);
    $('#whereIdx').textContent = CHAPTERS[i].index;
    $('#whereName').textContent = i === 0 ? '一棵树' : CHAPTERS[i].zh.split(' · ')[0];
    setCard(i);
  } else setCard(-1);
}

// ------------------------------------------------------------------ helpers & static UI
const visits = new Visits();
const specimens = new Specimens(visits, (n) => { $('#bookCount').textContent = String(n); });
const sound = new Soundscape();
$('#bookButton').addEventListener('click', () => specimens.openBook());
$('#searchButton').addEventListener('click', () => $('#exploreOpen')?.click());
for (const b of $$('[data-action="book"]')) b.addEventListener('click', () => specimens.openBook());
for (const b of $$('[data-action="search"]')) b.addEventListener('click', () => $('#exploreOpen')?.click());
$('#soundButton').addEventListener('click', async () => $('#soundButton').setAttribute('aria-pressed', String(await sound.toggle())));

// orbit navigator: each viewpoint sits at its real azimuth around the tree
const SVGNS = 'http://www.w3.org/2000/svg';
function buildOrbit() {
  const g = $('#orbitDots');
  FRAMES.forEach((f, i) => {
    const x = Math.sin(f.th) * 44, y = Math.cos(f.th) * 44;
    const c = document.createElementNS(SVGNS, 'circle');
    c.setAttribute('cx', x.toFixed(1)); c.setAttribute('cy', y.toFixed(1)); c.setAttribute('r', '3.6');
    c.setAttribute('class', 'dot');
    c.addEventListener('click', () => goTo(i));
    const t = document.createElementNS(SVGNS, 'text');
    t.setAttribute('x', (x * 1.27).toFixed(1)); t.setAttribute('y', (y * 1.27 + 2.4).toFixed(1));
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('class', 'lab');
    t.textContent = CHAPTERS[i].index;
    g.append(c, t);
  });
}
buildOrbit();
const orbitDots = $$('#orbitDots .dot');
const orbitEye = $('#orbitEye');

// ------------------------------------------------------------------ the pinned card
const card = $('#card');
let cardFor = -1;
const ANCHORS = CHAPTERS.map(() => new THREE.Vector3(2.5, 6, 0));
function setCard(i) {
  cardFor = i;
  const e = i >= 0 ? CHAPTERS[i].entries.find((x) => x.primary && x.href) : null;
  if (!e) { card.classList.remove('show'); card.hidden = true; return; }
  card.hidden = false;
  card.href = e.href;
  card.toggleAttribute('data-dark', !!e.dark);
  card.querySelector('.card-idx').textContent = CHAPTERS[i].index;
  card.querySelector('.card-title').textContent = e.title;
  card.querySelector('.card-note').textContent = e.note;
  requestAnimationFrame(() => card.classList.add('show'));
}
const svg = $('#leaders');
const leader = document.createElementNS(SVGNS, 'g');
leader.append(document.createElementNS(SVGNS, 'path'), document.createElementNS(SVGNS, 'circle'));
svg.append(leader);
const cardPos = { x: 0, y: 0, init: false };
function placeCard(settle) {
  if (cardFor < 0 || card.hidden || innerWidth < 760) { leader.style.opacity = '0'; return; }
  const v = ANCHORS[cardFor].clone().project(world.camera);
  const ax = (v.x * 0.5 + 0.5) * innerWidth, ay = (-v.y * 0.5 + 0.5) * innerHeight;
  const tx = Math.min(innerWidth - 400, Math.max(innerWidth * 0.52, ax + 60)), ty = Math.max(90, Math.min(innerHeight - 330, ay - 190));
  if (!cardPos.init) { cardPos.x = tx; cardPos.y = ty; cardPos.init = true; }
  cardPos.x += (tx - cardPos.x) * 0.12; cardPos.y += (ty - cardPos.y) * 0.12;
  card.style.transform = `translate(${cardPos.x.toFixed(1)}px, ${cardPos.y.toFixed(1)}px)`;
  const ok = v.z < 1 && ax > 0 && ax < innerWidth && ay > 0 && ay < innerHeight;
  leader.style.opacity = ok ? String(settle * 0.9) : '0';
  const sx = cardPos.x, sy = cardPos.y + 150;
  leader.children[0].setAttribute('d', `M${sx.toFixed(1)},${sy.toFixed(1)} C${(sx - 40).toFixed(1)},${sy.toFixed(1)} ${(ax + 30).toFixed(1)},${ay.toFixed(1)} ${ax.toFixed(1)},${ay.toFixed(1)}`);
  leader.children[1].setAttribute('cx', ax.toFixed(1)); leader.children[1].setAttribute('cy', ay.toFixed(1)); leader.children[1].setAttribute('r', '3.5');
}

// ------------------------------------------------------------------ leaving: dolly + veil
function leave(href, dark, x, y, anchor) {
  if (world && anchor) cam.push = { point: anchor.clone(), t: 0, d: 0.95 };
  const veil = $('#veil');
  veil.style.setProperty('--veil', dark ? '#0b1310' : '#f7f3eb');
  const g = window.gsap;
  if (g && !reduceMotion) {
    g.fromTo(veil, { clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${Math.hypot(innerWidth, innerHeight)}px at ${x}px ${y}px)`, duration: 0.95, ease: 'power3.inOut', onComplete: () => { location.href = href; } });
  } else location.href = href;
}
addEventListener('pageshow', (e) => { if (e.persisted) { $('#veil').style.clipPath = ''; if (cam) cam.push = null; } });
for (const a of [...$$('.panel .entries a'), card]) {
  a.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || !body.classList.contains('spatial')) return;
    e.preventDefault();
    const r = a.getBoundingClientRect();
    leave(a.getAttribute('href'), a.hasAttribute('data-dark'), r.left + r.width / 2, r.top + r.height / 2, active >= 0 ? ANCHORS[active] : null);
  });
}

// ------------------------------------------------------------------ 3D
async function start3D() {
  const ok = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();
  if (!ok || navigator.connection?.saveData || params.has('static')) return goStatic();
  body.classList.add('spatial');
  const { buildScene, pickTier } = await import('./scene.js');
  const tierName = pickTier();
  document.documentElement.dataset.tier = tierName;
  try {
    world = await buildScene($('#world'), tierName);
  } catch (err) {
    console.error(err);
    return goStatic();
  }
  aimStudy();
  computeAnchors();
  world.resize();
  addEventListener('resize', () => world.resize());
  cam = new DwellCamera(world.camera, $('#world'));
  cam.rail = () => override || poseAt(state.p);
  // came back from a page: return to the viewpoint you left from (read before the first setActive)
  const fromHash = CHAPTERS.findIndex((c) => c.id === location.hash.slice(1));
  const startAt = fromHash >= 0 ? fromHash : saved && Date.now() - saved.t < 30 * 60000 ? saved.c : 0;
  wireScroll();
  if (startAt > 0) goTo(startAt, true);
  cam.snap();
  wireTree();
  loop();
  body.classList.add('ready');
  visits.arrive(haikouParts(Date.now()), { label: '' });
}

function goStatic() {
  body.classList.remove('spatial');
  body.classList.add('static');
  panels.forEach((p) => { p.classList.add('is-active'); p.removeAttribute('inert'); });
}

// The "between classes" view looks closely at a real cluster of new leaves.
function aimStudy() {
  const ros = world.rosettes, st = world.stride;
  let best = -1, score = -1e9;
  for (let i = 0; i < ros.length; i += st) {
    const x = ros[i], y = ros[i + 1], z = ros[i + 2], tE = ros[i + 9];
    const th = Math.atan2(x - AXIS.x, z - AXIS.z), r = Math.hypot(x - AXIS.x, z - AXIS.z);
    if (y < 3.6 || y > 6.5 || r < 6 || r > 11 || tE < 0.15 || tE > 0.45) continue;
    const s = -Math.abs(Math.atan2(Math.sin(th - 3.32), Math.cos(th - 3.32))) * 2 - Math.abs(y - 4.8) - Math.abs(tE - 0.3) * 6;
    if (s > score) { score = s; best = i; }
  }
  if (best < 0) return;
  const P = new THREE.Vector3(ros[best], ros[best + 1], ros[best + 2]);
  const out = new THREE.Vector3(P.x - AXIS.x, 0, P.z - AXIS.z).normalize();
  const side = new THREE.Vector3(-out.z, 0, out.x);
  const eye = P.clone().addScaledVector(out, 3.0).addScaledVector(side, 1.3).add(new THREE.Vector3(0, -0.7, 0));
  retarget(3, { eye: eye.toArray(), look: P.clone().addScaledVector(out, -0.6).add(new THREE.Vector3(0, 0.15, 0)).toArray() });
  ANCHORS[3].copy(P);
  buildOrbitRefresh();
}
function buildOrbitRefresh() { $('#orbitDots').replaceChildren(); buildOrbit(); orbitDots.splice(0, orbitDots.length, ...$$('#orbitDots .dot')); }

// pin each section's card on what is in the picture at its viewpoint
function computeAnchors() {
  const probe = world.camera.clone();
  probe.aspect = innerWidth / innerHeight; probe.updateProjectionMatrix();
  const rc = new THREE.Raycaster();
  const solids = [world.bark, world.island];
  const ros = world.rosettes, st = world.stride;
  const v = new THREE.Vector3();
  CHAPTERS.forEach((c, i) => {
    if (i === 3) return;
    DwellCamera.place(probe, i);
    rc.setFromCamera(new THREE.Vector2(0.18, 0.1), probe);
    const hits = rc.intersectObjects(solids, false);
    let best = hits.length ? hits[0].distance : 40;
    let point = hits.length ? hits[0].point.clone() : rc.ray.at(best, new THREE.Vector3());
    for (let k = 0; k < ros.length; k += st) {
      v.set(ros[k], ros[k + 1], ros[k + 2]);
      if (rc.ray.distanceSqToPoint(v) < 0.25) { const d = v.distanceTo(rc.ray.origin); if (d < best) { best = d; point = v.clone(); } }
    }
    ANCHORS[i].copy(point);
  });
}

// ------------------------------------------------------------------ touching the tree
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let touchIdx = 0, lastBrush = 0;
function pointerRay(e) {
  const r = world.renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, world.camera);
  return ray.ray;
}
function rosetteHits(r, radius = 0.45) {
  const ros = world.rosettes, st = world.stride, g = UNIFORMS.uGrow.value;
  let n = 0, nearest = null, nd = 1e9;
  const p = new THREE.Vector3();
  for (let i = 0; i < ros.length; i += st) {
    if (0.04 + (ros[i + 9] - 0.04) * 0.75 > g && !(ros[i + 10] > g)) continue;   // nothing there yet
    p.set(ros[i], ros[i + 1], ros[i + 2]);
    if (r.distanceSqToPoint(p) < radius * radius) {
      n++;
      const along = p.clone().sub(r.origin).dot(r.direction);
      if (along > 0 && along < nd) { nd = along; nearest = p.clone(); }
    }
  }
  return { n, nearest };
}
function brush(o, d, s) {
  const t = UNIFORMS.uTime.value;
  if (t - lastBrush < 0.09) return;
  lastBrush = t;
  const i = touchIdx++ % 4;
  UNIFORMS.uTouchO.value[i].set(o.x, o.y, o.z, t);
  UNIFORMS.uTouchD.value[i].set(d.x, d.y, d.z, s);
}
function stageLabel(g) { return g < 0.15 ? '冬末空枝' : g < 0.45 ? '新芽' : g < 0.7 ? '新叶舒展' : g < 0.9 ? '渐浓' : '枝繁叶茂'; }
function wireTree() {
  const canvas = world.renderer.domElement;
  cam.onHover = (e) => {
    if (e.pointerType === 'touch') return;
    const r = pointerRay(e);
    const hit = rosetteHits(r);
    if (hit.n) { brush(r.origin, r.direction, Math.min(1.2, 0.35 + hit.n * 0.12)); sound.rustle(Math.min(1, hit.n / 6)); }
    canvas.style.cursor = world.litter.pick(r) ? 'pointer' : hit.n ? 'grab' : '';
  };
  cam.onTap = (e) => {
    const r = pointerRay(e);
    const fl = world.litter.pick(r, e.pointerType === 'touch' ? 0.9 : 0.6);
    const now = haikouParts(Date.now());
    const sunNow = sunPosition(Date.now());
    if (fl) {
      world.litter.falling.splice(world.litter.falling.indexOf(fl), 1);
      sound.catch();
      visits.markSeen('caught');
      specimens.open({ age: fl.age, variant: fl.variant, len: fl.len, from: 'air' }, now, { label: stageLabel(UNIFORMS.uGrow.value) }, sunNow);
      return;
    }
    const hit = rosetteHits(r, 0.6);
    if (hit.n) { brush(r.origin, r.direction, Math.min(2.2, 1 + hit.n * 0.2)); sound.rustle(1); return; }
    const g = world.litter.pickGround(r);
    if (g) specimens.open({ age: g.age, variant: g.variant, len: g.len, from: 'ground' }, now, { label: stageLabel(UNIFORMS.uGrow.value) }, sunNow);
  };
  world.litter.onLand = () => sound.land();
  world.litter.onGift = () => {
    const ros = world.rosettes, st = world.stride, n = ros.length / st, v = new THREE.Vector3();
    for (let k = 0; k < 60; k++) {
      const i = Math.floor(Math.random() * n) * st;
      v.set(ros[i], ros[i + 1], ros[i + 2]);
      const s = v.clone().project(world.camera);
      if (s.z < 1 && Math.abs(s.x) < 0.5 && s.y > -0.1 && s.y < 0.8) return world.litter.release(v, 0.75 + Math.random() * 0.3, null, true);
    }
    return world.litter.release(null, null, null, true);
  };
}

// ------------------------------------------------------------------ loop
let paused = params.has('capture');
let last = performance.now(), frames = 0, dwell = 0, slowAcc = 0, slowN = 0;
const fwd = new THREE.Vector3(), sunDir = new THREE.Vector3();
const C = (a) => new THREE.Color(a[0], a[1], a[2]);
function step(dt, wallDt = dt) {
  UNIFORMS.uTime.value += dt;
  const t = UNIFORMS.uTime.value;
  const p = state.p;
  const near = Math.round(p);
  setActive(Math.abs(p - near) < 0.3 ? near : -1);
  // growth and the light of the day follow the walk
  const grow = growAt(p);
  const L = lightAt(p);
  const rail = override || poseAt(p);
  fwd.set(rail.lx - rail.ex, 0, rail.lz - rail.ez).normalize();
  const yaw = Math.atan2(fwd.x, fwd.z) + L.rel;
  const el = THREE.MathUtils.degToRad(L.elev);
  sunDir.set(Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el));
  world.setStage({ grow, sunDir, sunCol: C(L.sun), sunI: L.I, zenith: C(L.zenith), horizon: C(L.horizon), glow: C(L.glow),
    fog: C(L.fog), density: L.density, mist: L.mist, rays: L.rays, exposure: L.exposure, warm: L.warm, cloud: L.cloud,
    aperture: L.aperture, focus: L.focus > 0.1 ? L.focus : Math.hypot(rail.lx - rail.ex, rail.ly - rail.ey, rail.lz - rail.ez) });
  const gust = 0.5 + 0.3 * Math.sin(t * 0.13) + 0.2 * Math.sin(t * 0.047 + 1.3) * Math.sin(t * 0.31);
  UNIFORMS.uGust.value = Math.max(0, Math.min(1, gust));
  UNIFORMS.uWind.value = reduceMotion ? 0.05 : 0.22 + 0.18 * grow;
  cam.update(dt, wallDt);
  world.camera.updateMatrixWorld();
  dwell += cam.idleSeconds() > 2 ? dt : dt * 0.4;
  world.litter.update(dt, grow, UNIFORMS.uWind.value * UNIFORMS.uGust.value, UNIFORMS.uWindDir.value, dwell, active === N - 1);
  sound.update(UNIFORMS.uWind.value * (0.5 + UNIFORMS.uGust.value), { fallen: 1 - grow }, haikouParts(Date.now()), { altitude: el });
  // navigator: the eye's real azimuth around the tree
  const th = Math.atan2(world.camera.position.x - AXIS.x, world.camera.position.z - AXIS.z);
  orbitEye.setAttribute('transform', `rotate(${(180 - th * 180 / Math.PI).toFixed(2)})`);
  orbitDots.forEach((d, i) => d.classList.toggle('on', i === active));
  $('#growthBar').style.transform = `scaleX(${grow.toFixed(3)})`;
  placeCard(1 - Math.min(1, Math.abs(p - near) * 4));
  world.render(t);
  frames++;
}
function loop() {
  requestAnimationFrame(function frame(now) {
    const wall = Math.min(0.5, (now - last) / 1000);
    last = now;
    if (!document.hidden && !paused) { step(Math.min(0.05, wall), wall); adapt(wall); }
    requestAnimationFrame(frame);
  });
}
// keep the frame rate honest on weaker GPUs: lower resolution before anything else
function adapt(dt) {
  if (frames < 90) return;
  slowAcc += dt; slowN++;
  if (slowN >= 120) {
    const r = world.renderer.getPixelRatio();
    if (slowAcc / slowN > 0.034 && r > 0.75) { const nr = Math.max(0.75, r * 0.8); world.renderer.setPixelRatio(nr); world.composer.setPixelRatio(nr); world.resize(); }
    slowAcc = 0; slowN = 0;
  }
}

window.__haizHome = {
  get world() { return world; }, chapters: CHAPTERS, state,
  go: (i) => { goTo(i, true); state.p = i; cam?.snap(); setActive(i); },
  still: (seconds = 1, fps = 30) => { paused = true; for (let i = 0; i < Math.round(seconds * fps); i++) step(1 / fps); },
  lookdev: (eye, look, p) => { override = { ex: eye[0], ey: eye[1], ez: eye[2], lx: look[0], ly: look[1], lz: look[2] }; state.p = p; cam.snap(); },
  info: () => ({ active, p: state.p, grow: UNIFORMS.uGrow.value, leaves: world?.canopy.data.count,
    falling: world?.litter.falling.length, settled: world?.litter.settled.length, tier: document.documentElement.dataset.tier })
};

if ((params.has('capture') || params.has('test')) && window.gsap) window.gsap.ticker.lagSmoothing(0);   // review stills and slow test renderers
requestAnimationFrame(() => body.classList.add('painted'));
setActive(0);
start3D();
