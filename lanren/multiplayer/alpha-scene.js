import * as THREE from 'three';
import { buildGeo } from '../map/geo.js';
import { buildCampus } from '../map/campus3d.js';
import { buildColliders } from '../world/collide.js';
import { createCampus } from '../ruhua-stroll/campus.js';
import { createDaylight } from '../ruhua-stroll/daylight.js';
import { createGround, createWater } from '../ruhua-stroll/ground.js';
import { beds, createFlora, plantings } from '../ruhua-stroll/flora.js';
import { createPlayer } from '../ruhua-stroll/player.js';
import { createWalker } from '../ruhua/walker.js';
import { createRemotePlayers } from './avatars.js';

const asset = path => new URL('../assets/' + path, import.meta.url).href;
async function walker() {
  const avatar = await createWalker(asset('ruhua/student.glb'));
  avatar.dispose = () => {
    const disposable = new Set();
    avatar.root.traverse(o => {
      if (o.geometry) disposable.add(o.geometry);
      if (o.skeleton) disposable.add(o.skeleton);
      for (const mat of Array.isArray(o.material) ? o.material : [o.material]) if (mat) disposable.add(mat);
    });
    for (const resource of disposable) resource.dispose();
  };
  return avatar;
}

export async function createAlphaScene(canvas, stick) {
  const mobile = matchMedia('(pointer: coarse)').matches;
  const response = await fetch(new URL('../../assets/walk/campus.json', import.meta.url));
  if (!response.ok) throw new Error('校园数据不可用');
  const geo = buildGeo(await response.json(), null, { rotation: 0 });
  const model = buildCampus(geo.campus, geo.frame);
  const trees = plantings(geo);
  const bedList = beds(geo, trees);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#dbe8f1');
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1300);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1 : 1.5));
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  const day = createDaylight(scene, { shadowSize: 1024, shadowBox: 45 });
  day.set('noon', true);
  const ground = createGround(geo, [...trees, ...bedList, { x: 0, z: 0, kind: 'lanshu', s: 1 }], 1024);
  scene.add(ground.mesh, createWater(geo));
  const [building, flora, student] = await Promise.all([
    createCampus(geo, model),
    createFlora(geo, { url: asset('toon/flora.glb'), atlasUrl: asset('stroll/leaf-atlas-v2.png') }),
    walker(),
  ]);
  scene.add(building.scene, flora.group, student.root);
  const rects = geo.features.filter(f => f.kind === 'water').map(f => ({
    id: f.id, cx: f.cx, cz: f.cz, hw: f.hw, hd: f.hd, rot: f.rot, tall: false,
  }));
  const rock = geo.features.find(f => f.id === 'hujulongpan');
  if (rock) rects.push({ id: 'taihu', cx: rock.cx, cz: rock.cz, hw: 3.4, hd: 2.3, rot: rock.rot, tall: false });
  const circles = [
    { id: 'lanshu', x: 0.1, z: 0, r: 1.15 },
    ...trees.map((t, i) => ({ id: 'tree' + i, x: t.x, z: t.z, r: t.kind === 'shrub' ? 0.55 * t.s : t.kind === 'palm' ? 0.24 : 0.3 * t.s })),
    ...bedList.map((b, i) => ({ id: 'bed' + i, x: b.x, z: b.z, r: 0.5 * b.s })),
  ];
  const colliders = buildColliders([], { rects: [...building.hulls, ...rects], circles }, geo.frame.sheet);
  // Near the existing V2 spawn. Moving north approaches the 榄仁树 at (0, 0).
  const spawn = { x: 1, z: -31, yaw: 0 };
  const player = createPlayer({ camera, dom: canvas, student, getColliders: () => colliders,
    heightAt: building.heightAt, spawn, coarse: mobile });
  player.place(spawn.x, spawn.z, spawn.yaw);
  player.bindStick(stick);
  const remotes = createRemotePlayers({ scene, createAvatar: walker, maxAvatars: mobile ? 4 : 6 });
  let client, latestPlayers = [], last = performance.now();
  function frame(at) {
    requestAnimationFrame(frame);
    if (at - last < (mobile ? 30 : 15)) return;
    const dt = Math.max(0.001, Math.min(0.05, (at - last) / 1000));
    last = at;
    const s = player.update(dt);
    const pose = {
      x: s.pos.x, y: s.pos.y, z: s.pos.z, yaw: s.yaw, speed: s.speed,
      motion: s.airborne ? 'jump' : s.speed < 0.12 ? 'idle' : s.run ? 'run' : 'walk',
    };
    client?.updateLocalPlayer(pose);
    latestPlayers = client?.getPlayers({ time: at }) ?? [];
    remotes.update(latestPlayers, s.pos, dt);
    day.update(dt, s.pos);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  return {
    frame: geo.frame,
    setClient(next) { client = next; },
    jump: () => player.jump(),
    snapshot: () => ({ players: latestPlayers.slice(), avatars: remotes.count, drawCalls: renderer.info.render.calls }),
  };
}
