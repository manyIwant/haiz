// HAIZ · 自由共游 — what the air picks up: fallen 榄仁 leaves (green, yellow, the red of a leaf about to drop),
// bougainvillea bracts from the flower beds, clippings off a lawn. Each is a little card that tumbles in the
// wake's own wind (lanren/free/wake.js windAt, the same field the grass leans in) plus the day's breeze,
// falls with a leaf's drag (it sails and side-slips rather than drops), lies on the ground a moment and
// fades. Nothing is emitted unless something is moving past it: the world answers, it does not decorate.
import * as THREE from 'three';
import { cel, windAt as breezeAt, U } from '../ruhua-stroll/atmos.js';

const KIND = { leafG: 0, leafY: 1, leafR: 2, petal: 3, grass: 4 };
const COLORS = {
  0: ['#4f8a3a', '#5e9a3c', '#3f7a35'], 1: ['#c2a23a', '#d0b04a', '#a8902e'], 2: ['#a3361e', '#8e2a17', '#b8482a'],
  3: ['#c42a6a', '#d8488a', '#e070a0', '#f2e6e8'], 4: ['#6aa040', '#7cb04a'],
};

function leafGeometry() {
  // a pointed oval with a fold along the midrib (so it catches light as it turns)
  const pts = [[0, -0.5, 0], [0.22, -0.25, 0.04], [0.26, 0.05, 0.05], [0.16, 0.32, 0.03], [0, 0.5, 0], [-0.16, 0.32, 0.03], [-0.26, 0.05, 0.05], [-0.22, -0.25, 0.04], [0, 0, -0.03]];
  const pos = new Float32Array(pts.flat());
  const idx = [];
  for (let i = 0; i < 8; i++) idx.push(8, i, (i + 1) % 8);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function createParticles({ world, wake, layer, max = 700 }) {
  const mat = cel({ name: 'blown', key: 'blown', side: THREE.DoubleSide, soft: 0.3, flipBack: true });
  const mesh = new THREE.InstancedMesh(leafGeometry(), mat, max);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
  mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true;
  mesh.layers.set(layer);
  world.group.add(mesh);
  const P = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pv = new THREE.Vector3(), col = new THREE.Color();
  const w = { x: 0, y: 0, z: 0 };
  const rnd = (a, b) => a + Math.random() * (b - a);

  function emit(kind, x, y, z, vx, vy, vz, n = 1) {
    for (let i = 0; i < n; i++) {
      if (P.length >= max) { const o = P.shift(); void o; }
      const size = kind === KIND.grass ? rnd(0.025, 0.045) : kind === KIND.petal ? rnd(0.035, 0.06) : rnd(0.08, 0.14);
      const cs = COLORS[kind];
      P.push({
        kind, x: x + rnd(-0.3, 0.3), y, z: z + rnd(-0.3, 0.3), vx: vx + rnd(-0.6, 0.6), vy: vy + rnd(0, 1), vz: vz + rnd(-0.6, 0.6),
        rx: rnd(0, 6.28), ry: rnd(0, 6.28), rz: rnd(0, 6.28), sx: rnd(-6, 6), sy: rnd(-4, 4), sz: rnd(-6, 6),
        size, life: 0, rest: 0, ttl: rnd(3, 6), color: cs[(Math.random() * cs.length) | 0], ph: rnd(0, 6.28),
      });
    }
  }

  // what grows where (for "what does the air pick up here?")
  const crowns = world.crowns;
  const beds = world.beds || [];
  const under = (x, z) => {
    let best = null, bd = 1e9;
    for (const t of crowns) { const d = Math.hypot(x - t.x, z - t.z) / t.r; if (d < 1.1 && d < bd) { bd = d; best = t; } }
    return best;
  };
  const nearBed = (x, z) => { for (const b of beds) if (Math.hypot(x - b.x, z - b.z) < 1.4 + (b.s || 1) * 0.6) return b; return null; };
  let acc = 0, ambient = 0;

  /**
   * s: { pos, vel, speed, mode, agl, inCrown, surface }
   */
  function update(dt, s, cameraPos) {
    const speed = s.speed, low = s.agl < 2.2;
    // ---- emission
    acc += dt;
    if (acc > 0.05) {
      const step = acc; acc = 0;
      const t = under(s.pos.x, s.pos.z);
      const fast = Math.max(0, speed - (s.mode === 'walk' ? 3.2 : 2.5));
      const gx = s.pos.x, gz = s.pos.z, gy = s.pos.y - (s.mode === 'broom' ? s.agl : 0);
      const back = (k) => [-s.vel.x * k, -s.vel.z * k];
      if (low && fast > 0) {
        // fallen leaves under the crowns, kicked up
        if (t) {
          const n = Math.random() < fast * step * (s.mode === 'broom' ? 3.5 : 1.6) ? 1 + ((fast * 0.3) | 0) : 0;
          const [bx, bz] = back(0.15);
          for (let i = 0; i < n; i++) emit(Math.random() < 0.45 ? KIND.leafR : Math.random() < 0.5 ? KIND.leafY : KIND.leafG, gx + bx, gy + 0.05, gz + bz, s.vel.x * 0.25, rnd(1, 2.5), s.vel.z * 0.25);
        }
        // clippings off the lawn
        if (s.surface === 'lawn' && Math.random() < fast * step * (s.mode === 'broom' ? 6 : 2.5)) emit(KIND.grass, gx, gy + 0.1, gz, s.vel.x * 0.2, rnd(0.8, 2), s.vel.z * 0.2, 2);
        // bracts off a flower bed brushed past
        const b = nearBed(gx, gz);
        if (b && Math.random() < fast * step * 3) emit(KIND.petal, b.x + rnd(-0.6, 0.6), gy + 0.5, b.z + rnd(-0.6, 0.6), s.vel.x * 0.3, rnd(0.8, 2.2), s.vel.z * 0.3, 2);
      }
      // a hovering broom low over the ground blows the leaves outward from under it
      if (s.mode === 'broom' && s.agl < 3 && t && Math.random() < step * (3 - s.agl) * 1.4) {
        const a = rnd(0, 6.28), r = rnd(0.5, 1.6);
        emit(Math.random() < 0.5 ? KIND.leafR : KIND.leafY, gx + Math.cos(a) * r, gy + 0.05, gz + Math.sin(a) * r, Math.cos(a) * 2, rnd(0.5, 1.5), Math.sin(a) * 2);
      }
      // through a crown: the leaves you hit
      if (s.inCrown > 0.05 && speed > 1.5) {
        const n = Math.random() < s.inCrown * speed * step * 2 ? 1 + ((speed * 0.15 * s.inCrown) | 0) : 0;
        for (let i = 0; i < n; i++) emit(Math.random() < 0.8 ? KIND.leafG : KIND.leafR, s.pos.x + rnd(-1, 1), s.pos.y + rnd(-0.5, 1), s.pos.z + rnd(-1, 1), s.vel.x * 0.5, rnd(-0.5, 1), s.vel.z * 0.5);
      }
      // and, now and then, a leaf comes down from a crown near you on the breeze (the campus is not still)
      ambient += step;
      if (ambient > 0.4) {
        ambient = 0;
        for (const c of crowns) {
          const d = Math.hypot(c.x - cameraPos.x, c.z - cameraPos.z);
          if (d > 30 || Math.random() > 0.05 * (0.3 + breezeAt(c.x, c.z)) * U.uWindSway.value) continue;
          const a = rnd(0, 6.28), r = rnd(0, c.r * 0.8);
          emit(Math.random() < 0.5 ? KIND.leafY : KIND.leafR, c.x + Math.cos(a) * r, c.y - c.ry * 0.5, c.z + Math.sin(a) * r, 0, -0.3, 0);
        }
      }
    }
    // ---- motion
    const wd = U.uWindDir.value, ws = U.uWindSpeed.value * 0.35 * Math.min(2, U.uWindSway.value);
    let n = 0;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.life += dt;
      const g = world.heightAt(p.x, p.z) + 0.01;
      if (p.y <= g + 0.005 && p.vy <= 0.05) {
        // lying on the ground: the wake can lift it again; otherwise it waits, then fades
        wake.windAt(p.x, p.y + 0.2, p.z, w);
        const wl = Math.hypot(w.x, w.z);
        if (wl > 1.6) { p.vy = wl * 0.35; p.vx = w.x * 0.6; p.vz = w.z * 0.6; p.y = g + 0.02; }
        else { p.rest += dt; p.vx *= 0.8; p.vz *= 0.8; p.vy = 0; p.y = g; }
      } else {
        wake.windAt(p.x, p.y, p.z, w);
        const breeze = breezeAt(p.x, p.z);
        const ax = w.x + wd.x * ws * (0.4 + breeze), az = w.z + wd.y * ws * (0.4 + breeze), ay = w.y;
        const drag = p.kind === KIND.grass ? 2.2 : 3.6;
        p.vx += (ax - p.vx) * Math.min(1, drag * dt);
        p.vz += (az - p.vz) * Math.min(1, drag * dt);
        // a leaf sails: its fall is slowed, and it side-slips as it rocks
        const term = p.kind === KIND.grass ? -1.4 : -0.75;
        p.vy += (-9.8 * dt);
        p.vy = Math.max(p.vy, term + ay);
        p.vy += ay * dt * 3;
        const rock = Math.sin(p.life * 4 + p.ph);
        p.x += (p.vx + rock * 0.35 * Math.cos(p.ry)) * dt; p.z += (p.vz + rock * 0.35 * Math.sin(p.ry)) * dt; p.y += p.vy * dt;
        if (p.y < g) { p.y = g; p.vy = 0; }
        p.rx += p.sx * dt; p.ry += p.sy * dt; p.rz += p.sz * dt;
      }
      if (p.rest > p.ttl * 0.5 || p.life > p.ttl * 3) { P.splice(i, 1); continue; }
    }
    // ---- draw
    for (const p of P) {
      const lying = p.rest > 0;
      const fade = lying ? Math.max(0, 1 - p.rest / (p.ttl * 0.5)) : Math.min(1, p.life * 6);
      e.set(lying ? -Math.PI / 2 : p.rx, p.ry, lying ? 0 : p.rz);
      q.setFromEuler(e);
      const s = p.size * fade;
      m4.compose(pv.set(p.x, p.y + (lying ? 0.005 : 0), p.z), q, sc.set(s * (p.kind === KIND.grass ? 0.4 : 1), s, s));
      mesh.setMatrixAt(n, m4);
      mesh.setColorAt(n, col.set(p.color));
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  return { update, mesh, get count() { return P.length; }, emit, KIND };
}
