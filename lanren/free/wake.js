// HAIZ · 自由共游 — the air behind you, and the world it touches (see docs/free-20261122.md, 「世界的回应」).
//
// Petalwake (MIT, jjcm/petalwake) makes its meadow answer the broom with a simulated pair of trailing
// vortices, drawn into a world-space texture that every blade, flower and wave reads. Its lesson is that
// the effect comes from one shared field, not from each plant knowing about the player. HAIZ keeps that
// architecture and makes it small enough for a phone and general enough for every way of moving:
//
//   trail     a ring of stations dropped every half metre of travel (or every 0.12 s while hovering):
//             position, height above the ground, direction, strength and size. Strength comes from the
//             speed and the way of moving (a walker barely parts the grass at their feet; a bicycle
//             combs a lane; a broom low over a lawn lays it flat in a wide swath, and hovering it blows
//             a ring outward). The ground effect fades with height: high over the campus, you touch nothing
//   field     one pass a frame into a 384² texture that follows the student (192 m across, 0.5 m a texel):
//             each texel sums, over the stations, an outward push that peaks at the station's radius,
//             plus the air dragged along the path — and lets each station ring as it ages (the blades
//             spring back past upright, then settle). xy = the wind over the ground, z = agitation,
//             w = the height of the air that did it (so a crown is shaken only if you passed through it)
//   readers   the grass blades (lean + flutter), the lawn's painted strokes (a laid-over swath reads
//             lighter, as a mown or wind-combed lawn does), the crowns of the campus trees (agitated
//             where the field's height meets their leaves), and the 百年榄仁树's own touch code (V4),
//             which takes the flight line through the crown as a ray and sends a wave along it
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
  float edge = smoothstep(0.0, 0.06, uv.x) * smoothstep(1.0, 0.94, uv.x) * smoothstep(0.0, 0.06, uv.y) * smoothstep(1.0, 0.94, uv.y);
  return vec4(w.xyz * edge, w.w);
}
`;

const FIELD_FRAG = /* glsl */`
precision highp float;
uniform vec4 uP[${N}];   // x, y (absolute), z, age
uniform vec4 uV[${N}];   // dir x, dir z, strength (m/s-ish), radius
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
    float r0 = V.w;
    if (dot(d, d) > r0 * r0 * 16.0) continue;
    float along = dot(d, V.xy);
    vec2 lat = d - V.xy * along;
    float lr = length(lat) + 1e-4;
    float fa = exp(-along * along / (0.18 + r0 * r0 * 0.25));
    float age = P.w;
    // a station's push rings as it ages: out, back past upright, settled
    float env = exp(-age * 1.15) * (0.55 + 0.45 * cos(age * 5.2));
    float q = lr / r0;
    vec2 po = lat / lr * q * exp(1.0 - q);
    vec2 drag = V.xy * exp(-q * q) * 0.8;
    float k = V.z * fa;
    wind += (po + drag) * k * env;
    float a = k * exp(-q * q * 0.35) * exp(-age * 0.9);
    agit += a;
    if (a > best) { best = a; hgt = P.y; }
  }
  gl_FragColor = vec4(clamp(wind, vec2(-6.0), vec2(6.0)), min(agit, 4.0), hgt);
}`;

export function createWake({ renderer, world, layer }) {
  const rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  WAKE_U.uWake.value = rt.texture;
  const P = Array.from({ length: N }, () => new THREE.Vector4(0, -1e4, 0, 99));
  const V = Array.from({ length: N }, () => new THREE.Vector4(0, 0, 0, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uP: { value: P }, uV: { value: V }, uO: { value: new THREE.Vector2() }, uS: { value: SPAN } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: FIELD_FRAG, depthTest: false, depthWrite: false,
  });
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const quad = new THREE.Mesh(tri, mat); quad.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // ---------------------------------------------------------------- patch the readers (before they compile)
  const patched = new Set();
  function patch(mat, tag, edit) {
    if (!mat || patched.has(mat)) return;
    patched.add(mat);
    const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
    mat.onBeforeCompile = (sh, r) => {
      prev.call(mat, sh, r);
      Object.assign(sh.uniforms, WAKE_U);
      if (!/void main\(\)\s*\{/.test(sh.vertexShader)) return;
      edit(sh);
    };
    mat.customProgramCacheKey = () => prevKey() + ':wake-' + tag;
    mat.needsUpdate = true;
  }
  const inject = (src) => src.replace(/void main\(\)\s*\{/, WAKE_GLSL + '\nvoid main() {');
  let ok = { grass: 0, lawn: 0, crowns: 0 };
  // grass: lean with the wake, flutter where it is agitated
  for (const L of world.grass.layers) {
    patch(L.mesh.material, 'grass', (sh) => {
      const mark = 'lean += away / max(pd, 0.01) * smoothstep(0.9, 0.12, pd) * 1.7;';
      if (!sh.vertexShader.includes(mark)) return;
      sh.vertexShader = inject(sh.vertexShader).replace(mark, mark + `
{
  vec4 wk = wakeAt(root);
  lean += wk.xy * 0.55;
  lean += vec2(sin(uTime * 17.0 + aRnd.w * 9.0), cos(uTime * 13.0 + aRnd.w * 7.0)) * min(wk.z, 2.0) * 0.12;
}`);
      ok.grass++;
    });
  }
  // the lawn's strokes: a laid-over swath shows the blades' lighter undersides
  patch(world.ground.mesh.material, 'lawn', (sh) => {
    const mark = 'float pud = puddleAt(vWP.xz) * paving;';
    if (!sh.fragmentShader.includes(mark)) return;
    sh.fragmentShader = sh.fragmentShader.replace(/void main\(\)\s*\{/, WAKE_GLSL + '\nvoid main() {').replace(mark, mark + `
{
  vec4 wk = wakeAt(vWP.xz);
  float comb = clamp(length(wk.xy) * 0.32, 0.0, 1.0);
  albedo = mix(albedo, albedo * vec3(1.18, 1.2, 0.86) + vec3(0.016, 0.02, 0.0), lawn * comb * 0.7);
}`);
    ok.lawn++;
  });
  // the campus trees' crowns: shaken where the air that went through them was at their height
  world.flora.group.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [o.material, o.customDepthMaterial]) {
      patch(m, 'crown', (sh) => {
        const mark = 'float gust = windField(ip.xz);';
        if (!sh.vertexShader.includes(mark)) return;
        sh.vertexShader = inject(sh.vertexShader).replace(mark, mark + `
  vec4 wpv = modelMatrix * vec4(position, 1.0);
  #ifdef USE_INSTANCING
    wpv = modelMatrix * instanceMatrix * vec4(position, 1.0);
  #endif
  vec4 wk = wakeAt(wpv.xz);
  float wnear = min(wk.z, 2.5) * smoothstep(5.0, 1.0, abs(wpv.y - wk.w));
  gust += wnear * 0.9;
  transformed.xz += wk.xy * wnear * 0.05 * (0.4 + aData.g);
  transformed.y += sin(uTime * 19.0 + position.x * 7.0 + position.z * 5.0) * wnear * 0.04 * aData.g;`);
        ok.crowns++;
      });
    }
  });

  // ---------------------------------------------------------------- the trail
  let head = 0, count = 0, lastX = 0, lastZ = 0, lastT = 0, active = false, idle = 99;
  const center = new THREE.Vector2();
  // the old tree's touch rays (V4 code): the flight line through its crown
  const tree = world.tree?.group;
  let touchSlot = 0, touchT = -9;
  /**
   * feed one frame.  s: { pos: Vector3, vel: Vector3, mode, agl, speed }, time: the tree's clock (weather time)
   */
  function feed(dt, s, UNI, treeTime) {
    for (let i = 0; i < N; i++) P[i].w += dt;
    const speed = Math.hypot(s.vel.x, s.vel.z);
    const agl = Math.max(0, s.agl);
    let k = 0, r0 = 0.5;
    if (s.mode === 'walk') { k = speed * 0.18; r0 = 0.42; }
    else if (s.mode === 'bike') { k = speed * 0.32; r0 = 0.62; }
    else if (s.mode === 'board') { k = speed * 0.28; r0 = 0.55; }
    else if (s.mode === 'broom') {
      const fall = 1 / (1 + (agl / 2.6) ** 2);
      k = (speed * 0.36 + 2.6) * fall;             // + the downwash of a hovering broom
      r0 = 0.9 + agl * 0.4 + speed * 0.03;
    }
    const moved = Math.hypot(s.pos.x - lastX, s.pos.z - lastZ);
    lastT += dt;
    const hovering = s.mode === 'broom' && k > 0.3;
    if (k > 0.05 && (moved > 0.5 || (hovering && lastT > 0.12))) {
      const dir = speed > 0.3 ? [s.vel.x / speed, s.vel.z / speed] : [0, 0];
      P[head].set(s.pos.x, s.pos.y, s.pos.z, 0);
      V[head].set(dir[0], dir[1], k, r0);
      head = (head + 1) % N; count = Math.min(N, count + 1);
      lastX = s.pos.x; lastZ = s.pos.z; lastT = 0;
    }
    // stations that have died out stop costing anything
    let live = 0;
    for (let i = 0; i < N; i++) { if (P[i].w > 3.6) V[i].z = 0; else if (V[i].z > 0) live++; }
    active = live > 0;
    idle = active ? 0 : idle + dt;
    // the field follows the student, snapped to its texels (no swimming)
    const texel = SPAN / SIZE;
    center.set(Math.round((s.pos.x - SPAN / 2) / texel) * texel, Math.round((s.pos.z - SPAN / 2) / texel) * texel);
    WAKE_U.uWakeO.value.copy(center);
    // the old tree: inside its crown, the line of flight is a ray its leaves are pushed away from
    if (tree && s.mode === 'broom' && UNI && speed > 1.5) {
      const crown = world.crowns[world.crowns.length - 1];
      const dx = (s.pos.x - crown.x) / crown.r, dy = (s.pos.y - crown.y) / crown.ry, dz = (s.pos.z - crown.z) / crown.r;
      if (dx * dx + dy * dy + dz * dz < 1.3 && treeTime - touchT > 0.35) {
        touchT = treeTime;
        tree.updateMatrixWorld(true);
        const inv = new THREE.Matrix4().copy(tree.matrixWorld).invert();
        const o = s.pos.clone().applyMatrix4(inv);
        const d = s.vel.clone().transformDirection(inv);
        UNI.uTouchO.value[touchSlot].set(o.x, o.y, o.z, treeTime);
        UNI.uTouchD.value[touchSlot].set(d.x, d.y, d.z, Math.min(2.2, speed * 0.16));
        touchSlot = (touchSlot + 1) % 4;
      }
    }
  }
  function render() {
    if (!active && idle > 0.5) { WAKE_U.uWakeOn.value = 0; return; }
    WAKE_U.uWakeOn.value = 1;
    mat.uniforms.uO.value.copy(center);
    const prev = renderer.getRenderTarget();
    const xr = renderer.xr.enabled; renderer.xr.enabled = false;
    renderer.setRenderTarget(rt);
    renderer.render(scene, cam);
    renderer.setRenderTarget(prev);
    renderer.xr.enabled = xr;
  }
  /** the same wind on the CPU (for leaves and petals in the air): {x, z} m/s at (x, y, z) */
  function windAt(x, y, z, out) {
    out.x = 0; out.z = 0; out.y = 0;
    for (let i = 0; i < N; i++) {
      const v = V[i];
      if (v.z <= 0) continue;
      const p = P[i];
      const dx = x - p.x, dz = z - p.z, r0 = v.w;
      const dd = dx * dx + dz * dz;
      if (dd > r0 * r0 * 16) continue;
      const dy = y - p.y;
      const vert = Math.exp(-(dy * dy) / (r0 * r0 * 2 + 1));
      const along = dx * v.x + dz * v.y;
      const lx = dx - v.x * along, lz = dz - v.y * along;
      const lr = Math.hypot(lx, lz) + 1e-4;
      const fa = Math.exp(-along * along / (0.18 + r0 * r0 * 0.25));
      const age = p.w;
      const env = Math.exp(-age * 1.15);
      const q = lr / r0;
      const o = q * Math.exp(1 - q);
      const k = v.z * fa * env * vert;
      out.x += (lx / lr * o + v.x * Math.exp(-q * q) * 1.6) * k;
      out.z += (lz / lr * o + v.y * Math.exp(-q * q) * 1.6) * k;
      // the vortices roll the air up on the outside and down inside
      out.y += (q > 1 ? 0.6 : -0.3) * k * Math.exp(-q * 0.5);
    }
    return out;
  }
  return { feed, render, windAt, rt, stats: () => ({ ...ok, active, count }) };
}
