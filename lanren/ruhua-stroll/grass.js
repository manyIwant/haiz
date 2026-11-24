// Grass, V2: a pelt, not a carpet.
//
// V1 drew ~900k vertices of evenly spaced blades round the walker, with dark roots and a hard edge:
// it read as repeated geometry. Here the lawn shader carries the far field (strokes combed by the
// wind, the moving sheen of gusts) and blades only add what the eye resolves up close:
//
//   tiles     the world is cut into 4 m tiles, anchored to the ground (blades never slide). Each
//             visible tile draws one of three tuft layouts by distance from the eye: dense fine
//             tufts near, sparser, wider ones further, broad soft blades at the edge of focus. The
//             layout is rotated per tile so it never repeats visibly. Tiles behind the camera, off
//             screen or over paving are not drawn at all (CPU frustum + lawn-map test, ~400 checks).
//   colour    a blade's root takes exactly the lawn's colour at that spot (paint, strokes, gust
//             sheen), so blades grow out of the ground instead of sitting on it; tips lift toward
//             light yellow-green; only the real shadow map darkens them (no black roots)
//   motion    the shared wind field leans the blades in travelling gust fronts; a small flutter
//             on top; blades part round the walker's legs
//   edges     density and height fall off through the soft lawn mask, so a lawn thins out at a
//             kerb instead of stopping on a cut line; gardens grow taller, the infield short
import * as THREE from 'three';
import { cel } from './atmos.js';

const T = 4;   // tile size (m)

function tileGeometry(tufts, blades, segs, seed) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const pos = [], root = [], rr = [], idx = [];
  let v = 0;
  for (let i = 0; i < tufts; i++) {
    const tx = rnd() * T, tz = rnd() * T;
    const tr = [rnd(), rnd()];
    for (let b = 0; b < blades; b++) {
      const a = rnd() * Math.PI * 2, d = rnd() * 0.09;
      const bx = tx + Math.cos(a) * d, bz = tz + Math.sin(a) * d;
      const r3 = [tr[0], rnd(), rnd(), rnd() * Math.PI * 2];
      for (let k = 0; k < segs; k++) {
        const t = k / segs;
        pos.push(-0.5, t, 0, 0.5, t, 0);
        root.push(bx, bz, bx, bz);
        rr.push(...r3, ...r3);
      }
      pos.push(0, 1, 0); root.push(bx, bz); rr.push(...r3);
      for (let k = 0; k < segs - 1; k++) { const a0 = v + k * 2; idx.push(a0, a0 + 1, a0 + 3, a0, a0 + 3, a0 + 2); }
      const a0 = v + (segs - 1) * 2;
      idx.push(a0, a0 + 1, a0 + 2);
      v += segs * 2 + 1;
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setAttribute('aRoot', new THREE.Float32BufferAttribute(root, 2));
  g.setAttribute('aRnd', new THREE.Float32BufferAttribute(rr, 4));
  g.setIndex(idx);
  return g;
}

const LODS = [
  { tufts: 150, blades: 5, segs: 4, width: 0.04, height: 1.0, fade: [-1, 0, 9, 11.5] },
  { tufts: 64, blades: 3, segs: 3, width: 0.065, height: 1.0, fade: [9, 11.5, 20, 24] },
  { tufts: 24, blades: 2, segs: 2, width: 0.13, height: 0.9, fade: [20, 24, 34, 42] },
];

export function createGrass({ ground, maxTiles = 220 }) {
  const { paint, mask, paintTex, maskTex } = ground;
  // which 4 m world tiles have any lawn (so paving tiles are never drawn)
  let md;
  const mw = mask.c.width;
  const sample = (x, z) => {
    const u = (x - mask.x0) / mask.span, v = (z - mask.z0) / mask.span;
    if (u < 0 || v < 0 || u >= 1 || v >= 1) return 0;
    const px = Math.floor(u * mw), py = Math.floor(v * mw);
    return md[(py * mw + px) * 4] / 255;
  };
  const lawnTiles = new Set();
  const ix0 = Math.floor(mask.x0 / T), ix1 = Math.ceil((mask.x0 + mask.span) / T);
  const iz0 = Math.floor(mask.z0 / T), iz1 = Math.ceil((mask.z0 + mask.span) / T);
  function refresh() {
    md = mask.g.getImageData(0, 0, mask.c.width, mask.c.height).data;
    lawnTiles.clear();
    for (let i = ix0; i < ix1; i++) for (let j = iz0; j < iz1; j++) {
      let m = 0;
      for (let a = 0; a < 2 && m < 0.05; a++) for (let b = 0; b < 2; b++) m = Math.max(m, sample(i * T + (a + 0.5) * T / 2, j * T + (b + 0.5) * T / 2));
      if (m > 0.04) lawnTiles.add(i * 100003 + j);
    }
  }
  refresh();

  const shared = {
    uPaint: { value: paintTex }, uMask: { value: maskTex },
    uPaintO: { value: new THREE.Vector2(paint.x0, paint.z0) }, uPaintS: { value: paint.span },
    uPlayer: { value: new THREE.Vector3(1e5, 0, 1e5) }, uEye: { value: new THREE.Vector3() },
  };
  const group = new THREE.Group();
  group.name = 'grass';
  const layers = LODS.map((L, li) => {
    const geo = tileGeometry(L.tufts, L.blades, L.segs, 4242 + li * 77);
    const tiles = new THREE.InstancedBufferAttribute(new Float32Array(maxTiles * 3), 3);
    tiles.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aTile', tiles);
    geo.instanceCount = 0;
    const uniforms = { ...shared, uW: { value: L.width }, uH: { value: 0.25 * L.height }, uFade: { value: new THREE.Vector4(...L.fade) } };
    const mat = cel({
      name: 'grass' + li, key: 'grass-v2-' + li, side: THREE.DoubleSide, uniforms, soft: 0.45,
      vertex: {
        head: /* glsl */`
attribute vec2 aRoot; attribute vec4 aRnd; attribute vec3 aTile;
uniform sampler2D uPaint; uniform sampler2D uMask; uniform vec2 uPaintO; uniform float uPaintS;
uniform vec3 uPlayer; uniform vec3 uEye; uniform float uW; uniform float uH; uniform vec4 uFade;
varying float vT; varying vec3 vGround; varying float vGust; varying float vFlower;
`,
        begin: /* glsl */`
{
  vec2 c = aRoot - ${(T / 2).toFixed(1)};
  float q = aTile.z;
  if (q > 2.5) c = vec2(c.y, -c.x); else if (q > 1.5) c = -c; else if (q > 0.5) c = vec2(-c.y, c.x);
  vec2 root = aTile.xy + ${(T / 2).toFixed(1)} + c;
  float dist = length(root - uEye.xz);
  float fade = smoothstep(uFade.x, uFade.y, dist) * (1.0 - smoothstep(uFade.z, uFade.w, dist));
  vec2 puv = (root - uPaintO) / uPaintS;
  vec2 tuv = vec2(puv.x, 1.0 - puv.y);
  vec4 mk = texture(uMask, tuv);
  float patchN = aNoise(root * 0.11) * 0.7 + aNoise(root * 0.5) * 0.3;
  float keep = step(aRnd.x, mk.r * (0.55 + 0.75 * patchN));
  float hc = mix(0.22, 1.9, smoothstep(0.08, 1.0, mk.g));
  float h = uH * hc * (0.5 + 0.95 * aRnd.y) * (0.6 + 0.8 * patchN) * fade * keep * smoothstep(0.05, 0.6, mk.r);
  // the lawn's own colour here (paint, strokes, sheen) — the same terms as the ground shader
  vec3 g = pow(textureLod(uPaint, tuv, 2.0).rgb, vec3(2.2));
  vec2 wd = uWindDir;
  vec2 qq = vec2(dot(root, wd), dot(root, vec2(-wd.y, wd.x)));
  float stroke = aNoise(vec2(qq.x * 0.9, qq.y * 3.2)) * 0.6 + aNoise(vec2(qq.x * 0.25, qq.y * 0.9)) * 0.4;
  float gust = windField(root);
  g *= mix(vec3(0.9, 0.97, 1.05), vec3(1.1, 1.03, 0.82), aFbm(root * 0.014 + 7.0));
  g *= 0.86 + 0.26 * stroke;
  g = mix(g, g * vec3(1.12, 1.16, 0.86) + vec3(0.012, 0.016, 0.0), gust * 0.55);
  vGround = g; vGust = gust;
  float t = position.y;
  vec2 face = vec2(cos(aRnd.w), sin(aRnd.w));
  float sw = min(uWindSway, 2.2);
  vec2 lean = wd * (0.18 + 0.95 * gust) * mix(1.0, sw, 0.8) + vec2(-face.y, face.x) * (aRnd.z - 0.5) * 0.6;
  lean += wd * sin(uTime * (1.7 + aRnd.z) + aRnd.w * 5.0 + dot(root, wd) * 0.7) * (0.08 + 0.14 * gust) * sw;
  vec2 away = root - uPlayer.xz; float pd = length(away);
  lean += away / max(pd, 0.01) * (1.0 - smoothstep(0.12, 0.9, pd)) * 1.7;
  float bl = min(length(lean), 1.6);
  // Blue encodes the installed turf elevation over the base plane, in 4 metres.
  vec3 p = vec3(root.x, uGroundY + mk.b * 4.0, root.y);
  float wdt = uW * (0.75 + 0.5 * aRnd.z) * (1.0 - pow(t, 1.4) * 0.88);
  p.xz += face * position.x * wdt * step(0.002, h);
  p.xz += lean * t * t * h * 0.62;
  p.y += h * t * (1.0 - 0.32 * bl * t * t) * (1.0 - 0.18 * uRain - 0.08 * uWet);
  transformed = p;
  objectNormal = normalize(vec3(lean.x * 0.12 + face.y * 0.08, 1.0, lean.y * 0.12 - face.x * 0.08));
  vT = t;
  vFlower = step(0.992, aRnd.y) * step(0.7, mk.g);
}
`,
      },
      fragment: {
        head: 'varying float vT; varying vec3 vGround; varying float vGust; varying float vFlower;\n',
        albedo: /* glsl */`
{
  vec3 tipc = vGround * vec3(1.2, 1.24, 0.82) + vec3(0.03, 0.04, 0.0);
  albedo = mix(vGround * 0.96, tipc, smoothstep(0.15, 1.0, vT));
  albedo *= 1.0 + vGust * 0.18 * vT;
  albedo = mix(albedo, vec3(0.92, 0.88, 0.8), vFlower * smoothstep(0.85, 0.97, vT));
  albedo = wetAlbedo(albedo, uWet, 0.35);
  ao = mix(0.8, 1.0, vT);
}
`,
        after: /* glsl */`
{
  vec3 vd = normalize(vWP - cameraPosition);
  outCol += uSunColor * albedo * 0.4 * pow(max(dot(vd, uSunDir), 0.0), 2.0) * vT * shadow;
}
`,
      },
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.name = 'grass-lod' + li;
    group.add(mesh);
    return { L, geo, tiles, mesh, vertsPerTile: geo.getAttribute('position').count };
  });

  const frustum = new THREE.Frustum(), pm = new THREE.Matrix4(), box = new THREE.Box3(), v0 = new THREE.Vector3(), v1 = new THREE.Vector3();
  const stats = { tiles: [0, 0, 0], verts: 0 };
  return {
    group, layers, stats, uniforms: shared, refresh,
    update(camera, player, groundY) {
      shared.uPlayer.value.copy(player);
      shared.uEye.value.copy(camera.position);
      pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(pm);
      const ex = camera.position.x, ez = camera.position.z;
      const R = LODS[2].fade[3];
      const counts = [0, 0, 0];
      for (let i = Math.floor((ex - R) / T); i <= Math.floor((ex + R) / T); i++) {
        for (let j = Math.floor((ez - R) / T); j <= Math.floor((ez + R) / T); j++) {
          if (!lawnTiles.has(i * 100003 + j)) continue;
          const cx = (i + 0.5) * T, cz = (j + 0.5) * T;
          const d = Math.hypot(cx - ex, cz - ez);
          const dmin = Math.max(0, d - T * 0.71), dmax = d + T * 0.71;
          if (dmin > R) continue;
          box.set(v0.set(i * T, groundY - 0.1, j * T), v1.set((i + 1) * T, groundY + 0.9, (j + 1) * T));
          if (!frustum.intersectsBox(box)) continue;
          const rot = ((i * 7 + j * 13) % 4 + 4) % 4;
          for (let l = 0; l < 3; l++) {
            const f = LODS[l].fade;
            if (dmax < f[0] || dmin > f[3]) continue;
            const L = layers[l];
            if (counts[l] >= maxTiles) continue;
            L.tiles.setXYZ(counts[l]++, i * T, j * T, rot);
          }
        }
      }
      stats.verts = 0;
      layers.forEach((L, l) => {
        L.geo.instanceCount = counts[l];
        L.tiles.needsUpdate = true;
        L.tiles.addUpdateRange(0, counts[l] * 3);
        stats.tiles[l] = counts[l];
        stats.verts += counts[l] * L.vertsPerTile;
      });
    },
  };
}
