// HAIZ 动物验证码 · 六款高辨识度 3D 毛绒动物玩偶建模与动画
// 1. 黄鸭子 🐤 (duck)      2. 黑白熊猫 🐼 (panda)    3. 橙色狐狸 🦊 (fox)
// 4. 绿色青蛙 🐸 (frog)    5. 粉色小猪 🐷 (pig)      6. 浅蓝色大象 🐘 (elephant)
// 全部为原创程序化毛绒雕塑模型，统一材质语言（短毛绒 sheen + 细腻微绒法线 + 亮面纽扣眼双高光 + 柔软腮红），
// 烘焙 5 段标准 glTF 动画（idle / touch / lifted / land / celebrate）。
import * as THREE from 'three';
import {
  plushMat, feltMat, satinMat, threadMat, beadMat, catchLightMat,
  blob, taperedTube, tube, paint, lin, smooth, mesh, pivot,
  surfaceAt, placeOnSurface, faceDirs, smileArc, omegaMouth,
  addEye, addBlush, addStitch, animEase, bakeClips,
} from './plush-kit.js';

const FWD = new THREE.Vector3(0, 0, 1);

function blinkAt(clip, t, u) {
  if (clip === 'idle') {
    return u > 0.62 && u < 0.71 ? animEase.bell((u - 0.62) / 0.09) : 0;
  }
  if (clip === 'touch') return animEase.bell(Math.min(1, t / 0.32));
  return 0;
}

function applyBlink(rig, b) {
  if (b <= 0.001) return;
  rig.scl('eyeL', 1, 1 - 0.88 * b, 1);
  rig.scl('eyeR', 1, 1 - 0.88 * b, 1);
}

// ============================================================================
// 1. 黄鸭子 🐤 (duck)
// ============================================================================
export function buildDuck() {
  const root = new THREE.Group();
  root.name = 'haiz.animal.duck';
  const nodes = {};
  const base = (nodes.base = pivot('duck_base', root));

  const C = {
    yellow: '#ffc922',
    belly: '#ffe36b',
    billTop: '#ff771c',
    billBot: '#e85d12',
    feet: '#ff7c22',
    blush: '#ff907d',
  };

  // 圆润梨形小鸭身体
  const bodyC = new THREE.Vector3(0, 0.044, -0.004);
  const bodyGeo = blob({
    w: 28, h: 20,
    shape: (d) => {
      const pear = 1 + 0.14 * Math.max(0, -d.y);
      const p = new THREE.Vector3(d.x * 0.047 * pear, d.y * 0.043, d.z * 0.050 * (1 + 0.08 * -d.y));
      if (d.y < -0.78) p.y = -0.043 * (0.78 + (Math.abs(d.y) - 0.78) * 0.25);
      if (d.z < -0.55 && d.y > -0.25 && d.y < 0.55) {
        const k = smooth(-0.55, -0.95, d.z) * (1 - Math.abs(d.x) * 1.4);
        if (k > 0) { p.z -= k * 0.018; p.y += k * 0.012; }
      }
      return p;
    },
  });
  bodyGeo.translate(bodyC.x, bodyC.y, bodyC.z);
  paint(bodyGeo, (p) => {
    const b = smooth(0.036, 0.010, Math.hypot(p.x * 1.1, p.y - 0.036, p.z - 0.042));
    return lin(C.yellow).lerp(lin(C.belly), b * 0.60);
  });
  base.add(mesh(bodyGeo, plushMat('#ffffff', { vertexColors: true, name: 'duck_body_mat', sheenColor: '#fff0a6' }), 'duck_body'));

  // 头部
  const head = (nodes.head = pivot('duck_head', base, 0, 0.085, 0.008));
  const headC = new THREE.Vector3(0, 0.010, 0);
  const headGeo = blob({
    w: 28, h: 20,
    shape: (d) => {
      const cheek = Math.exp(-Math.pow((d.y + 0.22) / 0.38, 2)) * (1 - Math.abs(d.z)) * 0.005;
      return new THREE.Vector3(d.x * 0.043 + Math.sign(d.x) * cheek, d.y * 0.039, d.z * 0.041);
    },
  });
  headGeo.translate(headC.x, headC.y, headC.z);
  const headMesh = mesh(headGeo, plushMat(C.yellow, { name: 'duck_head_mat', sheenColor: '#fff0a6' }), 'duck_head_mesh');
  head.add(headMesh);

  // 头顶三撮翘起呆毛（小黄鸭标志性轮廓）
  const tuft = (nodes.tuft = pivot('duck_tuft', head, 0, 0.047, -0.002));
  const tuftMat = plushMat(C.yellow, { name: 'duck_tuft_mat', sheenColor: '#fff2b0' });
  const tuftSpecs = [
    { x: 0, z: 0.002, r: 0.0078, h: 0.023, rx: -0.25, rz: 0.05 },
    { x: -0.0075, z: -0.002, r: 0.0062, h: 0.017, rx: -0.22, rz: 0.44 },
    { x: 0.0075, z: -0.002, r: 0.0062, h: 0.016, rx: -0.18, rz: -0.40 },
  ];
  tuftSpecs.forEach((s, i) => {
    const g = blob({
      w: 12, h: 8,
      shape: (d) => {
        const taper = 1 - 0.55 * smooth(-0.2, 1, d.y);
        return new THREE.Vector3(d.x * s.r * taper, (d.y + 0.8) * s.h * 0.52, d.z * s.r * 0.85 * taper);
      },
    });
    const m = mesh(g, tuftMat, `duck_tuft_${i}`);
    m.position.set(s.x, 0, s.z);
    m.rotation.set(s.rx, 0, s.rz);
    tuft.add(m);
  });

  // 标志性宽扁橙色鸭嘴（上喙微微上翘带笑意 + 下喙圆润贴合）
  const bill = (nodes.bill = pivot('duck_bill', head, 0, 0.002, 0.038));
  const upperBillGeo = blob({
    w: 20, h: 14,
    shape: (d) => {
      const smileLift = Math.pow(Math.abs(d.x), 1.8) * 0.0036;
      const flat = d.y < 0 ? 0.52 : 1.0;
      const tipRound = 1 - 0.14 * Math.max(0, d.z);
      return new THREE.Vector3(d.x * 0.0225 * tipRound, d.y * 0.0082 * flat + smileLift, d.z * 0.019);
    },
  });
  const upperBill = mesh(upperBillGeo, satinMat(C.billTop, { name: 'duck_bill_top' }), 'duck_bill_upper');
  upperBill.position.set(0, 0.0024, 0.004);
  bill.add(upperBill);

  const lowerBillGeo = blob({ rx: 0.0165, ry: 0.0056, rz: 0.0135, w: 16, h: 12 });
  const lowerBill = mesh(lowerBillGeo, satinMat(C.billBot, { name: 'duck_bill_bot' }), 'duck_bill_lower');
  lowerBill.position.set(0, -0.0030, 0.001);
  bill.add(lowerBill);

  // 眼睛与腮红（腮红略微外移，不与鸭嘴边缘重叠）
  const [eL, eR] = faceDirs(FWD, [[-0.38, 0.21], [0.38, 0.21]]);
  nodes.eyeL = addEye(head, headMesh, headC, eL, { r: 0.0068, name: 'duck_eyeL' });
  nodes.eyeR = addEye(head, headMesh, headC, eR, { r: 0.0068, name: 'duck_eyeR' });
  const [bL, bR] = faceDirs(FWD, [[-0.66, -0.06], [0.66, -0.06]]);
  addBlush(head, headMesh, headC, bL, { rx: 0.0085, ry: 0.0056, color: C.blush, name: 'duck_blushL' });
  addBlush(head, headMesh, headC, bR, { rx: 0.0085, ry: 0.0056, color: C.blush, name: 'duck_blushR' });

  // 两侧圆润毛绒小翅膀
  const wingGeo = blob({
    w: 16, h: 12,
    shape: (d) => {
      const taper = 1 - 0.35 * smooth(0, -1, d.y);
      return new THREE.Vector3(d.x * 0.010, d.y * 0.024, d.z * 0.022 * taper);
    },
  });
  const wingMat = plushMat(C.yellow, { name: 'duck_wing_mat', sheenColor: '#fff0a6' });
  for (const s of [-1, 1]) {
    const w = pivot(s < 0 ? 'duck_wingL' : 'duck_wingR', base, s * 0.045, 0.048, -0.002);
    w.rotation.set(0.08, s * 0.22, s * -0.26);
    const wm = mesh(wingGeo, wingMat, `${w.name}_mesh`);
    wm.position.y = -0.006;
    w.add(wm);
    nodes[s < 0 ? 'wingL' : 'wingR'] = w;
  }

  // 两只橙色鸭蹼小脚
  const footMat = satinMat(C.feet, { name: 'duck_foot_mat', roughness: 0.45 });
  const footGeo = blob({
    w: 16, h: 12,
    shape: (d) => {
      const fan = 1 + 0.38 * smooth(-0.2, 0.9, d.z);
      const web = 1 + 0.09 * Math.cos(d.x * Math.PI * 3.5) * smooth(0.2, 0.9, d.z);
      return new THREE.Vector3(d.x * 0.016 * fan, d.y * 0.0065, d.z * 0.020 * web);
    },
  });
  for (const s of [-1, 1]) {
    const f = pivot(s < 0 ? 'duck_footL' : 'duck_footR', base, s * 0.023, 0.007, 0.026);
    f.rotation.y = s * -0.24;
    f.add(mesh(footGeo, footMat, `${f.name}_mesh`));
    nodes[s < 0 ? 'footL' : 'footR'] = f;
  }

  const clips = bakeClips(nodes, (rig, clip, t, u) => {
    const cyc = u * Math.PI * 2;
    let squash = 1, hop = 0, headRoll = 0, headPitch = 0, wingFlap = 0, footKick = 0, tuftBob = 0;
    if (clip === 'idle') {
      squash = 1 + Math.sin(cyc) * 0.025;
      headRoll = Math.sin(cyc) * 0.07;
      wingFlap = Math.sin(cyc * 2) * 0.08;
      tuftBob = Math.sin(cyc * 2) * 0.1;
    } else if (clip === 'touch') {
      const k = animEase.wobble(u, 2.5, 4);
      squash = 1 - 0.16 * k;
      wingFlap = 0.55 * animEase.bell(u);
      headPitch = -0.14 * animEase.bell(u);
    } else if (clip === 'lifted') {
      squash = 1.08;
      wingFlap = 0.42 + Math.sin(cyc * 4) * 0.35;
      footKick = Math.sin(cyc * 4) * 0.35;
      headRoll = Math.sin(cyc * 2) * 0.12;
      tuftBob = Math.sin(cyc * 4) * 0.18;
    } else if (clip === 'land') {
      const k = animEase.wobble(u, 2.6, 4.4);
      squash = 1 - 0.20 * k;
      wingFlap = 0.35 * animEase.bell(u);
    } else if (clip === 'celebrate') {
      hop = Math.abs(Math.sin(cyc * 2)) * 0.018;
      squash = 1 + Math.sin(cyc * 4) * 0.06;
      wingFlap = 0.55 + Math.sin(cyc * 6) * 0.38;
      headRoll = Math.sin(cyc * 2) * 0.16;
      footKick = Math.sin(cyc * 4) * 0.25;
    }
    rig.move('base', 0, hop, 0);
    rig.squash('base', squash);
    rig.rot('head', headPitch, 0, headRoll);
    rig.rot('tuft', tuftBob, 0, headRoll * 0.5);
    rig.rot('wingL', 0, 0, -wingFlap);
    rig.rot('wingR', 0, 0, wingFlap);
    rig.rot('footL', footKick, 0, 0);
    rig.rot('footR', -footKick, 0, 0);
    applyBlink(rig, blinkAt(clip, t, u));
  });

  return { root, clips };
}

// ============================================================================
// 2. 黑白熊猫 🐼 (panda)
// ============================================================================
export function buildPanda() {
  const root = new THREE.Group();
  root.name = 'haiz.animal.panda';
  const nodes = {};
  const base = (nodes.base = pivot('panda_base', root));

  const C = {
    white: '#f8f6f0',
    black: '#24272c',
    pink: '#f3a4b5',
    blush: '#f59aa8',
  };

  // 圆滚滚熊猫身体（奶白肚皮 + 标志性黑色肩带）
  const bodyC = new THREE.Vector3(0, 0.044, -0.002);
  const bodyGeo = blob({
    w: 28, h: 20,
    shape: (d) => {
      const pear = 1 + 0.14 * Math.max(0, -d.y);
      const p = new THREE.Vector3(d.x * 0.049 * pear, d.y * 0.044, d.z * 0.046 * pear);
      if (d.y < -0.78) p.y = -0.044 * (0.78 + (Math.abs(d.y) - 0.78) * 0.24);
      return p;
    },
  });
  bodyGeo.translate(bodyC.x, bodyC.y, bodyC.z);
  paint(bodyGeo, (p) => {
    const band = smooth(0.052, 0.063, p.y);
    return lin(C.white).lerp(lin(C.black), band);
  });
  base.add(mesh(bodyGeo, plushMat('#ffffff', { vertexColors: true, name: 'panda_body_mat', sheenColor: '#f0ece4' }), 'panda_body'));

  // 头部（雪白圆脸 + 蓬松脸颊）
  const head = (nodes.head = pivot('panda_head', base, 0, 0.087, 0.008));
  const headC = new THREE.Vector3(0, 0.010, 0);
  const headGeo = blob({
    w: 28, h: 20,
    shape: (d) => {
      const cheek = Math.exp(-Math.pow((d.y + 0.22) / 0.38, 2)) * (1 - Math.abs(d.z)) * 0.006;
      return new THREE.Vector3(d.x * 0.046 + Math.sign(d.x) * cheek, d.y * 0.041, d.z * 0.042);
    },
  });
  headGeo.translate(headC.x, headC.y, headC.z);
  const headMesh = mesh(headGeo, plushMat(C.white, { name: 'panda_head_mat', sheenColor: '#ffffff' }), 'panda_head_mesh');
  head.add(headMesh);

  // 两只圆润黑耳朵
  const blackPlush = plushMat(C.black, { name: 'panda_black_plush', sheenColor: '#666b74' });
  const earGeo = blob({ rx: 0.0165, ry: 0.0155, rz: 0.011, w: 16, h: 12 });
  for (const s of [-1, 1]) {
    const ear = pivot(s < 0 ? 'panda_earL' : 'panda_earR', head, s * 0.034, 0.044, -0.004);
    ear.rotation.z = s * -0.22;
    ear.add(mesh(earGeo, blackPlush, `${ear.name}_mesh`));
    nodes[s < 0 ? 'earL' : 'earR'] = ear;
  }

  // 比例恰到好处的斜椭圆黑眼圈（间距舒展，露出鼻子与微笑）
  const patchMat = feltMat(C.black, { name: 'panda_eye_patch', sheenColor: '#565c66' });
  const [pL, pR] = faceDirs(FWD, [[-0.44, 0.10], [0.44, 0.10]]);
  [pL, pR].forEach((dir, idx) => {
    const s = idx === 0 ? -1 : 1;
    const hit = surfaceAt(headMesh, headC, dir);
    const pg = new THREE.SphereGeometry(1, 16, 12);
    pg.scale(0.0102, 0.0132, 0.0028);
    const pm = mesh(pg, patchMat, `panda_patch_${idx}`);
    pm.castShadow = false;
    placeOnSurface(pm, hit, 0.0005);
    pm.rotateZ(s * -0.36);
    head.updateWorldMatrix(true, false);
    pm.updateMatrixWorld(true);
    head.attach(pm);
  });

  const [eL, eR] = faceDirs(FWD, [[-0.40, 0.14], [0.40, 0.14]]);
  nodes.eyeL = addEye(head, headMesh, headC, eL, { r: 0.0062, name: 'panda_eyeL', color: '#141212', sink: 0.08, glintScale: 1.32 });
  nodes.eyeR = addEye(head, headMesh, headC, eR, { r: 0.0062, name: 'panda_eyeR', color: '#141212', sink: 0.08, glintScale: 1.32 });

  // 黑色圆润小鼻子 + 清晰可见的温柔 ω 微笑 + 外侧粉色腮红
  const nose = mesh(blob({ rx: 0.0060, ry: 0.0042, rz: 0.0040, w: 12, h: 8 }), beadMat('#221e1e'), 'panda_nose');
  nose.position.set(0, 0.003, 0.0422);
  head.add(nose);
  addStitch(head, headMesh, headC, faceDirs(FWD, omegaMouth(0.14, 0.046, -0.15)), { r: 0.00125, color: '#2b2423', name: 'panda_mouth', lift: 0.0009 });
  const [bL, bR] = faceDirs(FWD, [[-0.64, -0.13], [0.64, -0.13]]);
  addBlush(head, headMesh, headC, bL, { rx: 0.0080, ry: 0.0052, color: C.blush, name: 'panda_blushL' });
  addBlush(head, headMesh, headC, bR, { rx: 0.0080, ry: 0.0052, color: C.blush, name: 'panda_blushR' });

  // 黑色胖手臂（略微向前环抱肚子）
  const armGeo = blob({ rx: 0.0135, ry: 0.022, rz: 0.014, w: 14, h: 10 });
  for (const s of [-1, 1]) {
    const arm = pivot(s < 0 ? 'panda_armL' : 'panda_armR', base, s * 0.042, 0.056, 0.015);
    arm.rotation.set(-0.42, s * -0.24, s * 0.34);
    const am = mesh(armGeo, blackPlush, `${arm.name}_mesh`);
    am.position.y = -0.010;
    arm.add(am);
    nodes[s < 0 ? 'armL' : 'armR'] = arm;
  }

  // 坐姿黑色后腿 + 粉色肉垫
  const legGeo = blob({ rx: 0.0165, ry: 0.0155, rz: 0.020, w: 14, h: 10 });
  const padMat = feltMat(C.pink, { name: 'panda_paw_pad', useNormal: false });
  for (const s of [-1, 1]) {
    const leg = pivot(s < 0 ? 'panda_legL' : 'panda_legR', base, s * 0.027, 0.0155, 0.032);
    leg.rotation.y = s * -0.25;
    leg.add(mesh(legGeo, blackPlush, `${leg.name}_mesh`));
    const pad = mesh(new THREE.SphereGeometry(0.0080, 12, 8), padMat, `${leg.name}_pad`);
    pad.scale.set(1.05, 0.9, 0.35);
    pad.position.set(0, -0.001, 0.0190);
    pad.castShadow = false;
    leg.add(pad);
    nodes[s < 0 ? 'legL' : 'legR'] = leg;
  }

  // 圆球小尾巴
  const tail = mesh(new THREE.SphereGeometry(0.010, 10, 8), plushMat(C.white, { name: 'panda_tail_mat' }), 'panda_tail');
  tail.position.set(0, 0.024, -0.045);
  base.add(tail);

  const clips = bakeClips(nodes, (rig, clip, t, u) => {
    const cyc = u * Math.PI * 2;
    let squash = 1, hop = 0, headRoll = 0, headYaw = 0, armWave = 0, legKick = 0, earWig = 0;
    if (clip === 'idle') {
      squash = 1 + Math.sin(cyc) * 0.022;
      headRoll = Math.sin(cyc) * 0.08;
      armWave = Math.sin(cyc) * 0.1;
      earWig = Math.sin(cyc * 2) * 0.06;
    } else if (clip === 'touch') {
      const k = animEase.wobble(u, 2.5, 4);
      squash = 1 - 0.16 * k;
      armWave = 0.45 * animEase.bell(u);
      earWig = 0.25 * animEase.bell(u);
    } else if (clip === 'lifted') {
      squash = 1.07;
      armWave = 0.55 + Math.sin(cyc * 3) * 0.32;
      legKick = Math.sin(cyc * 3) * 0.32;
      headRoll = Math.sin(cyc * 2) * 0.14;
    } else if (clip === 'land') {
      const k = animEase.wobble(u, 2.6, 4.4);
      squash = 1 - 0.19 * k;
    } else if (clip === 'celebrate') {
      hop = Math.abs(Math.sin(cyc * 2)) * 0.016;
      armWave = 0.8 + Math.sin(cyc * 4) * 0.38;
      headRoll = Math.sin(cyc * 2) * 0.16;
      headYaw = Math.sin(cyc * 2) * 0.15;
    }
    rig.move('base', 0, hop, 0);
    rig.squash('base', squash);
    rig.rot('head', 0, headYaw, headRoll);
    rig.rot('earL', 0, 0, earWig);
    rig.rot('earR', 0, 0, -earWig);
    rig.rot('armL', -armWave * 0.6, 0, -armWave * 0.5);
    rig.rot('armR', -armWave * 0.6, 0, armWave * 0.5);
    rig.rot('legL', legKick, 0, 0);
    rig.rot('legR', -legKick, 0, 0);
    applyBlink(rig, blinkAt(clip, t, u));
  });

  return { root, clips };
}

// ============================================================================
// 3. 橙色狐狸 🦊 (fox)
// ============================================================================
export function buildFox() {
  const root = new THREE.Group();
  root.name = 'haiz.animal.fox';
  const nodes = {};
  const base = (nodes.base = pivot('fox_base', root));

  const C = {
    orange: '#f26a1b',
    cream: '#fff8ec',
    dark: '#30231e',
    earInner: '#f8d2be',
    blush: '#f58974',
  };

  // 坐姿橙色狐狸身体 + 奶白胸毛
  const bodyC = new THREE.Vector3(0, 0.044, -0.004);
  const bodyGeo = blob({
    w: 28, h: 20,
    shape: (d) => {
      const pear = 1 + 0.16 * Math.max(0, -d.y);
      const p = new THREE.Vector3(d.x * 0.043 * pear, d.y * 0.044, d.z * 0.044 * pear);
      if (d.y < -0.78) p.y = -0.044 * (0.78 + (Math.abs(d.y) - 0.78) * 0.25);
      return p;
    },
  });
  bodyGeo.translate(bodyC.x, bodyC.y, bodyC.z);
  paint(bodyGeo, (p) => {
    const chest = smooth(0.036, 0.015, Math.hypot(p.x * 1.35, (p.y - 0.046) * 0.9, p.z - 0.040));
    return lin(C.orange).lerp(lin(C.cream), chest);
  });
  base.add(mesh(bodyGeo, plushMat('#ffffff', { vertexColors: true, name: 'fox_body_mat', sheenColor: '#ffd09c' }), 'fox_body'));

  // 狐狸头部（蓬松两侧颊毛 + 精致尖吻 + 标志性橙白脸谱）
  const head = (nodes.head = pivot('fox_head', base, 0, 0.085, 0.008));
  const headC = new THREE.Vector3(0, 0.010, 0);
  const headGeo = blob({
    w: 32, h: 22,
    shape: (d) => {
      const cheekFlare = Math.exp(-Math.pow((d.y + 0.18) / 0.34, 2)) * Math.pow(Math.abs(d.x), 1.3) * 0.012;
      const snout = Math.exp(-Math.pow(d.x / 0.42, 2)) * Math.exp(-Math.pow((d.y + 0.22) / 0.38, 2)) * smooth(0.25, 0.95, d.z) * 0.018;
      return new THREE.Vector3(
        d.x * 0.043 + Math.sign(d.x) * cheekFlare,
        d.y * 0.037,
        d.z * 0.040 + snout
      );
    },
  });
  headGeo.translate(headC.x, headC.y, headC.z);
  paint(headGeo, (p) => {
    const waveY = -0.001 + Math.abs(p.x) * 0.30 - Math.max(0, p.z - 0.032) * 0.38;
    const isWhite = smooth(waveY + 0.007, waveY - 0.005, p.y) * smooth(-0.012, 0.014, p.z);
    return lin(C.orange).lerp(lin(C.cream), isWhite);
  });
  const headMesh = mesh(headGeo, plushMat('#ffffff', { vertexColors: true, name: 'fox_head_mat', sheenColor: '#ffd4a6' }), 'fox_head_mesh');
  head.add(headMesh);

  // 软萌饱满的毛绒尖耳（柔和圆尖替代锐利圆锥，更有真实充棉玩偶感）
  const earInnerMat = feltMat(C.earInner, { name: 'fox_ear_inner' });
  for (const s of [-1, 1]) {
    const ear = pivot(s < 0 ? 'fox_earL' : 'fox_earR', head, s * 0.027, 0.034, -0.002);
    ear.rotation.set(0.06, s * -0.18, s * -0.24);

    const outerGeo = blob({
      w: 16, h: 14,
      shape: (d) => {
        const y01 = (d.y + 1) * 0.5;
        const taper = 1 - 0.72 * Math.pow(y01, 1.15);
        return new THREE.Vector3(d.x * 0.019 * taper, y01 * 0.040, d.z * 0.010 * taper);
      },
    });
    paint(outerGeo, (p) => lin(C.orange).lerp(lin(C.dark), smooth(0.021, 0.032, p.y)));
    ear.add(mesh(outerGeo, plushMat('#ffffff', { vertexColors: true, name: 'fox_ear_outer', sheenColor: '#ffc898' }), `${ear.name}_outer`));

    const innerGeo = blob({
      w: 12, h: 10,
      shape: (d) => {
        const y01 = (d.y + 1) * 0.5;
        const taper = 1 - 0.70 * Math.pow(y01, 1.15);
        return new THREE.Vector3(d.x * 0.0115 * taper, y01 * 0.025, d.z * 0.0032);
      },
    });
    const im = mesh(innerGeo, earInnerMat, `${ear.name}_inner`);
    im.position.set(0, 0.004, 0.0052);
    im.castShadow = false;
    ear.add(im);

    nodes[s < 0 ? 'earL' : 'earR'] = ear;
  }

  // 鼻尖、大眼睛、微笑与腮红
  const nose = mesh(blob({ rx: 0.0058, ry: 0.0044, rz: 0.0045, w: 12, h: 8 }), beadMat(C.dark), 'fox_nose');
  nose.position.set(0, 0.003, 0.055);
  head.add(nose);

  const [eL, eR] = faceDirs(FWD, [[-0.36, 0.14], [0.36, 0.14]]);
  nodes.eyeL = addEye(head, headMesh, headC, eL, { r: 0.0064, name: 'fox_eyeL' });
  nodes.eyeR = addEye(head, headMesh, headC, eR, { r: 0.0064, name: 'fox_eyeR' });
  addStitch(head, headMesh, headC, faceDirs(FWD, omegaMouth(0.095, 0.036, -0.19)), { r: 0.0009, color: '#3b241c', name: 'fox_mouth' });
  const [bL, bR] = faceDirs(FWD, [[-0.58, -0.04], [0.58, -0.04]]);
  addBlush(head, headMesh, headC, bL, { rx: 0.0085, ry: 0.0052, color: C.blush, name: 'fox_blushL' });
  addBlush(head, headMesh, headC, bR, { rx: 0.0085, ry: 0.0052, color: C.blush, name: 'fox_blushR' });

  // 橙色小腿 + 深炭黑袜子小爪（衔接自然）
  const legGeo = blob({ rx: 0.013, ry: 0.0115, rz: 0.019, w: 14, h: 10 });
  paint(legGeo, (p) => lin(C.orange).lerp(lin(C.dark), smooth(0.000, 0.011, p.z)));
  const legMat = plushMat('#ffffff', { vertexColors: true, name: 'fox_leg_mat', sheenColor: '#ffd4a6' });
  for (const s of [-1, 1]) {
    const p = pivot(s < 0 ? 'fox_pawL' : 'fox_pawR', base, s * 0.022, 0.012, 0.032);
    p.rotation.y = s * -0.18;
    p.add(mesh(legGeo, legMat, `${p.name}_mesh`));
    nodes[s < 0 ? 'pawL' : 'pawR'] = p;
  }

  // 橙色短小前爪贴在胸前
  const armGeo = blob({ rx: 0.010, ry: 0.017, rz: 0.010, w: 12, h: 8 });
  paint(armGeo, (p) => lin(C.orange).lerp(lin(C.dark), smooth(-0.003, -0.012, p.y)));
  for (const s of [-1, 1]) {
    const arm = pivot(s < 0 ? 'fox_armL' : 'fox_armR', base, s * 0.038, 0.052, 0.012);
    arm.rotation.set(-0.35, 0, s * 0.35);
    const am = mesh(armGeo, legMat, `${arm.name}_mesh`);
    am.position.y = -0.008;
    arm.add(am);
    nodes[s < 0 ? 'armL' : 'armR'] = arm;
  }

  // 标志性蓬松大狐尾（从右侧自然环抱而出，奶白大尾尖正面一眼可见！）
  const tail = (nodes.tail = pivot('fox_tail', base, 0.008, 0.020, -0.036));
  const tailPts = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.034, 0.006, -0.010),
    new THREE.Vector3(0.058, 0.022, 0.012),
    new THREE.Vector3(0.064, 0.044, 0.024),
    new THREE.Vector3(0.056, 0.060, 0.028),
  ];
  const tailGeo = taperedTube(
    tailPts,
    (t) => 0.012 + Math.sin(Math.pow(t, 0.72) * Math.PI) * 0.0145,
    { tubular: 20, radial: 10 }
  );
  paint(tailGeo, (p) => {
    const whiteTip = smooth(0.026, 0.044, p.y);
    return lin(C.orange).lerp(lin(C.cream), whiteTip);
  });
  tail.add(mesh(tailGeo, plushMat('#ffffff', { vertexColors: true, name: 'fox_tail_mat', sheenColor: '#ffe4c2' }), 'fox_tail_mesh'));

  const clips = bakeClips(nodes, (rig, clip, t, u) => {
    const cyc = u * Math.PI * 2;
    let squash = 1, hop = 0, headRoll = 0, headYaw = 0, tailWag = 0, earFlick = 0, pawLift = 0;
    if (clip === 'idle') {
      squash = 1 + Math.sin(cyc) * 0.022;
      tailWag = Math.sin(cyc * 2) * 0.22;
      headRoll = Math.sin(cyc) * 0.07;
      earFlick = u > 0.35 && u < 0.48 ? Math.sin(((u - 0.35) / 0.13) * Math.PI) * 0.24 : 0;
    } else if (clip === 'touch') {
      const k = animEase.wobble(u, 2.5, 4);
      squash = 1 - 0.16 * k;
      earFlick = 0.32 * animEase.bell(u);
      tailWag = 0.45 * k;
    } else if (clip === 'lifted') {
      squash = 1.09;
      tailWag = Math.sin(cyc * 3) * 0.40;
      pawLift = Math.sin(cyc * 3) * 0.28;
      headRoll = Math.sin(cyc * 2) * 0.12;
    } else if (clip === 'land') {
      const k = animEase.wobble(u, 2.6, 4.4);
      squash = 1 - 0.19 * k;
      tailWag = 0.3 * k;
    } else if (clip === 'celebrate') {
      hop = Math.abs(Math.sin(cyc * 2)) * 0.018;
      tailWag = Math.sin(cyc * 6) * 0.48;
      headRoll = Math.sin(cyc * 2) * 0.16;
      headYaw = Math.sin(cyc * 2) * 0.14;
      earFlick = Math.sin(cyc * 4) * 0.18;
    }
    rig.move('base', 0, hop, 0);
    rig.squash('base', squash);
    rig.rot('head', 0, headYaw, headRoll);
    rig.rot('earL', 0, 0, earFlick * 0.6);
    rig.rot('earR', 0, 0, -earFlick);
    rig.rot('tail', 0, tailWag, tailWag * 0.35);
    rig.rot('pawL', -pawLift, 0, 0);
    rig.rot('pawR', pawLift, 0, 0);
    applyBlink(rig, blinkAt(clip, t, u));
  });

  return { root, clips };
}

// ============================================================================
// 4. 绿色青蛙 🐸 (frog)
// ============================================================================
export function buildFrog() {
  const root = new THREE.Group();
  root.name = 'haiz.animal.frog';
  const nodes = {};
  const base = (nodes.base = pivot('frog_base', root));

  const C = {
    green: '#54c04b',
    belly: '#f5f2cc',
    white: '#fffef8',
    blush: '#f58c8a',
    mouth: '#244822',
  };

  // 圆嘟嘟青蛙身体 + 大片奶黄肚皮
  const bodyC = new THREE.Vector3(0, 0.040, -0.002);
  const bodyGeo = blob({
    w: 28, h: 20,
    shape: (d) => {
      const pear = 1 + 0.16 * Math.max(0, -d.y);
      const p = new THREE.Vector3(d.x * 0.047 * pear, d.y * 0.040, d.z * 0.044 * pear);
      if (d.y < -0.78) p.y = -0.040 * (0.78 + (Math.abs(d.y) - 0.78) * 0.22);
      return p;
    },
  });
  bodyGeo.translate(bodyC.x, bodyC.y, bodyC.z);
  paint(bodyGeo, (p) => {
    const b = smooth(0.039, 0.019, Math.hypot(p.x * 1.15, (p.y - 0.036) * 1.15, p.z - 0.039));
    return lin(C.green).lerp(lin(C.belly), b);
  });
  base.add(mesh(bodyGeo, plushMat('#ffffff', { vertexColors: true, name: 'frog_body_mat', sheenColor: '#bdf0a8' }), 'frog_body'));

  // 标志性宽扁青蛙大脸
  const head = (nodes.head = pivot('frog_head', base, 0, 0.077, 0.006));
  const headC = new THREE.Vector3(0, 0.008, 0);
  const headGeo = blob({
    w: 28, h: 20,
    shape: (d) => {
      const cheek = Math.exp(-Math.pow((d.y + 0.10) / 0.45, 2)) * (1 - Math.abs(d.z)) * 0.005;
      return new THREE.Vector3(d.x * 0.047 + Math.sign(d.x) * cheek, d.y * 0.031, d.z * 0.040);
    },
  });
  headGeo.translate(headC.x, headC.y, headC.z);
  const greenPlush = plushMat(C.green, { name: 'frog_green_plush', sheenColor: '#b7f0a3' });
  const headMesh = mesh(headGeo, greenPlush, 'frog_head_mesh');
  head.add(headMesh);

  // 标志性头顶一对大鼓包蛙眼
  const scleraMat = feltMat(C.white, { name: 'frog_sclera', useNormal: false });
  const pupilMat = beadMat('#161414');
  const glintMat = catchLightMat();

  for (const s of [-1, 1]) {
    const dome = pivot(s < 0 ? 'frog_eyeL' : 'frog_eyeR', head, s * 0.024, 0.034, 0.006);
    const bump = mesh(new THREE.SphereGeometry(0.0185, 16, 12), greenPlush, `${dome.name}_bump`);
    dome.add(bump);

    const sclera = mesh(new THREE.SphereGeometry(0.0135, 14, 10), scleraMat, `${dome.name}_sclera`);
    sclera.scale.set(1.0, 1.0, 0.46);
    sclera.position.set(s * 0.001, 0.001, 0.0132);
    sclera.castShadow = false;
    dome.add(sclera);

    const pupil = mesh(new THREE.SphereGeometry(0.0088, 14, 10), pupilMat, `${dome.name}_pupil`);
    pupil.scale.set(1.0, 1.04, 0.48);
    pupil.position.set(s * 0.001, 0.001, 0.0174);
    pupil.castShadow = false;
    dome.add(pupil);

    const g1 = mesh(new THREE.SphereGeometry(0.0030, 8, 6), glintMat, `${dome.name}_g1`);
    g1.scale.set(1, 1, 0.4);
    g1.position.set(s * 0.001 - 0.0030, 0.0040, 0.0212);
    g1.castShadow = false;
    dome.add(g1);

    const g2 = mesh(new THREE.SphereGeometry(0.0014, 6, 5), glintMat, `${dome.name}_g2`);
    g2.scale.set(1, 1, 0.4);
    g2.position.set(s * 0.001 + 0.0028, -0.0022, 0.0212);
    g2.castShadow = false;
    dome.add(g2);

    nodes[s < 0 ? 'eyeL' : 'eyeR'] = dome;
  }

  // 灿烂青蛙微笑 + 鼻孔 + 外侧腮红（不遮挡嘴角）
  addStitch(head, headMesh, headC, faceDirs(FWD, smileArc(0.32, 0.13, -0.08, 12)), { r: 0.0012, color: C.mouth, name: 'frog_mouth' });
  const nostrilMat = threadMat(C.mouth);
  for (const s of [-1, 1]) {
    const hit = surfaceAt(headMesh, headC, faceDirs(FWD, [[s * 0.08, 0.14]])[0]);
    const n = mesh(new THREE.SphereGeometry(0.0018, 8, 6), nostrilMat, `frog_nostril_${s}`);
    n.castShadow = false;
    placeOnSurface(n, hit, 0.0005);
    head.updateWorldMatrix(true, false);
    n.updateMatrixWorld(true);
    head.attach(n);
  }
  const [bL, bR] = faceDirs(FWD, [[-0.63, -0.10], [0.63, -0.10]]);
  addBlush(head, headMesh, headC, bL, { rx: 0.0092, ry: 0.0060, color: C.blush, name: 'frog_blushL' });
  addBlush(head, headMesh, headC, bR, { rx: 0.0092, ry: 0.0060, color: C.blush, name: 'frog_blushR' });

  // 绿色小手臂 + 外八字大脚掌
  const armGeo = blob({ rx: 0.012, ry: 0.020, rz: 0.012, w: 12, h: 8 });
  for (const s of [-1, 1]) {
    const arm = pivot(s < 0 ? 'frog_armL' : 'frog_armR', base, s * 0.043, 0.048, 0.010);
    arm.rotation.set(-0.35, 0, s * 0.42);
    const am = mesh(armGeo, greenPlush, `${arm.name}_mesh`);
    am.position.y = -0.008;
    arm.add(am);
    nodes[s < 0 ? 'armL' : 'armR'] = arm;
  }

  const footGeo = blob({
    w: 14, h: 10,
    shape: (d) => {
      const fan = 1 + 0.34 * smooth(-0.2, 0.9, d.z);
      const toe = 1 + 0.08 * Math.cos(d.x * Math.PI * 3.5) * smooth(0.25, 0.9, d.z);
      return new THREE.Vector3(d.x * 0.0165 * fan, d.y * 0.0082, d.z * 0.020 * toe);
    },
  });
  for (const s of [-1, 1]) {
    const f = pivot(s < 0 ? 'frog_footL' : 'frog_footR', base, s * 0.031, 0.0085, 0.023);
    f.rotation.y = s * -0.45;
    f.add(mesh(footGeo, greenPlush, `${f.name}_mesh`));
    nodes[s < 0 ? 'footL' : 'footR'] = f;
  }

  const clips = bakeClips(nodes, (rig, clip, t, u) => {
    const cyc = u * Math.PI * 2;
    let squash = 1, hop = 0, headPitch = 0, headRoll = 0, armWave = 0, footKick = 0;
    if (clip === 'idle') {
      squash = 1 + Math.sin(cyc) * 0.03;
      headPitch = Math.sin(cyc) * 0.05;
      armWave = Math.sin(cyc) * 0.1;
    } else if (clip === 'touch') {
      const k = animEase.wobble(u, 2.5, 4);
      squash = 1 - 0.18 * k;
      armWave = 0.45 * animEase.bell(u);
    } else if (clip === 'lifted') {
      squash = 1.09;
      armWave = 0.5 + Math.sin(cyc * 4) * 0.32;
      footKick = Math.sin(cyc * 4) * 0.42;
      headRoll = Math.sin(cyc * 2) * 0.10;
    } else if (clip === 'land') {
      const k = animEase.wobble(u, 2.6, 4.4);
      squash = 1 - 0.22 * k;
    } else if (clip === 'celebrate') {
      hop = Math.abs(Math.sin(cyc * 2)) * 0.024;
      squash = 1 + Math.sin(cyc * 4) * 0.08;
      armWave = 0.8 + Math.sin(cyc * 4) * 0.35;
      footKick = Math.sin(cyc * 4) * 0.3;
    }
    rig.move('base', 0, hop, 0);
    rig.squash('base', squash);
    rig.rot('head', headPitch, 0, headRoll);
    rig.rot('armL', -armWave * 0.5, 0, -armWave * 0.4);
    rig.rot('armR', -armWave * 0.5, 0, armWave * 0.4);
    rig.rot('footL', footKick, 0, 0);
    rig.rot('footR', -footKick, 0, 0);
    const b = blinkAt(clip, t, u);
    if (b > 0.001) {
      rig.scl('eyeL', 1, 1 - 0.28 * b, 1);
      rig.scl('eyeR', 1, 1 - 0.28 * b, 1);
    }
  });

  return { root, clips };
}

// ============================================================================
// 5. 粉色小猪 🐷 (pig)
// ============================================================================
export function buildPig() {
  const root = new THREE.Group();
  root.name = 'haiz.animal.pig';
  const nodes = {};
  const base = (nodes.base = pivot('pig_base', root));

  const C = {
    pink: '#ff96b4',
    belly: '#ffbfd2',
    snout: '#f26d95',
    nostril: '#63243b',
    hoof: '#c95c82',
    blush: '#ff7ea2',
  };

  // 圆滚滚小猪身体
  const bodyC = new THREE.Vector3(0, 0.045, -0.002);
  const bodyGeo = blob({
    w: 28, h: 20,
    shape: (d) => {
      const pear = 1 + 0.12 * Math.max(0, -d.y);
      const p = new THREE.Vector3(d.x * 0.050 * pear, d.y * 0.044, d.z * 0.048 * pear);
      if (d.y < -0.78) p.y = -0.044 * (0.78 + (Math.abs(d.y) - 0.78) * 0.24);
      return p;
    },
  });
  bodyGeo.translate(bodyC.x, bodyC.y, bodyC.z);
  paint(bodyGeo, (p) => {
    const b = smooth(0.038, 0.015, Math.hypot(p.x * 1.15, p.y - 0.040, p.z - 0.042));
    return lin(C.pink).lerp(lin(C.belly), b * 0.75);
  });
  base.add(mesh(bodyGeo, plushMat('#ffffff', { vertexColors: true, name: 'pig_body_mat', sheenColor: '#ffe0ea' }), 'pig_body'));

  // 圆润粉红猪头（自然贴合脖子）
  const head = (nodes.head = pivot('pig_head', base, 0, 0.086, 0.007));
  const headC = new THREE.Vector3(0, 0.010, 0);
  const headGeo = blob({
    w: 28, h: 20,
    shape: (d) => {
      const cheek = Math.exp(-Math.pow((d.y + 0.20) / 0.38, 2)) * (1 - Math.abs(d.z)) * 0.0055;
      return new THREE.Vector3(d.x * 0.046 + Math.sign(d.x) * cheek, d.y * 0.042, d.z * 0.043);
    },
  });
  headGeo.translate(headC.x, headC.y, headC.z);
  const pinkPlush = plushMat(C.pink, { name: 'pig_pink_plush', sheenColor: '#ffe3ec' });
  const headMesh = mesh(headGeo, pinkPlush, 'pig_head_mesh');
  head.add(headMesh);

  // 更大更醒目的前折三角猪耳
  const earInnerMat = feltMat(C.snout, { name: 'pig_ear_inner', sheenColor: '#ffc6d8' });
  for (const s of [-1, 1]) {
    const ear = pivot(s < 0 ? 'pig_earL' : 'pig_earR', head, s * 0.032, 0.040, 0.003);
    ear.rotation.set(0.42, s * -0.18, s * -0.52);

    const earGeo = blob({
      w: 16, h: 12,
      shape: (d) => {
        const taper = 1 - 0.56 * smooth(-0.2, 1.0, d.y);
        const fold = smooth(0.15, 1.0, d.y) * 0.011;
        return new THREE.Vector3(d.x * 0.019 * taper, (d.y + 0.72) * 0.019, d.z * 0.0058 + fold);
      },
    });
    ear.add(mesh(earGeo, pinkPlush, `${ear.name}_outer`));

    const inGeo = blob({ rx: 0.0105, ry: 0.012, rz: 0.0022, w: 12, h: 8 });
    const im = mesh(inGeo, earInnerMat, `${ear.name}_inner`);
    im.position.set(0, 0.011, 0.0052);
    im.rotation.x = 0.28;
    im.castShadow = false;
    ear.add(im);

    nodes[s < 0 ? 'earL' : 'earR'] = ear;
  }

  // 标志性凸起椭圆形粉红猪鼻子 + 两个深莓果色竖椭圆鼻孔
  const snout = (nodes.snout = pivot('pig_snout', head, 0, 0.002, 0.041));
  const snoutGeo = blob({
    w: 20, h: 14,
    shape: (d) => {
      const flatFront = d.z > 0.55 ? 0.55 + (d.z - 0.55) * 0.35 : d.z;
      return new THREE.Vector3(d.x * 0.020, d.y * 0.0145, flatFront * 0.013);
    },
  });
  snout.add(mesh(snoutGeo, feltMat(C.snout, { name: 'pig_snout_mat', sheenColor: '#ffc8da' }), 'pig_snout_mesh'));

  const nostrilMat = beadMat(C.nostril);
  for (const s of [-1, 1]) {
    const nos = mesh(new THREE.SphereGeometry(0.0038, 10, 8), nostrilMat, `pig_nostril_${s}`);
    nos.scale.set(0.75, 1.25, 0.45);
    nos.position.set(s * 0.0068, 0.0005, 0.0098);
    nos.castShadow = false;
    snout.add(nos);
  }

  // 眼睛、开心小嘴、外侧腮红
  const [eL, eR] = faceDirs(FWD, [[-0.40, 0.17], [0.40, 0.17]]);
  nodes.eyeL = addEye(head, headMesh, headC, eL, { r: 0.0065, name: 'pig_eyeL' });
  nodes.eyeR = addEye(head, headMesh, headC, eR, { r: 0.0065, name: 'pig_eyeR' });
  addStitch(head, headMesh, headC, faceDirs(FWD, smileArc(0.14, 0.055, -0.28, 10)), { r: 0.001, color: '#6b2a42', name: 'pig_mouth' });
  const [bL, bR] = faceDirs(FWD, [[-0.65, -0.06], [0.65, -0.06]]);
  addBlush(head, headMesh, headC, bL, { rx: 0.0086, ry: 0.0056, color: C.blush, name: 'pig_blushL' });
  addBlush(head, headMesh, headC, bR, { rx: 0.0086, ry: 0.0056, color: C.blush, name: 'pig_blushR' });

  // 胖手臂 + 坐姿后腿（柔和粉莓小蹄子）
  const hoofMat = feltMat(C.hoof, { name: 'pig_hoof_mat', useNormal: false });
  const armGeo = blob({ rx: 0.013, ry: 0.020, rz: 0.013, w: 12, h: 8 });
  for (const s of [-1, 1]) {
    const arm = pivot(s < 0 ? 'pig_armL' : 'pig_armR', base, s * 0.045, 0.052, 0.010);
    arm.rotation.set(-0.35, 0, s * 0.42);
    const am = mesh(armGeo, pinkPlush, `${arm.name}_mesh`);
    am.position.y = -0.008;
    arm.add(am);
    const hoof = mesh(new THREE.SphereGeometry(0.0088, 10, 8), hoofMat, `${arm.name}_hoof`);
    hoof.scale.set(0.95, 0.58, 0.95);
    hoof.position.y = -0.024;
    arm.add(hoof);
    nodes[s < 0 ? 'armL' : 'armR'] = arm;
  }

  const legGeo = blob({ rx: 0.016, ry: 0.015, rz: 0.019, w: 14, h: 10 });
  for (const s of [-1, 1]) {
    const leg = pivot(s < 0 ? 'pig_legL' : 'pig_legR', base, s * 0.026, 0.015, 0.032);
    leg.rotation.y = s * -0.22;
    leg.add(mesh(legGeo, pinkPlush, `${leg.name}_mesh`));
    const hoof = mesh(new THREE.SphereGeometry(0.0092, 10, 8), hoofMat, `${leg.name}_hoof`);
    hoof.scale.set(0.88, 0.78, 0.36);
    hoof.position.set(0, -0.001, 0.0178);
    leg.add(hoof);
    nodes[s < 0 ? 'legL' : 'legR'] = leg;
  }

  // 标志性螺旋卷曲小猪尾巴
  const tail = (nodes.tail = pivot('pig_tail', base, 0, 0.028, -0.046));
  const tailPts = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const a = t * Math.PI * 2.6;
    const r = 0.0075 * (1 - 0.35 * t);
    tailPts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r + t * 0.008, -t * 0.018));
  }
  tail.add(mesh(tube(tailPts, 0.0032, { tubular: 20, radial: 6 }), pinkPlush, 'pig_tail_mesh'));

  const clips = bakeClips(nodes, (rig, clip, t, u) => {
    const cyc = u * Math.PI * 2;
    let squash = 1, hop = 0, headRoll = 0, earWig = 0, snoutWig = 0, armWave = 0, legKick = 0;
    if (clip === 'idle') {
      squash = 1 + Math.sin(cyc) * 0.026;
      earWig = Math.sin(cyc * 2) * 0.10;
      snoutWig = Math.sin(cyc * 2) * 0.06;
      headRoll = Math.sin(cyc) * 0.06;
    } else if (clip === 'touch') {
      const k = animEase.wobble(u, 2.5, 4);
      squash = 1 - 0.17 * k;
      earWig = 0.38 * animEase.bell(u);
    } else if (clip === 'lifted') {
      squash = 1.08;
      earWig = Math.sin(cyc * 4) * 0.28;
      armWave = 0.45 + Math.sin(cyc * 4) * 0.28;
      legKick = Math.sin(cyc * 4) * 0.36;
      headRoll = Math.sin(cyc * 2) * 0.12;
    } else if (clip === 'land') {
      const k = animEase.wobble(u, 2.6, 4.4);
      squash = 1 - 0.20 * k;
      earWig = 0.28 * animEase.bell(u);
    } else if (clip === 'celebrate') {
      hop = Math.abs(Math.sin(cyc * 2)) * 0.018;
      earWig = Math.sin(cyc * 6) * 0.30;
      armWave = 0.7 + Math.sin(cyc * 4) * 0.32;
      headRoll = Math.sin(cyc * 2) * 0.16;
    }
    rig.move('base', 0, hop, 0);
    rig.squash('base', squash);
    rig.rot('head', 0, 0, headRoll);
    rig.rot('earL', earWig * 0.5, 0, earWig);
    rig.rot('earR', earWig * 0.5, 0, -earWig);
    rig.scl('snout', 1 + snoutWig, 1 - snoutWig * 0.5, 1);
    rig.rot('armL', -armWave * 0.5, 0, -armWave * 0.4);
    rig.rot('armR', -armWave * 0.5, 0, armWave * 0.4);
    rig.rot('legL', legKick, 0, 0);
    rig.rot('legR', -legKick, 0, 0);
    rig.rot('tail', 0, 0, Math.sin(cyc * 3) * 0.35);
    applyBlink(rig, blinkAt(clip, t, u));
  });

  return { root, clips };
}

// ============================================================================
// 6. 浅蓝色大象 🐘 (elephant)
// ============================================================================
export function buildElephant() {
  const root = new THREE.Group();
  root.name = 'haiz.animal.elephant';
  const nodes = {};
  const base = (nodes.base = pivot('elephant_base', root));

  const C = {
    blue: '#70c2ea',
    belly: '#edf6fc',
    earInner: '#f7d2de',
    blush: '#f59eb0',
    nail: '#f3f7fb',
    tailTip: '#4893c2',
  };

  // 圆润敦实浅蓝大象身体 + 淡蓝奶白肚皮
  const bodyC = new THREE.Vector3(0, 0.045, -0.004);
  const bodyGeo = blob({
    w: 28, h: 20,
    shape: (d) => {
      const pear = 1 + 0.14 * Math.max(0, -d.y);
      const p = new THREE.Vector3(d.x * 0.047 * pear, d.y * 0.044, d.z * 0.046 * pear);
      if (d.y < -0.78) p.y = -0.044 * (0.78 + (Math.abs(d.y) - 0.78) * 0.24);
      return p;
    },
  });
  bodyGeo.translate(bodyC.x, bodyC.y, bodyC.z);
  paint(bodyGeo, (p) => {
    const b = smooth(0.038, 0.016, Math.hypot(p.x * 1.2, (p.y - 0.039) * 1.05, p.z - 0.042));
    return lin(C.blue).lerp(lin(C.belly), b);
  });
  base.add(mesh(bodyGeo, plushMat('#ffffff', { vertexColors: true, name: 'elephant_body_mat', sheenColor: '#d9f0ff' }), 'elephant_body'));

  // 头部
  const head = (nodes.head = pivot('elephant_head', base, 0, 0.087, 0.008));
  const headC = new THREE.Vector3(0, 0.011, 0);
  const headGeo = blob({
    w: 28, h: 20,
    shape: (d) => {
      const brow = d.y > 0.25 ? 1.03 : 1.0;
      return new THREE.Vector3(d.x * 0.043 * brow, d.y * 0.041, d.z * 0.042);
    },
  });
  headGeo.translate(headC.x, headC.y, headC.z);
  const bluePlush = plushMat(C.blue, { name: 'elephant_blue_plush', sheenColor: '#d8f1ff' });
  const headMesh = mesh(headGeo, bluePlush, 'elephant_head_mesh');
  head.add(headMesh);

  // 标志性一对宽大柔和蒲扇耳（浅蓝外层 + 温柔淡粉内耳，宽度适配六玩偶并排不穿模）
  const earInnerMat = feltMat(C.earInner, { name: 'elephant_ear_inner', sheenColor: '#fff0f5' });
  for (const s of [-1, 1]) {
    const ear = pivot(s < 0 ? 'elephant_earL' : 'elephant_earR', head, s * 0.034, 0.015, -0.006);
    ear.rotation.set(0.06, s * -0.28, s * -0.06);

    const earGeo = blob({
      w: 18, h: 14,
      shape: (d) => {
        const topBroad = 1 + 0.15 * smooth(-0.2, 0.7, d.y);
        const cup = Math.pow(Math.max(0, s * d.x), 1.4) * 0.006;
        return new THREE.Vector3(
          (d.x + s * 0.70) * 0.0225 * topBroad,
          d.y * 0.0295,
          d.z * 0.0058 + cup
        );
      },
    });
    ear.add(mesh(earGeo, bluePlush, `${ear.name}_outer`));

    const inGeo = blob({
      w: 14, h: 12,
      shape: (d) => new THREE.Vector3((d.x + s * 0.70) * 0.017, d.y * 0.0215, d.z * 0.0026),
    });
    const im = mesh(inGeo, earInnerMat, `${ear.name}_inner`);
    im.position.set(s * 0.002, -0.001, 0.0050);
    im.castShadow = false;
    ear.add(im);

    nodes[s < 0 ? 'earL' : 'earR'] = ear;
  }

  // 标志性俏皮 J 形长象鼻（向下伸展再微翘微斜，正面完全不遮挡双眼且轮廓一眼辨认！）
  const trunk = (nodes.trunk = pivot('elephant_trunk', head, 0, -0.001, 0.037));
  const trunkPts = [
    new THREE.Vector3(0, 0.003, -0.004),
    new THREE.Vector3(0.001, -0.006, 0.012),
    new THREE.Vector3(0.004, -0.016, 0.026),
    new THREE.Vector3(0.008, -0.015, 0.040),
    new THREE.Vector3(0.010, -0.005, 0.047),
    new THREE.Vector3(0.009, 0.005, 0.044),
  ];
  const trunkGeo = taperedTube(
    trunkPts,
    (t) => 0.0132 * (1 - 0.44 * t) + Math.sin(t * Math.PI * 6) * 0.0005,
    { tubular: 20, radial: 10, capEnd: true }
  );
  trunk.add(mesh(trunkGeo, bluePlush, 'elephant_trunk_mesh'));

  const tip = mesh(new THREE.SphereGeometry(0.0065, 10, 8), feltMat(C.earInner, { name: 'elephant_trunk_tip', useNormal: false }), 'elephant_trunk_tip');
  tip.scale.set(1.0, 0.75, 0.65);
  tip.position.set(0.009, 0.0058, 0.0435);
  trunk.add(tip);

  // 温暖大眼与粉色腮红
  const [eL, eR] = faceDirs(FWD, [[-0.40, 0.18], [0.40, 0.18]]);
  nodes.eyeL = addEye(head, headMesh, headC, eL, { r: 0.0066, name: 'elephant_eyeL' });
  nodes.eyeR = addEye(head, headMesh, headC, eR, { r: 0.0066, name: 'elephant_eyeR' });
  const [bL, bR] = faceDirs(FWD, [[-0.58, -0.06], [0.58, -0.06]]);
  addBlush(head, headMesh, headC, bL, { rx: 0.0085, ry: 0.0055, color: C.blush, name: 'elephant_blushL' });
  addBlush(head, headMesh, headC, bR, { rx: 0.0085, ry: 0.0055, color: C.blush, name: 'elephant_blushR' });

  // 短手臂 + 坐姿粗壮小象腿（带奶白小脚趾甲点缀）
  const armGeo = blob({ rx: 0.013, ry: 0.020, rz: 0.013, w: 12, h: 8 });
  for (const s of [-1, 1]) {
    const arm = pivot(s < 0 ? 'elephant_armL' : 'elephant_armR', base, s * 0.043, 0.052, 0.010);
    arm.rotation.set(-0.32, 0, s * 0.36);
    const am = mesh(armGeo, bluePlush, `${arm.name}_mesh`);
    am.position.y = -0.008;
    arm.add(am);
    nodes[s < 0 ? 'armL' : 'armR'] = arm;
  }

  const legGeo = blob({ rx: 0.017, ry: 0.016, rz: 0.0195, w: 14, h: 10 });
  const nailMat = feltMat(C.nail, { name: 'elephant_nail', useNormal: false });
  for (const s of [-1, 1]) {
    const leg = pivot(s < 0 ? 'elephant_legL' : 'elephant_legR', base, s * 0.025, 0.016, 0.032);
    leg.rotation.y = s * -0.22;
    leg.add(mesh(legGeo, bluePlush, `${leg.name}_mesh`));
    for (const dx of [-0.0058, 0, 0.0058]) {
      const nail = mesh(new THREE.SphereGeometry(0.0030, 8, 6), nailMat, `${leg.name}_nail`);
      nail.scale.set(1.0, 0.85, 0.42);
      nail.position.set(dx, -0.0055, 0.0182);
      nail.castShadow = false;
      leg.add(nail);
    }
    nodes[s < 0 ? 'legL' : 'legR'] = leg;
  }

  // 小尾巴
  const tail = pivot('elephant_tail', base, 0, 0.024, -0.044);
  const tGeo = tube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.006, -0.014)], 0.003, { tubular: 8, radial: 6 });
  tail.add(mesh(tGeo, bluePlush, 'elephant_tail_stem'));
  const tTuft = mesh(new THREE.SphereGeometry(0.0058, 10, 8), plushMat(C.tailTip, { name: 'elephant_tail_tuft' }), 'elephant_tail_tuft');
  tTuft.position.set(0, -0.007, -0.016);
  tail.add(tTuft);

  const clips = bakeClips(nodes, (rig, clip, t, u) => {
    const cyc = u * Math.PI * 2;
    let squash = 1, hop = 0, headRoll = 0, earFlap = 0, trunkBob = 0, armWave = 0, legKick = 0;
    if (clip === 'idle') {
      squash = 1 + Math.sin(cyc) * 0.022;
      earFlap = Math.sin(cyc) * 0.14;
      trunkBob = Math.sin(cyc) * 0.12;
      headRoll = Math.sin(cyc) * 0.05;
    } else if (clip === 'touch') {
      const k = animEase.wobble(u, 2.5, 4);
      squash = 1 - 0.15 * k;
      earFlap = 0.42 * animEase.bell(u);
      trunkBob = -0.35 * animEase.bell(u);
    } else if (clip === 'lifted') {
      squash = 1.07;
      earFlap = 0.25 + Math.sin(cyc * 3) * 0.34;
      trunkBob = Math.sin(cyc * 3) * 0.28;
      armWave = 0.35 + Math.sin(cyc * 3) * 0.24;
      legKick = Math.sin(cyc * 3) * 0.30;
      headRoll = Math.sin(cyc * 2) * 0.10;
    } else if (clip === 'land') {
      const k = animEase.wobble(u, 2.6, 4.4);
      squash = 1 - 0.18 * k;
      earFlap = 0.35 * animEase.bell(u);
    } else if (clip === 'celebrate') {
      hop = Math.abs(Math.sin(cyc * 2)) * 0.016;
      earFlap = 0.35 + Math.sin(cyc * 4) * 0.38;
      trunkBob = -0.35 + Math.sin(cyc * 4) * 0.25;
      headRoll = Math.sin(cyc * 2) * 0.12;
      armWave = 0.65 + Math.sin(cyc * 4) * 0.25;
    }
    rig.move('base', 0, hop, 0);
    rig.squash('base', squash);
    rig.rot('head', 0, 0, headRoll);
    rig.rot('earL', 0, earFlap, 0);
    rig.rot('earR', 0, -earFlap, 0);
    rig.rot('trunk', trunkBob, 0, headRoll * 0.6);
    rig.rot('armL', -armWave * 0.5, 0, -armWave * 0.35);
    rig.rot('armR', -armWave * 0.5, 0, armWave * 0.35);
    rig.rot('legL', legKick, 0, 0);
    rig.rot('legR', -legKick, 0, 0);
    applyBlink(rig, blinkAt(clip, t, u));
  });

  return { root, clips };
}

export const BUILDERS = Object.freeze({
  duck: buildDuck,
  panda: buildPanda,
  fox: buildFox,
  frog: buildFrog,
  pig: buildPig,
  elephant: buildElephant,
});
