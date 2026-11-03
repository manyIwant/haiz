// haiz.space homepage — one tree, six stops.
// Scroll walks around and up the tree; each stop opens one part of HAIZ.
import * as THREE from 'three';
import { CHAPTERS, poseAt, aimFor } from './chapters.js';
import { DwellCamera } from './camera.js';
import { sunPosition, sunVector, haikouParts, haikouToMs, formatClock, partOfDay, monthDayOf } from './sun.js';
import { seasonAt } from './season.js';
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

// ------------------------------------------------------------------ clock
// "live" follows the real clock in Haikou; dragging the rulers enters "recall".
const clock = {
  mode: 'live', doy: null, min: null,
  now() {
    if (this.mode === 'live') return Date.now();
    const p = haikouParts(Date.now());
    return haikouToMs(p.year, this.doy ?? p.dayOfYear, this.min ?? p.minutes);
  }
};
const forced = params.get('t');   // review links: ?t=2027-01-18T16:20 (Haikou time)
if (forced) setRecall(forced);
function setRecall(iso) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/);
  if (!m) return;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 15), +(m[5] || 0)) - 8 * 3600000;
  const p = haikouParts(ms);
  clock.mode = 'recall'; clock.doy = p.dayOfYear; clock.min = p.minutes;
}

// ------------------------------------------------------------------ chapters (work without WebGL)
const sections = $$('.chapter');
const spineLinks = $$('#spine [data-go]');
const rail = { p: 0, target: 0, lastInput: 0, from: 0 };
const startHash = location.hash.slice(1);
const fromHash = CHAPTERS.findIndex((c) => c.id === startHash);
let saved = null;
try { saved = JSON.parse(sessionStorage.getItem('haiz.home') || 'null'); } catch { /* storage blocked */ }
if (fromHash >= 0) rail.p = rail.target = fromHash;
else if (saved && Date.now() - saved.t < 30 * 60000) rail.p = rail.target = saved.c;   // came back from a page

let active = -1;
function setActive(i) {
  if (i === active) return;
  active = i;
  sections.forEach((s, k) => {
    s.classList.toggle('is-active', k === i);
    s.toggleAttribute('inert', k !== i && body.classList.contains('spatial'));
  });
  spineLinks.forEach((a, k) => a.toggleAttribute('aria-current', false) || (k === i && a.setAttribute('aria-current', 'step')));
  body.dataset.chapter = i < 0 ? '' : String(i);
  if (i >= 0) {
    try { sessionStorage.setItem('haiz.home', JSON.stringify({ c: i, t: Date.now() })); } catch { /* ignore */ }
    const id = CHAPTERS[i].id;
    if (location.hash.slice(1) !== id) history.replaceState(null, '', i === 0 ? location.pathname + location.search : '#' + id);
  }
}
function go(i) {
  rail.target = Math.max(0, Math.min(N - 1, i));
  rail.from = rail.target;
  rail.lastInput = performance.now();
  body.classList.add('walked');
  cam?.releaseLook();
}
for (const a of $$('[data-go]')) {
  a.addEventListener('click', (e) => {
    if (!body.classList.contains('spatial')) return;   // static page: normal anchors
    e.preventDefault();
    go(+a.dataset.go);
  });
}
// focusing a link of another stop (keyboard) walks there
for (const s of sections) s.addEventListener('focusin', () => { if (body.classList.contains('spatial')) go(+s.dataset.i); });

// ------------------------------------------------------------------ input → rail
let wheelAcc = 0;
function onScrollDelta(px, stamp = performance.now()) {
  // a new gesture remembers where it started, so a small deliberate scroll
  // still carries you on to the next stop instead of springing back.
  // Input time (not handling time) separates gestures, so a slow frame does
  // not split one flick into several.
  if (stamp - rail.lastInput > 650) rail.from = Math.round(rail.target);
  rail.target = Math.max(0, Math.min(N - 1, rail.target + px * 0.0011));
  rail.lastInput = Math.max(rail.lastInput, stamp);
  wheelAcc += Math.abs(px);
  if (wheelAcc > 120) body.classList.add('walked');
  cam?.releaseLook();
}
addEventListener('wheel', (e) => {
  if (!body.classList.contains('spatial') || e.target.closest('dialog')) return;
  e.preventDefault();
  const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
  onScrollDelta(e.deltaY * k, e.timeStamp);
}, { passive: false });
addEventListener('keydown', (e) => {
  if (!body.classList.contains('spatial') || e.target.closest('input,textarea,dialog')) return;
  const nxt = { ArrowDown: 1, PageDown: 1, ' ': 1, ArrowUp: -1, PageUp: -1 }[e.key];
  if (nxt) { e.preventDefault(); go(Math.round(rail.target) + nxt); }
  if (e.key === 'Home') go(0);
  if (e.key === 'End') go(N - 1);
});

// ------------------------------------------------------------------ static helpers
const visits = new Visits();
const specimens = new Specimens(visits, (n) => { $('#bookCount').textContent = String(n); });
const sound = new Soundscape();
$('#bookButton').addEventListener('click', () => specimens.openBook());
$('[data-action="book"]')?.addEventListener('click', () => specimens.openBook());
$('#searchButton').addEventListener('click', () => $('#exploreOpen')?.click());
$('#soundButton').addEventListener('click', async () => {
  const on = await sound.toggle();
  $('#soundButton').setAttribute('aria-pressed', String(on));
});
function whisper(text, ms = 6500) {
  const w = $('#whisper');
  w.textContent = text;
  w.classList.add('show');
  setTimeout(() => w.classList.remove('show'), ms);
}

// ------------------------------------------------------------------ time
let season = null, parts = null, sunInfo = null, lastDoy = -1, lastSunMs = 0;
let world = null, cam = null;
function updateTime(force = false) {
  const ms = clock.now();
  parts = haikouParts(ms);
  const doy = parts.dayOfYear + parts.minutes / 1440;
  if (force || Math.abs(doy - lastDoy) > 0.02) {
    const prev = lastDoy;
    season = seasonAt(doy, parts.yearDays);
    if (world) {
      world.setSeason(season);
      if (force || Math.abs(doy - prev) > 1) world.litter.seedGround(season, parts.minutes);
    }
    lastDoy = doy;
  }
  if (force || Math.abs(ms - lastSunMs) > 20000 || clock.mode !== 'live') {
    sunInfo = sunPosition(ms);
    if (world) { world.setSun(sunVector(sunInfo.altitude, sunInfo.bearing), sunInfo.altitude); world.setStudyLights(parts); }
    lastSunMs = ms;
  }
  const altDeg = sunInfo.altitude * 180 / Math.PI;
  $('#date').textContent = `${parts.month} 月 ${parts.day} 日`;
  $('#clock').textContent = `${partOfDay(parts.minutes, altDeg)} ${formatClock(parts.minutes)}`;
  $('#phase').textContent = season.label;
  body.dataset.mode = clock.mode;
  $('#nowButton').hidden = clock.mode === 'live';
  const dr = $('#dayRange'), yr = $('#yearRange');
  if (document.activeElement !== dr) dr.value = Math.round(parts.minutes);
  if (document.activeElement !== yr) yr.value = parts.dayOfYear;
  $('#dayOut').textContent = `${partOfDay(parts.minutes, altDeg)} ${formatClock(parts.minutes)}`;
  const md = monthDayOf(parts.dayOfYear);
  $('#yearOut').textContent = `${md.month} 月 ${md.day} 日`;
}
function toRecall() {
  if (clock.mode === 'live') { const p = haikouParts(Date.now()); clock.doy = p.dayOfYear; clock.min = p.minutes; }
  clock.mode = 'recall';
}
$('#dayRange').addEventListener('input', (e) => { toRecall(); clock.min = +e.target.value; updateTime(true); });
$('#yearRange').addEventListener('input', (e) => { toRecall(); clock.doy = +e.target.value; updateTime(true); });
$('#nowButton').addEventListener('click', () => { clock.mode = 'live'; updateTime(true); });
updateTime(true);

// ------------------------------------------------------------------ leaving: dolly + veil
let ANCHORS = CHAPTERS.map((c) => c.entries.map(() => new THREE.Vector3(3, 4, 0)));
const anchorsOf = (i) => ANCHORS[i];
// pin every entry onto what is actually in the picture at its stop
function computeAnchors() {
  const probe = world.camera.clone();
  const rc = new THREE.Raycaster();
  const solids = [world.bark, ...world.stones, ...world.building.group.children, world.ground].filter(Boolean);
  const ros = world.rosettes, st = world.stride;
  const v = new THREE.Vector3();
  ANCHORS = CHAPTERS.map((c) => {
    DwellCamera.place(probe, c.pose);
    return c.entries.map((e, k) => {
      const [x, y] = e.aim || aimFor(k, c.entries.length);
      rc.setFromCamera(new THREE.Vector2(x, y), probe);
      const hits = rc.intersectObjects(solids, false);
      let best = hits.length ? hits[0].distance : 60;
      let point = hits.length ? hits[0].point.clone() : rc.ray.at(best, new THREE.Vector3());
      for (let i = 0; i < ros.length; i += st) {
        v.set(ros[i], ros[i + 1], ros[i + 2]);
        if (rc.ray.distanceSqToPoint(v) < 0.09) {
          const d = v.distanceTo(rc.ray.origin);
          if (d < best) { best = d; point = v.clone(); }
        }
      }
      return point;
    });
  });
}
function leave(a, anchor) {
  const href = a.getAttribute('href');
  const r = a.getBoundingClientRect();
  let vx = r.left + r.width / 2, vy = r.top + r.height / 2;
  if (world && anchor) {
    const v = anchor.clone().project(world.camera);
    if (v.z < 1) { vx = (v.x * 0.5 + 0.5) * innerWidth; vy = (-v.y * 0.5 + 0.5) * innerHeight; }
    cam.push = { point: anchor.clone(), t: 0, d: 0.95 };
  }
  const veil = $('#veil');
  veil.style.setProperty('--vx', vx + 'px');
  veil.style.setProperty('--vy', vy + 'px');
  veil.style.setProperty('--veil', a.hasAttribute('data-dark') ? '#0b1310' : '#f7f3eb');
  body.classList.add('leaving');
  setTimeout(() => { location.href = href; }, reduceMotion ? 0 : 900);
}
addEventListener('pageshow', (e) => {
  if (e.persisted) { body.classList.remove('leaving'); if (cam) cam.push = null; }
});
for (const s of sections) {
  const i = +s.dataset.i;
  $$('.entries a', s).forEach((a) => {
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || !body.classList.contains('spatial')) return;
      e.preventDefault();
      const k = +a.dataset.anchor;
      leave(a, anchorsOf(i)[k]);
    });
  });
}

// ------------------------------------------------------------------ 3D
async function start3D() {
  const canvas = $('#world');
  const ok = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();
  const save = navigator.connection?.saveData;
  if (!ok || save || params.has('static')) { goStatic(); return; }
  body.classList.add('spatial');
  setActive(Math.round(rail.p));
  const { buildScene, pickTier } = await import('./scene.js');
  const tierName = pickTier();
  document.documentElement.dataset.tier = tierName;
  try {
    world = await buildScene(canvas, tierName);
  } catch (err) {
    console.error(err);
    goStatic();
    return;
  }
  world.resize();
  addEventListener('resize', () => world.resize());
  cam = new DwellCamera(world.camera, canvas);
  cam.rail = () => poseAt(rail.p);
  cam.snap();
  cam.onScroll = onScrollDelta;
  updateTime(true);
  computeAnchors();
  wireTree();
  loop();
  body.classList.add('ready');
  visits.arrive(parts, season);
  const g = visits.greeting(parts, season);
  if (g) setTimeout(() => whisper(g), 2600);
}

function goStatic() {
  body.classList.remove('spatial');
  body.classList.add('static');
  sections.forEach((s) => { s.classList.add('is-active'); s.removeAttribute('inert'); });
}

// ------------------------------------------------------------------ the tree answers
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
  const ros = world.rosettes, st = world.stride;
  let n = 0, nearest = null, nd = 1e9;
  const p = new THREE.Vector3();
  for (let i = 0; i < ros.length; i += st) {
    p.set(ros[i], ros[i + 1], ros[i + 2]);
    if (r.distanceSqToPoint(p) < radius * radius) {
      n++;
      const along = p.clone().sub(r.origin).dot(r.direction);
      if (along > 0 && along < nd) { nd = along; nearest = p.clone(); }
    }
  }
  return { n, nearest };
}
function brush(origin, dir, strength) {
  const t = UNIFORMS.uTime.value;
  if (t - lastBrush < 0.09) return;
  lastBrush = t;
  const i = touchIdx++ % UNIFORMS.uTouchO.value.length;
  UNIFORMS.uTouchO.value[i].set(origin.x, origin.y, origin.z, t);
  UNIFORMS.uTouchD.value[i].set(dir.x, dir.y, dir.z, strength);
}
function brushAt(point, strength = 1.2) {
  const o = world.camera.position;
  const d = point.clone().sub(o).normalize();
  brush(o, d, strength);
}

function wireTree() {
  const canvas = world.renderer.domElement;
  cam.onHover = (e) => {
    if (e.pointerType === 'touch') return;
    const r = pointerRay(e);
    const hit = rosetteHits(r);
    if (hit.n > 0) { brush(r.origin, r.direction, Math.min(1.2, 0.35 + hit.n * 0.12)); sound.rustle(Math.min(1, hit.n / 6)); }
    canvas.style.cursor = world.litter.pick(r) ? 'pointer' : hit.n ? 'grab' : '';
  };
  cam.onTap = (e) => {
    const r = pointerRay(e);
    const fl = world.litter.pick(r, e.pointerType === 'touch' ? 0.9 : 0.6);
    if (fl) {
      world.litter.falling.splice(world.litter.falling.indexOf(fl), 1);
      sound.catch();
      visits.markSeen('caught');
      specimens.open({ age: fl.age, variant: fl.variant, len: fl.len, from: 'air' }, parts, season, sunInfo);
      return;
    }
    const hit = rosetteHits(r, 0.6);
    if (hit.n > 0) {
      brush(r.origin, r.direction, Math.min(2.2, 1.0 + hit.n * 0.2));
      sound.rustle(1);
      if (hit.nearest && Math.random() < 0.18 + season.reddening * 0.7) {
        world.litter.release(hit.nearest, Math.min(1.1, 0.6 + season.reddening * 0.6 + Math.random() * 0.25));
      }
      return;
    }
    const g = world.litter.pickGround(r);
    if (g) specimens.open({ age: g.age, variant: g.variant, len: g.len, from: 'ground' }, parts, season, sunInfo);
  };
  world.litter.onLand = () => sound.land();
  // the gift leaf falls where you can see it
  world.litter.onGift = () => {
    const ros = world.rosettes, st = world.stride, n = ros.length / st;
    const v = new THREE.Vector3();
    for (let tries = 0; tries < 60; tries++) {
      const k = Math.floor(Math.random() * n) * st;
      v.set(ros[k], ros[k + 1], ros[k + 2]);
      const d = v.distanceTo(world.camera.position);
      const s = v.clone().project(world.camera);
      if (d < 16 && s.z < 1 && Math.abs(s.x) < 0.55 && s.y > -0.2 && s.y < 0.85) return world.litter.release(v, null, null, true);
    }
    return world.litter.release(null, null, null, true);
  };
  // hovering an entry stirs the part of the tree it belongs to
  for (const s of sections) {
    const i = +s.dataset.i;
    $$('.entries [data-anchor]', s).forEach((el) => {
      const k = +el.dataset.anchor;
      const on = () => { hot = { i, k }; brushAt(anchorsOf(i)[k], 1.6); sound.rustle(0.6); };
      el.addEventListener('pointerenter', on);
      el.addEventListener('focus', on);
      el.addEventListener('pointerleave', () => { hot = null; });
      el.addEventListener('blur', () => { hot = null; });
    });
  }
}

// ------------------------------------------------------------------ leader lines
let hot = null;
const svg = $('#leaders');
const NS = 'http://www.w3.org/2000/svg';
let leaderFor = -1;
function drawLeaders(alpha) {
  if (innerWidth < 760 || active < 0) { svg.replaceChildren(); leaderFor = -1; return; }
  const sec = sections[active];
  const items = $$('.entries [data-anchor]', sec);
  if (leaderFor !== active) {
    svg.replaceChildren(...items.map(() => {
      const g = document.createElementNS(NS, 'g');
      g.append(document.createElementNS(NS, 'path'), document.createElementNS(NS, 'circle'));
      return g;
    }));
    leaderFor = active;
  }
  const anchors = anchorsOf(active);
  const groups = [...svg.children];
  items.forEach((el, n) => {
    const g = groups[n];
    const a = anchors[+el.dataset.anchor];
    if (!a || !g) return;
    const v = a.clone().project(world.camera);
    const r = el.getBoundingClientRect();
    const sx = r.left + Math.min(r.width, el.scrollWidth) + 26, sy = r.top + r.height * 0.42;
    const ax = (v.x * 0.5 + 0.5) * innerWidth, ay = (-v.y * 0.5 + 0.5) * innerHeight;
    const visible = v.z < 1 && ax > 0 && ax < innerWidth && ay > 0 && ay < innerHeight;
    g.style.opacity = visible ? String(alpha) : '0';
    const mx = sx + (ax - sx) * 0.55;
    g.children[0].setAttribute('d', `M${sx.toFixed(1)},${sy.toFixed(1)} C${mx.toFixed(1)},${sy.toFixed(1)} ${mx.toFixed(1)},${ay.toFixed(1)} ${ax.toFixed(1)},${ay.toFixed(1)}`);
    g.children[1].setAttribute('cx', ax.toFixed(1));
    g.children[1].setAttribute('cy', ay.toFixed(1));
    g.children[1].setAttribute('r', hot && hot.i === active && hot.k === +el.dataset.anchor ? '6' : '3');
    g.classList.toggle('on', !!(hot && hot.i === active && hot.k === +el.dataset.anchor));
  });
}

// ------------------------------------------------------------------ loop
let paused = params.has('capture');
let last = performance.now(), frames = 0, dwell = 0, slowAcc = 0, slowN = 0;
let giftShown = 0;
function step(dt, wallDt = dt) {
  UNIFORMS.uTime.value += dt;
  const t = UNIFORMS.uTime.value;
  // the walk: follow the target; settle on the nearest stop after a pause
  // (uses wall-clock time so a slow GPU still arrives on time)
  if (performance.now() - rail.lastInput > 650 && !cam.dragging) {
    const d = rail.target - rail.from;
    const near = Math.abs(d) < 0.12 ? rail.from : Math.max(0, Math.min(N - 1, rail.from + Math.sign(d) * Math.max(1, Math.round(Math.abs(d)))));
    rail.target += (near - rail.target) * Math.min(1, wallDt * 3.5);
    if (Math.abs(near - rail.target) < 1e-3) { rail.target = near; rail.from = near; }
  }
  rail.p += (rail.target - rail.p) * Math.min(1, wallDt * 2.6);
  if (Math.abs(rail.target - rail.p) < 1e-4) rail.p = rail.target;
  const near = Math.round(rail.p);
  setActive(Math.abs(rail.p - near) < 0.22 ? near : -1);
  // gusts: layered slow oscillations, shared by shader, sound and falling leaves
  const gust = 0.5 + 0.3 * Math.sin(t * 0.13) + 0.2 * Math.sin(t * 0.047 + 1.3) * Math.sin(t * 0.31);
  UNIFORMS.uGust.value = Math.max(0, Math.min(1, gust));
  UNIFORMS.uWind.value = reduceMotion ? 0.05 : 0.32;
  world.sky.material.uniforms.uTimeS.value = t;
  if (clock.mode === 'live' && frames % 120 === 0) updateTime();
  cam.update(dt, wallDt);
  world.camera.updateMatrixWorld();
  dwell += cam.idleSeconds() > 2 ? dt : dt * 0.4;
  world.litter.update(dt, UNIFORMS.uWind.value * UNIFORMS.uGust.value, UNIFORMS.uWindDir.value, season, dwell);
  sound.update(UNIFORMS.uWind.value * (0.5 + UNIFORMS.uGust.value), season, parts, sunInfo);
  // first gifts get a quiet label so people learn they can catch them
  const ch = $('#catchHint');
  const gl = world.litter.falling.find((L) => L.gift);
  if (gl && giftShown < 2 && !visits.d.seen.includes('caught')) {
    const v = gl.p.clone().project(world.camera);
    ch.style.transform = `translate(${((v.x * 0.5 + 0.5) * innerWidth + 16).toFixed(0)}px, ${((-v.y * 0.5 + 0.5) * innerHeight - 8).toFixed(0)}px)`;
    ch.classList.add('show');
    gl._hinted = true;
  } else {
    if (ch.classList.contains('show') && !gl) giftShown++;
    ch.classList.remove('show');
  }
  const settle = 1 - Math.min(1, Math.abs(rail.p - Math.round(rail.p)) * 5);
  drawLeaders(settle);
  body.classList.toggle('still', cam.idleSeconds() > 18 && !specimens.isOpen());
  world.beforeRender();
  world.renderer.render(world.scene, world.camera);
  frames++;
}
function loop() {
  requestAnimationFrame(function frame(now) {
    const wall = Math.min(0.5, (now - last) / 1000);
    const dt = Math.min(0.05, wall);
    last = now;
    if (!document.hidden && !paused) {
      step(dt, wall);
      adapt(dt);
    }
    requestAnimationFrame(frame);
  });
}
// keep the frame rate honest on weaker GPUs: lower resolution before anything else
function adapt(dt) {
  if (frames < 90) return;
  slowAcc += dt; slowN++;
  if (slowN >= 120) {
    const avg = slowAcc / slowN;
    const r = world.renderer.getPixelRatio();
    if (avg > 0.034 && r > 0.75) { world.renderer.setPixelRatio(Math.max(0.75, r * 0.8)); world.resize(); }
    slowAcc = 0; slowN = 0;
  }
}

// review / test hook: deterministic stills without a running loop
window.__haizHome = {
  get world() { return world; }, chapters: CHAPTERS, rail, clock,
  go: (i) => { go(i); rail.p = rail.target = i; cam?.snap(); setActive(i); },
  setTime: (iso) => { setRecall(iso); updateTime(true); },
  still: (seconds = 1, fps = 30) => { paused = true; for (let i = 0; i < Math.round(seconds * fps); i++) step(1 / fps); },
  info: () => ({ season, parts, alt: sunInfo.altitude * 180 / Math.PI, active, p: rail.p,
    leaves: world?.canopy.data.count, falling: world?.litter.falling.length, ground: world?.litter.ground.length,
    tier: document.documentElement.dataset.tier })
};

// paint the first frame of text immediately; the 3D world follows
requestAnimationFrame(() => body.classList.add('painted'));
setActive(Math.round(rail.p));
start3D();
