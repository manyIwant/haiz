// HAIZ 实验册 · 书
// 一本摊开的精装书：布面封板、两叠随页码增减厚度的书芯、书口的纸边、丝带，
// 以及一张真正会弯的纸（两面印刷、有厚度、沿可展圆柱面卷起，书脊一侧始终连着书）。
import * as THREE from 'three';

export const PW = 10, PH = 13.4, PXU = 54;   // 页宽、页高（书本单位）；书页 DOM 每单位像素数
const HG = 0.05;          // 订口（书脊处）纸面高度
const LAM = 0.38;         // 纸面从订口升到平面的特征长度
const TMIN = 0.1, TBOOK = 0.52; // 最薄一叠的厚度、全书纸芯可分配厚度
const SLANT = 0.55;       // 书口斜切：越靠下的纸越往外探
const LEAF_T = 0.014;     // 单张纸的厚度（略微夸张，才看得见纸边）
const LX = 40, LZ = 26;   // 翻动那张纸的网格
export const ZH = 2.75;   // 立体装置“折叠线”的世界 z：装置朝书顶方向放倒
export const PLATE_H = 9.3; // 版画（装置正立面）在纸面上占的高度

/** 订口附近纸面下沉量（≤0） */
export const dip = (h, s) => -(h - HG) * Math.exp(-s / LAM);

// ---------------------------------------------------------------- 程序纹理
function canvas(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}
function tex(c, o = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = o.data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = o.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.anisotropy = o.aniso ?? 8;
  if (o.repeat) t.repeat.set(o.repeat[0], o.repeat[1]);
  return t;
}
let seed = 20261112;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

/** 灰度高度图 → 法线贴图 */
function normalFromHeight(src, strength = 2) {
  const w = src.width, h = src.height, s = src.getContext('2d').getImageData(0, 0, w, h).data;
  return canvas(w, h, (x) => {
    const out = x.createImageData(w, h), d = out.data;
    const H = (i, j) => s[(((j + h) % h) * w + ((i + w) % w)) * 4] / 255;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const dx = (H(i + 1, j) - H(i - 1, j)) * strength, dy = (H(i, j + 1) - H(i, j - 1)) * strength;
      const l = 1 / Math.hypot(dx, dy, 1), k = (j * w + i) * 4;
      d[k] = (-dx * l * 0.5 + 0.5) * 255; d[k + 1] = (dy * l * 0.5 + 0.5) * 255; d[k + 2] = (l * 0.5 + 0.5) * 255; d[k + 3] = 255;
    }
    x.putImageData(out, 0, 0);
  });
}

/** 纸纤维：极细的起伏，只在掠射光下看得出来 */
function fiberHeight() {
  return canvas(256, 256, (x, w, h) => {
    x.fillStyle = '#808080'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const a = rnd() * Math.PI, l = 3 + rnd() * 12, px = rnd() * w, py = rnd() * h, g = rnd() < 0.5 ? 255 : 0;
      x.strokeStyle = `rgba(${g},${g},${g},${0.05 + rnd() * 0.1})`; x.lineWidth = 0.6 + rnd() * 0.8;
      for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {
        x.beginPath(); x.moveTo(px + ox, py + oy);
        x.quadraticCurveTo(px + ox + Math.cos(a) * l * 0.5 + (rnd() - 0.5) * 3, py + oy + Math.sin(a) * l * 0.5 + (rnd() - 0.5) * 3, px + ox + Math.cos(a) * l, py + oy + Math.sin(a) * l);
        x.stroke();
      }
    }
    for (let i = 0; i < 5000; i++) { const g = rnd() < 0.5 ? 255 : 0; x.fillStyle = `rgba(${g},${g},${g},${rnd() * 0.07})`; x.fillRect(rnd() * w, rnd() * h, 1, 1); }
  });
}
/** 书口：一条一条的纸边 */
function edgeLines() {
  return canvas(16, 512, (x, w, h) => {
    x.fillStyle = '#f1ecdf'; x.fillRect(0, 0, w, h);
    let y = 0;
    while (y < h) {
      const t = 1.5 + rnd() * 3.5;
      x.fillStyle = `rgba(${rnd() < 0.7 ? '120,104,80' : '255,255,250'},${0.1 + rnd() * 0.28})`;
      x.fillRect(0, y, w, 1);
      y += t;
    }
  });
}
/** 布面：经纬线 */
function clothHeight() {
  return canvas(128, 128, (x, w, h) => {
    x.fillStyle = '#6a6a6a'; x.fillRect(0, 0, w, h);
    for (let j = 0; j < h; j += 4) for (let i = 0; i < w; i += 4) {
      const over = ((i + j) / 4) % 2 === 0, v = 130 + rnd() * 60;
      x.fillStyle = `rgb(${v},${v},${v})`;
      if (over) x.fillRect(i + 0.5, j + 1, 3.4, 2); else x.fillRect(i + 1, j + 0.5, 2, 3.4);
    }
  });
}
function clothColor() {
  return canvas(256, 256, (x, w, h) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const horiz = rnd() < 0.5, l = 20 + rnd() * 90;
      x.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${0.02 + rnd() * 0.05})`;
      if (horiz) x.fillRect(rnd() * w, rnd() * h, l, 1); else x.fillRect(rnd() * w, rnd() * h, 1, l);
    }
  });
}
/** 桌面：浅白蜡木，低对比的顺纹与拼板缝 */
function woodColor() {
  return canvas(1024, 1024, (x, w, h) => {
    x.fillStyle = '#b9a78d'; x.fillRect(0, 0, w, h);
    const planks = 4, ph = h / planks;
    for (let p = 0; p < planks; p++) {
      x.fillStyle = `rgba(${rnd() < 0.5 ? '90,66,40' : '236,222,196'},${0.05 + rnd() * 0.08})`;
      x.fillRect(0, p * ph, w, ph);
      for (let i = 0; i < 260; i++) {
        const y = p * ph + rnd() * ph, l = 120 + rnd() * 900, x0 = rnd() * w - 200;
        x.strokeStyle = `rgba(${rnd() < 0.62 ? '96,70,42' : '240,228,206'},${0.03 + rnd() * 0.07})`;
        x.lineWidth = 0.6 + rnd() * 1.8;
        x.beginPath(); x.moveTo(x0, y);
        x.bezierCurveTo(x0 + l * 0.3, y + (rnd() - 0.5) * 9, x0 + l * 0.7, y + (rnd() - 0.5) * 9, x0 + l, y + (rnd() - 0.5) * 5);
        x.stroke();
      }
      x.fillStyle = 'rgba(60,44,28,.32)'; x.fillRect(0, p * ph, w, 1.4);
      x.fillStyle = 'rgba(255,246,226,.18)'; x.fillRect(0, p * ph + 1.4, w, 1.2);
    }
    for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(70,50,30,${rnd() * 0.05})`; x.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 5, 1); }
  });
}
/** 窗影：只落在桌面远处与边角的柔和暗部，书上保持干净 */
function windowShade() {
  return canvas(512, 512, (x, w, h) => {
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
    x.filter = 'blur(26px)';
    x.fillStyle = 'rgba(52,46,60,.5)';
    x.save(); x.translate(w * 0.5, h * 0.5); x.rotate(-0.42);
    x.fillRect(-w, -h * 0.82, w * 2, h * 0.2);        // 远处窗框横影
    x.fillRect(-w * 1.02, -h, w * 0.3, h * 2);         // 左侧竖影
    x.fillRect(w * 0.76, -h, w * 0.5, h * 2);          // 右侧墙影
    x.restore();
    x.filter = 'none';
    const g = x.createRadialGradient(w * 0.5, h * 0.52, w * 0.2, w * 0.5, h * 0.52, w * 0.74);
    g.addColorStop(0, 'rgba(40,34,30,0)'); g.addColorStop(1, 'rgba(40,34,30,.42)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
}

// ---------------------------------------------------------------- 纸张材质（可叠印一幅“版画”）
function paperMaterial(bump) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.93, metalness: 0, bumpMap: bump, bumpScale: 0.55 });
  m.envMapIntensity = 0.55;
  m.userData.u = { tPlate: { value: null }, plateK: { value: 0 }, plateM: { value: new THREE.Matrix3() } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.u);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tPlate; uniform float plateK; uniform mat3 plateM;')
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D( map, vMapUv, -0.65 );   // 略锐一点：小字不发虚
          diffuseColor *= sampledDiffuseColor;
        #endif
        #ifdef USE_MAP
        if (plateK > 0.002) {
          vec2 pu = (plateM * vec3(vMapUv, 1.)).xy;
          if (pu.x > 0. && pu.x < 1. && pu.y > 0. && pu.y < 1.) {
            vec4 pl = texture2D(tPlate, pu);
            diffuseColor.rgb = mix(diffuseColor.rgb, pl.rgb, clamp(pl.a * plateK, 0., 1.));
          }
        }
        #endif`);
  };
  m.customProgramCacheKey = () => 'haiz-paper';
  // 版画 uv：纸面 (u, v) → 正立面图 (x / PW, y / PLATE_H)
  m.userData.u.plateM.value.set(1, 0, 0, 0, PH / PLATE_H, (ZH - PH / 2) / PLATE_H, 0, 0, 1);
  return m;
}

export class Book {
  constructor() {
    const g = this.group = new THREE.Group();
    this.hL = TMIN; this.hR = TMIN + TBOOK;
    const fiberH = tex(fiberHeight(), { data: true, repeat: [5, 6.7] });
    this.mats = { L: paperMaterial(fiberH), R: paperMaterial(fiberH), F: paperMaterial(fiberH), B: paperMaterial(fiberH) };
    this.blank = tex(canvas(4, 4, (x) => { x.fillStyle = '#fbf7ec'; x.fillRect(0, 0, 4, 4); }), { clamp: true });
    for (const m of Object.values(this.mats)) m.map = this.blank;
    this.#desk(g); this.#cover(g); this.#stacks(g); this.#ribbon(g); this.#leaf(g);
    this.setProgress(0);
  }

  // ---------- 桌面 ----------
  #desk(g) {
    const wood = tex(woodColor(), { repeat: [5, 5] });
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(300, 300).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: wood, roughness: 0.58, metalness: 0 }));
    desk.material.envMapIntensity = 0.9;
    desk.position.y = -0.17; desk.receiveShadow = true; desk.layers.set(1);
    const shade = new THREE.Mesh(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: tex(windowShade(), { clamp: true }), transparent: true, blending: THREE.MultiplyBlending, premultipliedAlpha: true, depthWrite: false, toneMapped: false }));
    shade.position.set(0, -0.165, -2); shade.layers.set(1); shade.renderOrder = 1;
    g.add(desk, shade);
  }

  // ---------- 封面：两块布面封板 + 书脊 + 铜箔线 ----------
  #cover(g) {
    const weave = tex(normalFromHeight(clothHeight(), 2.4), { data: true, repeat: [26, 34] });
    const tint = tex(clothColor(), { repeat: [3, 4] });
    const cloth = new THREE.MeshPhysicalMaterial({ color: '#1c4539', map: tint, roughness: 0.9, metalness: 0, normalMap: weave, normalScale: new THREE.Vector2(0.55, 0.55), sheen: 0.55, sheenRoughness: 0.55, sheenColor: new THREE.Color('#7fae9c') });
    cloth.envMapIntensity = 0.5;
    const foil = new THREE.MeshStandardMaterial({ color: '#c8895a', roughness: 0.32, metalness: 1 });
    foil.envMapIntensity = 1.5;
    const bw = PW + 0.82 - 0.32, bd = PH + 0.78, r = 0.16, T = 0.15;
    const shape = new THREE.Shape();
    const x0 = -bw / 2, x1 = bw / 2, y0 = -bd / 2, y1 = bd / 2;
    shape.moveTo(x0 + r, y0); shape.lineTo(x1 - r, y0); shape.quadraticCurveTo(x1, y0, x1, y0 + r);
    shape.lineTo(x1, y1 - r); shape.quadraticCurveTo(x1, y1, x1 - r, y1); shape.lineTo(x0 + r, y1);
    shape.quadraticCurveTo(x0, y1, x0, y1 - r); shape.lineTo(x0, y0 + r); shape.quadraticCurveTo(x0, y0, x0 + r, y0);
    const boardGeo = new THREE.ExtrudeGeometry(shape, { depth: T - 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 6 })
      .rotateX(-Math.PI / 2).translate(0, -T + 0.03, 0);
    const uv = boardGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / bw, uv.getY(i) / bd);
    for (const side of [-1, 1]) {
      const b = new THREE.Mesh(boardGeo, cloth);
      b.position.x = side * (0.32 + bw / 2);
      b.castShadow = b.receiveShadow = true; b.layers.set(1);
      g.add(b);
      // 铜箔线框：压在封板内沿
      const inset = 0.13, fw = 0.035, cx = b.position.x;
      const bars = [[bw - inset * 2, fw, 0, -(bd / 2 - inset)], [bw - inset * 2, fw, 0, bd / 2 - inset], [fw, bd - inset * 2, -(bw / 2 - inset), 0], [fw, bd - inset * 2, bw / 2 - inset, 0]];
      for (const [w, d, ox, oz] of bars) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.006, d), foil);
        m.position.set(cx + ox, 0.002, oz); m.layers.set(1); m.receiveShadow = true;
        g.add(m);
      }
    }
    // 书脊布：略低，两侧是书槽
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.07, bd - 0.1).translate(0, -0.13, 0), cloth);
    spine.castShadow = spine.receiveShadow = true; spine.layers.set(1);
    g.add(spine);
    // 堵头布：订口两端一小段铜绿相间的织带
    const band = canvas(32, 8, (x, w, h) => { for (let i = 0; i < w; i += 4) { x.fillStyle = (i / 4) % 2 ? '#c8895a' : '#f3ead6'; x.fillRect(i, 0, 4, h); } });
    const bandMat = new THREE.MeshStandardMaterial({ map: tex(band, { repeat: [3, 1] }), roughness: 0.7 });
    for (const z of [-PH / 2 - 0.02, PH / 2 + 0.02]) {
      const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.56, 12).rotateZ(Math.PI / 2), bandMat);
      hb.position.set(0, 0.03, z); hb.layers.set(1); hb.castShadow = true;
      g.add(hb);
    }
  }

  // ---------- 两叠书芯 ----------
  #stacks(g) {
    const edgeTex = tex(edgeLines(), { aniso: 4 });
    const edgeMat = new THREE.MeshStandardMaterial({ map: edgeTex, roughness: 0.95, color: '#f4efe2' });
    edgeMat.envMapIntensity = 0.5;
    this.stack = {};
    const NX = 30;
    this.sx = Array.from({ length: NX + 1 }, (_, i) => PW * Math.pow(i / NX, 2.3));
    for (const side of [-1, 1]) {
      const top = new THREE.BufferGeometry(), n = (NX + 1) * 2;
      top.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      top.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const uv = new Float32Array(n * 2), idx = [];
      this.sx.forEach((s, i) => {
        const u = side > 0 ? s / PW : 1 - s / PW;
        uv.set([u, 1, u, 0], i * 4);
        if (i < NX) { const a = i * 2; side > 0 ? idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) : idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      });
      top.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); top.setIndex(idx);
      const topMesh = new THREE.Mesh(top, this.mats[side > 0 ? 'R' : 'L']);
      topMesh.receiveShadow = true; topMesh.layers.set(1);
      // 书口与天头地脚
      const eg = new THREE.BufferGeometry(), en = 4 + (NX + 1) * 4;
      eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(en * 3), 3));
      eg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(en * 3), 3));
      eg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(en * 2), 2));
      const ei = [];
      side > 0 ? ei.push(0, 1, 2, 1, 3, 2) : ei.push(0, 2, 1, 1, 2, 3);
      for (const [base, flip] of [[4, side > 0], [4 + (NX + 1) * 2, side < 0]]) {
        for (let i = 0; i < NX; i++) { const a = base + i * 2; flip ? ei.push(a, a + 2, a + 1, a + 1, a + 2, a + 3) : ei.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      eg.setIndex(ei);
      const edgeMesh = new THREE.Mesh(eg, edgeMat);
      edgeMesh.castShadow = edgeMesh.receiveShadow = true; edgeMesh.layers.set(1);
      g.add(topMesh, edgeMesh);
      this.stack[side] = { top, eg };
    }
  }
  #shapeStacks() {
    const NX = this.sx.length - 1, K = 1.1;
    for (const side of [-1, 1]) {
      const h = side > 0 ? this.hR : this.hL, { top, eg } = this.stack[side];
      const p = top.attributes.position, nr = top.attributes.normal;
      this.sx.forEach((s, i) => {
        const y = h + dip(h, s), sl = ((h - HG) / LAM) * Math.exp(-s / LAM), l = 1 / Math.hypot(sl, 1);
        p.setXYZ(i * 2, side * s, y, -PH / 2); p.setXYZ(i * 2 + 1, side * s, y, PH / 2);
        nr.setXYZ(i * 2, -side * sl * l, l, 0); nr.setXYZ(i * 2 + 1, -side * sl * l, l, 0);
      });
      p.needsUpdate = nr.needsUpdate = true; top.computeBoundingSphere();
      const q = eg.attributes.position, qn = eg.attributes.normal, qu = eg.attributes.uv;
      const out = PW + SLANT * h, nl = 1 / Math.hypot(1, SLANT);
      // 书口（外侧斜面）
      q.setXYZ(0, side * PW, h, -PH / 2); q.setXYZ(1, side * PW, h, PH / 2); q.setXYZ(2, side * out, 0, -PH / 2); q.setXYZ(3, side * out, 0, PH / 2);
      for (let i = 0; i < 4; i++) qn.setXYZ(i, side * nl, SLANT * nl, 0);
      qu.setXY(0, 0, h * K); qu.setXY(1, 3, h * K); qu.setXY(2, 0, 0); qu.setXY(3, 3, 0);
      // 天头（z−）与地脚（z+）
      [[4, -PH / 2, -1], [4 + (NX + 1) * 2, PH / 2, 1]].forEach(([base, z, nz]) => {
        this.sx.forEach((s, i) => {
          const y = h + dip(h, s), k = base + i * 2;
          q.setXYZ(k, side * s, y, z); q.setXYZ(k + 1, side * s * (out / PW), 0, z);
          qn.setXYZ(k, 0, 0, nz); qn.setXYZ(k + 1, 0, 0, nz);
          qu.setXY(k, s * 0.3, y * K); qu.setXY(k + 1, s * 0.3, 0);
        });
      });
      q.needsUpdate = qn.needsUpdate = qu.needsUpdate = true; eg.computeBoundingSphere();
    }
  }
  /** f：读到全书的哪里（0..1）。左叠渐厚，右叠渐薄。 */
  setProgress(f) {
    this.hL = TMIN + TBOOK * f; this.hR = TMIN + TBOOK * (1 - f);
    this.#shapeStacks();
  }

  // ---------- 丝带 ----------
  #ribbon(g) {
    const pts = [[0.02, 0.16, -PH / 2 - 0.3], [0.03, 0.11, -PH / 2 + 0.5], [0.02, 0.085, 0], [0.04, 0.1, PH / 2 - 0.4], [0.1, 0.12, PH / 2 + 0.25], [0.3, -0.12, PH / 2 + 0.9], [0.9, -0.155, PH / 2 + 1.7], [1.2, -0.155, PH / 2 + 2.5]].map((p) => new THREE.Vector3(...p));
    const curve = new THREE.CatmullRomCurve3(pts), n = 60, w = 0.105;
    const pos = [], idx = [], side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i <= n; i++) {
      const p = curve.getPoint(i / n), t = curve.getTangent(i / n);
      side.crossVectors(t, up).normalize().multiplyScalar(w);
      pos.push(p.x - side.x, p.y - side.y, p.z - side.z, p.x + side.x, p.y + side.y, p.z + side.z);
      if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: '#a65a34', roughness: 0.5, side: THREE.DoubleSide, sheen: 0.8, sheenRoughness: 0.35, sheenColor: new THREE.Color('#f3c7a0') }));
    m.castShadow = m.receiveShadow = true; m.layers.set(1);
    g.add(m);
  }

  // ---------- 翻动的那张纸 ----------
  #leaf(g) {
    const NV = (LX + 1) * (LZ + 1), ring = 2 * (LZ + 1) + 4 * (LX + 1);
    const geo = this.leafGeo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((NV * 2 + ring) * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array((NV * 2 + ring) * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((NV * 2 + ring) * 2), 2));
    const quad = (out, a, b, c, d, flip) => (flip ? out.push(a, c, b, b, c, d) : out.push(a, b, c, b, d, c));
    const build = (mirror) => {
      const top = [], bot = [], edge = [];
      for (let j = 0; j < LZ; j++) for (let i = 0; i < LX; i++) {
        const a = j * (LX + 1) + i, b = a + 1, c = a + LX + 1, d = c + 1;
        quad(top, a, c, b, d, mirror); quad(bot, NV + a, NV + b, NV + c, NV + d, mirror);
      }
      let e = NV * 2;
      for (let j = 0; j < LZ; j++) { quad(edge, e + j * 2, e + j * 2 + 1, e + j * 2 + 2, e + j * 2 + 3, false); quad(edge, e + j * 2, e + j * 2 + 2, e + j * 2 + 1, e + j * 2 + 3, false); }
      e += 2 * (LZ + 1);
      for (let k = 0; k < 2; k++) {
        for (let i = 0; i < LX; i++) { quad(edge, e + i * 2, e + i * 2 + 1, e + i * 2 + 2, e + i * 2 + 3, false); quad(edge, e + i * 2, e + i * 2 + 2, e + i * 2 + 1, e + i * 2 + 3, false); }
        e += 2 * (LX + 1);
      }
      return { arr: [...top, ...bot, ...edge], n: [top.length, bot.length, edge.length] };
    };
    this.leafIdx = { 1: build(false), [-1]: build(true) };
    const edgeMat = new THREE.MeshBasicMaterial({ color: '#fffdf4' });
    const mesh = this.leaf = new THREE.Mesh(geo, [this.mats.F, this.mats.B, edgeMat]);
    mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.visible = false; mesh.layers.set(1);
    g.add(mesh);
    this.turn = null;
  }

  /** 把一幅印好的页面交给某个面。slot: 'L' 左叠顶 | 'R' 右叠顶 | 'F' 翻动页朝上的一面 | 'B' 翻动页朝下的一面 */
  setPrint(slot, map, plate = null, k = plate ? 1 : 0) {
    const m = this.mats[slot];
    m.map = map || this.blank;
    m.userData.u.tPlate.value = plate; m.userData.u.plateK.value = plate ? k : 0;
  }
  setPlateK(slot, k) { const u = this.mats[slot].userData.u; u.plateK.value = u.tPlate.value ? k : 0; }

  /**
   * 开始翻一页。dir=+1：从右往左翻（下一页）；dir=−1：从左往右翻（上一页）。
   * grab: 抓住纸的哪里（s 离书脊的距离, z）。
   */
  beginTurn(dir, grab) {
    const g = this.leafGeo, ix = this.leafIdx[dir], NV = (LX + 1) * (LZ + 1);
    g.setIndex(ix.arr); g.clearGroups();
    g.addGroup(0, ix.n[0], 0); g.addGroup(ix.n[0], ix.n[1], 1); g.addGroup(ix.n[0] + ix.n[1], ix.n[2], 2);
    const uv = g.attributes.uv;
    for (let j = 0; j <= LZ; j++) for (let i = 0; i <= LX; i++) {
      const a = j * (LX + 1) + i, s = i / LX, v = 1 - j / LZ;
      uv.setXY(a, dir > 0 ? s : 1 - s, v); uv.setXY(NV + a, dir > 0 ? 1 - s : s, v);
    }
    uv.needsUpdate = true;
    this.turn = { dir, gx: THREE.MathUtils.clamp(grab.s, PW * 0.25, PW), gz: THREE.MathUtils.clamp(grab.z, -PH / 2, PH / 2), tx: 0, tz: 0, p: 0 };
    this.turn.tx = this.turn.gx; this.turn.tz = this.turn.gz;
    this.leaf.visible = true;
    this.bend(this.turn.gx, this.turn.gz);
  }
  endTurn() { this.leaf.visible = false; this.turn = null; }

  /**
   * 把纸弯到“被抓住的点落在 (tx, tz) 上方”的形状。
   * 纸是不可拉伸的：沿一条折线之外的部分卷在一个半径 R 的圆柱面上，卷过半圈后平铺回去。
   * 折线不得越过书脊的两个端点，所以纸始终连在书上。坐标取“从右往左翻”的规范方向，反向翻时镜像 x。
   */
  bend(tx, tz) {
    const T = this.turn; if (!T) return;
    T.tx = tx; T.tz = tz;
    const { gx, gz, dir } = T;
    const hFrom = dir > 0 ? this.hR : this.hL, hTo = dir > 0 ? this.hL : this.hR;
    const p = T.p = THREE.MathUtils.clamp((gx - tx) / (2 * gx), 0, 1);
    // 卷曲半径：起手紧、半程最松、落下时收拢
    const R = Math.max(0.035, PW * 0.31 * (0.42 + 0.58 * Math.sin(Math.PI * Math.min(1, p * 1.1))) * (1 - THREE.MathUtils.smoothstep(p, 0.68, 1)));
    let nx = gx - tx, nz = gz - tz, l = Math.hypot(nx, nz);
    if (l < 1e-4) { nx = 1; nz = 0; } else { nx /= l; nz /= l; }
    const minNx = 0.5; // 折线最多倾斜 60°
    if (nx < minNx) { nx = minNx; nz = Math.sign(nz || 1) * Math.sqrt(1 - minNx * minNx); }
    const g0 = gx * nx + gz * nz, q = tx * nx + tz * nz;
    const cMin = (PH / 2) * Math.abs(nz);
    const f = (d) => (d < Math.PI * R ? R * Math.sin(d / R) : Math.PI * R - d);
    let c;
    if (q >= g0) c = g0;
    else if (cMin + f(g0 - cMin) >= q) c = cMin;
    else { let a = cMin, b = g0; for (let i = 0; i < 22; i++) { c = (a + b) / 2; (c + f(g0 - c) < q) ? (a = c) : (b = c); } }
    T.c = c; T.nx = nx; T.nz = nz; T.R = R;
    const pos = this.leafGeo.attributes.position, nor = this.leafGeo.attributes.normal, NV = (LX + 1) * (LZ + 1), ht = LEAF_T / 2;
    const put = (k, x, y, z, ax, ay, az) => { pos.setXYZ(k, dir * x, y, z); nor.setXYZ(k, dir * ax, ay, az); };
    for (let j = 0; j <= LZ; j++) for (let i = 0; i <= LX; i++) {
      const s = (i / LX) * PW, z = -PH / 2 + (j / LZ) * PH, d = s * nx + z * nz - c;
      let x = s, y = 0, zz = z, ax = 0, ay = 1, az = 0, w = 0;
      if (d > 0) {
        const om = d / R;
        let along, hgt;
        if (om < Math.PI) { along = R * Math.sin(om); hgt = R * (1 - Math.cos(om)); ay = Math.cos(om); ax = -nx * Math.sin(om); az = -nz * Math.sin(om); w = om / Math.PI; }
        else { along = Math.PI * R - d; hgt = 2 * R; ay = -1; w = 1; }
        x = s + nx * (along - d); zz = z + nz * (along - d); y = hgt;
      }
      w = w * w * (3 - 2 * w);
      // 落到对面那叠纸上之后，离书脊的距离仍是 s（折线贴着书脊时）；用它取两侧纸面的高度并混合
      const sLand = Math.abs(x);
      y += (1 - w) * (hFrom + dip(hFrom, s)) + w * (hTo + dip(hTo, Math.max(sLand, s * 0.4))) + 0.004 + ht;
      const a = j * (LX + 1) + i;
      put(a, x + ax * ht, y + ay * ht, zz + az * ht, ax, ay, az);
      put(NV + a, x - ax * ht, y - ay * ht, zz - az * ht, -ax, -ay, -az);
    }
    // 纸边：外口、天头、地脚
    let e = NV * 2;
    const copy = (a) => { for (const src of [a, NV + a]) { pos.setXYZ(e, pos.getX(src), pos.getY(src), pos.getZ(src)); nor.setXYZ(e, 0, 1, 0); e++; } };
    for (let j = 0; j <= LZ; j++) copy(j * (LX + 1) + LX);
    for (let i = 0; i <= LX; i++) copy(i);
    for (let i = 0; i <= LX; i++) copy(LZ * (LX + 1) + i);
    pos.needsUpdate = nor.needsUpdate = true;
  }

  /** 射线落在哪一页上。返回 { side, s（离书脊）, z } */
  pageHit(ray, out = new THREE.Vector3()) {
    for (const side of [1, -1]) {
      const h = side > 0 ? this.hR : this.hL;
      if (Math.abs(ray.direction.y) < 1e-5) continue;
      const t = (h - ray.origin.y) / ray.direction.y; if (t <= 0) continue;
      out.copy(ray.direction).multiplyScalar(t).add(ray.origin);
      const s = side * out.x;
      if (s >= 0 && s <= PW && Math.abs(out.z) <= PH / 2) return { side, s, z: out.z };
    }
    return null;
  }
}
