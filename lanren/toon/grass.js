// Grass: the field the reference runs through, on the campus's lawns and gardens.
//
// One instanced mesh per layer, a fixed number of blades scattered over a square around the walker.
// Each blade's root wraps toroidally (mod 2R) around the centre, so every blade keeps a fixed world
// position while the square travels with the walker: no chunks, no re-upload, one draw call. The
// ground paint's mask (ground.js) decides where blades exist and how tall; the blade takes its root
// colour from the paint under it, so grass and ground are one surface. Wind arrives as gusts — a
// slow noise field blowing across — that lean the blades and lighten them (the reference's moving
// sheen), and the blades part round the walker's feet.
import * as THREE from 'three';
import { toonMaterial, TOON } from './toon.js';

function bladeGeometry(segments) {
  const pos = [], idx = [];
  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    pos.push(-0.5, t, 0, 0.5, t, 0);
  }
  pos.push(0, 1, 0);
  for (let i = 0; i < segments - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  const a = (segments - 1) * 2;
  idx.push(a, a + 1, a + 2);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(idx);
  return g;
}

/**
 * layers: [{ count, radius, height, width, segments }]
 * paint / mask: the painters from ground.js (canvas + mapping)
 */
export function createGrass({ paint, mask, layers }) {
  const maskTex = new THREE.CanvasTexture(mask.c);
  maskTex.colorSpace = THREE.NoColorSpace;
  maskTex.generateMipmaps = false;
  maskTex.minFilter = THREE.LinearFilter;
  const paintTex = new THREE.CanvasTexture(paint.c);
  paintTex.colorSpace = THREE.NoColorSpace;
  paintTex.minFilter = THREE.LinearMipmapLinearFilter;
  const shared = {
    uCenter: { value: new THREE.Vector3() },
    uPlayer: { value: new THREE.Vector3(1e5, 0, 1e5) },
    uMask: { value: maskTex }, uMaskO: { value: new THREE.Vector2(mask.x0, mask.z0) }, uMaskS: { value: mask.span },
    uPaint: { value: paintTex }, uPaintO: { value: new THREE.Vector2(paint.x0, paint.z0) }, uPaintS: { value: paint.span },
  };
  const group = new THREE.Group();
  group.name = 'toon-grass';
  const meshes = [];
  layers.forEach((L, li) => {
    const geo = bladeGeometry(L.segments);
    const seeds = new Float32Array(L.count * 4);
    let s = 1234 + li * 999;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < L.count; i++) {
      seeds[i * 4] = (rnd() * 2 - 1) * L.radius;
      seeds[i * 4 + 1] = (rnd() * 2 - 1) * L.radius;
      seeds[i * 4 + 2] = rnd();
      seeds[i * 4 + 3] = rnd();
    }
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    geo.instanceCount = L.count;
    const uniforms = { ...shared, uRadius: { value: L.radius }, uBladeH: { value: L.height }, uBladeW: { value: L.width }, uInner: { value: L.inner || 0 } };
    const mat = toonMaterial({
      name: 'grass' + li, key: 'grass' + li, side: THREE.DoubleSide, uniforms,
      vertex: {
        head: /* glsl */`
attribute vec4 aSeed;
uniform vec3 uCenter; uniform vec3 uPlayer; uniform float uRadius; uniform float uInner;
uniform sampler2D uMask; uniform vec2 uMaskO; uniform float uMaskS;
uniform sampler2D uPaint; uniform vec2 uPaintO; uniform float uPaintS;
uniform float uBladeH; uniform float uBladeW;
varying float vT; varying float vGust; varying vec3 vGround; varying float vHue; varying float vFlower;
`,
        begin: /* glsl */`
{
  vec2 rel = aSeed.xy - uCenter.xz;
  rel = mod(rel + uRadius, 2.0 * uRadius) - uRadius;
  vec2 root = uCenter.xz + rel;
  float dist = max(abs(rel.x), abs(rel.y)) / uRadius;
  float rdist = length(rel) / uRadius;
  vec2 muv = (root - uMaskO) / uMaskS;
  float inside = step(0.0, muv.x) * step(muv.x, 1.0) * step(0.0, muv.y) * step(muv.y, 1.0);
  vec4 mk = texture(uMask, vec2(muv.x, 1.0 - muv.y));
  float dens = mk.r * inside;
  float patchN = tNoise(root * 0.13);
  float keep = step(aSeed.z, dens * (0.75 + 0.5 * patchN));
  float h = uBladeH * (0.5 + 0.95 * aSeed.w) * mix(0.3, 1.0, mk.g) * keep * (0.65 + 0.7 * patchN);
  h *= 1.0 - smoothstep(0.7, 0.98, rdist);
  h *= smoothstep(uInner * 0.85, uInner, rdist);
  vec2 puv = (root - uPaintO) / uPaintS;
  vGround = pow(textureLod(uPaint, vec2(puv.x, 1.0 - puv.y), 3.0).rgb, vec3(2.2));
  float ang = aSeed.z * 61.0 + aSeed.w * 13.0;
  vec2 side = vec2(cos(ang), sin(ang));
  float t = position.y;
  float gust = tFbm(root * 0.04 - uWind * uTime * 0.11);
  vGust = smoothstep(0.42, 0.78, gust);
  vec2 wdir = normalize(uWind);
  float sway = 0.22 + 1.05 * vGust + 0.12 * sin(uTime * (2.0 + aSeed.w) + aSeed.z * 40.0);
  vec2 bend = wdir * sway + vec2(-side.y, side.x) * (aSeed.w - 0.5) * 0.5;
  vec2 away = root - uPlayer.xz; float pd = length(away);
  bend += away / max(pd, 0.01) * smoothstep(1.0, 0.15, pd) * 1.6;
  float tb = t * t;
  vec3 p = vec3(root.x, uGroundY, root.y);
  p.xz += side * position.x * uBladeW * (1.0 - t * 0.9) * (0.7 + 0.6 * aSeed.w) * step(0.001, h);
  float bl = length(bend);
  p.xz += bend * tb * h * 0.6;
  p.y += h * t * (1.0 - 0.3 * min(bl, 1.5) * tb);
  transformed = p;
  objectNormal = normalize(vec3(bend.x * 0.35, 1.0, bend.y * 0.35));
  vT = t;
  vHue = tNoise(root * 0.06 + 3.0);
  vFlower = aSeed.w * step(0.5, mk.g);
}
`,
      },
      fragment: {
        head: /* glsl */`
varying float vT; varying float vGust; varying vec3 vGround; varying float vHue; varying float vFlower;
`,
        albedo: /* glsl */`
{
  vec3 g = vGround;
  vec3 tipc = mix(g * vec3(1.25, 1.35, 0.8), vec3(0.32, 0.62, 0.1), 0.45);
  tipc = mix(tipc, tipc * vec3(1.18, 1.05, 0.7), vHue * 0.8);          // yellow-green drifts
  vec3 rootc = g * 0.9;
  toonAlbedo = mix(rootc, tipc, smoothstep(0.1, 1.0, vT));
  // a few blades carry a small white or yellow flower at the tip
  toonAlbedo = mix(toonAlbedo, mix(vec3(0.95, 0.93, 0.85), vec3(0.95, 0.8, 0.25), step(0.5, fract(vFlower * 7.0))), step(0.985, vFlower) * smoothstep(0.82, 0.95, vT));
  toonAlbedo *= 1.0 + vGust * 0.32 * vT;
  toonAO = mix(0.72, 1.0, vT);
  toonSoft = 0.3;
}
`,
        after: /* glsl */`
{
  vec3 vd = normalize(vToonWP - cameraPosition);
  toonOut += uSunColor * toonAlbedo * 0.45 * pow(max(dot(vd, uSunDir), 0.0), 2.0) * vT * toonShadow;
}
`,
      },
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.name = 'grass-' + li;
    group.add(mesh);
    meshes.push({ mesh, layer: L });
  });
  return {
    group, meshes, uniforms: shared,
    update(center, player) {
      shared.uCenter.value.copy(center);
      shared.uPlayer.value.copy(player);
    },
    /** quality: fraction of blades drawn (0..1) */
    setQuality(q) { for (const m of meshes) m.mesh.geometry.instanceCount = Math.max(1, Math.round(m.layer.count * q)); },
  };
}
