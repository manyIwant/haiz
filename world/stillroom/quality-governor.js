/* HAIZ STILLROOM - adaptive ambient quality. No dependencies or telemetry. */
(function attachQualityGovernor(root) {
  'use strict';
  const levels = ['low', 'medium', 'high'];
  const valid = (value) => levels.includes(value) ? value : 'medium';
  function createQualityGovernor({
    initial = 'medium',
    ceiling = initial,
    windowMs = 1600,
    onChange = () => {}
  } = {}) {
    let cap = levels.indexOf(valid(ceiling));
    let level = Math.min(cap, levels.indexOf(valid(initial)));
    let previous = null;
    let frameMs = 0;
    let frames = 0;
    let slowWindows = 0;
    let fastWindows = 0;
    const windowLength = Math.max(1000, windowMs);
    const name = () => levels[level];
    function clearSample(resetStreak = false) {
      frameMs = 0;
      frames = 0;
      if (resetStreak) {
        slowWindows = 0;
        fastWindows = 0;
      }
    }
    function emit(next, reason, fps) {
      if (next === level) return;
      level = next;
      clearSample(true);
      onChange(name(), { reason, fps });
    }
    function reset() {
      previous = null;
      clearSample(true);
    }
    function sample(timestamp, active = true) {
      if (!active || !Number.isFinite(timestamp)) {
        reset();
        return name();
      }
      if (previous === null) {
        previous = timestamp;
        return name();
      }
      const dt = timestamp - previous;
      previous = timestamp;
      // Background throttling, resume and clock anomalies are not poor device performance.
      if (dt <= 0 || dt > 250) {
        reset();
        previous = timestamp;
        return name();
      }
      frames += 1;
      frameMs += dt;
      if (frameMs < windowLength) return name();
      const fps = frames * 1000 / frameMs;
      clearSample();
      if (fps < 36) {
        slowWindows++;
        fastWindows = 0;
      } else if (fps >= 54) {
        fastWindows++;
        slowWindows = 0;
      } else {
        slowWindows = 0;
        fastWindows = 0;
      }
      // Fast degradation avoids sustained jank; deliberately slow recovery avoids flicker.
      if (slowWindows >= 2 && level > 0) emit(level - 1, 'sustained-low-fps', fps);
      else if (fastWindows >= 7 && level < cap) emit(level + 1, 'sustained-headroom', fps);
      return name();
    }
    function setCeiling(value) {
      cap = levels.indexOf(valid(value));
      reset();
      if (level > cap) emit(cap, 'device-preference', null);
      return name();
    }
    return { sample, reset, setCeiling, getLevel: name, getCeiling: () => levels[cap] };
  }
  root.HAIZQualityGovernor = Object.freeze({ createQualityGovernor });
})(typeof globalThis === 'object' ? globalThis : this);
