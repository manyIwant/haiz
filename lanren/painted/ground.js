// Layer 1 · the campus ground as gouache.
//
// The 入画 ground is one painted canvas over the whole campus (lanren/ruhua-stroll/ground.js): right for
// layout and colour, but at 15–25 cm a pixel it goes soft and smeared at your feet, and every surface —
// road, apron, lawn, the soil under a tree — is the same smooth paint. Here each kind of ground keeps
// that canvas as its colour and gets the marks a background painter would give it, in world space (so
// they never swim) and at sizes that fade out before they could shimmer:
//
//   lawn     three sizes of gouache dab and stroke combed along the wind and bent by a slow curl;
//            light marks lean yellow, dark ones blue (Painted Valley's rule for a meadow, kept because it
//            is how grass is painted); a broad slow patching so a lawn is never one green
//   paving   cement: aggregate grain near, worn and stained patches, slab joints drawn along the road's
//            own direction (a road map painted from the campus data) with a pixel-true line width; the
//            strokes are quieter than on grass — paving is a calm surface
//   soil     round every trunk: darker, warmer earth, roots of shade, and fallen leaves — 榄仁 leaves,
//            red and ochre in late autumn, as November's tree really drops them
//   shadow   every shadow on the ground becomes a shape with a crisp, brush-carried edge
//   wet      restrained: the reflection is posterised into a few painted values and broken by the brush
import * as THREE from 'three';
import { painter } from '../ruhua-stroll/ground.js';
import { celPlus, ART } from './art.js';

/** RGBA: rg = direction of the paving (doubled angle, so filtering never flips it), b = soil and leaf litter, a = road */
export function paintGroundClass(geo, trees, size = 1024) {
  const P = painter(geo.frame, size);
  const g = P.g;
  // default: no direction, no soil, not road
  g.fillStyle = 'rgb(128,128,0)'; g.globalAlpha = 1; g.fillRect(0, 0, size, size);
  const dirStyle = (theta, a) => {
    const r = Math.round((Math.cos(2 * theta) * 0.5 + 0.5) * 255), gg = Math.round((Math.sin(2 * theta) * 0.5 + 0.5) * 255);
    return `rgba(${r},${gg},0,${a})`;
  };
  const rect = (f, grow = 0) => {
    const [cx, cz] = P.toPx(f.cx, f.cz);
    g.save(); g.translate(cx, cz); g.rotate(-f.rot);
    g.beginPath(); g.rect(-(f.hw + grow) * P.k, -(f.hd + grow) * P.k, (f.hw + grow) * 2 * P.k, (f.hd + grow) * 2 * P.k);
    g.restore();
  };
  // aprons: the building's own direction (its long side)
  for (const f of geo.features) {
    if (f.kind !== 'building' && f.kind !== 'gate') continue;
    const theta = (f.hw >= f.hd ? -f.rot : -f.rot + Math.PI / 2);
    rect(f, 4.5); g.fillStyle = dirStyle(theta, 1); g.fill();
  }
  // roads: along the road
  for (const f of geo.features) {
    if (f.kind !== 'road') continue;
    const theta = (f.hw >= f.hd ? -f.rot : -f.rot + Math.PI / 2);
    rect(f); g.fillStyle = dirStyle(theta, 1); g.fill();
  }
  // road-ness in alpha, soil in blue: drawn into their own canvases, then merged
  const A = document.createElement('canvas'); A.width = A.height = size;
  const ag = A.getContext('2d');
  ag.fillStyle = '#000'; ag.fillRect(0, 0, size, size);
  const rectOn = (ctx, f, grow, style) => {
    const [cx, cz] = P.toPx(f.cx, f.cz);
    ctx.save(); ctx.translate(cx, cz); ctx.rotate(-f.rot);
    ctx.fillStyle = style;
    ctx.fillRect(-(f.hw + grow) * P.k, -(f.hd + grow) * P.k, (f.hw + grow) * 2 * P.k, (f.hd + grow) * 2 * P.k);
    ctx.restore();
  };
  for (const f of geo.features) if (f.kind === 'building' || f.kind === 'gate') rectOn(ag, f, 4.5, 'rgb(140,140,140)');
  for (const f of geo.features) if (f.kind === 'road') rectOn(ag, f, 0, '#fff');
  const B = document.createElement('canvas'); B.width = B.height = size;
  const bg = B.getContext('2d');
  bg.fillStyle = '#000'; bg.fillRect(0, 0, size, size);
  for (const t of trees) {
    const [x, z] = P.toPx(t.x, t.z);
    const lan = t.kind === 'lanshu', term = t.kind === 'terminalia' || lan;
    const crown = (lan ? 12 : t.kind === 'palm' ? 1.8 : t.kind === 'shrub' ? 0.9 : t.kind === 'banyan' ? 5.2 : 3.4) * (t.s || 1);
    // litter under the crown (leaves fall where the crown is), soil close to the trunk
    const litter = term ? 0.55 : t.kind === 'palm' || t.kind === 'shrub' ? 0.12 : 0.3;
    let gr = bg.createRadialGradient(x, z, 0, x, z, crown * P.k);
    gr.addColorStop(0, `rgba(255,255,255,${litter})`); gr.addColorStop(0.7, `rgba(255,255,255,${litter * 0.6})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    bg.fillStyle = gr; bg.beginPath(); bg.arc(x, z, crown * P.k, 0, Math.PI * 2); bg.fill();
    const soil = (lan ? 7.5 : t.kind === 'shrub' ? 0.7 : 1.3) * (t.s || 1);
    gr = bg.createRadialGradient(x, z, 0, x, z, soil * P.k);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    bg.fillStyle = gr; bg.beginPath(); bg.arc(x, z, soil * P.k, 0, Math.PI * 2); bg.fill();
  }
  const d = g.getImageData(0, 0, size, size), da = ag.getImageData(0, 0, size, size).data, db = bg.getImageData(0, 0, size, size).data;
  // litter density: 0..0.6 of blue; soil: above 0.6
  for (let i = 0; i < d.data.length; i += 4) { d.data[i + 2] = db[i]; d.data[i + 3] = da[i]; }
  const tex = new THREE.DataTexture(new Uint8Array(d.data.buffer.slice(0)), size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.flipY = false; tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return { tex, P };
}

// painted shadows on any surface (pre hook: runs once the shadow map is read)
export const SHADOW_PRE = (scale = '1.7') => /* glsl */`
{
  float bS = artDab(vWP.xz / ${scale} + vWP.y * 0.21);
  shadow = mix(shadow, artShadow(shadow, bS), uArt * ART_LAYER * 0.9);
}
`;

const GROUND_HEAD = 'uniform sampler2D uGClass; uniform vec2 uGClassO; uniform float uGClassS;\n#define ART_LAYER uArtL.x\n';
const GROUND_ALBEDO = /* glsl */`
{
  float kA = uArt * uArtL.x;
  vec2 cuv = (vWP.xz - uGClassO) / uGClassS;
  vec4 gc = texture2D(uGClass, cuv);
  float foot = artFoot(vWP);
  float dist = length(cameraPosition - vWP);
  float road = gc.a;
  float soilK = smoothstep(0.62, 0.95, gc.b) * inside * (1.0 - lawn * 0.75);
  float litK = smoothstep(0.05, 0.6, gc.b) * inside;
  // the direction the marks lie: paving along its own map, lawn along the wind, bent by a slow curl
  vec2 d2 = gc.rg * 2.0 - 1.0;
  float angP = 0.5 * atan(d2.y, d2.x);
  float angW = atan(uWindDir.y, uWindDir.x) + (aNoise(vWP.xz * 0.035 + 2.0) - 0.5) * 1.8;
  float hasDir = smoothstep(0.08, 0.3, length(d2));
  vec2 sdP = vec2(cos(angP), sin(angP)), sdW = vec2(cos(angW), sin(angW));
  vec2 sd = normalize(mix(sdW, sdP, hasDir * (1.0 - lawn)) + 1e-4);
  vec2 q = vec2(dot(vWP.xz, sd), dot(vWP.xz, vec2(-sd.y, sd.x)));
  // three sizes of mark: dabs (0.9 m), strokes (4 m, dragged along), washes (22 m)
  float tN = artDab(q / vec2(1.05, 0.72) + 0.13) * artVis(0.55, foot);
  float tM = artStroke(q / vec2(5.5, 1.6) + 0.31) * artVis(1.4, foot);
  float tF = artDab(vWP.xz / 23.0 + 0.6);
  float tB = (aFbm(vWP.xz * 0.018 + 4.0) - 0.5);
  // lawn: gouache greens — light marks lean yellow, dark ones blue
  float tl = tN * 0.55 + tM * 0.75 + tF * 0.7 + tB * 0.5;
  // a lawn painted in three greens, not shaded in a thousand: the marks choose which green each place is.
  // (deep and cool, the lawn's own, sunlit and warm; the turns widen far off so they never alias)
  float tone = 0.5 + tl * 1.15;
  float wT = 0.03 + 0.12 * smoothstep(0.03, 0.25, foot);
  vec3 lb0 = mix(albedo, vec3(artLuma(albedo)), 0.1);
  vec3 deepG = lb0 * vec3(0.7, 0.83, 1.0) * 0.76;
  vec3 liteG = lb0 * vec3(1.12, 1.08, 0.82) * 1.17;
  vec3 lawnC = mix(deepG, lb0, smoothstep(0.37 - wT, 0.37 + wT, tone));
  lawnC = mix(lawnC, liteG, smoothstep(0.66 - wT, 0.66 + wT, tone));
  // paving: cement, calmer marks, grain, worn patches, joints
  float grain = artGrain(vWP.xz / 0.42) * artVis(0.05, foot) + artGrain(vWP.xz / 1.9 + 0.5) * 0.6 * artVis(0.22, foot);
  float worn = smoothstep(0.52, 0.78, aFbm(vWP.xz * 0.09 + 11.0));
  float tp = tN * 0.22 + tM * 0.3 + tF * 0.35 + tB * 0.3;
  vec3 paveC = albedo * (1.0 + tp * 0.12 + grain * 0.13);
  // two tones of cement, the marks deciding where the older, darker one shows
  paveC *= mix(0.93, 1.035, smoothstep(0.5 - wT, 0.5 + wT, 0.5 + tp * 1.6));
  paveC *= mix(vec3(1.0), vec3(0.9, 0.9, 0.9), worn * 0.55);
  paveC = mix(paveC, paveC * vec3(1.05, 1.02, 0.95), smoothstep(0.55, 0.8, tF + 0.5) * 0.4);
  // slab joints, along the paving's direction: 2.4 m across a road, 3 m along it; aprons a 1.2 m grid.
  // A line is as wide as a pixel wherever it is, and gone once a slab is a few pixels.
  float sl = mix(1.2, 2.4, road), sa = mix(1.2, 3.0, road);
  vec2 jq = q / vec2(sl, sa);
  vec2 jw = fwidth(jq) * 0.9 + 1e-5;
  vec2 jl = 1.0 - smoothstep(vec2(0.5), vec2(1.6), abs(fract(jq + 0.5) - 0.5) / jw);
  float joint = max(jl.x, jl.y) * hasDir * (1.0 - smoothstep(0.035, 0.1, foot)) * step(0.3, road + 0.1);
  paveC *= 1.0 - joint * 0.2;
  vec3 a2 = mix(paveC, lawnC, lawn);
  // soil round the trunks: warmer, darker earth with strokes of root and shade, then fallen leaves
  vec3 soilC = mix(vec3(0.17, 0.12, 0.08), vec3(0.24, 0.18, 0.11), 0.5 + tN + tM * 0.6);
  a2 = mix(a2, soilC, soilK * 0.85);
  // fallen leaves at their real size (a 榄仁 leaf is 15–25 cm), in loose drifts, fewer on the lawn
  vec2 lq = vWP.xz / 2.3;
  vec4 lb = texture2D(uBrush, lq + 0.37);
  float lh = aHash(floor(lq * 9.0) + 0.5);
  float drift = smoothstep(0.35, 0.75, aNoise(vWP.xz * 0.45 + 7.0));
  float leafM = smoothstep(0.45, 0.65, lb.a) * step(1.0 - litK * drift * mix(1.0, 0.4, lawn), aHash(floor(lq * 4.5) + 3.1)) * artVis(0.12, foot);
  vec3 leafC = lh < 0.35 ? vec3(0.42, 0.09, 0.04) : lh < 0.6 ? vec3(0.55, 0.22, 0.06) : lh < 0.8 ? vec3(0.6, 0.42, 0.12) : vec3(0.3, 0.27, 0.12);
  a2 = mix(a2, leafC * (0.85 + 0.3 * lb.r), leafM * 0.9);
  albedo = mix(albedo, a2, kA);
  haizInfo = vec4(0.0, 0.0, 0.06 * (1.0 - lawn), mix(0.6, 0.85, lawn));
}
`;
// the wet ground, painted: the sheen falls into a few values and is broken by the brush
const GROUND_AFTER = /* glsl */`
if (uWet > 0.001 || pud > 0.001) {
  float kW = uArt * uArtL.x;
  float l = artLuma(outCol);
  float bW = artDab(vWP.xz / 2.2 + 0.4);
  float lq = artSteps(clamp(l * 1.4 + bW * 0.12, 0.0, 1.5) / 1.5, 4.0, 0.12) * 1.5 / 1.4;
  outCol = mix(outCol, outCol * (lq / max(l, 1e-4)), kW * clamp(uWet + pud, 0.0, 1.0) * 0.6);
}
`;

export function upgradeGround(world) {
  const ground = world.ground;
  const cls = paintGroundClass(world.geo, [...world.trees, ...world.beds.map((b) => ({ ...b, kind: 'shrub' })), { x: 0, z: 0, kind: 'lanshu', s: 1.25 }]);
  const old = ground.mesh.material;
  const m = celPlus(old, {
    key: 'ground', info: 'vec4(0.0, 0.0, 0.06, 0.65)',
    uniforms: { uGClass: { value: cls.tex }, uGClassO: { value: new THREE.Vector2(cls.P.x0, cls.P.z0) }, uGClassS: { value: cls.P.span } },
    fragment: { head: GROUND_HEAD, pre: SHADOW_PRE('1.7'), albedo: GROUND_ALBEDO, after: GROUND_AFTER },
  });
  ground.mesh.material = m;
  ground.artClass = cls;
  return { material: m, classTex: cls.tex, uniforms: ART };
}
