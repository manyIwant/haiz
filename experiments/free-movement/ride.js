// HAIZ · 自由移动 — Five-Mode Movement Physics, Expressive IK Poses & Per-Mode Camera Grammar
//
// Five genuinely distinct ways of sensing campus space, scale, and atmosphere:
//   1. walk   — HAIZ living gait (three-procedural-locomotion, MIT)
//   2. bike   — Campus bicycle: wheelbase curvature, delayed gravity lean, cannon-es fork/saddle
//               spring suspension, standing climb rock, braking weight transfer, brass bell, parked
//               persistence, and live 1st-person handlebar cockpit with visible hands!
//   3. board  — Skateboard: discrete back-foot push strokes, S-carve pumping speed build, kick-turn,
//               Ollie (Space), Kickflip 360° deck spin (Q), Manual nose-up balance (Shift), and
//               low VX-style wide-angle skate-film follow camera!
//   4. broom  — Bamboo broom (Petalwake-inspired, MIT): speed-scaled banked turns, height<->speed
//               dive exchange, automatic circular-arc dive pull-out, damped-spring ground cushion,
//               low-skim 乘风 Gust charging, soft tree canopy flight, inertial lantern, and
//               rooftop perched cinematic orbit (double-tap Space / perch)!
//   5. glider — Terminalia Monsoon Glider (榄仁纸鸢 · NEW!): zero-engine sailplane polar,
//               pitch-for-speed swoops, soaring spirals inside 8 visible campus thermal columns,
//               Haikou wind drift, backlit leaf flex, panoramic scroll cam & under-wing cockpit!
import * as THREE from 'three';
import { move, nearest, freeSpot } from '../../lanren/world/collide.js';
import { U } from '../../lanren/ruhua-stroll/atmos.js';
import { createBike, createBoard, createBroom, createGlider } from './vehicles.js';

const clamp = THREE.MathUtils.clamp;
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const dampAngle = (cur, target, rate, dt) => cur + wrap(target - cur) * (1 - Math.exp(-rate * dt));
const G = 9.81;
const Yax = new THREE.Vector3(0, 1, 0), Xax = new THREE.Vector3(1, 0, 0), Zax = new THREE.Vector3(0, 0, 1);

export const MODES = {
  walk: { key: 'walk', name: '步行', glyph: '步', subtitle: '人尺漫步' },
  bike: { key: 'bike', name: '单车', glyph: '骑', subtitle: '林荫车铃' },
  board: { key: 'board', name: '滑板', glyph: '滑', subtitle: '微地泵滑' },
  broom: { key: 'broom', name: '竹扫帚', glyph: '飞', subtitle: '贴地卷风' },
  glider: { key: 'glider', name: '榄仁纸鸢', glyph: '鸢', subtitle: '乘风滑翔' },
};

// Solid building roofs & walls for aerial flight & camera unblocking
export function buildSolids(world) {
  const ground = world.geo.frame.ground;
  const byId = new Map(world.model.buildings.map((b) => [b.id, b]));
  const rects = [];
  const add = (r, b, bottom = ground - 1) => {
    const h = b?.height || 12;
    rects.push({
      id: r.id, name: b?.name || '', cx: r.cx, cz: r.cz,
      hw: r.hw + 0.3, hd: r.hd + 0.3,
      c: Math.cos(r.rot || 0), s: Math.sin(r.rot || 0),
      top: ground + h, bottom,
    });
  };
  const hulls = world.hulls?.length ? world.hulls : [];
  const covered = new Set();
  for (const h of hulls) {
    const b = byId.get(h.id);
    if (!b || b.form === 'corr') continue;
    add(h, b); covered.add(h.id);
  }
  for (const b of world.model.buildings) {
    if (b.form === 'corr') add({ id: b.id, cx: b.cx, cz: b.cz, hw: b.w / 2, hd: b.d / 2, rot: b.rot }, b, ground + 3.1);
    else if (!covered.has(b.id)) add({ id: b.id, cx: b.cx, cz: b.cz, hw: b.w / 2, hd: b.d / 2, rot: b.rot }, b);
  }
  for (const r of rects) r.reach = Math.hypot(r.hw, r.hd);
  const CELL = 16, grid = new Map(), key = (i, j) => i * 100003 + j;
  for (const r of rects) {
    for (let i = Math.floor((r.cx - r.reach) / CELL); i <= Math.floor((r.cx + r.reach) / CELL); i++) {
      for (let j = Math.floor((r.cz - r.reach) / CELL); j <= Math.floor((r.cz + r.reach) / CELL); j++) {
        const k = key(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(r);
      }
    }
  }
  const near = (x, z) => grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) || [];
  const local = (r, x, z) => { const dx = x - r.cx, dz = z - r.cz; return [dx * r.c - dz * r.s, dx * r.s + dz * r.c]; };

  return {
    rects,
    topAt(x, z) {
      let t = -Infinity;
      for (const r of near(x, z)) {
        const [lx, lz] = local(r, x, z);
        if (Math.abs(lx) <= r.hw && Math.abs(lz) <= r.hd && r.top > t) t = r.top;
      }
      return t;
    },
    wall(x, z, y) {
      let best = { d: Infinity, nx: 0, nz: 0, top: 0 };
      for (const r of near(x, z)) {
        if (y > r.top + 0.05 || y < r.bottom) continue;
        const [lx, lz] = local(r, x, z);
        const qx = Math.abs(lx) - r.hw, qz = Math.abs(lz) - r.hd;
        let d, nx, nz;
        if (qx > 0 || qz > 0) {
          const ox = Math.max(qx, 0), oz = Math.max(qz, 0);
          d = Math.hypot(ox, oz);
          nx = ox * Math.sign(lx) / (d || 1); nz = oz * Math.sign(lz) / (d || 1);
        } else if (qx > qz) { d = qx; nx = Math.sign(lx) || 1; nz = 0; }
        else { d = qz; nx = 0; nz = Math.sign(lz) || 1; }
        if (d < best.d) best = { d, nx: nx * r.c + nz * r.s, nz: -nx * r.s + nz * r.c, top: r.top };
      }
      return best;
    },
  };
}

export function createRide(ctx) {
  const { world, student, rig, input, physics, fx, heightAt, getColliders, followCam, surface } = ctx;
  const solids = buildSolids(world);
  const D = rig.dims;
  const group = new THREE.Group(); group.name = 'fm-rides';
  world.group.add(group);

  const saddleH = clamp(0.115 + 0.075 + Math.sqrt(Math.max(0.3, (D.leg * 0.955) ** 2 - 0.2 ** 2)) - 0.095, 0.72, 1.0);
  const bike = createBike({ saddleH });
  const board = createBoard();
  const broom = createBroom();
  const glider = createGlider();
  const machines = { bike, board, broom, glider };
  for (const m of Object.values(machines)) {
    m.group.visible = false;
    group.add(m.group);
    m.group.traverse((o) => o.layers.set(ctx.layer));
  }

  const S = {
    mode: 'walk', phase: 'free', // free | summon | mount | ride | stop | dismount
    t: 0, want: null,
    pos: new THREE.Vector3(), yaw: 0, speed: 0, vel: new THREE.Vector3(), prevVel: new THREE.Vector3(), vy: 0,
    lean: 0, steer: 0, pitch: 0, roll: 0, turnRate: 0,
    // Bike
    crank: 0, cadence: 0, pedalling: 0, stand: 0, footDown: 0, coastT: 0, braking: false, bellT: 0,
    // Board
    push: -1, pushes: 0, brakeT: 0, ollie: -1, flipT: -1, manual: 0, air: false, airT: 0,
    carve: 0, carveDir: 0, carveFlow: 0, carveTimer: 0, crouch: 0, pivot: 0, trickLabel: '', trickT: 0,
    // Broom & Glider
    agl: 0, bob: 0, bobV: 0, boost: 0, gust: 0.45, holdAgl: -1, flare: 0, sink: 0, inCrown: 0,
    perched: false, perchOrbit: 0, thermalLift: 0, thermalName: '', overWater: false,
    bump: 0, touchdown: 0, surface: 'pave', wallHit: 0,
    parked: null,
    blendT: 1, blendDur: 0.4,
    ribbonAnchors: { L: new THREE.Vector3(), R: new THREE.Vector3() },
  };

  const cam = {
    yaw: 0, pitch: 0.18, dist: 4.8, height: 1.75, fov: 52, roll: 0,
    lookYaw: 0, lookPitch: 0, boom: 4.8, fp: 0, firstPerson: false,
    shake: 0, cineK: 0, cineAz: 0, init: false,
  };

  const qP = new THREE.Quaternion(), qR = new THREE.Quaternion(), qTmp = new THREE.Quaternion();
  const machineQ = (yaw, pitchUp, roll, out = new THREE.Quaternion()) =>
    out.setFromAxisAngle(Yax, yaw).multiply(qP.setFromAxisAngle(Xax, -pitchUp)).multiply(qR.setFromAxisAngle(Zax, roll));
  const toWorld = (obj, v, out = new THREE.Vector3()) => out.copy(v).applyMatrix4(obj.matrixWorld);
  const ground = (x, z) => heightAt(x, z);

  function placeMachine(m, x, z, yaw) {
    m.group.position.set(x, ground(x, z), z);
    m.group.quaternion.setFromAxisAngle(Yax, yaw);
    m.group.visible = true;
    m.group.updateMatrixWorld(true);
  }

  function showTrick(label) {
    S.trickLabel = label;
    S.trickT = 1.6;
    ctx.onEvent?.('trickText', { label });
  }

  // ======================================================================== MODE SWITCHING
  function request(mode) {
    if (!MODES[mode] || (mode === S.mode && S.phase === 'ride')) return false;
    if (mode === S.mode && S.phase !== 'free') return false;
    // Seamless mid-air transition between Bamboo Broom and Terminalia Monsoon Glider!
    if (((S.mode === 'broom' && mode === 'glider') || (S.mode === 'glider' && mode === 'broom'))
      && (S.phase === 'ride' || S.phase === 'mount')) {
      const prev = S.mode;
      S.want = null; S.mode = mode; S.phase = 'mount'; S.t = 0; S.perched = false; S.trickT = 0; S.trickLabel = '';
      rig.capture(); S.blendT = 0; S.blendDur = 0.48;
      machines[mode].uFade.value = 0;
      const gy = ground(S.pos.x, S.pos.z);
      if (mode === 'glider') {
        glider.resetRibbons(); fx.resetRibbons();
        S.pos.y = Math.max(S.pos.y, gy + 11.0);
        S.speed = Math.max(S.speed, 10.2);
        S.vy = Math.max(S.vy, 1.4);
        S.agl = S.pos.y - gy;
      } else {
        broom.resetRibbon(); fx.resetRibbons();
        S.holdAgl = Math.max(1.2, S.agl);
      }
      fx.burst('leaf', S.pos.x, S.pos.y, S.pos.z, 18, 3.8);
      ctx.onEvent?.('mount', { mode, from: prev });
      return true;
    }
    if (S.phase === 'summon' || S.phase === 'mount' || S.phase === 'dismount') { S.want = mode; return true; }
    S.want = mode;
    if (S.mode === 'walk') beginSummon(mode);
    else { S.perched = false; S.phase = 'stop'; S.t = 0; }
    return true;
  }

  function beginSummon(mode) {
    const P = ctx.player().state;
    S.mode = mode; S.phase = 'summon'; S.t = 0; S.perched = false;
    ctx.player().setEnabled(false);
    S.pos.set(P.pos.x, P.pos.y, P.pos.z);
    S.yaw = P.yaw; S.speed = 0; S.vy = 0; S.lean = 0; S.steer = 0; S.pitch = 0; S.roll = 0;
    S.carveFlow = 0; S.flipT = -1; S.ollie = -1; S.manual = 0; S.air = false; S.thermalLift = 0; S.trickT = 0; S.trickLabel = '';
    const fxD = Math.sin(S.yaw), fzD = Math.cos(S.yaw), rx = -Math.cos(S.yaw), rz = Math.sin(S.yaw);
    const col = getColliders();
    if (mode === 'bike') {
      let x = P.pos.x + rx * 0.55, z = P.pos.z + rz * 0.55, yaw = S.yaw;
      if (S.parked && Math.hypot(S.parked.x - P.pos.x, S.parked.z - P.pos.z) < 3.4) ({ x, z, yaw } = S.parked);
      else { const f = col ? freeSpot(col, x, z, 0.45) : { x, z }; x = f.x; z = f.z; bike.uFade.value = 0; }
      S.pos.set(x, ground(x, z), z); S.yaw = yaw;
      placeMachine(bike, x, z, yaw);
      setBikeParked(true);
    } else if (mode === 'board') {
      const x = P.pos.x + fxD * 0.45, z = P.pos.z + fzD * 0.45;
      S.pos.set(x, ground(x, z), z);
      board.uFade.value = 0; placeMachine(board, x, z, S.yaw);
      board.deck.rotation.set(0, 0, 0);
    } else if (mode === 'broom') {
      broom.uFade.value = 0; broom.resetRibbon(); fx.resetRibbons();
      S.pos.set(P.pos.x, P.pos.y, P.pos.z); S.agl = 0;
    } else if (mode === 'glider') {
      glider.uFade.value = 0; glider.resetRibbons(); fx.resetRibbons();
      S.pos.set(P.pos.x, P.pos.y, P.pos.z);
      placeMachine(glider, P.pos.x, P.pos.z, S.yaw);
    }
    ctx.onEvent?.('summon', { mode });
  }

  function beginMount() {
    S.phase = 'mount'; S.t = 0; S.want = null;
    rig.capture(); S.blendT = 0; S.blendDur = S.mode === 'broom' || S.mode === 'glider' ? 0.55 : 0.42;
    if (S.mode === 'broom') {
      S.pos.y = Math.max(S.pos.y, ground(S.pos.x, S.pos.z)) + 1.0;
      S.vy = 0.8; S.holdAgl = 1.05; S.gust = Math.max(S.gust, 0.5);
    } else if (S.mode === 'glider') {
      // Monsoon gust launch: smoothly lifts glider into clear airspeed so you can immediately soar!
      const gy = ground(S.pos.x, S.pos.z);
      S.pos.y = Math.max(S.pos.y + 4.5, gy + 11.5);
      S.speed = 9.5; S.vy = 2.4; S.pitch = 0.08; S.agl = S.pos.y - gy;
      fx.burst('leaf', S.pos.x, gy + 0.5, S.pos.z, 18, 4.0);
    } else if (S.mode === 'bike') {
      S.parked = null; setBikeParked(false);
    }
    input.setActive(true);
    initCam();
    ctx.onEvent?.('mount', { mode: S.mode });
  }

  function beginDismount() {
    S.phase = 'dismount'; S.t = 0; S.perched = false;
    const m = S.mode;
    rig.setFirstPerson(false);
    rig.capture();
    const lx = Math.cos(S.yaw), lz = -Math.sin(S.yaw);
    let x = S.pos.x + lx * (m === 'board' ? 0.1 : 0.5), z = S.pos.z + lz * (m === 'board' ? 0.1 : 0.5);
    if (m === 'board') { x = S.pos.x - Math.sin(S.yaw) * 0.2; z = S.pos.z - Math.cos(S.yaw) * 0.2; }
    const col = getColliders();
    if (col) ({ x, z } = freeSpot(col, x, z, 0.34));
    const p = ctx.player();
    S.camFrom = { pos: followCam.position.clone(), quat: followCam.quaternion.clone(), fov: followCam.fov };
    p.place(x, z, S.yaw);
    p.state.camYaw = cam.yaw; p.cam.yaw.v = cam.yaw;
    S.blendT = 0; S.blendDur = 0.4;
    // Only park the bicycle on the campus roadside when stepping off to walk (dissolve cleanly on direct vehicle swap!)
    if (m === 'bike' && (!S.want || S.want === 'walk')) { S.parked = { x: S.pos.x, z: S.pos.z, yaw: S.yaw }; setBikeParked(true); }
    input.setActive(false);
    ctx.onEvent?.('dismount', { mode: m });
  }

  function setBikeParked(on) {
    bike.stand.rotation.x = on ? 0 : -1.3;
    if (on) {
      bike.body.rotation.set(0, 0, -0.1);
      bike.setSteer(0.25);
      bike.crank.rotation.x = 1.2;
      bike.pedals.L.rotation.x = bike.pedals.R.rotation.x = -1.2;
    }
  }

  // Fast Travel (from Foldable Campus Map, inspired by 网上南宁!)
  function teleportTo(x, z, yaw = S.yaw) {
    const col = getColliders();
    const pt = col ? freeSpot(col, x, z, 0.5) : { x, z };
    const gy = ground(pt.x, pt.z);
    S.perched = false;
    if (S.phase === 'free') {
      ctx.player().place(pt.x, pt.z, yaw);
      S.pos.set(pt.x, gy, pt.z); S.yaw = yaw;
    } else {
      const airH = S.mode === 'glider' ? 16 : S.mode === 'broom' ? 6 : 0;
      S.pos.set(pt.x, gy + airH, pt.z);
      S.yaw = yaw;
      S.speed = S.mode === 'glider' ? 9.0 : 0;
      S.vy = 0; S.agl = airH;
      cam.yaw = yaw; cam.lookYaw = 0; cam.lookPitch = 0;
      if (S.mode === 'broom') broom.resetRibbon();
      if (S.mode === 'glider') glider.resetRibbons();
      fx.resetRibbons();
    }
    ctx.onEvent?.('teleport', { x: pt.x, z: pt.z });
  }

  // ======================================================================== 2. BICYCLE PHYSICS & POSE
  const BIKE_ROLL_MAX = 0.5;
  const BIKE = { cruise: 5.6, sprint: 8.6, max: 10.5, accel: 2.1, brake: 5.2, gear: 2.3 };
  function stepBike(dt, inp) {
    const col = getColliders();
    const surf = S.surface = surface(S.pos.x, S.pos.z);
    const rolling = surf === 'lawn' ? 0.55 : 0.085;
    const stand = inp.boost && inp.ay > 0.2;
    S.stand = damp(S.stand, stand ? 1 : 0, 5.2, dt);
    const target = inp.ay > 0.1 ? (stand ? BIKE.sprint : BIKE.cruise) * Math.min(1, inp.ay * 1.15) * (surf === 'lawn' ? 0.72 : 1) : 0;
    let a = -rolling - 0.004 * S.speed * S.speed;
    S.pedalling = damp(S.pedalling, inp.ay > 0.1 && S.speed < target + 0.35 ? 1 : 0, 6, dt);
    let accelForce = 0, brakeForce = 0;
    if (inp.ay > 0.1 && S.speed < target) {
      accelForce = Math.min(BIKE.accel, (target - S.speed) * 1.35 + 0.38) * (stand ? 1.48 : 1);
      a += accelForce + rolling;
    }
    S.braking = !!(inp.brake && inp.ay < -0.1 && S.speed > 0.5);
    if (S.braking) { brakeForce = Math.min(1, -inp.ay * 1.3); a -= BIKE.brake * brakeForce; }
    if (S.phase === 'stop') { brakeForce = 1; a -= BIKE.brake; }
    const prevSpeed = S.speed;
    S.speed = clamp(S.speed + a * dt, 0, BIKE.max);
    if (S.speed < 0.05 && !(inp.ay > 0.1)) S.speed = 0;

    // Speed-dependent steering curvature & delayed equilibrium lean
    const dMax = 0.62 / (1 + S.speed * 0.32);
    S.steer = damp(S.steer, -inp.ax * dMax, 7.2, dt);
    const kappa = Math.tan(S.steer) / bike.wheelBase;
    S.turnRate = S.speed * kappa;
    S.yaw = wrap(S.yaw + S.turnRate * dt);
    const leanT = clamp(-Math.atan(S.speed * S.speed * kappa / G), -BIKE_ROLL_MAX, BIKE_ROLL_MAX);
    S.lean = damp(S.lean, leanT, 5.5, dt);

    const fxD = Math.sin(S.yaw), fzD = Math.cos(S.yaw);
    const dx = fxD * S.speed * dt, dz = fzD * S.speed * dt;
    let bumpImp = 0;
    if (col) {
      const r = move(col, S.pos.x, S.pos.z, dx, dz, 0.42);
      if (r.hit) {
        const n = nearest(col, r.x, r.z);
        const into = -(fxD * n.nx + fzD * n.nz);
        if (into > 0.15) {
          if (into > 0.55 && S.speed > 2 && S.wallHit <= 0) {
            bumpImp = S.bump = Math.min(1, S.speed / 5.5);
            ctx.onEvent?.('bump', { speed: S.speed });
            S.wallHit = 0.55;
          }
          S.speed *= 1 - 0.85 * into * Math.min(1, dt * 10);
          S.yaw = dampAngle(S.yaw, Math.atan2(fxD + n.nx * into, fzD + n.nz * into), 6 * into, dt);
        }
      }
      S.pos.x = r.x; S.pos.z = r.z;
    } else { S.pos.x += dx; S.pos.z += dz; }
    S.wallHit -= dt;

    // Real fork & saddle spring-damper suspension from cannon-es physics module!
    const susp = physics.stepSuspension(dt, {
      speed: S.speed, surface: surf, brakeForce, accelForce: accelForce * 0.35, bumpImpulse: bumpImp, air: false,
    });

    const yb = ground(S.pos.x - fxD * 0.43, S.pos.z - fzD * 0.43);
    const yf = ground(S.pos.x + fxD * 0.65, S.pos.z + fzD * 0.65);
    const yc = ground(S.pos.x, S.pos.z);
    S.pos.y = damp(S.pos.y, Math.max(yc, (yb + yf) / 2), 18, dt);
    S.pitch = damp(S.pitch, Math.atan2(yf - yb, bike.wheelBase) + susp.pitch, 12, dt);

    const wheelRate = S.speed / bike.R;
    if (S.pedalling > 0.5) { S.cadence = wheelRate / BIKE.gear; S.coastT = 0; }
    else {
      S.coastT += dt;
      const rest = Math.round((S.crank - Math.PI / 2) / Math.PI) * Math.PI + Math.PI / 2;
      S.cadence = damp(S.cadence, (rest - S.crank) * 4, 6, dt);
    }
    S.crank += S.cadence * dt;

    const rock = S.stand * Math.sin(S.crank) * 0.13 * Math.min(1, S.speed / 2);
    S.footDown = damp(S.footDown, S.speed < 0.35 && S.phase !== 'stop' ? 1 : 0, 7, dt);
    S.roll = clamp(S.lean + rock - S.footDown * 0.12, -BIKE_ROLL_MAX, BIKE_ROLL_MAX);

    if (inp.bell) { bike.ringBell(); S.bellT = 0.35; ctx.onEvent?.('bell', { x: S.pos.x, z: S.pos.z }); }
    S.bellT = Math.max(0, S.bellT - dt);
    S.prevVel.copy(S.vel);
    S.vel.set(fxD * S.speed, 0, fzD * S.speed);

    bike.group.position.copy(S.pos);
    bike.group.quaternion.setFromAxisAngle(Yax, S.yaw).multiply(qP.setFromAxisAngle(Xax, -S.pitch));
    bike.body.rotation.set(0, 0, S.roll);
    bike.setSteer(S.steer);
    bike.rear.rotation.x += wheelRate * dt;
    bike.front.rotation.x += wheelRate * dt;
    bike.crank.rotation.x = S.crank;
    bike.pedals.L.rotation.x = bike.pedals.R.rotation.x = -S.crank;
    bike.updateDetails(dt, {
      forkY: susp.forkY, saddleY: susp.saddleY,
      accel: (S.speed - prevSpeed) / Math.max(dt, 1e-3),
      latG: S.speed * S.turnRate, speed: S.speed,
    });
    bike.group.updateMatrixWorld(true);
  }

  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
  const frameQ = new THREE.Quaternion(), footQ = new THREE.Quaternion();

  function poseBike() {
    const body = bike.body;
    body.updateMatrixWorld(true);
    const bq = body.getWorldQuaternion(new THREE.Quaternion());
    const st = S.stand, fd = S.footDown;
    const hipsB = _a.copy(bike.saddle).add(_d.set(0, 0.105 + st * 0.2 + physics.susp.saddleY, -0.02 + st * 0.2));
    const hips = toWorld(body, hipsB, new THREE.Vector3());
    frameQ.copy(bq);
    const lean = 0.24 + 0.1 * Math.min(1, S.speed / 6) + st * 0.60 - fd * 0.12;
    const feet = {};
    for (const sd of ['L', 'R']) {
      const p = bike.pedals[sd].getWorldPosition(new THREE.Vector3());
      const up = _b.set(0, 1, 0).applyQuaternion(bq), fw = _c.set(0, 0, 1).applyQuaternion(bq);
      const c = S.crank + (sd === 'L' ? Math.PI : 0);
      const at = p.addScaledVector(up, 0.075).addScaledVector(fw, -0.035);
      const ank = 0.12 + 0.16 * Math.sin(c + 0.6);
      feet[sd] = {
        at,
        pole: _d.set(sd === 'L' ? 0.12 : -0.12, 0.1, 1).applyQuaternion(bq).clone(),
        q: footQ.copy(bq).multiply(qTmp.setFromAxisAngle(Xax, ank)).clone(),
      };
    }
    if (fd > 0.01) {
      const gw = toWorld(bike.group, new THREE.Vector3(0.36, 0, -0.08), new THREE.Vector3());
      gw.y = ground(gw.x, gw.z) + D.ankle;
      feet.L.at.lerp(gw, fd);
      feet.L.q = new THREE.Quaternion().setFromAxisAngle(Yax, S.yaw).slerp(feet.L.q, 1 - fd);
    }
    const hands = {};
    for (const sd of ['L', 'R']) {
      const g = bike.grip(sd, S.steer, new THREE.Vector3());
      g.add(_d.set(sd === 'L' ? -0.025 : 0.025, 0.025, -0.05));
      if (sd === 'R' && S.bellT > 0.05) g.x += 0.06 * Math.sin((S.bellT / 0.35) * Math.PI); // reach for brass bell!
      hands[sd] = { at: toWorld(body, g, new THREE.Vector3()), pole: _b.set(sd === 'L' ? 0.75 : -0.75, -0.5, -0.6).applyQuaternion(bq).clone() };
    }
    const spec = (l) => ({
      frame: frameQ, hips,
      pitch: [l * 0.4, l * 0.35, l * 0.3],
      twist: [S.steer * 0.25 + st * Math.sin(S.crank) * 0.12, -st * Math.sin(S.crank) * 0.1],
      side: -S.roll * 0.25, look: -0.04 + st * 0.15, headYaw: S.steer * 0.9, feet, hands, curl: 0.82,
    });
    rig.pose(spec(lean));
    const reach = Math.max(rig.where('upperarm.L', _a).distanceTo(hands.L.at), rig.where('upperarm.R', _b).distanceTo(hands.R.at));
    const extra = clamp((reach - D.arm * 0.95) / 0.42, 0, 0.6);
    if (extra > 0.01) { S.reachLean = damp(S.reachLean || 0, extra, 8, 1 / 30); rig.pose(spec(lean + S.reachLean)); }
  }

  // ======================================================================== 3. SKATEBOARD PHYSICS & POSE
  const STANCE = { front: 0.20, back: -0.28, half: 0.24 };
  const BOARD = { pushTo: 6.4, kick: 1.45, max: 9.8, roll: 0.052, lawn: 3.1, brake: 2.7 };
  function stepBoard(dt, inp) {
    const col = getColliders();
    const surf = S.surface = surface(S.pos.x, S.pos.z);

    // Discrete back-foot push strokes
    if (S.push < 0 && inp.ay > 0.25 && !S.air && S.speed < BOARD.pushTo && S.phase === 'ride') { S.push = 0; S.pushes++; }
    if (S.push >= 0) {
      const prev = S.push; S.push += dt / 0.60;
      if (S.push > 0.20 && S.push < 0.56) S.speed += (BOARD.kick / 0.36) * dt / 0.60 * (1 - S.speed / 9.8);
      if (prev < 0.20 && S.push >= 0.20) ctx.onEvent?.('kick', {});
      if (S.push >= 1) S.push = -1;
    }

    // S-Carve Pumping: alternating deep left/right carves on paving genuinely builds forward momentum!
    S.carveTimer = Math.max(0, S.carveTimer - dt);
    if (S.carveTimer <= 0) S.carveFlow = 0;
    if (!S.air && surf !== 'lawn' && S.speed > 1.8 && Math.abs(inp.ax) > 0.65) {
      const dir = Math.sign(inp.ax);
      if (dir !== S.carveDir) {
        if (S.carveDir !== 0 && S.carveTimer > 0.15) {
          S.carveFlow = Math.min(8, S.carveFlow + 1);
          S.speed = Math.min(BOARD.max, S.speed + 0.58);
          if (S.carveFlow >= 2) showTrick(`S-Carve 泵滑 ×${S.carveFlow}`);
        }
        S.carveDir = dir;
        S.carveTimer = 1.6;
      }
    }

    // Manual nose-up balance while holding Shift on paving
    const wantManual = !!(inp.boost && !S.air && S.push < 0 && S.speed > 1.4 && surf !== 'lawn' && S.phase === 'ride');
    S.manual = damp(S.manual, wantManual ? 1 : 0, 7, dt);

    let a = -(surf === 'lawn' ? BOARD.lawn : BOARD.roll * (1 - S.manual * 0.25)) - 0.0055 * S.speed * S.speed;
    const braking = inp.ay < -0.25 && !S.air && S.push < 0;
    S.brakeT = damp(S.brakeT, braking ? 1 : 0, 6, dt);
    if (braking) a -= BOARD.brake * S.brakeT;
    if (S.phase === 'stop') a -= BOARD.brake * 1.25;
    if (!S.air) S.speed = clamp(S.speed + a * dt, 0, BOARD.max);
    if (S.speed < 0.04) S.speed = 0;

    // Leaning rolls deck & turns trucks
    const leanT = -inp.ax * 0.32 * (S.push >= 0 ? 0.3 : 1);
    S.carve = damp(S.carve, S.air ? S.carve * 0.95 : leanT, 7.5, dt);
    if (S.speed > 0.4) S.turnRate = S.speed * Math.tan(S.carve * 1.55) / 0.68;
    else S.turnRate = damp(S.turnRate, -inp.ax * 2.2, 8, dt);
    S.pivot = damp(S.pivot, S.speed < 0.4 && Math.abs(inp.ax) > 0.2 ? 1 : 0, 8, dt);
    S.yaw = wrap(S.yaw + S.turnRate * dt);

    // Ollie (Space) & Kickflip (Q — 360° barrel flip!)
    if ((inp.jump || inp.trick) && !S.air && S.ollie < 0 && S.phase === 'ride') {
      S.ollie = 0;
      S.flipT = inp.trick ? 0 : -1;
    }
    if (S.ollie >= 0) {
      S.ollie += dt;
      if (S.ollie > 0.13 && !S.air) {
        S.air = true;
        S.vy = S.flipT >= 0 ? 3.75 : 3.35;
        S.airT = 0;
        ctx.onEvent?.(S.flipT >= 0 ? 'trick' : 'pop', {});
        showTrick(S.flipT >= 0 ? 'Kickflip · 360° 尖翻' : 'Ollie · 豚跳');
      }
    }
    if (S.flipT >= 0 && S.air) S.flipT += dt;

    const fxD = Math.sin(S.yaw), fzD = Math.cos(S.yaw);
    const dx = fxD * S.speed * dt, dz = fzD * S.speed * dt;
    if (col) {
      const r = move(col, S.pos.x, S.pos.z, dx, dz, 0.32);
      if (r.hit) {
        const n = nearest(col, r.x, r.z), into = -(fxD * n.nx + fzD * n.nz);
        if (into > 0.2) {
          S.speed *= 1 - 0.88 * into * Math.min(1, dt * 10);
          S.yaw = dampAngle(S.yaw, Math.atan2(fxD + n.nx * into, fzD + n.nz * into), 6 * into, dt);
          if (into > 0.55 && S.wallHit <= 0 && S.speed > 1.5) { S.bump = 0.6; S.wallHit = 0.55; ctx.onEvent?.('bump', {}); }
        }
      }
      S.pos.x = r.x; S.pos.z = r.z;
    } else { S.pos.x += dx; S.pos.z += dz; }
    S.wallHit -= dt;

    const gy = ground(S.pos.x, S.pos.z);
    if (S.air) {
      S.airT += dt; S.vy -= G * dt; S.pos.y += S.vy * dt;
      if (S.pos.y <= gy && S.vy < 0) {
        S.pos.y = gy; S.air = false; S.ollie = -1; S.flipT = -1;
        S.crouch = Math.min(1, -S.vy * 0.26);
        fx.burst('dust', S.pos.x, gy + 0.04, S.pos.z, 10, 2.2);
        ctx.onEvent?.('land', { v: -S.vy });
        S.vy = 0;
      }
    } else {
      if (gy - S.pos.y > 0.09) { S.speed *= 0.35; S.bump = 0.5; S.pos.y = gy; }
      else if (S.pos.y - gy > 0.05) { S.air = true; S.vy = 0; S.airT = 0.3; }
      else S.pos.y = damp(S.pos.y, gy, 20, dt);
    }
    S.crouch = damp(S.crouch, 0, 5.2, dt);
    S.prevVel.copy(S.vel);
    S.vel.set(fxD * S.speed, S.vy, fzD * S.speed);

    // Deck orientation: carve roll + manual nose-up + Ollie pitch + Kickflip 360° barrel spin!
    const o = S.ollie;
    let pitch = 0, lift = 0, flipRoll = 0;
    if (o >= 0) {
      if (o < 0.13) pitch = 0;
      else if (o < 0.27) pitch = smooth((o - 0.13) / 0.14) * 0.44;
      else pitch = 0.44 * (1 - smooth((o - 0.27) / 0.22));
      lift = o > 0.13 ? Math.sin(Math.min(1, (o - 0.13) / 0.62) * Math.PI) * 0.06 : 0;
    }
    if (S.flipT >= 0 && S.air) {
      flipRoll = smooth(clamp(S.flipT / 0.46, 0, 1)) * Math.PI * 2;
    }
    board.group.position.set(S.pos.x, S.pos.y + lift, S.pos.z);
    board.group.quaternion.setFromAxisAngle(Yax, S.yaw);
    board.deck.rotation.set(-pitch - S.pivot * 0.18 - S.manual * 0.22, 0, -S.carve + flipRoll);
    board.deck.position.set(0, pitch * 0.1 + S.manual * 0.04, 0);
    board.trucks[0].rotation.y = S.carve * 0.92;
    board.trucks[1].rotation.y = -S.carve * 0.92;
    for (const w of board.wheels) w.rotation.x += S.speed / 0.028 * dt;
    board.group.updateMatrixWorld(true);
  }

  function poseBoard() {
    const deck = board.deck;
    deck.updateMatrixWorld(true);
    // Keep rider frame level during kickflip barrel spin (so the board flips UNDER the rider's feet!)
    const baseQ = board.group.getWorldQuaternion(new THREE.Quaternion());
    const dq = S.flipT >= 0 && S.air ? baseQ : deck.getWorldQuaternion(new THREE.Quaternion());
    const push = S.push >= 0 ? Math.sin(Math.min(1, S.push) * Math.PI) : 0;
    const open = Math.max(push, S.brakeT * 0.6);
    const fq = new THREE.Quaternion().copy(dq).multiply(qTmp.setFromAxisAngle(Yax, -Math.PI / 2 + open * 1.0));
    frameQ.copy(fq);

    const o = S.ollie;
    const pre = o >= 0 && o < 0.13 ? smooth(o / 0.13) : 0;
    const tuck = S.air ? Math.sin(Math.min(1, S.airT / 0.58) * Math.PI) : 0;
    const crouch = 0.038 + 0.17 * pre + 0.24 * tuck + 0.22 * S.crouch + 0.065 * Math.abs(S.carve) / 0.32 + push * 0.1 + S.manual * 0.06;
    const top = board.topY;
    const span = Math.max(0.05, STANCE.half - D.hipW * 0.5);
    const stand = Math.sqrt(Math.max(0.2, (D.leg * 0.955) ** 2 - span * span)) + (D.hipDrop || 0);
    const hipY = top + D.ankle * 0.9 + stand - crouch;
    const hipRef = S.flipT >= 0 && S.air ? board.group : deck;
    const hips = toWorld(hipRef, new THREE.Vector3(S.carve * 0.25, hipY, -0.04 + push * 0.12 - S.manual * 0.11), new THREE.Vector3());

    const feet = {};
    const fwdW = new THREE.Vector3(0, 0, 1).applyQuaternion(fq);
    const fL = toWorld(hipRef, _a.set(0.0, top + D.ankle * 0.9 + (S.manual * 0.06), STANCE.front + push * 0.04), new THREE.Vector3());
    feet.L = { at: fL, pole: _b.set(-1, 0, 0.45).applyQuaternion(dq).clone(), q: new THREE.Quaternion().copy(dq).multiply(qTmp.setFromAxisAngle(Yax, -Math.PI / 2 + 0.45 + push * 0.9)) };
    const rAt = toWorld(hipRef, _a.set(0.01, top + D.ankle * 0.9, STANCE.back), new THREE.Vector3());
    const rq = new THREE.Quaternion().copy(dq).multiply(qTmp.setFromAxisAngle(Yax, -Math.PI / 2 - 0.15));
    if (push > 0.001) {
      const p = S.push;
      const zs = 0.15 - 0.86 * smooth((p - 0.1) / 0.6);
      const gp = toWorld(board.group, _b.set(-0.21, 0, zs), new THREE.Vector3());
      gp.y = ground(gp.x, gp.z) + D.ankle + Math.max(0, Math.sin(p * Math.PI * 2 - 0.6)) * 0.05 * (p > 0.6 ? 1 : 0);
      rAt.lerp(gp, smooth(push * 1.6));
      rq.slerp(new THREE.Quaternion().setFromAxisAngle(Yax, S.yaw), push);
    }
    if (S.brakeT > 0.01 && push < 0.01) {
      const gp = toWorld(board.group, _b.set(-0.12, 0, -0.42), new THREE.Vector3());
      gp.y = ground(gp.x, gp.z) + D.ankle * 0.8;
      rAt.lerp(gp, S.brakeT * 0.85);
    }
    if (S.air) {
      const t = tuck * (S.flipT >= 0 ? 0.22 : 0.14);
      fL.y += t; rAt.y += t * 1.15;
    }
    feet.R = { at: rAt, pole: _b.set(-1, 0, -0.4).applyQuaternion(dq).clone().lerp(fwdW, push), q: rq };

    const hands = {};
    const sway = Math.sin(performance.now() * 0.0012) * 0.03 + S.manual * Math.sin(performance.now() * 0.005) * 0.08;
    const hy = hipY;
    const armL = toWorld(board.group, _a.set(-0.13 + S.carve * 0.32, hy - 0.05 + Math.abs(S.carve) * 0.5 + tuck * 0.28 + S.manual * 0.14, 0.46 + sway), new THREE.Vector3());
    const armR = toWorld(board.group, _a.set(-0.06 + S.carve * 0.22, hy - 0.10 + Math.abs(S.carve) * 0.35 + tuck * 0.25 + S.manual * 0.14, -0.44 - sway), new THREE.Vector3());
    if (push > 0.01) {
      armL.lerp(toWorld(board.group, _a.set(-0.25, top + D.leg + 0.05, 0.3), new THREE.Vector3()), push * 0.6);
      armR.lerp(toWorld(board.group, _a.set(-0.2, top + D.leg + 0.0, -0.05), new THREE.Vector3()), push * 0.7);
    }
    hands.L = { at: armL, pole: _b.set(0.6, -1, 0.2).applyQuaternion(dq).clone() };
    hands.R = { at: armR, pole: _b.set(0.6, -1, -0.2).applyQuaternion(dq).clone() };
    rig.pose({
      frame: frameQ, hips,
      pitch: [0.06 + crouch * 0.6, 0.03 + crouch * 0.3, 0.02],
      twist: [0.25 - open * 0.3, 0.2 - open * 0.15],
      side: S.carve * 0.6, look: -0.12, headYaw: 1.15 - open * 1.0, feet, hands, curl: 0.25,
    });
  }

  // ======================================================================== 4. BAMBOO BROOM (PETALWAKE FLIGHT)
  const BROOM = { cruise: 10.5, boost: 20.5, max: 27, turn: 1.65, clear: 0.98, ceiling: 58 };
  const BOUNDS = { x0: -315, x1: 185, z0: -165, z1: 320 };
  function floorAt(x, z, y) {
    const g = ground(x, z);
    const roof = solids.topAt(x, z);
    return roof > g && y >= roof - 0.6 ? roof : g;
  }

  function stepBroom(dt, inp) {
    const stopping = S.phase === 'stop';
    const g0 = floorAt(S.pos.x, S.pos.z, S.pos.y);
    const roofTop = solids.topAt(S.pos.x, S.pos.z);
    const onRoof = roofTop > ground(S.pos.x, S.pos.z) + 2.5 && Math.abs(S.pos.y - roofTop) < 2.2;
    S.agl = S.pos.y - g0;
    S.overWater = fx.overWater(S.pos.x, S.pos.z);

    // Rooftop / ground perched cinematic orbit toggle (Petalwake landing!)
    if (inp.perch && S.phase === 'ride') {
      if (S.perched) {
        S.perched = false;
        S.vy = 2.4; S.speed = 3.5;
        ctx.onEvent?.('perch', { on: false });
      } else if (S.agl < 2.8 && S.speed < 8) {
        S.perched = true; S.speed = 0; S.vy = 0; S.perchOrbit = 0;
        S.pos.y = g0 + 0.56;
        ctx.onEvent?.('perch', { on: true, roof: onRoof });
        showTrick(onRoof ? '屋顶栖风 · 环顾校园' : '暂落歇息 · 空格再起飞');
      }
    }
    if (S.perched) {
      if (inp.ay > 0.35 || inp.up) { S.perched = false; S.vy = 2.8; S.speed = 3.2; }
      else {
        S.perchOrbit += dt;
        S.speed = damp(S.speed, 0, 8, dt);
        S.roll = damp(S.roll, 0, 6, dt);
        S.pitch = damp(S.pitch, 0.08, 6, dt);
        S.vel.set(0, 0, 0);
        broom.group.position.set(S.pos.x, g0 + 0.56, S.pos.z);
        broom.group.quaternion.copy(machineQ(S.yaw, S.pitch, S.roll));
        broom.updateDetails(dt, new THREE.Vector3(U.uWindDir.value.x * 2, 0, U.uWindDir.value.y * 2), { speed: 0, pitch: S.pitch, roll: S.roll, night: U.uNight.value, gust: S.gust });
        broom.group.updateMatrixWorld(true);
        return;
      }
    }

    // Skimming low over grass / 砚池 charges 乘风 (Gust) meter — Petalwake core loop!
    const nearDeck = clamp(1 - (S.agl - 0.9) / 5.5, 0, 1);
    const wantBoost = inp.boost && inp.ay > -0.1 && S.gust > 0.03;
    S.boost = damp(S.boost, wantBoost ? 1 : 0, wantBoost ? 5 : 2.2, dt);
    if (wantBoost) S.gust = Math.max(0, S.gust - dt * 0.20);
    else S.gust = Math.min(1, S.gust + dt * (0.04 + 0.24 * nearDeck * nearDeck * (S.overWater ? 1.55 : 1.0) * clamp(S.speed / 6, 0.2, 1.5)));

    let target = inp.ay > 0.1 ? BROOM.cruise * inp.ay + (BROOM.boost - BROOM.cruise) * S.boost : inp.ay < -0.1 ? 0 : Math.min(S.speed, 3.6);
    if (stopping) target = 0;
    const rate = target > S.speed ? 1.35 + S.boost * 1.4 : inp.ay < -0.1 || stopping ? 3.6 : 0.35;
    S.speed += (target - S.speed) * (1 - Math.exp(-rate * dt));
    // Gravity trades height for speed (dives exhilarate!)
    S.speed = clamp(S.speed - S.vy * 0.62 * dt * (S.speed > 1 ? 1 : 0), 0, BROOM.max);

    const maxTurn = BROOM.turn / Math.pow(1 + S.speed / 9, 0.52);
    S.turnRate = damp(S.turnRate, -inp.ax * maxTurn, 5.0, dt);
    S.yaw = wrap(S.yaw + S.turnRate * dt);

    // Thermal mild assist + climb/descend + low-altitude automatic terrain follow
    const th = fx.thermalAt(S.pos.x, S.pos.y, S.pos.z);
    S.thermalLift = th.lift * 0.35; S.thermalName = th.name;
    let vyT;
    if (stopping) vyT = S.agl > BROOM.clear + 0.1 ? -Math.min(3.8, 0.8 + S.agl * 0.8) : 0;
    else if (inp.up) vyT = 3.8 + S.boost * 2.2 + Math.min(2, S.speed * 0.12);
    else if (inp.down) vyT = -(4.5 + Math.min(5.2, S.speed * 0.32));
    else {
      if (S.holdAgl < 0) S.holdAgl = Math.max(S.agl, BROOM.clear);
      const follow = clamp(1 - (S.holdAgl - 8) / 10, 0, 1);
      const fxD = Math.sin(S.yaw), fzD = Math.cos(S.yaw), look = Math.max(4, S.speed * 0.6);
      const ahead = floorAt(S.pos.x + fxD * look, S.pos.z + fzD * look, S.pos.y);
      const holdY = follow * (Math.max(g0, ahead) + S.holdAgl) + (1 - follow) * S.pos.y;
      vyT = clamp((holdY - S.pos.y) * 2.4, -3.2, 3.2) * (follow > 0 ? 1 : 0) + S.thermalLift * 0.3;
    }
    if (inp.up || inp.down) S.holdAgl = -1;

    // Automatic dive pull-out arc before hitting ground/water (Petalwake!)
    if (S.vy < -2.2 && S.agl < 6.0 && !stopping) {
      const pull = clamp((6.0 - S.agl) / 4.5, 0, 1) * (-S.vy * 1.15);
      vyT = Math.max(vyT, vyT + pull);
    }

    const above = S.pos.y - ground(S.pos.x, S.pos.z);
    if (above > BROOM.ceiling - 10 && vyT > 0) vyT *= clamp((BROOM.ceiling - above) / 10, 0, 1);
    if (above > BROOM.ceiling + 1) vyT = Math.min(vyT, -1);
    S.vy = damp(S.vy, vyT, 3.5, dt);

    const fxD = Math.sin(S.yaw), fzD = Math.cos(S.yaw);
    S.pos.x += fxD * S.speed * dt; S.pos.z += fzD * S.speed * dt; S.pos.y += S.vy * dt;

    // Gentle homing breeze at campus boundary
    const out = Math.max(BOUNDS.x0 - S.pos.x, S.pos.x - BOUNDS.x1, BOUNDS.z0 - S.pos.z, S.pos.z - BOUNDS.z1, 0);
    if (out > 0) {
      S.yaw = dampAngle(S.yaw, Math.atan2(-S.pos.x - 40, 60 - S.pos.z), Math.min(3, out * 0.1), dt);
      S.pos.x = clamp(S.pos.x, BOUNDS.x0 - 25, BOUNDS.x1 + 25);
      S.pos.z = clamp(S.pos.z, BOUNDS.z0 - 25, BOUNDS.z1 + 25);
    }

    // Building wall deflection & lookahead climb
    const w = solids.wall(S.pos.x, S.pos.z, S.pos.y - 0.3);
    if (w.d < 0.72) {
      const push = 0.72 - w.d;
      S.pos.x += w.nx * push; S.pos.z += w.nz * push;
      const into = -(fxD * w.nx + fzD * w.nz);
      if (into > 0) {
        S.yaw = dampAngle(S.yaw, Math.atan2(fxD + w.nx * into * 1.35, fzD + w.nz * into * 1.35), 14, dt);
        if (into > 0.5 && S.speed > 4 && S.wallHit <= 0) { S.bump = Math.min(1, S.speed / 14); S.speed *= 0.78; S.wallHit = 0.5; ctx.onEvent?.('bump', {}); }
      }
    } else if (S.speed > 2) {
      const la = 0.32 * S.speed;
      const wa = solids.wall(S.pos.x + fxD * la, S.pos.z + fzD * la, S.pos.y + S.vy * 0.32 - 0.3);
      if (wa.d < 0.4) {
        const into = -(fxD * wa.nx + fzD * wa.nz);
        if (into > 0) S.yaw = dampAngle(S.yaw, Math.atan2(fxD + wa.nx * into * 1.35, fzD + wa.nz * into * 1.35), 3 * into, dt);
        if (into > 0.6 && wa.top - S.pos.y < 8 && !inp.down) S.vy = Math.max(S.vy, 3.6);
      }
    }
    S.wallHit -= dt;

    // Ground cushion & lightly damped landing spring bounce (Petalwake!)
    const floor = floorAt(S.pos.x, S.pos.z, S.pos.y);
    S.sink = Math.max(S.sink * Math.exp(-dt / 1.0), -S.vy);
    if (S.pos.y < floor + BROOM.clear) {
      if (S.vy < -2.0 && !S.landed) {
        const hit = clamp((S.sink - 1.8) * 0.14, 0, 1.0);
        S.bobV -= hit * 2.5; S.bump = Math.max(S.bump, hit * 0.4); S.touchdown = hit;
        fx.burst(S.overWater ? 'spray' : 'leaf', S.pos.x, floor + 0.1, S.pos.z, 14, 3.4);
        ctx.onEvent?.('touch', { hit });
      }
      S.pos.y = damp(S.pos.y, floor + BROOM.clear, 16, dt);
      if (S.vy < 0) S.vy *= 0.2;
      S.landed = true;
    } else if (S.pos.y > floor + BROOM.clear + 1.2) S.landed = false;
    S.bobV += (-7.2 * 7.2 * S.bob - 2 * 0.20 * 7.2 * S.bobV) * dt;
    S.bob += S.bobV * dt;
    S.agl = S.pos.y - floorAt(S.pos.x, S.pos.z, S.pos.y);

    const bankT = clamp(Math.atan(S.speed * S.turnRate / G) * 1.05, -0.78, 0.78);
    S.roll = damp(S.roll, -bankT + (S.speed < 1.5 ? -S.turnRate * 0.08 : 0), 4.4, dt);
    const pitchT = Math.atan2(S.vy, Math.max(S.speed, 3)) * 0.85 - (target - S.speed) * 0.01;
    S.pitch = damp(S.pitch, clamp(pitchT, -0.7, 0.6), 4.2, dt);

    S.prevVel.copy(S.vel);
    S.vel.set(fxD * S.speed, S.vy, fzD * S.speed);

    // Tree crowns soft traversal
    S.inCrown = 0;
    for (const t of world.crowns) {
      const dx = (S.pos.x - t.x) / t.r, dy = (S.pos.y - t.y) / t.ry, dz = (S.pos.z - t.z) / t.r;
      const q = dx * dx + dy * dy + dz * dz;
      if (q < 1.15) S.inCrown = Math.max(S.inCrown, 1 - q / 1.15);
    }
    if (S.inCrown > 0.2) S.speed *= 1 - 0.22 * dt;

    broom.group.position.set(S.pos.x, S.pos.y + S.bob * 0.65, S.pos.z);
    broom.group.quaternion.copy(machineQ(S.yaw, S.pitch, S.roll));
    broom.group.updateMatrixWorld(true);

    // Update Verlet red silk ribbon & inertial brass lantern pendulum!
    const fwdA = ((S.vel.x - S.prevVel.x) * fxD + (S.vel.z - S.prevVel.z) * fzD) / Math.max(dt, 1e-3);
    broom.updateDetails(dt, new THREE.Vector3(-S.vel.x * 0.9, -S.vel.y * 0.9, -S.vel.z * 0.9), {
      fwdA, latA: S.speed * S.turnRate, speed: S.speed, pitch: S.pitch, roll: S.roll,
      night: U.uNight.value, gust: S.gust,
    });
    // Bristle air-stream ribbon anchors
    toWorld(broom.body, _a.set(0.18, 0.0, broom.back - 0.55), S.ribbonAnchors.L);
    toWorld(broom.body, _b.set(-0.18, 0.0, broom.back - 0.55), S.ribbonAnchors.R);
  }

  const hover = { t: 0, v: 0, vy: 0, sx: 0, sz: 0, wx: 0, wz: 0 };
  function poseBroom(dt) {
    hover.t += dt;
    const b = broom.body;
    b.updateMatrixWorld(true);
    const bq = b.getWorldQuaternion(new THREE.Quaternion());
    const fly = S.perched ? 0 : clamp(S.speed / 9, 0, 1);
    const dash = S.boost;
    frameQ.copy(bq);
    const drift = Math.sin(hover.t * 1.3) * 0.015 * (1 - fly);
    const hips = toWorld(b, _a.set(0, 0.1 + drift, -0.05), new THREE.Vector3());

    if (dt > 0) {
      const acc = clamp((S.speed - hover.v) / dt, -12, 12), ay = clamp((S.vy - hover.vy) / dt, -12, 12);
      hover.v = S.speed; hover.vy = S.vy;
      const tx = clamp(-S.turnRate * S.speed * 0.035, -0.22, 0.22);
      const tz = clamp(-acc * 0.03 - S.vy * 0.012, -0.3, 0.2);
      hover.wx += ((tx - hover.sx) * 30 - hover.wx * 5.5) * dt; hover.sx += hover.wx * dt;
      hover.wz += ((tz - hover.sz) * 26 - hover.wz * 4.8 - ay * 0.04) * dt; hover.sz += hover.wz * dt;
    }
    const feet = {};
    for (const sd of ['L', 'R']) {
      const s = sd === 'L' ? 1 : -1;
      const idle = (1 - fly) * Math.sin(hover.t * 1.9 + (s > 0 ? 0 : 2.6));
      const hang = new THREE.Vector3(s * 0.16, -0.60 + Math.sin(hover.t * 1.7 + s) * 0.02, 0.16 + s * 0.05 + idle * 0.07);
      const fold = new THREE.Vector3(s * (0.17 + dash * 0.02), -0.40 + s * 0.02, -0.32 - dash * 0.08 + s * 0.04);
      const loc = hang.lerp(fold, fly);
      const reach = 0.5 + 0.5 * (1 - fly);
      loc.x += hover.sx * reach; loc.z += hover.sz * reach; loc.y += Math.abs(hover.sz) * 0.25 * reach;
      const at = toWorld(b, loc, new THREE.Vector3());
      const point = 0.45 + fly * 0.6 + idle * 0.12 - hover.sz * 0.6;
      feet[sd] = { at, pole: _b.set(s * (0.3 + fly * 0.15), 0, 1).applyQuaternion(bq).clone(), q: new THREE.Quaternion().copy(bq).multiply(qTmp.setFromAxisAngle(Xax, point)) };
    }
    const hands = {
      L: { at: toWorld(b, _a.set(0.03, 0.02, 0.36 + fly * 0.06), new THREE.Vector3()), pole: _b.set(0.7, -0.5, -0.5).applyQuaternion(bq).clone() },
      R: { at: toWorld(b, _a.set(-0.03, 0.02, 0.22 + fly * 0.06), new THREE.Vector3()), pole: _b.set(-0.7, -0.5, -0.5).applyQuaternion(bq).clone() },
    };
    const lean = S.perched ? 0.08 : 0.18 + fly * 0.32 + dash * 0.2;
    rig.pose({
      frame: frameQ, hips,
      pitch: [lean * 0.4, lean * 0.35, lean * 0.25],
      twist: [0, S.turnRate * -0.1], side: S.roll * -0.35,
      look: clamp(S.vy * 0.04, -0.25, 0.25) + S.pitch * 0.6 + lean * 0.2,
      headYaw: -S.turnRate * 0.25, feet, hands, curl: 0.85,
    });
  }

  // ======================================================================== 5. TERMINALIA MONSOON GLIDER (榄仁纸鸢 · NEW!)
  // Zero-engine aerodynamics: swoop to trade height for speed, bank inside campus thermals to spiral up!
  const GLIDER = { minV: 5.8, bestV: 9.8, maxV: 20.5, ceiling: 68, clear: 1.5 };
  function stepGlider(dt, inp) {
    const stopping = S.phase === 'stop';
    const g0 = floorAt(S.pos.x, S.pos.z, S.pos.y);
    S.agl = S.pos.y - g0;
    S.overWater = fx.overWater(S.pos.x, S.pos.z);

    // Weight-shift banking (smooth, graceful, serene sailplane arcs)
    const bankTarget = clamp(inp.ax * 0.66, -0.66, 0.66);
    S.roll = damp(S.roll, -bankTarget, 3.0, dt);
    S.turnRate = -Math.sin(-S.roll) * (G / Math.max(S.speed, 6.5)) * 0.72;
    S.yaw = wrap(S.yaw + S.turnRate * dt);

    // Pitch control: W / C pulls bar in (nose down swoop -> speed!), S / Space pushes bar out (flare/climb!)
    let pitchCmd = 0;
    if (stopping) pitchCmd = -0.16;
    else if (inp.ay > 0.2 || inp.down) pitchCmd = -0.34;
    else if (inp.ay < -0.2 || inp.up) pitchCmd = 0.28;
    else pitchCmd = -0.05; // natural gentle glide angle

    // Stall protection: if airspeed nears minV, wing naturally drops nose to recover energy!
    if (S.speed < GLIDER.minV + 1.2 && pitchCmd > -0.06) {
      pitchCmd = Math.min(pitchCmd, -0.22 * (1 - (S.speed - GLIDER.minV) / 1.2));
    }
    S.pitch = damp(S.pitch, pitchCmd, 2.8, dt);

    // Sailplane Energy Exchange: diving accelerates, climbing spends speed, gentle monsoon cruise drag
    const drag = 0.011 * S.speed * S.speed;
    const gravAccel = -Math.sin(S.pitch) * 8.6;
    // Shift triggers a brief wind-gust wing-pump lift impulse when close to ground or in breeze
    const pump = inp.boost && !stopping ? 1.8 : 0;
    S.boost = damp(S.boost, pump > 0 ? 1 : 0, 4, dt);
    S.speed = clamp(S.speed + (gravAccel - drag + 0.65 + pump) * dt, GLIDER.minV, GLIDER.maxV);

    // Campus Microclimate Thermal Updrafts (8 golden rising columns across the school!)
    const th = fx.thermalAt(S.pos.x, S.pos.y, S.pos.z);
    S.thermalLift = th.lift;
    S.thermalName = th.name;

    // Sink-rate polar (best L/D ~ 14:1 at 9.8 m/s, extra sink in steep banks)
    const speedOff = (S.speed - GLIDER.bestV) / 6.0;
    const polarSink = 0.42 + 0.28 * speedOff * speedOff + Math.abs(S.roll) * 0.48;
    // Dynamic zoom climb when pitching nose up with excess airspeed
    const pitchLift = Math.sin(S.pitch) * S.speed * 0.68;
    let vyTarget = pitchLift - polarSink + S.thermalLift + (pump > 0 ? 1.15 : 0);
    if (stopping) vyTarget = -2.8;

    const above = S.pos.y - ground(S.pos.x, S.pos.z);
    if (above > GLIDER.ceiling - 8 && vyTarget > 0) vyTarget *= clamp((GLIDER.ceiling - above) / 8, 0, 1);
    S.vy = damp(S.vy, vyTarget, 3.2, dt);

    // Haikou monsoon breeze drift (real campus wind vector!)
    const fxD = Math.sin(S.yaw), fzD = Math.cos(S.yaw);
    const windX = U.uWindDir.value.x * Math.min(2.2, U.uWindSpeed.value * 0.24);
    const windZ = U.uWindDir.value.y * Math.min(2.2, U.uWindSpeed.value * 0.24);
    S.pos.x += (fxD * S.speed + windX) * dt;
    S.pos.z += (fzD * S.speed + windZ) * dt;
    S.pos.y += S.vy * dt;

    // Gentle campus boundary turn-back
    const out = Math.max(BOUNDS.x0 - S.pos.x, S.pos.x - BOUNDS.x1, BOUNDS.z0 - S.pos.z, S.pos.z - BOUNDS.z1, 0);
    if (out > 0) {
      S.yaw = dampAngle(S.yaw, Math.atan2(-S.pos.x - 40, 60 - S.pos.z), Math.min(2.4, out * 0.08), dt);
      S.pos.x = clamp(S.pos.x, BOUNDS.x0 - 25, BOUNDS.x1 + 25);
      S.pos.z = clamp(S.pos.z, BOUNDS.z0 - 25, BOUNDS.z1 + 25);
    }

    // Wall glide-deflection & rooftop clearance
    const w = solids.wall(S.pos.x, S.pos.z, S.pos.y - 0.5);
    if (w.d < 1.35) {
      const push = 1.35 - w.d;
      S.pos.x += w.nx * push; S.pos.z += w.nz * push;
      const into = -(fxD * w.nx + fzD * w.nz);
      if (into > 0) {
        S.yaw = dampAngle(S.yaw, Math.atan2(fxD + w.nx * into * 1.4, fzD + w.nz * into * 1.4), 10, dt);
        S.vy = Math.max(S.vy, 1.8);
      }
    }

    // Soft ground-effect cushion so the glider floats gently over grass/roofs (no harsh crash!)
    const floor = floorAt(S.pos.x, S.pos.z, S.pos.y);
    if (S.pos.y < floor + GLIDER.clear) {
      S.pos.y = damp(S.pos.y, floor + GLIDER.clear, 14, dt);
      if (S.vy < 0) S.vy *= 0.25;
      if (stopping) S.speed = damp(S.speed, 0, 5, dt);
    }
    S.agl = S.pos.y - floorAt(S.pos.x, S.pos.z, S.pos.y);

    S.prevVel.copy(S.vel);
    S.vel.set(fxD * S.speed + windX, S.vy, fzD * S.speed + windZ);

    // Tree crown check
    S.inCrown = 0;
    for (const t of world.crowns) {
      const dx = (S.pos.x - t.x) / t.r, dy = (S.pos.y - t.y) / t.ry, dz = (S.pos.z - t.z) / t.r;
      const q = dx * dx + dy * dy + dz * dz;
      if (q < 1.15) S.inCrown = Math.max(S.inCrown, 1 - q / 1.15);
    }

    glider.group.position.set(S.pos.x, S.pos.y, S.pos.z);
    glider.group.quaternion.copy(machineQ(S.yaw, S.pitch, S.roll));
    glider.group.updateMatrixWorld(true);

    // Wing flex under lift & thermal updrafts + wingtip streamers!
    const flex = clamp(0.25 + S.thermalLift * 0.22 + (S.speed - 8) * 0.04 + Math.abs(S.roll) * 0.35, 0, 1.3);
    glider.updateDetails(dt, new THREE.Vector3(-S.vel.x * 0.85, -S.vel.y * 0.85, -S.vel.z * 0.85), flex);
    toWorld(glider.body, _a.set(1.90, 0.66, -0.30), S.ribbonAnchors.L);
    toWorld(glider.body, _b.set(-1.90, 0.66, -0.30), S.ribbonAnchors.R);
  }

  function poseGlider(dt) {
    hover.t += dt;
    const b = glider.body;
    b.updateMatrixWorld(true);
    const bq = b.getWorldQuaternion(new THREE.Quaternion());
    // Rider hangs beneath the wing in a streamlined semi-prone hang-glider harness, weight-shifting into turns!
    const shiftX = clamp(-S.roll * 0.24, -0.18, 0.18);
    const shiftZ = clamp(-S.pitch * 0.22, -0.12, 0.12);
    // Tilt rider body horizontally forward (approx 58° prone soar!)
    frameQ.copy(bq).multiply(qTmp.setFromAxisAngle(Xax, 0.88));
    const hips = toWorld(b, _a.set(shiftX, 0.04 + Math.sin(hover.t * 1.4) * 0.015, -0.24 + shiftZ), new THREE.Vector3());

    // Hands firmly grip the bamboo trapeze base bar!
    const hands = {
      L: { at: toWorld(b, _a.copy(glider.barL), new THREE.Vector3()), pole: _b.set(0.75, -0.5, -0.3).applyQuaternion(bq).clone() },
      R: { at: toWorld(b, _a.copy(glider.barR), new THREE.Vector3()), pole: _b.set(-0.75, -0.5, -0.3).applyQuaternion(bq).clone() },
    };

    // Legs streamlined gracefully behind in the monsoon slipstream
    const feet = {};
    for (const sd of ['L', 'R']) {
      const s = sd === 'L' ? 1 : -1;
      const sway = Math.sin(hover.t * 1.8 + (s > 0 ? 0 : 1.7)) * 0.03;
      const at = toWorld(b, _a.set(shiftX + s * 0.14, -0.44 + sway, -0.96 + shiftZ + s * 0.04), new THREE.Vector3());
      feet[sd] = {
        at,
        pole: _b.set(s * 0.15, -0.3, 0.9).applyQuaternion(bq).clone(),
        q: new THREE.Quaternion().copy(bq).multiply(qTmp.setFromAxisAngle(Xax, 1.35)),
      };
    }

    rig.pose({
      frame: frameQ, hips,
      pitch: [0.05, 0.05, -0.15],
      twist: [0, -S.roll * 0.15],
      side: S.roll * 0.2,
      look: 0.55 + S.pitch * 0.4, // head lifted smoothly toward the campus horizon!
      headYaw: -S.turnRate * 0.35,
      feet, hands, curl: 0.92,
    });
  }

  // ======================================================================== PER-MODE CAMERA GRAMMAR
  // Distinct focal length, height, follow distance, horizon roll, and 1st-person cockpit offset!
  const PARAMS = {
    bike: { dist: [4.1, 5.4], height: 1.68, look: 3.4, lookY: 1.12, fov: [50, 58], roll: 0.20, lag: 3.4, top: 8.6 },
    board: { dist: [2.85, 3.85], height: 0.96, look: 2.8, lookY: 0.62, fov: [58, 72], roll: 0.34, lag: 4.2, top: 7.5 },
    broom: { dist: [4.4, 6.4], height: 1.35, look: 5.8, lookY: 0.45, fov: [56, 70], roll: 0.42, lag: 3.1, top: 20.5 },
    glider: { dist: [6.4, 8.8], height: 2.15, look: 8.0, lookY: 0.25, fov: [58, 72], roll: 0.26, lag: 2.3, top: 18 },
  };

  function initCam() {
    const c = followCam;
    const p = S.pos;
    cam.yaw = Math.atan2(p.x - c.position.x, p.z - c.position.z);
    cam.dist = Math.hypot(p.x - c.position.x, p.z - c.position.z);
    cam.height = c.position.y - p.y;
    cam.pitch = 0; cam.fov = c.fov; cam.roll = 0; cam.lookYaw = 0; cam.lookPitch = 0;
    cam.boom = cam.dist; cam.cineK = 0; cam.init = true;
  }

  const eye = new THREE.Vector3(), aim = new THREE.Vector3(), tq = new THREE.Quaternion();
  const _cp = new THREE.Vector3(), _cq = new THREE.Quaternion(), _cm = new THREE.Matrix4();

  function camBlocked(from, dir, len) {
    for (let s = 0.5; s <= len; s += 0.28) {
      const x = from.x + dir.x * s, y = from.y + dir.y * s, z = from.z + dir.z * s;
      if (y < ground(x, z) + 0.32) return Math.max(0.75, s - 0.3);
      const w = solids.wall(x, z, y);
      if (w.d < 0.32) return Math.max(0.75, s - 0.35);
    }
    return len;
  }

  function updateCam(dt, inp) {
    const P = PARAMS[S.mode];
    if (!P) return;
    if (inp) {
      cam.lookYaw -= inp.lookDX * 0.0045;
      cam.lookPitch = clamp(cam.lookPitch + inp.lookDY * 0.0035, -0.55, 0.88);
      if (!inp.looking && inp.idle > 1.5 && S.speed > 0.9 && !S.perched) {
        cam.lookYaw = damp(wrap(cam.lookYaw), 0, 1.5, dt);
        cam.lookPitch = damp(cam.lookPitch, 0, 1.3, dt);
      }
    }

    const k = clamp(S.speed / P.top, 0, 1);
    const zoom = inp ? inp.zoom : 1;
    // Skateboard VX-camera gently swings laterally opposite the carve to showcase stance & asphalt flow!
    const skateSwing = S.mode === 'board' ? S.carve * 0.55 : 0;
    cam.yaw = dampAngle(cam.yaw, S.yaw + cam.lookYaw + skateSwing, P.lag, dt);
    const flightPitch = S.mode === 'broom' ? S.pitch * 0.82 : S.mode === 'glider' ? S.pitch * 0.65 - 0.06 : 0;
    cam.pitch = damp(cam.pitch, flightPitch - cam.lookPitch * 0.9, 3.0, dt);

    const inside = (S.mode === 'broom' || S.mode === 'glider') ? clamp(S.inCrown * 2.4, 0, 1) : 0;
    // Glider opens panoramic distance slightly with altitude!
    const altPull = S.mode === 'glider' ? 1 + clamp(S.agl / 55, 0, 0.35) : 1;
    cam.dist = damp(cam.dist, (P.dist[0] + (P.dist[1] - P.dist[0]) * k) * zoom * altPull * (innerHeight > innerWidth ? 1.22 : 1) * (1 - 0.48 * inside), 2.4, dt);
    cam.height = damp(cam.height, P.height * (0.75 + 0.25 * zoom) + (S.mode === 'broom' ? 0.4 * (1 - k) : 0), 2.4, dt);
    cam.fov = damp(cam.fov, P.fov[0] + (P.fov[1] - P.fov[0]) * k + (S.mode === 'broom' ? 5 * S.boost : 0) + (innerHeight > innerWidth ? 8 : 0), 2.6, dt);
    const rawRoll = S.mode === 'bike' ? S.lean : S.mode === 'board' ? -S.carve * 1.25 : S.roll;
    cam.roll = damp(cam.roll, rawRoll * P.roll, 4.0, dt);
    cam.fp = damp(cam.fp, cam.firstPerson && !S.perched ? 1 : 0, 7.5, dt);

    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const dx = Math.sin(cam.yaw) * cp, dy = sp, dz = Math.cos(cam.yaw) * cp;
    const ux = -Math.sin(cam.yaw) * sp, uy = cp, uz = -Math.cos(cam.yaw) * sp;
    const by = S.pos.y + (S.mode === 'broom' ? -S.bob * 0.45 : 0);
    const pivot = new THREE.Vector3(S.pos.x, by + P.lookY, S.pos.z);
    eye.set(S.pos.x - dx * cam.dist + ux * cam.height, by - dy * cam.dist + uy * cam.height, S.pos.z - dz * cam.dist + uz * cam.height);
    const dir = eye.clone().sub(pivot); const L = dir.length() || 1; dir.multiplyScalar(1 / L);
    const lim = camBlocked(pivot, dir, L);
    cam.boom = lim < cam.boom ? lim : damp(cam.boom, lim, 3, dt);
    eye.copy(pivot).addScaledVector(dir, Math.min(L, cam.boom));

    // Tactile micro-vibration (never nauseating)
    const speedBuzz = S.mode === 'broom' ? 0.007 * S.boost * k : S.mode === 'board' && !S.air && S.speed > 2 ? 0.0035 * k : 0;
    cam.shake = damp(cam.shake, speedBuzz + S.bump * 0.048, 8, dt);
    const t = performance.now() / 1000;
    eye.x += (Math.sin(t * 37.1) + Math.sin(t * 61.7)) * 0.5 * cam.shake;
    eye.y += (Math.sin(t * 43.3 + 1) + Math.sin(t * 71.9)) * 0.5 * cam.shake;
    aim.set(S.pos.x + Math.sin(cam.yaw) * P.look * cp, by + P.lookY + dy * P.look * 0.6 - 0.05, S.pos.z + Math.cos(cam.yaw) * P.look * cp);

    // First-person LIVE BODY cockpit (head bone collapsed, arms/hands gripping handlebars/broom/glider bar stay visible!)
    rig.setFirstPerson(cam.fp > 0.55);
    student.setVisible(true);
    if (cam.fp > 0.01) {
      let fpEye, fpAim, fpFov = 68;
      const flatFwd = new THREE.Vector3(Math.sin(cam.yaw), 0, Math.cos(cam.yaw));
      if (S.mode === 'bike') {
        // Rider handlebar cockpit: placed cleanly ahead of face/chest so zero torso/head clips, framing chrome bars, brass bell, woven basket + sketchbook, and hands!
        bike.body.updateMatrixWorld(true);
        const head = rig.where('head', new THREE.Vector3());
        fpEye = head.clone().addScaledVector(flatFwd, 0.16).add(new THREE.Vector3(0, -0.08, 0));
        const lookV = new THREE.Vector3(Math.sin(cam.yaw) * cp, dy - 0.34, Math.cos(cam.yaw) * cp).normalize();
        fpAim = fpEye.clone().addScaledVector(lookV, 5.5);
        fpFov = 78;
      } else if (S.mode === 'glider') {
        // Under-wing monsoon cockpit: cleanly ahead & above rider's head, framing glowing backlit Terminalia leaf nose above & golden bamboo A-frame struts on both sides!
        glider.body.updateMatrixWorld(true);
        const shiftX = clamp(-S.roll * 0.24, -0.18, 0.18);
        fpEye = toWorld(glider.body, _a.set(shiftX, 0.60, 0.36), new THREE.Vector3());
        const lookV = new THREE.Vector3(Math.sin(cam.yaw) * cp, dy + 0.02, Math.cos(cam.yaw) * cp).normalize();
        fpAim = fpEye.clone().addScaledVector(lookV, 6.5);
        fpFov = 80;
      } else if (S.mode === 'broom') {
        const head = rig.where('head', new THREE.Vector3());
        fpEye = head.clone().add(new THREE.Vector3(0, 0.02, 0)).addScaledVector(flatFwd, 0.04);
        const lookV = new THREE.Vector3(Math.sin(cam.yaw) * cp, dy - 0.16, Math.cos(cam.yaw) * cp).normalize();
        fpAim = fpEye.clone().addScaledVector(lookV, 6.0);
        fpFov = 72;
      } else {
        const head = rig.where('head', new THREE.Vector3());
        fpEye = head.clone().add(new THREE.Vector3(0, 0.04, 0)).addScaledVector(flatFwd, 0.06);
        const lookV = new THREE.Vector3(Math.sin(cam.yaw) * cp, dy - 0.18, Math.cos(cam.yaw) * cp).normalize();
        fpAim = fpEye.clone().addScaledVector(lookV, 5.5);
        fpFov = 70;
      }
      eye.lerp(fpEye, cam.fp);
      aim.lerp(fpAim, cam.fp);
      cam.fov = cam.fov + (fpFov - cam.fov) * cam.fp;
    }

    followCam.position.copy(eye);
    followCam.up.set(0, 1, 0);
    followCam.lookAt(aim);
    followCam.quaternion.multiply(tq.setFromAxisAngle(Zax, -cam.roll * (1 - cam.fp * 0.45)));

    // Petalwake-style slow breathing cinematic orbit when perched on a rooftop!
    cam.cineK = clamp(cam.cineK + (S.perched ? dt / 1.3 : -dt / 0.9), 0, 1);
    if (cam.cineK > 0.001) {
      const e = smooth(cam.cineK);
      if (S.perched) cam.cineAz += dt * 0.12;
      else cam.cineAz = Math.atan2(eye.x - S.pos.x, eye.z - S.pos.z);
      const r = 5.4 + Math.sin(S.perchOrbit * 0.25) * 0.6;
      const h = 1.9 + Math.sin(S.perchOrbit * 0.18 + 1) * 0.35;
      _cp.set(S.pos.x + Math.sin(cam.cineAz) * r, S.pos.y + h, S.pos.z + Math.cos(cam.cineAz) * r);
      const minG = ground(_cp.x, _cp.z) + 0.5;
      if (_cp.y < minG) _cp.y = minG;
      _cm.lookAt(_cp, _a.set(S.pos.x, S.pos.y + 0.65, S.pos.z), Yax);
      _cq.setFromRotationMatrix(_cm);
      followCam.position.lerp(_cp, e);
      followCam.quaternion.slerp(_cq, e);
      cam.fov = cam.fov + (54 - cam.fov) * e;
    }

    if (Math.abs(followCam.fov - cam.fov) > 0.01) { followCam.fov = cam.fov; followCam.updateProjectionMatrix(); }
  }

  function camHandBack(dt) {
    if (!S.camFrom) return;
    S.camFrom.t = (S.camFrom.t || 0) + dt / 0.85;
    const k = smooth(S.camFrom.t);
    followCam.position.lerpVectors(S.camFrom.pos, followCam.position, k);
    followCam.quaternion.copy(S.camFrom.quat).slerp(tq.copy(followCam.quaternion), k);
    followCam.fov = S.camFrom.fov + (followCam.fov - S.camFrom.fov) * k;
    followCam.updateProjectionMatrix();
    if (S.camFrom.t >= 1) S.camFrom = null;
  }

  const steps = { bike: stepBike, board: stepBoard, broom: stepBroom, glider: stepGlider };
  const poses = { bike: poseBike, board: poseBoard, broom: poseBroom, glider: poseGlider };
  let lastInp = null;

  function update(dt) {
    S.t += dt;
    S.bump = Math.max(0, S.bump - dt * 2.2);
    S.touchdown = 0;
    S.trickT = Math.max(0, S.trickT - dt);
    const P = ctx.player();

    for (const [k, m] of Object.entries(machines)) {
      const on = (k === S.mode && S.phase !== 'free') || (k === 'bike' && S.parked);
      m.uFade.value = damp(m.uFade.value, on ? 1 : 0, on ? 3.5 : 2.6, dt);
      if (m.uFade.value > 0.995 && on) m.uFade.value = 1;
      m.group.visible = m.uFade.value > 0.01;
    }

    if (S.phase === 'free') {
      rig.setFirstPerson(false);
      P.update(dt);
      S.pos.copy(P.state.pos); S.speed = P.state.speed; S.yaw = P.state.yaw;
      S.vel.set(P.state.vel.x, P.state.vy || 0, P.state.vel.y);
      S.agl = 0; S.thermalLift = 0; S.overWater = false;
      if (S.blendT < 1) { S.blendT += dt / S.blendDur; rig.blendFromSnap(S.blendT); }
      camHandBack(dt);
      lastInp = null;
      return;
    }

    if (S.phase === 'summon') {
      P.update(dt);
      if (S.mode === 'broom') {
        const hl = rig.where('hand.L', new THREE.Vector3()), hr = rig.where('hand.R', new THREE.Vector3());
        broom.group.position.copy(hl.add(hr).multiplyScalar(0.5)).add(new THREE.Vector3(0, 0.15, 0));
        broom.group.quaternion.setFromAxisAngle(Yax, S.yaw);
        broom.group.updateMatrixWorld(true);
        S.pos.set(broom.group.position.x, P.state.pos.y, broom.group.position.z);
      }
      if (S.t > (S.mode === 'bike' && machines.bike.uFade.value > 0.9 ? 0.22 : 0.56)) beginMount();
      return;
    }

    const inp = input.read(dt);
    lastInp = inp;

    if (S.phase === 'mount' || S.phase === 'ride' || S.phase === 'stop') {
      const live = S.phase === 'mount'
        ? { ...inp, ax: 0, ay: 0, up: false, down: false, boost: false, jump: false, bell: false, brake: false, trick: false, perch: false }
        : inp;
      steps[S.mode](dt, live);
      poses[S.mode](dt);
      if (S.blendT < 1) { S.blendT += dt / S.blendDur; rig.blendFromSnap(S.blendT); }
      if (S.phase === 'mount' && S.t > S.blendDur) { S.phase = 'ride'; S.t = 0; }
      if (S.phase === 'stop') {
        const settled = (S.mode === 'glider' && S.agl < GLIDER.clear + 0.5)
          || (S.speed < 0.6 && (S.mode !== 'broom' || S.agl < BROOM.clear + 0.35));
        if (settled || S.t > 3.2) beginDismount();
      }
      updateCam(dt, inp);
      student.blob.visible = (S.mode !== 'broom' && S.mode !== 'glider') || S.agl < 2.0;
      student.blob.position.set(S.pos.x, ground(S.pos.x, S.pos.z) + 0.02, S.pos.z);
      return;
    }

    if (S.phase === 'dismount') {
      P.update(dt);
      S.blendT += dt / S.blendDur; rig.blendFromSnap(S.blendT);
      camHandBack(dt);
      if (S.mode === 'broom') broom.group.position.y = damp(broom.group.position.y, ground(broom.group.position.x, broom.group.position.z) + 0.5, 3, dt);
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
    state: S, cam, machines, solids, group, update, request, teleportTo,
    get mode() { return S.mode; },
    get phase() { return S.phase; },
    get riding() { return S.phase !== 'free'; },
    get input() { return lastInp; },
    toggleView() { cam.firstPerson = !cam.firstPerson; return cam.firstPerson; },
    setFirstPerson(on) { cam.firstPerson = !!on; },
    nearParked(x, z) { return S.parked && Math.hypot(S.parked.x - x, S.parked.z - z) < 2.4; },
    snapshot() {
      return {
        mode: S.mode, phase: S.phase,
        x: +S.pos.x.toFixed(2), y: +S.pos.y.toFixed(2), z: +S.pos.z.toFixed(2),
        yaw: +S.yaw.toFixed(3), v: +S.speed.toFixed(2), agl: +S.agl.toFixed(2),
        roll: +S.roll.toFixed(3), pitch: +S.pitch.toFixed(3),
        firstPerson: cam.firstPerson, perched: S.perched, gust: +S.gust.toFixed(2),
        thermalLift: +S.thermalLift.toFixed(2),
      };
    },
  };
}
