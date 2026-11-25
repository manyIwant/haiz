// HAIZ World Engine — Unified Asset Registry & Deduplicated Loader Cache
//
// Guarantees zero duplicate asset downloads/loads across subsystems and exposes ONE
// canonical catalog for 51-joint human avatars, Campus Toybox V2 mascots, vehicles,
// campus creatures, and calibrated architecture assets.

export const ASSET_CATALOG = Object.freeze({
  // ---- 51-Joint MakeHuman CC0-Derived Campus Figures ----
  'char:student-m': { kind: 'avatar', path: 'lanren/assets/life/student-m.glb', rig: 'makehuman-51', lod: ['base'], maxBytes: 1_500_000 },
  'char:student-f': { kind: 'npc', path: 'lanren/assets/life/student-f.glb', rig: 'makehuman-51', lod: ['base'], maxBytes: 1_500_000 },
  'char:teacher-f': { kind: 'npc', path: 'lanren/assets/life/teacher-f.glb', rig: 'makehuman-51', lod: ['base'], maxBytes: 1_500_000 },
  'char:worker-m': { kind: 'npc', path: 'lanren/assets/life/worker-m.glb', rig: 'makehuman-51', lod: ['base'], maxBytes: 1_500_000 },

  // ---- Campus Toybox V2 Original Mascots (decoupled from human verification; ready for future display/world presence) ----
  'toybox:lanren-spirit': { kind: 'mascot', path: 'preview/human-verification-v2/assets/models/lanren-spirit.glb', rig: 'static-mascot', lod: ['base'], maxBytes: 350_000 },
  'toybox:sunshine-duck': { kind: 'mascot', path: 'preview/human-verification-v2/assets/models/sunshine-duck.glb', rig: 'static-mascot', lod: ['base'], maxBytes: 350_000 },
  'toybox:campus-cat': { kind: 'mascot', path: 'preview/human-verification-v2/assets/models/campus-cat.glb', rig: 'static-mascot', lod: ['base'], maxBytes: 350_000 },
  'toybox:schoolbag-bear': { kind: 'mascot', path: 'preview/human-verification-v2/assets/models/schoolbag-bear.glb', rig: 'static-mascot', lod: ['base'], maxBytes: 350_000 },
  'toybox:ocean-whale': { kind: 'mascot', path: 'preview/human-verification-v2/assets/models/ocean-whale.glb', rig: 'static-mascot', lod: ['base'], maxBytes: 350_000 },
  'toybox:hainan-fawn': { kind: 'mascot', path: 'preview/human-verification-v2/assets/models/hainan-fawn.glb', rig: 'static-mascot', lod: ['base'], maxBytes: 350_000 },

  // ---- Procedural Campus Vehicles & Creatures (shared logical IDs for world & multiplayer sync) ----
  'vehicle:bike': { kind: 'vehicle', path: 'lanren/free/vehicles.js#createBike', rig: 'procedural', lod: ['base'], maxBytes: 0 },
  'vehicle:board': { kind: 'vehicle', path: 'lanren/free/vehicles.js#createBoard', rig: 'procedural', lod: ['base'], maxBytes: 0 },
  'vehicle:broom': { kind: 'vehicle', path: 'lanren/free/vehicles.js#createBroom', rig: 'procedural', lod: ['base'], maxBytes: 0 },
  'creature:campus-cat': { kind: 'creature', path: 'lanren/ruhua/eco/cat.js#createCat', rig: 'procedural-ik', lod: ['base'], maxBytes: 0 },
  'creature:butterflies': { kind: 'creature', path: 'lanren/ruhua/eco/butterflies.js#createButterflies', rig: 'instanced', lod: ['base'], maxBytes: 0 },
});

export function createAssetRegistry() {
  const entries = new Map();
  let cacheHits = 0;
  let cacheMisses = 0;

  /** Deduplicated async resource acquisition by canonical key/URL */
  async function acquire(key, loaderFn, { disposeFn = null } = {}) {
    const existing = entries.get(key);
    if (existing) {
      existing.refs++;
      cacheHits++;
      return existing.promise;
    }
    cacheMisses++;
    const record = {
      key,
      refs: 1,
      disposed: false,
      value: null,
      disposeFn,
      promise: null,
    };
    record.promise = Promise.resolve()
      .then(() => loaderFn(key))
      .then((val) => {
        record.value = val;
        return val;
      })
      .catch((err) => {
        entries.delete(key);
        throw err;
      });
    entries.set(key, record);
    return record.promise;
  }

  function release(key) {
    const rec = entries.get(key);
    if (!rec) return false;
    rec.refs = Math.max(0, rec.refs - 1);
    if (rec.refs === 0 && !rec.disposed) {
      rec.disposed = true;
      try {
        if (typeof rec.disposeFn === 'function') rec.disposeFn(rec.value);
        else if (typeof rec.value?.dispose === 'function') rec.value.dispose();
      } finally {
        entries.delete(key);
      }
      return true;
    }
    return false;
  }

  function disposeAll() {
    let disposedCount = 0;
    for (const [key, rec] of [...entries.entries()]) {
      if (!rec.disposed) {
        rec.disposed = true;
        try {
          if (typeof rec.disposeFn === 'function') rec.disposeFn(rec.value);
          else if (typeof rec.value?.dispose === 'function') rec.value.dispose();
        } catch (err) {
          console.warn(`[AssetRegistry] dispose failed for ${key}:`, err);
        }
        disposedCount++;
      }
      entries.delete(key);
    }
    return disposedCount;
  }

  function stats() {
    return {
      activeCount: entries.size,
      cacheHits,
      cacheMisses,
      keys: [...entries.keys()],
    };
  }

  return {
    catalog: ASSET_CATALOG,
    getMeta: (id) => ASSET_CATALOG[id] || null,
    acquire,
    release,
    disposeAll,
    stats,
  };
}
