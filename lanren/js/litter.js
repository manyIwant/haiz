// Leaves that let go. As the flush begins, last year's red leaves drop (each
// at its own growth time); later a mature leaf falls now and then for anyone
// who lingers. They settle on the island or float on the still water.
import * as THREE from 'three';
import { mulberry } from './foliage.js';

export class Litter {
  constructor(loose, rosettes, stride, capacity, heightAt, water) {
    Object.assign(this, { loose, ros: rosettes, stride, cap: capacity, heightAt, water });
    this.rand = mulberry(1988);
    this.falling = [];
    this.settled = [];
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler();
    this.v = new THREE.Vector3(); this.s = new THREE.Vector3();
    this.onLand = null;
    this.onGift = null;
    this.lastGrow = 0;
    this.giftAt = 22;
    // rosettes that carry old leaves, sorted by their drop time
    this.old = [];
    for (let i = 0; i < rosettes.length; i += stride) if (rosettes[i + 10] > 0) this.old.push(i);
    this.old.sort((a, b) => rosettes[a + 10] - rosettes[b + 10]);
  }

  release(p = null, age = null, len = null, gift = false) {
    if (this.falling.length >= 60) return null;
    let x, y, z;
    if (p) ({ x, y, z } = p);
    else {
      const k = Math.floor(this.rand() * (this.ros.length / this.stride)) * this.stride;
      x = this.ros[k]; y = this.ros[k + 1]; z = this.ros[k + 2];
    }
    const L = {
      p: new THREE.Vector3(x, y - 0.1, z), vy: -0.2,
      phase: this.rand() * 6.28, freq: 1.6 + this.rand() * 1.3, swing: 0.5 + this.rand() * 0.5,
      spin: (this.rand() - 0.5) * 3.0, yaw: this.rand() * 6.28, tilt: 0,
      age: age ?? (0.85 + this.rand() * 0.3), variant: Math.floor(this.rand() * 4),
      len: len ?? (0.17 + this.rand() * 0.08), t: 0, slow: gift ? 0.7 : 1, gift
    };
    this.falling.push(L);
    return L;
  }

  /** grow: current growth; leaves whose drop time was just passed let go. */
  update(dt, grow, wind, windDir, dwell, finale) {
    if (grow > this.lastGrow) {
      for (const i of this.old) {
        const t = this.ros[i + 10];
        if (t > this.lastGrow && t <= grow) {
          const n = 1 + Math.floor(this.rand() * 2);
          for (let k = 0; k < n; k++) this.release(new THREE.Vector3(this.ros[i], this.ros[i + 1], this.ros[i + 2]), 0.85 + this.rand() * 0.3);
        }
      }
    } else if (grow < this.lastGrow - 0.02) {
      // walking back in time: the leaves on the ground go back to the branches
      this.settled = this.settled.filter((s) => s.mature);
    }
    this.lastGrow = grow;
    if (finale && dwell > this.giftAt && this.falling.length < 4) {
      this.giftAt = dwell + 30 + this.rand() * 35;
      (this.onGift ? this.onGift() : this.release(null, null, null, true));
      if (this.falling.length) this.falling[this.falling.length - 1].mature = true;
    }
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const L = this.falling[i];
      const h = dt * L.slow;
      L.t += h;
      const sw = Math.sin(L.t * L.freq + L.phase), cw = Math.cos(L.t * L.freq + L.phase);
      L.vy += (-1.2 - L.vy * 2.2) * h;
      L.vy = Math.max(L.vy, -1.2);
      const drift = 0.3 + wind * 1.4;
      L.p.x += (windDir.x * drift + cw * L.swing * Math.cos(L.yaw)) * h;
      L.p.z += (windDir.z * drift + cw * L.swing * Math.sin(L.yaw)) * h;
      L.p.y += (L.vy - Math.abs(sw) * 0.25) * h;
      L.yaw += L.spin * h;
      L.tilt = sw * 0.9;
      const floor = this.heightAt(L.p.x, L.p.z);
      if (L.p.y <= floor + 0.015) {
        this.falling.splice(i, 1);
        const onWater = floor <= this.water + 0.001;
        this.settled.push({ x: L.p.x, y: floor, z: L.p.z, yaw: L.yaw, curl: this.rand(), age: L.age, variant: L.variant,
          len: L.len, flip: this.rand() < 0.3, water: onWater, t: 0, mature: !!L.mature });
        if (this.settled.length > this.cap - 80) this.settled.shift();
        this.onLand?.(L);
      }
    }
    for (const s of this.settled) {
      if (!s.water) continue;
      s.t += dt;
      s.x += windDir.x * 0.05 * dt;
      s.z += windDir.z * 0.05 * dt;
      s.yaw += Math.sin(s.t * 0.3 + s.curl * 6) * 0.02 * dt;
    }
    this._write();
  }

  _write() {
    const { mesh, attr, loose } = this.loose;
    let n = 0;
    const { m, q, e } = this;
    for (const L of this.falling) {
      e.set(L.tilt * 0.6, L.yaw, L.tilt, 'YXZ');
      q.setFromEuler(e);
      m.compose(L.p, q, this.s.setScalar(L.len));
      mesh.setMatrixAt(n, m);
      loose.set([L.age, L.variant, 0.3, 1], n * 4);
      n++;
    }
    for (const g of this.settled) {
      if (n >= this.cap) break;
      e.set(g.flip ? Math.PI : 0, g.yaw, (g.curl - 0.5) * 0.25, 'YXZ');
      q.setFromEuler(e);
      this.v.set(g.x, g.y + 0.012 + (g.water ? 0.004 : g.curl * 0.012), g.z);
      m.compose(this.v, q, this.s.setScalar(g.len));
      mesh.setMatrixAt(n, m);
      loose.set([g.age, g.variant, g.curl, g.water ? 0.6 : 0], n * 4);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    attr.needsUpdate = true;
  }

  pick(ray, maxDist = 0.55) {
    let best = null, bestD = maxDist;
    for (const L of this.falling) {
      const along = L.p.clone().sub(ray.origin).dot(ray.direction);
      const k = ray.distanceToPoint(L.p) / Math.max(1, along * 0.12);
      if (along > 0 && k < bestD) { bestD = k; best = L; }
    }
    return best;
  }

  pickGround(ray) {
    if (ray.direction.y >= -0.05) return null;
    let best = -1, bd = 0.25;
    this.settled.forEach((g, i) => {
      const t = (g.y - ray.origin.y) / ray.direction.y;
      const hx = ray.origin.x + ray.direction.x * t, hz = ray.origin.z + ray.direction.z * t;
      const d = Math.hypot(g.x - hx, g.z - hz);
      if (d < bd) { bd = d; best = i; }
    });
    return best < 0 ? null : this.settled.splice(best, 1)[0];
  }
}
