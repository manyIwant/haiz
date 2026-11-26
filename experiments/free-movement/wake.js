// HAIZ · 自由移动 — Shared World-Space GPU Wake Field
//
// Reads the twin counter-rotating trailing vortices from vortex.js and draws them into a
// 384x384 scrolling RGBA16F world-space field (192 m x 192 m, texel-snapped to eliminate shimmer).
// Four campus systems read this single shared field:
//   1. Grass blades (bend outward + vibrate in vortex agitation)
//   2. Painted lawn surface (combed pale wind-track visible from the sky as you bank)
//   3. Campus tree crowns + 百年榄仁树 V4 touch rays (only shaken at matching altitude)
//   4. Water surfaces (砚池 ripples + shimmering turquoise-white wake foam when skimming low)
import * as THREE from 'three';

const N = 48;
const SIZE = 384, SPAN = 192;

export const WAKE_U = {
  uWake: { value: null },
  uWakeO: { value: new THREE.Vector2(-1e5, -1e5) },
  uWakeS: { value: SPAN },
  uWakeOn: { value: 0 },
};

export const WAKE_GLSL = /* glsl */`
uniform sampler2D uWake; uniform vec2 uWakeO; uniform float uWakeS; uniform float uWakeOn;
vec4 wakeAt(vec2 xz) {
  if (uWakeOn < 0.5) return vec4(0.0, 0.0, 0.0, -1e4);
  vec2 uv = (xz - uWakeO) / uWakeS;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0, 0.0, 0.0, -1e4);
  vec4 w = texture2D(uWake, uv);
  float edge = smoothstep(0.0, 0.06, uv.x) * (1.0 - smoothstep(0.94, 1.0, uv.x)) * smoothstep(0.0, 0.06, uv.y) * (1.0 - smoothstep(0.94, 1.0, uv.y));
  return vec4(w.xyz * edge, w.w);
}
`;

const FIELD_FRAG = /* glsl */`
precision highp float;
uniform vec4 uP[${N}];   // x, y (absolute), z, age
uniform vec4 uV[${N}];   // dir x, dir z, ground-weighted strength, effective radius
uniform vec2 uO; uniform float uS;
varying vec2 vUv;
void main() {
  vec2 xz = uO + vUv * uS;
  vec2 wind = vec2(0.0); float agit = 0.0; float hgt = -1e4; float best = 0.0;
  for (int i = 0; i < ${N}; i++) {
    vec4 V = uV[i];
    if (V.z <= 0.0) continue;
    vec4 P = uP[i];
    vec2 d = xz - P.xz;
    float r0 = max(0.35, V.w);
    if (dot(d, d) > r0 * r0 * 16.0) continue;
    float along = dot(d, V.xy);
    vec2 lat = d - V.xy * along;
    float lr = length(lat) + 1e-4;
    float fa = exp(-along * along / (0.24 + r0 * r0 * 0.30));
    float age = P.w;
    // Elastic oscillation: grass lays flat, rebounds past upright, then settles
    float env = exp(-age * 0.85) * (0.58 + 0.42 * cos(age * 4.8));
    float q = lr / r0;
    // Twin-vortex outboard wash peaks on the flanks of the trail
    vec2 po = (lat / lr) * q * exp(1.0 - q);
    vec2 drag = V.xy * exp(-q * q) * 0.85;
    float k = V.z * fa;
    wind += (po + drag) * k * env * 0.45;
    float a = k * exp(-q * q * 0.32) * exp(-age * 0.72) * 0.55;
    agit += a;
    if (a > best) { best = a; hgt = P.y; }
  }
  gl_FragColor = vec4(clamp(wind, vec2(-7.0), vec2(7.0)), min(agit, 4.5), hgt);
}`;

export function createWake({ renderer, world, vortex }) {
  const rt = new THREE.WebGLRenderTarget(SIZE, SIZE, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    depthBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });
  WAKE_U.uWake.value = rt.texture;

  const P = Array.from({ length: N }, () => new THREE.Vector4(0, -1e4, 0, 99));
  const V = Array.from({ length: N }, () => new THREE.Vector4(0, 0, 0, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uP: { value: P }, uV: { value: V }, uO: { value: new THREE.Vector2() }, uS: { value: SPAN } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: FIELD_FRAG,
    depthTest: false,
    depthWrite: false,
  });
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const quad = new THREE.Mesh(tri, mat); quad.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const patched = new Set();
  function patch(m, tag, edit) {
    if (!m || patched.has(m)) return;
    patched.add(m);
    const prev = m.onBeforeCompile;
    const prevKey = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => '';
    m.onBeforeCompile = (sh, r) => {
      if (prev) prev.call(m, sh, r);
      Object.assign(sh.uniforms, WAKE_U);
      edit(sh);
    };
    m.customProgramCacheKey = () => prevKey() + ':fm-wake-' + tag;
    m.needsUpdate = true;
  }

  const inject = (src) => src.replace(/void main\(\)\s*\{/, WAKE_GLSL + '\nvoid main() {');
  const ok = { grass: 0, lawn: 0, crowns: 0, water: 0 };

  // 1. Grass blades
  for (const L of world.grass.layers) {
    patch(L.mesh.material, 'grass', (sh) => {
      const mark = 'lean += away / max(pd, 0.01) * (1.0 - smoothstep(0.12, 0.9, pd)) * 1.7;';
      if (!sh.vertexShader.includes(mark)) return;
      sh.vertexShader = inject(sh.vertexShader).replace(mark, mark + `
{
  vec4 wk = wakeAt(root);
  lean += wk.xy * 0.62;
  lean += vec2(sin(uTime * 17.0 + aRnd.w * 9.0), cos(uTime * 13.0 + aRnd.w * 7.0)) * min(wk.z, 2.2) * 0.14;
}`);
      ok.grass++;
    });
  }

  // 2. Painted lawn ground (shows a bright wind-combed path from above!)
  patch(world.ground.mesh.material, 'lawn', (sh) => {
    const mark = 'float pud = puddleAt(vWP.xz) * paving;';
    if (!sh.fragmentShader.includes(mark)) return;
    sh.fragmentShader = inject(sh.fragmentShader).replace(mark, mark + `
{
  vec4 wk = wakeAt(vWP.xz);
  float comb = clamp(length(wk.xy) * 0.34, 0.0, 1.0);
  albedo = mix(albedo, albedo * vec3(1.20, 1.22, 0.85) + vec3(0.018, 0.022, 0.0), lawn * comb * 0.78);
}`);
    ok.lawn++;
  });

  // 3. Campus tree crowns
  world.flora.group.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [o.material, o.customDepthMaterial]) {
      if (!m) continue;
      patch(m, 'crown', (sh) => {
        const mark = 'float gust = windField(ip.xz);';
        if (!sh.vertexShader.includes(mark)) return;
        sh.vertexShader = inject(sh.vertexShader).replace(mark, mark + `
  vec4 wpv = modelMatrix * vec4(position, 1.0);
  #ifdef USE_INSTANCING
    wpv = modelMatrix * instanceMatrix * vec4(position, 1.0);
  #endif
  vec4 wk = wakeAt(wpv.xz);
  float wnear = min(wk.z, 2.6) * (1.0 - smoothstep(1.2, 5.5, abs(wpv.y - wk.w)));
  gust += wnear * 0.95;
  transformed.xz += wk.xy * wnear * 0.055 * (0.4 + aData.g);
  transformed.y += sin(uTime * 19.0 + position.x * 7.0 + position.z * 5.0) * wnear * 0.045 * aData.g;`);
        ok.crowns++;
      });
    }
  });

  // 4. Water surfaces (ripples + bright frothy wake track when skimming over 砚池!)
  world.water.traverse((o) => {
    if (!o.isMesh || !o.material?.fragmentShader) return;
    const m = o.material;
    if (patched.has(m)) return;
    patched.add(m);
    Object.assign(m.uniforms, WAKE_U);
    if (m.fragmentShader.includes('vec2 rip = rainRipple(vWP.xz);')) {
      m.fragmentShader = m.fragmentShader
        .replace('void main() {', WAKE_GLSL + '\nvoid main() {')
        .replace(
          'vec2 rip = rainRipple(vWP.xz);',
          'vec4 wkW = wakeAt(vWP.xz);\n  vec2 rip = rainRipple(vWP.xz) + wkW.xy * 0.22;'
        )
        .replace(
          'gl_FragColor = vec4(aerial(col, vWP), 1.0);',
          'float foam = smoothstep(0.28, 1.35, wkW.z) * (0.55 + 0.45 * aNoise(vWP.xz * 4.5 + uTime * 2.0));\n  col = mix(col, vec3(0.84, 0.94, 0.96) * (0.55 + 0.45 * uSunColor.r), clamp(foam * 0.85, 0.0, 0.88));\n  gl_FragColor = vec4(aerial(col, vWP), 1.0);'
        );
      m.needsUpdate = true;
      ok.water++;
    }
  });

  const center = new THREE.Vector2();
  const tree = world.tree?.group;
  let active = false, idle = 99, liveCount = 0;
  let touchSlot = 0, touchT = -9;
  const _inv = new THREE.Matrix4(), _o = new THREE.Vector3(), _d = new THREE.Vector3();

  function feed(dt, s, UNI, treeTime) {
    vortex.update(dt, s, treeTime);
    liveCount = vortex.fillGpu(P, V);
    active = liveCount > 0;
    idle = active ? 0 : idle + dt;

    const texel = SPAN / SIZE;
    center.set(
      Math.round((s.pos.x - SPAN / 2) / texel) * texel,
      Math.round((s.pos.z - SPAN / 2) / texel) * texel
    );
    WAKE_U.uWakeO.value.copy(center);

    // Century Terminalia tree V4 touch rays when flying/gliding through its crown!
    const speed = Math.hypot(s.vel.x, s.vel.z);
    if (tree && (s.mode === 'broom' || s.mode === 'glider') && UNI && speed > 1.2) {
      const crown = world.crowns[world.crowns.length - 1];
      const dx = (s.pos.x - crown.x) / crown.r;
      const dy = (s.pos.y - crown.y) / crown.ry;
      const dz = (s.pos.z - crown.z) / crown.r;
      if (dx * dx + dy * dy + dz * dz < 1.35 && treeTime - touchT > 0.30) {
        touchT = treeTime;
        tree.updateMatrixWorld(true);
        _inv.copy(tree.matrixWorld).invert();
        _o.copy(s.pos).applyMatrix4(_inv);
        _d.copy(s.vel).transformDirection(_inv);
        UNI.uTouchO.value[touchSlot].set(_o.x, _o.y, _o.z, treeTime);
        UNI.uTouchD.value[touchSlot].set(_d.x, _d.y, _d.z, Math.min(2.4, speed * 0.18));
        touchSlot = (touchSlot + 1) % 4;
      }
    }
  }

  function render() {
    if (!active && idle > 0.6) { WAKE_U.uWakeOn.value = 0; return; }
    WAKE_U.uWakeOn.value = 1;
    mat.uniforms.uO.value.copy(center);
    const prev = renderer.getRenderTarget();
    const xr = renderer.xr.enabled; renderer.xr.enabled = false;
    renderer.setRenderTarget(rt);
    renderer.render(scene, cam);
    renderer.setRenderTarget(prev);
    renderer.xr.enabled = xr;
  }

  const _wOut = [0, 0, 0, 0];
  function windAt(x, y, z, out) {
    vortex.sample(x, y, z, _wOut);
    out.x = _wOut[0]; out.y = _wOut[1]; out.z = _wOut[2];
    return out;
  }

  return { feed, render, windAt, rt, stats: () => ({ ...ok, active, count: liveCount }) };
}
