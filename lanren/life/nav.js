// HAIZ · 校园的路 — where a person on this campus can walk, and the way they would take (pure; Node-testable).
//
// One grid (1 m cells) over the campus, built from the same solids the player collides with
// (lanren/world/collide.js: the Blender V3 hulls, the ponds, the plinth, tree trunks and flower beds),
// grown by a body's radius. Every walkable cell has a cost from what it is on the campus plan: the
// surveyed paths and courts are cheapest, garden paths a little dearer, the paving and lawns in between
// dearer still — so a route follows the 校道 the way people do, and cuts a corner only where the
// corner is worth cutting. Under rain, the covered walkways (连廊) and pavilions become cheaper: the
// same two places are joined by a drier way.
//
// Paths: A* (8-connected, octile) on the grid, then string-pulled — a straight run replaces a stretch of
// cells only if it stays walkable and costs no more than the cells it replaces, so the smoothing never
// sends anyone across a lawn the search had avoided. Everything here is deterministic: the same campus
// and the same request give the same path on every device, which is what lets every visitor see the
// same student on the same path at the same minute.

export const CELL = 1;
export const RADIUS = 0.36;                 // body radius + a little: clearance from walls and trunks
const COST = { road: 1.0, court: 1.05, field: 1.1, corridor: 1.0, pavilion: 1.1, gate: 1.0, garden: 1.35, botanic: 1.4, open: 1.9, water: Infinity };
const DRY = { corridor: 1.0, pavilion: 1.1 }, WET = { corridor: 0.55, pavilion: 0.6 };

/**
 * colliders: lanren/world/collide.js buildColliders() result (rects + circles)
 * features:  lanren/map/geo.js features (world frame), for surface costs
 * bounds:    { x0, x1, z0, z1 } the region to cover (world metres)
 * opts.skip: collider ids that are not permanent (the easel) and must not shape the shared paths
 */
export function buildNav({ colliders, features, bounds, skip = ['easel'], walkable = null }) {
  const x0 = Math.floor(bounds.x0), z0 = Math.floor(bounds.z0);
  const nx = Math.ceil((bounds.x1 - x0) / CELL), nz = Math.ceil((bounds.z1 - z0) / CELL);
  const N = nx * nz;
  const solid = new Uint8Array(N);
  const surf = new Uint8Array(N);                 // index into SURF
  const SURF = ['open', 'road', 'court', 'field', 'corridor', 'pavilion', 'gate', 'garden', 'botanic', 'water'];
  const SI = Object.fromEntries(SURF.map((k, i) => [k, i]));
  const cx = (i) => x0 + (i + 0.5) * CELL, cz = (j) => z0 + (j + 0.5) * CELL;

  // ---- surfaces: paint features in layer order (later wins), as the map draws them
  const order = ['garden', 'botanic', 'field', 'court', 'road', 'corridor', 'pavilion', 'gate', 'water'];
  for (const kind of order) {
    for (const f of features) {
      if (f.kind !== kind) continue;
      rasterRect(f.cx, f.cz, f.hw, f.hd, f.rot, 0, (i, j) => { surf[j * nx + i] = SI[kind]; });
    }
  }
  // ---- solids, grown by the body's radius
  const isSkipped = (o) => skip.includes(o.id);
  for (const r of colliders.rects) {
    if (isSkipped(r)) continue;
    rasterRect(r.cx, r.cz, r.hw, r.hd, r.rot || 0, RADIUS, (i, j) => { solid[j * nx + i] = 1; });
  }
  for (const c of colliders.circles) {
    if (isSkipped(c)) continue;
    const R = c.r + RADIUS;
    for (let j = Math.floor((c.z - R - z0) / CELL); j <= Math.floor((c.z + R - z0) / CELL); j++) {
      for (let i = Math.floor((c.x - R - x0) / CELL); i <= Math.floor((c.x + R - x0) / CELL); i++) {
        if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
        if (Math.hypot(cx(i) - c.x, cz(j) - c.z) < R) solid[j * nx + i] = 1;
      }
    }
  }
  if (walkable) for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (!walkable(cx(i), cz(j))) solid[j * nx + i] = 1;
  for (let k = 0; k < N; k++) if (surf[k] === SI.water) solid[k] = 1;

  function rasterRect(rcx, rcz, hw, hd, rot, grow, put) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const ex = Math.abs(hw * c) + Math.abs(hd * s) + grow, ez = Math.abs(hw * s) + Math.abs(hd * c) + grow;
    const i0 = Math.max(0, Math.floor((rcx - ex - x0) / CELL)), i1 = Math.min(nx - 1, Math.floor((rcx + ex - x0) / CELL));
    const j0 = Math.max(0, Math.floor((rcz - ez - z0) / CELL)), j1 = Math.min(nz - 1, Math.floor((rcz + ez - z0) / CELL));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const dx = cx(i) - rcx, dz = cz(j) - rcz;
        const lx = dx * c - dz * s, lz = dx * s + dz * c;          // world → rect frame (three.js rotation.y)
        const qx = Math.abs(lx) - hw, qz = Math.abs(lz) - hd;
        const d = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
        if (d < grow) put(i, j);
      }
    }
  }

  const costs = (wet) => {
    const t = { ...COST, ...(wet ? WET : DRY) };
    return Float32Array.from(SURF.map((k) => t[k]));
  };
  const table = { dry: costs(false), wet: costs(true) };

  const cellOf = (x, z) => [Math.floor((x - x0) / CELL), Math.floor((z - z0) / CELL)];
  const inside = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz;
  const free = (i, j) => inside(i, j) && !solid[j * nx + i];
  const isFree = (x, z) => { const [i, j] = cellOf(x, z); return free(i, j); };

  /** the walkable cell nearest (x, z) (a door point against a wall, a spot under a tree) */
  function snap(x, z, maxR = 12) {
    const [i, j] = cellOf(x, z);
    if (free(i, j)) return { x: cx(i), z: cz(j), i, j };
    for (let r = 1; r <= maxR / CELL; r++) {
      let best = null, bd = Infinity;
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r || !free(i + di, j + dj)) continue;
        const d = Math.hypot(cx(i + di) - x, cz(j + dj) - z);
        if (d < bd) { bd = d; best = { x: cx(i + di), z: cz(j + dj), i: i + di, j: j + dj }; }
      }
      if (best) return best;
    }
    return null;
  }

  // ---- A*
  const g = new Float32Array(N), from = new Int32Array(N), stamp = new Uint32Array(N), closed = new Uint32Array(N);
  let gen = 0;
  const heap = new Heap(N);
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  /** a path from a to b as world points (null if there is none); opts.wet: the rain's costs */
  function path(ax, az, bx, bz, opts = {}) {
    const A = snap(ax, az), B = snap(bx, bz);
    if (!A || !B) return null;
    const C = opts.wet ? table.wet : table.dry;
    gen++;
    const s = A.j * nx + A.i, t = B.j * nx + B.i;
    const h = (k) => { const i = k % nx, j = (k / nx) | 0; const dx = Math.abs(i - B.i), dz = Math.abs(j - B.j); return (Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz)) * CELL; };
    heap.clear();
    g[s] = 0; from[s] = -1; stamp[s] = gen;
    heap.push(s, h(s));
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
        if (di && dj && (!free(i + di, j) || !free(i, j + dj))) continue;    // no squeezing past a corner
        const kk = jj * nx + ii;
        if (closed[kk] === gen) continue;
        const ng = g[k] + step * CELL * (C[surf[k]] + C[surf[kk]]) * 0.5;
        if (stamp[kk] !== gen || ng < g[kk]) {
          stamp[kk] = gen; g[kk] = ng; from[kk] = k;
          heap.push(kk, ng + h(kk));
        }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let k = t; k !== -1; k = from[k]) cells.push(k);
    cells.reverse();
    // string-pulling that respects the costs
    const P = cells.map((k) => ({ x: cx(k % nx), z: cz((k / nx) | 0), k }));
    const start = isFree(ax, az) ? { x: ax, z: az } : { x: P[0].x, z: P[0].z };
    const end = isFree(bx, bz) ? { x: bx, z: bz } : { x: P[P.length - 1].x, z: P[P.length - 1].z };
    const pts = [start];
    let a = 0;
    while (a < P.length - 1) {
      let best = a + 1, fails = 0;
      for (let c = a + 2; c < P.length; c++) {
        if (lineCost(P[a], P[c], C) <= (g[P[c].k] - g[P[a].k]) * 1.015 + 1e-6) { best = c; fails = 0; } else if (++fails > 14) break;
      }
      if (best < P.length - 1) pts.push({ x: P[best].x, z: P[best].z });
      a = best;
    }
    pts.push(end);
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) if (Math.hypot(pts[i].x - out[out.length - 1].x, pts[i].z - out[out.length - 1].z) > 0.4 || i === pts.length - 1) out.push(pts[i]);
    return { points: out, cost: g[t], length: polylineLength(out) };
  }
  /** cost of walking straight from cell centre a to b (Infinity if blocked) */
  function lineCost(a, b, C) {
    const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(L / (CELL * 0.35)));
    let sum = 0;
    for (let s = 0; s < n; s++) {
      const t = (s + 0.5) / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      const [i, j] = cellOf(x, z);
      if (!free(i, j)) return Infinity;
      // the body's width: the cells either side of the line must be free too
      const px = -(b.z - a.z) / L * RADIUS * 0.5, pz = (b.x - a.x) / L * RADIUS * 0.5;
      if (!isFree(x + px, z + pz) || !isFree(x - px, z - pz)) return Infinity;
      sum += C[surf[j * nx + i]];
    }
    return (sum / n) * L;
  }
  /** what is under (x, z) on the plan */
  const surfaceAt = (x, z) => { const [i, j] = cellOf(x, z); return inside(i, j) ? SURF[surf[j * nx + i]] : 'outside'; };

  return { nx, nz, x0, z0, CELL, solid, surf, SURF, path, snap, isFree, surfaceAt, cellOf };
}

export function polylineLength(p) {
  let L = 0;
  for (let i = 1; i < p.length; i++) L += Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z);
  return L;
}

/** the point at distance s along a polyline, and the heading there (three.js yaw) */
export function pointAt(p, s, out = {}) {
  if (p.length === 1) { out.x = p[0].x; out.z = p[0].z; out.yaw = 0; out.i = 0; return out; }
  let acc = 0;
  for (let i = 1; i < p.length; i++) {
    const L = Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z);
    if (acc + L >= s || i === p.length - 1) {
      const t = L > 1e-6 ? Math.min(1, Math.max(0, (s - acc) / L)) : 1;
      out.x = p[i - 1].x + (p[i].x - p[i - 1].x) * t; out.z = p[i - 1].z + (p[i].z - p[i - 1].z) * t;
      out.yaw = Math.atan2(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z); out.i = i;
      return out;
    }
    acc += L;
  }
  return out;
}

// a binary heap of cell indices keyed by f
class Heap {
  constructor(n) { this.k = new Int32Array(Math.min(n, 1 << 20)); this.f = new Float32Array(this.k.length); this.size = 0; }
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
