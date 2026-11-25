// HAIZ Campus Toybox — procedural texture atelier.
// Every texture in the project is generated from code (no third-party bitmaps), so it can be
// regenerated at any resolution, versioned with the source and exported to PNG by
// `npm run export:assets`.
import * as THREE from 'three';

/** Small deterministic PRNG (mulberry32) so textures are identical on every device. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map();

function makeCanvas(w, h) {
  // HTMLCanvasElement (not OffscreenCanvas) so GLTFExporter & the PNG exporter can read it back.
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** Tileable height field made of short overlapping "fibres" — the signature of wool felt. */
function fibreHeight(size, seed, { count = 2600, len = 7, soft = 0.6 } = {}) {
  const r = rng(seed);
  const h = new Float32Array(size * size);
  for (let i = 0; i < count; i++) {
    const x0 = r() * size, y0 = r() * size;
    const a = r() * Math.PI * 2;
    const l = len * (0.4 + r());
    const amp = (r() * 2 - 1) * 0.5 + 0.5;
    const steps = Math.ceil(l * 2);
    const curl = (r() - 0.5) * 0.25;
    let ang = a;
    let x = x0, y = y0;
    for (let s = 0; s < steps; s++) {
      ang += curl;
      x += Math.cos(ang) * 0.5; y += Math.sin(ang) * 0.5;
      const ix = ((Math.round(x) % size) + size) % size;
      const iy = ((Math.round(y) % size) + size) % size;
      h[iy * size + ix] += amp;
    }
  }
  // blur (wrap-around) for softness
  const tmp = new Float32Array(size * size);
  const passes = Math.round(soft * 3);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        s += h[((y + dy + size) % size) * size + ((x + dx + size) % size)];
      }
      tmp[y * size + x] = s / 9;
    }
    h.set(tmp);
  }
  let mx = 0; for (const v of h) mx = Math.max(mx, v);
  for (let i = 0; i < h.length; i++) h[i] /= mx || 1;
  return h;
}

function heightToNormalCanvas(h, size, strength = 2.0) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const l = h[y * size + ((x - 1 + size) % size)], rr = h[y * size + ((x + 1) % size)];
    const u = h[((y - 1 + size) % size) * size + x], d = h[((y + 1) % size) * size + x];
    let nx = (l - rr) * strength, ny = (u - d) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * size + x) * 4;
    img.data[i] = (nx * 0.5 + 0.5) * 255;
    img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
    img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function canvasTexture(canvas, { srgb = false, repeat = 1, name = '' } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  t.name = name;
  t.userData.canvas = canvas;
  return t;
}

function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

/* ---------------------------------------------------------------- textile maps */

/** Wool felt normal map — short, matted fibres. */
export const feltNormal = () => cached('feltNormal', () => {
  const s = 256;
  return canvasTexture(heightToNormalCanvas(fibreHeight(s, 11, { count: 3200, len: 6 }), s, 3.2), { repeat: 3, name: 'tex_felt_normal' });
});

/** Longer plush (minky / short pile) normal map for furry characters. */
export const plushNormal = () => cached('plushNormal', () => {
  const s = 256;
  return canvasTexture(heightToNormalCanvas(fibreHeight(s, 23, { count: 1800, len: 12, soft: 0.34 }), s, 2.6), { repeat: 2.5, name: 'tex_plush_normal' });
});

/** Woven cotton (canvas cloth) normal map for the schoolbag and uniform. */
export const wovenNormal = () => cached('wovenNormal', () => {
  const s = 128;
  const h = new Float32Array(s * s);
  const r = rng(5);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const wx = Math.sin((x / s) * Math.PI * 2 * 16), wy = Math.sin((y / s) * Math.PI * 2 * 16);
    const over = ((Math.floor(x / (s / 16)) + Math.floor(y / (s / 16))) & 1) ? wx : wy;
    h[y * s + x] = 0.5 + 0.35 * over + (r() - 0.5) * 0.15;
  }
  return canvasTexture(heightToNormalCanvas(h, s, 2.2), { repeat: 5, name: 'tex_woven_normal' });
});

/* ---------------------------------------------------------------- machine maps */

/** 水磨石 terrazzo — the floor of almost every Chinese school corridor. */
export const terrazzoColor = () => cached('terrazzo', () => {
  const s = 512;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const r = rng(77);
  ctx.fillStyle = '#e9dfcf';
  ctx.fillRect(0, 0, s, s);
  // cement cloudiness
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(${200 + r() * 30},${190 + r() * 30},${170 + r() * 30},0.06)`;
    const rad = 20 + r() * 60;
    ctx.beginPath(); ctx.arc(r() * s, r() * s, rad, 0, Math.PI * 2); ctx.fill();
  }
  const chips = ['#c9705a', '#3f6f68', '#d9b45a', '#f6f1e6', '#8a8f86', '#b4553f', '#2f4d4a', '#e9c9a8'];
  const drawChip = (x, y, rad) => {
    ctx.fillStyle = chips[Math.floor(r() * chips.length)];
    ctx.beginPath();
    const n = 5 + Math.floor(r() * 4);
    const rot = r() * 6.28;
    for (let k = 0; k < n; k++) {
      const a = rot + (k / n) * Math.PI * 2;
      const rr = rad * (0.6 + r() * 0.5);
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  };
  for (let i = 0; i < 900; i++) {
    const x = r() * s, y = r() * s, rad = 1 + Math.pow(r(), 3) * 9;
    // draw wrapped copies so the map tiles
    for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
      if (x + ox > -12 && x + ox < s + 12 && y + oy > -12 && y + oy < s + 12) drawChip(x + ox, y + oy, rad);
    }
  }
  return canvasTexture(c, { srgb: true, repeat: 1, name: 'tex_terrazzo' });
});

/** Lime-wash stucco of a 骑楼 arcade façade: soft pigment clouds + fine grain. */
export const stuccoColor = (base = '#f0c9a6', seed = 3) => cached('stucco' + base + seed, () => {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const r = rng(seed);
  ctx.fillStyle = base; ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 260; i++) {
    const light = r() > 0.5;
    ctx.fillStyle = light ? 'rgba(255,248,235,0.05)' : 'rgba(150,90,60,0.04)';
    const x = r() * s, y = r() * s, rad = 6 + r() * 40;
    for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
      ctx.beginPath(); ctx.arc(x + ox, y + oy, rad, 0, Math.PI * 2); ctx.fill();
    }
  }
  const img = ctx.getImageData(0, 0, s, s);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 14;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return canvasTexture(c, { srgb: true, repeat: 2, name: 'tex_stucco' });
});

/** Teak-like wood grain. */
export const woodColor = (base = '#8a5a3b', seed = 9) => cached('wood' + base + seed, () => {
  const w = 256, h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const r = rng(seed);
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    const y0 = r() * h;
    ctx.strokeStyle = r() > 0.5 ? 'rgba(40,20,10,0.18)' : 'rgba(255,220,180,0.10)';
    ctx.lineWidth = 0.5 + r() * 2.2;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const y = y0 + Math.sin((x / w) * Math.PI * 2 * (1 + Math.floor(r() * 2)) + i) * 3 + Math.sin(x * 0.11 + i) * 0.8;
      x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  return canvasTexture(c, { srgb: true, repeat: 1, name: 'tex_wood' });
});

/**
 * Interior wallpaper of the machine: hand-printed Terminalia catappa (榄仁) leaves,
 * in the manner of a block-printed textile. Drawn with code so it is fully original.
 */
export const leafWallpaper = () => cached('leafWallpaper', () => {
  const s = 512;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const r = rng(321);
  ctx.fillStyle = '#f3e7cf'; ctx.fillRect(0, 0, s, s);
  const leaf = (x, y, rot, size, col) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(size, size);
    // obovate leaf: narrow at the stalk, broad near the tip — the Terminalia signature
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-10, -8, -26, -40, -18, -62);
    ctx.bezierCurveTo(-12, -78, 12, -78, 18, -62);
    ctx.bezierCurveTo(26, -40, 10, -8, 0, 0);
    ctx.fillStyle = col; ctx.fill();
    ctx.strokeStyle = 'rgba(255,250,235,0.55)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, -70); ctx.stroke();
    for (let k = 1; k < 6; k++) {
      const yy = -k * 11;
      ctx.beginPath(); ctx.moveTo(0, yy); ctx.quadraticCurveTo(8, yy - 6, 15, yy - 13); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, yy); ctx.quadraticCurveTo(-8, yy - 6, -15, yy - 13); ctx.stroke();
    }
    ctx.restore();
  };
  const palette = ['#7fa37a', '#5f8b6d', '#9bb37f', '#c9784e', '#e0a35a'];
  // whorls of leaves (Terminalia leaves cluster at branch tips)
  for (let i = 0; i < 14; i++) {
    const cx = r() * s, cy = r() * s;
    const n = 4 + Math.floor(r() * 3);
    const base = r() * 6.28;
    for (let k = 0; k < n; k++) {
      const col = palette[r() > 0.82 ? 3 + Math.floor(r() * 2) : Math.floor(r() * 3)];
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
        if (cx + ox > -90 && cx + ox < s + 90 && cy + oy > -90 && cy + oy < s + 90)
          leaf(cx + ox, cy + oy, base + (k / n) * Math.PI * 2, 0.55 + r() * 0.25, col);
      }
    }
  }
  // printing irregularity
  const img = ctx.getImageData(0, 0, s, s);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 18;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return canvasTexture(c, { srgb: true, repeat: 1, name: 'tex_leaf_wallpaper' });
});

/** Soft radial contact-shadow texture (used under toys & machine). */
export const contactShadow = () => cached('contactShadow', () => {
  const s = 128;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(40,24,14,0.55)');
  g.addColorStop(0.45, 'rgba(40,24,14,0.25)');
  g.addColorStop(1, 'rgba(40,24,14,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  const t = canvasTexture(c, { srgb: true, name: 'tex_contact_shadow' });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
});

/** All static textures, for the asset exporter. */
export const ALL_TEXTURES = {
  tex_felt_normal: feltNormal,
  tex_plush_normal: plushNormal,
  tex_woven_normal: wovenNormal,
  tex_terrazzo: terrazzoColor,
  tex_stucco: () => stuccoColor(),
  tex_wood: () => woodColor(),
  tex_leaf_wallpaper: leafWallpaper,
  tex_contact_shadow: contactShadow,
};

export function disposeTextureCache() {
  for (const t of cache.values()) t.dispose?.();
  cache.clear();
}
