// Where a work lives on the tree: a stable leaf address, never a random position.
//
//   address = "<asset>:<direction>:<slot>"     e.g. "v4-2611:photo:3"
//
// • asset      the tree the slots were counted on. The V4 tree is deterministic (Blender
//              build, seed 2611, lanren/assets/rosettes.bin); if it is ever rebuilt, a new
//              asset id gets its own slot table and old addresses are migrated once, in
//              order, so every work keeps a leaf and nobody's leaf is handed to another.
// • direction  the limb (directions.js) — the work's primary creative direction.
// • slot       an integer handed out when the work is first made public and stored with it.
//              Slots are append-only: withdrawing a work keeps its slot reserved, so a
//              re-published work returns to the same leaf and no one else moves into it.
//
// A slot resolves to one real rosette of the crown by a pure function of the asset: the
// rosettes of the direction's sector, on the outer shell, with new growth, ordered from
// the clumps nearest the limb's home outwards. The order does not depend on how many works
// exist, on load order or on the device, so the same work is on the same leaf for everyone.
// Pure (Node-testable): pass the rosette array (tree.json rosetteLayout, stride 16).

import { DIRECTIONS, byId, midAzimuth } from './directions.js';

export const ASSET = 'v4-2611';
export const AXIS = { x: 0.6, z: -0.2 };   // = chapters.js AXIS (not imported: keep this module free of three.js)
const D2R = Math.PI / 180;
const WINDOW = 3;        // clumps filled together before moving further out along the limb
const PER_CLUMP = 4;     // leaves per clump in one pass
const SPACING = 0.45;    // metres between two work leaves in the same clump

/** Rosettes that can carry a work: outer shell, new growth, in a sector, seen from inside the crown. */
export function candidate(ros, o) {
  const y = ros[o + 1], occ = ros[o + 8], tE = ros[o + 9], shell = ros[o + 15];
  return tE >= 0 && shell > 0.5 && y > 4.2 && y < 12.5 && occ < 0.75;
}

export function azimuth(x, z) { return ((Math.atan2(x - AXIS.x, z - AXIS.z) / D2R) % 360 + 360) % 360; }
const inSector = (deg, [a0, a1]) => (deg >= a0 && deg <= a1) || (a1 > 360 && deg + 360 <= a1);

/** The limb's home: where its slots begin (mid-azimuth, the height of the lower tier, on the shell). */
export function home(d, radius = 9.5, y = 7.4) {
  const a = midAzimuth(d) * D2R;
  return { x: AXIS.x + Math.sin(a) * radius, y, z: AXIS.z + Math.cos(a) * radius };
}

/**
 * Slot table: direction id → ordered rosette indices (slot k = table[k]).
 * Deterministic for a given rosette array.
 */
export function buildSlots(ros, stride = 16) {
  const n = Math.floor(ros.length / stride);
  const table = new Map();
  for (const d of DIRECTIONS) {
    const h = home(d);
    const clumps = new Map();   // clump key → rosette indices
    for (let i = 0; i < n; i++) {
      const o = i * stride;
      if (!candidate(ros, o) || !inSector(azimuth(ros[o], ros[o + 2]), d.sector)) continue;
      const key = `${ros[o + 12].toFixed(3)},${ros[o + 13].toFixed(3)},${ros[o + 14].toFixed(3)}`;
      if (!clumps.has(key)) clumps.set(key, []);
      clumps.get(key).push(i);
    }
    const dist = (i) => Math.hypot(ros[i * stride] - h.x, ros[i * stride + 1] - h.y, ros[i * stride + 2] - h.z);
    // clumps ordered by their nearest rosette to home (ties: key text, so the order is total)
    const list = [...clumps.entries()].map(([key, idx]) => {
      idx.sort((a, b) => dist(a) - dist(b) || a - b);
      return { key, idx, d: dist(idx[0]) };
    }).sort((a, b) => a.d - b.d || (a.key < b.key ? -1 : 1));
    // within a clump: a well-spaced subset first, the rest after
    for (const c of list) {
      const spaced = [], rest = [];
      for (const i of c.idx) {
        const ok = spaced.every((j) => Math.hypot(ros[i * stride] - ros[j * stride], ros[i * stride + 1] - ros[j * stride + 1], ros[i * stride + 2] - ros[j * stride + 2]) >= SPACING);
        (ok ? spaced : rest).push(i);
      }
      c.order = [...spaced, ...rest];
    }
    const slots = [];
    for (let w = 0; w < list.length; w += WINDOW) {
      const win = list.slice(w, w + WINDOW);
      // pass 1: up to PER_CLUMP from each clump of the window, alternating clumps
      for (let k = 0; k < PER_CLUMP; k++) for (const c of win) if (c.order[k] !== undefined) slots.push(c.order[k]);
    }
    // everything not yet used, in the same clump order, so no candidate is ever lost
    const used = new Set(slots);
    for (const c of list) for (const i of c.order) if (!used.has(i)) slots.push(i);
    table.set(d.id, slots);
  }
  return table;
}

export function format(direction, slot, asset = ASSET) { return `${asset}:${direction}:${slot}`; }

export function parse(address) {
  const m = /^([a-z0-9-]+):([a-z]+):(\d{1,6})$/.exec(String(address || ''));
  if (!m || !byId(m[2])) return null;
  return { asset: m[1], direction: m[2], slot: +m[3] };
}

/** address → rosette index (or null: unknown asset, unknown direction, slot beyond the limb). */
export function resolve(address, table) {
  const a = parse(address);
  if (!a || a.asset !== ASSET) return null;
  const slots = table.get(a.direction);
  return slots && a.slot < slots.length ? slots[a.slot] : null;
}

/**
 * Hand out a slot when a work is first made public (server side, inside the publishing
 * transaction). `reserved`: every slot ever given in this direction (published, withdrawn
 * or hidden — slots are never reused). `near`: a rosette index to grow next to (a relay or
 * a derived work grows beside its source when both are on the same limb).
 */
export function allocate(direction, reserved, table, ros, { near = null, stride = 16 } = {}) {
  const slots = table.get(direction);
  if (!slots) throw new Error('unknown direction ' + direction);
  const taken = reserved instanceof Set ? reserved : new Set(reserved);
  if (near === null) {
    for (let k = 0; k < slots.length; k++) if (!taken.has(k)) return k;
    return -1;
  }
  let best = -1, bd = Infinity;
  for (let k = 0; k < slots.length; k++) {
    if (taken.has(k)) continue;
    const i = slots[k], o = i * stride, q = near * stride;
    const d = Math.hypot(ros[o] - ros[q], ros[o + 1] - ros[q + 1], ros[o + 2] - ros[q + 2]);
    if (d < bd - 1e-9) { bd = d; best = k; }
  }
  return best;
}

/** A short fingerprint of a slot table, recorded with the asset (tests; migration safety). */
export function fingerprint(table) {
  let h = 2166136261 >>> 0;
  for (const d of DIRECTIONS) for (const i of table.get(d.id) || []) { h ^= i; h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
