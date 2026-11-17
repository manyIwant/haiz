// The tree, painted. Not V2's 榄仁 kit (a smaller, rounder concept tree): the six chapters' own
// tree, the same bark mesh and the same leaf rosettes, dressed in the walk's painted materials.
// Because it is the same geometry, moved by the same wind function with the same uniforms, it
// stands exactly where the remembered tree stands, branch for branch, and sways with it: during the
// transition the two can share one tree, half remembered, half paint.
//
//   bark     V4's mesh and growth/sway vertex code; flat painted colour, warm in the hollows, a few
//            long strokes along the wood
//   crown    one painted clump card per rosette (V2's leaf atlas), turned to the eye, shaded as part
//            of its leaf pad. The cards follow the rosettes, so the painted crown has the remembered
//            crown's silhouette. Colour follows today's phenology (lanren/js/season.js): in November
//            a few clumps are already turning red
//   islet    V4's rocks, soil, 太湖石 and plinth (with 「虎踞龙盘」) in painted colours
import * as THREE from 'three';
import { cel, celDepth } from '../stroll/atmos.js';
import { WIND_GLSL, UNIFORMS } from '../js/foliage.js';
import { seasonAt } from '../js/season.js';
import { v4Group } from './v4.js';

// V4's wind and touch code, renamed so it can live beside the walk's own uniforms (uTime, uWindDir)
const W4 = WIND_GLSL.replace(/\buWindDir\b/g, 'uWindDirV4').replace(/\buWind\b/g, 'uWindV4').replace(/\buGust\b/g, 'uGustV4').replace(/\buTime\b/g, 'uTimeV4')
  .replace(/\buTouchO\b/g, 'uTouchOV4').replace(/\buTouchD\b/g, 'uTouchDV4');
export const W4_UNIFORMS = { uTimeV4: UNIFORMS.uTime, uWindV4: UNIFORMS.uWind, uGustV4: UNIFORMS.uGust, uWindDirV4: UNIFORMS.uWindDir, uTouchOV4: UNIFORMS.uTouchO, uTouchDV4: UNIFORMS.uTouchD };

const BARK_HEAD = W4 + /* glsl */`
uniform float uGrowV4;
attribute vec4 color; attribute vec2 uv1;
varying vec4 vBk; varying vec3 vBkP;
`;
const BARK_BEGIN = /* glsl */`
{
  float since = uGrowV4 - uv1.x;
  float tip = smoothstep(0.0, 0.035, since);
  float thick = uv1.x > -0.5 ? mix(0.45, 1.0, smoothstep(0.0, 0.3, since)) : 1.0;
  transformed -= normalize(normal) * uv1.y * (1.0 - tip * thick);
  float te;
  transformed += windSway(position, color.g) + touchPush(position, te) * color.g * color.g;
  vBk = color; vBkP = position;
}
`;

function barkMaterial() {
  const uniforms = { ...W4_UNIFORMS, uGrowV4: UNIFORMS.uGrow };
  const mat = cel({
    name: 'painted-bark', key: 'painted-bark', color: new THREE.Color('#6a5849'), uniforms, soft: 0.08,
    vertex: { head: BARK_HEAD, begin: BARK_BEGIN },
    fragment: {
      head: 'varying vec4 vBk; varying vec3 vBkP;\n',
      albedo: /* glsl */`
ao = mix(mix(0.35, 0.7, vBk.b), 1.0, vBk.r);
albedo *= mix(0.7, 1.05, vBk.r);
// long strokes along the wood, lighter on the upper faces where the sky reaches
float st = aNoise(vec2(atan(vBkP.x, vBkP.z) * 5.0 + vBkP.y * 0.6, vBkP.y * 1.3));
albedo *= 0.9 + 0.2 * smoothstep(0.35, 0.8, st);
albedo = mix(albedo, albedo * vec3(1.12, 1.1, 1.0), smoothstep(0.4, 1.0, N.y) * 0.5);
albedo = wetAlbedo(albedo, uWet, 0.8);
`,
    },
  });
  const depth = celDepth({ key: 'painted-bark', uniforms, vertex: { head: BARK_HEAD.replace('varying vec4 vBk; varying vec3 vBkP;', 'vec4 vBk; vec3 vBkP;'), begin: BARK_BEGIN } });
  return { mat, depth };
}

// ---------------------------------------------------------------- the crown
const CLUMP_HEAD = W4 + /* glsl */`
attribute vec4 aC;      // rosette centre (tree space), flex
attribute vec4 aS;      // card size (m), atlas cell, in-plane angle, random
attribute vec4 aPad;    // the leaf pad's centre, outer shell (1) or inside (0)
uniform float uTurn; uniform float uFlush;
varying vec3 vCol; varying float vOcc; varying float vRnd;
`;
const CLUMP_BEGIN = (withNormal) => /* glsl */`
{
  mat3 inv = transpose(mat3(modelMatrix));
  vec3 R = inv * vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 Up = inv * vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float te;
  vec3 c = aC.xyz + windSway(aC.xyz, aC.w) + touchPush(aC.xyz, te);
  float ca = cos(aS.z), sa = sin(aS.z);
  vec2 k = vec2(position.x * ca - position.y * sa, position.x * sa + position.y * ca);
  // today's leaves: last season's cohort colours and falls (season.js turn), the new flush grows back
  float oldAge = (uTurn - aS.w * 0.85) * 2.2;
  float gone = step(1.0, oldAge) * step(uFlush, fract(aS.w * 7.31));
  float size = aS.x * (1.0 - gone);
  transformed = c + (R * k.x + Up * k.y) * size;
  ${withNormal ? `
  // shade as part of its pad (a soft volume), a little of the crown's dome
  vec3 nPad = normalize((aC.xyz - aPad.xyz) * vec3(1.0, 1.4, 1.0) + vec3(0.0, 0.25, 0.0));
  vec3 nCrown = normalize(aC.xyz - vec3(0.6, 8.0, -0.2));
  vec3 nCard = normalize(cross(R, Up));
  objectNormal = normalize(nPad * 0.6 + nCrown * 0.4 + nCard * 0.25 + (R * k.x + Up * k.y) * 0.35);
  vec3 green = mix(vec3(0.32, 0.6, 0.2), vec3(0.42, 0.66, 0.24), fract(aS.w * 13.7));
  float a = clamp(oldAge, 0.0, 1.0) * (1.0 - step(1.0, oldAge));   // fallen and grown back: this year's green
  vec3 turned = mix(mix(green, vec3(0.78, 0.6, 0.12), smoothstep(0.15, 0.45, a)), vec3(0.62, 0.12, 0.05), smoothstep(0.45, 0.8, a));
  vCol = mix(turned, green * vec3(1.05, 1.08, 0.82), aPad.w * 0.2);
  vOcc = aPad.w; vRnd = aS.w;
  ` : ''}
}
`;

function clumpMaterial(atlas) {
  const uniforms = { ...W4_UNIFORMS, uTurn: { value: 0 }, uFlush: { value: 1 } };
  const mat = cel({
    name: 'painted-crown', key: 'painted-crown', map: atlas, alphaTest: 0.42, side: THREE.DoubleSide, soft: 0.18, alphaToCoverage: true, uniforms,
    vertex: { head: CLUMP_HEAD, begin: CLUMP_BEGIN(true) + /* glsl */`
#ifdef USE_MAP
  vMapUv = (uv + vec2(mod(aS.y, 2.0), floor(aS.y * 0.5))) * 0.5;
#endif
` },
    fragment: {
      head: 'varying vec3 vCol; varying float vOcc; varying float vRnd;\n',
      albedo: /* glsl */`
{
  float dc = length(vWP - cameraPosition);
  if (dc < 2.6) { vec2 sp = floor(gl_FragCoord.xy); if (fract(dot(sp, vec2(0.7548776662, 0.56984029))) > smoothstep(0.9, 2.6, dc)) discard; }
}
albedo *= vCol * mix(0.92, 1.08, vRnd);
ao = mix(0.55, 1.0, vOcc);
albedo = wetAlbedo(albedo, uWet, 0.4);
`,
      after: /* glsl */`
{
  vec3 vd = normalize(vWP - cameraPosition);
  float back = pow(max(dot(vd, uSunDir), 0.0), 3.0);
  outCol += uSunColor * albedo * back * 0.5 * (0.4 + 0.6 * shadow) * vOcc;
  outCol += uSkyAmb * 0.07 * uWet * smoothstep(0.2, 0.9, N.y * 0.5 + 0.5);
}
`,
    },
  });
  const depth = celDepth({ key: 'painted-crown', map: atlas, alphaTest: 0.42, side: THREE.DoubleSide, uniforms,
    vertex: { head: CLUMP_HEAD.replace('varying vec3 vCol; varying float vOcc; varying float vRnd;', ''), begin: CLUMP_BEGIN(false) + /* glsl */`
#ifdef USE_MAP
  vMapUv = (uv + vec2(mod(aS.y, 2.0), floor(aS.y * 0.5))) * 0.5;
#endif
` } });
  return { mat, depth, uniforms };
}

function crownGeometry(ros, stride) {
  const n = ros.length / stride;
  const C = [], Sz = [], P = [];
  let seed = 9177;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < n; i++) {
    const o = i * stride;
    const tE = ros[o + 9];
    if (tE < 0) continue;                       // a rosette of last year's leaves only: fallen by full leaf
    const size = ros[o + 6], flex = ros[o + 7], shell = stride >= 16 ? ros[o + 15] : 1;
    C.push(ros[o], ros[o + 1], ros[o + 2], flex);
    Sz.push((0.95 + 0.55 * rnd()) * (0.7 + 0.45 * size) * (0.85 + 0.3 * shell), Math.floor(rnd() * 4), rnd() * Math.PI * 2, rnd());
    P.push(ros[o + 12], ros[o + 13], ros[o + 14], shell);
  }
  const q = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.index = q.index;
  g.setAttribute('position', q.getAttribute('position'));
  g.setAttribute('normal', q.getAttribute('normal'));
  g.setAttribute('uv', q.getAttribute('uv'));
  g.setAttribute('aC', new THREE.InstancedBufferAttribute(new Float32Array(C), 4));
  g.setAttribute('aS', new THREE.InstancedBufferAttribute(new Float32Array(Sz), 4));
  g.setAttribute('aPad', new THREE.InstancedBufferAttribute(new Float32Array(P), 4));
  g.instanceCount = C.length / 4;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0.6, 9, -0.2), 22);
  return g;
}

// ---------------------------------------------------------------- the islet
function inscription() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '600 190px "STKaiti", "KaiTi", "Kaiti SC", "LXGW WenKai", "Noto Serif SC", "Songti SC", serif';
  ['虎', '踞', '龙', '盘'].forEach((ch, i) => g.fillText(ch, 128 + i * 256, 132));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}
function isletMaterial(meta) {
  const pl = meta.anchors?.plinth;
  const n = pl ? [Math.sin(pl.yaw), 0, Math.cos(pl.yaw)] : [0, 0, 1];
  const t = pl ? [Math.cos(pl.yaw), 0, -Math.sin(pl.yaw)] : [1, 0, 0];
  const c = pl ? [pl.centre[0] + n[0] * pl.size[1] / 2, pl.centre[1], pl.centre[2] + n[2] * pl.size[1] / 2] : [0, -99, 0];
  const uniforms = { uInscr: { value: inscription() }, uInscrC: { value: new THREE.Vector3(...c) }, uInscrN: { value: new THREE.Vector3(...n) },
    uInscrT: { value: new THREE.Vector3(...t) }, uInscrSize: { value: new THREE.Vector2(1.7, 0.3) } };
  return cel({
    name: 'painted-islet', key: 'painted-islet', uniforms, soft: 0.1,
    vertex: { head: 'attribute vec4 color; varying vec4 vI; varying vec3 vIP;\n', begin: 'vI = color; vIP = position;\n' },
    fragment: {
      head: 'uniform sampler2D uInscr; uniform vec3 uInscrC; uniform vec3 uInscrN; uniform vec3 uInscrT; uniform vec2 uInscrSize;\nvarying vec4 vI; varying vec3 vIP;\n',
      albedo: /* glsl */`
float g1 = aNoise(vIP.xz * 2.0 + vIP.y) * 0.6 + aNoise(vIP.xz * 7.0) * 0.4;
vec3 soil = mix(vec3(0.36, 0.28, 0.2), vec3(0.44, 0.36, 0.24), g1);
vec3 moss = mix(vec3(0.33, 0.45, 0.2), vec3(0.42, 0.55, 0.24), g1);
vec3 c = mix(soil, moss, smoothstep(0.35, 0.75, aNoise(vIP.xz * 1.6)) * smoothstep(0.4, 0.9, N.y) * 0.8);
vec3 rock = mix(vec3(0.3, 0.3, 0.29), vec3(0.42, 0.41, 0.38), g1);
rock = mix(rock, vec3(0.4, 0.46, 0.32), smoothstep(0.6, 0.8, aNoise(vIP.xz * 2.3 + 9.0)) * smoothstep(0.3, 0.9, N.y) * 0.5);
c = mix(c, rock, smoothstep(0.3, 0.6, vI.g));
float taihu = 1.0 - smoothstep(0.2, 0.3, vI.a);
float plinth = smoothstep(0.25, 0.35, vI.a) * (1.0 - smoothstep(0.65, 0.75, vI.a));
c = mix(c, mix(vec3(0.17, 0.18, 0.18), vec3(0.27, 0.28, 0.27), g1), taihu);
vec3 gran = vec3(0.13, 0.13, 0.14);
{
  vec3 rel = vIP - uInscrC;
  vec2 st = vec2(dot(rel, uInscrT) / uInscrSize.x + 0.5, rel.y / uInscrSize.y + 0.5);
  if (st.x > 0.0 && st.x < 1.0 && st.y > 0.0 && st.y < 1.0) gran = mix(gran, vec3(0.78, 0.74, 0.66), texture2D(uInscr, st).a * 0.9);
}
c = mix(c, gran, plinth);
albedo = wetAlbedo(c, uWet, 0.7);
ao = mix(0.45, 1.0, vI.r);
`,
    },
  });
}

/** v4: loadV4() result. Returns the painted tree and islet in one group (turned into the walk's frame). */
export function createPaintedTree(v4) {
  const group = v4Group('painted-tree');
  const b = barkMaterial();
  const bark = new THREE.Mesh(v4.bark.geometry, b.mat);
  bark.customDepthMaterial = b.depth;
  bark.castShadow = bark.receiveShadow = true;
  bark.frustumCulled = false;
  bark.name = 'painted-bark';
  const cm = clumpMaterial(v4.paintAtlas);
  const crown = new THREE.Mesh(crownGeometry(v4.rosettes, v4.stride), cm.mat);
  crown.customDepthMaterial = cm.depth;
  crown.castShadow = crown.receiveShadow = true;
  crown.name = 'painted-crown';
  const islet = new THREE.Mesh(v4.island.geometry, isletMaterial(v4.meta));
  islet.castShadow = islet.receiveShadow = true;
  islet.name = 'painted-islet';
  group.add(bark, crown, islet);
  return {
    group, bark, crown, islet,
    /** today's phenology on the painted crown (Haikou day of year) */
    setDay(doy) { const s = seasonAt(doy); cm.uniforms.uTurn.value = s.turn; cm.uniforms.uFlush.value = Math.max(0, Math.min(1, s.flush)); return s; },
  };
}
