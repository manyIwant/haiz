// The remembered light: a photograph projected back onto the place it was taken.
//
// A photograph is the light that once fell through a lens. Here every surface of the world can
// receive that light again from the photographer's position: each fragment asks the projector
// (the photographer's camera) whether it was in the picture, whether something nearer stood in front
// of it (a depth map rendered from the photographer's eye), and how closely the visitor's line of
// sight agrees with the photographer's. Standing where they stood, the picture is reproduced; a
// step away, it stays on the walls it fell on and its disagreements with the model become visible.
//
// One set of uniforms is shared by every patched material; the projector is one camera at a time.
import * as THREE from 'three';

export const HZ = {
  uHzVP: { value: new THREE.Matrix4() },
  uHzEye: { value: new THREE.Vector3() },
  uHzPhoto: { value: null },
  uHzDepth: { value: null },
  uHzCrop: { value: new THREE.Vector4(0, 0, 1, 1) },
  uHzNF: { value: new THREE.Vector2(0.3, 400) },
  uHzAmt: { value: 0 },        // the station's presence 0..1
  uHzDev: { value: 0 },        // development front, from the picture's centre outwards (0..1.2)
  uHzLinger: { value: 0 },     // how much stays on the walls when seen from elsewhere
  uHzAspect: { value: 1.5 },
  uHzTime: { value: 0 },
};

const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
blank.needsUpdate = true;
HZ.uHzPhoto.value = blank;
HZ.uHzDepth.value = blank;

const VERT_DECL = 'varying vec3 vHzW;';
const VERT_BODY = /* glsl */`
{
  vec4 hzP = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  hzP = instanceMatrix * hzP;
  #endif
  vHzW = (modelMatrix * hzP).xyz;
}`;

export const FRAG_DECL = /* glsl */`
uniform mat4 uHzVP; uniform vec3 uHzEye; uniform sampler2D uHzPhoto; uniform sampler2D uHzDepth; uniform vec4 uHzCrop;
uniform vec2 uHzNF; uniform float uHzAmt; uniform float uHzDev; uniform float uHzLinger; uniform float uHzAspect; uniform float uHzTime;
float hzHash(vec2 p){ p = fract(p * vec2(443.8975, 397.2973)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
float hzLin(float d){ float z = d * 2.0 - 1.0; return 2.0 * uHzNF.x * uHzNF.y / (uHzNF.y + uHzNF.x - z * (uHzNF.y - uHzNF.x)); }
// returns rgb = the photograph's colour (display space), a = how much of it this fragment shows
vec4 hzMemory(vec3 wp, vec3 eye, bool sky){
  vec4 pc = uHzVP * vec4(wp, 1.0);
  if (pc.w <= 0.0) return vec4(0.0);
  vec3 ndc = pc.xyz / pc.w;
  vec2 uv = ndc.xy * 0.5 + 0.5;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
  float vis = 1.0;
  if (!sky) {
    float dist = hzLin(ndc.z * 0.5 + 0.5);
    float occ = hzLin(texture2D(uHzDepth, uv).r);
    vis = 1.0 - smoothstep(0.25 + dist * 0.025, 0.6 + dist * 0.05, dist - occ);
  } else {
    vis = step(0.99999, texture2D(uHzDepth, uv).r);          // only where the photographer saw sky
  }
  // development: silver comes up from the middle of the print, grain by grain
  vec2 c = (uv - 0.5) * vec2(uHzAspect, 1.0);
  float r = length(c) / (0.5 * length(vec2(uHzAspect, 1.0)));
  float grain = hzHash(floor(uv * vec2(uHzAspect, 1.0) * 420.0));
  float dev = smoothstep(r - 0.1, r + 0.02, uHzDev + (grain - 0.5) * 0.09);
  // the print's edge: a soft, slightly uneven border like light falling off a projector gate
  float e = min(min(uv.x, 1.0 - uv.x) * uHzAspect, min(uv.y, 1.0 - uv.y));
  float edge = smoothstep(0.0, 0.035 + 0.02 * hzHash(floor(uv * 37.0)), e);
  // agreement between the visitor's line of sight and the photographer's
  vec3 a = normalize(eye - wp), b = normalize(uHzEye - wp);
  float agree = sky ? smoothstep(0.9, 0.999, dot(normalize(wp - eye), normalize(wp - uHzEye))) : smoothstep(0.86, 0.997, dot(a, b));
  // light that arrived at a grazing angle smears across the surface: let it fall off there
  float facing = 1.0;
  if (!sky) { vec3 n = normalize(cross(dFdx(wp), dFdy(wp))); facing = smoothstep(0.08, 0.35, abs(dot(n, b))); }
  float k = uHzAmt * dev * edge * vis * mix(uHzLinger * facing, 1.0, agree);
  vec3 photo = texture2D(uHzPhoto, uHzCrop.xy + uv * uHzCrop.zw).rgb;
  // where it lingers, the picture loses its colour first (an old print in daylight)
  float l = dot(photo, vec3(0.3, 0.59, 0.11));
  photo = mix(vec3(l) * vec3(1.04, 1.0, 0.92), photo, 0.35 + 0.65 * agree);
  return vec4(photo, k);
}`;
const FRAG_BODY = /* glsl */`
{
  vec4 hzM = hzMemory(vHzW, cameraPosition, false);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, hzM.rgb, hzM.a);
}`;

/** Patch one material (keeps any onBeforeCompile it already has). */
export function patchMaterial(m) {
  if (!m || m.userData.hzPatched || !(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshBasicMaterial)) return;
  m.userData.hzPatched = true;
  const prev = m.onBeforeCompile;
  const prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = function (sh, r) {
    if (prev) prev.call(this, sh, r);
    Object.assign(sh.uniforms, HZ);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_DECL)
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_BODY);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHzW;\n' + FRAG_DECL)
      .replace('#include <fog_fragment>', '#include <fog_fragment>\n' + FRAG_BODY);
  };
  m.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + '|hz'; };
  m.needsUpdate = true;
}

/** Patch every mesh material under root (depth materials are left alone). */
export function patchMemory(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) patchMaterial(m);
  });
}

/** The sky is a ShaderMaterial: where the photographer saw sky, the photograph's sky comes back too. */
export function patchSky(sky) {
  const m = sky.material;
  if (m.userData.hzPatched) return;
  m.userData.hzPatched = true;
  Object.assign(m.uniforms, HZ);
  m.fragmentShader = m.fragmentShader
    .replace('varying vec3 vDir;', 'varying vec3 vDir;\n' + FRAG_DECL)
    .replace(/gl_FragColor = vec4\(col, 1\.0\);\s*\}$/, `gl_FragColor = vec4(col, 1.0);
  vec4 hzM = hzMemory(uHzEye + normalize(vDir) * 2000.0, cameraPosition, true);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, hzM.rgb, hzM.a);
}`);
  m.needsUpdate = true;
}
