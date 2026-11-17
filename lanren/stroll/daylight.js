// Three worlds, not three sun angles.
//   清晨  clear, cool air with a low mist in the distance; a soft gold sun low in the east; long soft
//         shadows; calm wind; pale sky with a warm glow where the sun is
//   正午  a high sun, short crisp shadows, deep blue shade and sky; bright but held back (the grade
//         keeps the paving from going white); towering cumulus; the strongest gusts
//   傍晚  warm light raking low through the crowns, lavender shade, pink air, clouds lit from behind
// Linear HDR values; the grade tone-maps. Chosen by eye on the campus against the reference's
// sampled palette (docs/toon-campus-style-20261116.md §1), not copied from it.
//
// Sun path: Haikou (20°N) in mid November — sunrise near bearing 108°, noon due south at ~51°,
// sunset near 252°. assets/walk/campus.json says the campus grid is turned ~41.4° from true north
// but not which way; this walk assumes campus north = true bearing 41.4° west of north (unverified,
// docs/stroll-v2-20261116.md). In campus azimuth (0 = +Z, 90 = +X): sunrise ≈ 31°, noon ≈ −41°,
// sunset ≈ −113°. The 清晨 and 傍晚 elevations are moments shortly after sunrise and before sunset.
import * as THREE from 'three';
import { U } from './atmos.js';
import { SKY } from './sky.js';

const c = (r, g, b) => new THREE.Color(r, g, b);
export const MOODS = {
  morning: {
    label: '清晨', elev: 13, azim: 31,
    sun: c(1.95, 1.58, 1.16), skyAmb: c(0.56, 0.64, 1.1), groundAmb: c(0.44, 0.44, 0.56), rim: c(1.2, 0.88, 0.6),
    zenith: c(0.14, 0.36, 0.74), horizon: c(0.86, 0.84, 0.82), sunGlow: c(1.45, 1.02, 0.64),
    depthTint: 0.4, depthCol: c(0.9, 0.95, 1.08), air: 1 / 560, falloff: 0.045, mist: 0.2,
    cloudLit: c(1.15, 1.0, 0.86), cloudMid: c(0.82, 0.82, 0.9), cloudShade: c(0.56, 0.6, 0.76), cloudRim: c(1.4, 1.1, 0.8),
    shadeHue: c(0.66, 0.68, 1.0), shadeMix: 0.26,
    cover: 0.4, cloudShadow: 0.25, cirrus: 0.6, gust: 0.6, windSpeed: 2.6, exposure: 1.02, sat: 1.04, shadowRadius: 4, bloom: 0.22,
  },
  noon: {
    label: '正午', elev: 51, azim: -41,
    sun: c(1.8, 1.73, 1.6), skyAmb: c(0.6, 0.69, 1.2), groundAmb: c(0.46, 0.48, 0.6), rim: c(1.0, 0.95, 0.85),
    zenith: c(0.05, 0.25, 0.65), horizon: c(0.6, 0.78, 0.94), sunGlow: c(1.05, 1.02, 0.95),
    depthTint: 0.35, depthCol: c(0.9, 0.96, 1.07), air: 1 / 750, falloff: 0.02, mist: 0,
    cloudLit: c(1.14, 1.13, 1.1), cloudMid: c(0.74, 0.81, 0.93), cloudShade: c(0.42, 0.51, 0.72), cloudRim: c(1.2, 1.2, 1.15),
    shadeHue: c(0.6, 0.67, 1.0), shadeMix: 0.3,
    cover: 0.55, cloudShadow: 0.38, cirrus: 0.25, gust: 1.0, windSpeed: 4.2, exposure: 0.95, sat: 1.03, shadowRadius: 1.5, bloom: 0.16,
  },
  golden: {
    label: '傍晚', elev: 7, azim: -113,
    sun: c(2.4, 1.4, 0.7), skyAmb: c(0.56, 0.48, 0.86), groundAmb: c(0.42, 0.34, 0.36), rim: c(1.4, 0.8, 0.45),
    zenith: c(0.22, 0.24, 0.5), horizon: c(0.86, 0.62, 0.58), sunGlow: c(1.55, 0.92, 0.5),
    depthTint: 0.45, depthCol: c(0.96, 0.9, 1.06), air: 1 / 480, falloff: 0.03, mist: 0.12,
    cloudLit: c(1.4, 0.95, 0.7), cloudMid: c(0.68, 0.54, 0.7), cloudShade: c(0.38, 0.32, 0.54), cloudRim: c(1.9, 1.2, 0.7),
    shadeHue: c(0.74, 0.6, 0.96), shadeMix: 0.3,
    cover: 0.6, cloudShadow: 0.25, cirrus: 0.5, gust: 0.75, windSpeed: 3.2, exposure: 1.05, sat: 1.05, shadowRadius: 2.5, bloom: 0.3,
  },
};
const COLORS = ['shadeHue', 'sun', 'skyAmb', 'groundAmb', 'rim', 'zenith', 'horizon', 'sunGlow', 'depthCol', 'cloudLit', 'cloudMid', 'cloudShade', 'cloudRim'];
const NUMS = ['shadeMix', 'elev', 'depthTint', 'air', 'falloff', 'mist', 'cover', 'cloudShadow', 'cirrus', 'gust', 'windSpeed', 'exposure', 'sat', 'shadowRadius', 'bloom'];

export function createDaylight(scene, { shadowSize = 2048, shadowBox = 55 } = {}) {
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  const cam = sun.shadow.camera;
  cam.left = -shadowBox; cam.right = shadowBox; cam.top = shadowBox; cam.bottom = -shadowBox;
  cam.near = 1; cam.far = 700;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);
  const cur = {};
  for (const k of COLORS) cur[k] = new THREE.Color();
  let from = null, to = MOODS.noon, t = 1, name = 'noon';
  const dir = new THREE.Vector3();
  const lightDir = new THREE.Vector3();

  function apply(p) {
    U.uShadeHue.value.copy(p.shadeHue); U.uShadeMix.value = p.shadeMix;
    U.uSunColor.value.copy(p.sun); U.uSkyAmb.value.copy(p.skyAmb); U.uGroundAmb.value.copy(p.groundAmb); U.uRim.value.copy(p.rim);
    U.uZenith.value.copy(p.zenith); U.uHorizon.value.copy(p.horizon); U.uSunGlow.value.copy(p.sunGlow); U.uDepthCol.value.copy(p.depthCol);
    U.uDepthTint.value = p.depthTint; U.uAirScale.value = p.air; U.uFogFalloff.value = p.falloff; U.uMist.value = p.mist;
    U.uCloudCover.value = p.cover; U.uCloudShadow.value = p.cloudShadow; U.uWindGust.value = p.gust; U.uWindSpeed.value = p.windSpeed;
    SKY.uCloudLit.value.copy(p.cloudLit); SKY.uCloudMid.value.copy(p.cloudMid); SKY.uCloudShade.value.copy(p.cloudShade); SKY.uCloudRim.value.copy(p.cloudRim);
    SKY.uCirrus.value = p.cirrus;
    sun.shadow.radius = p.shadowRadius;
    const e = p.elev * Math.PI / 180, a = p.azim * Math.PI / 180;
    dir.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).normalize();
    U.uSunDir.value.copy(dir);
    // the shadow-casting light never goes below 10° (a 7° sun makes 8× long, shimmering shadows)
    lightDir.copy(dir); lightDir.y = Math.max(lightDir.y, 0.17); lightDir.normalize();
  }
  function blend(a, b, k) {
    for (const key of COLORS) cur[key].copy(a[key]).lerp(b[key], k);
    for (const key of NUMS) cur[key] = a[key] + (b[key] - a[key]) * k;
    let da = b.azim - a.azim; while (da > 180) da -= 360; while (da < -180) da += 360;
    cur.azim = a.azim + da * k;
    return cur;
  }
  apply(to);
  // 入画: a continuous light (lanren/ruhua/weather/model.js palette) instead of the three moods
  let ext = null;
  const setC = (c, v) => (Array.isArray(v) ? c.setRGB(v[0], v[1], v[2]) : c.copy(v));
  function applyParams(p) {
    ext = p;
    setC(U.uShadeHue.value, p.shadeHue); U.uShadeMix.value = p.shadeMix;
    setC(U.uSunColor.value, p.sun); setC(U.uSkyAmb.value, p.skyAmb); setC(U.uGroundAmb.value, p.groundAmb); setC(U.uRim.value, p.rim);
    setC(U.uZenith.value, p.zenith); setC(U.uHorizon.value, p.horizon); setC(U.uSunGlow.value, p.sunGlow); setC(U.uDepthCol.value, p.depthCol);
    U.uDepthTint.value = p.depthTint; U.uAirScale.value = p.air; U.uFogFalloff.value = p.falloff; U.uMist.value = p.mist;
    U.uCloudShadow.value = p.cloudShadow;
    setC(SKY.uCloudLit.value, p.cloudLit); setC(SKY.uCloudMid.value, p.cloudMid); setC(SKY.uCloudShade.value, p.cloudShade); setC(SKY.uCloudRim.value, p.cloudRim);
    sun.shadow.radius = p.shadowRadius;
    dir.set(p.dir[0], p.dir[1], p.dir[2]).normalize();
    U.uSunDir.value.copy(dir);
    lightDir.copy(dir); lightDir.y = Math.max(lightDir.y, 0.17); lightDir.normalize();
  }
  return {
    sun,
    applyParams,
    get name() { return ext ? 'live' : name; },
    get mood() { return ext || (t >= 1 ? to : cur); },
    set(n, instant = false) {
      if (!MOODS[n]) return;
      ext = null;
      name = n;
      from = t >= 1 ? { ...to } : { ...cur, ...Object.fromEntries(COLORS.map((k) => [k, cur[k].clone()])) };
      to = MOODS[n];
      t = instant ? 1 : 0;
      if (instant) apply(to);
    },
    update(dt, focus) {
      if (t < 1) {
        t = Math.min(1, t + dt / 2.5);
        apply(blend(from, to, t * t * (3 - 2 * t)));
      }
      const texel = (2 * shadowBox) / shadowSize;
      const fx = Math.round(focus.x / texel) * texel, fz = Math.round(focus.z / texel) * texel;
      sun.target.position.set(fx, focus.y, fz);
      sun.position.set(fx + lightDir.x * 300, focus.y + lightDir.y * 300, fz + lightDir.z * 300);
      sun.target.updateMatrixWorld();
    },
  };
}
