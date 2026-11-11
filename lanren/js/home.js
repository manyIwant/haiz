// HAIZ homepage — walk around one tree; it grows as you go.
// One scroll progress p ∈ [0, 5] (GSAP ScrollTrigger, scrubbed and snapped to
// the six viewpoints) drives the camera, the tree's growth, the light of the
// day and which part of HAIZ is open.
import * as THREE from 'three';
import { CHAPTERS, LIGHT, STAGES, shot, poseAt, growAt, lightAt, retarget, setPortrait, AXIS } from './chapters.js';
import { DwellCamera } from './camera.js';
import { sunPosition, haikouParts } from './sun.js';
import { UNIFORMS, leafVisible, createHeroLeaves } from './foliage.js';
import { Specimens } from './specimen.js';
import { Soundscape } from './sound.js';
import { Visits } from './visits.js';
import { pickComposition } from '../world/compose.js';
import { createWorldState } from '../world/state.js';
import { BEATS as FILM_STOPS, FILM_SECONDS } from '../world/film.js';
import { createClock } from '../world/clock.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
// the address this page was opened at, read before setActive(0) below rewrites it:
// a #map/<view>/<place> link (or a reload of one) opens chapter 04's campus plan
const entry = { hash: location.hash, state: history.state };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const N = CHAPTERS.length;
const body = document.body;
const panels = $$('.panel');
const stops = $$('.stop');
const state = { p: 0 };
let world = null, cam = null, active = -1;
let map = null;   // chapter 04's campus beneath the water (lanren/map), when it has loaded
// how 05 and 06 meet the campus (?compose=a|b|c, lanren/world/compose.js) and the world they share
const compose = pickComposition(location.search, (() => { try { return sessionStorage; } catch { return null; } })());
// the world's own clock (lanren/world/clock.js): ?clock=1 lights every shot with the real sun of a real
// instant at the campus, keeps the 05 → 06 film in one evening and lets that evening go on while 06 is
// held. Off by default (V4's six art-directed suns); ?clock=0 turns it off again. Remembered for the tab.
const clockOn = (() => {
  let v = params.get('clock');
  try { if (v == null) v = sessionStorage.getItem('haiz.clock'); else sessionStorage.setItem('haiz.clock', v); } catch { /* storage blocked */ }
  return v === '1';
})();
let W = null;     // lanren/world/state.js: owner of camera and input, the campus left standing, the destination
let life = null;  // lanren/world/world.js: the 05 → 06 film, the walker, the pocket map and the menu
let roots = null; // 02's history on the same tree; shares the camera and scroll rail
let canopy = null; // 03's student works tree, enters only on request
let override = null;
let saved = null;
try { saved = JSON.parse(sessionStorage.getItem('haiz.home') || 'null'); } catch { /* storage blocked */ }   // look-dev: a fixed camera frame for reviewing the tree itself

// ------------------------------------------------------------------ scroll → progress
const maxScroll = () => document.documentElement.scrollHeight - innerHeight;
const scrollForStop = (i) => (stops[i] ? stops[i].offsetTop : 0);
// scroll ⇄ p: p = i at stop i, linear in between. With every stop one screen tall this is
// the plain linear mapping; chapter 02 makes its own stop taller to slow the walk there.
// Progress u is ScrollTrigger's own: #track from its top at the top of the screen to its
// bottom at the bottom (the page's footer and panels below do not count).
let knots = null;
const track = document.getElementById('track');
const trackRange = () => Math.max(1, track.offsetHeight - innerHeight);
function measureKnots() {
  const range = trackRange(), top = track.offsetTop;
  knots = stops.map((el, i) => [Math.max(0, Math.min(1, (el.offsetTop - top) / range)), i]);
  knots[0][0] = 0; knots[knots.length - 1][0] = 1;
  return knots;
}
function pFromU(u) {
  const k = knots || measureKnots();
  if (u <= k[0][0]) return 0;
  for (let i = 1; i < k.length; i++) if (u <= k[i][0]) return k[i - 1][1] + (u - k[i - 1][0]) / Math.max(1e-6, k[i][0] - k[i - 1][0]);
  return N - 1;
}
function uFromP(p) {
  const k = knots || measureKnots();
  const i = Math.max(0, Math.min(N - 2, Math.floor(p)));
  return k[i][0] + (p - i) * (k[i + 1][0] - k[i][0]);
}
/** directional snapping that stays put when the scroll already rests on a target
 *  (GSAP's own moves on to the next one, which skips 02's opening at its first station) */
function snapDirectional(pts) {
  return (v, dir) => {
    let i = 0;
    while (i < pts.length - 1 && pts[i + 1] <= v) i++;
    const a = pts[i], b = pts[Math.min(pts.length - 1, i + 1)];
    // resting on a target stays there; any deliberate step off it (one arrow key is ~40 px,
    // a few % of a stop) goes on to the next one in that direction
    if (v - a <= (b - a) * 0.02) return a;
    if (b - v <= (b - a) * 0.02) return b;
    return dir > 0 ? b : a;
  };
}
/** snap targets in scroll progress: the six shots and, inside 02, its stations */
function snapPoints() {
  const ps = new Set(CHAPTERS.map((_, i) => i));
  for (const p of roots?.stations() || []) ps.add(p);
  for (const q of FILM_BEATS) ps.add(4 + q);
  return [...ps].sort((a, b) => a - b).map(uFromP);
}
function goTo(i, instant = false) {
  i = Math.max(0, Math.min(N - 1, i));
  const y = scrollForStop(i);
  if (instant || reduceMotion) { transit = null; override = null; scrollTo(0, y); state.p = i; landWalk(); return; }
  // a distant shot (or the long climb of 02 between here and there) is reached by a direct flight
  // through the same space, not by scrubbing through every station on the way
  const from = transit ? transit.pv : state.p;
  const far = Math.abs(i - from) > 1.01 || Math.abs(y - scrollY) > innerHeight * 2.2;
  const film = from >= 3.99 && i === N - 1;   // 05 → 06 is the walker's film: it plays
  if (far && !film && world && cam && (!W || W.policy().scroll)) { startTransit(i); return; }
  scrollTo({ top: y, behavior: 'smooth' });
}

// ------------------------------------------------------------------ transit: one flight between distant shots
// The scroll lands on the destination at once; the camera flies there on its own path: out round
// the tree (never through the crown), rising with the distance it has to go, looking at the tree's
// heart on the way, while the day's light and the tree's growth pass smoothly from one shot to the
// other. Interrupting it (another choice, a scroll) starts from wherever the camera is.
let transit = null;
const TREE_HEART = { x: AXIS.x, y: 6.6, z: AXIS.z };
let crownProfile = null;   // the crown's farthest reach at each height (rosettes)
function crownReach(y) {
  if (!crownProfile && world) {
    crownProfile = new Float32Array(40);
    const ros = world.rosettes, st = world.stride;
    for (let k = 0; k < ros.length; k += st) {
      const b = Math.max(0, Math.min(39, Math.floor(ros[k + 1] + 2)));
      crownProfile[b] = Math.max(crownProfile[b], Math.hypot(ros[k] - AXIS.x, ros[k + 2] - AXIS.z) + 0.5);
    }
  }
  if (!crownProfile) return 0;
  const b = Math.floor(y + 2);
  let r = 0;
  for (let j = b - 1; j <= b + 1; j++) if (j >= 0 && j < 40) r = Math.max(r, crownProfile[j]);
  return r;
}
function startTransit(i) {
  const a = { ...cam.s };
  const p0 = transit ? transit.pv : state.p;
  cam.releaseLook();
  scrollTo(0, scrollForStop(i)); state.p = i; landWalk();
  const b = life?.rail(i) || railAt(i);
  transit = { t0: performance.now(), dur: (1.3 + 0.2 * Math.min(5, Math.abs(i - p0))) * 1000, a, b, i, p0, pv: p0 };
}
const lerpN = (x, y, t) => x + (y - x) * t;
function transitPose(T, e) {
  const { a, b } = T;
  const tha = Math.atan2(a.ex - AXIS.x, a.ez - AXIS.z), thb = Math.atan2(b.ex - AXIS.x, b.ez - AXIS.z);
  const ra = Math.hypot(a.ex - AXIS.x, a.ez - AXIS.z), rb = Math.hypot(b.ex - AXIS.x, b.ez - AXIS.z);
  let dth = thb - tha;
  while (dth > Math.PI) dth -= 2 * Math.PI;
  while (dth < -Math.PI) dth += 2 * Math.PI;
  const s = Math.sin(Math.PI * e);
  const bulge = Math.max(0, 22 - (ra + rb) / 2) + Math.abs(dth) * 2.4;
  const lift = 2.5 + Math.abs(dth) * 2.2 + Math.max(0, 9 - Math.max(a.ey, b.ey)) * 0.6;
  const th = tha + dth * e, y = lerpN(a.ey, b.ey, e) + lift * s;
  let r = lerpN(ra, rb, e) + bulge * s;
  // the middle of the flight stays outside the crown
  const keep = Math.min(1, Math.max(0, (e - 0.06) / 0.18)) * Math.min(1, Math.max(0, (0.94 - e) / 0.18));
  r = Math.max(r, lerpN(r, crownReach(y) + 1.8, keep));
  const ex = AXIS.x + Math.sin(th) * r, ez = AXIS.z + Math.cos(th) * r;
  // the gaze passes over the tree's heart between the two shots' own targets
  const w = Math.pow(s, 0.7) * 0.82;
  const lx = lerpN(lerpN(a.lx, b.lx, e), TREE_HEART.x, w), ly = lerpN(lerpN(a.ly, b.ly, e), TREE_HEART.y, w), lz = lerpN(lerpN(a.lz, b.lz, e), TREE_HEART.z, w);
  const fov = Math.min(64, Math.max(28, lerpN(a.fov, b.fov, e) + 7 * s));
  return { ex, ey: y, ez, lx, ly, lz, fov, auth: lerpN(a.auth || 0, b.auth || 0, e), dist: Math.hypot(lx - ex, ly - y, lz - ez) };
}
function stepTransit() {
  if (!transit) return;
  const u = Math.min(1, (performance.now() - transit.t0) / transit.dur);
  const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  transit.pv = lerpN(transit.p0, transit.i, u * u * (3 - 2 * u));
  override = transitPose(transit, e);
  if (u >= 1) { transit = null; override = null; }
}
// One scroll mapping for both the lengthened 02 history and the 05→06 film.
const FILM_BEATS = FILM_STOPS.slice(1, -1);   // film.js BEATS: over the shoulder, one's own feet, landed and looked round, the shadow noticed
const pOfProgress = pFromU, progressOfP = uFromP;
// ------------------------------------------------------------------ 05 → 06 at a person's pace
// The scroll's progress through the film is proportional to the film's own clock (film.js DURATION). A scroll
// snap would cross from one resting beat to the next in at most a second and a half (the whole walk in one
// lurch); instead, once the visitor stops scrolling between two beats, the film plays on to the next beat in
// the direction they were going, at the pace it takes to watch it (rewinding goes faster). Any wheel, touch
// or key takes over at once; reduced motion keeps plain scrolling.
const inFilm = (p) => p > 4.0005 && p < 4.9995;
const filmPlay = { on: null, lastInput: 0, dir: 1, self: false, lastY: 0 };
const scrollOfP = (p) => track.offsetTop + uFromP(p) * trackRange();
for (const ev of ['wheel', 'touchstart', 'touchmove', 'keydown', 'pointerdown']) {
  addEventListener(ev, (e) => {
    filmPlay.lastInput = performance.now(); filmPlay.on = null;
    if (ev === 'wheel' && e.deltaY) filmPlay.dir = e.deltaY > 0 ? 1 : -1;
    if (ev === 'keydown') { if (['ArrowDown', 'PageDown', ' ', 'End'].includes(e.key)) filmPlay.dir = 1; else if (['ArrowUp', 'PageUp', 'Home'].includes(e.key)) filmPlay.dir = -1; }
  }, { passive: true, capture: true });
}
addEventListener('scroll', () => {
  if (filmPlay.self) { filmPlay.self = false; filmPlay.lastY = scrollY; return; }
  if (Math.abs(scrollY - filmPlay.lastY) > 0.5) filmPlay.dir = scrollY > filmPlay.lastY ? 1 : -1;
  filmPlay.lastY = scrollY; filmPlay.lastInput = performance.now();
}, { passive: true });
function filmOn(dt) {
  if (reduceMotion || filmPlay.frozen || transit || !W || W.owner !== 'scroll' || !body.classList.contains('spatial') || !inFilm(state.p)) { filmPlay.on = null; return; }
  const now = performance.now();
  if (!filmPlay.on) {
    if (now - filmPlay.lastInput < 300) return;
    const q = (scrollY - scrollOfP(4)) / Math.max(1, scrollOfP(5) - scrollOfP(4));
    if (FILM_STOPS.some((b) => Math.abs(b - q) < 0.002)) return;          // resting on a beat: the visitor decides
    const target = filmPlay.dir > 0 ? FILM_STOPS.find((b) => b > q + 0.002) : [...FILM_STOPS].reverse().find((b) => b < q - 0.002);
    if (target == null) return;
    filmPlay.on = { q, target, dir: filmPlay.dir };
  }
  const f = filmPlay.on;
  f.q += (f.dir * (f.dir > 0 ? 1 : 2.4) * Math.min(0.1, dt)) / FILM_SECONDS;
  if ((f.dir > 0 && f.q >= f.target) || (f.dir < 0 && f.q <= f.target)) { f.q = f.target; filmPlay.on = null; }
  filmPlay.self = true;
  scrollTo(0, scrollOfP(4 + f.q));
}
let walkTween = null;
function landWalk() {
  const st = walkTween?.scrollTrigger;
  if (!st) return;
  window.ScrollTrigger.update(); // static update reads the current native scroll offset
  const scrub = st.getTween?.();
  if (scrub && typeof scrub.progress === 'function') scrub.progress(1);
  walkTween.progress(st.progress);
}
function wireScroll() {
  const gsap = window.gsap, ST = window.ScrollTrigger;
  if (gsap && ST) {
    gsap.registerPlugin(ST);
    const mm = gsap.matchMedia();
    mm.add({ calm: '(prefers-reduced-motion: reduce)', full: '(prefers-reduced-motion: no-preference)' }, (ctx) => {
      const calm = ctx.conditions.calm;
      const walk = { u: 0 };
      const settle = () => {
        const p = pFromU(walk.u), nearest = Math.round(p);
        state.p = Math.abs(p - nearest) < 1e-5 ? nearest : p;
      };
      let snapper = snapDirectional(snapPoints());
      const refreshInit = () => measureKnots();
      const refresh = () => {
        measureKnots();
        snapper = snapDirectional(snapPoints());
        landWalk();
        settle();
      };
      ST.addEventListener('refreshInit', refreshInit);
      ST.addEventListener('refresh', refresh);
      let observer;
      if (window.ResizeObserver) {
        let height = track.offsetHeight, queued = false;
        observer = new ResizeObserver(() => {
          if (queued || height === track.offsetHeight) return;
          queued = true;
          requestAnimationFrame(() => { queued = false; height = track.offsetHeight; ST.refresh(); });
        });
        observer.observe(track);
      }
      measureKnots();
      walkTween = gsap.to(walk, {
        u: 1, ease: 'none', onUpdate: settle,
        scrollTrigger: {
          trigger: '#track', start: 'top top', end: 'bottom bottom',
          scrub: calm ? true : 1.15,
          // (inside 05 → 06 the film is not snapped: it plays on to its next resting beat at its own pace, filmOn below)
          snap: { snapTo: (v, self) => (W && !W.policy().scroll ? v : inFilm(pFromU(v)) ? v : snapper(v, self?.direction || 1)),
            inertia: false, duration: calm ? 0 : { min: 0.55, max: 1.5 },
            delay: 0.1, ease: 'power2.inOut' }
        }
      });
      return () => {
        ST.removeEventListener('refreshInit', refreshInit);
        ST.removeEventListener('refresh', refresh);
        observer?.disconnect();
      };
    });
  } else {
    let target = 0;
    addEventListener('scroll', () => { target = pFromU((scrollY - track.offsetTop) / trackRange()); }, { passive: true });
    addEventListener('resize', measureKnots);
    if (window.ResizeObserver) new ResizeObserver(() => measureKnots()).observe(track);
    let tf = performance.now();
    (function follow(now = performance.now()) { const dt = Math.min(0.1, (now - tf) / 1000); tf = now; state.p += (target - state.p) * (1 - Math.exp(-7.7 * dt)); requestAnimationFrame(follow); })();
  }
}
for (const a of $$('[data-go]')) a.addEventListener('click', (e) => { if (!body.classList.contains('spatial')) return; e.preventDefault(); goTo(+a.dataset.go); });
for (const a of $$('.begin a')) a.addEventListener('click', (e) => { if (!body.classList.contains('spatial')) return; e.preventDefault(); goTo(1); });
for (const p of panels) p.addEventListener('focusin', () => { const i = +p.dataset.i; if (body.classList.contains('spatial') && i !== active) goTo(i); });

// ------------------------------------------------------------------ panels (GSAP reveals)
let panelTl = null;
const SOFT = '.chap-label, .lede, .zh, .specimen-label, .begin, .note-intro';
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
    slabPos.init = false; slabPos.rest = 0;
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

/** where the walk puts the camera at p: V4's six shots, and chapter 02's own climb between 02 and 03 */
function railAt(p) { return roots?.pose(p) || poseAt(p); }

// ------------------------------------------------------------------ helpers & static UI
const visits = new Visits();
const specimens = new Specimens(visits, (n) => { $('#bookCount').textContent = String(n); });
const sound = new Soundscape();
$('#bookButton').addEventListener('click', () => specimens.openBook());
$('#searchButton').addEventListener('click', () => $('#exploreOpen')?.click());
for (const b of $$('[data-action="book"]')) b.addEventListener('click', () => specimens.openBook());
for (const b of $$('[data-action="search"]')) b.addEventListener('click', () => $('#exploreOpen')?.click());
// chapter 02: climb to the first year, or read every year without the film (static: the list in the panel)
for (const b of $$('[data-action="roots-climb"]')) b.addEventListener('click', () => (roots ? roots.api.goStation(1) : $('.roots-static')?.scrollIntoView({ behavior: 'smooth' })));
for (const b of $$('[data-action="roots-read"]')) b.addEventListener('click', () => (roots ? roots.api.open(null) : $('.roots-static')?.scrollIntoView({ behavior: 'smooth' })));
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
    const q = railAt((k / 250) * (N - 1));
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
const slabPos = { x: 0, y: 0, ry: -6, init: false, rest: 0 };
const tmpV = new THREE.Vector3();
function placeSlab(settle, dt = 1 / 60) {
  const panel = active >= 0 ? panels[active] : null;
  const slab = panel?.querySelector('.slab');
  if (!slab || innerWidth <= 760) { leader.style.opacity = '0'; return; }
  // once the shot has rested a moment, the slab is frozen until the camera moves again
  if (settle > 0.995 && slabPos.init) { if (++slabPos.rest > 20) return; } else slabPos.rest = 0;
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
  const kp = 1 - Math.exp(-9 * Math.min(0.1, dt)), kr = 1 - Math.exp(-6.3 * Math.min(0.1, dt));   // the same lag at any frame rate
  if (Math.abs(tx - slabPos.x) > hold) slabPos.x += (tx - slabPos.x) * kp;
  if (Math.abs(ty - slabPos.y) > hold) slabPos.y += (ty - slabPos.y) * kp;
  const ry = mode === 'dock' ? 0 : -4 - 6 * ((slabPos.x + sw / 2) / W - 0.5) + (visible ? (ax - slabPos.x) / W * 6 : 0);
  if (Math.abs(ry - slabPos.ry) > (settle > 0.98 ? 1.2 : 0.08)) slabPos.ry += (ry - slabPos.ry) * kr;
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

// ------------------------------------------------------------------ leaving: through the tree into a page
// Every section leaves through its own moment of the tree (see chapters.js ui.exit):
// shade: sink into the shade at the trunk's foot, the dark page rises from the ground
// leaf:  a leaf-shaped sheet of paper opens from the blade the shot looks at
// map:   rise overhead; the crown's real outline is drawn as contours on paper
// light: push through the gap in the leaves towards the sun; the light becomes the page
// pull:  step back across the water, then the page settles in
const LEAF_MASK = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 160"><path d="M50 158 C47 140 44 132 34 118 C14 92 4 70 6 46 C8 18 28 2 50 2 C72 2 92 18 94 46 C96 70 86 92 66 118 C56 132 53 140 50 158Z" fill="#000"/></svg>');
let crownOutline = null;
const exitLight = { boost: 1 };   // the light exit brightens the scene towards the page
function crownContours() {
  // the tree's real top-down outline: farthest rosette per bearing, smoothed
  if (crownOutline || !world) return crownOutline;
  const ros = world.rosettes, st = world.stride, B = 72, far = new Float32Array(B);
  for (let i = 0; i < ros.length; i += st) {
    const dx = ros[i] - AXIS.x, dz = ros[i + 2] - AXIS.z;
    const b = Math.floor(((Math.atan2(dz, dx) + Math.PI) / (2 * Math.PI)) * B) % B;
    far[b] = Math.max(far[b], Math.hypot(dx, dz));
  }
  const sm = [...far].map((_, b) => (far[(b + B - 1) % B] + 2 * far[b] + far[(b + 1) % B]) / 4);
  const R = Math.max(...sm) || 1;
  crownOutline = [1, 0.74, 0.5, 0.28].map((k, j) => {
    let d = '';
    for (let b = 0; b <= B; b++) {
      const a = (b / B) * Math.PI * 2 - Math.PI, r = (sm[b % B] / R) * k * (1 + 0.03 * Math.sin(b * 0.9 + j * 2));
      d += (b ? 'L' : 'M') + (Math.cos(a) * r * 40).toFixed(2) + ',' + (Math.sin(a) * r * 40).toFixed(2);
    }
    return d + 'Z';
  });
  return crownOutline;
}
function leave(href, dark, x, y, anchor) {
  const kind = active >= 0 ? CHAPTERS[active].ui.exit || 'leaf' : 'leaf';
  const W = innerWidth, H = innerHeight, colour = dark ? '#0b1310' : '#f7f3eb';
  // where the move is aimed: the scene's own anchor, projected to the screen
  let ax = x, ay = y;
  if (world && anchor) {
    // shade sinks to the trunk's foot; map rises over the crown's centre, so the crown
    // ends where its contours are drawn (centre of the screen, north up)
    const point = kind === 'shade' ? new THREE.Vector3(0.1, 0.6, 0) : kind === 'map' ? new THREE.Vector3(AXIS.x, 9.9, AXIS.z) : anchor.clone();
    cam.push = { kind, point, t: 0, d: kind === 'pull' ? 1.5 : 1.2 };
    const v = anchor.clone().project(world.camera);
    if (v.z < 1) { ax = (v.x * 0.5 + 0.5) * W; ay = (-v.y * 0.5 + 0.5) * H; }
  }
  const veil = $('#veil');
  veil.style.setProperty('--veil', colour);
  veil.replaceChildren();
  const g = window.gsap;
  const go = () => { location.href = href; };
  if (!g || reduceMotion) return go();
  if (kind === 'shade') {
    g.fromTo(veil, { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', duration: 1.15, delay: 0.3, ease: 'power2.in', onComplete: go });
  } else if (kind === 'map') {
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '-50 -50 100 100');
    svg.setAttribute('class', 'veil-map');
    for (const d of crownContours() || []) {
      const p = document.createElementNS(SVGNS, 'path');
      p.setAttribute('d', d);
      svg.append(p);
    }
    veil.append(svg);
    veil.style.clipPath = 'none';
    // the paper comes up slowly, so the contours are drawn over the fading crown
    g.fromTo(veil, { opacity: 0 }, { opacity: 1, duration: 1.35, delay: 0.4, ease: 'power1.inOut' });
    g.fromTo(svg.querySelectorAll('path'), { strokeDashoffset: 400 }, { strokeDashoffset: 0, duration: 1.1, delay: 0.55, stagger: 0.12, ease: 'power2.out',
      onComplete: () => g.delayedCall(0.25, go) });
  } else if (kind === 'light') {
    veil.style.clipPath = 'none';
    veil.style.background = `radial-gradient(circle at ${ax}px ${ay}px, #fffaf0 0%, #fbf3e2 var(--r), rgba(251, 243, 226, 0) calc(var(--r) * 1.6))`;
    g.fromTo(veil, { '--r': '0px', opacity: 1 }, { '--r': Math.hypot(W, H) + 'px', duration: 1.25, delay: 0.35, ease: 'power2.in', onComplete: go });
    g.to(exitLight, { boost: 2.6, duration: 1.4, ease: 'power2.in' });
  } else if (kind === 'pull') {
    veil.style.clipPath = 'none';
    g.fromTo(veil, { opacity: 0 }, { opacity: 1, duration: 0.7, delay: 0.95, ease: 'power2.in', onComplete: go });
  } else {   // leaf
    const big = Math.hypot(W, H) * 2.6;
    veil.style.clipPath = 'none';
    veil.style.webkitMask = veil.style.mask = `url("${LEAF_MASK}") no-repeat`;
    const set = (s) => {
      const p = `${(ax - s / 2).toFixed(1)}px ${(ay - s * 0.8).toFixed(1)}px`, z = `${s.toFixed(1)}px ${(s * 1.6).toFixed(1)}px`;
      veil.style.webkitMaskPosition = veil.style.maskPosition = p;
      veil.style.webkitMaskSize = veil.style.maskSize = z;
    };
    const o = { s: 0 };
    set(0);
    g.to(o, { s: big, duration: 1.15, delay: 0.25, ease: 'power3.in', onUpdate: () => set(o.s), onComplete: go });
  }
}
addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  const v = $('#veil');
  v.replaceChildren();
  for (const k of ['clipPath', 'opacity', 'background', 'mask', 'webkitMask']) v.style[k] = '';
  if (cam) cam.push = null;
  exitLight.boost = 1;
});
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
  // the campus data loads alongside the tree; the map attaches before the first frame
  const mapData = params.has('nomap') ? Promise.resolve(null)
    : import('../map/map.js').then((m) => m.preload({ rotation: compose.rotation }).then((geo) => ({ m, geo }))).catch((err) => { console.warn('campus map unavailable', err); return null; });
  const { buildScene, pickTier } = await import('./scene.js');
  const tierName = pickTier();
  document.documentElement.dataset.tier = tierName;
  try {
    world = await buildScene($('#world'), tierName);
  } catch (err) {
    console.error(err);
    return goStatic();
  }
  setPortrait(innerWidth / innerHeight < 0.85);
  aimStudy();
  world.resize();
  addEventListener('resize', () => { world.resize(); if (setPortrait(innerWidth / innerHeight < 0.85) !== undefined) buildOrbitRefresh(); });
  cam = new DwellCamera(world.camera, $('#world'));
  W = createWorldState({ compose, canvas: world.renderer.domElement, cam });
  W.clock = clockOn ? createClock({ rotation: compose.rotation, filmSeconds: FILM_SECONDS }) : null;
  if (W.clock) mountSlate();
  cam.rail = () => override || life?.rail(state.p) || railAt(state.p);
  const attachMap = (md) => {
    if (!md || map) return;
    try {
      map = md.m.attach({ world, cam, state, poseAt, goTo, DwellCamera, reduceMotion, entry, busy: () => !!transit || !!document.querySelector('dialog[open]'), campusP: () => (transit ? transit.pv : state.p),
        worldState: W, focus: () => life?.focus() || null, walking: () => !!life?.walking(), walkView: (o) => life?.walkView(o) || null }, md.geo);
    } catch (err) { console.warn('campus map unavailable', err); }
    // the film, the walker, the pocket map and the menu share the map's campus (same frame, same model)
    if (map && !life) {
      import('../world/world.js').then((m) => {
        life = m.attachWorld({ world, cam, state, poseAt, goTo, DwellCamera, reduceMotion, W, map: map.api, geo: md.geo, chapters: CHAPTERS, setActive: (i) => setActive(i), entry, params, transitOn: () => !!transit, sound });
      }).catch((err) => console.warn('walk unavailable', err));
    }
  };
  if (!params.has('noroots')) {
    try {
      const R = await import('../roots/roots.js');
      roots = R.attach({ world, cam, state, goTo, shot, reduceMotion, entry, stops });
      buildOrbitRefresh();
    } catch (err) { console.warn('chapter 02 history unavailable', err); roots = null; stops[1].style.height = ''; }
  }
  const md = await Promise.race([mapData, new Promise((r) => setTimeout(() => r('late'), 4000))]);
  if (md === 'late') mapData.then(attachMap); else attachMap(md);
  // chapter 03: the works canopy grows on the same crown (?nocanopy compares against plain V4)
  if (!params.has('nocanopy')) {
    try { canopy = (await import('../canopy/canopy.js')).attach({ world, cam, state, goTo, DwellCamera, reduceMotion, entry, worldState: W }); } catch (err) { console.warn('chapter 03 canopy unavailable', err); canopy = null; }
  }
  // came back from a page: return to the viewpoint you left from (read before the first setActive)
  // Restore the chapter family before the homepage normalizes the URL.
  const hid = entry.hash === '#walk' ? 'recall'
    : entry.hash.startsWith('#map/') ? 'map'
    : /^#(roots|campus)(\/|$)/.test(entry.hash) ? 'roots'
    : /^#(leaves|archive)(\/|$)/.test(entry.hash) ? 'leaves'
    : location.hash.slice(1);
  const fromHash = entry.hash === '#walk' ? N - 1 : CHAPTERS.findIndex((c) => c.id === hid);
  const startAt = fromHash >= 0 ? fromHash : saved && Date.now() - saved.t < 30 * 60000 ? saved.c : 0;
  wireScroll();
  if (startAt > 0) goTo(startAt, true);
  roots?.arrive(entry);
  canopy?.arrive(entry);
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
  // without WebGL the campus plan is still there, as a drawing with the same places
  import('../map/static.js').then((m) => m.renderStatic()).catch((err) => console.warn('campus plan unavailable', err));
  import('../canopy/static.js').then((m) => m.renderStatic(entry)).catch((err) => console.warn('works list unavailable', err));
}

// The details shot is a portrait of one real cluster of new leaves on the rim
// of a lower tier. The camera stands level, just outside the crown, looking in:
// behind the leaves is the shaded inside of the crown with a few sky gaps, so
// the lit, glossy blades stand out. The sun rakes in from the outer side to
// draw out their relief. Those leaves get finely tessellated hero blades.
const STUDY = 2;
const STUDY_RANK = 1;   // art-directed for the locked tree (seed 2611); preview others with ?study=k
function aimStudy() {
  const ros = world.rosettes, st = world.stride;
  const ranked = [];
  for (let i = 0; i < ros.length; i += st) {
    const x = ros[i], y = ros[i + 1], z = ros[i + 2], tE = ros[i + 9];
    const r = Math.hypot(x - AXIS.x, z - AXIS.z);
    if (y < 4.4 || y > 7.0 || r < 7.5 || r > 12.5 || tE < 0.28 || tE > 0.36) continue;
    // a quiet side of the tree (away from the long limb), real foliage behind,
    // the rosette sitting on the outer shell of its clump
    const th = Math.atan2(x - AXIS.x, z - AXIS.z);
    const s = -Math.abs(Math.atan2(Math.sin(th - 1.2), Math.cos(th - 1.2))) * 1.2 - Math.abs(y - 5.5) * 0.5
      - Math.abs(tE - 0.31) * 8 - ros[i + 8] * 1.6 + ros[i + 15] * 1.2 + r * 0.12;
    ranked.push([s, i]);
  }
  if (!ranked.length) return;
  ranked.sort((a, b) => b[0] - a[0]);
  const best = ranked[Math.min(ranked.length - 1, +(params.get('study') ?? STUDY_RANK))][1];
  const P = new THREE.Vector3(ros[best], ros[best + 1] + 0.06, ros[best + 2]);
  const out = new THREE.Vector3(P.x - AXIS.x, 0, P.z - AXIS.z).normalize();
  const side = new THREE.Vector3(-out.z, 0, out.x);
  // a little above the cluster, looking in and slightly down into the shaded tier
  const eye = P.clone().addScaledVector(out, 0.85).addScaledVector(side, 0.28).add(new THREE.Vector3(0, 0.36, 0));
  const look = P.clone().addScaledVector(out, -0.1).add(new THREE.Vector3(0, -0.06, 0));
  retarget(STUDY, eye.toArray(), look.toArray(), 23);
  // the sun from the far side, over the cluster: grazing light that glints on
  // the glossy blades and glows through their edges
  LIGHT[STUDY].sun = [THREE.MathUtils.radToDeg(Math.atan2(-out.x, -out.z)) + 28, 34];
  ANCHORS[STUDY].copy(P);
  const hero = createHeroLeaves(world.canopy, P, 2.4);
  if (hero) world.scene.add(hero);
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
    if (canopy?.tap(e) || roots?.tap(e)) return;
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
let last = performance.now(), frames = 0, dwell = 0, slowAcc = 0, slowN = 0, openingFall = 0.5;
const fwd = new THREE.Vector3(), sunDir = new THREE.Vector3();
const C = (a) => new THREE.Color(a[0], a[1], a[2]);
function step(dt, wallDt = dt) {
  UNIFORMS.uTime.value += dt;
  const t = UNIFORMS.uTime.value;
  stepTransit();
  filmOn(wallDt);
  const p = state.p;
  const pl = transit ? transit.pv : (life?.lightP?.() ?? p);   // the day's light and the tree's growth (in flight, from home or from the walk: on the way)
  const near = Math.round(p);
  // (05 → 06 is the walker's film: 05's words stay while the eye is still in the crown, 06's come with the turn)
  setActive(transit ? -1 : roots?.owns(p) ? -1
    : p > 4 && p < 5 ? (p < 4.1 ? 4 : p > 4.95 ? 5 : -1)
    : Math.abs(p - near) < 0.3 ? near : -1);
  roots?.tick(dt);
  map?.tick(dt, wallDt);
  life?.tick(dt, wallDt);
  canopy?.tick(dt, wallDt);
  // growth and the light of the day follow the walk
  const grow = canopy ? canopy.grow(growAt(pl)) : growAt(pl);
  const L = lightAt(pl);
  // the world's clock: the sun is where it really stands at this instant over this campus (the shot's
  // colours, haze and exposure stay the shot's own); the evening's last minutes deepen with the sun
  const now = W?.clock ? W.clock.at(pl) : null;
  if (now) {
    L.sunAz = now.sunAz; L.sunEl = now.sunEl;
    if (now.dusk > 0) duskGrade(L, now.dusk);
    slate(now);
  }
  // in flight the lens is a wide, deep one: the macro depth of field of 03 belongs to that shot only
  if (transit) L.aperture *= 1 - Math.sin(Math.PI * Math.min(1, (performance.now() - transit.t0) / transit.dur));
  life?.light(L, p);
  map?.light(L);
  roots?.light(L, p);
  canopy?.light(L);
  const rail = override || life?.rail?.(p) || railAt(p);   // (05 → 06: the film's own lens and focus)
  const yaw = THREE.MathUtils.degToRad(L.sunAz);
  const el = THREE.MathUtils.degToRad(L.sunEl);
  sunDir.set(Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el));
  world.setStage({ grow, sunDir, sunCol: C(L.sunCol), sunI: L.I, zenith: C(L.zenith), horizon: C(L.horizon), glow: C(L.glow),
    fog: C(L.fog), density: L.density, mist: L.mist, rays: L.rays, exposure: L.exposure * exitLight.boost, warm: L.warm, cloud: L.cloud, sat: L.sat, contrast: L.contrast,
    aperture: L.aperture, focus: rail.focus || (L.focus > 0.1 ? L.focus : (rail.dist || Math.hypot(rail.lx - rail.ex, rail.ly - rail.ey, rail.lz - rail.ez))) });
  map?.post();
  const gust = 0.5 + 0.3 * Math.sin(t * 0.13) + 0.2 * Math.sin(t * 0.047 + 1.3) * Math.sin(t * 0.31);
  UNIFORMS.uGust.value = Math.max(0, Math.min(1, gust));
  UNIFORMS.uWind.value = reduceMotion ? 0.05 : 0.22 + 0.18 * grow;
  if (!map?.camera(dt, wallDt) && !life?.camera(dt, wallDt) && !canopy?.camera(dt, wallDt)) cam.update(dt, wallDt);
  world.camera.updateMatrixWorld();
  life?.after(dt, wallDt);
  dwell += cam.idleSeconds() > 2 ? dt : dt * 0.4;
  if (!reduceMotion && grow < 0.02 && (openingFall -= dt) < 0) {
    openingFall = 1.6 + Math.random() * 2.4;
    const ros = world.rosettes, st = world.stride;
    for (let k = 0; k < 40; k++) {
      const i = Math.floor(Math.random() * (ros.length / st)) * st;
      if (ros[i + 10] > 0 && ros[i + 1] > 4) { world.litter.release(new THREE.Vector3(ros[i], ros[i + 1], ros[i + 2]), 0.85 + Math.random() * 0.3); break; }
    }
  }
  world.litter.update(dt, grow, UNIFORMS.uWind.value * UNIFORMS.uGust.value, UNIFORMS.uWindDir.value, dwell, active === N - 1);
  sound.update(UNIFORMS.uWind.value * (0.5 + UNIFORMS.uGust.value), { fallen: 1 - grow }, haikouParts(Date.now()), { altitude: el });
  updateNav(p, grow);
  placeSlab(1 - Math.min(1, Math.abs(p - near) * 4), wallDt);
  map?.overlay();
  life?.overlay();
  canopy?.overlay();
  world.render(t);
  frames++;
}
// the last minutes of the evening, as the sun goes from where the film leaves it to the last light:
// redder and weaker, the sky deeper, the picture a little darker (the shadows lengthen by themselves)
function duskGrade(L, k) {
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  L.sunCol = mix(L.sunCol, [1.0, 0.5, 0.24], 0.7 * k);
  L.I *= 1 - 0.1 * k;                 // (kept strong: at this height it is the sun that draws the long shadows)
  L.zenith = mix(L.zenith, [0.03, 0.07, 0.24], 0.6 * k);
  L.horizon = mix(L.horizon, [0.82, 0.52, 0.44], 0.55 * k);
  L.glow = mix(L.glow, [1.6, 0.6, 0.24], 0.5 * k);
  L.fog = mix(L.fog, [0.52, 0.44, 0.47], 0.5 * k);
  L.exposure *= 1 - 0.1 * k;
  L.warm += (0.9 - L.warm) * 0.5 * k;
}
// the instant, shown where the chapter is named: a place and a time, as a caption would give them
let slateEl = null, slateKey = '';
function mountSlate() {
  const where = $('.orbit .where');
  if (!where || slateEl) return;
  slateEl = document.createElement('p');
  slateEl.className = 'when';
  slateEl.setAttribute('aria-hidden', 'true');
  slateEl.style.cssText = 'margin:3px 0 0;text-align:right;font:10px var(--serif);letter-spacing:.16em;color:var(--ink-3);font-variant-numeric:tabular-nums;white-space:nowrap';
  where.after(slateEl);
}
function slate(now) {
  if (!slateEl || now.label === slateKey) return;
  slateKey = now.label;
  slateEl.textContent = '海口 · ' + now.label;
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
  get world() { return world; }, get map() { return map?.api; }, get life() { return life?.api; }, get roots() { return roots?.api; }, get canopy() { return canopy?.api; }, get W() { return W; }, compose, chapters: CHAPTERS, state, goTo, pOfProgress, progressOfP,
  get transit() { return transit && { i: transit.i, p0: transit.p0, pv: +transit.pv.toFixed(3) }; },
  /** the world's clock (null unless ?clock=1): clock.at(p) → { label, sunAz, sunEl, evening, dusk } */
  get clock() { return W?.clock || null; },
  /** the sun as the scene has it right now (world heading and height, degrees) */
  get sun() { const d = world?.sun ? world.sun.position.clone().sub(world.sun.target.position).normalize() : null; return d && { az: +(((Math.atan2(d.x, d.z) * 180) / Math.PI + 360) % 360).toFixed(2), el: +((Math.asin(d.y) * 180) / Math.PI).toFixed(2) }; },
  /** review: hold a transit at u (0…1) between the current camera and shot i */
  transitAt: (i, u) => { if (!transit || transit.i !== i) startTransit(i); transit.t0 = performance.now() - u * transit.dur; stepTransit(); cam.snap(); },
  go: (i) => { override = null; transit = null; goTo(i, true); state.p = i; cam?.snap(); setActive(i); if (world) world.litter.falling.length = 0; },
  seek: (p) => { override = null; state.p = p; cam?.snap(); if (world) world.litter.falling.length = 0; },
  /** review and tests: stop (or resume) the scroll's hold on p, so seek(p) stays where it is put */
  freeze: (on = true) => { filmPlay.frozen = !!on; filmPlay.on = null; const ST = window.ScrollTrigger; if (ST) for (const st of ST.getAll()) { if (on) st.disable(false); else st.enable(false); } },
  /** the film's own playback (05 → 06 between beats): state for tests */
  get filmPlay() { return { on: !!filmPlay.on, target: filmPlay.on?.target ?? null, dir: filmPlay.dir }; },
  still: (seconds = 1, fps = 30) => { paused = true; for (let i = 0; i < Math.round(seconds * fps); i++) step(1 / fps); },
  lookdev: (eye, look, p, fov = 40) => { override = { ex: eye[0], ey: eye[1], ez: eye[2], lx: look[0], ly: look[1], lz: look[2], fov, dist: Math.hypot(look[0] - eye[0], look[1] - eye[1], look[2] - eye[2]) }; state.p = p; cam.snap(); },
  info: () => ({ active, p: state.p, grow: UNIFORMS.uGrow.value, leaves: world?.canopy.data.count, cam: world && [...world.camera.position.toArray().map((v) => +v.toFixed(2)), +world.camera.fov.toFixed(1), +(world.camera.userData.screen || world.camera.aspect).toFixed(3)],
    falling: world?.litter.falling.length, settled: world?.litter.settled.length, tier: document.documentElement.dataset.tier })
};

if ((params.has('capture') || params.has('test')) && window.gsap) window.gsap.ticker.lagSmoothing(0);   // review stills and slow test renderers
requestAnimationFrame(() => body.classList.add('painted'));
setActive(0);
start3D();
