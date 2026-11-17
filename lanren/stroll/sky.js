// The sky, V2. V1 computed clouds per pixel from discs; in portrait they grew into flat rocks and
// they had no hierarchy (an even scatter of look-alike blobs). Here the clouds are painted cards
// (scripts/stroll/build_clouds.py): normal + thickness + distance-field silhouettes, lit from the
// real sun, arranged as a composition — a towering hero mass behind the default view, broad banks
// on the other horizons, smaller clusters higher up, pale far banks sinking into the haze. Cards
// keep their drawn shape at any aspect ratio and cost a texture read, not a noise loop.
// The dome itself is the shared skyColor() (so the air matches it) plus a faint cirrus veil.
import * as THREE from 'three';
import { U, GLSL } from './atmos.js';

export const SKY = {
  uCloudLit: { value: new THREE.Color(1.08, 1.06, 1.02) },
  uCloudMid: { value: new THREE.Color(0.8, 0.86, 0.95) },
  uCloudShade: { value: new THREE.Color(0.5, 0.58, 0.76) },
  uCloudRim: { value: new THREE.Color(1.2, 1.15, 1.05) },
  uCloudHaze: { value: 1 / 9000 },
  uCirrus: { value: 0.35 },
  uSunDisc: { value: 5.0 },
};

const DOME_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  vec4 p = projectionMatrix * viewMatrix * vec4(cameraPosition + vDir * 4000.0, 1.0);
  gl_Position = p.xyww;
}`;
const DOME_FRAG = /* glsl */`
${GLSL}
uniform vec3 uCloudLit; uniform vec3 uCloudShade; uniform float uCirrus; uniform float uSunDisc;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 c = skyColor(d);
  float s = max(dot(d, uSunDir), 0.0);
  c += uSunGlow * (smoothstep(0.99965, 0.99985, s) * uSunDisc);
  // a high cirrus veil: long strokes along the wind, strongest overhead, gone at the horizon
  if (d.y > 0.05) {
    vec2 p = d.xz / (d.y + 0.25);
    vec2 w = normalize(uWindDir);
    vec2 q = vec2(dot(p, w), dot(p, vec2(-w.y, w.x)));
    float n = aFbm(vec2(q.x * 1.2, q.y * 7.0) + vec2(uTime * 0.004, 0.0));
    float m = aNoise(q * 0.6 + 3.0);
    float ci = smoothstep(0.55, 0.85, n) * smoothstep(0.35, 0.7, m) * smoothstep(0.05, 0.4, d.y) * uCirrus;
    vec3 cc = mix(uCloudShade, uCloudLit, 0.55 + 0.45 * s);
    c = mix(c, cc, ci * 0.55);
  }
  gl_FragColor = vec4(c, 1.0);
}`;

const CARD_VERT = /* glsl */`
attribute vec3 aCenter; attribute vec3 aCard;   // centre (cloud-group space); width, height, flip
varying vec2 vUv; varying vec2 vLocal; varying vec3 vWP; varying vec3 vRight; varying vec3 vToCam; varying float vDist; varying float vFlip;
void main() {
  vec3 c = (modelMatrix * vec4(aCenter, 1.0)).xyz;
  float sx = aCard.x, sy = aCard.y;
  vFlip = aCard.z;
  vec3 toCam = cameraPosition - c; toCam.y = 0.0; toCam = normalize(toCam);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
  vec3 wp = c + right * position.x * sx + vec3(0.0, 1.0, 0.0) * position.y * sy;
  vUv = uv; vLocal = position.xy + 0.5; vWP = wp; vRight = right; vToCam = toCam; vDist = length(c - cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const CARD_FRAG = /* glsl */`
${GLSL}
uniform sampler2D uAtlas; uniform vec3 uCloudLit; uniform vec3 uCloudMid; uniform vec3 uCloudShade; uniform vec3 uCloudRim;
uniform float uCloudHaze; uniform float uOpacity;
varying vec2 vUv; varying vec2 vLocal; varying vec3 vWP; varying vec3 vRight; varying vec3 vToCam; varying float vDist; varying float vFlip;
void main() {
  vec4 t = texture2D(uAtlas, vUv);
  float w = fwidth(t.a) * 0.85 + 0.003;
  float alpha = smoothstep(0.5 - w, 0.5 + w, t.a);
  if (alpha < 0.004) discard;
  vec3 n = vec3((t.r * 2.0 - 1.0) * vFlip, t.g * 2.0 - 1.0, 0.0);
  n.z = sqrt(max(0.05, 1.0 - dot(n.xy, n.xy)));
  n = normalize(n);
  vec3 L = normalize(vec3(dot(uSunDir, vRight), uSunDir.y, dot(uSunDir, vToCam)));
  float lit = dot(n, L) * 0.5 + 0.5;
  lit *= mix(1.0, 0.8, t.b);                                   // thick cores shade deeper
  lit *= mix(0.74, 1.0, smoothstep(0.08, 0.42, vLocal.y));    // the cool underside
  vec3 c = mix(uCloudShade, uCloudMid, smoothstep(0.33, 0.5, lit));
  c = mix(c, uCloudLit, smoothstep(0.6, 0.78, lit));
  float behind = max(0.0, -L.z);
  float edge = 1.0 - smoothstep(0.5, 0.57, t.a);
  c += uCloudRim * edge * (0.25 + behind) * smoothstep(0.0, 0.3, lit + behind * 0.5) * 0.85;
  c += uCloudRim * (1.0 - t.b) * pow(behind, 3.0) * 0.22;
  vec3 dir = normalize(vWP - cameraPosition);
  vec3 hz = skyColor(normalize(vec3(dir.x, max(dir.y, 0.0) * 0.3 + 0.015, dir.z)));
  float haze = clamp(vDist * uCloudHaze, 0.0, 0.8) + smoothstep(0.32, 0.02, vLocal.y) * 0.32;
  c = mix(c, hz, clamp(haze, 0.0, 0.88));
  gl_FragColor = vec4(c, alpha * uOpacity);
}`;

// the composition: azimuth (0 = campus south, +Z; 90 = east, +X), distance, base altitude, width, atlas cell
const LAYOUT = [
  // the hero group behind the default view (south): a tower over the teaching blocks, a bank behind it
  [8, 2500, 330, 1500, 0], [-20, 3100, 280, 1900, 2], [36, 2100, 430, 720, 4], [-48, 2300, 520, 640, 5],
  // east
  [82, 2800, 320, 1500, 3], [112, 2000, 520, 700, 4], [62, 1700, 640, 520, 5],
  // north
  [172, 2700, 300, 1400, 1], [148, 3300, 260, 1900, 2], [206, 2300, 520, 700, 5],
  // west (the golden-hour sun sets here: these light up from behind)
  [-96, 2900, 330, 1600, 3], [-70, 2100, 620, 640, 5], [-128, 2500, 410, 950, 4], [-112, 1600, 760, 480, 6],
  // higher, smaller: what a portrait screen sees when it looks up
  [40, 1250, 980, 560, 5], [-36, 1450, 1080, 620, 4], [138, 1350, 1000, 520, 4], [-152, 1200, 900, 520, 5],
  // pale far banks low on the horizon
  [58, 4300, 140, 2100, 2], [-52, 4400, 150, 2300, 3], [232, 4200, 140, 2100, 2], [124, 4300, 160, 2200, 3], [-160, 4300, 150, 2200, 2],
];

export function createSky(atlasUrl) {
  const group = new THREE.Group();
  group.name = 'sky';
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.ShaderMaterial({
    vertexShader: DOME_VERT, fragmentShader: DOME_FRAG, uniforms: { ...U, ...SKY }, depthWrite: false, side: THREE.BackSide,
  }));
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  group.add(dome);
  const clouds = new THREE.Group();
  clouds.name = 'clouds';
  group.add(clouds);
  const atlas = new THREE.TextureLoader().load(atlasUrl);
  atlas.colorSpace = THREE.NoColorSpace;
  atlas.generateMipmaps = true;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.anisotropy = 4;
  const mat = new THREE.ShaderMaterial({
    vertexShader: CARD_VERT, fragmentShader: CARD_FRAG, transparent: true, depthWrite: false,
    uniforms: { ...U, ...SKY, uAtlas: { value: atlas }, uOpacity: { value: 1 } },
  });
  // all cards in one geometry (one draw call), far ones first so the usual view composites in order
  const cards = LAYOUT.map(([az, d, alt, w, cell], i) => ({ az, d, alt, w, cell, flip: i % 3 === 1 ? -1 : 1 })).sort((a, b) => b.d - a.d);
  const pos = [], uvs = [], ctr = [], card = [], idx = [];
  cards.forEach((k, i) => {
    const a = k.az * Math.PI / 180, h = k.w * 0.5;
    const c = [Math.sin(a) * k.d, -0.85 + k.alt + h * 0.38, Math.cos(a) * k.d];
    const col = k.cell % 2, row = k.cell >> 1;
    [[-0.5, -0.5, 0, 0], [0.5, -0.5, 1, 0], [0.5, 0.5, 1, 1], [-0.5, 0.5, 0, 1]].forEach(([x, y, u, v]) => {
      pos.push(x, y, 0);
      const uu = k.flip < 0 ? 1 - u : u;
      uvs.push((col + uu) * 0.5, 1 - (row + 1 - v) * 0.25);
      ctr.push(...c); card.push(k.w, h, k.flip);
    });
    idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('aCenter', new THREE.Float32BufferAttribute(ctr, 3));
  g.setAttribute('aCard', new THREE.Float32BufferAttribute(card, 3));
  g.setIndex(idx);
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -5;
  clouds.add(mesh);
  return {
    group, clouds, atlas,
    update(dt, focus) {
      // the sky travels with the walker (it is kilometres away) and drifts slowly round
      group.position.set(focus.x * 0.85, 0, focus.z * 0.85);
      clouds.rotation.y += dt * 0.0016;
    },
  };
}
