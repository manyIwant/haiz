// Post: HDR scene → soft bloom on what glows (sun, glints, lit cloud edges) → one grade pass.
// The grade tone-maps with the Khronos PBR Neutral curve (it keeps hues and saturation, which a
// painted look needs; ACES would push greens toward yellow and skies toward cyan), lifts saturation
// a little, split-tones (cool shadows, warm highlights, as background painters mix them), adds a
// soft vignette and a dither, and writes sRGB.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uExposure: { value: 1.0 },
    uSat: { value: 1.12 },
    uShadowTone: { value: new THREE.Color(0.94, 0.98, 1.08) },
    uHighTone: { value: new THREE.Color(1.04, 1.01, 0.95) },
    uVignette: { value: 0.22 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
uniform sampler2D tDiffuse; uniform float uExposure; uniform float uSat; uniform vec3 uShadowTone; uniform vec3 uHighTone;
uniform float uVignette; uniform float uTime;
varying vec2 vUv;
vec3 neutral(vec3 color) {
  const float startCompression = 0.8 - 0.04;
  const float desaturation = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return color;
  float d = 1.0 - startCompression;
  float newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, vec3(newPeak), g);
}
vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb * uExposure;
  c = neutral(max(c, 0.0));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  c *= mix(uShadowTone, uHighTone, smoothstep(0.05, 0.75, l));
  vec2 q = vUv - 0.5;
  c *= 1.0 - uVignette * smoothstep(0.25, 0.85, dot(q, q) * 2.2);
  c = toSRGB(clamp(c, 0.0, 1.0));
  c += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0);
}`,
};

export function createPost(renderer, scene, camera, { samples = 4, bloom = true } = {}) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples, colorSpace: THREE.LinearSRGBColorSpace });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  let bloomPass = null;
  if (bloom) {
    bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.28, 0.55, 1.15);
    composer.addPass(bloomPass);
  }
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  return {
    composer, grade, bloomPass,
    setSize(w, h) { composer.setSize(w, h); },
    render(dt) { grade.uniforms.uTime.value = (grade.uniforms.uTime.value + dt) % 100; composer.render(dt); },
    setGrade({ exposure, sat }) { if (exposure != null) grade.uniforms.uExposure.value = exposure; if (sat != null) grade.uniforms.uSat.value = sat; },
  };
}
