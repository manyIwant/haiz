// Walking: first person at a student's eye height, with weight (it accelerates and settles; it does
// not slide at full speed from the first frame), a step rhythm the head and the sound follow, and the
// campus's walls, the tree bed and the stones as solids.
//
//   desktop  WASD / arrows to walk, Shift to hurry, drag to look (or arrow keys ←→ with Alt)
//   touch    left half: a joystick that appears where the thumb lands; right half: drag to look
// Any input while the film runs hands the camera over (main.js); the film's place and heading become
// the walker's, so nothing jumps.
import * as THREE from 'three';
import { move } from '../world/collide.js';

const deg = Math.PI / 180;
const EYE = 1.55;

export function createWalker({ world, canvas, coarse, ui }) {
  const S = {
    pos: new THREE.Vector3(-36.1, 0, -95), vel: new THREE.Vector2(), yaw: 0, pitch: 0, eyeH: EYE, phase: 0, speed: 0,
    keys: new Set(), look: null, stick: null, stickV: new THREE.Vector2(), lastInput: -1,
  };
  const listeners = [];
  const fire = () => { for (const f of listeners) f(); };
  const stepCbs = [];

  // ---------------------------------------------------------------- keyboard
  const KEYMAP = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', ShiftLeft: 'run', ShiftRight: 'run' };
  addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName) && e.code !== 'ShiftLeft') return;
    const k = KEYMAP[e.code];
    if (!k) return;
    S.keys.add(k);
    if (k !== 'run') { fire(); e.preventDefault(); }
  });
  addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) S.keys.delete(k); });

  // ---------------------------------------------------------------- pointer: drag to look; on touch, the left half walks
  const pointers = new Map();
  canvas.addEventListener('pointerdown', (e) => {
    try { canvas.setPointerCapture?.(e.pointerId); } catch { /* synthetic or already released pointer */ }
    const left = coarse && e.clientX < innerWidth * 0.45;
    if (left && !S.stick) {
      S.stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY };
      ui.stick?.(true, e.clientX, e.clientY, 0, 0);
    } else pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, moved: 0 });
  });
  canvas.addEventListener('pointermove', (e) => {
    if (S.stick && e.pointerId === S.stick.id) {
      const R = 56, dx = e.clientX - S.stick.x0, dy = e.clientY - S.stick.y0, L = Math.hypot(dx, dy);
      const k = L > R ? R / L : 1;
      S.stickV.set((dx * k) / R, (dy * k) / R);
      ui.stick?.(true, S.stick.x0, S.stick.y0, dx * k, dy * k);
      if (L > 6) fire();
      return;
    }
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY; p.moved += Math.abs(dx) + Math.abs(dy);
    if (p.moved < 4) return;
    const k = (coarse ? 0.16 : 0.12) * (60 / (innerHeight / 10));   // degrees per pixel, a touch slower on big screens
    S.yaw -= dx * k * 1.1;
    S.pitch = Math.max(-70, Math.min(75, S.pitch - dy * k));
    fire();
  });
  const end = (e) => {
    if (S.stick && e.pointerId === S.stick.id) { S.stick = null; S.stickV.set(0, 0); ui.stick?.(false); }
    pointers.delete(e.pointerId);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---------------------------------------------------------------- simulation
  const tmpV = new THREE.Vector3();
  function blocked(x, z) { return world.bedBlocks(x, z); }

  function step(dt, camera) {
    // intended direction in the walker's frame
    let fx = 0, fz = 0;
    if (S.keys.has('f')) fz += 1; if (S.keys.has('b')) fz -= 1;
    if (S.keys.has('l')) fx -= 1; if (S.keys.has('r')) fx += 1;
    if (S.stick) { fx += S.stickV.x; fz -= S.stickV.y; }
    const L = Math.hypot(fx, fz);
    const run = S.keys.has('run') || (S.stick && S.stickV.length() > 0.92);
    const vmax = run ? 3.1 : 1.45;
    const want = new THREE.Vector2();
    if (L > 0.05) {
      const m = Math.min(1, L);
      const c = Math.cos(S.yaw * deg), s = Math.sin(S.yaw * deg);
      // yaw 0 faces +z; right of that is −x
      want.set((fz * s - fx * c) / L * m * vmax, (fz * c + fx * s) / L * m * vmax);
    }
    // weight: accelerate ~2.5 m/s², stop a little quicker
    const acc = want.lengthSq() > S.vel.lengthSq() ? 3.2 : 5.0;
    const dv = want.clone().sub(S.vel), dl = dv.length(), cap = acc * dt;
    if (dl > cap) dv.multiplyScalar(cap / dl);
    S.vel.add(dv);
    S.speed = S.vel.length();
    if (S.speed > 1e-3) {
      const dx = S.vel.x * dt, dz = S.vel.y * dt;
      let r = move(world.colliders, S.pos.x, S.pos.z, dx, dz, 0.3);
      if (blocked(r.x, r.z)) {
        // slide along the bed's wall: try each axis alone
        const a = move(world.colliders, S.pos.x, S.pos.z, dx, 0, 0.3), b = move(world.colliders, S.pos.x, S.pos.z, 0, dz, 0.3);
        r = !blocked(a.x, a.z) ? a : !blocked(b.x, b.z) ? b : { x: S.pos.x, z: S.pos.z };
        if (r.x === S.pos.x && r.z === S.pos.z) S.vel.multiplyScalar(0.3);
      }
      S.pos.x = r.x; S.pos.z = r.z;
    }
    // ground under the feet (the bed's steps ramp up), eased so steps read as steps, not teleports
    const g = world.heightAt(S.pos.x, S.pos.z);
    S.pos.y += (g - S.pos.y) * Math.min(1, dt * 10);
    S.eyeH += (EYE - S.eyeH) * Math.min(1, dt * 1.2);
    // the step rhythm: ~1.8 steps/s walking, ~2.7 running; head rises over the planted foot
    const cadence = S.speed < 0.15 ? 0 : 1.15 + S.speed * 0.5;
    const prev = S.phase;
    S.phase += cadence * dt * Math.PI;
    if (Math.floor(prev / Math.PI) !== Math.floor(S.phase / Math.PI)) for (const f of stepCbs) f(S.speed, S.pos);
    const bob = Math.abs(Math.sin(S.phase)) * 0.022 * Math.min(1, S.speed / 1.4);
    const sway = Math.sin(S.phase) * 0.010 * Math.min(1, S.speed / 1.4);
    // camera
    const c = Math.cos(S.yaw * deg), s = Math.sin(S.yaw * deg);
    camera.position.set(S.pos.x - c * sway, S.pos.y + S.eyeH + bob - 0.011, S.pos.z + s * sway);
    tmpV.set(s * Math.cos(S.pitch * deg), Math.sin(S.pitch * deg), c * Math.cos(S.pitch * deg));
    camera.lookAt(tmpV.add(camera.position));
    const fov = innerWidth / innerHeight < 0.9 ? 70 : 55;
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 2); camera.updateProjectionMatrix(); }
  }

  return {
    state: S, step,
    onInput: (f) => listeners.push(f),
    onStep: (f) => stepCbs.push(f),
    /** take the film's camera: same place, same heading, eye height eases to the walker's */
    takeOver(eye, look) {
      const g = world.heightAt(eye.x, eye.z);
      S.pos.set(eye.x, g, eye.z);
      S.eyeH = eye.y - g;
      const d = look.clone().sub(eye).normalize();
      S.yaw = Math.atan2(d.x, d.z) / deg;
      S.pitch = Math.asin(Math.max(-1, Math.min(1, d.y))) / deg;
      S.vel.set(0, 0);
    },
    /** place for tests: x, z, yaw (deg), pitch (deg) */
    place(x, z, yaw = 0, pitch = 0) { S.pos.set(x, world.heightAt(x, z), z); S.yaw = yaw; S.pitch = pitch; S.vel.set(0, 0); S.eyeH = EYE; },
    release() { S.keys.clear(); S.stick = null; S.stickV.set(0, 0); pointers.clear(); ui.stick?.(false); },
  };
}
