// 《春天没有收件人》 — the world, as seen by Three.js.
//
// Static geometry is lit by Cycles lightmaps (direct + indirect diffuse, baked per lighting
// state and crossfaded); the sun is only computed in real time where it has to move.
// The river is a custom shader whose reflection can be swapped for something else:
// the terminal, an empty sky, or a world that is not there.
//
// Coordinates: Blender (x east, y north, z up) arrives from glTF as (x, z, -y).
import * as THREE from 'three';
import { GLTFLoader } from './vendor/three/addons/GLTFLoader.js';
import { RGBELoader } from './vendor/three/addons/RGBELoader.js';

export const B = (x, y, z) => new THREE.Vector3(x, z, -y);

const ASSETS = '../assets/';
const texLoader = new THREE.TextureLoader();
const texCache = {};

function loadTex(file, srgb, repeat = 1) {
  const key = file + '|' + srgb;
  let base = texCache[key];
  if (!base) {
    base = texLoader.load(ASSETS + file);
    base.flipY = false;
    base.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    base.wrapS = base.wrapT = THREE.RepeatWrapping;
    base.anisotropy = 8;
    base.generateMipmaps = true;
    base.minFilter = THREE.LinearMipmapLinearFilter;
    texCache[key] = base;
  }
  const t = base.clone();
  t.repeat.set(repeat, repeat);
  t.needsUpdate = true;
  return t;
}

// ------------------------------------------------------------------------ globals
// Shared uniforms, updated every frame by the film.
export const U = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunCol: { value: new THREE.Color(1, 1, 1) },
  uFogCol: { value: new THREE.Color(0.6, 0.65, 0.7) },
  uFogSun: { value: new THREE.Color(1.0, 0.7, 0.4) },
  uFogDensity: { value: 0.0008 },
  uMist: { value: 0.0 },             // low river mist (dawn)
  uMistCol: { value: new THREE.Color(0.6, 0.65, 0.75) },
  uWind: { value: 0.3 },
  uDirect: { value: 0.0 },           // realtime sun on baked surfaces (shadow sweep only)
  uLmMix: { value: 0.0 },
  uLmGain: { value: 1.0 },
};

// GLSL shared by every material: aerial perspective + river mist.
const ATMOS_GLSL = /* glsl */`
uniform vec3 uFogCol; uniform vec3 uFogSun; uniform float uFogDensity;
uniform vec3 uSunDir; uniform float uMist; uniform vec3 uMistCol;
vec3 applyAtmos(vec3 col, vec3 wpos) {
  vec3 d = wpos - cameraPosition;
  float dist = length(d);
  vec3 v = d / max(dist, 1e-4);
  float sunAmt = pow(max(dot(v, uSunDir), 0.0), 6.0);
  vec3 fc = mix(uFogCol, uFogSun, sunAmt);
  // height falloff: thinner air higher up
  float h = max(wpos.y, 0.0);
  float dens = uFogDensity * exp(-h * 0.012);
  float f = 1.0 - exp(-dist * dens);
  col = mix(col, fc, clamp(f, 0.0, 1.0));
  // mist hugging the water surface
  float m = uMist * exp(-max(wpos.y, 0.0) * 0.9) * (1.0 - exp(-dist * 0.035));
  col = mix(col, uMistCol, clamp(m, 0.0, 0.92));
  return col;
}
`;

function patchAtmos(shader) {
  Object.assign(shader.uniforms, U);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
    .replace('#include <fog_vertex>', '#include <fog_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\n' + ATMOS_GLSL)
    .replace('#include <fog_fragment>', 'gl_FragColor.rgb = applyAtmos(gl_FragColor.rgb, vWPos);');
}

// Baked material: albedo * lightmap (log-encoded, two states crossfaded) + env specular.
const LM_CHUNK = /* glsl */`
#if defined( RE_IndirectDiffuse )
  #ifdef USE_LIGHTMAP
    vec3 lmA = (exp2(texture2D(lightMap, vLightMapUv).rgb * 12.0) - 1.0) / 64.0;
    vec3 lmB = (exp2(texture2D(lm2, vLightMapUv).rgb * 12.0) - 1.0) / 64.0;
    irradiance += mix(lmA, lmB, uLmMix) * lightMapIntensity * uLmGain * lmLocalGain;
  #endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
  radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
#endif
`;

function makeBaked(spec, name, lmA, lmB) {
  const tile = spec.unit ? 1 : 1 / (spec.tile || 1);
  const p = { roughness: spec.rough ?? 0.8, metalness: spec.metal ?? 0 };
  if (spec.tex) {
    p.map = loadTex(`tex/${spec.tex}_col.png`, true, tile);
    if (!spec.unit && ['plaster', 'paintgreen', 'terrazzo', 'wood', 'concrete', 'facade', 'stone', 'corr', 'metal', 'grass', 'track', 'fabric'].includes(spec.tex)) {
      const hasN = ['plaster', 'paintgreen', 'terrazzo', 'wood', 'concrete', 'facade', 'stone', 'corr', 'metal', 'grass', 'track', 'fabric'].includes(spec.tex);
      if (hasN) p.normalMap = loadTex(`tex/${spec.tex}_nrm.png`, false, tile);
      if (['plaster', 'paintgreen', 'terrazzo', 'wood', 'concrete', 'facade', 'stone', 'corr', 'metal'].includes(spec.tex))
        p.roughnessMap = loadTex(`tex/${spec.tex}_rgh.png`, false, tile);
    }
    if (spec.tint) p.color = new THREE.Color(...spec.tint);
  } else {
    p.color = new THREE.Color(...spec.col);
  }
  const m = new THREE.MeshStandardMaterial(p);
  if (p.normalMap) m.normalScale.set(0.6, 0.6);
  m.lightMap = lmA;
  m.lightMapIntensity = Math.PI;
  m.envMapIntensity = spec.rough < 0.5 ? 0.55 : 0.25;
  m.userData.lm2 = { value: lmB || lmA };
  m.userData.lmLocalGain = { value: 1.0 };
  m.name = name;
  m.onBeforeCompile = (shader) => {
    patchAtmos(shader);
    shader.uniforms.lm2 = m.userData.lm2;
    shader.uniforms.lmLocalGain = m.userData.lmLocalGain;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D lm2; uniform float uLmMix; uniform float uLmGain; uniform float lmLocalGain; uniform float uDirect;')
      .replace('#include <lights_fragment_maps>', LM_CHUNK)
      .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin.replace(
        'getDirectionalLightInfo( directionalLight, directLight );',
        'getDirectionalLightInfo( directionalLight, directLight ); directLight.color *= uDirect;')
        // baked surfaces already contain all sky and bounce light: no hemisphere fill
        .replace('irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );', ''));
    if (name === 'facade' || name === 'stone' || name === 'band') {
      // weathering: rain streaks under the sills of the west wall, grime at the base, algae at the waterline
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          float wh(float n){ return fract(sin(n * 91.3458) * 47453.5453); }
          float wn(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(wh(i), wh(i + 1.0), f); }
          float winNear(float by){ // windows of the west facade (blender y)
            float best = 9.0;
            for (int b = 0; b < 5; b++) {
              float c = b == 0 ? -19.62 : b == 1 ? -10.24 : b == 2 ? 0.0 : b == 3 ? 10.24 : 19.62;
              float k = (b == 0 || b == 4) ? 2.1 : 3.3;
              best = min(best, min(abs(by - c), min(abs(by - c - k), abs(by - c + k))));
            }
            return best; }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          {
            float bx = vWPos.x, by = -vWPos.z, bz = vWPos.y;
            float dirt = 0.0;
            if (bx < -5.9 && abs(by) < 24.2) {
              float wn0 = winNear(by);
              for (int f = 0; f < 3; f++) {
                float sill = 1.9 + float(f) * 3.6;
                float below = sill - 0.1 - bz;
                if (below > 0.0 && below < 3.4 && wn0 < 1.3) {
                  float st = wn(by * 9.0 + float(f) * 17.0) * wn(by * 23.0 + 3.0);
                  dirt += st * (1.0 - below / 3.4) * 0.55 * smoothstep(1.3, 0.9, wn0);
                }
              }
              dirt += smoothstep(2.4, 1.0, bz) * 0.22 * (0.6 + 0.4 * wn(by * 3.0));
              dirt += wn(by * 0.7 + bz * 0.3) * 0.06;
            }
            diffuseColor.rgb *= 1.0 - clamp(dirt, 0.0, 0.6) * vec3(0.55, 0.58, 0.62);
            if (bz < 0.55) { float wet = smoothstep(0.55, 0.05, bz); diffuseColor.rgb *= mix(vec3(1.0), vec3(0.42, 0.48, 0.36), wet); }
          }`);
    }
    if (spec.emit) {
      shader.uniforms.uEmit = m.userData.emit = m.userData.emit || { value: 0 };
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uEmit;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(${spec.emit.join(',')}) * uEmit;`);
    }
  };
  m.customProgramCacheKey = () => 'baked' + (spec.emit ? 'e' : '') + (['facade', 'stone', 'band'].includes(name) ? 'w' : '');
  return m;
}

function makeDynamic(spec) {
  const tile = spec.unit ? 1 : 1 / (spec.tile || 1);
  const p = { roughness: spec.rough ?? 0.8, metalness: spec.metal ?? 0 };
  if (spec.tex) { p.map = loadTex(`tex/${spec.tex}_col.png`, true, tile); if (spec.tint) p.color = new THREE.Color(...spec.tint); }
  else p.color = new THREE.Color(...spec.col);
  if (spec.tex === 'fabric') p.normalMap = loadTex('tex/fabric_nrm.png', false, tile);
  const m = new THREE.MeshStandardMaterial(p);
  m.onBeforeCompile = (s) => patchAtmos(s);
  m.customProgramCacheKey = () => 'dyn';
  return m;
}

// ----------------------------------------------------------------------- sky dome
function makeSky(skyTex) {
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({
      skyA: { value: skyTex.dusk }, skyB: { value: skyTex.dusk }, skyMix: { value: 0 },
      skyGain: { value: 1.0 }, cloudAmt: { value: 0.5 }, cloudCol: { value: new THREE.Color(1, 0.8, 0.7) },
      cloudShade: { value: new THREE.Color(0.4, 0.4, 0.5) }, stars: { value: 0 }, moonDir: { value: new THREE.Vector3(0, 0.3, 1).normalize() },
      moonAmt: { value: 0 }, emptyAmt: { value: 0 },
    }, U),
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
      uniform sampler2D skyA, skyB; uniform float skyMix, skyGain, cloudAmt, stars, moonAmt, uTime;
      uniform vec3 cloudCol, cloudShade, moonDir, uSunDir, uSunCol;
      varying vec3 vDir;
      vec2 eq(vec3 d){ return vec2(atan(d.z, d.x) / 6.2831853 + 0.5, asin(clamp(d.y,-1.0,1.0)) / 3.14159265 + 0.5); }
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<6;i++){ s+=a*vn(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir);
        vec3 c = mix(texture2D(skyA, eq(d)).rgb, texture2D(skyB, eq(d)).rgb, skyMix) * skyGain;
        // a thin, high cloud deck (projected on a plane 3 km up)
        if (d.y > 0.0 && cloudAmt > 0.0) {
          vec2 q = d.xz / (d.y + 0.06) * 1.6 + vec2(uTime * 0.004, uTime * 0.0015);
          float n = fbm(q * 1.3) * 0.65 + fbm(q * 4.1 + 3.0) * 0.35;
          float streak = fbm(vec2(q.x * 0.6, q.y * 3.5));
          float cov = smoothstep(0.52 - cloudAmt * 0.25, 0.85, n * 0.7 + streak * 0.3);
          cov *= smoothstep(0.0, 0.18, d.y);
          float sunAmt = pow(max(dot(d, uSunDir), 0.0), 3.0);
          vec3 cl = mix(cloudShade, cloudCol, 0.35 + 0.65 * sunAmt) * (0.8 + 0.4 * n);
          c = mix(c, cl * skyGain, cov * 0.85);
        }
        if (stars > 0.0 && d.y > 0.0) {
          vec2 g = eq(d) * vec2(2600.0, 1300.0);
          float s = step(0.9985, h21(floor(g))) * smoothstep(0.0, 0.2, d.y);
          c += vec3(s) * stars * (0.5 + 0.5 * h21(floor(g) + 3.0));
        }
        if (moonAmt > 0.0) {
          float md = dot(d, normalize(moonDir));
          c += vec3(0.85, 0.88, 0.9) * smoothstep(0.99993, 0.99996, md) * moonAmt;
          c += vec3(0.5, 0.55, 0.65) * pow(max(md, 0.0), 400.0) * 0.08 * moonAmt;
        }
        // fade the lower hemisphere into the fog colour (the world floor is at the horizon)
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(5000, 64, 32), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

// -------------------------------------------------------------------------- water
function makeWater(normA, normB) {
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({
      tRefl: { value: null }, tReflAlt: { value: null }, reflAltMix: { value: 0 },
      tOpaque: { value: null }, tDepth: { value: null }, tTerm: { value: null }, termMix: { value: 0 },
      reflMatrix: { value: new THREE.Matrix4() }, reflAltMatrix: { value: new THREE.Matrix4() },
      resolution: { value: new THREE.Vector2(1920, 1080) }, camNear: { value: 0.05 }, camFar: { value: 6000 },
      tN1: { value: normA }, tN2: { value: normB },
      flow: { value: 1.0 }, flowT: { value: 0.0 }, chop: { value: 0.22 }, clarity: { value: 0.0 }, reflectivity: { value: 1.0 },
      waterCol: { value: new THREE.Color(0.035, 0.05, 0.045) }, deepCol: { value: new THREE.Color(0.01, 0.018, 0.02) },
      blankCol: { value: new THREE.Color(0.7, 0.72, 0.72) }, blank: { value: 0 },
      sunGlint: { value: 1.0 }, termDistort: { value: 1.0 }, rippleAmt: { value: 0 }, rippleT: { value: 0 }, rippleC: { value: new THREE.Vector2(0, 0) },
    }, U),
    vertexShader: /* glsl */`
      uniform mat4 reflMatrix, reflAltMatrix; varying vec4 vRefl, vReflAlt; varying vec3 vWPos;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWPos = w.xyz;
        vRefl = reflMatrix * w; vReflAlt = reflAltMatrix * w;
        gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tRefl, tReflAlt, tOpaque, tDepth, tTerm, tN1, tN2;
      uniform float reflAltMix, termMix, flow, flowT, chop, clarity, reflectivity, blank, sunGlint, termDistort, uTime;
      uniform float rippleAmt, rippleT; uniform vec2 rippleC;
      uniform vec2 resolution; uniform float camNear, camFar;
      uniform vec3 waterCol, deepCol, blankCol, uSunCol;
      varying vec4 vRefl, vReflAlt; varying vec3 vWPos;
      ${ATMOS_GLSL}
      float linDepth(float z){ float n = camNear, f = camFar; return (2.0 * n * f) / (f + n - (z * 2.0 - 1.0) * (f - n)); }
      void main(){
        vec2 suv = gl_FragCoord.xy / resolution;
        float sceneZ = linDepth(texture2D(tDepth, suv).x);
        float waterZ = linDepth(gl_FragCoord.z);
        if (sceneZ < waterZ - 0.02) discard;          // something stands in front of the water
        float thick = sceneZ - waterZ;
        // flowing surface: two scrolling normal maps (river flows towards -Y blender = +z three? no: flows north)
        float t = flowT;
        vec2 p = vWPos.xz;
        vec3 n1 = texture2D(tN1, p * 0.045 + vec2(0.0, -t * 0.020)).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(tN2, p * 0.11 + vec2(t * 0.006, -t * 0.045)).xyz * 2.0 - 1.0;
        vec3 n3 = texture2D(tN1, p * 0.33 + vec2(-t * 0.01, -t * 0.09)).xyz * 2.0 - 1.0;
        float camD = length(cameraPosition - vWPos);
        float fineFade = 1.0 / (1.0 + camD * 0.08);   // fine ripples vanish with distance (no shimmer)
        vec2 slope = (n1.xy * 0.5 + n2.xy * 0.22 * (0.4 + 0.6 * fineFade) + n3.xy * 0.07 * fineFade) * chop;
        // a single falling drop's ring (the transition) — expanding circular wave
        if (rippleAmt > 0.0) {
          vec2 dv = p - rippleC; float r = length(dv);
          float front = rippleT * 1.6;
          float w = exp(-pow((r - front) * 1.8, 2.0)) * sin((r - front) * 18.0) * exp(-rippleT * 0.35) * smoothstep(0.0, 0.25, rippleT);
          slope += normalize(dv + 1e-5) * w * rippleAmt * 0.6;
        }
        vec3 N = normalize(vec3(slope.x, 1.0, slope.y));
        vec3 V = normalize(cameraPosition - vWPos);
        float dist = length(cameraPosition - vWPos);
        float F = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec2 dist2 = slope * 0.03 / (1.0 + dist * 0.015);
        vec2 ruv = vRefl.xy / vRefl.w + dist2;
        vec3 refl = texture2D(tRefl, ruv).rgb;
        if (reflAltMix > 0.0) refl = mix(refl, texture2D(tReflAlt, vReflAlt.xy / vReflAlt.w + dist2).rgb, reflAltMix);
        if (termMix > 0.0) {
          vec3 tc = texture2D(tTerm, suv + slope * 0.03 * termDistort).rgb;
          refl = mix(refl, tc, termMix);
          F = mix(F, 1.0, termMix);
        }
        refl *= reflectivity;
        // refraction through the water body
        vec2 tuv = suv + slope * 0.02 * clamp(thick, 0.0, 4.0) / (1.0 + dist * 0.05);
        float tz = linDepth(texture2D(tDepth, tuv).x);
        if (tz < waterZ) tuv = suv;
        vec3 under = texture2D(tOpaque, tuv).rgb;
        float absorb = mix(1.6, 0.06, clarity);
        float tr = exp(-thick * absorb);
        vec3 body = mix(deepCol, waterCol, exp(-thick * 0.4));
        vec3 refr = mix(body * (0.4 + 0.6 * uSunCol * 0.25), under, tr);
        vec3 col = mix(refr, refl, F * mix(1.0, 0.85, clarity));
        // sun glitter
        vec3 H = normalize(uSunDir + V);
        float spec = pow(max(dot(N, H), 0.0), 900.0) * 60.0 + pow(max(dot(N, H), 0.0), 90.0) * 0.6;
        col += uSunCol * spec * sunGlint * step(0.0, uSunDir.y);
        // the river forgets: no reflection, no depth, only a pale still surface
        col = mix(col, blankCol, blank);
        col = applyAtmos(col, vWPos);
        gl_FragColor = vec4(col, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  // the river: x -35.3 .. -5.95 (blender), y -420..420
  const g = new THREE.PlaneGeometry(33.1, 840, 1, 1);
  g.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, mat);
  mesh.position.set((-39.05 - 5.95) / 2, 0, 0);
  mesh.frustumCulled = false;
  return mesh;
}

// ------------------------------------------------------------------- load world
export async function loadWorld(renderer, opts = {}) {
  const [gltf, mats, layout, lighting, bakeIndex] = await Promise.all([
    new GLTFLoader().loadAsync(ASSETS + 'world.glb'),
    fetch(ASSETS + 'materials.json').then(r => r.json()),
    fetch(ASSETS + 'layout.json').then(r => r.json()),
    fetch(ASSETS + 'lighting.json').then(r => r.json()),
    fetch(ASSETS + 'bake/index.json').then(r => r.json()),
  ]);
  const rgbe = new RGBELoader();
  const skyTex = {};
  for (const st of ['dusk', 'morning', 'dawn', 'night']) {
    const t = await rgbe.loadAsync(ASSETS + `sky_${st}.hdr`);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
    skyTex[st] = t;
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = {};
  for (const st in skyTex) envTex[st] = pmrem.fromEquirectangular(skyTex[st]).texture;

  const scene = new THREE.Scene();
  const W = { scene, layout, lighting, bakeIndex, skyTex, envTex, groups: {}, dyn: {}, baked: [], mats };

  // lightmaps: one texture per (group, state), loaded lazily
  const lmCache = {};
  W.lm = (group, state) => {
    const k = group + '/' + state;
    if (!lmCache[k]) {
      const e = bakeIndex[group] && bakeIndex[group][state];
      if (!e) {
        if (state !== 'dusk') return W.lm(group, 'dusk');
        // not baked yet: neutral grey (encoded) so previews still work
        const d = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255]), 1, 1); d.needsUpdate = true; d.channel = 1;
        return (lmCache[k] = d);
      }
      const t = texLoader.load(ASSETS + 'bake/' + e.file);
      t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.channel = 1;
      t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
      lmCache[k] = t;
    }
    return lmCache[k];
  };

  const BAKED = ['room', 'furn', 'bldg', 'station', 'land'];
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const gname = (o.parent && o.parent.type === 'Group' && o.parent !== gltf.scene) ? o.parent.name : o.name;
    o.userData.group = gname;
  });
  const meshes = [];
  gltf.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
  for (const o of meshes) {
    const g = o.userData.group;
    const mname = o.material.name;
    const spec = mats[mname] || { col: [1, 0, 1] };
    if (BAKED.includes(g)) {
      const m = makeBaked(spec, mname, W.lm(g, 'dusk'), W.lm(g, 'dusk'));
      m.userData.group = g;
      o.material = m;
      W.baked.push(m);
    } else if (g === 'glass' || g === 'sash_glass') {
      o.material = W.glassMat || (W.glassMat = makeGlass());
      o.renderOrder = 5;
    } else {
      o.material = makeDynamic(spec);
    }
    (W.groups[g] = W.groups[g] || []).push(o);
  }
  // hoist everything into our scene with world transforms
  const root = gltf.scene;
  scene.add(root);
  root.updateMatrixWorld(true);
  W.root = root;
  const node = (n) => root.getObjectByName(n);
  for (const n of ['sash', 'sash_glass', 'hand_h', 'hand_m', 'hand_s', 'key', 'letter', 'letter_sheet', 'curtain_0', 'curtain_1', 'curtain_2', 'curtain_3', 'curtain_4', 'curtain_5', 'bed', 'far'])
    W.dyn[n] = node(n);

  // place dynamic objects (they were built at local origins)
  const L = layout;
  const sashPivot = new THREE.Group();
  sashPivot.position.copy(B(L.sash.x, L.sash.y, L.sash.z));
  scene.add(sashPivot);
  for (const n of ['sash', 'sash_glass']) if (W.dyn[n]) { sashPivot.add(W.dyn[n]); W.dyn[n].position.set(0, 0, 0); }
  W.sashPivot = sashPivot;
  const clockPivots = {};
  for (const [k, pos] of [['hero', L.hero_clock]]) {
    const piv = new THREE.Group(); piv.position.copy(B(...pos)); scene.add(piv);
    for (const h of ['hand_h', 'hand_m', 'hand_s']) { const m = W.dyn[h]; if (m) { piv.add(m); m.position.set(0, 0, -0.004 * (['hand_h', 'hand_m', 'hand_s'].indexOf(h) + 1)); } }
    clockPivots[k] = piv;
  }
  // station clock: copies of the hands on both faces
  const sc = L.station.clock;
  for (const side of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.copy(B(sc[0] + side * 0.042, sc[1], sc[2]));
    piv.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    for (const h of ['hand_h', 'hand_m', 'hand_s']) { const m = W.dyn[h].clone(); m.scale.setScalar(1.6); piv.add(m); m.position.set(0, 0, 0.004 * (['hand_h', 'hand_m', 'hand_s'].indexOf(h) + 1)); }
    scene.add(piv); clockPivots['station' + side] = piv;
  }
  W.clockPivots = clockPivots;
  if (W.dyn.key) { W.dyn.key.position.copy(B(...L.key)); W.dyn.key.rotation.y = 0.6; }
  if (W.dyn.letter) { W.dyn.letter.position.copy(B(...L.letter)); W.dyn.letter.rotation.y = 0.25; }
  if (W.dyn.letter_sheet) { W.dyn.letter_sheet.position.copy(B(L.letter[0] + 0.05, L.letter[1] - 0.12, L.letter[2])); W.dyn.letter_sheet.rotation.y = -0.15; }
  for (let i = 0; i < 6; i++) {
    const c = W.dyn['curtain_' + i];
    if (!c) continue;
    c.position.copy(B(...L.curtains[i]));
    c.geometry.userData.rest = c.geometry.attributes.position.array.slice();
  }

  // sky, water, lights
  W.sky = makeSky(skyTex); scene.add(W.sky);
  const nA = loadTex('tex/water_nrm.png', false), nB = loadTex('tex/water2_nrm.png', false);
  W.water = makeWater(nA, nB); scene.add(W.water);
  W.sun = new THREE.DirectionalLight(0xffffff, 0);
  W.sun.castShadow = false;
  scene.add(W.sun); scene.add(W.sun.target);
  W.hemi = new THREE.HemisphereLight(0xbfd4ff, 0x40382c, 0.3);
  scene.add(W.hemi);

  // bed of the river (lit in real time, with caustics and the drowned running track)
  if (W.dyn.bed) {
    W.dyn.bed.traverse((o) => { if (o.isMesh) o.material = makeBed(); });
  }
  W.pmrem = pmrem;
  return W;
}

function makeGlass() {
  const m = new THREE.ShaderMaterial({
    uniforms: Object.assign({ envMap: { value: null }, dirt: { value: 0.05 }, tint: { value: new THREE.Color(0.55, 0.62, 0.6) }, lit: { value: 0 },
      rain: { value: 0 }, rainBox: { value: new THREE.Vector4(-4.5, -2.1, 1.9, 4.0) } }, U),
    vertexShader: `varying vec3 vN; varying vec3 vWPos; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vWPos=w.xyz; vN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`
      uniform samplerCube envMap; uniform float dirt; uniform vec3 tint; uniform float lit; uniform float rain; uniform vec4 rainBox; uniform float uTime; varying vec3 vN; varying vec3 vWPos;
      float rh(float n){ return fract(sin(n * 78.233) * 43758.5453); }
      ${ATMOS_GLSL}
      void main(){
        vec3 V = normalize(vWPos - cameraPosition);
        vec3 N = normalize(vN); if (dot(N, V) > 0.0) N = -N;
        float F = 0.04 + 0.96 * pow(1.0 - abs(dot(N, -V)), 5.0);
        vec3 r = reflect(V, N);
        vec3 env = textureCube(envMap, vec3(r.x, r.y, r.z)).rgb;
        vec3 c = env * F * 0.75 + tint * dirt * 0.12;
        float a = clamp(F * 0.75 + dirt, 0.0, 1.0);
        // rain on one window only, in the low sun (一场雨留给黄昏)
        if (rain > 0.0 && vWPos.z > rainBox.x && vWPos.z < rainBox.y && vWPos.y > rainBox.z && vWPos.y < rainBox.w && vWPos.x < -5.8) {
          vec2 q = vec2(vWPos.z * 46.0, vWPos.y);
          float col = floor(q.x); float fx = fract(q.x) - 0.5;
          float sp = 0.18 + rh(col) * 0.35, off = rh(col + 7.1);
          float head = rainBox.w - fract(uTime * sp + off) * (rainBox.w - rainBox.z + 0.6);
          float tail = clamp((vWPos.y - head) / (0.25 + rh(col + 3.3) * 0.9), 0.0, 1.0);
          float streak = (1.0 - smoothstep(0.04, 0.16, abs(fx + 0.12 * sin(vWPos.y * 9.0 + col)))) * step(head, vWPos.y) * (1.0 - tail) * step(0.45, rh(col + 1.9));
          vec2 dc = floor(vec2(vWPos.z * 70.0, vWPos.y * 55.0));
          vec2 df = fract(vec2(vWPos.z * 70.0, vWPos.y * 55.0)) - 0.5;
          float drops = (1.0 - smoothstep(0.12, 0.3, length(df))) * step(0.82, rh(dc.x * 13.0 + dc.y * 7.0));
          float w = clamp(streak * 0.9 + drops * 0.7, 0.0, 1.0) * rain;
          vec3 envR = textureCube(envMap, reflect(V, normalize(N + vec3(0.0, fx, 0.0)))).rgb;
          c += (envR * 0.6 + vec3(1.0, 0.85, 0.7) * 0.25) * w;
          a = clamp(a + w * 0.55, 0.0, 1.0);
        }
        // windows lit from inside (only ever seen in the river's reflection)
        float pane = 0.85 + 0.15 * sin(floor(vWPos.z * 0.42) * 12.9898 + floor(vWPos.y * 0.28) * 78.233);
        c = mix(c, vec3(1.0, 0.66, 0.34) * 2.2 * pane, lit * 0.9);
        a = mix(a, 1.0, lit * 0.9);
        gl_FragColor = vec4(c, a);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  return m;
}

function makeBed() {
  const m = new THREE.MeshStandardMaterial({ color: 0x5a4c3a, roughness: 1 });
  m.onBeforeCompile = (shader) => {
    patchAtmos(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        float bh(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.7); }
        float caus(vec2 p, float t){ float c = 0.0; for (int i = 0; i < 3; i++) { vec2 q = p * (1.3 + float(i) * 0.7) + vec2(t * 0.3, -t * 0.4) * (1.0 + float(i) * 0.3);
          c += pow(abs(sin(q.x + sin(q.y * 1.3 + t) ) * sin(q.y + sin(q.x * 1.1 - t * 0.8))), 6.0); } return c; }
        uniform float uTime;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 P = vWPos.xz; // three x = blender x
          float onTrack = step(vWPos.y, -1.68) * step(-1.72, vWPos.y) * step(-30.0, P.x) * step(P.x, -8.0) * step(-46.0, P.y) * step(P.y, 46.0);
          vec3 red = vec3(0.30, 0.07, 0.045);
          vec3 turf = vec3(0.07, 0.11, 0.045);
          vec3 c = P.x < -21.0 ? turf : red;
          float lx = P.x + 21.0;
          float lane = abs(fract(lx / 1.22 + 0.5) - 0.5) * 1.22;
          float line = (1.0 - smoothstep(0.025, 0.04, lane)) * step(-21.05, P.x) * step(P.x, -11.2);
          float start = (1.0 - smoothstep(0.03, 0.05, abs(P.y - 0.0))) * step(-21.0, P.x) * step(P.x, -11.24);
          c = mix(c, vec3(0.75, 0.75, 0.72), max(line, start) * 0.9);
          diffuseColor.rgb = mix(diffuseColor.rgb, c, onTrack);
        }`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        reflectedLight.directDiffuse *= 0.4 + 1.6 * caus(vWPos.xz * 0.9, uTime * 0.7);`);
    shader.uniforms.uTime = U.uTime;
  };
  m.customProgramCacheKey = () => 'bed';
  return m;
}

// ------------------------------------------------------------- lighting states
// Crossfade every baked material between the lightmaps of two states; sun/sky/fog follow.
export function setLighting(W, a, b = a, k = 0, look = {}) {
  for (const m of W.baked) {
    const g = m.userData.group;
    m.lightMap = W.lm(g, a);
    m.userData.lm2.value = W.lm(g, b);
  }
  U.uLmMix.value = k;
  const sa = W.lighting[a.replace('_nosun', '')], sb = W.lighting[b.replace('_nosun', '')];
  const da = new THREE.Vector3(...sa.dir), db = new THREE.Vector3(...sb.dir);
  const d = da.clone().lerp(db, k).normalize();
  // blender (x,y,z) -> three (x,z,-y)
  U.uSunDir.value.set(d.x, d.z, -d.y);
  const ca = new THREE.Color(...sa.sun_col).multiplyScalar(sa.sun), cb = new THREE.Color(...sb.sun_col).multiplyScalar(sb.sun);
  U.uSunCol.value.copy(ca.lerp(cb, k));
  const sky = W.sky.material.uniforms;
  const base = (s) => s.replace('_nosun', '');
  sky.skyA.value = W.skyTex[base(a)]; sky.skyB.value = W.skyTex[base(b)]; sky.skyMix.value = k;
  W.sun.position.copy(U.uSunDir.value).multiplyScalar(80);
  W.sun.color.copy(U.uSunCol.value).multiplyScalar(1 / Math.max(1e-3, Math.max(U.uSunCol.value.r, U.uSunCol.value.g, U.uSunCol.value.b)));
  W.sun.intensity = Math.max(U.uSunCol.value.r, U.uSunCol.value.g, U.uSunCol.value.b);
}

export function setEnv(W, tex) {
  W.scene.traverse(o => {
    if (!o.isMesh) return;
    const m = o.material;
    if (m && m.isMeshStandardMaterial) { m.envMap = tex; m.needsUpdate = true; }
  });
  if (W.glassMat) W.glassMat.uniforms.envMap.value = tex;
}

// Capture a cube map of the world from a point (for glass and glossy floors).
export function captureEnv(W, renderer, pos, size = 256) {
  const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const cc = new THREE.CubeCamera(0.1, 6000, rt);
  cc.position.copy(pos);
  const wv = W.water.visible; W.water.visible = false;
  const gl = (W.groups.glass || []).map(g => g.visible); (W.groups.glass || []).forEach(g => g.visible = false);
  cc.update(renderer, W.scene);
  W.water.visible = wv; (W.groups.glass || []).forEach((g, i) => g.visible = gl[i]);
  return rt.texture;
}
