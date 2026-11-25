// HAIZ 动物验证码 · 毛绒玩偶雕刻与材质工具箱
// 复用并精简毛绒物理材质（sheen 绒面边缘光 + 程序化短绒法线贴图）、光滑纽扣眼、腮红与动画烘焙工具。
import * as THREE from 'three';

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();

/** 确定性伪随机数（mulberry32），确保各设备生成的毛绒法线贴图完全一致。 */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 生成 128×128 无缝平铺的短毛绒（minky plush）法线贴图，体积小巧且具有细腻绒面触感。 */
let _plushNormalTex = null;
export function getPlushNormalTexture() {
  if (_plushNormalTex) return _plushNormalTex;
  const size = 128;
  const r = rng(42);
  const h = new Float32Array(size * size);

  // 重叠的短纤维高度场
  for (let i = 0; i < 1200; i++) {
    let x = r() * size;
    let y = r() * size;
    let ang = r() * Math.PI * 2;
    const len = 4 + r() * 5;
    const curl = (r() - 0.5) * 0.28;
    const amp = 0.4 + r() * 0.6;
    const steps = Math.ceil(len * 1.8);
    for (let s = 0; s < steps; s++) {
      ang += curl;
      x += Math.cos(ang) * 0.55;
      y += Math.sin(ang) * 0.55;
      const ix = ((Math.round(x) % size) + size) % size;
      const iy = ((Math.round(y) % size) + size) % size;
      h[iy * size + ix] += amp;
    }
  }

  // 两次环形平滑模糊，获得细腻柔软的短毛绒（minky）触感
  const tmp = new Float32Array(size * size);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let s = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            s += h[((y + dy + size) % size) * size + ((x + dx + size) % size)];
          }
        }
        tmp[y * size + x] = s / 9;
      }
    }
    h.set(tmp);
  }
  let mx = 0;
  for (let i = 0; i < h.length; i++) if (h[i] > mx) mx = h[i];
  for (let i = 0; i < h.length; i++) h[i] /= mx || 1;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const strength = 1.45;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = h[y * size + ((x - 1 + size) % size)];
      const rr = h[y * size + ((x + 1) % size)];
      const u = h[((y - 1 + size) % size) * size + x];
      const d = h[((y + 1) % size) * size + x];
      let nx = (l - rr) * strength;
      let ny = (u - d) * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const idx = (y * size + x) * 4;
      img.data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      img.data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      img.data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3.5, 3.5);
  tex.colorSpace = THREE.NoColorSpace;
  tex.name = 'plush_normal';
  tex.userData.canvas = canvas;
  _plushNormalTex = tex;
  return tex;
}

const lighten = (hex, amt) => new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), amt);

/** 短毛绒材质：高粗糙度 + 柔和 sheen 边缘光 + 细腻短绒法线。 */
export function plushMat(color, o = {}) {
  return new THREE.MeshPhysicalMaterial({
    name: o.name || `plush_${color}`,
    color: new THREE.Color(color),
    roughness: o.roughness ?? 0.90,
    metalness: 0,
    sheen: o.sheen ?? 0.9,
    sheenRoughness: o.sheenRoughness ?? 0.48,
    sheenColor: o.sheenColor ? new THREE.Color(o.sheenColor) : lighten(color, 0.52),
    normalMap: getPlushNormalTexture(),
    normalScale: new THREE.Vector2(o.normal ?? 0.28, o.normal ?? 0.28),
    vertexColors: !!o.vertexColors,
    side: o.side ?? THREE.FrontSide,
  });
}

/** 柔软毛毡材质（耳廓内衬、腮红、肚皮贴布、脚掌肉垫）。 */
export function feltMat(color, o = {}) {
  return new THREE.MeshPhysicalMaterial({
    name: o.name || `felt_${color}`,
    color: new THREE.Color(color),
    roughness: o.roughness ?? 0.88,
    metalness: 0,
    sheen: o.sheen ?? 0.85,
    sheenRoughness: o.sheenRoughness ?? 0.55,
    sheenColor: o.sheenColor ? new THREE.Color(o.sheenColor) : lighten(color, 0.5),
    normalMap: o.useNormal === false ? null : getPlushNormalTexture(),
    normalScale: new THREE.Vector2(o.normal ?? 0.25, o.normal ?? 0.25),
    vertexColors: !!o.vertexColors,
    side: o.side ?? THREE.FrontSide,
  });
}

/** 柔光哑漆软胶材质（鸭嘴、蹄子等微光部位）。 */
export function satinMat(color, o = {}) {
  return new THREE.MeshPhysicalMaterial({
    name: o.name || `satin_${color}`,
    color: new THREE.Color(color),
    roughness: o.roughness ?? 0.36,
    metalness: 0,
    clearcoat: o.clearcoat ?? 0.35,
    clearcoatRoughness: 0.32,
  });
}

/** 绣花线材质（微笑嘴型、鼻孔细节）。 */
export function threadMat(color = '#3b2620', o = {}) {
  return new THREE.MeshStandardMaterial({
    name: o.name || `thread_${color}`,
    color: new THREE.Color(color),
    roughness: 0.72,
    metalness: 0,
  });
}

/** 亮面安全纽扣眼材质。 */
export function beadMat(color = '#1a1413') {
  return new THREE.MeshPhysicalMaterial({
    name: `bead_${color}`,
    color: new THREE.Color(color),
    roughness: 0.08,
    metalness: 0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
  });
}

/** 眼中高光点（不受光照变暗，让眼神灵动清澈）。 */
export function catchLightMat() {
  return new THREE.MeshBasicMaterial({
    name: 'catchlight',
    color: new THREE.Color('#fffdf8'),
    toneMapped: false,
  });
}

export const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export const lin = (hex) => new THREE.Color(hex);

/** 可变形软雕塑球体，自动修复接缝法线。 */
export function blob({ rx = 1, ry = 1, rz = 1, w = 32, h = 22, shape, post } = {}) {
  const g = new THREE.SphereGeometry(1, w, h);
  const pos = g.attributes.position;
  const dir = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    dir.fromBufferAttribute(pos, i).normalize();
    let p = shape ? shape(dir.clone()) : new THREE.Vector3(dir.x * rx, dir.y * ry, dir.z * rz);
    if (post) p = post(p, dir) || p;
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  g.computeVertexNormals();
  fixSphereSeamNormals(g);
  return g;
}

function fixSphereSeamNormals(g) {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const map = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = `${pos.getX(i).toFixed(5)},${pos.getY(i).toFixed(5)},${pos.getZ(i).toFixed(5)}`;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(i);
  }
  for (const idx of map.values()) {
    if (idx.length < 2) continue;
    _n.set(0, 0, 0);
    for (const i of idx) _n.add(_v.fromBufferAttribute(nor, i));
    _n.normalize();
    for (const i of idx) nor.setXYZ(i, _n.x, _n.y, _n.z);
  }
}

/** 渐变半径管道（用于大象鼻、狐狸大尾巴、卷曲猪尾巴）。 */
export function taperedTube(points, radiusFn, { tubular = 28, radial = 14, capEnd = true } = {}) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const frames = curve.computeFrenetFrames(tubular, false);
  const verts = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    const c = curve.getPointAt(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const r = Math.max(0.0004, typeof radiusFn === 'function' ? radiusFn(t) : radiusFn);
    for (let j = 0; j <= radial; j++) {
      const v = (j / radial) * Math.PI * 2;
      const sin = Math.sin(v);
      const cos = -Math.cos(v);
      const vx = c.x + r * (cos * N.x + sin * B.x);
      const vy = c.y + r * (cos * N.y + sin * B.y);
      const vz = c.z + r * (cos * N.z + sin * B.z);
      verts.push(vx, vy, vz);
      uvs.push(j / radial, t);
    }
  }

  for (let i = 0; i < tubular; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = (i + 1) * (radial + 1) + j;
      const c = (i + 1) * (radial + 1) + (j + 1);
      const d = i * (radial + 1) + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  if (capEnd) {
    const endCenter = curve.getPointAt(1);
    const endIdx = verts.length / 3;
    verts.push(endCenter.x, endCenter.y, endCenter.z);
    uvs.push(0.5, 1);
    const ringStart = tubular * (radial + 1);
    for (let j = 0; j < radial; j++) {
      indices.push(ringStart + j, endIdx, ringStart + j + 1);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** 细线条管道（绣花嘴、胡须等）。 */
export function tube(points, radius = 0.001, { tubular = 20, radial = 6 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return new THREE.TubeGeometry(curve, tubular, radius, radial, false);
}

/** 按空间位置绘制顶点色（实现熊猫眼圈、狐狸白颊、青蛙奶白肚皮等无接缝渐变花纹）。 */
export function paint(geo, fn) {
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const c = fn(p);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

export function mesh(geo, mat, name) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  if (name) m.name = name;
  return m;
}

export function pivot(name, parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  if (parent) parent.add(g);
  return g;
}

/** 射线投射到网格表面，用于精准贴合眼睛、腮红与绣花嘴。 */
export function surfaceAt(targetMesh, centre, dir, far = 0.6) {
  targetMesh.updateWorldMatrix(true, false);
  const worldCentre = centre.clone().applyMatrix4(targetMesh.matrixWorld);
  const d = dir.clone().normalize();
  const origin = worldCentre.clone().addScaledVector(d, far);
  const rc = new THREE.Raycaster(origin, worldCentre.clone().sub(origin).normalize());
  const hit = rc.intersectObject(targetMesh, false)[0];
  if (!hit) return { point: worldCentre.clone().addScaledVector(d, 0.04), normal: d };
  const normal = hit.face.normal.clone().transformDirection(targetMesh.matrixWorld).normalize();
  return { point: hit.point.clone(), normal };
}

export function placeOnSurface(obj, hit, lift = 0) {
  obj.position.copy(hit.point).addScaledVector(hit.normal, lift);
  const z = hit.normal.clone().normalize();
  let x = new THREE.Vector3(0, 1, 0).cross(z);
  if (x.lengthSq() < 1e-6) x.set(1, 0, 0);
  x.normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  return obj;
}

function attachTo(parent, obj) {
  parent.updateWorldMatrix(true, false);
  obj.updateMatrixWorld(true);
  parent.attach(obj);
  return obj;
}

export function faceDirs(forward, offsets) {
  const f = forward.clone().normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), f).normalize();
  const up = new THREE.Vector3().crossVectors(f, right).normalize();
  return offsets.map(([u, v]) => f.clone().addScaledVector(right, u).addScaledVector(up, v));
}

export function smileArc(w = 0.14, h = 0.05, cy = -0.14, n = 10) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([(t * 2 - 1) * w, cy - Math.sin(t * Math.PI) * h]);
  }
  return pts;
}

export function omegaMouth(w = 0.11, h = 0.045, cy = -0.13) {
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const u = (t * 2 - 1) * w;
    const v = cy - Math.abs(Math.sin(t * Math.PI * 2)) * h;
    pts.push([u, v]);
  }
  return pts;
}

/** 在指定表面放置带双高光的亮面纽扣眼，返回可眨眼缩放的 pivot。 */
export function addEye(parent, targetMesh, centre, dir, { r = 0.0066, name = 'eye', color = '#191413', flatten = 0.58, sink = 0.30, glintScale = 1.0 } = {}) {
  const hit = surfaceAt(targetMesh, centre, dir);
  const eye = pivot(name, null);
  placeOnSurface(eye, hit, -r * sink);

  const g = new THREE.SphereGeometry(r, 16, 12);
  g.scale(1, 1.06, flatten);
  const b = mesh(g, beadMat(color), `${name}_bead`);
  b.castShadow = false;
  eye.add(b);

  const cl1 = mesh(new THREE.SphereGeometry(r * 0.30 * glintScale, 8, 6), catchLightMat(), `${name}_glint1`);
  cl1.position.set(-r * 0.30, r * 0.34, r * flatten * 0.88);
  cl1.scale.set(1, 1, 0.42);
  cl1.castShadow = false;
  eye.add(cl1);

  const cl2 = mesh(new THREE.SphereGeometry(r * 0.14 * glintScale, 6, 5), catchLightMat(), `${name}_glint2`);
  cl2.position.set(r * 0.30, -r * 0.28, r * flatten * 0.90);
  cl2.scale.set(1, 1, 0.42);
  cl2.castShadow = false;
  eye.add(cl2);

  return attachTo(parent, eye);
}

/** 在曲面上贴合柔和椭圆腮红。 */
export function addBlush(parent, targetMesh, centre, dir, { rx = 0.0085, ry = 0.0056, color = '#f4968c', name = 'blush' } = {}) {
  const hit = surfaceAt(targetMesh, centre, dir);
  const g = new THREE.SphereGeometry(1, 14, 10);
  g.scale(rx, ry, 0.0016);
  const b = mesh(g, feltMat(color, { name: `blush_${color}`, useNormal: false }), name);
  b.castShadow = false;
  placeOnSurface(b, hit, 0.0005);
  return attachTo(parent, b);
}

/** 沿曲面路径添加绣花线（微笑、胡须等）。 */
export function addStitch(parent, targetMesh, centre, dirs, { r = 0.00095, color = '#3c2620', name = 'stitch', lift = 0.0006 } = {}) {
  const pts = dirs.map((d) => {
    const hit = surfaceAt(targetMesh, centre, d);
    return hit.point.addScaledVector(hit.normal, lift);
  });
  const m = mesh(tube(pts, r, { tubular: 18, radial: 5 }), threadMat(color), name);
  m.castShadow = false;
  return attachTo(parent, m);
}

/** 动画工具集 */
export const animEase = {
  bell: (t) => Math.sin(Math.PI * Math.min(1, Math.max(0, t))),
  wobble: (t, freq = 3, decay = 4.2) => Math.exp(-decay * t) * Math.cos(t * freq * Math.PI * 2),
};

export const CLIP_DEFS = {
  idle: { duration: 2.4, fps: 14 },
  touch: { duration: 0.7, fps: 16 },
  lifted: { duration: 1.6, fps: 15 },
  land: { duration: 0.9, fps: 16 },
  celebrate: { duration: 1.8, fps: 16 },
};

/** 姿态辅助控制器，用于烘焙 5 段标准 glTF 动画。 */
export class PlushRigPose {
  constructor(nodes) {
    this.nodes = nodes;
    this.rest = {};
    for (const [k, o] of Object.entries(nodes)) {
      this.rest[k] = { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() };
    }
  }
  restore() {
    for (const [k, o] of Object.entries(this.nodes)) {
      const r = this.rest[k];
      o.position.copy(r.p);
      o.quaternion.copy(r.q);
      o.scale.copy(r.s);
    }
  }
  rot(key, x = 0, y = 0, z = 0) {
    const o = this.nodes[key];
    if (!o) return;
    _q.setFromEuler(_e.set(x, y, z, 'XYZ'));
    o.quaternion.multiply(_q);
  }
  move(key, x = 0, y = 0, z = 0) {
    const o = this.nodes[key];
    if (!o) return;
    o.position.x += x;
    o.position.y += y;
    o.position.z += z;
  }
  scl(key, x = 1, y = 1, z = 1) {
    const o = this.nodes[key];
    if (!o) return;
    o.scale.x *= x;
    o.scale.y *= y;
    o.scale.z *= z;
  }
  squash(key, s) {
    const xz = 1 / Math.sqrt(Math.max(0.4, s));
    this.scl(key, xz, s, xz);
  }
}

/** 将程序化姿态函数烘焙为标准 THREE.AnimationClip（自动剔除静止轨道以压缩体积）。 */
export function bakeClips(nodes, poseFn) {
  const rig = new PlushRigPose(nodes);
  const clips = [];

  for (const [clipName, def] of Object.entries(CLIP_DEFS)) {
    const steps = Math.max(4, Math.round(def.duration * def.fps));
    const dt = def.duration / steps;
    const times = [];
    const rec = new Map();
    for (const [, o] of Object.entries(nodes)) {
      rec.set(o.name, { pos: [], quat: [], scl: [] });
    }

    for (let i = 0; i <= steps; i++) {
      const t = i * dt;
      const u = i / steps;
      times.push(t);
      rig.restore();
      poseFn(rig, clipName, t, u, def.duration);
      for (const [, o] of Object.entries(nodes)) {
        const r = rec.get(o.name);
        r.pos.push(o.position.x, o.position.y, o.position.z);
        r.quat.push(o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w);
        r.scl.push(o.scale.x, o.scale.y, o.scale.z);
      }
    }

    rig.restore();
    const tracks = [];
    const changed = (arr, stride, eps = 1e-4) => {
      for (let i = stride; i < arr.length; i++) {
        if (Math.abs(arr[i] - arr[i % stride]) > eps) return true;
      }
      return false;
    };

    for (const [name, r] of rec.entries()) {
      if (changed(r.pos, 3, 2e-4)) tracks.push(new THREE.VectorKeyframeTrack(`${name}.position`, times, r.pos));
      if (changed(r.quat, 4, 2e-4)) tracks.push(new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, r.quat));
      if (changed(r.scl, 3, 2e-4)) tracks.push(new THREE.VectorKeyframeTrack(`${name}.scale`, times, r.scl));
    }

    clips.push(new THREE.AnimationClip(clipName, def.duration, tracks));
  }
  return clips;
}
