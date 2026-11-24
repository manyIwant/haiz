/**
 * HAIZ Toybox V2 — High-Craft Organic Procedural Geometry Builders
 */

import { v3Cross, v3Normalize, v3Sub } from './math3d.js';

export function createSphere(radius = 0.5, widthSegs = 28, heightSegs = 20) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let y = 0; y <= heightSegs; y++) {
    const v = y / heightSegs;
    const phi = v * Math.PI;
    const sinP = Math.sin(phi);
    const cosP = Math.cos(phi);
    for (let x = 0; x <= widthSegs; x++) {
      const u = x / widthSegs;
      const theta = u * Math.PI * 2;
      const nx = Math.cos(theta) * sinP;
      const ny = cosP;
      const nz = Math.sin(theta) * sinP;
      positions.push(nx * radius, ny * radius, nz * radius);
      normals.push(nx, ny, nz);
      uvs.push(u, 1 - v);
    }
  }

  const stride = widthSegs + 1;
  for (let y = 0; y < heightSegs; y++) {
    for (let x = 0; x < widthSegs; x++) {
      const a = y * stride + x;
      const b = a + stride;
      const c = a + 1;
      const d = b + 1;
      if (y !== 0) indices.push(a, c, b);
      if (y !== heightSegs - 1) indices.push(c, d, b);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices)
  };
}

export function createMochiBody(radius = 0.36, height = 0.72, pearFactor = 0.22, flatBottom = 0.28, widthSegs = 32, heightSegs = 24) {
  const geo = createSphere(1.0, widthSegs, heightSegs);
  const pos = geo.positions;
  for (let i = 0; i < pos.length; i += 3) {
    let x = pos[i];
    let y = pos[i + 1];
    let z = pos[i + 2];

    const t = (y + 1) * 0.5;
    const radialMod = 1.0 + pearFactor * (1.0 - t * 1.65) * Math.sin(t * Math.PI);
    x *= radius * radialMod;
    z *= radius * radialMod;

    if (y < -0.55) {
      const k = (-0.55 - y) / 0.45;
      y = y + k * k * flatBottom * 0.42;
    }
    y *= height * 0.5;

    pos[i] = x;
    pos[i + 1] = y;
    pos[i + 2] = z;
  }
  recomputeNormals(geo);
  return geo;
}

export function createCapsule(radius = 0.12, length = 0.24, capSegs = 8, radSegs = 20) {
  const profile = [];
  const half = length * 0.5;
  for (let i = 0; i <= capSegs; i++) {
    const a = -Math.PI / 2 + (i / capSegs) * (Math.PI / 2);
    profile.push([Math.max(0.0005, Math.cos(a) * radius), -half + Math.sin(a) * radius]);
  }
  for (let i = 0; i <= capSegs; i++) {
    const a = (i / capSegs) * (Math.PI / 2);
    profile.push([Math.max(0.0005, Math.cos(a) * radius), half + Math.sin(a) * radius]);
  }
  return createLathe(profile, radSegs);
}

export function createLathe(profile, radSegs = 24) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const rows = profile.length;

  for (let j = 0; j < rows; j++) {
    const [r, y] = profile[j];
    const v = j / (rows - 1);
    for (let i = 0; i <= radSegs; i++) {
      const u = i / radSegs;
      const theta = u * Math.PI * 2;
      positions.push(Math.cos(theta) * r, y, Math.sin(theta) * r);
      normals.push(0, 1, 0);
      uvs.push(u, v);
    }
  }

  const stride = radSegs + 1;
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < radSegs; i++) {
      const a = j * stride + i;
      const b = a + stride;
      const c = a + 1;
      const d = b + 1;
      indices.push(a, b, c, c, b, d);
    }
  }

  const geo = {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices)
  };
  recomputeNormals(geo);
  return geo;
}

export function createCylinder(rTop = 0.2, rBot = 0.2, height = 0.5, radSegs = 24, openEnded = false) {
  const profile = [];
  const hh = height * 0.5;
  if (!openEnded) profile.push([0.0005, -hh]);
  profile.push([rBot, -hh]);
  profile.push([rTop, hh]);
  if (!openEnded) profile.push([0.0005, hh]);
  return createLathe(profile, radSegs);
}

export function createCone(radius = 0.2, height = 0.4, radSegs = 20) {
  return createCylinder(0.002, radius, height, radSegs, false);
}

export function createTorus(majorR = 0.25, tubeR = 0.05, radialSegs = 14, tubularSegs = 28, arc = Math.PI * 2) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let j = 0; j <= radialSegs; j++) {
    const v = (j / radialSegs) * Math.PI * 2;
    const cosV = Math.cos(v);
    const sinV = Math.sin(v);
    for (let i = 0; i <= tubularSegs; i++) {
      const u = (i / tubularSegs) * arc;
      const cosU = Math.cos(u);
      const sinU = Math.sin(u);
      const cx = majorR * cosU;
      const cy = majorR * sinU;
      const x = (majorR + tubeR * cosV) * cosU;
      const y = (majorR + tubeR * cosV) * sinU;
      const z = tubeR * sinV;
      positions.push(x, y, z);
      const n = v3Normalize([x - cx, y - cy, z]);
      normals.push(n[0], n[1], n[2]);
      uvs.push(i / tubularSegs, j / radialSegs);
    }
  }

  const stride = tubularSegs + 1;
  for (let j = 0; j < radialSegs; j++) {
    for (let i = 0; i < tubularSegs; i++) {
      const a = j * stride + i;
      const b = a + stride;
      const c = a + 1;
      const d = b + 1;
      indices.push(a, c, b, c, d, b);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices)
  };
}

export function createBox(w = 1, h = 1, d = 1) {
  const hw = w / 2, hh = h / 2, hd = d / 2;
  const faces = [
    { n: [0, 0, 1], v: [[-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd]] },
    { n: [0, 0, -1], v: [[hw, -hh, -hd], [-hw, -hh, -hd], [-hw, hh, -hd], [hw, hh, -hd]] },
    { n: [0, 1, 0], v: [[-hw, hh, hd], [hw, hh, hd], [hw, hh, -hd], [-hw, hh, -hd]] },
    { n: [0, -1, 0], v: [[-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd]] },
    { n: [1, 0, 0], v: [[hw, -hh, hd], [hw, -hh, -hd], [hw, hh, -hd], [hw, hh, hd]] },
    { n: [-1, 0, 0], v: [[-hw, -hh, -hd], [-hw, -hh, hd], [-hw, hh, hd], [-hw, hh, -hd]] }
  ];
  const positions = [], normals = [], uvs = [], indices = [];
  faces.forEach((f, fi) => {
    const base = fi * 4;
    f.v.forEach((p, vi) => {
      positions.push(p[0], p[1], p[2]);
      normals.push(f.n[0], f.n[1], f.n[2]);
      uvs.push(vi === 1 || vi === 2 ? 1 : 0, vi >= 2 ? 1 : 0);
    });
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices)
  };
}

export function createHelixTube(coilRadius = 0.085, wireRadius = 0.022, turns = 7.5, pathSegs = 110, radialSegs = 10) {
  const pts = [];
  for (let i = 0; i <= pathSegs; i++) {
    const t = i / pathSegs;
    const a = t * turns * Math.PI * 2;
    pts.push([Math.cos(a) * coilRadius, -t, Math.sin(a) * coilRadius]);
  }
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= pathSegs; i++) {
    const p = pts[i];
    const pPrev = pts[Math.max(0, i - 1)];
    const pNext = pts[Math.min(pathSegs, i + 1)];
    const tang = v3Normalize(v3Sub(pNext, pPrev));
    const up = Math.abs(tang[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const side = v3Normalize(v3Cross(tang, up));
    const binorm = v3Cross(tang, side);

    for (let j = 0; j <= radialSegs; j++) {
      const a = (j / radialSegs) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const nx = side[0] * ca + binorm[0] * sa;
      const ny = side[1] * ca + binorm[1] * sa;
      const nz = side[2] * ca + binorm[2] * sa;
      positions.push(p[0] + nx * wireRadius, p[1] + ny * wireRadius, p[2] + nz * wireRadius);
      normals.push(nx, ny, nz);
      uvs.push(i / pathSegs, j / radialSegs);
    }
  }

  const stride = radialSegs + 1;
  for (let i = 0; i < pathSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * stride + j;
      const b = a + stride;
      const c = a + 1;
      const d = b + 1;
      indices.push(a, b, c, c, b, d);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices)
  };
}

export function recomputeNormals(geo) {
  const pos = geo.positions;
  const idx = geo.indices;
  const norm = new Float32Array(pos.length);
  for (let i = 0; i < idx.length; i += 3) {
    const ia = idx[i] * 3, ib = idx[i + 1] * 3, ic = idx[i + 2] * 3;
    const ax = pos[ia], ay = pos[ia + 1], az = pos[ia + 2];
    const bx = pos[ib], by = pos[ib + 1], bz = pos[ib + 2];
    const cx = pos[ic], cy = pos[ic + 1], cz = pos[ic + 2];
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    norm[ia] += nx; norm[ia + 1] += ny; norm[ia + 2] += nz;
    norm[ib] += nx; norm[ib + 1] += ny; norm[ib + 2] += nz;
    norm[ic] += nx; norm[ic + 1] += ny; norm[ic + 2] += nz;
  }
  for (let i = 0; i < norm.length; i += 3) {
    const len = Math.hypot(norm[i], norm[i + 1], norm[i + 2]);
    if (len > 1e-8) {
      norm[i] /= len; norm[i + 1] /= len; norm[i + 2] /= len;
    } else {
      norm[i] = 0; norm[i + 1] = 1; norm[i + 2] = 0;
    }
  }
  geo.normals = norm;
}
