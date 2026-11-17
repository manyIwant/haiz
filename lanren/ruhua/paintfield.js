// 入画 · when each point of the world becomes paint.
//
// Every surface exists twice for the length of the transition: once remembered (V4's realism) and
// once painted (V2). Both copies read one field, paintTime(p, n): the moment the point p turns to
// paint. The remembered copy discards itself after that moment, the painted copy before it, so at
// every point exactly one of them is drawn and the two worlds meet along a line made of brush
// strokes. Two things paint the world:
//
//   the projector   the painter's sight lines. The canvas was painted sight-size from one eye:
//                   every stroke on it stands for the ray from that eye through it. When the
//                   painting leaves the canvas, each stroke travels along its ray and lands on the
//                   first surface the ray meets (the painter's depth map), nearer things first.
//                   Strokes painted past the canvas edge land at once.
//   the front       the painting goes on by itself from the tree outwards, laid in strokes on every
//                   surface it reaches: ground strokes sweep round the tree, wall strokes run level.
//
// The sky has no surface: its moment comes from its direction (composite pass in pipeline.js).
import * as THREE from 'three';

/** an empty projector (nothing painted through it) */
export const NO_PROJECTION = new THREE.DataTexture(new Uint16Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat, THREE.HalfFloatType);
NO_PROJECTION.needsUpdate = true;

export const PAINT = {
  uPaintOn: { value: 0 },
  uPaintClock: { value: 0 },
  uProjVP: { value: new THREE.Matrix4() },
  uProjEye: { value: new THREE.Vector3() },
  uProjMap: { value: NO_PROJECTION },  // RGBA half float, the painter's screen: r time, g travels (1) or lands now (0), a covered
  uProjDepth: { value: NO_PROJECTION },  // R: distance from the painter's eye to the first surface (m)
  uProjStart: { value: 1e6 },
  uProjSpeed: { value: 34 },
  uFrontO: { value: new THREE.Vector3() },
  uFrontStart: { value: 1e6 },
  uFrontV: { value: 3.5 },          // m/s at the start …
  uFrontA: { value: 6.0 },          // … gathering pace (m/s²)
  uSkyStart: { value: 1e6 },
  uSkyO: { value: new THREE.Vector3(0, 0.3, 1) },
};

export const PAINT_GLSL = /* glsl */`
uniform float uPaintOn; uniform float uPaintClock;
uniform mat4 uProjVP; uniform vec3 uProjEye; uniform sampler2D uProjMap; uniform sampler2D uProjDepth;
uniform float uProjStart; uniform float uProjSpeed;
uniform vec3 uFrontO; uniform float uFrontStart; uniform float uFrontV; uniform float uFrontA;
uniform float uSkyStart; uniform vec3 uSkyO;
float pfHash(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
// seconds for the front to travel d metres
float pfFrontT(float d) { return (sqrt(uFrontV * uFrontV + 2.0 * uFrontA * max(d, 0.0)) - uFrontV) / uFrontA; }
// the front, laid as strokes on the surface's dominant plane
float pfStrokes(vec3 p, vec3 n) {
  vec3 an = abs(n);
  vec2 q; float ang0;
  vec2 rel = p.xz - uFrontO.xz;
  if (an.y > max(an.x, an.z)) { q = p.xz; ang0 = atan(rel.y, rel.x) + 1.5708; }     // ground: sweeps round the tree
  else if (an.x > an.z) { q = p.zy; ang0 = 0.0; }                                      // walls: level strokes
  else { q = p.xy; ang0 = 0.0; }
  float d = length(rel) + max(0.0, p.y - uFrontO.y) * 0.35;
  float base = pfFrontT(d);
  const float cell = 0.6;
  vec2 g = q / cell, gi = floor(g);
  float best = base + 0.9;                                                             // gaps fill last
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
    vec2 id = gi + vec2(float(i), float(j));
    float h1 = pfHash(id), h2 = pfHash(id + 7.13), h3 = pfHash(id + 3.31);
    vec2 c = id + 0.5 + (vec2(h1, h2) - 0.5) * 0.9;
    float a = ang0 + (h3 - 0.5) * 0.7;
    vec2 dir = vec2(cos(a), sin(a));
    vec2 o = g - c;
    float al = dot(o, dir), ac = dot(o, vec2(-dir.y, dir.x));
    float len = 1.0 + h1 * 0.9, wid = 0.38 + h2 * 0.22;
    float taper = 1.0 - pow(clamp(abs(al) / len, 0.0, 1.0), 3.0);
    float bristle = (pfHash(vec2(floor(ac * 14.0), id.x + id.y)) - 0.5) * 0.35;      // ragged ends, one per bristle
    if (abs(ac) < wid * taper && abs(al) < len + bristle) best = min(best, base + (h3 - 0.5) * 0.9 + al * 0.03);
  }
  return best;
}
float paintTime(vec3 p, vec3 n) {
  float t = uFrontStart + pfStrokes(p, n);
  vec4 c = uProjVP * vec4(p, 1.0);
  if (c.w > 0.0) {
    vec2 uv = c.xy / c.w * 0.5 + 0.5;
    if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
      vec4 m = texture2D(uProjMap, uv);
      if (m.a > 0.5) {
        float d = length(p - uProjEye);
        float first = texture2D(uProjDepth, uv).r;
        // the first surface along that sight line, and a crown's thickness behind it
        if (d < first * 1.04 + 2.5) t = min(t, m.g > 0.5 ? uProjStart + m.r + d / uProjSpeed : m.r);
      }
    }
  }
  return t;
}
// the sky: strokes of a wide brush, from the painting's side of the sky outwards
float paintTimeSky(vec3 dir) {
  float t = 1e6;
  vec4 c = uProjVP * vec4(uProjEye + dir * 800.0, 1.0);
  if (c.w > 0.0) {
    vec2 uv = c.xy / c.w * 0.5 + 0.5;
    if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
      vec4 m = texture2D(uProjMap, uv);
      if (m.a > 0.5 && texture2D(uProjDepth, uv).r > 3000.0) t = m.g > 0.5 ? uProjStart + m.r + 2.6 : m.r;
    }
  }
  float az = atan(dir.x, dir.z), el = asin(clamp(dir.y, -1.0, 1.0));
  vec2 q = vec2(az * 4.0, el * 16.0);
  vec2 gi = floor(q);
  float ang = acos(clamp(dot(normalize(dir), normalize(uSkyO)), -1.0, 1.0));
  float base = uSkyStart + ang * 2.2;
  float best = base + 0.8;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
    vec2 id = gi + vec2(float(i), float(j));
    float h1 = pfHash(id + 11.0), h2 = pfHash(id + 5.0);
    vec2 o = q - (id + 0.5 + (vec2(h1, h2) - 0.5) * 0.7);
    float len = 1.1 + h1, wid = 0.45 + h2 * 0.2;
    if (abs(o.y) < wid * (1.0 - pow(abs(o.x) / len, 4.0)) && abs(o.x) < len) best = min(best, base + (h1 - 0.5) * 0.8);
  }
  return min(t, best);
}
`;

const VERT_HEAD = 'varying vec3 vPfWP; varying vec3 vPfN;\n';
const VERT_BODY = /* glsl */`
{
  vec4 pw = vec4(transformed, 1.0);
  vec3 pn = objectNormal;
  #ifdef USE_INSTANCING
    pw = instanceMatrix * pw; pn = mat3(instanceMatrix) * pn;
  #endif
  vPfWP = (modelMatrix * pw).xyz;
  vPfN = normalize(mat3(modelMatrix) * pn);
}
`;

/**
 * Patch a material so it draws only its side of the line: 'real' (before the paint arrives) or
 * 'paint' (after). Works on three's built-in materials and on materials that already patch their
 * shaders (it runs after their onBeforeCompile). Returns the same material.
 *   wet   (paint side) add the gloss of fresh oil paint for a moment after it lands
 */
export function sideOf(material, side, { wet = false } = {}) {
  const prev = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey?.bind(material);
  material.onBeforeCompile = (sh, r) => {
    prev?.call(material, sh, r);
    Object.assign(sh.uniforms, PAINT);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_HEAD)
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_BODY);
    const test = side === 'real' ? 'uPaintClock >= pfT' : 'uPaintClock < pfT';
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + VERT_HEAD + PAINT_GLSL)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
float pfT = uPaintOn > 0.5 ? paintTime(vPfWP, normalize(vPfN)) : ${side === 'real' ? '1e9' : '-1e9'};
if (${test}) discard;`);
    if (wet && side === 'paint') {
      sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
if (uPaintOn > 0.5) {
  float pfWet = 1.0 - smoothstep(0.0, 2.6, uPaintClock - pfT);
  if (pfWet > 0.001) {
    vec3 V = normalize(cameraPosition - vPfWP);
    float ridge = pfHash(floor(vPfWP.xz * 24.0 + vPfWP.y * 7.0)) * 0.6 + pfHash(floor(vPfWP.xz * 9.0)) * 0.4;
    vec3 Np = normalize(normalize(vPfN) + (vec3(ridge, 0.0, 1.0 - ridge) - 0.5) * 0.9);
    float spec = pow(max(dot(reflect(-V, Np), normalize(vec3(0.3, 0.8, 0.2))), 0.0), 26.0);
    gl_FragColor.rgb += (vec3(spec) * 0.35 + vec3(0.02)) * pfWet;
  }
}`);
    }
  };
  material.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|pf-' + side + (wet ? 'w' : '');
  material.needsUpdate = true;
  return material;
}

/** a fresh copy of a built-in (or onBeforeCompile-patched) material, sharing textures and uniforms */
export function twin(material) {
  const ud = material.userData;
  material.userData = {};
  const t = new material.constructor();
  t.copy(material);
  material.userData = ud;
  t.userData = ud;
  if (material.defines) t.defines = { ...material.defines };
  t.onBeforeCompile = material.onBeforeCompile;
  if (material.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey) t.customProgramCacheKey = material.customProgramCacheKey;
  return t;
}
