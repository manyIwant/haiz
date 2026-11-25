// HAIZ World Engine — Unified WorldEntity Manager & Opt-In Multiplayer Packet Contract
//
// Provides ONE extensible runtime interface for:
//   - Player avatars & 51-joint campus NPCs
//   - Campus Toybox V2 mascots (lanren-spirit, sunshine-duck, campus-cat, schoolbag-bear, ocean-whale, hainan-fawn)
//   - Multi-modal vehicles (walk, bike, skateboard, bamboo broom)
//   - Living campus creatures (orange cat, butterflies)
//   - Future opt-in multiplayer peers (privacy-first, compact state packet, zero skeleton streaming)

import { separation3D } from '../spatial/coord.js';

export const ENTITY_KINDS = Object.freeze(['avatar', 'npc', 'mascot', 'vehicle', 'creature', 'station', 'peer']);
export const LOCOMOTION_MODES = Object.freeze(['walk', 'bike', 'board', 'broom']);

function assertFiniteTransform(t) {
  if (!t || !Number.isFinite(t.x) || !Number.isFinite(t.y) || !Number.isFinite(t.z)) {
    throw new Error(`Illegal non-finite entity transform: ${JSON.stringify(t)}`);
  }
}

/** Compact, privacy-safe opt-in multiplayer state packet (no real student identity or tracking history) */
export function serializePeerPacket(entity) {
  const s = typeof entity.snapshot === 'function' ? entity.snapshot() : entity;
  const mode = LOCOMOTION_MODES.includes(s.mode) ? s.mode : 'walk';
  assertFiniteTransform(s.transform || s);
  const t = s.transform || s;
  return {
    schema: 'haiz-peer-packet/1',
    peerId: String(s.id || entity.id),
    assetId: String(s.assetId || entity.assetId || 'char:student-m'),
    mode,
    x: +t.x.toFixed(3),
    y: +t.y.toFixed(3),
    z: +t.z.toFixed(3),
    yaw: +(t.yaw || 0).toFixed(4),
    speed: +(s.speed || 0).toFixed(2),
    roll: +(s.roll || 0).toFixed(3),
    steer: +(s.steer || 0).toFixed(3),
    crank: +(s.crank || 0).toFixed(3),
    ts: Date.now(),
  };
}

export function validatePeerPacket(pkt) {
  if (!pkt || pkt.schema !== 'haiz-peer-packet/1') return { ok: false, reason: 'invalid schema' };
  if (!LOCOMOTION_MODES.includes(pkt.mode)) return { ok: false, reason: 'invalid locomotion mode' };
  for (const k of ['x', 'y', 'z', 'yaw', 'speed']) {
    if (!Number.isFinite(pkt[k])) return { ok: false, reason: `non-finite ${k}` };
  }
  if (Math.abs(pkt.x) > 1000 || Math.abs(pkt.z) > 1000 || pkt.y < -20 || pkt.y > 120) {
    return { ok: false, reason: 'out of campus spatial bounds' };
  }
  return { ok: true };
}

export function createEntityManager({ bus } = {}) {
  const entities = new Map();

  function register(entity) {
    if (!entity || !entity.id) throw new Error('WorldEntity requires a unique id');
    if (!ENTITY_KINDS.includes(entity.kind)) {
      throw new Error(`Invalid WorldEntity kind "${entity.kind}"`);
    }
    if (entities.has(entity.id)) {
      throw new Error(`Duplicate WorldEntity id "${entity.id}"`);
    }
    const transform = entity.transform || { x: 0, y: -0.85, z: 0, yaw: 0 };
    assertFiniteTransform(transform);

    const wrapped = {
      id: entity.id,
      kind: entity.kind,
      assetId: entity.assetId || null,
      fictionalOnly: entity.fictionalOnly !== false,
      transform,
      lod: entity.lod || 'base',
      meta: entity.meta || {},
      update: typeof entity.update === 'function' ? entity.update : null,
      snapshot:
        typeof entity.snapshot === 'function'
          ? entity.snapshot
          : () => ({ id: entity.id, kind: entity.kind, assetId: entity.assetId || null, transform: { ...transform } }),
      applySnapshot:
        typeof entity.applySnapshot === 'function'
          ? entity.applySnapshot
          : (pkt) => {
              if (Number.isFinite(pkt?.x)) transform.x = pkt.x;
              if (Number.isFinite(pkt?.y)) transform.y = pkt.y;
              if (Number.isFinite(pkt?.z)) transform.z = pkt.z;
              if (Number.isFinite(pkt?.yaw)) transform.yaw = pkt.yaw;
            },
      dispose: typeof entity.dispose === 'function' ? entity.dispose : () => {},
    };
    entities.set(wrapped.id, wrapped);
    bus?.emit('entity:registered', { id: wrapped.id, kind: wrapped.kind, assetId: wrapped.assetId });
    return wrapped;
  }

  function unregister(id) {
    const ent = entities.get(id);
    if (!ent) return false;
    try {
      ent.dispose();
    } finally {
      entities.delete(id);
      bus?.emit('entity:unregistered', { id, kind: ent.kind });
    }
    return true;
  }

  function updateAll(dt, ctx) {
    for (const ent of entities.values()) {
      if (ent.update) {
        ent.update(dt, ctx);
        assertFiniteTransform(ent.transform);
      }
    }
  }

  /** 3D-aware spatial query (enforces vertical separation so overhead flight never triggers ground entities) */
  function queryNear(pos, radiusM, { kinds = null, maxVerticalGap = Infinity } = {}) {
    const out = [];
    for (const ent of entities.values()) {
      if (kinds && !kinds.includes(ent.kind)) continue;
      const sep = separation3D(pos, ent.transform);
      if (sep.horiz <= radiusM && sep.verticalGap <= maxVerticalGap) {
        out.push({ entity: ent, ...sep });
      }
    }
    return out.sort((a, b) => a.dist3d - b.dist3d);
  }

  function disposeAll() {
    let count = 0;
    for (const id of [...entities.keys()]) {
      if (unregister(id)) count++;
    }
    return count;
  }

  return {
    register,
    unregister,
    get: (id) => entities.get(id) || null,
    byKind: (kind) => [...entities.values()].filter((e) => e.kind === kind),
    all: () => [...entities.values()],
    get count() { return entities.size; },
    updateAll,
    queryNear,
    disposeAll,
  };
}
