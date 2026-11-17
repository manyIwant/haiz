// HAIZ · 动作实验室 — a place to look at a walk, not at a campus.
//
// The walker on a measuring floor (0.5 m grid), driven by the same player controller as the walk,
// seen at once from the side, the front, behind and a high three-quarter view. A script of inputs
// (start, walk, stop, turn, reverse, run, jump) plays identically for every figure, so the old and the
// new walk can be compared frame by frame. Under the views, a gait chart: each foot's height, the
// pelvis, the speed, and how far a foot slides while it is supposed to be standing — the one number
// that most often makes a walk look wrong.
//
//   walker-lab.html?figure=new|v1|v2  &seq=all|walk|turn|run|jump|stop  &view=quad|side|front|back|three
import * as THREE from 'three';
import { U, cel } from '../ruhua-stroll/atmos.js';
import { createPlayer as createOldPlayer } from '../ruhua-stroll/player.js';
import { createPlayer as createNewPlayer } from './player.js';

const Q = new URLSearchParams(location.search);
const ROOT = new URL('../', import.meta.url);
const asset = (p) => new URL(p, ROOT).href;

// ---------------------------------------------------------------- the scripts (seconds, held keys, camera yaw)
// camera yaw 0 = the camera looks along +Z, so W walks +Z, A walks +X (screen left is +X when looking +Z)
const SEQ = {
  start: [[1.2, [], 'standing'], [3.2, ['KeyW'], 'start · walk'], [2.2, [], 'stop'], [0.6, [], 'settle']],
  walk: [[0.6, [], 'standing'], [6, ['KeyW'], 'walk'], [1.6, [], 'stop']],
  turn: [[0.6, [], 'standing'], [2.2, ['KeyW'], 'walk'], [2.4, ['KeyA'], 'turn 90° left'], [2.4, ['KeyW'], 'turn back'], [2.0, ['KeyS'], 'reverse 180°'], [1.6, [], 'stop'], [0.4, ['KeyD'], 'tap right (in place)'], [1.6, [], 'settle']],
  run: [[0.6, [], 'standing'], [1.4, ['KeyW'], 'walk'], [3.0, ['KeyW', 'ShiftLeft'], 'run'], [1.6, ['KeyW'], 'slow to walk'], [1.8, [], 'stop']],
  jump: [[0.8, [], 'standing'], [0.05, ['Space'], 'jump'], [1.6, [], 'land'], [1.4, ['KeyW', 'ShiftLeft'], 'run'], [0.05, ['KeyW', 'ShiftLeft', 'Space'], 'running jump'], [1.4, ['KeyW', 'ShiftLeft'], 'land, run on'], [1.6, [], 'stop']],
};
SEQ.all = [...SEQ.start, ...SEQ.turn.slice(1), ...SEQ.run.slice(1), ...SEQ.jump.slice(1)];

const VIEWS = {
  side: { off: [4.6, 1.15, 0], at: [0, 0.95, 0], fov: 32, label: '侧 side' },
  front: { off: [0, 1.2, 4.6], at: [0, 0.95, 0], fov: 32, label: '正 front' },
  back: { off: [0, 1.4, -4.6], at: [0, 0.95, 0], fov: 32, label: '背 back' },
  three: { off: [3.4, 2.6, 3.2], at: [0, 0.85, 0], fov: 34, label: '斜 three-quarter' },
};

async function main() {
  const figure = Q.get('figure') || 'new';
  const seqName = SEQ[Q.get('seq')] ? Q.get('seq') : 'all';
  const viewMode = Q.get('view') || 'quad';
  const canvas = document.querySelector('#lab-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: Q.has('capture') });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#c9d3ce');

  // light: one sun, as the walk has it (cel shading reads U.uSunDir)
  const sunDir = new THREE.Vector3(0.45, 0.8, 0.35).normalize();
  U.uSunDir.value.copy(sunDir);
  U.uDepthTint.value = 0; U.uFogMax.value = 0; U.uCloudShadow.value = 0;
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 30 });
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  // the measuring floor: 0.5 m lines, 1 m stronger, 5 m strongest
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), cel({
    name: 'lab-floor', key: 'lab-floor', color: new THREE.Color('#7f8a80'),
    fragment: { albedo: /* glsl */`
vec2 g = vWP.xz;
float l1 = 1.0 - smoothstep(0.0, 0.012, min(abs(fract(g.x * 2.0 + 0.5) - 0.5), abs(fract(g.y * 2.0 + 0.5) - 0.5)) / 2.0);
float l2 = 1.0 - smoothstep(0.0, 0.02, min(abs(fract(g.x + 0.5) - 0.5), abs(fract(g.y + 0.5) - 0.5)));
float l5 = 1.0 - smoothstep(0.0, 0.03, min(abs(fract(g.x / 5.0 + 0.5) - 0.5), abs(fract(g.y / 5.0 + 0.5) - 0.5)) * 5.0);
albedo *= 1.0 - 0.1 * l1 - 0.16 * l2 - 0.2 * l5;
` },
  }));
  floor.receiveShadow = true;
  scene.add(floor);

  // ---------------------------------------------------------------- the figure
  let walker;
  if (figure === 'v1') walker = await (await import('./legacy/walker-v1.js')).createWalker(asset('assets/ruhua/student.glb'));
  else if (figure === 'v2') walker = await (await import('../ruhua-stroll/student.js')).createStudent(asset('assets/toon/student.glb'));
  else walker = await (await import('./gait.js')).createWalker(asset('assets/ruhua/student.glb'));
  scene.add(walker.root);
  walker.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  // footprints: where each contact began (static in the world, so a sliding foot shows against them)
  const prints = new THREE.InstancedMesh(new THREE.CircleGeometry(0.05, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#2d5c55', transparent: true, opacity: 0.55, depthWrite: false }), 600);
  prints.count = 0; prints.renderOrder = 3; prints.frustumCulled = false;
  scene.add(prints);
  const slideLines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6000 * 6), 3)), new THREE.LineBasicMaterial({ color: '#c0392b' }));
  slideLines.geometry.setDrawRange(0, 0); slideLines.frustumCulled = false;
  scene.add(slideLines);
  let slideN = 0;

  // ---------------------------------------------------------------- the controller: the walk's own
  const dummyCam = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  const createPlayer = figure === 'new' ? createNewPlayer : createOldPlayer;
  const player = createPlayer({ camera: dummyCam, dom: canvas, student: walker, getColliders: () => null, heightAt: () => 0, spawn: { x: 0, z: 0, yaw: 0 }, coarse: false });
  const held = new Set();
  const setKeys = (want) => {
    for (const k of [...held]) if (!want.includes(k)) { dispatchEvent(new KeyboardEvent('keyup', { code: k })); held.delete(k); }
    for (const k of want) if (!held.has(k)) { dispatchEvent(new KeyboardEvent('keydown', { code: k })); held.add(k); }
  };

  // ---------------------------------------------------------------- measuring
  const bones = {};
  for (const s of ['L', 'R']) {
    bones[s] = { foot: walker.root.getObjectByName('foot' + s), toe: walker.root.getObjectByName('toe' + s) };
  }
  const hips = walker.root.getObjectByName('hips');
  walker.root.updateMatrixWorld(true);
  // contact points, fixed to the foot: the heel (under the ankle) and the ball (under the toe joint), taken
  // from the standing pose at load and carried by the foot and toe bones from then on. A foot that rolls
  // heel → flat → toe pivots about one of them; a foot that slides moves both.
  const contact = {};
  for (const s of ['L', 'R']) {
    const b = bones[s];
    const a = b.foot.getWorldPosition(new THREE.Vector3());
    const heel = b.foot.worldToLocal(new THREE.Vector3(a.x, 0, a.z));
    let ball = null;
    if (b.toe) { const t = b.toe.getWorldPosition(new THREE.Vector3()); ball = b.toe.worldToLocal(new THREE.Vector3(t.x, 0, t.z)); }
    contact[s] = { heel, ball };
  }
  const M = { t: 0, frames: 0, contactFrames: 0, slideSum: 0, slideMax: 0, slidingFrames: 0, perSeg: {}, hist: [], feet: { L: { c: false }, R: { c: false } } };
  const v = new THREE.Vector3();
  const dummy = new THREE.Object3D();
  const DOWN = 0.015;
  function measure(dt, seg) {
    walker.root.updateMatrixWorld(true);
    const row = { t: M.t, speed: player.state.speed, hip: hips.getWorldPosition(v).y, seg };
    for (const s of ['L', 'R']) {
      const b = bones[s], F = M.feet[s];
      const heel = b.foot.localToWorld(contact[s].heel.clone());
      const ball = b.toe ? b.toe.localToWorld(contact[s].ball.clone()) : heel.clone();
      const h = Math.min(heel.y, ball.y);
      row['h' + s] = Math.max(0, h);
      // down = touching and not still descending onto the ground (a heel 1 cm up, coming down at
      // touchdown, is the end of the swing, not a slide)
      const vyH = F.heel ? (heel.y - F.heel.y) / dt : 0, vyB = F.ball ? (ball.y - F.ball.y) / dt : 0;
      const downH = heel.y < DOWN && Math.abs(vyH) < 0.12, downB = ball.y < DOWN && Math.abs(vyB) < 0.12;
      const c = (downH || downB) && !player.state.airborne;
      row['c' + s] = c;
      if (c) {
        M.contactFrames++;
        if (F.c && M.t > 0.25) {
          let sp = Infinity;
          if (downH && F.downH) sp = Math.min(sp, Math.hypot(heel.x - F.heel.x, heel.z - F.heel.z) / dt);
          if (downB && F.downB) sp = Math.min(sp, Math.hypot(ball.x - F.ball.x, ball.z - F.ball.z) / dt);
          if (sp === Infinity) sp = 0;                       // heel → ball hand-over: one lifted, the other just landed
          row['s' + s] = sp;
          M.slideSum += sp; M.slideMax = Math.max(M.slideMax, sp);
          const p = downH ? heel : ball, q = downH ? F.heel : F.ball;
          if (sp > 0.12) {
            M.slidingFrames++;
            if (slideN < 6000) {
              const a = slideLines.geometry.attributes.position.array;
              a.set([q.x, 0.012, q.z, p.x, 0.012, p.z], slideN * 6); slideN++;
              slideLines.geometry.setDrawRange(0, slideN * 2); slideLines.geometry.attributes.position.needsUpdate = true;
            }
          }
          const ps = M.perSeg[seg] || (M.perSeg[seg] = { contact: 0, slide: 0, sliding: 0 });
          ps.contact++; ps.slide += sp; if (sp > 0.12) ps.sliding++;
        } else if (!F.c && prints.count < 600) {
          const p = downH ? heel : ball;
          dummy.position.set(p.x, 0.008, p.z); dummy.updateMatrix(); prints.setMatrixAt(prints.count++, dummy.matrix); prints.instanceMatrix.needsUpdate = true;
        }
      }
      F.heel = heel; F.ball = ball; F.downH = downH; F.downB = downB;
      F.c = c;
    }
    M.hist.push(row);
    if (M.hist.length > 2400) M.hist.shift();
    M.frames++;
  }

  // ---------------------------------------------------------------- the gait chart
  const chart = document.querySelector('#lab-chart');
  const cx = chart.getContext('2d');
  function drawChart() {
    const W = chart.width = chart.clientWidth * devicePixelRatio, H = chart.height = chart.clientHeight * devicePixelRatio;
    cx.clearRect(0, 0, W, H);
    const span = 6, t1 = M.t, t0 = t1 - span;
    const X = (t) => ((t - t0) / span) * W;
    const rows = M.hist.filter((r) => r.t >= t0);
    const lane = (y0, y1, val, color, lo, hi, dash) => {
      cx.strokeStyle = color; cx.lineWidth = 1.5 * devicePixelRatio; cx.setLineDash(dash ? [4, 4] : []);
      cx.beginPath();
      rows.forEach((r, i) => { const y = y1 - ((val(r) - lo) / (hi - lo)) * (y1 - y0); i ? cx.lineTo(X(r.t), y) : cx.moveTo(X(r.t), y); });
      cx.stroke();
    };
    const h = H;
    // contact bars
    for (const [s, y, col] of [['L', 0.04, '#3b6ea8'], ['R', 0.12, '#d9822b']]) {
      cx.fillStyle = col;
      for (const r of rows) if (r['c' + s]) cx.fillRect(X(r.t), h * y, Math.max(1, W / (span * 30)), h * 0.06);
      cx.fillStyle = '#c0392b';
      for (const r of rows) if ((r['s' + s] || 0) > 0.12) cx.fillRect(X(r.t), h * y, Math.max(1, W / (span * 30)), h * 0.06);
    }
    lane(h * 0.22, h * 0.62, (r) => r.hL, '#3b6ea8', 0, 0.3);
    lane(h * 0.22, h * 0.62, (r) => r.hR, '#d9822b', 0, 0.3);
    lane(h * 0.66, h * 0.96, (r) => r.hip, '#55606a', 0.78, 0.98);
    lane(h * 0.22, h * 0.96, (r) => r.speed, '#3f8f5a', 0, 5.2, true);
    cx.setLineDash([]);
    cx.fillStyle = '#2b3033'; cx.font = `${11 * devicePixelRatio}px system-ui`;
    cx.fillText('contact L / R  (red = sliding > 0.12 m/s)', 6, h * 0.035 + 11 * devicePixelRatio * 0.2);
    cx.fillText('lowest contact point of each foot (0–30 cm)', 6, h * 0.27);
    cx.fillText('pelvis height · speed (dashed, 0–5 m/s)', 6, h * 0.71);
  }

  // ---------------------------------------------------------------- views
  const cams = {};
  for (const k of Object.keys(VIEWS)) cams[k] = new THREE.PerspectiveCamera(VIEWS[k].fov, 1, 0.05, 200);
  const layout = () => {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (viewMode !== 'quad') return [{ k: viewMode, x: 0, y: 0, w: W, h: H }];
    const hw = W / 2, hh = H / 2;
    return [{ k: 'side', x: 0, y: hh, w: hw, h: hh }, { k: 'front', x: hw, y: hh, w: hw, h: hh }, { k: 'back', x: 0, y: 0, w: hw, h: hh }, { k: 'three', x: hw, y: 0, w: hw, h: hh }];
  };
  const labels = document.querySelector('#lab-labels');
  function resize() {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    labels.innerHTML = layout().map((l) => `<span style="left:${l.x + 8}px;bottom:${l.y + l.h - 24}px">${VIEWS[l.k].label}</span>`).join('');
  }
  addEventListener('resize', resize);
  resize();

  function render() {
    const p = walker.position || walker.root.position;
    sun.position.set(p.x + sunDir.x * 10, sunDir.y * 10, p.z + sunDir.z * 10); sun.target.position.set(p.x, 0, p.z);
    renderer.setScissorTest(true);
    for (const l of layout()) {
      const c = cams[l.k], V = VIEWS[l.k];
      c.aspect = l.w / l.h; c.updateProjectionMatrix();
      c.position.set(p.x + V.off[0], V.off[1], p.z + V.off[2]);
      c.lookAt(p.x + V.at[0], V.at[1], p.z + V.at[2]);
      renderer.setViewport(l.x, l.y, l.w, l.h); renderer.setScissor(l.x, l.y, l.w, l.h);
      renderer.render(scene, c);
    }
    renderer.setScissorTest(false);
    drawChart();
  }

  // ---------------------------------------------------------------- the script
  const script = SEQ[seqName];
  const total = script.reduce((a, s) => a + s[0], 0);
  let segI = 0, segT = 0;
  const hud = document.querySelector('#lab-hud');
  function step(dt) {
    const seg = script[segI];
    setKeys(seg[1]);
    player.state.lastLook = player.state.time;              // the camera never swings: inputs stay world-fixed
    player.state.camYaw = 0;
    player.update(dt);
    M.t += dt;
    measure(dt, seg[2]);
    segT += dt;
    if (segT >= seg[0]) { segT = 0; segI = (segI + 1) % script.length; if (segI === 0 && !Q.has('capture')) restart(); }
    const avg = M.contactFrames ? M.slideSum / M.contactFrames : 0;
    hud.innerHTML = `<b>${figure === 'new' ? '新 · new walk' : figure === 'v1' ? '旧 · 入画 v1 (程序化)' : '旧 · V2 漫游 (clips)'}</b> <span>${seg[2]}</span> <span>${player.state.speed.toFixed(2)} m/s</span>` +
      `<span>foot slide in stance: mean ${(avg * 100).toFixed(1)} cm/s · max ${(M.slideMax * 100).toFixed(0)} cm/s · sliding ${(M.contactFrames ? (100 * M.slidingFrames) / M.contactFrames : 0).toFixed(1)}%</span>`;
  }
  function restart() {
    player.place(0, 0, 0);
    prints.count = 0; slideN = 0; slideLines.geometry.setDrawRange(0, 0);
  }

  const clock = new THREE.Clock();
  let paused = Q.has('capture');
  function frame() {
    const dt = Math.min(clock.getDelta(), 1 / 20);
    if (!paused) { step(dt); render(); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  document.body.dataset.ready = '1';
  window.__lab = {
    walker, player, M, total, figure,
    /** capture: advance n frames at fps and draw once */
    advance(n = 1, fps = 30) { for (let i = 0; i < n; i++) step(1 / fps); render(); return { t: M.t, seg: script[segI][2] }; },
    pause(v = true) { paused = v; clock.getDelta(); },
    summary() {
      const per = {};
      for (const [k, s] of Object.entries(M.perSeg)) per[k] = { meanSlideCm: +((100 * s.slide) / Math.max(1, s.contact)).toFixed(2), slidingPct: +((100 * s.sliding) / Math.max(1, s.contact)).toFixed(1) };
      return { figure, frames: M.frames, meanSlideCm: +((100 * M.slideSum) / Math.max(1, M.contactFrames)).toFixed(2), maxSlideCm: +(M.slideMax * 100).toFixed(1), slidingPct: +((100 * M.slidingFrames) / Math.max(1, M.contactFrames)).toFixed(2), per };
    },
  };
}

main().catch((e) => { console.error(e); document.querySelector('#lab-hud').textContent = '无法启动：' + (e.message || e); });
