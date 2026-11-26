// HAIZ · 自由移动 — Environmental Response: Vortex Petals & Leaves, 砚池 Spray,
// Wingtip Air-Stream Ribbons, Ground Carve Dust, and Campus Thermal Updraft Columns!
//
// Nothing is arbitrary decoration: every visual phenomenon is physically coupled to how you move,
// what surface you pass over, and the real Haikou weather & sun.
import * as THREE from 'three';
import { cel, windAt as breezeAt, U } from '../../lanren/ruhua-stroll/atmos.js';

const KIND = { leafG: 0, leafY: 1, leafR: 2, petal: 3, grass: 4, dust: 5 };
const COLORS = {
  0: ['#4f8a3a', '#5e9a3c', '#3f7a35'],
  1: ['#c8a63c', '#d8b64c', '#b0922e'],
  2: ['#a83820', '#8f2918', '#c04c2c'],
  3: ['#cc2e6e', '#df4d8d', '#e878a8', '#f5e8ea'],
  4: ['#6aa040', '#7eb24c'],
  5: ['#d2c5ab', '#c4b698', '#ded4be'],
};

// Eight authentic campus microclimate thermal columns (warm roofs, track, century tree crown, 砚池 mist)
export const THERMALS = [
  { id: 'track', label: '操场暖流', x: -201, z: -58, r: 28, top: 64, lift: 3.4 },
  { id: 'lanshu', label: '榄仁树冠风涡', x: 0, z: 0, r: 16, top: 44, lift: 2.8 },
  { id: 'yihao', label: '一号楼红瓦热流', x: -35, z: 24, r: 20, top: 54, lift: 3.0 },
  { id: 'yishu', label: '艺术中心暖流', x: -57, z: 181, r: 20, top: 56, lift: 3.1 },
  { id: 'yanchi', label: '砚池水汽升流', x: 4, z: 138, r: 17, top: 46, lift: 2.6 },
  { id: 'library', label: '图书馆前庭气流', x: 60, z: -20, r: 18, top: 50, lift: 2.9 },
  { id: 'court', label: '篮球场热柱', x: -134, z: 54, r: 19, top: 52, lift: 3.1 },
  { id: 'kexue', label: '科学馆南风坡', x: -33, z: 98, r: 18, top: 50, lift: 2.8 },
];

function leafGeometry() {
  const pts = [
    [0, -0.5, 0], [0.22, -0.25, 0.04], [0.26, 0.05, 0.05], [0.16, 0.32, 0.03],
    [0, 0.5, 0], [-0.16, 0.32, 0.03], [-0.26, 0.05, 0.05], [-0.22, -0.25, 0.04], [0, 0, -0.03],
  ];
  const pos = new Float32Array(pts.flat());
  const idx = [];
  for (let i = 0; i < 8; i++) idx.push(8, i, (i + 1) % 8);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Gossamer translucent air-stream ribbon trailing off broom bristles / glider wingtips
function createAirRibbon(segs = 28, maxWidth = 0.036) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array((segs + 1) * 2 * 3);
  const alpha = new Float32Array((segs + 1) * 2);
  const edge = new Float32Array((segs + 1) * 2);
  for (let i = 0; i <= segs; i++) { edge[i * 2] = 0; edge[i * 2 + 1] = 1; }
  const idx = [];
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  geo.setAttribute('aEdge', new THREE.BufferAttribute(edge, 1));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color('#fff9ea') } },
    vertexShader: `attribute float aAlpha; attribute float aEdge; varying float vA; varying float vE; void main(){ vA = aAlpha; vE = aEdge; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; varying float vA; varying float vE; void main(){ float across = sin(vE * 3.14159265); gl_FragColor = vec4(uColor, vA * across * across * 0.24); }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;
  const pts = Array.from({ length: segs + 1 }, () => ({ p: new THREE.Vector3(), s: 0 }));
  let acc = 0, init = false;
  const side = new THREE.Vector3(), toCam = new THREE.Vector3(), tang = new THREE.Vector3();

  return {
    mesh,
    reset() { init = false; for (const pt of pts) pt.s = 0; },
    update(dt, worldPos, camPos, strength) {
      if (!init && strength > 0.02) {
        for (const pt of pts) { pt.p.copy(worldPos); pt.s = 0; }
        init = true;
      }
      if (!init) { mesh.visible = false; return; }
      acc += dt;
      if (acc > 0.018) {
        acc = 0;
        for (let i = segs; i > 0; i--) {
          pts[i].p.copy(pts[i - 1].p);
          pts[i].s = pts[i - 1].s * 0.91;
        }
        pts[0].p.copy(worldPos);
        pts[0].s = strength;
      } else {
        pts[0].p.copy(worldPos);
        pts[0].s = Math.max(pts[0].s, strength);
      }
      let any = false;
      for (let i = 0; i <= segs; i++) {
        const cur = pts[i];
        const fade = (1 - i / segs);
        const w = maxWidth * fade * cur.s;
        if (cur.s > 0.02) any = true;
        const next = i < segs ? pts[i + 1].p : cur.p;
        const prev = i > 0 ? pts[i - 1].p : cur.p;
        tang.subVectors(prev, next);
        if (tang.lengthSq() < 1e-6) tang.set(0, 0, 1);
        toCam.subVectors(camPos, cur.p);
        side.crossVectors(tang, toCam).normalize().multiplyScalar(w);
        const o = i * 6;
        pos[o] = cur.p.x + side.x; pos[o + 1] = cur.p.y + side.y; pos[o + 2] = cur.p.z + side.z;
        pos[o + 3] = cur.p.x - side.x; pos[o + 4] = cur.p.y - side.y; pos[o + 5] = cur.p.z - side.z;
        alpha[i * 2] = alpha[i * 2 + 1] = fade * fade * cur.s;
      }
      mesh.visible = any;
      if (any) {
        geo.attributes.position.needsUpdate = true;
        geo.attributes.aAlpha.needsUpdate = true;
      }
    },
  };
}

// Painterly rising helical wind ribbons marking campus Thermal Columns (visible when flying/gliding!)
function createThermalVisuals(groundY, layer) {
  const group = new THREE.Group();
  group.name = 'campus-thermals';
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTime: U.uTime, uVis: { value: 0 }, uSun: U.uSunGlow },
    vertexShader: /* glsl */`
varying vec2 vUv; varying float vH; varying vec3 vWP;
uniform float uTime;
void main() {
  vUv = uv;
  vec3 p = position;
  float ang = uv.y * 9.5 - uTime * 1.45;
  float rad = 1.0 + 0.18 * sin(uv.y * 6.0 - uTime * 2.0);
  p.xz = vec2(p.x * cos(ang) - p.z * sin(ang), p.x * sin(ang) + p.z * cos(ang)) * rad;
  vH = uv.y;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,
    fragmentShader: /* glsl */`
varying vec2 vUv; varying float vH; varying vec3 vWP;
uniform float uTime; uniform float uVis; uniform vec3 uSun;
void main() {
  if (uVis < 0.01) discard;
  float camFade = smoothstep(5.5, 16.0, length(cameraPosition - vWP));
  float rib = pow(max(0.0, sin(vUv.x * 18.84955 + vH * 12.0 - uTime * 2.4)), 6.0);
  float streak = smoothstep(0.0, 0.18, vH) * (1.0 - smoothstep(0.75, 1.0, vH));
  float pulse = 0.65 + 0.35 * sin(vH * 14.0 - uTime * 3.8);
  float a = rib * streak * pulse * uVis * camFade * 0.24;
  vec3 col = mix(vec3(0.95, 0.96, 0.88), clamp(uSun, 0.6, 1.25), 0.55);
  gl_FragColor = vec4(col, a);
}`,
  });

  for (const th of THERMALS) {
    const h = th.top;
    const g = new THREE.CylinderGeometry(th.r * 0.58, th.r * 0.34, h, 24, 18, true);
    g.translate(0, h * 0.5, 0);
    const m = new THREE.Mesh(g, mat);
    m.position.set(th.x, groundY + 1.5, th.z);
    m.frustumCulled = false;
    m.renderOrder = 4;
    group.add(m);
  }
  group.traverse((o) => o.layers.set(layer));
  return { group, mat };
}

export function createFX({ world, wake, layer, maxLeaves = 720, maxSpray = 420 }) {
  // 1. Tumbling leaves, bougainvillea petals, grass clippings & carve dust
  const leafMat = cel({ name: 'fm-blown', key: 'fm-blown', side: THREE.DoubleSide, soft: 0.3, flipBack: true });
  const leafMesh = new THREE.InstancedMesh(leafGeometry(), leafMat, maxLeaves);
  leafMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  leafMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxLeaves * 3), 3);
  leafMesh.count = 0; leafMesh.frustumCulled = false; leafMesh.castShadow = false; leafMesh.receiveShadow = true;
  leafMesh.layers.set(layer);
  world.group.add(leafMesh);

  // 2. Shimmering water spray & mist droplets (砚池 skimming & wet puddle splashes!)
  const sprayGeo = new THREE.PlaneGeometry(1, 1);
  const sprayMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
varying vec2 vUv; varying vec4 vCol;
void main() {
  vUv = uv;
  #ifdef USE_INSTANCING_COLOR
    vCol = vec4(instanceColor, 1.0);
  #else
    vCol = vec4(0.88, 0.96, 1.0, 1.0);
  #endif
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float sc = length(vec3(instanceMatrix[0].xyz));
  mv.xy += position.xy * sc;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */`
varying vec2 vUv; varying vec4 vCol;
void main() {
  float r = length(vUv * 2.0 - 1.0);
  float core = smoothstep(0.85, 0.10, r);
  float mist = smoothstep(1.0, 0.0, r) * 0.38;
  gl_FragColor = vec4(vCol.rgb, (core * core * 0.36 + mist * 0.22));
}`,
  });
  const sprayMesh = new THREE.InstancedMesh(sprayGeo, sprayMat, maxSpray);
  sprayMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  sprayMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxSpray * 3), 3);
  sprayMesh.count = 0; sprayMesh.frustumCulled = false; sprayMesh.renderOrder = 6;
  sprayMesh.layers.set(layer);
  world.group.add(sprayMesh);

  // 3. Wingtip / bristle air-stream ribbons
  const ribL = createAirRibbon(26, 0.036);
  const ribR = createAirRibbon(26, 0.036);
  ribL.mesh.layers.set(layer); ribR.mesh.layers.set(layer);
  world.group.add(ribL.mesh, ribR.mesh);

  // 4. Campus Thermal Updraft Columns
  const thermalVis = createThermalVisuals(world.geo.frame.ground, layer);
  world.group.add(thermalVis.group);

  const P = [];
  const S = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const sc = new THREE.Vector3(), pv = new THREE.Vector3(), col = new THREE.Color();
  const w = { x: 0, y: 0, z: 0 };
  const rnd = (a, b) => a + Math.random() * (b - a);

  const crowns = world.crowns;
  const beds = world.beds || [];
  const waters = world.geo.features.filter((f) => f.kind === 'water');

  function overWater(x, z) {
    // Check surveyed water rects + 砚池 basin around (3, 140)
    if (Math.hypot(x - 3, z - 140) < 16) return true;
    for (const f of waters) {
      const dx = x - f.cx, dz = z - f.cz, c = Math.cos(f.rot || 0), s = Math.sin(f.rot || 0);
      if (Math.abs(dx * c - dz * s) <= f.hw + 1.5 && Math.abs(dx * s + dz * c) <= f.hd + 1.5) return true;
    }
    return false;
  }

  /** Thermal updraft lift (m/s) and thermal label at world position (x, y, z) */
  function thermalAt(x, y, z) {
    const gy = world.geo.frame.ground;
    const agl = y - gy;
    if (agl < 1.5 || agl > 72) return { lift: 0, name: '' };
    // Sun strength boosts daytime thermals (still gentle evening residual warmth)
    const sunGain = 0.55 + 0.65 * Math.max(0, U.uSunDir.value.y);
    let bestLift = 0, name = '';
    for (const th of THERMALS) {
      if (agl > th.top) continue;
      const d = Math.hypot(x - th.x, z - th.z);
      if (d > th.r) continue;
      const radK = Math.cos((d / th.r) * Math.PI * 0.5);
      const topK = THREE.MathUtils.clamp((th.top - agl) / 12, 0, 1);
      const lift = th.lift * radK * radK * topK * sunGain;
      if (lift > bestLift) { bestLift = lift; name = th.label; }
    }
    return { lift: bestLift, name };
  }

  function emitLeaf(kind, x, y, z, vx, vy, vz, n = 1) {
    for (let i = 0; i < n; i++) {
      if (P.length >= maxLeaves) P.shift();
      const size = kind === KIND.grass ? rnd(0.025, 0.045) : kind === KIND.petal ? rnd(0.04, 0.068) : kind === KIND.dust ? rnd(0.035, 0.06) : rnd(0.085, 0.145);
      const cs = COLORS[kind];
      P.push({
        kind, x: x + rnd(-0.32, 0.32), y, z: z + rnd(-0.32, 0.32),
        vx: vx + rnd(-0.6, 0.6), vy: vy + rnd(0.1, 1.1), vz: vz + rnd(-0.6, 0.6),
        rx: rnd(0, 6.28), ry: rnd(0, 6.28), rz: rnd(0, 6.28),
        sx: rnd(-6, 6), sy: rnd(-4, 4), sz: rnd(-6, 6),
        size, life: 0, rest: 0, ttl: kind === KIND.dust ? rnd(0.6, 1.2) : rnd(3.2, 6.0),
        color: cs[(Math.random() * cs.length) | 0], ph: rnd(0, 6.28),
      });
    }
  }

  function emitSpray(x, y, z, vx, vy, vz, n = 1, tint = '#daf4fa') {
    for (let i = 0; i < n; i++) {
      if (S.length >= maxSpray) S.shift();
      S.push({
        x: x + rnd(-0.35, 0.35), y: y + rnd(0, 0.12), z: z + rnd(-0.35, 0.35),
        vx: vx + rnd(-1.2, 1.2), vy: vy + rnd(0.5, 2.1), vz: vz + rnd(-1.2, 1.2),
        size: rnd(0.045, 0.13), grow: rnd(0.18, 0.42), life: 0, ttl: rnd(0.55, 1.15), color: tint,
      });
    }
  }

  function burst(kind, x, y, z, count = 12, speed = 2.8) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rnd(0.4, 1.0) * speed;
      if (kind === 'spray') emitSpray(x, y, z, Math.cos(a) * r, rnd(1.0, 2.8), Math.sin(a) * r, 1);
      else emitLeaf(kind === 'dust' ? KIND.dust : KIND.leafR, x, y + 0.08, z, Math.cos(a) * r, rnd(0.8, 2.2), Math.sin(a) * r, 1);
    }
  }

  const under = (x, z) => {
    let best = null, bd = 1e9;
    for (const t of crowns) { const d = Math.hypot(x - t.x, z - t.z) / t.r; if (d < 1.15 && d < bd) { bd = d; best = t; } }
    return best;
  };
  const nearBed = (x, z) => {
    for (const b of beds) if (Math.hypot(x - b.x, z - b.z) < 1.6 + (b.s || 1) * 0.6) return b;
    return null;
  };

  let acc = 0, ambient = 0, thermVisVal = 0;
  const tipL = new THREE.Vector3(), tipR = new THREE.Vector3();

  function update(dt, s, cameraPos) {
    const speed = s.speed;
    const isAir = s.mode === 'broom' || s.mode === 'glider';
    const low = !isAir || s.agl < 3.4;
    const onWater = overWater(s.pos.x, s.pos.z);

    // Smoothly reveal painterly thermal columns while gliding (strong) or flying broom (subtle)
    const wantTherm = s.mode === 'glider' ? 1.0 : s.mode === 'broom' && s.agl > 4 ? 0.35 : 0;
    thermVisVal += (wantTherm - thermVisVal) * (1 - Math.exp(-dt * 2.2));
    thermalVis.mat.uniforms.uVis.value = thermVisVal;
    thermalVis.group.visible = thermVisVal > 0.01;

    // Wingtip / bristle gossamer air-stream ribbons
    const ribStrength = s.mode === 'broom'
      ? THREE.MathUtils.clamp((speed - 5) / 12 + (s.boost || 0) * 0.45, 0, 1)
      : s.mode === 'glider'
        ? THREE.MathUtils.clamp((speed - 4) / 11, 0.25, 1)
        : 0;
    if (ribStrength > 0.02 && s.ribbonAnchors) {
      tipL.copy(s.ribbonAnchors.L);
      tipR.copy(s.ribbonAnchors.R);
      ribL.update(dt, tipL, cameraPos, ribStrength);
      ribR.update(dt, tipR, cameraPos, ribStrength);
    } else {
      ribL.update(dt, s.pos, cameraPos, 0);
      ribR.update(dt, s.pos, cameraPos, 0);
    }

    // Surface-responsive particle emission
    acc += dt;
    if (acc > 0.045) {
      const step = acc; acc = 0;
      const gx = s.pos.x, gz = s.pos.z, gy = world.heightAt(gx, gz);
      const fast = Math.max(0, speed - (s.mode === 'walk' ? 3.2 : 2.0));

      // 砚池 water spray & wet puddle mist!
      if (onWater && isAir && s.agl < 4.2 && (speed > 2.5 || s.mode === 'broom')) {
        const k = THREE.MathUtils.clamp(1 - (s.agl - 0.8) / 3.4, 0, 1) * (0.4 + speed * 0.14);
        const cnt = Math.min(8, Math.floor(k * 9 * step * 20));
        const rx = -s.vel.z / Math.max(speed, 1), rz = s.vel.x / Math.max(speed, 1);
        for (let i = 0; i < cnt; i++) {
          const side = Math.random() < 0.5 ? -1 : 1;
          emitSpray(
            gx + rx * side * rnd(0.2, 1.1), gy + 0.05, gz + rz * side * rnd(0.2, 1.1),
            s.vel.x * 0.35 + rx * side * rnd(1.5, 4.5), rnd(1.2, 3.6) * k, s.vel.z * 0.35 + rz * side * rnd(1.5, 4.5),
            1, '#dff7fc'
          );
        }
      } else if (!isAir && fast > 1.2 && U.uWet.value > 0.25) {
        if (Math.random() < fast * step * 3.5) {
          emitSpray(gx, gy + 0.04, gz, s.vel.x * 0.2, rnd(0.7, 1.8), s.vel.z * 0.2, 1, '#dbe8ec');
        }
      }

      if (low && fast > 0) {
        const t = under(gx, gz);
        if (t) {
          const n = Math.random() < fast * step * (isAir ? 4.5 : 1.9) ? 1 + ((fast * 0.35) | 0) : 0;
          for (let i = 0; i < n; i++) {
            emitLeaf(
              Math.random() < 0.45 ? KIND.leafR : Math.random() < 0.5 ? KIND.leafY : KIND.leafG,
              gx - s.vel.x * 0.14, gy + 0.06, gz - s.vel.z * 0.14,
              s.vel.x * 0.22, rnd(1.0, 2.8), s.vel.z * 0.22
            );
          }
        }
        if (s.surface === 'lawn' && Math.random() < fast * step * (isAir ? 7.0 : 2.6)) {
          emitLeaf(KIND.grass, gx, gy + 0.1, gz, s.vel.x * 0.2, rnd(0.8, 2.2), s.vel.z * 0.2, 2);
        }
        const b = nearBed(gx, gz);
        if (b && Math.random() < fast * step * 3.8) {
          emitLeaf(KIND.petal, b.x + rnd(-0.6, 0.6), gy + 0.5, b.z + rnd(-0.6, 0.6), s.vel.x * 0.28, rnd(0.9, 2.4), s.vel.z * 0.28, 2);
        }
        // Skateboard hard carve / bike skid subtle sunlit dust
        if ((s.mode === 'board' && Math.abs(s.carve || 0) > 0.16) || (s.mode === 'bike' && s.braking)) {
          if (Math.random() < fast * step * 5.0) {
            emitLeaf(KIND.dust, gx, gy + 0.04, gz, -s.vel.x * 0.12, rnd(0.3, 0.9), -s.vel.z * 0.12, 1);
          }
        }
      }

      // Hovering broom downdraft blows fallen leaves outward in a ring
      if (s.mode === 'broom' && s.agl < 3.2 && under(gx, gz) && Math.random() < step * (3.2 - s.agl) * 1.6) {
        const a = rnd(0, 6.28), r = rnd(0.5, 1.8);
        emitLeaf(Math.random() < 0.5 ? KIND.leafR : KIND.leafY, gx + Math.cos(a) * r, gy + 0.05, gz + Math.sin(a) * r, Math.cos(a) * 2.4, rnd(0.6, 1.8), Math.sin(a) * 2.4);
      }

      // Flying through tree crowns showers leaves into the twin vortices!
      if (s.inCrown > 0.05 && speed > 1.2) {
        const n = Math.random() < s.inCrown * speed * step * 2.6 ? 1 + ((speed * 0.18 * s.inCrown) | 0) : 0;
        for (let i = 0; i < n; i++) {
          emitLeaf(Math.random() < 0.72 ? KIND.leafG : KIND.leafR, s.pos.x + rnd(-1.2, 1.2), s.pos.y + rnd(-0.5, 1.2), s.pos.z + rnd(-1.2, 1.2), s.vel.x * 0.45, rnd(-0.4, 1.2), s.vel.z * 0.45);
        }
      }

      // Gentle ambient falling leaves on the Haikou breeze
      ambient += step;
      if (ambient > 0.38) {
        ambient = 0;
        for (const c of crowns) {
          const d = Math.hypot(c.x - cameraPos.x, c.z - cameraPos.z);
          if (d > 34 || Math.random() > 0.06 * (0.3 + breezeAt(c.x, c.z)) * U.uWindSway.value) continue;
          const a = rnd(0, 6.28), r = rnd(0, c.r * 0.8);
          emitLeaf(Math.random() < 0.5 ? KIND.leafY : KIND.leafR, c.x + Math.cos(a) * r, c.y - c.ry * 0.5, c.z + Math.sin(a) * r, 0, -0.3, 0);
        }
      }
    }

    // Step leaves/petals in the twin counter-rotating vortex field!
    const wd = U.uWindDir.value, ws = U.uWindSpeed.value * 0.35 * Math.min(2, U.uWindSway.value);
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.life += dt;
      const g = world.heightAt(p.x, p.z) + 0.01;
      if (p.kind === KIND.dust) {
        p.vx *= Math.exp(-dt * 3.5); p.vz *= Math.exp(-dt * 3.5); p.vy -= 2.2 * dt;
        p.x += p.vx * dt; p.y = Math.max(g, p.y + p.vy * dt); p.z += p.vz * dt;
        if (p.life > p.ttl) P.splice(i, 1);
        continue;
      }
      if (p.y <= g + 0.005 && p.vy <= 0.05) {
        wake.windAt(p.x, p.y + 0.2, p.z, w);
        const wl = Math.hypot(w.x, w.z);
        if (wl > 1.35) { p.vy = Math.max(0.5, wl * 0.42 + w.y * 0.4); p.vx = w.x * 0.65; p.vz = w.z * 0.65; p.y = g + 0.03; }
        else { p.rest += dt; p.vx *= 0.8; p.vz *= 0.8; p.vy = 0; p.y = g; }
      } else {
        wake.windAt(p.x, p.y, p.z, w);
        const breeze = breezeAt(p.x, p.z);
        const ax = w.x + wd.x * ws * (0.4 + breeze), az = w.z + wd.y * ws * (0.4 + breeze), ay = w.y;
        const drag = p.kind === KIND.grass ? 2.4 : 4.0;
        p.vx += (ax - p.vx) * Math.min(1, drag * dt);
        p.vz += (az - p.vz) * Math.min(1, drag * dt);
        const term = p.kind === KIND.grass ? -1.4 : -0.72;
        p.vy += -9.8 * dt;
        p.vy = Math.max(p.vy, term + ay * 0.85);
        p.vy += ay * dt * 3.5;
        const rock = Math.sin(p.life * 4.2 + p.ph);
        p.x += (p.vx + rock * 0.35 * Math.cos(p.ry)) * dt;
        p.z += (p.vz + rock * 0.35 * Math.sin(p.ry)) * dt;
        p.y += p.vy * dt;
        if (p.y < g) { p.y = g; p.vy = 0; }
        p.rx += p.sx * dt; p.ry += p.sy * dt; p.rz += p.sz * dt;
      }
      if (p.rest > p.ttl * 0.5 || p.life > p.ttl * 3) P.splice(i, 1);
    }

    let n = 0;
    for (const p of P) {
      const lying = p.rest > 0;
      const fade = p.kind === KIND.dust
        ? Math.max(0, 1 - p.life / p.ttl)
        : lying ? Math.max(0, 1 - p.rest / (p.ttl * 0.5)) : Math.min(1, p.life * 6);
      e.set(lying ? -Math.PI / 2 : p.rx, p.ry, lying ? 0 : p.rz);
      q.setFromEuler(e);
      const sz = p.size * fade;
      m4.compose(pv.set(p.x, p.y + (lying ? 0.005 : 0), p.z), q, sc.set(sz * (p.kind === KIND.grass ? 0.42 : 1), sz, sz));
      leafMesh.setMatrixAt(n, m4);
      leafMesh.setColorAt(n, col.set(p.color));
      n++;
    }
    leafMesh.count = n;
    leafMesh.instanceMatrix.needsUpdate = true;
    if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;

    // Step shimmering water spray droplets
    for (let i = S.length - 1; i >= 0; i--) {
      const p = S[i];
      p.life += dt;
      if (p.life >= p.ttl) { S.splice(i, 1); continue; }
      wake.windAt(p.x, p.y, p.z, w);
      p.vx += (w.x * 0.45 - p.vx * 1.4) * dt;
      p.vz += (w.z * 0.45 - p.vz * 1.4) * dt;
      p.vy += (-6.5 + w.y * 1.8) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
    let sn = 0;
    for (const p of S) {
      const k = p.life / p.ttl;
      const sz = (p.size + p.grow * k) * Math.sin(Math.min(1, k * 4) * Math.PI * 0.5) * (1 - k);
      m4.compose(pv.set(p.x, p.y, p.z), q.identity(), sc.set(sz, sz, sz));
      sprayMesh.setMatrixAt(sn, m4);
      sprayMesh.setColorAt(sn, col.set(p.color));
      sn++;
    }
    sprayMesh.count = sn;
    sprayMesh.instanceMatrix.needsUpdate = true;
    if (sprayMesh.instanceColor) sprayMesh.instanceColor.needsUpdate = true;
  }

  return {
    update, burst, thermalAt, overWater,
    resetRibbons() { ribL.reset(); ribR.reset(); },
    stats: () => ({ leaves: P.length, spray: S.length, thermals: THERMALS.length }),
  };
}
