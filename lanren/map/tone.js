// The map's colours are authored as they should finally look on screen, then
// inverted through V4's own image pipeline (ACES filmic at the chapter's
// exposure → sRGB → the Finish pass: saturation, contrast, split tone), so the
// plan reads at its designed values inside the film's grade instead of being
// re-graded by it. Pure functions (testable in Node).

const IN = [[0.59719, 0.35458, 0.04823], [0.07600, 0.90834, 0.01566], [0.02840, 0.13383, 0.83777]];
const OUT = [[1.60475, -0.53108, -0.07367], [-0.10208, 1.10813, -0.00605], [-0.00327, -0.07276, 1.07602]];
const mul = (M, v) => M.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const rrt = (v) => v.map((x) => (x * (x + 0.0245786) - 0.000090537) / (x * (0.983729 * x + 0.4329510) + 0.238081));
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const oetf = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const luma = (c) => c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;

/** scene-linear colour → displayed sRGB (0..1) after tone mapping and the Finish grade (vignette and grain left out) */
export function forward(lin, P) {
  let c = lin.map((x) => (x * P.exposure) / 0.6);
  c = mul(OUT, rrt(mul(IN, c))).map(clamp01).map(oetf);
  const l = luma(c);
  c = c.map((x) => l + (x - l) * P.sat).map((x) => clamp01((x - 0.5) * P.contrast + 0.5));
  const l2 = luma(c), k = smooth(0.15, 0.85, l2);
  const sh = [0.94 + 0.03 * P.warm, 0.98, 1.06 - 0.03 * P.warm], hi = [1.0 + 0.05 * P.warm, 1.0 - 0.01 * (1 - P.warm), 0.97 - 0.05 * P.warm];
  return c.map((x, i) => x * (sh[i] + (hi[i] - sh[i]) * k));
}

/** displayed sRGB target → the scene-linear colour that produces it (fixed-point iteration) */
export function invert(target, P) {
  let x = target.map((t) => Math.max(1e-4, Math.pow(t, 2.2) * 0.6 / P.exposure));
  // bounded multiplicative steps: near black the contrast stage clips to 0, and an unbounded
  // ratio would throw the guess to infinity
  for (let k = 0; k < 160; k++) {
    const y = forward(x, P);
    x = x.map((v, i) => {
      const r = Math.pow(Math.max(1e-4, target[i]) / Math.max(1e-4, y[i]), 1.2);
      return Math.min(16, Math.max(1e-5, v * Math.min(1.6, Math.max(0.6, r))));
    });
  }
  return x;
}

export const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
