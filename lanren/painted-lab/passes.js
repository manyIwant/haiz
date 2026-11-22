// 入画 · 画境实验室 — the picture layer.
//
// Same scene, same bloom, same Khronos-neutral tone curve and split tone as the V2 walk
// (lanren/ruhua-stroll/post.js), so the lab can be compared with the original line for line. What is
// added sits between the render and the screen, in the order a painter would think about it:
//
//   wash    遮蔽色    ambient occlusion from the depth buffer — but applied the way a painter glazes
//                     a recess: the colour moves toward the mood's shade hue at the same value,
//                     and only then darkens a little. Never grey, never a black halo
//   planes  空间层次   three depth planes. The far plane's values are pulled together toward the
//                     sky's key (distant things never have the near field's darks); the near plane
//                     gains a little chroma. The atmosphere V2 already paints stays as it is
//   paint   油彩       anisotropic Kuwahara filter (Kyprianidis, Kang & Döllner 2009; polynomial
//                     sector weights, Kyprianidis 2011): strokes follow the local structure tensor,
//                     so window bands, eaves and leaf masses become directional marks instead of
//                     blur. The stroke radius grows with distance — the near field keeps its
//                     detail, the far field is simplified to shapes, as in a plein-air study
//   line    线         a coloured line (never black) where depth jumps or a surface folds; heavier
//                     near, fading into the air with distance; only on the near side of an edge
//   paper   纸         a fixed sheet: fine grain that settles into the darker passages, and pigment
//                     that gathers slightly where one colour meets another
//
// All passes are full-screen quads on WebGL2 render targets; nothing reads back to the CPU.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Grade } from '../ruhua-stroll/post.js';

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const COMMON = /* glsl */`
#include <packing>
uniform float uNear; uniform float uFar;
float viewDist(sampler2D t, vec2 uv) { return -perspectiveDepthToViewZ(texture2D(t, uv).x, uNear, uFar); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float h12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
`;

const AO = {
  uniforms: { tDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uProj: { value: new THREE.Matrix4() }, uProjInv: { value: new THREE.Matrix4() },
    uRadius: { value: 1.1 }, uFade: { value: new THREE.Vector2(60, 180) }, uNear: { value: 0.1 }, uFar: { value: 6000 } },
  fragmentShader: /* glsl */`
${COMMON}
uniform sampler2D tDepth; uniform vec2 uRes; uniform mat4 uProj; uniform mat4 uProjInv; uniform float uRadius; uniform vec2 uFade;
varying vec2 vUv;
vec3 viewPos(vec2 uv) { float z = texture2D(tDepth, uv).x; vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0); return v.xyz / v.w; }
void main() {
  float z = texture2D(tDepth, vUv).x;
  if (z >= 0.99999) { gl_FragColor = vec4(1.0); return; }
  vec3 P = viewPos(vUv);
  vec2 px = 1.0 / uRes;
  vec3 r = viewPos(vUv + vec2(px.x, 0.0)) - P, l = P - viewPos(vUv - vec2(px.x, 0.0));
  vec3 u = viewPos(vUv + vec2(0.0, px.y)) - P, d = P - viewPos(vUv - vec2(0.0, px.y));
  vec3 Nv = normalize(cross(abs(r.z) < abs(l.z) ? r : l, abs(u.z) < abs(d.z) ? u : d));
  float projR = clamp(uRadius * uProj[1][1] / -P.z * 0.5, 3.0 * px.y, 0.1);
  float ang = h12(gl_FragCoord.xy) * 6.2831853;
  float occ = 0.0;
  for (int i = 0; i < 12; i++) {
    float t = (float(i) + 0.5) / 12.0;
    float a = ang + float(i) * 2.3999632;
    vec2 off = vec2(cos(a) * uRes.y / uRes.x, sin(a)) * projR * sqrt(t);
    vec3 v = viewPos(vUv + off) - P;
    float vv = dot(v, v);
    float k = max(0.0, dot(v, Nv) * inversesqrt(vv + 1e-4) - 0.12);
    occ += k * (1.0 - smoothstep(0.0, uRadius * uRadius * 2.0, vv));
  }
  // a painter glazes the recesses of what is near; far away the air has already done that
  occ *= 1.0 - smoothstep(uFade.x, uFade.y, -P.z);
  gl_FragColor = vec4(vec3(clamp(1.0 - occ / 12.0 * 2.2, 0.0, 1.0)), 1.0);
}`,
};

const AOBLUR = {
  uniforms: { tAO: { value: null }, tDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uNear: { value: 0.1 }, uFar: { value: 6000 } },
  fragmentShader: /* glsl */`
${COMMON}
uniform sampler2D tAO; uniform sampler2D tDepth; uniform vec2 uRes;
varying vec2 vUv;
void main() {
  float d0 = viewDist(tDepth, vUv);
  float s = 0.0, w = 0.0;
  for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
    vec2 uv = vUv + vec2(float(x), float(y)) / uRes;
    float d = viewDist(tDepth, uv);
    float k = exp(-abs(d - d0) / max(d0 * 0.03, 0.05));
    s += texture2D(tAO, uv).r * k; w += k;
  }
  gl_FragColor = vec4(vec3(s / max(w, 1e-4)), 1.0);
}`,
};

const LABGRADE = {
  uniforms: { tHDR: { value: null }, tAO: { value: null }, tDepth: { value: null }, uExposure: { value: 1 }, uSat: { value: 1.06 },
    uShadowTone: { value: new THREE.Color(0.95, 0.98, 1.06) }, uHighTone: { value: new THREE.Color(1.03, 1.0, 0.96) },
    uShadeHue: { value: new THREE.Color(0.6, 0.67, 1.0) }, uKey: { value: new THREE.Color(0.6, 0.75, 0.9) },
    uFocusK: { value: 0 }, uFocusD: { value: 30 }, uAspect: { value: 1.78 }, uVig: { value: 0.2 }, uWash: { value: 1 }, uPlanes: { value: 1 }, uFarPlane: { value: new THREE.Vector2(45, 320) }, uNearPlane: { value: new THREE.Vector2(4, 22) },
    uSimplify: { value: new THREE.Vector2(8, 160) }, uNear: { value: 0.1 }, uFar: { value: 6000 } },
  fragmentShader: /* glsl */`
${COMMON}
uniform sampler2D tHDR; uniform sampler2D tAO; uniform sampler2D tDepth; uniform float uExposure; uniform float uSat;
uniform vec3 uShadowTone; uniform vec3 uHighTone; uniform vec3 uShadeHue; uniform vec3 uKey;
uniform float uFocusK; uniform float uFocusD; uniform float uAspect;
uniform float uVig; uniform float uWash; uniform float uPlanes; uniform vec2 uFarPlane; uniform vec2 uNearPlane; uniform vec2 uSimplify;
varying vec2 vUv;
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
void main() {
  vec3 c = max(texture2D(tHDR, vUv).rgb * uExposure, 0.0);
  bool sky = texture2D(tDepth, vUv).x >= 0.99999;
  float d = sky ? uFar : viewDist(tDepth, vUv);
  // wash: a recess is glazed toward the shade hue at its own value, then darkened a little
  float occ = (1.0 - texture2D(tAO, vUv).r) * uWash;
  float l = luma(c);
  // occlusion belongs to the ambient light: the sunlit top of a crown or a lit sill is not glazed
  occ *= 1.0 - smoothstep(0.3, 0.9, l);
  c = mix(c, l * uShadeHue * 1.3, occ * 0.5) * (1.0 - occ * 0.38);
  c = neutral(c);
  l = luma(c);
  c = mix(vec3(l), c, uSat);
  c *= mix(uShadowTone, uHighTone, smoothstep(0.05, 0.75, l));
  if (!sky) {
    float far = smoothstep(uFarPlane.x, uFarPlane.y, d);
    float near = 1.0 - smoothstep(uNearPlane.x, uNearPlane.y, d);
    vec3 key = neutral(uKey * uExposure);
    c = mix(c, key + (c - key) * 0.6, far * 0.65 * uPlanes);
    float l2 = luma(c);
    c = mix(c, mix(vec3(l2), c, 1.14), near * uPlanes);
  }
  // alpha carries how much the painter simplifies here (0 near … 1 far), for the paint pass
  float simp = sky ? 0.55 : smoothstep(uSimplify.x, uSimplify.y, d);
  // 焦点 focus: a painter finishes the subject and lets the rest go — away from the centre of
  // interest (the frame's centre, at the subject's distance) strokes widen and colour quietens
  if (uFocusK > 0.001) {
    float radial = smoothstep(0.14, 0.7, length((vUv - 0.5) * vec2(uAspect, 1.0)));
    float depthAway = sky ? 1.0 : smoothstep(0.3, 1.3, abs(log(d / uFocusD)));
    float away = clamp(max(radial, depthAway * 0.85), 0.0, 1.0) * uFocusK;
    simp = clamp(simp + away * 0.8, 0.0, 1.0);
    float lf = luma(c);
    c = mix(c, mix(vec3(lf), c, 0.72), away);
  }
  // V2's vignette, in the same place in the chain (linear light, before encoding)
  vec2 q = vUv - 0.5;
  c *= 1.0 - uVig * smoothstep(0.25, 0.9, dot(q, q) * 2.2);
  gl_FragColor = vec4(srgb(clamp(c, 0.0, 1.0)), simp);
}`,
};

const TENSOR = {
  uniforms: { tSrc: { value: null }, uRes: { value: new THREE.Vector2(1, 1) } },
  fragmentShader: /* glsl */`
uniform sampler2D tSrc; uniform vec2 uRes;
varying vec2 vUv;
vec3 s(float x, float y) { return texture2D(tSrc, vUv + vec2(x, y) / uRes).rgb; }
void main() {
  vec3 u = (-1.0 * s(-1., -1.) - 2.0 * s(-1., 0.) - 1.0 * s(-1., 1.) + 1.0 * s(1., -1.) + 2.0 * s(1., 0.) + 1.0 * s(1., 1.)) / 4.0;
  vec3 v = (-1.0 * s(-1., -1.) - 2.0 * s(0., -1.) - 1.0 * s(1., -1.) + 1.0 * s(-1., 1.) + 2.0 * s(0., 1.) + 1.0 * s(1., 1.)) / 4.0;
  gl_FragColor = vec4(dot(u, u), dot(v, v), dot(u, v), 1.0);
}`,
};

const GAUSS = {
  uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2(1, 0) } },
  fragmentShader: /* glsl */`
uniform sampler2D tSrc; uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec4 s = texture2D(tSrc, vUv) * 0.2270270;
  s += (texture2D(tSrc, vUv + uDir * 1.3846154) + texture2D(tSrc, vUv - uDir * 1.3846154)) * 0.3162162;
  s += (texture2D(tSrc, vUv + uDir * 3.2307692) + texture2D(tSrc, vUv - uDir * 3.2307692)) * 0.0702703;
  gl_FragColor = s;
}`,
};

const kuwaharaShader = (MAXR) => ({
  uniforms: { tSrc: { value: null }, tTensor: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uRadius: { value: new THREE.Vector2(2.5, 5.5) },
    uHard: { value: 8 }, uSharp: { value: 8 }, uAlpha: { value: 1 } },
  fragmentShader: /* glsl */`
#define MAXR ${MAXR}
uniform sampler2D tSrc; uniform sampler2D tTensor; uniform vec2 uRes; uniform vec2 uRadius; uniform float uHard; uniform float uSharp; uniform float uAlpha;
varying vec2 vUv;
void main() {
  vec4 src = texture2D(tSrc, vUv);
  vec3 g = texture2D(tTensor, vUv).xyz;
  float E = g.x, G = g.y, F = g.z;
  float disc = sqrt(max((E - G) * (E - G) + 4.0 * F * F, 0.0));
  float l1 = 0.5 * (E + G + disc), l2 = 0.5 * (E + G - disc);
  vec2 t = vec2(l1 - E, -F);
  t = length(t) > 1e-6 ? normalize(t) : vec2(0.0, 1.0);
  float phi = -atan(t.y, t.x);
  float A = (l1 + l2 > 1e-6) ? (l1 - l2) / (l1 + l2) : 0.0;
  float radius = clamp(mix(uRadius.x, uRadius.y, src.a), 1.0, float(MAXR));
  float a = radius * clamp((uAlpha + A) / uAlpha, 0.1, 2.0);
  float b = radius * clamp(uAlpha / (uAlpha + A), 0.1, 2.0);
  float cp = cos(phi), sp = sin(phi);
  mat2 SR = mat2(0.5 / a, 0.0, 0.0, 0.5 / b) * mat2(cp, -sp, sp, cp);
  int mx = int(min(sqrt(a * a * cp * cp + b * b * sp * sp), float(MAXR)));
  int my = int(min(sqrt(a * a * sp * sp + b * b * cp * cp), float(MAXR)));
  const float N = 8.0;
  float zeta = 2.0 / radius;
  float zc = cos(3.14159265 / N), zs = sin(3.14159265 / N);
  float eta = (zeta + zc) / (zs * zs);
  vec4 m[8]; vec3 s[8];
  for (int k = 0; k < 8; k++) { m[k] = vec4(0.0); s[k] = vec3(0.0); }
  for (int j = -MAXR; j <= MAXR; j++) {
    if (j < -my || j > my) continue;
    for (int i = -MAXR; i <= MAXR; i++) {
      if (i < -mx || i > mx) continue;
      vec2 v = SR * vec2(float(i), float(j));
      if (dot(v, v) > 0.25) continue;
      vec3 c = texture2D(tSrc, vUv + vec2(float(i), float(j)) / uRes).rgb;
      float w[8]; float sum = 0.0, z, vxx, vyy;
      vxx = zeta - eta * v.x * v.x; vyy = zeta - eta * v.y * v.y;
      z = max(0.0, v.y + vxx); w[0] = z * z; sum += w[0];
      z = max(0.0, -v.x + vyy); w[2] = z * z; sum += w[2];
      z = max(0.0, -v.y + vxx); w[4] = z * z; sum += w[4];
      z = max(0.0, v.x + vyy); w[6] = z * z; sum += w[6];
      v = 0.70710678 * vec2(v.x - v.y, v.x + v.y);
      vxx = zeta - eta * v.x * v.x; vyy = zeta - eta * v.y * v.y;
      z = max(0.0, v.y + vxx); w[1] = z * z; sum += w[1];
      z = max(0.0, -v.x + vyy); w[3] = z * z; sum += w[3];
      z = max(0.0, -v.y + vxx); w[5] = z * z; sum += w[5];
      z = max(0.0, v.x + vyy); w[7] = z * z; sum += w[7];
      float gw = exp(-3.125 * dot(v, v)) / max(sum, 1e-6);
      for (int k = 0; k < 8; k++) { float wk = w[k] * gw; m[k] += vec4(c * wk, wk); s[k] += c * c * wk; }
    }
  }
  vec4 o = vec4(0.0);
  for (int k = 0; k < 8; k++) {
    if (m[k].w <= 1e-6) continue;
    vec3 mu = m[k].rgb / m[k].w;
    vec3 var = abs(s[k] / m[k].w - mu * mu);
    float sig = var.r + var.g + var.b;
    float wk = 1.0 / (1.0 + pow(uHard * 1000.0 * sig, 0.5 * uSharp));
    o += vec4(mu * wk, wk);
  }
  gl_FragColor = vec4(o.w > 1e-12 ? o.rgb / o.w : src.rgb, src.a);
}`,
});

const FINAL = {
  uniforms: { tPaint: { value: null }, tBase: { value: null }, tDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uPx: { value: 1 },
    uMargin: { value: 0 }, uAspect: { value: 1.78 }, uInk: { value: 1 }, uPaper: { value: 1 }, uSplit: { value: -1 }, uTime: { value: 0 },
    uShadeHue: { value: new THREE.Color(0.6, 0.67, 1.0) }, uNear: { value: 0.1 }, uFar: { value: 6000 },
    uProjInv: { value: new THREE.Matrix4() }, uViewInv: { value: new THREE.Matrix4() }, uGroundY: { value: -0.85 }, tDebug: { value: null }, uDebug: { value: 0 } },
  fragmentShader: /* glsl */`
${COMMON}
uniform mat4 uProjInv; uniform mat4 uViewInv; uniform float uGroundY; uniform sampler2D tDebug; uniform float uDebug;
uniform sampler2D tPaint; uniform sampler2D tBase; uniform sampler2D tDepth; uniform vec2 uRes; uniform float uPx;
uniform float uMargin; uniform float uAspect;
uniform float uInk; uniform float uPaper; uniform float uSplit; uniform float uTime; uniform vec3 uShadeHue;
varying vec2 vUv;
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1, 0)), f.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), f.x), f.y); }
float paper(vec2 p) {
  float n = vnoise(p * 0.55) * 0.45 + vnoise(p * 1.3 + 3.1) * 0.35 + vnoise(p * 0.11 + 9.7) * 0.2;
  float fib = vnoise(vec2(p.x * 0.05 + p.y * 0.21, p.y * 0.9)) ;   // a faint laid direction
  return n * 0.8 + fib * 0.2;
}
void main() {
  vec2 px = 1.0 / uRes;
  vec3 c = texture2D(tPaint, vUv).rgb;
  float sketchLine = 0.0;
  if (uInk > 0.001 || uMargin > 0.001) {
    bool sky = texture2D(tDepth, vUv).x >= 0.99999;
    float d = sky ? uFar : viewDist(tDepth, vUv);
    float w = mix(1.5, 0.9, smoothstep(4.0, 50.0, d)) * uPx;
    float dl = viewDist(tDepth, vUv - vec2(w * px.x, 0.0)), dr = viewDist(tDepth, vUv + vec2(w * px.x, 0.0));
    float dd = viewDist(tDepth, vUv - vec2(0.0, w * px.y)), du = viewDist(tDepth, vUv + vec2(0.0, w * px.y));
    float far = max(max(dl, dr), max(du, dd));
    // a silhouette, seen from its near side; it must also be a real gap in metres, so grass blades
    // and leaf cards standing a hand's width in front of each other don't draw
    float jump = log(far / d) * smoothstep(0.6, 2.0, (far - d) / max(1.0, d * 0.12));
    float crease = (abs(1.0 / dl + 1.0 / dr - 2.0 / d) + abs(1.0 / du + 1.0 / dd - 2.0 / d)) * d; // a fold (1/z is linear on a plane)
    // folds only near: at a distance, slatted roofs and window grids would turn into stripes and moiré
    float line = smoothstep(0.06, 0.22, jump) + smoothstep(0.012, 0.04, crease) * 0.55 * (1.0 - smoothstep(8.0, 22.0, d));
    // the ground plane keeps soft edges (kerbs, paving, the lawn): painters leave the floor to tone
    vec4 vp = uProjInv * vec4(vUv * 2.0 - 1.0, texture2D(tDepth, vUv).x * 2.0 - 1.0, 1.0);
    vec3 wp = (uViewInv * vec4(vp.xyz / vp.w, 1.0)).xyz;
    float aboveGround = smoothstep(0.45, 1.3, wp.y - uGroundY);
    line = sky ? 0.0 : clamp(line, 0.0, 1.0) * (1.0 - smoothstep(25.0, 240.0, d)) * aboveGround;
    sketchLine = line;
    vec3 inkCol = c * mix(vec3(0.62), uShadeHue * 0.62, 0.55);
    c = mix(c, inkCol, line * 0.7 * uInk);
  }
  if (uMargin > 0.001) {
    // 留白: the picture is still being painted. Toward the edges colour gives way to the bare
    // sheet, where only the drawing remains — the same picture the easel starts from in 入画
    vec2 sp = gl_FragCoord.xy / uPx;
    float e = min(min(vUv.x, 1.0 - vUv.x) * uAspect, min(vUv.y, 1.0 - vUv.y));
    float along = abs(vUv.x - 0.5) * uAspect > abs(vUv.y - 0.5) ? sp.y : sp.x;
    float across = abs(vUv.x - 0.5) * uAspect > abs(vUv.y - 0.5) ? sp.x : sp.y;
    float brush = vnoise(vec2(along * 0.006, across * 0.0035)) * 0.5 + vnoise(vec2(along * 0.025, across * 0.012)) * 0.32 + vnoise(vec2(along * 0.11, across * 0.05)) * 0.18;
    float reach = 0.03 + 0.085 * uMargin;
    float fill = smoothstep(reach - 0.04, reach + 0.05, e + (brush - 0.5) * 0.16);
    float gx = luma(texture2D(tPaint, vUv + vec2(px.x * uPx, 0.0)).rgb) - luma(texture2D(tPaint, vUv - vec2(px.x * uPx, 0.0)).rgb);
    float gy = luma(texture2D(tPaint, vUv + vec2(0.0, px.y * uPx)).rgb) - luma(texture2D(tPaint, vUv - vec2(0.0, px.y * uPx)).rgb);
    float sketch = clamp(sketchLine * 0.9 + smoothstep(0.06, 0.3, length(vec2(gx, gy))) * 0.55, 0.0, 1.0);
    vec3 sheet = vec3(0.955, 0.93, 0.875);
    vec3 drawn = sheet * (1.0 - sketch * 0.5 * vec3(1.0, 0.98, 0.94));
    // a thin wash runs ahead of the colour, and pigment pools along the edge where it stopped
    vec3 wash = mix(sheet, c, 0.28);
    float washK = smoothstep(reach - 0.05, reach - 0.005, e + (brush - 0.5) * 0.2);
    vec3 m = mix(drawn, wash * (1.0 - sketch * 0.3), washK * 0.65);
    c = mix(m, c, fill);
    c *= 1.0 - 0.14 * uMargin * 4.0 * fill * (1.0 - fill);
  }
  if (uPaper > 0.001) {
    // pigment gathers where one colour meets another
    float lx = luma(texture2D(tPaint, vUv + vec2(1.5 * px.x * uPx, 0.0)).rgb) - luma(texture2D(tPaint, vUv - vec2(1.5 * px.x * uPx, 0.0)).rgb);
    float ly = luma(texture2D(tPaint, vUv + vec2(0.0, 1.5 * px.y * uPx)).rgb) - luma(texture2D(tPaint, vUv - vec2(0.0, 1.5 * px.y * uPx)).rgb);
    c *= 1.0 - smoothstep(0.04, 0.3, length(vec2(lx, ly))) * 0.08 * uPaper;
    // the sheet: grain fixed to the page, settling into the darker passages
    float g = paper(gl_FragCoord.xy / uPx);
    float l = luma(c);
    c *= 1.0 - (g - 0.5) * 0.085 * uPaper * (1.25 - l);
    c = mix(c, c * vec3(1.012, 1.0, 0.975), uPaper * 0.6);
  }
  c += (h12(gl_FragCoord.xy + uTime * 61.0) - 0.5) / 255.0;
  if (uSplit >= 0.0) {
    float x = vUv.x;
    if (x < uSplit) c = texture2D(tBase, vUv).rgb;
    float e = abs(x - uSplit) * uRes.x;
    c = mix(c, vec3(0.97, 0.95, 0.9), 1.0 - smoothstep(0.6 * uPx, 1.6 * uPx, e));
  }
  if (uDebug > 0.5) c = texture2D(tDebug, vUv).rgb;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`,
};

function mat(def, defines) {
  return new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.clone(def.uniforms), vertexShader: VERT, fragmentShader: def.fragmentShader, depthTest: false, depthWrite: false, defines });
}

/** quality tiers: the paint pass runs at a capped density (it is a soft medium); line and paper stay at full */
export const PAINT_TIERS = {
  high: { maxR: 8, paintPR: 1.5, aoScale: 0.5 },
  medium: { maxR: 6, paintPR: 1.0, aoScale: 0.5 },
  low: { maxR: 4, paintPR: 0.85, aoScale: 0.5 },
};

export function createLabPipeline(renderer, { samples = 4, tier = 'high' } = {}) {
  const T = PAINT_TIERS[tier] || PAINT_TIERS.high;
  const depth = new THREE.DepthTexture(1, 1); depth.type = THREE.UnsignedIntType;
  const hdr = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples, depthTexture: depth });
  const lin = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  const ao = new THREE.WebGLRenderTarget(1, 1, lin), aoB = new THREE.WebGLRenderTarget(1, 1, lin);
  const ldr = new THREE.WebGLRenderTarget(1, 1, lin), base = new THREE.WebGLRenderTarget(1, 1, lin);
  const ten = new THREE.WebGLRenderTarget(1, 1, { ...lin, type: THREE.HalfFloatType }), tenB = new THREE.WebGLRenderTarget(1, 1, { ...lin, type: THREE.HalfFloatType });
  const paint = new THREE.WebGLRenderTarget(1, 1, lin);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.2, 0.6, 1.7);
  const quad = new FullScreenQuad();
  const M = { ao: mat(AO), aoBlur: mat(AOBLUR), grade: mat(LABGRADE), base: mat(Grade), tensor: mat(TENSOR), gauss: mat(GAUSS), kuwa: mat(kuwaharaShader(T.maxR)), final: mat(FINAL) };
  const size = new THREE.Vector2(), paintSize = new THREE.Vector2();
  let scale = 1, time = 0;
  const S = { wash: 1, planes: 1, paint: 1, ink: 1, paper: 1, focus: 0, margin: 0 };   // layer strengths (0 = off)
  const run = (m, target) => { quad.material = m; renderer.setRenderTarget(target); quad.render(renderer); };
  const timings = {};

  const api = {
    S, M, tier, T, bloom,
    get scale() { return scale; },
    get size() { return size.clone(); },
    setSize(w, h, pr) {
      renderer.setPixelRatio(pr * scale);
      renderer.setSize(w, h, false);
      renderer.getDrawingBufferSize(size);
      hdr.setSize(size.x, size.y); ldr.setSize(size.x, size.y); base.setSize(size.x, size.y);
      const ak = T.aoScale;
      ao.setSize(Math.ceil(size.x * ak), Math.ceil(size.y * ak)); aoB.setSize(ao.width, ao.height);
      // the paint pass's own density: never above paintPR device pixels per CSS pixel
      const pk = Math.min(1, T.paintPR / (pr * scale));
      paintSize.set(Math.max(1, Math.round(size.x * pk)), Math.max(1, Math.round(size.y * pk)));
      ten.setSize(paintSize.x, paintSize.y); tenB.setSize(paintSize.x, paintSize.y); paint.setSize(paintSize.x, paintSize.y);
      bloom.setSize(size.x, size.y);
      api.pxPaint = paintSize.x / w;      // paint pixels per CSS pixel
      api.pxFull = size.x / w;
    },
    setScale(s, w, h, pr) { s = Math.min(1, Math.max(0.5, s)); if (Math.abs(s - scale) < 0.01) return; scale = s; api.setSize(w, h, pr); },
    setMood(m, U) {
      for (const g of [M.grade, M.base]) { g.uniforms.uExposure.value = m.exposure; g.uniforms.uSat.value = m.sat; }
      bloom.strength = m.bloom;
      M.grade.uniforms.uShadeHue.value.copy(U.uShadeHue.value);
      M.final.uniforms.uShadeHue.value.copy(U.uShadeHue.value);
      M.grade.uniforms.uKey.value.copy(U.uHorizon.value);
    },
    /** scene → HDR (bloom applied in place, as the V2 walk does) */
    renderScene(scene, camera) {
      renderer.setRenderTarget(hdr); renderer.clear(); renderer.render(scene, camera);
      bloom.render(renderer, null, hdr, 0, false);
    },
    /** the V2 walk's own finish, into the comparison target (or the screen) */
    finishBase(target = base) {
      const u = M.base.uniforms; u.tDiffuse.value = hdr.texture; u.uTime.value = time % 100;
      run(M.base, target);
    },
    /** distance to what the picture is about (the orbit target): the planes are placed relative to it */
    focus: 30,
    radius: [3.2, 6],
    debug: null,
    finishLab(camera, { split = -1 } = {}) {
      const near = camera.near, far = camera.far;
      for (const m of [M.ao, M.aoBlur, M.grade, M.final]) { m.uniforms.uNear.value = near; m.uniforms.uFar.value = far; }
      let aoTex = null;
      if (S.wash > 0.001) {
        const u = M.ao.uniforms; u.tDepth.value = depth; u.uRes.value.set(size.x, size.y);
        u.uProj.value.copy(camera.projectionMatrix); u.uProjInv.value.copy(camera.projectionMatrixInverse);
        u.uFade.value.set(Math.max(8, api.focus) * 1.5, Math.max(8, api.focus) * 4);
        run(M.ao, ao);
        const b = M.aoBlur.uniforms; b.tAO.value = ao.texture; b.tDepth.value = depth; b.uRes.value.set(ao.width, ao.height);
        run(M.aoBlur, aoB);
        aoTex = aoB.texture;
      }
      const g = M.grade.uniforms;
      g.tHDR.value = hdr.texture; g.tDepth.value = depth; g.tAO.value = aoTex || ao.texture; g.uWash.value = aoTex ? S.wash : 0; g.uPlanes.value = S.planes;
      const fd = Math.max(8, api.focus);
      g.uNearPlane.value.set(fd * 0.2, fd * 0.6); g.uFarPlane.value.set(fd * 1.7, fd * 7); g.uSimplify.value.set(fd * 0.35, fd * 4);
      g.uFocusK.value = S.focus; g.uFocusD.value = fd; g.uAspect.value = size.x / size.y;
      run(M.grade, ldr);
      let src = ldr.texture;
      if (S.paint > 0.001) {
        M.tensor.uniforms.tSrc.value = ldr.texture; M.tensor.uniforms.uRes.value.copy(paintSize);
        run(M.tensor, ten);
        M.gauss.uniforms.tSrc.value = ten.texture; M.gauss.uniforms.uDir.value.set(1 / paintSize.x, 0); run(M.gauss, tenB);
        M.gauss.uniforms.tSrc.value = tenB.texture; M.gauss.uniforms.uDir.value.set(0, 1 / paintSize.y); run(M.gauss, ten);
        const k = M.kuwa.uniforms;
        k.tSrc.value = ldr.texture; k.tTensor.value = ten.texture; k.uRes.value.copy(paintSize);
        // stroke radius in paint pixels: ~2.4 CSS px near, ~5.5 far, × strength
        k.uRadius.value.set(api.radius[0] * api.pxPaint * S.paint, api.radius[1] * api.pxPaint * S.paint);
        run(M.kuwa, paint);
        src = paint.texture;
      }
      const f = M.final.uniforms;
      f.tPaint.value = src; f.tBase.value = base.texture; f.tDepth.value = depth; f.uRes.value.set(size.x, size.y); f.uPx.value = api.pxFull;
      f.uProjInv.value.copy(camera.projectionMatrixInverse); f.uViewInv.value.copy(camera.matrixWorld);
      f.uDebug.value = api.debug ? 1 : 0; f.tDebug.value = api.debug ? { ao: aoB, ldr, paint, ten }[api.debug]?.texture || null : null;
      f.uMargin.value = S.margin; f.uAspect.value = size.x / size.y;
      f.uInk.value = S.ink; f.uPaper.value = S.paper; f.uSplit.value = split; f.uTime.value = time % 100;
      run(M.final, null);
    },
    tick(dt) { time += dt; },
    timings,
    targets: { hdr, ao, aoB, ldr, base, ten, paint },
  };
  return api;
}
