// 入画 · how the painting is made: strokes planned from the picture they will become.
//
// The reference is the painted world itself, seen from the painter's eye, under today's sky (a
// render of the V2 walk, pipeline.js). From it, like a painter working from coarse to fine
// (after Hertzmann, "Painterly Rendering with Curved Brush Strokes of Multiple Sizes", 1998):
//
//   起稿 charcoal   lines along the silhouettes (jumps in distance: the trunk against the building,
//                   the crown against the sky) and the strongest tone edges
//   铺色 block-in    wide strokes everywhere on the canvas, colours of a blurred reference
//   塑形 forms       medium strokes where the picture has form at that scale
//   点叶 touches     small dabs only where there is fine detail: leaves, window bars, edges
//
// Strokes follow the tone (perpendicular to the gradient), stop where the colour changes, and keep
// a little of their own jitter. Pure: plain arrays in, plain arrays out (Node-testable).

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function boxBlur(src, w, h, r, ch = 3) {
  if (r < 1) return src.slice();
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  const pass = (a, b, horiz) => {
    const len = horiz ? w : h, lines = horiz ? h : w;
    for (let l = 0; l < lines; l++) {
      for (let c = 0; c < ch; c++) {
        let acc = 0;
        const at = (i) => { i = Math.max(0, Math.min(len - 1, i)); return horiz ? (l * w + i) * ch + c : (i * w + l) * ch + c; };
        for (let i = -r; i <= r; i++) acc += a[at(i)];
        for (let i = 0; i < len; i++) {
          b[at(i)] = acc / (2 * r + 1);
          acc += a[at(i + r + 1)] - a[at(i - r)];
        }
      }
    }
  };
  pass(src, tmp, true); pass(tmp, out, false);
  return out;
}

/**
 * rgba: Uint8 RGBA (sRGB, row 0 at the bottom as WebGL reads it), dist: Float32 metres (same layout),
 * w, h: size; rect: the canvas on that screen [x0, y0, x1, y1] in 0..1.
 * Returns { charcoal: [stroke], layers: [[stroke], …] } with stroke = { pts: [x, y, …] (0..1), w (0..1 of width),
 *   col: [r, g, b] (sRGB 0..1), layer, jit }
 */
export function planStrokes(rgba, dist, w, h, rect, { seed = 7, scale = 1 } = {}) {
  const r = rng(seed);
  const N = w * h;
  const img = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { img[i * 3] = rgba[i * 4] / 255; img[i * 3 + 1] = rgba[i * 4 + 1] / 255; img[i * 3 + 2] = rgba[i * 4 + 2] / 255; }
  const lum = (a, i) => 0.3 * a[i * 3] + 0.59 * a[i * 3 + 1] + 0.11 * a[i * 3 + 2];
  const inRect = (x, y) => x >= rect[0] * w && x <= rect[2] * w && y >= rect[1] * h && y <= rect[3] * h;
  const idx = (x, y) => Math.max(0, Math.min(h - 1, Math.round(y))) * w + Math.max(0, Math.min(w - 1, Math.round(x)));

  // ---- edges: distance jumps (silhouettes) and tone edges
  const logD = new Float32Array(N);
  for (let i = 0; i < N; i++) logD[i] = Math.log(Math.max(0.3, Math.min(4000, dist[i])));
  const soft = boxBlur(img, w, h, 1);
  const E = new Float32Array(N), GX = new Float32Array(N), GY = new Float32Array(N);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const dx = logD[i + 1] - logD[i - 1], dy = logD[i + w] - logD[i - w];
    const lx = lum(soft, i + 1) - lum(soft, i - 1), ly = lum(soft, i + w) - lum(soft, i - w);
    const de = Math.hypot(dx, dy) * 1.6, le = Math.hypot(lx, ly) * 3.2;
    E[i] = Math.max(de, le);
    if (de > le) { GX[i] = dx; GY[i] = dy; } else { GX[i] = lx; GY[i] = ly; }
  }
  const charcoal = [];
  const occ = new Uint8Array(N);
  const S = Math.max(2, Math.round(3 * scale));
  for (let y = S; y < h - S; y += S) for (let x = S; x < w - S; x += S) {
    const jx = x + (r() - 0.5) * S, jy = y + (r() - 0.5) * S;
    if (!inRect(jx, jy)) continue;
    const i0 = idx(jx, jy);
    if (E[i0] < 0.42 || occ[i0] || r() < 0.35) continue;
    const trace = (sgn) => {
      const line = [];
      let px = jx, py = jy, pdx = 0, pdy = 0;
      for (let k = 0; k < 9; k++) {
        const i = idx(px, py);
        if (E[i] < 0.22 || !inRect(px, py)) break;
        let tx = -GY[i], ty = GX[i];
        const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
        if (k === 0) { tx *= sgn; ty *= sgn; } else if (tx * pdx + ty * pdy < 0) { tx = -tx; ty = -ty; }
        pdx = tx; pdy = ty;
        px += tx * 2.4 * scale; py += ty * 2.4 * scale;
        line.push([px, py]);
        occ[idx(px, py)] = 1;
      }
      return line;
    };
    const fwd = trace(1), back = trace(-1);
    const pts = [...back.reverse(), [jx, jy], ...fwd].flat();
    if (pts.length < 8) continue;
    const norm = [];
    for (let k = 0; k < pts.length; k += 2) norm.push(pts[k] / w + (r() - 0.5) * 0.0008, pts[k + 1] / h + (r() - 0.5) * 0.0008);
    const g = 0.12 + r() * 0.06;
    charcoal.push({ pts: norm, w: (0.8 + r() * 0.6) / w * scale, col: [g, g * 0.97, g * 0.95], layer: -1, jit: r() });
  }

  // ---- paint, coarse to fine
  const RADII = [14, 7, 3.5, 1.8].map((v) => v * scale);
  const MAXLEN = [7, 6, 4, 3];
  const DETAIL = [0, 0.045, 0.06, 0.075];
  const layers = [];
  let coarser = boxBlur(img, w, h, Math.round(RADII[0] * 1.5));
  for (let L = 0; L < RADII.length; L++) {
    const R = RADII[L];
    const ref = boxBlur(img, w, h, Math.max(1, Math.round(R * 0.6)));
    const strokes = [];
    const step = Math.max(1, R * 0.95);
    for (let y = step / 2; y < h; y += step) for (let x = step / 2; x < w; x += step) {
      const sx = x + (r() - 0.5) * step, sy = y + (r() - 0.5) * step;
      if (!inRect(sx, sy)) continue;
      const i0 = idx(sx, sy);
      if (L > 0) {
        const d = Math.abs(ref[i0 * 3] - coarser[i0 * 3]) + Math.abs(ref[i0 * 3 + 1] - coarser[i0 * 3 + 1]) + Math.abs(ref[i0 * 3 + 2] - coarser[i0 * 3 + 2]);
        if (d < DETAIL[L] && E[i0] < 0.5 + L * 0.2 && r() > 0.12) continue;
      }
      const col = [ref[i0 * 3], ref[i0 * 3 + 1], ref[i0 * 3 + 2]];
      const v = 1 + (r() - 0.5) * 0.06;
      const c = col.map((q) => Math.min(1, q * v));
      const pts = [sx / w, sy / h];
      let px = sx, py = sy, pdx = 0, pdy = 0;
      for (let k = 0; k < MAXLEN[L]; k++) {
        const i = idx(px, py);
        const dc = Math.abs(ref[i * 3] - col[0]) + Math.abs(ref[i * 3 + 1] - col[1]) + Math.abs(ref[i * 3 + 2] - col[2]);
        if (k > 0 && dc > 0.13) break;
        let gx = lum(ref, idx(px + 1, py)) - lum(ref, idx(px - 1, py)), gy = lum(ref, idx(px, py + 1)) - lum(ref, idx(px, py - 1));
        let tx = -gy, ty = gx, l = Math.hypot(tx, ty);
        if (l < 1e-4) { tx = 1; ty = 0.08 * (r() - 0.5); l = Math.hypot(tx, ty); }
        tx /= l; ty /= l;
        if (k > 0 && tx * pdx + ty * pdy < 0) { tx = -tx; ty = -ty; }
        if (k > 0) { tx = tx * 0.6 + pdx * 0.4; ty = ty * 0.6 + pdy * 0.4; const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m; }
        pdx = tx; pdy = ty;
        px += tx * R; py += ty * R;
        if (!inRect(px, py)) break;
        pts.push(px / w, py / h);
      }
      if (pts.length === 2) pts.push((sx + R * 0.6) / w, (sy + (r() - 0.5) * R * 0.3) / h);   // a dab
      strokes.push({ pts, w: (R * 2 * (0.9 + r() * 0.35)) / w, col: c, layer: L, jit: r() });
    }
    // painting order within a layer: shuffled (the brush comes back to places)
    for (let i = strokes.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [strokes[i], strokes[j]] = [strokes[j], strokes[i]]; }
    layers.push(strokes);
    coarser = ref;
  }
  return { charcoal, layers };
}
