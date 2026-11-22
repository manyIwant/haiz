// HAIZ · 自由共游 — the free campus: the ride, the world's answer to it, the margin's notes, the sketchbook.
// One object the 入画 director (lanren/free/main.js) asks each frame; everything else hangs off it.
import * as THREE from 'three';
import { createRig } from './rig.js';
import { createRide, MODES } from './ride.js';
import { createInput } from './input.js';
import { createParticles } from './particles.js';
import { createHud } from './hud.js';
import { createRoute } from './route.js';
import { INKS } from '../life/map.js';
import { createVistas } from './vistas.js';
import { createAudio } from './audio.js';
import { haikouClock } from '../ruhua/weather/model.js';

// the campus's (fictional) people notice how you go by — each in their own voice
const REACT = {
  lin: { bike: ['骑慢点，别压到草。', '车筐里可以放一盆薄荷。'], bell: ['听见啦。'], board: ['小心台阶。'], broom: ['……那是吴伯的扫帚吧？', '从上面看，榄仁树是什么样子？'] },
  chen: { bike: ['借我骑一圈！', '比比谁先到篮球场？'], bell: ['叮什么叮，我让！'], board: ['Ollie 再高一点！'], broom: ['哇——带我一个！'] },
  fu: { bike: ['校园里骑车，慢一点。'], bell: ['嗯，有礼貌。'], board: ['注意动量守恒，别摔。'], broom: ['升力从哪儿来的？下来跟我讲讲。'] },
  wang: { bike: ['（从书里抬起头）……'], bell: ['啊，抱歉，我挡路了。'], board: ['……好吵。'], broom: ['像书里写的那样。'] },
  wu: { bike: ['停车要停整齐。'], bell: ['好好好，让你。'], board: ['别在台阶上溜。'], broom: ['哎——我的扫帚！用完记得还回来。', '飞稳点，别把叶子都扫下来。'] },
};

const $ = (s) => document.querySelector(s);

export function createFree(ctx) {
  const { world, student, canvas, layer, coarse } = ctx;
  const rig = createRig(student);
  const input = createInput({ dom: canvas, stickEl: $('#rh-stick'), padEl: $('#fr-pad') });
  // lawn or paving under a point: the walk's lawn mask (painted once from the plan)
  const mask = world.ground.mask;
  const md = mask.g.getImageData(0, 0, mask.c.width, mask.c.height).data, mw = mask.c.width;
  const surface = (x, z) => {
    const u = (x - mask.x0) / mask.span, v = (z - mask.z0) / mask.span;
    if (u < 0 || v < 0 || u >= 1 || v >= 1) return 'pave';
    return md[(Math.floor(v * mw) * mw + Math.floor(u * mw)) * 4] > 110 ? 'lawn' : 'pave';
  };
  const listeners = [];
  const ride = createRide({
    world, student, rig, input, followCam: ctx.followCam, layer,
    player: ctx.player, heightAt: ctx.heightAt, getColliders: ctx.getColliders, surface,
    onEvent: (name, data) => { for (const f of listeners) f(name, data); },
  });

  // ---------------------------------------------------------------- the mode bar (bottom centre) and keys
  const bar = $('#fr-modes');
  const pad = $('#fr-pad');
  const prompt = $('#fr-prompt');
  const KEYS = { Digit1: 'walk', Digit2: 'bike', Digit3: 'board', Digit4: 'broom', Numpad1: 'walk', Numpad2: 'bike', Numpad3: 'board', Numpad4: 'broom' };
  bar?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]');
    if (!b || !enabled) return;
    const m = b.dataset.mode;
    ride.request(m === ride.mode && m !== 'walk' ? 'walk' : m);
  });
  let enabled = false;
  addEventListener('keydown', (e) => {
    if (!enabled || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return;
    if (KEYS[e.code]) { const m = KEYS[e.code]; ride.request(m === ride.mode && m !== 'walk' ? 'walk' : m); }
    if (e.code === 'KeyE' && ride.mode === 'walk') { const P = ctx.player().state; if (ride.nearParked(P.pos.x, P.pos.z)) ride.request('bike'); }
    if (e.code === 'KeyV' && ride.riding) ride.toggleView();
  });
  function syncBar() {
    if (!bar) return;
    const m = ride.mode, ph = ride.phase;
    for (const b of bar.querySelectorAll('[data-mode]')) {
      const on = b.dataset.mode === (ride.state.want && ph !== 'ride' ? ride.state.want : m);
      b.setAttribute('aria-pressed', String(on));
    }
    document.body.dataset.ride = ph === 'free' ? 'walk' : m;
    if (pad) pad.dataset.mode = ph === 'ride' || ph === 'mount' ? m : 'none';
  }

  // ---------------------------------------------------------------- the world's answer
  const particles = createParticles({ world, wake: ctx.wake, layer, max: coarse ? 380 : 760 });
  const feedState = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), mode: 'walk', agl: 0, speed: 0, inCrown: 0, surface: 'pave' };
  function worldStep(dt, S) {
    const R = ride.state;
    const riding = ride.riding;
    const P = ctx.player().state;
    feedState.pos.copy(riding ? R.pos : P.pos);
    feedState.vel.copy(riding ? R.vel : new THREE.Vector3(P.vel.x, 0, P.vel.y));
    feedState.mode = riding && ride.phase !== 'summon' ? ride.mode : 'walk';
    feedState.agl = riding && ride.mode === 'broom' ? R.agl : 0;
    feedState.speed = Math.hypot(feedState.vel.x, feedState.vel.z);
    feedState.inCrown = riding && ride.mode === 'broom' ? R.inCrown : 0;
    feedState.surface = surface(feedState.pos.x, feedState.pos.z);
    ctx.wake.feed(dt, feedState, ctx.UNIFORMS, S.time);
    particles.update(dt, feedState, ctx.camera.position);
  }

  // ---------------------------------------------------------------- the margin: compass, reading, the way
  const route = createRoute({ world, layer });
  const hud = createHud({ world, nav: ctx.nav, life: ctx.life, root: $('#fr-hud'), coarse, onRoute: (r) => {
    if (r && r.arrived) { ctx.ui.line?.('到了', r.arrived); route.set(null); return; }
    route.set(r);
  } });
  addEventListener('keydown', (e) => { if (enabled && e.code === 'KeyN' && !(e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) hud.toggleSlip(); });
  const people = [];
  function hudState(dt) {
    const R = ride.state, P = ctx.player().state, riding = ride.riding;
    people.length = 0;
    for (const a of ctx.life.agents) { const s = a.live || a.state; if (s && !a.state?.inside && !a.state?.away) people.push({ x: s.x, z: s.z, ink: INKS[a.id] || '#333' }); }
    const camYaw = riding ? ride.cam.yaw : ctx.player().cam.yaw.v;
    return {
      pos: riding ? R.pos : P.pos, speed: riding ? R.speed : P.speed, mode: riding && ride.phase !== 'summon' ? ride.mode : 'walk', riding: riding && ride.phase !== 'dismount',
      yaw: camYaw, heading: riding ? R.yaw : P.yaw, agl: R.agl, cadence: R.cadence * 60 / (Math.PI * 2), pushes: R.pushes, parked: R.parked, people,
    };
  }
  // ---- a word from someone you ride past (rate-limited; never more than one at a time)
  let lastWord = -99, clock = 0;
  const said = new Map();
  function react(kind) {
    if (clock - lastWord < 9) return;
    const R = ride.state;
    for (const [id, b] of ctx.people.bodies || []) {
      if (!b.active || b.fade < 0.9) continue;
      const fp = b.fig.position;
      const d = Math.hypot(fp.x - R.pos.x, fp.z - R.pos.z);
      const dy = R.pos.y - fp.y;
      const near = kind === 'broom' ? d < 9 && dy > 1.5 && dy < 12 : kind === 'bell' ? d < 10 : d < 3.2;
      if (!near) continue;
      const lines = REACT[id]?.[kind];
      if (!lines) continue;
      const k = id + kind;
      if (clock - (said.get(k) ?? -999) < 90) continue;
      said.set(k, clock); lastWord = clock;
      const n = (said.size + Math.floor(clock)) % lines.length;
      ctx.ui.line?.(ctx.life.byId.get(id).person.name, lines[n]);
      b.fig.lookAt?.(0, kind === 'broom' ? 0.6 : 0, 0.9);
      break;
    }
  }
  ride.state.reactT = 0;
  listeners.push((name) => { if (name === 'bell') react('bell'); });

  // ---------------------------------------------------------------- sound
  const audio = createAudio();
  listeners.push((name, data) => audio.event(name, data));
  $('#fr-sound')?.addEventListener('click', (e) => { const on = audio.toggle(); e.currentTarget.setAttribute('aria-pressed', String(on)); e.currentTarget.querySelector('span').textContent = on ? '声音' : '静音'; });

  // ---------------------------------------------------------------- 海中八景
  const vistaEl = $('#fr-vista');
  const vistas = createVistas({ root: $('#fr-book'), button: $('#fr-book-btn'), prompt: vistaEl, onSketch: (v, url) => { flyPage(url, v); audio.event('sketch'); } });
  let wantSketch = false;
  vistaEl?.querySelector('[data-vista="sketch"]').addEventListener('click', () => { wantSketch = !!vistas.current; });
  addEventListener('keydown', (e) => { if (enabled && e.code === 'KeyF' && vistas.current && !(e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) wantSketch = true; });
  function flyPage(url, v) {
    const img = $('#fr-fly'), btn = $('#fr-book-btn');
    if (!img) return;
    img.src = url; img.hidden = false; img.style.transition = 'none';
    img.style.left = '50%'; img.style.top = '50%'; img.style.opacity = '1'; img.style.transform = 'translate(-50%, -50%) rotate(-2deg) scale(1)';
    ctx.ui.line?.('速写', `「${v.name}」画进了速写本`);
    setTimeout(() => {
      const r = btn?.getBoundingClientRect();
      img.style.transition = '';
      if (r && r.width) { img.style.left = (r.left + r.width / 2) + 'px'; img.style.top = (r.top + r.height / 2) + 'px'; }
      img.style.transform = 'translate(-50%, -50%) rotate(6deg) scale(0.08)'; img.style.opacity = '0.2';
      setTimeout(() => { img.hidden = true; }, 1150);
    }, 1400);
  }
  const lookDir = new THREE.Vector3();
  function vistaState() {
    const R = ride.state, riding = ride.riding && ride.phase === 'ride';
    const p = riding ? R.pos : ctx.player().state.pos;
    const W = ctx.weather.state;
    const crown = world.crowns[world.crowns.length - 1];
    const lx = (p.x - crown.x) / crown.r, ly = (p.y - crown.y) / crown.ry, lz = (p.z - crown.z) / crown.r;
    const mode = riding ? ride.mode : 'walk';
    const top = ride.solids.topAt(p.x, p.z);
    ctx.camera.getWorldDirection(lookDir);
    return {
      mode, x: p.x, z: p.z, agl: mode === 'broom' ? R.agl : 0, speed: riding ? R.speed : ctx.player().state.speed,
      hours: haikouClock(W.clock).hours, raining: Math.max(W.rainNow, W.cur.rain) > 0.15,
      onRoof: mode === 'broom' && top > world.geo.frame.ground + 3 && Math.abs(p.y - top) < 1.6,
      inLanshu: mode === 'broom' ? Math.max(0, 1 - (lx * lx + ly * ly + lz * lz)) : 0,
      lookUp: lookDir.y > 0.22,
    };
  }

  const pos = new THREE.Vector3();
  return {
    hud, route, vistas, audio,
    /** after the frame is drawn: a requested sketch reads it now (the drawing buffer is still intact) */
    afterRender(glCanvas) {
      if (!wantSketch) return;
      wantSketch = false;
      const c = ctx.weather.caption();
      const k = haikouClock(ctx.weather.state.clock);
      vistas.sketch(glCanvas, `${k.m} 月 ${k.d} 日 ${c.clock} · 海口 ${c.name} ${c.temp}°`);
    },
    particles, world: worldStep,
    rig, ride, input, surface,
    on(f) { listeners.push(f); },
    setEnabled(v) { enabled = v; document.body.classList.toggle('fr-on', v); },
    /** where the student is (walking or riding) */
    get position() { return ride.riding ? ride.state.pos : ctx.player().state.pos; },
    get speed() { return ride.state.speed; },
    get velocity() { return ride.state.vel; },
    get mode() { return ride.riding ? ride.mode : 'walk'; },
    update(dt) {
      ride.update(dt);
      syncBar();
      // a prompt by the parked bike
      if (prompt) {
        const P = ctx.player().state;
        const near = !ride.riding && ride.nearParked(P.pos.x, P.pos.z);
        prompt.hidden = !near;
        if (near) prompt.textContent = coarse ? '轻点「骑」骑上单车' : '按 E 骑上单车';
      }
      pos.copy(this.position);
      clock += dt;
      const hs = hudState(dt);
      hud.update(dt, hs);
      route.update(dt, hs.pos);
      vistas.update(dt, vistaState());
      {
        const R = ride.state, riding = ride.riding && ride.phase !== 'summon';
        audio.update(dt, { mode: riding ? ride.mode : 'walk', speed: riding ? R.speed : ctx.player().state.speed, surface: feedState.surface, air: R.air, inCrown: riding ? R.inCrown : 0, coasting: R.pedalling < 0.5, boost: R.boost });
      }
      // riding past people: a bike or board going briskly close by, a broom passing over
      if (ride.riding && ride.phase === 'ride') {
        const m = ride.mode, R = ride.state;
        if ((m === 'bike' && R.speed > 3) || (m === 'board' && R.speed > 2.5) || (m === 'broom' && R.agl > 1.5)) react(m);
      }
    },
  };
}
export { MODES };
