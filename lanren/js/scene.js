// Assembles the place and owns the render loop's visual state.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { installPCSS } from './pcss.js';
import { createCanopy, createLooseLeaves, UNIFORMS } from './foliage.js';
import {
  createSky, skyState, makeBarkMaterial, makeBarkDepthMaterial, makeStoneMaterial,
  createGround, createBuilding, createPlanting
} from './environment.js';
import { Litter } from './litter.js';

export const TIERS = {
  high: { shadow: 4096, blocker: 16, pcf: 28, density: 1.0, ratio: 2, planting: true },
  medium: { shadow: 4096, blocker: 12, pcf: 18, density: 0.8, ratio: 1.5, planting: true },
  low: { shadow: 2048, blocker: 8, pcf: 12, density: 0.55, ratio: 1.25, planting: false }
};

export function pickTier() {
  const q = new URLSearchParams(location.search).get('quality');
  if (q && TIERS[q]) return q;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 700;
  const cores = navigator.hardwareConcurrency || 4;
  if (coarse && small) return cores >= 8 ? 'medium' : 'low';
  return cores >= 6 ? 'high' : 'medium';
}

const SHADOW_HALF = 21;
const SHADOW_FAR = 120;

export async function buildScene(canvas, tierName, onProgress = () => {}) {
  const tier = TIERS[tierName];
  installPCSS({ frustumWidth: SHADOW_HALF * 2, depthRange: SHADOW_FAR - 1, blocker: tier.blocker, pcf: tier.pcf });

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.ratio));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.08, 900);
  scene.fog = new THREE.FogExp2(0xb8c4c8, 0.0095);

  // ---------------------------------------------------------------- assets
  const base = new URL('../assets/', import.meta.url);
  const texLoader = new THREE.TextureLoader();
  let done = 0;
  const total = 9;
  const tick = (x) => { done++; onProgress(done / total); return x; };
  const tex = (name, srgb) => texLoader.loadAsync(new URL(name, base).href).then((t) => {
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tick(t);
  });
  const gltf = new GLTFLoader();
  gltf.setMeshoptDecoder(MeshoptDecoder);
  const bin = (name) => fetch(new URL(name, base)).then((r) => { if (!r.ok) throw new Error(name); return r.arrayBuffer(); }).then(tick);
  const [treeG, stonesG, rosBuf, fruitBuf, meta, atlas, leafN, barkColor, barkNormal, pavingColor, pavingNormal] = await Promise.all([
    gltf.loadAsync(new URL('tree.glb', base).href).then(tick),
    gltf.loadAsync(new URL('stones.glb', base).href).then(tick),
    bin('rosettes.bin'), bin('fruits.bin'),
    fetch(new URL('tree.json', base)).then((r) => r.json()),
    tex('leaf-atlas-web.png', false), tex('leaf-normal-web.png', false),
    tex('bark-color.jpg', true), tex('bark-normal.jpg', false),
    tex('paving-color.jpg', true), tex('paving-normal.jpg', false)
  ]);
  for (const t of [barkColor, barkNormal]) t.wrapS = t.wrapT = THREE.RepeatWrapping;

  // ---------------------------------------------------------------- sky & light
  const sky = createSky();
  scene.add(sky);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(tier.shadow, tier.shadow);
  Object.assign(sun.shadow.camera, { left: -SHADOW_HALF, right: SHADOW_HALF, top: SHADOW_HALF, bottom: -SHADOW_HALF, near: 1, far: SHADOW_FAR });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.018;
  const sunTarget = new THREE.Object3D();
  sunTarget.position.set(3.5, 3, 0);
  scene.add(sunTarget);
  sun.target = sunTarget;
  scene.add(sun);
  // light spilling from lit classrooms at night, from the facade side
  const spill = new THREE.DirectionalLight(0xffc98f, 0);
  spill.position.set(4, 6, 30);
  spill.target = sunTarget;
  scene.add(spill);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(sky.geometry, sky.material);   // shares uniforms
  envSky.frustumCulled = false;
  envScene.add(envSky);
  let envRT = null;

  // ---------------------------------------------------------------- tree
  const barkMat = makeBarkMaterial({ barkColor, barkNormal });
  const barkDepth = makeBarkDepthMaterial();
  let bark = null;
  treeG.scene.traverse((o) => { if (o.isMesh) bark = o; });
  bark.material = barkMat;
  bark.customDepthMaterial = barkDepth;
  bark.castShadow = true;
  bark.receiveShadow = true;
  bark.frustumCulled = false;
  scene.add(bark);

  const stoneMat = makeStoneMaterial();
  const stones = [];
  stonesG.scene.traverse((o) => {
    if (o.isMesh) { o.material = stoneMat; o.castShadow = true; o.receiveShadow = true; stones.push(o); }
  });
  scene.add(stonesG.scene);

  const rosettes = new Float32Array(rosBuf);
  const stride = meta.rosetteStride;
  const canopy = createCanopy(rosettes, stride, atlas, leafN, tier.density);
  scene.add(canopy.mesh);

  // fruits: small instanced drupes, visible in season
  const fruitArr = new Float32Array(fruitBuf);
  const fruitGeo = new THREE.SphereGeometry(1, 10, 8);
  fruitGeo.scale(0.019, 0.03, 0.014);
  const fruitMat = new THREE.MeshStandardMaterial({ color: 0x55702a, roughness: 0.45 });
  const fruits = new THREE.InstancedMesh(fruitGeo, fruitMat, fruitArr.length / 4);
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < fruits.count; i++) {
      q.setFromEuler(new THREE.Euler(0.3 * Math.sin(i), i, 0.4 * Math.cos(i * 1.7)));
      m.compose(new THREE.Vector3(fruitArr[i * 4], fruitArr[i * 4 + 1], fruitArr[i * 4 + 2]), q, new THREE.Vector3(1, 1, 1));
      fruits.setMatrixAt(i, m);
    }
    fruits.castShadow = true;
    fruits.receiveShadow = true;
  }
  scene.add(fruits);

  // ---------------------------------------------------------------- place
  const ground = createGround({ pavingColor, pavingNormal }, Math.min(8, renderer.capabilities.getMaxAnisotropy()));
  scene.add(ground.group);
  const building = createBuilding();
  scene.add(building.group);
  scene.add(createPlanting(atlas, tier.planting ? 1 : 0.5));

  // ---------------------------------------------------------------- campus trees (impostors)
  // The campus around the terrace is planted densely. Rather than inventing
  // other species, we render this tree off-screen from two sides and stand
  // those images around the plaza as distant, fogged trees. They are
  // re-baked whenever the light changes, so they share the hour.
  const IMP_LAYER = 3;
  bark.layers.enable(IMP_LAYER);
  canopy.mesh.layers.enable(IMP_LAYER);
  sun.layers.enable(IMP_LAYER);
  spill.layers.enable(IMP_LAYER);
  const impRT = new THREE.WebGLRenderTarget(1024, 512, { samples: 4 });
  impRT.texture.colorSpace = THREE.LinearSRGBColorSpace;
  const impCam = new THREE.OrthographicCamera(-15.5, 15.5, 15.5, 0, 0.1, 100);
  impCam.layers.set(IMP_LAYER);
  function bakeImpostor() {
    const prevT = renderer.getRenderTarget();
    const prevC = renderer.getClearColor(new THREE.Color());
    const prevA = renderer.getClearAlpha();
    const prevFog = scene.fog;
    scene.fog = null;
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(impRT);
    renderer.clear();
    // two views side by side: from the north and from the west
    for (const [i, pos, look] of [[0, [3, 0, -40], [3, 0, 0]], [1, [-40, 0, 0], [0, 0, 0]]]) {
      impCam.position.set(...pos);
      impCam.lookAt(...look);
      impCam.updateMatrixWorld();
      impRT.viewport.set(i * 512, 0, 512, 512);
      impRT.scissor.set(i * 512, 0, 512, 512);
      impRT.scissorTest = true;
      renderer.setRenderTarget(impRT);
      renderer.render(scene, impCam);
    }
    impRT.scissorTest = false;
    impRT.viewport.set(0, 0, 1024, 512);
    renderer.setRenderTarget(prevT);
    renderer.setClearColor(prevC, prevA);
    scene.fog = prevFog;
  }
  const impMat = new THREE.MeshBasicMaterial({ map: impRT.texture, alphaTest: 0.5, side: THREE.DoubleSide });
  impMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  diffuseColor.rgb *= 0.92;`);
  };
  const impostors = new THREE.Group();
  const PLACES = [
    // x, z, scale, view (0 north / 1 west), mirror
    [-34, -16, 0.72, 0, 1], [-52, -24, 0.9, 1, -1], [-22, -34, 0.62, 1, 1], [26, -30, 0.8, 0, -1],
    [44, -14, 0.95, 1, 1], [58, -36, 0.7, 0, 1], [-70, -12, 0.85, 0, -1], [6, -58, 0.9, 1, 1],
    [-40, -60, 1.0, 0, 1], [36, 4, 0.66, 1, -1], [70, 0, 0.9, 0, 1], [-14, -80, 1.1, 1, -1]
  ];
  for (const [x, z, k, view, mirror] of PLACES) {
    const g = new THREE.PlaneGeometry(31, 15.5);
    g.translate(0, 7.75, 0);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, (view + uv.getX(i)) * 0.5);
    const m = new THREE.Mesh(g, impMat);
    m.position.set(x, z < -11 ? -0.6 : 0, z);
    m.scale.set(k * mirror, k, k);
    m.userData.billboard = true;
    impostors.add(m);
  }
  scene.add(impostors);
  function faceImpostors(cam) {
    for (const m of impostors.children) m.rotation.y = Math.atan2(cam.position.x - m.position.x, cam.position.z - m.position.z);
  }

  const loose = createLooseLeaves(1500, atlas, leafN);
  scene.add(loose.mesh);
  const litter = new Litter(loose, rosettes, stride, 1500);

  // ---------------------------------------------------------------- state
  let needsBake = true;
  const state = { sunVec: new THREE.Vector3(0, 1, 0), alt: 1, envAlt: 99, envAz: 99, night: 0 };

  function setSun(vec, altRad) {
    state.sunVec.set(vec[0], vec[1], vec[2]).normalize();
    state.alt = altRad;
    const sk = skyState(altRad);
    const u = sky.material.uniforms;
    u.uSun.value.copy(state.sunVec);
    u.uAlt.value = Math.sin(altRad);
    u.uZenith.value.setRGB(...sk.zenith);
    u.uHorizon.value.setRGB(...sk.horizon);
    u.uGlow.value.setRGB(...sk.glow);
    u.uNight.value = sk.night;
    state.night = sk.night;
    const deg = sk.deg;
    const day = THREE.MathUtils.smoothstep(deg, -3, 10);
    if (deg > -4) {
      sun.position.copy(sunTarget.position).addScaledVector(state.sunVec, 60);
      const warm = THREE.MathUtils.smoothstep(deg, 0, 35);
      sun.color.setRGB(1.0, 0.62 + 0.34 * warm, 0.38 + 0.52 * warm);
      sun.intensity = 3.4 * day;
    } else {
      // moonlight-like key from high in the south-east, cool and dim
      sun.position.copy(sunTarget.position).add(new THREE.Vector3(18, 40, 22));
      sun.color.setRGB(0.55, 0.65, 0.95);
      sun.intensity = 0.16 * sk.night;
    }
    spill.intensity = 0.55 * sk.night * study;
    building.night.value = sk.night * study;
    scene.fog.color.setRGB(...sk.horizon.map((v) => Math.min(1, v * 0.95)));
    scene.environmentIntensity = 0.55 + 0.45 * day;
    renderer.toneMappingExposure = 1.0 + 0.9 * sk.night;
    // rebuild image-based light when the sky changed noticeably
    if (Math.abs(deg - state.envAlt) > 1.5 || Math.abs(state.sunVec.x - state.envAz) > 0.08) {
      state.envAlt = deg; state.envAz = state.sunVec.x;
      if (envRT) envRT.dispose();
      envRT = pmrem.fromScene(envScene, 0, 1, 1000);
      scene.environment = envRT.texture;
      needsBake = true;
    }
  }

  // Evening self-study is common in Chinese senior high schools; the lit
  // hours here (weekdays 18:40-22:20, school months) are an assumption,
  // not the school's timetable.
  let study = 1;
  function setStudyLights(parts) {
    const h = parts.minutes / 60;
    const term = !(parts.month === 7 || parts.month === 8 || (parts.month === 2 && parts.day < 15));
    const weekday = parts.weekday >= 1 && parts.weekday <= 5 || parts.weekday === 0;  // Sunday evening study too
    study = term && weekday && h > 18.66 && h < 22.33 ? 1 : 0.05;
    building.night.value = state.night * study;
    spill.intensity = 0.55 * state.night * study;
  }

  function setSeason(s) {
    UNIFORMS.uTurn.value = s.turn;
    UNIFORMS.uFlush.value = s.flush;
    UNIFORMS.uSummer.value = s.summer;
    fruits.visible = s.fruit > 0.05;
    const ripe = s.ripe;
    // green drupes ripening to yellow-brown, then a dull purplish red
    const c0 = [0.10, 0.17, 0.035], c1 = [0.42, 0.30, 0.06], c2 = [0.24, 0.06, 0.04];
    const k = Math.min(1, ripe * 1.6), k2 = Math.max(0, ripe - 0.6) / 0.4;
    const c = c0.map((v, i) => (v + (c1[i] - v) * k) * (1 - k2) + c2[i] * k2);
    fruitMat.color.setRGB(c[0], c[1], c[2]);
    // hide a share of fruits according to the season amount
    const n = fruitArr.length / 4;
    fruits.count = Math.round(n * 0.45 * Math.min(1, s.fruit));
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 64 : 52;
    camera.updateProjectionMatrix();
  }

  function beforeRender() {
    if (needsBake) { bakeImpostor(); needsBake = false; }
    faceImpostors(camera);
  }

  return {
    beforeRender,
    setStudyLights,
    renderer, scene, camera, sky, sun, canopy, bark, stones, building, litter, meta, rosettes, stride, ground: ground.ground,
    atlas, setSun, setSeason, resize, state, tier
  };
}
