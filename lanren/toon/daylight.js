// Time of day. The reference holds two moods in one walk — a clear late morning (saturated greens,
// deep blue sky, white cumulus) and a golden hour (warm low sun, lavender shade and clouds, pink
// air) — so the walk offers both, plus an early morning, and moves between them smoothly.
// Colours are linear and HDR (the grade pass tone-maps). Values come from sampling the reference's
// keyframes (docs/toon-campus-style-20261116.md §2) and were then balanced by eye on the campus.
import * as THREE from 'three';
import { TOON } from './toon.js';
import { SKY } from './sky.js';

const c = (r, g, b) => new THREE.Color(r, g, b);
export const PRESETS = {
  morning: {
    label: '清晨', elev: 16, azim: 112,
    sun: c(2.25, 1.78, 1.3), skyAmb: c(0.52, 0.6, 0.9), groundAmb: c(0.38, 0.36, 0.26), shadeTint: c(0.95, 0.97, 1.08),
    rim: c(1.0, 0.82, 0.62), fog: c(0.72, 0.76, 0.86), fogSun: c(1.15, 0.95, 0.75), density: 0.0021,
    zenith: c(0.16, 0.36, 0.68), cloudLit: c(1.1, 1.0, 0.9), cloudMid: c(0.8, 0.8, 0.88), cloudShade: c(0.55, 0.58, 0.74), cloudRim: c(1.3, 1.05, 0.8),
    cover: 0.45, cloudShadow: 0.35, exposure: 1.0, sat: 1.1,
  },
  noon: {
    label: '正午', elev: 56, azim: 150,
    sun: c(2.0, 1.92, 1.78), skyAmb: c(0.5, 0.66, 1.02), groundAmb: c(0.4, 0.42, 0.28), shadeTint: c(0.92, 0.96, 1.1),
    rim: c(1.0, 0.95, 0.85), fog: c(0.58, 0.76, 0.93), fogSun: c(0.95, 0.95, 0.92), density: 0.0015,
    zenith: c(0.07, 0.34, 0.72), cloudLit: c(1.12, 1.12, 1.1), cloudMid: c(0.82, 0.88, 0.97), cloudShade: c(0.5, 0.6, 0.8), cloudRim: c(1.2, 1.2, 1.15),
    cover: 0.55, cloudShadow: 0.42, exposure: 1.0, sat: 1.12,
  },
  golden: {
    label: '傍晚', elev: 8, azim: 252,
    sun: c(2.4, 1.42, 0.74), skyAmb: c(0.52, 0.46, 0.8), groundAmb: c(0.28, 0.24, 0.2), shadeTint: c(1.0, 0.94, 1.12),
    rim: c(1.3, 0.75, 0.45), fog: c(0.6, 0.48, 0.58), fogSun: c(1.35, 0.85, 0.5), density: 0.0024,
    zenith: c(0.3, 0.3, 0.56), cloudLit: c(1.35, 0.95, 0.72), cloudMid: c(0.66, 0.52, 0.7), cloudShade: c(0.36, 0.3, 0.52), cloudRim: c(1.8, 1.15, 0.7),
    cover: 0.62, cloudShadow: 0.3, exposure: 1.05, sat: 1.08,
  },
};

export function createDaylight(scene, renderer, { shadowSize = 2048, shadowBox = 70 } = {}) {
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  const cam = sun.shadow.camera;
  cam.left = -shadowBox; cam.right = shadowBox; cam.top = shadowBox; cam.bottom = -shadowBox;
  cam.near = 1; cam.far = 600;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.06;
  sun.shadow.radius = 2.5;
  scene.add(sun, sun.target);

  let from = null, to = PRESETS.noon, t = 1, name = 'noon';
  const cur = {};
  const keysColor = ['sun', 'skyAmb', 'groundAmb', 'shadeTint', 'rim', 'fog', 'fogSun', 'zenith', 'cloudLit', 'cloudMid', 'cloudShade', 'cloudRim'];
  const keysNum = ['elev', 'azim', 'density', 'cover', 'cloudShadow', 'exposure', 'sat'];
  for (const k of keysColor) cur[k] = new THREE.Color();
  const dir = new THREE.Vector3();

  function apply(p) {
    TOON.uSunColor.value.copy(p.sun);
    TOON.uSkyAmb.value.copy(p.skyAmb);
    TOON.uGroundAmb.value.copy(p.groundAmb);
    TOON.uShadeTint.value.copy(p.shadeTint);
    TOON.uRimColor.value.copy(p.rim);
    TOON.uFogColor.value.copy(p.fog);
    TOON.uFogSun.value.copy(p.fogSun);
    TOON.uFogDensity.value = p.density;
    TOON.uCloudCover.value = p.cover;
    TOON.uCloudShadow.value = p.cloudShadow;
    SKY.uZenith.value.copy(p.zenith);
    SKY.uCloudLit.value.copy(p.cloudLit);
    SKY.uCloudMid.value.copy(p.cloudMid);
    SKY.uCloudShade.value.copy(p.cloudShade);
    SKY.uCloudRim.value.copy(p.cloudRim);
    const e = p.elev * Math.PI / 180, a = p.azim * Math.PI / 180;
    dir.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).normalize();
    TOON.uSunDir.value.copy(dir);
  }
  function blend(a, b, k) {
    for (const key of keysColor) cur[key].copy(a[key]).lerp(b[key], k);
    for (const key of keysNum) cur[key] = a[key] + (b[key] - a[key]) * k;
    // azimuth the short way round
    let da = b.azim - a.azim; while (da > 180) da -= 360; while (da < -180) da += 360;
    cur.azim = a.azim + da * k;
    return cur;
  }
  apply(to);

  return {
    sun,
    get name() { return name; },
    get grade() { return t >= 1 ? to : cur; },
    set(n, instant = false) {
      if (!PRESETS[n]) return;
      name = n;
      from = t >= 1 ? { ...to } : { ...cur, ...Object.fromEntries(keysColor.map((k) => [k, cur[k].clone()])) };
      to = PRESETS[n];
      t = instant ? 1 : 0;
      if (instant) apply(to);
    },
    /** follow a focus point with the shadow box (snapped to texels so shadows do not swim) */
    update(dt, focus) {
      if (t < 1) {
        t = Math.min(1, t + dt / 2.2);
        const k = t * t * (3 - 2 * t);
        apply(blend(from, to, k));
      }
      const texel = (2 * shadowBox) / shadowSize;
      const fx = Math.round(focus.x / texel) * texel, fz = Math.round(focus.z / texel) * texel;
      sun.target.position.set(fx, focus.y, fz);
      sun.position.set(fx + dir.x * 250, focus.y + dir.y * 250, fz + dir.z * 250);
      sun.target.updateMatrixWorld();
    },
  };
}
