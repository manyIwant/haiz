import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { modelURL, sourceURL } from './avatar.js';

const $ = id => document.getElementById(id);
const canvas = $('stage');
const stage = canvas.parentElement;
const controls = Object.fromEntries(['lod', 'motion', 'rig', 'compare', 'light', 'ambient', 'shadows', 'distance'].map(id => [id, $(id)]));
const mobile = matchMedia('(pointer: coarse)').matches;
const params = new URLSearchParams(location.search);
const label = { near: 'LOD 0 · 近景', mid: 'LOD 1 · 中景', far: 'LOD 2 · 远景' };
const views = {
  'three-quarter': [.55, .09], front: [0, 0], side: [Math.PI / 2, 0], back: [Math.PI, 0],
};
const presets = {
  day: { sky: 0x303d37, floor: 0x35443d, sun: 0xffebd5, hemi: 0xe1edff, key: 2.3, fill: 2.15, at: [2.5, 4, 3.1] },
  shade: { sky: 0x293e44, floor: 0x324b51, sun: 0xccd9e9, hemi: 0xc2ddff, key: .54, fill: 2.2, at: [2, 3, 2] },
  dusk: { sky: 0x423b37, floor: 0x51453a, sun: 0xffa468, hemi: 0xabc1ee, key: 2.3, fill: 1.5, at: [-3, 2, 1] },
};
const format = new Intl.NumberFormat('en-US');
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setScissorTest(true);
renderer.info.autoReset = false;

function studio() {
  const scene = new THREE.Scene();
  const holder = new THREE.Group();
  const key = new THREE.DirectionalLight();
  key.castShadow = true;
  key.shadow.mapSize.set(mobile ? 512 : 1024, mobile ? 512 : 1024);
  Object.assign(key.shadow.camera, { left: -1.5, right: 1.5, top: 1.5, bottom: -1.5, far: 11 });
  key.shadow.bias = -.0006;
  key.shadow.normalBias = .019;
  key.shadow.radius = 2;
  key.shadow.camera.updateProjectionMatrix();
  const hemi = new THREE.HemisphereLight(0xffffff, 0x94a398);
  const rim = new THREE.DirectionalLight(0xb0c5e2, 1.1);
  rim.position.set(-1.6, 2, -2.3);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ roughness: .94 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.012;
  floor.receiveShadow = true;
  const grid = new THREE.GridHelper(20, 20, 0x819188, 0x62766a);
  grid.position.y = -.009;
  grid.material.transparent = true;
  grid.material.opacity = .16;
  scene.add(holder, floor, key, hemi, rim, grid);
  return { scene, holder, key, hemi, floor, rim };
}

const target = studio();
const source = studio();
const camera = new THREE.PerspectiveCamera(38, 1, .03, 230);
const aim = new THREE.Vector3();
const cached = new Map();
const pointer = new Map();
const durations = [];
let yaw = views['three-quarter'][0], tilt = views['three-quarter'][1], distance = 3.4;
let active, activeTier, sourceAsset, sourceRequest, selectedLoad;
let last = 0, sampleStart = 0;
let rotationChanged = false;
let dims = [0, 0];
let metrics = {};
let loadMs = 0;

function paintLights() {
  const p = presets[controls.light.value];
  renderer.shadowMap.enabled = controls.shadows.checked;
  for (const lab of [target, source]) {
    lab.scene.background = new THREE.Color(p.sky);
    lab.scene.fog = new THREE.FogExp2(p.sky, .13);
    lab.key.color.setHex(p.sun);
    lab.key.position.fromArray(p.at);
    lab.key.intensity = p.key;
    lab.hemi.color.setHex(p.hemi);
    lab.hemi.intensity = controls.ambient.checked ? p.fill : 0;
    lab.rim.visible = controls.ambient.checked;
    lab.floor.material.color.setHex(p.floor);
    lab.floor.material.needsUpdate = true;
  }
}

function loadActor(url, original = false) {
  return loader.loadAsync(url).then(({ scene, animations }) => {
    let mesh;
    scene.traverse(node => {
      if (!node.isMesh) return;
      mesh = node;
      node.castShadow = node.receiveShadow = !original;
      node.frustumCulled = original;
      if (original) {
        node.geometry.computeVertexNormals();
        node.material = new THREE.MeshStandardMaterial({ color: 0xabb5ad, roughness: .82 });
      }
    });
    if (original) scene.scale.setScalar(1.70 / 1.1612915992736816);
    else if (!mesh?.isSkinnedMesh || !animations.length) throw new Error('GLB 缺少蒙皮或动作');
    const skeleton = !original && new THREE.SkeletonHelper(scene);
    if (skeleton) {
      skeleton.material = new THREE.LineBasicMaterial({ color: 0xffc16a, depthTest: false, transparent: true, opacity: .92 });
      skeleton.renderOrder = 8;
    }
    const mixer = !original && new THREE.AnimationMixer(scene);
    return { scene, mesh, animations, skeleton, mixer, triangles: mesh.geometry.index.count / 3 };
  });
}

function play(name, restart = false) {
  if (!active) return;
  const { mixer, mesh, animations } = active;
  const next = animations.find(clip => clip.name === name);
  if (!next) {
    mixer.stopAllAction();
    mesh.skeleton.pose();
    mesh.updateMatrixWorld(true);
    active.action = null;
    return;
  }
  const action = mixer.clipAction(next);
  if (action === active.action && !restart) return;
  const previous = active.action;
  const loop = ['Idle', 'Walk', 'Run'].includes(name);
  action.reset().setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
  action.clampWhenFinished = !loop;
  action.setEffectiveTimeScale(1).setEffectiveWeight(1).play();
  if (previous && previous !== action) {
    if (previous.isRunning()) {
      previous.fadeOut(.16);
      action.fadeIn(.16);
    } else previous.stop();
  }
  active.action = action;
}

async function selectLOD(tier) {
  const token = {};
  selectedLoad = token;
  try {
    $('status').textContent = `载入 ${label[tier]}…`;
    const start = performance.now();
    if (!cached.has(tier)) cached.set(tier, loadActor(modelURL(tier)));
    const actor = await cached.get(tier);
    if (selectedLoad !== token) return;
    if (actor !== active) {
      if (active) {
        target.holder.remove(active.scene, active.skeleton);
        active.mixer.stopAllAction();
        active.action = null;
      }
      target.holder.add(actor.scene, actor.skeleton);
      active = actor;
    }
    activeTier = tier;
    actor.skeleton.visible = controls.rig.checked;
    loadMs = performance.now() - start;
    $('status').textContent = '角色已载入';
    $('tier-label').textContent = label[tier];
    $('triangles').textContent = format.format(actor.triangles);
    play(controls.motion.value);
    sampleStart = 0;
  } catch (error) {
    cached.delete(tier);
    if (selectedLoad !== token) return;
    if (activeTier) controls.lod.value = activeTier;
    $('status').textContent = '角色载入失败，可重新选择细节层级';
    console.error(error);
  }
}

async function compareSource() {
  if (controls.compare.checked && !sourceAsset) {
    $('status').textContent = '载入混元原始高模…';
    try {
      sourceRequest ??= loadActor(sourceURL, true);
      sourceAsset = await sourceRequest;
      source.holder.add(sourceAsset.scene);
      $('status').textContent = '角色已载入';
    } catch (error) {
      sourceRequest = undefined;
      controls.compare.checked = false;
      $('status').textContent = '原始高模载入失败';
      console.error(error);
    }
  }
  stage.toggleAttribute('data-compare', Boolean(controls.compare.checked && sourceAsset));
  $('original-label').hidden = !stage.hasAttribute('data-compare');
  sampleStart = 0;
}

function setDistance(value) {
  distance = THREE.MathUtils.clamp(value, 1.25, 12);
  controls.distance.value = distance;
  $('distance-value').textContent = `${distance.toFixed(1)} m`;
}

function setView(name) {
  [yaw, tilt] = views[name];
  for (const button of document.querySelectorAll('[data-view]')) {
    button.setAttribute('aria-pressed', String(button.dataset.view === name));
  }
  rotationChanged = false;
}

function drag(dx, dy) {
  yaw -= dx * .011;
  tilt = THREE.MathUtils.clamp(tilt + dy * .007, -.45, .94);
  if (rotationChanged) return;
  rotationChanged = true;
  for (const button of document.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', 'false');
}

canvas.addEventListener('pointerdown', event => {
  canvas.setPointerCapture(event.pointerId);
  pointer.set(event.pointerId, [event.clientX, event.clientY]);
});
canvas.addEventListener('pointermove', event => {
  const previous = pointer.get(event.pointerId);
  if (!previous) return;
  const other = [...pointer].find(([id]) => event.pointerId !== id)?.[1];
  const { clientX: x, clientY: y } = event;
  if (other) {
    const before = Math.hypot(previous[0] - other[0], previous[1] - other[1]);
    const after = Math.hypot(x - other[0], y - other[1]);
    if (before > 5 && after > 5) setDistance(distance * before / after);
  } else {
    drag(x - previous[0], y - previous[1]);
  }
  pointer.set(event.pointerId, [x, y]);
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(event, e => pointer.delete(e.pointerId));
}
canvas.addEventListener('wheel', event => {
  event.preventDefault();
  setDistance(distance * Math.exp(.001 * event.deltaY));
}, { passive: false });
canvas.addEventListener('keydown', event => {
  switch (event.key) {
    case 'ArrowLeft': drag(15, 0); break;
    case 'ArrowRight': drag(-15, 0); break;
    case 'ArrowUp': drag(0, 17); break;
    case 'ArrowDown': drag(0, -17); break;
    case '+': case '=': setDistance(distance / 1.12); break;
    case '-': setDistance(distance * 1.12); break;
    default: return;
  }
  event.preventDefault();
});
for (const button of document.querySelectorAll('[data-view]')) {
  button.addEventListener('click', () => setView(button.dataset.view));
}
controls.lod.addEventListener('change', () => selectLOD(controls.lod.value));
controls.motion.addEventListener('change', () => play(controls.motion.value));
$('replay').addEventListener('click', () => play(controls.motion.value, true));
controls.rig.addEventListener('change', () => { if (active) active.skeleton.visible = controls.rig.checked; });
controls.compare.addEventListener('change', compareSource);
controls.distance.addEventListener('input', () => setDistance(+controls.distance.value));
for (const control of [controls.light, controls.ambient, controls.shadows]) control.addEventListener('change', paintLights);

function draw(lab, left, width, height, comparing) {
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  const portraitScale = Math.max(1, .53 / camera.aspect);
  const radius = distance * portraitScale * (comparing ? 1.08 : 1);
  aim.set(0, distance < 2.7 ? .86 + (2.7 - distance) * .45 : .86, 0);
  camera.position.set(Math.sin(yaw) * radius * Math.cos(tilt), aim.y + radius * Math.sin(tilt), Math.cos(yaw) * radius * Math.cos(tilt));
  camera.lookAt(aim);
  renderer.setViewport(left, 0, width, height);
  renderer.setScissor(left, 0, width, height);
  renderer.render(lab.scene, camera);
}

function frame(now) {
  requestAnimationFrame(frame);
  const width = canvas.clientWidth, height = canvas.clientHeight;
  if (!width || !height) return;
  if (width !== dims[0] || height !== dims[1]) {
    dims = [width, height];
    renderer.setSize(width, height, false);
  }
  const dt = last ? now - last : 0;
  last = now;
  if (dt) active?.mixer.update(Math.min(.10, dt * .001));
  renderer.info.reset();
  const comparing = stage.hasAttribute('data-compare');
  const offset = comparing ? Math.round(width / 2) : 0;
  if (comparing) draw(source, 0, offset, height, true);
  draw(target, offset, width - offset, height, comparing);
  if (!active) return;
  if (!sampleStart) {
    sampleStart = now;
    durations.length = 0;
  } else if (dt) durations.push(dt);
  if (now - sampleStart >= 850) {
    const mean = (now - sampleStart) / durations.length;
    const ordered = [...durations].sort((a, b) => a - b);
    metrics = { tier: activeTier, motion: controls.motion.value, modelTriangles: active.triangles,
      originalTriangles: comparing ? sourceAsset.triangles : 0, drawCalls: renderer.info.render.calls,
      renderedTriangles: renderer.info.render.triangles, fps: 1000 / mean,
      frameP95Ms: ordered[Math.floor(.95 * (ordered.length - 1))], samples: ordered.length,
      loadMs, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries,
      jsHeapBytes: performance.memory?.usedJSHeapSize ?? null };
    $('fps').textContent = Math.round(metrics.fps);
    $('calls').textContent = format.format(metrics.drawCalls);
    $('rendered').textContent = format.format(metrics.renderedTriangles);
    sampleStart = now;
    durations.length = 0;
  }
}

controls.lod.value = label[params.get('lod')] ? params.get('lod') : mobile ? 'mid' : 'near';
if ([...controls.motion.options].some(option => option.value === params.get('motion'))) controls.motion.value = params.get('motion');
if (views[params.get('view')]) setView(params.get('view'));
paintLights();
selectLOD(controls.lod.value);
const gl = renderer.getContext();
const rendererInfo = gl.getExtension('WEBGL_debug_renderer_info');
window.__characterLab = {
  stats: () => ({ ...metrics }),
  gpu: rendererInfo ? gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
  current: () => ({ tier: activeTier, yaw, tilt, distance, motion: controls.motion.value, position: active?.action?.time, comparing: stage.hasAttribute('data-compare') }),
};
requestAnimationFrame(frame);
