// HAIZ · 画风 — the shared light, atmosphere and cel material of the stylized walk (three.js r170).
//
// The reference (media/references/stylized-campus-walk-reference.mp4, docs/toon-campus-style-20261116.md)
// is painted-anime in its shapes and colours but physical in its light: one sun, real cast shadows,
// a blue sky filling the shade, cloud shadows drifting over the fields and air that turns distant
// things into sky. So the shading here keeps three's real sun and shadow map and changes only how
// light becomes colour:
//
//   lit / shade   a narrow terminator (cel band) instead of a smooth Lambert falloff, plus one broad
//                 highlight band; the shade is lit only by the sky, so it is blue-violet, never grey
//   cast shadow   three's shadow map through the same band, then the drifting cloud shadow
//   rim           a thin back-light rim when the sun is behind a form (strong at golden hour)
//   air           aerial perspective toward the sky's own horizon colour, warmer toward the sun
//
// Every material (campus, trees, grass, ground, figure) goes through toonMaterial() so they share
// one set of uniforms (TOON) and the light can be moved for the whole world at once (daylight.js).
import * as THREE from 'three';

export const TOON = {
  uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
  uSunColor: { value: new THREE.Color(3.0, 2.85, 2.6) },
  uSkyAmb: { value: new THREE.Color(0.55, 0.72, 1.0) },
  uGroundAmb: { value: new THREE.Color(0.35, 0.42, 0.3) },
  uShadeTint: { value: new THREE.Color(0.92, 0.95, 1.08) },
  uRimColor: { value: new THREE.Color(1.0, 0.9, 0.7) },
  uFogColor: { value: new THREE.Color(0.62, 0.78, 0.92) },
  uFogSun: { value: new THREE.Color(0.95, 0.92, 0.85) },
  uFogDensity: { value: 0.0016 },
  uFogFalloff: { value: 0.018 },
  uFogMax: { value: 0.92 },
  uGroundY: { value: -0.85 },
  uTime: { value: 0 },
  uWind: { value: new THREE.Vector2(0.8, 0.35) },
  uCloudShadow: { value: 0.42 },
  uCloudCover: { value: 0.5 },
  uExposure: { value: 1.0 },
};

// ------------------------------------------------------------------ GLSL shared by every material
export const GLSL_COMMON = /* glsl */`
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyAmb;
uniform vec3 uGroundAmb;
uniform vec3 uShadeTint;
uniform vec3 uRimColor;
uniform vec3 uFogColor;
uniform vec3 uFogSun;
uniform float uFogDensity;
uniform float uFogFalloff;
uniform float uFogMax;
uniform float uGroundY;
uniform float uTime;
uniform vec2 uWind;
uniform float uCloudShadow;
uniform float uCloudCover;

float tHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float tNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(tHash(i), tHash(i + vec2(1, 0)), u.x), mix(tHash(i + vec2(0, 1)), tHash(i + vec2(1, 1)), u.x), u.y);
}
float tFbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * tNoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }

// the shadow of the sky's clouds on the ground: the cloud layer (~600 m up) projected along the sun
float cloudShade(vec3 wp) {
  vec2 p = wp.xz + uSunDir.xz / max(uSunDir.y, 0.15) * (600.0 - wp.y);
  float n = tFbm(p * 0.0042 + uWind * uTime * 0.012);
  float c = smoothstep(0.62 - uCloudCover * 0.25, 0.70 - uCloudCover * 0.25, n);
  return 1.0 - uCloudShadow * c;
}

vec3 aerial(vec3 col, vec3 wp) {
  vec3 v = wp - cameraPosition;
  float d = length(v);
  vec3 dir = v / max(d, 1e-4);
  float h = max(0.0, wp.y - uGroundY);
  // height fog integrated along the ray (dense near the ground, thin above)
  float hc = max(0.0, cameraPosition.y - uGroundY);
  float k = uFogFalloff;
  float dh = (h - hc);
  float tr = abs(dh) > 0.01 ? (exp(-k * hc) - exp(-k * h)) / (k * dh) : exp(-k * hc);
  float f = 1.0 - exp(-d * uFogDensity * tr);
  float sunAmt = pow(max(dot(dir, uSunDir), 0.0), 5.0);
  vec3 fc = mix(uFogColor, uFogSun, sunAmt);
  return mix(col, fc, clamp(f, 0.0, uFogMax));
}

// cel light: albedo, world normal, shadow (0..1), occlusion; kind: 1 cloth, .75 skin, .5 hair, .25 unlit
vec3 toonLight(vec3 albedo, vec3 N, vec3 wp, float shadow, float ao, float soft) {
  vec3 V = normalize(cameraPosition - wp);
  float ndl = dot(N, uSunDir);
  float band = smoothstep(-0.03 - soft, 0.09 + soft, ndl);
  float lit = band * shadow * cloudShade(wp);
  float hi = smoothstep(0.5, 0.78, ndl);
  vec3 sky = mix(uGroundAmb, uSkyAmb, N.y * 0.5 + 0.5) * uShadeTint;
  vec3 col = albedo * (sky * ao + uSunColor * lit * (0.82 + 0.22 * hi));
  // back-light rim: the sun beyond the form outlines it
  float back = max(0.0, dot(-V, uSunDir));
  float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
  col += uRimColor * albedo * fres * back * (0.35 + 0.65 * shadow) * 1.6;
  return col;
}
`;

const VERT_HEAD = /* glsl */`
varying vec3 vToonWP;
varying vec3 vToonN;
`;
const VERT_WORLD = /* glsl */`
{
  vec4 tWP = vec4(transformed, 1.0);
  vec3 tN = objectNormal;
  #ifdef USE_INSTANCING
    tWP = instanceMatrix * tWP;
    tN = mat3(instanceMatrix) * tN;
  #endif
  tWP = modelMatrix * tWP;
  vToonWP = tWP.xyz;
  vToonN = normalize(mat3(modelMatrix) * tN);
}
`;

/**
 * A cel-lit material that keeps three's sun and shadow map.
 * opts: color, map, alphaTest, side, soft (terminator softness), ao (attribute-free occlusion),
 *       simplify (0..1 pulls a texture toward its mean colour, as painted backgrounds do),
 *       vertex: { head, begin, world } GLSL injected into the vertex shader,
 *       fragment: { head, albedo, after } GLSL injected into the fragment shader,
 *       uniforms: extra uniforms, defines: extra defines, name.
 */
export function toonMaterial(opts = {}) {
  const m = new THREE.MeshLambertMaterial({
    color: opts.color ?? 0xffffff, map: opts.map || null, alphaTest: opts.alphaTest || 0,
    side: opts.side ?? THREE.FrontSide, transparent: !!opts.transparent, depthWrite: opts.depthWrite ?? true,
  });
  m.name = opts.name || 'toon';
  m.fog = false;
  const extra = opts.uniforms || {};
  const V = opts.vertex || {}, F = opts.fragment || {};
  const key = 'toon:' + (opts.key || m.name) + ':' + [V.head, V.begin, V.world, F.head, F.albedo, F.after].map((s) => (s || '').length).join(',');
  m.customProgramCacheKey = () => key;
  if (opts.defines) m.defines = { ...(m.defines || {}), ...opts.defines };
  m.userData.toon = { uniforms: extra };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, TOON, extra);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_HEAD + GLSL_COMMON + (V.head || ''))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (V.begin || ''))
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n' + VERT_WORLD + (V.world || ''));
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vToonWP;\nvarying vec3 vToonN;\nuniform float uSimplify;\n' + GLSL_COMMON + (F.head || ''))
      .replace('#include <map_fragment>', /* glsl */`
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  #ifdef TOON_SIMPLIFY
    sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, TOON_MEAN, uSimplify);
  #endif
  diffuseColor *= sampledDiffuseColor;
#endif
`)
      .replace('#include <lights_fragment_begin>', /* glsl */`
float toonShadow = 1.0;
#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
  toonShadow = getShadow( directionalShadowMap[ 0 ], directionalLightShadows[ 0 ].shadowMapSize, directionalLightShadows[ 0 ].shadowIntensity, directionalLightShadows[ 0 ].shadowBias, directionalLightShadows[ 0 ].shadowRadius, vDirectionalShadowCoord[ 0 ] );
#endif
vec3 toonN = normalize(vToonN);
${opts.side === THREE.DoubleSide ? 'toonN = gl_FrontFacing ? toonN : -toonN;' : ''}
float toonAO = 1.0;
float toonSoft = ${(opts.soft ?? 0.0).toFixed(3)};
vec3 toonAlbedo = diffuseColor.rgb;
${F.albedo || ''}
vec3 toonOut = toonLight(toonAlbedo, toonN, vToonWP, toonShadow, toonAO, toonSoft);
${F.after || ''}
reflectedLight.directDiffuse = toonOut;
reflectedLight.indirectDiffuse = vec3(0.0);
`)
      .replace('#include <lights_fragment_maps>', '')
      .replace('#include <lights_fragment_end>', '')
      .replace('#include <aomap_fragment>', '')
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb = aerial(gl_FragColor.rgb, vToonWP);');
    if (opts.simplify != null) {
      sh.uniforms.uSimplify = { value: opts.simplify };
    } else sh.uniforms.uSimplify = { value: 0 };
    m.userData.shader = sh;
  };
  if (opts.simplify != null && opts.mean) {
    m.defines = { ...(m.defines || {}), TOON_SIMPLIFY: '', TOON_MEAN: `vec3(${opts.mean.map((v) => v.toFixed(4)).join(',')})` };
  }
  return m;
}

/** A depth material for shadows that applies the same vertex motion (wind) as its colour material. */
export function toonDepthMaterial(opts = {}) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: opts.map || null, alphaTest: opts.alphaTest || 0, side: opts.side ?? THREE.FrontSide });
  const V = opts.vertex || {};
  m.customProgramCacheKey = () => 'toondepth:' + (opts.key || '');
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, TOON, opts.uniforms || {});
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + GLSL_COMMON + (V.head || ''))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (V.begin || ''));
  };
  return m;
}

/** The mean sRGB→linear colour of an image texture (for simplify): a 16×16 read-back. */
export function textureMean(texture) {
  const img = texture?.image;
  if (!img || !img.width) return [0.5, 0.5, 0.5];
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  try { g.drawImage(img, 0, 0, 16, 16); } catch { return [0.5, 0.5, 0.5]; }
  const d = g.getImageData(0, 0, 16, 16).data;
  let r = 0, gg = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
  const n = d.length / 4;
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return [lin(r / n), lin(gg / n), lin(b / n)];
}
