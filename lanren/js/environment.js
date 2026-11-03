// The place around the tree: sky, light, paving, the No.1 Teaching Building,
// stones from the photograph, the planting bed and its ground cover.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
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
uniform vec3 uSun; uniform float uAlt; uniform float uTimeS; uniform float uCloud;
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGlow; uniform float uNight;
varying vec3 vDir;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + 3.1; a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  vec3 col = mix(uHorizon, uZenith, pow(h, 0.45));
  float cs = max(dot(d, uSun), 0.0);
  // forward scattering around the sun, broader near the horizon (humid air)
  col += uGlow * (pow(cs, 8.0) * 0.35 + pow(cs, 64.0) * 0.6) * (1.0 - uNight);
  // sun disc (kept modest; tone mapping does the rest)
  col += vec3(1.0, 0.92, 0.8) * smoothstep(0.99985, 0.99995, cs) * 18.0 * smoothstep(-0.02, 0.02, uAlt);
  // low cumulus typical of a humid island sky
  if (d.y > 0.0) {
    vec2 uv = d.xz / (d.y + 0.12) * 1.3 + vec2(uTimeS * 0.004, uTimeS * 0.0015);
    float c = fbm(uv * 1.4);
    float m = smoothstep(0.55 - uCloud * 0.25, 0.85, c) * smoothstep(0.0, 0.18, d.y);
    vec3 cl = mix(uHorizon * 1.15, vec3(1.0, 0.98, 0.95) * (0.35 + 0.65 * (1.0 - uNight)), 0.6);
    cl += uGlow * pow(cs, 4.0) * 0.6 * (1.0 - uNight);
    col = mix(col, cl, m * 0.75);
  }
  // below the horizon: ground haze
  col = mix(col, uHorizon * 0.55, smoothstep(0.0, -0.08, d.y));
  // night: a few stars, faint city glow to the north-west (Haikou)
  if (uNight > 0.0) {
    float st = step(0.9985, h21(floor(d.xz / (d.y + 0.3) * 260.0))) * smoothstep(0.1, 0.4, d.y);
    col += st * uNight * 0.35;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const sat = (x) => Math.max(0, Math.min(1, x));
function skyPalette(altDeg) {
  // linear-space colours keyed by solar altitude
  const keys = [
    [-18, [0.004, 0.006, 0.014], [0.010, 0.012, 0.022], [0.0, 0.0, 0.0]],
    [-6, [0.010, 0.016, 0.040], [0.070, 0.045, 0.055], [0.15, 0.05, 0.02]],
    [0, [0.050, 0.080, 0.180], [0.55, 0.30, 0.16], [1.2, 0.45, 0.12]],
    [8, [0.090, 0.180, 0.420], [0.70, 0.55, 0.40], [1.0, 0.55, 0.25]],
    [25, [0.080, 0.200, 0.520], [0.55, 0.62, 0.70], [0.6, 0.5, 0.35]],
    [60, [0.060, 0.180, 0.500], [0.50, 0.60, 0.72], [0.5, 0.45, 0.35]]
  ];
  let i = 0;
  while (i < keys.length - 2 && altDeg > keys[i + 1][0]) i++;
  const [a0, z0, h0, g0] = keys[i];
  const [a1, z1, h1, g1] = keys[i + 1];
  const t = sat((altDeg - a0) / (a1 - a0));
  return { zenith: lerp3(z0, z1, t), horizon: lerp3(h0, h1, t), glow: lerp3(g0, g1, t) };
}

export function createSky() {
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false,
    uniforms: {
      uSun: { value: new THREE.Vector3(0, 1, 0) }, uAlt: { value: 1 }, uTimeS: { value: 0 }, uCloud: { value: 0.5 },
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() },
      uNight: { value: 0 }
    }
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

export function skyState(altRad) {
  const deg = altRad * 180 / Math.PI;
  const pal = skyPalette(deg);
  const night = sat((-deg - 2) / 10);
  return { deg, ...pal, night };
}

// ------------------------------------------------------------------ bark
export function makeBarkMaterial(tex) {
  const mat = new THREE.MeshStandardMaterial({
    map: tex.barkColor, normalMap: tex.barkNormal, roughness: 0.93, metalness: 0,
    normalScale: new THREE.Vector2(1.1, 1.1), envMapIntensity: 0.7
  });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, UNIFORMS);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
${WIND_GLSL}
attribute vec4 color;
varying vec3 vBark; varying vec3 vWN; varying vec3 vWP;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  float te;
  transformed += windSway(position, color.g) + touchPush(position, te) * color.g * color.g;
  vBark = color.rgb;
  vWN = normal; vWP = position;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vBark; varying vec3 vWN; varying vec3 vWP;
float bh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
float bn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(bh(i), bh(i + vec3(1,0,0)), f.x), mix(bh(i + vec3(0,1,0)), bh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(bh(i + vec3(0,0,1)), bh(i + vec3(1,0,1)), f.x), mix(bh(i + vec3(0,1,1)), bh(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
  float youth = vBark.b;
  // young shoots: smooth grey-brown with a reddish cast
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.11, 0.08), smoothstep(0.3, 1.0, youth) * 0.7);
  // moss and lichen settle on the upper side of old horizontal limbs
  float up = normalize(vWN).y;
  float mossN = bn(vWP * 2.3) * 0.6 + bn(vWP * 7.0) * 0.4;
  float moss = smoothstep(0.35, 0.85, up) * (1.0 - youth) * smoothstep(0.45, 0.7, mossN);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.055, 0.075, 0.022), moss * 0.85);
  // the lowest metre is darker: splash, soil, many hands
  diffuseColor.rgb *= mix(0.72, 1.0, smoothstep(0.0, 1.4, vWP.y));`)
      .replace('#include <aomap_fragment>', `
  float bao = mix(0.25, 1.0, vBark.r);
  reflectedLight.indirectDiffuse *= bao;
  reflectedLight.indirectSpecular *= bao;`);
  };
  mat.customProgramCacheKey = () => 'bark';
  return mat;
}

export function makeBarkDepthMaterial() {
  const mat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, UNIFORMS);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
${WIND_GLSL}
attribute vec4 color;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  transformed += windSway(position, color.g);`);
  };
  mat.customProgramCacheKey = () => 'bark-depth';
  return mat;
}

// ------------------------------------------------------------------ stones
export function makeStoneMaterial() {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, color: 0xffffff, envMapIntensity: 0.6 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 color; varying vec4 vSt; varying vec3 vSP; varying vec3 vSN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vSt = color; vSP = (modelMatrix * vec4(position, 1.0)).xyz; vSN = normalize(mat3(modelMatrix) * normal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec4 vSt; varying vec3 vSP; varying vec3 vSN;
float sh1(vec3 p){ return fract(sin(dot(p, vec3(7.13, 157.1, 113.7))) * 43758.5453); }
float sn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(sh1(i), sh1(i + vec3(1,0,0)), f.x), mix(sh1(i + vec3(0,1,0)), sh1(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(sh1(i + vec3(0,0,1)), sh1(i + vec3(1,0,1)), f.x), mix(sh1(i + vec3(0,1,1)), sh1(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <color_fragment>', `
  float grain = sn(vSP * 9.0) * 0.5 + sn(vSP * 31.0) * 0.3 + sn(vSP * 2.2) * 0.2;
  vec3 stone;
  if (vSt.b > 0.75) {
    // weathered sandstone-limestone boulders, beige with darker streaks
    stone = mix(vec3(0.15, 0.13, 0.095), vec3(0.23, 0.20, 0.15), vSt.g);
    stone *= 0.78 + 0.32 * grain;
    stone = mix(stone, vec3(0.10, 0.12, 0.06), smoothstep(0.55, 0.95, vSN.y) * smoothstep(0.5, 0.7, sn(vSP * 3.0)) * 0.6);
    stone *= mix(0.65, 1.0, smoothstep(0.0, 0.5, vSP.y));
  } else {
    // granite kerb and dark soil inside the bed
    float soil = step(0.17, vSP.y) * step(length(vSP.xz - vec2(-0.3, 0.05)), 2.12);
    stone = mix(vec3(0.20, 0.195, 0.18) * (0.85 + 0.3 * grain), vec3(0.06, 0.045, 0.03) * (0.8 + 0.4 * grain), soil);
  }
  diffuseColor.rgb = stone;`)
      .replace('#include <aomap_fragment>', `
  float sao = mix(0.35, 1.0, vSt.r);
  reflectedLight.indirectDiffuse *= sao; reflectedLight.indirectSpecular *= sao;`);
  };
  mat.customProgramCacheKey = () => 'stone';
  return mat;
}

// ------------------------------------------------------------------ ground
// footprints of the Blender stones and the raised bed (scene frame): x, z, rx, rz
export const STONES = [[8.9, -2.25, 0.98, 0.76], [7.75, -2.95, 0.8, 0.68], [5.2, -2.15, 0.97, 0.57],
  [-2.35, -1.2, 0.64, 0.5], [1.55, 1.45, 0.57, 0.52], [-0.3, 0.05, 2.78, 2.48]];
export function createGround(tex, maxAniso) {
  const group = new THREE.Group();
  for (const t of [tex.pavingColor, tex.pavingNormal]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(900 / 2.4, 450 / 2.4);
    t.anisotropy = maxAniso;
  }
  const mat = new THREE.MeshStandardMaterial({
    map: tex.pavingColor, normalMap: tex.pavingNormal, roughness: 0.82, metalness: 0,
    normalScale: new THREE.Vector2(0.8, 0.8), envMapIntensity: 0.5
  });
  // shade and dust under the canopy, a cleaner path towards the building door
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.uniforms.uStones = { value: STONES.map(([x, z, rx, rz]) => new THREE.Vector4(x, z, rx, rz)) };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGP;\nuniform vec4 uStones[6];')
      .replace('#include <map_fragment>', `#include <map_fragment>
  float under = smoothstep(14.0, 4.0, length((vGP.xz - vec2(4.0, 0.0)) * vec2(0.8, 1.2)));
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.86, 0.84, 0.80), under);
  // contact occlusion where boulders and the raised bed meet the paving
  float cao = 1.0;
  for (int i = 0; i < 6; i++) {
    vec4 st = uStones[i];
    float d = length((vGP.xz - st.xy) / st.zw);
    cao *= 1.0 - 0.6 * exp(-pow(max(d - 0.92, 0.0) * 3.2, 1.4)) * step(0.85, d);
  }
  diffuseColor.rgb *= cao;`)
      .replace('#include <aomap_fragment>', `reflectedLight.indirectDiffuse *= cao;`);
  };
  // terrace (y = 0) and the lower forecourt towards the North Gate (y = -0.6)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 450), mat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -10.3 + 225);
  ground.receiveShadow = true;
  ground.name = 'ground';
  group.add(ground);
  const lower = new THREE.Mesh(new THREE.PlaneGeometry(900, 450), mat);
  lower.rotation.x = -Math.PI / 2;
  lower.position.set(0, -0.6, -11.7 - 225);
  lower.receiveShadow = true;
  group.add(lower);

  // the forecourt drops by four steps towards the North Gate (cf. photograph)
  const stepMat = new THREE.MeshStandardMaterial({ color: 0x8d877c, roughness: 0.78, envMapIntensity: 0.5 });
  const geos = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.BoxGeometry(26, 0.15, 0.36);
    g.translate(4, -0.075 - i * 0.15, -10.4 - i * 0.36);
    geos.push(g);
  }
  // either side of the steps the terrace ends in a low retaining edge
  for (const [x0, x1] of [[-140, -9], [17, 140]]) {
    const kerb = new THREE.BoxGeometry(x1 - x0, 0.62, 1.4);
    kerb.translate((x0 + x1) / 2, -0.29, -11.0);
    geos.push(kerb);
  }
  const steps = new THREE.Mesh(mergeGeometries(geos), stepMat);
  steps.receiveShadow = true;
  steps.castShadow = true;
  group.add(steps);
  return { group, ground };
}

// ------------------------------------------------------------------ building
// No.1 Teaching Building: 5 storeys × 3.8 m (project data), 116 m long; the
// tree stands ~11 m in front of the facade. Bay rhythm, the stone-clad
// ground floor and brown frames follow the photograph; dimensions are approximate.
export function createBuilding() {
  const group = new THREE.Group();
  const F = 11.2;                 // facade plane (z)
  const X0 = -92.9, X1 = 23.1;    // from the campus model
  const H = 19.2;
  const bay = 3.6;
  const wall = new THREE.MeshStandardMaterial({ color: 0xcfcbbf, roughness: 0.88, envMapIntensity: 0.5 });
  // tropical rain leaves streaks under sills and a darker splash zone at the base
  wall.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWP;
float wh(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float wn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wh(i), wh(i + vec2(1, 0)), f.x), mix(wh(i + vec2(0, 1)), wh(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  float streak = wn(vec2(vWP.x * 2.3, vWP.y * 0.18)) * wn(vec2(vWP.x * 0.7 + 3.0, vWP.y * 0.05));
  float sill = smoothstep(1.4, 0.0, mod(vWP.y - 4.2 + 0.9, 3.75));
  diffuseColor.rgb *= 1.0 - 0.16 * smoothstep(0.25, 0.75, streak) * (0.4 + 0.6 * sill);
  diffuseColor.rgb *= 1.0 - 0.22 * smoothstep(1.8, 0.0, vWP.y);
  diffuseColor.rgb *= 0.94 + 0.08 * wn(vWP.xy * 0.35);`);
  };
  const stone = new THREE.MeshStandardMaterial({ color: 0x77736a, roughness: 0.72, envMapIntensity: 0.6 });
  const frame = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2c2a, roughness: 0.9 });

  const wallG = [], stoneG = [], frameG = [], darkG = [];
  const box = (arr, w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); arr.push(g); };
  // main mass, set back behind the window plane
  box(wallG, X1 - X0, H, 26, (X0 + X1) / 2, H / 2, F + 13.6);   // face at F + 0.6
  box(wallG, X1 - X0 + 0.6, 0.7, 0.6, (X0 + X1) / 2, H + 0.1, F - 0.1); // parapet
  box(stoneG, X1 - X0, 0.9, 1.0, (X0 + X1) / 2, 0.45, F + 0.1);        // stone plinth
  const windows = [];
  for (let x = X0 + bay / 2; x < X1; x += bay) {
    // pilasters
    box(wallG, 0.5, H - 4.2, 1.0, x - bay / 2, 4.2 + (H - 4.2) / 2, F + 0.1);
    box(stoneG, 0.62, 4.2, 1.05, x - bay / 2, 2.1, F + 0.08);          // stone-clad piers below
    for (let f = 1; f < 5; f++) {
      const y = 4.2 + (f - 1) * 3.75 + 1.95;
      windows.push([x, y, 2.3, 1.85, 0]);
      box(wallG, bay - 0.5, 0.24, 0.8, x, y - 1.15, F + 0.2);           // sill band
    }
    // ground floor openings with warm brown frames
    windows.push([x, 2.0, 2.7, 2.3, 1]);
    box(frameG, 2.8, 0.1, 0.12, x, 3.2, F + 0.5);
    box(frameG, 2.8, 0.1, 0.12, x, 0.85, F + 0.5);
    box(frameG, 0.08, 2.4, 0.12, x, 2.02, F + 0.5);
    box(frameG, 0.08, 2.4, 0.12, x - 1.38, 2.02, F + 0.5);
    box(frameG, 0.08, 2.4, 0.12, x + 1.38, 2.02, F + 0.5);
    box(stoneG, bay - 0.5, 0.5, 0.9, x, 4.0, F + 0.15);                 // lintel band
  }
  // two projecting stair bays (seen in the photograph left of the tree)
  for (const cx of [-14.0, -52.0]) {
    box(wallG, 7.2, H + 1.2, 2.6, cx, (H + 1.2) / 2, F - 1.1);
    box(stoneG, 7.4, 4.4, 2.8, cx, 2.2, F - 1.1);
    box(darkG, 2.6, 3.0, 0.2, cx + 0.0, 1.5, F - 2.45);
  }
  const add = (arr, m, cast = true) => {
    const mesh = new THREE.Mesh(mergeGeometries(arr), m);
    mesh.castShadow = cast; mesh.receiveShadow = true; group.add(mesh); return mesh;
  };
  add(wallG, wall); add(stoneG, stone); add(frameG, frame, false); add(darkG, dark, false);

  // glass: one instanced pane per window; night windows light up for evening study
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1b2626, roughness: 0.06, metalness: 0.0, envMapIntensity: 1.3 });
  const night = { value: 0 };
  glassMat.onBeforeCompile = (sh) => {
    sh.uniforms.uNightLit = night;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aLit; varying float vLit;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLit = aLit;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNightLit; varying float vLit;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += vec3(1.0, 0.78, 0.5) * 0.95 * vLit * uNightLit;`);
  };
  const paneGeo = new THREE.PlaneGeometry(1, 1);
  paneGeo.rotateY(Math.PI);
  const panes = new THREE.InstancedMesh(paneGeo, glassMat, windows.length);
  const lit = new Float32Array(windows.length);
  const rand = mulberry(5);
  const m = new THREE.Matrix4();
  windows.forEach(([x, y, w, h, g], i) => {
    m.compose(new THREE.Vector3(x, y, F + 0.57), new THREE.Quaternion(), new THREE.Vector3(w, h, 1));
    panes.setMatrixAt(i, m);
    lit[i] = rand() < (g ? 0.35 : 0.82) ? 0.6 + rand() * 0.4 : 0;
  });
  paneGeo.setAttribute('aLit', new THREE.InstancedBufferAttribute(lit, 1));
  panes.receiveShadow = true;
  group.add(panes);
  // window reveals (dark inner frame) so openings read as depth, not decals
  const revG = [];
  windows.forEach(([x, y, w, h]) => {
    box(revG, w + 0.16, 0.07, 0.1, x, y + h / 2 + 0.035, F + 0.53);
    box(revG, w + 0.16, 0.07, 0.1, x, y - h / 2 - 0.035, F + 0.53);
    box(revG, 0.07, h, 0.1, x - w / 2 - 0.035, y, F + 0.53);
    box(revG, 0.07, h, 0.1, x + w / 2 + 0.035, y, F + 0.53);
    box(revG, 0.05, h, 0.06, x, y, F + 0.55);                            // mullion
  });
  add(revG, new THREE.MeshStandardMaterial({ color: 0x6f7470, roughness: 0.5, metalness: 0.3 }), false);
  return { group, night, facadeZ: F };
}

// ------------------------------------------------------------------ low planting
// Hedge along the building and ground cover in the bed: small instanced leaves.
export function createPlanting(atlas, density = 1) {
  const rand = mulberry(77);
  const mats = [];
  const tint = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const addLeaf = (x, y, z, s, t) => {
    if (rand() > density) return;
    e.set((rand() - 0.5) * 1.6, rand() * Math.PI * 2, (rand() - 0.5) * 1.2);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s));
    mats.push(...m.elements);
    tint.push(t + (rand() - 0.5) * 0.2, rand());
  };
  // hedge: rounded mass along the building, ~0.9 m tall
  for (let i = 0; i < 4200; i++) {
    const x = -46 + rand() * 66;
    const u = rand() * Math.PI;
    const r = Math.sqrt(rand());
    const y = 0.15 + Math.sin(u) * 0.75 * r + rand() * 0.1;
    const z = 9.9 + Math.cos(u) * 0.7 * r;
    addLeaf(x, y, z, 0.07 + rand() * 0.04, 0.8);
  }
  // fern-like ground cover inside the bed and around the boulders
  const beds = [[-0.3, 0.05, 2.0, 1500], [8.4, -2.4, 1.6, 600], [5.0, -2.2, 1.0, 250]];
  for (const [cx, cz, rad, n] of beds) {
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * rad;
      const x = cx + Math.cos(a) * r * 1.1, z = cz + Math.sin(a) * r;
      if (Math.hypot(x + 0.3, z - 0.05) < 1.0) continue;   // trunk
      const y = (cx === -0.3 ? 0.2 : 0.02) + rand() * 0.35 * (1 - r / rad);
      addLeaf(x, y, z, 0.09 + rand() * 0.06, 0.2);
    }
  }
  const n = mats.length / 16;
  const geo = new THREE.PlaneGeometry(0.6, 1);
  geo.translate(0, 0.5, 0);
  geo.rotateX(-Math.PI / 2 + 0.3);
  geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(tint), 2));
  const mat = new THREE.MeshStandardMaterial({ map: atlas, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aTint; varying vec2 vTint;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvTint = aTint;\nvMapUv.x = (floor(aTint.y * 4.0) + vMapUv.x) * 0.25;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vTint;')
      .replace('#include <map_fragment>', `vec4 lt = texture2D(map, vMapUv);
  vec3 g0 = vec3(0.05, 0.12, 0.02), g1 = vec3(0.16, 0.26, 0.03);
  diffuseColor.rgb = mix(g0, g1, clamp(vTint.x, 0.0, 1.0)) * lt.r * 1.4;
  diffuseColor.a = lt.a;`);
  };
  mat.customProgramCacheKey = () => 'planting';
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.instanceMatrix.array.set(mats);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.frustumCulled = false;
  return mesh;
}
