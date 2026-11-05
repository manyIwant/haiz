// Leaves of a growing tree: one instance per leaf, generated from the
// Blender rosettes. Every leaf has its own emergence time; the scroll-driven
// growth uniform (uGrow) moves each one through bud → unfolding → mature.
// Last year's red leaves hang on until the flush begins, then let go.
import * as THREE from 'three';
import { LEAF_TIMING } from './chapters.js';
export { LEAF_TIMING };

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
  vec3 green  = mix(vec3(0.034, 0.072, 0.020), vec3(0.052, 0.098, 0.026), variant);
  vec3 yellow = vec3(0.60, 0.40, 0.045);
  vec3 red    = vec3(0.42, 0.035, 0.018);
  vec3 brown  = vec3(0.17, 0.075, 0.03);
  float a = age * 1.35;
  vec3 c = mix(green, yellow, smoothstep(sen, sen + 0.16, a));
  c = mix(c, red, smoothstep(sen + 0.30, sen + 0.46, a));
  c = mix(c, brown, smoothstep(sen + 0.95, sen + 1.2, a));
  // Terminalia's new flush: bronze-red buds, then a bright yellow-green
  vec3 fresh = mix(vec3(0.075, 0.15, 0.03), vec3(0.30, 0.10, 0.04), smoothstep(0.66, 0.95, young));
  return mix(c, fresh, smoothstep(0.0, 0.45, young));
}
`;

// Growth of one leaf. Shared by colour and depth materials (and mirrored on the CPU).
// tE: when this leaf's bud breaks; old > 0: last year's leaf, dropping at uGrow = old.
export function leafVisible(tE, old, g) { return old > 0 ? g < old : g > tE - LEAF_TIMING.bud; }
export const GROW_GLSL = /* glsl */`
uniform float uGrow;
void leafGrow(float tE, float old, out float u, out float scl, out float young, out float fold, out float erect, out float age){
  age = 0.0;
  if (old > 0.0) {                       // last year's leaf
    u = 1.0; young = 0.0; fold = 0.0; erect = 0.0;
    scl = uGrow < old ? 1.0 : 0.0;
    age = 0.80 + fract(old * 37.0) * 0.32 + smoothstep(old - 0.12, old, uGrow) * 0.15;
    return;
  }
  u = clamp((uGrow - tE) / ${LEAF_TIMING.unfold.toFixed(3)}, 0.0, 1.0);
  float m = clamp((uGrow - tE - ${LEAF_TIMING.unfold.toFixed(3)} * 0.6) / ${LEAF_TIMING.mature.toFixed(3)}, 0.0, 1.0);
  scl = uGrow < tE - ${LEAF_TIMING.bud.toFixed(3)} ? 0.0 : mix(0.07, 1.0, smoothstep(0.0, 0.9, u));
  fold = (1.0 - smoothstep(0.1, 0.8, u)) * 1.3;
  erect = (1.0 - smoothstep(0.15, 0.9, u)) * 1.1;
  // bronze while the bud opens, then a bright, thin yellow-green that deepens as it matures
  young = (1.0 - m) * 0.62 + (1.0 - smoothstep(0.15, 0.55, u)) * 0.38;
}
`;

// Build one leaf blade: a quad folded along the midrib and arched to the tip.
export function leafGeometry(cols = 2, rows = 4, aspect = 0.62, shape = null) {
  // A blade along +x (petiole at 0, apex at 1), width along z, folded a little
  // along the midrib and arched. With `shape` (hero blades seen up close) the
  // margins droop, the lamina waves gently and the blade twists a touch.
  const pos = [], uv = [], idx = [];
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    for (let c = 0; c <= cols; c++) {
      const s = c / cols * 2 - 1;
      let x = t, y = Math.abs(s) * aspect * 0.5 * 0.16 - 0.10 * t * t + 0.05 * t, z = s * aspect * 0.5;
      if (shape) {
        y -= shape.cup * s * s * aspect * 0.5;                                   // margins roll down (leathery blade)
        y += shape.wave * Math.sin(t * Math.PI * shape.waves + Math.sign(s) * 1.3) * Math.abs(s) ** 1.5;
        y += shape.lift * t * t * t;                                              // the apex lifts
        const tw = shape.twist * t;                                               // a slight twist along the midrib
        const cz = Math.cos(tw), sz = Math.sin(tw);
        [y, z] = [y * cz - z * sz, y * sz + z * cz];
      }
      pos.push(x, y, z);
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
 * Expand rosettes (see tree.json rosetteLayout) into individual leaves.
 * A rosette with tEmerge < 0 holds only last year's leaves (they drop at tOldDrop).
 */
export function buildLeafInstances(ros, stride, density = 1, sizeK = 1) {
  const n = ros.length / stride;
  const rand = mulberry(20231030);
  const mats = [], rosA = [], leafA = [], padA = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), blade = new THREE.Vector3();
  const side = new THREE.Vector3(), nrm = new THREE.Vector3(), basis = new THREE.Matrix4();
  const s2 = new THREE.Vector3(), n2 = new THREE.Vector3(), at = new THREE.Vector3(), sc = new THREE.Vector3();
  // fewer leaves on lower tiers are compensated by slightly larger ones
  const scaleComp = Math.pow(1 / Math.max(0.3, density), 0.22) * sizeK;
  let cx = 0, cy = 0, cz = 0, shell = 1, tilt = 0, tiltA = 0;
  const push = (px, py, pz, ang, outer, shootH, flex, tE, old, occ, lenK) => {
    // Terminalia's whorl spreads nearly flat: a star-shaped plate, inner leaves a little raised
    const elev = THREE.MathUtils.lerp(0.5, -0.1, outer) + (rand() - 0.5) * 0.36 + tilt * Math.cos(ang - tiltA);
    blade.set(Math.cos(ang), 0, Math.sin(ang)).addScaledVector(shootH, 0.45).normalize();
    blade.y = Math.sin(elev);
    blade.normalize();
    side.crossVectors(up, blade).normalize();
    nrm.crossVectors(blade, side).normalize();
    const roll = (rand() - 0.5) * 0.7;
    s2.copy(side).multiplyScalar(Math.cos(roll)).addScaledVector(nrm, Math.sin(roll));
    n2.crossVectors(blade, s2).normalize();
    basis.makeBasis(blade, n2, s2.multiplyScalar(-1));
    q.setFromRotationMatrix(basis);
    const len = (0.19 + rand() * 0.15) * (0.58 + 0.5 * outer) * scaleComp * lenK;
    const off = 0.015 + rand() * 0.03;
    const back = (1 - outer) * 0 + outer * (0.02 + rand() * 0.07);   // outer (older) leaves sit lower on the shoot
    at.set(px + blade.x * off - sdir.x * back, py + blade.y * off * 0.5 - sdir.y * back, pz + blade.z * off - sdir.z * back);
    m.compose(at, q, sc.set(len, len, len));
    for (let k = 0; k < 16; k++) mats.push(m.elements[k]);
    rosA.push(px, py, pz, flex);
    padA.push(cx, cy, cz, shell);
    // inner leaves of a rosette open a little later
    leafA.push(tE + (1 - outer) * 0.025 + rand() * 0.012, old, Math.floor(rand() * 4), occ);
  };
  const shootH = new THREE.Vector3(), sdir = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const o = i * stride;
    const px = ros[o], py = ros[o + 1], pz = ros[o + 2];
    dir.set(ros[o + 3], ros[o + 4], ros[o + 5]).normalize();
    const size = ros[o + 6], flex = ros[o + 7], occ = ros[o + 8], tE = ros[o + 9], old = ros[o + 10];
    if (stride >= 15) { cx = ros[o + 12]; cy = ros[o + 13]; cz = ros[o + 14]; } else { cx = px; cy = py - 1; cz = pz; }
    shell = stride >= 16 ? ros[o + 15] : 1;
    sdir.copy(dir);
    shootH.set(dir.x, 0, dir.z);
    if (shootH.lengthSq() < 1e-4) shootH.set(1, 0, 0);
    shootH.normalize();
    const rot0 = rand() * Math.PI * 2;
    // each rosette leans a little its own way; together they still make level shelves
    tilt = (rand() - 0.5) * 0.4; tiltA = rand() * Math.PI * 2;
    if (tE >= 0) {
      const count = Math.round((9 + rand() * 5) * size);
      for (let k = 0; k < count; k++) {
        if (rand() > density) continue;
        push(px, py, pz, rot0 + k * 2.39996, 1 - k / count, shootH, flex, tE, -1, occ, 1);
      }
    }
    if (old > 0) {
      const c = tE >= 0 ? 2 + Math.floor(rand() * 2) : Math.round((5 + rand() * 4) * size);
      for (let k = 0; k < c; k++) {
        if (tE < 0 && rand() > Math.max(0.5, density)) continue;
        push(px, py, pz, rot0 + 1.2 + k * 2.39996, 0.75 + 0.25 * rand(), shootH, flex, 0, old, occ, 1.12);
      }
    }
  }
  return { count: rosA.length / 4, matrices: new Float32Array(mats), rosette: new Float32Array(rosA), leaf: new Float32Array(leafA), pad: new Float32Array(padA) };
}

export const UNIFORMS = {
  uTime: { value: 0 }, uWind: { value: 0.3 }, uGust: { value: 0.5 },
  uWindDir: { value: new THREE.Vector3(0.8, 0, -0.6).normalize() },
  uTouchO: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, -99, 0, -99)) },
  uTouchD: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 1, 0, 0)) },
  uGrow: { value: 0 }, uTransmit: { value: 1.0 }, uFar: { value: 0.35 }
};

/** A MeshStandardMaterial (or depth material) patched into a growing leaf. */
export function makeLeafMaterial({ atlas, normal, depth = false, loose = false, hero = false }) {
  const mat = depth
    ? new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: atlas, alphaTest: 0.5 })
    : new THREE.MeshStandardMaterial({ map: atlas, normalMap: normal, side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.5, metalness: 0, envMapIntensity: 0.32 });
  if (!depth) mat.normalScale = new THREE.Vector2(1.0, 1.0);
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, UNIFORMS);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
${WIND_GLSL}
${GROW_GLSL}
uniform float uFar;
${loose ? 'attribute vec4 aLoose;' : 'attribute vec4 aRosette;\nattribute vec4 aLeaf;\nattribute vec4 aPad;'}
varying float vAge; varying float vYoung; varying float vVar; varying float vOcc; varying float vAir; varying vec3 vPadN; varying float vShell; varying float vTone;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
${loose
    ? 'float variant = aLoose.y; float age = aLoose.x; float scl = 1.0; float young = 0.0; float fold = 0.0; float erect = 0.0; float uu = 1.0;'
    : 'float variant = aLeaf.z; float uu, scl, young, fold, erect, age; leafGrow(aLeaf.x, aLeaf.y, uu, scl, young, fold, erect, age);'}
${hero ? 'variant = mod(variant, 2.0);   // the hero cluster: whole blades' : ''}
#ifdef USE_MAP
  vMapUv.x = (variant + vMapUv.x) * 0.25;
#endif
vAge = age; vYoung = young; vVar = fract(variant * 0.37 + ${loose ? 'aLoose.z' : 'aLeaf.x * 13.0'});
vOcc = ${loose ? '0.0' : 'aLeaf.w'};
vShell = ${loose ? '1.0' : 'aPad.w'};
// every clump has its own tone: some yellower in the sun, some bluer in the shade
vTone = ${loose ? 'fract(aLoose.z * 7.13)' : 'fract(sin(dot(aPad.xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453)'};
// gusts roll across the crown and turn leaves over: their pale undersides shimmer in waves
float flip = 0.0;
${loose ? '' : `{
  vec2 wd = normalize(uWindDir.xz + vec2(1e-4));
  float front = dot(aRosette.xz, wd) * 0.3 - uTime * 0.95 + sin(aRosette.x * 0.21 + aRosette.z * 0.17) * 1.4;
  float wave = pow(0.5 + 0.5 * sin(front), 7.0);
  flip = wave * smoothstep(0.16, 0.5, uWind * (0.4 + uGust)) * (0.65 + 0.7 * fract(aLeaf.x * 31.0)) * (0.35 + 0.65 * aRosette.w) * 1.4;
}`}
vAir = ${loose ? 'aLoose.w' : '1.0'};
${loose ? 'vPadN = vec3(0.0, 1.0, 0.0);' : '// volume normal: outward from the centre of the leaf pad (flattened plates)\nvPadN = normalize(mat3(viewMatrix) * normalize((aRosette.xyz - aPad.xyz) * vec3(1.0, 1.4, 1.0) + vec3(0.0, 0.3, 0.0)));'}`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
  objectNormal.yz = vec2(objectNormal.y * cos(flip) - objectNormal.z * sin(flip), objectNormal.y * sin(flip) + objectNormal.z * cos(flip));`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
${loose ? '' : `
  // unfolding: the blade opens along the midrib and lowers from erect to spread
  float sz = sign(transformed.z);
  float az = abs(transformed.z);
  transformed.y += az * sin(fold);
  transformed.z = sz * az * cos(fold);
  float ce = cos(erect), se = sin(erect);
  transformed.xy = vec2(transformed.x * ce - transformed.y * se, transformed.x * se + transformed.y * ce);
  transformed.yz = vec2(transformed.y * cos(flip) - transformed.z * sin(flip), transformed.y * sin(flip) + transformed.z * cos(flip));
  transformed *= scl;
  ${depth ? '' : `#ifdef USE_INSTANCING
  {
    // far away, blades grow a little so the crown keeps its coverage (not in the shadow pass)
    vec3 wp = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    transformed *= 1.0 + uFar * smoothstep(14.0, 60.0, distance(wp, cameraPosition));
  }
  #endif`}
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
varying float vAge; varying float vYoung; varying float vVar; varying float vOcc; varying float vAir; varying vec3 vPadN; varying float vShell; varying float vTone;`)
      .replace('#include <map_fragment>', `
  vec4 lt = texture2D(map, vMapUv);
  float leafVein = lt.g;
  ${depth ? '' : `
  vec3 lc = leafColour(vAge, lt.b, vYoung, vVar);
  float matureG = (1.0 - smoothstep(0.1, 0.5, vAge)) * (1.0 - smoothstep(0.1, 0.6, vYoung));
  float rimK = smoothstep(0.55, 0.98, abs(vMapUv.x * 4.0 - floor(vMapUv.x * 4.0) - 0.5) * 2.0);
  lc = mix(lc, lc * vec3(1.5, 0.95, 0.75), rimK * smoothstep(0.05, 0.4, vYoung) * 0.6);
  lc *= mix(vec3(1.0), mix(vec3(0.86, 0.97, 1.08), vec3(1.16, 1.07, 0.78), vTone), matureG);
  lc = mix(lc, lc * vec3(1.12, 1.1, 0.9), vShell * 0.18 * matureG);
  lc = mix(lc, mix(lc, vec3(0.13, 0.06, 0.03), 0.45) * 0.8, 1.0 - vAir);
  float lum = lt.r * 1.2 * (0.78 + 0.44 * fract(vVar * 7.31));
  vec3 base = lc * lum;
  base = mix(base, base * vec3(1.42, 1.36, 0.82) + vec3(0.006, 0.006, 0.0), lt.g * 0.55 * (1.0 - vAge));
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
  // (only partly: each blade's own tilt and self-shadow is what makes a real canopy read
  // as foliage from far away, not as soft green clouds)
  float padK = mix(0.1, 0.42, smoothstep(6.0, 30.0, length(vViewPosition)));
  vec3 nb = mix(normal, vPadN, padK * vAir);
  // a back face can point exactly away from its clump: never normalise a zero vector
  normal = dot(nb, nb) > 1e-5 ? normalize(nb) : vPadN;`)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = gl_FrontFacing ? mix(0.3, 0.62, vAge) - 0.05 * vYoung : 0.8;')
        .replace('#include <lights_fragment_begin>', 'vec3 leafTransmit = vec3(0.0); vec3 leafFwd = vec3(0.0);\n#include <lights_fragment_begin>')
        .replace('#include <aomap_fragment>', `
  // canopy occlusion (baked per rosette): the inside of the crown is darker
  float crownAO = mix(1.0, 0.16, vOcc) * mix(0.5, 1.0, vShell);
  reflectedLight.indirectDiffuse *= crownAO;
  reflectedLight.indirectSpecular *= crownAO;`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  // light through the blade: thin young leaves glow most
  // light through the blade: veins and the reticulum are thicker and pass less of it
  // light through the blade is a little yellower than the blade and varies
  // leaf to leaf with its thickness; veins pass less of it
  vec3 tint = (diffuseColor.rgb * vec3(1.4, 1.45, 0.8) + vec3(0.006, 0.009, 0.0)) * mix(vec3(1.0), ${hero ? 'vec3(0.78, 0.6, 0.22)' : 'vec3(0.95, 0.85, 0.5)'}, leafVein);
  float thin = (1.0 + 0.55 * vYoung) * (0.6 + 0.65 * fract(vVar * 5.17)) * ${hero ? '3.9' : '1.0'};
  ${hero ? 'tint *= vec3(1.08, 1.0, 0.8);   // backlit Terminalia: a warmer, yellower green' : ''}
  reflectedLight.directDiffuse += leafTransmit * tint * 0.7 * thin * uTransmit * vAir;
  // looking towards the sun through a blade: it glows (forward scattering)
  reflectedLight.directDiffuse += leafFwd * tint * 1.1 * thin * uTransmit * vAir;
  // a waxy cuticle: the sky's sheen on the upper faces is what makes a real crown
  // read silvery-green on top and deep inside (the inside is already darkened by crownAO)
  reflectedLight.directSpecular *= 0.9;
  reflectedLight.indirectSpecular *= gl_FrontFacing ? 0.75 : 0.25;
  #if defined( USE_ENVMAP ) && defined( STANDARD )
    reflectedLight.indirectDiffuse += getIBLIrradiance(-geometryNormal) * envMapIntensity * tint * 0.4 * thin * (1.0 - 0.7 * vOcc) * vAir;
  #endif`);
      sh.fragmentShader = sh.fragmentShader.replace(
        /RE_Direct\( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight \);/g,
        'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n\t\tleafTransmit += directLight.color * saturate( dot( -geometryNormal, directLight.direction ) );\n\t\tleafFwd += directLight.color * pow( saturate( dot( -geometryViewDir, directLight.direction ) ), 9.0 );');
    }
  };
  mat.customProgramCacheKey = () => `leaf2-${depth}-${loose}-${hero}`;
  return mat;
}

export function createCanopy(ros, stride, atlas, normal, density, geo = [2, 3], sizeK = 1) {
  const data = buildLeafInstances(ros, stride, density, sizeK);
  const g = leafGeometry(geo[0], geo[1]);
  g.setAttribute('aRosette', new THREE.InstancedBufferAttribute(data.rosette, 4));
  g.setAttribute('aLeaf', new THREE.InstancedBufferAttribute(data.leaf, 4));
  g.setAttribute('aPad', new THREE.InstancedBufferAttribute(data.pad, 4));
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

/**
 * Evergreen undergrowth on the islet's soil: small domed shrubs of small leaves,
 * built from the same leaf blades (static, mature green).
 */
export function createShrubs(spots, atlas, normal) {
  const rand = mulberry(611);
  const mats = [], loose = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), at = new THREE.Vector3(), sc = new THREE.Vector3();
  for (const [x, y, z, size] of spots) {
    const n = Math.round(40 + 70 * size);
    for (let k = 0; k < n; k++) {
      const th = rand() * Math.PI * 2, ph = Math.acos(1 - rand() * 0.95);
      const r = size * (0.55 + 0.45 * Math.sqrt(rand()));
      at.set(x + Math.cos(th) * Math.sin(ph) * r, y + Math.cos(ph) * r * 0.75, z + Math.sin(th) * Math.sin(ph) * r);
      e.set((rand() - 0.5) * 1.2, -th + (rand() - 0.5) * 0.8, 0.35 - ph * 0.6 + (rand() - 0.5) * 0.6);
      q.setFromEuler(e);
      const len = 0.07 + rand() * 0.07;
      m.compose(at, q, sc.set(len, len, len));
      mats.push(...m.elements);
      loose.push(0.0, Math.floor(rand() * 4), rand(), 1);
    }
  }
  const g = leafGeometry(2, 2);
  g.setAttribute('aLoose', new THREE.InstancedBufferAttribute(new Float32Array(loose), 4));
  const mesh = new THREE.InstancedMesh(g, makeLeafMaterial({ atlas, normal, loose: true }), loose.length / 4);
  mesh.instanceMatrix.array.set(mats);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.customDepthMaterial = makeLeafMaterial({ atlas, depth: true, loose: true });
  mesh.frustumCulled = false;
  return mesh;
}

/**
 * Hero level of detail: the leaves near `centre` (the cluster the details shot
 * looks at) move from the canopy's coarse blades to finely tessellated, cupped
 * blades. They keep every per-leaf attribute, so they grow, sway and colour
 * exactly as before; the canopy's copies are collapsed to nothing.
 */
/** A photographer's pruning: hide the canopy leaves inside a capsule a → b (the lens's line of sight). */
export function clearZone(mesh, a, b, radius) {
  const im = mesh.instanceMatrix.array;
  const ab = new THREE.Vector3().subVectors(b, a), len2 = ab.lengthSq(), p = new THREE.Vector3();
  let n = 0;
  for (let i = 0; i < mesh.count; i++) {
    p.set(im[i * 16 + 12], im[i * 16 + 13], im[i * 16 + 14]);
    const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / len2));
    if (p.distanceTo(a.clone().addScaledVector(ab, t)) < radius) { for (let c = 0; c < 16; c++) im[i * 16 + c] = 0; n++; }
  }
  mesh.instanceMatrix.needsUpdate = true;
  return n;
}

export function createHeroLeaves(canopy, centre, radius, ros, stride, sizeK = 1) {
  // hide the crown's own (tier-thinned) leaves here ...
  const d = canopy.data, n = d.count;
  const im = canopy.mesh.instanceMatrix.array;
  for (let i = 0; i < n; i++) {
    const dx = d.rosette[i * 4] - centre.x, dy = d.rosette[i * 4 + 1] - centre.y, dz = d.rosette[i * 4 + 2] - centre.z;
    if (dx * dx + dy * dy + dz * dz < radius * radius) for (let c = 0; c < 16; c++) im[i * 16 + c] = 0;
  }
  // ... and grow every leaf of these rosettes at full density, on every quality tier
  const sub = [];
  for (let i = 0; i < ros.length; i += stride) {
    const dx = ros[i] - centre.x, dy = ros[i + 1] - centre.y, dz = ros[i + 2] - centre.z;
    if (dx * dx + dy * dy + dz * dz < radius * radius) for (let c = 0; c < stride; c++) sub.push(ros[i + c]);
  }
  if (!sub.length) return null;
  const hd = buildLeafInstances(new Float32Array(sub), stride, 1, sizeK);
  const g = leafGeometry(6, 14, 0.62, { cup: 0.11, wave: 0.012, waves: 3.2, lift: 0.05, twist: 0.12 });
  const rosA = hd.rosette, leafA = hd.leaf, padA = hd.pad, mats = hd.matrices;
  canopy.mesh.instanceMatrix.needsUpdate = true;
  g.setAttribute('aRosette', new THREE.InstancedBufferAttribute(rosA, 4));
  g.setAttribute('aLeaf', new THREE.InstancedBufferAttribute(leafA, 4));
  g.setAttribute('aPad', new THREE.InstancedBufferAttribute(padA, 4));
  // its own material: whole blades, and the light through them as strong as a real backlit leaf
  const cm = canopy.mesh.material;
  const mesh = new THREE.InstancedMesh(g, makeLeafMaterial({ atlas: cm.map, normal: cm.normalMap, hero: true }), hd.count);
  mesh.instanceMatrix.array.set(mats);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.customDepthMaterial = canopy.mesh.customDepthMaterial;
  mesh.frustumCulled = false;
  mesh.name = 'hero-leaves';
  return mesh;
}
