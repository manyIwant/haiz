// Layer 2 · plants in one wind, and layer 4 · the 榄仁 painted as itself.
//
//   grass    the 4 m tile layouts stay (world-anchored, three distances). What changes is how a ring
//            hands over to the next: before, every blade of a ring shrank together across its fade band,
//            so the band showed as a lower, thinner lawn moving with you. Now each blade has its own
//            moment in the band (Painted Valley's rule) and goes quickly in that moment, so a ring is a
//            density that thins, never a height that sinks. A blade's root colour also takes the
//            ground's new brushwork, so blades grow out of the same strokes they stand in
//   crowns   every tree kit's crown is lit as a volume — the leaf card's own normal is a card's; the
//            crown's is a ball round the crown's centre (measured from each kit's leaves) — and painted
//            in four greens by tone with a cool deep inside and a warm lit side. Near cards tremble a
//            little in the gusts, far crowns only lean (the trunk's sway is as it was: the shared gust
//            field reaches a crown a moment after it crosses the lawn)
//   榄仁      the six chapters' own tree keeps its own bark mesh, its rosettes and its pads: its tiers
//            read as tiers because each pad is lit as a mass (light on top, cool underneath), the
//            silhouette is its real one, November's red leaves stay red. Bark gets long strokes along
//            the wood and the painted light
import * as THREE from 'three';
import { celPlus, ART, TOGGLES } from './art.js';
import { SHADOW_PRE } from './ground.js';

// ---------------------------------------------------------------- grass
function upgradeGrassLayer(mesh) {
  const old = mesh.material;
  const o = old.userData.celOpts;
  const begin = o.vertex.begin;
  // each blade fades in its own window inside the band (no sinking ring)
  const keyed = begin.replace(' * fade * keep * ', ' * smoothstep(bladeR * 0.78, bladeR * 0.78 + 0.22, fade) * keep * ')
    .replace('float patchN =', 'float bladeR = aHash(root * 3.71 + aRnd.yz * 17.0);\n  float patchN =')
    .replace('vGround = g; vGust = gust;', /* glsl */`
  {
    // the same strokes the ground carries here (the broad and middle ones: a blade is wider than a dab)
    vec2 sdW = vec2(cos(atan(uWindDir.y, uWindDir.x) + (aNoise(root * 0.035 + 2.0) - 0.5) * 1.8), 0.0);
    sdW.y = sin(atan(uWindDir.y, uWindDir.x) + (aNoise(root * 0.035 + 2.0) - 0.5) * 1.8);
    vec2 qa = vec2(dot(root, sdW), dot(root, vec2(-sdW.y, sdW.x)));
    float tM = textureLod(uBrush, qa / vec2(5.5, 1.6) + 0.31, 1.0).g - 0.5;
    float tF = textureLod(uBrush, root / 23.0 + 0.6, 0.0).r - 0.5;
    float tl = tM * 0.75 + tF * 0.7 + (aFbm(root * 0.018 + 4.0) - 0.5) * 0.5;
    // the ground's three greens (ground.js), so a blade's root is the green of the patch it grows in
    float tone = 0.5 + tl * 1.15;
    vec3 lb0 = mix(g, vec3(dot(g, vec3(0.2126, 0.7152, 0.0722))), 0.1);
    vec3 ga = mix(lb0 * vec3(0.7, 0.83, 1.0) * 0.76, lb0, smoothstep(0.32, 0.42, tone));
    ga = mix(ga, lb0 * vec3(1.12, 1.08, 0.82) * 1.17, smoothstep(0.61, 0.71, tone));
    g = mix(g, ga, uArt * uArtL.y);
  }
  vGround = g; vGust = gust;`);
  if (keyed === begin || !keyed.includes('bladeR * 0.78')) { console.warn('painted: grass shader changed, kept as it was'); return null; }
  const m = celPlus(old, {
    key: 'grass', info: 'vec4(0.0, 0.0, 0.0, 0.8)',
    vertexReplace: { begin: keyed },
    vertex: { head: 'uniform float uArt; uniform vec4 uArtL; uniform sampler2D uBrush;\n' },
    fragment: { head: '#define ART_LAYER uArtL.y\n', pre: SHADOW_PRE('1.7') },
  });
  m.side = old.side;
  mesh.material = m;
  return m;
}

// ---------------------------------------------------------------- crowns (the kit trees and the beds)
const CROWN_V_HEAD = 'uniform vec3 uCrownC; uniform vec3 uCrownR; uniform float uArt; uniform vec4 uArtL; varying vec3 vBall; varying float vNearF;\n';
const CROWN_V_BEGIN = /* glsl */`
{
  // near cards tremble a little in the gusts (a crown far off only leans: the sway above)
  vec3 ipc = vec3(0.0);
  #ifdef USE_INSTANCING
    ipc = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #endif
  float gq = windField(ipc.xz + position.xz * 0.3);
  float ph = aData.a * 37.0 + dot(position, vec3(3.1, 1.7, 2.3));
  float nearF = 1.0 - smoothstep(12.0, 30.0, length(cameraPosition - ipc));
  vNearF = nearF;
  transformed += normal * sin(uTime * (6.0 + 3.0 * aData.a) + ph) * 0.018 * (0.25 + gq) * uWindSway * nearF * uArt * uArtL.y;
}
`;
const CROWN_V_WORLD = /* glsl */`
{
  // the crown's ball: from its centre, through the instance's rotation and scale (as a normal transforms)
  vec3 g = (position - uCrownC) / (uCrownR * uCrownR);
  mat3 M = mat3(modelMatrix);
  #ifdef USE_INSTANCING
    M = M * mat3(instanceMatrix);
  #endif
  vec3 s2 = vec3(dot(M[0], M[0]), dot(M[1], M[1]), dot(M[2], M[2]));
  vBall = normalize(M * (g / s2) + vec3(0.0, 1e-4, 0.0));
}
`;
const CROWN_F = {
  head: 'varying vec3 vBall; varying float vNearF; uniform float uLeafMean;\n#define ART_LAYER uArtL.y\n',
  after: /* glsl */`
{
  float kF = uArt * uArtL.y;
  vec3 Nc = normalize(vBall * 0.8 + N * 0.28);
  float dist = length(cameraPosition - vWP);
  float far = smoothstep(18.0, 110.0, dist);
  // the leaf card's own painted shading is taken out of its colour and kept only as a small tone offset,
  // so the crown's volume (not each card) decides light and shade
  float texR = artLuma(texture2D(map, vMapUv).rgb) / uLeafMean;
  vec3 hueA = albedo / clamp(texR, 0.35, 2.5);
  vec3 f = artFoliage(hueA, Nc, vWP, shadow, ao, card + (texR - 1.0) * 0.45 * (1.0 - far), far);
  // seen against the sun the lit edge glows (kept from the walk's leaves)
  vec3 vd = normalize(vWP - cameraPosition);
  f += uSunColor * albedo * pow(max(dot(vd, uSunDir), 0.0), 3.0) * 0.5 * vData.r * (0.4 + 0.6 * shadow);
  f += uSkyAmb * 0.06 * uWet * smoothstep(0.2, 0.9, Nc.y * 0.5 + 0.5);
  outCol = mix(outCol, f, kF);
}
`,
};

function crownOf(geometry) {
  geometry.computeBoundingBox();
  const b = geometry.boundingBox;
  const c = b.getCenter(new THREE.Vector3()), r = b.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  // a crown is rounder than its bounding box: lift the centre a little, keep the radii honest
  c.y += r.y * 0.08;
  r.max(new THREE.Vector3(0.3, 0.3, 0.3));
  return { c, r };
}

function upgradeLeaves(mesh, cache) {
  const old = mesh.material;
  const key = old.uuid + ':' + mesh.geometry.uuid;
  if (!cache.has(key)) {
    const { c, r } = crownOf(mesh.geometry);
    const m = celPlus(old, {
      key: 'crown', info: 'vec4(0.0, 0.0, 0.0, 1.0)',
      uniforms: { uCrownC: { value: c }, uCrownR: { value: r }, uLeafMean: LEAF_MEAN },
      vertex: { head: CROWN_V_HEAD, begin: CROWN_V_BEGIN, world: CROWN_V_WORLD },
      fragment: { head: CROWN_F.head, pre: SHADOW_PRE('2.3'), after: CROWN_F.after },
    });
    m.side = old.side; m.alphaTest = old.alphaTest; m.alphaToCoverage = old.alphaToCoverage;
    cache.set(key, m);
  }
  mesh.material = cache.get(key);
}

const BARK_F = {
  head: '#define ART_LAYER uArtL.y\n',
  albedo: /* glsl */`
{
  float kB = uArt * uArtL.y;
  // long strokes along the wood (vertical), a few lighter where the sky reaches
  float st = artStroke(vec2(vWP.y / 2.4, dot(vWP.xz, vec2(0.71, 0.71)) / 0.22) + 0.2);
  albedo = mix(albedo, albedo * (1.0 + st * 0.35) * mix(vec3(0.95, 0.97, 1.02), vec3(1.05, 1.0, 0.94), clamp(0.5 + st * 2.0, 0.0, 1.0)), kB);
}
`,
  after: /* glsl */`
{
  float kB = uArt * uArtL.y;
  float bL = artDab(vec2(vWP.y, vWP.x + vWP.z) / 1.3);
  outCol = mix(outCol, artLight(albedo, N, vWP, shadow, ao, soft + 0.04, bL), kB);
}
`,
};

// ---------------------------------------------------------------- the 榄仁
const HERO_CROWN_V_BEGIN = /* glsl */`
{
  // each card trembles round its rosette in the gust that reaches it (the V4 sway above moves the rosette)
  mat3 invA = transpose(mat3(modelMatrix));
  vec3 Ra = invA * vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 Ua = invA * vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 wc = (modelMatrix * vec4(aC.xyz, 1.0)).xyz;
  float gq = windField(wc.xz);
  float ph = uTime * (3.2 + 2.4 * aS.w) + aS.w * 43.0;
  transformed += (Ra * sin(ph) + Ua * cos(ph * 1.3)) * aS.x * 0.035 * (0.3 + gq) * uWindSway * uArt * uArtL.y;
}
`;
const HERO_CROWN_F = {
  head: 'uniform float uLeafMean;\n#define ART_LAYER uArtL.y\n',
  after: /* glsl */`
{
  float kF = uArt * uArtL.y;
  float dist = length(cameraPosition - vWP);
  float far = smoothstep(20.0, 120.0, dist);
  float texR = artLuma(texture2D(map, vMapUv).rgb) / uLeafMean;
  vec3 hueA = albedo / clamp(texR, 0.35, 2.5);
  vec3 f = artFoliage(hueA, N, vWP, shadow, ao, vRnd + (texR - 1.0) * 0.45 * (1.0 - far), far);
  vec3 vd = normalize(vWP - cameraPosition);
  f += uSunColor * albedo * pow(max(dot(vd, uSunDir), 0.0), 3.0) * 0.45 * (0.4 + 0.6 * shadow) * vOcc;
  f += uSkyAmb * 0.06 * uWet * smoothstep(0.2, 0.9, N.y * 0.5 + 0.5);
  outCol = mix(outCol, f, kF);
}
`,
};
const HERO_BARK_F = {
  head: '#define ART_LAYER uArtL.y\n',
  albedo: /* glsl */`
{
  float kB = uArt * uArtL.y;
  // strokes running along the wood: the tree-space height and the angle round the trunk
  float st = artStroke(vec2(vBkP.y / 2.0 + 0.1, atan(vBkP.x, vBkP.z) * 1.6));
  float dab = artDab(vec2(atan(vBkP.x, vBkP.z) * 0.9, vBkP.y * 0.45) + 0.3);
  vec3 a = albedo * (1.0 + st * 0.4 + dab * 0.2);
  a = mix(a, a * vec3(0.9, 0.98, 1.06), smoothstep(0.1, 0.35, -st) * 0.5);
  albedo = mix(albedo, a, kB);
}
`,
  after: BARK_F.after,
};

// ---------------------------------------------------------------- the 榄仁's own leaves
// Terminalia catappa carries its leaves in rosettes at the tips of its tiered branches: 8–14 large obovate
// leaves (broad and rounded toward the tip, narrowing to a short stalk), radiating from one point. The walk's
// leaf atlas is a generic jagged cluster; this one draws the rosette, four variants in the same 2×2 layout the
// painted crown already reads (cell = aS.y). White-grey with a little tone per leaf: colour comes from the
// crown's own season colour, light from the painted foliage light.
export function rosetteAtlas(size = 512) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d', { willReadFrequently: true });
  let seed = 7121;
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const cell = size / 2;
  for (let k = 0; k < 4; k++) {
    const cx = (k % 2) * cell + cell / 2, cy = Math.floor(k / 2) * cell + cell / 2;
    const n = 9 + Math.floor(r() * 5);
    const a0 = r() * Math.PI * 2;
    // two whorls: the outer leaves longer, the inner ones shorter and turned between them
    for (const ring of [0, 1]) {
      const m = ring ? Math.max(4, Math.floor(n * 0.55)) : n;
      for (let i = 0; i < m; i++) {
        const a = a0 + (i + (ring ? 0.5 : 0) + (r() - 0.5) * 0.35) / m * Math.PI * 2;
        const len = cell * (ring ? 0.27 + 0.08 * r() : 0.36 + 0.1 * r());
        const wid = len * (0.42 + 0.1 * r());
        const tone = Math.round((ring ? 236 : 210) + r() * 19);
        g.save(); g.translate(cx, cy); g.rotate(a);
        g.fillStyle = `rgb(${tone},${tone},${tone})`;
        g.beginPath();
        g.moveTo(cell * 0.03, 0);
        g.bezierCurveTo(len * 0.35, -wid * 0.18, len * 0.62, -wid * 0.62, len * 0.92, -wid * 0.38);
        g.quadraticCurveTo(len * 1.04, 0, len * 0.92, wid * 0.38);
        g.bezierCurveTo(len * 0.62, wid * 0.62, len * 0.35, wid * 0.18, cell * 0.03, 0);
        g.fill();
        // the midrib and a shade on the inner half: a painted leaf, not a flat cut-out
        g.strokeStyle = `rgba(150,150,150,0.55)`; g.lineWidth = Math.max(1, len * 0.025);
        g.beginPath(); g.moveTo(cell * 0.05, 0); g.lineTo(len * 0.9, 0); g.stroke();
        g.fillStyle = 'rgba(120,120,120,0.18)';
        g.beginPath(); g.moveTo(cell * 0.03, 0); g.bezierCurveTo(len * 0.35, wid * 0.18, len * 0.62, wid * 0.62, len * 0.92, wid * 0.38); g.lineTo(len * 0.9, 0); g.closePath(); g.fill();
        g.restore();
      }
    }
  }
  const d = g.getImageData(0, 0, size, size);
  // fill the empty texels with the leaves' grey so mipmaps do not darken the edges
  for (let i = 0; i < d.data.length; i += 4) if (d.data[i + 3] < 8) { d.data[i] = d.data[i + 1] = d.data[i + 2] = 215; d.data[i + 3] = 0; }
  const tex = new THREE.DataTexture(new Uint8Array(d.data.buffer.slice(0)), size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  // the crown's uvs follow the walk's atlas: v = 0 is the image's bottom row
  tex.flipY = false;
  const flipped = new Uint8Array(tex.image.data.length), row = size * 4;
  for (let y = 0; y < size; y++) flipped.set(tex.image.data.subarray((size - 1 - y) * row, (size - y) * row), y * row);
  tex.image.data = flipped;
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = 4;
  tex.needsUpdate = true;
  let s = 0, cnt = 0;
  for (let i = 0; i < d.data.length; i += 4) if (d.data[i + 3] > 128) { s += d.data[i] / 255; cnt++; }
  return { tex, mean: cnt ? s / cnt : 0.85 };
}

// the mean brightness of the walk's leaf atlas where there is leaf (the atlas is read as raw values)
const LEAF_MEAN = { value: 0.5 };
const HERO_LEAF_MEAN = { value: 0.85 };
function measureLeaves(tex) {
  const img = tex?.image;
  if (!img?.width) return;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d', { willReadFrequently: true });
  try { g.drawImage(img, 0, 0, 64, 64); } catch { return; }
  const d = g.getImageData(0, 0, 64, 64).data;
  let s = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { s += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; n++; }
  if (n > 20) LEAF_MEAN.value = s / n;
}

export function upgradeFlora(world) {
  measureLeaves(world.tree.crown.material.map);
  const cache = new Map(), bark = new Map();
  let crowns = 0, grass = 0;
  world.flora.group.traverse((o) => {
    if (!o.isMesh || !o.material?.userData?.celOpts) return;
    if (/_leaf_/.test(o.name)) { upgradeLeaves(o, cache); crowns++; }
    else if (/_trunk_/.test(o.name)) {
      const old = o.material;
      if (!bark.has(old)) bark.set(old, celPlus(old, { key: 'bark', info: 'vec4(0.0, 0.0, 0.45, 0.55)', fragment: { head: BARK_F.head, pre: SHADOW_PRE('1.5'), albedo: BARK_F.albedo, after: BARK_F.after } }));
      o.material = bark.get(old);
    } else if (o.name === 'taihu') {
      o.material = celPlus(o.material, { key: 'stone', info: 'vec4(0.0, 0.0, 0.5, 0.5)', fragment: { head: '#define ART_LAYER uArtL.x\n', pre: SHADOW_PRE('1.2'), after: BARK_F.after.replace(/uArtL\.y/g, 'uArtL.x') } });
    }
  });
  for (const layer of world.grass.layers) if (upgradeGrassLayer(layer.mesh)) grass++;
  // the 榄仁
  const T = world.tree;
  const crown = T.crown.material;
  const heroCrown = celPlus(crown, {
    key: 'hero-crown', info: 'vec4(0.0, 0.0, 0.0, 1.0)', uniforms: { uLeafMean: HERO_LEAF_MEAN },
    vertex: { head: 'uniform float uArt; uniform vec4 uArtL;\n', begin: HERO_CROWN_V_BEGIN },
    fragment: { head: HERO_CROWN_F.head, pre: SHADOW_PRE('2.6'), after: HERO_CROWN_F.after },
  });
  heroCrown.side = crown.side; heroCrown.alphaTest = crown.alphaTest; heroCrown.alphaToCoverage = crown.alphaToCoverage;
  // the 榄仁's own rosettes (its shadow caster keeps the walk's atlas: the shape of the shade is the same mass)
  const ros = rosetteAtlas();
  const walkAtlas = heroCrown.map;
  heroCrown.map = ros.tex;
  HERO_LEAF_MEAN.value = ros.mean;
  TOGGLES.push({ on() { heroCrown.map = ros.tex; }, off() { heroCrown.map = walkAtlas; } });
  T.crown.material = heroCrown;
  T.bark.material = celPlus(T.bark.material, { key: 'hero-bark', info: 'vec4(0.0, 0.0, 0.45, 0.5)', fragment: { head: HERO_BARK_F.head, pre: SHADOW_PRE('1.4'), albedo: HERO_BARK_F.albedo, after: HERO_BARK_F.after } });
  T.islet.material = celPlus(T.islet.material, { key: 'hero-islet', info: 'vec4(0.0, 0.0, 0.3, 0.55)', fragment: { head: '#define ART_LAYER uArtL.x\n', pre: SHADOW_PRE('1.3'), after: BARK_F.after.replace(/uArtL\.y/g, 'uArtL.x') } });
  return { crowns, grass, materials: cache.size + bark.size + 3, uniforms: ART };
}
