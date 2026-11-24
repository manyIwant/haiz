// HAIZ · 校园漫步 V2 — one atmosphere for the whole picture.
//
// V1 shaded each element well enough on its own, and the parts still looked like they came from
// different games. Here every surface reads the same few things, so they agree:
//
//   sky       skyColor(dir) is the sky itself, the colour distant things fade into in that direction,
//             what glass and water mirror, and (averaged) the light that fills the shade
//   air       aerial perspective tuned for campus distances: a gentle cool shift from ~25 m, so a
//             building 80 m away already sits behind the student; full haze toward the horizon
//   light     one sun through the real shadow map; cel terminator; shade lit by the sky above and
//             the warm bounce of sunlit ground below (never grey, never black)
//   wind      windField(xz) — gust fronts travelling across the campus. The grass leans with it, the
//             lawn's sheen moves with it, the trees sway harder when it reaches them
//   clouds    the same cloud layer that draws the sky casts the drifting shadows on the ground
//   weather   (入画, lanren/ruhua) wetness, standing water, rain, night and lit windows, and a global
//             wind strength. All default to the V2 walk's dry, lit day, so campus-stroll-v2 is unchanged
import * as THREE from 'three';

export const U = {
  uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
  uSunColor: { value: new THREE.Color(2, 1.9, 1.75) },
  uSkyAmb: { value: new THREE.Color(0.5, 0.62, 0.9) },
  uGroundAmb: { value: new THREE.Color(0.38, 0.36, 0.26) },
  uZenith: { value: new THREE.Color(0.06, 0.28, 0.66) },
  uHorizon: { value: new THREE.Color(0.62, 0.78, 0.92) },
  uSunGlow: { value: new THREE.Color(1.1, 1.0, 0.85) },
  uRim: { value: new THREE.Color(1, 0.9, 0.75) },
  uDepthCol: { value: new THREE.Color(0.9, 0.96, 1.06) },
  uDepthTint: { value: 0.35 },
  uAirScale: { value: 1 / 700 },
  uFogFalloff: { value: 0.02 },
  uFogMax: { value: 0.9 },
  uGroundY: { value: -0.85 },
  uTime: { value: 0 },
  uWindDir: { value: new THREE.Vector2(0.86, 0.5) },
  uWindSpeed: { value: 4.0 },
  uWindGust: { value: 1.0 },
  uCloudShadow: { value: 0.35 },
  uCloudCover: { value: 0.5 },
  uMist: { value: 0 },
  uShadeHue: { value: new THREE.Color(0.62, 0.68, 1.0) },
  uShadeMix: { value: 0.28 },
  // weather (defaults: the V2 walk's dry day)
  uWet: { value: 0 },          // 0 dry … 1 soaked paving
  uPuddle: { value: 0 },       // 0 none … 1 standing water in every hollow
  uRain: { value: 0 },         // falling rain now, 0..1
  uNight: { value: 0 },        // 0 day … 1 night
  uLamps: { value: 0 },        // 0 … 1 lit windows
  uWindSway: { value: 1 },     // multiplies how far crowns and blades move
};

export const GLSL = /* glsl */`
uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uSkyAmb; uniform vec3 uGroundAmb;
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSunGlow; uniform vec3 uRim; uniform vec3 uDepthCol;
uniform float uDepthTint; uniform float uAirScale; uniform float uFogFalloff; uniform float uFogMax; uniform float uGroundY;
uniform float uTime; uniform vec2 uWindDir; uniform float uWindSpeed; uniform float uWindGust;
uniform float uCloudShadow; uniform float uCloudCover; uniform float uMist; uniform vec3 uShadeHue; uniform float uShadeMix;
uniform float uWet; uniform float uPuddle; uniform float uRain; uniform float uNight; uniform float uLamps; uniform float uWindSway;

float aHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float aNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(aHash(i), aHash(i + vec2(1, 0)), u.x), mix(aHash(i + vec2(0, 1)), aHash(i + vec2(1, 1)), u.x), u.y);
}
float aFbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++) { s += a * aNoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }

vec3 skyColor(vec3 d) {
  float y = max(d.y, 0.0);
  float t = pow(y, 0.42);
  vec3 c = mix(uHorizon, uZenith, t);
  float s = max(dot(d, uSunDir), 0.0);
  c = mix(c, uSunGlow, pow(s, 6.0) * (1.0 - t * 0.75) * 0.65);
  c += uSunGlow * pow(s, 64.0) * 0.25;
  if (d.y < 0.0) c = mix(uHorizon, uHorizon * 0.9, min(1.0, -d.y * 5.0));
  return c;
}

// gust fronts travelling with the wind, plus a little turbulence; 0 calm … 1 gusting
float windField(vec2 p) {
  vec2 d = uWindDir;
  float along = dot(p, d) - uTime * uWindSpeed;
  float across = dot(p, vec2(-d.y, d.x));
  float g = aNoise(vec2(along * 0.03, across * 0.012));
  g = smoothstep(0.38, 0.86, g) * uWindGust;
  float fine = aNoise(p * 0.21 - d * uTime * uWindSpeed * 0.21);
  return clamp(g * 0.82 + fine * 0.18, 0.0, 1.0);
}

float cloudShade(vec3 wp) {
  vec2 p = wp.xz + uSunDir.xz / max(uSunDir.y, 0.15) * (900.0 - wp.y);
  float n = aFbm(p * 0.0075 + uWindDir * uTime * 0.012);
  float c = smoothstep(0.58 - uCloudCover * 0.2, 0.68 - uCloudCover * 0.2, n);
  return 1.0 - uCloudShadow * c;
}

// ---- water left on the ground: hollows in the paving and along the kerbs fill first
float puddleField(vec2 xz) {
  float n = aFbm(xz * 0.19 + 3.7) * 0.7 + aNoise(xz * 0.9) * 0.3;
  return n;
}
/** 0..1 standing water at xz for the current uPuddle (soft edge) */
float puddleAt(vec2 xz) {
  if (uPuddle < 0.01) return 0.0;
  float th = 0.78 - uPuddle * 0.36;
  return smoothstep(th, th + 0.035, puddleField(xz));
}
/** rings of falling drops on standing water: a perturbed normal (xz), 0 when dry */
vec2 rainRipple(vec2 xz) {
  if (uRain < 0.01) return vec2(0.0);
  vec2 acc = vec2(0.0);
  for (int k = 0; k < 2; k++) {
    vec2 p = xz * (2.2 + float(k) * 1.3) + float(k) * 17.0;
    vec2 id = floor(p), f = fract(p) - 0.5;
    float h = aHash(id + float(k));
    float rate = 0.8 + 0.6 * h;
    float ph = fract(uTime * rate + h * 7.0);
    float on = step(1.0 - uRain * 0.9, aHash(id + floor(uTime * rate + h * 7.0) * 1.31));
    vec2 c = (vec2(aHash(id + 3.1), aHash(id + 7.7)) - 0.5) * 0.5;
    vec2 d = f - c; float r = length(d);
    float ring = sin((r - ph * 0.45) * 60.0) * smoothstep(0.08, 0.0, abs(r - ph * 0.45)) * (1.0 - ph);
    acc += on * ring * d / max(r, 1e-3);
  }
  return acc * 0.35;
}
/** what wetness does to a surface's colour: darker, a little richer (porosity 0 glass … 1 soil) */
vec3 wetAlbedo(vec3 albedo, float wet, float porosity) {
  float k = wet * porosity;
  vec3 a = albedo * mix(1.0, 0.58, k);
  float l = dot(a, vec3(0.3, 0.59, 0.11));
  return mix(a, mix(vec3(l), a, 1.18), k);
}

vec3 aerial(vec3 col, vec3 wp) {
  vec3 v = wp - cameraPosition;
  float d = length(v);
  vec3 dir = v / max(d, 1e-4);
  float h = max(0.0, mix(cameraPosition.y, wp.y, 0.5) - uGroundY);
  float dens = exp(-h * uFogFalloff) + uMist * exp(-max(0.0, wp.y - uGroundY) * 0.25);
  float f = 1.0 - exp(-pow(d * uAirScale, 1.3) * dens);
  // the near field: a gentle cool, slightly desaturated shift so depth reads inside the campus
  float near = smoothstep(22.0, 240.0, d) * uDepthTint;
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, mix(vec3(l), col, 0.72) * uDepthCol, near);
  vec3 fc = skyColor(normalize(vec3(dir.x, max(dir.y, 0.0) * 0.3 + 0.015, dir.z)));
  return mix(col, fc, clamp(f, 0.0, uFogMax));
}

// cel light. soft: terminator width; ao: occlusion of the sky light
vec3 toonLight(vec3 albedo, vec3 N, vec3 wp, float shadow, float ao, float soft) {
  vec3 V = normalize(cameraPosition - wp);
  float ndl = dot(N, uSunDir);
  float band = smoothstep(-0.04 - soft, 0.08 + soft, ndl);
  float lit = band * shadow * cloudShade(wp);
  float hi = smoothstep(0.55, 0.85, ndl);
  vec3 amb = mix(uGroundAmb, uSkyAmb, N.y * 0.5 + 0.5) * ao;
  // the shade colour is chosen, as painters do: keep its value, pull its hue toward the mood's shade hue
  vec3 sh = albedo * amb;
  float shl = dot(sh, vec3(0.3, 0.59, 0.11));
  sh = mix(sh, shl * uShadeHue * 1.45, uShadeMix);
  vec3 col = sh + albedo * uSunColor * lit * (0.84 + 0.2 * hi);
  float back = max(0.0, dot(-V, uSunDir));
  float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
  col += uRim * albedo * fres * back * (0.3 + 0.7 * shadow) * 1.4;
  return col;
}
`;

const VERT_HEAD = 'varying vec3 vWP;\nvarying vec3 vWN;\n';
const VERT_WORLD = /* glsl */`
{
  vec4 tWP = vec4(transformed, 1.0);
  vec3 tN = objectNormal;
  #ifdef USE_INSTANCING
    tWP = instanceMatrix * tWP;
    tN = mat3(instanceMatrix) * tN;
  #endif
  tWP = modelMatrix * tWP;
  vWP = tWP.xyz;
  vWN = normalize(mat3(modelMatrix) * tN);
}
`;

/**
 * Cel material on three's Lambert program (keeps the sun, shadow map, instancing, skinning).
 * opts: color, map, alphaTest, side, soft, name/key, uniforms, defines,
 *       vertex { head, begin, world }, fragment { head, albedo, after }
 * In fragment hooks: vWP, vWN, N (shading normal), albedo, ao, soft, shadow, outCol.
 */
export function cel(opts = {}) {
  const m = new THREE.MeshLambertMaterial({
    color: opts.color ?? 0xffffff, map: opts.map || null, alphaTest: opts.alphaTest || 0, vertexColors: !!opts.vertexColors, opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide, transparent: !!opts.transparent, alphaToCoverage: !!opts.alphaToCoverage,
  });
  m.name = opts.name || 'cel';
  m.fog = false;
  const extra = opts.uniforms || {};
  const V = opts.vertex || {}, F = opts.fragment || {};
  const key = 'v2:' + (opts.key || m.name) + ':' + [V.head, V.begin, V.world, F.head, F.pre, F.albedo, F.after].map((s) => (s || '').length).join(',');
  m.customProgramCacheKey = () => key;
  if (opts.defines) m.defines = { ...(m.defines || {}), ...opts.defines };
  m.userData.uniforms = extra;
  m.userData.celOpts = opts;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, extra);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_HEAD + GLSL + (V.head || ''))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (V.begin || ''))
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n' + VERT_WORLD + (V.world || ''));
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;\n' + GLSL + (F.head || ''))
      .replace('#include <lights_fragment_begin>', /* glsl */`
float shadow = 1.0;
#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
  shadow = getShadow( directionalShadowMap[ 0 ], directionalLightShadows[ 0 ].shadowMapSize, directionalLightShadows[ 0 ].shadowIntensity, directionalLightShadows[ 0 ].shadowBias, directionalLightShadows[ 0 ].shadowRadius, vDirectionalShadowCoord[ 0 ] );
#endif
${F.pre || ''}
vec3 N = normalize(vWN);
${opts.flipBack ? 'N = gl_FrontFacing ? N : -N;' : ''}
float ao = 1.0;
float soft = ${(opts.soft ?? 0.0).toFixed(3)};
vec3 albedo = diffuseColor.rgb;
${F.albedo || ''}
vec3 outCol = toonLight(albedo, N, vWP, shadow, ao, soft);
${F.after || ''}
reflectedLight.directDiffuse = outCol;
reflectedLight.indirectDiffuse = vec3(0.0);
`)
      .replace('#include <lights_fragment_maps>', '')
      .replace('#include <lights_fragment_end>', '')
      .replace('#include <aomap_fragment>', '')
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb = aerial(gl_FragColor.rgb, vWP);');
    m.userData.shader = sh;
  };
  return m;
}

/**
 * Another cel material built from the same recipe as `m` (same uniforms objects, so wind, weather and
 * light stay in step), with hooks appended and options overridden. Used by 入画 for the remembered
 * and the painted variants of every V2 surface.
 *   extra: { key, soft, uniforms, fragment: { head, pre, albedo, after } }
 */
export function celLike(m, extra = {}) {
  const o = m.userData.celOpts;
  if (!o) throw new Error('celLike: not a cel material');
  const F = o.fragment || {}, X = extra.fragment || {};
  const cat = (a, b) => (a || '') + (b || '');
  const n = cel({
    ...o, key: (o.key || o.name) + ':' + (extra.key || 'like'), soft: extra.soft ?? o.soft,
    uniforms: { ...(o.uniforms || {}), ...(extra.uniforms || {}) },
    fragment: { head: cat(F.head, X.head), pre: cat(F.pre, X.pre), albedo: cat(F.albedo, X.albedo), after: cat(F.after, X.after) },
  });
  if (m.map) n.map = m.map;
  n.name = m.name + ':' + (extra.key || 'like');
  return n;
}

/** depth material for shadows that moves its vertices like the colour material (wind) */
export function celDepth(opts = {}) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: opts.map || null, alphaTest: opts.alphaTest || 0, side: opts.side ?? THREE.FrontSide });
  const V = opts.vertex || {};
  m.customProgramCacheKey = () => 'v2depth:' + (opts.key || '');
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, opts.uniforms || {});
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + GLSL + (V.head || ''))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (V.begin || ''));
  };
  return m;
}

/** the same wind field on the CPU (tree sway amplitude per tree, the camera's sense of a gust) */
function hash2(x, y) { x = (x * 123.34) % 1; y = (y * 456.21) % 1; if (x < 0) x += 1; if (y < 0) y += 1; const d = x * (x + 45.32) + y * (y + 45.32); x += d; y += d; const v = (x * y) % 1; return v < 0 ? v + 1 : v; }
function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
}
export function windAt(x, z) {
  const d = U.uWindDir.value, t = U.uTime.value;
  const along = x * d.x + z * d.y - t * U.uWindSpeed.value, across = -x * d.y + z * d.x;
  let g = noise2(along * 0.03, across * 0.012);
  g = Math.min(1, Math.max(0, (g - 0.38) / 0.48)); g = g * g * (3 - 2 * g);
  return g * U.uWindGust.value;
}
