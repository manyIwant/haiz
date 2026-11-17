// 入画 · the campus as a place to live in: what every creature can ask of it.
//
//   weather   the shared state (weather.js): rain, wind, warmth, night, the sun's direction
//   light     sun or shade at a point (rays through the buildings and the crowns), cached per spot
//   shelter   under a covered walk or a pavilion roof, or tight under an eave
//   flowers   nectar: the bougainvillea (三角梅) in the beds and the 龙船花 (Ixora) patches in the
//             gardens. Each flower knows when it was last visited (butterflies remember)
//   edges     the foot of every wall, as segments a cat can walk along
//   player    where the walker is and how fast they move
// Pure apart from what it is handed; species modules only read it.
import { shadeAt } from '../world.js';
import { move, freeSpot } from '../../world/collide.js';

export function createHabitat({ world, weather }) {
  const G = world.geo.frame.ground;
  const flowers = [];
  for (const b of world.beds) if (b.kind === 'bougainvillea') flowers.push({ x: b.x, y: G + 0.9 * b.h + 0.1, z: b.z, kind: 'bougainvillea', a: 0.7, last: -1e9 });
  const shelters = [];
  for (const b of world.model.buildings) {
    if (b.form === 'corr' || b.form === 'pavilion') shelters.push({ cx: b.cx, cz: b.cz, hw: b.w / 2 - 0.5, hd: b.d / 2 - 0.5, rot: b.rot, kind: b.form });
  }
  // the foot of each wall: four segments per building, 0.45 m out
  const edges = [];
  for (const b of world.model.buildings) {
    if (b.form === 'corr' || b.form === 'gate' || b.form === 'pavilion') continue;
    const c = Math.cos(b.rot), s = Math.sin(b.rot), hw = b.w / 2 + 0.45, hd = b.d / 2 + 0.45;
    const P = (lx, lz) => [b.cx + lx * c + lz * s, b.cz - lx * s + lz * c];
    const k = [P(-hw, -hd), P(hw, -hd), P(hw, hd), P(-hw, hd)];
    for (let i = 0; i < 4; i++) edges.push({ a: k[i], b: k[(i + 1) % 4], id: b.id, side: i, height: b.height });
  }
  const shadeCache = new Map();
  const sunKey = () => { const d = weather.state.pal?.dir || [0, 1, 0]; return d.map((v) => v.toFixed(2)).join(); };
  const H = {
    world, weather, flowers, shelters, edges, G,
    player: { pos: { x: 1e5, y: 0, z: 1e5 }, speed: 0, vel: { x: 0, z: 0 } },
    get W() { return weather.state; },
    /** 0 in sun … 1 deep shade (0.85 under a crown); cached per 1 m cell and sun position */
    shade(x, z) {
      const key = sunKey() + '|' + Math.round(x) + ',' + Math.round(z);
      let v = shadeCache.get(key);
      if (v === undefined) {
        const d = weather.state.pal.dir;
        v = shadeAt(world, { x, y: G, z }, { x: d[0], y: Math.max(0.17, d[1]), z: d[2] });
        if (shadeCache.size > 4000) shadeCache.clear();
        shadeCache.set(key, v);
      }
      return v;
    },
    /** how much direct sun reaches the ground at a point now (0..1) */
    sun(x, z) { return (weather.state.pal.direct || 0) * (1 - H.shade(x, z)); },
    /** 0 open sky … 1 under a roof */
    shelter(x, z) {
      for (const s of shelters) {
        const dx = x - s.cx, dz = z - s.cz, c = Math.cos(s.rot), sn = Math.sin(s.rot);
        if (Math.abs(dx * c - dz * sn) < s.hw && Math.abs(dx * sn + dz * c) < s.hd) return 1;
      }
      return 0;
    },
    /** nearest point on a wall's foot, within r */
    nearestEdge(x, z, r = 12) {
      let best = null, bd = r;
      for (const e of edges) {
        const ex = e.b[0] - e.a[0], ez = e.b[1] - e.a[1], L2 = ex * ex + ez * ez;
        const t = Math.max(0, Math.min(1, ((x - e.a[0]) * ex + (z - e.a[1]) * ez) / L2));
        const px = e.a[0] + ex * t, pz = e.a[1] + ez * t, d = Math.hypot(x - px, z - pz);
        if (d < bd) { bd = d; best = { x: px, z: pz, e, t, d, dir: [ex / Math.sqrt(L2), ez / Math.sqrt(L2)] }; }
      }
      return best;
    },
    move: (x, z, dx, dz, r = 0.18) => move(world.colliders, x, z, dx, dz, r),
    free: (x, z, r = 0.25) => freeSpot(world.colliders, x, z, r),
    heightAt: (x, z) => world.heightAt(x, z),
    flowersNear(x, z, r) { return flowers.filter((f) => Math.abs(f.x - x) < r && Math.abs(f.z - z) < r); },
  };
  return H;
}

/** the registry: species are added and updated together; each lives on its own */
export function createEcosystem({ habitat }) {
  const species = [];
  return {
    habitat, species,
    add(s) { species.push(s); return s; },
    update(dt, ctx) { for (const s of species) s.update(dt, ctx); },
    get(name) { return species.find((s) => s.name === name); },
  };
}
