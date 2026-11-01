/* Pure campus V3 helpers. Rendering and collision remain runtime responsibilities. */
(function (root) {
  'use strict';
  const WALK_SPEED = 3.1, RUN_SPEED = 5.8;
  const ACCELERATION = 10, BRAKING = 14, MAX_DT = .1, MAX_STEP = .24;
  const EPSILON = 1e-9;
  const TIERS = {
    high: { dprCap: 1.65, shadowSize: 2048, shadowRadius: 58, vegetationDistance: 280, anisotropy: 8, maxFps: 60 },
    balanced: { dprCap: 1.2, shadowSize: 1024, shadowRadius: 45, vegetationDistance: 190, anisotropy: 4, maxFps: 45 },
    low: { dprCap: .85, shadowSize: 0, shadowRadius: 0, vegetationDistance: 110, anisotropy: 2, maxFps: 30 },
  };
  const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  /**
   * @param {unknown} tier
   * @param {number} [devicePixelRatio=1]
   * @returns {{tier:string,dprCap:number,pixelRatio:number,shadowSize:number,shadowRadius:number,vegetationDistance:number,anisotropy:number,maxFps:number}}
   */
  function qualityConfig(tier, devicePixelRatio = 1) {
    const selected = typeof tier === 'string' && Object.hasOwn(TIERS, tier) ? tier : 'balanced';
    const preset = TIERS[selected];
    const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
    return { tier: selected, ...preset, pixelRatio: Math.min(ratio, preset.dprCap) };
  }

  /**
   * Analytical exponential motion; release brakes, held input approaches desired velocity.
   * Input y is forward, and yaw zero faces negative Z, matching CampusMotion.
   * @param {{velocity?:{x?:number,z?:number}}} state
   * @param {{x?:number,y?:number,run?:boolean,speedScale?:number}} input
   * @param {number} yaw
   * @param {number} seconds
   * @returns {{velocity:{x:number,z:number},delta:{x:number,z:number}}}
   */
  function stepMotion(state, input, yaw, seconds) {
    const vx = finite(state?.velocity?.x), vz = finite(state?.velocity?.z);
    const dt = clamp(finite(seconds), 0, MAX_DT);
    if (!dt) return { velocity: { x: vx, z: vz }, delta: { x: 0, z: 0 } };
    const x = finite(input?.x), y = finite(input?.y), norm = Math.max(1, Math.hypot(x, y));
    const speed = (input?.run === true ? RUN_SPEED : WALK_SPEED) * Math.max(0, finite(input?.speedScale, 1));
    const angle = finite(yaw), cos = Math.cos(angle), sin = Math.sin(angle);
    const desiredX = (cos * (x / norm) - sin * (y / norm)) * speed;
    const desiredZ = (-sin * (x / norm) - cos * (y / norm)) * speed;
    const rate = Math.hypot(desiredX, desiredZ) > 0 ? ACCELERATION : BRAKING;
    const blend = -Math.expm1(-rate * dt), integral = blend / rate;
    return {
      velocity: { x: vx + (desiredX - vx) * blend, z: vz + (desiredZ - vz) * blend },
      delta: { x: desiredX * dt + (vx - desiredX) * integral, z: desiredZ * dt + (vz - desiredZ) * integral },
    };
  }

  /** @param {object} surface @param {number} x @param {number} z @returns {number|null} */
  function surfaceHeight(surface, x, z) {
    if (!surface || ![surface.minX, surface.maxX, surface.minZ, surface.maxZ].every(Number.isFinite)) return null;
    if (surface.minX > surface.maxX || surface.minZ > surface.maxZ) return null;
    if (x < surface.minX || x > surface.maxX || z < surface.minZ || z > surface.maxZ) return null;
    if (!surface.from && !surface.to) return Number.isFinite(surface.height) ? surface.height : null;
    const from = surface.from, to = surface.to;
    if (!from || !to || ![from.x, from.z, from.y, to.x, to.z, to.y].every(Number.isFinite)) return null;
    const dx = to.x - from.x, dz = to.z - from.z, lengthSquared = dx * dx + dz * dz;
    if (lengthSquared <= EPSILON) return null;
    const progress = clamp(((x - from.x) * dx + (z - from.z) * dz) / lengthSquared, 0, 1);
    return from.y + (to.y - from.y) * progress;
  }

  /**
   * Ramp endpoints use {x,z,y}; flat rectangles use height. Call for every movement
   * substep: jumps exceeding MAX_STEP retain previousHeight, including unsupported gaps.
   * @param {number} x
   * @param {number} z
   * @param {Array<{minX:number,maxX:number,minZ:number,maxZ:number,height?:number,from?:{x:number,z:number,y:number},to?:{x:number,z:number,y:number}}>} surfaces
   * @param {number} [previousHeight=0]
   * @returns {number}
   */
  function floorHeight(x, z, surfaces, previousHeight = 0) {
    const previous = finite(previousHeight);
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Array.isArray(surfaces)) return previous;
    const height = surfaces.reduce((highest, surface) => {
      const candidate = surfaceHeight(surface, x, z);
      if (candidate === null || Math.abs(candidate - previous) > MAX_STEP + EPSILON) return highest;
      return highest === null ? candidate : Math.max(highest, candidate);
    }, null);
    return height === null ? previous : height;
  }

  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const allowedKey = key => !['__proto__', 'constructor', 'prototype'].includes(key) && !/bloom/i.test(key);
  function blendValue(from, to, progress) {
    if (Number.isFinite(from) || Number.isFinite(to)) {
      const start = finite(from, to), end = finite(to, from);
      return start + (end - start) * progress;
    }
    if (Array.isArray(from) || Array.isArray(to)) {
      const start = Array.isArray(from) ? from : [], end = Array.isArray(to) ? to : [];
      return Array.from({ length: Math.max(start.length, end.length) }, (_, i) => blendValue(start[i], end[i], progress));
    }
    if (!record(from) && !record(to)) return undefined;
    const start = record(from) ? from : {}, end = record(to) ? to : {};
    const keys = [...new Set([...Object.keys(start), ...Object.keys(end)])].filter(allowedKey);
    return Object.fromEntries(keys.map(key => [key, blendValue(start[key], end[key], progress)])
      .filter(([, value]) => value !== undefined));
  }

  /**
   * Blend finite numeric fields, vector arrays and nested numeric records. Supply
   * colors as numeric channels in a common color space. Metadata and bloom are omitted.
   * @param {object} from
   * @param {object} to
   * @param {number} progress
   * @returns {object}
   */
  function blendClimate(from, to, progress) {
    return blendValue(record(from) ? from : {}, record(to) ? to : {}, clamp(finite(progress), 0, 1));
  }

  root.HaizV3Core = Object.freeze({ qualityConfig, stepMotion, floorHeight, blendClimate });
})(window);
