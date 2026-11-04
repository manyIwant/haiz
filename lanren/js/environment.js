// The place: a small rock island in still water, mist, sky and light.
// No buildings — the tree stands alone, as a concept of the species.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { WIND_GLSL, UNIFORMS, mulberry } from './foliage.js';

// ------------------------------------------------------------------ sky
const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const SKY_FRAG = /* glsl */`
uniform vec3 uSun; uniform float uTimeS; uniform float uCloud;
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGlow; uniform vec3 uSunCol;
varying vec3 vDir;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + 3.1; a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  vec3 col = mix(uHorizon, uZenith, pow(h, 0.5));
  float cs = max(dot(d, uSun), 0.0);
  col += uGlow * (pow(cs, 6.0) * 0.45 + pow(cs, 48.0) * 0.8);
  col += uSunCol * smoothstep(0.99955, 0.9999, cs) * 14.0;
  if (d.y > 0.0) {
    vec2 uv = d.xz / (d.y + 0.15) * 1.1 + vec2(uTimeS * 0.003, uTimeS * 0.001);
    float c = fbm(uv * 1.3);
    float m = smoothstep(0.58 - uCloud * 0.25, 0.9, c) * smoothstep(0.0, 0.22, d.y);
    vec3 cl = mix(uHorizon * 1.08, uZenith * 0.6 + uHorizon * 0.7, 0.4) + uGlow * pow(cs, 3.0) * 0.9;
    col = mix(col, cl, m * 0.55);
  }
  // below the horizon the sky turns to the colour of distant water and haze
  col = mix(col, uHorizon * 0.78, smoothstep(0.0, -0.05, d.y));
  gl_FragColor = vec4(col, 1.0);
}`;

export function createSky() {
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false,
    uniforms: {
      uSun: { value: new THREE.Vector3(0, 1, 0) }, uTimeS: { value: 0 }, uCloud: { value: 0.5 },
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() },
      uSunCol: { value: new THREE.Color() }
    }
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(600, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

// ------------------------------------------------------------------ bark that grows
// TEXCOORD_1 carries (birth time, ring radius). Rings not yet born shrink to
// the branch axis, so shoots extend from their tips; young wood thickens.
export function makeBarkMaterial(tex, depth = false) {
  const mat = depth
    ? new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
    : new THREE.MeshStandardMaterial({ map: tex.barkColor, normalMap: tex.barkNormal, roughness: 0.92, metalness: 0,
      normalScale: new THREE.Vector2(1.15, 1.15), envMapIntensity: 0.75 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, UNIFORMS);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
${WIND_GLSL}
uniform float uGrow;
attribute vec4 color;
attribute vec2 uv1;
varying vec3 vBark; varying vec3 vWN; varying vec3 vWP; varying float vNew;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  float since = uGrow - uv1.x;
  float tip = smoothstep(0.0, 0.035, since);
  float thick = uv1.x > -0.5 ? mix(0.45, 1.0, smoothstep(0.0, 0.3, since)) : 1.0;
  transformed -= normalize(normal) * uv1.y * (1.0 - tip * thick);
  float te;
  transformed += windSway(position, color.g) + touchPush(position, te) * color.g * color.g;
  vBark = color.rgb; vWN = normal; vWP = position;
  vNew = uv1.x > -0.5 ? 1.0 - smoothstep(0.05, 0.45, since) : 0.0;`);
    if (!depth) {
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vBark; varying vec3 vWN; varying vec3 vWP; varying float vNew;
float bh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
float bn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(bh(i), bh(i + vec3(1,0,0)), f.x), mix(bh(i + vec3(0,1,0)), bh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(bh(i + vec3(0,0,1)), bh(i + vec3(1,0,1)), f.x), mix(bh(i + vec3(0,1,1)), bh(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
  float youth = vBark.b;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.15, 0.10, 0.075), smoothstep(0.3, 1.0, youth) * 0.7);
  // this season's shoots: smooth, reddish green
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.12, 0.05), vNew * 0.85);
  float up = normalize(vWN).y;
  float mossN = bn(vWP * 2.3) * 0.6 + bn(vWP * 7.0) * 0.4;
  float moss = smoothstep(0.35, 0.85, up) * (1.0 - youth) * smoothstep(0.45, 0.7, mossN);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.075, 0.02), moss * 0.85);
  diffuseColor.rgb *= mix(0.75, 1.0, smoothstep(-0.5, 1.2, vWP.y));`)
        .replace('#include <aomap_fragment>', `
  float bao = mix(0.25, 1.0, vBark.r);
  reflectedLight.indirectDiffuse *= bao; reflectedLight.indirectSpecular *= bao;`);
    }
  };
  mat.customProgramCacheKey = () => 'bark2-' + depth;
  return mat;
}

// ------------------------------------------------------------------ island
// COLOR_0 = (ao, rockiness, wetness). Moss and soil green up with growth.
export function makeIslandMaterial() {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, envMapIntensity: 0.6 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGrow = UNIFORMS.uGrow;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 color; varying vec4 vI; varying vec3 vIP; varying vec3 vIN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvI = color; vIP = position; vIN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uGrow;
varying vec4 vI; varying vec3 vIP; varying vec3 vIN;
float ih(vec3 p){ return fract(sin(dot(p, vec3(7.13, 157.1, 113.7))) * 43758.5453); }
float inn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(ih(i), ih(i + vec3(1,0,0)), f.x), mix(ih(i + vec3(0,1,0)), ih(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(ih(i + vec3(0,0,1)), ih(i + vec3(1,0,1)), f.x), mix(ih(i + vec3(0,1,1)), ih(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <color_fragment>', `
  float g1 = inn(vIP * 3.0) * 0.5 + inn(vIP * 11.0) * 0.3 + inn(vIP * 0.9) * 0.2;
  vec3 rock = mix(vec3(0.075, 0.072, 0.065), vec3(0.15, 0.14, 0.12), g1) * (0.85 + 0.3 * inn(vIP * 23.0));
  vec3 soil = mix(vec3(0.07, 0.055, 0.04), vec3(0.11, 0.09, 0.06), g1);
  vec3 moss = mix(vec3(0.09, 0.08, 0.04), vec3(0.06, 0.12, 0.03), smoothstep(0.1, 0.8, uGrow));
  float mossy = smoothstep(0.35, 0.75, inn(vIP * 1.6)) * smoothstep(0.4, 0.9, normalize(vIN).y);
  vec3 c = mix(soil, moss, mossy * 0.8);
  c = mix(c, rock, smoothstep(0.35, 0.7, vI.g));
  c *= mix(1.0, 0.55, vI.b);
  diffuseColor.rgb = c;`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(0.92, 0.35, vI.b);')
      .replace('#include <aomap_fragment>', `
  float iao = mix(0.3, 1.0, vI.r);
  reflectedLight.indirectDiffuse *= iao; reflectedLight.indirectSpecular *= iao;`);
  };
  mat.customProgramCacheKey = () => 'island2';
  return mat;
}

// ------------------------------------------------------------------ water
const WATER_FRAG = /* glsl */`
uniform vec3 color;
uniform sampler2D tDiffuse;
uniform float uTimeW; uniform vec3 uHorizon; uniform vec3 uZenith; uniform vec3 uGlow; uniform vec3 uSun;
uniform float uHasRefl;
varying vec4 vUv;
varying vec3 vWorld;
float wh(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float wn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wh(i), wh(i + vec2(1, 0)), f.x), mix(wh(i + vec2(0, 1)), wh(i + vec2(1, 1)), f.x), f.y); }
void main(){
  vec2 p = vWorld.xz;
  float t = uTimeW;
  // a few slow, broad ripples: still water, barely breathing
  vec2 n = vec2(wn(p * 0.45 + vec2(t * 0.05, 0.0)) - wn(p * 0.45 + vec2(0.0, t * 0.04) + 7.0),
                wn(p * 1.3 - vec2(t * 0.08, t * 0.03)) - wn(p * 1.3 + 3.0)) * 0.012;
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = 0.02 + 0.98 * pow(1.0 - max(V.y, 0.0), 5.0);
  vec3 R = reflect(-V, normalize(vec3(n.x * 6.0, 1.0, n.y * 6.0)));
  vec3 sky = mix(uHorizon, uZenith, pow(max(R.y, 0.0), 0.5)) + uGlow * pow(max(dot(R, uSun), 0.0), 8.0) * 0.6;
  vec3 refl = sky;
  if (uHasRefl > 0.5) {
    vec4 uv = vUv; uv.xy += n * uv.w;
    vec4 r = texture2DProj(tDiffuse, uv);
    refl = mix(sky, r.rgb, 0.92);
  }
  vec3 deep = vec3(0.012, 0.02, 0.022);
  vec3 c = mix(deep, refl, clamp(fres * 1.25 + 0.25, 0.0, 1.0));
  gl_FragColor = vec4(c, 1.0);
}`;
const WATER_VERT = /* glsl */`
uniform mat4 textureMatrix;
varying vec4 vUv;
varying vec3 vWorld;
void main(){
  vUv = textureMatrix * vec4(position, 1.0);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export function createWater(level, reflect, pixelRatio) {
  const geo = new THREE.PlaneGeometry(1400, 1400);
  const uniforms = {
    color: { value: new THREE.Color(0x888888) }, tDiffuse: { value: null }, textureMatrix: { value: new THREE.Matrix4() },
    uTimeW: { value: 0 }, uHorizon: { value: new THREE.Color() }, uZenith: { value: new THREE.Color() },
    uGlow: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uHasRefl: { value: reflect ? 1 : 0 }
  };
  let mesh;
  if (reflect) {
    const res = reflect === 'half' ? 0.5 : 0.75;
    mesh = new Reflector(geo, {
      textureWidth: Math.round(innerWidth * pixelRatio * res), textureHeight: Math.round(innerHeight * pixelRatio * res),
      clipBias: 0.003, multisample: 0,
      shader: { name: 'HaizWater', uniforms, vertexShader: WATER_VERT, fragmentShader: WATER_FRAG }
    });
    mesh.material.uniforms.uHasRefl.value = 1;
  } else {
    mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms, vertexShader: WATER_VERT, fragmentShader: WATER_FRAG }));
  }
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = level;
  mesh.renderOrder = -5;
  mesh.name = 'water';
  return mesh;
}

// ------------------------------------------------------------------ grass on the island
export function createGrass(heightAt, count, inIsland) {
  const rand = mulberry(41);
  const geo = new THREE.BufferGeometry();
  // a blade: 4 segments, tapering
  const pos = [], idx = [];
  const SEG = 4;
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG, w = 0.008 * (1 - t * 0.85);
    pos.push(-w, t, 0, w, t, 0);
  }
  for (let i = 0; i < SEG; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const offs = [], data = [];
  let made = 0, tries = 0;
  while (made < count && tries < count * 20) {
    tries++;
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 6.2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!inIsland(x, z)) continue;
    // clumps, not a lawn
    const clump = Math.sin(x * 1.7 + 1.3) * Math.sin(z * 1.3 - 0.4) + Math.sin(x * 0.6 - z * 0.9);
    if (clump < -0.2 && rand() < 0.75) continue;
    if (Math.hypot(x, z) < 0.9) continue;
    offs.push(x, heightAt(x, z) - 0.02, z);
    data.push(rand() * Math.PI * 2, 0.07 + rand() * 0.16, rand(), (rand() - 0.5) * 0.5);
    made++;
  }
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(new Float32Array(offs), 3));
  geo.setAttribute('aData', new THREE.InstancedBufferAttribute(new Float32Array(data), 4));
  const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.75, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, UNIFORMS);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
${WIND_GLSL}
uniform float uGrow;
attribute vec3 aOff; attribute vec4 aData; varying float vGT; varying float vGR;`)
      .replace('#include <begin_vertex>', `
  float t = position.y;
  float hgt = aData.y * mix(0.35, 1.0, smoothstep(0.0, 0.7, uGrow - aData.z * 0.2));
  float c = cos(aData.x), s = sin(aData.x);
  vec3 transformed = vec3(position.x * c, t * hgt, position.x * s);
  float bendAmt = aData.w + sin(uTime * 1.3 + aOff.x * 1.7 + aOff.z) * 0.12 * uWind * (0.5 + uGust);
  transformed.x += bendAmt * t * t * hgt;
  transformed += aOff;
  vGT = t; vGR = aData.z;`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 0.3, 1.0);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uGrow; varying float vGT; varying float vGR;')
      .replace('#include <color_fragment>', `
  vec3 dry = vec3(0.13, 0.10, 0.05), green = mix(vec3(0.035, 0.08, 0.015), vec3(0.07, 0.13, 0.02), vGR);
  float gr = smoothstep(0.05 + vGR * 0.3, 0.55 + vGR * 0.3, uGrow);
  diffuseColor.rgb = mix(dry, green, gr) * mix(0.45, 1.15, vGT);`);
  };
  mat.customProgramCacheKey = () => 'grass2';
  const mesh = new THREE.InstancedMesh(geo, mat, made);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  return mesh;
}
