// The campus as built form: the same rectangles the site plan is drawn from,
// raised into whole buildings.
//
// Chapter 04's site plan and this model are one set of data: every footprint the
// plan draws is the foot of one of these volumes, and unfolding, each building
// rises out of its own footprint (section.js, unfold.js). The model is built like
// a building, not as solid blocks: walls with real thickness and real openings,
// floor slabs, columns, stairs, roofs. Every piece is a closed solid, so one
// building can also be cut at any storey on request (the architect's 1.2 m floor
// plan, after Casa Serra and flat-to-3d 03, MIT; HAIZ's own code), its cut filled
// with ink (the poché) by drawing the solids' back faces. The campus as a whole is
// never shown cut: a campus is read as a site plan.
//
// What is data and what is inference (stated in the UI as well):
//   data       footprint rectangle, rotation, model height, storeys
//              (assets/walk/campus.json, through geo.js: the very features the
//              plan shader draws), and the facade facts the first-person walk
//              already established from photographs (assets/walk/world.js and
//              atelier.js: the -Z gallery and +Z porch of the teaching blocks,
//              the library's dome and grand stair, the gate's four columns ...)
//   inferred   wall thickness, window rhythm, the interior: corridors, room
//              partitions, stair cores. Nothing here is a survey.
//
// Pure (no three.js): emits packed typed arrays, so Node can test it.

import { rectCampus } from './geo.js';

// ---------------------------------------------------------------- materials
// id → { albedo (as the walk paints it), roughness, metalness, ink (card tone on the plan) }
export const MATERIALS = [
  /* 0 */ { key: 'floor', albedo: '#d9d2c3', rough: 0.82, metal: 0, ink: 'floor' },        // interior floors, terrazzo
  /* 1 */ { key: 'wallLight', albedo: '#dcd7cb', rough: 0.93, metal: 0, ink: 'wall' },     // light grey-white walls
  /* 2 */ { key: 'baseStone', albedo: '#4a4a48', rough: 0.9, metal: 0, ink: 'wall' },      // dark stone ground storey
  /* 3 */ { key: 'plaster', albedo: '#ddd6c8', rough: 0.95, metal: 0, ink: 'wall' },       // inside walls (inferred)
  /* 4 */ { key: 'concrete', albedo: '#aca69d', rough: 0.95, metal: 0, ink: 'wall' },      // slabs, canopies
  /* 5 */ { key: 'column', albedo: '#bdb8ad', rough: 0.92, metal: 0, ink: 'wall' },
  /* 6 */ { key: 'glass', albedo: '#45646b', rough: 0.07, metal: 0.55, ink: 'glass' },
  /* 7 */ { key: 'roofRed', albedo: '#9d4a3a', rough: 0.88, metal: 0, ink: 'roof' },
  /* 8 */ { key: 'roofHerit', albedo: '#3f6051', rough: 0.6, metal: 0.05, ink: 'roof' },  // green glazed tile
  /* 9 */ { key: 'roofFlat', albedo: '#87827a', rough: 0.95, metal: 0, ink: 'roof' },
  /* 10 */ { key: 'parapet', albedo: '#c9c3b6', rough: 0.92, metal: 0, ink: 'wall' },
  /* 11 */ { key: 'step', albedo: '#b6b0a5', rough: 0.95, metal: 0, ink: 'floor' },
  /* 12 */ { key: 'plinth', albedo: '#948f84', rough: 0.96, metal: 0, ink: 'wall' },
  /* 13 */ { key: 'metal', albedo: '#8c9496', rough: 0.45, metal: 0.75, ink: 'roof' },     // the library's zinc, plant
  /* 14 */ { key: 'whiteGate', albedo: '#f2ece3', rough: 0.55, metal: 0.02, ink: 'wall' },
  /* 15 */ { key: 'gold', albedo: '#c9a35a', rough: 0.45, metal: 0.35, ink: 'wall' },
  /* 16 */ { key: 'wallWarm', albedo: '#c8bfa8', rough: 0.93, metal: 0, ink: 'wall' },     // canteens, dorms, arts
  /* 17 */ { key: 'door', albedo: '#6b5541', rough: 0.84, metal: 0, ink: 'wall' },
  /* 18 */ { key: 'beam', albedo: '#8a5a45', rough: 0.88, metal: 0, ink: 'wall' },
  /* 19 */ { key: 'frame', albedo: '#54685a', rough: 0.62, metal: 0.15, ink: 'wall' }
];
const M = Object.fromEntries(MATERIALS.map((m, i) => [m.key, i]));

// ---------------------------------------------------------------- constants
export const CUT_HEIGHT = 1.2;    // the plan's cut, above each building's ground floor
const SLAB = 0.22, WALL = 0.3, PART = 0.16, GLASS = 0.06;

// ---------------------------------------------------------------- the packer
// Each vertex: position (f32×3), normal (i8×3), edge (u8×4: quad uv or triangle
// barycentrics, for the drawing's lines), info (u8×2: material, building).
class Packer {
  constructor() {
    this.cap = 1 << 16;
    this.pos = new Float32Array(this.cap * 3); this.nrm = new Int8Array(this.cap * 3);
    this.edge = new Uint8Array(this.cap * 4); this.info = new Uint8Array(this.cap * 2);
    this.idx = []; this.n = 0;
    this.c = 1; this.s = 0; this.tx = 0; this.tz = 0; this.ty = 0; this.mat = 0; this.b = 0; this.top = 0;
  }
  grow(k) {
    if (this.n + k <= this.cap) return;
    while (this.n + k > this.cap) this.cap *= 2;
    const re = (A, w) => { const B = new A.constructor(this.cap * w); B.set(A); return B; };
    this.pos = re(this.pos, 3); this.nrm = re(this.nrm, 3); this.edge = re(this.edge, 4); this.info = re(this.info, 2);
  }
  frame(cx, cz, rot, y0, building) { this.c = Math.cos(rot); this.s = Math.sin(rot); this.tx = cx; this.tz = cz; this.ty = y0; this.b = building; this.top = 0; }
  vert(x, y, z, nx, ny, nz, e) {
    const i = this.n++;
    // local → world: three.js rotation.y about the building's centre (as the walk places it)
    this.pos[i * 3] = this.tx + x * this.c + z * this.s;
    this.pos[i * 3 + 1] = this.ty + y;
    this.pos[i * 3 + 2] = this.tz - x * this.s + z * this.c;
    this.nrm[i * 3] = Math.round((nx * this.c + nz * this.s) * 127);
    this.nrm[i * 3 + 1] = Math.round(ny * 127);
    this.nrm[i * 3 + 2] = Math.round((-nx * this.s + nz * this.c) * 127);
    this.edge.set(e, i * 4);
    this.info[i * 2] = this.mat; this.info[i * 2 + 1] = this.b;
    if (y > this.top) this.top = y;
    return i;
  }
  /** a planar quad a→b→c→d, counter-clockwise seen from outside; lines on its border unless soft */
  quad(a, b, c, d, soft = false) {
    this.grow(4);
    const n = normal(a, b, c);
    const E = soft ? [[128, 128, 0, 0], [128, 128, 0, 0], [128, 128, 0, 0], [128, 128, 0, 0]] : [[0, 0, 0, 0], [255, 0, 0, 0], [255, 255, 0, 0], [0, 255, 0, 0]];
    const i = this.vert(...a, ...n, E[0]); this.vert(...b, ...n, E[1]); this.vert(...c, ...n, E[2]); this.vert(...d, ...n, E[3]);
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }
  tri(a, b, c, soft = false) {
    this.grow(3);
    const n = normal(a, b, c);
    const E = soft ? [[128, 128, 0, 0], [128, 128, 0, 0], [128, 128, 0, 0]] : [[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255]];
    const i = this.vert(...a, ...n, E[0]); this.vert(...b, ...n, E[1]); this.vert(...c, ...n, E[2]);
    this.idx.push(i, i + 1, i + 2);
  }
  /** axis-aligned box in the building's frame */
  box(x0, x1, y0, y1, z0, z1, mat = this.mat) {
    if (x1 - x0 < 1e-3 || y1 - y0 < 1e-3 || z1 - z0 < 1e-3) return;
    const keep = this.mat; this.mat = mat;
    const p = (x, y, z) => [x, y, z];
    this.quad(p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1));   // +z
    this.quad(p(x1, y0, z0), p(x0, y0, z0), p(x0, y1, z0), p(x1, y1, z0));   // -z
    this.quad(p(x1, y0, z1), p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1));   // +x
    this.quad(p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1), p(x0, y1, z0));   // -x
    this.quad(p(x0, y1, z1), p(x1, y1, z1), p(x1, y1, z0), p(x0, y1, z0));   // +y
    this.quad(p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1));   // -y
    this.mat = keep;
  }
  /** centred box helper: centre x/z, bottom y */
  cbox(cx, cz, w, d, y0, h, mat) { this.box(cx - w / 2, cx + w / 2, y0, y0 + h, cz - d / 2, cz + d / 2, mat); }
  /** a closed solid of revolution about (cx, cz): profile [[r, y], ...] bottom to top */
  lathe(cx, cz, prof, seg, mat = this.mat) {
    const keep = this.mat; this.mat = mat;
    const P = (r, y, k) => { const a = (k / seg) * Math.PI * 2; return [cx + Math.cos(a) * r, y, cz - Math.sin(a) * r]; };
    for (let j = 0; j < prof.length - 1; j++) {
      const [r0, y0] = prof[j], [r1, y1] = prof[j + 1];
      for (let k = 0; k < seg; k++) {
        const a = P(r0, y0, k), b = P(r0, y0, k + 1), c = P(r1, y1, k + 1), d = P(r1, y1, k);
        if (r1 < 1e-4) this.tri(a, b, c, true);
        else if (r0 < 1e-4) this.tri(a, c, d, true);
        else this.quad(a, b, c, d, true);
      }
    }
    const [rb, yb] = prof[0], [rt, yt] = prof[prof.length - 1];
    for (let k = 0; k < seg; k++) {
      if (rb > 1e-4) this.tri([cx, yb, cz], P(rb, yb, k + 1), P(rb, yb, k), true);
      if (rt > 1e-4) this.tri([cx, yt, cz], P(rt, yt, k), P(rt, yt, k + 1), true);
    }
    this.mat = keep;
  }
  cylinder(cx, cz, y0, y1, r0, r1, seg, mat) { this.lathe(cx, cz, [[r0, y0], [r1, y1]], seg, mat); }
  /**
   * A hipped roof as one closed solid over [x0, x1] × [z0, z1] from y0, rising h;
   * the ridge runs along the longer side (a pyramid when square).
   */
  hip(x0, x1, z0, z1, y0, h, mat = this.mat) {
    const keep = this.mat; this.mat = mat;
    const w = x1 - x0, d = z1 - z0, y1 = y0 + h;
    const A = [x0, y0, z0], B = [x1, y0, z0], C = [x1, y0, z1], D = [x0, y0, z1];
    if (w >= d) {
      const r0 = [x0 + d / 2, y1, (z0 + z1) / 2], r1 = [x1 - d / 2, y1, (z0 + z1) / 2];
      this.quad(D, C, r1, r0); this.quad(B, A, r0, r1);   // the long slopes
      this.tri(C, B, r1); this.tri(A, D, r0);              // the hips
    } else {
      const r0 = [(x0 + x1) / 2, y1, z0 + w / 2], r1 = [(x0 + x1) / 2, y1, z1 - w / 2];
      this.quad(C, B, r0, r1); this.quad(A, D, r1, r0);
      this.tri(D, C, r1); this.tri(B, A, r0);
    }
    this.quad(A, B, C, D);   // underside
    this.mat = keep;
  }
}
function normal(a, b, c) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

// ---------------------------------------------------------------- walls with openings
/** centres of n openings of width ow spread evenly over [a, b] with piers of at least pier */
export function rhythm(a, b, ow, pier) {
  const len = b - a, n = Math.floor((len - pier) / (ow + pier));
  if (n < 1) return [];
  const pitch = len / n;
  return Array.from({ length: n }, (_, i) => a + pitch * (i + 0.5));
}
/**
 * A wall along X (axis 'x') at z = c, or along Z (axis 'z') at x = c, thickness t,
 * from s0 to s1, base y0, height h. Openings: { at, w, sill, head, glass }.
 */
function wall(P, axis, c, t, s0, s1, y0, h, openings = [], mat = M.wallLight) {
  const seg = (a, b, ya, yb, m, th = t) => {
    if (b - a < 0.02 || yb - ya < 0.02) return;
    if (axis === 'x') P.box(a, b, y0 + ya, y0 + yb, c - th / 2, c + th / 2, m);
    else P.box(c - th / 2, c + th / 2, y0 + ya, y0 + yb, a, b, m);
  };
  let cur = s0;
  const ops = openings.filter((o) => o.at - o.w / 2 > s0 + 0.05 && o.at + o.w / 2 < s1 - 0.05).sort((a, b) => a.at - b.at);
  for (const o of ops) {
    const a = o.at - o.w / 2, b = o.at + o.w / 2;
    if (a < cur + 0.05) continue;   // overlapping opening: skip
    seg(cur, a, 0, h, mat);
    const head = Math.min(o.head, h);
    seg(a, b, 0, o.sill, mat);
    seg(a, b, head, h, mat);
    if (o.glass) seg(a, b, o.sill, head, M.glass, GLASS);
    else if (o.leaf) seg(a, b, 0, head, M.door, 0.06);
    cur = b;
  }
  seg(cur, s1, 0, h, mat);
}
const win = (at, w, sill, head) => ({ at, w, sill, head, glass: true });
const door = (at, w = 1.0, head = 2.2) => ({ at, w, sill: 0, head, glass: false });

// ---------------------------------------------------------------- the inferred interior
/**
 * Rooms along a building whose long side runs along X: an inner corridor when it is
 * deep enough, partitions at a regular bay, doors from the corridor, one stair core.
 * Returns the bays so facades can align their windows with the rooms.
 */
function interior(P, o) {
  const { w, d, y0, h, bay, stairAt = null, lobbyAt = null, rows = 'auto', corridor = 2.4 } = o;
  const xi0 = -w / 2 + WALL, xi1 = w / 2 - WALL, zi0 = -d / 2 + WALL, zi1 = d / 2 - WALL;
  const n = Math.max(1, Math.round((xi1 - xi0) / bay)), step = (xi1 - xi0) / n;
  const bays = Array.from({ length: n }, (_, i) => [xi0 + i * step, xi0 + (i + 1) * step]);
  const inner = zi1 - zi0;
  const twoRows = rows === 2 || (rows === 'auto' && inner > 14);
  const stairBay = stairAt == null ? -1 : bays.findIndex(([a, b]) => stairAt >= a && stairAt < b);
  const lobbyBay = lobbyAt == null ? -1 : bays.findIndex(([a, b]) => lobbyAt >= a && lobbyAt < b);
  if (twoRows) {
    const cz0 = -corridor / 2, cz1 = corridor / 2;
    // corridor walls with a door per room (the lobby opens wide)
    for (const side of [-1, 1]) {
      const zc = side * (corridor / 2 + PART / 2);
      const ops = bays.map(([a, b], i) => (i === lobbyBay && side > 0 ? door((a + b) / 2, Math.min(5, b - a - 1)) : i === stairBay && side < 0 ? door((a + b) / 2, 2.2) : door(a + 1.2, 1.0, 2.2)));
      wall(P, 'x', zc, PART, xi0, xi1, y0, h, ops, M.plaster);
    }
    // partitions across each row
    for (let i = 1; i < n; i++) {
      const x = xi0 + i * step;
      if ((i === lobbyBay || i === lobbyBay + 1) && lobbyBay >= 0) { wall(P, 'z', x, PART, zi0, cz0 - PART, y0, h, [], M.plaster); continue; }
      wall(P, 'z', x, PART, cz1 + PART, zi1, y0, h, [], M.plaster);
      wall(P, 'z', x, PART, zi0, cz0 - PART, y0, h, [], M.plaster);
    }
    if (stairBay >= 0) stair(P, bays[stairBay][0] + 0.4, bays[stairBay][1] - 0.4, zi0 + 0.3, cz0 - PART - 0.3, y0, h);
  } else {
    for (let i = 1; i < n; i++) wall(P, 'z', xi0 + i * step, PART, zi0, zi1, y0, h, [], M.plaster);
    if (stairBay >= 0) stair(P, bays[stairBay][0] + 0.4, bays[stairBay][1] - 0.4, zi0 + 0.3, zi1 - 0.3, y0, h);
  }
  return { bays, twoRows };
}
/** a switchback stair filling [x0, x1] × [z0, z1], rising rise from y0 (one storey) */
function stair(P, x0, x1, z0, z1, y0, rise) {
  const half = rise / 2, steps = Math.max(6, Math.round(half / 0.16)), tread = Math.min(0.3, (x1 - x0 - 1.4) / steps);
  if (tread <= 0.12) return;
  const zm = (z0 + z1) / 2, run = steps * tread;
  // treads as slabs (a waist under each), so a cut shows the treads below and ink only where it passes
  const tr = (xa, top, za, zb) => P.box(xa, xa + tread, Math.max(y0, top - 0.24), top, za, zb, M.step);
  for (let i = 0; i < steps; i++) {
    // flight one rises towards +x on the near half, flight two returns on the far half
    tr(x0 + i * tread, y0 + (half * (i + 1)) / steps, z0, zm - 0.05);
    tr(x0 + run - (i + 1) * tread, y0 + half + (half * (i + 1)) / steps, zm + 0.05, z1);
  }
  P.box(x0 + run, x1, y0 + half - 0.24, y0 + half, z0, z1, M.step);   // the half landing
}
function grid(P, x0, x1, z0, z1, pitch, y0, h, size = 0.5, skip = null) {
  const nx = Math.max(1, Math.round((x1 - x0) / pitch)), nz = Math.max(1, Math.round((z1 - z0) / pitch));
  for (let i = 1; i < nx; i++) for (let j = 1; j < nz; j++) {
    const x = x0 + ((x1 - x0) * i) / nx, z = z0 + ((z1 - z0) * j) / nz;
    if (skip && skip(x, z, size)) continue;
    P.box(x - size / 2, x + size / 2, y0, y0 + h, z - size / 2, z + size / 2, M.column);
  }
}

// ---------------------------------------------------------------- building forms
// Local frame: x along the footprint's width (size[0]), z along its depth (size[2]),
// +z the front (as the walk builds them), y up from the ground plane.
const FORMS = {};

/** storey levels: the data's model height divided over its storeys above a raised ground floor */
function levels(b, base) {
  const f = Math.max(1, b.floors || 1), H = b.size[1];
  const fh = (H - base) / f;
  return { f, fh, at: Array.from({ length: f }, (_, k) => base + k * fh), H };
}

// 教学楼 · teaching blocks: dark stone ground storey, light walls above, the open
// gallery on -Z, the porch on +Z, red hipped roof (二号楼: flat with a parapet)
FORMS.academic = (P, b, w, d) => {
  const base = 0.45, L = levels(b, base), { f, fh, H } = L;
  P.box(-w / 2 - 0.2, w / 2 + 0.2, 0, base, -d / 2 - 2.2, d / 2 + 0.2, M.plinth);      // plinth, gallery included
  const gal = 2.0, gz = -d / 2 - gal;
  for (let k = 0; k < f; k++) {
    const y = L.at[k], hw = fh - SLAB;
    const stone = k === 0 ? M.baseStone : M.wallLight;
    const inn = interior(P, { w, d, y0: y, h: hw, bay: 9, stairAt: 10, lobbyAt: k === 0 ? 0 : null });
    // +Z: windows per room; the ground floor's entrance in the middle
    const front = [], back = [];
    for (const [a, c] of inn.bays) for (const x of rhythm(a, c, 2.1, 1.0)) {
      if (k === 0 && Math.abs(x) < 3.2) continue;
      front.push(win(x, 2.1, 0.9, 2.5));
      back.push(win(x, 1.6, 1.5, 2.6));
    }
    if (k === 0) front.push({ at: 0, w: 3.4, sill: 0, head: 3.0, leaf: true });
    // -Z faces the gallery: a door into every room on that side, high windows between
    for (const [a] of inn.bays) back.push(door(a + 0.8, 1.0, 2.3));
    wall(P, 'x', d / 2 - WALL / 2, WALL, -w / 2, w / 2, y, hw, front, stone);
    wall(P, 'x', -d / 2 + WALL / 2, WALL, -w / 2, w / 2, y, hw, dedupe(back), stone);
    const ends = rhythm(-d / 2 + WALL, d / 2 - WALL, 1.7, 1.4).map((z) => win(z, 1.7, 0.9, 2.5));
    wall(P, 'z', -w / 2 + WALL / 2, WALL, -d / 2 + WALL, d / 2 - WALL, y, hw, ends, stone);
    wall(P, 'z', w / 2 - WALL / 2, WALL, -d / 2 + WALL, d / 2 - WALL, y, hw, ends, stone);
    // the slab above this storey runs out over the gallery
    P.box(-w / 2, w / 2, y + hw, y + fh, -d / 2, d / 2, k === f - 1 ? (b.id === 'erhao' ? M.roofFlat : M.concrete) : M.floor);
    P.box(-w / 2, w / 2, y + hw, y + fh, gz, -d / 2, k === f - 1 && b.id === 'erhao' ? M.roofFlat : M.concrete);
    if (k < f - 1) P.box(-w / 2, w / 2, y + fh, y + fh + 1.0, gz, gz + 0.18, M.parapet);   // the gallery's parapet
    // the gallery's columns, storey by storey, just inside the parapet
    const colN = Math.max(4, Math.round(w / 7.5));
    for (let i = 0; i < colN; i++) { const x = -w / 2 + (i + 0.5) * (w / colN); P.box(x - 0.26, x + 0.26, y, y + hw, gz + 0.2, gz + 0.72, M.column); }
  }
  // roof (二号楼 flat with a parapet, the others hipped in red tile, as the walk has them)
  if (b.id === 'erhao') parapet(P, -w / 2, w / 2, -d / 2 - gal, d / 2, H, 0.65, 0.22, M.parapet);
  else {
    const rh = b.id === 'yihao' ? 0.85 : 2.4;
    P.box(-w / 2 - 0.3, w / 2 + 0.3, H, H + 0.25, -d / 2 - 0.3, d / 2 + 0.3, M.concrete);   // eaves
    P.hip(-w / 2 - 0.3, w / 2 + 0.3, -d / 2 - 0.3, d / 2 + 0.3, H + 0.25, rh, M.roofRed);
  }
  // the stair house on the roof (5.8 × 12.4 at x = 10, as the walk places it)
  const sy = b.id === 'erhao' ? H : H + 0.25;
  P.box(7.1, 12.9, sy, sy + 3.2, -6.2, 6.2, M.wallLight);
  P.box(6.95, 13.05, sy + 3.2, sy + 3.5, -6.35, 6.35, M.roofRed);
  // the porch: steps, platform, two columns, beam, a small red hipped roof
  const pw = b.id === 'yihao' ? 14 : 10, pd = 6.5, ez = d / 2 + 3.0, colX = b.id === 'yihao' ? 5.8 : 3.8;
  for (let s = 0; s < 3; s++) P.box(-pw / 2 - 0.6 - s * 0.3, pw / 2 + 0.6 + s * 0.3, 0, base - s * 0.15, d / 2 + 0.2, ez + pd * 0.3 + 0.6 + s * 0.5, M.step);
  for (const x of [-colX, colX]) { P.cbox(x, ez + 1.2, 0.9, 0.9, base, 0.5, M.plinth); P.cbox(x, ez + 1.2, 0.65, 0.65, base + 0.5, 5.4, M.column); }
  P.box(-pw / 2 - 0.75, pw / 2 + 0.75, base + 5.9, base + 6.3, d / 2, ez + 1.6, M.beam);
  P.hip(-pw / 2 - 1.0, pw / 2 + 1.0, d / 2, ez + 2.4, base + 6.3, b.id === 'yihao' ? 0.85 : 1.2, M.roofRed);
  return { base };
};
function dedupe(ops) {
  const out = [];
  for (const o of ops.sort((a, b) => a.at - b.at)) if (!out.length || o.at - o.w / 2 > out[out.length - 1].at + out[out.length - 1].w / 2 + 0.1) out.push(o);
  return out;
}
function parapet(P, x0, x1, z0, z1, y, h, t, mat) {
  P.box(x0, x1, y, y + h, z0, z0 + t, mat); P.box(x0, x1, y, y + h, z1 - t, z1, mat);
  P.box(x0, x0 + t, y, y + h, z0 + t, z1 - t, mat); P.box(x1 - t, x1, y, y + h, z0 + t, z1 - t, mat);
}

function ring(P, x0, x1, z0, z1, y0, y1, out, mat) {
  P.box(x0 - out, x1 + out, y0, y1, z1, z1 + out, mat); P.box(x0 - out, x1 + out, y0, y1, z0 - out, z0, mat);
  P.box(x1, x1 + out, y0, y1, z0, z1, mat); P.box(x0 - out, x0, y0, y1, z0, z1, mat);
}

// 实验楼 · laboratories (科学馆, 化学楼, 科技楼): galleries, window grid, flat roof with plant
FORMS.lab = (P, b, w, d) => {
  const base = 0.45, L = levels(b, base), { f, fh, H } = L;
  P.box(-w / 2 - 0.15, w / 2 + 0.15, 0, base, -d / 2 - 2.1, d / 2 + 0.15, M.plinth);
  const gz = -d / 2 - 1.9;
  for (let k = 0; k < f; k++) {
    const y = L.at[k], hw = fh - SLAB;
    const inn = interior(P, { w, d, y0: y, h: hw, bay: 8.4, stairAt: w > 40 ? -w / 4 : 0, lobbyAt: k === 0 && w > 40 ? w / 6 : null });
    const front = [], back = [];
    for (const [a, c] of inn.bays) for (const x of rhythm(a, c, 1.8, 1.0)) { front.push(win(x, 1.8, 0.9, 2.6)); back.push(win(x, 1.5, 1.4, 2.6)); }
    for (const [a] of inn.bays) back.push(door(a + 1.0, 1.0, 2.3));
    if (k === 0) front.push(door(w > 40 ? w / 6 : 0, 3.2, 2.9));
    wall(P, 'x', d / 2 - WALL / 2, WALL, -w / 2, w / 2, y, hw, dedupe(front), M.wallLight);
    wall(P, 'x', -d / 2 + WALL / 2, WALL, -w / 2, w / 2, y, hw, dedupe(back), M.wallLight);
    const ends = rhythm(-d / 2 + WALL, d / 2 - WALL, 1.6, 1.4).map((z) => win(z, 1.6, 0.9, 2.6));
    wall(P, 'z', -w / 2 + WALL / 2, WALL, -d / 2 + WALL, d / 2 - WALL, y, hw, ends, M.wallLight);
    wall(P, 'z', w / 2 - WALL / 2, WALL, -d / 2 + WALL, d / 2 - WALL, y, hw, ends, M.wallLight);
    P.box(-w / 2 - 0.12, w / 2 + 0.12, y + hw, y + fh, -d / 2 - 0.12, d / 2 + 0.12, k === f - 1 ? M.roofFlat : M.floor);
    P.box(-w / 2, w / 2, y + hw, y + fh, gz, -d / 2 - 0.12, k === f - 1 ? M.roofFlat : M.concrete);
    if (k < f - 1) P.box(-w / 2, w / 2, y + fh, y + fh + 1.0, gz, gz + 0.16, M.parapet);
    const colN = Math.max(3, Math.round(w / 7.2));
    for (let i = 0; i <= colN; i++) { const x = -w / 2 + 0.25 + (i * (w - 0.5)) / colN; P.box(x - 0.22, x + 0.22, y, y + hw, gz + 0.2, gz + 0.64, M.column); }
  }
  parapet(P, -w / 2 - 0.12, w / 2 + 0.12, gz, d / 2 + 0.12, H, 1.1, 0.28, M.parapet);
  // rooftop plant, low and plain (fume housing and a tank, as in the walk)
  P.cbox(-w * 0.22, 0, 6, 3.2, H, 2.0, M.metal);
  P.cbox(w * 0.2, 0, 3.4, 3.4, H, 2.6, M.metal);
  P.cylinder(w * 0.32, d * 0.2, H, H + 1.6, 0.7, 0.7, 12, M.metal);
  // entrance canopy
  const ex = w > 40 ? w / 6 : 0;
  P.box(ex - 3.2, ex + 3.2, base + 4.0, base + 4.4, d / 2, d / 2 + 2.2, M.concrete);
  for (const x of [ex - 2.9, ex + 2.9]) P.cbox(x, d / 2 + 1.9, 0.3, 0.3, base, 4.0, M.column);
  for (let s = 0; s < 3; s++) P.box(ex - 3.4 - s * 0.3, ex + 3.4 + s * 0.3, 0, base - s * 0.15, d / 2 + 0.15, d / 2 + 2.4 + s * 0.45, M.step);
  return { base };
};

// 图书馆 · the library: light walls, floor bands, the +Z balconies and arched window,
// the onion cupola on its drum and the grand outdoor stair (after atelier.js)
FORMS.library = (P, b, w, d) => {
  const base = 0.45, L = levels(b, base), { f, fh, H } = L;
  const sx = -w * 0.2, face = d / 2 + 0.22, up = L.at[1] ?? 3.85;
  P.box(-w / 2 - 0.3, w / 2 + 0.3, 0, base, -d / 2 - 0.3, d / 2 + 0.3, M.plinth);
  for (let k = 0; k < f; k++) {
    const y = L.at[k], hw = fh - 0.38;
    // reading halls: a column grid, one core with the stair, a ring of rooms on -Z
    grid(P, -w / 2 + WALL, w / 2 - WALL, -d / 2 + WALL, d / 2 - WALL, 7.0, y, hw, 0.55, (x, z) => z < -d / 2 + 9.6);
    wall(P, 'x', -d / 2 + 9, PART, -w / 2 + WALL, w / 2 - WALL, y, hw, [door(-w / 4, 1.6), door(w / 4, 1.6), door(0, 1.0)], M.plaster);
    for (const x of [-w / 4 - 4, w / 4 + 4]) wall(P, 'z', x, PART, -d / 2 + WALL, -d / 2 + 9 - PART / 2, y, hw, [], M.plaster);
    stair(P, -4.2, 4.2, -d / 2 + 1.2, -d / 2 + 8.2, y, hw);
    const front = rhythm(-w / 2 + 1.0, w / 2 - 1.0, 2.35, 1.05).map((x) => win(x, 2.35, 0.75, 3.0));
    const back = rhythm(-w / 2 + 1.0, w / 2 - 1.0, 1.8, 1.6).map((x) => win(x, 1.8, 0.9, 2.8));
    const ends = rhythm(-d / 2 + 1.0, d / 2 - 1.0, 2.0, 1.4).map((z) => win(z, 2.0, 0.9, 2.9));
    if (k === 1) front.splice(0, front.length, ...front.filter((o) => Math.abs(o.at - sx) > 3.2), { at: sx, w: 4.2, sill: 0, head: 3.0, glass: true });
    wall(P, 'x', d / 2 - WALL / 2, WALL, -w / 2, w / 2, y, hw, front, M.wallLight);
    wall(P, 'x', -d / 2 + WALL / 2, WALL, -w / 2, w / 2, y, hw, back, M.wallLight);
    wall(P, 'z', -w / 2 + WALL / 2, WALL, -d / 2 + WALL, d / 2 - WALL, y, hw, ends, M.wallLight);
    wall(P, 'z', w / 2 - WALL / 2, WALL, -d / 2 + WALL, d / 2 - WALL, y, hw, ends, M.wallLight);
    P.box(-w / 2 - 0.3, w / 2 + 0.3, y + hw, y + fh, -d / 2 - 0.22, d / 2 + 0.22, k === f - 1 ? M.roofFlat : M.wallLight);   // floor bands
    // the +Z balcony with its rail
    if (k > 0) for (const [a, c] of k === 1 ? [[-w / 2, sx - 5.4], [sx + 5.4, w / 2]] : [[-w / 2, w / 2]]) {
      P.box(a, c, y - 0.1, y + 0.05, face, d / 2 + 0.9, M.concrete); P.box(a, c, y + 0.05, y + 1.0, d / 2 + 0.75, d / 2 + 0.9, M.parapet);
    }
  }
  parapet(P, -w / 2 - 0.3, w / 2 + 0.3, -d / 2 - 0.22, d / 2 + 0.22, H, 1.25, 0.3, M.parapet);
  // the cupola: drum and onion profile at (0.34 w, 0.42 d) as the walk has it
  const dx = w * 0.34, dz = d * 0.42, top = H;
  P.cylinder(dx, dz, top, top + 1.6, 2.25, 2.25, 32, M.wallLight);
  const prof = [[2.2, 0], [2.3, 0.3], [2.45, 1.0], [2.15, 1.9], [1.15, 2.8], [0.28, 3.35], [0, 3.6]].map(([r, y]) => [r, top + 1.6 + y]);
  P.lathe(dx, dz, prof, 32, M.metal);
  // the grand stair: a landing and 22 treads up to the second storey's door, a canopy on two columns
  P.box(sx - 5.4, sx + 5.4, 0, up, face, face + 0.9, M.step);
  for (let i = 0; i < 22; i++) { const h = ((21 - i) / 22) * up + up / 22; P.box(sx - 5.4, sx + 5.4, 0, h, face + 0.9 + i * 0.46, face + 0.9 + (i + 1) * 0.46, M.step); }
  for (const s of [-1, 1]) P.box(sx + s * 5.65 - 0.15, sx + s * 5.65 + 0.15, 0, up + 1.05, face, face + 2.4, M.wallLight);
  P.box(sx - 6.5, sx + 6.5, up + 2.6, up + 2.9, face, face + 4.6, M.wallLight);
  for (const s of [-1, 1]) P.cbox(sx + s * 6.2, face + 4.2, 0.36, 0.36, 0, up + 2.6, M.wallLight);
  return { base };
};

// 校友会 · the alumni office: three plain storeys, flat roof
FORMS.office = (P, b, w, d) => {
  const base = 0.45, L = levels(b, base), { f, fh, H } = L;
  P.box(-w / 2 - 0.15, w / 2 + 0.15, 0, base, -d / 2 - 0.15, d / 2 + 0.15, M.plinth);
  for (let k = 0; k < f; k++) {
    const y = L.at[k], hw = fh - SLAB;
    const inn = interior(P, { w, d, y0: y, h: hw, bay: 6.5, stairAt: w / 2 - 4, rows: 2, corridor: 2.0 });
    const fr = [], bk = [];
    for (const [a, c] of inn.bays) for (const x of rhythm(a, c, 2.0, 1.0)) { fr.push(win(x, 2.0, 0.9, 2.5)); bk.push(win(x, 2.0, 0.9, 2.5)); }
    if (k === 0) fr.push(door(0, 2.4, 2.6));
    wall(P, 'x', d / 2 - WALL / 2, WALL, -w / 2, w / 2, y, hw, dedupe(fr), M.wallWarm);
    wall(P, 'x', -d / 2 + WALL / 2, WALL, -w / 2, w / 2, y, hw, bk, M.wallWarm);
    for (const s of [-1, 1]) wall(P, 'z', s * (w / 2 - WALL / 2), WALL, -d / 2 + WALL, d / 2 - WALL, y, hw, [], M.wallWarm);
    P.box(-w / 2 - 0.12, w / 2 + 0.12, y + hw, y + fh, -d / 2 - 0.12, d / 2 + 0.12, k === f - 1 ? M.roofFlat : M.floor);
  }
  parapet(P, -w / 2 - 0.12, w / 2 + 0.12, -d / 2 - 0.12, d / 2 + 0.12, H, 1.05, 0.26, M.parapet);
  P.cbox(-w * 0.3, 0, w * 0.14, d * 0.5, H, 2.2, M.wallWarm);
  P.box(-2.5, 2.5, base + 3.0, base + 3.3, d / 2, d / 2 + 1.6, M.concrete);
  return { base };
};

// 艺术教育活动中心 · the arts centre: one great hall on a column grid, tall windows,
// a deep cornice and a red-hipped portico (atelier.js 'arts-red-hipped-portico')
FORMS.art = (P, b, w, d) => {
  const base = 1.0, L = levels(b, base), { f, fh, H } = L;
  P.box(-w / 2 - 0.25, w / 2 + 0.25, 0, base, -d / 2 - 0.25, d / 2 + 0.25, M.plinth);
  for (let k = 0; k < f; k++) {
    const y = L.at[k], hw = fh - SLAB;
    grid(P, -w / 2 + WALL, w / 2 - WALL, -d / 2 + WALL, d / 2 - WALL, 9.5, y, hw, 0.6, (x, z) => z < -d / 2 + 10.6);
    // a band of rooms along -Z, the hall in front of it
    wall(P, 'x', -d / 2 + 10, PART, -w / 2 + WALL, w / 2 - WALL, y, hw, rhythm(-w / 2 + 2, w / 2 - 2, 1.6, 7).map((x) => door(x, 1.6, 2.4)), M.plaster);
    for (const x of rhythm(-w / 2 + WALL, w / 2 - WALL, 0.01, 9.5)) wall(P, 'z', x, PART, -d / 2 + WALL, -d / 2 + 10 - PART / 2, y, hw, [], M.plaster);
    const tall = k === 0 ? [0.6, 3.2] : [0.9, 2.6];
    const fr = rhythm(-w / 2 + 1, w / 2 - 1, 3.2, 0.9).filter((x) => Math.abs(x) > 7).map((x) => win(x, 3.2, tall[0], tall[1]));
    if (k === 0) fr.push({ at: 0, w: 5.6, sill: 0, head: 3.6, glass: true });
    const sd = rhythm(-d / 2 + 1, d / 2 - 1, 3.0, 0.9).map((z) => win(z, 3.0, tall[0], tall[1]));
    wall(P, 'x', d / 2 - WALL / 2, WALL, -w / 2, w / 2, y, hw, fr, M.wallWarm);
    wall(P, 'x', -d / 2 + WALL / 2, WALL, -w / 2, w / 2, y, hw, rhythm(-w / 2 + 1, w / 2 - 1, 3.2, 0.9).map((x) => win(x, 3.2, tall[0], tall[1])), M.wallWarm);
    wall(P, 'z', -w / 2 + WALL / 2, WALL, -d / 2 + WALL, d / 2 - WALL, y, hw, sd, M.wallWarm);
    wall(P, 'z', w / 2 - WALL / 2, WALL, -d / 2 + WALL, d / 2 - WALL, y, hw, sd, M.wallWarm);
    P.box(-w / 2, w / 2, y + hw, y + fh, -d / 2, d / 2, k === f - 1 ? M.roofFlat : M.floor);
  }
  ring(P, -w / 2, w / 2, -d / 2, d / 2, H - 0.3, H + 0.2, 0.9, M.parapet);   // cornice
  parapet(P, -w / 2, w / 2, -d / 2, d / 2, H, 0.9, 0.28, M.parapet);
  // the portico: five broad steps, four columns, a red hipped roof
  const pw = w * 0.36, ez = d / 2 + 3.4;
  for (let s = 0; s < 5; s++) P.box(-pw / 2 - (4 - s) * 0.4, pw / 2 + (4 - s) * 0.4, 0, 0.2 * (s + 1), d / 2 + 0.25, d / 2 + 1.0 + (4 - s) * 0.8, M.step);
  for (const x of [-pw * 0.42, -pw * 0.14, pw * 0.14, pw * 0.42]) P.cbox(x, ez + 2.4, 0.62, 0.62, base, 5.4, M.column);
  P.box(-pw / 2 - 0.4, pw / 2 + 0.4, base + 5.4, base + 5.85, d / 2, ez + 3.0, M.beam);
  P.hip(-pw / 2 - 1.0, pw / 2 + 1.0, d / 2, ez + 3.8, base + 5.85, 2.1, M.roofRed);
  return { base };
};

// 食堂 · canteens: halls on a grid, a band of windows, flat roof
FORMS.canteen = (P, b, w, d) => {
  const base = 0.7, L = levels(b, base), { f, fh, H } = L;
  P.box(-w / 2 - 0.2, w / 2 + 0.2, 0, base, -d / 2 - 0.2, d / 2 + 0.2, M.plinth);
  for (let k = 0; k < f; k++) {
    const y = L.at[k], hw = fh - SLAB;
    grid(P, -w / 2 + WALL, w / 2 - WALL, -d / 2 + WALL, d / 2 - WALL, 7.5, y, hw, 0.6, (x, z) => Math.abs(z - (-d / 2 + 11)) < 0.6 || (x > w / 2 - 9.6 && z < -d / 2 + 7));
    // kitchens along -Z (inferred), the dining hall in front
    wall(P, 'x', -d / 2 + 11, PART, -w / 2 + WALL, w / 2 - WALL, y, hw, rhythm(-w / 2 + 2, w / 2 - 2, 2.4, 6).map((x) => door(x, 2.4, 2.4)), M.plaster);
    stair(P, w / 2 - 9, w / 2 - 0.6, -d / 2 + 0.6, -d / 2 + 6.4, y, hw);
    const fr = rhythm(-w / 2 + 1, w / 2 - 1, 2.6, 1.1).map((x) => win(x, 2.6, 0.9, 3.0));
    const sd = rhythm(-d / 2 + 1, d / 2 - 1, 2.6, 1.1).map((z) => win(z, 2.6, 0.9, 3.0));
    if (k === 0) { fr.splice(Math.floor(fr.length / 2), 1); fr.push({ at: 0, w: 3.6, sill: 0, head: 2.9, glass: true }); }
    wall(P, 'x', d / 2 - WALL / 2, WALL, -w / 2, w / 2, y, hw, dedupe(fr), M.wallWarm);
    wall(P, 'x', -d / 2 + WALL / 2, WALL, -w / 2, w / 2, y, hw, rhythm(-w / 2 + 1, w / 2 - 1, 1.4, 2.4).map((x) => win(x, 1.4, 1.4, 2.6)), M.wallWarm);
    wall(P, 'z', -w / 2 + WALL / 2, WALL, -d / 2 + WALL, d / 2 - WALL, y, hw, sd, M.wallWarm);
    wall(P, 'z', w / 2 - WALL / 2, WALL, -d / 2 + WALL, d / 2 - WALL, y, hw, sd, M.wallWarm);
    P.box(-w / 2 - 0.25, w / 2 + 0.25, y + hw, y + fh, -d / 2 - 0.25, d / 2 + 0.25, k === f - 1 ? M.roofFlat : M.floor);
  }
  parapet(P, -w / 2 - 0.25, w / 2 + 0.25, -d / 2 - 0.25, d / 2 + 0.25, H, 0.8, 0.26, M.parapet);
  for (let s = 0; s < 2; s++) P.box(-3 - s * 0.3, 3 + s * 0.3, 0, base - s * 0.3, d / 2 + 0.25, d / 2 + 1.2 + s * 0.6, M.step);
  return { base };
};

// 宿舍 · dormitories: a bar of rooms (units every ~4.2 m as the walk has them), an
// inner corridor, deep balconies on the front
FORMS.living = (P, b, w, d) => {
  const base = 0.45, L = levels(b, base), { f, fh, H } = L;
  const bodyD = d * 0.72, bz = -d * 0.14, balD = d * 0.28, balZ0 = bz + bodyD / 2;
  P.box(-w / 2 - 0.15, w / 2 + 0.15, 0, base, -d / 2 - 0.15, d / 2, M.plinth);
  const uN = Math.max(3, Math.round(w / 4.2)), uw = w / uN;
  for (let k = 0; k < f; k++) {
    const y = L.at[k], hw = fh - SLAB;
    const z0 = bz - bodyD / 2, z1 = bz + bodyD / 2, cw = 1.9;
    // the corridor along the back third of the body; rooms in front of it
    const cz = z0 + WALL + cw + Math.min(bodyD * 0.3, 6);
    wall(P, 'x', cz, PART, -w / 2 + WALL, w / 2 - WALL, y, hw, Array.from({ length: uN }, (_, u) => door(-w / 2 + (u + 0.3) * uw, 0.9, 2.2)), M.plaster);
    wall(P, 'x', cz - cw, PART, -w / 2 + WALL, w / 2 - WALL, y, hw, Array.from({ length: uN }, (_, u) => door(-w / 2 + (u + 0.7) * uw, 0.9, 2.2)), M.plaster);
    for (let u = 1; u < uN; u++) {
      const x = -w / 2 + u * uw;
      wall(P, 'z', x, PART, cz + PART / 2, z1 - WALL, y, hw, [], M.plaster);
      wall(P, 'z', x, PART, z0 + WALL, cz - cw - PART / 2, y, hw, [], M.plaster);
      wall(P, 'z', x, PART, z1, z1 + balD - 0.2, y + 0.05, hw - 0.3, [], M.wallWarm);   // balcony dividers
    }
    stair(P, -w / 2 + WALL + 0.2, -w / 2 + uw - 0.2, z0 + WALL + 0.1, cz - cw - PART, y, hw);
    const fr = [], bk = [];
    for (let u = 0; u < uN; u++) { const x = -w / 2 + (u + 0.5) * uw; fr.push({ at: x - uw * 0.2, w: 0.9, sill: 0, head: 2.3, glass: true }, win(x + uw * 0.18, Math.min(1.5, uw * 0.35), 0.9, 2.4)); bk.push(win(x, 1.2, 1.1, 2.4)); }
    wall(P, 'x', z1 - WALL / 2, WALL, -w / 2, w / 2, y, hw, dedupe(fr), M.wallWarm);
    wall(P, 'x', z0 + WALL / 2, WALL, -w / 2, w / 2, y, hw, bk, M.wallWarm);
    for (const s of [-1, 1]) wall(P, 'z', s * (w / 2 - WALL / 2), WALL, z0 + WALL, z1 - WALL, y, hw, k === 0 ? [door(cz - cw / 2, 1.6, 2.4)] : [win(cz - cw / 2, 1.2, 0.9, 2.4)], M.wallWarm);
    P.box(-w / 2 - 0.12, w / 2 + 0.12, y + hw, y + fh, z0 - 0.12, z1, k === f - 1 ? M.roofFlat : M.floor);
    // the balcony: slab and solid balustrade
    P.box(-w / 2, w / 2, y + hw, y + fh, z1, z1 + balD, M.concrete);
    if (k < f - 1) P.box(-w / 2, w / 2, y + fh, y + fh + 1.0, z1 + balD - 0.16, z1 + balD, M.parapet);
  }
  parapet(P, -w / 2 - 0.12, w / 2 + 0.12, bz - bodyD / 2 - 0.12, bz + bodyD / 2, H, 1.0, 0.26, M.parapet);
  return { base };
};

// 校门 · the gates: four columns, three bays, three roofs of green glazed tile (photo-based
// proportions in the walk, not measured)
FORMS.gate = (P, b) => {
  const W = 18, D = b.id === 'beimen' ? 1.65 : Math.max(b.size[2], 6), HT = b.id === 'beimen' ? 8.4 : Math.max(b.size[1], 10.5);
  const Pc = 1.35, midW = 6.6;
  const colX = [-W / 2 + Pc / 2, -midW / 2 - Pc / 2, midW / 2 + Pc / 2, W / 2 - Pc / 2], colH = [HT * 0.73, HT, HT, HT * 0.73];
  colX.forEach((x, i) => {
    P.cbox(x, 0, Pc + 0.45, D * 0.95, 0, 0.55, M.step);
    P.cbox(x, 0, Pc, D * 0.82, 0.55, colH[i] - 0.55, M.whiteGate);
    P.cbox(x, 0, Pc + 0.35, D * 0.88, colH[i], 0.35, M.gold);
  });
  const capR = (i) => colX[i] + (Pc + 0.35) / 2, capL = (i) => colX[i] - (Pc + 0.35) / 2;
  const beam = (i, j, y, h, dd) => P.box(capR(i), capL(j), y, y + h, -dd / 2, dd / 2, M.whiteGate);
  beam(0, 1, HT * 0.75 - 0.33, 0.65, D * 0.78); beam(1, 2, HT * 0.75 - 0.33, 0.65, D * 0.78); beam(2, 3, HT * 0.75 - 0.33, 0.65, D * 0.78);
  beam(1, 2, HT * 0.86 - 0.37, 0.75, D * 0.8);
  beam(1, 2, HT - 0.55, 0.55, D * 0.78);
  const mainRW = midW + Pc * 3.2, mainRD = D * 1.65 + 1.9, mainRH = b.id === 'beimen' ? 1.65 : 2.7;
  P.hip(-mainRW / 2 - 0.95, mainRW / 2 + 0.95, -mainRD / 2, mainRD / 2, HT + 0.35, mainRH, M.roofHerit);
  const sideRD = D * 1.55 + 1.6;
  for (const s of [-1, 1]) {
    const xa = midW / 2 + Pc + 0.05, xb = W / 2 + 0.8;
    P.hip(s > 0 ? xa : -xb, s > 0 ? xb : -xa, -sideRD / 2, sideRD / 2, colH[0] + 0.35, b.id === 'beimen' ? 1.05 : 1.6, M.roofHerit);
    // gatehouse walls with their own small roofs
    const gx = s * (W / 2 + 2.65);
    P.cbox(gx, 0, 4.8, 0.7, 0, 3.6, M.wallWarm);
    P.hip(gx - 2.9, gx + 2.9, -0.7, 0.7, 3.6, 0.75, M.roofHerit);
    // stone lions by the gate (blocks)
    P.cbox(s * (midW / 2 + 1.1), D / 2 + 1.5, 1.0, 1.0, 0, 1.6, M.whiteGate);
  }
  return { base: 0 };
};

// 亭 · pavilions: a round stone platform, six columns, an eight-sided roof of green tile
FORMS.pavilion = (P, b, w, d) => {
  const H = b.size[1], r = Math.min(w, d) * 0.42, baseH = 0.75;
  P.cylinder(0, 0, 0, baseH, r * 1.2, r * 1.12, 24, M.step);
  P.cylinder(0, 0, baseH, baseH + 0.16, r * 1.02, r * 1.02, 24, M.step);
  const colH = H * 0.58;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    P.cylinder(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82, baseH + 0.16, baseH + 0.16 + colH, 0.26, 0.24, 10, M.beam);
  }
  const y = baseH + 0.16 + colH;
  P.cylinder(0, 0, y, y + 0.3, r * 1.05, r * 1.28, 8, M.beam);
  const roofH = H * 0.42;
  P.lathe(0, 0, [[r * 1.34, y + 0.3], [r * 0.95, y + 0.3 + roofH * 0.45], [r * 0.4, y + 0.3 + roofH * 0.85], [0, y + 0.3 + roofH * 1.15]], 8, M.roofHerit);
  return { base: baseH + 0.16 };
};

// 连廊 · covered bridges between the blocks: columns, a glazed walkway on top
FORMS.corr = (P, b, w, d) => {
  const H = b.size[1], clear = 3.1;
  const along = d >= w;          // runs along Z
  const L = along ? d : w, Wd = along ? w : d;
  const bx = (a0, a1, y0, y1, c0, c1, m) => (along ? P.box(c0, c1, y0, y1, a0, a1, m) : P.box(a0, a1, y0, y1, c0, c1, m));
  const n = Math.max(2, Math.round(L / 8));
  for (let j = 0; j < n; j++) for (const s of [-1, 1]) {
    const a = -L / 2 + (j + 0.5) * (L / n), c = s * (Wd / 2 - 0.2);
    bx(a - 0.16, a + 0.16, 0, clear, c - 0.16, c + 0.16, M.column);
  }
  bx(-L / 2, L / 2, clear, clear + 0.22, -Wd / 2, Wd / 2, M.concrete);
  for (const s of [-1, 1]) {
    bx(-L / 2, L / 2, clear + 0.22, clear + 1.0, s * Wd / 2 - 0.09, s * Wd / 2 + 0.09, M.parapet);
    bx(-L / 2, L / 2, clear + 1.0, H - 0.2, s * Wd / 2 - 0.03, s * Wd / 2 + 0.03, M.glass);
  }
  bx(-L / 2 - 0.2, L / 2 + 0.2, H - 0.2, H + 0.05, -Wd / 2 - 0.3, Wd / 2 + 0.3, M.concrete);
  return { base: 0 };
};

// ---------------------------------------------------------------- footprints that overlap
// The plan's rectangles overlap where a bridge meets a block, or where the boys'
// dormitory's wings meet its spine. Solids must not overlap for the cut to fill
// cleanly, so a bridge stops at the faces it meets and a wing starts at the spine.
function trimmed(b, r, all) {
  if (b.form === 'corr') {
    const along = r.d >= r.w;
    // [lo, hi] along the bridge, [c0, c1] across it
    let lo = along ? r.z - r.d / 2 : r.x - r.w / 2, hi = along ? r.z + r.d / 2 : r.x + r.w / 2;
    let c0 = along ? r.x - r.w / 2 : r.z - r.d / 2, c1 = along ? r.x + r.w / 2 : r.z + r.d / 2;
    const blocks = all.filter((o) => o !== b && ['academic', 'lab', 'library', 'office', 'canteen', 'living', 'art'].includes(o.form));
    const span = (o) => {
      const q = o.r, g = o.form === 'academic' ? 2.2 : o.form === 'lab' ? 2.1 : 0;   // the galleries on -Z
      return along ? { a0: q.z - q.d / 2 - g, a1: q.z + q.d / 2, x0: q.x - q.w / 2, x1: q.x + q.w / 2 }
        : { a0: q.x - q.w / 2, a1: q.x + q.w / 2, x0: q.z - q.d / 2 - g, x1: q.z + q.d / 2 };
    };
    // a walkway that only grazes a block's side is narrowed to its face
    for (const o of blocks) {
      const s = span(o);
      if (s.a1 <= lo || s.a0 >= hi) continue;
      const over = Math.min(s.x1, c1) - Math.max(s.x0, c0);
      if (over <= 0 || over > (c1 - c0) * 0.5) continue;
      if (s.x1 < c1) c0 = Math.max(c0, s.x1); else c1 = Math.min(c1, s.x0);
    }
    // a bridge that runs into a block stops at its face
    for (const o of blocks) {
      const s = span(o);
      const over = Math.min(s.x1, c1) - Math.max(s.x0, c0);
      if (over <= 0) continue;
      const mid = (lo + hi) / 2;
      if (s.a1 > lo && s.a1 < mid) lo = s.a1;
      if (s.a0 < hi && s.a0 > mid) hi = s.a0;
    }
    return along ? { ...r, x: (c0 + c1) / 2, w: c1 - c0, z: (lo + hi) / 2, d: hi - lo } : { ...r, z: (c0 + c1) / 2, d: c1 - c0, x: (lo + hi) / 2, w: hi - lo };
  }
  if (b.id.startsWith('dorm_m_')) {
    const spine = all.find((o) => o.id === 'dorm_m');
    if (spine) {
      const x0 = spine.r.x + spine.r.w / 2, x1 = r.x + r.w / 2;
      return { ...r, x: (x0 + x1) / 2, w: x1 - x0 };
    }
  }
  return r;
}

// ---------------------------------------------------------------- the campus
const BUILT = ['academic', 'lab', 'library', 'office', 'art', 'canteen', 'living', 'gate', 'pavilion', 'corr'];
const GROUPS = { dorm_m_n: 'dorm_m', dorm_m_m: 'dorm_m', dorm_m_s: 'dorm_m' };

/**
 * @param campus  assets/walk/campus.json
 * @param frame   geo.js makeFrame (the plan's own campus ↔ world frame)
 * @returns { arrays: {position, normal, edge, info, index}, buildings: [...] }
 */
export function buildCampus(campus, frame) {
  const tf = campus.meta.transform;
  const list = campus.buildings.filter((b) => BUILT.includes(b.form)).map((b) => {
    const rc = rectCampus(b.rect, tf);
    const w = frame.toWorld(rc.x, rc.z);
    return { id: b.id, form: b.form, b, r: { x: w.x, z: w.z, w: rc.w, d: rc.d } };
  });
  const P = new Packer();
  const buildings = [];
  list.forEach((it) => {
    const r = trimmed(it.b, it.r, list);
    const b = it.b;
    if (r.w < 1 || r.d < 1) return;
    const index = buildings.length;
    let rot = b.rot || 0, w = r.w, d = r.d;
    // the spine of the boys' dormitory runs north–south: build it lengthwise, balconies to the west
    if (b.form === 'living' && d > w * 1.6) { rot -= Math.PI / 2; [w, d] = [d, w]; }
    P.frame(r.x, r.z, rot, frame.ground, index);
    const v0 = P.n, i0 = P.idx.length;
    const out = FORMS[b.form](P, b, w, d);
    const L = b.form === 'gate' || b.form === 'pavilion' || b.form === 'corr' ? null : levels(b, out.base);
    // the solid horizontal layers that span the whole footprint (plinth, floor slabs, roof slab):
    // a cut passing through one fills the whole building with ink, so the timeline steps over them
    const slabT = b.form === 'library' ? 0.38 : SLAB;
    const bands = L ? [[0, out.base], ...L.at.map((y) => [y + L.fh - slabT, y + L.fh])] : [[0, out.base]];
    buildings.push({
      id: b.id, group: GROUPS[b.id] || b.id, name: b.name, form: b.form, index,
      cx: r.x, cz: r.z, w: r.w, d: r.d, rot: b.rot || 0,
      base: out.base, top: P.top, height: b.size[1], floors: L ? L.f : 0, floorH: L ? L.fh : 0,
      levels: L ? L.at : [], bands,
      verts: [v0, P.n], tris: [i0 / 3, P.idx.length / 3]
    });
  });
  const n = P.n;
  return {
    arrays: {
      position: P.pos.slice(0, n * 3), normal: P.nrm.slice(0, n * 3), edge: P.edge.slice(0, n * 4), info: P.info.slice(0, n * 2),
      index: Uint32Array.from(P.idx)
    },
    buildings
  };
}

/** a cut height moved off the solid layers it would otherwise slice (local metres, ascending bands) */
export function clearOfBands(y, bands) {
  for (const [a, c] of bands) if (y > a - 0.02 && y < c + 0.02) return y < (a + c) / 2 && a > 0.05 ? a - 0.03 : c + 0.03;
  return y;
}

/** The cut through building b for a local fraction (plan) or an absolute height: helpers for the timeline */
export function planCut(b, ground) { return ground + b.base + CUT_HEIGHT; }
export function floorCut(b, k, ground) { return ground + (b.levels[k] ?? b.base) + CUT_HEIGHT; }
