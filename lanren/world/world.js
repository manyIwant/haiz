// Chapters 05 → 06 → the walk, in V4's own world (same scene, renderer, camera, tree, campus).
//
//   film     p ∈ [4, 5]: the walker's film (film.js), a pure function of the scroll
//   hold     p = 5: V4's 06, seen with the walker's eyes. It stays; nothing moves by itself.
//            One more deliberate step (scroll on, ↓ / Enter, swipe up, or the button) hands
//            the walker over. That step only hands over: the walker does not move with it.
//   play     the walk: WASD / arrows / joystick move, drag looks, Shift runs, Space jumps;
//            M the pocket map, Esc the menu, H hides the interface, B shows or hides the body
//   pocket   the pocket map over the walk      menu   the pause menu over the walk
//   map      chapter 04's full map, entered from the walk (map.js enterFromWalk), and back
//   transit  a camera flight between these (back to 06, to another chapter, to a fresh start)
//
// Ownership of camera and input goes through lanren/world/state.js (W.claim). The page never
// scrolls while the walk has the input, and the wheel never moves the walker.
import * as THREE from 'three';
import { shot, isPortrait, poseAt, CHAPTERS } from '../js/chapters.js';
import { makeFilm, railOf, BEATS, FOV_WALK, yawOf, STRIDE } from './film.js';
import { createBody } from './body.js';
import { eyeOffset } from './skeleton.js';
import { buildColliders, move, nearest, freeSpot } from './collide.js';
import { createPocket } from './pocket.js';
import { GROUND_Y } from './compose.js';

const D2R = Math.PI / 180;
const CSS = new URL('./world.css?v=1', import.meta.url).href;
const SAVE = 'haiz.walk';
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = (a) => { while (a > 180) a -= 360; while (a < -180) a += 360; return a; };
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const WALKING = new Set(['play', 'pocket', 'menu', 'transit']);

export function attachWorld(ctx) {
  const { world, cam, state, goTo, DwellCamera, W, map, geo } = ctx;
  const reduce = !!ctx.reduceMotion;
  const transitOn = ctx.transitOn || (() => false);   // home.js flying between distant shots: the film waits for it to land
  const camera = world.camera, canvas = world.renderer.domElement, body = document.body;
  const coarse = matchMedia('(pointer: coarse)').matches;
  if (!document.querySelector(`link[href="${CSS}"]`)) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS; document.head.append(l); }

  // ---------------------------------------------------------------- the walker
  const fig = createBody();
  world.scene.add(fig.group);
  // the islet's heightfield covers 8.6 m round the tree (scene.js); beyond it the campus ground
  const ground = (x, z) => (Math.abs(x) < 8.5 && Math.abs(z) < 8.5 ? Math.max(world.heightAt(x, z), GROUND_Y + 0.02) : GROUND_Y + 0.02);
  // the long limb's top surface, found on the bark itself (the walker stands on it)
  const anchors = world.meta.anchors || {};
  const dip = anchors.limbDip || [-6.857, 2.41, 0.772], end = anchors.limbEnd || [-10.706, 3.261, 0.834];
  const rc = new THREE.Raycaster();
  const onBark = (t) => {
    const p = dip.map((v, i) => v + (end[i] - v) * t);
    rc.set(new THREE.Vector3(p[0], p[1] + 2.5, p[2]), new THREE.Vector3(0, -1, 0));
    rc.far = 3.4;
    const hit = world.bark ? rc.intersectObject(world.bark, false)[0] : null;
    return [p[0], hit ? hit.point.y + 0.02 : p[1] + 0.24, p[2]];
  };
  const limb = { a: onBark(0.12), b: onBark(0.62) };
  // where the leap comes down: beyond the islet's rocks, turned a little towards 06
  function landing(e6) {
    const ld = [limb.b[0] - limb.a[0], limb.b[2] - limb.a[2]], l1 = Math.hypot(...ld);
    const to6 = [e6.ex - limb.b[0], e6.ez - limb.b[2]], l2 = Math.hypot(...to6);
    let dx = ld[0] / l1 + 0.6 * to6[0] / l2, dz = ld[1] / l1 + 0.6 * to6[1] / l2;
    const n = Math.hypot(dx, dz); dx /= n; dz /= n;
    let x = limb.b[0] + dx * 3.8, z = limb.b[2] + dz * 3.8;
    const r = Math.hypot(x, z);
    if (r < 10) { x *= 10 / r; z *= 10 / r; }
    return [x, z];
  }
  function frame6() {
    const s6 = W.compose.shot6;
    if (s6) return { ex: s6.eye[0], ez: s6.eye[2], lx: s6.look[0], ly: s6.look[1], lz: s6.look[2], fov: s6.fov, auth: 0, dist: Math.hypot(s6.look[0] - s6.eye[0], s6.look[2] - s6.eye[2]) };
    const f = shot(5), y = f.yaw * D2R, p = f.pitch * D2R;
    return { ex: f.ex, ez: f.ez, lx: f.ex + Math.sin(y) * Math.cos(p) * f.dist, ly: f.ey + Math.sin(p) * f.dist, lz: f.ez + Math.cos(y) * Math.cos(p) * f.dist, fov: f.fov, auth: f.auth, dist: f.dist };
  }
  let film = null, filmKey = '';
  function getFilm() {
    const k = (isPortrait() ? 'p' : 'l') + (shot(4)?.ex ?? 0);
    if (film && k === filmKey) return film;
    filmKey = k;
    const f5 = shot(4), e6 = frame6();
    film = makeFilm({ e5: { ex: f5.ex, ey: f5.ey, ez: f5.ez, yaw: f5.yaw, pitch: f5.pitch, fov: f5.fov, auth: f5.auth, dist: f5.dist }, e6, limb, land: landing(e6), ground });
    return film;
  }

  // ---------------------------------------------------------------- what the walker cannot walk through
  let col = null;
  function colliders() {
    if (col) return col;
    const sec = map.section;
    const pl = anchors.plinth;
    const rects = geo.features.filter((f) => f.kind === 'water').map((f) => ({ id: f.id, cx: f.cx, cz: f.cz, hw: f.hw, hd: f.hd, rot: f.rot }));
    if (pl) rects.push({ id: 'hujulongpan', cx: pl.centre[0], cz: pl.centre[2], hw: pl.size[0] / 2 + 0.35, hd: pl.size[1] / 2 + 0.45, rot: pl.yaw });
    const circles = [{ id: 'lanshu', x: 0.1, z: 0, r: 1.15 }, ...geo.trees.map((t, i) => ({ id: 'tree' + i, x: t.x, z: t.z, r: 0.28 }))];
    col = buildColliders(sec ? sec.buildings : [], { rects, circles }, geo.frame.sheet);
    return col;
  }

  // ---------------------------------------------------------------- the interface (built here, styled by world.css)
  const ui = document.createElement('div');
  ui.className = 'wd';
  ui.innerHTML = `
    <div class="wd-hold" hidden>
      <p class="wd-hold-t"><b>06 · 回望</b><span>${coarse ? '再向前一步，由你自己走' : '你已站在校园里。再向前一步，由你自己走'}</span></p>
      <button type="button" class="wd-go" data-w="go">走进校园 <i aria-hidden="true">→</i></button>
      <button type="button" class="wd-resume" data-w="resume" hidden>回到上次站的地方</button>
      <p class="wd-hold-dest" hidden></p>
      <p class="wd-hold-h">${coarse ? '再向上滑一次或点按钮 · 向下滑回到第五幕' : '再向下滚动一次 · ↓ / Enter · 或点按钮；向上滚动回到第五幕'}</p>
    </div>
    <p class="wd-rotate-chip" hidden><i aria-hidden="true"></i><span>落地了。横过手机，接下来可以自己走（可选）</span></p>
    <div class="wd-rotate" role="dialog" aria-modal="true" aria-labelledby="wdRotT" hidden>
      <div class="wd-rotate-card">
        <i class="wd-phone" aria-hidden="true"></i>
        <h3 id="wdRotT">横过来，走进校园</h3>
        <p>漫游在横屏下更开阔：左手移动，右手环顾。浏览器不能替你转动手机，转过来就会继续；也可以留在竖屏。</p>
        <div class="wd-rotate-b"><button type="button" data-w="landscape">全屏并横屏</button><button type="button" data-w="portrait">竖屏继续</button></div>
      </div>
    </div>
    <div class="wd-hud" hidden>
      <p class="wd-where"><b>漫游</b><span class="wd-dest" hidden></span></p>
      <div class="wd-top">
        <button type="button" class="wd-btn" data-w="map" aria-label="随身地图（M）"><span>地图</span><kbd>M</kbd></button>
        <button type="button" class="wd-btn wd-menu-btn" data-w="menu" aria-label="菜单（Esc）"><span>菜单</span><kbd>Esc</kbd></button>
      </div>
      <div class="wd-stick" aria-hidden="true"><i></i></div>
      <button type="button" class="wd-jump" data-w="jump" aria-label="跳">跳</button>
      <p class="wd-arrive" aria-live="polite"></p>
    </div>
    <button type="button" class="wd-handle" data-w="menu" aria-label="打开菜单" hidden>•••</button>
    <div class="wd-guide" role="note" hidden>
      <h3>现在由你来走</h3>
      <ul>${coarse
    ? '<li><b>左手</b>拖动移动（推到底是跑）</li><li><b>右手</b>拖动环顾</li><li><b>地图</b>与<b>菜单</b>在右上角</li>'
    : '<li><b>W A S D</b> / 方向键 移动，<b>Shift</b> 跑，<b>空格</b> 跳</li><li><b>拖动</b>画面环顾</li><li><b>M</b> 随身地图 · <b>Esc</b> 菜单 · <b>H</b> 隐藏界面 · <b>B</b> 身体</li>'}</ul>
      <p>建筑为近似体量，不能进入；回到六幕、地图与全部入口都在菜单里。</p>
      <button type="button" data-w="guide-ok">知道了</button>
    </div>
    <div class="wd-menu" role="dialog" aria-modal="true" aria-label="菜单" hidden data-own-scroll>
      <div class="wd-menu-card">
        <header><p><b>HAIZ</b><span>漫游菜单</span></p><button type="button" class="wd-x" data-w="resume-walk">继续漫游 <kbd>Esc</kbd></button></header>
        <div class="wd-menu-grid">
          <section><h4>地图</h4>
            <button type="button" data-w="map">随身地图 <kbd>M</kbd></button>
            <button type="button" data-w="fullmap">第四幕 · 完整地图</button>
            <button type="button" data-w="restart">从榄仁树重新出发</button>
            <p class="wd-menu-dest"></p>
          </section>
          <section><h4>六幕</h4>
            <button type="button" data-w="back6">回到第六幕回望</button>
            <div class="wd-chapters">${CHAPTERS.map((c, i) => `<button type="button" data-w="chapter" data-i="${i}"><b>${c.index}</b>${c.label.split(' · ')[1] || c.label}</button>`).join('')}</div>
          </section>
          <section><h4>观看</h4>
            <button type="button" data-w="noui" aria-pressed="false">隐藏界面（摄影） <kbd>H</kbd></button>
            <button type="button" data-w="body" aria-pressed="true">显示身体 <kbd>B</kbd></button>
            <button type="button" data-w="spot-save">保存此处取景</button>
            <div class="wd-spots" aria-label="保存的取景点（只在这台设备上）"></div>
          </section>
          <section><h4>去往</h4>
            <div class="wd-links">${CHAPTERS[5].entries.map((e) => e.href ? `<a href="${e.href}">${e.title}</a>` : `<button type="button" data-w="entry" data-action="${e.action}">${e.title}</button>`).join('')}<a class="wd-old" href="campus-3d.html">旧版第一人称校园（含想象教室）</a><a class="wd-old" href="director.html">探索导演台（路线与取景点）</a><a class="wd-old" href="descent.html">从星球到树荫（下降镜头）</a></div>
          </section>
        </div>
        <p class="wd-menu-note">模型为近似体量，室内为推演；校园地图沿用项目数据，不作实地导航。</p>
      </div>
    </div>
    <p class="wd-live" role="status" aria-live="polite"></p>`;
  body.append(ui);
  const $ = (q) => ui.querySelector(q), $$ = (q) => [...ui.querySelectorAll(q)];
  const say = (t) => { $('.wd-live').textContent = t; };
  // 05's note: with the campus standing in 05 (composition b), the far view is the campus model, not the lagoon
  if (W.compose.rise && W.compose.rise[1] <= 4) {
    const n = document.querySelector('#p-days .slab .note');
    if (n) n.textContent = '远景是校园的近似三维模型与艺术化的光影，不是实景照片或测绘';
  }
  const pocket = createPocket({ geo, W, onClose: () => closePocket(), onFullMap: () => toFullMap(), onRestart: () => restart(), say });

  // ---------------------------------------------------------------- the player (the walk's own state)
  const P = { x: 0, y: GROUND_Y, z: 0, vx: 0, vz: 0, vy: 0, yaw: 0, pitch: 0, bodyYaw: 0, phase: 0, amp: 0, crouch: 0, air: false, fov: FOV_WALK, fovT: FOV_WALK, idle: 0 };
  const input = { f: 0, s: 0, turn: 0, run: false, jump: false, keys: new Set(), stick: null, look: null };
  let flight = null;            // { from, to, t0, dur, then, arc }
  let holdSince = 0, wheelAcc = 0, lastWheel = 0;
  let pendingResume = null;
  try { const s = JSON.parse(sessionStorage.getItem(SAVE) || 'null'); if (s && Date.now() - s.t < 2 * 3600e3) pendingResume = s; } catch { /* storage blocked */ }
  if (pendingResume?.dest && !W.destination) W.setDestination(pendingResume.dest);
  let requestedFull = false, guided = false;
  try { guided = localStorage.getItem('haiz.walk.guided') === '1'; } catch { /* storage blocked */ }

  const eyeOfPlayer = (pp = P) => {
    const b = poseOf(pp), o = eyeOffset(b), r = b.yaw * D2R;
    return [pp.x + Math.sin(r) * o.fwd, pp.y + o.up, pp.z + Math.cos(r) * o.fwd];
  };
  function poseOf(pp = P) {
    return { show: true, x: pp.x, y: pp.y, z: pp.z, yaw: pp.bodyYaw, phase: pp.phase, amp: pp.amp, crouch: pp.crouch, tuck: pp.air ? 0.35 : 0, balance: 0, reach: 0, lean: 0, look: clamp(wrap(pp.yaw - pp.bodyYaw), -70, 70) };
  }
  function savePlayer() {
    try { sessionStorage.setItem(SAVE, JSON.stringify({ t: Date.now(), x: P.x, z: P.z, yaw: P.yaw, dest: W.destination })); } catch { /* storage blocked */ }
  }

  // ---------------------------------------------------------------- camera writing (walk, menus, flights)
  function writeCamera(eye, yaw, pitch, fov) {
    camera.position.set(eye[0], eye[1], eye[2]);
    camera.rotation.set(pitch * D2R, (yaw + 180) * D2R, 0, 'YXZ');
    const screen = DwellCamera.screen(camera);
    camera.fov = DwellCamera.fovFor(fov, screen, 0);
    camera.near = 0.06;
    DwellCamera.applyShift(camera);
    camera.updateProjectionMatrix();
    cam.shapedFor = null;     // V4's camera re-shapes its lens when it takes over again
  }
  const camState = () => {
    const d = camera.getWorldDirection(new THREE.Vector3());
    // the lens as authored (before V4's widening for narrow screens): the walk's own, or V4's rail
    return { eye: camera.position.toArray(), yaw: yawOf(d.x, d.z), pitch: Math.asin(clamp(d.y, -1, 1)) / D2R, fov: WALKING.has(W.owner) ? P.fov : cam.s.fov };
  };
  /** a flight between two eyes (rises a little on the way when it is long) */
  function fly(to, dur, then) {
    const from = camState();
    from.fov = flight?.cur?.fov ?? from.fov;
    if (reduce) dur = Math.min(dur, 0.45);
    flight = { from, to, t0: performance.now(), dur: dur * 1000, then, arc: Math.min(18, Math.hypot(to.eye[0] - from.eye[0], to.eye[2] - from.eye[2]) * 0.18) };
  }
  function stepFlight() {
    const f = flight, k = clamp((performance.now() - f.t0) / f.dur, 0, 1), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    const eye = f.from.eye.map((v, i) => v + (f.to.eye[i] - v) * e);
    eye[1] += f.arc * Math.sin(Math.PI * e);
    const yaw = f.from.yaw + wrap(f.to.yaw - f.from.yaw) * e, pitch = f.from.pitch + (f.to.pitch - f.from.pitch) * e;
    const fov = (f.from.fov || FOV_WALK) + ((f.to.fov || FOV_WALK) - (f.from.fov || FOV_WALK)) * e;
    f.cur = { eye, yaw, pitch, fov };
    writeCamera(eye, yaw, pitch, fov);
    if (k >= 1) { flight = null; f.then?.(); }
  }

  // ---------------------------------------------------------------- handing over, and back
  function setHud() {
    const play = WALKING.has(W.owner);
    $('.wd-hud').hidden = !play || W.owner === 'transit';
    $('.wd-handle').hidden = !(play && !W.hud.ui);
    body.classList.toggle('wd-walking', play);
    body.classList.toggle('wd-noui', play && !W.hud.ui);
    body.classList.toggle('wd-touch', coarse);
    $('[data-w="noui"]').setAttribute('aria-pressed', String(!W.hud.ui));
    const bb = $('[data-w="body"]');
    bb.setAttribute('aria-pressed', String(W.hud.body));
    bb.firstChild.textContent = W.hud.body ? '显示身体 ' : '身体已隐藏 ';
  }
  W.on('owner', setHud);
  W.on('hud', setHud);
  function syncDest() {
    const p = W.destination && geo.places.find((x) => x.id === W.destination);
    const chip = $('.wd-dest');
    chip.hidden = !p;
    const hd = $('.wd-hold-dest');
    hd.hidden = !p;
    if (p) hd.innerHTML = `目的地：<b>${p.name}</b>（从榄仁树出发，不会直接传送）<button type="button" data-w="clear">清除</button>`;
    $('.wd-menu-dest').textContent = p ? `目的地：${p.name}` : '没有目的地（在地图上点地点即可设定）';
    beacon.visible = !!p;
    if (p) beacon.position.set(p.x, GROUND_Y, p.z);
    arrived = false;
  }
  // the destination in the world: a soft column of light over the place
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 60, 20, 1, true), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 } },
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vU; uniform float uT; void main(){ float a = (1.0 - vU.y) * (1.0 - vU.y) * (0.55 + 0.45 * sin(vU.x * 6.2831 * 3.0 + uT)); gl_FragColor = vec4(vec3(1.0, 0.78, 0.42) * a * 0.55, 1.0); }'
  }));
  beacon.geometry.translate(0, 30, 0);
  beacon.visible = false;
  beacon.renderOrder = 5;
  world.scene.add(beacon);
  let arrived = false;
  W.on('destination', () => { syncDest(); savePlayer(); });
  syncDest();

  function startPlay(from = null) {
    const f = getFilm();
    const fx = f.facts;
    const s = camState();
    if (from) Object.assign(P, from);
    else {
      P.x = fx.G6[0]; P.z = fx.G6[2]; P.y = ground(P.x, P.z);
      // the eye stays exactly where the film left it: the gaze as it is now (including a free look)
      P.yaw = s.yaw; P.pitch = s.pitch; P.bodyYaw = fx.y6;
    }
    const c = colliders(), free = freeSpot(c, P.x, P.z);
    let moved = '';
    if (free.moved > 0) { P.x = free.x; P.z = free.z; moved = `原来的位置在建筑体量里，已移到最近的空地（${free.moved.toFixed(1)} m）。`; }
    P.vx = P.vz = P.vy = 0; P.air = false; P.crouch = 0; P.amp = 0;
    P.fov = from ? FOV_WALK : (s.fov || FOV_WALK);
    P.fovT = FOV_WALK;
    W.claim('play');
    fig.setFirstPerson(true);
    if (history.state?.walk !== 1) history.pushState({ walk: 1 }, '', '#walk');
    $('.wd-hold').hidden = true;
    if (!guided) { $('.wd-guide').hidden = false; guideTimer = setTimeout(() => dismissGuide(), 9000); }
    say(moved + '现在由你来走。' + (coarse ? '左手拖动移动，右手拖动环顾。' : 'WASD 移动，拖动环顾，M 地图，Esc 菜单。'));
    savePlayer();
    canvas.focus?.({ preventScroll: true });
  }
  let guideTimer = 0;
  function dismissGuide() {
    clearTimeout(guideTimer);
    $('.wd-guide').hidden = true;
    guided = true;
    try { localStorage.setItem('haiz.walk.guided', '1'); } catch { /* storage blocked */ }
  }
  function handoff({ resume = false } = {}) {
    if (W.owner !== 'hold' && W.owner !== 'scroll') return;
    if (state.p < 4.99) return;
    const portrait = innerWidth < innerHeight;
    const go = () => {
      if (resume && pendingResume) {
        const to = { x: pendingResume.x, z: pendingResume.z, y: ground(pendingResume.x, pendingResume.z), yaw: pendingResume.yaw, pitch: -6, bodyYaw: pendingResume.yaw };
        pendingResume = null;
        W.claim('transit');
        const eye = eyeOfPlayer({ ...P, ...to, amp: 0, crouch: 0 });
        fly({ eye, yaw: to.yaw, pitch: -6, fov: FOV_WALK }, 2.4, () => startPlay(to));
      } else startPlay();
    };
    if (coarse && portrait && !W.landscapeAsked) {
      W.landscapeAsked = true;
      ceremony(go);
      return;
    }
    go();
  }
  // ---------------------------------------------------------------- phones: from watching to walking, turned sideways
  let ceremonyThen = null;
  function ceremony(then) {
    ceremonyThen = then;
    $('.wd-rotate').hidden = false;
    body.classList.add('wd-rotating');
    $('[data-w="landscape"]').hidden = !(document.fullscreenEnabled || screen.orientation?.lock);
    $('[data-w="portrait"]').focus({ preventScroll: true });
  }
  function endCeremony() {
    if (!ceremonyThen) return;
    const t = ceremonyThen; ceremonyThen = null;
    $('.wd-rotate').hidden = true;
    body.classList.remove('wd-rotating');
    t();
  }
  async function goLandscape() {
    try { if (document.fullscreenEnabled && !document.fullscreenElement) { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); requestedFull = true; } } catch { /* not allowed here */ }
    try { await screen.orientation.lock('landscape'); } catch { say('这个浏览器不能锁定方向：请直接把手机横过来，或选“竖屏继续”。'); return; }
    endCeremony();
  }
  addEventListener('resize', () => { if (ceremonyThen && innerWidth > innerHeight) setTimeout(endCeremony, 250); });

  function leaveWalk() {
    camera.near = 0.08; camera.updateProjectionMatrix();   // V4's own near plane (the walk looks at its hands from closer)
    if (requestedFull && document.fullscreenElement) { document.exitFullscreen?.().catch(() => {}); requestedFull = false; }
    try { screen.orientation?.unlock?.(); } catch { /* nothing locked */ }
  }
  /** back to V4's 06, seen from where the film left the walker */
  function back6() {
    if (!WALKING.has(W.owner)) return;
    closeMenu(); closePocket(true);
    savePlayer();
    const f = getFilm().pose(1).cam;
    W.claim('transit');
    fly({ eye: [f.ex, f.ey, f.ez], yaw: f.yaw, pitch: f.pitch, fov: f.fov }, 2.2, () => {
      Object.assign(cam.s, railOf(f));
      cam.releaseLook();
      leaveWalk();
      W.claim('hold');
      history.replaceState(null, '', '#whole');
      pendingResume = { t: Date.now(), x: P.x, z: P.z, yaw: P.yaw, dest: W.destination };
      say('回到第六幕回望。向上滚动可回到其他幕；“回到上次站的地方”可继续漫游。');
    });
  }
  /** to another chapter: fly to its shot, then the six-shot film has the camera again */
  function toChapter(i) {
    if (i === 5) return back6();
    closeMenu(); closePocket(true);
    savePlayer();
    pendingResume = { t: Date.now(), x: P.x, z: P.z, yaw: P.yaw, dest: W.destination };
    const f = poseAt(i), d = [f.lx - f.ex, f.ly - f.ey, f.lz - f.ez];
    W.claim('transit');
    fly({ eye: [f.ex, f.ey, f.ez], yaw: yawOf(d[0], d[2]), pitch: Math.atan2(d[1], Math.hypot(d[0], d[2])) / D2R, fov: f.fov }, 2.6, () => {
      leaveWalk();
      W.claim('scroll');                 // first: the page may scroll again
      history.replaceState(null, '', '#' + CHAPTERS[i].id);
      goTo(i, true);
      state.p = i;
      Object.assign(cam.s, f);
      cam.releaseLook();
      ctx.setActive?.(i);
    });
  }
  function restart() {
    closeMenu(); closePocket(true);
    if (W.owner === 'map') { map.toWalk({ restart: true }); return; }
    const fx = getFilm().facts;
    const to = { x: fx.L[0], z: fx.L[2], y: ground(fx.L[0], fx.L[2]), yaw: fx.yAway, pitch: -4, bodyYaw: fx.yAway };
    W.claim('transit');
    fly({ eye: eyeOfPlayer({ ...P, ...to, amp: 0, crouch: 0, air: false }), yaw: to.yaw, pitch: -4, fov: FOV_WALK }, 1.8, () => startPlay(to));
  }
  // ---------------------------------------------------------------- the pocket map, the full map, the menu
  function openPocket() {
    if (W.owner !== 'play' && W.owner !== 'menu') return;
    closeMenu(true);
    W.claim('pocket');
    pocket.show({ x: P.x, z: P.z, yaw: P.yaw });
  }
  function closePocket(silent = false) {
    if (!pocket.open) return;
    pocket.hide();
    if (!silent && W.owner === 'pocket') { W.claim('play'); canvas.focus?.({ preventScroll: true }); }
  }
  function toFullMap() {
    closePocket(true); closeMenu(true);
    savePlayer();
    const eye = eyeOfPlayer();
    const pitchDown = Math.max(9, -P.pitch);
    const h = eye[1] - GROUND_Y, d = h / Math.sin(pitchDown * D2R);
    const fwd = [Math.sin(P.yaw * D2R), Math.cos(P.yaw * D2R)], flat = d * Math.cos(pitchDown * D2R);
    const view = { tx: eye[0] + fwd[0] * flat, tz: eye[2] + fwd[1] * flat, s: d * Math.tan((FOV_WALK * D2R) / 2), pitch: pitchDown, yaw: P.yaw, fov: FOV_WALK, auth: 0 };
    leaveWalk();
    fig.group.visible = false;
    map.enterFromWalk({ view, player: { x: P.x, z: P.z, yaw: P.yaw } });
  }
  /** for map.js: the walker's eye as a map view, and what to do once the camera is there */
  function walkView({ restart: fresh = false } = {}) {
    const fx = getFilm().facts;
    const to = fresh ? { x: fx.L[0], z: fx.L[2], yaw: fx.yAway } : { x: P.x, z: P.z, yaw: P.yaw };
    to.y = ground(to.x, to.z);
    const pitchDown = 9;
    const eye = eyeOfPlayer({ ...P, ...to, bodyYaw: to.yaw, amp: 0, crouch: 0, air: false });
    const h = eye[1] - GROUND_Y, d = h / Math.sin(pitchDown * D2R), flat = d * Math.cos(pitchDown * D2R);
    const view = { tx: eye[0] + Math.sin(to.yaw * D2R) * flat, tz: eye[2] + Math.cos(to.yaw * D2R) * flat, s: d * Math.tan((FOV_WALK * D2R) / 2), pitch: pitchDown, yaw: to.yaw, fov: FOV_WALK, auth: 0 };
    return { view, then: () => startPlay({ ...to, pitch: -pitchDown, bodyYaw: to.yaw }) };
  }
  // ---------------------------------------------------------------- viewpoints (a photographer's spots, kept on this device only)
  const SPOTS = 'haiz.walk.spots';
  const readSpots = () => { try { const v = JSON.parse(localStorage.getItem(SPOTS) || '[]'); return Array.isArray(v) ? v.slice(0, 6) : []; } catch { return []; } };
  const writeSpots = (v) => { try { localStorage.setItem(SPOTS, JSON.stringify(v.slice(0, 6))); } catch { /* storage blocked */ } renderSpots(); };
  function renderSpots() {
    const list = readSpots();
    $('.wd-spots').innerHTML = list.map((sp, i) => `<span class="wd-spot"><button type="button" data-w="spot-go" data-i="${i}">${sp.name}</button><button type="button" class="wd-spot-x" data-w="spot-del" data-i="${i}" aria-label="删除取景点 ${sp.name}">×</button></span>`).join('');
  }
  function saveSpot() {
    const near = geo.places.map((pl) => ({ pl, d: Math.hypot(pl.x - P.x, pl.z - P.z) })).sort((a, b) => a.d - b.d)[0];
    const list = readSpots();
    const name = (near ? `${near.pl.name}旁` : '取景点') + ' ' + (list.length + 1);
    list.unshift({ name, x: P.x, z: P.z, yaw: P.yaw, pitch: P.pitch, t: Date.now() });
    writeSpots(list);
    say(`已保存取景点「${name}」（只存在这台设备上）。`);
  }
  function goSpot(i) {
    const sp = readSpots()[i];
    if (!sp) return;
    closeMenu(true);
    const to = { x: sp.x, z: sp.z, y: ground(sp.x, sp.z), yaw: sp.yaw, pitch: sp.pitch, bodyYaw: sp.yaw };
    W.claim('transit');
    fly({ eye: eyeOfPlayer({ ...P, ...to, amp: 0, crouch: 0, air: false }), yaw: sp.yaw, pitch: sp.pitch, fov: FOV_WALK }, 1.8, () => startPlay(to));
  }
  function delSpot(i) { const list = readSpots(); list.splice(i, 1); writeSpots(list); }
  renderSpots();
  function openMenu() {
    if (W.owner !== 'play' && W.owner !== 'pocket') return;
    closePocket(true);
    W.claim('menu');
    $('.wd-menu').hidden = false;
    $('[data-w="resume-walk"]').focus({ preventScroll: true });
  }
  function closeMenu(silent = false) {
    if ($('.wd-menu').hidden) return;
    $('.wd-menu').hidden = true;
    if (!silent && W.owner === 'menu') { W.claim('play'); canvas.focus?.({ preventScroll: true }); }
  }

  ui.addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest('[data-w]') : null;
    if (!b) return;
    switch (b.dataset.w) {
      case 'go': return handoff();
      case 'resume': return handoff({ resume: true });
      case 'landscape': return goLandscape();
      case 'portrait': return endCeremony();
      case 'map': return pocket.open ? closePocket() : openPocket();
      case 'menu': return openMenu();
      case 'resume-walk': return closeMenu();
      case 'fullmap': return toFullMap();
      case 'restart': return restart();
      case 'back6': return back6();
      case 'chapter': return toChapter(+b.dataset.i);
      case 'noui': W.setHud({ ui: !W.hud.ui }); return closeMenu();
      case 'body': return W.setHud({ body: !W.hud.body });
      case 'clear': return W.setDestination(null);
      case 'guide-ok': return dismissGuide();
      case 'spot-save': return saveSpot();
      case 'spot-go': return goSpot(+b.dataset.i);
      case 'spot-del': return delSpot(+b.dataset.i);
      case 'jump': input.jump = true; return undefined;
      case 'entry': closeMenu(); return document.querySelector(`.panel [data-action="${b.dataset.action}"]`)?.click();
      default: return undefined;
    }
  });
  $('.wd-menu').addEventListener('pointerdown', (e) => { if (e.target === $('.wd-menu')) closeMenu(); });
  // links in the menu leave the walk for a page: remember where the walker stood
  $$('.wd-links a').forEach((a) => a.addEventListener('click', () => { savePlayer(); if (a.classList.contains('wd-old') && W.destination) a.href = 'campus-3d.html?focus=' + encodeURIComponent(W.destination); }));

  // ---------------------------------------------------------------- input
  const KEYMAP = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', KeyD: 'r', ArrowLeft: 'tl', ArrowRight: 'tr', ShiftLeft: 'run', ShiftRight: 'run' };
  addEventListener('keydown', (e) => {
    const t = e.target, inField = t instanceof Element && t.closest('input, textarea, select');
    if (inField || document.querySelector('dialog[open]')) return;
    // 06: one deliberate step hands the walker over
    if (W.owner === 'hold' && ['ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key) && !(t instanceof Element && t.closest('a, button')) ) {
      if (performance.now() - holdSince > 500) { e.preventDefault(); handoff(); }
      return;
    }
    if (W.owner === 'pocket') { if (e.key === 'Escape' || e.code === 'KeyM') { e.preventDefault(); closePocket(); } return; }
    if (W.owner === 'menu') { if (e.key === 'Escape') { e.preventDefault(); closeMenu(); } return; }
    if (W.owner !== 'play') return;
    if (e.key === 'Escape') { e.preventDefault(); if (!$('.wd-guide').hidden) dismissGuide(); return openMenu(); }
    if (e.code === 'KeyM') { e.preventDefault(); return openPocket(); }
    if (e.code === 'KeyH') { e.preventDefault(); return W.setHud({ ui: !W.hud.ui }); }
    if (e.code === 'KeyB') { e.preventDefault(); return W.setHud({ body: !W.hud.body }); }
    if (e.code === 'Space') { e.preventDefault(); input.jump = true; return undefined; }
    if (KEYMAP[e.code]) { e.preventDefault(); input.keys.add(KEYMAP[e.code]); }
    if (['PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) e.preventDefault();
    return undefined;
  }, true);
  addEventListener('keyup', (e) => { if (KEYMAP[e.code]) input.keys.delete(KEYMAP[e.code]); });
  addEventListener('blur', () => input.keys.clear());
  // 06: scrolling on (past the end of the page) is the deliberate step; so is a swipe up on a phone
  addEventListener('wheel', (e) => {
    if (W.owner !== 'hold') { wheelAcc = 0; return; }
    const now = performance.now();
    if (e.deltaY <= 0) { wheelAcc = 0; lastWheel = now; return; }
    // the scroll that brought the film here is not the step: wait for a fresh one
    if (now - holdSince < 650 || (now - lastWheel < 180 && wheelAcc === 0 && now - holdSince < 1400)) { lastWheel = now; return; }
    lastWheel = now;
    wheelAcc += e.deltaY * (e.deltaMode === 1 ? 16 : 1);
    if (wheelAcc > 90) { wheelAcc = 0; handoff(); }
  }, { passive: true });
  let swipe = null;
  addEventListener('touchstart', (e) => { if (W.owner === 'hold' && e.touches.length === 1 && !(e.target instanceof Element && e.target.closest('a, button, .slab'))) swipe = { y: e.touches[0].clientY, t: performance.now() }; }, { passive: true });
  addEventListener('touchmove', (e) => { if (swipe && W.owner === 'hold' && swipe.y - e.touches[0].clientY > 60 && performance.now() - holdSince > 600) { swipe = null; handoff(); } }, { passive: true });
  addEventListener('touchend', () => { swipe = null; }, { passive: true });

  // pointer: in the walk a drag looks round (mouse anywhere; touch on the right), the left thumb is a joystick
  const stick = $('.wd-stick'), knob = stick.querySelector('i');
  canvas.addEventListener('pointerdown', (e) => {
    if (W.owner !== 'play') return;
    P.idle = 0;
    if (!guided && !$('.wd-guide').hidden) dismissGuide();
    if (e.pointerType === 'touch' && e.clientX < innerWidth * 0.45 && !input.stick) {
      input.stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: 0, y: 0 };
      stick.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      stick.classList.add('on');
    } else if (!input.look) {
      input.look = { id: e.pointerId, x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch' };
      if (e.pointerType !== 'touch') canvas.setPointerCapture?.(e.pointerId);
    }
  });
  addEventListener('pointermove', (e) => {
    if (W.owner !== 'play') return;
    const st = input.stick;
    if (st && e.pointerId === st.id) {
      const dx = e.clientX - st.x0, dy = e.clientY - st.y0, R = 56, L = Math.hypot(dx, dy) || 1, k = Math.min(1, L / R);
      st.x = (dx / L) * k; st.y = (dy / L) * k; st.full = L > R * 1.15;
      knob.style.transform = `translate3d(${st.x * R}px, ${st.y * R}px, 0)`;
      return;
    }
    const lk = input.look;
    if (lk && e.pointerId === lk.id) {
      const k = lk.touch ? 0.22 : 0.16;
      P.yaw -= (e.clientX - lk.x) * k;
      P.pitch = clamp(P.pitch - (e.clientY - lk.y) * k, -78, 78);
      lk.x = e.clientX; lk.y = e.clientY;
    }
  });
  const pointerEnd = (e) => {
    if (input.stick && e.pointerId === input.stick.id) { input.stick = null; stick.classList.remove('on'); knob.style.transform = ''; }
    if (input.look && e.pointerId === input.look.id) input.look = null;
  };
  addEventListener('pointerup', pointerEnd);
  addEventListener('pointercancel', pointerEnd);
  // history: Back from the walk returns to 06; Forward is not a way into the walk (it needs the step)
  addEventListener('popstate', () => {
    if (WALKING.has(W.owner) && location.hash !== '#walk' && !location.hash.startsWith('#map')) back6();
  });

  // ---------------------------------------------------------------- per frame
  function stepPlayer(dt) {
    const c = colliders();
    const k = input.keys;
    let f = (k.has('f') ? 1 : 0) - (k.has('b') ? 1 : 0), s = (k.has('r') ? 1 : 0) - (k.has('l') ? 1 : 0);
    let run = k.has('run');
    if (input.stick) { f = -input.stick.y; s = input.stick.x; run = run || !!input.stick.full; }
    const turn = (k.has('tr') ? 1 : 0) - (k.has('tl') ? 1 : 0);
    P.yaw -= turn * 95 * dt;
    const mag = Math.min(1, Math.hypot(f, s));
    const speed = (run ? 4.3 : 1.7) * mag;
    const yr = P.yaw * D2R;
    // forward is where the eye looks (heading); strafing to the right of it
    const fx = Math.sin(yr), fz = Math.cos(yr), rx = -Math.cos(yr), rz = Math.sin(yr);
    const n = Math.hypot(f, s) || 1;
    const tvx = ((fx * f + rx * s) / n) * speed, tvz = ((fz * f + rz * s) / n) * speed;
    const acc = (1 - Math.exp(-(mag > 0.05 ? 9 : 12) * dt)) * (P.air ? 0.25 : 1);   // little steering in the air
    P.vx += (tvx - P.vx) * acc; P.vz += (tvz - P.vz) * acc;
    if (Math.hypot(P.vx, P.vz) < 0.02 && mag < 0.05) P.vx = P.vz = 0;
    // horizontal: slide along walls; refuse a step up a rock face the feet cannot take
    const m = move(c, P.x, P.z, P.vx * dt, P.vz * dt);
    const gNew = ground(m.x, m.z);
    if (!P.air && gNew - P.y > 0.45) { P.vx *= 0.2; P.vz *= 0.2; } else { P.x = m.x; P.z = m.z; }
    const moved = Math.hypot(P.vx, P.vz);
    // vertical: a small jump, gravity, the landing in the knees
    const g = ground(P.x, P.z);
    if (input.jump && !P.air) { P.vy = 4.1; P.air = true; }
    input.jump = false;
    if (P.air) {
      P.vy -= 13 * dt; P.y += P.vy * dt;
      if (P.y <= g) { P.crouch = Math.min(0.75, 0.25 + Math.abs(P.vy) / 14); P.y = g; P.vy = 0; P.air = false; }
    } else if (g < P.y - 0.5) { P.air = true; P.vy = 0; } else P.y = g;
    P.crouch *= Math.exp(-dt * 5);
    // steps: the phase follows the ground covered (no sliding), the stride grows with speed
    P.phase += ((moved * dt) / STRIDE) * Math.PI;
    const ampT = P.air ? 0.3 : Math.min(1.3, moved / 1.7);
    P.amp += (ampT - P.amp) * (1 - Math.exp(-dt * 8));
    // the body follows the eye: the head turns first, the shoulders and feet catch up
    const diff = wrap(P.yaw - P.bodyYaw);
    P.bodyYaw += diff * (1 - Math.exp(-dt * (moved > 0.2 ? 10 : Math.abs(diff) > 55 ? 6 : 1.5)));
    if (Math.abs(diff) > 30 && moved < 0.2) P.phase += Math.abs(diff) * dt * 0.05;
    P.fov += (P.fovT - P.fov) * (1 - Math.exp(-dt * 3));
    P.idle = mag > 0.05 || input.look ? 0 : P.idle + dt;
    // the destination: say when it is reached
    const dest = W.destination && geo.places.find((x) => x.id === W.destination);
    if (dest) {
      const inside = P.x > dest.box.x0 - 8 && P.x < dest.box.x1 + 8 && P.z > dest.box.z0 - 8 && P.z < dest.box.z1 + 8;
      if (inside && !arrived) { arrived = true; $('.wd-arrive').textContent = `已到达：${dest.name}`; say(`已到达 ${dest.name}。建筑为近似体量，不能进入。`); setTimeout(() => { $('.wd-arrive').textContent = ''; }, 4500); }
    }
  }
  let saveAcc = 0;
  function tick(dt, wall) {
    const p = state.p;
    // the end of the film: 06 holds; the scroll's owner becomes the hold's (and back)
    if (W.owner === 'scroll' && p >= 4.995 && map.mode !== 'map' && !transitOn()) { W.claim('hold'); holdSince = performance.now(); wheelAcc = 0; }
    else if (W.owner === 'hold' && p < 4.99) W.claim('scroll');
    const holding = W.owner === 'hold' && !ceremonyThen;
    $('.wd-hold').hidden = !holding;
    body.classList.toggle('wd-holding', holding);
    $('.wd-resume').hidden = !pendingResume;
    // phones: the hint to turn sideways rides the landing
    const q = p - 4;
    $('.wd-rotate-chip').hidden = !(coarse && innerWidth < innerHeight && W.owner === 'scroll' && q > 0.5 && q < 0.83);
    if (W.owner === 'play') {
      stepPlayer(Math.min(wall, 0.05));
      saveAcc += wall;
      if (saveAcc > 2) { saveAcc = 0; savePlayer(); }
      ui.classList.toggle('wd-idle', P.idle > 3.5);
    }
    if (pocket.open) pocket.update({ x: P.x, z: P.z, yaw: P.yaw });
    beacon.material.uniforms.uT.value += wall * 1.6;
  }
  function filmOn() { return (W.owner === 'scroll' || W.owner === 'hold') && state.p > 4.0001 && map.mode !== 'map' && !cam.push && !transitOn(); }
  function cameraHook() {
    if (flight) { stepFlight(); return true; }
    if (W.owner === 'play' || W.owner === 'pocket' || W.owner === 'menu') {
      const eye = eyeOfPlayer();
      writeCamera(eye, P.yaw, P.pitch, P.fov);
      return true;
    }
    return W.owner === 'transit';
  }
  function after() {
    if (filmOn()) {
      const ps = getFilm().pose(state.p - 4);
      // the eye is exactly in the walker's head (the look may still be easing: V4's camera turns it)
      camera.position.set(ps.cam.ex, ps.cam.ey, ps.cam.ez);
      camera.updateMatrixWorld();
      cam.s.ex = ps.cam.ex; cam.s.ey = ps.cam.ey; cam.s.ez = ps.cam.ez;
      fig.group.visible = ps.body.show && W.hud.body;
      if (fig.group.visible) fig.set(ps.body, ground(ps.body.x, ps.body.z));
      return;
    }
    if (WALKING.has(W.owner) && W.owner !== 'transit') {
      fig.group.visible = W.hud.body;
      fig.set(poseOf(), ground(P.x, P.z));
      return;
    }
    fig.group.visible = false;
  }
  function light(L, p) {
    // with the campus standing round the tree in 05 and 06, the air gives it depth: the far blocks
    // sink into the evening haze in 05, and in 06's clear day the buildings behind the tree recede a little
    const stand = (W.compose.rise && p > 3.6) || WALKING.has(W.owner) ? (WALKING.has(W.owner) ? 1 : smooth((p - 3.6) / 0.4)) : 0;
    if (stand > 0) {
      const at5 = WALKING.has(W.owner) ? 1 : clamp(p - 4, 0, 1);
      L.density *= 1 + stand * (0.85 - 0.4 * at5);
      L.mist *= 1 + stand * (0.6 - 0.3 * at5);
    }
    // 05's depth of field belongs to the view out of the crown: once the camera is a person the near world is sharp
    if (p > 4 && (W.owner === 'scroll' || W.owner === 'hold')) L.aperture *= 1 - smooth((p - 4.03) / 0.1);
    if (WALKING.has(W.owner)) L.aperture = 0;
    // composition a: 06's sun turns with its new view (sun 77° to the right of the gaze, as in V4)
    const s6 = W.compose.sun6;
    if (s6 != null && p > 4) {
      const f = clamp(p - 4, 0, 1), t = f * f * f * (f * (f * 6 - 15) + 10);
      L.sunAz += wrap(s6 - 58) * t;
    }
    return L;
  }
  function focus() {
    if (WALKING.has(W.owner)) return { x: P.x, z: P.z, r: 110 };
    if (filmOn()) { const b = getFilm().pose(state.p - 4).body; return { x: b.x, z: b.z, r: 120 }; }
    return null;
  }
  setHud();
  // the destination chip: name, distance, and which way (relative to the gaze)
  let chipKey = '';
  function overlay() {
    if (!WALKING.has(W.owner) || !W.destination) return;
    const d = geo.places.find((x) => x.id === W.destination);
    if (!d) return;
    const dist = Math.round(Math.hypot(d.x - P.x, d.z - P.z));
    const rel = wrap(yawOf(d.x - P.x, d.z - P.z) - P.yaw);
    const key = dist + '|' + Math.round(rel / 5);
    if (key === chipKey) return;
    chipKey = key;
    const chip = $('.wd-dest');
    chip.innerHTML = `<i style="display:inline-block;transform:rotate(${(-rel).toFixed(0)}deg)">↑</i> ${d.name} · ${dist} m`;
  }

  const api = {
    get owner() { return W.owner; },
    get player() { return { ...P }; },
    film: (q) => getFilm().pose(q),
    get facts() { return getFilm().facts; },
    limb, beats: BEATS,
    handoff: (o) => handoff(o || {}), back6, toChapter, restart, openPocket, closePocket, openMenu, closeMenu, toFullMap,
    /** tests: hold movement keys for a time (simulated without rendering), then report */
    simulate(keys = [], seconds = 1, dt = 1 / 30) {
      input.keys = new Set(keys);
      for (let t = 0; t < seconds; t += dt) stepPlayer(dt);
      input.keys = new Set();
      return { ...P };
    },
    look(dyaw = 0, dpitch = 0) { P.yaw += dyaw; P.pitch = clamp(P.pitch + dpitch, -78, 78); },
    place(x, z, yaw = P.yaw) { const f = freeSpot(colliders(), x, z); P.x = f.x; P.z = f.z; P.y = ground(f.x, f.z); P.yaw = P.bodyYaw = yaw; return f; },
    colliders: () => colliders(),
    clearance: (x, z) => nearest(colliders(), x, z).d,
    ceremony: () => !!ceremonyThen,
    endCeremony,
    pocket
  };
  return { tick, camera: cameraHook, after, light, focus, rail: (p) => ((W.owner === 'scroll' || W.owner === 'hold') && p >= 4 && map.mode !== 'map' ? railOf(getFilm().pose(p - 4).cam) : null), overlay, walking: () => WALKING.has(W.owner) || map.fromWalk, walkView, api };
}
