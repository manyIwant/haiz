/**
 * NIANLUN · Chronoscope — Polar Geometry & Continuous Scale Engine
 *
 * Coordinate convention:
 * - Angle 0° is at 12 o'clock (Top), increasing clockwise.
 * - Polar to Cartesian: x = r * sin(rad), y = -r * cos(rad)
 * - Cartesian to Polar: theta = atan2(x, -y) in [0, 360)
 */

export const SCALES = [
  { id: 'hour',  index: 0, label: '时分', en: 'Hour',  spanDesc: '60 分钟' },
  { id: 'day',   index: 1, label: '昼夜', en: 'Day',   spanDesc: '24 小时' },
  { id: 'week',  index: 2, label: '周律', en: 'Week',  spanDesc: '7 日循环' },
  { id: 'month', index: 3, label: '月相', en: 'Month', spanDesc: '当月历日' },
  { id: 'year',  index: 4, label: '年轮', en: 'Year',  spanDesc: '四季节气' },
  { id: 'era',   index: 5, label: '纪元', en: 'Era',   spanDesc: '多年年轮' },
];

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

export function normAngle(deg) {
  return ((deg % 360) + 360) % 360;
}

/**
 * Shortest signed angular difference from a to b in [-180, 180)
 */
export function angleDiff(a, b) {
  let d = normAngle(b - a);
  if (d >= 180) d -= 360;
  return d;
}

export function polarToXY(r, angleDeg) {
  const rad = angleDeg * DEG2RAD;
  return {
    x: r * Math.sin(rad),
    y: -r * Math.cos(rad),
  };
}

export function xyToPolar(x, y) {
  const r = Math.hypot(x, y);
  const angle = normAngle(Math.atan2(x, -y) * RAD2DEG);
  return { r, angle };
}

/**
 * SVG path for a circular arc from startDeg to endDeg (clockwise)
 */
export function describeArc(r, startDeg, endDeg) {
  const span = endDeg - startDeg;
  if (Math.abs(span) >= 359.99) {
    const p1 = polarToXY(r, 0);
    const p2 = polarToXY(r, 180);
    return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 1 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} A ${r} ${r} 0 1 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  }
  const s = polarToXY(r, startDeg);
  const e = polarToXY(r, endDeg);
  const largeArc = normAngle(span) > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

/**
 * SVG path for an annular sector (ring wedge) between rInner and rOuter from startDeg to endDeg
 */
export function describeSector(rInner, rOuter, startDeg, endDeg) {
  const span = normAngle(endDeg - startDeg);
  if (span < 0.05) return '';
  if (span >= 359.95) {
    return `${describeArc(rOuter, 0, 360)} ${describeArc(rInner, 0, 360)}`;
  }
  const os = polarToXY(rOuter, startDeg);
  const oe = polarToXY(rOuter, endDeg);
  const ie = polarToXY(rInner, endDeg);
  const is = polarToXY(rInner, startDeg);
  const largeArc = span > 180 ? 1 : 0;
  return [
    `M ${os.x.toFixed(2)} ${os.y.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${oe.x.toFixed(2)} ${oe.y.toFixed(2)}`,
    `L ${ie.x.toFixed(2)} ${ie.y.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${is.x.toFixed(2)} ${is.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

/**
 * Compute continuous radial layout for all 6 scales given continuous sigma in [0, 5].
 *
 * Focus scale (d = 0) occupies [200, 350].
 * Parent scales (d > 0) nest inward: each step shrinks by ~42px toward the origin core.
 * Child scale (d in [-1, 0)) sits outside as a vernier rim at ~368..395.
 */
export function computeScaleLayout(sigma) {
  return SCALES.map((s) => {
    const d = s.index - sigma;
    let rInner, rOuter, opacity, role;

    if (Math.abs(d) < 0.5) {
      role = 'focus';
    } else if (d >= 0.5) {
      role = 'parent';
    } else {
      role = 'child';
    }

    if (d >= 0) {
      // Focus (d=0) -> rOuter=350, rInner=205
      // Parent (d=1) -> rOuter=196, rInner=154
      // Parent (d=2) -> rOuter=146, rInner=110
      // Parent (d=3) -> rOuter=102, rInner=72
      const t = Math.min(d, 4);
      const bandWidth = 145 * Math.pow(0.45, Math.min(t, 1.5)) + (t > 1.5 ? 0 : 0);
      rOuter = 350 - 154 * (1 - Math.pow(0.62, t)) * 1.45;
      // Smooth piecewise curve that guarantees zero overlap
      if (t <= 1) {
        rOuter = 350 - t * 154; // 350 -> 196
        rInner = 205 - t * 51;  // 205 -> 154
      } else {
        const extra = t - 1;
        rOuter = 196 - extra * 46;
        rInner = 154 - extra * 40;
      }
      opacity = d > 3.3 ? Math.max(0, 1 - (d - 3.3) / 0.7) : 1;
    } else {
      // Child scale (d < 0): expands outward to vernier rim then fades
      const t = -d; // > 0
      rInner = 350 + t * 18;
      rOuter = 350 + Math.max(24, 145 * (1 - t * 0.78));
      if (t <= 1) {
        rInner = 205 + t * 162; // 205 -> 367
        rOuter = 350 + t * 44;  // 350 -> 394
        opacity = 1 - t * 0.35;
      } else {
        rInner = 367 + (t - 1) * 20;
        rOuter = 394 + (t - 1) * 14;
        opacity = Math.max(0, 0.65 - (t - 1) * 0.8);
      }
    }

    if (rInner < 36) {
      opacity *= Math.max(0, (rInner - 18) / 18);
    }

    return {
      ...s,
      d,
      role,
      rInner: Math.max(12, rInner),
      rOuter: Math.max(20, rOuter),
      rMid: Math.max(16, (rInner + rOuter) / 2),
      opacity: Math.max(0, Math.min(1, opacity)),
    };
  });
}

/**
 * Convert a timestamp's position within a given scale into a canonical angle [0, 360)
 * where 0° = start of cycle (or 12:00 Noon for Day scale).
 *
 * For Day scale: 12:00 = 0°, 18:00 = 90°, 00:00 = 180°, 06:00 = 270°.
 * For Hour scale: :00 = 0°, :15 = 90°, :30 = 180°, :45 = 270°.
 * For Week scale: Sun(0)..Sat(6) or Mon(1)..Sun(0), 1/7th per day + time-of-day fraction.
 * For Month scale: Day 1 at 0°, advancing by (day - 1 + dayFrac) / daysInMonth * 360.
 * For Year scale: Jan 1 at 0°, advancing by (dayOfYear - 1 + dayFrac) / daysInYear * 360.
 */
export function getScaleProgressAngle(scaleId, parts) {
  const dayFrac = parts.minuteOfDay / 1440;
  switch (scaleId) {
    case 'hour':
      return normAngle(((parts.minute + parts.second / 60) / 60) * 360);
    case 'day':
      // 12:00 Noon at 0°, 00:00 Midnight at 180°
      return normAngle((parts.minuteOfDay / 1440) * 360 + 180);
    case 'week': {
      // Monday = 0 .. Sunday = 6
      const monIdx = (parts.weekday + 6) % 7;
      return normAngle(((monIdx + dayFrac) / 7) * 360);
    }
    case 'month':
      return normAngle(((parts.day - 1 + dayFrac) / parts.daysInThisMonth) * 360);
    case 'year':
      return normAngle(((parts.dayOfYear - 1 + dayFrac) / parts.daysInThisYear) * 360);
    case 'era':
      // Era uses year radially and dayOfYear angularly
      return normAngle(((parts.dayOfYear - 1 + dayFrac) / parts.daysInThisYear) * 360);
    default:
      return 0;
  }
}
