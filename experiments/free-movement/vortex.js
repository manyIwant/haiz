// HAIZ · 自由移动 — Counter-Rotating Twin Trailing Vortex Wake Simulation
//
// Directly inspired by Petalwake's vortex wake architecture (jjcm/petalwake, MIT License,
// Copyright (c) 2026 Jacob Miller), re-engineered and scaled for HAIZ's tropical campus across
// all five movement modes (walk, bicycle, skateboard, bamboo broom, Terminalia monsoon glider):
//
//   - Counter-rotating vortex core pairs shed along the flight/ride trail (N = 96 stations)
//   - Mirror-image ground interaction: cores sink toward ground/water then spread laterally apart
//   - Trumpet roll-up: tight near broom bristles / glider wingtips, opening smoothly downstream
//   - Unsteady gusty shedding + outer-core asymmetry during banked turns
//   - Fast spatial lookup grid for CPU sampling by falling 榄仁 leaves, bougainvillea petals,
//     砚池 water spray, and dynamic cannon-es campus physics balls!
//   - Exports compact GPU station arrays for our 384² world-space wake field (grass, lawn, trees, water)
import * as THREE from 'three';

const N = 96;
const LIFE = 5.2;
const CELL = 5, G = 48;          // 240 m lookup grid centered on the student
const REACH = 8.5;
const RC0 = 0.22;

export class VortexWake {
  constructor(heightAt) {
    this.heightAt = heightAt;
    const f = () => new Float32Array(N);
    this.ox = f(); this.oy = f(); this.oz = f();
    this.tx = f(); this.ty = f(); this.tz = f();
    this.lx = f(); this.lz = f();
    this.ux = f(); this.uy = f(); this.uz = f();
    this.yl = f(); this.zl = f(); this.yr = f(); this.zr = f();
    this.hl = f(); this.hr = f();
    this.k = f(); this.kb = f(); this.rc2 = f();
    this.age = f(); this.ax = f(); this.ax0 = f();
    this.asym = f(); this.s = f(); this.span = f();
    this.head = 0; this.count = 0; this.arc = 0; this.strength = 0; this.time = 0;
    this._emit = new THREE.Vector3();
    this.cell = new Int16Array(G * G);
    this.cellD = new Float32Array(G * G);
    this.gx0 = 0; this.gz0 = 0;
  }

  reset() { this.count = 0; }

  _ground(x, z) { return this.heightAt(x, z); }

  _touch(i) {
    const lx = this.lx[i], lz = this.lz[i], ux = this.ux[i], uy = this.uy[i], uz = this.uz[i];
    const ox = this.ox[i], oy = this.oy[i], oz = this.oz[i];
    const up = Math.max(uy, 0.35);
    const hmin = 0.24 + 0.35 * Math.sqrt(this.rc2[i]);

    let y = this.yl[i], z = this.zl[i];
    let h = oy + uy * z - this._ground(ox + lx * y + ux * z, oz + lz * y + uz * z);
    if (h < hmin) { this.zl[i] = z + (hmin - h) / up; h = hmin; }
    this.hl[i] = h;

    y = this.yr[i]; z = this.zr[i];
    h = oy + uy * z - this._ground(ox + lx * y + ux * z, oz + lz * y + uz * z);
    if (h < hmin) { this.zr[i] = z + (hmin - h) / up; h = hmin; }
    this.hr[i] = h;
  }

  _copy(a, b) {
    const keys = ['ox', 'oy', 'oz', 'tx', 'ty', 'tz', 'lx', 'lz', 'ux', 'uy', 'uz', 'yl', 'zl', 'yr', 'zr', 'hl', 'hr', 'k', 'kb', 'rc2', 'age', 'ax', 'ax0', 'asym', 's', 'span'];
    for (const key of keys) this[key][b] = this[key][a];
  }

  /**
   * Step the vortex ring.
   * s: { pos, vel, yaw, roll, turnRate, speed, mode, agl, boost }
   */
  update(dt, s, time) {
    if (!(dt > 0)) return;
    this.time = time;
    const p = s.pos, v = s.vel;
    const V = Math.hypot(v.x, v.y, v.z);
    const fx = V > 0.2 ? v.x / V : Math.sin(s.yaw);
    const fy = V > 0.2 ? v.y / V : 0;
    const fz = V > 0.2 ? v.z / V : Math.cos(s.yaw);
    const cp = Math.max(0.05, Math.hypot(fx, fz));
    // Left axis (horizontal, perpendicular to heading)
    const lx = fz / cp, lz = -fx / cp;

    // Mode-calibrated shedding span & circulation strength
    let baseK = 0, span = 0.8;
    if (s.mode === 'broom') {
      baseK = (2.8 + Math.pow(V / 10, 1.2) * 7.2) * (1 + 0.28 * (s.boost || 0));
      span = 1.05 + 0.025 * V;
    } else if (s.mode === 'glider') {
      baseK = (3.4 + Math.pow(V / 12, 1.15) * 6.5);
      span = 3.2; // wide wingtip vortices off the Terminalia leaf tips!
    } else if (s.mode === 'bike') {
      baseK = V > 1.2 ? V * 0.42 : 0;
      span = 0.72;
    } else if (s.mode === 'board') {
      baseK = V > 1.0 ? V * 0.38 : 0;
      span = 0.62;
    } else {
      baseK = V > 2.2 ? V * 0.16 : 0;
      span = 0.45;
    }

    const ex = p.x - fx * 0.45, ey = p.y + (s.mode === 'broom' || s.mode === 'glider' ? 0.0 : 0.45) - fy * 0.45, ez = p.z - fz * 0.45;
    const ds = s.mode === 'broom' || s.mode === 'glider' ? Math.min(1.6, Math.max(0.65, V * 0.045)) : 0.75;

    if (!this.count) {
      if (baseK > 0.08) {
        this.head = 0; this.count = 1;
        this._emit.set(ex, ey, ez);
      }
    } else {
      const e = this._emit;
      let dx = ex - e.x, dy = ey - e.y, dz = ez - e.z;
      let d = Math.hypot(dx, dy, dz);
      if (d > 45) { this.count = 1; e.set(ex, ey, ez); d = 0; }
      const hoverShed = s.mode === 'broom' && V < 1.2 && (this.age[this.head] > 0.14);
      while ((d >= ds && baseK > 0.08) || hoverShed) {
        const h = this.head;
        if (d >= ds) {
          const q = ds / d;
          e.x += dx * q; e.y += dy * q; e.z += dz * q;
          this.ox[h] = e.x; this.oy[h] = e.y; this.oz[h] = e.z;
          this.age[h] = (d - ds) / Math.max(V, 1);
          this.arc += ds;
        } else {
          this.ox[h] = ex; this.oy[h] = ey; this.oz[h] = ez;
          this.age[h] = 0;
          this.arc += 0.4;
        }
        this.s[h] = this.arc;
        this.kb[h] *= 0.88 + 0.24 * Math.random();
        this.asym[h] += (Math.random() - 0.5) * 0.14;
        this.head = (h + 1) % N;
        if (this.count < N) this.count++;
        this._copy(h, this.head);
        if (hoverShed) break;
        dx = ex - e.x; dy = ey - e.y; dz = ez - e.z;
        d = Math.hypot(dx, dy, dz);
      }
    }

    if (this.count > 0) {
      const h = this.head;
      this.ox[h] = ex; this.oy[h] = ey; this.oz[h] = ez;
      this.tx[h] = fx; this.ty[h] = fy; this.tz[h] = fz;
      this.lx[h] = lx; this.lz[h] = lz;
      this.ux[h] = -fx * fy / cp; this.uy[h] = cp; this.uz[h] = -fz * fy / cp;
      const roll = s.roll || 0;
      const hy = 0.5 * span * Math.cos(roll), hz = 0.5 * span * Math.sin(roll);
      this.yl[h] = -hy; this.zl[h] = -0.1 + hz;
      this.yr[h] = hy; this.zr[h] = -0.1 - hz;
      const gusty = 1 + 0.14 * Math.sin(time * 2.1) + 0.08 * Math.sin(time * 5.3 + 1.4);
      const k = baseK * gusty;
      this.kb[h] = k; this.k[h] = k * 0.4; this.strength = k;
      this.asym[h] = 0.11 * Math.sin(time * 1.3 + 0.8) - THREE.MathUtils.clamp((s.turnRate || 0) * 0.16, -0.22, 0.22);
      this.rc2[h] = RC0 * RC0;
      this.age[h] = 0;
      this.ax0[h] = this.ax[h] = V * 0.92;
      this.span[h] = span;
      this._touch(h);
    }

    // Evolve shed vortex stations (mutual downwash + ground mirror-image lateral separation + diffusion)
    const dFree = Math.exp(-dt / 2.6), dLow = Math.exp(-dt / 1.85);
    for (let r = 1; r < this.count; r++) {
      const i = (this.head - r + N) % N;
      const age = (this.age[i] += dt);
      const low = Math.min(this.hl[i], this.hr[i]) < 1.8;
      const kb = (this.kb[i] *= low ? dLow : dFree);
      const kf = kb * (age > LIFE - 1.2 ? Math.max(0, (LIFE - age) / 1.2) : 1);
      const rollUp = 0.4 + 0.6 * (1 - Math.exp(-age * 4.5));
      const k = (this.k[i] = kf * rollUp);
      const rc2 = (this.rc2[i] += (0.14 + 0.025 * kb) * dt);
      this.ax[i] = this.ax0[i] * Math.exp(-(age * age) / 0.52);

      let yl = this.yl[i], zl = this.zl[i], yr = this.yr[i], zr = this.zr[i];
      const dy = yr - yl, dz = zr - zl;
      const m = k / (dy * dy + dz * dz + rc2);
      // Mutual downward induction + gradual outboard spread
      const spread = 0.45 * Math.exp(-age * 1.4);
      let vly = m * dz - spread, vlz = -m * dy, vry = m * dz + spread, vrz = vlz;

      // Mirror images under the ground push the two cores outward along the grass/water!
      const dl = Math.max(0.25, this.hl[i]), dr = Math.max(0.25, this.hr[i]);
      if (dl < 4.5) vly -= 0.55 * k * 2 * dl / (4 * dl * dl + rc2);
      if (dr < 4.5) vry += 0.55 * k * 2 * dr / (4 * dr * dr + rc2);

      // Gentle sinuous Crow-instability wobble as trail ages
      const sc = this.s[i], wob = Math.min(age, 1) * (0.28 + 0.04 * kb);
      vly += wob * Math.sin(sc * 0.25 + time * 1.1);
      vry += wob * Math.sin(sc * 0.23 - time * 0.9 + 2.4);

      this.yl[i] = yl + vly * dt; this.zl[i] = zl + vlz * dt;
      this.yr[i] = yr + vry * dt; this.zr[i] = zr + vrz * dt;
      this._touch(i);
    }

    while (this.count > 1 && this.age[(this.head - this.count + 1 + N) % N] > LIFE) this.count--;
    this._buildGrid(p);
  }

  _buildGrid(p) {
    const gx0 = (this.gx0 = p.x - G * CELL * 0.5);
    const gz0 = (this.gz0 = p.z - G * CELL * 0.5);
    const cell = this.cell, cellD = this.cellD;
    cell.fill(-1); cellD.fill(1e9);
    const inv = 1 / CELL;
    for (let r = 0; r < this.count; r++) {
      const i = (this.head - r + N) % N;
      if (r > 0 && this.k[i] < 0.05) continue;
      const x = this.ox[i] - gx0, z = this.oz[i] - gz0;
      let cx0 = Math.floor((x - REACH) * inv), cx1 = Math.floor((x + REACH) * inv);
      let cz0 = Math.floor((z - REACH) * inv), cz1 = Math.floor((z + REACH) * inv);
      if (cx1 < 0 || cz1 < 0 || cx0 >= G || cz0 >= G) continue;
      cx0 = Math.max(0, cx0); cz0 = Math.max(0, cz0);
      cx1 = Math.min(G - 1, cx1); cz1 = Math.min(G - 1, cz1);
      for (let cz = cz0; cz <= cz1; cz++) {
        const ez = (cz + 0.5) * CELL - z;
        for (let cx = cx0; cx <= cx1; cx++) {
          const ex = (cx + 0.5) * CELL - x, d2 = ex * ex + ez * ez, j = cz * G + cx;
          if (d2 < cellD[j]) { cellD[j] = d2; cell[j] = r; }
        }
      }
    }
  }

  nearest(x, y, z) {
    const fx = (x - this.gx0) / CELL, fz = (z - this.gz0) / CELL;
    if (!(fx >= 0 && fz >= 0 && fx < G && fz < G)) return -1;
    let r = this.cell[(fz | 0) * G + (fx | 0)];
    if (r < 0) return -1;
    let i = (this.head - r + N) % N;
    let dx = x - this.ox[i], dy = y - this.oy[i], dz = z - this.oz[i];
    let d2 = dx * dx + dy * dy + dz * dz;
    for (let step = 0; step < 6; step++) {
      if (r > 0) {
        const j = (i + 1) % N;
        const e2 = (x - this.ox[j]) ** 2 + (y - this.oy[j]) ** 2 + (z - this.oz[j]) ** 2;
        if (e2 < d2) { r--; i = j; d2 = e2; continue; }
      }
      if (r < this.count - 1) {
        const j = (i - 1 + N) % N;
        const e2 = (x - this.ox[j]) ** 2 + (y - this.oy[j]) ** 2 + (z - this.oz[j]) ** 2;
        if (e2 < d2) { r++; i = j; d2 = e2; continue; }
      }
      break;
    }
    return d2 > REACH * REACH ? -1 : r;
  }

  /** Sample 3D air velocity (m/s) generated by the twin counter-rotating vortex cores + axial pocket. */
  sample(x, y, z, out) {
    out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 0;
    if (this.count < 1) return 0;
    const r = this.nearest(x, y, z);
    if (r < 0) return 0;
    const i = (this.head - r + N) % N;
    const dx = x - this.ox[i], dy = y - this.oy[i], dz = z - this.oz[i];
    const lx = this.lx[i], lz = this.lz[i], ux = this.ux[i], uy = this.uy[i], uz = this.uz[i];
    const py = dx * lx + dz * lz;
    const pz = dx * ux + dy * uy + dz * uz;
    const k = this.k[i], rc2 = this.rc2[i], as = this.asym[i];
    const kR = k * (1 + as), kL = k * (1 - as);

    // Right core (+kR, anticlockwise from behind -> lifts outside, downwash inside)
    const ey = py - this.yr[i], ez = pz - this.zr[i];
    const r2R = ey * ey + ez * ez;
    let m = kR / (r2R + rc2);
    let vy = -ez * m, vz = ey * m;

    // Left core (-kL)
    const fy = py - this.yl[i], fz = pz - this.zl[i];
    const r2L = fy * fy + fz * fz;
    m = -kL / (r2L + rc2);
    vy += -fz * m; vz += fy * m;

    // Ground mirror images (keep air skimming across ground instead of piercing it)
    const gzR = pz - (this.zr[i] - 2 * this.hr[i]);
    m = -kR / (ey * ey + gzR * gzR + rc2);
    vy += -gzR * m; vz += ey * m;
    const gzL = pz - (this.zl[i] - 2 * this.hl[i]);
    m = kL / (fy * fy + gzL * gzL + rc2);
    vy += -gzL * m; vz += fy * m;

    // Axial slipstream dragged forward behind the vehicle
    const minR2 = Math.min(r2R, r2L);
    const ga = 1 / (1 + minR2 * 0.22);
    const va = this.ax[i] * ga;

    out[0] = lx * vy + ux * vz + this.tx[i] * va;
    out[1] = uy * vz + this.ty[i] * va;
    out[2] = lz * vy + uz * vz + this.tz[i] * va;
    out[3] = ga;
    return Math.hypot(vy, vz) + va * 0.18;
  }

  /** Export latest 48 active stations into GPU uniform vectors for wake.js */
  fillGpu(P, V) {
    const max = P.length;
    let live = 0;
    for (let slot = 0; slot < max; slot++) {
      if (slot < this.count) {
        const i = (this.head - slot + N) % N;
        const k = this.k[i];
        const age = this.age[i];
        if (k > 0.04 && age < LIFE) {
          const avgH = Math.max(0.2, 0.5 * (this.hl[i] + this.hr[i]));
          const groundGain = 1 / (1 + (avgH / 3.2) ** 2);
          const halfSep = Math.max(0.45, 0.5 * Math.abs(this.yr[i] - this.yl[i]));
          P[slot].set(this.ox[i], this.oy[i], this.oz[i], age);
          V[slot].set(this.tx[i], this.tz[i], k * groundGain, halfSep + Math.sqrt(this.rc2[i]));
          live++;
          continue;
        }
      }
      P[slot].set(0, -1e4, 0, 99);
      V[slot].set(0, 0, 0, 1);
    }
    return live;
  }
}

export { N as VORTEX_STATIONS };
