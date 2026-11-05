// Percentage-closer soft shadows tuned to the real sun.
// The sun's disc is ~0.53° wide, so the penumbra behind a leaf grows by about
// 9.3 mm per metre between the leaf and the ground. Every gap in the canopy
// therefore projects an image of the sun: the round, soft light spots under
// trees. We reproduce that optically instead of painting "dapples".
import * as THREE from 'three';

const SUN_TAN = Math.tan((0.53 * Math.PI) / 180);

/**
 * frustumWidth: width (m) of the orthographic shadow camera
 * depthRange: far - near (m) of the shadow camera
 * quality: { blocker, pcf } sample counts
 */
export function installPCSS({ frustumWidth, depthRange, blocker = 16, pcf = 24 }) {
  // uv units of penumbra per unit of (normalised) depth difference
  const penumbra = (depthRange * SUN_TAN) / frustumWidth;
  const searchUV = (16 * SUN_TAN * 0.5) / frustumWidth; // blockers up to ~16 m above
  const code = /* glsl */`
#define PCSS_BLOCKER ${blocker}
#define PCSS_PCF ${pcf}
#define PCSS_PENUMBRA ${penumbra.toFixed(6)}
#define PCSS_SEARCH ${searchUV.toFixed(6)}
float pcssIGN(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
vec2 pcssVogel(int i, int n, float phi){
  float r = sqrt((float(i) + 0.5) / float(n));
  float th = float(i) * 2.39996323 + phi;
  return vec2(cos(th), sin(th)) * r;
}
float pcssShadow(sampler2D map, vec2 mapSize, vec4 sc){
  float phi = pcssIGN(gl_FragCoord.xy) * 6.2831853;
  vec2 texel = 1.0 / mapSize;
  float search = max(PCSS_SEARCH, texel.x * 2.0);
  float sum = 0.0; float cnt = 0.0;
  for (int i = 0; i < PCSS_BLOCKER; i++) {
    vec2 o = pcssVogel(i, PCSS_BLOCKER, phi) * search;
    float d = unpackRGBAToDepth(texture2D(map, sc.xy + o));
    if (d < sc.z) { sum += d; cnt += 1.0; }
  }
  if (cnt < 0.5) return 1.0;
  float blockerDepth = sum / cnt;
  float w = max((sc.z - blockerDepth) * PCSS_PENUMBRA * 0.5, texel.x * 1.25);
  float lit = 0.0;
  for (int i = 0; i < PCSS_PCF; i++) {
    vec2 o = pcssVogel(i, PCSS_PCF, phi + 1.7) * w;
    lit += texture2DCompare(map, sc.xy + o, sc.z);
  }
  return lit / float(PCSS_PCF);
}
`;
  let chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
  if (!chunk.includes('pcssShadow')) {
    chunk = chunk.replace(
      'vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {',
      code + '\n\tvec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {'
    );
    // swap the 17-tap PCF block for PCSS
    const start = chunk.indexOf('#if defined( SHADOWMAP_TYPE_PCF )');
    const end = chunk.indexOf('#elif defined( SHADOWMAP_TYPE_PCF_SOFT )');
    if (start < 0 || end < 0) throw new Error('three.js shadow chunk changed: PCSS not installed');
    chunk = chunk.slice(0, start) + '#if defined( SHADOWMAP_TYPE_PCF )\n\t\t\tshadow = pcssShadow( shadowMap, shadowMapSize, shadowCoord );\n\t\t' + chunk.slice(end);
    THREE.ShaderChunk.shadowmap_pars_fragment = chunk;
  }
  return { penumbra, searchUV };
}
