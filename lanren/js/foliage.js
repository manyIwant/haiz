// Leaves of a growing tree: one instance per leaf, generated from the
// Blender rosettes. Every leaf has its own emergence time; the scroll-driven
// growth uniform (uGrow) moves each one through bud → unfolding → mature.
// Last year's red leaves hang on until the flush begins, then let go.
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
    float k = uTouchD[i].w * exp(-dot(perp, perp) / 0.55);
    float osc = exp(-dt * 1.9) * sin(dt * 8.5);
    acc += normalize(perp + vec3(1e-4)) * k * osc * 0.16 + vec3(0.0, -0.05, 0.0) * k * exp(-dt * 3.0);
    energy += k * exp(-dt * 1.5);
  }
  return acc;
}
`;

// colour of a leaf (linear RGB) from senescence age, the texture's
// senescence order, youth (0 mature … 1 just unfolded) and a per-leaf shade
export const LEAF_COLOUR_GLSL = /* glsl */`
vec3 leafColour(float age, float sen, float young, float variant){
  vec3 green  = mix(vec3(0.040, 0.088, 0.022), vec3(0.058, 0.112, 0.028), variant);
  vec3 yellow = vec3(0.60, 0.40, 0.045);
  vec3 red    = vec3(0.42, 0.035, 0.018);
  vec3 brown  = vec3(0.17, 0.075, 0.03);
  float a = age * 1.35;
  vec3 c = mix(green, yellow, smoothstep(sen, sen + 0.16, a));
  c = mix(c, red, smoothstep(sen + 0.30, sen + 0.46, a));
  c = mix(c, brown, smoothstep(sen + 0.95, sen + 1.2, a));
  // Terminalia's new flush: bronze-red buds, then a bright yellow-green
  vec3 fresh = mix(vec3(0.16, 0.33, 0.045), vec3(0.30, 0.11, 0.05), smoothstep(0.72, 0.98, young));
  return mix(c, fresh, smoothstep(0.0, 0.45, young));
}
`;

// Growth of one leaf. Shared by colour and depth materials (and mirrored on the CPU).
export const GROW_GLSL = /* glsl */`
uniform float uGrow;
// returns unfold progress u (0 bud … 1 open), scale, youth, fold, erect
void leafGrow(float tE, float old, out float u, out float scl, out float young, out float fold, out float erect, out float age){
  // young carries maturity (0..1 → 1 = just out); bud colour is folded into u
  age = 0.0;
  if (old > 0.0) {                       // last year's leaf
    u = 1.0; young = 0.0; fold = 0.0; erect = 0.0;
    scl = uGrow < old ? 1.0 : 0.0;
    age = 0.82 + fract(old * 37.0) * 0.3;
    return;
  }
  float t = 0.04 + (tE - 0.04) * 0.75;  // compress the flush into the scroll
  u = clamp((uGrow - t + 0.05) / 0.24, 0.0, 1.0);
  float m = clamp((uGrow - t - 0.14) / 0.24, 0.0, 1.0);
  scl = u <= 0.0 ? 0.0 : mix(0.05, 1.0, smoothstep(0.0, 0.85, u));
  fold = (1.0 - smoothstep(0.15, 0.85, u)) * 1.35;
  erect = (1.0 - smoothstep(0.2, 0.95, u)) * 1.15;
  // bronze only while the bud opens; then a bright fresh green that darkens with maturity
  young = (1.0 - m) * 0.6 + (1.0 - smoothstep(0.2, 0.6, u)) * 0.4;
}
`;

// Build one leaf blade: a quad folded along the midrib and arched to the tip.
export function leafGeometry(cols = 2, rows = 4, aspect = 0.62) {
  const pos = [], uv = [], idx = [];
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    for (let c = 0; c <= cols; c++) {
      const s = c / cols * 2 - 1;
      pos.push(t, Math.abs(s) * aspect * 0.5 * 0.16 - 0.10 * t * t + 0.05 * t, s * aspect * 0.5);
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
 * Expand rosettes (stride 12: pos3 dir3 size flex occ tEmerge tOldDrop rand)
 * into leaves. Rosettes holding last year's leaves get a few extra, old ones.
 */
export function buildLeafInstances(ros, stride, density = 1) {
  const n = ros.length / stride;
  const rand = mulberry(20231030);
  const mats = [], rosA = [], leafA = [], padA = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), blade = new THREE.Vector3();
  const side = new THREE.Vector3(), nrm = new THREE.Vector3(), basis = new THREE.Matrix4();
  const scaleComp = 1 / Math.pow(Math.max(0.35, density), 0.25);
  let pcx = 0, pcy = 0, pcz = 0;
  const push = (px, py, pz, ang, outer, shootH, flex, tE, old, occ, lenK) => {
    const elev = THREE.MathUtils.lerp(0.55, -0.12, outer) + (rand() - 0.5) * 0.35;
    blade.set(Math.cos(ang), 0, Math.sin(ang)).addScaledVector(shootH, 0.55).normalize();
    blade.y = Math.sin(elev);
    blade.normalize();
    side.crossVectors(up, blade).normalize();
    nrm.crossVectors(blade, side).normalize();
    const roll = (rand() - 0.5) * 0.7;
    const s2 = side.clone().multiplyScalar(Math.cos(roll)).addScaledVector(nrm, Math.sin(roll));
    const n2 = new THREE.Vector3().crossVectors(blade, s2).normalize();
    basis.makeBasis(blade, n2, s2.multiplyScalar(-1));
    q.setFromRotationMatrix(basis);
    const len = (0.15 + rand() * 0.10) * (0.72 + 0.28 * outer) * scaleComp * 1.1 * lenK;
    const off = 0.03 + rand() * 0.03;
    m.compose(new THREE.Vector3(px + blade.x * off, py + blade.y * off * 0.5, pz + blade.z * off), q, new THREE.Vector3(len, len, len));
    mats.push(...m.elements);
    rosA.push(px, py, pz, flex);
    padA.push(pcx, pcy, pcz);
    // tE jittered per leaf: inner leaves of a rosette open a little later
    leafA.push(tE + (1 - outer) * 0.03 + rand() * 0.015, old, Math.floor(rand() * 4), occ);
  };
  for (let i = 0; i < n; i++) {
    const o = i * stride;
    const px = ros[o], py = ros[o + 1], pz = ros[o + 2];
    dir.set(ros[o + 3], ros[o + 4], ros[o + 5]).normalize();
    const size = ros[o + 6], flex = ros[o + 7], occ = ros[o + 8], tE = ros[o + 9], old = ros[o + 10];
    if (stride >= 15) { pcx = ros[o + 12]; pcy = ros[o + 13]; pcz = ros[o + 14]; } else { pcx = px; pcy = py - 1; pcz = pz; }
    const shootH = new THREE.Vector3(dir.x, 0, dir.z);
    if (shootH.lengthSq() < 1e-4) shootH.set(1, 0, 0);
    shootH.normalize();
    const rot0 = rand() * Math.PI * 2;
    const count = Math.round((6 + rand() * 4) * size);
    for (let k = 0; k < count; k++) {
      if (rand() > density) continue;
      const outer = 1 - k / count;
      push(px, py, pz, rot0 + k * 2.39996, outer, shootH, flex, tE, -1, occ, 1);
    }
    if (old > 0) {
      const c = 2 + Math.floor(rand() * 3);
      for (let k = 0; k < c; k++) push(px, py, pz, rot0 + 1.2 + k * 2.2, 0.9, shootH, flex, 0, old, occ, 1.15);
    }
  }
  return { count: rosA.length / 4, matrices: new Float32Array(mats), rosette: new Float32Array(rosA), leaf: new Float32Array(leafA), pad: new Float32Array(padA) };
}

export const UNIFORMS = {
  uTime: { value: 0 }, uWind: { value: 0.3 }, uGust: { value: 0.5 },
  uWindDir: { value: new THREE.Vector3(0.8, 0, -0.6).normalize() },
  uTouchO: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, -99, 0, -99)) },
  uTouchD: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 1, 0, 0)) },
  uGrow: { value: 0 }, uTransmit: { value: 1.0 }
};

/** A MeshStandardMaterial (or depth material) patched into a growing leaf. */
export function makeLeafMaterial({ atlas, normal, depth = false, loose = false }) {
  const mat = depth
    ? new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: atlas, alphaTest: 0.5 })
    : new THREE.MeshStandardMaterial({ map: atlas, normalMap: normal, side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.5, metalness: 0, envMapIntensity: 0.7 });
  if (!depth) mat.normalScale = new THREE.Vector2(0.6, 0.6);
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, UNIFORMS);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
${WIND_GLSL}
${GROW_GLSL}
${loose ? 'attribute vec4 aLoose;' : 'attribute vec4 aRosette;\nattribute vec4 aLeaf;\nattribute vec3 aPad;'}
varying float vAge; varying float vYoung; varying float vVar; varying float vOcc; varying float vAir; varying vec3 vPadN;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
${loose
    ? 'float variant = aLoose.y; float age = aLoose.x; float scl = 1.0; float young = 0.0; float fold = 0.0; float erect = 0.0; float uu = 1.0;'
    : 'float variant = aLeaf.z; float uu, scl, young, fold, erect, age; leafGrow(aLeaf.x, aLeaf.y, uu, scl, young, fold, erect, age);'}
#ifdef USE_MAP
  vMapUv.x = (variant + vMapUv.x) * 0.25;
#endif
vAge = age; vYoung = young; vVar = fract(variant * 0.37 + ${loose ? 'aLoose.z' : 'aLeaf.x * 13.0'});
vOcc = ${loose ? '0.0' : 'aLeaf.w'};
vAir = ${loose ? 'aLoose.w' : '1.0'};
${loose ? 'vPadN = vec3(0.0, 1.0, 0.0);' : '// volume normal: outward from the centre of the leaf pad (flattened plates)\nvPadN = normalize(mat3(viewMatrix) * normalize((aRosette.xyz - aPad) * vec3(1.0, 2.2, 1.0) + vec3(0.0, 0.35, 0.0)));'}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
${loose ? '' : `
  // unfolding: the blade opens along the midrib and lowers from erect to spread
  float sz = sign(transformed.z);
  float az = abs(transformed.z);
  transformed.y += az * sin(fold);
  transformed.z = sz * az * cos(fold);
  float ce = cos(erect), se = sin(erect);
  transformed.xy = vec2(transformed.x * ce - transformed.y * se, transformed.x * se + transformed.y * ce);
  transformed *= scl;
  float touchE;
  vec3 rp = aRosette.xyz;
  vec3 disp = windSway(rp, aRosette.w) + touchPush(rp, touchE);
  float fl = sin(uTime * (5.5 + aLeaf.y * 3.0 + aLeaf.x * 4.0) + aLeaf.x * 40.0) * (0.05 + 0.2 * uWind * uGust + 0.6 * touchE) * (1.0 + young);
  transformed.y += fl * transformed.x;
  #ifdef USE_INSTANCING
    mat3 lim = mat3(instanceMatrix);
    transformed += transpose(lim) * disp / dot(lim[0], lim[0]);
  #endif`}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
${LEAF_COLOUR_GLSL}
uniform float uTransmit;
varying float vAge; varying float vYoung; varying float vVar; varying float vOcc; varying float vAir; varying vec3 vPadN;`)
      .replace('#include <map_fragment>', `
  vec4 lt = texture2D(map, vMapUv);
  ${depth ? '' : `
  vec3 lc = leafColour(vAge, lt.b, vYoung, vVar);
  lc = mix(lc, mix(lc, vec3(0.13, 0.06, 0.03), 0.45) * 0.8, 1.0 - vAir);
  float lum = lt.r * 1.38 * (0.82 + 0.36 * fract(vVar * 7.31));
  vec3 base = lc * lum + lt.g * 0.012 * (1.0 - vAge);
  if (!gl_FrontFacing) base = mix(base, base * vec3(1.45, 1.55, 1.25) + 0.008, 0.6);
  diffuseColor.rgb = base;`}
  float la = (lt.a - 0.5) / max(fwidth(lt.a), 1e-4) + 0.5;
  diffuseColor.a = clamp(la, 0.0, 1.0);`)
      .replace('#include <alphatest_fragment>', 'if (diffuseColor.a < 0.5) discard;');
    if (!depth) {
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  // leaves shade as part of their pad: soft, cloud-like light across the crown
  // near the camera each blade keeps its own surface; further away it melts into the pad
  float padK = mix(0.15, 0.7, smoothstep(4.0, 16.0, length(vViewPosition)));
  normal = normalize(mix(normal, vPadN, padK * vAir));`)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = gl_FrontFacing ? mix(0.34, 0.68, max(vAge, vYoung * 0.5)) : 0.8;')
        .replace('#include <lights_fragment_begin>', 'vec3 leafTransmit = vec3(0.0);\n#include <lights_fragment_begin>')
        .replace('#include <aomap_fragment>', `
  reflectedLight.indirectDiffuse *= mix(1.0, 0.45, vOcc);
  reflectedLight.indirectSpecular *= mix(1.0, 0.6, vOcc);`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  // light through the blade: thin young leaves glow most
  vec3 tint = diffuseColor.rgb * vec3(2.1, 2.2, 1.1) + vec3(0.012, 0.016, 0.0);
  float thin = 1.0 + 1.4 * vYoung;
  reflectedLight.directDiffuse += leafTransmit * tint * 0.45 * thin * uTransmit * vAir;
  #if defined( USE_ENVMAP ) && defined( STANDARD )
    reflectedLight.indirectDiffuse += getIBLIrradiance(-geometryNormal) * envMapIntensity * tint * 0.16 * thin * (1.0 - 0.6 * vOcc) * vAir;
  #endif`);
      sh.fragmentShader = sh.fragmentShader.replace(
        /RE_Direct\( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight \);/g,
        'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n\t\tleafTransmit += directLight.color * saturate( dot( -geometryNormal, directLight.direction ) );');
    }
  };
  mat.customProgramCacheKey = () => `leaf2-${depth}-${loose}`;
  return mat;
}

export function createCanopy(ros, stride, atlas, normal, density, geo = [2, 3]) {
  const data = buildLeafInstances(ros, stride, density);
  const g = leafGeometry(geo[0], geo[1]);
  g.setAttribute('aRosette', new THREE.InstancedBufferAttribute(data.rosette, 4));
  g.setAttribute('aLeaf', new THREE.InstancedBufferAttribute(data.leaf, 4));
  g.setAttribute('aPad', new THREE.InstancedBufferAttribute(data.pad, 3));
  const mesh = new THREE.InstancedMesh(g, makeLeafMaterial({ atlas, normal }), data.count);
  mesh.instanceMatrix.array.set(data.matrices);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.customDepthMaterial = makeLeafMaterial({ atlas, depth: true });
  mesh.frustumCulled = false;
  return { mesh, data };
}

export function createLooseLeaves(capacity, atlas, normal) {
  const g = leafGeometry(2, 3);
  const loose = new Float32Array(capacity * 4);
  const attr = new THREE.InstancedBufferAttribute(loose, 4);
  attr.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aLoose', attr);
  const mesh = new THREE.InstancedMesh(g, makeLeafMaterial({ atlas, normal, loose: true }), capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.customDepthMaterial = makeLeafMaterial({ atlas, depth: true, loose: true });
  mesh.frustumCulled = false;
  return { mesh, attr, loose };
}
