// The timing of chapter 04's reveal, in one place (pure, testable).
//
// T ∈ [0, 1] is the reveal's own clock. Two fronts move outwards through the
// arrival field (see geo.js computeArrival, normalised 0 at the roots → 1 at the
// far edge of the campus):
//   ink      faint lines of the plan become visible under the water
//   surface  the water thins over the plan and withdraws; the plan is ground
// The chapter-04 frame only shows arrival ≲ 0.1, so both fronts move slowly
// while they cross the frame and then sweep the rest of the campus quickly.

const INK = [[0, -0.03], [0.1, 0.0], [0.3, 0.07], [0.5, 0.16], [0.8, 0.42], [1, 1.32]];
const SURF = [[0, -0.09], [0.32, -0.04], [0.55, 0.035], [0.78, 0.12], [0.9, 0.34], [1, 1.42]];
export const FEATHER = { ink: 0.045, surf: 0.065 };

// monotone piecewise cubic (Fritsch–Carlson) through keys
function curve(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[keys.length - 1][0]) return keys[keys.length - 1][1];
  let k = 0;
  while (t > keys[k + 1][0]) k++;
  const slope = (i) => (keys[i + 1][1] - keys[i][1]) / (keys[i + 1][0] - keys[i][0]);
  const tan = (i) => {
    if (i === 0) return slope(0);
    if (i === keys.length - 1) return slope(i - 1);
    const a = slope(i - 1), b = slope(i);
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  };
  const [x0, y0] = keys[k], [x1, y1] = keys[k + 1], h = x1 - x0, u = (t - x0) / h;
  const m0 = tan(k) * h, m1 = tan(k + 1) * h;
  return (2 * u ** 3 - 3 * u ** 2 + 1) * y0 + (u ** 3 - 2 * u ** 2 + u) * m0 + (-2 * u ** 3 + 3 * u ** 2) * y1 + (u ** 3 - u ** 2) * m1;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Everything the shader and the scene need at reveal time T. */
export function revealAt(T) {
  T = Math.min(1, Math.max(0, T));
  return {
    T,
    ink: curve(INK, T), surf: curve(SURF, T), inkFeather: FEATHER.ink, surfFeather: FEATHER.surf,
    // the artistic islet settles below the plan while the water clears round the roots
    settle: smooth(0.4, 0.72, T),
    // the film's haze and contrast give way to a readable plan
    clarity: smooth(0.35, 0.95, T)
  };
}

/** Local progress of a point with normalised arrival a (0 not reached … 1 surfaced): mirrors the shader. */
export function localAt(T, a) {
  const r = revealAt(T);
  const c = (x) => Math.min(1, Math.max(0, x));
  return { ink: c((r.ink - a) / r.inkFeather), surf: c((r.surf - a) / r.surfFeather) };
}

/** Durations (seconds) at normal speed; reduced motion collapses them. */
export const DURATION = { reveal: 6.4, retreat: 2.6, cancel: 0.9, dwell: 1.5 };
