// A school that remembers: photographs return to the places they were taken.
//
// Each station is a real photograph already in the project, with its source and rights status as
// the project records them, and a camera pose estimated by matching the photograph against this
// model (lanren/path/README notes the method and the residual error). Nothing is invented: where a
// photograph has no date or author on record, the card says so.
//
// Behaviour
//   near        within ~14 m a quiet bracket marks where the photographer stood (a floor mark and the
//               four corners of their frame, drawn in the world)
//   aligned     the visitor's eye within ~1.3 m of the photographer's and looking within ~9° of their
//               direction: the print develops from its centre outwards, onto the surfaces it shows
//   leaving     what developed lingers on the walls it fell on, desaturating, and fades over ~25 s;
//               seen from elsewhere it no longer lines up: that disagreement is the point
import * as THREE from 'three';
import { HZ } from './memory-shader.js';

const deg = Math.PI / 180;
/** yaw 0 looks campus south (+z), 90 looks campus east (+x); pitch up is positive */
function pose(x, y, z, yaw, pitch, vfov, aspect) {
  const d = new THREE.Vector3(Math.sin(yaw * deg) * Math.cos(pitch * deg), Math.sin(pitch * deg), Math.cos(yaw * deg) * Math.cos(pitch * deg));
  return { eye: new THREE.Vector3(x, y, z), dir: d, vfov, aspect, yaw, pitch };
}

export const STATIONS = [
  {
    id: 'gate', place: '北门', title: '「海南中学」牌楼',
    photo: 'assets/images/campus/campus_fucheng_gate.jpg', crop: [0, 0, 1, 1], size: [493, 260],
    pose: pose(-36.1, 0.27, -89.6, 0, 18, 51, 493 / 260),
    source: '海南中学官网（haizhong.edu.cn）· 项目数据 campus.json 记录', author: '未注明', date: '未注明', rights: '转载授权待核',
    note: '四柱三间与中轴线上的一号楼入口、太湖石能对上；照片里的匾额自右向左读「海南中學」，模型写成了自左向右，门前四尊石狮模型里没有。',
    fit: '位置与方向由立柱间距（0.534 对模型 0.532）和穿过门洞的一号楼入口反解，残差约 5–10 像素',
  },
  {
    id: 'taihu', place: '一号教学楼前', title: '太湖石「虎踞龙盘」',
    photo: 'assets/images/campus/campus_taihushi.jpg', crop: [0, 0, 1, 1], size: [548, 352],
    pose: pose(-38.95, 0.67, -4.6, 0, 4.9, 47.6, 548 / 352),
    source: '项目用户实拍提供（campus.json 记录）', author: '项目用户', date: '未注明', rights: '用户提供；公开再分发范围待登记',
    note: '石头立在楼门正前方偏西的广场上，不在树下：照片里一号楼入口在石头东侧，与校园数据里两者相距 3.7 米一致。模型石头是程序生成的近似形体，孔洞位置不是照片里的孔。',
    fit: '入口相对石头的位置预测为 181 像素，照片中为 180 像素',
  },
  {
    id: 'tree', place: '一号教学楼前', title: '百年榄仁树',
    photo: 'assets/images/web/lanshu-1600.jpg', crop: [54 / 1600, 1 - 1152 / 1280, 1484 / 1600, 988 / 1280], size: [1484, 988],
    pose: pose(9.0, 0.17, -10.0, -27, 9, 60, 1484 / 988),
    source: '区大伟 摄（照片上的印章）；本站新闻档案 n3 配图（《海南日报》2023-10-30 报道）', author: '区大伟', date: '未注明（2023 年 10 月前）', rights: '转载授权待核',
    note: '数字树是物种概念模型，不是这棵树的测绘：站在这里能看见真树的枝条落在模型上，也能看见它们对不上的地方。照片左侧的立石是树下的另一块褐色石头，不是「虎踞龙盘」。',
    fit: '按楼面、台阶和树干位置目视拟合，误差大于前两张（约 1 米、3°）',
  },
];

export function createMemory({ world, renderer, scene, ui, reduce }) {
  const loader = new THREE.TextureLoader();
  const root = new URL('../../', import.meta.url);
  const tex = new Map();
  const getTex = (st) => {
    if (!tex.has(st.id)) {
      const t = loader.load(new URL(st.photo, root).href);
      t.colorSpace = THREE.NoColorSpace;          // sampled raw: the print's own display values
      t.anisotropy = 4;
      tex.set(st.id, t);
    }
    return tex.get(st.id);
  };
  // the projector's depth: rendered once per station from the photographer's eye
  const depthRT = new THREE.WebGLRenderTarget(1024, 1024, { depthBuffer: true });
  depthRT.depthTexture = new THREE.DepthTexture(1024, 1024, THREE.FloatType);
  const projCam = new THREE.PerspectiveCamera(50, 1.5, 0.3, 400);
  let depthFor = null;           // station whose depth is in depthRT
  let dirty = true;

  // ---- markers in the world: a floor mark where they stood, the corners of their frame
  for (const st of STATIONS) getTex(st);          // all three are small; load them before they are needed
  const markers = new THREE.Group();
  markers.name = 'memory-markers';
  const lineMat = new THREE.LineBasicMaterial({ color: 0xf3ead6, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xf3ead6, transparent: true, opacity: 0, depthWrite: false, fog: false });
  for (const st of STATIONS) {
    const g = new THREE.Group();
    const p = st.pose;
    // corners of the frame 2.2 m in front of the eye
    const D = 2.2, h = Math.tan(p.vfov * deg / 2) * D, w = h * p.aspect;
    const fwd = p.dir.clone(), right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, fwd);
    const c = p.eye.clone().addScaledVector(fwd, D);
    const pts = [];
    const L = Math.min(w, h) * 0.22;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const k = c.clone().addScaledVector(right, sx * w).addScaledVector(up, sy * h);
      pts.push(k.clone().addScaledVector(right, -sx * L), k, k, k.clone().addScaledVector(up, -sy * L));
    }
    const lg = new THREE.BufferGeometry().setFromPoints(pts);
    const lines = new THREE.LineSegments(lg, lineMat.clone());
    lines.renderOrder = 5;
    // floor mark: an open ring with a notch towards where the camera looked
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.38, 48, 1, p.yaw * deg + Math.PI / 2 + 0.25, Math.PI * 2 - 0.5), ringMat.clone());
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.eye.x, world.heightAt(p.eye.x, p.eye.z) + 0.015, p.eye.z);
    ring.renderOrder = 5;
    g.add(lines, ring);
    st.marker = { group: g, lines, ring };
    markers.add(g);
  }
  scene.add(markers);

  const state = { active: null, align: 0, dev: 0, amt: 0, linger: 0, lastId: null, fade: 0, near: null, nearD: Infinity, developed: new Set() };
  const tmp = new THREE.Vector3();

  function setProjector(st) {
    const p = st.pose;
    projCam.fov = p.vfov; projCam.aspect = p.aspect;
    projCam.position.copy(p.eye);
    projCam.lookAt(tmp.copy(p.eye).add(p.dir));
    projCam.updateProjectionMatrix(); projCam.updateMatrixWorld();
    HZ.uHzVP.value.multiplyMatrices(projCam.projectionMatrix, projCam.matrixWorldInverse);
    HZ.uHzEye.value.copy(p.eye);
    HZ.uHzNF.value.set(projCam.near, projCam.far);
    HZ.uHzPhoto.value = getTex(st);
    HZ.uHzCrop.value.set(st.crop[0], st.crop[1], st.crop[2], st.crop[3]);
    HZ.uHzAspect.value = p.aspect;
  }

  /** measure how well the visitor's camera agrees with each station */
  function measure(camera) {
    const fwd = camera.getWorldDirection(tmp).clone();
    let best = null, bestScore = 0, near = null, nearD = Infinity;
    for (const st of STATIONS) {
      const d = camera.position.distanceTo(st.pose.eye);
      if (d < nearD) { nearD = d; near = st; }
      const ang = Math.acos(Math.min(1, fwd.dot(st.pose.dir))) / deg;
      const s = (1 - smoothstep(0.5, 1.4, d)) * (1 - smoothstep(4, 10, ang));
      st.align = s;
      if (s > bestScore) { bestScore = s; best = st; }
    }
    return { best, score: bestScore, near, nearD };
  }

  function update(dt, camera, S) {
    const m = measure(camera);
    state.near = m.near; state.nearD = m.nearD;
    // which station drives the projector: the one being aligned, else the one still lingering
    if (m.best && m.score > 0.02 && state.active !== m.best && (state.amt < 0.05 || m.score > 0.5)) {
      state.active = m.best; state.dev = 0; state.amt = 0; dirty = true;
    }
    const st = state.active;
    if (st) {
      const target = st.align;
      if (target > 0.6) {
        // develop: about 4 s from the centre to the corners (1.2 s with reduced motion)
        state.dev = Math.min(1.25, state.dev + dt / (reduce ? 1.2 : 4.0));
        state.amt = Math.min(1, state.amt + dt * 1.5);
        state.linger = Math.min(0.7, state.linger + dt * 0.5);
        state.fade = 0;
        if (state.dev > 1 && !state.developed.has(st.id)) { state.developed.add(st.id); ui.memory?.(st, 'developed'); }
      } else {
        // leaving: the print stays on the walls, then fades
        state.fade += dt;
        const k = Math.max(0, 1 - state.fade / 25);
        state.amt = Math.min(state.amt, k);
        if (state.amt <= 0.001) { state.active = null; state.dev = 0; state.linger = 0; }
      }
      if (state.lastId !== st.id) { ui.memory?.(st, 'enter'); state.lastId = st.id; }
    } else if (state.lastId) { ui.memory?.(null, 'leave'); state.lastId = null; }
    // what lingers on the walls is for the few steps around the spot (the parallax reveal), not for the whole walk
    const away = st ? camera.position.distanceTo(st.pose.eye) : 99;
    const keep = 1 - smoothstep(5, 22, away);
    if (st && keep < 0.02 && st.align < 0.05) { state.active = null; state.dev = 0; state.amt = 0; state.linger = 0; }
    HZ.uHzAmt.value = st ? state.amt * Math.max(st.align > 0.6 ? 1 : 0, keep) : 0;
    HZ.uHzDev.value = state.dev;
    HZ.uHzLinger.value = state.linger * keep;
    // markers: visible on approach (not during the film's own developing, where the frame is the print)
    for (const s of STATIONS) {
      const d = camera.position.distanceTo(s.pose.eye);
      const show = (1 - smoothstep(6, 14, d)) * (1 - (state.active === s ? state.amt : 0) * 0.9) * (S.mode === 'free' ? 1 : 0.55);
      s.marker.lines.material.opacity = show * 0.75 * (0.6 + 0.4 * smoothstep(0.5, 3, d));
      s.marker.ring.material.opacity = show * 0.6;
    }
    ui.hint?.(state, m);
  }

  /** render the projector's depth (before the frame) when the station changed or the world did */
  function prepass() {
    const st = state.active;
    if (!st || (!dirty && depthFor === st)) return;
    setProjector(st);
    const amt = HZ.uHzAmt.value;
    HZ.uHzAmt.value = 0;
    HZ.uHzDepth.value = HZ.uHzPhoto.value;   // never sample the target being drawn
    const vis = markers.visible;
    markers.visible = false;
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(depthRT);
    renderer.clear();
    renderer.render(scene, projCam);
    renderer.setRenderTarget(prev);
    markers.visible = vis;
    HZ.uHzDepth.value = depthRT.depthTexture;
    HZ.uHzAmt.value = amt;
    depthFor = st; dirty = false;
  }

  return {
    state, update, prepass, stations: STATIONS,
    invalidate() { dirty = true; },
    /** tests and the film: force a station fully developed */
    develop(id, amount = 1) { const st = STATIONS.find((s) => s.id === id); state.active = st; state.dev = 1.25 * amount; state.amt = amount; state.linger = 0.7; state.fade = 0; dirty = true; },
  };
}

function smoothstep(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
