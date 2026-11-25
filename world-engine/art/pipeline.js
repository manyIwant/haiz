// HAIZ World Engine — Unified Multi-Lens Rendering Pipeline
//
// Single-scene, multi-medium compositor:
//   1. Renders the shared 3D campus ONCE per frame into a HalfFloat HDR + Depth render target.
//   2. Runs UnrealBloomPass in place.
//   3. Runs optional half-res SSAO + depth-aware bilateral blur, lens grading, structure-tensor
//      anisotropic Kuwahara brushwork (skipped cleanly when paint === 0!), and a bespoke
//      HAIZ Multi-Lens Finish shader supporting:
//        - Six cohesive art mediums (Gouache, Ink & Wash, Realist, Archival Memory, Nocturne, Dream)
//        - Organic painterly brush-wave transition when switching lenses
//        - Live A/B split-screen comparison wipe for the Engineering & Art Inspection Workbench

import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { LABM } from '../../lanren/painted-lab/material.js';
import { getLens } from './lenses.js';

const VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const COMMON = /* glsl */`
uniform float uNear; uniform float uFar;
float linD(float z) { return (uNear * uFar) / (uFar - z * (uFar - uNear)); }
float h12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = h12(i), b = h12(i + vec2(1.0, 0.0));
  float c = h12(i + vec2(0.0, 1.0)), d = h12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm2(vec2 p) {
  return vNoise(p) * 0.62 + vNoise(p * 2.13 + 7.4) * 0.38;
}
vec3 neutralTone(vec3 c) {
  const float startCompression = 0.8 - 0.04;
  const float desaturation = 0.15;
  float x = min(c.r, min(c.g, c.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  c -= offset;
  float peak = max(c.r, max(c.g, c.b));
  if (peak < startCompression) return max(c, 0.0);
  float d = 1.0 - startCompression;
  float newPeak = 1.0 - d * d / (peak + d - startCompression);
  c *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return max(mix(c, vec3(newPeak), g), 0.0);
}
vec3 toSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, pow(c, vec3(1.0 / 2.4)) * 1.055 - 0.055, step(vec3(0.0031308), c));
}
`;

// Compact 8-tap screen-space ambient occlusion for chromatic shadow wash
const AO_FRAG = /* glsl */`
${COMMON}
uniform sampler2D tDepth;
uniform vec2 uRes;
varying vec2 vUv;
void main() {
  float raw = texture2D(tDepth, vUv).r;
  if (raw >= 0.9999) { gl_FragColor = vec4(1.0); return; }
  float d = linD(raw);
  float rad = clamp(18.0 / max(d, 2.0), 1.5, 11.0);
  float ang = h12(gl_FragCoord.xy) * 6.28318;
  float occ = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = ang + float(i) * 2.39996;
    float r = rad * (float(i) + 0.5) / 8.0;
    vec2 uv = clamp(vUv + vec2(cos(a), sin(a)) * r / uRes, 0.0, 1.0);
    float sd = linD(texture2D(tDepth, uv).r);
    float diff = d - sd;
    if (diff > 0.08 && diff < 3.6) {
      occ += smoothstep(0.08, 0.9, diff) * (1.0 - smoothstep(1.2, 3.6, diff));
    }
  }
  float ao = 1.0 - clamp(occ * 0.24, 0.0, 0.72) * (1.0 - smoothstep(35.0, 140.0, d));
  gl_FragColor = vec4(ao, ao, ao, 1.0);
}
`;

const GRADE_FRAG = /* glsl */`
${COMMON}
uniform sampler2D tHDR;
uniform sampler2D tDepth;
uniform sampler2D tAO;
uniform float uExposure;
uniform float uSat;
uniform float uWash;
uniform float uPlanes;
uniform vec3 uShadeHue;
uniform vec3 uKey;
varying vec2 vUv;
void main() {
  vec3 c = max(texture2D(tHDR, vUv).rgb * uExposure, 0.0);
  float raw = texture2D(tDepth, vUv).r;
  float d = raw >= 0.9999 ? 9999.0 : linD(raw);
  float ao = texture2D(tAO, vUv).r;
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // Chromatic AO shadow glaze (masked out of bright sunlit surfaces; strictly edge0 < edge1!)
  float glaze = (1.0 - ao) * uWash * (1.0 - smoothstep(0.18, 1.3, luma));
  c = mix(c, c * mix(vec3(0.55), uShadeHue * 1.15, 0.65), glaze * 0.72);
  // Subtle depth plane tonal simplification for painterly clarity
  if (uPlanes > 0.01 && raw < 0.9999) {
    float farMix = smoothstep(55.0, 260.0, d) * 0.22 * uPlanes;
    c = mix(c, mix(c, uKey * 0.92, 0.45), farMix);
  }
  c = neutralTone(c);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  gl_FragColor = vec4(toSrgb(clamp(c, 0.0, 1.0)), 1.0);
}
`;

// Structure tensor + 8-sector lightweight Kuwahara paint simplification
const TENSOR_FRAG = /* glsl */`
uniform sampler2D tSrc;
uniform vec2 uRes;
varying vec2 vUv;
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
void main() {
  vec2 e = 1.0 / uRes;
  float tl = lum(texture2D(tSrc, vUv + vec2(-e.x,  e.y)).rgb);
  float tc = lum(texture2D(tSrc, vUv + vec2( 0.0,  e.y)).rgb);
  float tr = lum(texture2D(tSrc, vUv + vec2( e.x,  e.y)).rgb);
  float ml = lum(texture2D(tSrc, vUv + vec2(-e.x,  0.0)).rgb);
  float mr = lum(texture2D(tSrc, vUv + vec2( e.x,  0.0)).rgb);
  float bl = lum(texture2D(tSrc, vUv + vec2(-e.x, -e.y)).rgb);
  float bc = lum(texture2D(tSrc, vUv + vec2( 0.0, -e.y)).rgb);
  float br = lum(texture2D(tSrc, vUv + vec2( e.x, -e.y)).rgb);
  float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
  float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
  gl_FragColor = vec4(gx * gx, gy * gy, gx * gy, 1.0);
}
`;

function kuwaharaFrag(maxR) {
  return /* glsl */`
uniform sampler2D tSrc;
uniform sampler2D tTensor;
uniform vec2 uRes;
uniform vec2 uRadius;
varying vec2 vUv;
void main() {
  vec3 t = texture2D(tTensor, vUv).rgb;
  float a = 0.5 * atan(2.0 * t.z, t.x - t.y);
  float ca = cos(a), sa = sin(a);
  float trace = t.x + t.y;
  float aniso = trace > 1e-4 ? clamp(sqrt(max(0.0, (t.x - t.y) * (t.x - t.y) + 4.0 * t.z * t.z)) / trace, 0.0, 0.85) : 0.0;
  float r = clamp(mix(uRadius.x, uRadius.y, 0.5), 1.0, float(${maxR}));
  float sx = 1.0 + aniso * 0.75;
  float sy = 1.0 / sx;
  vec2 inv = 1.0 / uRes;

  vec3 m0 = vec3(0.0), s0 = vec3(0.0);
  vec3 m1 = vec3(0.0), s1 = vec3(0.0);
  vec3 m2 = vec3(0.0), s2 = vec3(0.0);
  vec3 m3 = vec3(0.0), s3 = vec3(0.0);
  float w0 = 0.0, w1 = 0.0, w2 = 0.0, w3 = 0.0;

  for (int j = -${maxR}; j <= ${maxR}; j++) {
    if (abs(float(j)) > r) continue;
    for (int i = -${maxR}; i <= ${maxR}; i++) {
      if (abs(float(i)) > r) continue;
      vec2 p = vec2(float(i) * sx, float(j) * sy);
      if (dot(p, p) > r * r * 1.45) continue;
      vec2 off = vec2(ca * p.x - sa * p.y, sa * p.x + ca * p.y) * inv;
      vec3 c = texture2D(tSrc, clamp(vUv + off, 0.0, 1.0)).rgb;
      if (i <= 0 && j <= 0) { m0 += c; s0 += c * c; w0 += 1.0; }
      if (i >= 0 && j <= 0) { m1 += c; s1 += c * c; w1 += 1.0; }
      if (i <= 0 && j >= 0) { m2 += c; s2 += c * c; w2 += 1.0; }
      if (i >= 0 && j >= 0) { m3 += c; s3 += c * c; w3 += 1.0; }
    }
  }
  m0 /= max(w0, 1.0); s0 = abs(s0 / max(w0, 1.0) - m0 * m0);
  m1 /= max(w1, 1.0); s1 = abs(s1 / max(w1, 1.0) - m1 * m1);
  m2 /= max(w2, 1.0); s2 = abs(s2 / max(w2, 1.0) - m2 * m2);
  m3 /= max(w3, 1.0); s3 = abs(s3 / max(w3, 1.0) - m3 * m3);

  float v0 = s0.r + s0.g + s0.b;
  float v1 = s1.r + s1.g + s1.b;
  float v2 = s2.r + s2.g + s2.b;
  float v3 = s3.r + s3.g + s3.b;
  float q = 14.0;
  float wt0 = exp(-v0 * q), wt1 = exp(-v1 * q), wt2 = exp(-v2 * q), wt3 = exp(-v3 * q);
  vec3 outCol = (m0 * wt0 + m1 * wt1 + m2 * wt2 + m3 * wt3) / max(wt0 + wt1 + wt2 + wt3, 1e-4);
  gl_FragColor = vec4(outCol, 1.0);
}
`;
}

// Bespoke HAIZ Multi-Lens Finish + Painterly Brush-Wave Transition + A/B Split Wipe
const FINISH_FRAG = /* glsl */`
${COMMON}
uniform sampler2D tPaint;
uniform sampler2D tBase;
uniform sampler2D tPrev;
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uTime;
uniform float uPaintBlend;
uniform float uInk;
uniform float uInkMix;
uniform float uPaper;
uniform float uPaperWash;
uniform float uMargin;
uniform float uSepiaMix;
uniform float uNocturneMix;
uniform float uDreamMix;
uniform float uVignette;
uniform float uGrain;
uniform vec3 uTint;
uniform vec3 uPaperColor;
uniform vec3 uInkColor;
uniform float uSplit;        // >= 0 enables A/B split-screen comparison against tBase
uniform float uTrans;        // [0..1] painterly brush-wave transition from tPrev -> current
uniform vec2 uTransOrigin;   // UV origin of the brush-wave sweep
varying vec2 vUv;

float edgeInk(vec2 uv) {
  vec2 e = 1.15 / uRes;
  float dC = linD(texture2D(tDepth, uv).r);
  float dL = linD(texture2D(tDepth, uv - vec2(e.x, 0.0)).r);
  float dR = linD(texture2D(tDepth, uv + vec2(e.x, 0.0)).r);
  float dU = linD(texture2D(tDepth, uv + vec2(0.0, e.y)).r);
  float dD = linD(texture2D(tDepth, uv - vec2(0.0, e.y)).r);
  float rel = (abs(dL - dC) + abs(dR - dC) + abs(dU - dC) + abs(dD - dC)) / max(dC, 1.5);
  float depthEdge = smoothstep(0.11, 0.34, rel) * (1.0 - smoothstep(110.0, 280.0, dC));

  vec3 cL = texture2D(tBase, uv - vec2(e.x, 0.0)).rgb;
  vec3 cR = texture2D(tBase, uv + vec2(e.x, 0.0)).rgb;
  vec3 cU = texture2D(tBase, uv + vec2(0.0, e.y)).rgb;
  vec3 cD = texture2D(tBase, uv - vec2(0.0, e.y)).rgb;
  float lEdge = length(cR - cL) + length(cU - cD);
  float lumaEdge = smoothstep(0.24, 0.62, lEdge) * 0.65;
  return clamp(max(depthEdge, lumaEdge), 0.0, 1.0);
}

void main() {
  vec3 baseCol = texture2D(tBase, vUv).rgb;
  vec3 paintCol = texture2D(tPaint, vUv).rgb;
  vec3 c = mix(baseCol, paintCol, uPaintBlend);

  float luma = dot(c, vec3(0.299, 0.587, 0.114));

  // 1. Archival Memory sepia-leaf film tone
  if (uSepiaMix > 0.001) {
    vec3 arch = vec3(
      dot(c, vec3(0.41, 0.50, 0.15)),
      dot(c, vec3(0.32, 0.53, 0.14)),
      dot(c, vec3(0.22, 0.38, 0.24))
    );
    arch = mix(vec3(0.09, 0.08, 0.065), arch * 1.04, 0.94);
    c = mix(c, arch, uSepiaMix);
  }

  // 2. Nocturne Study-Light discipline: cool deep tropical shadow, preserve warm lit windows
  if (uNocturneMix > 0.001) {
    float warmMask = smoothstep(0.55, 0.95, c.r - c.b * 0.55) * smoothstep(0.32, 0.72, luma);
    vec3 nightShade = c * vec3(0.66, 0.77, 0.92);
    vec3 warmGlow = c * vec3(1.22, 1.07, 0.84);
    c = mix(c, mix(nightShade, warmGlow, warmMask), uNocturneMix);
  }

  // 3. Terminalia Reverie (Dream): warm golden-jade lift in midtones & soft highlights
  if (uDreamMix > 0.001) {
    vec3 jadeShadow = mix(c, vec3(0.16, 0.31, 0.27) * max(luma * 1.35, 0.22), (1.0 - luma) * 0.42);
    vec3 goldLight = jadeShadow * mix(vec3(1.0), vec3(1.12, 1.04, 0.88), smoothstep(0.35, 0.88, luma));
    c = mix(c, goldLight, uDreamMix);
  }

  // 4. Ink & Wash paper wash (lifts pale areas into warm #f4f1e8 sketchbook paper)
  if (uPaperWash > 0.001) {
    float hi = smoothstep(0.28, 0.96, luma);
    vec3 washCol = mix(c, mix(c, uPaperColor, 0.45 + 0.35 * hi), uPaperWash);
    c = washCol;
  }

  // 5. Colored contour ink lines (Sobel depth + luminance creases)
  if (uInk > 0.001) {
    float ink = edgeInk(vUv) * uInk;
    c = mix(c, mix(c * 0.55, uInkColor, 0.78), ink * clamp(uInkMix + 0.35, 0.0, 0.95));
  }

  // 6. Subtle lens color tint
  c *= uTint;

  // 7. Paper tooth & fine film/linen grain (world-anchored screen fiber)
  if (uPaper > 0.001 || uGrain > 0.001) {
    vec2 px = gl_FragCoord.xy;
    float fiber = (vNoise(px * 0.38) - 0.5) * 0.6 + (vNoise(px * vec2(0.14, 0.65) + 19.1) - 0.5) * 0.4;
    c += fiber * (0.042 * uPaper);
    float g = (h12(px + fract(uTime * 17.3) * 100.0) - 0.5) * uGrain;
    c += g;
  }

  // 8. Soft sketchbook paper margin & vignette
  vec2 centered = vUv * 2.0 - 1.0;
  float r2 = dot(centered * vec2(1.0, 0.9), centered * vec2(1.0, 0.9));
  if (uVignette > 0.001) {
    c *= 1.0 - smoothstep(0.45, 1.65, r2) * uVignette;
  }
  if (uMargin > 0.001) {
    float border = max(abs(centered.x), abs(centered.y));
    float edgeW = fbm2(vUv * 18.0 + 3.1) * 0.045;
    float mask = smoothstep(0.92 - edgeW, 0.995 - edgeW, border) * uMargin;
    c = mix(c, uPaperColor, mask * 0.85);
  }

  // 9. Painterly Brush-Wave Transition from previous lens (uTrans ∈ [0..1])
  if (uTrans < 0.999) {
    vec3 prevCol = texture2D(tPrev, vUv).rgb;
    float aspect = uRes.x / max(uRes.y, 1.0);
    vec2 d = (vUv - uTransOrigin) * vec2(aspect, 1.0);
    float dist = length(d);
    float brushNoise = (fbm2(vUv * vec2(14.0, 9.0) + vec2(uTrans * 1.4, 0.0)) - 0.5) * 0.28;
    float radius = uTrans * (1.55 * max(aspect, 1.0) + 0.35);
    float reveal = 1.0 - smoothstep(radius - 0.14, radius + 0.06, dist + brushNoise);
    // Subtle wet pigment rim along the sweeping brush frontier
    float rim = smoothstep(radius - 0.16, radius - 0.03, dist + brushNoise) * (1.0 - smoothstep(radius - 0.03, radius + 0.06, dist + brushNoise));
    c = mix(prevCol, c, reveal);
    c = mix(c, uInkColor * 0.75 + uPaperColor * 0.35, rim * 0.24);
  }

  // 10. Optional A/B Split-Screen Wipe for Workbench inspection
  if (uSplit >= 0.0) {
    if (vUv.x < uSplit) c = baseCol;
    float lineDist = abs(vUv.x - uSplit) * uRes.x;
    c = mix(c, vec3(0.96, 0.94, 0.90), 1.0 - smoothstep(0.8, 2.0, lineDist));
  }

  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

export const PIPELINE_TIERS = Object.freeze({
  high: { maxR: 6, paintPR: 1.25, aoScale: 0.5, samples: 4 },
  medium: { maxR: 5, paintPR: 1.0, aoScale: 0.5, samples: 2 },
  low: { maxR: 4, paintPR: 0.75, aoScale: 0.38, samples: 0 },
});

function makeQuadMat(fragmentShader, uniforms) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
}

export function createWorldPipeline(renderer, { tier = 'high', reduceMotion = false } = {}) {
  const T = PIPELINE_TIERS[tier] || PIPELINE_TIERS.high;
  const depth = new THREE.DepthTexture(1, 1);
  depth.type = THREE.UnsignedIntType;
  const hdr = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: T.samples,
    depthTexture: depth,
  });
  const lin = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  const ao = new THREE.WebGLRenderTarget(1, 1, lin);
  const base = new THREE.WebGLRenderTarget(1, 1, lin);
  const ten = new THREE.WebGLRenderTarget(1, 1, { ...lin, type: THREE.HalfFloatType });
  const paint = new THREE.WebGLRenderTarget(1, 1, lin);
  const prev = new THREE.WebGLRenderTarget(1, 1, lin);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.2, 0.6, 1.7);
  const quad = new FullScreenQuad();

  const M = {
    ao: makeQuadMat(AO_FRAG, {
      tDepth: { value: depth },
      uRes: { value: new THREE.Vector2(1, 1) },
      uNear: { value: 0.1 },
      uFar: { value: 6000 },
    }),
    grade: makeQuadMat(GRADE_FRAG, {
      tHDR: { value: hdr.texture },
      tDepth: { value: depth },
      tAO: { value: ao.texture },
      uNear: { value: 0.1 },
      uFar: { value: 6000 },
      uExposure: { value: 1.0 },
      uSat: { value: 1.0 },
      uWash: { value: 0.9 },
      uPlanes: { value: 0.8 },
      uShadeHue: { value: new THREE.Color(0x526b7a) },
      uKey: { value: new THREE.Color(0xc8d8e4) },
    }),
    tensor: makeQuadMat(TENSOR_FRAG, {
      tSrc: { value: base.texture },
      uRes: { value: new THREE.Vector2(1, 1) },
    }),
    kuwa: makeQuadMat(kuwaharaFrag(T.maxR), {
      tSrc: { value: base.texture },
      tTensor: { value: ten.texture },
      uRes: { value: new THREE.Vector2(1, 1) },
      uRadius: { value: new THREE.Vector2(2.0, 4.0) },
    }),
    finish: makeQuadMat(FINISH_FRAG, {
      tPaint: { value: paint.texture },
      tBase: { value: base.texture },
      tPrev: { value: prev.texture },
      tDepth: { value: depth },
      uRes: { value: new THREE.Vector2(1, 1) },
      uNear: { value: 0.1 },
      uFar: { value: 6000 },
      uTime: { value: 0 },
      uPaintBlend: { value: 0.72 },
      uInk: { value: 0.25 },
      uInkMix: { value: 0.16 },
      uPaper: { value: 0.42 },
      uPaperWash: { value: 0.0 },
      uMargin: { value: 0.0 },
      uSepiaMix: { value: 0.0 },
      uNocturneMix: { value: 0.0 },
      uDreamMix: { value: 0.0 },
      uVignette: { value: 0.18 },
      uGrain: { value: 0.018 },
      uTint: { value: new THREE.Vector3(1, 1, 1) },
      uPaperColor: { value: new THREE.Vector3(0.957, 0.945, 0.910) },
      uInkColor: { value: new THREE.Vector3(0.122, 0.227, 0.188) },
      uSplit: { value: -1 },
      uTrans: { value: 1 },
      uTransOrigin: { value: new THREE.Vector2(0.5, 0.5) },
    }),
  };

  const size = new THREE.Vector2(1, 1);
  const paintSize = new THREE.Vector2(1, 1);
  let activeLens = getLens('gouache');
  let transProgress = 1;
  let needCapturePrev = false;
  let time = 0;
  let pxPaint = 1;
  let baseExposure = 1.0;
  let baseSat = 1.0;
  let baseBloom = 0.2;
  let overrides = null;

  function run(material, target) {
    quad.material = material;
    renderer.setRenderTarget(target);
    quad.render(renderer);
  }

  function applyLensUniforms(lens) {
    const p = { ...lens.post, ...(overrides || {}) };
    const m = lens.mat;
    LABM.uLabMat.value.set(m.core, m.brush, m.broken, m.master);
    LABM.uBrushPx.value = m.brushPx;
    LABM.uLabLight.value = m.light;

    M.grade.uniforms.uExposure.value = baseExposure * p.exposureMul;
    M.grade.uniforms.uSat.value = baseSat * p.satMul;
    M.grade.uniforms.uWash.value = p.wash;
    M.grade.uniforms.uPlanes.value = p.planes;
    bloom.strength = baseBloom * p.bloomMul;

    const fu = M.finish.uniforms;
    fu.uPaintBlend.value = p.paint;
    fu.uInk.value = p.ink;
    fu.uInkMix.value = p.inkMix;
    fu.uPaper.value = p.paper;
    fu.uPaperWash.value = p.paperWash;
    fu.uMargin.value = p.margin;
    fu.uSepiaMix.value = p.sepiaMix;
    fu.uNocturneMix.value = p.nocturneMix;
    fu.uDreamMix.value = p.dreamMix;
    fu.uVignette.value = p.vignette;
    fu.uGrain.value = p.grain;
    fu.uTint.value.set(...p.tint);
    fu.uPaperColor.value.set(...p.paperColor);
    fu.uInkColor.value.set(...p.inkColor);
  }

  function setSize(w, h, pr = Math.min(devicePixelRatio || 1, 2)) {
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    renderer.getDrawingBufferSize(size);
    hdr.setSize(size.x, size.y);
    base.setSize(size.x, size.y);
    prev.setSize(size.x, size.y);
    ao.setSize(Math.max(1, Math.ceil(size.x * T.aoScale)), Math.max(1, Math.ceil(size.y * T.aoScale)));
    const pk = Math.min(1, T.paintPR / Math.max(pr, 0.5));
    paintSize.set(Math.max(1, Math.round(size.x * pk)), Math.max(1, Math.round(size.y * pk)));
    ten.setSize(paintSize.x, paintSize.y);
    paint.setSize(paintSize.x, paintSize.y);
    bloom.setSize(size.x, size.y);
    pxPaint = paintSize.x / Math.max(w, 1);
  }

  function setLens(lensId, { animate = true, origin = [0.5, 0.5] } = {}) {
    const next = getLens(lensId);
    if (next.id === activeLens.id) return activeLens;
    if (animate && !reduceMotion) {
      needCapturePrev = true;
      transProgress = 0;
      M.finish.uniforms.uTransOrigin.value.set(origin[0], origin[1]);
    } else {
      transProgress = 1;
    }
    activeLens = next;
    applyLensUniforms(activeLens);
    return activeLens;
  }

  function setMood({ exposure = 1, sat = 1, bloomStrength = 0.2, shadeHue, horizon }) {
    baseExposure = exposure;
    baseSat = sat;
    baseBloom = bloomStrength;
    if (shadeHue) M.grade.uniforms.uShadeHue.value.copy(shadeHue);
    if (horizon) M.grade.uniforms.uKey.value.copy(horizon);
    applyLensUniforms(activeLens);
  }

  function setOverrides(patch) {
    overrides = patch ? { ...(overrides || {}), ...patch } : null;
    applyLensUniforms(activeLens);
  }

  function tick(dt) {
    time += dt;
    if (transProgress < 1) {
      transProgress = Math.min(1, transProgress + dt / 0.85);
    }
  }

  function render(scene, camera, { split = -1 } = {}) {
    // If a lens transition was just requested, capture the previous lens output once before switching
    if (needCapturePrev) {
      needCapturePrev = false;
      M.finish.uniforms.uTrans.value = 1;
      M.finish.uniforms.uSplit.value = -1;
      run(M.finish, prev);
    }

    renderer.setRenderTarget(hdr);
    renderer.clear();
    renderer.render(scene, camera);
    if (bloom.strength > 0.01) {
      bloom.render(renderer, null, hdr, 0, false);
    }

    const near = camera.near;
    const far = camera.far;
    for (const mat of [M.ao, M.grade, M.finish]) {
      mat.uniforms.uNear.value = near;
      mat.uniforms.uFar.value = far;
    }

    const post = { ...activeLens.post, ...(overrides || {}) };
    if (post.wash > 0.01) {
      M.ao.uniforms.uRes.value.copy(size);
      run(M.ao, ao);
    }

    M.grade.uniforms.uWash.value = post.wash;
    run(M.grade, base);

    let paintTex = base.texture;
    if (post.paint > 0.01 && (post.kuwaFar || 0) > 0.1) {
      M.tensor.uniforms.tSrc.value = base.texture;
      M.tensor.uniforms.uRes.value.copy(paintSize);
      run(M.tensor, ten);
      M.kuwa.uniforms.tSrc.value = base.texture;
      M.kuwa.uniforms.tTensor.value = ten.texture;
      M.kuwa.uniforms.uRes.value.copy(paintSize);
      M.kuwa.uniforms.uRadius.value.set(
        Math.max(1, post.kuwaNear * pxPaint),
        Math.max(1.2, post.kuwaFar * pxPaint),
      );
      run(M.kuwa, paint);
      paintTex = paint.texture;
    }

    const fu = M.finish.uniforms;
    fu.tPaint.value = paintTex;
    fu.tBase.value = base.texture;
    fu.uRes.value.copy(size);
    fu.uTime.value = time % 1000;
    fu.uSplit.value = split;
    fu.uTrans.value = transProgress;
    run(M.finish, null);
  }

  applyLensUniforms(activeLens);

  return {
    setSize,
    setLens,
    setMood,
    setOverrides,
    tick,
    render,
    get lens() { return activeLens; },
    get tier() { return tier; },
    get size() { return size.clone(); },
  };
}
