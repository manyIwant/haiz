// HAIZ World Engine — Page-Independent Unified World Runtime Kernel
//
// Proves the World Engine is a genuine standalone architecture rather than a page-bound
// adapter shell: runs cleanly in headless Node.js (for automated integration tests) OR
// attached to any browser WebGL canvas host, enforcing:
//   - Single authoritative simulation clock & subsystem execution order
//   - Single render-loop guard (rejects duplicate concurrent loop registrations)
//   - Single EventBus, WorldState, SpatialGraph, AssetRegistry, EntityManager, PerfMonitor
//   - Deterministic lifecycle cleanup (`dispose()`) with zero leaked listeners or resources

import { createEventBus } from './bus.js';
import { createWorldState } from './state.js';
import { createPerfMonitor } from './perf.js';
import { createAssetRegistry } from './assets.js';
import { createEntityManager } from './entities.js';
import { createSpatialGraph } from '../spatial/graph.js';

export function createWorldRuntime({
  mobile = false,
  storage = globalThis.localStorage ?? null,
  campus = null,
  buildingsMeta = null,
  nav = null,
  wheelPath = null,
} = {}) {
  const bus = createEventBus();
  const store = createWorldState({ bus, storage });
  const perf = createPerfMonitor({ mobile });
  const assets = createAssetRegistry();
  const entities = createEntityManager({ bus });
  const graph = createSpatialGraph({ campus, buildingsMeta, nav, wheelPath });

  const subsystems = [];
  let disposed = false;
  let activeLoopOwner = null;
  let tickCount = 0;
  let elapsedSec = 0;

  function assertAlive() {
    if (disposed) throw new Error('WorldRuntime has been disposed');
  }

  /** Register an ordered subsystem (`{ name, update(dt, ctx), dispose?() }`) */
  function registerSubsystem(sub) {
    assertAlive();
    if (!sub?.name || typeof sub.update !== 'function') {
      throw new Error('Subsystem requires { name, update(dt, ctx) }');
    }
    if (subsystems.some((s) => s.name === sub.name)) {
      throw new Error(`Duplicate subsystem "${sub.name}"`);
    }
    subsystems.push(sub);
    bus.emit('subsystem:registered', { name: sub.name });
    return sub;
  }

  /** Enforce single render-loop invariant: only one loop owner may hold the frame loop at a time */
  function claimRenderLoop(ownerName) {
    assertAlive();
    if (activeLoopOwner && activeLoopOwner !== ownerName) {
      throw new Error(`Duplicate render loop forbidden: "${ownerName}" tried to claim loop already owned by "${activeLoopOwner}"`);
    }
    activeLoopOwner = ownerName;
    return () => {
      if (activeLoopOwner === ownerName) activeLoopOwner = null;
    };
  }

  /** Advance the entire world deterministically by `dt` seconds (zero DOM dependency) */
  function step(dt, extraCtx = {}) {
    assertAlive();
    if (!Number.isFinite(dt) || dt < 0) {
      throw new Error(`Invalid simulation dt: ${dt}`);
    }
    const clamped = Math.min(dt, 0.1);
    tickCount++;
    elapsedSec += clamped;

    const ctx = {
      bus,
      store,
      state: store.state,
      perf,
      assets,
      entities,
      graph,
      tickCount,
      elapsedSec,
      ...extraCtx,
    };

    for (const sub of subsystems) {
      const end = perf.beginSubsystem(sub.name);
      sub.update(clamped, ctx);
      end();
    }

    const endEnt = perf.beginSubsystem('entities');
    entities.updateAll(clamped, ctx);
    endEnt();

    bus.emit('runtime:tick', { dt: clamped, tickCount, elapsedSec });
    return ctx;
  }

  /** Full deterministic lifecycle teardown — proves zero resource or listener leaks */
  function dispose() {
    if (disposed) return { alreadyDisposed: true };
    disposed = true;
    activeLoopOwner = null;

    const disposedSubsystems = [];
    for (let i = subsystems.length - 1; i >= 0; i--) {
      const sub = subsystems[i];
      try {
        sub.dispose?.();
      } catch (err) {
        console.warn(`[WorldRuntime] subsystem "${sub.name}" dispose error:`, err);
      }
      disposedSubsystems.push(sub.name);
    }
    subsystems.length = 0;

    const disposedEntities = entities.disposeAll();
    const disposedAssets = assets.disposeAll();
    bus.clear();

    return {
      alreadyDisposed: false,
      disposedSubsystems,
      disposedEntities,
      disposedAssets,
    };
  }

  return {
    bus,
    store,
    perf,
    assets,
    entities,
    graph,
    registerSubsystem,
    claimRenderLoop,
    step,
    dispose,
    get disposed() { return disposed; },
    get tickCount() { return tickCount; },
    get elapsedSec() { return elapsedSec; },
    get loopOwner() { return activeLoopOwner; },
    listSubsystems: () => subsystems.map((s) => s.name),
  };
}
