// Walking and the camera that walks with you, V2.
//
// Movement is V1's (camera-relative WASD / left thumb, Shift or stick-to-rim runs, Space jumps,
// walls from lanren/world/collide.js). The camera became a director:
//
//   space     it reads how open the place is (clearance to the nearest wall): on an open lawn it
//             pulls back and comes down toward the horizon; between buildings it comes in and looks
//             a little more down, so a wall never fills the frame
//   motion    springs, not lerps: it eases into a turn and settles without wobble; running pulls it
//             back and widens the lens a touch; the framing leads into the direction of travel and
//             keeps a small shoulder offset, so the student is not glued to the centre
//   rest      standing still for a few seconds, it settles into a calmer, wider composition and
//             drifts very slowly; the student looks toward the nearest landmark ahead (or the low
//             sun). Any touch, key or drag hands control straight back
//   look      dragging the view turns the student's head with it; looking up at the sky, they look up
//   safety    the boom shortens before a wall gets between camera and student, never dips under the
//             ground, and foliage near the lens dissolves (flora.js) instead of blocking the view
import * as THREE from 'three';
import { move, nearest, freeSpot } from '../world/collide.js';

const clamp = THREE.MathUtils.clamp;
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

// a critically damped spring toward a target (value, velocity)
function spring(s, target, dt, omega) {
  const x = s.v - target;
  const e = Math.exp(-omega * dt);
  const nv = (x + (s.dv + omega * x) * dt) * e;
  s.dv = (s.dv - omega * (s.dv + omega * x) * dt) * e;
  s.v = target + nv;
  return s.v;
}
const sp = (v) => ({ v, dv: 0 });

function rectDist(o, x, z) {
  const dx = x - o.cx, dz = z - o.cz;
  const lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
  const qx = Math.abs(lx) - o.hw, qz = Math.abs(lz) - o.hd;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
}

export function createPlayer({ camera, dom, student, getColliders, heightAt, spawn, coarse, pois = [] }) {
  const S = {
    pos: new THREE.Vector3(spawn.x, heightAt(spawn.x, spawn.z), spawn.z),
    vy: 0, airborne: false, yaw: spawn.yaw, speed: 0, vel: new THREE.Vector2(), lean: 0, run: false,
    time: 0, lastInput: -100, lastLook: -100, idle: 0, firstPerson: false, fp: sp(0),
    camYaw: spawn.yaw, camPitch: 0.15, zoom: 1, open: sp(0.5),
  };
  const C = { yaw: sp(spawn.yaw), pitch: sp(0.15), dist: sp(5.4), side: sp(0.3), fov: sp(52), lead: { x: sp(0), z: sp(0) }, boom: sp(5.4) };
  const keys = new Set();
  const stick = { x: 0, y: 0, id: null, ox: 0, oy: 0, el: null };
  const lookP = { id: null, x: 0, y: 0 };
  let pinch = null, jumpQueued = false, enabled = true, drag = null;
  const pts = new Map();
  const capture = (id) => { try { dom.setPointerCapture(id); } catch { /* synthetic or already released pointer */ } };

  // ---------------------------------------------------------------- input
  const onKey = (e, down) => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const k = e.code;
    if (down) {
      if (k === 'Space') { jumpQueued = true; e.preventDefault(); }
      if (k === 'KeyV') S.firstPerson = !S.firstPerson;
      keys.add(k);
      S.lastInput = S.time;
    } else keys.delete(k);
    if (/Arrow/.test(k)) e.preventDefault();
  };
  addEventListener('keydown', (e) => onKey(e, true));
  addEventListener('keyup', (e) => onKey(e, false));
  addEventListener('blur', () => keys.clear());
  dom.addEventListener('pointerdown', (e) => {
    if (!enabled) return;
    S.lastInput = S.time;
    if (e.pointerType === 'touch') {
      if (e.clientX < innerWidth * 0.42 && stick.id === null) {
        stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0; showStick(true, e.clientX, e.clientY);
      } else if (lookP.id === null) { lookP.id = e.pointerId; lookP.x = e.clientX; lookP.y = e.clientY; } else if (!pinch) pinch = { a: lookP.id, b: e.pointerId, d: 0 };
      capture(e.pointerId);
      return;
    }
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
    capture(e.pointerId);
  });
  dom.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') {
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (e.pointerId === stick.id) {
        const R = 56;
        let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
        const L = Math.hypot(dx, dy);
        if (L > R) { dx *= R / L; dy *= R / L; }
        stick.x = dx / R; stick.y = -dy / R; moveKnob(dx, dy);
        S.lastInput = S.time;
      } else if (pinch && pts.has(pinch.a) && pts.has(pinch.b)) {
        const [a, b] = [pts.get(pinch.a), pts.get(pinch.b)];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch.d) S.zoom = clamp(S.zoom * (pinch.d / d), 0.45, 1.8);
        pinch.d = d;
      } else if (e.pointerId === lookP.id) {
        turn(e.clientX - lookP.x, e.clientY - lookP.y, 0.0055);
        lookP.x = e.clientX; lookP.y = e.clientY;
      }
      return;
    }
    if (!drag || drag.id !== e.pointerId) return;
    turn(e.clientX - drag.x, e.clientY - drag.y, 0.0042);
    drag.x = e.clientX; drag.y = e.clientY;
  });
  const end = (e) => {
    pts.delete(e.pointerId);
    if (e.pointerId === stick.id) { stick.id = null; stick.x = stick.y = 0; showStick(false); }
    if (e.pointerId === lookP.id) lookP.id = null;
    if (pinch && (e.pointerId === pinch.a || e.pointerId === pinch.b)) pinch = null;
    if (drag && e.pointerId === drag.id) drag = null;
  };
  dom.addEventListener('pointerup', end);
  dom.addEventListener('pointercancel', end);
  dom.addEventListener('wheel', (e) => { e.preventDefault(); S.zoom = clamp(S.zoom * Math.exp(e.deltaY * 0.0012), 0.45, 1.8); S.lastInput = S.time; }, { passive: false });
  dom.addEventListener('contextmenu', (e) => e.preventDefault());
  function turn(dx, dy, k) {
    S.camYaw -= dx * k;
    S.camPitch = clamp(S.camPitch + dy * k, -0.75, 1.05);
    S.lastLook = S.lastInput = S.time;
  }
  function showStick(on, x, y) { if (!stick.el) return; stick.el.hidden = !on; if (on) { stick.el.style.left = x + 'px'; stick.el.style.top = y + 'px'; moveKnob(0, 0); } }
  function moveKnob(dx, dy) { if (stick.el) stick.el.firstElementChild.style.transform = `translate(${dx}px, ${dy}px)`; }

  // ---------------------------------------------------------------- the camera's view of the place
  function boomLimit(col, from, dir, len) {
    if (!col) return len;
    for (let s = 0.4; s <= len; s += 0.2) {
      const x = from.x + dir.x * s, y = from.y + dir.y * s, z = from.z + dir.z * s;
      if (y < heightAt(x, z) + 0.35) return Math.max(0.7, s - 0.25);
      for (const o of col.near(x, z)) {
        if (o.hw === undefined || o.tall === false) continue;
        if (rectDist(o, x, z) < 0.35 && y < (o.top ?? 40)) return Math.max(0.7, s - 0.3);
      }
    }
    return len;
  }
  const pivot = new THREE.Vector3(), aim = new THREE.Vector3(), eye = new THREE.Vector3();
  let poiLook = null;

  function update(dt) {
    S.time += dt;
    const col = getColliders();
    // ------------------------------------------------ intent and movement
    let ix = 0, iz = 0;
    if (enabled) {
      if (keys.has('KeyW') || keys.has('ArrowUp')) iz += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) iz -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
      ix += stick.x; iz += stick.y;
    }
    const mag = Math.min(1, Math.hypot(ix, iz));
    S.run = keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(stick.x, stick.y) > 0.92;
    const target = mag < 0.05 ? 0 : (S.run ? 4.6 : 1.85 * (stick.id !== null ? clamp(mag / 0.85, 0.35, 1) : 1));
    const fx = Math.sin(S.camYaw), fz = Math.cos(S.camYaw), rx = -Math.cos(S.camYaw), rz = Math.sin(S.camYaw);
    let dx = fx * iz + rx * ix, dz = fz * iz + rz * ix;
    const dl = Math.hypot(dx, dz);
    if (dl > 1e-4) { dx /= dl; dz /= dl; }
    const acc = (target > S.speed ? 9 : 7) * (S.airborne ? 0.25 : 1);
    S.vel.x += (dx * target - S.vel.x) * (1 - Math.exp(-dt * acc));
    S.vel.y += (dz * target - S.vel.y) * (1 - Math.exp(-dt * acc));
    S.speed = Math.hypot(S.vel.x, S.vel.y);
    const prevYaw = S.yaw;
    if (S.speed > 0.15 && dl > 1e-4) S.yaw += wrap(Math.atan2(dx, dz) - S.yaw) * (1 - Math.exp(-dt * 11));
    const turnRate = wrap(S.yaw - prevYaw) / Math.max(dt, 1e-3);
    S.lean += (clamp(-turnRate * S.speed * 0.035, -0.28, 0.28) - S.lean) * (1 - Math.exp(-dt * 6));
    if (col) { const r = move(col, S.pos.x, S.pos.z, S.vel.x * dt, S.vel.y * dt, 0.3); S.pos.x = r.x; S.pos.z = r.z; } else { S.pos.x += S.vel.x * dt; S.pos.z += S.vel.y * dt; }
    const gy = heightAt(S.pos.x, S.pos.z);
    if (jumpQueued && !S.airborne) { S.vy = 4.7; S.airborne = true; }
    jumpQueued = false;
    if (S.airborne || S.pos.y > gy + 0.05) {
      S.vy -= 13 * dt; S.pos.y += S.vy * dt; S.airborne = true;
      if (S.pos.y <= gy) { S.pos.y = gy; S.vy = 0; S.airborne = false; }
    } else S.pos.y += (gy - S.pos.y) * (1 - Math.exp(-dt * 18));
    S.idle = S.speed < 0.1 && !S.airborne ? S.idle + dt : 0;
    if (S.firstPerson && S.speed < 0.15) S.yaw += wrap(S.camYaw - S.yaw) * (1 - Math.exp(-dt * 6));

    // ------------------------------------------------ the figure
    student.root.position.copy(S.pos);
    student.root.rotation.set(0, S.yaw, 0);
    student.root.children[0].rotation.z = S.lean;

    // ------------------------------------------------ the director
    const portrait = innerHeight > innerWidth;
    const clear = col ? nearest(col, S.pos.x, S.pos.z).d : 20;
    spring(S.open, clamp((clear - 2.5) / 11, 0, 1), dt, 1.2);
    const open = S.open.v;
    const resting = S.idle > 2.8 && S.time - S.lastInput > 3;
    const rest = resting ? Math.min(1, (S.idle - 2.8) / 3) : 0;
    // lazily swing behind the walker while walking and not steering
    if (S.speed > 0.6 && S.time - S.lastLook > 1.4 && !S.firstPerson) {
      const behind = wrap(S.yaw - S.camYaw);
      if (Math.abs(behind) < 2.2) S.camYaw += behind * (1 - Math.exp(-dt * 0.85 * Math.min(1, S.speed / 2)));
    }
    if (resting && !S.firstPerson) S.camYaw += dt * 0.012;    // a very slow drift while you rest
    const run = clamp((S.speed - 2) / 2.6, 0, 1);
    const pitchBias = (0.06 - 0.07 * open) - 0.05 * rest + (portrait ? 0.03 : 0);
    const distT = (4.4 + 2.0 * open + 0.5 * run + 0.7 * rest) * S.zoom * (portrait ? 1.28 : 1);
    const fovT = (portrait ? 60 : 50) + 3 * open + 4 * run + 2 * rest;
    spring(C.yaw, C.yaw.v + wrap(S.camYaw - C.yaw.v), dt, 9);
    spring(C.pitch, clamp(S.camPitch + pitchBias, -0.75, 1.1), dt, 9);
    spring(C.dist, distT, dt, 3.2);
    spring(C.fov, fovT, dt, 2.5);
    spring(C.side, (0.32 * (1 - rest * 0.3)) * (0.4 + 0.6 * open) * (portrait ? 0.4 : 1), dt, 2);
    spring(C.lead.x, S.vel.x * 0.35, dt, 2.2);
    spring(C.lead.z, S.vel.y * 0.35, dt, 2.2);
    spring(S.fp, S.firstPerson ? 1 : 0, dt, 8);
    const cy = C.yaw.v, cpv = C.pitch.v;
    const cfx = Math.sin(cy), cfz = Math.cos(cy), crx = -Math.cos(cy), crz = Math.sin(cy);
    const cp = Math.cos(cpv), spv = Math.sin(cpv);
    pivot.set(S.pos.x + C.lead.x.v - crx * C.side.v, S.pos.y + 1.45, S.pos.z + C.lead.z.v - crz * C.side.v);
    const back = new THREE.Vector3(-cfx * cp, spv, -cfz * cp);
    const len = boomLimit(col, pivot, back, C.dist.v);
    spring(C.boom, Math.min(len, C.dist.v), dt, len < C.boom.v ? 22 : 3.5);
    const fp = clamp(S.fp.v, 0, 1);
    eye.copy(pivot).addScaledVector(back, C.boom.v * (1 - fp));
    if (fp > 0.001) eye.lerp(new THREE.Vector3(S.pos.x + Math.sin(S.yaw) * 0.12, S.pos.y + 1.56, S.pos.z + Math.cos(S.yaw) * 0.12), fp);
    camera.position.copy(eye);
    // aim past the student so they sit low in the frame, the place opening ahead of them
    aim.set(pivot.x + cfx * cp * 3.2, pivot.y + 0.55 - spv * 3.2, pivot.z + cfz * cp * 3.2);
    if (fp > 0.001) aim.lerp(new THREE.Vector3(eye.x + cfx * cp * 5, eye.y - spv * 5, eye.z + cfz * cp * 5), fp);
    camera.lookAt(aim);
    if (Math.abs(camera.fov - C.fov.v) > 0.01) { camera.fov = C.fov.v; camera.updateProjectionMatrix(); }
    student.setVisible(fp < 0.6);

    // ------------------------------------------------ where the student looks
    if (S.time - S.lastLook < 2.5 || S.speed > 0.2) {
      const rel = wrap(cy - S.yaw);
      student.lookAt(Math.abs(rel) < 1.9 ? rel : 0, clamp(-(cpv - 0.15) * 1.1, -0.4, 0.7), Math.abs(rel) < 1.9 ? 0.85 : 0.3);
      poiLook = null;
    } else if (S.idle > 2) {
      if (!poiLook) {
        let best = null, bs = -1;
        for (const p of pois) {
          const ddx = p.x - S.pos.x, ddz = p.z - S.pos.z, d = Math.hypot(ddx, ddz);
          if (d < 6 || d > p.r) continue;
          const rel = wrap(Math.atan2(ddx, ddz) - S.yaw);
          if (Math.abs(rel) > 1.6) continue;
          const score = p.w / (1 + d / 40) * (1.2 - Math.abs(rel) / 1.6);
          if (score > bs) { bs = score; best = { yaw: rel, pitch: Math.atan2(p.y - S.pos.y - 1.5, d) }; }
        }
        poiLook = best || { yaw: 0.25, pitch: 0.12 };
      }
      student.lookAt(poiLook.yaw, poiLook.pitch, 0.9);
    } else student.lookAt(0, 0, 0);
    student.update(S.airborne ? Math.min(S.speed, 1) : S.speed, S.airborne && S.vy < 3.5, dt);
    return S;
  }

  function place(x, z, yaw) {
    const col = getColliders();
    const p = col ? freeSpot(col, x, z, 0.32) : { x, z };
    S.pos.set(p.x, heightAt(p.x, p.z), p.z);
    S.yaw = yaw; S.camYaw = yaw; S.vel.set(0, 0); S.speed = 0;
    C.yaw.v = yaw; C.yaw.dv = 0;
  }
  return {
    state: S, cam: C, update, place,
    bindStick(el) { stick.el = el; },
    jump() { jumpQueued = true; },
    toggleView() { S.firstPerson = !S.firstPerson; return S.firstPerson; },
    setEnabled(v) { enabled = v; if (!v) { keys.clear(); stick.x = stick.y = 0; } },
    get firstPerson() { return S.firstPerson; },
  };
}
