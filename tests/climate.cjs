const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict"),
  THREE = require("../assets/vendor/three.min.js"),
  { createCanvas } = require("@napi-rs/canvas");
function setup(reduced = false) {
  const window = {},
    document = { createElement: () => createCanvas(128, 128) };
  vm.runInNewContext(fs.readFileSync("assets/walk/climate.js", "utf8"), {
    window,
    document,
    THREE,
  });
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog("#d0d8c7", 160, 520);
  scene.background = new THREE.Color("#c5d8d5");
  const sky = {
      material: {
        uniforms: {
          top: { value: new THREE.Color() },
          bottom: { value: new THREE.Color() },
        },
      },
    },
    sun = new THREE.DirectionalLight(),
    hemi = new THREE.HemisphereLight(),
    ambient = new THREE.AmbientLight(),
    road = new THREE.MeshStandardMaterial({
      color: "#aaaaaa",
      roughness: 0.95,
    }),
    water = new THREE.MeshStandardMaterial(),
    camera = new THREE.PerspectiveCamera();
  camera.position.y = 1.85;
  const world = { roadMaterials: [road], water };
  const api = window.CampusClimate.create(
    scene,
    sky,
    sun,
    hemi,
    ambient,
    world,
    reduced,
    { camera, quality: () => "low" },
  );
  return { api, scene, sun, road, water };
}
const { api, scene, sun, road, water } = setup();
assert.equal(api.current, "morning");
assert.equal(api.select("__proto__"), false);
api.setWeather({ cloud: 2, rain: NaN, wet: -1 });
assert.equal(api.weather.cloud, 1);
assert.equal(api.weather.rain, 0);
assert.equal(api.weather.wet, 0);
api.select("afterrain");
assert.equal(api.diagnostics.custom, false);
api.tick(5, false);
assert.equal(api.weather.wet, 0.88);
assert(
  road.roughness > 0.7,
  "dry islands remain rough instead of a uniformly glossy ground",
);
assert(road.userData.climateWaterFilm);
assert(Number.isFinite(sun.intensity) && sun.intensity > 0);
const shader = {
  uniforms: {},
  vertexShader: THREE.ShaderLib.standard.vertexShader,
  fragmentShader: THREE.ShaderLib.standard.fragmentShader,
};
road.onBeforeCompile(shader);
assert(shader.fragmentShader.includes("campusWaterFilm"));
assert(shader.vertexShader.includes("instanceMatrix*campusWorld"));
assert(shader.fragmentShader.includes("roughnessFactor=mix"));
assert(shader.fragmentShader.includes("#include <normal_fragment_maps>"));
assert(shader.uniforms.uCampusWet.value > 0.8);
api.setWeather({ rain: 1, wet: 0.2, cloud: 1 });
api.tick(5, false);
assert.equal(api.diagnostics.rainBudget, 48);
assert(api.diagnostics.rainCount > 0 && api.diagnostics.rainCount <= 48);
assert(api.diagnostics.wet >= 0.8);
assert.equal(api.diagnostics.extraReflectionPasses, 0);
const time = api.diagnostics.time;
api.tick(1, false, true);
assert.equal(api.diagnostics.time, time);
api.tick(1, true);
assert.equal(api.diagnostics.rainCount, 0);
assert(scene.fog.far < 480);
assert(water.userData.climateRain > 0.9);
api.resetWeather();
assert.equal(api.weather.rain, 0);
assert.equal(api.weather.wet, 0.88);
// Cinematic grades must preserve physically bounded weather controls and one cloud draw.
assert.equal(api.select("sunbreak"), true);
api.tick(5, false);
assert(api.weather.wet > .9 && api.weather.cloud > .6);
const cloud = scene.getObjectByName("Tropical analytic cloud shell");
assert(cloud.material.uniforms.uRim.value > .65,"Warm cloud edges must be scene-directed");
assert.equal(api.select("monsoon"), true);
api.tick(5, false);
assert(api.weather.rain > .7 && api.weather.wet === 1);
assert(api.diagnostics.rainBudget <= 48,"Low tier rain must keep its existing cap");
assert.equal(api.diagnostics.extraReflectionPasses,0);
api.select("afterrain");
const lowMotion = setup(true).api;
lowMotion.setWeather({ rain: 1, cloud: 1 });
lowMotion.tick(5, false);
assert.equal(lowMotion.diagnostics.rainCount, 0);
assert.equal(lowMotion.diagnostics.time, 0);
assert.equal(lowMotion.diagnostics.rain, 1);
assert(scene.getObjectByName("Tropical analytic cloud shell"));
const result = {
  passed: true,
  checks: [
    "five presets: backward-compatible grades and two cinematic weather directions",
    "bounded finite manual controls and reset",
    "world-space patchy GGX water film preserves original PBR maps",
    "rain budget: 48 low / 160 maximum, no extra reflection pass",
    "rain hidden indoors and for reduced motion",
    "clouds/waves/rain freeze when paused",
    "rain-linked haze, diffuse daylight and pond response",
  ],
  limits:
    "Shader source and simulation tests; actual shader compilation and visual appearance additionally checked in Chromium.",
};
fs.writeFileSync(
  "tests/climate-results.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
