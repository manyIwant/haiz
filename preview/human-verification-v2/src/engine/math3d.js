/**
 * HAIZ Toybox V2 — Zero-Dependency 3D Math Library (Vec3, Mat4)
 * Column-major OpenGL/WebGL2 conventions.
 */

export function vec3(x = 0, y = 0, z = 0) {
  return [x, y, z];
}

export function v3Sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function v3Add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function v3Scale(a, s) {
  return [a[0] * s, a[1] * s, a[2] * s];
}

export function v3Cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

export function v3Dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function v3Normalize(a) {
  const len = Math.hypot(a[0], a[1], a[2]);
  if (len < 1e-8) return [0, 1, 0];
  return [a[0] / len, a[1] / len, a[2] / len];
}

export function m4Identity(out = new Float32Array(16)) {
  out.fill(0);
  out[0] = 1;
  out[5] = 1;
  out[10] = 1;
  out[15] = 1;
  return out;
}

export function m4Multiply(a, b, out = new Float32Array(16)) {
  const r = out === a || out === b ? new Float32Array(16) : out;
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4];
    const b1 = b[c * 4 + 1];
    const b2 = b[c * 4 + 2];
    const b3 = b[c * 4 + 3];
    r[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    r[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    r[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    r[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  if (r !== out) out.set(r);
  return out;
}

export function m4ComposeTRS(pos, rot, scale, out = new Float32Array(16)) {
  const cx = Math.cos(rot[0]), sx = Math.sin(rot[0]);
  const cy = Math.cos(rot[1]), sy = Math.sin(rot[1]);
  const cz = Math.cos(rot[2]), sz = Math.sin(rot[2]);

  const r00 = cy * cz;
  const r01 = cz * sx * sy - cx * sz;
  const r02 = cx * cz * sy + sx * sz;
  const r10 = cy * sz;
  const r11 = cx * cz + sx * sy * sz;
  const r12 = cx * sy * sz - cz * sx;
  const r20 = -sy;
  const r21 = cy * sx;
  const r22 = cx * cy;

  const sxv = scale[0], syv = scale[1], szv = scale[2];
  out[0] = r00 * sxv; out[1] = r10 * sxv; out[2] = r20 * sxv; out[3] = 0;
  out[4] = r01 * syv; out[5] = r11 * syv; out[6] = r21 * syv; out[7] = 0;
  out[8] = r02 * szv; out[9] = r12 * szv; out[10] = r22 * szv; out[11] = 0;
  out[12] = pos[0];   out[13] = pos[1];   out[14] = pos[2];   out[15] = 1;
  return out;
}

export function m4Perspective(fovRad, aspect, near, far, out = new Float32Array(16)) {
  const f = 1.0 / Math.tan(fovRad / 2);
  const nf = 1 / (near - far);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

export function m4Ortho(left, right, bottom, top, near, far, out = new Float32Array(16)) {
  const lr = 1 / (left - right);
  const bt = 1 / (bottom - top);
  const nf = 1 / (near - far);
  out.fill(0);
  out[0] = -2 * lr;
  out[5] = -2 * bt;
  out[10] = 2 * nf;
  out[12] = (left + right) * lr;
  out[13] = (top + bottom) * bt;
  out[14] = (far + near) * nf;
  out[15] = 1;
  return out;
}

export function m4LookAt(eye, target, up = [0, 1, 0], out = new Float32Array(16)) {
  const z = v3Normalize(v3Sub(eye, target));
  const x = v3Normalize(v3Cross(up, z));
  const y = v3Cross(z, x);

  out[0] = x[0]; out[1] = y[0]; out[2] = z[0]; out[3] = 0;
  out[4] = x[1]; out[5] = y[1]; out[6] = z[1]; out[7] = 0;
  out[8] = x[2]; out[9] = y[2]; out[10] = z[2]; out[11] = 0;
  out[12] = -v3Dot(x, eye);
  out[13] = -v3Dot(y, eye);
  out[14] = -v3Dot(z, eye);
  out[15] = 1;
  return out;
}

export function m4NormalMat3(m, out = new Float32Array(9)) {
  const a00 = m[0], a01 = m[1], a02 = m[2];
  const a10 = m[4], a11 = m[5], a12 = m[6];
  const a20 = m[8], a21 = m[9], a22 = m[10];

  const b01 = a22 * a11 - a12 * a21;
  const b11 = -a22 * a10 + a12 * a20;
  const b21 = a21 * a10 - a11 * a20;

  let det = a00 * b01 + a01 * b11 + a02 * b21;
  if (Math.abs(det) < 1e-8) {
    out.set([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    return out;
  }
  det = 1.0 / det;

  out[0] = b01 * det;
  out[1] = b11 * det;
  out[2] = b21 * det;
  out[3] = (-a22 * a01 + a02 * a21) * det;
  out[4] = (a22 * a00 - a02 * a20) * det;
  out[5] = (-a21 * a00 + a01 * a20) * det;
  out[6] = (a12 * a01 - a02 * a11) * det;
  out[7] = (-a12 * a00 + a02 * a10) * det;
  out[8] = (a11 * a00 - a01 * a10) * det;
  return out;
}

export function m4TransformPoint(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]
  ];
}

export function hexToRgb(hex) {
  if (Array.isArray(hex)) return hex;
  if (typeof hex === 'string') {
    const clean = hex.replace('#', '');
    const n = parseInt(clean, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}
