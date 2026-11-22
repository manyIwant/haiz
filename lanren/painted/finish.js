// HAIZ · 入画 — the finish: the last pass of the painted picture, layered by what each pixel is.
//
// Not a filter over the frame. The scene writes, beside its colour, what each pixel is (art.js
// writeInfo: figure, figure part, structure, paint) and the finish treats each according to it:
//
//   paint      a soft Kuwahara (four overlapping patches, the calmest gives its colour, never a hard
//              choice — a hard one flickers; after Painted Valley's frame.js) rounds foliage, lawns and
//              ground into strokes. Its reach is the material's paint weight × a depth band: nothing at
//              your feet (blades and leaves keep their marks), most in the middle distance, little far off
//              (a block 200 m away is a few pixels: rounding it would erase it). The patch spacing is
//              continuous with depth, so there is no ring where the brush changes size
//   structure  buildings keep their edges (less rounding) and get a thin line where the depth breaks or
//              the surface creases (a wall corner, an eave, a step), drawn in a darker shade of the
//              colour under it and gone by the far campus
//   figures    left crisp, as a film inks its people: a line where the figure meets anything behind it,
//              where two of its parts meet and where a limb crosses the body (depth). Never where
//              something stands in front of it (grass at the ankles, a leaf), never a black wire: the line
//              is the colour under it gone dark and a little warm
//   grade      V2's grade (Khronos neutral tone curve, restrained saturation, split tone, vignette,
//              dither) folded in, so the painted chain costs one full-screen pass more than before, not two
//
// Debug views (window.__ruhua.art.debug(n) or ?paintdebug=n): 0 final · 1 raw (graded, no finish) ·
// 2 depth · 3 info (red figure, green paint, blue structure) · 4 lines · 5 paint only (no lines)
import * as THREE from 'three';

export const FINISH_FRAG = /* glsl */`
uniform sampler2D tColor; uniform sampler2D tInfo; uniform sampler2D tDepth; uniform sampler2D tBloom;
uniform vec2 uTexel; uniform float uNear; uniform float uFar; uniform vec2 uTan;
uniform float uRadius; uniform float uKuwa; uniform float uStruct; uniform float uInk; uniform float uBloomOn; uniform float uLineScale;
uniform int uDebug;
uniform float uExposure; uniform float uSat; uniform vec3 uShadowTone; uniform vec3 uHighTone; uniform float uVignette; uniform float uTime;
varying vec2 vUv;

float linZ(vec2 uv) { float z = texture2D(tDepth, uv).x; return uNear * uFar / (uFar - z * (uFar - uNear)); }
float rawZ(vec2 uv) { return texture2D(tDepth, uv).x; }
vec3 comp(vec3 c) { return c / (1.0 + c); }
vec3 uncomp(vec3 c) { return c / (1.0 - min(c, vec3(0.985))); }

// soft Kuwahara over a 5×5 (r = 2) or 3×3 (r = 1) footprint, s texels apart
vec3 kuwahara(vec2 uv, float s, vec3 centre) {
  vec3 m0 = vec3(0.0), m1 = vec3(0.0), m2 = vec3(0.0), m3 = vec3(0.0);
  vec3 s0 = vec3(0.0), s1 = vec3(0.0), s2 = vec3(0.0), s3 = vec3(0.0);
  int R = int(uRadius);
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      if (abs(i) > R || abs(j) > R) continue;
      vec3 c = (i == 0 && j == 0) ? comp(centre) : comp(texture2D(tColor, uv + vec2(float(i), float(j)) * uTexel * s).rgb);
      vec3 cc = c * c;
      if (i <= 0 && j <= 0) { m0 += c; s0 += cc; }
      if (i >= 0 && j <= 0) { m1 += c; s1 += cc; }
      if (i <= 0 && j >= 0) { m2 += c; s2 += cc; }
      if (i >= 0 && j >= 0) { m3 += c; s3 += cc; }
    }
  }
  float n = (uRadius + 1.0) * (uRadius + 1.0);
  vec3 sum = vec3(0.0); float tot = 0.0;
  vec3 mm[4]; mm[0] = m0; mm[1] = m1; mm[2] = m2; mm[3] = m3;
  vec3 ss[4]; ss[0] = s0; ss[1] = s1; ss[2] = s2; ss[3] = s3;
  for (int k = 0; k < 4; k++) {
    vec3 mean = mm[k] / n;
    vec3 v3 = abs(ss[k] / n - mean * mean);
    float v = v3.r + v3.g + v3.b;
    float w = 1.0 / (1e-7 + v * v * v * v * 1e12);
    sum += mean * w; tot += w;
  }
  return uncomp(sum / tot);
}

// neutral tone curve (Khronos PBR Neutral), as lanren/ruhua-stroll/post.js
vec3 neutral(vec3 c) {
  const float start = 0.76, desat = 0.15;
  float x = min(c.r, min(c.g, c.b));
  float off = x < 0.08 ? x - 6.25 * x * x : 0.04;
  c -= off;
  float peak = max(c.r, max(c.g, c.b));
  if (peak < start) return c;
  float d = 1.0 - start;
  float np = 1.0 - d * d / (peak + d - start);
  c *= np / peak;
  float g = 1.0 - 1.0 / (desat * (peak - np) + 1.0);
  return mix(c, vec3(np), g);
}
vec3 srgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
vec3 grade(vec3 c) {
  c = neutral(max(c * uExposure, 0.0));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  c *= mix(uShadowTone, uHighTone, smoothstep(0.05, 0.75, l));
  vec2 q = vUv - 0.5;
  c *= 1.0 - uVignette * smoothstep(0.25, 0.9, dot(q, q) * 2.2);
  return srgb(clamp(c, 0.0, 1.0)) + (hash(gl_FragCoord.xy) - 0.5) / 255.0;
}

void main() {
  vec3 col = texture2D(tColor, vUv).rgb;
  vec4 info = texture2D(tInfo, vUv);
  float z0 = rawZ(vUv);
  float d0 = linZ(vUv);
  bool sky = z0 >= 0.99999;
  if (uDebug == 1) { gl_FragColor = vec4(grade(col + (uBloomOn > 0.5 ? texture2D(tBloom, vUv).rgb : vec3(0.0))), 1.0); return; }
  if (uDebug == 2) { float v = sky ? 1.0 : log(d0) / log(uFar); gl_FragColor = vec4(vec3(1.0 - v), 1.0); return; }
  if (uDebug == 3) { gl_FragColor = vec4(info.r, info.a * 0.85, info.b, 1.0); return; }

  // ---- paint: how far the brush reaches here
  float fig = info.r;
  float near = smoothstep(1.2, 5.5, d0);
  float far = 1.0 - smoothstep(140.0, 520.0, d0);
  float reach = sky ? 0.0 : info.a * near * mix(0.35, 1.0, far) * (1.0 - smoothstep(0.25, 0.6, fig)) * mix(1.0, 0.3, info.b) * uKuwa;
  vec3 c = col;
  // the patch spacing never passes ~0.8 texel: rounding, not blocks (a wider spacing turns leaves into squares)
  if (reach > 0.02) c = kuwahara(vUv, mix(0.3, 0.82, reach), col);
  if (uBloomOn > 0.5) c += texture2D(tBloom, vUv).rgb;

  // ---- lines (nothing to draw in the sky, past the far fade, or with both line kinds off: skip the taps)
  bool anyLine = !sky && (uStruct > 0.001 || uInk > 0.001) && (d0 < 150.0 || fig > 0.01) && uDebug != 5;
  if (!anyLine && uDebug != 4) { gl_FragColor = vec4(grade(c), 1.0); return; }
  float lw = uLineScale;
  vec2 o1 = vec2(uTexel.x, 0.0) * lw, o2 = vec2(0.0, uTexel.y) * lw;
  float dl = linZ(vUv - o1), dr = linZ(vUv + o1), dd = linZ(vUv - o2), du = linZ(vUv + o2);
  vec4 il = texture2D(tInfo, vUv - o1), ir = texture2D(tInfo, vUv + o1), id = texture2D(tInfo, vUv - o2), iu = texture2D(tInfo, vUv + o2);
  // structure: depth breaks (relative) and creases (the second difference of 1/depth: zero on a plane)
  // the line belongs to the structure itself (a crown in front of a wall is not outlined)
  float structW = smoothstep(0.3, 0.9, info.b);
  float brk = max(max(abs(dl - d0), abs(dr - d0)), max(abs(dd - d0), abs(du - d0))) / d0;
  float w0 = 1.0 / d0;
  float lap = (abs(1.0 / dl + 1.0 / dr - 2.0 * w0) + abs(1.0 / dd + 1.0 / du - 2.0 * w0)) / w0;
  float edgeS = max(smoothstep(0.035, 0.1, brk), smoothstep(0.005, 0.014, lap) * 0.55);
  // only on the nearer side of a break (the line belongs to the thing in front)
  float nearer = step(d0, min(min(dl, dr), min(dd, du)) * 1.02 + 0.05);
  float sLine = sky ? 0.0 : edgeS * structW * (1.0 - smoothstep(45.0, 150.0, d0)) * uStruct * mix(0.45, 1.0, nearer) * (1.0 - fig);
  // figures: a line where the figure meets what is behind it, where its parts meet, where a limb crosses
  float ink = 0.0;
  {
    vec4 nb[4]; nb[0] = il; nb[1] = ir; nb[2] = id; nb[3] = iu;
    float nd[4]; nd[0] = dl; nd[1] = dr; nd[2] = dd; nd[3] = du;
    for (int k = 0; k < 4; k++) {
      float a = fig, b = nb[k].r;
      if (max(a, b) < 0.5) continue;
      if (min(a, b) < 0.5) {
        // silhouette: only when the figure is the nearer one (no line round a blade of grass in front)
        bool figHere = a > b;
        bool figNear = figHere ? d0 < nd[k] : nd[k] < d0;
        if (figNear && figHere) ink = max(ink, 1.0);
      } else {
        float part = abs(info.g - nb[k].g);
        float step_ = abs(nd[k] - d0) / d0;
        ink = max(ink, max(smoothstep(0.02, 0.05, part), smoothstep(0.03, 0.09, step_) * step(d0, nd[k])));
      }
    }
    ink *= uInk * (1.0 - smoothstep(30.0, 70.0, d0));
  }
  if (uDebug == 4) { gl_FragColor = vec4(vec3(1.0 - max(sLine, ink)), 1.0); return; }
  if (uDebug != 5) {
    c = mix(c, c * vec3(0.5, 0.46, 0.5), sLine * 0.75);
    c = mix(c, min(c, vec3(1.2)) * vec3(0.24, 0.17, 0.18), ink * 0.9);
  }
  gl_FragColor = vec4(grade(c), 1.0);
}`;

export function createFinish({ tier = 'high' } = {}) {
  const uniforms = {
    tColor: { value: null }, tInfo: { value: null }, tDepth: { value: null }, tBloom: { value: null },
    uTexel: { value: new THREE.Vector2(1, 1) }, uNear: { value: 0.1 }, uFar: { value: 6000 }, uTan: { value: new THREE.Vector2(1, 1) },
    uRadius: { value: tier === 'low' ? 1 : 2 }, uKuwa: { value: 1 }, uStruct: { value: 1 }, uInk: { value: 1 }, uBloomOn: { value: 1 }, uLineScale: { value: 1 },
    uDebug: { value: 0 },
    // the grade (shared with the pipeline's gradeB uniforms at wiring time)
    uExposure: { value: 1 }, uSat: { value: 1.06 }, uShadowTone: { value: new THREE.Color(0.95, 0.98, 1.06) }, uHighTone: { value: new THREE.Color(1.03, 1.0, 0.96) },
    uVignette: { value: 0.2 }, uTime: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: FINISH_FRAG,
    depthTest: false, depthWrite: false,
  });
  return { material, uniforms };
}
