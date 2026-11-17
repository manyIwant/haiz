// 入画 · rain, and what rain leaves behind.
//
//   streaks   a box of drops that travels with the eye, slanted by the wind, lit by the sky
//   splashes  crowns of spray on the ground round the walker, as many as the rain is hard
//   eaves     drops falling from the edges of the covered walks and pavilion roofs: while it rains,
//             and for a while after (the gutters still run)
//   canopy    after the rain the crowns drip: drops let go of the leaves when the wind stirs them
// All animated on the GPU from a few uniforms; during the transition they fall only where the
// painting has arrived (paintfield.js), so the rain of today begins where the painting begins.
import * as THREE from 'three';
import { U, GLSL } from '../stroll/atmos.js';
import { PAINT, PAINT_GLSL } from './paintfield.js';

const FX = {
  uRainA: { value: 0 },     // falling rain, 0..1 (with its pulse)
  uDrip: { value: 0 },      // eaves and canopies dripping, 0..1
  uEye: { value: new THREE.Vector3() },
  uWindV: { value: new THREE.Vector3() },
};
const GATE = /* glsl */`
float gate(vec3 p) { return uPaintOn > 0.5 ? step(paintTime(p, vec3(0.0, 1.0, 0.0)), uPaintClock) : 1.0; }
`;

function streaks(count) {
  const seed = new Float32Array(count * 2 * 4);
  let s = 1234567;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < count; i++) { const a = r(), b = r(), c = r(), d = r(); for (let e = 0; e < 2; e++) seed.set([a, b, c, d + e * 2], (i * 2 + e) * 4); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 2 * 3), 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { ...U, ...PAINT, ...FX, uBox: { value: new THREE.Vector3(36, 22, 36) } },
    vertexShader: /* glsl */`
${GLSL}
${PAINT_GLSL}
${GATE}
uniform vec3 uBox; uniform float uRainA; uniform vec3 uEye; uniform vec3 uWindV;
attribute vec4 aSeed; varying float vA;
void main() {
  float tail = step(1.5, aSeed.w), rnd = aSeed.w - tail * 2.0;
  float speed = 9.0 + 4.0 * rnd;
  vec3 vel = vec3(uWindV.x, -speed, uWindV.z);
  vec3 p = aSeed.xyz * uBox + vel * uTime;
  p = mod(p - uEye + uBox * 0.5, uBox) - uBox * 0.5 + uEye;
  p -= normalize(vel) * tail * (0.28 + 0.45 * uRainA) * (0.7 + 0.6 * rnd);
  float shown = step(rnd, uRainA * 1.05) * gate(p);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  vA = shown * smoothstep(0.5, 3.0, -mv.z) * (1.0 - smoothstep(13.0, 20.0, -mv.z)) * (1.0 - tail * 0.7) * step(uGroundY, p.y);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */`
uniform vec3 uSkyAmb; uniform vec3 uSunColor; uniform float uNight; varying float vA;
void main() { gl_FragColor = vec4((uSkyAmb * 0.32 + uSunColor * 0.08 + vec3(0.05)) * vA * 0.55, 1.0); }`,
  });
  const m = new THREE.LineSegments(g, mat);
  m.frustumCulled = false; m.renderOrder = 6; m.name = 'rain';
  return m;
}

function splashes(count) {
  const q = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const g = new THREE.InstancedBufferGeometry();
  g.index = q.index; g.setAttribute('position', q.getAttribute('position')); g.setAttribute('uv', q.getAttribute('uv'));
  const seed = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) { seed[i * 2] = Math.random(); seed[i * 2 + 1] = Math.random(); }
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 2));
  g.instanceCount = count;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { ...U, ...PAINT, ...FX },
    vertexShader: /* glsl */`
${GLSL}
${PAINT_GLSL}
${GATE}
uniform float uRainA; uniform vec3 uEye;
attribute vec2 aSeed; varying vec2 vUv; varying float vA; varying float vPh;
void main() {
  float rate = 2.2 + aSeed.y * 1.6;
  float slot = floor(uTime * rate + aSeed.x * 17.0);
  float ph = fract(uTime * rate + aSeed.x * 17.0);
  float h1 = fract(sin(slot * 12.9898 + aSeed.x * 78.233) * 43758.5453), h2 = fract(sin(slot * 39.346 + aSeed.y * 11.135) * 43758.5453);
  vec2 off = (vec2(h1, h2) - 0.5) * 26.0;
  vec3 c = vec3(floor(uEye.x) + off.x, uGroundY + 0.02, floor(uEye.z) + off.y);
  float on = step(aSeed.y, uRainA) * gate(c);
  float size = (0.05 + 0.2 * ph) * on;
  vUv = uv; vPh = ph;
  vA = on * (1.0 - ph) * (1.0 - smoothstep(9.0, 13.0, length(c.xz - uEye.xz)));
  gl_Position = projectionMatrix * viewMatrix * vec4(c + position * size, 1.0);
}`,
    fragmentShader: /* glsl */`
uniform vec3 uSkyAmb; varying vec2 vUv; varying float vA; varying float vPh;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float ring = smoothstep(0.65, 0.85, r) * (1.0 - smoothstep(0.85, 1.0, r));
  float a = ring * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4((uSkyAmb * 0.5 + 0.08) * a * 0.6, 1.0);
}`,
  });
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false; m.renderOrder = 5; m.name = 'splashes';
  return m;
}

/** drops falling from emitters (eave edges, crowns): emitter xyz + fall height, period, phase */
function drops(emitters, name) {
  const n = emitters.length / 6;
  const q = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.index = q.index; g.setAttribute('position', q.getAttribute('position')); g.setAttribute('uv', q.getAttribute('uv'));
  g.instanceCount = n;
  const pos = new Float32Array(n * 4), per = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { pos.set(emitters.slice(i * 6, i * 6 + 4), i * 4); per.set(emitters.slice(i * 6 + 4, i * 6 + 6), i * 2); }
  g.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 4));
  g.setAttribute('aPer', new THREE.InstancedBufferAttribute(per, 2));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { ...U, ...PAINT, ...FX },
    vertexShader: /* glsl */`
${GLSL}
${PAINT_GLSL}
${GATE}
uniform float uDrip; uniform vec3 uEye;
attribute vec4 aPos; attribute vec2 aPer; varying vec2 vUv; varying float vA;
void main() {
  float t = uTime / aPer.x + aPer.y;
  float ph = fract(t);
  float fall = 0.5 * 9.8 * pow(ph * aPer.x * 0.9, 2.0);
  float alive = step(fall, aPos.w) * step(fract(sin(floor(t) * 91.7 + aPer.y * 13.1) * 4375.85), uDrip);
  vec3 p = aPos.xyz - vec3(0.0, fall, 0.0);
  float d = length(p - uEye);
  vA = alive * gate(aPos.xyz) * (1.0 - smoothstep(14.0, 22.0, d));
  vec3 R = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  float stretch = 0.03 + 0.12 * ph;
  p += R * position.x * 0.012 + vec3(0.0, 1.0, 0.0) * position.y * stretch;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  if (vA < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: /* glsl */`
uniform vec3 uSkyAmb; varying vec2 vUv; varying float vA;
void main() { float a = (1.0 - abs(vUv.x - 0.5) * 2.0) * vA; gl_FragColor = vec4((uSkyAmb * 0.6 + 0.12) * a * 0.7, 1.0); }`,
  });
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false; m.renderOrder = 6; m.name = name;
  return m;
}

export function createRain({ world, mobile = false, layer = 2 }) {
  const group = new THREE.Group();
  group.name = 'rain-fx';
  const rain = streaks(mobile ? 4500 : 9000);
  const splash = splashes(mobile ? 160 : 320);
  // eaves: along the long edges of the covered walks and round the pavilion roofs
  const em = [];
  const G = world.geo.frame.ground;
  for (const b of world.model.buildings) {
    if (b.form !== 'corr' && b.form !== 'pavilion') continue;
    const hgt = b.form === 'corr' ? 4.2 : 3.4;
    const c = Math.cos(b.rot), s = Math.sin(b.rot);
    const edges = b.form === 'corr' ? [[-b.w / 2 - 0.25, null], [b.w / 2 + 0.25, null]] : [[-b.w / 2 - 0.4, null], [b.w / 2 + 0.4, null], [null, -b.d / 2 - 0.4], [null, b.d / 2 + 0.4]];
    for (const [ex, ez] of edges) {
      const L = ex !== null ? b.d : b.w;
      for (let k = -L / 2; k < L / 2; k += 0.35) {
        const lx = ex !== null ? ex : k, lz = ez !== null ? ez : k;
        const x = b.cx + lx * c + lz * s, z = b.cz - lx * s + lz * c;
        em.push(x, G + hgt, z, hgt, 0.7 + Math.random() * 0.9, Math.random());
      }
    }
  }
  const eaves = drops(em, 'eave-drips');
  // canopies: points under every crown, at the crown's underside
  const cm = [];
  for (const t of world.crowns) {
    const n = Math.round(6 + t.r * 2.5);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * t.r * 0.85;
      const y = t.y - t.ry * (0.55 + 0.35 * Math.random());
      cm.push(t.x + Math.cos(a) * d, y, t.z + Math.sin(a) * d, y - G, 1.5 + Math.random() * 3.5, Math.random());
    }
  }
  const canopy = drops(cm, 'canopy-drips');
  group.add(rain, splash, eaves, canopy);
  group.traverse((o) => o.layers.set(layer));
  let lastRain = 0;
  return {
    group,
    update(dt, W, eye) {
      const s = W.state, c = s.cur;
      const r = Math.min(1, s.rainNow);
      FX.uRainA.value = r;
      lastRain = r > 0.05 ? 1 : Math.max(0, lastRain - dt / 900);        // gutters run on for ~15 minutes
      // eaves drip while it rains and after; canopies drip after rain (wet leaves) and in light rain
      FX.uDrip.value = Math.min(1, Math.max(r * 1.2, lastRain * 0.7, c.wet * 0.5 * (1 - r)));
      FX.uEye.value.copy(eye);
      const k = c.windSpeed * 0.55;
      FX.uWindV.value.set(c.windDir[0] * k, 0, c.windDir[1] * k);
      rain.visible = r > 0.01; splash.visible = r > 0.02;
      eaves.visible = canopy.visible = FX.uDrip.value > 0.02;
    },
  };
}
