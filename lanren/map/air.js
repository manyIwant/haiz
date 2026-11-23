// The campus in the tree's light: one small shading layer for whatever building model stands
// on the campus (the Blender V3 massing today, the twin's higher-precision models later).
//
// Acts 01–04 are lit like a painting is lit: shade has a colour, distance has air. The campus
// buildings arrived in 05–06 without either: a sky-only ambient on white walls reads as flat
// grey-blue, and nothing returns the sun from the ground. Three habits fix that without
// stylising the geometry (no outlines, no paper, no blur):
//   1. coloured shade: the indirect light keeps its brightness but takes the sky's hue
//   2. ground bounce: sunlit paving lights the lower walls warmly (the scene has no GI)
//   3. contact: walls darken a little where they meet the ground
// Aerial perspective itself stays the world's height fog (scene.js), driven by LIGHT.
//
// Model-agnostic: it only needs world position and the lit result, so any MeshStandardMaterial
// patched through `airGLSL` gets it. One shared uniform set, staged once per frame.
import * as THREE from 'three';

export const AIR = {
  uHzSky: { value: new THREE.Color(0.3, 0.4, 0.6) },      // hue of the shade (linear)
  uHzBounce: { value: new THREE.Color(0, 0, 0) },         // sun returned by the ground (linear, already scaled)
  uHzAir: { value: 0 },                                   // 0 = the model as authored, 1 = in the tree's light
  uHzGround: { value: 0 }
};

const LUMA = 'vec3(0.2126, 0.7152, 0.0722)';
export const airGLSL = /* glsl */`
uniform vec3 uHzSky; uniform vec3 uHzBounce; uniform float uHzAir; uniform float uHzGround;
vec3 hzAir(vec3 lit, vec3 indirect, vec3 albedo, vec3 wn, vec3 wp) {
  if (uHzAir <= 0.0) return lit;
  float wall = 1.0 - smoothstep(0.55, 0.9, abs(wn.y));
  float h = max(wp.y - uHzGround, 0.0);
  // 1. the shade takes the sky's hue at the same brightness
  float li = dot(indirect, ${LUMA});
  vec3 tint = uHzSky / max(dot(uHzSky, ${LUMA}), 1e-4) * li;
  vec3 c = lit + (tint - indirect) * 0.75 * uHzAir;
  // 2. warm light returned by the sunlit ground, strongest low on a wall, fading up the storeys
  c += uHzBounce * albedo * wall * (0.3 + 0.7 * exp(-h / 7.0)) * uHzAir;
  // 3. contact where wall meets ground
  c *= mix(1.0, mix(0.72, 1.0, smoothstep(0.0, 2.4, h)), wall * uHzAir);
  return c;
}
`;

const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
/**
 * Stage the layer from the chapter light (chapters.js lightAt). `k` fades it in (0 … 1).
 * The shade hue is the sky between zenith and horizon (what a wall actually faces);
 * the bounce is the sun's colour × intensity × elevation × a paving albedo of ~0.3.
 */
export function stageAir(L, k, ground) {
  const z = L.zenith, hz = L.horizon;
  const sky = [0, 1, 2].map((i) => z[i] * 0.55 + hz[i] * 0.45);
  const n = lum(sky) || 1;
  AIR.uHzSky.value.setRGB(sky[0] / n, sky[1] / n, sky[2] / n);
  const el = Math.max(0, Math.sin(L.sunEl * Math.PI / 180));
  // low sun: the ground sees little of it but a wall sees much of the ground; keep a floor
  const b = 0.3 * L.I * (0.25 + 0.75 * el) * 0.12;
  AIR.uHzBounce.value.setRGB(L.sunCol[0] * b, L.sunCol[1] * b, L.sunCol[2] * b);
  AIR.uHzAir.value = Math.max(0, Math.min(1, k));
  if (ground != null) AIR.uHzGround.value = ground;
}
