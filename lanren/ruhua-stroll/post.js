// Post, V2.
//   bloom    only for what really glows (the sun, glints, backlit cloud rims). V1's low threshold let
//            sunlit paving bloom, which laid a milky veil over the whole frame
//   grade    Khronos PBR Neutral tone curve (keeps hue and saturation), restrained saturation, a
//            split tone (cool shade, warm light), soft vignette, dither, sRGB
//   exposure the mood's exposure × an eye adaptation the walk drives (in deep shade the picture
//            opens up a little, as eyes do stepping under a tree)
//   scale    dynamic resolution: when frames run long the render resolution steps down (the content
//            stays the same on every device; only pixels are traded), and back up when there is room
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export const Grade = {
  uniforms: {
    tDiffuse: { value: null }, uExposure: { value: 1 }, uSat: { value: 1.06 },
    uShadowTone: { value: new THREE.Color(0.95, 0.98, 1.06) }, uHighTone: { value: new THREE.Color(1.03, 1.0, 0.96) },
    uVignette: { value: 0.2 }, uTime: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
uniform sampler2D tDiffuse; uniform float uExposure; uniform float uSat; uniform vec3 uShadowTone; uniform vec3 uHighTone; uniform float uVignette; uniform float uTime;
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
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
void main() {
  vec3 c = neutral(max(texture2D(tDiffuse, vUv).rgb * uExposure, 0.0));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  c *= mix(uShadowTone, uHighTone, smoothstep(0.05, 0.75, l));
  vec2 q = vUv - 0.5;
  c *= 1.0 - uVignette * smoothstep(0.25, 0.9, dot(q, q) * 2.2);
  c = srgb(clamp(c, 0.0, 1.0)) + (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0);
}`,
};

export function createPost(renderer, scene, camera, { samples = 4 } = {}) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.2, 0.6, 1.7);
  composer.addPass(bloom);
  const grade = new ShaderPass(Grade);
  composer.addPass(grade);
  let base = renderer.getPixelRatio(), scale = 1;
  const api = {
    composer, grade, bloom,
    get scale() { return scale; },
    get basePixelRatio() { return base; },
    setSize(w, h) { composer.setPixelRatio(base * scale); composer.setSize(w, h); },
    setBase(pr) { base = pr; api.setSize(innerWidth, innerHeight); },
    setScale(s) {
      s = Math.min(1, Math.max(0.5, s));
      if (Math.abs(s - scale) < 0.01) return;
      scale = s;
      renderer.setPixelRatio(base * scale);
      api.setSize(innerWidth, innerHeight);
    },
    render(dt) { grade.uniforms.uTime.value = (grade.uniforms.uTime.value + dt) % 100; composer.render(dt); },
    setGrade(exposure, sat, bloomStrength) { grade.uniforms.uExposure.value = exposure; grade.uniforms.uSat.value = sat; bloom.strength = bloomStrength; },
  };
  return api;
}
