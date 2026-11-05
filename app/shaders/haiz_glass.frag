#version 460 core
#include <flutter/runtime_effect.glsl>

// HAIZ glass v4 — the HAIZ optical lens (1.4 "Optical Lens v2",
// shaders/haiz_optical.frag on main) carried over to a sampled backdrop.
//
// The 1.4 lens was an ImageFilter.shader: Impeller-only, so web and Android
// fell back to a Gaussian blur and never refracted. Here the backdrop is a
// snapshot of the page under the surface, supplied as an ordinary image
// sampler, so the same optics run on Impeller, Skia and Flutter Web
// (CanvasKit) with no backend-specific y-flip.
//
// Optics kept from the 1.4 lens (parameters are per surface instead of
// fixed to the dock):
//   edge      a wide convex edge: the normal tilts up to 1.24 rad across
//             uBevel px; Snell refraction at n = 1.46 displaces the sample
//             by up to 0.9 * uDepth px, so lines bend hard at the rim
//   colour    per-channel displacement (r x1.16, b x0.84 at uDispersion 1)
//   centre    a shallow convex core (uMagnify = slope; 0.042 on the dock)
//   body      a five-tap soft kernel, a thin film of the veil colour, a
//             diagonal glaze (stronger top-left, as the 1.4 dock's gradient)
//             and a slight contrast lift
//   surface   specular, Schlick Fresnel, an inner rim biased towards the
//             light, and a shade on the lower edge
// Lengths are logical pixels. uLight points towards the key light.

uniform vec2 uSize;        // surface size                       0,1
uniform vec2 uOrigin;      // surface top-left, canvas coords    2,3
uniform vec2 uTexOrigin;   // backdrop top-left, canvas coords   4,5
uniform vec2 uTexSize;     // backdrop size                      6,7
uniform float uRadius;     // corner radius                      8
uniform float uBevel;      // refracting edge width              9
uniform float uDepth;      // refraction depth                   10
uniform float uDispersion; // 1 = the 1.4 lens                   11
uniform float uFrost;      // kernel spread, 0.25 = 1.15 px      12
uniform float uVeil;       // film + glaze amount                13
uniform vec4 uTint;        // film colour rgb, absorption a      14..17
uniform vec2 uLight;       // towards the key light (screen xy)  18,19
uniform float uDark;       // 0 light theme, 1 dark / smoked     20
uniform float uOpacity;    // 0..1 surface visibility            21
uniform float uMagnify;    // centre curvature slope             22

uniform sampler2D uBackdrop;

out vec4 fragColor;

float roundDistance(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

vec3 page(vec2 canvasPos) {
  vec2 uv = (canvasPos - uTexOrigin) / uTexSize;
  vec4 s = texture(uBackdrop, clamp(uv, vec2(0.0005), vec2(0.9995)));
  // Premultiplied: any uncovered pixel reads as the page, never as black.
  return s.rgb + (1.0 - s.a) * uTint.rgb;
}

// RGB separation grows with the displacement, i.e. towards the edge.
vec3 dispersion(vec2 q, vec2 offset, float k) {
  return vec3(page(q + offset * (1.0 + k)).r,
              page(q + offset).g,
              page(q + offset * (1.0 - k)).b);
}

void main() {
  vec2 pixel = FlutterFragCoord().xy;
  vec2 halfSize = max(uSize * 0.5, vec2(0.5));
  vec2 local = pixel - uOrigin - halfSize;
  float radius = min(uRadius, min(halfSize.x, halfSize.y));
  float d = roundDistance(local, halfSize, radius);

  // Coverage with a one-pixel anti-aliased rim.
  float alpha = clamp(0.5 - d, 0.0, 1.0) * uOpacity;
  if (alpha <= 0.0) {
    fragColor = vec4(0.0);
    return;
  }

  // Physical convex edge rather than a uniformly blurred rectangle.
  float bevel = smoothstep(-max(uBevel, 1.0), 1.0, d);
  float e = 0.55;
  vec2 grad = vec2(
    roundDistance(local + vec2(e, 0.0), halfSize, radius) -
    roundDistance(local - vec2(e, 0.0), halfSize, radius),
    roundDistance(local + vec2(0.0, e), halfSize, radius) -
    roundDistance(local - vec2(0.0, e), halfSize, radius));
  grad = normalize(grad + vec2(0.00001));

  // Shallow curvature in the centre gives a recognisable optical volume;
  // the edge carries the visible distortion.
  vec2 position = local / halfSize;
  float central = pow(max(0.0, 1.0 - dot(position, position)), 2.0);
  vec2 coreSlope = -position * uMagnify * central;
  float angle = bevel * 1.24;
  vec3 normal = normalize(vec3(grad * sin(angle) + coreSlope, cos(angle)));
  vec3 ray = refract(vec3(0.0, 0.0, -1.0), normal, 1.0 / 1.46);
  float reach = 0.9 * uDepth;
  vec2 displacement = clamp(ray.xy / max(0.20, abs(ray.z)) * uDepth, vec2(-reach), vec2(reach));

  float k = 0.16 * uDispersion;
  float s = uFrost * 4.6;
  vec3 glass;
  if (s > 0.05) {
    // Five-tap kernel: softened transmission with edge colour separation.
    glass = (dispersion(pixel, displacement, k) * 4.0 +
      dispersion(pixel + vec2(s, s), displacement, k) +
      dispersion(pixel - vec2(s, s), displacement, k) +
      dispersion(pixel + vec2(s, -s), displacement, k) +
      dispersion(pixel + vec2(-s, s), displacement, k)) / 8.0;
  } else {
    glass = dispersion(pixel, displacement, k);
  }

  // Body absorption, thin film and diagonal glaze.
  vec3 film = uTint.rgb;
  glass = mix(glass, glass * mix(vec3(1.0), film, 0.6), uTint.a);
  float diagonal = clamp(dot(position, normalize(vec2(1.0, 1.0))) * 0.5 + 0.5, 0.0, 1.0);
  glass = mix(glass, film, clamp(uVeil * mix(1.15, 0.6, diagonal), 0.0, 1.0));
  glass = (glass - 0.5) * 1.055 + 0.5;

  // Real lens edges: specular, Fresnel, directional rim, lower shade.
  vec3 light = normalize(vec3(uLight, 0.75));
  float spec = pow(max(0.0, dot(reflect(-light, normal), vec3(0.0, 0.0, 1.0))), 32.0);
  float fresnel = 0.035 + 0.965 * pow(1.0 - normal.z, 5.0);
  float innerRim = exp(-abs(d + 1.6) * 0.52);
  float rimBias = mix(0.28, 1.0, clamp(dot(grad, normalize(uLight)) * 0.5 + 0.5, 0.0, 1.0));
  float bottomShade = exp(-abs(d + 5.0) * 0.35) * smoothstep(-0.18, 0.9, grad.y);

  float lift = mix(1.0, 0.8, uDark);
  glass += vec3(0.96, 1.0, 0.97) * (spec * 0.35 + fresnel * 0.34 + innerRim * rimBias * 0.26) * lift;
  glass -= vec3(0.085, 0.11, 0.10) * bottomShade;

  fragColor = vec4(clamp(glass, 0.0, 1.0) * alpha, alpha);
}
