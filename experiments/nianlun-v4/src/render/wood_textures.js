/**
 * HAIZ · NIANLUN · 一卷 V4 — Procedural Wood End-Grain & Paper Fiber Synthesizer
 *
 * Inspired by Larsson et al. (SIGGRAPH 2022, marialarsson/procedural_knots) scalar-field
 * earlywood/latewood density profiles & HAIZ `lanren/rings/disc.js` harmonic warmth.
 *
 * STRICT INVARIANTS (Master v4 §4.2, §10, §13 #6):
 *  - Every calendar week = 1 ring of STRICTLY UNIFORM radial width (geometry is 100% calendar-driven!)
 *  - Monday = 12 o'clock (-π/2), clockwise 7 days.
 *  - Holiday weeks are tinted paler sapwood; semester seams carry a quiet fine border.
 *  - Optional ERA5 Haikou rain/temperature ONLY modulates pigment warmth/wetness — NEVER shifts ring geometry!
 *  - Offscreen cached per roll signature for effortless 60fps jog-dial rotation.
 */

const TAU = Math.PI * 2;
const discCache = new Map();

function clamp(v, a = 0, b = 1) {
  return Math.max(a, Math.min(b, v));
}

function mixRgb(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

/** Smooth 1D value noise for micro wood-grain shimmer without breaking ring geometry */
function grainNoise(theta, ringIdx) {
  const a = Math.sin(theta * 3.0 + ringIdx * 1.7) * 0.5
    + Math.sin(theta * 7.0 - ringIdx * 2.3) * 0.3
    + Math.sin(theta * 17.0 + ringIdx * 0.9) * 0.2;
  return a;
}

/**
 * Build or retrieve an offscreen canvas containing the high-DPI wooden annual-ring end-face.
 * `weeksData`: array from innermost ring (k=0) to outermost ring (k=weeks-1).
 * Each week entry: { isHoliday, isSemesterSeam, days: [{ wd, climate }] }
 */
export function getAnnualRingDiscCanvas({
  key,
  radiusPx,
  dpr,
  weeksData,
  dark,
  lowPower = false,
}) {
  const cacheKey = `${key}|${Math.round(radiusPx)}|${dpr.toFixed(1)}|${dark ? 'd' : 'l'}|${lowPower ? 'lo' : 'hi'}`;
  const cached = discCache.get(cacheKey);
  if (cached) return cached;

  // Keep cache bounded
  if (discCache.size > 24) {
    const firstKey = discCache.keys().next().value;
    discCache.delete(firstKey);
  }

  const size = Math.ceil((radiusPx + 4) * 2 * dpr);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const cx = size / 2;
  const cy = size / 2;
  const R = radiusPx * dpr;
  const weeks = Math.max(1, weeksData.length);
  const pithR = Math.max(2.6 * dpr, R * 0.14);
  const usableR = R - pithR - 1.2 * dpr;

  // Low-power clean vector fallback (Master v4 §9.6)
  if (lowPower) {
    const bg = ctx.createRadialGradient(cx - R * 0.2, cy - R * 0.2, pithR * 0.5, cx, cy, R);
    bg.addColorStop(0, dark ? '#3e3429' : '#efe7d8');
    bg.addColorStop(1, dark ? '#26201a' : '#d8c9ae');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();

    for (let k = 1; k <= weeks; k++) {
      const rr = pithR + (usableR * k) / weeks;
      ctx.strokeStyle = dark ? 'rgba(218,195,158,0.28)' : 'rgba(105,78,48,0.28)';
      ctx.lineWidth = (k === weeks ? 1.3 : 0.75) * dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, TAU);
      ctx.stroke();
    }
    discCache.set(cacheKey, canvas);
    return canvas;
  }

  // Full procedural Larsson-inspired earlywood/latewood pixel synthesis
  const img = ctx.createImageData(size, size);
  const data = img.data;

  // Palette tuned for HAIZ tropical-almond sapwood (light) & smoked walnut (dark)
  const EARLY_WOOD = dark ? [64, 54, 43] : [242, 234, 217];
  const LATE_WOOD = dark ? [38, 30, 23] : [188, 161, 123];
  const HOLIDAY_SAP = dark ? [82, 72, 58] : [249, 245, 236];
  const WET_PATINA = dark ? [46, 36, 26] : [150, 122, 88];
  const PITH_COL = dark ? [30, 23, 18] : [132, 101, 69];
  const RIM_BARK = dark ? [24, 19, 15] : [118, 92, 64];

  for (let py = 0; py < size; py++) {
    const dy = py + 0.5 - cy;
    for (let px = 0; px < size; px++) {
      const dx = px + 0.5 - cx;
      const dist = Math.hypot(dx, dy);
      const o = (py * size + px) * 4;

      if (dist > R + 1.0 * dpr) continue;

      // Soft anti-aliased outer edge
      const alphaEdge = clamp((R + 0.6 * dpr - dist) / (1.2 * dpr));
      if (alphaEdge <= 0.01) continue;

      // Angle: 0 at 12 o'clock (Monday), clockwise [0, TAU)
      const th = (Math.atan2(dx, -dy) + TAU) % TAU;

      // Cylindrical directional illumination (soft upper-left key light)
      const nx = dx / R;
      const ny = dy / R;
      const light = 0.94 - (nx * 0.08 + ny * 0.11);

      let rgb;
      if (dist < pithR) {
        // Tree pith (heartwood core)
        const pFrac = dist / pithR;
        rgb = mixRgb(PITH_COL, EARLY_WOOD, pFrac * 0.35);
      } else if (dist > R - 1.4 * dpr) {
        // Delicate outer rim bark/cambium bevel
        rgb = RIM_BARK;
      } else {
        // STRICT CALENDAR RING INDEX (never perturbed by weather!)
        const ringPos = ((dist - pithR) / usableR) * weeks;
        const k = Math.min(weeks - 1, Math.max(0, Math.floor(ringPos)));
        const frac = ringPos - k; // 0 = inner earlywood, 1 = outer latewood ridge
        const wk = weeksData[k];

        // Larsson-style asymmetric earlywood -> dense latewood transition
        const shimmer = grainNoise(th, k) * 0.06;
        const lateFactor = clamp(Math.pow(clamp(frac + shimmer * 0.45), 2.55) * 0.88, 0, 1);

        let baseEarly = wk && wk.isHoliday ? HOLIDAY_SAP : EARLY_WOOD;
        rgb = mixRgb(baseEarly, LATE_WOOD, lateFactor);

        // Optional real Haikou ERA5 weather patina (color ONLY, zero geometry shift!)
        if (wk && wk.dayWeather) {
          const wd = Math.min(6, Math.floor((th / TAU) * 7));
          const wInfo = wk.dayWeather[wd];
          if (wInfo) {
            const rainNorm = clamp(Math.log1p(wInfo.rain || 0) / Math.log1p(90));
            if (rainNorm > 0.08) {
              rgb = mixRgb(rgb, WET_PATINA, rainNorm * 0.24);
            }
          }
        }

        // Sharp organic ring boundary hairline at the outer edge of each week
        const pxPerRing = usableR / weeks;
        const distToEdge = (1 - frac) * pxPerRing;
        if (distToEdge < 0.95 * dpr) {
          const ridge = wk && wk.isSemesterSeam ? 0.64 : 0.82;
          rgb = [rgb[0] * ridge, rgb[1] * ridge, rgb[2] * ridge];
        }

        // Subtle radial medullary rays (木射线) & cellular micro-grain
        const ray = Math.pow(Math.abs(Math.sin(th * 26.0 + 0.4)), 18.0) * 0.055;
        const pore = (hash2(Math.floor(th * 120), Math.floor(dist * 0.9)) - 0.5) * 0.032;
        const micro = 1.0 - ray + pore;
        rgb = [rgb[0] * micro, rgb[1] * micro, rgb[2] * micro];
      }

      // Apply subtle 3D key light + gentle inner rim highlight
      const rimGlow = dist > R - 2.6 * dpr && dist < R - 1.1 * dpr ? 1.04 : 1.0;
      data[o] = clamp(Math.round(rgb[0] * light * rimGlow), 0, 255);
      data[o + 1] = clamp(Math.round(rgb[1] * light * rimGlow), 0, 255);
      data[o + 2] = clamp(Math.round(rgb[2] * light * rimGlow), 0, 255);
      data[o + 3] = Math.round(alphaEdge * 255);
    }
  }

  ctx.putImageData(img, 0, 0);
  discCache.set(cacheKey, canvas);
  return canvas;
}

/**
 * Clear texture cache when theme or climate patina updates.
 */
export function clearWoodTextureCache() {
  discCache.clear();
}
