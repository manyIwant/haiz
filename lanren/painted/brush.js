// HAIZ · the brush the painted campus is made with: one small picture that repeats, read at several
// sizes in world space by the ground, the walls, the bark and the shadows. Drawn once in code
// (deterministic; no image is loaded). Four channels, each its own kind of mark, 0.5 (128) = no mark:
//
//   r  gouache dabs: broad soft washes, then loaded strokes with a dry-brush tail, then small dabs — some
//      lighter than what they lie on, some darker, as a background painter lays a surface in
//   g  long strokes along x: thin streaks with ragged ends, for anything a brush drags (lawns combed by
//      the wind, rain streaks down a wall, the grain of the bark, the lie of a road)
//   b  grain: the aggregate of old cement and terrazzo, sand in the joints, a few chips — the near-field
//      texture of paving, faded out before it can shimmer
//   a  leaves: the shapes of fallen 榄仁 leaves (broad, rounded tip, short stalk) and small litter,
//      255 where a leaf lies; the shader colours each by its own hash
// (Painted Valley draws its brush the same way — ellipses on a canvas, wrapped at the edges; these
// marks and channels are HAIZ's own.)
import * as THREE from 'three';

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function layer(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(128,128,128)';
  g.fillRect(0, 0, size, size);
  return { c, g };
}

/** draw fn(g, x, y) at every wrapped copy that can touch the tile */
function wrapped(g, size, x, y, reach, fn) {
  for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
    const px = x + ox, py = y + oy;
    if (px < -reach || py < -reach || px > size + reach || py > size + reach) continue;
    fn(g, px, py);
  }
}

/** a loaded stroke: a tapered body along its angle with bristle streaks that run out into a dry tail */
function stroke(g, size, x, y, len, wid, ang, tone, alpha, r) {
  const v = Math.round(tone);
  wrapped(g, size, x, y, len + wid, (g, px, py) => {
    g.save();
    g.translate(px, py); g.rotate(ang);
    g.globalAlpha = alpha;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.beginPath();
    g.moveTo(-len * 0.5, 0);
    g.bezierCurveTo(-len * 0.35, -wid, len * 0.2, -wid * 0.9, len * 0.5, -wid * 0.15);
    g.lineTo(len * 0.5, wid * 0.15);
    g.bezierCurveTo(len * 0.2, wid * 0.9, -len * 0.35, wid, -len * 0.5, 0);
    g.fill();
    // bristles: a few thin streaks that carry on past the body, thinning
    const n = 3 + Math.floor(r() * 4);
    g.strokeStyle = `rgb(${v},${v},${v})`;
    for (let i = 0; i < n; i++) {
      const off = (r() - 0.5) * wid * 1.5;
      g.globalAlpha = alpha * (0.35 + 0.4 * r());
      g.lineWidth = Math.max(0.6, wid * (0.12 + 0.12 * r()));
      g.beginPath(); g.moveTo(len * (0.1 + 0.2 * r()), off); g.lineTo(len * (0.55 + 0.35 * r()), off * 0.7); g.stroke();
    }
    g.restore();
  });
}

function ellipse(g, size, x, y, rx, ry, ang, style, alpha = 1) {
  wrapped(g, size, x, y, rx + ry, (g, px, py) => {
    g.globalAlpha = alpha; g.fillStyle = style;
    g.beginPath(); g.ellipse(px, py, rx, ry, ang, 0, Math.PI * 2); g.fill();
  });
  g.globalAlpha = 1;
}

/** a terminalia leaf (obovate: broad toward the tip, narrowing to the stalk) */
function leaf(g, size, x, y, len, ang) {
  wrapped(g, size, x, y, len, (g, px, py) => {
    g.save(); g.translate(px, py); g.rotate(ang);
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(-len * 0.5, 0);
    g.bezierCurveTo(-len * 0.2, -len * 0.16, len * 0.25, -len * 0.34, len * 0.46, -len * 0.08);
    g.quadraticCurveTo(len * 0.52, 0, len * 0.46, len * 0.08);
    g.bezierCurveTo(len * 0.25, len * 0.34, -len * 0.2, len * 0.16, -len * 0.5, 0);
    g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = Math.max(0.6, len * 0.03);
    g.beginPath(); g.moveTo(-len * 0.5, 0); g.lineTo(-len * 0.66, len * 0.02); g.stroke();
    g.restore();
  });
}

export function brushCanvas(size = 512) {
  const r = seeded(20261122);
  // ---- r: dabs
  const R = layer(size);
  for (let i = 0; i < 60; i++) ellipse(R.g, size, r() * size, r() * size, 30 + r() * 50, 14 + r() * 24, r() * Math.PI, r() < 0.5 ? 'rgb(92,92,92)' : 'rgb(166,166,166)', 0.45);
  for (let i = 0; i < 300; i++) {
    const tone = r() < 0.5 ? 50 + r() * 50 : 170 + r() * 60;
    stroke(R.g, size, r() * size, r() * size, 16 + r() * 26, 3 + r() * 4, r() * Math.PI, tone, 0.8, r);
  }
  for (let i = 0; i < 900; i++) {
    const tone = r() < 0.5 ? 40 + r() * 56 : 172 + r() * 70;
    ellipse(R.g, size, r() * size, r() * size, 1.6 + r() * 3.6, 1 + r() * 1.8, r() * Math.PI, `rgb(${tone | 0},${tone | 0},${tone | 0})`, 0.9);
  }
  // ---- g: long strokes along x
  const G = layer(size);
  for (let i = 0; i < 70; i++) ellipse(G.g, size, r() * size, r() * size, 60 + r() * 90, 6 + r() * 10, (r() - 0.5) * 0.12, r() < 0.5 ? 'rgb(104,104,104)' : 'rgb(152,152,152)', 0.5);
  for (let i = 0; i < 380; i++) {
    const tone = r() < 0.5 ? 54 + r() * 46 : 168 + r() * 60;
    stroke(G.g, size, r() * size, r() * size, 40 + r() * 70, 1.5 + r() * 2.5, (r() - 0.5) * 0.16, tone, 0.75, r);
  }
  // ---- b: grain (aggregate, sand, chips)
  const B = layer(size);
  for (let i = 0; i < 9000; i++) {
    const tone = r() < 0.5 ? 70 + r() * 40 : 160 + r() * 60;
    const s = 0.5 + r() * r() * 2.2;
    ellipse(B.g, size, r() * size, r() * size, s, s * (0.6 + 0.4 * r()), r() * Math.PI, `rgb(${tone | 0},${tone | 0},${tone | 0})`, 0.85);
  }
  for (let i = 0; i < 160; i++) {
    const tone = r() < 0.6 ? 60 : 200;
    ellipse(B.g, size, r() * size, r() * size, 2.5 + r() * 3, 1.6 + r() * 2, r() * Math.PI, `rgb(${tone},${tone},${tone})`, 0.9);
  }
  // ---- a: leaves (on black)
  const A = layer(size);
  A.g.fillStyle = '#000'; A.g.fillRect(0, 0, size, size);
  for (let i = 0; i < 70; i++) leaf(A.g, size, r() * size, r() * size, 26 + r() * 22, r() * Math.PI * 2);
  for (let i = 0; i < 120; i++) ellipse(A.g, size, r() * size, r() * size, 3 + r() * 5, 1.4 + r() * 2, r() * Math.PI, '#fff', 0.9);

  const out = document.createElement('canvas');
  out.width = out.height = size;
  const og = out.getContext('2d');
  const img = og.createImageData(size, size);
  const dr = R.g.getImageData(0, 0, size, size).data, dg = G.g.getImageData(0, 0, size, size).data;
  const db = B.g.getImageData(0, 0, size, size).data, da = A.g.getImageData(0, 0, size, size).data;
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = dr[i]; img.data[i + 1] = dg[i]; img.data[i + 2] = db[i]; img.data[i + 3] = da[i];
  }
  return { size, data: img.data, canvas: out, image: img };
}

export function createBrushTexture(renderer, size = 512) {
  const b = brushCanvas(size);
  // a DataTexture keeps the alpha channel as data (a canvas would premultiply it away)
  const tex = new THREE.DataTexture(new Uint8Array(b.data.buffer.slice(0)), size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() || 4);
  tex.colorSpace = THREE.NoColorSpace;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}
