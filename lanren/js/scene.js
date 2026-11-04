// Assembles the island, the growing tree, light and the film-like finish.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { installPCSS } from './pcss.js';
import { createCanopy, createLooseLeaves, UNIFORMS } from './foliage.js';
import { createSky, makeBarkMaterial, makeIslandMaterial, createWater, createGrass } from './environment.js';
import { Litter } from './litter.js';

export const TIERS = {
  high: { shadow: 4096, blocker: 14, pcf: 24, density: 0.72, geo: [2, 2], ratio: 2, msaa: 4, reflect: 'full', bloom: true, grass: 16000 },
  medium: { shadow: 2048, blocker: 10, pcf: 16, density: 0.5, geo: [2, 1], ratio: 1.5, msaa: 4, reflect: 'half', bloom: true, grass: 9000 },
  low: { shadow: 2048, blocker: 8, pcf: 10, density: 0.34, geo: [2, 1], ratio: 1.25, msaa: 0, reflect: false, bloom: false, grass: 4000 }
};

export function pickTier() {
  const q = new URLSearchParams(location.search).get('quality');
  if (q && TIERS[q]) return q;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 700;
  const cores = navigator.hardwareConcurrency || 4;
  if (coarse && small) return cores >= 8 ? 'medium' : 'low';
  return cores >= 6 ? 'high' : 'medium';
}

const SHADOW_HALF = 18;
const SHADOW_FAR = 120;

// ------------------------------------------------------------------ atmosphere pass
// Height fog with sun-ward scattering, mist that drifts over the water, and
// light shafts found by marching from each pixel towards the sun on screen.
const AtmosphereShader = {
  uniforms: {
    tDiffuse: { value: null }, tDepth: { value: null },
    uProjInv: { value: new THREE.Matrix4() }, uViewInv: { value: new THREE.Matrix4() },
    uCamPos: { value: new THREE.Vector3() }, uNear: { value: 0.1 }, uFar: { value: 900 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunScreen: { value: new THREE.Vector3(0.5, 0.5, 0) },
    uSunCol: { value: new THREE.Color() }, uFogCol: { value: new THREE.Color() },
    uDensity: { value: 0.02 }, uFalloff: { value: 0.12 }, uMist: { value: 0.5 }, uRays: { value: 0.5 },
    uTime: { value: 0 }, uWater: { value: -0.85 }
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
#include <packing>
uniform sampler2D tDiffuse; uniform sampler2D tDepth;
uniform mat4 uProjInv; uniform mat4 uViewInv; uniform vec3 uCamPos;
uniform vec3 uSunDir; uniform vec3 uSunScreen; uniform vec3 uSunCol; uniform vec3 uFogCol;
uniform float uDensity; uniform float uFalloff; uniform float uMist; uniform float uRays; uniform float uTime; uniform float uWater;
varying vec2 vUv;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
vec3 worldAt(vec2 uv, float d){
  vec4 ndc = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec4 v = uProjInv * ndc; v /= v.w;
  return (uViewInv * v).xyz;
}
void main(){
  vec4 col = texture2D(tDiffuse, vUv);
  float d = texture2D(tDepth, vUv).x;
  bool sky = d >= 0.99999;
  vec3 wp = worldAt(vUv, sky ? 0.9999 : d);
  vec3 rd = wp - uCamPos;
  float dist = sky ? 700.0 : length(rd);
  rd = normalize(rd);
  // exponential height fog, integrated along the ray (closed form)
  float b = uFalloff;
  float h0 = uCamPos.y - uWater;
  float ry = abs(rd.y) < 1e-4 ? 1e-4 : rd.y;
  float fogAmt = uDensity * exp(-h0 * b) * (1.0 - exp(-dist * ry * b)) / (ry * b);
  // drifting mist close to the water
  vec2 mp = (uCamPos.xz + rd.xz * min(dist, 60.0)) * 0.06 + vec2(uTime * 0.012, uTime * 0.005);
  float mist = (vn(mp) * 0.6 + vn(mp * 2.7) * 0.4);
  float low = exp(-max(0.0, (sky ? 2.0 : wp.y) - uWater) * 0.55);
  fogAmt += uMist * mist * low * (1.0 - exp(-dist * 0.035)) * 0.9;
  fogAmt = 1.0 - exp(-fogAmt);
  if (sky) fogAmt *= 0.35 * smoothstep(0.35, 0.0, rd.y);
  float mie = pow(max(dot(rd, uSunDir), 0.0), 7.0);
  vec3 fogC = uFogCol + uSunCol * mie * 0.55;
  vec3 c = mix(col.rgb, fogC, clamp(fogAmt, 0.0, 1.0));
  // light shafts: march towards the sun on screen, collecting open sky
  if (uRays > 0.001 && uSunScreen.z > 0.0) {
    vec2 delta = (uSunScreen.xy - vUv) / 28.0;
    vec2 uv = vUv;
    float illum = 0.0, decay = 1.0;
    float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    uv += delta * jitter;
    for (int i = 0; i < 28; i++) {
      uv += delta;
      float sd = texture2D(tDepth, uv).x;
      illum += step(0.99999, sd) * decay;
      decay *= 0.965;
    }
    illum /= 28.0;
    float near = smoothstep(0.9, 0.0, length((vUv - uSunScreen.xy) * vec2(1.6, 1.0)));
    c += uSunCol * illum * near * uRays * 0.9;
  }
  gl_FragColor = vec4(c, col.a);
}`
};

// The scene is drawn into its own target (MSAA + depth texture); the
// atmosphere pass reads colour and depth from it and starts the chain.
class ScenePass extends Pass {
  constructor(scene, camera, target) { super(); Object.assign(this, { scene, camera, target }); this.needsSwap = false; }
  render(renderer) { renderer.setRenderTarget(this.target); renderer.clear(); renderer.render(this.scene, this.camera); }
}
class AtmospherePass extends ShaderPass {
  constructor(target) {
    super(AtmosphereShader, 'tUnused');
    this.uniforms.tDiffuse.value = target.texture;
    this.uniforms.tDepth.value = target.depthTexture;
  }
}

// shallow depth of field for close views: a gathered disc blur sized by the
// circle of confusion from the depth buffer (off when aperture is 0)
const FocusShader = {
  uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, uFocus: { value: 4 }, uAperture: { value: 0 },
    uNear: { value: 0.08 }, uFar: { value: 1200 }, uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 1024) } },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
#include <packing>
uniform sampler2D tDiffuse; uniform sampler2D tDepth;
uniform float uFocus; uniform float uAperture; uniform float uNear; uniform float uFar; uniform vec2 uTexel;
varying vec2 vUv;
float viewDist(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
float coc(float z){ return clamp(abs(z - uFocus) / max(z, 0.1) * uAperture * 26.0, 0.0, 14.0); }
void main(){
  vec4 c = texture2D(tDiffuse, vUv);
  if (uAperture < 0.01) { gl_FragColor = c; return; }
  float r0 = coc(viewDist(vUv));
  vec3 acc = c.rgb; float wsum = 1.0;
  for (int i = 0; i < 20; i++) {
    float rr = sqrt((float(i) + 0.5) / 20.0);
    float th = float(i) * 2.39996;
    vec2 o = vec2(cos(th), sin(th)) * rr;
    vec2 uv = vUv + o * 14.0 * uTexel;
    float ri = coc(viewDist(uv));
    float w = smoothstep(rr * 14.0 - 1.0, rr * 14.0 + 1.0, max(min(ri, r0 + 2.0), 0.0));
    acc += texture2D(tDiffuse, uv).rgb * w; wsum += w;
  }
  gl_FragColor = vec4(acc / wsum, c.a);
}`
};

// vignette, grain and a gentle split-tone grade, after tone mapping
const FinishShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uWarm: { value: 0.5 }, uVig: { value: 0.32 } },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
uniform sampler2D tDiffuse; uniform float uTime; uniform float uWarm; uniform float uVig;
varying vec2 vUv;
void main(){
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  vec3 shadowT = mix(vec3(0.94, 0.98, 1.06), vec3(0.97, 0.98, 1.03), uWarm);
  vec3 highT = mix(vec3(1.0, 0.99, 0.97), vec3(1.05, 1.0, 0.92), uWarm);
  c *= mix(shadowT, highT, smoothstep(0.15, 0.85, l));
  vec2 q = vUv - 0.5;
  c *= 1.0 - uVig * smoothstep(0.25, 0.85, length(q * vec2(1.25, 1.0)));
  float n = fract(sin(dot(vUv * 1000.0 + uTime * 13.7, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  c += n * 0.022;
  gl_FragColor = vec4(c, 1.0);
}`
};

export async function buildScene(canvas, tierName, onProgress = () => {}) {
  const tier = TIERS[tierName];
  installPCSS({ frustumWidth: SHADOW_HALF * 2, depthRange: SHADOW_FAR - 1, blocker: tier.blocker, pcf: tier.pcf });
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  const ratio = Math.min(window.devicePixelRatio || 1, tier.ratio);
  renderer.setPixelRatio(ratio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.08, 1200);

  // ---------------------------------------------------------------- assets
  const base = new URL('../assets/', import.meta.url);
  const texLoader = new THREE.TextureLoader();
  let done = 0;
  const tick = (x) => { onProgress(++done / 9); return x; };
  const tex = (name, srgb) => texLoader.loadAsync(new URL(name, base).href).then((t) => {
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tick(t);
  });
  const gltf = new GLTFLoader();
  gltf.setMeshoptDecoder(MeshoptDecoder);
  const bin = (name) => fetch(new URL(name, base)).then((r) => { if (!r.ok) throw new Error(name); return r.arrayBuffer(); }).then(tick);
  const [treeG, islandG, rosBuf, meta, atlas, leafN, barkColor, barkNormal] = await Promise.all([
    gltf.loadAsync(new URL('tree.glb', base).href).then(tick),
    gltf.loadAsync(new URL('island.glb', base).href).then(tick),
    bin('rosettes.bin'),
    fetch(new URL('tree.json', base)).then((r) => r.json()).then(tick),
    tex('leaf-atlas-web.png', false), tex('leaf-normal-web.png', false),
    tex('bark-color.jpg', true), tex('bark-normal.jpg', false)
  ]);
  for (const t of [barkColor, barkNormal]) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const WATER = meta.water;

  // ---------------------------------------------------------------- light
  const sky = createSky();
  scene.add(sky);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(tier.shadow, tier.shadow);
  Object.assign(sun.shadow.camera, { left: -SHADOW_HALF, right: SHADOW_HALF, top: SHADOW_HALF, bottom: -SHADOW_HALF, near: 1, far: SHADOW_FAR });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  const target = new THREE.Object3D();
  target.position.set(2.5, 5, 0);
  scene.add(target);
  sun.target = target;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbfd2e0, 0x2a2a20, 0.15);
  scene.add(hemi);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(sky.geometry, sky.material);
  envSky.frustumCulled = false;
  envScene.add(envSky);
  let envRT = null;

  // ---------------------------------------------------------------- tree
  let bark = null;
  treeG.scene.traverse((o) => { if (o.isMesh) bark = o; });
  bark.material = makeBarkMaterial({ barkColor, barkNormal });
  bark.customDepthMaterial = makeBarkMaterial({}, true);
  bark.castShadow = bark.receiveShadow = true;
  bark.frustumCulled = false;
  scene.add(bark);

  let island = null;
  islandG.scene.traverse((o) => { if (o.isMesh) island = o; });
  island.material = makeIslandMaterial();
  island.castShadow = island.receiveShadow = true;
  scene.add(island);

  // heightfield of the island, rasterised from its triangles (for grass and litter)
  const HF = 96, HR = 8.6;
  const hf = new Float32Array(HF * HF).fill(WATER - 1);
  {
    const p = island.geometry.attributes.position, idx = island.geometry.index;
    const n = idx ? idx.count : p.count;
    const get = (i) => (idx ? idx.getX(i) : i);
    for (let t = 0; t < n; t += 3) {
      for (let k = 0; k < 3; k++) {
        const v = get(t + k);
        const x = p.getX(v), y = p.getY(v), z = p.getZ(v);
        const gx = Math.round((x + HR) / (2 * HR) * (HF - 1)), gz = Math.round((z + HR) / (2 * HR) * (HF - 1));
        if (gx >= 0 && gz >= 0 && gx < HF && gz < HF) hf[gz * HF + gx] = Math.max(hf[gz * HF + gx], y);
      }
    }
  }
  const heightAt = (x, z) => {
    const fx = (x + HR) / (2 * HR) * (HF - 1), fz = (z + HR) / (2 * HR) * (HF - 1);
    const ix = Math.max(0, Math.min(HF - 2, Math.floor(fx))), iz = Math.max(0, Math.min(HF - 2, Math.floor(fz)));
    const tx = fx - ix, tz = fz - iz;
    const a = hf[iz * HF + ix], b = hf[iz * HF + ix + 1], c = hf[(iz + 1) * HF + ix], d = hf[(iz + 1) * HF + ix + 1];
    return Math.max(WATER, (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz);
  };
  const inIsland = (x, z) => heightAt(x, z) > WATER + 0.25;

  const rosettes = new Float32Array(rosBuf);
  const stride = meta.rosetteStride;
  const canopy = createCanopy(rosettes, stride, atlas, leafN, tier.density, tier.geo);
  scene.add(canopy.mesh);
  const grass = createGrass(heightAt, tier.grass, inIsland);
  scene.add(grass);

  const water = createWater(WATER, tier.reflect, ratio);
  scene.add(water);
  const wu = water.material.uniforms;

  const loose = createLooseLeaves(900, atlas, leafN);
  scene.add(loose.mesh);
  const litter = new Litter(loose, rosettes, stride, 900, heightAt, WATER);

  // ---------------------------------------------------------------- post
  const depthTex = new THREE.DepthTexture(1, 1);
  depthTex.type = THREE.UnsignedIntType;
  const sceneRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: tier.msaa, depthTexture: depthTex });
  const composer = new EffectComposer(renderer);
  composer.addPass(new ScenePass(scene, camera, sceneRT));
  const atmo = new AtmospherePass(sceneRT);
  atmo.uniforms.uWater.value = WATER;
  composer.addPass(atmo);
  const focus = new ShaderPass(FocusShader);
  focus.uniforms.tDepth.value = sceneRT.depthTexture;
  composer.addPass(focus);
  let bloom = null;
  if (tier.bloom) { bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.65, 0.92); composer.addPass(bloom); }
  composer.addPass(new OutputPass());
  const finish = new ShaderPass(FinishShader);
  composer.addPass(finish);

  // ---------------------------------------------------------------- staging
  const state = { envKey: '', sunDir: new THREE.Vector3(0, 1, 0) };
  const tmp = new THREE.Vector3();
  /**
   * stage: { grow, sunDir (world, towards the sun), sunCol, sunI, zenith, horizon, glow,
   *          fog, density, mist, rays, exposure, warm, cloud }
   */
  function setStage(s) {
    UNIFORMS.uGrow.value = s.grow;
    state.sunDir.copy(s.sunDir).normalize();
    sun.position.copy(target.position).addScaledVector(state.sunDir, 60);
    sun.color.copy(s.sunCol);
    sun.intensity = s.sunI;
    const u = sky.material.uniforms;
    u.uSun.value.copy(state.sunDir);
    u.uZenith.value.copy(s.zenith); u.uHorizon.value.copy(s.horizon); u.uGlow.value.copy(s.glow); u.uSunCol.value.copy(s.sunCol);
    u.uCloud.value = s.cloud;
    wu.uHorizon.value.copy(s.horizon); wu.uZenith.value.copy(s.zenith); wu.uGlow.value.copy(s.glow); wu.uSun.value.copy(state.sunDir);
    hemi.color.copy(s.zenith).multiplyScalar(2.2);
    hemi.groundColor.setRGB(0.05, 0.05, 0.04);
    const a = atmo.uniforms;
    a.uSunDir.value.copy(state.sunDir); a.uSunCol.value.copy(s.sunCol).multiplyScalar(0.35 + 0.1 * s.sunI);
    a.uFogCol.value.copy(s.fog); a.uDensity.value = s.density; a.uMist.value = s.mist; a.uRays.value = s.rays;
    renderer.toneMappingExposure = s.exposure;
    focus.uniforms.uFocus.value = s.focus || 4;
    focus.uniforms.uAperture.value = s.aperture || 0;
    finish.uniforms.uWarm.value = s.warm;
    if (bloom) bloom.strength = 0.22 + 0.25 * s.rays;
    // image-based light follows the sky, re-baked when it changed enough
    const key = [s.horizon.r, s.zenith.b, state.sunDir.x, state.sunDir.y].map((v) => v.toFixed(2)).join();
    if (key !== state.envKey) {
      state.envKey = key;
      if (envRT) envRT.dispose();
      envRT = pmrem.fromScene(envScene, 0, 1, 1000);
      scene.environment = envRT.texture;
    }
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    const pr = renderer.getPixelRatio();
    sceneRT.setSize(Math.round(w * pr), Math.round(h * pr));
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 58 : 42;
    camera.updateProjectionMatrix();
  }

  function render(t) {
    sky.material.uniforms.uTimeS.value = t;
    wu.uTimeW.value = t;
    const a = atmo.uniforms;
    a.uTime.value = t;
    camera.updateMatrixWorld();
    a.uProjInv.value.copy(camera.projectionMatrixInverse);
    a.uViewInv.value.copy(camera.matrixWorld);
    a.uCamPos.value.copy(camera.position);
    a.uNear.value = camera.near; a.uFar.value = camera.far;
    focus.uniforms.uNear.value = camera.near; focus.uniforms.uFar.value = camera.far;
    focus.uniforms.uTexel.value.set(1 / sceneRT.width, 1 / sceneRT.height);
    tmp.copy(camera.position).addScaledVector(state.sunDir, 500).project(camera);
    const facing = camera.getWorldDirection(new THREE.Vector3()).dot(state.sunDir);
    a.uSunScreen.value.set(tmp.x * 0.5 + 0.5, tmp.y * 0.5 + 0.5, facing > 0.05 ? facing : 0);
    finish.uniforms.uTime.value = t % 100;
    composer.render();
  }

  return {
    renderer, scene, camera, sun, canopy, bark, island, water, grass, litter, meta, rosettes, stride,
    heightAt, inIsland, setStage, resize, render, tier, composer
  };
}
