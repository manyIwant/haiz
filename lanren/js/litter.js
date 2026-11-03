// Leaves that let go: a handful falling at any moment, and the litter they
// leave on the paving until the morning sweep.
import * as THREE from 'three';
import { mulberry } from './foliage.js';

const G = 9.81;

export class Litter {
  constructor(loose, rosettes, stride, capacity) {
    this.loose = loose;               // { mesh, attr, loose }
    this.ros = rosettes;
    this.stride = stride;
    this.cap = capacity;
    this.rand = mulberry(1988);
    this.falling = [];                // active falling leaves (max 40)
    this.ground = [];                 // settled leaves
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.v = new THREE.Vector3();
    this.s = new THREE.Vector3();
    this.onLand = null;
    this.spawnAcc = 0;
    this.nextGift = 18 + this.rand() * 10;   // the first leaf comes to those who wait
  }

  /** Lay the morning's litter: count grows with hours since the 7:00 sweep. */
  seedGround(season, minutes) {
    this.ground.length = 0;
    const sinceSweep = ((minutes - 7 * 60) + 1440) % 1440 / 60;   // hours
    const target = Math.round(Math.min(this.cap - 60, season.litter * 900 * Math.min(1, sinceSweep / 9) + 30));
    const n = this.ros.length / this.stride;
    for (let i = 0; i < target; i++) {
      const k = Math.floor(this.rand() * n) * this.stride;
      const drift = 1.5 + this.rand() * 2.5;
      const a = this.rand() * Math.PI * 2;
      let x = this.ros[k] + Math.cos(a) * drift * this.rand();
      let z = this.ros[k + 2] + Math.sin(a) * drift * this.rand();
      if (Math.hypot(x + 0.3, z - 0.05) < 2.5) { x += 2.8 * Math.sign(x + 0.3 || 1); }
      if (z > 9 || z < -10.2) continue;
      const age = Math.min(1.25, 0.72 + this.rand() * 0.5 + season.reddening * 0.1);
      this.ground.push({ x, z, yaw: this.rand() * 6.28, curl: this.rand(), age, variant: Math.floor(this.rand() * 4),
        len: 0.16 + this.rand() * 0.09, flip: this.rand() < 0.35 });
    }
  }

  /** Release a leaf from the canopy near point p (or a random rosette). */
  release(p = null, age = null, sourceLen = null, gift = false) {
    if (this.falling.length >= 40) return null;
    let x, y, z;
    if (p) { x = p.x; y = p.y; z = p.z; } else {
      const n = this.ros.length / this.stride;
      // outer rosettes let go more readily
      let k = 0;
      for (let tries = 0; tries < 6; tries++) {
        k = Math.floor(this.rand() * n) * this.stride;
        if (this.ros[k + 8] < 0.6) break;
      }
      x = this.ros[k]; y = this.ros[k + 1]; z = this.ros[k + 2];
    }
    const leaf = {
      p: new THREE.Vector3(x, y - 0.1, z),
      vel: new THREE.Vector3(0, -0.2, 0),
      phase: this.rand() * 6.28, freq: 1.6 + this.rand() * 1.3, swing: 0.5 + this.rand() * 0.5,
      spin: (this.rand() - 0.5) * 3.0, yaw: this.rand() * 6.28, tilt: 0,
      age: age ?? (0.65 + this.rand() * 0.5), variant: Math.floor(this.rand() * 4),
      len: sourceLen ?? (0.16 + this.rand() * 0.09), t: 0, slow: gift ? 0.75 : 1, gift, id: Math.random().toString(36).slice(2, 8)
    };
    this.falling.push(leaf);
    return leaf;
  }

  update(dt, wind, windDir, season, dwellSeconds) {
    // spontaneous fall, scaled by season and gusts
    const rate = season.fallRate / 60 * (0.6 + wind * 1.4);
    this.spawnAcc += dt * rate;
    while (this.spawnAcc > 1) { this.spawnAcc -= 1; this.release(); }
    // whoever stays long enough under the tree is given one
    if (dwellSeconds > this.nextGift) {
      this.nextGift = dwellSeconds + 45 + this.rand() * 60;
      if (this.falling.length < 3) (this.onGift ? this.onGift() : this.release(null, null, null, true));
    }
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const L = this.falling[i];
      const h = dt * L.slow;
      L.t += h;
      // falling-leaf oscillation: a damped pendulum glide with terminal speed
      const sw = Math.sin(L.t * L.freq + L.phase);
      const cw = Math.cos(L.t * L.freq + L.phase);
      L.vel.y += (-G * 0.12 - L.vel.y * 2.2) * h;
      L.vel.y = Math.max(L.vel.y, -1.25);
      const drift = 0.35 + wind * 1.4;
      L.p.x += (windDir.x * drift + cw * L.swing * Math.cos(L.yaw)) * h;
      L.p.z += (windDir.z * drift + cw * L.swing * Math.sin(L.yaw)) * h;
      L.p.y += (L.vel.y - Math.abs(sw) * 0.25) * h;
      L.yaw += L.spin * h;
      L.tilt = sw * 0.9;
      const floor = L.p.z < -10.3 ? -0.6 : 0.0;
      const bed = Math.hypot(L.p.x + 0.3, L.p.z - 0.05) < 2.15 ? 0.21 : 0;
      if (L.p.y <= floor + bed + 0.012) {
        this.falling.splice(i, 1);
        if (!bed) {
          this.ground.push({ x: L.p.x, z: L.p.z, yaw: L.yaw, curl: this.rand(), age: L.age, variant: L.variant, len: L.len, flip: this.rand() < 0.35, y: floor });
          if (this.ground.length > this.cap - 50) this.ground.shift();
        }
        this.onLand?.(L);
      }
    }
    this._write();
  }

  _write() {
    const { mesh, attr, loose } = this.loose;
    let n = 0;
    const m = this.m, q = this.q, e = this.e;
    for (const L of this.falling) {
      e.set(L.tilt * 0.6, L.yaw, L.tilt, 'YXZ');
      q.setFromEuler(e);
      this.s.setScalar(L.len);
      m.compose(L.p, q, this.s);
      mesh.setMatrixAt(n, m);
      loose[n * 4] = L.age; loose[n * 4 + 1] = L.variant; loose[n * 4 + 2] = 0.3; loose[n * 4 + 3] = 1;
      n++;
    }
    for (const g of this.ground) {
      e.set(g.flip ? Math.PI : 0, g.yaw, (g.curl - 0.5) * 0.25, 'YXZ');
      q.setFromEuler(e);
      this.v.set(g.x, (g.y || 0) + 0.012 + g.curl * 0.012, g.z);
      this.s.setScalar(g.len);
      m.compose(this.v, q, this.s);
      mesh.setMatrixAt(n, m);
      loose[n * 4] = g.age; loose[n * 4 + 1] = g.variant; loose[n * 4 + 2] = g.curl; loose[n * 4 + 3] = 0;
      n++;
      if (n >= this.cap) break;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    attr.needsUpdate = true;
  }

  /** Nearest falling leaf to a ray (for catching), within a generous radius. */
  pick(ray, maxDist = 0.55) {
    let best = null, bestD = maxDist;
    for (const L of this.falling) {
      const d = ray.distanceToPoint(L.p);
      const along = L.p.clone().sub(ray.origin).dot(ray.direction);
      const k = d / Math.max(1, along * 0.12);
      if (along > 0 && k < bestD) { bestD = k; best = L; }
    }
    return best;
  }

  pickGround(ray) {
    if (ray.direction.y >= -0.05) return null;
    const t = -ray.origin.y / ray.direction.y;
    const hx = ray.origin.x + ray.direction.x * t, hz = ray.origin.z + ray.direction.z * t;
    let best = -1, bd = 0.22;
    this.ground.forEach((g, i) => { const d = Math.hypot(g.x - hx, g.z - hz); if (d < bd) { bd = d; best = i; } });
    if (best < 0) return null;
    const g = this.ground.splice(best, 1)[0];
    return g;
  }
}
