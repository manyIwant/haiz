// 入画 · 画境实验室 — the material layer.
//
// Every surface of the V2 painted campus is a `cel` material (lanren/ruhua-stroll/atmos.js). The lab
// does not replace that look; it builds a sibling of each material with `celLike` (same uniforms
// objects, so the sun, wind and weather stay in step) and appends three painter's habits to the
// light that V2 already computes:
//
//   交界 core band   where a form turns away from the light (and along the soft edge of a cast
//                    shadow) gouache painters lay their richest, slightly warmer colour. A cel
//                    terminator alone reads as a sticker edge; the band makes it read as paint
//   笔触 brush       a world-space stroke field laid along each surface (courses on walls, combed
//                    on the ground) whose size stays roughly constant on screen at every distance
//                    (two octaves cross-faded by log₂ distance), so near walls are not blotchy and
//                    far ones not noisy. Thicker in the light, thin in the shade, as body colour is
//   碎色 broken      a second, slower field nudges hue warm/cool around the local colour, keeping
//                    value — the colour of a painted wall is never one flat mixture
//
// Strength is per surface family (walls carry the most paint, foliage and grass the least: the leaf
// atlas and the blades already carry their own marks). Everything here is visual; the geometry, the
// surveyed anchors and the colliders are untouched.
import * as THREE from 'three';
import { celLike } from '../ruhua-stroll/atmos.js';

/** shared lab material uniforms: x core band, y brush, z broken colour, w on/off master */
export const LABM = {
  uLabMat: { value: new THREE.Vector4(1, 1, 1, 1) },
  uBrushPx: { value: 0.0016 },   // brush width as a fraction of distance (≈ screen size)
  uLabLight: { value: 1 },       // 光色: warm light, chromatic shade
};

const HEAD = /* glsl */`
uniform vec4 uLabMat; uniform float uBrushPx; uniform vec3 uLabFamily; uniform float uLabLight;
// anisotropic stroke noise: long along u, narrow across v; each stroke row is offset and slightly
// tilted so the marks don't line up into a grid
float labStroke(vec2 p) {
  float row = floor(p.y);
  float h = aHash(vec2(row, 3.7));
  vec2 q = vec2(p.x * 0.22 + h * 17.0 + p.y * (h - 0.5) * 0.35, p.y);
  float n = aNoise(vec2(q.x, row * 1.7)) * 0.65 + aNoise(q * vec2(1.0, 2.0) + 5.1) * 0.35;
  // a stroke's body is flat; its edges thin out
  float across = abs(fract(p.y) - 0.5) * 2.0;
  return mix(n, 0.5, smoothstep(0.7, 1.0, across) * 0.6);
}
// the same field at the octave that keeps marks ~uBrushPx·distance wide
float labBrush(vec2 uv, float dist) {
  float level = log2(max(dist * uBrushPx * 40.0, 1e-3));
  float l0 = floor(level), f = level - l0;
  float s0 = exp2(-l0), s1 = s0 * 0.5;
  float a = labStroke(uv * s0 * vec2(1.0, 3.0));
  float b = labStroke(uv * s1 * vec2(1.0, 3.0) + 11.0);
  return mix(a, b, smoothstep(0.0, 1.0, f));
}
`;

const AFTER = /* glsl */`
if (uLabLight > 0.001) {
  // 光色: tropical light is warm and the shade is coloured, not darker grey. Value is kept on
  // both sides, so the picture's drawing (where it is light, where it is dark) does not move
  float ll = smoothstep(-0.04, 0.12, dot(N, uSunDir)) * shadow * cloudShade(vWP);
  float v0 = dot(outCol, vec3(0.3, 0.59, 0.11));
  vec3 sunTint = normalize(uSunColor + 1e-3) * 1.732;
  vec3 lightSide = outCol * mix(vec3(1.0), sunTint * vec3(1.03, 1.0, 0.94), 0.28);
  vec3 shadeSide = mix(outCol, v0 * uShadeHue * 1.4, 0.16);
  vec3 lc = mix(shadeSide, lightSide, ll);
  lc *= v0 / max(dot(lc, vec3(0.3, 0.59, 0.11)), 1e-4);
  outCol = mix(outCol, lc, uLabLight * step(0.01, uLabFamily.x));
}
if (uLabMat.w > 0.5) {
  float labDist = length(cameraPosition - vWP);
  float labNdl = dot(N, uSunDir);
  // a wider light term than the cel terminator, so the band has room; the soft shadow map edge counts too
  float labWide = smoothstep(-0.22, 0.3, labNdl) * mix(shadow, 1.0, 0.15);
  float labEdge = 4.0 * labWide * (1.0 - labWide);
  float labLit = smoothstep(-0.04, 0.12, labNdl) * shadow;
  // core band: richer in the local hue, a touch warmer, same value
  vec3 hue = albedo / max(max(albedo.r, max(albedo.g, albedo.b)), 1e-3);
  vec3 rich = outCol * mix(vec3(1.0), hue * vec3(1.1, 0.98, 0.84), 0.55);
  float lv0 = dot(outCol, vec3(0.3, 0.59, 0.11)), lv1 = dot(rich, vec3(0.3, 0.59, 0.11));
  rich *= lv0 / max(lv1, 1e-4);
  outCol = mix(outCol, rich, labEdge * uLabMat.x * uLabFamily.x);
  // brush: courses along the surface
  vec3 up = abs(N.y) > 0.92 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 T = normalize(cross(up, N)); vec3 B = cross(N, T);
  vec2 suv = vec2(dot(vWP, T), dot(vWP, B));
  float bn = labBrush(suv, labDist) - 0.5;
  float body = mix(0.45, 1.0, labLit);                       // body colour is thicker in the light
  float fade = 1.0 - smoothstep(140.0, 420.0, labDist);      // far planes are left to the air
  outCol *= 1.0 + bn * 0.3 * body * fade * uLabMat.y * uLabFamily.y;
  // broken colour: warm/cool around the local colour, value kept
  float bc = aNoise(suv * 0.31 + 7.3) * 0.6 + aNoise(suv * 1.3) * 0.4 - 0.5;
  vec3 warm = vec3(1.05, 1.0, 0.92), cool = vec3(0.95, 0.99, 1.07);
  outCol *= mix(vec3(1.0), bc > 0.0 ? warm : cool, abs(bc) * 1.6 * fade * uLabMat.z * uLabFamily.z);
}
`;

// family strengths: core band, brush, broken colour
function family(name) {
  if (/grass|blade/i.test(name)) return [0.4, 0.0, 0.3];
  if (/leaf|crown|foliage|canopy|palm|shrub|lanshu|banyan|kapok|flora/i.test(name)) return [0.8, 0.25, 0.5];
  if (/glass/i.test(name)) return [0.0, 0.15, 0.2];
  if (/ground|paving|lawn/i.test(name)) return [0.6, 0.7, 0.9];
  if (/student|body|skin/i.test(name)) return [0.8, 0.0, 0.0];
  return [1.0, 1.0, 1.0];
}

/**
 * Walks a scene and pairs every cel material with a lab sibling.
 * Returns { base(), lab(), count, families } — swap all meshes to either set.
 */
export function pairMaterials(root) {
  const lab = new Map();
  const meshes = [];
  const families = {};
  const sibling = (m) => {
    if (!m || !m.userData?.celOpts) return m;
    if (!lab.has(m)) {
      const f = family(m.name || '');
      families[m.name || '?'] = f;
      const n = celLike(m, {
        key: 'lab1',
        uniforms: { ...LABM, uLabFamily: { value: new THREE.Vector3(...f) } },
        fragment: { head: HEAD, after: AFTER },
      });
      // celLike keeps the program hooks; copy the material state cel() does not carry
      n.transparent = m.transparent; n.depthWrite = m.depthWrite; n.alphaTest = m.alphaTest; n.side = m.side;
      n.polygonOffset = m.polygonOffset; n.polygonOffsetFactor = m.polygonOffsetFactor; n.polygonOffsetUnits = m.polygonOffsetUnits;
      if (m.alphaToCoverage) n.alphaToCoverage = true;
      lab.set(m, n);
    }
    return lab.get(m);
  };
  root.traverse((o) => {
    if (!o.isMesh && !o.isInstancedMesh) return;
    const base = o.material;
    const list = Array.isArray(base) ? base : [base];
    if (!list.some((m) => m?.userData?.celOpts)) return;
    const next = Array.isArray(base) ? list.map(sibling) : sibling(base);
    meshes.push({ o, base, lab: next });
  });
  let state = 'base';
  return {
    count: lab.size,
    meshes: meshes.length,
    families,
    get state() { return state; },
    base() { if (state === 'base') return; for (const m of meshes) m.o.material = m.base; state = 'base'; },
    lab() { if (state === 'lab') return; for (const m of meshes) m.o.material = m.lab; state = 'lab'; },
    /** meshes added later (the campus loads after the site) */
    extend(more) { const p = pairMaterials(more); return p; },
  };
}
