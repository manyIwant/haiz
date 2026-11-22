// HAIZ · 自由共游 — four ways through the painted campus, each with its own character
// (see docs/free-20261122.md). Not one controller with four speeds: each machine has the physics that
// gives it its feel, and the body, the camera and the world answer to that physics.
//
//   步行 walk     the living campus's gait and camera (lanren/life/player.js), unchanged
//   单车 bicycle  steering makes a curve (κ = tan δ / wheelbase), and the bike leans into it by the
//                 balance of gravity and the turn (tan φ = v²κ / g), a little late, as a bicycle does.
//                 Pedalling turns the cranks at the wheel's speed through the gear; let go and the cranks
//                 stop and the hub ticks (freewheel). Lawn drags; paving rolls. Shift stands up on the
//                 pedals and the bike rocks under the rider; stopped, a foot comes down. Space rings the bell
//   滑板 board    kicks, not a motor: each push is a stroke of the back foot on the ground (a phase, not
//                 a constant force), then a long coast on the paving and almost none on grass. The deck
//                 rolls with the rider's lean and the trucks turn it (yaw rate ∝ v · tan(roll)); at a
//                 standstill a lean pivots it on the tail. Space pops an ollie: crouch, pop, tuck, land
//   扫帚 broom    after Petalwake's broom (MIT, jjcm/petalwake): banked turns whose rate falls with speed,
//                 height traded for speed in a dive, a cushion over the ground that it skims without
//                 effort (hands off, it holds its height above the lie of the land), a bounce when a
//                 dive meets the ground, walls slid along rather than crashed into. Scaled to a campus:
//                 it can hover (a broom, not a glider), the buildings are solid up to their roofs (you can
//                 land on a roof), the crowns of the trees are soft (you go through them, and they answer)
import * as THREE from 'three';
import { move, nearest, freeSpot } from '../world/collide.js';
import { createBike, createBoard, createBroom } from './vehicles.js';

const clamp = THREE.MathUtils.clamp;
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const dampAngle = (cur, target, rate, dt) => cur + wrap(target - cur) * (1 - Math.exp(-rate * dt));
const G = 9.81;
const Yax = new THREE.Vector3(0, 1, 0), Xax = new THREE.Vector3(1, 0, 0), Zax = new THREE.Vector3(0, 0, 1);

export const MODES = {
  walk: { key: 'walk', name: '步行', glyph: '步' },
  bike: { key: 'bike', name: '单车', glyph: '骑' },
  board: { key: 'board', name: '滑板', glyph: '滑' },
  broom: { key: 'broom', name: '扫帚', glyph: '飞' },
};

// ======================================================================== solids for flight
// The walk's colliders are footprints. In the air a building is a box up to its roof: the Blender V3 hulls
// (accurate footprints) carry their building's height from the campus data; covered walkways can be flown
// under; the pavilions are low roofs.
export function buildSolids(world) {
  const ground = world.geo.frame.ground;
  const byId = new Map(world.model.buildings.map((b) => [b.id, b]));
  const rects = [];
  const add = (r, b, bottom = ground - 1) => {
    const h = b?.height || 12;
    rects.push({ id: r.id, cx: r.cx, cz: r.cz, hw: r.hw + 0.3, hd: r.hd + 0.3, c: Math.cos(r.rot || 0), s: Math.sin(r.rot || 0), top: ground + h, bottom });
  };
  const hulls = world.hulls?.length ? world.hulls : [];
  const covered = new Set();
  for (const h of hulls) { const b = byId.get(h.id); if (!b || b.form === 'corr') continue; add(h, b); covered.add(h.id); }
  for (const b of world.model.buildings) {
    if (b.form === 'corr') add({ id: b.id, cx: b.cx, cz: b.cz, hw: b.w / 2, hd: b.d / 2, rot: b.rot }, b, ground + 3.1);
    else if (!covered.has(b.id)) add({ id: b.id, cx: b.cx, cz: b.cz, hw: b.w / 2, hd: b.d / 2, rot: b.rot }, b);
  }
  for (const r of rects) r.reach = Math.hypot(r.hw, r.hd);
  const CELL = 16, grid = new Map(), key = (i, j) => i * 100003 + j;
  for (const r of rects) {
    for (let i = Math.floor((r.cx - r.reach) / CELL); i <= Math.floor((r.cx + r.reach) / CELL); i++)
      for (let j = Math.floor((r.cz - r.reach) / CELL); j <= Math.floor((r.cz + r.reach) / CELL); j++) {
        const k = key(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(r);
      }
  }
  const near = (x, z) => grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) || [];
  const local = (r, x, z) => { const dx = x - r.cx, dz = z - r.cz; return [dx * r.c - dz * r.s, dx * r.s + dz * r.c]; };
  return {
    rects,
    /** top of the roof at (x, z), or -Infinity */
    topAt(x, z) {
      let t = -Infinity;
      for (const r of near(x, z)) { const [lx, lz] = local(r, x, z); if (Math.abs(lx) <= r.hw && Math.abs(lz) <= r.hd && r.top > t) t = r.top; }
      return t;
    },
    /** the nearest wall at height y: {d, nx, nz, top} (d < 0 inside) */
    wall(x, z, y) {
      let best = { d: Infinity, nx: 0, nz: 0, top: 0 };
      for (const r of near(x, z)) {
        if (y > r.top + 0.05 || y < r.bottom) continue;
        const [lx, lz] = local(r, x, z);
        const qx = Math.abs(lx) - r.hw, qz = Math.abs(lz) - r.hd;
        let d, nx, nz;
        if (qx > 0 || qz > 0) { const ox = Math.max(qx, 0), oz = Math.max(qz, 0); d = Math.hypot(ox, oz); nx = ox * Math.sign(lx) / (d || 1); nz = oz * Math.sign(lz) / (d || 1); }
        else if (qx > qz) { d = qx; nx = Math.sign(lx) || 1; nz = 0; } else { d = qz; nx = 0; nz = Math.sign(lz) || 1; }
        if (d < best.d) best = { d, nx: nx * r.c + nz * r.s, nz: -nx * r.s + nz * r.c, top: r.top };
      }
      return best;
    },
  };
}

// ======================================================================== the controller
/**
 * ctx: { world, student, rig, player (getter), followCam, input, heightAt, getColliders, surface(x, z), layer,
 *        onEvent(name, data) }
 */
export function createRide(ctx) {
  const { world, student, rig, input, heightAt, getColliders, followCam } = ctx;
  const solids = buildSolids(world);
  const D = rig.dims;
  const group = new THREE.Group(); group.name = 'rides';
  world.group.add(group);
  // ---- the machines (one of each; the bike stays where it is parked)
  // saddle so the leg is nearly straight at the bottom of the stroke: hip joint above the low pedal
  const saddleH = clamp(0.115 + 0.075 + Math.sqrt(Math.max(0.3, (D.leg * 0.955) ** 2 - 0.2 ** 2)) - 0.095, 0.72, 1.0);
  const bike = createBike({ saddleH });
  const board = createBoard();
  const broom = createBroom();
  const machines = { bike, board, broom };
  for (const m of Object.values(machines)) { m.group.visible = false; group.add(m.group); m.group.traverse((o) => o.layers.set(ctx.layer)); }

  const S = {
    mode: 'walk', phase: 'free',          // free | summon | mount | ride | stop | dismount
    t: 0, want: null,
    pos: new THREE.Vector3(), yaw: 0, speed: 0, vel: new THREE.Vector3(), vy: 0,
    lean: 0, steer: 0, pitch: 0, roll: 0, turnRate: 0,
    crank: 0, cadence: 0, pedalling: 0, stand: 0, footDown: 0, coastT: 0,
    push: -1, pushes: 0, brakeT: 0, ollie: -1, air: false, airT: 0, carve: 0, crouch: 0, pivot: 0,
    agl: 0, bob: 0, bobV: 0, boost: 0, holdAgl: -1, flare: 0, sink: 0, inCrown: 0,
    bump: 0, touchdown: 0, surface: 'pave', wallHit: 0,
    parked: null,                          // { x, z, yaw } where the bike stands
    blendT: 1, blendDur: 0.4,
  };
  const cam = { yaw: 0, pitch: 0.2, dist: 5, height: 1.8, fov: 52, roll: 0, look: new THREE.Vector3(), lookYaw: 0, lookPitch: 0, boom: 5, fp: 0, firstPerson: false, shake: 0, init: false };

  // ---------------------------------------------------------------- helpers
  const qYaw = new THREE.Quaternion(), qP = new THREE.Quaternion(), qR = new THREE.Quaternion(), qTmp = new THREE.Quaternion();
  const machineQ = (yaw, pitchUp, roll, out = new THREE.Quaternion()) => out.setFromAxisAngle(Yax, yaw).multiply(qP.setFromAxisAngle(Xax, -pitchUp)).multiply(qR.setFromAxisAngle(Zax, roll));
  const toWorld = (obj, v, out = new THREE.Vector3()) => out.copy(v).applyMatrix4(obj.matrixWorld);
  const ground = (x, z) => heightAt(x, z);

  function placeMachine(m, x, z, yaw) {
    m.group.position.set(x, ground(x, z), z);
    m.group.quaternion.setFromAxisAngle(Yax, yaw);
    m.group.visible = true;
    m.group.updateMatrixWorld(true);
  }

  // ---------------------------------------------------------------- switching
  /** ask for a mode: the current machine is left (slowing first) and the next one painted in */
  function request(mode) {
    if (!MODES[mode] || mode === S.mode && S.phase === 'ride') return false;
    if (mode === S.mode && S.phase !== 'free') return false;
    if (S.phase === 'summon' || S.phase === 'mount' || S.phase === 'dismount') { S.want = mode; return true; }
    S.want = mode;
    if (S.mode === 'walk') beginSummon(mode);
    else { S.phase = 'stop'; S.t = 0; }
    return true;
  }
  function beginSummon(mode) {
    const P = ctx.player().state;
    S.mode = mode; S.phase = 'summon'; S.t = 0;
    ctx.player().setEnabled(false);
    S.pos.set(P.pos.x, P.pos.y, P.pos.z); S.yaw = P.yaw; S.speed = 0; S.vy = 0; S.lean = 0; S.steer = 0; S.pitch = 0; S.roll = 0;
    const m = machines[mode];
    const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw), rx = -Math.cos(S.yaw), rz = Math.sin(S.yaw);
    const col = getColliders();
    if (mode === 'bike') {
      // the parked bike, if it is close enough, else a new one painted beside the walker (to their right)
      let x = P.pos.x + rx * 0.55, z = P.pos.z + rz * 0.55, yaw = S.yaw;
      if (S.parked && Math.hypot(S.parked.x - P.pos.x, S.parked.z - P.pos.z) < 3.2) ({ x, z, yaw } = S.parked);
      else { const f = col ? freeSpot(col, x, z, 0.45) : { x, z }; x = f.x; z = f.z; bike.uFade.value = 0; }
      S.pos.set(x, ground(x, z), z); S.yaw = yaw;
      placeMachine(bike, x, z, yaw);
      setBikeParked(true);
    } else if (mode === 'board') {
      const x = P.pos.x + fx * 0.45, z = P.pos.z + fz * 0.45;
      S.pos.set(x, ground(x, z), z);
      board.uFade.value = 0; placeMachine(board, x, z, S.yaw);
      board.deck.rotation.set(0, 0, 0);
    } else if (mode === 'broom') {
      broom.uFade.value = 0; broom.resetRibbon();
      S.pos.set(P.pos.x, P.pos.y, P.pos.z);
      S.agl = 0;
    }
    ctx.onEvent?.('summon', { mode });
  }
  function beginMount() {
    S.phase = 'mount'; S.t = 0;
    rig.capture(); S.blendT = 0; S.blendDur = S.mode === 'broom' ? 0.6 : 0.45;
    if (S.mode === 'broom') { S.pos.y = ground(S.pos.x, S.pos.z) + 0.95; S.vy = 0.6; S.holdAgl = 0.95; }
    if (S.mode === 'bike') { S.parked = null; setBikeParked(false); }
    input.setActive(true);
    initCam();
    ctx.onEvent?.('mount', { mode: S.mode });
  }
  function beginDismount() {
    S.phase = 'dismount'; S.t = 0;
    const m = S.mode;
    rig.capture();
    // the walker steps down beside the machine (to its left, the side a rider gets off)
    const lx = Math.cos(S.yaw), lz = -Math.sin(S.yaw);
    let x = S.pos.x + lx * (m === 'board' ? 0.1 : 0.5), z = S.pos.z + lz * (m === 'board' ? 0.1 : 0.5);
    if (m === 'board') { x = S.pos.x - Math.sin(S.yaw) * 0.2; z = S.pos.z - Math.cos(S.yaw) * 0.2; }
    const col = getColliders();
    if (col) ({ x, z } = freeSpot(col, x, z, 0.32));
    // (a broom comes down to land first; a roof is somewhere to stand, too)
    const p = ctx.player();
    S.camFrom = { pos: followCam.position.clone(), quat: followCam.quaternion.clone(), fov: followCam.fov };
    p.place(x, z, S.yaw);
    p.state.camYaw = cam.yaw; p.cam.yaw.v = cam.yaw;
    S.blendT = 0; S.blendDur = 0.42;
    if (m === 'bike') { S.parked = { x: S.pos.x, z: S.pos.z, yaw: S.yaw }; setBikeParked(true); }
    input.setActive(false);
    ctx.onEvent?.('dismount', { mode: m });
  }
  function setBikeParked(on) {
    bike.stand.rotation.x = on ? 0 : -1.3;
    if (on) { bike.body.rotation.set(0, 0, -0.1); bike.setSteer(0.25); bike.crank.rotation.x = 1.2; bike.pedals.L.rotation.x = bike.pedals.R.rotation.x = -1.2; }
  }

  // ---------------------------------------------------------------- the bicycle
  const BIKE = { cruise: 5.4, sprint: 8.0, max: 10, accel: 1.9, brake: 4.8, gear: 2.3 };
  function stepBike(dt, inp) {
    const col = getColliders();
    const surf = S.surface = ctx.surface(S.pos.x, S.pos.z);
    const rolling = surf === 'lawn' ? 0.55 : 0.09;
    const stand = inp.boost && inp.ay > 0.2;
    S.stand = damp(S.stand, stand ? 1 : 0, 5, dt);
    const target = inp.ay > 0.1 ? (stand ? BIKE.sprint : BIKE.cruise) * Math.min(1, inp.ay * 1.15) * (surf === 'lawn' ? 0.72 : 1) : 0;
    let a = -rolling - 0.004 * S.speed * S.speed;
    S.pedalling = damp(S.pedalling, inp.ay > 0.1 && S.speed < target + 0.3 ? 1 : 0, 6, dt);
    if (inp.ay > 0.1 && S.speed < target) a += BIKE.accel * (stand ? 1.45 : 1) * (1 - S.speed / Math.max(target, 0.1)) + 0.4;
    if (inp.brake && inp.ay < -0.1) a -= BIKE.brake * Math.min(1, -inp.ay * 1.3);
    if (S.phase === 'stop') a -= BIKE.brake;
    S.speed = clamp(S.speed + a * dt, 0, BIKE.max);
    if (S.speed < 0.05 && !(inp.ay > 0.1)) S.speed = 0;
    // steering: the handlebar's reach falls with speed; a curve κ = tan δ / L
    const dMax = 0.62 / (1 + S.speed * 0.32);
    const steerT = -inp.ax * dMax;
    S.steer = damp(S.steer, steerT, 7, dt);
    const kappa = Math.tan(S.steer) / bike.wheelBase;
    S.turnRate = S.speed * kappa;
    S.yaw = wrap(S.yaw + S.turnRate * dt);
    // the lean that balances the turn, reached a moment late
    const leanT = clamp(-Math.atan(S.speed * S.speed * kappa / G), -0.62, 0.62);
    S.lean = damp(S.lean, leanT, 5.5, dt);
    // moving: slide along walls
    const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw);
    const dx = fx * S.speed * dt, dz = fz * S.speed * dt;
    if (col) {
      const r = move(col, S.pos.x, S.pos.z, dx, dz, 0.42);
      if (r.hit) {
        const n = nearest(col, r.x, r.z);
        const into = -(fx * n.nx + fz * n.nz);
        if (into > 0.15) {
          if (into > 0.6 && S.speed > 2 && S.wallHit <= 0) { S.bump = Math.min(1, S.speed / 6); ctx.onEvent?.('bump', { speed: S.speed }); S.wallHit = 0.6; }
          S.speed *= 1 - 0.85 * into * Math.min(1, dt * 10);
          // turn along the wall
          const tx = fx + n.nx * into, tz = fz + n.nz * into;
          S.yaw = dampAngle(S.yaw, Math.atan2(tx, tz), 6 * into, dt);
        }
      }
      S.pos.x = r.x; S.pos.z = r.z;
    } else { S.pos.x += dx; S.pos.z += dz; }
    S.wallHit -= dt;
    // the ground under both wheels: height and pitch
    const yb = ground(S.pos.x - fx * 0.43, S.pos.z - fz * 0.43), yf = ground(S.pos.x + fx * 0.65, S.pos.z + fz * 0.65), yc = ground(S.pos.x, S.pos.z);
    S.pos.y = damp(S.pos.y, Math.max(yc, (yb + yf) / 2), 18, dt);
    S.pitch = damp(S.pitch, Math.atan2(yf - yb, bike.wheelBase), 10, dt);
    // pedalling turns the cranks at the wheel's speed through the gear; coasting stops them (and the hub ticks)
    const wheelRate = S.speed / bike.R;
    if (S.pedalling > 0.5) { S.cadence = wheelRate / BIKE.gear; S.coastT = 0; }
    else {
      S.coastT += dt;
      // the cranks settle level, the right foot forward
      const rest = Math.round((S.crank - Math.PI / 2) / Math.PI) * Math.PI + Math.PI / 2;
      S.cadence = damp(S.cadence, (rest - S.crank) * 4, 6, dt);
    }
    S.crank += S.cadence * dt;
    // standing on the pedals rocks the bike under the rider, a stroke each side
    const rock = S.stand * Math.sin(S.crank) * 0.13 * Math.min(1, S.speed / 2);
    // stopped: a foot comes down and the bike leans onto it
    S.footDown = damp(S.footDown, S.speed < 0.35 && S.phase !== 'stop' ? 1 : 0, 7, dt);
    S.roll = S.lean + rock - S.footDown * 0.12;
    if (inp.bell) ctx.onEvent?.('bell', { x: S.pos.x, z: S.pos.z });
    S.vel.set(fx * S.speed, 0, fz * S.speed);
    // the machine
    bike.group.position.copy(S.pos);
    bike.group.quaternion.setFromAxisAngle(Yax, S.yaw).multiply(qP.setFromAxisAngle(Xax, -S.pitch));
    bike.body.rotation.set(0, 0, S.roll);
    bike.setSteer(S.steer);
    bike.rear.rotation.x += wheelRate * dt; bike.front.rotation.x += wheelRate * dt;
    bike.crank.rotation.x = S.crank;
    bike.pedals.L.rotation.x = bike.pedals.R.rotation.x = -S.crank;
    bike.group.updateMatrixWorld(true);
  }
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
  const frameQ = new THREE.Quaternion(), footQ = new THREE.Quaternion();
  function poseBike() {
    const body = bike.body;
    body.updateMatrixWorld(true);
    const bq = body.getWorldQuaternion(new THREE.Quaternion());
    // trunk: an upright city bike; standing lifts the hips forward over the cranks; a foot down sits up
    const st = S.stand, fd = S.footDown;
    const hipsB = _a.copy(bike.saddle).add(_d.set(0, 0.105 + st * 0.2, -0.02 + st * 0.2));
    const hips = toWorld(body, hipsB, new THREE.Vector3());
    frameQ.copy(bq);
    const lean = 0.24 + 0.1 * Math.min(1, S.speed / 6) + st * 0.62 - fd * 0.12;
    // pedals → ankles (a little above and behind the pedal axle), the foot pitching with the stroke
    const feet = {};
    for (const sd of ['L', 'R']) {
      const p = bike.pedals[sd].getWorldPosition(new THREE.Vector3());
      const up = _b.set(0, 1, 0).applyQuaternion(bq), fw = _c.set(0, 0, 1).applyQuaternion(bq);
      const c = S.crank + (sd === 'L' ? Math.PI : 0);
      const at = p.addScaledVector(up, 0.075).addScaledVector(fw, -0.035);
      const ank = 0.12 + 0.16 * Math.sin(c + 0.6);
      feet[sd] = { at, pole: _d.set(sd === 'L' ? 0.12 : -0.12, 0.1, 1).applyQuaternion(bq).clone(), q: footQ.copy(bq).multiply(qTmp.setFromAxisAngle(Xax, ank)).clone() };
    }
    // stopped: the left foot comes off its pedal to the ground beside the bike
    if (fd > 0.01) {
      const gnd = new THREE.Vector3(0.36, 0, -0.08);
      const gw = toWorld(bike.group, gnd, new THREE.Vector3());
      gw.y = ground(gw.x, gw.z) + D.ankle;
      feet.L.at.lerp(gw, fd);
      feet.L.q = new THREE.Quaternion().setFromAxisAngle(Yax, S.yaw).slerp(feet.L.q, 1 - fd);
    }
    const hands = {};
    for (const sd of ['L', 'R']) {
      const g = bike.grip(sd, S.steer, new THREE.Vector3());
      g.add(_d.set(sd === 'L' ? -0.025 : 0.025, 0.025, -0.05));
      hands[sd] = { at: toWorld(body, g, new THREE.Vector3()), pole: _b.set(sd === 'L' ? 0.75 : -0.75, -0.5, -0.6).applyQuaternion(bq).clone() };
    }
    rig.pose({ frame: frameQ, hips, pitch: [lean * 0.4, lean * 0.35, lean * 0.3], twist: [S.steer * 0.25 + st * Math.sin(S.crank) * 0.12, -st * Math.sin(S.crank) * 0.1], side: -S.roll * 0.25,
      look: -0.04 + st * 0.15, headYaw: S.steer * 0.9, feet, hands, curl: 0.8 });
  }

  // ---------------------------------------------------------------- the skateboard
  const BOARD = { pushTo: 6.2, kick: 1.35, max: 9, roll: 0.06, lawn: 3.2, brake: 2.6 };
  function stepBoard(dt, inp) {
    const col = getColliders();
    const surf = S.surface = ctx.surface(S.pos.x, S.pos.z);
    // pushing: a stroke of the back foot (0.62 s): plant, push (accelerate), lift and return
    if (S.push < 0 && inp.ay > 0.25 && !S.air && S.speed < BOARD.pushTo && S.phase === 'ride') { S.push = 0; S.pushes++; }
    if (S.push >= 0) {
      const prev = S.push; S.push += dt / 0.62;
      if (S.push > 0.22 && S.push < 0.55) S.speed += (BOARD.kick / 0.33) * dt / 0.62 * (1 - S.speed / 9);
      if (prev < 0.22 && S.push >= 0.22) ctx.onEvent?.('kick', {});
      if (S.push >= 1) S.push = -1;
    }
    let a = -(surf === 'lawn' ? BOARD.lawn : BOARD.roll) - 0.006 * S.speed * S.speed;
    const braking = inp.ay < -0.25 && !S.air && S.push < 0;
    S.brakeT = damp(S.brakeT, braking ? 1 : 0, 6, dt);
    if (braking) a -= BOARD.brake * S.brakeT;
    if (S.phase === 'stop') a -= BOARD.brake * 1.2;
    if (!S.air) S.speed = clamp(S.speed + a * dt, 0, BOARD.max);
    if (S.speed < 0.04) S.speed = 0;
    // carving: the rider leans, the deck rolls, the trucks turn it
    const leanT = -inp.ax * 0.3 * (S.push >= 0 ? 0.3 : 1);
    S.carve = damp(S.carve, S.air ? S.carve * 0.95 : leanT, 7, dt);
    // (a right lean is a negative carve: the yaw falls, the turn goes right)
    if (S.speed > 0.4) S.turnRate = S.speed * Math.tan(S.carve * 1.5) / 0.7;
    else S.turnRate = damp(S.turnRate, -inp.ax * 2.1, 8, dt);           // a kick-turn on the tail
    S.pivot = damp(S.pivot, S.speed < 0.4 && Math.abs(inp.ax) > 0.2 ? 1 : 0, 8, dt);
    S.yaw = wrap(S.yaw + S.turnRate * dt);
    // ollie: crouch (0.14 s), pop, tuck, land
    if (inp.jump && !S.air && S.ollie < 0 && S.phase === 'ride') { S.ollie = 0; }
    if (S.ollie >= 0) {
      S.ollie += dt;
      if (S.ollie > 0.14 && !S.air) { S.air = true; S.vy = 3.2; S.airT = 0; ctx.onEvent?.('pop', {}); }
    }
    const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw);
    let dx = fx * S.speed * dt, dz = fz * S.speed * dt;
    if (col) {
      const r = move(col, S.pos.x, S.pos.z, dx, dz, 0.32);
      if (r.hit) {
        const n = nearest(col, r.x, r.z), into = -(fx * n.nx + fz * n.nz);
        if (into > 0.2) { S.speed *= 1 - 0.9 * into * Math.min(1, dt * 10); S.yaw = dampAngle(S.yaw, Math.atan2(fx + n.nx * into, fz + n.nz * into), 6 * into, dt); if (into > 0.6 && S.wallHit <= 0 && S.speed > 1.5) { S.bump = 0.6; S.wallHit = 0.6; ctx.onEvent?.('bump', {}); } }
      }
      S.pos.x = r.x; S.pos.z = r.z;
    } else { S.pos.x += dx; S.pos.z += dz; }
    S.wallHit -= dt;
    const gy = ground(S.pos.x, S.pos.z);
    if (S.air) {
      S.airT += dt; S.vy -= G * dt; S.pos.y += S.vy * dt;
      if (S.pos.y <= gy && S.vy < 0) { S.pos.y = gy; S.air = false; S.ollie = -1; S.crouch = Math.min(1, -S.vy * 0.25); ctx.onEvent?.('land', { v: -S.vy }); S.vy = 0; }
    } else {
      // a step up stops the board unless it is popped over; a step down is a little drop
      if (gy - S.pos.y > 0.08) { S.speed *= 0.3; S.bump = 0.5; S.pos.y = gy; } else if (S.pos.y - gy > 0.05) { S.air = true; S.vy = 0; S.airT = 0.3; } else S.pos.y = damp(S.pos.y, gy, 20, dt);
    }
    S.crouch = damp(S.crouch, 0, 5, dt);
    S.vel.set(fx * S.speed, S.vy, fz * S.speed);
    // the deck: rolls with the carve, pitches on the pop (tail first, then level) and in the air
    const o = S.ollie;
    let pitch = 0, lift = 0;
    if (o >= 0) {
      if (o < 0.14) pitch = 0;
      else if (o < 0.28) pitch = smooth((o - 0.14) / 0.14) * 0.42;         // nose up off the tail
      else pitch = 0.42 * (1 - smooth((o - 0.28) / 0.2));                  // the front foot levels it
      lift = o > 0.14 ? Math.sin(Math.min(1, (o - 0.14) / 0.6) * Math.PI) * 0.05 : 0;
    }
    board.group.position.set(S.pos.x, S.pos.y + lift, S.pos.z);
    board.group.quaternion.setFromAxisAngle(Yax, S.yaw);
    board.deck.rotation.set(-pitch - S.pivot * 0.18, 0, -S.carve);
    board.deck.position.set(0, pitch * 0.1, 0);
    board.trucks[0].rotation.y = S.carve * 0.9; board.trucks[1].rotation.y = -S.carve * 0.9;
    for (const w of board.wheels) w.rotation.x += S.speed / 0.027 * dt;
    board.group.updateMatrixWorld(true);
  }
  function poseBoard() {
    const deck = board.deck;
    deck.updateMatrixWorld(true);
    const dq = deck.getWorldQuaternion(new THREE.Quaternion());
    // regular stance: left foot forward, facing the board's right (-x): the figure's frame is the deck's turned -90°
    const push = S.push >= 0 ? Math.sin(Math.min(1, S.push) * Math.PI) : 0;
    const open = Math.max(push, S.brakeT * 0.6);                         // pushing and dragging turn the body toward the nose
    const fq = new THREE.Quaternion().copy(dq).multiply(qTmp.setFromAxisAngle(Yax, -Math.PI / 2 + open * 1.0));
    frameQ.copy(fq);
    // crouch: lower before the pop, tucked in the air, absorbing the landing
    const o = S.ollie;
    const pre = o >= 0 && o < 0.14 ? smooth(o / 0.14) : 0;
    const tuck = S.air ? Math.sin(Math.min(1, S.airT / 0.55) * Math.PI) : 0;
    const crouch = 0.045 + 0.16 * pre + 0.2 * tuck + 0.22 * S.crouch + 0.07 * Math.abs(S.carve) / 0.3 + push * 0.12;
    const top = board.topY;
    const hipLocal = new THREE.Vector3(S.carve * 0.25, top + D.ankle + D.leg * 0.97 - crouch, -0.01 + push * 0.12);
    const hips = toWorld(deck, hipLocal, new THREE.Vector3());
    // keep the hips over the board even as the deck rolls: correct toward world-up
    const feet = {};
    const fwdW = new THREE.Vector3(0, 0, 1).applyQuaternion(fq);
    // front foot over the front bolts, angled toward the nose; back foot on the tail
    const fL = toWorld(deck, _a.set(0.0, top + D.ankle * 0.9, 0.17 + push * 0.04), new THREE.Vector3());
    feet.L = { at: fL, pole: _b.set(-1, 0, 0.35).applyQuaternion(dq).clone(), q: new THREE.Quaternion().copy(dq).multiply(qTmp.setFromAxisAngle(Yax, -Math.PI / 2 + 0.45 + push * 0.9)) };
    let rAt = toWorld(deck, _a.set(0.01, top + D.ankle * 0.9, -0.24), new THREE.Vector3());
    const rq = new THREE.Quaternion().copy(dq).multiply(qTmp.setFromAxisAngle(Yax, -Math.PI / 2 - 0.15));
    if (push > 0.001) {
      // the pushing foot: down beside the board ahead of the back truck, back along the ground, up and home
      const p = S.push;
      const zs = 0.15 - 0.85 * smooth((p - 0.1) / 0.6);
      const gp = toWorld(board.group, _b.set(-0.2, 0, zs), new THREE.Vector3());
      gp.y = ground(gp.x, gp.z) + D.ankle + Math.max(0, Math.sin(p * Math.PI * 2 - 0.6)) * 0.05 * (p > 0.6 ? 1 : 0);
      rAt.lerp(gp, smooth(push * 1.6));
      rq.slerp(new THREE.Quaternion().setFromAxisAngle(Yax, S.yaw), push);
    }
    if (S.brakeT > 0.01 && push < 0.01) {
      const gp = toWorld(board.group, _b.set(-0.12, 0, -0.42), new THREE.Vector3());
      gp.y = ground(gp.x, gp.z) + D.ankle * 0.8;
      rAt.lerp(gp, S.brakeT * 0.85);
    }
    // the tail foot pops: with the tail it goes down then lifts; in the air both feet tuck under
    if (S.air) { const t = tuck * 0.12; fL.y += t; rAt.y += t * 1.2; }
    feet.R = { at: rAt, pole: _b.set(-1, 0, -0.1).applyQuaternion(dq).clone().lerp(fwdW, push), q: rq };
    // arms out for balance: the leading arm toward the nose, the trailing one back; they swing with the carve
    const hands = {};
    const sway = Math.sin(performance.now() * 0.0011) * 0.03;
    // (board -x is where the rider faces; the arms hang out to the sides, a little in front, lifting as the board carves)
    const hy = top + D.ankle + D.leg * 0.97 - crouch;
    const armL = toWorld(board.group, _a.set(-0.13 + S.carve * 0.3, hy - 0.06 + Math.abs(S.carve) * 0.5 + tuck * 0.25, 0.44 + sway), new THREE.Vector3());
    const armR = toWorld(board.group, _a.set(-0.06 + S.carve * 0.2, hy - 0.12 + Math.abs(S.carve) * 0.3 + tuck * 0.2, -0.42 - sway), new THREE.Vector3());
    if (push > 0.01) { armL.lerp(toWorld(board.group, _a.set(-0.25, top + D.leg + 0.05, 0.3), new THREE.Vector3()), push * 0.6); armR.lerp(toWorld(board.group, _a.set(-0.2, top + D.leg + 0.0, -0.05), new THREE.Vector3()), push * 0.7); }
    hands.L = { at: armL, pole: _b.set(0.6, -1, 0.2).applyQuaternion(dq).clone() };
    hands.R = { at: armR, pole: _b.set(0.6, -1, -0.2).applyQuaternion(dq).clone() };
    rig.pose({ frame: frameQ, hips, pitch: [0.12 + crouch * 0.6, 0.06 + crouch * 0.3, 0.04], twist: [0.25 - open * 0.3, 0.2 - open * 0.15], side: S.carve * 0.6,
      look: -0.12, headYaw: 1.15 - open * 1.0, feet, hands, curl: 0.25 });
  }

  // ---------------------------------------------------------------- the broom
  const BROOM = { cruise: 10, boost: 19, slow: 0, max: 26, turn: 1.6, clear: 0.95, ceiling: 56 };
  const BOUNDS = { x0: -315, x1: 185, z0: -165, z1: 320 };            // the campus, with a margin: beyond it the horizon is scenery
  function floorAt(x, z, y) {
    const g = ground(x, z);
    const roof = solids.topAt(x, z);
    return roof > g && y >= roof - 0.6 ? roof : g;
  }
  function stepBroom(dt, inp) {
    const stopping = S.phase === 'stop';
    // throttle: push to fly, hold back to hover; let go and it glides down to a drift
    const wantBoost = inp.boost && inp.ay > -0.1;
    S.boost = damp(S.boost, wantBoost ? 1 : 0, wantBoost ? 4 : 2, dt);
    let target = inp.ay > 0.1 ? BROOM.cruise * inp.ay + (BROOM.boost - BROOM.cruise) * S.boost : inp.ay < -0.1 ? 0 : Math.min(S.speed, 3.5);
    if (stopping) target = 0;
    const rate = target > S.speed ? 1.3 + S.boost * 1.2 : inp.ay < -0.1 || stopping ? 3.5 : 0.35;
    S.speed += (target - S.speed) * (1 - Math.exp(-rate * dt));
    // gravity trades height for speed (a dive gathers it, a climb spends it)
    S.speed = clamp(S.speed - S.vy * 0.55 * dt * (S.speed > 1 ? 1 : 0), 0, BROOM.max);
    // turning: banked; the rate falls with speed, and hovering it spins on the spot
    const maxTurn = BROOM.turn / Math.pow(1 + S.speed / 9, 0.55);
    S.turnRate = damp(S.turnRate, -inp.ax * maxTurn, 4.8, dt);
    S.yaw = wrap(S.yaw + S.turnRate * dt);
    // vertical: climb / descend by hand; hands off, it holds its height (low down: its height above the land)
    const g0 = floorAt(S.pos.x, S.pos.z, S.pos.y);
    S.agl = S.pos.y - g0;
    let vyT;
    if (stopping) vyT = S.agl > BROOM.clear + 0.1 ? -Math.min(3.5, 0.8 + S.agl * 0.8) : 0;
    else if (inp.up) vyT = 3.6 + S.boost * 2 + Math.min(2, S.speed * 0.12);
    else if (inp.down) vyT = -(4.2 + Math.min(5, S.speed * 0.3));
    else {
      if (S.holdAgl < 0) S.holdAgl = Math.max(S.agl, BROOM.clear);
      // follow the land when low; hold the altitude when high
      const follow = clamp(1 - (S.holdAgl - 8) / 10, 0, 1);
      const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw), look = Math.max(4, S.speed * 0.6);
      const ahead = floorAt(S.pos.x + fx * look, S.pos.z + fz * look, S.pos.y);
      const holdY = follow * (Math.max(g0, ahead) + S.holdAgl) + (1 - follow) * (S.pos.y);
      vyT = clamp((holdY - S.pos.y) * 2.2, -3, 3) * (follow > 0 ? 1 : 0);
    }
    if (inp.up || inp.down) S.holdAgl = -1;
    // a soft ceiling: the wind lets you go no higher than the campus can be seen from
    if (S.agl > BROOM.ceiling - 10 && vyT > 0) vyT *= clamp((BROOM.ceiling - S.agl) / 10, 0, 1);
    S.vy = damp(S.vy, vyT, 3.2, dt);
    // move
    const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw);
    S.pos.x += fx * S.speed * dt; S.pos.z += fz * S.speed * dt; S.pos.y += S.vy * dt;
    // the sheet's edge: the wind turns you home
    const out = Math.max(BOUNDS.x0 - S.pos.x, S.pos.x - BOUNDS.x1, BOUNDS.z0 - S.pos.z, S.pos.z - BOUNDS.z1, 0);
    if (out > 0) { S.yaw = dampAngle(S.yaw, Math.atan2(-S.pos.x - 40, 60 - S.pos.z), Math.min(3, out * 0.1), dt); S.pos.x = clamp(S.pos.x, BOUNDS.x0 - 25, BOUNDS.x1 + 25); S.pos.z = clamp(S.pos.z, BOUNDS.z0 - 25, BOUNDS.z1 + 25); }
    // buildings: slide along their walls (and see them coming); trunks low down
    const w = solids.wall(S.pos.x, S.pos.z, S.pos.y - 0.3);
    if (w.d < 0.7) {
      const push = 0.7 - w.d;
      S.pos.x += w.nx * push; S.pos.z += w.nz * push;
      const into = -(fx * w.nx + fz * w.nz);
      if (into > 0) {
        S.yaw = dampAngle(S.yaw, Math.atan2(fx + w.nx * into * 1.35, fz + w.nz * into * 1.35), 14, dt);
        if (into > 0.5 && S.speed > 4 && S.wallHit <= 0) { S.bump = Math.min(1, S.speed / 14); S.speed *= 0.75; S.wallHit = 0.5; ctx.onEvent?.('bump', {}); }
      }
    } else if (S.speed > 2) {
      const la = 0.32 * S.speed;
      const wa = solids.wall(S.pos.x + fx * la, S.pos.z + fz * la, S.pos.y + S.vy * 0.32 - 0.3);
      if (wa.d < 0.4) {
        const into = -(fx * wa.nx + fz * wa.nz);
        if (into > 0) S.yaw = dampAngle(S.yaw, Math.atan2(fx + wa.nx * into * 1.35, fz + wa.nz * into * 1.35), 3 * into, dt);
        // square on to a wall too close to turn from: lift over it
        if (into > 0.6 && wa.top - S.pos.y < 8 && !inp.down) S.vy = Math.max(S.vy, 3.5);
      }
    }
    S.wallHit -= dt;
    const col = getColliders();
    if (col && S.agl < 3) {
      const n = nearest(col, S.pos.x, S.pos.z);
      if (n.d < 0.4 && n.id && /^(tree|lanshu|bed|plinth)/.test(String(n.id))) { S.pos.x += n.nx * (0.4 - n.d); S.pos.z += n.nz * (0.4 - n.d); }
    }
    // the ground cushion: skim, never crash; a dive meeting the ground bounces once
    const floor = floorAt(S.pos.x, S.pos.z, S.pos.y);
    S.sink = Math.max(S.sink * Math.exp(-dt / 1.0), -S.vy);
    if (S.pos.y < floor + BROOM.clear) {
      if (S.vy < -2.2 && !S.landed) { const hit = clamp((S.sink - 2) * 0.12, 0, 0.9); S.bobV -= hit * 2.2; S.bump = Math.max(S.bump, hit * 0.4); S.touchdown = hit; ctx.onEvent?.('touch', { hit }); }
      S.pos.y = damp(S.pos.y, floor + BROOM.clear, 16, dt);
      if (S.vy < 0) S.vy *= 0.2;
      S.landed = true;
    } else if (S.pos.y > floor + BROOM.clear + 1.2) S.landed = false;
    // the landing bounce: a lightly damped spring about the riding height
    S.bobV += (-7.2 * 7.2 * S.bob - 2 * 0.22 * 7.2 * S.bobV) * dt;
    S.bob += S.bobV * dt;
    S.agl = S.pos.y - floorAt(S.pos.x, S.pos.z, S.pos.y);
    // flight attitude: bank with the turn, nose along the climb, a lean with the throttle
    const bankT = clamp(Math.atan(S.speed * S.turnRate / G) * 1.0, -0.75, 0.75);
    S.roll = damp(S.roll, -bankT + (S.speed < 1.5 ? -S.turnRate * 0.08 : 0), 4.2, dt);
    const pitchT = Math.atan2(S.vy, Math.max(S.speed, 3)) * 0.85 - (target - S.speed) * 0.01;
    S.pitch = damp(S.pitch, clamp(pitchT, -0.7, 0.6), 4, dt);
    S.vel.set(fx * S.speed, S.vy, fz * S.speed);
    // crowns: flying through a tree is allowed, and the tree answers
    S.inCrown = 0;
    for (const t of world.crowns) {
      const dx = (S.pos.x - t.x) / t.r, dy = (S.pos.y - t.y) / t.ry, dz = (S.pos.z - t.z) / t.r;
      const q = dx * dx + dy * dy + dz * dz;
      if (q < 1.15) { S.inCrown = Math.max(S.inCrown, 1 - q / 1.15); }
    }
    if (S.inCrown > 0.2) S.speed *= 1 - 0.25 * dt;
    // the machine
    broom.group.position.set(S.pos.x, S.pos.y + S.bob * 0.6, S.pos.z);
    broom.group.quaternion.copy(machineQ(S.yaw, S.pitch, S.roll));
    broom.group.updateMatrixWorld(true);
  }
  const hover = { t: 0 };
  function poseBroom(dt) {
    hover.t += dt;
    const b = broom.body;
    b.updateMatrixWorld(true);
    const bq = b.getWorldQuaternion(new THREE.Quaternion());
    const fly = clamp(S.speed / 9, 0, 1), dash = S.boost;
    frameQ.copy(bq);
    const drift = Math.sin(hover.t * 1.3) * 0.015 * (1 - fly);
    const hips = toWorld(b, _a.set(0, 0.1 + drift, -0.05), new THREE.Vector3());
    const feet = {};
    for (const sd of ['L', 'R']) {
      const s = sd === 'L' ? 1 : -1;
      // hovering, the legs hang; flying, they fold back along the broom, out of the wind
      const hang = new THREE.Vector3(s * 0.15, -0.66 + Math.sin(hover.t * 1.7 + s) * 0.02, 0.1 + Math.sin(hover.t * 1.1 + s * 2) * 0.03);
      const fold = new THREE.Vector3(s * 0.15, -0.42, -0.3 - dash * 0.08);
      const at = toWorld(b, hang.lerp(fold, fly), new THREE.Vector3());
      feet[sd] = { at, pole: _b.set(s * 0.25, 0, 1).applyQuaternion(bq).clone(), q: new THREE.Quaternion().copy(bq).multiply(qTmp.setFromAxisAngle(Xax, 0.25 + fly * 0.65)) };
    }
    const hands = {
      L: { at: toWorld(b, _a.set(0.03, 0.02, 0.36 + fly * 0.06), new THREE.Vector3()), pole: _b.set(0.7, -0.5, -0.5).applyQuaternion(bq).clone() },
      R: { at: toWorld(b, _a.set(-0.03, 0.02, 0.22 + fly * 0.06), new THREE.Vector3()), pole: _b.set(-0.7, -0.5, -0.5).applyQuaternion(bq).clone() },
    };
    const lean = 0.18 + fly * 0.32 + dash * 0.2;
    rig.pose({ frame: frameQ, hips, pitch: [lean * 0.4, lean * 0.35, lean * 0.25], twist: [0, S.turnRate * -0.1], side: S.roll * -0.35,
      look: clamp(S.vy * 0.04, -0.25, 0.25) + S.pitch * 0.6 + lean * 0.2, headYaw: -S.turnRate * 0.25, feet, hands, curl: 0.85 });
  }

  // ---------------------------------------------------------------- the camera
  const PARAMS = {
    bike: { dist: [4.3, 5.6], height: 1.75, look: 3.2, lookY: 1.1, fov: [52, 60], roll: 0.22, lag: 3.2, top: 8 },
    board: { dist: [3.5, 4.5], height: 1.25, look: 2.6, lookY: 0.75, fov: [54, 66], roll: 0.28, lag: 3.8, top: 7 },
    broom: { dist: [4.4, 6.0], height: 1.35, look: 5.5, lookY: 0.45, fov: [56, 68], roll: 0.38, lag: 3.2, top: 22 },
  };
  function initCam() {
    const c = followCam;
    const p = machines[S.mode] ? S.pos : S.pos;
    cam.yaw = Math.atan2(p.x - c.position.x, p.z - c.position.z);
    cam.dist = Math.hypot(p.x - c.position.x, p.z - c.position.z);
    cam.height = c.position.y - p.y;
    cam.pitch = 0;
    cam.fov = c.fov; cam.roll = 0; cam.lookYaw = 0; cam.lookPitch = 0;
    cam.boom = cam.dist;
    cam.init = true;
  }
  const eye = new THREE.Vector3(), aim = new THREE.Vector3(), tq = new THREE.Quaternion();
  function camBlocked(from, dir, len) {
    for (let s = 0.5; s <= len; s += 0.25) {
      const x = from.x + dir.x * s, y = from.y + dir.y * s, z = from.z + dir.z * s;
      if (y < ground(x, z) + 0.3) return Math.max(0.8, s - 0.3);
      const w = solids.wall(x, z, y);
      if (w.d < 0.3) return Math.max(0.8, s - 0.35);
    }
    return len;
  }
  function updateCam(dt, inp) {
    const P = PARAMS[S.mode];
    if (!P) return;
    if (inp) {
      cam.lookYaw -= inp.lookDX * 0.0045; cam.lookPitch = clamp(cam.lookPitch + inp.lookDY * 0.0035, -0.5, 0.9);
      // moving, the view swings back behind the rider after a while
      if (!inp.looking && inp.idle > 1.6 && S.speed > 1) { cam.lookYaw = damp(wrap(cam.lookYaw), 0, 1.4, dt); cam.lookPitch = damp(cam.lookPitch, 0, 1.2, dt); }
    }
    const k = S.mode === 'bike' ? clamp(S.speed / 8, 0, 1) : S.mode === 'board' ? clamp(S.speed / 7, 0, 1) : clamp(S.speed / 19, 0, 1);
    const zoom = inp ? inp.zoom : 1;
    const travel = S.mode === 'broom' ? S.yaw : S.yaw;
    cam.yaw = dampAngle(cam.yaw, travel + cam.lookYaw, P.lag * (S.mode === 'broom' ? 1 : 1), dt);
    const flightPitch = S.mode === 'broom' ? S.pitch * 0.8 : 0;
    cam.pitch = damp(cam.pitch, flightPitch - cam.lookPitch * 0.9, 3, dt);
    const inside = S.mode === 'broom' ? clamp(S.inCrown * 2.5, 0, 1) : 0;
    cam.dist = damp(cam.dist, (P.dist[0] + (P.dist[1] - P.dist[0]) * k) * zoom * (innerHeight > innerWidth ? 1.25 : 1) * (1 - 0.5 * inside), 2.4, dt);
    cam.height = damp(cam.height, P.height * (0.75 + 0.25 * zoom) + (S.mode === 'broom' ? 0.4 * (1 - k) : 0), 2.4, dt);
    cam.fov = damp(cam.fov, P.fov[0] + (P.fov[1] - P.fov[0]) * k + (S.mode === 'broom' ? 4 * S.boost : 0) + (innerHeight > innerWidth ? 8 : 0), 2.6, dt);
    cam.roll = damp(cam.roll, (S.mode === 'bike' ? S.lean : S.mode === 'board' ? -S.carve * 1.2 : S.roll) * P.roll, 4, dt);
    cam.fp = damp(cam.fp, cam.firstPerson ? 1 : 0, 7, dt);
    // pose: behind and above, in the camera's tilted frame so dives stay framed
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const dx = Math.sin(cam.yaw) * cp, dy = sp, dz = Math.cos(cam.yaw) * cp;
    const ux = -Math.sin(cam.yaw) * sp, uy = cp, uz = -Math.cos(cam.yaw) * sp;
    const by = S.pos.y + (S.mode === 'broom' ? -S.bob * 0.4 : 0);
    const pivot = new THREE.Vector3(S.pos.x, by + P.lookY, S.pos.z);
    eye.set(S.pos.x - dx * cam.dist + ux * cam.height, by - dy * cam.dist + uy * cam.height, S.pos.z - dz * cam.dist + uz * cam.height);
    const dir = eye.clone().sub(pivot); const L = dir.length(); dir.multiplyScalar(1 / L);
    const lim = camBlocked(pivot, dir, L);
    cam.boom = lim < cam.boom ? lim : damp(cam.boom, lim, 3, dt);
    eye.copy(pivot).addScaledVector(dir, Math.min(L, cam.boom));
    // a fine buzz at a broom's full speed and a kick on impact (small: no one should feel ill)
    cam.shake = damp(cam.shake, (S.mode === 'broom' ? 0.006 * S.boost * k : 0) + S.bump * 0.05, 8, dt);
    const t = performance.now() / 1000;
    eye.x += (Math.sin(t * 37.1) + Math.sin(t * 61.7)) * 0.5 * cam.shake;
    eye.y += (Math.sin(t * 43.3 + 1) + Math.sin(t * 71.9)) * 0.5 * cam.shake;
    aim.set(S.pos.x + Math.sin(cam.yaw) * P.look * cp, by + P.lookY + dy * P.look * 0.6 - 0.05, S.pos.z + Math.cos(cam.yaw) * P.look * cp);
    // first person: the eyes (the head bone), looking the way of travel
    if (cam.fp > 0.01) {
      const head = rig.where('head', new THREE.Vector3()).add(new THREE.Vector3(0, 0.1, 0));
      const fwd = new THREE.Vector3(Math.sin(cam.yaw) * cp, dy - 0.08, Math.cos(cam.yaw) * cp);
      head.addScaledVector(fwd, 0.12);
      eye.lerp(head, cam.fp);
      aim.lerp(head.clone().addScaledVector(fwd, 6), cam.fp);
    }
    followCam.position.copy(eye);
    followCam.up.set(0, 1, 0);
    followCam.lookAt(aim);
    followCam.quaternion.multiply(tq.setFromAxisAngle(Zax, -cam.roll * (1 - cam.fp * 0.5)));
    if (Math.abs(followCam.fov - cam.fov) > 0.01) { followCam.fov = cam.fov; followCam.updateProjectionMatrix(); }
    student.setVisible(cam.fp < 0.6);
  }

  // after getting off, the ride's view eases into the walk's own (0.9 s)
  function camHandBack(dt) {
    if (!S.camFrom) return;
    S.camFrom.t = (S.camFrom.t || 0) + dt / 0.9;
    const k = smooth(S.camFrom.t);
    followCam.position.lerpVectors(S.camFrom.pos, followCam.position, k);
    followCam.quaternion.copy(S.camFrom.quat).slerp(tq.copy(followCam.quaternion), k);
    followCam.fov = S.camFrom.fov + (followCam.fov - S.camFrom.fov) * k; followCam.updateProjectionMatrix();
    if (S.camFrom.t >= 1) S.camFrom = null;
  }

  // ---------------------------------------------------------------- per frame
  const steps = { bike: stepBike, board: stepBoard, broom: stepBroom };
  const poses = { bike: poseBike, board: poseBoard, broom: poseBroom };
  let lastInp = null;
  function update(dt) {
    S.t += dt;
    S.bump = Math.max(0, S.bump - dt * 2.2);
    S.touchdown = 0;
    const P = ctx.player();
    const machine = machines[S.mode];
    // fades: the machine being ridden or summoned is painted in; others dissolve (the parked bike stays)
    for (const [k, m] of Object.entries(machines)) {
      const on = (k === S.mode && S.phase !== 'free') || (k === 'bike' && S.parked);
      m.uFade.value = damp(m.uFade.value, on ? 1 : 0, on ? 3.2 : 2.4, dt);
      if (m.uFade.value > 0.995 && on) m.uFade.value = 1;
      m.group.visible = m.uFade.value > 0.01;
    }
    if (S.phase === 'free') {
      // walking: the player has it (and the camera)
      P.update(dt);
      S.pos.copy(P.state.pos); S.speed = P.state.speed; S.yaw = P.state.yaw;
      S.vel.set(P.state.vel.x, P.state.vy || 0, P.state.vel.y);
      if (S.blendT < 1) { S.blendT += dt / S.blendDur; rig.blendFromSnap(S.blendT); }
      camHandBack(dt);
      lastInp = null;
      return;
    }
    if (S.phase === 'summon') {
      // the walker waits (the gait stands) while the machine is painted in beside them
      P.update(dt);                       // (disabled: the walker stands, the walk's camera holds)
      if (S.mode === 'broom') {
        // the broom appears across the walker's hands, then they step over it
        const hl = rig.where('hand.L', new THREE.Vector3()), hr = rig.where('hand.R', new THREE.Vector3());
        broom.group.position.copy(hl.add(hr).multiplyScalar(0.5)).add(new THREE.Vector3(0, 0.15, 0));
        broom.group.quaternion.setFromAxisAngle(Yax, S.yaw);
        broom.group.updateMatrixWorld(true);
        S.pos.set(broom.group.position.x, P.state.pos.y, broom.group.position.z);
      }
      if (S.t > (S.mode === 'bike' && machines.bike.uFade.value > 0.9 ? 0.25 : 0.62)) beginMount();
      return;
    }
    const inp = input.read();
    lastInp = inp;
    // mode keys while riding are taken by the caller (free.js)
    if (S.phase === 'mount' || S.phase === 'ride' || S.phase === 'stop') {
      const live = S.phase === 'mount' ? { ...inp, ax: 0, ay: 0, up: false, down: false, boost: false, jump: false, bell: false, brake: false } : inp;
      steps[S.mode](dt, live);
      poses[S.mode](dt);
      if (S.blendT < 1) { S.blendT += dt / S.blendDur; rig.blendFromSnap(S.blendT); }
      if (S.phase === 'mount' && S.t > S.blendDur) { S.phase = 'ride'; S.t = 0; }
      if (S.phase === 'stop') {
        const settled = S.speed < 0.5 && (S.mode !== 'broom' || S.agl < BROOM.clear + 0.25);
        if (settled || S.t > 4) beginDismount();
      }
      if (S.mode === 'broom') broom.updateRibbon(dt, new THREE.Vector3(-S.vel.x * 0.9, -S.vel.y * 0.9, -S.vel.z * 0.9));
      updateCam(dt, inp);
      student.blob.visible = S.mode !== 'broom' || S.agl < 1.5;
      student.blob.position.set(S.pos.x, ground(S.pos.x, S.pos.z) + 0.02, S.pos.z);
      return;
    }
    if (S.phase === 'dismount') {
      // the walker stands where they stepped down; the bones go back to the gait through the blend
      P.update(dt);
      S.blendT += dt / S.blendDur; rig.blendFromSnap(S.blendT);
      camHandBack(dt);
      if (S.mode === 'broom') { broom.group.position.y = damp(broom.group.position.y, ground(broom.group.position.x, broom.group.position.z) + 0.5, 3, dt); broom.updateRibbon(dt, new THREE.Vector3()); }
      student.blob.visible = true;
      if (S.blendT >= 1) {
        const next = S.want && S.want !== 'walk' ? S.want : null;
        S.mode = 'walk'; S.phase = 'free'; S.want = null;
        P.setEnabled(true);
        ctx.onEvent?.('walk', {});
        if (next) beginSummon(next);
      }
    }
  }

  return {
    state: S, cam, machines, solids, group, update, request,
    get mode() { return S.mode; },
    get phase() { return S.phase; },
    get riding() { return S.phase !== 'free'; },
    get input() { return lastInp; },
    toggleView() { cam.firstPerson = !cam.firstPerson; return cam.firstPerson; },
    /** the parked bike, if the walker stands by it */
    nearParked(x, z) { return S.parked && Math.hypot(S.parked.x - x, S.parked.z - z) < 2.2; },
    /** a summary that could be sent to others riding with you (a future 共游: position, pose parameters) */
    snapshot() { return { mode: S.mode, phase: S.phase, x: +S.pos.x.toFixed(2), y: +S.pos.y.toFixed(2), z: +S.pos.z.toFixed(2), yaw: +S.yaw.toFixed(3), v: +S.speed.toFixed(2), lean: +S.roll.toFixed(3), steer: +S.steer.toFixed(3), crank: +(S.crank % (Math.PI * 2)).toFixed(3), pitch: +S.pitch.toFixed(3) }; },
  };
}
