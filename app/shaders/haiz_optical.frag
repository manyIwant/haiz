#version 460 core
#include <flutter/runtime_effect.glsl>

// HAIZ optical lens v2. Live compositor input on Impeller.
// u_size and u_texture are provided by ImageFilter.shader automatically.
// u_dark is supplied by Dart at float index 2.
uniform vec2 u_size;
uniform float u_dark;
uniform sampler2D u_texture;
out vec4 fragColor;

float roundDistance(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

vec3 backdrop(vec2 uv) {
  uv = clamp(uv, vec2(0.002), vec2(0.998));
#ifdef IMPELLER_TARGET_OPENGLES
  uv.y = 1.0 - uv.y;
#endif
  return texture(u_texture, uv).rgb;
}

vec3 dispersion(vec2 uv, vec2 offset) {
  // RGB component separation increases towards the rounded glass bevel.
  return vec3(backdrop(uv + offset * 1.16).r,
              backdrop(uv + offset).g,
              backdrop(uv + offset * 0.84).b);
}

void main() {
  vec2 size = max(u_size, vec2(1.0));
  vec2 pixel = FlutterFragCoord().xy;
  vec2 halfSize = size * 0.5;
  vec2 local = pixel - halfSize;
  float radius = min(29.0, min(halfSize.x, halfSize.y));
  float d = roundDistance(local, halfSize, radius);

  // Physical convex edge rather than a uniformly blurred rectangle.
  float bevel = smoothstep(-22.0, 1.0, d);
  float e = 0.55;
  vec2 grad = vec2(
    roundDistance(local + vec2(e, 0.0), halfSize, radius) -
    roundDistance(local - vec2(e, 0.0), halfSize, radius),
    roundDistance(local + vec2(0.0, e), halfSize, radius) -
    roundDistance(local - vec2(0.0, e), halfSize, radius)
  );
  grad = normalize(grad + vec2(0.00001));

  // Shallow curvature in the centre ensures a recognizable optical volume.
  // The effect remains quiet; the bevel carries the visible distortion.
  vec2 position = local / max(halfSize, vec2(1.0));
  float central = pow(max(0.0, 1.0 - dot(position, position)), 2.0);
  vec2 coreSlope = -position * 0.042 * central;
  float angle = bevel * 1.24;
  vec3 normal = normalize(vec3(
    grad * sin(angle) + coreSlope,
    cos(angle)
  ));
  vec3 ray = refract(vec3(0.0, 0.0, -1.0), normal, 1.0 / 1.46);
  vec2 displacement = clamp(
    ray.xy / max(0.20, abs(ray.z)) * 30.0,
    vec2(-27.0), vec2(27.0)
  ) / size;

  vec2 uv = (pixel + vec2(0.5)) / size;
  vec2 softness = vec2(1.15) / size;

  // Small five-tap kernel: softened transmission with edge color separation.
  vec3 glass = (dispersion(uv, displacement) * 4.0 +
    dispersion(uv + softness, displacement) +
    dispersion(uv - softness, displacement) +
    dispersion(uv + vec2(softness.x, -softness.y), displacement) +
    dispersion(uv + vec2(-softness.x, softness.y), displacement)) / 8.0;

  // A thin film tint instead of the original heavy, opaque milky overlay.
  vec3 film = mix(vec3(0.94, 0.97, 0.94), vec3(0.19, 0.29, 0.31), u_dark);
  glass = mix(glass, film, mix(0.10, 0.16, u_dark));
  glass = (glass - 0.5) * 1.055 + 0.5;

  // Real lens edges: specular, Fresnel, top/bottom directional reflection.
  vec3 light = normalize(vec3(-0.58, -0.72, 0.75));
  float spec = pow(max(0.0, dot(reflect(-light, normal),
                               vec3(0.0, 0.0, 1.0))), 32.0);
  float fresnel = 0.035 + 0.965 * pow(1.0 - normal.z, 5.0);
  float innerRim = exp(-abs(d + 1.6) * 0.52);
  float rimBias = mix(0.28, 1.0,
    clamp(dot(grad, normalize(vec2(-0.7, -0.6))) * 0.5 + 0.5, 0.0, 1.0));
  float bottomShade = exp(-abs(d + 5.0) * 0.35) *
    smoothstep(-0.18, 0.9, grad.y);

  glass += vec3(0.96, 1.0, 0.97) *
    (spec * 0.35 + fresnel * 0.34 + innerRim * rimBias * 0.26);
  glass -= vec3(0.085, 0.11, 0.10) * bottomShade;
  fragColor = vec4(clamp(glass, 0.0, 1.0), 1.0);
}
