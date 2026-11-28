// @ts-nocheck — three.js scene code
/**
 * 榄仁 · the century Terminalia, as a homologous scene (006).
 *
 * Inherits, rather than redraws:
 *   - Experiment 003's study-terminalia.js: tree.glb trunk & buttress roots with real bark, the
 *     trimmed Taihu island, clump-smoothed leaf normals in the line pass (so the line drawing
 *     shows the tiered crown, not triangle noise) and the 0.89 "botanical ink" tier
 *   - the main site's V4 foliage (lanren/js/foliage.js, ported verbatim in foliage-port.ts):
 *     leaf instances expanded from rosettes.bin, per-leaf emergence times, the wind and touch
 *     functions, the leaf colour ramp and the growth function in its 年轮 "year" mode
 *   - the phenology model (lanren/js/season.js): a day of the year → how far last season's
 *     cohort has turned and fallen (turn) and how far the new flush has grown (flushG)
 *
 * So the month slider does not pick a picture: it moves each of ~30k real leaves through its own
 * colouring, letting go, budding and unfolding — and the line drawing follows, leaf for leaf,
 * because both passes run the same vertex code.
 */
import * as THREE from "three";
import { WIND_GLSL, LEAF_COLOUR_GLSL, GROW_GLSL, buildLeafInstances, leafGeometry, mulberry } from "./foliage-port";
import { seasonAt } from "../culture/season";
import { loadTerminalia } from "./assets";
import type { HomologousStage } from "./homologous";
import { spring, stepS, clamp } from "../kernel/motion";

const ISLAND_TRIM = /* glsl */ `
  float isoAng = atan(vIsoPos.z, vIsoPos.x);
  float isoLim = 6.2 + 0.45 * sin(isoAng * 3.0 + 0.5) + 0.28 * cos(isoAng * 5.0);
  if (length(vIsoPos.xz) > isoLim) discard;`;

const LEAF_VERT = (nd: boolean) => /* glsl */ `
  ${WIND_GLSL}
  ${GROW_GLSL}
  attribute vec4 aRosette; attribute vec4 aLeaf; attribute vec4 aPad;
  ${nd ? "uniform float uInflate;" : ""}
  varying vec2 vUv; varying vec3 vPadN; varying float vAge; varying float vYoung; varying float vVar; varying float vOcc; varying float vShell;
  void main() {
    float variant = aLeaf.z; float uu, scl, young, fold, erect, age;
    leafGrow(aLeaf.x, aLeaf.y, uu, scl, young, fold, erect, age);
    if (scl == 0.0) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
    vUv = vec2((variant + uv.x) * 0.25, uv.y);
    vAge = age; vYoung = young; vVar = fract(variant * 0.37 + aLeaf.x * 13.0); vOcc = aLeaf.w; vShell = aPad.w;
    vec3 t = position;
    float sz = sign(t.z), az = abs(t.z);
    t.y += az * sin(fold); t.z = sz * az * cos(fold);
    float ce = cos(erect), se = sin(erect);
    t.xy = vec2(t.x * ce - t.y * se, t.x * se + t.y * ce);
    t *= scl${nd ? " * uInflate" : ""};
    float touchE;
    vec3 rp = aRosette.xyz;
    vec3 disp = windSway(rp, aRosette.w) + touchPush(rp, touchE);
    float fl = sin(uTime * (5.5 + aLeaf.y * 3.0 + aLeaf.x * 4.0) + aLeaf.x * 40.0) * (0.05 + 0.2 * uWind * uGust + 0.6 * touchE) * (1.0 + young);
    t.y += fl * t.x;
    mat3 lim = mat3(instanceMatrix);
    t += transpose(lim) * disp / dot(lim[0], lim[0]);
    vec3 padN = normalize((aRosette.xyz - aPad.xyz) * vec3(1.0, 1.45, 1.0) + vec3(0.0, 0.35, 0.0));
    vPadN = ${nd ? "normalize(normalMatrix * padN)" : "normalize(mat3(modelMatrix) * padN)"};
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(t, 1.0);
  }
`;

const LEAF_FRAG = /* glsl */ `
  ${LEAF_COLOUR_GLSL}
  uniform sampler2D uAtlas; uniform vec3 uSunDir; uniform float uLight; uniform float uNight;
  varying vec2 vUv; varying vec3 vPadN; varying float vAge; varying float vYoung; varying float vVar; varying float vOcc; varying float vShell;
  void main() {
    vec4 lt = texture2D(uAtlas, vUv);
    if (lt.a < 0.5) discard;
    vec3 lc = leafColour(vAge, lt.b, vYoung, vVar);
    float lum = lt.r * 1.38 * (0.82 + 0.36 * fract(vVar * 7.31));
    vec3 base = lc * lum;
    base = mix(base, base * vec3(1.42, 1.36, 0.82), lt.g * 0.55 * (1.0 - vAge));
    float ndl = dot(normalize(vPadN), uSunDir) * 0.5 + 0.5;
    float ao = mix(1.0, 0.5, clamp(vOcc * 0.9, 0.0, 0.9));
    vec3 lit = base * (0.55 + 1.75 * ndl * ndl) * ao * uLight;
    lit += base * vec3(1.2, 1.0, 0.55) * pow(max(0.0, ndl), 3.0) * 0.35 * vShell;   // sun through the outer leaves
    lit = mix(lit, lit * vec3(0.55, 0.65, 0.95), uNight);
    gl_FragColor = vec4(lit * 2.2, 1.0);
  }
`;

const LEAF_ND_FRAG = /* glsl */ `
  uniform sampler2D uAtlas;
  varying vec2 vUv; varying vec3 vPadN; varying float vAge; varying float vYoung; varying float vVar; varying float vOcc; varying float vShell;
  void main() {
    if (texture2D(uAtlas, vUv).a < 0.54) discard;
    gl_FragColor = vec4(normalize(vPadN) * 0.5 + 0.5, 0.89);
  }
`;

// loose leaves: one instance each, colour and size per instance, no growth
const LOOSE_VERT = (nd: boolean) => /* glsl */ `
  attribute vec4 aLoose;   // age, variant, seed, on
  varying vec2 vUv; varying vec3 vN; varying float vAge; varying float vVar;
  void main() {
    vUv = vec2((aLoose.y + uv.x) * 0.25, uv.y);
    vAge = aLoose.x; vVar = aLoose.z;
    vec3 n = normalize(mat3(instanceMatrix) * normal);
    vN = ${nd ? "normalize(normalMatrix * n)" : "normalize(mat3(modelMatrix) * n)"};
    if (aLoose.w < 0.5) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;
const LOOSE_FRAG = /* glsl */ `
  ${LEAF_COLOUR_GLSL}
  uniform sampler2D uAtlas; uniform vec3 uSunDir; uniform float uLight;
  varying vec2 vUv; varying vec3 vN; varying float vAge; varying float vVar;
  void main() {
    vec4 lt = texture2D(uAtlas, vUv);
    if (lt.a < 0.5) discard;
    vec3 c = leafColour(vAge, lt.b * 0.5, 0.0, vVar) * lt.r * 1.38;
    float ndl = abs(dot(normalize(vN), uSunDir)) * 0.6 + 0.4;
    gl_FragColor = vec4(c * (0.6 + 1.6 * ndl) * uLight * 2.0, 1.0);
  }
`;
const LOOSE_ND_FRAG = /* glsl */ `
  uniform sampler2D uAtlas;
  varying vec2 vUv; varying vec3 vN; varying float vAge; varying float vVar;
  void main() { if (texture2D(uAtlas, vUv).a < 0.54) discard; vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n; gl_FragColor = vec4(n * 0.5 + 0.5, 0.89); }
`;

export type TreeState = { doy: number; season: any };

export async function mountTerminalia(stage: HomologousStage, { density = 0.42, onReady }: { density?: number; onReady?: () => void } = {}) {
  const A = await loadTerminalia();
  const meta = A.meta;
  const stride = meta.rosetteStride || 16;

  // ---- shared uniforms (one object, so colour and line passes always agree) ----
  const U = {
    uTime: { value: 0 }, uWind: { value: 0.2 }, uGust: { value: 0.5 },
    uWindDir: { value: new THREE.Vector3(0.8, 0, -0.6).normalize() },
    uTouchO: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, -99, 0, -99)) },
    uTouchD: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 1, 0, 0)) },
    uGrow: { value: 1 }, uYear: { value: 1 }, uTurn: { value: 0 }, uFlushG: { value: 1 },
    uAtlas: { value: A.leafAtlas },
    uSunDir: { value: new THREE.Vector3(0.55, 0.76, 0.35).normalize() },
    uLight: { value: 1 }, uNight: { value: 0 },
  };

  // ---- trunk & buttress roots (real bark), island (003's trim) ----
  const bark = new THREE.MeshStandardMaterial({ name: "TerminaliaBark", map: A.barkColor, normalMap: A.barkNormal, color: 0xb99c82, roughness: 0.92, metalness: 0 });
  const islandMat = new THREE.MeshStandardMaterial({ name: "TaihuIsland", color: 0x8f887b, roughness: 0.94, metalness: 0 });
  islandMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vIsoPos;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvIsoPos = position;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vIsoPos;").replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\n" + ISLAND_TRIM);
  };
  const islandNd = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, uniforms: { uMatA: { value: 0.34 } },
    vertexShader: `varying vec3 vVN; varying vec3 vIsoPos; void main(){ vIsoPos = position; vVN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uMatA; varying vec3 vVN; varying vec3 vIsoPos; void main(){ ${ISLAND_TRIM} gl_FragColor = vec4(normalize(vVN)*0.5+0.5, uMatA); }`,
  });
  const tree = A.tree.clone(true);
  tree.traverse((o) => { if (o.isMesh) { o.material = bark; o.castShadow = true; o.receiveShadow = true; } });
  const island = A.island.clone(true);
  const islandMeshes = new Set();
  island.traverse((o) => { if (o.isMesh) { o.material = islandMat; o.receiveShadow = true; islandMeshes.add(o); } });

  // ---- leaves: V4's instances, year mode ----
  const L = buildLeafInstances(A.rosettes, stride, density);
  const geo = leafGeometry(2, 3, 0.62);
  geo.setAttribute("aRosette", new THREE.InstancedBufferAttribute(L.rosette, 4));
  geo.setAttribute("aLeaf", new THREE.InstancedBufferAttribute(L.leaf, 4));
  geo.setAttribute("aPad", new THREE.InstancedBufferAttribute(L.pad, 4));
  const leafMat = new THREE.ShaderMaterial({ name: "TerminaliaFoliage", side: THREE.DoubleSide, uniforms: U, vertexShader: LEAF_VERT(false), fragmentShader: LEAF_FRAG });
  const leafNd = new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: { ...U, uMatA: { value: 0.89 }, uInflate: { value: 1.75 } }, vertexShader: LEAF_VERT(true), fragmentShader: LEAF_ND_FRAG });
  const leaves = new THREE.InstancedMesh(geo, leafMat, L.count);
  leaves.instanceMatrix.array.set(L.matrices);
  leaves.instanceMatrix.needsUpdate = true;
  leaves.frustumCulled = false;
  leaves.castShadow = false;

  // ---- falling leaves ----
  const N = 220;
  const lgeo = leafGeometry(2, 2, 0.62);
  const aLoose = new Float32Array(N * 4);
  lgeo.setAttribute("aLoose", new THREE.InstancedBufferAttribute(aLoose, 4));
  const looseMat = new THREE.ShaderMaterial({ name: "LooseLeaf", side: THREE.DoubleSide, uniforms: U, vertexShader: LOOSE_VERT(false), fragmentShader: LOOSE_FRAG });
  const looseNd = new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: { uAtlas: U.uAtlas, uMatA: { value: 0.89 } }, vertexShader: LOOSE_VERT(true), fragmentShader: LOOSE_ND_FRAG });
  const loose = new THREE.InstancedMesh(lgeo, looseMat, N);
  loose.frustumCulled = false;
  const P = Array.from({ length: N }, () => ({ on: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), t: 0, s: 0.3, land: 0 }));
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), SV = new THREE.Vector3();
  for (let i = 0; i < N; i++) { M4.makeScale(0, 0, 0); loose.setMatrixAt(i, M4); }
  const rnd = mulberry(7);

  const group = new THREE.Group();
  group.add(island, tree, leaves, loose);
  stage.scene.add(group);
  stage.registerObject(group, {
    customNd: (obj) => obj === leaves ? leafNd : obj === loose ? looseNd : islandMeshes.has(obj) ? islandNd : null,
  });
  // the sun of the tree page: low and from the left, like the photograph beside it
  stage.sun.position.set(-60, 90, 70);
  stage.sun.shadow.camera.left = -22; stage.sun.shadow.camera.right = 22; stage.sun.shadow.camera.top = 22; stage.sun.shadow.camera.bottom = -22;
  stage.sun.shadow.camera.near = 1; stage.sun.shadow.camera.far = 320;
  stage.sun.shadow.camera.updateProjectionMatrix();
  U.uSunDir.value.copy(stage.sun.position).normalize();
  stage.renderer.shadowMap.needsUpdate = true;

  // ---- the year, on springs (never eased across season.js's invisible resets) ----
  const turn = spring(0, { k: 26, c: 10.5 }), flushG = spring(1, { k: 26, c: 10.5 });
  const wind = spring(0.18, { k: 18, c: 8 });
  let season = seasonAt(320), doy = 320, fallAcc = 0, liveFor = 0, touchI = 0;

  function setDay(d: number, immediate = false) {
    doy = ((d % 365) + 365) % 365;
    season = seasonAt(doy);
    const ft = 0.15 + 0.85 * Math.max(0, Math.min(1, season.flush));
    const jumpT = Math.abs(season.turn - turn.t) > 0.45, jumpF = Math.abs(ft - flushG.t) > 0.45;
    turn.t = season.turn; flushG.t = ft;
    if (immediate || jumpT) { turn.x = turn.t; turn.v = 0; }
    if (immediate || jumpF) { flushG.x = flushG.t; flushG.v = 0; }
    stage.wake();
    return season;
  }
  /** a gust (slider speed, a flick): the crown sways and, in a falling season, lets go */
  function gust(k: number) {
    wind.t = clamp(0.18 + k, 0.18, 1.2);
    liveFor = Math.max(liveFor, 2.5 + k * 3);
    stage.setLive(true);
  }
  function release(n: number) {
    const ros = A.rosettes;
    for (let j = 0; j < n; j++) {
      const f = P.find((q) => !q.on);
      if (!f) return;
      for (let tries = 0; tries < 30; tries++) {
        const i = Math.floor(rnd() * (ros.length / stride)) * stride;
        if (ros[i + 9] < 0 || ros[i + 1] < 4) continue;
        f.on = 1; f.land = 0; f.t = 0;
        f.p.set(ros[i], ros[i + 1], ros[i + 2]);
        f.v.set((rnd() - 0.5) * 0.4, -0.2, (rnd() - 0.5) * 0.4);
        f.r.set(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28);
        f.w.set((rnd() - 0.5) * 6, (rnd() - 0.5) * 6, (rnd() - 0.5) * 6);
        f.s = 0.26 + rnd() * 0.14;
        const idx = P.indexOf(f);
        const age = turn.x > 0.05 ? 0.55 + rnd() * 0.5 : 0.08 + rnd() * 0.3;
        aLoose[idx * 4] = age; aLoose[idx * 4 + 1] = Math.floor(rnd() * 4); aLoose[idx * 4 + 2] = rnd(); aLoose[idx * 4 + 3] = 1;
        break;
      }
    }
    lgeo.attributes.aLoose.needsUpdate = true;
  }
  /** pointer through the canopy: leaves part around the ray (jungle-canopy idea, V4's touch code) */
  function touch(ray: THREE.Ray, strength = 1) {
    const i = touchI++ % 4;
    U.uTouchO.value[i].set(ray.origin.x, ray.origin.y, ray.origin.z, U.uTime.value);
    U.uTouchD.value[i].set(ray.direction.x, ray.direction.y, ray.direction.z, clamp(strength, 0, 1.6));
    liveFor = Math.max(liveFor, 3.2);
    stage.setLive(true);
  }

  const groundY = (x: number, z: number) => (Math.hypot(x + 0.5, z) < 5.6 ? 0.12 : -0.82);
  function update(dt: number) {
    let mv = false;
    if (stepS(turn, dt)) mv = true;
    if (stepS(flushG, dt)) mv = true;
    if (stepS(wind, dt)) mv = true;
    U.uTurn.value = turn.x; U.uFlushG.value = flushG.x; U.uWind.value = wind.x;
    if (wind.t > 0.2 && Math.abs(wind.x - wind.t) < 0.05) wind.t = 0.18;
    if (liveFor > 0) {
      liveFor -= dt;
      U.uTime.value += dt;
      U.uGust.value = 0.5 + 0.5 * Math.sin(U.uTime.value * 0.7);
      // leaves that let go on this day, more in a gust
      const leavesOn = turn.x > 0 ? clamp((1.38 - turn.x) / 0.9, 0, 1) : 1;
      const rate = (season.fallRate / 60) * (0.6 + wind.x * 5);
      fallAcc += dt * Math.min(6, rate * 2.5) * (leavesOn > 0.05 ? 1 : 0);
      if (fallAcc > 1) { const n = Math.floor(fallAcc); fallAcc -= n; release(n); }
    }
    let any = false;
    for (let i = 0; i < N; i++) {
      const f = P[i];
      if (!f.on) continue;
      any = true;
      f.t += dt;
      if (!f.land) {
        // flutter: drag-dominated fall, a side-slip that follows the leaf's own tilt, the wind
        f.v.y += (-1.6 - f.v.y * 1.8) * dt;
        f.v.x += (U.uWindDir.value.x * wind.x * 1.2 - f.v.x * 0.8 + Math.sin(f.t * 3 + i) * 0.9) * dt;
        f.v.z += (U.uWindDir.value.z * wind.x * 1.2 - f.v.z * 0.8 + Math.cos(f.t * 2.6 + i) * 0.9) * dt;
        f.p.addScaledVector(f.v, dt);
        f.r.x += f.w.x * dt; f.r.y += f.w.y * dt; f.r.z += f.w.z * dt;
        const gy = groundY(f.p.x, f.p.z);
        if (f.p.y <= gy) { f.p.y = gy + 0.01; f.land = f.t; f.r.x = -Math.PI / 2 + (rnd() - 0.5) * 0.3; f.r.z = 0; }
      } else if (f.t - f.land > 6) {
        f.on = 0; aLoose[i * 4 + 3] = 0; lgeo.attributes.aLoose.needsUpdate = true;
      }
      const fade = f.land ? clamp(1 - (f.t - f.land - 4) / 2, 0, 1) : 1;
      Q.setFromEuler(f.r); SV.setScalar(f.s * fade);
      M4.compose(f.p, Q, SV);
      loose.setMatrixAt(i, M4);
    }
    if (any) { loose.instanceMatrix.needsUpdate = true; mv = true; }
    if (liveFor <= 0 && !any) stage.setLive(false);
    return mv;
  }

  function setNight(on: boolean) { U.uNight.value = on ? 1 : 0; U.uLight.value = on ? 0.75 : 1; stage.wake(); }

  onReady?.();
  return { group, leafCount: L.count, setDay, gust, touch, update, setNight, get season() { return season; }, get doy() { return doy; } };
}
