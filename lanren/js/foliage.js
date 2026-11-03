// Leaves: one instance per leaf, generated from the Blender rosettes.
// Each leaf carries its own turn order, variant and occlusion, so the year,
// the wind and a viewer's hand act on individual leaves — not on cards.
import * as THREE from 'three';

export const WIND_GLSL = /* glsl */`
uniform float uTime;
uniform float uWind;      // 0 calm … 1 strong breeze
uniform float uGust;      // slowly varying 0..1
uniform vec3  uWindDir;
uniform vec4  uTouchO[4]; // ray origin, start time
uniform vec4  uTouchD[4]; // ray direction, strength
vec3 windSway(vec3 p, float flex){
  float ph = dot(p, vec3(0.31, 0.17, 0.23));
  float g = uWind * (0.45 + 0.55 * uGust);
  float t = uTime;
  float w = sin(t * 0.83 + ph) * 0.55 + sin(t * 1.71 + ph * 1.37) * 0.28 + sin(t * 0.29 + ph * 0.6) * 0.35;
  vec3 d = uWindDir * (g * 0.55 + w * g * 0.45);
  d.y += sin(t * 2.1 + ph * 2.0) * 0.12 * g;
  d += cross(uWindDir, vec3(0.0, 1.0, 0.0)) * sin(t * 1.13 + ph * 0.8) * 0.18 * g;
  return d * flex * flex * 0.42;
}
vec3 touchPush(vec3 p, out float energy){
  vec3 acc = vec3(0.0);
  energy = 0.0;
  for (int i = 0; i < 4; i++) {
    float dt = uTime - uTouchO[i].w;
    if (dt < 0.0 || dt > 5.0) continue;
    vec3 v = p - uTouchO[i].xyz;
    vec3 dir = uTouchD[i].xyz;
    vec3 perp = v - dir * dot(v, dir);
    float d2 = dot(perp, perp);
    float k = uTouchD[i].w * exp(-d2 / 0.55);
    float osc = exp(-dt * 1.9) * sin(dt * 8.5);
    acc += normalize(perp + vec3(1e-4)) * k * osc * 0.16 + vec3(0.0, -0.05, 0.0) * k * exp(-dt * 3.0);
    energy += k * exp(-dt * 1.5);
  }
  return acc;
}
`;

// colour of a leaf from its age and the texture's senescence order (linear RGB)
export const LEAF_COLOUR_GLSL = /* glsl */`
vec3 leafColour(float age, float sen, float young, float variant){
  vec3 green  = mix(vec3(0.042, 0.092, 0.024), vec3(0.062, 0.118, 0.030), variant);
  vec3 yellow = vec3(0.60, 0.40, 0.045);
  vec3 red    = vec3(0.42, 0.035, 0.018);
  vec3 brown  = vec3(0.17, 0.075, 0.03);
  float a = age * 1.35;
  float k1 = smoothstep(sen, sen + 0.16, a);
  float k2 = smoothstep(sen + 0.30, sen + 0.46, a);
  float k3 = smoothstep(sen + 0.95, sen + 1.2, a);
  vec3 c = mix(green, yellow, k1);
  c = mix(c, red, k2);
  c = mix(c, brown, k3);
  return mix(c, vec3(0.30, 0.42, 0.07), young);
}
`;

// Build one leaf blade: a quad folded along the midrib and arched to the tip.
export function leafGeometry(cols = 2, rows = 4, aspect = 0.62) {
  const pos = [], uv = [], idx = [];
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    for (let c = 0; c <= cols; c++) {
      const s = c / cols * 2 - 1;           // -1..1 across
      const x = t;                           // along the blade (length 1)
      const z = s * aspect * 0.5;
      const fold = Math.abs(s) * aspect * 0.5 * 0.16;
      const arch = -0.10 * t * t + 0.05 * t;
      pos.push(x, fold + arch, z);
      uv.push((s + 1) / 2, t);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c, b = a + 1, d = a + cols + 1, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// deterministic random
export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Expand rosettes into leaves.
 * rosettes: Float32Array stride 12 (see lanren/assets/tree.json)
 * density: 0..1 fraction of leaves kept (quality tiers); lost area is
 * compensated by slightly larger blades so the canopy keeps its weight.
 */
export function buildLeafInstances(rosettes, stride, density = 1) {
  const n = rosettes.length / stride;
  const rand = mulberry(20231030);
  const mats = [], ros = [], leaf = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  const side = new THREE.Vector3();
  const blade = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const scaleComp = 1 / Math.pow(Math.max(0.35, density), 0.25);
  for (let i = 0; i < n; i++) {
    const o = i * stride;
    const px = rosettes[o], py = rosettes[o + 1], pz = rosettes[o + 2];
    dir.set(rosettes[o + 3], rosettes[o + 4], rosettes[o + 5]).normalize();
    const size = rosettes[o + 6], flex = rosettes[o + 7], occ = rosettes[o + 8];
    const count = Math.round((6 + rand() * 5) * size);
    const shootH = new THREE.Vector3(dir.x, 0, dir.z);
    if (shootH.lengthSq() < 1e-4) shootH.set(1, 0, 0);
    shootH.normalize();
    const rot0 = rand() * Math.PI * 2;
    for (let k = 0; k < count; k++) {
      if (rand() > density) continue;
      // spiral phyllotaxis around the shoot tip; outer leaves are older & flatter
      const ang = rot0 + k * 2.39996;
      const outer = 1 - k / count;                  // first leaves = outermost
      const elev = THREE.MathUtils.lerp(0.55, -0.12, outer) + (rand() - 0.5) * 0.35;
      blade.set(Math.cos(ang), 0, Math.sin(ang));
      // lean the rosette along the shoot so it opens like a hand
      blade.addScaledVector(shootH, 0.55).normalize();
      blade.y = Math.sin(elev);
      blade.normalize();
      side.crossVectors(up, blade).normalize();
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
      nrm.crossVectors(blade, side).normalize();
      // small roll so blades are not perfectly flat
      const roll = (rand() - 0.5) * 0.7;
      const cr = Math.cos(roll), sr = Math.sin(roll);
      const s2 = side.clone().multiplyScalar(cr).addScaledVector(nrm, sr);
      const n2 = new THREE.Vector3().crossVectors(blade, s2).normalize();
      // geometry axes: x = blade, y = normal, z = side
      basis.makeBasis(blade, n2, s2.multiplyScalar(-1));
      const len = (0.15 + rand() * 0.10) * (0.72 + 0.28 * outer) * scaleComp * 1.12;
      q.setFromRotationMatrix(basis);
      const off = 0.03 + rand() * 0.03;
      m.compose(new THREE.Vector3(px + blade.x * off, py + blade.y * off * 0.5, pz + blade.z * off), q,
        new THREE.Vector3(len, len, len));
      mats.push(...m.elements);
      ros.push(px, py, pz, flex);
      // r1: turn order (outer/old leaves and shaded crowns first), r2: flush/summer order
      const r1 = Math.min(1, Math.max(0, rand() * 0.8 + (1 - outer) * 0.2));
      leaf.push(r1, rand(), Math.floor(rand() * 4), occ);
    }
  }
  return {
    count: ros.length / 4,
    matrices: new Float32Array(mats),
    rosette: new Float32Array(ros),
    leaf: new Float32Array(leaf)
  };
}

function sharedUniforms() {
  return {
    uTime: { value: 0 }, uWind: { value: 0.35 }, uGust: { value: 0.5 },
    uWindDir: { value: new THREE.Vector3(0.8, 0, -0.6).normalize() },
    uTouchO: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, -99, 0, -99)) },
    uTouchD: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 1, 0, 0)) },
    uTurn: { value: 0 }, uFlush: { value: 1 }, uSummer: { value: 0 },
    uTransmit: { value: 1.0 }
  };
}
export const UNIFORMS = sharedUniforms();

// The seasonal state of one leaf — identical in the shader and on the CPU
export const SEASON_GLSL = /* glsl */`
uniform float uTurn;
uniform float uFlush;
uniform float uSummer;
void leafSeason(float r1, float r2, out float age, out float scl, out float young){
  float oldAge = clamp((uTurn - r1 * 0.85) * 2.2, 0.0, 1.3);
  float sp = r2 > 0.86 ? clamp(uSummer - r1 * 0.3, 0.0, 2.0) : 0.0;
  age = max(oldAge, min(sp, 1.0));
  scl = 1.0; young = 0.0;
  if (oldAge >= 1.0) {
    float g = smoothstep(r2 * 0.35, r2 * 0.35 + 0.5, uFlush);
    scl = g; young = 1.0 - smoothstep(0.55, 1.0, uFlush); age = 0.0;
  } else if (sp >= 1.0) {
    float f = clamp((sp - 1.0) * 1.1, 0.0, 1.0);
    scl = smoothstep(0.1, 0.6, f); young = 1.0 - smoothstep(0.6, 1.0, f); age = 0.0;
  }
}
`;

export function leafSeasonCPU(r1, r2, turn, flush, summer) {
  const cl = (x, a, b) => Math.min(b, Math.max(a, x));
  const ss = (a, b, x) => { const t = cl((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const oldAge = cl((turn - r1 * 0.85) * 2.2, 0, 1.3);
  const sp = r2 > 0.86 ? cl(summer - r1 * 0.3, 0, 2) : 0;
  let age = Math.max(oldAge, Math.min(sp, 1)), scl = 1, young = 0;
  if (oldAge >= 1) {
    scl = ss(r2 * 0.35, r2 * 0.35 + 0.5, flush); young = 1 - ss(0.55, 1, flush); age = 0;
  } else if (sp >= 1) {
    const f = cl((sp - 1) * 1.1, 0, 1);
    scl = ss(0.1, 0.6, f); young = 1 - ss(0.6, 1, f); age = 0;
  }
  return { age, scl, young };
}

/** Patch a MeshStandardMaterial (or depth material) into a leaf material. */
export function makeLeafMaterial({ atlas, normal, depth = false, loose = false }) {
  const mat = depth
    ? new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: atlas, alphaTest: 0.5 })
    : new THREE.MeshStandardMaterial({
      map: atlas, normalMap: normal, side: THREE.DoubleSide, alphaTest: 0.5,
      roughness: 0.52, metalness: 0, envMapIntensity: 0.6
    });
  if (!depth) mat.normalScale = new THREE.Vector2(0.6, 0.6);
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, UNIFORMS);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
${WIND_GLSL}
${SEASON_GLSL}
${loose ? 'attribute vec4 aLoose;' : 'attribute vec4 aRosette;\nattribute vec4 aLeaf;'}
varying float vAge; varying float vYoung; varying float vVar; varying float vOcc; varying float vAir;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
${loose
    ? 'float variant = aLoose.y; float age = aLoose.x; float scl = 1.0; float young = 0.0;'
    : 'float variant = aLeaf.z; float age, scl, young; leafSeason(aLeaf.x, aLeaf.y, age, scl, young);'}
#ifdef USE_MAP
  vMapUv.x = (variant + vMapUv.x) * 0.25;
#endif
vAge = age; vYoung = young; vVar = fract(variant * 0.37 + ${loose ? 'aLoose.z' : 'aLeaf.y'});
vOcc = ${loose ? '0.0' : 'aLeaf.w'};
vAir = ${loose ? 'aLoose.w' : '1.0'};`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
${loose ? '' : `
  transformed *= scl;
  float touchE;
  vec3 rp = aRosette.xyz;
  vec3 disp = windSway(rp, aRosette.w) + touchPush(rp, touchE);
  // leaf flutter about the petiole, stronger in gusts and when touched
  float fl = sin(uTime * (5.5 + aLeaf.y * 3.0) + aLeaf.x * 40.0) * (0.06 + 0.2 * uWind * uGust + 0.6 * touchE);
  transformed.y += fl * transformed.x;
  // move the whole leaf in world space: convert to instance space
  #ifdef USE_INSTANCING
    mat3 lim = mat3(instanceMatrix);
    float s2 = dot(lim[0], lim[0]);
    transformed += transpose(lim) * disp / s2;
  #endif`}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
${LEAF_COLOUR_GLSL}
uniform float uTransmit;
varying float vAge; varying float vYoung; varying float vVar; varying float vOcc; varying float vAir;`)
      .replace('#include <map_fragment>', `
  vec4 lt = texture2D(map, vMapUv);
  ${depth ? '' : `
  vec3 lc = leafColour(vAge, lt.b, vYoung, vVar);
  // leaves lying on the paving dry out: duller, browner, darker
  lc = mix(lc, mix(lc, vec3(0.13, 0.06, 0.03), 0.45) * 0.8, 1.0 - vAir);
  // every blade a little different: age, exposure, thickness
  float lum = lt.r * 1.38 * (0.82 + 0.36 * fract(vVar * 7.31));
  vec3 base = lc * lum + lt.g * 0.012 * (1.0 - vAge);
  // the underside is paler and matte
  if (!gl_FrontFacing) base = mix(base, base * vec3(1.45, 1.55, 1.25) + 0.008, 0.6);
  diffuseColor.rgb = base;`}
  // sharpen alpha by its screen derivative so distant leaves stay solid
  float la = (lt.a - 0.5) / max(fwidth(lt.a), 1e-4) + 0.5;
  diffuseColor.a = clamp(la, 0.0, 1.0);`)
      .replace('#include <alphatest_fragment>', 'if (diffuseColor.a < 0.5) discard;');
    if (!depth) {
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <roughnessmap_fragment>', `float roughnessFactor = gl_FrontFacing ? mix(0.36, 0.7, vAge) : 0.8;`)
        .replace('#include <lights_fragment_begin>', `vec3 leafTransmit = vec3(0.0);
#include <lights_fragment_begin>`)
        .replace('#include <aomap_fragment>', `
  // sky light blocked by the canopy above this rosette
  reflectedLight.indirectDiffuse *= mix(1.0, 0.5, vOcc);
  reflectedLight.indirectSpecular *= mix(1.0, 0.6, vOcc);`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  // light through the blade: back-lit leaves glow with their own colour
  vec3 tint = diffuseColor.rgb * vec3(2.1, 2.2, 1.1) + vec3(0.012, 0.016, 0.0);
  reflectedLight.directDiffuse += leafTransmit * tint * 0.42 * uTransmit * vAir;
  // diffuse sky light through the blade (why a shaded canopy still glows from below)
  #if defined( USE_ENVMAP ) && defined( STANDARD )
    reflectedLight.indirectDiffuse += getIBLIrradiance(-geometryNormal) * envMapIntensity * tint * 0.16 * (1.0 - 0.6 * vOcc) * vAir;
  #endif`);
      // accumulate shadowed sun light hitting the far side of the blade
      sh.fragmentShader = sh.fragmentShader.replace(
        /RE_Direct\( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight \);/g,
        'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n\t\tleafTransmit += directLight.color * saturate( dot( -geometryNormal, directLight.direction ) );');
    }
  };
  mat.customProgramCacheKey = () => `leaf-${depth}-${loose}`;
  return mat;
}

export function createCanopy(rosettes, stride, atlas, normal, density) {
  const data = buildLeafInstances(rosettes, stride, density);
  const geo = leafGeometry(density < 0.7 ? 1 : 2, density < 0.7 ? 2 : 4);
  geo.setAttribute('aRosette', new THREE.InstancedBufferAttribute(data.rosette, 4));
  geo.setAttribute('aLeaf', new THREE.InstancedBufferAttribute(data.leaf, 4));
  const mat = makeLeafMaterial({ atlas, normal });
  const mesh = new THREE.InstancedMesh(geo, mat, data.count);
  mesh.instanceMatrix.array.set(data.matrices);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.customDepthMaterial = makeLeafMaterial({ atlas, depth: true });
  mesh.frustumCulled = false;
  mesh.name = 'canopy';
  return { mesh, data };
}

// Loose leaves: falling, and lying on the paving.
export function createLooseLeaves(capacity, atlas, normal) {
  const geo = leafGeometry(2, 3);
  const loose = new Float32Array(capacity * 4);
  const attr = new THREE.InstancedBufferAttribute(loose, 4);
  attr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aLoose', attr);
  const mat = makeLeafMaterial({ atlas, normal, loose: true });
  const mesh = new THREE.InstancedMesh(geo, mat, capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.customDepthMaterial = makeLeafMaterial({ atlas, depth: true, loose: true });
  mesh.frustumCulled = false;
  return { mesh, attr, loose };
}
