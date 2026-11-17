// The remembered world: chapter 06 as the homepage shows it, in the walk's frame, on layer 1.
//
//   tree, crown, islet   V4's own materials (lanren/js/environment.js, foliage.js): bark textures,
//                        51 000 leaves in full summer leaf, granite, 太湖石 and the plinth
//   buildings            the same Blender V3 geometry the painted world wears, in its own materials
//   planting, ground     the painted world's own meshes in a quieter, more photographic variant
//                        (soft light, no painted shade colour, desaturated) under 06's light
//   sky, light           06's art-directed day (chapters.js LIGHT[5]), not today's: the memory
//                        keeps its eternal summer noon; the painting brings today in
// Every material reads the paint field and discards itself where the painting has arrived.
import * as THREE from 'three';
import { makeBarkMaterial, makeIslandMaterial, createSky, createGrass } from '../js/environment.js';
import { createCanopy, UNIFORMS } from '../js/foliage.js';
import { celLike, U } from '../stroll/atmos.js';
import { sideOf } from './paintfield.js';
import { v4Group, LIGHT6, sun6Dir } from './v4.js';

const c3 = (a, k = 1) => new THREE.Color(a[0] * k, a[1] * k, a[2] * k);

/** chapter 06's light, in the walk's cel parameters (for the quieter twins of painted meshes) */
function realUniforms(sunDir) {
  const L = LIGHT6;
  return {
    uSunDir: { value: sunDir.clone() }, uSunColor: { value: c3(L.sunCol, 1.95) }, uSkyAmb: { value: new THREE.Color(0.55, 0.65, 1.0) },
    uGroundAmb: { value: new THREE.Color(0.42, 0.42, 0.44) }, uZenith: { value: c3(L.zenith, 1.6) }, uHorizon: { value: c3(L.horizon, 1.2) },
    uSunGlow: { value: c3(L.glow) }, uRim: { value: new THREE.Color(0.6, 0.58, 0.55) }, uDepthCol: { value: new THREE.Color(0.92, 0.96, 1.04) },
    uDepthTint: { value: 0.3 }, uAirScale: { value: 1 / 900 }, uMist: { value: 0 }, uShadeHue: { value: new THREE.Color(0.7, 0.72, 0.8) }, uShadeMix: { value: 0.04 },
    uCloudShadow: { value: 0.15 }, uWet: { value: 0 }, uPuddle: { value: 0 }, uRain: { value: 0 }, uNight: { value: 0 }, uLamps: { value: 0 },
  };
}
const REALISM = /* glsl */`
{
  float l = dot(outCol, vec3(0.3, 0.59, 0.11));
  outCol = mix(vec3(l), outCol, 0.72) * 0.92;
}
`;

export function createRealWorld({ world, v4, tier, LAYER = 1 }) {
  const group = new THREE.Group();
  group.name = 'remembered-world';
  const dir = sun6Dir();
  // ---- light (layer 1 only)
  const sun = new THREE.DirectionalLight(c3(LIGHT6.sunCol), LIGHT6.I);
  sun.castShadow = true;
  sun.shadow.mapSize.set(tier.shadow, tier.shadow);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 2;
  const target = new THREE.Object3D();
  sun.target = target;
  const hemi = new THREE.HemisphereLight(c3(LIGHT6.zenith, 2.2), new THREE.Color(0.05, 0.05, 0.04), 0.6);
  const sky = createSky();
  const su = sky.material.uniforms;
  su.uSun.value.copy(dir); su.uZenith.value.copy(c3(LIGHT6.zenith)); su.uHorizon.value.copy(c3(LIGHT6.horizon)); su.uGlow.value.copy(c3(LIGHT6.glow));
  su.uSunCol.value.copy(c3(LIGHT6.sunCol)); su.uCloud.value = LIGHT6.cloud;
  sky.scale.setScalar(8);
  group.add(sun, target, hemi, sky);
  // ---- the tree, its crown and its islet
  const tree = v4Group('remembered-tree');
  const bark = new THREE.Mesh(v4.bark.geometry, sideOf(makeBarkMaterial({ barkColor: v4.barkColor, barkNormal: v4.barkNormal }), 'real'));
  bark.customDepthMaterial = makeBarkMaterial({}, true);
  bark.castShadow = bark.receiveShadow = true; bark.frustumCulled = false;
  const canopy = createCanopy(v4.rosettes, v4.stride, v4.atlas, v4.leafN, tier.leafDensity, [2, 2]);
  sideOf(canopy.mesh.material, 'real');
  let inscr = null;
  const pl = v4.meta.anchors.plinth;
  if (pl) {
    const n = new THREE.Vector3(Math.sin(pl.yaw), 0, Math.cos(pl.yaw));
    const tg = new THREE.Vector3(Math.cos(pl.yaw), 0, -Math.sin(pl.yaw));
    inscr = { centre: new THREE.Vector3(...pl.centre).addScaledVector(n, pl.size[1] / 2).toArray(), normal: n.toArray(), tangent: tg.toArray(), size: [1.7, 0.3] };
  }
  const islet = new THREE.Mesh(v4.island.geometry, sideOf(makeIslandMaterial(inscr), 'real'));
  islet.castShadow = islet.receiveShadow = true;
  const grass = createGrass(v4.heightV4, tier.isletGrass, (x, z) => v4.heightV4(x, z) > v4.water + 0.25 && v4.rockV4(x, z) < 0.35);
  sideOf(grass.material, 'real');
  tree.add(bark, canopy.mesh, islet, grass);
  group.add(tree);
  UNIFORMS.uGrow.value = 1;

  // ---- quieter twins of the painted world's own meshes (same geometry, same instances, same wind)
  const ru = realUniforms(dir);
  const cache = new Map();
  const realOf = (m) => {
    if (!m?.userData?.celOpts) return null;
    if (!cache.has(m)) cache.set(m, sideOf(celLike(m, { key: 'remembered', soft: Math.max(m.userData.celOpts.soft ?? 0, 0.45), uniforms: ru, fragment: { after: REALISM } }), 'real'));
    return cache.get(m);
  };
  const twins = [];
  const twinOf = (src) => {
    src.updateMatrixWorld(true);
    src.traverse((o) => {
      if (!o.isMesh || !realOf(o.material)) return;
      let t;
      if (o.isInstancedMesh) {
        t = new THREE.InstancedMesh(o.geometry, realOf(o.material), o.count);
        t.instanceMatrix = o.instanceMatrix; t.instanceColor = o.instanceColor;
      } else t = new THREE.Mesh(o.geometry, realOf(o.material));
      t.matrixAutoUpdate = false; t.matrix.copy(o.matrixWorld); t.matrixWorld.copy(o.matrixWorld);
      t.frustumCulled = o.frustumCulled; t.castShadow = o.castShadow; t.receiveShadow = o.receiveShadow;
      if (o.customDepthMaterial) t.customDepthMaterial = o.customDepthMaterial;
      t.name = 'remembered:' + o.name;
      twins.push(t);
      group.add(t);
    });
  };
  twinOf(world.flora.group); twinOf(world.horizon); twinOf(world.ground.mesh); twinOf(world.grass.group);

  // ---- the buildings: the Blender materials, under 06's sun
  let campus = null;
  function addCampus(raw) {
    const seen = new Set();
    raw.traverse((o) => {
      if (!o.isMesh) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) if (!seen.has(m)) { seen.add(m); sideOf(m, 'real'); m.envMapIntensity = 0.7; }
      o.castShadow = true; o.receiveShadow = true;
    });
    campus = raw;
    group.add(raw);
    raw.traverse((o) => o.layers.set(LAYER));
  }
  group.traverse((o) => o.layers.set(LAYER));

  // image-based light from 06's sky for the PBR materials (tree, islet, buildings)
  let env = null;
  function bakeEnv(renderer, scene) {
    const pm = new THREE.PMREMGenerator(renderer);
    const es = new THREE.Scene();
    const s2 = new THREE.Mesh(sky.geometry, sky.material);
    s2.frustumCulled = false; es.add(s2);
    env?.dispose();
    env = pm.fromScene(es, 0, 1, 1000);
    scene.environment = env.texture;
    pm.dispose();
  }
  const exposure = LIGHT6.exposure;
  return {
    group, sun, sky, tree, bark, canopy, islet, grass, twins, addCampus, bakeEnv, exposure,
    get campus() { return campus; },
    /** keep the shadow box round the eye */
    update(t, focus) {
      sky.material.uniforms.uTimeS.value = t;
      target.position.set(focus.x, focus.y, focus.z);
      sun.position.copy(target.position).addScaledVector(dir, 120);
      target.updateMatrixWorld();
    },
    dispose(scene) {
      scene.remove(group);
      if (scene.environment === env?.texture) scene.environment = null;
      env?.dispose();
    },
  };
}
