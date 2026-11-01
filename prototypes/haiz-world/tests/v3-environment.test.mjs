import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = new URL('../public/haiz/', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');
const threeSource = read('assets/vendor/three.min.js');
const skySource = read('assets/vendor/Sky.js');
const climateSource = read('assets/walk/climate.js');
const environmentSource = read('world/v3/environment.js');
const close = (actual, expected, epsilon = 1e-10) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);

function fixture(options = {}) {
  const sandbox = vm.createContext({ console });
  sandbox.window = sandbox;
  vm.runInContext(threeSource, sandbox);
  vm.runInContext(skySource, sandbox);
  vm.runInContext(environmentSource, sandbox, { filename: fileURLToPath(new URL('world/v3/environment.js', root)) });
  const T = sandbox.THREE;
  const scene = new T.Scene();
  scene.fog = new T.Fog('#d0d8c7', 160, 520);
  scene.background = new T.Color('#c5d8d5');
  const camera = new T.PerspectiveCamera(68, 1, .08, 1600);
  camera.position.set(13, 1.85, -172);
  const sky = new T.Sky();
  const sun = new T.DirectionalLight('#fff0d5', 1.7);
  sun.position.set(-85, 110, -65);
  const hemiLight = new T.HemisphereLight('#d8e8ee', '#8b8a70', .82);
  const ambientLight = new T.AmbientLight('#fff3da', .28);
  scene.add(sky, sun, sun.target, hemiLight, ambientLight);
  const renderer = { physicallyCorrectLights: false, outputEncoding: T.sRGBEncoding,
    toneMapping: T.ACESFilmicToneMapping, toneMappingExposure: 1.15,
    shadowMap: { enabled: true, type: T.PCFSoftShadowMap, needsUpdate: false } };
  const world = {};
  const env = sandbox.HaizV3Environment.create({ scene, renderer, camera, sky, sun, hemiLight, ambientLight, world, ...options });
  return { sandbox, T, scene, renderer, camera, sky, sun, hemiLight, ambientLight, world, env };
}

function snapshot(f) {
  return { sun: f.sun.color.toArray(), power: f.sun.intensity, position: f.sun.position.toArray(),
    target: f.sun.target.position.toArray(), hemi: f.hemiLight.color.toArray(), ground: f.hemiLight.groundColor.toArray(),
    hemiPower: f.hemiLight.intensity, ambient: f.ambientLight.color.toArray(), ambientPower: f.ambientLight.intensity,
    fog: f.scene.fog.color.toArray(), near: f.scene.fog.near, far: f.scene.fog.far,
    exposure: f.renderer.toneMappingExposure, sky: f.sky.material.uniforms.sunPosition.value.toArray(),
    rayleigh: f.sky.material.uniforms.rayleigh.value };
}

function settle(f, seconds = 4) {
  for (let i = 0; i < seconds * 60; i++) f.env.tick(1 / 60, false, 'walk');
}

test('provides the global API with restrained neutral morning lighting in r128', () => {
  const f = fixture();
  assert.equal(f.T.REVISION, '128');
  for (const key of ['setTime', 'tick', 'setQuality', 'diagnostics', 'dispose']) assert.equal(typeof f.env[key], 'function');
  assert.equal(f.env.time, 'morning');
  assert.equal(f.env.diagnostics().transitioning, 0);
  close(f.sun.intensity, 1.5); close(f.hemiLight.intensity, .65); close(f.ambientLight.intensity, .08);
  close(f.renderer.toneMappingExposure, 1);
  assert.ok(f.sun.color.r / f.sun.color.b < 1.2, 'cream walls retain a neutral daylight key');
  assert.ok(f.hemiLight.color.b > f.hemiLight.color.r, 'sky fill cools the shadows');
  assert.equal(f.renderer.physicallyCorrectLights, false);
  assert.equal(f.renderer.outputEncoding, f.T.sRGBEncoding);
  assert.equal(f.renderer.toneMapping, f.T.ACESFilmicToneMapping);
});

test('instant presets synchronize sunlight, sky and fog without replacing existing scene objects', () => {
  const f = fixture();
  const fog = f.scene.fog, background = f.scene.background;
  const morningDirection = f.sky.material.uniforms.sunPosition.value.clone().normalize();
  f.env.setTime('golden', true);
  const goldenDirection = f.sun.position.clone().sub(f.sun.target.position).normalize();
  assert.ok(goldenDirection.y > 0 && goldenDirection.y < morningDirection.y / 2);
  assert.ok(f.sun.color.r / f.sun.color.b > 1.5);
  close(goldenDirection.distanceTo(f.sky.material.uniforms.sunPosition.value.clone().normalize()), 0);
  f.env.setTime('dusk', true);
  assert.equal(f.env.time, 'dusk');
  assert.ok(f.sun.intensity < .2);
  assert.ok(f.hemiLight.color.b > f.hemiLight.color.r);
  assert.ok(f.scene.fog.color.b > f.scene.fog.color.r);
  assert.equal(f.scene.fog, fog); assert.equal(f.scene.background, background);
  assert.ok(f.scene.background.equals(f.scene.fog.color));
  assert.equal(f.env.tick(0, false, 'walk').transitioning, 0);
});

test('owns all shared values after a real legacy climate tick including a settled preset', () => {
  const f = fixture();
  f.sandbox.document = { createElement: () => ({ getContext: () => ({
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
  }) }) };
  vm.runInContext(climateSource, f.sandbox);
  const climate = f.sandbox.CampusClimate.create(f.scene, f.sky, f.sun, f.hemiLight, f.ambientLight, f.world, false, { camera: f.camera });
  f.env.setTime('golden', true);
  const expected = snapshot(f);
  for (let i = 0; i < 4; i++) {
    f.renderer.toneMappingExposure = climate.tick(.1, false);
    f.hemiLight.color.set('red'); f.hemiLight.groundColor.set('red'); f.ambientLight.color.set('red');
    f.env.tick(.1, false, 'walk');
    assert.deepEqual(snapshot(f), expected);
    assert.equal(f.env.diagnostics().transitioning, 0);
  }
});

test('transitions continuously and settles exactly, independently of frame rate', () => {
  const a = fixture(), b = fixture();
  const before = snapshot(a);
  a.env.setTime('golden'); b.env.setTime('golden');
  assert.deepEqual(snapshot(a), before);
  assert.equal(a.env.diagnostics().transitioning, 1);
  for (let i = 0; i < 60; i++) a.env.tick(1 / 60, false, 'walk');
  for (let i = 0; i < 30; i++) b.env.tick(1 / 30, false, 'walk');
  close(a.sun.intensity, b.sun.intensity);
  close(a.sun.position.distanceTo(b.sun.position), 0);
  assert.notDeepEqual(snapshot(a), before);
  const middle = snapshot(a);
  a.env.setTime('dusk');
  assert.deepEqual(snapshot(a), middle, 'interrupting a transition does not jump');
  settle(a);
  assert.equal(a.env.diagnostics().transitioning, 0);
  const expected = snapshot(a);
  a.env.setTime('dusk', true);
  assert.deepEqual(snapshot(a), expected, 'settled state reaches the exact preset');
});

test('reduced motion applies presets immediately and invalid deltas never advance a transition', () => {
  const reduced = fixture({ reduced: true });
  reduced.env.setTime('dusk');
  assert.equal(reduced.env.diagnostics().transitioning, 0);
  assert.ok(reduced.sun.intensity < .2);
  const f = fixture();
  f.env.setTime('golden');
  const before = snapshot(f);
  for (const dt of [NaN, Infinity, -1, undefined]) {
    assert.equal(f.env.tick(dt, false, 'walk').transitioning, 1);
    assert.deepEqual(snapshot(f), before);
  }
  f.env.tick(1000, false, 'walk');
  assert.equal(f.env.diagnostics().transitioning, 0);
});

test('shadow target follows snapped camera XZ and the walking floor with a 120 m sun offset', () => {
  const f = fixture();
  assert.deepEqual(Array.from(f.sun.target.position.toArray()), [12, 0, -172]);
  close(f.sun.position.distanceTo(f.sun.target.position), 120);
  assert.equal(f.sun.shadow.camera.far, 350);
  const target = f.sun.target.position.clone();
  f.camera.position.x = 13.9;
  f.env.tick(.1, false, 'walk');
  assert.ok(f.sun.target.position.equals(target));
  f.camera.position.set(14.1, 7.85, -166.1);
  f.env.tick(.1, true, 'walk');
  close(f.sun.target.position.x, 16); close(f.sun.target.position.z, -168); close(f.sun.target.position.y, 6);
  close(f.sun.position.distanceTo(f.sun.target.position), 120);
  close(f.sun.target.matrixWorld.elements[13], 6);
  f.camera.position.y = 100;
  f.env.tick(.1, false, 'overview');
  assert.deepEqual(Array.from(f.sun.target.position.toArray()), [0, 0, 20]);
  assert.equal(f.sun.shadow.camera.right, 190);
  f.env.setQuality('high');
  assert.equal(f.sun.shadow.camera.right, 190, 'quality changes preserve the overview shadow coverage');
  f.env.tick(.1, false, 'walk');
  close(f.sun.target.position.x, 16); close(f.sun.target.position.z, -168);
  assert.equal(f.sun.shadow.camera.right, 58);
});

test('settled ticks do not rewrite sun vectors or color or update the shadow target matrix', () => {
  const f = fixture();
  let writes = 0;
  for (const [object, key] of [[f.sun.position, 'set'], [f.sun.color, 'copy'],
    [f.sun.target.position, 'set'], [f.sun.target, 'updateMatrixWorld']]) {
    const original = object[key];
    object[key] = function (...args) { writes++; return original.apply(this, args); };
  }
  for (let i = 0; i < 120; i++) f.env.tick(1 / 60, false, 'walk');
  assert.equal(writes, 0);
});

test('applies coherent overview and walk fog distances and restrained indoor exposure', () => {
  const f = fixture();
  f.env.tick(.1, false, 'overview');
  assert.equal(f.scene.fog.near, 350); assert.equal(f.scene.fog.far, 1200);
  f.env.tick(.1, true, 'walk');
  assert.equal(f.scene.fog.near, 170); assert.equal(f.scene.fog.far, 600);
  assert.ok(f.renderer.toneMappingExposure > 1 && f.renderer.toneMappingExposure < 1.15);
  f.env.tick(.1, false, 'walk');
  close(f.renderer.toneMappingExposure, 1);
});

test('only tagged window materials and an optional explicit lamp collection receive subtle dusk emission', () => {
  const f = fixture();
  const windowMaterial = new f.T.MeshStandardMaterial({ emissiveIntensity: .7 });
  windowMaterial.userData.v3WindowGlow = true;
  const untouched = new f.T.MeshStandardMaterial({ emissive: '#ffffff', emissiveIntensity: .4 });
  const lamp = new f.T.MeshStandardMaterial({ emissive: '#ffddaa', emissiveIntensity: .9 });
  const geometry = new f.T.BoxGeometry();
  f.scene.add(new f.T.Mesh(geometry, [windowMaterial, untouched]), new f.T.Mesh(geometry, windowMaterial));
  f.world.lampLamps = [new f.T.Mesh(geometry, lamp), lamp];
  f.env.setTime('dusk', true);
  close(windowMaterial.emissiveIntensity, .18); close(lamp.emissiveIntensity, .18);
  assert.ok(windowMaterial.emissive.r > windowMaterial.emissive.b && windowMaterial.emissive.b > 0);
  close(untouched.emissiveIntensity, .4);
  assert.equal(f.env.diagnostics().glowMaterials, 2);
  f.env.setTime('morning', true);
  close(windowMaterial.emissiveIntensity, 0); close(lamp.emissiveIntensity, 0);
  f.env.dispose();
  close(windowMaterial.emissiveIntensity, .7); close(lamp.emissiveIntensity, .9);
  assert.equal(windowMaterial.emissive.getHex(), 0);
});

test('quality controls only the existing shadow pass and resizes its map only when necessary', () => {
  const f = fixture();
  let disposals = 0;
  f.sun.shadow.map = { dispose() { disposals++; } };
  assert.equal(f.env.setQuality('high'), true);
  assert.equal(f.sun.shadow.mapSize.x, 2048);
  assert.ok(f.sun.shadow.camera.right >= 55 && f.sun.shadow.camera.right <= 68);
  assert.equal(disposals, 1);
  f.env.setQuality('high');
  assert.equal(disposals, 1);
  f.env.setQuality('low');
  assert.equal(f.renderer.shadowMap.enabled, false); assert.equal(f.sun.castShadow, false);
  f.env.setQuality('balanced');
  assert.equal(f.sun.shadow.mapSize.x, 1024); assert.equal(f.sun.castShadow, true);
  assert.equal(f.env.diagnostics().quality, 'balanced');
  assert.equal(f.renderer.physicallyCorrectLights, false);
});

test('rejects unknown preset and quality names without changing state', () => {
  const f = fixture();
  for (const value of ['afterrain', '__proto__', 'constructor', 'toString', '', null, {}, 1]) assert.equal(f.env.setTime(value), false);
  for (const value of ['ultra', '__proto__', 'constructor', null, {}]) assert.equal(f.env.setQuality(value), false);
  assert.equal(f.env.time, 'morning');
  const diagnostics = f.env.diagnostics();
  diagnostics.transitioning = 99;
  assert.equal(f.env.diagnostics().transitioning, 0);
});

test('supports the legacy gradient sky fallback and a scene without fog or optional world data', () => {
  const f = fixture();
  f.env.dispose();
  const top = new f.T.Color(), bottom = new f.T.Color();
  const sky = { material: { uniforms: { top: { value: top }, bottom: { value: bottom } } } };
  f.scene.fog = null;
  const background = new f.T.Texture();
  f.scene.background = background;
  const env = f.sandbox.HaizV3Environment.create({ ...f, sky, world: undefined });
  env.setTime('dusk', true);
  env.tick(0, false, 'walk');
  assert.ok(top.b > top.r); assert.ok(bottom.b > bottom.r);
  assert.equal(f.scene.fog, null); assert.equal(f.scene.background, background);
  env.dispose();
});

test('dispose is idempotent, releases ownership, and restores existing renderer and light values', () => {
  const f = fixture();
  f.env.setTime('dusk', true); f.env.setQuality('high');
  const geometry = f.sky.geometry, material = f.sky.material;
  let disposals = 0;
  geometry.addEventListener('dispose', () => { disposals++; });
  material.addEventListener('dispose', () => { disposals++; });
  f.env.dispose();
  close(f.sun.intensity, 1.7); close(f.hemiLight.intensity, .82); close(f.ambientLight.intensity, .28);
  close(f.renderer.toneMappingExposure, 1.15);
  assert.equal(f.scene.fog.near, 160); assert.equal(f.scene.fog.far, 520);
  assert.equal(f.sun.shadow.camera.far, 500);
  assert.equal(disposals, 0, 'shared sky geometry and material belong to the runtime');
  const before = snapshot(f);
  f.env.dispose();
  assert.equal(f.env.setTime('morning'), false); assert.equal(f.env.setQuality('balanced'), false);
  assert.equal(f.env.tick(1, true, 'overview').transitioning, 0);
  assert.deepEqual(snapshot(f), before);
});
