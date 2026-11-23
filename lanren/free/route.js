// HAIZ · 自由共游 — the way, painted on the campus itself. On the ground: vermilion brush dabs laid along the
// path a few metres ahead of you, each one a stroke in the direction of travel, a slow pulse running
// through them toward where you are going (the way a hand would mark a route on a map, but on the paving).
// In the air: a tall, soft stroke of light standing over the place, visible across the campus.
import * as THREE from 'three';

const DABS = 44;

export function createRoute({ world, layer }) {
  const group = new THREE.Group(); group.name = 'route';
  // a dab: a quad whose alpha is a brush mark (dry-brush edges, a heavier head)
  const dabMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: { uTime: { value: 0 }, uFade: { value: 0 } },
    vertexShader: /* glsl */`
attribute float aK; attribute float aSeed;
varying vec2 vUv; varying float vK; varying float vSeed;
void main() { vUv = uv; vK = aK; vSeed = aSeed; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
uniform float uTime; uniform float uFade;
varying vec2 vUv; varying float vK; varying float vSeed;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  // a stroke: wider at its head (+y), tapering to a dry tail
  float w = mix(0.35, 0.95, smoothstep(-1.0, 0.6, p.y));
  float body = (1.0 - smoothstep(0.75, 1.0, abs(p.x) / w)) * smoothstep(-1.0, -0.6, p.y) * (1.0 - smoothstep(0.82, 1.0, p.y));
  float bristle = n(vec2(p.x * 9.0 + vSeed * 13.0, p.y * 1.5)) * 0.6 + n(vec2(p.x * 23.0, p.y * 4.0 + vSeed)) * 0.4;
  float a = body * smoothstep(0.2 + (1.0 - p.y) * 0.25, 0.55 + (1.0 - p.y) * 0.25, bristle + 0.3);
  // the pulse running toward the destination
  float pulse = 0.55 + 0.45 * smoothstep(0.75, 1.0, fract(vK * 0.11 - uTime * 0.6));
  gl_FragColor = vec4(vec3(0.69, 0.13, 0.11) * (0.85 + 0.3 * pulse), a * uFade * mix(0.55, 0.95, pulse) * smoothstep(0.0, 3.0, vK));
}`,
  });
  const geo = new THREE.PlaneGeometry(0.62, 1.15).rotateX(-Math.PI / 2);
  const kA = new THREE.InstancedBufferAttribute(new Float32Array(DABS), 1), sA = new THREE.InstancedBufferAttribute(new Float32Array(DABS).map(() => Math.random()), 1);
  geo.setAttribute('aK', kA); geo.setAttribute('aSeed', sA);
  const dabs = new THREE.InstancedMesh(geo, dabMat, DABS);
  dabs.frustumCulled = false; dabs.count = 0; dabs.renderOrder = 3;
  group.add(dabs);
  // the beacon: a vertical stroke of light (camera-facing column, soft edges, drifting brush texture)
  const beaconMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uFade: { value: 0 } },
    vertexShader: /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 c = (modelMatrix * vec4(0.0, position.y, 0.0, 1.0)).xyz;
  vec3 toCam = normalize(vec3(cameraPosition.x - c.x, 0.0, cameraPosition.z - c.z));
  vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
  vec3 wp = c + side * position.x;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`,
    fragmentShader: /* glsl */`
uniform float uTime; uniform float uFade; varying vec2 vUv;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main() {
  float x = abs(vUv.x * 2.0 - 1.0);
  float core = exp(-x * x * 9.0);
  float streak = n(vec2(vUv.x * 7.0, vUv.y * 3.0 - uTime * 0.25)) * 0.5 + 0.5;
  float top = (1.0 - smoothstep(0.55, 1.0, vUv.y)) * smoothstep(0.0, 0.04, vUv.y);
  gl_FragColor = vec4(vec3(1.0, 0.55, 0.35) * core * streak * top * uFade * 0.75, 1.0);
}`,
  });
  const beacon = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 60, 1, 8).translate(0, 30, 0), beaconMat);
  beacon.frustumCulled = false; beacon.visible = false; beacon.renderOrder = 4;
  group.add(beacon);
  group.traverse((o) => o.layers.set(layer));
  world.group.add(group);

  let route = null, fade = 0, t = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pv = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  return {
    set(r) { route = r; },
    update(dt, pos) {
      t += dt;
      dabMat.uniforms.uTime.value = beaconMat.uniforms.uTime.value = t;
      fade += ((route ? 1 : 0) - fade) * (1 - Math.exp(-dt * 3));
      dabMat.uniforms.uFade.value = beaconMat.uniforms.uFade.value = fade;
      if (!route) { if (fade < 0.01) { dabs.count = 0; beacon.visible = false; } return; }
      const d = route.dest;
      beacon.visible = true;
      beacon.position.set(d.x, world.heightAt(d.x, d.z), d.z);
      if (route.air) { dabs.count = 0; return; }
      // dabs along the path from the point nearest you, 2.5 … 45 m ahead, every 1.25 m
      const pts = route.points;
      let bi = 0, bt = 0, bd = 1e9;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
        const tt = Math.max(0, Math.min(1, ((pos.x - a.x) * dx + (pos.z - a.z) * dz) / L2));
        const dd = Math.hypot(pos.x - a.x - dx * tt, pos.z - a.z - dz * tt);
        if (dd < bd) { bd = dd; bi = i; bt = tt; }
      }
      let i = bi, s = bt * Math.hypot(pts[bi].x - pts[bi - 1].x, pts[bi].z - pts[bi - 1].z), n = 0, along = 0;
      const step = 1.25;
      let next = 2.5;
      const total = 45;
      while (i < pts.length && n < DABS && along < total) {
        const a = pts[i - 1], b = pts[i], L = Math.hypot(b.x - a.x, b.z - a.z);
        while (s <= L && n < DABS) {
          if (along >= next) {
            const x = a.x + (b.x - a.x) * (s / L), z = a.z + (b.z - a.z) * (s / L);
            q.setFromAxisAngle(up, Math.atan2(b.x - a.x, b.z - a.z) + Math.PI);
            m4.compose(pv.set(x, world.heightAt(x, z) + 0.03, z), q, one);
            dabs.setMatrixAt(n, m4);
            kA.setX(n, along * (1 - Math.max(0, (along - total + 8) / 8)));
            n++; next += step;
          }
          const ds = 0.25; s += ds; along += ds;
        }
        s -= L; i++;
      }
      dabs.count = n;
      dabs.instanceMatrix.needsUpdate = true; kA.needsUpdate = true;
    },
  };
}
