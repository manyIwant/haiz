// 入画 · drawing two worlds as one picture. (lanren/life fork of lanren/ruhua/pipeline.js: the composite's
// edges are resolved — see Composite — and nothing else changes.)
//
//   remembered  layer 1, V4's finish: ACES filmic tone, a little depth haze, V4's warm split tone,
//               vignette and grain (lanren/js/scene.js FinishShader)
//   painted     layer 2, V2's finish: bloom only for what glows, the neutral tone curve, V2's grade
//               (lanren/stroll/post.js); standing water mirrors what is on screen (puddles)
//   composite   per pixel, the nearer of the two surfaces (each world has already discarded the
//               part of every surface that belongs to the other, paintfield.js); where both see sky,
//               the sky's own moment decides
// After the transition only the painted chain runs, straight to the screen.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Grade } from '../ruhua-stroll/post.js';
import { U, GLSL } from '../ruhua-stroll/atmos.js';
import { PAINT, PAINT_GLSL } from '../ruhua/paintfield.js';

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const RealGrade = {
  uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, uExposure: { value: 1.08 }, uWarm: { value: 0.55 }, uSat: { value: 1.16 }, uContrast: { value: 1.12 },
    uVig: { value: 0.3 }, uTime: { value: 0 }, uFog: { value: new THREE.Color(0.42, 0.56, 0.74) }, uFogK: { value: 0.0016 }, uNear: { value: 0.1 }, uFar: { value: 6000 } },
  fragmentShader: /* glsl */`
#include <packing>
uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform float uExposure; uniform float uWarm; uniform float uSat; uniform float uContrast; uniform float uVig; uniform float uTime;
uniform vec3 uFog; uniform float uFogK; uniform float uNear; uniform float uFar;
varying vec2 vUv;
vec3 rrt(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 aces(vec3 c) {
  const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  c = O * rrt(I * (c / 0.6));
  return clamp(c, 0.0, 1.0);
}
vec3 srgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float z = texture2D(tDepth, vUv).x;
  if (z < 0.99999) {
    float d = -perspectiveDepthToViewZ(z, uNear, uFar);
    c = mix(c, uFog, (1.0 - exp(-d * uFogK)) * 0.8);
  }
  c = srgb(aces(c * uExposure));
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, uSat);
  c = clamp((c - 0.5) * uContrast + 0.5, 0.0, 1.0);
  l = dot(c, vec3(0.299, 0.587, 0.114));
  c *= mix(mix(vec3(0.94, 0.98, 1.06), vec3(0.97, 0.98, 1.03), uWarm), mix(vec3(1.0, 0.99, 0.97), vec3(1.05, 1.0, 0.92), uWarm), smoothstep(0.15, 0.85, l));
  vec2 q = vUv - 0.5;
  c *= 1.0 - uVig * smoothstep(0.25, 0.85, length(q * vec2(1.25, 1.0)));
  c += (fract(sin(dot(vUv * 1000.0 + uTime * 13.7, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.02;
  gl_FragColor = vec4(c, 1.0);
}`,
};

// standing water mirrors the picture (screen-space reflection), only on the paving's puddles
const Puddles = {
  uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, uProj: { value: new THREE.Matrix4() }, uProjInv: { value: new THREE.Matrix4() },
    uView: { value: new THREE.Matrix4() }, uViewInv: { value: new THREE.Matrix4() }, uCam: { value: new THREE.Vector3() }, uLawn: { value: null },
    uPaintO: { value: new THREE.Vector2() }, uPaintS: { value: 1 }, ...U },
  fragmentShader: /* glsl */`
${GLSL}
uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform mat4 uProj; uniform mat4 uProjInv; uniform mat4 uView; uniform mat4 uViewInv; uniform vec3 uCam;
uniform sampler2D uLawn; uniform vec2 uPaintO; uniform float uPaintS;
varying vec2 vUv;
vec3 worldAt(vec2 uv, float z) { vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0); v /= v.w; return (uViewInv * v).xyz; }
void main() {
  vec4 col = texture2D(tDiffuse, vUv);
  gl_FragColor = col;
  if (uPuddle < 0.01 && uWet < 0.05) return;
  float z = texture2D(tDepth, vUv).x;
  if (z >= 0.99999) return;
  vec3 wp = worldAt(vUv, z);
  if (abs(wp.y - uGroundY - 0.0) > 0.06) return;
  vec2 puv = (wp.xz - uPaintO) / uPaintS;
  if (puv.x < 0.0 || puv.y < 0.0 || puv.x > 1.0 || puv.y > 1.0) return;
  float lawn = texture2D(uLawn, vec2(puv.x, 1.0 - puv.y)).r;
  float paving = 1.0 - lawn;
  float pud = puddleAt(wp.xz) * paving;
  float film = uWet * paving * (0.35 + 0.65 * aNoise(wp.xz * 1.7));
  if (pud < 0.01 && film < 0.05) return;
  vec3 V = normalize(uCam - wp);
  vec2 rip = rainRipple(wp.xz) * (0.25 + 0.75 * pud);
  vec3 N = normalize(vec3(rip.x, 1.0, rip.y));
  vec3 R = reflect(-V, N);
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  float k = max(film * fres * 0.7, pud * mix(0.3, 1.0, fres));
  // march the reflected ray across the screen
  vec3 p = wp + N * 0.02;
  float stepL = 0.25 + length(uCam - wp) * 0.03;
  vec3 hit = vec3(0.0); float found = 0.0;
  for (int i = 0; i < 28; i++) {
    p += R * stepL; stepL *= 1.16;
    vec4 c = uProj * uView * vec4(p, 1.0);
    vec2 uv = c.xy / c.w * 0.5 + 0.5;
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0 || c.w < 0.0) break;
    float zs = texture2D(tDepth, uv).x;
    if (zs >= 0.99999) continue;
    vec3 sp = worldAt(uv, zs);
    float ds = length(sp - uCam), dp = length(p - uCam);
    if (dp > ds && dp - ds < stepL * 2.5) {
      hit = texture2D(tDiffuse, uv + rip * 0.01).rgb;
      found = smoothstep(0.0, 0.15, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y))) * (1.0 - float(i) / 28.0);
      break;
    }
  }
  vec3 skyR = skyColor(R) * 0.9;
  gl_FragColor = vec4(col.rgb + (hit - skyR) * found * k * 0.85, col.a);
}`,
};

const Composite = {
  uniforms: { tA: { value: null }, tB: { value: null }, dA: { value: null }, dB: { value: null }, uProjInv: { value: new THREE.Matrix4() }, uViewInv: { value: new THREE.Matrix4() }, uTexel: { value: new THREE.Vector2(1, 1) }, ...PAINT },
  // Per pixel the nearer surface wins; where the winner changes between neighbours (a silhouette of one
  // world over the other) the hard choice made a stair-stepped edge, because the depth buffers are
  // single-sample. Here the choice is softened over the 3×3 neighbourhood: an edge pixel mixes the two
  // worlds by how many of its neighbours each one wins. Interiors are untouched.
  fragmentShader: /* glsl */`
${PAINT_GLSL}
uniform sampler2D tA; uniform sampler2D tB; uniform sampler2D dA; uniform sampler2D dB; uniform mat4 uProjInv; uniform mat4 uViewInv; uniform vec2 uTexel;
varying vec2 vUv;
float skyMix(vec2 uv) {
  vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, 1.0, 1.0); v /= v.w;
  vec3 dir = normalize((uViewInv * vec4(v.xyz, 0.0)).xyz);
  return uPaintOn > 0.5 ? smoothstep(-0.12, 0.12, uPaintClock - paintTimeSky(dir)) : 0.0;
}
// how much of the painted world (b) this pixel shows
float pick(vec2 uv) {
  float za = texture2D(dA, uv).x, zb = texture2D(dB, uv).x;
  if (za >= 0.99999 && zb >= 0.99999) return skyMix(uv);
  return zb < za ? 1.0 : 0.0;
}
void main() {
  vec3 a = texture2D(tA, vUv).rgb, b = texture2D(tB, vUv).rgb;
  float w0 = pick(vUv);
  float lo = w0, hi = w0, sum = w0 * 4.0, n = 4.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    if (i == 0 && j == 0) continue;
    float w = pick(vUv + vec2(float(i), float(j)) * uTexel);
    float k = (i == 0 || j == 0) ? 1.0 : 0.6;
    sum += w * k; n += k; lo = min(lo, w); hi = max(hi, w);
  }
  float w = hi - lo > 0.5 ? sum / n : w0;
  gl_FragColor = vec4(mix(a, b, w), 1.0);
}`,
};
function mat(def) {
  return new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.clone(def.uniforms), vertexShader: VERT, fragmentShader: def.fragmentShader, depthTest: false, depthWrite: false });
}

export function createPipeline(renderer, { samples = 4 } = {}) {
  const sceneRT = () => {
    const d = new THREE.DepthTexture(1, 1); d.type = THREE.UnsignedIntType;
    return new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples, depthTexture: d });
  };
  const rtA = sceneRT(), rtB = sceneRT();
  const ldrA = new THREE.WebGLRenderTarget(1, 1), ldrB = new THREE.WebGLRenderTarget(1, 1);
  const tmpB = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const bloomB = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.2, 0.6, 1.7);
  const bloomA = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.12, 0.65, 0.92);
  const quad = new FullScreenQuad();
  const gradeB = mat(Grade), gradeA = mat(RealGrade), comp = mat(Composite), pud = mat(Puddles);
  // the paint uniforms are shared, not cloned
  for (const k of Object.keys(PAINT)) comp.uniforms[k] = PAINT[k];
  for (const k of Object.keys(U)) pud.uniforms[k] = U[k];
  const LAYER_REAL = 1, LAYER_PAINT = 2;
  let scale = 1, base = renderer.getPixelRatio(), time = 0;

  const api = {
    LAYER_REAL, LAYER_PAINT, rtA, rtB, gradeA, gradeB, bloomA, bloomB, pud,
    get scale() { return scale; },
    setSize(w, h) {
      renderer.setPixelRatio(base * scale);
      renderer.setSize(w, h, false);
      const px = renderer.getDrawingBufferSize(new THREE.Vector2());
      for (const rt of [rtA, rtB, ldrA, ldrB, tmpB]) rt.setSize(px.x, px.y);
      bloomA.setSize(px.x, px.y); bloomB.setSize(px.x, px.y);
      comp.uniforms.uTexel.value.set(1 / px.x, 1 / px.y);
    },
    setScale(s) { s = Math.min(1, Math.max(0.5, s)); if (Math.abs(s - scale) < 0.01) return; scale = s; api.setSize(innerWidth, innerHeight); },
    setBase(pr) { base = pr; api.setSize(innerWidth, innerHeight); },
    /** painted world grade (V2 mood): exposure, saturation, bloom */
    setGrade(exposure, sat, bloom) { gradeB.uniforms.uExposure.value = exposure; gradeB.uniforms.uSat.value = sat; bloomB.strength = bloom; },
    /** puddle reflections read the lawn mask so they stay on the paving */
    setGround(ground) { const P = ground.paint; pud.uniforms.uLawn.value = ground.maskTex; pud.uniforms.uPaintO.value.set(P.x0, P.z0); pud.uniforms.uPaintS.value = P.span; },
    renderReal(scene, camera, target = ldrA) {
      camera.layers.set(LAYER_REAL);
      renderer.setRenderTarget(rtA); renderer.clear(); renderer.render(scene, camera);
      bloomA.render(renderer, null, rtA, 0, false);
      Object.assign(gradeA.uniforms, {});
      gradeA.uniforms.tDiffuse.value = rtA.texture; gradeA.uniforms.tDepth.value = rtA.depthTexture;
      gradeA.uniforms.uNear.value = camera.near; gradeA.uniforms.uFar.value = camera.far; gradeA.uniforms.uTime.value = time % 100;
      quad.material = gradeA; renderer.setRenderTarget(target); quad.render(renderer);
    },
    renderPainted(scene, camera, target = null) {
      camera.layers.set(LAYER_PAINT);
      renderer.setRenderTarget(rtB); renderer.clear(); renderer.render(scene, camera);
      let src = rtB.texture;
      if (U.uPuddle.value > 0.01 || U.uWet.value > 0.05) {
        const u = pud.uniforms;
        u.tDiffuse.value = rtB.texture; u.tDepth.value = rtB.depthTexture;
        u.uProj.value.copy(camera.projectionMatrix); u.uProjInv.value.copy(camera.projectionMatrixInverse);
        u.uView.value.copy(camera.matrixWorldInverse); u.uViewInv.value.copy(camera.matrixWorld); u.uCam.value.copy(camera.position);
        quad.material = pud; renderer.setRenderTarget(tmpB); quad.render(renderer);
        src = tmpB.texture;
        bloomB.render(renderer, null, tmpB, 0, false);
      } else bloomB.render(renderer, null, rtB, 0, false);
      gradeB.uniforms.tDiffuse.value = src; gradeB.uniforms.uTime.value = time % 100;
      quad.material = gradeB; renderer.setRenderTarget(target); quad.render(renderer);
    },
    /** both worlds, then one picture */
    renderBoth(scene, camera) {
      camera.updateMatrixWorld();
      api.renderReal(scene, camera, ldrA);
      api.renderPainted(scene, camera, ldrB);
      const u = comp.uniforms;
      u.tA.value = ldrA.texture; u.tB.value = ldrB.texture; u.dA.value = rtA.depthTexture; u.dB.value = rtB.depthTexture;
      u.uProjInv.value.copy(camera.projectionMatrixInverse); u.uViewInv.value.copy(camera.matrixWorld);
      quad.material = comp; renderer.setRenderTarget(null); quad.render(renderer);
      camera.layers.enableAll();
    },
    tick(dt) { time += dt; },
    /** the painted world from one camera into a target (the painter's reference image) */
    renderPaintedTo(scene, camera, target) { api.renderPainted(scene, camera, target); camera.layers.enableAll(); },
  };
  return api;
}
