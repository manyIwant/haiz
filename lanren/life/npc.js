// HAIZ · 校园里的人，在三维里 — the bodies of the people in lanren/life/people.js.
//
// The day (lanren/life/life.js) says where each person is at every minute. When one of them is within
// sight of the player, a body (lanren/life/gait.js: the same walk as the player's, with their own pace,
// posture and clothes) walks that same path: it steers a little ahead of where the day has them, slows
// or hurries to stay with it, goes round the player instead of through them, and at a door dissolves
// into the building (the way the painting arrived: a breakup in world space, not a fade). Far away, or
// indoors, there is no body — only the day, which the map reads.
//
// Toward the player they are people, not quest-givers: a glance when you come close, now and then a few
// words (said once, under a cooldown), never a stop to wait for you.
import * as THREE from 'three';
import { createWalker } from './gait.js';
import { cel } from '../ruhua-stroll/atmos.js';
import { move } from '../world/collide.js';

const clamp = THREE.MathUtils.clamp;
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const ON = 72, OFF = 88;                // activation radius (m) and its hysteresis

export function createPeople({ life, url, heightAt, getColliders, layer = 0, mobile = false, say = () => {} }) {
  const group = new THREE.Group();
  group.name = 'campus-people';
  const tmp = new THREE.Vector3();
  const bodies = new Map();             // id → { fig, active, fade, ... }
  let loading = 0, lastLineAt = -1e9;
  const MAX = mobile ? 4 : 6;

  async function makeBody(agent) {
    const P = agent.person, F = P.figure;
    const st = agent.state;
    const fig = await createWalker(url, {
      heightAt, x: st.x, z: st.z, yaw: st.yaw || 0, palette: F, fade: true, umbrella: !!P.umbrella,
      config: { walkSpeed: P.speed, ...(P.gait.config || {}) }, basic: P.gait.basic, seed: P.gait.seed,
    });
    if (P.gait.preset) fig.human.applyPreset(P.gait.preset, { walkSpeed: P.speed, ...(P.gait.config || {}) });
    if (F.scale && F.scale !== 1) fig.model.scale.setScalar(F.scale);
    accessories(fig, F.acc || [], P);
    fig.root.traverse((o) => o.layers.set(layer));
    group.add(fig.root);
    const b = { fig, props: fig._props, active: false, fade: 0, glance: 0, glanced: false, lastLine: -1e9, steps: [], stuck: 0 };
    fig.on('footstep', ({ side, position }) => {
      b.steps.push({ x: position.x, z: position.z, yaw: fig.heading, side: side === 'left' ? 1 : -1, t: performance.now(), run: fig.human.runBlend > 0.5 });
      if (b.steps.length > 400) b.steps.shift();
    });
    return b;
  }

  function update(dt, ms, ctx) {
    const { player, rain, hours } = ctx;
    const col = getColliders();
    // who should have a body: the nearest outdoors, within reach
    const want = life.agents.filter((a) => !a.state.away && Math.hypot(a.state.x - player.x, a.state.z - player.z) < (bodies.get(a.id)?.active ? OFF : ON)
      && (!a.state.inside || bodies.get(a.id)?.active))
      .sort((a, b) => Math.hypot(a.state.x - player.x, a.state.z - player.z) - Math.hypot(b.state.x - player.x, b.state.z - player.z))
      .slice(0, MAX);
    const wantIds = new Set(want.map((a) => a.id));
    for (const a of want) {
      if (!bodies.has(a.id)) {
        if (loading) continue;
        loading++;
        makeBody(a).then((b) => { bodies.set(a.id, b); }).catch((e) => console.warn('people: body', a.id, e)).finally(() => { loading--; });
        continue;
      }
      const b = bodies.get(a.id);
      if (!b.active) {
        // arrive: placed where the day has them, faded in (a door, or the edge of sight)
        const s = a.state;
        b.fig.place(s.x, s.z, s.moving ? s.yaw : (s.yaw ?? 0));
        b.active = true; b.fade = 0; b.glanced = false;
        b.fig.setVisible(true);
      }
    }
    for (const [id, b] of bodies) {
      const a = life.byId.get(id);
      if (!wantIds.has(id) && b.active) { b.active = false; b.fig.setVisible(false); a.live = null; }
      if (!b.active) continue;
      steer(a, b, dt, ms, ctx, col);
    }
    // a word, now and then
    if (ms - lastLineAt > 25000) {
      for (const [id, b] of bodies) {
        if (!b.active || b.fade < 0.95) continue;
        const a = life.byId.get(id), P = a.person;
        const d = Math.hypot(a.live.x - player.x, a.live.z - player.z);
        if (d > 3.2 || ms - b.lastLine < 150000) continue;
        const slow = player.speed < 0.7;
        if (!slow && d > 2.0) continue;
        const pool = (rain && P.lines.rain.length ? P.lines.rain : hours >= 18.6 && P.lines.night.length ? P.lines.night : P.lines.near);
        if (!pool.length) continue;
        const line = pool[Math.floor((ms / 1000 + id.length * 7) % pool.length)];
        b.lastLine = ms; lastLineAt = ms;
        say(P.name, line);
        break;
      }
    }
  }

  function steer(a, b, dt, ms, ctx, col) {
    const P = a.person, s = a.state, fig = b.fig, pos = fig.position;
    const { player, rain } = ctx;
    // where to go: a little ahead of where the day has them
    let tx = s.x, tz = s.z, speed = 0;
    if (s.moving) {
      const ahead = life.stateOf(a.id, ms + 800);
      tx = ahead.x; tz = ahead.z;
      // stay with the day: behind → hurry a little, ahead → ease off
      const along = (s.x - pos.x) * Math.sin(s.yaw) + (s.z - pos.z) * Math.cos(s.yaw);
      speed = s.speed * clamp(1 + along * 0.22, 0.6, 1.35);
    } else {
      const d = Math.hypot(tx - pos.x, tz - pos.z);
      speed = d > 0.35 ? Math.min(P.speed, 0.4 + d * 0.8) : 0;
    }
    let heading = Math.atan2(tx - pos.x, tz - pos.z);
    const dTarget = Math.hypot(tx - pos.x, tz - pos.z);
    if (dTarget < 0.3) heading = s.moving ? s.yaw : (s.yaw ?? fig.heading);
    if (!s.moving && dTarget < 0.35) heading = s.yaw ?? fig.heading;
    // round the player (and each other), never through
    const avoid = (ox, oz, r) => {
      const dx = ox - pos.x, dz = oz - pos.z, d = Math.hypot(dx, dz);
      if (d > r || d < 1e-3) return;
      const rel = wrap(Math.atan2(dx, dz) - heading);
      if (Math.abs(rel) > 1.4) return;
      const k = 1 - d / r;
      heading -= Math.sign(rel || 1) * k * 0.9;
      speed *= 1 - 0.35 * k;
    };
    avoid(player.x, player.z, 2.0);
    for (const [oid, ob] of bodies) if (oid !== a.id && ob.active) avoid(ob.fig.position.x, ob.fig.position.z, 1.4);
    // indoors: walk into the door, then dissolve
    const goingIn = s.inside && dTarget < 0.9;
    b.fade = clamp(b.fade + (goingIn ? -dt / 0.8 : dt / 0.8), 0, 1);
    fig.setFade(b.fade);
    if (s.inside && b.fade <= 0) { b.active = false; fig.setVisible(false); a.live = null; return; }
    fig.steer(speed, heading);
    const px = pos.x, pz = pos.z;
    fig.tick(dt);
    if (col) { const p = fig.position; const r = move(col, px, pz, p.x - px, p.z - pz, 0.28); fig.shift(r.x - p.x, r.z - p.z); }
    // drifted far from the day (held up for a long time): catch up out of sight
    const off = Math.hypot(fig.position.x - s.x, fig.position.z - s.z);
    b.stuck = off > 6 ? b.stuck + dt : 0;
    if (b.stuck > 8 && Math.hypot(fig.position.x - player.x, fig.position.z - player.z) > 25) { fig.place(s.x, s.z, s.yaw || 0); b.stuck = 0; }
    // what they carry, what they do with their head
    fig.setUmbrella(rain && P.umbrella && !s.inside);
    const holdFor = { sketch: 'sketchbook', sweep: 'broom', tend: null, read: 'book' };
    fig.setHold(holdFor[s.act] !== undefined ? holdFor[s.act] : P.reads && s.moving ? 'book' : (P.figure.acc || []).includes('folder') ? 'folder' : null);
    if (b.props) for (const [k, o] of Object.entries(b.props)) o.visible = k === 'broom' ? s.act === 'sweep' : true;
    // a glance at the player, once per meeting
    const dp = Math.hypot(player.x - fig.position.x, player.z - fig.position.z);
    const rel = wrap(Math.atan2(player.x - fig.position.x, player.z - fig.position.z) - fig.heading);
    const near = P.reads ? 2.6 : 7;
    if (dp < near && Math.abs(rel) < 1.4 && !b.glanced) { b.glance = 1.4 + (P.id.charCodeAt(0) % 5) * 0.3; b.glanced = true; }
    if (dp > near + 4) b.glanced = false;
    b.glance -= dt;
    if (b.glance > 0) fig.lookAt(clamp(rel, -1.1, 1.1), Math.atan2(1.5 - 1.55, dp) , 0.75);
    else if (s.act === 'sketch' || s.act === 'tend') fig.lookAt(0, -0.45, 0.8);
    else if (P.reads && s.moving) fig.lookAt(0, -0.5, 0.9);
    else if (s.act === 'stand' || s.act === 'break') fig.lookAt(0, 0.35, 0.6);            // up into the tree, at the pond's sky
    else if (s.act === 'watch') fig.lookAt(0, 0.15, 0.5);
    else fig.lookAt(0, 0, 0);
    a.live = { x: fig.position.x, z: fig.position.z, yaw: fig.heading, steps: b.steps };
  }

  // ---------------------------------------------------------------- things people carry and wear
  function accessories(fig, list, P) {
    fig.model.updateMatrixWorld(true);
    const props = {};
    const mat = (hex, key) => cel({ name: key, key, color: new THREE.Color(hex), soft: 0.1 });
    // place an object at a model-space pose (at rest) and keep it there relative to a bone
    const attach = (boneName, obj, pos, rot = new THREE.Euler()) => {
      const bone = fig.bone(boneName);
      fig.model.updateMatrixWorld(true);
      const want = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(rot), new THREE.Vector3(1, 1, 1));
      const local = new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(fig.model.matrixWorld).multiply(want);
      local.decompose(obj.position, obj.quaternion, obj.scale);
      bone.add(obj);
      obj.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      return obj;
    };
    fig.human.restPose();
    fig.model.updateMatrixWorld(true);
    const handL = fig.bone('hand.L').getWorldPosition(new THREE.Vector3()), handR = fig.bone('hand.R').getWorldPosition(new THREE.Vector3());
    const toModel = (v) => fig.model.worldToLocal(v.clone());
    const hL = toModel(handL), hR = toModel(handR);
    for (const k of list) {
      if (k === 'ponytail') {
        const g = new THREE.Group();
        const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.13, 4, 8).translate(0, -0.085, 0), mat(P.figure.hair || '#2a1d16', 'hair-tail'));
        const tie = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 6, 12).rotateX(Math.PI / 2), mat('#b8443a', 'hair-tie'));
        g.add(tail, tie);
        props.ponytail = attach('head', g, new THREE.Vector3(0, 1.63, -0.105), new THREE.Euler(0.35, 0, 0));
      } else if (k === 'glasses') {
        const g = new THREE.Group(), m = mat('#1d1d20', 'glasses');
        for (const x of [-0.033, 0.033]) g.add(new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.0035, 5, 14), m).translateX(x));
        g.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.004, 0.004), m));
        props.glasses = attach('head', g, new THREE.Vector3(0, 1.596, 0.106));
      } else if (k === 'sketchbook') {
        const g = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.21, 0.15), mat('#5f7a5a', 'sketchbook'));
        props.sketchbook = attach('hand.L', g, hL.clone().add(new THREE.Vector3(0.025, -0.07, 0.02)));
      } else if (k === 'folder') {
        const g = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.31, 0.23), mat('#3d5a80', 'folder'));
        props.folder = attach('hand.L', g, hL.clone().add(new THREE.Vector3(0.03, -0.09, 0.03)));
      } else if (k === 'book') {
        const g = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.21), mat('#8a3b2e', 'book'));
        props.book = attach('hand.R', g, hR.clone().add(new THREE.Vector3(0.09, -0.06, 0.06)), new THREE.Euler(0, 0, 0));
      } else if (k === 'broom') {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.25, 6).translate(0, -0.45, 0), mat('#8c6a43', 'broom-stick')));
        g.add(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 8, 1, true).translate(0, -1.12, 0), mat('#c2a061', 'broom-head')));
        props.broom = attach('hand.R', g, hR.clone(), new THREE.Euler(0.55, 0, 0.15));
      }
    }
    fig.human.reset();
    fig._props = props;
    return props;
  }

  return {
    group, bodies, update,
    /** the bodies' props, so update() can show the broom only while sweeping */
    get count() { let n = 0; for (const b of bodies.values()) if (b.active) n++; return n; },
    describe() { return [...bodies.entries()].map(([id, b]) => ({ id, active: b.active, fade: +b.fade.toFixed(2), at: [+b.fig.position.x.toFixed(2), +b.fig.position.z.toFixed(2)] })); },
  };
}
