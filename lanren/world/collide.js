// What the walker cannot walk through (pure; Node-testable).
//
// The campus model's buildings are closed volumes standing on their footprints (campus3d.js),
// so their footprints, a little enlarged, are walls: a capsule of radius r against oriented
// rectangles. Covered walkways (corr) and gates are walked under and through. Ponds are not
// walked on. The tree's trunk, the scholar's rock on its plinth and the campus trees' trunks
// are circles or boxes. Nothing here claims the real campus's doors or interiors: buildings
// cannot be entered (their interiors are inferred, DESIGN.md).
const WALK_THROUGH = new Set(['corr', 'gate']);

/**
 * buildings: campus3d buildings {id, form, cx, cz, w, d, rot}
 * extra:     { rects: [{cx, cz, hw, hd, rot, id}], circles: [{x, z, r, id}] } (water, trunk, rock, trees)
 * bounds:    {x0, x1, z0, z1} the campus sheet
 */
export function buildColliders(buildings, extra = {}, bounds = null, pad = 0.25) {
  const rects = [];
  for (const b of buildings) {
    if (WALK_THROUGH.has(b.form)) continue;
    rects.push({ id: b.id, cx: b.cx, cz: b.cz, hw: b.w / 2 + pad, hd: b.d / 2 + pad, rot: b.rot });
  }
  for (const r of extra.rects || []) rects.push({ ...r });
  for (const r of rects) { r.c = Math.cos(r.rot || 0); r.s = Math.sin(r.rot || 0); r.reach = Math.hypot(r.hw, r.hd); }
  const circles = (extra.circles || []).map((c) => ({ ...c }));
  // a coarse grid so a step only tests what is near
  const CELL = 24, grid = new Map();
  const key = (i, j) => i * 100003 + j;
  const add = (o, x, z, reach) => {
    for (let i = Math.floor((x - reach) / CELL); i <= Math.floor((x + reach) / CELL); i++)
      for (let j = Math.floor((z - reach) / CELL); j <= Math.floor((z + reach) / CELL); j++) {
        const k = key(i, j);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(o);
      }
  };
  for (const r of rects) add(r, r.cx, r.cz, r.reach);
  for (const c of circles) add(c, c.x, c.z, c.r);
  const near = (x, z) => grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) || [];
  return { rects, circles, near, bounds };
}

/** signed distance from (x, z) to a rect (negative inside) and the outward normal */
function rectSD(r, x, z) {
  const dx = x - r.cx, dz = z - r.cz;
  // world → rect frame (inverse of three.js rotation.y)
  const lx = dx * r.c - dz * r.s, lz = dx * r.s + dz * r.c;
  const qx = Math.abs(lx) - r.hw, qz = Math.abs(lz) - r.hd;
  let nx, nz, d;
  if (qx > 0 || qz > 0) {
    const ox = Math.max(qx, 0), oz = Math.max(qz, 0);
    d = Math.hypot(ox, oz);
    nx = (ox * Math.sign(lx)) / (d || 1); nz = (oz * Math.sign(lz)) / (d || 1);
  } else if (qx > qz) { d = qx; nx = Math.sign(lx) || 1; nz = 0; } else { d = qz; nx = 0; nz = Math.sign(lz) || 1; }
  // back to world
  return { d, nx: nx * r.c + nz * r.s, nz: -nx * r.s + nz * r.c };
}

/** the nearest solid to (x, z): {d, nx, nz, id} (d: clearance from the solid's surface) */
export function nearest(col, x, z) {
  let best = { d: Infinity, nx: 0, nz: 0, id: null };
  for (const o of col.near(x, z)) {
    let h;
    if (o.hw !== undefined) h = rectSD(o, x, z);
    else { const dx = x - o.x, dz = z - o.z, L = Math.hypot(dx, dz) || 1e-9; h = { d: L - o.r, nx: dx / L, nz: dz / L }; }
    if (h.d < best.d) best = { ...h, id: o.id };
  }
  return best;
}

/**
 * Move a circle of radius r from (x0, z0) by (dx, dz): it slides along walls instead of
 * stopping dead, never ends inside a solid and stays on the sheet. Returns {x, z, hit}.
 */
export function move(col, x0, z0, dx, dz, r = 0.32) {
  const len = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(len / (r * 0.5)));
  let x = x0, z = z0, hit = null;
  for (let s = 0; s < steps; s++) {
    x += dx / steps; z += dz / steps;
    for (let k = 0; k < 4; k++) {
      const n = nearest(col, x, z);
      if (n.d >= r) break;
      const push = r - n.d + 1e-4;
      x += n.nx * push; z += n.nz * push;
      hit = n.id;
    }
  }
  if (col.bounds) {
    const b = col.bounds, m = 2;
    x = Math.min(b.x1 - m, Math.max(b.x0 + m, x)); z = Math.min(b.z1 - m, Math.max(b.z0 + m, z));
  }
  return { x, z, hit };
}

/** a free spot at or near (x, z): spirals out until clear (a restored position that is no longer valid) */
export function freeSpot(col, x, z, r = 0.32) {
  if (nearest(col, x, z).d >= r) return { x, z, moved: 0 };
  for (let rad = 0.5; rad < 80; rad += 0.5) {
    for (let a = 0; a < 24; a++) {
      const t = (a / 24) * Math.PI * 2, px = x + Math.cos(t) * rad, pz = z + Math.sin(t) * rad;
      if (nearest(col, px, pz).d >= r + 0.05) return { x: px, z: pz, moved: rad };
    }
  }
  return { x, z, moved: -1 };
}
