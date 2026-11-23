// HAIZ · 自由共游 — the way a wheel would go. The campus's walking grid (lanren/life/nav.js) prices a lawn at
// under twice a road, which is right for feet and wrong for a bike or a board: a student on wheels stays on
// the paving and goes round. This searches the same grid (same solids, same surfaces, nothing rebuilt) with
// a wheel's costs: roads, courts and gates cheapest, the track and the covered walks a touch dearer,
// garden paths and lawns several times dearer, so a route leaves the paving only when there is no paved
// way within reason. Pure and deterministic, like the walking grid.

const WHEEL = { road: 1.0, court: 1.05, gate: 1.0, field: 1.25, corridor: 1.4, pavilion: 2.5, garden: 3.5, botanic: 4.0, open: 5.0, water: Infinity };
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

/** nav: the walking grid from buildNav(); returns path(ax, az, bx, bz) → { points, cost, length } | null */
export function createWheelPath(nav) {
  const { nx, nz, x0, z0, CELL, solid, surf, SURF } = nav;
  const N = nx * nz;
  const C = Float32Array.from(SURF.map((k) => WHEEL[k] ?? WHEEL.open));
  const cx = (i) => x0 + (i + 0.5) * CELL, cz = (j) => z0 + (j + 0.5) * CELL;
  const free = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz && !solid[j * nx + i];
  const cellOf = (x, z) => [Math.floor((x - x0) / CELL), Math.floor((z - z0) / CELL)];
  const g = new Float32Array(N), from = new Int32Array(N), stamp = new Uint32Array(N), closed = new Uint32Array(N);
  const heap = new Heap(1 << 14);
  let gen = 0;

  // start where a wheel would join the paving: the nearest free cell (the walking grid's snap)
  function path(ax, az, bx, bz) {
    const A = nav.snap(ax, az), B = nav.snap(bx, bz);
    if (!A || !B) return null;
    gen++;
    const s = A.j * nx + A.i, t = B.j * nx + B.i;
    const h = (k) => { const i = k % nx, j = (k / nx) | 0; const dx = Math.abs(i - B.i), dz = Math.abs(j - B.j); return (Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz)) * CELL; };
    heap.clear();
    g[s] = 0; from[s] = -1; stamp[s] = gen; heap.push(s, h(s));
    let found = false, expanded = 0;
    while (heap.size) {
      const k = heap.pop();
      if (closed[k] === gen) continue;
      closed[k] = gen;
      if (k === t) { found = true; break; }
      if (++expanded > 400000) break;
      const i = k % nx, j = (k / nx) | 0;
      for (const [di, dj, step] of DIRS) {
        const ii = i + di, jj = j + dj;
        if (!free(ii, jj)) continue;
        if (di && dj && (!free(i + di, j) || !free(i, j + dj))) continue;
        const kk = jj * nx + ii;
        if (closed[kk] === gen) continue;
        const ng = g[k] + step * CELL * (C[surf[k]] + C[surf[kk]]) * 0.5;
        if (stamp[kk] !== gen || ng < g[kk]) { stamp[kk] = gen; g[kk] = ng; from[kk] = k; heap.push(kk, ng + h(kk)); }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let k = t; k !== -1; k = from[k]) cells.push(k);
    cells.reverse();
    // string-pull, but only where the straight run costs no more than the cells it replaces
    const P = cells.map((k) => ({ x: cx(k % nx), z: cz((k / nx) | 0), k }));
    const pts = [nav.isFree(ax, az) ? { x: ax, z: az } : { x: P[0].x, z: P[0].z }];
    let a = 0;
    while (a < P.length - 1) {
      let best = a + 1, fails = 0;
      for (let c = a + 2; c < P.length; c++) {
        if (lineCost(P[a], P[c]) <= (g[P[c].k] - g[P[a].k]) * 1.015 + 1e-6) { best = c; fails = 0; } else if (++fails > 14) break;
      }
      if (best < P.length - 1) pts.push({ x: P[best].x, z: P[best].z });
      a = best;
    }
    pts.push(nav.isFree(bx, bz) ? { x: bx, z: bz } : { x: P[P.length - 1].x, z: P[P.length - 1].z });
    let length = 0;
    for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    return { points: pts, cost: g[t], length };
  }
  function lineCost(a, b) {
    const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(L / (CELL * 0.35)));
    const px = -(b.z - a.z) / L * 0.45, pz = (b.x - a.x) / L * 0.45;          // a handlebar's half-width
    let sum = 0;
    for (let s = 0; s < n; s++) {
      const t = (s + 0.5) / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      const [i, j] = cellOf(x, z);
      if (!free(i, j) || !nav.isFree(x + px, z + pz) || !nav.isFree(x - px, z - pz)) return Infinity;
      sum += C[surf[j * nx + i]];
    }
    return (sum / n) * L;
  }
  /** fraction of a polyline's length that lies off the paving (for tests and the HUD) */
  function offPaving(points) {
    let off = 0, all = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(L / 0.5));
      for (let s = 0; s < n; s++) {
        const k = nav.surfaceAt(a.x + (b.x - a.x) * (s + 0.5) / n, a.z + (b.z - a.z) * (s + 0.5) / n);
        all += L / n; if (k === 'open' || k === 'garden' || k === 'botanic') off += L / n;
      }
    }
    return all ? off / all : 0;
  }
  return { path, offPaving };
}

class Heap {
  constructor(n) { this.k = new Int32Array(n); this.f = new Float32Array(n); this.size = 0; }
  clear() { this.size = 0; }
  push(k, f) {
    if (this.size >= this.k.length) { const nk = new Int32Array(this.k.length * 2), nf = new Float32Array(this.k.length * 2); nk.set(this.k); nf.set(this.f); this.k = nk; this.f = nf; }
    let i = this.size++;
    while (i > 0) { const p = (i - 1) >> 1; if (this.f[p] <= f) break; this.k[i] = this.k[p]; this.f[i] = this.f[p]; i = p; }
    this.k[i] = k; this.f[i] = f;
  }
  pop() {
    const top = this.k[0], n = --this.size;
    if (n > 0) {
      const k = this.k[n], f = this.f[n];
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && this.f[c + 1] < this.f[c]) c++;
        if (this.f[c] >= f) break;
        this.k[i] = this.k[c]; this.f[i] = this.f[c]; i = c;
      }
      this.k[i] = k; this.f[i] = f;
    }
    return top;
  }
}
