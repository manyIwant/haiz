#version 460 core
#include <flutter/runtime_effect.glsl>

// HAIZ glass v3 — a thick rounded slab of glass lying on the page.
//
// The backdrop is NOT the compositor's filter input (ImageFilter.shader is
// Impeller-only and was unreliable on Android GLES). It is a snapshot of the
// page layer under this surface, supplied as an ordinary image sampler, so
// the same shader runs on Impeller, Skia and Flutter Web (CanvasKit) and no
// backend-specific y-flip is needed.
//
// Model (all lengths in logical pixels):
//   shape     rounded-rectangle signed distance d (< 0 inside)
//   surface   flat top, convex quarter-round bevel of width uBevel
//   transport Snell refraction (IOR ~1.5) through the bevel normal, lateral
//             shift proportional to local glass depth; per-channel IOR gives
//             a little dispersion at the rim only
//   surface   Schlick Fresnel reflection of a soft studio sky, Blinn-Phong
//             key light from uLight and a weaker internal back-reflection
//   legibility a paper/graphite veil so text on the glass stays readable

uniform vec2 uSize;        // surface size                       0,1
uniform vec2 uOrigin;      // surface top-left, canvas coords    2,3
uniform vec2 uTexOrigin;   // backdrop top-left, canvas coords   4,5
uniform vec2 uTexSize;     // backdrop size                      6,7
uniform float uRadius;     // corner radius                      8
uniform float uBevel;      // bevel width                        9
uniform float uDepth;      // refraction depth                   10
uniform float uDispersion; // 0..1                               11
uniform float uFrost;      // 0..1 micro-roughness               12
uniform float uVeil;       // 0..1 legibility veil               13
uniform vec4 uTint;        // veil colour rgb, absorption a      14..17
uniform vec2 uLight;       // key light direction (screen xy)    18,19
uniform float uDark;       // 0 light theme, 1 dark              20
uniform float uOpacity;    // 0..1 surface visibility            21
uniform float uMagnify;    // central magnification              22

uniform sampler2D uBackdrop;

out vec4 fragColor;

float sdRoundRect(vec2 p, vec2 halfSize, float r) {
  vec2 q = abs(p) - halfSize + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

vec3 sampleBackdrop(vec2 canvasPos) {
  vec2 uv = (canvasPos - uTexOrigin) / uTexSize;
  vec4 s = texture(uBackdrop, clamp(uv, vec2(0.0005), vec2(0.9995)));
  // Premultiplied: any uncovered pixel reads as the page, never as black.
  return s.rgb + (1.0 - s.a) * uTint.rgb;
}

// Lateral offset of a vertical view ray after refraction at this normal.
vec2 bend(vec3 n, float ior, float depth) {
  vec3 r = refract(vec3(0.0, 0.0, -1.0), n, 1.0 / ior);
  return r.xy / max(0.25, -r.z) * depth;
}

void main() {
  vec2 frag = FlutterFragCoord().xy;
  vec2 halfSize = uSize * 0.5;
  vec2 p = frag - uOrigin - halfSize;
  float radius = min(uRadius, min(halfSize.x, halfSize.y));
  float d = sdRoundRect(p, halfSize, radius);

  // Coverage with a one-pixel anti-aliased rim.
  float alpha = clamp(0.5 - d, 0.0, 1.0) * uOpacity;
  if (alpha <= 0.0) {
    fragColor = vec4(0.0);
    return;
  }

  // Outward unit gradient of the shape.
  float e = 0.75;
  vec2 g = vec2(
    sdRoundRect(p + vec2(e, 0.0), halfSize, radius) - sdRoundRect(p - vec2(e, 0.0), halfSize, radius),
    sdRoundRect(p + vec2(0.0, e), halfSize, radius) - sdRoundRect(p - vec2(0.0, e), halfSize, radius));
  vec2 outward = g / max(length(g), 1e-4);

  // Quarter-round bevel: height h(t) = sqrt(1 - (1 - t)^2), t = inside / bevel.
  float bevel = max(uBevel, 1.0);
  float t = clamp(-d / bevel, 0.0, 1.0);
  float u = 1.0 - t;
  float slope = u / max(sqrt(max(1.0 - u * u, 0.0)), 0.18); // dh/dt, clamped near the rim
  slope *= 0.62;                                            // bevel is shallower than a full half-round
  vec3 n = normalize(vec3(outward * slope, 1.0));

  // A very slight dome over the flat top: a convex slab magnifies.
  vec2 centred = p / max(halfSize, vec2(1.0));
  vec2 domeShift = -centred * uMagnify * (1.0 - u);

  // Depth of glass the ray travels through: thick on the top, thin at the rim.
  float depth = uDepth * (0.35 + 0.65 * u * u);
  float spread = uDispersion * 0.045;
  vec2 base = frag + domeShift;
  vec3 col;
  if (spread > 0.0005 && u > 0.02) {
    col = vec3(
      sampleBackdrop(base + bend(n, 1.50 - spread, depth)).r,
      sampleBackdrop(base + bend(n, 1.50, depth)).g,
      sampleBackdrop(base + bend(n, 1.50 + spread, depth)).b);
  } else {
    col = sampleBackdrop(base + bend(n, 1.50, depth));
  }

  // Micro-roughness: a small rotated kernel, stronger towards the rim.
  if (uFrost > 0.001) {
    float k = uFrost * (1.6 + 2.4 * u);
    vec2 o = bend(n, 1.50, depth);
    vec3 acc = col * 2.0;
    acc += sampleBackdrop(base + o + vec2(k, 0.35 * k));
    acc += sampleBackdrop(base + o + vec2(-0.35 * k, k));
    acc += sampleBackdrop(base + o + vec2(-k, -0.35 * k));
    acc += sampleBackdrop(base + o + vec2(0.35 * k, -k));
    col = acc / 6.0;
  }

  // Body absorption and the legibility veil.
  vec3 veil = uTint.rgb;
  col = mix(col, col * mix(vec3(1.0), veil, 0.6), uTint.a);
  col = mix(col, veil, uVeil);

  // Fresnel reflection of a soft sky lit from uLight.
  vec3 l = normalize(vec3(uLight, 0.9));
  vec3 view = vec3(0.0, 0.0, 1.0);
  vec3 refl = reflect(-view, n);
  float cosTheta = clamp(n.z, 0.0, 1.0);
  float fresnel = 0.04 + 0.96 * pow(1.0 - cosTheta, 5.0);
  float skyFacing = clamp(dot(normalize(refl.xy + 1e-4), normalize(uLight)) * 0.5 + 0.5, 0.0, 1.0);
  // On paper the room behind the viewer is bright: grazing reflections lift
  // the rim. In the dark theme they stay dim so the rim does not glow.
  vec3 sky = mix(mix(vec3(0.93, 0.935, 0.94), vec3(0.22, 0.23, 0.26), uDark),
                 mix(vec3(1.0, 0.995, 0.985), vec3(0.62, 0.64, 0.68), uDark), skyFacing);
  col = mix(col, sky, fresnel * mix(0.50, 0.40, uDark));

  // Key light on the bevel, and a weaker internal reflection opposite it.
  vec3 hKey = normalize(l + view);
  float key = pow(max(dot(n, hKey), 0.0), 90.0) * (1.0 - t * 0.6);
  vec3 lBack = normalize(vec3(-uLight, 0.9));
  float back = pow(max(dot(n, normalize(lBack + view)), 0.0), 60.0) * 0.35;
  col += vec3(1.0, 0.99, 0.96) * (key * mix(0.75, 0.55, uDark) + back * 0.6);

  // The top edge catches light: a hairline just inside the rim, brighter on
  // the lit side, dimmer on the far side.
  float lit = clamp(dot(outward, normalize(-uLight)) * 0.5 + 0.5, 0.0, 1.0);
  float rim = exp(-pow((-d - 0.9) / 0.7, 2.0));
  col += vec3(1.0) * rim * mix(0.10, 0.42, lit) * mix(1.0, 0.75, uDark);
  float far = exp(-pow((-d - 2.2) / 1.6, 2.0)) * (1.0 - lit);
  col -= vec3(0.035, 0.035, 0.03) * far * (1.0 - uDark * 0.4);

  fragColor = vec4(clamp(col, 0.0, 1.0) * alpha, alpha);
}
