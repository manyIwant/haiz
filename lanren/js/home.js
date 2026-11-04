// HAIZ homepage — walk around one tree; it grows as you go.
// One scroll progress p ∈ [0, 5] (GSAP ScrollTrigger, scrubbed and snapped to
// the six viewpoints) drives the camera, the tree's growth, the light of the
// day and which part of HAIZ is open.
import * as THREE from 'three';
import { CHAPTERS, LIGHT, STAGES, shot, poseAt, growAt, lightAt, retarget, AXIS } from './chapters.js';
import { DwellCamera } from './camera.js';
import { sunPosition, haikouParts } from './sun.js';
import { UNIFORMS, leafVisible } from './foliage.js';
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
const SOFT = '.chap-label, .lede, .zh, .begin, .note-intro';
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
      const any = (q) => [...out.querySelectorAll(q)];
      g.to(any('.display .line > span'), { yPercent: -105, duration: 0.45, ease: 'power3.in', stagger: 0.04, overwrite: true });
      g.to(any(SOFT), { opacity: 0, y: -8, duration: 0.35, overwrite: true });
      // the slab is placed by CSS variables; animate a lift variable, never its transform
      if (out.querySelector('.slab')) g.to(out.querySelector('.slab'), { opacity: 0, '--lift': '14px', duration: 0.4, ease: 'power2.in', overwrite: true });
      g.delayedCall(0.45, () => { if (active !== prev) out.classList.remove('is-active'); });
    } else out.classList.remove('is-active');
  }
  if (i >= 0) {
    const inn = panels[i];
    inn.classList.add('is-active');
    slabPos.init = false;
    if (g && !reduceMotion) {
      panelTl?.kill();
      panelTl = g.timeline({ delay: prev >= 0 ? 0.25 : 0.1 });
      const any = (q) => [...inn.querySelectorAll(q)];
      panelTl.fromTo(any('.display .line > span'), { yPercent: 108 }, { yPercent: 0, duration: 1.15, ease: 'power4.out', stagger: 0.09 }, 0)
        .fromTo(any(SOFT), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.06 }, 0.1);
      const slab = inn.querySelector('.slab');
      if (slab) {
        panelTl.fromTo(slab, { opacity: 0, '--lift': '26px' }, { opacity: 1, '--lift': '0px', duration: 1.0, ease: 'power3.out' }, 0.35)
          .fromTo(any('.entries li'), { opacity: 0, x: 10 }, { opacity: 1, x: 0, duration: 0.7, ease: 'power3.out', stagger: 0.05 }, 0.5);
      }
    }
    try { sessionStorage.setItem('haiz.home', JSON.stringify({ c: i, t: Date.now() })); } catch { /* storage blocked */ }
    const id = CHAPTERS[i].id;
    if (location.hash.slice(1) !== id) history.replaceState(null, '', i === 0 ? location.pathname + location.search : '#' + id);
    $('#whereIdx').textContent = CHAPTERS[i].index;
    $('#whereName').textContent = CHAPTERS[i].label.split(' · ')[1] || CHAPTERS[i].label;
  }
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

// navigator: the camera's real path, seen from above (reference 09). Stations
// sit where the shots are; the dot is the camera right now.
const SVGNS = 'http://www.w3.org/2000/svg';
const NAV = { scale: 1, samples: [] };
// radial log scale: the far opening and closing shots and the close ones all read
const navXY = (x, z) => {
  const dx = x - AXIS.x, dz = z - AXIS.z, r = Math.hypot(dx, dz) || 1e-6;
  const k = (Math.log(1 + r / 4) * NAV.scale) / r;
  return [(dx * k).toFixed(1), (dz * k).toFixed(1)];
};
function buildOrbit() {
  const g = $('#orbitDots');
  g.replaceChildren();
  NAV.samples = [];
  let far = 1;
  for (let k = 0; k <= 250; k++) {
    const q = poseAt((k / 250) * (N - 1));
    NAV.samples.push(q);
    far = Math.max(far, Math.hypot(q.ex - AXIS.x, q.ez - AXIS.z));
  }
  NAV.scale = 46 / Math.log(1 + far / 4);
  $('#orbitPath').setAttribute('d', 'M' + NAV.samples.map((q) => navXY(q.ex, q.ez).join(',')).join(' L'));
  CHAPTERS.forEach((c, i) => {
    const f = shot(i);
    const [x, y] = navXY(f.ex, f.ez);
    const dot = document.createElementNS(SVGNS, 'circle');
    dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('r', '3.4');
    dot.setAttribute('class', 'dot');
    dot.addEventListener('click', () => goTo(i));
    const t = document.createElementNS(SVGNS, 'text');
    const out = Math.hypot(+x, +y) || 1;
    t.setAttribute('x', (+x + (x / out) * 9).toFixed(1)); t.setAttribute('y', (+y + (y / out) * 9 + 2.5).toFixed(1));
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('class', 'lab');
    t.textContent = c.index;
    g.append(dot, t);
  });
}
buildOrbit();
let orbitDots = $$('#orbitDots .dot');
const orbitEye = $('#orbitEye');
function updateNav(p, grow) {
  const k = Math.round((Math.max(0, Math.min(N - 1, p)) / (N - 1)) * 250);
  $('#orbitDone').setAttribute('d', 'M' + NAV.samples.slice(0, k + 1).map((q) => navXY(q.ex, q.ez).join(',')).join(' L'));
  const [ex, ey] = navXY(world.camera.position.x, world.camera.position.z);
  orbitEye.setAttribute('cx', ex); orbitEye.setAttribute('cy', ey);
  orbitDots.forEach((d, i) => d.classList.toggle('on', i === active));
  $('#railDot').style.top = ((p / (N - 1)) * 100).toFixed(2) + '%';
  // growth line: the dot rides the curve; the stage reached lights up
  const curve = $('#growthCurve');
  if (curve.getTotalLength) {
    const L = curve.getTotalLength();
    const pt = curve.getPointAtLength(L * grow);
    const dot = $('#growthDot');
    dot.setAttribute('cx', pt.x.toFixed(1)); dot.setAttribute('cy', pt.y.toFixed(1));
  }
  stageEls.forEach((el, i) => el.classList.toggle('on', grow >= STAGES[i].at - 0.02 && (i === STAGES.length - 1 || grow < STAGES[i + 1].at - 0.02)));
}
const stageEls = $$('#growth li');

// ------------------------------------------------------------------ the glass slab, pinned into the scene
const ANCHORS = CHAPTERS.map((c) => new THREE.Vector3(...(Array.isArray(c.ui.anchor) ? c.ui.anchor : [0.2, 6, 0])));
const svg = $('#leaders');
const leader = document.createElementNS(SVGNS, 'g');
const leadPath = document.createElementNS(SVGNS, 'path');
const leadHalo = document.createElementNS(SVGNS, 'circle'); leadHalo.setAttribute('class', 'halo'); leadHalo.setAttribute('r', '7');
const leadPin = document.createElementNS(SVGNS, 'circle'); leadPin.setAttribute('class', 'pin'); leadPin.setAttribute('r', '2.6');
leader.append(leadPath, leadHalo, leadPin);
svg.append(leader);
const slabPos = { x: 0, y: 0, ry: -6, init: false };
const tmpV = new THREE.Vector3();
function placeSlab(settle) {
  const panel = active >= 0 ? panels[active] : null;
  const slab = panel?.querySelector('.slab');
  if (!slab || innerWidth <= 760) { leader.style.opacity = '0'; return; }
  const mode = CHAPTERS[active].ui.slab;
  const W = innerWidth, H = innerHeight;
  const sw = slab.offsetWidth, sh = slab.offsetHeight;
  const v = tmpV.copy(ANCHORS[active]).project(world.camera);
  const ax = (v.x * 0.5 + 0.5) * W, ay = (-v.y * 0.5 + 0.5) * H;
  const visible = v.z < 1 && ax > -20 && ax < W + 20 && ay > -20 && ay < H + 20;
  let tx, ty;
  if (mode === 'dock') {
    tx = Math.max(W * 0.36, W - sw - 190); ty = H - sh - 30;
  } else if (mode === 'grid') {
    tx = W - sw - Math.max(64, W * 0.06); ty = Math.min(H - sh - 180, Math.max(110, H * 0.5 - sh * 0.5));
  } else {
    // right column, beside the anchor's height, clear of the bar and the navigator
    tx = W - sw - Math.max(64, W * 0.06);
    ty = Math.min(H - sh - 190, Math.max(92, (visible ? ay : H * 0.45) - sh * 0.45));
  }
  if (!slabPos.init) { slabPos.x = tx; slabPos.y = ty; slabPos.init = true; }
  // a little lag so the slab feels carried by the scene
  // while moving the slab is carried by the scene; once the shot rests it holds
  // still against the camera's breathing (a close anchor would otherwise drift)
  const hold = settle > 0.98 ? 10 : 0.6;
  if (Math.abs(tx - slabPos.x) > hold) slabPos.x += (tx - slabPos.x) * 0.14;
  if (Math.abs(ty - slabPos.y) > hold) slabPos.y += (ty - slabPos.y) * 0.14;
  const ry = mode === 'dock' ? 0 : -4 - 6 * ((slabPos.x + sw / 2) / W - 0.5) + (visible ? (ax - slabPos.x) / W * 6 : 0);
  if (Math.abs(ry - slabPos.ry) > (settle > 0.98 ? 1.2 : 0.08)) slabPos.ry += (ry - slabPos.ry) * 0.1;
  // write whole pixels and tenths of a degree only when they change, so the
  // slab settles completely once the camera rests (links must hold still)
  const sxS = Math.round(slabPos.x) + 'px', syS = Math.round(slabPos.y) + 'px', ryS = slabPos.ry.toFixed(1) + 'deg';
  if (slab.dataset.at !== sxS + syS + ryS) {
    slab.dataset.at = sxS + syS + ryS;
    slab.style.setProperty('--sx', sxS);
    slab.style.setProperty('--sy', syS);
    slab.style.setProperty('--ry', ryS);
    slab.style.setProperty('--rx', mode === 'dock' ? '0deg' : '2deg');
  }
  leader.style.opacity = visible ? String(settle * 0.95) : '0';
  if (!visible) return;
  const sx = mode === 'dock' ? slabPos.x + sw * 0.2 : slabPos.x, sy = mode === 'dock' ? slabPos.y : slabPos.y + Math.min(sh * 0.3, 80);
  const mx = (sx + ax) / 2;
  leadPath.setAttribute('d', mode === 'dock'
    ? `M${sx.toFixed(1)},${sy.toFixed(1)} C${sx.toFixed(1)},${(sy - 60).toFixed(1)} ${ax.toFixed(1)},${(ay + 60).toFixed(1)} ${ax.toFixed(1)},${ay.toFixed(1)}`
    : `M${sx.toFixed(1)},${sy.toFixed(1)} C${(mx).toFixed(1)},${sy.toFixed(1)} ${(mx).toFixed(1)},${ay.toFixed(1)} ${ax.toFixed(1)},${ay.toFixed(1)}`);
  for (const c of [leadHalo, leadPin]) { c.setAttribute('cx', ax.toFixed(1)); c.setAttribute('cy', ay.toFixed(1)); }
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
for (const a of $$('.panel .entries a')) {
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

// The details shot looks closely at a real cluster of new leaves, half open,
// from just below and outside the crown: the sun stands high behind them, so
// the light comes through the blades and the deeper crown melts into bokeh.
const STUDY = 2;
const STUDY_RANK = 5;   // art-directed for the locked tree (seed 2611); preview others with ?study=k
function aimStudy() {
  const ros = world.rosettes, st = world.stride;
  const ranked = [];
  for (let i = 0; i < ros.length; i += st) {
    const x = ros[i], y = ros[i + 1], z = ros[i + 2], tE = ros[i + 9];
    const r = Math.hypot(x - AXIS.x, z - AXIS.z);
    if (y < 4.6 || y > 7.4 || r < 8.5 || r > 12.5 || tE < 0.29 || tE > 0.37) continue;
    // a quiet side of the tree (away from the long limb), real foliage behind
    const th = Math.atan2(x - AXIS.x, z - AXIS.z);
    const s = -Math.abs(Math.atan2(Math.sin(th - 1.2), Math.cos(th - 1.2))) * 1.5 - Math.abs(y - 5.8) * 0.5
      - Math.abs(tE - 0.33) * 10 - ros[i + 8] * 2.5 + r * 0.2;
    ranked.push([s, i]);
  }
  if (!ranked.length) return;
  ranked.sort((a, b) => b[0] - a[0]);
  // the chosen cluster (art-directed rank; ?study=k previews others)
  const best = ranked[Math.min(ranked.length - 1, +(params.get('study') ?? STUDY_RANK))][1];
  const P = new THREE.Vector3(ros[best], ros[best + 1] + 0.05, ros[best + 2]);
  const out = new THREE.Vector3(P.x - AXIS.x, 0, P.z - AXIS.z).normalize();
  const side = new THREE.Vector3(-out.z, 0, out.x);
  const eye = P.clone().addScaledVector(out, 1.15).addScaledVector(side, 0.32).add(new THREE.Vector3(0, -0.55, 0));
  const look = P.clone().addScaledVector(out, -0.05);
  const view = look.clone().sub(eye).normalize();
  retarget(STUDY, eye.toArray(), look.toArray(), 27);
  // the sun high over the outside of the crown: it lights the blades from above,
  // and from below we see that light come through them
  LIGHT[STUDY].sun = [THREE.MathUtils.radToDeg(Math.atan2(out.x, out.z)) + 50, 56];
  ANCHORS[STUDY].copy(P);
  buildOrbitRefresh();
}
function buildOrbitRefresh() { buildOrbit(); orbitDots = $$('#orbitDots .dot'); }

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
    if (!leafVisible(ros[i + 9], ros[i + 10], g)) continue;   // nothing there yet
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
  const yaw = THREE.MathUtils.degToRad(L.sunAz);
  const el = THREE.MathUtils.degToRad(L.sunEl);
  sunDir.set(Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el));
  world.setStage({ grow, sunDir, sunCol: C(L.sunCol), sunI: L.I, zenith: C(L.zenith), horizon: C(L.horizon), glow: C(L.glow),
    fog: C(L.fog), density: L.density, mist: L.mist, rays: L.rays, exposure: L.exposure, warm: L.warm, cloud: L.cloud, sat: L.sat, contrast: L.contrast,
    aperture: L.aperture, focus: L.focus > 0.1 ? L.focus : (rail.dist || Math.hypot(rail.lx - rail.ex, rail.ly - rail.ey, rail.lz - rail.ez)) });
  const gust = 0.5 + 0.3 * Math.sin(t * 0.13) + 0.2 * Math.sin(t * 0.047 + 1.3) * Math.sin(t * 0.31);
  UNIFORMS.uGust.value = Math.max(0, Math.min(1, gust));
  UNIFORMS.uWind.value = reduceMotion ? 0.05 : 0.22 + 0.18 * grow;
  cam.update(dt, wallDt);
  world.camera.updateMatrixWorld();
  dwell += cam.idleSeconds() > 2 ? dt : dt * 0.4;
  world.litter.update(dt, grow, UNIFORMS.uWind.value * UNIFORMS.uGust.value, UNIFORMS.uWindDir.value, dwell, active === N - 1);
  sound.update(UNIFORMS.uWind.value * (0.5 + UNIFORMS.uGust.value), { fallen: 1 - grow }, haikouParts(Date.now()), { altitude: el });
  updateNav(p, grow);
  placeSlab(1 - Math.min(1, Math.abs(p - near) * 4));
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
  go: (i) => { override = null; goTo(i, true); state.p = i; cam?.snap(); setActive(i); if (world) world.litter.falling.length = 0; },
  seek: (p) => { override = null; state.p = p; cam?.snap(); if (world) world.litter.falling.length = 0; },
  still: (seconds = 1, fps = 30) => { paused = true; for (let i = 0; i < Math.round(seconds * fps); i++) step(1 / fps); },
  lookdev: (eye, look, p, fov = 40) => { override = { ex: eye[0], ey: eye[1], ez: eye[2], lx: look[0], ly: look[1], lz: look[2], fov, dist: Math.hypot(look[0] - eye[0], look[1] - eye[1], look[2] - eye[2]) }; state.p = p; cam.snap(); },
  info: () => ({ active, p: state.p, grow: UNIFORMS.uGrow.value, leaves: world?.canopy.data.count, cam: world && [...world.camera.position.toArray().map((v) => +v.toFixed(2)), +world.camera.fov.toFixed(1), +world.camera.aspect.toFixed(3)],
    falling: world?.litter.falling.length, settled: world?.litter.settled.length, tier: document.documentElement.dataset.tier })
};

if ((params.has('capture') || params.has('test')) && window.gsap) window.gsap.ticker.lagSmoothing(0);   // review stills and slow test renderers
requestAnimationFrame(() => body.classList.add('painted'));
setActive(0);
start3D();
