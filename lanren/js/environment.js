// The place: a small rock island in still water, mist, sky and light.
// No buildings — the tree stands alone, as a concept of the species.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { WIND_GLSL, FALL_GLSL, UNIFORMS, mulberry } from './foliage.js';

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
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vn(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 3.1; a *= 0.5; } return s; }
float cloudField(vec2 uv){ return fbm(uv * 0.5) * 0.72 + fbm(uv * 2.1 + 7.0) * 0.34; }
void main(){
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  vec3 col = mix(uHorizon, uZenith, pow(h, 0.55));
  float cs = max(dot(d, uSun), 0.0);
  // a luminous band of haze along the horizon, warmer towards the sun
  col = mix(col, uHorizon * 1.04 + uGlow * 0.10 * pow(cs, 2.0), exp(-h * 16.0) * 0.5);
  col += uGlow * (pow(cs, 5.0) * 0.32 + pow(cs, 40.0) * 0.55 + pow(cs, 600.0) * 1.6);
  col += uSunCol * smoothstep(0.99962, 0.99985, cs) * 22.0;
  if (d.y > 0.0) {
    vec2 uv = d.xz / (d.y + 0.11) + vec2(uTimeS * 0.004, uTimeS * 0.0015);
    float c = cloudField(uv);
    float cov = mix(0.62, 0.36, uCloud);
    float dens = smoothstep(cov, cov + 0.2, c);
    // self-shadowing: denser cloud between this point and the sun darkens it
    vec2 toSun = normalize(uSun.xz + vec2(1e-4)) * 0.16;
    float c2 = cloudField(uv + toSun);
    float lit = clamp(1.15 - (c2 - c) * 3.2, 0.42, 1.25);
    vec3 cTop = mix(vec3(0.96, 0.95, 0.93), uGlow * 0.9 + uHorizon * 0.3, 0.35);
    vec3 cBase = mix(uZenith * 0.75 + uHorizon * 0.45, uHorizon * 0.7, 0.4);
    vec3 cc = mix(cBase, cTop, lit * 0.8) + uGlow * pow(cs, 7.0) * 0.9 * (1.3 - lit);
    float fade = smoothstep(0.0, 0.16, d.y) * (1.0 - 0.35 * exp(-h * 6.0));
    col = mix(col, cc, dens * fade * 0.88);
  }
  // twilight opposite a low sun: the pink anti-twilight arch over the blue-grey shadow of the earth
  float tw = smoothstep(0.30, 0.06, uSun.y);
  if (tw > 0.0) {
    vec3 sf = normalize(vec3(uSun.x, 0.0, uSun.z) + vec3(1e-4, 0.0, 0.0));
    float anti = max(dot(normalize(vec3(d.x, 0.0, d.z) + vec3(1e-4, 0.0, 0.0)), -sf), 0.0);
    float side = smoothstep(-0.15, 0.85, anti);
    float el = asin(clamp(d.y, -1.0, 1.0)) * 57.2958;
    float belt = smoothstep(1.5, 6.0, el) * (1.0 - smoothstep(9.0, 22.0, el));
    float earth = 1.0 - smoothstep(0.5, 4.5, el);
    vec3 pink = vec3(0.98, 0.64, 0.62) * (0.62 + 0.25 * dot(uHorizon, vec3(0.33)));
    vec3 shade = vec3(0.30, 0.36, 0.52) * (0.55 + 0.4 * dot(uHorizon, vec3(0.33)));
    col = mix(col, pink, belt * side * tw * 0.42);
    col = mix(col, shade, earth * side * tw * 0.55 * step(-0.02, d.y));
    // the zenith deepens towards the side away from the sun
    col *= mix(1.0, 0.86, tw * side * smoothstep(10.0, 60.0, el));
  }
  // below the horizon: the colour of distant water and haze
  col = mix(col, uHorizon * 0.8, smoothstep(0.0, -0.06, d.y));
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

// ------------------------------------------------------------------ distance
// Low island ranges and headlands far across the water: natural layers of
// depth (no buildings). The atmosphere pass hazes them by distance.
export function createDistance(water) {
  const rand = mulberry(77);
  const pos = [], col = [], idx = [];
  const ranges = [
    // centre azimuth (deg), half-width (deg), radius (m), height (m), roughness
    [175, 34, 520, 26, 0.5], [146, 14, 330, 12, 0.7], [212, 16, 400, 15, 0.6],
    [300, 30, 560, 34, 0.45], [335, 12, 360, 10, 0.8], [270, 10, 300, 8, 0.7],
    [95, 24, 600, 30, 0.4], [40, 18, 460, 18, 0.6], [128, 10, 760, 44, 0.35]
  ];
  for (const [c, hw, R, H, rough] of ranges) {
    const seg = Math.max(24, Math.round(hw * 3));
    const base = pos.length / 3;
    const ph = rand() * 100;
    for (let i = 0; i <= seg; i++) {
      const u = i / seg;
      const az = ((c - hw + 2 * hw * u) * Math.PI) / 180;
      const env = Math.pow(Math.sin(Math.PI * u), 0.6);
      let h = 0, a = 1, f = 1;
      for (let o = 0; o < 4; o++) { h += a * (0.5 + 0.5 * Math.sin(u * f * 9.0 + ph * (o + 1) + Math.sin(u * f * 23.0 + o) * rough)); a *= 0.5; f *= 2.1; }
      h = H * env * (0.45 + 0.55 * h / 1.9);
      const r = R * (1 + 0.04 * Math.sin(u * 7 + ph));
      const x = Math.sin(az) * r, z = Math.cos(az) * r;
      pos.push(x, water - 2, z, x, water + h, z);
      const shade = 0.75 + 0.25 * rand();
      col.push(shade, 0, shade, 1);
    }
    for (let i = 0; i < seg; i++) { const k = base + i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aRidge', new THREE.Float32BufferAttribute(col, 2));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: new THREE.Vector3(0, 1, 0) }, uHorizon: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() } },
    vertexShader: /* glsl */`
      attribute vec2 aRidge; varying float vTop; varying float vShade; varying vec3 vW;
      void main(){ vTop = aRidge.y; vShade = aRidge.x; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uSun; uniform vec3 uHorizon; uniform vec3 uGlow;
      varying float vTop; varying float vShade; varying vec3 vW;
      void main(){
        vec3 d = normalize(vW - cameraPosition);
        float toward = pow(max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uSun.x, 0.0, uSun.z))), 0.0), 3.0);
        // silhouettes against the light, a hint of colour when the sun is behind the viewer
        vec3 land = mix(vec3(0.06, 0.075, 0.07), vec3(0.10, 0.12, 0.09), 1.0 - toward) * vShade;
        vec3 c = mix(land, uHorizon * 0.9, 0.18 + 0.2 * toward);
        gl_FragColor = vec4(c, 1.0);
      }`
  });
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.name = 'distance';
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
uniform vec4 uFall;
varying vec3 vBark; varying vec3 vWN; varying vec3 vWP; varying float vNew;
float bh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
float bn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(bh(i), bh(i + vec3(1,0,0)), f.x), mix(bh(i + vec3(0,1,0)), bh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(bh(i + vec3(0,0,1)), bh(i + vec3(1,0,1)), f.x), mix(bh(i + vec3(0,1,1)), bh(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
  float youth = vBark.b;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.19, 0.155, 0.12), smoothstep(0.3, 1.0, youth) * 0.7);
  // this season's shoots: smooth, reddish green
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.20, 0.17, 0.10), vNew * 0.8);
  float up = normalize(vWN).y;
  float mossN = bn(vWP * 2.3) * 0.6 + bn(vWP * 7.0) * 0.4;
  float moss = smoothstep(0.35, 0.85, up) * (1.0 - youth) * smoothstep(0.45, 0.7, mossN);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.075, 0.02), moss * 0.85);
  diffuseColor.rgb *= mix(0.75, 1.0, smoothstep(-0.5, 1.2, vWP.y));`)
        .replace('#include <aomap_fragment>', `
  float bao = mix(mix(0.25, 0.6, vBark.b), 1.0, vBark.r);
  // under the crown the ambient light has passed through leaves: warmer, greener, not sky-blue
  vec3 under = mix(vec3(0.72, 0.82, 0.55), vec3(1.0), smoothstep(0.35, 0.9, vBark.r));
  reflectedLight.indirectDiffuse *= bao * under; reflectedLight.indirectSpecular *= bao;
${FALL_GLSL}`);
    }
  };
  mat.customProgramCacheKey = () => 'bark3-' + depth;
  return mat;
}

// ------------------------------------------------------------------ island
// COLOR_0 = (ao, rockiness, wetness). Moss and soil green up with growth.
/** The inscription 「虎踞龙盘」 cut into the plinth, drawn with the visitor's own Kai or serif face. */
function inscriptionTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '600 190px "STKaiti", "KaiTi", "Kaiti SC", "LXGW WenKai", "BiauKai", "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif';
  ['虎', '踞', '龙', '盘'].forEach((ch, i) => g.fillText(ch, 128 + i * 256, 132));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

export function makeIslandMaterial(inscr = null) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, envMapIntensity: 0.6 });
  const iu = {
    uInscr: { value: inscr ? inscriptionTexture() : null }, uInscrOn: { value: inscr ? 1 : 0 },
    uInscrC: { value: new THREE.Vector3(...(inscr?.centre || [0, -99, 0])) }, uInscrN: { value: new THREE.Vector3(...(inscr?.normal || [0, 0, 1])) },
    uInscrT: { value: new THREE.Vector3(...(inscr?.tangent || [1, 0, 0])) }, uInscrSize: { value: new THREE.Vector2(...(inscr?.size || [2.2, 0.42])) }
  };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGrow = UNIFORMS.uGrow;
    Object.assign(sh.uniforms, iu);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 color; varying vec4 vI; varying vec3 vIP; varying vec3 vIN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvI = color; vIP = position; vIN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uGrow;
uniform sampler2D uInscr; uniform float uInscrOn; uniform vec3 uInscrC; uniform vec3 uInscrN; uniform vec3 uInscrT; uniform vec2 uInscrSize;
varying vec4 vI; varying vec3 vIP; varying vec3 vIN;
float ih(vec3 p){ return fract(sin(dot(p, vec3(7.13, 157.1, 113.7))) * 43758.5453); }
float inn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(ih(i), ih(i + vec3(1,0,0)), f.x), mix(ih(i + vec3(0,1,0)), ih(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(ih(i + vec3(0,0,1)), ih(i + vec3(1,0,1)), f.x), mix(ih(i + vec3(0,1,1)), ih(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <color_fragment>', `
  float g1 = inn(vIP * 3.0) * 0.5 + inn(vIP * 11.0) * 0.3 + inn(vIP * 0.9) * 0.2;
  // weathered granite: pale grey with dark mica and light feldspar specks,
  // streaks where rain runs off, lichen on the tops, algae at the waterline
  float speck = inn(vIP * 61.0);
  vec3 rock = mix(vec3(0.15, 0.14, 0.125), vec3(0.27, 0.25, 0.22), g1);   // Hainan granite: weathered grey, warm feldspar
  rock *= 0.9 + 0.2 * inn(vIP * 23.0);
  rock = mix(rock, vec3(0.06, 0.055, 0.05), smoothstep(0.78, 0.9, speck) * 0.7);
  rock = mix(rock, vec3(0.42, 0.40, 0.37), smoothstep(0.1, 0.0, speck) * 0.5);
  float streak = inn(vec3(vIP.x * 3.0, vIP.y * 0.9, vIP.z * 3.0) + inn(vIP * 5.0) * 0.8);
  rock *= 1.0 - 0.16 * smoothstep(0.6, 0.9, streak) * (1.0 - normalize(vIN).y);
  float lich = smoothstep(0.55, 0.78, inn(vIP * 2.3 + 9.0)) * smoothstep(0.2, 0.8, normalize(vIN).y);
  rock = mix(rock, mix(vec3(0.30, 0.29, 0.21), vec3(0.06, 0.07, 0.04), inn(vIP * 9.0)), lich * 0.55);
  // moss and dark weathering where water stands in the joints
  rock = mix(rock, vec3(0.05, 0.075, 0.03) * (0.6 + 0.6 * smoothstep(0.2, 0.9, uGrow)), smoothstep(0.62, 0.85, inn(vIP * 4.5 + 3.0)) * smoothstep(0.3, 0.9, normalize(vIN).y) * 0.5);
  vec3 soil = mix(vec3(0.07, 0.055, 0.04), vec3(0.12, 0.095, 0.065), g1);
  vec3 moss = mix(vec3(0.10, 0.085, 0.04), vec3(0.055, 0.11, 0.028), smoothstep(0.1, 0.8, uGrow));
  float mossy = smoothstep(0.35, 0.75, inn(vIP * 1.6)) * smoothstep(0.4, 0.9, normalize(vIN).y);
  vec3 c = mix(soil, moss, mossy * 0.8);
  c = mix(c, rock, smoothstep(0.3, 0.6, vI.g));
  vec3 algae = vec3(0.04, 0.05, 0.03);
  c = mix(c, algae, vI.b * 0.75);
  // the scholar's rock (alpha 0): pitted grey limestone, dark in its hollows;
  // its plinth (alpha 0.5): dark granite carrying the inscription
  float taihu = 1.0 - smoothstep(0.2, 0.3, vI.a);
  float plinth = smoothstep(0.25, 0.35, vI.a) * (1.0 - smoothstep(0.65, 0.75, vI.a));
  if (taihu > 0.01) {
    vec3 lime = mix(vec3(0.075, 0.075, 0.072), vec3(0.18, 0.178, 0.168), g1) * (0.84 + 0.3 * inn(vIP * 9.0));   // dark grey, as in the site photograph
    lime *= 1.0 - 0.3 * smoothstep(0.55, 0.9, inn(vec3(vIP.x * 7.0, vIP.y * 0.7, vIP.z * 7.0)));
    lime = mix(lime, vec3(0.07, 0.075, 0.06), smoothstep(0.64, 0.86, inn(vIP * 3.1 + 5.0)) * 0.4);
    c = mix(c, lime, taihu);
  }
  if (plinth > 0.01) {
    vec3 gran = vec3(0.045, 0.045, 0.048) * (0.85 + 0.3 * inn(vIP * 40.0)) + vec3(0.06) * smoothstep(0.82, 0.95, inn(vIP * 90.0));
    if (uInscrOn > 0.5) {
      vec3 rel = vIP - uInscrC;
      vec2 st = vec2(dot(rel, uInscrT) / uInscrSize.x + 0.5, rel.y / uInscrSize.y + 0.5);
      float facing = dot(normalize(vIN), uInscrN);
      if (st.x > 0.0 && st.x < 1.0 && st.y > 0.0 && st.y < 1.0 && facing > 0.6) {
        float ink = texture2D(uInscr, vec2(st.x, st.y)).a;
        gran = mix(gran, vec3(0.42, 0.40, 0.36), ink * 0.85);     // cut, pale characters
      }
    }
    c = mix(c, gran, plinth);
  }
  diffuseColor.rgb = c;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    float hh = inn(vIP * 4.0) * 0.55 + inn(vIP * 13.0) * 0.3 + inn(vIP * 37.0) * 0.15;
    vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
    vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
    float det = dot(sx, r1);
    vec2 dh = vec2(dFdx(hh), dFdy(hh)) * mix(0.004, 0.022, smoothstep(0.3, 0.6, vI.g));
    normal = normalize(abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2));
  }`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(mix(0.92, 0.35, vI.b), 0.42, smoothstep(0.25, 0.35, vI.a) * (1.0 - smoothstep(0.65, 0.75, vI.a)));')
      .replace('#include <aomap_fragment>', `
  float iao = mix(0.3, 1.0, vI.r);
  reflectedLight.indirectDiffuse *= iao; reflectedLight.indirectSpecular *= iao;`);
  };
  mat.customProgramCacheKey = () => 'island3-' + (inscr ? 1 : 0);
  return mat;
}

// ------------------------------------------------------------------ water
const WATER_FRAG = /* glsl */`
uniform vec3 color;
uniform sampler2D tDiffuse;
uniform float uTimeW; uniform vec3 uHorizon; uniform vec3 uZenith; uniform vec3 uGlow; uniform vec3 uSun;
uniform float uHasRefl; uniform float uReflMist;
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
    // in mist the mirrored world is as veiled as the world itself: what is mirrored lies about as far
    // beyond the water as the water is from the eye (0 = clear air: V4's mirror exactly)
    float veil = uReflMist > 0.0 ? 1.0 - exp(-uReflMist * 2.0 * distance(cameraPosition, vWorld)) : 0.0;
    refl = mix(sky, r.rgb, 0.92 * (1.0 - veil));
  }
  // the water body: a shallow lagoon over pale sand round the islet, deep green-blue beyond
  float rr = length(p * vec2(1.0, 1.12)) + (wn(p * 0.35) - 0.5) * 2.4;
  float shallow = smoothstep(26.0, 10.0, rr);
  float caust = pow(wn(p * 2.2 + vec2(t * 0.3, -t * 0.2)) * wn(p * 3.1 - vec2(t * 0.25, t * 0.15)), 1.5);
  vec3 deep = vec3(0.010, 0.030, 0.036);
  vec3 lagoon = mix(vec3(0.07, 0.15, 0.13), vec3(0.20, 0.21, 0.15), smoothstep(14.0, 5.0, rr)) * (0.85 + 0.5 * caust);
  // seen from above, the light's path through shallow water is short: the sandy bed shows
  // through, pale turquoise over sand (only steep views; low views keep the dark mirror)
  float steep = smoothstep(0.45, 0.92, V.y);
  vec3 bed = mix(vec3(0.075, 0.20, 0.19), vec3(0.30, 0.30, 0.22), smoothstep(18.0, 7.0, rr)) * (0.8 + 0.6 * caust);
  lagoon = mix(lagoon, bed, steep);
  vec3 body = mix(deep, lagoon, mix(shallow, smoothstep(34.0, 12.0, rr), steep));
  vec3 c = mix(body, refl, clamp(fres * 1.1 + 0.06, 0.0, 1.0));
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
    uGlow: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uHasRefl: { value: reflect ? 1 : 0 }, uReflMist: { value: 0 }
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

// ------------------------------------------------------------------ motes
// Dust and pollen hanging in the air under and around the crown. They are
// invisible in flat light and catch the sun only when you look towards it.
export function createMotes(count = 600) {
  const rand = mulberry(4242);
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2, r = Math.pow(rand(), 0.7) * 13;
    pos[i * 3] = 0.6 + Math.cos(a) * r; pos[i * 3 + 1] = 0.3 + Math.pow(rand(), 1.4) * 9.5; pos[i * 3 + 2] = -0.2 + Math.sin(a) * r;
    seed[i] = rand();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTimeM: { value: 0 }, uSunM: { value: new THREE.Vector3(0, 1, 0) }, uSunColM: { value: new THREE.Color() }, uPx: { value: 1 } },
    vertexShader: /* glsl */`
      uniform float uTimeM; uniform vec3 uSunM; uniform float uPx;
      attribute float aSeed; varying float vA;
      void main(){
        vec3 p = position;
        float t = uTimeM * (0.08 + 0.06 * aSeed);
        p += vec3(sin(t * 3.1 + aSeed * 40.0), sin(t * 2.3 + aSeed * 17.0) * 0.6, cos(t * 2.7 + aSeed * 23.0)) * 0.6;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float d = -mv.z;
        vec3 v = normalize(p - cameraPosition);
        float fwd = pow(max(dot(v, uSunM), 0.0), 5.0);
        vA = fwd * smoothstep(0.6, 2.0, d) * (1.0 - smoothstep(9.0, 16.0, d)) * (0.4 + 0.6 * fract(aSeed * 7.3));
        gl_PointSize = (2.0 + 3.6 * fract(aSeed * 3.7)) * uPx * clamp(6.0 / d, 0.6, 3.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uSunColM; varying float vA;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.0, length(c)) * vA;
        if (a < 0.003) discard;
        gl_FragColor = vec4(uSunColM * a * 1.6, a);
      }`
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 5;
  pts.name = 'motes';
  return pts;
}
