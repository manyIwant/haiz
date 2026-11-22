// HAIZ · 入画 — the painted campus's shared art language (lanren/painted).
//
// Painted Valley (patch.gg/blendi/painted-valley, MIT) showed that a real-time world reads as paint
// because of how each part of it is painted, not because a filter is laid over it: few tones chosen as
// paint, marks instead of noise, detail only where a brush would put it, people inked and cel-painted in
// front of painted backgrounds. HAIZ borrows the method, not the picture. Everything here is written for
// a real campus — paving, lawns under terminalia, a hundred-year 榄仁, teaching blocks with storeys and
// eaves, Haikou's sky — and plugs into the existing 入画 materials (lanren/ruhua-stroll/atmos.js cel())
// instead of replacing them.
//
//   ART          one set of uniforms every upgraded material reads: a master switch, four layer ramps
//                (ground, plants, buildings, people) the transition drives in turn, and the brush
//   ART_GLSL     the brush library: world-space marks that fade before they alias, painted value steps,
//                a painted light (ragged terminator, crisp shadow shapes, chosen shade colours)
//   celPlus()    a cel material rebuilt from another with vertex and fragment hooks appended (celLike
//                only appends fragment hooks)
//   writeInfo()  the frame's second attachment: what the finish (finish.js) should do with each pixel —
//                figure (ink, no paint), its part (lines between parts), structure (keep edges, draw
//                creases) and paint (how far the brush rounds it). Weights, not ids: MSAA resolves them to
//                the coverage-weighted mix, which is exactly the right blend of treatments at an edge.
import * as THREE from 'three';
import { cel } from '../ruhua-stroll/atmos.js';

/** things the A/B switch must put back by hand (a swapped texture): [{ on(), off() }] */
export const TOGGLES = [];

export const ART = {
  uArt: { value: 1 },
  // per-layer ramps 0..1: x ground, y plants, z buildings, w people (the transition raises them in turn)
  uArtL: { value: new THREE.Vector4(1, 1, 1, 1) },
  uBrush: { value: null },
};

export const ART_GLSL = /* glsl */`
uniform float uArt; uniform vec4 uArtL; uniform sampler2D uBrush;
float artLuma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// metres one pixel covers here (how fine a mark may be before it would shimmer)
float artFoot(vec3 wp) { return max(length(fwidth(wp)), 1e-4); }
// how visible a mark of this period is at this footprint: full when it spans >= ~6 px, gone at ~2 px
float artVis(float period, float foot) { return 1.0 - smoothstep(0.17, 0.5, foot / period); }
// the brush texture (brush.js): r dabs, g long strokes, b grain, a leaf shapes; 0.5 is "no mark"
float artDab(vec2 q) { return texture2D(uBrush, q).r - 0.5; }
float artStroke(vec2 q) { return texture2D(uBrush, q).g - 0.5; }
float artGrain(vec2 q) { return texture2D(uBrush, q).b - 0.5; }
// a painted value: n tones with a soft, narrow turn between them (soft 0 = hard)
float artSteps(float x, float n, float soft) {
  float s = x * n; float f = fract(s);
  return (floor(s) + smoothstep(0.5 - soft, 0.5 + soft, f)) / n;
}
// a shadow as a painter puts it: a shape with a crisp edge, the edge carried by the brush (world-stable)
float artShadow(float shadow, float brush) {
  return smoothstep(0.34 + brush * 0.42, 0.6 + brush * 0.42, shadow);
}
// The painted light: one sun and the sky, as toonLight(), with three differences that make it paint —
// the terminator follows the brush (a painted edge, not a computed one), shade colours are mixed as they
// should look (value kept, hue pulled toward the hour's shade hue, a little richer), and the light side
// has a half step of fuller light where it faces the sun.
vec3 artLight(vec3 albedo, vec3 N, vec3 wp, float shadow, float ao, float soft, float brush) {
  vec3 V = normalize(cameraPosition - wp);
  float ndl = dot(N, uSunDir) + brush * 0.16;
  float band = smoothstep(-0.03 - soft, 0.05 + soft, ndl);
  float lit = band * shadow * cloudShade(wp);
  vec3 amb = mix(uGroundAmb, uSkyAmb, N.y * 0.5 + 0.5) * ao;
  vec3 sh = albedo * amb;
  float shl = artLuma(sh);
  sh = mix(sh, shl * uShadeHue * 1.5, min(1.0, uShadeMix * 1.3));
  float hi = smoothstep(0.55, 0.7, ndl);
  vec3 col = sh + albedo * uSunColor * lit * (0.8 + 0.18 * hi);
  float back = max(0.0, dot(-V, uSunDir));
  float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
  col += uRim * albedo * fres * back * (0.3 + 0.7 * shadow) * 1.2;
  return col;
}
// A crown, as a background painter paints one: lit as a volume (N should be the clump's or the crown's,
// not the card's), four greens by tone — a cool deep inside, a blue-green shade, a mid and a warm lit
// green — with narrow turns near and broader ones far off, so a far crown is its lobes, not its leaves.
vec3 artFoliage(vec3 albedo, vec3 N, vec3 wp, float shadow, float ao, float rnd, float far) {
  float ndl = dot(N, uSunDir);
  float sun = shadow * cloudShade(wp);
  float tone = (ndl * 0.5 + 0.5) * mix(0.42, 1.0, ao) * mix(0.42, 1.0, sun);
  tone += (rnd - 0.5) * mix(0.2, 0.08, far);
  float w = mix(0.02, 0.07, far);
  vec3 skyL = uSkyAmb;
  float shl = artLuma(skyL);
  vec3 deepC = albedo * mix(skyL, shl * uShadeHue * 1.35, 0.6) * 0.42;
  vec3 shadeC = albedo * mix(skyL, shl * uShadeHue * 1.25, 0.35) * 0.78;
  vec3 midC = albedo * (skyL * 0.6 + uSunColor * 0.34);
  vec3 litC = albedo * vec3(1.04, 1.03, 0.86) * (skyL * 0.3 + uSunColor * 0.7);
  // sunlit leaves are warm, not neon: the lit and mid greens are held a little toward their own grey
  litC = mix(litC, vec3(artLuma(litC)), 0.22);
  midC = mix(midC, vec3(artLuma(midC)), 0.1);
  vec3 c = mix(deepC, shadeC, smoothstep(0.26 - w, 0.26 + w, tone));
  c = mix(c, midC, smoothstep(0.45 - w, 0.45 + w, tone));
  c = mix(c, litC, smoothstep(0.64 - w, 0.64 + w, tone));
  return c;
}
`;

const cat = (a, b) => (a || '') + (b || '');

/**
 * A cel material rebuilt from `m` (a cel()/celLike() material) with hooks appended to both stages and
 * uniforms added. Shares the same uniform objects, so wind, weather and light stay in step.
 *   extra: { key, soft, uniforms, vertex: { head, begin, world }, fragment: { head, pre, albedo, after },
 *            vertexReplace: { begin } (replaces the original begin hook instead of appending) }
 */
export function celPlus(m, extra = {}) {
  const o = m.userData.celOpts;
  if (!o) throw new Error('celPlus: not a cel material');
  const V = o.vertex || {}, F = o.fragment || {}, XV = extra.vertex || {}, XF = extra.fragment || {};
  const n = cel({
    ...o,
    key: (o.key || o.name) + ':' + (extra.key || 'art'),
    soft: extra.soft ?? o.soft,
    uniforms: { ...(o.uniforms || {}), ...ART, ...(extra.uniforms || {}) },
    vertex: { head: cat(V.head, XV.head), begin: cat(extra.vertexReplace?.begin ?? V.begin, XV.begin), world: cat(V.world, XV.world) },
    fragment: { head: cat(cat(F.head, ART_GLSL), XF.head), pre: cat(F.pre, XF.pre), albedo: cat(F.albedo, XF.albedo), after: cat(F.after, XF.after) },
  });
  if (m.map) n.map = m.map;
  if (m.vertexColors) n.vertexColors = true;
  n.color?.copy?.(m.color);
  n.name = m.name + ':art';
  n.userData.art = extra.info || INFO.thing;
  // wrapped at once: its hooks may assign haizInfo, so it must never compile without the wrapper
  writeInfo(n, n.userData.art);
  return n;
}

// ---------------------------------------------------------------- the info attachment
// gInfo = (figure, figure part, structure, paint). Transparent things write 0 everywhere, so with the
// usual blending the attachment keeps what is behind them (rain, a figure's soft shadow, cloud cards).
export const INFO = {
  sky: 'vec4(0.0)',
  ground: 'vec4(0.0, 0.0, 0.08, 0.62)',
  lawn: 'vec4(0.0, 0.0, 0.0, 0.8)',
  foliage: 'vec4(0.0, 0.0, 0.0, 1.0)',
  bark: 'vec4(0.0, 0.0, 0.45, 0.55)',
  building: 'vec4(0.0, 0.0, 1.0, 0.4)',
  glass: 'vec4(0.0, 0.0, 1.0, 0.12)',
  water: 'vec4(0.0, 0.0, 0.0, 0.45)',
  figure: 'vec4(1.0, 0.5, 0.0, 0.0)',
  thing: 'vec4(0.0, 0.0, 0.5, 0.25)',
};

const patched = new WeakSet();
/**
 * Make `material` write the info attachment: its main() is wrapped, the wrapper writes `gInfo`.
 * `expr` is a GLSL vec4 expression (it may read varyings, uniforms and the global `haizInfo`, which
 * upgraded hooks can assign). Idempotent.
 */
export function writeInfo(material, expr) {
  if (!material || patched.has(material)) return;
  patched.add(material);
  const blendKeeps = material.transparent || material.blending === THREE.AdditiveBlending;
  const value = blendKeeps ? 'vec4(0.0)' : expr;
  const prev = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = function (sh, r) {
    prev?.call(this, sh, r);
    const src = sh.fragmentShader;
    if (src.includes('haizMain')) return;      // already wrapped (a twin shares its original's hook)
    const re = /void\s+main\s*\(\s*(void)?\s*\)/;
    if (!re.test(src)) { console.warn('painted: no main() in', material.name); return; }
    sh.fragmentShader = src.replace(re, `vec4 haizInfo = ${blendKeeps ? 'vec4(0.0)' : 'vec4(-1.0)'};\nlayout(location = 1) out highp vec4 gInfo;\nvoid haizMain()`) +
      `\nvoid main() { haizMain(); vec4 hzI = ${value}; gInfo = haizInfo.x >= 0.0 ? haizInfo : hzI; }\n`;
  };
  material.customProgramCacheKey = () => prevKey() + '|hzinfo:' + value;
  material.needsUpdate = true;
}

/** a sensible info expression for a material nobody upgraded, by what it looks like */
export function guessInfo(material, mesh) {
  const name = (material.name || '') + ' ' + (mesh?.name || '');
  if (/figure|walker|cat|umbrella|umb-|outline/i.test(name) || mesh?.isSkinnedMesh) return INFO.figure;
  if (/leaf|crown|flower|shrub|hedge|bed/i.test(name)) return INFO.foliage;
  if (/grass/i.test(name)) return INFO.lawn;
  if (/bark|islet/i.test(name)) return INFO.bark;
  if (/campus|glass|wall/i.test(name)) return INFO.building;
  if (/ground/i.test(name)) return INFO.ground;
  if (material.isShaderMaterial && material.depthWrite === false) return INFO.sky;
  return INFO.thing;
}

/**
 * Patch every material drawn on `layerMask` under `root` (a cheap walk: patched materials are skipped).
 * Call it before each render of the painted layer: anything added since (people, rain, the easel's
 * flying strokes) is covered before it can leave the attachment undefined.
 */
export function coverScene(root, layer) {
  root.traverse((o) => {
    if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !o.material) return;
    if (layer != null && !o.layers.isEnabled(layer)) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of list) if (!patched.has(m)) writeInfo(m, m.userData?.art || guessInfo(m, o));
  });
}
export const isCovered = (m) => patched.has(m);
