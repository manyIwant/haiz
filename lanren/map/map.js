// Chapter 04, continued: the water under the tree becomes the campus.
//
// One world, one renderer, one tree. This module adds a state machine to V4's
// homepage and borrows its camera and input only while the campus is up:
//
//   tree     V4 as it was. Scroll walks the six shots; drag looks around.
//   reveal   resting at 04, the campus surfaces under the water (≈6 s). A tap
//            hurries it; any scroll cancels it and the water closes again.
//   map      the plan is ground. Wheel/pinch zoom, drag pans, tap chooses a
//            place. The page does not scroll; 05 is one button (or Esc) away.
//   leave    the camera returns to the 04 frame, the plan sinks back into the
//            water, and V4 takes its camera and scroll back. Same tree, same
//            growth, same position on the walk: the page never reloads.
//
// The plan is the campus's site plan; the campus model (section.js) waits whole
// beneath it, every building on its own footprint. On the visitor's word it unfolds
// (unfold.js, u: 0 → 1): the camera takes in the whole site plan, each building
// rises out of its footprint as a whole volume, a front from the roots turns the
// card into material. In 3D a drag turns the view, a right-drag or two fingers
// pan, a tap opens a building, and that one building can be cut at any storey.
// Folding back is the same film backwards; leaving or going on to 05 folds first.
//
// History: #map (the 04 shot) → #map/oblique|top (the plan) → #map/3d (the
// campus unfolded) → #map/<view>/<id> (a place). Back steps out one level at a time; a reload or a return from the
// walk restores the same view from sessionStorage.
import * as THREE from 'three';
import { buildGeo, placeAt, featureAt, arrivalAt, GROUND_Y } from './geo.js';
import { createMapLayer } from './layer.js';
import { DURATION, revealAt } from './reveal.js';
import { createSection } from './section.js';
import { CUT_HEIGHT, clearOfBands } from './campus3d.js';
import * as Unfold from './unfold.js';
import * as View from './view.js';
import { buildDom, fillDetail, fillFloors, createOverlay, niceScale } from './ui.js';
import { parseHash, hashFor as hashOf } from './hash.js';

const TOKEN = 'haiz.map';
const CSS = new URL('./map.css?v=2', import.meta.url).href;
const EYE_3D = 7;            // in 3D the camera may come down to look at a facade

/** Start loading the campus data (in parallel with the tree). */
export function preload() {
  const base = new URL('../../', import.meta.url);
  const get = (p, optional) => fetch(new URL(p, base)).then((r) => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); }).catch((e) => { if (optional) return null; throw e; });
  return Promise.all([get('assets/walk/campus.json'), get('data/buildings.json', true)]).then(([campus, extras]) => buildGeo(campus, extras));
}

export { parseHash };

/**
 * @param ctx { world, cam, state, poseAt, goTo, DwellCamera, reduceMotion }
 * @returns hooks for home.js: tick, light, post, camera, overlay, api
 */
export function attach(ctx, geo) {
  const { world, cam, state, poseAt, goTo, DwellCamera } = ctx;
  const reduce = !!ctx.reduceMotion;
  const body = document.body;
  const canvas = world.renderer.domElement;
  const camera = world.camera;
  const near0 = camera.near, far0 = camera.far;
  if (!document.querySelector(`link[href="${CSS}"]`)) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS; document.head.append(l); }

  const layer = createMapLayer(world, geo);
  const { places, features } = geo;
  // the campus model the plan is a cut of (if it fails, the plan stays the drawn plan of before)
  let section = null;
  try { section = createSection(world, geo, geo.campus, layer); } catch (err) { console.warn('campus model unavailable', err); }
  const order = new Map(), arrive = new Map();
  let extent = null, sweepMax = 0;
  if (section) {
    let amax = 0;
    for (const b of section.buildings) { const v = arrivalAt(layer.field, b.cx, b.cz); arrive.set(b.index, v); amax = Math.max(amax, v); }
    for (const b of section.buildings) order.set(b.index, arrive.get(b.index) / (amax || 1));
    // the built campus with its grounds (field, gardens) for framing; the front reaches its far corner
    extent = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
    for (const f of features) {
      if (!['building', 'gate', 'field', 'botanic', 'garden', 'court'].includes(f.kind)) continue;
      const r = Math.hypot(f.hw, f.hd);
      extent.x0 = Math.min(extent.x0, f.cx - r); extent.x1 = Math.max(extent.x1, f.cx + r);
      extent.z0 = Math.min(extent.z0, f.cz - r); extent.z1 = Math.max(extent.z1, f.cz + r);
      for (const [x, z] of [[extent.x0, extent.z0], [extent.x1, extent.z1], [extent.x0, extent.z1], [extent.x1, extent.z0]]) sweepMax = Math.max(sweepMax, Math.hypot(x, z));
    }
    sweepMax += 40;
  }
  const placeIndex = new Map(places.map((p, i) => [p.id, i]));
  const byId = (id) => places[placeIndex.get(id)];
  const dom = buildDom(places);
  const overlay = createOverlay(dom, places, THREE.Vector3);
  const $ = dom.$, $$ = dom.$$;

  const S = { mode: 'tree', T: 0, speed: 1, dwell: 0, armed: true, frozen: false, view: 'oblique', selected: null, detail: false,
    hover: null, pan: new URLSearchParams(location.search).get('pan') === 'tether' ? 'tether' : 'open', owns: false, dim: 0, lockY: 0, leaveThen: null, leaveCam: false,
    // 3D: u the unfold (0 plan … 1 campus), trans the change under way, floor the storey a building is cut at
    u: 0, trans: null, floor: null, floorY: new Map(), floorK: new Map() };
  let cur = null, goal = null, tween = null, before = null, vel = null;
  // a deep link or a return from the walk: the address the page opened at (home.js reads it
  // before V4 rewrites the URL); on a reload this history entry may already be one of ours
  const opened = ctx.entry || { hash: location.hash, state: history.state };
  const intent = parseHash(opened.hash);
  let restoring = intent ? { ...intent, token: readToken(), state: opened.state } : null;

  const home = () => View.viewFromPose(poseAt(3));
  const lookOf = (view) => (view === 'top' ? { ...View.TOP } : (({ pitch, yaw, fov }) => ({ pitch, yaw, fov }))(home()));
  const in3d = () => !!section && (S.trans ? S.trans.dir > 0 : S.u > 0.5);
  const hashFor = () => hashOf(in3d() ? '3d' : S.view, S.detail ? S.selected : null);
  const eyeMin = () => (S.u >= 1 && !S.trans ? EYE_3D : undefined);
  const say = (t) => { $('.cmap-live').textContent = t; };
  const tweenTo = (b, dur, opts = {}) => {
    if (reduce) dur = Math.min(dur, 0.25);
    const a = { ...cur };
    View.clampScale(b, eyeMin());
    if (dur <= 0) { Object.assign(cur, b); Object.assign(goal, b); tween = null; opts.done?.(); return; }
    tween = { a, b: { ...b }, t0: performance.now(), dur: dur * 1000, fly: !!opts.fly, ease: opts.ease || View.easeInOut, done: opts.done };
    vel = null;
  };
  const constrain = (v) => {
    View.clampScale(v, eyeMin());
    if (S.u >= 1 && !S.trans) {
      v.pitch = Math.min(89.5, Math.max(14, v.pitch));
      View.clampToSheet(v, geo.frame.sheet, 20);
      return v;
    }
    if (S.pan === 'tether') {
      // the tree's root stays within the inner part of the frame: pull the target back towards it
      const limit = v.s * 0.85;
      const dx = v.tx, dz = v.tz, r = Math.hypot(dx, dz);
      if (r > limit) { v.tx *= limit / r; v.tz *= limit / r; }
    } else View.clampToSheet(v, geo.frame.sheet);
    return v;
  };

  // ---------------------------------------------------------------- history, one step at a time
  // history.back() lands later (a popstate); anything written to history before it lands would
  // go onto the entry being left. Our own steps back are counted and later writes wait for them.
  let pendingPops = 0;
  const queued = [];
  const hist = (fn) => { if (pendingPops > 0) queued.push(fn); else fn(); };
  const goBack = (n = 1) => { pendingPops++; if (n === 1) history.back(); else history.go(-n); };
  // our entries above chapter 04's own (#map): the plan, the campus in 3D, a place
  const depth = () => ({ map: 1, map3d: 2, detail: 2 + (history.state?.in3d ? 1 : 0) }[history.state?.cmap] || 0);
  const landed = () => { pendingPops = Math.max(0, pendingPops - 1); while (pendingPops === 0 && queued.length) queued.shift()(); };

  // ---------------------------------------------------------------- tokens (reload / return from the walk)
  function readToken() {
    try {
      const t = JSON.parse(sessionStorage.getItem(TOKEN) || 'null');
      return t && Date.now() - t.t < 2 * 3600e3 ? t : null;
    } catch { return null; }
  }
  function saveToken() {
    if (!goal) return;
    // mid-flight, the view being flown to is the one to come back to
    const at = tween ? tween.b : goal;
    try { sessionStorage.setItem(TOKEN, JSON.stringify({ t: Date.now(), view: S.view, d3: in3d(), cur: at, selected: S.selected, detail: S.detail, before, pan: S.pan, floor: S.floor })); } catch { /* storage blocked */ }
  }

  // ---------------------------------------------------------------- entering and leaving
  function startReveal(speed = 1) {
    if (S.mode === 'map' || S.mode === 'reveal') { S.speed = Math.max(S.speed, speed); return; }
    S.mode = 'reveal';
    S.speed = speed;
    body.classList.add('map-reveal');
    say('水面之下，校园正在显现。滚动可继续第五幕。');
  }
  function viewFromCamera() {
    const dir = camera.getWorldDirection(new THREE.Vector3());
    if (dir.y > -0.2) return null;
    const t = (GROUND_Y - camera.position.y) / dir.y;
    const fov = cam.s.fov, auth = cam.s.auth || 0;
    return { tx: camera.position.x + dir.x * t, tz: camera.position.z + dir.z * t, s: t * Math.tan((fov * Math.PI) / 360),
      pitch: (Math.asin(-dir.y) * 180) / Math.PI, yaw: (Math.atan2(dir.x, dir.z) * 180) / Math.PI, fov, auth };
  }
  // while the plan is up, the chapter's own links and the walk navigator are out of reach
  // (they fade, but must not take a click or a Tab before they are gone)
  const shelved = ['#p-map', '#orbit'].map((q) => document.querySelector(q)).filter(Boolean);
  // (giving them back, the chapter panel stays inert unless 04 is still the active shot, as V4 keeps it)
  const shelve = (on) => shelved.forEach((el) => { el.inert = on || (el.id === 'p-map' && body.dataset.chapter !== '3'); });
  function takeCamera(from) {
    cur = { ...from };
    goal = { ...from };
    S.owns = true;
    shelve(true);
    cam.enabled = false;
    cam.releaseLook();
    canvas.style.touchAction = 'none';
  }
  function enterMap({ fromHistory = false } = {}) {
    S.mode = 'map';
    S.T = 1;
    S.frozen = false;
    const h = home();
    takeCamera(viewFromCamera() || h);
    if (Math.abs(cur.tx - h.tx) + Math.abs(cur.tz - h.tz) + Math.abs(cur.pitch - h.pitch) > 0.05) tweenTo(h, 0.9);
    S.view = 'oblique';
    S.lockY = scrollY;
    body.classList.remove('map-reveal');
    body.classList.add('map-mode');
    if (!fromHistory) hist(() => history.pushState({ cmap: 'map' }, '', hashFor()));
    say('校园平面已就绪。拖动平移，滚轮或双指缩放，点选地点；Esc 返回树冠。');
    saveToken();
    section?.warm(camera);
  }
  /** straight into the plan (deep link, reload, return from the walk, history forward) */
  function enterInstant(intent2) {
    const tok = intent2.token;
    S.T = 1;
    layer.setReveal(1);
    S.mode = 'map';
    const want3d = intent2.view === '3d' && !!section;
    S.view = intent2.view === 'top' ? 'top' : tok?.view === 'top' && want3d ? 'top' : 'oblique';
    const plan = View.withLook(home(), lookOf(S.view));
    const tokOk = tok && tok.cur && (want3d ? tok.d3 : tok.view === intent2.view && !tok.d3);
    let base = tokOk ? tok.cur : plan;
    if (want3d) {
      S.u = 1;
      if (!tokOk) base = Unfold.unfoldPath(plan, extent, canvas.clientWidth / Math.max(1, canvas.clientHeight)).B;
    }
    takeCamera(base);
    S.pan = tok?.pan || S.pan;
    S.lockY = scrollY;
    body.classList.add('map-mode');
    body.classList.toggle('map-3d', want3d);
    // a fresh deep link builds the steps Back will walk down; a reload of one of our own
    // entries (or a return from the walk) keeps the history it already has
    const ours = !!intent2.state?.cmap;
    if (ours) {
      history.replaceState({ cmap: 'map' }, '', '#map/' + S.view);
      if (want3d) history.pushState({ cmap: 'map3d' }, '', '#map/3d');
    } else {
      history.replaceState({ cmap: 'shot' }, '', '#map');
      history.pushState({ cmap: 'map' }, '', '#map/' + S.view);
      if (want3d) history.pushState({ cmap: 'map3d' }, '', '#map/3d');
    }
    if (want3d && tok?.floor && tok.floor.group === intent2.id) S.floor = tok.floor;
    if (intent2.id && byId(intent2.id)) {
      if (tok?.selected === intent2.id && tok.before) before = tok.before;
      else before = { ...goal };
      select(intent2.id, { fly: !(tok?.selected === intent2.id && tok.detail), keepBefore: true, push: !ours });
    } else if (tok?.selected && byId(tok.selected)) highlight(tok.selected);
    syncControls();
    section?.warm(camera);
    say(want3d ? '已回到刚才的三维校园。' : '已回到刚才的校园平面。');
  }
  function exitMap({ fromHistory = false, then = null } = {}) {
    if (S.mode !== 'map') { if (then && S.mode === 'tree') then(); return; }
    // from the campus in 3D, fold back into the plan first (one film), then leave as before
    if (S.u > 0 || S.trans) {
      if (S.detail) closeDetail({ fromHistory: true, keepCamera: true });
      fold({ fast: true, history: false, then: () => exitMap({ fromHistory, then }) });
      return;
    }
    if (S.detail) closeDetail({ fromHistory: true, keepCamera: true });
    togglePlaces(false);
    S.mode = 'leave';
    S.leaveThen = then;
    S.leaveCam = true;
    body.classList.add('map-leaving');
    canvas.style.touchAction = '';
    layer.setHover(-1, -1);
    S.hover = null;
    const h = home();
    const far = Math.hypot(cur.tx - h.tx, cur.tz - h.tz) / h.s + Math.abs(Math.log(cur.s / h.s)) + Math.abs(cur.pitch - h.pitch) / 20;
    tweenTo(h, far < 0.02 ? 0 : Math.min(1.8, 0.8 + far * 0.35), { fly: far > 2, done: () => { S.leaveCam = false; } });
    if (!fromHistory) hist(() => { const n = depth(); if (n > 0) goBack(n); else history.replaceState({ cmap: 'shot' }, '', '#map'); });
    S.armed = false;
    say('回到第四幕：水面正在合拢。');
    try { sessionStorage.removeItem(TOKEN); } catch { /* storage blocked */ }
  }
  function handBack() {
    if (!S.owns) return;
    S.owns = false;
    tween = null;
    vel = null;
    Object.assign(cam.s, View.poseFromView(cur));
    camera.near = near0; camera.far = far0;
    camera.updateProjectionMatrix();
    cam.enabled = true;
    shelve(false);
    body.classList.remove('map-mode', 'map-leaving', 'map-3d', 'map-turning');
    canvas.style.cursor = '';
  }

  // ---------------------------------------------------------------- the plan becomes the campus (and back)
  const aspect = () => canvas.clientWidth / Math.max(1, canvas.clientHeight);
  function unfold({ instant = false, history: writeHistory = true } = {}) {
    if (!section || S.mode !== 'map') return;
    if (S.trans?.dir > 0 || (S.u >= 1 && !S.trans)) return;
    if (S.detail) closeDetail({ keepCamera: true });
    togglePlaces(false);
    const path = S.trans ? S.trans.path : Unfold.unfoldPath({ ...goal }, extent, aspect());
    startTrans(1, path, reduce || instant ? Unfold.DURATION.reduced : Unfold.DURATION.unfold);
    if (writeHistory) hist(() => history.pushState({ cmap: 'map3d' }, '', '#map/3d'));
    say('总平面正在成为校园：建筑从各自的占地轮廓升起，材质从榄仁树向外展开。');
  }
  function fold({ fast = false, then = null, history: writeHistory = true } = {}) {
    if (!section || S.mode !== 'map') { then?.(); return; }
    if (S.u <= 0 && !S.trans) { then?.(); return; }
    if (S.detail) closeDetail({ fromHistory: !writeHistory, keepCamera: true });
    setFloor(null);
    // retrace an unfold still under way; from a view of one's own, fold to the plan straight below it
    let path = S.trans?.path;
    if (!path) {
      path = Unfold.foldPath({ ...goal }, lookOf(S.view));
      // the plan has its own limits (the eye stays above the crown, the target on the sheet)
      View.clampScale(path.A); View.clampToSheet(path.A, geo.frame.sheet);
      path.M = { ...path.A };
    }
    startTrans(-1, path, reduce ? Unfold.DURATION.reduced : fast ? Unfold.DURATION.fold * 0.75 : Unfold.DURATION.fold, then);
    if (writeHistory) hist(() => { if (history.state?.cmap === 'map3d') goBack(); else history.replaceState({ cmap: 'map' }, '', '#map/' + S.view); });
    say('校园正在收回为总平面。');
  }
  function startTrans(dir, path, dur, then = null) {
    tween = null; vel = null;
    S.trans = { dir, path, u0: S.u, t0: performance.now(), dur: dur * 1000 * (dir > 0 ? 1 - S.u : S.u) + 1, then };
    body.classList.add('map-turning');
    body.classList.toggle('map-3d', dir > 0);
    syncControls();
  }
  function stepTrans() {
    const tr = S.trans;
    if (!tr) return;
    const k = Math.min(1, (performance.now() - tr.t0) / tr.dur);
    S.u = tr.dir > 0 ? tr.u0 + (1 - tr.u0) * k : tr.u0 * (1 - k);
    const v = Unfold.cameraAt(tr.path, S.u);
    Object.assign(cur, v); Object.assign(goal, v);
    if (k >= 1) {
      S.trans = null;
      body.classList.remove('map-turning');
      if (tr.dir > 0) { S.u = 1; Object.assign(cur, tr.path.B); Object.assign(goal, tr.path.B); say('三维校园：拖动旋转，右键或双指平移，滚轮缩放，点选建筑。'); showHint(); }
      else { S.u = 0; Object.assign(cur, tr.path.A); Object.assign(goal, tr.path.A); }
      syncControls();
      saveToken();
      tr.then?.();
    }
  }
  let hintTimer = 0;
  function showHint() {
    const h = $('.cmap-hint');
    if (!h) return;
    h.classList.add('on');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => h.classList.remove('on'), 5200);
  }
  /** cut a building at one of its storeys (null: whole in 3D, the ground floor on the plan) */
  function setFloor(f) {
    // the buildings whose cut moves glide to it (only those: everything else follows u exactly)
    const groups = new Set([S.floor?.group, f?.group].filter(Boolean));
    if (groups.size) S.glide = { groups, until: performance.now() + 2500 };
    S.floor = f && section?.byGroup.get(f.group) ? f : null;
    syncFloors();
    saveToken();
  }
  function syncFloors() {
    $$('[data-floor]').forEach((b) => b.setAttribute('aria-pressed', String(S.floor ? +b.dataset.floor === S.floor.k : b.dataset.floor === 'all')));
  }
  /**
   * Every building this frame. The plan is a site plan: the buildings wait under it. Unfolding,
   * each rises out of its own footprint as a whole volume (walls and roof), nearest the tree
   * first. A storey cut is only ever for one building the visitor asked about.
   */
  function cutsNow(wall) {
    if (!section) return;
    const gate = S.T > 0 && S.mode === 'map';
    const k = 1 - Math.exp(-wall * 6);
    const live = !S.trans && S.mode === 'map';
    section.setLifts((b) => {
      if (!gate) return -(b.top + 1);
      const asked = S.floor && S.floor.group === b.group;
      // the chosen building rises on its own on the plan; everything follows u exactly while the campus changes form
      const want = Math.max(Unfold.riseAt(S.u, order.get(b.index)), asked ? 1 : 0);
      const prev = S.floorK.get(b.index);
      const gliding = S.glide && S.glide.groups.has(b.group) && performance.now() < S.glide.until;
      const kk = prev === undefined || !live || !gliding ? want : prev + (want - prev) * k;
      S.floorK.set(b.index, Math.abs(kk - want) < 1e-3 ? want : kk);
      const e = S.floorK.get(b.index);
      return -(1 - e * e * (3 - 2 * e)) * (b.top + 1);
    });
    section.setCuts((b) => {
      const whole = GROUND_Y + b.top + 1;
      let y = whole;
      if (S.floor && S.floor.group === b.group && b.levels.length) {
        const kk = Math.min(b.levels.length - 1, S.floor.k);
        y = GROUND_Y + b.levels[kk] + CUT_HEIGHT;
      }
      // a chosen storey is reached by moving the cut, not by jumping to it
      const prev = S.floorY.get(b.index);
      const gliding = S.glide && S.glide.groups.has(b.group) && performance.now() < S.glide.until && S.u >= 1;
      const settled = prev === undefined || !gliding || !live ? y : prev + (y - prev) * k;
      S.floorY.set(b.index, settled);
      if (settled >= whole - 0.01) return whole;
      // never rest inside a slab: a cut through one would fill the whole building with ink
      return GROUND_Y + clearOfBands(settled - GROUND_Y, b.bands);
    });
    const sw = Unfold.sweepAt(S.u);
    section.setSweep(sw.f * sweepMax, sw.glow);
  }

  // ---------------------------------------------------------------- views, places
  function setView(view, { push = false } = {}) {
    if (S.mode !== 'map' || S.trans) return;
    if (S.u >= 1) {
      // in 3D the two looks are two heights of the same camera
      const b = { ...goal, pitch: view === 'top' ? 89.5 : 38 };
      S.view = view;
      tweenTo(constrain(b), 1.2);
      syncControls();
      say(view === 'top' ? '从正上方看三维校园。' : '斜看三维校园。');
      saveToken();
      return;
    }
    if (view === S.view && !tween) return;
    S.view = view;
    const b = View.withLook(goal, lookOf(view));
    tweenTo(constrain(b), 1.5);
    syncControls();
    const h = hashFor();
    hist(() => history[push ? 'pushState' : 'replaceState'](history.state, '', h));
    say(view === 'top' ? '正俯视：校园平面，北（校园坐标）朝上。' : '斜俯视：第四幕原来的视角。');
    saveToken();
  }
  function focusView(p) {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    const v = { ...goal };
    if (S.u >= 1 && section) {
      // a three-quarter view: the fronts (+Z) and the sunlit east side, high enough to read the roof
      const hgt = section.topOf(p.id);
      const tall = hgt == null ? 0 : hgt - GROUND_Y;
      v.pitch = S.floor ? 56 : Math.min(48, Math.max(30, v.pitch));
      const span = Math.max(p.d, p.w * (H / (W > 760 ? W * 0.62 : W)), tall * 1.3) * 0.85;
      v.s = Math.min(170, Math.max(View.minScale(v, EYE_3D), span, 16));
      v.yaw = clearYaw(p, v, tall);
      const k = Math.tan((DwellCamera.fovFor(v.fov, DwellCamera.screen(camera), v.auth) * Math.PI) / 360) / Math.tan((v.fov * Math.PI) / 360);
      const mpp = (2 * v.s * k) / H;
      const shift = W > 760 ? Math.min(220, W * 0.17) * mpp : 0;
      const ya = (v.yaw * Math.PI) / 180;
      v.tx = p.x - Math.cos(ya) * shift; v.tz = p.z + Math.sin(ya) * shift;
      return v;
    }
    // frame the whole footprint with air round it (the panel's side excluded on wide screens)
    const span = Math.max(p.d, p.w * (H / (W > 760 ? W * 0.62 : W))) * 0.95;
    v.s = Math.min(150, Math.max(View.minScale(v), span, 18));
    // the panel covers the right of a wide screen: keep the place in the open part
    const k = Math.tan((DwellCamera.fovFor(v.fov, DwellCamera.screen(camera), v.auth) * Math.PI) / 360) / Math.tan((v.fov * Math.PI) / 360);
    const mpp = (2 * v.s * k) / H;
    const shift = W > 760 ? Math.min(220, W * 0.17) * mpp : 0;
    // screen-right on the ground is (-cos yaw, sin yaw): aim to the right of the place so it sits left of the panel
    const yaw = (v.yaw * Math.PI) / 180;
    v.tx = p.x - Math.cos(yaw) * shift;
    v.tz = p.z + Math.sin(yaw) * shift;
    return v;
  }
  /** the heading that sees a building best: its front (+Z) and the sunlit side first, nothing standing in the way */
  function clearYaw(p, v, tall) {
    const mine = section.byGroup.get(p.id);
    const norm = (y) => ((y % 360) + 540) % 360 - 180;
    const pref = [210, 180, 240, 150, 270, 120, 300, 90, 330, 60, 0, 30];
    let yaw0 = norm(v.yaw);
    if (!mine) return yaw0;
    const pts = [[p.x, Math.max(2, tall * 0.5), p.z], [p.x, tall, p.z]];
    for (const [cx, cz] of [[p.box.x0, p.box.z0], [p.box.x1, p.box.z0], [p.box.x1, p.box.z1], [p.box.x0, p.box.z1]]) pts.push([cx, tall * 0.7, cz]);
    const ray = new THREE.Ray(), to = new THREE.Vector3();
    const blocked = (yaw) => {
      const e = View.eyeOf({ ...v, yaw, tx: p.x, tz: p.z });
      let n = 0;
      for (const [x, y, z] of pts) {
        ray.origin.set(e.x, e.y, e.z);
        to.set(x, GROUND_Y + y, z).sub(ray.origin);
        const dist = to.length();
        ray.direction.copy(to).normalize();
        const hit = section.pick(ray);
        if (hit && hit.building.group !== p.id && hit.t < dist - 1) n++;
      }
      return n;
    };
    // stay where the visitor already looks from when that view is clear and shows the front half
    const d0 = Math.abs(norm(yaw0 - 195));
    if (d0 < 70 && blocked(yaw0) === 0) return yaw0;
    let best = pref[0], score = Infinity;
    pref.forEach((y, i) => { const sc = blocked(y) * 10 + i * 0.5; if (sc < score) { score = sc; best = y; } });
    // the short way round from where the camera is
    yaw0 = v.yaw;
    let d = norm(best - yaw0);
    return yaw0 + d;
  }
  function highlight(id) {
    S.selected = id;
    layer.setSelect(id ? placeIndex.get(id) : -1);
    section?.setFlags(S.hover, id);
  }
  function select(id, { push = true, fly = true, keepBefore = false } = {}) {
    const p = byId(id);
    if (!p || S.mode !== 'map') return;
    if (!S.detail && !keepBefore) before = { ...goal };
    const wasDetail = S.detail;
    if (S.floor && S.floor.group !== id) setFloor(null);
    highlight(id);
    S.detail = true;
    fillDetail(dom, p, geo, section?.byGroup.get(id)?.[0] || null, in3d());
    syncFloors();
    const panel = $('.cmap-detail');
    panel.hidden = false;
    panel.scrollTop = 0;
    body.classList.add('map-detail');
    void panel.offsetWidth;   // start the slide-in now, not after the next (possibly heavy) WebGL frame
    panel.classList.add('open');
    if (fly) tweenTo(constrain(focusView(p)), 1.35, { fly: true });
    const h = hashFor();
    hist(() => history[push && !wasDetail ? 'pushState' : 'replaceState']({ cmap: 'detail', id, in3d: in3d() }, '', h));
    panel.focus({ preventScroll: true });
    say(p.name + '：详情已打开。Esc 返回地图。');
    saveToken();
  }
  function closeDetail({ fromHistory = false, keepCamera = false } = {}) {
    if (!S.detail) return;
    S.detail = false;
    if (S.floor) setFloor(null);
    const panel = $('.cmap-detail');
    panel.classList.remove('open');
    body.classList.remove('map-detail');
    setTimeout(() => { if (!S.detail) panel.hidden = true; }, reduce ? 0 : 420);
    // back to where the visitor was looking before; the place stays marked
    if (!keepCamera && before) tweenTo(constrain(S.u >= 1 ? { ...before } : { ...before, pitch: goal.pitch, yaw: goal.yaw, fov: goal.fov }), 1.1);
    if (!fromHistory) { const h = hashFor(); hist(() => { if (history.state?.cmap === 'detail') goBack(); else history.replaceState({ cmap: in3d() ? 'map3d' : 'map' }, '', h); }); }
    if (document.activeElement && panel.contains(document.activeElement)) canvas.focus?.({ preventScroll: true });
    say('已返回地图。');
    saveToken();
  }
  function zoomBy(f, gx, gz) {
    if (S.mode !== 'map' || S.trans) return;
    const g = gx === undefined ? { x: goal.tx, z: goal.tz } : { x: gx, z: gz };
    const s = Math.min(View.LIMITS.sMax, Math.max(View.minScale(goal, eyeMin()), goal.s * f));
    tweenTo(constrain(View.zoomAbout(goal, g, s / goal.s)), 0.45, { ease: View.easeOut });
  }
  function recenter() {
    if (S.mode !== 'map' || S.trans) return;
    const h = home();
    tweenTo(constrain({ ...goal, tx: h.tx, tz: h.tz, s: Math.min(goal.s, h.s * 1.0) > h.s * 0.6 ? h.s : goal.s }), 1.2, { fly: true });
  }
  function togglePlaces(on) {
    const nav = $('#cmapPlaces'), btn = $('[data-act="places"]');
    on = on ?? nav.hidden;
    nav.hidden = !on;
    btn.setAttribute('aria-expanded', String(on));
    if (on) nav.querySelector('button[data-place]')?.focus({ preventScroll: true });
  }
  function syncControls() {
    $$('[data-view]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.view === S.view)));
    $$('[data-pan]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pan === S.pan)));
    const u = $('[data-act="unfold"]');
    if (u) {
      const on = in3d();
      u.hidden = !section;
      u.setAttribute('aria-pressed', String(on));
      u.querySelector('span').textContent = on ? '收回为平面' : '展开为三维';
      u.querySelector('small').textContent = on ? '校园总平面' : '整座校园';
    }
    $('.cmap-eyebrow span').textContent = in3d() ? '图纸之上 · 三维校园' : '水面之下 · 校园平面';
    if (S.detail && S.selected && section) { fillFloors(dom, section.byGroup.get(S.selected)?.[0] || null, in3d()); syncFloors(); }
    $('.cmap-lede').textContent = in3d()
      ? '每栋建筑从自己的占地轮廓升起为完整体量。拖动旋转，右键或双指平移，滚轮缩放，点选建筑；单栋建筑可在详情里逐层剖切。'
      : '校园总平面：建筑占地、道路、绿地与操场，与三维校园同一套数据。以百年榄仁树为原点，1 米即 1 米；拖动平移，滚轮或双指缩放，点选地点。';
  }

  // ---------------------------------------------------------------- picking
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function ndcOf(e) {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1];
  }
  function groundUnder(e) { const [x, y] = ndcOf(e); return View.groundAt(camera, x, y, THREE.Vector3); }
  function pick(e) {
    const [x, y] = ndcOf(e);
    ndc.set(x, y);
    ray.setFromCamera(ndc, camera);
    // the crown first: the tree itself is the place called 百年榄仁树
    const o = ray.ray.origin, d = ray.ray.direction;
    const c = { x: -2.1, y: 9.4, z: -0.45 }, R = [15.2, 6.8, 12.0];
    const ox = (o.x - c.x) / R[0], oy = (o.y - c.y) / R[1], oz = (o.z - c.z) / R[2], dx = d.x / R[0], dy = d.y / R[1], dz = d.z / R[2];
    const A = dx * dx + dy * dy + dz * dz, B = 2 * (ox * dx + oy * dy + oz * dz), C = ox * ox + oy * oy + oz * oz - 0.72;
    if (B * B - 4 * A * C > 0) return { place: byId('lanshu'), feature: null };
    // standing buildings answer where they stand (in 3D, or a storey cut on the plan)
    if (section && (S.u > 0.05 || S.floor)) {
      const hit = section.pick(ray.ray);
      if (hit && byId(hit.building.group)) return { place: byId(hit.building.group), feature: null, g: hit.point };
    }
    const g = View.groundAt(camera, x, y, THREE.Vector3);
    if (!g) return { place: null, feature: null };
    return { place: placeAt(places, features, g.x, g.z), feature: featureAt(features, g.x, g.z), g };
  }

  // ---------------------------------------------------------------- input (only while the plan is up)
  const pts = new Map();
  let downAt = 0, lastMove = 0, moved = 0, pinch = null, hoverQueued = null, dragMode = 'pan';
  const owns = () => S.mode === 'map';
  const orbiting = () => S.u >= 1 && !S.trans;
  canvas.addEventListener('contextmenu', (e) => { if (owns() && S.u > 0) e.preventDefault(); });
  canvas.addEventListener('pointerdown', (e) => {
    if (!owns()) return;
    if (S.trans) return;   // the change plays through; the buttons can still reverse it
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // in 3D: a plain drag turns the view; right button, shift or two fingers pan
    dragMode = orbiting() && e.button !== 2 && !e.shiftKey && !e.ctrlKey && !e.metaKey ? 'orbit' : 'pan';
    if (e.pointerType !== 'touch') canvas.setPointerCapture?.(e.pointerId);
    downAt = e.timeStamp; moved = 0; vel = null;   // the events' own times: a busy frame must not turn a tap into a press
    if (tween) { Object.assign(goal, cur); tween = null; }
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!owns()) return;
    const p = pts.get(e.pointerId);
    if (!p) { hoverQueued = e; return; }
    const prev = { clientX: p.x, clientY: p.y };
    moved += Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y);
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size >= 2 && pinch) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const g0 = groundUnder({ clientX: pinch.x, clientY: pinch.y }), g1 = groundUnder({ clientX: mx, clientY: my });
      if (g0 && g1) { goal.tx += g0.x - g1.x; goal.tz += g0.z - g1.z; }
      const gm = groundUnder({ clientX: mx, clientY: my });
      if (gm && d > 0) Object.assign(goal, View.zoomAbout(goal, gm, pinch.d / d));
      // two fingers turning also turn the campus
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      if (orbiting() && pinch.ang !== undefined) { let da = ang - pinch.ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; goal.yaw -= (da * 180) / Math.PI; }
      constrain(goal);
      Object.assign(cur, goal);
      pinch = { d, x: mx, y: my, ang };
      return;
    }
    if (moved < 4) return;
    if (dragMode === 'orbit' && pts.size === 1) {
      goal.yaw -= (e.clientX - prev.clientX) * 0.24;
      goal.pitch += (e.clientY - prev.clientY) * 0.2;
      constrain(goal);
      Object.assign(cur, goal);
      p.t = lastMove = e.timeStamp;
      vel = null;
      canvas.style.cursor = 'grabbing';
      return;
    }
    const g0 = groundUnder(prev), g1 = groundUnder(e);
    if (!g0 || !g1) return;
    const dt = Math.max(0.008, (e.timeStamp - (p.t || downAt)) / 1000);
    p.t = lastMove = e.timeStamp;
    const dx = g0.x - g1.x, dz = g0.z - g1.z;
    goal.tx += dx; goal.tz += dz;
    constrain(goal);
    Object.assign(cur, goal);
    vel = { x: dx / dt, z: dz / dt, live: true };
    canvas.style.cursor = 'grabbing';
  });
  const up = (e) => {
    const had = pts.delete(e.pointerId);
    if (!owns() || !had) return;
    if (pts.size < 2) pinch = null;
    canvas.style.cursor = '';
    // a flick glides on; a drag that came to rest before release stays put
    if (vel?.live) { vel.live = false; if (e.timeStamp - lastMove > 80 || Math.hypot(vel.x, vel.z) < 4) vel = null; }
    if (moved <= 6 && e.timeStamp - downAt < 600 && e.type === 'pointerup' && pts.size === 0) {
      vel = null;
      const hit = pick(e);
      // act after this tap's click has been dispatched: a panel opening under the finger
      // must not receive it (it would follow the walk link)
      setTimeout(() => {
        if (hit.place) select(hit.place.id);
        else if (S.detail) closeDetail();
        else if (S.selected) highlight(null);
      }, 0);
    }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('dblclick', (e) => { if (!owns() || S.trans) return; const g = groundUnder(e); if (g) zoomBy(0.5, g.x, g.z); });
  canvas.addEventListener('pointerleave', () => { if (owns()) { hoverQueued = null; S.hover = null; layer.setHover(-1, -1); } });
  // the wheel belongs to the plan; panels keep their own scrolling
  // anything that can scroll (the place sheet, the list, V4's own dialogs) keeps its scrolling
  const scrollable = (t) => {
    for (let el = t instanceof Element ? t : null; el && el !== document.body; el = el.parentElement) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) return true;
      if (el.matches('dialog[open], .cmap-detail, .cmap-places')) return true;
    }
    return false;
  };
  addEventListener('wheel', (e) => {
    if (!owns() || scrollable(e.target)) return;
    e.preventDefault();
    if (e.target !== canvas || S.trans) return;   // over the controls (or mid-change): nothing moves
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
    const k = e.ctrlKey ? 0.01 : 0.0016;   // trackpad pinch arrives as ctrl+wheel
    const f = Math.exp(Math.max(-0.6, Math.min(0.6, e.deltaY * unit * k)));
    const g = groundUnder(e) || { x: goal.tx, z: goal.tz };
    if (tween) { Object.assign(goal, cur); tween = null; }
    const s = Math.min(View.LIMITS.sMax, Math.max(View.minScale(goal), goal.s * f));
    Object.assign(goal, View.zoomAbout(goal, g, s / goal.s));
    constrain(goal);
    vel = null;
  }, { passive: false });
  addEventListener('touchmove', (e) => { if (owns() && !scrollable(e.target)) e.preventDefault(); }, { passive: false });
  addEventListener('scroll', () => { if ((S.mode === 'map') && Math.abs(scrollY - S.lockY) > 1) scrollTo(0, S.lockY); }, { passive: true });
  addEventListener('keydown', (e) => {
    if (S.mode === 'reveal' && (e.key === 'Enter') && e.target === document.body) { startReveal(4); return; }
    if (!owns()) return;
    if (S.trans && e.key !== 'Escape' && e.key.toLowerCase() !== 'u') return;
    const t = e.target, inField = t instanceof Element && t.closest('input, textarea, select');
    if (inField || document.querySelector('dialog[open]')) return;   // V4's book and specimen keep their keys
    const onControl = t instanceof Element && t.closest('button, a');
    if (e.key === 'Escape') {
      e.preventDefault();
      if (!$('#cmapPlaces').hidden) { togglePlaces(false); $('[data-act="places"]').focus(); } else if (S.detail) closeDetail(); else if (in3d()) fold(); else exitMap();
      return;
    }
    if ((e.key === 'u' || e.key === 'U') && section && !(t instanceof Element && t.closest('input, textarea'))) { e.preventDefault(); return in3d() ? fold() : unfold(); }
    if (scrollable(t) && ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) return;
    const step = goal.s * 0.35, yaw = (goal.yaw * Math.PI) / 180;
    const right = [-Math.cos(yaw), Math.sin(yaw)], fwd = [Math.sin(yaw), Math.cos(yaw)];
    const pan = (a, b) => { e.preventDefault(); tweenTo(constrain({ ...goal, tx: goal.tx + right[0] * a + fwd[0] * b, tz: goal.tz + right[1] * a + fwd[1] * b }), 0.35, { ease: View.easeOut }); };
    switch (e.key) {
      case 'ArrowLeft': return pan(-step, 0);
      case 'ArrowRight': return pan(step, 0);
      case 'ArrowUp': return pan(0, step);
      case 'ArrowDown': return pan(0, -step);
      case '+': case '=': e.preventDefault(); return zoomBy(0.6);
      case '-': case '_': e.preventDefault(); return zoomBy(1.66);
      case 't': case 'T': e.preventDefault(); return setView(S.view === 'top' ? 'oblique' : 'top');
      case 'q': case 'Q': case '[': if (!orbiting()) return undefined; e.preventDefault(); return tweenTo(constrain({ ...goal, yaw: goal.yaw + 20 }), 0.45, { ease: View.easeOut });
      case 'e': case 'E': case ']': if (!orbiting()) return undefined; e.preventDefault(); return tweenTo(constrain({ ...goal, yaw: goal.yaw - 20 }), 0.45, { ease: View.easeOut });
      case 'Home': e.preventDefault(); return recenter();
      case 'PageUp': case 'PageDown': case 'End': e.preventDefault(); return undefined;
      case ' ': if (!onControl) e.preventDefault(); return undefined;
      default: return undefined;
    }
  }, true);

  // ---------------------------------------------------------------- controls
  dom.root.addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest('button, a') : null;
    if (!b) return;
    if (b.dataset.view) return setView(b.dataset.view);
    if (b.dataset.floor !== undefined) {
      if (!S.selected) return undefined;
      const f = b.dataset.floor === 'all' ? null : { group: S.selected, k: +b.dataset.floor };
      setFloor(f);
      // looking into a cut storey wants a steeper view; the whole building, the three-quarter one
      const p = byId(S.selected);
      if (p && S.u >= 1) tweenTo(constrain(focusView(p)), 1.0, { fly: true });
      say(f ? `${p?.name || ''}：剖切到 ${f.k + 1} 层（室内为推演）。` : `${p?.name || ''}：整栋。`);
      return undefined;
    }
    if (b.dataset.place) { togglePlaces(false); return select(b.dataset.place); }
    if (b.dataset.pan) { S.pan = b.dataset.pan; syncControls(); constrain(goal); saveToken(); return undefined; }
    if (b.classList.contains('cmap-walk')) {
      // the first-person walk is its own page: leave a way back to this exact view
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) { saveToken(); return undefined; }
      e.preventDefault();
      saveToken();
      const href = b.getAttribute('href');
      const veil = document.getElementById('veil');
      if (veil && window.gsap && !reduce) {
        veil.style.setProperty('--veil', '#0b1310'); veil.replaceChildren(); veil.style.clipPath = 'none';
        window.gsap.fromTo(veil, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power2.in', onComplete: () => { location.href = href; } });
      } else location.href = href;
      return undefined;
    }
    switch (b.dataset.act) {
      case 'hurry': return startReveal(4);
      case 'zoomin': return zoomBy(0.6);
      case 'zoomout': return zoomBy(1.66);
      case 'tree': return S.mode === 'map' ? (S.selected === 'lanshu' && !S.detail ? select('lanshu') : recenter()) : undefined;
      case 'places': return togglePlaces();
      case 'places-close': togglePlaces(false); return $('[data-act="places"]').focus();
      case 'close': return closeDetail();
      case 'center': { const p = byId(S.selected); if (p) tweenTo(constrain(focusView(p)), 1.0, { fly: true }); return undefined; }
      case 'exit': return exitMap();
      case 'unfold': return in3d() ? fold() : unfold();
      case 'north': return S.mode === 'map' && !S.trans ? tweenTo(constrain({ ...goal, yaw: lookOf(S.view).yaw }), 0.8) : undefined;
      case 'next': return exitMap({ then: () => goTo(4) });
      default: return undefined;
    }
  });
  // the chapter's own slab gains the way in (for anyone who does not wait)
  const slab = document.querySelector('#p-map .entries');
  if (slab) {
    const li = document.createElement('li');
    li.innerHTML = '<button type="button" data-action="campus-map" class="cmap-entry"><i>00</i><span class="t">水面之下的校园</span><small class="en">Beneath the water</small><small class="n">停留片刻，水面会显出整座校园；或点此开始</small></button>';
    slab.prepend(li);
    li.querySelector('button').addEventListener('click', () => startReveal(S.mode === 'reveal' ? 4 : 1.3));
  }
  addEventListener('popstate', () => {
    if (pendingPops > 0) { landed(); return; }   // our own step back: the state already matches
    const h = parseHash(location.hash);
    if (!h) { if (S.mode === 'map') exitMap({ fromHistory: true }); return; }
    if (S.mode === 'tree' || S.mode === 'cancel') {
      if (Math.abs(state.p - 3) > 0.01) return;
      restoring = { ...h, token: readToken(), soft: true };
      return;
    }
    if (S.mode !== 'map') return;
    if (h.view === '3d' && !in3d()) { unfold({ history: false }); return; }
    if (h.view !== '3d' && in3d()) { fold({ history: false }); return; }
    if (h.view !== '3d' && h.view !== S.view) setView(h.view);
    if (h.id && (!S.detail || S.selected !== h.id)) select(h.id, { push: false });
    else if (!h.id && S.detail) closeDetail({ fromHistory: true });
  });

  // ---------------------------------------------------------------- per frame
  function tick(dt, wall = dt) {
    const off = Math.abs(state.p - 3);
    if (restoring && off < 0.008) {
      const r = restoring;
      restoring = null;
      if (r.soft) { startReveal(4); S.pendingView = r.view; } else enterInstant(r);
    }
    switch (S.mode) {
      case 'tree':
        if (off > 0.05) { S.dwell = 0; S.armed = true; }
        else if (off < 0.008 && S.armed && !document.hidden && !ctx.busy?.()) { S.dwell += wall; if (S.dwell > (reduce ? 2.5 : DURATION.dwell)) startReveal(1); }
        break;
      case 'reveal':
        if (off > 0.02) { S.mode = 'cancel'; body.classList.remove('map-reveal'); say(''); break; }
        if (!S.frozen) S.T += (wall / (reduce ? 0.6 : DURATION.reveal)) * S.speed;
        if (S.T >= 1) { S.T = 1; enterMap(); if (S.pendingView === 'top') { setView('top'); } S.pendingView = null; }
        break;
      case 'cancel':
        S.T -= wall / (reduce ? 0.3 : DURATION.cancel);
        if (S.T <= 0) { S.T = 0; S.mode = 'tree'; S.armed = false; }
        break;
      case 'leave':
        if (off > 0.02) { handBack(); S.mode = 'cancel'; body.classList.remove('map-leaving'); break; }
        if (!S.leaveCam) S.T -= wall / (reduce ? 0.4 : DURATION.retreat);
        if (S.T <= 0) {
          S.T = 0; S.mode = 'tree'; handBack();
          const then = S.leaveThen; S.leaveThen = null;
          then?.();
        }
        break;
      default: break;
    }
    layer.setReveal(S.T);
    S.dim += ((S.detail ? 1 : 0) - S.dim) * (1 - Math.exp(-wall * 5));
    layer.setDim(S.dim);
    if (section) {
      if (S.mode !== 'map' && S.u > 0) { S.u = 0; S.trans = null; }   // left by any other way: the plan again
      // advance the change first, so the cuts, the front and the camera of this frame share one u
      if (S.trans) stepTrans();
      cutsNow(wall);
      section.setDim(S.dim);
      section.update(S.owns && cur ? { x: cur.tx, z: cur.tz, r: cur.s * 2.8 } : null);
    }
    if (S.mode === 'reveal') $('.cmap-progress > i').style.transform = `scaleX(${S.T.toFixed(3)})`;
  }
  function cameraHook(dt, wall = dt) {
    if (!S.owns) return false;
    if (S.trans) { /* the change sets the camera (advanced in tick) */ }
    else if (tween) {
      const u = Math.min(1, (performance.now() - tween.t0) / tween.dur);
      const e = tween.ease(u);
      const v = tween.fly ? View.flightView(tween.a, tween.b, e) : View.mixView(tween.a, tween.b, e);
      Object.assign(cur, v); Object.assign(goal, v);
      if (u >= 1) { const done = tween.done; Object.assign(cur, tween.b); Object.assign(goal, tween.b); tween = null; done?.(); }
    } else {
      if (vel && !vel.live) {
        goal.tx += vel.x * wall; goal.tz += vel.z * wall;
        constrain(goal);
        const k = Math.exp(-5 * wall);
        vel.x *= k; vel.z *= k;
        if (Math.hypot(vel.x, vel.z) < 0.3) vel = null;
      }
      const k = 1 - Math.exp(-14 * Math.min(0.1, wall));
      for (const key of ['tx', 'tz', 's', 'pitch', 'fov', 'auth']) cur[key] += (goal[key] - cur[key]) * k;
      let dy = goal.yaw - cur.yaw; while (dy > 180) dy -= 360; while (dy < -180) dy += 360;
      cur.yaw += dy * k;
    }
    View.applyView(camera, cur, DwellCamera);
    return true;
  }
  const occRay = new THREE.Ray();
  function occluded(p, at) {
    occRay.origin.copy(camera.position);
    occRay.direction.copy(at).sub(camera.position);
    const dist = occRay.direction.length();
    occRay.direction.divideScalar(dist);
    const hit = section.pick(occRay);
    return !!hit && hit.building.group !== p.id && hit.t < dist - 2;
  }
  function overlayHook() {
    const on = S.mode === 'map' && !S.trans;
    if (!S.owns && !body.classList.contains('map-reveal')) return;
    if (hoverQueued && on) {
      const e = hoverQueued; hoverQueued = null;
      const hit = pick(e);
      const id = hit.place?.id || null;
      if (id !== S.hover || !id) {
        S.hover = id;
        layer.setHover(id ? placeIndex.get(id) : -1, !id && hit.feature ? hit.feature.index : -1);
        section?.setFlags(id, S.selected);
        canvas.style.cursor = id ? 'pointer' : '';
      }
    }
    if (!S.owns) return;
    const rect = canvas.getBoundingClientRect();
    overlay.update(camera, rect, cur, { hover: S.hover, selected: S.selected, on, yOf: section ? (p) => section.topOf(p.id) : null, d3: S.u > 0.5, occluded: section && S.u > 0.5 ? occluded : null });
    // scale bar: metres per CSS pixel at the middle of the screen
    const a = View.groundAt(camera, 0, 0, THREE.Vector3), b = View.groundAt(camera, 0.1, 0, THREE.Vector3);
    if (a && b) {
      const mpp = Math.hypot(b.x - a.x, b.z - a.z) / (0.05 * rect.width);
      const n = niceScale(mpp);
      const bar = $('.cmap-bar');
      bar.querySelector('i').style.width = n.px.toFixed(1) + 'px';
      bar.querySelector('b').textContent = n.metres + ' m';
      $('.cmap-north i').style.transform = `rotate(${(180 - cur.yaw).toFixed(1)}deg)`;
    }
    // the tree's locator: when the crown is small or out of frame, its root is still marked
    const loc = $('.cmap-locator');
    const v = new THREE.Vector3(0, GROUND_Y, 0).project(camera);
    const x = (v.x * 0.5 + 0.5) * rect.width, y = (-v.y * 0.5 + 0.5) * rect.height;
    const inside = v.z < 1 && x > 24 && x < rect.width - 24 && y > 80 && y < rect.height - 90;
    // when the crown is in frame it carries its own label; the locator only points the way back
    const showLoc = on && !inside;
    loc.classList.toggle('on', showLoc);
    if (showLoc) {
      const cx = Math.min(rect.width - 70, Math.max(70, x)), cy = Math.min(rect.height - 120, Math.max(100, y));
      loc.classList.toggle('edge', !inside);
      loc.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
      loc.querySelector('i').style.transform = inside ? '' : `rotate(${Math.atan2(y - cy, x - cx).toFixed(3)}rad)`;
      loc.querySelector('small').textContent = inside ? '' : Math.round(Math.hypot(cur.tx, cur.tz)) + ' m';
    }
  }

  syncControls();
  const api = {
    get mode() { return S.mode; },
    get reveal() { return S.T; },
    info: () => ({ mode: S.mode, T: +S.T.toFixed(3), view: S.view, selected: S.selected, detail: S.detail, owns: S.owns, pan: S.pan, moving: !!tween || !!vel || !!S.trans,
      u: +S.u.toFixed(3), d3: in3d(), turning: !!S.trans, floor: S.floor, section: !!section,
      cam: cur && { tx: +cur.tx.toFixed(2), tz: +cur.tz.toFixed(2), s: +cur.s.toFixed(2), pitch: +cur.pitch.toFixed(2), yaw: +cur.yaw.toFixed(2), fov: +cur.fov.toFixed(2) }, hash: location.hash }),
    geo, layer, places, section,
    unfold: () => unfold(), fold: (then) => fold({ then }),
    /** review frames: hold the change at u (0…1) along the path from the current view */
    holdUnfold(u) {
      if (!section || S.mode !== 'map') return;
      const path = S.trans?.path || S.holdPath || Unfold.unfoldPath({ ...goal }, extent, aspect());
      S.holdPath = path; S.trans = null; S.u = u;
      body.classList.toggle('map-3d', u > 0.5); body.classList.toggle('map-turning', u > 0 && u < 1);
      const v = Unfold.cameraAt(path, u); Object.assign(cur, v); Object.assign(goal, v);
      syncControls();
    },
    floor: (k) => { const btn = $(`[data-floor="${k == null ? 'all' : k}"]`); if (btn) btn.click(); else if (S.selected) setFloor(k == null ? null : { group: S.selected, k }); },
    start: (speed = 1) => startReveal(speed),
    /** review frames: hold the reveal at T (0…1) without entering the plan */
    preview(T) { if (S.mode === 'tree' || S.mode === 'cancel' || S.mode === 'reveal') { S.mode = 'reveal'; S.frozen = true; S.T = T; body.classList.add('map-reveal'); layer.setReveal(T); } },
    release() { S.frozen = false; },
    enter: () => { if (S.mode !== 'map') { S.T = 1; layer.setReveal(1); enterMap(); } },
    exit: (then) => exitMap({ then }),
    next: () => exitMap({ then: () => goTo(4) }),
    view: (v) => setView(v),
    select: (id) => select(id),
    close: () => closeDetail(),
    zoom: (f) => zoomBy(f),
    pan: (dx, dz) => { tweenTo(constrain({ ...goal, tx: goal.tx + dx, tz: goal.tz + dz }), 0.01); },
    setView: (v) => { tweenTo(constrain({ ...goal, ...v }), 0); },
    /** finish any camera move now (for stills) */
    settle() {
      if (S.trans) { S.trans.t0 = -1e9; stepTrans(); }
      if (tween) { Object.assign(cur, tween.b); Object.assign(goal, tween.b); const d = tween.done; tween = null; d?.(); } else Object.assign(cur, goal);
      if (section) for (const b of section.buildings) { S.floorY.delete(b.index); S.floorK.delete(b.index); }
    },
    project: (x, z) => { const v = new THREE.Vector3(x, GROUND_Y, z).project(camera); const r = canvas.getBoundingClientRect(); return [(v.x * 0.5 + 0.5) * r.width + r.left, (-v.y * 0.5 + 0.5) * r.height + r.top]; }
  };
  // in 3D the air clears further: the far side of the campus should read, with a little aerial depth kept
  const light = (L) => { layer.stage(L); if (S.u > 0) { const k = Unfold.sweepAt(S.u).f; L.density *= 1 - 0.55 * k; L.mist *= 1 - k; } return L; };
  return { tick, light, post: () => layer.post(), camera: cameraHook, overlay: overlayHook, api };
}
