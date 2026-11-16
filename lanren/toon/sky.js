// The painted sky: a gradient from the zenith to the shared horizon colour (the same colour the air
// fades everything into, so buildings and trees dissolve into the sky as in the reference), the sun,
// and cumulus drawn the way background painters draw them: flat masses with a crisp edge, a lit
// top, a cool shaded underside and a thin bright rim toward the sun. Two layers: an overhead deck
// projected on a plane, and a bank of towering clouds standing on the horizon.
import * as THREE from 'three';
import { TOON, GLSL_COMMON } from './toon.js';

export const SKY = {
  uZenith: { value: new THREE.Color(0.08, 0.36, 0.72) },
  uCloudLit: { value: new THREE.Color(1.05, 1.03, 1.0) },
  uCloudMid: { value: new THREE.Color(0.78, 0.84, 0.94) },
  uCloudShade: { value: new THREE.Color(0.52, 0.6, 0.78) },
  uCloudRim: { value: new THREE.Color(1.2, 1.15, 1.05) },
  uSunDisc: { value: 6.0 },
  uBank: { value: 1.0 },
};

const VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  vec4 p = projectionMatrix * viewMatrix * vec4(cameraPosition + vDir * 3000.0, 1.0);
  gl_Position = p.xyww;
}`;

const FRAG = /* glsl */`
${GLSL_COMMON}
uniform vec3 uZenith;
uniform vec3 uCloudLit;
uniform vec3 uCloudMid;
uniform vec3 uCloudShade;
uniform vec3 uCloudRim;
uniform float uSunDisc;
uniform float uBank;
varying vec3 vDir;

float sh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// cumulus as painters build them: unions of discs. Returns (inside distance, outward normal).
vec3 discs(vec2 p, float cell, float seed, float fill, float rmin, float rmax) {
  vec2 ip = floor(p / cell);
  float best = -1e3; vec2 bn = vec2(0.0, 1.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = ip + vec2(float(i), float(j));
    if (sh(c + seed) > fill) continue;
    for (int k = 0; k < 4; k++) {
      float fk = float(k);
      vec2 o = vec2(sh(c * 1.7 + fk * 3.3 + seed), sh(c * 2.9 + fk * 5.1 + seed + 1.0));
      vec2 ctr = (c + 0.15 + 0.7 * o) * cell;
      float r = cell * mix(rmin, rmax, sh(c + fk * 7.7 + seed + 2.0));
      vec2 d = p - ctr;
      float L = length(d);
      float v = r - L;
      if (v > best) { best = v; bn = d / max(L, 1e-5); }
    }
  }
  return vec3(best, bn);
}
// the overhead deck: big masses with small puffs on their rims
vec3 deck(vec2 p) {
  vec3 big = discs(p, 1.0, 3.0, 0.25 + uCloudCover * 0.45, 0.22, 0.42);
  vec3 small = discs(p * 1.0, 0.33, 9.0, 0.95, 0.18, 0.4);
  if (big.x > -0.08 && small.x > big.x) return small;
  return big;
}
// the horizon bank: towers on a baseline, in (azimuth, elevation) space; a puffier top octave
vec3 bank(vec2 q) {
  float env = smoothstep(0.25, 0.65, tFbm(vec2(cos(q.x), sin(q.x)) * 1.6 + 4.0)) * uBank;   // gaps along the horizon
  vec2 p = vec2(q.x * 3.1513, q.y * 10.0);       // 36 cells round the horizon, so the pattern closes
  float best = -1e3; vec2 bn = vec2(0.0, 1.0);
  float cell = 0.55;
  float ix = floor(p.x / cell);
  for (int i = -2; i <= 2; i++) {
    float c = ix + float(i);
    float cw = mod(c, 36.0);
    float h = sh(vec2(cw, 3.0));
    float r = cell * mix(0.55, 1.25, h) * (0.4 + 0.9 * env);
    vec2 ctr = vec2((c + 0.5) * cell + (sh(vec2(cw, 7.0)) - 0.5) * cell * 0.6, r * 0.35 - 0.05);
    vec2 d = p - ctr; float L = length(d); float v = r - L;
    if (v > best) { best = v; bn = d / max(L, 1e-5); }
    // puffs riding on top of each tower
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      float a = mix(0.35, 2.8, sh(vec2(cw, 11.0 + fk)));
      float rr = r * mix(0.28, 0.48, sh(vec2(cw, 17.0 + fk)));
      vec2 pc = ctr + vec2(cos(a), sin(a)) * (r - rr * 0.35);
      vec2 dd = p - pc; float LL = length(dd); float vv = rr - LL;
      if (vv > best) { best = vv; bn = dd / max(LL, 1e-5); }
    }
  }
  // a flat base, sunk in the haze
  best = min(best, p.y + 0.12);
  return vec3(best, bn);
}

float cel3(float lit) {
  return smoothstep(0.3, 0.36, lit) * 0.5 + smoothstep(0.62, 0.68, lit) * 0.5;
}
vec3 cloudColor(float band, float rim) {
  vec3 c = mix(uCloudShade, uCloudMid, smoothstep(0.0, 0.5, band));
  c = mix(c, uCloudLit, smoothstep(0.5, 1.0, band));
  return c + uCloudRim * rim;
}

void main() {
  vec3 dir = normalize(vDir);
  float el = dir.y;
  // gradient: zenith to the shared horizon colour, slightly whiter at the horizon line
  float t = pow(clamp(el, 0.0, 1.0), 0.45);
  vec3 sky = mix(uFogColor * 1.04, uZenith, t);
  float sunDot = max(dot(dir, uSunDir), 0.0);
  sky = mix(sky, uFogSun, pow(sunDot, 6.0) * 0.55 * (1.0 - t * 0.6));
  // below the horizon: the haze the distant city stands in
  if (el < 0.0) sky = mix(uFogColor, uFogColor * 0.9, clamp(-el * 6.0, 0.0, 1.0));
  vec3 col = sky;
  // sun
  float disc = smoothstep(0.9993, 0.9997, sunDot);
  col += uFogSun * (disc * uSunDisc + pow(sunDot, 180.0) * 1.2);

  vec2 sunP = normalize(uSunDir.xz + 1e-4);
  float sunUp = uSunDir.y;
  // overhead deck
  if (el > 0.03) {
    vec2 p = dir.xz / (el + 0.18) * 0.9 + uWind * uTime * 0.0035;
    vec3 d = deck(p);
    float fw = fwidth(d.x) * 1.2 + 1e-4;
    float edge = smoothstep(-fw, fw, d.x);
    if (edge > 0.001) {
      // seen from below: lit where the puff turns toward the sun, the rest in the sky's shade
      float lit = 0.42 + 0.5 * dot(d.yz, sunP) * (1.0 - sunUp * 0.5) + 0.25 * sunUp;
      lit -= smoothstep(0.0, 0.25, d.x) * 0.18;           // thick middles go darker underneath
      float band = cel3(clamp(lit, 0.0, 1.0));
      float rim = smoothstep(0.03, 0.0, d.x) * pow(max(dot(d.yz, sunP), 0.0), 2.0) * (1.0 - sunUp) * 0.9;
      vec3 c = cloudColor(band, rim);
      float fade = smoothstep(0.03, 0.2, el);
      c = mix(uFogColor, c, smoothstep(0.03, 0.35, el) * 0.6 + 0.4);
      col = mix(col, c, edge * fade);
    }
  }
  // horizon bank
  if (el > -0.03 && el < 0.45) {
    float az = atan(dir.z, dir.x);
    vec3 b = bank(vec2(az, el));
    float fw = fwidth(b.x) * 1.2 + 1e-4;
    float edge = smoothstep(-fw, fw, b.x);
    if (edge > 0.001) {
      // the puff's normal in screen-space: x along the horizon, y up; the sun lies left or right
      float side = dot(vec2(-dir.z, dir.x), sunP);                     // sun to the right (+) or left (−) of this view
      vec2 sun2 = normalize(vec2(side * (1.0 - sunUp * 0.6), 0.35 + sunUp));
      float toward = 0.5 + 0.5 * dot(normalize(dir.xz), sunP);          // banks facing the sun are brighter overall
      float lit = 0.5 + 0.55 * dot(b.yz, sun2) - 0.25 * (1.0 - toward);
      float band = cel3(clamp(lit, 0.0, 1.0));
      float rim = smoothstep(0.06, 0.0, b.x) * pow(max(dot(b.yz, sun2), 0.0), 3.0) * toward * (1.2 - sunUp);
      vec3 c = cloudColor(band, rim * 0.8);
      c = mix(c, uFogColor, smoothstep(0.1, -0.01, el) * 0.7);
      col = mix(col, c, edge);
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export function createSky() {
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms: { ...TOON, ...SKY },
    depthWrite: false, depthTest: true, side: THREE.BackSide,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.name = 'toon-sky';
  return mesh;
}
