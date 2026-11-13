// The seventh view, in V4's own world (same scene, renderer, camera, tree, campus, clock).
//
// Not a seventh chapter: nothing is added to the scroll. From 06's hold, once the evening has come, the
// eye can leave the walker along the line their own shadow lies on: back and up, towards the sun, while
// the lens closes (lanren/seventh/seat.js). On the way the shadows slide in behind the things that cast
// them. At the end the eye is in the light's seat: no shadow is left in the picture, and the walker, the
// tree and the school stand in one line of sight, at their true sizes.
//
//   drag        leans out of the light: shadows come out from behind things; let go and they go back
//   wheel       along the ray (in towards the body, out to the seat, and on: a wider field)
//   the chart   any hour of any day of the film's spring; the seat stays in the sun, the world turns under it
//   01 … 06     each shot's own instant, as the light saw it
//   回到第一幕   down out of the light to where 01 was seen from, at 01's instant: the first frame again
//
// Everything is off unless home.js was asked for it (?seventh=1). Ownership goes through state.js ('seventh').
import * as THREE from 'three';
import { seatCamera, instantAt, instantOfMs, clampInstant, daylight, growOn, gradeP, boxOf, sixShots, lastLight, noonOf, shadedBy, shadowEdgeAbove, offLight, hourOfLeaf, SPRING, TURNED } from './seat.js';
import { eveningAt, duskAt, whenAt, solarAt } from '../world/clock.js';
import { GROW } from '../js/chapters.js';
import { GROUND_Y, campusAt } from '../world/compose.js';
import { FILM_SECONDS } from '../world/film.js';
import { UNIFORMS } from '../js/foliage.js';
import { buildSlots, resolve } from '../canopy/address.js';

const CSS = new URL('./seventh.css?v=1', import.meta.url).href;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const R2D = 180 / Math.PI;
/** how far the wheel can go past the seat: the field widens (the seat itself cannot be further than the sun) */
const WIDE = 0.6, WIDE_K = 4.2;

export function attach(ctx) {
  const { world, cam, state, W, life, map, DwellCamera } = ctx;
  const camera = world.camera, canvas = world.renderer.domElement, body = document.body;
  const reduce = !!ctx.reduceMotion, clock = W.clock, rotation = W.compose.rotation;
  const coarse = matchMedia('(pointer: coarse)').matches;
  if (!document.querySelector(`link[href="${CSS}"]`)) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS; document.head.append(l); }
  const anchors = world.meta.anchors || {}, trunk = anchors.trunk || [0.1, 1.6, 0];

  // ---------------------------------------------------------------- the campus, as the sun meets it
  const buildings = map.section?.buildings || [];
  const boxes = buildings.filter((b) => b.height > 3).map((b) => boxOf(b, GROUND_Y));
  // the school's shade on the tree: V4's sun draws only the tree's own shadows (its map covers 48 m round the
  // tree), so 一号教学楼 never shaded the tree it stands 11 m from. These boxes are drawn into that map and
  // nowhere else: the campus's own geometry, a little inside its walls (so no wall shades itself with it)
  const proxy = (() => {
    const pos = [], idx = [];
    for (const b of buildings) {
      if (b.id !== 'yihao') continue;   // (the one building near enough to shade the tree; the others are never in that map's reach)
      // (to the eaves, less a little: the roofs' own tiles stand above it and are not shaded by it; with the sun
      // higher than a hipped roof's pitch, about 12°, the eave is what draws the shadow's edge anyway)
      const c = Math.cos(b.rot), s = Math.sin(b.rot), hw = b.w / 2 - 0.4, hd = b.d / 2 - 0.4, h = b.height - 0.7;
      const base = pos.length / 3;
      for (const y of [-2, h]) for (const [lx, lz] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]) pos.push(b.cx + lx * c + lz * s, y, b.cz - lx * s + lz * c);
      const q = (a, b2, c2, d) => idx.push(base + a, base + b2, base + c2, base + a, base + c2, base + d);
      q(0, 1, 5, 4); q(1, 2, 6, 5); q(2, 3, 7, 6); q(3, 0, 4, 7); q(4, 5, 6, 7);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }));
    m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
    m.name = 'school-shade'; m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false; m.renderOrder = -20;
    m.position.y = GROUND_Y;
    world.scene.add(m);
    return m;
  })();
  const distance = world.scene.getObjectByName('distance');

  // ---------------------------------------------------------------- the six shots, as the light saw them
  const film6 = () => life.api.film(1);
  const standEye = () => { const c = film6().cam; return [c.ex, c.ey, c.ez]; };
  const leafOn = (i, doy) => { const g = growOn(doy, GROW), tE = world.rosettes[i + 9], old = world.rosettes[i + 10]; return old > 0 ? g < old : g > tE - 0.035; };
  let shots = null, els = null;
  function facts() {
    if (shots) return shots;
    const stations = [0, 1, 2, 3, 4, 5].map((i) => { const f = ctx.poseAt(i); return [f.ex, f.ey, f.ez]; });
    stations[5] = standEye();
    if (W.veil) stations[0] = standEye();
    shots = sixShots({ clock, stations, boxes, ros: world.rosettes, stride: world.stride, leafOn, rotation });
    els = shots.map((s) => s.sunEl);
    els[5] = solarAt(whenAt(5, { held: 0, filmSeconds: FILM_SECONDS }), rotation).sunEl;   // the grade's own key: the film's last frame
    return shots;
  }
  const noon = () => noonOf(SPRING[1], rotation);
  const DBG = {};
  let slotTable = null;
  { const cone = parseFloat(ctx.params?.get('cone')); if (cone > 0) DBG.cone = cone; }
  const culled = new Set();
  W.cull = (b) => S.on && culled.has(b.index);
  // the campus's trees are instanced: one that stands beyond where the picture begins (towards the sun, on a ray
  // this low it would stand in front of everything) is drawn at no size, in the picture and in the campus's
  // shadow map alike (they share their matrices), and is given back when the seat is left
  let treeSets = null, treeKey = '';
  function cullTrees(c) {
    const grp = map.section?.group;
    if (!grp) return;
    if (!treeSets) treeSets = grp.children.filter((o) => o.isInstancedMesh).map((mesh) => ({ mesh, own: Float32Array.from(mesh.instanceMatrix.array) }));
    const on = !!c && c.dist > c.margin;
    const cd = on ? [(c.eye[0] - c.target[0]) / c.dist, (c.eye[1] - c.target[1]) / c.dist, (c.eye[2] - c.target[2]) / c.dist] : null;
    const key = on ? [cd[0].toFixed(3), cd[1].toFixed(3), cd[2].toFixed(3), c.margin.toFixed(1), c.target.map((v) => v.toFixed(1))].join() : 'off';
    if (key === treeKey) return;
    treeKey = key;
    for (const { mesh, own } of treeSets) {
      const a = mesh.instanceMatrix.array;
      a.set(own);
      if (on) for (let i = 0; i < own.length; i += 16) {
        const depth = (own[i + 12] - c.target[0]) * cd[0] + (own[i + 13] + 6 - c.target[1]) * cd[1] + (own[i + 14] - c.target[2]) * cd[2];
        if (depth > c.margin - 3) for (let k = 0; k < 12; k++) a[i + k] = 0;
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------------- state
  const S = {
    on: false, u: 0, uT: 0, v: 0, lean: [0, 0], leanT: [0, 0], dragging: false,
    doy: SPRING[1], minutes: 1100, doyT: SPRING[1], minutesT: 1100, follow: 6,
    from: null, entry: null, leaving: null, cam: null, inst: null, askFirst: false
  };
  // what the seat frames: from the walker's feet (lowest in the picture: nearest the sun) to the school's eaves
  const centre = () => [trunk[0] - 1.3, 9.9, trunk[2]];
  const halfFor = (aspect) => clamp(24.5 / aspect, 14.2, 22);
  let keepPts = null;
  const keep = () => {
    if (keepPts) return keepPts;
    // the walker, and 一号教学楼 as points along its eaves and its foot (seat.js keeps those the frame holds)
    const yh = boxes.find((b) => b.id === 'yihao'), pts = [standEye()];
    if (yh) {
      const c = Math.cos(yh.rot), s = Math.sin(yh.rot);
      for (let lx = -yh.hw; lx <= yh.hw + 0.01; lx += 3) for (const lz of [-yh.hd, yh.hd]) for (const y of [yh.y1, GROUND_Y]) pts.push([yh.cx + lx * c + lz * s, y, yh.cz - lx * s + lz * c]);
    }
    return (keepPts = pts);
  };
  const inst = () => (S.inst = instantAt(S.doy, S.minutes, rotation));

  // ---------------------------------------------------------------- the interface (styled by seventh.css)
  const ui = document.createElement('div');
  ui.className = 'sv';
  ui.innerHTML = `
    <button type="button" class="sv-enter" data-sv="enter" hidden><b>第七种观看</b><span>沿着自己的影子退后，退到光里</span></button>
    <div class="sv-seat" hidden>
      <p class="sv-slate"><b>第七种观看 · 光的座位</b><span class="sv-when"></span></p>
      <p class="sv-line" aria-live="polite"></p>
      <div class="sv-time">
        <svg class="sv-chart" viewBox="0 0 236 124" role="slider" aria-label="时刻与季节" tabindex="0"></svg>
        <div class="sv-acts"></div>
      </div>
      <p class="sv-hint">${coarse ? '拖动画面：探出光外，影子就回来 · 双指：沿光线进退' : '拖动画面：探出光外，影子就回来 · 滚轮：沿光线进退 · 方向键：时刻与季节'}</p>
      <div class="sv-go"><button type="button" data-sv="first">从这里回到第一幕</button><button type="button" data-sv="back">回到身体 <kbd>Esc</kbd></button></div>
    </div>
    <p class="sv-live" role="status" aria-live="polite"></p>`;
  body.append(ui);
  const $ = (q) => ui.querySelector(q);
  const say = (t) => { $('.sv-live').textContent = t; };

  // the chart: the film's spring as a small map of time (across: the hour; up: the day), the six shots on it
  const CH = { x0: 10, x1: 226, y0: 112, y1: 14, m0: 330, m1: 1170 };
  const cx = (m) => CH.x0 + ((m - CH.m0) / (CH.m1 - CH.m0)) * (CH.x1 - CH.x0);
  const cy = (d) => CH.y0 + ((d - SPRING[0]) / (SPRING[1] - SPRING[0])) * (CH.y1 - CH.y0);
  function drawChart() {
    const f = facts();
    const days = []; for (let d = SPRING[0]; d <= SPRING[1]; d += 4) days.push(d); days.push(SPRING[1]);
    const edge = (k) => days.map((d, i) => `${i ? 'L' : 'M'}${cx(daylight(d)[k]).toFixed(1)} ${cy(d).toFixed(1)}`).join('');
    const back = days.slice().reverse().map((d) => `L${cx(daylight(d).last).toFixed(1)} ${cy(d).toFixed(1)}`).join('');
    const path = f.map((s, i) => `${i ? 'L' : 'M'}${cx(s.minutes).toFixed(1)} ${cy(s.doy).toFixed(1)}`).join('');
    $('.sv-chart').innerHTML = `
      <path class="sv-day" d="${edge('first')}${back}Z"/>
      <path class="sv-noon" d="${edge('noon')}"/>
      <path class="sv-film" d="${path}"/>
      ${f.map((s, i) => `<g class="sv-shot ${s.seen ? 'seen' : 'unseen'}"><circle cx="${cx(s.minutes).toFixed(1)}" cy="${cy(s.doy).toFixed(1)}" r="2.6"/><text x="${(cx(s.minutes) + (i >= 4 ? -5 : 5)).toFixed(1)}" y="${(cy(s.doy) + (i === 4 ? 9 : i === 5 ? -1 : 3.5)).toFixed(1)}" ${i >= 4 ? 'text-anchor="end"' : ''}>0${i + 1}</text></g>`).join('')}
      <text class="sv-ax" x="${CH.x0}" y="122">日出</text><text class="sv-ax" x="${cx(765)}" y="122" text-anchor="middle">正午</text><text class="sv-ax" x="${CH.x1}" y="122" text-anchor="end">日落</text>
      <text class="sv-ax" x="${CH.x0}" y="9">5月15日</text><text class="sv-ax" x="${CH.x0}" y="${CH.y0 - 3}">2月24日</text>
      <line class="sv-cross sv-cx" x1="0" x2="0" y1="${CH.y1}" y2="${CH.y0}"/><line class="sv-cross sv-cy" x1="${CH.x0}" x2="${CH.x1}" y1="0" y2="0"/>
      <circle class="sv-now" r="4.2"/>`;
    $('.sv-acts').innerHTML = f.map((s, i) => `<button type="button" data-sv="shot" data-i="${i}" title="${s.label}"><b>0${i + 1}</b></button>`).join('') + '<button type="button" data-sv="noon" title="5月15日 正午"><b>午</b></button>';
  }
  let uiKey = '';
  function syncUi() {
    const I = S.inst;
    if (!I) return;
    const off = S.cam ? offLight([S.cam.eye[0] - S.cam.target[0], S.cam.eye[1] - S.cam.target[1], S.cam.eye[2] - S.cam.target[2]], I.dir) * R2D : 0;
    const key = [I.label, I.sunEl.toFixed(1), off.toFixed(0), S.u.toFixed(2)].join('|');
    if (key === uiKey) return;
    uiKey = key;
    $('.sv-when').textContent = `海口 · ${I.label} · 日高 ${I.sunEl.toFixed(1)}°` + (off > 0.7 ? ` · 离开光线 ${off.toFixed(0)}°` : '');
    ctx.slate?.(I.label);
    const now = $('.sv-now');
    if (now) {
      now.setAttribute('cx', cx(I.minutes).toFixed(1)); now.setAttribute('cy', cy(I.doy).toFixed(1));
      const vx = $('.sv-cx'), vy = $('.sv-cy');
      vx.setAttribute('x1', cx(I.minutes).toFixed(1)); vx.setAttribute('x2', cx(I.minutes).toFixed(1));
      vy.setAttribute('y1', cy(I.doy).toFixed(1)); vy.setAttribute('y2', cy(I.doy).toFixed(1));
    }
    $('.sv-line').textContent = lineFor(I, off);
    $('.sv-chart').setAttribute('aria-valuetext', I.label);
  }
  /** one sentence of what is true at this instant (each clause is computed here, not written in advance) */
  function lineFor(I, off) {
    if (S.u < TURNED * 0.9) return '';
    if (off > 2.5) return '离开光的座位，影子就从东西背后出来。';
    const day = daylight(I.doy), morning = I.minutes < day.noon;
    if (I.sunEl > 84) return '立竿无影。日头在正上方，每一道影子都压在自己脚下——第四幕的那张平面，就是此刻从光里往下看。';
    const stand = standEye(), by = shadedBy(stand, I.dir, boxes);
    if (morning) {
      const edge = shadowEdgeAbove(trunk[0], trunk[2], I.dir, boxes, GROUND_Y);
      const top = world.meta.crown?.top ?? 15.2;
      if (edge === Infinity || edge > top + 0.5) return `太阳在一号教学楼后面。整棵树都在楼的影子里${by ? '，第一幕里你站的地方也是' : ''}：光看不见第一幕。`;
      if (edge > GROUND_Y + 0.6) return `楼的影子正从树上退下去，现在退到离地 ${(edge - GROUND_Y).toFixed(0)} 米。树冠从屋脊后面升起来。`;
      return '整棵树都在光里了。';
    }
    if (I.sunEl < 12 && Math.abs(I.doy - SPRING[1]) < 1.5) return '你的影子伸向树根，树的影子落在楼上。从这里，一道也看不见：人、树、楼，在同一条光线上。';
    return '午后。影子在每样东西的背后，朝东伸去。';
  }
  drawChartSoon();
  function drawChartSoon() { try { drawChart(); } catch { setTimeout(drawChartSoon, 600); } }

  // ---------------------------------------------------------------- in and out
  function restoreCamera() {
    camera.near = 0.08; camera.far = 1200; camera.up.set(0, 1, 0);
    camera.updateProjectionMatrix();
    const a = world.atmosphere?.uniforms;
    if (a) { a.uSkip.value = 0; a.uOppose.value = 0; }
    if (distance) distance.visible = true;
    cam.shapedFor = null;
  }
  function enter() {
    if (S.on || W.owner !== 'hold') return false;
    facts();
    const dir = camera.getWorldDirection(new THREE.Vector3());
    S.from = { eye: camera.position.toArray(), dir: dir.toArray(), fov: camera.fov };
    const k = instantOfMs(clock.when(5).ms);
    Object.assign(S, { on: true, u: 0, uT: 1, v: 0, lean: [0, 0], leanT: [0, 0], doy: k.doy, minutes: k.minutes, doyT: k.doy, minutesT: k.minutes, entry: k, leaving: null, follow: 6 });
    inst();
    W.claim('seventh');
    body.classList.add('sv-on');
    $('.sv-enter').hidden = true;
    $('.sv-seat').hidden = false;
    say('第七种观看：沿着影子退后，退到光里。拖动画面可以探出光外；Esc 回到身体。');
    canvas.focus?.({ preventScroll: true });
    return true;
  }
  function finish() {
    const to = S.leaving;
    S.on = false; S.leaving = null; S.u = 0; S.cam = null; S.free = null; culled.clear(); cullTrees(null);
    restoreCamera();
    body.classList.remove('sv-on', 'sv-seated');
    $('.sv-seat').hidden = true;
    life.api.figure.setFirstPerson(true);
    if (to === 'first') {
      // 01's instant, 01's standpoint: the six-shot film has the camera again, at its first frame
      clock.release();
      W.claim('scroll');
      ctx.toFirst?.();
      say('回到第一幕。同一个站位，二月的清晨。');
    } else {
      W.claim('hold');
      cam.snap();
      say('回到第六幕回望。');
    }
  }
  function leave(to = 'hold') {
    if (!S.on || S.leaving) return;
    S.leaving = to; S.uT = 0; S.leanT = [0, 0]; S.follow = 2.2;
    if (to === 'first') {
      const f = facts()[0];
      S.doyT = f.doy; S.minutesT = f.minutes;
      // come down to 01's own frame (the rail's, without the free look the hold may have had)
      const p0 = ctx.poseAt(0), d = [p0.lx - p0.ex, p0.ly - p0.ey, p0.lz - p0.ez], l = Math.hypot(...d);
      S.from = { eye: [p0.ex, p0.ey, p0.ez], dir: d.map((v) => v / l), fov: DwellCamera.fovFor(p0.fov, DwellCamera.screen(camera), p0.auth || 0) };
    } else { S.doyT = S.entry.doy; S.minutesT = S.entry.minutes; }
  }
  function goInstant(doy, minutes, follow = 1.5) { const k = clampInstant(doy, minutes); S.doyT = k.doy; S.minutesT = k.minutes; S.follow = follow; }

  // ---------------------------------------------------------------- per frame
  function tick(dt, wall) {
    const p = state.p;
    // the school's shade stands and withdraws with the school
    const presence = S.on ? 1 : campusAt(W.compose, p, { pinned: W.campus.pinned, walking: life.walking(), veil: W.veil });
    proxy.visible = presence > 0.02 && map.mode !== 'map';
    proxy.scale.y = Math.max(0.001, presence);
    // the way in appears once the evening has come to its last light (the shadow has reached the tree)
    const ready = W.owner === 'hold' && !S.on && (reduce || clock.at(5).sunEl < 5.4) && !body.classList.contains('wd-quiet') && !life.api.ceremony?.();
    $('.sv-enter').hidden = !ready;
    if (S.askFirst && W.owner === 'hold') { S.askFirst = false; clock.held = Math.max(clock.held, 90); enter(); if (S.askU != null) { S.u = S.uT = S.askU; } }
    if (!S.on) return;
    // (a long frame, or a review still, is taken in short steps: the way and the instant move as far as they should)
    const steps = Math.max(1, Math.min(240, Math.ceil(wall / 0.05))), h = wall / steps;
    const top = 1 + WIDE;
    for (let n = 0; n < steps; n++) {
      // along the ray: a speed that eases in and out (the way is exponential in distance, so this is a steady recession)
      const want = clamp((S.uT - S.u) * 2.4, -0.2, 0.2) * (reduce ? 4 : 1);
      S.v += clamp(want - S.v, -0.5 * h, 0.5 * h) * (reduce ? 4 : 1);
      if (Math.abs(S.uT - S.u) < 0.0005 && Math.abs(S.v) < 0.002) { S.u = S.uT; S.v = 0; } else S.u = clamp(S.u + S.v * h, 0, top);
      // the instant follows where it was sent (the sun is seen to travel there)
      const kf = 1 - Math.exp(-S.follow * h);
      S.doy += (S.doyT - S.doy) * kf; S.minutes += (S.minutesT - S.minutes) * kf;
      if (Math.abs(S.doyT - S.doy) < 0.02) S.doy = S.doyT;
      if (Math.abs(S.minutesT - S.minutes) < 0.05) S.minutes = S.minutesT;
      if (!S.dragging) S.leanT = [S.leanT[0] * Math.exp(-5 * h), S.leanT[1] * Math.exp(-5 * h)];
      const kl = 1 - Math.exp(-9 * h);
      S.lean = [S.lean[0] + (S.leanT[0] - S.lean[0]) * kl, S.lean[1] + (S.leanT[1] - S.lean[1]) * kl];
    }
    const day = daylight(S.doy); S.minutes = clamp(S.minutes, day.first, day.last);
    const I = inst();
    map.section?.setEvening?.(eveningAt(I.sunEl, I.minutes));
    body.classList.toggle('sv-seated', S.u > TURNED && !S.leaving);
    if (S.leaving && S.u <= 0.0005 && Math.abs(S.doyT - S.doy) < 0.03 && Math.abs(S.minutesT - S.minutes) < 0.3) finish();
  }
  function grow(g0) { return S.on ? growOn(S.doy, GROW) : g0; }
  // the school's shadow in the morning's mist: the lit air above its edge glows a little, the air under it does not
  const yihao = boxes.find((b) => b.id === 'yihao');
  function shadeAir(L) {
    const a = world.atmosphere?.uniforms;
    if (!a || !yihao) return;
    const misty = clamp((L.density - 0.003) / 0.012, 0, 1), low = 1 - smooth((L.sunEl - 30) / 25);
    a.uShade.value = 0.5 * misty * low * (proxy.visible ? proxy.scale.y : 0);
    a.uShadeBox.value.set(yihao.cx, yihao.cz, yihao.hw, yihao.hd);
    a.uShadeRT.value.set(Math.cos(yihao.rot), Math.sin(yihao.rot), yihao.y1);
  }
  function light(L) {
    if (!S.on) { shadeAir(L); return L; }
    const I = S.inst || inst(), day = daylight(I.doy);
    facts();
    const pp = gradeP(I.sunEl, I.minutes, day.noon, els);
    const G = ctx.lightAt(pp);
    G.sunAz = I.sunAz; G.sunEl = I.sunEl;
    const dk = duskAt(I.sunEl, I.minutes);
    if (dk > 0) ctx.duskGrade(G, dk);
    if (W.veil) ctx.morningAir(G, { minutes: I.minutes });
    life.light(G, pp);
    // from the seat: one deep, sharp lens; no shafts (they belong to looking into the light)
    const t = smooth(S.u / TURNED);
    G.aperture = (G.aperture || 0) * (1 - t);
    G.rays = (G.rays || 0) * (1 - 0.85 * t);
    // looking down a low sun's own light, everything in the picture is lit by it and by nothing else in front:
    // the last light's colour is the picture's colour (a deeper, redder sun; the frame a little lower in key)
    const low = (1 - smooth((I.sunEl - 6) / 14)) * t * (DBG.grade ?? 1);
    if (low > 0) {
      G.sunCol = G.sunCol.map((v, i) => v + ([1.0, 0.46, 0.2][i] - v) * 0.55 * low);
      G.I *= 1 + 0.18 * low; G.exposure *= 1 - 0.12 * low; G.contrast += 0.05 * low; G.warm += (0.95 - G.warm) * 0.5 * low; G.sat += 0.04 * low;
    }
    for (const k of Object.keys(G)) L[k] = G[k];
    shadeAir(L);
    S.grade = pp;
    return L;
  }
  const look = new THREE.Vector3();
  function cameraHook() {
    if (!S.on) return false;
    const I = S.inst || inst();
    const screen = DwellCamera.screen(camera);
    if (S.free) {
      const f = S.free;
      camera.position.set(f.eye[0], f.eye[1], f.eye[2]); camera.up.set(0, 1, 0); camera.lookAt(look.set(f.look[0], f.look[1], f.look[2]));
      camera.fov = f.fov || 40; camera.near = f.near || 0.08; camera.far = 1200; camera.updateProjectionMatrix();
      const a0 = world.atmosphere?.uniforms; if (a0) { a0.uSkip.value = 0; a0.uOppose.value = 0; }
      S.cam = null; culled.clear(); cullTrees(null);
      return true;
    }
    const wide = Math.pow(WIDE_K, clamp(S.u - 1, 0, WIDE) / WIDE);
    const c = seatCamera({ from: S.from, sun: I.dir, centre: centre(), half: halfFor(screen) * wide, subject: [trunk[0], 5, trunk[2]], pull: Math.min(1, S.u), lean: S.lean, keep: keep(), aspect: screen });
    S.cam = c;
    camera.position.set(c.eye[0], c.eye[1], c.eye[2]);
    camera.up.set(c.up[0], c.up[1], c.up[2]);
    camera.lookAt(look.set(c.target[0], c.target[1], c.target[2]));
    camera.fov = c.fov; camera.near = c.near; camera.far = c.far;
    DwellCamera.applyShift(camera);
    camera.updateProjectionMatrix();
    const a = world.atmosphere?.uniforms;
    if (a) { a.uSkip.value = DBG.noSkip ? 0 : Math.max(0, c.dist - c.d0); a.uOppose.value = DBG.noOppose ? 0 : 0.16 * c.turn; }
    if (distance) distance.visible = c.dist < 250;
    // a building the picture's near plane would cut through is left out whole (never a sliced block): it stands
    // further towards the sun than what the picture is about. map.js asks W.cull for each building when it sets the
    // lifts, so the campus's own shadow map leaves the same buildings out (no shadow without its caster)
    culled.clear();
    const sec = map.section;
    cullTrees(c);
    if (sec && c.dist > c.margin && !S.free) {
      const tgt = c.target, cd = [(c.eye[0] - tgt[0]) / c.dist, (c.eye[1] - tgt[1]) / c.dist, (c.eye[2] - tgt[2]) / c.dist];
      for (const b of sec.buildings) {
        if (b.id === 'yihao') continue;
        const cs = Math.cos(b.rot), sn = Math.sin(b.rot);
        let far = -Infinity;
        for (const [i, j] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) for (const y of [GROUND_Y, GROUND_Y + b.top]) {
          const x = b.cx + (i * b.w / 2) * cs + (j * b.d / 2) * sn, z = b.cz - (i * b.w / 2) * sn + (j * b.d / 2) * cs;
          far = Math.max(far, (x - tgt[0]) * cd[0] + (y - tgt[1]) * cd[1] + (z - tgt[2]) * cd[2]);
        }
        if (far > c.margin - 0.5) culled.add(b.index);
      }
    }
    syncUi();
    return true;
  }
  function after() {
    // (study C, look-dev: ?cone= metres of distance per whole spring of growth; the tree seen through slow light)
    if (DBG.cone) UNIFORMS.uCone.value.set(camera.position.x, camera.position.y, camera.position.z, 1 / DBG.cone);
    else if (UNIFORMS.uCone.value.w) UNIFORMS.uCone.value.w = 0;
    if (!S.on) return;
    // the walker stays where the film left them: it is their place the eye has left
    const f = life.api.figure, b = film6().body;
    f.group.visible = W.hud.body;
    f.setFirstPerson(S.u < 0.004);
    f.breathe = performance.now() / 1000;
    f.set({ ...b, show: true }, life.api.ground(b.x, b.z));
  }

  // ---------------------------------------------------------------- input
  ui.addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest('[data-sv]') : null;
    if (!b) return undefined;
    switch (b.dataset.sv) {
      case 'enter': return enter();
      case 'back': return leave('hold');
      case 'first': return leave('first');
      case 'shot': { const s = facts()[+b.dataset.i]; return goInstant(s.doy, s.minutes); }
      case 'noon': { const n = noon(); return goInstant(n.doy, n.minutes); }
      default: return undefined;
    }
  });
  const chart = $('.sv-chart');
  const chartSet = (e) => {
    const r = chart.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * 236, y = ((e.clientY - r.top) / r.height) * 124;
    goInstant(SPRING[0] + ((y - CH.y0) / (CH.y1 - CH.y0)) * (SPRING[1] - SPRING[0]), CH.m0 + ((x - CH.x0) / (CH.x1 - CH.x0)) * (CH.m1 - CH.m0), 7);
  };
  let charting = false;
  chart.addEventListener('pointerdown', (e) => { charting = true; chart.setPointerCapture?.(e.pointerId); chartSet(e); e.preventDefault(); });
  chart.addEventListener('pointermove', (e) => { if (charting) chartSet(e); });
  for (const t of ['pointerup', 'pointercancel']) chart.addEventListener(t, () => { charting = false; });

  addEventListener('keydown', (e) => {
    const t = e.target, inField = t instanceof Element && t.closest('input, textarea, select');
    if (inField || document.querySelector('dialog[open]')) return;
    if (W.owner === 'hold' && !S.on && e.code === 'Digit7' && !$('.sv-enter').hidden) { e.preventDefault(); enter(); return; }
    if (W.owner !== 'seventh' || !S.on) return;
    const step = e.shiftKey ? 3 : 1;
    switch (e.key) {
      case 'Escape': e.preventDefault(); leave('hold'); break;
      case 'ArrowLeft': e.preventDefault(); goInstant(S.doyT, S.minutesT - 10 * step, 7); break;
      case 'ArrowRight': e.preventDefault(); goInstant(S.doyT, S.minutesT + 10 * step, 7); break;
      case 'ArrowUp': e.preventDefault(); goInstant(S.doyT + 3 * step, S.minutesT, 7); break;
      case 'ArrowDown': e.preventDefault(); goInstant(S.doyT - 3 * step, S.minutesT, 7); break;
      case 'Home': e.preventDefault(); leave('first'); break;
      default:
        if (/^Digit[1-6]$/.test(e.code)) { e.preventDefault(); const s = facts()[+e.code.slice(5) - 1]; goInstant(s.doy, s.minutes); }
        else if (e.code === 'Digit0' || e.code === 'KeyN') { e.preventDefault(); const n = noon(); goInstant(n.doy, n.minutes); }
        else if ([' ', 'PageUp', 'PageDown', 'End'].includes(e.key)) e.preventDefault();
    }
  }, true);
  addEventListener('wheel', (e) => {
    if (W.owner !== 'seventh' || !S.on || S.leaving) return;
    if (e.target instanceof Element && e.target.closest('.sv-time')) return;
    const d = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
    S.uT = clamp(S.uT - d * 0.0011, 0, 1 + WIDE);
    if (S.uT <= 0.001 && d > 0) leave('hold');
  }, { passive: true });
  // a drag leans out of the light (it springs back); two fingers move along the ray
  const pts = new Map();
  let pinch = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (W.owner !== 'seventh' || !S.on || S.leaving) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType !== 'touch') canvas.setPointerCapture?.(e.pointerId);
    S.dragging = pts.size === 1;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p || !S.on) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch > 0) S.uT = clamp(S.uT - (d - pinch) * 0.003, 0.02, 1 + WIDE);
      pinch = d;
      return;
    }
    const k = (e.pointerType === 'touch' ? 0.0042 : 0.003);
    S.leanT = [clamp(S.leanT[0] - dx * k, -0.75, 0.75), clamp(S.leanT[1] + dy * k, -0.4, 0.5)];
  });
  const up = (e) => { if (!pts.delete(e.pointerId)) return; if (pts.size < 2) pinch = 0; S.dragging = pts.size === 1; };
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);

  // straight to the seat (review, and links): index.html?seventh=1#seventh
  if ((ctx.entry?.hash || location.hash) === '#seventh' || ctx.params?.has('seat')) {
    const u = parseFloat(ctx.params?.get('seat'));
    S.askFirst = true; S.askU = Number.isFinite(u) ? u : null;
    ctx.toSixth?.();
  }

  const api = {
    get on() { return S.on; }, get state() { return { on: S.on, u: S.u, uT: S.uT, lean: [...S.lean], doy: S.doy, minutes: S.minutes, leaving: S.leaving, label: S.inst?.label, sunEl: S.inst?.sunEl, sunAz: S.inst?.sunAz }; },
    get camera() { return S.cam && { ...S.cam }; }, get shots() { return facts().map((s) => ({ index: s.index, label: s.label, doy: s.doy, minutes: s.minutes, sunEl: s.sunEl, sunAz: s.sunAz, shadedBy: s.shadedBy, leaves: s.leaves, seen: s.seen })); },
    get proxy() { return { visible: proxy.visible, scale: proxy.scale.y }; },
    enter, leave, goInstant,
    /** review and tests: put the seat exactly somewhere (no easing) */
    set({ u, doy, minutes, lean } = {}) {
      if (u != null) { S.u = S.uT = u; S.v = 0; }
      if (doy != null || minutes != null) { const k = clampInstant(doy ?? S.doy, minutes ?? S.minutes); S.doy = S.doyT = k.doy; S.minutes = S.minutesT = k.minutes; }
      if (lean) { S.lean = [...lean]; S.leanT = [...lean]; S.dragging = true; } else if (lean === null) { S.dragging = false; S.lean = [0, 0]; S.leanT = [0, 0]; }
      inst();
    },
    /**
     * A work's own hour (seat.js hourOfLeaf): the instant of the spring when the sun looks most squarely at the
     * rosette its address names. Read off the tree and the ephemeris; nothing of the work is touched.
     * goWork(address) sends the seat there. (No interface yet: the works canopy has no public works.)
     */
    hourOf(address) {
      slotTable ||= buildSlots(world.rosettes, world.stride);
      const i = resolve(address, slotTable);
      if (i == null) return null;
      const o = i * world.stride, r = world.rosettes;
      return hourOfLeaf([r[o], r[o + 1], r[o + 2]], [r[o + 3], r[o + 4], r[o + 5]], boxes, rotation);
    },
    goWork(address) { const h = api.hourOf(address); if (h && S.on) goInstant(h.doy, h.minutes); return h && { label: h.label, sunEl: h.sunEl, facing: h.facing }; },
    /** look-dev: a camera anywhere at the seat's instant ({ eye, look, fov }; null: back to the ray) */
    free(f) { S.free = f || null; },
    line: () => $('.sv-line').textContent, noon, get grade() { return S.grade; }, debug: DBG
  };
  return { tick, grow, light, camera: cameraHook, after, api };
}
