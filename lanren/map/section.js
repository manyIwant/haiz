// The campus in three dimensions, inside V4's own world.
//
// One model (campus3d.js), three readings of it, all in the same renderer as the
// tree and the water:
//   site plan the buildings wait whole beneath the plan the water drew; their
//             footprints are the plan's own (same features).
//   card      building by building each rises out of its footprint as a whole
//             volume, walls and roof, a white card model with ink edges.
//   real      a front that starts at the tree's roots turns card into material:
//             the sun, its shadows, glass, tile, the campus ground and its trees.
// On request one building can be cut at a storey (its floor plan, poché in ink).
// Nothing here is a second scene or a picture: the plan and the campus are one model.
//
// After flat-to-3d 02 (ink and material mixed per pixel by world position) and
// 06 (one parts list, two worlds, a front expanding from a point), MIT; HAIZ's
// own implementation, cut horizontally like Casa Serra rather than vertically.
import * as THREE from 'three';
import { buildCampus, MATERIALS } from './campus3d.js';
import { invert, hex } from './tone.js';
import { MAP_GRADE, CAMPUS_UNIFORMS, campusGLSL, PAL_INDEX, PAL_SIZE } from './layer.js';
import { GROUND_Y } from './geo.js';

// ---------------------------------------------------------------- colour
// the drawing, as it should look on screen (inverted through the film's grade like the plan)
const INK = {
  floor: '#f2ede2', top: '#e3dccd', roof: '#d8cfbd', wall: '#e2dbcd', glass: '#a9bcbd', glassFace: '#c3d0cf',
  poche: '#27322c', pocheGlass: '#7f9799', line: '#3c4a41', sel: '#ecd7a6', realPoche: '#3b3934'
};
// the campus ground in material: the plan's palette keys, read as what they are
const REAL_GROUND = {
  paper: '#8c8a72', road: '#bab4a7', roadEdge: '#8e887c', bld: '#a39d91', bldTall: '#a39d91', ink: '#5f5c55', gate: '#a39d91',
  garden: '#748d58', gardenEdge: '#8d8676', botanic: '#5a7046', canopy: '#4d6e3a', canopyDark: '#3c5a2f', plot: '#6a6b4a',
  pond: '#4c7277', track: '#a65240', infield: '#4f7449', lineW: '#ece9df', corr: '#b6b0a4', pavilion: '#a7a39b', rock: '#a9a59c',
  sel: '#e4d3a8', halo: '#efe0b9', inkWater: '#1d4446', inkLight: '#a9cfc8'
};
const lin = (h) => new THREE.Color(h);                          // sRGB hex → linear albedo
const screen = (h) => new THREE.Vector3(...invert(hex(h), MAP_GRADE));   // on-screen colour → scene-linear

const NOISE = /* glsl */`
float wh(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float wn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wh(i), wh(i + vec2(1, 0)), f.x), mix(wh(i + vec2(0, 1)), wh(i + vec2(1, 1)), f.x), f.y); }
float hzIGN(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
`;
// the front from the roots, and the campus's own sun shadow (shared by every material here)
const SHARED = /* glsl */`
uniform vec3 uSweepC; uniform float uSweepR; uniform float uSweepW; uniform float uSweepGlow; uniform vec3 uSweepCol; uniform vec3 uBounce;
uniform sampler2DShadow uCSMap; uniform mat4 uCSMat; uniform float uCSOn; uniform vec2 uCSTexel; uniform float uCSBias;
float hzRealAt(vec3 p){ return 1.0 - smoothstep(uSweepR - uSweepW, uSweepR, distance(p, uSweepC)); }
float hzSeam(vec3 p){
  float d = distance(p, uSweepC) - (uSweepR - uSweepW * 0.55);
  return uSweepGlow * (exp(-d * d / (uSweepW * uSweepW * 0.05)) * 0.8 + 0.22 * exp(-d * d / (uSweepW * uSweepW * 0.9)));
}
float hzCampusShadow(vec3 wp, vec3 n){
  if (uCSOn <= 0.0) return 1.0;
  vec4 sc = uCSMat * vec4(wp + n * 0.18, 1.0);
  vec3 c = sc.xyz / sc.w * 0.5 + 0.5;
  if (c.x <= 0.002 || c.y <= 0.002 || c.x >= 0.998 || c.y >= 0.998 || c.z >= 1.0) return 1.0;
  c.z -= uCSBias;
  float a = hzIGN(gl_FragCoord.xy) * 6.2831853, s = 0.0;
  for (int i = 0; i < 8; i++) {
    float r = sqrt((float(i) + 0.5) / 8.0), th = float(i) * 2.39996323 + a;
    s += texture(uCSMap, vec3(c.xy + vec2(cos(th), sin(th)) * r * uCSTexel * 1.7, c.z));
  }
  return mix(1.0, s / 8.0, uCSOn);
}
`;

// Every building rises out of the plan along its own footprint: it is drawn translated down by
// its lift (0 when it stands) and nothing below the ground plane shows, so what is seen is
// always the whole top of the building: roof and walls, never an opened storey. An optional
// storey cut (one building, on request) is measured in the building's own frame, so it rises with it.
const LIFT = /* glsl */`
  float hzBi = floor(aInfo.y * 255.0 + 0.5);
  vHYo = transformed.y;
  transformed.y += uLift[int(hzBi + 0.5)];`;
const CLIP = `if (vHYo > vCutY || vHW.y < ${GROUND_Y.toFixed(3)} - 0.01) discard;`;

// the drawing's lines and card tones (shared by the ink-only and the lit material)
const INK_FNS = /* glsl */`
float hzEdgeLine(vec4 e){
  vec3 fb = max(fwidth(e.xyz), vec3(1e-5));
  vec3 rb = e.xyz / fb;
  vec2 rq = min(e.xy, 1.0 - e.xy) / fb.xy;
  float d = e.w > 0.5 ? min(rb.x, min(rb.y, rb.z)) : min(rq.x, rq.y);
  return 1.0 - smoothstep(0.45, 1.25, d);
}
vec3 hzInkColour(int m, vec3 n, float flag){
  vec3 c;
  if (m == 6) c = uInkGlassFace;
  else if (n.y > 0.6) c = (m == 7 || m == 8 || m == 9 || m == 13) ? uInkRoof : (m == 0 || m == 11) ? uInkFloor : uInkTop;
  else if (n.y < -0.6) c = uInkWall * 0.8;
  else c = uInkWall * (0.83 + 0.15 * max(0.0, dot(normalize(n.xz + vec2(1e-5)), uInkLight)));
  if (flag > 1.5 && n.y > 0.6) c = mix(c, uInkSel, 0.85);
  else if (flag > 0.5) c *= 1.035;
  return c;
}
`;

// ---------------------------------------------------------------- the buildings' material
function buildingMaterial(U, NB) {
  const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9, metalness: 0 });
  const NM = MATERIALS.length;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 aEdge; attribute vec2 aInfo;
uniform float uCut[${NB}]; uniform float uLift[${NB}];
varying vec3 vHW; varying vec3 vHN; varying vec4 vEdge; varying float vMat; varying float vBld; varying float vCutY; varying float vHYo;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
${LIFT}`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
  vHW = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vHN = normalize(mat3(modelMatrix) * objectNormal);
  vMat = floor(aInfo.x * 255.0 + 0.5); vBld = hzBi;
  vCutY = uCut[int(vBld + 0.5)];
  vEdge = aEdge;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
${NOISE}
${SHARED}
uniform vec3 uAlb[${NM}]; uniform float uRgh[${NM}]; uniform float uMtl[${NM}];
uniform float uFlag[${NB}]; uniform float uDimB;
uniform vec3 uInkFloor, uInkTop, uInkRoof, uInkWall, uInkGlass, uInkGlassFace, uInkPoche, uInkPocheGlass, uInkLine, uInkSel, uRealPoche;
uniform vec2 uInkLight;
varying vec3 vHW; varying vec3 vHN; varying vec4 vEdge; varying float vMat; varying float vBld; varying float vCutY; varying float vHYo;
${INK_FNS}
// a little of each material's grain, in world units (no textures)
float hzTex(vec3 p, vec3 n, int m){
  vec2 uv = abs(n.y) > 0.5 ? p.xz : (abs(n.x) > 0.5 ? p.zy : p.xy);
  if (m == 2 || m == 12) {   // stone cladding: courses and joints
    float row = floor(p.y / 0.6), u = uv.x + mod(row, 2.0) * 0.45;
    float j = smoothstep(0.0, 0.04, fract(p.y / 0.6)) * smoothstep(0.0, 0.025, fract(u / 0.9));
    return mix(0.78, 1.0 + (wh(vec2(floor(u / 0.9), row)) - 0.5) * 0.12, j);
  }
  if (m == 7 || m == 8) {    // tile courses down the slope
    float c = smoothstep(0.0, 0.18, fract(p.y * 3.6)) * (0.9 + 0.1 * smoothstep(0.0, 0.1, fract((p.x + p.z) * 2.2)));
    return (0.86 + 0.14 * c) * (0.94 + 0.12 * wn(p.xz * 0.7));
  }
  if (m == 9) {   // flat roofs: membrane sheets with their seams, weathered unevenly
    vec2 sq = fract(p.xz / vec2(6.0, 2.0));
    float seam = smoothstep(0.0, 0.012, sq.y) * smoothstep(0.0, 0.004, sq.x);
    return (0.88 + 0.12 * wn(p.xz * 0.35)) * mix(0.9, 1.0, seam) + (wh(floor(p.xz * 9.0)) - 0.5) * 0.04;
  }
  if (m == 0 || m == 11) return 0.95 + (wh(floor(uv * 14.0)) - 0.5) * 0.05 + (wn(uv * 0.8) - 0.5) * 0.05;
  if (m == 6) return 0.8 + 0.4 * wh(floor(vec2(uv.x / 1.6, p.y / 1.2)));   // panes catch the sky differently
  if (m == 13) return 1.0;
  float g = 0.96 + (wn(uv * 1.3) - 0.5) * 0.06 + (wn(uv * 9.0) - 0.5) * 0.025;   // plaster, concrete
  // rain streaks down the walls of a humid coast, strongest under ledges
  if (abs(n.y) < 0.5) g *= 1.0 - 0.07 * smoothstep(0.55, 1.0, wn(vec2(uv.x * 2.6, p.y * 0.12))) * (0.6 + 0.4 * wn(vec2(uv.x * 0.7, 3.0)));
  return g;
}
float hzSunK = 1.0;`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  ${CLIP}
  int hzM = int(vMat + 0.5);
  float hzF = uFlag[int(vBld + 0.5)];
  float hzR = hzRealAt(vHW);
  if (!gl_FrontFacing) {
    // the cut: ink where it is drawing, a warm charcoal where it is building
    vec3 pc = hzM == 6 ? uInkPocheGlass : uInkPoche;
    gl_FragColor = vec4(mix(pc, hzM == 6 ? uInkPocheGlass * 0.6 : uRealPoche, hzR), 1.0);
    return;
  }
  hzSunK = hzCampusShadow(vHW, vHN);`)
      .replace('#include <color_fragment>', `diffuseColor.rgb = uAlb[hzM] * hzTex(vHW, vHN, hzM);
  // no two blocks were painted or weathered alike: a small, steady difference per building
  { float b = wh(vec2(vBld * 7.13, 3.7)); diffuseColor.rgb *= (hzM == 9 || hzM == 1 || hzM == 16) ? mix(vec3(0.9, 0.9, 0.92), vec3(1.05, 1.02, 0.97), b) : vec3(1.0); }`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  // shade on a sunny campus is not sky-blue: light comes back off the sunlit paving and walls
  reflectedLight.indirectDiffuse *= vec3(1.05, 1.0, 0.84);
  reflectedLight.indirectDiffuse += diffuseColor.rgb * uBounce * (0.6 + 0.4 * (1.0 - hzSunK));`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = uRgh[hzM];')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = uMtl[hzM];')
      .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin
        .replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= hzSunK;'))
      .replace('#include <opaque_fragment>', `{
  float hzL = hzEdgeLine(vEdge);
  vec3 ink = mix(hzInkColour(hzM, vHN, hzF), uInkLine, hzL * 0.72);
  vec3 lit = outgoingLight;
  if (hzM == 6) lit = mix(lit, uAlb[19] * 0.35, hzL * 0.45);    // window frames
  // contact: walls darken towards the ground they stand in
  if (vHN.y < 0.5) lit *= mix(0.62, 1.0, smoothstep(0.0, 2.6, vHW.y - ${GROUND_Y.toFixed(2)}));
  lit *= 1.0 - uDimB * (hzF > 1.5 ? 0.0 : 0.16);
  if (hzF > 1.5) lit += uInkSel * hzL * 0.18;
  outgoingLight = mix(ink, lit, hzR) + uSweepCol * hzSeam(vHW);
}
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'haiz-campus-building2-' + NB;
  return m;
}

/** the drawing alone (no light, no shadow): what the plan needs, at a fraction of the cost on phones */
function inkMaterial(U, NB) {
  const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 aEdge; attribute vec2 aInfo;
uniform float uCut[${NB}]; uniform float uLift[${NB}];
varying vec3 vHW; varying vec3 vHN; varying vec4 vEdge; varying float vMat; varying float vBld; varying float vCutY; varying float vHYo;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
${LIFT}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
  vHW = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vHN = normalize(mat3(modelMatrix) * normal);
  vMat = floor(aInfo.x * 255.0 + 0.5); vBld = hzBi;
  vCutY = uCut[int(vBld + 0.5)];
  vEdge = aEdge;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uFlag[${NB}];
uniform vec3 uInkFloor, uInkTop, uInkRoof, uInkWall, uInkGlass, uInkGlassFace, uInkPoche, uInkPocheGlass, uInkLine, uInkSel;
uniform vec2 uInkLight;
varying vec3 vHW; varying vec3 vHN; varying vec4 vEdge; varying float vMat; varying float vBld; varying float vCutY; varying float vHYo;
${INK_FNS}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  ${CLIP}
  int hzM = int(vMat + 0.5);
  if (!gl_FrontFacing) { gl_FragColor = vec4(hzM == 6 ? uInkPocheGlass : uInkPoche, 1.0); return; }`)
      .replace('#include <color_fragment>', 'diffuseColor.rgb = mix(hzInkColour(hzM, vHN, uFlag[int(vBld + 0.5)]), uInkLine, hzEdgeLine(vEdge) * 0.72);');
  };
  m.customProgramCacheKey = () => 'haiz-campus-ink-' + NB;
  return m;
}

/** depth-only material for the campus sun: same cut, same growth */
function buildingDepth(U, NB) {
  const m = new THREE.MeshDepthMaterial({ side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nattribute vec2 aInfo; uniform float uCut[${NB}]; uniform float uLift[${NB}]; varying vec3 vHW; varying float vCutY; varying float vHYo;`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + LIFT)
      .replace('#include <project_vertex>', `#include <project_vertex>\n  vHW = (modelMatrix * vec4(transformed, 1.0)).xyz; vCutY = uCut[int(hzBi + 0.5)];`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHW; varying float vCutY; varying float vHYo;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n  ' + CLIP);
  };
  m.customProgramCacheKey = () => 'haiz-campus-building-depth-' + NB;
  return m;
}

// ---------------------------------------------------------------- the ground in material
function groundMaterial(U, layerU) {
  // (seen from a person's height, ground in a building's shade lit by the sky alone read as water:
  // with no bounce light in the scene, the sky's share is kept lower so shaded paving stays paving)
  const m = new THREE.MeshStandardMaterial({ roughness: 0.93, metalness: 0, envMapIntensity: 0.55 });
  m.onBeforeCompile = (sh) => {
    // the plan's own feature data, canopies off, no drawn shadows: the light does that here
    Object.assign(sh.uniforms, U, {
      uFeat: layerU.uFeat, uFeatN: layerU.uFeatN, uFeatSplit: layerU.uFeatSplit, uCanopy: layerU.uCanopy, uSheet: layerU.uSheet,
      uShadowDir: layerU.uShadowDir, uSelect: layerU.uSelect, uHover: layerU.uHover, uHoverFeat: layerU.uHoverFeat, uDim: layerU.uDim,
      uCanopyK: { value: 0 }, uBldShadowK: { value: 0 }, uContactK: { value: 1 }
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vHW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
${NOISE}
${SHARED}
${CAMPUS_UNIFORMS}
uniform vec3 uPalR[${PAL_SIZE}];
varying vec3 vHW;
${campusGLSL('uPalR')}
// the real ponds stay V4's water
float hzPond(vec2 q){
  float best = 1e5;
  for (int i = 0; i < 64; i++) {
    if (i >= uFeatN) break;
    vec4 B = texelFetch(uFeat, ivec2(i * 3 + 1, 0), 0);
    if (int(B.x + 0.5) != 5) continue;
    vec4 A = texelFetch(uFeat, ivec2(i * 3, 0), 0);
    vec2 d = q - A.xy; float cs = cos(B.y), sn = sin(B.y);
    vec2 l = vec2(d.x * cs - d.y * sn, d.x * sn + d.y * cs);
    best = min(best, hzRBox(l, A.zw, min(A.z, A.w) * 0.35));
  }
  return best;
}
float hzSunK = 1.0;`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  vec2 hzQ = vHW.xz;
  float hzPx = length(fwidth(hzQ));
  float hzR = hzRealAt(vHW);
  // the front dissolves the drawing into ground; beyond it the water's plan shows
  if (hzR < 0.02 + 0.96 * hzIGN(gl_FragCoord.xy + 13.0)) discard;
  vec2 hzE = min(hzQ - uSheet.xy, uSheet.zw - hzQ);
  if (min(hzE.x, hzE.y) + (wn(hzQ * 0.05) - 0.5) * 16.0 < 7.0) discard;
  if (hzPond(hzQ) < 0.3) discard;
  hzSunK = hzCampusShadow(vHW, vec3(0.0, 1.0, 0.0));`)
      .replace('#include <color_fragment>', `{
  float lines;
  vec3 g = hzCampus(hzQ, max(hzPx * 0.7, 0.02), hzPx, vec3(0.0), lines);
  // grain: lawns mottle, paving speckles (both fade where a pixel covers metres)
  float fine = 1.0 - smoothstep(0.08, 0.6, hzPx);
  g *= 0.93 + 0.12 * wn(hzQ * 0.21) + (wn(hzQ * 2.3) - 0.5) * 0.1 * fine + (wh(floor(hzQ * 6.0)) - 0.5) * 0.06 * fine;
  // close by, paving is laid stone: 0.8 × 0.4 m slabs in running bond, each its own tone, the joints
  // darker; lawns are left as lawn (seen from 1.6 m, a flat colour reads as plastic, not granite)
  {
    float lawn = smoothstep(0.0, 0.035, g.g - max(g.r, g.b) * 1.02);
    float near = 1.0 - smoothstep(0.012, 0.09, hzPx);
    if (near > 0.0) {
      vec2 sl = hzQ / vec2(0.8, 0.4);
      sl.x += mod(floor(sl.y), 2.0) * 0.5;
      vec2 id = floor(sl), f = fract(sl);
      vec2 jw = vec2(0.012 / 0.8, 0.012 / 0.4) + fwidth(sl) * 0.8;
      float joint = max(1.0 - smoothstep(0.0, jw.x, min(f.x, 1.0 - f.x)), 1.0 - smoothstep(0.0, jw.y, min(f.y, 1.0 - f.y)));
      float k = near * (1.0 - lawn);
      g *= 1.0 + (wh(id + 7.0) - 0.5) * 0.11 * k;
      g *= 1.0 - 0.2 * joint * k;
    }
  }
  diffuseColor.rgb = g;
}`)
      .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin
        .replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= hzSunK;'))
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  // shade on a sunny campus is not sky-blue: light comes back off the sunlit paving and walls
  reflectedLight.indirectDiffuse *= vec3(1.05, 1.0, 0.84);
  reflectedLight.indirectDiffuse += diffuseColor.rgb * uBounce * (0.6 + 0.4 * (1.0 - hzSunK));`)
      .replace('#include <opaque_fragment>', 'outgoingLight += uSweepCol * hzSeam(vHW);\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'haiz-campus-ground3';
  return m;
}

// ---------------------------------------------------------------- the campus's trees
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function treeGeometry(kind) {
  const parts = [];
  const add = (g, leaf) => { if (g.index) g = g.toNonIndexed(); g.setAttribute('aLeaf', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(leaf), 1)); parts.push(g); };
  const r = mulberry(kind === 'palm' ? 7 : 3);
  if (kind === 'palm') {
    // canonical palm: 12 m, fronds ~2.4 m out
    add(new THREE.CylinderGeometry(0.15, 0.24, 11.2, 7, 4).translate(0, 5.6, 0), 0);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + r() * 0.3, len = 2.6 + r() * 0.7;
      const g = new THREE.PlaneGeometry(len, 0.55, 4, 1);
      const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) { const x = p.getX(k) + len / 2; p.setXYZ(k, x, -0.12 * x * x + 0.25 * x, p.getY(k) * (1 - x / (len * 1.15))); }
      g.rotateY(-a).translate(0, 11.2, 0);
      add(g, 1);
    }
  } else {
    // canonical broadleaf: 8 m, crown radius ~3.6 m (the walk's sizes); lumpy clusters, not a ball
    add(new THREE.CylinderGeometry(0.14, 0.26, 5.0, 7, 2).translate(0, 2.5, 0), 0);
    const blobs = [[0, 5.7, 0, 2.6], [1.5, 5.1, 0.7, 1.9], [-1.4, 5.3, -0.8, 2.0], [0.4, 6.7, -0.4, 1.8], [-0.6, 4.8, 1.4, 1.6], [1.0, 4.9, -1.5, 1.5]];
    for (const [x, y, z, s] of blobs) {
      const g = new THREE.IcosahedronGeometry(s, 2);
      const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const vx = p.getX(k), vy = p.getY(k), vz = p.getZ(k), n = 1 + 0.16 * Math.sin(vx * 2.1 + vz * 1.7) * Math.cos(vy * 2.3 - vx);
        p.setXYZ(k, vx * n, vy * n * 0.82, vz * n);
      }
      g.computeVertexNormals();
      add(g.translate(x, y, z), 1);
    }
  }
  const out = new THREE.BufferGeometry();
  const merge = (name, size) => { const arr = new Float32Array(parts.reduce((s, g) => s + g.attributes[name].count * size, 0)); let o = 0; for (const g of parts) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; } out.setAttribute(name, new THREE.BufferAttribute(arr, size)); };
  merge('position', 3); merge('normal', 3); merge('aLeaf', 1);
  out.computeBoundingSphere();
  return out;
}
const GROW = /* glsl */`
  vec3 hzIP = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  float hzG = clamp((uSweepR - distance(hzIP, uSweepC) - 4.0) / 26.0, 0.0, 1.0);
  hzG = hzG * hzG * (3.0 - 2.0 * hzG);
  transformed *= hzG;`;
function treeMaterial(U, palm) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0, side: palm ? THREE.DoubleSide : THREE.FrontSide });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
uniform vec3 uSweepC; uniform float uSweepR;
attribute float aLeaf; varying float vLeaf; varying vec3 vHW; varying float vLy;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  vLeaf = aLeaf; vLy = position.y;
${GROW}`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
  vHW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
${NOISE}
${SHARED}
varying float vLeaf; varying vec3 vHW; varying float vLy;
float hzSunK = 1.0;`)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n  hzSunK = hzCampusShadow(vHW, vec3(0.0, 1.0, 0.0));')
      .replace('#include <color_fragment>', `#include <color_fragment>
  {
    // leaf mass: darker underneath and inside, a scatter of lighter leaves on top
    float lump = wn(vHW.xz * 1.7 + vHW.y * 0.9);
    float up = smoothstep(${palm ? '9.5, 12.5' : '3.8, 7.6'}, vLy);
    vec3 leaf = diffuseColor.rgb * (0.5 + 0.55 * up) * (0.82 + 0.36 * lump);
    vec3 bark = vec3(0.16, 0.12, 0.09);
    diffuseColor.rgb = mix(bark, leaf, vLeaf);
  }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  if (vLeaf > 0.5) normal = normalize(normal + (vec3(wn(vHW.xz * 2.1 + 3.0), wn(vHW.zy * 2.3), wn(vHW.xy * 1.9 + 7.0)) - 0.5) * 1.1);`)
      .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin
        .replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= hzSunK;'));
  };
  m.customProgramCacheKey = () => 'haiz-campus-tree-' + (palm ? 'palm' : 'leaf');
  return m;
}
function treeDepth(U, palm) {
  const m = new THREE.MeshDepthMaterial({ side: palm ? THREE.DoubleSide : THREE.FrontSide });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSweepC; uniform float uSweepR;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + GROW);
  };
  m.customProgramCacheKey = () => 'haiz-campus-tree-depth-' + (palm ? 'palm' : 'leaf');
  return m;
}
const TREE_TONE = { palm: '#5f7d3b', banyan: '#2f5a2c', chongyang: '#3d6532', terminalia: '#4f7a36', fengling: '#4c7a3a', kapok: '#557a3a',
  huoyan: '#4a6f30', hongdou: '#3e6634', botanic: '#43693a', shrub: '#4b7038', mixed: '#466c36' };
function createTrees(trees, U) {
  const out = [];
  for (const palm of [false, true]) {
    const list = trees.filter((t) => (t.kind === 'palm') === palm);
    if (!list.length) continue;
    const geo = treeGeometry(palm ? 'palm' : 'leaf');
    const mesh = new THREE.InstancedMesh(geo, treeMaterial(U, palm), list.length);
    const r = mulberry(palm ? 91 : 17), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), Pv = new THREE.Vector3(), col = new THREE.Color();
    list.forEach((t, i) => {
      const h = (t.h || 1) * (0.92 + r() * 0.16), sc = palm ? t.r / 2.4 : t.r / 3.6;
      Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI * 2);
      S.set(sc, h * (palm ? 1 : Math.min(1.25, 0.75 + sc * 0.3)), sc);
      Pv.set(t.x, GROUND_Y, t.z);
      mesh.setMatrixAt(i, M4.compose(Pv, Q, S));
      col.set(TREE_TONE[t.kind] || '#4b7038').multiplyScalar(0.92 + r() * 0.16);
      mesh.setColorAt(i, col);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    const depth = new THREE.InstancedMesh(geo, treeDepth(U, palm), list.length);
    depth.instanceMatrix = mesh.instanceMatrix;
    depth.frustumCulled = false;
    out.push({ mesh, depth });
  }
  return out;
}

// ---------------------------------------------------------------- the section
/**
 * @param world  V4's scene bundle (renderer, scene, sun, tier)
 * @param geo    geo.js buildGeo() (the plan's own data)
 * @param campus assets/walk/campus.json
 * @param layer  the plan layer (its feature uniforms are reused by the ground)
 */
export function createSection(world, geo, campus, layer) {
  const model = buildCampus(campus, geo.frame);
  const NB = model.buildings.length;
  const { renderer, scene } = world;
  const a = model.arrays;
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(a.position, 3));
  geom.setAttribute('normal', new THREE.BufferAttribute(a.normal, 3, true));
  geom.setAttribute('aEdge', new THREE.BufferAttribute(a.edge, 4, true));
  geom.setAttribute('aInfo', new THREE.BufferAttribute(a.info, 2, true));
  geom.setIndex(new THREE.BufferAttribute(a.index, 1));
  geom.computeBoundingSphere();

  // shadow target: depth only, compared in hardware (a 1-byte colour buffer the shader never reads)
  const SIZE = world.tier?.shadow >= 4096 ? 4096 : 2048;
  const depthTex = new THREE.DepthTexture(SIZE, SIZE, THREE.UnsignedIntType);
  depthTex.compareFunction = THREE.LessEqualCompare;
  depthTex.minFilter = depthTex.magFilter = THREE.LinearFilter;
  const shadowRT = new THREE.WebGLRenderTarget(SIZE, SIZE, { format: THREE.RedFormat, depthBuffer: true, depthTexture: depthTex });
  const shadowCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000);

  const cuts = new Float32Array(NB).fill(GROUND_Y + 1000);
  const lifts = Float32Array.from(model.buildings, (b) => -(b.top + 1));   // below the plan until asked to rise
  const flags = new Float32Array(NB);
  const sunXZ = new THREE.Vector2(-layer.shadowDir[0], -layer.shadowDir[1]).normalize();   // towards chapter 04's sun
  const U = {
    uCut: { value: cuts }, uLift: { value: lifts }, uFlag: { value: flags }, uDimB: { value: 0 },
    uSweepC: { value: new THREE.Vector3(0, GROUND_Y, 0) }, uSweepR: { value: 0 }, uSweepW: { value: 7 }, uSweepGlow: { value: 0 },
    uSweepCol: { value: new THREE.Vector3(...invert(hex('#f0c27a'), MAP_GRADE)).multiplyScalar(0.3) },
    uBounce: { value: new THREE.Vector3(0, 0, 0) },
    uCSMap: { value: depthTex }, uCSMat: { value: new THREE.Matrix4() }, uCSOn: { value: 0 }, uCSTexel: { value: new THREE.Vector2(1 / SIZE, 1 / SIZE) }, uCSBias: { value: 0.0005 },
    uAlb: { value: MATERIALS.map((m) => lin(m.albedo)) }, uRgh: { value: MATERIALS.map((m) => m.rough) }, uMtl: { value: MATERIALS.map((m) => m.metal) },
    uInkFloor: { value: screen(INK.floor) }, uInkTop: { value: screen(INK.top) }, uInkRoof: { value: screen(INK.roof) }, uInkWall: { value: screen(INK.wall) },
    uInkGlass: { value: screen(INK.glass) }, uInkGlassFace: { value: screen(INK.glassFace) }, uInkPoche: { value: screen(INK.poche) }, uInkPocheGlass: { value: screen(INK.pocheGlass) },
    uInkLine: { value: screen(INK.line) }, uInkSel: { value: screen(INK.sel) }, uRealPoche: { value: lin(INK.realPoche) }, uInkLight: { value: sunXZ },
    uPalR: { value: Array.from({ length: PAL_SIZE }, (_, i) => lin(REAL_GROUND[Object.keys(PAL_INDEX).find((k) => PAL_INDEX[k] === i)] || '#808080')) }
  };

  const group = new THREE.Group();
  group.name = 'campus-section';
  const litMat = buildingMaterial(U, NB), inkMat = inkMaterial(U, NB);
  const mesh = new THREE.Mesh(geom, inkMat);
  mesh.receiveShadow = true;   // V4's sun still throws the tree's shade on the nearest facades
  mesh.name = 'campus-buildings';
  group.add(mesh);
  const s = layer.sheet;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(s.x1 - s.x0, s.z1 - s.z0), groundMaterial(U, layer.uniforms));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((s.x0 + s.x1) / 2, GROUND_Y + 0.02, (s.z0 + s.z1) / 2);
  ground.receiveShadow = true;
  ground.renderOrder = -6;   // before the water: the plan underneath is not shaded where the ground covers it
  ground.name = 'campus-ground';
  group.add(ground);
  const trees = createTrees(geo.trees, U);
  for (const t of trees) group.add(t.mesh);
  group.visible = false;
  scene.add(group);

  // allocate the depth texture now: a shadow sampler bound to a texture that does not exist yet fails every draw
  { const prev = renderer.getRenderTarget(); renderer.setRenderTarget(shadowRT); renderer.clear(); renderer.setRenderTarget(prev); }
  const shadowScene = new THREE.Scene();
  const depthMesh = new THREE.Mesh(geom, buildingDepth(U, NB));
  depthMesh.frustumCulled = false;
  shadowScene.add(depthMesh);
  for (const t of trees) shadowScene.add(t.depth);

  // ---------------------------------------------------------------- the campus sun
  const sunDir = new THREE.Vector3();
  let shadowKey = '';
  const corners = [];
  function fitShadow(focus) {
    // the whole campus, or (zoomed in) the ground round what is being looked at
    let x0 = s.x0, x1 = s.x1, z0 = s.z0, z1 = s.z1;
    if (focus && focus.r < 260) { x0 = focus.x - focus.r; x1 = focus.x + focus.r; z0 = focus.z - focus.r; z1 = focus.z + focus.r; }
    const c = new THREE.Vector3((x0 + x1) / 2, GROUND_Y + 10, (z0 + z1) / 2);
    shadowCam.position.copy(c).addScaledVector(sunDir, 900);
    shadowCam.up.set(0, 1, 0);
    shadowCam.lookAt(c);
    shadowCam.updateMatrixWorld();
    const inv = shadowCam.matrixWorldInverse;
    let l = Infinity, r = -Infinity, b = Infinity, t = -Infinity, n = Infinity, f = -Infinity;
    corners.length = 0;
    for (const x of [x0, x1]) for (const z of [z0, z1]) for (const y of [GROUND_Y - 1, GROUND_Y + 32]) {
      const v = new THREE.Vector3(x, y, z).applyMatrix4(inv);
      l = Math.min(l, v.x); r = Math.max(r, v.x); b = Math.min(b, v.y); t = Math.max(t, v.y); n = Math.min(n, -v.z); f = Math.max(f, -v.z);
    }
    // snap to whole texels so the shadow does not crawl when the frame moves
    const tx = (r - l) / SIZE, ty = (t - b) / SIZE;
    l = Math.floor(l / tx) * tx; r = l + tx * SIZE; b = Math.floor(b / ty) * ty; t = b + ty * SIZE;
    Object.assign(shadowCam, { left: l, right: r, bottom: b, top: t, near: Math.max(1, n - 5), far: f + 5 });
    shadowCam.updateProjectionMatrix();
    U.uCSMat.value.multiplyMatrices(shadowCam.projectionMatrix, shadowCam.matrixWorldInverse);
    U.uCSBias.value = 0.35 / (shadowCam.far - shadowCam.near);
  }
  function renderShadow() {
    const prev = renderer.getRenderTarget();
    const auto = renderer.autoClear;
    renderer.autoClear = true;
    renderer.setRenderTarget(shadowRT);
    renderer.render(shadowScene, shadowCam);
    renderer.setRenderTarget(prev);
    renderer.autoClear = auto;
  }

  // ---------------------------------------------------------------- picking (footprint boxes up to what is standing)
  /** the highest point of a building above the plan right now (its cut and its lift applied) */
  const standing = (b) => Math.max(GROUND_Y, Math.min(cuts[b.index], GROUND_Y + b.top) + lifts[b.index]);
  const local = new THREE.Vector3(), dir = new THREE.Vector3();
  function pick(ray) {
    let best = null, bt = Infinity;
    for (const b of model.buildings) {
      const top = standing(b);
      if (top <= GROUND_Y + 0.05) continue;
      const c = Math.cos(b.rot), sn = Math.sin(b.rot);
      // world → building frame (inverse of three.js rotation.y)
      const ox = ray.origin.x - b.cx, oz = ray.origin.z - b.cz;
      local.set(ox * c - oz * sn, ray.origin.y - GROUND_Y, ox * sn + oz * c);
      dir.set(ray.direction.x * c - ray.direction.z * sn, ray.direction.y, ray.direction.x * sn + ray.direction.z * c);
      const hw = b.w / 2 + 0.3, hd = b.d / 2 + 0.3, H = top - GROUND_Y;
      let t0 = 0, t1 = Infinity;
      for (const [o, d, lo, hi] of [[local.x, dir.x, -hw, hw], [local.y, dir.y, 0, H], [local.z, dir.z, -hd, hd]]) {
        if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { t0 = Infinity; break; } continue; }
        let a = (lo - o) / d, z = (hi - o) / d;
        if (a > z) [a, z] = [z, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, z);
      }
      if (t0 <= t1 && t0 < bt) { bt = t0; best = b; }
    }
    return best ? { building: best, t: bt, point: ray.origin.clone().addScaledVector(ray.direction, bt) } : null;
  }

  const byGroup = new Map();
  for (const b of model.buildings) { if (!byGroup.has(b.group)) byGroup.set(b.group, []); byGroup.get(b.group).push(b); }

  let sweepR = 0;
  const api = {
    model, group, mesh, ground, buildings: model.buildings, byGroup, cuts,
    /** per-building cut heights, in the finished campus's y (a building is whole when its cut is above its top) */
    setCuts(fn) { for (const b of model.buildings) cuts[b.index] = fn(b); },
    /** per-building lift: 0 standing, -(top) and below hidden under the plan */
    setLifts(fn) { for (const b of model.buildings) lifts[b.index] = fn(b); },
    lifts, standing,
    setSweep(R, glow = 0) { sweepR = R; U.uSweepR.value = R; U.uSweepGlow.value = glow; },
    get sweepR() { return sweepR; },
    setFlags(hover, selected) { for (const b of model.buildings) flags[b.index] = b.group === selected ? 2 : b.group === hover ? 1 : 0; },
    setDim(v) { U.uDimB.value = v; },
    /** the height a building's label sits at: the top of what is standing */
    topOf(group) {
      const list = byGroup.get(group);
      if (!list) return null;
      let y = -Infinity;
      for (const b of list) y = Math.max(y, standing(b));
      return y;
    },
    pick,
    /** compile the 3D campus's shaders in the background while the plan is read, so the first unfold does not stall */
    warm(camera) {
      if (api.warmed || !renderer.compileAsync) return;
      api.warmed = true;
      const vis = [group.visible, ground.visible, ...trees.map((t) => t.mesh.visible)];
      group.visible = ground.visible = true; for (const t of trees) t.mesh.visible = true;
      const keep = mesh.material;
      mesh.material = litMat;
      const p = renderer.compileAsync(scene, camera).catch(() => {});
      mesh.material = keep;
      group.visible = vis[0]; ground.visible = vis[1]; trees.forEach((t, i) => { t.mesh.visible = vis[2 + i]; });
      renderer.compileAsync(shadowScene, shadowCam).catch(() => {});
      return p;
    },
    /** once per frame, after the cuts and the front are set: visibility and the campus sun */
    update(focus) {
      const any = model.buildings.some((b) => standing(b) > GROUND_Y + 0.01);
      group.visible = any || sweepR > 0;
      // the plan is ink only: light and shadow are paid for once the material front is on its way
      mesh.material = sweepR > 0.5 ? litMat : inkMat;
      ground.visible = sweepR > 1;
      for (const t of trees) t.mesh.visible = sweepR > 1;
      U.uCSOn.value = Math.min(1, sweepR / 40);
      // (the scene has no bounce light: the sunlit paving's warmth is given back to walls and ground in shade)
      U.uBounce.value.set(world.sun.color.r, world.sun.color.g * 0.96, world.sun.color.b * 0.84).multiplyScalar(world.sun.intensity * 0.028);
      if (!group.visible || sweepR <= 1) return;
      sunDir.copy(world.sun.position).sub(world.sun.target.position).normalize();
      const fk = focus && focus.r < 260 ? [Math.round(focus.x / (focus.r * 0.25)), Math.round(focus.z / (focus.r * 0.25)), Math.round(Math.log2(focus.r) * 4)].join() : 'all';
      const key = fk + '|' + sunDir.toArray().map((v) => v.toFixed(3)).join() + '|' + Array.from(cuts, (v) => v.toFixed(2)).join() + '|' + Array.from(lifts, (v) => v.toFixed(2)).join() + '|' + Math.round(sweepR * 2);
      if (key === shadowKey) return;
      shadowKey = key;
      fitShadow(focus && focus.r < 260 ? { x: focus.r * 0.25 * Math.round(focus.x / (focus.r * 0.25)), z: focus.r * 0.25 * Math.round(focus.z / (focus.r * 0.25)), r: focus.r } : null);
      renderShadow();
    }
  };
  return api;
}
