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
import { createCanopy, createLooseLeaves, createShrubs, mulberry, UNIFORMS } from './foliage.js';
import { createSky, makeBarkMaterial, makeIslandMaterial, createWater, createGrass, createDistance, createMotes } from './environment.js';
import { Litter } from './litter.js';

export const TIERS = {
  high: { shadow: 4096, blocker: 14, pcf: 24, density: 1.0, leafTex: 'full', geo: [2, 2], ratio: 2, msaa: 4, reflect: 'full', bloom: true, grass: 16000, shadowEvery: 1, shrubs: 34 },
  medium: { shadow: 2048, blocker: 10, pcf: 16, density: 0.7, leafTex: 'full', geo: [2, 1], ratio: 1.5, msaa: 4, reflect: 'half', bloom: true, grass: 9000, shadowEvery: 2, shrubs: 24 },
  low: { shadow: 2048, blocker: 8, pcf: 10, density: 0.45, leafTex: 'lo', geo: [2, 1], ratio: 1.25, msaa: 0, reflect: false, bloom: false, grass: 4000, shadowEvery: 3, shrubs: 14 }
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

const SHADOW_HALF = 24;
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
    uTime: { value: 0 }, uWater: { value: -0.85 }, uAspect: { value: 1.78 }
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
#include <packing>
uniform sampler2D tDiffuse; uniform sampler2D tDepth;
uniform mat4 uProjInv; uniform mat4 uViewInv; uniform vec3 uCamPos;
uniform vec3 uSunDir; uniform vec3 uSunScreen; uniform vec3 uSunCol; uniform vec3 uFogCol;
uniform float uDensity; uniform float uFalloff; uniform float uMist; uniform float uRays; uniform float uTime; uniform float uWater; uniform float uAspect;
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
  // light shafts (volumetric light scattering): march towards the sun on
  // screen, collecting only the bright sky right around the sun, so the
  // streaks appear where branches and leaves break it up
  if (uRays > 0.001 && uSunScreen.z > 0.0) {
    vec2 delta = (uSunScreen.xy - vUv) / 32.0;
    vec2 uv = vUv;
    float illum = 0.0, decay = 1.0;
    float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    uv += delta * jitter;
    vec2 asp = vec2(uAspect, 1.0);
    for (int i = 0; i < 32; i++) {
      uv += delta;
      float sd = texture2D(tDepth, uv).x;
      float near = exp(-length((uv - uSunScreen.xy) * asp) * 9.0);
      illum += step(0.99999, sd) * near * decay;
      decay *= 0.96;
    }
    illum /= 32.0;
    c += uSunCol * illum * uRays * 2.2 * uSunScreen.z;
  }
  // keep the HDR chain finite: one stray NaN would bloom into a black hole
  c = clamp(c, 0.0, 64.0);
  if (!(c.r == c.r && c.g == c.g && c.b == c.b)) c = uFogCol;
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
    uNear: { value: 0.08 }, uFar: { value: 1200 }, uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 1024) }, uMaxR: { value: 14 } },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
#include <packing>
uniform sampler2D tDiffuse; uniform sampler2D tDepth;
uniform float uFocus; uniform float uAperture; uniform float uNear; uniform float uFar; uniform vec2 uTexel; uniform float uMaxR;
varying vec2 vUv;
float viewDist(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
float coc(float z){ return clamp(abs(z - uFocus) / max(z, 0.1) * uAperture * 26.0, 0.0, uMaxR); }
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main(){
  vec4 c = texture2D(tDiffuse, vUv);
  if (uAperture < 0.01) { gl_FragColor = c; return; }
  float r0 = coc(viewDist(vUv));
  vec3 acc = c.rgb; float wsum = 1.0;
  float rot = ign(gl_FragCoord.xy) * 6.2831;
  for (int i = 0; i < 36; i++) {
    float rr = sqrt((float(i) + 0.5) / 36.0);
    float th = float(i) * 2.39996 + rot;
    vec2 o = vec2(cos(th), sin(th)) * rr * uMaxR;
    vec2 uv = vUv + o * uTexel;
    float ri = coc(viewDist(uv));
    // a sample counts if its own blur reaches here (background never bleeds over a sharp foreground)
    float w = smoothstep(rr * uMaxR - 1.5, rr * uMaxR + 1.5, min(ri, r0 + 3.0));
    acc += min(texture2D(tDiffuse, uv).rgb, vec3(8.0)) * w; wsum += w;
  }
  gl_FragColor = vec4(acc / wsum, c.a);
}`
};

// vignette, grain and a gentle split-tone grade, after tone mapping
const FinishShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uWarm: { value: 0.5 }, uVig: { value: 0.32 }, uSat: { value: 1.0 }, uContrast: { value: 1.0 } },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
uniform sampler2D tDiffuse; uniform float uTime; uniform float uWarm; uniform float uVig; uniform float uSat; uniform float uContrast;
varying vec2 vUv;
void main(){
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, uSat);
  c = clamp((c - 0.5) * uContrast + 0.5, 0.0, 1.0);
  l = dot(c, vec3(0.299, 0.587, 0.114));
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
  // the leaves sway, so shadows move; weaker tiers refresh them every 2nd/3rd frame
  renderer.shadowMap.autoUpdate = false;
  let frameNo = 0;
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
    tex(tier.leafTex === 'full' ? 'leaf-atlas-web.png' : 'leaf-atlas-lo.png', false), tex(tier.leafTex === 'full' ? 'leaf-normal-web.png' : 'leaf-normal-lo.png', false),
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
  // 「虎踞龙盘」 cut into the front of the scholar's rock's plinth
  const pl = meta.anchors.plinth;
  let inscr = null;
  if (pl) {
    const yaw = pl.yaw;                                   // Blender Z rotation
    const n = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));   // the plinth front (Blender -y) in three.js
    const tg = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const c = new THREE.Vector3(...pl.centre).addScaledVector(n, pl.size[1] / 2);
    inscr = { centre: c.toArray(), normal: n.toArray(), tangent: tg.toArray(), size: [1.7, 0.3] };
  }
  island.material = makeIslandMaterial(inscr);
  island.castShadow = island.receiveShadow = true;
  scene.add(island);

  // heightfield of the island, rasterised from its triangles (for grass and litter)
  const HF = 96, HR = 8.6;
  const hf = new Float32Array(HF * HF).fill(WATER - 1);
  const rockF = new Float32Array(HF * HF);
  {
    const p = island.geometry.attributes.position, idx = island.geometry.index;
    const col = island.geometry.attributes.color;
    const n = idx ? idx.count : p.count;
    const get = (i) => (idx ? idx.getX(i) : i);
    for (let t = 0; t < n; t += 3) {
      for (let k = 0; k < 3; k++) {
        const v = get(t + k);
        const x = p.getX(v), y = p.getY(v), z = p.getZ(v);
        const gx = Math.round((x + HR) / (2 * HR) * (HF - 1)), gz = Math.round((z + HR) / (2 * HR) * (HF - 1));
        if (gx >= 0 && gz >= 0 && gx < HF && gz < HF) {
          hf[gz * HF + gx] = Math.max(hf[gz * HF + gx], y);
          if (col) rockF[gz * HF + gx] = Math.max(rockF[gz * HF + gx], col.getY(v));
        }
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
  const rockAt = (x, z) => {
    const ix = Math.round((x + HR) / (2 * HR) * (HF - 1)), iz = Math.round((z + HR) / (2 * HR) * (HF - 1));
    return ix < 0 || iz < 0 || ix >= HF || iz >= HF ? 1 : rockF[iz * HF + ix];
  };

  const rosettes = new Float32Array(rosBuf);
  const stride = meta.rosetteStride;
  const canopy = createCanopy(rosettes, stride, atlas, leafN, tier.density, tier.geo);
  scene.add(canopy.mesh);
  const grass = createGrass(heightAt, tier.grass, (x, z) => inIsland(x, z) && rockAt(x, z) < 0.35);
  // undergrowth: shrubs on soil between the granite, clear of the trunk and the buttresses
  {
    const r = mulberry(29), spots = [];
    for (let k = 0; k < 900 && spots.length < tier.shrubs; k++) {
      const a = r() * Math.PI * 2, d = 2.2 + Math.sqrt(r()) * 4.8;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!inIsland(x, z) || rockAt(x, z) > 0.3) continue;
      if (spots.some((p) => Math.hypot(p[0] - x, p[2] - z) < 0.9)) continue;
      spots.push([x, heightAt(x, z) - 0.05, z, 0.3 + r() * 0.45]);
    }
    if (spots.length) scene.add(createShrubs(spots, atlas, leafN));
  }
  scene.add(grass);

  const distance = createDistance(WATER);
  scene.add(distance);
  const motes = createMotes(tierName === 'low' ? 260 : 600);
  scene.add(motes);
  motes.material.uniforms.uPx.value = ratio;
  // the tree's shadow on the shallow lagoon (strongest near the islet, gone in deep water)
  const shadowCatch = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.ShadowMaterial({ opacity: 0.32, transparent: true, depthWrite: false }));
  shadowCatch.rotation.x = -Math.PI / 2;
  shadowCatch.position.y = WATER + 0.012;
  shadowCatch.receiveShadow = true;
  shadowCatch.renderOrder = -4;
  shadowCatch.material.onBeforeCompile = (sh) => {
    // fades out at the lagoon's edge; from above (where the pale bed shows) the shade is deeper
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vSC; varying vec3 vSW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSC = position.xy; vSW = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vSC; varying vec3 vSW;')
      .replace('gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );', 'float steepS = smoothstep( 0.45, 0.92, normalize( cameraPosition - vSW ).y );\n  gl_FragColor = vec4( color, opacity * mix( 1.0, 1.7, steepS ) * ( 1.0 - getShadowMask() ) * smoothstep( mix( 26.0, 29.5, steepS ), 9.0, length( vSC ) ) );');
  };
  scene.add(shadowCatch);
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
    distance.material.uniforms.uSun.value.copy(state.sunDir);
    motes.material.uniforms.uSunM.value.copy(state.sunDir);
    motes.material.uniforms.uSunColM.value.copy(s.sunCol).multiplyScalar(0.3 * s.sunI * (0.3 + s.rays));
    distance.material.uniforms.uHorizon.value.copy(s.horizon);
    distance.material.uniforms.uGlow.value.copy(s.glow);
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
    finish.uniforms.uSat.value = s.sat ?? 1;
    finish.uniforms.uContrast.value = s.contrast ?? 1;
    if (bloom) bloom.strength = 0.12 + 0.14 * s.rays;
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
    camera.userData.screen = camera.aspect = w / h;
    camera.updateProjectionMatrix();   // the dwell camera re-applies its lens shift for the new shape
    atmo.uniforms.uAspect.value = w / h;
  }

  function render(t) {
    sky.material.uniforms.uTimeS.value = t;
    motes.material.uniforms.uTimeM.value = t;
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
    focus.uniforms.uMaxR.value = Math.max(8, sceneRT.height / 52);
    tmp.copy(camera.position).addScaledVector(state.sunDir, 500).project(camera);
    const facing = camera.getWorldDirection(new THREE.Vector3()).dot(state.sunDir);
    a.uSunScreen.value.set(tmp.x * 0.5 + 0.5, tmp.y * 0.5 + 0.5, facing > 0.05 ? facing : 0);
    finish.uniforms.uTime.value = t % 100;
    if (frameNo++ % tier.shadowEvery === 0) renderer.shadowMap.needsUpdate = true;
    composer.render();
  }

  return {
    renderer, scene, camera, sun, canopy, bark, island, water, grass, litter, meta, rosettes, stride,
    heightAt, inIsland, setStage, resize, render, tier, composer
  };
}
