/* ============================================================
   海南中学府城校区 · 3D 数字校园
   Three.js r128 · 数据驱动 · 平面图还原
   ------------------------------------------------------------
   方位：原平面图经 OCR 实证为「上南下北」。本文件只做垂直翻转，
        worldX = (px-OX)*S   (px 增大 = 东)
        worldZ = -(py-OY)*S  (py 增大 = 北 → worldZ 减小)
   ============================================================ */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ================= 时间 / 天气 ================= */
  var TIMES = [
    { label: '06:00', sunY: 0.13, sunX: -0.88, sunZ: 0.34, top: '#2c4d6d', bot: '#dfa87c', fog: '#8b9ba8', hemi: 0.60, dir: 0.80, sun: '#ffd6a6', amb: 0.28 },
    { label: '09:00', sunY: 0.56, sunX: -0.58, sunZ: 0.56, top: '#4a90c2', bot: '#cfe3ed', fog: '#bdd4df', hemi: 0.92, dir: 1.12, sun: '#fff3e0', amb: 0.40 },
    { label: '12:00', sunY: 0.80, sunX: 0.10, sunZ: 0.26, top: '#3e8dc2', bot: '#c4d9e4', fog: '#c8d9e2', hemi: 0.92, dir: 1.12, sun: '#ffffff', amb: 0.38 },
    { label: '16:00', sunY: 0.50, sunX: 0.60, sunZ: -0.44, top: '#4c8dba', bot: '#e9dcc4', fog: '#d0d8da', hemi: 0.86, dir: 1.06, sun: '#ffe8c6', amb: 0.38 },
    { label: '18:30', sunY: 0.09, sunX: 0.94, sunZ: -0.26, top: '#3a4f76', bot: '#ee9f5e', fog: '#c3a187', hemi: 0.56, dir: 0.92, sun: '#ffb06a', amb: 0.27 },
    { label: '21:00', sunY: 0.33, sunX: -0.38, sunZ: -0.70, top: '#0d1f34', bot: '#1b394f', fog: '#15283a', hemi: 0.33, dir: 0.15, sun: '#9dbad4', amb: 0.19 }
  ];
  var WEATHER = {
    clear:  { fog: 0.0009, hemiK: 1.00, dirK: 1.00, rain: false, groundRough: 0.94, label: '晴' },
    cloudy: { fog: 0.0028, hemiK: 1.16, dirK: 0.50, rain: false, groundRough: 0.90, label: '多云' },
    rain:   { fog: 0.0045, hemiK: 0.85, dirK: 0.32, rain: true,  groundRough: 0.36, label: '雨' }
  };

  var state = { time: 3, night: false, weather: 'clear', quality: 'high', selected: null, touring: false, tourPaused: false, tourIdx: 0 };
  var QCFG = {
    high:     { alias: true,  shadow: 2048, treeK: 1.00, dpr: 2.0, rain: 1400, lamps: true,  aniso: 8, winK: 1.00 },
    balanced: { alias: true,  shadow: 1024, treeK: 0.72, dpr: 1.5, rain: 700,  lamps: true,  aniso: 4, winK: 0.85 },
    low:      { alias: false, shadow: 0,    treeK: 0.42, dpr: 1.0, rain: 0,    lamps: false, aniso: 1, winK: 0.65 }
  };

  /* 自适应像素比下限：即便掉帧也不低于此值，避免画面糊到不可用 */
  var DPR_FLOOR = { high: 1.0, balanced: 0.9, low: 0.75 };

  /* ===== 帧率监控：连续掉帧时自动降像素比（最省算力的一档降级） ===== */
  var adapt = {
    samples: 0, acc: 0, ratio: 1, baseDpr: 1, floor: 1,
    cool: 0,               // 冷却帧数，避免抖动式反复降级
    fps: 0, downgrades: 0
  };
  var FPS_FLOOR = 46;      // 低于此帧率视为掉帧
  var SAMPLE_WIN = 45;     // 采样窗口（帧）

  function adaptReset(cfg) {
    adapt.samples = 0; adapt.acc = 0; adapt.cool = 90;
    adapt.baseDpr = Math.min(window.devicePixelRatio || 1, cfg.dpr);
    adapt.floor = Math.max(DPR_FLOOR[state.quality] || 0.75, 0.6);
    adapt.ratio = adapt.baseDpr;
  }

  function adaptStep(dt) {
    // 冷却期内不采样，让上一档降级的效果先稳定下来
    if (adapt.cool > 0) { adapt.cool--; return; }
    if (dt <= 0) return;
    adapt.acc += dt; adapt.samples++;
    if (adapt.samples < SAMPLE_WIN) return;
    var fps = adapt.samples / adapt.acc;
    adapt.samples = 0; adapt.acc = 0;
    adapt.fps = Math.round(fps);

    if (fps < FPS_FLOOR && adapt.ratio > adapt.floor + 0.02) {
      // 按比例下调，单次最多降 15%，防止画面分辨率突变
      adapt.ratio = Math.max(adapt.floor, adapt.ratio * 0.85);
      renderer.setPixelRatio(adapt.ratio);
      adapt.cool = 120;
      adapt.downgrades++;
      window.dispatchEvent(new CustomEvent('hms3d:perf', {
        detail: { fps: adapt.fps, ratio: adapt.ratio, downgrades: adapt.downgrades }
      }));
    } else if (fps > FPS_FLOOR + 22 && adapt.ratio < adapt.baseDpr - 0.02) {
      // 余量充足时缓慢回升，上限为档位对应的 baseDpr
      adapt.ratio = Math.min(adapt.baseDpr, adapt.ratio * 1.06);
      renderer.setPixelRatio(adapt.ratio);
      adapt.cool = 150;
    }
  }
  function detectQuality() {
    var cores = navigator.hardwareConcurrency || 4;
    var mem = navigator.deviceMemory || 4;
    var mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    // 触屏/移动设备默认不进 high：高分阴影 + 2x 像素比在手机上几乎必然掉帧
    if (mobile) {
      if (cores <= 4 || mem <= 4) return 'low';
      if (cores <= 6 || mem <= 6) return 'low';
      return 'balanced';
    }
    if (cores <= 4 || mem <= 4) return 'low';
    if (cores <= 8) return 'balanced';
    return 'high';
  }

  var scene, camera, renderer, controls, raycaster, pointer, clock;
  var sunLight, hemiLight, ambLight, skyMesh, rainSys, starMesh;
  var groundMat, roadMats = [], waterMat, fieldMat;
  var buildingMeshes = [], hitMeshes = [], poiEls = [], lampLamps = [], treeMeshes = [];
  // 【v13 新增】占地表：建筑/水体的世界坐标包围盒，供路灯等小品避让使用
  var OCCUPIED = [];
  var data = null, loaded = false, flying = false, frameId = 0;
  var lastCamPos = new THREE.Vector3(1e9, 1e9, 1e9);
  var lastCamTarget = new THREE.Vector3();
  var interacting = false, interactFrames = 0, idleFrames = 0;
  var starActive = false;   // 星体动画仅在需要时开启
  var poiSig = '';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TF = { ox: 900, oy: 784, s: 0.167 };

  /* ================= 坐标变换 ================= */
  function wx(px) { return (px - TF.ox) * TF.s; }
  function wz(py) { return -(py - TF.oy) * TF.s; }
  function rectWorld(r) {
    var x0 = wx(Math.min(r[0], r[2])), x1 = wx(Math.max(r[0], r[2]));
    var z0 = wz(Math.max(r[1], r[3])), z1 = wz(Math.min(r[1], r[3]));
    return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 };
  }

  /* 【v13 新增】占地登记与避让查询
     ------------------------------------------------------------------
     背景：校道数据里的 rect 是「大块铺装区域」而非细长车道，
     按道路中线成列布灯时，灯杆会成排穿过教学楼、宿舍与水面
     （实测 99 个灯位中有 350 处落在建筑包围盒内、4 处落在水里）。
     为此建立一张占地表，任何贴地小品布点前先做一次包含判定。 */
  function markOccupied(x, z, w, d, tag) {
    OCCUPIED.push({ x: x, z: z, hw: w / 2, hd: d / 2, tag: tag || '' });
  }
  // 矩形占地：外扩 m 米后，点是否落入
  function isOccupied(x, z, m) {
    var mm = m || 0;
    for (var i = 0; i < OCCUPIED.length; i++) {
      var o = OCCUPIED[i];
      if (Math.abs(x - o.x) <= o.hw + mm && Math.abs(z - o.z) <= o.hd + mm) return true;
    }
    return false;
  }

  /* ================= 材质库（低饱和 · 真实建筑） ================= */
  function M(color, rough, metal, opts) {
    var o = { color: new THREE.Color(color), roughness: rough == null ? 0.9 : rough, metalness: metal || 0.0 };
    if (opts) for (var k in opts) o[k] = opts[k];
    return new THREE.MeshStandardMaterial(o);
  }
  var MAT = null;
  function buildMaterials() {
    MAT = {
      // 墙体（低明度、暖灰，避免过曝）
      wallCream:  M('#c8bfa8', 0.93),
      wallPutty:  M('#bfb6a0', 0.94),
      wallGrey:   M('#b5afa0', 0.92),
      wallHerit:  M('#d4c9b0', 0.95),       // 历史建筑墙面（略暖、做旧）
      plinth:     M('#948f84', 0.96),       // 勒脚
      baseStone:  M('#3a3a3a', 0.90),       // 【实拍纠正】教学楼深灰色石材基座（整层）
      wallLight:  M('#e8e4dc', 0.93),       // 【实拍纠正】浅灰白主墙面（替代 wallCream）
      glassTeal:  M('#4A90A2', 0.12, 0.10, { transparent: true, opacity: 0.88 }), // 【实拍纠正】蓝绿色玻璃
      roofPorch:  M('#B22222', 0.88),       // 【实拍纠正】门廊中式红色坡屋顶
      // 屋顶
      roofFlat:   M('#918d84', 0.95),
      parapet:    M('#a9a49a', 0.92),
      roofTile:   M('#46544d', 0.88),       // 现代坡顶瓦
      roofRed:    M('#9d4a3a', 0.90),       // 【航拍实证】教学楼红色坡顶瓦
      ridgeRed:   M('#7d3a2e', 0.86),       // 【航拍实证】红瓦屋脊
      roofHerit:  M('#3f6051', 0.84),       // 【航拍实证】历史建筑绿色琉璃瓦
      ridge:      M('#5d6b64', 0.84),
      // 构件
      column:     M('#8c4f3e', 0.86),       // 朱红柱
      columnPink: M('#c4837c', 0.86),       // 【航拍实证】历史建筑粉红柱廊
      columnGrey: M('#bdb8ad', 0.92),
      whiteGate:  M('#f2ece3', 0.55, 0.02), // 北门汉白玉门柱（参考照片）
      goldLine:   M('#c9a35a', 0.45, 0.35),  // 北门金色装饰线（参考照片）
      beam:       M('#8a5a45', 0.88),
      frame:      M('#54685a', 0.62, 0.15), // 【航拍实证】窗框（绿色）
      glass:      M('#6f8798', 0.14, 0.10, { transparent: true, opacity: 0.86 }),
      glassDark:  M('#4d5f51', 0.12, 0.12, { transparent: true, opacity: 0.92 }), // 【航拍实证】窗框呈绿色（窗洞走 InstancedMesh 批量渲染）
      door:       M('#6b5541', 0.84),
      step:       M('#b6b0a5', 0.95),
      // 地面
      asphalt:    M('#85827a', 0.94),
      concrete:   M('#aca69d', 0.95),
      paving:     M('#b6b0a4', 0.93),
      grass:      M('#4b7a3b', 0.97),
      grassDark:  M('#3a6330', 0.97),
      earth:      M('#7a6a52', 0.97),
      water:      M('#5c7f86', 0.06, 0.20, { transparent: true, opacity: 0.90 }),
      poolEdge:   M('#a9a49a', 0.94),
      trackRed:   M('#a8503c', 0.95),       // 【航拍实证】塑胶跑道为红色
      trackGreen: M('#4c7048', 0.96),       // 场内人造草皮
      // 植被
      trunk:      M('#6e5c46', 0.97),
      trunkPalm:  M('#7a6750', 0.96),
      leafA:      M('#2f6b3d', 0.94, 0, { flatShading: true }),
      leafB:      M('#3a7a48', 0.94, 0, { flatShading: true }),
      leafC:      M('#255e35', 0.95, 0, { flatShading: true }),
      leafDry:    M('#6d7a48', 0.95, 0, { flatShading: true }),
      // 景石（官网：芝麻白 / 海南黑石料）
      rockGray:   M('#a9a59c', 0.93),       // 太湖石（芝麻白偏灰）
      rockDark:   M('#6d716f', 0.92),       // 太湖石孔洞暗部
      rockBase:   M('#3f4346', 0.90),       // 基座（海南黑）
      // 草坪（官网：台湾草）
      grassTaiwan: M('#5f8c42', 0.97),
      // 其他
      stone:      M('#a5a19a', 0.95),
      bronze:     M('#7d6a4a', 0.48, 0.62),
      marble:     M('#c9c5bd', 0.72),
      metalDark:  M('#4c5359', 0.62, 0.30)
    };
  }

  /* ================= 几何工具 ================= */
  var _v4 = new THREE.Vector4();
  function box(w, h, d, mat, x, y, z, parent) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true; m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  }
  function plane(w, d, mat, x, y, z, parent, rotX) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = rotX == null ? -Math.PI / 2 : rotX;
    m.position.set(x || 0, y || 0, z || 0);
    m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  }
  // 双面三角面片（用于戗脊三角形坡面）
  function triPatch(a, b, c, mat) {
    var geo = new THREE.BufferGeometry();
    var t = [a, b, c, a, c, b];          // 正反两套绕序 → 两面均可见
    var v = new Float32Array(18);
    for (var i = 0; i < 6; i++) {
      v[i * 3] = t[i][0]; v[i * 3 + 1] = t[i][1]; v[i * 3 + 2] = t[i][2];
    }
    geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
    geo.computeVertexNormals();
    var m = new THREE.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  // 四坡屋顶（庑殿/歇山）：前后两片梯形坡面 + 左右两片三角形戗脊坡面 + 正脊
  // 【v10 关键修复】屋檐/戗脊尺寸只由「进深 d + 挑檐 overhang」决定，与楼宽 w 无关。
  //   修复前左右端片以 ow/2 作坡长，楼越长外伸越夸张（一号 116m 竟外伸 58m，三号 36m 仅 18m）。
  // 【v13 关键修复】坡面绕 X 轴旋转方向反了：屋脊端落在 y=0、檐口端落在 y=h，
  //   整个屋顶「倒扣」且与外墙穿插。修正为 rotation.x = +s * pitch，
  //   使屋脊端(y=h, z=0) 与檐口端(y=0, z=s*run) 各自归位。
  function hipRoof(w, d, h, overhang, mat, ridgeMat) {
    var g = new THREE.Group();
    var o = overhang;
    var ow = w + o * 2, od = d + o * 2;
    var ridgeLen = Math.max(0.6, ow - od);   // 正脊长度（45° 戗脊）
    var run = (ow - ridgeLen) / 2;           // 坡面水平投影，恒满足 ridgeLen + 2*run = ow
    var slopeLen = Math.sqrt(run * run + h * h);
    var pitch = Math.atan2(h, run);
    // 前后两片梯形坡面（box 近似，旋转）：中心置于坡面中点 (0, h/2, s*run/2)
    // 旋转符号必须为 +s：使 z=-slopeLen/2 端落在屋脊 (y=h, z=0)、
    // z=+slopeLen/2 端落在檐口 (y=0, z=s*run)。
    [-1, 1].forEach(function (s) {
      var p = box(ridgeLen, 0.34, slopeLen, mat, 0, h / 2, s * run / 2, g);
      p.rotation.x = s * pitch;
    });
    // 左右两片三角形戗脊坡面（真三角形，尺寸与楼宽无关）
    [-1, 1].forEach(function (s) {
      var xe = s * ow / 2, xr = s * ridgeLen / 2;
      g.add(triPatch([xe, 0, -od / 2], [xe, 0, od / 2], [xr, h, 0], mat));
    });
    if (ridgeMat) box(ridgeLen + 0.8, 0.42, 0.7, ridgeMat, 0, h + 0.1, 0, g);
    g.position.y = 0;
    return g;
  }
  // 简单双坡屋顶
  // 【v13 同源修复】与 hipRoof 相同的旋转符号错误：屋脊/檐口高度颠倒。
  //   坡面中心 (0, h/2, s*od/4)，旋转 +s*pitch 后
  //   z=-sl/2 端归到屋脊 (y=h,z=0)，z=+sl/2 端归到檐口 (y=0,z=s*od/2)。
  function gableRoof(w, d, h, overhang, mat, ridgeMat) {
    var g = new THREE.Group();
    var ow = w + overhang * 2, od = d + overhang * 2;
    var sl = Math.sqrt(Math.pow(od / 2, 2) + h * h);
    [-1, 1].forEach(function (s) {
      var p = box(ow, 0.3, sl, mat, 0, h / 2, s * od / 4, g);
      p.rotation.x = s * Math.atan2(h, od / 2);
    });
    if (ridgeMat) box(ow + 0.5, 0.4, 0.6, ridgeMat, 0, h + 0.05, 0, g);
    return g;
  }
  // 女儿墙（平屋顶压顶）
  function parapet(w, d, h, thick, mat, capMat) {
    var g = new THREE.Group();
    var t = thick;
    box(w, h, t, mat, 0, h / 2, d / 2 - t / 2, g);
    box(w, h, t, mat, 0, h / 2, -d / 2 + t / 2, g);
    box(t, h, d - t * 2, mat, w / 2 - t / 2, h / 2, 0, g);
    box(t, h, d - t * 2, mat, -w / 2 + t / 2, h / 2, 0, g);
    if (capMat) {
      box(w + 0.24, 0.22, t + 0.24, capMat, 0, h + 0.11, d / 2 - t / 2, g);
      box(w + 0.24, 0.22, t + 0.24, capMat, 0, h + 0.11, -d / 2 + t / 2, g);
      box(t + 0.24, 0.22, d, capMat, w / 2 - t / 2, h + 0.11, 0, g);
      box(t + 0.24, 0.22, d, capMat, -w / 2 + t / 2, h + 0.11, 0, g);
    }
    return g;
  }

  /* ================= 窗 / 门 批量（InstancedMesh） ================= */
  var winQueue = { hole: [], glass: [] };
  var _dummy = new THREE.Object3D();
  function queueWindow(x, y, z, w, h, axis, depth, glassMat) {
    winQueue.hole.push({ x: x, y: y, z: z, w: w, h: h, a: axis, d: depth || 0.18 });
    winQueue.glass.push({ x: x, y: y, z: z, w: w, h: h, a: axis, d: (depth || 0.18) * 0.55, mat: glassMat || null });
  }
  function flushWindows(root, cfg) {
    if (!winQueue.hole.length) return;
    // 【v13 修复】此前以 cap 直接截断队列前缀（high=4000 / 其余=2600），
    //   而 queue 是按建筑顺序写入的 —— 一旦超出上限，被砍掉的是「排在后面的整栋楼」，
    //   表现为部分建筑完全没有窗户，比均匀降密难看得多。
    //   改为按 winK 做等距抽样：数量降下来，但全校每栋楼都保留窗户。
    var all = winQueue.hole.length;
    var winK = (cfg && cfg.winK != null) ? cfg.winK : 1;
    var step = winK >= 1 ? 1 : 1 / Math.max(winK, 0.05);
    var idx = [];
    if (step <= 1) {
      for (var q = 0; q < all; q++) idx.push(q);
    } else {
      // step 为浮点时 q2 也是浮点，必须取整后再作数组下标，
      // 否则 winQueue.hole[1.18] 取到 undefined 直接崩溃。
      for (var q2 = 0; q2 < all; q2 += step) idx.push(Math.floor(q2));
    }
    var n = idx.length;
    var gHole = new THREE.BoxGeometry(1, 1, 1);
    var imHole = new THREE.InstancedMesh(gHole, MAT.glassDark, n);
    for (var i = 0; i < n; i++) {
      var a = winQueue.hole[idx[i]];
      _dummy.position.set(a.x, a.y, a.z);
      _dummy.rotation.set(0, a.a === 'z' ? 0 : Math.PI / 2, 0);
      _dummy.scale.set(a.a === 'z' ? a.w : a.d, a.h, a.a === 'z' ? a.d : a.w);
      _dummy.updateMatrix();
      imHole.setMatrixAt(i, _dummy.matrix);
    }
    /* 【实拍纠正】玻璃按材质分组：教学楼使用蓝绿玻璃，其余建筑沿用默认玻璃 */
    var grpList = [], grpIdx = {};
    for (var j = 0; j < n; j++) {
      var b = winQueue.glass[idx[j]];
      if (!b) continue;
      var mkey = b.mat ? b.mat.uuid : '_def';
      if (grpIdx[mkey] === undefined) {
        grpIdx[mkey] = grpList.length;
        grpList.push({ mat: b.mat || MAT.glass, items: [] });
      }
      grpList[grpIdx[mkey]].items.push(b);
    }
    grpList.forEach(function (grp) {
      var imGlass = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), grp.mat, grp.items.length);
      for (var k = 0; k < grp.items.length; k++) {
        var a2 = grp.items[k];
        _dummy.position.set(a2.x, a2.y, a2.z);
        _dummy.rotation.set(0, a2.a === 'z' ? 0 : Math.PI / 2, 0);
        _dummy.scale.set(a2.a === 'z' ? a2.w * 0.97 : a2.d, a2.h * 0.96, a2.a === 'z' ? a2.d : a2.w * 0.97);
        _dummy.updateMatrix();
        imGlass.setMatrixAt(k, _dummy.matrix);
      }
      imGlass.instanceMatrix.needsUpdate = true;
      imGlass.castShadow = false; imGlass.receiveShadow = false;
      root.add(imGlass);
    });
    imHole.instanceMatrix.needsUpdate = true;
    imHole.castShadow = false; imHole.receiveShadow = false;
    root.add(imHole);
    winQueue.hole.length = 0; winQueue.glass.length = 0;
  }
  // 沿一面墙排布窗洞
  function windowRow(len, y, h, winW, gap, z, axis, side, zOff, glassMat) {
    var n = Math.max(1, Math.floor((len - gap) / (winW + gap)));
    var total = n * winW + (n - 1) * gap;
    var start = -total / 2 + winW / 2;
    for (var i = 0; i < n; i++) {
      var p = start + i * (winW + gap);
      if (axis === 'z') queueWindow(p, y, z + (side || 1) * (zOff || 0), winW, h, 'z', undefined, glassMat);
      else queueWindow(z + (side || 1) * (zOff || 0), y, p, winW, h, 'x', undefined, glassMat);
    }
    return n;
  }

  /* ================= 建筑形态（每种独立实现） ================= */
  var FORMS = {};

  /* --- 教学楼（实拍纠正版）：深灰石材基座 + 浅灰白墙面 + 蓝绿玻璃 + 中式门廊 --- */
  FORMS.academic = function (g, b, o) {
    var w = b.size[0], d = b.size[2], H = b.size[1], f = b.floors, fh = b.floorH;
    var corridor = 2.0, corridorSide = -1;             // 外廊在 -Z 侧
    // 【实拍纠正】深灰色石材基座（整层高度，非单薄勒脚）
    box(w + 0.4, fh, d + 0.4, MAT.baseStone, 0, fh / 2, 0, g);
    // 【实拍纠正】浅灰白主墙体（基座之上）
    var bodyH = H - fh;
    var body = box(w, bodyH, d, MAT.wallLight, 0, fh + bodyH / 2, 0, g);
    body.name = 'body';
    // 基座顶部收边线
    box(w + 0.3, 0.15, d + 0.3, MAT.wallGrey, 0, fh + 0.075, 0, g);
    // 楼层线（腰线，略微出挑）——从基座顶开始算
    for (var i = 1; i < f; i++) {
      box(w + 0.28, 0.26, d + 0.28, MAT.wallPutty, 0, fh + i * fh, 0, g);
    }
    // 窗（正面 +Z 与背面 -Z）——【实拍纠正】使用蓝绿色玻璃
    var GM = MAT.glassTeal;
    for (var k = 0; k < f; k++) {
      var y = k * fh + fh * 0.56;
      windowRow(w * 0.94, y, fh * 0.52, 1.9, 1.5, 0, 'z', 1, d / 2 - 0.08, GM);
      windowRow(w * 0.94, y, fh * 0.52, 1.9, 1.5, 0, 'z', -1, d / 2 - 0.08, GM);
    }
    // 两端山墙窗
    for (var k2 = 0; k2 < f; k2++) {
      windowRow(d * 0.7, k2 * fh + fh * 0.56, fh * 0.52, 1.7, 1.4, 0, 'x', 1, w / 2 - 0.08, GM);
    }
    // 外廊：栏板 + 楼板 + 柱子
    var cz = corridorSide * (d / 2 + corridor / 2);
    for (var c = 0; c < f; c++) {
      var ly = (c + 1) * fh;
      box(w, 0.24, corridor, MAT.concrete, 0, ly, cz, g);                       // 廊楼板
      if (c < f - 1) {
        box(w, 0.95, 0.18, MAT.wallPutty, 0, ly + 0.6, cz + corridorSide * corridor / 2, g); // 栏板
        box(w, 0.1, corridor, MAT.wallPutty, 0, ly + 1.05, cz, g);              // 廊顶线
      }
    }
    var colN = Math.max(4, Math.round(w / 7.5));
    for (var ci = 0; ci < colN; ci++) {
      var px = -w / 2 + (ci + 0.5) * (w / colN);
      var col = new THREE.Mesh(new THREE.BoxGeometry(0.52, H, 0.52), MAT.columnGrey);
      col.position.set(px, H / 2, cz + corridorSide * corridor / 2);
      col.castShadow = true; g.add(col);
    }
    // 【v10】屋檐长度沿用三/四号教学楼的 0.3m（现由修复后的 hipRoof 保证四面等宽外伸）
    var rh2 = 2.4;
    var roof2 = hipRoof(w, d, rh2, 0.3, MAT.roofRed, MAT.ridgeRed);
    roof2.position.y = H + 0.05;
    g.add(roof2);
    // 【v10】楼梯间改为绝对尺寸（取三/四号的 5.8 × 12.4），不再随楼宽放大
    box(5.8, 3.4, 12.4, MAT.wallPutty, 10.0, H + rh2 * 0.55 + 0.5, 0, g);
    box(6.1, 0.32, 12.7, MAT.roofRed, 10.0, H + rh2 * 0.55 + 2.3, 0, g);

    // ===== 【实拍纠正】升级入口门廊：中式双柱 + 红色坡屋顶 + 起翘 =====
    var ez = d / 2 + 3.0;                          // 门廊进深加大
    var pw = 10.0;                                 // 门廊宽度
    var pd = 6.5;                                  // 门廊深度

    // 门廊基座台阶
    for (var s2 = 0; s2 < 4; s2++) {
      box(pw + s2 * 0.6, 0.18, 0.65, MAT.step, 0, 0.09 + s2 * 0.02, d / 2 + 3.8 + s2 * 0.55, g);
    }
    // 门廊地面平台
    box(pw + 1.2, 0.35, pd * 0.6, MAT.concrete, 0, 0.175, ez - pd * 0.15, g);

    // 【新增】门廊两侧中式立柱（方形截面，仿石材质）
    var porchColX = [-3.8, 3.8];
    porchColX.forEach(function (cx) {
      // 柱础
      box(0.9, 0.5, 0.9, MAT.baseStone, cx, 0.25, ez, g);
      // 柱身（高至门廊檐下）
      box(0.65, 5.8, 0.65, MAT.columnGrey, cx, 2.9 + 0.25, ez, g);
      // 柱头（简化斗拱）
      box(0.85, 0.3, 0.85, MAT.wallPutty, cx, 5.8 + 0.15, ez, g);
    });

    // 门廊顶部横梁/额枋
    box(pw + 1.5, 0.35, pd * 0.5, MAT.beam, 0, 6.25, ez - pd * 0.15, g);

    // 【新增】门廊红色坡屋顶（四坡带起翘）
    var porchRoofH = 2.2;
    var porchRoof = hipRoof(pw + 2.0, pd + 1.0, porchRoofH, 0.8, MAT.roofPorch, MAT.ridgeRed);
    porchRoof.position.set(0, 6.6, ez);
    g.add(porchRoof);

    // 主入口大门
    box(3.4, 3.2, 0.18, MAT.door, 0, 1.6, d / 2 + 0.06, g);
    // 门两侧装饰壁柱
    [-2.0, 2.0].forEach(function (dx) {
      box(0.45, 3.6, 0.25, MAT.baseStone, dx, 1.8, d / 2 + 0.08, g);
    });
  };

  /* --- 历史建筑（凤栖堂 / 衍林堂 / 校史馆）：台基 + 柱廊 + 歇山顶 --- */
  FORMS.hall = function (g, b) {
    var w = b.size[0], d = b.size[2], H = b.size[1];
    var baseH = 0.95;
    // 台基
    box(w + 1.6, baseH, d + 1.6, MAT.stone, 0, baseH / 2, 0, g);
    box(w + 2.0, 0.22, d + 2.0, MAT.step, 0, baseH + 0.11, 0, g);
    // 主体
    var bh = H - baseH - 0.4;
    box(w, bh, d, MAT.wallHerit, 0, baseH + bh / 2, 0, g);
    // 墙裙（深色）
    box(w + 0.12, 0.85, d + 0.12, MAT.plinth, 0, baseH + 0.42, 0, g);
    // 【航拍实证】前廊柱为粉红色（原朱红已按 2023 航拍纠正）
    var cz = d / 2 + 1.5;
    var n = Math.max(4, Math.round(w / 3.6));
    for (var i = 0; i < n; i++) {
      var px = -w / 2 + (i + 0.5) * (w / n);
      var col = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, bh * 0.92, 12), MAT.columnPink);
      col.position.set(px, baseH + bh * 0.46, cz);
      col.castShadow = true; g.add(col);
      box(0.7, 0.3, 0.7, MAT.beam, px, baseH + bh * 0.92 + 0.15, cz, g);   // 柱头
    }
    // 廊顶
    box(w + 1.2, 0.3, 3.4, MAT.beam, 0, baseH + bh * 0.92 + 0.3, cz + 0.2, g);
    // 额枋 + 檐口
    box(w + 1.0, 0.55, d + 1.0, MAT.beam, 0, baseH + bh + 0.1, 0, g);
    box(w + 2.2, 0.34, d + 2.2, MAT.columnGrey, 0, baseH + bh + 0.5, 0, g);  // 檐口出挑
    // 歇山顶
    var rh = 3.4;
    var roof = hipRoof(w + 1.6, d + 1.6, rh, 1.5, MAT.roofHerit, MAT.ridge);
    roof.position.y = baseH + bh + 0.7;
    g.add(roof);
    // 门窗（正面）
    var doorY = baseH + 1.85;
    box(2.8, 3.1, 0.2, MAT.door, 0, doorY, d / 2 + 0.06, g);
    for (var k = 0; k < n - 1; k++) {
      var wx2 = -w / 2 + (k + 1) * (w / n);
      if (Math.abs(wx2) < 2.2) continue;
      queueWindow(wx2, baseH + 2.1, d / 2 + 0.05, 1.5, 2.2, 'z');
    }
    // 侧面窗
    var sideN = Math.max(2, Math.round(d / 4));
    for (var s3 = 0; s3 < sideN; s3++) {
      var pz = -d / 2 + (s3 + 0.5) * (d / sideN);
      queueWindow(w / 2 + 0.05, baseH + 2.1, pz, 1.4, 2.2, 'x');
      queueWindow(-w / 2 - 0.05, baseH + 2.1, pz, 1.4, 2.2, 'x');
    }
    // 台阶
    for (var s4 = 0; s4 < 3; s4++) box(w * 0.42, 0.2, 0.8, MAT.step, 0, 0.1 + s4 * 0.02, d / 2 + 2.4 + s4 * 0.7, g);
  };

  /* --- 图书馆：基座 + 竖向遮阳 + 大窗 --- */
  FORMS.library = function (g, b) {
    var w = b.size[0], d = b.size[2], H = b.size[1], f = b.floors, fh = b.floorH;
    box(w + 0.6, 1.2, d + 0.6, MAT.plinth, 0, 0.6, 0, g);
    box(w, H - 1.2, d, MAT.wallPutty, 0, 1.2 + (H - 1.2) / 2, 0, g);
    for (var i = 1; i < f; i++) box(w + 0.26, 0.28, d + 0.26, MAT.wallGrey, 0, 1.2 + i * fh, 0, g);
    // 竖向遮阳片
    var finN = Math.max(6, Math.round(w / 2.6));
    for (var k = 0; k < finN; k++) {
      var px = -w / 2 + (k + 0.5) * (w / finN);
      box(0.34, H - 2.2, 0.9, MAT.concrete, px, 1.2 + (H - 1.2) / 2, d / 2 + 0.42, g);
      box(0.34, H - 2.2, 0.9, MAT.concrete, px, 1.2 + (H - 1.2) / 2, -d / 2 - 0.42, g);
    }
    // 大窗（分层通长）
    for (var j = 0; j < f; j++) {
      var y = 1.2 + j * fh + fh * 0.58;
      windowRow(w * 0.9, y, fh * 0.55, 2.4, 1.0, 0, 'z', 1, d / 2 - 0.05);
      windowRow(w * 0.9, y, fh * 0.55, 2.4, 1.0, 0, 'z', -1, d / 2 - 0.05);
    }
    var par = parapet(w, d + 0.9, 1.25, 0.3, MAT.parapet, MAT.wallGrey);
    par.position.y = H; g.add(par);
    // 入口
    var ez = d / 2 + 1.0;
    box(9, 5.2, 2.0, MAT.concrete, 0, 2.6, ez, g);
    box(10, 0.3, 2.8, MAT.wallGrey, 0, 5.35, ez, g);
    box(4.2, 3.0, 0.18, MAT.glass, 0, 1.5, d / 2 + 0.06, g);
    for (var s5 = 0; s5 < 4; s5++) box(11, 0.18, 0.7, MAT.step, 0, 0.09 + s5 * 0.02, d / 2 + 2.4 + s5 * 0.66, g);
  };

  /* --- 办公楼：竖向窗带 + 平屋顶 --- */
  FORMS.office = function (g, b) {
    var w = b.size[0], d = b.size[2], H = b.size[1], f = b.floors, fh = b.floorH;
    box(w, H, d, MAT.wallGrey, 0, H / 2, 0, g);
    box(w + 0.3, 0.85, d + 0.3, MAT.plinth, 0, 0.42, 0, g);
    for (var i = 1; i < f; i++) box(w + 0.24, 0.24, d + 0.24, MAT.wallPutty, 0, i * fh, 0, g);
    for (var j = 0; j < f; j++) {
      var y = j * fh + fh * 0.55;
      windowRow(w * 0.92, y, fh * 0.5, 2.0, 1.3, 0, 'z', 1, d / 2 - 0.06);
      windowRow(w * 0.92, y, fh * 0.5, 2.0, 1.3, 0, 'z', -1, d / 2 - 0.06);
    }
    var par = parapet(w, d, 1.05, 0.26, MAT.parapet, MAT.wallPutty);
    par.position.y = H; g.add(par);
    box(w * 0.14, 2.2, d * 0.5, MAT.wallPutty, -w * 0.3, H + 1.1, 0, g);
    box(5.0, 4.2, 1.6, MAT.concrete, 0, 2.1, d / 2 + 0.8, g);
    box(3.0, 2.8, 0.16, MAT.glass, 0, 1.4, d / 2 + 0.06, g);
  };

  /* --- 艺术教育活动中心：大空间 + 高窗 + 入口台阶 --- */
  FORMS.art = function (g, b) {
    var w = b.size[0], d = b.size[2], H = b.size[1], f = b.floors, fh = b.floorH;
    box(w + 0.5, 1.0, d + 0.5, MAT.plinth, 0, 0.5, 0, g);
    box(w, H - 1.0, d, MAT.wallCream, 0, 1.0 + (H - 1.0) / 2, 0, g);
    for (var i = 1; i < f; i++) box(w + 0.3, 0.3, d + 0.3, MAT.wallPutty, 0, 1.0 + i * fh, 0, g);
    // 高窗带（通长玻璃 + 竖向分格）
    for (var j = 0; j < f; j++) {
      var y = 1.0 + j * fh + fh * 0.55;
      var hh = fh * 0.6;
      if (j === 0) { y = 1.0 + fh * 0.62; hh = fh * 0.72; }   // 首层通高
      windowRow(w * 0.88, y, hh, 3.2, 0.8, 0, 'z', 1, d / 2 - 0.06);
      windowRow(w * 0.88, y, hh, 3.2, 0.8, 0, 'z', -1, d / 2 - 0.06);
      windowRow(d * 0.8, y, hh, 3.0, 0.8, 0, 'x', 1, w / 2 - 0.06);
    }
    // 檐口
    box(w + 1.8, 0.5, d + 1.8, MAT.wallPutty, 0, H - 0.25, 0, g);
    var par = parapet(w, d, 0.9, 0.28, MAT.parapet, MAT.wallGrey);
    par.position.y = H; g.add(par);
    // 主入口：大台阶 + 雨棚
    var ez = d / 2 + 3.2;
    for (var s6 = 0; s6 < 5; s6++) box(w * 0.34, 0.2, 0.85, MAT.step, 0, 0.1 + s6 * 0.2, d / 2 + 1.0 + s6 * 0.8, g);
    box(w * 0.36, 6.0, 6.4, MAT.concrete, 0, 3.0, ez, g);
    box(w * 0.38, 0.34, 7.0, MAT.wallGrey, 0, 6.15, ez, g);
    [-w * 0.15, w * 0.15].forEach(function (x) { box(0.6, 6.0, 0.6, MAT.columnGrey, x, 3.0, ez + 2.6, g); });
    box(5.6, 3.6, 0.18, MAT.glass, 0, 1.8, d / 2 + 0.06, g);
  };

  /* --- 科学馆实验大楼：外廊 + 窗阵 + 屋顶设备 --- */
  FORMS.lab = function (g, b) {
    var w = b.size[0], d = b.size[2], H = b.size[1], f = b.floors, fh = b.floorH;
    box(w, H, d, MAT.wallPutty, 0, H / 2, 0, g);
    box(w + 0.28, 0.8, d + 0.28, MAT.plinth, 0, 0.4, 0, g);
    for (var i = 1; i < f; i++) box(w + 0.24, 0.24, d + 0.24, MAT.wallGrey, 0, i * fh, 0, g);
    for (var j = 0; j < f; j++) {
      var y = j * fh + fh * 0.56;
      windowRow(w * 0.93, y, fh * 0.5, 1.8, 1.25, 0, 'z', 1, d / 2 - 0.06);
      windowRow(w * 0.93, y, fh * 0.5, 1.8, 1.25, 0, 'z', -1, d / 2 - 0.06);
    }
    var par = parapet(w, d, 1.1, 0.28, MAT.parapet, MAT.wallPutty);
    par.position.y = H; g.add(par);
    // 屋顶设备（低矮、非科幻：通风柜 + 水箱）
    box(6, 2.0, 3.2, MAT.metalDark, -w * 0.22, H + 1.0, 0, g);
    box(3.4, 2.6, 3.4, MAT.metalDark, w * 0.2, H + 1.3, 0, g);
    var vent = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.6, 10), MAT.metalDark);
    vent.position.set(w * 0.32, H + 0.8, d * 0.2); g.add(vent);
    // 入口
    box(6.4, 4.4, 2.2, MAT.concrete, 0, 2.2, d / 2 + 1.1, g);
    box(3.2, 2.9, 0.16, MAT.door, 0, 1.45, d / 2 + 0.06, g);
  };

  /* --- 食堂：低层大空间 --- */
  FORMS.canteen = function (g, b) {
    var w = b.size[0], d = b.size[2], H = b.size[1];
    box(w + 0.4, 0.7, d + 0.4, MAT.plinth, 0, 0.35, 0, g);
    box(w, H - 0.7, d, MAT.wallCream, 0, 0.7 + (H - 0.7) / 2, 0, g);
    box(w + 0.5, 0.36, d + 0.5, MAT.wallPutty, 0, H - 0.18, 0, g);
    windowRow(w * 0.9, 2.3, 2.2, 2.6, 1.1, 0, 'z', 1, d / 2 - 0.06);
    windowRow(w * 0.9, 2.3, 2.2, 2.6, 1.1, 0, 'z', -1, d / 2 - 0.06);
    var par = parapet(w, d, 0.8, 0.26, MAT.parapet, MAT.wallPutty);
    par.position.y = H; g.add(par);
    box(3.6, 2.9, 0.16, MAT.glass, 0, 1.45, d / 2 + 0.06, g);
    for (var s7 = 0; s7 < 2; s7++) box(6, 0.18, 0.7, MAT.step, 0, 0.09 + s7 * 0.02, d / 2 + 0.8 + s7 * 0.62, g);
  };

  /* --- 宿舍 / 生活区：长条 + 真实进深阳台 + 空调位 --- */
  FORMS.living = function (g, b) {
    var w = b.size[0], d = b.size[2], H = b.size[1], f = b.floors, fh = b.floorH;
    box(w, H, d * 0.72, MAT.wallCream, 0, H / 2, -d * 0.14, g);
    box(w + 0.3, 0.8, d * 0.72 + 0.3, MAT.plinth, 0, 0.4, -d * 0.14, g);
    var balD = d * 0.28, balZ = d * 0.36;
    for (var i = 0; i < f; i++) {
      var ly = i * fh;
      box(w, 0.22, balD, MAT.concrete, 0, ly + fh, balZ, g);                      // 阳台板
      box(w, 1.0, 0.16, MAT.wallPutty, 0, ly + fh + 0.5, balZ + balD / 2, g);     // 栏板
      // 阳台分户隔墙
      var uN = Math.max(3, Math.round(w / 4.2));
      for (var u = 0; u <= uN; u++) {
        box(0.16, fh - 0.3, balD, MAT.wallPutty, -w / 2 + u * (w / uN), ly + fh / 2 + 0.1, balZ, g);
      }
      // 空调外机
      if (i > 0) for (var a = 0; a < uN; a++) {
        box(1.0, 0.7, 0.5, MAT.metalDark, -w / 2 + (a + 0.5) * (w / uN), ly + fh * 0.72, d * 0.5 + 0.28, g);
      }
      // 门 + 窗（凹入墙体面）
      for (var a2 = 0; a2 < uN; a2++) {
        var px = -w / 2 + (a2 + 0.5) * (w / uN);
        queueWindow(px, ly + fh * 0.58, d * 0.5 - 0.04, 1.5, 1.9, 'z');
      }
    }
    var par = parapet(w, d * 0.72, 1.0, 0.26, MAT.parapet, MAT.wallPutty);
    par.position.set(0, H, -d * 0.14); g.add(par);
    box(3.4, 2.8, 0.16, MAT.door, 0, 1.4, -d * 0.14 + d * 0.36 + 0.06, g);
  };

  /* --- 北门：四柱三间三楼牌楼式（参考实拍照片） --- */
  FORMS.gate = function (g, b) {
    var w = b.size[0], H = b.size[1], d = b.size[2];
    // 实拍校门为四柱三间三楼牌楼：中门高、边门低，绿色琉璃瓦，白色门柱，金色回纹
    var W = 18, D = Math.max(d, 6), HT = Math.max(H, 10.5);
    var P = 1.35;                      // 方形门柱边长
    var midW = 6.6, sideW = 3.8;       // 中门/边门净宽
    var colX = [-W / 2 + P / 2, -midW / 2 - P / 2, midW / 2 + P / 2, W / 2 - P / 2];
    var colH = [HT * 0.73, HT, HT, HT * 0.73];   // 外侧边柱略矮

    // 四根门柱 + 柱础 + 柱顶金色装饰
    for (var i = 0; i < 4; i++) {
      var ch = colH[i];
      box(P, ch, D * 0.82, MAT.whiteGate, colX[i], ch / 2, 0, g);              // 白色门柱
      box(P + 0.45, 0.55, D * 0.95, MAT.stone, colX[i], 0.28, 0, g);         // 柱础
      box(P + 0.35, 0.35, D * 0.88, MAT.goldLine, colX[i], ch + 0.18, 0, g); // 柱顶压金
      // 柱身金色腰线
      box(P + 0.08, 0.12, D * 0.85, MAT.goldLine, colX[i], ch * 0.62, 0, g);
      box(P + 0.08, 0.12, D * 0.85, MAT.goldLine, colX[i], ch * 0.36, 0, g);
    }

    // 三道额枋（横梁）+ 金色装饰线
    var beamY = [HT * 0.75, HT * 0.86, HT];
    // 下枋：连接外侧四根柱
    box(W, 0.65, D * 0.78, MAT.whiteGate, 0, beamY[0], 0, g);
    box(W * 0.98, 0.12, D * 0.80, MAT.goldLine, 0, beamY[0] + 0.16, 0, g);
    // 中枋：主门上方大匾额位置
    box(midW + P * 3, 0.75, D * 0.80, MAT.whiteGate, 0, beamY[1], 0, g);
    box(midW + P * 2.8, 0.12, D * 0.82, MAT.goldLine, 0, beamY[1] + 0.2, 0, g);
    // 上枋：仅在主门正上方
    box(midW + P * 2.2, 0.55, D * 0.78, MAT.whiteGate, 0, beamY[2], 0, g);

    // 匾额"海南中学"（使用上一轮模型抠出的真实贴图，失败则回退到 Canvas）
    var plateW = 5.4, plateH = 1.25;
    var cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256;
    var cx = cv.getContext('2d');
    cx.fillStyle = '#e8d9b0'; cx.fillRect(0, 0, 1024, 256);
    cx.strokeStyle = '#a67c38'; cx.lineWidth = 12; cx.strokeRect(18, 18, 988, 220);
    cx.fillStyle = '#8a2318';
    cx.font = 'bold 120px "Noto Serif CJK SC","Songti SC",serif';
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText('海南中学', 512, 130);
    var fallbackTex = new THREE.CanvasTexture(cv);
    fallbackTex.anisotropy = 8;
    var plateMat = new THREE.MeshStandardMaterial({ map: fallbackTex, roughness: 0.45, metalness: 0.15 });
    var plate = new THREE.Mesh(new THREE.PlaneGeometry(plateW, plateH), plateMat);
    plate.position.set(0, beamY[1] + 0.06, D * 0.42);
    g.add(plate);
    // 尝试加载上一轮生成的真实门匾贴图
    new THREE.TextureLoader().load('assets/images/gate_sign.png',
      function (imgTex) {
        imgTex.anisotropy = 8;
        imgTex.encoding = THREE.sRGBEncoding;
        plateMat.map = imgTex;
        plateMat.needsUpdate = true;
      }, undefined, function () { /* 失败时保留 fallback */ });

    // 绿色琉璃瓦屋顶：主檐高 + 两侧低檐
    var mainRW = midW + P * 3.2, mainRD = D * 1.65, mainRH = 2.7;
    var mainRoof = hipRoof(mainRW, mainRD, mainRH, 0.95, MAT.roofHerit, MAT.ridge);
    mainRoof.position.y = HT + 0.55;
    g.add(mainRoof);

    var sideRW = (W - mainRW) / 2 + 0.6, sideRD = D * 1.55, sideRH = 1.6;
    [-1, 1].forEach(function (s) {
      var sideRoof = hipRoof(sideRW, sideRD, sideRH, 0.8, MAT.roofHerit, MAT.ridge);
      sideRoof.position.set(s * (mainRW / 2 + sideRW / 2 - 0.3), colH[0] + 0.55, 0);
      g.add(sideRoof);
    });

    // 四只石狮子（主门两侧 + 边门外侧各一）
    var lionZ = D / 2 + 1.5;
    [-1, 1].forEach(function (s) {
      box(1.0, 1.6, 1.0, MAT.marble, s * (midW / 2 + 1.1), 0.8, lionZ, g);     // 主门侧
      box(0.8, 1.25, 0.8, MAT.marble, s * (W / 2 - 1.3), 0.62, lionZ, g);      // 边门外侧
    });

    // 两侧门卫室 / 围墙，绿瓦顶
    var wallW = 4.8, wallH = 3.6;
    [-1, 1].forEach(function (s) {
      box(wallW, wallH, 0.7, MAT.wallCream, s * (W / 2 + wallW / 2 + 0.25), wallH / 2, 0, g);
      var sideTop = hipRoof(wallW + 1.0, 1.4, 0.75, 0.35, MAT.roofHerit, MAT.ridge);
      sideTop.position.set(s * (W / 2 + wallW / 2 + 0.25), wallH + 0.25, 0);
      g.add(sideTop);
    });
  };

  /* --- 陶然亭：石台 + 六柱 + 攒尖顶 --- */
  FORMS.pavilion = function (g, b) {
    var w = b.size[0], H = b.size[1], d = b.size[2];
    var r = Math.min(w, d) * 0.42, baseH = 0.75;
    var base = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.12, r * 1.2, baseH, 16), MAT.stone);
    base.position.y = baseH / 2; base.castShadow = true; base.receiveShadow = true; g.add(base);
    var top2 = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.02, 0.16, 16), MAT.step);
    top2.position.y = baseH + 0.08; g.add(top2);
    var colH = H * 0.58;
    for (var i = 0; i < 6; i++) {
      var a = i / 6 * Math.PI * 2 + Math.PI / 6;
      var col = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, colH, 10), MAT.column);
      col.position.set(Math.cos(a) * r * 0.82, baseH + colH / 2, Math.sin(a) * r * 0.82);
      col.castShadow = true; g.add(col);
      box(0.5, 0.22, 0.5, MAT.beam, Math.cos(a) * r * 0.82, baseH + colH + 0.11, Math.sin(a) * r * 0.82, g);
    }
    // 檐口环
    var eave = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.28, r * 1.05, 0.28, 16), MAT.beam);
    eave.position.y = baseH + colH + 0.3; eave.castShadow = true; g.add(eave);
    // 攒尖顶（八棱锥 + 起翘感：用两段锥）
    var roofH = H * 0.42;
    var cone = new THREE.Mesh(new THREE.ConeGeometry(r * 1.34, roofH, 8), MAT.roofHerit);
    cone.position.y = baseH + colH + 0.44 + roofH / 2;
    cone.castShadow = true; g.add(cone);
    var cone2 = new THREE.Mesh(new THREE.ConeGeometry(r * 0.5, roofH * 0.5, 8), MAT.roofHerit);
    cone2.position.y = baseH + colH + 0.44 + roofH + roofH * 0.22; g.add(cone2);
    // 宝顶
    var finial = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), MAT.ridge);
    finial.position.y = baseH + colH + 0.44 + roofH * 1.5 + 0.3; g.add(finial);
    // 石凳
    for (var s8 = 0; s8 < 4; s8++) {
      var a2 = s8 / 4 * Math.PI * 2 + Math.PI / 4;
      var bench = new THREE.Mesh(new THREE.BoxGeometry(r * 0.5, 0.16, 0.6), MAT.stone);
      bench.position.set(Math.cos(a2) * r * 0.95, baseH + 0.45, Math.sin(a2) * r * 0.95);
      bench.rotation.y = -a2; g.add(bench);
    }
  };

  /* --- 园林（思园/学园/行园）：铺装 + 草 + 灌木球 + 景石 + 坐凳 --- */
  FORMS.garden = function (g, b, o) {
    var w = b.size[0], d = b.size[2];
    plane(w, d, MAT.grass, 0, 0.06, 0, g);
    // 十字/环形铺装小径
    var pw = Math.min(w, d) * 0.16;
    plane(w * 0.86, pw, MAT.paving, 0, LAY.deck, 0, g);
    plane(pw, d * 0.86, MAT.paving, 0, LAY.deck, 0, g);
    // 中央小广场（比园路再抬一档，避免与交叉铺装共面闪烁）
    var cr = Math.min(w, d) * 0.2;
    var circle = new THREE.Mesh(new THREE.CircleGeometry(cr, 32), MAT.paving);
    circle.rotation.x = -Math.PI / 2; circle.position.y = LAY.deck + 0.012; circle.receiveShadow = true; g.add(circle);
    // 景石
    var rnd = mulberry(b.id);
    for (var i = 0; i < 5; i++) {
      var sx = (rnd() - 0.5) * w * 0.7, sz = (rnd() - 0.5) * d * 0.7;
      if (Math.abs(sx) < cr && Math.abs(sz) < cr) continue;
      var rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7 + rnd() * 0.8, 0), MAT.stone);
      rock.position.set(sx, 0.5, sz);
      rock.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      rock.scale.set(1, 0.7 + rnd() * 0.4, 1);
      rock.castShadow = true; rock.receiveShadow = true; g.add(rock);
    }
    // 灌木球
    for (var j = 0; j < 10; j++) {
      var bx2 = (rnd() - 0.5) * w * 0.82, bz2 = (rnd() - 0.5) * d * 0.82;
      var bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 + rnd() * 0.7, 0), j % 3 ? MAT.leafB : MAT.leafA);
      bush.position.set(bx2, 0.8, bz2);
      bush.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      bush.castShadow = true; g.add(bush);
    }
    // 坐凳
    for (var k = 0; k < 4; k++) {
      var a = k / 4 * Math.PI * 2;
      var bench = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 0.5), MAT.wood || MAT.stone);
      bench.position.set(Math.cos(a) * cr * 1.5, 0.52, Math.sin(a) * cr * 1.5);
      bench.rotation.y = -a; bench.castShadow = true; g.add(bench);
      [-1, 1].forEach(function (s) {
        var leg = box(0.14, 0.45, 0.4, MAT.stone, 0, 0.22, 0, bench);
        leg.position.x = s * 1.05;
      });
    }
  };

  /* --- 砚池：水面 + 石砌池岸 + 睡莲 --- */
  FORMS.pond = function (g, b) {
    var w = b.size[0], d = b.size[2];
    // 池底（沉到草坪层之下）
    plane(w, d, MAT.earth, 0, LAY.lawn - 0.03, 0, g);
    // 池岸（石砌框）：上沿略高于水面，形成真实的高差
    var t = 0.9, edgeH = 0.5;
    box(w + t * 2, edgeH, t, MAT.poolEdge, 0, LAY.water - edgeH / 2 + 0.10, d / 2 + t / 2, g);
    box(w + t * 2, edgeH, t, MAT.poolEdge, 0, LAY.water - edgeH / 2 + 0.10, -d / 2 - t / 2, g);
    box(t, edgeH, d, MAT.poolEdge, w / 2 + t / 2, LAY.water - edgeH / 2 + 0.10, 0, g);
    box(t, edgeH, d, MAT.poolEdge, -w / 2 - t / 2, LAY.water - edgeH / 2 + 0.10, 0, g);
    // 水面（惰性取得材质，避免依赖 buildGround 的执行顺序）
    var water = plane(w, d, ensureWaterMat(), 0, LAY.water, 0, g);
    water.castShadow = false;
    water.receiveShadow = false;
    // 睡莲
    var rnd = mulberry(b.id);
    for (var i = 0; i < 9; i++) {
      var px = (rnd() - 0.5) * w * 0.7, pz = (rnd() - 0.5) * d * 0.7;
      var pad = new THREE.Mesh(new THREE.CircleGeometry(0.55 + rnd() * 0.5, 10), MAT.leafB);
      pad.rotation.x = -Math.PI / 2; pad.position.set(px, LAY.water + 0.012, pz); g.add(pad);
    }
    // 岸边石（放在池岸顶面，不再悬空）
    for (var j = 0; j < 6; j++) {
      var a = rnd() * Math.PI * 2;
      var rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + rnd() * 0.5, 0), MAT.stone);
      rock.position.set(Math.cos(a) * w * 0.5, LAY.deck + 0.35, Math.sin(a) * d * 0.6);
      rock.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      rock.castShadow = true; g.add(rock);
    }
  };

  /* --- 植物园：草地 + 密集热带植被（由全局植被系统叠加，此处只做地坪） --- */
  FORMS.botanic = function (g, b) {
    var w = b.size[0], d = b.size[2];
    plane(w, d, MAT.grassDark, 0, LAY.lawnPatch, 0, g);
    // 园路环
    var ring = new THREE.Mesh(new THREE.RingGeometry(Math.min(w, d) * 0.22, Math.min(w, d) * 0.34, 40), MAT.earth);
    ring.rotation.x = -Math.PI / 2; ring.position.y = LAY.deck; g.add(ring);
    plane(w * 0.95, 1.6, MAT.earth, 0, LAY.deck, 0, g);
    plane(1.6, d, MAT.earth, 0, LAY.deck, 0, g);
  };

  /* --- 田径场轮廓工具：两条直道 + 两个半圆（标准 stadium / capsule 形） --- */
  function stadiumShape(halfLen, r, seg) {
    seg = seg || 28;
    var s = new THREE.Shape();
    s.moveTo(-halfLen, -r);
    s.lineTo(halfLen, -r);
    s.absarc(halfLen, 0, r, -Math.PI / 2, Math.PI / 2, false);
    s.lineTo(-halfLen, r);
    s.absarc(-halfLen, 0, r, Math.PI / 2, Math.PI * 1.5, false);
    s.curveSegments = seg;
    return s;
  }
  function stadiumHole(halfLen, r, seg) {
    var pts = stadiumShape(halfLen, Math.max(r, 0.05), seg || 28).getPoints(64);
    pts.reverse();
    return new THREE.Path(pts);
  }
  // 平面环带（水平薄片）。【v12 修复】此前第二个实参被误传为外半径 r，
  //   导致「环」实际是实心跑道形：跑道盖满全场、分道线变成 9 层半透明白色大板。
  function stadiumMesh(halfLen, r, mat, y, holeR) {
    var s = stadiumShape(halfLen, r, 32);
    if (holeR != null) s.holes.push(stadiumHole(halfLen, Math.max(holeR, 0.05), 32));
    var m = new THREE.Mesh(new THREE.ShapeGeometry(s, 32), mat);
    m.rotation.x = -Math.PI / 2; m.position.y = y;
    return m;
  }
  // 立体环带（沿 Y 挤出）：rIn 为内半径（null 则实心），高度 h，底面 y0
  function stadiumRingSolid(halfLen, rOut, rIn, mat, y0, h) {
    var s = stadiumShape(halfLen, rOut, 32);
    if (rIn != null && rIn > 0.05) s.holes.push(stadiumHole(halfLen, rIn, 32));
    var geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 32, steps: 1 });
    var m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2; m.position.y = y0;
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  // 沿跑道外沿走一圈，按弧长等距返回 {x,z} 采样点（用于立柱/栏杆柱定位）
  function stadiumSamples(halfLen, r, step) {
    var total = 4 * halfLen + 2 * Math.PI * r;
    var n = Math.max(8, Math.round(total / step)), per = total / n, pts = [];
    for (var i = 0; i < n; i++) {
      var d = i * per, a;
      if (d <= 2 * halfLen) {                                   // 南侧直道
        pts.push({ x: -halfLen + d, z: r });
      } else if (d <= 2 * halfLen + Math.PI * r) {              // 东端半圆
        a = Math.PI / 2 - (d - 2 * halfLen) / r;
        pts.push({ x: halfLen + Math.cos(a) * r, z: Math.sin(a) * r });
      } else if (d <= 4 * halfLen + Math.PI * r) {              // 北侧直道
        pts.push({ x: halfLen - (d - 2 * halfLen - Math.PI * r), z: -r });
      } else {                                                  // 西端半圆
        a = Math.PI * 1.5 - (d - 4 * halfLen - Math.PI * r) / r;
        pts.push({ x: -halfLen + Math.cos(a) * r, z: Math.sin(a) * r });
      }
    }
    return pts;
  }

  /* --- 【v12】环跑道观赛台（对照实拍：蓝色塑胶阶梯 + 白色瓷砖外墙立柱 + 白铁栏杆 + 顶棚灯）
     构造：跑道外沿 R_out 起，向外逐级抬高（每排一块立体环带），最外侧白瓷砖挡墙 +
     立柱 + 悬挑顶棚；跑道侧一圈白铁栏杆。向外的偏移 t 恰好仍是 stadium(halfLen, R_out+t)，
     所以每一排都是「外环 − 内环」的立体环带。 --- */
  function buildStadiumStands(halfLen, R_out, g) {
    var tiers  = 7;                       // 看台排数
    var tierH  = 0.52;                    // 每排升高
    var stepD  = 0.90;                    // 每排进深
    var standH = tiers * tierH;           // 3.64m（最高一排座面）
    var standW = tiers * stepD;           // 6.30m（看台总进深）
    var canopyY = standH + 2.50;          // 顶棚底面标高 6.14m

    var seatMat  = M('#3f7cbf', 0.94);                  // 蓝色塑胶座面
    var riserMat = M('#5c93d0', 0.94);                  // 竖面（略浅）
    var tileMat  = M('#e9e7e0', 0.94);                  // 白色瓷砖（挡墙 / 立柱）
    var railMat  = M('#ccd3da', 0.55, 0.55);            // 白铁栏杆
    var roofMat  = M('#9a978f', 0.92);                  // 顶棚
    var lampMat  = new THREE.MeshStandardMaterial({
      color: 0xf5ecc4, emissive: 0xffe9a8, emissiveIntensity: 0.45, roughness: 0.5
    });

    // ① 阶梯座面：第 t 排 = 立体环带 [R+t·stepD, R+(t+1)·stepD]，从地面升到 (t+1)·tierH
    for (var t = 0; t < tiers; t++) {
      var r0 = R_out + t * stepD, r1 = r0 + stepD;
      var blk = stadiumRingSolid(halfLen, r1, r0, (t % 2 ? riserMat : seatMat), LAY.field, (t + 1) * tierH);
      g.add(blk);
      // 每排前沿的白色防滑条（踏步前缘）
      var nose = stadiumMesh(halfLen, r0 + 0.28, tileMat, (t + 1) * tierH + 0.02, r0);
      nose.receiveShadow = true; g.add(nose);
    }

    // ② 跑道侧白铁栏杆：0.40m 矮踢脚 + 上下两道横杆 + 立杆（不遮挡第一排座面）
    var fWall = stadiumRingSolid(halfLen, R_out + 0.22, R_out, tileMat, LAY.field, 0.40);
    fWall.castShadow = false; g.add(fWall);
    var fr = stadiumSamples(halfLen, R_out + 0.11, 5.0);
    for (var i = 0; i < fr.length; i++) {
      var p = fr[i];
      var post = box(0.09, 0.72, 0.09, railMat, p.x, 0.76, p.z, g);
      post.castShadow = false;
    }
    var fR1 = stadiumRingSolid(halfLen, R_out + 0.13, R_out + 0.05, railMat, 0.72, 0.07);
    fR1.castShadow = false; g.add(fR1);
    var fR2 = stadiumRingSolid(halfLen, R_out + 0.13, R_out + 0.05, railMat, 1.06, 0.07);
    fR2.castShadow = false; g.add(fR2);

    // ③ 外侧白色瓷砖挡墙 + 顶部压顶
    var bWall = stadiumRingSolid(halfLen, R_out + standW + 0.30, R_out + standW, tileMat, LAY.field, standH + 1.10);
    g.add(bWall);
    var cap = stadiumMesh(halfLen, R_out + standW + 0.42, tileMat, standH + 1.14, R_out + standW + 0.22);
    g.add(cap);

    // ④ 立柱（白瓷砖方柱）+ 顶棚 + 灯具
    var colR = R_out + standW + 0.66;
    var cols = stadiumSamples(halfLen, colR, 6.0);
    for (var c = 0; c < cols.length; c++) {
      var q = cols[c];
      var col = box(0.52, canopyY, 0.52, tileMat, q.x, canopyY / 2, q.z, g);
      col.castShadow = true;
      if (c % 2 === 0) {                       // 隔柱一盏灯，控制网格数量
        var lamp = box(0.62, 0.16, 0.62, lampMat, q.x, canopyY - 0.24, q.z, g);
        lamp.castShadow = false;
      }
    }
    // 悬挑顶棚：内缘挑到看台中部，外缘出檐
    var canopy = stadiumRingSolid(halfLen, R_out + standW + 1.12,
                                  R_out + standW * 0.42, roofMat, canopyY, 0.24);
    g.add(canopy);
    // 顶棚外沿封边
    var eave = stadiumRingSolid(halfLen, R_out + standW + 1.22, R_out + standW + 1.06,
                                tileMat, canopyY - 0.10, 0.14);
    g.add(eave);

    return { standW: standW, standH: standH, canopyY: canopyY };
  }

  /* --- 运动场：标准 400m 田径场（8 道 × 1.22m）+ 内场草坪 + 白线 --- */
  FORMS.field = function (g, b) {
    var w = b.size[0], d = b.size[2];
    // 【标准 400m 田径场】外沿短轴 = d = 2·R_out；长轴 = w = 2·halfLen + 2·R_out
    var R_out = d / 2;                      // 47.4m（外沿半径）
    var halfLen = Math.max(w / 2 - R_out, 8); // 39.35m（直道半长）
    var lanes = 8, laneW = 1.22;            // 8 道 × 1.22m = 9.76m
    var R_in = R_out - lanes * laneW;       // 37.64m（内圈半径，标准值 36.5m）

    // 【v12】环跑道一整圈观赛台（蓝色塑胶阶梯 + 白瓷砖挡墙立柱 + 白铁栏杆 + 顶棚灯）
    var st = buildStadiumStands(halfLen, R_out, g);

    // 红色塑胶跑道环（stadium 形，非椭圆）
    var track = stadiumMesh(halfLen, R_out, MAT.trackRed, LAY.field, R_in);
    track.receiveShadow = true; g.add(track);

    // 内场草坪（台湾草）
    var inner = stadiumMesh(halfLen, R_in, MAT.trackGreen, LAY.field + 0.01);
    inner.receiveShadow = true; g.add(inner);

    // 白线材质
    var lineMat = new THREE.MeshBasicMaterial({ color: 0xe6e2d4, transparent: true, opacity: 0.62 });
    function line(x, z, lw, ld) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(lw, ld), lineMat);
      m.rotation.x = -Math.PI / 2; m.position.set(x, LAY.mark, z); g.add(m);
    }

    // ① 分道线：内圈线 + 7 条分隔线（第 1~8 道）
    for (var i = 0; i <= lanes; i++) {
      var rr = R_in + i * laneW;
      if (rr > R_out - 0.06) rr = R_out - 0.06;
      var lm = stadiumMesh(halfLen, rr, lineMat, LAY.mark, rr - 0.11);
      g.add(lm);
    }

    // ② 中央足球场（标准 400m 场内可容纳）
    // 【v13 修复】此前禁区/球门区的线宽与半宽为写死常数（40.3 / 18.3 / 20.15 / 9.15），
    //   与上面按 halfLen/R_in 计算出的实际场地尺寸脱钩：一旦场地被压缩，
    //   这些线会戳出边线之外。现在全部由 fw/fh 推导，并按比例夹取。
    var fw = Math.min(100, 2 * halfLen + 2 * R_in - 12), fh = Math.min(64, 2 * R_in - 8);
    var hw = fw / 2, hh = fh / 2;
    line(0, -hh, fw, 0.18); line(0, hh, fw, 0.18);              // 边线
    line(-hw, 0, 0.18, fh); line(hw, 0, 0.18, fh);              // 端线
    line(0, 0, fw, 0.18);                                        // 中线
    // 中圈
    var cc = new THREE.Mesh(new THREE.RingGeometry(9.0, 9.18, 40), lineMat);
    cc.rotation.x = -Math.PI / 2; cc.position.y = LAY.mark; g.add(cc);
    // 中点
    var cd = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16), lineMat);
    cd.rotation.x = -Math.PI / 2; cd.position.y = LAY.mark; g.add(cd);
    // 两侧禁区（16.5m）、球门区（5.5m）与点球点，均按场地实际尺寸推导
    var penaltyD = Math.min(16.5, fw * 0.28);        // 禁区深度，场地过短时按比例收缩
    var penaltyW = Math.min(40.3, fh * 0.92);        // 禁区宽度
    var goalD = Math.min(5.5, penaltyD * 0.4);       // 球门区深度
    var goalW = Math.min(18.3, penaltyW * 0.5);      // 球门区宽度
    var spotD = Math.min(11, penaltyD * 0.66);       // 点球点距端线
    var arcR = 9.15;                                  // 罚球弧半径（标准值）
    [-1, 1].forEach(function (s) {
      var px = s * hw, pn = -s;
      // 禁区
      line(px - pn * penaltyD, 0, 0.16, penaltyW);
      line(px - pn * penaltyD * 0.5, -penaltyW / 2, penaltyD, 0.16);
      line(px - pn * penaltyD * 0.5, penaltyW / 2, penaltyD, 0.16);
      // 球门区
      line(px - pn * goalD, 0, 0.16, goalW);
      line(px - pn * goalD * 0.5, -goalW / 2, goalD, 0.16);
      line(px - pn * goalD * 0.5, goalW / 2, goalD, 0.16);
      // 点球点
      var sp = new THREE.Mesh(new THREE.CircleGeometry(0.26, 12), lineMat);
      sp.rotation.x = -Math.PI / 2; sp.position.set(px - pn * spotD, LAY.mark, 0); g.add(sp);
      // 罚球弧（只保留禁区外那段圆弧）
      // 角度约定：RingGeometry 经 rotation.x = -PI/2 后，θ 映射到世界方向 (cosθ, -sinθ)。
      // 弧需朝场地中央凸出（即朝 -pn 方向），故右侧取 π 附近、左侧取 0 附近。
      var arcHalf = Math.acos(Math.min(1, (penaltyD - spotD) / arcR));
      var arc = new THREE.Mesh(
        new THREE.RingGeometry(arcR - 0.09, arcR, 28, 1,
          pn > 0 ? Math.PI - arcHalf : -arcHalf, arcHalf * 2), lineMat);
      arc.rotation.x = -Math.PI / 2;
      arc.position.set(px - pn * spotD, LAY.mark, 0);
      g.add(arc);
      // 球门（简化门框：两柱一横梁）
      var goalW2 = Math.min(7.32, goalW * 0.5), goalH = 2.44, goalD2 = 0.22;
      var postMat = MAT.columnGrey;
      [-1, 1].forEach(function (gs) {
        box(0.16, goalH, 0.16, postMat, px - pn * goalD2, goalH / 2, gs * goalW2 / 2, g);
      });
      box(0.16, 0.16, goalW2 + 0.16, postMat, px - pn * goalD2, goalH, 0, g);
    });

    // ③ 起跑区（西侧直道端，错开的前伸线）
    for (var k = 0; k < 4; k++) {
      line(-halfLen + 6 + k * 3, R_in * 0.42, 0.14, R_in * 0.86);
    }

    // ④ 主席台（南侧中段，紧邻看台外侧；看台加宽后随之外移）
    var podiumZ = R_out + st.standW + 3.4;
    var podium = box(16, 3.2, 6, MAT.wallPutty, 0, 1.6, podiumZ, g);
    podium.castShadow = true;
    box(17, 0.4, 7, MAT.roofHerit, 0, 3.4, podiumZ, g);

    /* ⑤ 篮球场区（6 个，3 列 × 2 行，篮框连线南北走向）
       【v12】整体旋转 90°：长轴由 X 改为 Z（南北），两个篮框一北一南；
       场地由 15×12 放大到 15×33（含 2.5m 端线外缓冲区，标准划线区仍为 15×28），
       整片排布填满「操场南沿 ↔ 女生宿舍北沿」的走廊。
       注意：以下坐标是 FORMS.field 的「局部坐标」，原点在操场中心
             (操场世界中心 X=-152.25, Z=-136.9 → 世界 X = 局部 X - 152.25)。 */
    var courtW = 15.0, courtD = 33.0;      // 单场：X 宽 15m，Z 长 33m（南北）
    var runOut = 2.5;                      // 端线外缓冲（两侧各 2.5m）
    var playD = courtD - runOut * 2;       // 划线区长度 = 28m（标准）
    var gapX = 2.0, gapZ = 9.0;            // 场地之间通道
    var clusterW = courtW * 3 + gapX * 2;  // 3 列 = 49.0m
    var clusterD = courtD * 2 + gapZ;      // 2 行 = 75.0m
    // 可用走廊（局部）：X = 33.75…86.75（世界 -118.5…-65.5，女生宿舍东西边界）
    //                  Z = 看台外沿 54.0 + 9.9 起 … 146.4（世界 9.5，女生宿舍北沿）
    var centerX = (33.75 + 86.75) / 2;                 // = 60.25
    var bandZ0 = R_out + st.standW + 0.30 + 9.9;       // = 63.9
    var bandZ1 = 146.4 - 3.0;                          // = 143.4
    var centerZ = (bandZ0 + bandZ1) / 2;               // = 102.9
    var startX = centerX - clusterW / 2 + courtW / 2;  // 第 1 列中心 X
    var startZ = centerZ - clusterD / 2 + courtD / 2;  // 第 1 行中心 Z

    var courtMat = M('#2f6b52', 0.94);     // 深绿塑胶场地
    var apronMat = M('#b9b3a4', 0.96);     // 场地外圈水泥缓冲
    var courtLine = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.88 });
    var keyMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.42 });
    // 整片场地的水泥缓冲台（把 6 片连成一块球场区）
    plane(clusterW + 3.0, clusterD + 3.0, apronMat, centerX, 0.04, centerZ, g);

    for (var row = 0; row < 2; row++) {
      for (var col = 0; col < 3; col++) {
        var cx = startX + col * (courtW + gapX);
        var cz = startZ + row * (courtD + gapZ);
        // 场地（含端线外缓冲区）
        var court = plane(courtW, courtD, courtMat, cx, 0.06, cz, g);
        court.receiveShadow = true;
        // —— 以下为 15×28 标准划线区，南北两端各留 2.5m 缓冲 ——
        var hw = courtW / 2, hl = playD / 2;
        plane(0.14, playD, courtLine, cx - hw + 0.07, LAY.mark, cz, g);   // 左边线（南北）
        plane(0.14, playD, courtLine, cx + hw - 0.07, LAY.mark, cz, g);   // 右边线（南北）
        plane(courtW, 0.14, courtLine, cx, LAY.mark, cz - hl + 0.07, g);  // 北端线
        plane(courtW, 0.14, courtLine, cx, LAY.mark, cz + hl - 0.07, g);  // 南端线
        plane(courtW, 0.12, courtLine, cx, LAY.mark, cz, g);              // 中线（东西向）
        var ccl = new THREE.Mesh(new THREE.RingGeometry(1.72, 1.86, 28), courtLine);
        ccl.rotation.x = -Math.PI / 2; ccl.position.set(cx, LAY.mark, cz); g.add(ccl);
        [-1, 1].forEach(function (s) {                                 // s=-1 北筐, +1 南筐
          var baseZ = cz + s * hl;                                     // 该端端线
          var keyW = 4.9, keyD = 5.8;
          plane(keyW, keyD, keyMat, cx, LAY.field, baseZ - s * keyD / 2, g);          // 三秒区
          plane(keyW, 0.12, courtLine, cx, LAY.mark, baseZ - s * keyD, g);          // 罚球线
          var fc = new THREE.Mesh(new THREE.RingGeometry(1.72, 1.86, 24), courtLine);
          fc.rotation.x = -Math.PI / 2; fc.position.set(cx, LAY.mark, baseZ - s * keyD); g.add(fc);
          // 三分线：以篮筐为圆心的半圆，开口朝场地中央
          var hoopZ = baseZ - s * 1.575;
          var arc = new THREE.Mesh(new THREE.RingGeometry(6.70, 6.84, 40, 1,
                              (s > 0 ? 0 : Math.PI), Math.PI), courtLine);
          arc.rotation.x = -Math.PI / 2; arc.position.set(cx, LAY.mark, hoopZ); g.add(arc);
          // 篮筐（红点，南北两端 → 两筐连线为南北向）
          var hoop = new THREE.Mesh(new THREE.CircleGeometry(0.24, 14),
                                    new THREE.MeshBasicMaterial({ color: 0xdd4b39 }));
          hoop.rotation.x = -Math.PI / 2; hoop.position.set(cx, LAY.mark + 0.005, hoopZ); g.add(hoop);
        });
      }
    }
  };

  /* --- 百年榄仁树（实拍纠正版）：超粗干(涂白) + 巨冠(红褐叶) + 宽冠幅 --- */
  FORMS.oldtree = function (g, b) {
    var H = b.size[1] || 15.0;
    var trunkMat = MAT.trunk;
    // 【实拍纠正】主干更粗壮（胸径80-120cm），下部涂白
    var t1 = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.0, H * 0.40, 14), trunkMat);
    t1.position.y = H * 0.20; t1.castShadow = true; g.add(t1);
    // 【新增】树干下部白色涂白段（用浅色材质模拟）
    var paintH = H * 0.18;
    var tPaint = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.9, paintH, 14), MAT.columnGrey);
    tPaint.position.y = paintH / 2; tPaint.castShadow = true; g.add(tPaint);
    var t2 = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.2, H * 0.28, 12), trunkMat);
    t2.position.set(0.30, H * 0.52, 0.12); t2.rotation.z = -0.06; t2.castShadow = true; g.add(t2);
    // 板根（更粗壮）
    for (var i = 0; i < 6; i++) {
      var a = i / 6 * Math.PI * 2;
      var br = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.8, 7), trunkMat);
      br.position.set(Math.cos(a) * 1.4, 1.2, Math.sin(a) * 1.4);
      br.rotation.set(Math.cos(a) * 0.24, 0, -Math.sin(a) * 0.24);
      br.castShadow = true; g.add(br);
    }
    // 【实拍纠正】层状枝——冠幅更大（15-20m世界坐标），叶色红褐色
    var lv = 4;                                    // 增加层数
    for (var L = 0; L < lv; L++) {
      var ly = H * (0.58 + L * 0.11);
      var lr = (9.0 - L * 1.6) * (H / 15.0);       // 冠幅显著增大
      // 【实拍纠正】使用偏红的叶色（红褐色榄仁叶）
      var leafMat = (L % 2 === 0) ? MAT.leafDry : MAT.leafB;
      var layer = new THREE.Mesh(new THREE.CylinderGeometry(lr, lr * 0.90, 0.58, 16), leafMat);
      layer.position.set(L * 0.55, ly, L * 0.22);
      layer.castShadow = true; layer.receiveShadow = true;
      g.add(layer);
      // 层间的不规则叶团
      var rnd = mulberry('oldtree' + L);
      for (var k = 0; k < 8; k++) {                 // 增加叶团数量
        var aa = rnd() * Math.PI * 2, rr = lr * (0.50 + rnd() * 0.55);
        var blobMat = (k % 3 === 0) ? MAT.leafDry : ((k % 2 === 0) ? MAT.leafA : MAT.leafB);
        var blob = new THREE.Mesh(new THREE.IcosahedronGeometry(lr * (0.28 + rnd() * 0.24), 0), blobMat);
        blob.position.set(Math.cos(aa) * rr, ly + (rnd() - 0.5) * 1.8, Math.sin(aa) * rr);
        blob.castShadow = true; g.add(blob);
      }
    }
    // 【实拍纠正】顶部冠——更大更饱满
    var topR = 5.5 * (H / 15.0);
    var top3 = new THREE.Mesh(new THREE.IcosahedronGeometry(topR, 1), MAT.leafDry);
    top3.position.set(0.5, H * 1.01, 0.25); top3.castShadow = true; g.add(top3);
    // 树池（加大以匹配大冠幅）
    var ring = new THREE.Mesh(new THREE.RingGeometry(4.0, 5.0, 28), MAT.stone);
    ring.rotation.x = -Math.PI / 2; ring.position.y = LAY.deck + 0.006; g.add(ring);
    plane(5.0 * 2, 5.0 * 2, MAT.earth, 0, LAY.deck, 0, g);
    // 说明牌
    box(1.5, 1.0, 0.12, MAT.stone, 5.5, 0.9, 0, g);
    box(0.12, 0.7, 0.12, MAT.metalDark, 5.5, 0.35, 0, g);
  };

  /* --- 太湖石"虎踞龙盘"：实拍纠正版 —— 宽扁横卧、多孔洞、深灰黑 --- */
  FORMS.rock = function (g, b) {
    var H = b.size[1] || 2.8, W = b.size[0] || 6.5, D = b.size[2] || 3.0;

    // 长方形深色石质基座（与照片一致）
    box(W * 1.10, 0.55, D * 1.05, MAT.rockBase, 0, 0.28, 0, g);
    box(W * 1.18, 0.18, D * 1.12, MAT.stone, 0, 0.62, 0, g);

    function noisyBlob(x, y, z, sx, sy, sz, mat, detail) {
      var geo = new THREE.IcosahedronGeometry(1, detail || 2);
      var pos = geo.attributes.position;
      for (var i = 0; i < pos.count; i++) {
        var px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
        var n = (Math.sin(px * 3.8 + py * 2.3) * Math.cos(pz * 3.1)) * 0.14 +
                (Math.sin(px * 6.7 + pz * 4.5)) * 0.06;
        pos.setXYZ(i, px * (1 + n), py * (1 + n * 0.55), pz * (1 + n * 0.9));
      }
      geo.computeVertexNormals();
      var m = new THREE.Mesh(geo, mat);
      m.scale.set(sx, sy, sz);
      m.position.set(x, y, z);
      m.rotation.set(Math.random() * 0.35, Math.random() * 0.9, Math.random() * 0.25);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
      return m;
    }

    // 主体：宽 > 高，横向延展，左侧略高
    noisyBlob(-W * 0.06, 0.72 + H * 0.18, 0, W * 0.58, H * 0.40, D * 0.50, MAT.rockDark, 2);
    noisyBlob(W * 0.26, 0.65 + H * 0.10, -D * 0.08, W * 0.42, H * 0.26, D * 0.40, MAT.rockGray, 2);
    noisyBlob(-W * 0.32, 0.80 + H * 0.30, D * 0.12, W * 0.28, H * 0.34, D * 0.34, MAT.rockGray, 2);
    noisyBlob(0.05, 0.88 + H * 0.36, -0.04, W * 0.20, H * 0.24, D * 0.22, MAT.rockDark, 1);
    noisyBlob(0.18, 0.70 + H * 0.16, D * 0.18, W * 0.18, H * 0.20, D * 0.16, MAT.rockGray, 1);
    noisyBlob(-0.12, 0.68 + H * 0.08, -D * 0.18, W * 0.24, H * 0.18, D * 0.18, MAT.rockDark, 1);

    // 孔洞：深色内凹球体，模拟太湖石“漏透”特征
    var holeMat = new THREE.MeshBasicMaterial({ color: 0x181818 });
    var holes = [
      [-0.08, 0.75 + H * 0.18, 0.10, W * 0.10],
      [0.16, 0.62 + H * 0.10, -0.04, W * 0.08],
      [-0.30, 0.55 + H * 0.06, 0.06, W * 0.07],
      [0.02, 0.78 + H * 0.30, -0.12, W * 0.06],
      [-0.18, 0.72 + H * 0.22, -0.18, W * 0.05]
    ];
    holes.forEach(function (p) {
      var h = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), holeMat);
      h.scale.set(p[3], p[3] * 1.3, p[3] * 0.9);
      h.position.set(p[0] * W, p[1], p[2] * D);
      g.add(h);
    });

    // 题刻（基座正面阴刻金字）
    var txt = b.inscription || '虎踞龙盤';
    var cv = document.createElement('canvas'); cv.width = 1024; cv.height = 160;
    var cx = cv.getContext('2d');
    cx.fillStyle = '#2a2a2a'; cx.fillRect(0, 0, 1024, 160);
    cx.fillStyle = '#c9a35a';
    cx.font = 'bold 88px "STKaiti","KaiTi","SimSun",serif';
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText(txt, 512, 84);
    var tex = new THREE.CanvasTexture(cv);
    var pl = new THREE.Mesh(
      new THREE.PlaneGeometry(W * 0.90, W * 0.90 * 160 / 1024),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    pl.position.set(0, 0.32, D * 0.56 + 0.02);
    g.add(pl);
  };

  /* --- 楼内场馆/房间标识（如校史馆、国粹馆）： doorway + 悬挂标牌 --- */
  FORMS.room = function (g, b) {
    var w = b.size[0], H = b.size[1];
    var doorW = Math.min(2.4, w * 0.55), doorH = Math.min(3.0, H * 0.72);
    // 门框（石材）
    box(doorW + 0.35, doorH + 0.25, 0.18, MAT.baseStone, 0, doorH / 2 + 0.10, -0.04, g);
    // 门板（内凹深色）
    box(doorW, doorH, 0.10, MAT.door, 0, doorH / 2 + 0.10, 0.02, g);
    // 门楣招牌底板
    var signW = doorW + 0.6, signH = 0.72;
    box(signW, signH, 0.14, MAT.wood, 0, doorH + 0.46, 0.06, g);
    // 招牌文字
    var cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
    var cx = cv.getContext('2d');
    cx.fillStyle = '#5c3a1e'; cx.fillRect(0, 0, 512, 96);
    cx.strokeStyle = '#d4a843'; cx.lineWidth = 4; cx.strokeRect(6, 6, 500, 84);
    cx.fillStyle = '#f5e6c8';
    cx.font = 'bold 52px "STKaiti","KaiTi","SimSun",serif';
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText(b.name, 256, 52);
    var tex = new THREE.CanvasTexture(cv);
    var pl = new THREE.Mesh(
      new THREE.PlaneGeometry(signW * 0.92, signH * 0.78),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    pl.position.set(0, doorH + 0.46, 0.14);
    pl.rotation.y = Math.PI; // 面朝北（-Z），让从北门进入校园的人可见
    g.add(pl);
  };

  /* --- v6 多层玻璃连廊（教学楼群之间的连接体，可见、独立、贴楼） --- */
  FORMS.corr = function (g, b) {
    var w = b.size[0], H = b.size[1], d = b.size[2] || 8;
    var f = b.floors || 2, fh = H / f;
    // 玻璃主体（半透明蓝绿）
    var glass = new THREE.Mesh(
      new THREE.BoxGeometry(w, H, d),
      new THREE.MeshStandardMaterial({ color: 0xb8dde8, transparent: true, opacity: 0.55, roughness: 0.25, metalness: 0.05 })
    );
    glass.position.y = H / 2; glass.castShadow = true; g.add(glass);
    // 每层：楼板 + 前后栏板
    for (var c = 0; c < f; c++) {
      var ly = (c + 0.5) * fh;
      box(w, 0.16, d, MAT.concrete, 0, ly, 0, g);                       // 楼板
      box(w, fh * 0.45, 0.10, MAT.wallPutty, 0, ly + fh * 0.28, d / 2, g);   // 前栏板
      box(w, fh * 0.45, 0.10, MAT.wallPutty, 0, ly + fh * 0.28, -d / 2, g);  // 后栏板
    }
    // 顶棚
    box(w, 0.22, d, MAT.concrete, 0, H + 0.12, 0, g);
  };

  /* --- 塑像 --- */
  FORMS.statue = function (g, b) {
    var H = b.size[2] || 5;
    box(2.6, 1.5, 2.6, MAT.stone, 0, 0.75, 0, g);            // 基座
    box(3.0, 0.22, 3.0, MAT.marble, 0, 1.6, 0, g);
    var bodyH = H - 1.7;
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.78, bodyH, 10), MAT.marble);
    body.position.y = 1.7 + bodyH / 2; body.castShadow = true; g.add(body);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.46, 12, 10), MAT.marble);
    head.position.y = 1.7 + bodyH + 0.4; head.castShadow = true; g.add(head);
    box(0.5, 0.5, 0.5, MAT.marble, 0, 1.7 + bodyH - 0.1, 0, g);
  };
  FORMS.statue_group = function (g, b) {
    var H = b.size[2] || 5;
    box(4.4, 1.3, 3.2, MAT.stone, 0, 0.65, 0, g);
    box(4.8, 0.24, 3.6, MAT.bronze, 0, 1.38, 0, g);
    var rnd = mulberry(b.id);
    for (var i = 0; i < 3; i++) {
      var px = (i - 1) * 1.35, hh = (H - 1.5) * (0.82 + rnd() * 0.3);
      var body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.46, hh, 9), MAT.bronze);
      body.position.set(px, 1.5 + hh / 2, (rnd() - 0.5) * 0.5);
      body.castShadow = true; g.add(body);
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 10, 8), MAT.bronze);
      head.position.set(px, 1.5 + hh + 0.3, body.position.z); head.castShadow = true; g.add(head);
    }
  };

  /* 稳定伪随机 */
  function mulberry(seed) {
    var h = 1779033703 ^ String(seed).length;
    for (var i = 0; i < String(seed).length; i++) {
      h = Math.imul(h ^ String(seed).charCodeAt(i), 3432918353); h = h << 13 | h >>> 19;
    }
    return function () {
      h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }

  /* ================= 建筑组装 ================= */
  function createBuilding(b, cfg) {
    var g = new THREE.Group();
    g.userData.id = b.id;
    g.userData.data = b;
    var o = rectWorld(b.rect);
    if (!b.size[2]) b.size[2] = o.d;          // 园林/水景/运动场：深度取自平面轮廓
    var fn = FORMS[b.form];
    if (!fn) {                       // 兜底：素块
      var H = b.size[1] || 6;
      box(b.size[0], H, b.size[2], MAT.wallCream, 0, H / 2, 0, g);
      var p = parapet(b.size[0], b.size[2], 0.9, 0.26, MAT.parapet, MAT.wallPutty);
      p.position.y = H; g.add(p);
    } else {
      fn(g, b, o);
    }
    g.position.set(o.x, 0, o.z);
    if (b.rot) g.rotation.y = b.rot;
    // 【v13】登记占地：水体按实际轮廓，其余按建筑外沿；供路灯/小品避让
    if (b.form === 'pond') markOccupied(o.x, o.z, o.w, o.d, 'water');
    else markOccupied(o.x, o.z, b.size[0], b.size[2], 'bldg');
    // 接触阴影（AO 近似：底部一圈暗面）
    // 【v13 修复】此前 y=0.14 高于路面(0.045)/广场(0.055)，AO 会盖在道路和相邻铺装上，
    //   且缺少 polygonOffset 会与地面共面闪烁（z-fighting）。
    //   水景不落 AO（水面本就有自身阴影关系）。
    if (cfg.shadow > 0 && b.size[1] > 1 && b.form !== 'pond') {
      var ao = new THREE.Mesh(
        new THREE.PlaneGeometry(b.size[0] * 1.10, b.size[2] * 1.10),
        new THREE.MeshBasicMaterial({
          color: 0x000000, transparent: true, opacity: 0.15,
          depthWrite: false,
          polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
        })
      );
      ao.rotation.x = -Math.PI / 2;
      ao.position.y = LAY.field + 0.01;   // 草坪之上、路面之下（不污染铺装与道路）
      ao.renderOrder = 1;
      g.add(ao);
    }
    return g;
  }

  /* ================= 程序化纹理（路面颗粒 / 草地变化 / 天空） ================= */
  function noiseTex(base, spots, size, alpha) {
    var c = document.createElement('canvas'); c.width = c.height = size;
    var x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, size, size);
    for (var i = 0; i < spots; i++) {
      var r = 1 + Math.random() * 3;
      x.fillStyle = 'rgba(' + (Math.random() * 60 - 30 | 0) + ',' + (Math.random() * 60 - 30 | 0) + ',' + (Math.random() * 60 - 30 | 0) + ',' + (alpha || 0.16) + ')';
      x.beginPath(); x.arc(Math.random() * size, Math.random() * size, r, 0, 6.283); x.fill();
    }
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  function skyTex(top, mid, bot, horizon) {
    var c = document.createElement('canvas'); c.width = 8; c.height = 512;
    var x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, top); g.addColorStop(0.42, mid); g.addColorStop(0.74, horizon); g.addColorStop(1, bot);
    x.fillStyle = g; x.fillRect(0, 0, 8, 512);
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace !== undefined ? THREE.SRGBColorSpace : undefined;
    return t;
  }

  /* 天空贴图缓存：调色板是有限的（时段 × 天气 × 昼夜），
     此前每次 applyLighting 都新建 canvas 贴图并 dispose 旧的，
     切时段时会频繁分配/释放 GPU 纹理。这里按色值缓存复用。 */
  var skyCache = {};
  function getSkyTex(top, mid, bot, horizon) {
    var k = top + '|' + mid + '|' + bot + '|' + horizon;
    if (!skyCache[k]) skyCache[k] = skyTex(top, mid, bot, horizon);
    return skyCache[k];
  }

  /* ================= 地表高度分层（v13） =================
     此前各层地表 Y 值散乱（0.015/0.03/0.045/0.055/0.06/0.07/0.08/0.10/0.12），
     层间仅差 0.01~0.02，在远景相机下会互相穿插闪烁（z-fighting）。
     这里统一为常量分层，层间距 ≥0.03，并按「从下到上」的语义命名。 */
  var LAY = {
    base:     -0.02,   // 校园外大地
    lawn:      0.015,  // 校园草坪底
    lawnPatch: 0.045,  // 绿地组团
    field:     0.075,  // 运动场内场 / 球场
    deck:      0.105,  // 铺装、广场、园路
    mark:      0.135,  // 场地白线
    water:     0.165,  // 水面
    prop:      0.195   // 贴地小品（睡莲、景石座等）
  };

  /* ================= 地面 / 道路 / 绿地 / 水景 ================= */
  function buildGround(cfg) {
    var G = data.meta.ground, W = G.width, D = G.depth;
    // 大地（校园外也铺一层，避免看到虚空）
    var base = plane(W * 2.6, D * 2.6, M('#54654f', 0.98), 0, LAY.base, 0, scene);
    base.receiveShadow = false;
    // 校园草坪底：底色压亮、靠贴图提供细节，避免大面积纯色的「塑料感」
    groundMat = M('#ffffff', 0.97);
    var grassTex = noiseTex('#638052', 3000, 512, 0.14);
    grassTex.repeat.set(30, 26);
    grassTex.anisotropy = cfg.aniso || 1;
    groundMat.map = grassTex;
    groundMat.color.set('#9cb98a');
    var lawn = plane(W, D, groundMat, 0, LAY.lawn, 0, scene);
    lawn.receiveShadow = cfg.shadow > 0;

    // 绿地组团
    (data.lawns || []).forEach(function (L) {
      var o = rectWorld(L.rect);
      // 【官网实证】校园草坪为台湾草（细叶结缕草，色偏黄绿）
      var mat = L.kind === 'lawn' ? MAT.grassTaiwan : (L.kind === 'botanic' ? MAT.grassDark : M('#54744a', 0.97));
      var m = plane(o.w, o.d, mat, o.x, LAY.lawnPatch, o.z, scene);
      m.receiveShadow = cfg.shadow > 0;
    });

    // 道路
    var roadTex = noiseTex('#a5a29a', 3200, 256, 0.2);
    roadTex.anisotropy = cfg.aniso || 1;
    // 【v13】路缘石材质提到循环外：此前每遍历一条道路都 new 一个材质，
    //   11 条路 = 11 份完全相同的实例，既浪费显存也让路缘石无法被合批。
    var kerbMat = M('#c8c3b8', 0.93);
    // 路面材质不能简单共用：下面会为每条路按自身尺寸 clone 贴图并写入 mat.map，
    // 若共用材质，所有路都会用最后一条路的 UV 重复率（大路纹理被拉花）。
    // 故按 kind 缓存基础参数，仅当需要贴图时为该路单独建一份材质。
    var roadMatBase = {
      plaza: ['#c2bcb0', 0.93],
      path: ['#b6b1a7', 0.94],
      road: ['#9c9991', 0.95]
    };
    var plazaMat = M(roadMatBase.plaza[0], roadMatBase.plaza[1]);
    (data.roads || []).forEach(function (R) {
      var bp = roadMatBase[R.kind] || roadMatBase.road;
      var yRoad = LAY.deck;
      var o = rectWorld(R.rect);
      // 先解析材质：需贴图的道路各自持有一份（避免共享 UV 导致纹理拉伸），
      // 广场类无贴图则复用同一实例。必须在 poly / rect 两个分支之前完成，
      // 否则 poly 分支会读到未初始化的 mat。
      var mat;
      if (R.kind !== 'plaza') {
        var t = roadTex.clone(); t.needsUpdate = true;
        t.repeat.set(Math.max(2, o.w / 12), Math.max(2, o.d / 12));
        mat = M(bp[0], bp[1]); mat.map = t;
      } else {
        mat = plazaMat;
      }
      // 多边形校道（来自 KML 实测形状）：铺设真实道路面，保留路网走向
      if (R.poly && R.poly.length >= 3) {
        var shape = new THREE.Shape();
        R.poly.forEach(function (p, i) {
          var X = p[0], Z = p[1];
          if (i === 0) shape.moveTo(X, -Z); else shape.lineTo(X, -Z);
        });
        shape.closePath();
        var gP = new THREE.ShapeGeometry(shape);
        var mP = new THREE.Mesh(gP, mat);
        mP.rotation.x = -Math.PI / 2;
        mP.position.y = yRoad;
        mP.receiveShadow = cfg.shadow > 0;
        scene.add(mP);
        roadMats.push(mat);
        return;
      }
      var m = plane(o.w, o.d, mat, o.x, yRoad, o.z, scene);
      m.receiveShadow = cfg.shadow > 0;
      roadMats.push(mat);
      // 路缘石（细边，提升真实感）
      if (R.kind !== 'plaza') {
        var t2 = 0.34, kh = 0.18;
        [[0, o.d / 2, o.w, t2], [0, -o.d / 2, o.w, t2], [o.w / 2, 0, t2, o.d], [-o.w / 2, 0, t2, o.d]].forEach(function (s) {
          // 路缘石下沿贴到草坪层，避免悬空
          var k = box(s[2], kh, s[3], kerbMat, o.x + s[0], LAY.deck - kh / 2 + 0.02, o.z + s[1], scene);
          k.castShadow = false;
        });
      }
    });

    // 水景（砚池）
    // 【v13 加固】此前 waterMat 在函数末尾才赋值，若 buildGround 中途出错，
    //   FORMS.pond 会拿到 undefined 并静默丢失水面。改为惰性工厂 + 兜底默认值。
    ensureWaterMat();
  }

  /* 水面材质：惰性创建，任何调用方都能安全取得实例 */
  function ensureWaterMat() {
    if (!waterMat) {
      waterMat = M('#4e6f7a', 0.05, 0.30, {
        transparent: true,
        opacity: 0.92,
        envMapIntensity: 1.2
      });
    }
    return waterMat;
  }

  /* ================= 植被（多种形态 · 每棵各不相同） ================= */
  function mergeGeos(items) {
    var P = [], N = [], C = [];
    var m3 = new THREE.Matrix3(), v = new THREE.Vector3(), nv = new THREE.Vector3();
    // 【v13 修复】此前每个 item 的源几何体（TREE_MAKERS 每株树会现场 new 出几十个
    //   CylinderGeometry/BoxGeometry/IcosahedronGeometry）在合并后既不 dispose 也不回收：
    //   JS 对象虽可被 GC，但对应的 WebGLBuffer 必须显式 dispose 才会从显存释放。
    //   300 棵树 × 每株数十个部件 = 上千个孤儿缓冲常驻。现在合并完成后立即释放。
    items.forEach(function (it) {
      var src = it.geo;
      var g = src.index ? src.toNonIndexed() : src;
      var pos = g.attributes.position, nor = g.attributes.normal;
      if (!pos) { src.dispose(); return; }
      m3.getNormalMatrix(it.matrix);
      for (var i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(it.matrix);
        P.push(v.x, v.y, v.z);
        if (nor) { nv.fromBufferAttribute(nor, i).applyMatrix3(m3).normalize(); N.push(nv.x, nv.y, nv.z); }
        else N.push(0, 1, 0);
        C.push(it.color.r, it.color.g, it.color.b);
      }
      // toNonIndexed() 产生的是中间副本，一并释放；源几何体随后也释放
      if (g !== src) g.dispose();
      src.dispose();
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    geo.computeBoundingSphere();
    return geo;
  }
  function mat4(x, y, z, rx, ry, rz, sx, sy, sz) {
    var m = new THREE.Matrix4();
    m.compose(new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)),
      new THREE.Vector3(sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz));
    return m;
  }
  var TREE_MAKERS = {
    // 椰树：细高微弯树干 + 放射状叶片
    palm: function (v) {
      var h = 13 + v * 2.4, lean = (v - 1) * 0.045, items = [];
      var seg = 5;
      for (var i = 0; i < seg; i++) {
        var t = i / seg, r0 = 0.42 - t * 0.16, r1 = 0.42 - (t + 1 / seg) * 0.16;
        var sh = h / seg;
        items.push({
          geo: new THREE.CylinderGeometry(r1, r0, sh, 7),
          matrix: mat4(Math.sin(t * 1.5) * lean * h, sh * (i + 0.5), Math.cos(t * 1.2) * lean * h * 0.4, 0, 0, -lean * 1.4, 1, 1, 1),
          color: new THREE.Color('#7a6750')
        });
      }
      var topY = h, tx = Math.sin(1.5) * lean * h, tz = Math.cos(1.2) * lean * h * 0.4;
      var nleaf = 9;
      for (var L = 0; L < nleaf; L++) {
        var a = L / nleaf * Math.PI * 2 + v * 0.7;
        var droop = -0.42 - (L % 3) * 0.12;
        items.push({
          geo: new THREE.BoxGeometry(0.34, 0.1, 5.6),
          matrix: mat4(Math.cos(a) * 2.5, 0.42, Math.sin(a) * 2.5, 0, -a, droop).premultiply(mat4(tx, topY, tz, 0, 0, 0)),
          color: new THREE.Color(L % 3 === 0 ? '#4a7550' : '#3f6b48')
        });
      }
      items.push({ geo: new THREE.IcosahedronGeometry(0.72, 0), matrix: mat4(tx, topY - 0.2, tz, 0, 0, 0), color: new THREE.Color('#3f6b48') });
      return items;
    },
    // 榕树：粗干 + 不规则大冠
    banyan: function (v) {
      var h = 6.5 + v * 1.8, items = [];
      items.push({ geo: new THREE.CylinderGeometry(0.52, 0.95, h, 8), matrix: mat4(0, h / 2, 0), color: new THREE.Color('#6e5c46') });
      // 分枝
      for (var b = 0; b < 3; b++) {
        var a = b / 3 * Math.PI * 2 + v;
        items.push({
          geo: new THREE.CylinderGeometry(0.16, 0.3, h * 0.5, 6),
          matrix: mat4(Math.cos(a) * 0.9, h * 0.78, Math.sin(a) * 0.9, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5),
          color: new THREE.Color('#6e5c46')
        });
      }
      var cr = 3.5 + v * 0.7;
      var blobs = [[0, 0.9, 0, 1.0], [0.9, 0.5, 0.5, 0.8], [-0.8, 0.55, -0.4, 0.78], [0.2, 1.25, -0.8, 0.7]];
      blobs.forEach(function (bl, i) {
        items.push({
          geo: new THREE.IcosahedronGeometry(cr * bl[3], 0),
          matrix: mat4(bl[0] * cr * 0.42, h + cr * bl[1] * 0.6, bl[2] * cr * 0.42, i * 0.7, i * 1.3, i * 0.4),
          color: new THREE.Color(i % 2 ? '#4a7550' : '#375e40')
        });
      });
      return items;
    },
    // 榄仁树：直干 + 典型层状枝
    terminalia: function (v) {
      var h = 10 + v * 2.2, items = [];
      items.push({ geo: new THREE.CylinderGeometry(0.38, 0.72, h, 8), matrix: mat4(0, h / 2, 0), color: new THREE.Color('#6e5c46') });
      var layers = 3, baseR = 4.2 + v * 0.6;
      for (var L = 0; L < layers; L++) {
        var ly = h * (0.66 + L * 0.14), lr = baseR * (1 - L * 0.24);
        items.push({
          geo: new THREE.CylinderGeometry(lr, lr * 0.94, 0.42, 12),
          matrix: mat4((v - 1) * 0.4, ly, 0, 0, L * 0.5, 0),
          color: new THREE.Color(L % 2 ? '#4a7550' : '#3f6b48')
        });
        // 层缘不规则叶团
        for (var k = 0; k < 4; k++) {
          var a = k / 4 * Math.PI * 2 + L * 0.8 + v;
          items.push({
            geo: new THREE.IcosahedronGeometry(lr * 0.34, 0),
            matrix: mat4(Math.cos(a) * lr * 0.78, ly + 0.4, Math.sin(a) * lr * 0.78, a, a * 0.6, 0),
            color: new THREE.Color('#375e40')
          });
        }
      }
      return items;
    },
    // 木棉：高大直干 + 疏朗枝冠
    kapok: function (v) {
      var h = 12 + v * 2.6, items = [];
      items.push({ geo: new THREE.CylinderGeometry(0.4, 0.95, h, 8), matrix: mat4(0, h / 2, 0), color: new THREE.Color('#736352') });
      for (var b = 0; b < 5; b++) {
        var a = b / 5 * Math.PI * 2 + v, ly = h * (0.72 + (b % 2) * 0.12);
        items.push({
          geo: new THREE.CylinderGeometry(0.1, 0.22, h * 0.34, 5),
          matrix: mat4(Math.cos(a) * 1.1, ly, Math.sin(a) * 1.1, Math.sin(a) * 0.62, 0, -Math.cos(a) * 0.62),
          color: new THREE.Color('#736352')
        });
        items.push({
          geo: new THREE.IcosahedronGeometry(1.5 + (b % 2) * 0.5, 0),
          matrix: mat4(Math.cos(a) * 2.6, ly + h * 0.16, Math.sin(a) * 2.6, a, a, 0, 1, 0.7, 1),
          color: new THREE.Color(b % 2 ? '#4a7550' : '#3f6b48')
        });
      }
      return items;
    },
    // 重阳木：高大落叶乔木，卵圆形浓密树冠【官网绿化名录】
    chongyang: function (v) {
      var h = 9.5 + v * 2.6, items = [];
      items.push({ geo: new THREE.CylinderGeometry(0.44, 0.92, h, 8), matrix: mat4(0, h / 2, 0), color: new THREE.Color('#6b5a44') });
      for (var b = 0; b < 4; b++) {
        var a = b / 4 * Math.PI * 2 + v;
        items.push({
          geo: new THREE.CylinderGeometry(0.13, 0.26, h * 0.42, 6),
          matrix: mat4(Math.cos(a) * 1.0, h * 0.8, Math.sin(a) * 1.0, Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55),
          color: new THREE.Color('#6b5a44')
        });
      }
      var cr = 3.6 + v * 0.8;
      var blobs = [[0, 1.0, 0, 1.0], [1.0, 0.62, 0.45, 0.82], [-0.95, 0.60, -0.50, 0.80], [0.35, 1.15, -0.90, 0.74], [-0.40, 0.95, 0.95, 0.70]];
      blobs.forEach(function (bl, i) {
        items.push({
          geo: new THREE.IcosahedronGeometry(cr * bl[3], 0),
          matrix: mat4(bl[0] * cr * 0.44, h + cr * bl[1] * 0.55, bl[2] * cr * 0.44, i * 0.5, i * 1.1, i * 0.3),
          color: new THREE.Color(i % 2 ? '#48734d' : '#3a6244')
        });
      });
      return items;
    },
    // 海南红豆：常绿乔木，浓密球形冠【官网绿化名录】
    hongdou: function (v) {
      var h = 7.5 + v * 1.8, items = [];
      items.push({ geo: new THREE.CylinderGeometry(0.36, 0.74, h, 8), matrix: mat4(0, h / 2, 0), color: new THREE.Color('#6e5c46') });
      var cr = 3.0 + v * 0.6;
      for (var i = 0; i < 7; i++) {
        var a = i / 7 * Math.PI * 2 + v, rad = i === 0 ? 0 : cr * 0.55;
        items.push({
          geo: new THREE.IcosahedronGeometry(cr * (i === 0 ? 0.92 : 0.62), 0),
          matrix: mat4(Math.cos(a) * rad, h + cr * (i === 0 ? 0.66 : 0.66 + (i % 2) * 0.22), Math.sin(a) * rad, i, i * 0.8, i * 0.5),
          color: new THREE.Color(i % 3 === 0 ? '#3f6b48' : '#35573c')
        });
      }
      return items;
    },
    // 黄花风铃木：伞形冠，盛花期满树金黄【官网绿化名录】
    fengling: function (v) {
      var h = 5.5 + v * 1.4, items = [];
      items.push({ geo: new THREE.CylinderGeometry(0.28, 0.52, h, 7), matrix: mat4(0, h / 2, 0), color: new THREE.Color('#7a6a52') });
      for (var b = 0; b < 5; b++) {
        var a = b / 5 * Math.PI * 2 + v;
        items.push({
          geo: new THREE.CylinderGeometry(0.09, 0.18, h * 0.36, 5),
          matrix: mat4(Math.cos(a) * 0.85, h * 0.82, Math.sin(a) * 0.85, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5),
          color: new THREE.Color('#7a6a52')
        });
      }
      var cr = 2.8 + v * 0.5;
      for (var i = 0; i < 9; i++) {
        var aa = i / 9 * Math.PI * 2 + v * 1.3, rr = i === 0 ? 0 : cr * 0.62;
        items.push({
          geo: new THREE.IcosahedronGeometry(cr * (i === 0 ? 0.80 : 0.50), 0),
          matrix: mat4(Math.cos(aa) * rr, h + cr * 0.5 + (i % 2) * 0.3, Math.sin(aa) * rr, i, i * 0.9, 0),
          color: new THREE.Color(i % 2 ? '#e9c752' : '#f2d76a')   // 金黄色花冠
        });
      }
      return items;
    },
    // 火焰木：常绿乔木，橙红色花序顶生【官网绿化名录】
    huoyan: function (v) {
      var h = 8 + v * 2.0, items = [];
      items.push({ geo: new THREE.CylinderGeometry(0.34, 0.68, h, 7), matrix: mat4(0, h / 2, 0), color: new THREE.Color('#6f5f49') });
      var cr = 3.1 + v * 0.6;
      for (var i = 0; i < 6; i++) {
        var a = i / 6 * Math.PI * 2 + v, rad = i === 0 ? 0 : cr * 0.58;
        items.push({
          geo: new THREE.IcosahedronGeometry(cr * (i === 0 ? 0.88 : 0.58), 0),
          matrix: mat4(Math.cos(a) * rad, h + cr * 0.58 + (i % 2) * 0.26, Math.sin(a) * rad, i, i * 1.2, 0),
          color: new THREE.Color(i % 2 ? '#3f6b48' : '#35573c')
        });
      }
      for (var k = 0; k < 5; k++) {
        var ak = k / 5 * Math.PI * 2 + v * 0.6;
        items.push({
          geo: new THREE.IcosahedronGeometry(0.95, 0),
          matrix: mat4(Math.cos(ak) * cr * 0.5, h + cr * 1.15, Math.sin(ak) * cr * 0.5, k, k, 0),
          color: new THREE.Color(k % 2 ? '#d4572c' : '#e2703c')   // 橙红色花序
        });
      }
      return items;
    },
    // 灌木
    shrub: function (v) {
      var items = [], n = 2 + (v % 2);
      for (var i = 0; i < n; i++) {
        var a = i / n * 6.283 + v;
        items.push({
          geo: new THREE.IcosahedronGeometry(0.95 + (i % 2) * 0.35, 0),
          matrix: mat4(Math.cos(a) * 0.55, 0.85 + (i % 2) * 0.25, Math.sin(a) * 0.55, i, i * 1.7, i * 0.6),
          color: new THREE.Color(i % 2 ? '#4a7550' : '#3f6b48')
        });
      }
      return items;
    },
    // 植物园热带植物（变体差异大）
    botanic: function (v) {
      if (v < 0.34) return TREE_MAKERS.palm(v * 3);
      if (v < 0.67) return TREE_MAKERS.shrub(v * 3);
      var h = 3.4 + v * 1.6, items = [];
      items.push({ geo: new THREE.CylinderGeometry(0.2, 0.32, h, 6), matrix: mat4(0, h / 2, 0), color: new THREE.Color('#6e5c46') });
      for (var i = 0; i < 6; i++) {
        var a = i / 6 * Math.PI * 2;
        items.push({
          geo: new THREE.BoxGeometry(1.9, 0.08, 0.85),
          matrix: mat4(Math.cos(a) * 1.0, h + 0.2 + (i % 2) * 0.3, Math.sin(a) * 1.0, 0.3, -a, 0.2),
          color: new THREE.Color(i % 2 ? '#5c8148' : '#4a7550')
        });
      }
      return items;
    },
    mixed: function (v) { return v < 0.5 ? TREE_MAKERS.banyan(v * 2) : TREE_MAKERS.terminalia(v * 2); }
  };

  function buildVegetation(cfg) {
    var list = data.trees || [];
    if (!list.length) return;
    // 【v13 修复】原始树点数据里有约 20% 落在建筑轮廓内或水面上（实测 300 棵中 61 棵，
    //   其中 53 棵穿楼、26 棵泡在水里，含部分重叠）。此前直接按点建树，
    //   于是树干从屋顶穿出、树冠悬在砚池当中。这里先做一次占地过滤再分组。
    list = list.filter(function (t) {
      return !isOccupied(wx(t.p[0]), wz(t.p[1]), 0.8);
    });
    if (!list.length) return 0;
    // 按 类型×变体 分组
    var groups = {};
    list.forEach(function (t) {
      var key = t.t + '|' + t.v;
      (groups[key] = groups[key] || { t: t.t, v: t.v, items: [] }).items.push(t);
    });
    var mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.0, flatShading: true });
    var total = 0;
    Object.keys(groups).forEach(function (key) {
      var gp = groups[key];
      var maker = TREE_MAKERS[gp.t] || TREE_MAKERS.banyan;
      var geo = mergeGeos(maker(gp.v / 2));          // 变体 v∈{0,1,2} → 0~1
      var im = new THREE.InstancedMesh(geo, mat, gp.items.length);
      im.castShadow = cfg.shadow > 0;
      im.receiveShadow = false;
      var d = new THREE.Object3D();
      gp.items.forEach(function (t, i) {
        var x = wx(t.p[0]), z = wz(t.p[1]);
        d.position.set(x, 0, z);
        d.rotation.set(0, t.r, 0);
        d.scale.set(t.s, t.h, t.s);
        d.updateMatrix();
        im.setMatrixAt(i, d.matrix);
      });
      im.instanceMatrix.needsUpdate = true;
      im.count = Math.max(1, Math.round(gp.items.length * cfg.treeK));
      im.frustumCulled = true;
      scene.add(im);
      treeMeshes.push(im);
      total += im.count;
    });
    return total;
  }

  function buildLamps(cfg) {
    var g = new THREE.Group();
    if (!cfg.lamps) { scene.add(g); return g; }
    var poleMat = M('#4a5257', 0.72, 0.2);
    var headMat = M('#e8d9b8', 0.5, 0.0, { emissive: new THREE.Color('#ffc06a'), emissiveIntensity: 0, side: THREE.DoubleSide });
    // 【v13 修复】此前把所有 road 都当成「细长车道」处理，灯杆一律偏出 0.72×半宽：
    //   对 9m 宽的园路（偏移 3.26m）尚可，但对 200m+ 宽的铺装广场就会把灯杆
    //   丢到广场正中央，既不合理也不好看。现在按路宽分档：
    //     · 真正的道路（短轴 ≤ 26m）：沿路缘内侧成列布置，左右交替；
    //     · 大面积铺装（短轴 > 26m）：只沿长边两侧各布一排，中间不落灯。
    //   同时改为共享 geometry/material —— 原先每根灯杆都现场 new 3 份几何体 +
    //   clone 材质，共 ~100 根，等于 300 个一次性几何体常驻显存。
    var poleGeo = new THREE.CylinderGeometry(0.13, 0.18, 7.5, 6);
    var armGeo = new THREE.BoxGeometry(1.3, 0.12, 0.12);
    var headGeo = new THREE.BoxGeometry(0.9, 0.26, 0.5);
    var spots = [];
    (data.roads || []).forEach(function (R) {
      var o = rectWorld(R.rect);
      var horiz = o.w > o.d;                          // 走向沿 X 轴
      var L = horiz ? o.w : o.d;                      // 沿走向的长度
      var roadW = horiz ? o.d : o.w;                  // 垂直于走向的宽度
      var n = Math.max(2, Math.round(L / 26));
      // 灯位距路中线的横向偏移：贴在路缘内侧约 0.55m 处
      var off = Math.max(0.6, roadW / 2 - 0.55);
      for (var i = 0; i < n; i++) {
        var t = (i + 0.5) / n;
        var side = (i % 2 === 0) ? 1 : -1;            // 左右交替，接近真实路灯排布
        var px, pz;
        if (horiz) { px = o.x - o.w / 2 + t * o.w; pz = o.z + side * off; }
        else { px = o.x + side * off; pz = o.z - o.d / 2 + t * o.d; }
        // 【v13】避让建筑与水面：校道是大块铺装区，成列布灯会穿楼。留 1.2m 净距。
        if (isOccupied(px, pz, 1.2)) continue;
        if (horiz) spots.push([px, pz, side]);
        else spots.push([px, pz, 0, side]);
      }
    });
    spots.forEach(function (p) {
      var horiz = p[2] !== 0;
      var side = horiz ? p[2] : p[3];
      var pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(p[0], LAY.deck + 3.75, p[1]); pole.castShadow = false; g.add(pole);
      // 灯臂朝路面中心伸出
      var dirX = horiz ? 0 : -side;
      var dirZ = horiz ? -side : 0;
      var arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.set(p[0] + dirX * 0.5, LAY.deck + 7.4, p[1] + dirZ * 0.5);
      arm.rotation.y = horiz ? Math.PI / 2 : 0;
      g.add(arm);
      var head = new THREE.Mesh(headGeo, headMat);
      head.position.set(p[0] + dirX * 1.0, LAY.deck + 7.28, p[1] + dirZ * 1.0);
      head.rotation.y = horiz ? Math.PI / 2 : 0;
      g.add(head);
      lampLamps.push(head);
    });
    scene.add(g);
    return g;
  }

  /* ================= 天空 / 光照 / 雨 ================= */
  function applyLighting() {
    var t = TIMES[state.night ? 5 : state.time];
    var wx2 = WEATHER[state.weather];
    var night = state.night;
    var LK_sun = 0.58, LK_hemi = 0.32, LK_amb = 0.14; // 高光、低环境，增强立体感
    var sunI = t.dir * wx2.dirK * LK_sun * (night ? 0.25 : 1);
    var hemiI = t.hemi * wx2.hemiK * LK_hemi * (night ? 0.60 : 1);

    sunLight.color.set(night ? '#8fb0d0' : t.sun);
    sunLight.intensity = sunI;
    sunLight.position.set(t.sunX * 400, Math.max(10, t.sunY * 420), t.sunZ * 400);

    hemiLight.intensity = hemiI;
    hemiLight.color.set(night ? '#1d2f42' : t.bot);
    hemiLight.groundColor.set(state.weather === 'rain' ? '#2b3a34' : '#2f4030');

    ambLight.intensity = t.amb * wx2.hemiK * LK_amb;

    scene.fog.color.set(night ? '#0d1c2a' : t.fog);
    scene.fog.density = wx2.fog * (night ? 1.25 : 1);

    if (skyMesh) {
      var top = '#0a1826', mid = '#152a40', hor = '#1e3a52', bot = '#16304a';
      if (!night) {
        if (state.weather === 'rain') { top = '#404c56'; mid = '#4d5860'; hor = '#5d666e'; bot = '#666e74'; }
        else if (state.weather === 'cloudy') { top = '#6d8598'; mid = '#8ba3b2'; hor = '#a8b8c0'; bot = '#b4bfc4'; }
        else { top = t.top; mid = t.top; hor = t.bot; bot = t.bot; }
      }
      // 走缓存：不再每次 dispose + 新建贴图（避免切换时段时的 GPU 纹理抖动）
      var tex = getSkyTex(top, mid, bot, hor);
      if (skyMesh.material.map !== tex) {
        skyMesh.material.map = tex;
        skyMesh.material.needsUpdate = true;
      }
    }
    if (groundMat) groundMat.roughness = wx2.groundRough;
    roadMats.forEach(function (m) { m.roughness = wx2.groundRough; });
    if (waterMat) { waterMat.roughness = state.weather === 'rain' ? 0.24 : 0.06; }

    var lampOn = night || state.time >= 5 || state.weather === 'rain';
    lampLamps.forEach(function (l) { l.material.emissiveIntensity = lampOn ? 1.1 : 0; });

    if (rainSys) rainSys.visible = wx2.rain && QCFG[state.quality].rain > 0;
  }

  function createRain() {
    var n = QCFG[state.quality].rain;
    if (!n) { rainSys = null; return; }
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 420;
      pos[i * 3 + 1] = Math.random() * 130;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 360;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    rainSys = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xa8c4d4, size: 0.42, transparent: true, opacity: 0.42, depthWrite: false }));
    rainSys.visible = false;
    scene.add(rainSys);
  }

  /* ================= POI ================= */
  function buildPOIs() {
    var layer = $('#poiLayer');
    if (!layer) return;
    layer.innerHTML = '';
    poiEls = [];
    poiSig = '';
    (data.buildings || []).forEach(function (b) {
      if (!b.poi) return;
      var o = rectWorld(b.rect);
      var e = el('div', 'poi');
      e.innerHTML = '<span class="dot"></span><span>' + b.name + '</span>';
      e.setAttribute('data-id', b.id);
      e.addEventListener('click', function () { selectBuilding(b.id, true); });
      layer.appendChild(e);
      var top = b.form === 'oldtree' ? (b.size[1] || 18) : (b.size[1] || 3);
      poiEls.push({ el: e, id: b.id, pos: new THREE.Vector3(o.x, top + 5.5, o.z),
                    x: null, y: null, s: -1, hidden: null, on: null });
    });
  }
  function updatePOIs() {
    if (!poiEls.length) return;
    var w = window.innerWidth, h = window.innerHeight, v = new THREE.Vector3();
    // 相机/视口没变时直接跳过，避免逐帧写 DOM 样式触发布局
    var sig = camera.position.x.toFixed(2) + ',' + camera.position.y.toFixed(2) + ',' + camera.position.z.toFixed(2) +
              ',' + camera.quaternion.x.toFixed(4) + ',' + camera.quaternion.y.toFixed(4) + ',' +
              camera.quaternion.z.toFixed(4) + ',' + camera.quaternion.w.toFixed(4) + ',' + w + 'x' + h;
    if (sig === poiSig) return;
    poiSig = sig;

    for (var i = 0; i < poiEls.length; i++) {
      var p = poiEls[i];
      v.copy(p.pos);
      var dist = v.distanceTo(camera.position);
      v.project(camera);
      var behind = v.z > 1;
      var x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
      var off = x < -60 || x > w + 60 || y < -40 || y > h + 40;
      var hide = behind || off || dist > 300;
      if (hide !== p.hidden) { p.el.classList.toggle('hidden', hide); p.hidden = hide; }
      if (hide) continue;
      if (x !== p.x || y !== p.y) {
        // 写入相对视口中心的偏移量；自身居中由 CSS 的 translate(-50%,-50%) 负责
        p.el.style.setProperty('--poi-x', (x - w / 2).toFixed(1) + 'px');
        p.el.style.setProperty('--poi-y', (y - h / 2).toFixed(1) + 'px');
        p.x = x; p.y = y;
      }
      var s = Math.max(0.72, Math.min(1, 190 / Math.max(55, dist)));
      if (Math.abs(s - p.s) > 0.01) { p.el.style.setProperty('--poi-s', s.toFixed(2)); p.s = s; }
      var on = state.selected === p.id;
      if (on !== p.on) { p.el.classList.toggle('is-on', on); p.on = on; }
    }
  }

  /* ================= 小地图 ================= */
  var mmSvg = null, mmCam = null, mmShapes = [];
  var mmLast = 0, mmPx = 1e9, mmPz = 1e9, mmPr = 1e9, mmSel = null;

  function buildMinimap() {
    var mm = $('#minimap');
    if (!mm) return;
    var NS = 'http://www.w3.org/2000/svg';
    var G = data.meta.ground, W = G.width, D = G.depth;
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', (-W / 2) + ' ' + (-D / 2) + ' ' + W + ' ' + D);
    function rect(r, fill, cls) {
      var o = rectWorld(r);
      var e = document.createElementNS(NS, 'rect');
      e.setAttribute('x', (o.x - o.w / 2).toFixed(1)); e.setAttribute('y', (o.z - o.d / 2).toFixed(1));
      e.setAttribute('width', o.w.toFixed(1)); e.setAttribute('height', o.d.toFixed(1));
      e.setAttribute('fill', fill); if (cls) e.setAttribute('class', cls);
      svg.appendChild(e); return e;
    }
    (data.lawns || []).forEach(function (L) { rect(L.rect, 'rgba(120,180,130,.20)'); });
    (data.water || []).forEach(function (Wt) { rect(Wt.rect, 'rgba(110,168,186,.55)'); });
    (data.fields || []).forEach(function (F) { rect(F.rect, 'rgba(160,96,70,.28)'); });
    (data.roads || []).forEach(function (R) {
      if (R.poly && R.poly.length >= 3) {
        var dpath = '';
        R.poly.forEach(function (p, i) {
          var px = (p[0] / TF.s + TF.ox).toFixed(1);
          var py = (TF.oy - p[1] / TF.s).toFixed(1);
          dpath += (i === 0 ? 'M' : 'L') + px + ',' + py + ' ';
        });
        dpath += 'Z';
        var ph = document.createElementNS(NS, 'path');
        ph.setAttribute('d', dpath);
        ph.setAttribute('fill', 'rgba(255,255,255,.14)');
        svg.appendChild(ph);
      } else {
        rect(R.rect, 'rgba(255,255,255,.14)');
      }
    });
    (data.buildings || []).forEach(function (b) {
      var e = rect(b.rect, 'rgba(210,200,180,.55)');
      e.setAttribute('data-id', b.id);
      e.setAttribute('rx', '1');
      mmShapes.push(e);
    });
    mmCam = document.createElementNS(NS, 'g');
    var cone = document.createElementNS(NS, 'path');
    cone.setAttribute('d', 'M0,-10 L6.5,7 L-6.5,7 Z');
    cone.setAttribute('fill', '#e0913f');
    mmCam.appendChild(cone);
    svg.appendChild(mmCam);
    mm.innerHTML = ''; mm.appendChild(svg);
    mmSvg = svg;
  }
  function updateMinimap() {
    if (!mmCam) return;
    // 小地图每帧重写 SVG 属性代价高；按 ~15fps 节流，且相机无位移时直接跳过
    var now = performance.now();
    if (now - mmLast < 66) return;
    var cx = camera.position.x, cz = camera.position.z;
    var rot = Math.atan2(controls.target.x - cx, controls.target.z - cz) * 180 / Math.PI;
    if (Math.abs(cx - mmPx) < 0.4 && Math.abs(cz - mmPz) < 0.4 && Math.abs(rot - mmPr) < 0.6) return;
    mmLast = now; mmPx = cx; mmPz = cz; mmPr = rot;

    mmCam.setAttribute('transform', 'translate(' + cx.toFixed(1) + ',' + cz.toFixed(1) + ') rotate(' + rot.toFixed(1) + ')');
    var sel = state.selected;
    if (sel !== mmSel) {
      mmSel = sel;
      for (var i = 0; i < mmShapes.length; i++) {
        var s = mmShapes[i];
        s.setAttribute('fill', s.getAttribute('data-id') === sel ? '#e0913f' : 'rgba(210,200,180,.55)');
      }
    }
  }

  /* ================= 相机 ================= */
  function viewOf(id) {
    var v = (data.views || []).filter(function (x) { return x.id === id; })[0];
    return v || (data.views || [])[0];
  }
  function applyView(id, dur, noSelect) {
    var v = viewOf(id);
    if (!v) return;
    var look = new THREE.Vector3(v.look[0], 0, v.look[1]);
    var eye = new THREE.Vector3(v.eye[0], v.e, v.eye[1]);
    flyTo(look, eye.clone().sub(look), dur || 1600);
    if (!noSelect) {
      $$('[data-view]').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-view') === id); });
    }
  }
  function flyTo(targetVec, offsetVec, dur, cb) {
    if (flying) return;
    flying = true;
    var sp = camera.position.clone(), st = controls.target.clone();
    var ep = targetVec.clone().add(offsetVec), et = targetVec.clone();
    var t0 = performance.now();
    dur = reduced ? 1 : (dur || 1500);
    function step(now) {
      var p = Math.min(1, (now - t0) / dur), e = ease(p);
      camera.position.set(lerp(sp.x, ep.x, e), lerp(sp.y, ep.y, e), lerp(sp.z, ep.z, e));
      controls.target.set(lerp(st.x, et.x, e), lerp(st.y, et.y, e), lerp(st.z, et.z, e));
      controls.update();
      if (p < 1) requestAnimationFrame(step);
      else { flying = false; if (cb) cb(); }
    }
    requestAnimationFrame(step);
  }

  /* ================= 电影级下降的镜头交接 =================
     设计约束（来自需求）：
       · 不允许「影片结束 → 黑屏 → 3D 加载」
       · 首帧 3D 画面必须与上一页末帧在 位置/朝向/高度/视场/运动方向 上连续
       · 不允许瞬移、跳切、闪烁
     做法：
       1) 从 sessionStorage 读取 descent.html 写入的意图标记
       2) 相机初始位姿 = 校门内侧近地视点，朝向门内（与末帧一致）
       3) 解算 3D 世界中的"北门内侧"坐标，把相机放到那里
       4) 首帧只渲染不移动，随后用 easeInOut 平滑抬升到全景
     光照方向沿用 descent 的左上主光，保证明暗关系不突变。 */
  function readHandoff() {
    try {
      var raw = sessionStorage.getItem('hmz:handoff');
      if (!raw) return null;
      var o = JSON.parse(raw);
      // 5 分钟内有效，避免过期标记影响正常进入
      if (!o || o.from !== 'cinematic' || (Date.now() - (o.at || 0)) > 300000) return null;
      return o;
    } catch (e) { return null; }
  }

  /* 找到北门建筑，返回其世界坐标与朝向
     （beimen: size [13.0, 10.5, 8.2]，rot 0 -> 长边沿 X，进深沿 Z） */
  function gateAnchor() {
    var list = data.buildings || [];
    var b = null;
    for (var i = 0; i < list.length && !b; i++) {
      if (list[i].form === 'gate' && /北|main|正/i.test((list[i].id || '') + (list[i].name || ''))) b = list[i];
    }
    if (!b) {
      for (var k = 0; k < list.length && !b; k++) {
        if (list[k].form === 'gate') b = list[k];
      }
    }
    if (!b) return null;
    var o = rectWorld(b.rect);
    var sz = b.size || [12, 10, 8];
    /* 朝向判定：这份数据里「北门」落在 z 负端（-158.6），「南门」落在 z 正端（+203.4），
       即 plan 图的 py 轴与世界 z 轴符号相反。因此从北门进校的方向是 +Z。
       这里用两座门的 z 值反推，避免把方向写死写反。 */
    var gates = (data.buildings || []).filter(function (x) { return x.form === 'gate'; });
    var inward = 1;
    if (gates.length >= 2) {
      var zs = gates.map(function (x) { return rectWorld(x.rect).z; });
      var zMin = Math.min.apply(null, zs), zMax = Math.max.apply(null, zs);
      /* 若本门更靠 z 正端，则进校方向为 -Z */
      inward = (o.z > (zMin + zMax) / 2) ? -1 : 1;
    }
    return { x: o.x, z: o.z, w: sz[0], h: sz[1], d: sz[2], inward: inward };
  }

  function applyHandoff() {
    var h = readHandoff();
    if (!h) return false;
    var g = gateAnchor();
    if (!g) return false;

    /* 相机站位：门洞内侧、人眼高度，朝校园内看。
       inward 由两座门的位置反推，不写死方向。 */
    var eyeX = g.x;
    var eyeZ = g.z + g.inward * (g.d / 2 + 7);
    var eyeY = 1.66;                                   // 与末帧同高
    var lookX = g.x;
    var lookZ = g.z + g.inward * 26;

    camera.position.set(eyeX, eyeY, eyeZ);
    controls.target.set(lookX, 3.0, lookZ);
    controls.update();

    /* 首帧立即渲染 —— 保证与上一页末帧视觉衔接，不出现空帧 */
    renderer.render(scene, camera);

    /* 短暂停留，让观众认出"就是刚才那道门"，再平滑抬升到全景 */
    var riseDelay = reduced ? 80 : 520;
    setTimeout(function () {
      var vAll = viewOf(data.entryView || 'center');
      var endLook = new THREE.Vector3(vAll ? vAll.look[0] : 0, 6, vAll ? vAll.look[1] : 0);
      var endEye = vAll
        ? new THREE.Vector3(vAll.eye[0], vAll.e, vAll.eye[1])
        : new THREE.Vector3(0, 200, 30);
      flyFrom(new THREE.Vector3(eyeX, eyeY, eyeZ),
              new THREE.Vector3(lookX, 3.0, lookZ),
              endEye, endLook, reduced ? 200 : 4600);
    }, riseDelay);

    try { sessionStorage.removeItem('hmz:handoff'); } catch (e) {}
    return true;
  }

  /* 与 flyTo 同类，但显式给定起终点，用于交接后的连续抬升 */
  function flyFrom(sp, st, ep, et, dur) {
    if (flying) return;
    flying = true;
    var t0 = performance.now();
    dur = Math.max(1, dur || 3000);
    function step(now) {
      var p = Math.min(1, (now - t0) / dur), e = ease(p);
      camera.position.set(lerp(sp.x, ep.x, e), lerp(sp.y, ep.y, e), lerp(sp.z, ep.z, e));
      controls.target.set(lerp(st.x, et.x, e), lerp(st.y, et.y, e), lerp(st.z, et.z, e));
      controls.update();
      if (p < 1) requestAnimationFrame(step);
      else { flying = false; }
    }
    requestAnimationFrame(step);
  }

  /* ================= 选中 / 信息卡 ================= */
  function findB(id) { return (data.buildings || []).filter(function (x) { return x.id === id; })[0]; }
  function selectBuilding(id, fly) {
    var b = findB(id);
    if (!b) return;
    state.selected = id;
    var o = rectWorld(b.rect);
    $('#infoTitle').textContent = b.name;
    $('#infoEn').textContent = b.en || '';
    $('#infoDesc').textContent = b.desc || '';
    $('#infoCat').textContent = b.category || '';
    var srcTag = b.src === 'plan' ? '平面图还原' : '资料推断 · 待官方确认';
    $('#infoPos').textContent = srcTag;
    $('#infoNote').textContent = b.note || '';
    $('#infoNote').style.display = b.note ? '' : 'none';
    var img = $('#infoImg');
    if (b.image) { img.src = b.image; img.alt = b.name; img.style.display = ''; }
    else { img.style.display = 'none'; }
    var acts = $('#infoActs'); acts.innerHTML = '';
    var a2 = el('button', 'hud-btn', '聚焦 FOCUS');
    a2.addEventListener('click', function () { focusOn(b); });
    acts.appendChild(a2);
    if (b.id === 'shitang' || b.id === 'shitang2' || b.id === 'shisheng') {
      var a3 = el('a', 'hud-btn', '校园生活 ↗');
      a3.href = 'index.html#life'; acts.appendChild(a3);
    }
    if (b.id === 'kexue' || b.id === 'yishu') {
      var a4 = el('a', 'hud-btn', '学术课程 ↗');
      a4.href = 'academic.html'; acts.appendChild(a4);
    }
    $('#info').classList.add('is-on');

    buildingMeshes.forEach(function (g) {
      var on = g.userData.id === id;
      g.traverse(function (ob) {
        if (ob.isMesh && ob.material && ob.material.emissive && !ob.userData.noHi) {
          ob.userData._e0 = ob.userData._e0 || ob.material.emissive.getHex();
          ob.material.emissive.setHex(on ? 0x4a2a08 : ob.userData._e0);
          ob.material.emissiveIntensity = on ? 0.5 : 1;
        }
      });
    });
    if (fly !== false) focusOn(b);
  }
  function focusOn(b) {
    var o = rectWorld(b.rect);
    var h = b.size[1] || 6;
    var len = Math.max(b.size[0] || 10, b.size[2] || 10);
    var tgt = new THREE.Vector3(o.x, h * 0.5, o.z);
    var dist = Math.max(26, len * 1.35 + h * 1.6);
    var dir = new THREE.Vector3(0.55, 0.62, 0.86).normalize();
    // 【v11】per-building 聚焦机位覆盖：用于砚池/太湖石/百年榄仁树等小景观点，
    //              默认统一机位会被邻近楼体遮挡，按数据中的 dir/dist 绕开。
    if (b.focus) {
      if (typeof b.focus.dist === 'number') dist = b.focus.dist;
      if (b.focus.dir && b.focus.dir.length === 3) {
        dir = new THREE.Vector3(b.focus.dir[0], b.focus.dir[1], b.focus.dir[2]).normalize();
      }
    }
    flyTo(tgt, dir.multiplyScalar(dist), 1500);
  }
  function clearSelection() {
    state.selected = null;
    $('#info').classList.remove('is-on');
    buildingMeshes.forEach(function (g) {
      g.traverse(function (ob) {
        if (ob.isMesh && ob.material && ob.material.emissive && ob.userData._e0 != null) {
          ob.material.emissive.setHex(ob.userData._e0);
          ob.material.emissiveIntensity = 1;
        }
      });
    });
  }

  /* ================= 彩蛋 ================= */
  function showStar() {
    var t = $('#starToast');
    if (!t) return;
    starActive = true;                 // 点亮时才启用星体动画与持续重绘
    $('#starText').textContent = '每一个真正重要的地方，都曾经有人抬头看过星空。';
    t.classList.add('is-on');
    $('#starClose').focus();
  }

  /* ================= 漫游 ================= */
  var tourTimer = null;
  function startTour() {
    state.touring = true; state.tourPaused = false; state.tourIdx = 0;
    $('#tourCtl').classList.add('is-on');
    $('#tourBtn').textContent = '结束漫游';
    gotoStop(0);
  }
  function stopTour() {
    state.touring = false; state.tourPaused = false;
    clearTimeout(tourTimer);
    $('#tourCtl').classList.remove('is-on');
    $('#tourCap').classList.remove('is-on');
    $('#tourBtn').textContent = '自动漫游';
    $('#tourProg').style.width = '0%';
  }
  function gotoStop(i) {
    var stops = data.tour || [];
    if (!stops.length) return;
    state.tourIdx = (i + stops.length) % stops.length;
    var s = stops[state.tourIdx];
    var b = findB(s.id);
    $('#tourN').textContent = '第 ' + String(state.tourIdx + 1).padStart(2, '0') + ' 站 / ' + String(stops.length).padStart(2, '0');
    $('#tourT').textContent = s.title;
    $('#tourD').textContent = s.text || '';
    $('#tourCap').classList.add('is-on');
    if (b) { selectBuilding(b.id, false); focusOn(b); }
    else if (s.view) applyView(s.view, 2000, true);
    $('#tourProg').style.width = '0%';
    animateProg(7000);
    clearTimeout(tourTimer);
    if (!state.tourPaused) tourTimer = setTimeout(function () { if (state.touring && !state.tourPaused) gotoStop(state.tourIdx + 1); }, 7100);
  }
  function animateProg(dur) {
    var e = $('#tourProg'), t0 = performance.now();
    function step(now) {
      if (!state.touring) return;
      var p = Math.min(1, (now - t0) / dur);
      e.style.width = (p * 100) + '%';
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ================= 交互拾取 ================= */
  function setupPicking() {
    var canvas = renderer.domElement;
    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();
    function pick(e) {
      var r = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      var hits = raycaster.intersectObjects(hitMeshes, true);
      for (var i = 0; i < hits.length; i++) {
        var o = hits[i].object;
        if (o.userData && o.userData.isStar) return { star: true };
        var p = o;
        while (p && !p.userData.id) p = p.parent;
        if (p && p.userData.id) return { id: p.userData.id };
      }
      return null;
    }
    canvas.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch' || flying) return;
      canvas.style.cursor = pick(e) ? 'pointer' : 'grab';
    });
    // 交互期间与交互后一段时间保持全速渲染，手感不打折
    function markInteract() { interacting = true; interactFrames = 36; }
    var dp = null, dt = 0;
    canvas.addEventListener('pointerdown', function (e) { markInteract(); dp = { x: e.clientX, y: e.clientY }; dt = Date.now(); });
    canvas.addEventListener('pointermove', function (e) { if (e.buttons) markInteract(); });
    canvas.addEventListener('wheel', markInteract, { passive: true });
    canvas.addEventListener('pointerup', function (e) {
      markInteract();
      if (!dp) return;
      var dx = e.clientX - dp.x, dy = e.clientY - dp.y;
      var moved = Math.sqrt(dx * dx + dy * dy), el2 = Date.now() - dt;
      dp = null;
      if (moved > 8 || el2 > 600) return;
      var hit = pick(e);
      if (!hit) { clearSelection(); return; }
      if (hit.star) { showStar(); return; }
      selectBuilding(hit.id, true);
    });
  }

  /* ================= 环境面板（全部折叠进一个「环境」按钮） ================= */
  function buildEnvPanel() {
    var host = $('#envBody');
    if (!host) return;
    host.innerHTML = '';

    function sec(title) {
      var s = el('div', 'env-sec');
      s.appendChild(el('div', 'env-sec-t', title));
      host.appendChild(s);
      return s;
    }
    function row(parent, label, btns, attr, cur, cb) {
      var r = el('div', 'env-row');
      if (label) r.appendChild(el('span', 'env-label', label));
      var wrap = el('div', 'env-btns');
      btns.forEach(function (b) {
        var e = el('button', 'env-b' + (b.v === cur ? ' is-on' : ''), b.t);
        e.setAttribute(attr, b.v);
        e.addEventListener('click', function () {
          Array.prototype.forEach.call(wrap.children, function (x) { x.classList.remove('is-on'); });
          e.classList.add('is-on');
          cb(b.v);
        });
        wrap.appendChild(e);
      });
      r.appendChild(wrap);
      parent.appendChild(r);
      return wrap;
    }

    // 视角
    var sv = sec('视角 VIEW');
    var vw = el('div', 'env-btns');
    (data.views || []).forEach(function (v) {
      var e = el('button', 'env-b', v.label);
      e.setAttribute('data-view', v.id);
      e.addEventListener('click', function () { applyView(v.id, 1600); });
      vw.appendChild(e);
    });
    sv.appendChild(vw);
    var rr0 = el('div', 'env-row');
    var rb0 = el('button', 'env-b env-wide', '重置视角');
    rb0.id = 'resetBtn';
    rr0.appendChild(rb0);
    sv.appendChild(rr0);

    // 时间
    var st = sec('时间 TIME');
    var tr = el('input', 'env-range');
    tr.type = 'range'; tr.min = '0'; tr.max = String(TIMES.length - 1); tr.step = '1';
    tr.value = String(state.time);
    tr.id = 'timeRange';
    tr.setAttribute('aria-label', '时间');
    var tl = el('div', 'env-val', TIMES[state.time].label);
    tl.id = 'timeVal';
    tr.addEventListener('input', function () {
      state.time = parseInt(tr.value, 10);
      tl.textContent = TIMES[state.time].label;
      applyLighting();
    });
    var tr2 = el('div', 'env-row env-col');
    tr2.appendChild(tl); tr2.appendChild(tr);
    st.appendChild(tr2);

    // 光照
    var sl = sec('光照 LIGHT');
    row(sl, '', [{ t: '白天', v: 'day' }, { t: '夜晚', v: 'night' }], 'data-mode', state.night ? 'night' : 'day', function (v) {
      state.night = (v === 'night'); applyLighting();
    });

    // 天气
    var sw = sec('天气 WEATHER');
    row(sw, '', [{ t: '晴', v: 'clear' }, { t: '多云', v: 'cloudy' }, { t: '雨', v: 'rain' }], 'data-weather', state.weather, function (v) {
      state.weather = v; applyLighting();
    });

    // 画质
    var sq = sec('画质 QUALITY');
    row(sq, '', [{ t: '高', v: 'high' }, { t: '中', v: 'balanced' }, { t: '低', v: 'low' }], 'data-q', state.quality, function (v) { setQuality(v); });

    // 自动漫游
    var sr = sec('自动漫游 TOUR');
    var rr = el('div', 'env-row');
    var tb = el('button', 'env-b env-wide', '自动漫游');
    tb.id = 'tourBtn';
    tb.addEventListener('click', function () { if (state.touring) stopTour(); else startTour(); });
    rr.appendChild(tb);
    sr.appendChild(rr);
  }

  /* 【v13】阴影相机与偏置：随档位统一配置，避免初始化与运行时切换两处写不一致。
     阴影视野固定 ±SHADOW_SPAN，法线偏置取约 1 个纹素尺寸。 */
  var SHADOW_SPAN = 210;
  function applyShadowConfig(cfg) {
    if (!sunLight) return;
    var on = cfg.shadow > 0;
    renderer.shadowMap.enabled = on;
    sunLight.castShadow = on;
    if (!on) return;
    sunLight.shadow.mapSize.width = cfg.shadow;
    sunLight.shadow.mapSize.height = cfg.shadow;
    // 尺寸变更必须释放旧的 shadow map，否则显存里会留一份旧分辨率贴图
    if (sunLight.shadow.map) { sunLight.shadow.map.dispose(); sunLight.shadow.map = null; }
    var cam = sunLight.shadow.camera;
    cam.near = 20; cam.far = 1100;
    cam.left = -SHADOW_SPAN; cam.right = SHADOW_SPAN;
    cam.top = SHADOW_SPAN; cam.bottom = -SHADOW_SPAN;
    cam.updateProjectionMatrix();
    sunLight.shadow.bias = -0.0006;
    // 法线偏置 ≈ 1 个纹素(2*SPAN/mapSize)，随分辨率缩放；
    // 原先写死 0.02 远小于纹素，是阴影痤疮与漏光的直接成因。
    sunLight.shadow.normalBias = (2 * SHADOW_SPAN) / cfg.shadow;
    sunLight.shadow.needsUpdate = true;
  }

  function setQuality(q) {
    if (q === state.quality) return;
    state.quality = q;
    var cfg = QCFG[q];
    applyShadowConfig(cfg);
    treeMeshes.forEach(function (im) { im.count = Math.max(1, Math.round(im.userData.full * cfg.treeK)); });
    // 重新按新档位初始化像素比与自适应下限
    adaptReset(cfg);
    renderer.setPixelRatio(adapt.ratio);
    if (rainSys) { scene.remove(rainSys); rainSys.geometry.dispose(); rainSys.material.dispose(); rainSys = null; }
    createRain();
    applyLighting();
    var r = $('#resetBtn');
    if (r) r.blur();
  }

  function bindUI() {
    // 「环境」按钮：展开 / 收起
    var envBtn = $('#envBtn'), envPanel = $('#envPanel');
    function setEnv(on) {
      envPanel.classList.toggle('is-on', on);
      envBtn.classList.toggle('is-on', on);
      envBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
    }
    envBtn.addEventListener('click', function () { setEnv(!envPanel.classList.contains('is-on')); });
    $('#envClose').addEventListener('click', function () { setEnv(false); envBtn.focus(); });

    // 漫游控制条
    var tt = $('#tourToggle');
    if (tt) tt.addEventListener('click', function () {
      state.tourPaused = !state.tourPaused;
      tt.textContent = state.tourPaused ? '继续' : '暂停';
      if (!state.tourPaused) gotoStop(state.tourIdx); else clearTimeout(tourTimer);
    });
    var tn = $('#tourNext'); if (tn) tn.addEventListener('click', function () { if (state.touring) gotoStop(state.tourIdx + 1); });
    var tp = $('#tourPrev'); if (tp) tp.addEventListener('click', function () { if (state.touring) gotoStop(state.tourIdx - 1); });
    var te = $('#tourExit'); if (te) te.addEventListener('click', stopTour);

    $('#infoClose').addEventListener('click', clearSelection);
    function closeStar() { $('#starToast').classList.remove('is-on'); starActive = false; }
    $('#starClose').addEventListener('click', closeStar);
    var rb = $('#resetBtn');
    if (rb) rb.addEventListener('click', function () {
      clearSelection(); stopTour();
      applyView(data.defaultView || 'aerial', 1500);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if ($('#starToast').classList.contains('is-on')) { closeStar(); return; }
      if ($('#info').classList.contains('is-on')) { clearSelection(); return; }
      if (envPanel.classList.contains('is-on')) { setEnv(false); return; }
      if (state.touring) stopTour();
    });
  }

  /* ================= 渲染循环 ================= */
  function animate() {
    frameId = requestAnimationFrame(animate);

    // 后台标签页：完全停止渲染与逻辑，避免白烧 GPU/电池
    if (document.hidden) { clock.getDelta(); return; }

    var dt = clock.getDelta(), t = clock.elapsedTime;

    // 帧率自适应：掉帧时降像素比，这是性价比最高的一档降级
    adaptStep(dt);

    if (interacting) { interactFrames--; if (interactFrames <= 0) interacting = false; }

    // 相机静止时跳过不必要的重绘（OrbitControls 阻尼需要收敛时间）
    controls.update();
    var camMoved = camera.position.distanceToSquared(lastCamPos) > 1e-6 ||
                   controls.target.distanceToSquared(lastCamTarget) > 1e-6;
    if (camMoved) {
      lastCamPos.copy(camera.position);
      lastCamTarget.copy(controls.target);
    }

    // 空闲且无可动画元素时按 30fps 节流；交互期间始终全速，手感不受影响
    var mustRender = camMoved || interacting || (rainSys && rainSys.visible) || flying || state.touring || starActive;
    idleFrames++;
    if (!mustRender && (idleFrames & 1)) return;

    // 轻微呼吸感：仅在「低档位之外 + 用户未交互」时叠加，且不再反向触发重绘判定
    if (!reduced && !flying && !interacting && state.quality === 'high' && !state.touring) {
      camera.position.x += Math.sin(t * 0.16) * 0.010;
      camera.position.y += Math.sin(t * 0.12 + 1) * 0.007;
      lastCamPos.copy(camera.position);
    }
    // 星体只在被点亮（彩蛋/夜晚）时旋转，平时不做无谓动画
    if (starMesh && starActive) {
      starMesh.rotation.y += dt * 0.5;
      starMesh.position.y = 2.2 + Math.sin(t * 1.2) * 0.3;
    }
    if (rainSys && rainSys.visible) {
      var arr = rainSys.geometry.attributes.position.array;
      for (var i = 1; i < arr.length; i += 3) { arr[i] -= dt * 42; if (arr[i] < 0) arr[i] = 130; }
      rainSys.geometry.attributes.position.needsUpdate = true;
    }
    updatePOIs();
    updateMinimap();
    renderer.render(scene, camera);
  }

  /* ================= 构建世界 ================= */
  function buildWorld() {
    var cfg = QCFG[state.quality];
    TF.ox = data.meta.transform.originPx[0];
    TF.oy = data.meta.transform.originPx[1];
    TF.s = data.meta.transform.scale;

    buildGround(cfg);

    (data.buildings || []).forEach(function (b) {
      var g = createBuilding(b, cfg);
      scene.add(g);
      buildingMeshes.push(g);
      hitMeshes.push(g);
    });
    flushWindows(scene, cfg);

    var treeCount = buildVegetation(cfg);
    treeMeshes.forEach(function (im) { im.userData.full = im.instanceMatrix.count; });
    buildLamps(cfg);

    var sp = (data.star && data.star.pos) || [0, 2.2, 0];
    starMesh = new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 0),
      M('#ffd9a0', 0.3, 0, { emissive: new THREE.Color('#ffc46a'), emissiveIntensity: 1.1 }));
    starMesh.position.set(sp[0], sp[1], sp[2]);
    starMesh.userData.isStar = true;
    scene.add(starMesh);
    hitMeshes.push(starMesh);

    skyMesh = new THREE.Mesh(new THREE.SphereGeometry(1100, 32, 20),
      new THREE.MeshBasicMaterial({ side: THREE.BackSide, depthWrite: false }));
    scene.add(skyMesh);
    return treeCount;
  }

  /* ================= 初始化 ================= */
  function init() {
    state.quality = detectQuality();
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xcfe0e8, 0.00055);

    var G = (data.meta && data.meta.ground) || { width: 380, depth: 320 };
    camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.5, 3000);
    camera.position.set(0, 180, 260);

    var cfg = QCFG[state.quality];
    try {
      renderer = new THREE.WebGLRenderer({ antialias: cfg.alias, powerPreference: 'high-performance', alpha: false });
    } catch (err) {
      renderer = null;
    }
    if (!renderer) {
      /* 无 WebGL（旧设备 / 软件渲染被禁 / 隐私模式）：
         给出明确说明并保留静态封面，不留白屏。 */
      showNoWebGL();
      return;
    }
    adaptReset(cfg);
    renderer.setPixelRatio(adapt.ratio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = cfg.shadow > 0;
    if (cfg.shadow > 0) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.06;
    controls.rotateSpeed = 0.55; controls.zoomSpeed = 0.8; controls.panSpeed = 0.6;
    controls.minDistance = 22; controls.maxDistance = 620;
    controls.maxPolarAngle = Math.PI * 0.485;
    controls.minPolarAngle = Math.PI * 0.08;
    controls.screenSpacePanning = false;
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    controls.target.set(0, 6, 0);

    hemiLight = new THREE.HemisphereLight(0xcfe4ee, 0x3f5e46, 0.95); scene.add(hemiLight);
    ambLight = new THREE.AmbientLight(0xffffff, 0.4); scene.add(ambLight);
    sunLight = new THREE.DirectionalLight(0xfff4e2, 1.2);
    sunLight.position.set(-220, 300, 200);
    scene.add(sunLight);
    // 阴影相机与偏置统一由 applyShadowConfig 配置（与 setQuality 共用，避免两处写不一致）
    applyShadowConfig(cfg);

    clock = new THREE.Clock();
    buildMaterials();
    buildWorld();
    createRain();
    buildPOIs();
    buildMinimap();
    buildEnvPanel();
    applyLighting();
    setupPicking();
    bindUI();
    animate();

    // 入场：
    //  a) 由 descent.html 电影级下降交接而来 -> 相机从校门内侧续接，再抬升到全景
    //     （要求：首帧与上一页末帧视觉连续，不允许黑屏 / 跳切 / 闪现）
    //  b) 直接进入本页 -> 从高空缓降
    if (!applyHandoff()) {
      var v = viewOf(data.entryView || 'center');
      camera.position.set(v.look[0], 300, v.look[1] + 260);
      controls.target.set(v.look[0], 6, v.look[1]);
      setTimeout(function () { applyView(data.entryView || 'center', 3000, true); }, 260);
    }

    var m = /[?&]focus=([^&]+)/.exec(location.search);
    if (m) setTimeout(function () { selectBuilding(decodeURIComponent(m[1]), true); }, 3400);

    window.addEventListener('resize', onResize);
  }

  /* 无 WebGL 时的降级：说明原因，并提供一个可点的入口回到校园影像页，
     绝不允许留白屏或黑屏。 */
  function showNoWebGL() {
    var boot = $('#loader');
    if (boot) boot.style.display = 'none';
    var wrap = document.createElement('div');
    wrap.className = 'nowebgl';
    wrap.innerHTML =
      '<div class="nowebgl-inner">' +
        '<h2>此设备暂不支持 3D 显示</h2>' +
        '<p>浏览器未能创建 WebGL 上下文。数字校园需要 WebGL；' +
        '你可以改用较新的浏览器，或在设置中开启硬件加速后重试。</p>' +
        '<p class="nowebgl-alt">作为替代，这里仍保留完整的校园影像与建筑资料。</p>' +
        '<a class="nowebgl-btn" href="index.html">返回校园首页</a>' +
      '</div>';
    document.body.appendChild(wrap);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /* ================= 加载 ================= */
  var steps = ['解析校园平面图…', '还原道路与空间…', '重建建筑体量…', '种植热带植被…', '校准海岛日照…'];
  var pct = 0, stepIdx = 0;
  function bump(to, cb) {
    var cur = pct, t0 = performance.now(), dur = 260;
    function s(now) {
      var p = Math.min(1, (now - t0) / dur);
      pct = cur + (to - cur) * p;
      $('#loaderBar').style.width = pct + '%';
      $('#loaderPct').textContent = Math.round(pct) + '%';
      if (p < 1) requestAnimationFrame(s); else if (cb) cb();
    }
    requestAnimationFrame(s);
  }
  function nextStep() {
    if (stepIdx < steps.length) { $('#loaderStatus').textContent = steps[stepIdx]; stepIdx++; }
    bump(Math.min(100, stepIdx * 20), function () {
      if (stepIdx < steps.length) setTimeout(nextStep, 170);
      else if (!loaded) { loaded = true; finishLoad(); }
    });
  }
  function finishLoad() {
    $('#loaderStatus').textContent = 'Ready';
    $('#loaderEnter').classList.add('is-on');
  }
  function loadData(cb) {
    fetch('data/buildings.json', { cache: 'no-cache' })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.buildings) data = d; cb(); })
      .catch(function () { cb(); });
  }

  loadData(function () {
    if (!data) { $('#loaderStatus').textContent = '数据加载失败，请通过本地服务器打开'; return; }
    init();
    setTimeout(nextStep, 300);
    $('#loaderEnter').addEventListener('click', function () { $('#loader').classList.add('is-done'); });
  });
  setTimeout(function () { if (!loaded) { loaded = true; finishLoad(); } }, 9000);

  /* ================= 对外 API ================= */
  window.HMS3D = {
    get ready() { return !!scene; },
    get state() { return state; },
    get data() { return data; },
    get count() { return buildingMeshes.length; },
    get quality() { return state.quality; },
    /* 性能面板数据：可在控制台查看实时帧率与当前像素比 */
    get perf() { return { fps: adapt.fps, pixelRatio: +adapt.ratio.toFixed(2), cap: adapt.baseDpr, downgrades: adapt.downgrades }; },
    get camera() { return camera; },
    get scene() { return scene; },
    get loadingDone() { return loaded; },
    get treeCount() { return treeMeshes.reduce(function (a, m) { return a + m.count; }, 0); },
    select: function (id, fly) { return selectBuilding(id, fly !== false); },
    clear: clearSelection,
    focus: function (id) { return selectBuilding(id, true); },
    tour: { start: startTour, stop: stopTour, next: function () { gotoStop(state.tourIdx + 1); } },
    view: function (id) { applyView(id, 1600); },
    setTime: function (i) { var r = $('#timeRange'); if (r) { r.value = i; r.dispatchEvent(new Event('input', { bubbles: true })); } },
    setWeather: function (w) { var b = document.querySelector('[data-weather="' + w + '"]'); if (b) b.click(); },
    setNight: function (on) { var b = document.querySelector('[data-mode="' + (on ? 'night' : 'day') + '"]'); if (b) b.click(); },
    setQuality: function (q) { var b = document.querySelector('[data-q="' + q + '"]'); if (b) b.click(); },
    reset: function () { var b = $('#resetBtn'); if (b) b.click(); },
    showStar: showStar,
    flyTo: function (t, o, d) { if (camera && controls) flyTo(new THREE.Vector3(t[0], t[1], t[2]), new THREE.Vector3(o[0], o[1], o[2]), d || 2000); },
    aim: function (t) { if (controls) { controls.target.set(t[0], t[1], t[2]); controls.update(); } },
    screenPos: function (v) { var p = v.clone().project(camera); return { x: (p.x * .5 + .5) * window.innerWidth, y: (-p.y * .5 + .5) * window.innerHeight }; }
  };
})();
