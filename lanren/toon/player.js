// Third person by default: the camera rides a boom behind and a little above the student, framing
// them low in the picture with the campus opening up ahead (the reference's framing). Drag (or the
// right thumb) swings the camera round; the wheel or a pinch sets the boom; V goes to first person
// and back. While walking without touching the camera it drifts back behind the student, lazily,
// as players expect. The boom shortens when a building would come between the camera and the
// student, and never dips below the ground.
//
// The student moves relative to the camera (WASD / arrows / left thumb), walks or runs (Shift, or
// the stick pushed to its rim), jumps (Space / the button), turns smoothly into its direction and
// leans into turns. Walls come from lanren/world/collide.js (the same solver as the first-person
// walk) with the Blender V3 hulls; covered walkways and pavilions lift the feet to their decks.
import * as THREE from 'three';
import { move, freeSpot } from '../world/collide.js';

const clamp = THREE.MathUtils.clamp;
const wrapAngle = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

function rectDist(o, x, z) {
  const dx = x - o.cx, dz = z - o.cz;
  const lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
  const qx = Math.abs(lx) - o.hw, qz = Math.abs(lz) - o.hd;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
}

export function createPlayer({ camera, dom, student, getColliders, heightAt, ground, spawn, coarse }) {
  const S = {
    pos: new THREE.Vector3(spawn.x, heightAt(spawn.x, spawn.z), spawn.z),
    vy: 0, airborne: false, yaw: spawn.yaw, speed: 0, vel: new THREE.Vector2(),
    camYaw: spawn.yaw, camPitch: 0.14, dist: 5.2, distWant: 5.2, distSmooth: 5.2,
    firstPerson: false, fpBlend: 0, lean: 0, lastLook: -10, time: 0, run: false,
  };
  const keys = new Set();
  const stick = { x: 0, y: 0, id: null, ox: 0, oy: 0, el: null };
  const look = { id: null, x: 0, y: 0 };
  let pinch = null, jumpQueued = false, enabled = true;

  // ---------------------------------------------------------------- input
  const onKey = (e, down) => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const k = e.code;
    if (down) {
      if (k === 'Space') { jumpQueued = true; e.preventDefault(); }
      if (k === 'KeyV') S.firstPerson = !S.firstPerson;
      keys.add(k);
    } else keys.delete(k);
    if (/Arrow/.test(k)) e.preventDefault();
  };
  addEventListener('keydown', (e) => onKey(e, true));
  addEventListener('keyup', (e) => onKey(e, false));
  addEventListener('blur', () => keys.clear());

  let drag = null;
  dom.addEventListener('pointerdown', (e) => {
    if (!enabled) return;
    if (e.pointerType === 'touch') {
      const left = e.clientX < innerWidth * 0.42;
      if (left && stick.id === null) {
        stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0;
        showStick(true, e.clientX, e.clientY);
      } else if (look.id === null) {
        look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY;
      } else if (!pinch) {
        pinch = { a: look.id, b: e.pointerId, d: 0 };
      }
      dom.setPointerCapture?.(e.pointerId);
      return;
    }
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
    dom.setPointerCapture?.(e.pointerId);
  });
  const pts = new Map();
  dom.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') {
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (e.pointerId === stick.id) {
        const R = 56;
        let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
        const L = Math.hypot(dx, dy);
        if (L > R) { dx *= R / L; dy *= R / L; }
        stick.x = dx / R; stick.y = -dy / R;
        moveKnob(dx, dy);
      } else if (pinch && pts.has(pinch.a) && pts.has(pinch.b)) {
        const [a, b] = [pts.get(pinch.a), pts.get(pinch.b)];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch.d) S.distWant = clamp(S.distWant * (pinch.d / d), 1.6, 9);
        pinch.d = d;
      } else if (e.pointerId === look.id) {
        turn(e.clientX - look.x, e.clientY - look.y, 0.0055);
        look.x = e.clientX; look.y = e.clientY;
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
    if (e.pointerId === look.id) look.id = null;
    if (pinch && (e.pointerId === pinch.a || e.pointerId === pinch.b)) pinch = null;
    if (drag && e.pointerId === drag.id) drag = null;
  };
  dom.addEventListener('pointerup', end);
  dom.addEventListener('pointercancel', end);
  dom.addEventListener('wheel', (e) => { e.preventDefault(); S.distWant = clamp(S.distWant * Math.exp(e.deltaY * 0.0012), 1.6, 9); }, { passive: false });
  dom.addEventListener('contextmenu', (e) => e.preventDefault());

  function turn(dx, dy, k) {
    S.camYaw -= dx * k;
    S.camPitch = clamp(S.camPitch + dy * k, -0.5, 1.05);
    S.lastLook = S.time;
  }
  function showStick(on, x, y) {
    if (!stick.el) return;
    stick.el.hidden = !on;
    if (on) { stick.el.style.left = x + 'px'; stick.el.style.top = y + 'px'; moveKnob(0, 0); }
  }
  function moveKnob(dx, dy) { if (stick.el) stick.el.firstElementChild.style.transform = `translate(${dx}px, ${dy}px)`; }

  // ---------------------------------------------------------------- camera boom
  const pivot = new THREE.Vector3(), aim = new THREE.Vector3(), want = new THREE.Vector3();
  function boomLimit(col, from, dir, len) {
    if (!col) return len;
    const step = 0.2;
    for (let s = 0.4; s <= len; s += step) {
      const x = from.x + dir.x * s, y = from.y + dir.y * s, z = from.z + dir.z * s;
      if (y < ground(x, z) + 0.3) return Math.max(0.6, s - 0.25);
      for (const o of col.near(x, z)) {
        if (o.hw === undefined || o.tall === false) continue;
        if (rectDist(o, x, z) < 0.3 && y < (o.top ?? 40)) return Math.max(0.6, s - 0.3);
      }
    }
    return len;
  }

  function update(dt) {
    S.time += dt;
    const col = getColliders();
    // ------------------------------------------------ intent
    let ix = 0, iz = 0;
    if (enabled) {
      if (keys.has('KeyW') || keys.has('ArrowUp')) iz += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) iz -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
      ix += stick.x; iz += stick.y;
    }
    let mag = Math.min(1, Math.hypot(ix, iz));
    const stickRun = Math.hypot(stick.x, stick.y) > 0.92;
    S.run = keys.has('ShiftLeft') || keys.has('ShiftRight') || stickRun;
    const target = mag < 0.05 ? 0 : (S.run ? 4.6 : 1.85 * (stick.id !== null ? clamp(mag / 0.85, 0.35, 1) : 1));
    const fx = Math.sin(S.camYaw), fz = Math.cos(S.camYaw);
    const rx = -Math.cos(S.camYaw), rz = Math.sin(S.camYaw);
    let dx = fx * iz + rx * ix, dz = fz * iz + rz * ix;
    const dl = Math.hypot(dx, dz);
    if (dl > 1e-4) { dx /= dl; dz /= dl; }
    // accelerate toward the intended velocity (quick to start, a little slower to stop)
    const acc = target > S.speed ? 9 : 7;
    const vx = dx * target, vz = dz * target;
    S.vel.x += (vx - S.vel.x) * (1 - Math.exp(-dt * acc * (S.airborne ? 0.25 : 1)));
    S.vel.y += (vz - S.vel.y) * (1 - Math.exp(-dt * acc * (S.airborne ? 0.25 : 1)));
    S.speed = Math.hypot(S.vel.x, S.vel.y);
    // ------------------------------------------------ turn into the motion, lean into turns
    const prevYaw = S.yaw;
    if (S.speed > 0.15 && dl > 1e-4) {
      const want = Math.atan2(dx, dz);
      S.yaw += wrapAngle(want - S.yaw) * (1 - Math.exp(-dt * 11));
    }
    const turnRate = wrapAngle(S.yaw - prevYaw) / Math.max(dt, 1e-3);
    S.lean += (clamp(-turnRate * S.speed * 0.035, -0.28, 0.28) - S.lean) * (1 - Math.exp(-dt * 6));
    // ------------------------------------------------ move with collisions, ground and jump
    if (col) {
      const r = move(col, S.pos.x, S.pos.z, S.vel.x * dt, S.vel.y * dt, 0.3);
      S.pos.x = r.x; S.pos.z = r.z;
    } else { S.pos.x += S.vel.x * dt; S.pos.z += S.vel.y * dt; }
    const gy = heightAt(S.pos.x, S.pos.z);
    if (jumpQueued && !S.airborne) { S.vy = 4.7; S.airborne = true; }
    jumpQueued = false;
    if (S.airborne || S.pos.y > gy + 0.05) {
      S.vy -= 13 * dt;
      S.pos.y += S.vy * dt;
      S.airborne = true;
      if (S.pos.y <= gy) { S.pos.y = gy; S.vy = 0; S.airborne = false; }
    } else {
      // step up onto a deck, or settle down
      S.pos.y += (gy - S.pos.y) * (1 - Math.exp(-dt * 18));
    }
    // ------------------------------------------------ the figure
    student.root.position.copy(S.pos);
    student.root.rotation.set(0, S.yaw, 0);
    student.root.children[0].rotation.z = S.lean;
    student.update(S.airborne ? Math.min(S.speed, 1) : S.speed, S.airborne && S.vy < 3.5, dt);
    // ------------------------------------------------ camera
    S.fpBlend += ((S.firstPerson ? 1 : 0) - S.fpBlend) * (1 - Math.exp(-dt * 7));
    // drift back behind the walker when walking and not steering the camera
    if (S.speed > 0.6 && S.time - S.lastLook > 1.4 && !S.firstPerson) {
      const behind = wrapAngle(S.yaw - S.camYaw);
      if (Math.abs(behind) < 2.2) S.camYaw += behind * (1 - Math.exp(-dt * 0.9 * Math.min(1, S.speed / 2)));
    }
    if (S.firstPerson) {
      // in first person the walker turns with the view
      if (S.speed < 0.15) S.yaw += wrapAngle(S.camYaw - S.yaw) * (1 - Math.exp(-dt * 6));
    }
    const headY = 1.56;
    pivot.set(S.pos.x, S.pos.y + 1.42, S.pos.z);
    const cp = Math.cos(S.camPitch), sp = Math.sin(S.camPitch);
    const back = new THREE.Vector3(-fx * cp, sp, -fz * cp);
    const len = boomLimit(col, pivot, back, S.distWant);
    const kIn = len < S.distSmooth ? 18 : 3.5;
    S.distSmooth += (len - S.distSmooth) * (1 - Math.exp(-dt * kIn));
    const d3 = S.distSmooth * (1 - S.fpBlend);
    want.copy(pivot).addScaledVector(back, d3);
    // first person: the eye in the head, a little forward
    if (S.fpBlend > 0.001) {
      const eye = new THREE.Vector3(S.pos.x + Math.sin(S.yaw) * 0.12, S.pos.y + headY, S.pos.z + Math.cos(S.yaw) * 0.12);
      want.lerp(eye, S.fpBlend);
    }
    camera.position.copy(want);
    aim.set(pivot.x + fx * cp * 3.2, pivot.y + 0.55 - sp * 3.2, pivot.z + fz * cp * 3.2);
    if (S.fpBlend > 0.001) {
      const fpAim = new THREE.Vector3(want.x + fx * cp * 5, want.y - sp * 5, want.z + fz * cp * 5);
      aim.lerp(fpAim, S.fpBlend);
    }
    camera.lookAt(aim);
    student.setVisible(S.fpBlend < 0.6);
    return S;
  }

  function place(x, z, yaw) {
    const col = getColliders();
    const p = col ? freeSpot(col, x, z, 0.32) : { x, z };
    S.pos.set(p.x, heightAt(p.x, p.z), p.z);
    S.yaw = yaw; S.camYaw = yaw; S.vel.set(0, 0); S.speed = 0;
  }

  return {
    state: S, update, place,
    bindStick(el) { stick.el = el; },
    jump() { jumpQueued = true; },
    toggleView() { S.firstPerson = !S.firstPerson; return S.firstPerson; },
    setEnabled(v) { enabled = v; if (!v) { keys.clear(); stick.x = stick.y = 0; } },
    get firstPerson() { return S.firstPerson; },
  };
}
