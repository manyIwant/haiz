// The water becomes the campus.
//
// Nothing is drawn on top of the V4 lagoon: its own water shader gains a second
// reading of the same world-space plane. From the tree's roots outwards (through
// the arrival field: fastest along the paved paths) the campus plan first shows
// as faint refracted lines under the surface, then the water thins over it, its
// reflections give way, and the plane is the campus's ground. The real ponds
// (砚池, the botanic garden's pool) stay water.
//
// With reveal = 0 the patched shader returns V4's colour untouched (one uniform
// branch), so the other five chapters and the arrival at 04 are unchanged.
import * as THREE from 'three';
import { invert, hex } from './tone.js';
import { GROUND_Y, computeArrival } from './geo.js';
import { revealAt } from './reveal.js';
import { LIGHT } from '../js/chapters.js';

// ---------------------------------------------------------------- palette (as seen on screen)
// A pale stone ground like the lagoon's sandy bed it rises from, paving a little
// lighter (the campus's 芝麻白 granite), warm-grey roofs with deep green-grey ink,
// sage gardens, and the HAIZ gold for a chosen place.
const PALETTE = [
  ['paper', '#e4ddcd'], ['road', '#eee9dd'], ['roadEdge', '#b9b09c'], ['bld', '#d2c9b7'], ['bldTall', '#bdb3a1'],
  ['ink', '#3c4a41'], ['gate', '#b48a68'], ['garden', '#c3cca9'], ['gardenEdge', '#8f9d7a'], ['botanic', '#afbd95'],
  ['canopy', '#93a87b'], ['canopyDark', '#6f8a60'], ['plot', '#b9c197'], ['pond', '#6f9d9a'], ['track', '#c4937d'],
  ['infield', '#adbf92'], ['lineW', '#f4eee2'], ['corr', '#e9e3d5'], ['pavilion', '#c7a888'], ['rock', '#9d998f'],
  ['sel', '#ead6a8'], ['halo', '#f3e4bf'], ['inkWater', '#123c3d'], ['inkLight', '#a9cfc8']
];
export const PAL_INDEX = Object.fromEntries(PALETTE.map(([k], i) => [k, i]));
// the map is read in chapter 04's light, with a slightly gentler contrast than the film (see stage())
export const MAP_GRADE = { exposure: LIGHT[3].exposure, sat: 1.0, contrast: 1.04, warm: LIGHT[3].warm };

// ---------------------------------------------------------------- GLSL
// The plan's drawing of the campus is one function of the data. The water reads
// it in the plan's palette; the campus ground of the 3D model (section.js) reads
// the very same function in a palette of real materials.
export const CAMPUS_UNIFORMS = /* glsl */`
uniform sampler2D uFeat; uniform int uFeatN; uniform int uFeatSplit;
uniform sampler2D uCanopy; uniform vec4 uSheet; uniform float uCanopyK; uniform float uBldShadowK; uniform float uContactK;
uniform vec2 uShadowDir; uniform float uSelect; uniform float uHover; uniform float uHoverFeat; uniform float uDim;
`;
export const PAL_SIZE = PALETTE.length;
/** hzCampus() and its helpers, reading the palette uniform `pal` (needs wn() from the host shader) */
export function campusGLSL(pal) {
  return CAMPUS_FN.replaceAll('uPal[', pal + '[');
}
const MAP_PARS_HEAD = /* glsl */`
uniform float uReveal; uniform float uInkFront; uniform float uSurfFront; uniform float uInkFeather; uniform float uSurfFeather;
uniform sampler2D uArrival; uniform vec4 uArrA; uniform vec2 uArrB;
uniform vec3 uPal[${PALETTE.length}];
`;
const CAMPUS_FN = /* glsl */`
float hzBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float hzRBox(vec2 p, vec2 b, float r){ return hzBox(p, b - r) - r; }
float hzFill(float sd, float aa){ return 1.0 - smoothstep(-aa, aa, sd); }
float hzLine(float sd, float w, float aa){ return 1.0 - smoothstep(w * 0.5, w * 0.5 + aa, abs(sd)); }

// The campus plan at world point q. aa: edge softness (m), px: one pixel (m).
vec3 hzCampus(vec2 q, float aa, float px, vec3 water, out float lines){
  vec3 col = uPal[${PAL_INDEX.paper}] * (1.0 + (wn(q * 0.21) - 0.5) * 0.035 + (wn(q * 1.7) - 0.5) * 0.02);
  lines = 0.0;
  float selD = 1e5;
  for (int i = 0; i < 64; i++) {
    if (i >= uFeatN) break;
    if (i == uFeatSplit && uCanopyK > 0.0) {
      // the campus's trees: soft canopies with their shade, under the roofs
      vec4 cn = texture2D(uCanopy, (q - uSheet.xy) / (uSheet.zw - uSheet.xy));
      col *= 1.0 - 0.12 * cn.g;
      col = mix(col, mix(uPal[${PAL_INDEX.canopyDark}], uPal[${PAL_INDEX.canopy}], cn.b), cn.r * 0.88);
      lines = max(lines, cn.r * 0.3);
    }
    vec4 A = texelFetch(uFeat, ivec2(i * 3, 0), 0);
    vec2 d = q - A.xy;
    float reach = A.z + A.w + 14.0 + aa * 3.0;
    if (abs(d.x) > reach || abs(d.y) > reach) continue;
    vec4 B = texelFetch(uFeat, ivec2(i * 3 + 1, 0), 0);
    float cs = cos(B.y), sn = sin(B.y);
    vec2 l = vec2(d.x * cs - d.y * sn, d.x * sn + d.y * cs);
    int kind = int(B.x + 0.5);
    bool sel = B.w > -0.5 && abs(B.w - uSelect) < 0.5;
    bool hov = (B.w > -0.5 && abs(B.w - uHover) < 0.5) || abs(float(i) - uHoverFeat) < 0.5;
    float sd = hzBox(l, A.zw);
    if (sel) {
      selD = min(selD, sd);
      col = mix(col, uPal[${PAL_INDEX.halo}], exp(-max(sd, 0.0) / (3.0 + px * 6.0)) * step(0.0, sd) * 0.6);
    }
    float lw = px * (hov ? 2.2 : 1.15);
    if (kind <= 1) {                       // botanic garden, garden courts
      col = mix(col, kind == 0 ? uPal[${PAL_INDEX.botanic}] : uPal[${PAL_INDEX.garden}], hzFill(sd, aa) * 0.92);
      float e = hzLine(sd, lw, aa); col = mix(col, uPal[${PAL_INDEX.gardenEdge}], e * 0.75); lines = max(lines, e * 0.6);
    } else if (kind == 2) {                // the 400 m track
      float so = hzRBox(l, A.zw, A.w), si = hzRBox(l, A.zw - 9.76, A.w - 9.76);
      col = mix(col, uPal[${PAL_INDEX.track}], hzFill(so, aa));
      col = mix(col, uPal[${PAL_INDEX.infield}], hzFill(si, aa));
      float ln = max(max(hzLine(so + 2.44, px * 0.9, aa), hzLine(so + 4.88, px * 0.9, aa)), hzLine(so + 7.32, px * 0.9, aa));
      ln = max(ln, max(hzLine(l.x, px, aa) * step(si, 0.0), hzLine(length(l) - 9.15, px, aa)));
      col = mix(col, uPal[${PAL_INDEX.lineW}], ln * 0.85);
      float e = hzLine(so, lw, aa); col = mix(col, uPal[${PAL_INDEX.ink}], e * 0.45); lines = max(lines, e * 0.8);
      sd = so;
    } else if (kind == 3) {                // courts, with the data's own colour and grid
      vec4 C = texelFetch(uFeat, ivec2(i * 3 + 2, 0), 0);
      float f = hzFill(sd, aa);
      col = mix(col, C.rgb, f);
      vec2 grid = vec2(floor(C.a / 10.0 + 0.01), mod(C.a + 0.01, 10.0) - 0.01);
      vec2 cell = A.zw * 2.0 / max(grid, vec2(1.0));
      vec2 g = mod(l + A.zw, cell) - cell * 0.5;
      float cl = max(hzLine(hzBox(g, cell * 0.4), px * 0.9, aa), hzLine(g.y, px * 0.9, aa) * step(abs(g.x), cell.x * 0.4));
      col = mix(col, uPal[${PAL_INDEX.lineW}], cl * f * 0.8);
      lines = max(lines, hzLine(sd, lw, aa) * 0.5);
    } else if (kind == 4) {                // paved paths
      col = mix(col, uPal[${PAL_INDEX.road}], hzFill(sd, aa));
      float e = hzLine(sd, px, aa); col = mix(col, uPal[${PAL_INDEX.roadEdge}], e * 0.6); lines = max(lines, e * 0.75);
    } else if (kind == 5) {                // ponds stay water
      float so = hzRBox(l, A.zw, min(A.z, A.w) * 0.35);
      col = mix(col, mix(water, uPal[${PAL_INDEX.pond}], 0.4), hzFill(so, aa));
      float e = hzLine(so, lw, aa); col = mix(col, uPal[${PAL_INDEX.ink}], e * 0.55); lines = max(lines, e);
      sd = so;
    } else if (kind == 6) {                // the tree's own plot
      float so = hzRBox(l, A.zw, min(A.z, A.w) * 0.85);
      col = mix(col, uPal[${PAL_INDEX.plot}], hzFill(so, aa) * 0.9);
      float e = hzLine(so, lw, aa); col = mix(col, uPal[${PAL_INDEX.gardenEdge}], e * 0.6); lines = max(lines, e * 0.8);
      sd = so;
    } else if (kind == 7 || kind == 8) {   // buildings and gates, with a short shadow from chapter 04's sun
      vec2 ds = d - uShadowDir * B.z * 0.13;
      float sh = hzFill(hzBox(vec2(ds.x * cs - ds.y * sn, ds.x * sn + ds.y * cs), A.zw), aa + 0.7) * (1.0 - hzFill(sd, aa));
      col *= 1.0 - 0.2 * sh * uBldShadowK;
      col *= 1.0 - uContactK * 0.42 * exp(-max(sd, 0.0) / 1.6) * step(0.0, sd);   // where a wall meets the ground
      vec3 fc = kind == 8 ? uPal[${PAL_INDEX.gate}] : mix(uPal[${PAL_INDEX.bld}], uPal[${PAL_INDEX.bldTall}], clamp(B.z / 26.0, 0.0, 1.0));
      if (sel) fc = mix(fc, uPal[${PAL_INDEX.sel}], 0.85); else if (hov) fc = fc * 1.045;
      col = mix(col, fc, hzFill(sd, aa));
      float e = hzLine(sd, sel ? px * 2.4 : lw, aa); col = mix(col, uPal[${PAL_INDEX.ink}], e * 0.85); lines = max(lines, e);
    } else if (kind == 9) {                // covered walkways: dashed
      col = mix(col, uPal[${PAL_INDEX.corr}], hzFill(sd, aa));
      float e = hzLine(sd, px, aa) * step(0.5, fract((l.x + l.y) / 1.6));
      col = mix(col, uPal[${PAL_INDEX.roadEdge}], e * 0.9); lines = max(lines, e * 0.5);
    } else if (kind == 10) {               // a pavilion: its hipped roof in plan
      float f = hzFill(sd, aa);
      col = mix(col, uPal[${PAL_INDEX.pavilion}], f);
      float ridge = hzLine((abs(l.x) * A.w - abs(l.y) * A.z) / length(A.zw), px, aa) * f;
      float e = hzLine(sd, lw, aa);
      col = mix(col, uPal[${PAL_INDEX.ink}], max(ridge * 0.55, e * 0.85)); lines = max(lines, e);
    } else {                               // the scholar's rock
      float so = hzRBox(l, A.zw, min(A.z, A.w) * 0.8) + (wn(q * 0.9) - 0.5) * 0.9;
      col = mix(col, uPal[${PAL_INDEX.rock}] * (0.9 + 0.2 * wn(q * 3.0)), hzFill(so, aa));
      float e = hzLine(so, lw, aa); col = mix(col, uPal[${PAL_INDEX.ink}], e * 0.7); lines = max(lines, e);
      sd = so;
    }
    if (hov && kind != 7 && kind != 8) col = mix(col, uPal[${PAL_INDEX.ink}], hzLine(sd, px * 2.0, aa) * 0.45);
    if (sel && kind != 7 && kind != 8) col = mix(col, uPal[${PAL_INDEX.ink}], hzLine(sd, px * 2.4, aa) * 0.85);
  }
  // a chosen place keeps its light; the rest of the campus steps back a little
  if (uSelect > -0.5) col = mix(col, col * 0.86 + uPal[${PAL_INDEX.paper}] * 0.07, uDim * smoothstep(8.0, 70.0, selD));
  return col;
}
`;
const MAP_PARS = MAP_PARS_HEAD + CAMPUS_UNIFORMS + CAMPUS_FN + /* glsl */`
vec3 hzSurface(vec3 water, vec2 p, vec2 n, vec3 refl, float caust, float fres){
  float px = length(fwidth(p));   // derivatives before any branch
  // how far the reveal has come here: arrival along the paths, a little irregular at its edge
  vec2 at = texture2D(uArrival, (p - uArrA.xy) * uArrA.zw + uArrB).rg;
  float arr = (at.r * 255.0 + at.g) / 255.0;
  float a = arr + (wn(p * 0.085 + 3.1) - 0.5) * 0.03 + (wn(p * 0.31) - 0.5) * 0.012;
  vec2 e2 = min(p - uSheet.xy, uSheet.zw - p);
  float sheet = smoothstep(0.0, 28.0, min(e2.x, e2.y) + (wn(p * 0.025) - 0.5) * 30.0);
  float lInk = clamp((uInkFront - a) / uInkFeather, 0.0, 1.0) * sheet;
  float lSurf = clamp((uSurfFront - a) / uSurfFeather, 0.0, 1.0) * sheet;
  if (lInk <= 0.0) return water;
  lInk = lInk * lInk * (3.0 - 2.0 * lInk);
  float s = smoothstep(0.0, 1.0, lSurf);
  float under = 1.0 - s;
  // under water the plan is bent by slow, broad swells (V4's own water clock) and softened by depth
  vec2 sw = vec2(wn(p * 0.16 + vec2(uTimeW * 0.05, 0.0)) - wn(p * 0.16 + vec2(4.0, uTimeW * 0.04)),
                 wn(p * 0.11 - vec2(uTimeW * 0.035, 7.0)) - wn(p * 0.11 + vec2(2.0, -uTimeW * 0.03)));
  vec2 q = p + (sw * 1.1 + n * 8.0) * under;
  float aa = max(px * 0.7, mix(0.8, 0.0, smoothstep(0.0, 0.7, lSurf)));
  float lines;
  vec3 plan = hzCampus(q, aa, px, water, lines);
  // 1) on the lagoon floor: pale paving reads as light, roofs as shade, and the plan's
  //    edges catch the light as faint lines, all seen through the moving water
  float rel = dot(plan, vec3(0.333)) / dot(uPal[${PAL_INDEX.paper}], vec3(0.333));
  vec3 bed = water * mix(1.0, clamp(rel, 0.45, 1.6), 0.6 * lInk * under);
  bed = mix(bed, uPal[${PAL_INDEX.inkLight}] * (0.55 + 0.45 * caust), lines * lInk * 0.22 * under);
  // 2) the water thins: more of the plan's own colour, less of the lagoon's, the mirror fading last
  vec3 shallow = plan * mix(vec3(0.34, 0.52, 0.55), vec3(1.0), s);
  shallow = mix(shallow, refl, clamp(fres * 1.1 + 0.06, 0.0, 1.0) * under * 0.8);
  // the damp margin the water has just left: a little darker, never a glowing line
  shallow *= 1.0 - 0.1 * smoothstep(0.2, 0.55, lSurf) * (1.0 - smoothstep(0.55, 0.95, lSurf));
  return mix(bed, shallow, pow(s, 0.85));
}
`;

/** Patch V4's water material in place (no change to environment.js). */
function patchWater(material, uniforms) {
  let fs = material.fragmentShader;
  const end = fs.lastIndexOf('gl_FragColor = vec4(c, 1.0);');
  const mainAt = fs.indexOf('void main(){');
  if (end < 0 || mainAt < 0) throw new Error('V4 water shader not recognised');
  fs = fs.slice(0, end) + 'if (uReveal > 0.0) c = hzSurface(c, p, n, refl, caust, fres);\n  ' + fs.slice(end);
  fs = fs.slice(0, mainAt) + MAP_PARS + '\n' + fs.slice(mainAt);
  material.fragmentShader = fs;
  Object.assign(material.uniforms, uniforms);
  material.needsUpdate = true;
}

// ---------------------------------------------------------------- textures
function featureTexture(features, places) {
  const placeIndex = new Map(places.map((p, i) => [p.id, i]));
  const N = features.length, data = new Float32Array(N * 3 * 4);
  const paper = hex(PALETTE[PAL_INDEX.paper][1]);
  features.forEach((f, i) => {
    const o = i * 12;
    // the data's court colours, softened towards the paper and graded like the rest of the plan
    const col = f.colour ? invert(hex(f.colour).map((v, k) => v * 0.68 + paper[k] * 0.32), MAP_GRADE) : [0, 0, 0];
    data.set([f.cx, f.cz, f.hw, f.hd], o);
    data.set([f.code, f.rot, f.h || 0, placeIndex.has(f.group) ? placeIndex.get(f.group) : -1], o + 4);
    data.set([...col, f.grid ? f.grid[0] * 10 + f.grid[1] : 0], o + 8);
  });
  const t = new THREE.DataTexture(data, N * 3, 1, THREE.RGBAFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}
function arrivalTexture(field) {
  const { nx, nz, data } = field, px = new Uint8Array(nx * nz * 4);
  for (let n = 0; n < nx * nz; n++) {
    const v = data[n] * 255, hi = Math.min(255, Math.floor(v));
    px[n * 4] = hi; px[n * 4 + 1] = Math.round((v - hi) * 255); px[n * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(px, nx, nz, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}
/** soft canopies of the campus's recorded trees: R coverage, G shade, B tone */
function canopyTexture(trees, sheet, shadowDir, size = 2048) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, size, size);
  const sx = size / (sheet.x1 - sheet.x0), sz = size / (sheet.z1 - sheet.z0);
  const blob = (x, z, r, rgb, a) => {
    const X = (x - sheet.x0) * sx, Y = (z - sheet.z0) * sz, R = r * sx;
    const gr = g.createRadialGradient(X, Y, 0, X, Y, R);
    gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(0.62, `rgba(${rgb},${a * 0.9})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(X, Y, R, 0, Math.PI * 2); g.fill();
  };
  g.globalCompositeOperation = 'lighter';
  // shade first (green channel), offset like the buildings' shadows
  for (const t of trees) blob(t.x + shadowDir[0] * 1.6, t.z + shadowDir[1] * 1.6, t.r * 1.05, '0,255,0', 0.55);
  g.globalCompositeOperation = 'source-over';
  // then the crowns: red coverage, blue tone (lit side), drawn with 'lighten' so overlaps merge
  g.globalCompositeOperation = 'lighten';
  for (const t of trees) {
    const tone = t.kind === 'palm' ? 200 : t.kind === 'banyan' || t.kind === 'chongyang' ? 70 : 140;
    blob(t.x, t.z, t.r, `255,0,${tone}`, 0.95);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  return tex;
}

// ---------------------------------------------------------------- the layer
export function createMapLayer(world, geo) {
  const { frame, features, places, trees } = geo;
  const water = world.water;
  const sheet = frame.sheet;
  // shadows fall away from chapter 04's sun (azimuth measured as atan2(x, z))
  const az = (LIGHT[3].sun[0] * Math.PI) / 180;
  const shadowDir = [-Math.sin(az), -Math.cos(az)];
  const field = computeArrival(features, frame);
  const split = features.findIndex((f) => f.layer >= 4);
  const pal = PALETTE.map(([, h]) => new THREE.Vector3(...invert(hex(h), MAP_GRADE)));
  const U = {
    uReveal: { value: 0 }, uInkFront: { value: -1 }, uSurfFront: { value: -1 }, uInkFeather: { value: 0.05 }, uSurfFeather: { value: 0.06 },
    uFeat: { value: featureTexture(features, places) }, uFeatN: { value: features.length }, uFeatSplit: { value: split < 0 ? features.length : split },
    uArrival: { value: arrivalTexture(field) },
    uArrA: { value: new THREE.Vector4(field.x0, field.z0, 1 / (field.cell * field.nx), 1 / (field.cell * field.nz)) },
    uArrB: { value: new THREE.Vector2(0.5 / field.nx, 0.5 / field.nz) },
    uCanopy: { value: canopyTexture(trees, sheet, shadowDir) },
    uSheet: { value: new THREE.Vector4(sheet.x0, sheet.z0, sheet.x1, sheet.z1) },
    uShadowDir: { value: new THREE.Vector2(...shadowDir) },
    uSelect: { value: -1 }, uHover: { value: -1 }, uHoverFeat: { value: -1 }, uDim: { value: 0 },
    uCanopyK: { value: 1 }, uBldShadowK: { value: 1 }, uContactK: { value: 0 },
    uPal: { value: pal }
  };
  patchWater(water.material, U);

  // the islet and what grows on it: they settle below the plan as it surfaces
  const sinkers = [world.island, world.grass];
  const known = new Set([world.canopy.mesh, world.litter.loose.mesh, world.island, world.grass, world.bark]);
  world.scene.traverse((o) => { if (o.isInstancedMesh && !known.has(o) && o.name !== 'hero-leaves') sinkers.push(o); });   // the shrubs
  const sinkBase = sinkers.map((o) => o.position.y);
  const SINK = 2.7;   // the scholar's rock reaches 1.59 m: 2.7 m takes all of it below the plane at -0.85
  const distance = world.scene.getObjectByName('distance');
  // with the plan fully up, the mirror is not needed: skip the reflection render
  const reflectorRender = water.onBeforeRender;
  let full = false;
  if (water.isReflector || reflectorRender) water.onBeforeRender = function (...a) { if (!full) reflectorRender.apply(this, a); };
  const hasRefl = water.material.uniforms.uHasRefl;
  const reflOn = hasRefl ? hasRefl.value : 0;
  const passes = world.composer.passes;
  const bloom = passes.find((p) => 'threshold' in p && 'strength' in p);
  const finish = passes[passes.length - 1];
  const bloomThreshold = bloom ? bloom.threshold : 0;
  const shadowCatch = world.scene.children.find((o) => o.material?.isShadowMaterial);
  const shadowOpacity = shadowCatch ? shadowCatch.material.opacity : 0;

  let T = 0;
  const layer = {
    field, uniforms: U, shadowDir, ground: GROUND_Y, sheet,
    get reveal() { return T; },
    /** set the reveal clock (0 water … 1 campus) */
    setReveal(t) {
      T = Math.min(1, Math.max(0, t));
      const r = revealAt(T);
      U.uReveal.value = T > 0 ? T : 0;
      U.uInkFront.value = r.ink; U.uSurfFront.value = r.surf;
      U.uInkFeather.value = r.inkFeather; U.uSurfFeather.value = r.surfFeather;
      const y = -SINK * r.settle;
      sinkers.forEach((o, i) => { o.position.y = sinkBase[i] + y; o.updateMatrixWorld(); });
      // fallen leaves would hang where the islet was: they rest while the plan is up
      world.litter.loose.mesh.visible = r.settle < 0.05;
      if (distance) distance.visible = T < 0.001;   // the far headlands never sit on the campus
      full = T >= 1;
      if (hasRefl) hasRefl.value = full ? 0 : reflOn;
      if (shadowCatch) shadowCatch.material.opacity = shadowOpacity * (1 - 0.22 * r.clarity);
      return r;
    },
    /** chapter 04's light, eased towards a readable plan (called before setStage each frame) */
    stage(L) {
      if (T <= 0) return L;
      const k = revealAt(T).clarity;
      L.mist *= 1 - k; L.rays *= 1 - k; L.density *= 1 - 0.6 * k;
      L.contrast += (MAP_GRADE.contrast - L.contrast) * k;
      L.sat += (MAP_GRADE.sat - L.sat) * k;
      // opened from the walk (06's light): the plan is still read in 04's exposure (a no-op at 04)
      L.exposure += (MAP_GRADE.exposure - L.exposure) * k;
      return L;
    },
    /** after setStage: post-processing that would bloom or vignette the paper */
    post() {
      const k = T > 0 ? revealAt(T).clarity : 0;
      if (bloom) bloom.threshold = bloomThreshold + 3 * k;
      if (finish?.uniforms?.uVig) finish.uniforms.uVig.value = 0.32 - 0.14 * k;
    },
    setSelect(i) { U.uSelect.value = i ?? -1; },
    setHover(placeIdx, featIdx) { U.uHover.value = placeIdx ?? -1; U.uHoverFeat.value = featIdx ?? -1; },
    setDim(v) { U.uDim.value = v; }
  };
  return layer;
}
