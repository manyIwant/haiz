// Living things and distance: weeping willows, reeds, far tree masses, hills, petals, dust.
// Everything is procedural and seeded, so every frame of every render is identical.
import * as THREE from 'three';
import { B, U } from './world.js';

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const ATMOS_CHUNK = /* glsl */`
uniform vec3 uFogCol; uniform vec3 uFogSun; uniform float uFogDensity; uniform vec3 uSunDir; uniform float uMist; uniform vec3 uMistCol;
vec3 applyAtmos(vec3 col, vec3 wpos) {
  vec3 d = wpos - cameraPosition; float dist = length(d); vec3 v = d / max(dist, 1e-4);
  vec3 fc = mix(uFogCol, uFogSun, pow(max(dot(v, uSunDir), 0.0), 6.0));
  float dens = uFogDensity * exp(-max(wpos.y, 0.0) * 0.012);
  col = mix(col, fc, clamp(1.0 - exp(-dist * dens), 0.0, 1.0));
  float m = uMist * exp(-max(wpos.y, 0.0) * 0.9) * (1.0 - exp(-dist * 0.035));
  return mix(col, uMistCol, clamp(m, 0.0, 0.92));
}`;

// vertex sway + atmosphere for foliage
function foliageMaterial(params, swayAmp, key) {
  const { roughness, ...lp } = params;
  const m = new THREE.MeshLambertMaterial(lp);
  m.userData.tint = { value: new THREE.Color(1, 1, 1) };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.uniforms.uTint = m.userData.tint;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aSway; attribute float aPhase; uniform float uTime; uniform float uWind; varying vec3 vWPos;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float w = uWind;
          float s = aSway * aSway;
          float gust = 0.6 + 0.4 * sin(uTime * 0.37 + aPhase * 0.3) * sin(uTime * 0.23 + 1.7);
          transformed.x += s * ${swayAmp.toFixed(3)} * w * gust * (sin(uTime * 1.3 + aPhase) * 0.6 + 0.8);
          transformed.z += s * ${swayAmp.toFixed(3)} * w * gust * 0.5 * sin(uTime * 1.7 + aPhase * 1.3);
        }`)
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        #ifdef USE_INSTANCING
          vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; uniform vec3 uTint;\n' + ATMOS_CHUNK)
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= uTint;')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        // light through leaves when the sun is behind them
        { vec3 V = normalize(cameraPosition - vWPos); float back = pow(max(dot(-V, uSunDir), 0.0), 4.0);
          reflectedLight.directDiffuse += diffuseColor.rgb * uSunCol * back * 0.35; }`)
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb = applyAtmos(gl_FragColor.rgb, vWPos);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSunCol;');
  };
  m.customProgramCacheKey = () => 'foliage' + key;
  return m;
}

function leafStripTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 1024;
  const g = c.getContext('2d'); const r = rng(11);
  g.clearRect(0, 0, 64, 1024);
  g.strokeStyle = 'rgba(92,80,52,1)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(32, 0); g.lineTo(32, 1024); g.stroke();
  for (let y = 6; y < 1020; y += 9 + r() * 8) {
    for (const side of [-1, 1]) {
      if (r() < 0.3) continue;
      const len = 18 + r() * 12, wid = 2.4 + r() * 1.6;
      const ang = side * (0.35 + r() * 0.5) + Math.PI / 2;
      const h = 70 + r() * 18, s = 45 + r() * 20, l = 34 + r() * 16;
      g.fillStyle = `hsl(${h},${s}%,${l}%)`;
      g.save(); g.translate(32, y); g.rotate(ang - Math.PI / 2 + side * 0.15);
      g.beginPath(); g.ellipse(0, len / 2, wid, len / 2, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ------------------------------------------------------------------ willows
function willow(seed, height, leafMat, barkMat) {
  const r = rng(seed);
  const grp = new THREE.Group();
  // trunk: tapered tube along a leaning curve
  const lean = new THREE.Vector3((r() - 0.5) * 1.2, 0, (r() - 0.5) * 1.2);
  const pts = [];
  for (let i = 0; i <= 6; i++) { const k = i / 6; pts.push(new THREE.Vector3(lean.x * k * k + Math.sin(k * 3 + seed) * 0.15, k * height * 0.62, lean.z * k * k)); }
  const trunk = new THREE.CatmullRomCurve3(pts);
  const barkGeo = [];
  const tube = (curve, r0, r1, segs, rad = 7) => {
    const pos = [], idx = [], nor = [];
    for (let i = 0; i <= segs; i++) {
      const k = i / segs, p = curve.getPointAt(k), tg = curve.getTangentAt(k);
      const n = new THREE.Vector3(0, 1, 0).cross(tg); if (n.lengthSq() < 1e-6) n.set(1, 0, 0); n.normalize();
      const b = tg.clone().cross(n).normalize(); const rr = THREE.MathUtils.lerp(r0, r1, k) * (1 + 0.08 * Math.sin(k * 23 + seed));
      for (let j = 0; j <= rad; j++) { const a = j / rad * Math.PI * 2; const d = n.clone().multiplyScalar(Math.cos(a)).addScaledVector(b, Math.sin(a)); pos.push(p.x + d.x * rr, p.y + d.y * rr, p.z + d.z * rr); nor.push(d.x, d.y, d.z); }
    }
    for (let i = 0; i < segs; i++) for (let j = 0; j < rad; j++) { const a = i * (rad + 1) + j, b2 = a + rad + 1; idx.push(a, b2, a + 1, b2, b2 + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
    barkGeo.push(g);
  };
  tube(trunk, height * 0.035, height * 0.018, 10, 9);
  // limbs rising from the top of the trunk, arching outwards
  const top = trunk.getPointAt(1);
  const strands = [];
  const nl = 6 + Math.floor(r() * 3);
  const crown = [];
  for (let l = 0; l < nl; l++) {
    const a = l / nl * Math.PI * 2 + r() * 0.6;
    const reach = height * (0.3 + r() * 0.22);
    const up = height * (0.18 + r() * 0.18);
    const base = trunk.getPointAt(0.7 + r() * 0.3);
    const c = new THREE.CatmullRomCurve3([base, base.clone().add(new THREE.Vector3(Math.cos(a) * reach * 0.35, up * 0.8, Math.sin(a) * reach * 0.35)),
      base.clone().add(new THREE.Vector3(Math.cos(a) * reach, up, Math.sin(a) * reach))]);
    tube(c, height * 0.014, height * 0.004, 6, 5);
    for (let k = 0.25; k <= 1.0; k += 0.03 + r() * 0.03) crown.push(c.getPointAt(k));
  }
  // a dome of strand roots over the limbs
  const domeC = top.clone().add(new THREE.Vector3(0, height * 0.05, 0));
  const domeR = height * 0.42;
  for (let i = 0; i < 150; i++) {
    const a = r() * Math.PI * 2, e = Math.acos(1 - r() * 0.95);   // upper cap
    crown.push(domeC.clone().add(new THREE.Vector3(Math.cos(a) * Math.sin(e) * domeR, Math.cos(e) * domeR * 0.55, Math.sin(a) * Math.sin(e) * domeR)));
  }
  // hanging strands: crossed ribbons that curve out and fall
  const pos = [], uv = [], sway = [], phase = [], nor = [], idx = [];
  let vi = 0;
  for (const p of crown) {
    const n = 1 + Math.floor(r() * 2.2);
    const radial = Math.hypot(p.x - top.x, p.z - top.z) / (height * 0.42);
    for (let s = 0; s < n; s++) {
      const L = Math.min(p.y - 0.5 - r() * 1.2, (p.y - 0.8) * (0.35 + 0.55 * radial + r() * 0.3));
      if (L < 0.8) continue;
      const out = new THREE.Vector3(p.x - top.x, 0, p.z - top.z).normalize().multiplyScalar(0.3 + r() * 0.6);
      const off = new THREE.Vector3((r() - 0.5) * 0.6, (r() - 0.2) * 0.3, (r() - 0.5) * 0.6);
      const ph = r() * 6.28;
      const segs = 7;
      for (const rot of [0, Math.PI / 2]) {
        const wv = 0.09 + r() * 0.06;
        const side = new THREE.Vector3(Math.cos(rot + r()), 0, Math.sin(rot + r()));
        for (let k = 0; k <= segs; k++) {
          const t = k / segs;
          const q = p.clone().add(off).addScaledVector(out, Math.sin(Math.min(t * 2.2, 1.57)) * (0.5 + radial * 0.8));
          q.y -= t * L;
          for (const e of [-1, 1]) {
            pos.push(q.x + side.x * wv * e, q.y, q.z + side.z * wv * e);
            uv.push(e < 0 ? 0 : 1, t * L / 2.2);
            sway.push(t); phase.push(ph);
            nor.push(-side.z, 0.3, side.x);
          }
          if (k < segs) { idx.push(vi, vi + 2, vi + 1, vi + 1, vi + 2, vi + 3); }
          vi += 2;
        }
      }
    }
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  sg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  sg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  sg.setAttribute('aSway', new THREE.Float32BufferAttribute(sway, 1));
  sg.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
  sg.setIndex(idx);
  grp.add(new THREE.Mesh(sg, leafMat));
  for (const g of barkGeo) {
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count), 1));
    g.setAttribute('aPhase', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count), 1));
    grp.add(new THREE.Mesh(g, barkMat));
  }
  return grp;
}

export async function addNature(W) {
  const scene = W.scene;
  const N = { willows: [], leafMats: [] };
  const leafTex = leafStripTexture();
  leafTex.wrapT = THREE.RepeatWrapping;
  const leafMat = foliageMaterial({ map: leafTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, color: 0xffffff }, 0.55, 'leaf');
  const barkMat = foliageMaterial({ color: 0x3b342c, roughness: 0.95 }, 0.0, 'bark');
  N.leafMat = leafMat;
  // west bank (blender x, y) and a few on the east walk
  const spots = [[-43, -122], [-44.5, -97], [-42.5, -79], [-45, -57], [-43, -41], [-46, -23], [-42.5, -7], [-44, 9], [-45.5, 26],
    [-43, 43], [-44.5, 61], [-42.6, 82], [-45, 103], [-43.5, 130], [-1.4, -38.5], [-1.0, -58.0], [4.0, 116.0], [-1.2, -92]];
  spots.forEach(([x, y], i) => {
    const h = 7.2 + (i * 37 % 10) / 10 * 2.4;
    const w = willow(1000 + i * 17, h, leafMat, barkMat);
    w.position.copy(B(x, y, 1.0));
    w.rotation.y = i * 1.3;
    scene.add(w); N.willows.push(w);
  });
  // reeds: last year's straw and new green shoots along the west waterline (and near the bridge)
  {
    const blade = new THREE.BufferGeometry();
    const segs = 5, P = [], UV = [], S = [], PH = [], NO = [], I = [];
    for (let k = 0; k <= segs; k++) { const t = k / segs, w = 0.018 * (1 - t * 0.85); for (const e of [-1, 1]) { P.push(e * w, t, Math.sin(t * 1.4) * 0.12 * t); UV.push(e < 0 ? 0 : 1, t); S.push(t); PH.push(0); NO.push(0, 0.2, 1); } if (k < segs) { const a = k * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
    blade.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); blade.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    blade.setAttribute('normal', new THREE.Float32BufferAttribute(NO, 3)); blade.setAttribute('aSway', new THREE.Float32BufferAttribute(S, 1)); blade.setIndex(I);
    const count = 9000; const r = rng(77);
    const ph = new Float32Array(count); for (let i = 0; i < count; i++) ph[i] = r() * 6.28;
    blade.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1));
    const reedMat = foliageMaterial({ color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide, vertexColors: false }, 0.18, 'reed');
    const im = new THREE.InstancedMesh(blade, reedMat, count);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      // clumps along y; x from the waterline into the shallows
      const clump = Math.floor(r() * 160);
      const cy = -230 + clump * 3.1 + (r() - 0.5) * 2.4;
      const x = -38.2 + (r() - 0.35) * 1.6;
      const zb = Math.max(-0.25, Math.min(0.5, (-38.0 - x) * 0.95));
      q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.35, r() * 6.28, (r() - 0.5) * 0.35));
      const h = 1.0 + r() * 1.3;
      sc.set(1 + r(), h, 1);
      m.compose(B(x, cy + (r() - 0.5) * 1.4, zb), q, sc);
      im.setMatrixAt(i, m);
      const dry = r() < 0.72;
      col.setRGB(...(dry ? [0.62 + r() * 0.12, 0.54 + r() * 0.1, 0.36 + r() * 0.06] : [0.26 + r() * 0.1, 0.38 + r() * 0.1, 0.14]));
      im.setColorAt(i, col);
    }
    im.frustumCulled = false;
    scene.add(im); N.reeds = im;
  }
  // far tree masses on the open land beyond the west bank
  {
    let geo = new THREE.IcosahedronGeometry(1, 3);
    geo = (await import('./vendor/three/utils/BufferGeometryUtils.js')).mergeVertices(geo);
    const p = geo.attributes.position; const r0 = rng(5);
    for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i);
      const n = 0.86 + 0.10 * Math.sin(v.x * 3.1 + v.y * 2.3) * Math.cos(v.z * 2.7) + 0.05 * Math.sin(v.x * 9.0 + v.z * 7.0) * Math.cos(v.y * 8.0);
      v.multiplyScalar(n); if (v.y < -0.3) v.y = -0.3 + (v.y + 0.3) * 0.3; p.setXYZ(i, v.x, v.y, v.z); }
    geo.computeVertexNormals();
    geo.setAttribute('aSway', new THREE.Float32BufferAttribute(new Float32Array(p.count), 1));
    const count = 520; const ph = new Float32Array(count); geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1));
    const mat = foliageMaterial({ color: 0xffffff, roughness: 1 }, 0, 'blob');
    const im = new THREE.InstancedMesh(geo, mat, count);
    const r = rng(9); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      let x, y;
      if (i < 260) { x = -110 - Math.pow(r(), 1.5) * 700; y = -900 + r() * 1900; }         // west plain
      else if (i < 400) { x = 30 + r() * 600; y = -900 + r() * 1900; if (x < 90 && Math.abs(y) < 160) x += 120; } // behind the school
      else { const row = i % 2; x = -150 - row * 11; y = -400 + (i - 400) * 7.2 + r() * 3; }      // a line of poplars
      const poplar = i >= 400;
      const w = poplar ? 2.6 + r() * 1.2 : 3 + r() * 5, h = poplar ? 6.5 + r() * 2.5 : w * (0.7 + r() * 0.5);
      q.setFromEuler(new THREE.Euler(0, r() * 6, 0)); s.set(w, h, w);
      m.compose(B(x, y, 1.0 + h * 0.85), q, s); im.setMatrixAt(i, m);
      c.setRGB(0.16 + r() * 0.06, 0.22 + r() * 0.08, 0.10 + r() * 0.04); im.setColorAt(i, c);
    }
    im.frustumCulled = false; scene.add(im); N.blobs = im;
  }
  // hills: a ragged ring far to the west, north and south
  {
    const segs = 360, rows = 6, P = [], I = [];
    const r = rng(3);
    const amp = []; for (let i = 0; i <= segs; i++) amp.push(0);
    for (let o = 1; o < 6; o++) { const ph = r() * 6.28, fr = o * 3 + Math.floor(r() * 3); for (let i = 0; i <= segs; i++) amp[i] += Math.sin(i / segs * 6.28 * fr + ph) / o; }
    for (let i = 0; i <= segs; i++) {
      const a = i / segs * Math.PI * 2;
      // stronger hills to the west (behind the far bank), low elsewhere
      const west = Math.max(0, -Math.cos(a));
      const h = 30 + (70 + 160 * west) * (0.6 + 0.4 * amp[i] * 0.5 + 0.2);
      for (let k = 0; k <= rows; k++) {
        const t = k / rows; const R = 2200 + 300 * Math.sin(a * 3) ;
        const x = Math.cos(a) * R, y = Math.sin(a) * R;
        const z = (t < 1 ? h * Math.sin(t * Math.PI / 2) : h) - 5;
        P.push(...B(x * (1 - 0.08 * t), y * (1 - 0.08 * t), z).toArray());
      }
    }
    for (let i = 0; i < segs; i++) for (let k = 0; k < rows; k++) { const a = i * (rows + 1) + k, b = a + rows + 1; I.push(a, a + 1, b, a + 1, b + 1, b); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(new Float32Array(P.length / 3), 1));
    g.setAttribute('aPhase', new THREE.Float32BufferAttribute(new Float32Array(P.length / 3), 1));
    const mat = foliageMaterial({ color: 0x2c3a2c, roughness: 1, side: THREE.DoubleSide }, 0, 'hill');
    const hills = new THREE.Mesh(g, mat); hills.frustumCulled = false; scene.add(hills); N.hills = hills; N.hillMat = mat;
  }
  N.blobMat = N.blobs.material; N.reedMat = N.reeds.material;
  // ivy (爬山虎) climbing the river face of the school, rooted at the plinth, framing the windows
  {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.clearRect(0, 0, 128, 128);
    g.beginPath(); g.moveTo(64, 120);
    g.bezierCurveTo(20, 104, 4, 70, 18, 44); g.bezierCurveTo(28, 52, 36, 50, 40, 40);
    g.bezierCurveTo(38, 20, 52, 8, 64, 4); g.bezierCurveTo(76, 8, 90, 20, 88, 40);
    g.bezierCurveTo(92, 50, 100, 52, 110, 44); g.bezierCurveTo(124, 70, 108, 104, 64, 120); g.closePath();
    const gr = g.createRadialGradient(64, 90, 6, 64, 64, 70); gr.addColorStop(0, '#b9d27a'); gr.addColorStop(1, '#6f9a3c');
    g.fillStyle = gr; g.fill();
    g.strokeStyle = 'rgba(60,80,30,0.55)'; g.lineWidth = 2;
    for (const [x, y] of [[64, 8], [22, 48], [106, 48], [40, 92], [88, 92]]) { g.beginPath(); g.moveTo(64, 116); g.lineTo(x, y); g.stroke(); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const leaf = new THREE.PlaneGeometry(1, 1); leaf.rotateY(-Math.PI / 2);   // faces -x (west, the river)
    const count = 15000; const r = rng(404);
    leaf.setAttribute('aSway', new THREE.Float32BufferAttribute(new Float32Array([0.6, 0.6, 0.2, 0.2]), 1));
    const ph = new Float32Array(count); for (let i = 0; i < count; i++) ph[i] = r() * 6.28;
    leaf.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1));
    const mat = foliageMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }, 0.03, 'ivy');
    const im = new THREE.InstancedMesh(leaf, mat, count);
    // patches: [root y, height, half width]
    const patches = [[-23.2, 9.5, 1.6], [-17.0, 6.0, 2.2], [-12.6, 3.2, 1.0], [-6.9, 7.8, 1.7], [-2.0, 4.6, 0.9], [2.1, 2.9, 0.7], [5.3, 8.6, 1.4], [11.6, 5.0, 1.8], [16.2, 10.5, 2.4], [23.0, 6.5, 1.5]];
    const WIN = [];
    for (const fz of [1.0, 4.6, 8.2]) for (const [c0, k] of [[-19.62, 2], [-10.24, 3], [0, 3], [10.24, 3], [19.62, 2]]) {
      const cs = k === 3 ? [c0 - 3.3, c0, c0 + 3.3] : [c0 - 2.1, c0 + 2.1];
      for (const cc of cs) WIN.push([cc - 1.25, cc + 1.25, fz + 0.82, fz + 3.05]);
    }
    const inWin = (y, z) => WIN.some(w => y > w[0] && y < w[1] && z > w[2] && z < w[3]);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), col = new THREE.Color();
    let n = 0, guard = 0;
    while (n < count && guard++ < count * 20) {
      const pt = patches[Math.floor(r() * patches.length)];
      // a vine fans out from its root: a few runners that wander upward and sideways
      const run = Math.floor(r() * 5), seed = pt[0] * 13 + run * 7;
      const hz = Math.pow(r(), 0.75) * pt[1] * (0.6 + 0.4 * Math.sin(seed));
      const lean = (Math.sin(seed * 1.7) * 1.4) * pt[2];
      const wander = Math.sin(hz * 1.3 + seed) * 0.5 + Math.sin(hz * 3.1 + seed * 2) * 0.2;
      const y = pt[0] + lean * (hz / pt[1]) + wander + (r() - 0.5) * (0.35 + hz * 0.12);
      const z = 1.0 + hz + (r() - 0.5) * 0.2;
      if (r() < 0.25 && hz > pt[1] * 0.85) continue;                  // thin, ragged tips
      if (inWin(y, z) || Math.abs(y) > 24.0 || z > 12.6) continue;
      const s0 = 0.14 + r() * 0.14;
      q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.9, (r() - 0.5) * 0.8, (r() - 0.5) * 1.6 + Math.PI));
      m.compose(B(-6.02 - r() * 0.13, y, z), q, sc.set(s0, s0, s0));
      im.setMatrixAt(n, m);
      const red = r() < 0.05;
      col.setHSL(red ? 0.02 + r() * 0.04 : 0.22 + r() * 0.07, red ? 0.55 : 0.45 + r() * 0.2, red ? 0.36 : 0.30 + r() * 0.16);
      im.setColorAt(n, col);
      n++;
    }
    im.count = n; im.frustumCulled = false;
    scene.add(im); N.ivy = im; N.ivyMat = mat;
  }
  // haze under each canopy lamp at night: soft additive cones
  N.cones = [];
  {
    const geo = new THREE.ConeGeometry(1.9, 3.3, 32, 1, true); geo.translate(0, -1.65, 0);
    for (let yl = 52; yl <= 100; yl += 8) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { amt: { value: 0 } },
        vertexShader: `varying float vH; varying vec3 vN; varying vec3 vV; void main(){ vH = -position.y / 3.3; vec4 w = modelMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: `uniform float amt; varying float vH; varying vec3 vN; varying vec3 vV;
          void main(){ float e = pow(abs(dot(normalize(vN), normalize(vV))), 1.6); float a = pow(1.0 - vH, 2.6) * e * e * 0.085 * amt;
            gl_FragColor = vec4(vec3(1.0, 0.82, 0.58) * a, 1.0); }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const cone = new THREE.Mesh(geo, mat); cone.position.copy(B(-3.5, yl, 4.49)); cone.frustumCulled = false;
      scene.add(cone); N.cones.push(cone);
    }
  }
  return N;
}

// petals drifting on the water (positions are a pure function of time)
export function makePetals(W, count = 2200) {
  const g = new THREE.PlaneGeometry(0.022, 0.016); g.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: 0xf3d6dc, roughness: 0.6, side: THREE.DoubleSide });
  mat.onBeforeCompile = (s) => { s.fragmentShader = s.fragmentShader.replace('#include <fog_fragment>', ''); };
  const im = new THREE.InstancedMesh(g, mat, count);
  const r = rng(21); const seeds = [];
  for (let i = 0; i < count; i++) seeds.push([r(), r(), r(), r()]);
  im.userData.seeds = seeds; im.frustumCulled = false; im.visible = false;
  W.scene.add(im);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
  for (let i = 0; i < count; i++) { c.setHSL(0.96 + seeds[i][3] * 0.04, 0.45, 0.82 + seeds[i][2] * 0.1); im.setColorAt(i, c); }
  im.update = (t, cx, cy, radius = 26, flow = 0.12) => {
    for (let i = 0; i < count; i++) {
      const s = seeds[i];
      const bx = -36 + s[0] * 29;
      let by = cy - radius + ((s[1] * 2 * radius + t * flow * (0.7 + 0.6 * s[2])) % (2 * radius));
      const wob = Math.sin(t * 0.4 + s[3] * 20) * 0.08;
      q.setFromEuler(new THREE.Euler(0, s[2] * 6.28 + t * 0.05 * (s[3] - 0.5), 0));
      m.compose(B(bx + wob, by, 0.004), q, sc.set(1 + s[3] * 1.5, 1, 1 + s[3] * 1.5));
      im.setMatrixAt(i, m);
    }
    im.instanceMatrix.needsUpdate = true;
  };
  return im;
}

// dust motes inside the classroom: visible only where the sun reaches (sampled from the shaft shadow map)
export function makeDust(W, count = 2600) {
  const r = rng(31);
  const P = new Float32Array(count * 3), S = new Float32Array(count);
  for (let i = 0; i < count; i++) { const p = B(-5.7 + r() * 7.1, -4.9 + r() * 9.8, 1.1 + r() * 3.2); P.set([p.x, p.y, p.z], i * 3); S[i] = r(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(S, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ tSunDepth: { value: null }, sunMat: { value: new THREE.Matrix4() }, amount: { value: 0 }, px: { value: 1 } }, U),
    vertexShader: `attribute float aSeed; uniform float uTime, px; uniform sampler2D tSunDepth; uniform mat4 sunMat; varying float vLit; varying float vSeed;
      void main(){ vec3 p = position; float s = aSeed * 50.0;
        p += vec3(sin(uTime * 0.11 + s), sin(uTime * 0.07 + s * 1.3) * 0.6 - mod(uTime * 0.01 + aSeed, 1.0) * 0.0, cos(uTime * 0.09 + s * 0.7)) * 0.25;
        vec4 sp = sunMat * vec4(p, 1.0); sp.xyz = sp.xyz / sp.w * 0.5 + 0.5;
        vLit = step(sp.z - 0.002, texture2D(tSunDepth, sp.xy).x); vSeed = aSeed;
        vec4 mv = viewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = px * (1.2 + aSeed * 1.6) * 3.0 / max(-mv.z, 0.4); }`,
    fragmentShader: `uniform vec3 uSunCol; uniform float amount; varying float vLit; varying float vSeed;
      void main(){ vec2 d = gl_PointCoord - 0.5; float a = exp(-dot(d, d) * 14.0); gl_FragColor = vec4(uSunCol * vLit * amount * a * (0.4 + vSeed), 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.visible = false;
  W.scene.add(pts);
  return pts;
}
