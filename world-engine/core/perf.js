// HAIZ World Engine — Real-Time Telemetry & Performance Budget Monitor
// Measures per-subsystem CPU time, rolling P50/P95 frame intervals, draw calls,
// triangles, and GPU memory objects against executable performance budgets.

export const BUDGETS = Object.freeze({
  desktop: {
    maxDrawCalls: 720,
    maxTriangles: 5_200_000,
    maxGeometries: 650,
    maxTextures: 180,
    targetFrameMs: 16.7,
    maxSubsystemCpuMs: 8.0,
  },
  mobile: {
    maxDrawCalls: 620,
    maxTriangles: 4_200_000,
    maxGeometries: 580,
    maxTextures: 160,
    targetFrameMs: 33.3,
    maxSubsystemCpuMs: 12.0,
  },
});

export function createPerfMonitor({ mobile = false, windowSize = 90 } = {}) {
  const budget = mobile ? BUDGETS.mobile : BUDGETS.desktop;
  const frameSamples = [];
  const subsystemMs = new Map();
  let lastRender = { calls: 0, triangles: 0, geometries: 0, textures: 0, programs: 0 };
  let frameCount = 0;

  function beginSubsystem(name) {
    const t0 = performance.now();
    return () => {
      const elapsed = performance.now() - t0;
      const prev = subsystemMs.get(name) ?? elapsed;
      subsystemMs.set(name, prev * 0.88 + elapsed * 0.12);
    };
  }

  function recordFrame(rawDtMs, renderer) {
    frameCount++;
    frameSamples.push(rawDtMs);
    if (frameSamples.length > windowSize) frameSamples.shift();
    if (renderer?.info) {
      lastRender = {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        programs: renderer.info.programs?.length || 0,
      };
    }
  }

  function percentile(arr, p) {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
    return sorted[idx];
  }

  function snapshot() {
    const p50 = percentile(frameSamples, 0.5);
    const p95 = percentile(frameSamples, 0.95);
    const fps = p50 > 0 ? Math.min(120, 1000 / p50) : 0;
    const subsystems = {};
    let totalCpuMs = 0;
    for (const [k, v] of subsystemMs.entries()) {
      subsystems[k] = +v.toFixed(2);
      totalCpuMs += v;
    }

    const checks = {
      drawCallsOk: lastRender.calls <= budget.maxDrawCalls,
      trianglesOk: lastRender.triangles <= budget.maxTriangles,
      geometriesOk: lastRender.geometries <= budget.maxGeometries,
      texturesOk: lastRender.textures <= budget.maxTextures,
      cpuOk: totalCpuMs <= budget.maxSubsystemCpuMs,
    };

    return {
      profile: mobile ? 'mobile' : 'desktop',
      frames: frameCount,
      fps: +fps.toFixed(1),
      p50Ms: +p50.toFixed(1),
      p95Ms: +p95.toFixed(1),
      totalCpuMs: +totalCpuMs.toFixed(2),
      subsystems,
      render: { ...lastRender },
      budget,
      checks,
      allHardwareIndependentBudgetsOk:
        checks.drawCallsOk && checks.trianglesOk && checks.geometriesOk && checks.texturesOk,
    };
  }

  return {
    beginSubsystem,
    recordFrame,
    snapshot,
    budget,
  };
}
