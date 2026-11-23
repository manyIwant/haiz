// A small orbit camera for the lab (the vendored three has no OrbitControls): drag to turn, wheel or
// pinch to move closer, right-drag / two-finger drag / shift-drag to pan. `go` flies to a study view
// along a smooth arc of the same spherical coordinates, so the move reads as one camera, not a cut.
import * as THREE from 'three';

export function createOrbit(camera, dom, { minY = 0, onChange = () => {} } = {}) {
  const target = new THREE.Vector3();
  const sph = new THREE.Spherical(30, 1.2, 0);
  let fly = null;
  const v = new THREE.Vector3();
  const apply = () => {
    sph.makeSafe();
    v.setFromSpherical(sph).add(target);
    if (v.y < minY) v.y = minY;
    camera.position.copy(v);
    camera.lookAt(target);
  };
  const toSph = (pos, tgt) => new THREE.Spherical().setFromVector3(new THREE.Vector3(...pos).sub(new THREE.Vector3(...tgt)));
  const pointers = new Map();
  let last = null, pinch = 0;
  const pan = (dx, dy) => {
    const k = sph.radius * 0.0016;
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
    const fwd = new THREE.Vector3().crossVectors(camera.up, right).normalize();
    target.addScaledVector(right, -dx * k).addScaledVector(fwd, dy * k);
  };
  dom.addEventListener('contextmenu', (e) => e.preventDefault());
  dom.addEventListener('pointerdown', (e) => {
    dom.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button, shift: e.shiftKey });
    last = { x: e.clientX, y: e.clientY };
    fly = null;
  });
  const end = (e) => { pointers.delete(e.pointerId); pinch = 0; last = null; };
  dom.addEventListener('pointerup', end); dom.addEventListener('pointercancel', end);
  dom.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    if (pointers.size === 2) {
      p.x = e.clientX; p.y = e.clientY;
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (pinch) { sph.radius = THREE.MathUtils.clamp(sph.radius * pinch / d, 2, 400); if (last) pan(mx - last.x, my - last.y); }
      pinch = d; last = { x: mx, y: my };
      apply(); onChange();
      return;
    }
    if (!last) return;
    const dx = e.clientX - last.x, dy = e.clientY - last.y;
    last = { x: e.clientX, y: e.clientY };
    if (p.button === 2 || p.shift) pan(dx, dy);
    else { sph.theta -= dx * 0.005; sph.phi = THREE.MathUtils.clamp(sph.phi - dy * 0.004, 0.15, Math.PI / 2 - 0.02); }
    apply(); onChange();
  });
  dom.addEventListener('wheel', (e) => {
    e.preventDefault(); fly = null;
    sph.radius = THREE.MathUtils.clamp(sph.radius * Math.exp(e.deltaY * 0.001), 2, 400);
    apply(); onChange();
  }, { passive: false });

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  return {
    target,
    get moving() { return !!fly; },
    go(pos, tgt, dur = 1.2) {
      const to = toSph(pos, tgt);
      if (dur <= 0) { target.set(...tgt); sph.copy(to); apply(); fly = null; return; }
      let dth = to.theta - sph.theta;
      while (dth > Math.PI) dth -= 2 * Math.PI; while (dth < -Math.PI) dth += 2 * Math.PI;
      fly = { t: 0, dur, t0: target.clone(), t1: new THREE.Vector3(...tgt), s0: sph.clone(), dth, s1: to };
    },
    update(dt) {
      if (!fly) { apply(); return; }
      fly.t = Math.min(1, fly.t + dt / fly.dur);
      const k = ease(fly.t);
      target.lerpVectors(fly.t0, fly.t1, k);
      // a little lift in the middle of the move, so the camera rises over what lies between
      const lift = Math.sin(Math.PI * k) * 0.12;
      sph.radius = THREE.MathUtils.lerp(fly.s0.radius, fly.s1.radius, k) * (1 + lift);
      sph.phi = THREE.MathUtils.lerp(fly.s0.phi, fly.s1.phi, k) - lift * 0.6;
      sph.theta = fly.s0.theta + fly.dth * k;
      apply();
      if (fly.t >= 1) fly = null;
    },
  };
}
